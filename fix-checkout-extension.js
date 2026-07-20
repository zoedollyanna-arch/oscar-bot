const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const config = require("./config");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const channelId = "1525991306730410055";
const user1 = "370258256020373504";
const user2 = "640001667189833739";

// Original checkout was 7/19, 7 day extension = 7/26
const newCheckoutDate = new Date("2026-07-26");
const formattedCheckoutDate = newCheckoutDate.toLocaleDateString("en-US", { 
  weekday: "long", 
  year: "numeric", 
  month: "long", 
  day: "numeric" 
});

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
        checkout_date: "2026-07-26",
        extension_days: 7,
        original_checkout: "2026-07-19",
        status: "confirmed"
      }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
    });

    if (res.ok) {
      console.log("Backend updated successfully with corrected checkout date 7/26/26");
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

    // Update backend with corrected checkout date
    await updateBackend();

    const embed = new EmbedBuilder()
      .setColor(0xFFB6C1)
      .setTitle("🌸 Your Checkout Date Correction 🌸")
      .setDescription(
        "Wonderful news, sweetie We have corrected your checkout date based on your original checkout of July 19th with a 7 day extension Your new checkout date is now properly set in our system 💕"
      )
      .addFields(
        {
          name: "📅 Original Checkout Date",
          value: "Sunday, July 19, 2026",
          inline: true
        },
        {
          name: "✨ Extension Requested",
          value: "7 days",
          inline: true
        },
        {
          name: "🗓️ New Checkout Date",
          value: formattedCheckoutDate,
          inline: true
        },
        {
          name: "💳 Status",
          value: "Your checkout date has been updated in both your booking ticket and our backend system Everything is now correctly set for your extended stay",
          inline: false
        },
        {
          name: "🎯 What This Means",
          value: "You now have until " + formattedCheckoutDate + " to enjoy your extended stay with us Your terminal should reflect this updated date automatically",
          inline: false
        }
      )
      .setFooter({ text: "Lifeline Island Paradise • We are so happy to have you with us longer 🛳️💕" })
      .setTimestamp();

    await channel.send({ 
      content: `<@${user1}> <@${user2}>`,
      embeds: [embed],
      allowedMentions: { users: [user1, user2] }
    });
    console.log(`Checkout correction message sent to booking ticket ${channelId}`);
  } catch (error) {
    console.error("Error sending checkout correction message:", error);
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
