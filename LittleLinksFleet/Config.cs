namespace LittleLinksFleet
{
    /// <summary>
    /// Every knob the fleet has, resolved once at startup.
    ///
    /// The split between DATABASE_URL and LITTLELINKS_API_URL is deliberate
    /// and is the core of the credential design: the API can seal a Second
    /// Life password but can never open one, so the fleet cannot ask the API
    /// for credentials — it reads the sealed rows itself and unwraps them
    /// with a private key the API has never seen. Everything else (claiming,
    /// status, commands, inventory) goes over HTTP, because none of it is
    /// secret and HTTP gives us one place to change the rules.
    /// </summary>
    public sealed class FleetConfig
    {
        public string DatabaseUrl { get; private set; }
        public string ApiBaseUrl { get; private set; }
        public string FleetSecret { get; private set; }
        public string PrivateKeyPem { get; private set; }

        /// <summary>Identifies this worker in littlelinks_bots.claimed_by.</summary>
        public string WorkerId { get; private set; }

        /// <summary>How many avatars this worker will drive at once.</summary>
        public int Capacity { get; private set; }

        /// <summary>Inventory item name the worker wears to give a baby its HUD.</summary>
        public string HudItemName { get; private set; }

        public string DefaultStartLocation { get; private set; }
        public int HealthPort { get; private set; }

        public TimeSpan ClaimInterval { get; private set; }
        public TimeSpan HeartbeatInterval { get; private set; }
        public TimeSpan CommandPollInterval { get; private set; }
        public TimeSpan InventorySyncInterval { get; private set; }

        private static string Env(string name, string fallback = "")
        {
            var v = Environment.GetEnvironmentVariable(name);
            return string.IsNullOrWhiteSpace(v) ? fallback : v.Trim();
        }

        private static int EnvInt(string name, int fallback)
            => int.TryParse(Env(name), out var v) ? v : fallback;

        private static TimeSpan EnvSeconds(string name, int fallbackSeconds)
            => TimeSpan.FromSeconds(Math.Max(1, EnvInt(name, fallbackSeconds)));

        /// <summary>
        /// Reads the environment and validates it. Throws with a specific
        /// message on anything missing — a fleet that starts with a bad
        /// config and fails later looks like a Second Life outage, and
        /// that is an expensive hour to spend during a launch.
        /// </summary>
        public static FleetConfig Load()
        {
            var cfg = new FleetConfig
            {
                DatabaseUrl   = Env("DATABASE_URL"),
                ApiBaseUrl    = Env("LITTLELINKS_API_URL").TrimEnd('/'),
                FleetSecret   = Env("LITTLELINKS_FLEET_SECRET"),
                PrivateKeyPem = ResolvePrivateKey(),
                WorkerId      = Env("FLEET_WORKER_ID", $"{Environment.MachineName}-{Environment.ProcessId}"),
                Capacity      = Math.Clamp(EnvInt("FLEET_CAPACITY", 10), 1, 50),
                HudItemName   = Env("LITTLELINKS_HUD_ITEM", "Lifeline RP Hybrid HUD"),
                DefaultStartLocation = Env("LITTLELINKS_START_LOCATION", "last"),
                HealthPort    = EnvInt("PORT", 3010),

                ClaimInterval         = EnvSeconds("FLEET_CLAIM_SECONDS", 20),
                HeartbeatInterval     = EnvSeconds("FLEET_HEARTBEAT_SECONDS", 45),
                CommandPollInterval   = EnvSeconds("FLEET_COMMAND_SECONDS", 3),
                InventorySyncInterval = EnvSeconds("FLEET_INVENTORY_SECONDS", 900),
            };

            var missing = new List<string>();
            if (string.IsNullOrWhiteSpace(cfg.DatabaseUrl))   missing.Add("DATABASE_URL");
            if (string.IsNullOrWhiteSpace(cfg.ApiBaseUrl))    missing.Add("LITTLELINKS_API_URL");
            if (string.IsNullOrWhiteSpace(cfg.FleetSecret))   missing.Add("LITTLELINKS_FLEET_SECRET");
            if (string.IsNullOrWhiteSpace(cfg.PrivateKeyPem))
                missing.Add("LITTLELINKS_FLEET_PRIVATE_KEY (or LITTLELINKS_FLEET_PRIVATE_KEY_FILE)");

            if (missing.Count > 0)
                throw new InvalidOperationException("Missing required configuration: " + string.Join(", ", missing));

            return cfg;
        }

        /// <summary>
        /// The private key may be given inline or, preferably, as a path to
        /// a 0600 file on the EC2 host. A file keeps the key out of the
        /// process environment, which is readable from /proc and gets
        /// scooped up by most crash reporters.
        /// </summary>
        private static string ResolvePrivateKey()
        {
            var path = Env("LITTLELINKS_FLEET_PRIVATE_KEY_FILE");
            if (!string.IsNullOrWhiteSpace(path))
            {
                if (!File.Exists(path))
                    throw new InvalidOperationException($"LITTLELINKS_FLEET_PRIVATE_KEY_FILE points at '{path}', which does not exist.");
                return File.ReadAllText(path);
            }
            // Hosting dashboards mangle newlines in multi-line values.
            return Env("LITTLELINKS_FLEET_PRIVATE_KEY").Replace("\\n", "\n");
        }

        public void PrintSummary()
        {
            Console.WriteLine($"[cfg] worker={WorkerId} capacity={Capacity}");
            Console.WriteLine($"[cfg] api={ApiBaseUrl}");
            Console.WriteLine($"[cfg] hud item=\"{HudItemName}\" start={DefaultStartLocation}");
            Console.WriteLine($"[cfg] claim={ClaimInterval.TotalSeconds:0}s heartbeat={HeartbeatInterval.TotalSeconds:0}s "
                            + $"commands={CommandPollInterval.TotalSeconds:0}s inventory={InventorySyncInterval.TotalSeconds:0}s");
        }
    }
}
