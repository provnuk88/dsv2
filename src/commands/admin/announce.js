const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Event = require('../../database/models/Event');
const Registration = require('../../database/models/Registration');
const AdminLog = require('../../database/models/AdminLog');
const logger = require('../../utils/logger');
const commandPermissions = require('../../utils/commandPermissions');
const announcementScheduler = require('../../utils/announcementScheduler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Управление объявлениями')
        .addSubcommand(subcommand =>
            subcommand
                .setName('send')
                .setDescription('Отправить объявление')
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Заголовок объявления')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Текст объявления')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('channel')
                        .setDescription('ID канала для отправки (опционально)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Цвет объявления (HEX, например: #FF0000)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('schedule')
                .setDescription('Запланировать объявление')
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Заголовок объявления')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Текст объявления')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('datetime')
                        .setDescription('Дата и время отправки (формат: DD.MM.YYYY HH:MM)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('channel')
                        .setDescription('ID канала для отправки (опционально)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Цвет объявления (HEX, например: #FF0000)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Показать список запланированных объявлений'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancel')
                .setDescription('Отменить запланированное объявление')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID запланированного объявления')
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
                case 'send':
                    await this.sendAnnouncement(interaction);
                    break;
                case 'schedule':
                    await this.scheduleAnnouncement(interaction);
                    break;
                case 'list':
                    await this.listScheduledAnnouncements(interaction);
                    break;
                case 'cancel':
                    await this.cancelScheduledAnnouncement(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Неизвестная подкоманда.',
                        ephemeral: true
                    });
            }
            
        } catch (error) {
            logger.error(`Ошибка при выполнении команды announce: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при управлении объявлениями. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Отправка объявления
    async sendAnnouncement(interaction) {
        try {
            const title = interaction.options.getString('title');
            const message = interaction.options.getString('message');
            const channelId = interaction.options.getString('channel') || interaction.channelId;
            const color = interaction.options.getString('color') || '#0099FF';
            
            // Проверка существования канала
            const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
            
            if (!channel) {
                return interaction.reply({
                    content: `❌ Канал с ID ${channelId} не найден.`,
                    ephemeral: true
                });
            }
            
            // Проверка прав на отправку сообщений в канал
            if (!channel.permissionsFor(interaction.guild.members.me).has('SendMessages')) {
                return interaction.reply({
                    content: `❌ У бота нет прав на отправку сообщений в канал <#${channelId}>.`,
                    ephemeral: true
                });
            }
            
            // Создание эмбеда для объявления
            const announcementEmbed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(message)
                .setFooter({ text: `Объявление от ${interaction.user.tag}` })
                .setTimestamp();
            
            // Отправка объявления
            await channel.send({ embeds: [announcementEmbed] });
            
            // Логирование отправки объявления
            logger.info(`Администратор ${interaction.user.tag} (${interaction.user.id}) отправил объявление в канал ${channel.name} (${channelId})`);
            
            // Создание записи в логе администратора
            const adminLog = new AdminLog({
                adminId: interaction.user.id,
                action: 'send_announcement',
                details: `Отправлено объявление "${title}" в канал ${channel.name} (${channelId})`,
                timestamp: new Date()
            });
            
            await adminLog.save();
            
            await interaction.reply({
                content: `✅ Объявление успешно отправлено в канал <#${channelId}>!`,
                ephemeral: true
            });
            
        } catch (error) {
            logger.error(`Ошибка при отправке объявления: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при отправке объявления. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Планирование объявления
    async scheduleAnnouncement(interaction) {
        try {
            const title = interaction.options.getString('title');
            const message = interaction.options.getString('message');
            const datetimeStr = interaction.options.getString('datetime');
            const channelId = interaction.options.getString('channel') || interaction.channelId;
            const color = interaction.options.getString('color') || '#0099FF';
            
            // Проверка существования канала
            const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
            
            if (!channel) {
                return interaction.reply({
                    content: `❌ Канал с ID ${channelId} не найден.`,
                    ephemeral: true
                });
            }
            
            // Проверка прав на отправку сообщений в канал
            if (!channel.permissionsFor(interaction.guild.members.me).has('SendMessages')) {
                return interaction.reply({
                    content: `❌ У бота нет прав на отправку сообщений в канал <#${channelId}>.`,
                    ephemeral: true
                });
            }
            
            // Парсинг даты и времени
            const [datePart, timePart] = datetimeStr.split(' ');
            if (!datePart || !timePart) {
                return interaction.reply({
                    content: '❌ Неверный формат даты и времени. Используйте формат: DD.MM.YYYY HH:MM',
                    ephemeral: true
                });
            }
            
            const [day, month, year] = datePart.split('.');
            const [hours, minutes] = timePart.split(':');
            
            // Создание объекта даты
            const scheduledDate = new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hours),
                parseInt(minutes)
            );
            
            // Проверка валидности даты
            if (isNaN(scheduledDate.getTime())) {
                return interaction.reply({
                    content: '❌ Неверный формат даты и времени. Используйте формат: DD.MM.YYYY HH:MM',
                    ephemeral: true
                });
            }
            
            // Проверка, что дата в будущем
            if (scheduledDate <= new Date()) {
                return interaction.reply({
                    content: '❌ Дата и время должны быть в будущем.',
                    ephemeral: true
                });
            }
            
            // Планирование объявления
            const scheduledAnnouncement = await announcementScheduler.scheduleAnnouncement({
                guildId: interaction.guildId,
                channelId: channelId,
                title: title,
                message: message,
                color: color,
                scheduledDate: scheduledDate,
                createdBy: interaction.user.id
            });
            
            // Логирование планирования объявления
            logger.info(`Администратор ${interaction.user.tag} (${interaction.user.id}) запланировал объявление на ${scheduledDate.toLocaleString('ru-RU')} в канал ${channel.name} (${channelId})`);
            
            // Создание записи в логе администратора
            const adminLog = new AdminLog({
                adminId: interaction.user.id,
                action: 'schedule_announcement',
                details: `Запланировано объявление "${title}" на ${scheduledDate.toLocaleString('ru-RU')} в канал ${channel.name} (${channelId})`,
                timestamp: new Date()
            });
            
            await adminLog.save();
            
            // Создание эмбеда с информацией о запланированном объявлении
            const confirmationEmbed = new EmbedBuilder()
                .setColor(color)
                .setTitle('Объявление запланировано')
                .setDescription(`Объявление будет отправлено ${scheduledDate.toLocaleString('ru-RU')} в канал <#${channelId}>`)
                .addFields(
                    { name: 'ID объявления', value: scheduledAnnouncement._id.toString(), inline: true },
                    { name: 'Заголовок', value: title, inline: true },
                    { name: 'Сообщение', value: message }
                )
                .setFooter({ text: 'Synergy Guild Bot' })
                .setTimestamp();
            
            await interaction.reply({
                embeds: [confirmationEmbed],
                ephemeral: true
            });
            
        } catch (error) {
            logger.error(`Ошибка при планировании объявления: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при планировании объявления. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Список запланированных объявлений
    async listScheduledAnnouncements(interaction) {
        try {
            // Получение всех запланированных объявлений для текущего сервера
            const scheduledAnnouncements = await announcementScheduler.getScheduledAnnouncements(interaction.guildId);
            
            if (scheduledAnnouncements.length === 0) {
                return interaction.reply({
                    content: '📢 Нет запланированных объявлений.',
                    ephemeral: true
                });
            }
            
            // Создание эмбеда для списка запланированных объявлений
            const announcementsEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Запланированные объявления')
                .setDescription(`Всего запланировано: ${scheduledAnnouncements.length} объявлений`)
                .setFooter({ text: 'Synergy Guild Bot' })
                .setTimestamp();
            
            // Добавление информации о каждом запланированном объявлении
            for (const announcement of scheduledAnnouncements) {
                announcementsEmbed.addFields({
                    name: `ID: ${announcement._id}`,
                    value: `**${announcement.title}**\nКанал: <#${announcement.channelId}>\nДата: ${new Date(announcement.scheduledDate).toLocaleString('ru-RU')}\nСоздатель: <@${announcement.createdBy}>`
                });
            }
            
            // Создание кнопок для управления запланированными объявлениями
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('refresh_announcements')
                        .setLabel('Обновить список')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('cancel_announcement_prompt')
                        .setLabel('Отменить объявление')
                        .setStyle(ButtonStyle.Danger)
                );
            
            await interaction.reply({
                embeds: [announcementsEmbed],
                components: [row],
                ephemeral: true
            });
            
        } catch (error) {
            logger.error(`Ошибка при получении списка запланированных объявлений: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при получении списка запланированных объявлений. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Отмена запланированного объявления
    async cancelScheduledAnnouncement(interaction) {
        try {
            const announcementId = interaction.options.getString('id');
            
            // Отмена запланированного объявления
            const result = await announcementScheduler.cancelAnnouncement(announcementId, interaction.guildId);
            
            if (!result) {
                return interaction.reply({
                    content: `❌ Запланированное объявление с ID ${announcementId} не найдено или не принадлежит этому серверу.`,
                    ephemeral: true
                });
            }
            
            // Логирование отмены запланированного объявления
            logger.info(`Администратор ${interaction.user.tag} (${interaction.user.id}) отменил запланированное объявление с ID ${announcementId}`);
            
            // Создание записи в логе администратора
            const adminLog = new AdminLog({
                adminId: interaction.user.id,
                action: 'cancel_announcement',
                details: `Отменено запланированное объявление с ID ${announcementId}`,
                timestamp: new Date()
            });
            
            await adminLog.save();
            
            await interaction.reply({
                content: `✅ Запланированное объявление с ID ${announcementId} успешно отменено!`,
                ephemeral: true
            });
            
        } catch (error) {
            logger.error(`Ошибка при отмене запланированного объявления: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при отмене запланированного объявления. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Обработчик кнопок
    async handleButton(interaction) {
        try {
            const customId = interaction.customId;
            
            // Обработка кнопки обновления списка запланированных объявлений
            if (customId === 'refresh_announcements') {
                // Получение всех запланированных объявлений для текущего сервера
                const scheduledAnnouncements = await announcementScheduler.getScheduledAnnouncements(interaction.guildId);
                
                if (scheduledAnnouncements.length === 0) {
                    return interaction.update({
                        content: '📢 Нет запланированных объявлений.',
                        embeds: [],
                        components: [],
                        ephemeral: true
                    });
                }
                
                // Создание эмбеда для списка запланированных объявлений
                const announcementsEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('Запланированные объявления')
                    .setDescription(`Всего запланировано: ${scheduledAnnouncements.length} объявлений`)
                    .setFooter({ text: 'Synergy Guild Bot' })
                    .setTimestamp();
                
                // Добавление информации о каждом запланированном объявлении
                for (const announcement of scheduledAnnouncements) {
                    announcementsEmbed.addFields({
                        name: `ID: ${announcement._id}`,
                        value: `**${announcement.title}**\nКанал: <#${announcement.channelId}>\nДата: ${new Date(announcement.scheduledDate).toLocaleString('ru-RU')}\nСоздатель: <@${announcement.createdBy}>`
                    });
                }
                
                // Создание кнопок для управления запланированными объявлениями
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('refresh_announcements')
                            .setLabel('Обновить список')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('cancel_announcement_prompt')
                            .setLabel('Отменить объявление')
                            .setStyle(ButtonStyle.Danger)
                    );
                
                await interaction.update({
                    embeds: [announcementsEmbed],
                    components: [row],
                    ephemeral: true
                });
            }
            
            // Обработка кнопки запроса отмены запланированного объявления
            else if (customId === 'cancel_announcement_prompt') {
                // Создание модального окна для ввода ID объявления
                const modal = new ModalBuilder()
                    .setCustomId('cancel_announcement_modal')
                    .setTitle('Отмена запланированного объявления');
                
                const announcementIdInput = new TextInputBuilder()
                    .setCustomId('announcement_id')
                    .setLabel('ID объявления')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Введите ID объявления для отмены')
                    .setRequired(true);
                
                const firstRow = new ActionRowBuilder().addComponents(announcementIdInput);
                
                modal.addComponents(firstRow);
                
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
            
            // Обработка модального окна отмены запланированного объявления
            if (customId === 'cancel_announcement_modal') {
                const announcementId = interaction.fields.getTextInputValue('announcement_id');
                
                // Отмена запланированного объявления
                const result = await announcementScheduler.cancelAnnouncement(announcementId, interaction.guildId);
                
                if (!result) {
                    return interaction.reply({
                        content: `❌ Запланированное объявление с ID ${announcementId} не найдено или не принадлежит этому серверу.`,
                        ephemeral: true
                    });
                }
                
                // Логирование отмены запланированного объявления
                logger.info(`Администратор ${interaction.user.tag} (${interaction.user.id}) отменил запланированное объявление с ID ${announcementId}`);
                
                // Создание записи в логе администратора
                const adminLog = new AdminLog({
                    adminId: interaction.user.id,
                    action: 'cancel_announcement',
                    details: `Отменено запланированное объявление с ID ${announcementId}`,
                    timestamp: new Date()
                });
                
                await adminLog.save();
                
                await interaction.reply({
                    content: `✅ Запланированное объявление с ID ${announcementId} успешно отменено!`,
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
