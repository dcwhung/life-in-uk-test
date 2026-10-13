// QA v2.0.5 — CUI-0037: the Home "Wrong answers" review tile's red ✗ glyph is now the SVG line icon `cross`
// (js/components/icons.js, js/screens/home.js, css/screens/home.css; S-254 dropped the icon box's glyph font styles).
//   H  Home matrix: 320×568 / 390×844 / 1024×768 / 1280×800 × en / zh-HK × small / large × translation on / off, each with
//      6 seeds (none / 3 wrong + 1 flag / 0 wrong + 1 flag / 3 wrong + 0 flag / 30 wrong + 2 flags / 30 wrong + 0 flag):
//      tile mark (line cross, aria-hidden, no text, red token, stroke 2.6, flagged-bookmark size, centred), counts, title
//      and body text, disabled state, no h-scroll; every visible Home element's rect vs main 5695a6c (same config + seed)
//      outside the .t-icon contents
//   T  tap the wrong tile (touch / mouse) → wrong-answers review round (examNum wrong, practice, ≤ 24, distinct);
//      empty tile is inert; Exam mode hides My review; Study → back keeps the tiles
//   E  edge cases: copies of one question count once; stale (unknown) key in the stored list; live language / text-size /
//      translation switch re-renders the cross; double tap starts one round; forced-colors keeps the cross visible
//   O  SW upgrade v2.0.4 (main 5695a6c) → v2.0.5: cache lifeuk-v2.0.5, new icons.js / home.js, offline reload + tile
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium node 2026-10-13_qa-v205.js [H T E O]
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../../..');
const { startPagesServer, appFiles } = require(path.join(ROOT, 'tests/pages-server.js'));
const SHOTS = path.join(__dirname, '../screenshots/v205');
fs.mkdirSync(SHOTS, { recursive: true });
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const ONLY = process.argv.slice(2);
const want = s => !ONLY.length || ONLY.includes(s);
const BASE_REV = '5695a6c';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const res = [];
const findings = [];
const obs = [];
const log = (ok, id, m, extra) => {
  res.push({ ok, id, m });
  if (!ok) findings.push(id + ' ' + m + (extra !== undefined ? ' ' + JSON.stringify(extra).slice(0, 1500) : ''));
  if (!ok || process.env.VERBOSE) console.log((ok ? 'ok   ' : 'FAIL ') + id + ' ' + m + (extra !== undefined && !ok ? ' ' + JSON.stringify(extra).slice(0, 900) : ''));
};
const note = (id, m) => { obs.push(id + ' ' + m); console.log('note ' + id + ' ' + m); };
const NOON = new Date('2026-10-13T12:00:00+01:00');
const VPS = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }];
const LANGS = ['en', 'zh-HK'];
const FONTS = ['small', 'large'];
const TRANS = ['on', 'off'];
const range = (ex, n) => Array.from({ length: n }, (_, i) => `${ex}.${i}`);
const SEEDS = {
  none: { wrong: [], flags: [] },
  w3f1: { wrong: ['1.0', '1.1', '2.3'], flags: ['3.0'] },
  w0f1: { wrong: [], flags: ['3.0'] },
  w3f0: { wrong: ['1.0', '1.1', '2.3'], flags: [] },
  w30f2: { wrong: [...range(1, 24), ...range(2, 6)], flags: ['3.0', '3.1'] },
  w30f0: { wrong: [...range(1, 24), ...range(2, 6)], flags: [] },
};

let browser, head, baseSrv;

