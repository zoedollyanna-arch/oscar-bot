/* =================================================================================================
 *  Tammy Brightwood — support tickets
 *  ------------------------------------------------------------------------------------------------
 *  Guest-facing support flow. `/support` (or the persistent panel) shows a category menu; picking a
 *  category opens a short modal (SL username, order number, issue). Tammy then creates a private
 *  ticket channel, records it in the shared Neon DB, and posts staff controls (claim / close /
 *  escalate). Everything staff-actionable is rule-based — Tammy never resolves a ticket on her own.
 * ================================================================================================= */

const {
  ChannelType, PermissionsBitField,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require("discord.js");

const config = require("./config");
const store = require("./store");
const { embed, COLORS, isStaff, replyEphemeral, postToChannel, trunc } = require("./ui");

const CATEGORIES = {
  product: { label: "Product Support", emoji: "🛠️" },
  redelivery: { label: "Redelivery", emoji: "📦" },
  cruise: { label: "Cruise Help", emoji: "🚢" },
  report: { label: "Report an Issue", emoji: "🚩" },
};

// The category menu shown by /support and the persistent panel.
function buildMenu() {
  const e = embed(
    "Lifeline Support",
    "Hey there! I'm **Tammy**, your Lifeline staff assistant. What can I help you with today?"
  );
  const row = new ActionRowBuilder().addComponents(
    ...Object.entries(CATEGORIES).map(([key, c]) =>
      new ButtonBuilder().setCustomId(`tammy_support_pick:${key}`).setLabel(c.label).setEmoji(c.emoji).setStyle(ButtonStyle.Primary)
    )
  );
  return { embeds: [e], components: [row] };
}

// Category button → open the intake modal.
async function handlePick(interaction) {
  const category = interaction.customId.split(":")[1];
  const cat = CATEGORIES[category] || CATEGORIES.product;

  const modal = new ModalBuilder().setCustomId(`tammy_support_modal:${category}`).setTitle(`${cat.label} — details`);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("sl_username").setLabel("Second Life username").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("order").setLabel("Order / product name (if known)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(120)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("issue").setLabel("What's going on?").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(900)
    )
  );
  await interaction.showModal(modal);
}

// Modal submit → create the ticket channel + record + staff controls.
async function handleModal(interaction, client) {
  const category = interaction.customId.split(":")[1];
  const cat = CATEGORIES[category] || CATEGORIES.product;
  const sl = trunc(interaction.fields.getTextInputValue("sl_username"), 80);
  const order = trunc(interaction.fields.getTextInputValue("order") || "", 120);
  const issue = trunc(interaction.fields.getTextInputValue("issue"), 900);

  await interaction.deferReply({ ephemeral: true });

  const ticket = store.newTicket({
    category, categoryLabel: cat.label,
    slUsername: sl, order, issue,
    openedBy: interaction.user.id, openedByTag: interaction.user.tag,
    guildId: interaction.guildId,
  });
  store.logInteraction("ticket_open", { ticketId: ticket.id, userId: interaction.user.id, category });

  // Try to create a private channel; if we can't (perms/no category), fall back to logging only.
  let channel = null;
  try {
    channel = await createTicketChannel(interaction, ticket);
    if (channel) {
      ticket.channelId = channel.id;
      store.saveTicket(ticket);
    }
  } catch (e) {
    console.error("createTicketChannel failed:", e.message);
  }

  if (channel) {
    await channel.send({ embeds: [ticketEmbed(ticket)], components: staffControls(ticket) }).catch(() => {});
    await replyEphemeral(interaction, {
      embeds: [embed("Ticket opened", `I've opened <#${channel.id}> for you. Staff have been notified — hang tight!`, COLORS.ok)],
    });
  } else {
    // No channel — still notify staff via the operations channel so nothing is lost.
    await postToChannel(client, config.OPERATIONS_CHANNEL_ID || config.LOG_CHANNEL_ID, {
      content: staffPing(),
      embeds: [ticketEmbed(ticket)],
      components: staffControls(ticket),
    });
    await replyEphemeral(interaction, {
      embeds: [embed("Ticket received", `Thanks! Your ${cat.label.toLowerCase()} request (\`${ticket.id}\`) is logged and staff have been notified.`, COLORS.ok)],
    });
  }
}

