// QA v0.62 P3 PR-2 batch (manual, not part of run-all.sh): Study visual unify (Lane V), Similar Core Fact + Similar
// side session, fact session engine (Lane C2), boot W-010, PWA S-026 / S-027, version / SW cache.
// Also writes screenshots of the app and of mockups/study-unify.html for a side-by-side check.
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium \
//     node .proj-docs/qa/scripts/2026-10-06_qa-v062.js <repo-root> <screenshot-dir> [v061-ref=15aba6b] [v057-ref=dc84cab]
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.resolve(process.argv[2] || '.');
const SHOT_DIR = path.resolve(process.argv[3] || '.');
const V061_REF = process.argv[4] || '15aba6b';
const V057_REF = process.argv[5] || 'dc84cab';
const { startPagesServer } = require(path.join(ROOT, 'tests', 'pages-server.js'));
const APP_URL = 'file://' + path.join(ROOT, 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
let pass = 0, fail = 0;
const failures = [];
const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; failures.push(m); console.log('FAIL:', m); } };
const note = (...a) => console.log('  note:', ...a);
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' };
const shot = n => path.join(SHOT_DIR, `2026-10-06_v062_${n}.png`);

function watchErrors(pg) {
  const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  return errs;
}
// resolve a token to the rgb() string the browser computes for it
const tok = (pg, name, prop = 'color') => pg.evaluate(([n, p]) => {
  const d = document.createElement('div'); d.style[p] = `var(${n})`; document.body.appendChild(d);
  const v = getComputedStyle(d)[p]; d.remove(); return v;
}, [name, prop]);
const cs = (pg, sel, props, pse) => pg.evaluate(([s, ps, pe]) => {
  const e = document.querySelector(s); if (!e) return null;
  const c = getComputedStyle(e, pe || null); return Object.fromEntries(ps.map(p => [p, c[p]]));
}, [sel, props, pse]);

// ══════════ 7. version / SW ══════════
async function versionCheck(b) {
  const { base, server } = await startPagesServer(ROOT);
  try {
    const ctx = await b.newContext(); const pg = await ctx.newPage();
    await pg.goto(base);
    ok(await pg.evaluate(() => APP_VERSION) === '0.62', 'APP_VERSION === 0.62');
    await pg.evaluate(() => navigator.serviceWorker.ready);
    await pg.waitForFunction(async () => (await caches.keys()).includes('lifeuk-v0.62'), null, { timeout: 15000 }).catch(() => {});
    const keys = await pg.evaluate(() => caches.keys());
    ok(keys.length === 1 && keys[0] === 'lifeuk-v0.62', `SW cache = lifeuk-v0.62 only (${keys})`);
    const cached = await pg.evaluate(async () => !!(await (await caches.open('lifeuk-v0.62')).match('js/screens/sideSession.js')));
    ok(cached, 'sideSession.js is in the installed SW cache');
    await ctx.close();
  } finally { server.kill(); }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok(/'js\/screens\/sideSession\.js'/.test(sw.match(/const SHELL = \[([\s\S]*?)\];/)[1]), 'sw.js SHELL lists js/screens/sideSession.js');
}

// ══════════ 1. Study visual ══════════
async function studyColours(pg, w) {
  const T = { navy: await tok(pg, '--navy'), navyLight: await tok(pg, '--navy-light'), selBg: await tok(pg, '--selected-bg'),
    purple: await tok(pg, '--purple'), purpleLight: await tok(pg, '--purple-light'), orange: await tok(pg, '--orange'),
    muted: await tok(pg, '--text-muted'), red: await tok(pg, '--red'), flagBg: await tok(pg, '--flag-bg'), white: await tok(pg, '--text-inverse') };
  await pg.evaluate(() => { openStudy(); studySetTab('chapters'); studySetChapter(3); });
  const tab = await cs(pg, '.study-tab.active', ['backgroundColor', 'borderTopColor']);
  ok(tab.backgroundColor === T.navy && tab.borderTopColor === T.navy, `${w}: selected study tab navy (${JSON.stringify(tab)})`);
  const chip = await cs(pg, '#studySubChips .chip.active', ['backgroundColor']);
  ok(chip && chip.backgroundColor === T.navy, `${w}: selected chapter chip navy (${chip && chip.backgroundColor})`);
  const fact = await cs(pg, '#studyContent .fact:not(.war):not(.mastered)', ['borderLeftColor', 'borderLeftWidth', 'borderTopLeftRadius']);
  ok(fact.borderLeftColor === T.navyLight && fact.borderLeftWidth === '4px', `${w}: fact left border 4px navy-light (${JSON.stringify(fact)})`);
  const year = await cs(pg, '#studyContent .tag.year', ['color', 'backgroundColor']);
  ok(year.color === T.navyLight && year.backgroundColor === T.selBg, `${w}: year tag navy-light on selected-bg (${JSON.stringify(year)})`);
  // stars: 5 glyphs, d gold + (5 - d) .off, tooltip Difficulty d/5, equals fact.d
  const stars = await pg.evaluate(() => [...document.querySelectorAll('#studyContent .fact')].map(el => {
    const s = el.querySelector('.stars'); const id = Number(el.querySelector('.fact-btn.star').dataset.arg);
    const f = STUDY.find(x => x.id === id);
    return { id, d: f.d, all: s ? s.textContent.length : 0, off: s ? s.querySelector('.off').textContent.length : -1, title: s && s.title, diffTag: !!el.querySelector('.tag.diff') };
  }));
  const badStars = stars.filter(s => s.all !== 5 || s.off !== 5 - s.d || s.title !== `Difficulty ${s.d}/5` || s.diffTag);
  ok(stars.length > 0 && badStars.length === 0, `${w}: every fact shows 5 stars (d on, 5-d .off, tooltip) — ${stars.length} cards, bad ${JSON.stringify(badStars.slice(0, 3))}`);
  // timeline
  await pg.evaluate(() => studySetTab('timeline'));
  const tl = await cs(pg, '.tl-item:not(.war) .tl-year', ['color']);
  const dot = await cs(pg, '.tl-item:not(.war) .tl-year', ['backgroundColor'], '::after');
  const warTl = await cs(pg, '.tl-item.war .tl-year', ['color']);
  ok(tl.color === T.navyLight && dot.backgroundColor === T.navyLight, `${w}: timeline year + dot navy-light (${tl.color} / ${dot.backgroundColor})`);
  ok(warTl.color === T.red, `${w}: war timeline year stays red (${warTl.color})`);
  // geography sub-title
  await pg.evaluate(() => { studySetTab('geo'); studySetNation('Scotland'); });
  const sub = await cs(pg, '.study-sub-title', ['color']);
  ok(sub && sub.color === T.navyLight, `${w}: Geography sub-title navy-light (${sub && sub.color})`);
  // purple only in Cantonese: scan every visible element of each Study tab
  const purpleHits = [];
  for (const tabName of ['chapters', 'timeline', 'geo', 'people']) {
    await pg.evaluate(t => studySetTab(t), tabName);
    const hits = await pg.evaluate(P => {
      const out = [];
      for (const e of document.querySelectorAll('#screenStudy *')) {
        if (!e.getClientRects().length) continue;
        const c = getComputedStyle(e);
        for (const p of ['color', 'backgroundColor', 'borderLeftColor', 'borderTopColor']) {
          if (P.includes(c[p]) && !e.closest('.fact-yue')) out.push(`${e.tagName}.${e.className.baseVal ?? e.className}:${p}`);
        }
      }
      return [...new Set(out)];
    }, [T.purple, T.purpleLight]);
    purpleHits.push(...hits.map(h => tabName + ' ' + h));
  }
  const yueColour = await cs(pg, '.fact-yue', ['color']);
  ok(purpleHits.length === 0, `${w}: no purple in Study outside .fact-yue ${JSON.stringify(purpleHits.slice(0, 5))}`);
  ok(yueColour && yueColour.color === T.purple, `${w}: .fact-yue still purple (${yueColour && yueColour.color})`);
  // Home Practice by chapter badge
  await pg.evaluate(() => { leaveToHome(); setPracticeView('chapter'); });
  const chNum = await cs(pg, '.chapter-btn .ch-num', ['backgroundColor', 'borderTopLeftRadius']);
  ok(chNum.backgroundColor === T.navyLight && chNum.borderTopLeftRadius === '6px', `${w}: Home .ch-num navy-light, 6px radius (${JSON.stringify(chNum)})`);
  return T;
}

