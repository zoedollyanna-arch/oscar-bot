const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const channelId = "1525981661823762674";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      throw new Error("Booking ticket channel was not found or is not text-based");
    }

    const embed = new EmbedBuilder()
      .setColor(0x66C7F2)
      .setTitle("💙 Onboard Family Activity Packages 💙")
      .setDescription(
        "Absolutely! Both are onboard family activity packages, and **yes, you can request multiple packages**. You may purchase either package individually or both for the complete experience ✨"
      )
      .addFields(
        {
          name: "🕵️ Family Detective Crew — L$500",
          value:
            "Your family solves a ship mystery together using a guided clue hunt 🔎\n\n" +
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
            "A relaxed activity-and-gift package designed especially for the children 🎨\n\n" +
            "• A plushie or toy for each child\n" +
            "• Coloring and activity notecard\n" +
            "• Snack box\n" +
            "• Cruise scavenger hunt\n" +
            "• A mini completion prize",
          inline: false
        },
        {
          name: "🌟 Choosing Your Experience",
          value:
            "The **Detective Crew** is best when the whole family wants an interactive mystery experience together. The **Kids Cruise Fun Pack** is perfect for toys, crafts, snacks, and a child-focused scavenger hunt.",
          inline: false
        },
        {
          name: "💳 Payment and Scheduling",
          value:
            "Each package is one direct payment to **zoedollyanna Resident** in Second Life. Once payment is received and approved, our crew will coordinate your preferred date and time with you right here in your booking ticket 🌴",
          inline: false
        }
      )
      .setFooter({ text: "Lifeline Island Paradise • Family fun awaits 🛳️💕" })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    console.log(`Family packages embed sent to booking ticket ${channelId}`);
  } catch (error) {
    console.error("Error sending family packages embed:", error);
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
