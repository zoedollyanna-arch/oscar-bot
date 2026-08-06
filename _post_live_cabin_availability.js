/* Tammy Brightwood → #Booking-and-Reservations
 * Posts a cute LIVE cabin-availability board + full pricing + how-to-book steps.
 * Availability is fetched from the live cruise API at send time, never hardcoded.
 */
const fs = require("fs");

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
const CRUISE_API = "https://lifelinerp.com/api/cruise";

const CHANNEL_ID = "1522402217880190976"; // #Booking-and-Reservations

const PINK = 0xff5fa2;
const BLUE = 0x4fc3f7;
const GOLD = 0xf5b041;

const TYPES = {
  standard: {
    emoji: "🛏️",
    name: "Standard Cabin",
    from: "L$350",
    blurb: "A clean, comfortable cabin for solo travellers or a simple shared cruise stay.",
    prices: "**3 Days** L$350 · **4 Days** L$450 · **5 Days** L$550 · **6 Days** L$650 · **Full Week** L$750",
    features: "Sleeping area · Bathroom · Kitchenette · Cabin control board · Cabin tablet · Cruise HUD · Room service",
  },
  couple: {
    emoji: "💞",
    name: "Couple Cabin",
    from: "L$500",
    blurb: "A cosy one-bedroom, one-bathroom cabin made for couples, honeymoon RP, and quiet getaway scenes.",
    prices: "**3 Days** L$500 · **4 Days** L$625 · **5 Days** L$750 · **6 Days** L$875 · **Full Week** L$1,000",
    features: "One bedroom · One bathroom · Kitchenette · Cabin control board · Cabin tablet · Cruise HUD · Room service",
  },
  family: {
    emoji: "👨‍👩‍👧‍👦",
    name: "Family Cabin",
    from: "L$650",
    blurb: "Perfect for parents, kids, and group roleplay — with family cruise activities included.",
    prices: "**3 Days** L$650 · **4 Days** L$800 · **5 Days** L$950 · **6 Days** L$1,100 · **Full Week** L$1,250",
    features: "Family sleeping area · Bathroom · Kitchenette · Cabin control board · Cabin tablet · Cruise HUD · Room service · Family activities",
  },
};

const bar = (free, total) => "🟩".repeat(free) + "⬜".repeat(Math.max(0, total - free));

function heat(free, total) {
  if (free === 0) return "🔴 **Fully booked** — pop back soon, cabins free up daily!";
  if (free === total) return "🟢 **Wide open** — every single one is yours to choose from!";
  if (free <= 2) return "🟠 **Almost gone** — only a couple left, don't wait!";
  if (free <= total / 2) return "🟡 **Filling up** — over half are taken!";
  return "🟢 **Plenty available** — lovely choice right now!";
}

async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error(`${r.status} on ${url}`);
  return r.json();
}

async function post(body) {
  const r = await fetch(`${API}/channels/${CHANNEL_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, allowed_mentions: { parse: [] } }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text}`);
  return JSON.parse(text);
}

