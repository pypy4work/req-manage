const serverless = require('serverless-http');
const app = require('../functions-src/index');

const handler = serverless(app, {
  // Netlify routes to this function using /api/* (via redirects),
  // but direct function paths may still include /.netlify/functions/api.
  // We'll normalize paths in the handler below.
  basePath: '/api'
});

module.exports.handler = async (event, context) => {
  if (event?.path) {
    if (event.path.startsWith('/.netlify/functions/api')) {
      event.path = event.path.replace('/.netlify/functions/api', '/api');
    } else if (event.path.startsWith('/api/')) {
      // keep as-is; basePath will strip /api
    } else if (event.path === '/api') {
      // normalize bare /api to /api/
      event.path = '/api/';
    }
  }
  return handler(event, context);
};
