/**
 * Event-driven архитектура для обработки событий бота
 */

const logger = require('../utils/logger');
const { EventEmitter } = require('events');

// Создаем глобальный эмиттер событий
const botEvents = new EventEmitter();

// Функция для инициализации обработчиков событий
function initializeEventHandlers(client) {
    logger.info('Bot event handlers initialized');
    return botEvents;
}

// Функция для отправки события
function emitEvent(eventName, data) {
    botEvents.emit(eventName, data);
}

// Функция для подписки на событие
function onEvent(eventName, callback) {
    botEvents.on(eventName, callback);
}

// Функция для однократной подписки на событие
function onceEvent(eventName, callback) {
    botEvents.once(eventName, callback);
}

module.exports = {
    initializeEventHandlers,
    emitEvent,
    onEvent,
    onceEvent,
    botEvents
};
