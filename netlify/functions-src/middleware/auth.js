const { verifyAuthToken } = require('../auth-utils');
const { query } = require('../services/db-service');
const { isProduction } = require('../db-router');

function getBearerToken(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return (
    req.headers['x-access-token'] ||
    req.headers['x-auth-token'] ||
    ''
  );
}

function shouldValidateSession() {
  if (process.env.AUTH_SESSION_VALIDATE === 'false') return false;
  if (process.env.AUTH_SESSION_VALIDATE === 'true') return true;
  return isProduction();
}

function normalizeUserId(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function authenticateRequest(req, res, next) {
  const token = getBearerToken(req);
  if (!token) return next();
  try {
    const payload = verifyAuthToken(token);
    req.user = {
      user_id: normalizeUserId(payload.sub),
      username: payload.username,
      role: payload.role,
      session_version: payload.sv,
      token_issued_at: payload.iat,
      token_expires_at: payload.exp
    };
  } catch (err) {
    req.authError = err;
  }
  return next();
}

function describeAuthError(err) {
  if (!err) return null;
  if (err.code === 'JWT_SECRET_MISSING') return 'Server auth misconfiguration.';
  if (err.name === 'TokenExpiredError') return 'Token expired.';
  if (err.name === 'JsonWebTokenError') return 'Invalid token.';
  return 'Authentication error.';
}

function requireAuth(options = {}) {
  const { allowPasswordChange = false } = options;
  return async (req, res, next) => {
    if (req.authError) {
      const message = describeAuthError(req.authError);
      const status = req.authError.code === 'JWT_SECRET_MISSING' ? 500 : 401;
      return res.status(status).json({ error: message });
    }

    if (!req.user || !req.user.user_id) {
      return res.status(401).json({ error: 'Missing authentication token.' });
    }

    if (shouldValidateSession()) {
      try {
        const rows = await query(
          'SELECT session_version, is_active, locked_until, must_change_password FROM sca.user_credentials WHERE user_id = @UserId',
          { UserId: req.user.user_id }
        );
        const cred = rows?.[0];
        if (!cred) return res.status(401).json({ error: 'Invalid session.' });
        if (cred.is_active === false) return res.status(403).json({ error: 'Account disabled.' });
        if (cred.locked_until && new Date(cred.locked_until) > new Date()) {
          return res.status(423).json({ error: 'Account locked. Try again later.' });
        }
        const sv = Number(cred.session_version || 0);
        if (Number(req.user.session_version || 0) !== sv) {
          return res.status(401).json({ error: 'Session expired. Please login again.' });
        }
        if (cred.must_change_password && !allowPasswordChange) {
          return res.status(403).json({ error: 'Password change required.' });
        }
      } catch (err) {
        return res.status(500).json({ error: err.message || 'Auth session check failed.' });
      }
    }

    return next();
  };
}

module.exports = {
  authenticateRequest,
  requireAuth,
  getBearerToken
};
