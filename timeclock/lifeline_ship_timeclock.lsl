// =============================================================================
//  Lifeline Island Paradise - Ship Timeclock
//  ----------------------------------------------------------------------------
//  EXACT mirror of DinoWorld timeclock at lsl/2_timeclock.lsl.
//  Touch -> menu: Clock In / Start Break / End Break / Clock Out /
//                 View Current Shift / View Estimated Pay
//  Set LOCATION_ID from `/staff timeclock create` on Discord.
//
//  REAL PRODUCTION VALUES (prefilled, no placeholders)
// =============================================================================

string BASE_URL    = "https://lifelinerp.com/api/staff";
string SECRET      = "LVbW9nMGvIuIsOOUIwF5qqgL9uiRzioW0FtdqFsDIPA";
string LOCATION_ID = "SHIP1"; // Set by /staff timeclock create on Discord

key gReq;
key gUser;
integer gListen;
integer gPendingMenu;

post(string path, string body)
{
    gReq = llHTTPRequest(BASE_URL + path,
        [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/json",
         HTTP_CUSTOM_HEADER, "X-Lifeline-Secret", SECRET], body);
}
get(string path)
{
    gReq = llHTTPRequest(BASE_URL + path,
        [HTTP_METHOD, "GET", HTTP_CUSTOM_HEADER, "X-Lifeline-Secret", SECRET], "");
}

string responseText(string body)
{
    string text = llJsonGetValue(body, ["text"]);
    if (text == JSON_INVALID || text == "")
    {
        text = llJsonGetValue(body, ["error"]);
    }
    if (text == JSON_INVALID) text = "";
    return text;
}

clockAction(string action)
{
    string body = llList2Json(JSON_OBJECT, [
        "action", action,
        "avatarUuid", (string)gUser,
        "locationId", LOCATION_ID,
        "region", llGetRegionName(),
        "parcel", llList2String(llGetParcelDetails(llGetPos(), [PARCEL_DETAILS_NAME]), 0),
        "deviceId", (string)llGetKey()
    ]);
    post("/clock", body);
}

showMenu()
{
    integer chan = -1 * (integer)llFrand(900000) - 1000;
    gListen = llListen(chan, "", gUser, "");
    llDialog(gUser, "🚢 Lifeline Island Paradise — Ship Timeclock",
        ["Clock In", "Clock Out", "Start Break", "End Break", "View Shift", "View Pay"], chan);
}

default
{
    state_entry()
    {
        llSetText("🚢 Ship Timeclock\nTouch to clock in/out", <0.4, 0.7, 1.0>, 1.0);
    }

    touch_start(integer n)
    {
        gUser = llDetectedKey(0);
        gPendingMenu = TRUE;
        get("/shift?avatarUuid=" + (string)gUser);
    }

    listen(integer chan, string nm, key id, string msg)
    {
        llListenRemove(gListen);
        if (msg == "Clock In")        clockAction("clock_in");
        else if (msg == "Clock Out")  clockAction("clock_out");
        else if (msg == "Start Break")clockAction("break_start");
        else if (msg == "End Break")  clockAction("break_end");
        else if (msg == "View Shift")
            get("/shift?avatarUuid=" + (string)gUser);
        else if (msg == "View Pay")
            get("/pay-summary?avatarUuid=" + (string)gUser);
    }

    http_response(key id, integer status, list meta, string body)
    {
        if (id != gReq) return;
        if (gPendingMenu)
        {
            gPendingMenu = FALSE;
            if (status == 403)
            {
                string detail403 = responseText(body);
                if (detail403 == "") detail403 = "Your avatar UUID is not linked in the staff database.";
                llInstantMessage(gUser, "🚢 Ship Timeclock: inactive. " + detail403);
                return;
            }
            if (status < 200 || status >= 300)
            {
                string detail = responseText(body);
                if (status == 401) detail = "The timeclock object secret does not match the bot. Ask management to update the object configuration.";
                if (detail == "") detail = "Unavailable right now. Please try again later.";
                llInstantMessage(gUser, "� Ship Timeclock: " + detail);
                return;
            }
            showMenu();
            return;
        }
        string text = responseText(body);
        if (text == "") text = body;
        llInstantMessage(gUser, "🚢 Ship Timeclock: " + text);
    }
}
