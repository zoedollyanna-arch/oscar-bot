using LittleLinksFleet.Models;

namespace LittleLinksFleet.Services
{
    /// <summary>
    /// Owns the set of live BotSessions.
    ///
    /// The claim loop is deliberately the only thing that creates sessions.
    /// The API's conditional UPDATE decides who owns a bot, so if this
    /// worker stops heartbeating, another worker picks the baby up after
    /// three minutes and this one simply stops being handed it. That means
    /// scaling out is adding a second process with a different
    /// FLEET_WORKER_ID — there is no coordination to configure.
    /// </summary>
    public sealed class FleetSupervisor : IAsyncDisposable
    {
        private readonly FleetConfig _cfg;
        private readonly ApiClient _api;
        private readonly CredentialStore _creds;
        private readonly Dictionary<string, BotSession> _sessions = new();
        private readonly SemaphoreSlim _lock = new(1, 1);

        public FleetSupervisor(FleetConfig cfg, ApiClient api, CredentialStore creds)
        {
            _cfg = cfg;
            _api = api;
            _creds = creds;
        }

        public int LiveCount { get { lock (_sessions) return _sessions.Count; } }
        public int OnlineCount { get { lock (_sessions) return _sessions.Values.Count(s => s.Online); } }

        public async Task RunAsync(CancellationToken ct)
        {
            Console.WriteLine($"[fleet] worker {_cfg.WorkerId} up, capacity {_cfg.Capacity}");

            while (!ct.IsCancellationRequested)
            {
                try
                {
                    await ReapFinishedAsync();

                    var free = _cfg.Capacity - LiveCount;
                    if (free > 0)
                    {
                        var claimed = await _api.ClaimAsync(_cfg.WorkerId, free, ct);
                        foreach (var bot in claimed) await StartIfNewAsync(bot, ct);
                    }
                }
                catch (OperationCanceledException) { break; }
                catch (Exception ex)
                {
                    // The claim loop must never die. A crash here means
                    // every baby goes dark the next time one disconnects.
                    Console.Error.WriteLine($"[fleet] claim cycle error: {ex}");
                }

                try { await Task.Delay(_cfg.ClaimInterval, ct); }
                catch (OperationCanceledException) { break; }
            }

            await ShutdownAllAsync();
        }

        private async Task StartIfNewAsync(ClaimedBot bot, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(bot.BotKey)) return;

            await _lock.WaitAsync(ct);
            try
            {
                // The API re-hands us bots we already hold — that is how a
                // claim is renewed — so re-claiming an existing session is
                // normal and must not start a second login for one avatar.
                if (_sessions.ContainsKey(bot.BotKey)) return;

                var session = new BotSession(bot, _cfg, _api, _creds, ct);
                lock (_sessions) _sessions[bot.BotKey] = session;
                session.Start();
                Console.WriteLine($"[fleet] took on {bot.Label} ({bot.BotKey}) — {LiveCount}/{_cfg.Capacity} slots used");
            }
            finally { _lock.Release(); }
        }

        /// <summary>Drop sessions that logged out at the parent's request.</summary>
        private async Task ReapFinishedAsync()
        {
            List<KeyValuePair<string, BotSession>> done;
            lock (_sessions) done = _sessions.Where(kv => kv.Value.Finished).ToList();

            foreach (var (key, session) in done)
            {
                Console.WriteLine($"[fleet] releasing {session.Label}");
                await session.DisposeAsync();
                lock (_sessions) _sessions.Remove(key);
            }
        }

        private async Task ShutdownAllAsync()
        {
            List<BotSession> all;
            lock (_sessions) { all = _sessions.Values.ToList(); _sessions.Clear(); }

            Console.WriteLine($"[fleet] shutting down {all.Count} session(s)");
            // In parallel: twenty sequential 20-second logout waits would
            // blow past any sane systemd TimeoutStopSec and get SIGKILLed,
            // which leaves the avatars looking online until the grid times
            // them out.
            await Task.WhenAll(all.Select(s => s.DisposeAsync().AsTask()));
        }

        public async ValueTask DisposeAsync()
        {
            await ShutdownAllAsync();
            _lock.Dispose();
        }
    }
}
