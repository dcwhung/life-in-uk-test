// QA v1.5.1: compact Home study-plan card (variant C: 56px ring in .plan-home-head beside title + countdown) — real
// Chromium, file://, fixed clock. Adapted from 2026-10-12_qa-v150-home-ring-browser.js.
//   NODE_PATH=/opt/node-tools/node_modules node .proj-docs/qa/scripts/2026-10-12_qa-v151-home-compact-browser.js [shot-dir] [v150-root]
//   shot-dir defaults to screenshots/v151 (writes ~90 PNGs: pass a scratch dir); v150-root = an export of 826b3ed
//   (git archive 826b3ed | tar -x -C <dir>) for the card-height comparison (section D; skipped without it)
// A. matrix: 7 states × en / zh-HK × 320 / 390 / 1100 × small / large: ring only in 0 % / mid / 100 %; ring 56px, child of
//    .plan-home-head, right of .plan-home-head-txt, vertically centred, inside the card; no visible "Today's progress";
//    next step full content width below the head; card gap 10px with the ring / 12px without (.has-ring); "Day n / N"
//    one line box; 100 %: "See you tomorrow" / 「明日再來」 and exactly one ✓ (in the ring); no-ring states keep
//    .plan-home-top; acts right-aligned, buttons ≥ 44px, not clipped; no h-scroll / overflow / raw keys / page errors;
//    text contrast ≥ 4.5:1, ring text ≥ 4.5:1; ring text (diagonal) inside the hole
// B. taps: Continue → next task's runner; Schedule; 100 % View today's tasks → day; exam View today; ended New plan /
//    Change goal / Schedule; not started Schedule; rest day Continue → (catch-up) runner
// C. edge cases (new vs v1.5.0): nowrap at 320 en large (own line, single line box); ✓ / 99 % diagonal fit at large;
//    100 % + carry-over (✓ + catch-up next + Continue →, no "See you tomorrow"); midnight Day 4 → Day 5 redraw;
//    midnight 100 % → next day 0 % (✓ and "See you tomorrow" go); midnight Sat → Sun rest day (ring + .has-ring go,
//    .plan-home-top back); midnight last day → exam day (ring goes); live font-size / language switch re-lays the head;
//    unreadable log; keyboard order skips the ring
// D. card height v1.5.0 vs v1.5.1, every state, 390 × en / zh-HK × small / large
const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const appOf = root => 'file://' + path.join(root, 'index.html');
const APP = appOf(ROOT);
const SHOTS = path.resolve(process.argv[2] || path.join(__dirname, '..', 'screenshots', 'v151'));
const V150 = process.argv[3] ? path.resolve(process.argv[3]) : null;
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0; const bugs = [], notes = [];
const ok = (c, m, x) => { if (c) pass++; else { fail++; bugs.push(m + (x !== undefined ? ' ' + JSON.stringify(x) : '')); }
  console.log((c ? 'ok   ' : 'FAIL ') + m + (!c && x !== undefined ? ' ' + JSON.stringify(x) : '')); };
