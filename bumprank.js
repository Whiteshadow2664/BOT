// ✅ bumprank.js

const { EmbedBuilder } = require('discord.js');
const { Pool } = require('pg');
const cron = require('node-cron');

const bumpCache = new Map();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    idleTimeoutMillis: 30000,
});

// ✅ Ensure bump_rank table exists (without days and avg)
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bump_rank (
                user_id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                bumps INTEGER NOT NULL DEFAULT 0
            );
        `);
    } catch (err) {
        console.error('Error creating bump_rank table:', err);
    }
})();

// ✅ Track bump messages from Disboard bot
module.exports.trackBump = async (message) => {
    const disboardBotId = '540129267728515072';

    if (
        message.author.id === disboardBotId &&
        message.content.includes('Thx for bumping our Server!')
    ) {
        const match = message.content.match(/<@!?([0-9]+)>/);
        if (!match) return;

        const userId = match[1];
        const user = await message.guild.members.fetch(userId).catch(() => null);
        if (!user) return;

        const username = user.user.username;

        if (bumpCache.has(userId)) {
            bumpCache.get(userId).bumps += 1;
        } else {
            bumpCache.set(userId, { username, bumps: 1 });
        }

        console.log(`✅ Tracked bump from ${username}`);
    }
};

// ✅ Save bump data to DB daily at 1:20 PM IST
cron.schedule('28 13 * * *', async () => {
    console.log('⏳ Saving bump data to DB...');

    if (bumpCache.size === 0) {
        console.log('✅ No bump data to save.');
        return;
    }

    try {
        const client = await pool.connect();

        for (const [userId, data] of bumpCache.entries()) {
            const { username, bumps } = data;
            const result = await client.query('SELECT * FROM bump_rank WHERE user_id = $1', [userId]);

            if (result.rows.length > 0) {
                await client.query(
                    'UPDATE bump_rank SET bumps = bumps + $1, username = $2 WHERE user_id = $3',
                    [bumps, username, userId]
                );
            } else {
                await client.query(
                    'INSERT INTO bump_rank (user_id, username, bumps) VALUES ($1, $2, $3)',
                    [userId, username, bumps]
                );
            }
        }

        bumpCache.clear();
        client.release();
        console.log('✅ Bump data saved.');
    } catch (err) {
        console.error('❌ Error saving bump data:', err);
    }
}, { timezone: 'Asia/Kolkata' });

// ✅ Slash command /brank to show leaderboard
module.exports.execute = async (interaction) => {
    try {
        const client = await pool.connect();

        const result = await client.query(`
            SELECT username, bumps
            FROM bump_rank
            ORDER BY bumps DESC
            LIMIT 10
        `);

        client.release();

        if (result.rows.length === 0) {
            return interaction.reply({ content: 'No bump data available yet.' });
        }

        const embed = new EmbedBuilder()
            .setTitle('📈 Bump Leaderboard')
            .setColor('#acf508')
            .setDescription(
                result.rows
                    .map((row, i) =>
                        `**#${i + 1}** | **${row.username}** - **Bumps:** ${row.bumps}`
                    )
                    .join('\n') + `\n\n**Bumps** = Total number of times user has bumped`
            );

        interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Error fetching bump leaderboard:', error);
        interaction.reply({ content: 'An error occurred while retrieving the leaderboard.' });
    }
};