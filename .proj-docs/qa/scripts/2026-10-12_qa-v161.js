// QA v1.6.1 (user iPhone feedback ①–⑥ + review fixes W-067 / S-241 / S-237). Real clicks / real touch gestures (CDP
// Input.synthesizeScrollGesture, touch source) on a mobile-emulated Chromium (isMobile, hasTouch), the repo served over
// http (tests/pages-server.js, Pages-like Cache-Control) so the service worker part is real.
//   S  Study matrix: 320×568 / 360×640 / 390×844 / 844×390 × en / zh-HK × small / large (+ translation off at 390):
//      every tab scrolled (pinned block, search gone, chip rows one line + swipe / wheel, active chip revealed, tap a chip
//      while scrolled → list from its start), fact practice ▶ → ↩ Back (card below the block, flashed)
//   M  memo: list 2 columns, badge under title (Thatcher ≤ 3 lines), open group, start test, ‹ Memory mid-way (nothing
//      recorded), finish → result, later Practice keeps 🏠
//   L  legend + quizzes: Practice quiz / result, Exam quiz / Submit / result, two fixed rows; Similar Practise; Flagged
//   P  plan screens: goal / home card / schedule / day / calendar / run / redo / reset modal; Home reset / install banner
//   I  (inside every section) icon audit of every visible control: no glyph text, icon centred, inside the button and
//      the screen, accessible name
//   O  offline: v1.6.0 served with SW → swap to v1.6.1 → new SW, cache lifeuk-v1.6.1 → offline reload works
//   X  old v1.6.0 cached index.html + v1.6.1 js / css (mixed shell): no errors, icons present
// Screenshots → ../screenshots/v161/
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium node 2026-10-12_qa-v161.js [S M L P O X]
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../../..');
const { startPagesServer, appFiles } = require(path.join(ROOT, 'tests/pages-server.js'));
const SHOTS = path.join(__dirname, '../screenshots/v161');
fs.mkdirSync(SHOTS, { recursive: true });
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const ONLY = process.argv.slice(2);
const want = s => !ONLY.length || ONLY.includes(s);
const GUARD = 450;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const res = [];
const findings = [];
const obs = [];
const log = (ok, id, m, extra) => {
  res.push({ ok, id, m });
  if (!ok) findings.push(id + ' ' + m + (extra !== undefined ? ' ' + JSON.stringify(extra) : ''));
  console.log((ok ? 'ok   ' : 'FAIL ') + id + ' ' + m + (extra !== undefined && !ok ? ' ' + JSON.stringify(extra).slice(0, 900) : ''));
};
const note = (id, m) => { obs.push(id + ' ' + m); console.log('note ' + id + ' ' + m); };
const VIEWPORTS = [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }];
const LANGS = ['en', 'zh-HK'];
const SIZES = ['small', 'large'];
const TABS = ['chapters', 'timeline', 'geo', 'people', 'memo'];
const NOON = new Date('2026-10-12T12:00:00+01:00');
// glyphs that must not be a control's icon (user ④⑥) + other arrow / dingbat / geometric pointer ranges
const GLYPH_RE = /[←-⇿✓-✘✕▶◀▸◂‹›«»↺↻⟲⟳\u{1F501}\u{1F504}➔➜➡⬅⮕⏎]/u;
// content / status inside a control that is not its icon (HANDOFF › kept: plan task type emoji, status pill, memo badge…)
const STATUS_PARTS = '.plan-pill, .plan-task-ic, .plan-day-ic, .plan-task-st, .memo-badge';

let base, server, browser;

async function newPage({ width = 390, height = 844, lang = 'en', font = 'small', trans = 'on', url, sw = 'block', time = NOON, ctxOpts = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    timezoneId: 'Europe/London', serviceWorkers: sw, ...ctxOpts });
  await ctx.clock.setFixedTime(time);
  const pg = await ctx.newPage();
  pg.errs = []; pg.warns = [];
  pg.on('pageerror', e => pg.errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'error' || /\[i18n\] missing key/.test(m.text())) pg.warns.push(m.text()); });
  await pg.goto(url || base + 'index.html');
  await pg.evaluate(([l, f, t]) => {
    localStorage.clear();
    localStorage.setItem('lifeuk.uiLang', JSON.stringify(l));
    localStorage.setItem('lifeuk.fontSize', JSON.stringify(f));
    if (t === 'off') localStorage.setItem('lifeuk.translation', JSON.stringify('off'));
  }, [lang, font, trans]);
  await pg.reload();
  await pg.waitForSelector('#examGrid .exam-btn, #screenHome.active');
  pg.ctx = ctx;
  pg.cdp = await ctx.newCDPSession(pg);
  return pg;
}
const active = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
async function tap(pg, sel, { guard = true } = {}) {
  try { await pg.locator(sel).first().tap({ timeout: 8000 }); } catch (e) { throw new Error('tap ' + sel + ': ' + e.message.split('\n')[0]); }
  if (guard) await sleep(GUARD);
}
// a real touch drag (finger), negative yDistance = finger up = page scrolls down
async function swipe(pg, x, y, dx, dy) {
  // raw touch points (Input.dispatchTouchEvent): touchStart, 10px moves, touchEnd — Input.synthesizeScrollGesture does
  // not scroll in this headless build
  const steps = Math.max(4, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 10));
  const pt = (type, k) => pg.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x + dx * k / steps), y: Math.round(y + dy * k / steps) }] });
  await pt('touchStart', 0);
  for (let k = 1; k <= steps; k++) await pt('touchMove', k);
  await pt('touchEnd', steps);
  await sleep(250);
}
const shot = (pg, name) => pg.screenshot({ path: path.join(SHOTS, name + '.png') });
const tagOf = c => `${c.width}x${c.height} ${c.lang} ${c.font}${c.trans === 'off' ? ' trans-off' : ''}`;

// ── icon audit: every visible control on the active screen (+ header / modal) ──
async function iconAudit(pg, tag) {
  const bad = await pg.evaluate(({ re, status }) => {
    const GL = new RegExp(re, 'u');
    const out = [];
    const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden'; };
    const scope = [...document.querySelectorAll('.screen.active button, .screen.active [role="button"], header button, #confirmModal.show button, #installBanner button')];
    for (const b of scope) {
      if (!vis(b)) continue;
      const c = b.cloneNode(true);
      c.querySelectorAll(status).forEach(s => s.remove());
      const txt = c.textContent.replace(/\s+/g, ' ').trim();
      const id = b.id || (b.className && String(b.className).split(' ')[0]) || b.dataset.action;
      if (GL.test(txt)) out.push({ id, glyph: txt.slice(0, 40) });
      const name = (b.getAttribute('aria-label') || '').trim() || txt || (b.getAttribute('title') || '').trim();
      if (!name) out.push({ id, noName: true });
      const icons = [...b.querySelectorAll('svg.line-icon')];
      const br = b.getBoundingClientRect();
      if ((br.right > innerWidth + 0.5 || br.left < -0.5) && !b.closest('.chip-row')) out.push({ id, offscreen: [br.left, br.right] });
      for (const i of icons) {
        if (i.getAttribute('aria-hidden') !== 'true') out.push({ id, iconNotHidden: i.dataset.iconName });
        const ir = i.getBoundingClientRect();
        if (!ir.width) continue;
        // inside the button box (horizontal + vertical)
        if (ir.left < br.left - 0.5 || ir.right > br.right + 0.5 || ir.top < br.top - 0.5 || ir.bottom > br.bottom + 0.5) out.push({ id, iconOut: i.dataset.iconName });
        const lbl = [...b.querySelectorAll('.icon-label')].find(l => l.getClientRects().length && l.closest('button') === b);
        if (lbl) {
          // centred on the label's first line (an icon sits beside the first / last line of wrapped words)
          const rects = [...lbl.getClientRects()];
          const near = rects.reduce((best, r) => Math.abs((r.top + r.bottom) / 2 - (ir.top + ir.bottom) / 2) < Math.abs((best.top + best.bottom) / 2 - (ir.top + ir.bottom) / 2) ? r : best, rects[0]);
          const d = Math.abs((near.top + near.bottom) / 2 - (ir.top + ir.bottom) / 2);
          if (d > 2.5) out.push({ id, notCentred: i.dataset.iconName, d: +d.toFixed(1) });
        } else if (!txt) {
          // icon-only: centred in the button
          const dx = Math.abs((ir.left + ir.right) / 2 - (br.left + br.right) / 2), dy = Math.abs((ir.top + ir.bottom) / 2 - (br.top + br.bottom) / 2);
          if (dx > 1.5 || dy > 1.5) out.push({ id, iconOnlyOffCentre: i.dataset.iconName, dx: +dx.toFixed(1), dy: +dy.toFixed(1) });
        }
      }
      // icon-only control without SVG (a glyph or empty)
      if (!icons.length && !txt && !b.querySelector('svg')) out.push({ id, emptyNoIcon: true });
      // words cut inside
      const lab = b.querySelector('.icon-label');
      if (lab && lab.getClientRects().length && lab.scrollWidth > lab.clientWidth + 1 && getComputedStyle(lab).display !== 'inline') out.push({ id, labelClipped: true });
    }
    if (document.scrollingElement.scrollWidth > innerWidth + 0.5) out.push({ hScroll: document.scrollingElement.scrollWidth });
    return out;
  }, { re: GLYPH_RE.source, status: STATUS_PARTS });
  log(!bad.length, 'I', `${tag}: icon audit (glyph / name / centred / inside / no h-scroll)`, bad);
  return bad;
}
// emoji / symbols still on visible controls (for the report: intentionally kept list vs other)
async function controlEmoji(pg) {
  return pg.evaluate(() => {
    const out = new Set();
    document.querySelectorAll('.screen.active button, header button').forEach(b => {
      if (!b.getClientRects().length) return;
      const m = b.textContent.match(/[\p{Extended_Pictographic}ⓘ]/gu);
      if (m) m.forEach(x => out.add(x + ' @' + (b.id || String(b.className).split(' ')[0])));
    });
    return [...out];
  });
}