async function bookmarkAndMarks(pg, w, T) {
  await pg.evaluate(() => { localStorage.removeItem('lifeuk.studyBookmarks'); localStorage.removeItem('lifeuk.studyMastered'); });
  await pg.reload();
  await pg.evaluate(() => { openStudy(); studySetTab('chapters'); studySetChapter(3); });
  const path0 = '#studyContent .fact:nth-of-type(1) .fact-btn.star';
  const id = await pg.$eval('#studyContent .fact .fact-btn.star', e => e.dataset.arg);
  const sel = `.fact-btn.star[data-arg="${id}"]`, tsel = `.fact-btn.tick[data-arg="${id}"]`;
  const look = async s => pg.evaluate(s => {
    const b = document.querySelector(s); const p = b.querySelector('path'); const c = getComputedStyle(p); const bc = getComputedStyle(b);
    return { fill: c.fill, stroke: c.stroke, bg: bc.backgroundColor, border: bc.borderTopColor, color: bc.color, pressed: b.getAttribute('aria-pressed'),
      label: b.getAttribute('aria-label'), hidden: b.querySelector('svg').getAttribute('aria-hidden'), text: b.textContent.trim(), on: b.classList.contains('on') };
  }, s);
  let l = await look(sel);
  ok(l.fill === 'none' && l.stroke === T.muted && !l.on && l.pressed === 'false', `${w}: bookmark off = hollow muted outline, aria-pressed false (${JSON.stringify(l)})`);
  ok(l.label === 'Bookmark' && l.hidden === 'true' && l.text === '', `${w}: bookmark aria-label Bookmark, SVG aria-hidden, no ☆/★ text`);
  await pg.click(sel);
  l = await look(sel);
  ok(l.on && l.fill === T.orange && l.stroke === T.orange && l.bg === T.flagBg && l.border === T.orange && l.pressed === 'true',
    `${w}: bookmark on = orange fill + flag-bg + orange border, aria-pressed true (${JSON.stringify(l)})`);
  ok(![l.fill, l.stroke].includes('rgb(0, 0, 0)'), `${w}: bookmark icon is never black`);
  let t = await pg.evaluate(s => { const b = document.querySelector(s); return { p: b.getAttribute('aria-pressed'), l: b.getAttribute('aria-label') }; }, tsel);
  ok(t.p === 'false' && t.l === 'Mastered', `${w}: ✓ aria-label Mastered, pressed false`);
  await pg.click(tsel);
  t = await pg.evaluate(s => document.querySelector(s).getAttribute('aria-pressed'), tsel);
  ok(t === 'true', `${w}: ✓ aria-pressed true after click`);
  const ls = await pg.evaluate(() => [localStorage.getItem('lifeuk.studyBookmarks'), localStorage.getItem('lifeuk.studyMastered'), localStorage.getItem('lifeuk.flags')]);
  ok(JSON.parse(ls[0])[id] === true && JSON.parse(ls[1])[id] === true, `${w}: studyBookmarks / studyMastered written for #${id} (${ls[0]} / ${ls[1]})`);
  await pg.reload();
  await pg.evaluate(() => { openStudy(); });
  const after = await pg.evaluate(([s, ts]) => ({ b: document.querySelector(s)?.classList.contains('on'), t: document.querySelector(ts)?.classList.contains('on'),
    bp: document.querySelector(s)?.getAttribute('aria-pressed') }), [sel, tsel]);
  ok(after.b && after.t && after.bp === 'true', `${w}: marks survive reload (${JSON.stringify(after)})`);
  // "Bookmarked only" chip
  const chipSel = '#studyChips .chip[data-arg="bookmarksOnly"]';
  const chip = async () => pg.evaluate(s => { const c = document.querySelector(s); const p = c.querySelector('svg.chip-flag path'); const k = getComputedStyle(p);
    return { text: c.textContent.trim(), fill: k.fill, stroke: k.stroke, active: c.classList.contains('active'), bg: getComputedStyle(c).backgroundColor }; }, chipSel);
  let c = await chip();
  ok(c.text === 'Bookmarked only' && c.fill === 'none' && !c.active, `${w}: chip "Bookmarked only" off = hollow icon (${JSON.stringify(c)})`);
  await pg.click(chipSel);
  c = await chip();
  note(`${w}: chip on look`, JSON.stringify(c));
  ok(c.active && c.fill !== 'none' && c.fill !== 'rgb(0, 0, 0)', `${w}: chip on = filled icon (fill ${c.fill}; orange? ${c.fill === T.orange}; white? ${c.fill === T.white})`);
  const shown = await pg.$$eval('#studyContent .fact', els => els.length);
  ok(shown === 1, `${w}: Bookmarked only shows the 1 bookmarked fact (${shown})`);
  await pg.click(chipSel);
  // undo: click again → removed from storage
  await pg.click(sel); await pg.click(tsel);
  const ls2 = await pg.evaluate(() => [localStorage.getItem('lifeuk.studyBookmarks'), localStorage.getItem('lifeuk.studyMastered')]);
  ok(!(id in JSON.parse(ls2[0])) && !(id in JSON.parse(ls2[1])), `${w}: second click removes the mark (${ls2})`);
  ok(ls[2] === null || !JSON.parse(ls[2])[id], `${w}: Practice lifeuk.flags untouched by Study bookmark (${ls[2]})`);
}

