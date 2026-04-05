const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { body, param, validationResult } = require('express-validator');
const db = require('../database/db');
const { requireAdmin } = require('../middleware/auth');

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'public', 'uploads', 'profiles');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .jpg, .jpeg, .png, .webp files are allowed'));
    }
  }
});

// ─── CARD ENDPOINTS ──────────────────────────────────────────

// List all cards
router.get('/cards', requireAdmin, (req, res) => {
  const cards = db.prepare(`
    SELECT c.*, t.name as theme_name
    FROM cards c
    LEFT JOIN themes t ON c.theme_id = t.id
    ORDER BY c.created_at DESC
  `).all();
  res.json(cards);
});

// Get single card
router.get('/cards/:id', requireAdmin, [
  param('id').isInt()
], (req, res) => {
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });
  res.json(card);
});

// Create card
router.post('/cards', requireAdmin, upload.single('profile_image'), [
  body('name_en').trim().notEmpty().withMessage('English name is required').escape(),
  body('name_th').optional().trim().escape(),
  body('title').optional().trim().escape(),
  body('company_en').optional().trim().escape(),
  body('company_th').optional().trim().escape(),
  body('department').optional().trim().escape(),
  body('mobile').optional().trim().escape(),
  body('mobile2').optional().trim().escape(),
  body('office_phone').optional().trim().escape(),
  body('email').optional().trim().isEmail().withMessage('Invalid email').normalizeEmail(),
  body('website').optional().trim(),
  body('address').optional().trim().escape(),
  body('theme_id').isInt().withMessage('Theme is required'),
], (req, res) => {
  // Validate CSRF for multipart forms (after multer parses body)
  const csrfToken = (req.body && req.body._csrf) || req.headers['x-csrf-token'];
  if (!csrfToken || csrfToken !== req.session.csrfToken) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Clean up uploaded file on validation error
    if (req.file) fs.unlinkSync(req.file.path);
    const themes = db.prepare('SELECT * FROM themes WHERE is_active = 1 ORDER BY name').all();
    const companies = db.prepare('SELECT * FROM companies WHERE is_active = 1 ORDER BY name_en').all();
    return res.status(400).render('admin/card-form', {
      card: req.body,
      themes,
      companies,
      error: errors.array().map(e => e.msg).join(', ')
    });
  }

  const uuid = uuidv4();
  const profileImage = req.file ? `/uploads/profiles/${req.file.filename}` : null;

  // Sanitize website URL
  let website = req.body.website || '';
  if (website && !website.match(/^https?:\/\//)) {
    website = 'https://' + website;
  }

  db.prepare(`
    INSERT INTO cards (uuid, company_id, name_th, name_en, title, company_th, company_en, department, mobile, mobile2, office_phone, email, website, address, profile_image, theme_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuid,
    req.body.company_id ? parseInt(req.body.company_id) : null,
    req.body.name_th || null,
    req.body.name_en,
    req.body.title || null,
    req.body.company_th || null,
    req.body.company_en || null,
    req.body.department || null,
    req.body.mobile || null,
    req.body.mobile2 || null,
    req.body.office_phone || null,
    req.body.email || null,
    website || null,
    req.body.address || null,
    profileImage,
    parseInt(req.body.theme_id)
  );

  res.redirect('/admin/cards');
});

// Update card
router.post('/cards/:id/update', requireAdmin, upload.single('profile_image'), [
  param('id').isInt(),
  body('name_en').trim().notEmpty().withMessage('English name is required').escape(),
  body('name_th').optional().trim().escape(),
  body('title').optional().trim().escape(),
  body('company_en').optional().trim().escape(),
  body('company_th').optional().trim().escape(),
  body('department').optional().trim().escape(),
  body('mobile').optional().trim().escape(),
  body('mobile2').optional().trim().escape(),
  body('office_phone').optional().trim().escape(),
  body('email').optional().trim().isEmail().withMessage('Invalid email').normalizeEmail(),
  body('website').optional().trim(),
  body('address').optional().trim().escape(),
  body('theme_id').isInt().withMessage('Theme is required'),
], (req, res) => {
  // Validate CSRF for multipart forms (after multer parses body)
  const csrfToken = (req.body && req.body._csrf) || req.headers['x-csrf-token'];
  if (!csrfToken || csrfToken !== req.session.csrfToken) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.file) fs.unlinkSync(req.file.path);
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
    const themes = db.prepare('SELECT * FROM themes WHERE is_active = 1 ORDER BY name').all();
    const companies = db.prepare('SELECT * FROM companies WHERE is_active = 1 ORDER BY name_en').all();
    return res.status(400).render('admin/card-form', {
      card: { ...card, ...req.body },
      themes,
      companies,
      error: errors.array().map(e => e.msg).join(', ')
    });
  }

  const existing = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).render('404');

  let profileImage = existing.profile_image;
  if (req.body.delete_profile === '1' && !req.file) {
    // Delete old uploaded image file
    if (existing.profile_image && existing.profile_image.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', 'public', existing.profile_image);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    profileImage = null;
  } else if (req.file) {
    profileImage = `/uploads/profiles/${req.file.filename}`;
    // Don't delete old legacy profile images from Profile/ folder
    if (existing.profile_image && existing.profile_image.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', 'public', existing.profile_image);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
  }

  let website = req.body.website || '';
  if (website && !website.match(/^https?:\/\//)) {
    website = 'https://' + website;
  }

  db.prepare(`
    UPDATE cards SET
      company_id = ?, name_th = ?, name_en = ?, title = ?, company_th = ?, company_en = ?,
      department = ?, mobile = ?, mobile2 = ?, office_phone = ?, email = ?, website = ?,
      address = ?, profile_image = ?, theme_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    req.body.company_id ? parseInt(req.body.company_id) : null,
    req.body.name_th || null,
    req.body.name_en,
    req.body.title || null,
    req.body.company_th || null,
    req.body.company_en || null,
    req.body.department || null,
    req.body.mobile || null,
    req.body.mobile2 || null,
    req.body.office_phone || null,
    req.body.email || null,
    website || null,
    req.body.address || null,
    profileImage,
    parseInt(req.body.theme_id),
    req.params.id
  );

  res.redirect('/admin/cards');
});

