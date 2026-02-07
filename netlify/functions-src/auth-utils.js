const jwt = require('jsonwebtoken');
const { isProduction } = require('./db-router');

const DEFAULT_ISSUER = 'sca-requests';
const DEFAULT_EXPIRES_IN = '12h';

function getJwtSecret() {
  const secret =
    process.env.JWT_SECRET ||
    process.env.SCA_JWT_SECRET ||
    process.env.JWT_PRIVATE_KEY ||
    '';
  if (!secret && isProduction()) {
    const err = new Error('JWT_SECRET is required in production.');
    err.code = 'JWT_SECRET_MISSING';
    throw err;
  }
  return secret || 'dev-insecure-secret';
}

function getJwtIssuer() {
  return process.env.JWT_ISSUER || DEFAULT_ISSUER;
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN;
}

function signAuthToken(payload, options = {}) {
  return jwt.sign(payload, getJwtSecret(), {
    issuer: getJwtIssuer(),
    expiresIn: getJwtExpiresIn(),
    ...options
  });
}

function verifyAuthToken(token) {
  return jwt.verify(token, getJwtSecret(), { issuer: getJwtIssuer() });
}

module.exports = {
  getJwtSecret,
  getJwtIssuer,
  getJwtExpiresIn,
  signAuthToken,
  verifyAuthToken
};
