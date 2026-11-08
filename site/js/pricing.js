/* FreshNest pricing engine, defaults and booking text. Shared by the website, the admin page and the backend. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FNPricing = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var SETTINGS = {
    business: { name: "FreshNest Cleaning Services", short: "FreshNest", email: "freshnestcleaningservices@proton.me", phone: "+2347087596696", phoneDisplay: "+234 708 759 6696", whatsapp: "2347087596696", address: "" },
    cities: [
      { id: "ibadan", name: "Ibadan", state: "Oyo State" }, { id: "oyo", name: "Oyo", state: "Oyo State" }, { id: "ogbomoso", name: "Ogbomoso", state: "Oyo State" },
      { id: "osogbo", name: "Osogbo", state: "Osun State" }, { id: "ilorin", name: "Ilorin", state: "Kwara State" }, { id: "lagos", name: "Lagos", state: "Lagos State" }
    ],
    hours: { open: "07:00", close: "19:00", days: [0, 1, 2, 3, 4, 5, 6] },
    booking: { leadDays: 1, maxDaysAhead: 120, capacity: 3, closedDates: [] },
    notify: { email: "freshnestcleaningservices@proton.me", onBooking: true },
    announcement: { enabled: false, text: "" },
    /* Job planner for paint and tile stain removal. All numbers are starting values from the field manual's examples and assumptions:
       replace them with your real wages, supplier prices and measured speeds (the manual says to track your own productivity). */
    planner: {
      hoursPerDay: 8, setupHours: 0.75, marginPct: 30, overheadPct: 10, wasteAllowPct: 15, contingencyPct: 12, financePct: 0.03,
      transportPerDay: 3000, protectionBase: 1500, protectionPerM2: 50, minCallout: 10000, testPatchFee: 5000, afterHoursPct: 15, noWaterFee: 3000, ladderMult: 1.15, occupiedMult: 1.1,
      crew: [
        { id: "lead", label: "Lead technician", rate: 3500, count: 1 },
        { id: "technician", label: "Technician", rate: 2500, count: 2 },
        { id: "support", label: "Support person", rate: 2000, count: 1 }
      ],
      machines: [
        { id: "spin", label: "Battery spin scrubber", purchase: 35000, resalePct: 10, lifeHours: 600, maint: 40, consumable: 60, power: false, count: 0 },
        { id: "wetvac", label: "Commercial wet/dry vacuum", purchase: 145000, resalePct: 15, lifeHours: 1500, maint: 80, consumable: 30, power: true, count: 0 },
        { id: "squeegee", label: "Squeegee and washer system", purchase: 25000, resalePct: 10, lifeHours: 800, maint: 20, consumable: 30, power: false, count: 0 },
        { id: "floor", label: "Low-speed floor machine", purchase: 800000, resalePct: 13, lifeHours: 1000, maint: 250, consumable: 150, power: true, count: 0 },
        { id: "rideon", label: "Ride-on scrubber", purchase: 9200000, resalePct: 20, lifeHours: 3000, maint: 900, consumable: 400, power: false, count: 0 },
        { id: "pressure", label: "Pressure washer", purchase: 120000, resalePct: 15, lifeHours: 800, maint: 120, consumable: 20, power: true, count: 0 }
      ],
      stains: {
        fresh_water: { minPerM2: 10, chemPerM2: 150 }, cured_water: { minPerM2: 25, chemPerM2: 400 }, oil_alkyd: { minPerM2: 35, chemPerM2: 700 }, epoxy_pu: { minPerM2: 60, chemPerM2: 0 },
        grout_paint: { minPerM2: 60, chemPerM2: 900 }, cement_haze: { minPerM2: 20, chemPerM2: 500 }, adhesive: { minPerM2: 40, chemPerM2: 800 }, grease: { minPerM2: 12, chemPerM2: 250 },
        rust_mineral: { minPerM2: 25, chemPerM2: 450 }, unknown: { minPerM2: 40, chemPerM2: 600 }
      }
    },
    /* Naira, the same in every city. Cleaning anchored to 2026 Nigerian guide prices (1-bed flat about 20k-25k, 2-bed 27k-37k, 3-bed 30k-40k).
       Fumigation has no fixed Nigerian rates (guides say it depends on pest, severity and size), so these are moderate starting values to review. */
    pricing: {
      callout: 5000, minTotal: 15000, range: 0.08, setupMinutes: 20, maxMult: 2,
      timing: { rushDays: 2, rushPct: 0.10, weekendPct: 0.05, flexiblePct: 0.05 },
      site: { noWater: 3000, noPower: 2500, pets: 1500, stairsPct: 0.03 },
      service: {
        residential:  { label: "Residential Cleaning",         group: "home",   price: 1,    time: 1   },
        office:       { label: "Office & Commercial Cleaning", group: "office", price: 1,    time: 1   },
        deep:         { label: "Deep Cleaning",                group: "home",   price: 1.5,  time: 1.7 },
        hostel:       { label: "Hostel Cleaning",              group: "hostel", price: 1,    time: 1   },
        move:         { label: "Move-in & Move-out Cleaning",  group: "home",   price: 1.15, time: 1.9 },
        regular:      { label: "One-time & Regular Cleaning",  group: "home",   price: 1,    time: 1   },
        construction: { label: "Post-Construction Cleaning",   group: "home",   price: 1.4,  time: 2.4 },
        fumigation:   { label: "Fumigation & Pest Control",    group: "pest",   price: 1,    time: 1   }
      },
      homeSize: { compact: 0.9, average: 1, large: 1.2 },
      condition: { light: 0.9, normal: 1, heavy: 1.25 },
      rooms: [
        { id: "bedroom",  label: "Bedrooms",                    single: "bedroom",               hint: "Including guest rooms",           price: 6000, min: 35, def: 2, max: 12 },
        { id: "bathroom", label: "Bathrooms",                   single: "bathroom",              hint: "With shower or bath",             price: 2800, min: 40, def: 1, max: 10 },
        { id: "toilet",   label: "Separate toilets",            single: "separate toilet",       hint: "Guest or visitors' toilet",       price: 1500, min: 15, def: 0, max: 8 },
        { id: "living",   label: "Living rooms",                single: "living room",           hint: "Lounge or sitting room",          price: 5000, min: 35, def: 1, max: 5 },
        { id: "dining",   label: "Dining areas",                single: "dining area",           hint: "Separate dining room",            price: 3000, min: 20, def: 0, max: 4 },
        { id: "study",    label: "Study or home office",        single: "study",                 hint: "",                                price: 3500, min: 25, def: 0, max: 5 },
        { id: "balcony",  label: "Balconies or terraces",       single: "balcony",               hint: "",                                price: 2500, min: 20, def: 0, max: 6 },
        { id: "store",    label: "Store or laundry rooms",      single: "store or laundry room", hint: "",                                price: 2000, min: 15, def: 0, max: 5 },
        { id: "stairs",   label: "Staircases or long hallways", single: "staircase or hallway",  hint: "For duplexes and long corridors", price: 2000, min: 20, def: 0, max: 4 }
      ],
      kitchen: {
        none:     { label: "No kitchen", price: 0,    min: 0 },
        small:    { label: "Small",      price: 4500, min: 45,  hint: "Kitchenette or compact" },
        standard: { label: "Standard",   price: 6500, min: 70,  hint: "Typical family kitchen" },
        large:    { label: "Large",      price: 9500, min: 100, hint: "Big, or more than one" }
      },
      office: {
        callout: 8000, min: 40000,
        rooms: [
          { id: "private",     label: "Private offices", single: "private office", hint: "",                        price: 5000, min: 30, def: 3, max: 40 },
          { id: "meeting",     label: "Meeting rooms",   single: "meeting room",   hint: "",                        price: 4000, min: 25, def: 1, max: 15 },
          { id: "reception",   label: "Reception areas", single: "reception area", hint: "",                        price: 4000, min: 25, def: 1, max: 5 },
          { id: "toilet",      label: "Toilets",         single: "toilet",         hint: "Each toilet or block",    price: 2800, min: 25, def: 2, max: 20 },
          { id: "kitchenette", label: "Kitchenettes",    single: "kitchenette",    hint: "Staff kitchen or pantry", price: 4500, min: 35, def: 1, max: 6 }
        ],
        open: {
          none:   { label: "None",   price: 0,     min: 0 },
          small:  { label: "Small",  price: 8000,  min: 45,  hint: "Up to about 10 desks" },
          medium: { label: "Medium", price: 14000, min: 80,  hint: "About 10 to 30 desks" },
          large:  { label: "Large",  price: 22000, min: 130, hint: "More than 30 desks" }
        }
      },
      hostel: {
        callout: 8000, min: 30000,
        rooms: [
          { id: "room",     label: "Student or guest rooms",  single: "room",              hint: "Each room",             price: 2500, min: 20, def: 10, max: 300 },
          { id: "bathroom", label: "Shared bathrooms",        single: "shared bathroom",   hint: "",                      price: 3000, min: 40, def: 2,  max: 60 },
          { id: "toilet",   label: "Shared toilets",          single: "shared toilet",     hint: "",                      price: 1800, min: 20, def: 2,  max: 60 },
          { id: "kitchen",  label: "Shared kitchens",         single: "shared kitchen",    hint: "",                      price: 6000, min: 60, def: 1,  max: 30 },
          { id: "corridor", label: "Corridors or floors",     single: "corridor or floor", hint: "Each floor's corridor", price: 3000, min: 30, def: 2,  max: 40 },
          { id: "common",   label: "Common or reading rooms", single: "common room",       hint: "",                      price: 4000, min: 30, def: 1,  max: 20 }
        ]
      },
      fumigation: {
        callout: 8000, min: 20000,
        rooms: [
          { id: "bedroom",  label: "Bedrooms",           single: "bedroom",        hint: "",                         price: 3500, min: 15, def: 2, max: 20 },
          { id: "living",   label: "Living rooms",       single: "living room",    hint: "",                         price: 4500, min: 20, def: 1, max: 6 },
          { id: "dining",   label: "Dining areas",       single: "dining area",    hint: "",                         price: 3000, min: 12, def: 0, max: 6 },
          { id: "kitchen",  label: "Kitchens",           single: "kitchen",        hint: "Where roaches gather",     price: 5000, min: 25, def: 1, max: 6 },
          { id: "bathroom", label: "Bathrooms and toilets", single: "bathroom or toilet", hint: "",                  price: 2000, min: 10, def: 1, max: 20 },
          { id: "store",    label: "Stores or other rooms", single: "store or other room", hint: "Garage, store, shop floor", price: 2500, min: 12, def: 0, max: 20 }
        ],
        outdoor: {
          none:   { label: "None",   price: 0,     min: 0 },
          small:  { label: "Small",  price: 5000,  min: 20, hint: "A small yard or frontage" },
          medium: { label: "Medium", price: 10000, min: 35, hint: "A typical compound" },
          large:  { label: "Large",  price: 18000, min: 60, hint: "A big compound or garden" }
        },
        pests: {
          general:  { label: "Cockroaches, ants and flies", price: 0,     min: 0,  hint: "Included in the room price" },
          bedbugs:  { label: "Bed bugs",                    price: 6000,  min: 40, hint: "Two visits are often needed" },
          termites: { label: "Termites",                    price: 15000, min: 90, hint: "Soil and wood treatment" },
          rodents:  { label: "Rats and mice",               price: 8000,  min: 45, hint: "Baiting and entry-point advice" },
          mosquito: { label: "Mosquitoes",                  price: 3000,  min: 20, hint: "Fogging indoors and outdoors" }
        }
      },
      windowInside: 3000,
      extras: {
        oven:       { label: "Inside the oven",                price: 2500, min: 20, needs: "kitchen", for: "home" },
        fridge:     { label: "Inside fridge and freezer",      price: 2000, min: 15, needs: "kitchen", for: "home" },
        cabinets:   { label: "Inside kitchen cabinets",        price: 3000, min: 25, needs: "kitchen", for: "home" },
        wardrobes:  { label: "Inside wardrobes and cupboards", price: 3000, min: 25, for: "home" },
        carpet:     { label: "Carpet and rug cleaning",        price: 7500, min: 35, for: "all" },
        upholstery: { label: "Sofa and upholstery",            price: 8500, min: 45, for: "all" },
        tiles:      { label: "Tile and grout scrub",           price: 6000, min: 45, for: "all" }
      },
      freq: {
        once:      { label: "One-off",       off: 0,    visits: 1 },
        monthly:   { label: "Monthly",       off: 0.05, visits: 1 },
        fortnight: { label: "Every 2 weeks", off: 0.10, visits: 2 },
        weekly:    { label: "Weekly",        off: 0.15, visits: 4 }
      }
    }
  };
  var SLOTS = [
    { id: "morning", label: "Morning", time: "8am to 11am" }, { id: "midday", label: "Midday", time: "11am to 2pm" },
    { id: "afternoon", label: "Afternoon", time: "2pm to 5pm" }, { id: "evening", label: "Evening", time: "5pm to 8pm" }
  ];
  var TERMS_VERSION = "2026-10", COND = { light: "Lightly used", normal: "Normal", heavy: "Very dirty" };

  function clamp(v, lo, hi) { v = parseInt(v, 10); if (isNaN(v)) v = lo; return Math.min(hi, Math.max(lo, v)); }
  function roundTo(n, s) { return Math.round(n / s) * s; }
  function fmt(n) { return "\u20A6" + Math.round(n).toLocaleString("en-NG"); }
  function plural(c, d) { return c === 1 ? c + " " + d.single : c + " " + d.label.toLowerCase(); }
  function dayDiff(a, b) { return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5); }
  function dow(ymd) { return new Date(ymd + "T12:00:00Z").getUTCDay(); }
  function groupOf(type, P) { var s = P.service[type]; return s ? s.group : "home"; }
  function roomDefs(group, P) { return group === "office" ? P.office.rooms : group === "hostel" ? P.hostel.rooms : group === "pest" ? P.fumigation.rooms : P.rooms; }
  function condLabel(sel, group) { return group === "pest" ? { light: "Light infestation", normal: "Normal", heavy: "Severe infestation" }[sel.cond] : COND[sel.cond]; }

  /* ctx (optional): { date, today, flex, water, power, pets, stairs } adds timing and site-condition factors. */
  function estimate(sel, P, ctx) {
    sel = sel || {}; ctx = ctx || {};
    var type = P.service[sel.type] ? sel.type : "residential", svc = P.service[type], group = svc.group;
    var isOffice = group === "office", isHostel = group === "hostel", isHome = group === "home", isPest = group === "pest";
    var cond = P.condition[sel.cond] || 1, sizeF = isHome ? (P.homeSize[sel.size] || 1) : 1, mult = Math.min(P.maxMult || 99, svc.price * cond * sizeF);
    var lines = [], extraLines = [], rooms = 0, minutes = P.setupMinutes, adjust = [], counts = sel.rooms || {};
    roomDefs(group, P).forEach(function (d) {
      var c = clamp(counts[d.id] || 0, 0, d.max); if (!c) return;
      var amt = c * d.price * mult; rooms += amt; minutes += c * d.min * svc.time * cond * sizeF; lines.push({ label: plural(c, d), amount: amt });
    });
    var tier = isOffice ? P.office.open[sel.open] : isHome ? P.kitchen[sel.kitchen] : isPest ? P.fumigation.outdoor[sel.outdoor] : null;
    if (tier && tier.price) { var ta = tier.price * mult; rooms += ta; minutes += tier.min * svc.time * cond * sizeF; lines.push({ label: (isOffice ? "Open-plan area, " : isPest ? "Outdoor area, " : "Kitchen, ") + tier.label.toLowerCase(), amount: ta }); }
    var callout = isOffice ? P.office.callout : isHostel ? P.hostel.callout : isPest ? P.fumigation.callout : P.callout;
    if (svc.price !== 1) adjust.push(svc.label.toLowerCase() + " rate");
    if (sizeF !== 1) adjust.push(sel.size + " home");
    if (cond !== 1) adjust.push(sel.cond === "heavy" ? (isPest ? "severe infestation" : "very dirty space") : (isPest ? "light infestation" : "lightly used space"));
    var extras = 0, hasKitchen = isHome && sel.kitchen && sel.kitchen !== "none";
    if (isPest) {
      (sel.pests || []).forEach(function (k) { var e = P.fumigation.pests[k]; if (!e || !e.price) return; extras += e.price; minutes += e.min; extraLines.push({ label: "Treatment for " + e.label.toLowerCase(), amount: e.price }); });
    } else {
      (sel.extras || []).forEach(function (k) { var e = P.extras[k]; if (!e || (e.for === "home" && !isHome) || (e.needs === "kitchen" && !hasKitchen)) return; extras += e.price; minutes += e.min; extraLines.push({ label: e.label, amount: e.price }); });
      var w = clamp(sel.extraWindows || 0, 0, 60);
      if (w) { var wa = w * P.windowInside; extras += wa; minutes += w * 6; extraLines.push({ label: w + (w === 1 ? " window, inside" : " windows, inside"), amount: wa }); }
    }
    var subtotal = callout + rooms + extras, minCharge = isOffice ? P.office.min : isHostel ? P.hostel.min : isPest ? P.fumigation.min : P.minTotal, floorApplied = subtotal < minCharge;
    if (floorApplied) subtotal = minCharge;
    var adjustLines = [], flat = 0, pct = 0, st = P.site, tm = P.timing;
    if (!isPest && ctx.water === false) { flat += st.noWater; adjustLines.push({ label: "No running water on site", amount: st.noWater }); minutes += 15; }
    if (!isPest && ctx.power === false) { flat += st.noPower; adjustLines.push({ label: "No electricity on site", amount: st.noPower }); }
    if (ctx.pets && !isPest) { flat += st.pets; adjustLines.push({ label: "Pets at home (extra hair removal)", amount: st.pets }); minutes += 10; }
    var pl = [];
    if (ctx.stairs && st.stairsPct) pl.push({ label: "Upper floor, stairs only", pct: st.stairsPct });
    if (ctx.flex) { if (tm.flexiblePct) pl.push({ label: "Flexible date discount", pct: -tm.flexiblePct }); }
    else if (ctx.date && ctx.today) {
      var dd = dayDiff(ctx.today, ctx.date), wd = dow(ctx.date);
      if (dd <= tm.rushDays && tm.rushPct) pl.push({ label: "Short-notice booking (within " + tm.rushDays + " days)", pct: tm.rushPct });
      if ((wd === 0 || wd === 6) && tm.weekendPct) pl.push({ label: "Weekend visit", pct: tm.weekendPct });
    }
    var pctBase = subtotal + flat; pl.forEach(function (l) { adjustLines.push({ label: l.label, amount: pctBase * l.pct, pct: l.pct }); pct += l.pct; });
    var adjusted = pctBase * (1 + pct), freq = P.freq[sel.freq] || P.freq.once, disc = adjusted * freq.off, total = roundTo(adjusted - disc, 500);
    var low = roundTo(total * (1 - P.range), 500), high = roundTo(total * (1 + P.range), 500);
    var labour = minutes / 60, crew = labour <= 3.5 ? 1 : labour <= 8 ? 2 : labour <= 12 ? 3 : labour <= 20 ? 4 : 5, hours = Math.max(1.5, Math.ceil(labour / crew * 2) / 2);
    return { type: type, group: group, label: svc.label, lines: lines, extraLines: extraLines, callout: callout, discount: disc, subtotal: subtotal, adjustLines: adjustLines, adjusted: adjusted, floorApplied: floorApplied, minCharge: minCharge, adjust: adjust, total: total, low: low, high: high, hours: hours, crew: crew, freq: freq, freqKey: P.freq[sel.freq] ? sel.freq : "once", monthly: freq.visits > 1 ? total * freq.visits : null };
  }
  function normalize(sel, P) {
    sel = sel || {}; var type = P.service[sel.type] ? sel.type : "residential", group = groupOf(type, P);
    var out = { type: type, size: P.homeSize[sel.size] ? sel.size : "average", cond: P.condition[sel.cond] ? sel.cond : "normal", kitchen: P.kitchen[sel.kitchen] ? sel.kitchen : "standard", open: P.office.open[sel.open] ? sel.open : "none", outdoor: P.fumigation.outdoor[sel.outdoor] ? sel.outdoor : "none", rooms: {}, extras: [], pests: [], extraWindows: clamp(sel.extraWindows, 0, 60), freq: P.freq[sel.freq] ? sel.freq : "once" };
    var r = sel.rooms || {}, seen = {}, seenP = {}; roomDefs(group, P).forEach(function (d) { out.rooms[d.id] = clamp(r[d.id], 0, d.max); });
    (Array.isArray(sel.extras) ? sel.extras : []).forEach(function (k) { if (P.extras[k] && !seen[k]) { seen[k] = 1; out.extras.push(k); } });
    (Array.isArray(sel.pests) ? sel.pests : []).forEach(function (k) { if (P.fumigation.pests[k] && !seenP[k]) { seenP[k] = 1; out.pests.push(k); } });
    if (group === "pest" && !out.pests.length) out.pests.push("general");
    return out;
  }

  function longDate(v) { try { return new Date(v + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch (e) { return v; } }
  function shortDate(v) { try { return new Date(v + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return v; } }
  function slotText(id, slots) { if (!id || id === "any") return "Any time"; var s = (slots || SLOTS).filter(function (x) { return x.id === id; })[0]; return s ? s.label + " (" + s.time + ")" : "Any time"; }
  function where(b) { var a = b.address || {}; return [a.street, b.city, b.state].filter(Boolean).join(", ") + (a.landmark ? " (near " + a.landmark + ")" : ""); }
  function facts(b) { var a = b.access || {}, f = []; if (!a.water) f.push("No running water on site"); if (!a.power) f.push("No electricity on site"); if (a.parking) f.push("Parking available"); if (a.gate) f.push("Gate pass or ID needed"); if (a.pets) f.push("Pets: " + (a.petType || "yes")); return f; }
  function roomsList(b) { var t = b.estimate.lines.map(function (l) { return l.label; }); if (b.estimate.group === "home" && b.sel.kitchen === "none") t.push("no kitchen"); return t.join(", "); }
  function extrasText(b) { var t = b.estimate.extraLines.map(function (l) { return l.label; }); return t.length ? t.join(", ") : "None"; }
  function pestText(b, P) { return (b.sel.pests || []).map(function (k) { return P.fumigation.pests[k] ? P.fumigation.pests[k].label : k; }).join(", "); }
  function yn(v) { return v ? "Yes" : "No"; }
  function summaryRows(b, P, slots) {
    var s = b.sel, est = b.estimate, d = b.details || {}, ac = b.access || {}, sc = b.schedule || {}, isHome = est.group === "home", isPest = est.group === "pest";
    var rows = [
      ["Service", est.label + (isHome ? ", " + (d.propType || "home") + ", " + s.size + " size" : ""), 1],
      ["Rooms", roomsList(b) + (d.otherRooms ? ". Also: " + d.otherRooms : ""), 2]
    ];
    if (isPest) rows.push(["Pests to treat", pestText(b, P), 2]);
    rows.push([isPest ? "Infestation" : "Condition", condLabel(s, est.group), 2], [isPest ? "Plan" : "Extras and plan", (isPest ? "" : extrasText(b) + ". ") + est.freq.label, 3],
      ["When", (sc.date ? longDate(sc.date) : "Not chosen yet") + ", " + slotText(sc.slot, slots) + (sc.flex ? " (flexible)" : ""), 4], ["Address", where(b), 4],
      ["Access", (ac.access || "") + ", " + String(ac.floor || "").toLowerCase() + (facts(b).length ? ". " + facts(b).join(", ") : ""), 4]);
    var notes = [(b.focus || []).length ? "Focus: " + b.focus.join(", ") : "", b.instructions || ""].filter(Boolean).join(". "); if (notes) rows.push(["Notes", notes, 4]);
    if (b.budget) rows.push(["Your budget", "\u20A6" + Number(String(b.budget).replace(/\D/g, "")).toLocaleString("en-NG"), 4]);
    rows.push(["Estimate", fmt(est.low) + " to " + fmt(est.high) + " per visit, about " + est.hours + "h with " + est.crew + (est.crew === 1 ? " technician" : " people"), 0]);
    if (b.finalPrice) rows.push(["Confirmed price", fmt(b.finalPrice) + " per visit", 0]);
    return rows;
  }
  function bookingText(b, P, slots) {
    var s = b.sel, est = b.estimate, c = b.customer || {}, d = b.details || {}, ac = b.access || {}, sc = b.schedule || {}, isHome = est.group === "home", isPest = est.group === "pest", L = [];
    L.push("NEW BOOKING REQUEST" + (b.ref ? " " + b.ref : ""), "", "SERVICE", "Type: " + est.label);
    if (isHome) L.push("Property: " + (d.propType || "Not stated") + ", " + s.size + " size", "Kitchen: " + (s.kitchen === "none" ? "None" : P.kitchen[s.kitchen].label));
    L.push("Rooms: " + (est.lines.map(function (l) { return l.label; }).join(", ") || "None listed")); if (d.otherRooms) L.push("Other rooms or areas: " + d.otherRooms);
    if (isPest) L.push("Pests: " + pestText(b, P));
    L.push((isPest ? "Infestation: " : "Condition: ") + condLabel(s, est.group)); if (!isPest) L.push("Extras: " + extrasText(b)); L.push("Frequency: " + est.freq.label, "");
    L.push("SCHEDULE", "Date: " + (sc.date ? longDate(sc.date) : "Not chosen") + (sc.flex ? " (flexible)" : ""), "Time: " + slotText(sc.slot, slots), "");
    L.push("LOCATION", "City: " + (b.city || "") + (b.state ? ", " + b.state : ""), "Address: " + (b.address || {}).street); if ((b.address || {}).landmark) L.push("Landmark: " + b.address.landmark);
    L.push("Access: " + (ac.access || "") + "; " + (ac.floor || ""), "Water on site: " + yn(ac.water), "Electricity on site: " + yn(ac.power), "Parking for team: " + yn(ac.parking), "Gate pass or ID needed: " + yn(ac.gate), "Pets: " + (ac.pets ? "Yes (" + (ac.petType || "not specified") + ")" : "No"));
    if ((b.focus || []).length) L.push("Focus areas: " + b.focus.join(", ")); if (b.instructions) L.push("Instructions: " + b.instructions);
    L.push("", "ESTIMATE", "Range: " + fmt(est.low) + " to " + fmt(est.high) + " per visit (mid " + fmt(est.total) + ")", "Time: about " + est.hours + " hours with " + est.crew + (est.crew === 1 ? " technician" : " people"));
    if ((est.adjustLines || []).length) L.push("Price factors: " + est.adjustLines.map(function (l) { return l.label; }).join("; "));
    if (b.budget) L.push("Customer budget: \u20A6" + Number(String(b.budget).replace(/\D/g, "")).toLocaleString("en-NG"));
    L.push("", "CONTACT", "Name: " + (c.name || ""), "Phone: " + (c.phone || "")); if (c.email) L.push("Email: " + c.email); L.push("Prefers: " + (c.pref || "WhatsApp"));
    return L.join("\n");
  }
  return { SETTINGS: SETTINGS, SLOTS: SLOTS, TERMS_VERSION: TERMS_VERSION, COND: COND, estimate: estimate, normalize: normalize, clamp: clamp, roundTo: roundTo, fmt: fmt, groupOf: groupOf, roomDefs: roomDefs, condLabel: condLabel, longDate: longDate, shortDate: shortDate, slotText: slotText, where: where, facts: facts, roomsList: roomsList, extrasText: extrasText, pestText: pestText, summaryRows: summaryRows, bookingText: bookingText };
});
