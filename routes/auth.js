const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../database/db');

// Login page
router.get('/login', (req, res) => {
  if (req.session.adminId) return res.redirect('/admin');
  res.render('login', { error: null });
});

// Login handler
router.post('/api/auth/login', [
  body('username').trim().notEmpty().escape(),
  body('password').notEmpty(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).render('login', { error: 'Please fill in all fields' });
  }

  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).render('login', { error: 'Invalid username or password' });
  }

  if (!admin.is_active) {
    return res.status(401).render('login', { error: 'This account has been deactivated' });
  }

  // Record last login
  db.prepare('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(admin.id);

  req.session.adminId = admin.id;
  req.session.adminUsername = admin.username;
  req.session.adminDisplayName = admin.display_name || admin.username;
  res.redirect('/admin');
});

// Logout
router.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Redirect root to admin or login
router.get('/', (req, res) => {
  if (req.session.adminId) return res.redirect('/admin');
  res.redirect('/login');
});

module.exports = router;
