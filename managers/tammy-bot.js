/**
 * Tammy Brightwood Bot - Main Classroom System Orchestrator
 * Integrates all managers and handles command routing
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { AccessControl } = require("./access-control");
const { GoogleSheetsManager } = require("./google-sheets-manager");
const { EnrollmentManager } = require("./enrollment-manager");
const { AssignmentManager } = require("./assignment-manager");
const { SubmissionManager } = require("./submission-manager");
const { AttendanceManager } = require("./attendance-manager");
const { AnnouncementManager } = require("./announcement-manager");
const { TeacherThreadManager } = require("./teacher-thread-manager");
const { PortalManager } = require("./portal-manager");

class TammyBrightwoodBot {
  constructor({ client, guildId, academyCategoryIds, operationsLogChannelId }) {
    this.client = client;
    this.guildId = guildId || null;
    this.academyCategoryIds = academyCategoryIds || [];
    this.operationsLogChannelId = operationsLogChannelId || null;
    this.ac = new AccessControl(client);
    this.sheets = new GoogleSheetsManager();

    // Initialize all managers
    this.enrollment = new EnrollmentManager(this.ac, this.sheets);
    this.assignment = new AssignmentManager(this.ac, this.sheets);
    this.submission = new SubmissionManager(this.ac, this.sheets);
    this.attendance = new AttendanceManager(this.ac, this.sheets);
    this.announcement = new AnnouncementManager(this.ac, this.sheets);
    this.teacherThread = new TeacherThreadManager(this.ac, this.sheets);
    this.portal = new PortalManager(this.ac, this.sheets);

    this.commands = [];
  }

  /**
   * Register all Tammy Brightwood commands
   */
  registerCommands() {
    this.commands = [
      // Enrollment commands
      new SlashCommandBuilder()
        .setName("academy-register")
        .setDescription("Register as a student")
        .addStringOption((opt) =>
          opt.setName("name").setDescription("Your full name").setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName("academy-profile")
        .setDescription("View your student profile"),

      new SlashCommandBuilder()
        .setName("academy-roster")
        .setDescription("View class roster"),

      new SlashCommandBuilder()
        .setName("academy-enrollment-status")
        .setDescription("Check enrollment status"),

      // Assignment commands
      new SlashCommandBuilder()
        .setName("assignment-create")
        .setDescription("Create a new assignment")
        .addStringOption((opt) =>
          opt.setName("class-grade").setDescription("Class or grade (e.g., Algebra 1 / Grade 10)").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("title").setDescription("Assignment title").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("description").setDescription("Assignment description").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("due-date").setDescription("Due date (YYYY-MM-DD)").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Submission type")
            .setRequired(false)
            .addChoices(
              { name: "Discord Text", value: "discord-text" },
              { name: "Discord Modal", value: "discord-modal" },
              { name: "Google Doc", value: "google-doc" },
              { name: "Google Form", value: "google-form" },
              { name: "External Link", value: "external-link" },
              { name: "Workbook HUD", value: "workbook-hud" }
            )
        ),

      new SlashCommandBuilder()
        .setName("assignment-view")
        .setDescription("View assignment details")
        .addStringOption((opt) =>
          opt.setName("assignment-id").setDescription("Assignment ID").setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName("assignment-list")
        .setDescription("List all assignments"),

      // Submission commands
      new SlashCommandBuilder()
        .setName("submit-assignment")
        .setDescription("Submit an assignment")
        .addStringOption((opt) =>
          opt.setName("assignment-id").setDescription("Assignment ID").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("link").setDescription("Link to your submission").setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName("view-submissions")
        .setDescription("View submissions for assignment")
        .addStringOption((opt) =>
          opt.setName("assignment-id").setDescription("Assignment ID").setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName("grade-assignment")
        .setDescription("Grade a submission")
        .addStringOption((opt) =>
          opt.setName("submission-id").setDescription("Submission ID").setRequired(true)
        )
        .addNumberOption((opt) =>
          opt.setName("grade").setDescription("Grade (0-100)").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("feedback").setDescription("Feedback").setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName("return-work")
        .setDescription("Return work for revision")
        .addStringOption((opt) =>
          opt.setName("submission-id").setDescription("Submission ID").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("notes").setDescription("Return notes").setRequired(false)
        ),

      // Attendance commands
      new SlashCommandBuilder()
        .setName("check-in")
        .setDescription("Check in for class")
        .addStringOption((opt) =>
          opt
            .setName("status")
            .setDescription("Attendance status")
            .setRequired(false)
            .addChoices(
              { name: "Present", value: "present" },
              { name: "Late", value: "late" },
              { name: "Excused", value: "excused" },
              { name: "Absent", value: "absent" }
            )
        ),

      new SlashCommandBuilder()
        .setName("attendance-log")
        .setDescription("Log attendance manually")
        .addStringOption((opt) =>
          opt.setName("student-name").setDescription("Student name").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("status")
            .setDescription("Status")
            .setRequired(true)
            .addChoices(
              { name: "Present", value: "present" },
              { name: "Late", value: "late" },
              { name: "Excused", value: "excused" },
              { name: "Absent", value: "absent" }
            )
        )
        .addStringOption((opt) =>
          opt.setName("notes").setDescription("Notes").setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName("attendance-view")
        .setDescription("View attendance records")
        .addStringOption((opt) =>
          opt.setName("student-name").setDescription("Student name").setRequired(true)
        ),

      // Announcement commands
      new SlashCommandBuilder()
        .setName("announce")
        .setDescription("Post an announcement")
        .addStringOption((opt) =>
          opt.setName("title").setDescription("Announcement title").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("content").setDescription("Announcement content").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Announcement type")
            .setRequired(false)
            .addChoices(
              { name: "Announcement", value: "announcement" },
              { name: "Reminder", value: "reminder" },
              { name: "Schedule Update", value: "schedule-update" },
              { name: "Lesson Reminder", value: "lesson-reminder" },
              { name: "Alert", value: "alert" }
            )
        ),

      new SlashCommandBuilder()
        .setName("announce-list")
        .setDescription("List all announcements"),

      // Teacher thread commands
      new SlashCommandBuilder()
        .setName("class-status")
        .setDescription("Get daily class status report"),

      new SlashCommandBuilder()
        .setName("flag-student")
        .setDescription("Flag a student")
        .addStringOption((opt) =>
          opt.setName("student-id").setDescription("Student Discord ID").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for flag").setRequired(true)
        )
        .addBooleanOption((opt) =>
          opt.setName("notify-parent").setDescription("Notify parent?").setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName("add-student-note")
        .setDescription("Add staff note for student")
        .addStringOption((opt) =>
          opt.setName("student-id").setDescription("Student Discord ID").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("note").setDescription("Staff note").setRequired(true)
        ),

      // Portal commands
      new SlashCommandBuilder()
        .setName("student-status")
        .setDescription("View your student status"),

      new SlashCommandBuilder()
        .setName("view-grades")
        .setDescription("View your grades"),

      new SlashCommandBuilder()
        .setName("view-assignments")
        .setDescription("View assignments"),

      new SlashCommandBuilder()
        .setName("link-parent")
        .setDescription("Link parent to your account")
        .addStringOption((opt) =>
          opt.setName("parent-id").setDescription("Parent Discord ID").setRequired(true)
        ),
    ];

    return this.commands;
  }

  /**
   * Handle slash command interactions
   */
  async handleSlashCommand(interaction) {
    const command = interaction.commandName;

    try {
      // Check permission
      const hasPermission = await this.ac.checkCommandPermission(interaction, command);
      if (!hasPermission) return;

      // Route to appropriate manager
      switch (command) {
        // Enrollment
        case "academy-register":
          return this.enrollment.registerStudent(interaction);
        case "academy-profile":
          return this.enrollment.viewProfile(interaction);
        case "academy-roster":
          return this.enrollment.viewRoster(interaction);
        case "academy-enrollment-status":
          return this.enrollment.checkEnrollmentStatus(interaction);

        // Assignment
        case "assignment-create":
          return this.assignment.createAssignment(interaction);
        case "assignment-view":
          return this.assignment.viewAssignment(interaction);
        case "assignment-list":
          return this.assignment.listAssignments(interaction);

        // Submission
        case "submit-assignment":
          return this.submission.submitAssignment(interaction);
        case "view-submissions":
          return this.submission.viewSubmissions(interaction);
        case "grade-assignment":
          return this.submission.gradeAssignment(interaction);
        case "return-work":
          return this.submission.returnWork(interaction);

        // Attendance
        case "check-in":
          return this.attendance.checkIn(interaction);
        case "attendance-log":
          return this.attendance.logAttendance(interaction);
        case "attendance-view":
          return this.attendance.viewAttendance(interaction);

        // Announcement
        case "announce":
          return this.announcement.postAnnouncement(interaction);
        case "announce-list":
          return this.announcement.listAnnouncements(interaction);

        // Teacher Thread
        case "class-status":
          return this.teacherThread.classStatus(interaction);
        case "flag-student":
          return this.teacherThread.flagStudent(interaction);
        case "add-student-note":
          return this.teacherThread.addStudentNote(interaction);

        // Portal
        case "student-status":
          return this.portal.studentStatus(interaction);
        case "view-grades":
          return this.portal.viewGrades(interaction);
        case "view-assignments":
          return this.portal.viewAssignments(interaction);
        case "link-parent":
          return this.portal.linkParent(interaction);

        default:
          return interaction.reply({
            ephemeral: true,
            content: "❌ Unknown command",
          });
      }
    } catch (e) {
      console.error(`❌ Command error (${command}):`, e);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            ephemeral: true,
            content: "❌ Tammy Brightwood hit an error. Check logs.",
          });
        }
      } catch {}
    }
  }

  /**
   * Get status embed
   */
  getStatusEmbed() {
    const { EmbedBuilder } = require("discord.js");
    return new EmbedBuilder()
      .setColor("#00AA00")
      .setTitle("🦉 Tammy Brightwood Classroom System - Online")
      .addFields(
        { name: "Enrolled Students", value: String(Object.keys(global.enrollmentData || {}).length) },
        { name: "Assignments Posted", value: String(Object.keys(global.assignmentData || {}).length) },
        { name: "Submissions Received", value: String(Object.keys(global.submissionData || {}).length) },
        { name: "Announcements", value: String(Object.keys(global.announcementData || {}).length) }
      );
  }
}

module.exports = { TammyBrightwoodBot };
