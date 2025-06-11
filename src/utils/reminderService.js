// Сервис для отправки напоминаний о мероприятиях
const sendReminder = async (event) => {
    console.log(`Отправка напоминания о мероприятии: ${event.title}`);
    // Здесь будет логика отправки напоминаний
    return true;
};

module.exports = {
    sendReminder
};
