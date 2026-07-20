/* Edit the cabin announcement to remove "Suite & Presidential" line.
 * Run: node edit-announcement.js */
require("dotenv").config();
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = "1522402217880190976";
const MSG_ID = "1527058340386177168";

const correctedEmbed = {
  title: "🏝️ Lifeline Island Paradise — Cabins Available! 🛳️",
  description:
    "Ahoy there, future traveler! 🌴✨\n\n" +
    "Looking for the perfect getaway? **Lifeline Island Paradise** has a variety of beautiful cabins available to book right now! " +
    "Whether you're planning a romantic escape, a family adventure, or a solo retreat — we've got the perfect spot for you 💕\n\n" +
    "**Currently Available Cabins:** 🏠\n" +
    "> 🏡 **Standard Cabins** — Cozy and comfortable for 1–2 guests\n" +
    "> 💑 **Romance Cabins** — Rose petals, candlelit vibes, pure magic 🌹\n" +
    "> 👨‍👩‍👧‍👦 **Family Cabins** — Spacious suites for the whole crew\n\n" +
    "**How to Book:**\n" +
    "> 1️⃣ Head over to the **reservations channel** and run **`/book`**\n" +
    "> 2️⃣ Choose your cabin type, dates, and duration\n" +
    "> 3️⃣ Complete your payment — and you're in! 🎉\n\n" +
    "**Your stay includes:**\n" +
    "• 🛳️ Access to all cruise destinations (Tulum, Bali, Jamaica, Barbados, Aruba, Puerto Rico)\n" +
    "• 🎮 Fun activities, games, and events onboard\n" +
    "• 🍿 Room service & snack delivery\n" +
    "• 🧹 Cabin cleanup & turndown service\n" +
    "• 💕 Romance packages, family adventures, and more!\n\n" +
    "Don't wait — cabins book up fast! Use **`/book`** to reserve your spot today 🌴💙\n\n" +
    "Questions? Just ask — Tammy's always at the Front Desk 🛎️",
  color: 16099792,
  fields: [
    { name: "🗓️ Upcoming Destinations", value: "🇲🇽 Tulum — July 14\n🌺 Bali — July 16\n🇯🇲 Jamaica — July 20\n🏝️ Barbados — July 23\n🌊 Aruba — July 27\n🇵🇷 Puerto Rico — July 30", inline: false },
    { name: "💳 Pricing", value: "**3 Days:** L$650\n**4 Days:** L$800\n**5 Days:** L$950\n**6 Days:** L$1,100\n**Full Week:** L$1,250\n\n*Packages and upgrades available separately*", inline: true },
    { name: "🛎️ Need Help?", value: "Contact **Tammy at the Front Desk** right here in this server, or open **`/support`** for private assistance 💙", inline: true },
  ],
  footer: { text: "Lifeline Island Paradise • Book your stay today! 🛳️💕" },
  timestamp: "2026-07-15T21:04:39.139000+00:00",
};

(async () => {
  const r = await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages/${MSG_ID}`, {
    method: "PATCH",
    headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [correctedEmbed] }),
  });
  const data = await r.json();
  if (!r.ok) { console.error("FAILED:", r.status, JSON.stringify(data).slice(0,300)); process.exit(1); }
  const desc = data.embeds?.[0]?.description || "";
  console.log("✅ Edited:", data.id);
  console.log("Suite/Presidential:", desc.includes("Suite") ? "❌ STILL THERE" : "✅ REMOVED");
})().catch(e => { console.error(e); process.exit(1); });
