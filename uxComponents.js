/**
 * Улучшенный интерфейс пользователя для Discord-бота Synergy Guild
 * Модуль содержит компоненты для создания интерактивных интерфейсов
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const logger = require('./logger');

class UXComponents {
    /**
     * Создает прогресс-бар для отображения в эмбедах
     * @param {number} current - Текущее значение
     * @param {number} max - Максимальное значение
     * @param {number} size - Размер прогресс-бара (количество символов)
     * @param {string} filledChar - Символ для заполненной части
     * @param {string} emptyChar - Символ для пустой части
     * @returns {string} Строка прогресс-бара
     */
    static createProgressBar(current, max, size = 10, filledChar = '■', emptyChar = '□') {
        if (max <= 0) return emptyChar.repeat(size);
        
        const percentage = Math.min(Math.max(current / max, 0), 1);
        const filledCount = Math.round(size * percentage);
        const emptyCount = size - filledCount;
        
        return filledChar.repeat(filledCount) + emptyChar.repeat(emptyCount);
    }
    
    /**
     * Создает эмбед с информацией о мероприятии
     * @param {Object} event - Объект мероприятия
     * @param {boolean} detailed - Показывать ли детальную информацию
     * @returns {EmbedBuilder} Эмбед с информацией
     */
    static createEventEmbed(event, detailed = false) {
        try {
            // Преобразуем даты в Unix timestamp для Discord форматирования
            const startTime = Math.floor(new Date(event.startDate).getTime() / 1000);
            const endTime = Math.floor(new Date(event.endDate).getTime() / 1000);
            
            // Определяем цвет в зависимости от статуса мероприятия
            let color = '#2196F3'; // Синий по умолчанию
            
            const now = new Date();
            const startDate = new Date(event.startDate);
            const endDate = new Date(event.endDate);
            
            if (now > endDate) {
                color = '#9E9E9E'; // Серый для завершенных
            } else if (now >= startDate && now <= endDate) {
                color = '#4CAF50'; // Зеленый для текущих
            } else if (startDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000) {
                color = '#FF9800'; // Оранжевый для скорых
            }
            
            // Создаем базовый эмбед
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(event.title)
                .setDescription(event.description);
            
            // Добавляем основные поля
            embed.addFields(
                { name: '📅 Начало', value: `<t:${startTime}:F>`, inline: true },
                { name: '⏰ Окончание', value: `<t:${endTime}:F>`, inline: true },
                { name: '📍 Место', value: event.location || 'Онлайн', inline: true }
            );
            
            // Добавляем информацию о регистрациях
            const registrationsBar = this.createProgressBar(
                event.stats.registrationsCount,
                event.maxParticipants
            );
            
            embed.addFields({
                name: '👥 Участники',
                value: `${registrationsBar} ${event.stats.registrationsCount}/${event.maxParticipants}`,
                inline: false
            });
            
            // Если нужна детальная информация
            if (detailed) {
                // Добавляем информацию о листе ожидания
                if (event.stats.waitlistCount > 0) {
                    embed.addFields({
                        name: '📋 Лист ожидания',
                        value: `${event.stats.waitlistCount} пользователей`,
                        inline: true
                    });
                }
                
                // Добавляем информацию о ключах доступа
                if (event.accessKeys && event.accessKeys.length > 0) {
                    const availableKeys = event.accessKeys.filter(key => !key.issuedTo).length;
                    const totalKeys = event.accessKeys.length;
                    
                    const keysBar = this.createProgressBar(
                        totalKeys - availableKeys,
                        totalKeys
                    );
                    
                    embed.addFields({
                        name: '🔑 Ключи доступа',
                        value: `${keysBar} ${availableKeys}/${totalKeys} доступно`,
                        inline: true
                    });
                }
                
                // Добавляем информацию о повторяющемся мероприятии
                if (event.recurring && event.recurring.isRecurring) {
                    const frequencyMap = {
                        daily: 'ежедневно',
                        weekly: 'еженедельно',
                        monthly: 'ежемесячно'
                    };
                    
                    const frequency = frequencyMap[event.recurring.frequency] || event.recurring.frequency;
                    
                    embed.addFields({
                        name: '🔄 Повторение',
                        value: `${frequency} (интервал: ${event.recurring.interval})`,
                        inline: true
                    });
                }
                
                // Добавляем информацию о создателе
                embed.addFields({
                    name: '👤 Создатель',
                    value: `<@${event.createdBy}>`,
                    inline: true
                });
                
                // Добавляем информацию о требуемых полях профиля
                if (event.requiredProfileFields && event.requiredProfileFields.length > 0) {
                    embed.addFields({
                        name: '📝 Требуемые поля профиля',
                        value: event.requiredProfileFields.join(', '),
                        inline: false
                    });
                }
            }
            
            // Добавляем информацию о времени создания
            embed.setFooter({
                text: `ID: ${event._id} • Создано: ${new Date(event.createdAt).toLocaleDateString()}`
            });
            
            return embed;
        } catch (error) {
            logger.error(`Error creating event embed: ${error.message}`);
            
            // Возвращаем базовый эмбед в случае ошибки
            return new EmbedBuilder()
                .setColor('#F44336')
                .setTitle('Ошибка при создании эмбеда')
                .setDescription('Произошла ошибка при создании эмбеда мероприятия.');
        }
    }
    
    /**
     * Создает эмбед с информацией о профиле пользователя
     * @param {Object} user - Объект пользователя
     * @param {boolean} detailed - Показывать ли детальную информацию
     * @returns {EmbedBuilder} Эмбед с информацией
     */
    static createProfileEmbed(user, detailed = false) {
        try {
            // Создаем базовый эмбед
            const embed = new EmbedBuilder()
                .setColor('#3F51B5')
                .setTitle(`Профиль ${user.username}`)
                .setDescription(user.bio || 'Нет информации');
            
            // Добавляем основные поля
            const fields = [];
            
            if (user.telegram) {
                fields.push({ name: 'Telegram', value: user.telegram, inline: true });
            }
            
            if (user.twitter) {
                fields.push({ name: 'Twitter', value: user.twitter, inline: true });
            }
            
            if (user.wallet) {
                fields.push({ name: 'Кошелек', value: `\`${user.wallet}\``, inline: true });
            }
            
            // Добавляем статистику
            fields.push({
                name: '📊 Статистика',
                value: [
                    `📅 Мероприятий посещено: **${user.stats.eventsCompleted}**`,
                    `🎟️ Регистраций: **${user.stats.eventsJoined}**`,
                    `🛠️ Мероприятий создано: **${user.stats.eventsCreated}**`
                ].join('\n'),
                inline: false
            });
            
            // Если есть достижения
            if (user.achievements && user.achievements.length > 0) {
                const achievementsText = user.achievements
                    .map(a => `🏆 **${a.name}**: ${a.description}`)
                    .join('\n');
                
                fields.push({
                    name: '🏆 Достижения',
                    value: achievementsText,
                    inline: false
                });
            }
            
            // Если нужна детальная информация
            if (detailed && user.additionalInfo) {
                // Добавляем дополнительную информацию
                const additionalInfoText = Object.entries(user.additionalInfo)
                    .map(([key, value]) => `**${key}**: ${value}`)
                    .join('\n');
                
                if (additionalInfoText) {
                    fields.push({
                        name: '📝 Дополнительная информация',
                        value: additionalInfoText,
                        inline: false
                    });
                }
            }
            
            embed.addFields(fields);
            
            // Добавляем информацию о времени создания
            const joinedAt = user.stats.joinedAt ? new Date(user.stats.joinedAt) : new Date();
            const lastActive = user.stats.lastActive ? new Date(user.stats.lastActive) : joinedAt;
            
            embed.setFooter({
                text: `ID: ${user.discordId} • Присоединился: ${joinedAt.toLocaleDateString()} • Активность: ${lastActive.toLocaleDateString()}`
            });
            
            return embed;
        } catch (error) {
            logger.error(`Error creating profile embed: ${error.message}`);
            
            // Возвращаем базовый эмбед в случае ошибки
            return new EmbedBuilder()
                .setColor('#F44336')
                .setTitle('Ошибка при создании эмбеда')
                .setDescription('Произошла ошибка при создании эмбеда профиля.');
        }
    }
    
    /**
     * Создает кнопки для управления мероприятием
     * @param {string} eventId - ID мероприятия
     * @param {boolean} isAdmin - Является ли пользователь администратором
     * @param {boolean} isRegistered - Зарегистрирован ли пользователь
     * @param {string} registrationId - ID регистрации (если есть)
     * @returns {ActionRowBuilder[]} Массив строк с кнопками
     */
    static createEventButtons(eventId, isAdmin = false, isRegistered = false, registrationId = null) {
        try {
            const rows = [];
            
            // Кнопки для пользователей
            const userRow = new ActionRowBuilder();
            
            if (isRegistered && registrationId) {
                // Кнопка отмены регистрации
                userRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`cancel_registration_${registrationId}`)
                        .setLabel('Отменить регистрацию')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌')
                );
            } else {
                // Кнопка регистрации
                userRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`register_${eventId}`)
                        .setLabel('Зарегистрироваться')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('✅')
                );
            }
            
            // Кнопка просмотра участников
            userRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`view_participants_${eventId}`)
                    .setLabel('Участники')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('👥')
            );
            
            rows.push(userRow);
            
            // Кнопки для администраторов
            if (isAdmin) {
                const adminRow = new ActionRowBuilder();
                
                // Кнопка редактирования
                adminRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`edit_event_${eventId}`)
                        .setLabel('Редактировать')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('✏️')
                );
                
                // Кнопка экспорта участников
                adminRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`export_participants_${eventId}`)
                        .setLabel('Экспорт')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📤')
                );
                
                // Кнопка отправки уведомления
                adminRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`notify_participants_${eventId}`)
                        .setLabel('Уведомить')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📢')
                );
                
                // Кнопка удаления
                adminRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`delete_event_${eventId}`)
                        .setLabel('Удалить')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🗑️')
                );
                
                rows.push(adminRow);
            }
            
            return rows;
        } catch (error) {
            logger.error(`Error creating event buttons: ${error.message}`);
            
            // Возвращаем пустой массив в случае ошибки
            return [];
        }
    }
    
    /**
     * Создает кнопки для управления профилем
     * @param {string} userId - ID пользователя
     * @param {boolean} isOwner - Является ли пользователь владельцем профиля
     * @param {boolean} isAdmin - Является ли пользователь администратором
     * @returns {ActionRowBuilder[]} Массив строк с кнопками
     */
    static createProfileButtons(userId, isOwner = false, isAdmin = false) {
        try {
            const rows = [];
            
            // Кнопки для владельца профиля
            if (isOwner) {
                const ownerRow = new ActionRowBuilder();
                
                // Кнопка редактирования основной информации
                ownerRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`edit_profile_basic_${userId}`)
                        .setLabel('Основная информация')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📝')
                );
                
                // Кнопка редактирования кошельков
                ownerRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`edit_profile_wallets_${userId}`)
                        .setLabel('Кошельки')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('💰')
                );
                
                // Кнопка редактирования дополнительной информации
                ownerRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`edit_profile_additional_${userId}`)
                        .setLabel('Дополнительно')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('➕')
                );
                
                rows.push(ownerRow);
            }
            
            // Общие кнопки
            const commonRow = new ActionRowBuilder();
            
            // Кнопка просмотра мероприятий
            commonRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`view_user_events_${userId}`)
                    .setLabel('Мероприятия')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📅')
            );
            
            // Кнопка просмотра достижений
            commonRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`view_user_achievements_${userId}`)
                    .setLabel('Достижения')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🏆')
            );
            
            rows.push(commonRow);
            
            // Кнопки для администраторов
            if (isAdmin && !isOwner) {
                const adminRow = new ActionRowBuilder();
                
                // Кнопка сброса профиля
                adminRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`reset_profile_${userId}`)
                        .setLabel('Сбросить профиль')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔄')
                );
                
                rows.push(adminRow);
            }
            
            return rows;
        } catch (error) {
            logger.error(`Error creating profile buttons: ${error.message}`);
            
            // Возвращаем пустой массив в случае ошибки
            return [];
        }
    }
    
    /**
     * Создает меню выбора для фильтрации мероприятий
     * @param {string} customId - ID компонента
     * @returns {ActionRowBuilder} Строка с меню выбора
     */
    static createEventFilterMenu(customId = 'event_filter') {
        try {
            const row = new ActionRowBuilder();
            
            // Создаем меню выбора
            const menu = new StringSelectMenuBuilder()
                .setCustomId(customId)
                .setPlaceholder('Фильтр мероприятий')
                .addOptions([
                    {
                        label: 'Все мероприятия',
                        description: 'Показать все мероприятия',
                        value: 'all',
                        emoji: '📅'
                    },
                    {
                        label: 'Предстоящие',
                        description: 'Показать предстоящие мероприятия',
                        value: 'upcoming',
                        emoji: '⏰'
                    },
                    {
                        label: 'Текущие',
                        description: 'Показать текущие мероприятия',
                        value: 'ongoing',
                        emoji: '🔄'
                    },
                    {
                        label: 'Завершенные',
                        description: 'Показать завершенные мероприятия',
                        value: 'completed',
                        emoji: '✅'
                    },
                    {
                        label: 'Мои мероприятия',
                        description: 'Показать мероприятия, на которые вы зарегистрированы',
                        value: 'registered',
                        emoji: '👤'
                    },
                    {
                        label: 'Созданные мной',
                        description: 'Показать мероприятия, созданные вами',
                        value: 'created',
                        emoji: '🛠️'
                    }
                ]);
            
            row.addComponents(menu);
            
            return row;
        } catch (error) {
            logger.error(`Error creating event filter menu: ${error.message}`);
            
            // Возвращаем null в случае ошибки
            return null;
        }
    }
    
    /**
     * Создает кнопки навигации для пагинации
     * @param {string} baseId - Базовый ID компонента
     * @param {number} currentPage - Текущая страница
     * @param {number} totalPages - Общее количество страниц
     * @returns {ActionRowBuilder} Строка с кнопками навигации
     */
    static createPaginationButtons(baseId, currentPage, totalPages) {
        try {
            const row = new ActionRowBuilder();
            
            // Кнопка "Первая страница"
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${baseId}_first`)
                    .setLabel('⏮️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage <= 1)
            );
            
            // Кнопка "Предыдущая страница"
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${baseId}_prev`)
                    .setLabel('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage <= 1)
            );
            
            // Индикатор страницы
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${baseId}_page`)
                    .setLabel(`${currentPage} / ${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
            
            // Кнопка "Следующая страница"
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${baseId}_next`)
                    .setLabel('▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage >= totalPages)
            );
            
            // Кнопка "Последняя страница"
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${baseId}_last`)
                    .setLabel('⏭️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage >= totalPages)
            );
            
            return row;
        } catch (error) {
            logger.error(`Error creating pagination buttons: ${error.message}`);
            
            // Возвращаем null в случае ошибки
            return null;
        }
    }
    
    /**
     * Создает кнопки быстрых действий для дашборда
     * @param {string} userId - ID пользователя
     * @returns {ActionRowBuilder[]} Массив строк с кнопками
     */
    static createDashboardQuickActions(userId) {
        try {
            const rows = [];
            
            // Первый ряд кнопок
            const row1 = new ActionRowBuilder();
            
            // Кнопка просмотра профиля
            row1.addComponents(
                new ButtonBuilder()
                    .setCustomId(`view_profile_${userId}`)
                    .setLabel('Мой профиль')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('👤')
            );
            
            // Кнопка просмотра мероприятий
            row1.addComponents(
                new ButtonBuilder()
                    .setCustomId('view_events')
                    .setLabel('Мероприятия')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📅')
            );
            
            // Кнопка просмотра достижений
            row1.addComponents(
                new ButtonBuilder()
                    .setCustomId(`view_user_achievements_${userId}`)
                    .setLabel('Достижения')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🏆')
            );
            
            rows.push(row1);
            
            // Второй ряд кнопок
            const row2 = new ActionRowBuilder();
            
            // Кнопка просмотра моих регистраций
            row2.addComponents(
                new ButtonBuilder()
                    .setCustomId('view_my_registrations')
                    .setLabel('Мои регистрации')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🎟️')
            );
            
            // Кнопка просмотра предстоящих мероприятий
            row2.addComponents(
                new ButtonBuilder()
                    .setCustomId('view_upcoming_events')
                    .setLabel('Предстоящие')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⏰')
            );
            
            // Кнопка помощи
            row2.addComponents(
                new ButtonBuilder()
                    .setCustomId('help')
                    .setLabel('Помощь')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❓')
            );
            
            rows.push(row2);
            
            return rows;
        } catch (error) {
            logger.error(`Error creating dashboard quick actions: ${error.message}`);
            
            // Возвращаем пустой массив в случае ошибки
            return [];
        }
    }
}

module.exports = UXComponents;
