/**
 * Assignment Manager
 * Handles assignment creation, viewing, and listing
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const { v4: uuidv4 } = require("uuid");

class AssignmentManager {
  constructor(accessControl, sheetsManager) {
    this.ac = accessControl;
    this.sheets = sheetsManager;
    if (!global.assignmentData) global.assignmentData = {};
  }

  /**
   * Create assignment
   */
  async createAssignment(interaction) {
    try {
      const classGrade = interaction.options.getString("class-grade");
      const title = interaction.options.getString("title");
      const description = interaction.options.getString("description", false) || "No description";
      const dueDate = interaction.options.getString("due-date");
      const submissionType = interaction.options.getString("type");

      const assignmentId = uuidv4().substring(0, 8);
      const assignment = {
        id: assignmentId,
        classGrade,
        title,
        description,
        dueDate,
        submissionType,
        createdBy: interaction.user.id,
        createdAt: new Date().toISOString(),
        threadId: interaction.channelId,
      };

      global.assignmentData[assignmentId] = assignment;

      const embed = new EmbedBuilder()
        .setColor("#00AA00")
        .setTitle(`✅ Assignment Created`)
        .addFields(
          { name: "Class / Grade", value: classGrade },
          { name: "Title", value: title },
          { name: "Due Date", value: dueDate },
          { name: "Submission Type", value: submissionType },
          { name: "Assignment ID", value: `\`${assignmentId}\`` }
        );

      const assignmentsLogSheetId = process.env.TAMMY_ASSIGNMENTS_LOG_SHEET_ID;
      if (assignmentsLogSheetId) {
        await this.sheets.appendRow(assignmentsLogSheetId, "academy-assignments-log", [
          assignmentId,
          classGrade,
          title,
          description,
          dueDate,
          submissionType,
          interaction.user.id,
          new Date().toISOString(),
          interaction.channelId,
        ]);
      }

      const opsChannelId = process.env.TAMMY_OPERATIONS_CHANNEL_ID;
      if (opsChannelId && interaction.guild) {
        try {
          const opsChannel = await interaction.client.channels.fetch(opsChannelId);
          await opsChannel.send({ embeds: [embed] });
        } catch {}
      }

      return interaction.reply({ embeds: [embed] });
    } catch (e) {
      console.error("Create assignment error:", e);
      return interaction.reply({
        ephemeral: true,
        content: "❌ Failed to create assignment",
      });
    }
  }

  /**
   * View assignment details
   */
  async viewAssignment(interaction) {
    try {
      const assignmentId = interaction.options.getString("assignment-id");
      const assignment = global.assignmentData[assignmentId];

      if (!assignment) {
        return interaction.reply({
          ephemeral: true,
          content: `❌ Assignment **${assignmentId}** not found`,
        });
      }

      const embed = new EmbedBuilder()
        .setColor("#0099FF")
        .setTitle(assignment.title)
        .setDescription(assignment.description)
        .addFields(
          { name: "Class / Grade", value: assignment.classGrade || "Not set" },
          { name: "Due Date", value: assignment.dueDate },
          { name: "Submission Type", value: assignment.submissionType },
          { name: "Created", value: new Date(assignment.createdAt).toLocaleDateString() }
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("View assignment error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Error loading assignment" });
    }
  }

  /**
   * List all assignments
   */
  async listAssignments(interaction) {
    try {
      const assignments = Object.values(global.assignmentData || {});

      if (assignments.length === 0) {
        return interaction.reply({
          ephemeral: true,
          content: "📭 No assignments posted yet.",
        });
      }

      let list = assignments
        .map((a) => `**${a.title}** (${a.classGrade || "Class/Grade not set"})\nDue: ${a.dueDate}\nID: \`${a.id}\``)
        .join("\n\n");

      const embed = new EmbedBuilder()
        .setColor("#FF9900")
        .setTitle(`📋 Assignments (${assignments.length})`)
        .setDescription(list);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("List assignments error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Error loading assignments" });
    }
  }
}

module.exports = { AssignmentManager };
