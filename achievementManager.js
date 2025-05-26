/**
 * Менеджер достижений пользователей
 */

const User = require('../database/models/User');
const botEvents = require('../events/botEvents');
const logger = require('./logger');

class AchievementManager {
    // Определение доступных достижений
    static ACHIEVEMENTS = {
        newcomer: { 
            name: 'Новичок', 
            icon: '🎯', 
            description: 'Первая регистрация на мероприятие', 
            requirement: 1,
            statType: 'eventsJoined'
        },
        active: { 
            name: 'Активист', 
            icon: '🔥', 
            description: 'Зарегистрировались на 5 мероприятий', 
            requirement: 5,
            statType: 'eventsJoined'
        },
        regular: { 
            name: 'Завсегдатай', 
            icon: '⭐', 
            description: 'Зарегистрировались на 10 мероприятий', 
            requirement: 10,
            statType: 'eventsJoined'
        },
        legend: { 
            name: 'Легенда', 
            icon: '👑', 
            description: 'Зарегистрировались на 25 мероприятий', 
            requirement: 25,
            statType: 'eventsJoined'
        },
        organizer: { 
            name: 'Организатор', 
            icon: '🛠️', 
            description: 'Создали мероприятие', 
            requirement: 1,
            statType: 'eventsCreated'
        },
        veteran: { 
            name: 'Ветеран', 
            icon: '🏅', 
            description: 'Посетили 10 мероприятий', 
            requirement: 10,
            statType: 'eventsCompleted'
        }
    };
    
    /**
     * Проверяет и выдает достижения на основе обновленной статистики
     * @param {string} userId - ID пользователя
     * @param {string} statType - Тип статистики
     * @param {number} newValue - Новое значение статистики
     */
    static async checkAndAward(userId, statType, newValue) {
        try {
            const user = await User.findOne({ discordId: userId });
            if (!user) {
                logger.warn(`Cannot check achievements: User ${userId} not found`);
                return;
            }
            
            // Получаем достижения, связанные с данным типом статистики
            const relevantAchievements = this.getRelevantAchievements(statType);
            
            for (const achKey of relevantAchievements) {
                const achievement = this.ACHIEVEMENTS[achKey];
                const hasAchievement = user.hasAchievement(achKey);
                
                // Если достижение еще не получено и требования выполнены
                if (!hasAchievement && newValue >= achievement.requirement) {
                    logger.info(`Awarding achievement ${achievement.name} to user ${userId}`);
                    
                    // Добавляем достижение пользователю
                    const added = await user.addAchievement(achKey);
                    
                    if (added) {
                        // Генерируем событие получения достижения
                        botEvents.emit('user.achievement_earned', userId, achievement);
                    }
                }
            }
        } catch (error) {
            logger.error(`Error checking achievements: ${error.message}`);
        }
    }
    
    /**
     * Возвращает список достижений, связанных с данным типом статистики
     * @param {string} statType - Тип статистики
     * @returns {Array} Список ключей достижений
     */
    static getRelevantAchievements(statType) {
        return Object.keys(this.ACHIEVEMENTS).filter(
            key => this.ACHIEVEMENTS[key].statType === statType
        );
    }
    
    /**
     * Возвращает информацию о достижении по ключу
     * @param {string} achievementKey - Ключ достижения
     * @returns {Object} Информация о достижении
     */
    static getAchievementInfo(achievementKey) {
        return this.ACHIEVEMENTS[achievementKey] || null;
    }
    
    /**
     * Возвращает список всех достижений пользователя
     * @param {string} userId - ID пользователя
     * @returns {Promise<Array>} Список достижений с дополнительной информацией
     */
    static async getUserAchievements(userId) {
        try {
            const user = await User.findOne({ discordId: userId });
            if (!user) {
                return [];
            }
            
            // Добавляем дополнительную информацию к каждому достижению
            return user.achievements.map(ach => {
                const achievementInfo = this.getAchievementInfo(ach.name);
                return {
                    key: ach.name,
                    name: achievementInfo ? achievementInfo.name : ach.name,
                    icon: achievementInfo ? achievementInfo.icon : '🏆',
                    description: achievementInfo ? achievementInfo.description : 'Достижение',
                    earnedAt: ach.earnedAt
                };
            });
        } catch (error) {
            logger.error(`Error getting user achievements: ${error.message}`);
            return [];
        }
    }
    
    /**
     * Возвращает прогресс пользователя по всем достижениям
     * @param {string} userId - ID пользователя
     * @returns {Promise<Array>} Список достижений с прогрессом
     */
    static async getUserAchievementProgress(userId) {
        try {
            const user = await User.findOne({ discordId: userId });
            if (!user) {
                return [];
            }
            
            return Object.entries(this.ACHIEVEMENTS).map(([key, achievement]) => {
                const hasAchievement = user.hasAchievement(key);
                const currentValue = user.stats[achievement.statType] || 0;
                const progress = Math.min(100, Math.floor((currentValue / achievement.requirement) * 100));
                
                return {
                    key,
                    name: achievement.name,
                    icon: achievement.icon,
                    description: achievement.description,
                    requirement: achievement.requirement,
                    currentValue,
                    progress,
                    achieved: hasAchievement,
                    earnedAt: hasAchievement ? 
                        user.achievements.find(a => a.name === key).earnedAt : 
                        null
                };
            });
        } catch (error) {
            logger.error(`Error getting user achievement progress: ${error.message}`);
            return [];
        }
    }
}

module.exports = AchievementManager;
