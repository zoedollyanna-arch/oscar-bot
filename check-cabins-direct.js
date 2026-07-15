/* Direct cabin check without db.js */
const dotenv = require("dotenv");
dotenv.config();
const { Pool } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
const cleanUrl = url.replace(/([?&])sslmode=[^&]*&?/i, "$1").replace(/[?&]$/, "");
const pool = new Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false }, max: 2 });

(async () => {
  const cabins = await pool.query("SELECT cabin_id, data FROM cruise_cabin_assignments ORDER BY cabin_id");
  console.log("=== CABIN ASSIGNMENTS ===");
  let occupied = 0;
  const availableCabins = [];
  cabins.rows.forEach(r => {
    const d = r.data || {};
    const isOccupied = d.bookingId ? true : false;
    if (isOccupied) occupied++;
    else availableCabins.push(r.cabin_id);
    console.log(`Cabin: ${r.cabin_id} | Occupied: ${isOccupied} | Booking: ${d.bookingId || "—"}`);
  });
  console.log(`\nTotal: ${cabins.rows.length} | Occupied: ${occupied} | Available: ${cabins.rows.length - occupied}`);
  console.log(`Available: ${availableCabins.join(", ")}`);

  const subs = await pool.query("SELECT discord_id, data FROM alert_subscriptions");
  console.log(`\nTotal subscribers: ${subs.rows.length}`);
  const cruiseSubs = subs.rows.filter(r => {
    const cats = r.data?.categories || [];
    return cats.some(c => String(c).toLowerCase().includes("cruise") || String(c).toLowerCase().includes("booking"));
  });
  console.log(`Cruise/Booking subscribers: ${cruiseSubs.length}`);
  if (cruiseSubs.length) {
    console.log(`Subscribers list:`);
    cruiseSubs.forEach(r => console.log(`  ${r.discord_id}`));
  }

  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
