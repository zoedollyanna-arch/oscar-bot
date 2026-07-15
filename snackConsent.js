const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const PREFIX = "snack_consent";

function consentEmbed(guestId, cabinNumber) {
  const embed = new EmbedBuilder()
    .setColor(0xFFB6C1)
    .setTitle("🍿 Snacks & Drinks Service Consent 🍹")
    .setDescription(
      `Hello sweetie I noticed you requested snacks and drinks for your cabin This service is for your cabin only, and our crew will need to enter to place a snack cart for you 💕`
    )
    .addFields(
      {
        name: "🏠 Your Cabin",
        value: cabinNumber || "Your assigned cabin",
        inline: true
      },
      {
        name: "📋 What This Means",
        value: "By providing consent, you allow our staff to enter your cabin to set up the snack cart with your requested items. This is a one-time service for your convenience",
        inline: false
      },
      {
        name: "🔒 Privacy Note",
        value: "Our staff respects your privacy and will only enter for the purpose of setting up the snack cart. You can revoke this consent at any time",
        inline: false
      }
    )
    .setFooter({ text: "Lifeline Island Paradise • Refreshments await 🛳️💕" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PREFIX}:consent:${guestId}`)
      .setLabel("I Consent")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success)
  );

  return { content: `<@${guestId}>`, embeds: [embed], components: [row] };
}

async function handle(interaction, db) {
  if (!interaction.customId?.startsWith(`${PREFIX}:`)) return false;

  const [prefix, action, guestId] = interaction.customId.split(":");
  if (prefix !== PREFIX) return false;

  if (interaction.user.id !== guestId) {
    await interaction.reply({ content: "This consent form belongs to the guest named in this booking ticket 💙", flags: 64 });
    return true;
  }

  if (action === "consent" && interaction.isButton()) {
    // Log consent to database
    try {
      if (db && db.isReady()) {
        await db.query(
          `INSERT INTO snack_consents (booking_id, guest_id, consent_given, consent_timestamp, channel_id)
           VALUES ($1, $2, $3, now(), $4)
           ON CONFLICT (booking_id) DO UPDATE SET consent_given = $3, consent_timestamp = now()`,
          [interaction.channelId, guestId, true, interaction.channelId]
        );
        console.log(`Snack consent logged for guest ${guestId} in booking ${interaction.channelId}`);
      }
    } catch (error) {
      console.log("Database log failed (continuing with Discord message):", error.message);
    }

    const embed = new EmbedBuilder()
      .setColor(0x70D6A7)
      .setTitle("✅ Consent Received")
      .setDescription("Thank you for your consent Our crew will now proceed to set up your snack cart in your cabin. Enjoy your refreshments 💕")
      .addFields(
        { name: "📅 Consent Date", value: new Date().toLocaleDateString(), inline: true },
        { name: "🏠 Service", value: "Snacks & Drinks Setup", inline: true }
      )
      .setFooter({ text: "Lifeline Island Paradise • Service in progress 🛳️💕" })
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
    return true;
  }

  return false;
}

module.exports = { consentEmbed, handle };
