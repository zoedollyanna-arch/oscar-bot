// Check ALL cabin IDs in the database and their types
require("dotenv").config();
const { Pool } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
const cleanUrl = url.replace(/([?&])sslmode=[^&]*&?/i, "$1").replace(/[?&]$/, "");
const pool = new Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false }, max: 2 });

(async () => {
  const r = await pool.query("SELECT cabin_id, data FROM cruise_cabin_assignments ORDER BY cabin_id");
  console.log("=== ALL CABIN ASSIGNMENTS ===");
  for (const row of r.rows) {
    const d = row.data || {};
    const occupied = d.bookingId || d.booking_id ? true : false;
    const bookingId = d.bookingId || d.booking_id || "—";
    console.log(`${row.cabin_id} | Occupied: ${occupied} | Booking: ${bookingId}`);
  }
  
  const aCabins = r.rows.filter(row => row.cabin_id.startsWith("A"));
  console.log(`\n=== A-PREFIX CABINS: ${aCabins.length} ===`);
  for (const row of aCabins) {
    const d = row.data || {};
    console.log(`${row.cabin_id} | data: ${JSON.stringify(d)}`);
  }

  // Also check for any cabin that isn't C/F/S prefix
  const otherCabins = r.rows.filter(row => !/^[CFS]/.test(row.cabin_id));
  console.log(`\n=== OTHER PREFIX CABINS: ${otherCabins.length} ===`);
  for (const row of otherCabins) {
    const d = row.data || {};
    console.log(`${row.cabin_id} | data: ${JSON.stringify(d)}`);
  }

  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
