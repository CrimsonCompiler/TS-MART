/**
 * Smoke test for the checkout flow.
 *
 * Walks: GET / → POST /cart/add → GET /checkout
 * and prints the status + key tags from each response.
 *
 * Usage:  node scripts/smoke-checkout.js [port]
 * Exit code 0 if every step is 2xx, 1 otherwise.
 */
const http = require('http');

const PORT = Number(process.argv[2] || process.env.PORT || 3000);

function req(method, path, body, cookies = '') {
  return new Promise((resolve, reject) => {
    const data = body ? new URLSearchParams(body).toString() : '';
    const r = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(data || ''),
          ...(cookies ? { Cookie: cookies } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        );
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function pickCookie(headers) {
  const sc = headers['set-cookie'] || [];
  return sc.length ? sc[0].split(';')[0] : '';
}

(async () => {
  let ok = true;

  const home = await req('GET', '/');
  console.log(`[port ${PORT}] GET /                ->`, home.status);
  if (home.status !== 200) ok = false;
  const m = home.body.match(/productId" value="([a-f0-9]{24})"/);
  if (!m) {
    console.log('  no product on home — seed first (npm run seed)');
    process.exit(1);
  }
  const pid = m[1];
  let cookies = pickCookie(home.headers);

  const add = await req('POST', '/cart/add', { productId: pid, qty: '1' }, cookies);
  console.log(`[port ${PORT}] POST /cart/add       ->`, add.status, add.headers.location || '');
  if (add.status >= 400) ok = false;
  cookies = pickCookie(add.headers) || cookies;

  const chk = await req('GET', '/checkout', null, cookies);
  console.log(`[port ${PORT}] GET /checkout        ->`, chk.status);

  const dd = chk.body.match(/data-districts='([^']+)'/);
  const fee = chk.body.match(/data-dhaka-fee="(\d+)"/);
  const leaked = chk.body.match(/<%- |<%= |<% /g);
  const bigNum = chk.body.match(/<h1[^>]*>\s*(\S+?)\s*<\/h1>/);

  console.log(`  data-districts      ->`, dd ? dd[1].length + ' chars' : 'NOT FOUND');
  console.log(`  data-dhaka-fee      ->`, fee ? fee[1] : 'NOT FOUND');
  console.log(`  raw ejs in html     ->`, leaked ? leaked.length : 0);
  if (bigNum) console.log(`  hero number         ->`, bigNum[1]);

  if (chk.status !== 200) ok = false;
  if (!dd || !fee) ok = false;
  if (leaked && leaked.length > 0) ok = false;

  console.log(ok ? '\nALL OK' : '\nFAIL');
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
