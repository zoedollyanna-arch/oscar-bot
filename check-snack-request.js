const { Client, GatewayIntentBits } = require("discord.js");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const channelId = "1525957535448961174";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      throw new Error("Booking ticket channel was not found or is not text-based");
    }

    // Fetch recent messages to see snack/drink request
    const messages = await channel.messages.fetch({ limit: 20 });
    console.log(`Fetched ${messages.size} messages from booking ticket`);
    
    messages.forEach(msg => {
      console.log(`\n--- Message ID: ${msg.id} ---`);
      console.log(`Author: ${msg.author.tag}`);
      console.log(`Content: ${msg.content}`);
      if (msg.embeds.length > 0) {
        msg.embeds.forEach((embed, i) => {
          console.log(`\nEmbed ${i + 1}:`);
          console.log(`Title: ${embed.title}`);
          console.log(`Description: ${embed.description}`);
          if (embed.fields.length > 0) {
            embed.fields.forEach(field => {
              console.log(`Field: ${field.name} = ${field.value}`);
            });
          }
        });
      }
    });

  } catch (error) {
    console.error("Error checking booking ticket:", error);
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
