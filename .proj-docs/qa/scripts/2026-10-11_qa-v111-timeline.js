// QA v1.1.1 Study timeline (2026-10-11). Run from repo root:
//   NODE_PATH=<dir with playwright-core> CHROMIUM_PATH=/opt/pw-browsers/chromium node .proj-docs/qa/scripts/2026-10-11_qa-v111-timeline.js
// env: QA_ROOT (app dir, default repo root; point at an origin/main export for the regression baseline),
//      QA_OUT (screenshot dir; unset = no shots), QA_PART (timeline | regress | baseline | all, default all),
//      QA_JSON (write regression measurements as JSON here)
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const ROOT = process.env.QA_ROOT || path.resolve(__dirname, '..', '..', '..');
const APP_URL = 'file://' + path.join(ROOT, 'index.html');
const OUT = process.env.QA_OUT || '';
const PART = process.env.QA_PART || 'all';
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;

const WIDTHS = [430, 414, 390, 375, 360, 320, 1280];
const LANGS = ['en', 'zh-HK'];
const TOL = 0.5;
const CARD_LEFT_PHONE = 58;
const FIT_FROM = 390; // >= 390px every timeline table fits its card
const SCROLL_ALLOWED = ['8', '71', '72', '84', '87', '95']; // below 390px, in-table scroll only for these
const BOOKMARKS = [8, 30, 71, 120]; // 30 = war; 120 = not on the timeline (no year)
let pass = 0, fail = 0; const fails = [];
const check = (c, m) => { if (c) { pass++; } else { fail++; fails.push(m); console.log('FAIL:', m); } };

async function freshPage(b, width, lang) {
  const pg = await b.newPage({ viewport: { width, height: 844 } });
  await pg.clock.setFixedTime(new Date('2026-10-01T09:00:00'));
  pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message));
  await pg.goto(APP_URL);
  await pg.evaluate(l => { localStorage.clear(); localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); }, lang);
  await pg.reload();
  return pg;
}
const openTl = pg => pg.evaluate(() => { openStudy(); studySetTab('timeline'); });
const openAllMem = pg => pg.evaluate(() => document.querySelectorAll('#studyContent details.fact-mem').forEach(d => { d.open = true; }));

