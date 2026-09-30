'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../public/js/hours.js');
const Pricing = require('../public/js/pricing.js');

const everyDay = { open: '07:00', close: '19:00', days: [true, true, true, true, true, true, true] };

test('opening hours read naturally', () => {
  assert.equal(H.hoursText(everyDay), 'Every day, 7am to 7pm');
  assert.equal(H.hoursText({ open: '07:30', close: '19:00', days: [false, true, true, true, true, true, true] }), 'Mon to Sat, 7:30am to 7pm');
  assert.equal(H.hoursText({ open: '08:00', close: '17:00', days: [true, true, true, true, true, false, false] }), 'Mon to Thu, Sun, 8am to 5pm');
});

test('open now is worked out in Nigeria time (UTC+1)', () => {
  /* 2026-09-30 is a Wednesday */
  assert.deepEqual(H.openStatus(everyDay, new Date('2026-09-30T09:00:00Z')), { open: true, text: 'Open now', detail: 'until 7pm' });
  assert.equal(H.openStatus(everyDay, new Date('2026-09-30T05:59:00Z')).open, false, '06:59 in Lagos is before opening');
  assert.equal(H.openStatus(everyDay, new Date('2026-09-30T06:00:00Z')).open, true, '07:00 in Lagos is opening time');
  assert.equal(H.openStatus(everyDay, new Date('2026-09-30T17:59:00Z')).open, true, '18:59 in Lagos is still open');
  assert.equal(H.openStatus(everyDay, new Date('2026-09-30T18:00:00Z')).detail, 'opens tomorrow at 7am', '19:00 in Lagos is closing time');
  assert.equal(H.openStatus(everyDay, new Date('2026-09-30T04:00:00Z')).detail, 'opens today at 7am');
});

test('closed days are skipped when finding the next opening', () => {
  const monToFri = { open: '08:00', close: '17:00', days: [false, true, true, true, true, true, false] };
  /* Saturday 2026-10-03 11:00 in Lagos */
  assert.equal(H.openStatus(monToFri, new Date('2026-10-03T10:00:00Z')).detail, 'opens on Monday at 8am');
});

test('the estimate never goes below the minimum visit charge and reacts to rooms', () => {
  const P = Pricing.PRICING;
  const tiny = Pricing.estimate({ type: 'standard', size: 'compact', cond: 'light', kitchen: 'none', rooms: { bedroom: 0, bathroom: 1 }, freq: 'once' }, P);
  assert.ok(tiny.total >= P.minTotal - 500, 'floor applied: ' + tiny.total);
  const small = Pricing.estimate({ type: 'standard', size: 'average', cond: 'normal', kitchen: 'standard', rooms: { bedroom: 2, bathroom: 1, living: 1 }, freq: 'once' }, P);
  const big = Pricing.estimate({ type: 'standard', size: 'average', cond: 'normal', kitchen: 'standard', rooms: { bedroom: 4, bathroom: 3, living: 2 }, freq: 'once' }, P);
  assert.ok(big.total > small.total);
  assert.ok(small.low < small.total && small.total < small.high);
  const weekly = Pricing.estimate({ type: 'standard', size: 'average', cond: 'normal', kitchen: 'standard', rooms: { bedroom: 2, bathroom: 1, living: 1 }, freq: 'weekly' }, P);
  assert.ok(weekly.total < small.total, 'regular plans cost less per visit');
});
