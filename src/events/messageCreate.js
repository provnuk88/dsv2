const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    name: Events.MessageCreate,
    once: false,
    async execute(message) {
        try {
            // Игнорируем сообщения от ботов
            if (message.author.bot) return;
            
            // Здесь можно добавить обработку сообщений, если это необходимо
            // Например, обработку команд, которые начинаются с определенного префикса
            
            // Для данного бота основная функциональность реализована через слеш-команды,
            // поэтому обработка обычных сообщений минимальна
            
        } catch (error) {
            logger.error(`Ошибка при обработке сообщения: ${error.message}`);
        }
    },
};
