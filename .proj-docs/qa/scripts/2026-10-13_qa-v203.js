// QA v2.0.3 — what is new since the v1.6.1 QA at f8d9d67: v2.0.0–v2.0.2 desktop / tablet layout merged with the v1.6.1
// batch, CUI-0036 (tall fact card top under the pinned block / under the desktop panel fade after ▶ Practise → ↩ Back),
// CUI-0035 (header ⓘ + 💡 memory note chevron are line icons), CUI-0033 (main: quiz panes back at the top after an
// unanswered-dot jump). Real clicks (desktop) / real taps + CDP touch drags (phone), repo served over http.
//   D  desktop / tablet landscape: 1024×768, 1280×800, 1440×900 × en / zh-HK × small / large (+ 1024×768 touch tablet):
//      Home (ⓘ popover), Study rail × 5 tabs (memo 3 columns), memory note chevron, fact ▶ → ↩ (panel offset kept;
//      tall card realigned under the fade), memo flow (‹ Memory mid-way records nothing, finish → result), Practice
//      (two-row legend in the dots bar, Answer / Similar tabs, Finish → result), Exam (rail one count per line, Submit
//      words → modal → result), plan screens; icon audit (no glyph incl. ⓘ ▸ ▾) on every screen
//   F  phone regression 390×844 / 320×568 × en / zh-HK large (+ 390 en small): pinned block + one-line chip swipe,
//      CUI-0036 tall card return, ⓘ open / Esc / outside tap, memory note chevron rotate, memo exit, legend, icons
//   B  breakpoint crossing 390 → 1280 → 390 on Study (pinned / scrolled) / quiz / memo look / memo test
//   C  CUI-0033 × memo exit / Similar side session Back (desktop)
//   O  SW upgrade v2.0.2 (main c6b0806) → v2.0.3, offline phone + desktop
//   X  old cached shells (v1.6.0 f55a945, v2.0.2 c6b0806 index.html) + v2.0.3 scripts, phone + desktop
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium node 2026-10-13_qa-v203.js [D F B C O X]
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../../..');
const { startPagesServer, appFiles } = require(path.join(ROOT, 'tests/pages-server.js'));
const SHOTS = path.join(__dirname, '../screenshots/v203');
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
  if (!ok) findings.push(id + ' ' + m + (extra !== undefined ? ' ' + JSON.stringify(extra).slice(0, 1500) : ''));
  console.log((ok ? 'ok   ' : 'FAIL ') + id + ' ' + m + (extra !== undefined && !ok ? ' ' + JSON.stringify(extra).slice(0, 900) : ''));
};
const note = (id, m) => { obs.push(id + ' ' + m); console.log('note ' + id + ' ' + m); };
const NOON = new Date('2026-10-13T12:00:00+01:00');
// glyphs that must not be a control's icon (v1.6.1 ④⑥ + CUI-0035 ⓘ ▸ ▾)
const GLYPH_RE = /[←-⇿✓-✘✕▶◀▸◂▾▴▹◃‹›«»↺↻⟲⟳ⓘℹ\u{1F501}\u{1F504}➔➜➡⬅⮕⏎]/u;
// .t-icon: the Home review tiles' mark, checked on its own (F-1 / CUI-0037: the Wrong answers tile's ✗)
const STATUS_PARTS = '.plan-pill, .plan-task-ic, .plan-day-ic, .plan-task-st, .memo-badge, .t-icon';
const TABS = ['chapters', 'timeline', 'geo', 'people', 'memo'];
const DESK_VP = [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }];
const PLAN_TODAY = '2026-10-13', PLAN_START = '2026-09-28'; // NOON's date
const PLAN_GOAL = { examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' };

let base, server, browser;

async function newPage({ width = 390, height = 844, lang = 'en', font = 'small', trans = 'on', url, sw = 'block', time = NOON, touch = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1,
    timezoneId: 'Europe/London', serviceWorkers: sw });
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
  await pg.waitForSelector('#screenHome.active');
  pg.ctx = ctx;
  pg.touch = touch;
  pg.cdp = await ctx.newCDPSession(pg);
  return pg;
}
const active = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
// a tap on touch pages, a real mouse click otherwise
async function hit(pg, sel, { guard = true, nth = 0 } = {}) {
  const loc = pg.locator(sel).nth(nth);
  try {
    if (pg.touch) await loc.tap({ timeout: 8000 }); else await loc.click({ timeout: 8000 });
  } catch (e) { throw new Error('hit ' + sel + ': ' + e.message.split('\n')[0]); }
  if (guard) await sleep(GUARD);
}
async function swipe(pg, x, y, dx, dy) {
  const steps = Math.max(4, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 10));
  const pt = (type, k) => pg.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x + dx * k / steps), y: Math.round(y + dy * k / steps) }] });
  await pt('touchStart', 0);
  for (let k = 1; k <= steps; k++) await pt('touchMove', k);
  await pt('touchEnd', steps);
  await sleep(250);
}
const shot = (pg, name) => pg.screenshot({ path: path.join(SHOTS, name + '.png') });
const tagOf = c => `${c.width}x${c.height} ${c.lang} ${c.font}${c.touch && c.width >= 1024 ? ' touch' : ''}`;
const noErrors = (pg, id, tag) => log(!pg.errs.length && !pg.warns.length, id, `${tag}: no page errors / console errors`, [...pg.errs, ...pg.warns]);

// ── icon audit: every visible control (buttons, role=button, summary) on the active screen + header / modal / popovers ──
async function iconAudit(pg, id, tag) {
  const bad = await pg.evaluate(({ re, status }) => {
    const GL = new RegExp(re, 'u');
    const out = [];
    const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden'; };
    const scope = [...document.querySelectorAll('.screen.active button, .screen.active [role="button"], .screen.active summary, header button, #confirmModal.show button, #installBanner button, .info-pop.show button')];
    for (const b of scope) {
      if (!vis(b)) continue;
      const c = b.cloneNode(true);
      c.querySelectorAll(status).forEach(s => s.remove());
      const txt = c.textContent.replace(/\s+/g, ' ').trim();
      const nm = b.id || (b.className && String(b.className).split(' ')[0]) || b.dataset.action || b.tagName;
      if (GL.test(txt)) out.push({ id: nm, glyph: txt.slice(0, 40) });
      for (const pseudo of ['::before', '::after']) {
        const ct = getComputedStyle(b, pseudo).content;
        if (ct && ct !== 'none' && ct !== 'normal' && GL.test(ct)) out.push({ id: nm, pseudoGlyph: pseudo + ' ' + ct });
      }
      const name = (b.getAttribute('aria-label') || '').trim() || txt || (b.getAttribute('title') || '').trim();
      if (!name && b.getAttribute('aria-hidden') !== 'true') out.push({ id: nm, noName: true }); // aria-hidden pointer-only (plan ‹ ›) by design
      const icons = [...b.querySelectorAll('svg.line-icon')];
      const br = b.getBoundingClientRect();
      if ((br.right > innerWidth + 0.5 || br.left < -0.5) && !b.closest('.chip-row, .plan-day-scroll')) out.push({ id: nm, offscreen: [br.left, br.right] });
      for (const i of icons) {
        if (i.getAttribute('aria-hidden') !== 'true') out.push({ id: nm, iconNotHidden: i.dataset.iconName });
        const ir = i.getBoundingClientRect();
        if (!ir.width) continue;
        if (ir.left < br.left - 0.5 || ir.right > br.right + 0.5 || ir.top < br.top - 0.5 || ir.bottom > br.bottom + 0.5) out.push({ id: nm, iconOut: i.dataset.iconName });
        if (!txt) {
          const dx = Math.abs((ir.left + ir.right) / 2 - (br.left + br.right) / 2), dy = Math.abs((ir.top + ir.bottom) / 2 - (br.top + br.bottom) / 2);
          if (dx > 1.5 || dy > 1.5) out.push({ id: nm, iconOnlyOffCentre: i.dataset.iconName, dx: +dx.toFixed(1), dy: +dy.toFixed(1) });
        }
      }
      if (!icons.length && !txt && !b.querySelector('svg')) out.push({ id: nm, emptyNoIcon: true });
      const lab = b.querySelector('.icon-label');
      if (lab && lab.getClientRects().length && lab.scrollWidth > lab.clientWidth + 1 && getComputedStyle(lab).display !== 'inline') out.push({ id: nm, labelClipped: true });
    }
    if (document.scrollingElement.scrollWidth > innerWidth + 0.5) out.push({ hScroll: document.scrollingElement.scrollWidth });
    return out;
  }, { re: GLYPH_RE.source, status: STATUS_PARTS });
  log(!bad.length, id, `${tag}: icon audit (no glyph incl. ⓘ ▸ ▾ / pseudo content, name, icon inside + centred, no h-scroll)`, bad);
  return bad;
}
const pageStill = pg => pg.evaluate(() => { const e = document.scrollingElement; return { ok: e.scrollHeight <= e.clientHeight + 1, sh: e.scrollHeight, ch: e.clientHeight }; });
const noHScroll = pg => pg.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 0.5);
// every control under .screen.active can be brought on screen and is not covered (tests/desktop-helpers.js controlsReachable)
const dtHelpers = require(path.join(ROOT, 'tests/desktop-helpers.js'));

