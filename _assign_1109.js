/* =================================================================================================
 *  assign_guest_cabin.js — Assign ONE newly-approved booking a cabin and send it the exact
 *  "🛳️ Your Cabin Is Ready!" embed the other guests received.
 *
 *  Mirrors cruiseHub.js assignCabinCore + cabinReadyEmbed/postCabinReady so the result is identical
 *  to what the live bot would have produced — but runs standalone against Neon + the Discord REST API
 *  (no gateway login, so it can't trip the login rate-limit spiral).
 *
 *  WHAT IT DOES
 *    1. Finds the target booking by channelId (primary) or booker/roster UUID (fallback).
 *    2. Prints a DEEP ANALYSIS of that cabin type's occupancy, incl. cabins freed by
 *       cancelled/refunded bookings (the likely opening).
 *    3. Picks the cabin: default = first free cabin of the paid type (exactly what the bot does),
 *       overridable with --cabin=S03.
 *    4. With --apply: writes cabinId/cabinAssignedAt/cabinLandmarkNotifiedAt to the booking, upserts
 *       cruise_cabin_assignments, then POSTs the cabin-ready embed into the ticket channel.
 *
 *  DRY RUN by default (analyses + prints the plan, writes/sends NOTHING). Add --apply to commit.
 *
 *  Run (PowerShell):
 *    $env:DATABASE_URL = "<Neon URL from Render → Environment>"; node assign_guest_cabin.js
 *    $env:DATABASE_URL = "<Neon URL>"; node assign_guest_cabin.js --apply
 *    (optional) ... node assign_guest_cabin.js --cabin=S03 --apply
 *  DISCORD_TOKEN is read from .env.
 * ================================================================================================= */
