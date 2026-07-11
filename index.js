/* =================================================================================================
 *  Tammy Brightwood — Lifeline's automated Discord staff assistant
 *  ------------------------------------------------------------------------------------------------
 *  A rule-based + lightly-conversational staff bot for the Lifeline Discord. Handles support
 *  tickets, redelivery requests, an FAQ knowledge base, scheduled announcements and staff/blogger
 *  applications. Shares the main Discord bot's Neon Postgres database (db.js), so everything Tammy
 *  records is visible to the rest of the Lifeline ecosystem. Second Life delivery/account calls go
 *  through the Render backend.
 *
 *  Design rule: anything that issues items, pays, bans, changes roles or approves an application is
 *  RULE-BASED and staff-gated. Tammy only auto-responds with information (FAQ) — she never takes a
 *  privileged action without a staff member clicking a button.
 * ================================================================================================= */

const http = require("http");
const {
  Client, GatewayIntentBits, Partials, Events, REST, Routes,
  SlashCommandBuilder, PermissionFlagsBits, ChannelType,
} = require("discord.js");

const config = require("./config");
const store = require("./store");
const { embed, COLORS, isStaff, replyEphemeral } = require("./ui");

const support = require("./support");
const redelivery = require("./redelivery");
const faq = require("./faq");
const announcements = require("./announcements");
const applications = require("./applications");
const backend = require("./backendClient");

// -------------------- Slash commands --------------------
const commands = [
  new SlashCommandBuilder().setName("support").setDescription("Open a support request with Lifeline staff"),

  new SlashCommandBuilder().setName("redelivery").setDescription("Request an item be re-sent to you in Second Life")
    .addStringOption((o) => o.setName("sl_username").setDescription("Your Second Life username").setRequired(true))
    .addStringOption((o) => o.setName("product").setDescription("The product to redeliver").setRequired(true))
    .addStringOption((o) => o.setName("note").setDescription("Anything staff should know").setRequired(false)),

  new SlashCommandBuilder().setName("apply").setDescription("Apply to join the Lifeline team (staff or blogger)"),

  new SlashCommandBuilder().setName("events").setDescription("See upcoming Lifeline events"),

  new SlashCommandBuilder().setName("landmarks").setDescription("Get Lifeline landmarks / teleports"),

  new SlashCommandBuilder().setName("status").setDescription("Check Lifeline service status"),

  new SlashCommandBuilder().setName("faq").setDescription("Lifeline FAQ")
    .addSubcommand((s) => s.setName("ask").setDescription("Ask a question")
      .addStringOption((o) => o.setName("question").setDescription("Your question").setRequired(true)))
    .addSubcommand((s) => s.setName("list").setDescription("List FAQ topics"))
    .addSubcommand((s) => s.setName("add").setDescription("Add an FAQ entry (staff)")
      .addStringOption((o) => o.setName("topic").setDescription("Topic title").setRequired(true))
      .addStringOption((o) => o.setName("answer").setDescription("Answer text").setRequired(true))
      .addStringOption((o) => o.setName("keywords").setDescription("Comma-separated trigger keywords").setRequired(false)))
    .addSubcommand((s) => s.setName("remove").setDescription("Remove an FAQ entry (staff)")
      .addStringOption((o) => o.setName("id").setDescription("FAQ id, e.g. FAQ00003").setRequired(true))),

  new SlashCommandBuilder().setName("announce").setDescription("Post or schedule an announcement (staff)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName("now").setDescription("Post an announcement now")
      .addStringOption((o) => o.setName("title").setDescription("Title").setRequired(true))
      .addStringOption((o) => o.setName("message").setDescription("Message").setRequired(true))
      .addBooleanOption((o) => o.setName("ping_everyone").setDescription("Ping @everyone").setRequired(false))
      .addChannelOption((o) => o.setName("channel").setDescription("Target channel").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false)))
    .addSubcommand((s) => s.setName("schedule").setDescription("Schedule an announcement")
      .addStringOption((o) => o.setName("title").setDescription("Title").setRequired(true))
      .addStringOption((o) => o.setName("message").setDescription("Message").setRequired(true))
      .addStringOption((o) => o.setName("when").setDescription('e.g. "in 2h", "in 30m", "2026-07-12 18:00"').setRequired(true))
      .addBooleanOption((o) => o.setName("ping_everyone").setDescription("Ping @everyone").setRequired(false))
      .addChannelOption((o) => o.setName("channel").setDescription("Target channel").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false)))
    .addSubcommand((s) => s.setName("list").setDescription("List scheduled announcements"))
    .addSubcommand((s) => s.setName("cancel").setDescription("Cancel a scheduled announcement")
      .addStringOption((o) => o.setName("id").setDescription("Announcement id, e.g. ANN00002").setRequired(true))),

  new SlashCommandBuilder().setName("panel").setDescription("Post the support panel in this channel (staff)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder().setName("tammy").setDescription("Tammy Brightwood")
    .addSubcommand((s) => s.setName("ping").setDescription("Health check"))
    .addSubcommand((s) => s.setName("help").setDescription("What can Tammy do?")),
].map((c) => c.toJSON());

