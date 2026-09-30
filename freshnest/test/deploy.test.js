'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/* A local stand-in for ntfy, Telegram and Resend, so we can see exactly what would be sent. */
const received = [];
let failMode = false;
const sink = http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => { body += c; });
  req.on('end', () => {
    received.push({ url: req.url, headers: req.headers, body });
    res.writeHead(failMode ? 500 : 200, { 'Content-Type': 'application/json' }); res.end(failMode ? '{"error":"nope"}' : '{"ok":true}');
  });
});

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freshnest-deploy-'));
let server, base, app, sinkBase, cookie = '';

test.before(async () => {
  await new Promise((r) => sink.listen(0, '127.0.0.1', r));
  sinkBase = 'http://127.0.0.1:' + sink.address().port;
  Object.assign(process.env, {
    ADMIN_PASSWORD: 'deploy-test-password', PUBLIC_URL: 'https://www.freshnest.example/', TRUST_PROXY: '1',
    NOTIFY_URL: sinkBase + '/ntfy-topic',
    TELEGRAM_BOT_TOKEN: 'TOKEN123', TELEGRAM_CHAT_ID: '4242', TELEGRAM_API: sinkBase,
    RESEND_API_KEY: 're_key', NOTIFY_EMAIL: 'owner@example.com, second@example.com', RESEND_API_URL: sinkBase + '/emails', LOG_REQUESTS: 'off'
  });
  const { createApp } = require('../server/app');
  app = createApp({ publicDir: path.join(__dirname, '..', 'public'), dataDir });
  server = http.createServer(app.handler);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
  const r = await fetch(base + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'deploy-test-password' }) });
  cookie = r.headers.get('set-cookie').split(';')[0];
});
test.after(() => { app.backups.stop(); server.closeAllConnections && server.closeAllConnections(); server.close(); sink.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

const V = require('../server/validate');
const Pricing = require('../public/js/pricing.js');
const admin = async (method, url, body) => {
  const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})), headers: r.headers };
};
const booking = () => ({
  selection: { type: 'standard', kitchen: 'standard', rooms: { bedroom: 2, bathroom: 1, living: 1 } },
  details: { date: V.lagosDate(3), slot: 'morning', street: '12 Example Street', cityState: 'Ibadan, Oyo' },
  contact: { name: 'Ada Obi', phone: '0801 234 5678', email: 'ada@example.com' },
  consent: { accepted: true, version: Pricing.RULES.termsVersion }
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 2000) { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await wait(15); } return false; }