// W-009 hit areas, elementFromPoint + real taps
async function hitAreas(pg, w) {
  await pg.evaluate(() => { localStorage.removeItem('lifeuk.studyBookmarks'); localStorage.removeItem('lifeuk.studyMastered'); });
  await pg.reload();
  await pg.evaluate(() => { openStudy(); studySetTab('chapters'); studySetChapter(3); });
  const h = await pg.evaluate(() => {
    const s = document.querySelector('#studyContent .fact .fact-btn.star'); const tk = s.nextElementSibling;
    const a = s.getBoundingClientRect(), c = tk.getBoundingClientRect(); const my = a.top + a.height / 2;
    const at = (x, y) => { const e = document.elementFromPoint(x, y); return e === s || s.contains(e) ? 'star' : e === tk || tk.contains(e) ? 'tick' : (e && e.className) || 'none'; };
    // scan the row through both buttons, 10px either side
    const row = []; for (let x = Math.floor(a.left) - 10; x <= Math.ceil(c.right) + 10; x++) row.push([x - a.left, at(x + 0.5, my)]);
    const span = k => { const xs = row.filter(r => r[1] === k).map(r => r[0]); return xs.length ? [Math.min(...xs), Math.max(...xs)] : null; };
    const col = []; for (let y = Math.floor(a.top) - 10; y <= Math.ceil(a.bottom) + 10; y++) col.push([y - a.top, at(a.left + a.width / 2, y + 0.5)]);
    const vspan = col.filter(r => r[1] === 'star').map(r => r[0]);
    return {
      star: [a.width, a.height], gap: c.left - a.right,
      starRightIn1: at(a.right - 1, my), tickLeftIn1: at(c.left + 1, my),
      // 4px out: the 1.5px border sits inside the box, so the -6px ring reaches ~4.5–5px past the visible edge
      starLeftOut5: at(a.left - 4, my), starTopOut5: at(a.left + a.width / 2, a.top - 4), starBottomOut4: at(a.left + a.width / 2, a.bottom + 4),
      tickRightOut5: at(c.right + 4, my), tickTopOut5: at(c.left + c.width / 2, c.top - 4), tickBottomOut4: at(c.left + c.width / 2, c.bottom + 4),
      ring: (() => { const p = getComputedStyle(s, '::before'), q = getComputedStyle(tk, '::before'), bw = getComputedStyle(s).borderLeftWidth; return { star: [p.top, p.right, p.bottom, p.left], tick: [q.top, q.right, q.bottom, q.left], border: bw }; })(),
      gapMid: at(a.right + (c.left - a.right) / 2, my),
      hStar: span('star'), hTick: span('tick'), vStar: [Math.min(...vspan), Math.max(...vspan)],
      starInsideAllStar: (() => { for (let x = a.left + 0.5; x < a.right; x++) for (let y = a.top + 0.5; y < a.bottom; y++) if (at(x, y) !== 'star') return [x - a.left, y - a.top]; return true; })(),
      tickInsideAllTick: (() => { for (let x = c.left + 0.5; x < c.right; x++) for (let y = c.top + 0.5; y < c.bottom; y++) if (at(x, y) !== 'tick') return [x - c.left, y - c.top]; return true; })(),
    };
  });
  note(`${w}: hit probe`, JSON.stringify(h));
  ok(h.star[0] === 32 && h.star[1] === 32 && h.gap === 4, `${w}: buttons 32x32, gap 4px`);
  ok(h.starRightIn1 === 'star' && h.tickLeftIn1 === 'tick', `${w}: W-009 bookmark right edge −1px → bookmark, ✓ left edge +1px → ✓`);
  ok(h.starInsideAllStar === true && h.tickInsideAllTick === true, `${w}: every pixel inside each visible box hits its own button (${h.starInsideAllStar} / ${h.tickInsideAllTick})`);
  ok(h.starLeftOut5 === 'star' && h.starTopOut5 === 'star' && h.starBottomOut4 === 'star' && h.tickRightOut5 === 'tick' && h.tickTopOut5 === 'tick' && h.tickBottomOut4 === 'tick',
    `${w}: outer ring still works 4px out (bookmark left/top/bottom, ✓ right/top/bottom)`);
  const tw = h.hTick[1] - h.hTick[0] + 1;
  note(`${w}: effective ✓ hit width ≈ ${tw}px; gap dead zone at mid-gap = ${h.gapMid}`);
  const hw = h.hStar[1] - h.hStar[0] + 1, vh = h.vStar[1] - h.vStar[0] + 1;
  note(`${w}: effective bookmark hit area ≈ ${hw}x${vh}px (comment in study.css says 44px)`);
  ok(vh >= 40, `${w}: bookmark hit height >= 40px (${vh})`);
  // real touch taps on a mobile context are done in touchTaps()
  return h;
}

