const mongoose = require("mongoose");

const testModel = new mongoose.Schema({
    title: String,
    questions: [
        {
            text: String,
            options: [
                {
                    text: String,
                    isCorrect: Boolean,
                },
            ],
        },
    ],
});

module.exports = mongoose.model("Test", testModel);
