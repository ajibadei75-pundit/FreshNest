'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freshnest-'));
process.env.ADMIN_PASSWORD = 'test-password-123';
const { createApp } = require('../server/app');
const Pricing = require('../public/js/pricing.js');
const V = require('../server/validate');

let server, base, cookie = '';

test.before(async () => {
  const app = createApp({ publicDir: path.join(__dirname, '..', 'public'), dataDir });
  server = http.createServer(app.handler);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(() => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

async function call(method, url, body, opts = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.cookie !== false && cookie) headers.Cookie = cookie;
  const res = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch (e) { /* not json */ }
  return { status: res.status, data, text, headers: res.headers };
}

function validBooking(over = {}) {
  return Object.assign({
    selection: { type: 'standard', size: 'average', cond: 'normal', kitchen: 'standard', rooms: { bedroom: 2, bathroom: 1, living: 1 }, extras: ['oven'], freq: 'once' },
    details: { date: V.lagosDate(3), slot: 'morning', street: '12 Example Street', cityState: 'Ibadan, Oyo', access: 'I will be at home', water: true, power: true },
    contact: { name: 'Ada Obi', phone: '0801 234 5678', email: 'ada@example.com', pref: 'WhatsApp' },
    consent: { accepted: true, version: Pricing.RULES.termsVersion },
    message: 'Hello'
  }, over);
}

test('serves the site and blocks path traversal', async () => {
  const home = await call('GET', '/');
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type'), /text\/html/);
  assert.match(home.text, /FreshNest/);
  const admin = await call('GET', '/admin');
  assert.equal(admin.status, 301);
  const adminPage = await call('GET', '/admin/');
  assert.equal(adminPage.status, 200);
  assert.equal((await call('GET', '/nope')).status, 404);
});

test('security headers are set', async () => {
  const r = await call('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
});

test('path traversal is refused', async () => {
  for (const p of ['/../server/store.js', '/..%2fserver%2fstore.js', '/%2e%2e/package.json', '/.env']) {
    const r = await call('GET', p);
    assert.ok(r.status === 404 || r.status === 400, p + ' gave ' + r.status);
    assert.ok(!/createStore|"name": "freshnest"/.test(r.text));
  }
});

test('public endpoint exposes settings but not private data', async () => {
  const r = await call('GET', '/api/public');
  assert.equal(r.status, 200);
  assert.equal(r.data.settings.hours.days.length, 7);
  assert.ok(r.data.settings.hours.days.every(Boolean), 'open every day by default');
  assert.equal(JSON.stringify(r.data).includes('adminHash'), false);
  assert.deepEqual(r.data.reviews, []);
});

test('admin routes need a session', async () => {
  for (const [m, u] of [['GET', '/api/admin/bookings'], ['GET', '/api/admin/summary'], ['PUT', '/api/admin/settings'], ['POST', '/api/admin/upload'], ['GET', '/api/admin/bookings.csv']]) {
    const r = await call(m, u, m === 'GET' ? undefined : {}, { cookie: false });
    assert.equal(r.status, 401, m + ' ' + u);
  }
});

test('booking needs consent, a real date and valid contact details', async () => {
  let r = await call('POST', '/api/bookings', validBooking({ consent: { accepted: false } }));
  assert.equal(r.status, 422); assert.equal(r.data.field, 'consent');
  r = await call('POST', '/api/bookings', validBooking({ consent: {} }));
  assert.equal(r.status, 422);
  r = await call('POST', '/api/bookings', validBooking({ details: { ...validBooking().details, date: '2020-01-01' } }));
  assert.equal(r.status, 422); assert.equal(r.data.field, 'date');
  r = await call('POST', '/api/bookings', validBooking({ contact: { name: 'A', phone: '123' } }));
  assert.equal(r.status, 422);
  r = await call('POST', '/api/bookings', validBooking({ selection: { type: 'nope' } }));
  assert.equal(r.status, 422);
});

test('a valid booking is saved and priced by the server', async () => {
  const body = validBooking();
  body.estimate = { low: 1, high: 2 };                 /* a tampered price must be ignored */
  const r = await call('POST', '/api/bookings', body);
  assert.equal(r.status, 201);
  assert.match(r.data.ref, /^FN-\d{6}-[0-9A-F]{4}$/);
});

test('honeypot submissions are dropped silently', async () => {
  const before = (await signIn()).length;
  const r = await call('POST', '/api/bookings', validBooking({ website: 'http://spam.example' }));
  assert.equal(r.status, 201);
  const after = (await call('GET', '/api/admin/bookings')).data.bookings.length;
  assert.equal(after, before);
});

async function signIn() {
  if (!cookie) {
    const r = await call('POST', '/api/admin/login', { password: 'test-password-123' }, { cookie: false });
    assert.equal(r.status, 200);
    cookie = r.headers.get('set-cookie').split(';')[0];
    assert.match(r.headers.get('set-cookie'), /HttpOnly/);
    assert.match(r.headers.get('set-cookie'), /SameSite=Strict/);
  }
  return (await call('GET', '/api/admin/bookings')).data.bookings;
}

test('wrong password is rejected', async () => {
  const r = await call('POST', '/api/admin/login', { password: 'nope' }, { cookie: false });
  assert.equal(r.status, 401);
});

test('admin sees the booking, server-side estimate and consent record', async () => {
  const list = await signIn();
  assert.equal(list.length, 1);
  const b = list[0];
  const expected = Pricing.estimate({ type: 'standard', size: 'average', cond: 'normal', kitchen: 'standard', rooms: { bedroom: 2, bathroom: 1, living: 1 }, extras: ['oven'], freq: 'once' });
  assert.equal(b.estimate.low, expected.low);
  assert.equal(b.estimate.high, expected.high);
  assert.equal(b.contact.phone, '+2348012345678');
  assert.equal(b.consent.accepted, true);
  assert.equal(b.status, 'new');
});

test('admin can update status, final price and notes, and export CSV', async () => {
  const id = (await signIn())[0].id;
  let r = await call('PATCH', '/api/admin/bookings/' + id, { status: 'confirmed', finalPrice: 32000, notes: '=cmd|calc' });
  assert.equal(r.status, 200); assert.equal(r.data.booking.status, 'confirmed'); assert.equal(r.data.booking.finalPrice, 32000);
  r = await call('PATCH', '/api/admin/bookings/' + id, { status: 'bogus' });
  assert.equal(r.status, 422);
  const csv = await call('GET', '/api/admin/bookings.csv');
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.ok(csv.text.includes("\"'=cmd|calc\""), 'formula injection is neutralised');
  const s = await call('GET', '/api/admin/summary');
  assert.equal(s.data.counts.confirmed, 1);
});

test('feedback stays hidden until approved, and only with permission', async () => {
  let r = await call('POST', '/api/feedback', { rating: 0 });
  assert.equal(r.status, 422);
  await call('POST', '/api/feedback', { rating: 5, text: 'Lovely job', name: 'Ada', tags: ['On time', 'Bogus'], allowPublic: true });
  await call('POST', '/api/feedback', { rating: 2, text: 'Private note', allowPublic: false });
  assert.deepEqual((await call('GET', '/api/public')).data.reviews, []);
  const list = (await call('GET', '/api/admin/feedback')).data.feedback;
  assert.equal(list.length, 2);
  const yes = list.find((f) => f.allowPublic), no = list.find((f) => !f.allowPublic);
  assert.deepEqual(yes.tags, ['On time']);
  r = await call('PATCH', '/api/admin/feedback/' + no.id, { status: 'published' });
  assert.equal(r.status, 409);
  r = await call('PATCH', '/api/admin/feedback/' + yes.id, { status: 'published' });
  assert.equal(r.status, 200);
  const pub = (await call('GET', '/api/public')).data.reviews;
  assert.equal(pub.length, 1); assert.equal(pub[0].text, 'Lovely job');
});

test('projects: create, validate, publish, and only published show publicly', async () => {
  let r = await call('POST', '/api/admin/projects', { title: 'x' });
  assert.equal(r.status, 422);
  r = await call('POST', '/api/admin/projects', { title: '3-bedroom flat deep clean', date: '2026-09-01', service: 'Deep cleaning', published: false, photo: 'http://evil.example/x.jpg' });
  assert.equal(r.status, 201); assert.equal(r.data.project.photo, '', 'external image URLs are dropped');
  assert.deepEqual((await call('GET', '/api/public')).data.projects, []);
  const id = r.data.project.id;
  r = await call('PUT', '/api/admin/projects/' + id, { title: '3-bedroom flat deep clean', date: '2026-09-01', published: true });
  assert.equal(r.status, 200);
  assert.equal((await call('GET', '/api/public')).data.projects.length, 1);
  r = await call('DELETE', '/api/admin/projects/' + id);
  assert.equal(r.status, 200);
});

test('photo upload checks the real file type', async () => {
  const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(40)]);
  let r = await call('POST', '/api/admin/upload', { data: 'data:image/png;base64,' + png.toString('base64') });
  assert.equal(r.status, 201); assert.match(r.data.url, /^\/uploads\/[a-f0-9]{16}\.png$/);
  const img = await call('GET', r.data.url);
  assert.equal(img.status, 200);
  const fake = Buffer.from('<script>alert(1)</script>' + ' '.repeat(30));
  r = await call('POST', '/api/admin/upload', { data: 'data:image/png;base64,' + fake.toString('base64') });
  assert.equal(r.status, 422);
  r = await call('POST', '/api/admin/upload', { data: 'data:text/html;base64,PGI+' });
  assert.equal(r.status, 422);
});

test('settings: phone is normalised and hours are validated', async () => {
  const cur = (await call('GET', '/api/admin/settings')).data.settings;
  let r = await call('PUT', '/api/admin/settings', { ...cur, phone: '0708 759 6696' });
  assert.equal(r.status, 200);
  assert.equal(r.data.settings.phone, '+2347087596696');
  assert.equal(r.data.settings.whatsapp, '2347087596696');
  assert.equal(r.data.settings.phoneDisplay, '+234 708 759 6696');
  r = await call('PUT', '/api/admin/settings', { ...cur, hours: { open: '19:00', close: '07:00', days: cur.hours.days } });
  assert.equal(r.status, 422);
  r = await call('PUT', '/api/admin/settings', { ...cur, hours: { ...cur.hours, days: [false, false, false, false, false, false, false] } });
  assert.equal(r.status, 422);
  r = await call('PUT', '/api/admin/settings', { ...cur, acceptingBookings: false });
  assert.equal(r.status, 200);
  const blocked = await call('POST', '/api/bookings', validBooking());
  assert.equal(blocked.status, 503);
  await call('PUT', '/api/admin/settings', { ...cur, acceptingBookings: true });
});

test('non-JSON and oversized bodies are refused', async () => {
  const res = await fetch(base + '/api/bookings', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hi' });
  assert.equal(res.status, 415);
});

test('cross-site requests to admin endpoints are blocked', async () => {
  const res = await fetch(base + '/api/admin/logout', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json', Cookie: cookie }, body: '{}' });
  assert.equal(res.status, 403);
});

test('sign out ends the session', async () => {
  const out = await call('POST', '/api/admin/logout', {});
  assert.equal(out.status, 200);
  cookie = '';
  assert.equal((await call('GET', '/api/admin/bookings')).status, 401);
});
