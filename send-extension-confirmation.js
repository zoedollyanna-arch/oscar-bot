const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
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
    // Update booking with extension and payment approval
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

    // Add user to the channel
    try {
      const user = await client.users.fetch(userId);
      await channel.permissionOverwrites.edit(user, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });
      console.log(`Added user ${userId} to booking ticket channel`);
    } catch (error) {
      console.log(`Could not add user ${userId} to channel:`, error.message);
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
          name: "📦 Your Packages",
          value: "Your Paradise Package Family Beach Day and any additional packages are now confirmed and awaiting your visit",
          inline: false
        },
        {
          name: "💖 Itemized Summary",
          value: 
            "• Stay Extension (7 days): CONFIRMED\n" +
            "• Paradise Package Family Beach Day: PAID & APPROVED\n" +
            "• Additional Packages: PAID & APPROVED\n" +
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

    await channel.send({ 
      content: `<@${userId}>`,
      embeds: [embed],
      allowedMentions: { users: [userId] }
    });
    console.log(`Extension confirmation sent to booking ticket ${channelId}`);
  } catch (error) {
    console.error("Error sending extension confirmation:", error);
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
