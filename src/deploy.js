const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('Текущая директория:', process.cwd());

const commands = [];
// Используем абсолютный путь к директории команд
const commandsDir = path.join(process.cwd(), 'src', 'commands');
console.log('Путь к директории команд:', commandsDir);

try {
  // Проверяем существование директории
  if (!fs.existsSync(commandsDir)) {
    console.error('Директория команд не найдена:', commandsDir);
    process.exit(1);
  }

  const commandFolders = fs.readdirSync(commandsDir);
  console.log('Найдены папки команд:', commandFolders);

  for (const folder of commandFolders) {
    const commandsPath = path.join(commandsDir, folder);
    console.log('Проверяем папку:', commandsPath);
    
    if (!fs.existsSync(commandsPath)) {
      console.error('Папка не найдена:', commandsPath);
      continue;
    }
    
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    console.log(`Найдены файлы команд в папке ${folder}:`, commandFiles);
    
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      console.log('Загружаем команду из:', filePath);
      
      try {
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
          commands.push(command.data.toJSON());
          console.log(`Команда ${file} успешно добавлена`);
        } else {
          console.log(`[WARNING] Команда в ${filePath} не содержит необходимых свойств "data" или "execute".`);
        }
      } catch (error) {
        console.error(`Ошибка при загрузке команды ${file}:`, error);
      }
    }
  }

  // Проверяем наличие токена и ID
  if (!process.env.BOT_TOKEN) {
    console.error('Ошибка: BOT_TOKEN не найден в .env файле');
    process.exit(1);
  }

  if (!process.env.CLIENT_ID) {
    console.error('Ошибка: CLIENT_ID не найден в .env файле');
    process.exit(1);
  }

  // Создаем и настраиваем REST
  const rest = new REST().setToken(process.env.BOT_TOKEN);

  // Регистрируем команды
  (async () => {
    try {
      console.log(`Начинаю регистрацию ${commands.length} slash-команд.`);

      // Регистрация команд для конкретного сервера (гильдии)
      if (process.env.GUILD_ID) {
        console.log(`Регистрируем команды для сервера ${process.env.GUILD_ID}`);
        const data = await rest.put(
          Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
          { body: commands },
        );
        console.log(`Успешно зарегистрировано ${data.length} команд для сервера.`);
      } else {
        // Глобальная регистрация команд (для всех серверов)
        console.log('Регистрируем глобальные команды');
        const data = await rest.put(
          Routes.applicationCommands(process.env.CLIENT_ID),
          { body: commands },
        );
        console.log(`Успешно зарегистрировано ${data.length} глобальных команд.`);
      }
    } catch (error) {
      console.error('Ошибка при регистрации команд:', error);
    }
  })();
} catch (error) {
  console.error('Произошла критическая ошибка:', error);
}
