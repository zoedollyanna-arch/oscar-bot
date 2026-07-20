const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const channelId = "1525850189414531120";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      throw new Error("Booking ticket channel was not found or is not text-based");
    }

    const embed = new EmbedBuilder()
      .setColor(0x70D6A7)
      .setTitle("🌴 Your Paradise Package Family Beach Day is Ready! 🏖️")
      .setDescription(
        "Hey there! 💙 Your **Paradise Package Family Beach Day** is all set up and ready for you! We sincerely apologize for the wait — thank you so much for your patience."
      )
      .addFields(
        {
          name: "📍 Your Landmark",
          value: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/139/75/21",
          inline: false
        },
        {
          name: "🎁 Special Offer",
          value: "As a thank you for your patience, we'd like to offer you a **free photo session** — our crew will take photos and edit them beautifully for you to keep! 📸✨",
          inline: false
        },
        {
          name: "🎮 Additional Options",
          value: "Feel free to request any additional games or accommodations you'd like — we're happy to customize your experience!",
          inline: false
        },
        {
          name: "🙋 Current Status",
          value: "I'm here now getting your reserved board set up! Everything is being prepared for your arrival.",
          inline: false
        },
        {
          name: "⏰ Package Validity",
          value: "Your Paradise Package is valid for **24 hours** from now, so you have plenty of time to enjoy everything!",
          inline: false
        },
        {
          name: "📦 Parcel Option",
          value: "If you'd prefer, we can request this area to be parcelled off for privacy — just let us know!",
          inline: false
        }
      )
      .setFooter({ text: "Lifeline Island Paradise • Your family adventure awaits! 🛳️💕" })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    console.log(`Paradise package message sent to booking ticket ${channelId}`);
  } catch (error) {
    console.error("Error sending paradise package message:", error);
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
