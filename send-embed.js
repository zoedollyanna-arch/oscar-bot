const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = '1525850189414531120';

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);

    const embed = new EmbedBuilder()
      .setColor(0xFFB6C1) // Cute pastel pink
      .setTitle('🏡✨ Room Change Layout Request Fulfilled')
      .setDescription(
        'Hello! 💕\n\nYour **cabin is now ready**, and your **room change layout request has been completed!** Everything has been set up just for you. 🌸'
      )
      .addFields({
        name: '🛠️ Items Added',
        value:
          '🛏️ **Kids Triple Bunk Bed** *(Starries Compatible)*\n' +
          '🍿 **Snack Cart**\n' +
          '🥂 **Bar Cart**\n' +
          '🍽️ **Microwave**\n' +
          '🍟 **Air Fryer**\n' +
          '✨ **LED Ceiling Lights** *(Star Ceiling Effect)*\n' +
          '🥤 **Milkshake & Melon Dispenser**\n' +
          '🛁 **Kids Bathtub & Toilet**\n' +
          '🧸 **Kids Korner Toy Givers, Playpen & Bouncer** *(Playpen & Bouncer are Starries Compatible)*\n' +
          '🪑 **High Chair** *(Starries Compatible)*'
      })
      .setThumbnail(client.user.displayAvatarURL())
      .setFooter({
        text: '✨ Thank you for choosing us! Enjoy your newly updated cabin! 🌟'
      })
      .setTimestamp();

    await channel.send({
      content: '🎉 Your booking request has been completed!',
      embeds: [embed],
    });

    console.log('✅ Embed sent successfully!');
  } catch (err) {
    console.error(err);
  }

  process.exit();
});

client.login(TOKEN);