async function touchTaps(b) {
  const ctx = await b.newContext(MOBILE); const pg = await ctx.newPage(); const errs = watchErrors(pg);
  await pg.goto(APP_URL);
  await pg.evaluate(() => { localStorage.clear(); });
  await pg.reload();
  await pg.evaluate(() => { openStudy(); studySetTab('chapters'); studySetChapter(3); });
  const box = async k => pg.locator(`#studyContent .fact >> nth=0 >> .fact-btn.${k}`).boundingBox();
  const marks = () => pg.evaluate(() => [localStorage.getItem('lifeuk.studyBookmarks'), localStorage.getItem('lifeuk.studyMastered')]);
  let s = await box('star');
  await pg.touchscreen.tap(s.x + s.width - 1, s.y + s.height / 2);
  let m = await marks();
  ok(m[0] && Object.keys(JSON.parse(m[0])).length === 1 && (m[1] === null || m[1] === '{}'), `touch: tap bookmark right edge −1px toggles bookmark only (${m})`);
  const tk = await box('tick');
  await pg.touchscreen.tap(tk.x + 1, tk.y + tk.height / 2);
  m = await marks();
  ok(m[1] && Object.keys(JSON.parse(m[1])).length === 1 && Object.keys(JSON.parse(m[0])).length === 1, `touch: tap ✓ left edge +1px toggles ✓ only (${m})`);
  s = await box('star');
  await pg.touchscreen.tap(s.x - 4, s.y - 4);
  m = await marks();
  ok(Object.keys(JSON.parse(m[0])).length === 0, `touch: tap 4px outside bookmark top-left corner toggles bookmark off (${m[0]})`);
  const tk2 = await box('tick');
  await pg.touchscreen.tap(tk2.x + tk2.width + 4, tk2.y + tk2.height + 4);
  m = await marks();
  ok(Object.keys(JSON.parse(m[1])).length === 0, `touch: tap 4px outside ✓ bottom-right toggles ✓ off (${m[1]})`);
  ok(errs.length === 0, 'touch: no page errors ' + errs.join('|'));
  await ctx.close();
}

async function studyShots(pg, w) {
  const go = async (name, fn) => { await pg.evaluate(fn); await pg.waitForTimeout(150); await pg.screenshot({ path: shot(`${name}-${w}`), fullPage: false }); };
  await pg.evaluate(() => { localStorage.setItem('lifeuk.studyBookmarks', JSON.stringify({ 16: true })); });
  await pg.reload();
  await go('study-top', () => { openStudy(); studySetTab('chapters'); studySetChapter(3); byId('studySearch').focus(); window.scrollTo(0, 0); });
  await go('study-chapters', () => { openStudy(); studySetTab('chapters'); studySetChapter(3); byId('studySearch').focus();
    const f = [...document.querySelectorAll('#studyContent .fact')].find(e => e.querySelector('[data-arg="16"]')); window.scrollTo(0, f.getBoundingClientRect().top + scrollY - 260); });
  await go('study-timeline', () => { studySetTab('timeline'); const f = document.querySelector('.fact-btn[data-arg="16"]').closest('.tl-item'); window.scrollTo(0, f.getBoundingClientRect().top + scrollY - 200); });
  await go('study-geo', () => { studySetTab('geo'); studySetNation('Scotland'); window.scrollTo(0, 0); });
  await go('home-chapter', () => { leaveToHome(); setPracticeView('chapter'); const e = document.querySelector('.chapter-btn'); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 120); });
  await pg.evaluate(() => { localStorage.removeItem('lifeuk.studyBookmarks'); });
}

async function mockupShots(b) {
  for (const w of [390, 900]) {
    const ctx = await b.newContext({ viewport: { width: w === 390 ? 1500 : 1000, height: 1400 } }); const pg = await ctx.newPage();
    for (const id of ['study-chapters', 'timeline', 'similar-core', 'fact-session']) {
      await pg.goto('file://' + path.join(ROOT, 'mockups', 'study-unify.html') + '#' + id);
      await pg.click(`.mock-tab[data-w="${w}"]`);
      await pg.waitForTimeout(100);
      // the recommended "After" frame (A / 1 / Q-frames)
      const frames = pg.locator('.frame-wrap');
      const n = await frames.count();
      const idx = id === 'fact-session' ? [1, 2, 3] : [await frames.evaluateAll(fs => fs.findIndex(f => f.querySelector('.frame-label.rec')))];
      for (const i of idx) if (i >= 0 && i < n) await frames.nth(i).screenshot({ path: shot(`mockup-${id}${idx.length > 1 ? '-' + i : ''}-${w}`) });
    }
    await ctx.close();
  }
}

async function studyVisual(b) {
  for (const w of [390, 900]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 844 } }); const pg = await ctx.newPage(); const errs = watchErrors(pg);
    await pg.goto(APP_URL);
    await pg.evaluate(() => localStorage.clear()); await pg.reload();
    const T = await studyColours(pg, w);
    await bookmarkAndMarks(pg, w, T);
    await hitAreas(pg, w);
    await studyShots(pg, w);
    ok(errs.length === 0, `${w}: Study — no page / console errors ` + errs.join('|'));
    await ctx.close();
  }
  await touchTaps(b);
}

