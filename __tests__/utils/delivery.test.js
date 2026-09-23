const { DHAKA_FEE, OUTSIDE_FEE, deliveryFee } = require('../../utils/delivery');

describe('delivery.js', () => {
  it('exports DHAKA_FEE = 60', () => {
    expect(DHAKA_FEE).toBe(60);
  });

  it('exports OUTSIDE_FEE = 120', () => {
    expect(OUTSIDE_FEE).toBe(120);
  });

  it('deliveryFee("Dhaka") === DHAKA_FEE', () => {
    expect(deliveryFee('Dhaka')).toBe(DHAKA_FEE);
  });

  it('deliveryFee(<anything else>) === OUTSIDE_FEE', () => {
    for (const div of ['Chattogram', 'Rajshahi', 'Khulna', 'Barishal', 'Sylhet', 'Rangpur', 'Mymensingh', '', null, undefined]) {
      expect(deliveryFee(div)).toBe(OUTSIDE_FEE);
    }
  });
});