// every invariant of the timeline at the current state
async function measureTimeline(pg) {
  return pg.evaluate(() => {
    const vw = innerWidth;
    const rgb = n => { const i = document.createElement('i'); i.style.color = `var(${n})`; document.body.appendChild(i); const v = getComputedStyle(i).color; i.remove(); return v; };
    const items = [...document.querySelectorAll('#studyContent .tl-item')];
    const eras = [...document.querySelectorAll('#studyContent .tl-era')];
    const main = document.querySelector('#studyContent').getBoundingClientRect();
    scrollTo(500, scrollY); const sx = scrollX; scrollTo(0, scrollY);
    const rows = items.map((it, idx) => {
      const y = it.querySelector('.tl-year'), cs = getComputedStyle(y), a = getComputedStyle(y, '::after');
      const yr = y.getBoundingClientRect(), itr = it.getBoundingClientRect(), fact = it.querySelector('.fact'), card = fact.getBoundingClientRect();
      const rg = document.createRange(); rg.selectNodeContents(y);
      const rects = [...rg.getClientRects()].filter(x => x.width > 0);
      const textLeft = Math.min(...rects.map(x => x.left)), textRight = Math.max(...rects.map(x => x.right));
      const cTop = yr.top + parseFloat(cs.paddingTop), cBot = yr.bottom - parseFloat(cs.paddingBottom);
      const dotW = parseFloat(a.width) + 2 * parseFloat(a.borderLeftWidth);
      const m = a.transform === 'none' ? new DOMMatrix() : new DOMMatrix(a.transform);
      const dotL = yr.left + parseFloat(a.left) + m.m41, dotT = yr.top + parseFloat(a.top) + m.m42;
      const railCx = itr.left + parseFloat(getComputedStyle(it).borderLeftWidth) / 2;
      const next = items[idx + 1];
      return {
        id: fact.dataset.factId, war: it.classList.contains('war'), cardWar: fact.classList.contains('war'),
        cardL: card.left, cardR: card.right, itemR: itr.right,
        hOff: Math.abs(dotL + dotW / 2 - railCx), vOff: Math.abs(dotT + dotW / 2 - (cTop + cBot) / 2),
        dotLeftEdge: dotL - parseFloat(a.boxShadow.split(' ').slice(-1)[0]),
        lines: new Set(rects.map(x => Math.round(x.top))).size, textR: textRight, textL: textLeft,
        dotBg: a.backgroundColor, yearColor: cs.color, railColor: getComputedStyle(it).borderLeftColor, railW: getComputedStyle(it).borderLeftWidth,
        gapNext: next && it.nextElementSibling === next ? Math.abs(next.getBoundingClientRect().top - itr.bottom) : null,
        below: card.top - cBot,
      };
    });
    const wraps = [...document.querySelectorAll('#studyContent .note-table-wrap')];
    const openWraps = wraps.filter(w => w.closest('details').open);
    const scroll = openWraps.filter(w => w.scrollWidth > w.clientWidth + 0.5).map(w => w.closest('.fact').dataset.factId);
    const tableOut = openWraps.filter(w => w.getBoundingClientRect().right > w.closest('.fact').getBoundingClientRect().right + 0.5).map(w => w.closest('.fact').dataset.factId);
    const eraRows = eras.map(e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, ov: e.scrollWidth > e.clientWidth, h: r.height, text: e.textContent.trim() }; });
    return {
      vw, docW: document.documentElement.scrollWidth, bodyW: document.body.scrollWidth, sx, mainL: main.left, mainR: main.right,
      rows, eraRows, tables: openWraps.length, scroll, tableOut, empty: !!document.querySelector('#studyContent .study-empty'),
      count: document.getElementById('studyCount').textContent, lang: document.documentElement.lang,
      red: rgb('--red'), redLight: rgb('--red-light'), accent: rgb('--study-accent'), accentStrong: rgb('--study-accent-strong'),
    };
  });
}

function assertTimeline(m, tag, { expectTables = true } = {}) {
  const phone = m.vw < 780;
  check(m.docW <= m.vw && m.bodyW <= m.vw && m.sx === 0, `${tag}: no page h-scroll (doc ${m.docW}, body ${m.bodyW}, vw ${m.vw}, scrollX ${m.sx})`);
  const wide = m.rows.filter(r => r.cardR > m.vw + TOL || r.itemR > m.vw + TOL || r.cardR > m.mainR + TOL);
  check(wide.length === 0, `${tag}: no card past the screen / content edge (${wide.map(r => r.id).slice(0, 6)})`);
  const lefts = [...new Set(m.rows.map(r => Math.round(r.cardL * 10) / 10))];
  if (phone) check(lefts.length === 1 && Math.abs(lefts[0] - CARD_LEFT_PHONE) <= TOL, `${tag}: cards start ${CARD_LEFT_PHONE}px from screen (${lefts})`);
  else check(lefts.length === 1 && Math.abs(lefts[0] - (m.mainL + 42)) <= TOL, `${tag}: desktop cards 42px inside content column (${lefts}, main ${m.mainL})`);
  const bad = m.rows.filter(r => r.hOff > TOL || r.vOff > TOL || r.lines !== 1 || r.textL - r.dotLeftEdge < 6);
  check(bad.length === 0, `${tag}: ${m.rows.length} dots on rail + year middle, years one line (bad ${JSON.stringify(bad.slice(0, 2))})`);
  check(m.rows.every(r => r.dotLeftEdge >= 0), `${tag}: dot ring inside the screen`);
  const breaks = m.rows.filter(r => r.gapNext !== null && r.gapNext > TOL);
  check(breaks.length === 0, `${tag}: rail continuous between adjacent items (breaks ${breaks.length})`);
  check(m.rows.every(r => Math.abs(r.below - 16) <= TOL), `${tag}: year 16px above its card`);
  const war = m.rows.filter(r => r.war), peace = m.rows.filter(r => !r.war);
  check(war.length > 0 && war.every(r => r.dotBg === m.redLight && r.yearColor === m.red && r.cardWar), `${tag}: ${war.length} war items red dot / red year / war card`);
  check(peace.every(r => r.dotBg === m.accent && r.yearColor === m.accentStrong), `${tag}: non-war dots accent`);
  check(m.eraRows.length > 0 && m.eraRows.every(e => !e.ov && e.r <= m.vw + TOL && Math.abs(e.l - m.mainL) <= TOL && Math.abs(e.r - m.mainR) <= TOL), `${tag}: ${m.eraRows.length} era bars full content width, no text overflow`);
  if (expectTables && m.tables) {
    if (m.vw >= FIT_FROM) check(m.scroll.length === 0, `${tag}: all ${m.tables} tables fit (scroll ${m.scroll})`);
    else check(m.scroll.every(id => SCROLL_ALLOWED.includes(id)), `${tag}: in-table scroll only allow-list (${m.scroll})`);
    check(m.tableOut.length === 0, `${tag}: no table wrap past its card (${m.tableOut})`);
  }
}

