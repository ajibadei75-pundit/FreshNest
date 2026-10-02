/* Reviews page: approved reviews from the server, and the feedback form. */
(function () {
  "use strict";
  var FN = window.FN, $ = FN.$, qsa = FN.qsa, esc = FN.esc;
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>';
  var listEl = $("reviewList");
  function starsHtml(n) { var h = '<div class="rstars" role="img" aria-label="' + n + ' out of 5 stars">'; for (var i = 1; i <= 5; i++) h += STAR.replace("<svg", '<svg class="' + (i <= n ? "on" : "") + '"'); return h + "</div>"; }

  function renderReviews() {
    var rs = FN.reviews;
    if (!rs.length) {
      listEl.innerHTML = '<div class="empty" data-reveal><h3>No reviews yet</h3><p>When customers share their feedback and allow us to show it, their reviews appear here. Had a clean with us? Tell us how it went using the form.</p></div>';
      FN.reveal(listEl); return;
    }
    var avg = Math.round(rs.reduce(function (a, r) { return a + r.rating; }, 0) / rs.length * 10) / 10;
    listEl.innerHTML = '<div class="rev-summary" data-reveal><b>' + avg.toFixed(1) + "</b><div>" + starsHtml(Math.round(avg)) + '<span class="fine muted">' + rs.length + (rs.length === 1 ? " review" : " reviews") + "</span></div></div>" +
      rs.map(function (r) {
        return '<article class="rev" data-reveal><div class="who"><div class="av" aria-hidden="true">' + esc((r.name || "?").charAt(0).toUpperCase()) + '</div><div><div class="nm">' + esc(r.name) + '</div><div class="mt">' + esc(r.meta) + (r.meta ? ", " : "") + FN.fmtDate(r.date) + "</div></div></div>" + starsHtml(r.rating) + "<p>" + esc(r.text) + "</p></article>";
      }).join("");
    listEl.setAttribute("data-stagger", ""); FN.reveal(listEl);
  }

  var sh = "";
  for (var s = 5; s >= 1; s--) sh += '<input type="radio" name="rating" id="r' + s + '" value="' + s + '"><label for="r' + s + '" title="' + s + " star" + (s > 1 ? "s" : "") + '"><span class="sr-only">' + s + " star" + (s > 1 ? "s" : "") + "</span>" + STAR + "</label>";
  $("stars").innerHTML = sh;
  $("fbTags").innerHTML = ["On time", "Thorough", "Friendly team", "Good value", "Easy booking"].map(function (t) { return '<label><input type="checkbox" value="' + esc(t) + '"><span>' + esc(t) + "</span></label>"; }).join("");
  var svc = window.FNPricing.PRICING.service;
  $("fbService").insertAdjacentHTML("beforeend", Object.keys(svc).map(function (k) { return "<option>" + esc(svc[k].label) + "</option>"; }).join(""));
  $("fbForm").addEventListener("change", function (e) { if (e.target.name === "rating") $("rateErr").textContent = ""; });
  $("fbForm").addEventListener("submit", function (e) { e.preventDefault(); });

  function feedback(channel, btn) {
    var sel = document.querySelector('#fbForm input[name="rating"]:checked'), st = $("fbStatus");
    if (!sel) { $("rateErr").textContent = "Choose a star rating first."; $("r5").focus(); return; }
    var data = {
      rating: +sel.value, tags: qsa("#fbTags input:checked").map(function (i) { return i.value; }), text: $("fbText").value.trim(),
      name: $("fbName").value.trim(), service: $("fbService").value, allowPublic: $("fbPublic").checked, website: $("fbWebsite").value
    };
    var lines = ["Feedback for " + FN.settings.name, "Rating: " + data.rating + " out of 5"];
    if (data.service) lines.push("Service: " + data.service);
    if (data.tags.length) lines.push("What went well: " + data.tags.join(", "));
    if (data.text) lines.push("Comments: " + data.text);
    if (data.name) lines.push("Name: " + data.name);
    var message = lines.join("\n");
    function note(text, kind) { st.hidden = false; st.className = "status" + (kind ? " is-" + kind : ""); st.textContent = text; }
    if (channel === "whatsapp") { FN.openLink(FN.whatsappUrl(message)); note("Thank you. Press send in the WhatsApp window that opened."); return; }
    btn.disabled = true;
    FN.post("/api/feedback", data).then(function (r) {
      btn.disabled = false;
      if (r.ok) { note("Thank you. Your feedback has been sent." + (data.allowPublic ? " If it passes our check, it will appear on this page." : ""), "ok"); $("fbForm").reset(); return; }
      if (r.status === 422 || r.status === 429) { note(r.data.error || "We couldn't send that. Please try again.", "error"); return; }
      FN.openLink(FN.mailtoUrl("Feedback from " + (data.name || "a customer"), message));
      note("We couldn't reach our server, so we opened your email app. Press send to finish.");
    });
  }
  $("fbEmail").addEventListener("click", function () { feedback("email", this); });
  $("fbWa").addEventListener("click", function () { feedback("whatsapp", this); });

  FN.ready(renderReviews);
})();
