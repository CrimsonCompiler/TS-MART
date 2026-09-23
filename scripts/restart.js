/**
 * kill-and-restart the dev server.
 *
 * Finds whatever Node process is holding the PORT (from .env or process.env)
 * and stops it, then re-launches `node server.js` in the foreground.
 *
 * Usage:  node scripts/restart.js
 *   or:  npm run restart
 */
const { spawn, execSync } = require('child_process');
const path = require('path');

// Load PORT from .env if not in process.env.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const PORT = Number(process.env.PORT || 3000);

function findPidsOnPort(port) {
  // `netstat` is present on every Windows install. Format on Win10/11:
  //   TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    3936
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      const state = parts[3];
      const pid = parts[parts.length - 1];
      if (state === 'LISTENING' && /^\d+$/.test(pid)) {
        pids.add(pid);
      }
    }
    return Array.from(pids);
  } catch (_) {
    return [];
  }
}

const pids = findPidsOnPort(PORT);
if (pids.length === 0) {
  console.log(`Nothing listening on :${PORT}.`);
} else {
  for (const pid of pids) {
    try {
      // Confirm it's actually a node process before killing — we don't want
      // to nuke a different app that happens to be on the same port.
      const tasklist = execSync(
        `tasklist /FI "PID eq ${pid}" /FO CSV /NH`,
        { encoding: 'utf8' }
      );
      const isNode = /"node\.exe\"/i.test(tasklist) || /"nodemon\.exe\"/i.test(tasklist);
      if (isNode) {
        console.log(`Stopping node PID ${pid} on :${PORT}...`);
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'inherit' });
      } else {
        console.log(`PID ${pid} on :${PORT} is not node — leaving alone.`);
      }
    } catch (e) {
      console.log(`PID ${pid}: ${e.message}`);
    }
  }
}

// Give the OS a moment to release the port.
setTimeout(() => {
  console.log(`\nStarting server on :${PORT}...\n`);
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => process.exit(code || 0));
}, 500);
