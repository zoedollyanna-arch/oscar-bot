/* =================================================================================================
 *  Lifeline Island Paradise — TimeClock API Endpoints
 *  ------------------------------------------------------------------------------------------------
 *  Backend endpoints called by the in-world LSL timeclock terminals. Mirrors the DinoWorld
 *  timeclock logic using the shared Neon database tables (staff_shifts, timeclock_locations).
 *
 *  Endpoints:
 *    POST /api/tammy/timeclock/clock   — Clock in / out / break
 *    GET  /api/tammy/timeclock/status  — Check current shift status for an avatar
 *    GET  /api/tammy/timeclock/health  — TimeClock service health
 * ================================================================================================= */

const config = require("./config");
const db = require("./db");

// Location keys
const LOCATIONS = {
  lifeline_ship: { name: "Lifeline Island Paradise Cruise Ship", type: "ship" },
  lifeline_island: { name: "Lifeline Island Paradise Island Destination", type: "island" },
};

// Status values (must match LSL constants)
const STATUS = {
  CLOCKED_IN: "clocked_in",
  CLOCKED_OUT: "clocked_out",
  ON_BREAK: "on_break",
};

/**
 * Validate the shared secret from incoming HTTP requests.
 * Returns true if the request is authorized (either secret matches or no secret configured).
 */
function isAuthorized(req) {
  if (!config.BACKEND_SECRET) return true; // No secret configured → accept all
  const provided = req.headers["x-tammy-secret"] || req.headers["x-lifeline-secret"] || "";
  return provided === config.BACKEND_SECRET;
}

/**
 * Parse the request body as JSON.
 */
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

/**
 * Send a JSON response.
 */
function json(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

/**
 * ── POST /api/tammy/timeclock/clock ──────────────────────────────────────
 *  Body: { avatar_uuid, avatar_name, location, action, region, position }
 *  Actions: "clock_in", "clock_out", "break_start", "break_end"
 *
 *  Mirrors DinoWorld timeclock logic:
 *    1. Find active shift for this avatar (if any)
 *    2. Apply the action (start shift / end shift / start break / end break)
 *    3. Record in staff_shifts table
 * ──────────────────────────────────────────────────────────────────────────
 */
async function handleClock(req, res) {
  if (!isAuthorized(req)) return json(res, 403, { ok: false, error: "unauthorized" });

  let body;
  try { body = await parseBody(req); }
  catch { return json(res, 400, { ok: false, error: "invalid_json" }); }

  const { avatar_uuid, avatar_name, location, action, region, position } = body;
  if (!avatar_uuid || !location || !action) {
    return json(res, 400, { ok: false, error: "missing_required_fields", required: ["avatar_uuid", "location", "action"] });
  }

  // Validate location
  const loc = LOCATIONS[location];
  if (!loc) {
    return json(res, 400, { ok: false, error: "invalid_location", valid_locations: Object.keys(LOCATIONS) });
  }

  // Validate action
  const validActions = ["clock_in", "clock_out", "break_start", "break_end"];
  if (!validActions.includes(action)) {
    return json(res, 400, { ok: false, error: "invalid_action", valid_actions: validActions });
  }

  try {
    if (!db.isReady()) return json(res, 503, { ok: false, error: "database_not_ready" });

    // 1. Find any active shift for this avatar
    const activeShift = await findActiveShift(avatar_uuid);

    // 2. Apply the action
    let result;
    switch (action) {
      case "clock_in":
        if (activeShift) {
          // Already clocked in somewhere — clock out first, then clock in at new location
          await closeShift(activeShift.id, avatar_uuid, "auto_clock_out");
          result = await createShift(avatar_uuid, avatar_name, location, region, position);
        } else {
          result = await createShift(avatar_uuid, avatar_name, location, region, position);
        }
        break;

      case "clock_out":
        if (!activeShift) {
          return json(res, 400, { ok: false, error: "not_clocked_in" });
        }
        await closeShift(activeShift.id, avatar_uuid, "clock_out");
        result = { status: STATUS.CLOCKED_OUT, shift_id: activeShift.id, action: "clock_out" };
        break;

      case "break_start":
        if (!activeShift) {
          return json(res, 400, { ok: false, error: "not_clocked_in" });
        }
        await updateShiftStatus(activeShift.id, STATUS.ON_BREAK);
        result = { status: STATUS.ON_BREAK, shift_id: activeShift.id, action: "break_start" };
        break;

      case "break_end":
        if (!activeShift || activeShift.status !== STATUS.ON_BREAK) {
          return json(res, 400, { ok: false, error: "not_on_break" });
        }
        await updateShiftStatus(activeShift.id, STATUS.CLOCKED_IN);
        result = { status: STATUS.CLOCKED_IN, shift_id: activeShift.id, action: "break_end" };
        break;
    }

    return json(res, 200, { ok: true, ...result });
  } catch (error) {
    console.error("timeclock clock error:", error.message);
    return json(res, 500, { ok: false, error: error.message });
  }
}

/**
 * ── GET /api/tammy/timeclock/status ──────────────────────────────────────
 *  Query: ?avatar_uuid=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *
 *  Returns the current shift status for the given avatar.
 *  If no active shift, returns clocked_out state.
 * ──────────────────────────────────────────────────────────────────────────
 */
async function handleStatus(req, res) {
  if (!isAuthorized(req)) return json(res, 403, { ok: false, error: "unauthorized" });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const avatarUuid = url.searchParams.get("avatar_uuid");
  if (!avatarUuid) {
    return json(res, 400, { ok: false, error: "missing_avatar_uuid" });
  }

  try {
    if (!db.isReady()) return json(res, 503, { ok: false, error: "database_not_ready" });

    const activeShift = await findActiveShift(avatarUuid);

    if (activeShift) {
      const data = activeShift.data || {};
      return json(res, 200, {
        ok: true,
        status: activeShift.status || STATUS.CLOCKED_IN,
        location: data.location || "",
        destination: data.location === "lifeline_island" ? (data.destination_name || "Island Destination") : "Cruise Ship",
        shift_id: activeShift.id,
        clocked_in_at: data.clocked_in_at || activeShift.updated_at,
        duration_minutes: data.clocked_in_at ? Math.floor((Date.now() - new Date(data.clocked_in_at).getTime()) / 60000) : 0,
      });
    }

    return json(res, 200, {
      ok: true,
      status: STATUS.CLOCKED_OUT,
      location: "",
      shift_id: null,
    });
  } catch (error) {
    console.error("timeclock status error:", error.message);
    return json(res, 500, { ok: false, error: error.message });
  }
}

/**
 * ── GET /api/tammy/timeclock/health ──────────────────────────────────────
 *  Simple health check for the timeclock subsystem.
 * ──────────────────────────────────────────────────────────────────────────
 */
async function handleHealth(req, res) {
  return json(res, 200, {
    ok: true,
    service: "timeclock",
    locations: Object.keys(LOCATIONS),
    database: db.isReady(),
  });
}

/* ───────────────────────────── Helpers ───────────────────────────── */

/**
 * Find the active shift (clocked_in or on_break) for an avatar.
 * staff_shifts stores data as JSONB with key = shift id.
 */
async function findActiveShift(avatarUuid) {
  // Since staff_shifts is a JSONB store (keyCol: "id"), we need to scan
  // for records where the JSONB data contains this avatar_uuid and status is active.
  const result = await db.query(
    `SELECT id, data, updated_at FROM staff_shifts
     WHERE data->>'avatar_uuid' = $1
       AND (data->>'status' = $2 OR data->>'status' = $3)
     ORDER BY updated_at DESC LIMIT 1`,
    [avatarUuid, STATUS.CLOCKED_IN, STATUS.ON_BREAK]
  );
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    status: row.data.status,
    data: row.data,
    updated_at: row.updated_at,
  };
}

