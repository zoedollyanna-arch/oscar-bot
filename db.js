/* =================================================================================================
 *  Lifeline Bot — Neon Postgres data layer (shared pool)
 *  ------------------------------------------------------------------------------------------------
 *  Single source of truth for ALL persistent bot data going forward (bloggers, assignments,
 *  submissions, packages, staff jobs, quick-help issues, responses, notifications, settings).
 *
 *  Records are stored as JSONB keyed by their existing in-memory Map key, so the bot's runtime
 *  Maps round-trip losslessly and we never drop a field as records evolve. A future web service
 *  can read the JSONB directly (e.g. data->>'status') or we can add generated columns later.
 *
 *  Everything is best-effort and never throws to callers — if Neon is unreachable the bot keeps
 *  running on its in-memory Maps + local JSON backup.
 * ================================================================================================= */

let pool = null;
let ready = false;
let initPromise = null;

// store key → { table, keyCol } for the generic JSONB stores.
const STORES = {
  bloggers:            { table: "bloggers",            keyCol: "discord_id" },
  assignments:         { table: "assignments",         keyCol: "id" },
  blogger_assignments: { table: "blogger_assignments", keyCol: "akey" },
  submissions:         { table: "submissions",         keyCol: "id" },
  packages:            { table: "packages",            keyCol: "id" },
  bookings:            { table: "bookings",            keyCol: "id" },
  staff_jobs:          { table: "staff_jobs",          keyCol: "id" },
  staff_job_members:   { table: "staff_job_members",   keyCol: "mkey" },
  staff_issues:        { table: "staff_issues",        keyCol: "id" },
  staff_responses:     { table: "staff_responses",     keyCol: "id" },
  staff_profiles:      { table: "staff_profiles",      keyCol: "discord_id" },
  // Timeclock + payroll system
  staff_avatar_links:  { table: "staff_avatar_links",  keyCol: "discord_id" },
  staff_time_profiles: { table: "staff_time_profiles", keyCol: "discord_id" },
  staff_pay_rates:     { table: "staff_pay_rates",     keyCol: "role" },
  timeclock_locations: { table: "timeclock_locations", keyCol: "id" },
  staff_shifts:        { table: "staff_shifts",        keyCol: "id" },
  staff_adjustments:   { table: "staff_adjustments",   keyCol: "id" },
  staff_job_payments:  { table: "staff_job_payments",  keyCol: "id" },
  staff_assist_logs:   { table: "staff_assist_logs",   keyCol: "id" },
  staff_assist_settings: { table: "staff_assist_settings", keyCol: "key" },
  staff_redelivery_requests: { table: "staff_redelivery_requests", keyCol: "id" },
  staff_redelivery_players: { table: "staff_redelivery_players", keyCol: "avatar_uuid" },
  staff_redelivery_entitlements: { table: "staff_redelivery_entitlements", keyCol: "ekey" },
  staff_commissions:   { table: "staff_commissions",   keyCol: "id" },
  payroll_periods:     { table: "payroll_periods",     keyCol: "id" },
  payroll_entries:     { table: "payroll_entries",     keyCol: "ekey" },
  payouts:             { table: "payouts",             keyCol: "id" },
  // Lifeline Alert Center (/subscribe) — one row per user: { categories: [], delivery, ... }
  alert_subscriptions: { table: "alert_subscriptions", keyCol: "discord_id" },
  // Lifeline Island Paradise HUD + cabin terminals (cruise-game-hub)
  cruise_cabin_assignments: { table: "cruise_cabin_assignments", keyCol: "cabin_id" },     // cabinId -> { bookingId, assignedAt }
  cruise_service_requests:  { table: "cruise_service_requests",  keyCol: "id" },           // service/package/crew/room-change requests + payment state
  cruise_reviews:           { table: "cruise_reviews",           keyCol: "id" },           // guest reviews left from the HUD
  cruise_hud_sessions:      { table: "cruise_hud_sessions",      keyCol: "avatar_uuid" },  // registered in-world HUD URLs for charge push
  cruise_terminal_logs:     { table: "cruise_terminal_logs",     keyCol: "id" },           // cabin terminal actions (guests, extensions, info views)
  cruise_game_scores:       { table: "cruise_game_scores",       keyCol: "id" },           // game hub leaderboard scores
  cruise_game_sessions:     { table: "cruise_game_sessions",     keyCol: "code" },         // live multiplayer game sessions (join-code lobbies)
  cruise_staff_passes:      { table: "cruise_staff_passes",      keyCol: "uuid" },         // terminal-added crew allowlist (boundary-exempt + staff-terminal operators)
  cruise_boundary_evictions:{ table: "cruise_boundary_evictions",keyCol: "id" },           // audit log of avatars the ship/island boundary sent home
  cruise_package_orders:    { table: "cruise_package_orders",    keyCol: "id" },           // celebration package questionnaire orders + payment/approval state (packageOrders.js)
  cruise_events:            { table: "cruise_events",            keyCol: "id" },           // event kit dispatch runs: roster snapshot + per-recipient delivery ledger (eventDispatch.js)
  // Lifeline Academy Digital prelaunch. Structured Academy tables are created by academy.js;
  // these JSON stores keep lightweight app sessions and notification ledgers compatible with
  // the existing Neon store helpers.
  academy_sessions:         { table: "academy_sessions",         keyCol: "avatar_uuid" },
  academy_notification_ledger: { table: "academy_notification_ledger", keyCol: "id" },
  // ZPad MOAP device bridge (zpadHub.js): per-avatar command queue polled by the tablet LSL,
  // plus a delivery settlement ledger for Eats orders (confirm/refund audit).
  zpad_commands:            { table: "zpad_commands",            keyCol: "avatar_uuid" },
  zpad_delivery_logs:       { table: "zpad_delivery_logs",       keyCol: "id" },
  // Tammy Brightwood staff-assistant bot (oscar-bot) — shares THIS Neon database with the
  // main Discord bot so both read/write the same support, redelivery, application and audit
  // data. Tammy writes here; the main bot's in-world relay + staff tooling can read it.
  support_tickets:           { table: "support_tickets",           keyCol: "id" },           // guest support tickets (product help, cruise, reports)
  tammy_redelivery_requests: { table: "tammy_redelivery_requests", keyCol: "id" },           // guest-initiated redelivery requests pending staff review
  tammy_faqs:                { table: "tammy_faqs",                keyCol: "id" },           // editable FAQ knowledge base entries
  tammy_announcements:       { table: "tammy_announcements",       keyCol: "id" },           // scheduled/one-off announcements
  tammy_applications:        { table: "tammy_applications",        keyCol: "id" },           // staff/blogger applications collected by Tammy
  tammy_interactions:        { table: "tammy_interactions",        keyCol: "id" },           // audit log of every interaction + staff action
};