// ══════════ 2. Similar Core Fact + side session ══════════
async function similar(b) {
  for (const w of [390, 900]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 844 } }); const pg = await ctx.newPage(); const errs = watchErrors(pg);
    await pg.goto(APP_URL); await pg.evaluate(() => localStorage.clear()); await pg.reload();
    const idx = await pg.evaluate(() => {
      pendingMode = 'practice'; startExam(1);
      const i = state.questions.findIndex(q => FACT_BY_QKEY[qKey(q)] && FACT_BY_QKEY[qKey(q)].src.length > 2);
      state.current = i; renderQuestion(); const q = state.questions[i]; selectOption(q.a[0]);
      if (q.a.length > 1) { /* multi: reveal by selecting the rest */ q.a.slice(1).forEach(selectOption); }
      return i;
    });
    await pg.waitForTimeout(100);
    const T = { gold: await tok(pg, '--gold'), factBg: await tok(pg, '--fact-bg', 'backgroundColor') };
    const f = await cs(pg, '.sqm-fact', ['backgroundColor', 'borderLeftColor', 'borderLeftWidth', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'paddingTop', 'paddingLeft']);
    ok(f && f.backgroundColor === T.factBg && f.borderLeftColor === T.gold && f.borderLeftWidth === '4px',
      `${w}: Core Fact gold bg + 4px gold left border (${JSON.stringify(f)})`);
    ok(f && [f.borderTopLeftRadius, f.borderTopRightRadius, f.borderBottomLeftRadius].every(r => r === '10px') && f.paddingTop === '12px' && f.paddingLeft === '14px',
      `${w}: Core Fact --radius-md on all corners, 12px 14px padding`);
    await pg.locator('#similarBox').scrollIntoViewIfNeeded();
    await pg.locator('#similarBox').screenshot({ path: shot(`similar-core-${w}`) });
    // stash original session details
    const before = await pg.evaluate(() => { state.flags[0] = true; window.__orig = state; return { cur: state.current, ans: JSON.stringify(state.answers), ex: state.examNum, n: state.questions.length }; });
    const n = await pg.$eval('#similarBox .sqm-practise, #similarBox [data-action="startSimilarPractice"]', e => e.textContent.trim());
    await pg.click('#similarBox [data-action="startSimilarPractice"]');
    const side = await pg.evaluate(() => ({ ex: state.examNum, n: state.questions.length, mode: state.mode, sameFlags: state.flags === window.__orig.flags,
      flags: Object.keys(state.flags).length, ret: sessionReturn && sessionReturn.kind, label: byId('quizLabel').textContent, similarShown: byId('similarBox').classList.contains('show') }));
    ok(side.ex === 'similar' && side.ret === 'quiz' && !side.sameFlags && side.flags === 0 && side.mode === 'practice',
      `${w}: "${n}" → similar side session, own flags object (${JSON.stringify(side)})`);
    ok(/these \d+|this one/.test(n) && Number((n.match(/\d+/) || [1])[0]) === side.n, `${w}: Practise N matches session length (${n} / ${side.n})`);
    // in session: mutate side flags, answer, go last, Back
    await pg.evaluate(() => { state.flags[0] = true; state.flags[1] = true; const q = state.questions[0]; state.answers[0] = [...q.a]; revealAnswer(); });
    ok(!(await pg.evaluate(() => byId('similarBox').classList.contains('show'))), `${w}: no Similar panel inside the similar session`);
    await pg.evaluate(() => { state.current = state.questions.length - 1; renderQuestion(); const q = state.questions[state.current]; state.answers[state.current] = [...q.a]; revealAnswer(); });
    ok(await pg.$eval('#nextBtn', e => e.textContent) === '↩ Back', `${w}: last similar question ↩ Back`);
    await pg.click('#nextBtn');
    const back = await pg.evaluate(() => ({ same: state === window.__orig, cur: state.current, ans: JSON.stringify(state.answers), ex: state.examNum, n: state.questions.length,
      flags: JSON.stringify(state.flags), ret: sessionReturn, num: byId('qNum').textContent }));
    ok(back.same && back.cur === before.cur && back.ans === before.ans && back.ex === before.ex && back.n === before.n && back.ret === null,
      `${w}: ↩ Back restores the original session object, question ${before.cur + 1}, answers (${JSON.stringify(back).slice(0, 200)})`);
    ok(back.flags === '{"0":true}', `${w}: original session flags not touched by the similar session (${back.flags})`);
    ok(errs.length === 0, `${w}: Similar — no page / console errors ` + errs.join('|'));
    await ctx.close();
  }
}

