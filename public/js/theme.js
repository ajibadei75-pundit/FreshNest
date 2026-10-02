/* Runs before the page paints so there is no light/dark flash. Shared by site and admin. */
(function () {
  try {
    var t = localStorage.getItem("fn_theme");
    if (!t) t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) { document.documentElement.setAttribute("data-theme", "light"); }
})();