test('a booking alerts every configured channel with the details the owner needs', async () => {
  received.length = 0;
  const r = await fetch(base + '/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(booking()) });
  assert.equal(r.status, 201);
  const { ref } = await r.json();
  assert.ok(await until(() => received.length >= 3), 'three alerts arrived, got ' + received.length);

  const ntfy = received.find((x) => x.url === '/ntfy-topic');
  assert.match(ntfy.headers.title, new RegExp('New booking ' + ref));
  assert.match(ntfy.body, /Ada Obi, \+2348012345678/);
  assert.match(ntfy.body, /12 Example Street, Ibadan, Oyo/);
  assert.match(ntfy.body, /Open in admin: https:\/\/www\.freshnest\.example\/admin\/#bookings/, 'trailing slash of PUBLIC_URL is handled');

  const tg = received.find((x) => x.url === '/botTOKEN123/sendMessage');
  const tgBody = JSON.parse(tg.body);
  assert.equal(tgBody.chat_id, '4242'); assert.match(tgBody.text, new RegExp(ref));

  const mail = received.find((x) => x.url === '/emails');
  assert.equal(mail.headers.authorization, 'Bearer re_key');
  const mBody = JSON.parse(mail.body);
  assert.deepEqual(mBody.to, ['owner@example.com', 'second@example.com']);
  assert.match(mBody.subject, new RegExp(ref)); assert.match(mBody.text, /Estimate/);
});

test('a failing alert channel never blocks the booking, and the admin page shows the failure', async () => {
  received.length = 0; failMode = true;
  const r = await fetch(base + '/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(booking()) });
  assert.equal(r.status, 201, 'customer still gets a success');
  assert.ok(await until(() => received.length >= 3));
  await wait(100);
  const sys = (await admin('GET', '/api/admin/system')).data;
  assert.deepEqual(sys.notify.channels.sort(), ['email', 'ntfy', 'telegram']);
  assert.ok(sys.notify.last.results.every((x) => x.ok === false), 'failures are recorded');
  failMode = false;
  const t = await admin('POST', '/api/admin/system/test-notify', {});
  assert.equal(t.status, 200); assert.ok(t.data.results.every((x) => x.ok));
});

test('feedback also alerts, and says whether it may be published', async () => {
  received.length = 0;
  await fetch(base + '/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating: 3, text: 'Fine', name: 'Kemi', allowPublic: false }) });
  assert.ok(await until(() => received.length >= 3));
  assert.match(received.find((x) => x.url === '/ntfy-topic').body, /Private/);
});

test('the visitor IP is the address the proxy saw, so people cannot dodge the limit by faking a header', async () => {
  const send = (xff) => fetch(base + '/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': xff }, body: JSON.stringify(booking()) });
  /* The two bookings above came from 127.0.0.1 (no header). Use fresh addresses here. */
  for (let i = 0; i < 6; i++) assert.equal((await send('1.1.1.1, 203.0.113.9')).status, 201, 'booking ' + (i + 1));
  assert.equal((await send('1.1.1.1, 203.0.113.9')).status, 429, 'seventh from the same real address is refused');
  assert.equal((await send('8.8.8.8, 203.0.113.9')).status, 429, 'changing the fake left-hand address does not help');
  assert.equal((await send('1.1.1.1, 203.0.113.77')).status, 201, 'a different real address is a different visitor');
});

test('backups: a dated copy exists, the download hides secrets, and a restore works', async () => {
  await app.backups.run();
  const list = app.backups.list();
  assert.equal(list.length, 1); assert.match(list[0].file, /^db-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(fs.statSync(path.join(dataDir, 'backups', list[0].file)).mode & 0o777, 0o600);
  const dl = await admin('GET', '/api/admin/backup');
  assert.equal(dl.status, 200);
  assert.match(dl.headers.get('content-disposition'), /freshnest-backup-\d{4}-\d{2}-\d{2}\.json/);
  const text = JSON.stringify(dl.data);
  assert.ok(!text.includes('adminHash') && !text.includes('secret'), 'no credentials in the download');
  assert.ok(dl.data.bookings.length >= 2);

  /* restore the download into a brand-new server and sign in with the env password */
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'freshnest-restore-'));
  fs.writeFileSync(path.join(dir2, 'db.json'), JSON.stringify(dl.data));
  const { createApp } = require('../server/app');
  const app2 = createApp({ publicDir: path.join(__dirname, '..', 'public'), dataDir: dir2 });
  const s2 = http.createServer(app2.handler); await new Promise((r) => s2.listen(0, '127.0.0.1', r));
  const b2 = 'http://127.0.0.1:' + s2.address().port;
  const login = await fetch(b2 + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'deploy-test-password' }) });
  assert.equal(login.status, 200);
  const c2 = login.headers.get('set-cookie').split(';')[0];
  const restored = await (await fetch(b2 + '/api/admin/bookings', { headers: { Cookie: c2 } })).json();
  assert.equal(restored.bookings.length, dl.data.bookings.length, 'every booking came back');
  app2.backups.stop(); s2.closeAllConnections(); s2.close(); fs.rmSync(dir2, { recursive: true, force: true });
});

test('backups are pruned to the newest 14', async () => {
  const dir = path.join(dataDir, 'backups');
  for (let d = 1; d <= 20; d++) fs.writeFileSync(path.join(dir, 'db-2026-01-' + String(d).padStart(2, '0') + '.json'), '{}');
  await app.backups.run();
  const files = app.backups.list();
  assert.equal(files.length, 14);
  assert.match(files[0].file, /^db-2026-09/, "today's copy is kept");
});

test('home page carries live phone, hours and canonical address for search engines', async () => {
  let html = await (await fetch(base + '/')).text();
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.freshnest\.example\/">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/www\.freshnest\.example\/">/);
  const ld = () => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
  assert.equal(ld().telephone, '+2347087596696');
  assert.deepEqual(ld().openingHoursSpecification[0].dayOfWeek.length, 7);
  assert.equal(ld().openingHoursSpecification[0].opens, '07:00');

  const cur = (await admin('GET', '/api/admin/settings')).data.settings;
  await admin('PUT', '/api/admin/settings', { ...cur, phone: '0803 111 2222', hours: { open: '08:00', close: '18:00', days: [false, true, true, true, true, true, true] } });
  html = await (await fetch(base + '/')).text();
  assert.equal(ld().telephone, '+2348031112222', 'admin change reaches the page search engines read');
  assert.equal(ld().openingHoursSpecification[0].dayOfWeek.includes('Sunday'), false);
  assert.equal(ld().openingHoursSpecification[0].closes, '18:00');
  await admin('PUT', '/api/admin/settings', cur);
});

