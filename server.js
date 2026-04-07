require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');
const { setupSecurity } = require('./middleware/security');
const seed = require('./database/seed');

const app = express();
const PORT = process.env.PORT || 3000;
const useHttps = process.env.USE_HTTPS === 'true';

function buildCorsOptions() {
  const raw = process.env.CORS_ORIGIN || process.env.CORS_ORIGINS;
  let origin;
  if (raw && raw.trim()) {
    const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
    origin = list.length === 1 ? list[0] : list;
  } else {
    origin = true;
  }
  return {
    origin,
    credentials: true,
    optionsSuccessStatus: 204,
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization'],
  };
}

app.use(cors(buildCorsOptions()));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security
setupSecurity(app);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: useHttps,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Session-based CSRF protection
app.use((req, res, next) => {
  // Generate CSRF token if not exists
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// CSRF validation for state-changing requests
function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // Skip for multipart/form-data — validated after multer in route handlers
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) return next();
  const token = (req.body && req.body._csrf) || req.headers['x-csrf-token'];
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

app.use('/api/', csrfProtection);

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
// Serve legacy profile image path
app.use('/Profile', express.static(path.join(__dirname, 'Profile')));

// Make session data + helpers available to views
const { parseOfficePhone } = require('./utils/phone');
app.use((req, res, next) => {
  res.locals.admin = req.session.adminId ? true : false;
  res.locals.adminUsername = req.session.adminUsername || '';
  res.locals.adminDisplayName = req.session.adminDisplayName || req.session.adminUsername || '';
  res.locals.parseOfficePhone = parseOfficePhone;
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const publicRoutes = require('./routes/public');

app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);
app.use('/', publicRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
});

// Seed database and start server
seed();

app.listen(PORT, () => {
  console.log(`E-Card server running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});
