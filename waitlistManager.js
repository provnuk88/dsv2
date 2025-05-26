/**
 * Модуль поддержки листа ожидания для Synergy Guild Bot
 * Управляет листом ожидания для мероприятий с ограниченным количеством мест
 */

const Registration = require('../database/models/Registration');
const Event = require('../database/models/Event');
const logger = require('./logger');

/**
 * Добавляет пользователя в лист ожидания
 * @param {string} discordId - ID пользователя Discord
 * @param {string} eventId - ID мероприятия
 * @returns {Promise<Object>} Результат операции с позицией в листе ожидания
 */
async function addToWaitlist(eventId, discordId) {
  try {
    // Проверяем, существует ли уже регистрация
    const existingRegistration = await Registration.findOne({
      discordId,
      eventId
    });
    
    if (existingRegistration) {
      // Если пользователь уже в листе ожидания, возвращаем его позицию
      if (existingRegistration.status === 'waitlist') {
        return {
          success: true,
          message: 'Вы уже находитесь в листе ожидания',
          position: existingRegistration.waitlistPosition
        };
      }
      
      // Если пользователь уже зарегистрирован, возвращаем ошибку
      if (existingRegistration.status === 'confirmed') {
        return {
          success: false,
          message: 'Вы уже зарегистрированы на это мероприятие'
        };
      }
    }
    
    // Находим мероприятие
    const event = await Event.findById(eventId);
    
    if (!event) {
      return {
        success: false,
        message: 'Мероприятие не найдено'
      };
    }
    
    // Проверяем, активно ли мероприятие
    if (!event.isActive) {
      return {
        success: false,
        message: 'Регистрация на это мероприятие закрыта'
      };
    }
    
    // Находим последнюю позицию в листе ожидания
    const lastWaitlistRegistration = await Registration.findOne({
      eventId,
      status: 'waitlist'
    }).sort({ waitlistPosition: -1 });
    
    const nextPosition = lastWaitlistRegistration ? lastWaitlistRegistration.waitlistPosition + 1 : 1;
    
    // Создаем новую регистрацию или обновляем существующую
    let registration;
    
    if (existingRegistration) {
      existingRegistration.status = 'waitlist';
      existingRegistration.waitlistPosition = nextPosition;
      existingRegistration.updatedAt = new Date();
      registration = await existingRegistration.save();
    } else {
      registration = new Registration({
        discordId,
        eventId,
        status: 'waitlist',
        waitlistPosition: nextPosition
      });
      
      await registration.save();
    }
    
    logger.info(`Пользователь ${discordId} добавлен в лист ожидания мероприятия ${eventId} на позицию ${nextPosition}`);
    
    return {
      success: true,
      message: `Вы добавлены в лист ожидания на позицию ${nextPosition}`,
      position: nextPosition
    };
  } catch (error) {
    logger.error(`Ошибка при добавлении в лист ожидания: ${error.message}`);
    throw error;
  }
}

/**
 * Продвигает пользователя из листа ожидания при освобождении места
 * @param {string} eventId - ID мероприятия
 * @returns {Promise<Object|null>} Информация о продвинутом пользователе или null, если лист ожидания пуст
 */
async function promoteFromWaitlist(eventId) {
  try {
    // Находим первого пользователя в листе ожидания
    const waitlistRegistration = await Registration.findOne({
      eventId,
      status: 'waitlist'
    }).sort({ waitlistPosition: 1 });
    
    if (!waitlistRegistration) {
      logger.info(`Лист ожидания для мероприятия ${eventId} пуст`);
      return null;
    }
    
    // Обновляем статус регистрации
    waitlistRegistration.status = 'confirmed';
    waitlistRegistration.promotedAt = new Date();
    waitlistRegistration.updatedAt = new Date();
    
    await waitlistRegistration.save();
    
    logger.info(`Пользователь ${waitlistRegistration.discordId} продвинут из листа ожидания мероприятия ${eventId}`);
    
    // Перестраиваем позиции в листе ожидания
    await reorderWaitlist(eventId);
    
    return {
      discordId: waitlistRegistration.discordId,
      eventId: waitlistRegistration.eventId,
      promotedAt: waitlistRegistration.promotedAt
    };
  } catch (error) {
    logger.error(`Ошибка при продвижении из листа ожидания: ${error.message}`);
    throw error;
  }
}

