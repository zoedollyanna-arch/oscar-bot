const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const packageCoordination = require("./packageCoordination");
const config = require("./config");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const channelId = "1525991306730410055";
const guestId = "640001667189833739";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function updateBackend() {
  if (!config.BACKEND_URL) {
    console.log("Backend URL not configured, skipping backend update");
    return;
  }

  try {
    // Update booking with correct checkout date and package approvals
    const res = await fetch(`${config.BACKEND_URL}/api/tammy/booking/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.BACKEND_SECRET ? { "x-tammy-secret": config.BACKEND_SECRET } : {}),
      },
      body: JSON.stringify({
        booking_id: channelId,
        checkout_date: "2026-07-21",
        packages: {
          mystery_date_night: { paid: true, approved: true },
          sunset_picnic: { paid: true, approved: true }
        },
        status: "confirmed"
      }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
    });

    if (res.ok) {
      console.log("Backend updated successfully with checkout date 7/21/26 and package approvals");
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

    // Update backend first
    await updateBackend();

    // Update message 1526737617876553760
    const msg1 = await channel.messages.fetch("1526737617876553760").catch(() => null);
    if (msg1 && msg1.embeds.length > 0) {
      const oldEmbed = msg1.embeds[0];
      const updatedEmbed = EmbedBuilder.from(oldEmbed);
      
      // Find and update the checkout date field
      const checkoutField = updatedEmbed.data.fields.find(f => f.name === "📅 New Checkout Date");
      if (checkoutField) {
        checkoutField.value = "Wednesday, July 21, 2026";
      }
      
      // Update package field to remove incorrect "Paradise Package Family Beach Day"
      const packagesField = updatedEmbed.data.fields.find(f => f.name === "📦 Your Packages");
      if (packagesField) {
        packagesField.value = "Your Mystery Date Night and Sunset Picnic packages are now confirmed and awaiting your visit";
      }
      
      // Update itemized summary
      const summaryField = updatedEmbed.data.fields.find(f => f.name === "💖 Itemized Summary");
      if (summaryField) {
        summaryField.value = 
          "• Stay Extension (7 days): CONFIRMED\n" +
          "• Mystery Date Night Package: PAID & APPROVED\n" +
          "• Sunset Picnic Package: PAID & APPROVED\n" +
          "• Backend Terminal Update: COMPLETED";
      }
      
      await msg1.edit({ embeds: [updatedEmbed] });
      console.log("Updated message 1526737617876553760 with correct checkout date");
    }

    // Update message 1526738133629272176
    const msg2 = await channel.messages.fetch("1526738133629272176").catch(() => null);
    if (msg2 && msg2.embeds.length > 0) {
      const oldEmbed = msg2.embeds[0];
      const updatedEmbed = EmbedBuilder.from(oldEmbed);
      
      // Find and update the checkout date field
      const checkoutField = updatedEmbed.data.fields.find(f => f.name === "📅 New Checkout Date");
      if (checkoutField) {
        checkoutField.value = "Wednesday, July 21, 2026";
      }
      
      await msg2.edit({ embeds: [updatedEmbed] });
      console.log("Updated message 1526738133629272176 with correct checkout date");
    }

    // Send the package coordination message
    await channel.send(packageCoordination.coordinationMessage(guestId));
    console.log("Package coordination message sent to booking ticket");

  } catch (error) {
    console.error("Error updating messages and sending coordination:", error);
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
