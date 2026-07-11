/**
 * Portal Manager
 * Handles student and parent portals for viewing grades, assignments, and status
 */

const { EmbedBuilder } = require("discord.js");

class PortalManager {
  constructor(accessControl, sheetsManager) {
    this.ac = accessControl;
    this.sheets = sheetsManager;
    if (!global.parentLinks) global.parentLinks = {};
  }

  _resolveStudentIdForViewer(viewerId) {
    if (global.enrollmentData?.[viewerId]) return viewerId;
    const linkedStudentId = Object.keys(global.parentLinks || {}).find((sid) =>
      (global.parentLinks[sid] || []).includes(viewerId)
    );
    return linkedStudentId || null;
  }

  /**
   * Student status view
   */
  async studentStatus(interaction) {
    try {
      const studentId = this._resolveStudentIdForViewer(interaction.user.id);
      if (!studentId) {
        return interaction.reply({
          ephemeral: true,
          content: "❌ No linked student found for this account.",
        });
      }
      const student = global.enrollmentData?.[studentId];

      if (!student) {
        return interaction.reply({
          ephemeral: true,
          content: "❌ Student enrollment not found",
        });
      }

      let grades = Object.values(global.gradeData || {}).filter((g) => g.studentId === studentId);
      const masterLedgerId = process.env.TAMMY_MASTER_GRADE_LEDGER_SHEET_ID;
      if (masterLedgerId) {
        const sheetGrades = await this.sheets.getStudentGrades(masterLedgerId, student.studentUniqueId || studentId);
        if (sheetGrades.length) grades = sheetGrades;
      }
      const assignments = Object.values(global.assignmentData || {}).length;

      const avgGrade = grades.length > 0
        ? (grades.reduce((sum, g) => sum + Number(g.grade || 0), 0) / grades.length).toFixed(1)
        : "N/A";

      const embed = new EmbedBuilder()
        .setColor("#0099FF")
        .setTitle("📊 Student Status")
        .addFields(
          { name: "Name", value: student.name },
          { name: "Assignments Available", value: String(assignments) },
          { name: "Grades Received", value: String(grades.length) },
          { name: "Average Grade", value: String(avgGrade) }
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("Student status error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Error loading status" });
    }
  }

  /**
   * View grades
   */
  async viewGrades(interaction) {
    try {
      const studentId = this._resolveStudentIdForViewer(interaction.user.id);
      if (!studentId) {
        return interaction.reply({
          ephemeral: true,
          content: "❌ No linked student found for this account.",
        });
      }

      const student = global.enrollmentData?.[studentId];
      let grades = Object.values(global.gradeData || {}).filter((g) => g.studentId === studentId);
      const masterLedgerId = process.env.TAMMY_MASTER_GRADE_LEDGER_SHEET_ID;
      if (masterLedgerId) {
        const sheetGrades = await this.sheets.getStudentGrades(masterLedgerId, student?.studentUniqueId || studentId);
        if (sheetGrades.length) grades = sheetGrades;
      }

      if (grades.length === 0) {
        return interaction.reply({
          ephemeral: true,
          content: "📭 No grades yet.",
        });
      }

      let gradeList = grades
        .map((g) => {
          const numericGrade = Number(g.grade || 0);
          const color = numericGrade >= 90 ? "🟢" : numericGrade >= 80 ? "🟡" : numericGrade >= 70 ? "🟠" : "🔴";
          const assignmentId = g.assignmentId || g.assignment_id || "N/A";
          return `${color} Assignment \`${assignmentId}\`: **${numericGrade}**`;
        })
        .join("\n");

      const avgGrade = (grades.reduce((sum, g) => sum + Number(g.grade || 0), 0) / grades.length).toFixed(1);

      const embed = new EmbedBuilder()
        .setColor("#0099FF")
        .setTitle("📋 Your Grades")
        .setDescription(gradeList)
        .addFields({ name: "Average", value: String(avgGrade) });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("View grades error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Error loading grades" });
    }
  }

  /**
   * View assignments
   */
  async viewAssignments(interaction) {
    try {
      const assignments = Object.values(global.assignmentData || {});

      if (assignments.length === 0) {
        return interaction.reply({
          ephemeral: true,
          content: "📭 No assignments.",
        });
      }

      let assignmentList = assignments
        .map((a) => `**${a.title}**\nDue: ${a.dueDate}\nID: \`${a.id}\``)
        .join("\n\n");

      const embed = new EmbedBuilder()
        .setColor("#0099FF")
        .setTitle(`📚 Assignments (${assignments.length})`)
        .setDescription(assignmentList);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("View assignments error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Error loading assignments" });
    }
  }

  /**
   * Link parent to student
   */
  async linkParent(interaction) {
    try {
      const parentId = interaction.options.getString("parent-id");
      const studentId = interaction.user.id;

      if (!global.parentLinks[studentId]) {
        global.parentLinks[studentId] = [];
      }

      global.parentLinks[studentId].push(parentId);

      const embed = new EmbedBuilder()
        .setColor("#00AA00")
        .setTitle("✅ Parent Linked")
        .addFields({ name: "Parent Discord ID", value: parentId });

      // Send confirmation to parent
      try {
        const parent = await interaction.client.users.fetch(parentId);
        await parent.send({
          content: `✅ You have been linked to student. You can now view their grades and assignments.`,
        });
      } catch {}

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("Link parent error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Failed to link parent" });
    }
  }
}

module.exports = { PortalManager };
