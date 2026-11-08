/* Services page: highlight the section in view in the quick-jump bar. */
(function () {
  "use strict";
  var links = [].slice.call(document.querySelectorAll(".jump a")), secs = [].slice.call(document.querySelectorAll(".sd")); if (!links.length || !secs.length || !("IntersectionObserver" in window)) return;
  var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) links.forEach(function (a) { var on = a.getAttribute("href") === "#" + e.target.id; a.classList.toggle("on", on); if (on) a.parentNode.scrollTo({ left: a.offsetLeft - 24, behavior: "smooth" }); }); }); }, { rootMargin: "-35% 0px -55% 0px" });
  secs.forEach(function (s) { io.observe(s); });
})();
