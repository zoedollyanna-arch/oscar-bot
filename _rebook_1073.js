/**
 * booking-1073 (she5ft / RayneSantana Resident, Cabin F01 Family).
 * Her stay expired 8/2 18:00 UTC. She paid for a 1-day extension, and we also owe her the
 * complimentary 1-day extension offered in the 7/20 cruise calendar. Both are applied here.
 *
 *   expired -> approved (active), payment marked, checkout 8/2 18:00 -> 8/4 18:00, stayDays 7 -> 9
 *
 * Then posts: cute confirmation embed as TAMMY, welcome-aboard + key card as LIFELINE ASSISTANT.
 * DRY RUN by default; pass --apply to commit.
 */
const fs = require("fs");
const { Pool } = require("pg");

const APPLY = process.argv.includes("--apply");
const API = "https://discord.com/api/v10";
const CHANNEL_ID = "1527437085685059644";
const GUEST_ID = "1367651183359164520";
const CABIN = "F01";
const LANDMARK = "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/101/184/46";

const NEW_CHECKOUT_ISO = "2026-08-04T18:00:00.000Z";
const NEW_CHECKOUT_TS = 1785866400; // 8/4 18:00 UTC
const CHECKIN_TS = 1785088800;      // 7/26 18:00 UTC
const NEW_STAY_DAYS = 9;
const STAFF_ID = "1197552066269282306"; // zoedollyanna (Founder/CEO)

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}
const lifelineEnv = loadEnv("C:\\Users\\Shadow\\Desktop\\lifeline-discord-bot-main\\env (1)");
const TAMMY_TOKEN = loadEnv("./oscar-bot.env").DISCORD_TOKEN;
const ASSISTANT_TOKEN = lifelineEnv.DISCORD_TOKEN;

/* ── Tammy: the cute confirmation ── */
const tammyEmbed = {
  color: 0xffb6c1,
  title: "💗🎉 All Sorted — Your Stay Is Extended & Confirmed! 🎉💗",
  description:
    `Hi <@${GUEST_ID}>! 🌺✨ **Tammy** here — thank you so, so much for your patience today, lovely. ` +
    `I'm so sorry you had to wait and ask more than once. 💛\n\n` +
    `Your payment came through, everything is **paid and approved**, and I have wonderful news — ` +
    `**we've added an extra day on us, completely free!** 🎁💕\n\n` +
    `You are **not** going to miss Puerto Rico! 🇵🇷🎊`,
  fields: [
    {
      name: "✅ Your Extension — Paid & Approved",
      value:
        "💳 **1 day paid** — L$150 ✨ *received, approved & confirmed*\n" +
        "🎁 **1 day FREE** — our complimentary extension, because you booked specially to " +
        "see these destinations *and* because we kept you waiting. 💗",
      inline: false,
    },
    {
      name: "🗓️ Your New Checkout",
      value:
        `🧳 **${"<t:" + NEW_CHECKOUT_TS + ":F>"}**\n\n` +
        `*(That's **2 extra days** added — one you paid for, one from us!)* 🥰`,
      inline: false,
    },
    {
      name: "🗝️ Your Cabin Is Still Yours",
      value:
        `🏡 **Cabin ${CABIN}** — Family Cabin\n` +
        "Everything is exactly as you left it — your custom layout, your guest roster, all of it. " +
        "Nothing to redo, just carry on enjoying! 💕",
      inline: false,
    },
    {
      name: "🇵🇷 Go Enjoy Puerto Rico!",
      value:
        "🎡 Carnaval de San Isla is open and waiting — the lazy river, the beach, the food court " +
        "and all the carnival rides. Go have the BEST time, sweetheart! 🎊🌴",
      inline: false,
    },
    {
      name: "🛎️ Anything At All?",
      value: "💬 Just reply right here or come find me at the **Front Desk** — always happy to help! 💚",
      inline: false,
    },
  ],
  footer: { text: "Tammy Brightwood • Lifeline Island Paradise 🌴 • Booking #1073 • Cabin F01 💗" },
  timestamp: new Date().toISOString(),
};

