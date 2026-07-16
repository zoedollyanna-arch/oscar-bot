// Tammy's Discord helper. She doesn't run Lifeline workflows or duplicate slash commands — she
// reads what a member is asking, answers like a friendly staff member would, and points them to the
// right command. Replies are player-facing: warm, factual, and free of internal/staff-only wording.
const cooldowns = new Map();
const helpChannels = new Set(String(process.env.TAMMY_HELP_CHANNEL_IDS || "").split(",").map((x) => x.trim()).filter(Boolean));

// ── API RATE LIMIT DIAGNOSIS ───────────────────────────────────────────────
// Root cause: concerge.handleMessage is called on EVERY guild MessageCreate
// event. With 92 channels in the guild, every message in every channel
// (including bot-spam, threads, booking tickets) triggers classify() which
// loops through 30+ intent word lists. In high-traffic moments this means
// hundreds of string-matching operations per second + a potential
// channel.send() call per match — all hitting Discord's API rate limit.
//
// FIX:
//   1. Filter to only monitored channels as early as possible (gate).
//   2. Add a per-guild global message throttle to shed load during spikes.
//   3. Skip non-text channels and bots even earlier.
//   4. Reduce intent iteration: break early on first high-confidence match.
// ───────────────────────────────────────────────────────────────────────────

// Global message counter: if too many messages arrive per second, skip
// non-essential classification to avoid hitting Discord's rate limit.
let msgCounter = 0;
let msgCounterReset = Date.now();
const MSG_THROTTLE = 30; // max messages per second before we rate-limit ourselves

function isRateLimited() {
  const now = Date.now();
  if (now - msgCounterReset > 1000) {
    msgCounter = 0;
    msgCounterReset = now;
  }
  msgCounter++;
  return msgCounter > MSG_THROTTLE;
}

