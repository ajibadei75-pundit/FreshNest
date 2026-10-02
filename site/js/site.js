/* ==========================================================================
   FreshNest site core, loaded on every page: settings from the server, the live open/closed status,
   menu, theme, scroll-reveal and shared helpers. Page scripts (home.js, book.js ...) build on window.FN.
   If the server can't be reached (for example the preview opened as a file) it falls back to built-in
   defaults and to WhatsApp / email links.
   ========================================================================== */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (id) { return document.getElementById(id); };
  var qsa = function (sel, ctx) { return [].slice.call((ctx || document).querySelectorAll(sel)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var DEFAULTS = {
    name: "FreshNest Cleaning Services", phone: "+2347087596696", phoneDisplay: "+234 708 759 6696", whatsapp: "2347087596696",
    email: "freshnestcleaningservices@proton.me",
    hours: { open: "07:00", close: "19:00", days: [true, true, true, true, true, true, true] },
    acceptingBookings: true, announcement: "", replyNote: "We reply as soon as we can during opening hours."
  };
  var FN = window.FN = { reduced: reduced, esc: esc, $: $, qsa: qsa, settings: clone(DEFAULTS), api: false, loaded: false, reviews: [], projects: [], cities: window.FNPricing.RULES.cities };

  /* ---------- Helpers ---------- */
  FN.whatsappUrl = function (text) { return "https://wa.me/" + FN.settings.whatsapp + (text ? "?text=" + encodeURIComponent(text) : ""); };
  FN.mailtoUrl = function (subject, body) { return "mailto:" + FN.settings.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body); };
  FN.openLink = function (url) { var a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); };
  FN.post = function (url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); })
      .catch(function () { return { ok: false, status: 0, data: {} }; });
  };
  FN.query = function (name) { try { return new URLSearchParams(location.search).get(name) || ""; } catch (e) { return ""; } };
  FN.fmtDate = function (d) { try { return new Date(d.length > 10 ? d : d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return d; } };
  var toastEl = $("toast"), toastT;
  FN.toast = function (msg) { if (!toastEl) return; toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2800); };
  FN.hoursText = window.FNHours.hoursText;
  FN.openStatus = window.FNHours.openStatus;

  /* ---------- Settings, opening status, hours table ---------- */
  function paintStatus() {
    var st = FN.openStatus(FN.settings.hours);
    qsa("[data-status]").forEach(function (el) {
      el.setAttribute("data-open", st.open);
      var t = el.querySelector("[data-status-text]"), d = el.querySelector("[data-status-detail]");
      if (t) t.textContent = st.text; if (d) d.textContent = st.detail;
    });
  }
  function paintHoursTable() {
    var body = document.querySelector("#hoursTable tbody"); if (!body) return;
    var h = FN.settings.hours, today = window.FNHours.lagosNow().day, H = window.FNHours;
    body.innerHTML = H.ORDER.map(function (d) {
      return '<tr class="' + (d === today ? "today" : "") + '"><td>' + H.DAY_NAMES[d] + (d === today ? " (today)" : "") + "</td><td>" + (h.days[d] ? H.fmtTime(h.open) + " to " + H.fmtTime(h.close) : "Closed") + "</td></tr>";
    }).join("");
  }
  var listeners = [];
  FN.onSettings = function (fn) { listeners.push(fn); fn(FN.settings); };
  function applySettings() {
    var s = FN.settings, view = { phoneDisplay: s.phoneDisplay, email: s.email, hoursText: FN.hoursText(s.hours), replyNote: s.replyNote };
    qsa("[data-act=call]").forEach(function (a) { a.href = "tel:" + s.phone; });
    qsa("[data-act=wa]").forEach(function (a) { a.href = "https://wa.me/" + s.whatsapp; });
    qsa("[data-act=mail]").forEach(function (a) { a.href = "mailto:" + s.email; });
    qsa("[data-s]").forEach(function (el) { var v = view[el.getAttribute("data-s")]; if (v) el.textContent = v; });
    var an = $("announce"); if (an) { an.hidden = !s.announcement; an.textContent = s.announcement; }
    paintStatus(); paintHoursTable();
    listeners.forEach(function (fn) { fn(s); });
  }
  setInterval(function () { paintStatus(); paintHoursTable(); }, 60000);

  /* ---------- Theme ---------- */
  var tbtn = $("themeToggle"), metaTheme = document.querySelector('meta[name="theme-color"]');
  function paintTheme(t) {
    root.setAttribute("data-theme", t);
    if (tbtn) tbtn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
    if (metaTheme) metaTheme.setAttribute("content", t === "dark" ? "#07201C" : "#F2F8F6");
  }
  paintTheme(root.getAttribute("data-theme") || "light");
  if (tbtn) tbtn.addEventListener("click", function () {
    var t = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    paintTheme(t); try { localStorage.setItem("fn_theme", t); } catch (e) {}
    FN.toast(t === "dark" ? "Night mode on" : "Day mode on");
  });

  /* ---------- Menu, header, floating buttons ---------- */
  var nav = $("nav"), navToggle = $("navToggle"), header = $("header"), fab = $("fab"), mbar = $("mbar"), ticking = false;
  function setNav(open) {
    if (!nav) return;
    nav.setAttribute("data-open", open); navToggle.setAttribute("aria-expanded", open); navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    root.classList.toggle("menu-open", !!open);
  }
  if (navToggle) {
    navToggle.addEventListener("click", function () { setNav(nav.getAttribute("data-open") !== "true"); });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) setNav(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setNav(false); });
    window.addEventListener("resize", function () { if (window.innerWidth > 920) setNav(false); });
  }
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY;
      if (header) header.classList.toggle("scrolled", y > 8);
      if (fab) fab.classList.toggle("show", y > 500);
      if (mbar) mbar.classList.toggle("show", y > 400);
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ---------- Scroll reveal: content fades up once as it enters the screen ---------- */
  var io = null, revealStarted = false;
  function show(el) { el.classList.add("in"); }
  FN.reveal = function (ctx) {
    ctx = ctx || document; revealStarted = true;
    qsa("[data-stagger]", ctx).concat(ctx.hasAttribute && ctx.hasAttribute("data-stagger") ? [ctx] : []).forEach(function (p) {
      var i = 0; [].forEach.call(p.children, function (c) { if (c.hasAttribute("data-reveal") && !c.style.getPropertyValue("--i")) c.style.setProperty("--i", Math.min(i++, 8)); });
    });
    var els = qsa("[data-reveal]:not(.in)", ctx);
    if (reduced || !("IntersectionObserver" in window)) { els.forEach(show); return; }
    if (!io) io = new IntersectionObserver(function (entries) { entries.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }); }, { threshold: 0.1, rootMargin: "0px 0px -4% 0px" });
    els.forEach(function (el) { io.observe(el); });
  };
  setTimeout(function () { if (!revealStarted) qsa("[data-reveal]").forEach(show); }, 3000);   /* safety net: never leave content hidden */

  /* ---------- Before / after slider (home page and the work-page reader) ---------- */
  FN.wireCompare = function (box, input, start, end) {
    var raf = null;
    function setV(v) { box.style.setProperty("--v", v + "%"); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
    input.addEventListener("input", function () { stop(); setV(input.value); });
    ["pointerdown", "keydown", "touchstart"].forEach(function (ev) { input.addEventListener(ev, stop, { passive: true }); });
    setV(input.value);
    if (!FN.reduced && start !== end) {
      var t0 = null;
      setTimeout(function () {
        if (+input.value !== start) return;
        (function step(t) {
          if (t0 === null) t0 = t;
          var p = Math.min((t - t0) / 1900, 1), e = 1 - Math.pow(1 - p, 3), v = start + (end - start) * e;
          input.value = v; setV(v); raf = p < 1 ? requestAnimationFrame(step) : null;
        })(performance.now());
      }, 900);
    } else { input.value = end; setV(end); }
  };

  /* ---------- Data from the server ---------- */
  var readyCbs = [];
  FN.ready = function (fn) { if (FN.loaded) fn(); else readyCbs.push(fn); };
  function done() { FN.loaded = true; readyCbs.splice(0).forEach(function (fn) { fn(); }); }

  applySettings(); FN.reveal();
  fetch("/api/public", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("no api")); })
    .then(function (d) {
      FN.api = true;
      FN.settings = Object.assign(clone(DEFAULTS), d.settings || {});
      FN.reviews = d.reviews || []; FN.projects = d.projects || [];
      applySettings();
    })
    .catch(function () { /* stay on the built-in defaults */ })
    .then(done);
})();
