const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const channels = ["1428519215635365930", "1428518773786279937"];

const announcement = `🎓 NEW ZPAD UPDATE: LIFELINE ACADEMY DIGITAL IS HERE!

Turn your ZPad into a complete virtual classroom with Lifeline Academy Digital — your K–12 school experience designed for Second Life!

Students can now complete interactive lessons in Math, English, Science, Social Studies, and Life Skills, submit homework directly from their ZPad, take auto-graded quizzes with instant feedback, and track grades across every subject.

🏆 Earn achievement badges such as Welcome Scholar, Homework Hero, and Quiz Ready
📚 Build your attendance streak and work toward the weekly Honor Roll
📈 Watch your GPA grow as you complete assignments
📝 Receive teacher notes and assignment feedback directly on your dashboard
☁️ Keep your progress safely saved to the cloud
👩‍🏫 Apply for student or teacher positions directly through the Academy app

Coursework is tailored by grade level, with fun activities for younger students and advanced Math, Science, Literature, and Life Skills lessons for older students.

📲 Want to take your roleplay beyond Second Life?
Opt in to Discord DMs to receive real report cards, coursework alerts, teacher feedback, and real-time notifications from Tammy Brightwood.

All ZPad update redeliveries have been sent. If you have not received yours, please use /redelivery.

To begin, open the Academy app on your ZPad and tap Student Apply. Applications are reviewed within approximately 2 hours.

Your school, your way — on your ZPad.`;

// Copy images from lifeline-discord-bot to oscar-bot
const sourceDir = "C:\\Users\\Shadow\\Desktop\\lifeline-discord-bot\\Images Assets";
const targetDir = path.join(__dirname, "temp_images");

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const image1Source = path.join(sourceDir, "zpad1.png");
const image2Source = path.join(sourceDir, "zpad2.png");
const image1Target = path.join(targetDir, "zpad1.png");
const image2Target = path.join(targetDir, "zpad2.png");

if (fs.existsSync(image1Source)) {
  fs.copyFileSync(image1Source, image1Target);
  console.log("Copied zpad1.png");
} else {
  console.error("zpad1.png not found at source");
}

if (fs.existsSync(image2Source)) {
  fs.copyFileSync(image2Source, image2Target);
  console.log("Copied zpad2.png");
} else {
  console.error("zpad2.png not found at source");
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const attachments = [
    { attachment: image1Target, name: "zpad1.png" },
    { attachment: image2Target, name: "zpad2.png" }
  ];

  for (const channelId of channels) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel) {
        console.error(`Could not fetch channel ${channelId}`);
        continue;
      }
      await channel.send({ content: announcement, files: attachments });
      console.log(`Posted announcement to channel ${channelId}`);
    } catch (error) {
      console.error(`Error posting to channel ${channelId}:`, error.message);
    }
  }

  // Cleanup temp images
  try {
    fs.unlinkSync(image1Target);
    fs.unlinkSync(image2Target);
    fs.rmdirSync(targetDir);
    console.log("Cleaned up temporary images");
  } catch (error) {
    console.error("Error cleaning up:", error.message);
  }

  await client.destroy();
  process.exit(0);
});

client.login(token).catch((error) => {
  console.error("Discord login failed:", error.message);
  process.exit(1);
});
