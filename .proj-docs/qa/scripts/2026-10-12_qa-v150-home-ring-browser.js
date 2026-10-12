// QA v1.5.0: Home study-plan card ring (variant B) — real Chromium, file://, fixed clock.
//   NODE_PATH=/opt/node-tools/node_modules node .proj-docs/qa/scripts/2026-10-12_qa-v150-home-ring-browser.js [shot-dir]
// A. matrix: 7 states (0 % / mid % / 100 % / rest day / exam day / ended / not started) × en / zh-HK × 320 / 390 / 1100
//    × small / large font: ring presence, 64px, right of the text column, inside the card, % / ✓ text inside the ring hole,
//    G27 band stroke = token, 0 % arc hidden, dash offset, aria-label, button label, .plan-home-acts right-aligned (last
//    button's right edge = card content edge), no overflow / page h-scroll / raw keys, text + ring-text contrast ≥ 4.5:1,
//    arc ≥ 3:1 (info), 44px buttons
// B. taps: Continue → next task's runner; Schedule → schedule; done "View today's tasks" → day; exam "View today" → day;
//    ended New plan / Change goal / Schedule
// C. edge cases: 1 % arc visible (not .empty) + h1; 99 % text fits + h3 + not ✓; 50 / 75 band boundaries; today 100 %
//    with a carry-over left (✓ ring + "Continue →"); unreadable log (0 % ring + warn); midnight rollover re-renders the
//    ring; large zh-HK 320 long next text keeps the ring 64px; keyboard tab order skips the ring
const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const APP = 'file://' + path.join(ROOT, 'index.html');
const SHOTS = path.resolve(process.argv[2] || path.join(__dirname, '..', 'screenshots', 'v150'));
fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0; const bugs = [], notes = [];
const ok = (c, m, x) => { if (c) pass++; else { fail++; bugs.push(m + (x !== undefined ? ' ' + JSON.stringify(x) : '')); }
  console.log((c ? 'ok   ' : 'FAIL ') + m + (!c && x !== undefined ? ' ' + JSON.stringify(x) : '')); };