async function newPage(srv, { width, height, lang = 'en', font = 'small', trans = 'on', touch, mode = 'practice', sw = 'block' }) {
  touch = touch === undefined ? width < 1024 : touch;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1,
    timezoneId: 'Europe/London', serviceWorkers: sw });
  await ctx.clock.setFixedTime(NOON);
  const pg = await ctx.newPage();
  pg.errs = [];
  pg.on('pageerror', e => pg.errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'error' || /\[i18n\] missing key/.test(m.text())) pg.errs.push(m.text()); });
  await pg.goto(srv.base + 'index.html');
  pg.cfg = { lang, font, trans, mode };
  pg.ctx = ctx;
  pg.touch = touch;
  return pg;
}
// localStorage seed + reload: the tiles are drawn from the stored lists on load (store.js)
async function seed(pg, s, extra = {}) {
  const { lang, font, trans, mode } = { ...pg.cfg, ...extra };
  await pg.evaluate(([l, f, t, m, w, fl]) => {
    localStorage.clear();
    localStorage.setItem('lifeuk.uiLang', JSON.stringify(l));
    localStorage.setItem('lifeuk.fontSize', JSON.stringify(f));
    if (t === 'off') localStorage.setItem('lifeuk.translation', JSON.stringify('off'));
    localStorage.setItem('lifeuk.homePrefs', JSON.stringify({ mode: m, view: 'difficulty' }));
    localStorage.setItem('lifeuk.installDismissed', JSON.stringify(true));
    localStorage.setItem('lifeuk.wrongList', JSON.stringify(Object.fromEntries(w.map(k => [k, true]))));
    localStorage.setItem('lifeuk.practiceFlags', JSON.stringify(Object.fromEntries(fl.map(k => [k, true]))));
  }, [lang, font, trans, mode, s.wrong, s.flags]);
  await pg.reload();
  await pg.waitForSelector('#screenHome.active');
  await pg.evaluate(() => document.fonts.ready);
  await pg.evaluate(() => window.scrollTo(0, 0)); // a reload restores the last scroll (screenshots scroll My review into view)
  await sleep(120);
}

// the two tiles as drawn, plus the expected numbers / strings from the app's own helpers
const tileState = pg => pg.evaluate(() => {
  const probe = document.createElement('i');
  probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--red-light').trim();
  document.body.appendChild(probe);
  const red = getComputedStyle(probe).color;
  probe.remove();
  const one = sel => {
    const tile = document.querySelector(sel), box = tile.querySelector('.t-icon'), svg = box && box.querySelector('svg');
    const br = box.getBoundingClientRect(), sr = svg ? svg.getBoundingClientRect() : null, tr = tile.getBoundingClientRect();
    const cs = svg ? getComputedStyle(svg) : null;
    return {
      shown: tile.getClientRects().length > 0, disabled: tile.disabled, empty: tile.classList.contains('empty'),
      text: box.textContent.trim(), icon: svg ? (svg.dataset.iconName || svg.getAttribute('class')) : null,
      line: !!svg && svg.matches('svg.line-icon'), ariaHidden: svg ? svg.getAttribute('aria-hidden') : null,
      focusable: svg ? svg.getAttribute('focusable') : null, paths: svg ? svg.querySelectorAll('path').length : 0,
      w: sr ? +sr.width.toFixed(2) : 0, h: sr ? +sr.height.toFixed(2) : 0, boxW: +br.width.toFixed(2), boxH: +br.height.toFixed(2),
      dx: sr ? +Math.abs((sr.left + sr.right) / 2 - (br.left + br.right) / 2).toFixed(2) : 99,
      dy: sr ? +Math.abs((sr.top + sr.bottom) / 2 - (br.top + br.bottom) / 2).toFixed(2) : 99,
      stroke: cs ? cs.stroke : '', strokeW: cs ? cs.strokeWidth : '', fill: cs ? cs.fill : '', boxBg: getComputedStyle(box).backgroundColor,
      opacity: getComputedStyle(box).opacity,
      num: tile.querySelector('.t-num').textContent, title: tile.querySelector('b').textContent,
      body: (tile.querySelector('.t-note, .sub') || { textContent: '' }).textContent, bodyCls: (tile.querySelector('.t-note, .sub') || { className: '' }).className,
      inView: tr.left >= -0.5 && tr.right <= innerWidth + 0.5, top: Math.round(tr.top), left: Math.round(tr.left),
    };
  };
  const wrongN = questionGroups(keysOf(wrongList)).length, flagN = questionGroups(keysOf(practiceFlags)).length;
  return {
    red, wrongN, flagN, section: byId('myReview').classList.contains('show'), mode: pendingMode,
    exp: { wrongTitle: t('home.wrongTitle'), flaggedTitle: t('home.flaggedTitle'), note: t('home.myReviewNote', { max: PRACTICE_ROUND_MAX }), wrongEmpty: t('home.wrongEmpty') },
    wrong: one('#tileWrong'), flag: one('#tileFlagged'),
    hScroll: document.scrollingElement.scrollWidth > innerWidth + 0.5, sw: document.scrollingElement.scrollWidth,
  };
});

