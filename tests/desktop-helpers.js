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

// v2.1.0: the colours a screenshot shows in a band of rows (what is painted, box-shadows included, which hit testing
// cannot tell): a minimal PNG reader for Chromium's 8-bit RGB / RGBA, non-interlaced screenshots.
// Returns [[r, g, b], …] for every pixel of rows y0..y1 (CSS px at deviceScaleFactor 1)
const zlib = require('zlib');
const PNG_SIGNATURE_BYTES = 8;
const PNG_CHANNELS = { 2: 3, 6: 4 }; // colour type → bytes per pixel (RGB, RGBA)
function pngRows(png) {
  let at = PNG_SIGNATURE_BYTES, width = 0, height = 0, bpp = 0;
  const idat = [];
  while (at < png.length) {
    const len = png.readUInt32BE(at), type = png.toString('ascii', at + 4, at + 8), data = png.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bpp = PNG_CHANNELS[data[9]]; }
    if (type === 'IDAT') idat.push(data);
    at += len + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = width * bpp, rows = [];
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      line[i] = (line[i] + pred) & 0xff;
    }
    rows.push(line);
    prev = line;
  }
  return { width, bpp, rows };
}
async function bandColours(page, y0, y1) {
  const { width, bpp, rows } = pngRows(await page.screenshot());
  const out = [];
  for (let y = y0; y <= y1; y++) for (let x = 0; x < width; x++) out.push([rows[y][x * bpp], rows[y][x * bpp + 1], rows[y][x * bpp + 2]]);
  return out;
}

// v2.1.0 Study memo list (mockup desktop-memo.html rev 6): columns of cards (distinct lefts), each card's status badge in
// its top-right corner (beside the first line of the title, never pushed under it), its bar at the card's foot, the
// cards of a row equally high; where the due banner is and whether it is inside the card panel
const MEMO_LIST_SLACK_PX = 1.5;
const memoListLayout = page => page.evaluate(slack => {
  const box = el => el.getBoundingClientRect();
  const cards = [...document.querySelectorAll('#studyContent .memo-card')];
  const lefts = [...new Set(cards.map(c => Math.round(box(c).left)))];
  const rows = {};
  const bad = [];
  cards.forEach(c => {
    const r = box(c), cs = getComputedStyle(c), name = c.querySelector('.memo-name'), badge = c.querySelector('.memo-badge'), bar = c.querySelector('.memo-bar');
    const b = box(badge), n = box(name), lineH = parseFloat(getComputedStyle(name).lineHeight) || n.height;
    (rows[Math.round(r.top)] = rows[Math.round(r.top)] || []).push(r.height);
    const right = r.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
    const foot = r.bottom - parseFloat(cs.paddingBottom) - parseFloat(cs.borderBottomWidth);
    if (Math.abs(b.right - right) > slack) bad.push(`${c.dataset.arg}: badge right ${b.right.toFixed(1)} / ${right.toFixed(1)}`);
    if (b.top > n.top + lineH / 2 || b.top < r.top) bad.push(`${c.dataset.arg}: badge top ${b.top.toFixed(1)} vs title ${n.top.toFixed(1)}`);
    if (b.left < n.right - slack) bad.push(`${c.dataset.arg}: badge over the title`);
    if (Math.abs(box(bar).bottom - foot) > slack) bad.push(`${c.dataset.arg}: bar ${box(bar).bottom.toFixed(1)} / foot ${foot.toFixed(1)}`);
  });
  const unequal = Object.values(rows).filter(hs => Math.max(...hs) - Math.min(...hs) > slack).length;
  const due = document.querySelector('#screenStudy .memo-due'), content = byId('studyContent');
  return { cards: cards.length, columns: lefts.length, bad, unequal, due: due && box(due), dueInPanel: !!due && content.contains(due),
    panel: box(content), header: box(document.querySelector('header')) };
}, MEMO_LIST_SLACK_PX);

module.exports = {
  bandColours, memoListLayout,
  APP_URL, DESKTOP_MIN_WIDTH, VIEWPORTS, DESKTOP_VIEWPORTS, SHORT_VIEWPORTS, LANGS, FONT_SIZES, TRANSLATIONS, FIT_SLACK_PX,
  assert, launch, openDesktop, applySettings, setViewport, nextFrame, forEachCase, settingsLabel,
  noHorizontalScroll, pageNotScrolling, fitsWithoutScroll, panelOnlyScroll, inViewport, measurePx, controlsReachable,
};