const note = m => { notes.push(m); console.log('note ' + m); };
const START = '2026-09-28', GOAL = { examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' };
const at = (iso, time = '09:00:00') => new Date(`${iso}T${time}`);
const LABEL = { en: { go: 'Continue →', view: "View today's tasks", lbl: "Today's progress" }, 'zh-HK': { go: '繼續 →', view: '查看今日任務', lbl: '今日完成度' } };

// state → { today, log builder name, plan start }
const STATES = {
  // Day 2 with one wrong answer left from Day 1: an empty clear-wrong list counts as done (G9), so a learn day with no
  // wrong answers starts at 1 %; one wrong answer makes today's review real and the day starts at 0 %
  zero: { today: '2026-09-29', log: 'zero' },
  mid: { today: '2026-10-01', log: 'mid' },
  full: { today: '2026-10-01', log: 'full' },
  rest: { today: '2026-10-04', log: 'mid' },
  exam: { today: '2026-10-29', log: 'mid' },
  ended: { today: '2026-10-30', log: 'mid' },
  notStarted: { today: '2026-09-26', log: 'none' },
};

async function open(b, { w, lang, size, state, extra }) {
  const s = STATES[state];
  const c = await b.newContext({ viewport: { width: w, height: 900 } }); const p = await c.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.clock.setFixedTime(at(s.today));
  await p.goto(APP);
  await p.evaluate(({ lang, size, goal, start, log, extra }) => {
    localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true');
    localStorage.setItem('lifeuk.uiLang', JSON.stringify(lang)); localStorage.setItem('lifeuk.fontSize', JSON.stringify(size));
    const plan = buildPlan(goal, start); writeStudyPlan(plan);
    const qidsOf = day => day.tasks.filter(t => t.type !== 'review').flatMap(planTaskQids);
    const okm = list => Object.fromEntries(list.map(k => [k, 1]));
    const [d1, d2, d3, d4] = plan.days;
    const days = {};
    if (log === 'zero') { const q1 = qidsOf(d1); days[d1.date] = { ok: okm(q1.slice(1)), bad: { [q1[0]]: 1 } };
      localStorage.setItem('lifeuk.wrongList', JSON.stringify({ [q1[0]]: true })); } // the app wrong list feeds G9
    if (log !== 'none' && log !== 'zero') {
      days[d1.date] = { ok: okm(qidsOf(d1)) }; days[d2.date] = { ok: okm(qidsOf(d2)) }; days[d3.date] = { ok: okm(qidsOf(d3)) };
      const p4 = d4.tasks[1].qids;
      days[d4.date] = log === 'full' ? { ok: okm(d4.tasks.flatMap(planTaskQids)) } : { ok: okm(p4.slice(0, 20)), bad: { [p4[25]]: 1 } };
    }
    writePlanLog({ v: 1, days });
    if (extra === 'brokenLog') localStorage.setItem('lifeuk.studyPlanProgress', '{bad');
    if (extra === 'carry') { // Day 3 half done → carry-over pending while today is 100 %
      const L = planLoadLog(); const q3 = qidsOf(d3); L.days[d3.date] = { ok: okm(q3.slice(0, 5)) }; writePlanLog(L); }
  }, { lang, size, goal: GOAL, start: state === 'notStarted' ? '2026-09-28' : START, log: s.log, extra });
  await p.goto(APP); await p.waitForTimeout(250);
  return { c, p, errs };
}

// geometry + style snapshot of the card
const probe = p => p.evaluate(() => {
  const card = byId('planCard'), home = card && card.querySelector('.plan-home');
  if (!home) return { missing: true };
  const q = s => home.querySelector(s), R = e => e && e.getBoundingClientRect();
  const cs = getComputedStyle(home), hr = R(home);
  const contentRight = hr.right - parseFloat(cs.paddingRight), contentLeft = hr.left + parseFloat(cs.paddingLeft);
  const ring = q('.plan-home-ring'), prog = q('.plan-home-ring-prog'), txt = q('.plan-home-ring-pct'), acts = q('.plan-home-acts');
  const btns = acts ? [...acts.querySelectorAll('button')] : [];
  const out = {
    vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, lang: document.documentElement.lang,
    font: document.documentElement.dataset.fontSize || 'small', text: home.innerText.replace(/\s+/g, ' ').trim(),
    homeL: hr.left, homeR: hr.right, contentRight, contentLeft,
    rawKeys: (home.innerText.match(/\b(plan|home|app)\.[a-z]+[A-Z.][a-zA-Z.]*\b/g) || []),
    acts: acts ? { jc: getComputedStyle(acts).justifyContent, lastRight: R(btns[btns.length - 1]).right, firstLeft: R(btns[0]).left,
      btns: btns.map(b => ({ t: b.textContent, a: b.dataset.action, w: R(b).width, h: R(b).height, r: R(b).right, l: R(b).left, top: R(b).top,
        clip: b.scrollWidth > b.clientWidth + 1 })) } : null,
    row: q('.plan-home-row') ? q('.plan-home-row').textContent : null,
    warn: !!q('.plan-home-warn'), oldBar: !!q('.plan-home-bar'),
  };
  if (ring) {
    const rr = R(ring), tr = R(q('.plan-home-today-txt')), tb = R(txt);
    out.ring = { w: rr.width, h: rr.height, l: rr.left, r: rr.right, t: rr.top, b: rr.bottom, txtR: tr.right,
      role: ring.getAttribute('role'), label: ring.getAttribute('aria-label'), focusable: ring.tabIndex >= 0,
      progCls: prog.getAttribute('class'), vis: getComputedStyle(prog).visibility, stroke: getComputedStyle(prog).stroke,
      offset: prog.style.strokeDashoffset, track: getComputedStyle(q('.plan-home-ring-track')).stroke,
      mark: txt.textContent, markCls: txt.getAttribute('class'), fill: getComputedStyle(txt).fill, fs: getComputedStyle(txt).fontSize,
      // hole: inner radius in px = (28 - 3.5) * scale; text box must sit within the hole's inscribed square-ish area
      txtW: tb.width, txtH: tb.height, dx: Math.abs((tb.left + tb.width / 2) - (rr.left + rr.width / 2)), dy: Math.abs((tb.top + tb.height / 2) - (rr.top + rr.height / 2)),
      hole: (28 - 3.5) * rr.width / 64,
      lbl: q('.plan-home-today-lbl') && q('.plan-home-today-lbl').textContent };
    out.bandColors = Object.fromEntries([0, 1, 2, 3, 4].map(i => [i, getComputedStyle(document.documentElement).getPropertyValue('--plan-heat-' + i).trim()]));
  }
  // every text-bearing descendant clipped / past the card
  out.overflow = [];
  home.querySelectorAll('*').forEach(e => { if (!e.getClientRects().length) return;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
    const r = R(e); if (r.right > hr.right + 0.5 || r.left < hr.left - 0.5) out.overflow.push(e.textContent.trim().slice(0, 30)); });
  return out;
});
// WCAG contrast: text colour (or SVG fill) composited over the card bg chain
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

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const matrixBad = []; let n = 0; const seen = {};
  // ── A. matrix ──
  for (const state of Object.keys(STATES)) for (const lang of ['en', 'zh-HK']) for (const w of [320, 390, 1100]) for (const size of ['small', 'large']) {
    const { c, p, errs } = await open(b, { w, lang, size, state }); n++;
    const r = await probe(p); const tag = `${state}-${lang}-${w}-${size}`; const why = [];
    const L = LABEL[lang];
    if (r.missing) why.push('no card');
    else {
      if (r.lang !== lang || r.font !== size) why.push('setting ' + r.lang + '/' + r.font);
      if (r.sw > r.vw) why.push(`h-scroll ${r.sw}>${r.vw}`);
      if (r.overflow.length) why.push('overflow ' + r.overflow.join('|'));
      if (r.rawKeys.length) why.push('raw ' + r.rawKeys);
      if (r.oldBar) why.push('old bar');
      if (errs.length) why.push('errs ' + errs);
      // acts right-aligned in every state
      if (!r.acts) why.push('no acts');
      else {
        if (r.acts.jc !== 'flex-end') why.push('jc ' + r.acts.jc);
        if (Math.abs(r.acts.lastRight - r.contentRight) > 1) why.push(`last btn right ${r.acts.lastRight} vs ${r.contentRight}`);
        if (r.acts.btns.some(x => x.h < 44 || x.clip)) why.push('btn <44 / clipped ' + JSON.stringify(r.acts.btns));
      }
      const ringWanted = ['zero', 'mid', 'full'].includes(state);
      if (ringWanted !== !!r.ring) why.push('ring presence ' + !!r.ring);
      if (r.ring) {
        const pct = state === 'zero' ? 0 : state === 'full' ? 100 : Number((r.ring.label.match(/(\d+)%/) || [])[1]);
        seen.mid = seen.mid || (state === 'mid' ? pct : undefined);
        if (r.ring.w !== 64 || r.ring.h !== 64) why.push('ring size ' + r.ring.w);
        if (r.ring.l < r.ring.txtR - 0.5) why.push('ring overlaps text');
        if (r.ring.r > r.contentRight + 0.5) why.push('ring past card');
        if (r.ring.role !== 'img' || r.ring.label !== `${L.lbl} ${pct}%` || r.ring.focusable) why.push('a11y ' + r.ring.label);
        if (r.ring.lbl !== L.lbl) why.push('lbl ' + r.ring.lbl);
        const band = BAND(pct);
        if (!r.ring.progCls.split(' ').includes('h' + band)) why.push('band ' + r.ring.progCls);
        if (r.ring.offset !== String(100 - pct)) why.push('offset ' + r.ring.offset);
        if ((pct === 0) !== (r.ring.vis === 'hidden')) why.push('vis ' + r.ring.vis);
        if (pct === 100 ? r.ring.mark !== '✓' || !r.ring.markCls.includes('done') : r.ring.mark !== pct + '%') why.push('mark ' + r.ring.mark);
        if (r.ring.fill !== 'rgb(255, 255, 255)') why.push('fill ' + r.ring.fill);
        // text inside the hole: half-diagonal of the text box within the inner radius (+ 1px slack)
        const halfDiag = Math.hypot(r.ring.txtW / 2, r.ring.txtH / 2) + Math.max(r.ring.dx, r.ring.dy);
        if (r.ring.txtW / 2 + r.ring.dx > r.ring.hole + 0.5) why.push(`ring text wider than hole ${r.ring.txtW}/${r.ring.hole}`);
        if (halfDiag > r.ring.hole + 4) notes.push(`${tag}: ring text corners near the stroke (${halfDiag.toFixed(1)} vs ${r.ring.hole})`);
        const go = r.acts.btns[0];
        const expGo = pct === 100 ? L.view : L.go;
        if (go.t !== expGo) why.push('gold label ' + go.t);
      } else if (state === 'rest') {
        if (!r.row || !/Rest day today|今日是休息日/.test(r.row)) why.push('rest row ' + r.row);
        if (r.acts.btns[0].t !== L.go && r.acts.btns[0].t !== L.view) why.push('rest gold ' + r.acts.btns[0].t);
      }
      // contrast: card text, ring text fill, buttons
      const low = (await contrast(p, '#planCard .plan-home *:not(svg):not(svg *)')).filter(x => x.t && x.ratio < 4.5);
      if (low.length) why.push('contrast ' + JSON.stringify(low));
      if (r.ring) {
        const rt = await contrast(p, '#planCard .plan-home-ring-pct', 'fill');
        if (rt[0].ratio < 4.5) why.push('ring text contrast ' + rt[0].ratio);
        if (r.ring.vis !== 'hidden') { const arc = await contrast(p, '#planCard .plan-home-ring-prog', 'stroke');
          seen['arc-' + r.ring.progCls] = arc[0].ratio; }
      }
    }
    if (w === 390 || (w === 320 && size === 'large') || (w === 1100 && size === 'small' && lang === 'en')) {
      const el = await p.$('#planCard'); if (el) await el.screenshot({ path: `${SHOTS}/card-${tag}.png` });
    }
    if (why.length) matrixBad.push({ tag, why });
    console.log((why.length ? 'FAIL ' : 'ok   ') + tag + (why.length ? ' ' + why.join('; ') : ''));
    await c.close();
  }
  ok(matrixBad.length === 0, `A. matrix ${n} combos (7 states × en/zh-HK × 320/390/1100 × small/large)`, matrixBad.length ? matrixBad : undefined);
  note('mid % seeded = ' + seen.mid + '; arc vs card contrast (non-text, info): ' + JSON.stringify(Object.fromEntries(Object.entries(seen).filter(([k]) => k.startsWith('arc')))));

  // ── B. taps (real clicks) ──
  for (const lang of ['en', 'zh-HK']) {
    const scr = p => p.evaluate(() => document.querySelector('.screen.active').id);
    let { c, p, errs } = await open(b, { w: 390, lang, size: 'large', state: 'mid' });
    const want = await p.evaluate(() => { const n = planNextStep(planLoad(), planLoadLog(), planTodayIso()); return { kind: n.kind, date: n.date, ti: n.taskIndex }; });
    await p.click('#planCard [data-action="planContinue"]'); await p.waitForTimeout(200);
    const run = await p.evaluate(() => ({ s: document.querySelector('.screen.active').id, kind: planRunView && planRunView.kind,
      date: planRunView && (planRunView.date || (planRunView.at && planRunView.at.date)), ti: planRunView && (planRunView.taskIndex ?? (planRunView.at && planRunView.at.taskIndex)) }));
    ok(run.s === 'screenPlanRun', `B1 ${lang} Continue → runner of the next task`, { want, run });
    if (run.ti !== undefined && run.ti !== null) ok(run.ti === want.ti && (!run.date || run.date === want.date), `B1b ${lang} runner opened next task index ${want.ti}`, run);
    else note(`B1b ${lang}: planRunView exposes no task index (${JSON.stringify(run)}); next = ${JSON.stringify(want)}`);
    await p.screenshot({ path: `${SHOTS}/tap-continue-${lang}.png` });
    await p.evaluate(() => leaveToHome()); await p.waitForTimeout(100);
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
  }

  // ── C. edge cases ──
  {
    const { c, p } = await open(b, { w: 320, lang: 'zh-HK', size: 'large', state: 'mid' });
    const synth = await p.evaluate(() => [1, 49, 50, 74, 75, 99, 100].map(pct => {
      const d = document.createElement('div'); d.className = 'plan-home'; d.innerHTML = planHomePctHtml(pct, '<p class="plan-home-next">x</p>');
      byId('planCard').append(d);
      const prog = d.querySelector('.plan-home-ring-prog'), txt = d.querySelector('.plan-home-ring-pct'), ring = d.querySelector('.plan-home-ring');
      const tb = txt.getBoundingClientRect(), rr = ring.getBoundingClientRect();
      const r = { pct, cls: prog.getAttribute('class'), vis: getComputedStyle(prog).visibility, mark: txt.textContent, tw: tb.width, th: tb.height,
        hole: (28 - 3.5) * rr.width / 64 }; d.remove(); return r; }));
    const c1 = synth.find(s => s.pct === 1), c99 = synth.find(s => s.pct === 99);
    ok(c1.vis === 'visible' && c1.cls.includes('h1') && !c1.cls.includes('empty'), 'C1 1 %: arc drawn (not .empty), band h1', c1);
    ok(c99.cls.includes('h3') && c99.mark === '99%' && c99.tw / 2 <= c99.hole, 'C2 99 %: h3, "99%" (not ✓), fits the hole at zh-HK large', c99);
    ok(['49:h1', '50:h2', '74:h2', '75:h3', '100:h4'].every(k => { const [v, h] = k.split(':'); return synth.find(s => s.pct === +v).cls.includes(h); }), 'C3 G27 boundaries 49/50/74/75/100', synth.map(s => s.pct + ':' + s.cls));
    const widest = synth.reduce((m, s) => s.tw > m.tw ? s : m);
    ok(widest.tw / 2 <= widest.hole, `C4 widest ring text (${widest.mark} ${widest.tw.toFixed(1)}px) inside the hole (${(widest.hole * 2).toFixed(1)}px) at large`, widest);
    // long next text at 320 zh-HK large: ring keeps 64px
    const r = await probe(p);
    ok(r.ring && r.ring.w === 64 && r.overflow.length === 0, 'C5 320 zh-HK large: ring stays 64px beside wrapped next text', r.ring);
    // keyboard: Tab order on the card = gold, schedule (the ring is not a stop)
    await p.focus('#planCard .plan-btn-gold');
    const stops = [await p.evaluate(() => document.activeElement.className)];
    await p.keyboard.press('Tab'); stops.push(await p.evaluate(() => document.activeElement.className + '|' + document.activeElement.dataset.action));
    ok(stops[0] === 'plan-btn-gold' && /openPlanSchedule/.test(stops[1]), 'C6 keyboard: gold → Schedule, ring not focusable', stops);
    await c.close();
  }
  {
    const { c, p } = await open(b, { w: 390, lang: 'en', size: 'small', state: 'full', extra: 'carry' });
    const r = await probe(p);
    ok(r.ring && r.ring.mark === '✓' && r.acts.btns[0].t === 'Continue →' && /Day 3/.test(r.text), 'C7 today 100 % + carry-over pending: ✓ ring and "Continue →" to the catch-up', { mark: r.ring && r.ring.mark, go: r.acts.btns[0].t, text: r.text });
    await (await p.$('#planCard')).screenshot({ path: `${SHOTS}/edge-full-carry-en-390.png` });
    await c.close();
  }
  {
    const { c, p } = await open(b, { w: 390, lang: 'en', size: 'small', state: 'zero', extra: 'brokenLog' });
    const r = await probe(p);
    // unreadable log reads as nothing answered: the wrong list is empty too, so today's review counts done (G9) → 1 %
    const pct8 = r.ring && Number(r.ring.label.match(/(\d+)%/)[1]);
    ok(r.ring && r.ring.mark === pct8 + '%' && pct8 <= 1 && r.ring.offset === String(100 - pct8) && r.warn && /Reset/.test(r.text) && r.sw <= r.vw && r.overflow.length === 0,
      'C8 unreadable log: ring renders (≤ 1 %, offset matches) + ↺ Reset hint below, no h-scroll / overflow', { mark: r.ring && r.ring.mark, warn: r.warn });
    await (await p.$('#planCard')).screenshot({ path: `${SHOTS}/edge-broken-log-en-390.png` });
    await c.close();
  }
  {
    // midnight rollover with the app open: Day 4 (mid) → Day 5; ring re-renders for the new day
    const c = await b.newContext({ viewport: { width: 390, height: 900 } }); const p = await c.newPage();
    await p.clock.install({ time: at('2026-10-01', '23:59:50') });
    await p.goto(APP);
    await p.evaluate(({ goal, start }) => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true');
      localStorage.setItem('lifeuk.uiLang', '"en"'); const plan = buildPlan(goal, start); writeStudyPlan(plan);
      const p4 = plan.days[3].tasks[1].qids; writePlanLog({ v: 1, days: { [plan.days[3].date]: { ok: Object.fromEntries(p4.slice(0, 20).map(k => [k, 1])) } } }); }, { goal: GOAL, start: START });
    await p.goto(APP); await p.waitForTimeout(200);
    const before = await probe(p);
    await p.clock.runFor(15000); await p.waitForTimeout(200);
    const after = await probe(p);
    ok(before.ring && after.ring && /Day 4/.test(before.text) && /Day 5/.test(after.text) && after.ring.offset === String(100 - Number(after.ring.label.match(/(\d+)%/)[1])),
      'C9 midnight with the app open: card moves to Day 5 and the ring re-renders', { b: before.ring && before.ring.label, a: after.ring && after.ring.label });
    await c.close();
  }
  // baseline comparison shot (390 en small mid) for the report
  {
    const { c, p } = await open(b, { w: 390, lang: 'en', size: 'small', state: 'mid' });
    await (await p.$('#planCard')).screenshot({ path: `${SHOTS}/baseline-compare-en-390.png` });
    const g = await p.evaluate(() => { const h = byId('planCard').getBoundingClientRect(); return { w: h.width, h: h.height }; });
    note('390 en small card size ' + JSON.stringify(g)); await c.close();
  }
  await b.close();
  console.log(`\n${pass} pass / ${fail} fail`); if (notes.length) console.log('notes:\n  ' + notes.join('\n  '));
  if (bugs.length) console.log('bugs:\n  ' + bugs.join('\n  '));
  process.exit(fail ? 1 : 0);
})();