// every visible element on Home + header, keyed by its DOM path; the .t-icon box kept, its contents skipped
const layoutSnap = pg => pg.evaluate(() => {
  const out = {};
  const pathOf = el => { const p = []; for (let e = el; e && e !== document.body; e = e.parentElement) p.unshift(e.tagName + (e.id ? '#' + e.id : '') + ':' + [...e.parentElement.children].indexOf(e)); return p.join('>'); };
  for (const el of document.querySelectorAll('header *, #screenHome *')) {
    if (el.closest('.t-icon') && !el.classList.contains('t-icon')) continue;
    if (el.closest('svg') && el.tagName !== 'svg') continue;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    out[pathOf(el)] = [r.left, r.top, r.width, r.height].map(v => Math.round(v * 2) / 2);
  }
  return { rects: out, sh: document.scrollingElement.scrollHeight };
});
function diffSnap(a, b) {
  const d = [];
  for (const k of new Set([...Object.keys(a.rects), ...Object.keys(b.rects)])) {
    const x = a.rects[k], y = b.rects[k];
    if (!x || !y) { d.push({ k: k.slice(-90), only: x ? 'base' : 'head' }); continue; }
    if (x.some((v, i) => Math.abs(v - y[i]) > 0.5)) d.push({ k: k.slice(-90), base: x, head: y });
  }
  if (a.sh !== b.sh) d.push({ scrollHeight: [a.sh, b.sh] });
  return d;
}

function checkTiles(st, id, tag, seedName) {
  const { wrong: w, flag: f } = st;
  const wantSection = st.mode === 'practice' && st.wrongN + st.flagN > 0;
  log(st.section === wantSection, id, `${tag} ${seedName}: My review ${wantSection ? 'shown' : 'hidden'} (wrong ${st.wrongN}, flags ${st.flagN})`, st);
  log(!st.hScroll, id, `${tag} ${seedName}: no h-scroll`, { sw: st.sw });
  if (!wantSection) return;
  log(w.shown && f.shown && w.inView && f.inView, id, `${tag} ${seedName}: both tiles visible in the viewport width`, { w, f });
  log(w.line && w.icon === 'cross' && w.text === '' && w.ariaHidden === 'true' && w.paths === 2, id,
    `${tag} ${seedName}: wrong mark = svg.line-icon cross (2 strokes), aria-hidden, no glyph text`, w);
  log(w.stroke === st.red && w.fill === 'none' && w.strokeW === '2.6px', id, `${tag} ${seedName}: cross stroke = --red-light ${st.red}, fill none, 2.6`, w);
  log(Math.abs(w.w - f.w) < 0.1 && Math.abs(w.h - f.h) < 0.1 && w.w > 0 && Math.abs(w.boxW - f.boxW) < 0.1, id,
    `${tag} ${seedName}: cross ${w.w}×${w.h} = bookmark ${f.w}×${f.h}, same box ${w.boxW}`, { w, f });
  log(w.dx <= 0.6 && w.dy <= 0.6 && f.dx <= 0.6 && f.dy <= 0.6, id, `${tag} ${seedName}: marks centred in their box (wrong dx ${w.dx} dy ${w.dy})`, { w, f });
  log(w.num === String(st.wrongN) && f.num === String(st.flagN), id, `${tag} ${seedName}: counts ${w.num} / ${f.num}`, { w: w.num, f: f.num, st: [st.wrongN, st.flagN] });
  log(w.title === st.exp.wrongTitle && f.title === st.exp.flaggedTitle, id, `${tag} ${seedName}: titles`, { w: w.title, f: f.title });
  const body = st.wrongN ? (w.bodyCls.includes('t-note') && w.body === st.exp.note) : (w.bodyCls.includes('sub') && w.body === st.exp.wrongEmpty);
  log(body, id, `${tag} ${seedName}: wrong body ${st.wrongN ? 'note (up to 24 / round)' : 'empty line'}`, { body: w.body, cls: w.bodyCls });
  log(w.disabled === !st.wrongN && w.empty === !st.wrongN && f.disabled === !st.flagN, id, `${tag} ${seedName}: disabled iff count 0`, { w: w.disabled, f: f.disabled });
}

