// Single whitelisted router. Every route the app exposes is registered here
// with an explicit method — anything not on this list returns 404 (handled in
// server.js after the router runs).
//
// Adding a new route? Add it here and nowhere else.

const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');

const Product = require('../models/Product');
const Order = require('../models/Order');
const { ensureCart, summarizeCart } = require('../utils/cart');
const { generateOrderNumber } = require('../utils/orderNumber');
const { STAGES, advanceOrderStatus } = require('../utils/orderStatus');
const {
  BD_DIVISIONS,
  DISTRICTS_BY_DIVISION,
  ORDER_NUMBER_RE,
  validateAndNormalizeCustomer,
} = require('../utils/validation');

const router = express.Router();

const checkoutView = { divisions: BD_DIVISIONS, districtsByDivision: DISTRICTS_BY_DIVISION };

// Per-route limiter for the order-creation endpoint. Sits in front of the
// /checkout/submit handler so each request consumes a token before we touch
// Mongo.
const checkoutSubmitLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5, // express-rate-limit v8 uses `limit`, not `max`
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many order attempts. Please wait a minute.',
});

// Tighter cap on cart mutations — /cart/add, /cart/update, /cart/remove.
const cartWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many cart updates, please slow down.',
});

// Stock policy. The cart lives in the session, but stock is the source of
// truth in Mongo — every write that touches quantity must consult it.
//
// `setFlash` queues a one-shot banner via `res.locals.flash` in app.js.
function setFlash(req, kind, message) {
  req.session.flash = { kind, message };
}

// Enforce the per-product stock limit. Returns { ok, cappedQty, stock } where
// `cappedQty` is the qty the cart should actually adopt (clamped down to
// stock if the requested qty would exceed it).
async function capQtyByStock(productId, requestedQty) {
  if (!mongoose.isValidObjectId(productId)) return { ok: false, cappedQty: 0, stock: 0 };
  const product = await Product.findById(productId).select('stock').lean();
  if (!product) return { ok: false, cappedQty: 0, stock: 0 };
  const stock = product.stock || 0;
  if (stock <= 0) return { ok: true, cappedQty: 0, stock };
  const cappedQty = Math.min(requestedQty, stock);
  return { ok: true, cappedQty, stock };
}

// =========================
//   ROUTE WHITELIST
// =========================

// GET /
router.get('/', async (_req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.render('index', { products });
});

// GET /product/:id
router.get('/product/:id', async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).render('error', { title: 'Product not found', message: 'That product does not exist.' });
  }
  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).render('error', { title: 'Product not found', message: 'That product does not exist.' });
  }
  res.render('product', { product });
});

// GET /cart
router.get('/cart', (req, res) => {
  res.render('cart');
});

// POST /cart/add
router.post('/cart/add', cartWriteLimiter, async (req, res) => {
  const { productId } = req.body;
  const requestedQty = Math.max(1, parseInt(req.body.qty, 10) || 1);
  if (!mongoose.isValidObjectId(productId)) {
    setFlash(req, 'error', 'That product could not be added.');
    return res.redirect('back');
  }
  const product = await Product.findById(productId);
  if (!product) {
    setFlash(req, 'error', 'That product is no longer available.');
    return res.redirect('back');
  }
  if ((product.stock || 0) <= 0) {
    setFlash(req, 'error', `${product.name} is out of stock.`);
    return res.redirect('back');
  }
  const cart = ensureCart(req);
  const existing = cart.find((i) => i.productId === productId);
  const desiredTotal = (existing?.qty || 0) + requestedQty;
  const cappedQty = Math.min(desiredTotal, product.stock);
  if (existing) existing.qty = cappedQty;
  else cart.push({ productId: String(product._id), name: product.name, price: product.price, image: product.image, qty: cappedQty });
  if (cappedQty < desiredTotal) {
    setFlash(req, 'error', `Only ${product.stock} of "${product.name}" available — quantity adjusted.`);
  }
  res.redirect('/cart');
});

// POST /cart/update
router.post('/cart/update', cartWriteLimiter, async (req, res) => {
  const { productId } = req.body;
  const requestedQty = Math.max(0, parseInt(req.body.qty, 10) || 0);
  const cart = ensureCart(req);
  const item = cart.find((i) => i.productId === productId);
  if (!item) return res.redirect('/cart');
  if (requestedQty === 0) {
    cart.splice(cart.indexOf(item), 1);
    return res.redirect('/cart');
  }
  const { cappedQty, stock } = await capQtyByStock(productId, requestedQty);
  if (stock > 0 && cappedQty < requestedQty) {
    setFlash(req, 'error', `Only ${stock} in stock — quantity adjusted.`);
  }
  if (cappedQty <= 0) {
    cart.splice(cart.indexOf(item), 1);
  } else {
    item.qty = cappedQty;
  }
  res.redirect('/cart');
});

// POST /cart/remove
router.post('/cart/remove', cartWriteLimiter, (req, res) => {
  const { productId } = req.body;
  const cart = ensureCart(req);
  const idx = cart.findIndex((i) => i.productId === productId);
  if (idx !== -1) cart.splice(idx, 1);
  res.redirect('/cart');
});

