require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { connectToDatabase } = require('./database/connection');
const logger = require('./utils/logger');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFolders = fs.readdirSync(commandsPath);
    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        const commandFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(path.join(folderPath, file));
            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
            }
        }
    }
}

function loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
    for (const file of eventFiles) {
        const event = require(path.join(eventsPath, file));
        if (event.once) {
            client.once(event.name, (...args) => event.execute(client, ...args));
        } else {
            client.on(event.name, (...args) => event.execute(client, ...args));
        }
    }
}

async function start() {
    try {
        await connectToDatabase();
        loadCommands();
        loadEvents();
        await client.login(process.env.BOT_TOKEN);
        logger.info('Bot logged in');
    } catch (err) {
        logger.error(`Failed to start bot: ${err.message}`);
    }
}

start();

module.exports = { client };
