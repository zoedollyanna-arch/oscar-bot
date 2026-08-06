/* Tammy Brightwood → ticket-1113 (chyna7938)
 * Answers: couple cabin pricing + full private/romantic package catalog + how to book.
 * Data source of truth: lifeline-discord-bot/index.js (CABIN_PRICING, CABIN_PREVIEWS)
 * and lifeline-discord-bot/packageOrders.js (CATALOG).
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

const CHANNEL_ID = "1533130706417487973";   // #ticket-1113
const GUEST_ID = "836643018999070790";       // chyna7938
const BOOKING_CHANNEL_ID = "1522402217880190976"; // #Booking-and-Reservations
const PINK = 0xff5fa2;
const BLUE = 0x4fc3f7;
const GOLD = 0xf5b041;

const pkg = (emoji, name, price, includes) => ({
  name: `${emoji} ${name} — L$${price}`,
  value: includes.map((i) => `• ${i}`).join("\n"),
  inline: false,
});

const embeds = [
  /* 1 — welcome + the closed-ticket note + couple cabin pricing */
  {
    color: PINK,
    title: "💗 Hi lovely — Cruise Director Tammy here! 🛳️✨",
    description:
      `Good morning, <@${GUEST_ID}>! 💕 Thank you so much for your patience — and I'm so sorry, ` +
      `I see your **previous ticket was closed automatically because we didn't hear back from you**, ` +
      `so those package details went away with it. Let's fix that right now! 🌸\n\n` +
      `Below is **everything**: your **Couple Cabin** pricing *and* our full **private (romantic) package** ` +
      `menu, so you have it all in one place this time. 💌`,
    fields: [
      {
        name: "💞 Couple Cabin — Full Pricing",
        value:
          "**3 Days** — L$500\n" +
          "**4 Days** — L$625\n" +
          "**5 Days** — L$750\n" +
          "**6 Days** — L$875\n" +
          "**Full Week** — L$1,000\n" +
          "*Minimum stay is 3 days.*",
        inline: true,
      },
      {
        name: "🛏️ Other Cabin Types",
        value:
          "**Standard** — from L$350\n*(3d 350 · 4d 450 · 5d 550 · 6d 650 · week 750)*\n\n" +
          "**Family** — from L$650\n*(3d 650 · 4d 800 · 5d 950 · 6d 1,100 · week 1,250)*",
        inline: true,
      },
      {
        name: "✨ What's Inside Your Couple Cabin",
        value:
          "A cozy one-bedroom, one-bathroom cabin made for couples, honeymoon RP, and quiet getaway scenes 💕\n" +
          "• One bedroom & one bathroom\n• Kitchenette\n• Cabin cruise control board\n" +
          "• Cabin tablet access\n• Cruise HUD access\n• Room service options\n" +
          "• Up to **6 guests** total on the booking\n• Your own cabin key-card landmark for instant teleport 🔑",
        inline: false,
      },
      {
        name: "🚪 Availability",
        value:
          "We have **8 couple cabins** on board and **5 were still open** as of this morning — " +
          "live availability always shows inside `/book`, so grab yours while it's there! 💨",
        inline: false,
      },
      {
        name: "🗺️ Where We're Sailing Next",
        value:
          "🌊 **Bora Bora** — 8/4\n🎆 **Disney Springs** — 8/7\n🦖🧜‍♀️ **Dino World vs Mermaid World** — all week from 8/11\n" +
          "🏔️ **St. Lucia** — 8/18\n🛕 **Thailand** — 8/21\n🧱 **Legoland** — all week from 8/25",
        inline: false,
      },
    ],
    footer: { text: "Lifeline Island Paradise • Modern Family Resort at Sea 💙🌊" },
  },

  /* 2 — private/romantic, onboard */
  {
    color: PINK,
    title: "💞 Private Romantic Packages — 🛳️ Onboard the Ship",
    description:
      "These are our **private couples experiences** you can add to any cabin stay — set up just for the two of you 💕\n" +
      "*Every package is **one direct price**, nothing hidden, nothing extra.*",
    fields: [
      pkg("🌹", "Cabin Romance Setup", 600, [
        "Rose petals & candles",
        "Wine / champagne / mocktail tray",
        "Chocolate & strawberries",
        "Soft music suggestion",
        "Couple pose or cuddle rug",
      ]),
      pkg("🌠", "Stargazing Deck Date", 500, [
        "Quiet ship deck / balcony spot",
        "Blanket or loveseat",
        "Drinks for two",
        "Couple poses",
        "“Stargazing at Sea” notecard",
        "Optional candles / firepit where safe",
      ]),
      pkg("🎬", "Private Movie Date", 400, [
        "Reserved theater row for two",
        "Popcorn, candy & drink tray",
        "Cozy couple seating",
        "Cute “movie date aboard Lifeline Paradise” message",
      ]),
      pkg("🔎", "Mystery Date Night", 450, [
        "Couple detective card",
        "Reserved mystery start time",
        "“Date Night Detective Duo” notecard",
        "Small couples prize after finishing",
      ]),
      pkg("🎳", "Couples Game Night", 450, [
        "Bowling / game room date",
        "Couple trivia",
        "Drinks & snacks",
        "Winner gets a small prize",
      ]),
    ],
    footer: { text: "Onboard packages can be set up any night of your stay 💙" },
  },

  /* 3 — private/romantic, island */
  {
    color: 0xff8fc0,
    title: "💞 Private Romantic Packages — 🏝️ On the Island",
    description: "Our most-loved private setups, arranged for you at our island destinations 🌴✨",
    fields: [
      pkg("💍", "Proposal / Anniversary Package", 1800, [
        "Fully decorated beach setup",
        "“Will you marry me?” or anniversary sign",
        "Fireworks",
        "Champagne",
        "Photographer / photo pose area",
      ]),
      pkg("🕯️", "Private Romantic Beach Dinner ⭐ *our signature*", 1200, [
        "Private table on the beach",
        "Candles & lanterns",
        "Dinner plates & drinks",
        "Couple poses",
        "Soft music",
        "Optional staff greeting / host",
      ]),
      pkg("🛖", "Bungalow Romantic Escape", 1000, [
        "Private bungalow / cabana",
        "Rose petals",
        "Drinks",
        "Dessert tray",
        "Cuddle poses",
        "30–60 minutes of reserved private time",
      ]),
      pkg("💆", "Couples Spa & Relaxation", 900, [
        "Massage tables or spa chairs",
        "Fruit water & drinks",
        "Robes & towels",
        "Calm tropical setup",
        "Private bungalow time afterward",
      ]),
      pkg("🧺", "Sunset Picnic", 800, [
        "Beach blanket & picnic basket",
        "Drinks",
        "Lanterns",
        "Couple photo spot",
        "Optional sunset fireworks",
      ]),
      pkg("🔥", "Moonlight Bonfire Date", 750, [
        "Beach bonfire",
        "Blanket / loveseat",
        "Drinks",
        "S'mores & snacks",
        "Couple poses",
        "Music stream",
      ]),
    ],
    footer: { text: "All island setups are private & reserved just for your party 💕" },
  },

  /* 4 — family, compact */
  {
    color: BLUE,
    title: "👨‍👩‍👧‍👦 Family Activity Packages — *just in case!* 🎁",
    description: "Not what you asked for, but I'll pop them here so you have the whole menu, sweetie 💙",
    fields: [
      {
        name: "🛳️ Onboard",
        value:
          "🕵️ **Family Detective Crew** — L$500 · *badges, clue hunt, junior detective titles & a prize*\n" +
          "🎲 **Cabin Game Night** — L$450 · *board games, snack basket, movie pick & game-room time*\n" +
          "🍿 **Family Movie + Snacks** — L$400 · *reserved theater row, popcorn & candy tray*\n" +
          "🧸 **Kids Cruise Fun Pack** — L$350 · *plushies, coloring, snack box & scavenger hunt*\n" +
          "📸 **Family Photo Memories** — L$300 · *guided photo tour, poses & a keepsake notecard*",
        inline: false,
      },
      {
        name: "🏝️ On the Island",
        value:
          "🏝️ **Family Adventure Bundle** — L$950 · *scavenger hunt, beach games, picnic & prize chest*\n" +
          "🌺 **Family Luau** — L$750 · *lei welcome, tropical feast, music, dance & souvenir*\n" +
          "🏖️ **Family Beach Day** — L$650 · *reserved cabana, sandcastles, snacks & beach games*\n" +
          "🗺️ **Island Treasure Hunt** — L$550 · *treasure map, 5 clue stops & a treasure chest prize*\n" +
          "💦 **Splash & Snacks** — L$500 · *splash area, snack tray, floaties & a relax cabana*",
        inline: false,
      },
    ],
    footer: { text: "Mix & match — you can add more than one package to your stay 💙" },
  },

  /* 5 — how to book */
  {
    color: GOLD,
    title: "📋 How To Book — Step By Step 💌",
    description: "It only takes a few minutes, and I'll be right here if you get stuck! 🛎️",
    fields: [
      {
        name: "1️⃣ Book Your Cabin",
        value:
          `Head to <#${BOOKING_CHANNEL_ID}> and run **\`/book\`**.\n` +
          "Pick **Couple Cabin** → preview it → accept the booking agreement → fill in the short form:\n" +
          "• Your in-world name *(e.g. Chyna Resident)*\n" +
          "• Your avatar **UUID**\n" +
          "• Family / group name *(write **N/A** if it's just you two)*\n" +
          "• Guest names + UUIDs, one per line — **max 6 total, including you**\n" +
          "• Dates, duration *(3 / 4 / 5 / 6 days or full week)* & any notes",
        inline: false,
      },
      {
        name: "2️⃣ Pay & Get Approved",
        value:
          "Your booking ticket opens automatically. 💳 Send your cabin payment in-world to **zoedollyanna Resident**, " +
          "then press **Mark Payment Complete** in the ticket. Leadership approves it, and your cabin + " +
          "**cabin key-card landmark** are assigned right away 🔑✨\n" +
          "⏳ *Heads up: bookings hold for about 2 hours before payment, so try to pay soon after you submit.*",
        inline: false,
      },
      {
        name: "3️⃣ Add Your Private Package 💞",
        value:
          "Two easy ways:\n" +
          "🎀 **From your Island Paradise HUD** — open **Services → Packages**, choose your package, and answer " +
          "a few cute questions *(guests, day & time, vibe, special details)*.\n" +
          "💌 **Or just tell me right here** in your booking ticket and I'll put the request in for you.\n" +
          "Then pay the package price to **zoedollyanna Resident** in-world → leadership marks it paid & approves → " +
          "the crew sets up your magic ✨",
        inline: false,
      },
      {
        name: "🛎️ Need Anything At All",
        value:
          "Find me — **Tammy** — at the **Front Desk** in-world, or just reply here. I'll help you find your cabin, " +
          "get your Cruise HUD, or plan the perfect surprise 💕",
        inline: false,
      },
    ],
    footer: { text: "Lifeline Island Paradise • All packages are one direct price 💙🌊" },
    timestamp: new Date().toISOString(),
  },

  /* 6 — action needed */
  {
    color: 0xe74c3c,
    title: "💕 One Small Thing Before You Go…",
    description:
      `I don't want this ticket to close on you a second time, sweetheart! 🥺💗\n\n` +
      `➡️ **If you'd like to book**, please head to <#${BOOKING_CHANNEL_ID}> and run **\`/book\`** — ` +
      `then come tell me here so I can get your private package started.\n\n` +
      `➡️ **If you don't reply**, this ticket will be **closed again for no response** — but you're always ` +
      `welcome to open a brand-new one whenever you're ready. No hard feelings ever! 💙`,
    footer: { text: "With love, Cruise Director Tammy • Lifeline Island Paradise 💖" },
  },
];

// Discord allows max 6000 chars of embed content PER MESSAGE, so send in batches.
const batches = [
  { content: `<@${GUEST_ID}> 💗🛳️`, embeds: [embeds[0]] },
  { content: "", embeds: [embeds[1], embeds[2]] },
  { content: "", embeds: [embeds[3], embeds[4], embeds[5]] },
];

async function send(body) {
  const r = await fetch(`${API}/channels/${CHANNEL_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, allowed_mentions: { users: [GUEST_ID] } }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text}`);
  return JSON.parse(text).id;
}

(async () => {
  for (let i = 0; i < batches.length; i++) {
    const size = JSON.stringify(batches[i].embeds).length;
    const id = await send(batches[i]);
    console.log(`✅ Sent batch ${i + 1}/${batches.length} (embed JSON ~${size} chars) — message id ${id}`);
    await new Promise((r) => setTimeout(r, 900));
  }
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
