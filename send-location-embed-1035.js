/* One-shot: post the onboard/offboard location choice embed into booking-1035.
 * Run: node send-location-embed-1035.js */
require("dotenv").config();
const { locationEmbed } = require("./packageLocation");

const TOKEN = process.env.DISCORD_TOKEN;
const TICKET_CHANNEL_ID = "1525981661823762674"; // booking-1035
const GUEST_ID = "890330032139026493";            // 4feiin

(async () => {
  const payload = locationEmbed(GUEST_ID, "Family Detective Crew", "5:00 PM SLT");
  const r = await fetch(`https://discord.com/api/v10/channels/${TICKET_CHANNEL_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      content: payload.content,
      embeds: payload.embeds.map((e) => e.toJSON()),
      components: payload.components.map((c) => c.toJSON()),
      allowed_mentions: { users: [GUEST_ID] },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Discord HTTP ${r.status}: ${JSON.stringify(data).slice(0, 400)}`);
  console.log("location embed posted as Tammy:", data.id, "in", data.channel_id);
})().catch((e) => { console.error(e); process.exit(1); });