// ══════════ 3. Fact session ══════════
async function factSession(b) {
  for (const w of [390, 900]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 844 } }); const pg = await ctx.newPage(); const errs = watchErrors(pg);
    await pg.goto(APP_URL); await pg.evaluate(() => localStorage.clear()); await pg.reload();
    // Home in Exam mode with a running timer, flagged practice data, Study filtered + scrolled
    await pg.evaluate(() => { practiceFlags = { '1.0': true }; setLS('practiceFlags', practiceFlags); startMode('exam'); pendingMode = EXAM_MODE; startExam(2); });
    const timerBefore = await pg.evaluate(() => examTimerId !== null);
    await pg.evaluate(() => { openStudy(); studySetTab('chapters'); studySetChapter(3); });
    await pg.fill('#studySearch', 'king');
    await pg.evaluate(() => window.scrollTo(0, 400));
    const pre = await pg.evaluate(() => ({ y: scrollY, count: byId('studyCount').textContent, chips: study.chapter, tab: study.tab, search: study.search }));
    await pg.evaluate(() => startFactPractice(21));
    const s = await pg.evaluate(() => ({ mode: state.mode, timer: examTimerId, label: byId('quizLabel').textContent, badge: byId('modeBadge').textContent,
      n: state.questions.length, src: STUDY.find(f => f.id === 21).src.length, timerShown: !!document.querySelector('#examTimer:not([hidden])') && getComputedStyle(byId('examTimer')).display !== 'none' }));
    ok(timerBefore, `${w}: an Exam timer was running before the fact session`);
    ok(s.mode === 'practice' && s.timer === null && s.badge === 'Practice', `${w}: fact session = Practice, timer stopped (${JSON.stringify(s)})`);
    note(`${w}: exam timer element visible in fact session = ${s.timerShown}`);
    ok(s.label === 'Fact #21' && s.n === 8 && s.src === 8, `${w}: header Fact #21, 8 questions = f.src length`);
    await pg.screenshot({ path: shot(`fact-session-q1-${w}`) });
    // answer every question, alternating, check streak writes
    for (let i = 0; i < 8; i++) {
      await pg.evaluate(i => { state.current = i; renderQuestion(); const q = state.questions[i]; state.answers[i] = i % 2 ? [q.o.findIndex((_, k) => !q.a.includes(k))] : [...q.a]; revealAnswer(); }, i);
      const r = await pg.evaluate(() => ({ sim: byId('similarBox').classList.contains('show'), round: !byId('roundRow').hidden && getComputedStyle(byId('roundRow')).display !== 'none' }));
      if (r.sim || r.round) ok(false, `${w}: Q${i + 1} shows Similar panel / round note (${JSON.stringify(r)})`);
    }
    const streak = await pg.evaluate(() => { const st = JSON.parse(localStorage.getItem('lifeuk.practiceStreak') || '{}'); return STUDY.find(f => f.id === 21).src.map(k => st[k]); });
    ok(streak.every((v, i) => v === (i % 2 ? 0 : 1)), `${w}: practiceStreak written for all 8 source questions (${streak})`);
    ok(true, `${w}: no Similar panel / round note on any of the 8 questions`);
    ok(await pg.$eval('#nextBtn', e => e.textContent) === '↩ Back', `${w}: last question ↩ Back`);
    await pg.screenshot({ path: shot(`fact-session-last-${w}`) });
    // flagging inside the fact session writes Practice flags (A-4) and does not disturb the 'flagged' set
    await pg.evaluate(() => toggleFlag());
    const fl = await pg.evaluate(() => ({ pf: Object.keys(practiceFlags).sort(), sf: Object.keys(state.flags) }));
    ok(fl.pf.includes('1.0') && fl.pf.includes('17.21') && fl.sf.length === 0, `${w}: flag in fact session → practiceFlags (+17.21), '1.0' kept (${JSON.stringify(fl)})`);
    await pg.click('#nextBtn');
    const post = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, y: scrollY, count: byId('studyCount').textContent, chips: study.chapter, tab: study.tab,
      search: study.search, box: byId('studySearch').value, ret: sessionReturn }));
    ok(post.screen === 'screenStudy' && post.ret === null, `${w}: ↩ Back → Study, sessionReturn cleared`);
    ok(post.tab === pre.tab && post.chips === pre.chips && post.search === pre.search && post.box === 'king' && post.count === pre.count,
      `${w}: tab / chip / search / count restored (${JSON.stringify(post)})`);
    ok(Math.abs(post.y - pre.y) <= 2, `${w}: scrollY restored (${post.y} vs ${pre.y})`);
    await pg.screenshot({ path: shot(`fact-session-back-${w}`) });
    // the 'flagged' set still works and contains the new flag
    const fset = await pg.evaluate(() => { pendingMode = PRACTICE_MODE; startExam(FLAGGED_EXAM); return { ex: state.examNum, label: byId('quizLabel').textContent, keys: state.questions.map(qKey).sort(), fact: isFactExam(state.examNum) }; });
    ok(fset.ex === 'flagged' && fset.label === 'Flagged' && !fset.fact && fset.keys.join() === ['1.0', '17.21'].sort().join(), `${w}: 'flagged' set unaffected (${JSON.stringify(fset)})`);
    // ← Home mid-session clears sessionReturn
    await pg.evaluate(() => { openStudy(); startFactPractice(21); });
    await pg.click('#screenQuiz [data-action="goHome"], #screenQuiz .back-btn');
    const h = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, ret: sessionReturn, modal: !!document.querySelector('.modal.show, .modal-overlay.show') }));
    ok(h.screen === 'screenHome' && h.ret === null && !h.modal, `${w}: ← Home mid-session → Home, sessionReturn cleared, no leave modal (${JSON.stringify(h)})`);
    ok(errs.length === 0, `${w}: fact session — no page / console errors ` + errs.join('|'));
    await ctx.close();
  }
}

