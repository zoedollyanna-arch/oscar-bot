using System.Text.Json;

namespace LittleLinksFleet.Models
{
    /// <summary>One bot as handed out by POST /fleet/claim.</summary>
    public sealed class ClaimedBot
    {
        public string BotKey { get; set; } = "";
        public string OwnerKey { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public string Nickname { get; set; } = "";
        public string StartLocation { get; set; } = "";

/// <summary>
    /// Top-tier only: track objects in the world, not just what this
    /// baby is wearing, so the dashboard can touch a crib or a vendor.
    ///
    /// This is the expensive one. Object tracking is what turns 60-90 MB
    /// per baby into several hundred on a busy sim, which is why it is
    /// off by default and sold with the PREMIUM plan. It must be set
    /// before login: the setting is read as the client connects, so
    /// changing it later would mean reconnecting the avatar.
    /// </summary>
    public bool AllowWorldTouch { get; set; }


        /// <summary>What the portal shows. Nickname wins, as parents set it.</summary>
        public string Label =>
            !string.IsNullOrWhiteSpace(Nickname) ? Nickname
            : !string.IsNullOrWhiteSpace(DisplayName) ? DisplayName
            : BotKey;
    }

    /// <summary>
    /// A decrypted Second Life login. Deliberately not a record and not
    /// logged anywhere: ToString() is overridden so an accidental string
    /// interpolation in a log line cannot leak the password.
    /// </summary>
    public sealed class BotCredential
    {
        public string First { get; set; } = "";
        public string Last { get; set; } = "Resident";
        public string Password { get; set; } = "";

        public override string ToString() => $"{First} {Last} (password redacted)";
    }

    /// <summary>One row from the bot's command queue.</summary>
    public sealed class BotCommand
    {
        public long Id { get; set; }
        public string Command { get; set; } = "";
        public JsonElement Args { get; set; }

        public string ArgString(string name, string fallback = "")
        {
            if (Args.ValueKind != JsonValueKind.Object) return fallback;
            if (!Args.TryGetProperty(name, out var v)) return fallback;
            return v.ValueKind switch
            {
                JsonValueKind.String => v.GetString() ?? fallback,
                JsonValueKind.Number => v.ToString(),
                JsonValueKind.True   => "true",
                JsonValueKind.False  => "false",
                _ => fallback,
            };
        }

        public float ArgFloat(string name, float fallback)
            => float.TryParse(ArgString(name), System.Globalization.NumberStyles.Float,
                              System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : fallback;

        public bool ArgBool(string name, bool fallback = false)
        {
            var s = ArgString(name);
            if (string.IsNullOrEmpty(s)) return fallback;
            return s is "true" or "1" or "yes";
        }

        /// <summary>Reads an array argument (outfit item lists, give targets).</summary>
        public List<string> ArgList(string name)
        {
            var outList = new List<string>();
            if (Args.ValueKind != JsonValueKind.Object) return outList;
            if (!Args.TryGetProperty(name, out var v) || v.ValueKind != JsonValueKind.Array) return outList;
            foreach (var el in v.EnumerateArray())
            {
                var s = el.ValueKind == JsonValueKind.String ? el.GetString() : el.ToString();
                if (!string.IsNullOrWhiteSpace(s)) outList.Add(s.Trim());
            }
            return outList;
        }
    }

    /// <summary>An inventory row as the API expects it.</summary>
    public sealed class InventorySnapshotItem
    {
        public string item_key { get; set; } = "";
        public string name { get; set; } = "";
        public string asset_type { get; set; } = "";
        public string folder { get; set; } = "";
        public bool is_worn { get; set; }
        public string attach_point { get; set; } = "";
    }

    /// <summary>
    /// One sit-capable object from the premium region sweep, as the API
    /// expects it on POST /fleet/:bot_key/detected-objects.
    /// </summary>
    public sealed class DetectedObject
    {
        public string object_key { get; set; } = "";
        public string name { get; set; } = "";
        public string region { get; set; } = "";
        public float pos_x { get; set; }
        public float pos_y { get; set; }
        public float pos_z { get; set; }
    }

    /// <summary>Outcome of one command, reported back to the API verbatim.</summary>
    public sealed class CommandResult
    {
        public bool Ok { get; init; }
        public string Message { get; init; } = "";

        public static CommandResult Success(string message = "done") => new() { Ok = true, Message = message };
        public static CommandResult Failure(string message) => new() { Ok = false, Message = message };
    }
}
