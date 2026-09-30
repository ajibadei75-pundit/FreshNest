'use strict';
/* FreshNest server. Start with:  node server/index.js
   Configuration is read from environment variables, or from a .env file next to package.json.
   See .env.example for every option and README.md for hosting. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
require('./env').loadEnv(path.join(root, '.env'));

const { createApp } = require('./app');
const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || 3000;
const dataDir = process.env.DATA_DIR || path.join(root, 'data');

/* The data folder must be writable, or bookings would be accepted and then lost. Fail loudly instead. */
try {
  fs.mkdirSync(dataDir, { recursive: true });
  const probe = path.join(dataDir, '.write-test'); fs.writeFileSync(probe, 'ok'); fs.unlinkSync(probe);
} catch (e) {
  console.error('\nCannot write to the data folder (' + dataDir + '): ' + e.message);
  console.error('Set DATA_DIR to a folder this program is allowed to write to.\n');
  process.exit(1);
}

const app = createApp({ publicDir: path.join(root, 'public'), dataDir });

/* ---- Plain-English warnings for things that go wrong on a live server ---- */
const warnings = [];
if (production && !process.env.DATA_DIR) warnings.push('DATA_DIR is not set. On most hosts the default folder is erased on every deploy, which would delete your bookings. Mount a persistent disk and point DATA_DIR at it.');
if (production && !app.publicUrl) warnings.push('PUBLIC_URL is not set. Add your site address (for example https://freshnest.ng) so search engines and alert links use it.');
if (production && !app.passwordFromEnv) warnings.push('ADMIN_PASSWORD is not set. Set it so the admin password survives moving or restoring the server.');
if (production && app.publicUrl && !app.publicUrl.startsWith('https://')) warnings.push('PUBLIC_URL should start with https://. The admin page sends a password, so serve the site over HTTPS.');
if (production && app.proxyHops === 0) warnings.push('TRUST_PROXY is 0. If a host or proxy sits in front of this app, every visitor will look like one person and share the same booking limit. Set TRUST_PROXY=1.');
if (!app.notifier.channels.length) warnings.push('No alert channel is set up, so you will not be told when a booking arrives. Add NOTIFY_URL, TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID, or RESEND_API_KEY + NOTIFY_EMAIL.');

const server = http.createServer(app.handler);
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.keepAliveTimeout = 65000;          /* longer than most proxies' idle timeout, which avoids sporadic 502 errors */

server.listen(port, function () {
  app.backups.start();
  const where = app.publicUrl || 'http://localhost:' + port;
  console.log('\nFreshNest ' + require('../package.json').version + ' is running (' + (production ? 'production' : 'development') + ')');
  console.log('  Website:   ' + where);
  console.log('  Admin:     ' + where + '/admin/');
  console.log('  Data:      ' + dataDir);
  console.log('  Alerts:    ' + (app.notifier.channels.join(', ') || 'none'));
  console.log('  Proxies:   ' + app.proxyHops + (app.proxyHops ? ' (visitor IP read from X-Forwarded-For)' : ''));
  if (app.generatedPassword) {
    console.log('\nFirst run: your admin password is  ' + app.generatedPassword);
    console.log('Save it now. It will not be shown again. Change it under Settings, or set ADMIN_PASSWORD.');
  } else if (app.passwordFromEnv) console.log('  Password:  from ADMIN_PASSWORD');
  warnings.forEach(function (w) { console.log('\n! ' + w); });
  console.log('');
});
server.on('error', function (e) {
  console.error(e.code === 'EADDRINUSE' ? '\nPort ' + port + ' is already in use. Set PORT to another number.\n' : e);
  process.exit(1);
});

/* Finish in-flight requests and any pending save before exiting, so a redeploy never loses a booking. */
let stopping = false;
function stop(signal) {
  if (stopping) return; stopping = true;
  console.log(signal + ' received, shutting down');
  setTimeout(function () { process.exit(1); }, 10000).unref();
  server.close(function () {
    app.backups.stop();
    app.store.flush().then(function () { process.exit(0); });
  });
  if (server.closeIdleConnections) server.closeIdleConnections();
}
process.on('SIGINT', function () { stop('SIGINT'); });
process.on('SIGTERM', function () { stop('SIGTERM'); });
process.on('unhandledRejection', function (e) { console.error('Unhandled rejection:', e); });
process.on('uncaughtException', function (e) { console.error('Uncaught exception:', e); app.store.flush().finally(function () { process.exit(1); }); });
