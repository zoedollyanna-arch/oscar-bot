/* One-shot: Tammy announces the Puerto Rico arrival slipping to 8/1 8:00 PM SLT
 * because of weather. Posts to #travelers and pings the Travelers role.
 * Run: node send-puerto-rico-delay.js */
require("dotenv").config();

const TOKEN   = process.env.DISCORD_TOKEN;
const CHANNEL = "1522402414949302323";  // #travelers
const ROLE    = "1522402829199868004";  // Travelers

/* 8:00 PM SLT on Sat 1 Aug 2026. SLT is PDT (UTC-7), so 03:00 UTC on the 2nd. */
const ARRIVE_TS = Math.floor(Date.parse("2026-08-02T03:00:00Z") / 1000);

const embed = {
  color: 0xF5A9D0,
  title: "🌩️⚓ A Little Change of Plans, Lovelies ⚓🌩️",
  description:
    "**Cruise Director Tammy here** 🎀💕\n\n" +
    "Our Captain has been keeping a very close eye on the skies, and the weather " +
    "between us and **Puerto Rico** has turned properly wild — heavy squalls, rolling swells " +
    "and winds that are not fit for bringing a ship alongside. 🌊⛈️\n\n" +
    "So we're **holding at safe anchor tonight** and riding it out in comfort. " +
    "Nothing to worry about at all — this is simply what we do to keep every guest " +
    "safe and every cocktail upright. 🍹✨",
  fields: [
    {
      name: "🏰 Puerto Rico — New Arrival",
      value:
        "🗓️ **Tomorrow, Saturday 1 August**\n" +
        "🕗 **8:00 PM SLT** — <t:" + ARRIVE_TS + ":F>\n" +
        "*(<t:" + ARRIVE_TS + ":R>)*\n\n" +
        "We are **not** docking today as originally planned. 💗",
      inline: false
    },
    {
      name: "⚓ Why We're Waiting",
      value:
        "Bringing a ship into port in this kind of sea is genuinely unsafe — for the vessel, " +
        "the crew ashore, and most of all for you. Our Captain would rather arrive a little late " +
        "and perfectly safe than on time and rattled. 🧭💙",
      inline: false
    },
    {
      name: "🛳️ Making Tonight Lovely Anyway",
      value:
        "☕ **Concierge Desk** is open all evening — come find us for anything at all\n" +
        "🎬 The **Cruise Theater** is warm, dry and showing films\n" +
        "🍽️ Room service is running as normal — perfect storm-watching weather\n" +
        "🛏️ Cabins are cosy, and the rocking makes for *wonderful* sleeping 😴",
      inline: false
    },
    {
      name: "💌 Anything At All",
      value:
        "Your stay dates and bookings are **completely unaffected** — nothing to re-book, " +
        "nothing to worry about. If you have questions, just reply in your **booking ticket** " +
        "or come see me at the **Front Desk** and I'll take care of it personally. 🛎️",
      inline: false
    }
  ],
  footer: { text: "With love, Cruise Director Tammy & your Concierge Team • Lifeline Island Paradise 💖🛳️" },
  timestamp: new Date().toISOString()
};

(async () => {
  if (!TOKEN) throw new Error("DISCORD_TOKEN missing from .env");

  const me = await (await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bot ${TOKEN}` },
  })).json();
  if (!/tammy/i.test(`${me.username || ""} ${me.global_name || ""}`)) {
    throw new Error(`Refusing to send: token is not Tammy (${me.username || me.id})`);
  }

  const r = await fetch(`https://discord.com/api/v10/channels/${CHANNEL}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `<@&${ROLE}> Just a quick note from the bridge, lovelies 💕`,
      embeds: [embed],
      allowed_mentions: { roles: [ROLE] },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`send failed (${r.status}): ${JSON.stringify(data).slice(0, 400)}`);

  console.log(JSON.stringify({ sent: true, as: me.username, messageId: data.id }, null, 2));
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
