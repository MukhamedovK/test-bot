const Test = require("../models/testModel");

const createTest = async (title, questions) => {
  const test = new Test({ title, questions });
  await test.save();
  return test;
};

const getAllTests = async () => {
  return await Test.find();
};

const deleteTest = async (testId) => {
  return await Test.findByIdAndDelete(testId);
};

module.exports = { createTest, getAllTests, deleteTest };
