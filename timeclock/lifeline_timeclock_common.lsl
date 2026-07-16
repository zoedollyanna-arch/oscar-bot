// ============================================================================
// Lifeline Island Paradise — TimeClock Common Library
// ============================================================================
// Shared constants and functions used by both Ship and Island timeclocks.
// Drop this into a prim's Other Scripts folder or paste inline.
// ============================================================================

// ── REAL PRODUCTION VALUES (prefilled, no placeholders) ──
string BACKEND_URL = "https://lifeline-backend-dfdv.onrender.com";
string BACKEND_SECRET = ""; // Set via LIFELINE_BACKEND_SECRET on Render — not currently configured in .env
integer LISTEN_CHANNEL = -9123456;  // Private channel for debug/commands
integer HTTP_TIMEOUT = 15;          // Seconds before HTTP request times out
float  REFRESH_INTERVAL = 60.0;     // How often to re-check status (seconds)

// ── Timeclock location keys (match timeclock_locations table keyCol) ──
string LOCATION_SHIP   = "lifeline_ship";
string LOCATION_ISLAND = "lifeline_island";

// ── Timeclock status values ──
string STATUS_CLOCKED_IN  = "clocked_in";
string STATUS_CLOCKED_OUT = "clocked_out";
string STATUS_BREAK       = "on_break";

// ============================================================================
// HTTP helpers — POST to the Render backend
// ============================================================================
string jsonValue(string json, string key) {
    // Simple JSON extractor for known response shapes.
    // { "ok": true, "data": { "status": "clocked_in", ... } }
    integer start = llSubStringIndex(json, "\"" + key + "\"");
    if (start == -1) return "";
    start = llSubStringIndex(llGetSubString(json, start + llStringLength(key) + 2, -1), ":");
    if (start == -1) return "";
    start += llStringLength(key) + 2;
    string raw = llGetSubString(json, start, -1);
    raw = llStringTrim(raw, STRING_TRIM_LEADING);
    // Strip quotes if value is a string
    if (llGetSubString(raw, 0, 0) == "\"") {
        raw = llGetSubString(raw, 1, -1);
        integer end = llSubStringIndex(raw, "\"");
        if (end != -1) raw = llGetSubString(raw, 0, end - 1);
    }
    // Strip trailing comma/brace
    integer comma = llSubStringIndex(raw, ",");
    integer brace = llSubStringIndex(raw, "}");
    integer bracket = llSubStringIndex(raw, "]");
    integer firstEnd = comma;
    if (brace != -1 && (firstEnd == -1 || brace < firstEnd)) firstEnd = brace;
    if (bracket != -1 && (firstEnd == -1 || bracket < firstEnd)) firstEnd = bracket;
    if (firstEnd != -1) raw = llGetSubString(raw, 0, firstEnd - 1);
    return llStringTrim(raw, STRING_TRIM);
}

string buildPayload(string endpoint, string body) {
    return llJsonSetValue("{}", ["endpoint"], endpoint) +
           "," + llJsonSetValue("{}", ["body"], body);
}

key sendRequest(string endpoint, string body, integer method) {
    // method: 0=GET, 1=POST
    string url = BACKEND_URL + endpoint;
    list headers = ["Content-Type", "application/json"];
    if (BACKEND_SECRET != "") {
        headers += ["x-tammy-secret", BACKEND_SECRET];
    }
    
    if (method == 0) {
        return llHTTPRequest(url, headers, "");
    } else {
        return llHTTPRequest(url, headers, body);
    }
}

// ============================================================================
// Clock in/out functions
// ============================================================================
key clockIn(string avatarUuid, string avatarName, string locationKey) {
    string body = llJsonSetValue("{}", 
        ["avatar_uuid", avatarUuid,
         "avatar_name", avatarName,
         "location", locationKey,
         "action", "clock_in",
         "region", llGetRegionName(),
         "position", (string)llGetPos()]);
    return sendRequest("/api/tammy/timeclock/clock", body, 1);
}

key clockOut(string avatarUuid, string avatarName, string locationKey) {
    string body = llJsonSetValue("{}",
        ["avatar_uuid", avatarUuid,
         "avatar_name", avatarName,
         "location", locationKey,
         "action", "clock_out",
         "region", llGetRegionName(),
         "position", (string)llGetPos()]);
    return sendRequest("/api/tammy/timeclock/clock", body, 1);
}

key checkStatus(string avatarUuid) {
    string endpoint = "/api/tammy/timeclock/status?avatar_uuid=" + llEscapeURL(avatarUuid);
    return sendRequest(endpoint, "", 0);
}

// ============================================================================
// Dialog builder — shows clock-in/out UI
// ============================================================================
string timeString() {
    return llGetTimestamp(); // ISO 8601 UTC
}

string formatStatus(string rawStatus) {
    if (rawStatus == STATUS_CLOCKED_IN) return "Clock Out";
    if (rawStatus == STATUS_CLOCKED_OUT) return "Clock In";
    if (rawStatus == STATUS_BREAK) return "End Break";
    return "Clock In"; // Default
}
