const express = require('express');
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config();

// --- CONFIGURATION ---
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // Set this in Render Env Vars

// --- DISCORD BOT SETUP ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// --- MIDDLEWARE ---
app.use(cors()); // Allows Netlify to talk to this server
app.use(express.json());

// Setup Multer (File Handling) - Stores file in RAM momentarily
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 25 * 1024 * 1024 } // Limit to 25MB (Discord Free Limit)
});

// --- ROUTES ---

// 1. Health Check
app.get('/', (req, res) => {
    res.send('Discord Bot API is Running!');
});

// 2. Get Channels (Populates the dropdown on frontend)
app.get('/api/channels', async (req, res) => {
    // Basic Auth Check
    const authHeader = req.headers['authorization'];
    if (authHeader !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Invalid Password' });

    try {
        const channels = [];
        // Loop through all servers (guilds) the bot is in
        client.guilds.cache.forEach(guild => {
            guild.channels.cache.forEach(channel => {
                // Only get Text Channels that the bot can send messages to
                if (channel.type === ChannelType.GuildText && 
                    channel.permissionsFor(client.user).has('SendMessages')) {
                    channels.push({
                        id: channel.id,
                        name: `${guild.name} - #${channel.name}`
                    });
                }
            });
        });
        res.json(channels);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch channels' });
    }
});

// 3. Post Content
app.post('/api/post', upload.single('mediaFile'), async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (authHeader !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Invalid Password' });

    const { channelId, postTitle } = req.body;
    const file = req.file;

    if (!channelId) return res.status(400).json({ error: 'Channel is required' });

    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) return res.status(404).json({ error: 'Channel not found' });

        // Prepare the payload
        const payload = {};
        if (postTitle) payload.content = postTitle;
        if (file) {
            payload.files = [{
                attachment: file.buffer,
                name: file.originalname
            }];
        }

        if (!payload.content && !payload.files) {
            return res.status(400).json({ error: 'Must provide title or file' });
        }

        await channel.send(payload);
        res.json({ success: true, message: 'Posted successfully!' });

    } catch (error) {
        console.error('Post Error:', error);
        res.status(500).json({ error: 'Failed to post to Discord' });
    }
});

// --- STARTUP ---
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Login Bot then start Server
client.login(process.env.DISCORD_TOKEN);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
