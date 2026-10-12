// v2.0.0 desktop layout (≥ 1024px; handoff .proj-docs/plans/2026-10-12_handoff_desktop-layout.md §7): shared helpers
// for the desktop suites. Pages open at the two mockup sizes, with the settings each case needs seeded before the
// app's scripts run; the checks return { ok, detail } so a suite words its own assert message.
//   const dt = require('./desktop-helpers');
//   const b = await dt.launch();
//   const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.small, lang: 'zh-HK', fontSize: 'large' });
//   dt.assert((await dt.noHorizontalScroll(page)).ok, 'no sideways scroll');
//   await dt.forEachCase(b, async ({ page, label }) => { … });   // 2 sizes × EN / 中 × small / large × translation on / off
const { chromium } = require('playwright-core');
const path = require('path');

const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;

// the breakpoint (css @media (min-width: 1024px), js/components/fit.js DESKTOP_QUERY) and the mockup frames
const DESKTOP_MIN_WIDTH = 1024;
const VIEWPORTS = {
  small: { width: DESKTOP_MIN_WIDTH, height: 768 },
  wide: { width: 1280, height: 800 },
  phone: { width: 390, height: 844 }, // the existing suites' size: nothing may change there
  belowDesktop: { width: DESKTOP_MIN_WIDTH - 1, height: 768 },
  // W-379: short laptop screens (a 768px-high panel less the browser's own bars), and the smallest desktop window
  laptop: { width: 1366, height: 657 },
  short: { width: 1280, height: 720 },
  tiny: { width: DESKTOP_MIN_WIDTH, height: 600 },
};
const SHORT_VIEWPORTS = [VIEWPORTS.laptop, VIEWPORTS.short, VIEWPORTS.tiny];
const DESKTOP_VIEWPORTS = [VIEWPORTS.small, VIEWPORTS.wide];
const LANGS = ['en', 'zh-HK'];
const FONT_SIZES = ['small', 'large'];
const TRANSLATIONS = [true, false];
// "does not fit" everywhere in the desktop layout: scrollHeight > clientHeight + 1 (handoff §5)
const FIT_SLACK_PX = 1;

// keys as js/core/config.js names them (UI_LANG_LS, FONT_SIZE_LS, TRANSLATION_LS); values are JSON like setLS writes
const SETTING_KEYS = { lang: 'lifeuk.uiLang', fontSize: 'lifeuk.fontSize', translation: 'lifeuk.translation' };
// seeded once per tab, so a later ⚙ choice or applySettings() survives a reload
const SEEDED_SS = 'lifeuk.test.desktopSeeded';

const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
const launch = () => chromium.launch(launchOpts);
const settingsLabel = ({ viewport, lang, fontSize, translation }) =>
  `${viewport.width}×${viewport.height} ${lang} ${fontSize} translation ${translation ? 'on' : 'off'}`;

function seedSettings([values, seededKey]) {
  try {
    if (sessionStorage.getItem(seededKey) === '1') return;
    Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
    sessionStorage.setItem(seededKey, '1');
  } catch { /* about:blank has no storage */ }
}
function seedValues({ lang, fontSize, translation }) {
  return {
    [SETTING_KEYS.lang]: JSON.stringify(lang),
    [SETTING_KEYS.fontSize]: JSON.stringify(fontSize),
    [SETTING_KEYS.translation]: JSON.stringify(translation ? 'on' : 'off'),
  };
}

// a new context + page at `viewport` with the settings in place before the first script runs; errors collects page errors
async function openDesktop(browser, { viewport = VIEWPORTS.small, lang = 'en', fontSize = 'small', translation = true, url = APP_URL } = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(seedSettings, [seedValues({ lang, fontSize, translation }), SEEDED_SS]);
  const page = await ctx.newPage();
  page.once('close', () => { ctx.close().catch(() => {}); });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  return { page, ctx, errors, label: settingsLabel({ viewport, lang, fontSize, translation }) };
}

// switch settings on an open page the way ⚙ does (store + re-render of the current screen, which re-runs the fits)
async function applySettings(page, { lang, fontSize, translation } = {}) {
  await page.evaluate(([l, f, tr]) => {
    if (l && l !== getLang()) setLang(l);
    if (f && f !== getFontSize()) { setFontSize(f); rerenderCurrentScreen(); }
    if (tr !== undefined && tr !== isTranslationOn()) { setTranslationOn(tr); rerenderCurrentScreen(); }
  }, [lang, fontSize, translation]);
}
async function setViewport(page, viewport) {
  await page.setViewportSize(viewport);
  await nextFrame(page); // fit.js refits on the frame after a resize
}
const nextFrame = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

// every combination of the desktop sizes and settings (2 × 2 × 2 × 2 = 16 pages), one page at a time
async function forEachCase(browser, fn, { viewports = DESKTOP_VIEWPORTS, langs = LANGS, fontSizes = FONT_SIZES, translations = TRANSLATIONS } = {}) {
  for (const viewport of viewports) for (const lang of langs) for (const fontSize of fontSizes) for (const translation of translations) {
    const opened = await openDesktop(browser, { viewport, lang, fontSize, translation });
    try { await fn({ ...opened, viewport, lang, fontSize, translation }); } finally { await opened.page.close(); }
  }
}