function isReady() { return ready; }
function getPool() { return pool; }

async function query(text, params) {
  if (!pool) throw new Error("DB pool not initialized");
  return pool.query(text, params);
}

async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const url = process.env.DATABASE_URL;
    if (!url) {
      console.warn("⚠️ DATABASE_URL not set — Postgres disabled; bot runs on in-memory + JSON backup only.");
      initPromise = null;
      return false;
    }
    try {
      const { Pool } = require("pg");
      // Strip sslmode from the URL (we set `ssl` explicitly) to avoid pg's verify-full deprecation warning.
      const cleanUrl = url.replace(/([?&])sslmode=[^&]*&?/i, "$1").replace(/[?&]$/, "");
      pool = new Pool({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false }, max: 8 });
      pool.on("error", (e) => console.error("❌ Postgres pool error:", e.message));

      // Generic JSONB stores (one table per entity, keyed by the Map key).
      for (const { table, keyCol } of Object.values(STORES)) {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS ${table} (
            ${keyCol}   TEXT PRIMARY KEY,
            data        JSONB NOT NULL,
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
          );
        `);
      }

      // Settings (key/value).
      await pool.query(`
        CREATE TABLE IF NOT EXISTS bot_settings (
          key         TEXT PRIMARY KEY,
          value       TEXT,
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);

      // Notification audit log + dedupe.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS blogger_notifications (
          id                  SERIAL PRIMARY KEY,
          blogger_discord_id  TEXT NOT NULL,
          blogger_profile_id  TEXT,
          notification_type   TEXT NOT NULL,
          assignment_id       TEXT,
          package_id          TEXT,
          reminder_stage      TEXT,
          embed_title         TEXT,
          message_content     TEXT,
          sent_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
          sent_by             TEXT,
          is_automatic        BOOLEAN NOT NULL DEFAULT true,
          delivery_status     TEXT NOT NULL DEFAULT 'pending',
          failure_reason      TEXT,
          confirmation_status TEXT,
          confirmed_at        TIMESTAMPTZ
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_blnotif_blogger ON blogger_notifications (blogger_discord_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_blnotif_type ON blogger_notifications (notification_type);`);

      // Staff notification log (job/issue DMs).
      await pool.query(`
        CREATE TABLE IF NOT EXISTS staff_notifications (
          id                SERIAL PRIMARY KEY,
          staff_discord_id  TEXT NOT NULL,
          notification_type TEXT NOT NULL,
          job_id            TEXT,
          issue_id          TEXT,
          title             TEXT,
          message_content   TEXT,
          sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
          sent_by           TEXT,
          delivery_status   TEXT NOT NULL DEFAULT 'pending',
          failure_reason    TEXT
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_staffnotif_staff ON staff_notifications (staff_discord_id);`);

      ready = true;
      console.log("✅ Neon Postgres ready (data + settings + notifications).");
      return true;
    } catch (e) {
      console.error("❌ Postgres init failed — running on in-memory + JSON backup only:", e.message);
      ready = false;
      if (pool) {
        await pool.end().catch(() => {});
        pool = null;
      }
      initPromise = null;
      return false;
    }
  })();
  return initPromise;
}

/* ───────────────────────────── Generic JSONB store helpers ───────────────────────────── */

// Load every row of a store as { key, data } objects.
async function loadStore(store) {
  const cfg = STORES[store];
  if (!cfg || !ready) return [];
  try {
    const r = await pool.query(`SELECT ${cfg.keyCol} AS key, data FROM ${cfg.table}`);
    return r.rows.map((row) => ({ key: row.key, data: row.data }));
  } catch (e) {
    console.error(`❌ loadStore(${store}) failed:`, e.message);
    return [];
  }
}

// Upsert a single record into a store.
async function upsertRow(store, key, data) {
  const cfg = STORES[store];
  if (!cfg || !ready) return false;
  try {
    await pool.query(
      `INSERT INTO ${cfg.table} (${cfg.keyCol}, data, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (${cfg.keyCol}) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [String(key), data]
    );
    return true;
  } catch (e) {
    console.error(`❌ upsertRow(${store}) failed:`, e.message);
    return false;
  }
}

// Upsert an entire Map's worth of records (used by the *ToDisk save shims). Best-effort, batched.
async function upsertMap(store, map) {
  const cfg = STORES[store];
  if (!cfg || !ready) return false;
  const entries = [...map.entries()];
  if (!entries.length) return true;
  const client = await pool.connect().catch(() => null);
  if (!client) return false;
  try {
    await client.query("BEGIN");
    for (const [key, rec] of entries) {
      await client.query(
        `INSERT INTO ${cfg.table} (${cfg.keyCol}, data, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (${cfg.keyCol}) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [String(key), rec]
      );
    }
    await client.query("COMMIT");
    return true;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`❌ upsertMap(${store}) failed:`, e.message);
    return false;
  } finally {
    client.release();
  }
}

async function deleteRow(store, key) {
  const cfg = STORES[store];
  if (!cfg || !ready) return false;
  try {
    await pool.query(`DELETE FROM ${cfg.table} WHERE ${cfg.keyCol} = $1`, [String(key)]);
    return true;
  } catch (e) {
    console.error(`❌ deleteRow(${store}) failed:`, e.message);
    return false;
  }
}

async function countRows(store) {
  const cfg = STORES[store];
  if (!cfg || !ready) return 0;
  try {
    const r = await pool.query(`SELECT count(*)::int AS n FROM ${cfg.table}`);
    return r.rows[0].n;
  } catch { return 0; }
}

/* ───────────────────────────── Settings ───────────────────────────── */

async function getSetting(key, fallback = null) {
  if (!ready) return fallback;
  try {
    const r = await pool.query("SELECT value FROM bot_settings WHERE key = $1", [key]);
    return r.rows.length ? r.rows[0].value : fallback;
  } catch (e) { console.error("❌ getSetting failed:", e.message); return fallback; }
}

async function setSetting(key, value) {
  if (!ready) return false;
  try {
    await pool.query(
      `INSERT INTO bot_settings (key, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, String(value)]
    );
    return true;
  } catch (e) { console.error("❌ setSetting failed:", e.message); return false; }
}

module.exports = {
  init, isReady, getPool, query,
  STORES,
  loadStore, upsertRow, upsertMap, deleteRow, countRows,
  getSetting, setSetting,
};
