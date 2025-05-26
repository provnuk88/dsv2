/**
 * Модуль для управления повторяющимися мероприятиями
 */

const Event = require('../database/models/Event');
const botEvents = require('../events/botEvents');
const logger = require('./logger');
const { EmbedBuilder } = require('discord.js');
const client = require('../index').client;

class RecurringEventManager {
    /**
     * Создает новое повторяющееся мероприятие на основе шаблона
     * @param {Object} templateEvent - Шаблон мероприятия
     * @returns {Promise<Object>} Созданное мероприятие
     */
    static async createRecurringEvent(templateEvent) {
        try {
            // Проверяем, что шаблон имеет настройки повторения
            if (!templateEvent.recurring || !templateEvent.recurring.isRecurring) {
                throw new Error('Event is not configured for recurring');
            }
            
            // Вычисляем дату следующего мероприятия
            const nextDates = this.calculateNextEventDates(
                templateEvent.startDate,
                templateEvent.endDate,
                templateEvent.recurring
            );
            
            if (!nextDates) {
                logger.warn(`No more occurrences for recurring event: ${templateEvent.title}`);
                return null;
            }
            
            // Создаем новое мероприятие на основе шаблона
            const newEventData = {
                title: templateEvent.title,
                description: templateEvent.description,
                startDate: nextDates.startDate,
                endDate: nextDates.endDate,
                location: templateEvent.location,
                maxParticipants: templateEvent.maxParticipants,
                createdBy: templateEvent.createdBy,
                active: true,
                accessKeys: templateEvent.accessKeys.map(key => ({
                    key: key.key,
                    issuedTo: null,
                    issuedAt: null
                })),
                requiredProfileFields: templateEvent.requiredProfileFields,
                recurring: templateEvent.recurring,
                rewards: templateEvent.rewards
            };
            
            // Сохраняем новое мероприятие в базе данных
            const newEvent = new Event(newEventData);
            await newEvent.save();
            
            logger.info(`Created recurring event: ${newEvent.title} (${newEvent._id}) for ${nextDates.startDate}`);
            
            // Генерируем событие создания мероприятия
            botEvents.emit('event.created', newEvent._id.toString(), newEvent);
            
            return newEvent;
        } catch (error) {
            logger.error(`Error creating recurring event: ${error.message}`);
            return null;
        }
    }
    
    /**
     * Вычисляет даты следующего повторяющегося мероприятия
     * @param {Date} lastStartDate - Дата начала последнего мероприятия
     * @param {Date} lastEndDate - Дата окончания последнего мероприятия
     * @param {Object} recurringSettings - Настройки повторения
     * @returns {Object|null} Даты следующего мероприятия или null, если больше нет повторений
     */
    static calculateNextEventDates(lastStartDate, lastEndDate, recurringSettings) {
        const { frequency, interval, endAfterOccurrences, endDate } = recurringSettings;
        
        // Преобразуем строковые даты в объекты Date, если необходимо
        const startDate = new Date(lastStartDate);
        const endDate = new Date(lastEndDate);
        
        // Вычисляем продолжительность мероприятия в миллисекундах
        const duration = endDate.getTime() - startDate.getTime();
        
        // Вычисляем дату начала следующего мероприятия
        let nextStartDate = new Date(startDate);
        
        switch (frequency) {
            case 'daily':
                nextStartDate.setDate(nextStartDate.getDate() + interval);
                break;
            case 'weekly':
                nextStartDate.setDate(nextStartDate.getDate() + (interval * 7));
                break;
            case 'monthly':
                nextStartDate.setMonth(nextStartDate.getMonth() + interval);
                break;
            default:
                throw new Error(`Unknown frequency: ${frequency}`);
        }
        
        // Вычисляем дату окончания следующего мероприятия
        const nextEndDate = new Date(nextStartDate.getTime() + duration);
        
        // Проверяем, не превышено ли максимальное количество повторений
        if (endAfterOccurrences > 0) {
            // Здесь нужна логика для отслеживания количества созданных повторений
            // Это можно реализовать, добавив счетчик в настройки повторения
        }
        
        // Проверяем, не превышена ли конечная дата повторений
        if (recurringSettings.endDate && nextStartDate > new Date(recurringSettings.endDate)) {
            return null;
        }
        
        return {
            startDate: nextStartDate,
            endDate: nextEndDate
        };
    }
    