async function createTicketChannel(interaction, ticket) {
  const guild = interaction.guild;
  if (!guild) return null;

  const staffRoleIds = config.TICKET_STAFF_ROLE_IDS.length
    ? config.TICKET_STAFF_ROLE_IDS
    : [config.ADMIN_ROLE_ID, ...config.STAFF_ROLE_IDS].filter(Boolean);

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
    },
    ...staffRoleIds.map((id) => ({
      id,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
    })),
  ];

  const shortId = ticket.id.replace(/^TCK/, "");
  const name = `${config.TICKET_CHANNEL_PREFIX}-${shortId}`.toLowerCase().slice(0, 90);

  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: config.TICKET_CATEGORY_ID || undefined,
    permissionOverwrites: overwrites,
    reason: `Tammy support ticket ${ticket.id}`,
  });
}

function ticketEmbed(t) {
  const color = t.status === "closed" ? COLORS.danger : t.claimedBy ? COLORS.warn : COLORS.brand;
  const e = embed(`${CATEGORIES[t.category]?.emoji || "🎫"} ${t.categoryLabel} — ${t.id}`, null, color).addFields(
    { name: "SL username", value: t.slUsername || "—", inline: true },
    { name: "Order / product", value: t.order || "—", inline: true },
    { name: "Status", value: t.status + (t.claimedByTag ? ` (claimed by ${t.claimedByTag})` : ""), inline: true },
    { name: "Issue", value: t.issue || "—", inline: false },
    { name: "Opened by", value: `<@${t.openedBy}>`, inline: true }
  );
  return e;
}

function staffControls(t) {
  const closed = t.status === "closed";
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tammy_tk:claim:${t.id}`).setLabel("Claim").setEmoji("🙋").setStyle(ButtonStyle.Primary).setDisabled(closed),
    new ButtonBuilder().setCustomId(`tammy_tk:escalate:${t.id}`).setLabel("Escalate").setEmoji("⏫").setStyle(ButtonStyle.Secondary).setDisabled(closed),
    new ButtonBuilder().setCustomId(`tammy_tk:close:${t.id}`).setLabel("Close").setEmoji("🔒").setStyle(ButtonStyle.Danger).setDisabled(closed)
  );
  // For redelivery tickets, give staff a shortcut to the redelivery command.
  return [row];
}

function staffPing() {
  const ids = config.TICKET_STAFF_ROLE_IDS.length ? config.TICKET_STAFF_ROLE_IDS : [config.ADMIN_ROLE_ID].filter(Boolean);
  return ids.map((id) => `<@&${id}>`).join(" ") || "";
}

// Staff control buttons (claim / escalate / close).
async function handleControl(interaction) {
  const [, action, ticketId] = interaction.customId.split(":");
  const t = store.tickets.get(ticketId);
  if (!t) return replyEphemeral(interaction, { content: "That ticket no longer exists." });
  if (!isStaff(interaction.member)) {
    return replyEphemeral(interaction, { content: "Only staff can use these controls." });
  }

  if (action === "claim") {
    t.claimedBy = interaction.user.id;
    t.claimedByTag = interaction.user.tag;
    t.status = t.status === "closed" ? "closed" : "claimed";
    store.saveTicket(t);
    store.logInteraction("ticket_claim", { ticketId, staffId: interaction.user.id });
  } else if (action === "escalate") {
    t.escalatedBy = interaction.user.id;
    t.status = "escalated";
    store.saveTicket(t);
    store.logInteraction("ticket_escalate", { ticketId, staffId: interaction.user.id });
    await postToChannel(interaction.client, config.OPERATIONS_CHANNEL_ID || config.LOG_CHANNEL_ID, {
      content: staffPing(),
      embeds: [embed("Ticket escalated", `${t.id} (${t.categoryLabel}) was escalated by <@${interaction.user.id}>.`, COLORS.danger)],
    });
  } else if (action === "close") {
    t.status = "closed";
    t.closedBy = interaction.user.id;
    t.closedAt = new Date().toISOString();
    store.saveTicket(t);
    store.logInteraction("ticket_close", { ticketId, staffId: interaction.user.id });
  }

  await interaction.update({ embeds: [ticketEmbed(t)], components: staffControls(t) }).catch(async () => {
    await interaction.reply({ embeds: [ticketEmbed(t)], components: staffControls(t) }).catch(() => {});
  });

  // Archive the channel a moment after close.
  if (action === "close" && t.channelId) {
    const ch = await interaction.client.channels.fetch(t.channelId).catch(() => null);
    if (ch) {
      await ch.send({ embeds: [embed("Ticket closed", "This ticket is now closed. Staff can delete this channel when ready.", COLORS.danger)] }).catch(() => {});
    }
  }
}

module.exports = { CATEGORIES, buildMenu, handlePick, handleModal, handleControl, ticketEmbed, staffControls };
