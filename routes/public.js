const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const db = require('../database/db');

// Public card view
router.get('/card/:uuid', async (req, res) => {
  const card = db.prepare(`
    SELECT c.*, t.name as theme_name, t.slug as theme_slug, t.css_variables, t.template_name
    FROM cards c
    LEFT JOIN themes t ON c.theme_id = t.id
    WHERE c.uuid = ? AND c.is_active = 1
  `).get(req.params.uuid);

  if (!card) {
    return res.status(404).render('404');
  }

  // Increment view count
  db.prepare('UPDATE cards SET view_count = view_count + 1 WHERE id = ?').run(card.id);

  // Parse CSS variables
  let cssVars = {};
  try {
    cssVars = JSON.parse(card.css_variables);
  } catch (e) {
    // fallback to defaults
  }

  // Generate QR code
  const cardUrl = `${req.protocol}://${req.get('host')}/card/${card.uuid}`;
  let qrCodeSvg = '';
  try {
    qrCodeSvg = await QRCode.toString(cardUrl, {
      type: 'svg',
      width: 70,
      margin: 0,
      color: {
        dark: cssVars.accent || '#00d4ff',
        light: '#00000000'
      }
    });
  } catch (e) {
    console.error('QR generation error:', e);
  }

  // Determine which template to render
  const templateName = card.template_name || 'cyberpunk';

  res.render(`card/${templateName}`, {
    card,
    cssVars,
    qrCodeSvg,
    cardUrl
  });
});

module.exports = router;
