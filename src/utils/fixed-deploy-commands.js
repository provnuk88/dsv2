/**
 * Улучшенный скрипт для регистрации команд Discord-бота Synergy Guild
 * Этот скрипт регистрирует все команды бота на сервере Discord
 * и автоматически устанавливает необходимые зависимости
 */

// Импортируем необходимые модули
const fs = require('fs');
const path = require('path');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');

// Загружаем переменные окружения из .env файла
try {
    require('dotenv').config();
    console.log('Файл .env успешно загружен');
} catch (error) {
    console.error('Ошибка при загрузке файла .env:', error.message);
    console.log('Проверяем наличие файла .env...');
    
    // Проверяем наличие файла .env
    if (!fs.existsSync(path.join(__dirname, '.env'))) {
        console.error('Файл .env не найден в директории:', __dirname);
        console.log('Создаем файл .env с настройками по умолчанию...');
        
        // Создаем файл .env с настройками по умолчанию
        const defaultEnv = `# Основные настройки бота
BOT_TOKEN=ВАШ_ТОКЕН_БОТА
CLIENT_ID=1373221850980810772
GUILD_ID=390234295626760194

# ID каналов
CHANNEL_ANNOUNCEMENTS=1376461371499221132
CHANNEL_EVENTS=1376461410405449830
CHANNEL_LOGS=1376461438956339281
CHANNEL_WELCOME=1376461462167490631

# ID ролей
ROLE_ADMIN=1374341236256935978
ROLE_MODERATOR=1376461767009632337
ROLE_MEMBER=1376461767009632337

# Настройки базы данных MongoDB
DATABASE_URI=mongodb://localhost:27017/synergy-bot

# Настройки кэширования
CACHE_TTL=300
CACHE_CHECK_PERIOD=60

# Настройки уведомлений
EVENT_REMINDER_HOURS=24
USE_DM=true
USE_CHANNEL=true`;
        
        fs.writeFileSync(path.join(__dirname, '.env'), defaultEnv);
        console.log('Файл .env создан. Пожалуйста, отредактируйте его и запустите скрипт снова.');
        process.exit(1);
    }
}

// Устанавливаем DATABASE_URI напрямую, если он не определен
if (!process.env.DATABASE_URI) {
    console.warn('Переменная DATABASE_URI не найдена в .env файле');
    console.log('Устанавливаем DATABASE_URI по умолчанию: mongodb://localhost:27017/synergy-bot');
    process.env.DATABASE_URI = 'mongodb://localhost:27017/synergy-bot';
}

// Получаем токен бота и ID из переменных окружения
const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

// Проверяем наличие необходимых переменных окружения
if (!token || !clientId || !guildId) {
    console.error('Ошибка: Отсутствуют необходимые переменные окружения.');
    console.error('Убедитесь, что файл .env содержит BOT_TOKEN, CLIENT_ID и GUILD_ID.');
    process.exit(1);
}

// Создаем массив для хранения команд
const commands = [];

// Функция для рекурсивного поиска файлов команд
function findCommandFiles(dir) {
    const files = fs.readdirSync(dir);
    const commandFiles = [];
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            // Рекурсивно ищем файлы в поддиректориях
            commandFiles.push(...findCommandFiles(filePath));
        } else if (file.endsWith('.js') && !file.includes('test')) {
            // Добавляем только .js файлы, исключая тестовые файлы
            commandFiles.push(filePath);
        }
    }
    
    return commandFiles;
}

// Путь к директории команд
const commandsPath = path.join(__dirname, 'src', 'commands');
console.log(`Путь к директории команд: ${commandsPath}`);

// Проверяем наличие директории
if (!fs.existsSync(commandsPath)) {
    console.error(`Ошибка: Директория команд не найдена: ${commandsPath}`);
    process.exit(1);
}

// Получаем все файлы команд
const commandFiles = findCommandFiles(commandsPath);
console.log(`Найдены файлы команд: ${JSON.stringify(commandFiles.map(file => path.basename(file)), null, 2)}`);

// Устанавливаем недостающие зависимости
try {
    // Проверяем наличие node-cache
    require('node-cache');
} catch (error) {
    console.log('Устанавливаем недостающие зависимости...');
    require('child_process').execSync('npm install node-cache dotenv mongoose --save', { stdio: 'inherit' });
    console.log('Зависимости установлены успешно.');
}

