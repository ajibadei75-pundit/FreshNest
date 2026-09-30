'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { createStore, newId } = require('./store');
const auth = require('./auth');
const V = require('./validate');
const H = require('./http');
const Pricing = require('../public/js/pricing.js');
const Hours = require('../public/js/hours.js');
const { createNotifier } = require('./notify');
const { createBackups } = require('./backup');
const VERSION = require('../package.json').version;

const BOOKING_STATUS = ['new', 'confirmed', 'completed', 'cancelled'];
const FEEDBACK_STATUS = ['pending', 'published', 'hidden'];
const SESSION_MS = 12 * 60 * 60 * 1000;
const COOKIE = 'fn_admin';

function createApp(opts) {
  const publicDir = path.resolve(opts.publicDir);
  const store = createStore(path.resolve(opts.dataDir));
  store.load();
  const db = store.data;
  const uploadsDir = path.join(store.dir, 'uploads');

  /* ---- Admin password: the ADMIN_PASSWORD variable wins; otherwise one is generated on first run ---- */
  const envPassword = process.env.ADMIN_PASSWORD || '';
  let generatedPassword = null;
  if (envPassword) {
    if (!auth.verifyPassword(envPassword, db.meta.adminHash)) { db.meta.adminHash = auth.hashPassword(envPassword); store.save(); }
  } else if (!db.meta.adminHash) {
    generatedPassword = crypto.randomBytes(9).toString('base64url');
    db.meta.adminHash = auth.hashPassword(generatedPassword); store.save();
  }

  const loginLimit = auth.limiter(8, 15 * 60 * 1000);
  const bookingAttempts = auth.limiter(40, 60 * 60 * 1000);   /* every request, valid or not */
  const bookingLimit = auth.limiter(6, 60 * 60 * 1000);       /* only bookings that pass validation */
  const feedbackLimit = auth.limiter(6, 60 * 60 * 1000);
  /* Behind a host or proxy every request arrives from the proxy's address, so we must read the visitor's IP from
     X-Forwarded-For. TRUST_PROXY=N means "N proxies sit in front of the app" and we take the Nth address from the
     right, which a visitor cannot fake. Unset means: on for known hosts (Render, Railway, Fly, Koyeb, Heroku), off otherwise. */
  const HOSTED = ['RENDER', 'RAILWAY_ENVIRONMENT', 'FLY_APP_NAME', 'KOYEB_APP_NAME', 'DYNO'].some(function (k) { return !!process.env[k]; });
  const proxyHops = process.env.TRUST_PROXY === undefined || process.env.TRUST_PROXY === '' ? (HOSTED ? 1 : 0) : Math.max(0, parseInt(process.env.TRUST_PROXY, 10) || 0);
  const publicUrl = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');

  function clientIp(req) {
    if (proxyHops > 0) {
      const parts = String(req.headers['x-forwarded-for'] || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      if (parts.length) return parts[Math.max(0, parts.length - proxyHops)];
    }
    return req.socket.remoteAddress || 'unknown';
  }
  function isSecure(req) { return !!req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '') === 'https' || process.env.COOKIE_SECURE === '1'; }
  function sameOrigin(req) {
    const o = req.headers.origin; if (!o) return true;
    try { return new URL(o).host === req.headers.host; } catch (e) { return false; }
  }
  function sessionOf(req) {
    const t = auth.parseCookies(req.headers.cookie)[COOKIE];
    const p = auth.readToken(t, db.meta.secret);
    return p && p.v === db.meta.adminHash.slice(-16) ? p : null;
  }
  function setCookie(req, res, value, maxAgeSec) {
    res.setHeader('Set-Cookie', COOKIE + '=' + value + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + maxAgeSec + (isSecure(req) ? '; Secure' : ''));
  }

  const notifier = createNotifier(process.env, console);
  const backups = createBackups(store, { log: console });
  const adminLink = publicUrl ? '\n\nOpen in admin: ' + publicUrl + '/admin/#bookings' : '';
  function notify(title, text) { notifier.notify(title, text).catch(function () { /* already logged */ }); }

  function makeRef() {
    const d = V.lagosDate(0).replace(/-/g, '').slice(2);
    for (let i = 0; i < 20; i++) {
      const ref = 'FN-' + d + '-' + crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
      if (!db.bookings.some(function (b) { return b.ref === ref; })) return ref;
    }
    return 'FN-' + d + '-' + Date.now().toString(36).toUpperCase().slice(-5);
  }

  /* ---- Route table ---- */
  const routes = [];
  function add(method, pattern, admin, handler) { routes.push({ method: method, re: new RegExp('^' + pattern + '$'), admin: admin, handler: handler }); }
  const now = () => new Date().toISOString();

  /* Public */
  add('GET', '/api/health', false, function (c) { c.json(200, { ok: true, version: VERSION, uptime: Math.round(process.uptime()) }); });

  add('GET', '/api/public', false, function (c) {
    const s = db.settings;
    c.json(200, {
      settings: { name: s.name, phone: s.phone, phoneDisplay: s.phoneDisplay, whatsapp: s.whatsapp, email: s.email, hours: s.hours, acceptingBookings: s.acceptingBookings, announcement: s.announcement, replyNote: s.replyNote },
      reviews: db.feedback.filter(function (f) { return f.status === 'published'; })
        .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; })
        .map(function (f) { return { name: f.name || 'A customer', meta: f.service || '', rating: f.rating, text: f.text || (f.tags.length ? f.tags.join(', ') + '.' : ''), date: f.createdAt }; }),
      projects: db.projects.filter(function (p) { return p.published; })
        .sort(function (a, b) { return a.date < b.date ? 1 : -1; })
        .map(function (p) { const o = Object.assign({}, p); delete o.published; return o; })
    }, { 'Cache-Control': 'no-cache' });
  });

  add('POST', '/api/bookings', false, async function (c) {
    if (!bookingAttempts.hit(c.ip)) return c.json(429, { error: 'Too many requests from your connection. Please wait a little, or call or WhatsApp us.' });
    const body = await c.body();
    if (body.website) return c.json(201, { ok: true, ref: 'FN-000000-0000' });        /* honeypot: bots fill hidden fields */
    if (!db.settings.acceptingBookings) return c.json(503, { error: 'We are not taking online bookings right now. Please call or message us on WhatsApp.' });
    const v = V.validateBooking(body);
    if (!v.ok) return c.json(422, { error: v.error, field: v.field });
    if (!bookingLimit.hit(c.ip)) return c.json(429, { error: 'You have sent several bookings in a short time. Please call or WhatsApp us to add more.' });
    const x = v.value, ref = makeRef();
    db.bookings.push({
      id: newId(), ref: ref, createdAt: now(), updatedAt: now(), status: 'new',
      sel: x.sel, details: x.details, contact: x.contact, estimate: x.estimate, message: x.message,
      consent: { accepted: true, at: now(), version: x.consentVersion || Pricing.RULES.termsVersion, ipHash: crypto.createHash('sha256').update(c.ip + db.meta.secret).digest('hex').slice(0, 16) },
      finalPrice: null, notes: ''
    });
    await store.save();
    notify('New booking ' + ref, [x.estimate.label + ', ' + x.details.date + ' (' + (x.details.slot === 'any' ? 'any time' : x.details.slot) + ')',
      x.contact.name + ', ' + x.contact.phone + (x.contact.email ? ', ' + x.contact.email : '') + ', prefers ' + x.contact.pref,
      x.details.street + ', ' + x.details.cityState,
      'Estimate ' + Pricing.fmt(x.estimate.low) + ' to ' + Pricing.fmt(x.estimate.high)].join('\n') + adminLink);
    c.json(201, { ok: true, ref: ref });
  });

  add('POST', '/api/feedback', false, async function (c) {
    if (!feedbackLimit.hit(c.ip)) return c.json(429, { error: 'Too many requests from your connection. Please try again later.' });
    const body = await c.body();
    if (body.website) return c.json(201, { ok: true });
    const v = V.validateFeedback(body);
    if (!v.ok) return c.json(422, { error: v.error, field: v.field });
    db.feedback.push(Object.assign({ id: newId(), createdAt: now(), status: 'pending' }, v.value));
    await store.save();
    notify('New feedback: ' + v.value.rating + ' out of 5', (v.value.text || '(no comment)') + (v.value.name ? '\n' + v.value.name : '') + (v.value.allowPublic ? '\nAllowed to publish' : '\nPrivate') + (publicUrl ? '\n\nReview in admin: ' + publicUrl + '/admin/#reviews' : ''));
    c.json(201, { ok: true });
  });

  /* Admin: session */
  add('POST', '/api/admin/login', false, async function (c) {
    if (!loginLimit.hit(c.ip)) return c.json(429, { error: 'Too many sign-in attempts. Try again in 15 minutes.' });
    const body = await c.body();
    if (!auth.verifyPassword(String(body.password || ''), db.meta.adminHash)) return c.json(401, { error: 'That password is not right.' });
    loginLimit.reset(c.ip);
    setCookie(c.req, c.res, auth.makeToken({ exp: Date.now() + SESSION_MS, v: db.meta.adminHash.slice(-16) }, db.meta.secret), SESSION_MS / 1000);
    c.json(200, { ok: true });
  });
  add('POST', '/api/admin/logout', false, function (c) { setCookie(c.req, c.res, '', 0); c.json(200, { ok: true }); });
  add('GET', '/api/admin/session', false, function (c) { c.json(200, { authenticated: !!sessionOf(c.req), passwordManagedByEnv: !!envPassword }); });

  add('POST', '/api/admin/password', true, async function (c) {
    if (envPassword) return c.json(409, { error: 'The password is set by the ADMIN_PASSWORD variable on the server. Change it there.' });
    const b = await c.body();
    if (!auth.verifyPassword(String(b.current || ''), db.meta.adminHash)) return c.json(401, { error: 'Your current password is not right.', field: 'current' });
    const next = String(b.next || '');
    if (next.length < 10) return c.json(422, { error: 'Use at least 10 characters.', field: 'next' });
    db.meta.adminHash = auth.hashPassword(next); await store.save();
    setCookie(c.req, c.res, auth.makeToken({ exp: Date.now() + SESSION_MS, v: db.meta.adminHash.slice(-16) }, db.meta.secret), SESSION_MS / 1000);
    c.json(200, { ok: true });
  });

  /* Admin: overview */
  add('GET', '/api/admin/summary', true, function (c) {
    const today = V.lagosDate(0), monthStart = today.slice(0, 8) + '01';
    const count = function (st) { return db.bookings.filter(function (b) { return b.status === st; }).length; };
    const published = db.feedback.filter(function (f) { return f.status === 'published'; });
    const upcoming = db.bookings.filter(function (b) { return (b.status === 'new' || b.status === 'confirmed') && b.details.date >= today; })
      .sort(function (a, b) { return a.details.date < b.details.date ? -1 : 1; }).slice(0, 6);
    c.json(200, {
      today: today, counts: { new: count('new'), confirmed: count('confirmed'), completed: count('completed'), cancelled: count('cancelled') },
      thisMonth: db.bookings.filter(function (b) { return b.createdAt.slice(0, 10) >= monthStart; }).length,
      pendingReviews: db.feedback.filter(function (f) { return f.status === 'pending'; }).length,
      avgRating: published.length ? Math.round(published.reduce(function (a, f) { return a + f.rating; }, 0) / published.length * 10) / 10 : null,
      publishedReviews: published.length, upcoming: upcoming,
      latest: db.bookings.slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; }).slice(0, 5)
    });
  });

  /* Admin: bookings */
  add('GET', '/api/admin/bookings', true, function (c) {
    const st = c.query.get('status') || '', q = (c.query.get('q') || '').toLowerCase().trim();
    const list = db.bookings.filter(function (b) {
      if (st && b.status !== st) return false;
      if (!q) return true;
      return [b.ref, b.contact.name, b.contact.phone, b.contact.email, b.details.street, b.details.cityState, b.estimate.label].join(' ').toLowerCase().indexOf(q) > -1;
    }).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    c.json(200, { bookings: list });
  });

  add('PATCH', '/api/admin/bookings/([a-f0-9]+)', true, async function (c) {
    const b = db.bookings.find(function (x) { return x.id === c.params[0]; });
    if (!b) return c.json(404, { error: 'That booking no longer exists.' });
    const body = await c.body();
    if (body.status !== undefined) { if (BOOKING_STATUS.indexOf(body.status) < 0) return c.json(422, { error: 'Unknown status.' }); b.status = body.status; }
    if (body.finalPrice !== undefined) {
      if (body.finalPrice === null || body.finalPrice === '') b.finalPrice = null;
      else { const n = Math.round(Number(body.finalPrice)); if (!(n >= 0 && n <= 1e8)) return c.json(422, { error: 'Enter the final price in naira.' }); b.finalPrice = n; }
    }
    if (body.notes !== undefined) b.notes = V.str(body.notes, 2000);
    b.updatedAt = now(); await store.save();
    c.json(200, { booking: b });
  });

  add('DELETE', '/api/admin/bookings/([a-f0-9]+)', true, async function (c) {
    const i = db.bookings.findIndex(function (x) { return x.id === c.params[0]; });
    if (i < 0) return c.json(404, { error: 'That booking no longer exists.' });
    db.bookings.splice(i, 1); await store.save(); c.json(200, { ok: true });
  });

  add('GET', '/api/admin/bookings.csv', true, function (c) {
    const cell = function (v) { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    const rows = [['Reference', 'Received', 'Status', 'Name', 'Phone', 'Email', 'Service', 'Visit date', 'Time', 'Address', 'Estimate low', 'Estimate high', 'Final price', 'Notes']];
    db.bookings.slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; }).forEach(function (b) {
      rows.push([b.ref, b.createdAt, b.status, b.contact.name, b.contact.phone, b.contact.email, b.estimate.label, b.details.date, b.details.slot,
        b.details.street + ', ' + b.details.cityState, b.estimate.low, b.estimate.high, b.finalPrice == null ? '' : b.finalPrice, b.notes]);
    });
    H.send(c.res, 200, '\uFEFF' + rows.map(function (r) { return r.map(cell).join(','); }).join('\r\n'),
      { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="freshnest-bookings-' + V.lagosDate(0) + '.csv"', 'Cache-Control': 'no-store' });
  });

  /* Admin: feedback */
  add('GET', '/api/admin/feedback', true, function (c) {
    c.json(200, { feedback: db.feedback.slice().sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; }) });
  });
  add('PATCH', '/api/admin/feedback/([a-f0-9]+)', true, async function (c) {
    const f = db.feedback.find(function (x) { return x.id === c.params[0]; });
    if (!f) return c.json(404, { error: 'That feedback no longer exists.' });
    const body = await c.body();
    if (FEEDBACK_STATUS.indexOf(body.status) < 0) return c.json(422, { error: 'Unknown status.' });
    if (body.status === 'published' && !f.allowPublic) return c.json(409, { error: 'This customer did not allow their review to be shown on the website.' });
    f.status = body.status; await store.save(); c.json(200, { feedback: f });
  });
  add('DELETE', '/api/admin/feedback/([a-f0-9]+)', true, async function (c) {
    const i = db.feedback.findIndex(function (x) { return x.id === c.params[0]; });
    if (i < 0) return c.json(404, { error: 'That feedback no longer exists.' });
    db.feedback.splice(i, 1); await store.save(); c.json(200, { ok: true });
  });

  /* Admin: projects (the "Our work" section) */
  add('GET', '/api/admin/projects', true, function (c) {
    c.json(200, { projects: db.projects.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }) });
  });
  add('POST', '/api/admin/projects', true, async function (c) {
    const v = V.validateProject(await c.body());
    if (!v.ok) return c.json(422, { error: v.error, field: v.field });
    const p = Object.assign({ id: newId(), createdAt: now() }, v.value);
    db.projects.push(p); await store.save(); c.json(201, { project: p });
  });
  add('PUT', '/api/admin/projects/([a-f0-9]+)', true, async function (c) {
    const p = db.projects.find(function (x) { return x.id === c.params[0]; });
    if (!p) return c.json(404, { error: 'That project no longer exists.' });
    const v = V.validateProject(await c.body());
    if (!v.ok) return c.json(422, { error: v.error, field: v.field });
    Object.assign(p, v.value); await store.save(); c.json(200, { project: p });
  });
  add('DELETE', '/api/admin/projects/([a-f0-9]+)', true, async function (c) {
    const i = db.projects.findIndex(function (x) { return x.id === c.params[0]; });
    if (i < 0) return c.json(404, { error: 'That project no longer exists.' });
    db.projects.splice(i, 1); await store.save(); c.json(200, { ok: true });
  });

  add('POST', '/api/admin/upload', true, async function (c) {
    const body = await c.body(4 * 1024 * 1024);
    const m = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data || ''));
    if (!m) return c.json(422, { error: 'Choose a JPG, PNG or WebP photo.' });
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length > 3 * 1024 * 1024) return c.json(413, { error: 'That photo is over 3 MB. Choose a smaller one.' });
    let ext = '';
    if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ext = '.jpg';
    else if (buf.length > 12 && buf.slice(0, 4).toString('hex') === '89504e47') ext = '.png';
    else if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') ext = '.webp';
    if (!ext) return c.json(422, { error: 'That file is not a valid photo.' });
    const name = crypto.randomBytes(8).toString('hex') + ext;
    await fs.promises.writeFile(path.join(uploadsDir, name), buf);
    c.json(201, { url: '/uploads/' + name });
  });

  /* Admin: connections, backups */
  add('GET', '/api/admin/system', true, function (c) {
    const b = backups.list();
    c.json(200, { version: VERSION, node: process.version, uptime: Math.round(process.uptime()), publicUrl: publicUrl, production: process.env.NODE_ENV === 'production',
      notify: notifier.status(), backups: { count: b.length, latest: b[0] || null }, passwordManagedByEnv: !!envPassword, proxyHops: proxyHops });
  });
  add('POST', '/api/admin/system/test-notify', true, async function (c) {
    if (!notifier.channels.length) return c.json(409, { error: 'No alert channel is set up yet. See the README to turn on email, Telegram or ntfy alerts.' });
    const results = await notifier.notify('FreshNest test alert', 'This is a test from the admin page. If you can read this, new booking alerts will reach you.');
    c.json(200, { results: results });
  });
  add('GET', '/api/admin/backup', true, function (c) {
    const copy = JSON.parse(JSON.stringify(db)); copy.meta = { createdAt: copy.meta.createdAt, exportedAt: now() };     /* no password hash or signing secret in downloads */
    H.send(c.res, 200, JSON.stringify(copy, null, 2), { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="freshnest-backup-' + V.lagosDate(0) + '.json"', 'Cache-Control': 'no-store' });
  });

  /* Admin: settings */
  add('GET', '/api/admin/settings', true, function (c) { c.json(200, { settings: db.settings }); });
  add('PUT', '/api/admin/settings', true, async function (c) {
    const v = V.validateSettings(await c.body());
    if (!v.ok) return c.json(422, { error: v.error, field: v.field });
    db.settings = v.value; await store.save(); c.json(200, { settings: db.settings });
  });

  /* ---- Static files ---- */
  async function serveStatic(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return H.send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD', 'Content-Type': 'text/plain' });
    if (pathname === '/admin') return H.send(res, 301, '', { Location: '/admin/' });
    if (pathname === '/' || pathname === '/index.html') return serveHome(req, res);
    if (pathname === '/robots.txt') return H.send(res, 200, 'User-agent: *\nDisallow: /admin/\nDisallow: /api/\n' + (publicUrl ? '\nSitemap: ' + publicUrl + '/sitemap.xml\n' : ''), { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
    if (pathname === '/sitemap.xml' && publicUrl) return H.send(res, 200, '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + publicUrl + '/</loc></url></urlset>\n', { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-cache' });
    if (pathname.startsWith('/uploads/')) {
      const file = /^\/uploads\/[a-f0-9]{16}\.(jpg|png|webp)$/.test(pathname) ? path.join(uploadsDir, path.basename(pathname)) : null;
      if (file && await H.serveFile(req, res, file, { immutable: true })) return;
      return notFound(res);
    }
    if (pathname.split('/').some(function (seg) { return seg.startsWith('.'); })) return notFound(res);
    const full = H.safeJoin(publicDir, pathname === '/' ? '/index.html' : pathname);
    if (!full) return H.send(res, 400, 'Bad request', { 'Content-Type': 'text/plain' });
    if (await H.serveFile(req, res, full)) return;
    notFound(res);
  }
  /* The home page is built from the live settings, so search engines see the same phone number and hours the owner set in admin. */
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  async function serveHome(req, res) {
    let html;
    try { html = await fs.promises.readFile(path.join(publicDir, 'index.html'), 'utf8'); } catch (e) { return notFound(res); }
    const s = db.settings;
    const ld = { '@context': 'https://schema.org', '@type': 'HomeAndConstructionBusiness', name: s.name, description: 'Home, office, deep, move-out and post-construction cleaning.', telephone: s.phone, email: s.email, areaServed: 'Nigeria',
      openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: Hours.ORDER.filter(function (d) { return s.hours.days[d]; }).map(function (d) { return DAY_NAMES[d]; }), opens: s.hours.open, closes: s.hours.close }] };
    if (publicUrl) ld.url = publicUrl + '/';
    html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>');
    if (publicUrl) html = html.replace('<link rel="icon"', '<link rel="canonical" href="' + publicUrl + '/">\n<meta property="og:url" content="' + publicUrl + '/">\n<link rel="icon"');
    H.sendPage(req, res, html);
  }
  function notFound(res) {
    H.send(res, 404, '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.25rem;line-height:1.6"><h1>We could not find that page</h1><p>Try the <a href="/">FreshNest home page</a>.</p>', { 'Content-Type': 'text/html; charset=utf-8' });
  }

  /* ---- Request handler ---- */
  async function handler(req, res) {
    H.setSecurity(res);
    if (isSecure(req)) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    if (pathname.startsWith('/api/') && pathname !== '/api/health' && process.env.LOG_REQUESTS !== 'off') {
      const t0 = Date.now();
      res.on('finish', function () { console.log(new Date().toISOString() + ' ' + req.method + ' ' + pathname + ' ' + res.statusCode + ' ' + (Date.now() - t0) + 'ms'); });
    }
    try {
      if (pathname.startsWith('/api/')) {
        res.setHeader('X-Robots-Tag', 'noindex');
        const route = routes.find(function (r) { return r.method === req.method && r.re.test(pathname); });
        if (!route) {
          const known = routes.some(function (r) { return r.re.test(pathname); });
          return H.json(res, known ? 405 : 404, { error: known ? 'Method not allowed.' : 'Not found.' });
        }
        if (req.method !== 'GET' && !sameOrigin(req)) return H.json(res, 403, { error: 'Request blocked.' });
        if (route.admin && !sessionOf(req)) return H.json(res, 401, { error: 'Please sign in again.' });
        const ctx = {
          req: req, res: res, ip: clientIp(req), query: url.searchParams, params: route.re.exec(pathname).slice(1),
          json: function (status, obj, headers) { H.json(res, status, obj, headers); },
          body: function (limit) { return H.readJson(req, limit); }
        };
        return await route.handler(ctx);
      }
      if (pathname.startsWith('/admin')) res.setHeader('X-Robots-Tag', 'noindex');
      await serveStatic(req, res, pathname);
    } catch (err) {
      if (res.headersSent) { res.destroy(); return; }
      if (err instanceof H.HttpError) return H.json(res, err.status, { error: err.message });
      console.error(err);
      H.json(res, 500, { error: 'Something went wrong on our side. Please try again, or call or WhatsApp us.' });
    }
  }

  return { handler: handler, store: store, backups: backups, notifier: notifier, generatedPassword: generatedPassword, passwordFromEnv: !!envPassword, publicUrl: publicUrl, proxyHops: proxyHops };
}

module.exports = { createApp };
