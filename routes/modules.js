const express = require('express');
const router = express.Router();
const db = require('../database/init');

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

// Modules grouped by department for the logged-in user
router.get('/by-department', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  const modules = db.prepare(`
    SELECT m.*, d.name as dept_name, d.class as dept_class, d.color as dept_color,
           ma.is_required,
           COALESCE(p.status, 'not_started') as status,
           p.quiz_score, p.completed_at
    FROM modules m
    JOIN departments d ON m.department_id = d.id
    JOIN module_assignments ma ON m.id = ma.module_id AND ma.role_id = ?
    LEFT JOIN progress p ON m.id = p.module_id AND p.user_id = ?
    WHERE m.is_published = 1
    ORDER BY d.id, m.created_at DESC
  `).all(user.role_id, userId);

  const grouped = {};
  modules.forEach(m => {
    if (!grouped[m.dept_name]) {
      grouped[m.dept_name] = { name: m.dept_name, class: m.dept_class, color: m.dept_color, modules: [] };
    }
    grouped[m.dept_name].modules.push(m);
  });

  res.json(Object.values(grouped));
});

// Module detail
router.get('/:id', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const moduleId = req.params.id;

  const module = db.prepare(`
    SELECT m.*, d.name as dept_name, d.class as dept_class,
           COALESCE(p.status, 'not_started') as status,
           p.quiz_score, p.completed_at
    FROM modules m
    LEFT JOIN departments d ON m.department_id = d.id
    LEFT JOIN progress p ON m.id = p.module_id AND p.user_id = ?
    WHERE m.id = ?
  `).get(userId, moduleId);

  if (!module) return res.status(404).json({ error: 'Module not found' });

  module.steps = JSON.parse(module.steps || '[]');

  const questions = db.prepare('SELECT id, question, options FROM quiz_questions WHERE module_id = ?').all(moduleId);
  questions.forEach(q => { q.options = JSON.parse(q.options); });

  res.json({ ...module, questions });
});

// Update progress (mark as in progress)
router.post('/:id/progress', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const moduleId = req.params.id;

  db.prepare(`
    INSERT INTO progress (user_id, module_id, status) VALUES (?, ?, 'in_progress')
    ON CONFLICT(user_id, module_id) DO UPDATE SET
      status = CASE WHEN progress.status = 'completed' THEN 'completed' ELSE 'in_progress' END
  `).run(userId, moduleId);

  res.json({ success: true });
});

// Submit quiz
router.post('/:id/quiz', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const moduleId = req.params.id;
  const { answers } = req.body;

  const questions = db.prepare('SELECT * FROM quiz_questions WHERE module_id = ?').all(moduleId);
  if (questions.length === 0) return res.status(400).json({ error: 'This module has no quiz' });

  let correct = 0;
  const results = questions.map(q => {
    const isCorrect = parseInt(answers[q.id]) === q.correct_answer;
    if (isCorrect) correct++;
    return { questionId: q.id, isCorrect, correctAnswer: q.correct_answer };
  });

  const score = Math.round((correct / questions.length) * 100);
  const passed = score >= 70;

  if (passed) {
    db.prepare(`
      INSERT INTO progress (user_id, module_id, status, quiz_score, completed_at)
      VALUES (?, ?, 'completed', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, module_id) DO UPDATE SET
        status = 'completed', quiz_score = ?, completed_at = CURRENT_TIMESTAMP
    `).run(userId, moduleId, score, score);
  }

  res.json({ score, passed, correct, total: questions.length, results });
});

module.exports = router;
