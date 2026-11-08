/* Job planner: turns answers into a work procedure, crew and machine plan, time estimate and quotation.
   Numbers are always calculated here from your own settings and the field manual's formulas. The AI only helps gather answers. */
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(require("./manual.js")); else root.FNPlanner = factory(root.FNManual); })(typeof self !== "undefined" ? self : this, function (M) {
  "use strict";
  var S = M.SURFACES, T = M.STAINS;
  function ci(v, lo, hi) { v = parseInt(v, 10); return isNaN(v) ? null : Math.max(lo, Math.min(hi, v)); }
  function str(v, n) { return typeof v === "string" ? v.trim().slice(0, n) : ""; }
  function r10(n) { return Math.round(n / 10) * 10; } function up500(n) { return Math.ceil(n / 500) * 500; } function r05(n) { return Math.max(0.5, Math.round(n * 2) / 2); }
  function normalizeFacts(f) {
    f = f || {}; var o = {}, c = f.crew && typeof f.crew === "object" ? f.crew : null;
    o.title = str(f.title, 80); o.surface = S[f.surface] ? f.surface : null; o.stain = T[f.stain] ? f.stain : null; o.area = Math.max(0, Math.min(5000, Math.round((+f.area || 0) * 10) / 10));
    o.thickness = ["thin", "normal", "thick"].indexOf(f.thickness) > -1 ? f.thickness : "normal"; o.access = ["ground", "ladder", "height"].indexOf(f.access) > -1 ? f.access : null;
    o.occupied = !!f.occupied; o.water = f.water !== false; o.power = f.power !== false; o.ventilation = f.ventilation === "poor" ? "poor" : "good";
    o.oldBuilding = !!f.oldBuilding; o.decorative = !!f.decorative; o.damage = !!f.damage; o.afterHours = !!f.afterHours; o.testPatchDone = !!f.testPatchDone; o.wantsGuarantee = !!f.wantsGuarantee;
    o.deadlineDays = ci(f.deadlineDays, 0, 60) || 0; o.hoursPerDay = ci(f.hoursPerDay, 4, 12) || 0; o.marginPct = f.marginPct === null || f.marginPct === undefined || f.marginPct === "" ? null : Math.max(0, Math.min(70, +f.marginPct || 0));
    o.crew = c ? { lead: ci(c.lead, 0, 20) || 0, technician: ci(c.technician, 0, 20) || 0, support: ci(c.support, 0, 20) || 0 } : null;
    o.machines = Array.isArray(f.machines) ? f.machines.filter(function (x) { return typeof x === "string"; }).slice(0, 12) : null;
    o.notes = str(f.notes, 300); o.answered = (Array.isArray(f.answered) ? f.answered : []).filter(function (x) { return typeof x === "string"; }).slice(0, 12); o.assumptions = (Array.isArray(f.assumptions) ? f.assumptions : []).map(function (x) { return str(x, 140); }).filter(Boolean).slice(0, 10);
    return o;
  }
  function missing(f) { var m = []; if (!(f.area > 0)) m.push("area"); if (!f.stain) m.push("stain"); if (!f.surface) m.push("surface"); if (!f.access) m.push("access"); return m; }
  function nextQuestion(f) {
    var need = missing(f); for (var i = 0; i < M.QUESTIONS.length; i++) { var q = M.QUESTIONS[i], req = ["area", "stain", "surface", "access"].indexOf(q.id) > -1; if (req ? need.indexOf(q.id) > -1 : f.answered.indexOf(q.id) < 0) return q; } return null;
  }
  var NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  /* Keyword reader (used without an AI key, and to double-check AI output). askedId is the question this reply answers. */
  function applyAnswer(prev, text, askedId) {
    var f = normalizeFacts(prev), t = " " + String(text || "").toLowerCase().replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b(?=\s*(?:leads?|supervisors?|technicians?|workers?|cleaners?|staff|people|men|support|panes?|windows?|rooms?|days?))/g, function (m) { return NUM[m]; }) + " ", as = f.assumptions.slice();
    function has(re) { return re.test(t); } function say(x) { if (as.indexOf(x) < 0) as.push(x); }
    var m;
    if (has(/\bunder 5\b/)) f.area = 4; else if (has(/\b5 to 20\b/)) f.area = 12; else if (has(/\b20 to 60\b/)) f.area = 40; else if (has(/\bover 60\b/)) f.area = 80;
    else if ((m = t.match(/(\d+(?:\.\d+)?)\s*(?:m2|m²|sqm|sq\.? ?m|square met)/))) f.area = +m[1];
    else if ((m = t.match(/(\d+)\s*(?:panes?|windows?)/))) { f.area = Math.round(+m[1] * 12) / 10; say("Counted each pane as about 1.2 m2"); }
    else if ((m = t.match(/(\d+)\s*rooms?/))) { f.area = +m[1] * 15; say("Counted each room as about 15 m2 of affected surface"); }
    else if (askedId === "area" && (m = t.match(/(\d+(?:\.\d+)?)/))) f.area = +m[1];
    if (askedId === "stain" || askedId === undefined || !f.stain) {
      var s = null;
      if (has(/epoxy|polyurethane|2.?part|industrial coating/)) s = "epoxy_pu"; else if (has(/paint in (?:the )?grout|grout.{0,12}paint|paint.{0,15}grout/)) s = "grout_paint"; else if (has(/oil paint|oil.?based|enamel|alkyd|gloss paint/)) s = "oil_alkyd";
      else if (has(/(?:fresh|wet|still wet)[^.]{0,25}(?:water|acrylic|latex|emulsion|paint)/)) s = "fresh_water"; else if (has(/(?:dried|cured|hard|dry)[^.]{0,25}(?:water|acrylic|latex|emulsion|paint)/)) s = "cured_water";
      else if (has(/haze|cement|mortar/)) s = "cement_haze"; else if (has(/adhesive|silicone|caulk|glue|sealant/)) s = "adhesive"; else if (has(/grease|soap|oily/)) s = "grease"; else if (has(/rust|hard.?water|mineral|limescale|scale\b/)) s = "rust_mineral";
      else if (has(/not sure|unknown|don.?t know|mixed|construction residue/)) s = "unknown"; else if (has(/emulsion|acrylic|latex|water.?based/)) { s = "cured_water"; say("Assumed the water-based paint is dried"); } else if (has(/\bpaint/)) { s = "cured_water"; say("Assumed dried water-based paint; confirm with a test patch"); }
      if (s) f.stain = s;
    }
    if (askedId === "surface" || askedId === undefined || !f.surface) {
      var u = null;
      if (has(/coated|tinted|mirror|low.?e|decorative glass|tempered/)) u = "glass_special"; else if (has(/mosaic/)) u = "mosaic"; else if (has(/\bunglazed|quarry|terracotta/)) u = "tile_unglazed"; else if (has(/marble|limestone|travertine/)) u = "stone_acid"; else if (has(/granite|\bstone\b/)) u = "stone_other";
      else if (has(/epoxy grout/)) u = "grout_epoxy"; else if (has(/porcelain/)) u = "tile_porcelain"; else if (has(/glazed|ceramic/)) u = "tile_glazed"; else if (has(/\bglass|window|pane|louvre/)) u = "glass"; else if (has(/\bgrout/) && askedId === "surface") u = "grout_cement";
      else if (has(/\btiles?\b/)) { u = "tile_glazed"; say("Assumed glazed ceramic tile; confirm the tile type"); } else if (has(/not sure|unknown|damaged/) && askedId === "surface") u = "unknown";
      if (u) f.surface = u;
    }
    if (has(/thick|layer|multiple coats|several coats/)) f.thickness = "thick"; else if (has(/\bthin\b|specks|small splash|light splash/)) f.thickness = "thin";
    if (has(/height|scaffold|high up|upper floor|storey|story building/)) f.access = "height"; else if (has(/ladder/)) f.access = "ladder"; else if (has(/ground|floor level|easy access/)) f.access = "ground";
    if (has(/after.?hours|at night|night work/)) { f.afterHours = true; if (!f.access && askedId === "access") { f.access = "ground"; say("Assumed ground-level access"); } }
    if (has(/\boccupied|children|kids|pets|customers|people around/)) f.occupied = true; else if (has(/\bempty|vacant|unoccupied/)) f.occupied = false;
    if (has(/no (?:running )?water/)) f.water = false; if (has(/no (?:power|electric|light|nepa)/)) f.power = false; if (has(/poor ventilation|no ventilation|enclosed|closed room|no windows/)) f.ventilation = "poor";
    if (has(/old building|old house|\blead\b|1970|1960|1950/)) f.oldBuilding = true; if (has(/expensive|decorative|designer|imported|high.?value/)) f.decorative = true; if (has(/existing damage|already damaged|cracked|chipped/)) f.damage = true;
    if (has(/test patch (?:done|completed)|already tested|tested already/)) f.testPatchDone = true; if (has(/guarantee/)) f.wantsGuarantee = true;
    if (has(/use my saved|saved crew/)) { f.crew = null; f.machines = null; } else if (askedId === "resources" || has(/technicians?|workers?|supervisors?|\bleads?\b|no machines|wet.?vac|spin|floor machine|scrubber|squeegee|pressure washer/)) {
      var c = f.crew || { lead: 0, technician: 0, support: 0 }, got = false;
      if ((m = t.match(/(\d+)\s*(?:leads?|supervisors?)/))) { c.lead = +m[1]; got = true; } if ((m = t.match(/(\d+)\s*(?:technicians?|workers?|cleaners?|staff|people|men)/))) { c.technician = +m[1]; got = true; } if ((m = t.match(/(\d+)\s*support/))) { c.support = +m[1]; got = true; }
      if (got) f.crew = c; var ms = []; [["spin", /spin|battery scrubber/], ["wetvac", /wet.?vac|wet.?dry|vacuum/], ["squeegee", /squeegee/], ["floor", /floor machine|polisher|floor scrubber|single.?disc/], ["rideon", /ride.?on|auto.?scrubber/], ["pressure", /pressure washer/]].forEach(function (x) { if (x[1].test(t)) ms.push(x[0]); });
      if (has(/no machines?|without machines?|manual only/)) f.machines = []; else if (ms.length) f.machines = ms;
    }
    if (has(/no deadline|not urgent/)) f.deadlineDays = 0; else if ((m = t.match(/within\s*(\d+)\s*days?/)) || (m = t.match(/(\d+)\s*days? (?:deadline|to finish)/))) f.deadlineDays = Math.min(60, +m[1]); else if (has(/within a day|within 1 day|one day|today|tomorrow/)) f.deadlineDays = 1;
    if ((m = t.match(/(\d+(?:\.\d+)?)\s*%\s*(?:margin|profit)?/)) && (askedId === "plan" || has(/margin|profit/))) f.marginPct = Math.min(70, +m[1]); if (has(/default margin/)) f.marginPct = null;
    if (askedId && f.answered.indexOf(askedId) < 0) f.answered.push(askedId); f.assumptions = as; return normalizeFacts(f);
  }
  function machineCostPerHour(m, PS) { return Math.round((m.purchase * (1 - m.resalePct / 100)) / Math.max(1, m.lifeHours) + m.maint + m.consumable + m.purchase * (PS.financePct || 0) / 100); }
  function crewOf(PS, id) { return PS.crew.filter(function (c) { return c.id === id; })[0] || { rate: 0, count: 0 }; }
  function plan(facts, PS) {
    var f = normalizeFacts(facts), flags = [], as = f.assumptions.slice(), stainId = f.stain || "unknown", surfId = f.surface || "unknown", access = f.access || "ground", area = f.area > 0 ? f.area : 1;
    if (!f.stain) as.push("Stain type not stated: treated as unknown (diagnostic stage)"); if (!f.surface) as.push("Surface not stated: treated as unknown"); if (!f.access) as.push("Access not stated: assumed ground level"); if (!(f.area > 0)) as.push("Area not stated: priced for 1 m2");
    var st = T[stainId], su = S[surfId], rate = PS.stains[stainId] || { minPerM2: 40, chemPerM2: 600 }, refer = false, pause = false;
    function flag(level, text) { flags.push({ level: level, text: text }); if (level === "stop") pause = true; }
    if (stainId === "epoxy_pu") { flag("stop", "Epoxy, polyurethane or 2-part coating: specialist product and competent assessment needed. Do not promise removal."); refer = true; }
    if (su.stone && ["cement_haze", "oil_alkyd", "adhesive", "grout_paint", "cured_water"].indexOf(stainId) > -1) { flag("warn", "Natural stone is acid-sensitive and can stain from solvents. Use only a stone-compatible method after a test patch, or refer to a stone specialist."); if (stainId === "cement_haze" && surfId === "stone_acid") refer = true; }
    if (surfId === "glass_special" && ["cured_water", "oil_alkyd", "grout_paint"].indexOf(stainId) > -1) flag("stop", "Coated, tinted, tempered or decorative glass: no blades or abrasive pads. Only a remover the glass supplier approves, otherwise refer.");
    if (f.oldBuilding) flag("stop", "Possible lead or hazardous legacy paint: no dry sanding, grinding, heat or open flame. Isolate the area and arrange lead-safe testing and procedures before scraping.");
    if (access === "height") { flag("stop", "Work at height needs proper access equipment, training and fall protection. Do not improvise."); refer = refer || false; }
    if (f.ventilation === "poor" && ["oil_alkyd", "adhesive"].indexOf(stainId) > -1) flag("stop", "No safe ventilation for a volatile product. Do not use flammable solvent in a confined room.");
    if (!f.water) flag("warn", "No water on site: arrange clean water and a way to contain rinse water."); if (!f.power) flag("warn", "No safe power: corded machines are excluded; battery tools and manual methods only.");
    if (f.decorative || f.damage || surfId === "unknown") flag("warn", "Expensive, decorative, damaged or unknown surface: photograph existing damage, test first, and get written approval. Do not promise full removal.");
    if (f.wantsGuarantee && !f.testPatchDone) flag("warn", "Customer wants guaranteed removal but no test patch has been done. Do not guarantee; the test patch decides.");
    if (su.porous && ["fresh_water", "cured_water", "oil_alkyd", "grout_paint"].indexOf(stainId) > -1) flag("info", "Porous surface: pigment may have entered the pores, so full removal may not be possible without specialist restoration. Say so in the quote.");
    if (stainId === "unknown") flag("info", "Unknown stain: quote a diagnostic or test stage first (SOP F).");
    var decision = refer ? "refer" : (pause || !f.testPatchDone) ? "test_first" : "go";
    var decisionText = { refer: "Refer to a specialist, or quote a paid diagnostic visit only. Do not quote full removal.", test_first: pause ? "Pause. Clear the stop items above, then do a test patch before any removal." : "Do a test patch first. Price the full job only after the test result is approved by the customer.", go: "Test patch done and no stop items. Proceed with the approved method." }[decision];
    /* time and crew */
    var mult = (f.thickness === "thick" ? 1.4 : f.thickness === "thin" ? 0.8 : 1) * (su.porous ? 1.4 : 1) * (su.glass ? 0.9 : 1) * (access === "ladder" ? PS.ladderMult : access === "height" ? 1.4 : 1) * (f.occupied ? PS.occupiedMult : 1);
    var work = area * rate.minPerM2 / 60 * mult, setup = PS.setupHours, hpd = f.hoursPerDay || PS.hoursPerDay, av = f.crew || { lead: crewOf(PS, "lead").count, technician: crewOf(PS, "technician").count, support: crewOf(PS, "support").count };
    var leadWorks = av.technician === 0, handsAvail = av.technician || av.lead || 1; if (!av.technician && !av.lead) as.push("No crew given: assumed one technician");
    var need = Math.max(1, Math.ceil((work + setup) / (hpd * (f.deadlineDays || 1)))), hands = Math.max(1, Math.min(handsAvail, need)), days = Math.max(1, Math.ceil((work / hands + setup) / hpd)), shortfall = null;
    if (f.deadlineDays && need > handsAvail) shortfall = "To finish in " + f.deadlineDays + " day" + (f.deadlineDays > 1 ? "s" : "") + " you need " + need + " technicians but only " + handsAvail + " are free. At full crew it takes " + days + " day" + (days > 1 ? "s" : "") + ".";
    var leadN = av.lead > 0 && !leadWorks ? 1 : 0, supN = av.support > 0 && (work > hpd * 1.5 || f.occupied) ? 1 : 0, techRate = crewOf(PS, leadWorks ? "lead" : "technician").rate;
    var techH = work + setup * hands, leadH = leadN ? Math.min(days * hpd, 0.35 * work + 1.5) : 0, supH = supN ? days * hpd * 0.8 : 0;
    var labour = techH * techRate + leadH * crewOf(PS, "lead").rate + supH * crewOf(PS, "support").rate;
    /* machines */
    var ids = f.machines || PS.machines.filter(function (m) { return m.count > 0; }).map(function (m) { return m.id; }), machines = [], perPerson = work / hands, equipment = 0, usedAny = false;
    PS.machines.forEach(function (m) {
      if (ids.indexOf(m.id) < 0) return; var use = false, why = "", share = 0;
      if (m.power && !f.power) why = "Needs mains power and none is available on site.";
      else if (m.id === "pressure") why = "Not suitable for paint on glass or indoor tile. Outdoor hard standing only.";
      else if (m.id === "rideon") { if (area >= 300 && !su.stone) { use = true; share = 0.1; why = "Large open floor maintenance after the residue is removed. Not for paint or stain removal."; } else why = "Only suits large open floors (300 m2 or more) after residue is removed."; }
      else if (m.id === "floor") { if (area >= 20 && ["tile_glazed", "tile_porcelain"].indexOf(surfId) > -1 && ["grease", "cement_haze"].indexOf(stainId) > -1) { use = true; share = 0.25; why = "Large compatible tile area. Test pad and surface first. Not a paint remover."; } else why = "Not used: needs a large compatible tile area (20 m2 or more) and a non-paint stain. It can scratch or dull finishes."; }
      else if (m.id === "spin") { if (["grout_paint", "grease", "cement_haze"].indexOf(stainId) > -1 && !su.glass && !su.stone && surfId !== "mosaic" && area <= 40) { use = true; share = 0.3; why = "Grout lines and corners. Low speed, compatible brush, test first."; } else why = "Not used: suits grout lines and corners on compatible surfaces only."; }
      else if (m.id === "wetvac") { if (stainId !== "epoxy_pu") { use = true; share = 0.4; why = "Controlled recovery of rinse water and residue. Use only if rated for the liquid and chemical."; } }
      else if (m.id === "squeegee") { if (su.glass) { use = true; share = 0.25; why = "Finishing glass after cleaning."; } else why = "Glass finishing tool; not used on this surface."; }
      var hrs = use ? r05(perPerson * share) : 0, cph = machineCostPerHour(m, PS), cost = use ? r10(hrs * cph) : 0; if (use) usedAny = true; equipment += cost; machines.push({ id: m.id, label: m.label, use: use, reason: why, hours: hrs, costPerHour: cph, cost: cost });
    });
    if (!machines.length) as.push("No machines available: manual tools and safe chemical control. The manual advises against buying a machine until repeated paid work justifies it");
    /* cost */
    var chem = r10(area * rate.chemPerM2 * (1 + PS.wasteAllowPct / 100) * (su.porous ? 1.3 : 1) * (f.thickness === "thick" ? 1.2 : 1)), transport = PS.transportPerDay * days, protect = r10(PS.protectionBase + PS.protectionPerM2 * area * (f.occupied ? 1.5 : 1)), ah = f.afterHours ? r10(labour * PS.afterHoursPct / 100) : 0, wf = f.water ? 0 : PS.noWaterFee;
    labour = r10(labour); var sub = labour + chem + transport + protect + equipment + ah + wf, overhead = r10(sub * PS.overheadPct / 100), uncertain = stainId === "unknown" || surfId === "unknown" || f.decorative || f.oldBuilding || (su.porous && stainId !== "grease");
    var cont = uncertain ? r10((sub + overhead) * PS.contingencyPct / 100) : 0, direct = sub + overhead + cont, mp = f.marginPct === null ? PS.marginPct : f.marginPct, calc = up500(direct / (1 - mp / 100)), minApplied = calc < PS.minCallout, full = Math.max(calc, PS.minCallout);
    var lines = [["Labour", labour, Math.round((techH + leadH + supH) * 10) / 10 + " person-hours across " + days + " day" + (days > 1 ? "s" : "")], ["Chemicals and consumables", chem, "Includes " + PS.wasteAllowPct + "% waste allowance"], ["Transport and mobilisation", transport, days + " day" + (days > 1 ? "s" : "")], ["Equipment-use charge", equipment, usedAny ? "Machine hours at cost per hour" : "No machine used"], ["Protection and waste", protect, "Plastic, tape, bags, disposal"]];
    if (ah) lines.push(["After-hours premium", ah, PS.afterHoursPct + "% of labour"]); if (wf) lines.push(["Water supply", wf, "No water on site"]); lines.push(["Overhead allocation", overhead, PS.overheadPct + "% of the above"]); if (cont) lines.push(["Risk contingency", cont, PS.contingencyPct + "%, because of uncertainty. Explain to the customer"]);
    var diagnostic = Math.max(PS.testPatchFee, 0), quote = decision === "refer" ? diagnostic : full;
    var crew = { lead: leadN, technician: leadWorks ? 0 : hands, leadWorking: leadWorks ? hands : 0, support: supN, total: hands + leadN + supN, shortfall: shortfall };
    /* procedure */
    var sop = st.sop, steps = [], title = "";
    if (sop === "REFER") { title = "Specialist referral"; steps = ["Do not attempt removal with common solvents or strippers.", "Photograph the coating and area, and record what work was done.", "Get a specialist opinion, or quote a paid diagnostic visit only."]; }
    else if (sop === "A") { if (su.porous || surfId === "glass_special") { title = M.SOPS.D.title; steps = M.SOPS.D.steps; } else { title = M.SOPS.A.title; steps = M.SOPS.A.steps; } }
    else if (sop === "BC") { if (surfId === "glass") { title = M.SOPS.B.title; steps = M.SOPS.B.steps; } else if (surfId === "glass_special") { title = "Coated or decorative glass: no blades"; steps = ["Do not blade-scrape or use abrasive pads.", "Test only a remover the glass supplier approves for the glass assembly, on a small hidden patch, and let it dry.", "If it does not release safely, stop and refer."]; } else if (su.porous || surfId === "mosaic" || surfId.indexOf("grout") === 0 || surfId === "unknown") { title = M.SOPS.D.title; steps = M.SOPS.D.steps; } else { title = M.SOPS.C.title; steps = M.SOPS.C.steps; } if (stainId === "oil_alkyd") steps = steps.concat(["Oil-based paint: use a compatible solvent or remover only after a surface test. Control ignition and ventilation. Never flood joints with white spirit."]); }
    else { var s2 = M.SOPS[sop]; title = s2.title; steps = s2.steps; }
    var tools = ["Plastic scrapers and spare blades (blades only on approved glass)", "Microfibre cloths in separate colours (change cloths instead of smearing)", "Nylon detail brushes and non-scratch pads", "Labelled spray bottles, measuring jug and buckets", "Squeegee and washer sleeve (glass)", "Wet-floor signs, plastic sheeting and masking tape", "Chemicals: " + st.chem.join("; ")];
    var machineSteps = []; machines.filter(function (m) { return m.use; }).forEach(function (m) { machineSteps.push(m.label + " for about " + m.hours + " h: " + m.reason); }); if (machineSteps.length) machineSteps = M.COMMON.machinePre.concat(machineSteps);
    var stop = [su.watch].concat(M.TROUBLE.slice(0, 6).map(function (x) { return x[0] + ": " + x[1]; }), ["Fumes, dizziness, headache or breathing irritation: stop work, move to fresh air and follow the SDS first-aid steps.", "Workers may always stop if the method looks unsafe or is damaging the surface."]);
    var wording = M.COMMON.wording.replace("[date]", "the date of the test patch").replace("[surfaces]", su.label.toLowerCase()).replace("[process]", title.replace(/^SOP [A-F]: /, "").toLowerCase());
    as.push("Speeds (" + rate.minPerM2 + " technician-minutes per m2 for this stain) and chemical costs are starting allowances. Replace them with your measured figures after 5 to 10 similar jobs"); as.push("Rates, machine costs and overhead come from Admin > Settings > Job planner");
    return { facts: f, summary: { title: f.title || (st.label + " on " + su.label.toLowerCase()), stain: st.label, surface: su.label, sop: title, area: area, decision: decision, decisionText: decisionText },
      flags: flags, crew: crew, time: { workHours: Math.round(work * 10) / 10, days: days, hoursPerDay: hpd }, machines: machines, ppe: M.COMMON.ppe.slice(), tools: tools,
      procedure: { before: M.COMMON.preJob.concat(["Brief the crew on roles: lead technician (inspection, chemical choice, test patch, final check), technicians (application, scraping, residue collection), support (protection, clean cloths, waste, rinse water)."]), onSite: ["Protect floors, frames and nearby finishes. Show wet-floor signs. Keep people and pets away."].concat(M.COMMON.testPatch, steps), machine: machineSteps, qc: M.COMMON.qc, closeout: M.COMMON.closeout, stop: stop },
      cost: { lines: lines.map(function (l) { return { label: l[0], amount: l[1], note: l[2] }; }), direct: direct, marginPct: mp, calculated: calc, quote: quote, profit: quote - direct, perM2: Math.round(quote / area), minimumApplied: minApplied && decision !== "refer", indicativeFull: decision === "refer" ? full : null },
      options: { diagnostic: diagnostic, perM2: Math.round(full / area), dayRate: up500(direct / days / (1 - mp / 100)), minCallout: PS.minCallout }, wording: wording, assumptions: as };
  }
  return { normalizeFacts: normalizeFacts, missing: missing, nextQuestion: nextQuestion, applyAnswer: applyAnswer, plan: plan, machineCostPerHour: machineCostPerHour };
});
