using System.Text.Json;
using Npgsql;
using TammyAgent.Models;

namespace TammyAgent.Services
{
    /// <summary>
    /// Neon Postgres access for Tammy. This is the SAME database the main Lifeline Discord bot uses
    /// (db.js), so the Discord bot writes commands here and reads Tammy's conversations. On startup
    /// we ensure Tammy's tables exist (idempotent) so either service can create them.
    /// </summary>
    public sealed class DatabaseService : IAsyncDisposable
    {
        private readonly NpgsqlDataSource _dataSource;

        public DatabaseService(string databaseUrl)
        {
            var connString = ToNpgsqlConnectionString(databaseUrl);
            _dataSource = NpgsqlDataSource.Create(connString);
        }

        // Convert a postgres://user:pass@host:port/db URL (as used by db.js) to an Npgsql string.
        private static string ToNpgsqlConnectionString(string url)
        {
            var uri = new Uri(url);
            var userInfo = uri.UserInfo.Split(':', 2);
            var csb = new NpgsqlConnectionStringBuilder
            {
                Host = uri.Host,
                Port = uri.Port > 0 ? uri.Port : 5432,
                Username = Uri.UnescapeDataString(userInfo[0]),
                Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "",
                Database = uri.AbsolutePath.TrimStart('/'),
                SslMode = SslMode.Require,
                TrustServerCertificate = true,
                Pooling = true,
                MaxPoolSize = 5,
            };
            return csb.ConnectionString;
        }

