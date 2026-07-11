/**
 * Announcements & Classroom Feeds System
 *
 * Handles:
 * - Creating class announcements
 * - Lesson reminders
 * - Schedule updates
 * - Assignment reminders
 * - Targeted announcements by class/grade/role
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
} = require("discord.js");
const { v4: uuidv4 } = require("uuid");

class AnnouncementManager {
  constructor(client, sheetsManager, accessControl) {
    this.client = client;
    this.sheets = sheetsManager;
    this.access = accessControl;
  }

  /**
   * Command: /announce
   * Teachers create announcements
   */
  getAnnounceCommand() {
    return new SlashCommandBuilder()
      .setName("announce")
      .setDescription("Post a class announcement")
      .addStringOption((option) =>
        option
          .setName("type")
          .setDescription("Type of announcement")
          .setRequired(true)
          .addChoices(
            { name: "Class Announcement", value: "class-announcement" },
            { name: "Lesson Reminder", value: "lesson-reminder" },
            { name: "Schedule Update", value: "schedule-update" },
            { name: "Assignment Reminder", value: "assignment-reminder" }
          )
      )
      .addStringOption((option) =>
        option
          .setName("title")
          .setDescription("Announcement title")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("content")
          .setDescription("Announcement content")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("class_ids")
          .setDescription("Classes to target (comma-separated, empty = all)")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("grades")
          .setDescription("Grades to target (comma-separated, empty = all)")
          .setRequired(false)
      );
  }

  /**
   * Execute: /announce
   */
  async executeAnnounce(interaction) {
    // Check access
    if (!(await this.access.hasRole(interaction.member, ["teacher", "admin"]))) {
      return interaction.reply({
        content: "❌ Only teachers can post announcements.",
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const type = interaction.options.getString("type");
      const title = interaction.options.getString("title");
      const content = interaction.options.getString("content");
      const classIdsStr = interaction.options.getString("class_ids") || "";
      const gradesStr = interaction.options.getString("grades") || "";

      const classIds = classIdsStr
        ? classIdsStr.split(",").map((s) => s.trim())
        : [];
      const grades = gradesStr ? gradesStr.split(",").map((s) => s.trim()) : [];

      // Get target channel (use announcement channel if set)
      let targetChannel = interaction.guild.channels.cache.get(
        process.env.TAMMY_ANNOUNCE_CHANNEL_ID
      );

      // If no announcement channel, use current channel
      if (!targetChannel) {
        targetChannel = interaction.channel;
      }

      // Build announcement embed
      const embed = new EmbedBuilder()
        .setColor(this.getTypeColor(type))
        .setTitle(`📣 ${title}`)
        .setDescription(content)
        .setAuthor({
          name: interaction.user.username,
          iconURL: interaction.user.avatarURL(),
        })
        .setTimestamp();

      // Add targeting info if specified
      if (classIds.length > 0 || grades.length > 0) {
        let targetingInfo = "";
        if (classIds.length > 0) {
          targetingInfo += `Classes: ${classIds.join(", ")}\n`;
        }
        if (grades.length > 0) {
          targetingInfo += `Grades: ${grades.join(", ")}`;
        }
        embed.addFields({
          name: "Targeted To",
          value: targetingInfo,
        });
      } else {
        embed.addFields({
          name: "Visibility",
          value: "All students and staff",
        });
      }

      // Post announcement
      const message = await targetChannel.send({ embeds: [embed] });

      // Save to Google Sheets
      const announcementData = {
        announcement_id: uuidv4(),
        title: title,
        content: content,
        type: type,
        targeting_classes: classIds.join(","),
        targeting_grades: grades.join(","),
        targeting_roles: "student,parent,teacher",
        specific_thread_id: "",
        created_at: new Date().toISOString(),
        posted_at: new Date().toISOString(),
        created_by_teacher_id: interaction.user.id,
        status: "posted",
      };

      const saved = await this.sheets.createAnnouncement(announcementData);
      if (!saved) {
        console.error("Failed to save announcement to sheets");
      }

      // Send confirmation to teacher
      const confirmEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("✅ Announcement Posted")
        .addFields(
          { name: "Type", value: type },
          { name: "Title", value: title },
          { name: "Posted To", value: targetChannel.name }
        );

      return interaction.editReply({ embeds: [confirmEmbed] });
    } catch (error) {
      console.error("Error posting announcement:", error);
      return interaction.editReply({
        content: "❌ Error posting announcement. Check logs.",
      });
    }
  }

  /**
   * Command: /announce-list
   * View announcements
   */
  getAnnounceListCommand() {
    return new SlashCommandBuilder()
      .setName("announce-list")
      .setDescription("View recent announcements")
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("Number of announcements to show (max 10)")
          .setRequired(false)
      );
  }

  /**
   * Execute: /announce-list
   */
  async executeAnnounceList(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const limit = Math.min(interaction.options.getInteger("limit") || 5, 10);

      // Get announcements
      const announcements = await this.sheets.getAnnouncements();
      const recent = announcements
        .filter((a) => a.status === "posted")
        .sort(
          (a, b) => new Date(b.posted_at) - new Date(a.posted_at)
        )
        .slice(0, limit);

      if (recent.length === 0) {
        return interaction.editReply({
          content: "❌ No announcements found.",
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("📣 Recent Announcements")
        .setDescription(`Showing ${recent.length} announcements`);

      for (const ann of recent) {
        embed.addFields({
          name: ann.title,
          value: `${ann.content.substring(0, 100)}...\n_${ann.type} • ${new Date(ann.posted_at).toLocaleDateString()}_`,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error listing announcements:", error);
      return interaction.editReply({
        content: "❌ Error loading announcements. Check logs.",
      });
    }
  }

  /**
   * Helper: Get color based on announcement type
   */
  getTypeColor(type) {
    const colors = {
      "class-announcement": 0x0099ff,
      "lesson-reminder": 0x00ff00,
      "schedule-update": 0xffaa00,
      "assignment-reminder": 0xff00ff,
    };
    return colors[type] || 0x0099ff;
  }

  /**
   * Send assignment reminder
   * Called by teachers when posting assignment
   */
  async sendAssignmentReminder(assignment, targetRole = "student") {
    try {
      const guild = this.client.guilds.cache.first();
      if (!guild) return;

      // Get role ID
      const roleIdMap = {
        student: process.env.TAMMY_STUDENT_ROLE_ID,
        parent: process.env.TAMMY_PARENT_ROLE_ID,
        teacher: process.env.TAMMY_TEACHER_ROLE_ID,
      };

      const roleId = roleIdMap[targetRole];
      if (!roleId) return;

      // Get role members
      const role = guild.roles.cache.get(roleId);
      if (!role) return;

      const members = role.members.values();

      // Build reminder embed
      const embed = new EmbedBuilder()
        .setColor(0xff00ff)
        .setTitle(`📋 New Assignment: ${assignment.title}`)
        .setDescription(`Due: ${assignment.due_date}`)
        .addFields({
          name: "View Assignment",
          value: `Use \`/assignment-view ${assignment.assignment_id}\``,
        });

      // DM each member (limit to prevent spam)
      let count = 0;
      for (const member of members) {
        if (count >= 5) break; // Limit to 5 DMs per batch
        try {
          await member.send({ embeds: [embed] });
          count++;
        } catch (err) {
          console.log(`Could not DM ${member.user.username}`);
        }
      }

      console.log(`📬 Sent ${count} assignment reminders`);
    } catch (error) {
      console.error("Error sending assignment reminder:", error);
    }
  }

  /**
   * Send lesson reminder
   * Called by teachers
   */
  async sendLessonReminder(title, description, targetGrades = []) {
    try {
      const announceChannel = this.client.channels.cache.get(
        process.env.TAMMY_ANNOUNCE_CHANNEL_ID
      );

      if (!announceChannel) return;

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`🎓 Lesson Reminder: ${title}`)
        .setDescription(description)
        .addFields({
          name: "Grades",
          value:
            targetGrades.length > 0
              ? targetGrades.join(", ")
              : "All students",
        });

      await announceChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error("Error sending lesson reminder:", error);
    }
  }

  /**
   * Send schedule update
   */
  async sendScheduleUpdate(title, updates) {
    try {
      const announceChannel = this.client.channels.cache.get(
        process.env.TAMMY_ANNOUNCE_CHANNEL_ID
      );

      if (!announceChannel) return;

      const embed = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle(`📅 Schedule Update: ${title}`)
        .addFields({
          name: "Changes",
          value: updates,
        });

      await announceChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error("Error sending schedule update:", error);
    }
  }
}

module.exports = AnnouncementManager;
