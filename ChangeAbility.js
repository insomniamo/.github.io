const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const cheerio = require('cheerio');

const token = '';

const bot = new TelegramBot(token, { polling: true });

// Объект для хранения текущего состояния пользователей
const userStates = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Привет! Отправь команду /getdata чтобы получить информацию из HTML-файла.');
});

bot.onText(/\/getdata/, (msg) => {
  const chatId = msg.chat.id;

  // Читаем содержимое локального HTML-файла
  fs.readFile('CV.html', 'utf8', (err, data) => {
    if (err) {
      bot.sendMessage(chatId, 'Произошла ошибка при чтении файла.');
      return;
    }

    const $ = cheerio.load(data);

    const ul = $('#list');
    if (ul.length === 0) {
      bot.sendMessage(chatId, 'Не удалось найти список с id "list".');
      return;
    }

    const liTags = ul.find('li');
    const liTexts = liTags.map((index, li) => $(li).text()).get();

    const keyboard = {
      reply_markup: {
        inline_keyboard: liTexts.map((liText, index) => [
          { text: liText, callback_data: `li_${index}` }
        ])
      }
    };

    bot.sendMessage(chatId, 'Выберите элемент:', keyboard);
  });
});

bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const buttonIndex = parseInt(query.data.split('_')[1]);

  const liTexts = query.message.reply_markup.inline_keyboard.map(row => row[0].text);
  const selectedLi = liTexts[buttonIndex];

  // Сохраняем состояние пользователя для режима редактирования
  userStates[chatId] = { selectedLi };

  bot.answerCallbackQuery(query.id);
  bot.sendMessage(chatId, `Выбран элемент:\n\n${selectedLi}\n\nВведите новый текст для этого элемента:`);
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userState = userStates[chatId];

  if (userState && userState.selectedLi) {
    const newLiText = msg.text;
    const $ = cheerio.load(fs.readFileSync('CV.html', 'utf8'));
    const liTags = $('#list li');
    liTags.each((index, li) => {
      if ($(li).text() === userState.selectedLi) {
        $(li).text(newLiText);
      }
    });
    const updatedHtml = $.html();

    // Очищаем состояние пользователя после редактирования
    delete userStates[chatId];

    fs.writeFileSync('CV.html', updatedHtml, 'utf8'); // Сохраняем обновленный HTML

    bot.sendMessage(chatId, 'Элемент успешно обновлен:\n\n' + newLiText);
  }
});