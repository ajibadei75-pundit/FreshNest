/* Receipts and checklists. The admin page prints them; the backend emails them. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./pricing.js"), require("./hours.js"));
  else root.FNDocs = factory(root.FNPricing, root.FNHours);
})(typeof self !== "undefined" ? self : this, function (PR, H) {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var fmt = PR.fmt;
  var SCOPE = "Everything listed here will be attended to. Anything not listed will not be done, unless we agree it with you first and add it to the list.";
  var CSS = "*{box-sizing:border-box}body{margin:0;background:#eef3f2;font-family:'Segoe UI',Arial,sans-serif;color:#0b2b2a;font-size:14px;line-height:1.5}" +
    ".page{max-width:780px;margin:0 auto;background:#fff;padding:34px 40px}.hd{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:3px solid #018174;padding-bottom:16px}" +
    ".hd img{height:46px;width:auto;display:block}.hd .biz{font-size:12px;color:#47696a;margin-top:8px;line-height:1.55}.hd .doc{text-align:right}.hd .doc h1{margin:0;font-size:26px;letter-spacing:.04em;color:#018174;text-transform:uppercase}.hd .doc p{margin:2px 0 0;color:#47696a;font-size:12.5px}" +
    ".grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:20px 0}.box{border:1px solid #d2e5e0;border-radius:10px;padding:12px 14px}.box h3{margin:0 0 6px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#47696a}.box p{margin:0}" +
    "table{width:100%;border-collapse:collapse;margin:8px 0}th{text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#47696a;border-bottom:1px solid #d2e5e0;padding:8px 6px}td{padding:9px 6px;border-bottom:1px solid #e6efed;vertical-align:top}td.r,th.r{text-align:right}" +
    ".tot td{border:0;padding:4px 6px}.tot .big td{font-size:17px;font-weight:800;border-top:2px solid #018174;padding-top:10px}.paid{display:inline-block;border:2px solid #17794d;color:#17794d;border-radius:8px;padding:2px 12px;font-weight:800;letter-spacing:.1em;transform:rotate(-4deg)}.due{border-color:#b3261e;color:#b3261e}" +
    ".sec{margin:18px 0 6px;font-size:15px;font-weight:800;color:#054141;border-bottom:1px solid #d2e5e0;padding-bottom:4px;display:flex;justify-content:space-between}.sec small{font-weight:500;color:#47696a}" +
    ".ck{list-style:none;margin:0;padding:0}.ck li{display:flex;gap:10px;padding:5px 0;break-inside:avoid}.ck li:before{content:'';flex:none;width:15px;height:15px;border:1.6px solid #018174;border-radius:4px;margin-top:2px}.ck.pre li:before{border-color:#b98a00}" +
    ".sign{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:34px}.sign div{border-top:1px solid #0b2b2a;padding-top:6px;font-size:12px;color:#47696a}.note{background:#f2f9f7;border-radius:10px;padding:10px 14px;margin:14px 0;font-size:13px}.foot{margin-top:24px;border-top:1px solid #d2e5e0;padding-top:12px;font-size:12px;color:#47696a;text-align:center}" +
    "@media print{body{background:#fff}.page{max-width:none;padding:0}@page{size:A4;margin:14mm}}@media(max-width:560px){.grid,.sign{grid-template-columns:1fr}.hd{flex-direction:column}.hd .doc{text-align:left}.page{padding:20px}}";
  function head(b, s, title, no, dateLabel, site, logoUrl) {
    var biz = s.business, logo = logoUrl || ((site || "") + "img/logo-email.jpg");
    return '<div class="hd"><div><img src="' + esc(logo) + '" alt="' + esc(biz.name) + '"><div class="biz">' + esc(biz.name) + "<br>" + esc(biz.phoneDisplay) + " &middot; " + esc(biz.email) + (biz.address ? "<br>" + esc(biz.address) : "") + "<br>" + esc(H.hoursText(s.hours)) + '</div></div><div class="doc"><h1>' + esc(title) + "</h1><p><b>" + esc(no) + "</b></p><p>" + esc(dateLabel) + "</p></div></div>";
  }
  function wrap(title, inner) { return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + "</title><style>" + CSS + '</style></head><body><div class="page">' + inner + "</div></body></html>"; }
  function jobDate(b) { return b.schedule && b.schedule.date ? PR.longDate(b.schedule.date) + ", " + PR.slotText(b.schedule.slot, PR.SLOTS) : "To be confirmed"; }
  function totals(b) { var price = b.finalPrice || b.estimate.total, paid = (b.payments || []).reduce(function (t, p) { return t + p.amount; }, 0); return { price: price, paid: paid, balance: Math.max(0, price - paid), status: paid <= 0 ? "unpaid" : paid >= price ? "paid" : "part" }; }

  function receiptHtml(b, payment, s, opt) {
    opt = opt || {}; var t = totals(b), c = b.customer, est = b.estimate, pays = payment ? [payment] : (b.payments || []);
    var no = payment ? payment.receiptNo : "ST-" + b.ref, date = payment ? PR.longDate(payment.date) : PR.longDate(new Date().toISOString().slice(0, 10));
    var items = est.lines.map(function (l) { return l.label; }).concat(est.extraLines.map(function (l) { return l.label; }));
    var inner = head(b, s, payment ? "Receipt" : "Statement", no, date, opt.site, opt.logo) +
      '<div class="grid"><div class="box"><h3>Received from</h3><p><b>' + esc(c.name) + "</b></p><p>" + esc(c.phone) + "</p><p>" + esc(c.email) + '</p></div><div class="box"><h3>Job</h3><p><b>' + esc(est.label) + "</b></p><p>Booking " + esc(b.ref) + "</p><p>" + esc(jobDate(b)) + "</p><p>" + esc(PR.where(b)) + "</p></div></div>" +
      '<table><thead><tr><th>Description</th><th class="r">Amount</th></tr></thead><tbody><tr><td><b>' + esc(est.label) + "</b>, per visit" + (est.freq && est.freqKey !== "once" ? " (" + esc(est.freq.label.toLowerCase()) + " plan)" : "") + '<br><span style="color:#47696a;font-size:12.5px">' + esc(items.join(", ") || "Service") + '</span></td><td class="r">' + fmt(t.price) + "</td></tr></tbody></table>" +
      '<h3 class="sec">Payments received</h3><table><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Receipt</th><th class="r">Amount</th></tr></thead><tbody>' + (pays.length ? pays.map(function (p) { return "<tr><td>" + esc(PR.shortDate(p.date)) + "</td><td>" + esc(p.method) + "</td><td>" + esc(p.reference || "-") + "</td><td>" + esc(p.receiptNo) + '</td><td class="r">' + fmt(p.amount) + "</td></tr>"; }).join("") : '<tr><td colspan="5" style="color:#47696a">No payments recorded yet.</td></tr>') + "</tbody></table>" +
      '<table class="tot"><tbody><tr><td class="r">Total price</td><td class="r" style="width:150px">' + fmt(t.price) + '</td></tr><tr><td class="r">Paid to date</td><td class="r">' + fmt(t.paid) + '</td></tr><tr class="big"><td class="r">Balance due</td><td class="r">' + fmt(t.balance) + "</td></tr></tbody></table>" +
      '<p style="margin:14px 0"><span class="paid' + (t.status === "paid" ? "" : " due") + '">' + (t.status === "paid" ? "PAID IN FULL" : t.status === "part" ? "PART PAYMENT" : "UNPAID") + "</span></p>" +
      (payment && payment.note ? '<div class="note"><b>Note:</b> ' + esc(payment.note) + "</div>" : "") +
      '<div class="sign"><div>Received by (' + esc(s.business.short) + ")</div><div>Customer signature</div></div>" +
      '<div class="foot">Thank you for choosing ' + esc(s.business.name) + ". This receipt covers the work written in your booking summary and checklist. Not happy with something? Tell us within 24 hours and we will come back to fix it free.<br>" + esc(s.business.phoneDisplay) + " &middot; " + esc(s.business.email) + "</div>";
    return wrap((payment ? "Receipt " : "Statement ") + no, inner);
  }

  var HOME_PRE = ["Put away valuables, cash and documents", "Clear worktops and floors of loose items", "Make sure someone can let the team in at the agreed time", "Tell the team about delicate surfaces or items to avoid"];
  var PEST_PRE = ["Remove or tightly cover food, cooking items and drinking water", "Move pets, fish tanks and plants out of the treated area", "Clear space along walls and under beds, and open cupboards and wardrobes", "Plan where everyone, including pets, will stay for the time we advise", "Tell the team about children, pregnant women and anyone with breathing problems"];
  function n(b, id) { return (b.sel.rooms && b.sel.rooms[id]) || 0; }
  function sections(b, P) {
    var g = b.estimate.group, type = b.sel.type, S = [], ex = b.sel.extras || [];
    function add(id, title, items, sub) { if (items.length) S.push({ id: id, title: title, sub: sub || "", items: items.map(function (t, i) { return { id: id + ":" + i, text: t }; }) }); }
    if (g === "home") {
      if (b.sel.kitchen && b.sel.kitchen !== "none") add("kitchen", "Kitchen", ["Wipe counters, splashback and sink", "Clean the hob or cooker top", "Wipe cupboard fronts and handles", "Wipe appliance exteriors", "Sweep and mop the floor", "Empty bins"].concat(ex.indexOf("oven") > -1 ? ["Clean inside the oven"] : [], ex.indexOf("fridge") > -1 ? ["Clean inside the fridge and freezer"] : [], ex.indexOf("cabinets") > -1 ? ["Clean inside the kitchen cabinets"] : []));
      if (n(b, "bedroom")) add("bed", "Bedrooms", ["Dust surfaces, headboards and mirrors", "Make beds", "Vacuum or sweep, then mop floors", "Empty bins"], n(b, "bedroom") + " room" + (n(b, "bedroom") > 1 ? "s" : ""));
      if (n(b, "bathroom") || n(b, "toilet")) add("bath", "Bathrooms and toilets", ["Scrub and disinfect toilets", "Clean showers, baths and sinks", "Polish taps and mirrors", "Mop floors", "Empty bins"], (n(b, "bathroom") + n(b, "toilet")) + " in total");
      var living = [["living", "Living rooms"], ["dining", "Dining areas"], ["study", "Study or home office"], ["balcony", "Balconies or terraces"], ["store", "Store or laundry rooms"], ["stairs", "Staircases and hallways"]].filter(function (x) { return n(b, x[0]); });
      add("areas", "Living and other areas", living.map(function (x) { return x[1] + " (" + n(b, x[0]) + "): dust, wipe surfaces, sweep and mop"; }));
      add("all", "Throughout the property", ["Wipe doors, handles and light switches", "Dust fans, shelves and picture frames", "Spot-clean walls where marks are reachable", "Final floor check"].concat(ex.indexOf("wardrobes") > -1 ? ["Clean inside wardrobes and cupboards"] : []));
      if (type === "deep") add("deep", "Deep-clean extras", ["Clean behind and under movable furniture", "Remove limescale and scrub grout", "Wipe skirting boards, doors and switches", "Clean inside cupboards", "Remove cobwebs from ceilings and corners"]);
      if (type === "move") add("move", "Move-in and move-out extras", ["Clean inside all cupboards, drawers and wardrobes", "Clean appliances inside and out", "Descale kitchen and bathrooms", "Spot-clean marks from walls", "Check every room is empty and clean"]);
      if (type === "construction") add("build", "After-building clean-up", ["Remove dust and debris from every surface", "Remove paint and plaster splatter", "Polish fixtures and tiles", "Clean windows and frames", "Deep-clean floors", "Final dust and walk-through"]);
      if (type === "regular") add("reg", "Regular visit", ["Same checklist at every visit", "Note anything to change for next time"]);
    } else if (g === "office") {
      add("rec", "Reception and meeting rooms", ["Wipe reception desk and furniture", "Clean glass doors and partitions", "Reset meeting rooms: wipe tables, tidy chairs", "Vacuum or mop floors"], n(b, "reception") + " reception, " + n(b, "meeting") + " meeting");
      add("desk", "Offices and open-plan areas", ["Dust and wipe desks and shared surfaces", "Wipe phones, keyboards and handles where clear", "Empty and reline bins", "Vacuum or mop floors"], n(b, "private") + " private offices" + (b.sel.open && b.sel.open !== "none" ? ", open-plan area" : ""));
      add("toil", "Toilets", ["Scrub and disinfect toilets and urinals", "Clean sinks, taps and mirrors", "Restock soap and tissue if supplied", "Mop floors"], n(b, "toilet") + " toilets");
      if (n(b, "kitchenette")) add("kit", "Kitchenette", ["Wipe counters and sink", "Clean microwave and kettle exteriors", "Clean fridge exterior", "Empty bins and mop floor"]);
      add("off", "Finishing", ["Wipe doors and light switches", "Final floor check", "Lock up and hand over keys as agreed"].concat(ex.indexOf("carpet") > -1 ? ["Shampoo carpets"] : [], ex.indexOf("upholstery") > -1 ? ["Clean upholstery"] : [], ex.indexOf("tiles") > -1 ? ["Scrub tile and grout"] : []));
    } else if (g === "hostel") {
      add("rooms", "Rooms", ["Dust surfaces and bed frames", "Sweep and mop floors", "Wipe doors and handles", "Empty bins"], n(b, "room") + " room" + (n(b, "room") > 1 ? "s" : ""));
      add("hb", "Shared bathrooms and toilets", ["Scrub and disinfect toilets", "Clean showers, sinks and taps", "Mop floors", "Empty bins"], (n(b, "bathroom") + n(b, "toilet")) + " in total");
      if (n(b, "kitchen")) add("hk", "Shared kitchens", ["Wipe counters and sinks", "Clean hobs", "Clean microwave and fridge exteriors", "Mop floors and empty bins"], n(b, "kitchen") + " kitchen" + (n(b, "kitchen") > 1 ? "s" : ""));
      add("hc", "Corridors, stairs and common rooms", ["Sweep and mop corridors and staircases", "Wipe banisters and switches", "Clean common and reading rooms", "Clear and empty bins"], (n(b, "corridor") + n(b, "common")) + " areas");
    } else {
      var pests = b.sel.pests || [];
      add("insp", "Inspection", ["Walk through with the customer and confirm the pests and areas to treat", "Check entry points, cracks, drains and hiding places"]);
      var areas = [["bedroom", "Bedrooms", "corners, skirting, under beds and behind furniture"], ["living", "Living rooms", "corners, skirting and behind furniture"], ["dining", "Dining areas", "corners, skirting and under tables"], ["kitchen", "Kitchens", "behind appliances, under sinks and along cupboard edges (food covered)"], ["bathroom", "Bathrooms and toilets", "drains, pipes, cracks and corners"], ["store", "Stores and other rooms", "shelves, corners and floor edges"]].filter(function (x) { return n(b, x[0]); });
      add("areas", "Rooms treated", areas.map(function (x) { return x[1] + " (" + n(b, x[0]) + "): treat " + x[2]; }));
      var map = { general: "Treat cockroach, ant and fly hiding places with spray and gel", bedbugs: "Treat beds, mattress seams, headboards and cracks; advise on a follow-up visit", termites: "Inspect wood and walls; treat soil and affected timber", rodents: "Place bait stations and advise on sealing entry points", mosquito: "Fog indoors and outdoors and treat standing-water points" };
      add("pests", "Pests treated", pests.map(function (k) { return map[k] || k; }));
      if (b.sel.outdoor && b.sel.outdoor !== "none") add("out", "Outdoor area", ["Treat the compound perimeter, drains and bin area"], b.sel.outdoor + " area");
      add("fin", "Finishing", ["Give safety advice and the time everyone must stay out", "Advise on airing the rooms and wiping food surfaces", "Agree a follow-up visit only if it is written in our agreement"]);
    }
    if (g !== "pest") { var more = []; if (g !== "office") { if (ex.indexOf("carpet") > -1) more.push("Clean carpets and rugs"); if (ex.indexOf("upholstery") > -1) more.push("Clean sofas and upholstery"); if (ex.indexOf("tiles") > -1) more.push("Scrub tile and grout"); } if (b.sel.extraWindows) more.push("Clean " + b.sel.extraWindows + " window" + (b.sel.extraWindows > 1 ? "s" : "") + " inside"); add("extra", "Extras you booked", more); }
    return S;
  }
  function prep(b) {
    var a = b.access || {}, p = (b.estimate.group === "pest" ? PEST_PRE : HOME_PRE).slice();
    if (b.estimate.group !== "pest" && a.access) p[2] = "Access: " + a.access;
    if (a.gate) p.push("Arrange gate pass or ID for the team");
    if (b.estimate.group !== "pest") { if (a.pets) p.push("Keep pets secured or away from cleaners (" + (a.petType || "pets at home") + ")"); if (!a.water) p.push("No running water on site: let us know how we can get water"); if (!a.power) p.push("No electricity on site: team will bring battery-powered equipment where possible"); }
    if (a.parking) p.push("Keep parking space free for the team");
    return p;
  }
  function checklistItems(b, P, cfg) { cfg = cfg || {}; var rm = cfg.removed || []; return sections(b, P).map(function (s) { return { id: s.id, title: s.title, sub: s.sub, items: s.items.map(function (i) { return { id: i.id, text: i.text, on: rm.indexOf(i.id) < 0 }; }) }; }); }
  function checklistHtml(b, s, opt) {
    opt = opt || {}; var cfg = b.checklist || {}, secs = checklistItems(b, s.pricing, cfg), est = b.estimate, c = b.customer;
    var inner = head(b, s, est.group === "pest" ? "Treatment checklist" : "Cleaning checklist", "Booking " + b.ref, jobDate(b), opt.site, opt.logo) +
      '<div class="grid"><div class="box"><h3>Client</h3><p><b>' + esc(c.name) + "</b></p><p>" + esc(c.phone) + "</p><p>" + esc(PR.where(b)) + '</p></div><div class="box"><h3>Job</h3><p><b>' + esc(est.label) + "</b></p><p>Team: " + (b.assigned ? esc(b.assigned) + ", " : "") + est.crew + (est.crew === 1 ? " person" : " people") + ", about " + est.hours + " hours</p><p>Agreed price: " + fmt(b.finalPrice || est.total) + "</p></div></div>" +
      '<div class="note"><b>Our agreement:</b> This checklist and your booking summary are our agreement. ' + SCOPE + "</div>" +
      '<h3 class="sec">Before we arrive <small>for the client</small></h3><ul class="ck pre">' + prep(b).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" +
      secs.map(function (sec) { var items = sec.items.filter(function (i) { return i.on; }); return items.length ? '<h3 class="sec">' + esc(sec.title) + (sec.sub ? " <small>" + esc(sec.sub) + "</small>" : "") + '</h3><ul class="ck">' + items.map(function (i) { return "<li>" + esc(i.text) + "</li>"; }).join("") + "</ul>" : ""; }).join("") +
      ((cfg.extra || []).length ? '<h3 class="sec">Special requests</h3><ul class="ck">' + cfg.extra.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : "") +
      (b.instructions ? '<div class="note"><b>Customer instructions:</b> ' + esc(b.instructions) + "</div>" : "") + (cfg.note ? '<div class="note"><b>Note from our team:</b> ' + esc(cfg.note) + "</div>" : "") +
      '<h3 class="sec">Sign-off</h3><p style="margin:6px 0 0">I confirm the work above was completed to my satisfaction. If anything was missed I will tell the team within 24 hours for a free re-clean or re-treatment.</p><div class="sign"><div>Team leader name and signature</div><div>Client signature and date</div></div>' +
      '<div class="foot">' + esc(s.business.name) + " &middot; " + esc(s.business.phoneDisplay) + " &middot; " + esc(s.business.email) + "</div>";
    return wrap("Checklist " + b.ref, inner);
  }

  /* ---- planner documents ---- */
  function li(a) { return "<ul class=\"ck\">" + a.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>"; }
  function quoteHtml(plan, b, s, opt) {
    opt = opt || {}; var c = (b && b.customer) || {}, sm = plan.summary, cost = plan.cost, refer = sm.decision === "refer", no = b ? "Quote " + b.ref : "Quote " + new Date().toISOString().slice(0, 10).replace(/-/g, "");
    var inner = head(b || {}, s, "Quotation", no, PR.longDate(new Date().toISOString().slice(0, 10)), opt.site, opt.logo) +
      '<div class="grid"><div class="box"><h3>Prepared for</h3><p><b>' + esc(c.name || "Client") + "</b></p><p>" + esc(c.phone || "") + "</p><p>" + esc(b ? PR.where(b) : "") + '</p></div><div class="box"><h3>Job</h3><p><b>' + esc(sm.title) + "</b></p><p>Area: about " + esc(sm.area) + " m2</p><p>Surface: " + esc(sm.surface) + "</p></div></div>" +
      '<h3 class="sec">What we will do</h3><p>' + esc(sm.stain) + " on " + esc(sm.surface.toLowerCase()) + ". Method: " + esc(sm.sop) + ". We test a small patch first, use the gentlest effective method, protect your property, and check the finish under angled light before we leave.</p>" +
      '<h3 class="sec">Price</h3><table><tbody>' + (refer ? '<tr><td>Diagnostic visit and test (full removal is not quoted, see below)</td><td class="r"><b>' + fmt(cost.quote) + "</b></td></tr>" : '<tr><td>Complete job as described, ' + plan.time.days + " day" + (plan.time.days > 1 ? "s" : "") + ", " + plan.crew.total + " team member" + (plan.crew.total > 1 ? "s" : "") + '</td><td class="r"><b>' + fmt(cost.quote) + "</b></td></tr>") + "</tbody></table>" +
      (refer ? "<p>Why: " + esc(sm.decisionText) + "</p>" : '<p class="fine">Equivalent to about ' + fmt(plan.options.perM2) + " per m2. If the real scope turns out different, any change in area, product or price needs your written approval first.</p>") +
      (sm.decision === "test_first" ? '<div class="note"><b>Test patch first:</b> the price above is confirmed once the test patch is done and approved. A diagnostic test can be booked for ' + fmt(plan.options.diagnostic) + ", credited against the job if you go ahead.</div>" : "") +
      '<h3 class="sec">Important limits</h3><p>' + esc(plan.wording) + "</p>" + (plan.flags.length ? li(plan.flags.filter(function (f) { return f.level !== "info" || true; }).map(function (f) { return f.text; })) : "") +
      '<div class="note"><b>Our agreement:</b> ' + SCOPE + "</div>" +
      '<p class="fine">This quotation is valid for 14 days.</p><div class="sign"><div>Approved for ' + esc(s.business.short) + '</div><div>Customer approval of scope, price and limits (signature and date)</div></div><div class="foot">' + esc(s.business.name) + " &middot; " + esc(s.business.phoneDisplay) + " &middot; " + esc(s.business.email) + "</div>";
    return wrap(no, inner);
  }
  function jobPlanHtml(plan, b, s, opt) {
    opt = opt || {}; var sm = plan.summary, cost = plan.cost, no = b ? "Job plan " + b.ref : "Job plan", pr = plan.procedure;
    var flags = plan.flags.map(function (f) { return "<li><b>" + ({ stop: "STOP", warn: "CHECK", info: "NOTE" })[f.level] + ":</b> " + esc(f.text) + "</li>"; }).join("");
    var inner = head(b || {}, s, "Job plan", no, PR.longDate(new Date().toISOString().slice(0, 10)), opt.site, opt.logo) +
      '<div class="note"><b>' + esc(sm.decision === "go" ? "Proceed" : sm.decision === "refer" ? "Refer" : "Test first") + ":</b> " + esc(sm.decisionText) + "</div>" +
      '<div class="grid"><div class="box"><h3>Job</h3><p><b>' + esc(sm.title) + "</b></p><p>" + esc(sm.stain) + "</p><p>" + esc(sm.surface) + ", about " + esc(sm.area) + " m2</p><p>" + esc(sm.sop) + '</p></div><div class="box"><h3>Crew and time</h3><p>Lead: ' + plan.crew.lead + ", technicians: " + (plan.crew.technician + plan.crew.leadWorking) + ", support: " + plan.crew.support + "</p><p>About " + plan.time.workHours + " working hours, " + plan.time.days + " day" + (plan.time.days > 1 ? "s" : "") + " at " + plan.time.hoursPerDay + " h a day</p>" + (plan.crew.shortfall ? "<p><b>" + esc(plan.crew.shortfall) + "</b></p>" : "") + "</div></div>" +
      (flags ? '<h3 class="sec">Risks and checks</h3><ul class="ck pre">' + flags + "</ul>" : "") +
      '<h3 class="sec">Machines</h3><table><thead><tr><th>Machine</th><th>Use</th><th class="r">Hours</th><th class="r">Cost</th></tr></thead><tbody>' + (plan.machines.length ? plan.machines.map(function (m) { return "<tr><td>" + esc(m.label) + "<br><span style=\"color:#47696a;font-size:12px\">" + esc(m.reason) + "</span></td><td>" + (m.use ? "Yes" : "No") + '</td><td class="r">' + (m.use ? m.hours : "-") + '</td><td class="r">' + (m.use ? fmt(m.cost) : "-") + "</td></tr>"; }).join("") : '<tr><td colspan="4">No machines available: manual tools and safe chemical control.</td></tr>') + "</tbody></table>" +
      '<h3 class="sec">Cost</h3><table><tbody>' + cost.lines.map(function (l) { return "<tr><td>" + esc(l.label) + '<br><span style="color:#47696a;font-size:12px">' + esc(l.note) + '</span></td><td class="r">' + fmt(l.amount) + "</td></tr>"; }).join("") + '</tbody></table><table class="tot"><tbody><tr><td class="r">Full cost</td><td class="r" style="width:150px">' + fmt(cost.direct) + '</td></tr><tr><td class="r">Margin</td><td class="r">' + cost.marginPct + '%</td></tr><tr class="big"><td class="r">Quote</td><td class="r">' + fmt(cost.quote) + '</td></tr><tr><td class="r">Profit</td><td class="r">' + fmt(cost.profit) + "</td></tr></tbody></table>" +
      '<p class="fine">Options: day rate ' + fmt(plan.options.dayRate) + " &middot; per m2 " + fmt(plan.options.perM2) + " &middot; diagnostic " + fmt(plan.options.diagnostic) + " &middot; minimum call-out " + fmt(plan.options.minCallout) + "</p>" +
      '<h3 class="sec">PPE and tools</h3>' + li(plan.ppe) + li(plan.tools) + '<h3 class="sec">Before you go</h3>' + li(pr.before) + '<h3 class="sec">On site, step by step</h3><ol style="padding-left:20px;margin:6px 0">' + pr.onSite.map(function (t) { return "<li style=\"padding:3px 0\">" + esc(t) + "</li>"; }).join("") + "</ol>" +
      (pr.machine.length ? '<h3 class="sec">Machines</h3>' + li(pr.machine) : "") + '<h3 class="sec">Quality check</h3>' + li(pr.qc) + '<h3 class="sec">Stop work if</h3>' + li(pr.stop) + '<h3 class="sec">Close-out</h3>' + li(pr.closeout) +
      '<h3 class="sec">Job card</h3><table><tbody>' + ["Test product and dwell time", "Tools, machine and pad", "Crew and actual hours", "Chemical quantity used", "Pre-existing defects", "Result, areas remaining and reason", "Customer approval and notes"].map(function (t) { return "<tr><td style=\"width:38%\">" + t + "</td><td></td></tr>"; }).join("") + "</tbody></table>" +
      '<h3 class="sec">Assumptions</h3>' + li(plan.assumptions) + '<div class="sign"><div>Team leader signature</div><div>Client signature and date</div></div><div class="foot">' + esc(s.business.name) + " &middot; internal job plan</div>";
    return wrap(no, inner);
  }
  function itemCount(b, P) { return checklistItems(b, P, b.checklist).reduce(function (t, s) { return t + s.items.filter(function (i) { return i.on; }).length; }, 0); }
  return { quoteHtml: quoteHtml, jobPlanHtml: jobPlanHtml, receiptHtml: receiptHtml, checklistHtml: checklistHtml, checklistItems: checklistItems, totals: totals, itemCount: itemCount, SCOPE: SCOPE };
});