test('robots.txt and sitemap.xml use the public address', async () => {
  const robots = await (await fetch(base + '/robots.txt')).text();
  assert.match(robots, /Disallow: \/admin\//); assert.match(robots, /Sitemap: https:\/\/www\.freshnest\.example\/sitemap\.xml/);
  const sm = await fetch(base + '/sitemap.xml');
  assert.equal(sm.status, 200); assert.match(await sm.text(), /<loc>https:\/\/www\.freshnest\.example\/<\/loc>/);
});

function rawGet(pathname, headers) {
  return new Promise((resolve, reject) => {
    http.get(base + pathname, { headers }, (res) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })); }).on('error', reject);
  });
}
test('text files are gzip-compressed for browsers that accept it, and 304 works for both forms', async () => {
  const zlib = require('node:zlib');
  const plain = await rawGet('/js/booking.js', {});
  assert.equal(plain.headers['content-encoding'], undefined);
  const gz = await rawGet('/js/booking.js', { 'Accept-Encoding': 'gzip' });
  assert.equal(gz.headers['content-encoding'], 'gzip');
  assert.equal(gz.headers.vary, 'Accept-Encoding');
  assert.equal(zlib.gunzipSync(gz.body).toString(), plain.body.toString(), 'same content once decompressed');
  assert.ok(gz.body.length < plain.body.length / 2, 'much smaller: ' + gz.body.length + ' vs ' + plain.body.length);
  const again = await rawGet('/js/booking.js', { 'Accept-Encoding': 'gzip', 'If-None-Match': gz.headers.etag });
  assert.equal(again.status, 304);
  const home = await rawGet('/', { 'Accept-Encoding': 'gzip' });
  assert.equal(home.headers['content-encoding'], 'gzip');
  assert.match(zlib.gunzipSync(home.body).toString(), /A clean you can see\./);
  const home304 = await rawGet('/', { 'Accept-Encoding': 'gzip', 'If-None-Match': home.headers.etag });
  assert.equal(home304.status, 304);
  const img = await rawGet('/favicon.svg', { 'Accept-Encoding': 'gzip' });
  assert.equal(img.status, 200);
});

test('HTTPS behind a proxy turns on HSTS and Secure cookies', async () => {
  const r = await fetch(base + '/api/health', { headers: { 'X-Forwarded-Proto': 'https' } });
  assert.match(r.headers.get('strict-transport-security'), /max-age=\d+/);
  assert.equal((await r.json()).ok, true);
  const plain = await fetch(base + '/api/health');
  assert.equal(plain.headers.get('strict-transport-security'), null);
  const login = await fetch(base + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' }, body: JSON.stringify({ password: 'deploy-test-password' }) });
  assert.match(login.headers.get('set-cookie'), /; Secure/);
});

test('system status is admin-only and reports the connections', async () => {
  const anon = await fetch(base + '/api/admin/system'); assert.equal(anon.status, 401);
  assert.equal((await fetch(base + '/api/admin/backup')).status, 401);
  const sys = (await admin('GET', '/api/admin/system')).data;
  assert.equal(sys.publicUrl, 'https://www.freshnest.example');
  assert.equal(sys.passwordManagedByEnv, true); assert.equal(sys.proxyHops, 1);
  assert.equal(sys.version, require('../package.json').version);
});

test('.env files are read, real environment variables win, and comments and quotes are handled', () => {
  const { parseEnv, loadEnv } = require('../server/env');
  const parsed = parseEnv('# comment\nA=1\nB="two words"\nexport C=\'three\'\nD=four # trailing comment\n\nE=\nBAD LINE\n');
  assert.deepEqual(parsed, { A: '1', B: 'two words', C: 'three', D: 'four', E: '' });
  const f = path.join(dataDir, 'test.env'); fs.writeFileSync(f, 'FN_TEST_A=from-file\nFN_TEST_B=from-file\n');
  process.env.FN_TEST_B = 'from-real-env';
  assert.equal(loadEnv(f), true);
  assert.equal(process.env.FN_TEST_A, 'from-file'); assert.equal(process.env.FN_TEST_B, 'from-real-env');
  assert.equal(loadEnv(path.join(dataDir, 'missing.env')), false);
});
