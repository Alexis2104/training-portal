require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

if (!process.env.SESSION_SECRET) {
  console.error('❌  SESSION_SECRET is not set. Copy .env.example to .env and configure it.');
  process.exit(1);
}

// Initialize database schema
require('./database/init');

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/modules', require('./routes/modules'));
app.use('/api/admin', require('./routes/admin'));

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login.html');
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.redirect('/dashboard.html');
  next();
}

// Page routes
app.get('/', (req, res) => {
  if (!req.session.userId) return res.redirect('/login.html');
  res.redirect(req.session.isAdmin ? '/admin.html' : '/dashboard.html');
});
app.get('/dashboard.html', requireAuth, (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin.html');
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.get('/module.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'module.html'));
});
app.get('/admin.html', requireAuth, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/admin-module.html', requireAuth, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-module.html'));
});

app.listen(PORT, () => {
  console.log(`✅  Training Portal running at http://localhost:${PORT}`);
  console.log(`   Run "npm run seed" first if the database is empty.`);
});
