const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/init');

function requireAdmin(req, res, next) {
  if (!req.session.userId || !req.session.isAdmin) return res.status(403).json({ error: 'Access denied' });
  next();
}

// General stats
router.get('/stats', requireAdmin, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_admin = 0').get().c;
  const totalModules = db.prepare('SELECT COUNT(*) as c FROM modules WHERE is_published = 1').get().c;
  const newThisMonth = db.prepare(`SELECT COUNT(*) as c FROM modules WHERE is_published = 1 AND created_at >= date('now','start of month')`).get().c;

  const upToDate = db.prepare(`
    SELECT COUNT(DISTINCT u.id) as c FROM users u
    WHERE u.is_admin = 0
    AND NOT EXISTS (
      SELECT 1 FROM module_assignments ma
      JOIN modules m ON ma.module_id = m.id
      WHERE ma.role_id = u.role_id AND m.is_published = 1
      AND NOT EXISTS (
        SELECT 1 FROM progress p
        WHERE p.user_id = u.id AND p.module_id = m.id AND p.status = 'completed'
      )
    )
  `).get().c;

  res.json({ totalUsers, totalModules, upToDate, withPending: totalUsers - upToDate, newThisMonth });
});

// All users grouped by department and role
router.get('/users', requireAdmin, (req, res) => {
  const departments = db.prepare('SELECT * FROM departments ORDER BY id').all();

  departments.forEach(dept => {
    dept.roles = db.prepare('SELECT * FROM roles WHERE department_id = ? ORDER BY level').all(dept.id);
    dept.roles.forEach(role => {
      role.users = db.prepare(`
        SELECT u.id, u.name, u.email,
          (SELECT COUNT(*) FROM module_assignments ma JOIN modules m ON ma.module_id = m.id
           WHERE ma.role_id = u.role_id AND m.is_published = 1) as total_modules,
          (SELECT COUNT(*) FROM progress p JOIN module_assignments ma ON p.module_id = ma.module_id AND ma.role_id = u.role_id
           WHERE p.user_id = u.id AND p.status = 'completed') as completed_modules
        FROM users u WHERE u.role_id = ? AND u.is_admin = 0
      `).all(role.id);

      role.users.forEach(u => {
        u.pct = u.total_modules > 0 ? Math.round((u.completed_modules / u.total_modules) * 100) : 0;
        u.statusClass = u.pct === 100 ? 'done' : u.pct === 0 ? 'late' : 'pending';
        u.statusLabel = u.pct === 100 ? 'Up to date' : u.pct === 0 ? 'Behind' : 'Pending';
      });
    });
  });

  res.json(departments);
});

// All modules (admin view)
router.get('/modules', requireAdmin, (req, res) => {
  const modules = db.prepare(`
    SELECT m.*, d.name as dept_name, d.class as dept_class,
      (SELECT COUNT(*) FROM module_assignments WHERE module_id = m.id) as assigned_roles,
      (SELECT COUNT(*) FROM progress WHERE module_id = m.id AND status = 'completed') as completions
    FROM modules m LEFT JOIN departments d ON m.department_id = d.id
    ORDER BY m.created_at DESC
  `).all();
  res.json(modules);
});

// Single module for editing
router.get('/modules/:id', requireAdmin, (req, res) => {
  const module = db.prepare(`
    SELECT m.*, d.name as dept_name FROM modules m
    LEFT JOIN departments d ON m.department_id = d.id WHERE m.id = ?
  `).get(req.params.id);
  if (!module) return res.status(404).json({ error: 'Not found' });

  module.steps = JSON.parse(module.steps || '[]');
  const questions = db.prepare('SELECT * FROM quiz_questions WHERE module_id = ?').all(module.id);
  questions.forEach(q => { q.options = JSON.parse(q.options); });

  const assignments = db.prepare(`
    SELECT ma.role_id, ma.is_required, r.name as role_name, d.name as dept_name
    FROM module_assignments ma JOIN roles r ON ma.role_id = r.id
    JOIN departments d ON r.department_id = d.id WHERE ma.module_id = ?
  `).all(module.id);

  res.json({ ...module, questions, assignments });
});

// Create module
router.post('/modules', requireAdmin, (req, res) => {
  const { title, description, department_id, video_url, duration_minutes, steps, questions, role_assignments } = req.body;

  const result = db.prepare(`
    INSERT INTO modules (title, description, department_id, video_url, duration_minutes, steps)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title, description, department_id, video_url || '', duration_minutes || 5, JSON.stringify(steps || []));

  const moduleId = result.lastInsertRowid;

  if (questions && questions.length > 0) {
    const insQ = db.prepare('INSERT INTO quiz_questions (module_id, question, options, correct_answer) VALUES (?, ?, ?, ?)');
    questions.forEach(q => insQ.run(moduleId, q.question, JSON.stringify(q.options), q.correct_answer));
  }

  if (role_assignments && role_assignments.length > 0) {
    const insA = db.prepare('INSERT OR IGNORE INTO module_assignments (module_id, role_id, is_required) VALUES (?, ?, ?)');
    role_assignments.forEach(a => insA.run(moduleId, a.role_id, a.is_required ? 1 : 0));
  }

  res.json({ success: true, moduleId });
});

// Update module
router.put('/modules/:id', requireAdmin, (req, res) => {
  const { title, description, department_id, video_url, duration_minutes, steps } = req.body;
  db.prepare(`UPDATE modules SET title=?, description=?, department_id=?, video_url=?, duration_minutes=?, steps=? WHERE id=?`)
    .run(title, description, department_id, video_url || '', duration_minutes || 5, JSON.stringify(steps || []), req.params.id);
  res.json({ success: true });
});

// Delete module
router.delete('/modules/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  db.prepare('DELETE FROM quiz_questions WHERE module_id = ?').run(id);
  db.prepare('DELETE FROM module_assignments WHERE module_id = ?').run(id);
  db.prepare('DELETE FROM progress WHERE module_id = ?').run(id);
  db.prepare('DELETE FROM modules WHERE id = ?').run(id);
  res.json({ success: true });
});

// Departments and roles (for module form)
router.get('/departments', requireAdmin, (req, res) => {
  const depts = db.prepare('SELECT * FROM departments').all();
  depts.forEach(d => { d.roles = db.prepare('SELECT * FROM roles WHERE department_id = ? ORDER BY level').all(d.id); });
  res.json(depts);
});

// Add user
router.post('/users', requireAdmin, (req, res) => {
  const { name, email, password, role_id } = req.body;
  try {
    const result = db.prepare('INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)')
      .run(name, email.toLowerCase().trim(), bcrypt.hashSync(password, 10), role_id || null);
    res.json({ success: true, userId: result.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'That email is already registered' });
    throw e;
  }
});

// Delete user
router.delete('/users/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM progress WHERE user_id = ?').run(req.params.id);
  db.prepare('DELETE FROM users WHERE id = ? AND is_admin = 0').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
