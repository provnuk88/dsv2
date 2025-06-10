/**
 * Модель регистрации на мероприятие для Synergy Guild Bot
 * Хранит информацию о регистрациях пользователей на мероприятия
 */

const { Schema, model } = require('mongoose');

const RegistrationSchema = new Schema({
  discordId: { 
    type: String, 
    required: true 
  },
  eventId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Event', 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'waitlist', 'cancelled'], 
    default: 'pending' 
  },
  registeredAt: { 
    type: Date, 
    default: Date.now 
  },
  waitlistPosition: { 
    type: Number 
  },
  promotedAt: { 
    type: Date 
  },
  additionalData: { 
    type: Map, 
    of: String 
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

// Составной индекс для предотвращения дублирования регистраций
RegistrationSchema.index({ discordId: 1, eventId: 1 }, { unique: true });

module.exports = model('Registration', RegistrationSchema);
