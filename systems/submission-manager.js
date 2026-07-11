/**
 * Submission Tracking & Grading System
 *
 * Handles:
 * - Recording student submissions
 * - Tracking submission status (submitted, late, missing)
 * - Teacher grading via Master Grade Ledger
 * - Returning work to students
 * - Grade flagging and notifications
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { v4: uuidv4 } = require("uuid");

class SubmissionManager {
  constructor(client, sheetsManager, accessControl) {
    this.client = client;
    this.sheets = sheetsManager;
    this.access = accessControl;
  }

  /**
   * Command: /submit-assignment
   * Students submit their work
   */
  getSubmitCommand() {
    return new SlashCommandBuilder()
      .setName("submit-assignment")
      .setDescription("Submit your assignment")
      .addStringOption((option) =>
        option
          .setName("assignment_id")
          .setDescription("Assignment ID")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("submission_link")
          .setDescription("Link to your work (for Google Doc/Form/External)")
          .setRequired(false)
      );
  }

  /**
   * Execute: /submit-assignment
   */
  async executeSubmit(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const assignmentId = interaction.options.getString("assignment_id");
      const submissionLink = interaction.options.getString("submission_link");

      // Get assignment
      const assignment = await this.sheets.getAssignmentById(assignmentId);
      if (!assignment) {
        return interaction.editReply({
          content: "❌ Assignment not found.",
        });
      }

      // Get student
      const student = await this.sheets.getStudentByDiscordId(interaction.user.id);
      if (!student) {
        return interaction.editReply({
          content: "❌ No student profile found.",
        });
      }

      // Check if late
      const dueDate = new Date(assignment.due_date);
      const now = new Date();
      const isLate = now > dueDate;
      const lateMinutes = isLate ? Math.floor((now - dueDate) / 60000) : 0;

      // Create submission record
      const submissionId = uuidv4();
      const submissionData = {
        submission_id: submissionId,
        assignment_id: assignmentId,
        student_id: student.student_id,
        class_id: assignment.class_id,
        student_name: student.name,
        submitted_at: now.toISOString(),
        submission_content: submissionLink || `Discord message: ${interaction.user.username}`,
        grade: "",
        teacher_note: "",
        status: isLate ? "late" : "submitted",
        graded_at: "",
        graded_by_teacher_id: "",
        last_updated: now.toISOString(),
      };

      // Save submission
      const saved = await this.sheets.logSubmission(submissionData);
      if (!saved) {
        return interaction.editReply({
          content:
            "❌ Failed to record submission. Please try again or contact staff.",
        });
      }

      // Create confirmation embed
      const embed = new EmbedBuilder()
        .setColor(isLate ? 0xffaa00 : 0x00ff00)
        .setTitle("✅ Assignment Submitted")
        .addFields(
          { name: "Assignment", value: assignment.title },
          { name: "Status", value: isLate ? "⏰ Late" : "✅ On Time" },
          { name: "Submitted At", value: new Date().toLocaleString() }
        );

      if (isLate) {
        embed.addFields({
          name: "Late By",
          value: `${Math.floor(lateMinutes / 60)} hours ${lateMinutes % 60} minutes`,
        });
      }

      // Log to operations
      const opsChannel = this.client.channels.cache.get(
        process.env.TAMMY_OPERATIONS_CHANNEL_ID
      );
      if (opsChannel) {
        await opsChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(isLate ? 0xffaa00 : 0x00ff00)
              .setTitle("📤 Submission Received")
              .addFields(
                { name: "Student", value: `${interaction.user.mention}` },
                { name: "Assignment", value: assignment.title },
                { name: "Status", value: isLate ? "Late" : "On Time" }
              )
              .setTimestamp(),
          ],
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in submit command:", error);
      return interaction.editReply({
        content: "❌ Error recording submission. Check logs.",
      });
    }
  }

  /**
   * Command: /view-submissions
   * Teachers view all submissions for an assignment
   */
  getViewSubmissionsCommand() {
    return new SlashCommandBuilder()
      .setName("view-submissions")
      .setDescription("View submissions for an assignment (teacher only)")
      .addStringOption((option) =>
        option
          .setName("assignment_id")
          .setDescription("Assignment ID to view submissions for")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("filter")
          .setDescription("Filter by status")
          .addChoices(
            { name: "All", value: "all" },
            { name: "Submitted", value: "submitted" },
            { name: "Late", value: "late" },
            { name: "Missing", value: "missing" }
          )
      );
  }

  /**
   * Execute: /view-submissions
   */
  async executeViewSubmissions(interaction) {
    // Check access
    if (!(await this.access.hasRole(interaction.member, ["teacher", "admin"]))) {
      return interaction.reply({
        content: "❌ Only teachers can view submissions.",
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const assignmentId = interaction.options.getString("assignment_id");
      const filter = interaction.options.getString("filter") || "all";

      const assignment = await this.sheets.getAssignmentById(assignmentId);
      if (!assignment) {
        return interaction.editReply({
          content: "❌ Assignment not found.",
        });
      }

      const submissions = await this.sheets.getSubmissionsByAssignment(assignmentId);
      let filtered = submissions;
      if (filter !== "all") {
        filtered = submissions.filter((s) => s.status === filter);
      }

      if (filtered.length === 0) {
        return interaction.editReply({
          content: "❌ No submissions found.",
        });
      }

      // Count stats
      const stats = {
        submitted: submissions.filter((s) => s.status === "submitted").length,
        late: submissions.filter((s) => s.status === "late").length,
        missing: submissions.filter((s) => s.status === "missing").length,
      };

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`📥 Submissions: ${assignment.title}`)
        .addFields(
          {
            name: "Stats",
            value: `✅ On Time: ${stats.submitted} | ⏰ Late: ${stats.late} | ❌ Missing: ${stats.missing}`,
          },
          {
            name: "Submissions",
            value: filtered
              .map(
                (s) =>
                  `• **${s.student_name}** - ${s.status} (${s.submitted_at ? "✅ Submitted" : "❌ Missing"})`
              )
              .join("\n")
              .substring(0, 1024),
          }
        );

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error viewing submissions:", error);
      return interaction.editReply({
        content: "❌ Error loading submissions. Check logs.",
      });
    }
  }

  /**
   * Command: /grade-assignment
   * Teachers grade a student's submission
   */
  getGradeCommand() {
    return new SlashCommandBuilder()
      .setName("grade-assignment")
      .setDescription("Grade a student submission (teacher only)")
      .addStringOption((option) =>
        option
          .setName("submission_id")
          .setDescription("Submission ID to grade")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("grade")
          .setDescription("Grade to assign")
          .setRequired(true)
          .addChoices(
            { name: "A+", value: "A+" },
            { name: "A", value: "A" },
            { name: "A-", value: "A-" },
            { name: "B+", value: "B+" },
            { name: "B", value: "B" },
            { name: "B-", value: "B-" },
            { name: "C+", value: "C+" },
            { name: "C", value: "C" },
            { name: "C-", value: "C-" },
            { name: "D", value: "D" },
            { name: "F", value: "F" },
            { name: "Exempt", value: "exempt" }
          )
      )
      .addStringOption((option) =>
        option
          .setName("feedback")
          .setDescription("Optional feedback for student")
          .setRequired(false)
      );
  }

  /**
   * Execute: /grade-assignment
   */
  async executeGrade(interaction) {
    // Check access
    if (!(await this.access.hasRole(interaction.member, ["teacher", "admin"]))) {
      return interaction.reply({
        content: "❌ Only teachers can grade assignments.",
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const submissionId = interaction.options.getString("submission_id");
      const grade = interaction.options.getString("grade");
      const feedback = interaction.options.getString("feedback") || "";

      // Get submission
      const submissions = await this.sheets.getSubmissions();
      const submission = submissions.find((s) => s.submission_id === submissionId);

      if (!submission) {
        return interaction.editReply({
          content: "❌ Submission not found.",
        });
      }

      // Get assignment for title
      const assignment = await this.sheets.getAssignmentById(submission.assignment_id);

      // Get status for ledger
      const status =
        grade === "exempt"
          ? "Exempt"
          : submission.status === "late"
            ? "Late"
            : "Complete";

      // Write to Master Grade Ledger (ONLY place grades go)
      const gradeData = {
        student_id: submission.student_id,
        student_name: submission.student_name,
        class_id: submission.class_id,
        assignment_id: submission.assignment_id,
        assignment_title: assignment?.title || "Unknown",
        grade: grade,
        status: status,
        teacher: interaction.user.username,
        feedback: feedback,
        last_updated: new Date().toISOString(),
      };

      const saved = await this.sheets.upsertGrade(gradeData);
      if (!saved) {
        return interaction.editReply({
          content: "❌ Failed to save grade. Please try again.",
        });
      }

      // Create confirmation
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("✅ Grade Recorded")
        .addFields(
          { name: "Student", value: submission.student_name },
          { name: "Assignment", value: assignment?.title || "Unknown" },
          { name: "Grade", value: grade },
          { name: "Status", value: status }
        );

      if (feedback) {
        embed.addFields({ name: "Feedback", value: feedback });
      }

      // Try to DM student
      try {
        const student = await this.client.users.fetch(submission.student_id);
        await student.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x0099ff)
              .setTitle(`📝 Grade Received: ${assignment?.title}`)
              .addFields(
                { name: "Grade", value: grade },
                { name: "Teacher", value: interaction.user.username }
              )
              .addFields({
                name: "Feedback",
                value: feedback || "No feedback provided",
              }),
          ],
        });
      } catch (err) {
        console.log("Could not DM student about grade");
      }

      // Log to operations
      const opsChannel = this.client.channels.cache.get(
        process.env.TAMMY_OPERATIONS_CHANNEL_ID
      );
      if (opsChannel) {
        await opsChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x00ff00)
              .setTitle("📊 Grade Recorded")
              .addFields(
                { name: "Student", value: submission.student_name },
                { name: "Assignment", value: assignment?.title || "Unknown" },
                { name: "Grade", value: grade }
              )
              .setTimestamp(),
          ],
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error grading assignment:", error);
      return interaction.editReply({
        content: "❌ Error recording grade. Check logs.",
      });
    }
  }

  /**
   * Command: /return-work
   * Teachers return work to students with feedback
   */
  getReturnCommand() {
    return new SlashCommandBuilder()
      .setName("return-work")
      .setDescription("Return work to student with feedback (teacher only)")
      .addUserOption((option) =>
        option
          .setName("student")
          .setDescription("Student to return work to")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("assignment_id")
          .setDescription("Assignment ID")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("feedback")
          .setDescription("Feedback for student")
          .setRequired(true)
      );
  }

  /**
   * Execute: /return-work
   */
  async executeReturn(interaction) {
    // Check access
    if (!(await this.access.hasRole(interaction.member, ["teacher", "admin"]))) {
      return interaction.reply({
        content: "❌ Only teachers can return work.",
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const student = interaction.options.getUser("student");
      const assignmentId = interaction.options.getString("assignment_id");
      const feedback = interaction.options.getString("feedback");

      // Get assignment
      const assignment = await this.sheets.getAssignmentById(assignmentId);
      if (!assignment) {
        return interaction.editReply({
          content: "❌ Assignment not found.",
        });
      }

      // Send feedback DM to student
      try {
        await student.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xffaa00)
              .setTitle(`📋 Work Returned: ${assignment.title}`)
              .setDescription(feedback)
              .addFields({
                name: "Teacher",
                value: interaction.user.username,
              }),
          ],
        });

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle("✅ Work Returned")
          .addFields(
            { name: "Student", value: student.username },
            { name: "Assignment", value: assignment.title }
          );

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({
          content: `❌ Could not DM ${student.username}. Check their DM settings.`,
        });
      }
    } catch (error) {
      console.error("Error returning work:", error);
      return interaction.editReply({
        content: "❌ Error returning work. Check logs.",
      });
    }
  }
}

module.exports = SubmissionManager;
