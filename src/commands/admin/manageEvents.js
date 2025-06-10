const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Event = require('../../database/models/Event');
const Registration = require('../../database/models/Registration');
const User = require('../../database/models/User');
const logger = require('../../utils/logger');
const commandPermissions = require('../../utils/commandPermissions');
const waitlistManager = require('../../utils/waitlistManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manageevents')
        .setDescription('Управление существующими мероприятиями')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Показать список всех мероприятий'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('Просмотреть детали мероприятия')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID мероприятия')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Редактировать мероприятие')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID мероприятия')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancel')
                .setDescription('Отменить мероприятие')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID мероприятия')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('participants')
                .setDescription('Управление участниками мероприятия')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID мероприятия')
                        .setRequired(true))),
    
    async execute(interaction) {
        try {
            // Проверка прав администратора
            if (!commandPermissions.hasAdminPermission(interaction.member)) {
                return interaction.reply({
                    content: '❌ У вас нет прав для использования этой команды.',
                    ephemeral: true
                });
            }

            const subcommand = interaction.options.getSubcommand();
            
            switch (subcommand) {
                case 'list':
                    await this.listEvents(interaction);
                    break;
                case 'view':
                    await this.viewEvent(interaction);
                    break;
                case 'edit':
                    await this.editEvent(interaction);
                    break;
                case 'cancel':
                    await this.cancelEvent(interaction);
                    break;
                case 'participants':
                    await this.manageParticipants(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Неизвестная подкоманда.',
                        ephemeral: true
                    });
            }
            
        } catch (error) {
            logger.error(`Ошибка при выполнении команды manageevents: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при управлении мероприятиями. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Показать список всех мероприятий
    async listEvents(interaction) {
        try {
            // Получение всех мероприятий, отсортированных по дате
            const events = await Event.find({}).sort({ dateTime: 1 });
            
            if (events.length === 0) {
                return interaction.reply({
                    content: '📅 Нет активных мероприятий.',
                    ephemeral: true
                });
            }
            
            // Группировка мероприятий по статусу
            const activeEvents = events.filter(event => event.status === 'active');
            const completedEvents = events.filter(event => event.status === 'completed');
            const cancelledEvents = events.filter(event => event.status === 'cancelled');
            
            // Создание эмбеда для активных мероприятий
            const activeEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Активные мероприятия')
                .setDescription(activeEvents.length > 0 ? 'Список предстоящих мероприятий:' : 'Нет активных мероприятий')
                .setFooter({ text: 'Synergy Guild Bot' })
                .setTimestamp();
            
            if (activeEvents.length > 0) {
                activeEvents.forEach(event => {
                    activeEmbed.addFields({
                        name: `${event.title} (ID: ${event._id})`,
                        value: `📅 ${new Date(event.dateTime).toLocaleString('ru-RU')}\n👥 ${event.participants.length}/${event.maxParticipants} участников\n📍 ${event.location}`
                    });
                });
            }
            
            // Создание эмбеда для завершенных мероприятий
            const completedEmbed = new EmbedBuilder()
                .setColor(0x808080)
                .setTitle('Завершенные мероприятия')
                .setDescription(completedEvents.length > 0 ? 'Список завершенных мероприятий:' : 'Нет завершенных мероприятий')
                .setFooter({ text: 'Synergy Guild Bot' })
                .setTimestamp();
            
            if (completedEvents.length > 0) {
                completedEvents.slice(0, 5).forEach(event => {
                    completedEmbed.addFields({
                        name: `${event.title} (ID: ${event._id})`,
                        value: `📅 ${new Date(event.dateTime).toLocaleString('ru-RU')}\n👥 ${event.participants.length}/${event.maxParticipants} участников\n📍 ${event.location}`
                    });
                });
                
                if (completedEvents.length > 5) {
                    completedEmbed.addFields({
                        name: 'И еще...',
                        value: `Еще ${completedEvents.length - 5} завершенных мероприятий`
                    });
                }
            }
            
            // Создание эмбеда для отмененных мероприятий
            const cancelledEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Отмененные мероприятия')
                .setDescription(cancelledEvents.length > 0 ? 'Список отмененных мероприятий:' : 'Нет отмененных мероприятий')
                .setFooter({ text: 'Synergy Guild Bot' })
                .setTimestamp();
            
            if (cancelledEvents.length > 0) {
                cancelledEvents.slice(0, 5).forEach(event => {
                    cancelledEmbed.addFields({
                        name: `${event.title} (ID: ${event._id})`,
                        value: `📅 ${new Date(event.dateTime).toLocaleString('ru-RU')}\n👥 ${event.participants.length}/${event.maxParticipants} участников\n📍 ${event.location}`
                    });
                });
                
                if (cancelledEvents.length > 5) {
                    cancelledEmbed.addFields({
                        name: 'И еще...',
                        value: `Еще ${cancelledEvents.length - 5} отмененных мероприятий`
                    });
                }
            }
            
            // Отправка эмбедов
            await interaction.reply({
                embeds: [activeEmbed, completedEmbed, cancelledEmbed],
                ephemeral: true
            });
            
        } catch (error) {
            logger.error(`Ошибка при получении списка мероприятий: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при получении списка мероприятий. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Просмотр деталей мероприятия
    async viewEvent(interaction) {
        try {
            const eventId = interaction.options.getString('id');
            
            // Поиск мероприятия в базе данных
            const event = await Event.findById(eventId);
            
            if (!event) {
                return interaction.reply({
                    content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                    ephemeral: true
                });
            }
            
            // Получение информации об участниках
            const participantIds = event.participants;
            const participants = await User.find({ discordId: { $in: participantIds } });
            
            // Получение информации о листе ожидания
            const waitlistIds = event.waitlist || [];
            const waitlistUsers = await User.find({ discordId: { $in: waitlistIds } });
            
            // Создание эмбеда с информацией о мероприятии
            const eventEmbed = new EmbedBuilder()
                .setColor(getEventStatusColor(event.status))
                .setTitle(event.title)
                .setDescription(event.description)
                .addFields(
                    { name: 'Статус', value: getEventStatusText(event.status), inline: true },
                    { name: 'Место проведения', value: event.location, inline: true },
                    { name: 'Дата и время', value: new Date(event.dateTime).toLocaleString('ru-RU'), inline: true },
                    { name: 'Участники', value: `${event.participants.length}/${event.maxParticipants}`, inline: true },
                    { name: 'Лист ожидания', value: `${waitlistIds.length} человек`, inline: true },
                    { name: 'Создано', value: `<@${event.createdBy}> ${new Date(event.createdAt).toLocaleString('ru-RU')}`, inline: true }
                )
                .setFooter({ text: `ID мероприятия: ${event._id}` })
                .setTimestamp();
            
            // Добавление списка участников, если они есть
            if (participants.length > 0) {
                const participantsList = participants.map((user, index) => 
                    `${index + 1}. <@${user.discordId}> (${user.nickname || 'Без никнейма'}, ${user.telegram || 'Без Telegram'})`
                ).join('\n');
                
                eventEmbed.addFields({ name: 'Список участников', value: participantsList });
            }
            
            // Добавление списка ожидания, если он есть
            if (waitlistUsers.length > 0) {
                const waitlistList = waitlistUsers.map((user, index) => 
                    `${index + 1}. <@${user.discordId}> (${user.nickname || 'Без никнейма'}, ${user.telegram || 'Без Telegram'})`
                ).join('\n');
                
                eventEmbed.addFields({ name: 'Лист ожидания', value: waitlistList });
            }
            
            // Создание кнопок для управления мероприятием
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`edit_event_${event._id}`)
                        .setLabel('Редактировать')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`manage_participants_${event._id}`)
                        .setLabel('Управление участниками')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`cancel_event_${event._id}`)
                        .setLabel('Отменить мероприятие')
                        .setStyle(ButtonStyle.Danger)
                );
            
            await interaction.reply({
                embeds: [eventEmbed],
                components: [row],
                ephemeral: true
            });
            
        } catch (error) {
            logger.error(`Ошибка при просмотре мероприятия: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при просмотре мероприятия. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Редактирование мероприятия
    async editEvent(interaction) {
        try {
            const eventId = interaction.options.getString('id');
            
            // Поиск мероприятия в базе данных
            const event = await Event.findById(eventId);
            
            if (!event) {
                return interaction.reply({
                    content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                    ephemeral: true
                });
            }
            
            // Создание модального окна для редактирования мероприятия
            const modal = createEventEditModal(event);
            await interaction.showModal(modal);
            
        } catch (error) {
            logger.error(`Ошибка при редактировании мероприятия: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при редактировании мероприятия. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Отмена мероприятия
    async cancelEvent(interaction) {
        try {
            const eventId = interaction.options.getString('id');
            
            // Поиск мероприятия в базе данных
            const event = await Event.findById(eventId);
            
            if (!event) {
                return interaction.reply({
                    content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                    ephemeral: true
                });
            }
            
            // Проверка, не отменено ли уже мероприятие
            if (event.status === 'cancelled') {
                return interaction.reply({
                    content: '❌ Это мероприятие уже отменено.',
                    ephemeral: true
                });
            }
            
            // Создание кнопок подтверждения отмены
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`confirm_cancel_${event._id}`)
                        .setLabel('Подтвердить отмену')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('cancel_operation')
                        .setLabel('Отмена')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.reply({
                content: `⚠️ Вы уверены, что хотите отменить мероприятие "${event.title}"? Это действие нельзя отменить.`,
                components: [row],
                ephemeral: true
            });
            
        } catch (error) {
            logger.error(`Ошибка при отмене мероприятия: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при отмене мероприятия. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Управление участниками мероприятия
    async manageParticipants(interaction) {
        try {
            const eventId = interaction.options.getString('id');
            
            // Поиск мероприятия в базе данных
            const event = await Event.findById(eventId);
            
            if (!event) {
                return interaction.reply({
                    content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                    ephemeral: true
                });
            }
            
            // Получение информации об участниках
            const participantIds = event.participants;
            const participants = await User.find({ discordId: { $in: participantIds } });
            
            // Получение информации о листе ожидания
            const waitlistIds = event.waitlist || [];
            const waitlistUsers = await User.find({ discordId: { $in: waitlistIds } });
            
            // Создание эмбеда с информацией о мероприятии
            const eventEmbed = new EmbedBuilder()
                .setColor(getEventStatusColor(event.status))
                .setTitle(`Управление участниками: ${event.title}`)
                .setDescription(`Управление участниками мероприятия "${event.title}"`)
                .addFields(
                    { name: 'Статус', value: getEventStatusText(event.status), inline: true },
                    { name: 'Дата и время', value: new Date(event.dateTime).toLocaleString('ru-RU'), inline: true },
                    { name: 'Участники', value: `${event.participants.length}/${event.maxParticipants}`, inline: true }
                )
                .setFooter({ text: `ID мероприятия: ${event._id}` })
                .setTimestamp();
            
            // Создание кнопок для управления участниками
            const rows = [];
            
            // Кнопки для основных действий
            const mainRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`add_participant_${event._id}`)
                        .setLabel('Добавить участника')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`manage_waitlist_${event._id}`)
                        .setLabel('Управление листом ожидания')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`back_to_event_${event._id}`)
                        .setLabel('Назад к мероприятию')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            rows.push(mainRow);
            
            // Кнопки для удаления участников (максимум 5 кнопок в ряду, максимум 5 рядов)
            if (participants.length > 0) {
                let currentRow = new ActionRowBuilder();
                let buttonCount = 0;
                
                for (let i = 0; i < Math.min(participants.length, 24); i++) {
                    if (buttonCount === 5) {
                        rows.push(currentRow);
                        currentRow = new ActionRowBuilder();
                        buttonCount = 0;
                    }
                    
                    currentRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`remove_participant_${event._id}_${participants[i].discordId}`)
                            .setLabel(`Удалить ${participants[i].nickname || participants[i].discordTag}`)
                            .setStyle(ButtonStyle.Danger)
                    );
                    
                    buttonCount++;
                }
                
                if (buttonCount > 0) {
                    rows.push(currentRow);
                }
            }
            
            await interaction.reply({
                embeds: [eventEmbed],
                components: rows,
                ephemeral: true
            });
            
        } catch (error) {
            logger.error(`Ошибка при управлении участниками: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при управлении участниками. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Обработчик кнопок
    async handleButton(interaction) {
        try {
            const customId = interaction.customId;
            
            // Обработка кнопки отмены операции
            if (customId === 'cancel_operation') {
                return interaction.update({
                    content: '✅ Операция отменена.',
                    components: [],
                    ephemeral: true
                });
            }
            
            // Обработка кнопки редактирования мероприятия
            if (customId.startsWith('edit_event_')) {
                const eventId = customId.replace('edit_event_', '');
                
                // Поиск мероприятия в базе данных
                const event = await Event.findById(eventId);
                
                if (!event) {
                    return interaction.reply({
                        content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                        ephemeral: true
                    });
                }
                
                // Создание модального окна для редактирования мероприятия
                const modal = createEventEditModal(event);
                await interaction.showModal(modal);
            }
            
            // Обработка кнопки управления участниками
            else if (customId.startsWith('manage_participants_')) {
                const eventId = customId.replace('manage_participants_', '');
                
                // Поиск мероприятия в базе данных
                const event = await Event.findById(eventId);
                
                if (!event) {
                    return interaction.reply({
                        content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                        ephemeral: true
                    });
                }
                
                // Перенаправление на метод управления участниками
                await this.manageParticipants({
                    ...interaction,
                    options: {
                        getString: () => eventId
                    }
                });
            }
            
            // Обработка кнопки отмены мероприятия
            else if (customId.startsWith('cancel_event_')) {
                const eventId = customId.replace('cancel_event_', '');
                
                // Поиск мероприятия в базе данных
                const event = await Event.findById(eventId);
                
                if (!event) {
                    return interaction.reply({
                        content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                        ephemeral: true
                    });
                }
                
                // Создание кнопок подтверждения отмены
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`confirm_cancel_${event._id}`)
                            .setLabel('Подтвердить отмену')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('cancel_operation')
                            .setLabel('Отмена')
                            .setStyle(ButtonStyle.Secondary)
                    );
                
                await interaction.reply({
                    content: `⚠️ Вы уверены, что хотите отменить мероприятие "${event.title}"? Это действие нельзя отменить.`,
                    components: [row],
                    ephemeral: true
                });
            }
            
            // Обработка кнопки подтверждения отмены мероприятия
            else if (customId.startsWith('confirm_cancel_')) {
                const eventId = customId.replace('confirm_cancel_', '');
                
                // Поиск мероприятия в базе данных
                const event = await Event.findById(eventId);
                
                if (!event) {
                    return interaction.update({
                        content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                        components: [],
                        ephemeral: true
                    });
                }
                
                // Обновление статуса мероприятия
                event.status = 'cancelled';
                event.updatedAt = new Date();
                await event.save();
                
                // Логирование отмены мероприятия
                logger.info(`Администратор ${interaction.user.tag} (${interaction.user.id}) отменил мероприятие: ${event.title} (${event._id})`);
                
                await interaction.update({
                    content: `✅ Мероприятие "${event.title}" успешно отменено.`,
                    components: [],
                    ephemeral: true
                });
            }
            
            // Обработка кнопки добавления участника
            else if (customId.startsWith('add_participant_')) {
                const eventId = customId.replace('add_participant_', '');
                
                // Поиск мероприятия в базе данных
                const event = await Event.findById(eventId);
                
                if (!event) {
                    return interaction.reply({
                        content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                        ephemeral: true
                    });
                }
                
                // Создание модального окна для добавления участника
                const modal = new ModalBuilder()
                    .setCustomId(`add_participant_modal_${eventId}`)
                    .setTitle('Добавление участника');
                
                const userIdInput = new TextInputBuilder()
                    .setCustomId('user_id')
                    .setLabel('ID пользователя Discord')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Введите ID пользователя Discord')
                    .setRequired(true);
                
                const firstRow = new ActionRowBuilder().addComponents(userIdInput);
                
                modal.addComponents(firstRow);
                
                await interaction.showModal(modal);
            }
            
            // Обработка кнопки управления листом ожидания
            else if (customId.startsWith('manage_waitlist_')) {
                const eventId = customId.replace('manage_waitlist_', '');
                
                // Поиск мероприятия в базе данных
                const event = await Event.findById(eventId);
                
                if (!event) {
                    return interaction.reply({
                        content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                        ephemeral: true
                    });
                }
                
                // Получение информации о листе ожидания
                const waitlistIds = event.waitlist || [];
                const waitlistUsers = await User.find({ discordId: { $in: waitlistIds } });
                
                // Создание эмбеда с информацией о листе ожидания
                const waitlistEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`Лист ожидания: ${event.title}`)
                    .setDescription(`Управление листом ожидания мероприятия "${event.title}"`)
                    .addFields(
                        { name: 'Участники', value: `${event.participants.length}/${event.maxParticipants}`, inline: true },
                        { name: 'Лист ожидания', value: `${waitlistIds.length} человек`, inline: true }
                    )
                    .setFooter({ text: `ID мероприятия: ${event._id}` })
                    .setTimestamp();
                
                // Добавление списка ожидания, если он есть
                if (waitlistUsers.length > 0) {
                    const waitlistList = waitlistUsers.map((user, index) => 
                        `${index + 1}. <@${user.discordId}> (${user.nickname || 'Без никнейма'}, ${user.telegram || 'Без Telegram'})`
                    ).join('\n');
                    
                    waitlistEmbed.addFields({ name: 'Пользователи в листе ожидания', value: waitlistList });
                } else {
                    waitlistEmbed.addFields({ name: 'Пользователи в листе ожидания', value: 'Лист ожидания пуст' });
                }
                
                // Создание кнопок для управления листом ожидания
                const rows = [];
                
                // Кнопки для основных действий
                const mainRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`promote_all_waitlist_${event._id}`)
                            .setLabel('Добавить всех из листа ожидания')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(waitlistUsers.length === 0 || event.participants.length >= event.maxParticipants),
                        new ButtonBuilder()
                            .setCustomId(`back_to_participants_${event._id}`)
                            .setLabel('Назад к управлению участниками')
                            .setStyle(ButtonStyle.Secondary)
                    );
                
                rows.push(mainRow);
                
                // Кнопки для добавления отдельных пользователей из листа ожидания
                if (waitlistUsers.length > 0) {
                    let currentRow = new ActionRowBuilder();
                    let buttonCount = 0;
                    
                    for (let i = 0; i < Math.min(waitlistUsers.length, 24); i++) {
                        if (buttonCount === 5) {
                            rows.push(currentRow);
                            currentRow = new ActionRowBuilder();
                            buttonCount = 0;
                        }
                        
                        currentRow.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`promote_waitlist_${event._id}_${waitlistUsers[i].discordId}`)
                                .setLabel(`Добавить ${waitlistUsers[i].nickname || waitlistUsers[i].discordTag}`)
                                .setStyle(ButtonStyle.Success)
                                .setDisabled(event.participants.length >= event.maxParticipants)
                        );
                        
                        buttonCount++;
                    }
                    
                    if (buttonCount > 0) {
                        rows.push(currentRow);
                    }
                }
                
                await interaction.reply({
                    embeds: [waitlistEmbed],
                    components: rows,
                    ephemeral: true
                });
            }
            
            // Обработка кнопки возврата к мероприятию
            else if (customId.startsWith('back_to_event_')) {
                const eventId = customId.replace('back_to_event_', '');
                
                // Перенаправление на метод просмотра мероприятия
                await this.viewEvent({
                    ...interaction,
                    options: {
                        getString: () => eventId
                    }
                });
            }
            
            // Обработка кнопки возврата к управлению участниками
            else if (customId.startsWith('back_to_participants_')) {
                const eventId = customId.replace('back_to_participants_', '');
                
                // Перенаправление на метод управления участниками
                await this.manageParticipants({
                    ...interaction,
                    options: {
                        getString: () => eventId
                    }
                });
            }
            
            // Обработка кнопки удаления участника
            else if (customId.startsWith('remove_participant_')) {
                const [, eventId, userId] = customId.split('_').slice(2);
                
                // Поиск мероприятия в базе данных
                const event = await Event.findById(eventId);
                
                if (!event) {
                    return interaction.reply({
                        content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                        ephemeral: true
                    });
                }
                
                // Проверка, есть ли пользователь в списке участников
                if (!event.participants.includes(userId)) {
                    return interaction.reply({
                        content: '❌ Пользователь не является участником этого мероприятия.',
                        ephemeral: true
                    });
                }
                
                // Удаление пользователя из списка участников
                event.participants = event.participants.filter(id => id !== userId);
                event.updatedAt = new Date();
                await event.save();
                
                // Удаление записи о регистрации
                await Registration.deleteOne({ eventId: event._id, userId });
                
                // Логирование удаления участника
                logger.info(`Администратор ${interaction.user.tag} (${interaction.user.id}) удалил участника ${userId} из мероприятия: ${event.title} (${event._id})`);
                
                // Проверка листа ожидания и добавление следующего участника, если есть место
                if (event.waitlist && event.waitlist.length > 0 && event.participants.length < event.maxParticipants) {
                    await waitlistManager.promoteFromWaitlist(event);
                }
                
                // Перенаправление на метод управления участниками для обновления списка
                await this.manageParticipants({
                    ...interaction,
                    options: {
                        getString: () => eventId
                    }
                });
            }
            
            // Обработка кнопки добавления пользователя из листа ожидания
            else if (customId.startsWith('promote_waitlist_')) {
                const [, eventId, userId] = customId.split('_').slice(2);
                
                // Поиск мероприятия в базе данных
                const event = await Event.findById(eventId);
                
                if (!event) {
                    return interaction.reply({
                        content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                        ephemeral: true
                    });
                }
                
                // Проверка, есть ли пользователь в листе ожидания
                if (!event.waitlist || !event.waitlist.includes(userId)) {
                    return interaction.reply({
                        content: '❌ Пользователь не находится в листе ожидания этого мероприятия.',
                        ephemeral: true
                    });
                }
                
                // Проверка, есть ли свободные места
                if (event.participants.length >= event.maxParticipants) {
                    return interaction.reply({
                        content: '❌ Мероприятие уже заполнено. Невозможно добавить больше участников.',
                        ephemeral: true
                    });
                }
                
                // Добавление пользователя в список участников
                event.participants.push(userId);
                
                // Удаление пользователя из листа ожидания
                event.waitlist = event.waitlist.filter(id => id !== userId);
                
                event.updatedAt = new Date();
                await event.save();
                
                // Создание записи о регистрации
                const registration = new Registration({
                    eventId: event._id,
                    userId,
                    registeredAt: new Date(),
                    status: 'confirmed'
                });
                
                await registration.save();
                
                // Логирование добавления участника из листа ожидания
                logger.info(`Администратор ${interaction.user.tag} (${interaction.user.id}) добавил участника ${userId} из листа ожидания в мероприятие: ${event.title} (${event._id})`);
                
                // Перенаправление на метод управления листом ожидания для обновления списка
                await interaction.reply({
                    content: `✅ Пользователь <@${userId}> успешно добавлен в список участников.`,
                    ephemeral: true
                });
                
                // Обновление списка
                await this.manageParticipants({
                    ...interaction,
                    options: {
                        getString: () => eventId
                    }
                });
            }
            
            // Обработка кнопки добавления всех пользователей из листа ожидания
            else if (customId.startsWith('promote_all_waitlist_')) {
                const eventId = customId.replace('promote_all_waitlist_', '');
                
                // Поиск мероприятия в базе данных
                const event = await Event.findById(eventId);
                
                if (!event) {
                    return interaction.reply({
                        content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                        ephemeral: true
                    });
                }
                
                // Проверка, есть ли пользователи в листе ожидания
                if (!event.waitlist || event.waitlist.length === 0) {
                    return interaction.reply({
                        content: '❌ Лист ожидания пуст.',
                        ephemeral: true
                    });
                }
                
                // Определение, сколько пользователей можно добавить
                const availableSlots = event.maxParticipants - event.participants.length;
                
                if (availableSlots <= 0) {
                    return interaction.reply({
                        content: '❌ Мероприятие уже заполнено. Невозможно добавить больше участников.',
                        ephemeral: true
                    });
                }
                
                // Добавление пользователей из листа ожидания
                const usersToAdd = event.waitlist.slice(0, availableSlots);
                
                // Добавление пользователей в список участников
                event.participants = [...event.participants, ...usersToAdd];
                
                // Удаление добавленных пользователей из листа ожидания
                event.waitlist = event.waitlist.filter(id => !usersToAdd.includes(id));
                
                event.updatedAt = new Date();
                await event.save();
                
                // Создание записей о регистрации
                const registrations = usersToAdd.map(userId => ({
                    eventId: event._id,
                    userId,
                    registeredAt: new Date(),
                    status: 'confirmed'
                }));
                
                await Registration.insertMany(registrations);
                
                // Логирование добавления участников из листа ожидания
                logger.info(`Администратор ${interaction.user.tag} (${interaction.user.id}) добавил ${usersToAdd.length} участников из листа ожидания в мероприятие: ${event.title} (${event._id})`);
                
                await interaction.reply({
                    content: `✅ Добавлено ${usersToAdd.length} участников из листа ожидания.`,
                    ephemeral: true
                });
                
                // Обновление списка
                await this.manageParticipants({
                    ...interaction,
                    options: {
                        getString: () => eventId
                    }
                });
            }
            
        } catch (error) {
            logger.error(`Ошибка при обработке кнопки: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Обработчик модальных окон
    async handleModal(interaction) {
        try {
            const customId = interaction.customId;
            
            // Обработка модального окна редактирования мероприятия
            if (customId.startsWith('edit_event_modal_')) {
                const eventId = customId.replace('edit_event_modal_', '');
                
                // Поиск мероприятия в базе данных
                const event = await Event.findById(eventId);
                
                if (!event) {
                    return interaction.reply({
                        content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                        ephemeral: true
                    });
                }
                
                // Получение значений из полей
                const title = interaction.fields.getTextInputValue('event_title');
                const description = interaction.fields.getTextInputValue('event_description');
                const location = interaction.fields.getTextInputValue('event_location');
                const dateTimeStr = interaction.fields.getTextInputValue('event_datetime');
                const maxParticipants = interaction.fields.getTextInputValue('event_max_participants');
                
                // Валидация даты и времени
                const dateTime = new Date(dateTimeStr);
                
                if (isNaN(dateTime.getTime())) {
                    return interaction.reply({
                        content: '❌ Неверный формат даты и времени. Используйте формат YYYY-MM-DD HH:MM.',
                        ephemeral: true
                    });
                }
                
                // Валидация максимального количества участников
                const maxParticipantsNum = parseInt(maxParticipants);
                
                if (isNaN(maxParticipantsNum) || maxParticipantsNum <= 0) {
                    return interaction.reply({
                        content: '❌ Максимальное количество участников должно быть положительным числом.',
                        ephemeral: true
                    });
                }
                
                // Проверка, не уменьшается ли количество участников ниже текущего числа зарегистрированных
                if (maxParticipantsNum < event.participants.length) {
                    return interaction.reply({
                        content: `❌ Невозможно уменьшить максимальное количество участников ниже текущего числа зарегистрированных (${event.participants.length}).`,
                        ephemeral: true
                    });
                }
                
                // Обновление данных мероприятия
                event.title = title;
                event.description = description;
                event.location = location;
                event.dateTime = dateTime;
                event.maxParticipants = maxParticipantsNum;
                event.updatedAt = new Date();
                
                await event.save();
                
                // Логирование редактирования мероприятия
                logger.info(`Администратор ${interaction.user.tag} (${interaction.user.id}) отредактировал мероприятие: ${event.title} (${event._id})`);
                
                // Создание эмбеда с обновленной информацией о мероприятии
                const eventEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('Мероприятие успешно обновлено')
                    .addFields(
                        { name: 'Название', value: title, inline: false },
                        { name: 'Описание', value: description, inline: false },
                        { name: 'Место проведения', value: location, inline: true },
                        { name: 'Дата и время', value: dateTime.toLocaleString('ru-RU'), inline: true },
                        { name: 'Максимум участников', value: maxParticipants, inline: true }
                    )
                    .setFooter({ text: `ID мероприятия: ${event._id}` })
                    .setTimestamp();
                
                await interaction.reply({
                    content: '✅ Мероприятие успешно обновлено!',
                    embeds: [eventEmbed],
                    ephemeral: true
                });
            }
            
            // Обработка модального окна добавления участника
            else if (customId.startsWith('add_participant_modal_')) {
                const eventId = customId.replace('add_participant_modal_', '');
                
                // Поиск мероприятия в базе данных
                const event = await Event.findById(eventId);
                
                if (!event) {
                    return interaction.reply({
                        content: `❌ Мероприятие с ID ${eventId} не найдено.`,
                        ephemeral: true
                    });
                }
                
                // Получение значений из полей
                const userId = interaction.fields.getTextInputValue('user_id');
                
                // Проверка, существует ли пользователь
                const user = await User.findOne({ discordId: userId });
                
                if (!user) {
                    return interaction.reply({
                        content: '❌ Пользователь не найден. Убедитесь, что пользователь зарегистрирован в системе.',
                        ephemeral: true
                    });
                }
                
                // Проверка, не является ли пользователь уже участником
                if (event.participants.includes(userId)) {
                    return interaction.reply({
                        content: '❌ Пользователь уже является участником этого мероприятия.',
                        ephemeral: true
                    });
                }
                
                // Проверка, есть ли свободные места
                if (event.participants.length >= event.maxParticipants) {
                    return interaction.reply({
                        content: '❌ Мероприятие уже заполнено. Невозможно добавить больше участников.',
                        ephemeral: true
                    });
                }
                
                // Проверка, находится ли пользователь в листе ожидания
                if (event.waitlist && event.waitlist.includes(userId)) {
                    // Удаление пользователя из листа ожидания
                    event.waitlist = event.waitlist.filter(id => id !== userId);
                }
                
                // Добавление пользователя в список участников
                event.participants.push(userId);
                event.updatedAt = new Date();
                await event.save();
                
                // Создание записи о регистрации
                const registration = new Registration({
                    eventId: event._id,
                    userId,
                    registeredAt: new Date(),
                    status: 'confirmed'
                });
                
                await registration.save();
                
                // Логирование добавления участника
                logger.info(`Администратор ${interaction.user.tag} (${interaction.user.id}) добавил участника ${userId} в мероприятие: ${event.title} (${event._id})`);
                
                await interaction.reply({
                    content: `✅ Пользователь <@${userId}> успешно добавлен в список участников.`,
                    ephemeral: true
                });
                
                // Обновление списка
                await this.manageParticipants({
                    ...interaction,
                    options: {
                        getString: () => eventId
                    }
                });
            }
            
        } catch (error) {
            logger.error(`Ошибка при обработке модального окна: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при обработке запроса. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    }
};

