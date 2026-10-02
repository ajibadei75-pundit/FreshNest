/* FAQ page: live search that filters questions and highlights matches. */
(function () {
  "use strict";
  var FN = window.FN, $ = FN.$, items = FN.qsa("#faqList details"), groups = FN.qsa("#faqList .faq-group");
  var input = $("faqSearch");
  function clearMarks(el) { FN.qsa("mark", el).forEach(function (m) { m.replaceWith(document.createTextNode(m.textContent)); }); el.normalize(); }
  function mark(el, q) {
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), hits = [], n;
    while ((n = w.nextNode())) if (n.parentNode.tagName !== "SCRIPT" && n.nodeValue.toLowerCase().indexOf(q) > -1) hits.push(n);
    hits.forEach(function (node) {
      var i = node.nodeValue.toLowerCase().indexOf(q), after = node.splitText(i), rest = after.splitText(q.length), m = document.createElement("mark");
      m.textContent = after.nodeValue; after.replaceWith(m);
    });
  }
  function run() {
    var q = input.value.trim().toLowerCase(), shown = 0;
    items.forEach(function (d) {
      clearMarks(d);
      var hit = !q || d.textContent.toLowerCase().indexOf(q) > -1;
      d.hidden = !hit;
      if (hit && q) { d.open = true; mark(d, q); shown++; } else if (!q) { d.open = false; shown++; }
    });
    groups.forEach(function (g) { g.hidden = !FN.qsa("details", g).some(function (d) { return !d.hidden; }); });
    $("faqEmpty").hidden = shown > 0;
    $("faqCount").textContent = q ? (shown ? shown + (shown === 1 ? " answer" : " answers") + " found" : "") : "";
  }
  var t; input.addEventListener("input", function () { clearTimeout(t); t = setTimeout(run, 120); });
  input.addEventListener("keydown", function (e) { if (e.key === "Escape") { input.value = ""; run(); } });
  if (location.hash) { var g = document.querySelector(location.hash); if (g) { var d = g.querySelector("details"); if (d) d.open = true; } }
})();
