/**
 * Конфигурационный файл для подключения к базе данных MongoDB
 * Этот файл загружает переменные окружения из .env файла
 */

require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Получаем URI для подключения к базе данных из переменных окружения
const DATABASE_URI = process.env.DATABASE_URI;

// Проверяем наличие URI
if (!DATABASE_URI) {
    logger.error('Ошибка: Отсутствует переменная окружения DATABASE_URI.');
    logger.error('Убедитесь, что файл .env содержит DATABASE_URI.');
    logger.error('Пример: DATABASE_URI=mongodb://localhost:27017/synergy-bot');
    
    // Устанавливаем значение по умолчанию для локальной разработки
    const defaultUri = 'mongodb://localhost:27017/synergy-bot';
    logger.warn(`Используем URI по умолчанию: ${defaultUri}`);
    
    // Устанавливаем переменную окружения
    process.env.DATABASE_URI = defaultUri;
}

// Опции подключения к MongoDB
const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Таймаут выбора сервера: 5 секунд
    socketTimeoutMS: 45000, // Таймаут сокета: 45 секунд
    family: 4 // Используем IPv4, избегаем проблем с IPv6
};

// Функция для подключения к базе данных
async function connectToDatabase() {
    try {
        // Подключаемся к базе данных
        await mongoose.connect(process.env.DATABASE_URI, options);
        
        // Логируем успешное подключение
        logger.info(`Успешное подключение к базе данных MongoDB: ${process.env.DATABASE_URI}`);
        
        // Настраиваем обработчики событий Mongoose
        mongoose.connection.on('error', (err) => {
            logger.error(`Ошибка соединения с MongoDB: ${err.message}`);
        });
        
        mongoose.connection.on('disconnected', () => {
            logger.warn('Соединение с MongoDB разорвано');
        });
        
        // Обработка сигналов завершения процесса
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            logger.info('Соединение с MongoDB закрыто из-за завершения приложения');
            process.exit(0);
        });
        
        return mongoose.connection;
    } catch (error) {
        // Логируем ошибку подключения
        logger.error(`Ошибка подключения к базе данных MongoDB: ${error.message}`);
        
        // Если ошибка связана с аутентификацией, даем дополнительные рекомендации
        if (error.message.includes('Authentication failed')) {
            logger.error('Проверьте правильность имени пользователя и пароля в URI.');
        }
        
        // Если ошибка связана с подключением, даем рекомендации по проверке сети
        if (error.message.includes('connect ECONNREFUSED')) {
            logger.error('Не удалось подключиться к серверу MongoDB. Проверьте:');
            logger.error('1. Запущен ли сервер MongoDB');
            logger.error('2. Правильность хоста и порта в URI');
            logger.error('3. Настройки брандмауэра');
        }
        
        // Пробуем подключиться к локальной базе данных, если не указано иное
        if (!process.env.DATABASE_URI.includes('mongodb+srv')) {
            const localUri = 'mongodb://localhost:27017/synergy-bot';
            logger.warn(`Пробуем подключиться к локальной базе данных: ${localUri}`);
            
            try {
                // Устанавливаем переменную окружения
                process.env.DATABASE_URI = localUri;
                
                // Пробуем подключиться к локальной базе данных
                await mongoose.connect(localUri, options);
                logger.info(`Успешное подключение к локальной базе данных MongoDB: ${localUri}`);
                return mongoose.connection;
            } catch (localError) {
                logger.error(`Не удалось подключиться к локальной базе данных: ${localError.message}`);
                throw new Error('Не удалось подключиться к базе данных MongoDB');
            }
        }
        
        throw new Error('Не удалось подключиться к базе данных MongoDB');
    }
}

module.exports = {
    connectToDatabase,
    connection: mongoose.connection
};