// Проверяем и исправляем файл подключения к базе данных
const dbConnectionPath = path.join(__dirname, 'src', 'database', 'connection.js');
if (fs.existsSync(dbConnectionPath)) {
    console.log('Проверяем файл подключения к базе данных...');
    const connectionContent = fs.readFileSync(dbConnectionPath, 'utf8');
    
    // Если файл не содержит проверку на undefined DATABASE_URI, исправляем его
    if (!connectionContent.includes('!DATABASE_URI')) {
        console.log('Исправляем файл подключения к базе данных...');
        
        const improvedConnection = `/**
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
    logger.warn(\`Используем URI по умолчанию: \${defaultUri}\`);
    
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
        logger.info(\`Успешное подключение к базе данных MongoDB: \${process.env.DATABASE_URI}\`);
        
        // Настраиваем обработчики событий Mongoose
        mongoose.connection.on('error', (err) => {
            logger.error(\`Ошибка соединения с MongoDB: \${err.message}\`);
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
        logger.error(\`Ошибка подключения к базе данных MongoDB: \${error.message}\`);
        
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
            logger.warn(\`Пробуем подключиться к локальной базе данных: \${localUri}\`);
            
            try {
                // Устанавливаем переменную окружения
                process.env.DATABASE_URI = localUri;
                
                // Пробуем подключиться к локальной базе данных
                await mongoose.connect(localUri, options);
                logger.info(\`Успешное подключение к локальной базе данных MongoDB: \${localUri}\`);
                return mongoose.connection;
            } catch (localError) {
                logger.error(\`Не удалось подключиться к локальной базе данных: \${localError.message}\`);
                throw new Error('Не удалось подключиться к базе данных MongoDB');
            }
        }
        
        throw new Error('Не удалось подключиться к базе данных MongoDB');
    }
}

module.exports = {
    connectToDatabase,
    connection: mongoose.connection
};`;
        
        fs.writeFileSync(dbConnectionPath, improvedConnection);
        console.log('Файл подключения к базе данных успешно исправлен');
    }
}

// Загружаем команды из файлов
for (const file of commandFiles) {
    try {
        console.log(`Загружаем команду из: ${file}`);
        
        // Проверяем переменные окружения
        console.log('Проверка переменных окружения:');
        console.log(`BOT_TOKEN: Токен загружен (первые 5 символов: ${token.substring(0, 5)}...)`);
        console.log(`CLIENT_ID: ${clientId}`);
        console.log(`GUILD_ID: ${guildId}`);
        console.log(`DATABASE_URI: ${process.env.DATABASE_URI}`);
        
        // Загружаем команду
        const command = require(file);
        
        // Проверяем, что команда имеет правильную структуру
        if (command.data && typeof command.data.toJSON === 'function') {
            commands.push(command.data.toJSON());
        } else {
            console.warn(`Предупреждение: Команда в файле ${file} не имеет метода data.toJSON()`);
        }
    } catch (error) {
        console.error(`Ошибка при загрузке команды ${file}: ${error.message}`);
        console.error('Require stack:');
        if (error.requireStack) {
            error.requireStack.forEach(stack => console.error(`- ${stack}`));
        }
        
        // Выводим дополнительную информацию об ошибке
        if (error.code === 'MODULE_NOT_FOUND') {
            const missingModule = error.message.match(/'([^']+)'/)[1];
            console.error(`Отсутствует модуль: ${missingModule}`);
            console.error('Попробуйте установить его с помощью npm:');
            console.error(`npm install ${missingModule} --save`);
        }
    }
}

// Создаем экземпляр REST API клиента
const rest = new REST({ version: '10' }).setToken(token);

// Функция для регистрации команд
async function registerCommands() {
    try {
        console.log(`Начинаем регистрацию ${commands.length} команд...`);
        
        // Регистрируем команды на сервере
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );
        
        console.log(`Успешно зарегистрировано ${data.length} команд!`);
        
        // Выводим список зарегистрированных команд
        console.log('Зарегистрированные команды:');
        data.forEach(cmd => {
            console.log(`- ${cmd.name}: ${cmd.description}`);
        });
    } catch (error) {
        console.error('Ошибка при регистрации команд:');
        console.error(error);
    }
}

// Запускаем регистрацию команд
registerCommands();