// the visible "next" control: the bottom #nextBtn on a phone, the card's quick button on desktop (#screenQuiz > .nav-row hidden)
const nextSel = pg => pg.evaluate(() => byId('nextBtn').getClientRects().length ? '#nextBtn' : '#quickNext');
const hitNext = async (pg, opts) => hit(pg, await nextSel(pg), opts);
const nextInfo = pg => pg.evaluate(() => {
  const b = byId('nextBtn').getClientRects().length ? byId('nextBtn') : byId('quickNext');
  return { id: b.id, t: (b.textContent.trim() || b.getAttribute('aria-label') || '').trim(), i: [...b.querySelectorAll('svg')].map(s => s.dataset.iconName) };
});
// answer every question with real taps / clicks (wrongAt: wrong first pick), Next after each except the last
async function answerAll(pg, { wrongAt = [] } = {}) {
  for (let guard = 0; guard < 60; guard++) {
    const q = await pg.evaluate(() => ({ i: state.current, n: state.questions.length, a: state.questions[state.current].a, o: state.questions[state.current].o.length, rev: state.current in state.revealed, mode: state.mode }));
    if (!q.rev || q.mode === 'exam') {
      const picks = wrongAt.includes(q.i) ? [...Array(q.o).keys()].filter(k => !q.a.includes(k)).slice(0, q.a.length) : q.a;
      for (const p of picks) await hit(pg, `#opt${p}`, { guard: false });
      await sleep(60);
    }
    if (q.i === q.n - 1) return;
    await hitNext(pg, { guard: false });
    await sleep(80);
  }
}
async function answerCurrent(pg, wrong = false) {
  const q = await pg.evaluate(() => ({ a: state.questions[state.current].a, o: state.questions[state.current].o.length }));
  const picks = wrong ? [...Array(q.o).keys()].filter(k => !q.a.includes(k)).slice(0, q.a.length) : q.a;
  for (const p of picks) await hit(pg, `#opt${p}`, { guard: false });
  await sleep(120);
}
const legendRows = (pg, sel) => pg.evaluate(sel => {
  const m = document.querySelector(sel);
  if (!m || !m.getClientRects().length) return null;
  const rows = [...m.querySelectorAll('.lg-row')].map(r => ({ text: r.textContent.replace(/\s+/g, ' ').trim(), n: r.getClientRects().length, h: r.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(r).lineHeight) || 20, display: getComputedStyle(r).display }));
  const entries = [...m.querySelectorAll('.lg-row > span:not(.sep)')].map(e => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), top: Math.round(r.top), right: r.right, h: r.height }; });
  return { rows, entries, overflow: m.scrollWidth > m.clientWidth + 1, right: m.getBoundingClientRect().right };
}, sel);

// ── ⓘ popover: open / Esc (focus back) / open / outside click or tap closes ──
async function infoPopoverCheck(pg, id, tag) {
  const st = () => pg.evaluate(() => ({ open: byId('infoPop').classList.contains('show'), exp: byId('infoBtn').getAttribute('aria-expanded'), btnOpen: byId('infoBtn').classList.contains('open'),
    focus: document.activeElement && document.activeElement.id, svg: byId('infoBtn').querySelector('svg')?.dataset.iconName, txt: byId('infoBtn').textContent.trim(), label: byId('infoBtn').getAttribute('aria-label'),
    stroke: (() => { const s = byId('infoBtn').querySelector('svg'); return s ? getComputedStyle(s).stroke : null; })() }));
  const s0 = await st();
  log(s0.svg === 'info' && s0.txt === '' && !!s0.label && !s0.open && s0.exp === 'false', id, `${tag}: header ⓘ = info line icon, no glyph text, named "${s0.label}", closed`, s0);
  await hit(pg, '#infoBtn', { guard: false }); await sleep(350);
  const s1 = await st();
  log(s1.open && s1.exp === 'true' && s1.btnOpen, id, `${tag}: ⓘ opens the about popover (aria-expanded true)`, s1);
  if (tag.includes('390x844 en large') || tag.includes('1280x800 zh-HK large')) await shot(pg, `${id}-info-open-${tag.replace(/[^a-zA-Z0-9-]+/g, '_')}`);
  await pg.keyboard.press('Escape'); await sleep(200);
  const s2 = await st();
  log(!s2.open && s2.exp === 'false' && s2.focus === 'infoBtn', id, `${tag}: Esc closes it, focus back on ⓘ`, s2);
  await hit(pg, '#infoBtn', { guard: false }); await sleep(300);
  const s3 = await st();
  // outside: a point in the screen below the popover
  const pt = await pg.evaluate(() => { const p = byId('infoPop').getBoundingClientRect(); return { x: Math.min(innerWidth - 10, Math.max(10, innerWidth / 2)), y: Math.min(innerHeight - 10, p.bottom + 40) }; });
  if (pg.touch) await pg.touchscreen.tap(pt.x, pt.y); else await pg.mouse.click(pt.x, pt.y);
  await sleep(300);
  const s4 = await st();
  log(s3.open && !s4.open && s4.exp === 'false', id, `${tag}: re-open, then ${pg.touch ? 'tap' : 'click'} outside closes it`, { s3, s4 });
  // the outside click must not have navigated
  return s4;
}

// ── memory note expander: the chevron line icon rotates 90° open, back closed ──
async function memNoteCheck(pg, id, tag, scrollPanel) {
  const found = await pg.evaluate(() => {
    const d = document.querySelector('#studyContent .fact-mem');
    return !!d;
  });
  if (!found) { note(id, `${tag}: no .fact-mem in the current list`); return; }
  await pg.evaluate(sp => {
    const d = document.querySelector('#studyContent .fact-mem');
    if (sp) { const p = byId('studyContent'); p.scrollTop += d.getBoundingClientRect().top - p.getBoundingClientRect().top - 120; }
    else window.scrollBy(0, d.getBoundingClientRect().top - innerHeight / 2);
  }, scrollPanel);
  await sleep(200);
  const read = () => pg.evaluate(() => {
    const d = document.querySelector('#studyContent .fact-mem'), s = d.querySelector('summary'), i = s.querySelector('svg');
    const ir = i.getBoundingClientRect(), lr = s.querySelector('span').getBoundingClientRect();
    return { open: d.open, icon: i.dataset.iconName, hidden: i.getAttribute('aria-hidden'), tf: getComputedStyle(i).transform, before: getComputedStyle(s, '::before').content,
      txt: s.textContent.trim(), dy: +Math.abs((ir.top + ir.bottom) / 2 - (lr.top + lr.bottom) / 2).toFixed(1), h: s.getBoundingClientRect().height, fill: getComputedStyle(i).fill };
  });
  const r0 = await read();
  log(r0.icon === 'chevronRight' && r0.hidden === 'true' && !r0.open && (r0.tf === 'none' || r0.tf === 'matrix(1, 0, 0, 1, 0, 0)') && (r0.before === 'none' || r0.before === 'normal') && !GLYPH_RE.test(r0.txt) && r0.dy <= 1.5, id, `${tag}: 💡 memory note summary: chevronRight line icon, no ▸ glyph / ::before, centred on the words (Δ${r0.dy}px, row ${Math.round(r0.h)}px)`, r0);
  await hit(pg, '#studyContent .fact-mem summary', { guard: false }); await sleep(450);
  const r1 = await read();
  log(r1.open && /^matrix\((6\.1\d*e-17|-?0|[-\d.e]+), 1, -1, (6\.1\d*e-17|-?0|[-\d.e]+), 0, 0\)$/.test(r1.tf), id, `${tag}: tap / click opens it, chevron turned 90° (${r1.tf})`, r1);
  if (tag.includes('390x844 zh-HK large') || tag.includes('1280x800 en small')) await shot(pg, `${id}-memnote-open-${tag.replace(/[^a-zA-Z0-9-]+/g, '_')}`);
  await hit(pg, '#studyContent .fact-mem summary', { guard: false }); await sleep(450);
  const r2 = await read();
  log(!r2.open && (r2.tf === 'none' || r2.tf === 'matrix(1, 0, 0, 1, 0, 0)'), id, `${tag}: second tap closes it, chevron back`, r2);
}

// ── memo flow (desktop + phone): open group, start, leave mid-way, finish → result ──
async function memoFlow(pg, id, tag, { desk }) {
  await hit(pg, '.study-tab[data-tab="memo"]', { guard: false }); await sleep(250);
  const grid = await pg.evaluate(() => {
    const g = document.querySelector('#studyContent .memo-grid');
    const cards = [...g.querySelectorAll('.memo-card')];
    const rows = {};
    cards.forEach(cd => { const t = Math.round(cd.getBoundingClientRect().top); (rows[t] = rows[t] || []).push(cd); });
    const out = cards.filter(cd => { const r = cd.getBoundingClientRect(), p = byId('studyContent').getBoundingClientRect(); return r.right > p.right + 0.5 || r.left < p.left - 0.5; }).length;
    return { cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, n: cards.length, rowSizes: Object.values(rows).map(r => r.length), out };
  });
  const cols = desk ? 3 : 2;
  const full = grid.rowSizes.slice(0, -1).every(s => s === cols) && grid.rowSizes[grid.rowSizes.length - 1] <= cols;
  log(grid.cols === cols && grid.n === 62 && full && !grid.out, id, `${tag}: memo list ${cols}-column grid, 62 cards, rows of ${cols}, inside the panel`, { cols: grid.cols, n: grid.n, rows: grid.rowSizes.join(''), out: grid.out });
  if (desk) {
    const still = await pageStill(pg);
    log(still.ok, id, `${tag}: memo tab page one screen high`, still);
  }
  await pg.locator('#studyContent .memo-card[data-arg="vote"]').scrollIntoViewIfNeeded();
  await hit(pg, '#studyContent .memo-card[data-arg="vote"]');
  log(await active(pg) === 'screenMemo', id, `${tag}: memo card → ① look`);
  await iconAudit(pg, id, `${tag} memo look`);
  if (desk) {
    const reach = await dtHelpers.controlsReachable(pg);
    log(reach.ok, id, `${tag}: memo look every control reachable (${reach.detail})`, reach);
  }
  await pg.locator('#memoBody .memo-start').scrollIntoViewIfNeeded();
  await hit(pg, '#memoBody .memo-start');
  const qh = await pg.evaluate(() => { const b = document.querySelector('#screenQuiz .back-btn'); return { s: document.querySelector('.screen.active').id, t: b.textContent.trim(), i: [...b.querySelectorAll('svg')].map(s => s.dataset.iconName), aria: b.getAttribute('aria-label') }; });
  log(qh.s === 'screenQuiz' && /^(Memory|記憶法)$/.test(qh.t) && qh.i.join() === 'chevronLeft' && !qh.aria, id, `${tag}: memo test header "‹ ${qh.t}" chevron line icon, no 🏠`, qh);
  const before = await pg.evaluate(() => localStorage.getItem('lifeuk.memoProgress'));
  await answerCurrent(pg); await hitNext(pg, { guard: false }); await sleep(100);
  await answerCurrent(pg, true);
  await iconAudit(pg, id, `${tag} memo test Q2 revealed`);
  if (desk) {
    const L = await legendRows(pg, '#dotsMeta');
    log(L && L.rows.length === 2 && L.rows.every(r => r.n === 1 && r.h < r.lh * 1.6 + 4) && !L.overflow, id, `${tag}: memo test legend two rows ${L && L.rows.map(r => '"' + r.text + '"').join(' / ')}`, L);
  }
  await hit(pg, '#screenQuiz .back-btn');
  const left = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, step: memoView.step, id: memoView.id, prog: localStorage.getItem('lifeuk.memoProgress'), ret: sessionReturn }));
  log(left.s === 'screenMemo' && left.step === 'look' && left.id === 'vote' && left.prog === before && left.ret === null, id, `${tag}: ‹ Memory mid-test → same group look, nothing recorded, session cleared`, left);
  await pg.locator('#memoBody .memo-start').scrollIntoViewIfNeeded();
  await hit(pg, '#memoBody .memo-start');
  await answerAll(pg, { wrongAt: [1] });
  await hitNext(pg);
  const done = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, step: memoView.step, prog: JSON.parse(localStorage.getItem('lifeuk.memoProgress') || 'null') }));
  log(done.s === 'screenMemo' && done.step === 'result' && done.prog && done.prog.vote && done.prog.vote.lv === 1, id, `${tag}: finished test → result, recorded once (Lv1)`, done);
  await iconAudit(pg, id, `${tag} memo result`);
  if (desk) {
    const still = await pageStill(pg);
    log(still.ok && await noHScroll(pg), id, `${tag}: memo result one screen high, no sideways scroll`, still);
  }
  if (/1280x800 zh-HK large|390x844 en large/.test(tag)) await shot(pg, `${id}-memo-result-${tag.replace(/[^a-zA-Z0-9-]+/g, '_')}`);
  await hit(pg, '#screenMemo .memo-back');
  log(await active(pg) === 'screenStudy', id, `${tag}: ‹ Memory on the group → Study`);
}