async function partTimeline(b) {
  const summary = [];
  for (const lang of LANGS) for (const width of WIDTHS) {
    const tag = `${width}/${lang}`;
    const pg = await freshPage(b, width, lang);
    await openTl(pg);
    const closed = await measureTimeline(pg);
    assertTimeline(closed, tag + ' closed', { expectTables: false });
    check(closed.lang === lang, `${tag}: html lang ${closed.lang}`);
    await openAllMem(pg);
    const open = await measureTimeline(pg);
    assertTimeline(open, tag + ' all open');
    summary.push({ tag, items: open.rows.length, eras: open.eraRows.length, war: open.rows.filter(r => r.war).length, tables: open.tables, scroll: open.scroll.join(' ') || '-', docW: open.docW });
    if (OUT && [390, 320, 1280].includes(width)) {
      await pg.evaluate(() => document.querySelector('#studyContent .fact[data-fact-id="8"]').scrollIntoView({ block: 'start' }));
      await pg.screenshot({ path: path.join(OUT, `tl-${width}-${lang}.png`) });
    }

    // expand / collapse one card by clicking its summary (Stonehenge #8, widest table)
    await pg.evaluate(() => document.querySelectorAll('#studyContent details.fact-mem').forEach(d => { d.open = false; }));
    const h0 = await pg.$eval('#studyContent .fact[data-fact-id="8"]', e => e.getBoundingClientRect().height);
    await pg.click('#studyContent .fact[data-fact-id="8"] details.fact-mem > summary');
    const o = await pg.evaluate(() => { const f = document.querySelector('#studyContent .fact[data-fact-id="8"]'); const w = f.querySelector('.note-table-wrap');
      return { open: f.querySelector('details.fact-mem').open, h: f.getBoundingClientRect().height, r: f.getBoundingClientRect().right, wr: w.getBoundingClientRect().right, sw: w.scrollWidth, cw: w.clientWidth, doc: document.documentElement.scrollWidth, vw: innerWidth }; });
    check(o.open && o.h > h0 && o.r <= o.vw + TOL && o.wr <= o.r + TOL && o.doc <= o.vw, `${tag}: #8 opens by click, card inside screen (h ${h0}->${o.h}, table +${o.sw - o.cw})`);
    if (width >= FIT_FROM) check(o.sw <= o.cw, `${tag}: #8 table fits when opened`);
    else {
      // in-table scroll really scrolls and the page does not
      const s = await pg.evaluate(() => { const w = document.querySelector('#studyContent .fact[data-fact-id="8"] .note-table-wrap'); w.scrollLeft = 999; return { sl: w.scrollLeft, sx: scrollX, ox: getComputedStyle(w).overflowX }; });
      check(o.sw <= o.cw || (s.sl > 0 && s.sx === 0 && s.ox === 'auto'), `${tag}: #8 table scrolls inside itself (scrollLeft ${s.sl}, page scrollX ${s.sx})`);
    }
    await pg.click('#studyContent .fact[data-fact-id="8"] details.fact-mem > summary');
    const h1 = await pg.$eval('#studyContent .fact[data-fact-id="8"]', e => e.getBoundingClientRect().height);
    check(Math.abs(h1 - h0) <= TOL, `${tag}: #8 collapses back (${h0} vs ${h1})`);

    // search filter
    await pg.evaluate(() => { byId('studySearch').value = 'war'; studySetSearch('war'); });
    await openAllMem(pg);
    const sm = await measureTimeline(pg);
    check(sm.rows.length > 0 && sm.rows.length < open.rows.length, `${tag}: search "war" narrows timeline (${sm.rows.length})`);
    assertTimeline(sm, tag + ' search');
    await pg.evaluate(() => studySetSearch('zzzqqq'));
    const em = await measureTimeline(pg);
    check(em.empty && em.rows.length === 0 && em.eraRows.length === 0 && em.docW <= em.vw, `${tag}: no-match search shows empty state`);
    await pg.evaluate(() => { byId('studySearch').value = ''; studySetSearch(''); });

    // bookmarks only (+ war only)
    await pg.evaluate(ids => { ids.forEach(id => studyToggleMark('bookmarks', id)); studyToggle('bookmarksOnly'); }, BOOKMARKS);
    await openAllMem(pg);
    const bm = await measureTimeline(pg);
    const bmIds = bm.rows.map(r => r.id);
    check(bmIds.every(id => BOOKMARKS.map(String).includes(id)) && bmIds.length > 0, `${tag}: bookmarks-only shows only bookmarked (${bmIds})`);
    // bookmarked items are not adjacent: rail must still be continuous where they are, eras per item
    if (bm.rows.length) assertTimeline({ ...bm, rows: bm.rows }, tag + ' bookmarks', { expectTables: true });
    await pg.evaluate(() => { studyToggle('bookmarksOnly'); studyToggle('warsOnly'); });
    const wm = await measureTimeline(pg);
    check(wm.rows.length > 0 && wm.rows.every(r => r.war), `${tag}: wars-only shows ${wm.rows.length} war items only`);
    check(wm.docW <= wm.vw && wm.rows.every(r => r.hOff <= TOL && r.vOff <= TOL), `${tag}: wars-only layout ok`);
    await pg.evaluate(() => studyToggle('warsOnly'));

    // language switch re-render while on the timeline, memory notes open
    await openAllMem(pg);
    const other = lang === 'en' ? 'zh-HK' : 'en';
    const before = await pg.evaluate(() => [...document.querySelectorAll('#studyContent .tl-era')].map(e => e.textContent.trim()));
    await pg.evaluate(l => setLang(l), other);
    await pg.waitForTimeout(50);
    const sw = await measureTimeline(pg);
    check(sw.lang === other && sw.rows.length === open.rows.length, `${tag}: setLang(${other}) re-renders timeline (${sw.rows.length} items)`);
    check(JSON.stringify(sw.eraRows.map(e => e.text)) !== JSON.stringify(before), `${tag}: era labels change language`);
    check(await pg.evaluate(() => document.querySelector('.study-tab.active').dataset.tab) === 'timeline', `${tag}: still on timeline after language switch`);
    await openAllMem(pg);
    assertTimeline(await measureTimeline(pg), `${tag} after setLang(${other})`);
    await pg.evaluate(l => setLang(l), lang);
    assertTimeline(await measureTimeline(pg), `${tag} back to ${lang}`, { expectTables: false });
    check(pg.errs.length === 0, `${tag}: no page errors (${pg.errs.join('; ')})`);
    await pg.close();
  }
  console.table(summary);
}

