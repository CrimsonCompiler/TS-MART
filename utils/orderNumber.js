const crypto = require('crypto');
const Order = require('../models/Order');

/**
 * Generate a unique order number in the format TSM-YYYYMMDD-XXXXX.
 * Retries up to 3 times if a collision is found.
 */
async function generateOrderNumber() {
  for (let attempt = 0; attempt < 3; attempt++) {
    const d = new Date();
    const ymd =
      `${d.getFullYear()}` +
      `${String(d.getMonth() + 1).padStart(2, '0')}` +
      `${String(d.getDate()).padStart(2, '0')}`;
    const rand = String(crypto.randomInt(0, 99999)).padStart(5, '0');
    const candidate = `TSM-${ymd}-${rand}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await Order.findOne({ orderNumber: candidate }).lean();
    if (!exists) return candidate;
  }
  // Fallback: append milliseconds to guarantee uniqueness.
  const fallback = `TSM-${Date.now()}-${String(crypto.randomInt(0, 99999)).padStart(5, '0')}`;
  return fallback;
}

module.exports = { generateOrderNumber };