/**
 * Create a new shift (clock in).
 */
async function createShift(avatarUuid, avatarName, location, region, position) {
  // Generate a human-readable shift ID
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  const shiftId = `SHIP-${timestamp}${random}`;

  const data = {
    avatar_uuid: avatarUuid,
    avatar_name: avatarName || "Unknown",
    location,
    location_name: LOCATIONS[location]?.name || location,
    status: STATUS.CLOCKED_IN,
    clocked_in_at: new Date().toISOString(),
    clocked_out_at: null,
    region: region || "",
    position: position || "",
    break_start: null,
    break_total_minutes: 0,
    notes: "",
  };

  await db.query(
    `INSERT INTO staff_shifts (id, data, updated_at) VALUES ($1, $2::jsonb, now())`,
    [shiftId, data]
  );

  return {
    status: STATUS.CLOCKED_IN,
    shift_id: shiftId,
    action: "clock_in",
    location,
    location_name: LOCATIONS[location]?.name || location,
  };
}

/**
 * Close a shift (clock out).
 */
async function closeShift(shiftId, avatarUuid, actionType) {
  const now = new Date().toISOString();
  await db.query(
    `UPDATE staff_shifts SET data = jsonb_set(
       jsonb_set(data, '{status}', $1::jsonb),
       '{clocked_out_at}', $2::jsonb
     ), updated_at = now() WHERE id = $3`,
    [JSON.stringify(STATUS.CLOCKED_OUT), JSON.stringify(now), shiftId]
  );
}

/**
 * Update shift status (e.g., break_start / break_end).
 */
async function updateShiftStatus(shiftId, newStatus) {
  await db.query(
    `UPDATE staff_shifts SET data = jsonb_set(data, '{status}', $1::jsonb), updated_at = now() WHERE id = $2`,
    [JSON.stringify(newStatus), shiftId]
  );
}

/* ───────────────────────────── Router ───────────────────────────── */

/**
 * Route incoming HTTP requests to the appropriate handler.
 * Called from the main HTTP server in index.js.
 * Returns true if the request was handled, false if not (pass-through to other handlers).
 */
async function handleRequest(req, res) {
  const method = req.method;
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  } catch {
    return false;
  }

  const path = url.pathname;

  // Clock in/out
  if (method === "POST" && path === "/api/tammy/timeclock/clock") {
    await handleClock(req, res);
    return true;
  }

  // Status check
  if (method === "GET" && path === "/api/tammy/timeclock/status") {
    await handleStatus(req, res);
    return true;
  }

  // Health check
  if (method === "GET" && path === "/api/tammy/timeclock/health") {
    await handleHealth(req, res);
    return true;
  }

  return false;
}

module.exports = { handleRequest, LOCATIONS, STATUS };
