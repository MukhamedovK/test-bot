const Test = require("../models/testModel");

const getAllTests = async () => {
  return await Test.find();
};

const deleteTest = async (testId) => {
  await Test.findByIdAndDelete(testId);
};

module.exports = { getAllTests, deleteTest };
