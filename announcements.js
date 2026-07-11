/* =================================================================================================
 *  Tammy Brightwood — announcements + scheduler
 *  ------------------------------------------------------------------------------------------------
 *  Post announcements now or schedule them for later (events, arrivals, movie times, maintenance,
 *  destination changes). Scheduled announcements persist in the shared Neon DB, so a restart never
 *  loses them. A lightweight interval loop posts anything that's due.
 * ================================================================================================= */

const config = require("./config");
const store = require("./store");
const { embed, COLORS, isStaff, replyEphemeral, postToChannel, trunc } = require("./ui");

// Parse a "when" string into an epoch ms, or null. Accepts:
//   "in 30m" | "in 2h" | "in 3d"  (relative)  or an ISO / "YYYY-MM-DD HH:mm" date.
function parseWhen(input) {
  const s = String(input || "").trim();
  if (!s) return null;
  const rel = s.match(/^in\s+(\d+)\s*(m|min|mins|h|hr|hrs|hour|hours|d|day|days)$/i);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const mult = unit.startsWith("m") ? 60000 : unit.startsWith("h") ? 3600000 : 86400000;
    return Date.now() + n * mult;
  }
  const iso = s.replace(" ", "T");
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function annEmbed(title, message) {
  return embed(`📢 ${title}`, message, COLORS.brand);
}

async function doPost(client, channelId, title, message, pingEveryone) {
  const target = channelId || config.ANNOUNCE_CHANNEL_ID;
  const payload = { embeds: [annEmbed(title, message)] };
  if (pingEveryone) { payload.content = "@everyone"; payload.allowedMentions = { parse: ["everyone"] }; }
  return postToChannel(client, target, payload);
}

// /announce now
async function handleNow(interaction, client) {
  const title = trunc(interaction.options.getString("title", true), 200);
  const message = trunc(interaction.options.getString("message", true), 1800);
  const ping = interaction.options.getBoolean("ping_everyone") || false;
  const channel = interaction.options.getChannel("channel");
  await interaction.deferReply({ ephemeral: true });
  const sent = await doPost(client, channel?.id, title, message, ping);
  store.logInteraction("announce_now", { staffId: interaction.user.id, title });
  return replyEphemeral(interaction, {
    embeds: [embed(sent ? "Announcement posted" : "Couldn't post", sent ? `Posted **${title}**.` : "No target channel configured — set TAMMY_ANNOUNCE_CHANNEL_ID or pass a channel.", sent ? COLORS.ok : COLORS.danger)],
  });
}

// /announce schedule
async function handleSchedule(interaction) {
  const title = trunc(interaction.options.getString("title", true), 200);
  const message = trunc(interaction.options.getString("message", true), 1800);
  const when = parseWhen(interaction.options.getString("when", true));
  const ping = interaction.options.getBoolean("ping_everyone") || false;
  const channel = interaction.options.getChannel("channel");
  if (!when) {
    return replyEphemeral(interaction, { content: 'Could not read that time. Try `in 2h`, `in 30m`, `in 3d`, or `2026-07-12 18:00`.' });
  }
  if (when < Date.now() - 60000) {
    return replyEphemeral(interaction, { content: "That time is in the past." });
  }
  const rec = store.newAnnouncement({
    title, message, pingEveryone: ping,
    channelId: channel?.id || config.ANNOUNCE_CHANNEL_ID || "",
    dueAt: when, scheduledBy: interaction.user.id,
  });
  store.logInteraction("announce_schedule", { id: rec.id, staffId: interaction.user.id, dueAt: when });
  return replyEphemeral(interaction, {
    embeds: [embed("Announcement scheduled", `\`${rec.id}\` — **${title}** at <t:${Math.floor(when / 1000)}:F> (<t:${Math.floor(when / 1000)}:R>).`, COLORS.ok)],
  });
}

// /announce list
async function handleList(interaction) {
  const pending = [...store.announcements.values()].filter((a) => a.status === "scheduled").sort((a, b) => a.dueAt - b.dueAt);
  if (!pending.length) return replyEphemeral(interaction, { content: "No scheduled announcements." });
  const lines = pending.map((a) => `• \`${a.id}\` **${a.title}** — <t:${Math.floor(a.dueAt / 1000)}:R>`).join("\n");
  return replyEphemeral(interaction, { embeds: [embed("Scheduled announcements", lines, COLORS.info)] });
}

// /announce cancel
async function handleCancel(interaction) {
  const id = interaction.options.getString("id", true);
  const rec = store.announcements.get(id);
  if (!rec || rec.status !== "scheduled") return replyEphemeral(interaction, { content: `No scheduled announcement \`${id}\`.` });
  rec.status = "cancelled";
  store.saveAnnouncement(rec);
  store.logInteraction("announce_cancel", { id, staffId: interaction.user.id });
  return replyEphemeral(interaction, { embeds: [embed("Cancelled", `\`${id}\` will not be posted.`, COLORS.danger)] });
}

// Interval loop: post anything due. Called once at startup.
function startScheduler(client) {
  const tick = async () => {
    const now = Date.now();
    for (const rec of store.announcements.values()) {
      if (rec.status !== "scheduled" || rec.dueAt > now) continue;
      rec.status = "posting"; // guard against a double-post if a tick overlaps
      store.saveAnnouncement(rec);
      try {
        await doPost(client, rec.channelId, rec.title, rec.message, rec.pingEveryone);
        rec.status = "posted";
        rec.postedAt = new Date().toISOString();
        store.logInteraction("announce_posted", { id: rec.id });
      } catch (e) {
        console.error(`announcement ${rec.id} post failed:`, e.message);
        rec.status = "scheduled"; // retry next tick
      }
      store.saveAnnouncement(rec);
    }
  };
  setInterval(() => tick().catch((e) => console.error("scheduler tick error:", e.message)), 30000);
  console.log("⏰ Announcement scheduler started (30s tick).");
}

module.exports = { parseWhen, handleNow, handleSchedule, handleList, handleCancel, startScheduler };
