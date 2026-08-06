/* Corrects the live availability board in #Booking-and-Reservations.
 *
 * The HUD endpoint /api/cruise/cabins/available only counts cabins that have been
 * PHYSICALLY ASSIGNED an id, so an approved booking that hasn't had a cabin handed to
 * it yet reads as free — it overstates what we can actually sell.
 *
 * This replicates index.js cabinAvailability() instead — the same math /book shows
 * guests: every ACTIVE booking of a type reserves a unit whether or not a cabin id
 * exists yet. Neon is the source of truth.
 */
const fs = require("fs");
const { Client } = require("pg");

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv("./oscar-bot.env");
const TOKEN = env.DISCORD_TOKEN;
const API = "https://discord.com/api/v10";

const CHANNEL_ID = "1522402217880190976";
const BOARD_MESSAGE_ID = "1533183241127727246"; // the board posted earlier

const DEAD = ["cancelled_non_payment", "cancelled", "closed", "denied", "expired", "checked_out"];
const CHECKOUT_GRACE_MS = 2 * 60 * 60 * 1000;
const PAYMENT_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const INVENTORY = 8;
const s = (v) => (v == null ? "" : String(v));

const NAME_TO_KEY = { "Standard Cabin": "standard", "Couple Cabin": "couple", "Family Cabin": "family" };
const cabinKeyFromValue = (v) =>
  NAME_TO_KEY[s(v).trim()] || s(v).trim().toLowerCase().replace(/\s+cabin$/, "").replace(/\s+/g, "");
const bookingCabinKey = (r) => r?.cabinKey || cabinKeyFromValue(r?.cabinType || r?.tags?.cabin || "");

function isActiveBookingRecord(r) {
  if (!r) return false;
  const status = s(r.status || "submitted").toLowerCase();
  if (DEAD.includes(status)) return false;
  if (!r.approvedAt && !r.boardingPassSentAt && ["submitted", "payment_marked"].includes(status)) {
    const opened = Date.parse(r.openedAt || "");
    if (Number.isFinite(opened) && Date.now() > opened + PAYMENT_TIMEOUT_MS) return false;
  }
  const due = Date.parse(r.checkoutDueAt || "");
  if (Number.isFinite(due) && Date.now() > due + CHECKOUT_GRACE_MS) return false;
  return true;
}

function bookingCabinUnits(r) {
  const ids = new Set([r?.cabinId, ...(r?.cabinIds || []), ...(r?.additionalCabinIds || [])]
    .map((i) => s(i).trim().toUpperCase()).filter(Boolean));
  if (ids.size) return ids.size;
  const declared = Number(r?.cabinCount);
  return Number.isInteger(declared) && declared > 0 ? declared : 1;
}

const TYPES = {
  standard: { emoji: "🛏️", name: "Standard Cabin", from: "L$350" },
  couple:   { emoji: "💞", name: "Couple Cabin",   from: "L$500" },
  family:   { emoji: "👨‍👩‍👧‍👦", name: "Family Cabin",   from: "L$650" },
};

const bar = (free, total) => "🟩".repeat(free) + "⬜".repeat(Math.max(0, total - free));
function heat(free, total) {
  if (free === 0) return "🔴 **Fully booked** — pop back soon, cabins free up daily!";
  if (free === total) return "🟢 **Wide open** — every single one is yours to choose from!";
  if (free <= 2) return "🟠 **Almost gone** — only a couple left, don't wait!";
  if (free <= total / 2) return "🟡 **Filling up** — over half are taken!";
  return "🟢 **Plenty available** — lovely choice right now!";
}

(async () => {
  const c = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const bookings = (await c.query("SELECT data FROM bookings")).rows.map((r) => r.data).filter(Boolean);
  await c.end();

  const totals = {};
  for (const key of Object.keys(TYPES)) {
    let booked = 0;
    for (const r of bookings) {
      if (bookingCabinKey(r) === key && isActiveBookingRecord(r)) booked += bookingCabinUnits(r);
    }
    totals[key] = { total: INVENTORY, free: Math.max(0, INVENTORY - booked), booked };
  }
  console.log("AUTHORITATIVE availability:", JSON.stringify(totals));

  const totalFree = Object.values(totals).reduce((a, x) => a + x.free, 0);
  const totalAll = Object.values(totals).reduce((a, x) => a + x.total, 0);
  const t = Math.floor(Date.now() / 1000);

  const board = {
    color: 0xff5fa2,
    title: "🛳️✨ Live Cabin Availability — Lifeline Island Paradise ✨🛳️",
    description:
      `Hi lovely travellers! 💕 Cruise Director **Tammy** here with a **live look** at what's open on board right now.\n\n` +
      `🏨 **${totalFree} of our ${totalAll} cabins are free** this very moment — updated <t:${t}:R>.`,
    fields: [
      ...Object.entries(TYPES).map(([key, cfg]) => {
        const { free, total } = totals[key];
        return {
          name: `${cfg.emoji} ${cfg.name} — ${free} of ${total} available`,
          value: `${bar(free, total)}\n${heat(free, total)}\n💵 From **${cfg.from}** · 👥 Up to **6 guests**`,
          inline: false,
        };
      }),
      {
        name: "💫 Good To Know",
        value:
          "• Every cabin sleeps **up to 6 guests** total *(including you!)*\n" +
          "• Minimum stay is **3 days** 🗓️\n" +
          "• Cabins free up **every day** as guests check out — if your favourite is taken, do check back 💗\n" +
          "• Reserved cabins include stays starting later this month, so `/book` is always the final word ⚡",
        inline: false,
      },
    ],
    footer: { text: "Lifeline Island Paradise • Modern Family Resort at Sea 💙🌊" },
    timestamp: new Date().toISOString(),
  };

  const r = await fetch(`${API}/channels/${CHANNEL_ID}/messages/${BOARD_MESSAGE_ID}`, {
    method: "PATCH",
    headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [board] }),
  });
  const text = await r.text();
  if (!r.ok) { console.error("PATCH FAILED", r.status, text); process.exit(1); }
  console.log("✅ Board corrected in place — message", BOARD_MESSAGE_ID);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
