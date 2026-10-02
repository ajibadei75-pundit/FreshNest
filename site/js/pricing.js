/* ==========================================================================
   Pricing, booking rules and the room-by-room estimate.
   One file, used by the browser (window.FNPricing) and by the server
   (require), so the price a customer sees is the price we re-check on save.
   Prices are in naira and are the same in every city and state.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FNPricing = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var RULES = {
    leadDays: 1,          /* earliest booking is today + this many days */
    maxDaysAhead: 120,
    termsVersion: "2026-10-02",
    /* The only places we work. The booking form and the server both check against this list. */
    cities: [
      { name: "Ibadan",   state: "Oyo" },
      { name: "Oyo",      state: "Oyo" },
      { name: "Ogbomoso", state: "Oyo" },
      { name: "Osogbo",   state: "Osun" },
      { name: "Ilorin",   state: "Kwara" },
      { name: "Lagos",    state: "Lagos" }
    ],
    slots: [
      { id: "morning",   label: "Morning",   time: "8am to 11am" },
      { id: "midday",    label: "Midday",    time: "11am to 2pm" },
      { id: "afternoon", label: "Afternoon", time: "2pm to 5pm" },
      { id: "evening",   label: "Evening",   time: "5pm to 8pm" }
    ]
  };

  var PRICING = {
    callout: 5000,          /* transport, supplies and equipment for a home visit */
    minTotal: 15000,        /* smallest home visit we take */
    range: 0.08,            /* estimate is shown as total -8% to +8% */
    setupMinutes: 20,
    maxMult: 2,             /* stacked multipliers never exceed this */

    /* "set" says which list of rooms a service is priced from: home, office or hostel. */
    service: {
      residential:  { label: "Residential Cleaning",            set: "home",   price: 1,    time: 1   },
      office:       { label: "Office & Commercial Cleaning",    set: "office", price: 1,    time: 1   },
      deep:         { label: "Deep Cleaning",                   set: "home",   price: 1.5,  time: 1.7 },
      hostel:       { label: "Hostel Cleaning",                 set: "hostel", price: 1,    time: 1   },
      move:         { label: "Move-in & Move-out Cleaning",     set: "home",   price: 1.15, time: 1.9 },
      regular:      { label: "One-time & Regular Cleaning",     set: "home",   price: 1,    time: 1   },
      construction: { label: "Post-Construction Cleaning",      set: "home",   price: 1.4,  time: 2.4 }
    },
    homeSize:  { compact: 0.9, average: 1, large: 1.2 },
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
      callout: 8000, min: 35000,
      rooms: [
        { id: "room",     label: "Student rooms",           single: "student room",           hint: "Each bedroom",                    price: 3500, min: 20, def: 10, max: 150 },
        { id: "bathroom", label: "Shared bathrooms",        single: "shared bathroom",        hint: "Shower or bath rooms",            price: 3500, min: 30, def: 2,  max: 30 },
        { id: "toilet",   label: "Shared toilets",          single: "shared toilet",          hint: "Toilets without a shower",        price: 2000, min: 20, def: 2,  max: 30 },
        { id: "kitchen",  label: "Shared kitchens",         single: "shared kitchen",         hint: "Cooking areas",                   price: 5000, min: 40, def: 1,  max: 10 },
        { id: "common",   label: "Common rooms or lounges", single: "common room",            hint: "",                                price: 4000, min: 30, def: 0,  max: 10 },
        { id: "corridor", label: "Corridors and staircases", single: "corridor or staircase", hint: "Count one per floor",             price: 3000, min: 25, def: 2,  max: 20 }
      ]
    },

    windowInside: 3000,     /* extra per window when added to any clean (inside glass only) */

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
  };

  /* One-tap starting points for the rooms step. Customers can adjust every number afterwards. */
  var PRESETS = {
    home: [
      { label: "1 bedroom",  hint: "Flat or small home",  kitchen: "small",    rooms: { bedroom: 1, bathroom: 1, living: 1 } },
      { label: "2 bedrooms", hint: "Typical flat",        kitchen: "standard", rooms: { bedroom: 2, bathroom: 2, living: 1 } },
      { label: "3 bedrooms", hint: "Family home",         kitchen: "standard", rooms: { bedroom: 3, bathroom: 3, living: 1, dining: 1 } },
      { label: "4 bedrooms", hint: "Large house",         kitchen: "large",    rooms: { bedroom: 4, bathroom: 4, living: 2, dining: 1 } }
    ],
    office: [
      { label: "Small office",  hint: "About 3 offices",   open: "none",   rooms: { private: 3,  meeting: 1, reception: 1, toilet: 2, kitchenette: 1 } },
      { label: "Medium office", hint: "About 8 offices",   open: "small",  rooms: { private: 8,  meeting: 2, reception: 1, toilet: 4, kitchenette: 1 } },
      { label: "Large office",  hint: "About 15 offices",  open: "medium", rooms: { private: 15, meeting: 4, reception: 1, toilet: 6, kitchenette: 2 } }
    ],
    hostel: [
      { label: "10 rooms", hint: "Small hostel",  rooms: { room: 10, bathroom: 2, toilet: 2, kitchen: 1, common: 0, corridor: 2 } },
      { label: "20 rooms", hint: "Medium hostel", rooms: { room: 20, bathroom: 4, toilet: 4, kitchen: 2, common: 1, corridor: 4 } },
      { label: "40 rooms", hint: "Large hostel",  rooms: { room: 40, bathroom: 8, toilet: 8, kitchen: 3, common: 1, corridor: 6 } }
    ]
  };

  function clamp(v, lo, hi) { v = parseInt(v, 10); if (isNaN(v)) v = lo; return Math.min(hi, Math.max(lo, v)); }
  function roundTo(n, s) { return Math.round(n / s) * s; }
  function fmt(n) { return "\u20A6" + Math.round(n).toLocaleString("en-NG"); }
  function plural(c, d) { return c === 1 ? c + " " + d.single : c + " " + d.label.toLowerCase(); }

  function roomSet(P, set) { return set === "office" ? P.office.rooms : set === "hostel" ? P.hostel.rooms : P.rooms; }

  function estimate(sel, P) {
    P = P || PRICING; sel = sel || {};
    var type = P.service[sel.type] ? sel.type : "residential";
    var svc = P.service[type], set = svc.set;
    var isHome = set === "home", isOffice = set === "office";
    var cond = P.condition[sel.cond] || 1;
    var sizeF = isHome ? (P.homeSize[sel.size] || 1) : 1;
    var mult = Math.min(P.maxMult || 99, svc.price * cond * sizeF);
    var lines = [], extraLines = [], rooms = 0, minutes = 0, adjust = [];

    var counts = sel.rooms || {};
    roomSet(P, set).forEach(function (d) {
      var c = clamp(counts[d.id] || 0, 0, d.max); if (!c) return;
      var amt = c * d.price * mult; rooms += amt;
      minutes += c * d.min * svc.time * cond * sizeF;
      lines.push({ label: plural(c, d), amount: amt });
    });
    var tier = isHome ? P.kitchen[sel.kitchen] : isOffice ? P.office.open[sel.open] : null;
    if (tier && tier.price) {
      var ta = tier.price * mult; rooms += ta;
      minutes += tier.min * svc.time * cond * sizeF;
      lines.push({ label: (isOffice ? "Open-plan area, " : "Kitchen, ") + tier.label.toLowerCase(), amount: ta });
    }
    var callout = isHome ? P.callout : isOffice ? P.office.callout : P.hostel.callout;
    minutes += P.setupMinutes;

    if (svc.price !== 1) adjust.push(svc.label.toLowerCase() + " rate");
    if (sizeF !== 1) adjust.push(sel.size + " home");
    if (cond !== 1) adjust.push(sel.cond === "heavy" ? "very dirty space" : "lightly used space");

    var extras = 0, hasKitchen = isHome && sel.kitchen && sel.kitchen !== "none";
    (sel.extras || []).forEach(function (k) {
      var e = P.extras[k]; if (!e) return;
      if (e.for === "home" && !isHome) return;
      if (e.needs === "kitchen" && !hasKitchen) return;
      extras += e.price; minutes += e.min; extraLines.push({ label: e.label, amount: e.price });
    });
    var w = clamp(sel.extraWindows || 0, 0, 40);
    if (w) { var wa = w * P.windowInside; extras += wa; minutes += w * 6; extraLines.push({ label: w + (w === 1 ? " window, inside" : " windows, inside"), amount: wa }); }

    var subtotal = callout + rooms + extras;
    var minCharge = isHome ? P.minTotal : isOffice ? P.office.min : P.hostel.min;
    var floorApplied = subtotal < minCharge;
    if (floorApplied) subtotal = minCharge;
    var freq = P.freq[sel.freq] || P.freq.once;
    var disc = subtotal * freq.off;
    var total = roundTo(subtotal - disc, 500);
    var low = roundTo(total * (1 - P.range), 500), high = roundTo(total * (1 + P.range), 500);

    var labour = minutes / 60;
    var crew = labour <= 3.5 ? 1 : labour <= 8 ? 2 : labour <= 12 ? 3 : 4;
    var hours = Math.max(1.5, Math.ceil(labour / crew * 2) / 2);

    return {
      type: type, set: set, label: svc.label, lines: lines, extraLines: extraLines, callout: callout, discount: disc,
      subtotal: subtotal, floorApplied: floorApplied, minCharge: minCharge, adjust: adjust,
      total: total, low: low, high: high, hours: hours, crew: crew,
      freq: freq, freqKey: P.freq[sel.freq] ? sel.freq : "once",
      monthly: freq.visits > 1 ? total * freq.visits : null
    };
  }

  return { RULES: RULES, PRICING: PRICING, PRESETS: PRESETS, roomSet: roomSet, estimate: estimate, clamp: clamp, roundTo: roundTo, fmt: fmt };
});
