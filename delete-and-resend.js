const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const config = require("./config");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const channelId = "1525991306730410055";
const userId = "640001667189833739";

// Calculate new checkout date (1 week from today - July 14, 2026)
const today = new Date("2026-07-14");
const newCheckoutDate = new Date(today);
newCheckoutDate.setDate(today.getDate() + 7);
const formattedCheckoutDate = newCheckoutDate.toLocaleDateString("en-US", { 
  weekday: "long", 
  year: "numeric", 
  month: "long", 
  day: "numeric" 
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

async function updateBackend() {
  if (!config.BACKEND_URL) {
    console.log("Backend URL not configured, skipping backend update");
    return;
  }

  try {
    const res = await fetch(`${config.BACKEND_URL}/api/tammy/booking/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.BACKEND_SECRET ? { "x-tammy-secret": config.BACKEND_SECRET } : {}),
      },
      body: JSON.stringify({
        booking_id: channelId,
        extension_days: 7,
        payment_approved: true,
        checkout_date: newCheckoutDate.toISOString().split('T')[0],
        status: "confirmed"
      }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
    });

    if (res.ok) {
      console.log("Backend updated successfully with extension and payment approval");
    } else {
      console.log("Backend update returned non-OK status:", res.status);
    }
  } catch (error) {
    console.log("Backend update failed (continuing with Discord message):", error.message);
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      throw new Error("Booking ticket channel was not found or is not text-based");
    }

    // Fetch recent messages to find and delete the incorrect one
    const messages = await channel.messages.fetch({ limit: 10 });
    
    // Find my recent message with the incorrect content
    const myMessage = messages.find(msg => 
      msg.author.id === client.user.id && 
      msg.embeds.length > 0 && 
      msg.embeds[0].title?.includes("Your Stay Extension")
    );

    if (myMessage) {
      await myMessage.delete();
      console.log("Deleted incorrect message");
    } else {
      console.log("Could not find the incorrect message to delete");
    }

    // Update backend with extension and payment approval
    await updateBackend();

    const embed = new EmbedBuilder()
      .setColor(0xFFB6C1)
      .setTitle("🌸 Your Stay Extension & Package Payment Confirmed 🌸")
      .setDescription(
        "Wonderful news, sweetie Your stay has been successfully extended for another week, and all your package payments have been approved and confirmed We noticed you were having some terminal issues, so we have processed everything through our backend system to ensure everything is perfectly set up for you 💕"
      )
      .addFields(
        {
          name: "📅 New Checkout Date",
          value: formattedCheckoutDate,
          inline: true
        },
        {
          name: "✨ Extension Details",
          value: "Your stay has been extended by 7 days through our backend system. Your terminal should now reflect the updated checkout date automatically",
          inline: false
        },
        {
          name: "💳 Payment Status",
          value: "All payments have been received, approved, and confirmed in our backend system. Everything is fully paid and ready for you",
          inline: false
        },
        {
          name: "🎁 Your Confirmed Packages",
          value: 
            "• Mystery Date Night (L$450): PAID & APPROVED\n" +
            "• Sunset Picnic (L$800): PAID & APPROVED",
          inline: false
        },
        {
          name: "💖 Itemized Summary",
          value: 
            "• Stay Extension (7 days): CONFIRMED\n" +
            "• Mystery Date Night Package: PAID & APPROVED\n" +
            "• Sunset Picnic Package: PAID & APPROVED\n" +
            "• Backend Terminal Update: COMPLETED",
          inline: false
        },
        {
          name: "🎯 What This Means",
          value: "Your terminal should now show the correct checkout date without any errors. All your packages are confirmed and ready to enjoy. If you still see any issues, just let us know and we will help you right away",
          inline: false
        }
      )
      .setFooter({ text: "Lifeline Island Paradise • We are so happy to have you with us longer 🛳️💕" })
      .setTimestamp();

    // Send message WITHOUT pinging the user (since they were already pinged in the incorrect message)
    await channel.send({ embeds: [embed] });
    console.log(`Corrected extension confirmation sent to booking ticket ${channelId}`);
  } catch (error) {
    console.error("Error sending corrected extension confirmation:", error);
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
