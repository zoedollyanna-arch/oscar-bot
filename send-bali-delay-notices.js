/* One-shot, two posts as Tammy:
 * 1. Lifeline-Travelers channel: cruise-director notice — Tulum departure ran late,
 *    Bali arrival now begins 7/18 8:00 PM SLT; scheduled packages will be rescheduled
 *    for that day and/or location.
 * 2. booking-1035 ticket (4feiin): Family Detective Crew refund sent, owner unavailable
 *    right now, her Bali package (Bungalow Romantic Escape) hit by the 7/18 date change —
 *    button opens the reschedule modal (packageReschedule.js must be deployed).
 * Run: node send-bali-delay-notices.js */
require("dotenv").config();
const { rescheduleButton } = require("./packageReschedule");

const TOKEN = process.env.DISCORD_TOKEN;
const TRAVELERS_CHANNEL = "1522402414949302323";
const TICKET_1035 = "1525981661823762674";
const GUEST_1035 = "890330032139026493";              // 4feiin
const BALI_ORDER = "pkg-1783997056261-3ohyj4";        // Bungalow Romantic Escape (island)

async function post(channelId, body) {
  const r = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Discord HTTP ${r.status} (${channelId}): ${JSON.stringify(data).slice(0, 400)}`);
  return data;
}

const travelersEmbed = {
  color: 0x4fc3f7,
  title: "🛳️🌺 A Note From Your Cruise Director — Bali Update! 🌺🛳️",
  description:
    "Hi lovelies, it's **Tammy — your Cruise Director & Concierge**! 💙\n\n" +
    "Since our voyage out of **Tulum** set sail a little later than planned, our island arrival is " +
    "shifting too: **arrival in Bali begins 7/18 at 8:00 PM SLT**. 🏝️✨\n\n" +
    "**Thank you so much for sailing with us** — every one of you makes this voyage magical. 💕",
  fields: [
    {
      name: "🎁 Have Packages Scheduled?",
      value:
        "No worries at all — any scheduled packages will be **rescheduled for that day and/or " +
        "location**. Our crew will reach out in your booking ticket to get everything perfect. 💝",
      inline: false,
    },
    {
      name: "🛎️ Questions?",
      value: "Pop into your booking ticket or find me at the Front Desk anytime — I've got you! 💙",
      inline: false,
    },
  ],
  footer: { text: "Lifeline Island Paradise • Tammy, Cruise Director & Concierge 🛎️💕" },
  timestamp: new Date().toISOString(),
};

const ticketEmbed = {
  color: 0xff5fa2,
  title: "💌 An Update on Your Packages, Lovely!",
  description:
    "Hi sweetie, Tammy here — your Cruise Director & Concierge! 💙 A few little updates for you:",
  fields: [
    {
      name: "💰 Family Detective Crew — Refund Sent",
      value:
        "We've **sent your refund** for the Family Detective Crew paradise package — thank you so, so " +
        "much for your patience with us today. 💛",
      inline: false,
    },
    {
      name: "🛎️ A Small Heads-Up",
      value: "The **owner is unavailable at this time**, but I'm right here and taking care of everything for you personally. 💙",
      inline: false,
    },
    {
      name: "🌺 Your Bali Package — Bungalow Romantic Escape",
      value:
        "We noticed you have a package waiting for **Bali**! Since our arrival date has moved to " +
        "**7/18 (8:00 PM SLT)**, we'd love to know — would you like to **keep your time the same** for " +
        "that location, even with the new date? 🏝️",
      inline: false,
    },
    {
      name: "📅 Update It in Seconds",
      value:
        "Tap the button below and a quick little form will pop up where you can set your **date, time, " +
        "and preferred spot** for your Bali paradise package. Easy peasy! ✨",
      inline: false,
    },
  ],
  footer: { text: "Lifeline Island Paradise • Tammy at the Front Desk 🛎️💕" },
  timestamp: new Date().toISOString(),
};

(async () => {
  const m1 = await post(TRAVELERS_CHANNEL, { embeds: [travelersEmbed] });
  console.log("travelers notice posted:", m1.id);
  const m2 = await post(TICKET_1035, {
    content: `<@${GUEST_1035}> 💙`,
    embeds: [ticketEmbed],
    components: [rescheduleButton(GUEST_1035, BALI_ORDER).toJSON()],
    allowed_mentions: { users: [GUEST_1035] },
  });
  console.log("ticket notice posted:", m2.id);
})().catch((e) => { console.error(e); process.exit(1); });
