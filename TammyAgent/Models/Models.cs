using System.Text.Json;

namespace TammyAgent.Models
{
    /// <summary>An incoming message from Second Life (IM or local chat).</summary>
    public sealed class IncomingMessage
    {
        public string AvatarUuid { get; set; } = "";
        public string AvatarName { get; set; } = "";
        public string ChannelType { get; set; } = "im"; // "im" | "local"
        public string Text { get; set; } = "";
        public string Region { get; set; } = "";
        public string Position { get; set; } = "";
    }

    /// <summary>A queued command written by the Discord bot for Tammy to execute.</summary>
    public sealed class TammyCommand
    {
        public long Id { get; set; }
        public string CommandType { get; set; } = "";
        public JsonElement Payload { get; set; }
        public string RequestedBy { get; set; } = "";
        public string Status { get; set; } = "pending";

        public string PayloadString(string key)
        {
            if (Payload.ValueKind == JsonValueKind.Object &&
                Payload.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String)
                return v.GetString() ?? "";
            return "";
        }
    }

    /// <summary>Controlled guest context returned by the Lifeline backend (never raw table access).</summary>
    public sealed class GuestProfile
    {
        public string AvatarUuid { get; set; } = "";
        public string AvatarName { get; set; } = "";
        public bool LifelinePlayer { get; set; }
        public string Role { get; set; } = "";
        public string SystemVersion { get; set; } = "";
        public bool BookingActive { get; set; }
        public string Cabin { get; set; } = "";
        public bool WelcomePackageSent { get; set; }
        public bool Staff { get; set; }
        public bool Blogger { get; set; }
        public bool Vip { get; set; }
        public string RawJson { get; set; } = "{}";
    }

    /// <summary>Tammy's operating mode.</summary>
    public static class TammyModes
    {
        public const string Automated = "automated";
        public const string Assisted = "assisted";
        public const string Manual = "manual";
        public const string Away = "away";
        public const string Event = "event";
        public const string Emergency = "emergency";
    }
}