// ════════════════ D: desktop / tablet landscape ════════════════
async function deskStudyTab(pg, tag, tab) {
  await hit(pg, `.study-tab[data-tab="${tab}"]`, { guard: false }); await sleep(200);
  const L = await pg.evaluate(() => {
    const top = document.querySelector('#screenStudy .study-top'), rail = document.querySelector('#screenStudy .study-rail');
    const box = e => e.getBoundingClientRect();
    const sub = byId('studySubChips'), chips = byId('studyChips');
    const rowTops = r => r.hidden ? [] : [...new Set([...r.querySelectorAll('.chip')].map(c => Math.round(box(c).top)))];
    const inRail = r => r.hidden || [...r.querySelectorAll('.chip')].every(c => box(c).left >= box(rail).left - 0.5 && box(c).right <= box(rail).right + 0.5);
    const p = byId('studyContent');
    return {
      topInRail: !!top && top.parentElement === rail, topDisplay: top && getComputedStyle(top).display, topPos: top && getComputedStyle(top).position,
      tabsInRail: rail.contains(byId('studyTabs')), subInRail: rail.contains(sub), chipsInRail: rail.contains(chips),
      subWrap: getComputedStyle(sub).flexWrap, subRows: rowTops(sub).length, subN: sub.querySelectorAll('.chip').length, chipsRows: rowTops(chips).length, chipsN: chips.querySelectorAll('.chip').length,
      chipsInside: inRail(sub) && inRail(chips), railHOverflow: rail.scrollWidth > rail.clientWidth + 1,
      clipped: [...rail.querySelectorAll('.chip, .study-tab')].filter(c => c.scrollWidth > c.clientWidth + 1).map(c => c.textContent.trim().slice(0, 15)),
      panelOverflow: getComputedStyle(p).overflowY, panelScrolls: p.scrollHeight > p.clientHeight + 1, panelTop: p.scrollTop,
      spt: getComputedStyle(document.documentElement).scrollPaddingTop, winY: scrollY,
    };
  });
  log(L.topInRail && L.topDisplay === 'contents' && L.tabsInRail && L.subInRail && L.chipsInRail, 'D', `${tag} ${tab}: tabs + chip rows in the rail (.study-top display ${L.topDisplay})`, L);
  log(L.chipsInside && !L.railHOverflow && !L.clipped.length, 'D', `${tag} ${tab}: chips inside the rail, nothing clipped, rail no sideways overflow`, L);
  if (L.subN) log(L.subWrap === 'wrap' && (L.subN <= 2 || L.subRows >= 2), 'D', `${tag} ${tab}: sub chips wrap (${L.subN} chips on ${L.subRows} rows)`, L);
  const still = await pageStill(pg);
  log(still.ok && L.winY === 0 && ['auto', 'scroll'].includes(L.panelOverflow), 'D', `${tag} ${tab}: page does not scroll, card panel overflow-y ${L.panelOverflow} (panel scrolls: ${L.panelScrolls})`, { still, L });
  log(L.panelTop === 0, 'D', `${tag} ${tab}: new tab list starts at the panel top`, L.panelTop);
  return L;
}

async function deskFactReturn(pg, tag) {
  await hit(pg, '.study-tab[data-tab="people"]', { guard: false }); await sleep(200);
  // (a) a card fully below the fade: Back keeps the exact panel offset
  const sel = id => `#studyContent .fact[data-fact-id="${id}"]`;
  const a = await pg.evaluate(() => {
    const p = byId('studyContent'), cards = [...p.querySelectorAll('.fact')];
    const c = cards[6];
    p.scrollTop += c.getBoundingClientRect().top - p.getBoundingClientRect().top - 100;
    return { id: c.dataset.factId, saved: p.scrollTop };
  });
  await sleep(150);
  await hit(pg, `${sel(a.id)} .fact-practise`);
  log(await active(pg) === 'screenQuiz', 'D', `${tag}: fact ▶ Practise (click) → quiz`);
  await answerAll(pg);
  await iconAudit(pg, 'D', `${tag} fact session last Q`);
  const nb = await nextInfo(pg);
  log(/^(Back|返回)$/.test(nb.t) && nb.i.join() === 'returnLeft', 'D', `${tag}: last Q "↩ Back" returnLeft icon`, nb);
  await hitNext(pg, { guard: false }); await sleep(120);
  const ra = await pg.evaluate(([s, id]) => { const p = byId('studyContent'); const el = document.querySelector(s); return { s: document.querySelector('.screen.active').id, top: p.scrollTop, win: scrollY, flash: el.classList.contains('flash') }; }, [sel(a.id), a.id]);
  log(ra.s === 'screenStudy' && Math.abs(ra.top - a.saved) <= 1 && ra.win === 0 && ra.flash, 'D', `${tag}: ↩ Back → panel offset kept ${a.saved} → ${ra.top}, page 0, card flashes`, ra);
  await sleep(GUARD);
  // (b) the tallest card with its top hidden above the panel edge: Back aligns its top under the panel's top fade (CUI-0036)
  const b = await pg.evaluate(() => {
    const p = byId('studyContent'), cards = [...p.querySelectorAll('.fact')];
    const c = cards.slice(1).reduce((m, x) => x.offsetHeight > m.offsetHeight ? x : m);
    const pr = p.getBoundingClientRect();
    p.scrollTop += c.getBoundingClientRect().top - pr.top + 60; // top 60px above the panel edge
    const r = c.getBoundingClientRect(), btn = c.querySelector('.fact-practise').getBoundingClientRect();
    const fade = parseFloat(getComputedStyle(c).scrollMarginTop);
    return { id: c.dataset.factId, h: r.height, panelH: pr.height, top: r.top - pr.top, btnVisible: btn.bottom <= pr.bottom && btn.top >= pr.top, saved: p.scrollTop, fade };
  });
  await sleep(150);
  if (!b.btnVisible) {
    note('D', `${tag}: tallest People card ${Math.round(b.h)}px: ▶ not inside the panel with its top 60px hidden — scrolled to ▶ (top hidden further)`);
    await pg.evaluate(s => { const p = byId('studyContent'); const btn = document.querySelector(s).getBoundingClientRect(); p.scrollTop += btn.bottom - p.getBoundingClientRect().bottom + 10; }, `${sel(b.id)} .fact-practise`);
    await sleep(150);
  }
  await hit(pg, `${sel(b.id)} .fact-practise`);
  await answerAll(pg);
  await hitNext(pg, { guard: false }); await sleep(150);
  const rb = await pg.evaluate(s => {
    const p = byId('studyContent'), el = document.querySelector(s), pr = p.getBoundingClientRect(), r = el.getBoundingClientRect();
    const hitEl = document.elementFromPoint(r.left + 30, r.top + 6);
    return { s: document.querySelector('.screen.active').id, gap: +(r.top - pr.top).toFixed(1), flash: el.classList.contains('flash'), win: scrollY, hitOwn: !!hitEl && el.contains(hitEl) };
  }, sel(b.id));
  log(rb.s === 'screenStudy' && Math.abs(rb.gap - b.fade) <= 2 && rb.flash && rb.win === 0 && rb.hitOwn, 'D', `${tag}: CUI-0036 desktop tall card (${Math.round(b.h)}px, top was ${Math.round(b.top)}px vs panel) → top ${rb.gap}px under the panel edge = fade ${b.fade}px, flashed`, { b, rb });
  if (/1280x800 en small|1024x768 zh-HK large/.test(tag)) await shot(pg, `D-tallcard-return-${tag.replace(/[^a-zA-Z0-9-]+/g, '_')}`);
  await sleep(GUARD);
}

