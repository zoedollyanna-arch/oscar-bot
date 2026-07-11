/**
 * Teacher Thread Manager
 * Handles class status, student flagging, and staff notes
 */

const { EmbedBuilder } = require("discord.js");
const { v4: uuidv4 } = require("uuid");

class TeacherThreadManager {
  constructor(accessControl, sheetsManager) {
    this.ac = accessControl;
    this.sheets = sheetsManager;
    if (!global.flagData) global.flagData = {};
    if (!global.staffNotes) global.staffNotes = {};
  }

  /**
   * Class status report
   */
  async classStatus(interaction) {
    try {
      const attendanceCount = Object.keys(global.attendanceData || {}).length;
      const submissionCount = Object.keys(global.submissionData || {}).length;
      const studentCount = Object.keys(global.enrollmentData || {}).length;

      const embed = new EmbedBuilder()
        .setColor("#0099FF")
        .setTitle("📊 Class Status Report")
        .addFields(
          { name: "Enrolled Students", value: String(studentCount) },
          { name: "Check-Ins Today", value: String(attendanceCount) },
          { name: "Submissions", value: String(submissionCount) }
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("Class status error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Error loading status" });
    }
  }

  /**
   * Flag student with reason
   */
  async flagStudent(interaction) {
    try {
      const studentId = interaction.options.getString("student-id");
      const reason = interaction.options.getString("reason");
      const notifyParent = interaction.options.getBoolean("notify-parent") || false;

      const flagId = uuidv4().substring(0, 8);

      const flag = {
        id: flagId,
        studentId,
        reason,
        flaggedBy: interaction.user.id,
        flaggedAt: new Date().toISOString(),
        resolved: false,
      };

      global.flagData[flagId] = flag;

      const embed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTitle("🚩 Student Flagged")
        .addFields(
          { name: "Student ID", value: studentId },
          { name: "Reason", value: reason },
          { name: "Flag ID", value: `\`${flagId}\`` }
        );

      // Notify parent if enabled
      if (notifyParent) {
        try {
          const student = await interaction.client.users.fetch(studentId);
          await student.send({
            content: `⚠️ You have been flagged by staff.\n**Reason:** ${reason}\n\nPlease contact your teacher to discuss.`,
          });
        } catch {}
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("Flag student error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Failed to flag student" });
    }
  }

  /**
   * Add staff note (staff-only)
   */
  async addStudentNote(interaction) {
    try {
      const studentId = interaction.options.getString("student-id");
      const note = interaction.options.getString("note");

      if (!global.staffNotes[studentId]) {
        global.staffNotes[studentId] = [];
      }

      const noteId = uuidv4().substring(0, 8);
      global.staffNotes[studentId].push({
        id: noteId,
        content: note,
        addedBy: interaction.user.id,
        addedAt: new Date().toISOString(),
      });

      const embed = new EmbedBuilder()
        .setColor("#00AA00")
        .setTitle("📝 Staff Note Added")
        .addFields(
          { name: "Student ID", value: studentId },
          { name: "Note", value: note }
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("Add note error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Failed to add note" });
    }
  }
}

module.exports = { TeacherThreadManager };
