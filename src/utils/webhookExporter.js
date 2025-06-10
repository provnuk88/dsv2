/**
 * Модуль экспорта данных через вебхуки для Synergy Guild Bot
 * Позволяет экспортировать данные о регистрациях и мероприятиях во внешние системы
 */

const axios = require('axios');
const { Parser } = require('json2csv');
const Event = require('../database/models/Event');
const Registration = require('../database/models/Registration');
const User = require('../database/models/User');
const logger = require('./logger');

/**
 * Экспортирует данные о регистрациях на мероприятие через вебхук
 * @param {string} eventId - ID мероприятия
 * @param {string} webhookUrl - URL вебхука для отправки данных
 * @returns {Promise<Object>} Результат операции
 */
async function exportRegistrationsToWebhook(eventId, webhookUrl) {
  try {
    // Проверяем URL вебхука
    if (!webhookUrl) {
      webhookUrl = process.env.WEBHOOK_URL;
      
      if (!webhookUrl) {
        throw new Error('URL вебхука не указан и не настроен в переменных окружения');
      }
    }
    
    // Находим мероприятие
    const event = await Event.findById(eventId);
    
    if (!event) {
      throw new Error('Мероприятие не найдено');
    }
    
    // Находим все подтвержденные регистрации
    const registrations = await Registration.find({
      eventId,
      status: 'confirmed'
    });
    
    // Собираем данные пользователей
    const registrationData = [];
    
    for (const registration of registrations) {
      const user = await User.findOne({ discordId: registration.userId });
      
      if (user) {
        registrationData.push({
          discordId: user.discordId,
          username: user.username,
          wallets: user.wallets.join(', '),
          telegram: user.nicknames?.telegram || '',
          twitter: user.nicknames?.twitter || '',
          registeredAt: registration.registeredAt.toISOString(),
          additionalData: registration.additionalData ? 
            JSON.stringify(Object.fromEntries(registration.additionalData)) : ''
        });
      }
    }
    
    // Преобразуем данные в CSV
    const fields = ['discordId', 'username', 'wallets', 'telegram', 'twitter', 'registeredAt', 'additionalData'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(registrationData);
    
    // Отправляем данные через вебхук
    const response = await axios.post(webhookUrl, {
      eventName: event.name,
      eventId: event._id.toString(),
      registrationsCount: registrationData.length,
      registrationsData: csv,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`Данные о регистрациях на мероприятие "${event.name}" успешно экспортированы через вебхук`);
    
    return {
      success: true,
      message: `Данные о ${registrationData.length} регистрациях успешно экспортированы`,
      statusCode: response.status
    };
  } catch (error) {
    logger.error(`Ошибка при экспорте данных через вебхук: ${error.message}`);
    throw error;
  }
}

/**
 * Экспортирует данные о мероприятии через вебхук
 * @param {string} eventId - ID мероприятия
 * @param {string} webhookUrl - URL вебхука для отправки данных
 * @returns {Promise<Object>} Результат операции
 */
async function exportEventToWebhook(eventId, webhookUrl) {
  try {
    // Проверяем URL вебхука
    if (!webhookUrl) {
      webhookUrl = process.env.WEBHOOK_URL;
      
      if (!webhookUrl) {
        throw new Error('URL вебхука не указан и не настроен в переменных окружения');
      }
    }
    
    // Находим мероприятие
    const event = await Event.findById(eventId);
    
    if (!event) {
      throw new Error('Мероприятие не найдено');
    }
    
    // Отправляем данные через вебхук
    const response = await axios.post(webhookUrl, {
      eventName: event.name,
      eventId: event._id.toString(),
      description: event.description,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      prizes: event.prizes,
      requiredFields: event.requiredFields,
      capacity: event.capacity,
      isActive: event.isActive,
      isRecurring: event.isRecurring,
      createdAt: event.createdAt.toISOString(),
      timestamp: new Date().toISOString()
    });
    
    logger.info(`Данные о мероприятии "${event.name}" успешно экспортированы через вебхук`);
    
    return {
      success: true,
      message: 'Данные о мероприятии успешно экспортированы',
      statusCode: response.status
    };
  } catch (error) {
    logger.error(`Ошибка при экспорте данных о мероприятии через вебхук: ${error.message}`);
    throw error;
  }
}

/**
 * Экспортирует данные о пользователях через вебхук
 * @param {Array} userIds - Массив ID пользователей Discord
 * @param {string} webhookUrl - URL вебхука для отправки данных
 * @returns {Promise<Object>} Результат операции
 */
async function exportUsersToWebhook(userIds, webhookUrl) {
  try {
    // Проверяем URL вебхука
    if (!webhookUrl) {
      webhookUrl = process.env.WEBHOOK_URL;
      
      if (!webhookUrl) {
        throw new Error('URL вебхука не указан и не настроен в переменных окружения');
      }
    }
    
    // Находим пользователей
    const users = await User.find({
      discordId: { $in: userIds }
    });
    
    if (users.length === 0) {
      throw new Error('Пользователи не найдены');
    }
    
    // Подготавливаем данные пользователей
    const userData = users.map(user => ({
      discordId: user.discordId,
      username: user.username,
      wallets: user.wallets.join(', '),
      telegram: user.nicknames?.telegram || '',
      twitter: user.nicknames?.twitter || '',
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    }));
    
    // Преобразуем данные в CSV
    const fields = ['discordId', 'username', 'wallets', 'telegram', 'twitter', 'createdAt', 'updatedAt'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(userData);
    
    // Отправляем данные через вебхук
    const response = await axios.post(webhookUrl, {
      usersCount: userData.length,
      usersData: csv,
      timestamp: new Date().toISOString()
    });
    
    logger.info(`Данные о ${userData.length} пользователях успешно экспортированы через вебхук`);
    
    return {
      success: true,
      message: `Данные о ${userData.length} пользователях успешно экспортированы`,
      statusCode: response.status
    };
  } catch (error) {
    logger.error(`Ошибка при экспорте данных о пользователях через вебхук: ${error.message}`);
    throw error;
  }
}

module.exports = {
  exportRegistrationsToWebhook,
  exportEventToWebhook,
  exportUsersToWebhook
};