        public async Task EnsureSchemaAsync()
        {
            await using var conn = await _dataSource.OpenConnectionAsync();
            await using var cmd = new NpgsqlCommand(Schema, conn);
            await cmd.ExecuteNonQueryAsync();

            // Ensure a single settings row exists.
            await using var seed = new NpgsqlCommand(
                @"INSERT INTO tammy_settings (id, mode, desired_status, actual_status, updated_at)
                  VALUES ('default', 'assisted', 'online', 'offline', now())
                  ON CONFLICT (id) DO NOTHING;", conn);
            await seed.ExecuteNonQueryAsync();
        }

        /* ───────── Settings ───────── */

        public async Task<string> GetModeAsync()
        {
            await using var conn = await _dataSource.OpenConnectionAsync();
            await using var cmd = new NpgsqlCommand("SELECT mode FROM tammy_settings WHERE id='default'", conn);
            var r = await cmd.ExecuteScalarAsync();
            return r as string ?? TammyModes.Assisted;
        }

        public async Task SetActualStatusAsync(string status, string region, string position)
        {
            await using var conn = await _dataSource.OpenConnectionAsync();
            await using var cmd = new NpgsqlCommand(
                @"UPDATE tammy_settings SET actual_status=@s, current_region=@r, current_position=@p,
                     last_connected_at = CASE WHEN @s='online' THEN now() ELSE last_connected_at END,
                     last_disconnected_at = CASE WHEN @s<>'online' THEN now() ELSE last_disconnected_at END,
                     updated_at=now() WHERE id='default'", conn);
            cmd.Parameters.AddWithValue("s", status);
            cmd.Parameters.AddWithValue("r", (object)region ?? "");
            cmd.Parameters.AddWithValue("p", (object)position ?? "");
            await cmd.ExecuteNonQueryAsync();
        }

        public async Task SetModeAsync(string mode)
        {
            await using var conn = await _dataSource.OpenConnectionAsync();
            await using var cmd = new NpgsqlCommand(
                "UPDATE tammy_settings SET mode=@m, updated_at=now() WHERE id='default'", conn);
            cmd.Parameters.AddWithValue("m", mode);
            await cmd.ExecuteNonQueryAsync();
        }

        /* ───────── Command queue ───────── */

        public async Task<List<TammyCommand>> ClaimPendingCommandsAsync(int limit = 5)
        {
            var list = new List<TammyCommand>();
            await using var conn = await _dataSource.OpenConnectionAsync();
            // Atomically claim pending rows so two workers never double-process.
            await using var cmd = new NpgsqlCommand(
                @"UPDATE tammy_commands SET status='processing'
                   WHERE id IN (
                     SELECT id FROM tammy_commands WHERE status='pending'
                     ORDER BY created_at ASC LIMIT @lim FOR UPDATE SKIP LOCKED)
                  RETURNING id, command_type, payload, requested_by, status", conn);
            cmd.Parameters.AddWithValue("lim", limit);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var payloadText = reader.IsDBNull(2) ? "{}" : reader.GetString(2);
                JsonElement payload;
                try { payload = JsonDocument.Parse(payloadText).RootElement.Clone(); }
                catch { payload = JsonDocument.Parse("{}").RootElement.Clone(); }
                list.Add(new TammyCommand
                {
                    Id = reader.GetInt64(0),
                    CommandType = reader.GetString(1),
                    Payload = payload,
                    RequestedBy = reader.IsDBNull(3) ? "" : reader.GetString(3),
                    Status = reader.GetString(4),
                });
            }
            return list;
        }

        public async Task CompleteCommandAsync(long id, bool ok, string resultJson, string error)
        {
            await using var conn = await _dataSource.OpenConnectionAsync();
            await using var cmd = new NpgsqlCommand(
                @"UPDATE tammy_commands SET status=@st, result=@res::jsonb, error_message=@err, processed_at=now()
                  WHERE id=@id", conn);
            cmd.Parameters.AddWithValue("st", ok ? "completed" : "error");
            cmd.Parameters.AddWithValue("res", (object)(resultJson ?? "{}"));
            cmd.Parameters.AddWithValue("err", (object)error ?? DBNull.Value);
            cmd.Parameters.AddWithValue("id", id);
            await cmd.ExecuteNonQueryAsync();
        }

        /* ───────── Conversations + messages ───────── */

        public async Task<long> FindOrCreateConversationAsync(string avatarUuid, string avatarName, string channelType)
        {
            await using var conn = await _dataSource.OpenConnectionAsync();
            await using (var find = new NpgsqlCommand(
                @"SELECT id FROM tammy_conversations
                   WHERE avatar_uuid=@u AND status='open' ORDER BY started_at DESC LIMIT 1", conn))
            {
                find.Parameters.AddWithValue("u", avatarUuid);
                var existing = await find.ExecuteScalarAsync();
                if (existing is long id) return id;
            }
            await using var ins = new NpgsqlCommand(
                @"INSERT INTO tammy_conversations (avatar_uuid, avatar_name, channel_type, status, started_at, last_message_at)
                  VALUES (@u, @n, @c, 'open', now(), now()) RETURNING id", conn);
            ins.Parameters.AddWithValue("u", avatarUuid);
            ins.Parameters.AddWithValue("n", (object)avatarName ?? "");
            ins.Parameters.AddWithValue("c", channelType);
            return (long)(await ins.ExecuteScalarAsync());
        }

        public async Task LogMessageAsync(long conversationId, string direction, string messageType,
            string text, string region, string position)
        {
            await using var conn = await _dataSource.OpenConnectionAsync();
            await using var cmd = new NpgsqlCommand(
                @"INSERT INTO tammy_messages (conversation_id, direction, message_type, message_text, region, position, created_at)
                  VALUES (@cid, @d, @mt, @txt, @r, @p, now());
                  UPDATE tammy_conversations SET last_message_at=now() WHERE id=@cid;", conn);
            cmd.Parameters.AddWithValue("cid", conversationId);
            cmd.Parameters.AddWithValue("d", direction);
            cmd.Parameters.AddWithValue("mt", messageType);
            cmd.Parameters.AddWithValue("txt", (object)text ?? "");
            cmd.Parameters.AddWithValue("r", (object)region ?? "");
            cmd.Parameters.AddWithValue("p", (object)position ?? "");
            await cmd.ExecuteNonQueryAsync();
        }

        public async Task<List<(string direction, string text)>> RecentMessagesAsync(long conversationId, int limit = 10)
        {
            var list = new List<(string, string)>();
            await using var conn = await _dataSource.OpenConnectionAsync();
            await using var cmd = new NpgsqlCommand(
                @"SELECT direction, message_text FROM tammy_messages
                   WHERE conversation_id=@cid ORDER BY created_at DESC LIMIT @lim", conn);
            cmd.Parameters.AddWithValue("cid", conversationId);
            cmd.Parameters.AddWithValue("lim", limit);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                list.Add((reader.GetString(0), reader.IsDBNull(1) ? "" : reader.GetString(1)));
            list.Reverse();
            return list;
        }

        /* ───────── Guest greeting cooldown ───────── */

        public async Task<bool> TryTriggerCooldownAsync(string avatarUuid, string type, TimeSpan window)
        {
            await using var conn = await _dataSource.OpenConnectionAsync();
            await using var cmd = new NpgsqlCommand(
                @"INSERT INTO tammy_guest_cooldowns (avatar_uuid, cooldown_type, last_triggered_at, expires_at)
                  VALUES (@u, @t, now(), now() + @win)
                  ON CONFLICT (avatar_uuid, cooldown_type) DO UPDATE
                    SET last_triggered_at=now(), expires_at=now() + @win
                    WHERE tammy_guest_cooldowns.expires_at < now()
                  RETURNING avatar_uuid", conn);
            cmd.Parameters.AddWithValue("u", avatarUuid);
            cmd.Parameters.AddWithValue("t", type);
            cmd.Parameters.AddWithValue("win", window);
            var r = await cmd.ExecuteScalarAsync();
            return r != null; // non-null => we (re)triggered; null => still cooling down
        }

        /* ───────── Action requests (approval tier) ───────── */

        public async Task CreateActionRequestAsync(long conversationId, string actionType, string payloadJson, string riskLevel)
        {
            await using var conn = await _dataSource.OpenConnectionAsync();
            await using var cmd = new NpgsqlCommand(
                @"INSERT INTO tammy_action_requests
                    (conversation_id, action_type, action_payload, risk_level, approval_status, execution_status, created_at)
                  VALUES (@cid, @at, @pl::jsonb, @rl, 'pending', 'pending', now())", conn);
            cmd.Parameters.AddWithValue("cid", conversationId);
            cmd.Parameters.AddWithValue("at", actionType);
            cmd.Parameters.AddWithValue("pl", (object)(payloadJson ?? "{}"));
            cmd.Parameters.AddWithValue("rl", riskLevel);
            await cmd.ExecuteNonQueryAsync();
        }

        public ValueTask DisposeAsync() => _dataSource.DisposeAsync();

        // Relational schema shared with the main bot (see db.js). CREATE ... IF NOT EXISTS is idempotent.
        private const string Schema = @"
CREATE TABLE IF NOT EXISTS tammy_settings (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'assisted',
  desired_status TEXT NOT NULL DEFAULT 'online',
  actual_status TEXT NOT NULL DEFAULT 'offline',
  current_region TEXT,
  current_position TEXT,
  last_connected_at TIMESTAMPTZ,
  last_disconnected_at TIMESTAMPTZ,
  manual_controller_discord_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tammy_commands (
  id BIGSERIAL PRIMARY KEY,
  command_type TEXT NOT NULL,
  payload JSONB,
  requested_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tammy_commands_status ON tammy_commands (status, created_at);
CREATE TABLE IF NOT EXISTS tammy_conversations (
  id BIGSERIAL PRIMARY KEY,
  avatar_uuid TEXT NOT NULL,
  avatar_name TEXT,
  channel_type TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  conversation_summary TEXT,
  assigned_staff_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tammy_conv_avatar ON tammy_conversations (avatar_uuid, status);
CREATE TABLE IF NOT EXISTS tammy_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT,
  direction TEXT NOT NULL,
  message_type TEXT,
  message_text TEXT,
  region TEXT,
  position TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tammy_msg_conv ON tammy_messages (conversation_id, created_at);
CREATE TABLE IF NOT EXISTS tammy_action_requests (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT,
  action_type TEXT NOT NULL,
  action_payload JSONB,
  risk_level TEXT,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  execution_status TEXT NOT NULL DEFAULT 'pending',
  execution_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS tammy_waypoints (
  id BIGSERIAL PRIMARY KEY,
  waypoint_name TEXT NOT NULL,
  region_name TEXT,
  position_x DOUBLE PRECISION,
  position_y DOUBLE PRECISION,
  position_z DOUBLE PRECISION,
  rotation TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS tammy_guest_cooldowns (
  avatar_uuid TEXT NOT NULL,
  cooldown_type TEXT NOT NULL,
  last_triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (avatar_uuid, cooldown_type)
);
";
    }
}
