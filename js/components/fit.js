// ════════════════════════════════════════
// FIT (v2.0.0 desktop layout, ≥ 1024px; handoff .proj-docs/plans/2026-10-12_handoff_desktop-layout.md §5) — shared
// "does it fit" tools for one-screen-high screens; the css half is css/components/fit.css.
// - isDesktop(): the desktop layout is on (DESKTOP_QUERY, the same breakpoint as the css)
// - fitSteps(el, steps): adds step classes one at a time until el's content fits (scrollHeight <= clientHeight + 1)
// - watchFade(panel) / refreshFades(): can-up / can-down on a .fit-panel's .fit-fade wrapper
// - fitPhoneScreen(screen, panel) (v2.4.0, C-007): a phone screen one screen high only while its panel keeps room
// - onRefit(fn, screenId?) / runRefits(): one registry of fits, re-run at the end of a render (the screen calls
//   runRefits()), on resize (once per frame), and after a language, text size or translation change (i18n.js
//   rerenderCurrentScreen). Every run ends with refreshFades(), so a panel's fades follow its new content
// ════════════════════════════════════════
const DESKTOP_QUERY = '(min-width: 1024px)'; // = @media (min-width: 1024px) in css/base/tokens.css, css/components/fit.css
const FIT_SLACK_PX = 1; // "does not fit" = scrollHeight > clientHeight + 1 (sub-pixel rounding is not overflow)
const FADE_WRAP_SELECTOR = '.fit-fade';
const FADE_PANEL_SELECTOR = '.fit-panel';
const FADE_UP_CLASS = 'can-up';
const FADE_DOWN_CLASS = 'can-down';
const FADE_WATCHED_KEY = 'fitFadeWatched'; // data-fit-fade-watched="1": the panel has its scroll listener

const desktopMedia = window.matchMedia(DESKTOP_QUERY);
function isDesktop() { return desktopMedia.matches; }
function overflowsY(el) { return el.scrollHeight > el.clientHeight + FIT_SLACK_PX; }

// steps: class names added to el, or [element, className] pairs for a class that belongs on another element (a quiz
// step may tighten the options list while the column is what is measured). Every step is removed first, so a run never
// depends on the last one: a screen that got roomier gets its steps back. Returns how many steps are on.
// Below 1024px the steps are removed and none added (desktop-only layouts), unless { anyWidth: true }.
// { measure }: "does not fit yet" when el's own overflow is not the whole story (S-229: Result also measures its
// score card, which clips). A hidden el cannot be measured: steps stay off until its screen renders.
function fitSteps(el, steps, { anyWidth = false, measure = () => overflowsY(el) } = {}) {
  const pairs = steps.map(step => (Array.isArray(step) ? step : [el, step])).filter(([target]) => target);
  pairs.forEach(([target, cls]) => target.classList.remove(cls));
  if (!el || !el.getClientRects().length || (!anyWidth && !isDesktop())) return 0;
  let used = 0;
  while (used < pairs.length && measure()) {
    const [target, cls] = pairs[used];
    target.classList.add(cls);
    used++;
  }
  return used;
}

// mockup afterRender(): can-up while content is scrolled away above, can-down while more is below
function updateFade(panel) {
  const wrap = panel.closest(FADE_WRAP_SELECTOR);
  if (!wrap) return;
  wrap.classList.toggle(FADE_UP_CLASS, panel.scrollTop > FIT_SLACK_PX);
  wrap.classList.toggle(FADE_DOWN_CLASS, panel.scrollTop + panel.clientHeight < panel.scrollHeight - FIT_SLACK_PX);
}
// one scroll listener per panel however often it is called (a re-render that keeps the element keeps the listener)
function watchFade(panel) {
  if (!panel.dataset[FADE_WATCHED_KEY]) {
    panel.dataset[FADE_WATCHED_KEY] = '1';
    panel.addEventListener('scroll', () => updateFade(panel), { passive: true });
  }
  updateFade(panel);
}
function refreshFades(root = document) { root.querySelectorAll(FADE_PANEL_SELECTOR).forEach(watchFade); }

// ── v2.4.0 phone one-screen screens (.is-fit-phone, css/components/fit.css; C-007) ──
// A screen opts in with fitPhoneScreen(screen, panel) at the end of every render and refit: it tries one screen high,
// and when the parts fixed above / below leave the panel less than --fit-phone-min-panel (about two option rows, from
// the text size) it falls back to the scrolling page (no .is-fit-phone), so nothing is ever squeezed out of reach.
// Re-checked on every call (render, resize, language / text size / translation re-render). On desktop or while the
// screen is hidden the class stays on and nothing is measured. Returns whether the screen is one screen high
const PHONE_FIT_CLASS = 'is-fit-phone';
const PHONE_FIT_MIN_PANEL = 'var(--fit-phone-min-panel)';
// a css length in px, resolved where `host` is (custom properties, the root text size)
function cssLengthPx(host, value) {
  const probe = document.createElement('div');
  probe.style.cssText = `position: absolute; visibility: hidden; width: 0; height: ${value}`;
  host.append(probe);
  const px = probe.getBoundingClientRect().height;
  probe.remove();
  return px;
}
function phoneFitMinPanelPx(host = document.body) { return cssLengthPx(host, PHONE_FIT_MIN_PANEL); }
function fitPhoneScreen(screen, panel) {
  if (!screen) return false;
  screen.classList.add(PHONE_FIT_CLASS);
  if (!panel || isDesktop() || !screen.getClientRects().length) return true;
  const fits = panel.clientHeight >= phoneFitMinPanelPx(screen);
  screen.classList.toggle(PHONE_FIT_CLASS, fits);
  return fits;
}

// fn(isDesktop()) runs on every refit; with a screenId only while that screen is the active one. Below 1024px it is
// still called (with false), so a fit can take its desktop steps off when the window narrows
// S-233: a fit that renders (Home's plan card) calls runRefits() again from its render tail; that inner call is
// skipped (the outer run is still going through every fit), so runs never nest
const refits = [];
let refitting = false;
function onRefit(fn, screenId) { refits.push({ fn, screenId }); }
function runRefits() {
  if (refitting) return;
  refitting = true;
  try {
    const active = document.querySelector('.screen.active');
    const desktop = isDesktop();
    refits.filter(r => !r.screenId || (active && active.id === r.screenId)).forEach(r => r.fn(desktop));
    refreshFades();
  } finally {
    refitting = false;
  }
}
// resize fires many times while a window is dragged: one run per frame
let refitFrame = 0;
function scheduleRefits() {
  if (refitFrame) return;
  refitFrame = requestAnimationFrame(() => { refitFrame = 0; runRefits(); });
}
window.addEventListener('resize', scheduleRefits);