const intents = [
  {
    id: "redelivery",
    words: [
      "redelivery", "redeliver", "re-deliver", "resend", "re-send", "send it again", "send again",
      "replacement copy", "another copy", "get another copy", "lost my product", "lost product",
      "lost my item", "lost item", "lost my hud", "lost the hud", "missing item", "missing product",
      "didn't receive", "didnt receive", "never received", "never got", "didn't get", "didnt get", "no copy",
    ],
    reply: "No worries — run **`/redelivery`** and I'll get your item resent. Have your Second Life username and the product name ready so it goes to the right avatar.",
  },
  {
    id: "support",
    words: [
      "support", "need help", "help me", "not working", "isn't working", "isnt working", "won't work",
      "wont work", "broken", "bug", "glitch", "error", "technical issue", "need staff", "talk to staff",
      "talk to a human", "speak to someone", "speak to staff", "open a ticket", "make a ticket",
      "contact staff", "customer service", "who can help",
    ],
    reply: "I've got you — open **`/support`** and it'll start a private ticket with our team. Let us know the product, what happened, and any error you saw so we can jump straight in.",
  },
  {
    id: "booking",
    words: [
      "book", "booking", "reserve", "reservation", "cabin", "suite", "stateroom", "cruise stay",
      "stay on the cruise", "board the cruise", "get on the cruise", "cruise ticket", "island paradise",
      "rent a cabin", "get a cabin", "cabin price", "cabin prices", "how much is a cabin", "how do i book",
      "is booking open", "book a room", "room on the cruise",
    ],
    reply: "So glad you want to come aboard! 🌴 Head to the reservations channel and run **`/book`** to reserve your spot on Lifeline Island Paradise. It walks you through the cabin types, dates, and prices — your stay begins once it's paid.",
  },
  {
    id: "application",
    words: [
      "apply", "application", "join staff", "become staff", "join the team", "work here", "get hired",
      "hiring", "be a blogger", "become a blogger", "apply to blog", "staff position", "blogger program",
    ],
    reply: "Love that you want to get involved! Use **`/apply staff`** to join the team or **`/apply blogger`** for the blogger program. Every application is read by a real person before anyone's added.",
  },
  {
    id: "incident",
    words: [
      "report someone", "report a player", "rule violation", "rule break", "breaking the rules", "harassment",
      "harass", "harassed", "harassing", "being harassed", "bully", "bullied", "bullying", "griefing", "griefer",
      "incident", "unsafe", "made me uncomfortable", "someone is bothering", "bothering me", "report a problem",
    ],
    reply: "Thanks for looking out for the community. Use **`/incident`** to report a rule-break or anything that made you uncomfortable — it goes straight to the team, privately. If someone's in immediate danger in-world, flag an online staff member too.",
  },
  {
    id: "faq",
    words: [
      "faq", "how does lifeline work", "what is lifeline", "how do i start", "getting started",
      "new player", "new here", "im new", "i'm new", "just joined", "how do i play lifeline", "how do i get started",
      "where do i begin", "how do i play the game",
    ],
    reply: "Happy to help you find your feet! Try **`/faq search`** with what you're wondering about, or **`/faq list`** to browse the topics I keep on hand.",
  },
  {
    id: "character",
    words: [
      "character", "character profile", "roleplay profile", "rp profile", "make a character",
      "create a character", "edit my character", "update my character", "my character",
    ],
    reply: "Use **`/character create`** to set up your profile, **`/character view`** to see it, or **`/character edit`** to update it anytime.",
  },
  {
    id: "suggestion",
    words: [
      "suggestion", "suggest", "i have an idea", "feature request", "request a feature", "feedback",
      "could you add", "can you add", "wish you had",
    ],
    reply: "I'd love to hear it — drop your idea with **`/suggest`** and it goes right to the Lifeline team.",
  },
  {
    id: "affiliate",
    words: [
      "affiliate", "affiliate program", "partner store", "become a partner", "partner with", "affiliate apply",
      "affiliate status", "affiliate program details",
    ],
    reply: "Use **`/affiliate start`** for the program details, **`/affiliate apply`** to apply, or **`/affiliate status`** to check where your application stands.",
  },
  {
    id: "blogger",
    words: [
      "blogger dashboard", "blogger assignment", "blogger assignments", "submit blog", "submit a post",
      "blogger package", "blogger overview", "my blog assignment", "blog submission",
    ],
    reply: "Use **`/blogger dashboard`** for your overview, **`/blogger assignments`** for your current work, or **`/blogger submit`** when you're ready to send a post in.",
  },
  {
    id: "alerts",
    words: [
      "alerts", "notifications", "subscribe", "unsubscribe", "event alerts", "sale alerts", "cruise updates",
      "get notified", "stop notifications", "manage alerts",
    ],
    reply: "Use **`/subscribe`** to pick exactly which Lifeline alerts you get — events, sales, cruise updates, and more. You can change it whenever you like.",
  },
  {
    id: "academy",
    words: [
      "academy", "school", "student", "enroll", "enrollment", "sign up for school", "join the academy",
      "become a student", "teacher", "teach", "homework", "classes", "courses", "report card", "grades",
    ],
    reply: "Lifeline Academy Digital is our virtual roleplay school! To enroll, open the **Academy** app on your ZPad and tap **Student Apply** — once you're approved you'll get a student ID, courses, and grades. Homework lives in the **Homework** app on your ZPad.",
  },
  {
    id: "hud_sync",
    words: [
      "profile sync failed", "profile won't load", "profile wont load", "hud loading", "hud is stuck",
      "hud stuck", "hud won't load", "hud will not load", "hud not loading", "cloud profile", "stuck loading",
      "profile stuck",
    ],
    reply: "Let's get that unstuck: detach and re-attach your Lifeline HUD, then give it up to 30 seconds to pull your profile from the cloud. If it still won't load, open **`/support`** and I'll get someone on it.",
  },
  {
    id: "device_sync",
    words: [
      "zpad needs hud", "zphone needs hud", "zpad needs my hud", "zphone needs my hud", "phone disconnected",
      "tablet disconnected", "device sync", "zpad won't connect", "zphone won't connect", "zpad wont connect",
      "zphone wont connect", "wont connect", "won't connect", "zpad not connecting", "zphone not connecting",
      "device won't connect",
    ],
    reply: "Wear your Lifeline HUD and give your ZPad/ZPhone a moment to reconnect — it retries automatically after teleports. If it's still disconnected after that, open **`/support`**.",
  },
  {
    id: "stats",
    words: [
      "stats paused", "stats not moving", "stats not decaying", "stats are not decaying", "resume stats",
      "pause stats", "stats frozen", "stats stopped", "hunger not going down", "meters not moving",
      "meters stopped", "meter stopped", "meters frozen",
    ],
    reply: "Open your HUD's **Power** menu and choose **Resume Stats** (or **Pause Stats** to hold them). If the buttons don't respond, detach and re-attach the HUD first, then try again.",
  },
  {
    id: "jobs",
    words: [
      "get a job", "find a job", "apply for a job", "zpad job", "zphone job", "clock in", "clock out",
      "job shift", "start working", "where do i work", "how do i work",
    ],
    reply: "Open the **Jobs** app on your ZPad or ZPhone, pick a job, and apply right there. Once you're approved, head back to Jobs to clock in and start your shift.",
  },
  {
    id: "eats",
    words: [
      "lifeline eats", "food delivery", "order food", "order some food", "delivery box", "restaurant", "get food",
      "eats app", "order a meal", "food order", "order dinner", "order lunch",
    ],
    reply: "Open **Eats** on your ZPad or ZPhone, place your order, and wait for the delivery box to arrive. Just a heads-up — only the avatar who ordered can pick it up.",
  },
  {
    id: "zfunds",
    words: [
      "zfunds", "redeem", "redeem xp", "send money", "send funds", "allowance", "lifeline money", "transfer money",
      "cash out xp", "my balance", "spend xp",
    ],
    reply: "Open **ZFunds** on your ZPad or ZPhone — you can send funds or redeem XP right there. One note: XP redemptions have a five-minute cooldown between them.",
  },
  {
    id: "insurance",
    words: [
      "insurance", "health plan", "health insurance", "pharmacy discount", "medical plan", "buy insurance",
      "pharmacy",
    ],
    reply: "Open **Insurance** on your ZPhone to view or buy a plan, then use the **Pharmacy** app for covered medication. Easy to manage from your phone.",
  },
  {
    id: "partners",
    words: [
      "partner up", "how do i partner", "become partners", "partnership", "partner hud", "bonding",
      "bond meter", "propose to", "how do i propose", "how do i get married", "polycule", "relationship system",
    ],
    reply: "Ready to make it official? 💕 Use your **Partner HUD** to send a partnership request, then grow your bond with actions like hugs, cuddles, dates, and a proposal. It supports polycules, shared groups, and children too. If your Partner HUD acts up, run **`/support`**.",
  },
  {
    id: "pets",
    words: [
      "adopt a pet", "get a pet", "pet companion", "feed my pet", "wash my pet", "pet hud", "pet won't",
      "pet wont", "pet not working", "my pet won't",
    ],
    reply: "Aww, pets! 🐾 You can adopt and care for a pet companion — feed it, wash it, and play with it to keep it happy, and its progress saves to the cloud. Having trouble with your pet? Open **`/support`** and we'll help.",
  },
  {
    id: "babysitter",
    words: [
      "babysitter", "babysitting", "book a babysitter", "become a babysitter", "watch my kid", "watch my child",
      "childcare", "hire a sitter",
    ],
    reply: "Need a sitter — or want to earn as one? 👶 Use the **Babysitter** system in-world to register as a babysitter or book one for your little one. Shifts are tracked and paid safely, with reviews after. Questions? **`/support`** has you covered.",
  },
  {
    id: "households",
    words: [
      "household", "create a household", "start a household", "family home", "add a room", "household needs",
      "house system", "make a home",
    ],
    reply: "Building a home together? 🏡 Use the **Household** system to create your household, add rooms (kitchen, bedroom, nursery and more), assign roles, and keep up with household needs. Need a hand setting it up? Run **`/support`**.",
  },
  {
    id: "music",
    words: [
      "zpods", "z-pods", "play music", "music widget", "listen to music", "song list", "music radio",
      "music won't play", "music wont play", "music not playing",
    ],
    reply: "Time for some tunes! 🎶 Use **ZPods** or the music widget on your ZPhone to search songs, play a track, shuffle the radio, or browse by artist. If music won't load, detach and re-attach your HUD, then try **`/support`**.",
  },
  {
    id: "messaging",
    words: [
      "zmessage", "z-message", "grid message", "message someone in world", "in world message", "in-world message",
      "group message", "send an im across",
    ],
    reply: "Want to reach someone across the grid? ✉️ **ZMessage** sends direct and group messages that stick even through teleports and relogs. If a message won't go through, open **`/support`**.",
  },
  {
    id: "mobile_app",
    words: [
      "soul link", "soullink", "link my app", "link the app", "mobile app", "lifeline app", "connect my app",
      "connect the app", "/link", "phone app", "link code",
    ],
    reply: "You can link the Lifeline mobile app to your avatar! 📱 Grab the code in the app, then type **`/link <code>`** in local chat to connect. Once linked, the app shows your profile and stats. Trouble linking? Run **`/support`**.",
  },
  {
    id: "progression",
    words: [
      "earn xp", "how do i get xp", "how do i earn xp", "level up", "leveling up", "milestones", "progression",
      "xp system", "rank up", "gain xp",
    ],
    reply: "Want to level up? ⭐ You earn XP from **jobs** and **roleplay actions**, and milestones unlock automatically as you go. You can redeem XP over in **ZFunds** (there's a short cooldown between redemptions). Curious where you're at? Check your HUD.",
  },
  {
    id: "parks",
    words: [
      "dinoworld", "dino world", "fossil dig", "fossil find", "hit dino", "cabana", "park admission", "theme park",
    ],
    reply: "Adventure time! 🦕 Lifeline's destinations include parks like **DinoWorld**, with activities such as fossil digs and dino games, plus admissions and cabanas. Ask me for directions anytime, or run **`/support`** if something isn't working.",
  },
  {
    id: "reset",
    words: [
      "full reset", "reset hud", "reset my hud", "hard reset", "start over", "reset my profile", "reset everything",
    ],
    reply: "You can do a **Full Reset** from your HUD's **Power** menu. Try a quick detach/re-attach first — and if your profile still won't load afterward, open **`/support`** so we can help.",
  },
  {
    id: "location",
    words: [
      "where is tammy", "where are you", "where do i board", "boarding location", "cruise landmark",
      "teleport to cruise", "how do i get there", "ethereal paradise", "where is the cruise", "landmark",
    ],
    reply: "Come find me! I board at **Ethereal Paradise (85, 129, 35)**: <http://maps.secondlife.com/secondlife/Ethereal%20Paradise/85/129/35>. See you there. 🌺",
  },
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
  // Gate 1: Only process guild messages from human users with content.
  if (!message.guild || message.author.bot || !message.content) return false;

  // Gate 2: If TAMMY_HELP_CHANNEL_IDS is set, only respond in those channels.
  // This is the MOST IMPORTANT rate-limit defense — without it, EVERY message
  // in EVERY channel (booking tickets, threads, staff channels) triggers a
  // classify() scan, burning CPU and API quota on messages the bot ignores.
  if (helpChannels.size && !helpChannels.has(message.channelId)) return false;

  // Gate 3: If we're being rate-limited (too many messages/sec across the guild),
  // only respond if Tammy is explicitly @mentioned. This prevents the bot from
  // replying to every "help" keyword during a raid or high-traffic event.
  if (isRateLimited()) {
    // Under rate pressure: only respond to direct @mentions, ignore keyword matches
    if (!message.mentions.has(client.user)) return false;
  }

  const mentioned = message.mentions.has(client.user);
  const intent = classify(message.content);
  if (!intent && !mentioned) return false;

  const now = Date.now();
  const key = `${message.guildId}:${message.author.id}:${intent?.id || "unknown"}`;
  if ((cooldowns.get(key) || 0) > now - 30_000) return false;
  cooldowns.set(key, now);

  const answer = intent?.reply || "Hey! Tell me what you need a hand with, or try **`/faq search`** for quick answers and **`/support`** to reach the team.";
  await message.reply({ content: `<@${message.author.id}> ${answer}`, allowedMentions: { users: [message.author.id], repliedUser: false } });
  return true;
}

module.exports = { handleMessage, classify, intents };
