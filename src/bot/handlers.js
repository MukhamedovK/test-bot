const { getAllTests, deleteTest } = require("../controllers/testController");
const Settings = require("../models/settingsModel");
const User = require("../models/userModel");
const Test = require("../models/testModel");
const Result = require("../models/resultModel");

const admins = [940993779];
const userStates = new Map();

function handleButtons(bot) {
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    await User.findOneAndUpdate(
      { userId },
      { userId, username: msg.from.username || msg.from.first_name },
      { upsert: true }
    );

    if (text === "/start" || text === "🏠 Главное меню") {
      sendWelcomeMessage(bot, chatId);
      return sendMainMenu(bot, chatId, userId);
    }

    if (text === "📋 Список тестов") {
      return sendTestList(bot, chatId);
    }

    if (text === "🎯 Пройти тест") {
      return sendTestList(bot, chatId);
    }

    if (text === "➕ Создать тест" && admins.includes(userId)) {
      return startCreatingTest(bot, msg);
    }

    if (text === "🗑 Удалить тест" && admins.includes(userId)) {
      return sendDeleteTestMenu(bot, chatId);
    }

    if (text === "📢 Рассылка" && admins.includes(userId)) {
      return sendBroadcastMenu(bot, chatId, userId);
    }

    if (text === "📢 Отправить рассылку" && admins.includes(userId)) {
      return sendBroadcast(bot, chatId);
    }

    const state = userStates.get(chatId);
    if (state && state.action) {
      handleStatefulInput(bot, msg, state);
    }
  });

  bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    await bot.answerCallbackQuery(callbackQuery.id);

    if (data.startsWith("start_")) {
      const testId = data.split("_")[1];
      return startTest(bot, chatId, userId, testId);
    }

    if (data.startsWith("delete_") && admins.includes(userId)) {
      const testId = data.split("_")[1];
      await deleteTest(testId);
      return bot.sendMessage(chatId, "✅ Тест удалён.");
    }

    if (data.startsWith("answer_")) {
      return handleTestAnswer(bot, callbackQuery);
    }
  });
}

