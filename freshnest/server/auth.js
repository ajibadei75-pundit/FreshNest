'use strict';
const crypto = require('node:crypto');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return 'scrypt$' + salt.toString('hex') + '$' + hash.toString('hex');
}

function verifyPassword(pw, stored) {
  try {
    const parts = String(stored || '').split('$');
    if (parts[0] !== 'scrypt' || parts.length !== 3) return false;
    const hash = Buffer.from(parts[2], 'hex');
    const test = crypto.scryptSync(String(pw), Buffer.from(parts[1], 'hex'), hash.length);
    return crypto.timingSafeEqual(hash, test);
  } catch (e) { return false; }
}

function sign(body, secret) { return crypto.createHmac('sha256', secret).update(body).digest('base64url'); }

function makeToken(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + sign(body, secret);
}

function readToken(token, secret) {
  if (!token || token.indexOf('.') < 0) return null;
  const i = token.indexOf('.'), body = token.slice(0, i), sig = Buffer.from(token.slice(i + 1)), want = Buffer.from(sign(body, secret));
  if (sig.length !== want.length || !crypto.timingSafeEqual(sig, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return p && p.exp > Date.now() ? p : null;
  } catch (e) { return null; }
}

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach(function (part) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

/* Sliding-window limiter kept in memory: enough for a single small server. */
function limiter(max, windowMs) {
  const hits = new Map();
  setInterval(function () {
    const now = Date.now();
    hits.forEach(function (arr, k) { const keep = arr.filter(function (t) { return now - t < windowMs; }); if (keep.length) hits.set(k, keep); else hits.delete(k); });
  }, windowMs).unref();
  return {
    hit: function (key) {
      const now = Date.now(), arr = (hits.get(key) || []).filter(function (t) { return now - t < windowMs; });
      if (arr.length >= max) { hits.set(key, arr); return false; }
      arr.push(now); hits.set(key, arr); return true;
    },
    reset: function (key) { hits.delete(key); }
  };
}

module.exports = { hashPassword, verifyPassword, makeToken, readToken, parseCookies, limiter };
