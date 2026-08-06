/* Tammy Brightwood → #booking-1114
 * Invoice for chyna7938 / Khloebenz: Couple Cabin 4 days + Cabin Romance Setup + Couples Game Night.
 * Prices from index.js CABIN_PRICING and packageOrders.js CATALOG.
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

const CHANNEL_ID = "1533236030197731398"; // #booking-1114
const GUEST_ID = "836643018999070790";     // chyna7938
const PAY_TO = "zoedollyanna Resident";

const CABIN = 625;   // Couple Cabin — 4 Days
const ROMANCE = 600; // Cabin Romance Setup
const GAMENIGHT = 450; // Couples Game Night
const TOTAL = CABIN + ROMANCE + GAMENIGHT; // 1675

const money = (n) => n.toLocaleString("en-US");

const invoiceBlock =
  "```\n" +
  "LIFELINE ISLAND PARADISE — INVOICE #LIP-1114\n" +
  "-------------------------------------------\n" +
  "ITEM                              AMOUNT\n" +
  "-------------------------------------------\n" +
  "Couple Cabin - 4 Day Stay        L$   625\n" +
  "Cabin Romance Setup              L$   600\n" +
  "Couples Game Night               L$   450\n" +
  "-------------------------------------------\n" +
  "TOTAL DUE                        L$ 1,675\n" +
  "```";

const embeds = [
  {
    color: 0xff5fa2,
    title: "🧾💕 Your Lifeline Island Paradise Invoice — Booking #1114",
    description:
      `Yay, you're booked in, <@${GUEST_ID}>! 🎉🛳️ I'm **so happy** you came back to us — thank you for ` +
      `letting us plan something special for you two. 💗\n\n` +
      `Here's your full invoice with everything itemised, plus exactly where to send payment. 💌`,
    fields: [
      {
        name: "👤 Booked By",
        value: "**Khloebenz**\n`b8df5242-86e9-4711-80ee-cc81a96214e4`",
        inline: true,
      },
      {
        name: "💑 Your Guest",
        value: "**JITTSTAYFINESSIN**\n`1ad29a63-d46e-4381-8654-7bc024063953`",
        inline: true,
      },
      {
        name: "🎟️ Booking",
        value: "**#1114**\n🗓️ Invoiced <t:" + Math.floor(Date.now() / 1000) + ":D>",
        inline: true,
      },
      {
        name: "💞 Your Cabin",
        value:
          "**Couple Cabin** — a cosy one-bedroom, one-bathroom cabin made just for two 💕\n" +
          "🗓️ **4-day stay**, requested start **8/4**\n" +
          "👥 **2 of 6** guest slots used — room for 4 more if you'd like company!\n" +
          "✨ One bedroom · One bathroom · Kitchenette · Cabin control board · Cabin tablet · Cruise HUD · Room service",
        inline: false,
      },
    ],
    footer: { text: "Lifeline Island Paradise • Modern Family Resort at Sea 💙🌊" },
  },
  {
    color: 0xffd166,
    title: "🧾 Itemised Breakdown",
    description: invoiceBlock,
    fields: [
      {
        name: "🛏️ Couple Cabin — 4 Days · L$625",
        value:
          "*Our couple pricing: 3 Days L$500 · **4 Days L$625** · 5 Days L$750 · 6 Days L$875 · Full Week L$1,000*",
        inline: false,
      },
      {
        name: "🌹 Cabin Romance Setup · L$600",
        value:
          "• Rose petals & candles\n• Wine / champagne / mocktail tray\n• Chocolate & strawberries\n" +
          "• Soft music suggestion\n• Couple pose or cuddle rug",
        inline: false,
      },
      {
        name: "🎳 Couples Game Night · L$450",
        value:
          "• Bowling / game room date\n• Couple trivia\n• Drinks & snacks\n• Winner gets a small prize 🏆",
        inline: false,
      },
      {
        name: "💵 Total Due",
        value: `# L$${money(TOTAL)}\n*Both of your packages are **onboard experiences**, so we can set them up any night of your stay* ✨`,
        inline: false,
      },
    ],
  },
  {
    color: 0x2ecc71,
    title: "💳 How & Where To Pay",
    description: "One simple payment, sweetheart — right in Second Life. 💙",
    fields: [
      {
        name: "1️⃣ Send Payment In-World",
        value:
          `Pay **L$${money(TOTAL)}** to:\n\n# 💗 ${PAY_TO}\n\n` +
          "Right-click her avatar or profile → **Pay** → enter the amount → send. 💵\n" +
          "*You're welcome to send it as one payment, or split it — cabin first, then packages — whichever you prefer!*",
        inline: false,
      },
      {
        name: "2️⃣ Tap The Button",
        value:
          "Once it's sent, press **✅ Mark Payment Complete** on the payment message above in this ticket, " +
          "so we know to look for it. 🔔",
        inline: false,
      },
      {
        name: "3️⃣ We'll Take It From There 💕",
        value:
          "**Once your payment is in, we'll confirm it and approve your stay right here.** Then:\n" +
          "🔑 Your **cabin is assigned** and you'll get your **key-card landmark** to teleport straight to your door\n" +
          "🎀 You'll receive your **Cruise HUD** for room service, activities & destinations\n" +
          "💌 And our crew will **coordinate both packages with you right here in this ticket** — we'll agree the " +
          "day, the time and every little detail with you before we set anything up ✨",
        inline: false,
      },
      {
        name: "⏳ Just A Gentle Note",
        value:
          "Reservations hold for about **2 hours** before payment, so do pop the payment over when you can. " +
          "If it lapses, no worries at all — just let me know and I'll get you sorted. 💙",
        inline: false,
      },
      {
        name: "🛎️ Any Questions?",
        value:
          "Reply right here, or find **Tammy** at the Front Desk in-world. I'll be keeping an eye on this " +
          "ticket for you! 💗",
        inline: false,
      },
    ],
    footer: { text: "With love, Cruise Director Tammy • Invoice #LIP-1114 • Lifeline Island Paradise 💖" },
    timestamp: new Date().toISOString(),
  },
];

async function post(body) {
  const r = await fetch(`${API}/channels/${CHANNEL_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, allowed_mentions: { users: [GUEST_ID] } }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text}`);
  return JSON.parse(text);
}

(async () => {
  const m1 = await post({ content: `<@${GUEST_ID}> 🧾💗`, embeds: [embeds[0]] });
  console.log("✅ Invoice header —", m1.id);
  await new Promise((r) => setTimeout(r, 900));
  const m2 = await post({ embeds: [embeds[1], embeds[2]] });
  console.log("✅ Breakdown + payment instructions —", m2.id);
  console.log(`Total invoiced: L$${money(TOTAL)}`);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
