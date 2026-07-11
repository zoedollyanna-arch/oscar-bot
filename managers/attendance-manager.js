/**
 * Attendance Manager
 * Handles check-in, attendance logging, and chronic absence detection
 */

const { EmbedBuilder } = require("discord.js");
const { v4: uuidv4 } = require("uuid");

class AttendanceManager {
  constructor(accessControl, sheetsManager) {
    this.ac = accessControl;
    this.sheets = sheetsManager;
    if (!global.attendanceData) global.attendanceData = {};
  }

  /**
   * Student check-in
   */
  async checkIn(interaction) {
    try {
      const status = interaction.options.getString("status") || "present";
      const checkInId = uuidv4().substring(0, 8);

      if (!global.attendanceData[interaction.user.id]) {
        global.attendanceData[interaction.user.id] = [];
      }

      const record = {
        id: checkInId,
        studentId: interaction.user.id,
        studentName: interaction.user.username,
        status,
        timestamp: new Date().toISOString(),
      };

      global.attendanceData[interaction.user.id].push(record);

      const embed = new EmbedBuilder()
        .setColor(status === "present" ? "#00AA00" : "#FFAA00")
        .setTitle(`✅ Check-In Recorded`)
        .addFields(
          { name: "Status", value: status },
          { name: "Time", value: new Date().toLocaleTimeString() }
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("Check-in error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Check-in failed" });
    }
  }

  /**
   * Log attendance manually
   */
  async logAttendance(interaction) {
    try {
      const studentName = interaction.options.getString("student-name");
      const status = interaction.options.getString("status");
      const notes = interaction.options.getString("notes", false) || "";

      if (!global.attendanceData[studentName]) {
        global.attendanceData[studentName] = [];
      }

      const record = {
        id: uuidv4().substring(0, 8),
        studentName,
        status,
        notes,
        timestamp: new Date().toISOString(),
        loggedBy: interaction.user.id,
      };

      global.attendanceData[studentName].push(record);

      const embed = new EmbedBuilder()
        .setColor("#00AA00")
        .setTitle("✅ Attendance Logged")
        .addFields(
          { name: "Student", value: studentName },
          { name: "Status", value: status },
          { name: "Notes", value: notes || "None" }
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("Log attendance error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Failed to log attendance" });
    }
  }

  /**
   * View attendance
   */
  async viewAttendance(interaction) {
    try {
      const studentName = interaction.options.getString("student-name");
      const records = global.attendanceData[studentName] || [];

      if (records.length === 0) {
        return interaction.reply({
          ephemeral: true,
          content: `📭 No attendance records for **${studentName}**`,
        });
      }

      // Count absences in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentRecords = records.filter((r) => new Date(r.timestamp) > thirtyDaysAgo);
      const absenceCount = recentRecords.filter((r) => r.status === "absent").length;
      const attendanceRate = ((recentRecords.length - absenceCount) / recentRecords.length * 100).toFixed(1);

      let list = recentRecords
        .slice(-10)
        .reverse()
        .map((r) => `${new Date(r.timestamp).toLocaleDateString()} - **${r.status}**`)
        .join("\n");

      const embed = new EmbedBuilder()
        .setColor(absenceCount >= 5 ? "#FF0000" : "#0099FF")
        .setTitle(`📊 Attendance - ${studentName}`)
        .addFields(
          { name: "Recent Records", value: list || "None" },
          { name: "Attendance Rate (30d)", value: `${attendanceRate}%` },
          { name: "Status", value: absenceCount >= 5 ? "⚠️ Chronic absence" : "✅ Good standing" }
        );

      // Auto-alert parent if chronic absence
      if (absenceCount >= 5) {
        try {
          const guild = interaction.guild;
          await guild.channels.cache
            .find((ch) => ch.name === "academy-operations")
            ?.send(
              `⚠️ **Chronic Absence Alert:** ${studentName} has ${absenceCount} absences in 30 days`
            );
        } catch {}
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("View attendance error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Error loading attendance" });
    }
  }
}

module.exports = { AttendanceManager };
