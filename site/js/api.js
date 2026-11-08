/* Loads live settings from the backend and provides FN.api() to every page.
   On localhost or in the preview, a browser-only demo backend starts if the real one can't be reached. */
(function () {
  "use strict";
  var base = (document.currentScript && document.currentScript.src || "").replace(/api\.js[^/]*$/, "");
  var PR = window.FNPricing, H = window.FNHours, FN = window.FN = window.FN || {};
  var host = location.hostname, local = host === "localhost" || host === "127.0.0.1" || host === "" || host === "[::1]";
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function flat(cfg) { var b = cfg.business; return { name: b.name, short: b.short, email: b.email, phone: b.phone, phoneDisplay: b.phoneDisplay, whatsapp: b.whatsapp, address: b.address, cities: cfg.cities, hours: cfg.hours, hoursText: cfg.hoursText, slots: cfg.slots, leadDays: cfg.booking.leadDays, maxDaysAhead: cfg.booking.maxDaysAhead, closedDates: cfg.booking.closedDates, announcement: cfg.announcement, termsVersion: cfg.termsVersion }; }
  var S = PR.SETTINGS, fallback = { business: S.business, cities: S.cities, hours: S.hours, hoursText: H.hoursText(S.hours), booking: S.booking, slots: PR.SLOTS, pricing: S.pricing, announcement: S.announcement, termsVersion: PR.TERMS_VERSION, mail: false, ai: false };
  FN.demo = false; FN.online = false; FN.cfg = clone(fallback); FN.site = flat(FN.cfg); FN.pricing = FN.cfg.pricing;
  FN.api = function (path, opt) {
    opt = opt || {}; var h = { Accept: "application/json" }; if (opt.body !== undefined) h["Content-Type"] = "application/json"; if (opt.token) h.Authorization = "Bearer " + opt.token;
    return fetch("/api/" + path, { method: opt.method || (opt.body !== undefined ? "POST" : "GET"), headers: h, body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined }).then(function (r) {
      return r.text().then(function (t) { var d = null; try { d = t ? JSON.parse(t) : {}; } catch (e) {} if (!r.ok || d === null) { var er = new Error((d && d.error) || "We couldn't reach the server. Please try again."); er.status = r.status; er.field = d && d.field; throw er; } return d; });
    });
  };
  FN.imgSrc = function (v) { if (!v) return ""; if (v.indexOf("media:") === 0) { var id = v.slice(6); if (FN.demo) { try { var m = JSON.parse(localStorage.getItem("fn_demo:media:" + id)); return "data:" + m.ct + ";base64," + m.b64; } catch (e) { return ""; } } return "/api/media/" + id; } return v; };
  FN.applyConfig = function (cfg) { FN.cfg = cfg; FN.site = flat(cfg); FN.pricing = cfg.pricing; FN.online = true; };
  function load(src) { return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function () { rej(new Error("load " + src)); }; document.head.appendChild(s); }); }
  function startDemo() { var need = []; if (!window.FNSeed) need.push("seed.js"); if (!window.FNDocs) need.push("docs.js"); if (!window.FNManual) need.push("manual.js"); if (!window.FNPlanner) need.push("planner.js"); if (!window.FreshnestCore) need.push("core.js"); if (!window.FNDemo) need.push("demo.js"); return need.reduce(function (p, f) { return p.then(function () { return load(base + f); }); }, Promise.resolve()).then(function () { FN.demo = true; window.FNDemo.install(); }); }
  function probe() { var c = "AbortController" in window ? new AbortController() : null, t = c && setTimeout(function () { c.abort(); }, 3500); return fetch("/api/config", { headers: { Accept: "application/json" }, signal: c ? c.signal : undefined }).then(function (r) { clearTimeout(t); return r.text().then(function (x) { var d = null; try { d = JSON.parse(x); } catch (e) {} if (!r.ok || !d || !d.business) throw new Error("no backend"); return d; }); }); }
  FN.ready = probe().catch(function () { if (window.FN_ALLOW_DEMO || local) return startDemo().then(probe); throw new Error("offline"); }).then(function (cfg) { FN.applyConfig(cfg); return cfg; }).catch(function () { FN.online = false; return FN.cfg; });
  FN.track = function (e) { if (FN.online) FN.api("events", { body: { e: e } }).catch(function () {}); };
})();
