/**
 * Модель запланированного объявления для Synergy Guild Bot
 * Хранит информацию о запланированных объявлениях для автоматической публикации
 */

const { Schema, model } = require('mongoose');

const ScheduledAnnouncementSchema = new Schema({
  title: { 
    type: String, 
    required: true 
  },
  content: { 
    type: String, 
    required: true 
  },
  creatorId: { 
    type: String, 
    required: true 
  },
  channelId: { 
    type: String, 
    required: true 
  },
  scheduledFor: { 
    type: Date, 
    required: true 
  },
  isSent: { 
    type: Boolean, 
    default: false 
  },
  sentAt: { 
    type: Date 
  },
  isRecurring: { 
    type: Boolean, 
    default: false 
  },
  recurringPattern: { 
    type: String // Cron-подобный паттерн для повторяющихся объявлений
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = model('ScheduledAnnouncement', ScheduledAnnouncementSchema);
