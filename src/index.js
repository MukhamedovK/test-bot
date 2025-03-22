require("dotenv").config();
const connectDB = require("./config/database");
const bot = require("./bot/bot");

connectDB().then(() => console.log("🤖 Бот запущен!"));
