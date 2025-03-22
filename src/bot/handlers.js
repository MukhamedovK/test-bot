const {
  startTest,
  handleTestAnswer,
  startCreatingTest,
} = require("./testHandler");
const { getAllTests, deleteTest } = require("../controllers/testController");
const Settings = require("../models/settingsModel");

const admins = [940993779];

// 📌 Обработчик кнопок
function handleButtons(bot) {
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    if (text === "/start" || text === "🏠 Главное меню") {
      sendWelcomeMessage(bot, chatId);
      return sendMainMenu(bot, chatId, userId);
    }

    if (text === "📋 Список тестов") {
      return sendTestList(bot, chatId, userId);
    }

    if (text === "🎯 Пройти тест") {
      return startTest(bot, msg);
    }

    if (text === "➕ Создать тест" && admins.includes(msg.from.id)) {
      return startCreatingTest(bot, msg);
    }

    if (text === "🗑 Удалить тест" && admins.includes(msg.from.id)) {
      return sendDeleteTestMenu(bot, chatId, userId);
    }

    if (text === "📢 Рассылка" && admins.includes(msg.from.id)) {
      return sendBroadcastMenu(bot, chatId, userId);
    }
  });

  bot.on("callback_query", async (callbackQuery) => {
    handleTestAnswer(bot, callbackQuery);
  });
}

// 📌 Главное меню
function sendMainMenu(bot, chatId, userId) {
  let keyboard;
  if (admins.includes(userId)) {
    keyboard = {
      reply_markup: {
        keyboard: [
          ["📋 Список тестов", "🎯 Пройти тест"],
          ["➕ Создать тест", "🗑 Удалить тест"],
          ["📢 Рассылка", "❓ Помощь"],
        ],
        resize_keyboard: true,
      },
    };
  } else {
    keyboard = {
      reply_markup: {
        keyboard: [["🎯 Пройти тест", "❓ Помощь"]],
        resize_keyboard: true,
      },
    };
  }
  bot.sendMessage(chatId, "Выберите действие:", keyboard);
}

const sendWelcomeMessage = (bot, chatId) => {
  bot.sendMessage(chatId, "👋 Добро пожаловать!");
};

// 📌 Список тестов
async function sendTestList(bot, chatId) {
  const tests = await getAllTests();
  if (!tests.length) return bot.sendMessage(chatId, "❌ Тесты не найдены.");

  const buttons = tests.map((test) => [
    { text: test.title, callback_data: `start_${test._id}` },
  ]);

  bot.sendMessage(chatId, "📋 Список тестов:", {
    reply_markup: { inline_keyboard: buttons },
  });
}

// 📌 Удаление теста
async function sendDeleteTestMenu(bot, chatId) {
  const tests = await getAllTests();
  if (!tests.length)
    return bot.sendMessage(chatId, "❌ Нет тестов для удаления.");

  const buttons = tests.map((test) => [
    { text: `🗑 ${test.title}`, callback_data: `delete_${test._id}` },
  ]);

  bot.sendMessage(chatId, "Выберите тест для удаления:", {
    reply_markup: { inline_keyboard: buttons },
  });

  bot.on("callback_query", async (callbackQuery) => {
    const data = callbackQuery.data;
    if (data.startsWith("delete_")) {
      await deleteTest(data.split("_")[1]);
      bot.sendMessage(chatId, "✅ Тест удалён.");
    }
  });
}

// 📌 Меню рассылки
async function sendBroadcastMenu(bot, chatId, userId) {
  const settings = await Settings.findOne();
  const text = `📢 Введите новый текст для рассылки:`;

  bot
    .sendMessage(
      chatId,
      `Ваш предыдущий текст для рассылки: \n${settings?.broadcastMessage}`
    )
    .then(() => {
      bot.sendMessage(chatId, text, {
        reply_markup: {
          keyboard: [["Назад"]],
          resize_keyboard: true,
        },
      });
    });

  bot.once("message", async (msg) => {
    if (msg.text === "Назад") {
      return sendMainMenu(bot, chatId, userId);
    }
    if (!admins.includes(msg.from.id)) return;
    await Settings.updateOne(
      {},
      { broadcastMessage: msg.text },
      { upsert: true }
    );
    bot.sendMessage(chatId, "✅ Текст рассылки сохранён.");
    sendMainMenu(bot, chatId, userId);
  });
}

module.exports = { handleButtons };
