/* Package reschedule flow (Tammy) — when a voyage date shifts, guests with island
 * packages confirm or update their date/time/location via a button + modal.
 * Button customId: pkg_resched:open:<guestId>:<orderId>
 * Modal  customId: pkg_resched:modal:<guestId>:<orderId>
 * Requests are stored in package_reschedule_requests (shared Neon) and echoed into
 * the ticket channel so staff can act on them. */
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require("discord.js");

const PREFIX = "pkg_resched";

function rescheduleButton(guestId, orderId, label) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PREFIX}:open:${guestId}:${orderId}`)
      .setLabel(label || "📅 Update My Bali Package")
      .setStyle(ButtonStyle.Primary)
  );
}

function buildModal(guestId, orderId) {
  const modal = new ModalBuilder()
    .setCustomId(`${PREFIX}:modal:${guestId}:${orderId}`)
    .setTitle("📅 Bali Package — Date, Time & Spot");
  const input = (id, label, style, required, placeholder, value) => {
    const t = new TextInputBuilder().setCustomId(id).setLabel(label.slice(0, 45)).setStyle(style)
      .setRequired(required).setPlaceholder(placeholder.slice(0, 100))
      .setMaxLength(style === TextInputStyle.Paragraph ? 500 : 100);
    if (value) t.setValue(value.slice(0, 100));
    return new ActionRowBuilder().addComponents(t);
  };
  modal.addComponents(
    input("resched_date", "Preferred date", TextInputStyle.Short, true, "e.g. 7/18 (Bali arrival day)", "7/18"),
    input("resched_time", "Preferred time (SLT)", TextInputStyle.Short, true, "e.g. 8:30 PM SLT — or 'same time as before'"),
    input("resched_location", "Preferred spot in Bali", TextInputStyle.Short, false, "e.g. private beach, bungalow row, surprise me!"),
    input("resched_notes", "Anything else for the crew?", TextInputStyle.Paragraph, false, "Special touches, occasion details, surprises to keep secret…"),
  );
  return modal;
}

async function ensureTable(db) {
  await db.query(
    `CREATE TABLE IF NOT EXISTS package_reschedule_requests (
       id BIGSERIAL PRIMARY KEY, order_id TEXT NOT NULL, guest_id TEXT NOT NULL,
       channel_id TEXT, preferred_date TEXT, preferred_time TEXT, preferred_location TEXT,
       notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`
  );
}

async function handle(interaction, db) {
  if (!interaction.customId?.startsWith(`${PREFIX}:`)) return false;
  const [, action, guestId, orderId] = interaction.customId.split(":");

  if (interaction.user.id !== guestId) {
    await interaction.reply({ content: "This little form belongs to the guest named in this booking ticket 💙", flags: 64 });
    return true;
  }

  if (action === "open" && interaction.isButton()) {
    await interaction.showModal(buildModal(guestId, orderId));
    return true;
  }

  if (action === "modal" && interaction.isModalSubmit()) {
    const val = (id) => { try { return String(interaction.fields.getTextInputValue(id) || "").trim(); } catch { return ""; } };
    const date = val("resched_date"), time = val("resched_time");
    const location = val("resched_location"), notes = val("resched_notes");

    try {
      if (db && db.isReady()) {
        await ensureTable(db);
        await db.query(
          `INSERT INTO package_reschedule_requests (order_id, guest_id, channel_id, preferred_date, preferred_time, preferred_location, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [orderId, guestId, interaction.channelId, date, time, location, notes]
        );
      }
    } catch (error) {
      console.log("Reschedule DB log failed (continuing with Discord message):", error.message);
    }

    const summary = new EmbedBuilder()
      .setColor(0x70D6A7)
      .setTitle("🌺 Bali Package Update Received!")
      .setDescription(`Thank you, lovely! Here's what you told us — our crew will confirm everything shortly 💕`)
      .addFields(
        { name: "📅 Date", value: date || "—", inline: true },
        { name: "🕐 Time (SLT)", value: time || "—", inline: true },
        { name: "📍 Spot", value: location || "Crew's choice — we'll make it dreamy ✨", inline: false },
      )
      .setFooter({ text: "Lifeline Island Paradise • Tammy at the Front Desk 🛎️💕" })
      .setTimestamp();
    if (notes) summary.addFields({ name: "📝 Notes", value: notes.slice(0, 1024), inline: false });

    // Post in-channel (not ephemeral) so staff sees the request right in the ticket.
    await interaction.reply({ content: `<@${guestId}> 🌺`, embeds: [summary], allowedMentions: { users: [guestId] } });
    return true;
  }

  return false;
}

module.exports = { rescheduleButton, buildModal, handle, PREFIX };
