/**
 * Attendance & Daily Check-In System
 *
 * Handles:
 * - Student check-ins
 * - Attendance logging (present, late, excused, absent)
 * - Chronic absence flagging
 * - Parent alerts
 * - Attendance viewing
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

class AttendanceManager {
  constructor(client, sheetsManager, accessControl) {
    this.client = client;
    this.sheets = sheetsManager;
    this.access = accessControl;
  }

  /**
   * Command: /check-in
   * Students check in for class
   */
  getCheckInCommand() {
    return new SlashCommandBuilder()
      .setName("check-in")
      .setDescription("Check in for class")
      .addStringOption((option) =>
        option
          .setName("class_id")
          .setDescription("Class ID")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("status")
          .setDescription("Your status")
          .setRequired(false)
          .addChoices(
            { name: "Present", value: "present" },
            { name: "Late", value: "late" },
            { name: "Excused", value: "excused" }
          )
      );
  }

  /**
   * Execute: /check-in
   */
  async executeCheckIn(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const classId = interaction.options.getString("class_id");
      const status = interaction.options.getString("status") || "present";

      // Get student
      const student = await this.sheets.getStudentByDiscordId(interaction.user.id);
      if (!student) {
        return interaction.editReply({
          content: "❌ No student profile found. Contact staff.",
        });
      }

      // Get today's date
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

      // Check if already checked in today
      const existingAttendance = await this.sheets.getAttendance(dateStr);
      const alreadyChecked = existingAttendance.find(
        (a) => a.student_id === student.student_id && a.class_id === classId
      );

      if (alreadyChecked) {
        return interaction.editReply({
          content: `⚠️ You've already checked in for **${classId}** today.`,
        });
      }

      // Log attendance
      const attendanceData = {
        attendance_id: uuidv4(),
        student_id: student.student_id,
        class_id: classId,
        check_in_date: dateStr,
        status: status,
        checked_in_at: today.toISOString(),
        excused_reason: "",
        recorded_by_teacher_id: interaction.user.id,
      };

      const saved = await this.sheets.logAttendance(attendanceData);
      if (!saved) {
        return interaction.editReply({
          content: "❌ Failed to record check-in. Please try again.",
        });
      }

      // Create confirmation
      const statusEmoji = {
        present: "✅",
        late: "⏰",
        excused: "📝",
        absent: "❌",
      };

      const embed = new EmbedBuilder()
        .setColor(status === "present" ? 0x00ff00 : 0xffaa00)
        .setTitle("✅ Check-In Recorded")
        .addFields(
          { name: "Class", value: classId },
          { name: "Status", value: `${statusEmoji[status]} ${status}` },
          { name: "Time", value: today.toLocaleTimeString() }
        );

      // Log to operations
      const opsChannel = this.client.channels.cache.get(
        process.env.TAMMY_OPERATIONS_CHANNEL_ID
      );
      if (opsChannel) {
        await opsChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(status === "present" ? 0x00ff00 : 0xffaa00)
              .setTitle("📋 Student Check-In")
              .addFields(
                { name: "Student", value: student.name },
                { name: "Class", value: classId },
                { name: "Status", value: status }
              )
              .setTimestamp(),
          ],
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in check-in:", error);
      return interaction.editReply({
        content: "❌ Error recording check-in. Check logs.",
      });
    }
  }

  /**
   * Command: /attendance-log
   * Teachers log attendance manually
   */
  getAttendanceLogCommand() {
    return new SlashCommandBuilder()
      .setName("attendance-log")
      .setDescription("Log attendance for a student (teacher only)")
      .addUserOption((option) =>
        option
          .setName("student")
          .setDescription("Student to log for")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("class_id")
          .setDescription("Class ID")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("status")
          .setDescription("Attendance status")
          .setRequired(true)
          .addChoices(
            { name: "Present", value: "present" },
            { name: "Late", value: "late" },
            { name: "Excused", value: "excused" },
            { name: "Absent", value: "absent" }
          )
      )
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("Reason (if excused/absent)")
          .setRequired(false)
      );
  }

  /**
   * Execute: /attendance-log
   */
  async executeAttendanceLog(interaction) {
    // Check access
    if (!(await this.access.hasRole(interaction.member, ["teacher", "admin"]))) {
      return interaction.reply({
        content: "❌ Only teachers can log attendance.",
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const user = interaction.options.getUser("student");
      const classId = interaction.options.getString("class_id");
      const status = interaction.options.getString("status");
      const reason = interaction.options.getString("reason") || "";

      // Get student
      const student = await this.sheets.getStudentByDiscordId(user.id);
      if (!student) {
        return interaction.editReply({
          content: "❌ Student profile not found.",
        });
      }

      // Get today's date
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0];

      // Log attendance
      const attendanceData = {
        attendance_id: uuidv4(),
        student_id: student.student_id,
        class_id: classId,
        check_in_date: dateStr,
        status: status,
        checked_in_at: today.toISOString(),
        excused_reason: reason,
        recorded_by_teacher_id: interaction.user.id,
      };

      const saved = await this.sheets.logAttendance(attendanceData);
      if (!saved) {
        return interaction.editReply({
          content: "❌ Failed to log attendance.",
        });
      }

      const embed = new EmbedBuilder()
        .setColor(status === "present" ? 0x00ff00 : 0xffaa00)
        .setTitle("✅ Attendance Logged")
        .addFields(
          { name: "Student", value: student.name },
          { name: "Status", value: status },
          { name: "Class", value: classId }
        );

      if (reason) {
        embed.addFields({ name: "Reason", value: reason });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error logging attendance:", error);
      return interaction.editReply({
        content: "❌ Error logging attendance. Check logs.",
      });
    }
  }

  /**
   * Command: /attendance-view
   * View attendance records
   */
  getAttendanceViewCommand() {
    return new SlashCommandBuilder()
      .setName("attendance-view")
      .setDescription("View attendance record")
      .addUserOption((option) =>
        option
          .setName("student")
          .setDescription("Student to view (staff only)")
          .setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName("days")
          .setDescription("Days to look back (default 30)")
          .setRequired(false)
      );
  }

  /**
   * Execute: /attendance-view
   */
  async executeAttendanceView(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const targetUser = interaction.options.getUser("student") || interaction.user;
      const daysBack = interaction.options.getInteger("days") || 30;

      // Access check
      const isStaff = await this.access.isStaff(interaction.member);
      if (!isStaff && targetUser.id !== interaction.user.id) {
        return interaction.editReply({
          content: "❌ You can only view your own attendance.",
        });
      }

      // Get student
      const student = await this.sheets.getStudentByDiscordId(targetUser.id);
      if (!student) {
        return interaction.editReply({
          content: "❌ Student profile not found.",
        });
      }

      // Get attendance records
      const records = await this.sheets.getStudentAttendance(student.student_id, daysBack);

      if (records.length === 0) {
        return interaction.editReply({
          content: `❌ No attendance records found for the last ${daysBack} days.`,
        });
      }

      // Calculate stats
      const stats = {
        present: records.filter((r) => r.status === "present").length,
        late: records.filter((r) => r.status === "late").length,
        excused: records.filter((r) => r.status === "excused").length,
        absent: records.filter((r) => r.status === "absent").length,
      };

      const attendanceRate = (
        ((stats.present + stats.late) / records.length) * 100
      ).toFixed(1);

      const embed = new EmbedBuilder()
        .setColor(attendanceRate >= 90 ? 0x00ff00 : 0xffaa00)
        .setTitle(`📋 Attendance: ${student.name}`)
        .setDescription(`Last ${daysBack} days`)
        .addFields(
          {
            name: "Summary",
            value: `✅ Present: ${stats.present} | ⏰ Late: ${stats.late} | 📝 Excused: ${stats.excused} | ❌ Absent: ${stats.absent}`,
          },
          {
            name: "Attendance Rate",
            value: `${attendanceRate}%`,
            inline: true,
          }
        );

      // Recent records
      if (records.length > 0) {
        const recent = records.slice(0, 5);
        embed.addFields({
          name: "Recent",
          value: recent
            .map((r) => `• ${r.check_in_date}: ${r.status}`)
            .join("\n"),
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error viewing attendance:", error);
      return interaction.editReply({
        content: "❌ Error loading attendance. Check logs.",
      });
    }
  }

  /**
   * Helper: Check for chronic absences and send parent alerts
   */
  async checkChronicAbsences(studentId) {
    try {
      const records = await this.sheets.getStudentAttendance(studentId, 30);
      const absences = records.filter((r) => r.status === "absent").length;

      // Flag if 5+ absences in 30 days
      if (absences >= 5) {
        const student = await this.sheets.getStudentById(studentId);
        if (student && student.parent_discord_id) {
          try {
            const parent = await this.client.users.fetch(student.parent_discord_id);
            await parent.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(0xff0000)
                  .setTitle("⚠️ Attendance Alert")
                  .setDescription(
                    `Your student, ${student.name}, has accumulated ${absences} absences in the last 30 days.`
                  )
                  .addFields({
                    name: "Next Steps",
                    value: "Please contact your homeroom teacher to discuss.",
                  }),
              ],
            });
          } catch (err) {
            console.log("Could not DM parent about absences");
          }
        }
      }
    } catch (error) {
      console.error("Error checking chronic absences:", error);
    }
  }
}

module.exports = AttendanceManager;