// ── Study geometry ──
const studyGeom = pg => pg.evaluate(() => {
  const r = e => e.getBoundingClientRect();
  const top = document.querySelector('#screenStudy .study-top');
  const rows = ['studyChips', 'studySubChips'].map(id => document.getElementById(id)).filter(e => !e.hidden && e.getClientRects().length);
  return {
    header: r(document.querySelector('header')).bottom,
    block: top ? r(top).toJSON() : null,
    search: r(byId('studySearch')).toJSON(),
    count: r(byId('studyCount')).toJSON(),
    scrollY, innerHeight, docW: document.scrollingElement.scrollWidth, innerWidth,
    maxY: document.scrollingElement.scrollHeight - innerHeight,
    rows: rows.map(row => {
      const chips = [...row.querySelectorAll('.chip')];
      const rr = r(row);
      const inset = parseFloat(getComputedStyle(row).scrollPaddingLeft) || 0;
      const act = row.querySelector('.chip.active');
      const ar = act && r(act);
      const tops = chips.map(c => r(c).top);
      return { id: row.id, n: chips.length, oneLine: tops.every(t => Math.abs(t - tops[0]) < 2), sw: row.scrollWidth, cw: row.clientWidth,
        sl: row.scrollLeft, inset, wrap: getComputedStyle(row).flexWrap, mask: getComputedStyle(row).maskImage !== 'none' || getComputedStyle(row).webkitMaskImage !== 'none',
        rect: rr.toJSON(), active: act ? act.textContent.trim().slice(0, 20) : null,
        activeVisible: !ar || (ar.left >= rr.left + inset - 1.5 && ar.right <= rr.right - inset + 1.5),
        clipped: chips.filter(c => c.scrollWidth > c.clientWidth + 1).length };
    }),
  };
});

async function studyTabChecks(pg, c, tab) {
  const tag = `${tagOf(c)} ${tab}`;
  const landscape = c.height <= 500;
  await pg.evaluate(() => window.scrollTo(0, 0));
  await tap(pg, `.study-tab[data-tab="${tab}"]`, { guard: false });
  await sleep(150);
  let g = await studyGeom(pg);
  log(g.search.bottom > g.header && g.block.top >= g.search.bottom, 'S', `${tag}: at rest search above block, both in view`, { s: g.search, b: g.block, h: g.header });
  // chip rows: one line, nowrap, active chip visible
  for (const row of g.rows) {
    log(row.oneLine && row.wrap === 'nowrap' && row.clipped === 0, 'S', `${tag}: #${row.id} one line (${row.n} chips, ${row.sw}/${row.cw}px)`, row);
    log(row.activeVisible, 'S', `${tag}: #${row.id} active chip "${row.active}" fully revealed`, row);
    if (row.sw > row.cw + 1) log(row.mask, 'S', `${tag}: #${row.id} overflowing row has edge fade mask`, row);
  }
  // scroll the list with a finger: mid list, then to the bottom
  await swipe(pg, c.width / 2, c.height * 0.8, 0, -Math.min(c.height * 0.6, 600));
  g = await studyGeom(pg);
  const pinTol = 1;
  if (!landscape) {
    log(Math.abs(g.block.top - g.header) <= pinTol, 'S', `${tag}: finger scroll ${Math.round(g.scrollY)}px → block pinned under header (top ${g.block.top.toFixed(1)} vs header ${g.header.toFixed(1)})`, g.block);
    log(g.search.bottom <= g.header + 0.5, 'S', `${tag}: search box scrolled away`, g.search);
  } else {
    log(g.block.top < g.header - 5 || g.scrollY < 5, 'S', `${tag}: landscape ≤500px: block NOT pinned (scrolls with the list)`, { b: g.block, y: g.scrollY });
  }
  await pg.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
  await sleep(150);
  g = await studyGeom(pg);
  if (!landscape) {
    log(Math.abs(g.block.top - g.header) <= pinTol || g.maxY <= 0, 'S', `${tag}: at bottom block still pinned`, g.block);
    // the list continues right under the block (elementFromPoint just below)
    const under = await pg.evaluate(y => { const e = document.elementFromPoint(innerWidth / 2, y); return e ? !!e.closest('#studyContent, #studyCount, .study-top') : false; }, g.block.bottom + 4);
    log(under, 'S', `${tag}: list content directly under pinned block`);
    const pct = Math.round((g.block.bottom) / g.innerHeight * 100);
    res.pinPct = res.pinPct || [];
    res.pinPct.push({ tag, pct, block: Math.round(g.block.height) });
  }
  log(g.docW <= g.innerWidth + 0.5, 'S', `${tag}: no sideways page scroll`, { docW: g.docW, w: g.innerWidth });
  // chip row swipe (touch) + wheel, then tap the last chip while scrolled
  const overflowRow = g.rows.find(r => r.sw > r.cw + 1);
  if (overflowRow) {
    const rr = overflowRow.rect;
    const y0 = await pg.evaluate(() => scrollY);
    const sl0 = overflowRow.sl;
    await swipe(pg, rr.right - 30, rr.top + rr.height / 2, -(rr.width - 60), 0);
    const after = await pg.evaluate(id => ({ sl: byId(id).scrollLeft, y: scrollY, x: scrollX }), overflowRow.id);
    log(after.sl > sl0 + Math.min(20, overflowRow.sw - overflowRow.cw - sl0 - 2) && Math.abs(after.y - y0) < 2 && after.x === 0, 'S', `${tag}: #${overflowRow.id} finger swipe scrolls the row only (${sl0}→${after.sl})`, { after, y0 });
    await pg.mouse.move(rr.left + rr.width / 2, rr.top + rr.height / 2);
    await pg.mouse.wheel(-150, 0);
    await sleep(200);
    const afterW = await pg.evaluate(id => ({ sl: byId(id).scrollLeft, y: scrollY }), overflowRow.id);
    log(afterW.sl < after.sl, 'S', `${tag}: #${overflowRow.id} wheel (deltaX) scrolls the row (${after.sl}→${afterW.sl})`, afterW);
    // swipe to the very end and tap the last chip
    for (let k = 0; k < 4; k++) await swipe(pg, rr.right - 20, rr.top + rr.height / 2, -(rr.width - 40), 0);
    const lastSel = `#${overflowRow.id} .chip:last-of-type`;
    const lastBox = await pg.locator(lastSel).boundingBox();
    if (lastBox && lastBox.x + lastBox.width <= c.width) {
      await pg.touchscreen.tap(lastBox.x + lastBox.width / 2, lastBox.y + lastBox.height / 2);
      await sleep(250);
      g = await studyGeom(pg);
      const row = g.rows.find(r => r.id === overflowRow.id) || g.rows[0];
      const lastActiveOrToggled = await pg.evaluate(sel => { const e = document.querySelector(sel); return e.classList.contains('active') || e.getAttribute('aria-pressed') === 'true'; }, lastSel);
      log(lastActiveOrToggled, 'S', `${tag}: tapped last chip of #${overflowRow.id} → active`);
      log(row.activeVisible, 'S', `${tag}: after re-render the active chip is revealed (row sl ${row.sl})`, row);
      if (!landscape) log(g.count.top >= g.block.bottom - 1 && g.count.top <= g.block.bottom + 30, 'S', `${tag}: list shown from its start right under the block (count ${g.count.top.toFixed(0)} / block ${g.block.bottom.toFixed(0)})`, { c: g.count, b: g.block });
      // put the default chip back (tap first chip of that row after swiping back)
      // put the tab's default list back (a re-open resets nothing: use the prefs reset via the tab's own default chip)
      const vis = await pg.evaluate(id => !byId(id).hidden && !!byId(id).querySelector('.chip'), overflowRow.id);
      if (vis) {
        const r2 = await pg.evaluate(id => byId(id).getBoundingClientRect().toJSON(), overflowRow.id);
        // swipe right only within the row's scroll range: past its start Chromium's touch overscroll history navigation
        // leaves the page (any horizontal right-swipe at scrollX 0 does, list included; observation O-1)
        for (let k = 0; k < 6; k++) {
          const sl = await pg.evaluate(id => byId(id).scrollLeft, overflowRow.id);
          if (sl < 25) break;
          await swipe(pg, r2.left + 40, r2.top + r2.height / 2, Math.min(sl - 15, r2.width - 80), 0);
        }
        const back = await pg.evaluate(id => byId(id).scrollLeft, overflowRow.id);
        log(back < 40, 'S', `${tag}: finger swipe right brings #${overflowRow.id} back near its start (sl ${back})`);
        await pg.evaluate(id => { byId(id).scrollLeft = 0; }, overflowRow.id);
        if (overflowRow.id === 'studyChips') {
          // a toggle row (Hide mastered / Bookmarked / Wars only): untoggle the one tapped (tap it again)
          await pg.evaluate(id => { const r = byId(id); r.scrollLeft = r.scrollWidth; }, overflowRow.id);
          await pg.locator(lastSel).tap(); await sleep(200);
          await pg.evaluate(id => { byId(id).scrollLeft = 0; }, overflowRow.id);
        }
        if (overflowRow.id !== 'studyChips') { await pg.locator(`#${overflowRow.id} .chip`).first().tap(); await sleep(200); }
      }
    } else {
      note('S', `${tag}: last chip of #${overflowRow.id} not reachable after swipe`);
    }
  } else {
    note('S', `${tag}: no overflowing chip row`);
  }
  // tap the next tab while scrolled → list from its start
  if (!landscape) {
    await pg.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight * 0.6));
    await sleep(100);
  }
}