const note = m => { notes.push(m); console.log('note ' + m); };
const START = '2026-09-28', GOAL = { examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' };
const at = (iso, time = '09:00:00') => new Date(`${iso}T${time}`);
const LABEL = { en: { go: 'Continue →', view: "View today's tasks", lbl: "Today's progress", bye: 'See you tomorrow' },
  'zh-HK': { go: '繼續 →', view: '查看今日任務', lbl: '今日完成度', bye: '明日再來' } };
const RING = 56, GAP_RING = 10, GAP_PLAIN = 12;

const STATES = {
  zero: { today: '2026-09-29', log: 'zero' },
  mid: { today: '2026-10-01', log: 'mid' },
  full: { today: '2026-10-01', log: 'full' },
  rest: { today: '2026-10-04', log: 'mid' },
  exam: { today: '2026-10-29', log: 'mid' },
  ended: { today: '2026-10-30', log: 'mid' },
  notStarted: { today: '2026-09-26', log: 'none' },
};

// seeds the plan + log in the page (runs in the browser)
function seed({ lang, size, goal, start, log, extra, today }) {
  localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true');
  localStorage.setItem('lifeuk.uiLang', JSON.stringify(lang)); localStorage.setItem('lifeuk.fontSize', JSON.stringify(size));
  const plan = buildPlan(goal, start); writeStudyPlan(plan);
  const qidsOf = day => day.tasks.filter(t => t.type !== 'review').flatMap(planTaskQids);
  const okm = list => Object.fromEntries(list.map(k => [k, 1]));
  const [d1, d2, d3, d4] = plan.days;
  const days = {};
  if (log === 'zero') { const q1 = qidsOf(d1); days[d1.date] = { ok: okm(q1.slice(1)), bad: { [q1[0]]: 1 } };
    localStorage.setItem('lifeuk.wrongList', JSON.stringify({ [q1[0]]: true })); }
  if (log !== 'none' && log !== 'zero') {
    days[d1.date] = { ok: okm(qidsOf(d1)) }; days[d2.date] = { ok: okm(qidsOf(d2)) }; days[d3.date] = { ok: okm(qidsOf(d3)) };
    const p4 = d4.tasks[1].qids;
    days[d4.date] = log === 'full' ? { ok: okm(d4.tasks.flatMap(planTaskQids)) } : { ok: okm(p4.slice(0, 20)), bad: { [p4[25]]: 1 } };
  }
  writePlanLog({ v: 1, days });
  if (extra === 'brokenLog') localStorage.setItem('lifeuk.studyPlanProgress', '{bad');
  if (extra === 'carry') { const L = planLoadLog(); const q3 = qidsOf(d3); L.days[d3.date] = { ok: okm(q3.slice(0, 5)) }; writePlanLog(L); }
  if (extra === 'allDone') { // every plan day up to `today` fully answered (for the 100 % → next-day rollover)
    const L = planLoadLog(); plan.days.forEach(d => { if (d.date <= today) L.days[d.date] = { ok: okm(d.tasks.flatMap(planTaskQids)) }; }); writePlanLog(L); }
}

async function open(b, { w, lang, size, state, extra, app = APP, today, install }) {
  const s = STATES[state];
  const c = await b.newContext({ viewport: { width: w, height: 900 } }); const p = await c.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  if (install) await p.clock.install({ time: install }); else await p.clock.setFixedTime(at(today || s.today));
  await p.goto(app);
  await p.evaluate(`(${seed})(${JSON.stringify({ lang, size, goal: GOAL, start: START, log: s.log, extra })})`);
  await p.goto(app); await p.waitForTimeout(250);
  return { c, p, errs };
}

const probe = p => p.evaluate(() => {
  const card = byId('planCard'), home = card && card.querySelector('.plan-home');
  if (!home) return { missing: true };
  const q = s => home.querySelector(s), R = e => e && e.getBoundingClientRect();
  const cs = getComputedStyle(home), hr = R(home);
  const contentRight = hr.right - parseFloat(cs.paddingRight), contentLeft = hr.left + parseFloat(cs.paddingLeft);
  const ring = q('.plan-home-ring'), prog = q('.plan-home-ring-prog'), txt = q('.plan-home-ring-pct'), acts = q('.plan-home-acts');
  const btns = acts ? [...acts.querySelectorAll('button')] : [];
  const head = q('.plan-home-head'), headTxt = q('.plan-home-head-txt'), next = q('.plan-home-next'), ttl = q('.plan-home-ttl');
  const tag = ttl && ttl.querySelector('span');
  const visText = [...home.querySelectorAll('*')].filter(e => !e.closest('svg') && e.getClientRects().length).map(e =>
    [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('')).join(' ');
  const out = {
    vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, lang: document.documentElement.lang,
    font: document.documentElement.dataset.fontSize || 'small', text: home.innerText.replace(/\s+/g, ' ').trim(), visText,
    cls: home.className, gap: parseFloat(cs.rowGap), h: hr.height,
    homeL: hr.left, homeR: hr.right, contentRight, contentLeft,
    rawKeys: (home.innerText.match(/\b(plan|home|app)\.[a-z]+[A-Z.][a-zA-Z.]*\b/g) || []),
    hasHead: !!head, hasTop: !!q('.plan-home-top'), oldToday: !!q('.plan-home-today, .plan-home-today-lbl'),
    ticks: (home.textContent.match(/✓/g) || []).length,
    next: next ? { t: next.textContent, w: R(next).width, l: R(next).left, r: R(next).right, top: R(next).top } : null,
    tag: tag ? { t: tag.textContent, boxes: (() => { const rg = document.createRange(); rg.selectNodeContents(tag);
      return [...rg.getClientRects()].map(x => Math.round(x.top)).filter((v, i, a) => a.indexOf(v) === i).length; })(),
      ws: getComputedStyle(tag).whiteSpace, top: R(tag).top, ttlTop: R(ttl).top, right: R(tag).right } : null,
    acts: acts ? { jc: getComputedStyle(acts).justifyContent, lastRight: R(btns[btns.length - 1]).right,
      btns: btns.map(b => ({ t: b.textContent, a: b.dataset.action, w: R(b).width, h: R(b).height, r: R(b).right, top: R(b).top,
        clip: b.scrollWidth > b.clientWidth + 1 })) } : null,
    row: q('.plan-home-row') ? q('.plan-home-row').textContent : null,
    warn: !!q('.plan-home-warn'),
  };
  if (ring) {
    const rr = R(ring), tr = R(headTxt), hd = R(head);
    const bb = txt.getBBox(), scale = rr.width / 64;
    const txtKids = [...headTxt.children].map(e => R(e).right);
    out.ring = { w: rr.width, h: rr.height, l: rr.left, r: rr.right, t: rr.top, b: rr.bottom, inHead: ring.parentElement === head,
      txtR: Math.max(tr.right, ...txtKids), cyRing: rr.top + rr.height / 2, cyHead: hd.top + hd.height / 2, cyTxt: tr.top + tr.height / 2,
      role: ring.getAttribute('role'), label: ring.getAttribute('aria-label'), focusable: ring.tabIndex >= 0,
      progCls: prog.getAttribute('class'), vis: getComputedStyle(prog).visibility, offset: prog.style.strokeDashoffset,
      mark: txt.textContent, markCls: txt.getAttribute('class'), fill: getComputedStyle(txt).fill, fsPx: parseFloat(getComputedStyle(txt).fontSize) * scale,
      // getBBox in viewBox units; hole = inner diameter 2 * (28 - 3.5) = 49 units
      diag: Math.hypot(bb.width, bb.height), bbW: bb.width, bbH: bb.height,
      dx: Math.abs(bb.x + bb.width / 2 - 32), dy: Math.abs(bb.y + bb.height / 2 - 32) };
  }
  out.overflow = [];
  home.querySelectorAll('*').forEach(e => { if (!e.getClientRects().length) return;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
    const r = R(e); if (r.right > hr.right + 0.5 || r.left < hr.left - 0.5) out.overflow.push(e.textContent.trim().slice(0, 30)); });
  return out;
});
const contrast = (p, sel, prop = 'color') => p.evaluate(({ sel, prop }) => {
  const rgba = x => { const v = (x.match(/[\d.]+/g) || []).map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; };
  const over = (b, [r, g, bl, a]) => [r, g, bl].map((c, i) => c * a + b[i] * (1 - a));
  const lum = c => c.map(u => { u /= 255; return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; }).reduce((a, u, i) => a + u * [0.2126, 0.7152, 0.0722][i], 0);
  return [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length).map(e => {
    const chain = []; for (let x = e; x; x = x.parentElement) chain.unshift(x);
    let bg = [255, 255, 255]; chain.forEach(x => { bg = over(bg, rgba(getComputedStyle(x).backgroundColor)); });
    const fg = over(bg, rgba(getComputedStyle(e)[prop])); const a = lum(fg), b = lum(bg);
    return { t: (e.textContent || '').trim().slice(0, 24), ratio: +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2) };
  });
}, { sel, prop });
const BAND = pct => pct >= 100 ? 4 : pct >= 75 ? 3 : pct >= 50 ? 2 : pct > 0 ? 1 : 0;
const HOLE = 49;

// layout checks shared by the matrix and the edge cases; returns a list of problems
function layoutWhy(r, lang, state) {
  const why = [], L = LABEL[lang];
  if (r.missing) return ['no card'];
  if (r.sw > r.vw) why.push(`h-scroll ${r.sw}>${r.vw}`);
  if (r.overflow.length) why.push('overflow ' + r.overflow.join('|'));
  if (r.rawKeys.length) why.push('raw ' + r.rawKeys);
  if (r.oldToday) why.push('old .plan-home-today markup');
  if (r.visText.includes(L.lbl)) why.push('visible label');
  if (!r.acts) why.push('no acts');
  else {
    if (r.acts.jc !== 'flex-end') why.push('jc ' + r.acts.jc);
    if (Math.abs(r.acts.lastRight - r.contentRight) > 1) why.push(`last btn right ${r.acts.lastRight} vs ${r.contentRight}`);
    if (r.acts.btns.some(x => x.h < 44 || x.clip)) why.push('btn <44 / clipped ' + JSON.stringify(r.acts.btns));
  }
  if (r.hasHead && r.tag && r.tag.boxes !== 1) why.push(`"${r.tag.t}" split over ${r.tag.boxes} lines`);
  if (r.ring) {
    if (!r.cls.split(' ').includes('has-ring') || r.gap !== GAP_RING) why.push(`ring card class/gap ${r.cls} ${r.gap}`);
    if (!r.hasHead || r.hasTop || !r.ring.inHead) why.push('ring not in .plan-home-head');
    if (r.ring.w !== RING || r.ring.h !== RING) why.push('ring size ' + r.ring.w);
    if (r.ring.l < r.ring.txtR - 0.5) why.push(`ring overlaps title ${r.ring.l} < ${r.ring.txtR}`);
    if (r.ring.r > r.contentRight + 0.5 || Math.abs(r.ring.r - r.contentRight) > 1) why.push(`ring not at the right edge ${r.ring.r} vs ${r.contentRight}`);
    if (Math.abs(r.ring.cyRing - r.ring.cyHead) > 1 || Math.abs(r.ring.cyRing - r.ring.cyTxt) > 1) why.push(`ring not centred ${r.ring.cyRing}/${r.ring.cyTxt}`);
    if (!r.next || Math.abs(r.next.l - r.contentLeft) > 1 || Math.abs(r.next.r - r.contentRight) > 1) why.push('next not full width ' + JSON.stringify(r.next));
    if (r.next && r.next.top < r.ring.b - 0.5) why.push('next above ring bottom');
    if (r.ring.role !== 'img' || !r.ring.label.startsWith(L.lbl + ' ') || r.ring.focusable) why.push('a11y ' + r.ring.label);
    if (r.ring.diag > HOLE + 0.5) why.push(`ring text diagonal ${r.ring.diag.toFixed(1)} > ${HOLE}`);
    if (r.ring.dx > 1) why.push('ring text off-centre ' + r.ring.dx);
    if (r.ring.fill !== 'rgb(255, 255, 255)') why.push('fill ' + r.ring.fill);
  } else {
    if (r.cls.includes('has-ring') || r.gap !== GAP_PLAIN) why.push(`plain card class/gap ${r.cls} ${r.gap}`);
    if (r.hasHead || !r.hasTop) why.push('no-ring card without .plan-home-top');
  }
  return why;
}

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const matrixBad = []; let n = 0; const seen = { fs: {}, diag: {}, ownLine: [] };
  // ── A. matrix ──
  for (const state of Object.keys(STATES)) for (const lang of ['en', 'zh-HK']) for (const w of [320, 390, 1100]) for (const size of ['small', 'large']) {
    const { c, p, errs } = await open(b, { w, lang, size, state }); n++;
    const r = await probe(p); const tag = `${state}-${lang}-${w}-${size}`; const L = LABEL[lang];
    const why = layoutWhy(r, lang, state);
    if (!r.missing) {
      if (r.lang !== lang || r.font !== size) why.push('setting ' + r.lang + '/' + r.font);
      if (errs.length) why.push('errs ' + errs);
      const ringWanted = ['zero', 'mid', 'full'].includes(state);
      if (ringWanted !== !!r.ring) why.push('ring presence ' + !!r.ring);
      if (r.tag && r.tag.top > r.tag.ttlTop + 1) seen.ownLine.push(tag);
      if (r.ring) {
        const pct = state === 'zero' ? 0 : state === 'full' ? 100 : Number((r.ring.label.match(/(\d+)%/) || [])[1]);
        if (r.ring.label !== `${L.lbl} ${pct}%`) why.push('label ' + r.ring.label);
        if (!r.ring.progCls.split(' ').includes('h' + BAND(pct))) why.push('band ' + r.ring.progCls);
        if (r.ring.offset !== String(100 - pct)) why.push('offset ' + r.ring.offset);
        if ((pct === 0) !== (r.ring.vis === 'hidden')) why.push('vis ' + r.ring.vis);
        if (pct === 100 ? r.ring.mark !== '✓' || !r.ring.markCls.includes('done') : r.ring.mark !== pct + '%') why.push('mark ' + r.ring.mark);
        if (pct === 100) {
          if (r.ticks !== 1) why.push('✓ count ' + r.ticks);
          if (r.next.t !== L.bye) why.push('done text ' + r.next.t);
          if (r.acts.btns[0].t !== L.view) why.push('gold ' + r.acts.btns[0].t);
        } else {
          if (r.next.t.includes(L.bye)) why.push('bye shown before done');
          if (r.acts.btns[0].t !== L.go) why.push('gold ' + r.acts.btns[0].t);
        }
        seen.fs[`${r.ring.mark === '✓' ? '✓' : '%'}-${lang}-${size}`] = +r.ring.fsPx.toFixed(1);
        seen.diag[`${r.ring.mark}-${lang}-${size}`] = +r.ring.diag.toFixed(1);
        const rt = await contrast(p, '#planCard .plan-home-ring-pct', 'fill');
        if (rt[0].ratio < 4.5) why.push('ring text contrast ' + rt[0].ratio);
      } else {
        if (r.ticks !== 0 && state !== 'ended') why.push('stray ✓ ' + r.ticks);
        if (state === 'rest' && (!r.row || !/Rest day today|今日是休息日/.test(r.row))) why.push('rest row ' + r.row);
      }
      const low = (await contrast(p, '#planCard .plan-home *:not(svg):not(svg *)')).filter(x => x.t && x.ratio < 4.5);
      if (low.length) why.push('contrast ' + JSON.stringify(low));
    }
    if (w === 390 || (w === 320 && size === 'large') || (w === 1100 && size === 'small' && lang === 'en')) {
      const el = await p.$('#planCard'); if (el) await el.screenshot({ path: `${SHOTS}/card-${tag}.png` });
    }
    if (why.length) matrixBad.push({ tag, why });
    console.log((why.length ? 'FAIL ' : 'ok   ') + tag + (why.length ? ' ' + why.join('; ') : ''));
    await c.close();
  }
  ok(matrixBad.length === 0, `A. matrix ${n} combos (7 states × en/zh-HK × 320/390/1100 × small/large)`, matrixBad.length ? matrixBad : undefined);
  note('ring % on-screen px: ' + JSON.stringify(seen.fs));
  note('ring text diagonal (viewBox units, hole 49): ' + JSON.stringify(seen.diag));
  note('"Day n / N" on its own line: ' + seen.ownLine.join(', '));

  // ── B. taps ──
  const scr = p => p.evaluate(() => document.querySelector('.screen.active').id);
  const runView = p => p.evaluate(() => ({ s: document.querySelector('.screen.active').id,
    date: planRunView && (planRunView.date || (planRunView.at && planRunView.at.date)),
    ti: planRunView && (planRunView.taskIndex ?? (planRunView.at && planRunView.at.taskIndex)) }));
  const nextOf = p => p.evaluate(() => { const n = planNextStep(planLoad(), planLoadLog(), planTodayIso()); return { kind: n.kind, date: n.date, ti: n.taskIndex }; });
  for (const lang of ['en', 'zh-HK']) {
    let { c, p, errs } = await open(b, { w: 390, lang, size: 'large', state: 'mid' });
    let want = await nextOf(p);
    await p.click('#planCard [data-action="planContinue"]'); await p.waitForTimeout(200);
    let run = await runView(p);
    ok(run.s === 'screenPlanRun' && (run.ti === undefined || run.ti === null || (run.ti === want.ti && (!run.date || run.date === want.date))),
      `B1 ${lang} Continue → runner of the next task`, { want, run });
    await p.screenshot({ path: `${SHOTS}/tap-continue-${lang}.png` });
    await p.evaluate(() => leaveToHome()); await p.waitForTimeout(150);
    ok(!!(await probe(p)).ring, `B1b ${lang} back Home: card redrawn with the ring`);
    await p.click('#planCard [data-action="openPlanSchedule"]'); await p.waitForTimeout(150);
    ok(await scr(p) === 'screenPlanSchedule', `B2 ${lang} Schedule → schedule screen`);
    ok(errs.length === 0, `B ${lang} no page errors`, errs); await c.close();

    ({ c, p } = await open(b, { w: 390, lang, size: 'small', state: 'full' }));
    await p.click('#planCard [data-action="openPlanDay"]'); await p.waitForTimeout(150);
    ok(await scr(p) === 'screenPlanDay', `B3 ${lang} 100 %: "${LABEL[lang].view}" → day screen`); await c.close();

    ({ c, p } = await open(b, { w: 390, lang, size: 'small', state: 'exam' }));
    await p.click('#planCard [data-action="openPlanDay"]'); await p.waitForTimeout(150);
    ok(await scr(p) === 'screenPlanDay', `B4 ${lang} exam day: gold → day screen`); await c.close();

    for (const [act, want2] of [['openPlanGoal', 'screenPlanGoal'], ['planEditGoal', 'screenPlanGoal'], ['openPlanSchedule', 'screenPlanSchedule']]) {
      ({ c, p } = await open(b, { w: 390, lang, size: 'small', state: 'ended' }));
      await p.click(`#planCard [data-action="${act}"]`); await p.waitForTimeout(150);
      const s = await scr(p);
      ok(s === want2, `B5 ${lang} ended: ${act} → ${want2}`, s); await c.close();
    }
    ({ c, p } = await open(b, { w: 390, lang, size: 'small', state: 'notStarted' }));
    await p.click('#planCard [data-action="openPlanSchedule"]'); await p.waitForTimeout(150);
    ok(await scr(p) === 'screenPlanSchedule', `B6 ${lang} not started: Schedule → schedule`); await c.close();

    ({ c, p } = await open(b, { w: 390, lang, size: 'small', state: 'rest' }));
    want = await nextOf(p);
    const gold = await p.$eval('#planCard .plan-btn-gold', e => e.dataset.action);
    await p.click('#planCard .plan-btn-gold'); await p.waitForTimeout(200);
    run = await runView(p);
    ok(gold === 'planContinue' && run.s === 'screenPlanRun' && want.kind !== 'done', `B7 ${lang} rest day: Continue → catch-up runner`, { gold, want, run }); await c.close();
  }

  // ── C. edge cases ──
  { // C1 nowrap 320 en large: "Day 4 / 31" whole on its own line (S-231 gap)
    const { c, p } = await open(b, { w: 320, lang: 'en', size: 'large', state: 'mid' });
    const r = await probe(p);
    ok(r.tag.ws === 'nowrap' && r.tag.boxes === 1 && r.tag.top > r.tag.ttlTop + 1 && r.tag.right <= r.ring.l,
      'C1 320 en large: "Day 4 / 31" nowrap, one line box, on its own line, left of the ring', r.tag);
    await (await p.$('#planCard')).screenshot({ path: `${SHOTS}/edge-nowrap-en-320-large.png` });
    // the same without nowrap would split: prove the CSS is load-bearing
    const split = await p.evaluate(() => { const s = document.querySelector('.plan-home-ttl span'); s.style.whiteSpace = 'normal';
      const rg = document.createRange(); rg.selectNodeContents(s); const n = new Set([...rg.getClientRects()].map(x => Math.round(x.top))).size; s.style.whiteSpace = ''; return n; });
    note('C1 control: with white-space: normal the tag spans ' + split + ' line(s)');
    await c.close();
  }
  { // C2 ring text diagonal fit for 1 / 99 / 100 (✓) at small + large, en + zh-HK (S-232 gap)
    const res = [];
    for (const lang of ['en', 'zh-HK']) for (const size of ['small', 'large']) {
      const { c, p } = await open(b, { w: 320, lang, size, state: 'mid' });
      res.push(...await p.evaluate(({ lang, size }) => [1, 49, 50, 74, 75, 88, 99, 100].map(pct => {
        const d = document.createElement('div'); d.className = 'plan-home has-ring';
        d.innerHTML = `<div class="plan-home-head"><div class="plan-home-head-txt">x</div>${planHomeRingHtml(pct)}</div>`;
        byId('planCard').append(d);
        const prog = d.querySelector('.plan-home-ring-prog'), txt = d.querySelector('.plan-home-ring-pct'), bb = txt.getBBox();
        const r = { lang, size, pct, cls: prog.getAttribute('class'), vis: getComputedStyle(prog).visibility, mark: txt.textContent,
          diag: Math.hypot(bb.width, bb.height), w: d.querySelector('.plan-home-ring').getBoundingClientRect().width }; d.remove(); return r; }), { lang, size }));
      await c.close();
    }
    const worst = res.reduce((m, s) => s.diag > m.diag ? s : m);
    ok(res.every(s => s.diag <= HOLE && s.w === RING), `C2 ring text (1–99 % and ✓) fits the 49-unit hole by diagonal; worst ${worst.mark} ${worst.lang} ${worst.size} = ${worst.diag.toFixed(1)}`, res.filter(s => s.diag > HOLE));
    ok(res.every(s => s.cls.includes('h' + BAND(s.pct)) && (s.pct === 100 ? s.mark === '✓' : s.mark === s.pct + '%') && s.vis === 'visible'),
      'C3 G27 band boundaries 1/49/50/74/75/99/100 and ✓ only at 100', res.filter(s => !s.cls.includes('h' + BAND(s.pct))));
  }
  for (const lang of ['en', 'zh-HK']) { // C4 100 % + carry-over
    const { c, p } = await open(b, { w: 390, lang, size: 'large', state: 'full', extra: 'carry' });
    const r = await probe(p);
    ok(r.ring && r.ring.mark === '✓' && r.ticks === 1 && r.acts.btns[0].t === LABEL[lang].go && /Day 3/.test(r.next.t) && !r.next.t.includes(LABEL[lang].bye) && layoutWhy(r, lang).length === 0,
      `C4 ${lang} today 100 % + carry-over: ✓ ring, catch-up next (Day 3), "${LABEL[lang].go}", no "${LABEL[lang].bye}"`, { mark: r.ring && r.ring.mark, ticks: r.ticks, next: r.next && r.next.t, go: r.acts.btns[0].t, why: layoutWhy(r, lang) });
    await (await p.$('#planCard')).screenshot({ path: `${SHOTS}/edge-full-carry-${lang}-390-large.png` });
    await p.click('#planCard [data-action="planContinue"]'); await p.waitForTimeout(200);
    const run = await runView(p);
    ok(run.s === 'screenPlanRun' && (!run.date || run.date === '2026-09-30'), `C4b ${lang} carry-over Continue → opens the Day 3 catch-up`, run);
    await c.close();
  }
  { // C5 unreadable log
    const { c, p } = await open(b, { w: 390, lang: 'en', size: 'small', state: 'zero', extra: 'brokenLog' });
    const r = await probe(p);
    ok(r.ring && r.warn && /Reset/.test(r.text) && layoutWhy(r, 'en').length === 0, 'C5 unreadable log: ring in head + ↺ Reset hint, layout intact', layoutWhy(r, 'en'));
    await c.close();
  }
  // C6–C9 midnight rollovers with the app open
  const roll = async (label, day, extra, state, check) => {
    const { c, p } = await open(b, { w: 390, lang: 'en', size: 'small', state, extra, install: at(day, '23:59:50') });
    if (extra === 'allDone') {
      await p.evaluate(`(${seed})(${JSON.stringify({ lang: 'en', size: 'small', goal: GOAL, start: START, log: 'none', extra, today: day })})`);
      await p.goto(APP); await p.waitForTimeout(250); }
    const before = await probe(p);
    await p.clock.runFor(15000); await p.waitForTimeout(250);
    const after = await probe(p);
    ok(check(before, after), label, { b: [before.text, before.cls], a: [after.text, after.cls], why: layoutWhy(after, 'en') });
    await (await p.$('#planCard')).screenshot({ path: `${SHOTS}/edge-midnight-${label.slice(0, 3).trim()}.png` });
    await c.close();
  };
  await roll('C6 midnight Day 4 (39 %) → Day 5: ring redraws for the new day', '2026-10-01', undefined, 'mid',
    (x, y) => x.ring && y.ring && /Day 4/.test(x.text) && /Day 5/.test(y.text) && y.ring.offset === String(100 - Number(y.ring.label.match(/(\d+)%/)[1])) && layoutWhy(y, 'en').length === 0);
  await roll('C7 midnight Day 4 at 100 % → Day 5: ✓ and "See you tomorrow" go, % ring + Continue →', '2026-10-01', 'allDone', 'full',
    (x, y) => x.ring && x.ring.mark === '✓' && x.next.t === 'See you tomorrow' && y.ring && y.ring.mark !== '✓' && y.ticks === 0 && !y.text.includes('See you tomorrow') && y.acts.btns[0].t === 'Continue →' && layoutWhy(y, 'en').length === 0);
  await roll('C8 midnight Sat → Sun rest day: ring + .has-ring go, .plan-home-top back', '2026-10-03', undefined, 'mid',
    (x, y) => x.ring && x.cls.includes('has-ring') && !y.ring && !y.cls.includes('has-ring') && y.hasTop && !y.hasHead && y.gap === GAP_PLAIN && /Rest day today/.test(y.text));
  await roll('C9 midnight last plan day → exam day: ring goes', '2026-10-28', undefined, 'mid',
    (x, y) => x.ring && !y.ring && y.hasTop && !y.cls.includes('has-ring'));
  { // C10 live font-size + language switch (no reload) re-lay the head
    const { c, p } = await open(b, { w: 320, lang: 'en', size: 'small', state: 'mid' });
    const r0 = await probe(p);
    await p.evaluate(() => setFontSize('large')); await p.waitForTimeout(150);
    const r1 = await probe(p);
    await p.evaluate(() => setLang('zh-HK')); await p.waitForTimeout(200);
    const r2 = await probe(p);
    ok(layoutWhy(r0, 'en').length === 0 && layoutWhy(r1, 'en').length === 0 && layoutWhy(r2, 'zh-HK').length === 0 && r2.ring.label.startsWith('今日完成度'),
      'C10 320: live small → large → zh-HK keeps the head layout (56px ring, centred, nowrap, no overflow)', { a: layoutWhy(r0, 'en'), b: layoutWhy(r1, 'en'), c: layoutWhy(r2, 'zh-HK') });
    await c.close();
  }
  { // C11 keyboard: gold → Schedule, ring not a stop
    const { c, p } = await open(b, { w: 390, lang: 'zh-HK', size: 'large', state: 'mid' });
    await p.focus('#planCard .plan-btn-gold');
    const stops = [await p.evaluate(() => document.activeElement.className)];
    await p.keyboard.press('Shift+Tab'); stops.push(await p.evaluate(() => document.activeElement.closest('#planCard') ? 'inCard:' + document.activeElement.tagName : 'outside'));
    await p.focus('#planCard .plan-btn-gold'); await p.keyboard.press('Tab');
    stops.push(await p.evaluate(() => document.activeElement.dataset.action));
    ok(stops[0] === 'plan-btn-gold' && stops[1] === 'outside' && stops[2] === 'openPlanSchedule', 'C11 keyboard: ring not focusable (Shift+Tab leaves the card), gold → Schedule', stops);
    await c.close();
  }

  // ── D. heights v1.5.0 vs v1.5.1 ──
  if (V150) {
    const rows = [];
    for (const lang of ['en', 'zh-HK']) for (const size of ['small', 'large']) for (const state of Object.keys(STATES)) {
      const hOf = async app => { const { c, p } = await open(b, { w: 390, lang, size, state, app });
        const h = await p.evaluate(() => Math.round(byId('planCard').querySelector('.plan-home').getBoundingClientRect().height));
        if (lang === 'zh-HK' && size === 'large' && ['mid', 'full'].includes(state)) await (await p.$('#planCard')).screenshot({ path: `${SHOTS}/compare-${app === APP ? 'v151' : 'v150'}-${state}-zh-HK-390-large.png` });
        await c.close(); return h; };
      const h0 = await hOf(appOf(V150)), h1 = await hOf(APP);
      rows.push({ lang, size, state, v150: h0, v151: h1, d: h1 - h0 });
    }
    console.log('heights 390 (v1.5.0 → v1.5.1):'); rows.forEach(x => console.log(`  ${x.lang} ${x.size} ${x.state}: ${x.v150} → ${x.v151} (${x.d > 0 ? '+' : ''}${x.d})`));
    const ringRows = rows.filter(x => ['zero', 'mid', 'full'].includes(x.state)), plain = rows.filter(x => !['zero', 'mid', 'full'].includes(x.state));
    const large = ringRows.filter(x => x.size === 'large');
    ok(large.every(x => x.d < 0), 'D1 every ring state is shorter than v1.5.0 at 390 large (default size; mockup scope)', large.filter(x => x.d >= 0));
    const small = ringRows.filter(x => x.size === 'small' && x.d >= 0);
    if (small.length) note('D1b small text, not shorter: ' + JSON.stringify(small));
    ok(plain.every(x => x.d === 0), 'D2 no-ring states (rest / exam / ended / not started) unchanged height', plain.filter(x => x.d !== 0));
    fs.writeFileSync(path.join(SHOTS, 'heights.json'), JSON.stringify(rows, null, 1));
  } else note('D skipped: no v150 root');

  await b.close();
  console.log(`\n${pass} pass / ${fail} fail`); if (notes.length) console.log('notes:\n  ' + notes.join('\n  '));
  if (bugs.length) console.log('bugs:\n  ' + bugs.join('\n  '));
  process.exit(fail ? 1 : 0);
})();
