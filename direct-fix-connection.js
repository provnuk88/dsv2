/**
 * Прямое исправление для файла src/database/connection.js
 * Этот файл решает проблему с подключением к MongoDB
 */

require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Устанавливаем DATABASE_URI напрямую, если он не определен
if (!process.env.DATABASE_URI) {
    process.env.DATABASE_URI = 'mongodb://localhost:27017/synergy-bot';
    logger.warn(`DATABASE_URI не найден в .env, используем значение по умолчанию: ${process.env.DATABASE_URI}`);
}

// Опции подключения к MongoDB
const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4
};

// Функция для подключения к базе данных
async function connectToDatabase() {
    try {
        // Явно используем строковое значение для URI вместо process.env
        const dbUri = String(process.env.DATABASE_URI);
        
        // Проверяем, что URI не пустой
        if (!dbUri || dbUri === 'undefined') {
            throw new Error('DATABASE_URI не определен или пустой');
        }
        
        logger.info(`Попытка подключения к MongoDB с URI: ${dbUri}`);
        
        // Подключаемся к базе данных с явным URI
        await mongoose.connect(dbUri, options);
        
        logger.info(`Успешное подключение к базе данных MongoDB: ${dbUri}`);
        
        mongoose.connection.on('error', (err) => {
            logger.error(`Ошибка соединения с MongoDB: ${err.message}`);
        });
        
        mongoose.connection.on('disconnected', () => {
            logger.warn('Соединение с MongoDB разорвано');
        });
        
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            logger.info('Соединение с MongoDB закрыто из-за завершения приложения');
            process.exit(0);
        });
        
        return mongoose.connection;
    } catch (error) {
        logger.error(`Ошибка подключения к базе данных MongoDB: ${error.message}`);
        
        // Пробуем подключиться к локальной базе данных напрямую
        try {
            const localUri = 'mongodb://localhost:27017/synergy-bot';
            logger.warn(`Пробуем подключиться напрямую к локальной базе данных: ${localUri}`);
            
            await mongoose.connect(localUri, options);
            logger.info(`Успешное подключение к локальной базе данных MongoDB: ${localUri}`);
            return mongoose.connection;
        } catch (localError) {
            logger.error(`Не удалось подключиться к локальной базе данных: ${localError.message}`);
            throw new Error('Не удалось подключиться к базе данных MongoDB');
        }
    }
}

module.exports = {
    connectToDatabase,
    connection: mongoose.connection
};
