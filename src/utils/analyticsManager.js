/**
 * Модуль аналитики для администраторов
 */

const User = require('../database/models/User');
const Event = require('../database/models/Event');
const Registration = require('../database/models/Registration');
const dbCache = require('../database/cache');
const logger = require('./logger');

class AnalyticsManager {
    /**
     * Получает общую статистику гильдии
     * @returns {Promise<Object>} Общая статистика
     */
    static async getGuildStats() {
        return dbCache.withCache('Analytics', 'guildStats', {}, async () => {
            try {
                // Общее количество пользователей
                const totalUsers = await User.countDocuments();
                
                // Общее количество мероприятий
                const totalEvents = await Event.countDocuments();
                
                // Активные мероприятия
                const activeEvents = await Event.countDocuments({ 
                    active: true,
                    endDate: { $gte: new Date() }
                });
                
                // Общее количество регистраций
                const totalRegistrations = await Registration.countDocuments();
                
                // Количество регистраций со статусом "confirmed"
                const confirmedRegistrations = await Registration.countDocuments({ status: 'confirmed' });
                
                // Количество регистраций со статусом "waitlist"
                const waitlistRegistrations = await Registration.countDocuments({ status: 'waitlist' });
                
                // Количество регистраций со статусом "completed"
                const completedRegistrations = await Registration.countDocuments({ status: 'completed' });
                
                // Количество регистраций со статусом "cancelled"
                const cancelledRegistrations = await Registration.countDocuments({ status: 'cancelled' });
                
                // Средняя заполняемость мероприятий
                const events = await Event.find();
                let totalCapacity = 0;
                let totalRegistered = 0;
                
                for (const event of events) {
                    if (event.maxParticipants > 0) {
                        totalCapacity += event.maxParticipants;
                        totalRegistered += event.stats.registrationsCount;
                    }
                }
                
                const averageFillRate = totalCapacity > 0 ? 
                    Math.round((totalRegistered / totalCapacity) * 100) : 0;
                
                // Новые пользователи за последние 7 дней
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                
                const newUsers = await User.countDocuments({ 
                    createdAt: { $gte: sevenDaysAgo } 
                });
                
                // Активные пользователи за последние 30 дней
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                
                const activeUsers = await User.countDocuments({ 
                    'stats.lastActive': { $gte: thirtyDaysAgo } 
                });
                
                return {
                    totalUsers,
                    totalEvents,
                    activeEvents,
                    totalRegistrations,
                    confirmedRegistrations,
                    waitlistRegistrations,
                    completedRegistrations,
                    cancelledRegistrations,
                    averageFillRate,
                    newUsers,
                    activeUsers,
                    timestamp: new Date()
                };
            } catch (error) {
                logger.error(`Error getting guild stats: ${error.message}`);
                return null;
            }
        }, 3600); // Кэшируем на 1 час
    }
    
    /**
     * Получает статистику мероприятий по типам
     * @returns {Promise<Object>} Статистика по типам мероприятий
     */
    static async getEventTypeStats() {
        return dbCache.withCache('Analytics', 'eventTypeStats', {}, async () => {
            try {
                // Получаем все мероприятия
                const events = await Event.find();
                
                // Анализируем типы мероприятий по ключевым словам в названии и описании
                const typeKeywords = {
                    workshop: ['workshop', 'мастер-класс', 'обучение', 'тренинг'],
                    meetup: ['meetup', 'встреча', 'митап', 'нетворкинг'],
                    conference: ['conference', 'конференция', 'саммит'],
                    hackathon: ['hackathon', 'хакатон', 'марафон'],
                    game: ['game', 'игра', 'турнир', 'соревнование'],
                    other: []
                };
                
                // Счетчики по типам
                const typeCounts = {
                    workshop: 0,
                    meetup: 0,
                    conference: 0,
                    hackathon: 0,
                    game: 0,
                    other: 0
                };
                
                // Статистика регистраций по типам
                const typeRegistrations = {
                    workshop: 0,
                    meetup: 0,
                    conference: 0,
                    hackathon: 0,
                    game: 0,
                    other: 0
                };
                
                // Статистика заполняемости по типам
                const typeFillRates = {
                    workshop: { capacity: 0, registered: 0 },
                    meetup: { capacity: 0, registered: 0 },
                    conference: { capacity: 0, registered: 0 },
                    hackathon: { capacity: 0, registered: 0 },
                    game: { capacity: 0, registered: 0 },
                    other: { capacity: 0, registered: 0 }
                };
                
                // Анализируем каждое мероприятие
                for (const event of events) {
                    // Определяем тип мероприятия
                    let eventType = 'other';
                    const searchText = `${event.title} ${event.description}`.toLowerCase();
                    
                    for (const [type, keywords] of Object.entries(typeKeywords)) {
                        if (keywords.some(keyword => searchText.includes(keyword))) {
                            eventType = type;
                            break;
                        }
                    }
                    
                    // Увеличиваем счетчик для данного типа
                    typeCounts[eventType]++;
                    
                    // Добавляем количество регистраций
                    typeRegistrations[eventType] += event.stats.registrationsCount;
                    
                    // Добавляем данные для расчета заполняемости
                    if (event.maxParticipants > 0) {
                        typeFillRates[eventType].capacity += event.maxParticipants;
                        typeFillRates[eventType].registered += event.stats.registrationsCount;
                    }
                }
                
                // Рассчитываем процент заполняемости для каждого типа
                const typeFillRatePercents = {};
                
                for (const [type, data] of Object.entries(typeFillRates)) {
                    typeFillRatePercents[type] = data.capacity > 0 ? 
                        Math.round((data.registered / data.capacity) * 100) : 0;
                }
                
                return {
                    typeCounts,
                    typeRegistrations,
                    typeFillRatePercents,
                    timestamp: new Date()
                };
            } catch (error) {
                logger.error(`Error getting event type stats: ${error.message}`);
                return null;
            }
        }, 3600); // Кэшируем на 1 час
    }
    
