/* Shared by every page: welcome screen, header, nav, theme, status pill, reveal animations, compare slider, helpers. */
(function () {
  "use strict";
  var root = document.documentElement, FN = window.FN, H = window.FNHours, calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (id) { return document.getElementById(id); }, qsa = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  FN.reduced = calm; FN.$ = $; FN.qsa = qsa; FN.esc = esc;
  FN.whatsappUrl = function (t) { return "https://wa.me/" + FN.site.whatsapp + (t ? "?text=" + encodeURIComponent(t) : ""); };
  FN.mailtoUrl = function (s, b) { return "mailto:" + FN.site.email + "?subject=" + encodeURIComponent(s) + "&body=" + encodeURIComponent(b); };
  FN.openLink = function (u) { var a = document.createElement("a"); a.href = u; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); };
  var toastEl = $("toast"), toastT; FN.toast = function (m) { if (!toastEl) return; toastEl.textContent = m; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 3000); };
  FN.burst = function (el) {
    if (calm || !el || !el.getBoundingClientRect) return; var r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (var i = 0; i < 18; i++) { var b = document.createElement("i"), sz = 8 + Math.random() * 16, a = Math.random() * 6.283, d = 50 + Math.random() * 100; b.className = "pop"; b.style.cssText = "left:" + cx + "px;top:" + cy + "px;width:" + sz + "px;height:" + sz + "px"; document.body.appendChild(b);
      (function (b, a, d) { b.animate([{ transform: "translate(-50%,-50%) scale(.4)", opacity: 1 }, { transform: "translate(calc(-50% + " + Math.cos(a) * d + "px), calc(-50% + " + (Math.sin(a) * d - 40) + "px)) scale(1)", opacity: 0 }], { duration: 800 + Math.random() * 500, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = function () { b.remove(); }; })(b, a, d); }
  };
  function bubbles(n) { var h = ""; for (var i = 0; i < n; i++) h += '<i style="--x:' + Math.round(Math.random() * 96) + '%;--s:' + (10 + Math.round(Math.random() * 26)) + 'px;--t:' + (9 + Math.random() * 9).toFixed(1) + 's;--dl:-' + (Math.random() * 9).toFixed(1) + 's"></i>'; return h; }
  /* welcome screen: the animated logo, once per visit on the home page */
  var after = []; FN.afterWelcome = function (cb) { if (root.classList.contains("welcome-done")) cb(); else after.push(cb); };
  function welcomeDone() { root.classList.add("welcome-done"); after.splice(0).forEach(function (cb) { cb(); }); }
  var LOGO = '<span class="lk-emblem"><i class="lk-ring"></i><img class="lk-disc" src="img/logo-disc.webp" width="236" height="236" alt=""><img class="lk-drop" src="img/logo-droplet.webp" width="236" height="236" alt=""><img class="lk-spark" src="img/logo-sparkle.webp" width="236" height="236" alt=""><i class="lk-glint"></i><i class="lk-s lk-s1"></i><i class="lk-s lk-s2"></i><i class="lk-s lk-s3"></i></span><span class="lk-text"><span class="lk-word"><img class="lt" src="img/logo-word.webp" width="777" height="139" alt=""><img class="dt" src="img/logo-word-light.webp" width="777" height="139" alt=""></span><span class="lk-tag"><img class="lt" src="img/logo-tag.webp" width="777" height="60" alt=""><img class="dt" src="img/logo-tag-light.webp" width="777" height="60" alt=""></span></span>';
  (function welcome() {
    if (!root.classList.contains("splash-on")) { welcomeDone(); return; }
    var w = document.createElement("div"); w.className = "welcome"; w.setAttribute("role", "dialog"); w.setAttribute("aria-label", "Welcome to FreshNest");
    w.innerHTML = '<div class="w-bubbles">' + (calm ? "" : bubbles(14)) + '</div><button type="button" class="w-skip">Skip</button><div class="w-inner"><div class="lockup hero-logo play">' + LOGO + '</div><p class="w-hello">Welcome to FreshNest<small>Let\'s make your space fresh.</small></p><div class="w-load" aria-hidden="true"><i></i></div></div>';
    document.body.appendChild(w); var done = false;
    function finish() { if (done) return; done = true; try { sessionStorage.setItem("fn_welcome", "1"); } catch (e) {} w.classList.add("out"); root.classList.remove("splash-on", "splash-calm"); setTimeout(function () { w.remove(); }, 1000); welcomeDone(); }
    w.querySelector(".w-skip").addEventListener("click", finish); w.addEventListener("click", finish);
    document.addEventListener("keydown", function k(e) { if (e.key === "Escape" || e.key === "Enter") { finish(); document.removeEventListener("keydown", k); } });
    setTimeout(finish, root.classList.contains("splash-calm") ? 1500 : 4200);
  })();
  /* theme */
  var tbtn = $("themeToggle"), metaT = document.querySelector('meta[name="theme-color"]');
  function paint(t) { root.setAttribute("data-theme", t); if (tbtn) { tbtn.setAttribute("aria-label", t === "dark" ? "Switch to day mode" : "Switch to night mode"); var l = tbtn.querySelector(".tt-label"); if (l) l.textContent = t === "dark" ? "Day" : "Night"; } if (metaT) metaT.setAttribute("content", t === "dark" ? "#061F1E" : "#05342F"); }
  paint(root.getAttribute("data-theme") || "light");
  if (tbtn) tbtn.addEventListener("click", function () { var t = root.getAttribute("data-theme") === "dark" ? "light" : "dark"; paint(t); try { localStorage.setItem("fn_theme", t); } catch (e) {} FN.toast(t === "dark" ? "Night mode on" : "Day mode on"); });
  /* header, nav, floating bars */
  var nav = $("nav"), tog = $("navToggle"), header = $("header"), fab = $("fab"), mbar = $("mbar");
  function setNav(o) { if (!nav) return; nav.setAttribute("data-open", o); if (tog) { tog.setAttribute("aria-expanded", o); tog.setAttribute("aria-label", o ? "Close menu" : "Open menu"); tog.textContent = o ? "Close" : "Menu"; } var bm = $("bnavMenu"); if (bm) { bm.textContent = o ? "Close" : "Menu"; bm.setAttribute("aria-expanded", o); } }
  if (tog) { tog.addEventListener("click", function () { setNav(nav.getAttribute("data-open") !== "true"); }); nav.addEventListener("click", function (e) { if (e.target.closest("a")) setNav(false); }); document.addEventListener("keydown", function (e) { if (e.key === "Escape") setNav(false); }); document.addEventListener("click", function (e) { if (nav.getAttribute("data-open") === "true" && !e.target.closest("#nav,#navToggle,#bnavMenu")) setNav(false); }); }
  /* bottom navigation (phones) */
  (function () {
    if (document.body.classList.contains("page-admin") || !nav) return; var path = (window.FN_PAGE || location.pathname).split("/").pop().replace(/\.html$/, "") || "index", cur = { "": "index", index: "index", services: "services", contact: "contact", book: "book" }[path] || "";
    var b = document.createElement("nav"); b.className = "bnav"; b.setAttribute("aria-label", "Main");
    b.innerHTML = [["index.html", "Home", "index"], ["services.html", "Services", "services"], ["book.html", "Book now", "book", "bnav-book"], ["contact.html", "Contact", "contact"]].map(function (x) { return '<a href="' + x[0] + '"' + (x[3] ? ' class="' + x[3] + '"' : "") + (cur === x[2] ? ' aria-current="page"' : "") + ">" + x[1] + "</a>"; }).join("") + '<button type="button" id="bnavMenu" aria-expanded="false" aria-controls="nav">Menu</button>';
    document.body.appendChild(b); document.body.classList.add("has-bnav");
    $("bnavMenu").addEventListener("click", function () { setNav(nav.getAttribute("data-open") !== "true"); });
  })();
  var tick = false; function onScroll() { if (tick) return; tick = true; requestAnimationFrame(function () { var y = scrollY; if (header) header.classList.toggle("scrolled", y > 8); if (fab) fab.classList.toggle("show", y > 500); if (mbar) mbar.classList.toggle("show", y > 500); tick = false; }); }
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  /* reveal and stagger */
  qsa("[data-stagger]").forEach(function (p) { qsa(":scope > [data-reveal]", p).forEach(function (c, i) { c.style.setProperty("--i", i); }); });
  if (root.classList.contains("anim")) { var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { threshold: .1, rootMargin: "0px 0px -5% 0px" }); qsa("[data-reveal]").forEach(function (el) { io.observe(el); }); FN.observe = function (el) { io.observe(el); }; } else FN.observe = function (el) { el.classList.add("in"); };
  /* before and after slider */
  FN.wireCompare = function (box, input, start, end, gate) {
    if (!box || !input) return; var raf = null; function set(v) { box.style.setProperty("--v", v + "%"); } function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
    input.addEventListener("input", function () { stop(); set(input.value); }); ["pointerdown", "keydown", "touchstart"].forEach(function (ev) { input.addEventListener(ev, stop, { passive: true }); }); set(input.value);
    if (calm || start === end) { input.value = end; set(end); return; }
    (gate || function (cb) { cb(); })(function () { setTimeout(function () { if (+input.value !== start) return; var t0 = null; (function step(t) { if (t0 === null) t0 = t; var p = Math.min((t - t0) / 1900, 1), e = 1 - Math.pow(1 - p, 3), v = start + (end - start) * e; input.value = v; set(v); raf = p < 1 ? requestAnimationFrame(step) : null; })(performance.now()); }, 700); });
  };
  FN.wireCompare($("compare"), $("cmp"), 92, 50, FN.afterWelcome);
  /* live settings */
  function applySite() {
    var S = FN.site;
    qsa("[data-act=call]").forEach(function (a) { a.href = "tel:" + S.phone; }); qsa("[data-act=wa]").forEach(function (a) { a.href = FN.whatsappUrl(); }); qsa("[data-act=mail]").forEach(function (a) { a.href = "mailto:" + S.email; });
    qsa("[data-s]").forEach(function (el) { var v = S[el.getAttribute("data-s")]; if (v) el.textContent = v; });
    var an = $("announce"); if (an) { if (S.announcement && S.announcement.enabled && S.announcement.text) { an.textContent = S.announcement.text; an.hidden = false; } else an.hidden = true; }
    paintStatus();
  }
  function paintStatus() { var st = H.openStatus(FN.site.hours); qsa("[data-status]").forEach(function (p) { p.setAttribute("data-open", st.open ? "true" : "false"); var t = p.querySelector("[data-status-text]"), d = p.querySelector("[data-status-detail]"); if (t) t.textContent = st.text; if (d) d.textContent = st.detail ? st.detail + (FN.site.hours.days.length === 7 ? " \u00b7 open every day" : "") : ""; }); }
  setInterval(paintStatus, 60000);
  document.addEventListener("click", function (e) { var a = e.target.closest && e.target.closest("[data-act]"); if (!a) return; var k = a.getAttribute("data-act"); if (k === "wa") FN.track("whatsapp_click"); else if (k === "call") FN.track("call_click"); });
  function demoBar() {
    var bar = document.createElement("div"); bar.className = "demo-bar"; var admin = document.body.classList.contains("page-admin") ? "" : "admin/";
    bar.innerHTML = 'Demo mode: nothing is really sent and data stays in this browser. Admin login: <b>' + esc(window.FNDemo.username) + '</b> / <b>' + esc(window.FNDemo.password) + '</b> <a href="' + admin + '">Open admin</a> <button type="button" id="dbMail">Demo emails</button> <button type="button" id="dbReset">Reset demo</button>';
    document.body.insertBefore(bar, document.body.firstChild);
    bar.querySelector("#dbReset").addEventListener("click", function () { if (confirm("Clear all demo bookings and emails?")) window.FNDemo.reset(); });
    bar.querySelector("#dbMail").addEventListener("click", function () {
      var box = window.FNDemo.mailbox(), d = document.createElement("dialog"); d.className = "reader";
      d.innerHTML = '<div style="padding:24px 24px 0;display:flex;justify-content:space-between;align-items:center;gap:12px"><h2 style="font-size:var(--fs-xl)">Demo emails</h2><button type="button" class="icon-btn">Close</button></div><div style="display:grid;gap:12px;padding:24px">' + (box.length ? box.map(function (m, i) { return '<details style="border:1px solid var(--line);border-radius:12px"><summary style="padding:14px 18px;cursor:pointer;font-weight:600">' + esc(m.subject) + '<br><small style="font-weight:400;color:var(--muted)">To: ' + esc(m.to) + '</small></summary><iframe sandbox title="Email ' + (i + 1) + '" srcdoc="' + esc(m.html) + '" style="width:100%;height:420px;border:0;border-top:1px solid var(--line);background:#fff"></iframe></details>'; }).join("") : '<p class="muted">No emails yet. Make a booking to see them.</p>') + "</div>";
      document.body.appendChild(d); d.showModal(); d.querySelector("button").addEventListener("click", function () { d.close(); }); d.addEventListener("close", function () { d.remove(); });
    });
  }
  FN.ready.then(function () { applySite(); if (FN.demo) demoBar(); try { if (!sessionStorage.getItem("fn_visit")) { sessionStorage.setItem("fn_visit", "1"); FN.track("visit"); } } catch (e) {} document.dispatchEvent(new CustomEvent("fn:ready")); });
})();
