const Result = require("../models/resultModel");

const saveUserResult = async (userId, username, testId, answers) => {
  const result = new Result({ userId, username, testId, answers });
  await result.save();
};

const getTestResults = async (testId) => {
  return await Result.find({ testId });
};

module.exports = { saveUserResult, getTestResults };
