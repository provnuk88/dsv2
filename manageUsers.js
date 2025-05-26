const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../database/models/User');
const AdminLog = require('../../database/models/AdminLog');
const logger = require('../../utils/logger');
const commandPermissions = require('../../utils/commandPermissions');
const profileLogger = require('../../utils/profileLogger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manageusers')
        .setDescription('Управление пользователями')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Показать список всех пользователей'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('Просмотреть профиль пользователя')
                .addStringOption(option =>
                    option.setName('userid')
                        .setDescription('ID пользователя Discord')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Редактировать профиль пользователя')
                .addStringOption(option =>
                    option.setName('userid')
                        .setDescription('ID пользователя Discord')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Удалить профиль пользователя')
                .addStringOption(option =>
                    option.setName('userid')
                        .setDescription('ID пользователя Discord')
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
                    await this.listUsers(interaction);
                    break;
                case 'view':
                    await this.viewUser(interaction);
                    break;
                case 'edit':
                    await this.editUser(interaction);
                    break;
                case 'delete':
                    await this.deleteUser(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Неизвестная подкоманда.',
                        ephemeral: true
                    });
            }
            
        } catch (error) {
            logger.error(`Ошибка при выполнении команды manageusers: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при управлении пользователями. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Показать список всех пользователей
    async listUsers(interaction) {
        try {
            // Получение всех пользователей, отсортированных по дате регистрации
            const users = await User.find({}).sort({ registeredAt: -1 });
            
            if (users.length === 0) {
                return interaction.reply({
                    content: '👥 Нет зарегистрированных пользователей.',
                    ephemeral: true
                });
            }
            
            // Создание эмбеда для списка пользователей
            const usersEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Список пользователей')
                .setDescription(`Всего зарегистрировано: ${users.length} пользователей`)
                .setFooter({ text: 'Synergy Guild Bot' })
                .setTimestamp();
            
            // Разбиение списка пользователей на страницы (максимум 25 полей в эмбеде)
            const pageSize = 25;
            const totalPages = Math.ceil(users.length / pageSize);
            const currentPage = 1;
            
            const startIndex = (currentPage - 1) * pageSize;
            const endIndex = Math.min(startIndex + pageSize, users.length);
            
            for (let i = startIndex; i < endIndex; i++) {
                const user = users[i];
                usersEmbed.addFields({
                    name: `${user.nickname || 'Без никнейма'} (ID: ${user.discordId})`,
                    value: `Telegram: ${user.telegram || 'Не указан'}\nКошельки: ${user.wallets.length > 0 ? user.wallets.join(', ') : 'Не указаны'}\nЗарегистрирован: ${new Date(user.registeredAt).toLocaleString('ru-RU')}`
                });
            }
            
            // Создание кнопок для навигации по страницам
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('◀️ Предыдущая')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 1),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('Следующая ▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === totalPages)
                );
            
            await interaction.reply({
                embeds: [usersEmbed],
                components: totalPages > 1 ? [row] : [],
                ephemeral: true
            });
            
        } catch (error) {
            logger.error(`Ошибка при получении списка пользователей: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при получении списка пользователей. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Просмотр профиля пользователя
    async viewUser(interaction) {
        try {
            const userId = interaction.options.getString('userid');
            
            // Поиск пользователя в базе данных
            const user = await User.findOne({ discordId: userId });
            
            if (!user) {
                return interaction.reply({
                    content: `❌ Пользователь с ID ${userId} не найден.`,
                    ephemeral: true
                });
            }
            
            // Получение истории изменений профиля
            const profileChanges = await profileLogger.getProfileChanges(userId);
            
            // Создание эмбеда с информацией о пользователе
            const userEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`Профиль пользователя: ${user.nickname || 'Без никнейма'}`)
                .setDescription(`Информация о пользователе <@${userId}>`)
                .addFields(
                    { name: 'Discord ID', value: user.discordId, inline: true },
                    { name: 'Discord Tag', value: user.discordTag || 'Не указан', inline: true },
                    { name: 'Никнейм', value: user.nickname || 'Не указан', inline: true },
                    { name: 'Telegram', value: user.telegram || 'Не указан', inline: true },
                    { name: 'Email', value: user.email || 'Не указан', inline: true },
                    { name: 'Зарегистрирован', value: new Date(user.registeredAt).toLocaleString('ru-RU'), inline: true }
                )
                .setFooter({ text: 'Synergy Guild Bot' })
                .setTimestamp();
            
            // Добавление кошельков, если они есть
            if (user.wallets && user.wallets.length > 0) {
                userEmbed.addFields({
                    name: 'Кошельки',
                    value: user.wallets.join('\n')
                });
            } else {
                userEmbed.addFields({
                    name: 'Кошельки',
                    value: 'Не указаны'
                });
            }
            
            // Добавление истории изменений профиля, если она есть
            if (profileChanges && profileChanges.length > 0) {
                const recentChanges = profileChanges.slice(0, 5); // Показываем только последние 5 изменений
                
                const changesText = recentChanges.map(change => 
                    `${new Date(change.timestamp).toLocaleString('ru-RU')}: ${change.field} изменено с "${change.oldValue || 'не указано'}" на "${change.newValue || 'не указано'}"`
                ).join('\n');
                
                userEmbed.addFields({
                    name: 'Последние изменения профиля',
                    value: changesText
                });
                
                if (profileChanges.length > 5) {
                    userEmbed.addFields({
                        name: 'И еще...',
                        value: `Еще ${profileChanges.length - 5} изменений`
                    });
                }
            }
            
            // Создание кнопок для управления пользователем
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`edit_user_${userId}`)
                        .setLabel('Редактировать')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`delete_user_${userId}`)
                        .setLabel('Удалить')
                        .setStyle(ButtonStyle.Danger)
                );
            
            await interaction.reply({
                embeds: [userEmbed],
                components: [row],
                ephemeral: true
            });
            
        } catch (error) {
            logger.error(`Ошибка при просмотре пользователя: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при просмотре пользователя. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Редактирование профиля пользователя
    async editUser(interaction) {
        try {
            const userId = interaction.options.getString('userid');
            
            // Поиск пользователя в базе данных
            const user = await User.findOne({ discordId: userId });
            
            if (!user) {
                return interaction.reply({
                    content: `❌ Пользователь с ID ${userId} не найден.`,
                    ephemeral: true
                });
            }
            
            // Создание модального окна для редактирования профиля
            const modal = createUserEditModal(user);
            await interaction.showModal(modal);
            
        } catch (error) {
            logger.error(`Ошибка при редактировании пользователя: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при редактировании пользователя. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },

    // Удаление профиля пользователя
    async deleteUser(interaction) {
        try {
            const userId = interaction.options.getString('userid');
            
            // Поиск пользователя в базе данных
            const user = await User.findOne({ discordId: userId });
            
            if (!user) {
                return interaction.reply({
                    content: `❌ Пользователь с ID ${userId} не найден.`,
                    ephemeral: true
                });
            }
            
            // Создание кнопок подтверждения удаления
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`confirm_delete_${userId}`)
                        .setLabel('Подтвердить удаление')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('cancel_operation')
                        .setLabel('Отмена')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.reply({
                content: `⚠️ Вы уверены, что хотите удалить профиль пользователя ${user.nickname || user.discordTag || userId}? Это действие нельзя отменить.`,
                components: [row],
                ephemeral: true
            });
            
        } catch (error) {
            logger.error(`Ошибка при удалении пользователя: ${error.message}`);
            await interaction.reply({
                content: '❌ Произошла ошибка при удалении пользователя. Пожалуйста, попробуйте позже.',
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
            
            // Обработка кнопки редактирования пользователя
            if (customId.startsWith('edit_user_')) {
                const userId = customId.replace('edit_user_', '');
                
                // Поиск пользователя в базе данных
                const user = await User.findOne({ discordId: userId });
                
                if (!user) {
                    return interaction.reply({
                        content: `❌ Пользователь с ID ${userId} не найден.`,
                        ephemeral: true
                    });
                }
                
                // Создание модального окна для редактирования профиля
                const modal = createUserEditModal(user);
                await interaction.showModal(modal);
            }
            
            // Обработка кнопки удаления пользователя
            else if (customId.startsWith('delete_user_')) {
                const userId = customId.replace('delete_user_', '');
                
                // Поиск пользователя в базе данных
                const user = await User.findOne({ discordId: userId });
                
                if (!user) {
                    return interaction.reply({
                        content: `❌ Пользователь с ID ${userId} не найден.`,
                        ephemeral: true
                    });
                }
                
                // Создание кнопок подтверждения удаления
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`confirm_delete_${userId}`)
                            .setLabel('Подтвердить удаление')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('cancel_operation')
                            .setLabel('Отмена')
                            .setStyle(ButtonStyle.Secondary)
                    );
                
                await interaction.reply({
                    content: `⚠️ Вы уверены, что хотите удалить профиль пользователя ${user.nickname || user.discordTag || userId}? Это действие нельзя отменить.`,
                    components: [row],
                    ephemeral: true
                });
            }
            
            // Обработка кнопки подтверждения удаления пользователя
            else if (customId.startsWith('confirm_delete_')) {
                const userId = customId.replace('confirm_delete_', '');
                
                // Поиск пользователя в базе данных
                const user = await User.findOne({ discordId: userId });
                
                if (!user) {
                    return interaction.update({
                        content: `❌ Пользователь с ID ${userId} не найден.`,
                        components: [],
                        ephemeral: true
                    });
                }
                
                // Удаление пользователя
                await User.deleteOne({ discordId: userId });
                
                // Логирование удаления пользователя
                logger.info(`Администратор ${interaction.user.tag} (${interaction.user.id}) удалил пользователя: ${user.nickname || user.discordTag || userId}`);
                
                // Создание записи в логе администратора
                const adminLog = new AdminLog({
                    adminId: interaction.user.id,
                    action: 'delete_user',
                    targetId: userId,
                    details: `Удален пользователь: ${user.nickname || user.discordTag || userId}`,
                    timestamp: new Date()
                });
                
                await adminLog.save();
                
                await interaction.update({
                    content: `✅ Профиль пользователя ${user.nickname || user.discordTag || userId} успешно удален.`,
                    components: [],
                    ephemeral: true
                });
            }
            
            // Обработка кнопок навигации по страницам
            else if (customId === 'prev_page' || customId === 'next_page') {
                // Получение текущей страницы из сообщения
                const embed = interaction.message.embeds[0];
                const footerText = embed.footer.text;
                const pageMatch = footerText.match(/Страница (\d+) из (\d+)/);
                
                if (!pageMatch) {
                    return interaction.update({
                        content: '❌ Не удалось определить текущую страницу.',
                        components: [],
                        ephemeral: true
                    });
                }
                
                const currentPage = parseInt(pageMatch[1]);
                const totalPages = parseInt(pageMatch[2]);
                
                // Определение новой страницы
                const newPage = customId === 'prev_page' ? currentPage - 1 : currentPage + 1;
                
                if (newPage < 1 || newPage > totalPages) {
                    return interaction.update({
                        content: '❌ Недопустимый номер страницы.',
                        components: [],
                        ephemeral: true
                    });
                }
                
                // Получение всех пользователей, отсортированных по дате регистрации
                const users = await User.find({}).sort({ registeredAt: -1 });
                
                // Создание эмбеда для списка пользователей
                const usersEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('Список пользователей')
                    .setDescription(`Всего зарегистрировано: ${users.length} пользователей`)
                    .setFooter({ text: `Страница ${newPage} из ${totalPages} | Synergy Guild Bot` })
                    .setTimestamp();
                
                // Разбиение списка пользователей на страницы (максимум 25 полей в эмбеде)
                const pageSize = 25;
                
                const startIndex = (newPage - 1) * pageSize;
                const endIndex = Math.min(startIndex + pageSize, users.length);
                
                for (let i = startIndex; i < endIndex; i++) {
                    const user = users[i];
                    usersEmbed.addFields({
                        name: `${user.nickname || 'Без никнейма'} (ID: ${user.discordId})`,
                        value: `Telegram: ${user.telegram || 'Не указан'}\nКошельки: ${user.wallets.length > 0 ? user.wallets.join(', ') : 'Не указаны'}\nЗарегистрирован: ${new Date(user.registeredAt).toLocaleString('ru-RU')}`
                    });
                }
                
                // Создание кнопок для навигации по страницам
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev_page')
                            .setLabel('◀️ Предыдущая')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(newPage === 1),
                        new ButtonBuilder()
                            .setCustomId('next_page')
                            .setLabel('Следующая ▶️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(newPage === totalPages)
                    );
                
                await interaction.update({
                    embeds: [usersEmbed],
                    components: [row],
                    ephemeral: true
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
            
            // Обработка модального окна редактирования пользователя
            if (customId.startsWith('edit_user_modal_')) {
                const userId = customId.replace('edit_user_modal_', '');
                
                // Поиск пользователя в базе данных
                const user = await User.findOne({ discordId: userId });
                
                if (!user) {
                    return interaction.reply({
                        content: `❌ Пользователь с ID ${userId} не найден.`,
                        ephemeral: true
                    });
                }
                
                // Получение значений из полей
                const nickname = interaction.fields.getTextInputValue('user_nickname');
                const telegram = interaction.fields.getTextInputValue('user_telegram');
                const email = interaction.fields.getTextInputValue('user_email');
                const walletsStr = interaction.fields.getTextInputValue('user_wallets');
                
                // Разбор строки с кошельками
                const wallets = walletsStr.split('\n').filter(wallet => wallet.trim() !== '');
                
                // Сохранение старых значений для логирования изменений
                const oldNickname = user.nickname;
                const oldTelegram = user.telegram;
                const oldEmail = user.email;
                const oldWallets = [...user.wallets];
                
                // Обновление данных пользователя
                user.nickname = nickname;
                user.telegram = telegram;
                user.email = email;
                user.wallets = wallets;
                user.updatedAt = new Date();
                
                await user.save();
                
                // Логирование изменений профиля
                if (oldNickname !== nickname) {
                    await profileLogger.logProfileChange(userId, 'nickname', oldNickname, nickname, interaction.user.id);
                }
                
                if (oldTelegram !== telegram) {
                    await profileLogger.logProfileChange(userId, 'telegram', oldTelegram, telegram, interaction.user.id);
                }
                
                if (oldEmail !== email) {
                    await profileLogger.logProfileChange(userId, 'email', oldEmail, email, interaction.user.id);
                }
                
                // Логирование изменений кошельков
                const addedWallets = wallets.filter(wallet => !oldWallets.includes(wallet));
                const removedWallets = oldWallets.filter(wallet => !wallets.includes(wallet));
                
                for (const wallet of addedWallets) {
                    await profileLogger.logProfileChange(userId, 'wallet_added', null, wallet, interaction.user.id);
                }
                
                for (const wallet of removedWallets) {
                    await profileLogger.logProfileChange(userId, 'wallet_removed', wallet, null, interaction.user.id);
                }
                
                // Логирование редактирования пользователя
                logger.info(`Администратор ${interaction.user.tag} (${interaction.user.id}) отредактировал пользователя: ${user.nickname || user.discordTag || userId}`);
                
                // Создание записи в логе администратора
                const adminLog = new AdminLog({
                    adminId: interaction.user.id,
                    action: 'edit_user',
                    targetId: userId,
                    details: `Отредактирован пользователь: ${user.nickname || user.discordTag || userId}`,
                    timestamp: new Date()
                });
                
                await adminLog.save();
                
                // Создание эмбеда с обновленной информацией о пользователе
                const userEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('Профиль пользователя успешно обновлен')
                    .setDescription(`Обновлена информация о пользователе <@${userId}>`)
                    .addFields(
                        { name: 'Никнейм', value: nickname || 'Не указан', inline: true },
                        { name: 'Telegram', value: telegram || 'Не указан', inline: true },
                        { name: 'Email', value: email || 'Не указан', inline: true }
                    )
                    .setFooter({ text: 'Synergy Guild Bot' })
                    .setTimestamp();
                
                // Добавление кошельков, если они есть
                if (wallets.length > 0) {
                    userEmbed.addFields({
                        name: 'Кошельки',
                        value: wallets.join('\n')
                    });
                } else {
                    userEmbed.addFields({
                        name: 'Кошельки',
                        value: 'Не указаны'
                    });
                }
                
                await interaction.reply({
                    content: '✅ Профиль пользователя успешно обновлен!',
                    embeds: [userEmbed],
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

// Функция для создания модального окна редактирования пользователя
function createUserEditModal(user) {
    const modal = new ModalBuilder()
        .setCustomId(`edit_user_modal_${user.discordId}`)
        .setTitle('Редактирование профиля пользователя');
    
    const nicknameInput = new TextInputBuilder()
        .setCustomId('user_nickname')
        .setLabel('Никнейм')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Введите никнейм пользователя')
        .setValue(user.nickname || '')
        .setRequired(false);
    
    const telegramInput = new TextInputBuilder()
        .setCustomId('user_telegram')
        .setLabel('Telegram')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Введите Telegram пользователя')
        .setValue(user.telegram || '')
        .setRequired(false);
    
    const emailInput = new TextInputBuilder()
        .setCustomId('user_email')
        .setLabel('Email')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Введите Email пользователя')
        .setValue(user.email || '')
        .setRequired(false);
    
    const walletsInput = new TextInputBuilder()
        .setCustomId('user_wallets')
        .setLabel('Кошельки (по одному на строку)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Введите кошельки пользователя, по одному на строку')
        .setValue(user.wallets.join('\n'))
        .setRequired(false);
    
    const firstRow = new ActionRowBuilder().addComponents(nicknameInput);
    const secondRow = new ActionRowBuilder().addComponents(telegramInput);
    const thirdRow = new ActionRowBuilder().addComponents(emailInput);
    const fourthRow = new ActionRowBuilder().addComponents(walletsInput);
    
    modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);
    
    return modal;
}
