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
      .setColor(0xF4A6D7)
      .setTitle("🌴✨ Your Paradise Package Summary ✨🌴")
      .setDescription(
        "Hi there 💙 We have received all **five** of your package requests. Here is a complete summary of your selections and everything included."
      )
      .addFields(
        {
          name: "🕵️ Family Detective Crew — L$500",
          value:
            "• Family detective badge and notecard\n" +
            "• Group clue-hunt guide\n" +
            "• Junior Detective titles for the children\n" +
            "• Family photo stop after solving the case\n" +
            "• A small prize or gift at the end",
          inline: false
        },
        {
          name: "🧸 Kids Cruise Fun Pack — L$350",
          value:
            "• A plushie or toy for each child\n" +
            "• Coloring and activity notecard\n" +
            "• Snack box\n" +
            "• Cruise scavenger hunt\n" +
            "• A mini completion prize",
          inline: false
        },
        {
          name: "📸 Family Photo Memories — L$300",
          value:
            "• Three to five cute photo spots around the ship\n" +
            "• Pose balls or pose stand\n" +
            "• Cruise Memories notecard\n" +
            "• Crew assistance finding the cutest angles",
          inline: false
        },
        {
          name: "🔎 Mystery Date Night — L$450",
          value:
            "• Couple detective card\n" +
            "• Reserved mystery start time\n" +
            "• Date Night Detective Duo notecard\n" +
            "• A small couples prize after finishing",
          inline: false
        },
        {
          name: "🛖 Bungalow Romantic Escape — L$1,000",
          value:
            "• Private bungalow or cabana\n" +
            "• Rose petals\n" +
            "• Drinks\n" +
            "• Dessert tray\n" +
            "• Cuddle poses\n" +
            "• Thirty to sixty minutes of reserved time",
          inline: false
        },
        {
          name: "💖 Total Due — L$2,600",
          value:
            "Please send one direct payment of **L$2,600** to **zoedollyanna Resident** in Second Life. Once your payment is received and approved, our crew will coordinate your preferred **time, date, and destination** with you right here in your booking ticket 🗓️🌎✨",
          inline: false
        }
      )
      .setFooter({ text: "Lifeline Island Paradise • We cannot wait to create these memories with you 🛳️💕" })
      .setTimestamp();

    await channel.send({
      content: `<@${guestId}>`,
      embeds: [embed]
    });

    console.log(`Package total embed sent to booking ticket ${channelId}`);
  } catch (error) {
    console.error("Error sending package total embed:", error);
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
