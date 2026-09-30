'use strict';
/* Keeps dated copies of db.json in DATA_DIR/backups (newest 14 days). Runs at start-up and every 6 hours.
   These protect against mistakes and corruption. Download a copy from the admin page to protect against losing the disk. */
const fs = require('node:fs');
const path = require('node:path');

function createBackups(store, opts) {
  opts = opts || {};
  const dir = path.join(store.dir, 'backups'), keep = opts.keep || 14, log = opts.log || console;
  const dbFile = path.join(store.dir, 'db.json');
  let timer = null;

  function stamp() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }

  function list() {
    try {
      return fs.readdirSync(dir).filter((f) => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse()
        .map((f) => ({ file: f, bytes: fs.statSync(path.join(dir, f)).size, modified: fs.statSync(path.join(dir, f)).mtime.toISOString() }));
    } catch (e) { return []; }
  }

  async function run() {
    try {
      await store.flush();
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const target = path.join(dir, 'db-' + stamp() + '.json'), tmp = target + '.tmp';
      fs.copyFileSync(dbFile, tmp); fs.chmodSync(tmp, 0o600); fs.renameSync(tmp, target);
      list().slice(keep).forEach((b) => { try { fs.unlinkSync(path.join(dir, b.file)); } catch (e) { /* ignore */ } });
    } catch (e) { log.error('Backup failed: ' + e.message); }
  }

  return {
    list, run,
    start() { run(); timer = setInterval(run, 6 * 60 * 60 * 1000); timer.unref(); },
    stop() { clearInterval(timer); }
  };
}

module.exports = { createBackups };