async function deskQuiz(pg, tag, c) {
  await hit(pg, '#screenStudy .back-btn').catch(() => pg.evaluate(() => goHome()));
  if (await active(pg) !== 'screenHome') await pg.evaluate(() => goHome());
  await hit(pg, '#modePractice');
  await hit(pg, '#diffGrid button');
  const lay = await pg.evaluate(() => byId('screenQuiz').classList.contains('quiz-desk-practice'));
  log(lay, 'D', `${tag}: Practice set (clicks) → desktop practice layout`);
  await iconAudit(pg, 'D', `${tag} Practice Q1 unanswered`);
  await answerCurrent(pg);
  let L = await legendRows(pg, '#dotsMeta');
  const inBar = await pg.evaluate(() => !!byId('dotsMeta').closest('.quiz-dots-bar'));
  log(inBar && L && L.rows.length === 2 && L.rows.every(r => r.n === 1 && r.h < r.lh * 1.6 + 4 && !/^\||\|$/.test(r.text)) && !L.overflow, 'D', `${tag}: Practice legend in the dots bar, two one-line rows ${L && L.rows.map(r => '"' + r.text + '"').join(' / ')}`, L);
  const tabs = await pg.evaluate(() => ({ a: !byId('quizTabAnswer').hidden && byId('quizTabAnswer').getAttribute('aria-selected'), s: !byId('quizTabSimilar').hidden, paneA: !byId('quizPaneAnswer').closest('.quiz-pane').hidden }));
  log(tabs.a === 'true' && tabs.paneA, 'D', `${tag}: revealed → Answer tab selected, its pane shown (Similar tab ${tabs.s ? 'shown' : 'hidden'})`, tabs);
  await iconAudit(pg, 'D', `${tag} Practice Q1 revealed`);
  const still = await pageStill(pg);
  log(still.ok && await noHScroll(pg), 'D', `${tag}: Practice one screen high, no sideways scroll`, still);
  if (/1280x800 zh-HK large|1024x768 en large|1440x900 en small/.test(tag)) await shot(pg, `D-practice-${tag.replace(/[^a-zA-Z0-9-]+/g, '_')}`);
  // jump to the last dot, answer, Finish ✓ → result
  const n = await pg.evaluate(() => state.questions.length);
  await hit(pg, `#navDots .dot[data-arg="${n - 1}"]`, { guard: false }); await sleep(150);
  await answerCurrent(pg, true);
  const fin = await nextInfo(pg);
  log(/^(Finish|完成)$/.test(fin.t) && fin.i.join() === 'check', 'D', `${tag}: last Q "${fin.t}" check icon`, fin);
  await iconAudit(pg, 'D', `${tag} Practice last Q`);
  await hitNext(pg);
  log(await active(pg) === 'screenResult', 'D', `${tag}: Finish → result`);
  L = await legendRows(pg, '#screenResult .rmeta');
  log(L && L.rows.length === 2 && L.rows.every(r => r.n === 1 && r.h < r.lh * 1.6 + 4), 'D', `${tag}: result legend two one-line rows ${L && L.rows.map(r => '"' + r.text + '"').join(' / ')}`, L);
  await iconAudit(pg, 'D', `${tag} Practice result`);
  const rs = await pageStill(pg);
  log(rs.ok, 'D', `${tag}: result one screen high`, rs);
  // Exam: rail with one count per line, Submit words
  await pg.evaluate(() => goHome()); await sleep(200);
  await hit(pg, '#modeExam');
  await hit(pg, '#examGrid .exam-btn');
  const rail = await pg.evaluate(() => byId('screenQuiz').classList.contains('quiz-desk-rail'));
  log(rail, 'D', `${tag}: Exam 1 (clicks) → rail layout`);
  await answerCurrent(pg);
  await pg.evaluate(() => { const f = document.querySelector('#screenQuiz [data-action="toggleFlag"]'); if (f) f.click(); });
  await sleep(150);
  L = await legendRows(pg, '#dotsMeta');
  const lines = L ? new Set(L.entries.map(e => e.top)).size : 0;
  log(L && L.entries.length === 3 && lines === 3 && L.rows.every(r => r.display === 'contents') && !L.overflow, 'D', `${tag}: Exam rail one count per line (${L && L.entries.map(e => '"' + e.t + '"').join(' / ')})`, L);
  const seps = await pg.evaluate(() => [...document.querySelectorAll('.exam-rail .dots-meta .sep')].filter(s => s.getClientRects().length).length);
  log(seps === 0, 'D', `${tag}: no | separators shown in the rail`, seps);
  const total = await pg.evaluate(() => state.questions.length);
  await hit(pg, `#navDots .dot[data-arg="${total - 1}"]`, { guard: false }); await sleep(200);
  const sub = await pg.evaluate(() => { const b = document.querySelector('.exam-submit'); return { vis: !!b && !b.hidden && b.getClientRects().length > 0, t: b && b.textContent.trim(), svg: b && b.querySelectorAll('svg').length, title: b && b.getAttribute('title'), next: nextAction(state.current, state.questions.length).label }; });
  log(sub.vis && sub.t === sub.next && /^(Submit|提交)$/.test(sub.t) && !GLYPH_RE.test(sub.t) && !sub.title, 'D', `${tag}: last Q rail Submit reads "${sub.t}" (words only, no glyph / title)`, sub);
  await iconAudit(pg, 'D', `${tag} Exam last Q`);
  if (/1280x800 zh-HK large|1024x768 en large/.test(tag)) await shot(pg, `D-exam-rail-${tag.replace(/[^a-zA-Z0-9-]+/g, '_')}`);
  await hit(pg, '.exam-submit', { guard: false }); await sleep(300);
  const modal = await pg.evaluate(() => byId('confirmModal').classList.contains('show'));
  log(modal, 'D', `${tag}: Submit → unanswered confirm modal`);
  await iconAudit(pg, 'D', `${tag} Exam submit modal`);
  await hit(pg, '#confirmOk');
  log(await active(pg) === 'screenResult', 'D', `${tag}: confirm → exam result`);
  await iconAudit(pg, 'D', `${tag} Exam result`);
}

async function deskPlan(pg, tag) {
  await pg.evaluate(({ goal, start }) => { writeStudyPlan(buildPlan(goal, start)); writePlanLog({ v: 1, days: {} }); goHome(); }, { goal: PLAN_GOAL, start: PLAN_START });
  await sleep(GUARD);
  await hit(pg, '#modePractice');
  await iconAudit(pg, 'D', `${tag} Home plan card`);
  const wt = await pg.evaluate(() => { const b = byId('tileWrong'); return b && b.getClientRects().length ? { icon: b.querySelector('.t-icon').innerHTML.trim(), flagIcon: byId('tileFlagged').querySelector('.t-icon').innerHTML.trim().slice(0, 40) } : null; });
  if (wt) log(!GLYPH_RE.test(wt.icon), 'F1', `${tag}: Home "Wrong answers" tile mark is a line icon (Flagged tile: svg)`, wt);
  const cont = await pg.evaluate(() => { const b = document.querySelector('#screenHome [data-action="planContinue"]'); return b && { t: b.textContent.trim(), i: [...b.querySelectorAll('svg')].map(s => s.dataset.iconName) }; });
  log(!!cont && cont.i.join() === 'arrowRight', 'D', `${tag}: Home plan card "${cont && cont.t}" arrowRight`, cont);
  await pg.locator('#screenHome [data-action="openPlanSchedule"]').first().scrollIntoViewIfNeeded();
  await hit(pg, '#screenHome [data-action="openPlanSchedule"]');
  log(await active(pg) === 'screenPlanSchedule', 'D', `${tag}: → plan schedule`);
  for (const [scr, go] of [['schedule', null], ['day', '#screenPlanSchedule .plan-block[data-action="openPlanDay"]']]) {
    if (go) { await pg.locator(go).scrollIntoViewIfNeeded(); await hit(pg, go); }
    await iconAudit(pg, 'D', `${tag} plan ${scr}`);
    // the day strip scrolls smoothly (css/screens/plan.css): a smooth scrollIntoView has not moved yet when measured
    await pg.evaluate(() => document.querySelectorAll('.plan-day-scroll').forEach(e => { e.style.scrollBehavior = 'auto'; }));
    const reach = await dtHelpers.controlsReachable(pg);
    log(reach.ok && await noHScroll(pg), 'D', `${tag}: plan ${scr} every control reachable, no sideways scroll (${reach.detail})`, reach);
    if (scr === 'schedule') {
      const hs = await pg.evaluate(() => { const l = byId('planDayList'); return { sl: l.scrollLeft, btn: !!document.querySelector('.plan-hs-btn.r') && document.querySelector('.plan-hs-btn.r').getClientRects().length > 0 }; });
      if (hs.btn) {
        await hit(pg, '.plan-hs-btn.r', { guard: false }); await sleep(700);
        const sl = await pg.evaluate(() => byId('planDayList').scrollLeft);
        log(sl > hs.sl, 'D', `${tag}: plan schedule › (chevronRight, pointer only) scrolls the days ${Math.round(hs.sl)} → ${Math.round(sl)}`);
      } else note('D', `${tag}: plan schedule › not shown`);
    }
    if (/1280x800 en small/.test(tag)) await shot(pg, `D-plan-${scr}-${tag.replace(/[^a-zA-Z0-9-]+/g, '_')}`);
  }
  await hit(pg, '#planDayPrev', { guard: false }); await sleep(200);
  const bt = await pg.evaluate(() => { const b = byId('planBackToday'); return { hidden: b.hidden, i: [...b.querySelectorAll('svg')].map(s => s.dataset.iconName) }; });
  log(!bt.hidden && bt.i.join() === 'arrowLeft', 'D', `${tag}: day ‹ → Back to today arrowLeft`, bt);
  await iconAudit(pg, 'D', `${tag} plan day (yesterday)`);
  await hit(pg, '#planBackToday', { guard: false }); await sleep(200);
  // 13 Oct (NOON) is a drill day: today's first task is a question task
  const ty = await pg.evaluate(iso => planLoad().days.find(d => d.date === iso).tasks[0].type, PLAN_TODAY);
  await pg.locator('#planTaskList .plan-task-btn').first().scrollIntoViewIfNeeded();
  await hit(pg, '#planTaskList .plan-task-btn');
  log(await active(pg) === 'screenQuiz', 'D', `${tag}: plan today's ${ty} task → quiz`);
  const hb = await pg.evaluate(() => { const b = document.querySelector('#screenQuiz .back-btn'); return { t: b.textContent.trim(), i: [...b.querySelectorAll('svg')].map(s => s.dataset.iconName) }; });
  log(hb.i.join() === 'arrowLeft' && !GLYPH_RE.test(hb.t), 'D', `${tag}: plan task header "${hb.t}" arrowLeft`, hb);
  await answerCurrent(pg);
  await iconAudit(pg, 'D', `${tag} plan task quiz revealed`);
  const reach = await dtHelpers.controlsReachable(pg);
  log(reach.ok, 'D', `${tag}: plan task quiz every control reachable (${reach.detail})`, reach);
  await hit(pg, '#screenQuiz .back-btn');
  log(await active(pg) === 'screenPlanDay', 'D', `${tag}: header ← back to the day`);
  await pg.evaluate(() => { localStorage.removeItem('lifeuk.studyPlan'); });
}