    /**
     * Получает статистику активности пользователей
     * @returns {Promise<Object>} Статистика активности пользователей
     */
    static async getUserActivityStats() {
        return dbCache.withCache('Analytics', 'userActivityStats', {}, async () => {
            try {
                // Получаем всех пользователей
                const users = await User.find();
                
                // Группируем пользователей по уровню активности
                const activityLevels = {
                    inactive: 0, // 0 мероприятий
                    newcomer: 0, // 1 мероприятие
                    active: 0,   // 2-4 мероприятия
                    regular: 0,   // 5-9 мероприятий
                    legend: 0    // 10+ мероприятий
                };
                
                for (const user of users) {
                    const eventsJoined = user.stats.eventsJoined;
                    
                    if (eventsJoined === 0) {
                        activityLevels.inactive++;
                    } else if (eventsJoined === 1) {
                        activityLevels.newcomer++;
                    } else if (eventsJoined >= 2 && eventsJoined <= 4) {
                        activityLevels.active++;
                    } else if (eventsJoined >= 5 && eventsJoined <= 9) {
                        activityLevels.regular++;
                    } else {
                        activityLevels.legend++;
                    }
                }
                
                // Рассчитываем процентное соотношение
                const totalUsers = users.length;
                const activityPercentages = {};
                
                for (const [level, count] of Object.entries(activityLevels)) {
                    activityPercentages[level] = totalUsers > 0 ? 
                        Math.round((count / totalUsers) * 100) : 0;
                }
                
                // Статистика по достижениям
                const achievementCounts = {};
                
                for (const user of users) {
                    for (const achievement of user.achievements) {
                        achievementCounts[achievement.name] = 
                            (achievementCounts[achievement.name] || 0) + 1;
                    }
                }
                
                // Статистика активности по времени
                const timeStats = {
                    lastDay: 0,
                    lastWeek: 0,
                    lastMonth: 0
                };
                
                const now = new Date();
                const oneDayAgo = new Date(now);
                oneDayAgo.setDate(oneDayAgo.getDate() - 1);
                
                const oneWeekAgo = new Date(now);
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                
                const oneMonthAgo = new Date(now);
                oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                
                for (const user of users) {
                    const lastActive = new Date(user.stats.lastActive);
                    
                    if (lastActive >= oneDayAgo) {
                        timeStats.lastDay++;
                    }
                    
                    if (lastActive >= oneWeekAgo) {
                        timeStats.lastWeek++;
                    }
                    
                    if (lastActive >= oneMonthAgo) {
                        timeStats.lastMonth++;
                    }
                }
                
                return {
                    activityLevels,
                    activityPercentages,
                    achievementCounts,
                    timeStats,
                    totalUsers,
                    timestamp: new Date()
                };
            } catch (error) {
                logger.error(`Error getting user activity stats: ${error.message}`);
                return null;
            }
        }, 3600); // Кэшируем на 1 час
    }
    
