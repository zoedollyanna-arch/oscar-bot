const http = require("http");
const { Client, GatewayIntentBits, Events, PermissionFlagsBits, REST, Routes } = require("discord.js");
const db = require("./db");
const tammyLive = require("./tammyLive");
const concierge = require("./concierge");
const academyBridge = require("./academyBridge");
const packageReservations = require("./packageReservations");
const packageCoordination = require("./packageCoordination");
const snackConsent = require("./snackConsent");
const romanceConsent = require("./romanceConsent");
const packageReschedule = require("./packageReschedule");
const cleanupRequest = require("./cleanupRequest");
const packageLocation = require("./packageLocation");
const detectiveSchedule = require("./detectiveSchedule");
const timeclock = require("./timeclock");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN || "";
const port = Number(process.env.PORT || 3000);
const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  // Needed to resolve a student's Discord username -> user for report-card DMs.
  // REQUIRES "Server Members Intent" toggled ON in the Discord Developer Portal
  // for the Tammy application, or the bot will fail to log in.
  GatewayIntentBits.GuildMembers,
] });

// A bot token's first dot-segment is the base64-encoded application (client) id.
function clientIdFromToken(t) {
  try { return Buffer.from(String(t).split(".")[0], "base64").toString("utf8"); } catch { return ""; }
}

// Tammy is now a SEPARATE Discord application and owns the Academy commands
// (/academy-teacher-apply, /academy-assign, /academy-note). Registered to the guild for
// instant availability.
async function registerAcademyCommands() {
  const clientId = process.env.CLIENT_ID || clientIdFromToken(token);
  const guildId = process.env.GUILD_ID || "";
  if (!token || !clientId) {
    console.warn("Academy commands NOT registered: missing DISCORD_TOKEN or CLIENT_ID.");
    return;
  }
  const rest = new REST({ version: "10" }).setToken(token);
  const body = academyBridge.commands();
  if (guildId) await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
  else await rest.put(Routes.applicationCommands(clientId), { body });
  console.log(`Registered ${body.length} Tammy Academy command(s)${guildId ? " to guild " + guildId : " globally"}.`);
}

function canControl(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) || false;
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Tammy live bridge online as ${readyClient.user.tag}`);
  await registerAcademyCommands().catch((error) => console.error("Could not register academy commands:", error.message));
  // Academy RP scheduler (report-card DMs + weekly honor roll) runs off the
  // backend API, so it starts regardless of the local Neon connection.
  academyBridge.scheduleAcademyJobs(client);
  const connected = await db.init();
  if (!connected) {
    console.error("Tammy live feed disabled: fix DATABASE_URL and restart the service.");
    return;
  }
  tammyLive.startLiveFeed(client, db);
});

// ── DEEP ROOT CAUSE DIAGNOSIS: "didn't respond in time" ──────────────
// Discord REQUIRES an acknowledgment within 3 seconds for every interaction.
// The bot was failing this because:
//   1. Some handlers (academyBridge, packageReservations) make backend
//      HTTP calls BEFORE calling deferReply/reply, eating the 3-second window.
//   2. Multiple handlers are tried sequentially; even if each is fast, the
//      cumulative time before the right handler replies can exceed 3 seconds.
//   3. Handlers that call showModal() MUST respond within 3 seconds.
//
// FIX (layered):
//   A) For COMPONENT interactions (buttons, select menus) we safe-defer
//      immediately so we have 15 minutes. BUT we skip defer for buttons
//      whose customId starts with known modal-trigger prefixes (bacademy:
//      and tammy_support_pick) so showModal still works.
//   B) For MODAL submissions we reply/ack immediately so Discord doesn't
//      show "Application did not respond".
//   C) Slash commands are handled normally (each own defer).
// ──────────────────────────────────────────────────────────────────────

// Known customId prefixes that call showModal() and must NOT be early-deferred.
// - bacademy:*       → Academy application decision modals
// - tammy_support_pick → Support ticket category picker (opens modal)
// - tammylive_reply  → Opens "Reply as Tammy" modal
const MODAL_TRIGGER_PREFIXES = ["bacademy:", "tammy_support_pick", "tammylive_reply"];

client.on(Events.InteractionCreate, async (interaction) => {
  // ── Phase 1: Safe early-defer for component interactions ──────────
  // This guarantees no interaction ever hits the 3-second deadline
  // unless the handler genuinely requires showModal (which we detect).
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    const cid = (interaction.customId || "");
    const needsModal = MODAL_TRIGGER_PREFIXES.some((p) => cid.startsWith(p));
    if (!needsModal) {
      try {
        await interaction.deferUpdate();
      } catch {
        // was already deferred/replied – fine
      }
    }
  }
  // For modal submits: ack immediately. Most handlers call reply/deferReply
  // themselves but we do a safe defer if they haven't after 2 seconds.
  // We use a debounce: if the handler hasn't replied/deferred within 2s,
  // auto-defer to prevent the timeout.
  let modalSafetyTimer = null;
  if (interaction.isModalSubmit()) {
    modalSafetyTimer = setTimeout(async () => {
      if (!interaction.replied && !interaction.deferred) {
        try { await interaction.deferReply({ ephemeral: true }); } catch {}
      }
    }, 2000).unref?.();
  }

  try {
    // ── Phase 2: Route to the right handler ────────────────────────
    if (await packageReservations.handle(interaction)) return;
    if (await packageCoordination.handle(interaction)) return;
    if (await snackConsent.handle(interaction, db)) return;
    if (await romanceConsent.handle(interaction, db)) return;
    if (await packageReschedule.handle(interaction, db)) return;
    if (await cleanupRequest.handle(interaction, db)) return;
    if (await packageLocation.handle(interaction, db)) return;
    if (await detectiveSchedule.handle(interaction, db)) return;

    // Academy (Tammy owns it): slash commands, application buttons, modals,
    // and the assign picker's select menus/buttons. Staff actions are
    // hard-locked to the owner inside the bridge.
    if (await academyBridge.handle(interaction, client)) return;

    // Tammy live-control buttons/modals (staff via ManageGuild).
    // These arrive already deferred. handleButton/handleModal call
    // editReply() instead of reply().
    if (!interaction.isButton() && !interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith("tammylive_")) return;
    if (!canControl(interaction)) {
      await interaction.editReply({ content: "This control is staff-only." });
      return;
    }
    if (interaction.isButton()) await tammyLive.handleButton(interaction, db);
    else await tammyLive.handleModal(interaction, db);
  } catch (error) {
    console.error("tammy-live interaction error:", error);
    const payload = { content: "Tammy could not process that action. Check the service logs.", flags: 64 };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  } finally {
    if (modalSafetyTimer) clearTimeout(modalSafetyTimer);
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    await concierge.handleMessage(message, client);
  } catch (error) {
    console.error("concierge response failed:", error.message);
  }
});

http.createServer(async (req, res) => {
  // Try timeclock routes first
  if (req.url.startsWith("/api/tammy/timeclock/")) {
    const handled = await timeclock.handleRequest(req, res);
    if (!handled) {
      res.writeHead(404).end(JSON.stringify({ ok: false, error: "not_found" }));
    }
    return;
  }

  // Health / root endpoint
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
