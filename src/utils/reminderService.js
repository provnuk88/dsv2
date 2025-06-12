// Сервис для отправки напоминаний о мероприятиях
const { EmbedBuilder } = require('discord.js');
const Registration = require('../database/models/Registration');
const client = require('../index').client;
const logger = require('./logger');

const sendReminder = async (event) => {
    try {
        const registrations = await Registration.find({ eventId: event._id, status: 'confirmed' });
        if (registrations.length === 0) return true;

        const startTime = Math.floor(new Date(event.startDate).getTime() / 1000);
        const embed = new EmbedBuilder()
            .setColor('#2196F3')
            .setTitle('⏰ Напоминание о мероприятии')
            .setDescription(`Мероприятие **${event.title}** начнется <t:${startTime}:R>!`);

        for (const reg of registrations) {
            try {
                const user = await client.users.fetch(reg.discordId);
                if (user) {
                    await user.send({ embeds: [embed] });
                }
            } catch (err) {
                logger.error(`Failed to send reminder to ${reg.discordId}: ${err.message}`);
            }
        }

        return true;
    } catch (error) {
        logger.error(`Error sending reminders for event ${event._id}: ${error.message}`);
        return false;
    }
};

module.exports = {
    sendReminder
};
