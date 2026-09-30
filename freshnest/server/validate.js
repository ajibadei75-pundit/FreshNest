'use strict';
/* Everything that arrives from a browser is checked here before it is saved.
   Each validator returns { ok: true, value } or { ok: false, error, field }. */
const Pricing = require('../public/js/pricing.js');
const P = Pricing.PRICING, RULES = Pricing.RULES;

const bad = (error, field) => ({ ok: false, error, field });
const good = (value) => ({ ok: true, value });

function str(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}
function bool(v) { return v === true || v === 'true' || v === 'on'; }
function pick(v, allowed, fallback) { return allowed.indexOf(v) > -1 ? v : fallback; }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function lagosDate(offsetDays) {
  const d = new Date(Date.now() + (offsetDays || 0) * 864e5);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/* Turns any way of typing a Nigerian number into +234XXXXXXXXXX. */
function normalisePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 11 && d[0] === '0') d = '234' + d.slice(1);
  else if (d.length === 10 && !d.startsWith('234')) d = '234' + d;
  return d;
}
function formatPhone(digits) {
  const m = /^234(\d{3})(\d{3})(\d{4})$/.exec(digits);
  return m ? '+234 ' + m[1] + ' ' + m[2] + ' ' + m[3] : '+' + digits;
}

function validateBooking(b) {
  b = b || {};
  const s = b.selection || {}, d = b.details || {}, c = b.contact || {}, k = b.consent || {};

  if (!P.service[s.type]) return bad('Choose a type of cleaning.', 'type');

  const name = str(c.name, 80);
  if (name.length < 2) return bad('Enter your name so we know who to reply to.', 'name');
  const phone = normalisePhone(c.phone);
  if (phone.length < 10 || phone.length > 15) return bad('Enter a phone number we can reach.', 'phone');
  const email = str(c.email, 120);
  if (email && !EMAIL.test(email)) return bad('That email address does not look right.', 'email');

  const date = str(d.date, 10);
  if (!DATE.test(date)) return bad('Choose the date you would like us to come.', 'date');
  const min = lagosDate(RULES.leadDays), max = lagosDate(RULES.maxDaysAhead);
  if (date < min) return bad('Please choose ' + min + ' or later. For sooner visits, call or WhatsApp us.', 'date');
  if (date > max) return bad('Please choose a date within the next ' + RULES.maxDaysAhead + ' days.', 'date');

  const street = str(d.street, 160), cityState = str(d.cityState, 80);
  if (street.length < 4) return bad('Enter the street address so we can find you.', 'street');
  if (cityState.length < 2) return bad('Enter your city and state.', 'cityState');

  if (k.accepted !== true) return bad('Please read and agree to the booking terms first.', 'consent');

  /* Rebuild the selection from known keys only, then price it ourselves. */
  const office = s.type === 'office';
  const rooms = {};
  (office ? P.office.rooms : P.rooms).forEach(function (r) { rooms[r.id] = Pricing.clamp((s.rooms || {})[r.id] || 0, 0, r.max); });
  const sel = {
    type: s.type,
    size: pick(s.size, Object.keys(P.homeSize), 'average'),
    cond: pick(s.cond, Object.keys(P.condition), 'normal'),
    kitchen: pick(s.kitchen, Object.keys(P.kitchen), 'standard'),
    open: pick(s.open, Object.keys(P.office.open), 'none'),
    rooms: rooms,
    extras: (Array.isArray(s.extras) ? s.extras : []).filter(function (x) { return P.extras[x]; }).slice(0, 12),
    extraWindows: Pricing.clamp(s.extraWindows || 0, 0, 40),
    windows: Pricing.clamp(s.windows || 1, 1, 80),
    freq: pick(s.freq, Object.keys(P.freq), 'once')
  };
  const est = Pricing.estimate(sel, P);

  const slotIds = ['any'].concat(RULES.slots.map(function (x) { return x.id; }));
  return good({
    sel: sel,
    details: {
      propType: str(d.propType, 60), otherRooms: str(d.otherRooms, 600),
      date: date, flex: bool(d.flex), slot: pick(d.slot, slotIds, 'any'),
      street: street, cityState: cityState, landmark: str(d.landmark, 100),
      access: str(d.access, 80), floor: str(d.floor, 80),
      water: bool(d.water), power: bool(d.power), parking: bool(d.parking), gate: bool(d.gate),
      pets: bool(d.pets), petType: str(d.petType, 120), hardWindows: bool(d.hardWindows),
      focus: (Array.isArray(d.focus) ? d.focus : []).map(function (x) { return str(x, 30); }).filter(Boolean).slice(0, 10),
      instructions: str(d.instructions, 600), budget: str(d.budget, 12).replace(/[^\d,]/g, '')
    },
    contact: { name: name, phone: '+' + phone, email: email, pref: pick(c.pref, ['WhatsApp', 'Phone call', 'Email'], 'WhatsApp') },
    estimate: {
      label: est.label, low: est.low, high: est.high, total: est.total, hours: est.hours, crew: est.crew,
      freq: est.freq.label, freqKey: est.freqKey, callout: est.callout, discount: Math.round(est.discount),
      floorApplied: est.floorApplied, minCharge: est.minCharge, adjust: est.adjust,
      lines: est.lines.map(function (l) { return { label: l.label, amount: Math.round(l.amount) }; }),
      extraLines: est.extraLines.map(function (l) { return { label: l.label, amount: Math.round(l.amount) }; })
    },
    message: str(b.message, 4000),
    consentVersion: str(k.version, 20)
  });
}

