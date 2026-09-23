# --- Builder ---------------------------------------------------------------
# Install full deps (including dev) so we can run any build/test step that
# might land here later. Slim base image keeps the production layer small.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# --- Production layer ------------------------------------------------------
FROM node:20-alpine AS prod
WORKDIR /app

# Tini-like signal handling — node:20-alpine doesn't ship tini, so we use
# the built-in `node` entrypoint with the server.js script which now wires
# SIGTERM/SIGINT graceful shutdown on its own.

ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_LOGLEVEL=warn

# Install only production deps.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Bring in the application source.
COPY . .

# Drop root for runtime.
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 3000

# Render's health check (matches /healthz route in app.js). `--spider` would
# be ideal but isn't in busybox wget — fall back to `wget -qO-`.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.js"]
