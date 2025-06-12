const { EmbedBuilder } = require('discord.js');
const ScheduledAnnouncement = require('../database/models/ScheduledAnnouncement');
const logger = require('./logger');
const { client } = require('../index');

const scheduledJobs = new Map();

function scheduleJob(announcement) {
    const delay = new Date(announcement.scheduledDate).getTime() - Date.now();
    const timeout = setTimeout(() => sendScheduledAnnouncement(announcement), Math.max(delay, 0));
    scheduledJobs.set(announcement._id.toString(), timeout);
}

async function sendScheduledAnnouncement(announcement) {
    try {
        await sendAnnouncement(
            announcement.guildId,
            announcement.channelId,
            announcement.title,
            announcement.content,
            announcement.color
        );
        announcement.isSent = true;
        announcement.sentAt = new Date();
        await announcement.save();
    } catch (err) {
        logger.error(`Failed to send scheduled announcement ${announcement._id}: ${err.message}`);
    } finally {
        const id = announcement._id.toString();
        if (scheduledJobs.has(id)) {
            clearTimeout(scheduledJobs.get(id));
            scheduledJobs.delete(id);
        }
    }
}

async function initialize() {
    try {
        const announcements = await ScheduledAnnouncement.find({ isSent: false });
        announcements.forEach(a => scheduleJob(a));
        logger.info(`Announcement scheduler initialized with ${announcements.length} tasks`);
    } catch (err) {
        logger.error(`Failed to initialize announcement scheduler: ${err.message}`);
    }
}

async function scheduleAnnouncement(data) {
    const announcement = new ScheduledAnnouncement({
        guildId: data.guildId,
        channelId: data.channelId,
        title: data.title,
        content: data.message,
        color: data.color,
        creatorId: data.createdBy,
        scheduledDate: data.scheduledDate
    });
    await announcement.save();
    scheduleJob(announcement);
    return announcement;
}

async function updateAnnouncement(id, guildId, updates) {
    const announcement = await ScheduledAnnouncement.findOne({ _id: id, guildId, isSent: false });
    if (!announcement) return null;
    Object.assign(announcement, updates, { updatedAt: new Date() });
    await announcement.save();
    const jobId = id.toString();
    if (scheduledJobs.has(jobId)) {
        clearTimeout(scheduledJobs.get(jobId));
        scheduledJobs.delete(jobId);
    }
    scheduleJob(announcement);
    return announcement;
}

async function cancelAnnouncement(id, guildId) {
    const announcement = await ScheduledAnnouncement.findOneAndDelete({ _id: id, guildId, isSent: false });
    if (!announcement) return false;
    const jobId = id.toString();
    if (scheduledJobs.has(jobId)) {
        clearTimeout(scheduledJobs.get(jobId));
        scheduledJobs.delete(jobId);
    }
    return true;
}

async function getScheduledAnnouncements(guildId) {
    return ScheduledAnnouncement.find({ guildId, isSent: false }).sort({ scheduledDate: 1 });
}

async function sendAnnouncement(guildId, channelId, title, content, color = '#0099ff') {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error(`Сервер ${guildId} не найден`);
    const channel = guild.channels.cache.get(channelId);
    if (!channel) throw new Error(`Канал ${channelId} не найден`);
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(content)
        .setColor(color)
        .setTimestamp();
    await channel.send({ embeds: [embed] });
    return true;
}

module.exports = {
    initialize,
    scheduleAnnouncement,
    updateAnnouncement,
    cancelAnnouncement,
    getScheduledAnnouncements,
    sendAnnouncement
};

