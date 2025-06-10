// Система ограничения частоты запросов
const userRateLimits = new Map();

// Проверка, превышен ли лимит запросов
const isRateLimited = (userId, commandName, limit = 5, timeWindow = 60000) => {
    const key = `${userId}-${commandName}`;
    const now = Date.now();
    
    if (!userRateLimits.has(key)) {
        userRateLimits.set(key, [now]);
        return false;
    }
    
    const userTimestamps = userRateLimits.get(key);
    
    // Удаляем устаревшие метки времени
    const validTimestamps = userTimestamps.filter(timestamp => now - timestamp < timeWindow);
    
    // Если количество запросов в окне времени меньше лимита, пользователь не ограничен
    if (validTimestamps.length < limit) {
        validTimestamps.push(now);
        userRateLimits.set(key, validTimestamps);
        return false;
    }
    
    // Пользователь превысил лимит
    userRateLimits.set(key, validTimestamps);
    return true;
};

// Получение оставшегося времени до сброса ограничения
const getRemainingTime = (userId, commandName, timeWindow = 60000) => {
    const key = `${userId}-${commandName}`;
    
    if (!userRateLimits.has(key)) {
        return 0;
    }
    
    const userTimestamps = userRateLimits.get(key);
    if (userTimestamps.length === 0) {
        return 0;
    }
    
    const oldestTimestamp = Math.min(...userTimestamps);
    const now = Date.now();
    const remainingTime = timeWindow - (now - oldestTimestamp);
    
    return remainingTime > 0 ? Math.ceil(remainingTime / 1000) : 0;
};

module.exports = {
    isRateLimited,
    getRemainingTime
};
