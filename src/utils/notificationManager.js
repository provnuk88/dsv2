/**
 * Модуль умных уведомлений для Discord
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../database/models/User');
const Event = require('../database/models/Event');
const Registration = require('../database/models/Registration');
const botEvents = require('../events/botEvents');
const logger = require('./logger');
const client = require('../index').client;

class NotificationManager {
    /**
     * Инициализирует менеджер уведомлений
     */
    static initialize() {
        // Подписываемся на события бота
        this.setupEventListeners();
        logger.info('Notification manager initialized');
    }
    
    /**
     * Настраивает слушателей событий
     */
    static setupEventListeners() {
        // Событие создания мероприятия
        botEvents.on('event.created', this.handleEventCreated.bind(this));
        
        // Событие регистрации на мероприятие
        botEvents.on('registration.created', this.handleRegistrationCreated.bind(this));
        
        // Событие изменения статуса регистрации
        botEvents.on('registration.statusChanged', this.handleRegistrationStatusChanged.bind(this));
        
        // Событие отмены регистрации
        botEvents.on('registration.cancelled', this.handleRegistrationCancelled.bind(this));
        
        // Событие приближения мероприятия
        botEvents.on('event.approaching', this.handleEventApproaching.bind(this));
        
        // Событие начала мероприятия
        botEvents.on('event.started', this.handleEventStarted.bind(this));
        
        // Событие завершения мероприятия
        botEvents.on('event.ended', this.handleEventEnded.bind(this));
        
        // Событие получения достижения
        botEvents.on('achievement.earned', this.handleAchievementEarned.bind(this));
    }
    
    /**
     * Обрабатывает событие создания мероприятия
     * @param {string} eventId - ID мероприятия
     * @param {Object} eventData - Данные мероприятия
     */
    static async handleEventCreated(eventId, eventData) {
        try {
            // Получаем канал для объявлений
            const announcementChannelId = process.env.ANNOUNCEMENT_CHANNEL_ID;
            
            if (!announcementChannelId) {
                logger.warn('Announcement channel ID not configured');
                return;
            }
            
            const channel = await client.channels.fetch(announcementChannelId);
            
            if (!channel) {
                logger.warn(`Announcement channel ${announcementChannelId} not found`);
                return;
            }
            
            // Создаем эмбед с информацией о мероприятии
            const startTime = Math.floor(new Date(eventData.startDate).getTime() / 1000);
            const endTime = Math.floor(new Date(eventData.endDate).getTime() / 1000);
            
            const embed = new EmbedBuilder()
                .setColor('#4CAF50')
                .setTitle('🎉 Новое мероприятие!')
                .setDescription(`**${eventData.title}**\n\n${eventData.description}`)
                .addFields(
                    { name: '📅 Начало', value: `<t:${startTime}:F>`, inline: true },
                    { name: '⏰ Окончание', value: `<t:${endTime}:F>`, inline: true },
                    { name: '📍 Место', value: eventData.location || 'Онлайн', inline: true },
                    { name: '👥 Максимум участников', value: eventData.maxParticipants.toString(), inline: true }
                )
                .setFooter({ text: 'Synergy Guild Bot' });
            
            // Создаем кнопку для регистрации
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`register_${eventId}`)
                        .setLabel('Зарегистрироваться')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('✅')
                );
            
            // Отправляем объявление
            await channel.send({ embeds: [embed], components: [actionRow] });
            
            logger.info(`Sent announcement for event: ${eventData.title} (${eventId})`);
        } catch (error) {
            logger.error(`Error handling event created notification: ${error.message}`);
        }
    }
    
    /**
     * Обрабатывает событие регистрации на мероприятие
     * @param {string} registrationId - ID регистрации
     * @param {Object} registrationData - Данные регистрации
     */
    static async handleRegistrationCreated(registrationId, registrationData) {
        try {
            // Получаем данные пользователя и мероприятия
            const user = await User.findOne({ discordId: registrationData.userId });
            const event = await Event.findById(registrationData.eventId);
            
            if (!user || !event) {
                logger.warn(`User or event not found for registration ${registrationId}`);
                return;
            }
            
            // Получаем пользователя Discord
            const discordUser = await client.users.fetch(user.discordId);
            
            if (!discordUser) {
                logger.warn(`Discord user ${user.discordId} not found`);
                return;
            }
            
            // Создаем эмбед с информацией о регистрации
            const startTime = Math.floor(new Date(event.startDate).getTime() / 1000);
            const endTime = Math.floor(new Date(event.endDate).getTime() / 1000);
            
            const embed = new EmbedBuilder()
                .setColor(registrationData.status === 'confirmed' ? '#4CAF50' : '#FFC107')
                .setTitle(registrationData.status === 'confirmed' ? '✅ Регистрация подтверждена' : '⏳ Вы в листе ожидания')
                .setDescription(`Вы ${registrationData.status === 'confirmed' ? 'зарегистрированы' : 'добавлены в лист ожидания'} на мероприятие **${event.title}**`)
                .addFields(
                    { name: '📅 Начало', value: `<t:${startTime}:F>`, inline: true },
                    { name: '⏰ Окончание', value: `<t:${endTime}:F>`, inline: true },
                    { name: '📍 Место', value: event.location || 'Онлайн', inline: true }
                );
            
            // Добавляем информацию о ключе доступа, если он есть
            if (registrationData.accessKey) {
                embed.addFields({ name: '🔑 Ключ доступа', value: `\`${registrationData.accessKey}\`` });
            }
            
            // Добавляем информацию о статусе
            if (registrationData.status === 'waitlist') {
                embed.addFields({ 
                    name: '📋 Статус', 
                    value: 'Вы находитесь в листе ожидания. Мы уведомим вас, если освободится место.' 
                });
            }
            
            // Создаем кнопку для отмены регистрации
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`cancel_registration_${registrationId}`)
                        .setLabel('Отменить регистрацию')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌')
                );
            
            // Отправляем личное сообщение пользователю
            await discordUser.send({ embeds: [embed], components: [actionRow] });
            
            logger.info(`Sent registration confirmation to user: ${user.discordId} for event: ${event.title}`);
        } catch (error) {
            logger.error(`Error handling registration created notification: ${error.message}`);
        }
    }
    
    /**
     * Обрабатывает событие изменения статуса регистрации
     * @param {string} registrationId - ID регистрации
     * @param {Object} registrationData - Данные регистрации
     * @param {string} oldStatus - Предыдущий статус
     * @param {string} newStatus - Новый статус
     */
    static async handleRegistrationStatusChanged(registrationId, registrationData, oldStatus, newStatus) {
        try {
            // Получаем данные пользователя и мероприятия
            const user = await User.findOne({ discordId: registrationData.userId });
            const event = await Event.findById(registrationData.eventId);
            
            if (!user || !event) {
                logger.warn(`User or event not found for registration ${registrationId}`);
                return;
            }
            
            // Получаем пользователя Discord
            const discordUser = await client.users.fetch(user.discordId);
            
            if (!discordUser) {
                logger.warn(`Discord user ${user.discordId} not found`);
                return;
            }
            
            // Создаем эмбед с информацией об изменении статуса
            const startTime = Math.floor(new Date(event.startDate).getTime() / 1000);
            
            let embed;
            
            // Различные сообщения в зависимости от изменения статуса
            if (oldStatus === 'waitlist' && newStatus === 'confirmed') {
                embed = new EmbedBuilder()
                    .setColor('#4CAF50')
                    .setTitle('✅ Вы перемещены из листа ожидания')
                    .setDescription(`Для вас освободилось место на мероприятии **${event.title}**!`)
                    .addFields(
                        { name: '📅 Дата и время', value: `<t:${startTime}:F>`, inline: true },
                        { name: '📍 Место', value: event.location || 'Онлайн', inline: true }
                    );
                
                // Добавляем информацию о ключе доступа, если он есть
                if (registrationData.accessKey) {
                    embed.addFields({ name: '🔑 Ключ доступа', value: `\`${registrationData.accessKey}\`` });
                }
            } else if (newStatus === 'completed') {
                embed = new EmbedBuilder()
                    .setColor('#2196F3')
                    .setTitle('🎉 Мероприятие завершено')
                    .setDescription(`Спасибо за участие в мероприятии **${event.title}**!`)
                    .addFields(
                        { name: '📊 Статус', value: 'Ваше участие отмечено как завершенное' }
                    );
                
                // Проверяем, получил ли пользователь достижение
                const achievements = user.achievements.filter(a => a.earnedAt > new Date(Date.now() - 3600000));
                
                if (achievements.length > 0) {
                    const achievementsList = achievements
                        .map(a => `🏆 **${a.name}**: ${a.description}`)
                        .join('\n');
                    
                    embed.addFields({ name: '🏆 Новые достижения', value: achievementsList });
                }
            }
            
            if (embed) {
                // Создаем кнопку для просмотра профиля
                const actionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`view_profile_${user.discordId}`)
                            .setLabel('Просмотреть профиль')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('👤')
                    );
                
                // Отправляем личное сообщение пользователю
                await discordUser.send({ embeds: [embed], components: [actionRow] });
                
                logger.info(`Sent status change notification to user: ${user.discordId} for event: ${event.title}`);
            }
        } catch (error) {
            logger.error(`Error handling registration status changed notification: ${error.message}`);
        }
    }
    
    /**
     * Обрабатывает событие отмены регистрации
     * @param {string} registrationId - ID регистрации
     * @param {Object} registrationData - Данные регистрации
     */
    static async handleRegistrationCancelled(registrationId, registrationData) {
        try {
            // Получаем данные пользователя и мероприятия
            const user = await User.findOne({ discordId: registrationData.userId });
            const event = await Event.findById(registrationData.eventId);
            
            if (!user || !event) {
                logger.warn(`User or event not found for registration ${registrationId}`);
                return;
            }
            
            // Получаем пользователя Discord
            const discordUser = await client.users.fetch(user.discordId);
            
            if (!discordUser) {
                logger.warn(`Discord user ${user.discordId} not found`);
                return;
            }
            
            // Создаем эмбед с информацией об отмене регистрации
            const embed = new EmbedBuilder()
                .setColor('#F44336')
                .setTitle('❌ Регистрация отменена')
                .setDescription(`Ваша регистрация на мероприятие **${event.title}** была отменена.`)
                .addFields(
                    { name: '📋 Статус', value: 'Отменено' }
                )
                .setFooter({ text: 'Вы всегда можете зарегистрироваться снова, если места еще доступны.' });
            
            // Отправляем личное сообщение пользователю
            await discordUser.send({ embeds: [embed] });
            
            logger.info(`Sent cancellation notification to user: ${user.discordId} for event: ${event.title}`);
            
            // Если мероприятие не заполнено, уведомляем первого пользователя из листа ожидания
            if (event.stats.registrationsCount < event.maxParticipants) {
                await this.notifyNextWaitlistUser(event._id);
            }
        } catch (error) {
            logger.error(`Error handling registration cancelled notification: ${error.message}`);
        }
    }
    
    /**
     * Уведомляет следующего пользователя из листа ожидания
     * @param {string} eventId - ID мероприятия
     */
    static async notifyNextWaitlistUser(eventId) {
        try {
            // Находим первую регистрацию в листе ожидания
            const waitlistRegistration = await Registration.findOne({
                eventId,
                status: 'waitlist'
            }).sort({ registrationDate: 1 });
            
            if (!waitlistRegistration) {
                logger.info(`No users in waitlist for event ${eventId}`);
                return;
            }
            
            // Получаем данные пользователя и мероприятия
            const user = await User.findOne({ discordId: waitlistRegistration.userId });
            const event = await Event.findById(eventId);
            
            if (!user || !event) {
                logger.warn(`User or event not found for waitlist notification`);
                return;
            }
            
            // Получаем пользователя Discord
            const discordUser = await client.users.fetch(user.discordId);
            
            if (!discordUser) {
                logger.warn(`Discord user ${user.discordId} not found`);
                return;
            }
            
            // Обновляем статус регистрации
            waitlistRegistration.status = 'confirmed';
            await waitlistRegistration.save();
            
            // Создаем эмбед с информацией о перемещении из листа ожидания
            const startTime = Math.floor(new Date(event.startDate).getTime() / 1000);
            
            const embed = new EmbedBuilder()
                .setColor('#4CAF50')
                .setTitle('✅ Освободилось место!')
                .setDescription(`Для вас освободилось место на мероприятии **${event.title}**!`)
                .addFields(
                    { name: '📅 Дата и время', value: `<t:${startTime}:F>`, inline: true },
                    { name: '📍 Место', value: event.location || 'Онлайн', inline: true },
                    { name: '📋 Статус', value: 'Подтверждено' }
                );
            
            // Добавляем информацию о ключе доступа, если он есть
            if (waitlistRegistration.accessKey) {
                embed.addFields({ name: '🔑 Ключ доступа', value: `\`${waitlistRegistration.accessKey}\`` });
            }
            
            // Создаем кнопку для отмены регистрации
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`cancel_registration_${waitlistRegistration._id}`)
                        .setLabel('Отменить регистрацию')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌')
                );
            
            // Отправляем личное сообщение пользователю
            await discordUser.send({ embeds: [embed], components: [actionRow] });
            
            logger.info(`Notified waitlist user: ${user.discordId} for event: ${event.title}`);
            
            // Генерируем событие изменения статуса регистрации
            botEvents.emit('registration.statusChanged', 
                waitlistRegistration._id.toString(), 
                waitlistRegistration, 
                'waitlist', 
                'confirmed'
            );
            
            // Обновляем статистику мероприятия
            event.stats.waitlistCount--;
            event.stats.registrationsCount++;
            await event.save();
        } catch (error) {
            logger.error(`Error notifying next waitlist user: ${error.message}`);
        }
    }
    
    /**
     * Обрабатывает событие приближения мероприятия
     * @param {string} eventId - ID мероприятия
     * @param {Object} eventData - Данные мероприятия
     */
    static async handleEventApproaching(eventId, eventData) {
        try {
            // Находим все подтвержденные регистрации на мероприятие
            const registrations = await Registration.find({
                eventId,
                status: 'confirmed'
            });
            
            if (registrations.length === 0) {
                logger.info(`No confirmed registrations for event ${eventId}`);
                return;
            }
            
            // Создаем эмбед с напоминанием о мероприятии
            const startTime = Math.floor(new Date(eventData.startDate).getTime() / 1000);
            
            const embed = new EmbedBuilder()
                .setColor('#2196F3')
                .setTitle('⏰ Напоминание о мероприятии')
                .setDescription(`Мероприятие **${eventData.title}** начнется скоро!`)
                .addFields(
                    { name: '📅 Начало', value: `<t:${startTime}:F>`, inline: true },
                    { name: '📍 Место', value: eventData.location || 'Онлайн', inline: true }
                );
            
            // Отправляем напоминание каждому участнику
            for (const registration of registrations) {
                try {
                    // Получаем пользователя Discord
                    const discordUser = await client.users.fetch(registration.userId);
                    
                    if (!discordUser) {
                        logger.warn(`Discord user ${registration.userId} not found`);
                        continue;
                    }
                    
                    // Добавляем информацию о ключе доступа, если он есть
                    const embedWithKey = EmbedBuilder.from(embed);
                    
                    if (registration.accessKey) {
                        embedWithKey.addFields({ name: '🔑 Ключ доступа', value: `\`${registration.accessKey}\`` });
                    }
                    
                    // Создаем кнопку для отмены регистрации
                    const actionRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`cancel_registration_${registration._id}`)
                                .setLabel('Отменить регистрацию')
                                .setStyle(ButtonStyle.Danger)
                                .setEmoji('❌')
                        );
                    
                    // Отправляем личное сообщение пользователю
                    await discordUser.send({ embeds: [embedWithKey], components: [actionRow] });
                    
                    logger.info(`Sent reminder to user: ${registration.userId} for event: ${eventData.title}`);
                } catch (error) {
                    logger.error(`Error sending reminder to user ${registration.userId}: ${error.message}`);
                }
            }
            
            // Отправляем напоминание в канал объявлений
            const announcementChannelId = process.env.ANNOUNCEMENT_CHANNEL_ID;
            
            if (announcementChannelId) {
                try {
                    const channel = await client.channels.fetch(announcementChannelId);
                    
                    if (channel) {
                        // Создаем эмбед для канала
                        const channelEmbed = new EmbedBuilder()
                            .setColor('#2196F3')
                            .setTitle('⏰ Напоминание о мероприятии')
                            .setDescription(`Мероприятие **${eventData.title}** начнется <t:${startTime}:R>!`)
                            .addFields(
                                { name: '📅 Начало', value: `<t:${startTime}:F>`, inline: true },
                                { name: '📍 Место', value: eventData.location || 'Онлайн', inline: true },
                                { name: '👥 Участники', value: `${registrations.length}/${eventData.maxParticipants}`, inline: true }
                            );
                        
                        await channel.send({ embeds: [channelEmbed] });
                        
                        logger.info(`Sent reminder to announcement channel for event: ${eventData.title}`);
                    }
                } catch (error) {
                    logger.error(`Error sending reminder to announcement channel: ${error.message}`);
                }
            }
        } catch (error) {
            logger.error(`Error handling event approaching notification: ${error.message}`);
        }
    }
    
    /**
     * Обрабатывает событие начала мероприятия
     * @param {string} eventId - ID мероприятия
     * @param {Object} eventData - Данные мероприятия
     */
    static async handleEventStarted(eventId, eventData) {
        try {
            // Находим все подтвержденные регистрации на мероприятие
            const registrations = await Registration.find({
                eventId,
                status: 'confirmed'
            });
            
            if (registrations.length === 0) {
                logger.info(`No confirmed registrations for event ${eventId}`);
                return;
            }
            
            // Создаем эмбед с уведомлением о начале мероприятия
            const embed = new EmbedBuilder()
                .setColor('#673AB7')
                .setTitle('🎬 Мероприятие началось!')
                .setDescription(`Мероприятие **${eventData.title}** началось!`)
                .addFields(
                    { name: '📍 Место', value: eventData.location || 'Онлайн' }
                );
            
            // Отправляем уведомление каждому участнику
            for (const registration of registrations) {
                try {
                    // Получаем пользователя Discord
                    const discordUser = await client.users.fetch(registration.userId);
                    
                    if (!discordUser) {
                        logger.warn(`Discord user ${registration.userId} not found`);
                        continue;
                    }
                    
                    // Добавляем информацию о ключе доступа, если он есть
                    const embedWithKey = EmbedBuilder.from(embed);
                    
                    if (registration.accessKey) {
                        embedWithKey.addFields({ name: '🔑 Ключ доступа', value: `\`${registration.accessKey}\`` });
                    }
                    
                    // Отправляем личное сообщение пользователю
                    await discordUser.send({ embeds: [embedWithKey] });
                    
                    logger.info(`Sent start notification to user: ${registration.userId} for event: ${eventData.title}`);
                } catch (error) {
                    logger.error(`Error sending start notification to user ${registration.userId}: ${error.message}`);
                }
            }
            
            // Отправляем уведомление в канал объявлений
            const announcementChannelId = process.env.ANNOUNCEMENT_CHANNEL_ID;
            
            if (announcementChannelId) {
                try {
                    const channel = await client.channels.fetch(announcementChannelId);
                    
                    if (channel) {
                        // Создаем эмбед для канала
                        const channelEmbed = new EmbedBuilder()
                            .setColor('#673AB7')
                            .setTitle('🎬 Мероприятие началось!')
                            .setDescription(`Мероприятие **${eventData.title}** началось!`)
                            .addFields(
                                { name: '📍 Место', value: eventData.location || 'Онлайн' },
                                { name: '👥 Участники', value: `${registrations.length}/${eventData.maxParticipants}` }
                            );
                        
                        await channel.send({ embeds: [channelEmbed] });
                        
                        logger.info(`Sent start notification to announcement channel for event: ${eventData.title}`);
                    }
                } catch (error) {
                    logger.error(`Error sending start notification to announcement channel: ${error.message}`);
                }
            }
        } catch (error) {
            logger.error(`Error handling event started notification: ${error.message}`);
        }
    }
    
    /**
     * Обрабатывает событие завершения мероприятия
     * @param {string} eventId - ID мероприятия
     * @param {Object} eventData - Данные мероприятия
     */
    static async handleEventEnded(eventId, eventData) {
        try {
            // Находим все подтвержденные регистрации на мероприятие
            const registrations = await Registration.find({
                eventId,
                status: 'confirmed'
            });
            
            if (registrations.length === 0) {
                logger.info(`No confirmed registrations for event ${eventId}`);
                return;
            }
            
            // Создаем эмбед с уведомлением о завершении мероприятия
            const embed = new EmbedBuilder()
                .setColor('#9C27B0')
                .setTitle('🏁 Мероприятие завершено')
                .setDescription(`Мероприятие **${eventData.title}** завершено!`)
                .addFields(
                    { name: '📋 Статус', value: 'Завершено' }
                );
            
            // Отправляем уведомление каждому участнику и обновляем статус регистрации
            for (const registration of registrations) {
                try {
                    // Получаем пользователя Discord
                    const discordUser = await client.users.fetch(registration.userId);
                    
                    // Обновляем статус регистрации
                    registration.status = 'completed';
                    await registration.save();
                    
                    // Генерируем событие изменения статуса регистрации
                    botEvents.emit('registration.statusChanged', 
                        registration._id.toString(), 
                        registration, 
                        'confirmed', 
                        'completed'
                    );
                    
                    // Обновляем статистику пользователя
                    const user = await User.findOne({ discordId: registration.userId });
                    
                    if (user) {
                        user.stats.eventsCompleted++;
                        user.stats.lastActive = new Date();
                        await user.save();
                    }
                    
                    if (!discordUser) {
                        logger.warn(`Discord user ${registration.userId} not found`);
                        continue;
                    }
                    
                    // Создаем кнопку для просмотра профиля
                    const actionRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`view_profile_${registration.userId}`)
                                .setLabel('Просмотреть профиль')
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji('👤')
                        );
                    
                    // Отправляем личное сообщение пользователю
                    await discordUser.send({ embeds: [embed], components: [actionRow] });
                    
                    logger.info(`Sent end notification to user: ${registration.userId} for event: ${eventData.title}`);
                } catch (error) {
                    logger.error(`Error sending end notification to user ${registration.userId}: ${error.message}`);
                }
            }
            
            // Отправляем уведомление в канал объявлений
            const announcementChannelId = process.env.ANNOUNCEMENT_CHANNEL_ID;
            
            if (announcementChannelId) {
                try {
                    const channel = await client.channels.fetch(announcementChannelId);
                    
                    if (channel) {
                        // Создаем эмбед для канала
                        const channelEmbed = new EmbedBuilder()
                            .setColor('#9C27B0')
                            .setTitle('🏁 Мероприятие завершено')
                            .setDescription(`Мероприятие **${eventData.title}** завершено!`)
                            .addFields(
                                { name: '👥 Участники', value: `${registrations.length}/${eventData.maxParticipants}` },
                                { name: '📊 Статус', value: 'Завершено' }
                            );
                        
                        await channel.send({ embeds: [channelEmbed] });
                        
                        logger.info(`Sent end notification to announcement channel for event: ${eventData.title}`);
                    }
                } catch (error) {
                    logger.error(`Error sending end notification to announcement channel: ${error.message}`);
                }
            }
            
            // Обновляем статистику мероприятия
            eventData.stats.completionRate = Math.round((registrations.length / eventData.stats.registrationsCount) * 100);
            eventData.active = false;
            await eventData.save();
        } catch (error) {
            logger.error(`Error handling event ended notification: ${error.message}`);
        }
    }
    
    /**
     * Обрабатывает событие получения достижения
     * @param {string} userId - ID пользователя
     * @param {Object} achievementData - Данные достижения
     */
    static async handleAchievementEarned(userId, achievementData) {
        try {
            // Получаем пользователя Discord
            const discordUser = await client.users.fetch(userId);
            
            if (!discordUser) {
                logger.warn(`Discord user ${userId} not found`);
                return;
            }
            
            // Создаем эмбед с уведомлением о получении достижения
            const embed = new EmbedBuilder()
                .setColor('#FF9800')
                .setTitle('🏆 Новое достижение!')
                .setDescription(`Вы получили новое достижение: **${achievementData.name}**`)
                .addFields(
                    { name: '📝 Описание', value: achievementData.description },
                    { name: '📅 Получено', value: new Date(achievementData.earnedAt).toLocaleString() }
                );
            
            // Создаем кнопку для просмотра профиля
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`view_profile_${userId}`)
                        .setLabel('Просмотреть профиль')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('👤')
                );
            
            // Отправляем личное сообщение пользователю
            await discordUser.send({ embeds: [embed], components: [actionRow] });
            
            logger.info(`Sent achievement notification to user: ${userId} for achievement: ${achievementData.name}`);
        } catch (error) {
            logger.error(`Error handling achievement earned notification: ${error.message}`);
        }
    }
    
    /**
     * Отправляет объявление всем пользователям
     * @param {string} title - Заголовок объявления
     * @param {string} message - Текст объявления
     * @param {string} color - Цвет объявления (hex)
     * @param {boolean} sendDM - Отправлять ли личные сообщения
     * @returns {Promise<number>} Количество пользователей, получивших объявление
     */
    static async sendAnnouncement(title, message, color = '#2196F3', sendDM = false) {
        try {
            // Создаем эмбед с объявлением
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(message)
                .setTimestamp()
                .setFooter({ text: 'Synergy Guild Bot' });
            
            // Отправляем объявление в канал объявлений
            const announcementChannelId = process.env.ANNOUNCEMENT_CHANNEL_ID;
            
            if (!announcementChannelId) {
                logger.warn('Announcement channel ID not configured');
                return 0;
            }
            
            const channel = await client.channels.fetch(announcementChannelId);
            
            if (!channel) {
                logger.warn(`Announcement channel ${announcementChannelId} not found`);
                return 0;
            }
            
            await channel.send({ embeds: [embed] });
            
            logger.info(`Sent announcement to channel: ${title}`);
            
            // Если нужно отправить личные сообщения
            if (sendDM) {
                // Получаем всех пользователей
                const users = await User.find();
                let sentCount = 0;
                
                for (const user of users) {
                    try {
                        // Получаем пользователя Discord
                        const discordUser = await client.users.fetch(user.discordId);
                        
                        if (!discordUser) {
                            logger.warn(`Discord user ${user.discordId} not found`);
                            continue;
                        }
                        
                        // Отправляем личное сообщение пользователю
                        await discordUser.send({ embeds: [embed] });
                        
                        sentCount++;
                        
                        // Добавляем задержку, чтобы избежать превышения лимита API
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } catch (error) {
                        logger.error(`Error sending announcement to user ${user.discordId}: ${error.message}`);
                    }
                }
                
                logger.info(`Sent announcement to ${sentCount} users via DM`);
                return sentCount;
            }
            
            return 0;
        } catch (error) {
            logger.error(`Error sending announcement: ${error.message}`);
            return 0;
        }
    }
    
    /**
     * Проверяет приближающиеся мероприятия и отправляет уведомления
     */
    static async checkUpcomingEvents() {
        try {
            const now = new Date();
            const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
            
            // Находим мероприятия, которые начнутся в течение часа
            const upcomingEvents = await Event.find({
                active: true,
                startDate: { $gt: now, $lt: oneHourLater }
            });
            
            for (const event of upcomingEvents) {
                // Генерируем событие приближения мероприятия
                botEvents.emit('event.approaching', event._id.toString(), event);
            }
            
            // Находим мероприятия, которые начались
            const startedEvents = await Event.find({
                active: true,
                startDate: { $lt: now },
                endDate: { $gt: now },
                'stats.notifiedStart': { $ne: true }
            });
            
            for (const event of startedEvents) {
                // Генерируем событие начала мероприятия
                botEvents.emit('event.started', event._id.toString(), event);
                
                // Отмечаем, что уведомление о начале отправлено
                event.stats.notifiedStart = true;
                await event.save();
            }
            
            // Находим мероприятия, которые завершились
            const endedEvents = await Event.find({
                active: true,
                endDate: { $lt: now },
                'stats.notifiedEnd': { $ne: true }
            });
            
            for (const event of endedEvents) {
                // Генерируем событие завершения мероприятия
                botEvents.emit('event.ended', event._id.toString(), event);
                
                // Отмечаем, что уведомление о завершении отправлено
                event.stats.notifiedEnd = true;
                await event.save();
            }
        } catch (error) {
            logger.error(`Error checking upcoming events: ${error.message}`);
        }
    }
}

module.exports = NotificationManager;