function validateFeedback(b) {
  b = b || {};
  const rating = parseInt(b.rating, 10);
  if (!(rating >= 1 && rating <= 5)) return bad('Choose a star rating.', 'rating');
  const allowed = ['On time', 'Thorough', 'Friendly team', 'Good value', 'Easy booking'];
  return good({
    rating: rating,
    tags: (Array.isArray(b.tags) ? b.tags : []).filter(function (t) { return allowed.indexOf(t) > -1; }),
    text: str(b.text, 800), name: str(b.name, 60),
    service: pick(str(b.service, 40), Object.keys(P.service).map(function (k) { return P.service[k].label; }), ''),
    allowPublic: bool(b.allowPublic)
  });
}

const UPLOAD_PATH = /^\/uploads\/[a-f0-9]{16}\.(jpg|png|webp)$/;
function validateProject(b) {
  b = b || {};
  const title = str(b.title, 80);
  if (title.length < 3) return bad('Give the project a title.', 'title');
  const date = str(b.date, 10);
  if (!DATE.test(date)) return bad('Choose the date of the project.', 'date');
  const img = function (v) { v = str(v, 60); return UPLOAD_PATH.test(v) ? v : ''; };
  const before = img(b.before), after = img(b.after);
  if ((before && !after) || (after && !before)) return bad('Add both a before and an after photo, or neither.', 'before');
  return good({
    title: title, excerpt: str(b.excerpt, 160), service: str(b.service, 40), property: str(b.property, 60),
    team: str(b.team, 40), time: str(b.time, 40), body: str(b.body, 3000), date: date,
    photo: img(b.photo), before: before, after: after, published: bool(b.published)
  });
}

function validateSettings(b) {
  b = b || {};
  const phone = normalisePhone(b.phone);
  if (phone.length < 10 || phone.length > 15) return bad('Enter the business phone or WhatsApp number.', 'phone');
  const email = str(b.email, 120);
  if (!EMAIL.test(email)) return bad('Enter a valid business email.', 'email');
  const name = str(b.name, 60);
  if (name.length < 2) return bad('Enter the business name.', 'name');
  const h = b.hours || {};
  if (!TIME.test(h.open) || !TIME.test(h.close)) return bad('Enter opening and closing times.', 'open');
  if (h.close <= h.open) return bad('Closing time must be later than opening time.', 'close');
  const days = Array.isArray(h.days) && h.days.length === 7 ? h.days.map(bool) : null;
  if (!days || !days.some(Boolean)) return bad('Choose at least one day you are open.', 'days');
  return good({
    name: name, phone: '+' + phone, phoneDisplay: formatPhone(phone), whatsapp: phone, email: email,
    hours: { open: h.open, close: h.close, days: days },
    acceptingBookings: bool(b.acceptingBookings), announcement: str(b.announcement, 200), replyNote: str(b.replyNote, 120)
  });
}

module.exports = { validateBooking, validateFeedback, validateProject, validateSettings, lagosDate, str, bool, normalisePhone, formatPhone };
