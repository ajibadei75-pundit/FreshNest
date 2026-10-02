/* Home page: the before/after window slider and a short reviews strip (only when real reviews exist). */
(function () {
  "use strict";
  var FN = window.FN, $ = FN.$, esc = FN.esc;

  if ($("compare")) FN.wireCompare($("compare"), $("cmp"), 92, 50);

  /* Click the welcome logo to watch it again */
  var logo = $("heroLogo");
  if (logo && !FN.reduced) logo.addEventListener("click", function () { var html = logo.innerHTML; logo.innerHTML = ""; void logo.offsetWidth; logo.innerHTML = html; });

  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-star"/></svg>';
  function stars(n) { var h = '<div class="rstars" role="img" aria-label="' + n + ' out of 5 stars">'; for (var i = 1; i <= 5; i++) h += STAR.replace("<svg", '<svg class="' + (i <= n ? "on" : "") + '"'); return h + "</div>"; }
  FN.ready(function () {
    var list = FN.reviews.slice(0, 3), sec = $("homeReviews");
    if (!sec || !list.length) return;
    $("homeReviewList").innerHTML = list.map(function (r) {
      return '<article class="rev" data-reveal><div class="who"><div class="av" aria-hidden="true">' + esc((r.name || "?").charAt(0).toUpperCase()) + '</div><div><div class="nm">' + esc(r.name) + '</div><div class="mt">' + esc(r.meta) + "</div></div></div>" + stars(r.rating) + "<p>" + esc(r.text) + "</p></article>";
    }).join("");
    sec.hidden = false; FN.reveal(sec);
  });
})();