async function sectionD() {
  const configs = [];
  for (const v of DESK_VP) for (const lang of ['en', 'zh-HK']) for (const font of ['small', 'large']) configs.push({ ...v, lang, font, touch: false });
  configs.push({ width: 1024, height: 768, lang: 'en', font: 'large', touch: true }); // tablet landscape, touch
  configs.push({ width: 1180, height: 820, lang: 'zh-HK', font: 'large', touch: true }); // iPad Air landscape, touch
  for (const c of configs) {
    const tag = tagOf(c);
    const pg = await newPage(c);
    try {
      // Home
      await iconAudit(pg, 'D', `${tag} Home`);
      const hs = await noHScroll(pg);
      log(hs, 'D', `${tag}: Home no sideways scroll`);
      if (/1280x800 en small|1024x768 zh-HK large/.test(tag)) await shot(pg, `D-home-${tag.replace(/[^a-zA-Z0-9-]+/g, '_')}`);
      await infoPopoverCheck(pg, 'D', tag);
      log(await active(pg) === 'screenHome', 'D', `${tag}: outside click left the screen as it was`);
      // Study rail
      await hit(pg, '#modeStudy');
      for (const tab of TABS) await deskStudyTab(pg, tag, tab);
      if (/1280x800 zh-HK large|1024x768 en large|1440x900 en small/.test(tag)) {
        await hit(pg, '.study-tab[data-tab="people"]', { guard: false }); await sleep(200);
        await shot(pg, `D-study-people-${tag.replace(/[^a-zA-Z0-9-]+/g, '_')}`);
      }
      // sub chip while scrolled → panel top
      await hit(pg, '.study-tab[data-tab="people"]', { guard: false }); await sleep(150);
      await pg.evaluate(() => { byId('studyContent').scrollTop = 600; });
      await hit(pg, '#studySubChips .chip:last-of-type', { guard: false }); await sleep(200);
      const st = await pg.evaluate(() => ({ top: byId('studyContent').scrollTop, win: scrollY, act: byId('studySubChips').querySelector('.chip.active')?.textContent.trim() }));
      log(st.top === 0 && st.win === 0, 'D', `${tag}: sub chip "${st.act}" clicked while scrolled → list from the panel top`, st);
      await hit(pg, '#studySubChips .chip:first-of-type', { guard: false }); await sleep(150);
      await iconAudit(pg, 'D', `${tag} Study people`);
      // memory note chevron (chapters list has notes)
      await hit(pg, '.study-tab[data-tab="chapters"]', { guard: false }); await sleep(200);
      await memNoteCheck(pg, 'D', tag, true);
      await deskFactReturn(pg, tag);
      await memoFlow(pg, 'D', tag, { desk: true });
      await deskQuiz(pg, tag, c);
      await deskPlan(pg, tag);
      noErrors(pg, 'D', tag);
    } catch (e) { log(false, 'RUN', `D ${tag}: harness error ${e.message.split('\n')[0]}`); }
    await pg.ctx.close();
  }
}

// ════════════════ F: phone regression ════════════════
const blockBottom = pg => pg.evaluate(() => document.querySelector('#screenStudy .study-top').getBoundingClientRect().bottom);
async function phoneTallCard(pg, tag, c) {
  await hit(pg, '.study-tab[data-tab="people"]', { guard: false }); await sleep(200);
  // pin first
  await swipe(pg, c.width / 2, c.height * 0.8, 0, -Math.min(c.height * 0.5, 400));
  const pin = await pg.evaluate(() => ({ b: document.querySelector('#screenStudy .study-top').getBoundingClientRect().top, h: document.querySelector('header').getBoundingClientRect().bottom }));
  log(Math.abs(pin.b - pin.h) <= 1, 'F', `${tag}: finger swipe → Study block pinned under the header`, pin);
  const sel = id => `#studyContent .fact[data-fact-id="${id}"]`;
  const b = await pg.evaluate(() => {
    const cards = [...document.querySelectorAll('#studyContent .fact')];
    const c = cards.slice(1).reduce((m, x) => x.offsetHeight > m.offsetHeight ? x : m);
    return { id: c.dataset.factId, h: c.offsetHeight };
  });
  const bb = await blockBottom(pg);
  // top 40px behind the block; if ▶ is then below the screen, scroll so ▶ shows (top hidden further: the user's case)
  await pg.evaluate(([s, t]) => { const el = document.querySelector(s); window.scrollBy(0, el.getBoundingClientRect().top - t); }, [sel(b.id), bb - 40]);
  await sleep(150);
  const pos = await pg.evaluate(s => { const el = document.querySelector(s); const btn = el.querySelector('.fact-practise').getBoundingClientRect(); return { btnB: btn.bottom, ih: innerHeight }; }, sel(b.id));
  if (pos.btnB > pos.ih - 4) { await pg.evaluate(([s, d]) => window.scrollBy(0, d), [sel(b.id), pos.btnB - pos.ih + 20]); await sleep(150); }
  const before = await pg.evaluate(s => document.querySelector(s).getBoundingClientRect().top, sel(b.id));
  await hit(pg, `${sel(b.id)} .fact-practise`);
  log(await active(pg) === 'screenQuiz', 'F', `${tag}: tallest People card (${b.h}px, space ${Math.round(c.height - bb)}px) top ${Math.round(before)} behind block ${Math.round(bb)} → ▶ Practise`);
  await answerAll(pg);
  await hitNext(pg, { guard: false });
  const m = await pg.evaluate(s => {
    const el = document.querySelector(s), blk = document.querySelector('#screenStudy .study-top').getBoundingClientRect(), r = el.getBoundingClientRect();
    const hitEl = document.elementFromPoint(r.left + r.width / 2, r.top + 4);
    return { s: document.querySelector('.screen.active').id, top: +r.top.toFixed(1), blockB: +blk.bottom.toFixed(1), flash: el.classList.contains('flash'), hitOwn: !!hitEl && el.contains(hitEl) };
  }, sel(b.id));
  log(m.s === 'screenStudy' && Math.abs(m.top - m.blockB) <= 2 && m.flash && m.hitOwn, 'F', `${tag}: CUI-0036 ↩ Back → tall card top ${m.top} right under the pinned block ${m.blockB}, flashed, not covered`, m);
  if (/320x568 (en|zh-HK) large/.test(tag)) await shot(pg, `F-tallcard-return-${tag.replace(/[^a-zA-Z0-9-]+/g, '_')}`);
  await sleep(GUARD);
  // a card whose top shows: the restored scroll is kept (nearest, no jump)
  const s2 = await pg.evaluate(() => {
    const cards = [...document.querySelectorAll('#studyContent .fact')];
    const blk = document.querySelector('#screenStudy .study-top').getBoundingClientRect().bottom;
    const c = cards.slice(1).reduce((m, x) => x.offsetHeight < m.offsetHeight ? x : m); // the shortest card, top 30px under the block
    window.scrollBy(0, c.getBoundingClientRect().top - blk - 30);
    if (c.querySelector('.fact-practise').getBoundingClientRect().bottom > innerHeight - 4) return null;
    return { id: c.dataset.factId, y: scrollY, top: c.getBoundingClientRect().top };
  });
  if (s2) {
    await hit(pg, `${sel(s2.id)} .fact-practise`);
    await answerAll(pg);
    await hitNext(pg, { guard: false });
    const m2 = await pg.evaluate(s => ({ y: scrollY, top: document.querySelector(s).getBoundingClientRect().top }), sel(s2.id));
    log(Math.abs(m2.y - s2.y) <= 1 && Math.abs(m2.top - s2.top) <= 1, 'F', `${tag}: card with its top in view → ↩ Back keeps scroll ${s2.y} → ${m2.y} (no jump)`, { s2, m2 });
    await sleep(GUARD);
  } else note('F', `${tag}: no fully visible card for the keep-scroll check`);
}

