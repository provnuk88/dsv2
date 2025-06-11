/**
 * Модуль шаблонов мероприятий для Synergy Guild Bot
 * Управляет шаблонами для быстрого создания мероприятий
 */

const EventTemplate = require('../database/models/EventTemplate');
const Event = require('../database/models/Event');
const logger = require('./logger');
const { logAdminAction } = require('./profileLogger');

/**
 * Создает новый шаблон мероприятия
 * @param {Object} templateData - Данные шаблона
 * @param {string} creatorId - ID создателя шаблона
 * @returns {Promise<Object>} Созданный шаблон
 */
async function createTemplate(templateData, creatorId) {
  try {
    const template = new EventTemplate({
      name: templateData.name,
      description: templateData.description,
      creatorId: creatorId,
      defaultDuration: templateData.defaultDuration || 7,
      prizes: templateData.prizes,
      requiredFields: templateData.requiredFields || [],
      capacity: templateData.capacity
    });
    
    await template.save();
    
    logger.info(`Создан новый шаблон мероприятия "${template.name}" пользователем ${creatorId}`);
    
    return template;
  } catch (error) {
    logger.error(`Ошибка при создании шаблона мероприятия: ${error.message}`);
    throw error;
  }
}

/**
 * Получает список всех шаблонов мероприятий
 * @param {boolean} activeOnly - Получать только активные шаблоны
 * @returns {Promise<Array>} Список шаблонов
 */
async function getTemplates(activeOnly = true) {
  try {
    const query = activeOnly ? { isActive: true } : {};
    const templates = await EventTemplate.find(query).sort({ name: 1 });
    
    return templates;
  } catch (error) {
    logger.error(`Ошибка при получении списка шаблонов мероприятий: ${error.message}`);
    throw error;
  }
}

/**
 * Создает мероприятие на основе шаблона
 * @param {string} templateId - ID шаблона
 * @param {Object} eventData - Дополнительные данные мероприятия
 * @param {string} creatorId - ID создателя мероприятия
 * @returns {Promise<Object>} Созданное мероприятие
 */
async function createEventFromTemplate(templateId, eventData, creatorId) {
  try {
    // Находим шаблон
    const template = await EventTemplate.findById(templateId);
    
    if (!template) {
      throw new Error('Шаблон не найден');
    }
    
    // Создаем мероприятие на основе шаблона
    const startDate = eventData.startDate || new Date();
    const endDate = eventData.endDate || new Date(startDate);
    
    // Если дата окончания не указана, используем defaultDuration из шаблона
    if (!eventData.endDate) {
      endDate.setDate(endDate.getDate() + template.defaultDuration);
    }
    
    const event = new Event({
      name: eventData.name || template.name,
      description: eventData.description || template.description,
      creatorId: creatorId,
      startDate: startDate,
      endDate: endDate,
      prizes: eventData.prizes || template.prizes,
      requiredFields: eventData.requiredFields || template.requiredFields,
      capacity: eventData.capacity || template.capacity,
      templateId: template._id,
      isRecurring: eventData.isRecurring || false
    });
    
    await event.save();
    
    logger.info(`Создано новое мероприятие "${event.name}" на основе шаблона "${template.name}" пользователем ${creatorId}`);
    
    // Логируем действие администратора
    await logAdminAction(
      creatorId,
      eventData.creatorUsername || 'Unknown',
      'create_event_from_template',
      `Создано мероприятие "${event.name}" на основе шаблона "${template.name}"`,
      event._id,
      'event'
    );
    
    return event;
  } catch (error) {
    logger.error(`Ошибка при создании мероприятия из шаблона: ${error.message}`);
    throw error;
  }
}

/**
 * Обновляет шаблон мероприятия
 * @param {string} templateId - ID шаблона
 * @param {Object} templateData - Новые данные шаблона
 * @param {string} adminId - ID администратора
 * @returns {Promise<Object>} Обновленный шаблон
 */
async function updateTemplate(templateId, templateData, adminId) {
  try {
    const template = await EventTemplate.findById(templateId);
    
    if (!template) {
      throw new Error('Шаблон не найден');
    }
    
    // Обновляем поля шаблона
    if (templateData.name) template.name = templateData.name;
    if (templateData.description !== undefined) template.description = templateData.description;
    if (templateData.defaultDuration) template.defaultDuration = templateData.defaultDuration;
    if (templateData.prizes !== undefined) template.prizes = templateData.prizes;
    if (templateData.requiredFields) template.requiredFields = templateData.requiredFields;
    if (templateData.capacity !== undefined) template.capacity = templateData.capacity;
    if (templateData.isActive !== undefined) template.isActive = templateData.isActive;
    
    template.updatedAt = new Date();
    
    await template.save();
    
    logger.info(`Шаблон мероприятия "${template.name}" обновлен пользователем ${adminId}`);
    
    // Логируем действие администратора
    await logAdminAction(
      adminId,
      templateData.adminUsername || 'Unknown',
      'update_template',
      `Обновлен шаблон мероприятия "${template.name}"`,
      template._id,
      'template'
    );
    
    return template;
  } catch (error) {
    logger.error(`Ошибка при обновлении шаблона мероприятия: ${error.message}`);
    throw error;
  }
}

/**
 * Удаляет шаблон мероприятия (мягкое удаление)
 * @param {string} templateId - ID шаблона
 * @param {string} adminId - ID администратора
 * @returns {Promise<Object>} Результат операции
 */
async function deleteTemplate(templateId, adminId) {
  try {
    const template = await EventTemplate.findById(templateId);
    
    if (!template) {
      throw new Error('Шаблон не найден');
    }
    
    // Мягкое удаление (деактивация)
    template.isActive = false;
    template.updatedAt = new Date();
    
    await template.save();
    
    logger.info(`Шаблон мероприятия "${template.name}" деактивирован пользователем ${adminId}`);
    
    // Логируем действие администратора
    await logAdminAction(
      adminId,
      'Unknown', // adminUsername будет передан при вызове
      'delete_template',
      `Деактивирован шаблон мероприятия "${template.name}"`,
      template._id,
      'template'
    );
    
    return {
      success: true,
      message: `Шаблон "${template.name}" успешно деактивирован`
    };
  } catch (error) {
    logger.error(`Ошибка при удалении шаблона мероприятия: ${error.message}`);
    throw error;
  }
}

module.exports = {
  createTemplate,
  getTemplates,
  createEventFromTemplate,
  updateTemplate,
  deleteTemplate
};
