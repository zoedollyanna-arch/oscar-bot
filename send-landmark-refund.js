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
      .setColor(0x70D6A7)
      .setTitle("🎯 Kids Cruise Fun Pack Ready 🎯")
      .setDescription(
        "Wonderful news sweetie Your Kids Cruise Fun Pack is now ready for you in Tulum We apologize for the delay and truly appreciate your patience 💕"
      )
      .addFields(
        {
          name: "📍 Direct Landmark",
          value: "[Click here to teleport to your Kids Cruise Fun Pack](http://maps.secondlife.com/secondlife/Ethereal%20Paradise/148/145/22)",
          inline: false
        },
        {
          name: "🎮 How to Start",
          value: "Click the reserved board to begin your scavenger hunt adventure",
          inline: false
        },
        {
          name: "💰 Refund Applied",
          value: "We have refunded L$350 for this package since we went over the scheduled time frame",
          inline: true
        },
        {
          name: "🎁 Package Details",
          value: "Kids Cruise Fun Pack in Tulum",
          inline: true
        },
        {
          name: "💕 Enjoy Your Experience",
          value: "Have a wonderful time with your scavenger hunt Please let us know if you need anything else",
          inline: false
        }
      )
      .setFooter({ text: "Lifeline Island Paradise • Your adventure awaits 🛳️🎯" })
      .setTimestamp();

    await channel.send({ 
      content: `<@${guestId}>`,
      embeds: [embed],
      allowedMentions: { users: [guestId] }
    });
    console.log(`Landmark and refund message sent to booking ticket ${channelId}`);
  } catch (error) {
    console.error("Error sending landmark and refund message:", error);
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
