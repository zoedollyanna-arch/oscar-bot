using System.Net;
using System.Text;

namespace TammyAgent.Services
{
    /// <summary>Loads a local .env file for development. On Render, real env vars are used instead.</summary>
    public static class DotEnv
    {
        public static void Load()
        {
            // Walk up from the executable and the current directory looking for a .env file.
            foreach (var start in new[] { AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
            {
                var dir = new DirectoryInfo(start);
                while (dir != null)
                {
                    var candidate = Path.Combine(dir.FullName, ".env");
                    if (File.Exists(candidate)) { Apply(candidate); return; }
                    dir = dir.Parent;
                }
            }
        }

        private static void Apply(string path)
        {
            foreach (var raw in File.ReadAllLines(path))
            {
                var line = raw.Trim();
                if (line.Length == 0 || line.StartsWith("#")) continue;
                var eq = line.IndexOf('=');
                if (eq <= 0) continue;
                var key = line.Substring(0, eq).Trim();
                var val = line.Substring(eq + 1).Trim();
                if ((val.StartsWith("\"") && val.EndsWith("\"")) || (val.StartsWith("'") && val.EndsWith("'")))
                    val = val.Substring(1, val.Length - 2);
                // Don't override anything already set in the real environment.
                if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
                    Environment.SetEnvironmentVariable(key, val);
            }
            Console.WriteLine($"[env] loaded {path}");
        }
    }

    /// <summary>
    /// Minimal HTTP health endpoint so Tammy can run as a Render Web Service (which health-checks a
    /// bound port). Optional and best-effort — if the port can't be bound (e.g. local Windows without
    /// urlacl) it just logs and the agent keeps running.
    /// </summary>
    public static class HealthServer
    {
        public static void Start(Func<bool> isOnline)
        {
            var port = Environment.GetEnvironmentVariable("PORT");
            if (string.IsNullOrWhiteSpace(port)) port = "3000";
            try
            {
                var listener = new HttpListener();
                listener.Prefixes.Add($"http://+:{port}/");
                listener.Start();
                Console.WriteLine($"[health] listening on :{port}");
                _ = Task.Run(async () =>
                {
                    while (listener.IsListening)
                    {
                        HttpListenerContext ctx;
                        try { ctx = await listener.GetContextAsync(); }
                        catch { break; }
                        var body = Encoding.UTF8.GetBytes($"{{\"ok\":true,\"bot\":\"tammy\",\"online\":{(isOnline() ? "true" : "false")}}}");
                        ctx.Response.ContentType = "application/json";
                        ctx.Response.StatusCode = 200;
                        try { await ctx.Response.OutputStream.WriteAsync(body); } catch { }
                        ctx.Response.Close();
                    }
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[health] not started ({ex.Message}) — continuing without HTTP endpoint.");
            }
        }
    }
}
