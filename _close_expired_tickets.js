/* Closes every open booking ticket whose stay has expired.
 * Replicates index.js ticket_close: export a full transcript to TRANSCRIPT_CHANNEL_ID,
 * then delete the channel.
 *
 * SAFETY: the channel is deleted ONLY after its transcript has been confirmed posted.
 * None of these are awaiting payment, so no Neon status changes are needed.
 * Pass --dry to preview without posting or deleting.
 */
const fs = require("fs");
const { Client } = require("pg");

const DRY = process.argv.includes("--dry");

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
const TRANSCRIPT_CHANNEL_ID = "1457443991770366137"; // #Logs — bot's TRANSCRIPT_CHANNEL_ID
const SUPPORT_CATEGORY_ID = "1428518011219873904";
const CLOSED_BY = "Tammy Brightwood (automated expired-stay cleanup)";

const DEAD = ["cancelled_non_payment", "cancelled", "closed", "denied", "expired", "checked_out"];
const GRACE = 2 * 60 * 60 * 1000, PAYWIN = 2 * 60 * 60 * 1000;
const s = (v) => (v == null ? "" : String(v));

function isActive(r) {
  if (!r) return false;
  const st = s(r.status || "submitted").toLowerCase();
  if (DEAD.includes(st)) return false;
  if (!r.approvedAt && !r.boardingPassSentAt && ["submitted", "payment_marked"].includes(st)) {
    const o = Date.parse(r.openedAt || "");
    if (Number.isFinite(o) && Date.now() > o + PAYWIN) return false;
  }
  const due = Date.parse(r.checkoutDueAt || "");
  if (Number.isFinite(due) && Date.now() > due + GRACE) return false;
  return true;
}
// Mirrors isAwaitingBookingPayment intent — a guard so we never delete an unpaid live hold.
const awaitingPayment = (r) => !r?.approvedAt && !r?.boardingPassSentAt &&
  ["submitted", "payment_marked"].includes(s(r?.status).toLowerCase());

async function api(path, init = {}, raw = false) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(API + path, { ...init, headers: { Authorization: `Bot ${TOKEN}`, ...(init.headers || {}) } });
    if (r.status === 429) {
      const j = await r.json().catch(() => ({}));
      await new Promise((res) => setTimeout(res, ((j.retry_after || 1) * 1000) + 250));
      continue;
    }
    const text = await r.text();
    if (!r.ok) throw new Error(`${r.status} ${text.slice(0, 200)}`);
    return raw ? text : (text ? JSON.parse(text) : null);
  }
  throw new Error("rate limited " + path);
}

async function fetchAllMessages(channelId, cap = 300) {
  let all = [], before = null;
  while (all.length < cap) {
    const batch = await api(`/channels/${channelId}/messages?limit=100${before ? `&before=${before}` : ""}`);
    if (!batch.length) break;
    all = all.concat(batch);
    if (batch.length < 100) break;
    before = batch[batch.length - 1].id;
  }
  return all.reverse().slice(0, cap);
}

function buildTranscript(b, msgs) {
  let t = `🧾 LIFELINE SUPPORT TRANSCRIPT\n`;
  t += `Ticket ID: ${s(b.ticketId)}\n`;
  t += `Opened by: ${s(b.openerTag)} (${s(b.openerId)})\n`;
  t += `Category: ${s(b.category || "booking")}\n`;
  t += `Opened at: ${s(b.openedAt)}\n`;
  t += `Closed by: ${CLOSED_BY}\n`;
  t += `Closed at: ${new Date().toISOString()}\n`;
  t += `Cabin: ${s(b.cabinType)}${b.cabinId ? ` (${b.cabinId})` : ""}\n`;
  t += `Stay: ${s(b.stayStartsAt)} → ${s(b.checkoutDueAt)}  (${s(b.stayDays)} days)\n`;
  t += `Final status: ${s(b.status)}\n`;
  t += `--------------------------------------\n\n--- TAGS ---\n`;
  for (const [k, v] of Object.entries(b.tags || {})) t += `${k}: ${v}\n`;
  t += `\n--- INTAKE ---\n`;
  for (const [k, v] of Object.entries(b.answers || {})) t += `${k}: ${v}\n`;
  t += `\n--- CONVERSATION (${msgs.length} messages) ---\n`;
  if (!msgs.length) t += "[no messages]\n";
  for (const m of msgs) {
    const when = new Date(m.timestamp).toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
    let line = `[${when}] ${m.author.username}${m.author.bot ? " (bot)" : ""}: ${s(m.content)}`;
    if (m.embeds?.length) {
      line += ` [${m.embeds.length} embed(s)]`;
      for (const e of m.embeds) if (e.title) line += `\n      └ embed: ${e.title}`;
    }
    if (m.attachments?.length) line += ` [${m.attachments.length} attachment(s): ${m.attachments.map((a) => a.filename).join(", ")}]`;
    t += line + "\n";
  }
  if (Array.isArray(b.staffNotes) && b.staffNotes.length) {
    t += `\n--- STAFF NOTES ---\n`;
    for (const n of b.staffNotes) t += `• ${n}\n`;
  }
  return t + "\n";
}

