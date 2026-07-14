const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const channelId = "1522402414949302323";
const roleId = "1522402829199868004";

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
      .setTitle("🌸 Hello, Lifeline Travelers 🌸")
      .setDescription(
        "**Cruise Director Tammy here** 🛳️💕\n\n" +
        "I hope you enjoyed karaoke night or had a chance to complete some fun challenges with your family 🎤✨👨‍👩‍👧‍👦\n\n" +
        "Just a sweet reminder that I am always available to assist you at the front desk 🛎️ Please reach out if you need help locating your cabin, retrieving items left behind, replacing a missing appliance or TV, or receiving your Island Paradise HUD 🌴💙"
      )
      .addFields(
        {
          name: "🗓️ Our Voyage Update",
          value: "Our voyage has been rescheduled for **tomorrow**. We want every traveler to remain comfortable and cozy during their stay 🧸☁️",
          inline: false
        },
        {
          name: "🏡 Free Accommodations",
          value: "Request accommodations **for free directly from your Island Paradise HUD** ✨",
          inline: false
        },
        {
          name: "🍼 For Babies",
          value: "Starries playpens and bouncers are available for our littlest travelers 🌟",
          inline: true
        },
        {
          name: "🛏️ Extra Sleeping Space",
          value: "Bunk beds and air mattresses are available for guests who need additional sleeping space 🌙",
          inline: true
        }
      )
      .setFooter({ text: "With love, Cruise Director Tammy • Lifeline Island Paradise 💖" })
      .setTimestamp();

    await channel.send({
      content: `<@&${roleId}>`,
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
