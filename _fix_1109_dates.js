/* Booking #1109 — kamorasl / khiloni1
 * Restores the stay dates she was actually promised on her 7/28 boarding pass.
 *
 * Her intake said "August 3rd to August 5th. Time 8am est", but:
 *   - stayStartsAt was overwritten with the APPROVAL timestamp (7/28), starting her stay 6 days early
 *   - parseStayDays() couldn't read her answer, so stayDays silently defaulted to 7 (full week)
 *   - status reverted to payment_marked because Mark Payment Complete was pressed 9s after approval
 *
 * Target values match the boarding pass she already received, so NO guest-facing message changes.
 * Backend only — no messages sent.
 */
const fs = require("fs");
const { Client } = require("pg");

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = loadEnv("./oscar-bot.env");

const BOOKING_ID = "booking-1109";
const EARLY_ISO    = "2026-08-02T12:00:00.000Z"; // Sun Aug 2,  8:00 AM EDT
const CHECKIN_ISO  = "2026-08-03T12:00:00.000Z"; // Mon Aug 3,  8:00 AM EDT  <- her request
const CHECKOUT_ISO = "2026-08-06T00:00:00.000Z"; // Wed Aug 5,  8:00 PM EDT  <- her request
const STAY_DAYS = 3;

const show = (iso) => {
  const d = new Date(iso);
  return `${iso}  | SLT ${d.toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` +
         `  | EDT ${d.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
};

(async () => {
  const c = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const res = await c.query("SELECT data FROM bookings WHERE id = $1", [BOOKING_ID]);
  if (!res.rows.length) throw new Error(`${BOOKING_ID} not found`);
  const d = res.rows[0].data;

  console.log("################ BEFORE ################");
  console.log("  status              ", d.status);
  console.log("  earlyAccessStartsAt ", show(d.earlyAccessStartsAt));
  console.log("  stayStartsAt        ", show(d.stayStartsAt));
  console.log("  checkoutDueAt       ", show(d.checkoutDueAt));
  console.log("  stayDays            ", d.stayDays, `(${d.stayDaysSource})`);

  d.status = "approved";                 // was reverted to payment_marked after approval
  d.earlyAccessStartsAt = EARLY_ISO;
  d.stayStartsAt = CHECKIN_ISO;
  d.checkoutDueAt = CHECKOUT_ISO;
  d.stayDays = STAY_DAYS;
  d.stayDaysSource = "staff_set";        // no longer a silent full-week default
  d.updatedAt = new Date().toISOString();

  await c.query("UPDATE bookings SET data = $2 WHERE id = $1", [BOOKING_ID, d]);

  const after = (await c.query("SELECT data FROM bookings WHERE id = $1", [BOOKING_ID])).rows[0].data;
  await c.end();

  console.log("\n################ AFTER (re-read from Neon) ################");
  console.log("  status              ", after.status);
  console.log("  earlyAccessStartsAt ", show(after.earlyAccessStartsAt));
  console.log("  stayStartsAt        ", show(after.stayStartsAt));
  console.log("  checkoutDueAt       ", show(after.checkoutDueAt));
  console.log("  stayDays            ", after.stayDays, `(${after.stayDaysSource})`);

  // Lifecycle stage check — she must NOT read as already aboard.
  const now = Date.now();
  const stage = (() => {
    const st = String(after.status || "").toLowerCase();
    if (st === "checked_out" || st === "expired") return st;
    if (!after.approvedAt) return st || "submitted";
    if (now >= Date.parse(after.checkoutDueAt)) return "checkout_due";
    if (now >= Date.parse(after.stayStartsAt)) return "active_cruise";
    if (after.checkedInAt) return "checked_in";
    if (now >= Date.parse(after.earlyAccessStartsAt)) return "early_arrival_open";
    return "approved";
  })();
  console.log(`\n  lifecycle stage now: ${stage}  ${stage === "approved" ? "✅ upcoming, stay has NOT started" : "⚠️ check this"}`);
  console.log("\n✅ Backend updated. No messages sent.");
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
