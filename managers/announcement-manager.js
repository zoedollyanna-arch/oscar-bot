/**
 * Announcement Manager
 * Handles announcements and class feeds
 */

const { EmbedBuilder } = require("discord.js");
const { v4: uuidv4 } = require("uuid");

class AnnouncementManager {
  constructor(accessControl, sheetsManager) {
    this.ac = accessControl;
    this.sheets = sheetsManager;
    if (!global.announcementData) global.announcementData = {};
  }

  /**
   * Post announcement
   */
  async postAnnouncement(interaction) {
    try {
      const title = interaction.options.getString("title");
      const content = interaction.options.getString("content");
      const type = interaction.options.getString("type") || "announcement";

      const announcementId = uuidv4().substring(0, 8);

      const typeColors = {
        announcement: "#0099FF",
        reminder: "#FFAA00",
        "schedule-update": "#FF9900",
        "lesson-reminder": "#00AA00",
        alert: "#FF0000",
      };

      const announcement = {
        id: announcementId,
        title,
        content,
        type,
        postedBy: interaction.user.id,
        postedAt: new Date().toISOString(),
      };

      global.announcementData[announcementId] = announcement;

      const embed = new EmbedBuilder()
        .setColor(typeColors[type] || "#0099FF")
        .setTitle(title)
        .setDescription(content)
        .setFooter({ text: `Type: ${type}` });

      // Post to announcements channel if it exists
      const announcementChannelId = process.env.TAMMY_ANNOUNCE_CHANNEL_ID;
      if (announcementChannelId) {
        try {
          const channel = await interaction.client.channels.fetch(announcementChannelId);
          await channel.send({ embeds: [embed] });
        } catch {}
      }

      return interaction.reply({
        embeds: [embed],
        content: "✅ Announcement posted!",
        ephemeral: true,
      });
    } catch (e) {
      console.error("Post announcement error:", e);
      return interaction.reply({
        ephemeral: true,
        content: "❌ Failed to post announcement",
      });
    }
  }

  /**
   * List announcements
   */
  async listAnnouncements(interaction) {
    try {
      const announcements = Object.values(global.announcementData || {});

      if (announcements.length === 0) {
        return interaction.reply({
          ephemeral: true,
          content: "📭 No announcements yet.",
        });
      }

      let list = announcements
        .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt))
        .slice(0, 10)
        .map((a) => `**${a.title}**\n${a.content.substring(0, 100)}...`)
        .join("\n\n");

      const embed = new EmbedBuilder()
        .setColor("#0099FF")
        .setTitle(`📢 Recent Announcements (${announcements.length})`)
        .setDescription(list);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error("List announcements error:", e);
      return interaction.reply({
        ephemeral: true,
        content: "❌ Error loading announcements",
      });
    }
  }
}

module.exports = { AnnouncementManager };
