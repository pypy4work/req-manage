const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { query, getDialect } = require('../services/db-service');
const { signAuthToken, getJwtExpiresIn } = require('../auth-utils');
const { requireAuth } = require('../middleware/auth');

const MAX_FAILED_ATTEMPTS = Number(process.env.AUTH_MAX_FAILED || 5);
const LOCK_MINUTES = Number(process.env.AUTH_LOCK_MINUTES || 15);

function nowSql() {
  return getDialect() === 'postgres' ? 'NOW()' : 'SYSUTCDATETIME()';
}

function buildUserLookupSql() {
  const limitPrefix = getDialect() === 'postgres' ? '' : 'TOP 1';
  const limitSuffix = getDialect() === 'postgres' ? 'LIMIT 1' : '';
  return `
    SELECT ${limitPrefix}
      u.user_id, u.full_name, u.username, u.email, u.role, u.org_unit_id, u.job_id, u.grade_id, u.picture_url,
      c.password_hash, c.is_active, c.failed_attempts, c.locked_until, c.session_version, c.must_change_password
    FROM sca.users u
    LEFT JOIN sca.user_credentials c ON c.user_id = u.user_id
    WHERE u.username = @ident OR u.email = @ident OR u.national_id = @ident OR u.employee_number = @ident OR u.full_employee_number = @ident
    ${limitSuffix}
  `;
}

function normalizeIdentifier(identifier) {
  return String(identifier || '').trim();
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    const ident = normalizeIdentifier(identifier);
    if (!ident || !password) {
      return res.status(400).json({ status: 'ERROR', message: 'identifier and password required' });
    }

    const rows = await query(buildUserLookupSql(), { ident });
    if (!rows || rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'User not found' });
    }
    const user = rows[0];
    const cred = {
      password_hash: user.password_hash,
      is_active: user.is_active,
      failed_attempts: user.failed_attempts,
      locked_until: user.locked_until,
      session_version: user.session_version,
      must_change_password: user.must_change_password
    };

    if (!cred.password_hash) {
      return res.status(401).json({ status: 'ERROR', message: 'Credentials not set for user.' });
    }
    if (cred.is_active === false) {
      return res.status(403).json({ status: 'ERROR', message: 'Account disabled.' });
    }
    if (cred.locked_until && new Date(cred.locked_until) > new Date()) {
      return res.status(423).json({ status: 'ERROR', message: 'Account locked. Try again later.' });
    }

    const ok = await bcrypt.compare(String(password), String(cred.password_hash));
    if (!ok) {
      const nextAttempts = Number(cred.failed_attempts || 0) + 1;
      const lockUntil = nextAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
        : null;
      await query(
        `UPDATE sca.user_credentials
         SET failed_attempts = @FailedAttempts,
             locked_until = @LockedUntil,
             updated_at = ${nowSql()}
         WHERE user_id = @UserId`,
        {
          FailedAttempts: nextAttempts,
          LockedUntil: lockUntil ? lockUntil.toISOString() : null,
          UserId: user.user_id
        }
      );
      return res.status(401).json({ status: 'ERROR', message: 'Invalid credentials.' });
    }

    await query(
      `UPDATE sca.user_credentials
       SET failed_attempts = 0,
           locked_until = NULL,
           last_login_at = ${nowSql()},
           updated_at = ${nowSql()}
       WHERE user_id = @UserId`,
      { UserId: user.user_id }
    );

    const token = signAuthToken({
      sub: user.user_id,
      username: user.username,
      role: user.role,
      sv: Number(cred.session_version || 0)
    });

    const safeUser = {
      user_id: user.user_id,
      full_name: user.full_name,
      username: user.username,
      email: user.email,
      role: user.role,
      org_unit_id: user.org_unit_id,
      job_id: user.job_id,
      grade_id: user.grade_id,
      picture_url: user.picture_url,
      must_change_password: !!cred.must_change_password
    };

    return res.json({
      status: 'SUCCESS',
      user: safeUser,
      token,
      token_type: 'Bearer',
      expires_in: getJwtExpiresIn(),
      must_change_password: !!cred.must_change_password
    });
  } catch (e) {
    return res.status(500).json({ status: 'ERROR', message: e.message });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth(), async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) return res.status(401).json({ error: 'Missing auth.' });
    await query(
      `UPDATE sca.user_credentials
       SET session_version = COALESCE(session_version, 0) + 1,
           updated_at = ${nowSql()}
       WHERE user_id = @UserId`,
      { UserId: userId }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth({ allowPasswordChange: true }), async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const { newPassword } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Missing auth.' });
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const hash = await bcrypt.hash(String(newPassword), 10);
    await query(
      `UPDATE sca.user_credentials
       SET password_hash = @Hash,
           password_algo = 'bcrypt',
           password_updated_at = ${nowSql()},
           must_change_password = FALSE,
           failed_attempts = 0,
           locked_until = NULL,
           session_version = COALESCE(session_version, 0) + 1,
           updated_at = ${nowSql()}
       WHERE user_id = @UserId`,
      { Hash: hash, UserId: userId }
    );

    const token = signAuthToken({
      sub: userId,
      username: req.user?.username,
      role: req.user?.role,
      sv: Number(req.user?.session_version || 0) + 1
    });

    res.json({ success: true, token, token_type: 'Bearer', expires_in: getJwtExpiresIn() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
