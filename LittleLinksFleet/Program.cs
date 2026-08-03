using LittleLinksFleet.Services;

namespace LittleLinksFleet
{
    /// <summary>
    /// LittleLinks bot fleet — the process that makes a baby alt log itself in.
    ///
    /// A parent subscribes, links a baby avatar's login in the portal, and
    /// switches it on. This worker claims that bot, opens the sealed
    /// credential with its private key, logs the avatar into Second Life,
    /// wears the Lifeline HUD so the baby has real stats, and then does
    /// whatever the parent's portal, ZPhone or HUD asks of it.
    ///
    /// Runs as a systemd service on the EC2 host. Scale out by starting a
    /// second copy with a different FLEET_WORKER_ID — bot ownership is
    /// arbitrated by the API's claim query, so nothing needs configuring.
    ///
    /// Nothing secret is committed: every credential comes from the database
    /// and is opened with a key that exists only on this host.
    /// </summary>
    internal static class Program
    {
        private static async Task<int> Main()
        {
            Console.WriteLine("🍼 LittleLinks fleet starting...");
            DotEnv.Load();

            FleetConfig cfg;
            try
            {
                cfg = FleetConfig.Load();
                cfg.PrintSummary();
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Startup error: {ex.Message}");
                return 1;
            }

            CredentialStore creds;
            try
            {
                creds = new CredentialStore(cfg.DatabaseUrl, cfg.PrivateKeyPem);
                Console.WriteLine("[cred] fleet private key loaded");
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Credential store failed: {ex.Message}");
                return 1;
            }

            using var api = new ApiClient(cfg.ApiBaseUrl, cfg.FleetSecret);
            await using var supervisor = new FleetSupervisor(cfg, api, creds);

            using var shutdown = new CancellationTokenSource();
            Console.CancelKeyPress += (_, e) => { e.Cancel = true; shutdown.Cancel(); };
            AppDomain.CurrentDomain.ProcessExit += (_, _) => shutdown.Cancel();

            HealthServer.Start(cfg.HealthPort, () => (supervisor.LiveCount, supervisor.OnlineCount));

            try
            {
                await supervisor.RunAsync(shutdown.Token);
            }
            catch (OperationCanceledException) { /* normal shutdown */ }
            finally
            {
                await creds.DisposeAsync();
            }

            Console.WriteLine("🌙 LittleLinks fleet stopped.");
            return 0;
        }
    }
}