    /**
     * Получает статистику конверсии регистраций
     * @returns {Promise<Object>} Статистика конверсии
     */
    static async getRegistrationConversionStats() {
        return dbCache.withCache('Analytics', 'conversionStats', {}, async () => {
            try {
                // Получаем все регистрации
                const registrations = await Registration.find().populate('eventId');
                
                // Группируем регистрации по мероприятиям
                const eventRegistrations = {};
                
                for (const reg of registrations) {
                    if (!reg.eventId) continue;
                    
                    const eventId = reg.eventId._id.toString();
                    
                    if (!eventRegistrations[eventId]) {
                        eventRegistrations[eventId] = {
                            title: reg.eventId.title,
                            confirmed: 0,
                            waitlist: 0,
                            completed: 0,
                            cancelled: 0,
                            total: 0
                        };
                    }
                    
                    eventRegistrations[eventId][reg.status]++;
                    eventRegistrations[eventId].total++;
                }
                
                // Рассчитываем конверсию для каждого мероприятия
                const eventConversions = {};
                
                for (const [eventId, data] of Object.entries(eventRegistrations)) {
                    const waitlistToConfirmed = data.waitlist > 0 ? 
                        Math.round((data.confirmed / (data.confirmed + data.waitlist)) * 100) : 0;
                    
                    const confirmedToCompleted = data.confirmed > 0 ? 
                        Math.round((data.completed / data.confirmed) * 100) : 0;
                    
                    const cancellationRate = data.total > 0 ? 
                        Math.round((data.cancelled / data.total) * 100) : 0;
                    
                    eventConversions[eventId] = {
                        title: data.title,
                        waitlistToConfirmed,
                        confirmedToCompleted,
                        cancellationRate
                    };
                }
                
                // Рассчитываем общую конверсию
                let totalConfirmed = 0;
                let totalWaitlist = 0;
                let totalCompleted = 0;
                let totalCancelled = 0;
                let totalRegistrations = 0;
                
                for (const data of Object.values(eventRegistrations)) {
                    totalConfirmed += data.confirmed;
                    totalWaitlist += data.waitlist;
                    totalCompleted += data.completed;
                    totalCancelled += data.cancelled;
                    totalRegistrations += data.total;
                }
                
                const overallConversion = {
                    waitlistToConfirmed: totalWaitlist > 0 ? 
                        Math.round((totalConfirmed / (totalConfirmed + totalWaitlist)) * 100) : 0,
                    confirmedToCompleted: totalConfirmed > 0 ? 
                        Math.round((totalCompleted / totalConfirmed) * 100) : 0,
                    cancellationRate: totalRegistrations > 0 ? 
                        Math.round((totalCancelled / totalRegistrations) * 100) : 0
                };
                
                return {
                    eventConversions,
                    overallConversion,
                    timestamp: new Date()
                };
            } catch (error) {
                logger.error(`Error getting registration conversion stats: ${error.message}`);
                return null;
            }
        }, 3600); // Кэшируем на 1 час
    }
    
