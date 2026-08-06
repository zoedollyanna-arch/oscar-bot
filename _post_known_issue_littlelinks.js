/* Tammy Brightwood → #Known-Issues
 * Player-facing notice: LittleLinks Hold & Rock are in beta; use Follow instead.
 * Embeds the in-world notice screenshot as an uploaded attachment.
 */
const fs = require("fs");
const path = require("path");

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

const CHANNEL_ID = "1462830229079724185"; // #Known-Issues
const IMAGE_PATH = "C:\\Users\\Shadow\\Downloads\\Screenshot 2026-08-01 112314.png";
const IMAGE_NAME = "littlelinks-beta-notice.png";

const embed = {
  color: 0xf5a9d0,
  title: "🧪💕 Known Issue — LittleLinks: Hold & Rock are in Beta",
  description:
    "Hi lovelies! 🎀 A little heads-up about carrying your littles with **LittleLinks**.\n\n" +
    "**🤱 Hold** and **🌙 Rock** are still in **beta** while we polish them. Second Life has some " +
    "stubborn limits around how avatars sit and collide with each other, so while you're **moving** " +
    "your little one's position can drift, sit a bit off, or nudge you around. 💗\n\n" +
    "**🚶 Follow is not affected** — it's fully finished and works beautifully.",
  fields: [
    {
      name: "👀 What You Might Notice",
      value:
        "• Your little sits too high, too low, or slightly inside you\n" +
        "• They drift out of place once you start walking or running\n" +
        "• Tapping **Adjust** seems to push *you* around instead of moving them\n" +
        "• The pose looks perfect standing still, then slips while you move",
      inline: false,
    },
    {
      name: "💡 The Easy Fix — Use 🚶 Follow Instead",
      value:
        "**Follow** is the smooth, reliable one and we recommend it for everyday play! 💕\n" +
        "Open your **LittleLinks** menu → pick your little → tap **🚶 Follow**.\n\n" +
        "They'll toddle along right beside you, keep their own walk and animations, and stay put " +
        "wherever you go — no adjusting, no drifting, no fuss. ✨",
      inline: false,
    },
    {
      name: "🎯 If You'd Still Like To Try Adjust",
      value:
        "You absolutely can — just nudge them in **this order**, it makes all the difference:\n" +
        "**1️⃣ `Z +`** — lift them up first\n" +
        "**2️⃣ `Y`** — centre them side to side\n" +
        "**3️⃣ `X −`** — pull them in close, *last*\n\n" +
        "⚠️ Jumping straight to **`X −`** is what shoves you around! Once they look just right, " +
        "hit **Save** and they'll remember it next time. 💾",
      inline: false,
    },
    {
      name: "🎫 Please Don't Open A Ticket For This",
      value:
        "We're already aware of it and actively working on a fix, sweethearts — so there's **no need " +
        "to open a support ticket** for Hold or Rock positioning. 💙\n" +
        "We'll post right here the moment it's sorted!",
      inline: false,
    },
    {
      name: "📖 Also In-World",
      value: "This same note lives in your **in-world LittleLinks menu**, so it's always a tap away. 🎀",
      inline: false,
    },
  ],
  image: { url: `attachment://${IMAGE_NAME}` },
  footer: { text: "Lifeline • Known Issues 💙 Thank you for bearing with us while we polish this!" },
  timestamp: new Date().toISOString(),
};

(async () => {
  if (!fs.existsSync(IMAGE_PATH)) throw new Error("Image not found: " + IMAGE_PATH);
  const buf = fs.readFileSync(IMAGE_PATH);
  console.log(`Attaching ${path.basename(IMAGE_PATH)} (${buf.length} bytes) as ${IMAGE_NAME}`);

  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({
      embeds: [embed],
      attachments: [{ id: 0, filename: IMAGE_NAME }],
      allowed_mentions: { parse: [] },
    })
  );
  form.append("files[0]", new Blob([buf], { type: "image/png" }), IMAGE_NAME);

  const r = await fetch(`${API}/channels/${CHANNEL_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${TOKEN}` },
    body: form,
  });
  const text = await r.text();
  if (!r.ok) { console.error("FAILED", r.status, text); process.exit(1); }
  console.log("✅ Posted to #Known-Issues. Message id:", JSON.parse(text).id);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
