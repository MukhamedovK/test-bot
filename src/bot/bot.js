const TelegramBot = require("node-telegram-bot-api");
const { handleButtons } = require("./handlers");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

handleButtons(bot);

module.exports = bot;