async function sectionF() {
  const configs = [{ width: 390, height: 844, lang: 'en', font: 'large' }, { width: 390, height: 844, lang: 'zh-HK', font: 'large' },
    { width: 320, height: 568, lang: 'en', font: 'large' }, { width: 320, height: 568, lang: 'zh-HK', font: 'large' }, { width: 390, height: 844, lang: 'en', font: 'small' }];
  for (const c of configs) {
    const tag = tagOf(c);
    const pg = await newPage(c);
    try {
      await infoPopoverCheck(pg, 'F', tag);
      await iconAudit(pg, 'F', `${tag} Home`);
      await hit(pg, '#modeStudy');
      // chip row: one line + finger swipe scrolls the row only (Geo sub chips / Chapters)
      for (const tab of ['chapters', 'people']) {
        await hit(pg, `.study-tab[data-tab="${tab}"]`, { guard: false }); await pg.evaluate(() => window.scrollTo(0, 0)); await sleep(150);
        const row = await pg.evaluate(() => {
          const r = ['studySubChips', 'studyChips'].map(byId).find(x => !x.hidden && x.scrollWidth > x.clientWidth + 1);
          if (!r) return null;
          const tops = [...r.querySelectorAll('.chip')].map(ch => Math.round(ch.getBoundingClientRect().top));
          return { id: r.id, oneLine: new Set(tops).size === 1, wrap: getComputedStyle(r).flexWrap, rect: r.getBoundingClientRect().toJSON(), sl: r.scrollLeft };
        });
        if (!row) { note('F', `${tag} ${tab}: no overflowing chip row`); continue; }
        log(row.oneLine && row.wrap === 'nowrap', 'F', `${tag} ${tab}: #${row.id} one line (nowrap)`, row);
        const y0 = await pg.evaluate(() => scrollY);
        await swipe(pg, row.rect.right - 30, row.rect.top + row.rect.height / 2, -(row.rect.width - 60), 0);
        const after = await pg.evaluate(id => ({ sl: byId(id).scrollLeft, y: scrollY, x: scrollX }), row.id);
        log(after.sl > row.sl + 10 && Math.abs(after.y - y0) < 2 && after.x === 0, 'F', `${tag} ${tab}: finger swipe scrolls #${row.id} only (${row.sl} → ${after.sl})`, after);
        await pg.evaluate(id => { byId(id).scrollLeft = 0; }, row.id);
      }
      await iconAudit(pg, 'F', `${tag} Study`);
      await memNoteCheck(pg, 'F', tag, false);
      await pg.evaluate(() => window.scrollTo(0, 0));
      await phoneTallCard(pg, tag, c);
      await pg.evaluate(() => window.scrollTo(0, 0));
      await memoFlow(pg, 'F', tag, { desk: false });
      // legend on a Practice set
      await hit(pg, '#screenStudy .back-btn');
      await hit(pg, '#modePractice');
      await hit(pg, '#diffGrid button');
      const ph = await pg.evaluate(() => { const b = document.querySelector('#screenQuiz .back-btn'); return { i: b.querySelector('svg')?.dataset.iconName, t: b.textContent.trim() }; });
      log(ph.i === 'home' && ph.t === '', 'F', `${tag}: Practice set after the memo test keeps 🏠`, ph);
      await answerCurrent(pg);
      const L = await legendRows(pg, '#dotsMeta');
      log(L && L.rows.length === 2 && L.rows.every(r => r.n === 1 && r.h < r.lh * 1.6 + 4 && !/^\||\|$/.test(r.text)) && !L.overflow, 'F', `${tag}: Practice legend two one-line rows ${L && L.rows.map(r => '"' + r.text + '"').join(' / ')}`, L);
      await iconAudit(pg, 'F', `${tag} Practice revealed`);
      await hit(pg, '#screenQuiz .back-btn');
      if (await pg.evaluate(() => byId('confirmModal').classList.contains('show'))) await hit(pg, '#confirmOk');
      const wt = await pg.evaluate(() => { const b = byId('tileWrong'); return b && b.getClientRects().length ? { icon: b.querySelector('.t-icon').innerHTML.trim(), flagIcon: byId('tileFlagged').querySelector('.t-icon').innerHTML.trim().slice(0, 40) } : null; });
      if (wt) log(!GLYPH_RE.test(wt.icon), 'F1', `${tag}: Home "Wrong answers" tile mark is a line icon (Flagged tile: svg)`, wt);
      else note('F', `${tag}: Wrong answers tile not shown`);
      if (/390x844 en small/.test(tag) && wt) { await pg.locator('#tileWrong').scrollIntoViewIfNeeded(); await shot(pg, 'F1-home-wrong-tile-390-en'); }
      await iconAudit(pg, 'F', `${tag} Home practice (review tiles)`);
      noErrors(pg, 'F', tag);
    } catch (e) { log(false, 'RUN', `F ${tag}: harness error ${e.message.split('\n')[0]}`); }
    await pg.ctx.close();
  }
}

