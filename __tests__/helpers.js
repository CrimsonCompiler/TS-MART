/**
 * Shared test helpers. Boots the real Express app in test mode and exposes
 * a supertest agent plus a CSRF-token-minter.
 *
 * Design choice: these tests intentionally do NOT touch MongoDB. We stub
 * `mongoose.connection.readyState` so /healthz behaves as if connected, and
 * app.js falls back to express-session's built-in MemoryStore when
 * NODE_ENV=test. Reasons:
 *   1. The /healthz route only reads `mongoose.connection.readyState` — no
 *      need for a real connection.
 *   2. The CSRF tests only need a session in which csurf can stash its
 *      secret — never read it back across requests. MemoryStore is fine.
 *   3. Real Mongo under jest currently hits a Node 24 / mongoose 9 / mongodb
 *      driver 7 handshake bug ("Missing required sub-document 'driver'") that
 *      we don't need to solve for the suite to add value.
 *
 * Mongoose models used elsewhere still get loaded by app.js — they just
 * won't be connected to a database, which is fine for non-DB routes.
 */
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'a'.repeat(64);

const mongoose = require('mongoose');
const request = require('supertest');

let app;

/**
 * Lazily require app.js so the env vars above are in place first.
 * Returns the Express app — caller wraps it in supertest.
 */
function loadApp() {
  if (!app) {
    // Force a clean require so a previous test's env doesn't leak.
    delete require.cache[require.resolve('../app')];
    app = require('../app');
  }
  // Pretend we're connected so /healthz reports ok.
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 1,
  });
  return app;
}

function agent() {
  // request.agent() creates a persistent supertest agent that keeps cookies
  // between requests. request(app) works for a single request but won't
  // send the session cookie back on subsequent calls — which is exactly
  // what breaks CSRF (and rate limiting, and session-based flows).
  return request.agent(loadApp());
}

/**
 * Walk through the GET that mints the CSRF token, then return it. The token
 * is bound to the session, so we use a persistent supertest agent (cookie
 * jar). The token lives in two places — the meta tag and any visible
 * form input. The meta tag is on every page, so prefer it.
 */
async function getCsrfToken(getter) {
  const jar = agent();
  const path = typeof getter === 'function' ? getter() : '/cart';
  const pageRes = await jar.get(path);
  const html = pageRes.text;
  let m = html.match(/name="csrf-token" content="([^"]+)"/);
  if (!m) m = html.match(/name="_csrf" value="([^"]+)"/);
  return { jar, token: m ? m[1] : null };
}

module.exports = { loadApp, agent, getCsrfToken };