require('dotenv').config();

const path = require('path');
const express = require('express');
const compression = require('compression');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const csurf = require('csurf');
const mongoose = require('mongoose');

const routes = require('./routes');
const { ensureCart, summarizeCart } = require('./utils/cart');
const { formatBDT, TAKA, encodeJSONForAttr } = require('./utils/format');
const { DHAKA_FEE, OUTSIDE_FEE } = require('./utils/delivery');

const app = express();
const IS_PROD = process.env.NODE_ENV === 'production';
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ts-mart';
// In most deployments the session store can share the app DB. Atlas users may
// want a dedicated cluster or DB for sessions — wire that through here.
const SESSION_MONGO_URI = process.env.MONGO_SESSION_URI || MONGO_URI;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Don't advertise the framework.
app.disable('x-powered-by');

// Behind a reverse proxy in prod (e.g. on Render/Heroku) we trust the proxy so
// rate limiting and secure cookies work correctly.
if (IS_PROD) app.set('trust proxy', 1);

// ---------- Health check (BEFORE rate-limit so it never gets throttled) -----
app.get('/healthz', (_req, res) => {
  const mongoState = mongoose.connection?.readyState; // 1 = connected
  res.json({
    ok: mongoState === 1,
    uptime: Math.round(process.uptime()),
    mongo: mongoState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// ---------- Security headers ----------
// Helmet defaults are sensible. CSP allows:
//   • Tailwind Play CDN script (replaced with a built CSS pipeline in the
//     next iteration; documented in deploy/README.md)
//   • Google Fonts CSS + woff2 files
//   • Inline styles only for the few style="…" attributes templates emit
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.tailwindcss.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    // HSTS in prod only — there's no point forcing HTTPS during local dev.
    strictTransportSecurity: IS_PROD
      ? { maxAge: 60 * 60 * 24 * 365, includeSubDomains: true, preload: true }
      : false,
    referrerPolicy: { policy: 'no-referrer' },
  })
);

// Gzip/deflate for every response. Skip the health check (already tiny).
app.use(
  compression({
    filter: (req, res) => {
      if (req.path === '/healthz') return false;
      return compression.filter(req, res);
    },
  })
);

// Tight body-size limit. Forms are small; reject anything bigger.
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.json({ limit: '16kb' }));

// Static assets — anything under /public is served at the root. Only static
// (non-sensitive) files should live here; do NOT put configs, .env, or
// source under /public.
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: '7d',
    immutable: false, // safer until we add content hashing; browsers revalidate
  })
);

// ---------- Session (Mongo-backed in prod, in-memory for tests) ----------
// In production we use connect-mongo so sessions survive restarts. In tests we
// fall back to express-session's built-in in-memory store (a no-op for the
// /healthz and CSRF integration tests we ship today — they never need to
// persist anything). The NODE_ENV check keeps Mongo traffic out of CI.
const sessionStore =
  process.env.NODE_ENV === 'test'
    ? undefined // express-session default = MemoryStore
    : MongoStore.create({
        mongoUrl: SESSION_MONGO_URI,
        collectionName: 'sessions',
        ttl: 60 * 60 * 24, // 1 day, matches cookie maxAge
      });

app.use(
  session({
    name: 'ts.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: IS_PROD,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// ---------- CSRF ----------
// csurf v1 expects either a session or a cookie secret. We're using sessions.
// Mounted globally with `ignoreMethods` so it only validates mutating verbs
// — but it still attaches `req.csrfToken()` to every request so templates
// can render <input name="_csrf" value="<%= csrfToken %>"> on every page.
const csrfProtection = csurf({ ignoreMethods: ['GET', 'HEAD', 'OPTIONS'] });
app.use(csrfProtection);

// CSRF errors raise — translate to a friendly 403 instead of a 500.
app.use((err, _req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).render('error', {
      title: 'Session expired',
      message: 'Your session has expired. Please reload the page and try again.',
    });
  }
  return next(err);
});

// ---------- Rate limiting ----------
//
// Global limiter: applies to every request EXCEPT /healthz (already mounted
// above). Keeps accidental bots from crawling the site into the ground.
// Tighter, method-specific limiters live next to the write endpoints they
// protect (see routes/index.js).
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/healthz',
  message: { error: 'Too many requests, please slow down.' },
});

app.use(globalLimiter);

// Expose cart + totals + nav state + CSRF token to every template.
// Must run AFTER session, AFTER csurf (so req.csrfToken works).
app.use((req, res, next) => {
  const cart = ensureCart(req);
  res.locals.cart = cart;
  res.locals.cartTotals = summarizeCart(cart, req.session.checkoutDivision || null);
  res.locals.cartCount = res.locals.cartTotals.count;
  res.locals.currentPath = req.path;
  // Flash messages — one-shot, cleared on render.
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  // Helpers for templates — single source of truth for currency formatting
  // and delivery fees (utils/format.js + utils/delivery.js).
  res.locals.formatBDT = formatBDT;
  res.locals.TAKA = TAKA;
  res.locals.encodeJSONForAttr = encodeJSONForAttr;
  res.locals.dhakaFee = DHAKA_FEE;
  res.locals.outsideFee = OUTSIDE_FEE;
  // CSRF — every template can render <input name="_csrf" value="<%= csrfToken %>">
  res.locals.csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : '';
  next();
});

// ---------- Routes ----------
app.use('/', routes);

// 404 — everything else is rejected.
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page not found',
    message: `No route matched ${req.originalUrl}.`,
  });
});

// Generic error handler — last middleware.
app.use((err, _req, res, _next) => {
  if (res.headersSent) return;
  if (err && err.type === 'entity.too.large') {
    return res.status(413).render('error', { title: 'Request too large', message: 'That request is too large to process.' });
  }
  console.error('Unhandled error:', err);
  res.status(500).render('error', { title: 'Something went wrong', message: 'Please try again in a moment.' });
});

module.exports = app;
