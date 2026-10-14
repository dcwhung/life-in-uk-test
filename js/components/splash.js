// ════════════════════════════════════════
// SPLASH — v2.5.0 loading screen on every launch (index.html #splash, css/components/splash.css; mockup
// mockups/v2.2.0/intro-b-cards.html). The markup is static so it shows before any script runs; startSplash() draws one
// logo animation (card fan : progress ring = SPLASH_WEIGHTS), finishSplash() waits for boot AND the animation, then fades.
// The test suites skip it (file://, as registerSW does, and any automated browser: navigator.webdriver; tests/intro-test.js
// switches that off to test it); reduced motion shows no animation and opens at boot.
// ════════════════════════════════════════
const SPLASH_ICONS = ['🗓️', '📖', '📝', '🎯']; // plan, study, practice, exam: the order on every splash and intro
const SPLASH_RING_R = 100;                      // the ring's radius in its 230 × 230 viewBox
const SPLASH_RING_C = 115;
const SPLASH_RING_SHARE = [0, 0.25, 0.5, 0.75]; // 12 / 3 / 6 / 9 o'clock: when the arc reaches each icon
const SPLASH_STATUS_KEYS = ['splash.status1', 'splash.status2', 'splash.status3']; // take turns while it runs
const SPLASH_TIP_KEYS = ['splash.tip1', 'splash.tip2', 'splash.tip3', 'splash.tip4', 'splash.tip5'];
let splashEndsAt = 0;

const isAutomatedRun = () => location.protocol === 'file:' || navigator.webdriver === true;
const isSplashSkipped = isAutomatedRun;
const prefersReducedMotion = () => !!window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

function pickSplashAnim() {
  const total = SPLASH_WEIGHTS.reduce((n, [, w]) => n + w, 0);
  let r = Math.random() * total;
  return SPLASH_WEIGHTS.find(([, w]) => (r -= w) < 0)[0];
}
function splashFanHtml() {
  return `<div class="splash-fan" aria-hidden="true">${SPLASH_ICONS.map(ic => `<span class="splash-card">${ic}</span>`).join('')}</div>`;
}
function splashRingHtml() {
  const len = (2 * Math.PI * SPLASH_RING_R).toFixed(1);
  const icons = SPLASH_ICONS.map((ic, i) =>
    `<span class="splash-ring-ic at${i}" style="--delay:${Math.round(SPLASH_RING_SHARE[i] * SPLASH_ANIM_MS.ring)}ms">${ic}</span>`).join('');
  return `<svg class="splash-ring" viewBox="0 0 230 230" aria-hidden="true" style="--ring-len:${len}">
    <defs><linearGradient id="splashRingGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0"/><stop offset="1"/></linearGradient></defs>
    <circle class="splash-ring-track" cx="${SPLASH_RING_C}" cy="${SPLASH_RING_C}" r="${SPLASH_RING_R}"/>
    <circle class="splash-ring-arc" cx="${SPLASH_RING_C}" cy="${SPLASH_RING_C}" r="${SPLASH_RING_R}" transform="rotate(-90 ${SPLASH_RING_C} ${SPLASH_RING_C})"/>
  </svg>${icons}`;
}
// three different tips (phone css shows the first)
function splashMemosHtml() {
  const tipKeys = SPLASH_TIP_KEYS.map(k => [Math.random(), k]).sort((a, b) => a[0] - b[0]).slice(0, SPLASH_MEMO_COUNT).map(([, k]) => k);
  return tipKeys.map(tipKey => `<div class="splash-memo"><b>📌 ${escapeHtml(t('splash.tipLabel'))}</b>${escapeHtml(t(tipKey))}</div>`).join('');
}
function runSplashStatus(totalMs) {
  const el = byId('splashStatus');
  const step = totalMs / SPLASH_STATUS_KEYS.length;
  SPLASH_STATUS_KEYS.forEach((statusKey, i) => setTimeout(() => { el.textContent = t(statusKey); }, i * step));
}
// called first thing in startApp (main.js), after the late boot scripts: t() works from here
function startSplash() {
  const el = byId('splash');
  if (!el) return; // a pre-v2.5.0 cached shell has no splash
  // W-057: a cached pre-v2.5.0 config.js has no SPLASH_* constants: no animation, straight in
  if (isSplashSkipped() || typeof SPLASH_WEIGHTS === 'undefined') { el.remove(); return; }
  const kind = pickSplashAnim();
  const animMs = prefersReducedMotion() ? 0 : SPLASH_ANIM_MS[kind];
  el.dataset.anim = kind; // which animation this launch drew (tests/intro-test.js reads it)
  byId('splashStage').insertAdjacentHTML('afterbegin', kind === 'ring' ? splashRingHtml() : splashFanHtml());
  byId('splashMemos').innerHTML = splashMemosHtml();
  runSplashStatus(Math.max(animMs, SPLASH_HOLD_MS * SPLASH_STATUS_KEYS.length));
  splashEndsAt = performance.now() + animMs;
}
// fade out once the animation has run; onDone runs as the fade starts (the intro opens underneath)
function finishSplash(onDone) {
  const el = byId('splash');
  if (!el) { onDone(); return; }
  const wait = Math.max(0, splashEndsAt - performance.now()) + SPLASH_HOLD_MS;
  setTimeout(() => {
    onDone();
    el.classList.add('splash-out');
    setTimeout(() => {
      el.remove();
      if (typeof reloadForUpdate === 'function') reloadForUpdate(); // an update held back while the splash was up (pwa.js)
    }, SPLASH_FADE_MS);
  }, wait);
}
// boot failed: take the splash away at once so the fallback message shows
function dismissSplash() {
  const el = byId('splash');
  if (el) el.remove();
}
const isSplashOpen = () => !!byId('splash');
