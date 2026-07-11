/**
 * Google Sheets Integration Layer
 *
 * Handles all read/write operations to Google Sheets
 * Acts as the single source of truth for:
 * - Master Grade Ledger
 * - Student Profiles
 * - Teacher Profiles
 * - Classes
 * - Assignments
 * - Submissions
 * - Attendance
 * - Announcements
 * - Teacher Actions Log
 */

const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

class GoogleSheetsManager {
  constructor() {
    this.auth = null;
    this.sheets = null;
    this.initialized = false;

    // Sheet IDs and ranges
    this.SHEETS = {
      STUDENTS: process.env.TAMMY_STUDENTS_SHEET_ID,
      TEACHERS: process.env.TAMMY_TEACHERS_SHEET_ID,
      CLASSES: process.env.TAMMY_CLASSES_SHEET_ID,
      ASSIGNMENTS: process.env.TAMMY_ASSIGNMENTS_SHEET_ID,
      SUBMISSIONS: process.env.TAMMY_SUBMISSIONS_SHEET_ID,
      GRADE_LEDGER: process.env.TAMMY_GRADE_LEDGER_SHEET_ID,
      ATTENDANCE: process.env.TAMMY_ATTENDANCE_SHEET_ID,
      ANNOUNCEMENTS: process.env.TAMMY_ANNOUNCEMENTS_SHEET_ID,
      TEACHER_ACTIONS: process.env.TAMMY_TEACHER_ACTIONS_SHEET_ID,
      PARENT_LINKS: process.env.TAMMY_PARENT_LINKS_SHEET_ID,
    };
  }

  /**
   * Initialize Google Sheets authentication
   */
  async initialize() {
    try {
      const serviceAccount = JSON.parse(
        Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "", "base64").toString()
      );

      this.auth = new google.auth.GoogleAuth({
        credentials: serviceAccount,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      this.sheets = google.sheets({ version: "v4", auth: this.auth });
      this.initialized = true;
      console.log("✅ Google Sheets Manager initialized");
      return true;
    } catch (error) {
      console.error("❌ Google Sheets initialization failed:", error.message);
      return false;
    }
  }

  /**
   * READ: Get all students
   */
  async getStudents() {
    if (!this.initialized) return [];

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.SHEETS.STUDENTS,
        range: "Sheet1!A:Z",
      });

      const rows = response.data.values || [];
      if (rows.length < 2) return [];

