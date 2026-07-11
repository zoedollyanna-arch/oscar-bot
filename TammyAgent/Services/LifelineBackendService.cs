using System.Text.Json;
using TammyAgent.Models;

namespace TammyAgent.Services
{
    /// <summary>
    /// Reads guest context from the Lifeline backend (the Render/Supabase API) over HTTP. This is the
    /// single controlled entry point for resident data — Tammy never queries random tables directly.
    /// Implements get_tammy_guest_context(avatar_uuid).
    /// </summary>
    public sealed class LifelineBackendService
    {
        private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(8) };
        private readonly string _baseUrl;
        private readonly string _secret;

        public LifelineBackendService(string baseUrl, string secret)
        {
            _baseUrl = (baseUrl ?? "").TrimEnd('/');
            _secret = secret ?? "";
        }

        public bool Configured => !string.IsNullOrEmpty(_baseUrl);

        public async Task<GuestProfile> GetGuestContextAsync(string avatarUuid)
        {
            var profile = new GuestProfile { AvatarUuid = avatarUuid };
            if (!Configured) return profile;

            try
            {
                var req = new HttpRequestMessage(HttpMethod.Get,
                    $"{_baseUrl}/api/tammy/guest-context?avatar_uuid={Uri.EscapeDataString(avatarUuid)}");
                if (!string.IsNullOrEmpty(_secret)) req.Headers.Add("x-tammy-secret", _secret);

                var res = await _http.SendAsync(req);
                var body = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode) return profile;

                profile.RawJson = body;
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;
                // Backend may wrap the context under "context" or return it at the root.
                var ctx = root.TryGetProperty("context", out var c) ? c : root;

                profile.AvatarName = Str(ctx, "avatar_name");
                profile.LifelinePlayer = Bool(ctx, "lifeline_player");
                profile.Role = Str(ctx, "role");
                profile.SystemVersion = Str(ctx, "system_version");
                profile.WelcomePackageSent = Bool(ctx, "welcome_package_sent");
                profile.Staff = Bool(ctx, "staff");
                profile.Blogger = Bool(ctx, "blogger");
                profile.Vip = Bool(ctx, "vip");
                if (ctx.TryGetProperty("booking", out var b) && b.ValueKind == JsonValueKind.Object)
                {
                    profile.BookingActive = Bool(b, "active");
                    profile.Cabin = Str(b, "cabin");
                }
            }
            catch
            {
                // Backend unreachable — return whatever we have; Tammy degrades gracefully.
            }
            return profile;
        }

        private static string Str(JsonElement e, string k) =>
            e.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
        private static bool Bool(JsonElement e, string k) =>
            e.TryGetProperty(k, out var v) && (v.ValueKind == JsonValueKind.True || v.ValueKind == JsonValueKind.False) && v.GetBoolean();
    }
}
