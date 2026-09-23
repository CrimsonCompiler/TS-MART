const { loadApp, getCsrfToken } = require('../helpers');

describe('CSRF protection on mutating routes', () => {
  beforeAll(() => { loadApp(); });

  it('POST /cart/add without _csrf is rejected with 403', async () => {
    const { jar } = await getCsrfToken();
    const res = await jar
      .post('/cart/add')
      .type('form')
      .send({ productId: 'x'.repeat(24), qty: '1' });
    expect(res.status).toBe(403);
    expect(res.text).toMatch(/Session expired/);
  });

  it('POST /cart/update without _csrf is rejected with 403', async () => {
    const { jar } = await getCsrfToken();
    const res = await jar
      .post('/cart/update')
      .type('form')
      .send({ productId: 'y'.repeat(24), qty: '1' });
    expect(res.status).toBe(403);
  });

  it('POST /checkout/submit without _csrf is rejected with 403', async () => {
    const { jar } = await getCsrfToken();
    const res = await jar.post('/checkout/submit').type('form').send({
      name: 'X', phone: '01700000000', email: 'a@b.co', house: 'h',
      division: 'Dhaka', district: 'Dhaka', postcode: '1000',
    });
    expect(res.status).toBe(403);
  });

  it('POST /cart/add with a valid token is accepted (redirect, not 403)', async () => {
    // Use a syntactically-valid but not-in-DB ObjectId; the route should
    // redirect with a flash rather than 403, which proves the token cleared
    // CSRF and the request reached the handler.
    const { jar, token } = await getCsrfToken();
    expect(token).toBeTruthy();

    const res = await jar
      .post('/cart/add')
      .type('form')
      .send({ _csrf: token, productId: '507f1f77bcf86cd799439011', qty: '1' });

    // The route hits Product.findById, which throws because there's no DB.
    // What matters for this test is that we're NOT 403 — CSRF passed and
    // the request was dispatched. We accept 200 (error view), 302 (redirect
    // back), or 500 (DB not connected). All three prove CSRF didn't fire.
    expect(res.status).not.toBe(403);
  });
});
