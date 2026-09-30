'use strict';
/* Tells the owner when something arrives. Three optional channels, use any or all:
     ntfy      NOTIFY_URL                          a push notification to your phone (https://ntfy.sh)
     telegram  TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
     email     RESEND_API_KEY + NOTIFY_EMAIL       (Resend, https://resend.com; MAIL_FROM optional)
   A failing channel never blocks a booking: results are logged and shown in the admin page. */

function withTimeout(promise, ms) {
  let t;
  return Promise.race([promise, new Promise(function (_, rej) { t = setTimeout(function () { rej(new Error('timed out after ' + ms / 1000 + 's')); }, ms); })])
    .finally(function () { clearTimeout(t); });
}
async function check(res) {
  if (!res.ok) { let body = ''; try { body = (await res.text()).slice(0, 160); } catch (e) { /* ignore */ } throw new Error('HTTP ' + res.status + (body ? ' ' + body : '')); }
}
const ascii = (s) => String(s).replace(/[^\x20-\x7E]/g, '').slice(0, 120);

function createNotifier(env, log) {
  env = env || process.env; log = log || console;
  const channels = [];

  if (env.NOTIFY_URL) {
    channels.push({ name: 'ntfy', send: async (title, text) => check(await fetch(env.NOTIFY_URL, { method: 'POST', headers: { Title: ascii(title), 'Content-Type': 'text/plain; charset=utf-8' }, body: text })) });
  }
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const api = env.TELEGRAM_API || 'https://api.telegram.org';
    channels.push({ name: 'telegram', send: async (title, text) => check(await fetch(api + '/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: title + '\n\n' + text, disable_web_page_preview: true }) })) });
  }
  if (env.RESEND_API_KEY && env.NOTIFY_EMAIL) {
    const api = env.RESEND_API_URL || 'https://api.resend.com/emails';
    const to = env.NOTIFY_EMAIL.split(',').map((s) => s.trim()).filter(Boolean);
    channels.push({ name: 'email', send: async (title, text) => check(await fetch(api, { method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.MAIL_FROM || 'FreshNest <onboarding@resend.dev>', to, subject: title, text }) })) });
  }

  let last = null;
  async function notify(title, text) {
    if (!channels.length) return [];
    const results = await Promise.all(channels.map(async (c) => {
      try { await withTimeout(c.send(title, text), 8000); return { channel: c.name, ok: true }; }
      catch (e) { log.error('Notification via ' + c.name + ' failed: ' + e.message); return { channel: c.name, ok: false, error: e.message }; }
    }));
    last = { at: new Date().toISOString(), title, results };
    return results;
  }
  return { notify, channels: channels.map((c) => c.name), status: () => ({ channels: channels.map((c) => c.name), last }) };
}

module.exports = { createNotifier };
