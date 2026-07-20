// Comprehensive check: which cabins free up soon, what "standard" maps to, and availability
require("dotenv").config();
const { Pool } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
const cleanUrl = url.replace(/([?&])sslmode=[^&]*&?/i, "$1").replace(/[?&]$/, "");
const pool = new Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false }, max: 2 });

(async () => {
  // Check ALL bookings with cabinKey and dates
  const bookings = await pool.query(`SELECT id, data FROM bookings ORDER BY id`);
  
  console.log("=== BOOKINGS WITH cabinKey / dates ===");
  for (const b of bookings.rows) {
    const d = b.data || {};
    const cabinKey = d.cabinKey || "—";
    const cabinId = d.cabinId || d.cabinIds || "—";
    const status = d.status || d.category || "—";
    const checkIn = d.support_q4 || d.answers?.support_q4 || "—";
    const pricing = d.pricing ? Object.keys(d.pricing).join(", ") : "—";
    const hasDates = checkIn !== "—";
    const cat = d.category || "—";
    if (cabinKey !== "—" || cat === "booking" || hasDates) {
      console.log(`${b.id} | cabinKey: ${cabinKey} | cabinId: ${cabinId} | status: ${status} | dates: ${checkIn.slice(0, 80)}`);
    }
  }

  // Now check the cruise_cabin_assignments for each cabin's full data
  console.log("\n=== CABIN ASSIGNMENTS - FULL DATA ===");
  const cabins = await pool.query("SELECT cabin_id, data FROM cruise_cabin_assignments ORDER BY cabin_id");
  for (const row of cabins.rows) {
    const d = row.data || {};
    console.log(`Cabin: ${row.cabin_id} | Booking: ${d.bookingId || d.booking_id || "—"} | Additional: ${JSON.stringify(d).slice(0, 200)}`);
  }

  // Check checkouts happening today (7/15) or tomorrow (7/16)
  console.log("\n=== CABINS THAT MAY FREE UP SOON ===");
  const now = new Date("2026-07-15T22:00:00-04:00"); // Current time
  const tomorrow = new Date("2026-07-16T23:59:00-04:00");
  
  // Check the checked_out bookings
  const checkedOut = bookings.rows.filter(b => {
    const d = b.data || {};
    return d.status === "checked_out" || d.status === "expired";
  });
  console.log("Checked out / expired bookings (cabins that should be free):");
  for (const b of checkedOut) {
    const d = b.data || {};
    console.log(`${b.id} | cabinId: ${d.cabinId || "—"} | status: ${d.status || d.category}`);
  }

  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
