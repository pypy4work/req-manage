const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const store = new AsyncLocalStorage();

function withRequestContext(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const userId =
    req.user?.user_id ||
    req.headers['x-user-id'] ||
    req.headers['x-user'] ||
    req.headers['x-actor-id'] ||
    req.body?.user_id ||
    null;
  const context = {
    requestId,
    userId: userId != null ? String(userId) : null,
    endpoint: `${req.method} ${req.originalUrl || req.url}`,
    ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null,
    userAgent: req.headers['user-agent'] || null
  };

  store.run(context, () => {
    res.setHeader('X-Request-Id', requestId);
    next();
  });
}

function getRequestContext() {
  return store.getStore() || {};
}

module.exports = { withRequestContext, getRequestContext };