// GET /checkout
router.get('/checkout', (req, res) => {
  if (ensureCart(req).length === 0) return res.redirect('/cart');
  const form = req.session.checkoutDivision ? { division: req.session.checkoutDivision } : {};
  res.render('checkout', { errors: {}, form, ...checkoutView });
});

// POST /checkout/submit
router.post('/checkout/submit', checkoutSubmitLimiter, async (req, res) => {
  const cart = ensureCart(req);
  if (cart.length === 0) return res.redirect('/cart');
  const { errors, customer } = validateAndNormalizeCustomer(req.body);
  if (!customer) return res.status(400).render('checkout', { errors, form: req.body, ...checkoutView });

  // Defense-in-depth: re-check every cart line against current stock just
  // before persisting. If anything is out of stock, prune the line and
  // re-render the form so the user can see what's available.
  const productIds = [...new Set(cart.map((i) => i.productId))];
  const products = await Product.find({ _id: { $in: productIds } }).select('_id name stock').lean();
  const stockById = new Map(products.map((p) => [String(p._id), p]));
  const adjusted = [];
  const outOfStock = [];
  for (const item of cart) {
    const p = stockById.get(item.productId);
    if (!p || (p.stock || 0) <= 0) { outOfStock.push(item.name); continue; }
    if (item.qty > p.stock) {
      adjusted.push({ name: item.name, requested: item.qty, available: p.stock });
      item.qty = p.stock;
    }
  }
  // Drop any lines whose stock has fallen to 0.
  for (let i = cart.length - 1; i >= 0; i--) {
    const p = stockById.get(cart[i].productId);
    if (!p || (p.stock || 0) <= 0) cart.splice(i, 1);
  }
  if (cart.length === 0) {
    setFlash(req, 'error', 'Your cart is empty after stock changes. Please add products again.');
    return res.redirect('/cart');
  }
  if (outOfStock.length || adjusted.length) {
    req.session.checkoutDivision = customer.division;
    const parts = [];
    if (outOfStock.length) parts.push(`${outOfStock.join(', ')} ${outOfStock.length === 1 ? 'is' : 'are'} out of stock and removed`);
    if (adjusted.length) parts.push(`adjusted to available stock: ${adjusted.map((a) => `${a.name} (${a.requested}→${a.available})`).join(', ')}`);
    setFlash(req, 'error', parts.join('; ') + '.');
    return res.redirect('/cart');
  }

  req.session.checkoutDivision = customer.division;
  const { lines, subtotal, shipping, total: totalAmount } = summarizeCart(cart, customer.division);
  const orderNumber = await generateOrderNumber();
  const order = new Order({
    orderNumber,
    items: lines.map(({ productId, name, price, qty, image }) => ({ productId, name, price, qty, image })),
    customer,
    paymentMethod: 'COD',
    currency: 'BDT',
    shipping,
    totalAmount,
    status: STAGES[0].label,
    statusTimestamps: { placed: new Date() },
  });
  await order.save();
  req.session.cart = [];
  delete req.session.checkoutDivision;
  res.redirect(`/order/${orderNumber}/confirmation`);
});

// GET /track
router.get('/track', (req, res) => {
  const q = (req.query.orderNumber || '').toString().trim();
  if (q && ORDER_NUMBER_RE.test(q)) return res.redirect(`/track/${q}`);
  if (q) return res.status(400).render('error', { title: 'Invalid order number', message: 'Order numbers look like TSM-YYYYMMDD-XXXXX.' });
  res.render('track', { error: null, orderNumber: '' });
});

// GET /track/:orderNumber
router.get('/track/:orderNumber', async (req, res) => {
  const { orderNumber } = req.params;
  if (!ORDER_NUMBER_RE.test(orderNumber)) {
    return res.status(404).render('error', { title: 'Order not found', message: `We could not find an order with number "${orderNumber}".` });
  }
  const order = await Order.findOne({ orderNumber });
  if (!order) return res.status(404).render('error', { title: 'Order not found', message: `We could not find an order with number "${orderNumber}". Please double-check the number.` });
  await advanceOrderStatus(order);
  const currentStageKey = STAGES.find((s) => s.label === order.status)?.key || 'placed';
  const currentIdx = STAGES.findIndex((s) => s.key === currentStageKey);
  const stageStates = STAGES.map((stage, idx) => ({
    ...stage,
    reached: !!order.statusTimestamps[stage.key],
    isCurrent: stage.key === currentStageKey,
    isPast: currentIdx > idx,
    timestamp: order.statusTimestamps[stage.key],
  }));
  res.render('track-result', { order, stageStates });
});

// GET /order/:orderNumber/confirmation
router.get('/order/:orderNumber/confirmation', async (req, res) => {
  const { orderNumber } = req.params;
  if (!ORDER_NUMBER_RE.test(orderNumber)) {
    return res.status(404).render('error', { title: 'Order not found', message: `We could not find an order with number "${orderNumber}".` });
  }
  const order = await Order.findOne({ orderNumber });
  if (!order) return res.status(404).render('error', { title: 'Order not found', message: `We could not find an order with number "${orderNumber}".` });
  res.render('confirmation', { order });
});

module.exports = router;