(async () => {
  const avail = await getJson(`${CRUISE_API}/cabins/available`);
  const totals = avail.totals;
  const t = Math.floor(Date.now() / 1000);

  const totalFree = Object.values(totals).reduce((a, x) => a + x.free, 0);
  const totalAll = Object.values(totals).reduce((a, x) => a + x.total, 0);

  console.log("LIVE availability:", JSON.stringify(totals));
  console.log("Free cabin ids:", avail.free.map((c) => c.id).join(", "));

  /* ── Embed 1: the live board ── */
  const boardFields = Object.entries(TYPES).map(([key, cfg]) => {
    const { free, total } = totals[key];
    return {
      name: `${cfg.emoji} ${cfg.name} — ${free} of ${total} available`,
      value: `${bar(free, total)}\n${heat(free, total)}\n💵 From **${cfg.from}** · 👥 Up to **6 guests**`,
      inline: false,
    };
  });

  const board = {
    color: PINK,
    title: "🛳️✨ Live Cabin Availability — Lifeline Island Paradise ✨🛳️",
    description:
      `Hi lovely travellers! 💕 Cruise Director **Tammy** here with a **live look** at what's open on board right now.\n\n` +
      `🏨 **${totalFree} of our ${totalAll} cabins are free** this very moment — updated <t:${t}:R>.`,
    fields: [
      ...boardFields,
      {
        name: "💫 Good To Know",
        value:
          "• Every cabin sleeps **up to 6 guests** total *(including you!)*\n" +
          "• Minimum stay is **3 days** 🗓️\n" +
          "• Cabins free up **every day** as guests check out — if your favourite is taken, do check back 💗\n" +
          "• Availability moves fast, so `/book` always shows the true live count ⚡",
        inline: false,
      },
    ],
    footer: { text: "Lifeline Island Paradise • Modern Family Resort at Sea 💙🌊" },
    timestamp: new Date().toISOString(),
  };

  /* ── Embed 2: pricing + what's inside ── */
  const pricing = {
    color: BLUE,
    title: "💵 Full Pricing & What's Inside Each Cabin",
    description: "One simple price for your whole stay — no hidden extras, ever. 💙",
    fields: Object.values(TYPES).flatMap((cfg) => [
      {
        name: `${cfg.emoji} ${cfg.name} — from ${cfg.from}`,
        value: `*${cfg.blurb}*\n${cfg.prices}\n✨ ${cfg.features}`,
        inline: false,
      },
    ]),
    footer: { text: "Need longer than a week? Just ask — we can extend your stay from your cabin terminal 💫" },
  };

  /* ── Embed 3: how to book ── */
  const how = {
    color: GOLD,
    title: "📋 How To Book — It Only Takes A Few Minutes 💌",
    fields: [
      {
        name: "1️⃣ Run `/book` Right Here",
        value:
          "Type **`/book`** in this channel 💬\n" +
          "Preview each cabin type, then continue to the booking agreement and form.\n" +
          "*(`/book` only works here in this channel, lovely!)*",
        inline: false,
      },
      {
        name: "2️⃣ Fill In Your Details",
        value:
          "• Your **in-world name** *(e.g. Zoedollyanna Resident)*\n" +
          "• Your **avatar UUID**\n" +
          "• **Family / group name** — write **N/A** if it's just you\n" +
          "• **Guest names + UUIDs**, one per line — **max 6 total, including you**\n" +
          "• **Dates & duration** — 3, 4, 5, 6 days or a full week, plus any room needs",
        inline: false,
      },
      {
        name: "3️⃣ Pay In-World",
        value:
          "Your own booking ticket opens automatically 🎟️\n" +
          "Send your payment in Second Life to **zoedollyanna Resident**, then tap " +
          "**Mark Payment Complete** in your ticket. 💳\n" +
          "⏳ *Please pay soon after submitting — reservations only hold for about 2 hours.*",
        inline: false,
      },
      {
        name: "4️⃣ Get Your Cabin & Set Sail! 🎉",
        value:
          "Once approved, your cabin is assigned and you'll receive your **cabin key-card landmark** to " +
          "teleport straight to your door 🔑\n" +
          "Then grab your **Cruise HUD** for room service, activities, destinations and more ✨\n" +
          "*Haven't got your HUD? Just ask me at the Front Desk!* 🛎️",
        inline: false,
      },
      {
        name: "🎁 Want To Add Something Special?",
        value:
          "Romantic and family **celebration packages** — beach dinners, bungalows, proposals, treasure " +
          "hunts, luaus and more — can be added from your **Cruise HUD** *(Services → Packages)* or just " +
          "ask in your booking ticket 💕",
        inline: false,
      },
      {
        name: "🛎️ Questions?",
        value: "Reply here, open a ticket, or find **Tammy** at the Front Desk in-world — always happy to help! 💙",
        inline: false,
      },
    ],
    footer: { text: "With love, Cruise Director Tammy • Lifeline Island Paradise 💖" },
  };

  const m1 = await post({ embeds: [board] });
  console.log("✅ Availability board posted —", m1.id);
  await new Promise((r) => setTimeout(r, 900));
  const m2 = await post({ embeds: [pricing, how] });
  console.log("✅ Pricing + how-to-book posted —", m2.id);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
