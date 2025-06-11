/**
 * Тесты для модуля регистрации на мероприятия
 */

const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const User = require('./src/database/models/User');
const Event = require('./src/database/models/Event');
const Registration = require('./src/database/models/Registration');
const waitlistManager = require('./src/utils/waitlistManager');
const registerCommand = require('./src/commands/user/register');

describe('Модуль регистрации на мероприятия', () => {
    let sandbox;
    let mockInteraction;
    let mockUser;
    let mockEvent;
    
    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        // Создаем мок для взаимодействия
        mockInteraction = {
            user: {
                id: '123456789',
                username: 'TestUser',
                tag: 'TestUser#1234'
            },
            guildId: '987654321',
            options: {
                getString: sandbox.stub()
            },
            reply: sandbox.stub().resolves(),
            client: {
                channels: {
                    fetch: sandbox.stub().resolves({
                        send: sandbox.stub().resolves()
                    })
                },
                users: {
                    fetch: sandbox.stub().resolves({
                        send: sandbox.stub().resolves()
                    })
                },
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
            createdAt: new Date()
        };
        
        // Создаем мок для мероприятия
        mockEvent = {
            _id: 'event123',
            title: 'Test Event',
            description: 'Test Description',
            date: new Date(Date.now() + 86400000), // завтра
            maxParticipants: 10,
            currentParticipants: 5,
            status: 'active',
            guildId: '987654321',
            creatorId: '111111111',
            notificationChannelId: '222222222',
            accessKeys: ['key1', 'key2', 'key3'],
            distributedKeys: [],
            save: sandbox.stub().resolves()
        };
        
        // Мокаем методы mongoose
        sandbox.stub(User, 'findOne');
        sandbox.stub(Event, 'findById');
        
        // Мокаем Event.find для возврата массива с методом sort
        const mockEventFind = sandbox.stub(Event, 'find');
        mockEventFind.returns({
            sort: () => [mockEvent]
        });
        
        sandbox.stub(Registration, 'findOne');
        
        // Мокаем Registration.find для возврата массива с методом sort
        const mockRegistrationFind = sandbox.stub(Registration, 'find');
        mockRegistrationFind.returns([]);
        
        sandbox.stub(Registration.prototype, 'save');
        
        // Мокаем методы waitlistManager
        sandbox.stub(waitlistManager, 'isInWaitlist');
        sandbox.stub(waitlistManager, 'addToWaitlist');
        sandbox.stub(waitlistManager, 'getNextWaitlistUser');
        sandbox.stub(waitlistManager, 'removeFromWaitlist');
        
        // Мокаем EmbedBuilder и другие классы Discord.js
        sandbox.stub(registerCommand, 'createEventEmbed').returns({});
    });
    
    afterEach(() => {
        sandbox.restore();
    });
    
    describe('execute', () => {
        it('должен проверить наличие профиля пользователя', async () => {
            // Настраиваем мок для поиска пользователя
            User.findOne.resolves(null);
            
            // Вызываем метод execute
            await registerCommand.execute(mockInteraction);
            
            // Проверяем, что был вызван метод findOne с правильными параметрами
            expect(User.findOne.calledOnce).to.be.true;
            expect(User.findOne.firstCall.args[0]).to.deep.equal({ discordId: '123456789' });
            
            // Проверяем, что был вызван метод reply с сообщением об отсутствии профиля
            expect(mockInteraction.reply.calledOnce).to.be.true;
            const replyArgs = mockInteraction.reply.firstCall.args[0];
            expect(replyArgs).to.have.property('content').that.includes('У вас еще нет профиля');
            expect(replyArgs.ephemeral).to.be.true;
        });
        
        it('должен показать список мероприятий, если eventId не указан', async () => {
            // Настраиваем моки
            User.findOne.resolves(mockUser);
            mockInteraction.options.getString.returns(null);
            
            // Мокаем метод showEventsList
            const showEventsListStub = sandbox.stub(registerCommand, 'showEventsList').resolves();
            
            // Вызываем метод execute
            await registerCommand.execute(mockInteraction);
            
            // Проверяем, что был вызван метод showEventsList
            expect(showEventsListStub.calledOnce).to.be.true;
            expect(showEventsListStub.firstCall.args[0]).to.equal(mockInteraction);
        });
        
        it('должен вызвать registerForEvent, если eventId указан', async () => {
            // Настраиваем моки
            User.findOne.resolves(mockUser);
            mockInteraction.options.getString.returns('event123');
            
            // Создаем шпион для метода registerForEvent
            const registerForEventSpy = sandbox.stub(registerCommand, 'registerForEvent').resolves();
            
            // Вызываем метод execute
            await registerCommand.execute(mockInteraction);
            
            // Проверяем, что был вызван метод registerForEvent с правильными параметрами
            expect(registerForEventSpy.calledOnce).to.be.true;
            expect(registerForEventSpy.firstCall.args[0]).to.equal(mockInteraction);
            expect(registerForEventSpy.firstCall.args[1]).to.equal('event123');
        });
    });
    
    describe('registerForEvent', () => {
        beforeEach(() => {
            // Восстанавливаем оригинальный метод createEventEmbed
            if (registerCommand.createEventEmbed.restore) {
                registerCommand.createEventEmbed.restore();
            }
            
            // Мокаем метод createEventEmbed
            sandbox.stub(registerCommand, 'createEventEmbed').returns({});
        });
        
        it('должен зарегистрировать пользователя на мероприятие и выдать ключ доступа', async () => {
            // Настраиваем моки
            Event.findById.resolves(mockEvent);
            Registration.findOne.resolves(null);
            Registration.prototype.save.resolves({});
            
            // Вызываем метод registerForEvent
            await registerCommand.registerForEvent(mockInteraction, 'event123');
            
            // Проверяем, что был вызван метод save для мероприятия
            expect(mockEvent.save.calledOnce).to.be.true;
            
            // Проверяем, что количество участников увеличилось
            expect(mockEvent.currentParticipants).to.equal(6);
            
            // Проверяем, что ключ был выдан
            expect(mockEvent.accessKeys.length).to.equal(2); // было 3, стало 2
            expect(mockEvent.distributedKeys.length).to.equal(1);
            expect(mockEvent.distributedKeys[0].discordId).to.equal('123456789');
            
            // Проверяем, что был вызван метод reply с подтверждением
            expect(mockInteraction.reply.calledOnce).to.be.true;
            const replyArgs = mockInteraction.reply.firstCall.args[0];
            expect(replyArgs).to.have.property('content').that.includes('Вы успешно зарегистрировались');
            expect(replyArgs).to.have.property('content').that.includes('Ваш ключ доступа');
            expect(replyArgs).to.have.property('embeds');
            expect(replyArgs).to.have.property('components');
            expect(replyArgs.ephemeral).to.be.true;
        });
        
        it('должен сообщить, что мероприятие заполнено и предложить лист ожидания', async () => {
            // Изменяем мок мероприятия, чтобы оно было заполнено
            mockEvent.currentParticipants = mockEvent.maxParticipants;
            
            // Настраиваем моки
            Event.findById.resolves(mockEvent);
            Registration.findOne.resolves(null);
            
            // Вызываем метод registerForEvent
            await registerCommand.registerForEvent(mockInteraction, 'event123');
            
            // Проверяем, что был вызван метод reply с предложением листа ожидания
            expect(mockInteraction.reply.calledOnce).to.be.true;
            const replyArgs = mockInteraction.reply.firstCall.args[0];
            expect(replyArgs).to.have.property('content').that.includes('уже заполнено');
            expect(replyArgs).to.have.property('content').that.includes('лист ожидания');
            expect(replyArgs).to.have.property('components');
            expect(replyArgs.ephemeral).to.be.true;
        });
        
        it('должен сообщить, что пользователь уже зарегистрирован', async () => {
            // Настраиваем моки
            Event.findById.resolves(mockEvent);
            Registration.findOne.resolves({
                discordId: '123456789',
                eventId: 'event123',
                status: 'confirmed'
            });
            
            // Вызываем метод registerForEvent
            await registerCommand.registerForEvent(mockInteraction, 'event123');
            
            // Проверяем, что был вызван метод reply с сообщением о существующей регистрации
            expect(mockInteraction.reply.calledOnce).to.be.true;
            const replyArgs = mockInteraction.reply.firstCall.args[0];
            expect(replyArgs).to.have.property('content').that.includes('Вы уже зарегистрированы');
            expect(replyArgs).to.have.property('embeds');
            expect(replyArgs).to.have.property('components');
            expect(replyArgs.ephemeral).to.be.true;
        });
    });
    
    // Дополнительные тесты для других методов модуля регистрации
});
