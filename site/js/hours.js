/* Opening hours helpers (Nigerian time). */
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(); else root.FNHours = factory(); })(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function time12(hhmm) { var p = String(hhmm || "07:00").split(":"), h = +p[0], m = +p[1] || 0, ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12; return h + (m ? ":" + String(m).padStart(2, "0") : "") + ap; }
  function hoursText(h) {
    var days = (h.days || []).slice().sort(), t = time12(h.open) + " to " + time12(h.close);
    if (days.length === 7) return "Every day, " + t; if (!days.length) return "Currently closed";
    return days.map(function (d) { return DAYS[d].slice(0, 3); }).join(", ") + ", " + t;
  }
  function openStatus(h, now) {
    now = now || new Date(); var o = {};
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now).forEach(function (p) { o[p.type] = p.value; });
    var day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(o.weekday), mins = (+o.hour % 24) * 60 + +o.minute, days = h.days || [];
    function toM(s) { var p = s.split(":"); return +p[0] * 60 + (+p[1] || 0); }
    var openM = toM(h.open), closeM = toM(h.close);
    if (days.indexOf(day) > -1 && mins >= openM && mins < closeM) return { open: true, text: "Open now", detail: "until " + time12(h.close) };
    if (days.indexOf(day) > -1 && mins < openM) return { open: false, text: "Closed now", detail: "opens today at " + time12(h.open) };
    for (var i = 1; i <= 7; i++) { var d = (day + i) % 7; if (days.indexOf(d) > -1) return { open: false, text: "Closed now", detail: "opens " + (i === 1 ? "tomorrow" : DAYS[d]) + " at " + time12(h.open) }; }
    return { open: false, text: "Currently closed", detail: "" };
  }
  return { DAYS: DAYS, time12: time12, hoursText: hoursText, openStatus: openStatus };
});
