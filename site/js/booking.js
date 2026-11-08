/* Booking wizard: five clear steps, AI quote assistant, live estimate, scope of work, terms that must be read. */
(function () {
  "use strict";
  var FN = window.FN, PR = window.FNPricing, T = window.FNTerms;
  var $ = FN.$, qsa = FN.qsa, esc = FN.esc, fmt = PR.fmt, calm = FN.reduced;
  var form = $("quoteForm"), TOTAL = 5, stepNo = 1, maxStep = 1, P, S, built = false, started = false, termsState = { read: false, at: "" }, est = null, sel = null, lastBook = null;
  var SVC = [["residential", "Homes, flats and duplexes"], ["office", "Offices, shops and clinics"], ["deep", "A top-to-bottom reset"], ["hostel", "Student and guest hostels"], ["move", "Before or after moving"], ["regular", "One visit or a regular plan"], ["construction", "After building or renovation"], ["fumigation", "Cockroaches, termites, bed bugs and more"]];
  var PRESETS = {
    home: [{ id: "selfcon", label: "Self-contain", rooms: { bedroom: 1, bathroom: 1, living: 0 }, kitchen: "small" }, { id: "1bed", label: "1 bedroom", rooms: { bedroom: 1, bathroom: 1, living: 1 }, kitchen: "standard" }, { id: "2bed", label: "2 bedrooms", rooms: { bedroom: 2, bathroom: 1, living: 1 }, kitchen: "standard" }, { id: "3bed", label: "3 bedrooms", rooms: { bedroom: 3, bathroom: 2, living: 1, toilet: 1 }, kitchen: "standard" }, { id: "4bed", label: "4+ bedrooms", rooms: { bedroom: 4, bathroom: 3, living: 2, dining: 1, toilet: 1 }, kitchen: "large" }],
    office: [{ id: "osmall", label: "Small office", rooms: { private: 2, meeting: 1, reception: 1, toilet: 1, kitchenette: 1 }, open: "none" }, { id: "omed", label: "Medium office", rooms: { private: 4, meeting: 2, reception: 1, toilet: 2, kitchenette: 1 }, open: "small" }, { id: "olarge", label: "Large office", rooms: { private: 8, meeting: 3, reception: 1, toilet: 4, kitchenette: 2 }, open: "medium" }],
    hostel: [{ id: "h10", label: "About 10 rooms", rooms: { room: 10, bathroom: 2, toilet: 2, kitchen: 1, corridor: 2, common: 1 } }, { id: "h20", label: "About 20 rooms", rooms: { room: 20, bathroom: 4, toilet: 4, kitchen: 2, corridor: 3, common: 1 } }, { id: "h40", label: "About 40 rooms", rooms: { room: 40, bathroom: 8, toilet: 8, kitchen: 3, corridor: 5, common: 2 } }],
    pest: [{ id: "pself", label: "Self-contain", rooms: { bedroom: 1, bathroom: 1, kitchen: 1 } }, { id: "p1", label: "1 bedroom", rooms: { bedroom: 1, living: 1, kitchen: 1, bathroom: 1 } }, { id: "p2", label: "2 bedrooms", rooms: { bedroom: 2, living: 1, kitchen: 1, bathroom: 1 } }, { id: "p3", label: "3 bedrooms", rooms: { bedroom: 3, living: 1, dining: 1, kitchen: 1, bathroom: 2 } }, { id: "pshop", label: "Shop or store", rooms: { living: 2, store: 2, bathroom: 1 } }]
  };
  function val(n) { var e = form.elements[n]; return e ? e.value : ""; }
  function checked(n) { return !!(form.elements[n] && form.elements[n].checked); }
  function list(n) { return qsa('input[name="' + n + '"]:checked', form).map(function (i) { return i.value; }); }
  function group() { return PR.groupOf(val("type") || "residential", P); }
  function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date()); }
  function addDays(y, n) { var d = new Date(y + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function openDay(y) { return S.hours.days.indexOf(new Date(y + "T12:00:00Z").getUTCDay()) > -1 && S.closedDates.indexOf(y) < 0; }
  function cityObj() { var v = val("city"); return S.cities.filter(function (c) { return c.id === v || c.name === v; })[0]; }
  function seg(name, set, def) { return Object.keys(set).map(function (k) { return '<label><input type="radio" name="' + name + '" value="' + k + '"' + (k === def ? " checked" : "") + "><span>" + esc(set[k].label) + (set[k].hint ? "<small>" + esc(set[k].hint) + "</small>" : "") + "</span></label>"; }).join(""); }
  function roomRow(g, d) { var id = "r_" + g + "_" + d.id; return '<div class="room"><div class="t">' + esc(d.label) + (d.hint ? "<small>" + esc(d.hint) + "</small>" : "") + '</div><div class="num"><button type="button" data-d="-1" data-for="' + id + '" aria-label="Fewer ' + esc(d.label.toLowerCase()) + '">&minus;</button><input id="' + id + '" name="' + id + '" type="number" min="0" max="' + d.max + '" value="' + d.def + '" inputmode="numeric" aria-label="' + esc(d.label) + '"><button type="button" data-d="1" data-for="' + id + '" aria-label="More ' + esc(d.label.toLowerCase()) + '">+</button></div></div>'; }
  function build() {
    P = FN.pricing; S = FN.site;
    $("tiles").innerHTML = SVC.map(function (x, i) { var svc = P.service[x[0]]; return '<label class="tile"><input type="radio" name="type" value="' + x[0] + '"' + (i === 0 ? " checked" : "") + '><span class="tcard"><b>' + esc(svc.label) + "</b><small>" + x[1] + "</small></span></label>"; }).join("");
    $("city").innerHTML = '<option value="">Choose your city</option>' + S.cities.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + ", " + esc(c.state) + "</option>"; }).join("");
    $("kitchenSeg").innerHTML = seg("kitchen", P.kitchen, "standard"); $("openSeg").innerHTML = seg("open", P.office.open, "none"); $("outdoorSeg").innerHTML = seg("outdoor", P.fumigation.outdoor, "none");
    $("roomsHome").innerHTML = P.rooms.map(function (d) { return roomRow("home", d); }).join(""); $("roomsOffice").innerHTML = P.office.rooms.map(function (d) { return roomRow("office", d); }).join(""); $("roomsHostel").innerHTML = P.hostel.rooms.map(function (d) { return roomRow("hostel", d); }).join(""); $("roomsPest").innerHTML = P.fumigation.rooms.map(function (d) { return roomRow("pest", d); }).join("");
    $("pestChips").innerHTML = Object.keys(P.fumigation.pests).map(function (k) { var e = P.fumigation.pests[k]; return '<label class="chk"><input type="checkbox" name="pests" value="' + k + '"' + (k === "general" ? " checked" : "") + '><span class="box"></span><span class="t">' + esc(e.label) + (e.hint ? '<small style="display:block;color:var(--muted);font-weight:400">' + esc(e.hint) + "</small>" : "") + "</span>" + (e.price ? '<span class="p">+' + fmt(e.price) + "</span>" : "") + "</label>"; }).join("");
    $("freqSeg").innerHTML = Object.keys(P.freq).map(function (k) { var f = P.freq[k]; return '<label><input type="radio" name="freq" value="' + k + '"' + (k === "once" ? " checked" : "") + "><span>" + esc(f.label) + (f.off ? "<small>" + Math.round(f.off * 100) + "% off</small>" : "") + "</span></label>"; }).join("");
    $("extras").innerHTML = Object.keys(P.extras).map(function (k) { var e = P.extras[k]; return '<label class="chk" data-for="' + e.for + '" data-needs="' + (e.needs || "") + '"><input type="checkbox" name="extras" value="' + k + '"><span class="box"></span><span class="t">' + esc(e.label) + '</span><span class="p">+' + fmt(e.price) + "</span></label>"; }).join("");
    $("extraWinHint").textContent = fmt(P.windowInside) + " per window";
    $("slots").innerHTML = '<label class="slot"><input type="radio" name="slot" value="any" checked><span>Any time<small>We\'ll suggest</small></span></label>' + S.slots.map(function (s) { return '<label class="slot"><input type="radio" name="slot" value="' + s.id + '"><span>' + esc(s.label) + "<small>" + esc(s.time) + "</small></span></label>"; }).join("");
    $("focus").innerHTML = ["Kitchen", "Bathrooms", "Bedrooms", "Living areas", "Windows", "Floors", "Balcony", "Inside cupboards"].map(function (t) { return '<label><input type="checkbox" name="focus" value="' + t + '"><span>' + t + "</span></label>"; }).join("");
    $("date").min = addDays(today(), S.leadDays); $("date").max = addDays(today(), S.maxDaysAhead);
    $("aiMode").textContent = FN.demo ? "(This demo uses a simple keyword reader.)" : FN.cfg.ai ? "" : ""; built = true;
  }
  function buildPresets() { var g = group(); $("presets").innerHTML = PRESETS[g].map(function (p) { return '<button type="button" data-preset="' + p.id + '" aria-pressed="false">' + esc(p.label) + "</button>"; }).join(""); markPreset(); }
  function counts(g) { var o = {}; PR.roomDefs(g, P).forEach(function (d) { o[d.id] = PR.clamp(($("r_" + g + "_" + d.id) || {}).value, 0, d.max); }); return o; }
  function markPreset() { var g = group(), c = counts(g); qsa("#presets button").forEach(function (b) { var p = PRESETS[g].filter(function (x) { return x.id === b.getAttribute("data-preset"); })[0]; var same = PR.roomDefs(g, P).every(function (d) { return (c[d.id] || 0) === (p.rooms[d.id] || 0); }) && (g === "home" ? val("kitchen") === p.kitchen : g === "office" ? val("open") === p.open : true); b.setAttribute("aria-pressed", same ? "true" : "false"); }); }
  function applyPreset(p) { var g = group(); PR.roomDefs(g, P).forEach(function (d) { $("r_" + g + "_" + d.id).value = p.rooms[d.id] || 0; }); if (p.kitchen) form.querySelector('input[name="kitchen"][value="' + p.kitchen + '"]').checked = true; if (p.open) form.querySelector('input[name="open"][value="' + p.open + '"]').checked = true; }
  function readSel() { var g = group(); return { type: val("type"), size: val("size"), cond: val("cond"), kitchen: val("kitchen"), open: val("open"), outdoor: val("outdoor"), rooms: counts(g), extras: list("extras"), pests: list("pests"), extraWindows: PR.clamp($("extraWindows").value, 0, 60), freq: val("freq") }; }
  function ctx() { return { date: val("date"), today: today(), flex: checked("flex"), water: checked("water"), power: checked("power"), pets: checked("pets"), stairs: /stairs only/i.test(val("floor")) }; }
  function booking(channel) {
    sel = readSel(); est = PR.estimate(sel, P, ctx()); var c = cityObj() || {};
    return { sel: sel, estimate: est, channel: channel || "email", website: val("website"), city: c.name || "", state: c.state || "", details: { propType: val("propType"), otherRooms: val("otherRooms").trim() }, schedule: { date: val("date"), slot: val("slot"), flex: checked("flex") }, address: { street: val("street").trim(), landmark: val("landmark").trim() },
      access: { access: val("access"), floor: val("floor"), water: checked("water"), power: checked("power"), parking: checked("parking"), gate: checked("gate"), pets: checked("pets"), petType: val("petType").trim() }, focus: list("focus"), instructions: val("instructions").trim(), budget: val("budget").replace(/\D/g, ""), customer: { name: val("name").trim(), phone: val("phone").trim(), email: val("email").trim(), pref: val("pref") }, consent: { agreed: checked("consent"), version: S.termsVersion, readAt: termsState.at } };
  }
  var CONDS = { pest: { light: "Light", normal: "Normal", heavy: "Severe" }, other: { light: "Light", normal: "Normal", heavy: "Very dirty" } };
  function syncUI() {
    var g = group(), home = g === "home", off = g === "office", host = g === "hostel", pest = g === "pest";
    qsa(".grp-home").forEach(function (e) { e.hidden = !home; }); qsa(".grp-office").forEach(function (e) { e.hidden = !off; }); qsa(".grp-hostel").forEach(function (e) { e.hidden = !host; }); qsa(".grp-pest").forEach(function (e) { e.hidden = !pest; }); qsa(".grp-extras").forEach(function (e) { e.hidden = pest; }); qsa(".only-home").forEach(function (e) { e.hidden = !home; });
    var noK = home && val("kitchen") === "none";
    qsa("#extras .chk").forEach(function (l) { var hide = (l.getAttribute("data-for") === "home" && !home) || (l.getAttribute("data-needs") === "kitchen" && (!home || noK)); l.hidden = hide; if (hide) l.querySelector("input").checked = false; });
    $("extrasNote").textContent = noK ? "(kitchen extras appear when you have a kitchen)" : "(optional)";
    qsa(".room").forEach(function (r) { var i = r.querySelector("input"); r.classList.toggle("has", +i.value > 0); }); $("petRow").hidden = !$("pets").checked;
    $("condLbl").textContent = pest ? "How bad is the infestation?" : "How dirty is it right now?"; var m = pest ? CONDS.pest : CONDS.other; qsa('input[name="cond"]').forEach(function (i) { var sp = i.nextElementSibling; if (sp && sp.firstChild) sp.firstChild.textContent = m[i.value]; });
    var c = cityObj(); $("cityEcho").textContent = c ? c.name : "your city"; $("roomsTitle").textContent = off ? "What does your office include?" : host ? "What does your hostel include?" : pest ? "Which rooms need treatment?" : "Which rooms need cleaning?";
  }
  var shown = [0, 0], raf = null, lastKey = "";
  function paint(low, high) {
    cancelAnimationFrame(raf); var els = [$("priceNum"), $("abPrice"), $("sheetPrice")]; function put(a, b) { els.forEach(function (e) { e.textContent = fmt(a) + " \u2013 " + fmt(b); }); }
    if (calm) { put(low, high); shown = [low, high]; return; }
    var f = shown.slice(), t0 = null; $("priceNum").classList.remove("pulse"); void $("priceNum").offsetWidth; $("priceNum").classList.add("pulse");
    raf = requestAnimationFrame(function step(t) { if (t0 === null) t0 = t; var p = Math.min((t - t0) / 600, 1), e = 1 - Math.pow(1 - p, 3); shown = [f[0] + (low - f[0]) * e, f[1] + (high - f[1]) * e]; put(shown[0], shown[1]); if (p < 1) raf = requestAnimationFrame(step); else { put(low, high); shown = [low, high]; } });
  }
  function row(l, v, c) { return '<li class="' + (c || "") + '"><span>' + esc(l) + "</span><span>" + v + "</span></li>"; }
  function breakdown() {
    var h = row("Rooms and areas", "", "head"); est.lines.forEach(function (l) { h += row(l.label, fmt(l.amount)); }); if (est.adjust.length) h += '<li class="note"><span>Includes: ' + esc(est.adjust.join(", ")) + "</span></li>"; h += row("Call-out, transport and supplies", fmt(est.callout));
    if (est.extraLines.length) { h += row(est.group === "pest" ? "Treatments" : "Extras", "", "head"); est.extraLines.forEach(function (l) { h += row(l.label, "+" + fmt(l.amount)); }); } if (est.floorApplied) h += row("Minimum visit charge applies", fmt(est.minCharge));
    if (est.adjustLines.length) { h += row("Timing and site", "", "head"); est.adjustLines.forEach(function (l) { h += row(l.label, (l.amount < 0 ? "\u2212" : "+") + fmt(Math.abs(l.amount)), l.amount < 0 ? "neg" : ""); }); } if (est.discount > 1) h += row(est.freq.label + " plan", "\u2212" + fmt(est.discount), "neg");
    return h + row("Estimated total", fmt(est.total), "tot");
  }
  function render() {
    lastBook = booking(); var key = est.low + "-" + est.high; if (key !== lastKey) { paint(est.low, est.high); lastKey = key; }
    var note = est.label + (est.freqKey !== "once" ? ", " + est.freq.label.toLowerCase() : ""), pills = '<span>About ' + est.hours + (est.hours === 1 ? " hour" : " hours") + "</span><span>" + est.crew + (est.crew === 1 ? " person" : " people") + "</span>" + (est.monthly ? "<span>" + est.freq.visits + " visits a month: about " + fmt(est.monthly) + "</span>" : "");
    $("priceNote").textContent = note; $("sheetNote").textContent = note; $("pills").innerHTML = pills; $("sheetPills").innerHTML = pills; $("brkList").innerHTML = breakdown(); $("sheetList").innerHTML = breakdown(); $("priceSr").textContent = "Estimated price " + fmt(est.low) + " to " + fmt(est.high) + " per visit"; if (stepNo === TOTAL) renderReview();
  }
  $("openSheet").addEventListener("click", function () { $("sheet").showModal(); }); $("sheetClose").addEventListener("click", function () { $("sheet").close(); }); $("sheet").addEventListener("click", function (e) { if (e.target === $("sheet")) $("sheet").close(); });
  function renderReview() {
    var b = lastBook, rows = PR.summaryRows(b, P, S.slots), home = est.group === "home", pest = est.group === "pest"; if (est.adjustLines.length) rows.splice(rows.length - 1, 0, ["Price factors", est.adjustLines.map(function (l) { return l.label; }).join("; "), 0]);
    $("summary").innerHTML = rows.map(function (r) { var st = r[2] ? (r[2] >= 4 ? 4 : r[2] === 3 ? 3 : r[2] === 1 ? 1 : 2) : 0; return '<div class="srow"><dt>' + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>" + (st ? '<button type="button" data-goto="' + st + '">Edit</button>' : "<span></span>") + "</div>"; }).join("");
    var yes = est.lines.map(function (l) { return l.label; }).concat(est.extraLines.map(function (l) { return l.label; })); yes.unshift("The standard " + est.label.toLowerCase() + " checklist for each of these");
    var no = []; if (pest) { Object.keys(P.fumigation.pests).forEach(function (k) { if (sel.pests.indexOf(k) < 0) no.push("Treatment for " + P.fumigation.pests[k].label.toLowerCase()); }); if (sel.outdoor === "none") no.push("Outdoor compound or garden"); no.push("A follow-up visit, unless we agree it"); }
    else { Object.keys(P.extras).forEach(function (k) { var e = P.extras[k]; if ((e.for === "home" && !home) || (e.needs === "kitchen" && (!home || sel.kitchen === "none")) || sel.extras.indexOf(k) > -1) return; no.push(e.label); }); if (!sel.extraWindows) no.push("Window cleaning"); }
    no.push("Any room or area not listed on the left"); no = no.slice(0, 7);
    $("scope").innerHTML = '<div class="yes"><h4>We will attend to</h4><ul>' + yes.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ul></div><div class="no"><h4>We will not do, unless we agree it first</h4><ul>' + no.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>";
    $("preview").textContent = PR.bookingText(b, P, S.slots);
  }
  function setErr(id, msg) { var i = $(id), e = $(id + "Err"); if (!i || !e) return; e.textContent = msg; i.setAttribute("aria-invalid", msg ? "true" : "false"); }
  function bad(ids) { for (var i = 0; i < ids.length; i++) if ($(ids[i]).getAttribute("aria-invalid") === "true") return $(ids[i]); return null; }
  function validate(n) {
    var ids = [];
    if (n === 1) { ids = ["city"]; setErr("city", cityObj() ? "" : "Please choose the city where we will work."); }
    if (n === 4) { ids = ["date", "street"]; var d = val("date"); setErr("date", !d ? "Choose the day you'd like us to come." : d < $("date").min ? "Please choose " + PR.longDate($("date").min) + " or later." : d > $("date").max ? "Please choose a date within the next " + S.maxDaysAhead + " days." : !openDay(d) ? "We're closed on that date. Please choose another day." : ""); setErr("street", val("street").trim().length < 4 ? "Enter your street address so we can find you." : ""); }
    if (n === 5) { ids = ["name", "phone", "email"]; var dg = val("phone").replace(/\D/g, ""); setErr("name", val("name").trim().length < 2 ? "Enter your name so we know who to reply to." : ""); setErr("phone", dg.length < 10 || dg.length > 15 ? "Enter a phone number we can reach, for example 0801 234 5678." : ""); setErr("email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val("email").trim()) ? "" : "Enter a valid email. We'll send your confirmation there.");
      var b5 = bad(ids); if (b5) { b5.focus(); return false; } var ok = $("consent").checked; $("consentErr").textContent = ok ? "" : termsState.read ? "Tick the box to agree." : "Please scroll through the terms to the end, then tick the box."; if (!ok) $("terms").focus(); return ok; }
    var b = bad(ids); if (b) { b.focus(); return false; } return true;
  }
  var steps = qsa(".step", form), backBtn = $("backBtn"), nextBtn = $("nextBtn"), lis = qsa("#wiz li");
  function go(n, dir, focus) {
    stepNo = n; maxStep = Math.max(maxStep, n);
    steps.forEach(function (s) { var on = +s.getAttribute("data-step") === n; s.hidden = !on; if (on) { s.style.setProperty("--dx", dir >= 0 ? "30px" : "-30px"); s.classList.remove("enter"); void s.offsetWidth; if (!calm) s.classList.add("enter"); } });
    lis.forEach(function (li, i) { li.classList.toggle("on", i + 1 === n); li.classList.toggle("done", i + 1 < n); if (i + 1 === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current"); });
    var rn = form.querySelector(".req-note"); if (rn) rn.hidden = n !== 1; $("wizFill").style.width = ((n - 1) / (TOTAL - 1) * 100) + "%"; backBtn.hidden = n === 1; nextBtn.hidden = n === TOTAL;
    nextBtn.textContent = ["Continue to rooms", "Continue to extras", "Continue to date and address", "Continue to review"][n - 1] || "Continue";
    if (n === TOTAL) { lastBook = booking(); renderReview(); setTimeout(function () { if (termsState.check) termsState.check(); }, 80); }
    if (focus) { scrollTo({ top: form.getBoundingClientRect().top + scrollY - 90, behavior: calm ? "auto" : "smooth" }); var h = steps[n - 1].querySelector("h3"); if (h) h.focus({ preventScroll: true }); }
    saveDraft();
  }
  function next() { if ((stepNo === 1 || stepNo === 4) && !validate(stepNo)) return; if (stepNo < TOTAL) go(stepNo + 1, 1, true); }
  nextBtn.addEventListener("click", next); backBtn.addEventListener("click", function () { if (stepNo > 1) go(stepNo - 1, -1, true); });
  lis.forEach(function (li, i) { li.addEventListener("click", function () { var t = i + 1; if (t === stepNo || t > maxStep) return; go(t, t > stepNo ? 1 : -1, true); }); });
  form.addEventListener("submit", function (e) { e.preventDefault(); if (stepNo < TOTAL) next(); });
  $("summary").addEventListener("click", function (e) { var b = e.target.closest("[data-goto]"); if (b) go(+b.getAttribute("data-goto"), -1, true); });
  $("changeCity").addEventListener("click", function () { go(1, -1, true); setTimeout(function () { $("city").focus(); }, 300); });
  var saveT;
  function onChange(e) { if (!started) { started = true; FN.track("quote_start"); } var t = e && e.target; if (t && t.name === "type") { buildPresets(); if (t.value === "regular" && val("freq") === "once") form.querySelector('input[name="freq"][value="weekly"]').checked = true; } if (t && (/^r_/.test(t.name || "") || t.name === "kitchen" || t.name === "open")) markPreset(); syncUI(); render(); clearTimeout(saveT); saveT = setTimeout(saveDraft, 400); }
  form.addEventListener("input", onChange); form.addEventListener("change", onChange);
  form.addEventListener("click", function (e) {
    var b = e.target.closest(".num button"); if (b) { var i = $(b.getAttribute("data-for")), mn = +i.min, mx = +i.max; i.value = Math.min(mx, Math.max(mn, (parseInt(i.value, 10) || 0) + parseInt(b.getAttribute("data-d"), 10))); i.dispatchEvent(new Event("input", { bubbles: true })); return; }
    var p = e.target.closest("[data-preset]"); if (p) { applyPreset(PRESETS[group()].filter(function (x) { return x.id === p.getAttribute("data-preset"); })[0]); syncUI(); render(); saveDraft(); }
  });
  $("budget").addEventListener("input", function () { var d = this.value.replace(/\D/g, ""); this.value = d ? Number(d).toLocaleString("en-NG") : ""; });
  ["city", "date", "street"].forEach(function (id) { $(id).addEventListener("input", function () { setErr(id, ""); }); $(id).addEventListener("change", function () { setErr(id, ""); }); }); ["name", "phone", "email"].forEach(function (id) { $(id).addEventListener("input", function () { setErr(id, ""); }); });
  $("date").addEventListener("change", function () { var d = val("date"); qsa('input[name="slot"]', form).forEach(function (i) { i.disabled = false; }); if (!d || !FN.online) return; FN.api("availability?date=" + d).then(function (a) { if (val("date") !== d) return; if (a.closed) { setErr("date", "We're closed on that date. Please choose another day."); return; } qsa('input[name="slot"]', form).forEach(function (i) { if (i.value !== "any" && a.slots[i.value] === 0) { i.disabled = true; if (i.checked) form.querySelector('input[name="slot"][value="any"]').checked = true; } }); }).catch(function () {}); });
  /* ----- AI quote assistant: fills the form from a description; prices still come from the fixed rules ----- */
  function applyAI(r) {
    var t = form.querySelector('input[name="type"][value="' + r.sel.type + '"]'); if (t) t.checked = true; buildPresets(); var g = group();
    PR.roomDefs(g, P).forEach(function (d) { $("r_" + g + "_" + d.id).value = r.sel.rooms[d.id] || 0; });
    [["kitchen", r.sel.kitchen], ["open", r.sel.open], ["outdoor", r.sel.outdoor], ["cond", r.sel.cond], ["freq", r.sel.freq]].forEach(function (x) { var el = form.querySelector('input[name="' + x[0] + '"][value="' + x[1] + '"]'); if (el) el.checked = true; });
    qsa('input[name="extras"]', form).forEach(function (i) { i.checked = r.sel.extras.indexOf(i.value) > -1; }); qsa('input[name="pests"]', form).forEach(function (i) { i.checked = r.sel.pests.indexOf(i.value) > -1; });
    if (r.city) { var c = S.cities.filter(function (x) { return x.name === r.city; })[0]; if (c) $("city").value = c.id; } if (r.date) { $("date").value = r.date; $("date").dispatchEvent(new Event("change", { bubbles: true })); } if (r.flex) $("flex").checked = true; if (r.notes && !val("instructions")) $("instructions").value = r.notes;
    markPreset(); syncUI(); render(); saveDraft();
  }
  $("aiGo").addEventListener("click", function () {
    var btn = this, text = $("aiText").value.trim(), note = $("aiNote"), res = $("aiResult"); note.textContent = ""; if (text.length < 8) { note.textContent = "Write a little more about your place and what you need."; $("aiText").focus(); return; }
    if (!FN.online) { note.textContent = "The assistant is not reachable right now. You can fill the form by hand."; return; } btn.disabled = true; btn.textContent = "Reading your description...";
    FN.api("ai/parse", { body: { text: text } }).then(function (r) {
      applyAI(r); var li = function (a) { return a.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join(""); };
      res.hidden = false; res.innerHTML = '<h4>Here is what we understood. Everything is filled in below, and you can change any of it.</h4><ul><li>' + esc(r.preview.label) + (r.city ? " in " + esc(r.city) : "") + (r.date ? ", " + esc(PR.longDate(r.date)) : "") + "</li><li>" + esc(est.lines.map(function (l) { return l.label; }).join(", ")) + "</li><li>Estimated " + fmt(est.low) + " to " + fmt(est.high) + " per visit</li></ul>" + (r.assumptions.length ? "<h4>We assumed</h4><ul>" + li(r.assumptions) + "</ul>" : "") + (r.questions.length ? '<h4>Worth checking</h4><ul class="qs">' + li(r.questions) + "</ul>" : "");
      FN.toast("Form filled in. Check the details."); FN.burst(btn);
    }).catch(function (e) { note.textContent = e.message; }).then(function () { btn.disabled = false; btn.textContent = "Fill the form for me"; });
  });
  /* ----- terms must be read before the box unlocks ----- */
  $("consent").addEventListener("change", function () { if (this.checked) $("consentErr").textContent = ""; });
  function mountTerms() { termsState = T.mount({ box: $("terms"), fill: $("readFill"), text: $("readText"), onRead: function (st) { termsState = st; termsState.read = true; $("consent").disabled = false; $("consentLine").classList.remove("locked"); $("consentBox").classList.add("read"); FN.toast("Thanks for reading. You can tick the box now."); } }); }
  var KEY = "fn_draft_v5";
  function skip(n) { return !n || n === "consent" || n === "website"; }
  function saveDraft() { if (!built) return; try { var d = { step: stepNo, v: {} }; qsa("input,select,textarea", form).forEach(function (el) { if (skip(el.name) || el.id === "aiText") return; if (el.type === "radio") { if (el.checked) d.v[el.name] = el.value; } else if (el.type === "checkbox") { d.v[el.name] = d.v[el.name] || []; if (el.checked) d.v[el.name].push(el.value || "on"); } else d.v[el.name] = el.value; }); localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
  function clearDraft() { try { localStorage.removeItem(KEY); } catch (e) {} }
  function restore() { try { var d = JSON.parse(localStorage.getItem(KEY) || "null"); if (!d || !d.v) return false; qsa("input,select,textarea", form).forEach(function (el) { if (skip(el.name) || !(el.name in d.v)) return; var v = d.v[el.name]; if (el.type === "radio") el.checked = el.value === v; else if (el.type === "checkbox") el.checked = (v || []).indexOf(el.value || "on") > -1; else if (el.tagName === "SELECT") { if (qsa("option", el).some(function (o) { return o.value === v || o.textContent === v; })) el.value = v; } else el.value = v; }); if ($("date").value && ($("date").value < $("date").min || $("date").value > $("date").max)) $("date").value = ""; return d.step || 1; } catch (e) { return false; } }
  /* ----- sending ----- */
  var statusEl = $("status");
  function msg(t, err) { statusEl.hidden = false; statusEl.classList.toggle("is-error", !!err); statusEl.textContent = t; }
  function ics(b, ref) { var d = (b.schedule.date || "").replace(/-/g, ""), start = { morning: "080000", midday: "110000", afternoon: "140000", evening: "170000" }[b.schedule.slot] || "090000", end = String(+start.slice(0, 2) + 3).padStart(2, "0") + start.slice(2); return "data:text/calendar;charset=utf-8," + encodeURIComponent(["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FreshNest//EN", "BEGIN:VEVENT", "UID:" + ref + "@freshnest", "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z", "DTSTART:" + d + "T" + start, "DTEND:" + d + "T" + end, "SUMMARY:FreshNest: " + b.estimate.label, "DESCRIPTION:Booking " + ref + ". Final price and time confirmed by FreshNest.", "LOCATION:" + PR.where(b), "END:VEVENT", "END:VCALENDAR"].join("\r\n")); }
  function success(mode, ref, c) {
    $("formBody").hidden = true; qsa("#wiz,.wbar,.req-note", form).forEach(function (e) { e.hidden = true; }); $("success").hidden = false; $("successTitle").textContent = mode === "wa" ? "Almost there" : "Booking received"; $("successRef").hidden = !ref; $("refCode").textContent = ref || "";
    $("successText").textContent = mode === "wa" ? (ref ? "Your booking is saved and we've emailed a confirmation. " : "") + "We opened WhatsApp with your details. Press send there to deliver them to us." : "We've emailed your confirmation to " + c.email + ". We'll contact you on " + c.pref + " at " + c.phone + " to confirm the final price and time.";
    var wa = $("successWa"); wa.href = FN.whatsappUrl(mode === "wa" ? PR.bookingText(Object.assign({}, lastBook, { ref: ref }), P, S.slots) : "Hello, I just booked on the website." + (ref ? " My reference is " + ref + "." : "")); wa.textContent = mode === "wa" ? "Open WhatsApp again" : "Message us on WhatsApp";
    $("successTrack").hidden = !ref; if (ref) { try { localStorage.setItem("fn_last", JSON.stringify({ ref: ref, contact: c.email })); } catch (e) {} $("successTrack").href = "contact.html?ref=" + encodeURIComponent(ref) + "#track"; }
    var old = $("successCal"); if (old) old.remove(); if (ref && lastBook.schedule.date) { var a = document.createElement("a"); a.id = "successCal"; a.className = "btn btn-ghost"; a.textContent = "Add to calendar"; a.href = ics(lastBook, ref); a.download = "freshnest-" + ref + ".ics"; $("successTrack").parentNode.insertBefore(a, $("successTrack").nextSibling); }
    clearDraft(); FN.burst($("success").querySelector(".check-anim")); scrollTo({ top: form.getBoundingClientRect().top + scrollY - 90, behavior: calm ? "auto" : "smooth" }); $("successTitle").focus({ preventScroll: true });
  }
  function submit(channel, btn) {
    for (var n = 1; n <= 5; n++) { if ((n === 1 || n === 4 || n === 5) && !validate(n)) { if (n !== 5) go(n, -1, true); return; } }
    var b = booking(channel); lastBook = b; var label = btn.innerHTML; btn.disabled = true; btn.textContent = "Sending..."; var c = b.customer, text = PR.bookingText(b, P, S.slots);
    function done() { btn.disabled = false; btn.innerHTML = label; }
    if (!FN.online) { done(); if (channel === "whatsapp") { FN.openLink(FN.whatsappUrl(text)); success("wa", "", c); } else { FN.openLink(FN.mailtoUrl("Booking request: " + est.label + " (" + c.name + ")", text)); msg("Our booking system isn't reachable right now, so we opened your email app. Press send to finish, or use the WhatsApp button.", true); } return; }
    FN.api("bookings", { body: b }).then(function (r) { done(); if (channel === "whatsapp") FN.openLink(FN.whatsappUrl(PR.bookingText(Object.assign({}, b, { ref: r.ref }), P, S.slots))); success(channel === "whatsapp" ? "wa" : "saved", r.ref, c); })
      .catch(function (e) { done(); if (e.field && $(e.field)) { go({ city: 1, date: 4, street: 4, slot: 4 }[e.field] || 5, -1, true); setErr(e.field, e.message); $(e.field).focus(); } else msg(e.status && e.status < 500 ? e.message : "We couldn't send your booking just now. Please try again, or use the WhatsApp button: it opens with all your details ready.", true); });
  }
  $("sendEmail").addEventListener("click", function () { submit("email", this); }); $("sendWa").addEventListener("click", function () { submit("whatsapp", this); });
  $("again").addEventListener("click", function () { form.reset(); $("success").hidden = true; $("formBody").hidden = false; qsa("#wiz,.wbar", form).forEach(function (e) { e.hidden = false; }); statusEl.hidden = true; maxStep = 1; $("aiResult").hidden = true; buildPresets(); syncUI(); render(); go(1, -1, true); });
  FN.ready.then(function () {
    build(); mountTerms(); var qs = new URLSearchParams(window.FN_QUERY !== undefined ? window.FN_QUERY : location.search), saved = restore();
    var want = qs.get("service"); if (want && P.service[want]) { var r = form.querySelector('input[name="type"][value="' + want + '"]'); if (r) { r.checked = true; if (want === "regular") form.querySelector('input[name="freq"][value="weekly"]').checked = true; } }
    var cw = (qs.get("city") || "").toLowerCase(); if (cw) { var cc = S.cities.filter(function (c) { return c.id === cw || c.name.toLowerCase() === cw; })[0]; if (cc) $("city").value = cc.id; }
    if (!FN.online) { $("closedNotice").hidden = false; $("closedNotice").textContent = "Our booking system isn't reachable right now. You can still send your request on WhatsApp at the end and we'll take it from there."; }
    buildPresets(); syncUI(); render(); if (saved && saved > 1 && !want) { maxStep = saved; go(Math.min(saved, TOTAL), 1, false); FN.toast("We restored your unfinished booking"); } else go(1, 1, false);
    if (location.hash === "#ai" || (window.FN_HASH === "#ai")) setTimeout(function () { $("ai").scrollIntoView({ behavior: calm ? "auto" : "smooth" }); $("aiText").focus({ preventScroll: true }); }, 400);
  });
})();
