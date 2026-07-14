const { Client, GatewayIntentBits } = require("discord.js");
const packageReservations = require("./packageReservations");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const channelId = "1525981661823762674";
const guestId = "890330032139026493";
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) throw new Error("Booking ticket channel was not found or is not text-based");
    await channel.send(packageReservations.confirmationMessage(guestId));
    console.log(`Paid package confirmation sent to booking ticket ${channelId}`);
  } catch (error) {
    console.error("Error sending package confirmation:", error);
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
