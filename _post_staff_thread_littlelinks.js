/* Tammy Brightwood → #Staff-Documents-and-References
 * Creates the "LittleLinks Beta" staff reference thread and posts the guide.
 * Staff-facing: what players see, what to say, canned responses. No dev/backend detail.
 */
const fs = require("fs");

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

const CHANNEL_ID = "1517401994703278100";       // #Staff-Documents-and-References
const KNOWN_ISSUES_CHANNEL_ID = "1462830229079724185";
const THREAD_NAME = "🧪 LittleLinks Beta — Staff Reference & Player Talking Points";

const PINK = 0xf5a9d0;
const BLUE = 0x4fc3f7;
const AMBER = 0xf5b041;
const GREEN = 0x2ecc71;
const RED = 0xe74c3c;

/* ── Message 1: what it is + the menu players see ── */
const m1 = [
  {
    color: PINK,
    title: "🧪💕 LittleLinks Beta — Staff Reference",
    description:
      "Hi team! 🎀 This thread is your **one-stop reference** for LittleLinks questions so we're all " +
      "saying the same thing to our families.\n\n" +
      "**The short version:** 🤱 **Hold** and 🌙 **Rock** are in **beta** and can sit a little off while " +
      "a parent is moving. 🚶 **Follow** is finished and works perfectly — that's what we steer people to. " +
      "Players **do not** need to open a support ticket for this; we're aware and working hard on it. 💙",
    fields: [
      {
        name: "👶 What LittleLinks Is",
        value:
          "It's the **carry system for parents and their littles**, found in the Lifeline HUD. " +
          "A parent links their child to their roster, then picks them from the menu to hold them, " +
          "rock them, have them follow along, or give them a snack or soother. 🍼",
        inline: false,
      },
      {
        name: "🔗 How A Parent Links A Child",
        value:
          "Open the HUD → **LittleLinks** → **Link Child** → pick the child from the nearby list.\n" +
          "**Both conditions must be true:** the child is **standing near them**, and the child has " +
          "**worn the Lifeline HUD at least once**. If nobody shows in the list, that's almost always " +
          "one of those two — have them stand closer and make sure the little has worn their HUD. 💫",
        inline: false,
      },
      {
        name: "📋 The Menu Players See",
        value:
          "🤱 **Hold** — scoop them into their arms *(beta)*\n" +
          "🌙 **Rock** — cuddle and rock them gently *(beta)*\n" +
          "🚶 **Follow** — they toddle along beside the parent ✅ **finished & reliable**\n" +
          "🎯 **Adjust** — fine-tune how the little sits in their arms\n" +
          "🤍 **Put Down** — back on their own feet\n" +
          "💬 **Auto-RP** — the little's idle chatter on/off\n" +
          "🧭 **Auto-TP** — the little follows the parent through teleports\n" +
          "🔓 **Unlink** — removes them from the roster only *(they stay in the family!)*",
        inline: false,
      },
      {
        name: "🍼 Snacks & Soothers (page 2 of the menu)",
        value:
          "**More ▶** on the child menu opens: 🍼 Sippy Cup · 🧃 Capri Sun · 🍭 Popsicle · " +
          "😌 Pacifier · 🦷 Teether.\n" +
          "*These are unaffected by the beta issue and work normally.*",
        inline: false,
      },
    ],
    footer: { text: "Lifeline • Staff Reference 💙" },
  },
];

/* ── Message 2: the issue + what to say ── */
const m2 = [
  {
    color: AMBER,
    title: "⚠️ The Known Issue — What Players Are Experiencing",
    description:
      "Second Life has some stubborn limits around how two avatars sit and collide with one another. " +
      "Because **Hold** and **Rock** seat the little in the parent's arms, that's where it shows up — " +
      "especially **while the parent is moving**. 💗",
    fields: [
      {
        name: "👀 What They'll Report To You",
        value:
          "• “My baby is floating / sunk into me / sitting too high or low”\n" +
          "• “She looks fine standing still but slides out of place when I walk”\n" +
          "• “Every time I hit Adjust it shoves **me** around instead of moving her”\n" +
          "• “It only works after I mash the buttons a few times”\n" +
          "• “Hold isn't working” *(usually means positioning, not a failure — ask them to describe it)*",
        inline: false,
      },
      {
        name: "✅ What Is NOT Affected",
        value:
          "🚶 **Follow** — completely unaffected, this is the finished feature\n" +
          "🍼 Snacks & soothers · 💬 Auto-RP · 🧭 Auto-TP · 🔗 Linking & unlinking · 🤍 Put Down\n" +
          "*If a player reports trouble with any of these, that's something else — please do flag it.*",
        inline: false,
      },
    ],
  },
  {
    color: GREEN,
    title: "💬 What To Tell Players — Recommended Answer",
    description:
      "**Lead with Follow.** It's the smooth, reliable option and solves the problem for most families " +
      "instantly. Be warm, be apologetic, and reassure them it's being worked on. 💕",
    fields: [
      {
        name: "1️⃣ Point Them To Follow",
        value:
          "Open the HUD → **LittleLinks** → pick the little → tap **🚶 Follow**.\n" +
          "The little toddles along beside them, keeps their **own walk and animations**, and stays with " +
          "them wherever they go — no adjusting and no drifting. ✨",
        inline: false,
      },
      {
        name: "2️⃣ Reassure Them",
        value:
          "Let them know we're **aware of it and working hard on a fix**, and apologise for the hassle. " +
          "This is beta polish, not something broken with their HUD or their fault. 💙",
        inline: false,
      },
      {
        name: "3️⃣ No Ticket Needed",
        value:
          "Please let them know they **don't need to open a support ticket** for Hold/Rock positioning — " +
          "we already have it logged. If one is already open, answer it kindly with the guidance here and " +
          "close it out; never make them feel they did something wrong by asking. 🎀",
        inline: false,
      },
      {
        name: "4️⃣ Point At The Notice",
        value:
          `The player-facing notice is posted in <#${KNOWN_ISSUES_CHANNEL_ID}> — feel free to link it. ` +
          "The same note also lives inside the **in-world LittleLinks menu**. 📖",
        inline: false,
      },
    ],
  },
];

