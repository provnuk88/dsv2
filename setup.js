/**
 * Конфигурация для запуска тестов
 */
const mocha = require('mocha');
const chai = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

// Экспортируем глобальные хуки для Mocha
module.exports = {
  // Настройка моков для mongoose перед всеми тестами
  mochaHooks: {
    beforeAll: async function() {
      // Используем in-memory MongoDB для тестов
      const mockConnection = {
        model: () => {},
        Schema: mongoose.Schema
      };
      
      // Мокаем mongoose.connect
      sinon.stub(mongoose, 'connect').resolves(mockConnection);
      
      // Мокаем mongoose.connection
      Object.defineProperty(mongoose, 'connection', {
        value: mockConnection
      });
    },
    
    // Очистка после всех тестов
    afterAll: function() {
      // Восстанавливаем моки
      if (mongoose.connect.restore) {
        mongoose.connect.restore();
      }
    }
  }
};
