const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const db = require('../database/db');
const { requireAdmin } = require('../middleware/auth');

// Get first active card from DB for theme preview, fallback to defaults
function getPreviewCard() {
  const card = db.prepare('SELECT * FROM cards WHERE is_active = 1 ORDER BY id ASC LIMIT 1').get();
  if (card) return card;
  return {
    uuid: 'preview', name_en: 'John Doe', name_th: 'จอห์น โด',
    title: 'Software Engineer', company_en: 'Example Co., Ltd.',
    company_th: 'บริษัท ตัวอย่าง จำกัด', department: 'IT',
    mobile: '+66 91-234-5678', mobile2: null,
    office_phone: '+66 2-123-4567', email: 'john@example.com',
    website: 'https://example.com',
    address: '123 Bangkok, Thailand', profile_image: null
  };
}

// All admin routes require authentication
router.use(requireAdmin);

// Dashboard
router.get('/', (req, res) => {
  const cardCount = db.prepare('SELECT COUNT(*) as count FROM cards WHERE is_active = 1').get().count;
  const themeCount = db.prepare('SELECT COUNT(*) as count FROM themes WHERE is_active = 1').get().count;
  const recentCards = db.prepare(`
    SELECT c.*, t.name as theme_name
    FROM cards c
    LEFT JOIN themes t ON c.theme_id = t.id
    ORDER BY c.created_at DESC LIMIT 5
  `).all();
  const totalViews = db.prepare('SELECT COALESCE(SUM(view_count), 0) as total FROM cards').get().total;

  res.render('admin/dashboard', {
    cardCount,
    themeCount,
    recentCards,
    totalViews,
    adminUsername: req.session.adminUsername
  });
});

// Card list
router.get('/cards', (req, res) => {
  const search = req.query.search || '';
  let cards;
  if (search) {
    cards = db.prepare(`
      SELECT c.*, t.name as theme_name
      FROM cards c
      LEFT JOIN themes t ON c.theme_id = t.id
      WHERE c.name_en LIKE ? OR c.name_th LIKE ? OR c.email LIKE ? OR c.company_en LIKE ?
      ORDER BY c.created_at DESC
    `).all(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  } else {
    cards = db.prepare(`
      SELECT c.*, t.name as theme_name
      FROM cards c
      LEFT JOIN themes t ON c.theme_id = t.id
      ORDER BY c.created_at DESC
    `).all();
  }
  res.render('admin/cards', { cards, search });
});

// New card form
router.get('/cards/new', (req, res) => {
  const themes = db.prepare('SELECT * FROM themes WHERE is_active = 1 ORDER BY name').all();
  const companies = db.prepare('SELECT * FROM companies WHERE is_active = 1 ORDER BY name_en').all();
  res.render('admin/card-form', { card: null, themes, companies, error: null });
});

// Edit card form
router.get('/cards/:id/edit', (req, res) => {
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).render('404');
  const themes = db.prepare('SELECT * FROM themes WHERE is_active = 1 ORDER BY name').all();
  const companies = db.prepare('SELECT * FROM companies WHERE is_active = 1 ORDER BY name_en').all();
  res.render('admin/card-form', { card, themes, companies, error: null });
});

// Theme list
router.get('/themes', (req, res) => {
  const themes = db.prepare(`
    SELECT t.*, (SELECT COUNT(*) FROM cards WHERE theme_id = t.id) as card_count
    FROM themes t
    ORDER BY t.is_system DESC, t.created_at DESC
  `).all();
  res.render('admin/themes', { themes });
});

// Theme preview with dummy data
router.get('/themes/:id/preview', async (req, res) => {
  const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(req.params.id);
  if (!theme) return res.status(404).render('404');

  let cssVars = {};
  try { cssVars = JSON.parse(theme.css_variables); } catch (e) {}

  const previewCard = getPreviewCard();

  let qrCodeSvg = '';
  try {
    qrCodeSvg = await QRCode.toString('https://example.com/card/preview', {
      type: 'svg', width: 70, margin: 0,
      color: { dark: cssVars.accent || '#00d4ff', light: '#00000000' }
    });
  } catch (e) {}

  res.render(`card/${theme.template_name}`, {
    card: previewCard,
    cssVars,
    qrCodeSvg,
    cardUrl: '#'
  });
});

