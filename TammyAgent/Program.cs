using TammyAgent.Models;
using TammyAgent.Services;

namespace TammyAgent
{
    /// <summary>
    /// Tammy Brightwood — Second Life staff agent (LibreMetaverse worker).
    ///
    /// Logs into Second Life as Tammy, listens for resident IMs / local chat, logs every conversation
    /// to the shared Neon database (the same one the main Lifeline Discord bot uses), and executes
    /// commands the Discord bot queues (send_im, local_chat, mode changes). In automated mode an
    /// optional OpenAI brain answers residents, with a strict auto / approval / human action policy.
    ///
    /// Deployed as a Render Background Worker (see Dockerfile). All credentials come from environment
    /// variables — nothing secret is ever committed.
    /// </summary>
    internal static class Program
    {
        private static string RequiredEnv(string name)
        {
            var v = Environment.GetEnvironmentVariable(name);
            if (string.IsNullOrWhiteSpace(v))
                throw new InvalidOperationException($"Required environment variable '{name}' is missing.");
            return v;
        }
        private static string OptionalEnv(string name) => Environment.GetEnvironmentVariable(name) ?? "";

        private static async Task<int> Main(string[] args)
        {
            Console.WriteLine("🌺 Tammy Brightwood agent starting...");

            string firstName, lastName, password, databaseUrl;
            try
            {
                firstName = RequiredEnv("SL_FIRST_NAME");
                lastName = RequiredEnv("SL_LAST_NAME");
                password = RequiredEnv("SL_PASSWORD");
                databaseUrl = RequiredEnv("DATABASE_URL");
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Startup error: {ex.Message}");
                return 1;
            }

            var startLocation = OptionalEnv("SL_START_LOCATION");
            var backendUrl = OptionalEnv("LIFELINE_API_URL");
            var backendSecret = OptionalEnv("LIFELINE_API_SECRET");
            var openAiKey = OptionalEnv("OPENAI_API_KEY");
            var openAiModel = OptionalEnv("OPENAI_MODEL");
            var initialMode = OptionalEnv("TAMMY_MODE");

            // Services
            await using var db = new DatabaseService(databaseUrl);
            try
            {
                await db.EnsureSchemaAsync();
                if (!string.IsNullOrWhiteSpace(initialMode)) await db.SetModeAsync(initialMode);
                Console.WriteLine("✅ Neon schema ready.");
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Database init failed: {ex.Message}");
                return 1;
            }

            var backend = new LifelineBackendService(backendUrl, backendSecret);
            var brain = new TammyBrainService(openAiKey, openAiModel);
            var sl = new SecondLifeService(firstName, lastName, password, startLocation);
            var conversations = new ConversationService(db, sl, backend, brain);
            var queue = new CommandQueueService(db, sl);

            Console.WriteLine($"   backend: {(backend.Configured ? "configured" : "not set")} | " +
                              $"brain: {(brain.Configured ? "on" : "off (assisted only)")}");

            // Wire SL events → conversation handling + status tracking.
            sl.OnMessage += (msg) => _ = conversations.HandleIncomingAsync(msg);
            sl.OnConnectionChanged += (connected) =>
                _ = db.SetActualStatusAsync(connected ? "online" : "offline", sl.CurrentRegion, sl.CurrentPosition);
            sl.OnRepeatedLoginFailure += (count) =>
                Console.Error.WriteLine($"⚠️ Tammy has failed to log in {count} times — check credentials / grid status.");

            // Long-running: stay online until shut down (Render/Docker sends SIGTERM).
            using var shutdown = new CancellationTokenSource();
            Console.CancelKeyPress += (_, e) => { e.Cancel = true; shutdown.Cancel(); };
            AppDomain.CurrentDomain.ProcessExit += (_, _) => shutdown.Cancel();

            var slTask = sl.RunAsync(shutdown.Token);
            var queueTask = queue.RunAsync(shutdown.Token);

            try
            {
                await Task.WhenAll(slTask, queueTask);
            }
            catch (OperationCanceledException) { /* normal shutdown */ }

            Console.WriteLine("🌙 Tammy agent shut down.");
            return 0;
        }
    }
}
