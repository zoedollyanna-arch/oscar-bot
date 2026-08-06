// Find prior tickets opened by chyna7938 (836643018999070790) across the guild.
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
const GUILD = env.GUILD_ID;
const USER = "836643018999070790";
const API = "https://discord.com/api/v10";

async function api(path) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(API + path, { headers: { Authorization: `Bot ${TOKEN}` } });
    if (r.status === 429) { const j = await r.json(); await new Promise(res => setTimeout(res, (j.retry_after || 1) * 1000)); continue; }
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    return r.json();
  }
  throw new Error("rate limited " + path);
}

(async () => {
  const chans = await api(`/guilds/${GUILD}/channels`);
  const cats = Object.fromEntries(chans.filter(c => c.type === 4).map(c => [c.id, c.name]));
  const tickets = chans.filter(c => /^ticket-|booking|support/i.test(c.name) && c.type === 0);
  console.log(`Guild has ${chans.length} channels; ${tickets.length} ticket-ish text channels.\n`);

  for (const c of tickets) {
    let msgs;
    try { msgs = await api(`/channels/${c.id}/messages?limit=100`); } catch (e) { continue; }
    const hit = msgs.some(m => m.author.id === USER || (m.content || "").includes(USER) ||
      (m.embeds || []).some(e => JSON.stringify(e).includes("chyna7938")));
    if (hit) {
      console.log(`\n########## MATCH: #${c.name} (${c.id}) in category "${cats[c.parent_id] || c.parent_id}"`);
      msgs.reverse();
      for (const m of msgs) {
        console.log(`--- [${m.timestamp}] ${m.author.username}${m.author.bot ? " [BOT]" : ""}`);
        if (m.content) console.log(m.content);
        for (const e of m.embeds || []) console.log("  <EMBED> " + JSON.stringify({ title: e.title, description: e.description, fields: e.fields }, null, 1));
      }
    }
    await new Promise(r => setTimeout(r, 250));
  }
  console.log("\n=== scan complete ===");
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
