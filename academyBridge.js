/* =================================================================================================
 *  Academy Bridge (Tammy) — Discord ownership of Lifeline Academy applications
 *  ------------------------------------------------------------------------------------------------
 *  Tammy Brightwood (this bot) owns the Academy Discord flow. The Lifeline backend (Supabase) is
 *  the single source of truth; this module holds no Academy state — it only turns Discord actions
 *  into authenticated calls against the backend's /api/zpad/moap/academy/admin/* endpoints.
 *
 *  Flow:
 *    - A student applies from their ZPad → the backend posts an embed with Accept / Request Info /
 *      Deny buttons (custom_id "bacademy:<action>:<id>") into the applications channel, POSTED WITH
 *      THIS BOT'S TOKEN (backend ACADEMY_BOT_TOKEN = Tammy's token) so the clicks arrive here.
 *    - A teacher applies in Discord via /academy-teacher-apply → modal → backend files + posts it.
 *    - Only the OWNER may Accept / Deny / Request Info or bulk-assign (staff buttons are hard-locked).
 *    - On a decision the applicant gets a cute DM (approved / denied / more-info).
 *
 *  Env:
 *    LIFELINE_BACKEND_URL     backend base URL (falls back to config.BACKEND_URL)
 *    ACADEMY_SHARED_SECRET    shared secret; must equal the backend's ACADEMY_SHARED_SECRET
 *    ACADEMY_OWNER_ID         Discord user id allowed to use staff buttons (default below)
 * ================================================================================================= */

const {
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, EmbedBuilder,
  SlashCommandBuilder, StringSelectMenuBuilder,
} = require("discord.js");
const config = require("./config");

const BACKEND_URL = (process.env.LIFELINE_BACKEND_URL || config.BACKEND_URL || "https://lifeline-backend-dfdv.onrender.com").replace(/\/+$/, "");
const ADMIN_SECRET = process.env.ACADEMY_SHARED_SECRET || process.env.ACADEMY_ADMIN_SECRET || config.BACKEND_SECRET || "";
// Hard lock: only this Discord user may use Academy staff controls.
const OWNER_ID = process.env.ACADEMY_OWNER_ID || "1197552066269282306";
const BRAND = 0x8d55eb;

function isOwner(interaction) {
  return interaction.user?.id === OWNER_ID;
}
async function denyNonOwner(interaction) {
  await interaction.reply({
    content: "Only the Academy owner can use these controls.",
    flags: 64, // ephemeral
  }).catch(() => {});
}

const ACTION_LABELS = {
  accept: ["Accept Application", "Welcome note for the applicant (optional)", false],
  deny: ["Deny Application", "Reason shown to the applicant", true],
  info: ["Request More Information", "Tell the applicant what to provide", true],
};

