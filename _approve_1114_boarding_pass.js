/* Booking #1114 — chyna7938 / Khloebenz
 *  1. Mark paid + approved in Neon (mirrors index.js booking_approve handler)
 *  2. Set the stay to her REQUESTED dates: check-in 8/4, 4 days -> checkout 8/8
 *     (the built-in approve path would anchor the stay to approval time instead)
 *  3. Post the boarding pass into #booking-1114
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

const BOOKING_ID = "booking-1114";
const CHANNEL_ID = "1533236030197731398";
const GUEST_ID = "836643018999070790";
const PASS_PATH = "C:/Users/Shadow/Desktop/lifeline-discord-bot-main/Images Assets/boarding pass.png";
const PASS_NAME = "lifeline-island-paradise-boarding-pass.png";

// August = PDT (-07:00). Daily checkout time is 11:00 SLT (cruiseConfig.checkoutTimeSlt).
const CHECKIN_ISO  = "2026-08-04T18:00:00.000Z"; // Tue Aug 4, 11:00 AM SLT
const CHECKOUT_ISO = "2026-08-08T18:00:00.000Z"; // Sat Aug 8, 11:00 AM SLT
const STAY_DAYS = 4;

const ts = (iso, style = "F") => `<t:${Math.floor(Date.parse(iso) / 1000)}:${style}>`;

(async () => {
  /* ── 1. Update the booking record ── */
  const c = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const res = await c.query("SELECT data FROM bookings WHERE id = $1", [BOOKING_ID]);
  if (!res.rows.length) throw new Error("booking-1114 not found");
  const d = res.rows[0].data;

  const before = {
    status: d.status, approvedAt: d.approvedAt, stayStartsAt: d.stayStartsAt,
    checkoutDueAt: d.checkoutDueAt, stayDays: d.stayDays,
  };
  console.log("BEFORE:", JSON.stringify(before, null, 2));

  const now = new Date().toISOString();
  d.status = "approved";
  d.approvedAt = now;
  d.boardingPassSentAt = now;
  d.paymentMarkedAt = d.paymentMarkedAt || now;
  d.earlyAccessStartsAt = CHECKIN_ISO;   // books after the ship's early-access date -> same as check-in
  d.stayStartsAt = CHECKIN_ISO;
  d.stayDays = STAY_DAYS;
  d.stayDaysSource = "staff_set";        // not "default_full_week", so no "defaulted" warning shows
  d.checkoutDueAt = CHECKOUT_ISO;
  d.updatedAt = now;

  await c.query("UPDATE bookings SET data = $2 WHERE id = $1", [BOOKING_ID, d]);
  await c.end();

  console.log("AFTER :", JSON.stringify({
    status: d.status, approvedAt: d.approvedAt, stayStartsAt: d.stayStartsAt,
    checkoutDueAt: d.checkoutDueAt, stayDays: d.stayDays, stayDaysSource: d.stayDaysSource,
  }, null, 2));

  /* ── 2. Boarding pass ── */
  const embed = {
    color: 0x4fc3f7,
    title: "🎫✨ Your Boarding Pass — Welcome Aboard! ✨🛳️",
    description:
      `Payment received and **your booking is officially approved**, <@${GUEST_ID}>! 🎉💗\n\n` +
      `Everything is confirmed for you and **JITTSTAYFINESSIN** — here is your boarding pass. ` +
      `We cannot wait to spoil you both! 🌴🌊`,
    fields: [
      { name: "🎟️ Booking", value: "**#1114**\n💞 Couple Cabin", inline: true },
      { name: "👤 Booked By", value: "**Khloebenz**", inline: true },
      { name: "👥 Guests", value: "**2 of 6**\nKhloebenz + JITTSTAYFINESSIN", inline: true },
      {
        name: "🛳️ Your Check-In",
        value: `${ts(CHECKIN_ISO)}\n*Tuesday, August 4 · 11:00 AM SLT* — right as we arrive in **🌊 Bora Bora**!`,
        inline: false,
      },
      {
        name: "🧳 Your Checkout",
        value: `${ts(CHECKOUT_ISO)}\n*Saturday, August 8 · 11:00 AM SLT* — **4 full days** aboard 💕`,
        inline: false,
      },
      {
        name: "💳 Paid In Full — L$1,675",
        value:
          "✅ Couple Cabin — 4 Days · L$625\n" +
          "✅ 🌹 Cabin Romance Setup · L$600\n" +
          "✅ 🎳 Couples Game Night · L$450\n" +
          "*Thank you so much, lovely!* 💗",
        inline: false,
      },
      {
        name: "🗺️ Where We're Sailing During Your Stay",
        value:
          "🌊 **Bora Bora** — 8/4 *(your arrival day!)*\n" +
          "🎆 **Disney Springs** — 8/7\n" +
          "*Hop on the **Deck 2 Teleporter** to visit each destination* 🚀",
        inline: false,
      },
      {
        name: "🔑 What Happens Next",
        value:
          "• Your **cabin number & key-card landmark** arrive closer to check-in — teleport straight to your door 💫\n" +
          "• You'll get your **Cruise HUD** for room service, activities & destinations 🎀\n" +
          "• Our crew will **message you right here** to plan your **Cabin Romance Setup** and " +
          "**Couples Game Night** — we'll agree the day, time and every little detail with you first 💌",
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

  const buf = fs.readFileSync(PASS_PATH);
  const form = new FormData();
  form.append("payload_json", JSON.stringify({
    content: `<@${GUEST_ID}> 🎫💗`,
    embeds: [embed],
    attachments: [{ id: 0, filename: PASS_NAME }],
    allowed_mentions: { users: [GUEST_ID] },
  }));
  form.append("files[0]", new Blob([buf], { type: "image/png" }), PASS_NAME);

  const r = await fetch(`${API}/channels/${CHANNEL_ID}/messages`, {
    method: "POST", headers: { Authorization: `Bot ${TOKEN}` }, body: form,
  });
  const text = await r.text();
  if (!r.ok) { console.error("POST FAILED", r.status, text); process.exit(1); }
  console.log("✅ Boarding pass posted —", JSON.parse(text).id);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
