const { summarizeCart, ensureCart } = require('../../utils/cart');
const { DHAKA_FEE, OUTSIDE_FEE } = require('../../utils/delivery');

function fakeSession() {
  return {};
}

describe('summarizeCart', () => {
  it('returns zeroed subtotal + null shipping for empty cart', () => {
    const r = summarizeCart([]);
    expect(r.subtotal).toBe(0);
    expect(r.shipping).toBeNull();
    expect(r.total).toBe(0);
    expect(r.count).toBe(0);
    expect(r.lines).toEqual([]);
  });

  it('returns null shipping when no division provided', () => {
    const cart = [{ productId: 'a', name: 'X', price: 100, qty: 2, image: '' }];
    const r = summarizeCart(cart);
    expect(r.subtotal).toBe(200);
    expect(r.shipping).toBeNull();
    expect(r.total).toBe(200);
    expect(r.count).toBe(2);
  });

  it('uses DHAKA_FEE when division === Dhaka', () => {
    const cart = [{ productId: 'a', name: 'X', price: 100, qty: 1, image: '' }];
    const r = summarizeCart(cart, 'Dhaka');
    expect(r.subtotal).toBe(100);
    expect(r.shipping).toBe(DHAKA_FEE);
    expect(r.total).toBe(100 + DHAKA_FEE);
  });

  it('uses OUTSIDE_FEE for any other division', () => {
    const cart = [{ productId: 'a', name: 'X', price: 100, qty: 1, image: '' }];
    const r = summarizeCart(cart, 'Chattogram');
    expect(r.shipping).toBe(OUTSIDE_FEE);
    expect(r.total).toBe(100 + OUTSIDE_FEE);
  });

  it('attaches a lineTotal to each line item', () => {
    const cart = [
      { productId: 'a', name: 'A', price: 50, qty: 2, image: '' },
      { productId: 'b', name: 'B', price: 30, qty: 3, image: '' },
    ];
    const r = summarizeCart(cart, 'Dhaka');
    expect(r.lines[0].lineTotal).toBe(100);
    expect(r.lines[1].lineTotal).toBe(90);
    expect(r.subtotal).toBe(190);
    expect(r.count).toBe(5);
  });

  it('rejects negative shipping when division provided but cart empty', () => {
    // An empty cart shouldn't accidentally charge shipping.
    const r = summarizeCart([], 'Dhaka');
    expect(r.shipping).toBeNull();
    expect(r.total).toBe(0);
  });
});

describe('ensureCart', () => {
  it('initializes an empty cart on the session', () => {
    const req = { session: fakeSession() };
    const cart = ensureCart(req);
    expect(cart).toEqual([]);
    expect(req.session.cart).toBe(cart);
  });

  it('returns the existing cart on subsequent calls', () => {
    const existing = [{ productId: 'a', name: 'A', price: 1, qty: 1, image: '' }];
    const req = { session: { cart: existing } };
    expect(ensureCart(req)).toBe(existing);
  });
});
