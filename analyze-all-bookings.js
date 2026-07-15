/* Deep analysis: scan ALL booking tickets for paid/approved packages, cabin romance
 * setups, snack/drink orders, and any services still pending crew action.
 * Run: node analyze-all-bookings.js */
require("dotenv").config();

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

const BOOKING_CHANNELS = [
  { name: "booking-1001", id: "1522415623316181184" },
  { name: "booking-1002", id: "1522415947196137572" },
  { name: "booking-1004", id: "1522416970526625936" },
  { name: "booking-1006", id: "1522417820527366255" },
  { name: "booking-1007", id: "1522418195544281088" },
  { name: "booking-1010", id: "1522419930585239693" },
  { name: "booking-1011", id: "1522420712571277383" },
  { name: "booking-1016", id: "1522422514033229834" },
  { name: "booking-1018", id: "1522427610699796561" },
  { name: "booking-1019", id: "1522428225580564573" },
  { name: "booking-1020", id: "1522433036308975708" },
  { name: "booking-1022", id: "1522435924695449722" },
  { name: "booking-1024", id: "1522442319436054739" },
  { name: "booking-1032", id: "1524018484085002320" },
  { name: "booking-1033", id: "1525850189414531120" },
  { name: "booking-1034", id: "1525957535448961174" },
  { name: "booking-1035", id: "1525981661823762674" },
  { name: "booking-1036", id: "1525982761427533886" },
  { name: "booking-1037", id: "1525991306730410055" },
  { name: "booking-1038", id: "1526022246739742790" },
  { name: "booking-1049", id: "1526073907650756770" },
  { name: "booking-1052", id: "1526375803078574241" },
  { name: "booking-1053", id: "1526378235674230885" },
  { name: "booking-1057", id: "1526681738833690755" },
  { name: "booking-1058", id: "1526692049682698302" },
  { name: "booking-1066", id: "1526801986589167789" },
];

const KEYWORDS = [
  "paid", "approved", "package", "romance", "cabin", "romantic setup",
  "snack", "drink", "detective", "mystery", "sunset", "picnic",
  "bungalow", "kids", "family", "photos", "date night", "consent",
  "cleanup", "L$", "L$450", "L$800", "L$2600", "L$2,600", "L$2,600",
  "payment approved", "payment received", "confirmed",
];

