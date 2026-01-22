/**
 * Oscar Bot — Lifeline Academy (Refined for your channel layout) + LIVE Google Sheets Applications
 * -------------------------------------------------------------------------------------------------
 * Discord.js v14+ | Node 18+
 *
 * ✅ Keeps all Academy features you tested:
 *   - Announcements, bulletins, welcome/rules/handbook/enrollment embeds
 *   - Weekly schedule (set/today/week), daily RP prompts (manual + optional auto)
 *   - Attendance sessions, points + leaderboard, groups, timers, spotlights
 *   - Student passes + staff approval with DM, Nurse queue
 *
 * ✅ NEW: Application pipelines from TWO Google Form Response Sheets (LIVE)
 *   - Student Enrollment Sheet
 *   - Teacher Application Sheet
 *
 * Applicants (no academy role needed):
 *   /academy student-status  (lookup by SL username)
 *   /academy teacher-status  (lookup by SL username)
 *   + Button: Open Ticket (pre-access private channel) for questions/concerns
 *
 * Staff tools (teacher/admin):
 *   /academy register-discord (bind Discord user ID to a sheet row by SL username)
 *   /academy approve-student
 *   /academy deny-student
 *   /academy confirm-tuition
 *   /academy approve-teacher
 *   /academy deny-teacher
 *
 * IMPORTANT (dependencies):
 *   - You must have "googleapis" installed:
 *       npm i googleapis
 *     or add to package.json dependencies: "googleapis": "^144.0.0"
 *
 * -------------------------------------------------------------------------------------------------
 * REQUIRED ENV
 *   DISCORD_TOKEN=...
 *   CLIENT_ID=...   (Discord Developer Portal -> Application ID)
 *   GUILD_ID=...
 *
 *   OSCAR_ALLOWED_CATEGORY_IDS=ACADEMY_CATEGORY_ID (comma-separated ok)
 *   OSCAR_LOG_CHANNEL_ID=... (recommended)
 *
 * REQUIRED Channel Targets (recommended):
 *   OSCAR_WELCOME_CHANNEL_ID=
 *   OSCAR_RULES_CHANNEL_ID=
 *   OSCAR_ANNOUNCE_CHANNEL_ID=
 *   OSCAR_CALENDAR_CHANNEL_ID=
 *   OSCAR_HANDBOOK_CHANNEL_ID=
 *   OSCAR_ENROLL_CHANNEL_ID=
 *   OSCAR_STUDENT_LOUNGE_CHANNEL_ID=
 *   OSCAR_PICTURES_CHANNEL_ID=
 *
 * Roles (recommended):
 *   OSCAR_ADMIN_ROLE_ID=
 *   OSCAR_TEACHER_ROLE_ID=
 *   OSCAR_NURSE_ROLE_ID= (optional)
 *
 * Optional Links:
 *   ACADEMY_HANDBOOK_URL=
 *   ACADEMY_ENROLLMENT_URL=
 *   ACADEMY_STUDENT_PORTAL_URL=
 *   ACADEMY_TEACHER_PORTAL_URL=
 *   ACADEMY_PARENT_PORTAL_URL=
 *   ACADEMY_ADMIN_PORTAL_URL=
 *
 * Daily Scheduler (optional):
 *   OSCAR_TIMEZONE=America/Los_Angeles
 *   OSCAR_DAILY_BULLETIN_HOUR=8
 *   OSCAR_DAILY_PROMPT_HOUR=9
 *
 * GOOGLE SHEETS (LIVE) — Service Account
 *   STUDENT_SHEET_ID=...   (Google Sheet ID from URL)
 *   TEACHER_SHEET_ID=...
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL=...  (from service account json "client_email")
 *   GOOGLE_PRIVATE_KEY=...            (from service account json "private_key" with \n preserved)
 *
 * Ticket System (pre-access):
 *   OSCAR_TICKET_CATEGORY_ID=...   (category where Oscar creates private ticket channels)
 *   OSCAR_TICKET_STAFF_ROLE_IDS=... (comma-separated role IDs that can see tickets; e.g. admin + teacher roles)
 *   OSCAR_TICKET_CHANNEL_PREFIX=academy-ticket  (optional)
 *
 * Notes:
 * - Oscar auto-detects the FIRST tab (worksheet) in each spreadsheet.
 * - Oscar looks for a column matching SL username using flexible header matching.
 * - Your staff columns you added are expected (recommended headers):
 *     status, tuition_status, next_steps, staff_notes, last_updated, discord_id
 *
 * -------------------------------------------------------------------------------------------------
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const http = require("http");

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { google } = require("googleapis");

// -------------------- ENV --------------------
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "";
const CLIENT_ID = process.env.CLIENT_ID || "";
const GUILD_ID = process.env.GUILD_ID || "";

const OSCAR_ALLOWED_CATEGORY_IDS = (process.env.OSCAR_ALLOWED_CATEGORY_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const OSCAR_LOG_CHANNEL_ID = process.env.OSCAR_LOG_CHANNEL_ID || "";

// Channel targets (mapped to your Academy layout)
const OSCAR_WELCOME_CHANNEL_ID = process.env.OSCAR_WELCOME_CHANNEL_ID || "";
const OSCAR_RULES_CHANNEL_ID = process.env.OSCAR_RULES_CHANNEL_ID || "";
const OSCAR_ANNOUNCE_CHANNEL_ID = process.env.OSCAR_ANNOUNCE_CHANNEL_ID || "";
const OSCAR_CALENDAR_CHANNEL_ID = process.env.OSCAR_CALENDAR_CHANNEL_ID || "";
const OSCAR_HANDBOOK_CHANNEL_ID = process.env.OSCAR_HANDBOOK_CHANNEL_ID || "";
const OSCAR_ENROLL_CHANNEL_ID = process.env.OSCAR_ENROLL_CHANNEL_ID || "";
const OSCAR_STUDENT_LOUNGE_CHANNEL_ID = process.env.OSCAR_STUDENT_LOUNGE_CHANNEL_ID || "";
const OSCAR_PICTURES_CHANNEL_ID = process.env.OSCAR_PICTURES_CHANNEL_ID || "";

// Optional channels
const OSCAR_EVENTS_CHANNEL_ID = process.env.OSCAR_EVENTS_CHANNEL_ID || "";
const OSCAR_PARENT_NOTICES_CHANNEL_ID = process.env.OSCAR_PARENT_NOTICES_CHANNEL_ID || "";
const OSCAR_FACULTY_LOUNGE_CHANNEL_ID = process.env.OSCAR_FACULTY_LOUNGE_CHANNEL_ID || "";
const OSCAR_RECORDS_CHANNEL_ID = process.env.OSCAR_RECORDS_CHANNEL_ID || "";
const OSCAR_OPERATIONS_CHANNEL_ID = process.env.OSCAR_OPERATIONS_CHANNEL_ID || "";

// Roles
const OSCAR_ADMIN_ROLE_ID = process.env.OSCAR_ADMIN_ROLE_ID || "";
const OSCAR_TEACHER_ROLE_ID = process.env.OSCAR_TEACHER_ROLE_ID || "";
const OSCAR_NURSE_ROLE_ID = process.env.OSCAR_NURSE_ROLE_ID || "";

// Links
const ACADEMY_HANDBOOK_URL = process.env.ACADEMY_HANDBOOK_URL || "";
const ACADEMY_ENROLLMENT_URL = process.env.ACADEMY_ENROLLMENT_URL || "";
const ACADEMY_STUDENT_PORTAL_URL = process.env.ACADEMY_STUDENT_PORTAL_URL || "";
const ACADEMY_TEACHER_PORTAL_URL = process.env.ACADEMY_TEACHER_PORTAL_URL || "";
const ACADEMY_PARENT_PORTAL_URL = process.env.ACADEMY_PARENT_PORTAL_URL || "";
const ACADEMY_ADMIN_PORTAL_URL = process.env.ACADEMY_ADMIN_PORTAL_URL || "";

// Schedulers
const OSCAR_TIMEZONE = process.env.OSCAR_TIMEZONE || "America/Los_Angeles";
const OSCAR_DAILY_BULLETIN_HOUR = Number(process.env.OSCAR_DAILY_BULLETIN_HOUR || "8");
const OSCAR_DAILY_PROMPT_HOUR = Number(process.env.OSCAR_DAILY_PROMPT_HOUR || "9");

// Google Sheets
const STUDENT_SHEET_ID = process.env.STUDENT_SHEET_ID || "";
const TEACHER_SHEET_ID = process.env.TEACHER_SHEET_ID || "";
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
const GOOGLE_PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

// Tickets
const OSCAR_TICKET_CATEGORY_ID = process.env.OSCAR_TICKET_CATEGORY_ID || "";
const OSCAR_TICKET_CHANNEL_PREFIX = process.env.OSCAR_TICKET_CHANNEL_PREFIX || "academy-ticket";
const OSCAR_TICKET_STAFF_ROLE_IDS = (process.env.OSCAR_TICKET_STAFF_ROLE_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Keep-alive (Web Service)
const PORT = process.env.PORT || 3000;

// -------------------- BASIC VALIDATION --------------------
function requireEnv(name, value) {
  if (!value) console.warn(`⚠️ ENV missing: ${name}`);
}
requireEnv("DISCORD_TOKEN", DISCORD_TOKEN);
requireEnv("CLIENT_ID", CLIENT_ID);
requireEnv("GUILD_ID", GUILD_ID);
requireEnv("OSCAR_ALLOWED_CATEGORY_IDS", OSCAR_ALLOWED_CATEGORY_IDS.join(","));
requireEnv("OSCAR_LOG_CHANNEL_ID", OSCAR_LOG_CHANNEL_ID);

requireEnv("STUDENT_SHEET_ID", STUDENT_SHEET_ID);
requireEnv("TEACHER_SHEET_ID", TEACHER_SHEET_ID);
requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", GOOGLE_SERVICE_ACCOUNT_EMAIL);
requireEnv("GOOGLE_PRIVATE_KEY", GOOGLE_PRIVATE_KEY ? "set" : "");

// -------------------- DATA (local) --------------------
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const FILE_SCHEDULE = path.join(DATA_DIR, "oscar_schedule.json");
const FILE_PROMPTS = path.join(DATA_DIR, "oscar_prompts.json");
const FILE_POINTS = path.join(DATA_DIR, "oscar_points.json");
const FILE_ATTENDANCE = path.join(DATA_DIR, "oscar_attendance.json");
const FILE_PASSES = path.join(DATA_DIR, "oscar_passes.json");
const FILE_NURSE_QUEUE = path.join(DATA_DIR, "oscar_nurse_queue.json");

// -------------------- JSON HELPERS --------------------
function loadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error("❌ loadJson error", filePath, e);
    return fallback;
  }
}

function saveJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("❌ saveJson error", filePath, e);
  }
}

function nowISO() {
  return new Date().toISOString();
}

function randomFrom(arr) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function safeSlice(s, max) {
  return String(s || "").slice(0, max);
}

// -------------------- STORES --------------------
const scheduleStore = loadJson(FILE_SCHEDULE, {
  weekSchedule: { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] },
  lastUpdatedAt: null,
});

const promptStore = loadJson(FILE_PROMPTS, {
  prompts: [
    "You’re new to campus. Introduce yourself to a classmate and ask where your next class is.",
    "You forgot your homework. Roleplay how you handle it with your teacher respectfully.",
    "You overhear a rumor in the hallway. Decide how you respond in a mature way.",
    "A group project needs leadership. Step up and assign roles to your teammates.",
    "You’re preparing for a school event. Coordinate with classmates to get organized.",
  ],
  lastPostedAt: null,
});

const pointsStore = loadJson(FILE_POINTS, { points: {} });
const attendanceStore = loadJson(FILE_ATTENDANCE, { sessions: {} });
const passStore = loadJson(FILE_PASSES, { passes: {} });
const nurseQueueStore = loadJson(FILE_NURSE_QUEUE, { queue: [] });

// -------------------- CLIENT --------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// -------------------- LOGGING --------------------
async function oscarLog(guild, message) {
  try {
    if (!OSCAR_LOG_CHANNEL_ID) return;
    const ch = await guild.channels.fetch(OSCAR_LOG_CHANNEL_ID).catch(() => null);
    if (!ch || ch.type !== ChannelType.GuildText) return;
    await ch.send({ content: safeSlice(message, 1900) });
  } catch {}
}

// -------------------- PERMISSIONS --------------------
function hasRole(member, roleId) {
  if (!roleId) return false;
  return member?.roles?.cache?.has(roleId) || false;
}

function isAdmin(member) {
  return (
    hasRole(member, OSCAR_ADMIN_ROLE_ID) ||
    member?.permissions?.has?.(PermissionsBitField.Flags.Administrator)
  );
}

function isTeacher(member) {
  return hasRole(member, OSCAR_TEACHER_ROLE_ID) || isAdmin(member);
}

function isNurse(member) {
  return hasRole(member, OSCAR_NURSE_ROLE_ID) || isTeacher(member);
}

// -------------------- SCOPE GUARD --------------------
function inAllowedAcademyScope(channel) {
  if (!channel) return false;
  if (!OSCAR_ALLOWED_CATEGORY_IDS.length) return true;
  return !!channel.parentId && OSCAR_ALLOWED_CATEGORY_IDS.includes(channel.parentId);
}

function inTicketScope(channel) {
  if (!channel || !channel.parentId || !channel.guild) return false;

  // If env is set, treat only that category as ticket scope
  if (OSCAR_TICKET_CATEGORY_ID && channel.parentId === OSCAR_TICKET_CATEGORY_ID) return true;

  // Otherwise, detect by category name (top-level)
  const parent = channel.guild.channels.cache.get(channel.parentId);
  if (!parent || parent.type !== ChannelType.GuildCategory) return false;

  const name = String(parent.name || "").toLowerCase();
  return name.includes("academy tickets") || name === "📂 academy tickets".toLowerCase();
}

function requireScopeOrReply(interaction) {
  // Allow DMs for status checks + help
  if (!interaction.inGuild()) return true;

  // Allow ticket channels even if not under academy category
  if (inTicketScope(interaction.channel)) return true;

  // Allow within academy category
  if (inAllowedAcademyScope(interaction.channel)) return true;

  // Allow safe command anywhere
  if (interaction.isChatInputCommand() && interaction.commandName === "oscar") {
    const sub = interaction.options.getSubcommand(false) || "";
    if (["ping", "help", "portal"].includes(sub)) return true;
  }
  if (interaction.isChatInputCommand() && interaction.commandName === "academy") {
    // allow academy status anywhere (returns ephemeral / DM)
    const sub = interaction.options.getSubcommand(false) || "";
    if (["student-status", "teacher-status"].includes(sub)) return true;
  }

  interaction.reply({
    ephemeral: true,
    content: "🦉 Oscar is scoped to Lifeline Academy channels. Use this inside the Academy category (or your ticket).",
  }).catch(() => {});
  return false;
}

// -------------------- EMBEDS --------------------
function embedBase(title, desc) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc || "")
    .setFooter({ text: "Oscar • Lifeline Academy" })
    .setTimestamp(new Date());
}

function scheduleToText(dayBlocks) {
  if (!dayBlocks || !dayBlocks.length) return "No schedule posted yet.";
  return dayBlocks.map((b, i) => `**${i + 1}. ${b.label}** — ${b.details}`).join("\n");
}

function getLocalParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: OSCAR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    weekday: map.weekday,
    hour: Number(map.hour),
    minute: Number(map.minute),
    ymd: `${map.year}-${map.month}-${map.day}`,
  };
}

// -------------------- CHANNEL HELPERS --------------------
async function fetchTextChannel(guild, channelId) {
  if (!channelId) return null;
  const ch = await guild.channels.fetch(channelId).catch(() => null);
  if (!ch || ch.type !== ChannelType.GuildText) return null;
  return ch;
}

// -------------------- Academy Posts --------------------
async function postWelcome(guild) {
  const ch = await fetchTextChannel(guild, OSCAR_WELCOME_CHANNEL_ID);
  if (!ch) return false;

  const eb = embedBase(
    "Welcome to Lifeline Academy",
    "Welcome to **Lifeline Academy** — a structured, realism-focused school experience inside the Lifeline RP System.\n\n" +
      "Start here:\n" +
      "• Read **#academy-rules**\n" +
      "• Check **#academy-calendar** for schedules & events\n" +
      "• Browse **#academy-handbook** for policies and expectations\n" +
      "• Use **#academy-enrollment** to get started\n\n" +
      "Need help? Use `/academy student-status` or `/academy teacher-status` to check your application. You can also open a ticket for questions."
  );
  await ch.send({ embeds: [eb] });
  return true;
}

async function postRules(guild) {
  const ch = await fetchTextChannel(guild, OSCAR_RULES_CHANNEL_ID);
  if (!ch) return false;

  const eb = embedBase(
    "Academy Rules",
    "• Stay respectful and keep RP professional.\n" +
      "• Follow teacher/staff direction during classes.\n" +
      "• No disruptive behavior, harassment, or trolling.\n" +
      "• Use channels as intended (students/parents/faculty).\n" +
      "• Keep information appropriate for school RP.\n\n" +
      "If you need support, contact staff. Repeated issues may lead to removal."
  );
  await ch.send({ embeds: [eb] });
  return true;
}

async function postHandbook(guild) {
  const ch = await fetchTextChannel(guild, OSCAR_HANDBOOK_CHANNEL_ID);
  if (!ch) return false;

  const desc =
    "The Academy Handbook contains policies, structure, and expectations.\n\n" +
    (ACADEMY_HANDBOOK_URL ? `📘 Handbook: ${ACADEMY_HANDBOOK_URL}\n\n` : "") +
    "If you have questions, staff will assist in the appropriate lounge channels.";

  const eb = embedBase("Academy Handbook", desc);
  await ch.send({ embeds: [eb] });
  return true;
}

async function postEnrollment(guild) {
  const ch = await fetchTextChannel(guild, OSCAR_ENROLL_CHANNEL_ID);
  if (!ch) return false;

  const desc =
    "Enrollment and hiring operate through application review.\n\n" +
    (ACADEMY_ENROLLMENT_URL ? `📝 Enrollment Link: ${ACADEMY_ENROLLMENT_URL}\n\n` : "") +
    "After you apply, staff will review your vision and confirm next steps.\n\n" +
    "Check your status anytime:\n" +
    "• `/academy student-status` (students)\n" +
    "• `/academy teacher-status` (teachers)\n\n" +
    "Need help before access is granted? You can open a private ticket from the status response.";

  const eb = embedBase("Enrollment & Getting Started", desc);
  await ch.send({ embeds: [eb] });
  return true;
}

// -------------------- Google Sheets (LIVE) --------------------
let sheetsClient = null;
const sheetTitleCache = new Map(); // sheetId -> first tab title

function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function findHeaderIndex(headers, wanted) {
  const nWanted = normalizeHeader(wanted);

  // exact
  let idx = headers.findIndex((h) => normalizeHeader(h) === nWanted);
  if (idx >= 0) return idx;

  // common alternates for sl_username
  if (nWanted === "sl_username") {
    const candidates = [
      "slusername",
      "sl_user",
      "secondlifeusername",
      "second_life_username",
      "secondlife_user",
      "resident_name",
      "avatar_name",
      "sl_name",
    ];
    for (const c of candidates) {
      idx = headers.findIndex((h) => normalizeHeader(h) === normalizeHeader(c));
      if (idx >= 0) return idx;
    }

    // fuzzy contains
    idx = headers.findIndex((h) => {
      const nh = normalizeHeader(h);
      return (nh.includes("sl") && nh.includes("user")) || nh.includes("secondlife") || nh.includes("resident");
    });
    if (idx >= 0) return idx;
  }

  // fallback contains
  idx = headers.findIndex((h) => normalizeHeader(h).includes(nWanted));
  return idx;
}

function colToA1(colIndexZeroBased) {
  let n = colIndexZeroBased + 1;
  let s = "";
  while (n > 0) {
    const mod = (n - 1) % 26;
    s = String.fromCharCode(65 + mod) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY");
  }

  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

async function getFirstTabTitle(spreadsheetId) {
  if (sheetTitleCache.has(spreadsheetId)) return sheetTitleCache.get(spreadsheetId);

  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const title = meta.data?.sheets?.[0]?.properties?.title || "Form Responses 1";
  sheetTitleCache.set(spreadsheetId, title);
  return title;
}

async function findRowBySlUsername(spreadsheetId, slUsername) {
  const sheets = await getSheetsClient();
  const tab = await getFirstTabTitle(spreadsheetId);

  // pull a generous range (Forms usually < 1000 rows). You can increase if needed.
  const range = `${tab}!A1:ZZ2000`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values || [];
  if (!rows.length) return { found: false, reason: "Sheet is empty." };

  const headers = rows[0];
  const idxSl = findHeaderIndex(headers, "sl_username");
  if (idxSl < 0) return { found: false, reason: "Could not find an SL username column header." };

  const target = String(slUsername || "").trim().toLowerCase();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const value = String(row[idxSl] || "").trim().toLowerCase();
    if (value && value === target) {
      return {
        found: true,
        tab,
        headers,
        row,
        rowIndex1Based: i + 1, // A1 row number
      };
    }
  }

  return { found: false, reason: "No matching SL username found." };
}

async function updateRowFields(spreadsheetId, tab, headers, rowIndex1Based, updates) {
  const sheets = await getSheetsClient();

  const requests = [];
  for (const [key, val] of Object.entries(updates)) {
    const idx = findHeaderIndex(headers, key);
    if (idx < 0) continue; // silently skip unknown columns
    const col = colToA1(idx);
    const range = `${tab}!${col}${rowIndex1Based}`;
    requests.push({ range, values: [[String(val ?? "")]] });
  }

  if (!requests.length) return { updated: 0 };

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: requests,
    },
  });

  return { updated: requests.length };
}

// -------------------- Ticket system (pre-access) --------------------
function buildTicketPermOverwrites(guild, applicantId) {
  const overwrites = [];

  // deny everyone
  overwrites.push({
    id: guild.roles.everyone.id,
    deny: [PermissionsBitField.Flags.ViewChannel],
  });

  // allow applicant
  overwrites.push({
    id: applicantId,
    allow: [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.ReadMessageHistory,
      PermissionsBitField.Flags.AttachFiles,
      PermissionsBitField.Flags.EmbedLinks,
    ],
  });

  // allow staff roles (from env, fallback to teacher/admin)
  const staffRoles = OSCAR_TICKET_STAFF_ROLE_IDS.length
    ? OSCAR_TICKET_STAFF_ROLE_IDS
    : [OSCAR_ADMIN_ROLE_ID, OSCAR_TEACHER_ROLE_ID].filter(Boolean);

  for (const rid of staffRoles) {
    overwrites.push({
      id: rid,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageMessages,
      ],
    });
  }

  // allow bot
  overwrites.push({
    id: client.user.id,
    allow: [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.ReadMessageHistory,
      PermissionsBitField.Flags.ManageChannels,
      PermissionsBitField.Flags.ManageMessages,
    ],
  });

  return overwrites;
}

async function getOrCreateTicketCategory(guild) {
  // If a specific ticket category ID is provided, use it (must be a CATEGORY)
  if (OSCAR_TICKET_CATEGORY_ID) {
    const ch = await guild.channels.fetch(OSCAR_TICKET_CATEGORY_ID).catch(() => null);
    if (ch && ch.type === ChannelType.GuildCategory) return ch;
    throw new Error("Ticket category not found or not a category channel.");
  }

  // Find an existing TOP-LEVEL category by name
  const existing =
    guild.channels.cache.find(
      (c) =>
        c.type === ChannelType.GuildCategory &&
        String(c.name || "").toLowerCase().includes("academy tickets")
    ) ||
    guild.channels.cache.find(
      (c) =>
        c.type === ChannelType.GuildCategory &&
        String(c.name || "").toLowerCase() === "academy tickets"
    );

  if (existing) return existing;

  // Create a TOP-LEVEL category (Discord does not allow category nesting)
  return guild.channels.create({
    name: "📂 Academy Tickets",
    type: ChannelType.GuildCategory,
    reason: "Oscar auto-created Academy Tickets category",
  });
}

async function createPreAccessTicket(guild, applicantUser, context) {
  const category = await getOrCreateTicketCategory(guild);

  const sl = safeSlice(context?.sl_username || "unknown", 24).replace(/[^a-z0-9_-]/gi, "").toLowerCase();
  const shortId = Date.now().toString(36).slice(-5);
  const channelName = `${OSCAR_TICKET_CHANNEL_PREFIX}-${sl}-${shortId}`.slice(0, 90);
  const ticket = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: buildTicketPermOverwrites(guild, applicantUser.id),
    reason: "Oscar pre-access application ticket",
  });

  const closeBtn = new ButtonBuilder()
    .setCustomId(`oscar_ticket_close:${ticket.id}`)
    .setLabel("Close Ticket")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(closeBtn);

  const eb = embedBase("Application Ticket", "This is a private ticket for application questions/concerns.")
    .addFields(
      { name: "Applicant", value: `${applicantUser} (\`${applicantUser.id}\`)`, inline: false },
      { name: "SL Username", value: safeSlice(context?.sl_username || "N/A", 200), inline: true },
      { name: "Type", value: safeSlice(context?.type || "N/A", 50), inline: true },
      { name: "Status", value: safeSlice(context?.status || "N/A", 80), inline: true },
      { name: "Next Steps", value: safeSlice(context?.next_steps || "N/A", 1000) || "N/A", inline: false }
    );

  await ticket.send({
    content: "Staff will respond here. Please describe your question clearly.",
    embeds: [eb],
    components: [row],
  });

  return ticket;
}

async function safeDM(user, message) {
  try {
    await user.send(message);
    return true;
  } catch {
    return false;
  }
}

// -------------------- COMMANDS --------------------
const commandDefs = [
  // OSCAR CORE
  new SlashCommandBuilder()
    .setName("oscar")
    .setDescription("Oscar • Lifeline Academy utilities")
    .addSubcommand((s) => s.setName("ping").setDescription("Health check"))
    .addSubcommand((s) => s.setName("help").setDescription("Show command help"))
    .addSubcommand((s) => s.setName("config").setDescription("Show Oscar config (staff only)"))
    .addSubcommand((s) =>
      s
        .setName("announce")
        .setDescription("Post an academy announcement (teacher/staff)")
        .addStringOption((o) => o.setName("title").setDescription("Announcement title").setRequired(true))
        .addStringOption((o) => o.setName("message").setDescription("Announcement message").setRequired(true))
        .addBooleanOption((o) => o.setName("ping_everyone").setDescription("Ping @everyone").setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName("bulletin")
        .setDescription("Post a daily bulletin (teacher/staff)")
        .addStringOption((o) => o.setName("message").setDescription("Bulletin text").setRequired(true))
    )
    .addSubcommand((s) => s.setName("welcome_post").setDescription("Post the welcome embed (staff)"))
    .addSubcommand((s) => s.setName("rules_post").setDescription("Post the rules embed (staff)"))
    .addSubcommand((s) => s.setName("handbook_post").setDescription("Post handbook info (staff)"))
    .addSubcommand((s) => s.setName("enrollment_post").setDescription("Post enrollment info (staff)"))
    .addSubcommandGroup((g) =>
      g
        .setName("schedule")
        .setDescription("View or set academy schedule")
        .addSubcommand((s) => s.setName("today").setDescription("Show today's schedule"))
        .addSubcommand((s) => s.setName("week").setDescription("Show weekly schedule"))
        .addSubcommand((s) =>
          s
            .setName("set")
            .setDescription("Set one schedule block (teacher/staff)")
            .addStringOption((o) =>
              o
                .setName("day")
                .setDescription("Day of week")
                .setRequired(true)
                .addChoices(
                  { name: "Monday", value: "Monday" },
                  { name: "Tuesday", value: "Tuesday" },
                  { name: "Wednesday", value: "Wednesday" },
                  { name: "Thursday", value: "Thursday" },
                  { name: "Friday", value: "Friday" }
                )
            )
            .addStringOption((o) => o.setName("label").setDescription("Block label (e.g., Period 1)").setRequired(true))
            .addStringOption((o) => o.setName("details").setDescription("Details (subject/room/teacher)").setRequired(true))
            .addIntegerOption((o) =>
              o
                .setName("position")
                .setDescription("Position in list (1 = top)")
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(20)
            )
        )
        .addSubcommand((s) =>
          s
            .setName("clear")
            .setDescription("Clear a day's schedule (admin only)")
            .addStringOption((o) =>
              o
                .setName("day")
                .setDescription("Day of week")
                .setRequired(true)
                .addChoices(
                  { name: "Monday", value: "Monday" },
                  { name: "Tuesday", value: "Tuesday" },
                  { name: "Wednesday", value: "Wednesday" },
                  { name: "Thursday", value: "Thursday" },
                  { name: "Friday", value: "Friday" }
                )
            )
        )
    )
    .addSubcommand((s) =>
      s
        .setName("prompt")
        .setDescription("Get or post an RP prompt")
        .addBooleanOption((o) => o.setName("post").setDescription("Post prompt to #student-lounge (staff)").setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName("portal")
        .setDescription("Get the correct portal link")
        .addStringOption((o) =>
          o
            .setName("type")
            .setDescription("Which portal?")
            .setRequired(true)
            .addChoices(
              { name: "Student", value: "student" },
              { name: "Teacher", value: "teacher" },
              { name: "Parent", value: "parent" },
              { name: "Admin", value: "admin" }
            )
        )
    ),

  // APPLICATIONS (LIVE SHEETS)
  new SlashCommandBuilder()
    .setName("academy")
    .setDescription("Academy applications & enrollment (live status + staff actions)")
    .addSubcommand((s) =>
      s
        .setName("student-status")
        .setDescription("Check your student enrollment application status by SL username")
        .addStringOption((o) => o.setName("sl_username").setDescription("Second Life username").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("teacher-status")
        .setDescription("Check your teacher application status by SL username")
        .addStringOption((o) => o.setName("sl_username").setDescription("Second Life username").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("register-discord")
        .setDescription("Staff: bind a Discord user to a sheet row (by SL username)")
        .addStringOption((o) => o.setName("type").setDescription("Student or Teacher").setRequired(true).addChoices(
          { name: "Student", value: "student" },
          { name: "Teacher", value: "teacher" }
        ))
        .addStringOption((o) => o.setName("sl_username").setDescription("SL username").setRequired(true))
        .addUserOption((o) => o.setName("user").setDescription("Discord user").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("approve-student")
        .setDescription("Staff: approve a student enrollment application")
        .addStringOption((o) => o.setName("sl_username").setDescription("SL username").setRequired(true))
        .addStringOption((o) => o.setName("next_steps").setDescription("Optional next steps message").setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName("deny-student")
        .setDescription("Staff: deny a student enrollment application")
        .addStringOption((o) => o.setName("sl_username").setDescription("SL username").setRequired(true))
        .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("confirm-tuition")
        .setDescription("Staff: confirm tuition payment for a student")
        .addStringOption((o) => o.setName("sl_username").setDescription("SL username").setRequired(true))
        .addStringOption((o) => o.setName("notes").setDescription("Optional payment notes").setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName("approve-teacher")
        .setDescription("Staff: approve a teacher application")
        .addStringOption((o) => o.setName("sl_username").setDescription("SL username").setRequired(true))
        .addStringOption((o) => o.setName("next_steps").setDescription("Optional next steps message").setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName("deny-teacher")
        .setDescription("Staff: deny a teacher application")
        .addStringOption((o) => o.setName("sl_username").setDescription("SL username").setRequired(true))
        .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true))
    ),

  // CLASSROOM TOOLS
  new SlashCommandBuilder()
    .setName("class")
    .setDescription("Classroom tools (teachers)")
    .addSubcommand((s) =>
      s
        .setName("attendance_start")
        .setDescription("Start attendance (teacher)")
        .addStringOption((o) => o.setName("class_name").setDescription("Class name").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("attendance_close")
        .setDescription("Close attendance (teacher)")
        .addStringOption((o) => o.setName("session_id").setDescription("Session ID").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("timer")
        .setDescription("Start a class timer (teacher)")
        .addIntegerOption((o) => o.setName("minutes").setDescription("Minutes 1–60").setRequired(true).setMinValue(1).setMaxValue(60))
        .addStringOption((o) => o.setName("label").setDescription("Timer label").setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName("groups")
        .setDescription("Make random groups from mentions (teacher)")
        .addIntegerOption((o) => o.setName("size").setDescription("Group size").setRequired(true).setMinValue(2).setMaxValue(10))
        .addStringOption((o) => o.setName("mentions").setDescription("Mention students").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("shoutout")
        .setDescription("Student shoutout (teacher)")
        .addUserOption((o) => o.setName("student").setDescription("Student").setRequired(true))
        .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true))
    )
    .addSubcommandGroup((g) =>
      g
        .setName("points")
        .setDescription("Student points system")
        .addSubcommand((s) =>
          s
            .setName("add")
            .setDescription("Add points (teacher)")
            .addUserOption((o) => o.setName("student").setDescription("Student").setRequired(true))
            .addIntegerOption((o) => o.setName("amount").setDescription("Points (-500..500)").setRequired(true).setMinValue(-500).setMaxValue(500))
            .addStringOption((o) => o.setName("reason").setDescription("Reason").setRequired(true))
        )
        .addSubcommand((s) => s.setName("leaderboard").setDescription("Top students by points"))
    )
    .addSubcommand((s) =>
      s
        .setName("lesson_post")
        .setDescription("Post a lesson template (teacher)")
        .addStringOption((o) => o.setName("title").setDescription("Lesson title").setRequired(true))
        .addStringOption((o) => o.setName("grade").setDescription("Grade level").setRequired(true))
        .addStringOption((o) => o.setName("subject").setDescription("Subject").setRequired(true))
        .addStringOption((o) => o.setName("quarter").setDescription("Quarter").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("worksheet_post")
        .setDescription("Post worksheet instructions (teacher)")
        .addStringOption((o) => o.setName("title").setDescription("Worksheet title").setRequired(true))
        .addStringOption((o) => o.setName("notes").setDescription("Instructions").setRequired(true))
    ),

  // STUDENT TOOLS
  new SlashCommandBuilder()
    .setName("student")
    .setDescription("Student tools")
    .addSubcommand((s) =>
      s
        .setName("here")
        .setDescription("Mark yourself present")
        .addStringOption((o) => o.setName("session_id").setDescription("Session ID").setRequired(true))
        .addStringOption((o) =>
          o
            .setName("status")
            .setDescription("Status")
            .setRequired(true)
            .addChoices(
              { name: "Present", value: "present" },
              { name: "Late", value: "late" },
              { name: "Excused", value: "excused" }
            )
        )
    )
    .addSubcommand((s) =>
      s
        .setName("pass_request")
        .setDescription("Request a pass (student)")
        .addStringOption((o) =>
          o
            .setName("reason")
            .setDescription("Where are you going?")
            .setRequired(true)
            .addChoices(
              { name: "Nurse", value: "nurse" },
              { name: "Counselor", value: "counselor" },
              { name: "Office", value: "office" },
              { name: "Bathroom", value: "bathroom" },
              { name: "Early Pickup", value: "pickup" }
            )
        )
        .addStringOption((o) => o.setName("details").setDescription("Optional details").setRequired(false))
    ),

  // NURSE QUEUE
  new SlashCommandBuilder()
    .setName("nurse")
    .setDescription("Nurse station tools")
    .addSubcommand((s) =>
      s
        .setName("checkin")
        .setDescription("Check in with nurse")
        .addStringOption((o) => o.setName("reason").setDescription("Why?").setRequired(true))
    )
    .addSubcommand((s) => s.setName("next").setDescription("Call next student (nurse/staff)")),

  // STAFF DECISIONS / EXPORTS
  new SlashCommandBuilder()
    .setName("staff")
    .setDescription("Staff tools")
    .addSubcommand((s) =>
      s
        .setName("pass_decide")
        .setDescription("Approve/deny a pass (staff)")
        .addStringOption((o) => o.setName("pass_id").setDescription("Pass ID").setRequired(true))
        .addStringOption((o) =>
          o
            .setName("decision")
            .setDescription("Decision")
            .setRequired(true)
            .addChoices({ name: "Approve", value: "approved" }, { name: "Deny", value: "denied" })
        )
        .addStringOption((o) => o.setName("notes").setDescription("Optional notes").setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName("export_attendance")
        .setDescription("Export attendance as CSV")
        .addStringOption((o) => o.setName("session_id").setDescription("Session ID").setRequired(true))
    ),
].map((c) => c.toJSON());

// -------------------- COMMAND REGISTRATION --------------------
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commandDefs });
  console.log("✅ Oscar commands registered (guild scope).");
}

// -------------------- DAILY SCHEDULERS --------------------
let lastDailyBulletinKey = null;
let lastDailyPromptKey = null;

async function postAutoBulletin(guild) {
  const ch = await fetchTextChannel(guild, OSCAR_CALENDAR_CHANNEL_ID);
  if (!ch) return;

  const parts = getLocalParts();
  const day = parts.weekday;
  const blocks = scheduleStore.weekSchedule?.[day] || [];

  const eb = embedBase("Daily Bulletin", `**${day}** — Lifeline Academy`).addFields(
    { name: "Today’s Schedule", value: safeSlice(scheduleToText(blocks), 1024) || "No schedule posted yet." },
    { name: "Reminder", value: "Stay respectful, stay in character, and ask staff if you need help." }
  );

  await ch.send({ embeds: [eb] });
  await oscarLog(guild, `📰 Auto bulletin posted for ${day}.`);
}

async function postAutoPrompt(guild) {
  const ch = await fetchTextChannel(guild, OSCAR_STUDENT_LOUNGE_CHANNEL_ID);
  if (!ch) return;

  const prompt = randomFrom(promptStore.prompts) || "Create a respectful RP scene that fits school life.";
  const eb = embedBase("Daily RP Prompt", prompt);

  await ch.send({ embeds: [eb] });
  promptStore.lastPostedAt = nowISO();
  saveJson(FILE_PROMPTS, promptStore);
  await oscarLog(guild, "🦉 Auto daily prompt posted.");
}

async function runDailySchedulers() {
  if (!client.isReady()) return;
  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (!guild) return;

  const { hour, minute, ymd } = getLocalParts();

  if (hour === OSCAR_DAILY_BULLETIN_HOUR && minute === 0) {
    const key = `${ymd}:bulletin`;
    if (key !== lastDailyBulletinKey) {
      lastDailyBulletinKey = key;
      await postAutoBulletin(guild);
    }
  }

  if (hour === OSCAR_DAILY_PROMPT_HOUR && minute === 0) {
    const key = `${ymd}:prompt`;
    if (key !== lastDailyPromptKey) {
      lastDailyPromptKey = key;
      await postAutoPrompt(guild);
    }
  }
}

// -------------------- Interaction handlers --------------------
function buildStatusButtons(type, sl_username) {
  const openTicket = new ButtonBuilder()
    .setCustomId(`oscar_open_ticket:${type}:${encodeURIComponent(sl_username)}`)
    .setLabel("Open Question Ticket")
    .setStyle(ButtonStyle.Primary);

  const refresh = new ButtonBuilder()
    .setCustomId(`oscar_refresh_status:${type}:${encodeURIComponent(sl_username)}`)
    .setLabel("Refresh Status")
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder().addComponents(openTicket, refresh);
}

function safePublicStatusFields(record) {
  // Only fields intended for the applicant
  return {
    status: record.status || "Pending",
    tuition_status: record.tuition_status || "N/A",
    next_steps: record.next_steps || "No next steps listed yet. Staff will contact you after review.",
  };
}

function extractRecord(headers, row) {
  const get = (key) => {
    const idx = findHeaderIndex(headers, key);
    if (idx < 0) return "";
    return row[idx] ?? "";
  };

  return {
    sl_username: get("sl_username"),
    discord_id: get("discord_id"),
    status: get("status"),
    tuition_status: get("tuition_status"),
    next_steps: get("next_steps"),
    staff_notes: get("staff_notes"),
    last_updated: get("last_updated"),
  };
}

async function replyStatus(interaction, type, slUsername) {
  const spreadsheetId = type === "student" ? STUDENT_SHEET_ID : TEACHER_SHEET_ID;

  // Defer because Google calls can take >3s
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
  }

  const result = await findRowBySlUsername(spreadsheetId, slUsername);
  if (!result.found) {
    const msg = `❌ I couldn't find **${slUsername}** in the ${type} sheet.\n\nIf you recently applied, it can take a moment to appear. You can also open a ticket for help.`;
    return interaction.editReply({ content: msg }).catch(() => {});
  }

  const record = extractRecord(result.headers, result.row);
  const publicFields = safePublicStatusFields(record);

  // If discord_id exists and does not match, block unless staff
  const member = interaction.member;
  const isStaff = interaction.inGuild() ? isTeacher(member) : false;

  if (record.discord_id && String(record.discord_id).trim() && String(record.discord_id).trim() !== interaction.user.id && !isStaff) {
    return interaction.editReply({
      content: "⚠️ This application record is already linked to a different Discord account. Please open a ticket so staff can verify you.",
      components: [buildStatusButtons(type, slUsername)],
    }).catch(() => {});
  }

  const eb = embedBase(
    type === "student" ? "Student Enrollment Status" : "Teacher Application Status",
    `**SL Username:** ${safeSlice(slUsername, 200)}`
  ).addFields(
    { name: "Status", value: safeSlice(publicFields.status || "Pending", 200), inline: true },
    ...(type === "student" ? [{ name: "Tuition", value: safeSlice(publicFields.tuition_status || "N/A", 200), inline: true }] : []),
    { name: "Next Steps", value: safeSlice(publicFields.next_steps || "No next steps listed yet.", 1000), inline: false }
  );

  // Staff-only extra field (internal)
  if (isStaff && record.staff_notes) {
    eb.addFields({ name: "Staff Notes (internal)", value: safeSlice(record.staff_notes, 1000) });
  }

  return interaction.editReply({
    embeds: [eb],
    components: [buildStatusButtons(type, slUsername)],
    content: "",
  }).catch(() => {});
}

// -------------------- Main InteractionCreate --------------------
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Buttons
    if (interaction.isButton()) {
      if (!requireScopeOrReply(interaction)) return;

      const [kind, a, b, c] = interaction.customId.split(":");
      const guild = interaction.guild;

      if (kind === "oscar_ticket_close") {
        const ticketId = a;
        if (!interaction.inGuild() || !guild) return interaction.reply({ ephemeral: true, content: "Ticket close can only be used in-server." });

        const member = interaction.member;
        if (!isTeacher(member)) return interaction.reply({ ephemeral: true, content: "❌ Staff only." });

        await interaction.reply({ ephemeral: true, content: "✅ Closing ticket..." }).catch(() => {});
        const ch = await guild.channels.fetch(ticketId).catch(() => null);
        if (ch) {
          await ch.send({ content: "✅ Ticket closed by staff. Thank you!" }).catch(() => {});
          await ch.delete("Oscar ticket closed").catch(() => {});
        }
        return;
      }

      if (kind === "oscar_open_ticket") {
        const type = a;
        const sl = decodeURIComponent(b || "");
        await interaction.deferReply({ ephemeral: true }).catch(() => {});

        if (!interaction.inGuild() || !guild) {
          return interaction.editReply({ content: "Please use this inside the server so I can create a private ticket channel." }).catch(() => {});
        }

        // Pull current status for embed context (best effort)
        let context = { type: type === "student" ? "Student" : "Teacher", sl_username: sl, status: "Pending", next_steps: "" };
        try {
          const spreadsheetId = type === "student" ? STUDENT_SHEET_ID : TEACHER_SHEET_ID;
          const result = await findRowBySlUsername(spreadsheetId, sl);
          if (result.found) {
            const record = extractRecord(result.headers, result.row);
            const publicFields = safePublicStatusFields(record);
            context.status = publicFields.status || "Pending";
            context.next_steps = publicFields.next_steps || "";
          }
        } catch {}

        const ticket = await createPreAccessTicket(guild, interaction.user, context);
        await oscarLog(guild, `🎫 Ticket created for ${interaction.user.tag} (${type}:${sl}) -> #${ticket.name}`);

        return interaction.editReply({
          content: `✅ Ticket created: <#${ticket.id}>\nStaff will reply there. You can keep this channel open until your question is handled.`,
        }).catch(() => {});
      }

      if (kind === "oscar_refresh_status") {
        const type = a;
        const sl = decodeURIComponent(b || "");
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        return replyStatus(interaction, type, sl);
      }

      return;
    }

    // Slash Commands
    if (!interaction.isChatInputCommand()) return;
    if (!requireScopeOrReply(interaction)) return;

    const member = interaction.member;
    const guild = interaction.guild;

    // /oscar
    if (interaction.commandName === "oscar") {
      const sub = interaction.options.getSubcommand(false);
      const group = interaction.options.getSubcommandGroup(false);

      if (sub === "ping") {
        return interaction.reply({ ephemeral: true, content: "✅ Oscar is awake. (Academy systems online)" });
      }

      if (sub === "help") {
        const eb = embedBase(
          "Oscar Help",
          "Oscar runs **Lifeline Academy** routines, schedules, prompts, classroom tools, and live application status.\n\n" +
            "Applicants:\n" +
            "• `/academy student-status`\n" +
            "• `/academy teacher-status`\n\n" +
            "Students:\n" +
            "• `/student here`\n" +
            "• `/student pass_request`\n\n" +
            "Teachers/Staff:\n" +
            "• `/class attendance_start`\n" +
            "• `/oscar announce`\n" +
            "• `/academy approve-student` / `confirm-tuition` / `approve-teacher`\n"
        );
        return interaction.reply({ ephemeral: true, embeds: [eb] });
      }

      if (sub === "config") {
        if (!isTeacher(member)) return interaction.reply({ ephemeral: true, content: "❌ Staff only." });

        const eb = embedBase("Oscar Config", "Current environment mapping (IDs):").addFields(
          { name: "Allowed Category IDs", value: OSCAR_ALLOWED_CATEGORY_IDS.length ? OSCAR_ALLOWED_CATEGORY_IDS.join(", ") : "Not set (all channels allowed)" },
          { name: "Log Channel", value: OSCAR_LOG_CHANNEL_ID ? `<#${OSCAR_LOG_CHANNEL_ID}>` : "Not set" },
          { name: "Ticket Category", value: OSCAR_TICKET_CATEGORY_ID ? `<#${OSCAR_TICKET_CATEGORY_ID}>` : "Not set" },
          { name: "Welcome", value: OSCAR_WELCOME_CHANNEL_ID ? `<#${OSCAR_WELCOME_CHANNEL_ID}>` : "Not set" },
          { name: "Rules", value: OSCAR_RULES_CHANNEL_ID ? `<#${OSCAR_RULES_CHANNEL_ID}>` : "Not set" },
          { name: "Announcements", value: OSCAR_ANNOUNCE_CHANNEL_ID ? `<#${OSCAR_ANNOUNCE_CHANNEL_ID}>` : "Not set" },
          { name: "Calendar", value: OSCAR_CALENDAR_CHANNEL_ID ? `<#${OSCAR_CALENDAR_CHANNEL_ID}>` : "Not set" },
          { name: "Handbook", value: OSCAR_HANDBOOK_CHANNEL_ID ? `<#${OSCAR_HANDBOOK_CHANNEL_ID}>` : "Not set" },
          { name: "Enrollment", value: OSCAR_ENROLL_CHANNEL_ID ? `<#${OSCAR_ENROLL_CHANNEL_ID}>` : "Not set" },
          { name: "Student Lounge", value: OSCAR_STUDENT_LOUNGE_CHANNEL_ID ? `<#${OSCAR_STUDENT_LOUNGE_CHANNEL_ID}>` : "Not set" },
          { name: "Pictures", value: OSCAR_PICTURES_CHANNEL_ID ? `<#${OSCAR_PICTURES_CHANNEL_ID}>` : "Not set" },
          { name: "Teacher Role", value: OSCAR_TEACHER_ROLE_ID || "Not set" },
          { name: "Admin Role", value: OSCAR_ADMIN_ROLE_ID || "Not set" },
          { name: "Nurse Role", value: OSCAR_NURSE_ROLE_ID || "Not set" },
          { name: "Student Sheet", value: STUDENT_SHEET_ID || "Not set" },
          { name: "Teacher Sheet", value: TEACHER_SHEET_ID || "Not set" }
        );

        return interaction.reply({ ephemeral: true, embeds: [eb] });
      }

      if (sub === "announce") {
        if (!isTeacher(member)) return interaction.reply({ ephemeral: true, content: "❌ Teachers/staff only." });

        const title = safeSlice(interaction.options.getString("title", true), 200);
        const msg = safeSlice(interaction.options.getString("message", true), 3500);
        const pingEveryone = interaction.options.getBoolean("ping_everyone") || false;

        const ch = (await fetchTextChannel(guild, OSCAR_ANNOUNCE_CHANNEL_ID)) || interaction.channel;
        if (!ch || ch.type !== ChannelType.GuildText) {
          return interaction.reply({ ephemeral: true, content: "❌ Announcement channel not available." });
        }

        await ch.send({ content: pingEveryone ? "@everyone" : undefined, embeds: [embedBase(title, msg)] });
        await oscarLog(guild, `📣 Announcement by ${interaction.user.tag}: ${title}`);
        return interaction.reply({ ephemeral: true, content: "✅ Announcement posted." });
      }

      if (sub === "bulletin") {
        if (!isTeacher(member)) return interaction.reply({ ephemeral: true, content: "❌ Teachers/staff only." });

        const msg = safeSlice(interaction.options.getString("message", true), 3500);
        const ch = (await fetchTextChannel(guild, OSCAR_CALENDAR_CHANNEL_ID)) || interaction.channel;
        if (!ch || ch.type !== ChannelType.GuildText) {
          return interaction.reply({ ephemeral: true, content: "❌ Calendar channel not available." });
        }

        await ch.send({ embeds: [embedBase("Daily Bulletin", msg)] });
        await oscarLog(guild, `📰 Bulletin posted by ${interaction.user.tag}`);
        return interaction.reply({ ephemeral: true, content: "✅ Bulletin posted." });
      }

      if (sub === "welcome_post") {
        if (!isTeacher(member)) return interaction.reply({ ephemeral: true, content: "❌ Staff only." });
        const ok = await postWelcome(guild);
        return interaction.reply({ ephemeral: true, content: ok ? "✅ Welcome posted." : "❌ Welcome channel not set." });
      }

      if (sub === "rules_post") {
        if (!isTeacher(member)) return interaction.reply({ ephemeral: true, content: "❌ Staff only." });
        const ok = await postRules(guild);
        return interaction.reply({ ephemeral: true, content: ok ? "✅ Rules posted." : "❌ Rules channel not set." });
      }

      if (sub === "handbook_post") {
        if (!isTeacher(member)) return interaction.reply({ ephemeral: true, content: "❌ Staff only." });
        const ok = await postHandbook(guild);
        return interaction.reply({ ephemeral: true, content: ok ? "✅ Handbook posted." : "❌ Handbook channel not set." });
      }

      if (sub === "enrollment_post") {
        if (!isTeacher(member)) return interaction.reply({ ephemeral: true, content: "❌ Staff only." });
        const ok = await postEnrollment(guild);
        return interaction.reply({ ephemeral: true, content: ok ? "✅ Enrollment posted." : "❌ Enrollment channel not set." });
      }

      if (group === "schedule") {
        const schedSub = interaction.options.getSubcommand(true);

        if (schedSub === "today") {
          const parts = getLocalParts();
          const day = parts.weekday;
          const blocks = scheduleStore.weekSchedule?.[day] || [];
          const eb = embedBase("Today's Schedule", `**${day}**`).addFields({ name: "Blocks", value: safeSlice(scheduleToText(blocks), 1024) });
          return interaction.reply({ ephemeral: false, embeds: [eb] });
        }

        if (schedSub === "week") {
          const eb = embedBase("Weekly Schedule", "Lifeline Academy weekly overview.");
          for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]) {
            const blocks = scheduleStore.weekSchedule?.[day] || [];
            eb.addFields({ name: day, value: safeSlice(scheduleToText(blocks), 1024) });
          }
          return interaction.reply({ ephemeral: false, embeds: [eb] });
        }

        if (schedSub === "set") {
          if (!isTeacher(member)) return interaction.reply({ ephemeral: true, content: "❌ Teachers/staff only." });

          const day = interaction.options.getString("day", true);
          const label = safeSlice(interaction.options.getString("label", true), 200);
          const details = safeSlice(interaction.options.getString("details", true), 900);
          const position = interaction.options.getInteger("position") || null;

          if (!scheduleStore.weekSchedule[day]) scheduleStore.weekSchedule[day] = [];
          const arr = scheduleStore.weekSchedule[day];

          const block = { label, details, updatedAt: nowISO(), updatedBy: interaction.user.tag };

          if (position && position >= 1 && position <= 20) arr.splice(position - 1, 0, block);
          else arr.push(block);

          scheduleStore.lastUpdatedAt = nowISO();
          saveJson(FILE_SCHEDULE, scheduleStore);

          await oscarLog(guild, `📅 Schedule updated by ${interaction.user.tag} (${day}): ${label}`);
          return interaction.reply({ ephemeral: true, content: `✅ Added schedule block for **${day}**.` });
        }

        if (schedSub === "clear") {
          if (!isAdmin(member)) return interaction.reply({ ephemeral: true, content: "❌ Admin only." });

          const day = interaction.options.getString("day", true);
          scheduleStore.weekSchedule[day] = [];
          scheduleStore.lastUpdatedAt = nowISO();
          saveJson(FILE_SCHEDULE, scheduleStore);

          await oscarLog(guild, `🧹 Schedule cleared for ${day} by ${interaction.user.tag}`);
          return interaction.reply({ ephemeral: true, content: `✅ Cleared schedule for **${day}**.` });
        }
      }

      if (sub === "prompt") {
        const post = interaction.options.getBoolean("post") || false;
        const prompt = randomFrom(promptStore.prompts) || "Create a respectful RP scene that fits school life.";
        const eb = embedBase("RP Prompt", prompt);

        if (post) {
          if (!isTeacher(member)) return interaction.reply({ ephemeral: true, content: "❌ Staff only." });

          const ch = (await fetchTextChannel(guild, OSCAR_STUDENT_LOUNGE_CHANNEL_ID)) || interaction.channel;
          if (!ch || ch.type !== ChannelType.GuildText) {
            return interaction.reply({ ephemeral: true, content: "❌ Student lounge channel not available." });
          }

          await ch.send({ embeds: [eb] });
          promptStore.lastPostedAt = nowISO();
          saveJson(FILE_PROMPTS, promptStore);

          await oscarLog(guild, `🦉 Prompt posted by ${interaction.user.tag}`);
          return interaction.reply({ ephemeral: true, content: "✅ Prompt posted." });
        }

        return interaction.reply({ ephemeral: true, embeds: [eb] });
      }

      if (sub === "portal") {
        const type = interaction.options.getString("type", true);
        let url = "";
        if (type === "student") url = ACADEMY_STUDENT_PORTAL_URL;
        if (type === "teacher") url = ACADEMY_TEACHER_PORTAL_URL;
        if (type === "parent") url = ACADEMY_PARENT_PORTAL_URL;
        if (type === "admin") url = ACADEMY_ADMIN_PORTAL_URL;

        if (!url) return interaction.reply({ ephemeral: true, content: "⚠️ Portal link not configured yet." });
        return interaction.reply({ ephemeral: true, embeds: [embedBase("Academy Portal", `Here is the **${type}** portal link:\n${url}`)] });
      }
    }

    // /academy (applications)
    if (interaction.commandName === "academy") {
      const sub = interaction.options.getSubcommand(true);

      if (sub === "student-status") {
        const sl = interaction.options.getString("sl_username", true);
        return replyStatus(interaction, "student", sl);
      }

      if (sub === "teacher-status") {
        const sl = interaction.options.getString("sl_username", true);
        return replyStatus(interaction, "teacher", sl);
      }

      // staff-only below
      if (!isTeacher(member)) {
        return interaction.reply({ ephemeral: true, content: "❌ Staff only." });
      }

      if (sub === "register-discord") {
        const type = interaction.options.getString("type", true);
        const sl = interaction.options.getString("sl_username", true);
        const user = interaction.options.getUser("user", true);

        const spreadsheetId = type === "student" ? STUDENT_SHEET_ID : TEACHER_SHEET_ID;

        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        const result = await findRowBySlUsername(spreadsheetId, sl);
        if (!result.found) return interaction.editReply({ content: `❌ Could not find **${sl}** in the ${type} sheet.` });

        await updateRowFields(spreadsheetId, result.tab, result.headers, result.rowIndex1Based, {
          discord_id: user.id,
          last_updated: nowISO(),
          staff_notes: `Linked to Discord: ${user.tag} (${user.id}) by ${interaction.user.tag}`,
        });

        await oscarLog(guild, `🔗 Linked ${type} ${sl} -> ${user.tag} by ${interaction.user.tag}`);
        return interaction.editReply({ content: `✅ Linked **${sl}** to **${user.tag}** (\`${user.id}\`).` });
      }

      if (sub === "approve-student") {
        const sl = interaction.options.getString("sl_username", true);
        const nextSteps = interaction.options.getString("next_steps") || "You have been approved. Please complete tuition payment to finalize enrollment. If you need help, open a ticket.";

        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        const result = await findRowBySlUsername(STUDENT_SHEET_ID, sl);
        if (!result.found) return interaction.editReply({ content: `❌ Could not find **${sl}** in the student sheet.` });

        const record = extractRecord(result.headers, result.row);
        await updateRowFields(STUDENT_SHEET_ID, result.tab, result.headers, result.rowIndex1Based, {
          status: "Approved",
          next_steps: nextSteps,
          last_updated: nowISO(),
          staff_notes: `Approved by ${interaction.user.tag}`,
          ...(record.tuition_status ? {} : {}), // no-op; keeps compatibility
        });

        // DM applicant (prefer discord_id if linked, else DM command user if they are the applicant)
        let dmUser = null;
        if (record.discord_id) dmUser = await client.users.fetch(String(record.discord_id).trim()).catch(() => null);
        if (!dmUser) dmUser = interaction.user;

        await safeDM(dmUser, `🦉 Lifeline Academy — Student Application Update\n\nSL Username: ${sl}\nStatus: APPROVED\n\nNext Steps:\n${nextSteps}`);

        await oscarLog(guild, `✅ Student approved: ${sl} by ${interaction.user.tag}`);
        return interaction.editReply({ content: `✅ Approved student **${sl}** and sent DM (if possible).` });
      }

      if (sub === "deny-student") {
        const sl = interaction.options.getString("sl_username", true);
        const reason = interaction.options.getString("reason", true);

        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        const result = await findRowBySlUsername(STUDENT_SHEET_ID, sl);
        if (!result.found) return interaction.editReply({ content: `❌ Could not find **${sl}** in the student sheet.` });

        const record = extractRecord(result.headers, result.row);
        await updateRowFields(STUDENT_SHEET_ID, result.tab, result.headers, result.rowIndex1Based, {
          status: "Denied",
          next_steps: `Your application was denied. Reason: ${reason}`,
          last_updated: nowISO(),
          staff_notes: `Denied by ${interaction.user.tag} — ${reason}`,
        });

        let dmUser = null;
        if (record.discord_id) dmUser = await client.users.fetch(String(record.discord_id).trim()).catch(() => null);
        if (!dmUser) dmUser = interaction.user;

        await safeDM(dmUser, `🦉 Lifeline Academy — Student Application Update\n\nSL Username: ${sl}\nStatus: DENIED\n\nReason:\n${reason}\n\nIf you have questions, you may open a ticket.`);

        await oscarLog(guild, `❌ Student denied: ${sl} by ${interaction.user.tag}`);
        return interaction.editReply({ content: `✅ Denied student **${sl}** and sent DM (if possible).` });
      }

      if (sub === "confirm-tuition") {
        const sl = interaction.options.getString("sl_username", true);
        const notes = interaction.options.getString("notes") || "";

        const nextSteps = "Tuition confirmed. Your enrollment is being finalized. Staff will grant access and provide orientation details shortly.";

        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        const result = await findRowBySlUsername(STUDENT_SHEET_ID, sl);
        if (!result.found) return interaction.editReply({ content: `❌ Could not find **${sl}** in the student sheet.` });

        const record = extractRecord(result.headers, result.row);
        await updateRowFields(STUDENT_SHEET_ID, result.tab, result.headers, result.rowIndex1Based, {
          tuition_status: "Paid",
          status: "Enrollment Complete",
          next_steps: nextSteps,
          last_updated: nowISO(),
          staff_notes: `Tuition confirmed by ${interaction.user.tag}${notes ? ` — ${notes}` : ""}`,
        });

        let dmUser = null;
        if (record.discord_id) dmUser = await client.users.fetch(String(record.discord_id).trim()).catch(() => null);
        if (!dmUser) dmUser = interaction.user;

        await safeDM(dmUser, `🦉 Lifeline Academy — Tuition Confirmation\n\nSL Username: ${sl}\nTuition: PAID\nStatus: ENROLLMENT COMPLETE\n\nNext Steps:\n${nextSteps}`);

        await oscarLog(guild, `💰 Tuition confirmed: ${sl} by ${interaction.user.tag}`);
        return interaction.editReply({ content: `✅ Confirmed tuition for **${sl}** and sent DM (if possible).` });
      }

      if (sub === "approve-teacher") {
        const sl = interaction.options.getString("sl_username", true);
        const nextSteps = interaction.options.getString("next_steps") || "You have been approved. Staff will follow up with training/orientation steps and access.";

        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        const result = await findRowBySlUsername(TEACHER_SHEET_ID, sl);
        if (!result.found) return interaction.editReply({ content: `❌ Could not find **${sl}** in the teacher sheet.` });

        const record = extractRecord(result.headers, result.row);
        await updateRowFields(TEACHER_SHEET_ID, result.tab, result.headers, result.rowIndex1Based, {
          status: "Approved",
          next_steps: nextSteps,
          last_updated: nowISO(),
          staff_notes: `Approved by ${interaction.user.tag}`,
        });

        let dmUser = null;
        if (record.discord_id) dmUser = await client.users.fetch(String(record.discord_id).trim()).catch(() => null);
        if (!dmUser) dmUser = interaction.user;

        await safeDM(dmUser, `🦉 Lifeline Academy — Teacher Application Update\n\nSL Username: ${sl}\nStatus: APPROVED\n\nNext Steps:\n${nextSteps}`);

        await oscarLog(guild, `✅ Teacher approved: ${sl} by ${interaction.user.tag}`);
        return interaction.editReply({ content: `✅ Approved teacher **${sl}** and sent DM (if possible).` });
      }

      if (sub === "deny-teacher") {
        const sl = interaction.options.getString("sl_username", true);
        const reason = interaction.options.getString("reason", true);

        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        const result = await findRowBySlUsername(TEACHER_SHEET_ID, sl);
        if (!result.found) return interaction.editReply({ content: `❌ Could not find **${sl}** in the teacher sheet.` });

        const record = extractRecord(result.headers, result.row);
        await updateRowFields(TEACHER_SHEET_ID, result.tab, result.headers, result.rowIndex1Based, {
          status: "Denied",
          next_steps: `Your application was denied. Reason: ${reason}`,
          last_updated: nowISO(),
          staff_notes: `Denied by ${interaction.user.tag} — ${reason}`,
        });

        let dmUser = null;
        if (record.discord_id) dmUser = await client.users.fetch(String(record.discord_id).trim()).catch(() => null);
        if (!dmUser) dmUser = interaction.user;

        await safeDM(dmUser, `🦉 Lifeline Academy — Teacher Application Update\n\nSL Username: ${sl}\nStatus: DENIED\n\nReason:\n${reason}\n\nIf you have questions, you may open a ticket.`);

        await oscarLog(guild, `❌ Teacher denied: ${sl} by ${interaction.user.tag}`);
        return interaction.editReply({ content: `✅ Denied teacher **${sl}** and sent DM (if possible).` });
      }
    }

    // /class (teacher tools)
    if (interaction.commandName === "class") {
      const sub = interaction.options.getSubcommand(true);
      if (!isTeacher(member)) return interaction.reply({ ephemeral: true, content: "❌ Teachers/staff only." });

      if (sub === "attendance_start") {
        const className = safeSlice(interaction.options.getString("class_name", true), 200);
        const sessionId = `S${Date.now().toString(36).toUpperCase()}`;

        attendanceStore.sessions[sessionId] = {
          className,
          channelId: interaction.channelId,
          teacherId: interaction.user.id,
          teacherTag: interaction.user.tag,
          openAt: nowISO(),
          closedAt: null,
          present: {},
        };
        saveJson(FILE_ATTENDANCE, attendanceStore);

        const eb = embedBase(
          "Attendance Open",
          `**Class:** ${className}\n**Session ID:** \`${sessionId}\`\n\nStudents use:\n\`/student here session_id:${sessionId} status:Present\``
        );

        await oscarLog(guild, `🧾 Attendance started ${sessionId} (${className}) by ${interaction.user.tag}`);
        return interaction.reply({ ephemeral: false, embeds: [eb] });
      }

      if (sub === "attendance_close") {
        const sessionId = interaction.options.getString("session_id", true).trim();
        const s = attendanceStore.sessions[sessionId];
        if (!s) return interaction.reply({ ephemeral: true, content: "❌ Session not found." });
        if (s.closedAt) return interaction.reply({ ephemeral: true, content: "⚠️ This session is already closed." });

        s.closedAt = nowISO();
        saveJson(FILE_ATTENDANCE, attendanceStore);

        const entries = Object.entries(s.present || {});
        const present = entries.filter(([, v]) => v.status === "present").length;
        const late = entries.filter(([, v]) => v.status === "late").length;
        const excused = entries.filter(([, v]) => v.status === "excused").length;

        const eb = embedBase("Attendance Closed", `**Class:** ${s.className}\n**Session ID:** \`${sessionId}\``).addFields(
          { name: "Totals", value: `Present: **${present}**\nLate: **${late}**\nExcused: **${excused}**` },
          { name: "Export", value: `Use: \`/staff export_attendance session_id:${sessionId}\`` }
        );

        await oscarLog(guild, `✅ Attendance closed ${sessionId} by ${interaction.user.tag}`);
        return interaction.reply({ ephemeral: false, embeds: [eb] });
      }

      if (sub === "timer") {
        const minutes = interaction.options.getInteger("minutes", true);
        const label = safeSlice(interaction.options.getString("label") || "Class Timer", 200);

        await interaction.reply({ ephemeral: false, content: `⏳ **${label}** started for **${minutes} minute(s)**.` });
        setTimeout(async () => {
          try {
            await interaction.followUp({ content: `⏰ **Time's up!** (${label})` });
          } catch {}
        }, minutes * 60 * 1000);
        return;
      }

      if (sub === "groups") {
        const size = interaction.options.getInteger("size", true);
        const mentionsRaw = interaction.options.getString("mentions", true);
        const ids = Array.from(mentionsRaw.matchAll(/<@!?(\d+)>/g)).map((m) => m[1]);
        if (ids.length < size) return interaction.reply({ ephemeral: true, content: "❌ Not enough mentions for that group size." });

        for (let i = ids.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [ids[i], ids[j]] = [ids[j], ids[i]];
        }

        const groups = [];
        for (let i = 0; i < ids.length; i += size) groups.push(ids.slice(i, i + size));

        const lines = groups.map((g, idx) => `**Group ${idx + 1}:** ${g.map((id) => `<@${id}>`).join(" ")}`);
        const eb = embedBase("Random Groups", `Group size: **${size}**`).addFields({ name: "Groups", value: safeSlice(lines.join("\n"), 1024) });

        await oscarLog(guild, `👥 Groups generated by ${interaction.user.tag} (${groups.length} groups)`);
        return interaction.reply({ ephemeral: false, embeds: [eb] });
      }

      if (sub === "shoutout") {
        const student = interaction.options.getUser("student", true);
        const reason = safeSlice(interaction.options.getString("reason", true), 400);

        const ch = (await fetchTextChannel(guild, OSCAR_PICTURES_CHANNEL_ID)) || interaction.channel;
        if (!ch || ch.type !== ChannelType.GuildText) {
          return interaction.reply({ ephemeral: true, content: "❌ Pictures channel not available." });
        }

        const eb = embedBase("Student Spotlight", `🌟 Spotlight: ${student}\n\n**Reason:** ${reason}`).addFields({
          name: "Recognized By",
          value: interaction.user.toString(),
          inline: true,
        });

        await ch.send({ embeds: [eb] });
        await oscarLog(guild, `🌟 Spotlight posted for ${student.tag} by ${interaction.user.tag}`);
        return interaction.reply({ ephemeral: true, content: "✅ Spotlight posted." });
      }

      if (interaction.options.getSubcommandGroup(false) === "points") {
        const sub2 = interaction.options.getSubcommand(true);

        if (sub2 === "add") {
          const student = interaction.options.getUser("student", true);
          const amount = interaction.options.getInteger("amount", true);
          const reason = safeSlice(interaction.options.getString("reason", true), 200);

          if (!pointsStore.points[student.id]) pointsStore.points[student.id] = { total: 0, history: [] };
          pointsStore.points[student.id].total += amount;
          pointsStore.points[student.id].history.unshift({ at: nowISO(), delta: amount, reason, by: interaction.user.tag });
          pointsStore.points[student.id].history = pointsStore.points[student.id].history.slice(0, 50);
          saveJson(FILE_POINTS, pointsStore);

          await oscarLog(guild, `🏆 Points ${amount} -> ${student.tag} (${reason}) by ${interaction.user.tag}`);
          return interaction.reply({ ephemeral: true, content: `✅ Updated points for **${student.tag}** by **${amount}**.` });
        }

        if (sub2 === "leaderboard") {
          const entries = Object.entries(pointsStore.points || {})
            .map(([uid, v]) => ({ uid, total: v.total || 0 }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

          if (!entries.length) return interaction.reply({ ephemeral: true, content: "No points recorded yet." });

          const lines = entries.map((e, i) => `**${i + 1}.** <@${e.uid}> — **${e.total}** pts`);
          const eb = embedBase("Points Leaderboard", "Top students by points").addFields({ name: "Leaderboard", value: safeSlice(lines.join("\n"), 1024) });

          return interaction.reply({ ephemeral: false, embeds: [eb] });
        }
      }

      if (sub === "lesson_post") {
        const title = safeSlice(interaction.options.getString("title", true), 200);
        const grade = safeSlice(interaction.options.getString("grade", true), 100);
        const subject = safeSlice(interaction.options.getString("subject", true), 100);
        const quarter = safeSlice(interaction.options.getString("quarter", true), 10);

        const content = `📘 **Title:** ${title}
🎓 **Grade Level:** ${grade}
📚 **Subject:** ${subject}
📅 **Quarter:** ${quarter}
⏱️ **Duration:** 
📖 **Textbook Focus:** 
🎯 **Learning Objective:** 
🧠 **RP Application:** 
📝 **Activity / Steps:** 
📎 **Worksheet / Resource:** 
⭐ **Teacher Notes:**`;

        return interaction.reply({ ephemeral: false, content });
      }

      if (sub === "worksheet_post") {
        const title = safeSlice(interaction.options.getString("title", true), 200);
        const notes = safeSlice(interaction.options.getString("notes", true), 1500);

        const content = `🧾 **Worksheet Posted**
**Title:** ${title}

**Notes / Instructions:**
${notes}`;

        return interaction.reply({ ephemeral: false, content });
      }
    }

    // /student
    if (interaction.commandName === "student") {
      const sub = interaction.options.getSubcommand(true);

      if (sub === "here") {
        const sessionId = interaction.options.getString("session_id", true).trim();
        const status = interaction.options.getString("status", true);

        const s = attendanceStore.sessions[sessionId];
        if (!s) return interaction.reply({ ephemeral: true, content: "❌ Session not found." });
        if (s.closedAt) return interaction.reply({ ephemeral: true, content: "⚠️ This attendance session is closed." });

        s.present[interaction.user.id] = { at: nowISO(), status };
        saveJson(FILE_ATTENDANCE, attendanceStore);

        await oscarLog(guild, `🧾 Attendance mark: ${interaction.user.tag} => ${status} (${sessionId})`);
        return interaction.reply({ ephemeral: true, content: `✅ Marked **${status}** for session \`${sessionId}\`.` });
      }

      if (sub === "pass_request") {
        const reason = interaction.options.getString("reason", true);
        const details = safeSlice(interaction.options.getString("details") || "", 300);

        const passId = `P${Date.now().toString(36).toUpperCase()}`;
        passStore.passes[passId] = {
          userId: interaction.user.id,
          userTag: interaction.user.tag,
          reason,
          details,
          status: "pending",
          createdAt: nowISO(),
          decidedAt: null,
          decidedBy: null,
          notes: null,
        };
        saveJson(FILE_PASSES, passStore);

        await oscarLog(guild, `🚪 Pass requested ${passId} by ${interaction.user.tag} (${reason})`);
        return interaction.reply({
          ephemeral: true,
          content: `✅ Pass request submitted.\n**Pass ID:** \`${passId}\`\nStaff will review shortly.`,
        });
      }
    }

    // /nurse
    if (interaction.commandName === "nurse") {
      const sub = interaction.options.getSubcommand(true);

      if (sub === "checkin") {
        const reason = safeSlice(interaction.options.getString("reason", true), 200);
        nurseQueueStore.queue.push({ userId: interaction.user.id, userTag: interaction.user.tag, reason, at: nowISO() });
        saveJson(FILE_NURSE_QUEUE, nurseQueueStore);

        await oscarLog(guild, `🏥 Nurse check-in by ${interaction.user.tag}: ${reason}`);
        return interaction.reply({ ephemeral: true, content: "✅ You’re checked in. Please wait to be called." });
      }

      if (sub === "next") {
        if (!isNurse(member)) return interaction.reply({ ephemeral: true, content: "❌ Nurse/staff only." });

        const next = nurseQueueStore.queue.shift();
        saveJson(FILE_NURSE_QUEUE, nurseQueueStore);

        if (!next) return interaction.reply({ ephemeral: true, content: "Queue is empty." });

        await oscarLog(guild, `📣 Nurse calling next: ${next.userTag}`);
        return interaction.reply({ ephemeral: false, content: `🏥 **Nurse is ready for:** <@${next.userId}> (${next.reason})` });
      }
    }

    // /staff
    if (interaction.commandName === "staff") {
      const sub = interaction.options.getSubcommand(true);
      if (!isTeacher(member)) return interaction.reply({ ephemeral: true, content: "❌ Staff only." });

      if (sub === "pass_decide") {
        const passId = interaction.options.getString("pass_id", true).trim();
        const decision = interaction.options.getString("decision", true);
        const notes = safeSlice(interaction.options.getString("notes") || "", 300);

        const p = passStore.passes[passId];
        if (!p) return interaction.reply({ ephemeral: true, content: "❌ Pass not found." });
        if (p.status !== "pending") return interaction.reply({ ephemeral: true, content: `⚠️ Pass already decided: ${p.status}` });

        p.status = decision;
        p.decidedAt = nowISO();
        p.decidedBy = interaction.user.tag;
        p.notes = notes || null;
        saveJson(FILE_PASSES, passStore);

        const dmText = `Your pass request (**${passId}**) was **${decision.toUpperCase()}**.
Reason: ${p.reason}
${p.details ? `Details: ${p.details}\n` : ""}${notes ? `Notes: ${notes}\n` : ""}`;

        await client.users.fetch(p.userId).then((u) => u.send(dmText)).catch(() => {});
        await oscarLog(guild, `✅ Pass ${passId} => ${decision} by ${interaction.user.tag}`);

        return interaction.reply({ ephemeral: true, content: `✅ Pass **${passId}** marked **${decision}** and applicant was notified.` });
      }

      if (sub === "export_attendance") {
        const sessionId = interaction.options.getString("session_id", true).trim();
        const s = attendanceStore.sessions[sessionId];
        if (!s) return interaction.reply({ ephemeral: true, content: "❌ Session not found." });

        const rows = [["userId", "status", "timestamp"]];
        for (const [uid, v] of Object.entries(s.present || {})) rows.push([uid, v.status, v.at]);

        const csv = rows.map((r) => r.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(",")).join("\n");
        const tmpPath = path.join(DATA_DIR, `attendance_${sessionId}.csv`);
        fs.writeFileSync(tmpPath, csv, "utf8");

        await oscarLog(guild, `📤 Attendance exported ${sessionId} by ${interaction.user.tag}`);
        return interaction.reply({ ephemeral: true, content: `✅ Export ready for session \`${sessionId}\`.`, files: [tmpPath] });
      }
    }
  } catch (e) {
    console.error("❌ Interaction error:", e);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ ephemeral: true, content: "❌ Oscar hit an error while processing that. Check logs." });
      } else {
        await interaction.reply({ ephemeral: true, content: "❌ Oscar hit an error while processing that. Check logs." });
      }
    } catch {}
  }
});

// -------------------- READY --------------------
client.once(Events.ClientReady, async () => {
  console.log(`✅ Oscar logged in as ${client.user.tag}`);
  try {
    await registerCommands();
  } catch (e) {
    console.error("❌ Command registration error:", e);
  }

  // Daily schedulers: checks every 20 seconds (lightweight).
  setInterval(runDailySchedulers, 20 * 1000);

  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (guild) await oscarLog(guild, "🦉 Oscar is online. Lifeline Academy systems ready.");
});

// -------------------- KEEP-ALIVE SERVER (Web Service friendly) --------------------
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Oscar Bot is alive 🦉");
  })
  .listen(PORT, () => console.log(`🌐 Keep-alive server running on port ${PORT}`));

// -------------------- LOGIN --------------------
client.login(DISCORD_TOKEN);
