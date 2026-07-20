// Check which standard-tier (S-prefix) cabins are active and when they free up
// Also check booking-1036 (tomorrow's arrival) and future openings
require("dotenv").config();
const { Pool } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
const cleanUrl = url.replace(/([?&])sslmode=[^&]*&?/i, "$1").replace(/[?&]$/, "");
const pool = new Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false }, max: 2 });

(async () => {
  // Check detailed booking data for S-cabin bookings
  const bookings = await pool.query(`SELECT id, data FROM bookings ORDER BY id`);
  
  // Find all S-cabin active bookings and check their date info
  console.log("=== S-CABIN (STANDARD TIER) ACTIVE BOOKINGS ===");
  const sCabinAssignments = ["S01","S02","S03","S04","S05","S06","S07","S08"];
  
  for (const b of bookings.rows) {
    const d = b.data || {};
    const cabinId = d.cabinId || d.cabinIds || "—";
    const status = d.status || d.category || "—";
    const cabinKey = d.cabinKey || "—";
    const cabinIds = Array.isArray(cabinId) ? cabinId : [cabinId];
    const isS = cabinIds.some(id => sCabinAssignments.includes(id));
    
    if (isS && (status === "approved" || status === "payment_marked" || status === "active")) {
      console.log(`\n${b.id}`);
      console.log(`  Cabin: ${cabinId} | Status: ${status} | Key: ${cabinKey}`);
      console.log(`  Full data: ${JSON.stringify(d, null, 2).slice(0, 800)}`);
    }
  }

  // Also check which bookings have explicit date fields
  console.log("\n=== ALL 'APPROVED' BOOKINGS WITH DATE INFORMATION ===");
  for (const b of bookings.rows) {
    const d = b.data || {};
    const status = d.status || "—";
    if (status !== "approved" && status !== "payment_marked") continue;
    const answers = d.answers || {};
    const rawDates = answers.support_q4 || d.support_q4 || "—";
    const cabinId = d.cabinId || d.cabinIds || "—";
    const stayStarts = d.stayStartsAt || "—";
    const checkoutDue = d.checkoutDueAt || "—";
    const stayDays = d.stayDays || "—";
    
    console.log(`${b.id} | Cabin: ${cabinId} | Dates: ${rawDates.slice(0, 60)} | StayStarts: ${stayStarts} | CheckoutDue: ${checkoutDue} | StayDays: ${stayDays}`);
  }

  // Check the cruise_cabin_assignments table more carefully
  // to understand the bookingId format
  console.log("\n=== CRUISE_CABIN_ASSIGNMENTS - FILTERED ===");
  const cabins = await pool.query("SELECT cabin_id, data FROM cruise_cabin_assignments ORDER BY cabin_id");
  for (const row of cabins.rows) {
    const d = row.data || {};
    const bId = d.bookingId || d.booking_id || "—";
    console.log(`${row.cabin_id}: bookingId=${bId} | type=${d.type || d.cabinType || d.cabin_type || "—"}`);
  }

  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
