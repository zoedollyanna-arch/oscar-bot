using System.Text.Json;
using TammyAgent.Models;

namespace TammyAgent.Services
{
    /// <summary>
    /// Polls the shared Neon tammy_commands queue (written by the main Discord bot's /tammy commands)
    /// and executes each command in Second Life. This is what powers manual takeover / assisted mode:
    /// staff type in Discord, a row lands here, Tammy performs it in-world and marks it completed.
    /// </summary>
    public sealed class CommandQueueService
    {
        private readonly DatabaseService _db;
        private readonly SecondLifeService _sl;

        public CommandQueueService(DatabaseService db, SecondLifeService sl)
        {
            _db = db; _sl = sl;
        }

        public async Task RunAsync(CancellationToken ct)
        {
            await _db.RequeueDisconnectedCommandsAsync();
            while (!ct.IsCancellationRequested)
            {
                if (!_sl.Connected)
                {
                    try { await Task.Delay(TimeSpan.FromSeconds(2), ct); }
                    catch (OperationCanceledException) { }
                    continue;
                }
                try
                {
                    var commands = await _db.ClaimPendingCommandsAsync(5);
                    foreach (var c in commands)
                        await DispatchAsync(c);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[queue] poll error: {ex.Message}");
                }
                try { await Task.Delay(TimeSpan.FromSeconds(3), ct); }
                catch (OperationCanceledException) { }
            }
        }

        private async Task DispatchAsync(TammyCommand c)
        {
            bool ok = false;
            string error = null;
            string result = "{}";
            try
            {
                switch (c.CommandType)
                {
                    case "send_im":
                    {
                        var uuid = c.PayloadString("avatar_uuid");
                        var message = c.PayloadString("message");
                        ok = _sl.SendIm(uuid, message);
                        if (ok)
                        {
                            var convId = await _db.FindOrCreateConversationAsync(uuid, "", "im");
                            await _db.LogMessageAsync(convId, "outgoing", "im", message, _sl.CurrentRegion, _sl.CurrentPosition);
                        }
                        else error = _sl.Connected ? "invalid_avatar_uuid" : "sl_disconnected";
                        break;
                    }
                    case "local_chat":
                    {
                        var message = c.PayloadString("message");
                        ok = _sl.SendLocalChat(message);
                        if (!ok) error = "sl_disconnected";
                        break;
                    }
                    case "set_mode":
                    {
                        var mode = c.PayloadString("mode");
                        if (string.IsNullOrWhiteSpace(mode)) { error = "mode_required"; break; }
                        await _db.SetModeAsync(mode);
                        _sl.Paused = mode == TammyModes.Manual;
                        ok = true;
                        break;
                    }
                    case "logout_for_manual_control":
                        await _db.SetModeAsync(TammyModes.Manual);
                        _sl.Paused = true;
                        ok = true;
                        break;
                    case "resume":
                        await _db.SetModeAsync(TammyModes.Assisted);
                        _sl.Paused = false;
                        ok = true;
                        break;
                    default:
                        error = $"unknown_command:{c.CommandType}";
                        break;
                }
            }
            catch (Exception ex)
            {
                error = ex.Message;
            }
            if (!ok && error == "sl_disconnected" && c.CommandType is "send_im" or "local_chat")
            {
                await _db.RequeueCommandAsync(c.Id, error);
                Console.WriteLine($"[queue] {c.CommandType} #{c.Id} requeued until SL reconnects");
                return;
            }
            await _db.CompleteCommandAsync(c.Id, ok, result, error);
            Console.WriteLine($"[queue] {c.CommandType} #{c.Id} -> {(ok ? "completed" : "error:" + error)}");
        }
    }
}
