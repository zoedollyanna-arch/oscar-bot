/* One-shot: post a cute update embed to the Travelers channel as Tammy.
 * Apology + calendar update coming + Scary Movie 6 tonight + Deck 1 opens tomorrow.
 * Run: node send-travelers-update.js */
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
      .setTitle("🌸 A Little Update from Tammy 🌸")
      .setDescription(
        "**Cruise Director Tammy here** 🛳️💕\n\n" +
        "First things first — **we're so sorry for the inconvenience!** 🙈 " +
        "A few of our voyage dates have shifted, and we want everything to be *just right* before we share it with you 🗓️✨\n\n" +
        "We'll be posting the **updated Cruise Voyage Calendar very soon** — so keep an eye on this channel! " +
        "**Thank you so much for your patience** — it truly means the world to us 💖🌴"
      )
      .addFields(
        {
          name: "🎬 Movie Night — Tonight!",
          value: "**Scary Movie 6** is playing in the **Cruise Theater** tonight at **7:00 PM SLT** 🍿👻\nGrab a seat, dim the lights, and enjoy the show!",
          inline: false
        },
        {
          name: "🚪 Deck 1 Grand Opening",
          value: "**Deck 1 officially opens tomorrow!** 🎉 Come explore all the new spaces waiting for you aboard the ship 🛳️✨",
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
