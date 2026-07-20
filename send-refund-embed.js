const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const channelId = "1525771447463841833";
const userId = "1287507883944186012";

const description = `Hi! 👋

Thanks for your patience while we looked into this. We've confirmed the duplicate purchase of the **[Lifeline RP] Player Reusable Stat Scripts** on your account. ✅

📦 **Order #:** 1665969824
📅 **Date:** July 12, 2026
💸 **Refund:** L$500 (issued)

Your refund has been sent in-world — please allow a few minutes for it to arrive if you don't see it right away. You'll keep your working copy of the Stat Scripts, so there's nothing you need to redeliver or re-buy. 🎉

If there's anything else we can help with, just reply here and we'll be happy to assist. Thanks for being part of Lifeline RP! 💖`;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const embed = new EmbedBuilder()
    .setTitle("💖 Refund Confirmed")
    .setDescription(description)
    .setColor(0xff8fc7)
    .setFooter({ text: "Lifeline RP Support" })
    .setTimestamp();

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.error(`Could not fetch channel ${channelId}`);
      process.exit(1);
    }
    await channel.send({
      content: `<@${userId}>`,
      embeds: [embed],
      allowedMentions: { users: [userId] }
    });
    console.log(`Sent refund embed to channel ${channelId}, pinged ${userId}`);
  } catch (error) {
    console.error(`Error sending message:`, error.message);
  }

  await client.destroy();
  process.exit(0);
});

client.login(token).catch((error) => {
  console.error("Discord login failed:", error.message);
  process.exit(1);
});
