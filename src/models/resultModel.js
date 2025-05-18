const mongoose = require("mongoose");

const resultModel = new mongoose.Schema({
  userId: Number,
  username: String,
  testId: mongoose.Schema.Types.ObjectId,
  answers: [
    {
      question: String,
      chosenAnswer: String,
      isCorrect: Boolean,
    },
  ],
});

module.exports = mongoose.model("Result", resultModel);
