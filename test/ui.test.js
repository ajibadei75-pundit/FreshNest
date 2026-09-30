'use strict';
/* Loads the real public site and admin page from a real running server inside
   jsdom and drives them like a visitor and like the owner would.
   jsdom has no layout engine, so scrolling is simulated. Skipped if jsdom is not installed. */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let jsdom = null;
try { jsdom = require('jsdom'); } catch (e) { /* optional */ }
const skip = jsdom ? false : 'jsdom is not installed (npm install to enable UI tests)';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freshnest-ui-'));
process.env.ADMIN_PASSWORD = 'ui-test-password';
const { createApp } = require('../server/app');
const V = require('../server/validate');

let server, base, adminCookie = '';
const windows = [];

test.before(async () => {
  const app = createApp({ publicDir: path.join(__dirname, '..', 'public'), dataDir });
  server = http.createServer(app.handler);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
  const r = await fetch(base + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'ui-test-password' }) });
  adminCookie = r.headers.get('set-cookie').split(';')[0];
});
test.after(() => { windows.forEach((w) => { try { w.close(); } catch (e) { /* ignore */ } }); server.closeAllConnections && server.closeAllConnections(); server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

async function admin(method, url, body) {
  const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms = 3000, what = 'condition') {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { if (fn()) return; } catch (e) { /* keep waiting */ } await wait(20); }
  throw new Error('Timed out waiting for ' + what);
}

async function openPage(pathname) {
  const { JSDOM, VirtualConsole, requestInterceptor } = jsdom, errors = [], jar = { cookie: '' };
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message + (e.detail ? ' ' + e.detail : '')));
  vc.on('error', (m) => errors.push(String(m)));
  /* Only our own scripts are loaded. Stylesheets and fonts are not needed here (there is no layout engine). */
  const resources = {
    interceptors: [requestInterceptor((request) => {
      if (request.url.startsWith(base) && /\.js(\?|$)/.test(request.url)) return undefined;
      if (request.url.startsWith(base) && !/\.(css|svg)(\?|$)/.test(request.url)) return undefined;   /* the page itself and API calls */
      return new Response('', { headers: { 'Content-Type': 'text/css' } });
    })]
  };
  const dom = await JSDOM.fromURL(base + pathname, {
    runScripts: 'dangerously', resources, pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = function () {};
      w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
      w.HTMLDialogElement.prototype.close = function () { if (!this.hasAttribute('open')) return; this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };
      w.fetch = (u, o = {}) => {
        const headers = Object.assign({}, o.headers); if (jar.cookie) headers.Cookie = jar.cookie;
        return fetch(new URL(u, base), Object.assign({}, o, { headers })).then((r) => {
          const sc = r.headers.get('set-cookie');
          if (sc) jar.cookie = /fn_admin=;/.test(sc) ? '' : sc.split(';')[0];
          return r;
        });
      };
    }
  });
  windows.push(dom.window);
  if (dom.window.document.readyState !== 'complete') await new Promise((r) => dom.window.addEventListener('load', r));
  return { window: dom.window, document: dom.window.document, errors, $: (id) => dom.window.document.getElementById(id) };
}
function click(w, el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); }
function type(w, el, value) { el.value = value; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); }
function isoIn(days) { return V.lagosDate(days); }

/* ------------------------------------------------------------------ public site */
test('site loads without script errors and shows live opening status', { skip }, async () => {
  const p = await openPage('/');
  await waitFor(() => p.window.FN && p.window.FN.api, 3000, 'settings from /api/public');
  assert.deepEqual(p.errors, [], 'no script errors');
  assert.match(p.$('statusText').textContent, /^(Open now|Closed now)$/);
  assert.ok(p.$('statusDetail').textContent.length > 0);
  const hours = p.document.querySelector('[data-s="hoursText"]').textContent;
  assert.equal(hours, 'Every day, 7am to 7pm');
  assert.match(p.document.querySelector('h1').textContent, /A clean you can see\./);
  assert.equal(p.document.querySelectorAll('.hero h1 em').length, 0, 'no single-word accent in the headline');
});

