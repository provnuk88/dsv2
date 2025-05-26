/**
 * Обновленная модель мероприятия с поддержкой ключей доступа и статистики
 */

const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    // Основная информация
    title: { type: String, required: true },
    description: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    location: { type: String, default: 'Онлайн' },
    maxParticipants: { type: Number, default: 0 },
    
    // Организационная информация
    createdBy: { type: String, required: true }, // discordId создателя
    active: { type: Boolean, default: true },
    
    // Ключи доступа
    accessKeys: [{ 
        key: { type: String, required: true },
        issuedTo: { type: String, default: null }, // discordId пользователя, которому выдан ключ
        issuedAt: { type: Date, default: null }
    }],
    
    // Требования к профилю
    requiredProfileFields: {
        telegram: { type: Boolean, default: false },
        twitter: { type: Boolean, default: false },
        wallets: { type: Boolean, default: false }
    },
    
    // Статистика мероприятия
    stats: {
        registrationsCount: { type: Number, default: 0 },
        waitlistCount: { type: Number, default: 0 },
        viewCount: { type: Number, default: 0 },
        completionRate: { type: Number, default: 0 }, // Процент завершения (для прошедших мероприятий)
        lastRegistrationAt: { type: Date, default: null }
    },
    
    // Настройки повторения (для регулярных мероприятий)
    recurring: {
        isRecurring: { type: Boolean, default: false },
        frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
        interval: { type: Number, default: 1 }, // Каждые N дней/недель/месяцев
        endAfterOccurrences: { type: Number, default: 0 }, // 0 = бесконечно
        endDate: { type: Date, default: null }
    },
    
    // Призы и награды
    rewards: { type: String, default: '' },
    
    // Метаданные
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Индексы для оптимизации запросов
eventSchema.index({ startDate: 1 });
eventSchema.index({ active: 1, startDate: 1 });
eventSchema.index({ createdBy: 1 });
eventSchema.index({ 'accessKeys.issuedTo': 1 });

// Обновление поля updatedAt перед сохранением
eventSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Виртуальное свойство для проверки, заполнено ли мероприятие
eventSchema.virtual('isFull').get(function() {
    return this.maxParticipants > 0 && this.stats.registrationsCount >= this.maxParticipants;
});

// Виртуальное свойство для проверки, прошло ли мероприятие
eventSchema.virtual('isPast').get(function() {
    return new Date() > this.endDate;
});

// Виртуальное свойство для проверки, идет ли мероприятие сейчас
eventSchema.virtual('isOngoing').get(function() {
    const now = new Date();
    return now >= this.startDate && now <= this.endDate;
});

// Виртуальное свойство для получения доступных ключей
eventSchema.virtual('availableAccessKeys').get(function() {
    return this.accessKeys.filter(key => key.issuedTo === null);
});

// Метод для выдачи ключа доступа
eventSchema.methods.issueAccessKey = async function(userId) {
    const availableKey = this.accessKeys.find(key => key.issuedTo === null);
    
    if (availableKey) {
        availableKey.issuedTo = userId;
        availableKey.issuedAt = new Date();
        await this.save();
        return availableKey.key;
    }
    
    return null;
};

// Метод для обновления статистики
eventSchema.methods.updateStats = async function(statType, increment = 1) {
    if (this.stats[statType] !== undefined) {
        this.stats[statType] += increment;
        
        if (statType === 'registrationsCount') {
            this.stats.lastRegistrationAt = new Date();
        }
        
        await this.save();
        return this.stats[statType];
    }
    return null;
};

// Метод для проверки, может ли пользователь зарегистрироваться
eventSchema.methods.canRegister = function(user) {
    // Проверка активности мероприятия
    if (!this.active || this.isPast) {
        return { canRegister: false, reason: 'Мероприятие неактивно или уже прошло' };
    }
    
    // Проверка наличия мест
    if (this.isFull) {
        return { canRegister: false, reason: 'Мероприятие заполнено' };
    }
    
    // Проверка требуемых полей профиля
    const missingFields = [];
    
    if (this.requiredProfileFields.telegram && !user.telegram) {
        missingFields.push('Telegram');
    }
    
    if (this.requiredProfileFields.twitter && !user.twitter) {
        missingFields.push('Twitter');
    }
    
    if (this.requiredProfileFields.wallets && !user.wallets) {
        missingFields.push('Кошельки');
    }
    
    if (missingFields.length > 0) {
        return { 
            canRegister: false, 
            reason: `Отсутствуют обязательные поля профиля: ${missingFields.join(', ')}` 
        };
    }
    
    return { canRegister: true };
};

// Статический метод для поиска активных мероприятий
eventSchema.statics.findActiveEvents = function() {
    return this.find({ 
        active: true,
        endDate: { $gte: new Date() }
    }).sort({ startDate: 1 });
};

// Статический метод для поиска предстоящих мероприятий
eventSchema.statics.findUpcomingEvents = function(limit = 10) {
    return this.find({ 
        active: true,
        startDate: { $gte: new Date() }
    })
    .sort({ startDate: 1 })
    .limit(limit);
};

// Статический метод для поиска популярных мероприятий
eventSchema.statics.findPopularEvents = function(limit = 5) {
    return this.find({ 
        active: true,
        endDate: { $gte: new Date() }
    })
    .sort({ 'stats.registrationsCount': -1, startDate: 1 })
    .limit(limit);
};

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
