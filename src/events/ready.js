const { Events, ActivityType } = require('discord.js');
const logger = require('../utils/logger');
const announcementScheduler = require('../utils/announcementScheduler');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.info(`Бот ${client.user.tag} успешно подключен к Discord!`);
        
        // Устанавливаем статус и активность бота
        client.user.setPresence({
            status: 'online',
            activities: [{
                name: '/help для справки',
                type: ActivityType.Playing
            }]
        });
        
        await announcementScheduler.initialize();
        logger.info('Бот готов к работе!');
    },
};
