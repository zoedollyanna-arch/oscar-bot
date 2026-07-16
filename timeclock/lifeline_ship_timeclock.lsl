// ============================================================================
// Lifeline Island Paradise — Ship TimeClock Terminal
// ============================================================================
// Placed on the cruise ship parcel. Mirrors DinoWorld timeclock logic.
// SINGLE-FILE SCRIPT — contains all shared functions inline.
//
// DEPLOYMENT:
//   1. Create a prim on the ship parcel
//   2. Drop this script into it (single file, no includes needed)
//   3. Name the prim "Ship TimeClock Terminal"
//   4. Set the prim to touch and allow anyone to interact
// ============================================================================

// ── REAL PRODUCTION VALUES (prefilled) ──
string BACKEND_URL   = "https://lifeline-backend-dfdv.onrender.com";
string BACKEND_SECRET = ""; // LIFELINE_BACKEND_SECRET not configured in .env — set on Render dashboard if needed
integer LISTEN_CHANNEL = -9123456;
string LOCATION_KEY    = "lifeline_ship";
string TERMINAL_NAME   = "🚢 Lifeline Island Paradise — Ship TimeClock";
string WELCOME_TEXT    = "Welcome aboard the Lifeline Island Paradise Cruise Ship!\n\nTouch to clock in for your shift. Touch again to clock out.\nAll shifts logged for payroll.\n\n_Questions? Contact management._";

// Status constants (match backend)
string STATUS_CLOCKED_IN  = "clocked_in";
string STATUS_CLOCKED_OUT = "clocked_out";
string STATUS_BREAK       = "on_break";

vector COLOR_ACTIVE   = <0.0, 1.0, 0.5>;
vector COLOR_INACTIVE = <0.5, 0.7, 1.0>;
float  GLOW_ACTIVE    = 0.15;
float  GLOW_INACTIVE  = 0.05;

// ── State ──
string gOwnerName = "";
string gOwnerUUID = "";
key    gQueryID   = NULL_KEY;
key    gClockID   = NULL_KEY;

// ============================================================================
// Helpers — JSON extraction
// ============================================================================
string jsonValue(string json, string key) {
    integer start = llSubStringIndex(json, "\"" + key + "\"");
    if (start == -1) return "";
    start = llSubStringIndex(llGetSubString(json, start + llStringLength(key) + 2, -1), ":");
    if (start == -1) return "";
    start += llStringLength(key) + 2;
    string raw = llGetSubString(json, start, -1);
    raw = llStringTrim(raw, STRING_TRIM_LEADING);
    if (llGetSubString(raw, 0, 0) == "\"") {
        raw = llGetSubString(raw, 1, -1);
        integer end = llSubStringIndex(raw, "\"");
        if (end != -1) raw = llGetSubString(raw, 0, end - 1);
    }
    integer comma = llSubStringIndex(raw, ",");
    integer brace = llSubStringIndex(raw, "}");
    integer bracket = llSubStringIndex(raw, "]");
    integer firstEnd = comma;
    if (brace != -1 && (firstEnd == -1 || brace < firstEnd)) firstEnd = brace;
    if (bracket != -1 && (firstEnd == -1 || bracket < firstEnd)) firstEnd = bracket;
    if (firstEnd != -1) raw = llGetSubString(raw, 0, firstEnd - 1);
    return llStringTrim(raw, STRING_TRIM);
}

// ============================================================================
// HTTP helpers
// ============================================================================
key sendRequest(string endpoint, string body, integer method) {
    string url = BACKEND_URL + endpoint;
    list headers = ["Content-Type", "application/json"];
    if (BACKEND_SECRET != "")
        headers += ["x-tammy-secret", BACKEND_SECRET];
    if (method == 0)
        return llHTTPRequest(url, headers, "");
    else
        return llHTTPRequest(url, headers, body);
}

key clockIn(string avatarUuid, string avatarName) {
    string body = llJsonSetValue("{}",
        ["avatar_uuid", avatarUuid,
         "avatar_name", avatarName,
         "location", LOCATION_KEY,
         "action", "clock_in",
         "region", llGetRegionName(),
         "position", (string)llGetPos()]);
    return sendRequest("/api/tammy/timeclock/clock", body, 1);
}

