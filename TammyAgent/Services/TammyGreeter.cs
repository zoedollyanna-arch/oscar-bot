using System.Collections.Concurrent;

namespace TammyAgent.Services
{
    /// <summary>
    /// Tammy's friendly welcome. Detects a plain greeting ("hi", "hello Tammy", "aloha!") and returns
    /// a warm, on-brand hello that invites the resident to IM her for help. Kept deterministic and
    /// brain-independent so the greeting always sounds the same and works even when the AI is off.
    /// A per-resident cooldown stops her re-greeting the same person (e.g. chatty local chat).
    /// </summary>
    public static class TammyGreeter
    {
        // Words that, on their own, count as a greeting.
        private static readonly HashSet<string> GreetWords = new(StringComparer.OrdinalIgnoreCase)
        {
            "hi", "hii", "hiii", "hey", "heya", "hiya", "hello", "helo", "hallo", "yo", "sup",
            "howdy", "aloha", "hola", "greetings", "morning", "afternoon", "evening", "welcome",
            "wsp", "hihi", "heyo", "ola",
        };

        // Filler that can appear alongside a greeting without changing that it's just a hello.
        private static readonly HashSet<string> Filler = new(StringComparer.OrdinalIgnoreCase)
        {
            "tammy", "there", "all", "everyone", "everybody", "guys", "yall", "folks", "again",
            "im", "new", "here", "good", "a", "the", "to", "you", "u", "and", "just", "so", "very",
            "everso", "back", "world", "peeps", "fam", "miss", "ms", "friend", "hey",
        };

        private static readonly ConcurrentDictionary<string, DateTime> LastGreeted = new();
        private static readonly TimeSpan Cooldown = TimeSpan.FromMinutes(30);

        /// <summary>True when the whole message is essentially a greeting and nothing more.</summary>
        public static bool IsGreeting(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return false;
            var tokens = text
                .ToLowerInvariant()
                .Split(new[] { ' ', '\t', '\n', '\r', ',', '.', '!', '?', ';', ':', '\'', '"', '-', '~', '(', ')', '*' },
                    StringSplitOptions.RemoveEmptyEntries);
            if (tokens.Length == 0 || tokens.Length > 6) return false; // long messages are real questions

            var hasGreeting = false;
            foreach (var t in tokens)
            {
                if (GreetWords.Contains(t)) { hasGreeting = true; continue; }
                if (Filler.Contains(t)) continue;
                return false; // a non-greeting, non-filler word → treat as a real request, let the brain answer
            }
            return hasGreeting;
        }

        /// <summary>A friendly, emoji-forward welcome. IMs invite a reply; local chat points to IM.</summary>
        public static string Message(string avatarName, bool isLocal)
        {
            var name = FirstName(avatarName);
            var hello = string.IsNullOrEmpty(name) ? "Aloha" : $"Aloha, {name}";
            return isLocal
                ? $"{hello}! \U0001F33A Welcome to Lifeline Island Paradise — so happy you're here! \U0001F334 " +
                  "I'm Tammy, your friendly assistant. Need a hand with anything — bookings, your HUD, jobs, " +
                  "pets, or finding your way around? Just **IM me** anytime and I've got you! \U0001F496"
                : $"{hello}! \U0001F33A So lovely to hear from you! I'm Tammy, your Lifeline Island Paradise " +
                  "assistant. \U0001F334 Whatever you need — bookings, your HUD, jobs, pets, or just finding your " +
                  "way around — tell me right here and I'll help you out. \U0001F496";
        }

        /// <summary>Rate-limit greetings per resident so Tammy never spams the same person.</summary>
        public static bool ShouldGreet(string avatarUuid)
        {
            var now = DateTime.UtcNow;
            if (LastGreeted.TryGetValue(avatarUuid, out var last) && now - last < Cooldown)
                return false;
            LastGreeted[avatarUuid] = now;
            return true;
        }

        private static string FirstName(string full)
        {
            if (string.IsNullOrWhiteSpace(full)) return "";
            var first = full.Trim().Split(' ')[0];
            // Skip generic display fallbacks.
            return first.Equals("Resident", StringComparison.OrdinalIgnoreCase) ? "" : first;
        }
    }
}