// dotenv isn't installed here and the lifeline repo has no plain .env — load "env (1)" directly
// so DATABASE_URL and the *Lifeline Assistant* DISCORD_TOKEN are both correct.
const fsEnv = require("fs");
(function loadEnv() {
  const file = "C:\\Users\\Shadow\\Desktop\\lifeline-discord-bot-main\\env (1)";
  for (const line of fsEnv.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
})();
const { Pool } = require("pg");
const { cabinLandmarkFor } = require("./cabinLandmarks");

// ── Target (from the request) ──
const CHANNEL_ID = "1531780129121108098"; // booking-1109 — kamorasl
const GUEST_UUID = ""; // channel ID is authoritative for this approved ticket

// Cabins with a room-layout-change request on file — never auto-assign these.
// (Verified live: F03, F01, F07, C01. Guard stays in place regardless of cabin type.)
const LAYOUT_CHANGE_CABINS = new Set(["F01", "F03", "F07", "C01"]);

const APPLY = process.argv.includes("--apply");
const CABIN_OVERRIDE = (process.argv.find((a) => a.startsWith("--cabin=")) || "").split("=")[1]?.toUpperCase() || "";

// ── Constants copied verbatim from cruiseHub.js / index.js ──
const CABIN_TYPES = {
  standard: { prefix: "S", label: "Standard Cabin", perDay: 100 },
  couple:   { prefix: "C", label: "Couple Cabin",   perDay: 125 },
  family:   { prefix: "F", label: "Family Cabin",   perDay: 150 },
};
const ALL_CABINS = [];
for (const [type, cfg] of Object.entries(CABIN_TYPES)) {
  for (let i = 1; i <= 8; i++) ALL_CABINS.push({ id: `${cfg.prefix}${String(i).padStart(2, "0")}`, type, label: cfg.label });
}
const CABIN_BY_ID = Object.fromEntries(ALL_CABINS.map((c) => [c.id, c]));
const DEAD_STATUSES = ["cancelled_non_payment", "cancelled", "closed", "denied", "expired", "checked_out"];
const CABIN_MAX_GUESTS = 6;
const UUID_ANY = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const s = (v) => (v == null ? "" : String(v));
const nowISO = () => new Date().toISOString();
const isActive = (r) => !!r?.approvedAt && !DEAD_STATUSES.includes(s(r.status).toLowerCase());
const bookerUuidOf = (r) => { const m = s(r?.answers?.support_q1).match(UUID_ANY); return m ? m[0].toLowerCase() : ""; };
function rosterUuidsOf(r) {
  const out = new Set();
  for (const m of s(r?.answers?.support_q3).match(UUID_ANY) || []) out.add(m.toLowerCase());
  for (const g of r?.hudGuests || []) if (g?.uuid) out.add(String(g.uuid).toLowerCase());
  return out;
}
// cruiseHub.bookingCabinType + index.cabinKeyFromValue (name→key), tags.cabin fallback.
function bookingCabinType(r) {
  const raw = s(r.cabinKey || r.cabinType || r.tags?.cabin || "").trim();
  const key = raw.toLowerCase().replace(/\s+cabin$/, "").replace(/\s+/g, "");
  return CABIN_TYPES[key] ? key : "standard";
}

// Exact copy of cruiseHub.cabinReadyEmbed.
function cabinReadyEmbed(record) {
  const type = bookingCabinType(record);
  const typeLabel = CABIN_TYPES[type]?.label || record.cabinType || "Cabin";
  const name = record.openerTag || "Traveler";
  const landmarkUrl = cabinLandmarkFor(record.cabinId);
  if (!landmarkUrl) throw new Error(`No landmark stored for assigned cabin ${record.cabinId || "(missing)"}`);
  return {
    color: 0x4fc3f7,
    title: "🛳️✨ Your Cabin Is Ready! ✨🛳️",
    description:
      `Welcome aboard, **${name}**! 💙 Your cabin has been assigned and your Lifeline Island Paradise ` +
      `stay is all set. We can't wait to have you sailing with us — here's everything you need to settle in. 🌴🌊`,
    fields: [
      { name: "🗝️ Your Cabin", value: `**${record.cabinId}** — ${typeLabel}`, inline: false },
      { name: "💳💖 Your Cabin Key Card", value: `🔑 **Cabin ${record.cabinId}**\n[✨ Unlock your door & teleport straight to your cabin ✨](${landmarkUrl})\n\`${landmarkUrl}\``, inline: false },
      { name: "🗓️ Next Voyage — August 4", value: "🌊 **Bora Bora!** Turquoise lagoons and island magic await. 🏝️\nUpcoming stops: **8/7** Disney Springs · **8/11** Dino World vs Mermaid World (all week) · **8/18** St. Lucia · **8/21** Thailand · **8/25** Legoland (all week) ✨", inline: false },
      { name: "🧭 Reaching Each Destination", value: "Head to **Deck 2** and hop on the **Teleporter** to travel to each cruise destination. 🚀", inline: false },
      { name: "🚧 Deck 1", value: "Currently **inactive & under construction** — exciting things are coming, so stay tuned! ✨", inline: false },
      { name: "👥 Your Guests", value: `Add, change, or remove guests anytime right from your in-cabin **Cabin Terminal** (up to ${CABIN_MAX_GUESTS} total). 💕`, inline: false },
      { name: "🎀 Your Cruise HUD", value: "Your **Cruise HUD** unlocks room service, activities, and more onboard perks. If you haven't received yours upon arrival, please ask **Tammy at the Front Desk**. 💌", inline: false },
      { name: "🛎️ Need a Hand?", value: "Can't find your cabin? Just let **Tammy at the Front Desk** know and she'll happily help you get settled. 💙", inline: false },
    ],
    footer: { text: "Lifeline Island Paradise • Modern Family Resort at Sea 💙🌊" },
    timestamp: nowISO(),
  };
}

async function postCabinReady(record) {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error("DISCORD_TOKEN not set (.env)");
  const mention = record.openerId ? `<@${record.openerId}> ` : "";
  const body = {
    content: mention.trim() || undefined,
    embeds: [cabinReadyEmbed(record)],
    allowed_mentions: record.openerId ? { users: [record.openerId] } : { users: [] },
  };
  const resp = await fetch(`https://discord.com/api/v10/channels/${record.channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Discord POST failed ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

const fmtBooking = (id, r) => `${(r.cabinId || "—").padEnd(4)} ${s(r.status).padEnd(22)} ${s(r.openerTag || "?").slice(0, 22).padEnd(22)} ${id}`;

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('❌ DATABASE_URL not set.  $env:DATABASE_URL = "<Neon URL>"; node assign_guest_cabin.js'); process.exit(1); }
  const clean = url.replace(/([?&])sslmode=[^&]*&?/i, "$1").replace(/[?&]$/, "");
  const pool = new Pool({ connectionString: clean, ssl: { rejectUnauthorized: false }, max: 3 });
  try {
    const { rows } = await pool.query("SELECT id, data FROM bookings");
    const all = rows.map(({ id, data }) => ({ id, r: data }));

    // ── Locate target booking ──
    const gu = GUEST_UUID.toLowerCase();
    let hit = all.find(({ r }) => s(r.channelId) === CHANNEL_ID);
    let how = "channelId";
    if (!hit) {
      hit = all.find(({ r }) => bookerUuidOf(r) === gu || rosterUuidsOf(r).has(gu));
      how = "guest/booker UUID";
    }
    if (!hit) { console.error(`❌ No booking matched channelId ${CHANNEL_ID} or UUID ${GUEST_UUID}.`); return; }
    const r = hit.r;
    const type = bookingCabinType(r);
    const label = CABIN_TYPES[type].label;

    console.log(`\n═══════════════ TARGET BOOKING (matched by ${how}) ═══════════════`);
    console.log(`  id:        ${hit.id}`);
    console.log(`  opener:    ${r.openerTag || "?"}  (discord ${r.openerId || "—"})`);
    console.log(`  channelId: ${r.channelId || "—"}`);
    console.log(`  booker:    ${bookerUuidOf(r) || "—"}   roster: ${[...rosterUuidsOf(r)].join(", ") || "(none)"}`);
    console.log(`  status:    ${r.status || "—"}   approvedAt: ${r.approvedAt ? "yes" : "NO"}   active: ${isActive(r)}`);
    console.log(`  cabinType: ${type} (${label})   [cabinKey=${r.cabinKey || "—"} cabinType=${r.cabinType || "—"} tags.cabin=${r.tags?.cabin || "—"}]`);
    console.log(`  cabinId:   ${r.cabinId || "(unassigned)"}   notifiedAt: ${r.cabinLandmarkNotifiedAt || "no"}`);
    console.log(`  checkout:  ${r.checkoutDueAt || "—"}   stayDays: ${r.stayDays ?? "—"}`);

    const matchedUuid = bookerUuidOf(r) === gu || rosterUuidsOf(r).has(gu);
    if (how === "channelId" && GUEST_UUID && !matchedUuid)
      console.log(`  ⚠️  NOTE: UUID ${GUEST_UUID} was NOT found on this booking's booker/roster. Verify this is the right ticket.`);

    // ── Occupancy analysis for this cabin type ──
    const occ = new Map();          // cabinId -> active booking id
    for (const { id, r: rec } of all) if (isActive(rec) && rec.cabinId && CABIN_BY_ID[rec.cabinId]) occ.set(rec.cabinId.toUpperCase(), id);
    const typeCabins = ALL_CABINS.filter((c) => c.type === type);
    const free = typeCabins.filter((c) => !occ.has(c.id) && !LAYOUT_CHANGE_CABINS.has(c.id));
    const skippedForLayout = typeCabins.filter((c) => !occ.has(c.id) && LAYOUT_CHANGE_CABINS.has(c.id));
    if (skippedForLayout.length)
      console.log(`\n  🚫 Excluded (room layout change on file): ${skippedForLayout.map((c) => c.id).join(", ")}`);

    console.log(`\n═══════════════ ${label.toUpperCase()} OCCUPANCY (${typeCabins.length - free.length}/${typeCabins.length} occupied) ═══════════════`);
    for (const c of typeCabins) {
      const holder = occ.get(c.id);
      console.log(`  ${c.id}  ${holder ? "🔴 occupied  ← " + holder : "🟢 FREE"}`);
    }

    // Cabins freed by dead (cancelled / refunded / closed) bookings — the likely opening.
    const freedByDead = [];
    for (const { id, r: rec } of all) {
      if (isActive(rec)) continue;
      if (rec.cabinId && CABIN_BY_ID[rec.cabinId] && CABIN_BY_ID[rec.cabinId].type === type && !occ.has(rec.cabinId.toUpperCase()))
        freedByDead.push({ cabin: rec.cabinId.toUpperCase(), id, status: rec.status, who: rec.openerTag || "?" });
    }
    if (freedByDead.length) {
      console.log(`\n  💡 Free ${label}(s) vacated by a cancelled/refunded booking:`);
      for (const f of freedByDead) console.log(`     ${f.cabin} ← ${f.status} — ${f.who} (${f.id})`);
    }

    // ── Choose the cabin ──
    if (r.cabinId && CABIN_BY_ID[r.cabinId] && CABIN_BY_ID[r.cabinId].type === type) {
      console.log(`\n✅ This booking already holds ${r.cabinId} (${label}). Nothing to assign.`);
      if (r.cabinLandmarkNotifiedAt) { console.log(`   And it was already notified at ${r.cabinLandmarkNotifiedAt}. Use --force logic manually if you must re-send.`); return; }
      console.log(`   (It has a cabin but was never notified — --apply will send the message for ${r.cabinId}.)`);
    }

    let chosen;
    if (CABIN_OVERRIDE) {
      const c = CABIN_BY_ID[CABIN_OVERRIDE];
      if (!c) { console.error(`\n❌ --cabin=${CABIN_OVERRIDE} is not a valid cabin id.`); return; }
      if (c.type !== type) { console.error(`\n❌ --cabin=${CABIN_OVERRIDE} is a ${CABIN_TYPES[c.type].label}, but this booking is ${label}.`); return; }
      if (occ.has(CABIN_OVERRIDE)) { console.error(`\n❌ --cabin=${CABIN_OVERRIDE} is occupied by ${occ.get(CABIN_OVERRIDE)}.`); return; }
      chosen = CABIN_OVERRIDE;
    } else if (r.cabinId && CABIN_BY_ID[r.cabinId] && CABIN_BY_ID[r.cabinId].type === type) {
      chosen = r.cabinId;                 // keep existing, just (re)notify
    } else {
      if (!free.length) { console.error(`\n❌ No free ${label} available — cannot assign.`); return; }
      chosen = free[0].id;                // exactly what assignCabinCore does
    }

    const freedMatch = freedByDead.find((f) => f.cabin === chosen);
    console.log(`\n═══════════════ PLAN ═══════════════`);
    console.log(`  → Assign ${chosen} (${label}) to ${r.openerTag || hit.id}`);
    if (freedMatch) console.log(`    (this is the cabin freed by ${freedMatch.status} booking ${freedMatch.id} — matches "the one we refunded/cancelled")`);
    else if (!CABIN_OVERRIDE) console.log(`    (first free ${label}; deterministic same as the bot. Freed-by-cancel cabins: ${freedByDead.map((f) => f.cabin).join(", ") || "none"})`);
    console.log(`  → Then POST the "Your Cabin Is Ready!" embed to channel ${r.channelId} mentioning <@${r.openerId || "—"}>`);

    if (!APPLY) {
      console.log(`\n🔍 DRY RUN — nothing written or sent. Re-run with --apply to commit.\n`);
      return;
    }
    if (!r.channelId) { console.error(`\n❌ Booking has no channelId — cannot post the message. Aborting.`); return; }

    // ── Apply: write assignment (mirrors assignCabinCore) ──
    r.cabinId = chosen;
    r.cabinAssignedAt = r.cabinAssignedAt || nowISO();
    r.updatedAt = nowISO();
    await pool.query("UPDATE bookings SET data = $2, updated_at = now() WHERE id = $1", [hit.id, r]);
    await pool.query(
      `INSERT INTO cruise_cabin_assignments (cabin_id, data, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (cabin_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [chosen, { cabinId: chosen, bookingId: hit.id, cabinType: type, assignedAt: r.cabinAssignedAt }]
    );
    console.log(`\n✅ Assigned ${chosen} → ${hit.id} in Neon (bookings + cruise_cabin_assignments).`);

    // ── Send the exact cabin-ready message ──
    const msg = await postCabinReady(r);
    console.log(`✅ Posted cabin-ready embed to channel ${r.channelId} (message ${msg.id}).`);

    // Mark notified so the batch job won't double-send.
    r.cabinLandmarkNotifiedAt = nowISO();
    r.updatedAt = nowISO();
    await pool.query("UPDATE bookings SET data = $2, updated_at = now() WHERE id = $1", [hit.id, r]);
    console.log(`✅ Stamped cabinLandmarkNotifiedAt. Done — ${r.openerTag || hit.id} is in ${chosen}.\n`);
  } catch (e) {
    console.error("❌ Failed:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
})();
