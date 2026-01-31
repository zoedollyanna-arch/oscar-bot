# 🧠 SMART-DETECT FOLLOW-UP SYSTEM

## Overview
Oscar's follow-up system automatically detects applicant roles and sends targeted DM modals to gather additional information. All responses are logged to `#academy-operations` for staff review.

---

## ✅ Setup Requirements

### Environment Variables
Add this to your `.env` file:
```env
OSCAR_OPERATIONS_CHANNEL_ID=YOUR_CHANNEL_ID_HERE
```

This is where all follow-up submissions will be logged.

---

## 🎓 PART 1: TEACHER / STAFF FOLLOW-UPS

### Command
```
/academy followup teacher @DiscordUser
```

### What Oscar Does
1. ✅ Looks up `@DiscordUser` in Teacher Application CSV
2. 📋 Reads "Positions Applying For" column
3. 🧩 Applies role mapping (see below)
4. 📨 Sends DM with modal button
5. 📊 Logs answers to Google Sheet (same row) and `#academy-operations`

### 🧩 Role → Question Set Mapping

Oscar automatically detects roles from the "Positions Applying For" column:

| **Role in Application** | **Template Used** |
|-------------------------|-------------------|
| Contains "Culinary" | `teacher_culinary` |
| Contains "Elementary" | `teacher_elementary` |
| Contains "High School" | `teacher_secondary` |
| Contains "School Counselor" | `counselor` |
| Contains "Office / Administrative" | `admin_support` |
| Contains "Daycare" | `daycare` |
| **Multiple roles** | `combined_teacher_workshop` |

### 📋 Teacher Modal Fields

All templates include these standardized fields:

- **Primary Role This Term** *(required)*
- **Workshops You'd Like to Teach or Assist** *(optional)*
- **SL / Creative / Tech Skills** *(optional)*
- **Weekly Availability** *(required)*
- **LEEP Growth Goal** *(optional)*

### 📣 Academy Operations Log

When a teacher submits their follow-up, Oscar posts this embed:

**Embed Title:** `🎓 Teacher Follow-Up Submitted`

**Fields:**
- Applicant
- Primary Role
- Workshop Interest
- Tech Skills
- Availability
- LEEP Goal
- Status: Follow-Up Complete

---

## 🎒 PART 2: STUDENT FOLLOW-UPS

### Commands

#### Missing Digital Signature
```
/academy followup student @ParentDiscordUser type:signature
```

#### Confirm Student Information / Age
```
/academy followup student @ParentDiscordUser type:confirm
```

#### Auto-Scan (Checks for missing signatures)
```
/academy followup student_auto
```

### 🖊️ Student Modal – Missing Signature

**Title:** `🖊️ Lifeline Academy – Enrollment Completion`

**Fields:**
- Student Full Name
- Parent / Guardian Full Name
- Digital Signature (Type Full Name)
- Confirm Agreement to Academy Policies (Yes/No)

### 🎒 Student Modal – Confirm Info / Age

**Title:** `🎒 Lifeline Academy – Information Verification`

**Fields:**
- Student Full Name
- Student Age
- Parent / Guardian Full Name
- Confirm Information Is Accurate (Yes/No)
- Notes (Optional)

### 📣 Academy Operations Log (Student)

**Embed Title:** `🎒 Student Enrollment Update Submitted`

**Fields:**
- Student Name
- Parent/Guardian
- Update Type (Signature / Age Confirm)
- Timestamp
- Logged For: Records & Receipts

---

## 🔧 Technical Implementation

### CSV Data Sources

Oscar reads from two CSV files in the workspace:
1. `_🎓Lifeline Academy (Teacher & Staff Application) (Responses) - Form Responses 1.csv`
2. `Lifeline Academy Enrollment Application (Daycare • Elementary • High School)  (Responses) - Form Responses 1.csv`

### Key Functions

- **`parseCSV(filePath)`** - Parses CSV files with quote handling
- **`detectTeacherRoles(positionsApplyingFor)`** - Smart role detection
- **`buildTeacherFollowUpModal(userId, roles)`** - Creates teacher modal
- **`buildStudentSignatureModal(userId)`** - Creates signature modal
- **`buildStudentConfirmModal(userId)`** - Creates confirmation modal
- **`logToAcademyOps(guild, embed)`** - Posts to operations channel

### Flow Diagram

```
Staff uses command
    ↓
Oscar looks up user in CSV (by discord_id)
    ↓
Detects role(s) / type
    ↓
Sends DM with button
    ↓
User clicks button → Modal appears
    ↓
User fills out and submits
    ↓
Oscar logs to #academy-operations
    ↓
Oscar updates Google Sheet (if applicable)
```

---

## 🚀 Usage Examples

### Example 1: Teacher Follow-up
```
Admin: /academy followup teacher @RaéLynn
Oscar: Detects "School Counselor, Office / Administrative Support"
Oscar: Sends combined template modal via DM
RaéLynn: Completes modal
Oscar: Logs to #academy-operations with all responses
```

### Example 2: Missing Student Signature
```
Admin: /academy followup student @KoutureKardash type:signature
Oscar: Sends signature modal via DM
Parent: Provides digital signature
Oscar: Logs to #academy-operations
Oscar: Updates enrollment status
```

### Example 3: Auto-Scan
```
Admin: /academy followup student_auto
Oscar: Scans entire student CSV
Oscar: Finds 3 students with missing signatures
Oscar: Sends DMs to all 3 parents automatically
Oscar: Reports "✅ Auto-scan complete. Sent 3 follow-up(s)."
```

---

## ⚙️ Permissions

All follow-up commands require:
- ✅ Teacher role OR
- ✅ Admin role OR
- ✅ Administrator permission

---

## 📝 Notes

1. **Discord ID Linking Required:** Users must be linked using `/academy register-discord` before follow-ups can be sent
2. **DM Permissions:** If a user has DMs disabled, Oscar will report the failure
3. **CSV Updates:** Responses are logged to operations channel in real-time
4. **Google Sheets Integration:** Future enhancement to write responses back to sheets
5. **Role Detection:** Uses smart keyword matching (case-insensitive)

---

## 🐛 Troubleshooting

### "Could not find teacher application"
- ✅ Ensure the user is registered: `/academy register-discord`
- ✅ Check that their discord_id is in the CSV

### "Failed to DM user"
- ✅ User has DMs disabled
- ✅ Ask them to enable DMs from server members

### Operations channel not logging
- ✅ Check `OSCAR_OPERATIONS_CHANNEL_ID` is set in `.env`
- ✅ Verify Oscar has permission to post in that channel

---

## 📊 Data Columns Used

### Teacher CSV
- `discord_id`
- `Full Name`
- `Positions Applying For`
- `status`
- `Type your full name to sign`
- `Age Range`
- `Time Zone`

### Student CSV
- `discord_id`
- `Student's Full Name (required)`
- `Parent/Guardian Name`
- `Age (required)`
- `Digital Signature (type your full name)`
- `Enrollment Status`
- `Discord Tag`
- `Discord Tag (optional)`

---

## 🎉 Ready to Use!

The follow-up system is now fully integrated. Staff can start using the commands immediately to gather missing information and confirm applicant details.

**Key Benefits:**
- ✅ Automated role detection
- ✅ No manual template selection
- ✅ Complete audit trail in #academy-operations
- ✅ Professional DM delivery
- ✅ Handles combo applicants automatically
