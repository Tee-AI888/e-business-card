const db = require('./db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

function seed() {
  console.log('Seeding database...');

  // 1. Create default admin
  const adminExists = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
  if (!adminExists) {
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin@1234';
    const hash = bcrypt.hashSync(defaultPassword, 12);
    db.prepare('INSERT INTO admins (username, password_hash, display_name, email) VALUES (?, ?, ?, ?)').run('admin', hash, 'Administrator', 'admin@ecard.local');
    console.log('  ✓ Admin user created (username: admin)');
  } else {
    console.log('  - Admin user already exists');
  }

  // 2. Insert system themes
  const themes = [
    {
      name: 'Cyberpunk Neo',
      slug: 'cyberpunk',
      description: 'Futuristic cyberpunk theme with neon accents, particle effects, and scanline animations',
      css_variables: JSON.stringify({
        bg: '#050d1a',
        panel: '#080f1e',
        card: '#0a1628',
        border: '#1a3060',
        accent: '#00d4ff',
        accent2: '#0066ff',
        accent3: '#00ff9d',
        gold: '#ffc857',
        text: '#c8daf0',
        textDim: '#4a6a8a',
        fontMono: "'Share Tech Mono', monospace",
        fontSans: "'Barlow', sans-serif",
        fontCond: "'Barlow Condensed', sans-serif",
        googleFonts: 'Share+Tech+Mono|Barlow:wght@300;400;600;700|Barlow+Condensed:wght@700;800'
      }),
      template_name: 'cyberpunk-NYK',
      is_system: 1
    },
    {
      name: 'Cyberpunk NYTG',
      slug: 'cyberpunk-nytg',
      description: 'Cyberpunk theme variant for Nan Yang Textile Group',
      css_variables: JSON.stringify({
        bg: '#050d1a',
        panel: '#080f1e',
        card: '#0a1628',
        border: '#1a3060',
        accent: '#00d4ff',
        accent2: '#0066ff',
        accent3: '#00ff9d',
        gold: '#ffc857',
        text: '#c8daf0',
        textDim: '#4a6a8a',
        fontMono: "'Share Tech Mono', monospace",
        fontSans: "'Barlow', sans-serif",
        fontCond: "'Barlow Condensed', sans-serif",
        googleFonts: 'Share+Tech+Mono|Barlow:wght@300;400;600;700|Barlow+Condensed:wght@700;800'
      }),
      template_name: 'cyberpunk-NYTG',
      is_system: 1
    },
    {
      name: 'Cyber Glass',
      slug: 'cyber-glass',
      description: 'Futuristic glassmorphism theme with holographic gradients and transparency effects',
      css_variables: JSON.stringify({
        bg: '#05070a',
        panel: 'rgba(12, 18, 30, 0.65)',
        card: 'rgba(15, 23, 42, 0.4)',
        border: 'rgba(0, 240, 255, 0.2)',
        accent: '#00f0ff',
        accent2: '#7000ff',
        accent3: '#ff007c',
        gold: '#ffb800',
        text: '#e2e8f0',
        textDim: '#64748b',
        fontMono: "'Space Mono', monospace",
        fontSans: "'Rajdhani', sans-serif",
        fontCond: "'Rajdhani', sans-serif",
        googleFonts: 'Rajdhani:wght@400;500;600;700|Space+Mono:wght@400;700'
      }),
      template_name: 'cyber-glass',
      is_system: 1
    },
    {
      name: 'Premium Glassmorphism',
      slug: 'premium-glassmorphism',
      description: 'Executive frosted glass card with subtle gradients, blur effects, and premium typography',
      css_variables: JSON.stringify({
        bg: '#070b14',
        panel: 'rgba(16, 24, 40, 0.55)',
        border: 'rgba(255, 255, 255, 0.08)',
        accent: '#0088ff',
        accent2: '#00e5ff',
        accent3: 'rgba(0, 195, 255, 0.4)',
        gold: '#d4af37',
        text: '#f8fafc',
        textDim: '#94a3b8',
        fontMono: "'JetBrains Mono', monospace",
        fontSans: "'Inter', sans-serif",
        googleFonts: 'Inter:wght@300;400;500;600;700|JetBrains+Mono:wght@400;700'
      }),
      template_name: 'premium-glassmorphism',
      is_system: 1
    }
  ];

  const insertTheme = db.prepare(`
    INSERT OR IGNORE INTO themes (name, slug, description, css_variables, template_name, is_system)
    VALUES (@name, @slug, @description, @css_variables, @template_name, @is_system)
  `);

  for (const theme of themes) {
    const existing = db.prepare('SELECT id FROM themes WHERE slug = ?').get(theme.slug);
    if (!existing) {
      insertTheme.run(theme);
      console.log(`  ✓ Theme "${theme.name}" created`);
    } else {
      console.log(`  - Theme "${theme.name}" already exists`);
    }
  }

  // 3. Seed companies
  const companies = [
    {
      name_th: 'บริษัท นันยางการทออุตสาหกรรม จำกัด',
      name_en: 'Nan Yang Knitting Factory Co., Ltd.',
      address: 'Nan Yang Textile Building, 27 Phetkasem Rd., Nongkangploo, Nongkham, Bangkok 10160, Thailand',
      office_phone: '+6624212150 / 421-2160',
      website: 'https://www.nanyangtextile.com'
    },
    {
      name_th: 'กลุ่มบริษัทนันยางเท็กซ์ไทล์',
      name_en: 'Nan Yang Textile Group',
      address: 'Nan Yang Textile Building, 27 Phetkasem Rd., Nongkangploo, Nongkham, Bangkok 10160, Thailand',
      office_phone: '024212150',
      website: 'https://www.nanyangtextile.com'
    }
  ];

  const companyIds = {};
  for (const comp of companies) {
    const existing = db.prepare('SELECT id FROM companies WHERE name_en = ?').get(comp.name_en);
    if (!existing) {
      const result = db.prepare(`
        INSERT INTO companies (name_th, name_en, address, office_phone, website)
        VALUES (?, ?, ?, ?, ?)
      `).run(comp.name_th, comp.name_en, comp.address, comp.office_phone, comp.website);
      companyIds[comp.name_en] = result.lastInsertRowid;
      console.log(`  ✓ Company "${comp.name_en}" created`);
    } else {
      companyIds[comp.name_en] = existing.id;
      console.log(`  - Company "${comp.name_en}" already exists`);
    }
  }

  // 4. Seed cards
  const cyberpunkTheme = db.prepare('SELECT id FROM themes WHERE slug = ?').get('cyberpunk');
  const premiumTheme = db.prepare('SELECT id FROM themes WHERE slug = ?').get('premium-glassmorphism');

  const cards = [
    {
      email: 'piyawat.k@nanyangtextile.com',
      company_id: null,
      name_th: 'ปิยวัชร ขาวเหลือง',
      name_en: 'Piyawat Khaoluang',
      title: 'Head of IT Solution Delivery',
      company_th: 'บริษัท นันยางการทออุตสาหกรรม จำกัด',
      company_en: 'Nan Yang Knitting Factory Co., Ltd.',
      department: 'IT',
      mobile: '+66659386162',
      mobile2: null,
      office_phone: '+6624212150 / 421-2160 Ext. 1630',
      website: 'https://www.nanyangtextile.com',
      address: 'Nan Yang Textile Building, 27 Phetkasem Rd., Nongkangploo, Nongkham, Bangkok 10160, Thailand',
      map_url: 'https://maps.app.goo.gl/XMAKoDpjWSJ4fS4E6',
      profile_image: '/Profile/piyawat.jpg',
      theme_slug: 'cyberpunk'
    },
    {
      email: 'phon.n@nanyangtextile.com',
      company_id_ref: 'Nan Yang Textile Group',
      name_th: 'ภณ นิลสนธิ',
      name_en: 'Phon Nilsonthi',
      title: 'Head of Group IT',
      company_th: 'กลุ่มบริษัทนันยางเท็กซ์ไทล์',
      company_en: 'Nan Yang Textile Group',
      department: 'Corporate IT',
      mobile: '0631898200',
      mobile2: null,
      office_phone: '024212150',
      website: 'https://www.nanyangtextile.com',
      address: 'Nan Yang Textile Building, 27 Phetkasem Rd., Nongkangploo, Nongkham, Bangkok 10160, Thailand',
      map_url: 'https://maps.app.goo.gl/XMAKoDpjWSJ4fS4E6',
      profile_image: '/Profile/phon.jpg',
      theme_slug: 'premium-glassmorphism'
    }
  ];

  for (const card of cards) {
    const exists = db.prepare('SELECT id, profile_image FROM cards WHERE email = ?').get(card.email);
    if (exists) {
      // Migrate legacy seeded image URLs that point to missing uploads files.
      if (exists.profile_image !== card.profile_image) {
        db.prepare('UPDATE cards SET profile_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(card.profile_image, exists.id);
        console.log(`  ~ Card "${card.name_en}" profile image path updated`);
      }
      console.log(`  - Card "${card.name_en}" already exists`);
      continue;
    }
    const theme = db.prepare('SELECT id FROM themes WHERE slug = ?').get(card.theme_slug);
    if (!theme) {
      console.log(`  ✗ Theme "${card.theme_slug}" not found for card "${card.name_en}"`);
      continue;
    }
    const compId = card.company_id_ref ? (companyIds[card.company_id_ref] || null) : (card.company_id || null);
    const cardUuid = uuidv4();
    db.prepare(`
      INSERT INTO cards (uuid, company_id, name_th, name_en, title, company_th, company_en, department, mobile, mobile2, office_phone, email, website, address, map_url, profile_image, theme_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cardUuid, compId,
      card.name_th, card.name_en, card.title,
      card.company_th, card.company_en, card.department,
      card.mobile, card.mobile2, card.office_phone,
      card.email, card.website, card.address, card.map_url || null, card.profile_image,
      theme.id
    );
    console.log(`  ✓ Card "${card.name_en}" created (UUID: ${cardUuid})`);
  }

  console.log('Seed complete!');
}

// Run if called directly
if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  seed();
}

module.exports = seed;
