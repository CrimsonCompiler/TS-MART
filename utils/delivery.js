// Delivery fee policy.
// ৳60 inside Dhaka, ৳120 anywhere else in Bangladesh.
const DHAKA_FEE = 60;
const OUTSIDE_FEE = 120;

function deliveryFee(division) {
  return division === 'Dhaka' ? DHAKA_FEE : OUTSIDE_FEE;
}

module.exports = { DHAKA_FEE, OUTSIDE_FEE, deliveryFee };
