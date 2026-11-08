/* Work and tips, reviews, FAQ search, contact (message form and booking tracker). */
(function () {
  "use strict";
  var FN = window.FN, PR = window.FNPricing, $ = FN.$, qsa = FN.qsa, esc = FN.esc, calm = FN.reduced;
  function stars(n) { var h = '<div class="rstars" role="img" aria-label="' + n + ' out of 5 stars">'; for (var i = 1; i <= 5; i++) h += '<span class="' + (i <= n ? "on" : "") + '">\u2605</span>'; return h + "</div>"; }
  function md(t) { var out = [], l = null; function inl(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); } function close() { if (l) { out.push("<ul>" + l.join("") + "</ul>"); l = null; } } (t || "").split("\n").forEach(function (x) { if (/^##\s+/.test(x)) { close(); out.push("<h4>" + inl(x.replace(/^##\s+/, "")) + "</h4>"); } else if (/^-\s+/.test(x)) (l = l || []).push("<li>" + inl(x.replace(/^-\s+/, "")) + "</li>"); else if (!x.trim()) close(); else { close(); out.push("<p>" + inl(x) + "</p>"); } }); close(); return out.join(""); }
  var QS = new URLSearchParams(window.FN_QUERY !== undefined ? window.FN_QUERY : location.search);
  /* work and tips */
  if ($("posts")) {
    var posts = [], filter = "all", reader = $("reader"), cs = function (p) { return "--a:" + (p.cover && p.cover.a || "#018174") + ";--b:" + (p.cover && p.cover.b || "#2FD3B3"); };
    var draw = function () { var list = posts.filter(function (p) { return filter === "all" || p.type === filter; }); $("posts").innerHTML = list.map(function (p) { var img = FN.imgSrc(p.photo || p.after); return '<button type="button" class="post" data-slug="' + esc(p.slug) + '" aria-label="Open: ' + esc(p.title) + '"><div class="cover" style="' + cs(p) + '"><span class="em" aria-hidden="true">' + esc(p.cover && p.cover.emoji || "") + "</span>" + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : "") + '<span class="kind">' + (p.type === "work" ? "Recent work" : "Guide") + '</span></div><div class="info"><h3>' + esc(p.title) + "</h3><p>" + esc(p.excerpt) + '</p><div class="meta"><span>' + esc(PR.shortDate(p.date)) + "</span>" + (p.type === "tip" ? "<span>" + Math.max(1, Math.round((p.body || "").split(/\s+/).length / 200)) + " min read</span>" : "") + "</div></div></button>"; }).join("") || '<div class="empty">New posts are coming soon.</div>'; };
    var filters = function () { var hasWork = posts.some(function (p) { return p.type === "work"; }), d = [["all", "All"]].concat(hasWork ? [["work", "Recent work"]] : [], [["tip", "Guides and tips"]]); $("filters").innerHTML = d.map(function (x) { return '<button type="button" data-f="' + x[0] + '" aria-pressed="' + (x[0] === filter) + '">' + x[1] + "</button>"; }).join(""); $("filters").hidden = d.length < 3; };
    $("filters").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; filter = b.getAttribute("data-f"); filters(); draw(); });
    $("posts").addEventListener("click", function (e) {
      var c = e.target.closest(".post"); if (!c) return; var p = posts.filter(function (x) { return x.slug === c.getAttribute("data-slug"); })[0], bf = FN.imgSrc(p.before), af = FN.imgSrc(p.after), ph = FN.imgSrc(p.photo), head;
      if (bf && af) head = '<div class="compare" id="rcmp"><img class="scene" src="' + esc(af) + '" alt="After"><img class="scene dirty" src="' + esc(bf) + '" alt="Before"><div class="handle" aria-hidden="true"><div class="knob" aria-hidden="true">&lsaquo; &rsaquo;</div></div><span class="tag l" aria-hidden="true">Before</span><span class="tag r" aria-hidden="true">After</span><input id="rcmpIn" type="range" min="0" max="100" value="92" aria-label="Drag to compare before and after"></div>';
      else head = '<div class="hd" style="' + cs(p) + '">' + (ph ? '<img src="' + esc(ph) + '" alt="">' : '<span aria-hidden="true">' + esc(p.cover && p.cover.emoji || "") + "</span>") + "</div>";
      var facts = p.details && p.details.length ? '<div class="facts-grid">' + p.details.map(function (d) { return "<div><small>" + esc(d[0]) + "</small><b>" + esc(d[1]) + "</b></div>"; }).join("") + "</div>" : "";
      $("readerBody").innerHTML = '<div style="position:relative">' + head + '<button type="button" class="icon-btn close" id="rClose">Close</button></div><div class="bd"><div><span class="tagpill">' + (p.type === "work" ? "Recent work" : "Guide") + '</span><h2 id="readerTitle" style="margin-top:14px">' + esc(p.title) + '</h2><p class="fine" style="margin-top:8px">' + esc(PR.shortDate(p.date)) + "</p></div>" + facts + md(p.body) + '<div class="btn-row"><a class="btn btn-primary" href="book.html">Book now</a><button type="button" class="btn btn-ghost" id="rClose2">Close</button></div></div>';
      reader.showModal(); reader.scrollTop = 0; var rc = $("rcmp"); if (rc) FN.wireCompare(rc, $("rcmpIn"), 92, 50); $("rClose").addEventListener("click", function () { reader.close(); }); $("rClose2").addEventListener("click", function () { reader.close(); });
    });
    reader.addEventListener("click", function (e) { if (e.target === reader) reader.close(); });
    FN.ready.then(function () { (FN.online ? FN.api("posts").then(function (r) { return r.posts; }) : Promise.resolve(window.FNSeed ? window.FNSeed.POSTS : [])).catch(function () { return []; }).then(function (l) { posts = l; filters(); draw(); }); });
  }
  /* reviews */
  if ($("reviewList")) {
    FN.ready.then(function () { (FN.online ? FN.api("reviews").then(function (r) { return r.reviews; }) : Promise.resolve([])).catch(function () { return []; }).then(function (rs) { $("reviewList").innerHTML = rs.length ? rs.map(function (x) { return '<article class="rev"><div class="who"><div class="nm">' + esc(x.name) + (x.verified ? ' <span class="tagpill">Verified booking</span>' : "") + '</div><div class="mt">' + esc(x.meta || "") + "</div></div>" + stars(x.rating) + "<p>" + esc(x.text) + "</p></article>"; }).join("") : '<div class="empty">No reviews yet. Be the first to tell us how we did.</div>'; }); });
    var sh = ""; for (var s = 5; s >= 1; s--) sh += '<input type="radio" name="rating" id="r' + s + '" value="' + s + '"><label for="r' + s + '" title="' + s + ' star' + (s > 1 ? "s" : "") + '"><span class="sr-only">' + s + ' star' + (s > 1 ? "s" : "") + "</span>\u2605</label>"; $("stars").innerHTML = sh;
    $("fbTags").innerHTML = ["On time", "Thorough", "Friendly team", "Good value", "Easy booking"].map(function (t) { return '<label><input type="checkbox" value="' + esc(t) + '"><span>' + esc(t) + "</span></label>"; }).join("");
    $("fbForm").addEventListener("change", function (e) { if (e.target.name === "rating") $("rateErr").textContent = ""; });
    $("fbForm").addEventListener("submit", function (e) {
      e.preventDefault(); var btn = $("fbSend"), sel = document.querySelector('#fbForm input[name="rating"]:checked'), st = $("fbStatus");
      if (!sel) { $("rateErr").textContent = "Choose a star rating first."; $("r5").focus(); return; }
      var data = { rating: +sel.value, tags: qsa("#fbTags input:checked").map(function (i) { return i.value; }), text: $("fbText").value.trim(), name: $("fbName").value.trim(), ref: $("fbRef").value.trim(), contact: $("fbContact").value.trim() }; btn.disabled = true; st.classList.remove("is-error");
      (FN.online ? FN.api("feedback", { body: data }) : Promise.reject(new Error("Our system isn't reachable right now. Please send your feedback on WhatsApp."))).then(function () { st.hidden = false; st.textContent = "Thank you! Your feedback was received and will appear once we've checked it."; FN.burst(btn); $("fbForm").reset(); }).catch(function (er) { st.hidden = false; st.classList.add("is-error"); st.textContent = er.message; }).then(function () { btn.disabled = false; });
    });
  }
  /* FAQ search */
  if ($("faqSearch")) {
    var inp = $("faqSearch"), items = qsa(".faq details"), groups = qsa(".faq-group");
    inp.addEventListener("input", function () { var q = inp.value.trim().toLowerCase(), shown = 0; items.forEach(function (d) { var m = !q || d.textContent.toLowerCase().indexOf(q) > -1; d.hidden = !m; if (m) shown++; if (q && m) d.open = true; }); groups.forEach(function (g) { g.hidden = !qsa("details", g).some(function (d) { return !d.hidden; }); }); $("faqEmpty").hidden = shown > 0; $("faqCount").textContent = q ? shown + " answer" + (shown === 1 ? "" : "s") + " found" : ""; });
    if (location.hash) { var t = document.querySelector(location.hash); if (t && t.tagName === "DETAILS") t.open = true; }
  }
  /* contact */
  if ($("msgForm")) {
    function er(id, m) { var e = $(id + "Err"), i = $(id); if (e) e.textContent = m; if (i) i.setAttribute("aria-invalid", m ? "true" : "false"); }
    $("msgForm").addEventListener("submit", function (e) {
      e.preventDefault(); var btn = $("msgBtn"), st = $("msgStatus"), d = { name: $("mName").value.trim(), phone: $("mPhone").value.trim(), email: $("mEmail").value.trim(), message: $("mText").value.trim() }; st.hidden = true;
      er("mName", d.name.length < 2 ? "Enter your name." : ""); er("mPhone", d.phone.replace(/\D/g, "").length < 7 ? "Enter a phone number we can reach." : ""); er("mText", d.message.length < 5 ? "Write a short message." : "");
      var bad = ["mName", "mPhone", "mText"].filter(function (i) { return $(i).getAttribute("aria-invalid") === "true"; })[0]; if (bad) { $(bad).focus(); return; }
      btn.disabled = true; (FN.online ? FN.api("contact", { body: d }) : Promise.reject(new Error("Our system isn't reachable right now. Please message us on WhatsApp."))).then(function () { st.hidden = false; st.classList.remove("is-error"); st.textContent = "Thank you. We've got your message and will reply soon."; FN.burst(btn); $("msgForm").reset(); }).catch(function (x) { st.hidden = false; st.classList.add("is-error"); st.textContent = x.message; }).then(function () { btn.disabled = false; });
    });
    var STATUS = { new: "Received, waiting for our confirmation", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled" };
    try { var last = JSON.parse(localStorage.getItem("fn_last") || "null"); if (last) { $("tRef").value = QS.get("ref") || last.ref || ""; $("tContact").value = last.contact || ""; } } catch (e) {} if (QS.get("ref")) $("tRef").value = QS.get("ref");
    function track() {
      var ref = $("tRef").value.trim().toUpperCase(), contact = $("tContact").value.trim(), err = $("tErr"), res = $("tRes"), btn = $("tBtn"); err.textContent = "";
      if (!ref || !contact) { err.textContent = "Enter your reference and the phone number or email you booked with."; return; } btn.disabled = true;
      FN.api("bookings/" + encodeURIComponent(ref) + "?contact=" + encodeURIComponent(contact)).then(function (b) {
        try { localStorage.setItem("fn_last", JSON.stringify({ ref: ref, contact: contact })); } catch (e) {} res.hidden = false; var step = { new: 1, confirmed: 2, completed: 3, cancelled: 0 }[b.status];
        res.innerHTML = '<div class="trk-head"><h3>Hi ' + esc(b.name) + '</h3><span class="tagpill' + (b.status === "cancelled" ? "" : " sun") + '">' + esc(STATUS[b.status]) + "</span></div>" + (b.status === "cancelled" ? "" : '<ol class="tsteps"><li class="' + (step >= 1 ? "done" : "") + '">Received</li><li class="' + (step >= 2 ? "done" : "") + '">Confirmed</li><li class="' + (step >= 3 ? "done" : "") + '">Completed</li></ol>') +
          '<div class="facts-grid"><div><small>Reference</small><b>' + esc(b.ref) + "</b></div><div><small>Service</small><b>" + esc(b.service) + "</b></div><div><small>When</small><b>" + esc(b.schedule.date ? PR.longDate(b.schedule.date) + ", " + PR.slotText(b.schedule.slot, FN.site.slots) : "To be confirmed") + "</b></div><div><small>" + (b.finalPrice ? "Confirmed price" : "Estimated price") + "</small><b>" + (b.finalPrice ? PR.fmt(b.finalPrice) : PR.fmt(b.estimate.low) + " to " + PR.fmt(b.estimate.high)) + "</b></div></div>" +
          '<ul class="tl">' + b.timeline.map(function (t) { return "<li>" + esc(t.text) + "<small>" + esc(new Date(t.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) + "</small></li>"; }).join("") + "</ul>" +
          (b.status === "completed" || b.status === "cancelled" ? "" : '<div class="group"><div class="group-title">Need to change or cancel?</div><div class="field"><label for="reqMsg">Tell us what you need <span class="opt">(optional)</span></label><textarea id="reqMsg" placeholder="For example: can we move it to Saturday morning?"></textarea></div><div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" data-kind="change">Request a change</button><button type="button" class="btn btn-ghost btn-sm" data-kind="cancel">Request cancellation</button></div><div class="status" id="reqStatus" hidden></div></div>');
        res.dataset.ref = ref; res.dataset.contact = contact;
      }).catch(function (x) { res.hidden = true; err.textContent = x.message; }).then(function () { btn.disabled = false; });
    }
    $("trackForm").addEventListener("submit", function (e) { e.preventDefault(); track(); });
    $("tRes").addEventListener("click", function (e) { var b = e.target.closest("[data-kind]"); if (!b) return; var r = $("tRes"), st = $("reqStatus"); b.disabled = true; FN.api("bookings/" + encodeURIComponent(r.dataset.ref) + "/request", { body: { contact: r.dataset.contact, kind: b.getAttribute("data-kind"), message: ($("reqMsg") || {}).value } }).then(function () { track(); }).catch(function (x) { st.hidden = false; st.classList.add("is-error"); st.textContent = x.message; b.disabled = false; }); });
    FN.ready.then(function () { if (QS.get("ref") && $("tContact").value) track(); });
  }
})();