test('sample work and sample reviews are gone; tips remain; filters hidden until real projects exist', { skip }, async () => {
  const p = await openPage('/');
  await waitFor(() => p.window.FN.api);
  assert.ok(!/sample/i.test(p.document.body.textContent), 'no "sample" content on the page');
  assert.equal(p.document.querySelectorAll('#posts .post').length, 3, 'three cleaning tips');
  assert.equal(p.$('filters').hidden, true);
  assert.equal(p.$('workTitle').textContent, 'Cleaning tips');
  assert.ok(p.document.querySelector('#reviewList .empty'), 'honest empty state for reviews');
  assert.ok(p.document.querySelectorAll('.faq details').length >= 18, 'full FAQ');
  assert.ok(p.document.querySelector('[data-s="phoneDisplay"]').textContent.includes('+234'));
});

test('booking: consent unlocks only after the terms are read, then the booking is saved', { skip }, async () => {
  const p = await openPage('/'), w = p.window;
  await waitFor(() => w.FN.api);
  const $ = p.$;

  /* walk through the steps */
  click(w, $('nextBtn')); click(w, $('nextBtn')); click(w, $('nextBtn'));
  assert.equal($('nextBtn').hidden, false);
  click(w, $('nextBtn'));                                              /* step 4 needs date and address */
  assert.match($('dateErr').textContent, /Choose the date/);
  assert.match($('streetErr').textContent, /street address/);
  type(w, $('date'), isoIn(4)); type(w, $('street'), '12 Example Street'); type(w, $('cityState'), 'Ibadan, Oyo');
  click(w, $('nextBtn'));
  assert.equal($('nextBtn').hidden, true, 'now on the last step');

  /* the terms box: pretend it is 230px tall with 1000px of text */
  const terms = $('terms'); let top = 0;
  Object.defineProperty(terms, 'clientHeight', { get: () => 230 });
  Object.defineProperty(terms, 'scrollHeight', { get: () => 1000 });
  Object.defineProperty(terms, 'scrollTop', { get: () => top, set: (v) => { top = v; }, configurable: true });
  const scrollTo = (v) => { top = v; terms.dispatchEvent(new w.Event('scroll')); };

  assert.equal($('consent').disabled, true, 'locked at the start');
  click(w, $('consentLine'));
  assert.match($('consentErr').textContent, /read the terms to the end/i, 'clicking the locked box explains why');
  scrollTo(300);
  assert.equal($('consent').disabled, true, 'still locked halfway');
  assert.match($('readText').textContent, /\d+% read/);
  scrollTo(400);
  assert.equal($('consent').disabled, true);
  scrollTo(770);                                                       /* 770 = bottom (1000 - 230) */
  assert.equal($('consent').disabled, false, 'unlocked at the bottom');
  assert.ok($('consentBox').classList.contains('is-read'));
  scrollTo(0);
  assert.equal($('consent').disabled, false, 'stays unlocked once read');

  /* contact details, then try to send without ticking */
  type(w, $('name'), 'Ada Obi'); type(w, $('phone'), '0801 234 5678'); type(w, $('email'), 'ada@example.com');
  click(w, $('sendEmail'));
  await wait(50);
  assert.match($('consentErr').textContent, /tick the box/i);
  assert.equal($('success').hidden, true, 'nothing was sent');
  assert.equal((await admin('GET', '/api/admin/bookings')).data.bookings.length, 0, 'server has no booking yet');

  /* tick and send */
  $('consent').checked = true; $('consent').dispatchEvent(new w.Event('change', { bubbles: true }));
  click(w, $('sendEmail'));
  await waitFor(() => !$('success').hidden, 3000, 'success view');
  assert.match($('refCode').textContent, /^FN-\d{6}-[0-9A-F]{4}$/);
  assert.match($('successText').textContent, /Every day|every day/);
  assert.deepEqual(p.errors, []);

  const saved = (await admin('GET', '/api/admin/bookings')).data.bookings;
  assert.equal(saved.length, 1);
  assert.equal(saved[0].ref, $('refCode').textContent);
  assert.equal(saved[0].contact.phone, '+2348012345678');
  assert.equal(saved[0].details.street, '12 Example Street');
  assert.equal(saved[0].consent.accepted, true);
  assert.equal(saved[0].details.date, isoIn(4));
});

