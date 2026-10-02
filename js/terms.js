/* The booking terms and privacy notice: one source of truth. It is shown in the booking form (where the tick
   box unlocks after reading) and on the /terms page. Change termsVersion in pricing.js whenever this text changes. */
(function () {
  "use strict";
  var SECTIONS = [
    ["Estimate and final price", "The estimate on this site is a guide. We confirm the final price with you by WhatsApp, call or email before your visit. You pay nothing until you have agreed the price."],
    ["Sending a request", "Sending the booking form is a request, not a confirmed booking. Your booking is confirmed when we reply to confirm the date, time and price."],
    ["Where we work", "We currently clean in Ibadan, Oyo, Ogbomoso, Osogbo, Ilorin and Lagos. We can only accept a booking for an address in one of these cities."],
    ["Access and safety", "Someone must let our team in, or you must share access details. Please make sure water and electricity are available, or tell us if they are not. Our team may decline or stop any task that is unsafe."],
    ["Your belongings", "Please put away cash, jewellery, documents and fragile items before we arrive. Tell us about delicate surfaces or items to avoid."],
    ["Damage", "If something is damaged during the visit, tell us within 24 hours, with photos if you can, so we can look into it."],
    ["Our 24-hour promise", "If we miss an area on the agreed checklist, tell us within 24 hours and we will return to fix it at no extra cost."],
    ["Changes and cancellations", "Tell us at least 24 hours before your visit if you need to move or cancel. Later notice may mean we cannot keep your slot."],
    ["Payment", "We agree the amount and how you will pay when we confirm your booking."],
    ["What we do with your information", "We collect your name, phone number, email, address and booking details only to arrange and carry out your cleaning, to contact you about it, and to look into any concern afterwards. We do not sell your details or share them with anyone who is not part of delivering your service. We keep booking records for as long as we need them for those purposes. You can ask us to correct or delete your information at any time by emailing <span data-s=\"email\">freshnestcleaningservices@proton.me</span>."],
    ["Reviews", "If you send feedback and tick the box that allows it, we may show your review on our website with the name you give."]
  ];
  function html(tag, h) {
    return SECTIONS.map(function (s) { return "<" + tag + "><" + h + ">" + s[0] + "</" + h + "><p>" + s[1] + "</p></" + tag + ">"; }).join("");
  }
  var box = document.getElementById("terms"), doc = document.getElementById("termsDoc"), ver = document.getElementById("termsVersion");
  if (box) box.innerHTML = html("div", "h5");
  if (doc) doc.innerHTML = html("section", "h2");
  if (ver && window.FNPricing) ver.textContent = "Version " + window.FNPricing.RULES.termsVersion + ". Plain-language terms for every booking.";
  window.FNTerms = { sections: SECTIONS };
})();
