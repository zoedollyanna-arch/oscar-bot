const http = require("http");
const { Client, GatewayIntentBits, Events, PermissionFlagsBits, REST, Routes } = require("discord.js");
const db = require("./db");
const tammyLive = require("./tammyLive");
const concierge = require("./concierge");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN || "";
const port = Number(process.env.PORT || 3000);
const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
] });

async function removeLegacyCommands() {
  const clientId = process.env.CLIENT_ID || "";
  const guildId = process.env.GUILD_ID || "";
  if (!token || !clientId) return;
  const rest = new REST({ version: "10" }).setToken(token);
  if (guildId) await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
  await rest.put(Routes.applicationCommands(clientId), { body: [] });
  console.log("Removed Tammy's legacy slash commands; Lifeline Assistant remains the command owner.");
}

function canControl(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || false;
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Tammy live bridge online as ${readyClient.user.tag}`);
  await removeLegacyCommands().catch((error) => console.error("Could not remove legacy commands:", error.message));
  const connected = await db.init();
  if (!connected) {
    console.error("Tammy live feed disabled: fix DATABASE_URL and restart the service.");
    return;
  }
  tammyLive.startLiveFeed(client, db);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isButton() && !interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith("tammylive_")) return;
    if (!canControl(interaction)) {
      await interaction.reply({ content: "This control is staff-only.", flags: 64 });
      return;
    }
    if (interaction.isButton()) await tammyLive.handleButton(interaction, db);
    else await tammyLive.handleModal(interaction, db);
  } catch (error) {
    console.error("tammy-live interaction error:", error);
    const payload = { content: "Tammy could not process that action. Check the service logs.", flags: 64 };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    await concierge.handleMessage(message, client);
  } catch (error) {
    console.error("concierge response failed:", error.message);
  }
});

http.createServer((req, res) => {
  if (req.url !== "/" && req.url !== "/health") {
    res.writeHead(404).end();
    return;
  }
  const healthy = client.isReady() && db.isReady();
  res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    ok: healthy,
    discord: client.isReady(),
    database: db.isReady(),
    liveFeed: tammyLive.isRunning(),
  }));
}).listen(port, () => console.log(`Health endpoint listening on :${port}`));

process.on("unhandledRejection", (error) => console.error("unhandledRejection:", error));
if (!token) console.error("DISCORD_TOKEN is missing.");
else client.login(token).catch((error) => console.error("Discord login failed:", error.message));
