const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();
const TARGETS = [
  { ch: "1527450160198586450", ping: "1097661443354144858", tag: "st.unning" },   // booking-1074
  { ch: "1527129352343388160", ping: "965104905192869949", tag: "thatssotayy" },  // booking-1069
];
const LM = {
  entrance: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/125/152/31",
  food:     "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/216/188/23",
  play:     "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/169/192/23",
  falls:    "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/222/165/23",
  pool:     "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/181/101/23",
  paintball:"http://maps.secondlife.com/secondlife/Ethereal%20Paradise/217/78/23",
  beach:    "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/177/50/24",
};
const embed = (tag) => ({
  color: 0xFFB6C1,
  title: "🌺✨ Welcome to Sagara Isle, Bali! ✨🌺",
  description:
    `Hi **${tag}**! 💕 Perfect timing — we're currently **docked at Sagara Isle, Bali** 🏝️ and it's all yours to ` +
    "explore during your stay! Here's your little map to paradise: 🌴🌊",
  fields: [
    { name: "🏝️ Entrance", value: `[✨ Teleport](${LM.entrance})`, inline: true },
    { name: "🍔 Food Court", value: `[✨ Teleport](${LM.food})`, inline: true },
    { name: "🛝 Playground", value: `[✨ Teleport](${LM.play})`, inline: true },
    { name: "💦 Splash Falls", value: `[✨ Teleport](${LM.falls})`, inline: true },
    { name: "🏊 Pool / Splash Zone", value: `[✨ Teleport](${LM.pool})`, inline: true },
    { name: "🎯 Paintball", value: `[✨ Teleport](${LM.paintball})`, inline: true },
    { name: "🏖️ Beach", value: `[✨ Teleport](${LM.beach})`, inline: true },
  ],
  footer: { text: "Lifeline Island Paradise • Now docked at Sagara Isle, Bali 💙🌊" },
  timestamp: new Date().toISOString(),
});
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  for (const t of TARGETS) {
    try {
      const ch = await client.channels.fetch(t.ch);
      const sent = await ch.send({ content: `<@${t.ping}>`, embeds: [embed(t.tag)], allowedMentions: { users: [t.ping] } });
      console.log(`✅ #${ch.name}: https://discord.com/channels/${ch.guildId}/${ch.id}/${sent.id}`);
    } catch (e) { console.error(`❌ ${t.ch}:`, e.message); process.exitCode = 1; }
    await sleep(400);
  }
  await client.destroy(); process.exit(process.exitCode || 0);
});
client.login(process.env.DISCORD_TOKEN).catch(e => { console.error("Login failed:", e.message); process.exit(1); });
