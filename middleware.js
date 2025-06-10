/**
 * Middleware система для обработки общих проверок и операций
 */

const User = require('../database/models/User');
const rateLimiter = require('../utils/rateLimiter');
const commandPermissions = require('../utils/commandPermissions');
const logger = require('../utils/logger');

class Middleware {
    /**
     * Проверка на превышение лимита запросов
     * @param {Object} interaction - Discord interaction объект
     * @param {number} maxRequests - Максимальное количество запросов (по умолчанию 5)
     * @param {number} timeWindow - Временное окно в миллисекундах (по умолчанию 60000 мс = 1 минута)
     * @throws {Error} RATE_LIMITED если превышен лимит запросов
     */
    static async rateLimit(interaction, maxRequests = 5, timeWindow = 60000) {
        const rateLimited = rateLimiter.isRateLimited(
            interaction.user.id, 
            interaction.commandName || 'general',
            maxRequests,
            timeWindow
        );
        
        if (rateLimited) {
            logger.warn(`Rate limit exceeded for user ${interaction.user.tag} (${interaction.user.id}) on command ${interaction.commandName || 'general'}`);
            throw new Error('RATE_LIMITED');
        }
    }
    
    /**
     * Проверка наличия профиля пользователя
     * @param {Object} interaction - Discord interaction объект
     * @returns {Object} Объект профиля пользователя
     * @throws {Error} PROFILE_REQUIRED если профиль не найден
     */
    static async requireProfile(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            logger.info(`Profile required but not found for user ${interaction.user.tag} (${interaction.user.id})`);
            throw new Error('PROFILE_REQUIRED');
        }
        return user;
    }
    
    /**
     * Проверка наличия прав администратора
     * @param {Object} interaction - Discord interaction объект
     * @throws {Error} ADMIN_REQUIRED если у пользователя нет прав администратора
     */
    static async requireAdmin(interaction) {
        if (!commandPermissions.hasAdminPermission(interaction.member)) {
            logger.warn(`Admin permission required but not found for user ${interaction.user.tag} (${interaction.user.id})`);
            throw new Error('ADMIN_REQUIRED');
        }
    }

    /**
     * Проверка наличия активного мероприятия
     * @param {Object} eventId - ID мероприятия
     * @param {Object} Event - Модель мероприятия
     * @returns {Object} Объект мероприятия
     * @throws {Error} EVENT_NOT_FOUND если мероприятие не найдено
     * @throws {Error} EVENT_INACTIVE если мероприятие неактивно
     */
    static async requireActiveEvent(eventId, Event) {
        const event = await Event.findById(eventId);
        if (!event) {
            logger.warn(`Event not found: ${eventId}`);
            throw new Error('EVENT_NOT_FOUND');
        }
        
        if (!event.active) {
            logger.warn(`Inactive event accessed: ${eventId}`);
            throw new Error('EVENT_INACTIVE');
        }
        
        return event;
    }

    /**
     * Обработчик ошибок для middleware
     * @param {Error} error - Объект ошибки
     * @param {Object} interaction - Discord interaction объект
     * @returns {boolean} true если ошибка была обработана, false в противном случае
     */
    static async handleError(error, interaction) {
        if (!interaction.deferred && !interaction.replied) {
            try {
                switch (error.message) {
                    case 'RATE_LIMITED':
                        await interaction.reply({ 
                            content: '⚠️ Слишком много запросов. Пожалуйста, подождите немного перед повторной попыткой.', 
                            ephemeral: true 
                        });
                        return true;
                    case 'PROFILE_REQUIRED':
                        await interaction.reply({ 
                            content: '⚠️ Для этого действия требуется профиль. Используйте команду `/profile` для создания профиля.', 
                            ephemeral: true 
                        });
                        return true;
                    case 'ADMIN_REQUIRED':
                        await interaction.reply({ 
                            content: '⚠️ Для этого действия требуются права администратора.', 
                            ephemeral: true 
                        });
                        return true;
                    case 'EVENT_NOT_FOUND':
                        await interaction.reply({ 
                            content: '⚠️ Мероприятие не найдено.', 
                            ephemeral: true 
                        });
                        return true;
                    case 'EVENT_INACTIVE':
                        await interaction.reply({ 
                            content: '⚠️ Это мероприятие больше не активно.', 
                            ephemeral: true 
                        });
                        return true;
                    default:
                        return false;
                }
            } catch (replyError) {
                logger.error(`Error while handling middleware error: ${replyError.message}`);
                return false;
            }
        }
        return false;
    }
}

module.exports = Middleware;