async function factReturnCheck(pg, c) {
  const tag = tagOf(c);
  const landscape = c.height <= 500;
  await tap(pg, '.study-tab[data-tab="people"]', { guard: false });
  await sleep(150);
  // a card well down the list: put its top just under the block bottom − 30 (behind the block), its ▶ in view
  const id = await pg.evaluate(() => {
    const cards = [...document.querySelectorAll('#studyContent .fact')];
    return cards[Math.min(6, cards.length - 1)].dataset.factId;
  });
  const sel = `#studyContent .fact[data-fact-id="${id}"]`;
  await pg.evaluate(s => { const el = document.querySelector(s); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 120); }, sel);
  await sleep(100);
  const blockBottom = await pg.evaluate(() => document.querySelector('#screenStudy .study-top').getBoundingClientRect().bottom);
  const headerB = await pg.evaluate(() => document.querySelector('header').getBoundingClientRect().bottom);
  const target = (landscape ? headerB : blockBottom) - 30;
  await pg.evaluate(([s, t]) => { const el = document.querySelector(s); window.scrollBy(0, el.getBoundingClientRect().top - t); }, [sel, target]);
  await sleep(150);
  const btn = `${sel} .fact-practise`;
  const bb = await pg.locator(btn).boundingBox();
  if (!bb || bb.y + bb.height > c.height || bb.y < blockBottom) {
    await pg.locator(btn).scrollIntoViewIfNeeded();
    note('S', `${tag}: ▶ not visible with card top behind the block (card short / screen short) — scrolled to it first`);
  }
  const before = await pg.evaluate(s => document.querySelector(s).getBoundingClientRect().top, sel);
  await pg.locator(btn).tap();
  await sleep(GUARD);
  log(await active(pg) === 'screenQuiz', 'S', `${tag}: fact ▶ Practise opens the quiz (card top was ${before.toFixed(0)}, block bottom ${blockBottom.toFixed(0)})`);
  // the side session header keeps 🏠 (not ‹ Memory)
  const hdr = await pg.evaluate(() => { const b = document.querySelector('#screenQuiz .back-btn'); return { icon: b.querySelector('svg')?.dataset.iconName, text: b.textContent.trim() }; });
  log(hdr.icon === 'home' && hdr.text === '', 'S', `${tag}: fact session header keeps 🏠 icon`, hdr);
  await answerAll(pg);
  await iconAudit(pg, `${tag} fact session last Q`);
  const nb = await pg.evaluate(() => ({ t: byId('nextBtn').textContent.trim(), i: [...byId('nextBtn').querySelectorAll('svg')].map(s => s.dataset.iconName), q: byId('quickNext').querySelector('svg')?.dataset.iconName, ql: byId('quickNext').getAttribute('aria-label') }));
  log(/^(Back|返回)$/.test(nb.t) && nb.i.join() === 'returnLeft' && nb.q === 'returnLeft' && /^(Back|返回)$/.test(nb.ql), 'S', `${tag}: last Q bottom "Back" + returnLeft icon, quick returnLeft named`, nb);
  await pg.locator('#nextBtn').tap();
  // measure immediately (W-067 was a same-frame issue) and after a frame
  const m = await pg.evaluate(s => {
    const el = document.querySelector(s);
    const b = document.querySelector('#screenStudy .study-top').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, Math.max(r.top + 4, 0));
    return { screen: document.querySelector('.screen.active').id, top: r.top, bottom: r.bottom, blockB: b.bottom, blockPos: getComputedStyle(document.querySelector('#screenStudy .study-top')).position,
      header: document.querySelector('header').getBoundingClientRect().bottom, flash: el.classList.contains('flash'), hitOwn: !!hit && el.contains(hit), ih: innerHeight };
  }, sel);
  const limit = m.blockPos === 'sticky' ? m.blockB : m.header;
  log(m.screen === 'screenStudy', 'S', `${tag}: ↩ Back returns to Study`, m);
  log(m.top >= limit - 1 && m.top < m.ih, (m.bottom - m.top) > m.ih - limit ? 'F1' : 'S', `${tag}: W-067 card (h ${Math.round(m.bottom - m.top)} vs space ${Math.round(m.ih - limit)}) top ${m.top.toFixed(0)} ≥ ${m.blockPos} limit ${limit.toFixed(0)} (visible, not under block)`, m);
  log(m.flash && m.hitOwn, (m.bottom - m.top) > m.ih - limit ? 'F1' : 'S', `${tag}: returned card flashed and its top is not covered`, m);
  if (c.width === 390 && c.lang === 'en' && c.font === 'small') await shot(pg, `S-fact-return-${c.width}x${c.height}-${c.lang}`);
  await sleep(GUARD);
}

// answer every question of the current quiz with real taps on the right options, Next after each (not the last)
async function answerAll(pg, { wrongAt = [], skipNextOnLast = true } = {}) {
  for (let guard = 0; guard < 60; guard++) {
    const q = await pg.evaluate(() => ({ i: state.current, n: state.questions.length, a: state.questions[state.current].a, o: state.questions[state.current].o.length, rev: state.current in state.revealed, mode: state.mode }));
    if (!q.rev || q.mode === 'exam') {
      const picks = wrongAt.includes(q.i) ? [...Array(q.o).keys()].filter(k => !q.a.includes(k)).slice(0, q.a.length) : q.a;
      for (const p of picks) { await pg.locator(`#opt${p}`).tap(); await sleep(60); }
    }
    if (q.i === q.n - 1) { if (!skipNextOnLast) { await pg.locator('#nextBtn').tap(); await sleep(GUARD); } return; }
    await pg.locator('#nextBtn').tap();
    await sleep(80);
  }
}

// ── S: Study matrix ──
async function sectionS() {
  const configs = [];
  for (const v of VIEWPORTS) for (const lang of LANGS) for (const font of SIZES) configs.push({ ...v, lang, font });
  configs.push({ width: 390, height: 844, lang: 'zh-HK', font: 'large', trans: 'off' });
  configs.push({ width: 320, height: 568, lang: 'en', font: 'large', trans: 'off' });
  for (const c of configs) {
    const pg = await newPage(c);
    try {
    await tap(pg, '#modeStudy');
    log(await active(pg) === 'screenStudy', 'S', `${tagOf(c)}: Home → Study`);
    for (const tab of TABS) await studyTabChecks(pg, c, tab);
    // tap a tab while scrolled deep → new list from its start
    if (c.height > 500) {
      await tap(pg, '.study-tab[data-tab="chapters"]', { guard: false });
      await pg.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight * 0.7));
      await sleep(100);
      await tap(pg, '.study-tab[data-tab="geo"]', { guard: false });
      await sleep(150);
      const g = await studyGeom(pg);
      log(g.count.top >= g.block.bottom - 1 && g.count.top <= g.block.bottom + 30, 'S', `${tagOf(c)}: tab tapped while scrolled → Geo list from its start right under the block`, { c: g.count.top, b: g.block.bottom });
      if (Math.abs(g.block.top - g.header) > 1) note('S', `${tagOf(c)}: Chapters (short list, scrolled ${'70%'}) → Geo lands at scrollY ${Math.round(g.scrollY)}: search box shown again, block at rest (O-2)`);
    }
    await pg.evaluate(() => window.scrollTo(0, 0));
    await iconAudit(pg, `${tagOf(c)} Study`);
    await factReturnCheck(pg, c);
    if (c.lang === 'en' && c.font === 'small' && !c.trans) {
      await tap(pg, '.study-tab[data-tab="people"]', { guard: false });
      await pg.evaluate(() => window.scrollTo(0, 900));
      await sleep(150);
      await shot(pg, `S-people-scrolled-${c.width}x${c.height}`);
    }
    if (c.lang === 'zh-HK' && c.font === 'large' && !c.trans) {
      await tap(pg, '.study-tab[data-tab="timeline"]', { guard: false });
      await pg.evaluate(() => window.scrollTo(0, 1500));
      await sleep(150);
      await shot(pg, `S-timeline-scrolled-${c.width}x${c.height}-zh-large`);
    }
    log(!pg.errs.length && !pg.warns.length, 'S', `${tagOf(c)}: no page errors / console errors`, [...pg.errs, ...pg.warns]);
    } catch (e) { log(false, 'RUN', `${tagOf(c)}: harness error ${e.message.split('\n')[0]}`); }
    await pg.ctx.close();
  }
}