async function backendPost(path, body) {
  const res = await fetch(`${BACKEND_URL}/api/zpad/moap${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-lifeline-secret": ADMIN_SECRET },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error === "BAD_SECRET"
      ? "Backend rejected the admin secret — set ACADEMY_SHARED_SECRET identically on Tammy and the backend."
      : json.error === "ALREADY_DECIDED" ? `Application is already ${json.status}.`
      : json.message || json.error || `Backend error (HTTP ${res.status}).`);
  }
  return json;
}
async function backendGet(path) {
  const res = await fetch(`${BACKEND_URL}/api/zpad/moap${path}`, { headers: { "x-lifeline-secret": ADMIN_SECRET } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.error || `Backend error (HTTP ${res.status}).`);
  return json;
}

/* ── Applicant DM on a decision (cute, branded) ─────────────────────────────
   Best-effort: DM by Discord user id when we have it; otherwise try to resolve
   the stored username within the guild. Never throws into the interaction. */
async function dmApplicant(client, result, action, note) {
  try {
    let user = null;
    if (result.discordUserId) {
      user = await client.users.fetch(result.discordUserId).catch(() => null);
    }
    if (!user && result.discordUsername && client.guilds?.cache?.size) {
      for (const guild of client.guilds.cache.values()) {
        const members = await guild.members.fetch({ query: String(result.discordUsername).replace(/^@/, ""), limit: 5 }).catch(() => null);
        const hit = members?.find((m) =>
          m.user.username.toLowerCase() === String(result.discordUsername).replace(/^@/, "").toLowerCase() ||
          (m.user.tag || "").toLowerCase() === String(result.discordUsername).toLowerCase());
        if (hit) { user = hit.user; break; }
      }
    }
    if (!user) return false;

    const who = result.applicant || "Scholar";
    const kind = result.applicationType === "teacher" ? "teacher" : "student";
    let embed;
    if (action === "accept") {
      embed = new EmbedBuilder().setColor(0x58a55c)
        .setTitle("🎉 Welcome to Lifeline Academy!")
        .setDescription(`Great news, **${who}** — your ${kind} application was **approved**!` +
          (kind === "teacher"
            ? "\n\nOpen your Academy dashboard on your ZPad to start assigning approved marketplace lessons."
            : "\n\nOpen the **Academy** app on your ZPad — your K-12 dashboard is live with lessons, quizzes, homework, and grades for your grade.") +
          (note ? `\n\n📝 *${note}*` : ""))
        .setFooter({ text: "Lifeline Academy Digital • Tammy Brightwood" }).setTimestamp();
    } else if (action === "deny") {
      embed = new EmbedBuilder().setColor(0xd9534f)
        .setTitle("Lifeline Academy — Application Update")
        .setDescription(`Hi **${who}**, thank you for applying. Your ${kind} application was **not approved** this time.` +
          (note ? `\n\n**Reason:** ${note}` : "") + "\n\nYou're welcome to apply again later. 💜")
        .setFooter({ text: "Lifeline Academy Digital • Tammy Brightwood" }).setTimestamp();
    } else {
      embed = new EmbedBuilder().setColor(0xf2b84b)
        .setTitle("Lifeline Academy — A little more info, please")
        .setDescription(`Hi **${who}**! Before we can approve your ${kind} application we need a bit more:` +
          (note ? `\n\n**${note}**` : "") +
          (kind === "student" ? "\n\nUpdate and resubmit from the Academy app on your ZPad." : "\n\nReply here or run **/academy-teacher-apply** again with the details."))
        .setFooter({ text: "Lifeline Academy Digital • Tammy Brightwood" }).setTimestamp();
    }
    await user.send({ embeds: [embed] });
    return true;
  } catch {
    return false;
  }
}

/* ── /academy-teacher-apply : applicant modal (public) ──────────────────────*/
function buildTeacherApplyCommand() {
  return new SlashCommandBuilder()
    .setName("academy-teacher-apply")
    .setDescription("Apply to teach at Lifeline Academy")
    .toJSON();
}
async function openTeacherApplyModal(interaction) {
  const modal = new ModalBuilder().setCustomId("academy_teacher_modal").setTitle("Lifeline Academy — Teacher Application");
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("sl").setLabel("Your Second Life username").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("subjects").setLabel("Subjects you want to teach").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId("availability").setLabel("Availability, experience, teaching style").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(800)),
  );
  await interaction.showModal(modal);
}
async function submitTeacherApply(interaction) {
  await interaction.deferReply({ flags: 64 });
  const slUsername = interaction.fields.getTextInputValue("sl").trim();
  const subjects = interaction.fields.getTextInputValue("subjects").trim();
  const availability = (interaction.fields.getTextInputValue("availability") || "").trim();
  try {
    const r = await backendPost("/academy/admin/teacher-apply", {
      slUsername, subjects, availability,
      name: slUsername,
      discordUserId: interaction.user.id,
      discordTag: interaction.user.tag || interaction.user.username,
    });
    await interaction.editReply(`✅ ${r.message || "Your teacher application was submitted."} An admin will review it and you'll get a DM with the decision.`);
  } catch (e) {
    await interaction.editReply(`⚠️ Could not submit: ${e.message}`);
  }
}

/* ── /academy-assign : owner-only bulk coursework assignment ─────────────────*/
const assignSessions = new Map();
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [k, v] of assignSessions) if (v.at < cutoff) assignSessions.delete(k);
}, 5 * 60 * 1000).unref?.();

function buildAssignCommand() {
  return new SlashCommandBuilder()
    .setName("academy-assign")
    .setDescription("Assign Academy lessons, quizzes, or homework to students (bulk)")
    .addStringOption((o) => o.setName("band").setDescription("Filter to one grade band").addChoices(
      { name: "K-2", value: "K-2" }, { name: "3-5", value: "3-5" },
      { name: "6-8", value: "6-8" }, { name: "9-12", value: "9-12" },
    ))
    .toJSON();
}