async function fetchMessages(channelId, limit = 30) {
  const r = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`,
    { headers: { Authorization: `Bot ${TOKEN}` } }
  );
  if (!r.ok) {
    if (r.status === 403) return [];
    throw new Error(`HTTP ${r.status} for ${channelId}`);
  }
  return r.json();
}

function scanMessages(messages) {
  const findings = {
    packages: [],
    payments: [],
    romance: [],
    snacks: [],
    consents: [],
    cleanup: [],
    otherServices: [],
    ticketName: "",
  };

  for (const msg of messages) {
    // Check content
    const content = (msg.content || "").toLowerCase();
    if (content.includes("payment approved") || content.includes("approved") && content.includes("L$")) {
      findings.payments.push({ text: msg.content, id: msg.id });
    }

    // Check embeds
    for (const embed of (msg.embeds || [])) {
      const title = (embed.title || "").toLowerCase();
      const desc = (embed.description || "").toLowerCase();
      const allFields = (embed.fields || []).map(f => ((f.name || "") + " " + (f.value || "")).toLowerCase()).join(" ");

      const fullText = title + " " + desc + " " + allFields;

      if (fullText.includes("romance") || fullText.includes("cabin") || fullText.includes("romantic")) {
        findings.romance.push({ title: embed.title, desc: embed.description?.slice(0, 100), id: msg.id });
      }
      if (fullText.includes("snack") || fullText.includes("drink") || fullText.includes("snacks & drinks")) {
        findings.snacks.push({ title: embed.title, desc: embed.description?.slice(0, 100), id: msg.id });
      }
      if (fullText.includes("consent") || fullText.includes("i consent")) {
        findings.consents.push({ title: embed.title, desc: embed.description?.slice(0, 80), id: msg.id });
      }
      if (fullText.includes("cleanup") || fullText.includes("teardown") || fullText.includes("tidy")) {
        findings.cleanup.push({ title: embed.title, id: msg.id });
      }
      // Detect packages
      for (const pkg of ["detective crew", "kids cruise fun", "family photo memories", "mystery date night", "bungalow romantic escape", "sunset picnic", "mystery date"]) {
        if (fullText.includes(pkg)) {
          findings.packages.push({ type: pkg, title: embed.title, id: msg.id });
        }
      }
    }

    // Check author - grab the ticker name from the first system message
    if (msg.author?.bot && (msg.content || "").includes("booking")) {
      findings.ticketName = msg.content;
    }
  }

  return findings;
}

(async () => {
  console.log("=== DEEP ANALYSIS: ALL BOOKING TICKETS ===\n");

  const summary = {
    total: BOOKING_CHANNELS.length,
    withPackages: 0,
    withRomance: 0,
    withSnacks: 0,
    withConsents: 0,
    withPayments: 0,
    activeServices: [],
  };

  for (const ch of BOOKING_CHANNELS) {
    process.stdout.write(`Scanning ${ch.name}... `);
    const msgs = await fetchMessages(ch.id);
    if (!msgs.length) {
      console.log("⏭️  no messages or no access");
      continue;
    }
    const findings = scanMessages(msgs);
    console.log(`${msgs.length} msgs`);

    const hasAnything = findings.packages.length || findings.romance.length || findings.snacks.length ||
                        findings.payments.length || findings.consents.length;

    if (!hasAnything) continue;

    summary.withPackages += findings.packages.length > 0 ? 1 : 0;
    summary.withRomance += findings.romance.length > 0 ? 1 : 0;
    summary.withSnacks += findings.snacks.length > 0 ? 1 : 0;
    summary.withConsents += findings.consents.length > 0 ? 1 : 0;
    summary.withPayments += findings.payments.length > 0 ? 1 : 0;

    console.log(`\n  📋 ${ch.name} (${ch.id})`);
    if (findings.payments.length) {
      console.log(`  💰 Payments Found: ${findings.payments.length}`);
      for (const p of findings.payments) console.log(`     "${p.text?.slice(0, 120)}"`);
    }
    if (findings.packages.length) {
      console.log(`  📦 Packages: ${findings.packages.map(p => p.type).join(", ")}`);
    }
    if (findings.romance.length) {
      console.log(`  🌹 Romance/Cabin: ${findings.romance.length} message(s)`);
      // Check if romance completion was sent
      const hasComplete = findings.romance.some(r => (r.title || "").includes("Complete"));
      const hasCleanup = findings.cleanup.length > 0 || findings.consents.some(c => (c.title || "").includes("Consent Received"));
      console.log(`     Completion sent: ${hasComplete ? "✅" : "❌"} | Cleanup offered: ${hasCleanup ? "✅" : "❌"}`);
    }
    if (findings.snacks.length) {
      console.log(`  🍿 Snacks/Drinks: ${findings.snacks.length} message(s)`);
    }
    if (findings.consents.length) {
      console.log(`  💗 Consents: ${findings.consents.length}`);
    }
    if (findings.cleanup.length) {
      console.log(`  🧹 Cleanup: ${findings.cleanup.length} message(s)`);
    }

    if ((findings.packages.length || findings.payments.length) && !findings.consents.length) {
      summary.activeServices.push({
        name: ch.name,
        id: ch.id,
        reason: "Paid packages found but no consent/fulfillment detected",
        packages: findings.packages,
        payments: findings.payments,
      });
    }
    console.log("");
  }

  console.log("=== SUMMARY ===\n");
  console.log(`Total booking tickets: ${summary.total}`);
  console.log(`With package references: ${summary.withPackages}`);
  console.log(`With payments: ${summary.withPayments}`);
  console.log(`With romance/cabin services: ${summary.withRomance}`);
  console.log(`With snacks/drinks: ${summary.withSnacks}`);
  console.log(`With consents given: ${summary.withConsents}`);

  if (summary.activeServices.length) {
    console.log(`\n⚠️  TICKETS WITH PAID PACKAGES PENDING FULFILLMENT:`);
    for (const s of summary.activeServices) {
      console.log(`  - ${s.name} (${s.id}): ${s.reason}`);
    }
  } else {
    console.log(`\n✅ All paid packages appear to have consent/fulfillment in progress.`);
  }

  console.log("\n=== ANALYSIS COMPLETE ===");
})().catch(e => { console.error("Fatal:", e); process.exit(1); });
