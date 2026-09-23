require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ts-mart';

// Enforce a strong session secret. We deliberately do NOT fall back to a
// default string — silently signing sessions with a known value would let an
// attacker forge cookies if the deployer forgot to set the env var.
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error(
    'SESSION_SECRET must be set to a string of at least 32 characters in .env. ' +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
}

/**
 * Redact credentials from a Mongo URI before logging. Atlas SRV strings look
 * like `mongodb+srv://user:pass@cluster...`. The straightforward regex
 * `/user:pass@/` is wrong because passwords can legitimately contain `@`
 * (URL-encoded as `%40` or sometimes as a raw `@`); we percent-encode the
 * user:pass section first, then redact it cleanly.
 */
function redactMongoUri(uri) {
  return uri.replace(
    /^(mongodb(?:\+srv)?:\/\/)([^@/]+)@/,
    (_m, scheme, userinfo) => {
      try {
        // Try parsing `user:pass` as a basic auth pair so we can mask each
        // half individually. Falls back to a single *** if the split fails.
        const idx = userinfo.lastIndexOf(':');
        if (idx === -1) return `${scheme}***@`;
        const user = userinfo.slice(0, idx);
        const pass = userinfo.slice(idx + 1);
        return `${scheme}${encodeURIComponent(user)}:***@`;
      } catch {
        return `${scheme}***@`;
      }
    }
  );
}

const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 20,
  // Mongoose 9 deprecated these but older Atlas setups still need them.
  autoIndex: process.env.NODE_ENV !== 'production',
};

// Connect to MongoDB, start the server, and wire graceful shutdown.
async function start() {
  let server;
  let shuttingDown = false;

  try {
    await mongoose.connect(MONGO_URI, MONGO_OPTIONS);
    console.log(`MongoDB connected: ${redactMongoUri(MONGO_URI)}`);

    server = app.listen(PORT, () => {
      console.log(`TS-Mart running on port ${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }

  // Graceful shutdown — close the server (stop accepting new connections),
  // drain in-flight requests, then close the Mongo connection. Bound to both
  // SIGTERM (Render / Railway / Docker stop) and SIGINT (Ctrl+C locally).
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\nReceived ${signal}. Starting graceful shutdown…`);

    // Hard timeout — if anything hangs, exit anyway so PaaS doesn't kill -9.
    const hardTimeout = setTimeout(() => {
      console.error('Graceful shutdown timed out after 10s — forcing exit.');
      process.exit(1);
    }, 10_000);
    hardTimeout.unref();

    try {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
        console.log('HTTP server closed.');
      }
      await mongoose.connection.close();
      console.log('MongoDB connection closed.');
      clearTimeout(hardTimeout);
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Surface unexpected errors instead of dying silently. The Express error
  // handler logs handled errors; these are for the genuinely unexpected.
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    shutdown('uncaughtException');
  });
}

start();
