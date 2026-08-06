// Reads ticket channel history via Discord REST API (no npm deps).
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
const CHANNEL_ID = process.argv[2] || "1533130706417487973";
const API = "https://discord.com/api/v10";

async function api(path) {
  const r = await fetch(API + path, { headers: { Authorization: `Bot ${TOKEN}` } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} on ${path}: ${await r.text()}`);
  return r.json();
}

(async () => {
  const me = await api("/users/@me");
  console.log(`Logged in as ${me.username}#${me.discriminator} (${me.id})\n`);

  const ch = await api(`/channels/${CHANNEL_ID}`);
  console.log("CHANNEL:", ch.name, "| id:", ch.id, "| parent:", ch.parent_id, "| guild:", ch.guild_id);
  console.log("TOPIC:", ch.topic);
  console.log("");

  if (ch.parent_id) {
    try {
      const parent = await api(`/channels/${ch.parent_id}`);
      console.log("PARENT CATEGORY:", parent.name, parent.id, "\n");
    } catch {}
  }

  // page backwards through history
  let all = [];
  let before = null;
  while (true) {
    const q = `/channels/${CHANNEL_ID}/messages?limit=100${before ? `&before=${before}` : ""}`;
    const batch = await api(q);
    all = all.concat(batch);
    if (batch.length < 100) break;
    before = batch[batch.length - 1].id;
  }
  all.reverse();

  console.log(`===== ${all.length} MESSAGES =====\n`);
  for (const m of all) {
    console.log(`--- [${m.timestamp}] ${m.author.username} (${m.author.id})${m.author.bot ? " [BOT]" : ""} msgId=${m.id}`);
    if (m.content) console.log(m.content);
    for (const e of m.embeds || []) {
      console.log("  <EMBED> " + JSON.stringify({ title: e.title, description: e.description, fields: e.fields, footer: e.footer && e.footer.text }, null, 2));
    }
    for (const a of m.attachments || []) console.log("  <ATTACHMENT>", a.filename, a.url);
    for (const r of m.components || []) {
      console.log("  <COMPONENTS>", JSON.stringify((r.components || []).map(c => ({ label: c.label, custom_id: c.custom_id }))));
    }
    console.log("");
  }
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