// QA edge cases (new, not in factsession-test)
async function factEdges(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage(); const errs = watchErrors(pg);
  await pg.goto(APP_URL); await pg.evaluate(() => localStorage.clear()); await pg.reload();
  // E1: single-source fact (#8): Q1 is already the last → ↩ Back straight away, Prev disabled
  const e1 = await pg.evaluate(() => { openStudy(); startFactPractice(8); const q = state.questions[0]; state.answers[0] = [...q.a]; revealAnswer();
    return { n: state.questions.length, next: byId('nextBtn').textContent, prevDis: byId('prevBtn') ? byId('prevBtn').disabled : null, qn: byId('qNum').textContent }; });
  ok(e1.n === 1 && e1.next === '↩ Back' && e1.qn.startsWith('Question 1 of 1'), `E1 single-source fact #8: 1 question, ↩ Back on Q1 (${JSON.stringify(e1)})`);
  await pg.click('#nextBtn');
  ok(await pg.evaluate(() => document.querySelector('.screen.active').id === 'screenStudy' && sessionReturn === null), 'E1: ↩ Back returns to Study');
  // E2: id as string / 0 / NaN / fractional — no session, nothing stashed, no throw
  const e2 = await pg.evaluate(() => {
    const before = state; const out = {};
    for (const v of ['21', 0, NaN, 21.5, null, undefined]) { try { startFactPractice(v); out[String(v)] = state === before && sessionReturn === null; } catch (e) { out[String(v)] = 'threw ' + e.message; } }
    return out;
  });
  ok(Object.values(e2).every(v => v === true), `E2 invalid ids ('21', 0, NaN, 21.5, null, undefined) are no-ops (${JSON.stringify(e2)})`);
  // E3: isFactExam boundaries
  const e3 = await pg.evaluate(() => ({ f: isFactExam('f'), f01: isFactExam('f01'), fneg: isFactExam('f-1'), fx: isFactExam('fx'), F21: isFactExam('F21'),
    fl: isFactExam('flagged'), lbl: examLabel('f236'), fsp: isFactExam('f 21') }));
  ok(!e3.f && e3.f01 && !e3.fneg && !e3.fx && !e3.F21 && !e3.fl && !e3.fsp && e3.lbl === 'Fact #236', `E3 isFactExam boundaries (${JSON.stringify(e3)})`);
  // E4: start a fact session from inside a similar session (nested) → Back goes to Study; the stashed quiz session is dropped, not resurrected
  const e4 = await pg.evaluate(() => {
    pendingMode = 'practice'; startExam(1);
    const i = state.questions.findIndex(q => FACT_BY_QKEY[qKey(q)] && FACT_BY_QKEY[qKey(q)].src.length > 2);
    state.current = i; state.answers[i] = [...state.questions[i].a]; revealAnswer(); startSimilarPractice();
    const kindBefore = sessionReturn.kind;
    openStudy(); startFactPractice(21);
    const kindAfter = sessionReturn.kind;
    state.current = state.questions.length - 1; state.answers[state.current] = [...state.questions[state.current].a]; revealAnswer(); returnFromSideSession();
    return { kindBefore, kindAfter, screen: document.querySelector('.screen.active').id, ret: sessionReturn };
  });
  ok(e4.kindBefore === 'quiz' && e4.kindAfter === 'study' && e4.screen === 'screenStudy' && e4.ret === null, `E4 fact session started over a similar session: Back → Study, no stale quiz return (${JSON.stringify(e4)})`);
  // E5: double call (future double tap): second call while already in the fact session
  const e5 = await pg.evaluate(() => {
    openStudy(); studySetTab('chapters'); studySetChapter(3); window.scrollTo(0, 500); const y = scrollY;
    startFactPractice(21); startFactPractice(21);
    const ret = { ...sessionReturn }; state.current = 7; state.answers[7] = [...state.questions[7].a]; revealAnswer(); returnFromSideSession();
    return { y, retY: ret.scrollY, after: scrollY, n: state && state.questions.length };
  });
  note('E5 double startFactPractice:', JSON.stringify(e5));
  ok(e5.retY === 0, `E5 (observation) double startFactPractice overwrites the saved scroll with the quiz scroll 0 (saved ${e5.retY}, Study was at ${e5.y})`);
  // E6: Translate + reload mid fact session → app boots to Home, no stale side session
  await pg.evaluate(() => { startFactPractice(21); toggleQuestionYue(); });
  await pg.reload();
  const e6 = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, ret: sessionReturn }));
  ok(e6.screen === 'screenHome' && e6.ret === null, `E6 reload mid fact session → Home, sessionReturn null (${JSON.stringify(e6)})`);
  // E7: Study ticks / bookmarks unchanged by a fact session (no cross-write)
  const e7 = await pg.evaluate(() => {
    localStorage.setItem('lifeuk.studyMastered', '{"21":true}'); localStorage.setItem('lifeuk.studyBookmarks', '{"21":true}');
    openStudy(); startFactPractice(21); for (let i = 0; i < 8; i++) { state.current = i; state.answers[i] = [...state.questions[i].a]; revealAnswer(); } returnFromSideSession();
    return [localStorage.getItem('lifeuk.studyMastered'), localStorage.getItem('lifeuk.studyBookmarks')];
  });
  ok(e7[0] === '{"21":true}' && e7[1] === '{"21":true}', `E7 fact session leaves Study marks alone (${e7})`);
  // E8: Exam after a fact session still times and ends on its result page
  const e8 = await pg.evaluate(() => { startFactPractice(21); leaveToHome(); pendingMode = EXAM_MODE; startExam(3); return { timer: examTimerId !== null, mode: state.mode, ret: sessionReturn }; });
  ok(e8.timer && e8.mode === 'exam' && e8.ret === null, `E8 Exam after a fact session: timer runs, exam mode (${JSON.stringify(e8)})`);
  await pg.evaluate(() => stopExamTimer());
  ok(errs.length === 0, 'fact edges — no page / console errors ' + errs.join('|'));
  await ctx.close();
}

