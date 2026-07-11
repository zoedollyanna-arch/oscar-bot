/* =================================================================================================
 *  Tammy Brightwood — shared UI + permission helpers
 * ================================================================================================= */

const { EmbedBuilder, PermissionsBitField, MessageFlags } = require("discord.js");
const config = require("./config");

const COLORS = { brand: 0x5b8def, ok: 0x57c76b, warn: 0xf0ad4e, danger: 0xe0574a, info: 0x8a63d2 };

function embed(title, description, color = COLORS.brand) {
  const e = new EmbedBuilder().setColor(color).setTimestamp().setFooter({ text: "Tammy Brightwood • Lifeline" });
  if (title) e.setTitle(title);
  if (description) e.setDescription(description);
  return e;
}

// A member is "staff" if they're the admin role, a configured staff role, or have Manage Server.
function isStaff(member) {
  if (!member) return false;
  try {
    if (member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) return true;
  } catch { /* ignore */ }
  const roleIds = member.roles?.cache ? [...member.roles.cache.keys()] : [];
  if (config.ADMIN_ROLE_ID && roleIds.includes(config.ADMIN_ROLE_ID)) return true;
  for (const r of config.STAFF_ROLE_IDS) if (roleIds.includes(r)) return true;
  for (const r of config.TICKET_STAFF_ROLE_IDS) if (roleIds.includes(r)) return true;
  return false;
}

// Ephemeral reply that also works after defer.
function replyEphemeral(interaction, payload) {
  const body = { ...payload, flags: MessageFlags.Ephemeral };
  if (interaction.deferred || interaction.replied) {
    delete body.flags;
    return interaction.editReply(payload);
  }
  return interaction.reply(body);
}

// Post to the staff operations/log channel (best-effort).
async function postToChannel(client, channelId, payload) {
  if (!channelId) return null;
  try {
    const ch = await client.channels.fetch(channelId).catch(() => null);
    if (ch && ch.isTextBased()) return ch.send(payload);
  } catch (e) {
    console.error("postToChannel failed:", e.message);
  }
  return null;
}

function trunc(s, n) { return String(s == null ? "" : s).slice(0, n); }

module.exports = { COLORS, embed, isStaff, replyEphemeral, postToChannel, trunc };
