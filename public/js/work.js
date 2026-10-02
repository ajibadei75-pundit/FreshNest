/* Our work page: real projects added in the admin page, plus cleaning tips, with a reader dialog. */
(function () {
  "use strict";
  var FN = window.FN, $ = FN.$, qsa = FN.qsa, esc = FN.esc, reduced = FN.reduced;
  var TIPS = [
    { slug: "how-often-should-you-deep-clean", type: "tip", icon: "calendar", a: "#05342F", b: "#02766A", date: "2026-09-10",
      title: "How often should you deep clean your home?", excerpt: "A simple schedule so the big jobs never pile up.",
      body: "Most homes benefit from a deep clean **every 3 to 6 months**, with regular cleaning in between.\n\n## Deep clean sooner if\n- You have just moved in or out\n- Someone at home has allergies or asthma\n- You have pets or young children\n- The dusty harmattan season has just passed\n\n## Between deep cleans\n- Wipe kitchen surfaces and bathrooms weekly\n- Mop floors at least once a week\n- Wash bedding every one to two weeks\n\nA regular plan keeps the deep clean lighter, so it takes less time and costs less." },
    { slug: "streak-free-windows", type: "tip", icon: "window", a: "#02766A", b: "#4DB5B0", date: "2026-08-28",
      title: "Streak-free windows in five steps", excerpt: "The order and tools that make glass sparkle.",
      body: "Streaks usually come from dirty cloths and cleaning in direct sun.\n\n## Steps\n- Clean on a cloudy day or when the glass is in shade\n- Dust the frame and sill first so dirt does not run onto the glass\n- Wash with warm water and a drop of dish soap\n- Squeegee from top to bottom, wiping the blade after every pass\n- Buff edges with a dry microfibre cloth\n\nUse a clean cloth for each window and avoid paper towels, which leave lint." },
    { slug: "prepare-before-cleaners-arrive", type: "tip", icon: "check", a: "#04554C", b: "#2FB59A", date: "2026-08-05",
      title: "What to prepare before your cleaners arrive", excerpt: "Five quick things that help the visit go smoothly.",
      body: "A little preparation means more time on actual cleaning.\n\n## Before we arrive\n- Put away valuables, cash and documents\n- Clear worktops and floors of loose items\n- Tell us about pets and secure them if needed\n- Make sure water and electricity are available, or let us know if they are not\n- Share gate or estate entry instructions\n\nTell us about delicate surfaces or items to avoid, and we will note it for the team." }
  ];
  var curFilter = "all", postsEl = $("posts"), reader = $("reader"), readerBody = $("readerBody");

  function allPosts() {
    var work = FN.projects.map(function (p) {
      var d = [];
      if (p.service) d.push(["Service", p.service]); if (p.property) d.push(["Property", p.property]);
      if (p.team) d.push(["Team", p.team]); if (p.time) d.push(["Time taken", p.time]);
      return { slug: "p-" + p.id, type: "work", icon: "sparkle", a: "#02766A", b: "#2ED1A6", title: p.title, date: p.date, excerpt: p.excerpt, details: d, body: p.body, photo: p.photo, before: p.before, after: p.after };
    });
    return work.concat(TIPS).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }
  function readMins(t) { return Math.max(1, Math.round((t || "").split(/\s+/).length / 200)); }
  function coverStyle(p) { return "--a:" + p.a + ";--b:" + p.b; }
  function icon(name) { return '<svg class="i" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }

  function render() {
    var hasWork = FN.projects.length > 0;
    $("filters").hidden = !hasWork;
    $("workTitle").textContent = hasWork ? "Our work and cleaning tips" : "Cleaning tips";
    $("workSub").textContent = hasWork ? "See what we have done and pick up practical advice for keeping your space fresh." : "Practical advice for keeping your space fresh between visits.";
    if (!hasWork) curFilter = "all";
    var list = allPosts().filter(function (p) { return curFilter === "all" || p.type === curFilter; });
    postsEl.innerHTML = list.map(function (p) {
      var img = p.photo || p.after;
      return '<button type="button" class="post" data-reveal data-slug="' + esc(p.slug) + '"><div class="cover" style="' + coverStyle(p) + '">' + icon(p.icon) + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : "") + '<span class="kind">' + (p.type === "work" ? "Our work" : "Cleaning tip") + '</span></div><div class="info"><h3>' + esc(p.title) + "</h3><p>" + esc(p.excerpt) + '</p><div class="meta"><span>' + FN.fmtDate(p.date) + "</span>" + (p.type === "tip" ? "<span>" + readMins(p.body) + " min read</span>" : "") + "</div></div></button>";
    }).join("");
    FN.reveal(postsEl);
  }
  qsa("#filters button").forEach(function (b) {
    b.addEventListener("click", function () {
      curFilter = b.getAttribute("data-f");
      qsa("#filters button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      render();
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
  function openPost(slug) {
    var p = allPosts().filter(function (x) { return x.slug === slug; })[0]; if (!p) return;
    var head;
    if (p.before && p.after) {
      head = '<div class="compare" id="rcmp"><img class="scene" src="' + esc(p.after) + '" alt="After cleaning"><img class="scene dirty" src="' + esc(p.before) + '" alt="Before cleaning"><div class="handle" aria-hidden="true"><div class="knob"><svg class="i" style="stroke-width:2.6" aria-hidden="true"><use href="#i-arrows"/></svg></div></div><span class="tag l" aria-hidden="true">Before</span><span class="tag r" aria-hidden="true">After</span><input id="rcmpIn" type="range" min="0" max="100" value="92" aria-label="Drag to compare before and after"></div>';
    } else {
      head = '<div class="hd" style="' + coverStyle(p) + '">' + icon(p.icon) + ((p.photo || p.after) ? '<img src="' + esc(p.photo || p.after) + '" alt="">' : "") + "</div>";
    }
    var facts = p.details && p.details.length ? '<div class="reader-facts">' + p.details.map(function (d) { return "<div><small>" + esc(d[0]) + "</small><b>" + esc(d[1]) + "</b></div>"; }).join("") + "</div>" : "";
    readerBody.innerHTML = '<div style="position:relative">' + head + '<button type="button" class="icon-btn close" id="readerClose" aria-label="Close"><svg class="i" style="stroke-width:2.4" aria-hidden="true"><use href="#i-close"/></svg></button></div><div class="bd"><div><h2 id="readerTitle">' + esc(p.title) + '</h2><p class="fine muted" style="margin-top:8px">' + FN.fmtDate(p.date) + "</p></div>" + facts + md(p.body) + '<div class="reader-actions"><a class="btn btn-primary" href="/book">Get a price</a><button type="button" class="btn btn-ghost" id="readerClose2">Close</button></div></div>';
    if (typeof reader.showModal === "function") reader.showModal(); else reader.setAttribute("open", "");
    $("readerClose").addEventListener("click", closeReader); $("readerClose2").addEventListener("click", closeReader);
    var rc = $("rcmp"); if (rc && FN.wireCompare) FN.wireCompare(rc, $("rcmpIn"), 92, 50);
    reader.scrollTop = 0;
  }
  postsEl.addEventListener("click", function (e) { var c = e.target.closest(".post"); if (c) openPost(c.getAttribute("data-slug")); });
  reader.addEventListener("click", function (e) { if (e.target === reader) closeReader(); });

  FN.ready(render);
})();
