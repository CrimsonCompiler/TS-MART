const STAGES = [
  { key: 'placed', label: 'Order Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'outForDelivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

function getIntervalSeconds() {
  const n = parseInt(process.env.STATUS_INTERVALS_SECONDS, 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

/**
 * Walk an order through its pipeline based on elapsed time since creation.
 * Idempotent: persists only when at least one timestamp was newly set.
 * Returns the updated order.
 */
async function advanceOrderStatus(order) {
  const interval = getIntervalSeconds();
  const now = new Date();
  const elapsedSeconds = (now - new Date(order.createdAt)) / 1000;

  let changed = false;
  let currentLabel = STAGES[0].label;
  for (let i = 1; i < STAGES.length; i++) {
    const stage = STAGES[i];
    if (elapsedSeconds >= i * interval) {
      if (!order.statusTimestamps[stage.key]) {
        order.statusTimestamps[stage.key] = now;
        changed = true;
      }
      currentLabel = stage.label;
    }
  }

  // Skip the write if nothing changed: no new timestamps AND the label
  // already matches the derived stage. Otherwise persist (a missing
  // timestamp or a stale label both warrant a save).
  if (!changed && order.status === currentLabel) return order;
  order.status = currentLabel;
  await order.save();
  return order;
}

module.exports = { STAGES, advanceOrderStatus, getIntervalSeconds };