// ══════════ 4. Boot (W-010) ══════════
function extract(ref, dir) { execSync(`git archive ${ref} | tar -x -C "${dir}"`, { cwd: ROOT, shell: '/bin/bash' }); }
function tmp(tag) { return fs.mkdtempSync(path.join(os.tmpdir(), `lifeuk-qa062-${tag.replace(/[^a-z0-9]+/gi, '_')}-`)); }
const FALLBACK = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8').match(/const I18N_BOOT_FALLBACK_MSG =\s*'([^']+)'/)[1];

async function bootCase(b, tag, prep, expect) {
  const dir = tmp(tag);
  try {
    extract('HEAD', dir); prep(dir);
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    const cons = []; pg.on('console', m => cons.push(m.type() + ': ' + m.text()));
    let navs = 0; pg.on('framenavigated', f => { if (f === pg.mainFrame()) navs++; });
    await pg.goto('file://' + path.join(dir, 'index.html'));
    await pg.waitForTimeout(1200);
    const r = await pg.evaluate(() => ({ grid: byId('examGrid').textContent.trim().slice(0, 120), side: typeof isSideSession === 'function', t: typeof t === 'function',
      btns: document.querySelectorAll('#examGrid .exam-btn').length }));
    const declared = [...errs, ...cons].filter(x => /already been declared/.test(x));
    if (expect === 'fallback') {
      ok(navs === 2 && r.grid === FALLBACK, `${tag}: one reload then fallback message (navs ${navs}, grid "${r.grid}")`);
    } else {
      ok(navs === 1 && r.btns > 0 && r.side && r.t, `${tag}: boots normally, sideSession + i18n loaded (navs ${navs}, ${JSON.stringify(r)})`);
      const sim = await pg.evaluate(() => {
        pendingMode = 'practice'; startExam(1);
        const i = state.questions.findIndex(q => FACT_BY_QKEY[qKey(q)] && FACT_BY_QKEY[qKey(q)].src.length > 2);
        state.current = i; state.answers[i] = [...state.questions[i].a]; revealAnswer(); startSimilarPractice();
        const inSide = isSideSession() && state.examNum === 'similar';
        state.current = state.questions.length - 1; state.answers[state.current] = [...state.questions[state.current].a]; revealAnswer();
        byId('nextBtn').click();
        return { inSide, back: state.examNum === 1 && state.current === i && !isSideSession() };
      });
      ok(sim.inSide && sim.back, `${tag}: Similar side session opens and ↩ Back works (${JSON.stringify(sim)})`);
      const home = await pg.evaluate(() => { leaveToHome(); return document.querySelector('.screen.active').id; });
      ok(home === 'screenHome', `${tag}: leaveToHome (calls clearSideSession) works`);
    }
    ok(declared.length === 0, `${tag}: no "already been declared" error ${declared.join('|')}`);
    ok(errs.length === 0, `${tag}: no page errors ${errs.join(' | ')}`);
    await ctx.close();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const showRef = (ref, f) => execSync(`git show ${ref}:${f}`, { cwd: ROOT });

async function boot(b) {
  await bootCase(b, 'v0.62 shell, i18n.js 404', d => fs.rmSync(path.join(d, 'js/core/i18n.js')), 'fallback');
  // QA edges
  await bootCase(b, 'v0.62 shell, locales/en.js 404', d => fs.rmSync(path.join(d, 'locales/en.js')), 'fallback');
  await bootCase(b, 'v0.62 shell, sideSession.js 404', d => fs.rmSync(path.join(d, 'js/screens/sideSession.js')), 'fallback');
  await bootCase(b, `v0.61 shell (${V061_REF}) + v0.62 js`, d => fs.writeFileSync(path.join(d, 'index.html'), showRef(V061_REF, 'index.html')), 'ok');
  await bootCase(b, `v0.57 shell (${V057_REF}) + v0.62 js`, d => fs.writeFileSync(path.join(d, 'index.html'), showRef(V057_REF, 'index.html')), 'ok');
  await bootCase(b, 'v0.62 shell, all files present', () => {}, 'ok');
}

// ══════════ 5. PWA S-026 / S-027 ══════════
async function pwa(b) {
  const { base, server } = await startPagesServer(ROOT);
  try {
    const ctx = await b.newContext(MOBILE); const pg = await ctx.newPage(); const errs = watchErrors(pg);
    await pg.goto(base);
    const fire = mode => pg.evaluate(m => {
      window.__prompted = 0; const e = new Event('beforeinstallprompt', { cancelable: true });
      if (m === 'reject') { e.prompt = () => { window.__prompted++; return Promise.reject(new DOMException('dup', 'InvalidStateError')); }; e.userChoice = new Promise(() => {}); }
      else { e.prompt = () => { window.__prompted++; return Promise.resolve(); }; e.userChoice = Promise.resolve({ outcome: m }); }
      window.dispatchEvent(e); return byId('installBanner').classList.contains('visible');
    }, mode);
    const race = () => pg.evaluate(() => Promise.race([promptInstall().then(() => 'resolved', e => 'rejected'), new Promise(r => setTimeout(() => r('timeout'), 1500))]));
    // S-027
    ok(await fire('accepted'), 'S-027: banner visible after beforeinstallprompt');
    await pg.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    const a = await pg.evaluate(() => ({ dp: deferredPrompt, vis: byId('installBanner').classList.contains('visible') }));
    ok(a.dp === null && !a.vis, `S-027: appinstalled clears deferredPrompt + hides banner (${JSON.stringify(a)})`);
    ok(await race() === 'resolved' && await pg.evaluate(() => window.__prompted) === 0, 'S-027: promptInstall() after appinstalled resolves without calling prompt()');
    // real tap on a stale Install button after appinstalled (button is hidden; force the click)
    await pg.evaluate(() => byId('installBtn').click());
    await pg.waitForTimeout(100);
    ok(await pg.evaluate(() => window.__prompted) === 0, 'S-027: Install button click after appinstalled → no prompt()');
    // edge: new beforeinstallprompt after appinstalled (reinstall after uninstall) works again
    ok(await fire('accepted'), 'S-027 edge: a later beforeinstallprompt shows the banner again');
    ok(await race() === 'resolved' && await pg.evaluate(() => window.__prompted) === 1, 'S-027 edge: …and promptInstall() prompts once');
    // S-026
    ok(await fire('reject'), 'S-026: banner visible (reject stub)');
    const t0 = Date.now(); const r = await race(); const dt = Date.now() - t0;
    const s = await pg.evaluate(() => ({ vis: byId('installBanner').classList.contains('visible'), key: localStorage.getItem('lifeuk.installDismissed'), dp: deferredPrompt }));
    ok(r === 'resolved' && dt < 1000, `S-026: prompt() reject + pending userChoice → promptInstall() settles (${r}, ${dt}ms)`);
    ok(!s.vis && s.key === null && s.dp === null, `S-026: banner hidden, dismiss key null, event spent (${JSON.stringify(s)})`);
    // edge: appinstalled during a pending prompt
    await fire('accepted');
    const mid = await pg.evaluate(async () => { const p = promptInstall(); window.dispatchEvent(new Event('appinstalled')); await p; return { vis: byId('installBanner').classList.contains('visible'), dp: deferredPrompt }; });
    ok(!mid.vis && mid.dp === null, `S-027 edge: appinstalled while prompt pending → banner hidden, no stale event (${JSON.stringify(mid)})`);
    await pg.waitForTimeout(150);
    ok(errs.length === 0, 'PWA: no page / console errors ' + errs.join('|'));
    await ctx.close();
  } finally { server.kill(); }
}

(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const b = await chromium.launch(launchOpts);
  const sections = { versionCheck, studyVisual, mockupShots, similar, factSession, factEdges, boot, pwa };
  const only = process.env.QA_ONLY ? process.env.QA_ONLY.split(',') : Object.keys(sections);
  try {
    for (const k of only) {
      console.log(`\n── ${k} ──`);
      try { await sections[k](b); } catch (e) { fail++; failures.push(`${k} threw ${e.message}`); console.log(`FAIL: ${k} threw`, e); }
    }
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) console.log('failures:\n - ' + failures.join('\n - '));
  process.exit(fail ? 1 : 0);
})();
