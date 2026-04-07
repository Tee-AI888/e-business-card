const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

/** When false (default), relax headers that assume HTTPS (Helmet 8 defaults break plain HTTP / LAN IPs). Set USE_HTTPS=true behind TLS. */
const useHttps = process.env.USE_HTTPS === 'true';
const loginRateLimitWindowMs = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const loginRateLimitMax = Number(process.env.LOGIN_RATE_LIMIT_MAX || 20);
const apiRateLimitWindowMs = Number(process.env.API_RATE_LIMIT_WINDOW_MS || 1 * 60 * 1000);
const apiRateLimitMax = Number(process.env.API_RATE_LIMIT_MAX || 100);

function setupSecurity(app) {
  const cspDirectives = {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "blob:"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    scriptSrcAttr: ["'unsafe-inline'"],
    connectSrc: ["'self'"],
  };
  if (!useHttps) {
    cspDirectives.upgradeInsecureRequests = null;
  }

  // Helmet for HTTP security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: cspDirectives,
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: useHttps ? undefined : false,
    originAgentCluster: useHttps ? undefined : false,
    strictTransportSecurity: useHttps ? undefined : false,
  }));

  // Rate limiting on login endpoint
  const loginLimiter = rateLimit({
    windowMs: loginRateLimitWindowMs,
    max: loginRateLimitMax,
    message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth/login', loginLimiter);

  // General API rate limit
  const apiLimiter = rateLimit({
    windowMs: apiRateLimitWindowMs,
    max: apiRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', apiLimiter);
}

module.exports = { setupSecurity };
