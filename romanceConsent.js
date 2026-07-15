const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const PREFIX = "romance_consent";

function consentEmbed(guestId, cabinNumber) {
  const embed = new EmbedBuilder()
    .setColor(0xFF5FA2)
    .setTitle("🌹 Your Cabin Romance Setup is Approved! ✨")
    .setDescription(
      `Wonderful news, lovely — your **Cabin Romance Setup** has been approved and our crew would love ` +
      `to start creating the magic for you two **as soon as possible**! 💕 Rose petals, candles, bubbly, ` +
      `chocolate strawberries… it's going to be dreamy. 🥂`
    )
    .addFields(
      {
        name: "🏠 Your Cabin",
        value: cabinNumber || "Your assigned cabin",
        inline: true,
      },
      {
        name: "📋 One Little Thing First",
        value:
          "To set everything up while it stays a lovely surprise, our crew needs your permission to " +
          "enter your cabin. By pressing **I Consent** below, you allow our staff to enter your cabin " +
          "for this one-time romance setup 💝",
        inline: false,
      },
      {
        name: "🔒 We Respect Your Privacy",
        value:
          "Our staff will only enter to set up your romance package and nothing more — your privacy " +
          "always comes first. You can revoke this consent at any time by letting us know here",
        inline: false,
      }
    )
    .setFooter({ text: "Lifeline Island Paradise • Tammy at the Front Desk 🛎️💕" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PREFIX}:consent:${guestId}`)
      .setLabel("I Consent")
      .setEmoji("💗")
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
    try {
      if (db && db.isReady()) {
        await db.query(
          `CREATE TABLE IF NOT EXISTS service_consents (
             id BIGSERIAL PRIMARY KEY, service TEXT NOT NULL, guest_id TEXT NOT NULL,
             channel_id TEXT, consent_given BOOLEAN NOT NULL, consent_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
             UNIQUE (service, guest_id, channel_id)
           )`
        );
        await db.query(
          `INSERT INTO service_consents (service, guest_id, channel_id, consent_given)
           VALUES ('romance_setup', $1, $2, TRUE)
           ON CONFLICT (service, guest_id, channel_id) DO UPDATE SET consent_given = TRUE, consent_timestamp = now()`,
          [guestId, interaction.channelId]
        );
        console.log(`Romance setup consent logged for guest ${guestId} in ${interaction.channelId}`);
      }
    } catch (error) {
      console.log("Consent database log failed (continuing with Discord message):", error.message);
    }

    const embed = new EmbedBuilder()
      .setColor(0x70D6A7)
      .setTitle("💗 Consent Received — Let the Romance Begin!")
      .setDescription(
        "Thank you, lovely! Our crew will now slip in and transform your cabin into something " +
        "absolutely magical. We'll be quick, careful, and gone before you know it 🌹✨"
      )
      .addFields(
        { name: "📅 Consent Date", value: new Date().toLocaleDateString(), inline: true },
        { name: "🏠 Service", value: "Cabin Romance Setup", inline: true }
      )
      .setFooter({ text: "Lifeline Island Paradise • Tammy at the Front Desk 🛎️💕" })
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
    return true;
  }

  return false;
}

module.exports = { consentEmbed, handle };
