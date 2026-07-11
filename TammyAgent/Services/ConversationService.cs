using System.Text.Json;
using TammyAgent.Models;

namespace TammyAgent.Services
{
    /// <summary>
    /// Turns an incoming Second Life message into: a logged conversation, and (depending on Tammy's
    /// mode) either a staff hand-off (assisted) or an AI-generated reply with tiered action handling
    /// (automated). Auto-tier actions proceed; approval-tier actions are queued for staff; human-tier
    /// actions are refused and flagged. Tammy never executes a human-only action.
    /// </summary>
    public sealed class ConversationService
    {
        private readonly DatabaseService _db;
        private readonly SecondLifeService _sl;
        private readonly LifelineBackendService _backend;
        private readonly TammyBrainService _brain;

        public ConversationService(DatabaseService db, SecondLifeService sl,
            LifelineBackendService backend, TammyBrainService brain)
        {
            _db = db; _sl = sl; _backend = backend; _brain = brain;
        }

        public async Task HandleIncomingAsync(IncomingMessage msg)
        {
            try
            {
                var convId = await _db.FindOrCreateConversationAsync(msg.AvatarUuid, msg.AvatarName, msg.ChannelType);
                await _db.LogMessageAsync(convId, "incoming", msg.ChannelType, msg.Text, msg.Region, msg.Position);
                Console.WriteLine($"[conv {convId}] {msg.AvatarName}: {msg.Text}");

                var mode = await _db.GetModeAsync();

                // Assisted / away / event / manual: a human answers. We only log; the Discord bot shows
                // the conversation in #tammy-live and staff replies via /tammy im (a queued command).
                if (mode != TammyModes.Automated)
                    return;

                // Automated: let the brain answer (falls back to a holding line if the brain is off).
                if (!_brain.Configured)
                {
                    await ReplyAsync(convId, msg, "Aloha! I've received your message and our staff will help you shortly. 🌺");
                    return;
                }

                var guest = await _backend.GetGuestContextAsync(msg.AvatarUuid);
                if (string.IsNullOrEmpty(guest.AvatarName)) guest.AvatarName = msg.AvatarName;
                var history = await _db.RecentMessagesAsync(convId, 10);

                var brainResult = await _brain.ThinkAsync(guest, msg, history);
                var reply = brainResult.ReplyText;

                if (!string.IsNullOrEmpty(brainResult.ActionType))
                {
                    switch (brainResult.Tier)
                    {
                        case ActionTiers.Approval:
                            await _db.CreateActionRequestAsync(convId, brainResult.ActionType, brainResult.ActionPayloadJson, ActionTiers.Approval);
                            reply = Append(reply, "I've asked our staff to take care of that for you — they'll follow up shortly.");
                            break;
                        case ActionTiers.Human:
                            await _db.CreateActionRequestAsync(convId, brainResult.ActionType, brainResult.ActionPayloadJson, ActionTiers.Human);
                            reply = Append(reply, "That one needs a staff member directly — I've flagged it for them.");
                            break;
                        case ActionTiers.Auto:
                            // Controlled auto actions (lookups, guides, basic tickets) are represented by the
                            // brain's own reply text for now; richer execution can be wired per action later.
                            await _db.LogMessageAsync(convId, "internal", "action", $"auto:{brainResult.ActionType}", msg.Region, msg.Position);
                            break;
                    }
                }

                if (string.IsNullOrWhiteSpace(reply))
                    reply = "Aloha! Let me get a staff member to help you with that. 🌺";

                await ReplyAsync(convId, msg, reply);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[conv] error handling message: {ex.Message}");
            }
        }

        private async Task ReplyAsync(long convId, IncomingMessage msg, string reply)
        {
            var sent = msg.ChannelType == "local" ? _sl.SendLocalChat(reply) : _sl.SendIm(msg.AvatarUuid, reply);
            await _db.LogMessageAsync(convId, "outgoing", msg.ChannelType, reply, _sl.CurrentRegion, _sl.CurrentPosition);
            if (!sent) Console.WriteLine($"[conv {convId}] reply not sent (SL disconnected).");
        }

        private static string Append(string a, string b) =>
            string.IsNullOrWhiteSpace(a) ? b : $"{a.TrimEnd()} {b}";
    }
}