// ════════════════ H: matrix + layout vs main ════════════════
async function sectionH() {
  for (const vp of VPS) for (const lang of LANGS) for (const font of FONTS) for (const trans of TRANS) {
    const tag = `${vp.width}x${vp.height} ${lang} ${font} tr-${trans}`;
    const cfg = { ...vp, lang, font, trans };
    const ph = await newPage(head, cfg), pb = await newPage(baseSrv, cfg);
    try {
      for (const [name, s] of Object.entries(SEEDS)) {
        await seed(ph, s); await seed(pb, s);
        const st = await tileState(ph);
        checkTiles(st, 'H', tag, name);
        const d = diffSnap(await layoutSnap(pb), await layoutSnap(ph));
        log(!d.length, 'H', `${tag} ${name}: every visible Home element (outside .t-icon contents) same rect as main ${BASE_REV}`, d.slice(0, 8));
        const bst = await tileState(pb);
        if (bst.section) log(bst.wrong.text === '✗' && !bst.wrong.icon, 'H', `${tag} ${name}: main still draws the ✗ glyph (baseline sanity)`, bst.wrong);
        if (font === 'small' && trans === 'on' && (name === 'w3f1' || name === 'w30f2' || name === 'w0f1')) {
          await ph.locator('#myReview').scrollIntoViewIfNeeded();
          await ph.locator('#myReview').screenshot({ path: path.join(SHOTS, `H-${vp.width}-${lang}-${name}.png`) });
        }
        if (font === 'large' && trans === 'on' && name === 'w30f2' && lang === 'zh-HK') {
          await ph.locator('#myReview').scrollIntoViewIfNeeded();
          await ph.locator('#myReview').screenshot({ path: path.join(SHOTS, `H-${vp.width}-${lang}-large-${name}.png`) });
          await pb.locator('#myReview').scrollIntoViewIfNeeded();
          await pb.locator('#myReview').screenshot({ path: path.join(SHOTS, `H-${vp.width}-${lang}-large-${name}-main.png`) });
        }
      }
      log(!ph.errs.length, 'H', `${tag}: no page / console errors`, ph.errs);
    } catch (e) { log(false, 'RUN', `H ${tag}: harness error ${e.message.split('\n')[0]}`); }
    await ph.ctx.close(); await pb.ctx.close();
  }
}

