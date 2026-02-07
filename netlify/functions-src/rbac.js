const { query } = require('./db-repository');
const { isProduction } = require('./db-router');

function getUserId(req) {
  return (
    req.user?.user_id ||
    req.headers['x-user-id'] ||
    req.headers['x-user'] ||
    req.headers['x-actor-id'] ||
    req.body?.user_id ||
    req.query?.user_id ||
    null
  );
}

function allowBypass() {
  return !isProduction() && process.env.RBAC_BYPASS !== 'false';
}

function requirePermission(permissionKey) {
  return async (req, res, next) => {
    if (allowBypass()) return next();

    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing user identity for RBAC.' });
    }

    try {
      const roleRows = await query('SELECT role FROM sca.users WHERE user_id = @UserId', { UserId: Number(userId) });
      const role = String(roleRows?.[0]?.role || '').toLowerCase();
      if (role === 'admin') return next();

      const permRows = await query(
        'SELECT 1 FROM sca.user_permissions WHERE user_id = @UserId AND permission_key = @PermissionKey',
        { UserId: Number(userId), PermissionKey: permissionKey }
      );
      if (permRows && permRows.length > 0) return next();

      return res.status(403).json({ error: 'Forbidden: insufficient permissions.' });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'RBAC check failed.' });
    }
  };
}

function requireAnyPermission(permissionKeys = []) {
  return async (req, res, next) => {
    if (allowBypass()) return next();
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Missing user identity for RBAC.' });
    }

    try {
      const roleRows = await query('SELECT role FROM sca.users WHERE user_id = @UserId', { UserId: Number(userId) });
      const role = String(roleRows?.[0]?.role || '').toLowerCase();
      if (role === 'admin') return next();

      if (permissionKeys.length === 0) return res.status(403).json({ error: 'Forbidden.' });

      const placeholders = permissionKeys.map((_, i) => `@Perm${i}`).join(',');
      const params = { UserId: Number(userId) };
      permissionKeys.forEach((key, idx) => {
        params[`Perm${idx}`] = key;
      });

      const rows = await query(
        `SELECT permission_key FROM sca.user_permissions WHERE user_id = @UserId AND permission_key IN (${placeholders})`,
        params
      );
      if (rows && rows.length > 0) return next();

      return res.status(403).json({ error: 'Forbidden: insufficient permissions.' });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'RBAC check failed.' });
    }
  };
}

module.exports = { requirePermission, requireAnyPermission, getUserId };
