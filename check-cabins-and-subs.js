/* Quick script: check cabin availability and cruise subscribers.
 * Run: node check-cabins-and-subs.js */
const db = require("./db");

(async () => {
  await db.init();
  if (!db.isReady()) { console.error("DB not ready"); process.exit(1); }

  // Get cabin assignments
  const cabins = await db.query("SELECT cabin_id, data FROM cruise_cabin_assignments ORDER BY cabin_id");
  console.log("=== CABIN ASSIGNMENTS ===");
  let occupied = 0;
  let availableCabins = [];
  cabins.rows.forEach(r => {
    const d = r.data || {};
    const isOccupied = d.bookingId ? true : false;
    if (isOccupied) { occupied++; } else { availableCabins.push(r.cabin_id); }
    console.log(`Cabin: ${r.cabin_id} | Occupied: ${isOccupied} | Booking: ${d.bookingId || "N/A"}`);
  });
  console.log(`\nTotal: ${cabins.rows.length} | Occupied: ${occupied} | Available: ${cabins.rows.length - occupied}`);
  console.log(`Available cabins: ${availableCabins.join(", ")}`);

  // Check subscriber count
  const subs = await db.query("SELECT discord_id, data FROM alert_subscriptions");
  console.log(`\n=== TOTAL SUBSCRIBERS: ${subs.rows.length} ===`);
  const cruiseSubs = subs.rows.filter(r => {
    const cats = r.data?.categories || [];
    return cats.some(c => String(c).toLowerCase().includes("cruise") || String(c).toLowerCase().includes("booking"));
  });
  console.log(`Cruise/Booking subscribers: ${cruiseSubs.length}`);

  // List cabins by type (from booking data we've seen)
  const cabinTypes = {
    "Standard": ["A01","A02","A03","A04","A05","A06","A07","A08","A09","A10"],
    "Romance": ["C01","C02","C03","C04","C05","C06"],
    "Family": ["F01","F02","F03","F04","F05","F06"],
    "Suite": ["S01","S02","S03","S04"],
    "Presidential": ["P01","P02"],
  };

  console.log("\n=== CABIN AVAILABILITY BY TYPE ===");
  for (const [type, ids] of Object.entries(cabinTypes)) {
    const avail = ids.filter(id => availableCabins.includes(id));
    console.log(`${type}: ${avail.length}/${ids.length} available (${avail.join(", ")})`);
  }

  await db.query(`SELECT 1`).then(() => console.log("\nDB connection: OK")).catch(() => {});

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
