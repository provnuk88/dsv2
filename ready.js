const { Events, ActivityType } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        logger.info(`Бот ${client.user.tag} успешно подключен к Discord!`);
        
        // Устанавливаем статус и активность бота
        client.user.setPresence({
            status: 'online',
            activities: [{
                name: '/help для справки',
                type: ActivityType.Playing
            }]
        });
        
        logger.info('Бот готов к работе!');
    },
};
