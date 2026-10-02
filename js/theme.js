/* Runs before the page paints so there is no light/dark flash. Shared by site and admin. */
(function () {
  var root = document.documentElement;
  root.classList.add("js");
  /* Safety net: if the main script has not started within 4 seconds, show everything rather than leave content hidden. */
  setTimeout(function () { if (!window.FN) root.classList.add("reveal-all"); }, 4000);
  try {
    var t = localStorage.getItem("fn_theme");
    if (!t) t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    root.setAttribute("data-theme", t);
  } catch (e) { root.setAttribute("data-theme", "light"); }
})();
