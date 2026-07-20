const { Client, GatewayIntentBits } = require("discord.js");

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

    // Fetch recent messages to find Discord user ID
    const messages = await channel.messages.fetch({ limit: 10 });
    console.log(`Fetched ${messages.size} messages from booking ticket`);
    
    messages.forEach(msg => {
      if (!msg.author.bot) {
        console.log(`Author: ${msg.author.tag} (ID: ${msg.author.id})`);
      }
    });

  } catch (error) {
    console.error("Error:", error);
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
