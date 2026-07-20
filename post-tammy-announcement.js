const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const channelId = "1428520362525855914";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.error("Channel not found");
      process.exit(1);
    }

    const embed = new EmbedBuilder()
      .setColor(0xF5A9D0)
      .setTitle("🌴 Hello, everyone!")
      .setDescription(
        "Discord is our primary hub for communication. To help us keep accurate records and provide faster support, please post all questions, comments, concerns, and requests in the appropriate Discord channels or our in-world group. Messages sent elsewhere may be missed, so using the correct channel helps us assist you more efficiently."
      )
      .addFields(
        {
          name: "🚢 Coming Tonight",
          value: "✨ Exciting new features\n🛠️ Small bug fixes, including a fix for ZPhone Orders",
          inline: false
        },
        {
          name: "💕 Thank You",
          value: "Thank you all for your patience and continued support as we improve the Lifeline experience!",
          inline: false
        },
        {
          name: "🏝️ Looking for a cabin?",
          value: "Be sure to visit the 📅 Bookings & Reservations channel to view the latest cabin availability for the Lifeline Island Paradise Cruise. We can't wait to welcome you aboard! 🌊",
          inline: false
        }
      )
      .setFooter({ text: "With love, Tammy • Lifeline Island Paradise 💖" })
      .setTimestamp();

    await channel.send({
      embeds: [embed]
    });

    console.log("Message sent successfully");
    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error("Error sending message:", error);
    await client.destroy();
    process.exit(1);
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
