const { Client, GatewayIntentBits } = require("discord.js");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const messageId = "1527462221720977500";
const channelId = "1527453773302206635";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.error("Channel not found");
      process.exit(1);
    }

    const targetMessage = await channel.messages.fetch(messageId);
    if (!targetMessage) {
      console.error("Message not found");
      process.exit(1);
    }

    const replyText = "Sorry for the delayed response. We updated your check-in time to 5 SLT. Thanks for your patience.";

    await targetMessage.reply(replyText);

    console.log("Reply sent successfully");
    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error("Error sending reply:", error);
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