const TYPE_EMOJI = { lesson: "📖", quiz: "📝", homework: "🏠", project: "🎨" };
function assignEmbed(session, statusLine = "") {
  return new EmbedBuilder()
    .setTitle("🍎 Lifeline Academy — Assign Coursework").setColor(BRAND)
    .setDescription("Pick coursework and students below, then press **Assign**.\nStudents get an in-app notification from **Tammy Brightwood** the moment it lands on their ZPad." +
      (session.band ? `\n\nFiltered to grade band **${session.band}**.` : ""))
    .addFields(
      { name: "📚 Selected coursework", value: session.templates.length ? session.templates.map((t) => `• ${t}`).join("\n").slice(0, 1000) : "*none yet*" },
      { name: "🎒 Selected students", value: session.studentLabel || "*none yet*" },
      ...(statusLine ? [{ name: "Result", value: statusLine }] : []),
    )
    .setFooter({ text: "Lifeline Academy Digital • bulk assign" }).setTimestamp();
}
async function startAssignFlow(interaction) {
  const band = interaction.options.getString("band") || "";
  await interaction.deferReply({ flags: 64 });
  let templates, students;
  try {
    [templates, students] = await Promise.all([
      backendGet(`/academy/admin/templates${band ? `?band=${encodeURIComponent(band)}` : ""}`).then((b) => b.templates),
      backendGet(`/academy/admin/students${band ? `?band=${encodeURIComponent(band)}` : ""}`).then((b) => b.students),
    ]);
  } catch (e) { return interaction.editReply(`Could not reach the Academy backend: ${e.message}`); }
  if (!templates.length) return interaction.editReply("No approved coursework templates found.");

  const tplSelect = new StringSelectMenuBuilder().setCustomId("bacademy_assign_tpl")
    .setPlaceholder("📚 Choose coursework (multi-select)").setMinValues(1).setMaxValues(Math.min(10, templates.length))
    .addOptions(templates.slice(0, 25).map((t) => ({
      label: String(t.title).slice(0, 100), value: String(t.template_code).slice(0, 100),
      description: `${t.grade_band} • ${t.item_type} • ${t.points} pts • ~${t.estimated_minutes} min`.slice(0, 100),
      emoji: TYPE_EMOJI[t.item_type] || "📚",
    })));
  const studentOptions = [
    { label: "All students", value: "all", description: "Every active Academy student", emoji: "🌍" },
    ...["K-2", "3-5", "6-8", "9-12"].map((b) => ({ label: `All of band ${b}`, value: `band:${b}`, description: `Every active student in ${b}`, emoji: "🎒" })),
    ...students.slice(0, 20).map((s) => ({
      label: String(s.display_name || "Student").slice(0, 100), value: String(s.avatar_uuid),
      description: `Grade ${s.school_level || "?"} • ${s.grade_band || "?"}${s.discord_username ? " • @" + s.discord_username : ""}`.slice(0, 100),
      emoji: "🧑‍🎓",
    })),
  ];
  const stuSelect = new StringSelectMenuBuilder().setCustomId("bacademy_assign_stu")
    .setPlaceholder("🎒 Choose students, a whole band, or everyone").setMinValues(1).setMaxValues(Math.min(10, studentOptions.length)).addOptions(studentOptions);
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("bacademy_assign_go").setLabel("Assign").setStyle(ButtonStyle.Success).setEmoji("🍎"),
    new ButtonBuilder().setCustomId("bacademy_assign_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary),
  );
  const session = { templates: [], templateLabels: [], students: [], studentLabel: "", band, startedBy: interaction.user.id, at: Date.now(), tplCatalog: templates };
  const msg = await interaction.editReply({
    embeds: [assignEmbed(session)],
    components: [new ActionRowBuilder().addComponents(tplSelect), new ActionRowBuilder().addComponents(stuSelect), buttons],
  });
  assignSessions.set(msg.id, session);
}
async function handleAssignComponent(interaction) {
  const session = assignSessions.get(interaction.message?.id);
  if (!session) { await interaction.reply({ content: "This picker expired — run /academy-assign again.", flags: 64 }); return true; }
  if (interaction.isStringSelectMenu?.()) {
    if (interaction.customId === "bacademy_assign_tpl") {
      session.templates = interaction.values;
      const byCode = Object.fromEntries((session.tplCatalog || []).map((t) => [t.template_code, t]));
      session.templateLabels = interaction.values.map((v) => byCode[v] ? `${TYPE_EMOJI[byCode[v].item_type] || "📚"} ${byCode[v].title}` : v);
    }
    if (interaction.customId === "bacademy_assign_stu") {
      session.students = interaction.values;
      session.studentLabel = interaction.values.map((v) => v === "all" ? "🌍 All students" : v.startsWith("band:") ? `🎒 All of band ${v.slice(5)}` : `🧑‍🎓 \`${v.slice(0, 8)}…\``).join("\n");
    }
    session.at = Date.now();
    await interaction.update({ embeds: [assignEmbed({ ...session, templates: session.templateLabels })] });
    return true;
  }
  if (interaction.customId === "bacademy_assign_cancel") {
    assignSessions.delete(interaction.message.id);
    await interaction.update({ embeds: [assignEmbed({ ...session, templates: session.templateLabels }, "❌ Cancelled — nothing was assigned.")], components: [] });
    return true;
  }
  if (interaction.customId === "bacademy_assign_go") {
    if (!session.templates.length || !session.students.length) { await interaction.reply({ content: "Pick at least one coursework item and one student target first.", flags: 64 }); return true; }
    await interaction.deferUpdate();
    const bulk = session.students.find((v) => v === "all" || v.startsWith("band:"));
    try {
      const body = await backendPost("/academy/admin/assign", { templateCodes: session.templates, students: bulk || session.students, actor: interaction.user.tag || interaction.user.id });
      assignSessions.delete(interaction.message.id);
      await interaction.editReply({
        embeds: [assignEmbed({ ...session, templates: session.templateLabels },
          `✅ **${body.created}** new assignment${body.created === 1 ? "" : "s"} delivered to **${body.students}** student${body.students === 1 ? "" : "s"}.` +
          (body.skipped ? ` (${body.skipped} already had that work — skipped, no duplicates.)` : ""))],
        components: [],
      });
    } catch (e) {
      await interaction.editReply({ embeds: [assignEmbed({ ...session, templates: session.templateLabels }, `⚠️ Assign failed: ${e.message}`)], components: [] });
    }
    return true;
  }
  return true;
}

