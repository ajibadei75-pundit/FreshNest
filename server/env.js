'use strict';
/* Tiny .env loader (no dependency). Real environment variables always win over the file. */
const fs = require('node:fs');

function parseEnv(text) {
  const out = {};
  String(text).split(/\r?\n/).forEach(function (line) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || m[0].trim().startsWith('#')) return;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    out[m[1]] = v;
  });
  return out;
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return false;
  const vars = parseEnv(fs.readFileSync(file, 'utf8'));
  Object.keys(vars).forEach(function (k) { if (process.env[k] === undefined) process.env[k] = vars[k]; });
  return true;
}

module.exports = { loadEnv, parseEnv };
