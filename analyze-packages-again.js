const { Client, GatewayIntentBits } = require("discord.js");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const channelId = "1525991306730410055";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      throw new Error("Booking ticket channel was not found or is not text-based");
    }

    // Fetch recent messages to see package status
    const messages = await channel.messages.fetch({ limit: 30 });
    console.log(`Fetched ${messages.size} messages from booking ticket`);
    
    // Look for package-related messages
    messages.forEach(msg => {
      if (msg.embeds.length > 0) {
        msg.embeds.forEach((embed, i) => {
          if (embed.title && (embed.title.includes("Package") || embed.title.includes("Mystery") || embed.title.includes("Sunset"))) {
            console.log(`\n--- Package Message ID: ${msg.id} ---`);
            console.log(`Title: ${embed.title}`);
            console.log(`Description: ${embed.description}`);
            if (embed.fields.length > 0) {
              embed.fields.forEach(field => {
                console.log(`Field: ${field.name} = ${field.value}`);
              });
            }
          }
        });
      }
    });

    // Check specific message IDs mentioned
    const msg1 = await channel.messages.fetch("1526737617876553760").catch(() => null);
    const msg2 = await channel.messages.fetch("1526738133629272176").catch(() => null);
    
    console.log("\n--- Specific Message 1526737617876553760 ---");
    if (msg1) {
      console.log(`Content: ${msg1.content}`);
      if (msg1.embeds.length > 0) {
        msg1.embeds.forEach(embed => {
          console.log(`Title: ${embed.title}`);
          console.log(`Description: ${embed.description}`);
          embed.fields.forEach(field => {
            console.log(`Field: ${field.name} = ${field.value}`);
          });
        });
      }
    } else {
      console.log("Message not found");
    }

    console.log("\n--- Specific Message 1526738133629272176 ---");
    if (msg2) {
      console.log(`Content: ${msg2.content}`);
      if (msg2.embeds.length > 0) {
        msg2.embeds.forEach(embed => {
          console.log(`Title: ${embed.title}`);
          console.log(`Description: ${embed.description}`);
          embed.fields.forEach(field => {
            console.log(`Field: ${field.name} = ${field.value}`);
          });
        });
      }
    } else {
      console.log("Message not found");
    }

  } catch (error) {
    console.error("Error analyzing booking ticket:", error);
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
