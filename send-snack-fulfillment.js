const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const channelId = "1525957535448961174";
const guestId = "1486017357041242263";

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
      .setTitle("🍿✨ Snacks & Drinks Request Fulfilled ✨🍹")
      .setDescription(
        "Wonderful news, sweetie Your snacks and drinks request has been completed and everything is now set up in your cabin C04 Enjoy all your treats 💕"
      )
      .addFields(
        {
          name: "🎁 Items Added to Your Cabin",
          value: 
            "🧀 Cheez It Basket\n" +
            "🍫 S'mores Tray\n" +
            "🥤 Milkshake Dispenser\n" +
            "🍹 Cocktail Cart\n" +
            "🛒 Snack Cart\n" +
            "🍪 Cookie Dispenser",
          inline: false
        },
        {
          name: "🏠 Service Location",
          value: "Cabin C04",
          inline: true
        },
        {
          name: "📅 Service Date",
          value: new Date().toLocaleDateString(),
          inline: true
        },
        {
          name: "💕 Enjoy Your Treats",
          value: "Everything is ready for you to indulge in your snacks and drinks Have a wonderful time enjoying all the refreshments in your cabin",
          inline: false
        }
      )
      .setFooter({ text: "Lifeline Island Paradise • Service completed with love 🛳️💕" })
      .setTimestamp();

    await channel.send({ 
      content: `<@${guestId}>`,
      embeds: [embed],
      allowedMentions: { users: [guestId] }
    });
    console.log(`Snack fulfillment message sent to booking ticket ${channelId}`);
  } catch (error) {
    console.error("Error sending snack fulfillment message:", error);
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
