/* One-shot: booking-1034 (chanel.theedon_vl) — the Cabin Romance Setup in C04 is finished.
 * Post Tammy's cute completion embed in the ticket. Run: node send-romance-complete-1034.js */
require("dotenv").config();
const TOKEN = process.env.DISCORD_TOKEN;
const TICKET_CHANNEL_ID = "1525957535448961174"; // booking-1034 ticket
const GUEST_ID = "1486017357041242263";          // chanel.theedon_vl

const embed = {
  color: 0xff5fa2,
  title: "🌹✨ Your Cabin Romance Setup is Complete! ✨🌹",
  description:
    "It's ready, lovelies! Our crew has slipped out and your cabin is officially transformed — " +
    "rose petals, glowing candles, a bubbly tray, chocolate strawberries, soft music and a cozy " +
    "cuddle spot are all waiting for you two. 🥂🍓\n\n" +
    "**We hope you enjoy every single second of it.** 💕",
  fields: [
    {
      name: "🏠 Where the Magic Awaits",
      value: "Cabin **C04** — head on over whenever you're ready for your perfect evening. 🌙",
      inline: false,
    },
    {
      name: "🛎️ Need Anything?",
      value:
        "If there's anything at all we can do to make tonight even dreamier, just message us right " +
        "here — Tammy's always at the Front Desk. Enjoy, you two! 💖",
      inline: false,
    },
  ],
  footer: { text: "Lifeline Island Paradise • Tammy at the Front Desk 🛎️💕" },
  timestamp: new Date().toISOString(),
};

(async () => {
  const r = await fetch(`https://discord.com/api/v10/channels/${TICKET_CHANNEL_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content: `<@${GUEST_ID}> 🌹`, embeds: [embed], allowed_mentions: { users: [GUEST_ID] } }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Discord HTTP ${r.status}: ${JSON.stringify(data).slice(0, 400)}`);
  console.log("completion embed posted as Tammy:", data.id, "in", data.channel_id);
})().catch((e) => { console.error(e); process.exit(1); });
