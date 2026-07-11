/**
 * Tammy Brightwood Data Schema & Database Structure
 * Defines all data models for Classroom Replacement System
 *
 * Storage Strategy:
 * - Master Grade Ledger: Google Sheets (source of truth)
 * - Student Profiles: Google Sheets + Discord cache
 * - Assignments: Google Sheets + Discord logs
 * - Attendance: Google Sheets
 * - Submissions: Google Sheets + Discord message tracking
 * - Parent Links: Discord member relationships + JSON backup
 */

/**
 * STUDENT PROFILE SCHEMA
 * Stored in: Enrollment Google Sheet
 * Fallback: data/students.json
 */
const studentProfileSchema = {
  studentId: "unique-auto-generated-uuid", // for HUD/portal use
  discordId: "discord-user-id",
  name: "Student Full Name",
  slUsername: "SecondLife.Username",
  gradeLevel: "Kindergarten|Elementary|Middle|High",
  role: "student|teacher|staff|parent",
  parentDiscordId: "parent-discord-id",
  parentName: "Parent Name",
  homeRoomTeacher: "teacher-discord-id-or-null",
  statusFlags: {
    missingSignature: false,
    ageVerified: false,
    profileComplete: false,
    tuitionPaid: false,
    enrollmentApproved: false,
  },
  enrollmentStatus: "pending|approved|denied|withdrawn",
  assignedClasses: ["class-id-1", "class-id-2"], // array of class IDs
  registrationDate: "ISO-8601-timestamp",
  lastUpdated: "ISO-8601-timestamp",
  notes: "staff-notes-field",
};

/**
 * TEACHER/STAFF PROFILE SCHEMA
 * Stored in: Teacher Applications Google Sheet
 */
const teacherProfileSchema = {
  teacherId: "unique-auto-generated-uuid",
  discordId: "discord-user-id",
  name: "Teacher Full Name",
  slUsername: "SecondLife.Username",
  role: "teacher|admin|nurse|support_staff",
  specialties: ["Culinary", "Math", "Science", "Arts"],
  assignedGrades: ["Elementary", "High School"],
  classesTeaching: ["class-id-1", "class-id-2"],
  weeklyAvailability: {
    monday: "HH:MM-HH:MM",
    tuesday: "HH:MM-HH:MM",
    // etc
  },
  applicationStatus: "pending|approved|denied|active",
  registrationDate: "ISO-8601-timestamp",
  lastUpdated: "ISO-8601-timestamp",
};

/**
 * CLASS/COURSE SCHEMA
 * Stored in: Classes Google Sheet
 */
const classSchema = {
  classId: "unique-auto-generated-uuid",
  gradeLevel: "Elementary|Middle|High",
  className: "Class Name",
  teacherId: "teacher-id",
  discordChannelId: "channel-id-for-class",
  discordThreadId: "parent-thread-id-or-null",
  roster: ["student-id-1", "student-id-2"], // array of student IDs
  schedule: {
    days: ["Monday", "Wednesday", "Friday"],
    timeStart: "HH:MM",
    timeEnd: "HH:MM",
  },
  statusFlags: {
    active: true,
    archived: false,
  },
  createdDate: "ISO-8601-timestamp",
};

/**
 * ASSIGNMENT SCHEMA
 * Stored in: Google Sheets (Assignments log)
 * Master record for all assignments
 */
const assignmentSchema = {
  assignmentId: "unique-auto-generated-uuid",
  classId: "class-id",
  teacherId: "teacher-id",
  title: "Assignment Title",
  instructions: "Full assignment instructions (supports markdown)",
  dueDate: "ISO-8601-timestamp",
  submissionType: "discord-text|discord-modal|google-doc|google-form|external-link|workbook-hud",
  submissionDetails: {
    // varies by submission type
    googleDocUrl: "https://docs.google.com/...",
    googleFormUrl: "https://forms.google.com/...",
    externalUrl: "https://...",
    workbookHudAssetId: "asset-uuid-for-HUD",
  },
  discordMessageId: "message-id-of-assignment-post",
  discordThreadId: "thread-id-where-posted",
  status: "draft|posted|closed|archived",
  createdDate: "ISO-8601-timestamp",
  lastUpdated: "ISO-8601-timestamp",
};

