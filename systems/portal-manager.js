/**
 * Parent & Student Portal Systems
 *
 * Handles:
 * - Student status viewing
 * - Assignment browsing
 * - Grade viewing
 * - Attendance checking
 * - Announcement reading
 * - Parent-student linkage
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { v4: uuidv4 } = require("uuid");

class PortalManager {
  constructor(client, sheetsManager, accessControl) {
    this.client = client;
    this.sheets = sheetsManager;
    this.access = accessControl;
  }

  /**
   * Command: /student-status
   * Students/Parents view student information
   */
  getStudentStatusCommand() {
    return new SlashCommandBuilder()
      .setName("student-status")
      .setDescription("View student status and summary")
      .addUserOption((option) =>
        option
          .setName("student")
          .setDescription("Student to view (parents only see linked)")
          .setRequired(false)
      );
  }

  /**
   * Execute: /student-status
   */
  async executeStudentStatus(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const targetUser = interaction.options.getUser("student") || interaction.user;

      // Access check: students/parents can only view their own
      const isStaff = await this.access.isStaff(interaction.member);
      if (!isStaff && targetUser.id !== interaction.user.id) {
        return interaction.editReply({
          content:
            "❌ You can only view your own status or linked student status.",
        });
      }

      // Get student
      const student = await this.sheets.getStudentByDiscordId(targetUser.id);
      if (!student) {
        return interaction.editReply({
          content: "❌ No student profile found.",
        });
      }

      // Get recent grades
      const grades = await this.sheets.getStudentGrades(student.student_id);
      const averageGrade = this.calculateAverageGrade(grades);

      // Get recent attendance
      const attendance = await this.sheets.getStudentAttendance(
        student.student_id,
        30
      );
      const attendanceRate = (
        ((attendance.filter(
          (a) => a.status === "present" || a.status === "late"
        ).length /
          Math.max(attendance.length, 1)) *
          100)
      ).toFixed(1);

      // Get pending assignments
      const submissions = await this.sheets.getSubmissionsByStudent(
        student.student_id
      );
      const pendingCount = submissions.filter((s) => !s.submitted_at).length;

      // Build status embed
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`📚 ${student.name} - Overall Status`)
        .setThumbnail(targetUser.avatarURL())
        .addFields(
          { name: "Grade Level", value: student.grade_level || "Not set" },
          { name: "Enrollment Status", value: student.status || "Pending" },
          {
            name: "Academic Summary",
            value: `• Average Grade: **${averageGrade || "No grades yet"}**\n• Assignments Pending: **${pendingCount}**\n• Recent Assignments: **${grades.length}**`,
          },
          {
            name: "Attendance (Last 30 days)",
            value: `• Attendance Rate: **${attendanceRate}%**\n• Present: **${attendance.filter((a) => a.status === "present").length}**\n• Late: **${attendance.filter((a) => a.status === "late").length}**\n• Absent: **${attendance.filter((a) => a.status === "absent").length}**`,
          }
        );

      if (student.homeroom_teacher) {
        embed.addFields({
          name: "Homeroom Teacher",
          value: `<@${student.homeroom_teacher}>`,
        });
      }

      // Add quick action buttons
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`view-grades-${student.student_id}`)
          .setLabel("View Grades")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`view-assignments-${student.student_id}`)
          .setLabel("View Assignments")
          .setStyle(ButtonStyle.Primary)
      );

      return interaction.editReply({ embeds: [embed], components: [buttons] });
    } catch (error) {
      console.error("Error in student-status:", error);
      return interaction.editReply({
        content: "❌ Error loading status. Check logs.",
      });
    }
  }

  /**
   * Command: /view-grades
   * View grades for a student
   */
  getViewGradesCommand() {
    return new SlashCommandBuilder()
      .setName("view-grades")
      .setDescription("View your grades")
      .addUserOption((option) =>
        option
          .setName("student")
          .setDescription("Student to view (staff only)")
          .setRequired(false)
      );
  }

  /**
   * Execute: /view-grades
   */
  async executeViewGrades(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const targetUser = interaction.options.getUser("student") || interaction.user;

      // Access check
      const isStaff = await this.access.isStaff(interaction.member);
      if (!isStaff && targetUser.id !== interaction.user.id) {
        return interaction.editReply({
          content: "❌ You can only view your own grades.",
        });
      }

      // Get student
      const student = await this.sheets.getStudentByDiscordId(targetUser.id);
      if (!student) {
        return interaction.editReply({
          content: "❌ Student profile not found.",
        });
      }

      // Get all grades
      const ledger = await this.sheets.getGradeLedger();
      const studentGrades = ledger.filter((g) => g.student_id === student.student_id);

      if (studentGrades.length === 0) {
        return interaction.editReply({
          content: "❌ No grades recorded yet.",
        });
      }

      // Group by class
      const byClass = {};
      for (const grade of studentGrades) {
        if (!byClass[grade.class_id]) {
          byClass[grade.class_id] = [];
        }
        byClass[grade.class_id].push(grade);
      }

      // Build embeds (one per class)
      const embeds = [];
      for (const [classId, grades] of Object.entries(byClass)) {
        const classAvg = this.calculateAverageGrade(grades);
        const embed = new EmbedBuilder()
          .setColor(this.getGradeColor(classAvg))
          .setTitle(`📊 ${classId}`)
          .setDescription(`Average: ${classAvg}`);

        // Show each assignment
        const gradesList = grades
          .map(
            (g) =>
              `• **${g.assignment_title}**: ${g.grade} (${g.status})\n  _${g.feedback || "No feedback"}_`
          )
          .join("\n");

        embed.addFields({
          name: "Grades",
          value: gradesList.substring(0, 1024),
        });

        embeds.push(embed);
      }

      return interaction.editReply({ embeds: embeds.slice(0, 10) }); // Max 10 embeds
    } catch (error) {
      console.error("Error viewing grades:", error);
      return interaction.editReply({
        content: "❌ Error loading grades. Check logs.",
      });
    }
  }

  /**
   * Command: /view-assignments
   * View assignments
   */
  getViewAssignmentsCommand() {
    return new SlashCommandBuilder()
      .setName("view-assignments")
      .setDescription("View assignments")
      .addStringOption((option) =>
        option
          .setName("filter")
          .setDescription("Filter by status")
          .setRequired(false)
          .addChoices(
            { name: "Not Started", value: "not-started" },
            { name: "In Progress", value: "in-progress" },
            { name: "Submitted", value: "submitted" },
            { name: "Graded", value: "graded" },
            { name: "All", value: "all" }
          )
      )
      .addUserOption((option) =>
        option
          .setName("student")
          .setDescription("Student to view (staff only)")
          .setRequired(false)
      );
  }

  /**
   * Execute: /view-assignments
   */
  async executeViewAssignments(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const filter = interaction.options.getString("filter") || "all";
      const targetUser = interaction.options.getUser("student") || interaction.user;

      // Access check
      const isStaff = await this.access.isStaff(interaction.member);
      if (!isStaff && targetUser.id !== interaction.user.id) {
        return interaction.editReply({
          content: "❌ You can only view your own assignments.",
        });
      }

      // Get student
      const student = await this.sheets.getStudentByDiscordId(targetUser.id);
      if (!student) {
        return interaction.editReply({
          content: "❌ Student profile not found.",
        });
      }

      // Get assignments (enrolled classes)
      const classIds = student.enrolled_classes
        ? student.enrolled_classes.split(",")
        : [];

      let assignments = [];
      for (const classId of classIds) {
        const classAssignments = await this.sheets.getAssignmentsByClass(classId);
        assignments = assignments.concat(classAssignments);
      }

      // Get submissions to determine status
      const submissions = await this.sheets.getSubmissionsByStudent(
        student.student_id
      );

      // Filter by status
      if (filter !== "all") {
        assignments = assignments.filter((a) => {
          const submission = submissions.find((s) => s.assignment_id === a.assignment_id);
          if (!submission) return filter === "not-started";
          if (submission.grade) return filter === "graded";
          if (submission.submitted_at) return filter === "submitted";
          return filter === "in-progress";
        });
      }

      if (assignments.length === 0) {
        return interaction.editReply({
          content: "❌ No assignments found.",
        });
      }

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`📋 Assignments (${filter})`)
        .setDescription(`${assignments.length} assignment(s)`);

      // Group by due date
      const byDue = {};
      for (const assignment of assignments) {
        if (!byDue[assignment.due_date]) {
          byDue[assignment.due_date] = [];
        }
        byDue[assignment.due_date].push(assignment);
      }

      for (const [date, assns] of Object.entries(byDue)) {
        embed.addFields({
          name: `📅 Due: ${date}`,
          value: assns.map((a) => `• ${a.title}`).join("\n"),
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error viewing assignments:", error);
      return interaction.editReply({
        content: "❌ Error loading assignments. Check logs.",
      });
    }
  }

  /**
   * Command: /link-parent
   * Parent links to student account
   */
  getLinkParentCommand() {
    return new SlashCommandBuilder()
      .setName("link-parent")
      .setDescription("Link parent account to student (parent must run this)")
      .addUserOption((option) =>
        option
          .setName("student")
          .setDescription("Student Discord account")
          .setRequired(true)
      );
  }

  /**
   * Execute: /link-parent
   */
  async executeLinkParent(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const studentUser = interaction.options.getUser("student");

      // Get student
      const student = await this.sheets.getStudentByDiscordId(studentUser.id);
      if (!student) {
        return interaction.editReply({
          content: "❌ Student account not found.",
        });
      }

      // Update student record with parent ID
      const updated = await this.sheets.upsertStudent({
        student_id: student.student_id,
        discord_id: student.discord_id,
        name: student.name,
        grade_level: student.grade_level,
        parent_discord_id: interaction.user.id, // Link parent
        homeroom_teacher: student.homeroom_teacher,
        status: student.status,
        missing_signature: student.missing_signature,
        age_verified: student.age_verified,
        profile_complete: student.profile_complete,
        enrollment_approved: student.enrollment_approved,
        enrolled_classes: student.enrolled_classes,
        registration_date: student.registration_date,
        last_updated: new Date().toISOString(),
        notes: student.notes,
      });

      if (!updated) {
        return interaction.editReply({
          content: "❌ Failed to link account.",
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("✅ Parent Account Linked")
        .addFields(
          { name: "Parent", value: `${interaction.user.mention}` },
          { name: "Student", value: `${studentUser.mention}` },
          { name: "Student Name", value: student.name }
        );

      // Log
      const opsChannel = this.client.channels.cache.get(
        process.env.TAMMY_OPERATIONS_CHANNEL_ID
      );
      if (opsChannel) {
        await opsChannel.send({ embeds: [embed] });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error linking parent:", error);
      return interaction.editReply({
        content: "❌ Error linking parent account. Check logs.",
      });
    }
  }

  /**
   * Helper: Calculate average grade
   */
  calculateAverageGrade(grades) {
    if (grades.length === 0) return "N/A";

    const gradeValues = {
      "A+": 4.0,
      A: 4.0,
      "A-": 3.7,
      "B+": 3.3,
      B: 3.0,
      "B-": 2.7,
      "C+": 2.3,
      C: 2.0,
      "C-": 1.7,
      D: 1.0,
      F: 0.0,
    };

    let total = 0;
    let count = 0;
    for (const grade of grades) {
      if (gradeValues[grade.grade]) {
        total += gradeValues[grade.grade];
        count++;
      }
    }

    if (count === 0) return "No grades";

    const avg = total / count;
    // Convert back to letter grade
    if (avg >= 3.85) return "A";
    if (avg >= 3.5) return "A-";
    if (avg >= 3.15) return "B+";
    if (avg >= 2.85) return "B";
    if (avg >= 2.5) return "B-";
    if (avg >= 2.15) return "C+";
    if (avg >= 1.85) return "C";
    if (avg >= 1.5) return "C-";
    if (avg >= 1.0) return "D";
    return "F";
  }

  /**
   * Helper: Get color based on grade
   */
  getGradeColor(grade) {
    if (!grade) return 0x808080;
    if (grade.includes("A")) return 0x00ff00;
    if (grade.includes("B")) return 0x0099ff;
    if (grade.includes("C")) return 0xffaa00;
    if (grade.includes("D")) return 0xff6600;
    return 0xff0000;
  }
}

module.exports = PortalManager;