// Delete card (soft delete)
router.post('/cards/:id/delete', requireAdmin, [
  param('id').isInt()
], (req, res) => {
  db.prepare('UPDATE cards SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
  res.redirect('/admin/cards');
});

// Restore card
router.post('/cards/:id/restore', requireAdmin, [
  param('id').isInt()
], (req, res) => {
  db.prepare('UPDATE cards SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
  res.redirect('/admin/cards');
});

// Toggle card active status (AJAX)
router.post('/cards/:id/toggle', requireAdmin, (req, res) => {
  const card = db.prepare('SELECT is_active FROM cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });
  const newStatus = card.is_active ? 0 : 1;
  db.prepare('UPDATE cards SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, req.params.id);
  res.json({ is_active: newStatus });
});

// ─── COMPANY ENDPOINTS ──────────────────────────────────────────

// List all active companies (JSON for card form dropdown)
router.get('/companies', requireAdmin, (req, res) => {
  const companies = db.prepare('SELECT * FROM companies WHERE is_active = 1 ORDER BY name_en').all();
  res.json(companies);
});

// Create company
router.post('/companies', requireAdmin, [
  body('name_en').trim().notEmpty().withMessage('English name is required').escape(),
  body('name_th').optional().trim().escape(),
  body('address').optional().trim().escape(),
  body('office_phone').optional().trim().escape(),
  body('website').optional().trim(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).render('admin/company-form', {
      company: req.body,
      error: errors.array().map(e => e.msg).join(', ')
    });
  }

  let website = req.body.website || '';
  if (website && !website.match(/^https?:\/\//)) {
    website = 'https://' + website;
  }

  db.prepare(`
    INSERT INTO companies (name_th, name_en, address, office_phone, website)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    req.body.name_th || null,
    req.body.name_en,
    req.body.address || null,
    req.body.office_phone || null,
    website || null
  );

  res.redirect('/admin/companies');
});

// Update company
router.post('/companies/:id/update', requireAdmin, [
  param('id').isInt(),
  body('name_en').trim().notEmpty().withMessage('English name is required').escape(),
  body('name_th').optional().trim().escape(),
  body('address').optional().trim().escape(),
  body('office_phone').optional().trim().escape(),
  body('website').optional().trim(),
], (req, res) => {
  const errors = validationResult(req);
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!company) return res.status(404).render('404');

  if (!errors.isEmpty()) {
    return res.status(400).render('admin/company-form', {
      company: { ...company, ...req.body },
      error: errors.array().map(e => e.msg).join(', ')
    });
  }

  let website = req.body.website || '';
  if (website && !website.match(/^https?:\/\//)) {
    website = 'https://' + website;
  }

  db.prepare(`
    UPDATE companies SET name_th = ?, name_en = ?, address = ?, office_phone = ?, website = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    req.body.name_th || null,
    req.body.name_en,
    req.body.address || null,
    req.body.office_phone || null,
    website || null,
    req.params.id
  );

  res.redirect('/admin/companies');
});

// Delete company
router.post('/companies/:id/delete', requireAdmin, [
  param('id').isInt()
], (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const cardCount = db.prepare('SELECT COUNT(*) as count FROM cards WHERE company_id = ?').get(req.params.id).count;
  if (cardCount > 0) {
    const companies = db.prepare('SELECT c.*, (SELECT COUNT(*) FROM cards WHERE company_id = c.id) as card_count FROM companies c ORDER BY c.name_en').all();
    return res.status(400).render('admin/companies', {
      companies,
      error: `Cannot delete "${company.name_en}" — it is used by ${cardCount} card(s). Reassign them first.`
    });
  }

  db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
  res.redirect('/admin/companies');
});

// ─── THEME ENDPOINTS ──────────────────────────────────────────

// List all themes
router.get('/themes', requireAdmin, (req, res) => {
  const themes = db.prepare(`
    SELECT t.*, (SELECT COUNT(*) FROM cards WHERE theme_id = t.id) as card_count
    FROM themes t
    ORDER BY t.is_system DESC, t.created_at DESC
  `).all();
  res.json(themes);
});

// Create theme
router.post('/themes', requireAdmin, [
  body('name').trim().notEmpty().withMessage('Theme name is required').escape(),
  body('slug').trim().notEmpty().withMessage('Slug is required')
    .matches(/^[a-z0-9-]+$/).withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
  body('description').optional().trim().escape(),
  body('base_template').trim().notEmpty().withMessage('Base template is required'),
  body('css_variables').notEmpty().withMessage('CSS variables are required'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const systemThemes = db.prepare('SELECT * FROM themes WHERE is_system = 1').all();
    return res.status(400).render('admin/theme-form', {
      theme: req.body,
      systemThemes,
      error: errors.array().map(e => e.msg).join(', ')
    });
  }

  // Check slug uniqueness
  const existing = db.prepare('SELECT id FROM themes WHERE slug = ?').get(req.body.slug);
  if (existing) {
    const systemThemes = db.prepare('SELECT * FROM themes WHERE is_system = 1').all();
    return res.status(400).render('admin/theme-form', {
      theme: req.body,
      systemThemes,
      error: 'A theme with this slug already exists'
    });
  }

  // Validate CSS variables JSON
  let cssVars;
  try {
    cssVars = JSON.parse(req.body.css_variables);
  } catch (e) {
    const systemThemes = db.prepare('SELECT * FROM themes WHERE is_system = 1').all();
    return res.status(400).render('admin/theme-form', {
      theme: req.body,
      systemThemes,
      error: 'Invalid CSS variables JSON'
    });
  }

  db.prepare(`
    INSERT INTO themes (name, slug, description, css_variables, template_name, is_system)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(
    req.body.name,
    req.body.slug,
    req.body.description || null,
    JSON.stringify(cssVars),
    req.body.base_template
  );

  res.redirect('/admin/themes');
});

// Update theme
router.post('/themes/:id/update', requireAdmin, [
  param('id').isInt(),
  body('name').trim().notEmpty().withMessage('Theme name is required').escape(),
  body('description').optional().trim().escape(),
  body('css_variables').notEmpty().withMessage('CSS variables are required'),
], (req, res) => {
  const errors = validationResult(req);
  const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(req.params.id);
  if (!theme) return res.status(404).render('404');

  if (!errors.isEmpty()) {
    const systemThemes = db.prepare('SELECT * FROM themes WHERE is_system = 1').all();
    return res.status(400).render('admin/theme-form', {
      theme: { ...theme, ...req.body },
      systemThemes,
      error: errors.array().map(e => e.msg).join(', ')
    });
  }

  let cssVars;
  try {
    cssVars = JSON.parse(req.body.css_variables);
  } catch (e) {
    const systemThemes = db.prepare('SELECT * FROM themes WHERE is_system = 1').all();
    return res.status(400).render('admin/theme-form', {
      theme: { ...theme, ...req.body },
      systemThemes,
      error: 'Invalid CSS variables JSON'
    });
  }

  // Allow template_name changes on all themes
  const templateName = req.body.base_template || theme.template_name;

  db.prepare(`
    UPDATE themes SET name = ?, description = ?, css_variables = ?, template_name = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    req.body.name,
    req.body.description || null,
    JSON.stringify(cssVars),
    templateName,
    req.params.id
  );

  res.redirect('/admin/themes');
});

// Delete theme
router.post('/themes/:id/delete', requireAdmin, (req, res) => {
  const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(req.params.id);
  if (!theme) return res.status(404).json({ error: 'Theme not found' });

  if (theme.is_system) {
    return res.status(400).render('admin/themes', {
      themes: db.prepare('SELECT t.*, (SELECT COUNT(*) FROM cards WHERE theme_id = t.id) as card_count FROM themes t ORDER BY t.is_system DESC').all(),
      error: 'Cannot delete system themes'
    });
  }

  const cardCount = db.prepare('SELECT COUNT(*) as count FROM cards WHERE theme_id = ?').get(req.params.id).count;
  if (cardCount > 0) {
    return res.status(400).render('admin/themes', {
      themes: db.prepare('SELECT t.*, (SELECT COUNT(*) FROM cards WHERE theme_id = t.id) as card_count FROM themes t ORDER BY t.is_system DESC').all(),
      error: `Cannot delete theme "${theme.name}" — it is used by ${cardCount} card(s). Reassign them first.`
    });
  }

  db.prepare('DELETE FROM themes WHERE id = ?').run(req.params.id);
  res.redirect('/admin/themes');
});

// Get CSRF token (for AJAX requests)
router.get('/csrf-token', requireAdmin, (req, res) => {
  res.json({ token: res.locals.csrfToken });
});

// ─── ADMIN USER MANAGEMENT ──────────────────────────────────────

const bcrypt = require('bcryptjs');

// Change own password
router.post('/admins/change-password', requireAdmin, [
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  body('confirm_password').notEmpty().withMessage('Please confirm your new password'),
], (req, res) => {
  const errors = validationResult(req);
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.session.adminId);
  if (!admin) return res.redirect('/login');

  const renderAccount = (error, success) => {
    res.render('admin/account', { admin: { ...admin, password_hash: undefined }, accountPage: true, error, success });
  };

  if (!errors.isEmpty()) {
    return renderAccount(errors.array().map(e => e.msg).join(', '), null);
  }

  const { current_password, new_password, confirm_password } = req.body;

  if (new_password !== confirm_password) {
    return renderAccount('New password and confirmation do not match', null);
  }

  if (!bcrypt.compareSync(current_password, admin.password_hash)) {
    return renderAccount('Current password is incorrect', null);
  }

  const hash = bcrypt.hashSync(new_password, 12);
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, admin.id);
  renderAccount(null, 'Password changed successfully');
});

// Create admin
router.post('/admins', requireAdmin, [
  body('username').trim().notEmpty().withMessage('Username is required')
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Username can only contain letters, numbers, hyphens, underscores'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirm_password').notEmpty().withMessage('Please confirm the password'),
  body('display_name').optional().trim().escape(),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Invalid email format'),
], (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).render('admin/admin-form', {
      adminUser: req.body,
      adminPage: true,
      error: errors.array().map(e => e.msg).join(', ')
    });
  }

  const { username, password, confirm_password, display_name, email } = req.body;

  if (password !== confirm_password) {
    return res.status(400).render('admin/admin-form', {
      adminUser: req.body,
      adminPage: true,
      error: 'Password and confirmation do not match'
    });
  }

  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).render('admin/admin-form', {
      adminUser: req.body,
      adminPage: true,
      error: 'Username already exists'
    });
  }

  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO admins (username, password_hash, display_name, email) VALUES (?, ?, ?, ?)').run(
    username, hash, display_name || null, email || null
  );
  res.redirect('/admin/admins');
});

