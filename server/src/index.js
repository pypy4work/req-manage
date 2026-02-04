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
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminExtendedRoutes); // Extended admin routes
app.use('/api/auth', authRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/manager', managerRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', dialect: process.env.DB_DIALECT || 'mssql' }));

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`SCA Backend running on port ${port}`);
  console.log(`Database dialect: ${process.env.DB_DIALECT || 'mssql'}`);
});
