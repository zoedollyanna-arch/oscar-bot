/* Tammy Brightwood → every OPEN ticket/booking channel in the Support category.
 * Arrival announcement: Carnaval de San Isla, Puerto Rico + 4 destination landmarks.
 * Pings the ticket opener where we can resolve them from the bookings table.
 */
const fs = require("fs");
const { Client } = require("pg");

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = loadEnv("./oscar-bot.env");
const TOKEN = env.DISCORD_TOKEN;
const API = "https://discord.com/api/v10";
const SUPPORT_CATEGORY_ID = "1428518011219873904";

const LANDMARKS = [
  { emoji: "🛟", name: "Lazy River",  url: "https://maps.secondlife.com/secondlife/Ethereal%20Paradise/162/161/22", blurb: "Float, drift and let the day melt away" },
  { emoji: "🍔", name: "Food Court",  url: "https://maps.secondlife.com/secondlife/Ethereal%20Paradise/175/190/23", blurb: "Island bites and carnival treats" },
  { emoji: "🏖️", name: "Beach",       url: "https://maps.secondlife.com/secondlife/Ethereal%20Paradise/207/184/23", blurb: "Warm sand, blue water, pure bliss" },
  { emoji: "🎡", name: "Attractions", url: "https://maps.secondlife.com/secondlife/Ethereal%20Paradise/166/108/22", blurb: "Rides, games and carnival magic" },
];

async function api(path, init = {}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(API + path, {
      ...init,
      headers: { Authorization: `Bot ${TOKEN}`, ...(init.headers || {}) },
    });
    if (r.status === 429) {
      const j = await r.json().catch(() => ({}));
      await new Promise((res) => setTimeout(res, ((j.retry_after || 1) * 1000) + 250));
      continue;
    }
    const text = await r.text();
    if (!r.ok) throw new Error(`${r.status} ${text}`);
    return text ? JSON.parse(text) : null;
  }
  throw new Error("rate limited: " + path);
}

function buildEmbed() {
  return {
    color: 0xff5fa2,
    title: "🎉🇵🇷 We've Arrived — Carnaval de San Isla, Puerto Rico! 🇵🇷🎉",
    description:
      "Hola, lovely travellers! 💕 **Cruise Director Tammy** here — we have officially docked at " +
      "**Carnaval de San Isla, Puerto Rico** and the carnival is alive with music, colour and island magic! 🎊🎶\n\n" +
      "💛 **First, a heartfelt apology** — we know our arrival took longer than planned, and we're truly sorry " +
      "for the delay. Thank you so, so much for your patience and for bearing with us. It means the world to " +
      "all of us here on board. 🙏✨\n\n" +
      "Now come ashore and enjoy every moment — here is everywhere you can explore! 🌴",
    fields: [
      ...LANDMARKS.map((l) => ({
        name: `${l.emoji} ${l.name}`,
        value: `*${l.blurb}*\n[✨ Teleport here ✨](${l.url})\n\`${l.url}\``,
        inline: false,
      })),
      {
        name: "🧭 Getting There",
        value:
          "Tap any landmark above to teleport straight over, or hop on the **Deck 2 Teleporter** to reach " +
          "the destination. 🚀",
        inline: false,
      },
      {
        name: "🛎️ Need A Hand?",
        value:
          "Can't find your way, lost an item, or need anything at all? Just reply right here, or come find " +
          "**Tammy** at the Front Desk — I'm always happy to help. 💙",
        inline: false,
      },
    ],
    footer: { text: "With love, Cruise Director Tammy • Lifeline Island Paradise 💖🌊" },
    timestamp: new Date().toISOString(),
  };
}

(async () => {
  // Ticket opener lookup (booking channels)
  const c = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const rows = (await c.query("SELECT data FROM bookings")).rows.map((r) => r.data).filter(Boolean);
  await c.end();
  const openerByChannel = new Map();
  for (const b of rows) if (b.channelId && b.openerId) openerByChannel.set(String(b.channelId), String(b.openerId));
  openerByChannel.set("1533130706417487973", "836643018999070790"); // ticket-1113 (chyna7938)

  const chans = await api(`/guilds/${env.GUILD_ID}/channels`);
  const targets = chans.filter(
    (ch) => ch.type === 0 && ch.parent_id === SUPPORT_CATEGORY_ID && /^(booking|ticket)-\d+$/i.test(ch.name)
  ).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  console.log(`Found ${targets.length} open ticket/booking channels:\n`);

  let sent = 0, failed = 0, pinged = 0;
  for (const ch of targets) {
    const opener = openerByChannel.get(ch.id);
    try {
      await api(`/channels/${ch.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: opener ? `<@${opener}> 🇵🇷🎊` : "",
          embeds: [buildEmbed()],
          allowed_mentions: opener ? { users: [opener] } : { parse: [] },
        }),
      });
      sent++;
      if (opener) pinged++;
      console.log(`  ✅ #${ch.name.padEnd(14)} ${opener ? `(pinged ${opener})` : "(no opener resolved — no ping)"}`);
    } catch (e) {
      failed++;
      console.log(`  ❌ #${ch.name.padEnd(14)} ${e.message.slice(0, 120)}`);
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  console.log(`\n📊 Sent ${sent}/${targets.length} • pinged ${pinged} • failed ${failed}`);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
