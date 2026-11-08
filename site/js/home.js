/* Home page: animated hero logo and customer reviews. */
(function () {
  "use strict";
  var FN = window.FN, $ = FN.$, esc = FN.esc, logo = $("heroLogo");
  if (logo) FN.afterWelcome(function () { setTimeout(function () { logo.classList.add("play"); }, 120); });
  function stars(n) { var h = '<div class="rstars" role="img" aria-label="' + n + ' out of 5 stars">'; for (var i = 1; i <= 5; i++) h += '<span class="' + (i <= n ? "on" : "") + '">\u2605</span>'; return h + "</div>"; }
  FN.ready.then(function () {
    if (!FN.online || !$("homeReviewList")) return;
    FN.api("reviews").then(function (r) {
      var list = (r.reviews || []).slice(0, 3); if (!list.length) return;
      $("homeReviewList").innerHTML = list.map(function (x) { return '<article class="rev"><div class="who"><div class="nm">' + esc(x.name) + (x.verified ? ' <span class="tagpill">Verified booking</span>' : "") + '</div><div class="mt">' + esc(x.meta || "") + "</div></div>" + stars(x.rating) + "<p>" + esc(x.text) + "</p></article>"; }).join("");
      var sec = $("homeReviewList").closest("section"); if (sec) sec.hidden = false; if ($("homeReviews")) $("homeReviews").hidden = false;
    }).catch(function () {});
  });
})();
