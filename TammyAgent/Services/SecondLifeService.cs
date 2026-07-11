using LibreMetaverse;
using TammyAgent.Models;

namespace TammyAgent.Services
{
    /// <summary>
    /// Wraps the LibreMetaverse GridClient: logs Tammy into Second Life, listens for IMs and local
    /// chat, exposes send methods, and reconnects with backoff. Raises OnMessage for every resident
    /// message so higher layers (conversation logging + brain) can react.
    /// </summary>
    public sealed class SecondLifeService
    {
        private readonly string _first, _last, _password, _startLocation;
        private GridClient _client;
        private volatile bool _connected;
        private int _failedLogins;

        // When true (manual-takeover mode), Tammy logs out and does NOT reconnect until released,
        // so you can drive her account from Firestorm without two clients fighting.
        public volatile bool Paused;

        public event Action<IncomingMessage> OnMessage;
        public event Action<bool> OnConnectionChanged; // true=connected, false=disconnected
        public event Action<int> OnRepeatedLoginFailure; // failure count, for Discord notify

        public bool Connected => _connected && _client is { Network.Connected: true };
        public string CurrentRegion => _client?.Network?.CurrentSim?.Name ?? "";
        public string CurrentPosition
        {
            get
            {
                if (_client?.Self == null) return "";
                var p = _client.Self.SimPosition;
                return $"{p.X:0},{p.Y:0},{p.Z:0}";
            }
        }

        public SecondLifeService(string first, string last, string password, string startLocation)
        {
            _first = first; _last = last; _password = password;
            _startLocation = string.IsNullOrWhiteSpace(startLocation)
                ? "Ethereal Paradise/85/129/35"
                : startLocation;
        }

        private void Wire()
        {
            _client = new GridClient();
            _client.Self.IM += Self_IM;
            _client.Self.ChatFromSimulator += Self_Chat;
            _client.Network.Disconnected += (_, e) =>
            {
                _connected = false;
                Console.WriteLine($"[SL] Disconnected: {e.Reason} - {e.Message}");
                OnConnectionChanged?.Invoke(false);
            };
        }

        /// <summary>Supervisor loop: log in, and on disconnect wait + retry with backoff.</summary>
        public async Task RunAsync(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested)
            {
                if (Paused)
                {
                    if (_client?.Network?.Connected == true)
                    {
                        Console.WriteLine("[SL] Manual-takeover: logging out for viewer control.");
                        _client.Network.Logout();
                        _connected = false;
                        OnConnectionChanged?.Invoke(false);
                    }
                    await SafeDelay(5, ct);
                    continue;
                }
                if (!Connected)
                {
                    var ok = await TryLoginAsync(ct);
                    if (!ok)
                    {
                        _failedLogins++;
                        var wait = _failedLogins <= 1 ? 10 : 30;
                        if (_failedLogins >= 3) OnRepeatedLoginFailure?.Invoke(_failedLogins);
                        Console.WriteLine($"[SL] Login failed ({_failedLogins}). Retrying in {wait}s.");
                        await SafeDelay(wait, ct);
                        continue;
                    }
                    _failedLogins = 0;
                }
                // Connected — poll gently; the SDK raises events on its own threads.
                await SafeDelay(5, ct);
            }
            if (_client?.Network?.Connected == true) _client.Network.Logout();
        }

        private async Task<bool> TryLoginAsync(CancellationToken ct)
        {
            Wire();
            var lp = _client.Network.DefaultLoginParams(_first, _last, _password, "Lifeline Tammy", "0.1.0");
            lp.Start = ResolveStart(_startLocation);
            Console.WriteLine($"[SL] Logging in as {_first} {_last} -> {_startLocation} ...");
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(45));
            try
            {
                var success = await _client.Network.LoginAsync(lp, timeout.Token);
                if (!success)
                {
                    Console.WriteLine($"[SL] Login rejected: {_client.Network.LoginMessage}");
                    return false;
                }
                _connected = true;
                Console.WriteLine($"[SL] Logged in to {CurrentRegion} at {CurrentPosition}");
                OnConnectionChanged?.Invoke(true);
                return true;
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                Console.WriteLine("[SL] Login timed out.");
                return false;
            }
        }

        // Accept last/home, a region, region/x/y/z, or a maps.secondlife.com URL.
        private static string ResolveStart(string loc)
        {
            var l = loc.Trim();
            if (l.Equals("last", StringComparison.OrdinalIgnoreCase) ||
                l.Equals("home", StringComparison.OrdinalIgnoreCase))
                return l.ToLowerInvariant();
            if (Uri.TryCreate(l, UriKind.Absolute, out var url) &&
                url.Host.Equals("maps.secondlife.com", StringComparison.OrdinalIgnoreCase))
                l = Uri.UnescapeDataString(url.AbsolutePath).Trim('/').Replace("secondlife/", "", StringComparison.OrdinalIgnoreCase);

            var parts = l.Split('/', StringSplitOptions.RemoveEmptyEntries);
            var region = parts.Length > 0 ? parts[0] : l;
            var x = parts.Length > 1 && int.TryParse(parts[1], out var px) ? px : 128;
            var y = parts.Length > 2 && int.TryParse(parts[2], out var py) ? py : 128;
            var z = parts.Length > 3 && int.TryParse(parts[3], out var pz) ? pz : 30;
            return $"uri:{region}&{x}&{y}&{z}";
        }

        /* ───────── Send ───────── */

        public bool SendIm(string avatarUuid, string message)
        {
            if (!Connected || !UUID.TryParse(avatarUuid, out var target)) return false;
            _client.Self.InstantMessage(target, message);
            return true;
        }

        public bool SendLocalChat(string message)
        {
            if (!Connected) return false;
            _client.Self.Chat(message, 0, ChatType.Normal);
            return true;
        }

        /* ───────── Receive ───────── */

        private void Self_IM(object sender, InstantMessageEventArgs e)
        {
            if (_client == null || e.IM.FromAgentID == _client.Self.AgentID) return;
            // Only real agent-to-agent messages; ignore typing/notices/object IMs.
            if (e.IM.Dialog != InstantMessageDialog.MessageFromAgent) return;
            OnMessage?.Invoke(new IncomingMessage
            {
                AvatarUuid = e.IM.FromAgentID.ToString(),
                AvatarName = e.IM.FromAgentName,
                ChannelType = "im",
                Text = e.IM.Message,
                Region = CurrentRegion,
                Position = CurrentPosition,
            });
        }

        private void Self_Chat(object sender, ChatEventArgs e)
        {
            if (_client == null || e.SourceID == _client.Self.AgentID) return;
            if (string.IsNullOrWhiteSpace(e.Message)) return;
            if (e.SourceType != ChatSourceType.Agent) return; // ignore objects
            OnMessage?.Invoke(new IncomingMessage
            {
                AvatarUuid = e.SourceID.ToString(),
                AvatarName = e.FromName,
                ChannelType = "local",
                Text = e.Message,
                Region = CurrentRegion,
                Position = CurrentPosition,
            });
        }

        private static async Task SafeDelay(int seconds, CancellationToken ct)
        {
            try { await Task.Delay(TimeSpan.FromSeconds(seconds), ct); }
            catch (OperationCanceledException) { }
        }
    }
}
