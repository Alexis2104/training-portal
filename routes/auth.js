const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/init');

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const user = db.prepare(`
    SELECT u.*, r.name as role_name, r.level, r.department_id,
           d.name as dept_name, d.class as dept_class
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN departments d ON r.department_id = d.id
    WHERE u.email = ?
  `).get(email.toLowerCase().trim());

  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Incorrect email or password' });

  req.session.userId = user.id;
  req.session.isAdmin = user.is_admin === 1;
  req.session.userName = user.name;

  res.json({ success: true, isAdmin: user.is_admin === 1, redirect: user.is_admin ? '/admin.html' : '/dashboard.html' });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });

  const user = db.prepare(`
    SELECT u.id, u.name, u.email, u.is_admin,
           r.name as role_name, r.level,
           d.name as dept_name, d.class as dept_class, d.color as dept_color
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN departments d ON r.department_id = d.id
    WHERE u.id = ?
  `).get(req.session.userId);

  res.json(user);
});

module.exports = router;
