/**
 * Enrollment & Roster Management System
 *
 * Handles:
 * - Student profile registration
 * - Student profile viewing
 * - Roster management
 * - Enrollment status tracking
 * - Parent linkage
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

class EnrollmentManager {
  constructor(client, sheetsManager, accessControl) {
    this.client = client;
    this.sheets = sheetsManager;
    this.access = accessControl;
  }

  /**
   * Command: /academy register-discord
   * Staff registers a student by linking Discord ID to sheet row
   */
  getRegisterCommand() {
    return new SlashCommandBuilder()
      .setName("academy-register")
      .setDescription("Register a student Discord ID to their profile")
      .addUserOption((option) =>
        option
          .setName("student")
          .setDescription("The student to register")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("sl_username")
          .setDescription("SecondLife username to match in enrollment sheet")
          .setRequired(true)
      );
  }

  /**
   * Execute: /academy register-discord
   */
  async executeRegister(interaction) {
    const user = interaction.options.getUser("student");
    const slUsername = interaction.options.getString("sl_username");

    // Check access
    if (
      !(await this.access.isStaff(interaction.member))
    ) {
      return interaction.reply({
        content: "❌ Only staff can register students.",
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply();

      // Get students from sheets
      const students = await this.sheets.getStudents();
      const studentRecord = students.find(
        (s) => s.sl_username?.toLowerCase() === slUsername.toLowerCase()
      );

      if (!studentRecord) {
        return interaction.editReply({
          content: `❌ No student found with SL username: **${slUsername}**\nCheck the enrollment sheet.`,
        });
      }

      // Generate Student ID if not present
      const studentId = studentRecord.student_id || uuidv4();

      // Update student record
      const updated = await this.sheets.upsertStudent({
        student_id: studentId,
        discord_id: user.id,
        name: studentRecord.name || user.username,
        grade_level: studentRecord.grade_level || "",
        parent_discord_id: studentRecord.parent_discord_id || "",
        homeroom_teacher: studentRecord.homeroom_teacher || "",
        status: studentRecord.enrollment_status || "pending",
        missing_signature: studentRecord.missing_signature || false,
        age_verified: studentRecord.age_verified || false,
        profile_complete: studentRecord.profile_complete || false,
        enrollment_approved: studentRecord.enrollment_approved || false,
        enrolled_classes: studentRecord.enrolled_classes || "",
        registration_date: studentRecord.registration_date || new Date().toISOString(),
        last_updated: new Date().toISOString(),
        notes: studentRecord.notes || "",
      });

      if (!updated) {
        return interaction.editReply({
          content: "❌ Failed to update student record. Check logs.",
        });
      }

      // Create confirmation embed
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("✅ Student Registered")
        .setDescription(`Successfully linked ${user.mention} to enrollment data.`)
        .addFields(
          { name: "Student ID", value: studentId, inline: true },
          { name: "Discord ID", value: user.id, inline: true },
          { name: "SL Username", value: slUsername, inline: true },
          {
            name: "Grade Level",
            value: studentRecord.grade_level || "Not set",
            inline: true,
          }
        )
        .setFooter({ text: "Data synced to Google Sheets" });

      // Log to operations channel
      const opsChannel = this.client.channels.cache.get(
        process.env.TAMMY_OPERATIONS_CHANNEL_ID
      );
      if (opsChannel) {
        await opsChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x0099ff)
              .setTitle("📝 Student Registered")
              .addFields(
                { name: "Student", value: `${user.mention} (${user.id})` },
                { name: "SL Username", value: slUsername },
                { name: "Registered By", value: interaction.user.mention }
              )
              .setTimestamp(),
          ],
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in register command:", error);
      return interaction.editReply({
        content: "❌ Error during registration. Check bot logs.",
      });
    }
  }

  /**
   * Command: /academy profile
   * Students/Parents view their profile
   */
  getProfileCommand() {
    return new SlashCommandBuilder()
      .setName("academy-profile")
      .setDescription("View your student profile")
      .addUserOption((option) =>
        option
          .setName("student")
          .setDescription("Student to view (staff only)")
          .setRequired(false)
      );
  }

  /**
   * Execute: /academy profile
   */
  async executeProfile(interaction) {
    const targetUser = interaction.options.getUser("student") || interaction.user;
    const member = await interaction.guild.members.fetch(targetUser.id);

    // Access check: staff can view any, students/parents only their own
    const isStaff = await this.access.isStaff(member);
    if (!isStaff && targetUser.id !== interaction.user.id) {
      return interaction.reply({
        content: "❌ You can only view your own profile.",
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      // Get student from sheets
      const student = await this.sheets.getStudentByDiscordId(targetUser.id);

      if (!student) {
        return interaction.editReply({
          content: "❌ No student profile found. Contact staff to register.",
        });
      }

      // Build profile embed
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("📚 Student Profile")
        .setThumbnail(targetUser.avatarURL())
        .addFields(
          { name: "Name", value: student.name || "Not set", inline: true },
          { name: "Student ID", value: student.student_id || "Not assigned", inline: true },
          { name: "Discord", value: `<@${student.discord_id}>`, inline: true },
          { name: "Grade Level", value: student.grade_level || "Not set", inline: true },
          { name: "Status", value: student.status || "pending", inline: true },
          {
            name: "Enrollment Approved",
            value: student.enrollment_approved ? "✅ Yes" : "❌ No",
            inline: true,
          },
          {
            name: "Status Checks",
            value: `• Age Verified: ${student.age_verified ? "✅" : "❌"}\n• Signature: ${student.missing_signature ? "❌" : "✅"}\n• Profile Complete: ${student.profile_complete ? "✅" : "❌"}`,
          }
        );

      if (student.homeroom_teacher) {
        embed.addFields({
          name: "Homeroom Teacher",
          value: `<@${student.homeroom_teacher}>`,
        });
      }

      if (student.enrolled_classes) {
        embed.addFields({
          name: "Enrolled Classes",
          value: student.enrolled_classes,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in profile command:", error);
      return interaction.editReply({
        content: "❌ Error fetching profile. Check bot logs.",
      });
    }
  }

  /**
   * Command: /academy roster
   * Staff views class roster
   */
  getRosterCommand() {
    return new SlashCommandBuilder()
      .setName("academy-roster")
      .setDescription("View class roster (staff only)")
      .addStringOption((option) =>
        option
          .setName("class_id")
          .setDescription("Class ID to view")
          .setRequired(true)
      );
  }

  /**
   * Execute: /academy roster
   */
  async executeRoster(interaction) {
    const classId = interaction.options.getString("class_id");

    // Check access
    if (!(await this.access.isStaff(interaction.member))) {
      return interaction.reply({
        content: "❌ Only staff can view rosters.",
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      // Get all students (in real scenario, filter by class)
      const students = await this.sheets.getStudents();
      const classStudents = students.filter((s) =>
        s.enrolled_classes?.includes(classId)
      );

      if (classStudents.length === 0) {
        return interaction.editReply({
          content: `❌ No students found for class **${classId}**`,
        });
      }

      // Build roster embed
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`📋 Roster: ${classId}`)
        .setDescription(`${classStudents.length} student(s) enrolled`)
        .addFields(
          {
            name: "Students",
            value: classStudents
              .map((s) => `• ${s.name} (${s.status})`)
              .join("\n"),
          }
        );

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in roster command:", error);
      return interaction.editReply({
        content: "❌ Error fetching roster. Check bot logs.",
      });
    }
  }

  /**
   * Command: /academy enrollment-status
   * Students/Parents check enrollment status
   */
  getEnrollmentStatusCommand() {
    return new SlashCommandBuilder()
      .setName("academy-enrollment-status")
      .setDescription("Check your enrollment status");
  }

  /**
   * Execute: /academy enrollment-status
   */
  async executeEnrollmentStatus(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const student = await this.sheets.getStudentByDiscordId(interaction.user.id);

      if (!student) {
        return interaction.editReply({
          content:
            "❌ No enrollment record found. Please contact staff to begin enrollment.",
        });
      }

      const missingItems = [];
      if (!student.age_verified) missingItems.push("Age Verification");
      if (student.missing_signature) missingItems.push("Parent Signature");
      if (!student.profile_complete) missingItems.push("Complete Profile");

      const embed = new EmbedBuilder()
        .setColor(student.enrollment_approved ? 0x00ff00 : 0xffaa00)
        .setTitle("📝 Enrollment Status")
        .addFields(
          {
            name: "Overall Status",
            value: student.enrollment_approved ? "✅ Approved" : "⏳ Pending",
          },
          {
            name: "Status Checks",
            value: `• Age Verified: ${student.age_verified ? "✅" : "⏳"}\n• Signature: ${student.missing_signature ? "⏳" : "✅"}\n• Profile Complete: ${student.profile_complete ? "✅" : "⏳"}`,
          }
        );

      if (missingItems.length > 0) {
        embed.addFields({
          name: "Missing Items",
          value: missingItems.map((i) => `• ${i}`).join("\n"),
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in enrollment-status command:", error);
      return interaction.editReply({
        content: "❌ Error checking status. Check bot logs.",
      });
    }
  }
}

module.exports = EnrollmentManager;
