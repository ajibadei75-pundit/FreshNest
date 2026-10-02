/* ==========================================================================
   FreshNest admin: sign in, overview, bookings, reviews, projects, settings.
   All data comes from /api/admin/* and every change is saved on the server.
   ========================================================================== */
(function () {
  "use strict";
  const F = window.FNPricing, H = window.FNHours, P = F.PRICING, R = F.RULES, fmt = F.fmt;
  const $ = (id) => document.getElementById(id);
  const qsa = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const state = { tab: "overview", summary: null, bookings: [], feedback: [], projects: [], settings: null, bStatus: "", bQuery: "", rFilter: null, passwordManagedByEnv: false, settingsFilled: false, knownNew: null, system: null };
  const STATUS = { new: { label: "New", cls: "warn" }, confirmed: { label: "Confirmed", cls: "" }, completed: { label: "Completed", cls: "ok" }, cancelled: { label: "Cancelled", cls: "plain" } };
  const CONDITION = { light: "Lightly used", normal: "Normal", heavy: "Very dirty" };
  let pollTimer = null;

  /* ---------- Helpers ---------- */
  const fmtDay = (d) => { try { return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }); } catch (e) { return d; } };
  const fmtStamp = (iso) => { try { return new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return iso; } };
  const slotLabel = (id) => { if (id === "any") return "Any time"; const s = R.slots.find((x) => x.id === id); return s ? s.label + " (" + s.time + ")" : "Any time"; };
  const yn = (v) => (v ? "Yes" : "No");
  const pill = (text, cls) => '<span class="tagpill ' + (cls || "") + '">' + esc(text) + "</span>";
  const statusPill = (s) => pill(STATUS[s].label, STATUS[s].cls);

  let toastT;
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 3000); }

  async function api(method, url, body) {
    let r;
    try {
      r = await fetch(url, { method, credentials: "same-origin", headers: body !== undefined ? { "Content-Type": "application/json" } : {}, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) { throw new Error("We can't reach the server. Check your connection and try again."); }
    let d = {}; try { d = await r.json(); } catch (e) { /* no body */ }
    if (r.status === 401 && url !== "/api/admin/login") { showLogin("Your session ended. Please sign in again."); const err = new Error("Signed out"); err.handled = true; throw err; }
    if (!r.ok) { const err = new Error(d.error || "Something went wrong. Please try again."); err.status = r.status; err.field = d.field; throw err; }
    return d;
  }

  function copyText(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast("Copied"), () => toast("Select the text to copy it"));
    else toast("Select the text to copy it");
  }

  function confirmBox(title, text, okLabel) {
    return new Promise((resolve) => {
      const dlg = $("confirmDlg"); let result = false;
      $("cfTitle").textContent = title; $("cfText").textContent = text; $("cfOk").textContent = okLabel || "Delete";
      $("cfOk").onclick = () => { result = true; dlg.close(); };
      $("cfCancel").onclick = () => dlg.close();
      dlg.onclose = () => resolve(result);
      dlg.showModal();
    });
  }

  /* ---------- Theme ---------- */
  const root = document.documentElement, tbtn = $("themeToggle");
  function paintTheme(t) { root.setAttribute("data-theme", t); tbtn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode"); }
  paintTheme(root.getAttribute("data-theme") || "light");
  tbtn.addEventListener("click", () => { const t = root.getAttribute("data-theme") === "dark" ? "light" : "dark"; paintTheme(t); try { localStorage.setItem("fn_theme", t); } catch (e) { /* ignore */ } });

  /* ---------- Sign in and out ---------- */
  function showLogin(msg) {
    qsa("dialog[open]").forEach((d) => d.close());
    $("app").hidden = true; $("login").hidden = false; $("loginErr").textContent = msg || ""; $("password").value = "";
    stopPolling(); document.title = "FreshNest admin";
    setTimeout(() => $("password").focus(), 0);
  }
  function showApp() { $("login").hidden = true; $("app").hidden = false; loadAll(); startPolling(); }

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = $("password").value; if (!pw) { $("loginErr").textContent = "Enter your password."; return; }
    const btn = $("loginBtn"); btn.disabled = true; btn.textContent = "Signing in...";
    try { await api("POST", "/api/admin/login", { password: pw }); $("loginErr").textContent = ""; showApp(); }
    catch (err) { $("loginErr").textContent = err.message; $("password").focus(); }
    btn.disabled = false; btn.textContent = "Sign in";
  });
  $("logoutBtn").addEventListener("click", async () => { try { await api("POST", "/api/admin/logout", {}); } catch (e) { /* signing out anyway */ } showLogin(""); });

  /* ---------- Loading ---------- */
  async function loadAll() {
    try {
      const [summary, bookings, feedback, projects, settings, system] = await Promise.all([
        api("GET", "/api/admin/summary"), api("GET", "/api/admin/bookings"), api("GET", "/api/admin/feedback"), api("GET", "/api/admin/projects"), api("GET", "/api/admin/settings"), api("GET", "/api/admin/system")
      ]);
      const prevNew = state.knownNew;
      Object.assign(state, { summary, bookings: bookings.bookings, feedback: feedback.feedback, projects: projects.projects, settings: settings.settings, system });
      state.knownNew = summary.counts.new;
      if (prevNew !== null && summary.counts.new > prevNew) toast("New booking request received");
      $("loadErr").hidden = true;
      renderAll();
    } catch (err) {
      if (err.handled) return;
      $("loadErr").hidden = false; $("loadErr").textContent = err.message;
    }
  }
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => { if (!document.hidden && !qsa("dialog[open]").length) loadAll(); }, 60000);
  }
  function stopPolling() { clearInterval(pollTimer); pollTimer = null; }

  function renderAll() {
    renderBadges(); renderOverview(); renderBookings(); renderReviews(); renderProjects(); renderSystem();
    if (!state.settingsFilled) { fillSettings(); state.settingsFilled = true; }
  }
  function renderBadges() {
    const n = state.summary.counts.new, w = state.summary.pendingReviews;
    $("cnt-bookings").hidden = !n; $("cnt-bookings").textContent = n;
    $("cnt-reviews").hidden = !w; $("cnt-reviews").textContent = w;
    document.title = (n ? "(" + n + ") " : "") + "FreshNest admin";
  }

  /* ---------- Tabs ---------- */
  function setTab(tab, focus) {
    state.tab = tab;
    qsa(".tab").forEach((t) => { const on = t.dataset.tab === tab; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    qsa('[role="tabpanel"]').forEach((p) => { p.hidden = p.id !== "panel-" + tab; });
    try { history.replaceState(null, "", "#" + tab); } catch (e) { /* ignore */ }
  }
  $("tabs").addEventListener("click", (e) => { const t = e.target.closest(".tab"); if (t) setTab(t.dataset.tab); });
  $("tabs").addEventListener("keydown", (e) => {
    const tabs = qsa(".tab"), i = tabs.findIndex((t) => t.dataset.tab === state.tab);
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length; else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length; else if (e.key === "Home") n = 0; else if (e.key === "End") n = tabs.length - 1;
    if (n > -1) { e.preventDefault(); setTab(tabs[n].dataset.tab, true); }
  });

  /* ---------- Booking rows ---------- */
  function bookingItem(b) {
    const price = b.finalPrice != null ? "<b>" + fmt(b.finalPrice) + "</b><small>Final price</small>" : fmt(b.estimate.low) + " to " + fmt(b.estimate.high) + "<small>Estimate</small>";
    return '<button type="button" class="item" data-id="' + b.id + '"><span class="who"><b>' + esc(b.contact.name) + "</b><small>" + esc(b.ref) + "</small></span><span class=\"job\">" + esc(b.estimate.label) + "<small>" + esc(fmtDay(b.details.date)) + ", " + esc(slotLabel(b.details.slot)) + '</small></span><span class="money">' + price + "</span>" + statusPill(b.status) + "</button>";
  }
  const empty = (title, text) => '<div class="empty"><h3>' + esc(title) + "</h3><p>" + esc(text) + "</p></div>";

  /* ---------- Overview ---------- */
  function renderOverview() {
    const s = state.summary, c = s.counts, st = H.openStatus(state.settings.hours);
    $("todayText").textContent = "Today is " + fmtDay(s.today) + ". The website shows: " + st.text.toLowerCase() + (st.detail ? ", " + st.detail : "") + ".";
    const stats = [
      { n: c.new, label: "New requests", hot: c.new > 0, go: ["bookings", "new"] },
      { n: c.confirmed, label: "Confirmed", go: ["bookings", "confirmed"] },
      { n: s.thisMonth, label: "Requests this month", go: ["bookings", ""] },
      { n: s.pendingReviews, label: "Reviews waiting", hot: s.pendingReviews > 0, go: ["reviews", "pending"] },
      { n: s.avgRating ? s.avgRating.toFixed(1) : "None yet", label: s.publishedReviews + (s.publishedReviews === 1 ? " published review" : " published reviews"), go: ["reviews", "published"] }
    ];
    $("stats").innerHTML = stats.map((x, i) => '<button type="button" class="stat' + (x.hot ? " hot" : "") + '" data-i="' + i + '"><b>' + esc(x.n) + "</b><span>" + esc(x.label) + "</span></button>").join("");
    $("stats").onclick = (e) => {
      const b = e.target.closest(".stat"); if (!b) return;
      const go = stats[+b.dataset.i].go;
      if (go[0] === "bookings") { state.bStatus = go[1]; renderBookings(); } else { state.rFilter = go[1]; renderReviews(); }
      setTab(go[0]);
    };
    const on = state.settings.acceptingBookings;
    $("bookingSwitch").innerHTML = "<h2>Online booking</h2>" + '<div class="booking-switch' + (on ? "" : " off") + '"><div class="state"><i></i>' + (on ? "Accepting requests" : "Paused") + "</div><p class=\"fine muted\">" +
      (on ? "Customers can send booking requests from the website. Pause this if you are fully booked or away." : "The website tells customers to call or message you instead. Turn it back on when you are ready.") +
      '</p><button type="button" class="btn ' + (on ? "btn-ghost" : "btn-brand") + ' btn-sm" id="toggleBooking">' + (on ? "Pause online booking" : "Resume online booking") + "</button></div>";
    $("upcoming").innerHTML = s.upcoming.length ? s.upcoming.map(bookingItem).join("") : empty("No upcoming visits", "New and confirmed bookings with a future date appear here.");
    $("latest").innerHTML = s.latest.length ? s.latest.map(bookingItem).join("") : empty("No requests yet", "Requests sent from the website appear here as soon as they arrive.");
  }
  $("bookingSwitch").addEventListener("click", async (e) => {
    if (!e.target.closest("#toggleBooking")) return;
    const next = !state.settings.acceptingBookings;
    try {
      const r = await api("PUT", "/api/admin/settings", Object.assign({}, state.settings, { acceptingBookings: next }));
      state.settings = r.settings; $("sAccepting").checked = next; renderOverview(); toast(next ? "Online booking is on" : "Online booking is paused");
    } catch (err) { if (!err.handled) toast(err.message); }
  });
  ["upcoming", "latest", "bookingList"].forEach((id) => $(id).addEventListener("click", (e) => { const b = e.target.closest(".item"); if (b) openBooking(b.dataset.id); }));

  /* ---------- Bookings tab ---------- */
  function renderBookings() {
    const counts = { "": state.bookings.length }; Object.keys(STATUS).forEach((k) => { counts[k] = state.bookings.filter((b) => b.status === k).length; });
    $("bFilter").innerHTML = [["", "All"], ["new", "New"], ["confirmed", "Confirmed"], ["completed", "Completed"], ["cancelled", "Cancelled"]]
      .map((f) => '<button type="button" data-s="' + f[0] + '" aria-pressed="' + (state.bStatus === f[0]) + '">' + f[1] + " (" + counts[f[0]] + ")</button>").join("");
    const q = state.bQuery.toLowerCase().trim();
    const list = state.bookings.filter((b) => (!state.bStatus || b.status === state.bStatus) &&
      (!q || [b.ref, b.contact.name, b.contact.phone, b.contact.email, b.details.street, b.details.cityState, b.estimate.label].join(" ").toLowerCase().includes(q)));
    $("bookingList").innerHTML = list.length ? list.map(bookingItem).join("") : empty(state.bookings.length ? "No bookings match" : "No bookings yet", state.bookings.length ? "Try a different search or status." : "Requests sent from the website appear here.");
  }
  $("bFilter").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { state.bStatus = b.dataset.s; renderBookings(); } });
  $("bq").addEventListener("input", (e) => { state.bQuery = e.target.value; renderBookings(); });

  /* ---------- Booking details ---------- */
  function openBooking(id) {
    const b = state.bookings.find((x) => x.id === id); if (!b) return;
    const e = b.estimate, d = b.details, c = b.contact, s = b.sel, isHome = s.type !== "office" && s.type !== "windows";
    const wa = "https://wa.me/" + c.phone.replace(/\D/g, "") + "?text=" + encodeURIComponent("Hello " + c.name.split(" ")[0] + ", this is " + state.settings.name + " about your cleaning booking " + b.ref + " for " + fmtDay(d.date) + ".");
    const dl = (rows) => '<dl class="dl">' + rows.filter((r) => r[1] !== "" && r[1] != null).map((r) => "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>").join("") + "</dl>";
    const facts = [!d.water && "No running water", !d.power && "No electricity", d.parking && "Parking available", d.gate && "Gate pass or ID needed", d.pets && "Pets: " + (d.petType || "yes"), d.hardWindows && "Hard-to-reach windows"].filter(Boolean).join(", ");
    const breakdown = e.lines.map((l) => "<li><span>" + esc(l.label) + "</span><span>" + fmt(l.amount) + "</span></li>").join("") +
      (e.callout ? "<li><span>Call-out, transport and supplies</span><span>" + fmt(e.callout) + "</span></li>" : "") +
      e.extraLines.map((l) => "<li><span>" + esc(l.label) + "</span><span>+" + fmt(l.amount) + "</span></li>").join("") +
      (e.floorApplied ? "<li><span>Minimum visit charge applies</span><span>" + fmt(e.minCharge) + "</span></li>" : "") +
      (e.discount ? "<li><span>" + esc(e.freq) + " plan</span><span>\u2212" + fmt(e.discount) + "</span></li>" : "") +
      '<li class="tot"><span>Estimated total</span><span>' + fmt(e.total) + "</span></li>";
    $("bookingBody").innerHTML =
      '<div class="dlg-head"><div><h2 id="bkTitle">' + esc(c.name) + '</h2><div class="meta">' + statusPill(b.status) + '<span class="fine muted">' + esc(b.ref) + ", received " + esc(fmtStamp(b.createdAt)) + '</span></div></div><button type="button" class="icon-btn" data-close aria-label="Close"><svg class="i" aria-hidden="true"><use href="#i-close"/></svg></button></div>' +
      '<div class="dlg-body">' +
      '<div class="sec"><h3>Contact</h3>' + dl([["Phone", c.phone], ["Email", c.email || "Not given"], ["Prefers", c.pref]]) +
      '<div class="contact-btns"><a class="btn btn-ghost btn-sm" href="tel:' + esc(c.phone) + '"><svg class="i" aria-hidden="true"><use href="#i-phone"/></svg>Call</a><a class="btn btn-wa btn-sm" href="' + esc(wa) + '" target="_blank" rel="noopener"><svg class="i-fill" aria-hidden="true"><use href="#i-wa"/></svg>WhatsApp</a>' +
      (c.email ? '<a class="btn btn-ghost btn-sm" href="mailto:' + esc(c.email) + "?subject=" + encodeURIComponent("Your cleaning booking " + b.ref) + '"><svg class="i" aria-hidden="true"><use href="#i-mail"/></svg>Email</a>' : "") + "</div></div>" +
      '<div class="sec"><h3>Visit</h3>' + dl([["Date", fmtDay(d.date) + (d.flex ? " (flexible)" : "")], ["Time", slotLabel(d.slot)], ["Address", d.street + ", " + d.cityState], ["Landmark", d.landmark], ["Access", d.access + ", " + String(d.floor).toLowerCase()], ["On site", facts]]) + "</div>" +
      '<div class="sec"><h3>Job</h3>' + dl([["Service", e.label], ["Property", isHome ? d.propType + ", " + s.size + " size" : ""], ["Rooms", e.lines.map((l) => l.label).join(", ") || "None listed"], ["Other rooms", d.otherRooms], ["Condition", CONDITION[s.cond]], ["Extras", e.extraLines.map((l) => l.label).join(", ") || "None"], ["Frequency", e.freq], ["Focus", d.focus.join(", ")], ["Instructions", d.instructions], ["Customer budget", d.budget ? "\u20A6" + d.budget : ""]]) + "</div>" +
      '<div class="sec"><h3>Estimate <span class="muted" style="font-weight:500">' + fmt(e.low) + " to " + fmt(e.high) + ", about " + e.hours + " h with " + e.crew + (e.crew === 1 ? " cleaner" : " cleaners") + '</span></h3><details class="fold"><summary>See the breakdown</summary><ul class="bk">' + breakdown + "</ul></details></div>" +
      '<div class="sec"><h3>Consent</h3>' + dl([["Terms accepted", fmtStamp(b.consent.at)], ["Terms version", b.consent.version]]) + '<details class="fold"><summary>Message sent by the customer</summary><pre class="msg">' + esc(b.message) + '</pre><button type="button" class="btn btn-ghost btn-sm" id="bkCopy" style="margin-top:8px">Copy message</button></details></div>' +
      '<form class="manage" id="bkForm" novalidate><h3 style="font:700 var(--fs-md) var(--font-body)">Manage this booking</h3><div class="row"><div class="field"><label for="bkStatus">Status</label><select id="bkStatus">' +
      Object.keys(STATUS).map((k) => '<option value="' + k + '"' + (k === b.status ? " selected" : "") + ">" + STATUS[k].label + "</option>").join("") +
      '</select></div><div class="field"><label for="bkPrice">Final price in naira <span class="opt">(once agreed)</span></label><input id="bkPrice" type="number" min="0" step="500" inputmode="numeric" value="' + (b.finalPrice == null ? "" : b.finalPrice) + '" placeholder="e.g. 32000"></div></div>' +
      '<div class="field"><label for="bkNotes">Private notes <span class="opt">(customers never see these)</span></label><textarea id="bkNotes">' + esc(b.notes) + '</textarea></div><div class="status is-error" id="bkErr" role="alert" hidden></div>' +
      '<div class="dlg-actions"><button type="button" class="btn btn-danger push" id="bkDelete">Delete booking</button><button type="button" class="btn btn-ghost" data-close>Close</button><button type="submit" class="btn btn-brand" id="bkSave">Save changes</button></div></form></div>';
    const dlg = $("bookingDlg"); dlg.showModal(); dlg.scrollTop = 0;
    qsa("[data-close]", dlg).forEach((x) => x.addEventListener("click", () => dlg.close()));
    $("bkCopy").addEventListener("click", () => copyText(b.message));
    $("bkForm").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const btn = $("bkSave"); btn.disabled = true;
      try {
        await api("PATCH", "/api/admin/bookings/" + b.id, { status: $("bkStatus").value, finalPrice: $("bkPrice").value === "" ? null : Number($("bkPrice").value), notes: $("bkNotes").value });
        dlg.close(); toast("Booking updated"); loadAll();
      } catch (err) { if (!err.handled) { $("bkErr").hidden = false; $("bkErr").textContent = err.message; } }
      btn.disabled = false;
    });
    $("bkDelete").addEventListener("click", async () => {
      if (!(await confirmBox("Delete this booking?", "This removes " + b.ref + " for " + c.name + " permanently. Cancelled bookings can stay in the list instead.", "Delete booking"))) return;
      try { await api("DELETE", "/api/admin/bookings/" + b.id); dlg.close(); toast("Booking deleted"); loadAll(); } catch (err) { if (!err.handled) toast(err.message); }
    });
  }

  /* ---------- Reviews ---------- */
  const STARSVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-star"/></svg>';
  function renderReviews() {
    const fb = state.feedback, by = (s) => fb.filter((f) => f.status === s).length;
    if (state.rFilter === null) state.rFilter = by("pending") ? "pending" : "";
    $("rFilter").innerHTML = [["pending", "Waiting"], ["published", "Published"], ["hidden", "Hidden"], ["", "All"]]
      .map((f) => '<button type="button" data-s="' + f[0] + '" aria-pressed="' + (state.rFilter === f[0]) + '">' + f[1] + " (" + (f[0] ? by(f[0]) : fb.length) + ")</button>").join("");
    const list = fb.filter((f) => !state.rFilter || f.status === state.rFilter);
    $("reviewList").innerHTML = list.length ? list.map((f) => {
      const stCls = { pending: "warn", published: "ok", hidden: "plain" }[f.status], stTxt = { pending: "Waiting", published: "Published", hidden: "Hidden" }[f.status];
      const stars = '<div class="rv-stars" role="img" aria-label="' + f.rating + ' out of 5">' + [1, 2, 3, 4, 5].map((i) => STARSVG.replace("<svg", '<svg class="' + (i <= f.rating ? "on" : "") + '"')).join("") + "</div>";
      const canPublish = f.allowPublic;
      return '<article class="rv" data-id="' + f.id + '"><div class="rv-top"><div class="meta">' + stars + "<b>" + esc(f.name || "No name given") + "</b>" + (f.service ? '<span class="muted fine">' + esc(f.service) + "</span>" : "") + '</div><div class="meta">' + pill(stTxt, stCls) + '<span class="fine muted">' + esc(fmtStamp(f.createdAt)) + "</span></div></div>" +
        (f.text ? "<p>" + esc(f.text) + "</p>" : '<p class="muted">No comment written.</p>') + (f.tags.length ? '<div class="meta">' + f.tags.map((t) => pill(t, "plain")).join("") + "</div>" : "") +
        '<div class="meta">' + (canPublish ? pill("Customer allows publishing", "ok") : pill("Private: not allowed to publish", "bad")) + "</div>" +
        '<div class="rv-actions">' + (f.status !== "published" ? '<button type="button" class="btn btn-brand btn-sm" data-act="published"' + (canPublish ? "" : ' disabled title="The customer did not allow this review to be shown"') + ">Publish on website</button>" : '<button type="button" class="btn btn-ghost btn-sm" data-act="hidden">Hide from website</button>') +
        (f.status === "pending" ? '<button type="button" class="btn btn-ghost btn-sm" data-act="hidden">Hide</button>' : "") + '<button type="button" class="btn btn-danger btn-sm" data-act="delete">Delete</button></div></article>';
    }).join("") : empty("Nothing here", state.rFilter === "pending" ? "No reviews are waiting for you." : "Feedback from customers appears here.");
  }
  $("rFilter").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { state.rFilter = b.dataset.s; renderReviews(); } });
  $("reviewList").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const id = btn.closest(".rv").dataset.id, act = btn.dataset.act;
    try {
      if (act === "delete") {
        if (!(await confirmBox("Delete this feedback?", "It is removed permanently. Hiding it instead keeps a private copy.", "Delete"))) return;
        await api("DELETE", "/api/admin/feedback/" + id); toast("Feedback deleted");
      } else { await api("PATCH", "/api/admin/feedback/" + id, { status: act }); toast(act === "published" ? "Published on the website" : "Hidden from the website"); }
      loadAll();
    } catch (err) { if (!err.handled) toast(err.message); }
  });

  /* ---------- Projects (Our work) ---------- */
  function renderProjects() {
    $("projectList").innerHTML = state.projects.length ? state.projects.map((p) => {
      const img = p.photo || p.after;
      return '<article class="pc" data-id="' + p.id + '"><div class="thumb">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '<svg class="i" aria-hidden="true"><use href="#i-image"/></svg>') + '</div><div class="info"><div class="meta">' + pill(p.published ? "Published" : "Draft", p.published ? "ok" : "plain") + (p.before ? pill("Before and after", "") : "") + "</div><h3>" + esc(p.title) + '</h3><p class="fine muted">' + esc([p.service, fmtDay(p.date)].filter(Boolean).join(", ")) + '</p><div class="acts"><button type="button" class="btn btn-ghost btn-sm" data-act="edit">Edit</button><button type="button" class="btn btn-ghost btn-sm" data-act="toggle">' + (p.published ? "Unpublish" : "Publish") + '</button><button type="button" class="btn btn-danger btn-sm" data-act="delete">Delete</button></div></div></article>';
    }).join("") : '<div style="grid-column:1/-1">' + empty("No projects yet", "Add a real project with photos and it appears in the Our work section of the website. Until then, that section shows cleaning tips only.") + "</div>";
  }
  $("addProject").addEventListener("click", () => openProject(null));
  $("projectList").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const p = state.projects.find((x) => x.id === btn.closest(".pc").dataset.id); if (!p) return;
    try {
      if (btn.dataset.act === "edit") openProject(p);
      else if (btn.dataset.act === "toggle") { await api("PUT", "/api/admin/projects/" + p.id, Object.assign({}, p, { published: !p.published })); toast(p.published ? "Project unpublished" : "Project published"); loadAll(); }
      else if (btn.dataset.act === "delete") {
        if (!(await confirmBox("Delete this project?", "\u201C" + p.title + "\u201D is removed from the website and this list.", "Delete project"))) return;
        await api("DELETE", "/api/admin/projects/" + p.id); toast("Project deleted"); loadAll();
      }
    } catch (err) { if (!err.handled) toast(err.message); }
  });

  function downscale(file) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file could not be read as a photo. Try a JPG or PNG.")); };
      img.src = url;
    });
  }

  function openProject(p) {
    const cur = Object.assign({ title: "", service: "", date: new Date().toISOString().slice(0, 10), property: "", team: "", time: "", excerpt: "", body: "", photo: "", before: "", after: "", published: false }, p || {});
    const img = { photo: cur.photo, before: cur.before, after: cur.after };
    const slot = (key, label) => '<div class="pslot" data-key="' + key + '"><span class="lbl" style="font-weight:600;font-size:var(--fs-sm)">' + label + '</span><div class="pv"></div><div class="acts"><button type="button" class="btn btn-ghost btn-sm" data-pick>Choose photo</button><button type="button" class="btn btn-ghost btn-sm" data-clear>Remove</button></div><input type="file" accept="image/jpeg,image/png,image/webp" hidden></div>';
    $("projectBody").innerHTML =
      '<div class="dlg-head"><h2 id="pjTitle">' + (p ? "Edit project" : "Add project") + '</h2><button type="button" class="icon-btn" data-close aria-label="Close"><svg class="i" aria-hidden="true"><use href="#i-close"/></svg></button></div>' +
      '<form class="dlg-body" id="pjForm" novalidate>' +
      '<div class="field"><label for="pjName">Project title</label><input id="pjName" type="text" maxlength="80" value="' + esc(cur.title) + '" placeholder="e.g. 3-bedroom flat deep clean" required></div>' +
      '<div class="row"><div class="field"><label for="pjService">Service</label><select id="pjService"><option value="">Choose one</option>' + Object.keys(P.service).map((k) => "<option" + (P.service[k].label === cur.service ? " selected" : "") + ">" + esc(P.service[k].label) + "</option>").join("") + '</select></div><div class="field"><label for="pjDate">Date of the clean</label><input id="pjDate" type="date" value="' + esc(cur.date) + '" required></div></div>' +
      '<div class="row"><div class="field"><label for="pjProp">Property <span class="opt">(optional)</span></label><input id="pjProp" type="text" maxlength="60" value="' + esc(cur.property) + '" placeholder="e.g. 3-bedroom flat"></div><div class="field"><label for="pjTeam">Team <span class="opt">(optional)</span></label><input id="pjTeam" type="text" maxlength="40" value="' + esc(cur.team) + '" placeholder="e.g. 3 cleaners"></div></div>' +
      '<div class="field"><label for="pjTime">Time taken <span class="opt">(optional)</span></label><input id="pjTime" type="text" maxlength="40" value="' + esc(cur.time) + '" placeholder="e.g. About 6 hours"></div>' +
      '<div class="field"><label for="pjExcerpt">Short description</label><input id="pjExcerpt" type="text" maxlength="160" value="' + esc(cur.excerpt) + '" placeholder="One sentence shown on the card"></div>' +
      '<div class="field"><label for="pjBody">Details <span class="opt">(optional)</span></label><textarea id="pjBody" maxlength="3000" style="min-height:140px" placeholder="What you did and what the customer noticed">' + esc(cur.body) + '</textarea><p class="fine muted">Start a line with ## for a heading, or - for a bullet point.</p></div>' +
      '<div class="sec"><h3>Photos</h3><p class="fine muted">Only add photos you have permission to show. Photos are resized before upload.</p><div class="photos">' + slot("photo", "Cover photo") + slot("before", "Before") + slot("after", "After") + '</div><p class="fine muted">Before and after work as a pair: add both to show the slider.</p></div>' +
      '<label class="check-line"><input type="checkbox" id="pjPub"' + (cur.published ? " checked" : "") + '><span>Show this project on the website</span></label>' +
      '<div class="status is-error" id="pjErr" role="alert" hidden></div>' +
      '<div class="dlg-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="submit" class="btn btn-brand" id="pjSave">Save project</button></div></form>';
    const dlg = $("projectDlg"), err = $("pjErr");
    const showErr = (m) => { err.hidden = !m; err.textContent = m || ""; };
    function paintSlot(key) {
      const el = qsa(".pslot", dlg).find((x) => x.dataset.key === key), pv = qsa(".pv", el)[0];
      pv.innerHTML = img[key] ? '<img src="' + esc(img[key]) + '" alt="">' : '<svg class="i" aria-hidden="true"><use href="#i-image"/></svg>';
      qsa("[data-clear]", el)[0].hidden = !img[key];
    }
    ["photo", "before", "after"].forEach(paintSlot);
    qsa(".pslot", dlg).forEach((el) => {
      const key = el.dataset.key, input = qsa("input[type=file]", el)[0];
      qsa("[data-pick]", el)[0].addEventListener("click", () => input.click());
      qsa("[data-clear]", el)[0].addEventListener("click", () => { img[key] = ""; paintSlot(key); });
      input.addEventListener("change", async () => {
        const file = input.files[0]; input.value = ""; if (!file) return;
        showErr(""); qsa(".pv", el)[0].textContent = "Uploading...";
        try { const r = await api("POST", "/api/admin/upload", { data: await downscale(file) }); img[key] = r.url; }
        catch (e) { if (!e.handled) showErr(e.message); }
        paintSlot(key);
      });
    });
    qsa("[data-close]", dlg).forEach((x) => x.addEventListener("click", () => dlg.close()));
    $("pjForm").addEventListener("submit", async (ev) => {
      ev.preventDefault(); showErr("");
      const body = { title: $("pjName").value, service: $("pjService").value, date: $("pjDate").value, property: $("pjProp").value, team: $("pjTeam").value, time: $("pjTime").value, excerpt: $("pjExcerpt").value, body: $("pjBody").value, photo: img.photo, before: img.before, after: img.after, published: $("pjPub").checked };
      const btn = $("pjSave"); btn.disabled = true;
      try {
        if (p) await api("PUT", "/api/admin/projects/" + p.id, body); else await api("POST", "/api/admin/projects", body);
        dlg.close(); toast("Project saved"); loadAll();
      } catch (e) { if (!e.handled) showErr(e.message); }
      btn.disabled = false;
    });
    dlg.showModal(); dlg.scrollTop = 0; $("pjName").focus();
  }

  /* ---------- Settings ---------- */
  function buildDays() {
    $("sDays").innerHTML = H.ORDER.map((d) => '<label><input type="checkbox" data-day="' + d + '"><span>' + H.DAY_SHORT[d] + "</span></label>").join("");
  }
  function readHours() {
    const days = [false, false, false, false, false, false, false];
    qsa("#sDays input").forEach((i) => { days[+i.dataset.day] = i.checked; });
    return { open: $("sOpen").value, close: $("sClose").value, days };
  }
  function previewHours() {
    const h = readHours(), ok = /^\d\d:\d\d$/.test(h.open) && /^\d\d:\d\d$/.test(h.close) && h.days.some(Boolean);
    $("hoursPreview").textContent = ok ? "Shown on the website as: " + H.hoursText(h) : "Choose opening and closing times and at least one day.";
  }
  function fillSettings() {
    const s = state.settings;
    if (!$("sDays").children.length) buildDays();
    $("sName").value = s.name; $("sPhone").value = s.phoneDisplay; $("sEmail").value = s.email;
    $("sOpen").value = s.hours.open; $("sClose").value = s.hours.close;
    qsa("#sDays input").forEach((i) => { i.checked = !!s.hours.days[+i.dataset.day]; });
    $("sAccepting").checked = s.acceptingBookings; $("sAnnounce").value = s.announcement; $("sReply").value = s.replyNote;
    previewHours();
    api("GET", "/api/admin/session").then((r) => { state.passwordManagedByEnv = r.passwordManagedByEnv; $("pwEnvNote").hidden = !r.passwordManagedByEnv; $("pwFields").hidden = r.passwordManagedByEnv; }).catch(() => {});
  }
  $("settingsForm").addEventListener("input", previewHours);
  $("settingsForm").addEventListener("change", previewHours);
  const setErr = (id, msg) => { const el = $(id + "Err"); if (el) el.textContent = msg || ""; };
  $("settingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    ["sName", "sPhone", "sEmail", "sClose", "sDays"].forEach((x) => setErr(x, ""));
    const btn = $("saveSettings"); btn.disabled = true;
    try {
      const r = await api("PUT", "/api/admin/settings", { name: $("sName").value, phone: $("sPhone").value, email: $("sEmail").value, hours: readHours(), acceptingBookings: $("sAccepting").checked, announcement: $("sAnnounce").value, replyNote: $("sReply").value });
      state.settings = r.settings; fillSettings(); renderOverview(); toast("Settings saved. The website is updated.");
    } catch (err) {
      if (err.handled) { btn.disabled = false; return; }
      const map = { name: "sName", phone: "sPhone", email: "sEmail", open: "sClose", close: "sClose", days: "sDays" };
      if (map[err.field]) { setErr(map[err.field], err.message); const f = $(map[err.field]); if (f && f.focus) f.focus(); } else toast(err.message);
    }
    btn.disabled = false;
  });

  $("passwordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    ["pwCurrent", "pwNext", "pwAgain"].forEach((x) => setErr(x, ""));
    if ($("pwNext").value.length < 10) { setErr("pwNext", "Use at least 10 characters."); $("pwNext").focus(); return; }
    if ($("pwNext").value !== $("pwAgain").value) { setErr("pwAgain", "The two passwords do not match."); $("pwAgain").focus(); return; }
    try {
      await api("POST", "/api/admin/password", { current: $("pwCurrent").value, next: $("pwNext").value });
      ["pwCurrent", "pwNext", "pwAgain"].forEach((x) => { $(x).value = ""; }); toast("Password changed");
    } catch (err) {
      if (err.handled) return;
      const map = { current: "pwCurrent", next: "pwNext" };
      if (map[err.field]) { setErr(map[err.field], err.message); $(map[err.field]).focus(); } else toast(err.message);
    }
  });

  /* ---------- Alerts and backups ---------- */
  const CHANNEL_NAMES = { ntfy: "Phone notification (ntfy)", telegram: "Telegram", email: "Email" };
  function renderSystem() {
    const sys = state.system; if (!sys) return;
    const ch = sys.notify.channels, last = sys.notify.last, bk = sys.backups;
    $("alertHint").hidden = ch.length > 0;
    let h = '<div class="sec"><h3>Booking alerts</h3>';
    if (ch.length) {
      h += '<div class="meta">' + ch.map((c) => pill(CHANNEL_NAMES[c] || c, "ok")).join("") + "</div>";
      h += '<p class="fine muted">You are alerted on these channels when a booking or feedback arrives.' + (last ? " Last alert: " + esc(fmtStamp(last.at)) + (last.results.every((r) => r.ok) ? "." : ". Some channels failed: " + esc(last.results.filter((r) => !r.ok).map((r) => r.channel + " (" + r.error + ")").join(", ")) + ".") : "") + '</p><div><button type="button" class="btn btn-ghost btn-sm" id="testAlert">Send a test alert</button></div>';
    } else {
      h += '<p class="status is-error">No alert channel is set up, so you will not be told when a booking arrives. Add one of these to the server settings, then restart: <b>NOTIFY_URL</b> (phone notifications through ntfy.sh), <b>TELEGRAM_BOT_TOKEN</b> with <b>TELEGRAM_CHAT_ID</b>, or <b>RESEND_API_KEY</b> with <b>NOTIFY_EMAIL</b>. The README explains each in a few minutes.</p>';
    }
    h += '</div><div class="sec"><h3>Backups</h3><p class="fine muted">' + (bk.latest ? "The server keeps a copy every day (" + bk.count + " kept). Latest: " + esc(fmtStamp(bk.latest.modified)) + "." : "The first automatic copy is made when the server starts.") +
      " Download one to keep somewhere else too, so a lost disk cannot take your bookings with it. Photos are not included: they stay in the uploads folder.</p><div><a class=\"btn btn-ghost btn-sm\" href=\"/api/admin/backup\" download>Download a backup</a></div></div>";
    h += '<p class="fine muted">Version ' + esc(sys.version) + ", running for " + (sys.uptime > 3600 ? Math.floor(sys.uptime / 3600) + " hours" : Math.max(1, Math.round(sys.uptime / 60)) + " minutes") + (sys.publicUrl ? ". Site address: " + esc(sys.publicUrl) : "") + ".</p>";
    $("systemBody").innerHTML = h;
  }
  $("systemBody").addEventListener("click", async (e) => {
    const btn = e.target.closest("#testAlert"); if (!btn) return;
    btn.disabled = true;
    try {
      const r = await api("POST", "/api/admin/system/test-notify", {});
      const bad = r.results.filter((x) => !x.ok);
      toast(bad.length ? "Test failed on " + bad.map((x) => x.channel + ": " + x.error).join("; ") : "Test alert sent. Check your phone or inbox.");
      loadAll();
    } catch (err) { if (!err.handled) toast(err.message); }
    btn.disabled = false;
  });
  $("alertHintBtn").addEventListener("click", () => { setTab("settings"); $("systemCard").scrollIntoView({ behavior: "smooth", block: "start" }); });

  /* ---------- Start ---------- */
  (async function init() {
    const hash = (location.hash || "").slice(1);
    if (["overview", "bookings", "reviews", "projects", "settings"].includes(hash)) state.tab = hash;
    try {
      const r = await api("GET", "/api/admin/session");
      if (r.authenticated) { setTab(state.tab); showApp(); } else showLogin("");
    } catch (err) { showLogin(err.handled ? "" : err.message); }
  })();
})();