      const headers = rows[0];
      return rows.slice(1).map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header.toLowerCase().replace(/\s+/g, "_")] = row[index] || "";
        });
        return obj;
      });
    } catch (error) {
      console.error("Error fetching students:", error.message);
      return [];
    }
  }

  /**
   * READ: Get student by Discord ID
   */
  async getStudentByDiscordId(discordId) {
    const students = await this.getStudents();
    return students.find((s) => s.discord_id === discordId);
  }

  /**
   * READ: Get student by Student ID
   */
  async getStudentById(studentId) {
    const students = await this.getStudents();
    return students.find((s) => s.student_id === studentId);
  }

  /**
   * WRITE: Create or update student profile
   */
  async upsertStudent(studentData) {
    if (!this.initialized) return false;

    try {
      const students = await this.getStudents();
      const existingIndex = students.findIndex(
        (s) => s.student_id === studentData.student_id
      );

      // Build row data
      const headers = [
        "student_id",
        "discord_id",
        "name",
        "grade_level",
        "parent_discord_id",
        "homeroom_teacher",
        "status",
        "missing_signature",
        "age_verified",
        "profile_complete",
        "enrollment_approved",
        "enrolled_classes",
        "registration_date",
        "last_updated",
        "notes",
      ];

      const rowData = headers.map((h) => studentData[h] || "");

      if (existingIndex !== -1) {
        // Update existing
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.SHEETS.STUDENTS,
          range: `Sheet1!A${existingIndex + 2}:O${existingIndex + 2}`,
          valueInputOption: "RAW",
          resource: { values: [rowData] },
        });
      } else {
        // Append new
        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.SHEETS.STUDENTS,
          range: "Sheet1!A:O",
          valueInputOption: "RAW",
          resource: { values: [rowData] },
        });
      }

      return true;
    } catch (error) {
      console.error("Error upserting student:", error.message);
      return false;
    }
  }

  /**
   * READ: Get all assignments
   */
  async getAssignments() {
    if (!this.initialized) return [];

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.SHEETS.ASSIGNMENTS,
        range: "Sheet1!A:Z",
      });

      const rows = response.data.values || [];
      if (rows.length < 2) return [];

      const headers = rows[0];
      return rows.slice(1).map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header.toLowerCase().replace(/\s+/g, "_")] = row[index] || "";
        });
        return obj;
      });
    } catch (error) {
      console.error("Error fetching assignments:", error.message);
      return [];
    }
  }

  /**
   * READ: Get assignment by ID
   */
  async getAssignmentById(assignmentId) {
    const assignments = await this.getAssignments();
    return assignments.find((a) => a.assignment_id === assignmentId);
  }

  /**
   * READ: Get assignments for a class
   */
  async getAssignmentsByClass(classId) {
    const assignments = await this.getAssignments();
    return assignments.filter((a) => a.class_id === classId);
  }

  /**
   * WRITE: Create assignment
   */
  async createAssignment(assignmentData) {
    if (!this.initialized) return false;

    try {
      const headers = [
        "assignment_id",
        "class_id",
        "teacher_id",
        "title",
        "instructions",
        "due_date",
        "submission_type",
        "submission_details",
        "discord_message_id",
        "discord_thread_id",
        "status",
        "created_date",
        "last_updated",
      ];

      const rowData = headers.map((h) => assignmentData[h] || "");

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.SHEETS.ASSIGNMENTS,
        range: "Sheet1!A:M",
        valueInputOption: "RAW",
        resource: { values: [rowData] },
      });

      return true;
    } catch (error) {
      console.error("Error creating assignment:", error.message);
      return false;
    }
  }

  /**
   * READ: Get Master Grade Ledger
   */
  async getGradeLedger() {
    if (!this.initialized) return [];

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.SHEETS.GRADE_LEDGER,
        range: "Sheet1!A:J",
      });

      const rows = response.data.values || [];
      if (rows.length < 2) return [];

      const headers = rows[0];
      return rows.slice(1).map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header.toLowerCase().replace(/\s+/g, "_")] = row[index] || "";
        });
        return obj;
      });
    } catch (error) {
      console.error("Error fetching grade ledger:", error.message);
      return [];
    }
  }

  /**
   * READ: Get grades for a student
   */
  async getStudentGrades(studentId) {
    const ledger = await this.getGradeLedger();
    return ledger.filter((g) => g.student_id === studentId);
  }

  /**
   * READ: Get grades for a class
   */
  async getClassGrades(classId) {
    const ledger = await this.getGradeLedger();
    return ledger.filter((g) => g.class_id === classId);
  }

  /**
   * WRITE: Add or update grade in Master Ledger
   * This is the ONLY place grades are written to
   */
  async upsertGrade(gradeData) {
    if (!this.initialized) return false;

    try {
      const ledger = await this.getGradeLedger();
      const existingIndex = ledger.findIndex(
        (g) =>
          g.student_id === gradeData.student_id &&
          g.assignment_id === gradeData.assignment_id
      );

      const headers = [
        "student_id",
        "student_name",
        "class_id",
        "assignment_id",
        "assignment_title",
        "grade",
        "status",
        "teacher",
        "feedback",
        "last_updated",
      ];

      const rowData = headers.map((h) => gradeData[h] || "");

      if (existingIndex !== -1) {
        // Update existing grade
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.SHEETS.GRADE_LEDGER,
          range: `Sheet1!A${existingIndex + 2}:J${existingIndex + 2}`,
          valueInputOption: "RAW",
          resource: { values: [rowData] },
        });
      } else {
        // Append new grade
        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.SHEETS.GRADE_LEDGER,
          range: "Sheet1!A:J",
          valueInputOption: "RAW",
          resource: { values: [rowData] },
        });
      }

      return true;
    } catch (error) {
      console.error("Error upserting grade:", error.message);
      return false;
    }
  }

  /**
   * READ: Get all submissions
   */
  async getSubmissions() {
    if (!this.initialized) return [];

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.SHEETS.SUBMISSIONS,
        range: "Sheet1!A:M",
      });

      const rows = response.data.values || [];
      if (rows.length < 2) return [];

      const headers = rows[0];
      return rows.slice(1).map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header.toLowerCase().replace(/\s+/g, "_")] = row[index] || "";
        });
        return obj;
      });
    } catch (error) {
      console.error("Error fetching submissions:", error.message);
      return [];
    }
  }

  /**
   * READ: Get submissions for an assignment
   */
  async getSubmissionsByAssignment(assignmentId) {
    const submissions = await this.getSubmissions();
    return submissions.filter((s) => s.assignment_id === assignmentId);
  }

  /**
   * READ: Get submissions by student
   */
  async getSubmissionsByStudent(studentId) {
    const submissions = await this.getSubmissions();
    return submissions.filter((s) => s.student_id === studentId);
  }

  /**
   * WRITE: Log submission
   */
  async logSubmission(submissionData) {
    if (!this.initialized) return false;

    try {
      const headers = [
        "submission_id",
        "assignment_id",
        "student_id",
        "class_id",
        "student_name",
        "submitted_at",
        "submission_content",
        "grade",
        "status",
        "teacher_note",
        "graded_at",
        "graded_by_teacher_id",
        "last_updated",
      ];

      const rowData = headers.map((h) => submissionData[h] || "");

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.SHEETS.SUBMISSIONS,
        range: "Sheet1!A:M",
        valueInputOption: "RAW",
        resource: { values: [rowData] },
      });

      return true;
    } catch (error) {
      console.error("Error logging submission:", error.message);
      return false;
    }
  }

  /**
   * READ: Get attendance records
   */
  async getAttendance(filterDate = null) {
    if (!this.initialized) return [];

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.SHEETS.ATTENDANCE,
        range: "Sheet1!A:H",
      });

      let rows = response.data.values || [];
      if (rows.length < 2) return [];

      const headers = rows[0];
      let records = rows.slice(1).map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header.toLowerCase().replace(/\s+/g, "_")] = row[index] || "";
        });
        return obj;
      });

      if (filterDate) {
        records = records.filter((r) => r.check_in_date === filterDate);
      }

      return records;
    } catch (error) {
      console.error("Error fetching attendance:", error.message);
      return [];
    }
  }

  /**
   * READ: Get attendance by student
   */
  async getStudentAttendance(studentId, limit = 30) {
    const attendance = await this.getAttendance();
    return attendance
      .filter((a) => a.student_id === studentId)
      .sort((a, b) => new Date(b.check_in_date) - new Date(a.check_in_date))
      .slice(0, limit);
  }

  /**
   * WRITE: Log attendance check-in
   */
  async logAttendance(attendanceData) {
    if (!this.initialized) return false;

    try {
      const headers = [
        "attendance_id",
        "student_id",
        "class_id",
        "check_in_date",
        "status",
        "checked_in_at",
        "excused_reason",
        "recorded_by_teacher_id",
      ];

      const rowData = headers.map((h) => attendanceData[h] || "");

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.SHEETS.ATTENDANCE,
        range: "Sheet1!A:H",
        valueInputOption: "RAW",
        resource: { values: [rowData] },
      });

      return true;
    } catch (error) {
      console.error("Error logging attendance:", error.message);
      return false;
    }
  }

  /**
   * READ: Get all announcements
   */
  async getAnnouncements() {
    if (!this.initialized) return [];

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.SHEETS.ANNOUNCEMENTS,
        range: "Sheet1!A:K",
      });

      const rows = response.data.values || [];
      if (rows.length < 2) return [];

      const headers = rows[0];
      return rows.slice(1).map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header.toLowerCase().replace(/\s+/g, "_")] = row[index] || "";
        });
        return obj;
      });
    } catch (error) {
      console.error("Error fetching announcements:", error.message);
      return [];
    }
  }

  /**
   * WRITE: Create announcement
   */
  async createAnnouncement(announcementData) {
    if (!this.initialized) return false;

    try {
      const headers = [
        "announcement_id",
        "title",
        "content",
        "type",
        "targeting_classes",
        "targeting_grades",
        "targeting_roles",
        "specific_thread_id",
        "created_at",
        "posted_at",
        "created_by_teacher_id",
        "status",
      ];

      const rowData = headers.map((h) => announcementData[h] || "");

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.SHEETS.ANNOUNCEMENTS,
        range: "Sheet1!A:L",
        valueInputOption: "RAW",
        resource: { values: [rowData] },
      });

      return true;
    } catch (error) {
      console.error("Error creating announcement:", error.message);
      return false;
    }
  }

  /**
   * WRITE: Log teacher action
   */
  async logTeacherAction(actionData) {
    if (!this.initialized) return false;

    try {
      const headers = [
        "action_id",
        "thread_id",
        "class_id",
        "teacher_id",
        "action_type",
        "action_data",
        "visibility",
        "parent_dm_sent",
        "timestamp",
      ];

      const rowData = headers.map((h) => actionData[h] || "");

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.SHEETS.TEACHER_ACTIONS,
        range: "Sheet1!A:I",
        valueInputOption: "RAW",
        resource: { values: [rowData] },
      });

      return true;
    } catch (error) {
      console.error("Error logging teacher action:", error.message);
      return false;
    }
  }
}

module.exports = GoogleSheetsManager;