// ── M: memo ──
async function sectionM() {
  const configs = [];
  for (const v of VIEWPORTS) for (const lang of LANGS) for (const font of SIZES) configs.push({ ...v, lang, font });
  for (const c of configs) {
    const tag = tagOf(c);
    const pg = await newPage(c);
    try {
    await tap(pg, '#modeStudy');
    await tap(pg, '.study-tab[data-tab="memo"]', { guard: false });
    await sleep(200);
    const grid = await pg.evaluate(() => {
      const g = document.querySelector('#studyContent .memo-grid');
      const cards = [...g.querySelectorAll('.memo-card')];
      const rows = {};
      cards.forEach(cd => { const t = Math.round(cd.getBoundingClientRect().top); (rows[t] = rows[t] || []).push(cd); });
      const rowSizes = Object.values(rows).map(r => r.length);
      const lines = el => { const lh = parseFloat(getComputedStyle(el).lineHeight); return Math.round(el.getBoundingClientRect().height / lh); };
      const per = cards.map(cd => {
        const name = cd.querySelector('.memo-name'), badge = cd.querySelector('.memo-badge');
        const nr = name.getBoundingClientRect(), br = badge.getBoundingClientRect(), cr = cd.getBoundingClientRect();
        return { id: cd.dataset.arg, lines: lines(name), below: br.top >= nr.bottom - 1, inside: nr.right <= cr.right + 0.5 && br.right <= cr.right + 0.5 && cr.right <= innerWidth + 0.5,
          // word broken mid-word? compare to overflow-wrap normal
          badgeOneLine: br.height < parseFloat(getComputedStyle(badge).lineHeight) * 1.6 + 8 };
      });
      return { cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, n: cards.length, rowSizes, per };
    });
    log(grid.cols === 2 && grid.n === 62 && grid.rowSizes.every(s => s === 2), 'M', `${tag}: memo list 2-column grid, 62 cards, rows of 2`, { cols: grid.cols, n: grid.n, rows: grid.rowSizes.join('') });
    const badBelow = grid.per.filter(p => !p.below || !p.inside);
    log(!badBelow.length, 'M', `${tag}: every badge below its title, card inside the screen`, badBelow);
    const thatcher = grid.per.find(p => p.id === 'thatcher');
    const tooTall = grid.per.filter(p => p.id !== 'thatcher' && p.lines > 2);
    log(thatcher.lines <= 3, 'M', `${tag}: Thatcher title ${thatcher.lines} line(s) ≤ 3`);
    log(!tooTall.length, 'M', `${tag}: other titles ≤ 2 lines`, tooTall.map(p => p.id + ':' + p.lines));
    const badgeWrap = grid.per.filter(p => !p.badgeOneLine);
    log(!badgeWrap.length, 'M', `${tag}: badges one line`, badgeWrap.map(p => p.id));
    if (c.lang === 'zh-HK' && c.font === 'large') await shot(pg, `M-list-${c.width}x${c.height}-zh-large`);
    await iconAudit(pg, `${tag} memo list`);
    // open a group with a real tap
    await pg.locator('#studyContent .memo-card[data-arg="vote"]').scrollIntoViewIfNeeded();
    await tap(pg, '#studyContent .memo-card[data-arg="vote"]');
    log(await active(pg) === 'screenMemo', 'M', `${tag}: card tap → ① look`);
    const mb = await pg.evaluate(() => { const b = document.querySelector('#screenMemo .memo-back'); return { t: b.textContent.trim(), i: [...b.querySelectorAll('svg')].map(s => s.dataset.iconName) }; });
    log(/^(Memory|記憶法)$/.test(mb.t) && mb.i.join() === 'chevronLeft', 'M', `${tag}: group back "‹ Memory" = chevronLeft icon + words, no glyph`, mb);
    await iconAudit(pg, `${tag} memo look`);
    await pg.locator('#memoBody .memo-start').scrollIntoViewIfNeeded();
    await tap(pg, '#memoBody .memo-start');
    log(await active(pg) === 'screenQuiz', 'M', `${tag}: Start test → quiz`);
    const qh = await pg.evaluate(() => {
      const b = document.querySelector('#screenQuiz .back-btn'), h = document.querySelector('#screenQuiz .quiz-header'), badge = byId('modeBadge');
      const hr = h.getBoundingClientRect(), br = badge.getBoundingClientRect(), bb = b.getBoundingClientRect();
      return { t: b.textContent.trim(), i: [...b.querySelectorAll('svg')].map(s => s.dataset.iconName), aria: b.getAttribute('aria-label'), title: b.getAttribute('title'),
        badgeIn: br.right <= hr.right + 0.5 && br.right <= innerWidth - 8, badgeOneLine: br.height < 40, sameRow: Math.abs((bb.top + bb.bottom) / 2 - (br.top + br.bottom) / 2) < 20 || true,
        hOverflow: h.scrollWidth > h.clientWidth + 1, label: byId('quizLabel').textContent.trim(), br: [br.left, br.right], hr: [hr.left, hr.right] };
    });
    log(/^(Memory|記憶法)$/.test(qh.t) && qh.i.join() === 'chevronLeft' && !qh.aria && !qh.title, 'M', `${tag}: test header "‹ ${qh.t}" chevron icon, named by its words (no aria-label / title), no 🏠`, qh);
    log(qh.badgeIn && qh.badgeOneLine, 'M', `${tag}: header badge inside header / screen, one line (S-241)`, qh);
    // leave mid-way: answer 2, then ‹ Memory
    const before = await pg.evaluate(() => localStorage.getItem('lifeuk.memoProgress'));
    for (let k = 0; k < 2; k++) {
      const a = await pg.evaluate(() => state.questions[state.current].a);
      for (const p of a) { await pg.locator(`#opt${p}`).tap(); await sleep(60); }
      await pg.locator('#nextBtn').tap(); await sleep(80);
    }
    await tap(pg, '#screenQuiz .back-btn');
    const left = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, step: memoView.step, id: memoView.id, prog: localStorage.getItem('lifeuk.memoProgress'), ret: sessionReturn }));
    log(left.s === 'screenMemo' && left.step === 'look' && left.id === 'vote' && left.prog === before && left.ret === null, 'M', `${tag}: ‹ Memory mid-test → same group's look view, nothing recorded, session cleared`, left);
    if (c.width === 320 && c.lang === 'zh-HK' && c.font === 'large') await shot(pg, 'M-left-midway-320-zh-large');
    // full test → result
    await tap(pg, '#memoBody .memo-start');
    if (c.width === 320 && c.font === 'large') await shot(pg, `M-test-header-320-${c.lang}-large`);
    await answerAll(pg, { wrongAt: [1] });
    await iconAudit(pg, `${tag} memo test last Q`);
    await pg.locator('#nextBtn').tap(); await sleep(GUARD);
    const done = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, step: memoView.step, prog: JSON.parse(localStorage.getItem('lifeuk.memoProgress') || 'null') }));
    log(done.s === 'screenMemo' && done.step === 'result' && done.prog && done.prog.vote && done.prog.vote.lv === 1, 'M', `${tag}: finished test → result, recorded once (Lv1)`, done);
    await iconAudit(pg, `${tag} memo result`);
    if (c.width === 390 && c.lang === 'en' && c.font === 'small') await shot(pg, 'M-result-390-en');
    // back to list, then a Practice set keeps 🏠
    await tap(pg, '#screenMemo .memo-back');
    log(await active(pg) === 'screenStudy', 'M', `${tag}: ‹ Memory on the group → Study memo list`);
    if (c.width === 390) {
      await tap(pg, '#screenStudy .back-btn');
      await tap(pg, '#modePractice');
      await pg.locator('#diffGrid button').first().tap(); await sleep(GUARD);
      const ph = await pg.evaluate(() => { const b = document.querySelector('#screenQuiz .back-btn'); return { i: b.querySelector('svg')?.dataset.iconName, t: b.textContent.trim(), aria: b.getAttribute('aria-label') }; });
      log(ph.i === 'home' && ph.t === '' && !!ph.aria, 'M', `${tag}: later Practice set header keeps 🏠 (named "${ph.aria}")`, ph);
    }
    log(!pg.errs.length && !pg.warns.length, 'M', `${tag}: no page errors`, [...pg.errs, ...pg.warns]);
    } catch (e) { log(false, 'RUN', `${tagOf(c)}: harness error ${e.message.split('\n')[0]}`); }
    await pg.ctx.close();
  }
}

// ── legend helpers ──
const legendInfo = (pg, sel) => pg.evaluate(sel => {
  const m = document.querySelector(sel);
  if (!m || !m.getClientRects().length) return null;
  const mr = m.getBoundingClientRect();
  const rows = [...m.querySelectorAll('.lg-row')].map(r => {
    const rr = r.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(r).lineHeight) || parseFloat(getComputedStyle(r).fontSize) * 1.4;
    return { text: r.textContent.replace(/\s+/g, ' ').trim(), oneLine: r.getClientRects().length === 1 && rr.height < lh * 1.6 + 4, right: rr.right, h: rr.height };
  });
  return { rows, right: mr.right, overflow: m.scrollWidth > m.clientWidth + 1 || mr.right > innerWidth + 0.5 };
}, sel);
function checkLegend(L, tag, expect) {
  if (!L) { log(false, 'L', `${tag}: legend missing`); return; }
  const re = expect.map(row => new RegExp('^' + row.map(w => `${w} \\d+`).join(' \\| ') + '$'));
  const ok = L.rows.length === expect.length && L.rows.every((r, i) => re[i].test(r.text));
  log(ok, 'L', `${tag}: legend ${expect.length} rows ${L.rows.map(r => '"' + r.text + '"').join(' / ')}`, L.rows);
  log(L.rows.every(r => r.oneLine && !/^\||\|$/.test(r.text)) && !L.overflow, 'L', `${tag}: each row one line, no leading / trailing |, no overflow`, L);
  log(L.rows.every(r => Math.abs(r.right - L.right) < 2), 'L', `${tag}: rows right-aligned`, L.rows.map(r => r.right));
}
const WORDS = {
  en: { c: 'Correct', w: 'Wrong', u: 'Unanswered', f: 'Flagged', a: 'Answered' },
  'zh-HK': null,
};

