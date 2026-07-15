const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
} = require("discord.js");

const PREFIX = "package_location";

function locationEmbed(guestId, packageName, scheduledTime) {
  const embed = new EmbedBuilder()
    .setColor(0xFFB347)
    .setTitle("🌴 Your Paradise Package is Scheduled for Today! 🌴")
    .setDescription(
      `Hey there, sweetie! 💕 Just a friendly reminder that your **${packageName}** is scheduled for **today** at **${scheduledTime}**! 🎉\n\n` +
      `We just need one quick thing from you — would you like this experience set up **onboard** (inside your cabin on the ship) ` +
      `or **offboard** (at our Tulum destination)?\n\n` +
      `Please use the dropdown below to let us know your preference 💙`
    )
    .addFields(
      {
        name: "🛳️ Onboard (In Cabin)",
        value: "We set everything up right in your cabin F03 — cozy, private, and convenient. No need to go anywhere!",
        inline: true,
      },
      {
        name: "🏝️ Offboard (At Tulum)",
        value: "We set up the experience at our Tulum destination — right where all the sunshine and adventure is!",
        inline: true,
      }
    )
    .setFooter({ text: "Lifeline Island Paradise • Tammy at the Front Desk 🛎️💕" })
    .setTimestamp();

  const select = new StringSelectMenuBuilder()
    .setCustomId(`${PREFIX}:choose:${guestId}`)
    .setPlaceholder("Choose onboard or offboard...")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("🛳️ Onboard — In my cabin")
        .setDescription("Set up the experience inside my cabin F03")
        .setValue("onboard"),
      new StringSelectMenuOptionBuilder()
        .setLabel("🏝️ Offboard — At Tulum destination")
        .setDescription("Set up the experience at the Tulum beach area")
        .setValue("offboard")
    );

  const row = new ActionRowBuilder().addComponents(select);

  return { content: `<@${guestId}>`, embeds: [embed], components: [row] };
}

async function handle(interaction, db) {
  if (!interaction.customId?.startsWith(`${PREFIX}:`)) return false;

  const [prefix, action, guestId] = interaction.customId.split(":");
  if (prefix !== PREFIX) return false;

  if (interaction.user.id !== guestId) {
    await interaction.reply({ content: "This preference form belongs to the guest named in this booking ticket 💙", flags: 64 });
    return true;
  }

  if (action === "choose" && interaction.isStringSelectMenu()) {
    const choice = interaction.values[0];
    const label = choice === "onboard" ? "🛳️ Onboard (Cabin F03)" : "🏝️ Offboard (Tulum)";

    // Log to database
    try {
      if (db && db.isReady()) {
        await db.query(
          `CREATE TABLE IF NOT EXISTS package_location_preferences (
             id BIGSERIAL PRIMARY KEY, booking_channel_id TEXT NOT NULL,
             guest_id TEXT NOT NULL, package_name TEXT, choice TEXT NOT NULL,
             created_at TIMESTAMPTZ NOT NULL DEFAULT now()
           )`
        );
        await db.query(
          `INSERT INTO package_location_preferences (booking_channel_id, guest_id, choice)
           VALUES ($1, $2, $3)`,
          [interaction.channelId, guestId, choice]
        );
        console.log(`Package location preference saved: ${choice} for guest ${guestId} in ${interaction.channelId}`);
      }
    } catch (error) {
      console.log("Package location DB log failed (continuing):", error.message);
    }

    const embed = new EmbedBuilder()
      .setColor(0x70D6A7)
      .setTitle("✅ Preference Received! 💕")
      .setDescription(
        `Wonderful! You've chosen **${label}** for your Paradise Package today 🎉\n\n` +
        `Our crew has been notified and will get everything set up for you. ` +
        (choice === "onboard"
          ? "Just relax in your cabin and we'll take care of the rest!"
          : "Head on over to Tulum when you're ready — we'll have everything waiting for you!") +
        `\n\nIf anything changes, just let us know right here 💙`
      )
      .setFooter({ text: "Lifeline Island Paradise • Tammy at the Front Desk 🛎️💕" })
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

module.exports = { locationEmbed, handle };