/**
 * SUBMISSION SCHEMA
 * Stored in: Google Sheets (Submissions log)
 * Tracks all student submissions
 */
const submissionSchema = {
  submissionId: "unique-auto-generated-uuid",
  assignmentId: "assignment-id",
  studentId: "student-id",
  classId: "class-id",
  studentName: "name-snapshot",
  submittedAt: "ISO-8601-timestamp|null",
  submissionContent: {
    // varies by type
    discordMessageLink: "https://discord.com/channels/...",
    googleDocUrl: "https://docs.google.com/...",
    googleFormResponseId: "form-response-id",
    externalLink: "https://...",
    workbookHudCompletionEvent: "event-id",
  },
  grade: "A+|A|A-|B+|...|not-graded|exempt",
  teacherNote: "feedback-from-teacher",
  status: "submitted|late|missing|exempt",
  lateMinutes: 0,
  gradedAt: "ISO-8601-timestamp|null",
  gradedByTeacherId: "teacher-id",
  lastUpdated: "ISO-8601-timestamp",
};

/**
 * MASTER GRADE LEDGER SCHEMA
 * Stored in: Google Sheets ONLY (single source of truth)
 * This sheet is READ by Tammy Brightwood (staff write to it manually or via /grade-assignment)
 *
 * Columns (in Google Sheet):
 * - Student ID
 * - Student Name
 * - Class
 * - Assignment ID
 * - Assignment Title
 * - Grade
 * - Status (Complete / Late / Missing / Exempt)
 * - Teacher
 * - Feedback
 * - Last Updated
 */
const masterGradeLedgerSchema = {
  studentId: "student-id",
  studentName: "name",
  class: "class-name",
  assignmentId: "assignment-id",
  assignmentTitle: "title",
  grade: "A+|A|A-|B+|B|B-|C+|C|C-|D|F|not-graded|exempt",
  status: "Complete|Late|Missing|Exempt",
  teacher: "teacher-name",
  feedback: "teacher-notes",
  lastUpdated: "ISO-8601-timestamp",
};

/**
 * ATTENDANCE SCHEMA
 * Stored in: Google Sheets (Attendance log)
 */
const attendanceSchema = {
  attendanceId: "unique-auto-generated-uuid",
  studentId: "student-id",
  classId: "class-id",
  checkInDate: "YYYY-MM-DD",
  status: "present|late|excused|absent",
  checkedInAt: "ISO-8601-timestamp",
  excusedReason: "reason-if-excused",
  recordedByTeacherId: "teacher-id",
  chronicAbsenceFlag: false,
  parentAlertSent: false,
};

/**
 * PARENT LINKAGE SCHEMA
 * Stored in: data/parent-links.json + Discord relationships
 */
const parentLinkageSchema = {
  parentId: "unique-auto-generated-uuid",
  parentDiscordId: "discord-user-id",
  parentName: "name",
  linkedStudentIds: ["student-id-1", "student-id-2"],
  portalAccessToken: "secure-token-for-web-portal",
  notificationPreferences: {
    assignmentReminders: true,
    gradeAlerts: true,
    attendanceAlerts: true,
    announcementDigest: "daily|weekly|never",
  },
};

/**
 * ANNOUNCEMENT SCHEMA
 * Stored in: Google Sheets (Announcements log)
 */
const announcementSchema = {
  announcementId: "unique-auto-generated-uuid",
  title: "Announcement Title",
  content: "Full announcement content",
  type: "class-announcement|lesson-reminder|schedule-update|assignment-reminder|general",
  targetingRules: {
    byClass: ["class-id-1", "class-id-2"], // empty = all
    byGrade: ["Elementary", "High School"], // empty = all
    byRole: ["student", "parent", "teacher"], // empty = all
    specificThreadId: "thread-id-or-null", // if in specific thread
  },
  discordPostIds: ["message-id-1", "message-id-2"],
  createdAt: "ISO-8601-timestamp",
  postedAt: "ISO-8601-timestamp",
  createdByTeacherId: "teacher-id",
  status: "draft|scheduled|posted|archived",
};

/**
 * TEACHER THREAD ACTION LOG SCHEMA
 * Stored in: Discord (thread) + Google Sheets (Teacher Actions log)
 */