(async () => {
  const c = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const rows = (await c.query("SELECT data FROM bookings")).rows.map((r) => r.data).filter(Boolean);
  await c.end();
  const byChannel = new Map();
  for (const b of rows) if (b.channelId) byChannel.set(String(b.channelId), b);

  const chans = await api(`/guilds/${env.GUILD_ID}/channels`);
  const open = chans.filter((ch) => ch.type === 0 && ch.parent_id === SUPPORT_CATEGORY_ID && /^(booking|ticket)-\d+$/i.test(ch.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const targets = [];
  for (const ch of open) {
    const b = byChannel.get(ch.id);
    if (!b) { console.log(`  ⏭️  #${ch.name} — no booking record, SKIPPING`); continue; }
    if (isActive(b)) continue;
    if (awaitingPayment(b)) { console.log(`  ⏭️  #${ch.name} — awaiting payment, SKIPPING`); continue; }
    targets.push({ ch, b });
  }

  console.log(`\n${DRY ? "[DRY RUN] " : ""}Closing ${targets.length} expired ticket(s):\n`);
  let done = 0, failed = 0;
  for (const { ch, b } of targets) {
    try {
      const msgs = await fetchAllMessages(ch.id);
      const transcript = buildTranscript(b, msgs);
      const fileName = `ticket-${s(b.ticketId)}.txt`;

      if (DRY) {
        console.log(`  [dry] #${ch.name.padEnd(14)} ${msgs.length} msgs → ${fileName} (${transcript.length} bytes)`);
        continue;
      }

      // 1) transcript FIRST — channel is only deleted if this succeeds
      const form = new FormData();
      form.append("payload_json", JSON.stringify({
        content: `🧾 Transcript for Ticket #${s(b.ticketId)} — **${s(b.openerTag)}** · ${s(b.cabinType)} · closed (stay expired ${s(b.checkoutDueAt).slice(0, 10)})`,
        attachments: [{ id: 0, filename: fileName }],
        allowed_mentions: { parse: [] },
      }));
      form.append("files[0]", new Blob([Buffer.from(transcript, "utf8")], { type: "text/plain" }), fileName);
      const posted = await fetch(`${API}/channels/${TRANSCRIPT_CHANNEL_ID}/messages`, {
        method: "POST", headers: { Authorization: `Bot ${TOKEN}` }, body: form,
      });
      if (!posted.ok) throw new Error(`transcript post failed: ${posted.status} ${(await posted.text()).slice(0, 160)}`);

      // 2) only now delete
      await api(`/channels/${ch.id}`, { method: "DELETE" });
      done++;
      console.log(`  ✅ #${ch.name.padEnd(14)} ${String(msgs.length).padStart(3)} msgs → transcript posted → channel deleted`);
    } catch (e) {
      failed++;
      console.log(`  ❌ #${ch.name.padEnd(14)} ${e.message} — CHANNEL LEFT INTACT`);
    }
    await new Promise((r) => setTimeout(r, 900));
  }
  console.log(`\n📊 Closed ${done}/${targets.length} • failed ${failed}`);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
