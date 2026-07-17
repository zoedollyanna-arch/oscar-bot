/* Family Detective Crew scheduling flow (Tammy).
 * Two-step dropdown, designed to work with index.js's early-deferUpdate model:
 * every select is deferUpdate'd by the router first, so this handler uses
 * editReply()/followUp() ONLY (never .update()/.reply()/.showModal()).
 *
 * Step 1 — destination select: pkg_sched:dest:<guestId>
 * Step 2 — time select (dest encoded): pkg_sched:time:<guestId>:<destKey>
 * On completion the choice is saved to detective_schedule_requests (shared Neon)
 * and a staff-visible summary is posted in the booking ticket. */
const {
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder,
} = require("discord.js");

const PREFIX = "pkg_sched";
const PACKAGE_NAME = "Family Detective Crew";

// Upcoming destinations only (scheduling starts tomorrow onward).
const DESTINATIONS = {
  jamaica:     { label: "🌴 Jamaica",       date: "July 20" },
  barbados:    { label: "🐚 Barbados",      date: "July 23" },
  aruba:       { label: "🌊 Aruba",         date: "July 27" },
  puertorico:  { label: "🇵🇷 Puerto Rico",  date: "July 30" },
};

const TIMES = ["10:00 AM SLT", "12:00 PM SLT", "2:00 PM SLT", "4:00 PM SLT", "6:00 PM SLT", "8:00 PM SLT"];

function destinationSelect(guestId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${PREFIX}:dest:${guestId}`)
      .setPlaceholder("🌍 Select your destination & date…")
      .addOptions(
        Object.entries(DESTINATIONS).map(([key, d]) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${d.label} — arrival ${d.date}`)
            .setDescription(`Schedule your Detective Crew around the ${d.date} ${d.label.replace(/^[^A-Za-z]+/, "")} stop`)
            .setValue(key)
        )
      )
  );
}

function timeSelect(guestId, destKey) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${PREFIX}:time:${guestId}:${destKey}`)
      .setPlaceholder("🕐 Select your preferred time (SLT)…")
      .addOptions(TIMES.map((t) => new StringSelectMenuOptionBuilder().setLabel(t).setValue(t)))
  );
}

/** Build the initial "approved — please schedule" message (embed + destination dropdown). */
function scheduleMessage(guestId) {
  const embed = new EmbedBuilder()
    .setColor(0x8E7CC3)
    .setTitle("🎉 Payment Approved — Let's Schedule Your Family Detective Crew! 🕵️")
    .setDescription(
      "Wonderful news, sweetie! 💕 Your **Family Detective Crew** package has been **approved and paid** — now let's get it on the calendar! 🗓️✨\n\n" +
      "Scheduling starts **tomorrow** onward. Just use the dropdown below to pick your **destination & date**, and then you'll choose your **preferred time**. Easy as that! 💙"
    )
    .addFields(
      { name: "🎁 Your Package Includes", value: "🎖️ Family detective badge & notecard\n🔍 Group clue-hunt guide\n🧒 Junior Detective titles for the kids\n📸 Family photo stop after solving the case\n🎁 A small prize at the end", inline: false },
      { name: "👇 Step 1 of 2", value: "Pick your **destination** from the dropdown below.", inline: false }
    )
    .setFooter({ text: "Lifeline Island Paradise • Tammy at the Front Desk 🛎️💕" })
    .setTimestamp();
  return { content: `<@${guestId}>`, embeds: [embed], components: [destinationSelect(guestId)] };
}

async function ensureTable(db) {
  await db.query(
    `CREATE TABLE IF NOT EXISTS detective_schedule_requests (
       id BIGSERIAL PRIMARY KEY, channel_id TEXT, guest_id TEXT NOT NULL,
       package_name TEXT, destination TEXT, destination_date TEXT, preferred_time TEXT,
       created_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`
  );
}

async function handle(interaction, db) {
  if (!interaction.customId?.startsWith(`${PREFIX}:`)) return false;
  // The router already deferUpdate'd this select — use editReply()/followUp() only.
  const parts = interaction.customId.split(":");
  const action = parts[1];
  const guestId = parts[2];

  if (interaction.user.id !== guestId) {
    await interaction.followUp({ content: "This scheduling form belongs to the guest named in this booking ticket 💙", flags: 64 }).catch(() => {});
    return true;
  }

  // Step 1 → destination chosen, present the time dropdown.
  if (action === "dest" && interaction.isStringSelectMenu()) {
    const destKey = interaction.values[0];
    const dest = DESTINATIONS[destKey];
    if (!dest) { await interaction.followUp({ content: "Hmm, that destination isn't available — please pick another 💙", flags: 64 }).catch(() => {}); return true; }
    const embed = new EmbedBuilder()
      .setColor(0x8E7CC3)
      .setTitle("🕵️ Family Detective Crew — Almost There! ✨")
      .setDescription(`Great pick! Your mystery adventure will be set around **${dest.label} (arrival ${dest.date})** 🌴\n\nNow choose your **preferred time** below to finish scheduling 🕐`)
      .addFields(
        { name: "🌍 Destination", value: `${dest.label} — ${dest.date}`, inline: true },
        { name: "👇 Step 2 of 2", value: "Pick your **preferred time** (SLT).", inline: false }
      )
      .setFooter({ text: "Lifeline Island Paradise • Tammy at the Front Desk 🛎️💕" })
      .setTimestamp();
    await interaction.editReply({ content: `<@${guestId}>`, embeds: [embed], components: [timeSelect(guestId, destKey)] });
    return true;
  }

  // Step 2 → time chosen, save + confirm + notify staff.
  if (action === "time" && interaction.isStringSelectMenu()) {
    const destKey = parts[3];
    const dest = DESTINATIONS[destKey];
    const time = interaction.values[0];
    if (!dest) { await interaction.followUp({ content: "Something went sideways — please start again 💙", flags: 64 }).catch(() => {}); return true; }

    try {
      if (db && db.isReady()) {
        await ensureTable(db);
        await db.query(
          `INSERT INTO detective_schedule_requests (channel_id, guest_id, package_name, destination, destination_date, preferred_time)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [interaction.channelId, guestId, PACKAGE_NAME, dest.label, dest.date, time]
        );
      }
    } catch (error) {
      console.log("Detective schedule DB log failed (continuing):", error.message);
    }

    const done = new EmbedBuilder()
      .setColor(0x70D6A7)
      .setTitle("✅ All Set — Your Detective Crew is Scheduled! 🕵️💕")
      .setDescription("Yay! Thank you, lovely — here's what you told us. Our crew will confirm the final details with you right here in your booking ticket 🌴✨")
      .addFields(
        { name: "🎁 Package", value: PACKAGE_NAME, inline: false },
        { name: "🌍 Destination", value: `${dest.label} — ${dest.date}`, inline: true },
        { name: "🕐 Time", value: time, inline: true }
      )
      .setFooter({ text: "Lifeline Island Paradise • Tammy at the Front Desk 🛎️💕" })
      .setTimestamp();
    await interaction.editReply({ content: `<@${guestId}>`, embeds: [done], components: [] });

    // Staff-visible summary (non-ephemeral) so the crew can act in the ticket.
    await interaction.followUp({
      content: `🕵️ **New Detective Crew scheduling request** from <@${guestId}>\n> **Destination:** ${dest.label} (${dest.date})\n> **Time:** ${time}`,
      allowedMentions: { users: [] },
    }).catch(() => {});
    return true;
  }

  return false;
}

module.exports = { scheduleMessage, handle, PREFIX };
