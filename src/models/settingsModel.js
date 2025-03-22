const mongoose = require("mongoose");

const settingsModel = new mongoose.Schema({
    broadcastMessage: String,
});

module.exports = mongoose.model("Settings", settingsModel);
