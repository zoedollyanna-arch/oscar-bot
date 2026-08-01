/* One-shot: post a cute reminder embed to the Travelers channel as Tammy.
 * If the terminal won't let you request an extension, ask in your booking ticket.
 * Run: node send-extension-reminder.js */
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const channelId = "1522402414949302323"; // #travelers
const roleId = "1522402829199868004";     // Travelers role

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) { console.error("Channel not found"); process.exit(1); }

    const embed = new EmbedBuilder()
      .setColor(0xF5A9D0)
      .setTitle("🌸 Need More Time Aboard? We've Got You! 🛳️💕")
      .setDescription(
        "**Cruise Director Tammy here** 🎀✨\n\n" +
        "If you're loving your stay and want to **extend your voyage**, just head to the **terminal** and request an extension there first! 🖥️💗"
      )
      .addFields(
        {
          name: "😔 Terminal Not Cooperating?",
          value:
            "No worries at all, sweetie! If you're **unable to request an extension from the terminal**, " +
            "please **request it in your booking ticket** instead 🎟️💌\n" +
            "Our team will get it sorted for you right away! 🌷",
          inline: false
        },
        {
          name: "💡 Quick Tip",
          value: "Pop your request in **as early as you can** so we can keep your cabin reserved just for you 🛏️✨",
          inline: false
        }
      )
      .setFooter({ text: "With love, Cruise Director Tammy • Lifeline Island Paradise 💖" })
      .setTimestamp();

    await channel.send({ content: `<@&${roleId}>`, embeds: [embed] });
    console.log("✅ Message sent successfully");
    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error("Error sending message:", error);
    await client.destroy();
    process.exit(1);
  }
});

if (!token) { console.error("DISCORD_TOKEN is missing from .env"); process.exit(1); }
client.login(token).catch((error) => { console.error("Login failed:", error.message); process.exit(1); });
