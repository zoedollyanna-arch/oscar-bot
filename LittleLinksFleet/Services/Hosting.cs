using System.Net;
using System.Text;

namespace LittleLinksFleet.Services
{
    /// <summary>Loads a local .env for development. On EC2 the systemd unit supplies real env vars.</summary>
    public static class DotEnv
    {
        public static void Load()
        {
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
                if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
                    Environment.SetEnvironmentVariable(key, val);
            }
            Console.WriteLine($"[env] loaded {path}");
        }
    }

    /// <summary>
    /// Health endpoint for the load balancer and for "is the fleet up?"
    /// during an incident. Reports how many babies are actually online, not
    /// just whether the process is alive — a fleet with zero online bots and
    /// a healthy process is exactly the failure worth alerting on.
    /// </summary>
    public static class HealthServer
    {
        public static void Start(int port, Func<(int Live, int Online)> snapshot)
        {
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

                        var (live, online) = snapshot();
                        var body = Encoding.UTF8.GetBytes(
                            $"{{\"ok\":true,\"service\":\"littlelinks-fleet\",\"sessions\":{live},\"online\":{online}}}");
                        ctx.Response.ContentType = "application/json";
                        ctx.Response.StatusCode = 200;
                        try { await ctx.Response.OutputStream.WriteAsync(body); } catch { }
                        ctx.Response.Close();
                    }
                });
            }
            catch (Exception ex)
            {
                // A missing urlacl on Windows must not stop the fleet.
                Console.WriteLine($"[health] not started ({ex.Message}) — continuing without HTTP endpoint.");
            }
        }
    }
}
