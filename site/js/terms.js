/* Booking terms, scope of work and privacy notice. One source for the booking page and the terms page. */
(function () {
  "use strict";
  var SCOPE = "Your booking summary and the checklist we send you together are our agreement. Everything written in them will be attended to. Anything that is not written in them will not be done. If you want something added, ask us before the visit and we will confirm any change to the price. On the day, our team can only add an extra if the team leader agrees it with you first and it is added to the checklist.";
  var SECTIONS = [
    { h: "1. Our agreement and scope of work", scope: true, p: [SCOPE, "This keeps things clear for everyone: you know exactly what you are paying for, and our team knows exactly what to do."] },
    { h: "2. Estimates and prices", p: ["The price on the website is an estimate based on the service, rooms, extras, date and site conditions you enter. It is a guide, not a final quote. We confirm the final price with you by WhatsApp, phone or email before the visit, and the visit only goes ahead once you agree to it. If the real situation differs from what you told us (more rooms, much heavier dirt or infestation, or no water on site), we will tell you before work starts."] },
    { h: "3. Your booking", p: ["Submitting the form sends us a booking request and you receive a confirmation email with a reference. A booking is confirmed only when we confirm the final price and time with you. We may suggest a different time if your chosen slot is not available."] },
    { h: "4. Access, safety and your property", p: ["Please make sure we can get in at the agreed time and that water and electricity are available, or tell us if they are not. Put away valuables, cash and fragile items before we arrive. Our team may pause or decline work that looks unsafe. Tell us in advance about delicate surfaces, pets and anything we should avoid."] },
    { h: "5. Fumigation and pest control", p: ["Fumigation uses approved insecticides. Before treatment, please remove or tightly cover food, cooking items and drinking water, and move pets, fish tanks and plants out of the treated area. Everyone, including pets, must stay out for the time our team advises, and rooms must be aired before you return. Tell us about children, pregnant women, people with breathing problems and pets when you book. Some pests, such as bed bugs, termites and rodents, may need a follow-up visit. A follow-up is included only if it is written in our agreement. Pests can return from neighbouring properties, so we cannot promise a property stays pest-free for ever."] },
    { h: "6. Changes and cancellation", p: ["If you need to change or cancel, tell us as early as you can, ideally at least 24 hours before the visit, by WhatsApp, phone, email or the booking tracker on our contact page. Short-notice changes may be harder for us to accommodate."] },
    { h: "7. Our 24-hour re-clean promise", p: ["If something on your checklist was missed, tell us within 24 hours of the visit and we will return to fix it at no extra cost. The promise covers items written in our agreement, in line with section 1."] },
    { h: "8. Payment", p: ["We agree the amount and the payment method with you when we confirm your booking. Nothing is charged through the website. We give you a receipt for every payment you make."] },
    { h: "9. Privacy: what we collect and why", p: ["We collect the details you enter: your name, phone number, email, address, property details, notes and preferred way to be contacted. We use them only to confirm your booking, contact you about it, carry out the service and improve how we work. Your booking is stored securely with our hosting and database provider, and emails are sent through our email provider. We do not sell your information. The website also counts anonymous visits and button taps, with no personal details."] },
    { h: "10. Your choices", p: ["You can ask us to correct or delete your booking details at any time by contacting us. Reviews you submit may be published with the name you enter, after we approve them."] },
    { h: "11. Contact", p: ["FreshNest Cleaning Services, freshnestcleaningservices@proton.me, +234 708 759 6696. We are open every day."] }
  ];
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function html(mode) { var page = mode === "page"; return SECTIONS.map(function (s) { var ps = s.p.map(function (x) { return "<p>" + esc(x) + "</p>"; }).join(""); return (page ? "<h2>" : "<h5>") + esc(s.h) + (page ? "</h2>" : "</h5>") + (s.scope && page ? '<div class="scope-box">' + ps + "</div>" : ps); }).join(""); }
  /* A scrolling box that has to be read to the end before the callback fires. A hidden box never counts as read. */
  function mount(o) {
    var box = o.box, state = { read: false, at: "" }; box.innerHTML = html("box");
    function check() {
      if (!box.clientHeight) return;
      var max = box.scrollHeight - box.clientHeight, pct = max <= 4 ? 1 : Math.min(1, box.scrollTop / max);
      if (o.fill) o.fill.style.width = Math.round(pct * 100) + "%";
      if (pct >= 0.98 && !state.read) { state.read = true; state.at = new Date().toISOString(); if (o.text) { o.text.textContent = "Thank you for reading. You can tick the box now."; o.text.parentNode.classList.add("done"); } if (o.onRead) o.onRead(state); }
      else if (!state.read && o.text) o.text.textContent = pct > 0 ? "Keep scrolling to read all of the terms (" + Math.round(pct * 100) + "%)" : "Scroll to read the terms";
    }
    box.addEventListener("scroll", check, { passive: true }); window.addEventListener("resize", check); setTimeout(check, 200); state.check = check; return state;
  }
  window.FNTerms = { SECTIONS: SECTIONS, SCOPE: SCOPE, html: html, mount: mount };
})();
