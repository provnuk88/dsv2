const { Events, InteractionType } = require('discord.js');
const logger = require('../utils/logger');
const rateLimiter = require('../utils/rateLimiter');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {
            // Обработка команд
            if (interaction.isChatInputCommand()) {
                await handleChatInputCommand(interaction);
            }
            // Обработка кнопок
            else if (interaction.isButton()) {
                await handleButtonInteraction(interaction);
            }
            // Обработка модальных окон
            else if (interaction.type === InteractionType.ModalSubmit) {
                await handleModalSubmit(interaction);
            }
            // Обработка выбора из меню
            else if (interaction.isStringSelectMenu()) {
                await handleSelectMenu(interaction);
            }
        } catch (error) {
            logger.error(`Ошибка при обработке взаимодействия: ${error.message}`);
        }
    }
};

/**
 * Обрабатывает команды чата
 * @param {Interaction} interaction - Объект взаимодействия Discord
 */
async function handleChatInputCommand(interaction) {
    // Проверяем ограничение частоты запросов
    const rateLimited = await rateLimiter.isRateLimited(interaction.user.id);
    
    if (rateLimited) {
        return interaction.reply({
            content: '⚠️ Вы отправляете слишком много команд. Пожалуйста, подождите немного перед отправкой следующей команды.',
            ephemeral: true
        });
    }
    
    // Получаем команду из коллекции
    const command = interaction.client.commands.get(interaction.commandName);
    
    // Если команда не найдена
    if (!command) {
        logger.error(`Команда ${interaction.commandName} не найдена.`);
        return interaction.reply({
            content: '❌ Произошла ошибка при выполнении команды. Пожалуйста, попробуйте позже.',
            ephemeral: true
        });
    }
    
    // Выполняем команду
    try {
        await command.execute(interaction);
        
        // Логируем использование команды
        logger.info(`Пользователь ${interaction.user.tag} (${interaction.user.id}) использовал команду ${interaction.commandName}`);
    } catch (error) {
        logger.error(`Ошибка при выполнении команды ${interaction.commandName}: ${error.message}`);
        
        // Обрабатываем ошибку в зависимости от состояния взаимодействия
        await handleInteractionError(interaction);
    }
}

/**
 * Обрабатывает взаимодействия с кнопками
 * @param {Interaction} interaction - Объект взаимодействия Discord
 */
async function handleButtonInteraction(interaction) {
    // Получаем customId кнопки
    const customId = interaction.customId;
    
    // Определяем, какой команде принадлежит кнопка
    const commandName = getCommandNameFromCustomId(customId);
    
    // Если команда определена
    if (commandName) {
        const command = interaction.client.commands.get(commandName);
        
        // Если команда найдена и имеет метод handleButton
        if (command && typeof command.handleButton === 'function') {
            try {
                await command.handleButton(interaction);
                
                // Логируем использование кнопки
                logger.info(`Пользователь ${interaction.user.tag} (${interaction.user.id}) нажал кнопку ${customId}`);
            } catch (error) {
                logger.error(`Ошибка при обработке кнопки ${customId}: ${error.message}`);
                
                // Обрабатываем ошибку в зависимости от состояния взаимодействия
                await handleInteractionError(interaction);
            }
        }
    }
}

/**
 * Обрабатывает отправку модальных окон
 * @param {Interaction} interaction - Объект взаимодействия Discord
 */
async function handleModalSubmit(interaction) {
    // Получаем customId модального окна
    const modalId = interaction.customId;
    
    // Определяем, какой команде принадлежит модальное окно
    const commandName = getCommandNameFromModalId(modalId);
    
    // Если команда определена
    if (commandName) {
        const command = interaction.client.commands.get(commandName);
        
        // Если команда найдена
        if (command) {
            try {
                // Определяем, какой метод вызвать в зависимости от modalId
                await callModalHandler(command, modalId, interaction);
                
                // Логируем отправку модального окна
                logger.info(`Пользователь ${interaction.user.tag} (${interaction.user.id}) отправил модальное окно ${modalId}`);
            } catch (error) {
                logger.error(`Ошибка при обработке модального окна ${modalId}: ${error.message}`);
                
                // Обрабатываем ошибку в зависимости от состояния взаимодействия
                await handleInteractionError(interaction);
            }
        }
    }
}

/**
 * Обрабатывает выбор из меню
 * @param {Interaction} interaction - Объект взаимодействия Discord
 */
