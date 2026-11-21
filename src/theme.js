// The theme's tokens for what cannot use var(): the canvas and its font.
// A token is read from the page's stylesheet once, then kept; the theme does
// not change while a page is open. See theme-pixel.css.
(() => {
  const kept = new Map();
  function token(name) {
    if (!kept.has(name)) {
      kept.set(name, getComputedStyle(document.documentElement).getPropertyValue("--" + name).trim());
    }
    return kept.get(name);
  }
  globalThis.BUZZ_THEME = { token };
})();