    /**
     * Проверяет и создает повторяющиеся мероприятия
     * @returns {Promise<number>} Количество созданных мероприятий
     */
    static async checkAndCreateRecurringEvents() {
        try {
            // Находим все активные повторяющиеся мероприятия
            const recurringEvents = await Event.find({
                'recurring.isRecurring': true,
                active: true
            });
            
            logger.info(`Found ${recurringEvents.length} active recurring events`);
            
            let createdCount = 0;
            
            // Для каждого повторяющегося мероприятия
            for (const event of recurringEvents) {
                // Проверяем, нужно ли создавать следующее повторение
                const now = new Date();
                const eventEndDate = new Date(event.endDate);
                
                // Если мероприятие уже завершилось, создаем следующее
                if (eventEndDate < now) {
                    const newEvent = await this.createRecurringEvent(event);
                    
                    if (newEvent) {
                        createdCount++;
                        
                        // Отправляем уведомление о создании нового повторяющегося мероприятия
                        await this.notifyAboutNewRecurringEvent(event, newEvent);
                        
                        // Деактивируем предыдущее мероприятие
                        event.active = false;
                        await event.save();
                    }
                }
            }
            
            logger.info(`Created ${createdCount} new recurring events`);
            return createdCount;
        } catch (error) {
            logger.error(`Error checking recurring events: ${error.message}`);
            return 0;
        }
    }
    
    /**
     * Отправляет уведомление о создании нового повторяющегося мероприятия
     * @param {Object} oldEvent - Предыдущее мероприятие
     * @param {Object} newEvent - Новое мероприятие
     */
    static async notifyAboutNewRecurringEvent(oldEvent, newEvent) {
        try {
            // Находим канал для отправки уведомлений
            // Это можно настроить в конфигурации бота
            const notificationChannelId = process.env.NOTIFICATION_CHANNEL_ID;
            
            if (!notificationChannelId) {
                logger.warn('Notification channel ID not configured');
                return;
            }
            
            const channel = await client.channels.fetch(notificationChannelId);
            
            if (!channel) {
                logger.warn(`Notification channel ${notificationChannelId} not found`);
                return;
            }
            
            // Создаем эмбед с информацией о новом мероприятии
            const startTime = Math.floor(new Date(newEvent.startDate).getTime() / 1000);
            const endTime = Math.floor(new Date(newEvent.endDate).getTime() / 1000);
            
            const embed = new EmbedBuilder()
                .setColor('#4CAF50')
                .setTitle('🔄 Новое повторяющееся мероприятие')
                .setDescription(`Создано новое мероприятие: **${newEvent.title}**`)
                .addFields(
                    { name: '📅 Начало', value: `<t:${startTime}:F>`, inline: true },
                    { name: '⏰ Окончание', value: `<t:${endTime}:F>`, inline: true },
                    { name: '📍 Место', value: newEvent.location || 'Онлайн', inline: true },
                    { name: '👥 Максимум участников', value: newEvent.maxParticipants.toString(), inline: true }
                )
                .setFooter({ text: 'Synergy Guild Bot' });
            
            // Отправляем уведомление
            await channel.send({ embeds: [embed] });
            
        } catch (error) {
            logger.error(`Error notifying about new recurring event: ${error.message}`);
        }
    }
    
    /**
     * Настраивает расписание для проверки повторяющихся мероприятий
     * @param {number} intervalMinutes - Интервал проверки в минутах
     */
    static scheduleRecurringEventCheck(intervalMinutes = 60) {
        // Проверяем повторяющиеся мероприятия при запуске
        this.checkAndCreateRecurringEvents();
        
        // Настраиваем периодическую проверку
        setInterval(() => {
            this.checkAndCreateRecurringEvents();
        }, intervalMinutes * 60 * 1000);
        
        logger.info(`Scheduled recurring event check every ${intervalMinutes} minutes`);
    }
}

module.exports = RecurringEventManager;
