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

// ✅ Ensure bump_rank table exists
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bump_rank (
                user_id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                bumps INTEGER NOT NULL DEFAULT 0,
                first_bump_at TIMESTAMP NOT NULL
            );
        `);
    } catch (err) {
        console.error('Error creating bump_rank table:', err);
    }
})();

// ✅ Track bump messages from Disboard bot
module.exports.trackBump = async (message) => {
    const disboardBotId = '735147814878969968';

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
        const now = new Date();

        if (bumpCache.has(userId)) {
            bumpCache.get(userId).bumps += 1;
        } else {
            bumpCache.set(userId, { username, bumps: 1, first_bump_at: now });
        }

        console.log(`✅ Tracked bump from ${username}`);
    }
};

// ✅ Save bump data to DB daily at 05:15 AM IST
cron.schedule('15 5 * * *', async () => {
    console.log('⏳ Saving bump data to DB...');

    if (bumpCache.size === 0) {
        console.log('✅ No bump data to save.');
        return;
    }

    try {
        const client = await pool.connect();

        for (const [userId, data] of bumpCache.entries()) {
            const { username, bumps, first_bump_at } = data;
            const result = await client.query('SELECT * FROM bump_rank WHERE user_id = $1', [userId]);

            if (result.rows.length > 0) {
                await client.query(
                    'UPDATE bump_rank SET bumps = bumps + $1 WHERE user_id = $2',
                    [bumps, userId]
                );
            } else {
                await client.query(
                    'INSERT INTO bump_rank (user_id, username, bumps, first_bump_at) VALUES ($1, $2, $3, $4)',
                    [userId, username, bumps, first_bump_at]
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
            SELECT username, bumps,
                EXTRACT(DAY FROM NOW() - first_bump_at) AS days,
                (bumps::FLOAT / NULLIF(EXTRACT(DAY FROM NOW() - first_bump_at), 0)) AS avg_bumps
            FROM bump_rank
            ORDER BY bumps DESC, avg_bumps DESC
            LIMIT 10
        `);

        client.release();

        if (result.rows.length === 0) {
            return interaction.reply({ content: 'No bump data available yet.' });
        }

        const topUser = result.rows[0];
        const cheer = `🙌 **${topUser.username} is topping the bump charts! Keep it going!**`;

        const embed = new EmbedBuilder()
            .setTitle('📈 Bump Leaderboard')
            .setColor('#acf508')
            .setDescription(
                result.rows
                    .map((row, i) =>
                        `**#${i + 1}** | **${row.days} Days** | **${row.username}** - **Bumps:** ${row.bumps} | **AVG:** ${row.avg_bumps ? row.avg_bumps.toFixed(2) : '0.00'}`
                    )
                    .join('\n') + `\n\n${cheer}\n\n**Bumps** = Total bumps | **AVG** = Average bumps per day`
            );

        interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Error fetching bump leaderboard:', error);
        interaction.reply({ content: 'An error occurred while retrieving the leaderboard.' });
    }
};