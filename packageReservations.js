const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const PREFIX = "package_reservation";

const PACKAGES = {
  detective: { emoji: "🕵️", name: "Family Detective Crew", short: "Family mystery, clue hunt, titles, photo stop, and prize" },
  kids: { emoji: "🧸", name: "Kids Cruise Fun Pack", short: "Toys, coloring activities, snacks, scavenger hunt, and prize" },
  photos: { emoji: "📸", name: "Family Photo Memories", short: "Three to five photo spots, poses, memory notecard, and crew help" },
  date: { emoji: "🔎", name: "Mystery Date Night", short: "Couples mystery, reserved start, detective notecard, and prize" },
  bungalow: { emoji: "🛖", name: "Bungalow Romantic Escape", short: "Private bungalow, petals, drinks, dessert, poses, and reserved time" },
};

const DESTINATIONS =
  "🇲🇽 Tulum, Mexico — July 14 at 2 PM SLT\n" +
  "🌺 Bali — July 16\n" +
  "🇯🇲 Jamaica — July 20\n" +
  "🏝️ Barbados — July 23\n" +
  "🌊 Aruba — July 27\n" +
  "🇵🇷 Puerto Rico — July 30";

function confirmationMessage(guestId) {
  const summary = Object.values(PACKAGES)
    .map((pkg) => `${pkg.emoji} **${pkg.name}** — ${pkg.short}`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(0x70D6A7)
    .setTitle("✅💖 Payment Approved — All Five Packages Confirmed 💖✅")
    .setDescription(
      "Wonderful news! Your **L$2,600 payment has been received and approved**, and all five Paradise Package reservations are officially confirmed 🌴✨\n\n" +
      "Use the buttons below to submit the preferred date, time, and destination for each experience. You can schedule every package separately so each one fits your family’s voyage plans perfectly 🗓️💕"
    )
    .addFields(
      { name: "🎁 Your Five Confirmed Experiences", value: summary, inline: false },
      { name: "🛳️ Destination Schedule", value: DESTINATIONS, inline: false },
      {
        name: "📝 Schedule Each Package",
        value: "Select each package button and complete its short reservation form. Our crew will review every preference and coordinate the final details with you in this booking ticket 💙",
        inline: false,
      }
    )
    .setFooter({ text: "Lifeline Island Paradise • Your family adventures are officially reserved 🛳️🌸" })
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
    await interaction.reply({ content: "This reservation form belongs to the guest named in this booking ticket 💙", flags: 64 });
    return true;
  }

  const pkg = PACKAGES[packageKey];

  if (action === "open" && interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(`${PREFIX}:submit:${packageKey}:${guestId}`)
      .setTitle(`${pkg.name} Reservation`.slice(0, 45));

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

module.exports = { confirmationMessage, handle };
