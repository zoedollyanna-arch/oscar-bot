# 🚀 Follow-Up System Deployment Checklist

## Pre-Deployment

### ✅ Environment Setup
- [ ] Add `OSCAR_OPERATIONS_CHANNEL_ID` to `.env` file
- [ ] Verify channel ID is correct (right-click → Copy Channel ID)
- [ ] Confirm Oscar has permission to post in `#academy-operations`
- [ ] Check that CSV files are in the root directory:
  - [ ] `_🎓Lifeline Academy (Teacher & Staff Application) (Responses) - Form Responses 1.csv`
  - [ ] `Lifeline Academy Enrollment Application (Daycare • Elementary • High School)  (Responses) - Form Responses 1.csv`

### ✅ Dependencies
- [ ] Verify `discord.js` version is ^14.16.0 or higher
- [ ] Confirm all imports are available:
  - [ ] `ModalBuilder`
  - [ ] `TextInputBuilder`
  - [ ] `TextInputStyle`

### ✅ Permissions Check
- [ ] Oscar has "Send Messages" in `#academy-operations`
- [ ] Oscar has "Embed Links" in `#academy-operations`
- [ ] Oscar can send DMs to server members
- [ ] Staff roles are properly configured (`OSCAR_TEACHER_ROLE_ID`, `OSCAR_ADMIN_ROLE_ID`)

---

## Deployment Steps

### 1. Stop the Bot
```bash
# If running
Ctrl + C
```

### 2. Update Code
```bash
# Already done - code is in index.js
# No additional files to copy
```

### 3. Install Dependencies (if needed)
```bash
npm install
```

### 4. Verify Environment
```bash
# Check .env file contains:
OSCAR_OPERATIONS_CHANNEL_ID=YOUR_CHANNEL_ID
```

### 5. Start the Bot
```bash
npm start
```

### 6. Verify Startup
Look for these logs:
```
✅ Oscar logged in as Oscar#XXXX
✅ Oscar commands registered (guild scope)
🦉 Oscar is online. Lifeline Academy systems ready.
```

---

## Post-Deployment Testing

### ✅ Test 1: Config Check
```bash
/oscar config
```
**Expected:** Should show `OSCAR_OPERATIONS_CHANNEL_ID` in the list

### ✅ Test 2: Teacher Follow-Up
```bash
# First, register a test user
/academy register-discord type:teacher sl_username:TestUser user:@YourTestAccount

# Then send follow-up
/academy followup teacher @YourTestAccount
```

**Expected:**
1. ✅ Bot responds: "Follow-up DM sent to..."
2. ✅ Test user receives DM with button
3. ✅ Clicking button opens modal with 5 fields
4. ✅ Submitting modal posts to `#academy-operations`

### ✅ Test 3: Student Follow-Up (Signature)
```bash
/academy followup student @YourTestAccount type:signature
```

**Expected:**
1. ✅ Bot responds: "Follow-up DM (signature) sent to..."
2. ✅ Test user receives DM with button
3. ✅ Modal has 4 fields (student name, parent name, signature, agreement)
4. ✅ Submission logs to `#academy-operations`

### ✅ Test 4: Student Follow-Up (Confirm)
```bash
/academy followup student @YourTestAccount type:confirm
```

**Expected:**
1. ✅ Bot responds: "Follow-up DM (confirm) sent to..."
2. ✅ Modal has 5 fields (student name, age, parent name, confirm, notes)
3. ✅ Submission logs to `#academy-operations`

### ✅ Test 5: Auto-Scan
```bash
/academy followup student_auto
```

**Expected:**
1. ✅ Bot scans CSV file
2. ✅ Reports number of follow-ups sent
3. ✅ Only sends to users with missing signatures
4. ✅ Logs each send to Oscar log channel

---

## Troubleshooting Guide

### Issue: "ENV missing: OSCAR_OPERATIONS_CHANNEL_ID"
**Solution:**
1. Open `.env` file
2. Add: `OSCAR_OPERATIONS_CHANNEL_ID=YOUR_CHANNEL_ID`
3. Restart bot

