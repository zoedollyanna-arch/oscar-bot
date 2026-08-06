/* Booking #1115 — ms.exeuctive_amg / mahjee resident
 * Intake: "dates 8/5-8/7 three days"  -> check-in 8/5, checkout 8/7, 3 days
 * Marks paid + approved in Neon and posts the boarding pass.
 * Availability is re-checked first, mirroring the approve gate (excluding this booking itself).
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

const BOOKING_ID = "booking-1115";
const CHANNEL_ID = "1533257398339371160";
const GUEST_ID = "1075666935045427250";
const PASS_PATH = "C:/Users/Shadow/Desktop/lifeline-discord-bot-main/Images Assets/boarding pass.png";
const PASS_NAME = "lifeline-island-paradise-boarding-pass.png";

// August = PDT. House checkout time is 11:00 SLT.
const CHECKIN_ISO  = "2026-08-05T18:00:00.000Z"; // Wed Aug 5, 11:00 AM SLT
const CHECKOUT_ISO = "2026-08-07T18:00:00.000Z"; // Fri Aug 7, 11:00 AM SLT
const STAY_DAYS = 3;
const PRICE = 350; // Standard Cabin, 3 Days

const DEAD = ["cancelled_non_payment", "cancelled", "closed", "denied", "expired", "checked_out"];
const GRACE = 2 * 60 * 60 * 1000, PAYWIN = 2 * 60 * 60 * 1000;
const str = (v) => (v == null ? "" : String(v));
const NAME_TO_KEY = { "Standard Cabin": "standard", "Couple Cabin": "couple", "Family Cabin": "family" };
const keyOf = (r) => r?.cabinKey || NAME_TO_KEY[str(r?.cabinType).trim()] ||
  str(r?.cabinType || r?.tags?.cabin).trim().toLowerCase().replace(/\s+cabin$/, "");
function isActive(r) {
  if (!r) return false;
  const st = str(r.status || "submitted").toLowerCase();
  if (DEAD.includes(st)) return false;
  if (!r.approvedAt && !r.boardingPassSentAt && ["submitted", "payment_marked"].includes(st)) {
    const o = Date.parse(r.openedAt || "");
    if (Number.isFinite(o) && Date.now() > o + PAYWIN) return false;
  }
  const due = Date.parse(r.checkoutDueAt || "");
  if (Number.isFinite(due) && Date.now() > due + GRACE) return false;
  return true;
}
const units = (r) => {
  const ids = new Set([r?.cabinId, ...(r?.cabinIds || []), ...(r?.additionalCabinIds || [])]
    .map((i) => str(i).trim().toUpperCase()).filter(Boolean));
  return ids.size || (Number.isInteger(Number(r?.cabinCount)) && Number(r.cabinCount) > 0 ? Number(r.cabinCount) : 1);
};
const ts = (iso, s = "F") => `<t:${Math.floor(Date.parse(iso) / 1000)}:${s}>`;

(async () => {
  const c = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const all = (await c.query("SELECT data FROM bookings")).rows.map((r) => r.data).filter(Boolean);

  // Approve gate: is a Standard cabin free, excluding this booking's own hold?
  let booked = 0;
  for (const r of all) {
    if (str(r.id) === BOOKING_ID) continue;
    if (keyOf(r) === "standard" && isActive(r)) booked += units(r);
  }
  const free = 8 - booked;
  console.log(`Standard availability excluding #1115: ${free}/8 free`);
  if (free <= 0) { console.error("❌ No Standard cabins free — NOT approving."); await c.end(); process.exit(1); }

  const d = all.find((r) => str(r.id) === BOOKING_ID);
  if (!d) throw new Error("booking-1115 not found");
  console.log("BEFORE:", JSON.stringify({ status: d.status, approvedAt: d.approvedAt, stayStartsAt: d.stayStartsAt, checkoutDueAt: d.checkoutDueAt, stayDays: d.stayDays }));

  const now = new Date().toISOString();
  d.status = "approved";
  d.approvedAt = now;
  d.boardingPassSentAt = now;
  d.paymentMarkedAt = d.paymentMarkedAt || now;
  d.earlyAccessStartsAt = CHECKIN_ISO;
  d.stayStartsAt = CHECKIN_ISO;
  d.checkoutDueAt = CHECKOUT_ISO;
  d.stayDays = STAY_DAYS;
  d.stayDaysSource = "staff_set";
  d.updatedAt = now;

  await c.query("UPDATE bookings SET data = $2 WHERE id = $1", [BOOKING_ID, d]);
  const after = (await c.query("SELECT data FROM bookings WHERE id = $1", [BOOKING_ID])).rows[0].data;
  await c.end();
  console.log("AFTER :", JSON.stringify({ status: after.status, stayStartsAt: after.stayStartsAt, checkoutDueAt: after.checkoutDueAt, stayDays: after.stayDays, stayDaysSource: after.stayDaysSource }));

  const embed = {
    color: 0x4fc3f7,
    title: "🎫✨ Your Boarding Pass — Welcome Aboard! ✨🛳️",
    description:
      `Payment received and **your booking is officially approved**, <@${GUEST_ID}>! 🎉💙\n\n` +
      `Everything is confirmed for you and **karmaamiyaking** — here is your boarding pass for ` +
      `**Lifeline Island Paradise**. We cannot wait to have you sailing with us! 🌴🌊`,
    fields: [
      { name: "🎟️ Booking", value: "**#1115**\n🛏️ Standard Cabin", inline: true },
      { name: "👤 Booked By", value: "**mahjee resident**", inline: true },
      { name: "👥 Guests", value: "**2 of 6**\nmahjee + karmaamiyaking", inline: true },
      {
        name: "🛳️ Your Check-In",
        value: `${ts(CHECKIN_ISO)}\n*Wednesday, August 5 · 11:00 AM SLT*`,
        inline: false,
      },
      {
        name: "🧳 Your Checkout",
        value: `${ts(CHECKOUT_ISO)}\n*Friday, August 7 · 11:00 AM SLT* — **3 days** aboard 💙`,
        inline: false,
      },
      {
        name: "💳 Payment Received — Thank You!",
        value: `✅ Standard Cabin · 3 Days — **L$${PRICE}**\nYour stay is **paid and confirmed** 💫`,
        inline: false,
      },
      {
        name: "💌 What Happens Next",
        value:
          "You will receive your **cabin and cruise information closer to your check-in date** — including " +
          "your **cabin assignment**, your **key-card landmark** to teleport straight to your door, and your " +
          "**Cruise HUD** for room service, activities and destinations. Keep an eye out! 👀✨",
        inline: false,
      },
      {
        name: "🗺️ Where We're Sailing During Your Stay",
        value:
          "🌊 **Bora Bora** — we'll be there when you arrive!\n" +
          "🎆 **Disney Springs** — arrives 8/7\n" +
          "*Hop on the **Deck 2 Teleporter** to visit each destination* 🚀",
        inline: false,
      },
      {
        name: "🎁 Want To Add Something Special?",
        value:
          "We offer **family and romantic celebration packages** — beach days, treasure hunts, movie nights, " +
          "bonfires and more. There's **no limit** on how many you can add! Just ask right here, or add them " +
          "from your Cruise HUD once you're aboard 💕",
        inline: false,
      },
      {
        name: "🛎️ Need Anything?",
        value: "Reply here any time, or find **Tammy** at the Front Desk in-world. 💙",
        inline: false,
      },
    ],
    image: { url: `attachment://${PASS_NAME}` },
    footer: { text: "Lifeline Island Paradise • Modern Family Resort at Sea 💙🌊" },
    timestamp: now,
  };

  const form = new FormData();
  form.append("payload_json", JSON.stringify({
    content: `<@${GUEST_ID}> 🎫💙`,
    embeds: [embed],
    attachments: [{ id: 0, filename: PASS_NAME }],
    allowed_mentions: { users: [GUEST_ID] },
  }));
  form.append("files[0]", new Blob([fs.readFileSync(PASS_PATH)], { type: "image/png" }), PASS_NAME);

  const r = await fetch(`${API}/channels/${CHANNEL_ID}/messages`, {
    method: "POST", headers: { Authorization: `Bot ${TOKEN}` }, body: form,
  });
  const text = await r.text();
  if (!r.ok) { console.error("POST FAILED", r.status, text); process.exit(1); }
  console.log("✅ Boarding pass posted —", JSON.parse(text).id);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