// regression: fact cards on chapters / geo / people / plan runner, measured the same way on HEAD and origin/main
async function measureCards(pg, sel) {
  return pg.evaluate(sel => {
    document.querySelectorAll(sel + ' details.fact-mem').forEach(d => { d.open = true; });
    const cards = [...document.querySelectorAll(sel + ' .fact')];
    const wraps = [...document.querySelectorAll(sel + ' .note-table-wrap')];
    return {
      n: cards.length, docW: document.documentElement.scrollWidth, vw: innerWidth,
      lefts: [...new Set(cards.map(c => Math.round(c.getBoundingClientRect().left * 10) / 10))],
      widths: [...new Set(cards.map(c => Math.round(c.getBoundingClientRect().width * 10) / 10))],
      hash: cards.reduce((s, c) => s + Math.round(c.getBoundingClientRect().height), 0),
      scroll: wraps.filter(w => w.scrollWidth > w.clientWidth + 0.5).map(w => w.closest('.fact').dataset.factId).join(' '),
    };
  }, sel);
}
async function partRegress(b) {
  const res = {};
  for (const lang of LANGS) for (const width of WIDTHS) {
    const pg = await freshPage(b, width, lang);
    for (const ch of [1, 2, 3, 4, 5]) {
      await pg.evaluate(ch => { openStudy(); studySetTab('chapters'); studySetChapter(ch); }, ch);
      res[`${width}/${lang}/ch${ch}`] = await measureCards(pg, '#studyContent');
    }
    await pg.evaluate(() => { studySetTab('geo'); studySetNation('all'); });
    res[`${width}/${lang}/geo`] = await measureCards(pg, '#studyContent');
    await pg.evaluate(() => { studySetTab('people'); studySetGroup('all'); });
    res[`${width}/${lang}/people`] = await measureCards(pg, '#studyContent');
    await pg.evaluate(() => writeStudyPlan(buildPlan({ examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' }, '2026-10-01')));
    const runner = await pg.evaluate(() => {
      try {
        const plan = readStudyPlan(), d = plan.days[0], ri = d.tasks.findIndex(t => t.type === 'read');
        const out = [];
        for (let pos = 0; pos < Math.min(d.tasks[ri].facts.length, 4); pos++) {
          planShowFacts({ date: '2026-10-01', taskIndex: ri, from: '2026-10-01' }, pos, false);
          document.querySelectorAll('#planRunBody details.fact-mem').forEach(x => { x.open = true; });
          const c = document.querySelector('#planRunBody .fact').getBoundingClientRect();
          out.push({ l: Math.round(c.left * 10) / 10, w: Math.round(c.width * 10) / 10, h: Math.round(c.height), doc: document.documentElement.scrollWidth });
        }
        return out;
      } catch (e) { return 'ERR ' + e.message; }
    });
    res[`${width}/${lang}/planRun`] = runner;
    res[`${width}/${lang}/errs`] = pg.errs;
    await pg.close();
  }
  if (process.env.QA_JSON) fs.writeFileSync(process.env.QA_JSON, JSON.stringify(res, null, 1));
  for (const [k, v] of Object.entries(res)) {
    if (k.endsWith('/errs')) check(v.length === 0, `${k}: ${v}`);
    else if (Array.isArray(v)) check(v.length > 0 && v.every(x => x.doc <= +k.split('/')[0]), `${k}: plan runner fact cards no page h-scroll ${JSON.stringify(v)}`);
    else if (typeof v === 'string') check(false, `${k}: ${v}`);
    else check(v.n > 0 && v.docW <= v.vw, `${k}: ${v.n} cards, no page h-scroll`);
  }
  return res;
}

async function partBaseline(b) {
  const pg = await freshPage(b, 390, 'en');
  await openTl(pg);
  await pg.evaluate(() => {
    const f = document.querySelector('#studyContent .fact[data-fact-id="8"]');
    f.querySelector('details.fact-mem').open = true;
    const it = f.closest('.tl-item');
    scrollTo(0, it.getBoundingClientRect().top + scrollY - 70);
  });
  await pg.waitForTimeout(100);
  const shot = process.env.QA_BASELINE;
  if (shot) await pg.screenshot({ path: shot });
  const m = await measureTimeline(pg);
  check(m.docW <= m.vw, 'baseline 390: no h-scroll');
  await pg.close();
}

(async () => {
  const b = await chromium.launch(launchOpts);
  if (PART === 'all' || PART === 'timeline') await partTimeline(b);
  if (PART === 'all' || PART === 'regress') await partRegress(b);
  if (PART === 'all' || PART === 'baseline') await partBaseline(b);
  await b.close();
  console.log(`\n${fail ? 'QA FAIL' : 'QA PASS'} ${pass}/${pass + fail}`);
  if (fails.length) console.log(fails.slice(0, 40).join('\n'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