// Theme live preview (POST — accepts unsaved form values)
router.post('/themes/preview', async (req, res) => {
  let cssVars = {};
  try { cssVars = JSON.parse(req.body.css_variables || '{}'); } catch (e) {}

  const templateName = (req.body.template_name || 'cyberpunk-NYK').replace(/[^a-zA-Z0-9_-]/g, '');

  const previewCard = getPreviewCard();

  let qrCodeSvg = '';
  try {
    qrCodeSvg = await QRCode.toString('https://example.com/card/preview', {
      type: 'svg', width: 70, margin: 0,
      color: { dark: cssVars.accent || '#00d4ff', light: '#00000000' }
    });
  } catch (e) {}

  res.render(`card/${templateName}`, {
    card: previewCard,
    cssVars,
    qrCodeSvg,
    cardUrl: '#'
  });
});

// ─── COMPANY ROUTES ──────────────────────────────────────────

// Company list
router.get('/companies', (req, res) => {
  const companies = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM cards WHERE company_id = c.id) as card_count
    FROM companies c
    ORDER BY c.name_en
  `).all();
  res.render('admin/companies', { companies, companyPage: true, error: null });
});

// New company form
router.get('/companies/new', (req, res) => {
  res.render('admin/company-form', { company: null, error: null });
});

// Edit company form
router.get('/companies/:id/edit', (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!company) return res.status(404).render('404');
  res.render('admin/company-form', { company, error: null });
});

// ─── THEME FORM ROUTES ──────────────────────────────────────────

// New theme form
router.get('/themes/new', (req, res) => {
  const systemThemes = db.prepare('SELECT * FROM themes WHERE is_system = 1').all();
  res.render('admin/theme-form', { theme: null, systemThemes, error: null });
});

// Edit theme form
router.get('/themes/:id/edit', (req, res) => {
  const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(req.params.id);
  if (!theme) return res.status(404).render('404');
  const systemThemes = db.prepare('SELECT * FROM themes WHERE is_system = 1').all();
  res.render('admin/theme-form', { theme, systemThemes, error: null });
});

// Copy theme form
router.get('/themes/:id/copy', (req, res) => {
  const source = db.prepare('SELECT * FROM themes WHERE id = ?').get(req.params.id);
  if (!source) return res.status(404).render('404');
  const systemThemes = db.prepare('SELECT * FROM themes WHERE is_system = 1').all();
  // Create a copy object without id so the form creates a new theme
  const copy = {
    name: source.name + ' (Copy)',
    slug: source.slug + '-copy',
    description: source.description,
    css_variables: source.css_variables,
    template_name: source.template_name,
    is_system: 0
  };
  res.render('admin/theme-form', { theme: copy, systemThemes, error: null });
});

// ─── ADMIN USER ROUTES ──────────────────────────────────────────

// My Account
router.get('/account', (req, res) => {
  const admin = db.prepare('SELECT id, username, display_name, email, is_active, last_login, created_at FROM admins WHERE id = ?').get(req.session.adminId);
  if (!admin) return res.redirect('/login');
  res.render('admin/account', { admin, accountPage: true, error: null, success: null });
});

// Admin list
router.get('/admins', (req, res) => {
  const admins = db.prepare('SELECT id, username, display_name, email, is_active, last_login, created_at FROM admins ORDER BY id').all();
  res.render('admin/admins', { admins, adminPage: true, error: null, success: null });
});

// New admin form
router.get('/admins/new', (req, res) => {
  res.render('admin/admin-form', { adminUser: null, adminPage: true, error: null });
});

// Edit admin form
router.get('/admins/:id/edit', (req, res) => {
  const adminUser = db.prepare('SELECT id, username, display_name, email, is_active, last_login, created_at FROM admins WHERE id = ?').get(req.params.id);
  if (!adminUser) return res.status(404).render('404');
  res.render('admin/admin-form', { adminUser, adminPage: true, error: null });
});

module.exports = router;