// ════════════════ T: tap → round; Exam / Study ════════════════
async function hit(pg, sel) { if (pg.touch) await pg.locator(sel).tap({ timeout: 8000 }); else await pg.locator(sel).click({ timeout: 8000 }); await sleep(450); }
async function sectionT() {
  const cfgs = [];
  for (const vp of VPS) for (const lang of LANGS) cfgs.push({ ...vp, lang, font: lang === 'en' ? 'small' : 'large', trans: lang === 'en' ? 'on' : 'off' });
  for (const cfg of cfgs) {
    const tag = `${cfg.width}x${cfg.height} ${cfg.lang} ${cfg.font} tr-${cfg.trans}`;
    const pg = await newPage(head, cfg);
    try {
      for (const name of ['w3f1', 'w30f2']) {
        await seed(pg, SEEDS[name]);
        const n = (await tileState(pg)).wrongN;
        await pg.locator('#tileWrong').scrollIntoViewIfNeeded();
        await hit(pg, '#tileWrong');
        const q = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, exam: state.examNum, mode: state.mode,
          len: state.questions.length, distinct: questionGroups(state.questions.map(qKey)).length, total: state.reviewTotal,
          inWrong: state.questions.every(x => wrongList[qKey(x)]) }));
        const want = Math.min(n, 24);
        log(q.screen === 'screenQuiz' && q.exam === 'wrong' && q.mode === 'practice' && q.len === want && q.distinct === want && q.total === n && q.inWrong,
          'T', `${tag} ${name}: tap wrong tile → wrong-answers review round (${q.len} of ${n}, practice, all from the wrong list)`, q);
        if (name === 'w30f2' && cfg.lang === 'en') await pg.screenshot({ path: path.join(SHOTS, `T-${cfg.width}-round.png`) });
        await pg.evaluate(() => goHome()); await sleep(300);
        const back = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, icon: document.querySelector('#tileWrong .t-icon svg')?.dataset.iconName }));
        if (back.s !== 'screenHome') { await pg.evaluate(() => document.querySelector('#confirmModal.show .btn-ok, #confirmModal.show [data-modal-ok]')?.click()); await sleep(300); }
        const back2 = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, icon: document.querySelector('#tileWrong .t-icon svg')?.dataset.iconName }));
        log(back2.s === 'screenHome' && back2.icon === 'cross', 'T', `${tag} ${name}: back Home, cross redrawn`, back2);
      }
      // empty wrong tile is inert
      await seed(pg, SEEDS.w0f1);
      await pg.locator('#tileWrong').scrollIntoViewIfNeeded();
      await pg.locator('#tileWrong').click({ force: true, timeout: 3000 }).catch(() => {}); await sleep(300);
      log(await pg.evaluate(() => document.querySelector('.screen.active').id) === 'screenHome', 'T', `${tag}: empty (disabled) wrong tile does nothing`);
      // Exam mode hides My review (both seeds), switching back to Practice shows it with the cross
      await seed(pg, SEEDS.w30f2, { mode: 'exam' });
      const ex = await tileState(pg);
      log(!ex.section && ex.mode === 'exam' && !ex.wrong.shown, 'T', `${tag}: Exam mode (stored) — My review hidden`, { section: ex.section, mode: ex.mode });
      await pg.evaluate(() => window.scrollTo(0, 0));
      await hit(pg, '#modePractice');
      const pr = await tileState(pg);
      log(pr.section && pr.wrong.icon === 'cross' && pr.wrong.w === pr.flag.w && !pr.hScroll, 'T', `${tag}: tap Practice → My review shown, cross at bookmark size`, pr.wrong);
      await hit(pg, '#modeExam');
      log(!(await tileState(pg)).section, 'T', `${tag}: tap Exam → hidden again`);
      // Study and back
      await hit(pg, '#modePractice');
      await pg.evaluate(() => window.scrollTo(0, 0));
      await hit(pg, '#modeStudy');
      const inStudy = await pg.evaluate(() => document.querySelector('.screen.active').id);
      await pg.evaluate(() => goHome()); await sleep(300);
      const so = await tileState(pg);
      log(inStudy === 'screenStudy' && so.section && so.wrong.icon === 'cross' && so.wrong.num === String(so.wrongN), 'T', `${tag}: Study → Home keeps Practice + tiles (cross, ${so.wrongN})`, { inStudy, w: so.wrong });
      log(!pg.errs.length, 'T', `${tag}: no page / console errors`, pg.errs);
    } catch (e) { log(false, 'RUN', `T ${tag}: harness error ${e.message.split('\n')[0]}`); }
    await pg.ctx.close();
  }
}

