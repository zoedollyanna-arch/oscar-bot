using System.Net.Http.Json;
using System.Text.Json;
using LittleLinksFleet.Models;

namespace LittleLinksFleet.Services
{
    /// <summary>
    /// Everything the fleet says to the Lifeline API. Credentials are the
    /// one thing that never comes through here — see CredentialStore.
    ///
    /// Every method swallows transport failures and returns an empty or
    /// false result rather than throwing. A worker driving twenty avatars
    /// must not drop them all because the API restarted for thirty seconds;
    /// the loops simply retry on their next tick.
    /// </summary>
    public sealed class ApiClient : IDisposable
    {
        private readonly HttpClient _http;
        private readonly string _base;

        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        public ApiClient(string baseUrl, string fleetSecret)
        {
            _base = baseUrl.TrimEnd('/');
            _http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
            _http.DefaultRequestHeaders.Add("x-fleet-secret", fleetSecret);
            _http.DefaultRequestHeaders.Add("user-agent", "LittleLinksFleet/1.0");
        }

        private string Url(string path) => $"{_base}/api/littlelinks{path}";

        /// <summary>Claim up to <paramref name="capacity"/> bots for this worker.</summary>
        public async Task<List<ClaimedBot>> ClaimAsync(string workerId, int capacity, CancellationToken ct)
        {
            var result = new List<ClaimedBot>();
            try
            {
                var res = await _http.PostAsJsonAsync(Url("/fleet/claim"),
                    new { worker_id = workerId, capacity }, Json, ct);

                if (!res.IsSuccessStatusCode)
                {
                    Console.Error.WriteLine($"[api] claim -> {(int)res.StatusCode} {res.ReasonPhrase}");
                    return result;
                }

                var doc = await res.Content.ReadFromJsonAsync<JsonElement>(Json, ct);
                if (!doc.TryGetProperty("claimed", out var claimed) || claimed.ValueKind != JsonValueKind.Array)
                    return result;

                foreach (var row in claimed.EnumerateArray())
                {
                    result.Add(new ClaimedBot
                    {
                        BotKey        = Str(row, "bot_key"),
                        OwnerKey      = Str(row, "owner_key"),
                        DisplayName   = Str(row, "display_name"),
                        Nickname      = Str(row, "nickname"),
                        StartLocation = Str(row, "start_location"),
                    });
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                Console.Error.WriteLine($"[api] claim failed: {ex.Message}");
            }
            return result;
        }

        /// <summary>Report what the worker actually achieved for a bot.</summary>
        public Task StatusAsync(string botKey, string status, string detail, string region,
                                string position, bool? hudAttached, string error, CancellationToken ct)
            => PostVoid($"/fleet/{botKey}/status", new
            {
                status,
                detail,
                region,
                position,
                hud_attached = hudAttached,
                error,
            }, ct);

        /// <summary>
        /// Keepalive. Returns the bot's desired_state so a shutdown request
        /// is noticed without a second round trip; null means the call
        /// failed and the caller should keep doing what it was doing.
        /// </summary>
        public async Task<string> HeartbeatAsync(string botKey, string region, string position, CancellationToken ct)
        {
            try
            {
                var res = await _http.PostAsJsonAsync(Url($"/fleet/{botKey}/heartbeat"),
                    new { region, position }, Json, ct);
                if (!res.IsSuccessStatusCode) return null;
                var doc = await res.Content.ReadFromJsonAsync<JsonElement>(Json, ct);
                return Str(doc, "desired_state");
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                Console.Error.WriteLine($"[api] heartbeat {botKey}: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Read a command id that may arrive as a JSON number or a JSON string.
        ///
        /// littlelinks_bot_commands.id is a bigint, and node-postgres returns
        /// bigint as a string to avoid losing precision -- so the API emits
        /// {"id": "4"}. JsonElement.TryGetInt64 *throws* on a String element
        /// rather than returning false, which killed the whole drain: the API
        /// had already marked the batch claimed, so every command the portal
        /// issued was silently accepted and never executed.
        /// </summary>
        private static long CommandId(JsonElement row)
        {
            if (!row.TryGetProperty("id", out var id)) return 0;
            return id.ValueKind switch
            {
                JsonValueKind.Number => id.TryGetInt64(out var n) ? n : 0,
                JsonValueKind.String => long.TryParse(id.GetString(), out var s) ? s : 0,
                _ => 0,
            };
        }

        /// <summary>Drain pending commands. The API marks them claimed as it returns them.</summary>
        public async Task<List<BotCommand>> CommandsAsync(string botKey, CancellationToken ct)
        {
            var result = new List<BotCommand>();
            try
            {
                var res = await _http.GetAsync(Url($"/fleet/{botKey}/commands"), ct);
                if (!res.IsSuccessStatusCode) return result;

                var doc = await res.Content.ReadFromJsonAsync<JsonElement>(Json, ct);
                if (!doc.TryGetProperty("commands", out var cmds) || cmds.ValueKind != JsonValueKind.Array)
                    return result;

                foreach (var row in cmds.EnumerateArray())
                {
                    result.Add(new BotCommand
                    {
                        Id = CommandId(row),
                        Command = Str(row, "command"),
                        // Clone: the JsonDocument backing this element is
                        // disposed when the response is, and the command is
                        // read later on the session's own loop.
                        Args = row.TryGetProperty("args", out var a) ? a.Clone() : default,
                    });
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                Console.Error.WriteLine($"[api] commands {botKey}: {ex.Message}");
            }
            return result;
        }

        public Task CommandResultAsync(long id, bool ok, string result, CancellationToken ct)
            => PostVoid($"/fleet/commands/{id}/result", new { ok, result }, ct);

        public Task InventoryAsync(string botKey, List<InventorySnapshotItem> items, CancellationToken ct)
            => PostVoid($"/fleet/{botKey}/inventory", new { items }, ct);

        private async Task PostVoid(string path, object body, CancellationToken ct)
        {
            try
            {
                var res = await _http.PostAsJsonAsync(Url(path), body, Json, ct);
                if (!res.IsSuccessStatusCode)
                    Console.Error.WriteLine($"[api] {path} -> {(int)res.StatusCode} {res.ReasonPhrase}");
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                Console.Error.WriteLine($"[api] {path}: {ex.Message}");
            }
        }

        private static string Str(JsonElement el, string name)
            => el.ValueKind == JsonValueKind.Object
               && el.TryGetProperty(name, out var v)
               && v.ValueKind == JsonValueKind.String
                ? v.GetString() ?? "" : "";

        public void Dispose() => _http.Dispose();
    }
}