    /**
     * Получает прогноз посещаемости для мероприятий
     * @returns {Promise<Object>} Прогноз посещаемости
     */
    static async getAttendanceForecast() {
        return dbCache.withCache('Analytics', 'attendanceForecast', {}, async () => {
            try {
                // Получаем активные мероприятия
                const activeEvents = await Event.find({ 
                    active: true,
                    endDate: { $gte: new Date() }
                }).sort({ startDate: 1 });
                
                // Получаем исторические данные о посещаемости
                const historicalEvents = await Event.find({
                    endDate: { $lt: new Date() }
                });
                
                // Рассчитываем среднюю посещаемость по типам мероприятий
                const typeKeywords = {
                    workshop: ['workshop', 'мастер-класс', 'обучение', 'тренинг'],
                    meetup: ['meetup', 'встреча', 'митап', 'нетворкинг'],
                    conference: ['conference', 'конференция', 'саммит'],
                    hackathon: ['hackathon', 'хакатон', 'марафон'],
                    game: ['game', 'игра', 'турнир', 'соревнование']
                };
                
                const typeAttendanceRates = {
                    workshop: [],
                    meetup: [],
                    conference: [],
                    hackathon: [],
                    game: [],
                    other: []
                };
                
                // Анализируем исторические данные
                for (const event of historicalEvents) {
                    // Определяем тип мероприятия
                    let eventType = 'other';
                    const searchText = `${event.title} ${event.description}`.toLowerCase();
                    
                    for (const [type, keywords] of Object.entries(typeKeywords)) {
                        if (keywords.some(keyword => searchText.includes(keyword))) {
                            eventType = type;
                            break;
                        }
                    }
                    
                    // Рассчитываем процент посещаемости
                    if (event.stats.registrationsCount > 0) {
                        const attendanceRate = event.stats.completionRate;
                        typeAttendanceRates[eventType].push(attendanceRate);
                    }
                }
                
                // Рассчитываем средний процент посещаемости для каждого типа
                const avgTypeAttendanceRates = {};
                
                for (const [type, rates] of Object.entries(typeAttendanceRates)) {
                    avgTypeAttendanceRates[type] = rates.length > 0 ? 
                        Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length) : 70; // По умолчанию 70%
                }
                
                // Прогнозируем посещаемость для активных мероприятий
                const forecasts = [];
                
                for (const event of activeEvents) {
                    // Определяем тип мероприятия
                    let eventType = 'other';
                    const searchText = `${event.title} ${event.description}`.toLowerCase();
                    
                    for (const [type, keywords] of Object.entries(typeKeywords)) {
                        if (keywords.some(keyword => searchText.includes(keyword))) {
                            eventType = type;
                            break;
                        }
                    }
                    
                    // Прогнозируем количество участников
                    const expectedAttendanceRate = avgTypeAttendanceRates[eventType];
                    const registeredCount = event.stats.registrationsCount;
                    const expectedAttendees = Math.round((registeredCount * expectedAttendanceRate) / 100);
                    
                    forecasts.push({
                        eventId: event._id.toString(),
                        title: event.title,
                        startDate: event.startDate,
                        registeredCount,
                        expectedAttendanceRate,
                        expectedAttendees
                    });
                }
                
                return {
                    forecasts,
                    avgTypeAttendanceRates,
                    timestamp: new Date()
                };
            } catch (error) {
                logger.error(`Error getting attendance forecast: ${error.message}`);
                return null;
            }
        }, 3600); // Кэшируем на 1 час
    }
    
    /**
     * Экспортирует данные аналитики в формате CSV
     * @param {string} dataType - Тип данных для экспорта
     * @returns {Promise<string>} CSV-строка с данными
     */
    static async exportDataToCsv(dataType) {
        try {
            let data;
            let csvContent = '';
            
            switch (dataType) {
                case 'users':
                    data = await User.find();
                    
                    // Заголовок CSV
                    csvContent = 'Discord ID,Username,Telegram,Twitter,Events Joined,Events Completed,Events Created,Joined At\n';
                    
                    // Данные пользователей
                    for (const user of data) {
                        csvContent += `${user.discordId},${user.username},${user.telegram},${user.twitter},${user.stats.eventsJoined},${user.stats.eventsCompleted},${user.stats.eventsCreated},${user.stats.joinedAt}\n`;
                    }
                    break;
                    
                case 'events':
                    data = await Event.find();
                    
                    // Заголовок CSV
                    csvContent = 'ID,Title,Start Date,End Date,Location,Max Participants,Registrations,Waitlist,Active,Created At\n';
                    
                    // Данные мероприятий
                    for (const event of data) {
                        csvContent += `${event._id},${event.title},${event.startDate},${event.endDate},${event.location},${event.maxParticipants},${event.stats.registrationsCount},${event.stats.waitlistCount},${event.active},${event.createdAt}\n`;
                    }
                    break;
                    
                case 'registrations':
                    data = await Registration.find().populate('eventId');
                    
                    // Заголовок CSV
                    csvContent = 'User ID,Event ID,Event Title,Status,Registration Date,Access Key\n';
                    
                    // Данные регистраций
                    for (const reg of data) {
                        if (!reg.eventId) continue;
                        csvContent += `${reg.userId},${reg.eventId._id},${reg.eventId.title},${reg.status},${reg.registrationDate},${reg.accessKey || 'N/A'}\n`;
                    }
                    break;
                    
                case 'achievements':
                    data = await User.find();
                    
                    // Заголовок CSV
                    csvContent = 'Discord ID,Username,Achievement,Earned At\n';
                    
                    // Данные достижений
                    for (const user of data) {
                        for (const achievement of user.achievements) {
                            csvContent += `${user.discordId},${user.username},${achievement.name},${achievement.earnedAt}\n`;
                        }
                    }
                    break;
                    
                default:
                    throw new Error(`Unknown data type: ${dataType}`);
            }
            
            return csvContent;
        } catch (error) {
            logger.error(`Error exporting data to CSV: ${error.message}`);
            return null;
        }
    }
}

module.exports = AnalyticsManager;
