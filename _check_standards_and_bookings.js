// Check bookings table for cabin type definitions, upcoming bookings, and tomorrow's arrivals
require("dotenv").config();
const { Pool } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
const cleanUrl = url.replace(/([?&])sslmode=[^&]*&?/i, "$1").replace(/[?&]$/, "");
const pool = new Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false }, max: 2 });

(async () => {
  // Check bookings table schema for cabin type info
  const columns = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='bookings' 
    ORDER BY ordinal_position
  `);
  console.log("=== BOOKINGS TABLE COLUMNS ===");
  columns.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));

  // Check the bookings table — it's key-value with JSON data
  const bookings = await pool.query(`SELECT id, data FROM bookings ORDER BY id`);
  console.log("\n=== ALL BOOKINGS ===");
  for (const b of bookings.rows) {
    const d = b.data || {};
    console.log(`ID: ${b.id} | Data: ${JSON.stringify(d).slice(0, 400)}`);
  }

  // Check for bookings checking in tomorrow (July 16) or soon
  console.log("\n=== BOOKINGS CHECKING IN 7/16 OR CHECKING OUT SOON ===");
  const now = new Date("2026-07-15");
  const tomorrow = new Date("2026-07-16");
  for (const b of bookings.rows) {
    const d = b.data || {};
    const checkIn = d.check_in || d.checkIn || d.checkin || d.arrival;
    const checkOut = d.check_out || d.checkOut || d.checkout || d.departure;
    let note = "";
    if (checkIn) {
      const ci = new Date(checkIn);
      if (ci >= now && ci <= new Date("2026-07-17")) note = ` CHECK-IN SOON: ${checkIn}`;
    }
    if (checkOut) {
      const co = new Date(checkOut);
      if (co >= now && co <= new Date("2026-07-16")) note += ` CHECK-OUT SOON: ${checkOut}`;
    }
    if (note) {
      console.log(`ID: ${b.id}${note}`);
      console.log(`  ${JSON.stringify(d).slice(0, 300)}`);
    }
  }

  // Check packages table for cabin types
  const packCols = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='packages'
    ORDER BY ordinal_position
  `);
  console.log("\n=== PACKAGES TABLE COLUMNS ===");
  packCols.rows.forEach(c => console.log(`  ${c.column_name}`));

  const packages = await pool.query("SELECT * FROM packages ORDER BY id");
  console.log("\n=== ALL PACKAGES ===");
  for (const p of packages.rows) {
    console.log(`ID: ${p.id} | Name: ${p.name || "?"} | Type: ${p.package_type || p.type || "?"} | Price: ${p.price || "?"} | Description: ${(p.description || "").slice(0, 120)}`);
    if (p.cabin_types || p.cabin_type) console.log(`  Cabin Types: ${p.cabin_types || p.cabin_type}`);
  }

  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
