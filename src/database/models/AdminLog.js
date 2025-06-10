/**
 * Модель для логирования действий администраторов
 * Хранит информацию о действиях администраторов в системе
 */

const { Schema, model } = require('mongoose');

const AdminLogSchema = new Schema({
  adminId: { 
    type: String, 
    required: true 
  },
  adminUsername: { 
    type: String, 
    required: true 
  },
  action: { 
    type: String, 
    required: true 
  },
  details: { 
    type: String 
  },
  targetId: { 
    type: String 
  },
  targetType: { 
    type: String, 
    enum: ['user', 'event', 'registration', 'announcement', 'template'] 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = model('AdminLog', AdminLogSchema);