key clockOut(string avatarUuid, string avatarName) {
    string body = llJsonSetValue("{}",
        ["avatar_uuid", avatarUuid,
         "avatar_name", avatarName,
         "location", LOCATION_KEY,
         "action", "clock_out",
         "region", llGetRegionName(),
         "position", (string)llGetPos()]);
    return sendRequest("/api/tammy/timeclock/clock", body, 1);
}

key checkStatus(string avatarUuid) {
    return sendRequest("/api/tammy/timeclock/status?avatar_uuid=" + llEscapeURL(avatarUuid), "", 0);
}

// ============================================================================
// Main
// ============================================================================
default {
    state_entry() {
        llSetText(TERMINAL_NAME, COLOR_INACTIVE, 1.0);
        llSetPrimitiveParams([PRIM_GLOW, ALL_SIDES, GLOW_INACTIVE]);
        llSetObjectName(TERMINAL_NAME);
        llSay(0, "🕐 Ship TimeClock ready. Touch to clock in/out.");
        llListen(LISTEN_CHANNEL, "", NULL_KEY, "");
    }

    on_rez(integer start) { llResetScript(); }

    touch_start(integer total_number) {
        key toucher = llDetectedKey(0);
        string toucherName = llDetectedName(0);

        if (toucher == llGetOwner()) {
            llDialog(toucher,
                "🛳️ Ship TimeClock\n\n" + WELCOME_TEXT,
                ["Clock In", "Clock Out", "Check Status", "Close"],
                LISTEN_CHANNEL);
            return;
        }

        llInstantMessage(toucher, "⏳ Checking your current shift status...");
        gQueryID = checkStatus((string)toucher);
        gOwnerUUID = (string)toucher;
        gOwnerName = toucherName;
    }

    listen(integer channel, string name, key id, string message) {
        if (channel != LISTEN_CHANNEL || id != llGetOwner()) return;

        if (message == "Clock In" || message == "Clock Out") {
            gQueryID = checkStatus((string)id);
            gOwnerUUID = (string)id;
            gOwnerName = name;
            llOwnerSay("⏳ Checking status...");
        } else if (message == "Check Status") {
            gQueryID = checkStatus((string)id);
            gOwnerUUID = (string)id;
            gOwnerName = name;
        }
    }

    http_response(key request_id, integer status, list metadata, string body) {
        if (request_id == gQueryID) {
            if (status != 200) {
                llInstantMessage(gOwnerUUID, "⚠️ Status check failed (HTTP " + (string)status + "). Try again.");
                return;
            }
            string ok = jsonValue(body, "ok");
            if (ok != "true" && ok != "1") {
                llInstantMessage(gOwnerUUID, "⚠️ Backend error: " + jsonValue(body, "error"));
                return;
            }
            string currentStatus = jsonValue(body, "status");
            if (currentStatus == STATUS_CLOCKED_IN) {
                llInstantMessage(gOwnerUUID, "✅ You're clocked in. Clocking you out...");
                gClockID = clockOut(gOwnerUUID, gOwnerName);
            } else {
                llInstantMessage(gOwnerUUID, "⏳ Clocking you in...");
                gClockID = clockIn(gOwnerUUID, gOwnerName);
            }
            return;
        }

        if (request_id == gClockID) {
            if (status != 200) {
                llInstantMessage(gOwnerUUID, "⚠️ TimeClock action failed (HTTP " + (string)status + ").");
                return;
            }
            string ok = jsonValue(body, "ok");
            string action = jsonValue(body, "action");
            if (ok == "true" || ok == "1") {
                if (action == "clock_in") {
                    llInstantMessage(gOwnerUUID, "✅ **Clocked In!** 🕐 Shift logged. Have a great shift! 💙");
                    llSetText(TERMINAL_NAME + " (ACTIVE)", COLOR_ACTIVE, 1.0);
                    llSetPrimitiveParams([PRIM_GLOW, ALL_SIDES, GLOW_ACTIVE]);
                } else if (action == "clock_out") {
                    llInstantMessage(gOwnerUUID, "✅ **Clocked Out!** 🕐 Shift ended. Hours logged. 💙");
                    llSetText(TERMINAL_NAME, COLOR_INACTIVE, 1.0);
                    llSetPrimitiveParams([PRIM_GLOW, ALL_SIDES, GLOW_INACTIVE]);
                } else {
                    llInstantMessage(gOwnerUUID, "✅ TimeClock: " + action);
                }
            } else {
                llInstantMessage(gOwnerUUID, "⚠️ Error: " + jsonValue(body, "error"));
            }
        }
    }
}
