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

    // Fetch recent messages to analyze package details
    const messages = await channel.messages.fetch({ limit: 50 });
    console.log(`Fetched ${messages.size} messages from booking ticket`);
    
    console.log("\n=== PACKAGE ANALYSIS ===\n");
    
    let hasOnboardPackage = false;
    let hasDestinationPackage = false;
    let packageDetails = [];

    messages.forEach(msg => {
      if (msg.embeds.length > 0) {
        msg.embeds.forEach((embed, i) => {
          const title = embed.title || "";
          const description = embed.description || "";
          
          // Look for package-related messages
          if (title.includes("Package") || title.includes("Mystery") || title.includes("Sunset") || 
              title.includes("Family") || title.includes("Detective") || title.includes("Kids") ||
              description.includes("Package") || description.includes("package")) {
            
            console.log(`--- Message ID: ${msg.id} ---`);
            console.log(`Title: ${title}`);
            console.log(`Description: ${description.substring(0, 200)}...`);
            
            if (embed.fields.length > 0) {
              embed.fields.forEach(field => {
                console.log(`Field: ${field.name} = ${field.value.substring(0, 150)}`);
                
                // Check for onboard vs destination indicators
                const fieldText = field.value.toLowerCase();
                if (fieldText.includes("onboard") || fieldText.includes("cabin") || fieldText.includes("room service")) {
                  hasOnboardPackage = true;
                }
                if (fieldText.includes("destination") || fieldText.includes("tulum") || fieldText.includes("bali") || 
                    fieldText.includes("jamaica") || fieldText.includes("barbados") || fieldText.includes("aruba")) {
                  hasDestinationPackage = true;
                }
              });
            }
            
            packageDetails.push({
              messageId: msg.id,
              title: title,
              description: description,
              isOnboard: hasOnboardPackage,
              isDestination: hasDestinationPackage
            });
            
            console.log();
          }
        });
      }
      
      // Also check message content for package mentions
      if (msg.content && (msg.content.toLowerCase().includes("package") || 
                          msg.content.toLowerCase().includes("mystery") || 
                          msg.content.toLowerCase().includes("sunset"))) {
        console.log(`--- Content Message ID: ${msg.id} ---`);
        console.log(`Author: ${msg.author.tag}`);
        console.log(`Content: ${msg.content.substring(0, 200)}`);
        console.log();
      }
    });

    console.log("\n=== ANALYSIS SUMMARY ===\n");
    console.log(`Total package-related messages found: ${packageDetails.length}`);
    console.log(`Has onboard packages: ${hasOnboardPackage}`);
    console.log(`Has destination packages: ${hasDestinationPackage}`);
    
    if (packageDetails.length > 0) {
      console.log("\nPackage Details:");
      packageDetails.forEach((pkg, i) => {
        console.log(`${i + 1}. ${pkg.title}`);
        console.log(`   Onboard: ${pkg.isOnboard}`);
        console.log(`   Destination: ${pkg.isDestination}`);
      });
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
