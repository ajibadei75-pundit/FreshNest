/* Services page: highlights the service you are reading in the jump bar. */
(function () {
  "use strict";
  var FN = window.FN, links = FN.qsa(".jump a"), cards = FN.qsa(".sd");
  function mark(id) { links.forEach(function (a) { var on = a.getAttribute("data-k") === id; a.classList.toggle("active", on); if (on && !FN.reduced) { var bar = a.parentNode; if (bar.scrollTo) bar.scrollTo({ left: a.offsetLeft - 16, behavior: "smooth" }); } }); }
  if ("IntersectionObserver" in window) {
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
      var first = cards.filter(function (c) { return seen[c.id]; })[0];
      if (first) mark(first.id);
    }, { rootMargin: "-120px 0px -55% 0px" });
    cards.forEach(function (c) { io.observe(c); });
  }
  if (location.hash) mark(location.hash.slice(1));
})();
