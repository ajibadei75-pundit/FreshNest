'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

function setSecurity(res) { Object.keys(SECURITY_HEADERS).forEach(function (k) { res.setHeader(k, SECURITY_HEADERS[k]); }); }

function send(res, status, body, headers) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  res.writeHead(status, Object.assign({ 'Content-Length': buf.length }, headers || {}));
  res.end(buf);
}
function json(res, status, obj, headers) {
  send(res, status, JSON.stringify(obj), Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {}));
}

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

function readJson(req, limit) {
  limit = limit || 64 * 1024;
  return new Promise(function (resolve, reject) {
    const type = String(req.headers['content-type'] || '');
    if (type.indexOf('application/json') !== 0) return reject(new HttpError(415, 'Send JSON.'));
    let size = 0; const chunks = [];
    req.on('data', function (c) {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'That is too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', function () {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(new HttpError(400, 'That request could not be read.')); }
    });
    req.on('error', reject);
  });
}

const COMPRESSIBLE = /^(text\/|application\/(json|javascript)|image\/svg)/;
function wantsGzip(req) { return /\bgzip\b/.test(String(req.headers['accept-encoding'] || '')); }

/* Sends an in-memory page (used for the home page, which is built from live settings). */
function sendPage(req, res, body, headers) {
  const buf = Buffer.from(body), etag = '"' + require('node:crypto').createHash('sha1').update(buf).digest('hex').slice(0, 20) + '"';
  const h = Object.assign({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', Vary: 'Accept-Encoding' }, headers || {});
  if (req.headers['if-none-match'] === etag) { h.ETag = etag; res.writeHead(304, h); res.end(); return; }
  h.ETag = etag;
  if (wantsGzip(req) && buf.length > 1024) { const z = zlib.gzipSync(buf); h['Content-Encoding'] = 'gzip'; h['Content-Length'] = z.length; res.writeHead(200, h); res.end(req.method === 'HEAD' ? undefined : z); return; }
  h['Content-Length'] = buf.length; res.writeHead(200, h); res.end(req.method === 'HEAD' ? undefined : buf);
}

/* Serves a file with an ETag so browsers always revalidate but rarely re-download.
   Text files are gzip-compressed when the browser accepts it. */
async function serveFile(req, res, file, opts) {
  opts = opts || {};
  let st;
  try { st = await fs.promises.stat(file); } catch (e) { return false; }
  if (st.isDirectory()) return serveFile(req, res, path.join(file, 'index.html'), opts);
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const gz = COMPRESSIBLE.test(type) && st.size > 1024 && wantsGzip(req);
  const etag = '"' + st.size.toString(16) + '-' + Math.round(st.mtimeMs).toString(16) + (gz ? '-gz' : '') + '"';
  const headers = { 'Content-Type': type, 'ETag': etag, 'Cache-Control': opts.immutable ? 'public, max-age=31536000, immutable' : 'no-cache', Vary: 'Accept-Encoding' };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); res.end(); return true; }
  if (gz) headers['Content-Encoding'] = 'gzip'; else headers['Content-Length'] = st.size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') { res.end(); return true; }
  const src = fs.createReadStream(file).on('error', function () { res.destroy(); });
  if (gz) src.pipe(zlib.createGzip()).pipe(res); else src.pipe(res);
  return true;
}

/* Resolves a URL path inside a root folder; returns null for anything that escapes it. */
function safeJoin(root, urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath); } catch (e) { return null; }
  if (p.indexOf('\0') > -1) return null;
  const full = path.join(root, path.normalize(p));
  return full === root || full.startsWith(root + path.sep) ? full : null;
}

module.exports = { send, json, sendPage, readJson, serveFile, safeJoin, setSecurity, HttpError, MIME };
