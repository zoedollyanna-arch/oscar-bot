/* =================================================================================================
 *  Tammy Brightwood — Render backend (Second Life) client
 *  ------------------------------------------------------------------------------------------------
 *  Thin HTTP client for the Lifeline backend web service. Used for Second Life integration:
 *  looking up avatar/account status and notifying in-world systems. Every call is best-effort and
 *  returns { ok, ... } instead of throwing, so a backend outage never breaks a Discord interaction.
 *  Redelivery data itself lives in the SHARED Neon DB (store.js), not here.
 * ================================================================================================= */

const config = require("./config");

async function call(method, endpoint, body) {
  if (!config.BACKEND_URL) return { ok: false, error: "backend_not_configured" };
  const url = `${config.BACKEND_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(config.BACKEND_SECRET ? { "x-tammy-secret": config.BACKEND_SECRET } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      // Node 18+ global fetch; guard slow backends.
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
    });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!res.ok) return { ok: false, status: res.status, error: json.error || `http_${res.status}`, data: json };
    return { ok: true, status: res.status, data: json };
  } catch (e) {
    return { ok: false, error: e.name === "TimeoutError" ? "timeout" : e.message };
  }
}

// Look up an avatar's Lifeline account/status by SL username (best-effort).
function lookupAvatar(slUsername) {
  return call("GET", `/api/tammy/avatar?name=${encodeURIComponent(slUsername)}`);
}

// Tell the backend a redelivery has been approved by staff (backend may notify in-world relays).
function notifyRedelivery(payload) {
  return call("POST", "/api/tammy/redelivery/notify", payload);
}

// Health check.
function ping() {
  return call("GET", "/api/tammy/ping");
}

module.exports = { call, lookupAvatar, notifyRedelivery, ping };
