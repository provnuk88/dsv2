/**
 * Модуль логирования изменений профиля для Synergy Guild Bot
 * Отслеживает и записывает изменения в профилях пользователей
 */

const { WebhookClient } = require('discord.js');
const AdminLog = require('../database/models/AdminLog');
const logger = require('./logger');

/**
 * Логирует изменение профиля пользователя в канал Discord
 * @param {Object} client - Клиент Discord
 * @param {Object} user - Пользователь Discord
 * @param {Array} changedFields - Массив измененных полей
 * @returns {Promise<void>}
 */
async function logProfileChange(client, user, changedFields) {
  try {
    // Проверяем, настроен ли канал для логов
    const logChannelId = process.env.LOG_CHANNEL_ID;
    if (!logChannelId) {
      logger.warn('ID канала для логов не настроен в переменных окружения');
      return;
    }
    
    // Получаем канал для логов
    const logChannel = await client.channels.fetch(logChannelId);
    if (!logChannel) {
      logger.warn(`Канал для логов с ID ${logChannelId} не найден`);
      return;
    }
    
    // Формируем сообщение
    const changedFieldsText = changedFields.join(', ');
    const logMessage = `👤 **${user.tag}** (${user.id}) обновил профиль: ${changedFieldsText}`;
    
    // Отправляем сообщение в канал
    await logChannel.send(logMessage);
    
    logger.info(`Изменение профиля пользователя ${user.tag} (${user.id}) залогировано`);
  } catch (error) {
    logger.error(`Ошибка при логировании изменения профиля: ${error.message}`);
  }
}

/**
 * Логирует изменение профиля пользователя в базу данных
 * @param {string} adminId - ID администратора
 * @param {string} adminUsername - Имя пользователя администратора
 * @param {string} action - Действие
 * @param {string} details - Детали действия
 * @param {string} targetId - ID целевого объекта
 * @param {string} targetType - Тип целевого объекта
 * @returns {Promise<void>}
 */
async function logAdminAction(adminId, adminUsername, action, details, targetId, targetType) {
  try {
    const adminLog = new AdminLog({
      adminId,
      adminUsername,
      action,
      details,
      targetId,
      targetType
    });
    
    await adminLog.save();
    
    logger.info(`Действие администратора ${adminUsername} (${adminId}) залогировано`);
  } catch (error) {
    logger.error(`Ошибка при логировании действия администратора: ${error.message}`);
  }
}

/**
 * Отправляет логи через вебхук (если настроен)
 * @param {string} message - Сообщение для отправки
 * @returns {Promise<void>}
 */
async function sendWebhookLog(message) {
  try {
    // Проверяем, настроен ли вебхук
    const webhookUrl = process.env.LOG_WEBHOOK_URL;
    if (!webhookUrl) {
      return;
    }
    
    // Создаем клиент вебхука
    const webhookClient = new WebhookClient({ url: webhookUrl });
    
    // Отправляем сообщение
    await webhookClient.send({
      content: message,
      username: 'Synergy Bot Logs'
    });
    
    logger.info('Лог отправлен через вебхук');
  } catch (error) {
    logger.error(`Ошибка при отправке лога через вебхук: ${error.message}`);
  }
}

module.exports = {
  logProfileChange,
  logAdminAction,
  sendWebhookLog
};
