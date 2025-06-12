// Планировщик событий для мероприятий
const cron = require('node-cron');
const Event = require('../database/models/Event');
const Registration = require('../database/models/Registration');
const reminderService = require('./reminderService');
const logger = require('./logger');

const reminderJobs = new Map();
const closureJobs = new Map();

// Инициализация планировщика
const initialize = async () => {
    // Ежечасно проверяем, нужно ли отправить напоминания
    cron.schedule('*/1 * * * *', checkAndSendReminders);
    // Каждые пять минут закрываем истекшие мероприятия
    cron.schedule('*/5 * * * *', closeExpiredEvents);
    logger.info('Event scheduler initialized');
    return true;
};

// Планирование индивидуального напоминания для мероприятия
const scheduleEventReminders = (event) => {
    const reminderDate = new Date(new Date(event.startDate).getTime() - 60 * 60 * 1000);
    if (reminderDate <= new Date()) {
        return;
    }
    const expression = `${reminderDate.getMinutes()} ${reminderDate.getHours()} ${reminderDate.getDate()} ${reminderDate.getMonth() + 1} *`;
    const job = cron.schedule(expression, async () => {
        await sendReminderForEvent(event);
    });
    reminderJobs.set(event._id.toString(), job);
};

// Планирование закрытия мероприятия
const scheduleEventClosure = (event) => {
    const endDate = new Date(event.endDate);
    if (endDate <= new Date()) {
        return;
    }
    const expression = `${endDate.getMinutes()} ${endDate.getHours()} ${endDate.getDate()} ${endDate.getMonth() + 1} *`;
    const job = cron.schedule(expression, async () => {
        await closeEvent(event._id);
    });
    closureJobs.set(event._id.toString(), job);
};

// Отправка напоминаний о мероприятии
const sendReminderForEvent = async (event) => {
    await reminderService.sendReminder(event);
    event.stats = event.stats || {};
    event.stats.reminderSent = true;
    await event.save();
};

// Проверка и отправка напоминаний о предстоящих мероприятиях
const checkAndSendReminders = async () => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const events = await Event.find({
        active: true,
        startDate: { $gt: now, $lte: oneHourLater },
        'stats.reminderSent': { $ne: true }
    });
    for (const event of events) {
        await sendReminderForEvent(event);
    }
};

// Закрытие истекших мероприятий
const closeEvent = async (eventId) => {
    const event = await Event.findById(eventId);
    if (!event || !event.active) return;
    await Registration.updateMany({ eventId: event._id, status: 'confirmed' }, { status: 'completed' });
    event.active = false;
    await event.save();
};

const closeExpiredEvents = async () => {
    const now = new Date();
    const events = await Event.find({ active: true, endDate: { $lt: now } });
    for (const event of events) {
        await closeEvent(event._id);
    }
};

// Обработка отмены регистрации
const handleCancellation = async (userId, eventId) => {
    await Registration.deleteOne({ discordId: userId, eventId });
    logger.info(`Registration of user ${userId} for event ${eventId} cancelled`);
};

module.exports = {
    initialize,
    scheduleEventReminders,
    scheduleEventClosure,
    checkAndSendReminders,
    closeExpiredEvents,
    handleCancellation
};
