const NodeCache = require('node-cache');
const logger = require('../utils/logger');

// Создаем экземпляр кэша
const cache = new NodeCache({
    stdTTL: process.env.CACHE_TTL || 300,
    checkperiod: process.env.CACHE_CHECK_PERIOD || 60
});

// Функция для инициализации кэша
function initializeCache() {
    logger.info('Database cache initialized');
    return cache;
}

// Функция для получения значения из кэша
function getCached(key) {
    return cache.get(key);
}

// Функция для сохранения значения в кэш
function setCached(key, value, ttl = null) {
    return cache.set(key, value, ttl);
}

// Функция для удаления значения из кэша
function deleteCached(key) {
    return cache.del(key);
}

// Функция для очистки всего кэша
function flushCache() {
    return cache.flushAll();
}

module.exports = {
    initializeCache,
    getCached,
    setCached,
    deleteCached,
    flushCache,
    cache
};