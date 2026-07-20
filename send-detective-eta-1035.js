/* One-shot: booking-1035 (4feiin, F03) — apology + 5:30 PM SLT ETA for the Family
 * Detective Crew package, landmark-to-start-kiosk promise, and another refund if we
 * exceed the time. Sent as Tammy. Run: node send-detective-eta-1035.js */
require("dotenv").config();
const TOKEN = process.env.DISCORD_TOKEN;
const TICKET_CHANNEL_ID = "1525981661823762674"; // booking-1035 ticket
const GUEST_ID = "890330032139026493";           // 4feiin

const embed = {
  color: 0xf39c12,
  title: "🕵️ Your Family Detective Crew Case — Update & ETA!",
  description:
    "Hi lovely! Tammy here from the Front Desk. 💙\n\n" +
    "First — we're **so sorry for the delay** on your **Family Detective Crew** package. That's not " +
    "the pace we like to keep, and we truly appreciate you bearing with us. 🙏💕",
  fields: [
    {
      name: "⏰ Your Case Begins at 5:30 PM SLT",
      value:
        "Everything will be **ready by 5:30 PM SLT today**! The mystery is being set up as we speak — " +
        "clues, case file, badges and all. 🔎✨",
      inline: false,
    },
    {
      name: "🗺️ How You'll Start",
      value:
        "Right at 5:30 you'll receive a **landmark straight to your Start Kiosk** — touch it and your " +
        "family can begin the case **immediately**, no waiting around. 🕵️‍♀️🕵️‍♂️",
      inline: false,
    },
    {
      name: "💛 Our Promise",
      value:
        "**Thank you so much for your patience!** And if we go past the promised time for any reason, " +
        "we'll be providing **another refund** — that's our promise to you. 💙",
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
    body: JSON.stringify({ content: `<@${GUEST_ID}> 💙`, embeds: [embed], allowed_mentions: { users: [GUEST_ID] } }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Discord HTTP ${r.status}: ${JSON.stringify(data).slice(0, 400)}`);
  console.log("detective ETA posted as Tammy:", data.id, "in", data.channel_id);
})().catch((e) => { console.error(e); process.exit(1); });
