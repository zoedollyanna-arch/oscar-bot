/* One-shot: booking-1010 (jazzie0129, Standard Cabin S02) reached her natural checkout —
 * 9-day stay ended 7/15 6pm with no extension. Send Tammy's farewell embed in her booking
 * ticket before the cabin is released. Run: node send-farewell-1010.js */
require("dotenv").config();
const TOKEN = process.env.DISCORD_TOKEN;
const TICKET_CHANNEL_ID = "1522419930585239693"; // booking-1010 ticket
const GUEST_ID = "172001488401465344";           // jazzie0129

const embed = {
  color: 0xffc0cb,
  title: "🌅 Farewell, Sweet Traveler — Until We Meet Again! 🛳️",
  description:
    "Aloha lovely! Your stay with us aboard **Lifeline Island Paradise** has come to an end, and " +
    "checkout is complete. 🧳✨\n\n" +
    "Thank you SO much for sailing with us — having you aboard truly made the voyage brighter. " +
    "We hope your cabin felt like home and your days were filled with sunshine and memories. 💛",
  fields: [
    {
      name: "⭐ Loved Your Stay?",
      value:
        "We'd be over the moon if you'd **leave us a review** and share your favorite moments — it " +
        "helps future travelers find their paradise too! 💕",
      inline: false,
    },
    {
      name: "🌴 Come Back Soon!",
      value:
        "We truly hope to see you again — your next adventure is always just a **`/book`** away. " +
        "Safe travels, and thank you for being part of the Lifeline family! 🌊💙",
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
    body: JSON.stringify({ content: `<@${GUEST_ID}> 💛`, embeds: [embed], allowed_mentions: { users: [GUEST_ID] } }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Discord HTTP ${r.status}: ${JSON.stringify(data).slice(0, 400)}`);
  console.log("farewell posted as Tammy:", data.id, "in", data.channel_id);
})().catch((e) => { console.error(e); process.exit(1); });
