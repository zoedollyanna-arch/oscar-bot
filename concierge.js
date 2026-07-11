// Intent router for Discord. It does not execute Lifeline workflows or duplicate slash commands;
// it explains the next step and points members to the command owned by Lifeline Assistant.
const cooldowns = new Map();
const helpChannels = new Set(String(process.env.TAMMY_HELP_CHANNEL_IDS || "").split(",").map((x) => x.trim()).filter(Boolean));

const intents = [
  { id: "redelivery", words: ["redelivery", "redeliver", "resend", "replacement copy", "lost my product", "missing item"], reply: "For a product redelivery, use **`/redelivery`** from Lifeline Assistant. Have your Second Life username and product name ready." },
  { id: "support", words: ["support", "help me", "not working", "broken", "bug", "technical issue", "need staff"], reply: "Use **`/support`** to open a private Lifeline support ticket. Include the product, what happened, and any error message." },
  { id: "booking", words: ["book", "booking", "reserve", "reservation", "cabin", "suite", "cruise stay"], reply: "Use **`/book`** to start a Lifeline Island Paradise cabin booking. Staff cruise controls are handled separately after booking." },
  { id: "application", words: ["apply", "application", "join staff", "become staff", "be a blogger", "become a blogger"], reply: "Use **`/apply staff`** for the staff team or **`/apply blogger`** for the blogger program." },
  { id: "incident", words: ["report someone", "rule violation", "harassment", "griefing", "incident", "unsafe"], reply: "Use **`/incident`** for an OOC incident or rule violation. For immediate danger, contact an online staff member too." },
  { id: "faq", words: ["faq", "how does lifeline work", "what is lifeline", "getting started", "new player"], reply: "Use **`/faq search`** with a topic, or **`/faq list`** to browse Lifeline Assistant's knowledge base." },
  { id: "character", words: ["character", "character profile", "roleplay profile", "edit my character"], reply: "Use **`/character create`**, **`/character view`**, or **`/character edit`** for the character registry." },
  { id: "suggestion", words: ["suggestion", "suggest", "idea", "feature request"], reply: "Use **`/suggest`** to send your idea to the Lifeline team." },
  { id: "affiliate", words: ["affiliate", "partner store", "affiliate program"], reply: "Use **`/affiliate start`** for program details, **`/affiliate apply`** to apply, or **`/affiliate status`** to check an application." },
  { id: "blogger", words: ["blogger dashboard", "blogger assignment", "submit blog", "blogger package"], reply: "Use **`/blogger dashboard`** for your overview, **`/blogger assignments`** for current work, or **`/blogger submit`** to submit a post." },
  { id: "alerts", words: ["alerts", "notifications", "subscribe", "event alerts", "sale alerts"], reply: "Use **`/subscribe`** to choose which Lifeline alerts you receive." },
  { id: "academy", words: ["academy", "school", "student", "teacher", "homework", "enrollment"], reply: "Use Lifeline Assistant's **`/academy`** command for Academy Digital options. In-world homework is available from the ZPad Homework app." },
  { id: "hud_sync", words: ["profile sync failed", "hud loading", "hud is stuck", "hud stuck", "hud won't load", "hud will not load", "cloud profile"], reply: "Detach and reattach the HUD, then allow up to 30 seconds for cloud loading. If it still fails, use **`/support`**." },
  { id: "device_sync", words: ["zpad needs hud", "zphone needs hud", "zpad needs my hud", "zphone needs my hud", "phone disconnected", "tablet disconnected", "device sync"], reply: "Wear your Lifeline HUD and wait for the ZPad/ZPhone to reconnect. The ZPhone retries after teleports and polls for the HUD automatically. Use **`/support`** if it remains disconnected." },
  { id: "stats", words: ["stats paused", "stats not moving", "stats not decaying", "stats are not decaying", "resume stats", "pause stats"], reply: "Open the HUD **Power** menu and choose **Resume Stats** or **Pause Stats**. If the controls do not respond, detach and reattach first." },
  { id: "jobs", words: ["get a job", "apply for a job", "zpad job", "zphone job", "clock in", "job shift"], reply: "Open the **Jobs** app on your ZPad or ZPhone, choose a job, and apply there. Once approved, return to Jobs to clock in." },
  { id: "eats", words: ["lifeline eats", "food delivery", "order food", "delivery box", "restaurant"], reply: "Open **Eats** on the ZPad or ZPhone, place the order, and wait for the NPC delivery box. Only the ordering avatar can collect it." },
  { id: "zfunds", words: ["zfunds", "redeem xp", "send money", "allowance", "lifeline money"], reply: "Open **ZFunds** on the ZPad or ZPhone. You can send funds or redeem XP there; XP redemption has a five-minute cooldown." },
  { id: "insurance", words: ["insurance", "health plan", "pharmacy discount"], reply: "Open **Insurance** on your ZPhone to view or purchase a plan. Use the Pharmacy app for covered medication purchases." },
  { id: "reset", words: ["full reset", "reset hud", "reset my hud"], reply: "Open the HUD **Power** menu and choose **Full Reset**. Try detach/reattach first; use **`/support`** if your profile still will not load." },
  { id: "location", words: ["where is tammy", "where are you", "cruise landmark", "boarding location", "teleport to cruise", "ethereal paradise"], reply: "Tammy boards at **Ethereal Paradise (85, 129, 35)**: <http://maps.secondlife.com/secondlife/Ethereal%20Paradise/85/129/35>." },
];

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9'\s/-]/g, " ").replace(/\s+/g, " ").trim();
}

function classify(text) {
  const normalized = normalize(text);
  let best = null;
  for (const intent of intents) {
    const matches = intent.words.filter((word) => normalized.includes(word));
    if (!matches.length) continue;
    const score = Math.max(...matches.map((word) => word.split(" ").length * 10 + word.length));
    if (!best || score > best.score) best = { intent, score };
  }
  return best?.intent || null;
}

async function handleMessage(message, client) {
  if (!message.guild || message.author.bot || !message.content) return false;
  if (helpChannels.size && !helpChannels.has(message.channelId)) return false;
  const mentioned = message.mentions.has(client.user);
  const intent = classify(message.content);
  if (!intent && !mentioned) return false;

  const now = Date.now();
  const key = `${message.guildId}:${message.author.id}:${intent?.id || "unknown"}`;
  if ((cooldowns.get(key) || 0) > now - 30_000) return false;
  cooldowns.set(key, now);

  const answer = intent?.reply || "Tell me what you need help with, or use **`/faq search`** and **`/support`** through Lifeline Assistant.";
  await message.reply({ content: `<@${message.author.id}> ${answer}`, allowedMentions: { users: [message.author.id], repliedUser: false } });
  return true;
}

module.exports = { handleMessage, classify, intents };
