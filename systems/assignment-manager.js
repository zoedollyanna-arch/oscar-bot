/**
 * Assignment Management System
 *
 * Handles:
 * - Creating assignments in teacher threads
 * - Posting assignment embeds
 * - Managing submission types (Discord, Google, External, Workbook HUD)
 * - Tracking submissions
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
} = require("discord.js");
const { v4: uuidv4 } = require("uuid");

class AssignmentManager {
  constructor(client, sheetsManager, accessControl) {
    this.client = client;
    this.sheets = sheetsManager;
    this.access = accessControl;
  }

  /**
   * Command: /assignment-create
   * Teachers create assignments in their threads
   */
  getCreateCommand() {
    return new SlashCommandBuilder()
      .setName("assignment-create")
      .setDescription("Create an assignment (must be in teacher thread)")
      .addStringOption((option) =>
        option
          .setName("grade_level")
          .setDescription("Grade level for this assignment")
          .setRequired(true)
          .addChoices(
            { name: "Kindergarten", value: "Kindergarten" },
            { name: "Elementary", value: "Elementary" },
            { name: "Middle School", value: "MiddleSchool" },
            { name: "High School", value: "HighSchool" }
          )
      )
      .addStringOption((option) =>
        option
          .setName("title")
          .setDescription("Assignment title")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("instructions")
          .setDescription("Assignment instructions (detailed)")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("due_date")
          .setDescription("Due date (YYYY-MM-DD)")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("submission_type")
          .setDescription("How students submit")
          .setRequired(true)
          .addChoices(
            { name: "Discord Text Reply", value: "discord-text" },
            { name: "Discord Modal", value: "discord-modal" },
            { name: "Google Doc", value: "google-doc" },
            { name: "Google Form", value: "google-form" },
            { name: "External Link", value: "external-link" },
            { name: "Workbook HUD", value: "workbook-hud" }
          )
      );
  }

  /**
   * Execute: /assignment-create
   */
  async executeCreate(interaction) {
    // Check if in thread
    if (!interaction.channel.isThread()) {
      return interaction.reply({
        content: "❌ Assignments must be posted in teacher threads only.",
        ephemeral: true,
      });
    }

    // Check access
    if (!(await this.access.hasRole(interaction.member, ["teacher", "admin"]))) {
      return interaction.reply({
        content: "❌ Only teachers can create assignments.",
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply();

      const gradeLevel = interaction.options.getString("grade_level");
      const title = interaction.options.getString("title");
      const instructions = interaction.options.getString("instructions");
      const dueDate = interaction.options.getString("due_date");
      const submissionType = interaction.options.getString("submission_type");

      // Validate date format
      if (!this.isValidDate(dueDate)) {
        return interaction.editReply({
          content:
            "❌ Invalid due date format. Use YYYY-MM-DD (e.g., 2026-02-15)",
        });
      }

      const assignmentId = uuidv4();

      // Build assignment embed
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`📋 ${title}`)
        .setDescription(`**Due:** ${dueDate}`)
        .addFields(
          {
            name: "Instructions",
            value: instructions.substring(0, 1024),
          },
          {
            name: "Submission Type",
            value: this.getSubmissionTypeLabel(submissionType),
            inline: true,
          },
          {
            name: "Assignment ID",
            value: assignmentId,
            inline: true,
          }
        )
        .setAuthor({
          name: interaction.user.username,
          iconURL: interaction.user.avatarURL(),
        })
        .setFooter({ text: "Use /submit-assignment to turn in work" })
        .setTimestamp();

      // Build submission instructions based on type
      const submissionInfo = this.getSubmissionInstructions(submissionType);
      embed.addFields({
        name: "How to Submit",
        value: submissionInfo,
      });

      // Post assignment to thread
      const assignmentMessage = await interaction.channel.send({
        embeds: [embed],
      });

      // Save to Google Sheets
      const saved = await this.sheets.createAssignment({
        assignment_id: assignmentId,
        class_id: interaction.channelId,
        teacher_id: interaction.user.id,
        title: title,
        instructions: instructions,
        due_date: dueDate,
        submission_type: submissionType,
        submission_details: "",
        discord_message_id: assignmentMessage.id,
        discord_thread_id: interaction.channelId,
        status: "posted",
        created_date: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      });

      if (!saved) {
        console.error("Failed to save assignment to sheets");
      }

      // Log to operations
      const opsChannel = this.client.channels.cache.get(
        process.env.TAMMY_OPERATIONS_CHANNEL_ID
      );
      if (opsChannel) {
        await opsChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x0099ff)
              .setTitle("📝 Assignment Created")
              .addFields(
                { name: "Title", value: title, inline: true },
                { name: "Grade Level", value: gradeLevel, inline: true },
                { name: "Due Date", value: dueDate, inline: true },
                { name: "Submission Type", value: submissionType, inline: true },
                { name: "Thread Link", value: `[View](${assignmentMessage.url})` }
              )
              .setTimestamp(),
          ],
        });
      }

      return interaction.editReply({
        content: `✅ Assignment **${title}** posted to thread!`,
      });
    } catch (error) {
      console.error("Error creating assignment:", error);
      return interaction.editReply({
        content: "❌ Error creating assignment. Check logs.",
      });
    }
  }

  /**
   * Command: /assignment-view
   * View specific assignment details
   */
  getViewCommand() {
    return new SlashCommandBuilder()
      .setName("assignment-view")
      .setDescription("View assignment details")
      .addStringOption((option) =>
        option
          .setName("assignment_id")
          .setDescription("Assignment ID to view")
          .setRequired(true)
      );
  }

  /**
   * Execute: /assignment-view
   */
  async executeView(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const assignmentId = interaction.options.getString("assignment_id");
      const assignment = await this.sheets.getAssignmentById(assignmentId);

      if (!assignment) {
        return interaction.editReply({
          content: "❌ Assignment not found.",
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(assignment.title)
        .addFields(
          { name: "Due Date", value: assignment.due_date, inline: true },
          {
            name: "Submission Type",
            value: this.getSubmissionTypeLabel(assignment.submission_type),
            inline: true,
          },
          { name: "Status", value: assignment.status || "posted", inline: true },
          {
            name: "Instructions",
            value: assignment.instructions.substring(0, 1024),
          }
        );

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error viewing assignment:", error);
      return interaction.editReply({
        content: "❌ Error loading assignment. Check logs.",
      });
    }
  }

  /**
   * Command: /assignment-list
   * Teachers view their assignments
   */
  getListCommand() {
    return new SlashCommandBuilder()
      .setName("assignment-list")
      .setDescription("View your assignments (teacher only)")
      .addStringOption((option) =>
        option
          .setName("filter")
          .setDescription("Filter by status")
          .addChoices(
            { name: "Active", value: "posted" },
            { name: "Closed", value: "closed" },
            { name: "All", value: "all" }
          )
      );
  }

  /**
   * Execute: /assignment-list
   */
  async executeList(interaction) {
    // Check access
    if (!(await this.access.isStaff(interaction.member))) {
      return interaction.reply({
        content: "❌ Only staff can view assignment lists.",
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const filter = interaction.options.getString("filter") || "all";
      const assignments = await this.sheets.getAssignments();

      let filtered = assignments.filter((a) => a.teacher_id === interaction.user.id);
      if (filter !== "all") {
        filtered = filtered.filter((a) => a.status === filter);
      }

      if (filtered.length === 0) {
        return interaction.editReply({
          content: "❌ No assignments found.",
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`📚 Your Assignments (${filter})`)
        .setDescription(filtered.length + " assignment(s)")
        .addFields(
          {
            name: "Assignments",
            value: filtered
              .map(
                (a) =>
                  `• **${a.title}** (Due: ${a.due_date}) - ${a.status}`
              )
              .join("\n"),
          }
        );

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error listing assignments:", error);
      return interaction.editReply({
        content: "❌ Error loading assignments. Check logs.",
      });
    }
  }

  /**
   * Helper: Check if date is valid
   */
  isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    return regex.test(dateString) && !isNaN(Date.parse(dateString));
  }

  /**
   * Helper: Get human-readable submission type label
   */
  getSubmissionTypeLabel(type) {
    const labels = {
      "discord-text": "Discord Text Reply",
      "discord-modal": "Discord Modal Form",
      "google-doc": "Google Doc Link",
      "google-form": "Google Form Response",
      "external-link": "External Website Link",
      "workbook-hud": "Workbook HUD Completion",
    };
    return labels[type] || type;
  }

  /**
   * Helper: Get submission instructions by type
   */
  getSubmissionInstructions(type) {
    const instructions = {
      "discord-text":
        "Reply to this thread with your answer or work.\n\n```\n/submit-assignment [assignment-id] [your-work]\n```",
      "discord-modal":
        "Click the submit button below to fill out a form.\n\nYou'll have fields to describe your work in detail.",
      "google-doc":
        "Create a Google Doc, share it, and submit the link.\n\n```\n/submit-assignment [assignment-id] [doc-url]\n```",
      "google-form":
        "Fill out the Google Form linked by your teacher.\n\nYour responses are automatically recorded.",
      "external-link":
        "Submit your work via the external platform.\n\nYour teacher will provide the link.",
      "workbook-hud":
        "Complete the task in your Workbook HUD in-world.\n\nYour completion will be automatically logged.",
    };
    return instructions[type] || "Contact your teacher for submission details.";
  }
}

module.exports = AssignmentManager;
