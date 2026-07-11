using System.Text;
using System.Text.Json;
using TammyAgent.Models;

namespace TammyAgent.Services
{
    /// <summary>Result of the brain thinking about a message.</summary>
    public sealed class BrainResult
    {
        public string ReplyText { get; set; } = "";
        public string ActionType { get; set; } = "";       // e.g. "request_welcome_package"
        public string ActionPayloadJson { get; set; } = "{}";
        public string Tier { get; set; } = ActionTiers.None; // none|auto|approval|human
    }

    /// <summary>
    /// Classifies actions into risk tiers. This is enforced on OUR side — the AI can only ever
    /// *request* an action; the tier decides whether Tammy executes it, queues it for staff
    /// approval, or refuses it as human-only. The model never gets unrestricted authority.
    /// </summary>
    public static class ActionTiers
    {
        public const string None = "none";
        public const string Auto = "auto";
        public const string Approval = "approval";
        public const string Human = "human";

        private static readonly HashSet<string> AutoActions = new(StringComparer.OrdinalIgnoreCase)
        {
            "lookup_cabin", "lookup_itinerary", "lookup_active_ticket", "lookup_system_version",
            "send_destination_guide", "answer_faq", "give_directions", "send_rules",
            "create_support_ticket", "request_staff_assistance",
        };
        private static readonly HashSet<string> ApprovalActions = new(StringComparer.OrdinalIgnoreCase)
        {
            "add_cabin_guest", "replace_product", "change_booking", "reserve_private_area",
            "send_limited_package", "modify_access_list", "request_welcome_package",
        };
        private static readonly HashSet<string> HumanActions = new(StringComparer.OrdinalIgnoreCase)
        {
            "refund_ls", "ban_resident", "delete_account", "alter_payment", "transfer_ownership",
            "change_database",
        };

        public static string TierFor(string action)
        {
            if (HumanActions.Contains(action)) return Human;
            if (ApprovalActions.Contains(action)) return Approval;
            if (AutoActions.Contains(action)) return Auto;
            return Approval; // unknown → safest non-human default: require staff approval
        }
    }

    /// <summary>
    /// Tammy's AI brain. Sends the resident message + controlled guest context + recent history to
    /// the OpenAI Responses API and returns a reply and (optionally) a requested action. Disabled and
    /// safe when OPENAI_API_KEY is not set — Tammy simply falls back to assisted mode.
    /// </summary>
    public sealed class TammyBrainService
    {
        private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(20) };
        private readonly string _apiKey;
        private readonly string _model;

        public bool Configured => !string.IsNullOrEmpty(_apiKey);

        public TammyBrainService(string apiKey, string model)
        {
            _apiKey = apiKey ?? "";
            _model = string.IsNullOrWhiteSpace(model) ? "gpt-4o-mini" : model;
        }

