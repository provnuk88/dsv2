# Структура проекта Synergy Guild Bot

## Корневая директория
```
synergy-bot-final/
├── package.json         # Конфигурация проекта и зависимости
├── package-lock.json    # Фиксация версий зависимостей
├── .env.example         # Пример файла с переменными окружения
├── README.md            # Документация на английском
├── README-ru.md         # Документация на русском
└── src/                 # Исходный код
    └── deploy-commands.js   # Скрипт для регистрации команд
```

## Директория src
```
src/
├── index.js             # Основной файл бота
├── commands/            # Команды бота
│   ├── user/            # Команды для обычных пользователей
│   └── admin/           # Команды для администраторов
├── events/              # Обработчики событий
├── database/            # Работа с базой данных
│   ├── connection.js    # Подключение к базе данных
│   └── models/          # Модели базы данных
├── utils/               # Утилиты и вспомогательные функции
└── config/              # Конфигурационные файлы
```

## Модели базы данных
```
database/models/
├── User.js              # Модель пользователя
├── Event.js             # Модель мероприятия
├── Registration.js      # Модель регистрации
├── AdminLog.js          # Модель логирования действий администраторов
├── EventTemplate.js     # Модель шаблона мероприятия
└── ScheduledAnnouncement.js # Модель запланированного объявления
```

## Команды пользователя
```
commands/user/
├── profile.js           # Просмотр и редактирование профиля
├── register.js          # Регистрация на мероприятие
├── help.js              # Справка по командам
└── status.js            # Проверка состояния бота
```

## Команды администратора
```
commands/admin/
├── createEvent.js       # Создание мероприятия
├── manageEvents.js      # Управление мероприятиями
├── manageUsers.js       # Управление пользователями
├── exportData.js        # Экспорт данных
└── announce.js          # Создание объявлений
```

## Обработчики событий
```
events/
├── ready.js             # Обработчик события готовности бота
├── interactionCreate.js # Обработчик взаимодействий
└── messageCreate.js     # Обработчик сообщений
```

## Утилиты
```
utils/
├── logger.js            # Логирование
├── walletValidator.js   # Валидация кошельков
├── rateLimiter.js       # Ограничение частоты запросов
├── eventScheduler.js    # Планировщик мероприятий
├── profileLogger.js     # Логирование изменений профиля
├── commandPermissions.js # Настройка разрешений команд
├── eventTemplates.js    # Работа с шаблонами мероприятий
├── waitlistManager.js   # Управление листом ожидания
├── webhookExporter.js   # Экспорт данных через вебхуки
└── announcementScheduler.js # Планировщик объявлений
```

## Зависимости проекта
```json
{
  "dependencies": {
    "discord.js": "^14.14.1",
    "dotenv": "^16.3.1",
    "mongoose": "^8.0.3",
    "winston": "^3.11.0",
    "node-cron": "^3.0.3",
    "axios": "^1.6.2",
    "json2csv": "^6.0.0-alpha.2"
  }
}
```

## Переменные окружения
```
# Токен Discord-бота
DISCORD_TOKEN=your_discord_bot_token_here

# ID приложения Discord
CLIENT_ID=your_client_id_here

# ID сервера Discord
GUILD_ID=your_guild_id_here

# URI подключения к MongoDB
DATABASE_URI=mongodb://localhost:27017/synergy_bot

# ID канала для логов
LOG_CHANNEL_ID=your_log_channel_id_here
LOG_WEBHOOK_URL=your_log_webhook_url_here
ANNOUNCEMENT_CHANNEL_ID=your_announcement_channel_id_here
NOTIFICATION_CHANNEL_ID=your_notification_channel_id_here
WEBHOOK_URL=your_export_webhook_url_here
CACHE_TTL=300
CACHE_CHECK_PERIOD=60

# ID ролей
ADMIN_ROLE_ID=your_admin_role_id_here
MODERATOR_ROLE_ID=your_moderator_role_id_here

# URL вебхука для экспорта данных (опционально)
WEBHOOK_URL=your_webhook_url_here
```
