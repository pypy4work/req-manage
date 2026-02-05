const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server', '.env')
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const { initDbRouter, getRouterState } = require('./db');
const { withRequestContext } = require('./db-context');
const { createRateLimiter } = require('./rate-limit');

const adminRoutes = require('./routes/admin');
const adminExtendedRoutes = require('./routes/admin-extended');
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employee');
const managerRoutes = require('./routes/manager');
const systemRoutes = require('./routes/system');

const app = express();
app.set('trust proxy', true);

// API prefix:
// - Serverless (Netlify/AWS Lambda): prefer root paths to avoid double /api
// - Traditional server (Render/Railway/local): keep /api prefix
const isServerless =
  !!process.env.NETLIFY ||
  !!process.env.NETLIFY_DEV ||
  !!process.env.NETLIFY_LOCAL ||
  !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
  !!process.env.LAMBDA_TASK_ROOT;
const rawApiPrefix = process.env.API_PREFIX;
const apiPrefix = rawApiPrefix !== undefined ? rawApiPrefix : (isServerless ? '' : '/api');
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
app.use(withRequestContext);

const writeLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 120 });
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return writeLimiter(req, res, next);
  }
  return next();
});

// Routes
app.use(`${apiBase}/admin`, adminRoutes);
app.use(`${apiBase}/admin`, adminExtendedRoutes); // Extended admin routes
app.use(`${apiBase}/auth`, authRoutes);
app.use(`${apiBase}/employee`, employeeRoutes);
app.use(`${apiBase}/manager`, managerRoutes);
app.use(`${apiBase}/system`, systemRoutes);
// Fallback: if API prefix mismatch, still expose /system routes.
if (apiBase !== '/system' && apiBase !== '') {
  app.use('/system', systemRoutes);
}

app.get('/health', async (req, res) => {
  await initDbRouter();
  const state = getRouterState();
  res.json({ status: 'ok', active_database: state.active || 'none', degraded: state.degraded || false });
});

initDbRouter().catch((err) => {
  console.error('Database router initialization failed:', err.message || err);
});

if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`SCA Backend running on port ${port}`);
    console.log(`Database dialect: ${process.env.DB_DIALECT || 'mssql'}`);
  });
}

module.exports = app;
