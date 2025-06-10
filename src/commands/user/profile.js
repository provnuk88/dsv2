const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const User = require('../../database/models/User');
const { isRateLimited, getRemainingTime } = require('../../utils/rateLimiter');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Просмотр и управление вашим профилем'),
    
    async execute(interaction) {
        try {
            // Проверка на ограничение частоты запросов
            if (isRateLimited(interaction.user.id, 'profile', 5, 60000)) {
                const remainingTime = getRemainingTime(interaction.user.id, 'profile');
                return interaction.reply({
                    content: `Вы слишком часто используете эту команду. Пожалуйста, подождите ${remainingTime} секунд.`,
                    ephemeral: true
                });
            }
            
            // Поиск пользователя в базе данных
            const user = await User.findOne({ discordId: interaction.user.id });
            
            if (!user) {
                // Если профиль не найден, предлагаем создать
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('create_profile')
                            .setLabel('Создать профиль')
                            .setStyle(ButtonStyle.Primary)
                    );
                
                return interaction.reply({
                    content: 'У вас еще нет профиля. Хотите создать?',
                    components: [row],
                    ephemeral: true
                });
            }
            
            // Если профиль найден, отображаем информацию
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`Профиль ${interaction.user.username}`)
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    { name: 'Discord', value: `<@${user.discordId}>`, inline: true },
                    { name: 'Имя пользователя', value: user.username || 'Не указано', inline: true },
                    { name: 'Telegram', value: user.telegram || 'Не указано', inline: true },
                    { name: 'Twitter', value: user.twitter || 'Не указано', inline: true },
                    { name: 'Кошельки', value: user.wallets || 'Не указано', inline: false },
                    { name: 'Зарегистрирован', value: `<t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`, inline: true }
                )
                .setFooter({ text: 'Synergy Guild Bot' })
                .setTimestamp();
            
            // Добавляем кнопку редактирования
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('edit_profile')
                        .setLabel('Редактировать')
                        .setStyle(ButtonStyle.Primary)
                );
            
            await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });
            
        } catch (error) {
            console.error('Ошибка при выполнении команды profile:', error);
            await interaction.reply({
                content: 'Произошла ошибка при загрузке профиля. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },
    
    // Обработчик кнопки создания профиля
    async handleCreateProfile(interaction) {
        try {
            const modal = new ModalBuilder()
                .setCustomId('modal_profile_basic')
                .setTitle('Создание профиля');
            
            const usernameInput = new TextInputBuilder()
                .setCustomId('username')
                .setLabel('Имя пользователя')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            
            const firstRow = new ActionRowBuilder().addComponents(usernameInput);
            
            modal.addComponents(firstRow);
            
            await interaction.showModal(modal);
            
        } catch (error) {
            console.error('Ошибка при показе модального окна для создания профиля:', error);
            await interaction.reply({
                content: 'Произошла ошибка при создании профиля. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },
    
    // Обработчик кнопки редактирования профиля
    async handleEditProfile(interaction) {
        try {
            // Проверяем, существует ли профиль
            const user = await User.findOne({ discordId: interaction.user.id });
            
            if (!user) {
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('create_profile')
                            .setLabel('Создать профиль')
                            .setStyle(ButtonStyle.Primary)
                    );
                
                return interaction.reply({
                    content: 'У вас еще нет профиля. Выберите, какую информацию вы хотите добавить:',
                    components: [row],
                    ephemeral: true
                });
            }
            
            // Создаем кнопки для выбора, что редактировать
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('edit_profile_basic')
                        .setLabel('Основная информация')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('edit_profile_wallets')
                        .setLabel('Кошельки')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('edit_profile_additional')
                        .setLabel('Дополнительная информация')
                        .setStyle(ButtonStyle.Primary)
                );
            
            await interaction.reply({
                content: 'Выберите, какую информацию вы хотите отредактировать:',
                components: [row],
                ephemeral: true
            });
            
        } catch (error) {
            console.error('Ошибка при редактировании профиля:', error);
            await interaction.reply({
                content: 'Произошла ошибка при редактировании профиля. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },
    
    // Обработчик редактирования основной информации
    async handleEditProfileBasic(interaction) {
        try {
            const user = await User.findOne({ discordId: interaction.user.id });
            
            const modal = new ModalBuilder()
                .setCustomId('modal_profile_basic')
                .setTitle('Редактирование основной информации');
            
            const usernameInput = new TextInputBuilder()
                .setCustomId('username')
                .setLabel('Имя пользователя')
                .setStyle(TextInputStyle.Short)
                .setValue(user ? user.username || '' : '')
                .setRequired(true);
            
            const firstRow = new ActionRowBuilder().addComponents(usernameInput);
            
            modal.addComponents(firstRow);
            
            await interaction.showModal(modal);
            
        } catch (error) {
            console.error('Ошибка при показе модального окна для основной информации:', error);
            await interaction.reply({
                content: 'Произошла ошибка при редактировании профиля. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },
    
    // Обработчик редактирования кошельков
    async handleEditProfileWallets(interaction) {
        try {
            const user = await User.findOne({ discordId: interaction.user.id });
            
            const modal = new ModalBuilder()
                .setCustomId('modal_profile_wallets')
                .setTitle('Редактирование кошельков');
            
            const walletsInput = new TextInputBuilder()
                .setCustomId('wallets')
                .setLabel('Кошельки (формат: СЕТЬ АДРЕС, по одному на строку)')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(user ? user.wallets || '' : '')
                .setRequired(false)
                .setMaxLength(1000); // Ограничиваем длину, чтобы избежать ошибки
            
            const firstRow = new ActionRowBuilder().addComponents(walletsInput);
            
            modal.addComponents(firstRow);
            
            await interaction.showModal(modal);
            
        } catch (error) {
            console.error('Ошибка при показе модального окна для кошельков:', error);
            await interaction.reply({
                content: 'Произошла ошибка при редактировании кошельков. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },
    
    // Обработчик редактирования дополнительной информации
    async handleEditProfileAdditional(interaction) {
        try {
            const user = await User.findOne({ discordId: interaction.user.id });
            
            const modal = new ModalBuilder()
                .setCustomId('modal_profile_additional')
                .setTitle('Редактирование дополнительной информации');
            
            const telegramInput = new TextInputBuilder()
                .setCustomId('telegram')
                .setLabel('Telegram (без @)')
                .setStyle(TextInputStyle.Short)
                .setValue(user ? user.telegram || '' : '')
                .setRequired(false);
            
            const twitterInput = new TextInputBuilder()
                .setCustomId('twitter')
                .setLabel('Twitter (без @)')
                .setStyle(TextInputStyle.Short)
                .setValue(user ? user.twitter || '' : '')
                .setRequired(false);
            
            const firstRow = new ActionRowBuilder().addComponents(telegramInput);
            const secondRow = new ActionRowBuilder().addComponents(twitterInput);
            
            modal.addComponents(firstRow, secondRow);
            
            await interaction.showModal(modal);
            
        } catch (error) {
            console.error('Ошибка при показе модального окна для дополнительной информации:', error);
            await interaction.reply({
                content: 'Произошла ошибка при редактировании дополнительной информации. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },
    
    // Обработчик модального окна с основной информацией
    async handleModalProfileBasic(interaction) {
        try {
            const username = interaction.fields.getTextInputValue('username');
            
            // Ищем пользователя или создаем нового
            let user = await User.findOne({ discordId: interaction.user.id });
            
            if (!user) {
                console.log('Создан новый профиль для пользователя', interaction.user.username, `(${interaction.user.id})`);
                
                // Создаем нового пользователя с обязательным полем discordId
                user = new User({
                    discordId: interaction.user.id,
                    username: username
                });
            } else {
                // Обновляем существующего пользователя
                user.username = username;
            }
            
            await user.save();
            
            await interaction.reply({
                content: 'Основная информация профиля успешно обновлена!',
                ephemeral: true
            });
            
        } catch (error) {
            console.error('Ошибка при обработке модального окна с основной информацией:', error);
            await interaction.reply({
                content: 'Произошла ошибка при обновлении профиля. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },
    
    // Обработчик модального окна с кошельками
    async handleModalProfileWallets(interaction) {
        try {
            const wallets = interaction.fields.getTextInputValue('wallets');
            
            // Ищем пользователя
            let user = await User.findOne({ discordId: interaction.user.id });
            
            if (!user) {
                return interaction.reply({
                    content: 'Сначала создайте основной профиль!',
                    ephemeral: true
                });
            }
            
            // Обновляем кошельки
            user.wallets = wallets;
            await user.save();
            
            await interaction.reply({
                content: 'Информация о кошельках успешно обновлена!',
                ephemeral: true
            });
            
        } catch (error) {
            console.error('Ошибка при обработке модального окна с кошельками:', error);
            await interaction.reply({
                content: 'Произошла ошибка при обновлении кошельков. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    },
    
    // Обработчик модального окна с дополнительной информацией
    async handleModalProfileAdditional(interaction) {
        try {
            const telegram = interaction.fields.getTextInputValue('telegram');
            const twitter = interaction.fields.getTextInputValue('twitter');
            
            // Ищем пользователя
            let user = await User.findOne({ discordId: interaction.user.id });
            
            if (!user) {
                return interaction.reply({
                    content: 'Сначала создайте основной профиль!',
                    ephemeral: true
                });
            }
            
            // Обновляем дополнительную информацию
            user.telegram = telegram;
            user.twitter = twitter;
            await user.save();
            
            await interaction.reply({
                content: 'Дополнительная информация профиля успешно обновлена!',
                ephemeral: true
            });
            
        } catch (error) {
            console.error('Ошибка при обработке модального окна с дополнительной информацией:', error);
            await interaction.reply({
                content: 'Произошла ошибка при обновлении дополнительной информации. Пожалуйста, попробуйте позже.',
                ephemeral: true
            });
        }
    }
};
