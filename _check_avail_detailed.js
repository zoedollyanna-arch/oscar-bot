// Detailed check: all active bookings with dates, find available cabins NOW
require("dotenv").config();
const { Pool } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
const cleanUrl = url.replace(/([?&])sslmode=[^&]*&?/i, "$1").replace(/[?&]$/, "");
const pool = new Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false }, max: 2 });

(async () => {
  const bookings = await pool.query(`SELECT id, data FROM bookings ORDER BY id`);
  
  console.log("=== ALL BOOKINGS WITH STATUS + DATES ===");
  for (const b of bookings.rows) {
    const d = b.data || {};
    const answers = d.answers || {};
    const datesRaw = answers.support_q4 || d.support_q4 || "—";
    const cabinKey = d.cabinKey || "—";
    const cabinId = d.cabinId || "—";
    const status = d.status || d.category || "—";
    const pricing = d.pricing ? JSON.stringify(d.pricing) : "—";
    console.log(`${b.id}`);
    console.log(`  Status: ${status} | CabinKey: ${cabinKey} | CabinId: ${cabinId}`);
    console.log(`  Dates: ${datesRaw.slice(0, 100)}`);
    console.log(`  Pricing: ${pricing.slice(0, 120)}`);
  }

  // Now reconcile: check which cabins in cruise_cabin_assignments have bookings
  // that have status "expired" or "checked_out" — those should be free
  console.log("\n=== RECONCILIATION: cabins with expired/checked_out bookings ===");
  const cabins = await pool.query("SELECT cabin_id, data FROM cruise_cabin_assignments ORDER BY cabin_id");
  const cabinMap = new Map();
  cabins.rows.forEach(r => cabinMap.set(r.cabin_id, r.data || {}));
  
  for (const b of bookings.rows) {
    const d = b.data || {};
    const cabinId = d.cabinId || d.cabinIds || "—";
    const status = d.status || "—";
    if (cabinId !== "—" && (cabinId === "—") === false) {
      // Check if this cabin is still marked occupied in cruise_cabin_assignments
      const ids = Array.isArray(cabinId) ? cabinId : [cabinId];
      for (const cid of ids) {
        const assigned = cabinMap.get(cid);
        if (assigned) {
          const assignedBooking = assigned.bookingId || assigned.booking_id || "—";
          if (status === "expired" || status === "checked_out" || status === "cancelled" || status === "cancelled_non_payment") {
            console.log(`  ${cid}: booking ${b.id} is ${status} but cabin still shows occupied by ${assignedBooking}`);
          }
        } else {
          console.log(`  ${cid}: not found in cabin assignments (booking ${b.id}, status ${status})`);
        }
      }
    }
  }

  // Also check for the new booking-1069 specifically
  console.log("\n=== NEW BOOKING-1069 FULL DATA ===");
  const b1069 = bookings.rows.find(b => b.id === "booking-1069");
  if (b1069) {
    console.log(JSON.stringify(b1069.data, null, 2));
  }

  // Check cruise_cabin_assignments for which cabins DON'T exist but might be needed
  console.log("\n=== CABIN INVENTORY GAPS ===");
  const allIds = cabins.rows.map(r => r.cabin_id);
  const expectedPrefixes = { A: 10, C: 8, F: 8, S: 8 };
  for (const [prefix, count] of Object.entries(expectedPrefixes)) {
    for (let i = 1; i <= count; i++) {
      const id = `${prefix}${String(i).padStart(2, "0")}`;
      if (!allIds.includes(id)) {
        console.log(`  MISSING: ${id}`);
      }
    }
  }

  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