        public async Task<BrainResult> ThinkAsync(GuestProfile guest, IncomingMessage msg,
            IReadOnlyList<(string direction, string text)> history)
        {
            if (!Configured)
                return new BrainResult { ReplyText = "", Tier = ActionTiers.None };

            var instructions =
                "You are Tammy Brightwood, a warm, human-sounding Second Life staff assistant for Lifeline " +
                "Island Paradise (a cruise/resort roleplay community). Be friendly, concise, and helpful. " +
                "Identify the resident's intent from their whole message and conversation, not one keyword. " +
                "Verified knowledge: Tammy boards at Ethereal Paradise (85,129,35); HUD profiles are cloud-saved; " +
                "detach/reattach retries profile loading; Power > Resume Stats restarts paused stats; ZPad/ZPhone " +
                "player-data features require the HUD; jobs are in the Jobs app; Eats uses a resident-owned delivery " +
                "box; ZFunds XP redemption has a five-minute cooldown; Academy homework is in the ZPad Homework app. " +
                "For redelivery, booking, applications, incidents, or unresolved technical issues, direct residents to " +
                "Lifeline Assistant in Discord: /redelivery, /book, /apply, /incident, or /support. " +
                "Never invent prices, schedules, cabin assignments, account data, or claim a command succeeded. " +
                "You may answer FAQs, give directions, and look things up. For anything that changes bookings, " +
                "products, access, or money you MUST call the matching function instead of promising it — staff " +
                "will approve. Never claim to have issued items, refunds, or bans. Keep replies short for chat.";

            var contextBlock = BuildContext(guest, history, msg);

            var body = new
            {
                model = _model,
                instructions,
                input = contextBlock,
                tools = BuildTools(),
                max_output_tokens = 350,
            };

            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/responses");
                req.Headers.Add("Authorization", $"Bearer {_apiKey}");
                req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
                var res = await _http.SendAsync(req);
                var text = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode)
                {
                    Console.WriteLine($"[brain] OpenAI HTTP {(int)res.StatusCode}: {Truncate(text, 200)}");
                    return new BrainResult { ReplyText = "", Tier = ActionTiers.None };
                }
                return ParseResponse(text);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[brain] error: {ex.Message}");
                return new BrainResult { ReplyText = "", Tier = ActionTiers.None };
            }
        }

        private static string BuildContext(GuestProfile g, IReadOnlyList<(string, string)> history, IncomingMessage msg)
        {
            var sb = new StringBuilder();
            sb.AppendLine("GUEST CONTEXT (read-only, do not query anything else):");
            sb.AppendLine(g.RawJson);
            sb.AppendLine();
            if (history.Count > 0)
            {
                sb.AppendLine("RECENT CONVERSATION:");
                foreach (var (dir, t) in history)
                    sb.AppendLine($"{(dir == "incoming" ? "Resident" : "Tammy")}: {t}");
                sb.AppendLine();
            }
            sb.AppendLine($"NEW MESSAGE from {g.AvatarName} ({msg.ChannelType}): {msg.Text}");
            return sb.ToString();
        }

        // Tool/function definitions in the Responses API format.
        private static object[] BuildTools()
        {
            object Fn(string name, string desc) => new
            {
                type = "function",
                name,
                description = desc,
                parameters = new
                {
                    type = "object",
                    properties = new { detail = new { type = "string", description = "Any relevant detail, e.g. cabin or product name." } },
                    required = Array.Empty<string>(),
                },
            };
            return new[]
            {
                Fn("lookup_cabin", "Look up the resident's cabin/booking."),
                Fn("lookup_itinerary", "Look up the cruise itinerary."),
                Fn("lookup_active_ticket", "Check the resident's active support ticket."),
                Fn("lookup_system_version", "Check the resident's registered HUD/system version."),
                Fn("send_destination_guide", "Send the public destination guide / map."),
                Fn("create_support_ticket", "Open a basic support ticket for the resident."),
                Fn("request_staff_assistance", "Ask a human staff member to step in."),
                Fn("request_welcome_package", "Request that the resident's welcome package be (re)sent. Needs staff approval."),
                Fn("add_cabin_guest", "Add a guest to the resident's cabin. Needs staff approval."),
                Fn("replace_product", "Replace a paid product. Needs staff approval."),
                Fn("change_booking", "Change a booking. Needs staff approval."),
            };
        }

        private static BrainResult ParseResponse(string json)
        {
            var result = new BrainResult();
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                // Prefer the convenience aggregate if present.
                if (root.TryGetProperty("output_text", out var ot) && ot.ValueKind == JsonValueKind.String)
                    result.ReplyText = ot.GetString() ?? "";

                if (root.TryGetProperty("output", out var output) && output.ValueKind == JsonValueKind.Array)
                {
                    var textSb = new StringBuilder(result.ReplyText);
                    foreach (var item in output.EnumerateArray())
                    {
                        var itype = item.TryGetProperty("type", out var t) ? t.GetString() : "";
                        if (itype == "function_call")
                        {
                            var name = item.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
                            var args = item.TryGetProperty("arguments", out var a) && a.ValueKind == JsonValueKind.String
                                ? a.GetString() ?? "{}" : "{}";
                            if (!string.IsNullOrEmpty(name) && string.IsNullOrEmpty(result.ActionType))
                            {
                                result.ActionType = name;
                                result.ActionPayloadJson = args;
                                result.Tier = ActionTiers.TierFor(name);
                            }
                        }
                        else if (itype == "message" && item.TryGetProperty("content", out var content) && content.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var c in content.EnumerateArray())
                                if (c.TryGetProperty("text", out var ct) && ct.ValueKind == JsonValueKind.String)
                                    textSb.Append(ct.GetString());
                        }
                    }
                    if (string.IsNullOrEmpty(result.ReplyText)) result.ReplyText = textSb.ToString();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[brain] parse error: {ex.Message}");
            }
            return result;
        }

        private static string Truncate(string s, int n) => s.Length <= n ? s : s.Substring(0, n);
    }
}
