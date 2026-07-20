// Check booking ticket 1527129352343388160 using REST API
// Also check 1035 booking state
require("dotenv").config();
const TOKEN = process.env.DISCORD_TOKEN;

async function getChannelMessages(channelId, limit = 30) {
  const r = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`, {
    headers: { Authorization: `Bot ${TOKEN}` },
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`HTTP ${r.status}: ${text.slice(0, 300)}`);
  }
  return r.json();
}

(async () => {
  // Check new booking ticket
  console.log("=== NEW BOOKING TICKET 1527129352343388160 ===");
  try {
    const msgs = await getChannelMessages("1527129352343388160");
    msgs.reverse().forEach((m, i) => {
      console.log(`--- MSG ${i} | Author: ${m.author.username}#${m.author.discriminator} | ID: ${m.id}`);
      console.log(`Content: ${(m.content || "").slice(0, 500)}`);
      if (m.embeds?.length) {
        m.embeds.forEach((e, j) => {
          console.log(`  Embed ${j}: Title=${e.title || ""} | Desc=${(e.description || "").slice(0, 200)}`);
          if (e.fields) e.fields.forEach(f => console.log(`    Field: ${f.name} = ${(f.value || "").slice(0, 150)}`));
        });
      }
      console.log();
    });
  } catch (e) {
    console.error("Error fetching 1527129352343388160:", e.message);
  }
  
  // Also check booking-1035
  console.log("\n=== BOOKING-1035 TICKET 1525981661823762674 ===");
  try {
    const msgs = await getChannelMessages("1525981661823762674", 20);
    msgs.reverse().forEach((m, i) => {
      console.log(`--- MSG ${i} | Author: ${m.author.username}#${m.author.discriminator} | ID: ${m.id}`);
      console.log(`Content: ${(m.content || "").slice(0, 300)}`);
      if (m.embeds?.length) {
        m.embeds.forEach((e, j) => {
          console.log(`  Embed ${j}: Title=${e.title || ""} | Desc=${(e.description || "").slice(0, 150)}`);
          if (e.fields) e.fields.forEach(f => console.log(`    Field: ${f.name} = ${(f.value || "").slice(0, 120)}`));
        });
      }
      console.log();
    });
  } catch (e) {
    console.error("Error fetching 1525981661823762674:", e.message);
  }

  // Check what booking channels exist
  console.log("\n=== CHECKING DB FOR CABIN TYPE DEFINITIONS ===");
  const { Pool } = require("pg");
  const url = process.env.DATABASE_URL;
  const cleanUrl = url.replace(/([?&])sslmode=[^&]*&?/i, "$1").replace(/[?&]$/, "");
  const pool = new Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false }, max: 2 });
  
  const tables = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema='public' AND table_name LIKE '%cabin%' 
    ORDER BY table_name
  `);
  console.log("Cabin-related tables:", tables.rows.map(r => r.table_name));
  
  // Also check if there's a cabin_types or cabin_definitions table  
  const allTables = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema='public' AND table_name NOT LIKE 'pg_%'
    ORDER BY table_name
  `);
  console.log("All public tables:", allTables.rows.map(r => r.table_name));

  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
