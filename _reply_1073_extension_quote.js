// Replies (as Tammy) to she5ft's "How much to extend 1 more day?" in booking-1073
// with the Family Cabin extension quote + payment instructions.
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

const CHANNEL_ID = "1527437085685059644"; // booking-1073
const REPLY_TO = "1533510025073655889";   // "How much to extend 1 more day?"
const USER_ID = "1367651183359164520";    // she5ft

// Family Cabin = L$150/day (cruiseHub.js CABIN_TYPES.family.perDay)
const PER_DAY = 150;
const CURRENT_CHECKOUT = 1785693600; // 8/2
const NEW_CHECKOUT = CURRENT_CHECKOUT + 86400; // 8/3

const embed = {
  title: "🌴💗 Yes You Can Extend — Here's Your Quote! 💗🌴",
  description:
    "Hi lovely! 🌺✨ **Tammy** here at the Front Desk 💙\n\n" +
    "💛 **First — I am so sorry for the delay** getting back to you on this. You asked earlier and then " +
    "again last night, and you shouldn't have had to wait or ask twice. Thank you for being so patient " +
    "with us, sweetheart — I'm taking care of it right now! 🙏💕\n\n" +
    "And don't worry — **you are not going to miss Puerto Rico!** 🇵🇷🎊",
  color: 0xffb6c1,
  fields: [
    {
      name: "🛏️ Your Cabin Type",
      value: "🏡 **Family Cabin** — Cabin **F01**\n*(up to 6 guests, Soprano Family 💕)*",
      inline: false,
    },
    {
      name: "💵✨ Your Extension Price",
      value:
        "🌴 **1 extra day = L$150**\n\n" +
        "That's our Family Cabin rate of **L$150 per day** — the same per-day rate your original " +
        "booking was priced at. No hidden fees, nothing extra! 🥰",
      inline: false,
    },
    {
      name: "🗓️ What Changes",
      value:
        `🧳 **Current checkout:** <t:${CURRENT_CHECKOUT}:F>\n` +
        `✨ **New checkout after extension:** <t:${NEW_CHECKOUT}:F>\n\n` +
        "🎀 Everything else stays exactly the same — same cabin **F01**, same guest roster, " +
        "same gorgeous layout our crew set up for you! 💕",
      inline: false,
    },
    {
      name: "💳💌 How To Pay",
      value:
        "1️⃣ In Second Life, send **L$150** to:\n" +
        "**`zoedollyanna resident`** 💗\n\n" +
        "2️⃣ Then pop right back here and reply to let me know you've sent it! 📩\n\n" +
        "*Please send it in-world — payments don't go through Discord.* 💙",
      inline: false,
    },
    {
      name: "✅🎉 What Happens After You Pay",
      value:
        "💖 **As soon as your payment comes through, we will add the additional day to your stay** " +
        "and update your booking straight away!\n\n" +
        "🔔 I'll confirm it right here in your ticket so you can see your new checkout date. " +
        "Then you're free to enjoy every last bit of Puerto Rico! 🇵🇷🎡🏖️",
      inline: false,
    },
    {
      name: "🛎️ Need Anything Else?",
      value:
        "💬 Just reply right here, or come find me at the **Front Desk** — " +
        "I'm always happy to help, sweetheart! 💚🌊",
      inline: false,
    },
  ],
  footer: {
    text: "Tammy Brightwood • Lifeline Island Paradise 🌴 • Booking #1073 • Cabin F01 💗",
  },
  timestamp: new Date().toISOString(),
};

(async () => {
  const me = await fetch(`${API}/users/@me`, {
    headers: { Authorization: `Bot ${TOKEN}` },
  }).then((r) => r.json());
  console.log(`Logged in as ${me.username} (${me.id})`);

  const res = await fetch(`${API}/channels/${CHANNEL_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: `<@${USER_ID}>`,
      embeds: [embed],
      message_reference: { message_id: REPLY_TO, channel_id: CHANNEL_ID, fail_if_not_exists: false },
      allowed_mentions: { users: [USER_ID] },
    }),
  });

  if (!res.ok) {
    console.error("FAILED:", res.status, await res.text());
    process.exit(1);
  }
  const msg = await res.json();
  console.log(`Reply sent. msgId=${msg.id} (replying to ${REPLY_TO})`);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