// ════════════════ E: edge cases ════════════════
async function sectionE() {
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const tag = `${vp.width}x${vp.height}`;
    const pg = await newPage(head, { ...vp, lang: 'en', font: 'small' });
    try {
      // E1 copies of one question text count once (G40)
      await seed(pg, SEEDS.none);
      const copies = await pg.evaluate(() => { for (const k of Object.keys(QUESTION_COPIES.copies)) { const c = QUESTION_COPIES.copies[k]; if (c.length > 1) return c; } return null; });
      if (copies) {
        await seed(pg, { wrong: [...copies, '1.5'], flags: [] });
        const st = await tileState(pg);
        log(st.wrong.num === '2' && st.wrong.icon === 'cross', 'E', `${tag} E1: ${copies.length} copies of one question + 1 other → count 2, cross`, { copies, num: st.wrong.num });
        await pg.locator('#tileWrong').scrollIntoViewIfNeeded();
        await hit(pg, '#tileWrong');
        const q = await pg.evaluate(() => ({ len: state.questions.length, total: state.reviewTotal }));
        log(q.len === 2 && q.total === 2, 'E', `${tag} E1: the round asks 2 (copies once)`, q);
      } else note('E', 'E1 no question copies in the data set');
      // E2 a stale key (not a question) in the stored wrong list
      pg.errs.length = 0;
      await seed(pg, { wrong: ['99.99', '1.2'], flags: [] });
      const st2 = await tileState(pg);
      log(st2.wrong.icon === 'cross' && !pg.errs.length, 'E', `${tag} E2: stale key 99.99 + 1.2 stored — Home draws (count ${st2.wrong.num}), cross, no error`, { num: st2.wrong.num, errs: pg.errs });
      await pg.locator('#tileWrong').scrollIntoViewIfNeeded();
      await hit(pg, '#tileWrong');
      const q2 = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, len: state.questions && state.questions.length, keys: state.questions && state.questions.map(x => x && qKey(x)) })).catch(e => ({ err: e.message }));
      log(!pg.errs.length && q2.s === 'screenQuiz', 'E', `${tag} E2: tap → round starts without a page error (${JSON.stringify(q2).slice(0, 120)})`, { q2, errs: pg.errs });
      if (st2.wrong.num !== '1') note('E', `${tag} E2: stale key counted on the tile: ${st2.wrong.num} for 1 real question`);
      // E2b same with an out-of-range index of a real exam, and both on main (is it pre-existing?)
      for (const [srv, who] of [[head, 'v2.0.5'], [baseSrv, 'main ' + BASE_REV]]) {
        for (const stale of ['99.99', '1.999']) {
          const p = await newPage(srv, { ...vp, lang: 'en', font: 'small' });
          await seed(p, { wrong: [stale, '1.2'], flags: [] });
          const num = await p.evaluate(() => document.querySelector('#tileWrong .t-num').textContent);
          await p.locator('#tileWrong').scrollIntoViewIfNeeded();
          await hit(p, '#tileWrong');
          const r = await p.evaluate(() => ({ s: document.querySelector('.screen.active').id, q: byId('qNum').textContent.slice(0, 40) }));
          note('E', `${tag} E2b ${who} stale ${stale}: tile count ${num}, tap → ${r.s} ${JSON.stringify(r.q)}, errors ${JSON.stringify(p.errs).slice(0, 160)}`);
          if (vp.width === 390 && stale === '1.999') await p.screenshot({ path: path.join(SHOTS, `E2-stale-key-${who.split(' ')[0]}.png`) });
          await p.ctx.close();
        }
      }
      // E3 live language / text size / translation switch on Home with the tiles shown
      pg.errs.length = 0;
      await seed(pg, SEEDS.w3f1);
      await pg.evaluate(() => setLang('zh-HK')); await sleep(250);
      let st = await tileState(pg);
      log(st.wrong.icon === 'cross' && st.wrong.title === '錯題' && st.wrong.w === st.flag.w && st.wrong.dx <= 0.6, 'E', `${tag} E3: live en → zh-HK keeps the cross, title 錯題`, st.wrong);
      await pg.evaluate(() => { setFontSize('large'); rerenderCurrentScreen(); }); await sleep(250);
      st = await tileState(pg);
      log(st.wrong.icon === 'cross' && st.wrong.w === st.flag.w && st.wrong.dx <= 0.6 && st.wrong.dy <= 0.6 && !st.hScroll, 'E', `${tag} E3: live text size large keeps cross centred at bookmark size`, st.wrong);
      await pg.evaluate(() => { setTranslationOn(false); rerenderCurrentScreen(); }); await sleep(250);
      st = await tileState(pg);
      log(st.wrong.icon === 'cross' && !pg.errs.length, 'E', `${tag} E3: live translation off keeps the cross`, { w: st.wrong, errs: pg.errs });
      // E4 double tap starts one round (the second tap lands on the quiz, not a second start)
      await seed(pg, SEEDS.w30f2);
      await pg.locator('#tileWrong').scrollIntoViewIfNeeded();
      await pg.evaluate(() => { window.__starts = 0; const o = window.startExam; window.startExam = (...a) => { window.__starts++; return o(...a); }; });
      const loc = pg.locator('#tileWrong');
      const box = await loc.boundingBox();
      if (pg.touch) { await pg.touchscreen.tap(box.x + 20, box.y + 20); await pg.touchscreen.tap(box.x + 20, box.y + 20); }
      else await pg.mouse.dblclick(box.x + 20, box.y + 20);
      await sleep(500);
      const dbl = await pg.evaluate(() => ({ starts: window.__starts, s: document.querySelector('.screen.active').id, len: state.questions.length }));
      log(dbl.starts === 1 && dbl.s === 'screenQuiz' && dbl.len === 24, 'E', `${tag} E4: double tap on the wrong tile starts one round`, dbl);
      // E5 forced-colors: the cross still paints (currentColor follows the system colour)
      await pg.emulateMedia({ forcedColors: 'active' });
      await seed(pg, SEEDS.w3f1);
      const fc = await pg.evaluate(() => { const s = document.querySelector('#tileWrong .t-icon svg'); const cs = getComputedStyle(s); return { stroke: cs.stroke, color: cs.color, bg: getComputedStyle(s.parentElement).backgroundColor, vis: s.getBoundingClientRect().width }; });
      log(fc.vis > 0 && fc.stroke !== 'none' && fc.stroke !== fc.bg, 'E', `${tag} E5: forced-colors — cross stroke ${fc.stroke} differs from box ${fc.bg}`, fc);
      await pg.locator('#myReview').scrollIntoViewIfNeeded();
      await pg.locator('#myReview').screenshot({ path: path.join(SHOTS, `E-${vp.width}-forced-colors.png`) });
      await pg.emulateMedia({ forcedColors: 'none', colorScheme: 'dark' });
      await seed(pg, SEEDS.w3f1);
      const dk = await tileState(pg);
      log(dk.wrong.stroke === dk.red && dk.wrong.icon === 'cross', 'E', `${tag} E6: prefers dark — cross still the red token ${dk.red}`, dk.wrong);
    } catch (e) { log(false, 'RUN', `E ${tag}: harness error ${e.message.split('\n')[0]}`); }
    await pg.ctx.close();
  }
}

