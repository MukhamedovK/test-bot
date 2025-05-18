const mongoose = require("mongoose");

const userModel = new mongoose.Schema({
  userId: Number,
  username: String,
});

module.exports = mongoose.model("User", userModel);
