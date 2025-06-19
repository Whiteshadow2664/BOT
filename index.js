const { Client, GatewayIntentBits, Partials, Events, REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const bumpRank = require('./bumprank');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel]
});

// ✅ Register slash command on ready
client.once(Events.ClientReady, async () => {
    console.log(`${client.user.tag} is online.`);

    const commands = [
        new SlashCommandBuilder()
            .setName('brank')
            .setDescription('View the server bump leaderboard')
            .toJSON()
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

    try {
        console.log('🔁 Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ Slash commands registered.');
    } catch (error) {
        console.error('❌ Failed to register slash commands:', error);
    }
});

// ✅ Track bump messages
client.on(Events.MessageCreate, async message => {
    bumpRank.trackBump(message);
});

// ✅ Handle /brank command
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'brank') {
        await bumpRank.execute(interaction);
    }
});

// ✅ Login
client.login(process.env.BOT_TOKEN);