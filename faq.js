/* =================================================================================================
 *  Tammy Brightwood — FAQ engine
 *  ------------------------------------------------------------------------------------------------
 *  Rule-based FAQ matching over the shared Neon knowledge base. Powers both the message
 *  auto-responder and the /faq command. Matching is keyword-based (word-boundary, case-insensitive)
 *  and scored so the best-matching entry wins. No AI is involved in issuing actions — this only
 *  ever returns text answers.
 * ================================================================================================= */

const store = require("./store");
const { embed, COLORS, replyEphemeral } = require("./ui");

function normalize(s) { return String(s || "").toLowerCase(); }

// Score how well `text` matches an FAQ entry. Longer keyword hits score higher.
function scoreEntry(text, entry) {
  const hay = normalize(text);
  let score = 0;
  for (const kw of entry.keywords || []) {
    const k = normalize(kw);
    if (!k) continue;
    // Leading word boundary only: "redeliver" matches "redelivery"/"redelivering" (stems), while a
    // leading boundary still stops "art" from matching "start". Multi-word phrases score higher.
    const re = new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    if (re.test(hay)) score += Math.max(1, k.split(/\s+/).length * 2);
  }
  return score;
}

// Return the single best FAQ answer for a piece of text, or null if nothing meaningful matches.
function bestMatch(text) {
  if (!text || text.trim().length < 3) return null;
  let best = null, bestScore = 0;
  for (const entry of store.faqs.values()) {
    const s = scoreEntry(text, entry);
    if (s > bestScore) { best = entry; bestScore = s; }
  }
  return bestScore >= 2 ? best : null;
}

function answerEmbed(entry) {
  return embed(`❓ ${entry.topic}`, entry.answer, COLORS.info);
}

// /faq ask question:<text>
async function handleAsk(interaction) {
  const q = interaction.options.getString("question", true);
  const match = bestMatch(q);
  store.logInteraction("faq_ask", { userId: interaction.user.id, q, matched: match?.id || null });
  if (!match) {
    return replyEphemeral(interaction, {
      embeds: [embed("I'm not sure about that one", "I couldn't find a matching answer. Try `/support` and staff will help you directly.", COLORS.warn)],
    });
  }
  return replyEphemeral(interaction, { embeds: [answerEmbed(match)] });
}

// /faq list
async function handleList(interaction) {
  const entries = [...store.faqs.values()];
  if (!entries.length) return replyEphemeral(interaction, { content: "No FAQ entries yet." });
  const lines = entries.map((e) => `• **${e.topic}** — \`${e.id}\``).join("\n");
  return replyEphemeral(interaction, { embeds: [embed("FAQ topics", lines, COLORS.info)] });
}

// /faq add topic:<t> answer:<a> keywords:<comma list>   (staff only — checked in index.js)
async function handleAdd(interaction) {
  const topic = interaction.options.getString("topic", true);
  const answer = interaction.options.getString("answer", true);
  const keywords = String(interaction.options.getString("keywords") || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const rec = store.newFaq({ topic, answer, keywords, createdBy: interaction.user.id });
  store.logInteraction("faq_add", { id: rec.id, staffId: interaction.user.id });
  return replyEphemeral(interaction, { embeds: [embed("FAQ added", `\`${rec.id}\` — **${topic}** (${keywords.length} keywords).`, COLORS.ok)] });
}

// /faq remove id:<FAQxxxxx>   (staff only)
async function handleRemove(interaction) {
  const id = interaction.options.getString("id", true);
  if (!store.faqs.has(id)) return replyEphemeral(interaction, { content: `No FAQ with id \`${id}\`.` });
  store.deleteFaq(id);
  store.logInteraction("faq_remove", { id, staffId: interaction.user.id });
  return replyEphemeral(interaction, { embeds: [embed("FAQ removed", `Deleted \`${id}\`.`, COLORS.danger)] });
}

// Message auto-responder (called from messageCreate). Returns true if Tammy answered.
async function tryAutoRespond(message) {
  const match = bestMatch(message.content);
  if (!match) return false;
  store.logInteraction("faq_auto", { userId: message.author.id, matched: match.id, channelId: message.channelId });
  await message.reply({ embeds: [answerEmbed(match)] }).catch(() => {});
  return true;
}

module.exports = { bestMatch, answerEmbed, handleAsk, handleList, handleAdd, handleRemove, tryAutoRespond };