// -------------------- Client --------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,     // greetings on join (privileged)
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,   // FAQ auto-responder (privileged)
  ],
  partials: [Partials.Channel],
});

async function registerCommands() {
  if (!config.DISCORD_TOKEN || !config.CLIENT_ID) {
    console.warn("⚠️ DISCORD_TOKEN / CLIENT_ID missing — skipping command registration.");
    return;
  }
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
  try {
    if (config.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID), { body: commands });
      console.log(`✅ Registered ${commands.length} guild commands.`);
    } else {
      await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: commands });
      console.log(`✅ Registered ${commands.length} global commands.`);
    }
  } catch (e) {
    console.error("❌ Command registration failed:", e.message);
  }
}

// -------------------- Ready --------------------
client.once(Events.ClientReady, async (c) => {
  console.log(`🦉 Tammy Brightwood online as ${c.user.tag}`);
  await store.init();
  await registerCommands();
  announcements.startScheduler(client);
});

// -------------------- Interaction router --------------------
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) return onCommand(interaction);
    if (interaction.isButton()) return onButton(interaction);
    if (interaction.isModalSubmit()) return onModal(interaction);
  } catch (e) {
    console.error("interaction error:", e);
    try {
      await replyEphemeral(interaction, { content: "Something went wrong on my end — please try again or open `/support`." });
    } catch { /* ignore */ }
  }
});

async function onCommand(interaction) {
  const name = interaction.commandName;
  switch (name) {
    case "support":
      return interaction.reply({ ...support.buildMenu(), ephemeral: true });
    case "redelivery":
      return redelivery.handleCommand(interaction, client);
    case "apply":
      return interaction.reply({ ...applications.buildPicker(), ephemeral: true });
    case "events":
      return onEvents(interaction);
    case "landmarks":
      return onLandmarks(interaction);
    case "status":
      return onStatus(interaction);
    case "faq":
      return onFaq(interaction);
    case "announce":
      return onAnnounce(interaction);
    case "panel":
      return onPanel(interaction);
    case "tammy":
      return onTammy(interaction);
    default:
      return replyEphemeral(interaction, { content: "Unknown command." });
  }
}

async function onFaq(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === "ask") return faq.handleAsk(interaction);
  if (sub === "list") return faq.handleList(interaction);
  if (sub === "add" || sub === "remove") {
    if (!isStaff(interaction.member)) return replyEphemeral(interaction, { content: "That's a staff-only action." });
    return sub === "add" ? faq.handleAdd(interaction) : faq.handleRemove(interaction);
  }
}

async function onAnnounce(interaction) {
  if (!isStaff(interaction.member)) return replyEphemeral(interaction, { content: "That's a staff-only command." });
  const sub = interaction.options.getSubcommand();
  if (sub === "now") return announcements.handleNow(interaction, client);
  if (sub === "schedule") return announcements.handleSchedule(interaction);
  if (sub === "list") return announcements.handleList(interaction);
  if (sub === "cancel") return announcements.handleCancel(interaction);
}

async function onPanel(interaction) {
  if (!isStaff(interaction.member)) return replyEphemeral(interaction, { content: "That's a staff-only command." });
  await interaction.channel.send(support.buildMenu()).catch(() => {});
  return replyEphemeral(interaction, { content: "Support panel posted." });
}

async function onEvents(interaction) {
  const upcoming = [...store.announcements.values()]
    .filter((a) => a.status === "scheduled")
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, 10);
  const body = upcoming.length
    ? upcoming.map((a) => `• **${a.title}** — <t:${Math.floor(a.dueAt / 1000)}:R>`).join("\n")
    : "No events are scheduled right now. Keep an eye on the events channel!";
  const e = embed("Upcoming Lifeline events", body, COLORS.info);
  if (config.EVENTS_CHANNEL_ID) e.addFields({ name: "More", value: `See <#${config.EVENTS_CHANNEL_ID}>` });
  return replyEphemeral(interaction, { embeds: [e] });
}

async function onLandmarks(interaction) {
  const desc = config.LANDMARKS_URL
    ? `Here are the current Lifeline landmarks:\n${config.LANDMARKS_URL}`
    : "Check the pinned landmarks in the server. If a landmark is broken, open `/support`.";
  store.logInteraction("landmarks", { userId: interaction.user.id });
  return replyEphemeral(interaction, { embeds: [embed("Lifeline landmarks", desc, COLORS.info)] });
}

