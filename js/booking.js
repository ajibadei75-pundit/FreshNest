/* ==========================================================================
   Booking page (/book): five steps, a live estimate, and sending.
   - The price shown is calculated by FNPricing, the same code the server uses to re-check it.
   - The consent box stays locked until the customer has scrolled the terms to the end.
   - "Send booking request" saves the booking on our server. If the server can't be reached, it falls back
     to the customer's email app.
   - Links such as /book?service=deep&city=Lagos start the form with those choices made.
   ========================================================================== */
(function () {
  "use strict";
  var F = window.FNPricing, P = F.PRICING, R = F.RULES, FN = window.FN;
  var $ = FN.$, qsa = FN.qsa, esc = FN.esc, fmt = F.fmt, reduced = FN.reduced;
  var form = $("quoteForm"), TOTAL = 5, stepNo = 1, maxStep = 1;
  var TICK = '<span class="box"><svg class="i" aria-hidden="true"><use href="#i-tick"/></svg></span>';
  var FIELD_STEP = { type: 1, city: 1, date: 4, street: 4, name: 5, phone: 5, email: 5, consent: 5 };
  var ICON = { residential: "home", office: "building", deep: "sparkle", hostel: "bed", move: "box", regular: "repeat", construction: "layers" };
  var TILE_SUB = { residential: "Flats and houses", office: "Offices and shops", deep: "Top to bottom", hostel: "Rooms and shared areas", move: "Empty-home clean", regular: "Weekly, monthly or once", construction: "Dust and debris" };
  var TILE_NAME = { residential: "Residential", office: "Office & Commercial", deep: "Deep cleaning", hostel: "Hostel", move: "Move-in & Move-out", regular: "One-time & Regular", construction: "Post-Construction" };
  var SET_CONTAINER = { home: "roomsHome", office: "roomsOffice", hostel: "roomsHostel" };

  /* ---------- Build the option lists from the pricing rules ---------- */
  var services = Object.keys(P.service);
  $("tiles").innerHTML = services.map(function (k, i) {
    return '<label class="tile"><input type="radio" name="type" value="' + k + '"' + (i === 0 ? " checked" : "") + '><span class="tcard"><svg class="i" aria-hidden="true"><use href="#i-' + ICON[k] + '"/></svg><b>' + esc(TILE_NAME[k]) + "</b><small>" + esc(TILE_SUB[k]) + "</small></span></label>";
  }).join("");
  $("city").insertAdjacentHTML("beforeend", R.cities.map(function (c) { return '<option value="' + esc(c.name) + '">' + esc(c.name) + ", " + esc(c.state) + " State</option>"; }).join(""));

  function segHtml(name, set, def) {
    return Object.keys(set).map(function (k) {
      return '<label><input type="radio" name="' + name + '" value="' + k + '"' + (k === def ? " checked" : "") + "><span>" + esc(set[k].label) + (set[k].hint ? "<small>" + esc(set[k].hint) + "</small>" : "") + "</span></label>";
    }).join("");
  }
  $("kitchenSeg").innerHTML = segHtml("kitchen", P.kitchen, "standard");
  $("openSeg").innerHTML = segHtml("open", P.office.open, "none");
  $("freqSeg").innerHTML = Object.keys(P.freq).map(function (k) {
    var f = P.freq[k];
    return '<label><input type="radio" name="freq" value="' + k + '"' + (k === "once" ? " checked" : "") + "><span>" + esc(f.label) + (f.off ? "<small>" + Math.round(f.off * 100) + "% off</small>" : "") + "</span></label>";
  }).join("");

  function roomRow(set, d) {
    var id = "r_" + set + "_" + d.id;
    return '<div class="room"><div class="t">' + esc(d.label) + (d.hint ? "<small>" + esc(d.hint) + "</small>" : "") + '</div><div class="num"><button type="button" data-d="-1" data-for="' + id + '" aria-label="Fewer ' + esc(d.label.toLowerCase()) + '">&minus;</button><input id="' + id + '" name="' + id + '" data-set="' + set + '" data-room="' + d.id + '" type="number" min="0" max="' + d.max + '" value="' + d.def + '" inputmode="numeric" aria-label="' + esc(d.label) + '"><button type="button" data-d="1" data-for="' + id + '" aria-label="More ' + esc(d.label.toLowerCase()) + '">+</button></div></div>';
  }
  Object.keys(SET_CONTAINER).forEach(function (set) { $(SET_CONTAINER[set]).innerHTML = F.roomSet(P, set).map(function (d) { return roomRow(set, d); }).join(""); });

  $("extras").innerHTML = Object.keys(P.extras).map(function (k) {
    var e = P.extras[k];
    return '<label class="chk" data-for="' + e.for + '" data-needs="' + (e.needs || "") + '"><input type="checkbox" name="extras" value="' + k + '">' + TICK + '<span class="t">' + esc(e.label) + '</span><span class="p">+' + fmt(e.price) + "</span></label>";
  }).join("");
  $("extraWinHint").textContent = fmt(P.windowInside) + " per window";
  $("slots").innerHTML = '<label class="slot"><input type="radio" name="slot" value="any" checked><span>Any time<small>We\'ll suggest</small></span></label>' + R.slots.map(function (s) {
    return '<label class="slot"><input type="radio" name="slot" value="' + s.id + '"><span>' + esc(s.label) + "<small>" + esc(s.time) + "</small></span></label>";
  }).join("");
  $("focus").innerHTML = ["Kitchen", "Bathrooms", "Bedrooms", "Living areas", "Windows", "Floors", "Balcony", "Inside cupboards"].map(function (t) {
    return '<label><input type="checkbox" name="focus" value="' + t + '"><span>' + t + "</span></label>";
  }).join("");

  /* ---------- Dates ---------- */
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  var dMin = new Date(); dMin.setDate(dMin.getDate() + R.leadDays);
  var dMax = new Date(); dMax.setDate(dMax.getDate() + R.maxDaysAhead);
  $("date").min = ymd(dMin); $("date").max = ymd(dMax);
  function longDate(v) { try { return new Date(v + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch (e) { return v; } }

  /* ---------- Read the form ---------- */
  function val(n) { return form.elements[n] ? form.elements[n].value : ""; }
  function checked(name) { return !!(form.elements[name] && form.elements[name].checked); }
  function list(name) { return qsa('input[name="' + name + '"]:checked', form).map(function (i) { return i.value; }); }
  function setOf(type) { return (P.service[type] || P.service.residential).set; }
  function readSel() {
    var type = val("type"), set = setOf(type), rooms = {};
    qsa('input[data-set="' + set + '"]', form).forEach(function (i) { rooms[i.getAttribute("data-room")] = F.clamp(i.value, 0, +i.max); });
    return { type: type, size: val("size"), cond: val("cond"), kitchen: val("kitchen"), open: val("open"), rooms: rooms, extras: list("extras"), extraWindows: F.clamp($("extraWindows").value, 0, 40), freq: val("freq") };
  }

  /* ---------- Quick-start layouts ---------- */
  var presetSet = null;
  function buildPresets(set) {
    if (presetSet === set) return; presetSet = set;
    $("presets").innerHTML = (F.PRESETS[set] || []).map(function (p, i) { return '<button type="button" class="preset" data-i="' + i + '" aria-pressed="false"><b>' + esc(p.label) + "</b><small>" + esc(p.hint) + "</small></button>"; }).join("");
  }
  function applyPreset(set, p) {
    qsa('input[data-set="' + set + '"]', form).forEach(function (i) { i.value = Math.min(+i.max, p.rooms[i.getAttribute("data-room")] || 0); });
    if (p.kitchen) qsa('input[name="kitchen"]', form).forEach(function (r) { r.checked = r.value === p.kitchen; });
    if (p.open) qsa('input[name="open"]', form).forEach(function (r) { r.checked = r.value === p.open; });
  }
  function markPreset() {
    var set = setOf(val("type")), s = readSel(), ids = F.roomSet(P, set).map(function (d) { return d.id; });
    qsa("#presets .preset").forEach(function (b) {
      var p = F.PRESETS[set][+b.getAttribute("data-i")], same = ids.every(function (id) { return (p.rooms[id] || 0) === (s.rooms[id] || 0); });
      if (same && p.kitchen) same = s.kitchen === p.kitchen;
      if (same && p.open) same = s.open === p.open;
      b.setAttribute("aria-pressed", same);
    });
  }
  $("presets").addEventListener("click", function (e) {
    var b = e.target.closest(".preset"); if (!b) return;
    var set = setOf(val("type")); applyPreset(set, F.PRESETS[set][+b.getAttribute("data-i")]);
    onChange(); FN.toast(b.querySelector("b").textContent + " layout applied. Adjust anything below.");
  });

  /* ---------- Show or hide parts for the chosen service ---------- */
  var freqTouched = false;
  function syncUI() {
    var type = val("type"), set = setOf(type), isHome = set === "home", isOffice = set === "office", isHostel = set === "hostel";
    qsa(".only-home").forEach(function (el) { el.hidden = !isHome; });
    qsa(".grp-home").forEach(function (el) { el.hidden = !isHome; });
    qsa(".grp-office").forEach(function (el) { el.hidden = !isOffice; });
    qsa(".grp-hostel").forEach(function (el) { el.hidden = !isHostel; });
    $("roomsTitle").textContent = isOffice ? "What does your workplace include?" : isHostel ? "What does your hostel include?" : "Which rooms need cleaning?";
    buildPresets(set);
    var noKitchen = isHome && val("kitchen") === "none";
    qsa("#extras .chk").forEach(function (l) {
      var hide = (l.getAttribute("data-for") === "home" && !isHome) || (l.getAttribute("data-needs") === "kitchen" && (!isHome || noKitchen));
      l.hidden = hide; if (hide) l.querySelector("input").checked = false;
    });
    $("extrasNote").textContent = noKitchen ? "Kitchen extras appear when you have a kitchen" : "";
    qsa(".room", form).forEach(function (r) { var i = r.querySelector("input"); if (i) r.classList.toggle("has", +i.value > 0); });
    $("petRow").hidden = !$("pets").checked;
    $("cityEcho").textContent = val("city") || "your city";
  }
  /* One-time & Regular starts on a fortnightly plan, other services on a single visit, until the customer chooses */
  function defaultFrequency() {
    if (freqTouched) return;
    var want = val("type") === "regular" ? "fortnight" : "once";
    qsa('input[name="freq"]', form).forEach(function (r) { r.checked = r.value === want; });
  }

  /* ---------- Estimate panel, price bar and sheet ---------- */
  var shownLow = 0, shownHigh = 0, raf = null, lastKey = "";
  function txt(a, b) { return fmt(a) + " \u2013 " + fmt(b); }
  function paintPrice(low, high) {
    cancelAnimationFrame(raf);
    var els = [$("priceNum"), $("abPrice"), $("sheetPrice")];
    function put(a, b) { els.forEach(function (el) { if (el) el.textContent = txt(a, b); }); }
    if (reduced) { put(low, high); shownLow = low; shownHigh = high; return; }
    var fl = shownLow, fh = shownHigh, t0 = null;
    raf = requestAnimationFrame(function step(t) {
      if (t0 === null) t0 = t;
      var p = Math.min((t - t0) / 450, 1), e = 1 - Math.pow(1 - p, 3);
      shownLow = fl + (low - fl) * e; shownHigh = fh + (high - fh) * e; put(shownLow, shownHigh);
      if (p < 1) raf = requestAnimationFrame(step); else { put(low, high); shownLow = low; shownHigh = high; }
    });
  }
  function row(l, v, c) { return '<li class="' + (c || "") + '"><span>' + esc(l) + "</span><span>" + v + "</span></li>"; }
  var est = null, sel = null;
  function render() {
    sel = readSel(); est = F.estimate(sel, P);
    var key = est.low + "-" + est.high;
    if (key !== lastKey) { paintPrice(est.low, est.high); lastKey = key; }
    $("priceSr").textContent = "Estimated price " + fmt(est.low) + " to " + fmt(est.high) + " per visit";
    var note = est.label + (est.freqKey !== "once" ? ", " + est.freq.label.toLowerCase() : "");
    $("priceNote").textContent = note; $("sheetNote").textContent = note;
    var pills = '<span class="pill">About ' + est.hours + (est.hours === 1 ? " hour" : " hours") + '</span><span class="pill">' + est.crew + (est.crew === 1 ? " cleaner" : " cleaners") + "</span>" + (est.monthly ? '<span class="pill">' + est.freq.visits + " visits a month: about " + fmt(est.monthly) + "</span>" : "");
    $("pills").innerHTML = pills; $("sheetPills").innerHTML = pills;
    var h = row("Rooms and areas", "", "head");
    est.lines.forEach(function (l) { h += row(l.label, fmt(l.amount)); });
    if (est.adjust.length) h += '<li class="head"><span>Includes: ' + esc(est.adjust.join(", ")) + "</span></li>";
    if (est.callout) h += row("Call-out, transport and supplies", fmt(est.callout));
    if (est.extraLines.length) { h += row("Extras", "", "head"); est.extraLines.forEach(function (l) { h += row(l.label, "+" + fmt(l.amount)); }); }
    if (est.floorApplied) h += row("Minimum visit charge applies", fmt(est.minCharge));
    if (est.discount > 1) h += row(est.freq.label + " plan", "\u2212" + fmt(est.discount), "neg");
    h += row("Estimated total", fmt(est.total), "tot");
    $("brkList").innerHTML = h; $("sheetList").innerHTML = h;
    if (stepNo === TOTAL) renderSummary();
  }
  var sheet = $("sheet");
  $("openSheet").addEventListener("click", function () { $("sheetPrice").textContent = txt(est.low, est.high); if (sheet.showModal) sheet.showModal(); else sheet.setAttribute("open", ""); });
  $("sheetClose").addEventListener("click", function () { if (sheet.close) sheet.close(); else sheet.removeAttribute("open"); });
  sheet.addEventListener("click", function (e) { if (e.target === sheet && sheet.close) sheet.close(); });

  /* ---------- Summary and message ---------- */
  function slotText() { var v = val("slot"); if (v === "any") return "Any time"; var s = R.slots.filter(function (x) { return x.id === v; })[0]; return s ? s.label + " (" + s.time + ")" : "Any time"; }
  function facts() {
    var f = [];
    if (!checked("water")) f.push("No running water on site");
    if (!checked("power")) f.push("No electricity on site");
    if (checked("parking")) f.push("Parking available");
    if (checked("gate")) f.push("Gate pass or ID needed");
    if (checked("pets")) f.push("Pets: " + (val("petType").trim() || "yes"));
    return f;
  }
  function extrasText() { var t = est.extraLines.map(function (l) { return l.label; }); return t.length ? t.join(", ") : "None"; }
  function roomsText() {
    var t = est.lines.map(function (l) { return l.label; });
    if (est.set === "home" && val("kitchen") === "none") t.push("no kitchen");
    return t.join(", ");
  }
  function addressText() { return [val("street").trim(), val("city")].filter(Boolean).join(", ") + (val("landmark").trim() ? " (near " + val("landmark").trim() + ")" : ""); }
  var CONDITION = { light: "Lightly used", normal: "Normal", heavy: "Very dirty" };
  function summaryRows() {
    var isHome = est.set === "home";
    var rows = [
      ["Service", est.label + (isHome ? ": " + val("propType") + ", " + val("size") + " size" : ""), 1],
      ["City", val("city"), 1],
      ["Rooms", roomsText() + (val("otherRooms").trim() ? ". Also: " + val("otherRooms").trim() : ""), 2],
      ["Condition", CONDITION[val("cond")], 2],
      ["Extras and plan", extrasText() + ". " + est.freq.label, 3],
      ["When", (val("date") ? longDate(val("date")) : "Not chosen yet") + ", " + slotText() + (checked("flex") ? " (flexible)" : ""), 4],
      ["Address", addressText(), 4],
      ["Access", val("access") + ", " + val("floor").toLowerCase() + (facts().length ? ". " + facts().join(", ") : ""), 4]
    ];
    if (list("focus").length || val("instructions").trim()) rows.push(["Notes", [list("focus").length ? "Focus: " + list("focus").join(", ") : "", val("instructions").trim()].filter(Boolean).join(". "), 4]);
    if (val("budget").trim()) rows.push(["Your budget", "\u20A6" + val("budget").trim().replace(/^\u20A6/, ""), 4]);
    rows.push(["Estimate", fmt(est.low) + " to " + fmt(est.high) + " per visit, about " + est.hours + "h with " + est.crew + (est.crew === 1 ? " cleaner" : " cleaners"), 0]);
    return rows;
  }
  function renderSummary() {
    $("summary").innerHTML = summaryRows().map(function (r) {
      return '<div class="srow"><dt>' + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>" + (r[2] ? '<button type="button" data-goto="' + r[2] + '">Edit</button>' : "<span></span>") + "</div>";
    }).join("");
    $("preview").textContent = buildMessage();
  }
  function buildMessage() {
    var isHome = est.set === "home", L = [];
    L.push("NEW BOOKING REQUEST (" + FN.settings.name + " website)", "");
    L.push("SERVICE", "Type: " + est.label);
    if (isHome) L.push("Property: " + val("propType") + ", " + val("size") + " size", "Kitchen: " + (val("kitchen") === "none" ? "None" : P.kitchen[val("kitchen")].label));
    L.push("Rooms: " + (est.lines.map(function (l) { return l.label; }).join(", ") || "None listed"));
    if (val("otherRooms").trim()) L.push("Other rooms or areas: " + val("otherRooms").trim());
    L.push("Condition: " + CONDITION[val("cond")], "Extras: " + extrasText(), "Frequency: " + est.freq.label, "");
    L.push("SCHEDULE", "Date: " + (val("date") ? longDate(val("date")) : "Not chosen") + (checked("flex") ? " (flexible)" : ""), "Time: " + slotText(), "");
    L.push("LOCATION", "City: " + val("city"), "Address: " + val("street").trim());
    if (val("landmark").trim()) L.push("Landmark: " + val("landmark").trim());
    L.push("Access: " + val("access") + "; " + val("floor"));
    L.push("Water on site: " + (checked("water") ? "Yes" : "No"), "Electricity on site: " + (checked("power") ? "Yes" : "No"), "Parking for team: " + (checked("parking") ? "Yes" : "No"), "Gate pass or ID needed: " + (checked("gate") ? "Yes" : "No"), "Pets: " + (checked("pets") ? "Yes (" + (val("petType").trim() || "not specified") + ")" : "No"));
    if (list("focus").length) L.push("Focus areas: " + list("focus").join(", "));
    if (val("instructions").trim()) L.push("Instructions: " + val("instructions").trim());
    L.push("", "ESTIMATE", "Range: " + fmt(est.low) + " to " + fmt(est.high) + " per visit (mid " + fmt(est.total) + ")", "Time: about " + est.hours + " hours with " + est.crew + (est.crew === 1 ? " cleaner" : " cleaners"));
    if (val("budget").trim()) L.push("Customer budget: \u20A6" + val("budget").trim().replace(/^\u20A6/, ""));
    L.push("", "CONTACT", "Name: " + val("name").trim(), "Phone: " + val("phone").trim());
    if (val("email").trim()) L.push("Email: " + val("email").trim());
    L.push("Prefers: " + val("pref"), "", "Terms and privacy notice read and accepted (version " + R.termsVersion + ")");
    return L.join("\n");
  }
  function payload() {
    return {
      selection: sel,
      details: {
        propType: val("propType"), otherRooms: val("otherRooms"), date: val("date"), flex: checked("flex"), slot: val("slot"),
        city: val("city"), street: val("street"), landmark: val("landmark"), access: val("access"), floor: val("floor"),
        water: checked("water"), power: checked("power"), parking: checked("parking"), gate: checked("gate"),
        pets: checked("pets"), petType: val("petType"), focus: list("focus"), instructions: val("instructions"), budget: val("budget")
      },
      contact: { name: val("name"), phone: val("phone"), email: val("email"), pref: val("pref") },
      consent: { accepted: true, version: R.termsVersion },
      message: buildMessage(),
      website: val("website")
    };
  }

  /* ---------- Consent: unlock the tick box only after the terms are read ---------- */
  var terms = $("terms"), consent = $("consent"), consentLine = $("consentLine"), consentBox = $("consentBox"), hasRead = false;
  function unlockConsent() {
    hasRead = true; consent.disabled = false;
    consentLine.classList.remove("locked"); consentBox.classList.add("is-read");
    $("readFill").style.width = "100%"; $("readText").textContent = "Thanks for reading. You can now tick the box.";
  }
  function updateRead() {
    if (hasRead || !terms.clientHeight) return;               /* hidden (another step is showing) */
    var max = terms.scrollHeight - terms.clientHeight;
    if (max <= 4 || terms.scrollTop >= max - 6) { unlockConsent(); return; }
    var pct = Math.round(Math.min(1, terms.scrollTop / max) * 100);
    $("readFill").style.width = pct + "%";
    $("readText").textContent = "Keep scrolling to unlock the tick box (" + pct + "% read)";
  }
  function resetConsent() {
    hasRead = false; consent.checked = false; consent.disabled = true; terms.scrollTop = 0;
    consentLine.classList.add("locked"); consentBox.classList.remove("is-read");
    $("readFill").style.width = "0"; $("readText").textContent = "Scroll to read the terms"; $("consentErr").textContent = "";
  }
  terms.addEventListener("scroll", updateRead, { passive: true });
  consentLine.addEventListener("click", function (e) {
    if (hasRead) return;
    e.preventDefault();
    $("consentErr").textContent = "Please read the terms to the end first, then tick the box.";
    terms.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" }); terms.focus({ preventScroll: true });
  });
  consent.addEventListener("change", function () { if (this.checked) $("consentErr").textContent = ""; });

  /* ---------- Validation ---------- */
  function setErr(id, msg) {
    var inp = $(id), el = $(id + "Err"); if (!inp || !el) return;
    el.textContent = msg; inp.setAttribute("aria-invalid", msg ? "true" : "false");
    if (msg) inp.setAttribute("aria-describedby", el.id); else inp.removeAttribute("aria-describedby");
  }
  function firstBad(ids) { for (var i = 0; i < ids.length; i++) if ($(ids[i]).getAttribute("aria-invalid") === "true") return $(ids[i]); return null; }
  function validate(n) {
    var ids = [];
    if (n === 1) { ids = ["city"]; setErr("city", val("city") ? "" : "Choose the city you need us in."); }
    if (n === 4) {
      ids = ["date", "street"];
      var d = val("date");
      setErr("date", !d ? "Choose the date you'd like us to come." : (d < $("date").min ? "Please choose " + longDate($("date").min) + " or later. For a sooner visit, call or WhatsApp us." : (d > $("date").max ? "Please choose a date within the next " + R.maxDaysAhead + " days." : "")));
      setErr("street", val("street").trim().length < 4 ? "Enter the street address so we can find you." : "");
    }
    if (n === 5) {
      ids = ["name", "phone", "email"];
      setErr("name", val("name").trim().length < 2 ? "Enter your name so we know who to reply to." : "");
      var digits = val("phone").replace(/\D/g, "");
      setErr("phone", digits.length < 10 || digits.length > 15 ? "Enter a phone number we can reach, for example 0801 234 5678." : "");
      var em = val("email").trim();
      setErr("email", em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) ? "That email doesn't look right. Check it or leave it blank." : "");
    }
    var bad = firstBad(ids);
    if (bad) { bad.focus(); return false; }
    if (n === 5 && !consent.checked) {
      $("consentErr").textContent = hasRead ? "Please tick the box to agree to the terms." : "Please read the terms to the end, then tick the box.";
      (hasRead ? consent : terms).focus(); return false;
    }
    return true;
  }

  /* ---------- Steps ---------- */
  var steps = qsa(".step", form), backBtn = $("backBtn"), nextBtn = $("nextBtn"), wizLis = qsa("#wiz li");
  function scrollToForm() { window.scrollTo({ top: form.getBoundingClientRect().top + window.scrollY - 88, behavior: reduced ? "auto" : "smooth" }); }
  function go(n, dir, focus) {
    stepNo = n; maxStep = Math.max(maxStep, n);
    steps.forEach(function (s) {
      var on = +s.getAttribute("data-step") === n; s.hidden = !on;
      if (on) { s.style.setProperty("--dx", dir >= 0 ? "24px" : "-24px"); s.classList.remove("enter"); void s.offsetWidth; if (!reduced) s.classList.add("enter"); }
    });
    wizLis.forEach(function (li, i) { li.classList.toggle("on", i + 1 === n); li.classList.toggle("done", i + 1 < n); if (i + 1 === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current"); });
    $("wizFill").style.width = ((n - 1) / (TOTAL - 1) * 100) + "%";
    backBtn.hidden = n === 1; nextBtn.hidden = n === TOTAL;
    nextBtn.textContent = n === TOTAL - 1 ? "Review and send" : "Continue";
    if (n === TOTAL) { renderSummary(); requestAnimationFrame(updateRead); }
    if (focus) { scrollToForm(); var h = steps[n - 1].querySelector("h3"); if (h) h.focus({ preventScroll: true }); }
    saveDraft();
  }
  function next() { if (!validate(stepNo)) return; if (stepNo < TOTAL) go(stepNo + 1, 1, true); }
  nextBtn.addEventListener("click", next);
  backBtn.addEventListener("click", function () { if (stepNo > 1) go(stepNo - 1, -1, true); });
  wizLis.forEach(function (li, i) { li.addEventListener("click", function () { var t = i + 1; if (t === stepNo || t > maxStep) return; go(t, t > stepNo ? 1 : -1, true); }); });
  form.addEventListener("submit", function (e) { e.preventDefault(); if (stepNo < TOTAL) next(); });
  $("summary").addEventListener("click", function (e) { var b = e.target.closest("[data-goto]"); if (b) go(+b.getAttribute("data-goto"), -1, true); });
  $("changeCity").addEventListener("click", function () { go(1, -1, true); setTimeout(function () { $("city").focus(); }, 60); });

  /* ---------- Steppers, formatting, change handling ---------- */
  form.addEventListener("click", function (e) {
    var b = e.target.closest(".num button"); if (!b) return;
    var inp = $(b.getAttribute("data-for")), min = +inp.min, max = +inp.max;
    inp.value = Math.min(max, Math.max(min, (parseInt(inp.value, 10) || 0) + parseInt(b.getAttribute("data-d"), 10)));
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  });
  $("budget").addEventListener("input", function () { var d = this.value.replace(/\D/g, ""); this.value = d ? Number(d).toLocaleString("en-NG") : ""; });
  var saveT;
  function onChange() { syncUI(); markPreset(); render(); clearTimeout(saveT); saveT = setTimeout(saveDraft, 400); }
  form.addEventListener("input", onChange);
  form.addEventListener("change", function (e) {
    if (e.target.name === "freq") freqTouched = true;
    if (e.target.name === "type") defaultFrequency();
    onChange();
  });
  ["name", "phone", "email", "date", "street", "city"].forEach(function (id) { $(id).addEventListener("input", function () { setErr(id, ""); }); $(id).addEventListener("change", function () { setErr(id, ""); }); });

  /* ---------- Draft (kept in this browser only; consent is never saved) ---------- */
  var KEY = "fn_draft_v4";
  function saveDraft() {
    try {
      var d = { step: stepNo, freqTouched: freqTouched, v: {} };
      qsa("input,select,textarea", form).forEach(function (el) {
        if (!el.name || el.name === "consent" || el.name === "website") return;
        if (el.type === "radio") { if (el.checked) d.v[el.name] = el.value; }
        else if (el.type === "checkbox") { d.v[el.name] = d.v[el.name] || []; if (el.checked) d.v[el.name].push(el.value || "on"); }
        else d.v[el.name] = el.value;
      });
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch (e) {}
  }
  function clearDraft() { try { localStorage.removeItem(KEY); } catch (e) {} }
  function restoreDraft() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || "null"); if (!d || !d.v) return false;
      qsa("input,select,textarea", form).forEach(function (el) {
        if (!el.name || el.name === "consent" || el.name === "website" || !(el.name in d.v)) return;
        var v = d.v[el.name];
        if (el.type === "radio") el.checked = el.value === v;
        else if (el.type === "checkbox") el.checked = (v || []).indexOf(el.value || "on") > -1;
        else el.value = v;
      });
      freqTouched = !!d.freqTouched;
      if ($("date").value && ($("date").value < $("date").min || $("date").value > $("date").max)) $("date").value = "";
      return d.step || 1;
    } catch (e) { return false; }
  }

  /* ---------- Sending ---------- */
  var statusEl = $("status"), sendBtn = $("sendEmail"), sendLabel = sendBtn.innerHTML;
  function note(html, kind) { statusEl.hidden = false; statusEl.className = "status" + (kind ? " is-" + kind : ""); statusEl.innerHTML = html; }
  function validateAll() {
    if (!validate(1)) { go(1, -1, true); return false; }
    if (!validate(4)) { go(4, -1, true); return false; }
    return validate(5);
  }
  function subject() { return "Booking request: " + est.label + (val("date") ? ", " + val("date") : "") + " (" + val("name").trim() + ")"; }
  function setRef(ref) { if (!ref) return; $("refCode").textContent = ref; $("successRef").hidden = false; }
  function showSuccess(mode, ref, msg) {
    $("formBody").hidden = true; $("wiz").hidden = true; qsa(".wbar", form)[0].hidden = true; $("success").hidden = false;
    var wa = $("successWa"), pref = val("pref"), phone = val("phone").trim();
    setRef(ref);
    if (mode === "api") {
      $("successTitle").textContent = "Request sent";
      $("successText").textContent = "Your booking request is with us. We'll contact you on " + pref + " at " + phone + " to confirm the final price and time. We're open " + FN.hoursText(FN.settings.hours).toLowerCase() + ".";
      wa.textContent = "Message us on WhatsApp too"; wa.href = FN.whatsappUrl("Hello, I just sent a booking request from the website" + (ref ? " (reference " + ref + ")" : "") + ". My name is " + val("name").trim() + ".");
    } else {
      $("successTitle").textContent = "Almost there";
      $("successText").textContent = "We opened WhatsApp with your booking details. Press send in WhatsApp to deliver it to us. If nothing opened, use the button below.";
      wa.textContent = "Open WhatsApp again"; wa.href = FN.whatsappUrl(msg);
    }
    clearDraft(); scrollToForm(); $("successTitle").focus({ preventScroll: true });
  }
  function copyMessage(msg) {
    function ok() { FN.toast("Message copied"); }
    if (navigator.clipboard) navigator.clipboard.writeText(msg).then(ok, function () { FN.toast("Select the preview text to copy"); });
    else FN.toast("Select the preview text to copy");
  }
  function fallbackToEmail(msg) {
    FN.openLink(FN.mailtoUrl(subject(), msg));
    note('We couldn\'t reach our booking server, so we opened your email app. Press send to finish, or use WhatsApp instead. <button type="button" class="btn btn-ghost btn-sm" id="copyMsg" style="margin-top:10px">Copy message</button>');
    $("copyMsg").addEventListener("click", function () { copyMessage(msg); });
  }
  function showServerError(r) {
    var field = r.data && r.data.field, msg = r.data.error || "We couldn't send that. Please check your details.";
    if (field && FIELD_STEP[field]) {
      if (FIELD_STEP[field] !== stepNo) go(FIELD_STEP[field], -1, true);
      if ($(field + "Err")) { setErr(field, msg); $(field).focus(); }
      else if (field === "consent") $("consentErr").textContent = msg;
    }
    note(esc(msg), "error");
  }

  sendBtn.addEventListener("click", function () {
    if (!FN.settings.acceptingBookings) return;
    if (!validateAll()) return; render();
    var msg = buildMessage();
    sendBtn.disabled = true; sendBtn.textContent = "Sending...";
    FN.post("/api/bookings", payload()).then(function (r) {
      sendBtn.disabled = !FN.settings.acceptingBookings; sendBtn.innerHTML = sendLabel;
      if (r.ok) { showSuccess("api", r.data.ref); return; }
      if (r.status === 422 || r.status === 429 || r.status === 503) { showServerError(r); return; }
      fallbackToEmail(msg);                                     /* network problem or server error */
    });
  });
  $("sendWa").addEventListener("click", function () {
    if (!validateAll()) return; render();
    var msg = buildMessage(), saved = FN.post("/api/bookings", payload());   /* also keep a copy on our server */
    FN.openLink(FN.whatsappUrl(msg)); showSuccess("whatsapp", null, msg);
    saved.then(function (r) { if (r.ok && r.data.ref && r.data.ref !== "FN-000000-0000") setRef(r.data.ref); });
  });
  $("again").addEventListener("click", function () {
    form.reset(); resetConsent(); freqTouched = false; $("success").hidden = true; $("successRef").hidden = true; $("formBody").hidden = false; $("wiz").hidden = false; qsa(".wbar", form)[0].hidden = false;
    statusEl.hidden = true; maxStep = 1; syncUI(); render(); go(1, -1, true);
  });

  /* When the owner switches online booking off, say so and disable the send button */
  FN.onSettings(function (s) { var off = !s.acceptingBookings; $("closedNotice").hidden = !off; sendBtn.disabled = off; });

  /* ---------- Start ---------- */
  var saved = restoreDraft();
  var qService = FN.query("service"), qCity = FN.query("city"), fromLink = false;
  if (P.service[qService]) { qsa('input[name="type"]', form).forEach(function (r) { r.checked = r.value === qService; }); fromLink = true; }
  if (R.cities.some(function (c) { return c.name === qCity; })) { $("city").value = qCity; fromLink = true; }
  defaultFrequency();
  syncUI(); markPreset(); render();
  if (fromLink && P.service[qService] && val("city")) { maxStep = 2; go(2, 1, false); }          /* both chosen: skip straight to rooms */
  else if (fromLink) { go(1, 1, false); }
  else if (saved && saved > 1) { maxStep = saved; go(Math.min(saved, TOTAL), 1, false); FN.toast("We restored your unfinished booking"); }
  else go(1, 1, false);
})();
