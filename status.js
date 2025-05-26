const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const os = require('os');
const { version } = require('../../../package.json');
const mongoose = require('mongoose');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Показывает текущий статус бота и системную информацию'),
    
    async execute(interaction) {
        try {
            // Получаем информацию о системе
            const uptime = this.formatUptime(process.uptime());
            const memoryUsage = process.memoryUsage();
            const freeMemory = os.freemem();
            const totalMemory = os.totalmem();
            const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory * 100).toFixed(2);
            
            // Получаем информацию о базе данных
            const dbStatus = mongoose.connection.readyState === 1 ? 'Подключено' : 'Отключено';
            
            // Создаем эмбед для статуса бота
            const statusEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Статус Synergy Bot')
                .addFields(
                    { name: '🤖 Версия бота', value: version, inline: true },
                    { name: '⏱️ Время работы', value: uptime, inline: true },
                    { name: '📊 Использование памяти', value: `${this.formatBytes(memoryUsage.rss)} (${memoryUsagePercent}%)`, inline: true },
                    { name: '📡 Статус базы данных', value: dbStatus, inline: true },
                    { name: '🖥️ Платформа', value: `${os.type()} ${os.release()}`, inline: true },
                    { name: '📝 Node.js', value: process.version, inline: true }
                )
                .setFooter({ text: 'Synergy Guild Bot' })
                .setTimestamp();
            
            // Отправляем эмбед
            await interaction.reply({
                embeds: [statusEmbed],
                ephemeral: true
            });
            
        } catch (error) {
            logger.error(`Ошибка при выполнении команды status: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при получении статуса бота. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },
    
    // Форматирование времени работы
    formatUptime(seconds) {
        const days = Math.floor(seconds / (3600 * 24));
        const hours = Math.floor((seconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        let result = '';
        
        if (days > 0) result += `${days} д `;
        if (hours > 0) result += `${hours} ч `;
        if (minutes > 0) result += `${minutes} м `;
        if (secs > 0 || result === '') result += `${secs} с`;
        
        return result.trim();
    },
    
    // Форматирование размера в байтах
    formatBytes(bytes) {
        if (bytes === 0) return '0 Байт';
        
        const k = 1024;
        const sizes = ['Байт', 'КБ', 'МБ', 'ГБ', 'ТБ'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
};
