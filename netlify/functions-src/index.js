const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const adminRoutes = require('./routes/admin');
const adminExtendedRoutes = require('./routes/admin-extended');
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employee');
const managerRoutes = require('./routes/manager');

const app = express();

// API prefix:
// - Netlify Functions (serverless): prefer root paths to avoid double /api
// - Traditional server (Render/Railway/local): keep /api prefix
const isNetlify = !!process.env.NETLIFY;
const rawApiPrefix = process.env.API_PREFIX;
const apiPrefix = rawApiPrefix !== undefined ? rawApiPrefix : (isNetlify ? '' : '/api');
const normalizePrefix = (prefix) => {
  if (!prefix) return '';
  const trimmed = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};
const apiBase = normalizePrefix(apiPrefix);

// CORS configuration - allow Netlify frontend
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',') : [])
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true
}));

app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use(`${apiBase}/admin`, adminRoutes);
app.use(`${apiBase}/admin`, adminExtendedRoutes); // Extended admin routes
app.use(`${apiBase}/auth`, authRoutes);
app.use(`${apiBase}/employee`, employeeRoutes);
app.use(`${apiBase}/manager`, managerRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', dialect: process.env.DB_DIALECT || 'mssql' }));

if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`SCA Backend running on port ${port}`);
    console.log(`Database dialect: ${process.env.DB_DIALECT || 'mssql'}`);
  });
}

module.exports = app;
