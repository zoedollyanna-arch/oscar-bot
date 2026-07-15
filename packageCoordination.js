const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const PREFIX = "package_coordination";

const PACKAGES = {
  mystery: { 
    emoji: "🔎", 
    name: "Mystery Date Night", 
    price: "L$450",
    short: "Couple detective card, reserved mystery start time, Date Night Detective Duo notecard, and small couples prize" 
  },
  sunset: { 
    emoji: "🧺", 
    name: "Sunset Picnic", 
    price: "L$800",
    short: "Beach blanket and picnic basket, drinks, lanterns, couple photo spot, and optional sunset fireworks" 
  },
};

const DESTINATIONS =
  "🇲🇽 Tulum, Mexico — July 14 at 2 PM SLT\n" +
  "🌺 Bali — July 16\n" +
  "🇯🇲 Jamaica — July 20\n" +
  "🏝️ Barbados — July 23\n" +
  "🌊 Aruba — July 27\n" +
  "🇵🇷 Puerto Rico — July 30";

function coordinationMessage(guestId) {
  const summary = Object.values(PACKAGES)
    .map((pkg) => `${pkg.emoji} **${pkg.name}** (${pkg.price}) — ${pkg.short}`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(0xFFB6C1)
    .setTitle("🌸 Your Package Scheduling Coordination 🌸")
    .setDescription(
      "Wonderful news, sweetie Both of your packages have been paid and approved Now lets schedule your perfect experiences Use the buttons below to submit your preferred date, time, and destination for each package Our crew will review every preference and coordinate the final details with you right here in your booking ticket 💕"
    )
    .addFields(
      { name: "🎁 Your Confirmed Packages", value: summary, inline: false },
      { name: "🛳️ Destination Schedule", value: DESTINATIONS, inline: false },
      {
        name: "📝 Schedule Each Package",
        value: "Select each package button and complete its short scheduling form. Our crew will review every preference and coordinate the final details with you in this booking ticket 💙",
        inline: false,
      }
    )
    .setFooter({ text: "Lifeline Island Paradise • Your romantic adventures await 🛳️💕" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    Object.entries(PACKAGES).map(([key, pkg]) =>
      new ButtonBuilder()
        .setCustomId(`${PREFIX}:open:${key}:${guestId}`)
        .setLabel(pkg.name)
        .setEmoji(pkg.emoji)
        .setStyle(ButtonStyle.Primary)
    )
  );

  return { content: `<@${guestId}>`, embeds: [embed], components: [row] };
}

async function handle(interaction) {
  if (!interaction.customId?.startsWith(`${PREFIX}:`)) return false;

  const [prefix, action, packageKey, guestId] = interaction.customId.split(":");
  if (prefix !== PREFIX || !PACKAGES[packageKey]) return false;

  if (interaction.user.id !== guestId) {
    await interaction.reply({ content: "This scheduling form belongs to the guest named in this booking ticket 💙", flags: 64 });
    return true;
  }

  const pkg = PACKAGES[packageKey];

  if (action === "open" && interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(`${PREFIX}:submit:${packageKey}:${guestId}`)
      .setTitle(`${pkg.name} Scheduling`.slice(0, 45));

    const date = new TextInputBuilder()
      .setCustomId("preferred_date")
      .setLabel("Preferred date")
      .setPlaceholder("Example: July 16, 2026")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const time = new TextInputBuilder()
      .setCustomId("preferred_time")
      .setLabel("Preferred time in SLT")
      .setPlaceholder("Example: 6:00 PM SLT")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const destination = new TextInputBuilder()
      .setCustomId("preferred_destination")
      .setLabel("Preferred cruise destination")
      .setPlaceholder("Tulum, Bali, Jamaica, Barbados, Aruba, or Puerto Rico")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(date),
      new ActionRowBuilder().addComponents(time),
      new ActionRowBuilder().addComponents(destination)
    );

    await interaction.showModal(modal);
    return true;
  }

  if (action === "submit" && interaction.isModalSubmit()) {
    const date = interaction.fields.getTextInputValue("preferred_date").trim();
    const time = interaction.fields.getTextInputValue("preferred_time").trim();
    const destination = interaction.fields.getTextInputValue("preferred_destination").trim();

    // Save to backend
    try {
      const config = require("./config");
      if (config.BACKEND_URL) {
        await fetch(`${config.BACKEND_URL}/api/tammy/package/schedule`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(config.BACKEND_SECRET ? { "x-tammy-secret": config.BACKEND_SECRET } : {}),
          },
          body: JSON.stringify({
            booking_id: interaction.channelId,
            package_key: packageKey,
            guest_id: guestId,
            preferred_date: date,
            preferred_time: time,
            preferred_destination: destination,
          }),
          signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
        });
        console.log(`Package scheduling saved to backend for ${packageKey}`);
      }
    } catch (error) {
      console.log("Backend save failed (continuing with Discord message):", error.message);
    }

    const embed = new EmbedBuilder()
      .setColor(0xF4A6D7)
      .setTitle(`${pkg.emoji} ${pkg.name} Preference Received`)
      .setDescription("Your scheduling preference has been saved in the booking ticket for our crew to review 💕")
      .addFields(
        { name: "🗓️ Preferred Date", value: date, inline: true },
        { name: "🕐 Preferred Time", value: time, inline: true },
        { name: "🌴 Preferred Destination", value: destination, inline: false }
      )
      .setFooter({ text: "Our crew will coordinate and confirm the final reservation details with you 💙" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    return true;
  }

  return false;
}

module.exports = { coordinationMessage, handle };