/* ── Message 3: adjust order + canned reply + FAQ ── */
const m3 = [
  {
    color: BLUE,
    title: "🎯 If A Player Really Wants To Use Hold or Rock",
    description:
      "They absolutely can — it just needs the nudges in the **right order**. This is the single most " +
      "useful thing you can tell them, so it's worth knowing by heart! 💡",
    fields: [
      {
        name: "📐 The Order That Works",
        value:
          "**1️⃣ `Z +`** — lift the little **up** first\n" +
          "**2️⃣ `Y +` / `Y −`** — centre them side to side\n" +
          "**3️⃣ `X −`** — pull them in close, **last**\n" +
          "**🔄 Turn ↺ / ↻** — rotate them if they're facing off\n\n" +
          "⚠️ **Going straight to `X −` is what shoves the parent around.** That single tip resolves the " +
          "large majority of these questions.",
        inline: false,
      },
      {
        name: "💾 Tell Them To Save",
        value:
          "Once the little looks right, tap **Save** — the position is remembered for that child next " +
          "time, so they only have to do it once. 🎀",
        inline: false,
      },
      {
        name: "🤍 If It Still Won't Sit Right",
        value: "Back to **🚶 Follow**. Don't let a family fight with it — Follow is the happy path. 💗",
        inline: false,
      },
    ],
  },
  {
    color: PINK,
    title: "📋 Copy & Paste — Canned Reply For Players",
    description:
      "```\nHi lovely! 💕 So sorry about that — Hold and Rock are still in beta " +
      "while we polish them, and Second Life's limits on how avatars sit together " +
      "mean your little one's position can drift while you're moving. It's not " +
      "anything you did wrong! 🎀\n\n" +
      "The quickest fix: use 🚶 Follow instead — HUD > LittleLinks > pick your " +
      "little > Follow. They'll walk right along beside you and stay put " +
      "wherever you go, no adjusting needed. It works beautifully! ✨\n\n" +
      "If you'd like to keep using Hold, tap Adjust and nudge them in this " +
      "order: Z + to lift them FIRST, then Y to centre, and X - to pull them in " +
      "LAST. Going straight to X - is what pushes you around. Then hit Save and " +
      "it'll remember next time. 💾\n\n" +
      "No need to open a ticket for this one — we're already aware and working " +
      "hard on a fix. Thank you so much for your patience! 💙\n```",
  },
  {
    color: RED,
    title: "❓ Quick FAQ",
    fields: [
      {
        name: "“Is my HUD broken? Should I get a redelivery?”",
        value: "No — this affects everyone using Hold/Rock, and a redelivery won't change it. Steer to Follow. 💙",
        inline: false,
      },
      {
        name: "“Did I lose my baby / is she gone?”",
        value:
          "No. **Put Down** puts them back on their feet, and **Unlink** only removes them from the carry " +
          "roster — **they stay in the family**. Reassure them nothing is lost. 🤍",
        inline: false,
      },
      {
        name: "“Why does Follow look different from Hold?”",
        value:
          "Because the little is walking on their own beside the parent rather than being carried — that's " +
          "exactly why it's smooth and never drifts. 🚶",
        inline: false,
      },
      {
        name: "“When will Hold and Rock be fixed?”",
        value:
          "Please **don't promise a date**. Say we're working hard on it and updates will be posted in " +
          `<#${KNOWN_ISSUES_CHANNEL_ID}> as soon as there's news. 💕`,
        inline: false,
      },
      {
        name: "🚩 When To Escalate",
        value:
          "Escalate to leadership if: a player reports trouble with **Follow itself**, a little **can't be " +
          "linked at all** while standing right there with their HUD worn, or anything outside Hold/Rock " +
          "positioning. Those are *not* this known issue. 💙",
        inline: false,
      },
    ],
    footer: { text: "Lifeline • Staff Reference • Thank you for looking after our families 💖" },
    timestamp: new Date().toISOString(),
  },
];

async function post(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${text}`);
  return JSON.parse(text);
}

(async () => {
  const thread = await post(`${API}/channels/${CHANNEL_ID}/threads`, {
    name: THREAD_NAME,
    type: 11,                      // public thread inside the staff-only channel
    auto_archive_duration: 10080,  // 7 days
  });
  console.log(`✅ Thread created: ${thread.name} (${thread.id})`);

  const batches = [m1, m2, m3];
  for (let i = 0; i < batches.length; i++) {
    const size = JSON.stringify(batches[i]).length;
    const msg = await post(`${API}/channels/${thread.id}/messages`, {
      embeds: batches[i],
      allowed_mentions: { parse: [] },
    });
    console.log(`✅ Posted section ${i + 1}/${batches.length} (~${size} chars) — message ${msg.id}`);
    await new Promise((r) => setTimeout(r, 900));
  }
  console.log(`\n🔗 https://discord.com/channels/${env.GUILD_ID}/${thread.id}`);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
