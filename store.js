/* =================================================================================================
 *  Tammy Brightwood — data store
 *  ------------------------------------------------------------------------------------------------
 *  Thin in-memory layer over the shared Neon Postgres (db.js). Everything Tammy persists lives in
 *  the same database the main Discord bot uses, so records round-trip losslessly and either bot can
 *  read them. All writes are best-effort; if Neon is down Tammy keeps working on the in-memory Maps.
 * ================================================================================================= */

const db = require("./db");
const { DEFAULT_FAQS } = require("./faqData");

// In-memory mirrors of each Neon store, keyed by record id.
const tickets = new Map();       // support_tickets
const redeliveries = new Map();  // tammy_redelivery_requests
const faqs = new Map();          // tammy_faqs
const announcements = new Map(); // tammy_announcements
const applications = new Map();  // tammy_applications

// Monotonic counters per prefix so ids stay unique + sortable (TCK00001, RDL00001, ...).
const counters = { TCK: 0, RDL: 0, FAQ: 0, ANN: 0, APP: 0, LOG: 0 };

function bump(prefix) {
  counters[prefix] = (counters[prefix] || 0) + 1;
  return `${prefix}${String(counters[prefix]).padStart(5, "0")}`;
}
function numPart(id) {
  const m = String(id || "").match(/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

async function init() {
  await db.init();

  await hydrate("support_tickets", tickets, "TCK");
  await hydrate("tammy_redelivery_requests", redeliveries, "RDL");
  await hydrate("tammy_faqs", faqs, "FAQ");
  await hydrate("tammy_announcements", announcements, "ANN");
  await hydrate("tammy_applications", applications, "APP");

  // Seed the FAQ knowledge base once so a fresh install answers common questions immediately.
  if (faqs.size === 0) {
    for (const f of DEFAULT_FAQS) {
      const id = bump("FAQ");
      const rec = { id, ...f, createdAt: new Date().toISOString(), builtin: true };
      faqs.set(id, rec);
      await db.upsertRow("tammy_faqs", id, rec);
    }
    console.log(`🌱 Seeded ${faqs.size} default FAQ entries.`);
  }

  console.log(
    `📚 Tammy store ready — tickets:${tickets.size} redeliveries:${redeliveries.size} ` +
      `faqs:${faqs.size} announcements:${announcements.size} applications:${applications.size}`
  );
}

async function hydrate(storeName, map, prefix) {
  const rows = await db.loadStore(storeName);
  for (const { key, data } of rows) {
    map.set(key, data);
    if (prefix) counters[prefix] = Math.max(counters[prefix] || 0, numPart(key));
  }
}

/* ───────────────────────────── Tickets ───────────────────────────── */
function newTicket(fields) {
  const id = bump("TCK");
  const rec = { id, status: "open", createdAt: new Date().toISOString(), ...fields };
  tickets.set(id, rec);
  db.upsertRow("support_tickets", id, rec);
  return rec;
}
function saveTicket(rec) {
  tickets.set(rec.id, rec);
  db.upsertRow("support_tickets", rec.id, rec);
  return rec;
}

/* ───────────────────────────── Redelivery ───────────────────────────── */
function newRedelivery(fields) {
  const id = bump("RDL");
  const rec = { id, status: "pending_review", createdAt: new Date().toISOString(), ...fields };
  redeliveries.set(id, rec);
  db.upsertRow("tammy_redelivery_requests", id, rec);
  return rec;
}
function saveRedelivery(rec) {
  redeliveries.set(rec.id, rec);
  db.upsertRow("tammy_redelivery_requests", rec.id, rec);
  return rec;
}

/* ───────────────────────────── FAQ ───────────────────────────── */
function newFaq(fields) {
  const id = bump("FAQ");
  const rec = { id, createdAt: new Date().toISOString(), ...fields };
  faqs.set(id, rec);
  db.upsertRow("tammy_faqs", id, rec);
  return rec;
}
function deleteFaq(id) {
  faqs.delete(id);
  db.deleteRow("tammy_faqs", id);
}

/* ───────────────────────────── Announcements ───────────────────────────── */
function newAnnouncement(fields) {
  const id = bump("ANN");
  const rec = { id, status: "scheduled", createdAt: new Date().toISOString(), ...fields };
  announcements.set(id, rec);
  db.upsertRow("tammy_announcements", id, rec);
  return rec;
}
function saveAnnouncement(rec) {
  announcements.set(rec.id, rec);
  db.upsertRow("tammy_announcements", rec.id, rec);
  return rec;
}
function deleteAnnouncement(id) {
  announcements.delete(id);
  db.deleteRow("tammy_announcements", id);
}

/* ───────────────────────────── Applications ───────────────────────────── */
function newApplication(fields) {
  const id = bump("APP");
  const rec = { id, status: "pending", createdAt: new Date().toISOString(), ...fields };
  applications.set(id, rec);
  db.upsertRow("tammy_applications", id, rec);
  return rec;
}
function saveApplication(rec) {
  applications.set(rec.id, rec);
  db.upsertRow("tammy_applications", rec.id, rec);
  return rec;
}

/* ───────────────────────────── Audit log ─────────────────────────────
 * Every interaction and staff action is recorded to Neon (the plan's "log every interaction").
 * Fire-and-forget so logging never blocks a reply. */
function logInteraction(type, data = {}) {
  const id = bump("LOG");
  const rec = { id, type, at: new Date().toISOString(), ...data };
  db.upsertRow("tammy_interactions", id, rec).catch(() => {});
  return rec;
}

module.exports = {
  init,
  tickets, redeliveries, faqs, announcements, applications,
  newTicket, saveTicket,
  newRedelivery, saveRedelivery,
  newFaq, deleteFaq,
  newAnnouncement, saveAnnouncement, deleteAnnouncement,
  newApplication, saveApplication,
  logInteraction,
};
