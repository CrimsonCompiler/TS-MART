/**
 * Shared cart helpers used by routes/cart.js and routes/checkout.js.
 */
const { deliveryFee } = require('./delivery');

function ensureCart(req) {
  if (!req.session.cart) req.session.cart = [];
  return req.session.cart;
}

/**
 * Single-pass over the cart. Returns subtotal, shipping (based on `division`),
 * total, item count, and per-item line totals.
 *
 * `division` is optional — when the customer hasn't picked one yet (e.g. on
 * the home page or the cart page), shipping is null and the view can show a
 * "calculated at checkout" hint.
 */
function summarizeCart(cart, division = null) {
  let subtotal = 0;
  let count = 0;
  const lines = cart.map((item) => {
    const lineTotal = item.price * item.qty;
    subtotal += lineTotal;
    count += item.qty;
    return { ...item, lineTotal };
  });
  const shipping = cart.length === 0 || division == null ? null : deliveryFee(division);
  return {
    lines,
    subtotal,
    shipping,
    total: shipping == null ? subtotal : subtotal + shipping,
    count,
  };
}

module.exports = { ensureCart, summarizeCart };