const teacherThreadActionSchema = {
  actionId: "unique-auto-generated-uuid",
  threadId: "discord-thread-id",
  classId: "class-id",
  teacherId: "teacher-id",
  actionType: "class-status|flag-student|note-student|attendance-check",
  actionData: {
    // varies by action
    flagReason: "reason-for-flag",
    note: "staff-notes",
    studentId: "student-id-if-applicable",
  },
  visibility: "staff-only|parent-visible",
  parentDmSent: false,
  timestamp: "ISO-8601-timestamp",
};

/**
 * PARENT PORTAL VIEW SCHEMA
 * (not stored separately; computed from above schemas)
 */
const parentPortalViewSchema = {
  linkedStudents: [
    {
      studentId: "student-id",
      name: "Student Name",
      grade: "Grade",
      homeRoomTeacher: "teacher-name",
      classes: ["Class 1", "Class 2"],
      status: "enrolled|pending|withdrawn",
    },
  ],
  assignments: [
    {
      assignmentId: "id",
      studentId: "student-id",
      assignmentTitle: "title",
      dueDate: "date",
      status: "submitted|late|missing",
      grade: "grade-or-null",
      feedback: "teacher-note",
    },
  ],
  grades: [
    {
      classId: "class-id",
      className: "Class Name",
      assignments: [
        {
          assignmentTitle: "title",
          grade: "grade",
          dueDate: "date",
          status: "status",
        },
      ],
    },
  ],
  attendance: {
    presentDays: 42,
    lateDays: 3,
    absenceDays: 2,
    excusedDays: 1,
  },
  announcements: [
    {
      title: "title",
      content: "content",
      postedAt: "timestamp",
    },
  ],
};

/**
 * STUDENT PORTAL VIEW SCHEMA
 * (not stored separately; computed from above schemas)
 */
const studentPortalViewSchema = {
  profile: {
    studentId: "student-id",
    name: "name",
    grade: "grade",
    homeRoomTeacher: "teacher-name-or-null",
  },
  assignments: [
    {
      classId: "class-id",
      className: "Class Name",
      assignmentTitle: "title",
      dueDate: "date",
      status: "not-started|in-progress|submitted|graded",
      grade: "grade-or-null",
      feedback: "teacher-note",
    },
  ],
  grades: [
    {
      classId: "class-id",
      className: "Class Name",
      assignments: [
        {
          assignmentTitle: "title",
          grade: "grade",
          dueDate: "date",
        },
      ],
    },
  ],
  attendance: [
    {
      date: "YYYY-MM-DD",
      status: "present|late|absent|excused",
    },
  ],
  announcements: [
    {
      title: "title",
      content: "content",
      postedAt: "timestamp",
    },
  ],
};

/**
 * TEACHER HUD DATA SCHEMA
 * (Data structured for Workbook HUD consumption)
 */
const teacherHudDataSchema = {
  classId: "class-id",
  className: "Class Name",
  studentProgress: [
    {
      studentId: "student-id",
      studentName: "name",
      presentToday: true,
      workbookCompletionPercent: 75,
      missingAssignments: ["assignment-title-1", "assignment-title-2"],
      lastGrade: "A",
      lastSubmission: "ISO-timestamp",
    },
  ],
  classMetrics: {
    averageGrade: "A-",
    submissionRate: 0.95,
    attendanceRate: 0.92,
  },
};

/**
 * WORKBOOK HUD READY DATA SCHEMA
 * (Ready to be consumed by in-world HUD via API/webhooks)
 */
const workbookHudReadySchema = {
  studentId: "student-id",
  studentName: "name",
  classes: [
    {
      classId: "class-id",
      className: "Class Name",
      teacherName: "teacher-name",
      completionPercent: 75,
      missingAssignments: 2,
      attendance: {
        present: 42,
        late: 3,
        absent: 2,
      },
    },
  ],
  overallCompletionPercent: 78,
  lastActivityTimestamp: "ISO-8601-timestamp",
};

module.exports = {
  studentProfileSchema,
  teacherProfileSchema,
  classSchema,
  assignmentSchema,
  submissionSchema,
  masterGradeLedgerSchema,
  attendanceSchema,
  parentLinkageSchema,
  announcementSchema,
  teacherThreadActionSchema,
  parentPortalViewSchema,
  studentPortalViewSchema,
  teacherHudDataSchema,
  workbookHudReadySchema,
};
