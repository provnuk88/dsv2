const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');

const Event = require('./src/database/models/Event');
const Registration = require('./src/database/models/Registration');
const reminderService = require('./src/utils/reminderService');
const eventScheduler = require('./src/utils/eventScheduler');

describe('Event Scheduler', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('checkAndSendReminders', () => {
    it('sends reminders for upcoming events', async () => {
      const mockEvent = {
        _id: '1',
        title: 'Test',
        startDate: new Date(Date.now() + 30 * 60 * 1000),
        stats: {},
        save: sandbox.stub().resolves()
      };
      sandbox.stub(Event, 'find').resolves([mockEvent]);
      const reminderStub = sandbox.stub(reminderService, 'sendReminder').resolves();

      await eventScheduler.checkAndSendReminders();

      expect(reminderStub.calledOnceWith(mockEvent)).to.be.true;
      expect(mockEvent.stats.reminderSent).to.be.true;
      expect(mockEvent.save.calledOnce).to.be.true;
    });
  });

  describe('closeExpiredEvents', () => {
    it('closes events that ended', async () => {
      const mockEvent = {
        _id: '1',
        title: 'Past',
        endDate: new Date(Date.now() - 1000),
        active: true,
        save: sandbox.stub().resolves()
      };
      sandbox.stub(Event, 'find').resolves([mockEvent]);
      const updateStub = sandbox.stub(Registration, 'updateMany').resolves();

      await eventScheduler.closeExpiredEvents();

      expect(updateStub.calledOnce).to.be.true;
      expect(updateStub.firstCall.args[0]).to.deep.equal({ eventId: mockEvent._id, status: 'confirmed' });
      expect(updateStub.firstCall.args[1]).to.deep.equal({ status: 'completed' });
      expect(mockEvent.active).to.be.false;
      expect(mockEvent.save.calledOnce).to.be.true;
    });
  });
});
