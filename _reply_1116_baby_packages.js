/**
 * Ticket #1116 — elijahcastillonamor.
 * Answers: bot baby in the Couple Cabin (Starries furniture accommodations), rezzing rights,
 * island "getting off the cruise" amenities, bungalow pricing, + the full 21-package catalog.
 * Packages are purchased from the Cruise HUD.
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

const CHANNEL_ID = "1533558410531045386"; // ticket-1116
const REPLY_TO = "1533622648158945360";   // his question
const GUEST_ID = "748903437655081121";    // elijahcastillonamor

const PINK = 0xffb6c1;
const BLUE = 0x89cff0;

const pkg = (emoji, label, price, includes) => ({
  name: `${emoji} ${label} — L$${price.toLocaleString()}`,
  value: includes.map((i) => `• ${i}`).join("\n"),
  inline: false,
});

/* ── Message 1: the actual answers ── */
const answerEmbeds = [
  {
    color: PINK,
    title: "💗🛳️ Hi lovely — Cruise Director Tammy here! 🛳️💗",
    description:
      `Hi <@${GUEST_ID}>! 🌺✨ Congratulations to you and your fiancé — and what a sweet little ` +
      `travelling companion you have! 👶💕 I've got answers to **every single one** of your ` +
      `questions below, so let's go through them one at a time. 💌`,
    fields: [
      {
        name: "👶💙 Yes — Baby Can Absolutely Stay With You!",
        value:
          "Of course he can, sweetheart! 🥰 Your **Couple Cabin** holds up to **6 guests total** on " +
          "the booking, so your little one is more than welcome to stay right in the cabin with " +
          "you both. 💕\n\n" +
          "🍼 **And here's the lovely part —** you can **request accommodations for your bot babies!** " +
          "We keep some gorgeous **Starries** furniture on hand 🌟 — so if you'd like a crib, a " +
          "changing station, or a little nursery corner set up in your cabin, just ask us right " +
          "here and our crew will get it arranged for you. 🧸✨\n\n" +
          "*And if he only sleeps in your bed — that's perfectly fine too! No rules here, love.* 💤",
        inline: false,
      },
      {
        name: "🪄 Rezzing Rights",
        value:
          "Yes! 💕 You'll have **rezzing in your own cabin** so you can set out your own baby " +
          "furniture, personal bits and RP props. 🛏️\n\n" +
          "🔑 Just let us know once you've checked in and we'll make sure your rezzing is switched " +
          "on for your cabin. Public areas of the ship and the island destinations are set up by " +
          "our crew — but if you need something rezzed out there for a scene, **just ask and we'll " +
          "sort it for you.** 🌴\n\n" +
          "💙 *One note — this cruise runs on the **Lifeline RP System** only.*",
        inline: false,
      },
      {
        name: "💞 Your Couple Cabin — Full Pricing",
        value:
          "**3 Days** — L$500\n**4 Days** — L$625\n**5 Days** — L$750\n" +
          "**6 Days** — L$875\n**Full Week** — L$1,000\n*Minimum stay is 3 days.*",
        inline: true,
      },
      {
        name: "✨ What's Inside",
        value:
          "• One bedroom & one bathroom\n• Kitchenette\n• Cabin control board\n" +
          "• Cabin tablet access\n• Cruise HUD access\n• Room service\n" +
          "• Up to **6 guests**\n• Your own key-card landmark 🔑",
        inline: true,
      },
    ],
    footer: { text: "Tammy Brightwood • Lifeline Island Paradise 🌴 • Ticket #1116 💗" },
  },
  {
    color: BLUE,
    title: "🏝️💰 Getting Off The Cruise — Island Amenities & Your Bungalow!",
    description:
      "Now for your island questions, love! 🌊 When we dock at a destination, **going ashore is " +
      "completely free** — every guest can explore the beach, food court, rides, games and water " +
      "sports at no extra cost. 🎡🏖️\n\n" +
      "The **extra amenities** you're asking about are our **celebration packages** — those are the " +
      "private, set-up-just-for-you experiences. 💕",
    fields: [
      {
        name: "🛖✨ Your Bungalow — Two Lovely Options!",
        value:
          "🛖 **Bungalow Romantic Escape — L$1,000**\n" +
          "*Private bungalow/cabana, rose petals, drinks, dessert tray, cuddle poses & " +
          "30–60 minutes of reserved private time.* 💕\n\n" +
          "🏝️ **Private Island Beach House — L$1,000 for 24 hours**\n" +
          "*Your very own beach house on a **PRIVATE ISLAND**, with a custom setup — perfect for a " +
          "romantic getaway or family time, games and island vibes included!* 🌴",
        inline: false,
      },
      {
        name: "🛒📱 How To Buy A Package",
        value:
          "**All packages are purchased straight from your Cruise HUD!** 📱✨\n\n" +
          "1️⃣ Open your **Cruise HUD**\n" +
          "2️⃣ Browse the package menu & pick your favourite 💕\n" +
          "3️⃣ Pay in-world to **`zoedollyanna Resident`**\n" +
          "4️⃣ Our crew coordinates the date, time and every little detail with you 💌\n\n" +
          "*Prefer a hand? Just reply right here and I'll help you pick!* 🎀",
        inline: false,
      },
      {
        name: "💵 Price Range",
        value:
          "We offer **21 packages** — **L$300 to L$1,800** 💗\n" +
          "Every price is **one direct price** — nothing hidden, nothing extra. ✨\n\n" +
          "📜 *Full menu in my next message!* 👇",
        inline: false,
      },
    ],
    footer: { text: "Tammy Brightwood • Lifeline Island Paradise 🌴 • Packages via your Cruise HUD 📱" },
  },
];