### Issue: "Could not find teacher application"
**Cause:** User not in CSV or discord_id not set  
**Solution:**
```bash
/academy register-discord type:teacher sl_username:Username user:@User
```

### Issue: "Failed to DM user"
**Cause:** User has DMs disabled  
**Solution:**
1. Ask user to enable DMs:
   - Server icon → Privacy Settings → Direct Messages (ON)
2. Try again

### Issue: Modal not appearing
**Cause:** Discord.js version too old  
**Solution:**
```bash
npm install discord.js@^14.16.0
npm start
```

### Issue: Nothing logs to #academy-operations
**Checks:**
1. ✅ `OSCAR_OPERATIONS_CHANNEL_ID` is set correctly
2. ✅ Channel exists and bot can see it
3. ✅ Bot has "Send Messages" and "Embed Links" permissions
4. ✅ Channel is a text channel (not forum/announcement)

### Issue: CSV not found
**Cause:** File name doesn't match exactly  
**Solution:**
```bash
# Verify these exact file names:
_🎓Lifeline Academy (Teacher & Staff Application) (Responses) - Form Responses 1.csv
Lifeline Academy Enrollment Application (Daycare • Elementary • High School)  (Responses) - Form Responses 1.csv
```

---

## Rollback Plan

If something goes wrong:

### 1. Stop the Bot
```bash
Ctrl + C
```

### 2. Check Git History
```bash
git log --oneline
git diff HEAD~1
```

### 3. Revert if Needed
```bash
git checkout HEAD~1 index.js
npm start
```

### 4. Report Issues
- Check console logs for errors
- Verify all env variables are set
- Test with a minimal command first

---

## Monitoring

### Daily Checks
- [ ] `#academy-operations` is receiving logs
- [ ] Follow-up DMs are being delivered
- [ ] Modal submissions are working
- [ ] No errors in console logs

### Weekly Review
- [ ] Check number of follow-ups sent
- [ ] Review submission completion rate
- [ ] Identify users with DM delivery issues
- [ ] Clean up old logs if needed

---

## Success Criteria

✅ **System is working if:**
1. Staff can send follow-ups without errors
2. Users receive DMs with working buttons
3. Modals appear and accept submissions
4. All submissions log to `#academy-operations`
5. Embeds are formatted correctly
6. Auto-scan works for bulk operations

---

## Support Resources

- **Documentation:**
  - [FOLLOWUP_SYSTEM.md](FOLLOWUP_SYSTEM.md) - Technical details
  - [COMMANDS_REFERENCE.md](COMMANDS_REFERENCE.md) - Command guide
  - [ENV_SETUP.md](ENV_SETUP.md) - Environment setup

- **Quick Commands:**
  - `/oscar help` - Show Oscar help
  - `/oscar config` - Show current config
  - `/academy followup` - Start follow-up workflow

- **Logs to Check:**
  - Console output (bot terminal)
  - `#academy-operations` (follow-up logs)
  - Oscar log channel (`OSCAR_LOG_CHANNEL_ID`)

---

## Next Steps After Deployment

1. **✅ Train Staff**
   - Share [COMMANDS_REFERENCE.md](COMMANDS_REFERENCE.md)
   - Demo the follow-up workflow
   - Practice with test accounts

2. **✅ Update Procedures**
   - Add follow-up step to application workflow
   - Document when to use each follow-up type
   - Set response time expectations

3. **✅ Monitor Usage**
   - Track follow-up completion rates
   - Identify common issues
   - Gather staff feedback

4. **✅ Optimize**
   - Adjust modal questions if needed
   - Refine role detection logic
   - Add more automation as needed

---

## Deployment Complete! 🎉

Once all checkboxes are complete:
- ✅ Follow-up system is live
- ✅ Staff can start using commands
- ✅ Logs are being tracked
- ✅ Documentation is available

**Questions?** Check the docs or test with a staff member first!