test('short terms unlock at once, and paused bookings disable sending', { skip }, async () => {
  const p = await openPage('/'), w = p.window; await waitFor(() => w.FN.api);
  const $ = p.$;
  click(w, $('nextBtn')); click(w, $('nextBtn')); click(w, $('nextBtn'));
  type(w, $('date'), isoIn(4)); type(w, $('street'), '12 Example Street'); type(w, $('cityState'), 'Ibadan');
  click(w, $('nextBtn'));
  const terms = $('terms');
  Object.defineProperty(terms, 'clientHeight', { get: () => 100 }); Object.defineProperty(terms, 'scrollHeight', { get: () => 100 });
  terms.dispatchEvent(new w.Event('scroll'));
  assert.equal($('consent').disabled, false, 'short terms that need no scrolling unlock straight away');
  type(w, $('name'), 'Bo'); type(w, $('phone'), '08012345678'); $('consent').checked = true;
  /* client-side validation passes, then the server says the phone is fine: sanity-check the 429/503 path with bookings paused */
  await admin('PUT', '/api/admin/settings', Object.assign({}, (await admin('GET', '/api/admin/settings')).data.settings, { acceptingBookings: false }));
  const p2 = await openPage('/'); await waitFor(() => p2.window.FN.api);
  assert.equal(p2.$('closedNotice').hidden, false, 'closed notice is shown when bookings are paused');
  assert.equal(p2.$('sendEmail').disabled, true, 'send button disabled when bookings are paused');
  await admin('PUT', '/api/admin/settings', Object.assign({}, (await admin('GET', '/api/admin/settings')).data.settings, { acceptingBookings: true }));
});

