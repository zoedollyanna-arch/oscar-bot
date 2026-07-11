/**
 * Tammy Brightwood Bot Command Handler & System Integration
 *
 * Integrates all systems:
 * - Access Control
 * - Google Sheets Manager
 * - Enrollment Manager
 * - Assignment Manager
 * - Submission Manager
 * - Attendance Manager
 * - Announcement Manager
 * - Teacher Thread Manager
 * - Portal Manager
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");

// Import all system managers
const { AccessControl, ROLES } = require("./access-control");
const GoogleSheetsManager = require("./google-sheets-manager");
const EnrollmentManager = require("./enrollment-manager");
const AssignmentManager = require("./assignment-manager");
const SubmissionManager = require("./submission-manager");
const AttendanceManager = require("./attendance-manager");
const AnnouncementManager = require("./announcement-manager");
const TeacherThreadManager = require("./teacher-thread-manager");
const PortalManager = require("./portal-manager");

class TammyBrightwoodBot {
  constructor(client) {
    this.client = client;
    this.sheets = null;
    this.access = null;

    // System managers
    this.enrollment = null;
    this.assignments = null;
    this.submissions = null;
    this.attendance = null;
    this.announcements = null;
    this.teacherThreads = null;
    this.portal = null;

    this.commands = [];
  }

  /**
   * Initialize Tammy Brightwood and all systems
   */
  async initialize() {
    console.log("🤖 Initializing Tammy Brightwood Bot System...");

    // Initialize Google Sheets
    this.sheets = new GoogleSheetsManager();
    const sheetsReady = await this.sheets.initialize();
    if (!sheetsReady) {
      console.warn("⚠️ Google Sheets not available - using fallback mode");
    }

    // Initialize Access Control
    this.access = new AccessControl(this.client);

    // Initialize all system managers
    this.enrollment = new EnrollmentManager(this.client, this.sheets, this.access);
    this.assignments = new AssignmentManager(this.client, this.sheets, this.access);
    this.submissions = new SubmissionManager(this.client, this.sheets, this.access);
    this.attendance = new AttendanceManager(this.client, this.sheets, this.access);
    this.announcements = new AnnouncementManager(this.client, this.sheets, this.access);
    this.teacherThreads = new TeacherThreadManager(
      this.client,
      this.sheets,
      this.access
    );
    this.portal = new PortalManager(this.client, this.sheets, this.access);

    // Register all commands
    this.registerCommands();

    console.log("✅ Tammy Brightwood Bot initialized successfully");
    console.log(`📋 Registered ${this.commands.length} commands`);
  }

  /**
   * Register all slash commands
   */
  registerCommands() {
    // Enrollment & Roster
    this.commands.push({
      name: "academy-register",
      data: this.enrollment.getRegisterCommand(),
      execute: (interaction) => this.enrollment.executeRegister(interaction),
    });

    this.commands.push({
      name: "academy-profile",
      data: this.enrollment.getProfileCommand(),
      execute: (interaction) => this.enrollment.executeProfile(interaction),
    });

    this.commands.push({
      name: "academy-roster",
      data: this.enrollment.getRosterCommand(),
      execute: (interaction) => this.enrollment.executeRoster(interaction),
    });

    this.commands.push({
      name: "academy-enrollment-status",
      data: this.enrollment.getEnrollmentStatusCommand(),
      execute: (interaction) => this.enrollment.executeEnrollmentStatus(interaction),
    });

    // Assignments
    this.commands.push({
      name: "assignment-create",
      data: this.assignments.getCreateCommand(),
      execute: (interaction) => this.assignments.executeCreate(interaction),
    });

    this.commands.push({
      name: "assignment-view",
      data: this.assignments.getViewCommand(),
      execute: (interaction) => this.assignments.executeView(interaction),
    });

    this.commands.push({
      name: "assignment-list",
      data: this.assignments.getListCommand(),
      execute: (interaction) => this.assignments.executeList(interaction),
    });

    // Submissions & Grading
    this.commands.push({
      name: "submit-assignment",
      data: this.submissions.getSubmitCommand(),
      execute: (interaction) => this.submissions.executeSubmit(interaction),
    });

    this.commands.push({
      name: "view-submissions",
      data: this.submissions.getViewSubmissionsCommand(),
      execute: (interaction) => this.submissions.executeViewSubmissions(interaction),
    });

    this.commands.push({
      name: "grade-assignment",
      data: this.submissions.getGradeCommand(),
      execute: (interaction) => this.submissions.executeGrade(interaction),
    });

    this.commands.push({
      name: "return-work",
      data: this.submissions.getReturnCommand(),
      execute: (interaction) => this.submissions.executeReturn(interaction),
    });

    // Attendance
    this.commands.push({
      name: "check-in",
      data: this.attendance.getCheckInCommand(),
      execute: (interaction) => this.attendance.executeCheckIn(interaction),
    });

    this.commands.push({
      name: "attendance-log",
      data: this.attendance.getAttendanceLogCommand(),
      execute: (interaction) => this.attendance.executeAttendanceLog(interaction),
    });

    this.commands.push({
      name: "attendance-view",
      data: this.attendance.getAttendanceViewCommand(),
      execute: (interaction) => this.attendance.executeAttendanceView(interaction),
    });

    // Announcements
    this.commands.push({
      name: "announce",
      data: this.announcements.getAnnounceCommand(),
      execute: (interaction) => this.announcements.executeAnnounce(interaction),
    });

    this.commands.push({
      name: "announce-list",
      data: this.announcements.getAnnounceListCommand(),
      execute: (interaction) => this.announcements.executeAnnounceList(interaction),
    });

    // Teacher Thread Actions
    this.commands.push({
      name: "class-status",
      data: this.teacherThreads.getClassStatusCommand(),
      execute: (interaction) => this.teacherThreads.executeClassStatus(interaction),
    });

    this.commands.push({
      name: "flag-student",
      data: this.teacherThreads.getFlagStudentCommand(),
      execute: (interaction) => this.teacherThreads.executeFlagStudent(interaction),
    });

    this.commands.push({
      name: "add-student-note",
      data: this.teacherThreads.getAddNoteCommand(),
      execute: (interaction) => this.teacherThreads.executeAddNote(interaction),
    });

    // Portal
    this.commands.push({
      name: "student-status",
      data: this.portal.getStudentStatusCommand(),
      execute: (interaction) => this.portal.executeStudentStatus(interaction),
    });

    this.commands.push({
      name: "view-grades",
      data: this.portal.getViewGradesCommand(),
      execute: (interaction) => this.portal.executeViewGrades(interaction),
    });

    this.commands.push({
      name: "view-assignments",
      data: this.portal.getViewAssignmentsCommand(),
      execute: (interaction) => this.portal.executeViewAssignments(interaction),
    });

    this.commands.push({
      name: "link-parent",
      data: this.portal.getLinkParentCommand(),
      execute: (interaction) => this.portal.executeLinkParent(interaction),
    });
  }

  /**
   * Handle slash command interactions
   */
  async handleSlashCommand(interaction) {
    const command = this.commands.find((c) => c.name === interaction.commandName);

    if (!command) {
      return interaction.reply({
        content: `❌ Command \`${interaction.commandName}\` not found.`,
        ephemeral: true,
      });
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing command ${interaction.commandName}:`, error);

      if (interaction.replied) {
        await interaction.followUp({
          content: "❌ An error occurred while executing this command.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ An error occurred while executing this command.",
          ephemeral: true,
        });
      }
    }
  }

  /**
   * Get all command builders for registration
   */
  getCommandBuilders() {
    return this.commands.map((c) => c.data);
  }

  /**
   * Post Tammy Brightwood status embed (for dashboard/welcome channel)
   */
  async postStatusEmbed(channel) {
    try {
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("🤖 Tammy Brightwood Bot - Classroom Management System")
        .setDescription(
          "Complete Google Classroom replacement without using Google Classroom"
        )
        .addFields(
          {
            name: "📚 Features",
            value: `• Enrollment & Roster Management
• Assignment Creation & Submission
• Grading & Feedback System
• Attendance Tracking
• Announcements & Feeds
• Teacher Thread Actions
• Student & Parent Portals
• Chronic Absence Alerts`,
          },
          {
            name: "💾 Data Storage",
            value: `• Master Grade Ledger: Google Sheets (single source of truth)
• Student Profiles: Google Sheets
• Assignments: Google Sheets
• Submissions: Google Sheets
• Attendance: Google Sheets
• All data portal & HUD ready`,
          },
          {
            name: "🔒 Access Control",
            value: `• Admin: Full control
• Teacher: Manage assignments, grade, post announcements
• Staff: Register students, manage records
• Student: Submit work, view grades
• Parent: View child's progress`,
          },
          {
            name: "📋 Quick Commands",
            value: `/academy-register | /assignment-create | /submit-assignment | /check-in | /student-status | /view-grades`,
          }
        )
        .setFooter({
          text: "Use /help for full command list",
        })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error("Error posting status embed:", error);
    }
  }
}

module.exports = TammyBrightwoodBot;