// ── L: legend, Practice / Exam / result / Similar / Flagged ──
async function sectionL() {
  // zh words from the locale
  const zh = await (async () => {
    const pg = await newPage({ lang: 'zh-HK' });
    const w = await pg.evaluate(() => ({ c: t('common.correct'), w: t('common.wrong'), u: t('common.unanswered'), f: t('common.flagged'), a: t('common.answered') }));
    await pg.ctx.close();
    return w;
  })();
  WORDS['zh-HK'] = zh;
  const enw = await (async () => {
    const pg = await newPage({ lang: 'en' });
    const w = await pg.evaluate(() => ({ c: t('common.correct'), w: t('common.wrong'), u: t('common.unanswered'), f: t('common.flagged'), a: t('common.answered') }));
    await pg.ctx.close();
    return w;
  })();
  WORDS.en = enw;
  console.log('legend words', JSON.stringify(WORDS));
  const configs = [];
  for (const v of VIEWPORTS) for (const lang of LANGS) for (const font of SIZES) configs.push({ ...v, lang, font });
  for (const c of configs) {
    const tag = tagOf(c);
    const W = WORDS[c.lang];
    const pg = await newPage(c);
    try {
    // Practice: Home → Practice → first difficulty set
    await tap(pg, '#modePractice');
    await pg.locator('#diffGrid button').first().tap(); await sleep(GUARD);
    log(await active(pg) === 'screenQuiz', 'L', `${tag}: Practice set opened by taps`);
    await iconAudit(pg, `${tag} Practice Q1 (before answer)`);
    const q0 = await pg.evaluate(() => state.questions[0].a);
    for (const p of q0) { await pg.locator(`#opt${p}`).tap(); await sleep(60); }
    await iconAudit(pg, `${tag} Practice Q1 revealed (quick nav)`);
    const qn = await pg.evaluate(() => ({ p: byId('quickPrev').innerHTML.includes('line-icon'), pi: byId('quickPrev').querySelector('svg')?.dataset.iconName, pl: byId('quickPrev').getAttribute('aria-label'), n: byId('quickNext').querySelector('svg')?.dataset.iconName, nl: byId('quickNext').getAttribute('aria-label'), nt: byId('quickNext').textContent.trim(), nb: byId('nextBtn').textContent.trim(), nbi: [...byId('nextBtn').querySelectorAll('svg')].map(s => s.dataset.iconName), pb: byId('prevBtn').textContent.trim(), pbi: [...byId('prevBtn').querySelectorAll('svg')].map(s => s.dataset.iconName) }));
    log(qn.pi === 'arrowLeft' && !!qn.pl && qn.n === 'arrowRight' && !!qn.nl && qn.nt === '' && qn.nbi.join() === 'arrowRight' && qn.pbi.join() === 'arrowLeft', 'L', `${tag}: quick ← → line icons named "${qn.pl}" / "${qn.nl}", bottom "${qn.pb}" ← / "${qn.nb}" →`, qn);
    // similar panel Practise ▶ (if this question has one)
    const hasSim = await pg.evaluate(() => !!document.querySelector('.sqm-cta button'));
    if (hasSim) {
      const s = await pg.evaluate(() => { const b = document.querySelector('.sqm-cta button'); return { t: b.textContent.trim(), i: [...b.querySelectorAll('svg')].map(x => x.dataset.iconName) }; });
      log(s.i.join() === 'play' && !/▶/.test(s.t), 'L', `${tag}: Similar "${s.t}" play icon`, s);
    }
    await pg.locator('#nextBtn').tap(); await sleep(80);
    const q1 = await pg.evaluate(() => ({ a: state.questions[1].a, o: state.questions[1].o.length }));
    const wrong = [...Array(q1.o).keys()].filter(k => !q1.a.includes(k)).slice(0, q1.a.length);
    for (const p of wrong) { await pg.locator(`#opt${p}`).tap(); await sleep(60); }
    await pg.locator('#flagBtn').tap(); await sleep(60);
    checkLegend(await legendInfo(pg, '#dotsMeta'), `${tag} Practice quiz`, [[W.c, W.u], [W.w, W.f]]);
    if (c.width === 320 && c.font === 'large') await shot(pg, `L-practice-legend-320-${c.lang}-large`);
    // jump to the last question via its dot, answer, Finish
    const n = await pg.evaluate(() => state.questions.length);
    await pg.locator(`#navDots button`).nth(n - 1).tap(); await sleep(80);
    const ql = await pg.evaluate(() => state.questions[state.current].a);
    for (const p of ql) { await pg.locator(`#opt${p}`).tap(); await sleep(60); }
    const fin = await pg.evaluate(() => ({ t: byId('nextBtn').textContent.trim(), i: [...byId('nextBtn').querySelectorAll('svg')].map(s => s.dataset.iconName), q: byId('quickNext').querySelector('svg')?.dataset.iconName, ql: byId('quickNext').getAttribute('aria-label') }));
    log(fin.i.join() === 'check' && fin.q === 'check' && !!fin.ql && !/✓/.test(fin.t), 'L', `${tag}: last Q "${fin.t}" ✓ check icon (quick named "${fin.ql}")`, fin);
    await iconAudit(pg, `${tag} Practice last`);
    await pg.locator('#nextBtn').tap(); await sleep(GUARD);
    log(await active(pg) === 'screenResult', 'L', `${tag}: Finish → result`);
    checkLegend(await legendInfo(pg, '#resultDotsMeta'), `${tag} Practice result`, [[W.c, W.u], [W.w, W.f]]);
    await iconAudit(pg, `${tag} Practice result`);
    if (c.width === 390 && c.font === 'small') await shot(pg, `L-practice-result-390-${c.lang}`);
    // Exam: Home → Exam → Exam 1
    await tap(pg, '#screenResult .back-btn');
    await tap(pg, '#modeExam');
    await pg.locator('#examGrid .exam-btn[data-arg="1"]').tap(); await sleep(GUARD);
    log(await active(pg) === 'screenQuiz' && await pg.evaluate(() => state.mode) === 'exam', 'L', `${tag}: Exam 1 opened by taps`);
    const e0 = await pg.evaluate(() => state.questions[0].a);
    for (const p of e0) { await pg.locator(`#opt${p}`).tap(); await sleep(60); }
    await pg.locator('#flagBtn').tap(); await sleep(60);
    checkLegend(await legendInfo(pg, '#dotsMeta'), `${tag} Exam quiz`, [[W.a, W.u], [W.f]]);
    await iconAudit(pg, `${tag} Exam Q1`);
    if (c.width === 320 && c.font === 'large') await shot(pg, `L-exam-legend-320-${c.lang}-large`);
    const en = await pg.evaluate(() => state.questions.length);
    await pg.locator('#navDots button').nth(en - 1).tap(); await sleep(80);
    const sub = await pg.evaluate(() => ({ t: byId('nextBtn').textContent.trim(), q: byId('quickNext').querySelector('svg')?.dataset.iconName, ql: byId('quickNext').getAttribute('aria-label') }));
    log(sub.q === 'check' && !!sub.ql, 'L', `${tag}: Exam last Q quick ✓ = check icon "${sub.ql}", bottom "${sub.t}"`, sub);
    await iconAudit(pg, `${tag} Exam last`);
    await pg.locator('#quickNext').tap(); await sleep(300);
    const modal = await pg.evaluate(() => byId('confirmModal').classList.contains('show'));
    if (modal) {
      await iconAudit(pg, `${tag} Exam submit modal`);
      await pg.locator('#confirmOk').tap();
      await sleep(GUARD);
    }
    log(await active(pg) === 'screenResult', 'L', `${tag}: Exam Submit (unanswered → modal → OK) → result`, { modal });
    checkLegend(await legendInfo(pg, '#resultDotsMeta'), `${tag} Exam result`, [[W.c, W.u], [W.w, W.f]]);
    if (c.width === 360 && c.font === 'large') await shot(pg, `L-exam-result-360-${c.lang}-large`);
    log(!pg.errs.length && !pg.warns.length, 'L', `${tag}: no page errors`, [...pg.errs, ...pg.warns]);
    } catch (e) { log(false, 'RUN', `${tagOf(c)}: harness error ${e.message.split('\n')[0]}`); }
    await pg.ctx.close();
  }
  // Flagged list (390 en / 320 zh large): seed 3 flags → Home tile → list → start
  for (const c of [{ width: 390, height: 844, lang: 'en', font: 'small' }, { width: 320, height: 568, lang: 'zh-HK', font: 'large' }]) {
    const tag = tagOf(c);
    const pg = await newPage(c);
    await pg.evaluate(() => { const f = { '1.0': true, '1.1': true, '2.3': true }; localStorage.setItem('lifeuk.practiceFlags', JSON.stringify(f)); });
    await pg.reload(); await sleep(300);
    await tap(pg, '#modePractice');
    await tap(pg, '#tileFlagged');
    log(await active(pg) === 'screenFlagged', 'L', `${tag}: Flagged tile → list`);
    const fl = await pg.evaluate(() => { const g = document.querySelector('#flaggedStart .go'); return { i: g && [...g.querySelectorAll('svg')].map(s => s.dataset.iconName), t: g && g.textContent.trim() }; });
    log(fl.i && fl.i.join() === 'arrowRight' && fl.t === '', 'L', `${tag}: Flagged card arrow = arrowRight icon`, fl);
    await iconAudit(pg, `${tag} Flagged`);
    await shot(pg, `L-flagged-${c.width}-${c.lang}`);
    await tap(pg, '#flaggedStart');
    log(await active(pg) === 'screenQuiz', 'L', `${tag}: Practise flagged → quiz`);
    await pg.ctx.close();
  }
}