// ── checks: each returns { ok, detail } ──
// the page never scrolls sideways
const noHorizontalScroll = page => page.evaluate(slack => {
  const el = document.scrollingElement;
  return { ok: el.scrollWidth <= el.clientWidth + slack, detail: `scrollWidth ${el.scrollWidth} / clientWidth ${el.clientWidth}` };
}, FIT_SLACK_PX);
// the page itself never scrolls up / down (a one-screen-high screen)
const pageNotScrolling = page => page.evaluate(slack => {
  const el = document.scrollingElement;
  return { ok: el.scrollHeight <= el.clientHeight + slack, detail: `scrollHeight ${el.scrollHeight} / clientHeight ${el.clientHeight}` };
}, FIT_SLACK_PX);
// the element's own content fits (Result left column, Quiz options): it does not scroll
const fitsWithoutScroll = (page, selector) => page.$eval(selector, (el, slack) => (
  { ok: el.scrollHeight <= el.clientHeight + slack, detail: `${el.scrollHeight} / ${el.clientHeight}` }), FIT_SLACK_PX);
// one-screen screen with a long list: the page stays put and the panel is what scrolls
async function panelOnlyScroll(page, panelSelector) {
  const pageCheck = await pageNotScrolling(page);
  const panel = await page.$eval(panelSelector, (el, slack) => ({
    scrolls: el.scrollHeight > el.clientHeight + slack,
    overflowY: getComputedStyle(el).overflowY,
    detail: `panel ${el.scrollHeight} / ${el.clientHeight}`,
  }), FIT_SLACK_PX);
  const ok = pageCheck.ok && panel.scrolls && ['auto', 'scroll'].includes(panel.overflowY);
  return { ok, detail: `page ${pageCheck.detail}; ${panel.detail}; overflow-y ${panel.overflowY}` };
}
// W-379: every control the user can reach under `root` (buttons, links, form fields, summaries, tab stops) can be
// brought on screen and clicked: no ancestor clips it away without scrolling (overflow hidden / clip is not a
// scroll the user has), and after scrollIntoView it lies inside the viewport and inside every scrolling ancestor's
// box, with nothing covering its middle. Scroll offsets are put back afterwards. { ok, detail: the first misses }
const CONTROL_SELECTOR = 'button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
const controlsReachable = (page, root = '.screen.active') => page.evaluate(([rootSel, controlSel, slack]) => {
  const scrollers = [document.scrollingElement, ...document.querySelectorAll('*')].filter(e => e.scrollTop || e.scrollLeft);
  const saved = scrollers.map(e => [e, e.scrollTop, e.scrollLeft]);
  const shown = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden], [inert]');
  const clips = el => { const o = getComputedStyle(el); return o.overflowX !== 'visible' || o.overflowY !== 'visible'; };
  const userScrolls = el => ['auto', 'scroll'].includes(getComputedStyle(el).overflowY) || ['auto', 'scroll'].includes(getComputedStyle(el).overflowX);
  const inside = (r, b) => r.top >= b.top - slack && r.bottom <= b.bottom + slack && r.left >= b.left - slack && r.right <= b.right + slack;
  const name = el => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} "${el.textContent.trim().slice(0, 20)}"`;
  const misses = [];
  const controls = [...document.querySelectorAll(rootSel)].flatMap(r => [...r.querySelectorAll(controlSel)]).filter(shown);
  // first every clip check, before anything scrolls (a box with overflow: hidden still scrolls under scrollIntoView)
  const clipping = el => { const out = []; for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (clips(a)) out.push(a); return out; };
  const open = controls.filter(el => {
    const before = el.getBoundingClientRect();
    const hiddenBy = clipping(el).find(a => !userScrolls(a) && !inside(before, a.getBoundingClientRect()));
    if (hiddenBy) misses.push(`${name(el)} cut off by ${name(hiddenBy)}`);
    return !hiddenBy;
  });
  open.forEach(el => {
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    const view = { top: 0, left: 0, bottom: innerHeight, right: innerWidth };
    const outOf = [view, ...clipping(el).map(a => a.getBoundingClientRect())].find(b => !inside(r, b));
    if (outOf) { misses.push(`${name(el)} not on screen after scrolling (${Math.round(r.top)}–${Math.round(r.bottom)})`); return; }
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit || !(el === hit || el.contains(hit))) misses.push(`${name(el)} covered by ${hit ? name(hit) : 'nothing'}`);
  });
  [document.scrollingElement, ...document.querySelectorAll('*')].forEach(e => { if (e.scrollTop || e.scrollLeft) { e.scrollTop = 0; e.scrollLeft = 0; } });
  saved.forEach(([e, top, left]) => { e.scrollTop = top; e.scrollLeft = left; });
  return { ok: misses.length === 0, count: controls.length, detail: `${controls.length} controls` + (misses.length ? '; ' + misses.slice(0, 4).join(' | ') : '') };
}, [root, CONTROL_SELECTOR, FIT_SLACK_PX]);
// the element sits inside the viewport (Plan Schedule: today's column on open)
const inViewport = (page, selector) => page.$eval(selector, el => {
  const r = el.getBoundingClientRect();
  const ok = r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
  return { ok, detail: `${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)} in ${innerWidth}×${innerHeight}` };
});
// computed px of a css length expression, e.g. measurePx(page, 'var(--space-4)') or 'var(--fs-sm)' as a font size
const measurePx = (page, value, property = 'padding-left') => page.evaluate(([v, prop]) => {
  const probe = document.createElement('div');
  probe.style.setProperty(prop, v);
  probe.style.position = 'absolute';
  document.body.appendChild(probe);
  const px = parseFloat(getComputedStyle(probe).getPropertyValue(prop));
  probe.remove();
  return px;
}, [value, property]);

module.exports = {
  APP_URL, DESKTOP_MIN_WIDTH, VIEWPORTS, DESKTOP_VIEWPORTS, SHORT_VIEWPORTS, LANGS, FONT_SIZES, TRANSLATIONS, FIT_SLACK_PX,
  assert, launch, openDesktop, applySettings, setViewport, nextFrame, forEachCase, settingsLabel,
  noHorizontalScroll, pageNotScrolling, fitsWithoutScroll, panelOnlyScroll, inViewport, measurePx, controlsReachable,
};
