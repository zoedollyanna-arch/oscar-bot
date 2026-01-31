# 🎓 Academy Follow-Up Commands – Quick Reference

## Staff Commands

### Teacher/Staff Follow-Ups

```
/academy followup teacher @DiscordUser
```
**What it does:**
- Looks up teacher application
- Detects roles (Culinary, Elementary, High School, etc.)
- Sends DM with follow-up modal
- Logs responses to #academy-operations

**Example:**
```
/academy followup teacher @RaéLynn
```

---

### Student Follow-Ups

#### Missing Signature
```
/academy followup student @ParentUser type:signature
```
**What it does:**
- Sends signature completion modal
- Records digital signature
- Logs to #academy-operations

#### Confirm Information/Age
```
/academy followup student @ParentUser type:confirm
```
**What it does:**
- Sends information verification modal
- Confirms student age and details
- Logs to #academy-operations

#### Auto-Scan (Bulk Send)
```
/academy followup student_auto
```
**What it does:**
- Scans entire student enrollment CSV
- Finds all students with missing signatures
- Automatically sends DMs to all affected parents
- Reports how many were sent

**Example Output:**
```
✅ Auto-scan complete. Sent 3 follow-up(s).
```

---

## User Experience Flow

### For Teachers
1. **Staff runs:** `/academy followup teacher @Teacher`
2. **Teacher receives DM:**
   ```
   🎓 Lifeline Academy – Follow-Up Required
   
   Hello Teacher!
   
   We're excited about your application! To complete your placement 
   process, please click the button below and fill out the follow-up form.
   ```
3. **Teacher clicks:** `Complete Follow-Up` button
4. **Modal appears with fields:**
   - Primary Role This Term
   - Workshops You'd Like to Teach or Assist
   - SL / Creative / Tech Skills
   - Weekly Availability
   - LEEP Growth Goal
5. **Teacher submits → Confirmation:**
   ```
   ✅ Thank you! Your follow-up has been submitted and logged.
   ```

### For Students/Parents
1. **Staff runs:** `/academy followup student @Parent type:signature`
2. **Parent receives DM:**
   ```
   🖊️ Lifeline Academy – Enrollment Completion
   
   Hello!
   
   We're almost done with your enrollment! We need your digital 
   signature to complete the process.
   ```
3. **Parent clicks:** `Complete Follow-Up` button
4. **Modal appears with fields:**
   - Student Full Name
   - Parent / Guardian Full Name
   - Digital Signature (Type Full Name)
   - Confirm Agreement to Academy Policies
5. **Parent submits → Confirmation:**
   ```
   ✅ Thank you! Your signature has been recorded and enrollment 
   is being finalized.
   ```

---

## What Gets Logged?

### Teacher Follow-Up Log
**Posted to:** `#academy-operations`

```
🎓 Teacher Follow-Up Submitted

Applicant: Teacher#1234 (123456789012345678)
Primary Role: Elementary Teacher
Workshop Interest: Photography, Art Club
Tech Skills: Photoshop, Lightroom, basic scripting
Availability: Monday-Friday, 3-6pm EST
LEEP Goal: Improve lesson structure and classroom management
Status: ✅ Follow-Up Complete
```

### Student Follow-Up Log
**Posted to:** `#academy-operations`

```
🎒 Student Enrollment Update Submitted

Student Name: Skylar Majesty Kardash
Parent/Guardian: Kouture Kardash
Update Type: Digital Signature
Agreement: ✅ Confirmed
Timestamp: 2026-01-30T15:30:45.123Z
Logged For: Records & Receipts
```

---

## Role Detection (Automatic)

Oscar automatically detects these roles from the "Positions Applying For" column:

| **Application Contains** | **Detected As** |
|--------------------------|----------------|
| "Culinary" | Culinary Instructor |
| "Elementary" | Elementary Teacher |
| "High School" | Secondary Teacher |
| "School Counselor" | Counselor |
| "Office / Administrative" | Admin Support |
| "Daycare" | Daycare Caregiver |
| **Multiple roles** | Combined/Workshop |

---

## Permissions Required

All `/academy followup` commands require:
- ✅ Teacher Role
- ✅ Admin Role
- ✅ Administrator Permission

---

## Troubleshooting

### ❌ "Could not find teacher application"
**Solution:** Register the user first
```
/academy register-discord type:teacher sl_username:Username user:@User
```

### ❌ "Failed to DM user"
**Cause:** User has DMs disabled  
**Solution:** Ask user to:
1. Right-click server icon
2. Privacy Settings
3. Enable "Direct Messages"

### ❌ "No matching SL username found"
**Cause:** User hasn't applied yet or wrong username  
**Solution:** 
- Check spelling of SL username
- Verify they completed the application form
- Check the CSV file for their entry

---

## Quick Commands Summary

```bash
# Teacher follow-up
/academy followup teacher @User

# Student signature
/academy followup student @Parent type:signature

# Student confirm age/info
/academy followup student @Parent type:confirm

# Auto-send to all missing signatures
/academy followup student_auto

# Check configuration
/oscar config

# View all academy commands
/oscar help
```

---

## Best Practices

1. **✅ Always register Discord IDs first**
   ```
   /academy register-discord type:teacher sl_username:Username user:@User
   ```

2. **✅ Check application status before follow-up**
   ```
   /academy teacher-status sl_username:Username
   ```

3. **✅ Use auto-scan for bulk operations**
   - More efficient than individual commands
   - Automatically skips users who already signed

4. **✅ Monitor #academy-operations**
   - All submissions log there
   - Real-time compliance tracking
   - Easy to spot missing information

5. **✅ Communicate with applicants**
   - Let them know a follow-up is coming
   - Check if they have DMs enabled
   - Follow up if they don't respond within 24-48 hours

---

## Integration with Existing Commands

The follow-up system works alongside existing academy commands:

```bash
# Full workflow example:

# 1. Check application status
/academy teacher-status sl_username:Username

# 2. Approve if pre-qualified
/academy approve-teacher sl_username:Username

# 3. Link Discord account
/academy register-discord type:teacher sl_username:Username user:@User

# 4. Send follow-up for placement details
/academy followup teacher @User

# 5. Review responses in #academy-operations

# 6. Assign roles and grant access (manual)
```

---

## Need More Help?

- 📖 See [FOLLOWUP_SYSTEM.md](FOLLOWUP_SYSTEM.md) for technical details
- ⚙️ See [ENV_SETUP.md](ENV_SETUP.md) for environment configuration
- 🐛 Check Oscar's console logs for errors
- 💬 Ask in staff channels if issues persist