// Update admin
router.post('/admins/:id/update', requireAdmin, [
  param('id').isInt(),
  body('display_name').optional().trim().escape(),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Invalid email format'),
  body('is_active').optional().isIn(['0', '1']),
], (req, res) => {
  const adminUser = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.params.id);
  if (!adminUser) return res.status(404).render('404');

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).render('admin/admin-form', {
      adminUser: { ...adminUser, ...req.body },
      adminPage: true,
      error: errors.array().map(e => e.msg).join(', ')
    });
  }

  const { display_name, email, password, confirm_password, is_active } = req.body;

  // Password reset (optional)
  if (password) {
    if (password.length < 6) {
      return res.status(400).render('admin/admin-form', {
        adminUser: { ...adminUser, ...req.body },
        adminPage: true,
        error: 'Password must be at least 6 characters'
      });
    }
    if (password !== confirm_password) {
      return res.status(400).render('admin/admin-form', {
        adminUser: { ...adminUser, ...req.body },
        adminPage: true,
        error: 'Password and confirmation do not match'
      });
    }
    const hash = bcrypt.hashSync(password, 12);
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, adminUser.id);
  }

  // Prevent deactivating yourself
  const activeVal = is_active !== undefined ? parseInt(is_active) : adminUser.is_active;
  if (adminUser.id === req.session.adminId && activeVal === 0) {
    return res.status(400).render('admin/admin-form', {
      adminUser: { ...adminUser, ...req.body },
      adminPage: true,
      error: 'You cannot deactivate your own account'
    });
  }

  db.prepare('UPDATE admins SET display_name = ?, email = ?, is_active = ? WHERE id = ?').run(
    display_name || null, email || null, activeVal, adminUser.id
  );
  res.redirect('/admin/admins');
});

// Delete admin
router.post('/admins/:id/delete', requireAdmin, [
  param('id').isInt(),
], (req, res) => {
  const adminId = parseInt(req.params.id);

  // Prevent self-delete
  if (adminId === req.session.adminId) {
    const admins = db.prepare('SELECT id, username, display_name, email, is_active, last_login, created_at FROM admins ORDER BY id').all();
    return res.status(400).render('admin/admins', {
      admins,
      adminPage: true,
      error: 'You cannot delete your own account',
      success: null
    });
  }

  // Prevent deleting last admin
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get().count;
  if (adminCount <= 1) {
    const admins = db.prepare('SELECT id, username, display_name, email, is_active, last_login, created_at FROM admins ORDER BY id').all();
    return res.status(400).render('admin/admins', {
      admins,
      adminPage: true,
      error: 'Cannot delete the last admin account',
      success: null
    });
  }

  const target = db.prepare('SELECT id FROM admins WHERE id = ?').get(adminId);
  if (!target) return res.status(404).render('404');

  db.prepare('DELETE FROM admins WHERE id = ?').run(adminId);
  res.redirect('/admin/admins');
});

module.exports = router;
