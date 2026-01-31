# Environment Variable Setup

## Required for Follow-Up System

Add this to your `.env` file:

```env
# Academy Operations Channel (for follow-up logs)
OSCAR_OPERATIONS_CHANNEL_ID=1234567890123456789
```

### How to Get the Channel ID

1. Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
2. Right-click the `#academy-operations` channel
3. Click "Copy Channel ID"
4. Paste it into your `.env` file

### Existing Variables (Already Configured)

These should already be in your `.env`:

```env
# Core
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_server_id

# Google Sheets (for applications)
STUDENT_SHEET_ID=your_student_sheet_id
TEACHER_SHEET_ID=your_teacher_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# Role IDs
OSCAR_ADMIN_ROLE_ID=1234567890123456789
OSCAR_TEACHER_ROLE_ID=1234567890123456789

# Other Channel IDs
OSCAR_LOG_CHANNEL_ID=1234567890123456789
OSCAR_ALLOWED_CATEGORY_IDS=1234567890123456789
```

## Complete `.env` Template

If you're starting fresh, here's the full template:

```env
# ============================================
# DISCORD BOT CREDENTIALS
# ============================================
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=

# ============================================
# GOOGLE SHEETS (Live Applications)
# ============================================
STUDENT_SHEET_ID=
TEACHER_SHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=

# ============================================
# CHANNEL IDS
# ============================================
OSCAR_ALLOWED_CATEGORY_IDS=
OSCAR_LOG_CHANNEL_ID=
OSCAR_WELCOME_CHANNEL_ID=
OSCAR_RULES_CHANNEL_ID=
OSCAR_ANNOUNCE_CHANNEL_ID=
OSCAR_CALENDAR_CHANNEL_ID=
OSCAR_HANDBOOK_CHANNEL_ID=
OSCAR_ENROLL_CHANNEL_ID=
OSCAR_STUDENT_LOUNGE_CHANNEL_ID=
OSCAR_PICTURES_CHANNEL_ID=
OSCAR_OPERATIONS_CHANNEL_ID=

# ============================================
# ROLE IDS
# ============================================
OSCAR_ADMIN_ROLE_ID=
OSCAR_TEACHER_ROLE_ID=
OSCAR_NURSE_ROLE_ID=

# ============================================
# OPTIONAL: ACADEMY LINKS
# ============================================
ACADEMY_HANDBOOK_URL=
ACADEMY_ENROLLMENT_URL=
ACADEMY_STUDENT_PORTAL_URL=
ACADEMY_TEACHER_PORTAL_URL=
ACADEMY_PARENT_PORTAL_URL=
ACADEMY_ADMIN_PORTAL_URL=

# ============================================
# OPTIONAL: DAILY SCHEDULERS
# ============================================
OSCAR_TIMEZONE=America/Los_Angeles
OSCAR_DAILY_BULLETIN_HOUR=8
OSCAR_DAILY_PROMPT_HOUR=9

# ============================================
# TICKET SYSTEM
# ============================================
OSCAR_TICKET_CATEGORY_ID=
OSCAR_TICKET_STAFF_ROLE_IDS=
OSCAR_TICKET_CHANNEL_PREFIX=academy-ticket

# ============================================
# WEB SERVICE (OPTIONAL)
# ============================================
PORT=3000
```

## Testing the Setup

After adding `OSCAR_OPERATIONS_CHANNEL_ID`:

1. Restart Oscar bot
2. Run `/oscar config` to verify the channel is detected
3. Test a follow-up: `/academy followup teacher @user`
4. Check `#academy-operations` for the log

## Troubleshooting

### Channel ID Not Working?
- Make sure it's just the numbers (no brackets or special characters)
- Verify Oscar has permission to post in that channel
- The channel should be a text channel (not voice/forum/announcement)

### Oscar Can't Read CSV Files?
- CSV files should be in the root directory: `c:\Users\Shadow\Desktop\oscar-bot\`
- File names must match exactly (including emoji)
- Check file encoding is UTF-8

### Google Sheets Not Updating?
- Verify service account has Editor access to both sheets
- Check `GOOGLE_PRIVATE_KEY` includes `\n` for newlines
- Confirm sheet IDs are from the URL (between `/d/` and `/edit`)

## Need Help?

Check Oscar's logs when starting:
```
✅ Oscar logged in as Oscar#1234
✅ Oscar commands registered (guild scope)
🦉 Oscar is online. Lifeline Academy systems ready.
```

If you see errors, check:
- All required environment variables are set
- Channel/Role IDs are valid
- Bot has proper permissions in Discord