// Функция для создания модального окна редактирования мероприятия
function createEventEditModal(event) {
    const modal = new ModalBuilder()
        .setCustomId(`edit_event_modal_${event._id}`)
        .setTitle('Редактирование мероприятия');
    
    const titleInput = new TextInputBuilder()
        .setCustomId('event_title')
        .setLabel('Название мероприятия')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Введите название мероприятия')
        .setValue(event.title)
        .setRequired(true);
    
    const descriptionInput = new TextInputBuilder()
        .setCustomId('event_description')
        .setLabel('Описание мероприятия')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Введите описание мероприятия')
        .setValue(event.description)
        .setRequired(true);
    
    const locationInput = new TextInputBuilder()
        .setCustomId('event_location')
        .setLabel('Место проведения')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Введите место проведения')
        .setValue(event.location)
        .setRequired(true);
    
    // Форматирование даты и времени для поля ввода
    const dateTime = new Date(event.dateTime);
    const year = dateTime.getFullYear();
    const month = String(dateTime.getMonth() + 1).padStart(2, '0');
    const day = String(dateTime.getDate()).padStart(2, '0');
    const hours = String(dateTime.getHours()).padStart(2, '0');
    const minutes = String(dateTime.getMinutes()).padStart(2, '0');
    const dateTimeStr = `${year}-${month}-${day} ${hours}:${minutes}`;
    
    const dateTimeInput = new TextInputBuilder()
        .setCustomId('event_datetime')
        .setLabel('Дата и время (YYYY-MM-DD HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Например: 2023-12-31 18:00')
        .setValue(dateTimeStr)
        .setRequired(true);
    
    const maxParticipantsInput = new TextInputBuilder()
        .setCustomId('event_max_participants')
        .setLabel('Максимальное количество участников')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Введите число')
        .setValue(event.maxParticipants.toString())
        .setRequired(true);
    
    const firstRow = new ActionRowBuilder().addComponents(titleInput);
    const secondRow = new ActionRowBuilder().addComponents(descriptionInput);
    const thirdRow = new ActionRowBuilder().addComponents(locationInput);
    const fourthRow = new ActionRowBuilder().addComponents(dateTimeInput);
    const fifthRow = new ActionRowBuilder().addComponents(maxParticipantsInput);
    
    modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow);
    
    return modal;
}

// Функция для получения цвета в зависимости от статуса мероприятия
function getEventStatusColor(status) {
    switch (status) {
        case 'active':
            return 0x00FF00; // Зеленый
        case 'completed':
            return 0x808080; // Серый
        case 'cancelled':
            return 0xFF0000; // Красный
        default:
            return 0x0099FF; // Синий
    }
}

// Функция для получения текстового представления статуса мероприятия
function getEventStatusText(status) {
    switch (status) {
        case 'active':
            return '🟢 Активно';
        case 'completed':
            return '⚪ Завершено';
        case 'cancelled':
            return '🔴 Отменено';
        default:
            return '❓ Неизвестно';
    }
}
