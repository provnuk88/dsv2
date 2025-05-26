/**
 * Dashboard команда - персональная панель пользователя
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../database/models/User');
const Event = require('../../database/models/Event');
const Registration = require('../../database/models/Registration');
const AchievementManager = require('../../utils/achievementManager');
const Middleware = require('../../middleware');
const logger = require('../../utils/logger');
const dbCache = require('../../database/cache');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('Показывает вашу персональную панель управления'),
    
    async execute(interaction) {
        try {
            // Проверка на превышение лимита запросов
            await Middleware.rateLimit(interaction);
            
            // Проверка наличия профиля
            const user = await Middleware.requireProfile(interaction);
            
            // Отложенный ответ для длительных операций
            await interaction.deferReply({ ephemeral: true });
            
            // Получаем данные для дашборда
            const dashboardData = await this.getDashboardData(user.discordId);
            
            // Создаем эмбед с основной информацией
            const embed = this.createDashboardEmbed(dashboardData, user);
            
            // Создаем кнопки действий
            const actionRow = this.createActionButtons(dashboardData);
            
            // Отправляем ответ
            await interaction.editReply({
                embeds: [embed],
                components: [actionRow],
                ephemeral: true
            });
            
        } catch (error) {
            // Обработка ошибок middleware
            const handled = await Middleware.handleError(error, interaction);
            
            if (!handled) {
                logger.error(`Error in dashboard command: ${error.message}`);
                
                // Отправляем сообщение об ошибке, если еще не ответили
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: 'Произошла ошибка при загрузке дашборда. Пожалуйста, попробуйте позже.', 
                        ephemeral: true 
                    });
                } else if (interaction.deferred) {
                    await interaction.editReply({ 
                        content: 'Произошла ошибка при загрузке дашборда. Пожалуйста, попробуйте позже.' 
                    });
                }
            }
        }
    },
    
    /**
     * Получает данные для дашборда пользователя
     * @param {string} userId - Discord ID пользователя
     * @returns {Promise<Object>} Данные для дашборда
     */
    async getDashboardData(userId) {
        // Используем кэширование для оптимизации запросов
        return dbCache.withCache('Dashboard', 'getData', { userId }, async () => {
            // Получаем активные регистрации пользователя
            const activeRegistrations = await Registration.find({ 
                userId: userId,
                status: 'confirmed'
            }).populate('eventId');
            
            // Получаем позиции в листах ожидания
            const waitlistPositions = await Registration.find({
                userId: userId,
                status: 'waitlist'
            }).populate('eventId');
            
            // Получаем историю мероприятий (завершенные)
            const eventHistory = await Registration.find({
                userId: userId,
                status: 'completed'
            }).populate('eventId').sort({ 'eventId.endDate': -1 }).limit(5);
            
            // Получаем достижения пользователя
            const achievements = await AchievementManager.getUserAchievements(userId);
            
            // Получаем прогресс достижений
            const achievementProgress = await AchievementManager.getUserAchievementProgress(userId);
            
            return {
                activeRegistrations,
                waitlistPositions,
                eventHistory,
                achievements,
                achievementProgress
            };
        }, 300); // Кэшируем на 5 минут
    },
    
    /**
     * Создает эмбед с информацией дашборда
     * @param {Object} dashboardData - Данные дашборда
     * @param {Object} user - Объект пользователя
     * @returns {EmbedBuilder} Эмбед с информацией
     */
    createDashboardEmbed(dashboardData, user) {
        const embed = new EmbedBuilder()
            .setColor('#4CAF50')
            .setTitle('🎮 Личный кабинет')
            .setDescription(`Добро пожаловать, ${user.username}!`)
            .setThumbnail(interaction.user.displayAvatarURL())
            .addFields(
                { name: '📊 Статистика', value: this.formatStats(user.stats) }
            );
        
        // Добавляем информацию о предстоящих мероприятиях
        if (dashboardData.activeRegistrations.length > 0) {
            embed.addFields({
                name: '📅 Предстоящие мероприятия',
                value: this.formatEventList(dashboardData.activeRegistrations)
            });
        } else {
            embed.addFields({
                name: '📅 Предстоящие мероприятия',
                value: 'У вас нет активных регистраций на мероприятия'
            });
        }
        
        // Добавляем информацию о листах ожидания
        if (dashboardData.waitlistPositions.length > 0) {
            embed.addFields({
                name: '⏳ Листы ожидания',
                value: this.formatWaitlistPositions(dashboardData.waitlistPositions)
            });
        }
        
        // Добавляем информацию о достижениях
        if (dashboardData.achievements.length > 0) {
            embed.addFields({
                name: '🏆 Достижения',
                value: this.formatAchievements(dashboardData.achievements)
            });
        } else {
            embed.addFields({
                name: '🏆 Достижения',
                value: 'У вас пока нет достижений. Участвуйте в мероприятиях, чтобы получить их!'
            });
        }
        
        // Добавляем информацию о прогрессе достижений
        const nextAchievement = this.getNextAchievement(dashboardData.achievementProgress);
        if (nextAchievement) {
            embed.addFields({
                name: '🔄 Прогресс',
                value: `${nextAchievement.icon} **${nextAchievement.name}**: ${nextAchievement.progress}% (${nextAchievement.currentValue}/${nextAchievement.requirement})`
            });
        }
        
        return embed;
    },
    
    /**
     * Форматирует статистику пользователя
     * @param {Object} stats - Статистика пользователя
     * @returns {string} Отформатированная статистика
     */
    formatStats(stats) {
        return [
            `📊 Мероприятий посещено: **${stats.eventsCompleted}**`,
            `🎟️ Регистраций: **${stats.eventsJoined}**`,
            `📝 Организовано: **${stats.eventsCreated}**`,
            `⏳ Листов ожидания: **${stats.waitlistJoins}**`,
            `📆 С нами с: <t:${Math.floor(new Date(stats.joinedAt).getTime() / 1000)}:D>`
        ].join('\n');
    },
    
    /**
     * Форматирует список мероприятий
     * @param {Array} registrations - Список регистраций
     * @returns {string} Отформатированный список
     */
    formatEventList(registrations) {
        if (registrations.length === 0) {
            return 'Нет предстоящих мероприятий';
        }
        
        return registrations.map(reg => {
            const event = reg.eventId;
            const startTime = Math.floor(new Date(event.startDate).getTime() / 1000);
            return `📌 **${event.title}**\n📅 <t:${startTime}:F>\n`;
        }).join('\n');
    },
    
    /**
     * Форматирует позиции в листах ожидания
     * @param {Array} waitlistPositions - Список позиций
     * @returns {string} Отформатированный список
     */
    formatWaitlistPositions(waitlistPositions) {
        if (waitlistPositions.length === 0) {
            return 'Вы не состоите в листах ожидания';
        }
        
        return waitlistPositions.map(reg => {
            const event = reg.eventId;
            const position = reg.waitlistPosition;
            return `⏳ **${event.title}** - Позиция: ${position}`;
        }).join('\n');
    },
    
    /**
     * Форматирует список достижений
     * @param {Array} achievements - Список достижений
     * @returns {string} Отформатированный список
     */
    formatAchievements(achievements) {
        if (achievements.length === 0) {
            return 'У вас пока нет достижений';
        }
        
        return achievements.slice(0, 3).map(ach => {
            return `${ach.icon} **${ach.name}** - ${ach.description}`;
        }).join('\n') + (achievements.length > 3 ? `\n...и еще ${achievements.length - 3}` : '');
    },
    
    /**
     * Возвращает следующее достижение для получения
     * @param {Array} achievementProgress - Прогресс достижений
     * @returns {Object|null} Следующее достижение или null
     */
    getNextAchievement(achievementProgress) {
        // Фильтруем достижения, которые еще не получены
        const notAchieved = achievementProgress.filter(a => !a.achieved);
        
        if (notAchieved.length === 0) {
            return null;
        }
        
        // Сортируем по прогрессу (от большего к меньшему)
        notAchieved.sort((a, b) => b.progress - a.progress);
        
        // Возвращаем достижение с наибольшим прогрессом
        return notAchieved[0];
    },
    
    /**
     * Создает кнопки действий для дашборда
     * @param {Object} dashboardData - Данные дашборда
     * @returns {ActionRowBuilder} Строка с кнопками
     */
    createActionButtons(dashboardData) {
        const actionRow = new ActionRowBuilder();
        
        // Кнопка просмотра всех мероприятий
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId('dashboard_view_events')
                .setLabel('Мероприятия')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📅')
        );
        
        // Кнопка просмотра всех достижений
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId('dashboard_view_achievements')
                .setLabel('Достижения')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🏆')
        );
        
        // Кнопка редактирования профиля
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId('dashboard_edit_profile')
                .setLabel('Редактировать профиль')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('✏️')
        );
        
        // Кнопка настроек уведомлений
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId('dashboard_notification_settings')
                .setLabel('Настройки')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⚙️')
        );
        
        return actionRow;
    },
    
    /**
     * Обработчик кнопки просмотра всех мероприятий
     * @param {Object} interaction - Объект взаимодействия
     */
    async handleViewEvents(interaction) {
        try {
            // Проверка на превышение лимита запросов
            await Middleware.rateLimit(interaction);
            
            // Проверка наличия профиля
            const user = await Middleware.requireProfile(interaction);
            
            // Отложенный ответ для длительных операций
            await interaction.deferUpdate();
            
            // Получаем все регистрации пользователя
            const registrations = await Registration.find({ 
                userId: user.discordId 
            }).populate('eventId').sort({ 'eventId.startDate': -1 });
            
            // Группируем регистрации по статусу
            const activeRegs = registrations.filter(reg => 
                reg.status === 'confirmed' && new Date(reg.eventId.endDate) > new Date()
            );
            
            const waitlistRegs = registrations.filter(reg => 
                reg.status === 'waitlist'
            );
            
            const completedRegs = registrations.filter(reg => 
                reg.status === 'completed' || 
                (reg.status === 'confirmed' && new Date(reg.eventId.endDate) <= new Date())
            );
            
            // Создаем эмбед с информацией о мероприятиях
            const embed = new EmbedBuilder()
                .setColor('#4CAF50')
                .setTitle('📅 Ваши мероприятия')
                .setDescription(`Информация о всех ваших мероприятиях, ${user.username}`)
                .setThumbnail(interaction.user.displayAvatarURL());
            
            // Добавляем информацию о предстоящих мероприятиях
            if (activeRegs.length > 0) {
                embed.addFields({
                    name: '📌 Предстоящие мероприятия',
                    value: this.formatDetailedEventList(activeRegs)
                });
            } else {
                embed.addFields({
                    name: '📌 Предстоящие мероприятия',
                    value: 'У вас нет активных регистраций на мероприятия'
                });
            }
            
            // Добавляем информацию о листах ожидания
            if (waitlistRegs.length > 0) {
                embed.addFields({
                    name: '⏳ Листы ожидания',
                    value: this.formatDetailedWaitlistPositions(waitlistRegs)
                });
            }
            
            // Добавляем информацию о завершенных мероприятиях
            if (completedRegs.length > 0) {
                embed.addFields({
                    name: '✅ Завершенные мероприятия',
                    value: this.formatCompletedEventList(completedRegs)
                });
            }
            
            // Создаем кнопку возврата к дашборду
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('dashboard_back')
                        .setLabel('Назад к дашборду')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('◀️')
                );
            
            // Отправляем ответ
            await interaction.editReply({
                embeds: [embed],
                components: [actionRow]
            });
            
        } catch (error) {
            // Обработка ошибок middleware
            const handled = await Middleware.handleError(error, interaction);
            
            if (!handled) {
                logger.error(`Error in dashboard view events: ${error.message}`);
                
                await interaction.editReply({ 
                    content: 'Произошла ошибка при загрузке мероприятий. Пожалуйста, попробуйте позже.',
                    components: []
                });
            }
        }
    },
    
    /**
     * Форматирует детальный список мероприятий
     * @param {Array} registrations - Список регистраций
     * @returns {string} Отформатированный список
     */
    formatDetailedEventList(registrations) {
        return registrations.map(reg => {
            const event = reg.eventId;
            const startTime = Math.floor(new Date(event.startDate).getTime() / 1000);
            const endTime = Math.floor(new Date(event.endDate).getTime() / 1000);
            
            return [
                `**${event.title}**`,
                `📅 Начало: <t:${startTime}:F>`,
                `⏰ Окончание: <t:${endTime}:F>`,
                `📍 Место: ${event.location || 'Онлайн'}`,
                `🔑 Ключ доступа: ${reg.accessKey ? '✅ Получен' : '❌ Не получен'}`
            ].join('\n');
        }).join('\n\n');
    },
    
    /**
     * Форматирует детальный список позиций в листах ожидания
     * @param {Array} waitlistPositions - Список позиций
     * @returns {string} Отформатированный список
     */
    formatDetailedWaitlistPositions(waitlistPositions) {
        return waitlistPositions.map(reg => {
            const event = reg.eventId;
            const startTime = Math.floor(new Date(event.startDate).getTime() / 1000);
            const position = reg.waitlistPosition;
            
            return [
                `**${event.title}**`,
                `📅 Начало: <t:${startTime}:F>`,
                `🔢 Позиция в очереди: ${position}`,
                `👥 Максимум участников: ${event.maxParticipants}`
            ].join('\n');
        }).join('\n\n');
    },
    
    /**
     * Форматирует список завершенных мероприятий
     * @param {Array} registrations - Список регистраций
     * @returns {string} Отформатированный список
     */
    formatCompletedEventList(registrations) {
        const recentEvents = registrations.slice(0, 5);
        
        const formattedList = recentEvents.map(reg => {
            const event = reg.eventId;
            const date = Math.floor(new Date(event.endDate).getTime() / 1000);
            
            return `✅ **${event.title}** - <t:${date}:D>`;
        }).join('\n');
        
        if (registrations.length > 5) {
            return formattedList + `\n...и еще ${registrations.length - 5} мероприятий`;
        }
        
        return formattedList;
    },
    
    /**
     * Обработчик кнопки просмотра всех достижений
     * @param {Object} interaction - Объект взаимодействия
     */
    async handleViewAchievements(interaction) {
        try {
            // Проверка на превышение лимита запросов
            await Middleware.rateLimit(interaction);
            
            // Проверка наличия профиля
            const user = await Middleware.requireProfile(interaction);
            
            // Отложенный ответ для длительных операций
            await interaction.deferUpdate();
            
            // Получаем прогресс достижений пользователя
            const achievementProgress = await AchievementManager.getUserAchievementProgress(user.discordId);
            
            // Создаем эмбед с информацией о достижениях
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🏆 Ваши достижения')
                .setDescription(`Прогресс ваших достижений, ${user.username}`)
                .setThumbnail(interaction.user.displayAvatarURL());
            
            // Группируем достижения по статусу
            const earnedAchievements = achievementProgress.filter(a => a.achieved);
            const inProgressAchievements = achievementProgress.filter(a => !a.achieved && a.progress > 0);
            const lockedAchievements = achievementProgress.filter(a => !a.achieved && a.progress === 0);
            
            // Добавляем информацию о полученных достижениях
            if (earnedAchievements.length > 0) {
                embed.addFields({
                    name: '✅ Полученные достижения',
                    value: this.formatAchievementProgress(earnedAchievements)
                });
            }
            
            // Добавляем информацию о достижениях в прогрессе
            if (inProgressAchievements.length > 0) {
                embed.addFields({
                    name: '🔄 Достижения в прогрессе',
                    value: this.formatAchievementProgress(inProgressAchievements)
                });
            }
            
            // Добавляем информацию о заблокированных достижениях
            if (lockedAchievements.length > 0) {
                embed.addFields({
                    name: '🔒 Заблокированные достижения',
                    value: this.formatAchievementProgress(lockedAchievements)
                });
            }
            
            // Создаем кнопку возврата к дашборду
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('dashboard_back')
                        .setLabel('Назад к дашборду')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('◀️')
                );
            
            // Отправляем ответ
            await interaction.editReply({
                embeds: [embed],
                components: [actionRow]
            });
            
        } catch (error) {
            // Обработка ошибок middleware
            const handled = await Middleware.handleError(error, interaction);
            
            if (!handled) {
                logger.error(`Error in dashboard view achievements: ${error.message}`);
                
                await interaction.editReply({ 
                    content: 'Произошла ошибка при загрузке достижений. Пожалуйста, попробуйте позже.',
                    components: []
                });
            }
        }
    },
    
    /**
     * Форматирует прогресс достижений
     * @param {Array} achievements - Список достижений с прогрессом
     * @returns {string} Отформатированный список
     */
    formatAchievementProgress(achievements) {
        if (achievements.length === 0) {
            return 'Нет достижений в этой категории';
        }
        
        return achievements.map(ach => {
            let progressText = '';
            
            if (ach.achieved) {
                const earnedDate = Math.floor(new Date(ach.earnedAt).getTime() / 1000);
                progressText = `Получено <t:${earnedDate}:D>`;
            } else {
                progressText = `Прогресс: ${ach.progress}% (${ach.currentValue}/${ach.requirement})`;
            }
            
            return `${ach.icon} **${ach.name}** - ${ach.description}\n${progressText}`;
        }).join('\n\n');
    },
    
    /**
     * Обработчик кнопки редактирования профиля
     * @param {Object} interaction - Объект взаимодействия
     */
    async handleEditProfile(interaction) {
        try {
            // Перенаправляем на команду профиля с опцией редактирования
            const profileCommand = require('./profile');
            await profileCommand.handleEditProfile(interaction);
        } catch (error) {
            logger.error(`Error in dashboard edit profile: ${error.message}`);
            
            await interaction.reply({ 
                content: 'Произошла ошибка при редактировании профиля. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },
    
    /**
     * Обработчик кнопки настроек уведомлений
     * @param {Object} interaction - Объект взаимодействия
     */
    async handleNotificationSettings(interaction) {
        try {
            // Проверка на превышение лимита запросов
            await Middleware.rateLimit(interaction);
            
            // Проверка наличия профиля
            const user = await Middleware.requireProfile(interaction);
            
            // Создаем эмбед с настройками уведомлений
            const embed = new EmbedBuilder()
                .setColor('#2196F3')
                .setTitle('⚙️ Настройки уведомлений')
                .setDescription(`Настройте свои уведомления, ${user.username}`)
                .addFields(
                    { 
                        name: '📅 Напоминания о мероприятиях', 
                        value: user.notificationSettings.eventReminders ? '✅ Включено' : '❌ Выключено',
                        inline: true
                    },
                    { 
                        name: '⏳ Обновления листа ожидания', 
                        value: user.notificationSettings.waitlistUpdates ? '✅ Включено' : '❌ Выключено',
                        inline: true
                    },
                    { 
                        name: '🏆 Уведомления о достижениях', 
                        value: user.notificationSettings.achievementAlerts ? '✅ Включено' : '❌ Выключено',
                        inline: true
                    },
                    { 
                        name: '📨 Личные сообщения', 
                        value: user.notificationSettings.directMessages ? '✅ Включено' : '❌ Выключено',
                        inline: true
                    }
                );
            
            // Создаем кнопки для настроек
            const actionRow1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('notification_toggle_event_reminders')
                        .setLabel('Напоминания')
                        .setStyle(user.notificationSettings.eventReminders ? ButtonStyle.Success : ButtonStyle.Danger)
                        .setEmoji('📅'),
                    new ButtonBuilder()
                        .setCustomId('notification_toggle_waitlist_updates')
                        .setLabel('Лист ожидания')
                        .setStyle(user.notificationSettings.waitlistUpdates ? ButtonStyle.Success : ButtonStyle.Danger)
                        .setEmoji('⏳')
                );
            
            const actionRow2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('notification_toggle_achievement_alerts')
                        .setLabel('Достижения')
                        .setStyle(user.notificationSettings.achievementAlerts ? ButtonStyle.Success : ButtonStyle.Danger)
                        .setEmoji('🏆'),
                    new ButtonBuilder()
                        .setCustomId('notification_toggle_direct_messages')
                        .setLabel('Личные сообщения')
                        .setStyle(user.notificationSettings.directMessages ? ButtonStyle.Success : ButtonStyle.Danger)
                        .setEmoji('📨')
                );
            
            // Кнопка возврата к дашборду
            const actionRow3 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('dashboard_back')
                        .setLabel('Назад к дашборду')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('◀️')
                );
            
            // Отправляем ответ
            await interaction.reply({
                embeds: [embed],
                components: [actionRow1, actionRow2, actionRow3],
                ephemeral: true
            });
            
        } catch (error) {
            // Обработка ошибок middleware
            const handled = await Middleware.handleError(error, interaction);
            
            if (!handled) {
                logger.error(`Error in notification settings: ${error.message}`);
                
                await interaction.reply({ 
                    content: 'Произошла ошибка при загрузке настроек уведомлений. Пожалуйста, попробуйте позже.',
                    ephemeral: true
                });
            }
        }
    },
    
    /**
     * Обработчик кнопки возврата к дашборду
     * @param {Object} interaction - Объект взаимодействия
     */
    async handleBackToDashboard(interaction) {
        try {
            // Проверка на превышение лимита запросов
            await Middleware.rateLimit(interaction);
            
            // Проверка наличия профиля
            const user = await Middleware.requireProfile(interaction);
            
            // Отложенный ответ для длительных операций
            await interaction.deferUpdate();
            
            // Получаем данные для дашборда
            const dashboardData = await this.getDashboardData(user.discordId);
            
            // Создаем эмбед с основной информацией
            const embed = this.createDashboardEmbed(dashboardData, user);
            
            // Создаем кнопки действий
            const actionRow = this.createActionButtons(dashboardData);
            
            // Отправляем ответ
            await interaction.editReply({
                embeds: [embed],
                components: [actionRow]
            });
            
        } catch (error) {
            // Обработка ошибок middleware
            const handled = await Middleware.handleError(error, interaction);
            
            if (!handled) {
                logger.error(`Error in back to dashboard: ${error.message}`);
                
                await interaction.editReply({ 
                    content: 'Произошла ошибка при возврате к дашборду. Пожалуйста, попробуйте позже.',
                    components: []
                });
            }
        }
    },
    
    /**
     * Обработчик переключения настроек уведомлений
     * @param {Object} interaction - Объект взаимодействия
     * @param {string} settingKey - Ключ настройки
     */
    async handleToggleNotification(interaction, settingKey) {
        try {
            // Проверка на превышение лимита запросов
            await Middleware.rateLimit(interaction);
            
            // Проверка наличия профиля
            const user = await Middleware.requireProfile(interaction);
            
            // Отложенный ответ для длительных операций
            await interaction.deferUpdate();
            
            // Переключаем настройку
            const currentValue = user.notificationSettings[settingKey];
            const newSettings = { [settingKey]: !currentValue };
            
            // Обновляем настройки в базе данных
            await user.updateNotificationSettings(newSettings);
            
            // Обновляем отображение настроек
            await this.handleNotificationSettings(interaction);
            
        } catch (error) {
            // Обработка ошибок middleware
            const handled = await Middleware.handleError(error, interaction);
            
            if (!handled) {
                logger.error(`Error in toggle notification: ${error.message}`);
                
                await interaction.editReply({ 
                    content: 'Произошла ошибка при изменении настроек. Пожалуйста, попробуйте позже.',
                    components: []
                });
            }
        }
    }
};
