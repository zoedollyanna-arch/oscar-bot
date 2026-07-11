/* =================================================================================================
 *  Tammy Brightwood — redelivery requests
 *  ------------------------------------------------------------------------------------------------
 *  Guests use /redelivery to ask for an item to be resent. This is a RULE-BASED, staff-gated flow:
 *  Tammy records the request in the shared Neon DB (status "pending_review") and posts it to the
 *  operations channel with Approve / Deny buttons. Tammy never issues an item herself — a staff
 *  member approves, which marks it approved and (best-effort) pings the backend to notify the
 *  in-world redelivery relay. The main bot's staff tooling can also see these records in Neon.
 * ================================================================================================= */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const config = require("./config");
const store = require("./store");
const backend = require("./backendClient");
const { embed, COLORS, isStaff, replyEphemeral, postToChannel, trunc } = require("./ui");

// /redelivery sl_username: <name> product: <text> [note: <text>]
async function handleCommand(interaction, client) {
  const sl = trunc(interaction.options.getString("sl_username", true), 80);
  const product = trunc(interaction.options.getString("product", true), 120);
  const note = trunc(interaction.options.getString("note") || "", 400);

  await interaction.deferReply({ ephemeral: true });

  const rec = store.newRedelivery({
    slUsername: sl, product, note,
    requestedBy: interaction.user.id, requestedByTag: interaction.user.tag,
    guildId: interaction.guildId,
  });
  store.logInteraction("redelivery_request", { id: rec.id, userId: interaction.user.id, product });

  await postToChannel(client, config.OPERATIONS_CHANNEL_ID || config.LOG_CHANNEL_ID, {
    content: staffPing(),
    embeds: [staffCard(rec)],
    components: staffControls(rec),
  });

  await replyEphemeral(interaction, {
    embeds: [embed(
      "Redelivery requested",
      `Thanks! I've logged a redelivery of **${product}** for **${sl}** (\`${rec.id}\`). ` +
        `Staff will review and send it — you'll be all set shortly.`,
      COLORS.ok
    )],
  });
}

function staffCard(r) {
  const color = r.status === "approved" ? COLORS.ok : r.status === "denied" ? COLORS.danger : COLORS.warn;
  return embed(`📦 Redelivery — ${r.id}`, null, color).addFields(
    { name: "SL username", value: r.slUsername || "—", inline: true },
    { name: "Product", value: r.product || "—", inline: true },
    { name: "Status", value: r.status + (r.decidedByTag ? ` by ${r.decidedByTag}` : ""), inline: true },
    { name: "Note", value: r.note || "—", inline: false },
    { name: "Requested by", value: `<@${r.requestedBy}>`, inline: true }
  );
}

function staffControls(r) {
  const done = r.status === "approved" || r.status === "denied";
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tammy_rdl:approve:${r.id}`).setLabel("Approve & Send").setEmoji("✅").setStyle(ButtonStyle.Success).setDisabled(done),
    new ButtonBuilder().setCustomId(`tammy_rdl:deny:${r.id}`).setLabel("Deny").setEmoji("⛔").setStyle(ButtonStyle.Danger).setDisabled(done)
  );
  return [row];
}

function staffPing() {
  const ids = config.TICKET_STAFF_ROLE_IDS.length ? config.TICKET_STAFF_ROLE_IDS : [config.ADMIN_ROLE_ID].filter(Boolean);
  return ids.map((id) => `<@&${id}>`).join(" ") || "";
}

async function handleControl(interaction) {
  const [, action, id] = interaction.customId.split(":");
  const r = store.redeliveries.get(id);
  if (!r) return replyEphemeral(interaction, { content: "That request no longer exists." });
  if (!isStaff(interaction.member)) return replyEphemeral(interaction, { content: "Only staff can approve or deny redeliveries." });
  if (r.status === "approved" || r.status === "denied") {
    return replyEphemeral(interaction, { content: `Already ${r.status}.` });
  }

  r.decidedBy = interaction.user.id;
  r.decidedByTag = interaction.user.tag;
  r.decidedAt = new Date().toISOString();

  if (action === "approve") {
    r.status = "approved";
    store.saveRedelivery(r);
    store.logInteraction("redelivery_approve", { id, staffId: interaction.user.id });
    // Best-effort: tell the backend so it can queue the in-world relay. Never blocks the UI.
    const res = await backend.notifyRedelivery({ id: r.id, slUsername: r.slUsername, product: r.product, note: r.note });
    if (!res.ok && res.error !== "backend_not_configured") {
      console.warn(`redelivery ${id}: backend notify failed (${res.error}) — record is still approved in Neon.`);
    }
    await notifyRequester(interaction.client, r, true);
  } else {
    r.status = "denied";
    store.saveRedelivery(r);
    store.logInteraction("redelivery_deny", { id, staffId: interaction.user.id });
    await notifyRequester(interaction.client, r, false);
  }

  await interaction.update({ embeds: [staffCard(r)], components: staffControls(r) }).catch(() => {});
}

async function notifyRequester(client, r, approved) {
  try {
    const user = await client.users.fetch(r.requestedBy).catch(() => null);
    if (!user) return;
    const e = approved
      ? embed("Redelivery approved ✅", `Your redelivery of **${r.product}** for **${r.slUsername}** has been approved and sent. Please check in-world!`, COLORS.ok)
      : embed("Redelivery update", `Your redelivery of **${r.product}** couldn't be completed automatically. Please open \`/support\` with your purchase details and staff will help.`, COLORS.warn);
    await user.send({ embeds: [e] }).catch(() => {});
  } catch { /* DMs closed — fine */ }
}

module.exports = { handleCommand, handleControl, staffCard, staffControls };