// ════════════════ B: breakpoint crossing ════════════════
async function sectionB() {
  for (const c of [{ lang: 'en', font: 'small' }, { lang: 'zh-HK', font: 'large' }]) {
    const tag = `${c.lang} ${c.font}`;
    const pg = await newPage({ width: 390, height: 844, ...c, touch: false });
    try {
      const PH = { width: 390, height: 844 }, DK = { width: 1280, height: 800 };
      const studyState = () => pg.evaluate(() => {
        const top = document.querySelector('#screenStudy .study-top'), h = document.querySelector('header').getBoundingClientRect().bottom;
        const p = byId('studyContent'), e = document.scrollingElement;
        return { pos: getComputedStyle(top).position, disp: getComputedStyle(top).display, topY: +top.getBoundingClientRect().top.toFixed(1), header: +h.toFixed(1), y: scrollY,
          panelOv: getComputedStyle(p).overflowY, pageScrolls: e.scrollHeight > e.clientHeight + 1, spt: getComputedStyle(document.documentElement).scrollPaddingTop,
          chipsBeforeSub: byId('studyChips').nextElementSibling === byId('studySubChips'), countBeforeChips: byId('studyCount').nextElementSibling === byId('studyChips'),
          inRail: !!top.closest('.study-rail'), searchTop: byId('studySearch').getBoundingClientRect().top, subWrap: getComputedStyle(byId('studySubChips')).flexWrap,
          docW: e.scrollWidth, w: innerWidth };
      });
      await hit(pg, '#modeStudy');
      await hit(pg, '.study-tab[data-tab="people"]', { guard: false });
      await pg.evaluate(() => window.scrollTo(0, 1500)); await sleep(200);
      let s = await studyState();
      log(s.pos === 'sticky' && Math.abs(s.topY - s.header) <= 1, 'B', `${tag}: 390 Study People scrolled → block pinned`, s);
      await pg.setViewportSize(DK); await sleep(400);
      s = await studyState();
      log(s.disp === 'contents' && s.inRail && !s.pageScrolls && s.y === 0 && ['auto', 'scroll'].includes(s.panelOv) && s.countBeforeChips && s.subWrap === 'wrap' && s.docW <= s.w, 'B', `${tag}: → 1280: rail layout, page not scrolling (y ${s.y}), panel scrolls, sub chips wrap, filter chips at the rail foot`, s);
      await pg.evaluate(() => { byId('studyContent').scrollTop = 900; }); await sleep(100);
      await pg.setViewportSize(PH); await sleep(400);
      s = await studyState();
      log(s.pos === 'sticky' && s.chipsBeforeSub && s.panelOv === 'visible' && s.pageScrolls && s.subWrap === 'nowrap' && s.docW <= s.w, 'B', `${tag}: → 390: phone layout back (sticky block, chips above sub chips, one-line rows, page scrolls)`, s);
      await pg.evaluate(() => window.scrollTo(0, 0)); await sleep(150);
      s = await studyState();
      log(s.topY > s.header + 5 && s.searchTop >= s.header - 1, 'B', `${tag}: at the top the block is at rest (not stuck pinned), search shown`, s);
      await pg.evaluate(() => window.scrollTo(0, 2000)); await sleep(150);
      s = await studyState();
      log(Math.abs(s.topY - s.header) <= 1, 'B', `${tag}: scrolled again → pinned again`, s);
      // tab click after the round trip: list from its start under the block
      await hit(pg, '.study-tab[data-tab="geo"]', { guard: false }); await sleep(200);
      const g = await pg.evaluate(() => ({ c: byId('studyCount').getBoundingClientRect().top, b: document.querySelector('#screenStudy .study-top').getBoundingClientRect().bottom }));
      log(g.c >= g.b - 1 && g.c <= g.b + 30, 'B', `${tag}: after round trip a tab tap shows the new list from its start under the block`, g);
      // fact practice opened at 1280, Back at 390 (crossing in the side session)
      await pg.setViewportSize(DK); await sleep(300);
      await hit(pg, '.study-tab[data-tab="people"]', { guard: false }); await sleep(150);
      const fid = await pg.evaluate(() => { const p = byId('studyContent'); const c2 = p.querySelectorAll('.fact')[5]; p.scrollTop = c2.offsetTop - p.offsetTop - 60; return c2.dataset.factId; });
      await sleep(100);
      await hit(pg, `#studyContent .fact[data-fact-id="${fid}"] .fact-practise`);
      await answerAll(pg);
      await pg.setViewportSize(PH); await sleep(300);
      await hitNext(pg, { guard: false }); await sleep(200);
      const fb = await pg.evaluate(id => { const el = document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`); const r = el.getBoundingClientRect(); const blk = document.querySelector('#screenStudy .study-top').getBoundingClientRect(); return { s: document.querySelector('.screen.active').id, top: r.top, bottom: r.bottom, blockB: blk.bottom, ih: innerHeight, flash: el.classList.contains('flash') }; }, fid);
      log(fb.s === 'screenStudy' && fb.top >= fb.blockB - 1 && fb.top < fb.ih && fb.flash, 'B', `${tag}: ▶ at 1280, ↩ Back at 390 → card shown under the block (top ${Math.round(fb.top)} / block ${Math.round(fb.blockB)})`, fb);
      // quiz: revealed practice question 390 → 1280 → 390
      await pg.evaluate(() => goHome()); await sleep(200);
      await hit(pg, '#modePractice'); await hit(pg, '#diffGrid button');
      await answerCurrent(pg);
      const qs = () => pg.evaluate(() => ({ practice: byId('screenQuiz').classList.contains('quiz-desk-practice'), answerInPane: !!byId('answerBox').closest('.quiz-pane'), dotsInBar: !!byId('navDots').closest('.quiz-dots-bar'),
        answerShown: byId('answerBox').getClientRects().length > 0, docW: document.scrollingElement.scrollWidth, w: innerWidth, legendRows: byId('dotsMeta').querySelectorAll('.lg-row').length }));
      let q = await qs();
      log(!q.practice && !q.answerInPane && q.answerShown, 'B', `${tag}: 390 quiz phone layout`, q);
      await pg.setViewportSize(DK); await sleep(400);
      q = await qs();
      log(q.practice && q.answerInPane && q.dotsInBar && q.answerShown && q.docW <= q.w && q.legendRows === 2, 'B', `${tag}: → 1280 quiz desktop practice layout (answer in pane, dots bar)`, q);
      await pg.setViewportSize(PH); await sleep(400);
      q = await qs();
      log(!q.practice && !q.answerInPane && !q.dotsInBar && q.answerShown && q.docW <= q.w, 'B', `${tag}: → 390 quiz phone layout back`, q);
      await iconAudit(pg, 'B', `${tag} quiz after round trip`);
      // memo: look 390 → 1280 → 390, then a test crossing, exit mid-way
      await pg.evaluate(() => goHome()); await sleep(200);
      await hit(pg, '#modeStudy'); await hit(pg, '.study-tab[data-tab="memo"]', { guard: false }); await sleep(200);
      await pg.locator('#studyContent .memo-card[data-arg="vote"]').scrollIntoViewIfNeeded();
      await hit(pg, '#studyContent .memo-card[data-arg="vote"]');
      await pg.setViewportSize(DK); await sleep(400);
      const ms = await pg.evaluate(() => ({ fit: byId('screenMemo').classList.contains('is-fit'), still: document.scrollingElement.scrollHeight <= document.scrollingElement.clientHeight + 1 }));
      log(ms.fit && ms.still, 'B', `${tag}: memo look → 1280 one screen high`, ms);
      await hit(pg, '#memoBody .memo-start');
      await answerCurrent(pg);
      await pg.setViewportSize(PH); await sleep(400);
      await answerCurrent(pg).catch(() => {});
      const before = await pg.evaluate(() => localStorage.getItem('lifeuk.memoProgress'));
      await hit(pg, '#screenQuiz .back-btn');
      const left = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, ret: sessionReturn, prog: localStorage.getItem('lifeuk.memoProgress'), still: document.scrollingElement.scrollHeight <= document.scrollingElement.clientHeight + 1 }));
      log(left.s === 'screenMemo' && left.ret === null && left.prog === before, 'B', `${tag}: memo test crossing 1280 → 390, ‹ Memory → look, nothing recorded`, left);
      await hit(pg, '#screenMemo .memo-back');
      await pg.setViewportSize(DK); await sleep(400);
      const back = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, grid: getComputedStyle(document.querySelector('#studyContent .memo-grid')).gridTemplateColumns.split(' ').length }));
      log(back.s === 'screenStudy' && back.grid === 3, 'B', `${tag}: memo list at 1280 → 3 columns`, back);
      await pg.setViewportSize(PH); await sleep(400);
      const back2 = await pg.evaluate(() => getComputedStyle(document.querySelector('#studyContent .memo-grid')).gridTemplateColumns.split(' ').length);
      log(back2 === 2, 'B', `${tag}: and 390 → 2 columns again`, back2);
      if (c.lang === 'zh-HK') await shot(pg, 'B-memo-list-390-after-roundtrip-zh-large');
      noErrors(pg, 'B', tag);
    } catch (e) { log(false, 'RUN', `B ${tag}: harness error ${e.message.split('\n')[0]}`); }
    await pg.ctx.close();
  }
}

// ════════════════ C: CUI-0033 × memo exit / side session Back ════════════════
async function sectionC() {
  for (const c of [{ width: 1280, height: 800, lang: 'zh-HK', font: 'large' }, { width: 1024, height: 768, lang: 'en', font: 'small' }]) {
    const tag = tagOf({ ...c, touch: false });
    const pg = await newPage({ ...c, touch: false });
    try {
      const panes = () => pg.evaluate(() => ({ q: state.current, main: document.querySelector('#screenQuiz .quiz-main').scrollTop,
        ans: byId('quizPaneAnswer').scrollTop, sim: byId('quizPaneSimilar').scrollTop, tab: byId('quizTabAnswer').getAttribute('aria-selected') === 'true' ? 'answer' : 'similar',
        ansH: [byId('quizPaneAnswer').scrollHeight, byId('quizPaneAnswer').clientHeight] }));
      const scrollPane = () => pg.evaluate(() => { const p = byId('quizPaneAnswer'); p.scrollTop = p.scrollHeight; p.dispatchEvent(new Event('scroll')); return p.scrollTop; });
      // memo test: answer Q1, scroll its answer pane, dot → unanswered Q3, dot → Q1: pane at top; then ‹ Memory
      await hit(pg, '#modeStudy'); await hit(pg, '.study-tab[data-tab="memo"]', { guard: false }); await sleep(200);
      // a group with ≥ 3 questions
      const gid = await pg.evaluate(() => memoGroups().find(g => memoTestPick(g).length >= 3).id);
      await pg.locator(`#studyContent .memo-card[data-arg="${gid}"]`).scrollIntoViewIfNeeded();
      await hit(pg, `#studyContent .memo-card[data-arg="${gid}"]`);
      await hit(pg, '#memoBody .memo-start');
      await answerCurrent(pg);
      const sc = await scrollPane();
      const p0 = await panes();
      await hit(pg, '#navDots .dot[data-arg="2"]', { guard: false }); await sleep(200);
      await hit(pg, '#navDots .dot[data-arg="0"]', { guard: false }); await sleep(200);
      let p1 = await panes();
      log(p1.q === 0 && p1.ans === 0 && p1.main === 0 && p1.tab === 'answer', 'C', `${tag}: memo test: Q1 answer pane scrolled ${sc} → dot Q3 (unanswered) → dot Q1: panes at the top (CUI-0033)`, { p0, p1 });
      if (sc === 0) note('C', `${tag}: memo test Q1 answer pane does not overflow (${p0.ansH}) — reset is vacuous for this group`);
      const before = await pg.evaluate(() => localStorage.getItem('lifeuk.memoProgress'));
      await hit(pg, '#screenQuiz .back-btn');
      const left = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, ret: sessionReturn, prog: localStorage.getItem('lifeuk.memoProgress') }));
      log(left.s === 'screenMemo' && left.ret === null && left.prog === before, 'C', `${tag}: after the dot jumps ‹ Memory → look, nothing recorded`, left);
      // a Practice set after: Q1 panes at top, 🏠 header
      await pg.evaluate(() => goHome()); await sleep(200);
      await hit(pg, '#modePractice'); await hit(pg, '#diffGrid button');
      await answerCurrent(pg);
      p1 = await panes();
      const hb = await pg.evaluate(() => document.querySelector('#screenQuiz .back-btn svg')?.dataset.iconName);
      log(p1.ans === 0 && p1.main === 0 && hb === 'home', 'C', `${tag}: Practice set after the memo exit: panes at the top, 🏠 header`, { p1, hb });
      // Practice: answer Q1, scroll pane, dot → unanswered Q4, dot → Q1 → top
      const sc2 = await scrollPane();
      await hit(pg, '#navDots .dot[data-arg="3"]', { guard: false }); await sleep(150);
      await hit(pg, '#navDots .dot[data-arg="0"]', { guard: false }); await sleep(150);
      p1 = await panes();
      log(p1.ans === 0 && p1.q === 0, 'C', `${tag}: Practice Q1 pane scrolled ${sc2} → dot unanswered → dot Q1: answer pane at the top`, p1);
      // answered → answered (no unanswered between): pane keeps its scroll? (v2.0.1 rule: a panel shown for another question starts at top)
      // Similar side session: Similar tab → ▶ Practise → answer all → ↩ Back → original Q, panes at the top, no errors
      const simShown = await pg.evaluate(() => !byId('quizTabSimilar').hidden);
      let simQ = 0;
      if (!simShown) {
        // find a question with similar questions
        const n = await pg.evaluate(() => state.questions.length);
        for (let k = 1; k < n && !simQ; k++) {
          await hit(pg, `#navDots .dot[data-arg="${k}"]`, { guard: false }); await sleep(100);
          await answerCurrent(pg);
          if (await pg.evaluate(() => !byId('quizTabSimilar').hidden)) simQ = k;
        }
      }
      if (simShown || simQ) {
        await hit(pg, '#quizTabSimilar', { guard: false }); await sleep(150);
        await pg.evaluate(() => { const p = byId('quizPaneSimilar'); p.scrollTop = p.scrollHeight; });
        const cta = pg.locator('#quizPaneSimilar .sqm-cta button').first();
        await cta.scrollIntoViewIfNeeded(); await cta.click(); await sleep(GUARD);
        const inSide = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, ret: sessionReturn && sessionReturn.kind }));
        log(inSide.s === 'screenQuiz' && inSide.ret === 'quiz', 'C', `${tag}: Similar ▶ Practise → side session (return kind quiz)`, inSide);
        // inside the side session: answer Q1, dot jump to an unanswered one and back (if ≥ 2), then finish
        const sn = await pg.evaluate(() => state.questions.length);
        await answerCurrent(pg);
        if (sn >= 2) {
          await scrollPane();
          await hit(pg, `#navDots .dot[data-arg="${sn - 1}"]`, { guard: false }); await sleep(150);
          await hit(pg, '#navDots .dot[data-arg="0"]', { guard: false }); await sleep(150);
          const sp = await panes();
          log(sp.ans === 0, 'C', `${tag}: inside the Similar side session, dot jump back to Q1 → answer pane at the top`, sp);
        }
        await answerAll(pg);
        await hitNext(pg);
        const back = await panes();
        const scr = await active(pg);
        log(scr === 'screenQuiz' && back.q === (simShown ? 0 : simQ) && back.ans === 0 && back.sim === 0, 'C', `${tag}: ↩ Back → original question ${back.q + 1}, tab ${back.tab}, panes at the top (S-253 behaviour)`, back);
        // then the CUI-0033 jump still works on the restored quiz
        await scrollPane();
        const un = await pg.evaluate(() => state.questions.findIndex((_, i) => !(i in state.revealed)));
        const cur = back.q;
        await hit(pg, `#navDots .dot[data-arg="${un}"]`, { guard: false }); await sleep(150);
        await hit(pg, `#navDots .dot[data-arg="${cur}"]`, { guard: false }); await sleep(150);
        const after = await panes();
        log(after.ans === 0 && after.q === cur, 'C', `${tag}: restored quiz → dot unanswered → back: answer pane at the top`, after);
      } else note('C', `${tag}: no question with Similar found in the first set`);
      await iconAudit(pg, 'C', `${tag} quiz after side session`);
      noErrors(pg, 'C', tag);
    } catch (e) { log(false, 'RUN', `C ${tag}: harness error ${e.message.split('\n')[0]}`); }
    await pg.ctx.close();
  }
}

