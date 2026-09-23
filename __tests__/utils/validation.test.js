const {
  validateAndNormalizeCustomer,
  normalizeBDPhone,
  ORDER_NUMBER_RE,
  DISTRICTS_BY_DIVISION,
  BD_DIVISIONS,
} = require('../../utils/validation');

const VALID_CUSTOMER = {
  name: 'Test User',
  phone: '01712345678',
  email: 'test@example.com',
  house: 'House 1, Road 2',
  district: 'Dhaka',
  division: 'Dhaka',
  postcode: '1000',
};

describe('normalizeBDPhone', () => {
  it('strips non-digits', () => {
    expect(normalizeBDPhone('+880 (171) 234-5678')).toBe('01712345678');
  });

  it('converts 880XXXXXXXXXX to 0XXXXXXXXXX', () => {
    expect(normalizeBDPhone('8801712345678')).toBe('01712345678');
  });

  it('returns empty string for null/undefined', () => {
    expect(normalizeBDPhone(null)).toBe('');
    expect(normalizeBDPhone(undefined)).toBe('');
  });
});

describe('validateAndNormalizeCustomer', () => {
  it('returns a clean customer on a valid payload', () => {
    const { errors, customer } = validateAndNormalizeCustomer(VALID_CUSTOMER);
    expect(errors).toEqual({});
    expect(customer).toEqual({
      name: 'Test User',
      phone: '01712345678',
      email: 'test@example.com',
      house: 'House 1, Road 2',
      district: 'Dhaka',
      division: 'Dhaka',
      postcode: '1000',
    });
  });

  it('lowercases the email', () => {
    const { customer } = validateAndNormalizeCustomer({ ...VALID_CUSTOMER, email: 'Test@Example.COM' });
    expect(customer.email).toBe('test@example.com');
  });

  it('rejects when any required field is missing', () => {
    for (const field of Object.keys(VALID_CUSTOMER)) {
      const body = { ...VALID_CUSTOMER };
      delete body[field];
      const { errors, customer } = validateAndNormalizeCustomer(body);
      expect(errors[field]).toBeDefined();
      expect(customer).toBeNull();
    }
  });

  it('rejects when any required field is whitespace only', () => {
    const body = { ...VALID_CUSTOMER, name: '   ' };
    const { errors, customer } = validateAndNormalizeCustomer(body);
    expect(errors.name).toMatch(/required/);
    expect(customer).toBeNull();
  });

  it('rejects an invalid email', () => {
    const { errors } = validateAndNormalizeCustomer({ ...VALID_CUSTOMER, email: 'not-an-email' });
    expect(errors.email).toMatch(/valid email/);
  });

  it('rejects a phone that is not a valid BD mobile', () => {
    const { errors } = validateAndNormalizeCustomer({ ...VALID_CUSTOMER, phone: '+1234567890' });
    expect(errors.phone).toMatch(/Bangladeshi mobile/);
  });

  it('normalizes a +880-prefixed phone before validation', () => {
    const { errors, customer } = validateAndNormalizeCustomer({ ...VALID_CUSTOMER, phone: '+8801712345678' });
    expect(errors).toEqual({});
    expect(customer.phone).toBe('01712345678');
  });

  it('rejects a postcode that is not 4 digits', () => {
    const { errors } = validateAndNormalizeCustomer({ ...VALID_CUSTOMER, postcode: '12345' });
    expect(errors.postcode).toMatch(/4 digits/);
  });

  it('rejects a postcode that contains letters', () => {
    const { errors } = validateAndNormalizeCustomer({ ...VALID_CUSTOMER, postcode: 'abcd' });
    expect(errors.postcode).toMatch(/4 digits/);
  });

  it('rejects a district that does not belong to the chosen division', () => {
    const { errors } = validateAndNormalizeCustomer({ ...VALID_CUSTOMER, division: 'Dhaka', district: 'Chattogram' });
    expect(errors.district).toMatch(/not a district of Dhaka/);
  });

  it('accepts every official district under every division', () => {
    let total = 0;
    for (const division of BD_DIVISIONS) {
      for (const district of DISTRICTS_BY_DIVISION[division]) {
        total++;
        const { errors, customer } = validateAndNormalizeCustomer({ ...VALID_CUSTOMER, division, district });
        expect({ division, district, errors }).toEqual({ division, district, errors: {} });
        expect(customer).not.toBeNull();
      }
    }
    // Sanity: we should cover all 64 official districts.
    expect(total).toBe(64);
  });

  it('rejects an unknown division', () => {
    const { errors } = validateAndNormalizeCustomer({ ...VALID_CUSTOMER, division: 'Atlantis' });
    expect(errors.district).toBeDefined();
  });
});

describe('ORDER_NUMBER_RE', () => {
  it('matches the expected format', () => {
    expect(ORDER_NUMBER_RE.test('TSM-20260923-12345')).toBe(true);
    expect(ORDER_NUMBER_RE.test('TSM-20990101-00000')).toBe(true);
  });

  it('rejects malformed order numbers', () => {
    expect(ORDER_NUMBER_RE.test('garbage')).toBe(false);
    expect(ORDER_NUMBER_RE.test('TSM-2026-12345')).toBe(false);
    expect(ORDER_NUMBER_RE.test('TSM-20260923-1234')).toBe(false);
    expect(ORDER_NUMBER_RE.test('TSM-20260923-123456')).toBe(false);
    expect(ORDER_NUMBER_RE.test('TSM-abcdefgh-12345')).toBe(false);
  });
});
