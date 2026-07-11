/* =================================================================================================
 *  Tammy Brightwood — configuration
 *  ------------------------------------------------------------------------------------------------
 *  Tammy is Lifeline's automated Discord staff assistant. She shares the main Discord bot's Neon
 *  Postgres database (via db.js) so support tickets, redelivery requests, applications and audit
 *  logs are visible to both bots. Second Life delivery/account calls go through the Render backend.
 * ================================================================================================= */

require("dotenv").config();

function list(name) {
  return String(process.env[name] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function num(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? n : fallback;
}

const config = {
  // Discord
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || "",
  CLIENT_ID: process.env.CLIENT_ID || "",
  GUILD_ID: process.env.GUILD_ID || "",

  // Roles (staff = anyone who can action tickets/applications/redeliveries)
  ADMIN_ROLE_ID: process.env.TAMMY_ADMIN_ROLE_ID || "",
  STAFF_ROLE_IDS: list("TAMMY_STAFF_ROLE_IDS"),

  // Channels
  LOG_CHANNEL_ID: process.env.TAMMY_LOG_CHANNEL_ID || "",
  WELCOME_CHANNEL_ID: process.env.TAMMY_WELCOME_CHANNEL_ID || "",
  ANNOUNCE_CHANNEL_ID: process.env.TAMMY_ANNOUNCE_CHANNEL_ID || "",
  EVENTS_CHANNEL_ID: process.env.TAMMY_EVENTS_CHANNEL_ID || "",
  OPERATIONS_CHANNEL_ID: process.env.TAMMY_OPERATIONS_CHANNEL_ID || "",
  APPLICATIONS_CHANNEL_ID: process.env.TAMMY_APPLICATIONS_CHANNEL_ID || "",

  // Support tickets
  TICKET_CATEGORY_ID: process.env.TAMMY_TICKET_CATEGORY_ID || "",
  TICKET_CHANNEL_PREFIX: process.env.TAMMY_TICKET_CHANNEL_PREFIX || "support",
  TICKET_STAFF_ROLE_IDS: list("TAMMY_TICKET_STAFF_ROLE_IDS"),

  // FAQ auto-responder scope (channel IDs where Tammy watches messages; empty = all guild channels)
  FAQ_CHANNEL_IDS: list("TAMMY_FAQ_CHANNEL_IDS"),
  FAQ_AUTOREPLY: (process.env.TAMMY_FAQ_AUTOREPLY || "true").toLowerCase() !== "false",

  // Render backend (Second Life HTTP integration). Shared secret guards the endpoints.
  BACKEND_URL: (process.env.LIFELINE_BACKEND_URL || "").replace(/\/+$/, ""),
  BACKEND_SECRET: process.env.LIFELINE_BACKEND_SECRET || "",

  // Handy links surfaced in help/FAQ
  LANDMARKS_URL: process.env.LIFELINE_LANDMARKS_URL || "",
  SUPPORT_URL: process.env.LIFELINE_SUPPORT_URL || "",

  // Scheduler
  TIMEZONE: process.env.TAMMY_TIMEZONE || "America/Los_Angeles",

  // Keep-alive web service port (Render)
  PORT: num("PORT", 3000),
};

module.exports = config;
