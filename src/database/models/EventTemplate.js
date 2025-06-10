/**
 * Модель шаблона мероприятия для Synergy Guild Bot
 * Хранит информацию о шаблонах для быстрого создания мероприятий
 */

const { Schema, model } = require('mongoose');

const EventTemplateSchema = new Schema({
  name: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String 
  },
  creatorId: { 
    type: String, 
    required: true 
  },
  defaultDuration: { 
    type: Number, // Продолжительность в днях
    default: 7
  },
  prizes: { 
    type: String 
  },
  requiredFields: [{ 
    type: String 
  }],
  capacity: { 
    type: Number 
  },
  isActive: { 
    type: Boolean, 
    default: true 
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

module.exports = model('EventTemplate', EventTemplateSchema);
