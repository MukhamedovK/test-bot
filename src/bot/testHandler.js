const Test = require("../models/testModel");
const { createTest, saveUserResult } = require("../controllers/testController");

const userSessions = {};
const testCreationSessions = {};

const admins = [940993779]; // ID админов

// 📌 Начало теста
async function startTest(bot, msg) {
  const tests = await Test.find();
  if (!tests.length) return bot.sendMessage(msg.chat.id, "❌ Нет доступных тестов.");

  const buttons = tests.map((test) => [{ text: test.title, callback_data: `start_${test._id}` }]);

  bot.sendMessage(msg.chat.id, "📌 Выберите тест:", {
    reply_markup: { inline_keyboard: buttons },
  });
}

// 📌 Обработка ответов
async function handleTestAnswer(bot, callbackQuery) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;

  if (data.startsWith("start_")) {
    const testId = data.split("_")[1];
    userSessions[userId] = { testId, currentQuestion: 0, answers: [] };
    return sendQuestion(bot, chatId, userId);
  }

  if (data.startsWith("answer_")) {
    const [_, qIndex, chosenAnswer] = data.split("_");
    const session = userSessions[userId];
    if (!session) return;

    const test = await Test.findById(session.testId);
    const question = test.questions[Number(qIndex)];

    const isCorrect = question.options.some((opt) => opt.text === chosenAnswer && opt.isCorrect);
    session.answers.push({ question: question.text, chosenAnswer, isCorrect });

    bot.answerCallbackQuery(callbackQuery.id, { text: isCorrect ? "✅ Верно!" : "❌ Неверно" });

    session.currentQuestion++;
    if (session.currentQuestion < test.questions.length) {
      sendQuestion(bot, chatId, userId);
    } else {
      await saveUserResult(userId, session.testId, session.answers);
      sendFinalResults(bot, chatId, session.answers);
      delete userSessions[userId];
    }
  }
}

// 📌 Отправка вопроса
async function sendQuestion(bot, chatId, userId) {
  const session = userSessions[userId];
  const test = await Test.findById(session.testId);
  const question = test.questions[session.currentQuestion];

  const options = question.options.map((opt) => ({
    text: opt.text,
    callback_data: `answer_${session.currentQuestion}_${opt.text}`,
  }));

  bot.sendMessage(chatId, `❓ ${question.text}`, { reply_markup: { inline_keyboard: [options] } });
}

// 📌 Начало создания теста
async function startCreatingTest(bot, msg) {
  if (!admins.includes(msg.from.id)) return bot.sendMessage(msg.chat.id, "❌ У вас нет прав!");

  testCreationSessions[msg.from.id] = { title: "", questions: [], step: 0 };

  bot.sendMessage(msg.chat.id, "📝 Выберите действие:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "➕ Создать тест", callback_data: "create_test" }],
      ],
    },
  });
}

// 📌 Обработка создания теста
async function handleCreateTest(bot, callbackQuery) {
  const userId = callbackQuery.from.id;
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === "create_test") {
    testCreationSessions[userId] = { title: "", questions: [], step: 1 };
    bot.sendMessage(chatId, "✍ Введите название теста:");
  } else if (data === "add_question") {
    bot.sendMessage(chatId, "📝 Введите текст вопроса:");
    testCreationSessions[userId].step = 2;
  } else if (data === "finish_test") {
    const testData = testCreationSessions[userId];
    if (!testData || !testData.title || testData.questions.length === 0) {
      return bot.sendMessage(chatId, "❌ Нельзя создать пустой тест!");
    }

    await createTest(testData);
    delete testCreationSessions[userId];
    bot.sendMessage(chatId, "✅ Тест успешно создан!");
  }
}

// 📌 Обработка текстовых ответов
async function handleTextMessage(bot, msg) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const session = testCreationSessions[userId];

  if (!session) return;

  if (session.step === 1) {
    session.title = msg.text;
    bot.sendMessage(chatId, "📌 Теперь добавьте вопрос:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Добавить вопрос", callback_data: "add_question" }],
        ],
      },
    });
  } else if (session.step === 2) {
    session.questions.push({ text: msg.text, options: [] });
    session.step = 3;
    bot.sendMessage(chatId, "✏ Добавьте варианты ответа (нажмите на кнопку для выбора правильного):");
  } else if (session.step === 3) {
    const currentQuestion = session.questions[session.questions.length - 1];
    currentQuestion.options.push({ text: msg.text, isCorrect: false });

    bot.sendMessage(chatId, `✅ Добавлен ответ: "${msg.text}". Сделать его правильным?`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Да", callback_data: `set_correct_${currentQuestion.options.length - 1}` }],
          [{ text: "➕ Добавить еще ответ", callback_data: "add_more_answers" }],
          [{ text: "⏭ Завершить вопрос", callback_data: "next_question" }],
        ],
      },
    });
  }
}

// 📌 Обработка выбора правильного ответа
async function handleCorrectAnswer(bot, callbackQuery) {
  const userId = callbackQuery.from.id;
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (!testCreationSessions[userId] || !data.startsWith("set_correct_")) return;

  const index = Number(data.split("_")[2]);
  const currentQuestion = testCreationSessions[userId].questions[testCreationSessions[userId].questions.length - 1];

  currentQuestion.options[index].isCorrect = true;
  bot.sendMessage(chatId, "✅ Ответ отмечен как правильный!");
}

// 📌 Завершение вопроса и теста
async function handleNextQuestion(bot, callbackQuery) {
  const userId = callbackQuery.from.id;
  const chatId = callbackQuery.message.chat.id;

  bot.sendMessage(chatId, "📌 Вопрос добавлен! Что дальше?", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "➕ Добавить еще вопрос", callback_data: "add_question" }],
        [{ text: "✅ Завершить тест", callback_data: "finish_test" }],
      ],
    },
  });
}

module.exports = {
  startTest,
  handleTestAnswer,
  startCreatingTest,
  handleCreateTest,
  handleTextMessage,
  handleCorrectAnswer,
  handleNextQuestion,
};