/* ── Lifeline Assistant: welcome aboard + key card ── */
const assistantEmbed = {
  color: 0x4fc3f7,
  title: "🛳️✨ Welcome Aboard — Your Cabin Is Ready! ✨🛳️",
  description:
    "Welcome back aboard, **RayneSantana Resident**! 💙 Your stay has been extended and your " +
    "Lifeline Island Paradise cabin is all set. Here's everything you need. 🌴🌊",
  fields: [
    { name: "🗝️ Your Cabin", value: `**${CABIN}** — Family Cabin`, inline: false },
    {
      name: "💳💖 Your Cabin Key Card",
      value: `🔑 **Cabin ${CABIN}**\n[✨ Unlock your door & teleport straight to your cabin ✨](${LANDMARK})\n\`${LANDMARK}\``,
      inline: false,
    },
    {
      name: "🛳️ Your Stay",
      value: `<t:${CHECKIN_TS}:f> → <t:${NEW_CHECKOUT_TS}:f>\n**${NEW_STAY_DAYS} Days** · Family Cabin · ✅ Paid & Approved`,
      inline: false,
    },
    {
      name: "🧭 Reaching Each Destination",
      value: "Head to **Deck 2** and hop on the **Teleporter** to travel to each cruise destination. 🚀",
      inline: false,
    },
    {
      name: "👥 Your Guests",
      value: "Add, change, or remove guests anytime right from your in-cabin **Cabin Terminal** (up to 6 total). 💕",
      inline: false,
    },
    {
      name: "🎀 Your Cruise HUD",
      value:
        "Your **Cruise HUD** unlocks room service, activities and onboard perks. If you haven't " +
        "received yours, just ask **Tammy at the Front Desk**. 💌",
      inline: false,
    },
    {
      name: "🛎️ Need a Hand?",
      value: "Can't find your cabin? Let **Tammy at the Front Desk** know and she'll help you get settled. 💙",
      inline: false,
    },
  ],
  footer: { text: "Lifeline Island Paradise • Modern Family Resort at Sea 💙🌊" },
  timestamp: new Date().toISOString(),
};

async function post(token, embed, who) {
  const res = await fetch(`${API}/channels/${CHANNEL_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `<@${GUEST_ID}>`,
      embeds: [embed],
      allowed_mentions: { users: [GUEST_ID] },
    }),
  });
  if (!res.ok) throw new Error(`${who} POST failed ${res.status}: ${await res.text()}`);
  return res.json();
}

(async () => {
  const url = lifelineEnv.DATABASE_URL.replace(/([?&])sslmode=[^&]*&?/i, "$1").replace(/[?&]$/, "");
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 3 });
  try {
    const { rows } = await pool.query("SELECT id, data FROM bookings WHERE id = 'booking-1073'");
    if (!rows.length) throw new Error("booking-1073 not found");
    const r = rows[0].data;

    console.log("═══ BEFORE ═══");
    console.log(`  status=${r.status}  stayDays=${r.stayDays}  checkoutDueAt=${r.checkoutDueAt}`);
    console.log(`  cabinId=${r.cabinId}  cancelledAt=${r.cancelledAt || "—"}  checkedOutAt=${r.checkedOutAt || "—"}`);

    const now = new Date().toISOString();
    r.status = "approved";
    r.stayDays = NEW_STAY_DAYS;
    r.stayDaysSource = "paid_extension_plus_goodwill_day";
    r.checkoutDueAt = NEW_CHECKOUT_ISO;
    r.paymentMarkedAt = r.paymentMarkedAt || now;
    r.paymentMarkedBy = STAFF_ID;
    r.paid = true;
    r.approvedBy = r.approvedBy || STAFF_ID;
    r.extensionPaidDays = 1;
    r.extensionFreeDays = 1;
    r.updatedAt = now;
    // clear the expiry/checkout markers so the booking is cleanly active again
    delete r.cancelledAt;
    delete r.cancelReason;
    delete r.checkedOutAt;
    delete r.checkedOutBy;

    console.log("\n═══ AFTER ═══");
    console.log(`  status=${r.status}  stayDays=${r.stayDays}  checkoutDueAt=${r.checkoutDueAt}`);
    console.log(`  paid=${r.paid}  paidDays=${r.extensionPaidDays}  freeDays=${r.extensionFreeDays}`);

    if (!APPLY) {
      console.log("\n🔍 DRY RUN — nothing written or sent. Re-run with --apply.\n");
      return;
    }

    await pool.query("UPDATE bookings SET data = $2, updated_at = now() WHERE id = $1", ["booking-1073", r]);
    console.log("\n✅ booking-1073 updated in Neon (active, paid, extended).");

    const m1 = await post(TAMMY_TOKEN, tammyEmbed, "Tammy");
    console.log(`✅ Tammy confirmation posted (${m1.id}).`);
    await new Promise((res) => setTimeout(res, 700));
    const m2 = await post(ASSISTANT_TOKEN, assistantEmbed, "Lifeline Assistant");
    console.log(`✅ Lifeline Assistant welcome aboard + key card posted (${m2.id}).`);
  } finally {
    await pool.end().catch(() => {});
  }
})().catch((e) => { console.error("❌ ERROR:", e.message); process.exit(1); });
