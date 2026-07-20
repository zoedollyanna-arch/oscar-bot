const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const channelId = "1525981661823762674";
const guestId = "890330032139026493";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      throw new Error("Booking ticket channel was not found or is not text-based");
    }

    const embed = new EmbedBuilder()
      .setColor(0xFFB6C1)
      .setTitle("🎯 Scavenger Hunt Setup Update 🎯")
      .setDescription(
        "Hello sweetie We wanted to let you know that we need just a little extra time to set up your scavenger hunt game for the Kids Cruise Fun Pack in Tulum We appreciate your patience and understanding 💕"
      )
      .addFields(
        {
          name: "⏰ Additional Time Needed",
          value: "15 minutes",
          inline: true
        },
        {
          name: "🎁 Your Paradise Package",
          value: "Kids Cruise Fun Pack in Tulum",
          inline: true
        },
        {
          name: "📍 Direct Landmark",
          value: "You will receive a direct landmark for your Kids Cruise Fun Pack experience in Tulum once setup is complete",
          inline: false
        },
        {
          name: "💕 Thank You",
          value: "We are working hard to make sure everything is perfect for your family adventure Your scavenger hunt will be ready very soon",
          inline: false
        }
      )
      .setFooter({ text: "Lifeline Island Paradise • Almost ready for your fun 🛳️🎯" })
      .setTimestamp();

    await channel.send({ 
      content: `<@${guestId}>`,
      embeds: [embed],
      allowedMentions: { users: [guestId] }
    });
    console.log(`Scavenger hunt delay message sent to booking ticket ${channelId}`);
  } catch (error) {
    console.error("Error sending scavenger hunt delay message:", error);
    process.exitCode = 1;
  } finally {
    await client.destroy();
  }
});

if (!token) {
  console.error("DISCORD_TOKEN is missing from .env");
  process.exit(1);
}

client.login(token).catch((error) => {
  console.error("Login failed:", error.message);
  process.exit(1);
});
