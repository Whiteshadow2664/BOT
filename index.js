// ✅ index.js

const {
    Client,
    GatewayIntentBits,
    Partials,
    Events,
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');
require('dotenv').config();
const bumpRank = require('./bumprank');

// ✅ Start express server to keep bot alive
const express = require('express');
const app = express();
const PORT = 3000;

app.get('/', (req, res) => res.send('Bump Tracker Bot is running.'));
app.listen(PORT, () => console.log(`🌐 Server running on http://localhost:${PORT}`));

// ✅ Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// ✅ Register slash command when bot is ready
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

// ✅ Listen for bump messages from Disboard
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

// ✅ Login to Discord
client.login(process.env.BOT_TOKEN);