function sendMainMenu(bot, chatId, userId) {
  let keyboard;
  if (admins.includes(userId)) {
    keyboard = {
      reply_markup: {
        keyboard: [
          ["📋 Список тестов", "🎯 Пройти тест"],
          ["➕ Создать тест", "🗑 Удалить тест"],
          ["📢 Рассылка", "📢 Отправить рассылку"],
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
}

async function sendBroadcastMenu(bot, chatId, userId) {
  const settings = await Settings.findOne();
  const text = `📢 Введите новый текст для рассылки:`;

  bot
    .sendMessage(
      chatId,
      `Ваш предыдущий текст для рассылки: \n<b>${
        settings?.broadcastMessage || "Нет текста"
      }</b>`,
      { parse_mode: "HTML" }
    )
    .then(() => {
      bot.sendMessage(chatId, text, {
        reply_markup: {
          keyboard: [["Назад"]],
          resize_keyboard: true,
        },
      });
      userStates.set(chatId, { action: "set_broadcast", userId });
    });
}

async function sendBroadcast(bot, chatId) {
  const settings = await Settings.findOne();
  const users = await User.find();
  const broadcastMessage = settings?.broadcastMessage;

  if (!broadcastMessage) {
    return bot.sendMessage(chatId, "❌ Нет текста для рассылки.");
  }

  for (const user of users) {
    try {
      await bot.sendMessage(user.userId, `<b>${broadcastMessage}</b>`, {
        parse_mode: "HTML",
      });
    } catch (error) {
      console.error(`Failed to send message to ${user.userId}:`, error);
    }
  }

  bot.sendMessage(chatId, "✅ Рассылка отправлена.");
}

function startCreatingTest(bot, msg) {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Введите название теста:");
  userStates.set(chatId, {
    action: "create_test",
    step: "title",
    test: { title: "", questions: [] },
  });
}

async function handleStatefulInput(bot, msg, state) {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "Назад") {
    userStates.delete(chatId);
    return sendMainMenu(bot, chatId, msg.from.id);
  }

  if (state.action === "create_test") {
    if (state.step === "title") {
      state.test.title = text;
      bot.sendMessage(chatId, "Введите текст первого вопроса:");
      state.step = "question";
    } else if (state.step === "question") {
      state.currentQuestion = { text, options: [] };
      bot.sendMessage(chatId, "Введите варианты ответа (по одному в строке):");
      state.step = "options";
    } else if (state.step === "options") {
      const options = text
        .split("\n")
        .map((opt) => ({ text: opt.trim(), isCorrect: false }));
      state.currentQuestion.options = options;
      bot.sendMessage(
        chatId,
        `Введите номер правильного ответа (1-${options.length}):`
      );
      state.step = "correct_option";
    } else if (state.step === "correct_option") {
      const correctIndex = parseInt(text) - 1;
      if (
        correctIndex >= 0 &&
        correctIndex < state.currentQuestion.options.length
      ) {
        state.currentQuestion.options[correctIndex].isCorrect = true;
        state.test.questions.push(state.currentQuestion);
        bot.sendMessage(
          chatId,
          "Вопрос добавлен. Добавить ещё вопрос? (да/нет)",
          {
            reply_markup: {
              keyboard: [["Да", "Нет"]],
              resize_keyboard: true,
            },
          }
        );
        state.step = "add_more";
      } else {
        bot.sendMessage(chatId, "Неверный номер. Попробуйте снова:");
      }
    } else if (state.step === "add_more") {
      if (text.toLowerCase() === "да") {
        bot.sendMessage(chatId, "Введите текст следующего вопроса:");
        state.step = "question";
      } else {
        const test = new Test(state.test);
        await test.save();
        bot.sendMessage(chatId, "✅ Тест создан!");
        userStates.delete(chatId);
        sendMainMenu(bot, chatId, msg.from.id);
      }
    }
  } else if (state.action === "set_broadcast" && admins.includes(msg.from.id)) {
    await Settings.updateOne({}, { broadcastMessage: text }, { upsert: true });
    bot.sendMessage(chatId, "✅ Текст рассылки сохранён.");
    userStates.delete(chatId);
    sendMainMenu(bot, chatId, msg.from.id);
  }
}

async function startTest(bot, chatId, userId, testId) {
  const test = await Test.findById(testId);
  if (!test) {
    return bot.sendMessage(chatId, "❌ Тест не найден.");
  }

  let result = await Result.findOneAndUpdate(
    { userId: userId },
    { answers: [] },
    { new: true, runValidators: true }
  );

  if (!result) {
    result = new Result({
      userId,
      username:
        (await bot.getChatMember(chatId, userId)).user.username || "Unknown",
      testId,
      answers: [],
    });
    await result.save();
  }

  userStates.set(chatId, {
    action: "taking_test",
    testId,
    currentQuestionIndex: 0,
    resultId: result._id,
  });

  sendQuestion(bot, chatId, test, 0);
}

async function sendQuestion(bot, chatId, test, questionIndex) {
  if (questionIndex >= test.questions.length) {
    const result = await Result.findById(userStates.get(chatId).resultId);
    const correctAnswers = result.answers.filter((a) => a.isCorrect).length;
    const resultInfo = [];
    result.answers.map((item, id) => {
      resultInfo.push(
        `Вопрос #${id + 1}: ${item.question} \nОтвет: ${
          item.isCorrect ? "✅" : "❌"
        }`
      );
    });
    bot.sendMessage(
      chatId,
      `Тест завершён! ${correctAnswers}/${
        test.questions.length
      } правильных ответов.\nРезультаты: \n${resultInfo.join("\n")}`
    );
    userStates.delete(chatId);
    return;
  }

  const userState = userStates.get(chatId);
  if (userState?.lastMessageId) {
    try {
      await bot.deleteMessage(chatId, userState.lastMessageId);
    } catch (error) {
      console.error("Не удалось удалить сообщение:", error.message);
    }
  }

  const question = test.questions[questionIndex];
  const buttons = question.options.map((option, index) => [
    { text: option.text, callback_data: `answer_${questionIndex}_${index}` },
  ]);

  const sentMessage = await bot.sendMessage(chatId, question.text, {
    reply_markup: { inline_keyboard: buttons },
  });

  userStates.set(chatId, {
    ...(userStates.get(chatId) || {}),
    lastMessageId: sentMessage.message_id,
  });
}

async function handleTestAnswer(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const state = userStates.get(chatId);

  if (!state || state.action !== "taking_test") {
    return bot.sendMessage(chatId, "❌ Тест не активен.");
  }

  const [_, questionIndex, optionIndex] = data.split("_").map(Number);
  const test = await Test.findById(state.testId);
  const question = test.questions[questionIndex];
  const option = question.options[optionIndex];

  const result = await Result.findById(state.resultId);
  result.answers.push({
    question: question.text,
    chosenAnswer: option.text,
    isCorrect: option.isCorrect,
  });
  await result.save();

  state.currentQuestionIndex++;
  sendQuestion(bot, chatId, test, state.currentQuestionIndex);
}

module.exports = { handleButtons };
