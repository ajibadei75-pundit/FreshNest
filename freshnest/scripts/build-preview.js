'use strict';
/* Builds dist/freshnest-preview.html: the public site as ONE file you can open by
   double-clicking or send to someone. It has no backend, so bookings fall back to
   email and WhatsApp, and reviews/projects are empty. Run:  npm run build:preview */
const fs = require('node:fs');
const path = require('node:path');

const pub = path.join(__dirname, '..', 'public');
const read = (rel) => fs.readFileSync(path.join(pub, rel), 'utf8');
let html = read('index.html');

html = html.replace(/<link rel="stylesheet" href="(\/css\/[^"]+)">/g, (m, href) => '<style>\n' + read(href.slice(1)) + '\n</style>');
html = html.replace(/<script src="(\/js\/[^"]+)"><\/script>/g, (m, src) => {
  const code = read(src.slice(1));
  if (/<\/script/i.test(code)) throw new Error(src + ' contains a closing script tag and cannot be inlined');
  return '<script>\n' + code + '\n</script>';
});
const icon = Buffer.from(read('favicon.svg')).toString('base64');
html = html.replace('<link rel="icon" href="/favicon.svg" type="image/svg+xml">', '<link rel="icon" href="data:image/svg+xml;base64,' + icon + '">');
html = html.replace('<a href="/admin/">Staff login</a>', '');

fs.mkdirSync(path.join(__dirname, '..', 'dist'), { recursive: true });
const out = path.join(__dirname, '..', 'dist', 'freshnest-preview.html');
fs.writeFileSync(out, html);
console.log('Wrote ' + path.relative(process.cwd(), out) + ' (' + Math.round(html.length / 1024) + ' KB)');
