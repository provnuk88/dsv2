const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Показывает список доступных команд и их описание'),
    
    async execute(interaction) {
        try {
            // Получаем все команды из коллекции клиента
            const commands = interaction.client.commands;
            
            // Создаем эмбед для списка команд
            const helpEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Справка по командам Synergy Bot')
                .setDescription('Ниже приведен список доступных команд и их описание.')
                .setFooter({ text: 'Synergy Guild Bot' })
                .setTimestamp();
            
            // Группируем команды по категориям
            const userCommands = [];
            const adminCommands = [];
            
            // Перебираем все команды и добавляем их в соответствующие группы
            commands.forEach(command => {
                const commandPath = command.data.name;
                
                // Определяем категорию команды по пути файла или другим признакам
                if (commandPath.includes('admin')) {
                    adminCommands.push(command);
                } else {
                    userCommands.push(command);
                }
            });
            
            // Добавляем команды пользователя в эмбед
            if (userCommands.length > 0) {
                let userCommandsText = '';
                
                userCommands.forEach(command => {
                    userCommandsText += `**/${command.data.name}** - ${command.data.description}\n`;
                    
                    // Если у команды есть подкоманды, добавляем их
                    if (command.data.options && command.data.options.length > 0) {
                        command.data.options.forEach(option => {
                            if (option.type === 1) { // Тип 1 - подкоманда
                                userCommandsText += `  • **/${command.data.name} ${option.name}** - ${option.description}\n`;
                            }
                        });
                    }
                });
                
                helpEmbed.addFields({ name: '📝 Команды пользователя', value: userCommandsText });
            }
            
            // Добавляем команды администратора в эмбед, если у пользователя есть права администратора
            if (adminCommands.length > 0 && interaction.member.permissions.has('ADMINISTRATOR')) {
                let adminCommandsText = '';
                
                adminCommands.forEach(command => {
                    adminCommandsText += `**/${command.data.name}** - ${command.data.description}\n`;
                    
                    // Если у команды есть подкоманды, добавляем их
                    if (command.data.options && command.data.options.length > 0) {
                        command.data.options.forEach(option => {
                            if (option.type === 1) { // Тип 1 - подкоманда
                                adminCommandsText += `  • **/${command.data.name} ${option.name}** - ${option.description}\n`;
                            }
                        });
                    }
                });
                
                helpEmbed.addFields({ name: '🔧 Команды администратора', value: adminCommandsText });
            }
            
            // Добавляем информацию о дополнительных функциях
            helpEmbed.addFields({
                name: '🔍 Дополнительная информация',
                value: 'Для получения подробной информации о конкретной команде, используйте ее с флагом `--help` или обратитесь к администратору гильдии.'
            });
            
            // Отправляем эмбед
            await interaction.reply({
                embeds: [helpEmbed],
                ephemeral: true
            });
            
        } catch (error) {
            logger.error(`Ошибка при выполнении команды help: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при получении справки. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    }
};