test('admin-published projects, reviews and announcements appear on the site', { skip }, async () => {
  const s = (await admin('GET', '/api/admin/settings')).data.settings;
  await admin('PUT', '/api/admin/settings', Object.assign({}, s, { announcement: 'Open on all public holidays' }));
  const proj = await admin('POST', '/api/admin/projects', { title: 'Ring Road office clean', service: 'Office cleaning', date: '2026-09-20', excerpt: 'Weekly evening clean.', published: true });
  assert.equal(proj.status, 201);
  const fb = await fetch(base + '/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating: 5, text: 'Spotless flat, on time.', name: 'Tunde', service: 'Home cleaning', allowPublic: true }) });
  assert.equal(fb.status, 201);
  const id = (await admin('GET', '/api/admin/feedback')).data.feedback[0].id;
  await admin('PATCH', '/api/admin/feedback/' + id, { status: 'published' });

  const p = await openPage('/'); await waitFor(() => p.window.FN.api);
  assert.equal(p.$('announce').hidden, false);
  assert.equal(p.$('announce').textContent, 'Open on all public holidays');
  assert.equal(p.$('filters').hidden, false, 'filters appear once real work exists');
  assert.equal(p.$('workTitle').textContent, 'Our work and cleaning tips');
  assert.ok([...p.document.querySelectorAll('#posts .post h3')].some((h) => h.textContent === 'Ring Road office clean'));
  assert.equal(p.document.querySelector('#reviewList .empty'), null);
  assert.match(p.$('reviewList').textContent, /Spotless flat, on time\./);
  assert.match(p.$('reviewList').textContent, /Tunde/);
  click(p.window, p.document.querySelector('#filters [data-f="work"]'));
  assert.equal(p.document.querySelectorAll('#posts .post').length, 1);
});

test('feedback form sends to the server and waits for approval', { skip }, async () => {
  const p = await openPage('/'), w = p.window; await waitFor(() => w.FN.api);
  click(w, p.$('fbEmail'));
  assert.match(p.$('rateErr').textContent, /star rating/);
  click(w, p.$('r4')); type(w, p.$('fbText'), 'Good work'); type(w, p.$('fbName'), 'Ngozi');
  click(w, p.$('fbEmail'));
  await waitFor(() => !p.$('fbStatus').hidden, 3000, 'feedback status');
  assert.match(p.$('fbStatus').textContent, /Thank you/);
  const list = (await admin('GET', '/api/admin/feedback')).data.feedback;
  const mine = list.find((f) => f.name === 'Ngozi');
  assert.ok(mine); assert.equal(mine.status, 'pending'); assert.equal(mine.allowPublic, false);
  assert.match(p.$('reviewList').textContent, /Tunde/, 'only approved reviews are shown');
  assert.ok(!/Ngozi/.test(p.$('reviewList').textContent));
});

/* ------------------------------------------------------------------ admin page */
test('admin: sign in, see bookings, update one, add a project, change hours, sign out', { skip }, async () => {
  const p = await openPage('/admin/'), w = p.window, $ = p.$;
  await waitFor(() => !$('login').hidden, 3000, 'login screen');
  assert.equal($('app').hidden, true);

  type(w, $('password'), 'wrong password');
  $('loginForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => /not right/.test($('loginErr').textContent), 3000, 'wrong-password message');

  type(w, $('password'), 'ui-test-password');
  $('loginForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => !$('app').hidden && $('stats').children.length > 0, 4000, 'dashboard');
  assert.deepEqual(p.errors, []);
  assert.match($('cnt-bookings').textContent, /^1$/, 'new booking badge');
  assert.match($('stats').textContent, /New requests/);
  assert.match($('todayText').textContent, /The website shows/);
  assert.equal($('alertHint').hidden, false, 'overview warns that no alert channel is set up');
  assert.match($('systemBody').textContent, /No alert channel is set up/);
  assert.ok($('systemBody').querySelector('a[href="/api/admin/backup"]'), 'backup download link');

  /* bookings tab and detail dialog */
  click(w, $('tab-bookings'));
  assert.equal($('panel-bookings').hidden, false); assert.equal($('panel-overview').hidden, true);
  const row = p.document.querySelector('#bookingList .item');
  assert.ok(row); assert.match(row.textContent, /Ada Obi/);
  click(w, row);
  await waitFor(() => $('bookingDlg').hasAttribute('open'), 2000, 'booking dialog');
  const body = $('bookingBody').textContent;
  assert.match(body, /\+2348012345678/); assert.match(body, /12 Example Street/); assert.match(body, /Terms accepted/);
  assert.ok($('bookingBody').querySelector('a[href^="https://wa.me/2348012345678"]'), 'WhatsApp button');
  assert.ok($('bookingBody').querySelector('a[href^="tel:"]'), 'call button');
  $('bkStatus').value = 'confirmed'; type(w, $('bkPrice'), '32000'); type(w, $('bkNotes'), 'Gate code 4321');
  $('bkForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => !$('bookingDlg').hasAttribute('open'), 3000, 'dialog closes after save');
  let b = (await admin('GET', '/api/admin/bookings')).data.bookings[0];
  assert.equal(b.status, 'confirmed'); assert.equal(b.finalPrice, 32000); assert.equal(b.notes, 'Gate code 4321');
  await waitFor(() => $('cnt-bookings').hidden, 3000, 'badge clears');

  /* reviews: the private one cannot be published */
  click(w, $('tab-reviews'));
  await waitFor(() => p.document.querySelector('#reviewList .rv'), 2000, 'review cards');
  const pending = p.document.querySelector('#reviewList .rv');
  assert.match(pending.textContent, /Ngozi/);
  assert.equal(pending.querySelector('[data-act="published"]').disabled, true, 'cannot publish a private review');

  /* projects: add one through the dialog */
  click(w, $('tab-projects'));
  click(w, $('addProject'));
  await waitFor(() => $('projectDlg').hasAttribute('open'), 2000, 'project dialog');
  type(w, $('pjName'), 'Bodija duplex deep clean'); type(w, $('pjDate'), '2026-09-25'); $('pjPub').checked = true;
  $('pjForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => !$('projectDlg').hasAttribute('open'), 3000, 'project saved');
  const projs = (await admin('GET', '/api/admin/projects')).data.projects;
  assert.ok(projs.some((x) => x.title === 'Bodija duplex deep clean' && x.published));

  /* settings: close on Sundays */
  click(w, $('tab-settings'));
  assert.match($('hoursPreview').textContent, /Every day, 7am to 7pm/);
  const sun = p.document.querySelector('#sDays input[data-day="0"]'); sun.checked = false; sun.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.match($('hoursPreview').textContent, /Mon to Sat, 7am to 7pm/);
  type(w, $('sPhone'), '0708 759 6696');
  $('settingsForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(async () => true, 10);
  await waitFor(() => /Settings saved/.test($('toast').textContent), 3000, 'settings toast');
  const s = (await admin('GET', '/api/admin/settings')).data.settings;
  assert.equal(s.hours.days[0], false); assert.equal(s.phoneDisplay, '+234 708 759 6696');

  /* the public site now says Mon to Sat */
  const site = await openPage('/'); await waitFor(() => site.window.FN.api);
  assert.equal(site.document.querySelector('[data-s="hoursText"]').textContent, 'Mon to Sat, 7am to 7pm');

  /* sign out */
  click(w, $('logoutBtn'));
  await waitFor(() => !$('login').hidden && $('app').hidden, 3000, 'back at login');
});
