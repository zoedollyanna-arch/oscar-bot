/**
 * Submission Manager
 * Handles submission tracking, grading, and work return
 */

const { EmbedBuilder } = require("discord.js");
const { v4: uuidv4 } = require("uuid");

class SubmissionManager {
  constructor(accessControl, sheetsManager) {
    this.ac = accessControl;
    this.sheets = sheetsManager;
    if (!global.submissionData) global.submissionData = {};
    if (!global.gradeData) global.gradeData = {};
  }

  /**
   * Submit assignment
   */
  async submitAssignment(interaction) {
    try {
      const assignmentId = interaction.options.getString("assignment-id");
      const submissionLink = interaction.options.getString("link");

      if (!global.assignmentData || !global.assignmentData[assignmentId]) {
        return interaction.reply({
          ephemeral: true,
          content: `❌ Assignment **${assignmentId}** not found`,
        });
      }

      const submissionId = uuidv4().substring(0, 8);
      const submission = {
        id: submissionId,
        assignmentId,
        studentId: interaction.user.id,
        studentName: interaction.user.username,
        link: submissionLink,
        submittedAt: new Date().toISOString(),
        status: "submitted",
      };

      global.submissionData[submissionId] = submission;

      const submissionsLogSheetId = process.env.TAMMY_SUBMISSIONS_LOG_SHEET_ID;
      if (submissionsLogSheetId) {
        await this.sheets.appendRow(submissionsLogSheetId, "academy-submissions-log", [
          submissionId,
          assignmentId,
          submission.studentId,
          submission.studentName,
          submission.link,
          submission.submittedAt,
          submission.status,
        ]);
      }

      const opsChannelId = process.env.TAMMY_OPERATIONS_CHANNEL_ID;
      if (opsChannelId && interaction.guild) {
        try {
          const opsChannel = await interaction.client.channels.fetch(opsChannelId);
          await opsChannel.send({ embeds: [embed] });
        } catch {}
      }

      const embed = new EmbedBuilder()
        .setColor("#00AA00")
        .setTitle("✅ Submission Received")
        .addFields(
          { name: "Assignment ID", value: assignmentId },
          { name: "Submission ID", value: `\`${submissionId}\`` },
          { name: "Submitted", value: new Date().toLocaleDateString() }
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("Submit error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Failed to submit" });
    }
  }

  /**
   * View submissions for assignment
   */
  async viewSubmissions(interaction) {
    try {
      const assignmentId = interaction.options.getString("assignment-id");
      const submissions = Object.values(global.submissionData || {}).filter(
        (s) => s.assignmentId === assignmentId
      );

      if (submissions.length === 0) {
        return interaction.reply({
          ephemeral: true,
          content: `📭 No submissions for assignment **${assignmentId}**`,
        });
      }

      let list = submissions
        .map((s) => `${s.studentName} - Status: **${s.status}**\nID: \`${s.id}\``)
        .join("\n\n");

      const embed = new EmbedBuilder()
        .setColor("#0099FF")
        .setTitle(`📤 Submissions (${submissions.length})`)
        .setDescription(list);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("View submissions error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Error loading submissions" });
    }
  }

  /**
   * Grade assignment
   */
  async gradeAssignment(interaction) {
    try {
      const submissionId = interaction.options.getString("submission-id");
      const grade = interaction.options.getNumber("grade");
      const feedback = interaction.options.getString("feedback", false) || "Great work!";

      if (!global.submissionData[submissionId]) {
        return interaction.reply({
          ephemeral: true,
          content: `❌ Submission **${submissionId}** not found`,
        });
      }

      const submission = global.submissionData[submissionId];
      global.gradeData[submissionId] = {
        submissionId,
        assignmentId: submission.assignmentId,
        studentId: submission.studentId,
        grade,
        feedback,
        gradedAt: new Date().toISOString(),
        gradedBy: interaction.user.id,
      };

      submission.status = "graded";
      submission.grade = grade;

      const embed = new EmbedBuilder()
        .setColor("#00AA00")
        .setTitle("✅ Grade Recorded")
        .addFields(
          { name: "Submission ID", value: submissionId },
          { name: "Grade", value: String(grade) },
          { name: "Feedback", value: feedback }
        );

      const gradesLogSheetId = process.env.TAMMY_GRADES_LOG_SHEET_ID;
      if (gradesLogSheetId) {
        await this.sheets.appendRow(gradesLogSheetId, "academy-grades-log", [
          submissionId,
          submission.assignmentId,
          submission.studentId,
          grade,
          feedback,
          new Date().toISOString(),
          interaction.user.id,
        ]);
      }

      const opsChannelId = process.env.TAMMY_OPERATIONS_CHANNEL_ID;
      if (opsChannelId && interaction.guild) {
        try {
          const opsChannel = await interaction.client.channels.fetch(opsChannelId);
          await opsChannel.send({ embeds: [embed] });
        } catch {}
      }

      // Try to DM student
      try {
        const user = await interaction.client.users.fetch(submission.studentId);
        await user.send({
          content: `📧 You received a grade on assignment **${submission.assignmentId}**\n**Grade:** ${grade}\n**Feedback:** ${feedback}`,
        });
      } catch {}

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("Grade error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Failed to grade" });
    }
  }

  /**
   * Return work to student
   */
  async returnWork(interaction) {
    try {
      const submissionId = interaction.options.getString("submission-id");
      const notes = interaction.options.getString("notes", false) || "Please revise and resubmit.";

      if (!global.submissionData[submissionId]) {
        return interaction.reply({
          ephemeral: true,
          content: `❌ Submission **${submissionId}** not found`,
        });
      }

      const submission = global.submissionData[submissionId];
      submission.status = "returned";
      submission.returnedAt = new Date().toISOString();
      submission.returnNotes = notes;

      const embed = new EmbedBuilder()
        .setColor("#FF9900")
        .setTitle("📨 Work Returned")
        .addFields({ name: "Notes", value: notes });

      // Try to DM student
      try {
        const user = await interaction.client.users.fetch(submission.studentId);
        await user.send({
          content: `📧 Your work was returned for revision:\n**Notes:** ${notes}`,
        });
      } catch {}

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("Return work error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Failed to return work" });
    }
  }
}

module.exports = { SubmissionManager };
