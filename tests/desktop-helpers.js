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
};
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
  APP_URL, DESKTOP_MIN_WIDTH, VIEWPORTS, DESKTOP_VIEWPORTS, LANGS, FONT_SIZES, TRANSLATIONS, FIT_SLACK_PX,
  assert, launch, openDesktop, applySettings, setViewport, nextFrame, forEachCase, settingsLabel,
  noHorizontalScroll, pageNotScrolling, fitsWithoutScroll, panelOnlyScroll, inViewport, measurePx,
};
