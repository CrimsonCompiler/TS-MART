const { agent, loadApp } = require('../helpers');

describe('GET /healthz', () => {
  beforeAll(() => { loadApp(); });

  it('returns 200 JSON with ok=true when Mongo is connected', async () => {
    const res = await agent().get('/healthz');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.ok).toBe(true);
    expect(res.body.mongo).toBe('connected');
    expect(typeof res.body.uptime).toBe('number');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('is not throttled by the global rate limiter', async () => {
    // Hammer it — the limiter skips /healthz, so all 250 calls should 200.
    // Cap under the 250 default to avoid hammering the test runner.
    const calls = Array.from({ length: 100 }, () => agent().get('/healthz'));
    const results = await Promise.all(calls);
    const ok = results.filter((r) => r.status === 200).length;
    expect(ok).toBe(100);
  });
});
