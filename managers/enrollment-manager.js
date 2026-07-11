/**
 * Enrollment Manager
 * Handles student registration, profiles, rosters, and enrollment status
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const { v4: uuidv4 } = require("uuid");

class EnrollmentManager {
  constructor(accessControl, sheetsManager) {
    this.ac = accessControl;
    this.sheets = sheetsManager;
  }

  /**
   * Register student - link Discord to enrollment sheet
   */
  async registerStudent(interaction) {
    try {
      const studentName = interaction.options.getString("name");
      const discordId = interaction.user.id;

      // Check if already registered
      const existing = await this._findByDiscordId(discordId);
      if (existing) {
        return interaction.reply({
          ephemeral: true,
          content: `❌ Your Discord account is already linked to **${existing.name}**`,
        });
      }

      // For demo: store locally, in production write to sheet
      if (!global.enrollmentData) global.enrollmentData = {};
      global.enrollmentData[discordId] = {
        name: studentName,
        discordId,
        studentUniqueId: uuidv4(),
        registeredAt: new Date().toISOString(),
      };

      const embed = new EmbedBuilder()
        .setColor("#00AA00")
        .setTitle("✅ Registration Successful")
        .addFields(
          { name: "Student Name", value: studentName },
          { name: "Discord ID", value: discordId },
          { name: "Student ID", value: global.enrollmentData[discordId].studentUniqueId },
          { name: "Status", value: "Enrollment pending staff approval" }
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("Register error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Registration failed" });
    }
  }

  /**
   * View student profile
   */
  async viewProfile(interaction) {
    try {
      const student = await this._findByDiscordId(interaction.user.id);
      if (!student) {
        return interaction.reply({
          ephemeral: true,
          content: "❌ No enrollment found. Use `/academy-register` first.",
        });
      }

      const embed = new EmbedBuilder()
        .setColor("#0099FF")
        .setTitle("📋 Student Profile")
        .addFields(
          { name: "Name", value: student.name },
          { name: "Discord ID", value: student.discordId },
          { name: "Student ID", value: student.studentUniqueId || "Not set" },
          { name: "Registered", value: new Date(student.registeredAt).toLocaleDateString() }
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("Profile error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Error loading profile" });
    }
  }

  /**
   * View class roster
   */
  async viewRoster(interaction) {
    try {
      if (!global.enrollmentData) global.enrollmentData = {};
      const students = Object.values(global.enrollmentData);

      if (students.length === 0) {
        return interaction.reply({
          ephemeral: true,
          content: "📭 No students registered yet.",
        });
      }

      let rosterText = students.map((s, i) => `${i + 1}. ${s.name} (\`${s.discordId}\`)`).join("\n");

      const embed = new EmbedBuilder()
        .setColor("#FF9900")
        .setTitle(`📚 Class Roster (${students.length} students)`)
        .setDescription(rosterText);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("Roster error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Error loading roster" });
    }
  }

  /**
   * Check enrollment status
   */
  async checkEnrollmentStatus(interaction) {
    try {
      const student = await this._findByDiscordId(interaction.user.id);
      if (!student) {
        return interaction.reply({
          ephemeral: true,
          content: "❌ Not registered. Use `/academy-register` to enroll.",
        });
      }

      const embed = new EmbedBuilder()
        .setColor("#FFAA00")
        .setTitle("📊 Enrollment Status")
        .addFields(
          { name: "Name", value: student.name },
          { name: "Registration Date", value: new Date(student.registeredAt).toLocaleDateString() },
          { name: "Status", value: "✅ Approved" }
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("Status error:", e);
      return interaction.reply({ ephemeral: true, content: "❌ Error checking status" });
    }
  }

  async _findByDiscordId(discordId) {
    if (!global.enrollmentData) return null;
    return global.enrollmentData[discordId] || null;
  }
}

module.exports = { EnrollmentManager };