async function handleSelectMenu(interaction) {
    // Получаем customId меню
    const menuId = interaction.customId;
    
    // Определяем, какой команде принадлежит меню
    const commandName = getCommandNameFromMenuId(menuId);
    
    // Если команда определена
    if (commandName) {
        const command = interaction.client.commands.get(commandName);
        
        // Если команда найдена и имеет метод handleSelectMenu
        if (command && typeof command.handleSelectMenu === 'function') {
            try {
                await command.handleSelectMenu(interaction);
                
                // Логируем использование меню
                logger.info(`Пользователь ${interaction.user.tag} (${interaction.user.id}) выбрал опцию в меню ${menuId}`);
            } catch (error) {
                logger.error(`Ошибка при обработке меню ${menuId}: ${error.message}`);
                
                // Обрабатываем ошибку в зависимости от состояния взаимодействия
                await handleInteractionError(interaction);
            }
        }
    }
}

/**
 * Определяет имя команды на основе customId кнопки
 * @param {string} customId - Идентификатор кнопки
 * @returns {string} Имя команды или пустая строка
 */
function getCommandNameFromCustomId(customId) {
    if (customId.startsWith('edit_profile') || customId === 'create_profile') {
        return 'profile';
    } else if (customId.startsWith('event_')) {
        return 'register';
    } else if (customId.startsWith('manage_event_')) {
        return 'manageEvents';
    } else if (customId.startsWith('manage_user_')) {
        return 'manageUsers';
    } else if (customId.startsWith('export_')) {
        return 'exportData';
    } else if (customId.startsWith('announce_')) {
        return 'announce';
    }
    
    return '';
}

/**
 * Определяет имя команды на основе modalId
 * @param {string} modalId - Идентификатор модального окна
 * @returns {string} Имя команды или пустая строка
 */
function getCommandNameFromModalId(modalId) {
    if (modalId.startsWith('modal_profile_')) {
        return 'profile';
    } else if (modalId.startsWith('modal_event_')) {
        return 'createEvent';
    } else if (modalId.startsWith('modal_announce_')) {
        return 'announce';
    }
    
    return '';
}

/**
 * Определяет имя команды на основе menuId
 * @param {string} menuId - Идентификатор меню
 * @returns {string} Имя команды или пустая строка
 */
function getCommandNameFromMenuId(menuId) {
    if (menuId.startsWith('select_event_')) {
        return 'manageEvents';
    } else if (menuId.startsWith('select_user_')) {
        return 'manageUsers';
    } else if (menuId.startsWith('select_export_')) {
        return 'exportData';
    }
    
    return '';
}

/**
 * Вызывает соответствующий обработчик модального окна
 * @param {Object} command - Объект команды
 * @param {string} modalId - Идентификатор модального окна
 * @param {Interaction} interaction - Объект взаимодействия Discord
 */
async function callModalHandler(command, modalId, interaction) {
    if (modalId === 'modal_profile_basic' && typeof command.handleBasicInfoModalSubmit === 'function') {
        await command.handleBasicInfoModalSubmit(interaction);
    } else if (modalId === 'modal_profile_wallets' && typeof command.handleWalletsModalSubmit === 'function') {
        await command.handleWalletsModalSubmit(interaction);
    } else if (modalId === 'modal_profile_additional' && typeof command.handleAdditionalInfoModalSubmit === 'function') {
        await command.handleAdditionalInfoModalSubmit(interaction);
    } else if (modalId.startsWith('modal_event_') && typeof command.handleEventModalSubmit === 'function') {
        await command.handleEventModalSubmit(interaction);
    } else if (modalId.startsWith('modal_announce_') && typeof command.handleAnnounceModalSubmit === 'function') {
        await command.handleAnnounceModalSubmit(interaction);
    } else if (modalId === 'modal_profile_basic' && typeof command.handleModalProfileBasic === 'function') {
        // Поддержка альтернативного именования методов для обратной совместимости
        await command.handleModalProfileBasic(interaction);
    } else if (modalId === 'modal_profile_wallets' && typeof command.handleModalProfileWallets === 'function') {
        await command.handleModalProfileWallets(interaction);
    } else if (modalId === 'modal_profile_additional' && typeof command.handleModalProfileAdditional === 'function') {
        await command.handleModalProfileAdditional(interaction);
    }
}

/**
 * Обрабатывает ошибки взаимодействия в зависимости от состояния
 * @param {Interaction} interaction - Объект взаимодействия Discord
 */
async function handleInteractionError(interaction) {
    try {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        } else if (interaction.deferred) {
            await interaction.editReply({
                content: '❌ Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.'
            });
        }
    } catch (error) {
        logger.error(`Ошибка при обработке ошибки взаимодействия: ${error.message}`);
    }
}
