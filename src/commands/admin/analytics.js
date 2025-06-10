/**
 * Команда аналитики для администраторов
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const AnalyticsManager = require('../../utils/analyticsManager');
const Middleware = require('../../middleware');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('analytics')
        .setDescription('Показывает аналитику мероприятий и пользователей (только для администраторов)'),
    
    async execute(interaction) {
        try {
            // Проверка на превышение лимита запросов
            await Middleware.rateLimit(interaction);
            
            // Проверка прав администратора
            await Middleware.requireAdmin(interaction);
            
            // Отложенный ответ для длительных операций
            await interaction.deferReply({ ephemeral: true });
            
            // Получаем общую статистику гильдии
            const guildStats = await AnalyticsManager.getGuildStats();
            
            if (!guildStats) {
                return await interaction.editReply('Не удалось загрузить аналитику. Пожалуйста, попробуйте позже.');
            }
            
            // Создаем эмбед с основной информацией
            const embed = this.createMainAnalyticsEmbed(guildStats);
            
            // Создаем кнопки для навигации
            const actionRow = this.createActionButtons();
            
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
                logger.error(`Error in analytics command: ${error.message}`);
                
                // Отправляем сообщение об ошибке, если еще не ответили
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: 'Произошла ошибка при загрузке аналитики. Пожалуйста, попробуйте позже.', 
                        ephemeral: true 
                    });
                } else if (interaction.deferred) {
                    await interaction.editReply({ 
                        content: 'Произошла ошибка при загрузке аналитики. Пожалуйста, попробуйте позже.' 
                    });
                }
            }
        }
    },
    
    /**
     * Создает эмбед с основной аналитикой
     * @param {Object} guildStats - Статистика гильдии
     * @returns {EmbedBuilder} Эмбед с информацией
     */
    createMainAnalyticsEmbed(guildStats) {
        const embed = new EmbedBuilder()
            .setColor('#2196F3')
            .setTitle('📊 Аналитика Synergy Guild')
            .setDescription('Общая статистика гильдии и мероприятий')
            .addFields(
                { 
                    name: '👥 Пользователи', 
                    value: [
                        `Всего: **${guildStats.totalUsers}**`,
                        `Новых за 7 дней: **${guildStats.newUsers}**`,
                        `Активных за 30 дней: **${guildStats.activeUsers}**`
                    ].join('\n'),
                    inline: true
                },
                { 
                    name: '📅 Мероприятия', 
                    value: [
                        `Всего: **${guildStats.totalEvents}**`,
                        `Активных: **${guildStats.activeEvents}**`,
                        `Средняя заполняемость: **${guildStats.averageFillRate}%**`
                    ].join('\n'),
                    inline: true
                },
                { 
                    name: '🎟️ Регистрации', 
                    value: [
                        `Всего: **${guildStats.totalRegistrations}**`,
                        `Подтвержденных: **${guildStats.confirmedRegistrations}**`,
                        `В листе ожидания: **${guildStats.waitlistRegistrations}**`,
                        `Завершенных: **${guildStats.completedRegistrations}**`,
                        `Отмененных: **${guildStats.cancelledRegistrations}**`
                    ].join('\n')
                }
            )
            .setFooter({ 
                text: `Данные обновлены: ${new Date(guildStats.timestamp).toLocaleString()}` 
            });
            
        return embed;
    },
    
    /**
     * Создает кнопки для навигации по аналитике
     * @returns {ActionRowBuilder} Строка с кнопками
     */
    createActionButtons() {
        const actionRow = new ActionRowBuilder();
        
        // Кнопка просмотра типов мероприятий
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId('analytics_event_types')
                .setLabel('Типы мероприятий')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📊')
        );
        
        // Кнопка просмотра активности пользователей
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId('analytics_user_activity')
                .setLabel('Активность')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('👥')
        );
        
        // Кнопка просмотра конверсии
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId('analytics_conversion')
                .setLabel('Конверсия')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📈')
        );
        
        // Кнопка прогноза посещаемости
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId('analytics_forecast')
                .setLabel('Прогноз')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔮')
        );
        
        // Кнопка экспорта данных
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId('analytics_export')
                .setLabel('Экспорт')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📤')
        );
        
        return actionRow;
    },
    
    /**
     * Обработчик кнопки просмотра типов мероприятий
     * @param {Object} interaction - Объект взаимодействия
     */
    async handleEventTypes(interaction) {
        try {
            // Проверка на превышение лимита запросов
            await Middleware.rateLimit(interaction);
            
            // Проверка прав администратора
            await Middleware.requireAdmin(interaction);
            
            // Отложенный ответ для длительных операций
            await interaction.deferUpdate();
            
            // Получаем статистику по типам мероприятий
            const eventTypeStats = await AnalyticsManager.getEventTypeStats();
            
            if (!eventTypeStats) {
                return await interaction.editReply('Не удалось загрузить статистику типов мероприятий. Пожалуйста, попробуйте позже.');
            }
            
            // Создаем эмбед с информацией о типах мероприятий
            const embed = new EmbedBuilder()
                .setColor('#4CAF50')
                .setTitle('📊 Типы мероприятий')
                .setDescription('Статистика по различным типам мероприятий');
            
            // Добавляем информацию о количестве мероприятий по типам
            const typeCounts = eventTypeStats.typeCounts;
            const typeCountsText = Object.entries(typeCounts)
                .map(([type, count]) => {
                    const emoji = this.getTypeEmoji(type);
                    const typeName = this.getTypeName(type);
                    return `${emoji} **${typeName}**: ${count}`;
                })
                .join('\n');
            
            embed.addFields({ name: '📅 Количество мероприятий', value: typeCountsText });
            
            // Добавляем информацию о регистрациях по типам
            const typeRegistrations = eventTypeStats.typeRegistrations;
            const typeRegistrationsText = Object.entries(typeRegistrations)
                .map(([type, count]) => {
                    const emoji = this.getTypeEmoji(type);
                    const typeName = this.getTypeName(type);
                    return `${emoji} **${typeName}**: ${count}`;
                })
                .join('\n');
            
            embed.addFields({ name: '🎟️ Количество регистраций', value: typeRegistrationsText });
            
            // Добавляем информацию о заполняемости по типам
            const typeFillRates = eventTypeStats.typeFillRatePercents;
            const typeFillRatesText = Object.entries(typeFillRates)
                .map(([type, rate]) => {
                    const emoji = this.getTypeEmoji(type);
                    const typeName = this.getTypeName(type);
                    return `${emoji} **${typeName}**: ${rate}%`;
                })
                .join('\n');
            
            embed.addFields({ name: '📈 Заполняемость', value: typeFillRatesText });
            
            // Добавляем информацию о времени обновления данных
            embed.setFooter({ 
                text: `Данные обновлены: ${new Date(eventTypeStats.timestamp).toLocaleString()}` 
            });
            
            // Создаем кнопку возврата к основной аналитике
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('analytics_main')
                        .setLabel('Назад к общей аналитике')
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
                logger.error(`Error in analytics event types: ${error.message}`);
                
                await interaction.editReply({ 
                    content: 'Произошла ошибка при загрузке статистики типов мероприятий. Пожалуйста, попробуйте позже.',
                    components: []
                });
            }
        }
    },
    
    /**
     * Обработчик кнопки просмотра активности пользователей
     * @param {Object} interaction - Объект взаимодействия
     */
    async handleUserActivity(interaction) {
        try {
            // Проверка на превышение лимита запросов
            await Middleware.rateLimit(interaction);
            
            // Проверка прав администратора
            await Middleware.requireAdmin(interaction);
            
            // Отложенный ответ для длительных операций
            await interaction.deferUpdate();
            
            // Получаем статистику активности пользователей
            const userActivityStats = await AnalyticsManager.getUserActivityStats();
            
            if (!userActivityStats) {
                return await interaction.editReply('Не удалось загрузить статистику активности пользователей. Пожалуйста, попробуйте позже.');
            }
            
            // Создаем эмбед с информацией об активности пользователей
            const embed = new EmbedBuilder()
                .setColor('#FF9800')
                .setTitle('👥 Активность пользователей')
                .setDescription('Статистика активности пользователей гильдии');
            
            // Добавляем информацию об уровнях активности
            const activityLevels = userActivityStats.activityLevels;
            const activityPercentages = userActivityStats.activityPercentages;
            
            const activityText = [
                `🔴 **Неактивные (0)**: ${activityLevels.inactive} (${activityPercentages.inactive}%)`,
                `🟠 **Новички (1)**: ${activityLevels.newcomer} (${activityPercentages.newcomer}%)`,
                `🟡 **Активные (2-4)**: ${activityLevels.active} (${activityPercentages.active}%)`,
                `🟢 **Постоянные (5-9)**: ${activityLevels.regular} (${activityPercentages.regular}%)`,
                `🔵 **Легенды (10+)**: ${activityLevels.legend} (${activityPercentages.legend}%)`
            ].join('\n');
            
            embed.addFields({ name: '📊 Уровни активности', value: activityText });
            
            // Добавляем информацию о достижениях
            const achievementCounts = userActivityStats.achievementCounts;
            
            if (Object.keys(achievementCounts).length > 0) {
                const achievementText = Object.entries(achievementCounts)
                    .map(([name, count]) => {
                        const achievementInfo = this.getAchievementInfo(name);
                        return `${achievementInfo.icon} **${achievementInfo.name}**: ${count}`;
                    })
                    .join('\n');
                
                embed.addFields({ name: '🏆 Достижения', value: achievementText });
            }
            
            // Добавляем информацию о временной активности
            const timeStats = userActivityStats.timeStats;
            const timeStatsText = [
                `⏰ **За последние 24 часа**: ${timeStats.lastDay} пользователей`,
                `📅 **За последнюю неделю**: ${timeStats.lastWeek} пользователей`,
                `📆 **За последний месяц**: ${timeStats.lastMonth} пользователей`
            ].join('\n');
            
            embed.addFields({ name: '⏱️ Временная активность', value: timeStatsText });
            
            // Добавляем информацию о времени обновления данных
            embed.setFooter({ 
                text: `Данные обновлены: ${new Date(userActivityStats.timestamp).toLocaleString()}` 
            });
            
            // Создаем кнопку возврата к основной аналитике
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('analytics_main')
                        .setLabel('Назад к общей аналитике')
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
                logger.error(`Error in analytics user activity: ${error.message}`);
                
                await interaction.editReply({ 
                    content: 'Произошла ошибка при загрузке статистики активности пользователей. Пожалуйста, попробуйте позже.',
                    components: []
                });
            }
        }
    },
    
    /**
     * Обработчик кнопки просмотра конверсии
     * @param {Object} interaction - Объект взаимодействия
     */
    async handleConversion(interaction) {
        try {
            // Проверка на превышение лимита запросов
            await Middleware.rateLimit(interaction);
            
            // Проверка прав администратора
            await Middleware.requireAdmin(interaction);
            
            // Отложенный ответ для длительных операций
            await interaction.deferUpdate();
            
            // Получаем статистику конверсии
            const conversionStats = await AnalyticsManager.getRegistrationConversionStats();
            
            if (!conversionStats) {
                return await interaction.editReply('Не удалось загрузить статистику конверсии. Пожалуйста, попробуйте позже.');
            }
            
            // Создаем эмбед с информацией о конверсии
            const embed = new EmbedBuilder()
                .setColor('#9C27B0')
                .setTitle('📈 Конверсия регистраций')
                .setDescription('Статистика конверсии регистраций на мероприятия');
            
            // Добавляем информацию об общей конверсии
            const overallConversion = conversionStats.overallConversion;
            const overallText = [
                `🔄 **Из листа ожидания в подтвержденные**: ${overallConversion.waitlistToConfirmed}%`,
                `✅ **Из подтвержденных в завершенные**: ${overallConversion.confirmedToCompleted}%`,
                `❌ **Процент отмен**: ${overallConversion.cancellationRate}%`
            ].join('\n');
            
            embed.addFields({ name: '📊 Общая конверсия', value: overallText });
            
            // Добавляем информацию о конверсии по мероприятиям
            const eventConversions = conversionStats.eventConversions;
            
            if (Object.keys(eventConversions).length > 0) {
                // Сортируем мероприятия по конверсии (от большей к меньшей)
                const sortedEvents = Object.entries(eventConversions)
                    .sort((a, b) => b[1].confirmedToCompleted - a[1].confirmedToCompleted)
                    .slice(0, 5); // Берем топ-5 мероприятий
                
                const eventsText = sortedEvents
                    .map(([eventId, data]) => {
                        return [
                            `**${data.title}**`,
                            `🔄 Из листа ожидания: ${data.waitlistToConfirmed}%`,
                            `✅ Посещаемость: ${data.confirmedToCompleted}%`,
                            `❌ Отмены: ${data.cancellationRate}%`
                        ].join('\n');
                    })
                    .join('\n\n');
                
                embed.addFields({ name: '🏆 Топ-5 мероприятий по конверсии', value: eventsText });
            }
            
            // Добавляем информацию о времени обновления данных
            embed.setFooter({ 
                text: `Данные обновлены: ${new Date(conversionStats.timestamp).toLocaleString()}` 
            });
            
            // Создаем кнопку возврата к основной аналитике
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('analytics_main')
                        .setLabel('Назад к общей аналитике')
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
                logger.error(`Error in analytics conversion: ${error.message}`);
                
                await interaction.editReply({ 
                    content: 'Произошла ошибка при загрузке статистики конверсии. Пожалуйста, попробуйте позже.',
                    components: []
                });
            }
        }
    },
    
    /**
     * Обработчик кнопки просмотра прогноза
     * @param {Object} interaction - Объект взаимодействия
     */
    async handleForecast(interaction) {
        try {
            // Проверка на превышение лимита запросов
            await Middleware.rateLimit(interaction);
            
            // Проверка прав администратора
            await Middleware.requireAdmin(interaction);
            
            // Отложенный ответ для длительных операций
            await interaction.deferUpdate();
            
            // Получаем прогноз посещаемости
            const forecastData = await AnalyticsManager.getAttendanceForecast();
            
            if (!forecastData) {
                return await interaction.editReply('Не удалось загрузить прогноз посещаемости. Пожалуйста, попробуйте позже.');
            }
            
            // Создаем эмбед с информацией о прогнозе
            const embed = new EmbedBuilder()
                .setColor('#00BCD4')
                .setTitle('🔮 Прогноз посещаемости')
                .setDescription('Прогноз посещаемости предстоящих мероприятий');
            
            // Добавляем информацию о средней посещаемости по типам
            const avgTypeAttendanceRates = forecastData.avgTypeAttendanceRates;
            const avgRatesText = Object.entries(avgTypeAttendanceRates)
                .map(([type, rate]) => {
                    const emoji = this.getTypeEmoji(type);
                    const typeName = this.getTypeName(type);
                    return `${emoji} **${typeName}**: ${rate}%`;
                })
                .join('\n');
            
            embed.addFields({ name: '📊 Средняя посещаемость по типам', value: avgRatesText });
            
            // Добавляем информацию о прогнозе для предстоящих мероприятий
            const forecasts = forecastData.forecasts;
            
            if (forecasts.length > 0) {
                const forecastsText = forecasts
                    .map(forecast => {
                        const startTime = Math.floor(new Date(forecast.startDate).getTime() / 1000);
                        return [
                            `**${forecast.title}**`,
                            `📅 Дата: <t:${startTime}:D>`,
                            `👥 Зарегистрировано: ${forecast.registeredCount}`,
                            `🔮 Ожидаемая посещаемость: ${forecast.expectedAttendanceRate}%`,
                            `✅ Ожидаемое количество участников: ${forecast.expectedAttendees}`
                        ].join('\n');
                    })
                    .join('\n\n');
                
                embed.addFields({ name: '🗓️ Прогноз для предстоящих мероприятий', value: forecastsText });
            } else {
                embed.addFields({ name: '🗓️ Прогноз для предстоящих мероприятий', value: 'Нет предстоящих мероприятий' });
            }
            
            // Добавляем информацию о времени обновления данных
            embed.setFooter({ 
                text: `Данные обновлены: ${new Date(forecastData.timestamp).toLocaleString()}` 
            });
            
            // Создаем кнопку возврата к основной аналитике
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('analytics_main')
                        .setLabel('Назад к общей аналитике')
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
                logger.error(`Error in analytics forecast: ${error.message}`);
                
                await interaction.editReply({ 
                    content: 'Произошла ошибка при загрузке прогноза посещаемости. Пожалуйста, попробуйте позже.',
                    components: []
                });
            }
        }
    },
    
    /**
     * Обработчик кнопки экспорта данных
     * @param {Object} interaction - Объект взаимодействия
     */
    async handleExport(interaction) {
        try {
            // Проверка на превышение лимита запросов
            await Middleware.rateLimit(interaction);
            
            // Проверка прав администратора
            await Middleware.requireAdmin(interaction);
            
            // Создаем кнопки для выбора типа данных для экспорта
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('export_users')
                        .setLabel('Пользователи')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('👥'),
                    new ButtonBuilder()
                        .setCustomId('export_events')
                        .setLabel('Мероприятия')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📅'),
                    new ButtonBuilder()
                        .setCustomId('export_registrations')
                        .setLabel('Регистрации')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🎟️'),
                    new ButtonBuilder()
                        .setCustomId('export_achievements')
                        .setLabel('Достижения')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🏆')
                );
            
            // Создаем кнопку возврата к основной аналитике
            const actionRow2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('analytics_main')
                        .setLabel('Назад к общей аналитике')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('◀️')
                );
            
            // Создаем эмбед с информацией об экспорте
            const embed = new EmbedBuilder()
                .setColor('#607D8B')
                .setTitle('📤 Экспорт данных')
                .setDescription('Выберите тип данных для экспорта в формате CSV')
                .addFields(
                    { name: '👥 Пользователи', value: 'Экспорт данных о пользователях и их статистике' },
                    { name: '📅 Мероприятия', value: 'Экспорт данных о мероприятиях и их статистике' },
                    { name: '🎟️ Регистрации', value: 'Экспорт данных о регистрациях на мероприятия' },
                    { name: '🏆 Достижения', value: 'Экспорт данных о достижениях пользователей' }
                );
            
            // Отправляем ответ
            await interaction.reply({
                embeds: [embed],
                components: [actionRow, actionRow2],
                ephemeral: true
            });
            
        } catch (error) {
            // Обработка ошибок middleware
            const handled = await Middleware.handleError(error, interaction);
            
            if (!handled) {
                logger.error(`Error in analytics export: ${error.message}`);
                
                await interaction.reply({ 
                    content: 'Произошла ошибка при подготовке экспорта данных. Пожалуйста, попробуйте позже.',
                    ephemeral: true
                });
            }
        }
    },
    
    /**
     * Обработчик кнопки экспорта конкретного типа данных
     * @param {Object} interaction - Объект взаимодействия
     * @param {string} dataType - Тип данных для экспорта
     */
    async handleExportData(interaction, dataType) {
        try {
            // Проверка на превышение лимита запросов
            await Middleware.rateLimit(interaction);
            
            // Проверка прав администратора
            await Middleware.requireAdmin(interaction);
            
            // Отложенный ответ для длительных операций
            await interaction.deferUpdate();
            
            // Получаем данные для экспорта
            const csvData = await AnalyticsManager.exportDataToCsv(dataType);
            
            if (!csvData) {
                return await interaction.editReply('Не удалось экспортировать данные. Пожалуйста, попробуйте позже.');
            }
            
            // Создаем буфер с данными CSV
            const buffer = Buffer.from(csvData, 'utf8');
            
            // Создаем вложение
            const attachment = new AttachmentBuilder(buffer, { name: `${dataType}_export.csv` });
            
            // Создаем эмбед с информацией об экспорте
            const embed = new EmbedBuilder()
                .setColor('#4CAF50')
                .setTitle('✅ Экспорт данных завершен')
                .setDescription(`Данные о ${this.getDataTypeName(dataType)} успешно экспортированы`)
                .addFields(
                    { name: '📁 Формат', value: 'CSV (разделитель - запятая)' },
                    { name: '📅 Дата экспорта', value: new Date().toLocaleString() }
                );
            
            // Создаем кнопку возврата к основной аналитике
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('analytics_main')
                        .setLabel('Назад к общей аналитике')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('◀️')
                );
            
            // Отправляем ответ
            await interaction.editReply({
                embeds: [embed],
                components: [actionRow],
                files: [attachment]
            });
            
        } catch (error) {
            // Обработка ошибок middleware
            const handled = await Middleware.handleError(error, interaction);
            
            if (!handled) {
                logger.error(`Error in export data: ${error.message}`);
                
                await interaction.editReply({ 
                    content: 'Произошла ошибка при экспорте данных. Пожалуйста, попробуйте позже.',
                    components: []
                });
            }
        }
    },
    
    /**
     * Обработчик кнопки возврата к основной аналитике
     * @param {Object} interaction - Объект взаимодействия
     */
    async handleBackToMain(interaction) {
        try {
            // Проверка на превышение лимита запросов
            await Middleware.rateLimit(interaction);
            
            // Проверка прав администратора
            await Middleware.requireAdmin(interaction);
            
            // Отложенный ответ для длительных операций
            await interaction.deferUpdate();
            
            // Получаем общую статистику гильдии
            const guildStats = await AnalyticsManager.getGuildStats();
            
            if (!guildStats) {
                return await interaction.editReply('Не удалось загрузить аналитику. Пожалуйста, попробуйте позже.');
            }
            
            // Создаем эмбед с основной информацией
            const embed = this.createMainAnalyticsEmbed(guildStats);
            
            // Создаем кнопки для навигации
            const actionRow = this.createActionButtons();
            
            // Отправляем ответ
            await interaction.editReply({
                embeds: [embed],
                components: [actionRow]
            });
            
        } catch (error) {
            // Обработка ошибок middleware
            const handled = await Middleware.handleError(error, interaction);
            
            if (!handled) {
                logger.error(`Error in back to main analytics: ${error.message}`);
                
                await interaction.editReply({ 
                    content: 'Произошла ошибка при возврате к основной аналитике. Пожалуйста, попробуйте позже.',
                    components: []
                });
            }
        }
    },
    
    /**
     * Возвращает эмодзи для типа мероприятия
     * @param {string} type - Тип мероприятия
     * @returns {string} Эмодзи
     */
    getTypeEmoji(type) {
        const emojiMap = {
            workshop: '🔧',
            meetup: '🤝',
            conference: '🎤',
            hackathon: '💻',
            game: '🎮',
            other: '📌'
        };
        
        return emojiMap[type] || '📌';
    },
    
    /**
     * Возвращает название типа мероприятия
     * @param {string} type - Тип мероприятия
     * @returns {string} Название
     */
    getTypeName(type) {
        const nameMap = {
            workshop: 'Мастер-классы',
            meetup: 'Митапы',
            conference: 'Конференции',
            hackathon: 'Хакатоны',
            game: 'Игры',
            other: 'Другое'
        };
        
        return nameMap[type] || 'Другое';
    },
    
    /**
     * Возвращает информацию о достижении
     * @param {string} achievementKey - Ключ достижения
     * @returns {Object} Информация о достижении
     */
    getAchievementInfo(achievementKey) {
        const achievementMap = {
            newcomer: { name: 'Новичок', icon: '🎯' },
            active: { name: 'Активист', icon: '🔥' },
            regular: { name: 'Завсегдатай', icon: '⭐' },
            legend: { name: 'Легенда', icon: '👑' },
            organizer: { name: 'Организатор', icon: '🛠️' },
            veteran: { name: 'Ветеран', icon: '🏅' }
        };
        
        return achievementMap[achievementKey] || { name: achievementKey, icon: '🏆' };
    },
    
    /**
     * Возвращает название типа данных для экспорта
     * @param {string} dataType - Тип данных
     * @returns {string} Название
     */
    getDataTypeName(dataType) {
        const nameMap = {
            users: 'пользователях',
            events: 'мероприятиях',
            registrations: 'регистрациях',
            achievements: 'достижениях'
        };
        
        return nameMap[dataType] || dataType;
    }
};
