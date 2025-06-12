const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const path = require('path');

const indexPath = path.resolve(__dirname, './src/index.js');
const mockClient = { guilds: { cache: new Map() } };
require.cache[indexPath] = { exports: { client: mockClient } };

const announcementScheduler = require('./src/utils/announcementScheduler');
const ScheduledAnnouncement = require('./src/database/models/ScheduledAnnouncement');

describe('Announcement Scheduler', () => {
    let sandbox;
    let clock;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        clock = sinon.useFakeTimers();
    });

    afterEach(() => {
        sandbox.restore();
        clock.restore();
        mockClient.guilds.cache.clear();
    });

    it('schedules and sends announcement', async () => {
        sandbox.stub(ScheduledAnnouncement.prototype, 'save').resolves();
        const sendStub = sandbox.stub(announcementScheduler, 'sendAnnouncement').resolves(true);
        const data = {
            guildId: '1',
            channelId: '2',
            title: 'Test',
            message: 'Hello',
            color: '#fff',
            scheduledDate: new Date(Date.now() + 1000),
            createdBy: 'user'
        };
        const announcement = await announcementScheduler.scheduleAnnouncement(data);
        expect(ScheduledAnnouncement.prototype.save.calledOnce).to.be.true;
        await clock.tickAsync(1000);
        await Promise.resolve();
        expect(sendStub.calledOnce).to.be.true;
        expect(sendStub.firstCall.args[0]).to.equal('1');
        expect(sendStub.firstCall.args[1]).to.equal('2');
        expect(announcement).to.have.property('title', 'Test');
    });

    it('sendAnnouncement delivers message', async () => {
        const send = sandbox.stub().resolves();
        const channel = { send };
        const guild = { channels: { cache: new Map([['2', channel]]) } };
        mockClient.guilds.cache.set('1', guild);
        const result = await announcementScheduler.sendAnnouncement('1', '2', 'Hi', 'World', '#abc');
        expect(result).to.be.true;
        expect(send.calledOnce).to.be.true;
    });
});

