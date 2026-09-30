/* ==========================================================================
   FreshNest public site: settings from the server, opening status, navigation,
   the before/after slider, cleaning tips and projects, reviews and feedback.
   The page still works if the server can't be reached (for example when the
   HTML file is opened on its own): it falls back to the defaults below and to
   WhatsApp / email links.
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
  var FN = window.FN = { reduced: reduced, esc: esc, $: $, qsa: qsa, settings: clone(DEFAULTS), api: false, reviews: [], projects: [] };

  /* ---------- Small helpers shared with booking.js ---------- */
  FN.whatsappUrl = function (text) { return "https://wa.me/" + FN.settings.whatsapp + (text ? "?text=" + encodeURIComponent(text) : ""); };
  FN.mailtoUrl = function (subject, body) { return "mailto:" + FN.settings.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body); };
  FN.openLink = function (url) { var a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); };
  FN.post = function (url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); })
      .catch(function () { return { ok: false, status: 0, data: {} }; });
  };
  var toastEl = $("toast"), toastT;
  FN.toast = function (msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2800); };
  FN.fmtDate = function (d) { try { return new Date(d.length > 10 ? d : d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return d; } };

  /* ---------- Opening hours and live status (Nigeria time, see hours.js) ---------- */
  FN.hoursText = window.FNHours.hoursText;
  FN.openStatus = window.FNHours.openStatus;
  function paintStatus() {
    var st = FN.openStatus(FN.settings.hours), b = $("heroStatus"), c = $("contactStatus");
    b.setAttribute("data-open", st.open); $("statusText").textContent = st.text; $("statusDetail").textContent = st.detail;
    c.setAttribute("data-open", st.open); $("contactStatusText").textContent = st.text + (st.detail ? ", " + st.detail : "");
  }

  /* ---------- Apply settings to the page ---------- */
  var listeners = [];
  FN.onSettings = function (fn) { listeners.push(fn); fn(FN.settings); };
  function applySettings() {
    var s = FN.settings, view = { phoneDisplay: s.phoneDisplay, email: s.email, hoursText: FN.hoursText(s.hours), replyNote: s.replyNote };
    qsa("[data-act=call]").forEach(function (a) { a.href = "tel:" + s.phone; });
    qsa("[data-act=wa]").forEach(function (a) { a.href = "https://wa.me/" + s.whatsapp; });
    qsa("[data-act=mail]").forEach(function (a) { a.href = "mailto:" + s.email; });
    qsa("[data-s]").forEach(function (el) { var v = view[el.getAttribute("data-s")]; if (v) el.textContent = v; });
    var an = $("announce"); an.hidden = !s.announcement; an.textContent = s.announcement;
    paintStatus();
    listeners.forEach(function (fn) { fn(s); });
  }
  setInterval(paintStatus, 60000);

  /* ---------- Theme ---------- */
  var tbtn = $("themeToggle"), metaTheme = document.querySelector('meta[name="theme-color"]');
  function paintTheme(t) {
    root.setAttribute("data-theme", t);
    tbtn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
    if (metaTheme) metaTheme.setAttribute("content", t === "dark" ? "#0A1C22" : "#F3F8F7");
  }
  paintTheme(root.getAttribute("data-theme") || "light");
  tbtn.addEventListener("click", function () {
    var t = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    paintTheme(t); try { localStorage.setItem("fn_theme", t); } catch (e) {}
    FN.toast(t === "dark" ? "Night mode on" : "Day mode on");
  });

  /* ---------- Header, menu, floating buttons ---------- */
  var nav = $("nav"), navToggle = $("navToggle"), header = $("header"), fab = $("fab"), mbar = $("mbar"), inEstimate = false, ticking = false;
  function setNav(open) { nav.setAttribute("data-open", open); navToggle.setAttribute("aria-expanded", open); navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu"); }
  navToggle.addEventListener("click", function () { setNav(nav.getAttribute("data-open") !== "true"); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a")) setNav(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setNav(false); });
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY;
      header.classList.toggle("scrolled", y > 8);
      fab.classList.toggle("show", y > 500);
      mbar.classList.toggle("show", y > 500 && !inEstimate);   /* never cover the booking buttons */
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { inEstimate = e[0].isIntersecting; onScroll(); }, { threshold: 0.02 }).observe($("estimate"));
  }
  onScroll();

  /* ---------- Before / after slider ---------- */
  function wireCompare(box, input, start, end) {
    var raf = null;
    function setV(v) { box.style.setProperty("--v", v + "%"); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
    input.addEventListener("input", function () { stop(); setV(input.value); });
    ["pointerdown", "keydown", "touchstart"].forEach(function (ev) { input.addEventListener(ev, stop, { passive: true }); });
    setV(input.value);
    if (!reduced && start !== end) {
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
  }
  wireCompare($("compare"), $("cmp"), 92, 50);

  /* ---------- Cleaning tips and our work ---------- */
  var TIPS = [
    { slug: "how-often-should-you-deep-clean", type: "tip", icon: "calendar", a: "#0E2B35", b: "#0B7E80", date: "2026-09-10",
      title: "How often should you deep clean your home?", excerpt: "A simple schedule so the big jobs never pile up.",
      body: "Most homes benefit from a deep clean **every 3 to 6 months**, with regular cleaning in between.\n\n## Deep clean sooner if\n- You have just moved in or out\n- Someone at home has allergies or asthma\n- You have pets or young children\n- The dusty harmattan season has just passed\n\n## Between deep cleans\n- Wipe kitchen surfaces and bathrooms weekly\n- Mop floors at least once a week\n- Wash bedding every one to two weeks\n\nA regular plan keeps the deep clean lighter, so it takes less time and costs less." },
    { slug: "streak-free-windows", type: "tip", icon: "window", a: "#0B7E80", b: "#5FA8D3", date: "2026-08-28",
      title: "Streak-free windows in five steps", excerpt: "The order and tools that make glass sparkle.",
      body: "Streaks usually come from dirty cloths and cleaning in direct sun.\n\n## Steps\n- Clean on a cloudy day or when the glass is in shade\n- Dust the frame and sill first so dirt does not run onto the glass\n- Wash with warm water and a drop of dish soap\n- Squeegee from top to bottom, wiping the blade after every pass\n- Buff edges with a dry microfibre cloth\n\nUse a clean cloth for each window and avoid paper towels, which leave lint." },
    { slug: "prepare-before-cleaners-arrive", type: "tip", icon: "check", a: "#12525C", b: "#3AA6A0", date: "2026-08-05",
      title: "What to prepare before your cleaners arrive", excerpt: "Five quick things that help the visit go smoothly.",
      body: "A little preparation means more time on actual cleaning.\n\n## Before we arrive\n- Put away valuables, cash and documents\n- Clear worktops and floors of loose items\n- Tell us about pets and secure them if needed\n- Make sure water and electricity are available, or let us know if they are not\n- Share gate or estate entry instructions\n\nTell us about delicate surfaces or items to avoid, and we will note it for the team." }
  ];
  var curFilter = "all", postsEl = $("posts"), reader = $("reader"), readerBody = $("readerBody");

  function allPosts() {
    var work = FN.projects.map(function (p) {
      var d = [];
      if (p.service) d.push(["Service", p.service]); if (p.property) d.push(["Property", p.property]);
      if (p.team) d.push(["Team", p.team]); if (p.time) d.push(["Time taken", p.time]);
      return { slug: "p-" + p.id, type: "work", icon: "sparkle", a: "#0B7E80", b: "#4CCFC9", title: p.title, date: p.date, excerpt: p.excerpt, details: d, body: p.body, photo: p.photo, before: p.before, after: p.after };
    });
    return work.concat(TIPS).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }
  function readMins(t) { return Math.max(1, Math.round((t || "").split(/\s+/).length / 200)); }
  function coverStyle(p) { return "--a:" + p.a + ";--b:" + p.b; }
  function icon(name) { return '<svg class="i" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
  function renderPosts() {
    var hasWork = FN.projects.length > 0;
    $("filters").hidden = !hasWork;
    $("workTitle").textContent = hasWork ? "Our work and cleaning tips" : "Cleaning tips";
    $("workSub").textContent = hasWork ? "See what we've done and pick up practical advice for keeping your space fresh." : "Practical advice for keeping your space fresh between visits.";
    if (!hasWork) curFilter = "all";
    var list = allPosts().filter(function (p) { return curFilter === "all" || p.type === curFilter; });
    postsEl.innerHTML = list.map(function (p) {
      var img = p.photo || p.after;
      return '<button type="button" class="post" data-slug="' + esc(p.slug) + '"><div class="cover" style="' + coverStyle(p) + '">' + icon(p.icon) + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : "") + '<span class="kind">' + (p.type === "work" ? "Our work" : "Cleaning tip") + '</span></div><div class="info"><h3>' + esc(p.title) + '</h3><p>' + esc(p.excerpt) + '</p><div class="meta"><span>' + FN.fmtDate(p.date) + '</span>' + (p.type === "tip" ? '<span>' + readMins(p.body) + ' min read</span>' : "") + '</div></div></button>';
    }).join("");
  }
  qsa("#filters button").forEach(function (b) {
    b.addEventListener("click", function () {
      curFilter = b.getAttribute("data-f");
      qsa("#filters button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      renderPosts();
    });
  });
  function md(t) {
    var out = [], list = null;
    function inline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }
    function close() { if (list) { out.push("<ul>" + list.join("") + "</ul>"); list = null; } }
    (t || "").split("\n").forEach(function (l) {
      if (/^##\s+/.test(l)) { close(); out.push("<h4>" + inline(l.replace(/^##\s+/, "")) + "</h4>"); }
      else if (/^-\s+/.test(l)) { (list = list || []).push("<li>" + inline(l.replace(/^-\s+/, "")) + "</li>"); }
      else if (!l.trim()) close();
      else { close(); out.push("<p>" + inline(l) + "</p>"); }
    });
    close(); return out.join("");
  }
  function closeReader() { if (reader.close) reader.close(); else reader.removeAttribute("open"); }
  function showReader(head, body) {
    readerBody.innerHTML = '<div style="position:relative">' + head + '<button type="button" class="icon-btn close" id="readerClose" aria-label="Close"><svg class="i" style="stroke-width:2.4" aria-hidden="true"><use href="#i-close"/></svg></button></div><div class="bd">' + body + "</div>";
    if (typeof reader.showModal === "function") reader.showModal(); else reader.setAttribute("open", "");
    $("readerClose").addEventListener("click", closeReader);
    var c2 = $("readerClose2"); if (c2) c2.addEventListener("click", closeReader);
    var cta = $("readerCta"); if (cta) cta.addEventListener("click", function () { closeReader(); $("estimate").scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); });
    reader.scrollTop = 0;
  }
  function openPost(slug) {
    var p = allPosts().filter(function (x) { return x.slug === slug; })[0]; if (!p) return;
    var head;
    if (p.before && p.after) {
      head = '<div class="compare" id="rcmp"><img class="scene" src="' + esc(p.after) + '" alt="After cleaning"><img class="scene dirty" src="' + esc(p.before) + '" alt="Before cleaning"><div class="handle" aria-hidden="true"><div class="knob"><svg class="i" style="stroke-width:2.6" aria-hidden="true"><use href="#i-arrows"/></svg></div></div><span class="tag l" aria-hidden="true">Before</span><span class="tag r" aria-hidden="true">After</span><input id="rcmpIn" type="range" min="0" max="100" value="92" aria-label="Drag to compare before and after"></div>';
    } else {
      head = '<div class="hd" style="' + coverStyle(p) + '">' + icon(p.icon) + ((p.photo || p.after) ? '<img src="' + esc(p.photo || p.after) + '" alt="">' : "") + "</div>";
    }
    var facts = p.details && p.details.length ? '<div class="facts">' + p.details.map(function (d) { return "<div><small>" + esc(d[0]) + "</small><b>" + esc(d[1]) + "</b></div>"; }).join("") + "</div>" : "";
    showReader(head, '<div><h2 id="readerTitle">' + esc(p.title) + '</h2><p class="fine muted" style="margin-top:8px">' + FN.fmtDate(p.date) + "</p></div>" + facts + md(p.body) + '<div class="reader-actions"><button type="button" class="btn btn-primary" id="readerCta">Get my estimate</button><button type="button" class="btn btn-ghost" id="readerClose2">Close</button></div>');
    var rc = $("rcmp"); if (rc) wireCompare(rc, $("rcmpIn"), 92, 50);
  }
  function openTerms() {
    showReader('<div class="hd" style="--a:#0E2B35;--b:#0B7E80">' + icon("shield") + "</div>",
      '<div><h2 id="readerTitle">Booking terms and privacy</h2><p class="fine muted" style="margin-top:8px">Version ' + esc(window.FNPricing.RULES.termsVersion) + '</p></div><div class="terms-doc">' + $("terms").innerHTML + '</div><div class="reader-actions"><button type="button" class="btn btn-ghost" id="readerClose2">Close</button></div>');
  }
  postsEl.addEventListener("click", function (e) { var c = e.target.closest(".post"); if (c) openPost(c.getAttribute("data-slug")); });
  reader.addEventListener("click", function (e) { if (e.target === reader) closeReader(); });
  qsa("[data-open-terms]").forEach(function (b) { b.addEventListener("click", openTerms); });
  FN.openTerms = openTerms;

  /* ---------- Reviews ---------- */
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>';
  var listEl = $("reviewList");
  function starsHtml(n) { var h = '<div class="rstars" role="img" aria-label="' + n + ' out of 5 stars">'; for (var i = 1; i <= 5; i++) h += STAR.replace("<svg", '<svg class="' + (i <= n ? "on" : "") + '"'); return h + "</div>"; }
  function renderReviews() {
    var rs = FN.reviews;
    if (!rs.length) {
      listEl.innerHTML = '<div class="empty"><h3>No reviews yet</h3><p>Once customers share their feedback and allow us to show it, their reviews appear here. Had a clean with us? Tell us how it went.</p></div>';
      return;
    }
    var avg = Math.round(rs.reduce(function (a, r) { return a + r.rating; }, 0) / rs.length * 10) / 10;
    listEl.innerHTML = '<div class="rev-summary"><b>' + avg.toFixed(1) + "</b><div>" + starsHtml(Math.round(avg)) + '<span class="fine muted">' + rs.length + (rs.length === 1 ? " review" : " reviews") + "</span></div></div>" +
      rs.map(function (r) {
        return '<article class="rev"><div class="who"><div class="av" aria-hidden="true">' + esc((r.name || "?").charAt(0).toUpperCase()) + '</div><div><div class="nm">' + esc(r.name) + '</div><div class="mt">' + esc(r.meta) + (r.meta ? ", " : "") + FN.fmtDate(r.date) + "</div></div></div>" + starsHtml(r.rating) + "<p>" + esc(r.text) + "</p></article>";
      }).join("");
  }

  var sh = "";
  for (var s = 5; s >= 1; s--) sh += '<input type="radio" name="rating" id="r' + s + '" value="' + s + '"><label for="r' + s + '" title="' + s + " star" + (s > 1 ? "s" : "") + '"><span class="sr-only">' + s + " star" + (s > 1 ? "s" : "") + "</span>" + STAR + "</label>";
  $("stars").innerHTML = sh;
  $("fbTags").innerHTML = ["On time", "Thorough", "Friendly team", "Good value", "Easy booking"].map(function (t) { return '<label><input type="checkbox" value="' + esc(t) + '"><span>' + esc(t) + "</span></label>"; }).join("");
  var svc = window.FNPricing.PRICING.service;
  $("fbService").insertAdjacentHTML("beforeend", Object.keys(svc).map(function (k) { return "<option>" + esc(svc[k].label) + "</option>"; }).join(""));
  $("fbForm").addEventListener("change", function (e) { if (e.target.name === "rating") $("rateErr").textContent = ""; });
  $("fbForm").addEventListener("submit", function (e) { e.preventDefault(); });

  function feedback(channel, btn) {
    var sel = document.querySelector('#fbForm input[name="rating"]:checked'), st = $("fbStatus");
    if (!sel) { $("rateErr").textContent = "Choose a star rating first."; $("r5").focus(); return; }
    var data = {
      rating: +sel.value, tags: qsa("#fbTags input:checked").map(function (i) { return i.value; }), text: $("fbText").value.trim(),
      name: $("fbName").value.trim(), service: $("fbService").value, allowPublic: $("fbPublic").checked, website: $("fbWebsite").value
    };
    var lines = ["Feedback for " + FN.settings.name, "Rating: " + data.rating + " out of 5"];
    if (data.service) lines.push("Service: " + data.service);
    if (data.tags.length) lines.push("What went well: " + data.tags.join(", "));
    if (data.text) lines.push("Comments: " + data.text);
    if (data.name) lines.push("Name: " + data.name);
    var message = lines.join("\n");
    function note(text, kind) { st.hidden = false; st.className = "status" + (kind ? " is-" + kind : ""); st.textContent = text; }
    if (channel === "whatsapp") { FN.openLink(FN.whatsappUrl(message)); note("Thank you. Press send in the WhatsApp window that opened."); return; }
    btn.disabled = true;
    FN.post("/api/feedback", data).then(function (r) {
      btn.disabled = false;
      if (r.ok) {
        note("Thank you. Your feedback has been sent." + (data.allowPublic ? " If it passes our check, it will appear here." : ""), "ok");
        $("fbForm").reset(); return;
      }
      if (r.status === 422 || r.status === 429) { note(r.data.error || "We couldn't send that. Please try again.", "error"); return; }
      FN.openLink(FN.mailtoUrl("Feedback from " + (data.name || "a customer"), message));
      note("We couldn't reach our server, so we opened your email app. Press send to finish.");
    });
  }
  $("fbEmail").addEventListener("click", function () { feedback("email", this); });
  $("fbWa").addEventListener("click", function () { feedback("whatsapp", this); });

  /* ---------- Start ---------- */
  applySettings(); renderPosts(); renderReviews();

  fetch("/api/public", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("no api")); })
    .then(function (d) {
      FN.api = true;
      FN.settings = Object.assign(clone(DEFAULTS), d.settings || {});
      FN.reviews = d.reviews || []; FN.projects = d.projects || [];
      applySettings(); renderPosts(); renderReviews();
    })
    .catch(function () { /* stay on the built-in defaults */ });
})();