// ════════════════ O: SW upgrade v2.0.4 → v2.0.5 + offline ════════════════
function copyApp(fromRoot, dest) { for (const f of appFiles(fromRoot)) execSync(`cp -r "${path.join(fromRoot, f)}" "${dest}/"`); }
async function sectionO(oldDir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa205-'));
  const site = path.join(tmp, 'site');
  fs.mkdirSync(site);
  copyApp(oldDir, site);
  const s = await startPagesServer(site);
  try {
    for (const vp of [{ width: 390, height: 844, touch: true }, { width: 1280, height: 800, touch: false }]) {
      const tag = `${vp.width}`;
      execSync(`rm -rf "${site}"/*`);
      copyApp(oldDir, site); // each viewport starts from the v2.0.4 site (the previous one left v2.0.5 there)
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.touch, hasTouch: vp.touch, timezoneId: 'Europe/London' });
      const pg = await ctx.newPage();
      const errs = [];
      pg.on('pageerror', e => errs.push(e.message));
      await pg.goto(s.base + 'index.html');
      await pg.evaluate(() => navigator.serviceWorker.ready);
      await pg.evaluate(() => {
        localStorage.setItem('lifeuk.uiLang', JSON.stringify('en'));
        localStorage.setItem('lifeuk.homePrefs', JSON.stringify({ mode: 'practice', view: 'difficulty' }));
        localStorage.setItem('lifeuk.wrongList', JSON.stringify({ '1.0': true, '1.1': true, '2.3': true }));
        localStorage.setItem('lifeuk.practiceFlags', JSON.stringify({ '3.0': true }));
      });
      await pg.reload(); await sleep(600);
      const v0 = await pg.evaluate(async () => ({ v: APP_VERSION, ctrl: !!navigator.serviceWorker.controller, caches: await caches.keys(), txt: document.querySelector('#tileWrong .t-icon').textContent.trim() }));
      log(v0.v === '2.0.4' && v0.ctrl && v0.txt === '✗', 'O', `${tag}: v2.0.4 (main ${BASE_REV}) installed, SW controlling, tile shows ✗ (caches ${v0.caches.join(',')})`, v0);
      await pg.locator('#myReview').screenshot({ path: path.join(SHOTS, `O-${tag}-before-v204.png`) });
      execSync(`rm -rf "${site}"/*`);
      copyApp(ROOT, site);
      let v = null;
      for (let k = 0; k < 10; k++) {
        await pg.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r && r.update())).catch(() => {});
        await sleep(1200);
        await pg.reload().catch(() => {}); await sleep(800);
        v = await pg.evaluate(() => typeof APP_VERSION !== 'undefined' ? APP_VERSION : null).catch(() => null);
        if (v === '2.0.5') break;
      }
      const keys = await pg.evaluate(() => caches.keys());
      log(v === '2.0.5' && keys.includes('lifeuk-v2.0.5') && !keys.includes('lifeuk-v2.0.4'), 'O', `${tag}: SW upgrade → APP_VERSION ${v}, caches ${keys.join(',')}`, { v, keys });
      const cached = await pg.evaluate(async () => {
        const c = await caches.open('lifeuk-v2.0.5');
        const sw = await (await fetch('sw.js')).text();
        const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
        const missing = [];
        for (const f of shell) if (!(await c.match(f))) missing.push(f);
        const icons = await (await c.match('js/components/icons.js')).text();
        const home = await (await c.match('js/screens/home.js')).text();
        const css = await (await c.match('css/screens/home.css')).text();
        return { n: shell.length, missing, iconsCross: /cross: \['M6\.5 6\.5l11 11'/.test(icons), homeCross: home.includes("lineIconSvg('cross')"),
          cssStroke: css.includes('.my-tile .t-icon .line-icon { stroke-width: 2.6; }'), cssNoFont: !/\.my-tile \.t-icon \{[^}]*font-size/.test(css) };
      });
      log(!cached.missing.length && cached.iconsCross && cached.homeCross && cached.cssStroke && cached.cssNoFont, 'O',
        `${tag}: lifeuk-v2.0.5 holds all ${cached.n} SHELL files; cached icons.js has cross, home.js uses lineIconSvg('cross'), home.css 2.6 / no glyph font`, cached);
      const on = await tileState(pg);
      log(on.wrong.icon === 'cross' && on.wrong.text === '' && on.wrong.w === on.flag.w, 'O', `${tag}: after upgrade the tile shows the line cross`, on.wrong);
      await ctx.setOffline(true);
      await pg.reload(); await sleep(800);
      const off = await tileState(pg);
      const ver = await pg.evaluate(() => APP_VERSION);
      log(ver === '2.0.5' && off.wrong.icon === 'cross' && off.wrong.stroke === off.red && off.wrong.num === '3', 'O', `${tag}: offline reload — v2.0.5 from cache, cross red, count 3`, { ver, w: off.wrong });
      await pg.locator('#myReview').screenshot({ path: path.join(SHOTS, `O-${tag}-offline-v205.png`) });
      await pg.locator('#tileWrong').scrollIntoViewIfNeeded();
      if (vp.touch) await pg.locator('#tileWrong').tap(); else await pg.locator('#tileWrong').click();
      await sleep(500);
      const q = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, exam: state.examNum, len: state.questions.length }));
      log(q.s === 'screenQuiz' && q.exam === 'wrong' && q.len === 3, 'O', `${tag}: offline tap → wrong-answers round of 3`, q);
      log(!errs.length, 'O', `${tag}: SW upgrade + offline: no page errors`, errs);
      await ctx.close();
    }
  } finally {
    s.server.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

(async () => {
  browser = await chromium.launch(launchOpts);
  head = await startPagesServer(ROOT);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa205base-'));
  const old = path.join(tmp, 'old');
  execSync(`git -C "${ROOT}" worktree add --detach "${old}" ${BASE_REV} -q`);
  baseSrv = await startPagesServer(old);
  try {
    if (want('H')) await sectionH();
    if (want('T')) await sectionT();
    if (want('E')) await sectionE();
    if (want('O')) await sectionO(old);
  } catch (e) {
    log(false, 'RUN', 'script error: ' + e.stack);
  }
  head.server.kill(); baseSrv.server.kill();
  execSync(`git -C "${ROOT}" worktree remove --force "${old}"`);
  fs.rmSync(tmp, { recursive: true, force: true });
  await browser.close();
  console.log(`\n${res.filter(r => r.ok).length} / ${res.length} ok`);
  const by = {};
  for (const r of res) { by[r.id] = by[r.id] || [0, 0]; by[r.id][r.ok ? 0 : 1]++; }
  console.log('BY SECTION ' + JSON.stringify(by));
  if (findings.length) console.log('FINDINGS\n' + findings.join('\n'));
  if (obs.length) console.log('NOTES\n' + obs.join('\n'));
})();
