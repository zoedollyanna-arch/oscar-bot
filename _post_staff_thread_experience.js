/* Tammy Brightwood → LittleLinks Beta staff thread
 * Adds the "Lifeline Experience must be accepted" section.
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

const THREAD_ID = "1533181272976003273"; // 🧪 LittleLinks Beta — Staff Reference

const GOLD = 0xffd166;
const RED = 0xe74c3c;
const PINK = 0xf5a9d0;

const embeds = [
  {
    color: GOLD,
    title: "🌟❗ Before Anything Else — The Lifeline Experience Must Be Accepted",
    description:
      "This is the **single most common reason LittleLinks “doesn't work”**, and it's worth checking " +
      "**before** you troubleshoot anything else. 💛\n\n" +
      "LittleLinks runs on the **Lifeline RP System experience**. If a player hasn't accepted it, " +
      "the system can't position or seat their little properly — and it looks *exactly* like the " +
      "beta issue, so it's easy to mistake one for the other.",
    fields: [
      {
        name: "👥 Who Has To Accept It — BOTH Of Them",
        value:
          "🧑 **The parent** — so their little can be placed correctly in their arms\n" +
          "👶 **The child** — so they can be picked up and handed things\n\n" +
          "**If either one hasn't accepted it, it won't work properly.** Always ask about both, not just " +
          "the person who came to you. 💙",
        inline: false,
      },
      {
        name: "🚫 What Happens Without It",
        value:
          "**If the parent hasn't accepted:**\n" +
          "• The little sits in an **approximate position** instead of an exact one — floating, sunk in, " +
          "or badly off, needing loads of adjusting\n" +
          "• They'll see a message about *“using an approximate carry position”*\n\n" +
          "**If the child hasn't accepted:**\n" +
          "• They **can't be picked up automatically** — they'd have to click to sit manually\n" +
          "• **Snacks and soothers can't be handed to them at all** 🍼\n" +
          "• Follow and Auto-TP won't carry them along properly",
        inline: false,
      },
      {
        name: "✅ How Players Accept It",
        value:
          "When they arrive on the region, a little pop-up asks to allow the **Lifeline RP System** " +
          "experience — they just tap **Allow** / **Yes**. That's the whole consent step, and it only " +
          "needs doing once. ✨\n\n" +
          "⚠️ The catch: if they ever tapped **Block**, **Deny**, or **Never**, it goes on their " +
          "**blocked list** and they'll **never be asked again** — so they think they never got a prompt.",
        inline: false,
      },
      {
        name: "🔧 If They Blocked It By Accident",
        value:
          "Walk them through unblocking it:\n" +
          "**1️⃣** Open the **Experiences** window in their viewer\n" +
          "  ・ *Firestorm:* **Avatar → Experiences…**\n" +
          "  ・ *Official SL viewer:* **Me → Experiences…**\n" +
          "**2️⃣** Go to the **Blocked** tab\n" +
          "**3️⃣** Select **Lifeline RP System** and remove it from the list *(the button is usually " +
          "**Forget**)*\n" +
          "**4️⃣** Re-log or step off and back onto the region, then tap **Allow** when the pop-up returns\n" +
          "**5️⃣** Detach and re-wear the HUD, then try again 💫\n\n" +
          "It's also worth having them peek at the **Allowed** tab afterwards to confirm " +
          "**Lifeline RP System** is sitting there. ✅",
        inline: false,
      },
      {
        name: "📍 While You're Checking — Same Region",
        value:
          "Parent and child must be **in the same region and near each other**. If the little has wandered " +
          "off or is on another sim, the parent will be told they're *“not in this region”* and nothing " +
          "will happen. Very common, very easy fix! 🏝️",
        inline: false,
      },
    ],
    footer: { text: "Lifeline • Staff Reference 💙" },
  },
  {
    color: RED,
    title: "🩺 Staff Triage — Ask These First",
    description: "Thirty seconds of these questions saves a long troubleshooting spiral. 💕",
    fields: [
      {
        name: "1️⃣ “Have you both accepted the Lifeline experience?”",
        value:
          "If either says no or isn't sure → send them to the **Experiences** steps above. " +
          "**Fix this before anything else.**",
        inline: false,
      },
      {
        name: "2️⃣ “Are you both in the same region, standing near each other?”",
        value: "If no → have them meet up and try again.",
        inline: false,
      },
      {
        name: "3️⃣ “Has your little worn their Lifeline HUD at least once?”",
        value: "If no → they can't be linked yet. Have them wear it, then link again.",
        inline: false,
      },
      {
        name: "4️⃣ Only then — is it the Hold/Rock beta issue?",
        value:
          "If all three above are fine and the little **still** sits off while moving, *that's* the known " +
          "beta issue → point them to **🚶 Follow**, share the `Z + → Y → X −` Adjust order, apologise, " +
          "and remind them **no ticket is needed**. 💙",
        inline: false,
      },
    ],
  },
  {
    color: PINK,
    title: "📋 Copy & Paste — Experience Check For Players",
    description:
      "```\nHi lovely! 💕 Before we dig in — can I check that you and your little " +
      "have BOTH accepted the Lifeline RP System experience? LittleLinks needs " +
      "it from both of you, and if either one hasn't accepted it, little ones " +
      "won't sit right and snacks can't be handed over. 🎀\n\n" +
      "When you arrive on the region you'll get a small pop-up asking to allow " +
      "the Lifeline RP System experience — just tap Allow. It only needs doing " +
      "once! ✨\n\n" +
      "If you don't see that pop-up, it may have been blocked by accident. To " +
      "check: open Experiences in your viewer (Firestorm: Avatar > Experiences, " +
      "or Me > Experiences), go to the Blocked tab, and if Lifeline RP System is " +
      "listed there, remove it. Then re-log, tap Allow when the pop-up comes " +
      "back, and re-wear your HUD. 💫\n\n" +
      "Also please make sure you and your little are in the same region and " +
      "standing near each other. Let me know how you get on! 💙\n```",
    footer: { text: "Lifeline • Staff Reference • Thank you for looking after our families 💖" },
    timestamp: new Date().toISOString(),
  },
];

(async () => {
  const r = await fetch(`${API}/channels/${THREAD_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ embeds, allowed_mentions: { parse: [] } }),
  });
  const text = await r.text();
  if (!r.ok) { console.error("FAILED", r.status, text); process.exit(1); }
  console.log(`✅ Experience section added (~${JSON.stringify(embeds).length} chars) — message ${JSON.parse(text).id}`);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