async function onStatus(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const ping = await backend.ping();
  const backendState = !config.BACKEND_URL ? "not configured" : ping.ok ? "🟢 online" : `🔴 ${ping.error}`;
  const e = embed("Lifeline status", null, ping.ok || !config.BACKEND_URL ? COLORS.ok : COLORS.warn).addFields(
    { name: "Tammy", value: "🟢 online", inline: true },
    { name: "Backend (SL)", value: backendState, inline: true },
    { name: "Open tickets", value: String([...store.tickets.values()].filter((t) => t.status !== "closed").length), inline: true },
    { name: "Pending redeliveries", value: String([...store.redeliveries.values()].filter((r) => r.status === "pending_review").length), inline: true }
  );
  return replyEphemeral(interaction, { embeds: [e] });
}

async function onTammy(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === "ping") {
    return replyEphemeral(interaction, { content: `🦉 Pong! WebSocket ${Math.round(client.ws.ping)}ms.` });
  }
  const e = embed(
    "Hi, I'm Tammy Brightwood 🦉",
    "I'm Lifeline's staff assistant. Here's what I can do:"
  ).addFields(
    { name: "/support", value: "Open a ticket for product help, cruise help, or to report an issue.", inline: false },
    { name: "/redelivery", value: "Request an item be re-sent to you in Second Life.", inline: false },
    { name: "/apply", value: "Apply to join as staff or a blogger.", inline: false },
    { name: "/faq ask", value: "Ask a question — I answer common ones instantly.", inline: false },
    { name: "/events • /landmarks • /status", value: "Quick info on events, teleports and service status.", inline: false }
  );
  return replyEphemeral(interaction, { embeds: [e] });
}

// -------------------- Buttons --------------------
async function onButton(interaction) {
  const id = interaction.customId;
  if (id.startsWith("tammy_support_pick:")) return support.handlePick(interaction);
  if (id.startsWith("tammy_tk:")) return support.handleControl(interaction);
  if (id.startsWith("tammy_rdl:")) return redelivery.handleControl(interaction);
  if (id.startsWith("tammy_apply_pick:")) return applications.handlePick(interaction);
  if (id.startsWith("tammy_app:")) return applications.handleControl(interaction);
  return replyEphemeral(interaction, { content: "That button has expired." });
}

// -------------------- Modals --------------------
async function onModal(interaction) {
  const id = interaction.customId;
  if (id.startsWith("tammy_support_modal:")) return support.handleModal(interaction, client);
  if (id.startsWith("tammy_apply_modal:")) return applications.handleModal(interaction, client);
  return replyEphemeral(interaction, { content: "That form has expired." });
}

// -------------------- Greetings --------------------
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    if (!config.WELCOME_CHANNEL_ID) return;
    const ch = await member.guild.channels.fetch(config.WELCOME_CHANNEL_ID).catch(() => null);
    if (!ch || !ch.isTextBased()) return;
    const e = embed(
      `Welcome to Lifeline, ${member.user.username}! 🦉`,
      `Hey <@${member.id}>! I'm **Tammy**, your staff assistant. Need help getting started?\n\n` +
        "• `/support` — talk to staff\n• `/redelivery` — get an item resent\n• `/faq ask` — quick answers\n• `/apply` — join the team"
    );
    await ch.send({ embeds: [e] }).catch(() => {});
    store.logInteraction("greeting", { userId: member.id });
  } catch (e) {
    console.error("greeting failed:", e.message);
  }
});

// -------------------- FAQ auto-responder --------------------
client.on(Events.MessageCreate, async (message) => {
  try {
    if (!config.FAQ_AUTOREPLY) return;
    if (message.author.bot || !message.guild) return;
    if (config.FAQ_CHANNEL_IDS.length && !config.FAQ_CHANNEL_IDS.includes(message.channelId)) return;
    // Only auto-answer when Tammy is mentioned or the message ends in a question mark, to stay quiet.
    const mentioned = message.mentions.has(client.user);
    if (!mentioned && !message.content.includes("?")) return;
    await faq.tryAutoRespond(message);
  } catch (e) {
    console.error("auto-respond failed:", e.message);
  }
});

// -------------------- Keep-alive (Render web service) --------------------
http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, bot: "tammy", ready: client.isReady?.() || false }));
  }
  res.writeHead(404); res.end();
}).listen(config.PORT, () => console.log(`🌐 Keep-alive listening on :${config.PORT}`));

// -------------------- Boot --------------------
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
client.login(config.DISCORD_TOKEN).catch((e) => console.error("login failed:", e.message));
