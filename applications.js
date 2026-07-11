/* =================================================================================================
 *  Tammy Brightwood — applications (staff / blogger)
 *  ------------------------------------------------------------------------------------------------
 *  /apply lets a member submit a staff or blogger application. Tammy collects the details in a
 *  modal, records them in the shared Neon DB, and posts them to the applications channel with
 *  Accept / Deny buttons. Decisions are RULE-BASED and staff-only — Tammy never grants a role or
 *  approves an application on her own; she only records the decision and DMs the applicant.
 * ================================================================================================= */

const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require("discord.js");

const config = require("./config");
const store = require("./store");
const { embed, COLORS, isStaff, replyEphemeral, postToChannel, trunc } = require("./ui");

const TYPES = {
  staff: { label: "Staff", emoji: "🧑‍💼" },
  blogger: { label: "Blogger", emoji: "📸" },
};

// /apply → type picker
function buildPicker() {
  const e = embed("Join the Lifeline team", "Which kind of application would you like to submit?");
  const row = new ActionRowBuilder().addComponents(
    ...Object.entries(TYPES).map(([key, t]) =>
      new ButtonBuilder().setCustomId(`tammy_apply_pick:${key}`).setLabel(t.label).setEmoji(t.emoji).setStyle(ButtonStyle.Primary)
    )
  );
  return { embeds: [e], components: [row] };
}

async function handlePick(interaction) {
  const type = interaction.customId.split(":")[1];
  const t = TYPES[type] || TYPES.staff;
  const modal = new ModalBuilder().setCustomId(`tammy_apply_modal:${type}`).setTitle(`${t.label} application`);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("sl_username").setLabel("Second Life username").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("experience").setLabel("Relevant experience").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(700)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("about").setLabel(type === "blogger" ? "Portfolio / Flickr / socials" : "Availability & why you're a fit").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(700)
    )
  );
  await interaction.showModal(modal);
}

async function handleModal(interaction, client) {
  const type = interaction.customId.split(":")[1];
  const t = TYPES[type] || TYPES.staff;
  const rec = store.newApplication({
    type, typeLabel: t.label,
    slUsername: trunc(interaction.fields.getTextInputValue("sl_username"), 80),
    experience: trunc(interaction.fields.getTextInputValue("experience"), 700),
    about: trunc(interaction.fields.getTextInputValue("about"), 700),
    applicantId: interaction.user.id, applicantTag: interaction.user.tag,
    guildId: interaction.guildId,
  });
  store.logInteraction("application_submit", { id: rec.id, userId: interaction.user.id, type });

  await interaction.deferReply({ ephemeral: true });
  await postToChannel(client, config.APPLICATIONS_CHANNEL_ID || config.OPERATIONS_CHANNEL_ID || config.LOG_CHANNEL_ID, {
    content: staffPing(),
    embeds: [appCard(rec)],
    components: appControls(rec),
  });
  return replyEphemeral(interaction, {
    embeds: [embed("Application received", `Thanks for applying as **${t.label}** (\`${rec.id}\`)! Staff will review it and get back to you.`, COLORS.ok)],
  });
}

function appCard(a) {
  const color = a.status === "accepted" ? COLORS.ok : a.status === "denied" ? COLORS.danger : COLORS.warn;
  return embed(`${TYPES[a.type]?.emoji || "📝"} ${a.typeLabel} application — ${a.id}`, null, color).addFields(
    { name: "SL username", value: a.slUsername || "—", inline: true },
    { name: "Applicant", value: `<@${a.applicantId}>`, inline: true },
    { name: "Status", value: a.status + (a.decidedByTag ? ` by ${a.decidedByTag}` : ""), inline: true },
    { name: "Experience", value: a.experience || "—", inline: false },
    { name: a.type === "blogger" ? "Portfolio / socials" : "Availability & fit", value: a.about || "—", inline: false }
  );
}

function appControls(a) {
  const done = a.status === "accepted" || a.status === "denied";
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tammy_app:accept:${a.id}`).setLabel("Accept").setEmoji("✅").setStyle(ButtonStyle.Success).setDisabled(done),
    new ButtonBuilder().setCustomId(`tammy_app:deny:${a.id}`).setLabel("Deny").setEmoji("⛔").setStyle(ButtonStyle.Danger).setDisabled(done)
  )];
}

function staffPing() {
  const ids = config.TICKET_STAFF_ROLE_IDS.length ? config.TICKET_STAFF_ROLE_IDS : [config.ADMIN_ROLE_ID].filter(Boolean);
  return ids.map((id) => `<@&${id}>`).join(" ") || "";
}

async function handleControl(interaction) {
  const [, action, id] = interaction.customId.split(":");
  const a = store.applications.get(id);
  if (!a) return replyEphemeral(interaction, { content: "That application no longer exists." });
  if (!isStaff(interaction.member)) return replyEphemeral(interaction, { content: "Only staff can decide applications." });
  if (a.status === "accepted" || a.status === "denied") return replyEphemeral(interaction, { content: `Already ${a.status}.` });

  a.status = action === "accept" ? "accepted" : "denied";
  a.decidedBy = interaction.user.id;
  a.decidedByTag = interaction.user.tag;
  a.decidedAt = new Date().toISOString();
  store.saveApplication(a);
  store.logInteraction(action === "accept" ? "application_accept" : "application_deny", { id, staffId: interaction.user.id });

  // DM the applicant (best-effort). Tammy does not assign roles — staff do that manually.
  try {
    const user = await interaction.client.users.fetch(a.applicantId).catch(() => null);
    if (user) {
      const e = a.status === "accepted"
        ? embed("Application accepted 🎉", `Great news — your **${a.typeLabel}** application was accepted! Staff will reach out with next steps.`, COLORS.ok)
        : embed("Application update", `Thanks for applying as **${a.typeLabel}**. We won't be moving forward right now, but you're welcome to apply again in the future.`, COLORS.warn);
      await user.send({ embeds: [e] }).catch(() => {});
    }
  } catch { /* ignore */ }

  await interaction.update({ embeds: [appCard(a)], components: appControls(a) }).catch(() => {});
}

module.exports = { TYPES, buildPicker, handlePick, handleModal, handleControl };
