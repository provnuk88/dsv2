const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Event = require('../../database/models/Event');
const Registration = require('../../database/models/Registration');
const User = require('../../database/models/User');
const logger = require('../../utils/logger');
const waitlistManager = require('../../utils/waitlistManager');
const eventScheduler = require('../../utils/eventScheduler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Регистрация на мероприятие')
        .addStringOption(option =>
            option.setName('event_id')
                .setDescription('ID мероприятия (опционально)')
                .setRequired(false)),
    
    async execute(interaction) {
        try {
            // Проверяем, есть ли профиль у пользователя
            const userProfile = await User.findOne({ discordId: interaction.user.id });
            
            if (!userProfile) {
                return interaction.reply({
                    content: '⚠️ У вас еще нет профиля. Пожалуйста, создайте профиль с помощью команды `/profile edit` перед регистрацией на мероприятие.',
                    ephemeral: true
                });
            }
            
            // Получаем ID мероприятия из опций команды
            const eventId = interaction.options.getString('event_id');
            
            // Если ID мероприятия указан, регистрируем пользователя на это мероприятие
            if (eventId) {
                await this.registerForEvent(interaction, eventId);
            }
            // Если ID мероприятия не указан, показываем список доступных мероприятий
            else {
                await this.showEventsList(interaction);
            }
            
        } catch (error) {
            logger.error(`Ошибка при выполнении команды register: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при регистрации на мероприятие. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },
    
    // Показать список доступных мероприятий
    async showEventsList(interaction) {
        try {
            // Получаем все активные мероприятия
            const events = await Event.find({
                guildId: interaction.guildId,
                status: 'active',
                date: { $gt: new Date() }
            }).sort({ date: 1 });
            
            if (events.length === 0) {
                return interaction.reply({
                    content: '📅 В настоящее время нет активных мероприятий для регистрации.',
                    ephemeral: true
                });
            }
            
            // Получаем регистрации пользователя
            const userRegistrations = await Registration.find({
                discordId: interaction.user.id,
                guildId: interaction.guildId
            });
            
            // Создаем эмбед для списка мероприятий
            const eventsEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Доступные мероприятия')
                .setDescription('Выберите мероприятие для регистрации:')
                .setFooter({ text: 'Synergy Guild Bot' })
                .setTimestamp();
            
            // Добавляем информацию о каждом мероприятии
            for (const event of events) {
                // Проверяем, зарегистрирован ли пользователь на это мероприятие
                const isRegistered = userRegistrations.some(reg => reg.eventId.toString() === event._id.toString() && reg.status !== 'cancelled');
                
                // Форматируем дату и время
                const eventDate = new Date(event.date);
                const formattedDate = eventDate.toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
                const formattedTime = eventDate.toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                // Добавляем поле для мероприятия
                eventsEmbed.addFields({
                    name: `${event.title} (${formattedDate} ${formattedTime})`,
                    value: `${event.description.substring(0, 100)}${event.description.length > 100 ? '...' : ''}\n` +
                           `Участники: ${event.currentParticipants}/${event.maxParticipants}\n` +
                           `Статус: ${isRegistered ? '✅ Вы зарегистрированы' : '⏳ Регистрация открыта'}\n` +
                           `ID: ${event._id}`
                });
            }
            
            // Отправляем эмбед
            await interaction.reply({
                embeds: [eventsEmbed],
                ephemeral: true
            });
            
        } catch (error) {
            logger.error(`Ошибка при показе списка мероприятий: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при получении списка мероприятий. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },
    
    // Регистрация на мероприятие
    async registerForEvent(interaction, eventId) {
        try {
            // Получаем мероприятие из базы данных
            const event = await Event.findById(eventId);
            
            // Если мероприятие не найдено
            if (!event) {
                return interaction.reply({
                    content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                    ephemeral: true
                });
            }
            
            // Если мероприятие не активно
            if (event.status !== 'active') {
                return interaction.reply({
                    content: `⚠️ Мероприятие "${event.title}" не активно. Регистрация закрыта.`,
                    ephemeral: true
                });
            }
            
            // Если мероприятие уже прошло
            if (new Date(event.date) < new Date()) {
                return interaction.reply({
                    content: `⚠️ Мероприятие "${event.title}" уже прошло. Регистрация закрыта.`,
                    ephemeral: true
                });
            }
            
            // Проверяем, зарегистрирован ли пользователь на это мероприятие
            const existingRegistration = await Registration.findOne({
                discordId: interaction.user.id,
                eventId: eventId,
                status: { $ne: 'cancelled' }
            });
            
            if (existingRegistration) {
                // Создаем эмбед с информацией о мероприятии
                const eventEmbed = this.createEventEmbed(event, true);
                
                // Создаем кнопки для отмены регистрации
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`event_cancel_${eventId}`)
                            .setLabel('Отменить регистрацию')
                            .setStyle(ButtonStyle.Danger)
                    );
                
                // Проверяем, был ли выдан ключ доступа
                const distributedKey = event.distributedKeys.find(dk => dk.discordId === interaction.user.id);
                const keyMessage = distributedKey 
                    ? `\n\n**Ваш ключ доступа:** \`${distributedKey.key}\``
                    : '';
                
                return interaction.reply({
                    content: `✅ Вы уже зарегистрированы на мероприятие "${event.title}".${keyMessage}`,
                    embeds: [eventEmbed],
                    components: [row],
                    ephemeral: true
                });
            }
            
            // Проверяем, есть ли свободные места
            if (event.currentParticipants >= event.maxParticipants) {
                // Предлагаем добавить пользователя в лист ожидания
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`event_waitlist_${eventId}`)
                            .setLabel('Добавить в лист ожидания')
                            .setStyle(ButtonStyle.Primary)
                    );
                
                return interaction.reply({
                    content: `⚠️ Мероприятие "${event.title}" уже заполнено. Вы можете добавить себя в лист ожидания.`,
                    components: [row],
                    ephemeral: true
                });
            }
            
            // Создаем новую регистрацию
            const registration = new Registration({
                discordId: interaction.user.id,
                eventId: eventId,
                guildId: interaction.guildId,
                status: 'confirmed',
                registrationDate: new Date()
            });
            
            await registration.save();
            
            // Увеличиваем количество участников
            event.currentParticipants += 1;
            
            // Проверяем наличие ключей доступа и выдаем ключ, если они есть
            let accessKeyMessage = '';
            let accessKey = null;
            
            if (event.accessKeys && event.accessKeys.length > 0) {
                // Получаем первый доступный ключ
                accessKey = event.accessKeys[0];
                
                // Удаляем ключ из списка доступных
                event.accessKeys.splice(0, 1);
                
                // Добавляем ключ в список выданных
                event.distributedKeys.push({
                    discordId: interaction.user.id,
                    key: accessKey,
                    distributedAt: new Date()
                });
                
                accessKeyMessage = `\n\n**Ваш ключ доступа:** \`${accessKey}\``;
                
                // Логируем выдачу ключа
                logger.info(`Пользователю ${interaction.user.tag} (${interaction.user.id}) выдан ключ доступа для мероприятия "${event.title}" (${eventId})`);
                
                // Проверяем, остались ли еще ключи
                if (event.accessKeys.length === 0) {
                    // Отправляем уведомление администраторам о том, что ключи закончились
                    this.sendKeyExhaustionNotification(interaction.client, event);
                }
            } else if (event.distributedKeys && event.distributedKeys.length > 0) {
                // Если ключи были, но закончились
                accessKeyMessage = '\n\n⚠️ Ключи доступа закончились, но, приходи на мероприятие, и получи доступ там.';
                
                // Логируем отсутствие ключей
                logger.info(`Для пользователя ${interaction.user.tag} (${interaction.user.id}) не хватило ключей доступа для мероприятия "${event.title}" (${eventId})`);
            }
            
            await event.save();
            
            // Логируем регистрацию
            logger.info(`Пользователь ${interaction.user.tag} (${interaction.user.id}) зарегистрировался на мероприятие "${event.title}" (${eventId})`);
            
            // Создаем эмбед с информацией о мероприятии
            const eventEmbed = this.createEventEmbed(event, true);
            
            // Создаем кнопки для отмены регистрации
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`event_cancel_${eventId}`)
                        .setLabel('Отменить регистрацию')
                        .setStyle(ButtonStyle.Danger)
                );
            
            // Отправляем подтверждение
            await interaction.reply({
                content: `✅ Вы успешно зарегистрировались на мероприятие "${event.title}"!${accessKeyMessage}`,
                embeds: [eventEmbed],
                components: [row],
                ephemeral: true
            });
            
            // Если канал для уведомлений указан, отправляем уведомление
            if (event.notificationChannelId) {
                try {
                    const channel = await interaction.client.channels.fetch(event.notificationChannelId);
                    
                    if (channel) {
                        const notificationEmbed = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle(`Новая регистрация на мероприятие "${event.title}"`)
                            .setDescription(`Пользователь ${interaction.user} зарегистрировался на мероприятие.`)
                            .addFields(
                                { name: 'Мероприятие', value: event.title, inline: true },
                                { name: 'Дата и время', value: new Date(event.date).toLocaleString('ru-RU'), inline: true },
                                { name: 'Участники', value: `${event.currentParticipants}/${event.maxParticipants}`, inline: true }
                            )
                            .setFooter({ text: 'Synergy Guild Bot' })
                            .setTimestamp();
                        
                        await channel.send({ embeds: [notificationEmbed] });
                    }
                } catch (error) {
                    logger.error(`Ошибка при отправке уведомления о регистрации: ${error.message}`);
                }
            }
            
        } catch (error) {
            logger.error(`Ошибка при регистрации на мероприятие: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при регистрации на мероприятие. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },
    
    // Отправка уведомления администраторам о том, что ключи закончились
    async sendKeyExhaustionNotification(client, event) {
        try {
            // Если указан канал для уведомлений, отправляем туда
            if (event.notificationChannelId) {
                const channel = await client.channels.fetch(event.notificationChannelId);
                
                if (channel) {
                    const notificationEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle(`⚠️ Ключи доступа закончились!`)
                        .setDescription(`Для мероприятия "${event.title}" закончились ключи доступа.`)
                        .addFields(
                            { name: 'Мероприятие', value: event.title, inline: true },
                            { name: 'ID', value: event._id.toString(), inline: true },
                            { name: 'Выдано ключей', value: event.distributedKeys.length.toString(), inline: true }
                        )
                        .setFooter({ text: 'Synergy Guild Bot' })
                        .setTimestamp();
                    
                    await channel.send({ 
                        content: `<@&${event.creatorId}> Внимание! Необходимо добавить новые ключи доступа.`,
                        embeds: [notificationEmbed] 
                    });
                    
                    logger.info(`Отправлено уведомление о том, что закончились ключи доступа для мероприятия "${event.title}" (${event._id})`);
                }
            }
        } catch (error) {
            logger.error(`Ошибка при отправке уведомления о том, что закончились ключи: ${error.message}`);
        }
    },
    
    // Обработка кнопок
    async handleButton(interaction) {
        try {
            const customId = interaction.customId;
            
            // Обработка кнопки отмены регистрации
            if (customId.startsWith('event_cancel_')) {
                const eventId = customId.replace('event_cancel_', '');
                await this.cancelRegistration(interaction, eventId);
            }
            
            // Обработка кнопки добавления в лист ожидания
            else if (customId.startsWith('event_waitlist_')) {
                const eventId = customId.replace('event_waitlist_', '');
                await this.addToWaitlist(interaction, eventId);
            }
            
            // Обработка кнопки отмены листа ожидания
            else if (customId.startsWith('event_waitlist_cancel_')) {
                const eventId = customId.replace('event_waitlist_cancel_', '');
                await this.cancelWaitlist(interaction, eventId);
            }
            
        } catch (error) {
            logger.error(`Ошибка при обработке кнопки: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },
    
    // Отмена регистрации на мероприятие
    async cancelRegistration(interaction, eventId) {
        try {
            // Получаем мероприятие из базы данных
            const event = await Event.findById(eventId);
            
            // Если мероприятие не найдено
            if (!event) {
                return interaction.reply({
                    content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                    ephemeral: true
                });
            }
            
            // Проверяем, зарегистрирован ли пользователь на это мероприятие
            const registration = await Registration.findOne({
                discordId: interaction.user.id,
                eventId: eventId,
                status: { $ne: 'cancelled' }
            });
            
            if (!registration) {
                return interaction.reply({
                    content: `❌ Вы не зарегистрированы на мероприятие "${event.title}".`,
                    ephemeral: true
                });
            }
            
            // Отменяем регистрацию
            registration.status = 'cancelled';
            registration.cancelledAt = new Date();
            await registration.save();
            
            // Уменьшаем количество участников
            event.currentParticipants -= 1;
            
            // Проверяем, был ли выдан ключ доступа
            const distributedKeyIndex = event.distributedKeys.findIndex(dk => dk.discordId === interaction.user.id);
            
            if (distributedKeyIndex !== -1) {
                // Получаем ключ
                const distributedKey = event.distributedKeys[distributedKeyIndex];
                
                // Возвращаем ключ в пул доступных
                event.accessKeys.push(distributedKey.key);
                
                // Удаляем ключ из списка выданных
                event.distributedKeys.splice(distributedKeyIndex, 1);
                
                // Логируем возврат ключа
                logger.info(`Ключ доступа возвращен в пул для мероприятия "${event.title}" (${eventId}) от пользователя ${interaction.user.tag} (${interaction.user.id})`);
            }
            
            await event.save();
            
            // Логируем отмену регистрации
            logger.info(`Пользователь ${interaction.user.tag} (${interaction.user.id}) отменил регистрацию на мероприятие "${event.title}" (${eventId})`);
            
            // Проверяем, есть ли пользователи в листе ожидания
            const nextWaitlistUser = await waitlistManager.getNextWaitlistUser(eventId);
            
            if (nextWaitlistUser) {
                // Удаляем пользователя из листа ожидания
                await waitlistManager.removeFromWaitlist(eventId, nextWaitlistUser);
                
                // Регистрируем пользователя на мероприятие
                const newRegistration = new Registration({
                    discordId: nextWaitlistUser,
                    eventId: eventId,
                    guildId: interaction.guildId,
                    status: 'confirmed',
                    registrationDate: new Date(),
                    fromWaitlist: true
                });
                
                await newRegistration.save();
                
                // Увеличиваем количество участников
                event.currentParticipants += 1;
                
                // Проверяем наличие ключей доступа и выдаем ключ, если они есть
                let accessKey = null;
                
                if (event.accessKeys && event.accessKeys.length > 0) {
                    // Получаем первый доступный ключ
                    accessKey = event.accessKeys[0];
                    
                    // Удаляем ключ из списка доступных
                    event.accessKeys.splice(0, 1);
                    
                    // Добавляем ключ в список выданных
                    event.distributedKeys.push({
                        discordId: nextWaitlistUser,
                        key: accessKey,
                        distributedAt: new Date()
                    });
                    
                    // Логируем выдачу ключа
                    logger.info(`Пользователю с ID ${nextWaitlistUser} выдан ключ доступа для мероприятия "${event.title}" (${eventId}) из листа ожидания`);
                }
                
                await event.save();
                
                // Отправляем уведомление пользователю из листа ожидания
                try {
                    const user = await interaction.client.users.fetch(nextWaitlistUser);
                    
                    if (user) {
                        const eventEmbed = this.createEventEmbed(event, true);
                        
                        // Создаем кнопки для отмены регистрации
                        const row = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`event_cancel_${eventId}`)
                                    .setLabel('Отменить регистрацию')
                                    .setStyle(ButtonStyle.Danger)
                            );
                        
                        // Формируем сообщение о ключе доступа
                        let accessKeyMessage = '';
                        
                        if (accessKey) {
                            accessKeyMessage = `\n\n**Ваш ключ доступа:** \`${accessKey}\``;
                        } else if (event.distributedKeys && event.distributedKeys.length > 0) {
                            accessKeyMessage = '\n\n⚠️ Ключи доступа закончились, но, приходи на мероприятие, и получи доступ там.';
                        }
                        
                        await user.send({
                            content: `✅ Освободилось место на мероприятие "${event.title}"! Вы автоматически зарегистрированы, так как были в листе ожидания.${accessKeyMessage}`,
                            embeds: [eventEmbed],
                            components: [row]
                        });
                        
                        // Логируем отправку уведомления
                        logger.info(`Отправлено уведомление пользователю с ID ${nextWaitlistUser} о регистрации на мероприятие "${event.title}" (${eventId}) из листа ожидания`);
                    }
                } catch (error) {
                    logger.error(`Ошибка при отправке уведомления пользователю из листа ожидания: ${error.message}`);
                }
            }
            
            // Отправляем подтверждение отмены регистрации
            await interaction.reply({
                content: `✅ Вы успешно отменили регистрацию на мероприятие "${event.title}".`,
                ephemeral: true
            });
            
        } catch (error) {
            logger.error(`Ошибка при отмене регистрации: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при отмене регистрации. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },
    
    // Добавление в лист ожидания
    async addToWaitlist(interaction, eventId) {
        try {
            // Получаем мероприятие из базы данных
            const event = await Event.findById(eventId);
            
            // Если мероприятие не найдено
            if (!event) {
                return interaction.reply({
                    content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                    ephemeral: true
                });
            }
            
            // Если мероприятие не активно
            if (event.status !== 'active') {
                return interaction.reply({
                    content: `⚠️ Мероприятие "${event.title}" не активно. Регистрация закрыта.`,
                    ephemeral: true
                });
            }
            
            // Если мероприятие уже прошло
            if (new Date(event.date) < new Date()) {
                return interaction.reply({
                    content: `⚠️ Мероприятие "${event.title}" уже прошло. Регистрация закрыта.`,
                    ephemeral: true
                });
            }
            
            // Проверяем, зарегистрирован ли пользователь на это мероприятие
            const existingRegistration = await Registration.findOne({
                discordId: interaction.user.id,
                eventId: eventId,
                status: { $ne: 'cancelled' }
            });
            
            if (existingRegistration) {
                return interaction.reply({
                    content: `✅ Вы уже зарегистрированы на мероприятие "${event.title}".`,
                    ephemeral: true
                });
            }
            
            // Проверяем, есть ли пользователь в листе ожидания
            const isInWaitlist = await waitlistManager.isInWaitlist(eventId, interaction.user.id);
            
            if (isInWaitlist) {
                return interaction.reply({
                    content: `✅ Вы уже находитесь в листе ожидания на мероприятие "${event.title}".`,
                    ephemeral: true
                });
            }
            
            // Добавляем пользователя в лист ожидания
            await waitlistManager.addToWaitlist(eventId, interaction.user.id);
            
            // Логируем добавление в лист ожидания
            logger.info(`Пользователь ${interaction.user.tag} (${interaction.user.id}) добавлен в лист ожидания на мероприятие "${event.title}" (${eventId})`);
            
            // Создаем эмбед с информацией о мероприятии
            const eventEmbed = this.createEventEmbed(event);
            
            // Создаем кнопки для отмены листа ожидания
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`event_waitlist_cancel_${eventId}`)
                        .setLabel('Покинуть лист ожидания')
                        .setStyle(ButtonStyle.Danger)
                );
            
            // Отправляем подтверждение
            await interaction.reply({
                content: `✅ Вы успешно добавлены в лист ожидания на мероприятие "${event.title}". Мы уведомим вас, если появится свободное место.`,
                embeds: [eventEmbed],
                components: [row],
                ephemeral: true
            });
            
        } catch (error) {
            logger.error(`Ошибка при добавлении в лист ожидания: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при добавлении в лист ожидания. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },
    
    // Отмена листа ожидания
    async cancelWaitlist(interaction, eventId) {
        try {
            // Получаем мероприятие из базы данных
            const event = await Event.findById(eventId);
            
            // Если мероприятие не найдено
            if (!event) {
                return interaction.reply({
                    content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                    ephemeral: true
                });
            }
            
            // Проверяем, есть ли пользователь в листе ожидания
            const isInWaitlist = await waitlistManager.isInWaitlist(eventId, interaction.user.id);
            
            if (!isInWaitlist) {
                return interaction.reply({
                    content: `❌ Вы не находитесь в листе ожидания на мероприятие "${event.title}".`,
                    ephemeral: true
                });
            }
            
            // Удаляем пользователя из листа ожидания
            await waitlistManager.removeFromWaitlist(eventId, interaction.user.id);
            
            // Логируем удаление из листа ожидания
            logger.info(`Пользователь ${interaction.user.tag} (${interaction.user.id}) удален из листа ожидания на мероприятие "${event.title}" (${eventId})`);
            
            // Отправляем подтверждение
            await interaction.reply({
                content: `✅ Вы успешно удалены из листа ожидания на мероприятие "${event.title}".`,
                ephemeral: true
            });
            
        } catch (error) {
            logger.error(`Ошибка при отмене листа ожидания: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при отмене листа ожидания. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },
    
    // Создание эмбеда с информацией о мероприятии
    createEventEmbed(event, isRegistered = false) {
        // Форматируем дату и время
        const eventDate = new Date(event.date);
        const formattedDate = eventDate.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const formattedTime = eventDate.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Создаем эмбед
        const eventEmbed = new EmbedBuilder()
            .setColor(isRegistered ? 0x00FF00 : 0x0099FF)
            .setTitle(event.title)
            .setDescription(event.description)
            .addFields(
                { name: 'Дата и время', value: `${formattedDate} ${formattedTime}`, inline: true },
                { name: 'Участники', value: `${event.currentParticipants}/${event.maxParticipants}`, inline: true },
                { name: 'Статус', value: isRegistered ? '✅ Вы зарегистрированы' : '⏳ Регистрация открыта', inline: true }
            )
            .setFooter({ text: 'Synergy Guild Bot' })
            .setTimestamp();
        
        // Добавляем информацию о призах, если она есть
        if (event.prizes && event.prizes.length > 0) {
            eventEmbed.addFields({ name: 'Призы', value: event.prizes });
        }
        
        // Добавляем информацию о требованиях, если они есть
        if (event.requirements && event.requirements.length > 0) {
            eventEmbed.addFields({ name: 'Требования', value: event.requirements });
        }
        
        return eventEmbed;
    }
};
