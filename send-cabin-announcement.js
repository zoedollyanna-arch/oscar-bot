/* One-shot: post cabin availability announcement to #Booking-and-Reservations
 * and DM blast to all cruise/booking subscribers.
 * Run: node send-cabin-announcement.js */
require("dotenv").config();

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = "1522402217880190976"; // #Booking-and-Reservations

const { EmbedBuilder } = require("discord.js");

// The announcement embed
const embed = new EmbedBuilder()
  .setColor(0xF5A9D0)
  .setTitle("🏝️ Lifeline Island Paradise — Cabins Available! 🛳️")
  .setDescription(
    "Ahoy there, future traveler! 🌴✨\n\n" +
    "Looking for the perfect getaway? **Lifeline Island Paradise** has a variety of beautiful cabins available to book right now! " +
    "Whether you're planning a romantic escape, a family adventure, or a solo retreat — we've got the perfect spot for you 💕\n\n" +
    "**Currently Available Cabins:** 🏠\n" +
    "> 🏡 **Standard Cabins** — Cozy and comfortable for 1–2 guests\n" +
    "> 💑 **Romance Cabins** — Rose petals, candlelit vibes, pure magic 🌹\n" +
    "> 👨‍👩‍👧‍👦 **Family Cabins** — Spacious suites for the whole crew\n" +
    "> �‍👩‍👧‍👦 **Family Cabins** — Spacious suites for the whole crew\n\n" +
-------
REPLACE
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
    "Questions? Just ask — Tammy's always at the Front Desk 🛎️"
  )
  .addFields(
    {
      name: "🗓️ Upcoming Destinations",
      value: "🇲🇽 Tulum — July 14\n🌺 Bali — July 16\n🇯🇲 Jamaica — July 20\n🏝️ Barbados — July 23\n🌊 Aruba — July 27\n🇵🇷 Puerto Rico — July 30",
      inline: false,
    },
    {
      name: "💳 Pricing",
      value: "**3 Days:** L$650\n**4 Days:** L$800\n**5 Days:** L$950\n**6 Days:** L$1,100\n**Full Week:** L$1,250\n\n*Packages and upgrades available separately*",
      inline: true,
    },
    {
      name: "🛎️ Need Help?",
      value: "Contact **Tammy at the Front Desk** right here in this server, or open **`/support`** for private assistance 💙",
      inline: true,
    }
  )
  .setFooter({ text: "Lifeline Island Paradise • Book your stay today! 🛳️💕" })
  .setTimestamp();

(async () => {
  // 1. Post to channel
  console.log("Posting announcement to #Booking-and-Reservations...");
  const r = await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [embed.toJSON()],
    }),
  });
  const channelData = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Channel post failed HTTP ${r.status}: ${JSON.stringify(channelData).slice(0, 300)}`);
  console.log(`✅ Posted to channel: message ${channelData.id}`);

  // 2. DM blast to subscribers
  const { Pool } = require("pg");
  const url = process.env.DATABASE_URL;
  const cleanUrl = url.replace(/([?&])sslmode=[^&]*&?/i, "$1").replace(/[?&]$/, "");
  const pool = new Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false }, max: 2 });

  const subs = await pool.query("SELECT discord_id FROM alert_subscriptions");
  console.log(`\nSending DMs to ${subs.rows.length} subscribers...`);

  let sent = 0;
  let failed = 0;
  for (const { discord_id } of subs.rows) {
    try {
      // Create DM channel
      const dm = await fetch(`https://discord.com/api/v10/users/${discord_id}/channels`, {
        method: "POST",
        headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: discord_id }),
      }).then(r => r.json());

      if (dm.id) {
        const dmMsg = await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ embeds: [embed.toJSON()] }),
        });
        if (dmMsg.ok) {
          sent++;
          process.stdout.write(".");
        } else {
          failed++;
          process.stdout.write("x");
        }
      } else {
        failed++;
        process.stdout.write("x");
      }
    } catch (e) {
      failed++;
      process.stdout.write("x");
    }
  }
  console.log(`\n✅ DMs sent: ${sent} | Failed: ${failed}`);

  await pool.end();
  console.log("\n✅ Done!");
})().catch(e => { console.error("Fatal:", e); process.exit(1); });