// ════════════════ O: SW upgrade v2.0.2 → v2.0.3 + offline ════════════════
function copyApp(fromRoot, dest) {
  for (const f of appFiles(fromRoot)) execSync(`cp -r "${path.join(fromRoot, f)}" "${dest}/"`);
}
async function sectionO() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa203-'));
  const old = path.join(tmp, 'old');
  execSync(`git -C "${ROOT}" worktree add --detach "${old}" c6b0806 -q`);
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
    const v0 = await pg.evaluate(async () => ({ v: APP_VERSION, ctrl: !!navigator.serviceWorker.controller, caches: await caches.keys() }));
    log(v0.v === '2.0.2' && v0.ctrl, 'O', `v2.0.2 (main c6b0806) installed with SW controlling (caches ${v0.caches.join(',')})`, v0);
    await pg.evaluate(() => localStorage.setItem('lifeuk.uiLang', JSON.stringify('en')));
    execSync(`rm -rf "${site}"/* && true`);
    copyApp(ROOT, site);
    let v = null;
    for (let k = 0; k < 10; k++) {
      await pg.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r && r.update())).catch(() => {});
      await sleep(1200);
      await pg.reload().catch(() => {}); await sleep(800);
      v = await pg.evaluate(() => typeof APP_VERSION !== 'undefined' ? APP_VERSION : null).catch(() => null);
      if (v === '2.0.3') break;
    }
    const keys = await pg.evaluate(() => caches.keys());
    log(v === '2.0.3' && keys.includes('lifeuk-v2.0.3') && !keys.includes('lifeuk-v2.0.2'), 'O', `SW upgrade → APP_VERSION ${v}, caches ${keys.join(',')}`, { v, keys });
    const shellOk = await pg.evaluate(async () => {
      const c = await caches.open('lifeuk-v2.0.3');
      const sw = await (await fetch('sw.js')).text();
      const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
      const missing = [];
      for (const f of shell) if (!(await c.match(f))) missing.push(f);
      const idx = await (await c.match('./index.html') || await c.match('index.html')).text();
      return { n: shell.length, missing, newIdx: idx.includes('study-top') && idx.includes('data-icon="info"') };
    });
    log(!shellOk.missing.length && shellOk.newIdx, 'O', `new cache holds all ${shellOk.n} SHELL files and the v2.0.3 index.html (study-top, info icon)`, shellOk);
    await ctx.setOffline(true);
    await pg.reload(); await sleep(800);
    const off = await pg.evaluate(() => ({ v: APP_VERSION, studyTop: !!document.querySelector('.study-top'), info: byId('infoBtn').querySelector('svg')?.dataset.iconName }));
    log(off.v === '2.0.3' && off.studyTop && off.info === 'info', 'O', 'offline reload (phone): v2.0.3 shell from cache, ⓘ info icon', off);
    await pg.locator('#modeStudy').tap(); await sleep(GUARD);
    await pg.evaluate(() => window.scrollTo(0, 1500)); await sleep(150);
    const pin = await pg.evaluate(() => Math.abs(document.querySelector('#screenStudy .study-top').getBoundingClientRect().top - document.querySelector('header').getBoundingClientRect().bottom));
    log(pin <= 1, 'O', 'offline phone: Study block pinned');
    await pg.evaluate(() => window.scrollTo(0, 0));
    await pg.locator('.study-tab[data-tab="memo"]').tap(); await sleep(200);
    await pg.locator('#studyContent .memo-card[data-arg="vote"]').tap(); await sleep(GUARD);
    await pg.locator('#memoBody .memo-start').tap(); await sleep(GUARD);
    await pg.locator('#screenQuiz .back-btn').tap(); await sleep(GUARD);
    log(await active(pg) === 'screenMemo', 'O', 'offline phone: memo test ‹ Memory → look');
    await ctx.close();
    // desktop offline in the same origin (new context gets its own SW: install online first, then offline)
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'Europe/London' });
    const p2 = await ctx2.newPage();
    p2.on('pageerror', e => errs.push(e.message));
    await p2.goto(s.base + 'index.html');
    await p2.evaluate(() => navigator.serviceWorker.ready);
    await p2.reload(); await sleep(600);
    await ctx2.setOffline(true);
    await p2.reload(); await sleep(800);
    await p2.locator('#modeStudy').click(); await sleep(GUARD);
    const d = await p2.evaluate(() => ({ v: APP_VERSION, rail: !!document.querySelector('#screenStudy .study-rail .study-top'), still: document.scrollingElement.scrollHeight <= document.scrollingElement.clientHeight + 1 }));
    log(d.v === '2.0.3' && d.rail && d.still, 'O', 'offline desktop 1280: Study rail from cache, page one screen high', d);
    await p2.screenshot({ path: path.join(SHOTS, 'O-offline-desktop-study.png') });
    await ctx2.close();
    log(!errs.length, 'O', 'SW upgrade + offline: no page errors', errs);
  } finally {
    s.server.kill();
    execSync(`git -C "${ROOT}" worktree remove --force "${old}"`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ════════════════ X: old cached index.html + v2.0.3 scripts ════════════════
async function sectionX() {
  for (const [rev, name] of [['f55a945', 'v1.6.0'], ['c6b0806', 'v2.0.2']]) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa203x-'));
    copyApp(ROOT, tmp);
    execSync(`git -C "${ROOT}" show ${rev}:index.html > "${tmp}/index.html"`);
    const s = await startPagesServer(tmp);
    try {
      for (const c of [{ width: 390, height: 844, lang: 'en', font: 'small', touch: true }, { width: 320, height: 568, lang: 'zh-HK', font: 'large', touch: true },
        { width: 1280, height: 800, lang: 'zh-HK', font: 'large', touch: false }]) {
        const tag = `old ${name} shell ${tagOf(c)}`;
        const pg = await newPage({ ...c, url: s.base + 'index.html' });
        try {
          const st = await pg.evaluate(() => ({ v: APP_VERSION, studyTop: !!document.querySelector('.study-top'), info: byId('infoBtn').querySelector('svg')?.dataset.iconName, infoTxt: byId('infoBtn').textContent.trim(), label: byId('infoBtn').getAttribute('aria-label') }));
          log(st.v === '2.0.3' && st.info === 'info' && st.infoTxt === '' && !!st.label, 'X', `${tag}: v2.0.3 scripts, ⓘ upgraded to the info line icon (no glyph), named`, st);
          await iconAudit(pg, 'X', `${tag} Home`);
          await hit(pg, '#infoBtn', { guard: false }); await sleep(250);
          const op = await pg.evaluate(() => byId('infoPop').classList.contains('show'));
          await pg.keyboard.press('Escape'); await sleep(150);
          const cl = await pg.evaluate(() => !byId('infoPop').classList.contains('show'));
          log(op && cl, 'X', `${tag}: ⓘ opens / Esc closes`);
          await hit(pg, '#modeStudy');
          for (const tab of TABS) { await hit(pg, `.study-tab[data-tab="${tab}"]`, { guard: false }); await sleep(80); }
          if (c.width >= 1024) {
            const L = await pg.evaluate(() => ({ inRail: ['studyTabs', 'studyChips', 'studySubChips', 'studySearch', 'studyCount'].every(id => byId(id).closest('.study-rail')), still: document.scrollingElement.scrollHeight <= document.scrollingElement.clientHeight + 1, grid: getComputedStyle(document.querySelector('#studyContent .memo-grid')).gridTemplateColumns.split(' ').length }));
            log(L.inRail && L.still && L.grid === 3, 'X', `${tag}: desktop rail built from the old shell's parts, page one screen high, memo 3 columns`, L);
          }
          await hit(pg, '.study-tab[data-tab="chapters"]', { guard: false }); await sleep(150);
          const mem = await pg.evaluate(() => { const s = document.querySelector('#studyContent .fact-mem summary'); return s && { icon: s.querySelector('svg')?.dataset.iconName, before: getComputedStyle(s, '::before').content }; });
          log(!!mem && mem.icon === 'chevronRight' && (mem.before === 'none' || mem.before === 'normal'), 'X', `${tag}: memory note chevron line icon, no ▸ (::before ${mem && mem.before})`, mem);
          await iconAudit(pg, 'X', `${tag} Study`);
          await hit(pg, '.study-tab[data-tab="memo"]', { guard: false }); await sleep(150);
          await pg.locator('#studyContent .memo-card[data-arg="vote"]').scrollIntoViewIfNeeded();
          await hit(pg, '#studyContent .memo-card[data-arg="vote"]');
          await hit(pg, '#memoBody .memo-start');
          await answerCurrent(pg);
          await hit(pg, '#screenQuiz .back-btn');
          const left = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, ret: sessionReturn }));
          log(left.s === 'screenMemo' && left.ret === null, 'X', `${tag}: memo test ‹ Memory → look`, left);
          noErrors(pg, 'X', tag);
          if (c.width === 1280) await shot(pg, `X-old-${name}-shell-desktop-memo`);
        } catch (e) { log(false, 'RUN', `X ${tag}: harness error ${e.message.split('\n')[0]}`); }
        await pg.ctx.close();
      }
    } finally {
      s.server.kill();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}

(async () => {
  browser = await chromium.launch(launchOpts);
  ({ base, server } = await startPagesServer(ROOT));
  try {
    if (want('D')) await sectionD();
    if (want('F')) await sectionF();
    if (want('B')) await sectionB();
    if (want('C')) await sectionC();
    if (want('O')) await sectionO();
    if (want('X')) await sectionX();
  } catch (e) {
    log(false, 'RUN', 'script error: ' + e.stack);
  }
  server.kill();
  await browser.close();
  console.log(`\n${res.filter(r => r.ok).length} / ${res.length} ok`);
  if (findings.length) console.log('FINDINGS\n' + findings.join('\n'));
  if (obs.length) console.log('NOTES\n' + obs.join('\n'));
})();
