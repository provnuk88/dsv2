const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../database/models/User');
const Event = require('../../database/models/Event');
const Registration = require('../../database/models/Registration');
const AdminLog = require('../../database/models/AdminLog');
const logger = require('../../utils/logger');
const commandPermissions = require('../../utils/commandPermissions');
const webhookExporter = require('../../utils/webhookExporter');
const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('exportdata')
        .setDescription('Экспорт данных из бота')
        .addSubcommand(subcommand =>
            subcommand
                .setName('users')
                .setDescription('Экспорт данных пользователей')
                .addStringOption(option =>
                    option.setName('format')
                        .setDescription('Формат экспорта')
                        .setRequired(true)
                        .addChoices(
                            { name: 'CSV', value: 'csv' },
                            { name: 'JSON', value: 'json' }
                        ))
                .addStringOption(option =>
                    option.setName('webhook')
                        .setDescription('URL вебхука для отправки данных (опционально)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('events')
                .setDescription('Экспорт данных мероприятий')
                .addStringOption(option =>
                    option.setName('format')
                        .setDescription('Формат экспорта')
                        .setRequired(true)
                        .addChoices(
                            { name: 'CSV', value: 'csv' },
                            { name: 'JSON', value: 'json' }
                        ))
                .addStringOption(option =>
                    option.setName('webhook')
                        .setDescription('URL вебхука для отправки данных (опционально)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('registrations')
                .setDescription('Экспорт данных регистраций на мероприятия')
                .addStringOption(option =>
                    option.setName('format')
                        .setDescription('Формат экспорта')
                        .setRequired(true)
                        .addChoices(
                            { name: 'CSV', value: 'csv' },
                            { name: 'JSON', value: 'json' }
                        ))
                .addStringOption(option =>
                    option.setName('eventid')
                        .setDescription('ID мероприятия (опционально)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('webhook')
                        .setDescription('URL вебхука для отправки данных (опционально)')
                        .setRequired(false))),
    
    async execute(interaction) {
        try {
            // Проверка прав администратора
            if (!commandPermissions.hasAdminPermission(interaction.member)) {
                return interaction.reply({
                    content: '❌ У вас нет прав для использования этой команды.',
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });
            
            const subcommand = interaction.options.getSubcommand();
            const format = interaction.options.getString('format');
            const webhook = interaction.options.getString('webhook');
            
            switch (subcommand) {
                case 'users':
                    await this.exportUsers(interaction, format, webhook);
                    break;
                case 'events':
                    await this.exportEvents(interaction, format, webhook);
                    break;
                case 'registrations':
                    const eventId = interaction.options.getString('eventid');
                    await this.exportRegistrations(interaction, format, eventId, webhook);
                    break;
                default:
                    await interaction.editReply({
                        content: '❌ Неизвестная подкоманда.',
                        ephemeral: true
                    });
            }
            
        } catch (error) {
            logger.error(`Ошибка при выполнении команды exportdata: ${error.message}`);
            await interaction.editReply({
                content: '❌ Произошла ошибка при экспорте данных. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Экспорт данных пользователей
    async exportUsers(interaction, format, webhook) {
        try {
            // Получение всех пользователей
            const users = await User.find({}).sort({ registeredAt: -1 });
            
            if (users.length === 0) {
                return interaction.editReply({
                    content: '👥 Нет зарегистрированных пользователей для экспорта.',
                    ephemeral: true
                });
            }
            
            // Подготовка данных для экспорта
            const exportData = users.map(user => ({
                discordId: user.discordId,
                discordTag: user.discordTag,
                nickname: user.nickname || '',
                telegram: user.telegram || '',
                email: user.email || '',
                wallets: user.wallets.join(', '),
                registeredAt: new Date(user.registeredAt).toLocaleString('ru-RU'),
                updatedAt: user.updatedAt ? new Date(user.updatedAt).toLocaleString('ru-RU') : ''
            }));
            
            // Экспорт данных в выбранном формате
            const fileName = `users_export_${Date.now()}.${format}`;
            const filePath = path.join(__dirname, '..', '..', '..', 'exports', fileName);
            
            // Создание директории для экспорта, если она не существует
            const exportDir = path.join(__dirname, '..', '..', '..', 'exports');
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }
            
            if (format === 'csv') {
                // Экспорт в CSV
                const csvWriter = createObjectCsvWriter({
                    path: filePath,
                    header: [
                        { id: 'discordId', title: 'Discord ID' },
                        { id: 'discordTag', title: 'Discord Tag' },
                        { id: 'nickname', title: 'Никнейм' },
                        { id: 'telegram', title: 'Telegram' },
                        { id: 'email', title: 'Email' },
                        { id: 'wallets', title: 'Кошельки' },
                        { id: 'registeredAt', title: 'Дата регистрации' },
                        { id: 'updatedAt', title: 'Дата обновления' }
                    ]
                });
                
                await csvWriter.writeRecords(exportData);
            } else {
                // Экспорт в JSON
                fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
            }
            
            // Отправка данных через вебхук, если указан
            if (webhook) {
                try {
                    await webhookExporter.sendDataToWebhook(webhook, filePath, `Экспорт пользователей (${users.length})`);
                    
                    await interaction.editReply({
                        content: `✅ Данные пользователей успешно экспортированы и отправлены через вебхук!\nЭкспортировано ${users.length} пользователей.`,
                        ephemeral: true
                    });
                } catch (webhookError) {
                    logger.error(`Ошибка при отправке данных через вебхук: ${webhookError.message}`);
                    
                    // Отправка файла напрямую, если вебхук не сработал
                    await interaction.editReply({
                        content: `✅ Данные пользователей успешно экспортированы!\nЭкспортировано ${users.length} пользователей.\n❌ Не удалось отправить данные через вебхук: ${webhookError.message}`,
                        files: [filePath],
                        ephemeral: true
                    });
                }
            } else {
                // Отправка файла напрямую
                await interaction.editReply({
                    content: `✅ Данные пользователей успешно экспортированы!\nЭкспортировано ${users.length} пользователей.`,
                    files: [filePath],
                    ephemeral: true
                });
            }
            
            // Логирование экспорта данных
            logger.info(`Администратор ${interaction.user.tag} (${interaction.user.id}) экспортировал данные пользователей в формате ${format}`);
            
            // Создание записи в логе администратора
            const adminLog = new AdminLog({
                adminId: interaction.user.id,
                action: 'export_users',
                details: `Экспортировано ${users.length} пользователей в формате ${format}`,
                timestamp: new Date()
            });
            
            await adminLog.save();
            
        } catch (error) {
            logger.error(`Ошибка при экспорте данных пользователей: ${error.message}`);
            await interaction.editReply({
                content: '❌ Произошла ошибка при экспорте данных пользователей. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Экспорт данных мероприятий
    async exportEvents(interaction, format, webhook) {
        try {
            // Получение всех мероприятий
            const events = await Event.find({}).sort({ startDate: -1 });
            
            if (events.length === 0) {
                return interaction.editReply({
                    content: '📅 Нет мероприятий для экспорта.',
                    ephemeral: true
                });
            }
            
            // Подготовка данных для экспорта
            const exportData = events.map(event => ({
                id: event._id.toString(),
                title: event.title,
                description: event.description || '',
                location: event.location || '',
                startDate: new Date(event.startDate).toLocaleString('ru-RU'),
                endDate: event.endDate ? new Date(event.endDate).toLocaleString('ru-RU') : '',
                maxParticipants: event.maxParticipants || 'Не ограничено',
                status: event.status,
                createdBy: event.createdBy,
                createdAt: new Date(event.createdAt).toLocaleString('ru-RU'),
                updatedAt: event.updatedAt ? new Date(event.updatedAt).toLocaleString('ru-RU') : ''
            }));
            
            // Экспорт данных в выбранном формате
            const fileName = `events_export_${Date.now()}.${format}`;
            const filePath = path.join(__dirname, '..', '..', '..', 'exports', fileName);
            
            // Создание директории для экспорта, если она не существует
            const exportDir = path.join(__dirname, '..', '..', '..', 'exports');
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }
            
            if (format === 'csv') {
                // Экспорт в CSV
                const csvWriter = createObjectCsvWriter({
                    path: filePath,
                    header: [
                        { id: 'id', title: 'ID' },
                        { id: 'title', title: 'Название' },
                        { id: 'description', title: 'Описание' },
                        { id: 'location', title: 'Место проведения' },
                        { id: 'startDate', title: 'Дата начала' },
                        { id: 'endDate', title: 'Дата окончания' },
                        { id: 'maxParticipants', title: 'Максимум участников' },
                        { id: 'status', title: 'Статус' },
                        { id: 'createdBy', title: 'Создатель' },
                        { id: 'createdAt', title: 'Дата создания' },
                        { id: 'updatedAt', title: 'Дата обновления' }
                    ]
                });
                
                await csvWriter.writeRecords(exportData);
            } else {
                // Экспорт в JSON
                fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
            }
            
            // Отправка данных через вебхук, если указан
            if (webhook) {
                try {
                    await webhookExporter.sendDataToWebhook(webhook, filePath, `Экспорт мероприятий (${events.length})`);
                    
                    await interaction.editReply({
                        content: `✅ Данные мероприятий успешно экспортированы и отправлены через вебхук!\nЭкспортировано ${events.length} мероприятий.`,
                        ephemeral: true
                    });
                } catch (webhookError) {
                    logger.error(`Ошибка при отправке данных через вебхук: ${webhookError.message}`);
                    
                    // Отправка файла напрямую, если вебхук не сработал
                    await interaction.editReply({
                        content: `✅ Данные мероприятий успешно экспортированы!\nЭкспортировано ${events.length} мероприятий.\n❌ Не удалось отправить данные через вебхук: ${webhookError.message}`,
                        files: [filePath],
                        ephemeral: true
                    });
                }
            } else {
                // Отправка файла напрямую
                await interaction.editReply({
                    content: `✅ Данные мероприятий успешно экспортированы!\nЭкспортировано ${events.length} мероприятий.`,
                    files: [filePath],
                    ephemeral: true
                });
            }
            
            // Логирование экспорта данных
            logger.info(`Администратор ${interaction.user.tag} (${interaction.user.id}) экспортировал данные мероприятий в формате ${format}`);
            
            // Создание записи в логе администратора
            const adminLog = new AdminLog({
                adminId: interaction.user.id,
                action: 'export_events',
                details: `Экспортировано ${events.length} мероприятий в формате ${format}`,
                timestamp: new Date()
            });
            
            await adminLog.save();
            
        } catch (error) {
            logger.error(`Ошибка при экспорте данных мероприятий: ${error.message}`);
            await interaction.editReply({
                content: '❌ Произошла ошибка при экспорте данных мероприятий. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Экспорт данных регистраций на мероприятия
    async exportRegistrations(interaction, format, eventId, webhook) {
        try {
            // Подготовка запроса для поиска регистраций
            const query = eventId ? { eventId } : {};
            
            // Получение регистраций
            const registrations = await Registration.find(query).sort({ registeredAt: -1 });
            
            if (registrations.length === 0) {
                return interaction.editReply({
                    content: '📝 Нет регистраций для экспорта.',
                    ephemeral: true
                });
            }
            
            // Получение информации о пользователях и мероприятиях для обогащения данных
            const userIds = [...new Set(registrations.map(reg => reg.userId))];
            const eventIds = [...new Set(registrations.map(reg => reg.eventId))];
            
            const users = await User.find({ discordId: { $in: userIds } });
            const events = await Event.find({ _id: { $in: eventIds } });
            
            // Создание словарей для быстрого доступа
            const userMap = new Map(users.map(user => [user.discordId, user]));
            const eventMap = new Map(events.map(event => [event._id.toString(), event]));
            
            // Подготовка данных для экспорта
            const exportData = registrations.map(reg => {
                const user = userMap.get(reg.userId);
                const event = eventMap.get(reg.eventId);
                
                return {
                    id: reg._id.toString(),
                    userId: reg.userId,
                    userNickname: user ? user.nickname || user.discordTag : 'Неизвестный пользователь',
                    userTelegram: user ? user.telegram || '' : '',
                    userEmail: user ? user.email || '' : '',
                    userWallets: user ? user.wallets.join(', ') : '',
                    eventId: reg.eventId,
                    eventTitle: event ? event.title : 'Неизвестное мероприятие',
                    eventStartDate: event ? new Date(event.startDate).toLocaleString('ru-RU') : '',
                    status: reg.status,
                    registeredAt: new Date(reg.registeredAt).toLocaleString('ru-RU'),
                    updatedAt: reg.updatedAt ? new Date(reg.updatedAt).toLocaleString('ru-RU') : '',
                    notes: reg.notes || ''
                };
            });
            
            // Экспорт данных в выбранном формате
            const fileName = `registrations_export_${Date.now()}.${format}`;
            const filePath = path.join(__dirname, '..', '..', '..', 'exports', fileName);
            
            // Создание директории для экспорта, если она не существует
            const exportDir = path.join(__dirname, '..', '..', '..', 'exports');
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }
            
            if (format === 'csv') {
                // Экспорт в CSV
                const csvWriter = createObjectCsvWriter({
                    path: filePath,
                    header: [
                        { id: 'id', title: 'ID' },
                        { id: 'userId', title: 'ID пользователя' },
                        { id: 'userNickname', title: 'Никнейм пользователя' },
                        { id: 'userTelegram', title: 'Telegram пользователя' },
                        { id: 'userEmail', title: 'Email пользователя' },
                        { id: 'userWallets', title: 'Кошельки пользователя' },
                        { id: 'eventId', title: 'ID мероприятия' },
                        { id: 'eventTitle', title: 'Название мероприятия' },
                        { id: 'eventStartDate', title: 'Дата начала мероприятия' },
                        { id: 'status', title: 'Статус' },
                        { id: 'registeredAt', title: 'Дата регистрации' },
                        { id: 'updatedAt', title: 'Дата обновления' },
                        { id: 'notes', title: 'Примечания' }
                    ]
                });
                
                await csvWriter.writeRecords(exportData);
            } else {
                // Экспорт в JSON
                fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
            }
            
            // Отправка данных через вебхук, если указан
            if (webhook) {
                try {
                    await webhookExporter.sendDataToWebhook(webhook, filePath, `Экспорт регистраций (${registrations.length})`);
                    
                    await interaction.editReply({
                        content: `✅ Данные регистраций успешно экспортированы и отправлены через вебхук!\nЭкспортировано ${registrations.length} регистраций.`,
                        ephemeral: true
                    });
                } catch (webhookError) {
                    logger.error(`Ошибка при отправке данных через вебхук: ${webhookError.message}`);
                    
                    // Отправка файла напрямую, если вебхук не сработал
                    await interaction.editReply({
                        content: `✅ Данные регистраций успешно экспортированы!\nЭкспортировано ${registrations.length} регистраций.\n❌ Не удалось отправить данные через вебхук: ${webhookError.message}`,
                        files: [filePath],
                        ephemeral: true
                    });
                }
            } else {
                // Отправка файла напрямую
                await interaction.editReply({
                    content: `✅ Данные регистраций успешно экспортированы!\nЭкспортировано ${registrations.length} регистраций.`,
                    files: [filePath],
                    ephemeral: true
                });
            }
            
            // Логирование экспорта данных
            logger.info(`Администратор ${interaction.user.tag} (${interaction.user.id}) экспортировал данные регистраций в формате ${format}`);
            
            // Создание записи в логе администратора
            const adminLog = new AdminLog({
                adminId: interaction.user.id,
                action: 'export_registrations',
                details: `Экспортировано ${registrations.length} регистраций в формате ${format}`,
                timestamp: new Date()
            });
            
            await adminLog.save();
            
        } catch (error) {
            logger.error(`Ошибка при экспорте данных регистраций: ${error.message}`);
            await interaction.editReply({
                content: '❌ Произошла ошибка при экспорте данных регистраций. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    }
};
