const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Event = require('../../database/models/Event');
const EventTemplate = require('../../database/models/EventTemplate');
const logger = require('../../utils/logger');
const commandPermissions = require('../../utils/commandPermissions');
const eventScheduler = require('../../utils/eventScheduler');
const eventTemplates = require('../../utils/eventTemplates');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('createevent')
        .setDescription('Создать новое мероприятие')
        .addStringOption(option => 
            option.setName('template')
                .setDescription('Использовать шаблон мероприятия')
                .setRequired(false)),
    
    async execute(interaction) {
        try {
            // Проверка прав администратора
            if (!commandPermissions.hasAdminPermission(interaction.member)) {
                return interaction.reply({
                    content: '❌ У вас нет прав для использования этой команды.',
                    ephemeral: true
                });
            }

            // Проверка, выбран ли шаблон
            const templateName = interaction.options.getString('template');
            
            if (templateName) {
                // Поиск шаблона в базе данных
                const template = await EventTemplate.findOne({ name: templateName });
                
                if (!template) {
                    // Получение списка доступных шаблонов
                    const templates = await EventTemplate.find({});
                    const templateList = templates.map(t => `- ${t.name}`).join('\n');
                    
                    return interaction.reply({
                        content: `❌ Шаблон "${templateName}" не найден. Доступные шаблоны:\n${templateList || 'Шаблоны отсутствуют'}`,
                        ephemeral: true
                    });
                }
                
                // Создание модального окна с предзаполненными данными из шаблона
                const modal = createEventModal(template);
                await interaction.showModal(modal);
            } else {
                // Если шаблон не выбран, показываем список доступных шаблонов или предлагаем создать мероприятие с нуля
                const templates = await EventTemplate.find({});
                
                if (templates.length > 0) {
                    // Создание эмбеда со списком шаблонов
                    const templatesEmbed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle('Доступные шаблоны мероприятий')
                        .setDescription('Выберите шаблон или создайте мероприятие с нуля:')
                        .addFields(
                            templates.map(template => ({
                                name: template.name,
                                value: template.description || 'Без описания'
                            }))
                        )
                        .setFooter({ text: 'Synergy Guild Bot' })
                        .setTimestamp();
                    
                    // Создание кнопок для выбора шаблона или создания с нуля
                    const rows = [];
                    let currentRow = new ActionRowBuilder();
                    let buttonCount = 0;
                    
                    // Добавляем кнопки для каждого шаблона (максимум 5 кнопок в ряду, максимум 5 рядов)
                    for (let i = 0; i < Math.min(templates.length, 24); i++) {
                        if (buttonCount === 5) {
                            rows.push(currentRow);
                            currentRow = new ActionRowBuilder();
                            buttonCount = 0;
                        }
                        
                        currentRow.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`template_${templates[i].name}`)
                                .setLabel(templates[i].name)
                                .setStyle(ButtonStyle.Primary)
                        );
                        
                        buttonCount++;
                    }
                    
                    // Добавляем кнопку "Создать с нуля"
                    if (buttonCount === 5) {
                        rows.push(currentRow);
                        currentRow = new ActionRowBuilder();
                    }
                    
                    currentRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId('create_from_scratch')
                            .setLabel('Создать с нуля')
                            .setStyle(ButtonStyle.Secondary)
                    );
                    
                    rows.push(currentRow);
                    
                    await interaction.reply({
                        embeds: [templatesEmbed],
                        components: rows,
                        ephemeral: true
                    });
                } else {
                    // Если шаблонов нет, сразу показываем модальное окно для создания с нуля
                    const modal = createEventModal();
                    await interaction.showModal(modal);
                }
            }
            
        } catch (error) {
            logger.error(`Ошибка при выполнении команды createevent: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при создании мероприятия. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Обработчик кнопок
    async handleButton(interaction) {
        try {
            const customId = interaction.customId;
            
            if (customId === 'create_from_scratch') {
                // Создание пустого модального окна
                const modal = createEventModal();
                await interaction.showModal(modal);
            } else if (customId.startsWith('template_')) {
                // Извлечение имени шаблона из customId
                const templateName = customId.replace('template_', '');
                
                // Поиск шаблона в базе данных
                const template = await EventTemplate.findOne({ name: templateName });
                
                if (!template) {
                    return interaction.reply({
                        content: `❌ Шаблон "${templateName}" не найден.`,
                        ephemeral: true
                    });
                }
                
                // Создание модального окна с предзаполненными данными из шаблона
                const modal = createEventModal(template);
                await interaction.showModal(modal);
            } else if (customId === 'save_as_template') {
                // Получение ID мероприятия из сообщения
                const eventId = interaction.message.embeds[0].footer.text.split(': ')[1];
                
                // Поиск мероприятия в базе данных
                const event = await Event.findById(eventId);
                
                if (!event) {
                    return interaction.reply({
                        content: '❌ Мероприятие не найдено.',
                        ephemeral: true
                    });
                }
                
                // Создание модального окна для сохранения шаблона
                const modal = new ModalBuilder()
                    .setCustomId(`save_template_${eventId}`)
                    .setTitle('Сохранение шаблона мероприятия');
                
                const nameInput = new TextInputBuilder()
                    .setCustomId('template_name')
                    .setLabel('Название шаблона')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Введите название шаблона')
                    .setRequired(true);
                
                const descriptionInput = new TextInputBuilder()
                    .setCustomId('template_description')
                    .setLabel('Описание шаблона')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Введите описание шаблона')
                    .setRequired(false);
                
                const firstRow = new ActionRowBuilder().addComponents(nameInput);
                const secondRow = new ActionRowBuilder().addComponents(descriptionInput);
                
                modal.addComponents(firstRow, secondRow);
                
                await interaction.showModal(modal);
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
            
            if (customId === 'create_event_modal') {
                // Получение значений из полей
                const title = interaction.fields.getTextInputValue('event_title');
                const description = interaction.fields.getTextInputValue('event_description');
                const location = interaction.fields.getTextInputValue('event_location');
                const dateTimeStr = interaction.fields.getTextInputValue('event_datetime');
                const maxParticipants = interaction.fields.getTextInputValue('event_max_participants');
                
                // Получение ключей доступа, если они были введены
                let accessKeys = [];
                try {
                    // Проверяем, есть ли поле с ключами доступа
                    const accessKeysStr = interaction.fields.getTextInputValue('event_access_keys');
                    if (accessKeysStr && accessKeysStr.trim()) {
                        // Разбиваем строку по запятым и удаляем пробелы
                        accessKeys = accessKeysStr.split(',')
                            .map(key => key.trim())
                            .filter(key => key.length > 0);
                    }
                } catch (error) {
                    // Если поле не найдено, просто продолжаем без ключей
                    logger.info(`Поле ключей доступа не найдено: ${error.message}`);
                }
                
                // Валидация даты и времени
                const dateTime = new Date(dateTimeStr);
                
                if (isNaN(dateTime.getTime())) {
                    return interaction.reply({
                        content: '❌ Неверный формат даты и времени. Используйте формат YYYY-MM-DD HH:MM.',
                        ephemeral: true
                    });
                }
                
                if (dateTime < new Date()) {
                    return interaction.reply({
                        content: '❌ Дата и время мероприятия не могут быть в прошлом.',
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
                
                // Создание нового мероприятия
                const newEvent = new Event({
                    title,
                    description,
                    location,
                    dateTime,
                    maxParticipants: maxParticipantsNum,
                    createdBy: interaction.user.id,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    status: 'active',
                    participants: [],
                    waitlist: [],
                    // Добавляем ключи доступа
                    accessKeys: accessKeys,
                    distributedKeys: []
                });
                
                await newEvent.save();
                
                // Логирование создания мероприятия
                logger.info(`Администратор ${interaction.user.tag} (${interaction.user.id}) создал новое мероприятие: ${title}`);
                
                // Планирование напоминаний и автозакрытия мероприятия
                eventScheduler.scheduleEventReminders(newEvent);
                eventScheduler.scheduleEventClosure(newEvent);
                
                // Создание эмбеда с информацией о мероприятии
                const eventEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('Мероприятие успешно создано')
                    .addFields(
                        { name: 'Название', value: title, inline: false },
                        { name: 'Описание', value: description, inline: false },
                        { name: 'Место проведения', value: location, inline: true },
                        { name: 'Дата и время', value: dateTime.toLocaleString('ru-RU'), inline: true },
                        { name: 'Максимум участников', value: maxParticipants, inline: true }
                    )
                    .setFooter({ text: `ID мероприятия: ${newEvent._id}` })
                    .setTimestamp();
                
                // Создание кнопок для управления мероприятием
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('save_as_template')
                            .setLabel('Сохранить как шаблон')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('publish_event')
                            .setLabel('Опубликовать мероприятие')
                            .setStyle(ButtonStyle.Success)
                    );
                
                await interaction.reply({
                    content: '✅ Мероприятие успешно создано!',
                    embeds: [eventEmbed],
                    components: [row],
                    ephemeral: true
                });
                
            } else if (customId.startsWith('save_template_')) {
                // Извлечение ID мероприятия из customId
                const eventId = customId.replace('save_template_', '');
                
                // Получение значений из полей
                const templateName = interaction.fields.getTextInputValue('template_name');
                const templateDescription = interaction.fields.getTextInputValue('template_description');
                
                // Поиск мероприятия в базе данных
                const event = await Event.findById(eventId);
                
                if (!event) {
                    return interaction.reply({
                        content: '❌ Мероприятие не найдено.',
                        ephemeral: true
                    });
                }
                
                // Проверка, существует ли уже шаблон с таким именем
                const existingTemplate = await EventTemplate.findOne({ name: templateName });
                
                if (existingTemplate) {
                    return interaction.reply({
                        content: `❌ Шаблон с названием "${templateName}" уже существует.`,
                        ephemeral: true
                    });
                }
                
                // Создание нового шаблона
                const newTemplate = new EventTemplate({
                    name: templateName,
                    description: templateDescription,
                    title: event.title,
                    description: event.description,
                    location: event.location,
                    maxParticipants: event.maxParticipants,
                    createdBy: interaction.user.id,
                    createdAt: new Date()
                });
                
                await newTemplate.save();
                
                // Логирование создания шаблона
                logger.info(`Администратор ${interaction.user.tag} (${interaction.user.id}) создал новый шаблон мероприятия: ${templateName}`);
                
                await interaction.reply({
                    content: `✅ Шаблон "${templateName}" успешно сохранен!`,
                    ephemeral: true
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

// Функция для создания модального окна
function createEventModal(template = null) {
    const modal = new ModalBuilder()
        .setCustomId('create_event_modal')
        .setTitle('Создание нового мероприятия');
    
    const titleInput = new TextInputBuilder()
        .setCustomId('event_title')
        .setLabel('Название мероприятия')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Введите название мероприятия')
        .setValue(template ? template.title : '')
        .setRequired(true);
    
    const descriptionInput = new TextInputBuilder()
        .setCustomId('event_description')
        .setLabel('Описание мероприятия')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Введите описание мероприятия')
        .setValue(template ? template.description : '')
        .setRequired(true);
    
    const locationInput = new TextInputBuilder()
        .setCustomId('event_location')
        .setLabel('Место проведения')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Введите место проведения')
        .setValue(template ? template.location : '')
        .setRequired(true);
    
    const dateTimeInput = new TextInputBuilder()
        .setCustomId('event_datetime')
        .setLabel('Дата и время (YYYY-MM-DD HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Например: 2023-12-31 18:00')
        .setRequired(true);
    
    const maxParticipantsInput = new TextInputBuilder()
        .setCustomId('event_max_participants')
        .setLabel('Максимальное количество участников')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Введите число')
        .setValue(template ? template.maxParticipants.toString() : '50')
        .setRequired(true);
    
    // Поле для ввода ключей доступа
    const accessKeysInput = new TextInputBuilder()
        .setCustomId('event_access_keys')
        .setLabel('Ключи доступа (через запятую)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Введите ключи доступа через запятую или оставьте пустым')
        .setValue(template && template.accessKeys ? template.accessKeys.join(', ') : '')
        .setRequired(false);
    
    const firstRow = new ActionRowBuilder().addComponents(titleInput);
    const secondRow = new ActionRowBuilder().addComponents(descriptionInput);
    const thirdRow = new ActionRowBuilder().addComponents(locationInput);
    const fourthRow = new ActionRowBuilder().addComponents(dateTimeInput);
    const fifthRow = new ActionRowBuilder().addComponents(maxParticipantsInput);
    
    // Добавляем поле для ключей доступа, если в модальном окне есть место
    // Discord поддерживает максимум 5 полей в модальном окне
    // Если нужно больше полей, можно создать отдельное модальное окно для дополнительных настроек
    if (template && template.accessKeys) {
        // Если это шаблон с ключами, заменяем последнее поле на ключи
        modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, new ActionRowBuilder().addComponents(accessKeysInput));
    } else {
        // Иначе добавляем все поля
        modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow);
    }
    
    return modal;
}
