const { Client, GatewayIntentBits } = require("discord.js");
const snackConsent = require("./snackConsent");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const channelId = "1525957535448961174";
const guestId = "1486017357041242263";
const cabinNumber = "C04";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      throw new Error("Booking ticket channel was not found or is not text-based");
    }

    await channel.send(snackConsent.consentEmbed(guestId, cabinNumber));
    console.log(`Snack consent message sent to booking ticket ${channelId}`);
  } catch (error) {
    console.error("Error sending snack consent message:", error);
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
