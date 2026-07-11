const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require("discord.js");

const channelId = process.env.TAMMY_LIVE_CHANNEL_ID || "";
const pollMs = Math.max(2000, Number(process.env.TAMMY_LIVE_POLL_MS || 5000));
let running = false;
let ticking = false;

function controls(conversationId, avatarUuid, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tammylive_reply:${conversationId}:${avatarUuid}`).setLabel("Reply").setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`tammylive_takeover:${conversationId}`).setLabel("Take Over").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`tammylive_release:${conversationId}`).setLabel("Release").setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`tammylive_close:${conversationId}`).setLabel("Close").setStyle(ButtonStyle.Danger).setDisabled(disabled),
  );
}

function embed(row) {
  return new EmbedBuilder()
    .setColor(row.message_type === "im" ? 0x5b8def : 0x8a63d2)
    .setTitle("New in-world message for Tammy")
    .addFields(
      { name: "Resident", value: row.avatar_name || "Resident", inline: true },
      { name: "Channel", value: row.message_type === "im" ? "IM" : "Local chat", inline: true },
      { name: "Region", value: row.region || "—", inline: true },
      { name: "Message", value: (row.message_text || "—").slice(0, 1000) },
      { name: "Avatar UUID", value: `\`${row.avatar_uuid}\`` },
      { name: "Conversation", value: `#${row.conversation_id}`, inline: true },
    )
    .setTimestamp(new Date(row.created_at));
}

async function tick(client, db) {
  if (ticking || !db.isReady()) return;
  ticking = true;
  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) throw new Error(`TAMMY_LIVE_CHANNEL_ID ${channelId} is not a text channel Tammy can access`);
    const rows = (await db.query(
      `WITH claimed AS (
         UPDATE tammy_messages SET notified=true
          WHERE id IN (
            SELECT id FROM tammy_messages
             WHERE direction='incoming' AND notified=false
             ORDER BY created_at ASC LIMIT 10 FOR UPDATE SKIP LOCKED)
         RETURNING id, conversation_id, message_text, message_type, region, created_at)
       SELECT claimed.*, c.avatar_name, c.avatar_uuid
         FROM claimed JOIN tammy_conversations c ON c.id=claimed.conversation_id
        ORDER BY claimed.created_at ASC`
    )).rows;
    for (const row of rows) {
      try {
        await channel.send({ embeds: [embed(row)], components: [controls(row.conversation_id, row.avatar_uuid)] });
      } catch (error) {
        await db.query("UPDATE tammy_messages SET notified=false WHERE id=$1", [row.id]).catch(() => {});
        console.error("tammy-live post failed:", error.message);
      }
    }
  } catch (error) {
    console.error("tammy-live poll failed:", error.message);
  } finally {
    ticking = false;
  }
}

function startLiveFeed(client, db) {
  if (running) return;
  if (!channelId) {
    console.error("TAMMY_LIVE_CHANNEL_ID is missing; live feed not started.");
    return;
  }
  running = true;
  tick(client, db);
  setInterval(() => tick(client, db), pollMs);
  console.log(`Tammy live feed polling every ${pollMs}ms into ${channelId}.`);
}

async function handleButton(interaction, db) {
  const [action, conversationId, avatarUuid] = interaction.customId.split(":");
  if (action === "tammylive_reply") {
    const modal = new ModalBuilder().setCustomId(`tammylive_replymodal:${conversationId}:${avatarUuid}`).setTitle("Reply as Tammy");
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("reply_text").setLabel("In-world IM").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(900)
    ));
    await interaction.showModal(modal);
    return;
  }
  if (action === "tammylive_takeover" || action === "tammylive_release") {
    const assigned = action === "tammylive_takeover" ? interaction.user.id : null;
    await db.query("UPDATE tammy_conversations SET assigned_staff_id=$1 WHERE id=$2", [assigned, Number(conversationId)]);
    await interaction.reply({ content: assigned ? `You took over conversation #${conversationId}; automated replies are paused for this resident.` : `Conversation #${conversationId} released back to Tammy.`, flags: 64 });
    return;
  }
  if (action === "tammylive_close") {
    await db.query("UPDATE tammy_conversations SET status='closed', closed_at=now() WHERE id=$1", [Number(conversationId)]);
    await interaction.update({ components: [controls(conversationId, "closed", true)] });
  }
}

async function handleModal(interaction, db) {
  const [, conversationId, avatarUuid] = interaction.customId.split(":");
  const message = interaction.fields.getTextInputValue("reply_text");
  await db.query(
    `INSERT INTO tammy_commands (command_type, payload, requested_by, status, created_at)
     VALUES ('send_im', $1::jsonb, $2, 'pending', now())`,
    [JSON.stringify({ avatar_uuid: avatarUuid, message }), interaction.user.id]
  );
  await interaction.reply({ content: `Reply queued for conversation #${conversationId}.`, flags: 64 });
}

module.exports = { startLiveFeed, handleButton, handleModal, isRunning: () => running };
