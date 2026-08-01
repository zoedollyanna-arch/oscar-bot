/* One-shot: reply as Tammy to chyna7938 in support ticket #1110 with the booking
 * instructions and the correct channel. Plain text, no embed.
 * Run: node reply-ticket-1110-booking.js */
require("dotenv").config();

const TOKEN    = process.env.DISCORD_TOKEN;
const CHANNEL  = "1532140833883689010";  // #ticket-1110
const REPLY_TO = "1532553728085852384";  // chyna7938: "Where can I go"
const BOOKING  = "1522402217880190976";  // reservations channel — /book only works here

const body =
  "Right here, lovely! 💕 Head over to <#" + BOOKING + "> and run **`/book`** — that's " +
  "the only channel the booking form works in, so if you try it anywhere else it won't come up. 🛳️\n" +
  "\n" +
  "A little form will pop open and ask you for:\n" +
  "• **Your in-world name** — e.g. `Zoedollyanna Resident`\n" +
  "• **Your avatar UUID**\n" +
  "• **Family / group name** — just pop `N/A` if it's not a family or group booking\n" +
  "• **Guest names + UUIDs** — one per line as `Name Resident - UUID`, including yourself. Max 6 aboard total 💫\n" +
  "• **Dates, duration & notes** — this is where you tell us your **own preferred dates**, whether you'd like " +
  "3, 4, 5, 6 days or a full week, plus anything special you'd like us to know 🌴\n" +
  "\n" +
  "Since you're planning a private trip, put your dates and any package you're interested in " +
  "(like the **Private Romantic Beach Dinner** or a **Family Adventure Bundle**) straight into that last box — " +
  "that way our crew can start coordinating it for you right away. 🏝️✨\n" +
  "\n" +
  "Once you're booked you'll get your **Lifeline HUD**, and that's what you'll use to request your packages onboard. 🎁\n" +
  "\n" +
  "Any trouble at all with the form, just shout right here and I'll walk you through it! 💌";

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
      content: body,
      message_reference: { message_id: REPLY_TO, channel_id: CHANNEL, fail_if_not_exists: false },
      allowed_mentions: { parse: [], replied_user: true },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`send failed (${r.status}): ${JSON.stringify(data).slice(0, 400)}`);

  console.log(JSON.stringify({ sent: true, as: me.username, messageId: data.id, repliedTo: REPLY_TO }, null, 2));
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
