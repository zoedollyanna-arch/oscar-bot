/**
 * Teacher Thread Actions System
 *
 * Handles:
 * - Class status reports
 * - Flagging students
 * - Staff notes
 * - Parent visibility controls
 * - Audit logging
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
} = require("discord.js");
const { v4: uuidv4 } = require("uuid");

class TeacherThreadManager {
  constructor(client, sheetsManager, accessControl) {
    this.client = client;
    this.sheets = sheetsManager;
    this.access = accessControl;
  }

  /**
   * Command: /class-status
   * Teachers report class status
   */
  getClassStatusCommand() {
    return new SlashCommandBuilder()
      .setName("class-status")
      .setDescription("Report class status (teacher only)")
      .addStringOption((option) =>
        option
          .setName("class_id")
          .setDescription("Class ID")
          .setRequired(true)
      );
  }

  /**
   * Execute: /class-status
   */
  async executeClassStatus(interaction) {
    // Check access
    if (!(await this.access.hasRole(interaction.member, ["teacher", "admin"]))) {
      return interaction.reply({
        content: "❌ Only teachers can report class status.",
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const classId = interaction.options.getString("class_id");
      const today = new Date().toISOString().split("T")[0];

      // Get attendance for today
      const todayAttendance = await this.sheets.getAttendance(today);
      const classAttendance = todayAttendance.filter((a) => a.class_id === classId);

      // Get assignments for class
      const assignments = await this.sheets.getAssignmentsByClass(classId);
      const recentAssignments = assignments
        .filter((a) => a.status === "posted")
        .slice(0, 3);

      // Get submissions
      let totalSubmissions = 0;
      let lateSubmissions = 0;
      for (const assignment of recentAssignments) {
        const submissions = await this.sheets.getSubmissionsByAssignment(assignment.assignment_id);
        totalSubmissions += submissions.length;
        lateSubmissions += submissions.filter((s) => s.status === "late").length;
      }

      // Build status embed
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`📊 Class Status: ${classId}`)
        .setDescription(new Date().toLocaleDateString())
        .addFields(
          {
            name: "Attendance",
            value: `✅ Present: ${classAttendance.filter((a) => a.status === "present").length} | ⏰ Late: ${classAttendance.filter((a) => a.status === "late").length} | ❌ Absent: ${classAttendance.filter((a) => a.status === "absent").length}`,
          },
          {
            name: "Recent Assignments",
            value:
              recentAssignments.length > 0
                ? recentAssignments.map((a) => `• ${a.title}`).join("\n")
                : "No recent assignments",
          },
          {
            name: "Submission Status",
            value:
              totalSubmissions > 0
                ? `${totalSubmissions} total | ${lateSubmissions} late`
                : "No submissions yet",
          }
        )
        .setAuthor({
          name: interaction.user.username,
          iconURL: interaction.user.avatarURL(),
        })
        .setTimestamp();

      // Log to operations
      const opsChannel = this.client.channels.cache.get(
        process.env.TAMMY_OPERATIONS_CHANNEL_ID
      );
      if (opsChannel) {
        await opsChannel.send({
          embeds: [embed],
        });
      }

      return interaction.editReply({
        content: "✅ Class status reported.",
        embeds: [embed],
      });
    } catch (error) {
      console.error("Error in class-status:", error);
      return interaction.editReply({
        content: "❌ Error reporting class status. Check logs.",
      });
    }
  }

  /**
   * Command: /flag-student
   * Teachers flag students with notes
   */
  getFlagStudentCommand() {
    return new SlashCommandBuilder()
      .setName("flag-student")
      .setDescription("Flag a student for staff attention")
      .addUserOption((option) =>
        option
          .setName("student")
          .setDescription("Student to flag")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("Reason for flag")
          .setRequired(true)
          .addChoices(
            { name: "Missing Work", value: "missing-work" },
            { name: "Behavior Concern", value: "behavior" },
            { name: "Attendance Issue", value: "attendance" },
            { name: "Academic Struggle", value: "academic" },
            { name: "Positive Recognition", value: "positive" },
            { name: "Other", value: "other" }
          )
      )
      .addStringOption((option) =>
        option
          .setName("note")
          .setDescription("Detailed note about the flag")
          .setRequired(true)
      )
      .addBooleanOption((option) =>
        option
          .setName("notify_parent")
          .setDescription("Notify parent via DM? (default: false)")
          .setRequired(false)
      );
  }

  /**
   * Execute: /flag-student
   */
  async executeFlagStudent(interaction) {
    // Check access
    if (!(await this.access.hasRole(interaction.member, ["teacher", "admin"]))) {
      return interaction.reply({
        content: "❌ Only teachers can flag students.",
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const user = interaction.options.getUser("student");
      const reason = interaction.options.getString("reason");
      const note = interaction.options.getString("note");
      const notifyParent = interaction.options.getBoolean("notify_parent") || false;

      // Get student
      const student = await this.sheets.getStudentByDiscordId(user.id);
      if (!student) {
        return interaction.editReply({
          content: "❌ Student profile not found.",
        });
      }

      // Log action
      const actionData = {
        action_id: uuidv4(),
        thread_id: interaction.channelId,
        class_id: interaction.channelId,
        teacher_id: interaction.user.id,
        action_type: "flag-student",
        action_data: JSON.stringify({ reason, note }),
        visibility: notifyParent ? "parent-visible" : "staff-only",
        parent_dm_sent: notifyParent ? true : false,
        timestamp: new Date().toISOString(),
      };

      await this.sheets.logTeacherAction(actionData);

      // Build staff embed (detailed)
      const staffEmbed = new EmbedBuilder()
        .setColor(reason === "positive" ? 0x00ff00 : 0xff0000)
        .setTitle(
          `🚩 Student Flag: ${reason === "positive" ? "Positive" : "Needs Attention"}`
        )
        .addFields(
          { name: "Student", value: `${user.mention} (${student.name})` },
          { name: "Reason", value: this.getReasonLabel(reason) },
          { name: "Note", value: note },
          { name: "Flagged By", value: interaction.user.mention },
          { name: "Visibility", value: notifyParent ? "Parent notified" : "Staff only" }
        )
        .setTimestamp();

      // Log to operations
      const opsChannel = this.client.channels.cache.get(
        process.env.TAMMY_OPERATIONS_CHANNEL_ID
      );
      if (opsChannel) {
        await opsChannel.send({ embeds: [staffEmbed] });
      }

      // If parent notify, send parent embed (less detailed)
      if (notifyParent && student.parent_discord_id) {
        try {
          const parent = await this.client.users.fetch(student.parent_discord_id);
          const parentEmbed = new EmbedBuilder()
            .setColor(reason === "positive" ? 0x00ff00 : 0xffaa00)
            .setTitle(
              reason === "positive"
                ? `🌟 Positive Note about ${student.name}`
                : `📝 Note from ${interaction.user.username}`
            )
            .setDescription(note)
            .addFields({
              name: "Regarding",
              value: this.getReasonLabel(reason),
            })
            .addFields({
              name: "Next Steps",
              value: "Please reply to this message or contact the teacher directly if you have questions.",
            });

          await parent.send({ embeds: [parentEmbed] });
          actionData.parent_dm_sent = true;
        } catch (err) {
          console.log("Could not DM parent about flag");
        }
      }

      const confirmEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("✅ Student Flagged")
        .addFields(
          { name: "Student", value: student.name },
          { name: "Reason", value: this.getReasonLabel(reason) },
          {
            name: "Parent Notified",
            value: notifyParent ? "✅ Yes" : "❌ No",
          }
        );

      return interaction.editReply({ embeds: [confirmEmbed] });
    } catch (error) {
      console.error("Error flagging student:", error);
      return interaction.editReply({
        content: "❌ Error flagging student. Check logs.",
      });
    }
  }

  /**
   * Command: /add-student-note
   * Add internal note about student (staff only)
   */
  getAddNoteCommand() {
    return new SlashCommandBuilder()
      .setName("add-student-note")
      .setDescription("Add internal note about student (staff only)")
      .addUserOption((option) =>
        option
          .setName("student")
          .setDescription("Student to note")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("note")
          .setDescription("Staff note (not visible to parents)")
          .setRequired(true)
      );
  }

  /**
   * Execute: /add-student-note
   */
  async executeAddNote(interaction) {
    // Check access
    if (!(await this.access.isStaff(interaction.member))) {
      return interaction.reply({
        content: "❌ Only staff can add notes.",
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const user = interaction.options.getUser("student");
      const note = interaction.options.getString("note");

      // Get student
      const student = await this.sheets.getStudentByDiscordId(user.id);
      if (!student) {
        return interaction.editReply({
          content: "❌ Student profile not found.",
        });
      }

      // Log action
      const actionData = {
        action_id: uuidv4(),
        thread_id: interaction.channelId,
        class_id: interaction.channelId,
        teacher_id: interaction.user.id,
        action_type: "note-student",
        action_data: JSON.stringify({ note }),
        visibility: "staff-only",
        parent_dm_sent: false,
        timestamp: new Date().toISOString(),
      };

      await this.sheets.logTeacherAction(actionData);

      // Log to operations
      const opsChannel = this.client.channels.cache.get(
        process.env.TAMMY_OPERATIONS_CHANNEL_ID
      );
      if (opsChannel) {
        await opsChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x0099ff)
              .setTitle("📝 Staff Note Added")
              .addFields(
                { name: "Student", value: student.name },
                { name: "Note", value: note },
                { name: "Added By", value: interaction.user.mention }
              )
              .setTimestamp(),
          ],
        });
      }

      return interaction.editReply({
        content: `✅ Note added to ${student.name}'s record.`,
      });
    } catch (error) {
      console.error("Error adding note:", error);
      return interaction.editReply({
        content: "❌ Error adding note. Check logs.",
      });
    }
  }

  /**
   * Helper: Get human-readable reason label
   */
  getReasonLabel(reason) {
    const labels = {
      "missing-work": "📋 Missing Work",
      behavior: "⚠️ Behavior Concern",
      attendance: "📅 Attendance Issue",
      academic: "📚 Academic Struggle",
      positive: "🌟 Positive Recognition",
      other: "📝 Other",
    };
    return labels[reason] || reason;
  }
}

module.exports = TeacherThreadManager;
