/* One-shot: send the Cabin Romance Setup approval + entry-consent embed (with the
 * romance_consent I Consent button) into booking-1034's ticket AS TAMMY (this bot).
 * The button is handled by romanceConsent.handle wired in index.js — deploy first
 * or presses land before the handler exists.
 * Run: node send-romance-consent-1034.js */
require("dotenv").config();
const { consentEmbed } = require("./romanceConsent");

const TOKEN = process.env.DISCORD_TOKEN;
const TICKET_CHANNEL_ID = "1525957535448961174"; // booking-1034 ticket
const GUEST_ID = "1486017357041242263";          // chanel.theedon_vl

(async () => {
  const payload = consentEmbed(GUEST_ID, "Cabin C04 — Couple Cabin");
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
  console.log("consent embed posted as Tammy:", data.id, "in", data.channel_id);
})().catch((e) => { console.error(e); process.exit(1); });