/* ── Command JSON for registration ──────────────────────────────────────────*/
function commands() {
  return [buildTeacherApplyCommand(), buildAssignCommand()];
}

/** Returns true when the interaction belonged to the Academy bridge. */
async function handle(interaction, client) {
  // Teacher application: open to everyone.
  if (interaction.isChatInputCommand?.() && interaction.commandName === "academy-teacher-apply") {
    await openTeacherApplyModal(interaction); return true;
  }
  if (interaction.isModalSubmit?.() && interaction.customId === "academy_teacher_modal") {
    await submitTeacherApply(interaction); return true;
  }

  // Everything below is OWNER-ONLY (staff controls).
  if (interaction.isChatInputCommand?.() && interaction.commandName === "academy-assign") {
    if (!isOwner(interaction)) return (await denyNonOwner(interaction), true);
    await startAssignFlow(interaction); return true;
  }
  if ((interaction.isStringSelectMenu?.() || interaction.isButton?.()) && interaction.customId?.startsWith("bacademy_assign_")) {
    if (!isOwner(interaction)) return (await denyNonOwner(interaction), true);
    return handleAssignComponent(interaction);
  }
  // Application embed buttons → note modal.
  if (interaction.isButton?.() && interaction.customId?.startsWith("bacademy:")) {
    if (!isOwner(interaction)) return (await denyNonOwner(interaction), true);
    const [, action, id] = interaction.customId.split(":");
    const cfg = ACTION_LABELS[action];
    if (!cfg) return true;
    const modal = new ModalBuilder().setCustomId(`bacademy_modal:${action}:${id}`).setTitle(cfg[0])
      .addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("note").setLabel(cfg[1]).setStyle(TextInputStyle.Paragraph).setRequired(cfg[2])));
    await interaction.showModal(modal); return true;
  }
  // Decision modal submit → call backend, DM applicant, retire buttons.
  if (interaction.isModalSubmit?.() && interaction.customId?.startsWith("bacademy_modal:")) {
    if (!isOwner(interaction)) return (await denyNonOwner(interaction), true);
    const [, action, id] = interaction.customId.split(":");
    const note = interaction.fields.getTextInputValue("note") || "";
    await interaction.deferReply({ flags: 64 });
    try {
      const result = await backendPost("/academy/admin/decide", { applicationId: id, action, note, actor: interaction.user.tag || interaction.user.id });
      const dmed = await dmApplicant(client, result, action, note);
      const verb = action === "accept" ? "ACCEPTED" : action === "deny" ? "DENIED" : "sent back for more info";
      await interaction.editReply(`Academy ${result.applicationType} application for **${result.applicant}** ${verb}. ` +
        (dmed ? "The applicant got a DM." : "Couldn't DM the applicant (no reachable Discord) — they'll see it on their ZPad."));
      if (interaction.message) {
        const decidedRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("bacademy_done").setLabel(action === "accept" ? "Accepted ✔" : action === "deny" ? "Denied ✘" : "Info Requested ✉")
            .setStyle(action === "accept" ? ButtonStyle.Success : action === "deny" ? ButtonStyle.Danger : ButtonStyle.Primary).setDisabled(true));
        const embed = EmbedBuilder.from(interaction.message.embeds[0] ?? { title: "Academy Application" })
          .setColor(action === "accept" ? 0x58a55c : action === "deny" ? 0xd9534f : 0xf2b84b)
          .setFooter({ text: `Decided by ${interaction.user.tag || interaction.user.id} • ${new Date().toISOString()}` });
        await interaction.message.edit({ embeds: [embed], components: [decidedRow] }).catch(() => {});
      }
    } catch (e) {
      await interaction.editReply(`Could not apply the decision: ${e.message}`);
    }
    return true;
  }
  return false;
}

module.exports = { handle, commands, OWNER_ID };
