'use strict';
/* Pre-flight check before going live:  npm run doctor
   Reads .env the same way the server does, then says in plain words what is ready and what is not.
   Add --live to also ask a running server (PUBLIC_URL, or http://localhost:PORT) to prove it is up. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
require('../server/env').loadEnv(path.join(root, '.env'));

const results = [];
const ok = (m) => results.push(['ok', m]);
const warn = (m) => results.push(['warn', m]);
const fail = (m) => results.push(['fail', m]);
const env = process.env;

/* Node */
const major = Number(process.versions.node.split('.')[0]);
major >= 18 ? ok('Node ' + process.versions.node) : fail('Node ' + process.versions.node + ' is too old. Install Node 18 or newer (22 recommended).');

/* Required for going live */
env.NODE_ENV === 'production' ? ok('NODE_ENV is production') : warn('NODE_ENV is not "production". Set NODE_ENV=production on the live server.');
if (!env.ADMIN_PASSWORD) warn('ADMIN_PASSWORD is not set. A random one is printed on first start; set your own so it survives a move or restore.');
else if (env.ADMIN_PASSWORD.length < 10) fail('ADMIN_PASSWORD is shorter than 10 characters.');
else if (/^(password|admin|12345|freshnest)/i.test(env.ADMIN_PASSWORD)) fail('ADMIN_PASSWORD is too easy to guess.');
else ok('ADMIN_PASSWORD is set');

if (!env.PUBLIC_URL) warn('PUBLIC_URL is not set (for example https://www.example.ng).');
else if (!/^https:\/\/[^/\s]+$/.test(env.PUBLIC_URL.replace(/\/+$/, ''))) fail('PUBLIC_URL must start with https:// and have no path: ' + env.PUBLIC_URL);
else ok('PUBLIC_URL is ' + env.PUBLIC_URL);

/* Data folder */
const dataDir = env.DATA_DIR || path.join(root, 'data');
if (!env.DATA_DIR) warn('DATA_DIR is not set, so data goes in ' + dataDir + '. On most hosts that is erased on every deploy.');
try {
  fs.mkdirSync(dataDir, { recursive: true }); const p = path.join(dataDir, '.doctor'); fs.writeFileSync(p, 'x'); fs.unlinkSync(p);
  ok('Data folder is writable: ' + dataDir);
} catch (e) { fail('Cannot write to the data folder ' + dataDir + ': ' + e.message); }

/* Proxy and cookies */
const hops = env.TRUST_PROXY === undefined || env.TRUST_PROXY === '' ? null : parseInt(env.TRUST_PROXY, 10);
if (hops === null) warn('TRUST_PROXY is not set. Hosts such as Render and Railway are detected automatically; on your own server behind Caddy or nginx set TRUST_PROXY=1.');
else if (hops === 0 && env.NODE_ENV === 'production') warn('TRUST_PROXY=0. If anything sits in front of the app, all visitors will share one booking limit.');
else ok('TRUST_PROXY=' + hops);
env.COOKIE_SECURE === '1' ? ok('COOKIE_SECURE=1') : warn('COOKIE_SECURE is not 1. Cookies are still marked Secure when the proxy says the request was HTTPS, but setting it is safer.');

/* Alerts */
const channels = [];
if (env.NOTIFY_URL) channels.push('ntfy');
if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) channels.push('telegram');
if (env.RESEND_API_KEY && env.NOTIFY_EMAIL) channels.push('email');
if (env.TELEGRAM_BOT_TOKEN && !env.TELEGRAM_CHAT_ID) fail('TELEGRAM_BOT_TOKEN is set but TELEGRAM_CHAT_ID is missing.');
if (env.RESEND_API_KEY && !env.NOTIFY_EMAIL) fail('RESEND_API_KEY is set but NOTIFY_EMAIL is missing.');
channels.length ? ok('Booking alerts: ' + channels.join(', ')) : warn('No booking alert channel is set, so you will not be told when a booking arrives. See .env.example.');

/* Content */
const Pricing = require('../public/js/pricing.js');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
ok('Terms version ' + Pricing.RULES.termsVersion);
if (/sample/i.test(html.replace(/<script[\s\S]*?<\/script>/g, ''))) warn('The word "sample" appears on the page.');
if (fs.existsSync(path.join(dataDir, 'db.json'))) {
  try { const db = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8')); ok('Existing data found: ' + db.bookings.length + ' bookings, ' + db.projects.length + ' projects'); }
  catch (e) { fail('db.json exists but cannot be read: ' + e.message); }
} else ok('No data yet: a fresh database is created on first start');

/* Optional live check */
async function live() {
  if (!process.argv.includes('--live')) return;
  const base = (env.PUBLIC_URL || 'http://localhost:' + (env.PORT || 3000)).replace(/\/+$/, '');
  try {
    const r = await fetch(base + '/api/health'), d = await r.json();
    r.ok && d.ok ? ok('Live server answers at ' + base + ' (version ' + d.version + ')') : fail('Live server at ' + base + ' answered ' + r.status);
    const home = await fetch(base + '/'); home.ok ? ok('Home page loads (' + home.status + ')') : fail('Home page answered ' + home.status);
    const csp = home.headers.get('content-security-policy'); csp ? ok('Security headers present') : fail('Security headers missing');
    if (base.startsWith('https://')) home.headers.get('strict-transport-security') ? ok('HTTPS is enforced (HSTS)') : warn('No HSTS header. Check the proxy passes X-Forwarded-Proto.');
    const adm = await fetch(base + '/api/admin/bookings'); adm.status === 401 ? ok('Admin data is locked without a password') : fail('Admin data answered ' + adm.status + ' without signing in!');
  } catch (e) { fail('Could not reach ' + base + ': ' + e.message); }
}

live().then(() => {
  const icon = { ok: '  ok   ', warn: '  WARN ', fail: '  FAIL ' };
  console.log('\nFreshNest pre-flight check\n');
  results.forEach(([k, m]) => console.log(icon[k] + m));
  const f = results.filter((r) => r[0] === 'fail').length, w = results.filter((r) => r[0] === 'warn').length;
  console.log('\n' + (f ? f + ' problem(s) to fix before going live.' : w ? 'Nothing blocking. ' + w + ' thing(s) worth a look above.' : 'All good. Ready to go live.') + '\n');
  process.exit(f ? 1 : 0);
});
