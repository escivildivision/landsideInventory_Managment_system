const serverless = require("serverless-http");
const app = require("../../Server");

module.exports.handler = serverless(app);
