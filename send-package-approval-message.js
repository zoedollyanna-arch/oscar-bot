const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const channelId = "1526375803078574241";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

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
      .setTitle("🕵️✨ Your Family Detective Crew Package is Approved!")
      .setDescription(
        "Wonderful news, lovely! Your **Family Detective Crew** package has been paid for and officially approved! 🎉💕"
      )
      .addFields(
        {
          name: "🎁 Package Details",
          value: "**Family Detective Crew** — L$500\n\n✨ What's included:\n• Family detective badge & notecard\n• Group clue hunt guide\n• Junior Detective title for the kids\n• Family photo stop after solving the case\n• Small prize/gift at the end",
          inline: false
        },
        {
          name: "📅 Let's Schedule Your Adventure!",
          value: "I'm so excited to help coordinate this fun mystery experience for your family! Please let me know:\n\n🗓️ **What day** would you like this adventure?\n🕐 **What time** works best for you?\n🗺️ **Which destination** would you prefer? (onboard ship or one of our island ports)",
          inline: false
        },
        {
          name: "💙",
          value: "Just reply right here in your ticket with your preferred details and I'll get everything arranged for you! Can't wait to see your family solve the mystery together! 🕵️‍♀️✨",
          inline: false
        }
      )
      .setFooter({ text: "With love, Tammy • Lifeline Island Paradise Front Desk 🛎️💖" })
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
