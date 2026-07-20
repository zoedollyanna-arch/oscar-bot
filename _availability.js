require("dotenv").config({ quiet: true });
const { Pool } = require("pg");
const P = (x) => Date.parse(x);
const s = (v) => (v == null ? "" : String(v));
const DEAD = ["cancelled_non_payment","cancelled","closed","denied","expired","checked_out"];
const isActive = (r) => !!r.approvedAt && !DEAD.includes(s(r.status).toLowerCase());
const TYPES = { S: "standard", C: "couple", F: "family" };
const CABINS = [];
for (const p of ["S","C","F"]) for (let i=1;i<=8;i++) CABINS.push(`${p}${String(i).padStart(2,"0")}`);
const typeOfBooking = (r) => {
  const v = s(r.cabinKey || r.cabinType || r.tags?.cabin || "").toLowerCase();
  return /couple/.test(v) ? "couple" : /family/.test(v) ? "family" : "standard";
};
const cabinsHeld = (r) => [...new Set([r.cabinId, ...(r.cabinIds||[]), ...(r.additionalCabinIds||[])]
  .map(x=>s(x).toUpperCase().trim()).filter(x=>CABINS.includes(x)))];

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const { rows } = await pool.query("SELECT id, data FROM bookings");
  const now = Date.now();
  console.log("NOW:", new Date(now).toISOString(), "| total booking rows:", rows.length);

  const occ = new Map();          // cabin -> [bookingId...]
  const unassigned = { standard:[], couple:[], family:[] };
  const future = [];
  const active = [];
  for (const { id, data:r } of rows) {
    if (!isActive(r)) continue;
    active.push(id);
    const held = cabinsHeld(r);
    const t = typeOfBooking(r);
    const isFuture = r.stayStartsAt && P(r.stayStartsAt) > now;
    if (isFuture) future.push({ id, t, held, start: r.stayStartsAt, checkout: r.checkoutDueAt, opener: r.openerTag });
    if (!held.length) unassigned[t].push({ id, opener: r.openerTag, status: r.status, start: r.stayStartsAt||"(none)", checkout: r.checkoutDueAt });
    for (const c of held) { if (!occ.has(c)) occ.set(c,[]); occ.get(c).push(id); }
  }

  // per-type breakdown
  console.log("\n===== PER-TYPE =====");
  const result = {};
  for (const [pref, type] of Object.entries(TYPES)) {
    const typeCabins = CABINS.filter(c=>c[0]===pref);
    const occupied = typeCabins.filter(c=>occ.has(c));
    const free = typeCabins.filter(c=>!occ.has(c));
    const reserved = unassigned[type].length;
    const trulyFree = Math.max(0, free.length - reserved);
    result[type] = { trulyFree, freeCabins: free.slice(0, trulyFree), heldForUnassigned: free.slice(trulyFree) };
    console.log(`\n${type.toUpperCase()} (8 total)`);
    console.log(`  occupied(assigned): ${occupied.length} -> ${occupied.join(", ")||"—"}`);
    console.log(`  physically free   : ${free.length} -> ${free.join(", ")||"—"}`);
    console.log(`  reserved-unassigned bookings of this type: ${reserved}${reserved?" ("+unassigned[type].map(u=>u.id).join(",")+")":""}`);
    console.log(`  ==> TRULY AVAILABLE: ${trulyFree} -> ${result[type].freeCabins.join(", ")||"—"}`);
  }

  const totalTruly = Object.values(result).reduce((a,r)=>a+r.trulyFree,0);
  console.log(`\n===== TOTAL TRULY AVAILABLE: ${totalTruly} =====`);

  console.log("\n===== FUTURE-DATED ACTIVE BOOKINGS (reserve their cabin now) =====");
  if (!future.length) console.log("  (none)");
  for (const f of future) console.log(`  ${f.id} ${f.t} cabins[${f.held.join(",")||"UNASSIGNED"}] starts ${f.start} checkout ${f.checkout} (${f.opener})`);

  console.log("\n===== ANOMALIES =====");
  let any=false;
  for (const [c, ids] of occ) if (ids.length>1) { console.log(`  ⚠️ DOUBLE-BOOKED ${c}: ${ids.join(", ")}`); any=true; }
  for (const [type, list] of Object.entries(unassigned)) for (const u of list) { console.log(`  ⚠️ RESERVED-UNASSIGNED ${type}: ${u.id} status=${u.status} start=${u.start} (${u.opener}) — needs a ${type} cabin`); any=true; }
  // cabins held whose prefix != booking type (type/cabin mismatch)
  if (!any) console.log("  (none)");
  await pool.end();
})().catch(e => { console.error(e.stack||e.message); process.exit(1); });