/**
 * Перестраивает позиции в листе ожидания после продвижения пользователя
 * @param {string} eventId - ID мероприятия
 * @returns {Promise<void>}
 */
async function reorderWaitlist(eventId) {
  try {
    // Находим все регистрации в листе ожидания
    const waitlistRegistrations = await Registration.find({
      eventId,
      status: 'waitlist'
    }).sort({ waitlistPosition: 1 });
    
    // Обновляем позиции
    for (let i = 0; i < waitlistRegistrations.length; i++) {
      const registration = waitlistRegistrations[i];
      registration.waitlistPosition = i + 1;
      await registration.save();
    }
    
    logger.info(`Лист ожидания для мероприятия ${eventId} перестроен`);
  } catch (error) {
    logger.error(`Ошибка при перестроении листа ожидания: ${error.message}`);
    throw error;
  }
}

/**
 * Получает информацию о листе ожидания для мероприятия
 * @param {string} eventId - ID мероприятия
 * @returns {Promise<Object>} Информация о листе ожидания
 */
async function getWaitlistInfo(eventId) {
  try {
    // Находим все регистрации в листе ожидания
    const waitlistRegistrations = await Registration.find({
      eventId,
      status: 'waitlist'
    }).sort({ waitlistPosition: 1 });
    
    return {
      count: waitlistRegistrations.length,
      registrations: waitlistRegistrations
    };
  } catch (error) {
    logger.error(`Ошибка при получении информации о листе ожидания: ${error.message}`);
    throw error;
  }
}

/**
 * Проверяет, находится ли пользователь в листе ожидания
 * @param {string} eventId - ID мероприятия
 * @param {string} discordId - ID пользователя Discord
 * @returns {Promise<boolean>} Находится ли пользователь в листе ожидания
 */
async function isInWaitlist(eventId, discordId) {
  try {
    const registration = await Registration.findOne({
      discordId,
      eventId,
      status: 'waitlist'
    });
    
    return !!registration;
  } catch (error) {
    logger.error(`Ошибка при проверке листа ожидания: ${error.message}`);
    throw error;
  }
}

/**
 * Получает следующего пользователя из листа ожидания
 * @param {string} eventId - ID мероприятия
 * @returns {Promise<string|null>} ID пользователя Discord или null, если лист ожидания пуст
 */
async function getNextWaitlistUser(eventId) {
  try {
    const waitlistRegistration = await Registration.findOne({
      eventId,
      status: 'waitlist'
    }).sort({ waitlistPosition: 1 });
    
    return waitlistRegistration ? waitlistRegistration.discordId : null;
  } catch (error) {
    logger.error(`Ошибка при получении следующего пользователя из листа ожидания: ${error.message}`);
    throw error;
  }
}

/**
 * Удаляет пользователя из листа ожидания
 * @param {string} eventId - ID мероприятия
 * @param {string} discordId - ID пользователя Discord
 * @returns {Promise<Object>} Результат операции
 */
async function removeFromWaitlist(eventId, discordId) {
  try {
    // Находим регистрацию
    const registration = await Registration.findOne({
      discordId,
      eventId,
      status: 'waitlist'
    });
    
    if (!registration) {
      return {
        success: false,
        message: 'Вы не находитесь в листе ожидания на это мероприятие'
      };
    }
    
    // Удаляем регистрацию
    await Registration.deleteOne({ _id: registration._id });
    
    logger.info(`Пользователь ${discordId} удален из листа ожидания мероприятия ${eventId}`);
    
    // Перестраиваем позиции в листе ожидания
    await reorderWaitlist(eventId);
    
    return {
      success: true,
      message: 'Вы успешно удалены из листа ожидания'
    };
  } catch (error) {
    logger.error(`Ошибка при удалении из листа ожидания: ${error.message}`);
    throw error;
  }
}

module.exports = {
  addToWaitlist,
  promoteFromWaitlist,
  reorderWaitlist,
  getWaitlistInfo,
  isInWaitlist,
  getNextWaitlistUser,
  removeFromWaitlist
};
