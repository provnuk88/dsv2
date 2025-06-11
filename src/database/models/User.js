/**
 * Обновленная модель пользователя с поддержкой статистики и достижений
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    // Основная информация
    discordId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    telegram: { type: String, default: '' },
    twitter: { type: String, default: '' },
    wallets: { type: String, default: '' },
    additionalInfo: { type: String, default: '' },
    
    // Статистика пользователя
    stats: {
        eventsJoined: { type: Number, default: 0 },
        eventsCompleted: { type: Number, default: 0 },
        eventsCreated: { type: Number, default: 0 },
        waitlistJoins: { type: Number, default: 0 },
        lastActive: { type: Date, default: Date.now },
        joinedAt: { type: Date, default: Date.now }
    },
    
    // Достижения пользователя
    achievements: [{
        name: { type: String, required: true }, // 'newcomer', 'active', 'regular', 'legend', 'organizer'
        earnedAt: { type: Date, default: Date.now },
        notified: { type: Boolean, default: false }
    }],
    
    // Настройки уведомлений
    notificationSettings: {
        eventReminders: { type: Boolean, default: true },
        waitlistUpdates: { type: Boolean, default: true },
        achievementAlerts: { type: Boolean, default: true },
        directMessages: { type: Boolean, default: true }
    },
    
    // Метаданные
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Индексы для оптимизации запросов
userSchema.index({ discordId: 1 });
userSchema.index({ 'stats.eventsJoined': -1 });
userSchema.index({ 'stats.lastActive': -1 });

// Обновление поля updatedAt перед сохранением
userSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Виртуальное свойство для получения уровня активности
userSchema.virtual('activityLevel').get(function() {
    const eventsJoined = this.stats.eventsJoined;
    
    if (eventsJoined >= 25) return 'legend';
    if (eventsJoined >= 10) return 'regular';
    if (eventsJoined >= 5) return 'active';
    if (eventsJoined >= 1) return 'newcomer';
    return 'inactive';
});

// Метод для обновления статистики
userSchema.methods.updateStats = async function(statType, increment = 1) {
    if (this.stats[statType] !== undefined) {
        this.stats[statType] += increment;
        this.stats.lastActive = new Date();
        await this.save();
        
        // Возвращаем обновленное значение для проверки достижений
        return this.stats[statType];
    }
    return null;
};

// Метод для проверки наличия достижения
userSchema.methods.hasAchievement = function(achievementName) {
    return this.achievements.some(a => a.name === achievementName);
};

// Метод для добавления достижения
userSchema.methods.addAchievement = async function(achievementName) {
    if (!this.hasAchievement(achievementName)) {
        this.achievements.push({
            name: achievementName,
            earnedAt: new Date(),
            notified: false
        });
        await this.save();
        return true;
    }
    return false;
};

// Метод для обновления настроек уведомлений
userSchema.methods.updateNotificationSettings = async function(settings) {
    Object.assign(this.notificationSettings, settings);
    await this.save();
};

// Статический метод для поиска наиболее активных пользователей
userSchema.statics.findMostActive = function(limit = 10) {
    return this.find()
        .sort({ 'stats.eventsJoined': -1 })
        .limit(limit);
};

// Статический метод для поиска недавно активных пользователей
userSchema.statics.findRecentlyActive = function(days = 7, limit = 10) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.find({ 'stats.lastActive': { $gte: cutoffDate } })
        .sort({ 'stats.lastActive': -1 })
        .limit(limit);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