// ── P: plan screens + Home reset / install ──
const PLAN_TODAY = '2026-10-01', PLAN_START = '2026-09-28';
const PLAN_GOAL = { examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' };
async function sectionP() {
  const configs = [{ width: 390, height: 844, lang: 'en', font: 'small' }, { width: 320, height: 568, lang: 'zh-HK', font: 'large' },
    { width: 360, height: 640, lang: 'en', font: 'large' }, { width: 844, height: 390, lang: 'zh-HK', font: 'small' }];
  for (const c of configs) {
    const tag = tagOf(c);
    const pg = await newPage({ ...c, time: new Date(`${PLAN_TODAY}T09:00:00+01:00`) });
    try {
    // Home: install banner (beforeinstallprompt on a touch device), reset buttons
    await pg.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({}); window.dispatchEvent(e); });
    await sleep(100);
    const ib = await pg.evaluate(() => byId('installBanner').classList.contains('visible'));
    log(ib, 'P', `${tag}: install banner shown on beforeinstallprompt (touch)`);
    const ic = await pg.evaluate(() => { const b = document.querySelector('.install-close'); return { i: b.querySelector('svg')?.dataset.iconName, t: b.textContent.trim(), a: b.getAttribute('aria-label'), ti: b.getAttribute('title') }; });
    log(ic.i === 'close' && ic.t === '' && !!ic.a && ic.a === ic.ti, 'P', `${tag}: install ✕ = close icon named "${ic.a}"`, ic);
    // plan create card (no plan yet)
    await iconAudit(pg, `${tag} Home (banner + plan create card)`);
    if (c.width === 320) await shot(pg, `P-home-banner-320-${c.lang}-${c.font}`);
    await tap(pg, '.install-close', { guard: false });
    log(!(await pg.evaluate(() => byId('installBanner').classList.contains('visible'))), 'P', `${tag}: ✕ closes the banner`);
    // reset buttons (Practice mode, need some progress to show)
    await pg.evaluate(() => { localStorage.setItem('lifeuk.practiceStreak', JSON.stringify({ '1.0': 2 })); localStorage.setItem('lifeuk.completedExams', JSON.stringify([1])); });
    await pg.reload(); await sleep(300);
    await tap(pg, '#modePractice');
    const rp = await pg.evaluate(() => [...document.querySelectorAll('.reset-btn')].filter(b => b.getClientRects().length).map(b => ({ t: b.textContent.trim(), i: [...b.querySelectorAll('svg')].map(s => s.dataset.iconName) })));
    log(rp.length >= 1 && rp.every(r => r.i.join() === 'reset' && !/↺/.test(r.t)), 'P', `${tag}: Practice reset button(s) reset icon: ${rp.map(r => r.t).join(' / ')}`, rp);
    await iconAudit(pg, `${tag} Home practice`);
    if (rp.length) {
      await pg.locator('.reset-btn:visible').first().tap(); await sleep(300);
      await iconAudit(pg, `${tag} reset confirm modal`);
      const open = await pg.evaluate(() => byId('confirmModal').classList.contains('show'));
      log(open, 'P', `${tag}: Reset progress opens a confirm modal`);
      await pg.locator('#confirmCancel').tap(); await sleep(200);
    }
    await tap(pg, '#modeExam');
    const re = await pg.evaluate(() => [...document.querySelectorAll('.reset-btn')].filter(b => b.getClientRects().length).map(b => ({ t: b.textContent.trim(), i: [...b.querySelectorAll('svg')].map(s => s.dataset.iconName) })));
    log(re.every(r => r.i.join() === 'reset'), 'P', `${tag}: Exam reset completed: reset icon ${re.map(r => r.t).join('/')}`, re);
    await iconAudit(pg, `${tag} Home exam`);
    if (c.width === 390) await shot(pg, `P-home-exam-reset-390`);
    // plan goal: create card → goal → Build my plan
    await tap(pg, '#modePractice');
    const cta = await pg.locator('.plan-cta').count();
    if (cta) {
      await pg.locator('.plan-cta').scrollIntoViewIfNeeded();
      await tap(pg, '.plan-cta');
      log(await active(pg) === 'screenPlanGoal', 'P', `${tag}: plan create card → goal`);
      await iconAudit(pg, `${tag} Plan goal`);
      if (c.width === 320) await shot(pg, `P-goal-320-${c.lang}`);
    } else note('P', `${tag}: no plan create card on Home`);
    // seed the plan (Day 4 = today, like control-icons-test) and walk with taps
    await pg.evaluate(({ goal, start }) => { writeStudyPlan(buildPlan(goal, start)); writePlanLog({ v: 1, days: {} }); goHome(); }, { goal: PLAN_GOAL, start: PLAN_START });
    await sleep(GUARD);
    const cont = await pg.evaluate(() => { const b = document.querySelector('#screenHome [data-action="planContinue"]'); return b && { t: b.textContent.trim(), i: [...b.querySelectorAll('svg')].map(s => s.dataset.iconName) }; });
    log(!!cont && cont.i.join() === 'arrowRight', 'P', `${tag}: Home plan card "${cont && cont.t}" arrowRight`, cont);
    await iconAudit(pg, `${tag} Home plan card`);
    await pg.locator('#screenHome [data-action="openPlanSchedule"]').first().scrollIntoViewIfNeeded();
    await tap(pg, '#screenHome [data-action="openPlanSchedule"]');
    log(await active(pg) === 'screenPlanSchedule', 'P', `${tag}: → schedule`);
    await iconAudit(pg, `${tag} Plan schedule`);
    await pg.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight)); await sleep(100);
    if (c.width === 390) await shot(pg, 'P-schedule-bottom-390');
    await tap(pg, '#screenPlanSchedule [data-action="planAskReset"]', { guard: false }); await sleep(300);
    await iconAudit(pg, `${tag} Plan reset modal`);
    log(await pg.evaluate(() => byId('confirmModal').classList.contains('show')), 'P', `${tag}: Reset plan opens a confirm modal`);
    await pg.locator('#confirmCancel').tap(); await sleep(200);
    log(await pg.evaluate(() => !!planLoad()), 'P', `${tag}: Cancel on reset modal keeps the plan`);
    await tap(pg, '#screenPlanSchedule .plan-block[data-action="openPlanDay"]');
    log(await active(pg) === 'screenPlanDay', 'P', `${tag}: View today's tasks → day`);
    await iconAudit(pg, `${tag} Plan day (today)`);
    // day ‹ → back to today; calendar ‹ ›
    await tap(pg, '#planDayPrev', { guard: false }); await sleep(200);
    const bt = await pg.evaluate(() => { const b = byId('planBackToday'); return { hidden: b.hidden, i: [...b.querySelectorAll('svg')].map(s => s.dataset.iconName), t: b.textContent.trim() }; });
    log(!bt.hidden && bt.i.join() === 'arrowLeft', 'P', `${tag}: day ‹ → "Back to today" with arrowLeft`, bt);
    await iconAudit(pg, `${tag} Plan day (yesterday)`);
    if (c.width === 320) await shot(pg, `P-day-prev-320-${c.lang}`);
    await tap(pg, '#planBackToday', { guard: false }); await sleep(200);
    await tap(pg, '#planDayNext', { guard: false }); await sleep(200);
    await tap(pg, '#planDayPrev', { guard: false }); await sleep(200);
    await pg.locator('#planCalNext').scrollIntoViewIfNeeded();
    const dis = await pg.evaluate(() => ({ p: byId('planCalPrev').disabled, n: byId('planCalNext').disabled }));
    const [first, second] = dis.n ? ['#planCalPrev', '#planCalNext'] : ['#planCalNext', '#planCalPrev'];
    log(dis.p !== dis.n || (!dis.p && !dis.n), 'P', `${tag}: calendar arrows enabled state prev ${!dis.p} next ${!dis.n} (plan Sep 28 – Oct 29)`);
    const t0 = await pg.evaluate(() => byId('planCalTitle').textContent);
    await tap(pg, first, { guard: false }); await sleep(150);
    const t1 = await pg.evaluate(() => byId('planCalTitle').textContent);
    await iconAudit(pg, `${tag} Plan calendar (other month)`);
    await tap(pg, second, { guard: false }); await sleep(150);
    const t2 = await pg.evaluate(() => byId('planCalTitle').textContent);
    log(t0 !== t1 && t2 === t0, 'P', `${tag}: calendar › / ‹ change month (${t0} → ${t1} → ${t2})`);
    await iconAudit(pg, `${tag} Plan calendar`);
    // run: open the practice task, answer one wrong → redo
    const tasks = await pg.evaluate(iso => planLoad().days.find(d => d.date === iso).tasks.map(t => t.type), PLAN_TODAY);
    const pi = tasks.indexOf('practice'), ri = tasks.indexOf('read');
    await pg.evaluate(() => window.scrollTo(0, 0));
    await pg.locator('#planTaskList .plan-task-btn').nth(pi).scrollIntoViewIfNeeded();
    await pg.locator('#planTaskList .plan-task-btn').nth(pi).tap(); await sleep(GUARD);
    log(await active(pg) === 'screenQuiz', 'P', `${tag}: practice task → quiz`);
    const hb = await pg.evaluate(() => { const b = document.querySelector('#screenQuiz .back-btn'); return { t: b.textContent.trim(), i: [...b.querySelectorAll('svg')].map(s => s.dataset.iconName) }; });
    log(hb.i.join() === 'arrowLeft' && !/←/.test(hb.t), 'P', `${tag}: plan task header "${hb.t}" arrowLeft`, hb);
    // answer every question wrong-first-then-right? answer Q1 wrong, rest right, reach the end
    await answerAll(pg, { wrongAt: [0] });
    const last = await pg.evaluate(() => ({ t: byId('nextBtn').textContent.trim(), i: [...byId('nextBtn').querySelectorAll('svg')].map(s => s.dataset.iconName) }));
    await iconAudit(pg, `${tag} Plan run last Q`);
    note('P', `${tag}: plan practice last-Q button "${last.t}" icons ${last.i.join()}`);
    await pg.locator('#nextBtn').tap(); await sleep(GUARD);
    const scr = await active(pg);
    await iconAudit(pg, `${tag} Plan run after last (${scr})`);
    const redo = await pg.evaluate(() => { const b = byId('nextBtn'); return b && b.getClientRects().length ? { t: b.textContent.trim(), i: [...b.querySelectorAll('svg')].map(s => s.dataset.iconName) } : null; });
    log(scr === 'screenQuiz' && redo && redo.i.join() === 'arrowRight' && /^(Next round|下一輪|Next|下一題)$/.test(redo.t) || scr !== 'screenQuiz', 'P', `${tag}: after the last Q with a wrong answer: "${redo && redo.t}" (${redo && redo.i})`, redo);
    if (c.width === 390 || c.width === 320) await shot(pg, `P-run-after-${c.width}-${c.lang}`);
    // finish the redo round if in quiz
    if (scr === 'screenQuiz') { await answerAll(pg); await pg.locator('#nextBtn').tap(); await sleep(GUARD); }
    const s2 = await active(pg);
    await iconAudit(pg, `${tag} Plan after redo (${s2})`);
    // redo: every question right except one, which is answered wrong again → "Redo the wrong answer (1 left)" 🔁
    {
      const t = await pg.evaluate(iso => planLoad().days.find(d => d.date === iso).tasks, PLAN_TODAY);
      const [wk, ...rest] = t[pi].qids;
      await pg.evaluate(({ iso, ok, bad }) => { writePlanLog({ v: 1, days: { [iso]: { ok: Object.fromEntries(ok.map(k => [k, 1])), bad: { [bad]: 1 } } } }); openPlanDay(); }, { iso: PLAN_TODAY, ok: rest, bad: wk });
      await sleep(GUARD);
      await pg.locator('#planTaskList .plan-task-btn').nth(pi).scrollIntoViewIfNeeded();
      await pg.locator('#planTaskList .plan-task-btn').nth(pi).tap(); await sleep(GUARD);
      const q = await pg.evaluate(() => ({ a: state.questions[state.current].a, o: state.questions[state.current].o.length, n: state.questions.length }));
      const wrongPick = [...Array(q.o).keys()].filter(k => !q.a.includes(k)).slice(0, q.a.length);
      for (const p of wrongPick) { await pg.locator(`#opt${p}`).tap(); await sleep(60); }
      const rb = await pg.evaluate(() => ({ t: byId('nextBtn').textContent.trim(), i: [...byId('nextBtn').querySelectorAll('svg')].map(s => s.dataset.iconName), q: byId('quickNext').querySelector('svg')?.dataset.iconName, ql: byId('quickNext').getAttribute('aria-label') }));
      log(rb.i.join() === 'redo' && !/🔁/.test(rb.t) && /[(（](1|尚餘 1)/.test(rb.t), 'P', `${tag}: redo button "${rb.t}" = redo line icon (quick ${rb.q} "${rb.ql}")`, rb);
      await iconAudit(pg, `${tag} Plan redo`);
      if (c.width === 320) await shot(pg, `P-redo-320-${c.lang}`);
      await pg.locator('#nextBtn').tap(); await sleep(GUARD);
      const again = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, rev: state.current in state.revealed }));
      log(again.s === 'screenQuiz' && !again.rev, 'P', `${tag}: tap redo → the wrong question again, unanswered`, again);
      const a2 = await pg.evaluate(() => state.questions[state.current].a);
      for (const p of a2) { await pg.locator(`#opt${p}`).tap(); await sleep(60); }
      await iconAudit(pg, `${tag} Plan redo answered`);
      await pg.locator('#nextBtn').tap(); await sleep(GUARD);
      const fin = await active(pg);
      log(fin === 'screenPlanRun' || fin === 'screenPlanDay', 'P', `${tag}: redo done → ${fin}`);
      await iconAudit(pg, `${tag} Plan task done (${fin})`);
      if (c.width === 390) await shot(pg, 'P-task-done-390');
    }
    // reading task facts Prev / Next
    await pg.evaluate(({ iso, i }) => planOpenTask(iso, i), { iso: PLAN_TODAY, i: ri });
    await sleep(GUARD);
    log(await active(pg) === 'screenPlanRun', 'P', `${tag}: reading task → run (facts)`);
    await iconAudit(pg, `${tag} Plan facts`);
    const nx = pg.locator('#planRunBody [data-action="planStepFact"][data-arg="1"]');
    if (await nx.count()) { await nx.scrollIntoViewIfNeeded(); await nx.tap(); await sleep(150); await iconAudit(pg, `${tag} Plan facts 2`); }
    if (c.width === 320) await shot(pg, `P-facts-320-${c.lang}`);
    log(!pg.errs.length && !pg.warns.length, 'P', `${tag}: no page errors`, [...pg.errs, ...pg.warns]);
    const em = await controlEmoji(pg);
    if (em.length) note('P', `${tag}: emoji on controls (plan facts screen): ${em.join(', ')}`);
    } catch (e) { log(false, 'RUN', `P ${tagOf(c)}: harness error ${e.message.split('\n')[0]}`); }
    await pg.ctx.close();
  }
  // emoji still on controls across main screens (report inventory)
  const pg = await newPage({ width: 390, height: 844 });
  const inv = new Set();
  for (const step of [async () => {}, async () => tap(pg, '#modePractice'), async () => tap(pg, '#modeExam'), async () => { await tap(pg, '#modeStudy'); }]) {
    await step();
    (await controlEmoji(pg)).forEach(x => inv.add(x));
  }
  for (const tab of TABS) { await tap(pg, `.study-tab[data-tab="${tab}"]`, { guard: false }); (await controlEmoji(pg)).forEach(x => inv.add(x)); }
  note('P', 'emoji / ⓘ still on visible controls (Home / Study): ' + [...inv].join(' ; '));
  await pg.ctx.close();
}

