const serverless = require('serverless-http');
const app = require('../functions-src/index');

const handler = serverless(app, {
  basePath: '/.netlify/functions/api'
});

module.exports.handler = async (event, context) => {
  return handler(event, context);
};
