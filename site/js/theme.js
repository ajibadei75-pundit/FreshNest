/* Runs first in <head>: day/night theme, animation switch and the welcome screen flag. */
(function () {
  var r = document.documentElement;
  try { var t = localStorage.getItem("fn_theme"); if (!t) t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; r.setAttribute("data-theme", t); } catch (e) { r.setAttribute("data-theme", "light"); }
  var calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!calm && "IntersectionObserver" in window) r.classList.add("anim");
  var p = window.FN_PAGE || location.pathname, home = /(^|\/)(index\.html)?$/.test(p) && !/\/admin\/?$/.test(p);
  try { if (home && !location.hash && !/nosplash/.test(location.search) && !sessionStorage.getItem("fn_welcome")) { r.classList.add("splash-on"); if (calm) r.classList.add("splash-calm"); } } catch (e) {}
})();
