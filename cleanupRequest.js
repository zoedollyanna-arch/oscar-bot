const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const PREFIX = "cleanup_request";

function cleanupEmbed(guestId) {
  const embed = new EmbedBuilder()
    .setColor(0xFADADD)
    .setTitle("🧹 Need a Cabin Cleanup? ✨")
    .setDescription(
      "Hey lovebirds! 💕 Don't feel like tidying up after all that romance?\n\n" +
      "Our crew is happy to come by and handle **everything** — rose petals, candles, " +
      "trays, glasses, the works. You just relax and enjoy the rest of your evening 🌙\n\n" +
      "Press the button below and we'll take care of it for you!"
    )
    .addFields(
      {
        name: "🧽 What We'll Do",
        value: "Full cabin reset — dishes cleared, decorations packed, surfaces wiped, and everything returned to its cozy pre-setup state.",
        inline: false,
      },
      {
        name: "⏱️ When",
        value: "Once you request it, our crew will come by within 15 minutes. You don't need to be present — we'll be quick and discreet.",
        inline: false,
      }
    )
    .setFooter({ text: "Lifeline Island Paradise • Tammy at the Front Desk 🛎️💕" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PREFIX}:request:${guestId}`)
      .setLabel("🧹 Request Cleanup")
      .setEmoji("🧹")
      .setStyle(ButtonStyle.Secondary)
  );

  return { content: `<@${guestId}>`, embeds: [embed], components: [row] };
}

async function handle(interaction, db) {
  if (!interaction.customId?.startsWith(`${PREFIX}:`)) return false;

  const [prefix, action, guestId] = interaction.customId.split(":");
  if (prefix !== PREFIX) return false;

  if (interaction.user.id !== guestId) {
    await interaction.reply({ content: "This cleanup request belongs to the guest named in this booking ticket 💙", flags: 64 });
    return true;
  }

  if (action === "request" && interaction.isButton()) {
    // Log the cleanup request to database
    try {
      if (db && db.isReady()) {
        await db.query(
          `CREATE TABLE IF NOT EXISTS cabin_cleanup_requests (
             id BIGSERIAL PRIMARY KEY, booking_channel_id TEXT NOT NULL,
             guest_id TEXT NOT NULL, cabin TEXT, status TEXT NOT NULL DEFAULT 'pending',
             requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
             fulfilled_at TIMESTAMPTZ
           )`
        );
        await db.query(
          `INSERT INTO cabin_cleanup_requests (booking_channel_id, guest_id, status)
           VALUES ($1, $2, 'pending')`,
          [interaction.channelId, guestId]
        );
        console.log(`Cleanup request logged for guest ${guestId} in ${interaction.channelId}`);
      }
    } catch (error) {
      console.log("Cleanup request DB log failed (continuing):", error.message);
    }

    const embed = new EmbedBuilder()
      .setColor(0x70D6A7)
      .setTitle("🧹 Cleanup Request Received! ✨")
      .setDescription(
        "You've got it, sweetie! 💕 Our crew has been notified and will head over to your cabin " +
        "shortly to tidy everything up. No need to lift a finger — just keep enjoying your evening 🌙\n\n" +
        "If anything comes up, just message us right here!"
      )
      .addFields(
        { name: "📅 Requested", value: new Date().toLocaleDateString(), inline: true },
        { name: "⏱️ ETA", value: "Within 15 minutes", inline: true },
        { name: "🏠 Service", value: "Cabin Romantic Teardown & Reset", inline: false }
      )
      .setFooter({ text: "Lifeline Island Paradise • Cleanup on the way 🛎️💕" })
      .setTimestamp();

    await interaction.update({
      content: `<@${guestId}>`,
      embeds: [embed],
      components: [],
    });
    return true;
  }

  return false;
}

module.exports = { cleanupEmbed, handle };
