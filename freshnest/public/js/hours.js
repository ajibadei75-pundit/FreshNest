/* Opening-hours text and live "open now" status, in Nigeria time.
   Shared by the public site and the admin page (window.FNHours) and testable in Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FNHours = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var ORDER = [1, 2, 3, 4, 5, 6, 0];            /* weeks read Monday to Sunday; days[0] is Sunday */

  function fmtTime(t) {
    var h = +t.slice(0, 2), m = +t.slice(3, 5);
    return (h % 12 || 12) + (m ? ":" + ("0" + m).slice(-2) : "") + (h >= 12 ? "pm" : "am");
  }
  function toMin(t) { return +t.slice(0, 2) * 60 + +t.slice(3, 5); }

  function hoursText(h) {
    var time = fmtTime(h.open) + " to " + fmtTime(h.close), runs = [], cur = null;
    if (h.days.every(Boolean)) return "Every day, " + time;
    ORDER.forEach(function (d, i) {
      if (!h.days[d]) return;
      if (cur && cur.end === i - 1) cur.end = i; else { cur = { start: i, end: i }; runs.push(cur); }
    });
    return runs.map(function (r) {
      return r.start === r.end ? DAY_SHORT[ORDER[r.start]] : DAY_SHORT[ORDER[r.start]] + " to " + DAY_SHORT[ORDER[r.end]];
    }).join(", ") + ", " + time;
  }

  function lagosNow(date) {
    var o = {};
    new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Lagos", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date || new Date()).forEach(function (p) { o[p.type] = p.value; });
    return { day: DAY_SHORT.indexOf(o.weekday), min: (+o.hour) * 60 + (+o.minute) };
  }

  function openStatus(h, date) {
    var n = lagosNow(date), o = toMin(h.open), c = toMin(h.close);
    if (h.days[n.day] && n.min >= o && n.min < c) return { open: true, text: "Open now", detail: "until " + fmtTime(h.close) };
    if (h.days[n.day] && n.min < o) return { open: false, text: "Closed now", detail: "opens today at " + fmtTime(h.open) };
    for (var i = 1; i <= 7; i++) {
      var d = (n.day + i) % 7;
      if (h.days[d]) return { open: false, text: "Closed now", detail: "opens " + (i === 1 ? "tomorrow" : "on " + DAY_NAMES[d]) + " at " + fmtTime(h.open) };
    }
    return { open: false, text: "Closed", detail: "" };
  }

  return { hoursText: hoursText, openStatus: openStatus, fmtTime: fmtTime, lagosNow: lagosNow, DAY_NAMES: DAY_NAMES, DAY_SHORT: DAY_SHORT, ORDER: ORDER };
});
