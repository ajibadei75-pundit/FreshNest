'use strict';
/* A small JSON-file database. Fine for one business; writes are queued and
   atomic (write to a temp file, then rename) so a crash never corrupts data. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_SETTINGS = {
  name: 'FreshNest Cleaning Services',
  phone: '+2347087596696',
  phoneDisplay: '+234 708 759 6696',
  whatsapp: '2347087596696',
  email: 'freshnestcleaningservices@proton.me',
  /* days[0] is Sunday, matching JavaScript's getDay() */
  hours: { open: '07:00', close: '19:00', days: [true, true, true, true, true, true, true] },
  acceptingBookings: true,
  announcement: '',
  replyNote: 'We reply as soon as we can during opening hours.'
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function createStore(dir) {
  const file = path.join(dir, 'db.json');
  const tmp = file + '.tmp';
  let data = null;
  let chain = Promise.resolve();

  function fresh() {
    return {
      meta: { createdAt: new Date().toISOString(), secret: crypto.randomBytes(32).toString('hex'), adminHash: '' },
      settings: clone(DEFAULT_SETTINGS), bookings: [], feedback: [], projects: []
    };
  }

  function load() {
    fs.mkdirSync(path.join(dir, 'uploads'), { recursive: true, mode: 0o700 });
    if (fs.existsSync(file)) {
      try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
      catch (err) { throw new Error('Could not read ' + file + ' (' + err.message + '). Restore a backup or move the file aside.'); }
      data.meta = data.meta || {};
      if (!data.meta.secret) data.meta.secret = crypto.randomBytes(32).toString('hex');
      data.settings = Object.assign(clone(DEFAULT_SETTINGS), data.settings || {});
      data.settings.hours = Object.assign(clone(DEFAULT_SETTINGS.hours), data.settings.hours || {});
      ['bookings', 'feedback', 'projects'].forEach(function (k) { data[k] = Array.isArray(data[k]) ? data[k] : []; });
      try { fs.chmodSync(file, 0o600); } catch (e) { /* not fatal, e.g. on some Windows setups */ }
    } else {
      data = fresh();
      fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
    }
    return data;
  }

  function save() {
    const json = JSON.stringify(data, null, 2);
    chain = chain
      .then(async function () { await fs.promises.writeFile(tmp, json, { mode: 0o600 }); await fs.promises.rename(tmp, file); })
      .catch(function (err) { console.error('Could not save data:', err); });
    return chain;
  }

  function flush() { return chain; }

  return { load: load, save: save, flush: flush, get data() { return data; }, dir: dir };
}

function newId() { return crypto.randomBytes(8).toString('hex'); }

module.exports = { createStore, newId, DEFAULT_SETTINGS };