// ── O: offline + SW upgrade v1.6.0 → v1.6.1 ──
function copyApp(fromRoot, dest) {
  for (const f of appFiles(fromRoot)) execSync(`cp -r "${path.join(fromRoot, f)}" "${dest}/"`);
}
async function sectionO() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa161-'));
  const old = path.join(tmp, 'old');
  execSync(`git -C "${ROOT}" worktree add --detach "${old}" f55a945 -q`);
  const site = path.join(tmp, 'site');
  fs.mkdirSync(site);
  copyApp(old, site);
  const s = await startPagesServer(site);
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Europe/London' });
    const pg = await ctx.newPage();
    const errs = [];
    pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(s.base + 'index.html');
    await pg.evaluate(() => navigator.serviceWorker.ready);
    await pg.reload(); await sleep(500);
    const v0 = await pg.evaluate(() => ({ v: APP_VERSION, ctrl: !!navigator.serviceWorker.controller, caches: null }));
    v0.caches = await pg.evaluate(() => caches.keys());
    log(v0.v === '1.6.0' && v0.ctrl, 'O', `v1.6.0 installed with SW controlling (caches ${v0.caches.join(',')})`, v0);
    await pg.evaluate(() => localStorage.setItem('lifeuk.uiLang', JSON.stringify('en')));
    // deploy v1.6.1 (wait out the HTTP max-age only for sw.js / config, which the app fetches with updateViaCache none)
    execSync(`rm -rf "${site}"/* && true`);
    copyApp(ROOT, site);
    // the app checks for updates on resume / load: reload until the new version runs
    let v = null;
    for (let k = 0; k < 8; k++) {
      await pg.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r && r.update())).catch(() => {});
      await sleep(1200);
      await pg.reload().catch(() => {}); await sleep(800);
      v = await pg.evaluate(() => typeof APP_VERSION !== 'undefined' ? APP_VERSION : null).catch(() => null);
      if (v === '1.6.1') break;
    }
    const keys = await pg.evaluate(() => caches.keys());
    log(v === '1.6.1' && keys.includes('lifeuk-v1.6.1') && !keys.includes('lifeuk-v1.6.0'), 'O', `SW upgrade → APP_VERSION ${v}, caches ${keys.join(',')}`, { v, keys });
    const shellOk = await pg.evaluate(async () => {
      const c = await caches.open('lifeuk-v1.6.1');
      const sw = await (await fetch('sw.js')).text();
      const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
      const missing = [];
      for (const f of shell) if (!(await c.match(f))) missing.push(f);
      const idx = await (await c.match('./index.html') || await c.match('index.html')).text();
      return { n: shell.length, missing, newIdx: idx.includes('study-top') && idx.includes('data-icon="arrowLeft"') };
    });
    log(!shellOk.missing.length && shellOk.newIdx, 'O', `new cache holds all ${shellOk.n} SHELL files and the v1.6.1 index.html`, shellOk);
    // offline
    await ctx.setOffline(true);
    await pg.reload(); await sleep(800);
    const off = await pg.evaluate(() => ({ v: APP_VERSION, studyTop: !!document.querySelector('.study-top'), qp: byId('quickPrev').querySelector('svg')?.dataset.iconName }));
    log(off.v === '1.6.1' && off.studyTop && off.qp === 'arrowLeft', 'O', 'offline reload: v1.6.1 shell from cache (study-top, quickPrev icon)', off);
    await pg.locator('#modeStudy').tap(); await sleep(GUARD);
    await pg.evaluate(() => window.scrollTo(0, 1500)); await sleep(150);
    const g = await studyGeom(pg);
    log(Math.abs(g.block.top - g.header) <= 1, 'O', 'offline: Study pinned block works');
    await pg.evaluate(() => window.scrollTo(0, 0));
    await pg.locator('.study-tab[data-tab="memo"]').tap(); await sleep(200);
    await pg.locator('#studyContent .memo-card[data-arg="vote"]').tap(); await sleep(GUARD);
    await pg.locator('#memoBody .memo-start').tap(); await sleep(GUARD);
    const mh = await pg.evaluate(() => document.querySelector('#screenQuiz .back-btn').textContent.trim());
    log(mh === 'Memory', 'O', 'offline: memo test header "‹ Memory"');
    await shot(pg, 'O-offline-memo-test');
    log(!errs.length, 'O', 'SW upgrade + offline: no page errors', errs);
    await ctx.close();
  } finally {
    s.server.kill();
    execSync(`git -C "${ROOT}" worktree remove --force "${old}"`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ── X: old v1.6.0 index.html + v1.6.1 scripts (mixed shell) ──
async function sectionX() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa161x-'));
  copyApp(ROOT, tmp);
  execSync(`git -C "${ROOT}" show f55a945:index.html > "${tmp}/index.html"`);
  const s = await startPagesServer(tmp);
  try {
    for (const c of [{ width: 390, height: 844, lang: 'en', font: 'small' }, { width: 320, height: 568, lang: 'zh-HK', font: 'large' }]) {
      const tag = 'old-shell ' + tagOf(c);
      const pg = await newPage({ ...c, url: s.base + 'index.html', time: new Date(`${PLAN_TODAY}T09:00:00+01:00`) });
      const st = await pg.evaluate(() => ({
        v: APP_VERSION, studyTop: !!document.querySelector('.study-top'),
        qp: byId('quickPrev').querySelector('svg')?.dataset.iconName, qpText: byId('quickPrev').textContent.trim(),
        close: document.querySelector('.install-close').querySelector('svg')?.dataset.iconName, closeText: document.querySelector('.install-close').textContent.trim(),
        prev: [...byId('prevBtn').querySelectorAll('svg')].map(s => s.dataset.iconName), prevText: byId('prevBtn').textContent.trim(),
        resets: [...document.querySelectorAll('.reset-btn')].map(b => ({ t: b.textContent.trim(), i: [...b.querySelectorAll('svg')].map(s => s.dataset.iconName) })),
        memoBack: (b => ({ t: b.textContent.trim(), i: [...b.querySelectorAll('svg')].map(s => s.dataset.iconName) }))(document.querySelector('#screenMemo .memo-back')),
        planArrows: ['planDayPrev', 'planDayNext', 'planCalPrev', 'planCalNext'].map(id => byId(id) && (byId(id).querySelector('svg')?.dataset.iconName || 'TEXT:' + byId(id).textContent)),
        backToday: (b => b && { t: b.textContent.trim(), i: [...b.querySelectorAll('svg')].map(s => s.dataset.iconName) })(byId('planBackToday')),
        viewToday: (b => b && { t: b.textContent.trim(), i: [...b.querySelectorAll('svg')].map(s => s.dataset.iconName) })(document.querySelector('#screenPlanSchedule .plan-block[data-action="openPlanDay"]')),
      }));
      log(st.v === '1.6.1' && !st.studyTop, 'X', `${tag}: v1.6.0 index.html running v1.6.1 scripts (no .study-top)`, st);
      log(st.qp === 'arrowLeft' && st.qpText === '' && st.close === 'close' && st.closeText === '', 'X', `${tag}: quick Prev / install ✕ upgraded to icons`, st);
      log(st.prev.join() === 'arrowLeft' && st.resets.every(r => r.i.join() === 'reset' && r.t && !/↺/.test(r.t)) && st.memoBack.i.join() === 'chevronLeft' && !/‹/.test(st.memoBack.t), 'X', `${tag}: Prev / resets / memo back: icon + words`, st);
      log(st.planArrows.join() === 'chevronLeft,chevronRight,chevronLeft,chevronRight' && st.backToday.i.join() === 'arrowLeft' && st.viewToday.i.join() === 'arrowRight', 'X', `${tag}: plan ‹ › / Back to today / View today icons`, st);
      // words filled (not empty, no raw keys)
      const words = [st.prevText, st.memoBack.t, st.backToday.t, st.viewToday.t, ...st.resets.map(r => r.t)];
      log(words.every(w => w && !/\b(quiz|memo|plan|home)\.[a-z]/.test(w)), 'X', `${tag}: words filled: ${words.join(' / ')}`);
      await iconAudit(pg, `${tag} Home`);
      // walk: Study (5 tabs), memo test ‹ Memory, Practice quiz legend, language switch
      await tap(pg, '#modeStudy');
      for (const tab of TABS) { await tap(pg, `.study-tab[data-tab="${tab}"]`, { guard: false }); await pg.evaluate(() => window.scrollTo(0, 800)); await sleep(80); }
      await pg.evaluate(() => window.scrollTo(0, 0));
      await iconAudit(pg, `${tag} Study`);
      await tap(pg, '.study-tab[data-tab="memo"]', { guard: false });
      await tap(pg, '#studyContent .memo-card[data-arg="vote"]');
      await tap(pg, '#memoBody .memo-start');
      const mh = await pg.evaluate(() => { const b = document.querySelector('#screenQuiz .back-btn'); return { t: b.textContent.trim(), i: [...b.querySelectorAll('svg')].map(s => s.dataset.iconName) }; });
      log(/^(Memory|記憶法)$/.test(mh.t) && mh.i.join() === 'chevronLeft', 'X', `${tag}: memo test header ‹ Memory`, mh);
      await tap(pg, '#screenQuiz .back-btn');
      log(await active(pg) === 'screenMemo', 'X', `${tag}: ‹ Memory → group`);
      await tap(pg, '#screenMemo .memo-back');
      await tap(pg, '#screenStudy .back-btn');
      await tap(pg, '#modePractice');
      await pg.locator('#diffGrid button').first().tap(); await sleep(GUARD);
      const a = await pg.evaluate(() => state.questions[0].a);
      for (const p of a) { await pg.locator(`#opt${p}`).tap(); await sleep(60); }
      const L = await legendInfo(pg, '#dotsMeta');
      log(L && L.rows.length === 2, 'X', `${tag}: practice legend 2 rows`, L);
      await iconAudit(pg, `${tag} Practice revealed`);
      // switch language via ⚙ (real taps)
      await tap(pg, '#settingsBtn', { guard: false }); await sleep(150);
      await pg.locator(`#settingsPop [data-action="chooseLang"][data-arg="${c.lang === 'en' ? 'zh-HK' : 'en'}"]`).tap(); await sleep(250);
      await pg.keyboard.press('Escape');
      const after = await pg.evaluate(() => ({ prev: byId('prevBtn').textContent.trim(), pi: [...byId('prevBtn').querySelectorAll('svg')].map(s => s.dataset.iconName), qp: byId('quickPrev').getAttribute('aria-label') }));
      log(after.pi.join() === 'arrowLeft' && !!after.prev && !!after.qp, 'X', `${tag}: after language switch Prev "${after.prev}" keeps icon, quickPrev named "${after.qp}"`, after);
      if (c.width === 320) await shot(pg, 'X-old-shell-practice-320');
      log(!pg.errs.length && !pg.warns.length, 'X', `${tag}: no page errors`, [...pg.errs, ...pg.warns]);
      await pg.ctx.close();
    }
  } finally {
    s.server.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

(async () => {
  browser = await chromium.launch(launchOpts);
  ({ base, server } = await startPagesServer(ROOT));
  try {
    if (want('S')) await sectionS();
    if (want('M')) await sectionM();
    if (want('L')) await sectionL();
    if (want('P')) await sectionP();
    if (want('O')) await sectionO();
    if (want('X')) await sectionX();
  } catch (e) {
    log(false, 'RUN', 'script error: ' + e.stack);
  }
  server.kill();
  await browser.close();
  if (res.pinPct) console.log('PIN%', JSON.stringify(res.pinPct));
  console.log(`\n${res.filter(r => r.ok).length} / ${res.length} ok`);
  if (findings.length) console.log('FINDINGS\n' + findings.join('\n'));
  if (obs.length) console.log('NOTES\n' + obs.join('\n'));
})();