/* ── Message 2: the full catalog ── */
const catalogEmbeds = [
  {
    color: PINK,
    title: "💞 Romantic Packages — 🛳️ Onboard The Ship",
    description: "Private experiences for just the two of you, set up right here on board 💕",
    fields: [
      pkg("🌹", "Cabin Romance Setup", 600, ["Rose petals & candles", "Wine / champagne / mocktail tray", "Chocolate & strawberries", "Soft music", "Couple pose or cuddle rug"]),
      pkg("🌠", "Stargazing Deck Date", 500, ["Quiet deck / balcony spot", "Blanket or loveseat", "Drinks for two", "Couple poses", "“Stargazing at Sea” notecard", "Optional candles / firepit"]),
      pkg("🔎", "Mystery Date Night", 450, ["Couple detective card", "Reserved mystery start time", "“Date Night Detective Duo” notecard", "Small couples prize"]),
      pkg("🎳", "Couples Game Night", 450, ["Bowling / game room date", "Couple trivia", "Drinks & snacks", "Winner gets a small prize"]),
      pkg("🎬", "Private Movie Date", 400, ["Reserved theater row for two", "Popcorn, candy & drink tray", "Cozy couple seating", "Cute keepsake message"]),
    ],
  },
  {
    color: PINK,
    title: "💞 Romantic Packages — 🏝️ On The Island",
    description: "For when we dock — your private slice of paradise ashore 🌴",
    fields: [
      pkg("💍", "Proposal / Anniversary Package", 1800, ["Fully decorated beach setup", "“Will you marry me?” or anniversary sign", "Fireworks", "Champagne", "Photographer / photo pose area"]),
      pkg("🕯️", "Private Romantic Beach Dinner", 1200, ["Private table on the beach", "Candles & lanterns", "Dinner plates & drinks", "Couple poses", "Soft music", "Optional staff host"]),
      pkg("🛖", "Bungalow Romantic Escape", 1000, ["Private bungalow / cabana", "Rose petals", "Drinks", "Dessert tray", "Cuddle poses", "30–60 minutes reserved time"]),
      pkg("💆", "Couples Spa & Relaxation", 900, ["Massage tables or spa chairs", "Fruit water & drinks", "Robes & towels", "Calm tropical setup", "Private bungalow time afterward"]),
      pkg("🧺", "Sunset Picnic", 800, ["Beach blanket & picnic basket", "Drinks", "Lanterns", "Couple photo spot", "Optional sunset fireworks"]),
      pkg("🔥", "Moonlight Bonfire Date", 750, ["Beach bonfire", "Blanket / loveseat", "Drinks", "S'mores & snacks", "Couple poses", "Music stream"]),
    ],
  },
  {
    color: BLUE,
    title: "👨‍👩‍👧‍👦 Family Packages — 🛳️ Onboard The Ship",
    description: "Perfect for when your little one is a bit bigger — or for family sailing with you! 🧸",
    fields: [
      pkg("🕵️", "Family Detective Crew", 500, ["Family detective badge & notecard", "Group clue hunt guide", "“Junior Detective” title for kids", "Family photo stop", "Small prize at the end"]),
      pkg("🎲", "Cabin Game Night", 450, ["Rezzable board game setup in your cabin", "Snacks & drinks basket", "Family movie suggestion", "Bowling / game room time", "Keepsake notecard"]),
      pkg("🍿", "Family Movie + Snacks", 400, ["Reserved movie theater row", "Popcorn, candy & drink tray", "Movie night announcement", "Optional pajama theme"]),
      pkg("🧸", "Kids Cruise Fun Pack", 350, ["Plushie / toy drop for each kiddo", "Coloring & activity notecard", "Snack box", "Cruise scavenger hunt", "Mini prize"]),
      pkg("📸", "Family Photo Memories", 300, ["3–5 cute photo spots around the ship", "Pose balls / pose stand", "“Cruise Memories” notecard", "Crew member helps with angles"]),
    ],
  },
  {
    color: BLUE,
    title: "👨‍👩‍👧‍👦 Family Packages — 🏝️ On The Island",
    description: "Sunshine, sand and island magic for the whole crew 🌺",
    fields: [
      pkg("🏝️", "Family Adventure Bundle", 950, ["Island scavenger hunt", "Beach games", "Mini mystery clue", "Family dinner or picnic", "Prize chest finale"]),
      pkg("🌺", "Family Luau", 750, ["Lei welcome for everyone", "Tropical food table", "Music & dance area", "Family poses", "Cute souvenir gift"]),
      pkg("🏖️", "Family Beach Day", 650, ["Reserved beach blanket or cabana", "Sandcastle & toy setup", "Drinks & snacks", "Family photo spot", "Volleyball, frisbee, floaties & water toys"]),
      pkg("🗺️", "Island Treasure Hunt", 550, ["Treasure map notecard", "5 clue stops around the island", "Treasure chest prize", "Great for kids & whole families"]),
      pkg("💦", "Splash & Snacks", 500, ["Waterpark / splash area visit", "Snack tray", "Floaties & toys", "Family photo stop", "Optional parents-relax cabana"]),
    ],
    footer: { text: "Tammy Brightwood • Lifeline Island Paradise 🌴 • Reply here anytime, lovely! 💗" },
  },
];

async function send(payload) {
  const res = await fetch(`${API}/channels/${CHANNEL_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

(async () => {
  const me = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bot ${TOKEN}` } }).then((r) => r.json());
  console.log(`Logged in as ${me.username} (${me.id})`);

  const m1 = await send({
    content: `<@${GUEST_ID}>`,
    embeds: answerEmbeds,
    message_reference: { message_id: REPLY_TO, channel_id: CHANNEL_ID, fail_if_not_exists: false },
    allowed_mentions: { users: [GUEST_ID] },
  });
  console.log(`Answer sent. msgId=${m1.id} (reply to ${REPLY_TO})`);

  const m2 = await send({ embeds: catalogEmbeds, allowed_mentions: { parse: [] } });
  console.log(`Catalog sent. msgId=${m2.id}`);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
