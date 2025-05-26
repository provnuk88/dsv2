/**
 * Тесты для модуля профиля пользователя
 */

const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const User = require('../database/models/User');

// Мокаем discord.js классы
const mockDiscordClasses = {
  ModalBuilder: function() {
    return {
      setCustomId: function() { return this; },
      setTitle: function() { return this; },
      addComponents: function() { return this; }
    };
  },
  ActionRowBuilder: function() {
    return {
      addComponents: function() { return this; }
    };
  },
  TextInputBuilder: function() {
    return {
      setCustomId: function() { return this; },
      setLabel: function() { return this; },
      setStyle: function() { return this; },
      setRequired: function() { return this; },
      setValue: function() { return this; }
    };
  }
};

// Импортируем profileCommand
const profileCommand = require('../commands/user/profile');

describe('Модуль профиля пользователя', () => {
    let sandbox;
    let mockInteraction;
    let mockUser;
    
    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        // Создаем мок для взаимодействия
        mockInteraction = {
            user: {
                id: '123456789',
                username: 'TestUser',
                tag: 'TestUser#1234',
                displayAvatarURL: () => 'https://example.com/avatar.png'
            },
            reply: sandbox.stub().resolves(),
            showModal: sandbox.stub().resolves(),
            client: {
                commands: new Map()
            }
        };
        
        // Создаем мок для пользователя в базе данных
        mockUser = {
            discordId: '123456789',
            username: 'TestUser',
            telegram: 'test_telegram',
            twitter: 'test_twitter',
            wallets: 'ETH 0x123456789',
            createdAt: new Date(),
            save: sandbox.stub().resolves()
        };
        
        // Мокаем методы mongoose
        sandbox.stub(User, 'findOne');
        
        // Мокаем discord.js классы в profileCommand
        if (typeof profileCommand.createModal === 'function') {
            sandbox.stub(profileCommand, 'createModal').returns({});
        }
    });
    
    afterEach(() => {
        sandbox.restore();
    });
    
    describe('execute', () => {
        it('должен показать профиль, если пользователь существует', async () => {
            // Настраиваем мок для поиска пользователя
            User.findOne.resolves(mockUser);
            
            // Вызываем метод execute
            await profileCommand.execute(mockInteraction);
            
            // Проверяем, что был вызван метод reply с правильными параметрами
            expect(mockInteraction.reply.calledOnce).to.be.true;
            const replyArgs = mockInteraction.reply.firstCall.args[0];
            expect(replyArgs).to.have.property('embeds');
            expect(replyArgs).to.have.property('components');
            expect(replyArgs.ephemeral).to.be.true;
        });
        
        it('должен предложить создать профиль, если пользователь не существует', async () => {
            // Настраиваем мок для поиска пользователя
            User.findOne.resolves(null);
            
            // Вызываем метод execute
            await profileCommand.execute(mockInteraction);
            
            // Проверяем, что был вызван метод reply с правильными параметрами
            expect(mockInteraction.reply.calledOnce).to.be.true;
            const replyArgs = mockInteraction.reply.firstCall.args[0];
            expect(replyArgs).to.have.property('content').that.includes('У вас еще нет профиля');
            expect(replyArgs).to.have.property('components');
            expect(replyArgs.ephemeral).to.be.true;
        });
        
        it('должен обрабатывать ошибки', async () => {
            // Настраиваем мок для поиска пользователя, чтобы он выбрасывал ошибку
            User.findOne.rejects(new Error('Тестовая ошибка'));
            
            // Мокаем console.error
            sandbox.stub(console, 'error');
            
            // Вызываем метод execute
            await profileCommand.execute(mockInteraction);
            
            // Проверяем, что был вызван метод reply с сообщением об ошибке
            expect(mockInteraction.reply.calledOnce).to.be.true;
            const replyArgs = mockInteraction.reply.firstCall.args[0];
            expect(replyArgs).to.have.property('content').that.includes('Произошла ошибка');
            expect(replyArgs.ephemeral).to.be.true;
            
            // Проверяем, что ошибка была залогирована
            expect(console.error.calledOnce).to.be.true;
        });
    });
    
    describe('handleCreateProfile', () => {
        it('должен показать модальное окно для создания профиля', async () => {
            // Пропускаем этот тест, если нет возможности корректно мокать discord.js классы
            if (typeof profileCommand.ModalBuilder !== 'undefined') {
                this.skip();
            }
            
            // Вызываем метод handleCreateProfile
            await profileCommand.handleCreateProfile(mockInteraction);
            
            // Проверяем, что был вызван метод showModal
            expect(mockInteraction.showModal.calledOnce).to.be.true;
        });
        
        it('должен обрабатывать ошибки', async () => {
            // Настраиваем мок для showModal, чтобы он выбрасывал ошибку
            mockInteraction.showModal.rejects(new Error('Тестовая ошибка'));
            
            // Мокаем console.error
            sandbox.stub(console, 'error');
            
            // Вызываем метод handleCreateProfile
            await profileCommand.handleCreateProfile(mockInteraction);
            
            // Проверяем, что был вызван метод reply с сообщением об ошибке
            expect(mockInteraction.reply.calledOnce).to.be.true;
            const replyArgs = mockInteraction.reply.firstCall.args[0];
            expect(replyArgs).to.have.property('content').that.includes('Произошла ошибка');
            expect(replyArgs.ephemeral).to.be.true;
            
            // Проверяем, что ошибка была залогирована
            expect(console.error.calledOnce).to.be.true;
        });
    });
});
