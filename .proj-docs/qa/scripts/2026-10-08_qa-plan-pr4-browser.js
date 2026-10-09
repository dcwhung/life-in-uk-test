// QA plan PR4 (schedule, change goal, reset, G36, S-112): real-browser checks over http
//   node 2026-10-08_qa-plan-pr4-browser.js <repo-root> <work-dir> <shot-dir> [base-ref=origin/main] [v101-ref=4dc89b2]
// H. hidden (no preview): base tree (origin/main = PR3) vs PR tree, same boot + ⓘ + language + Home flow
// F. real user flow, entered by URL (?preview=plan), clicks / keyboard / touch only: create → schedule → days pass
//    (page.clock) → change goal (G7 / G36) → reset; S-112; G16 (exam day / after)
// E. QA edge cases (corrupt log reset, Esc on reset modal, double confirm, deleted in another tab, rows inert …)
// P. performance: 183-day plan + 90-day log, open schedule + language switch (CPU ×1 and ×4)
// L. 360 / 375 / 400 × en / zh-HK: horizontal scroll, touch targets, zh-HK colloquial scan, screenshots (+ mockup)
// U. upgrade: v1.0.1 and PR3 (origin/main) SW → PR tree; planSchedule.js in cache; offline; mixed old shell + new js
// QA_ONLY=HFEPLU picks parts.
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(process.argv[2]); const WORK = path.resolve(process.argv[3]); const SHOTS = path.resolve(process.argv[4]);
const BASE = process.argv[5] || 'origin/main'; const V101 = process.argv[6] || '4dc89b2';
const { startPagesServer, appFiles } = require(path.join(ROOT, 'tests', 'pages-server.js'));
let pass = 0, fail = 0; const notes = [];
const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; console.log('FAIL:', m); } };
const note = m => { notes.push(m); console.log('note:', m); };
const launchOpts = { args: ['--no-sandbox'] }; if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const TODAY = '2026-10-08'; const at = iso => new Date(iso + 'T09:00:00'); const NOW = at(TODAY);
const settle = (pg, ms = 150) => pg.waitForTimeout(ms);
const INIT = () => {
  window.__w = [];
  const set = Storage.prototype.setItem, rm = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) { window.__w.push(['set', k, v]); return set.call(this, k, v); };
  Storage.prototype.removeItem = function (k) { window.__w.push(['rm', k]); return rm.call(this, k); };
};
const screen = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
const visible = (pg, sel) => pg.evaluate(sel => { const e = document.querySelector(sel); return !!e && e.getClientRects().length > 0; }, sel);
const ls = (pg, k) => pg.evaluate(k => localStorage.getItem(k), k);
const watch = pg => { const errs = []; pg.on('pageerror', e => errs.push('pageerror: ' + e.message)); pg.on('console', m => { if (m.type() === 'error' || /\[i18n\] missing/.test(m.text())) errs.push('console: ' + m.text()); }); return errs; };
const toastState = pg => pg.evaluate(() => { const e = byId('appToast'); return { shown: !e.hidden && e.getClientRects().length > 0, text: e.textContent }; });
const archive = (ref, dir) => { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); execSync(`git archive ${ref} | tar -x -C "${dir}"`, { cwd: ROOT, shell: '/bin/bash' }); };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const storageAll = pg => pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
// type a date into the focused <input type=date> in the browser's segment order, then click away
async function typeDate(pg, iso, away = '#screenPlanGoal .plan-h2') {
  const [y, m, d] = iso.split('-').map(Number);
  const seq = await pg.evaluate(([y, m, d]) => new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(y, m - 1, d)).filter(p => p.type !== 'literal').map(p => p.value).join(''), [y, m, d]);
  await pg.focus('#planExamDate'); await pg.keyboard.type(seq, { delay: 25 }); await pg.click(away); await settle(pg, 120);
}
// WCAG contrast of each visible text node's element against its painted background
const CONTRAST_FN = () => {
  const rgb = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = c => { const v = rgb(c).slice(0, 3).map(x => x / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const bgOf = e => { for (let n = e; n; n = n.parentElement) { const s = getComputedStyle(n); const c = rgb(s.backgroundColor); if (s.backgroundImage !== 'none') return null; if (c.length === 3 || (c.length === 4 && c[3] > 0.9)) return s.backgroundColor; } return 'rgb(255,255,255)'; };
  const opac = e => { let o = 1; for (let n = e; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; };
  window.__contrast = e => { const bg = bgOf(e); if (!bg) return null; const a = lum(getComputedStyle(e).color), b = lum(bg); return { r: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), o: opac(e) }; };
};

// ── H: hidden state, base (PR3) vs PR ──
async function hiddenFlow(b, base, label) {
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
  await ctx.addInitScript(INIT);
  const pg = await ctx.newPage(); const errs = watch(pg);
  await pg.clock.setFixedTime(NOW);
  await pg.goto(base); await settle(pg);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); });
  await pg.goto(base); await settle(pg, 300);
  const r = {};
  await pg.click('#infoBtn'); await settle(pg);
  r.info = await pg.$eval('#infoPop', e => e.innerText);
  await pg.click('#infoBtn'); await settle(pg);
  await pg.click('#langBtn'); await settle(pg, 300);
  await pg.click('#infoBtn'); await settle(pg);
  r.infoZh = await pg.$eval('#infoPop', e => e.innerText);
  await pg.keyboard.press('Escape'); await settle(pg);
  r.homeZh = await pg.$eval('#screenHome', e => e.innerText);
  await pg.click('#langBtn'); await settle(pg, 300);
  await pg.click('#modePractice'); await settle(pg);
  r.home = await pg.$eval('#screenHome', e => e.innerText);
  r.homeHtml = await pg.$eval('#screenHome', e => e.outerHTML);
  await examTab(pg);
  await pg.click('#examGrid [data-action="startExam"][data-arg="1"]'); await settle(pg, 200);
  for (const oi of await pg.evaluate(() => state.questions[state.current].a)) await pg.click('#opt' + oi); // a correct answer (options are shuffled)
  await settle(pg, 150);
  r.quiz = await pg.$eval('#screenQuiz', e => e.innerText.replace(/\d+:\d+/g, ''));
  r.writes = await pg.evaluate(() => window.__w.map(w => w[0] + ':' + w[1]));
  r.storage = await storageAll(pg);
  if (label === 'pr') r.dom = await pg.evaluate(() => ({ card: !!byId('planCard'), row: byId('infoPlanRow').hidden, sched: byId('screenPlanSchedule').classList.contains('active'), list: byId('planDayList').innerHTML, toast: byId('appToast').hidden }));
  r.errs = errs; await ctx.close(); return r;
}
async function partH(b) {
  const dir = path.join(WORK, 'pr4-base'); archive(BASE, dir);
  const s1 = await startPagesServer(dir), s2 = await startPagesServer(ROOT);
  try {
    const a = await hiddenFlow(b, s1.base, 'base'), p = await hiddenFlow(b, s2.base, 'pr');
    if (JSON.stringify(a.writes) !== JSON.stringify(p.writes)) console.log('  base writes:', a.writes.join(' | '));
    ok(JSON.stringify(a.writes) === JSON.stringify(p.writes), `[H1] boot + ⓘ + en↔zh-HK + Practice + 1 answer: storage write sequence identical (${p.writes.length}) ${p.writes.join(' | ')}`);
    const strip = s => { const o = { ...s }; delete o['lifeuk.practiceStreak']; return o; };
    if (JSON.stringify(a.storage) !== JSON.stringify(p.storage)) console.log('  base:', JSON.stringify(a.storage), '\n  pr:', JSON.stringify(p.storage));
    ok(JSON.stringify(strip(a.storage)) === JSON.stringify(strip(p.storage)) && Object.keys(a.storage).join() === Object.keys(p.storage).join(), '[H2] final localStorage keys identical; values identical except the streak of the (random) first question');
    ok(!p.writes.some(w => /studyPlan/.test(w)), '[H3] 0 lifeuk.studyPlan* writes');
    ok(a.info === p.info && a.infoZh === p.infoZh, '[H4] ⓘ popover text identical (en + zh-HK)');
    ok(a.home === p.home && a.homeZh === p.homeZh && a.homeHtml === p.homeHtml, '[H5] Home text + outerHTML identical (no #planCard)');
    ok(!p.dom.card && p.dom.row && !p.dom.sched && p.dom.list === '' && p.dom.toast, `[H6] PR DOM: no card, Features row hidden, schedule never rendered ${JSON.stringify({ ...p.dom, list: p.dom.list.length })}`);
    ok(a.errs.length === 0 && p.errs.length === 0, `[H7] 0 console / page errors ${a.errs.concat(p.errs).join(' | ')}`);
  } finally { s1.server.kill(); s2.server.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
}

// Practice → "By exam" tab (the exam grid), by click
async function examTab(pg) { if (!(await visible(pg, '#examGrid button'))) { await pg.click('#ptabExam'); await settle(pg, 100); } }
// answer n Practice questions correctly through the real quiz UI (Exam set `exam`), then back Home
async function practise(pg, exam, n) {
  await pg.click('#modePractice'); await settle(pg, 100); await examTab(pg);
  await pg.click(`#examGrid [data-action="startExam"][data-arg="${exam}"]`); await settle(pg, 200);
  for (let i = 0; i < n; i++) {
    const a = await pg.evaluate(() => state.questions[state.current].a);
    for (const oi of a) await pg.click('#opt' + oi);
    await settle(pg, 60);
    await pg.click('#nextBtn'); await settle(pg, 80);
    if ((await screen(pg)) !== 'screenQuiz') break;
  }
  await pg.evaluate(() => leaveToHome()); await settle(pg, 150);
}
const listState = pg => pg.evaluate(() => {
  const l = byId('planDayList'), lr = l.getBoundingClientRect();
  const row = l.querySelector('.plan-day.today') || null;
  const rr = row && row.getBoundingClientRect();
  const hit = document.elementFromPoint(lr.left + lr.width / 2, lr.top + 4); const head = hit && hit.closest('.plan-week');
  return { scrollY, top: l.scrollTop, rowGap: rr ? Math.round(rr.top - lr.top) : null, headH: head ? Math.round(head.getBoundingClientRect().height) : null,
    head: head && head.textContent, headW: head && Math.round(head.getBoundingClientRect().width), listW: l.clientWidth,
    inView: rr ? rr.top >= lr.top && rr.top < lr.bottom : null, maxH: Math.round(lr.height), vh: innerHeight };
});

// ── F: real user flow via URL ──
async function partF(b) {
  const s = await startPagesServer(ROOT);
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    await ctx.addInitScript(INIT); await ctx.addInitScript(CONTRAST_FN);
    const pg = await ctx.newPage(); const errs = watch(pg);
    await pg.clock.setFixedTime(NOW);
    await pg.goto(s.base); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); localStorage.setItem('lifeuk.wrongList', '{"1.3":true}'); });
    await pg.goto(s.base + '?preview=plan'); await settle(pg, 300);
    // F1 create → schedule
    await pg.click('#planCard .plan-cta'); await settle(pg, 200);
    ok(await screen(pg) === 'screenPlanGoal' && await pg.evaluate(() => byId('planCreateBtn').textContent) === 'Build my plan →' && await visible(pg, '#planGoalSteps') && !(await visible(pg, '#planDateNote')), '[F1] create card → goal screen in create mode (stepper, "Build my plan →", no G36 note)');
    await pg.click('#planCreateBtn'); await settle(pg, 300);
    const p0 = await pg.evaluate(() => planLoad());
    ok(await screen(pg) === 'screenPlanSchedule' && p0 && p0.start === '2026-10-08' && p0.goal.examDate === '2026-10-29' && p0.days.length === 21, `[F1] Build → schedule opens; plan 2026-10-08 → 10-29, ${p0 && p0.days.length} days`);
    const sc = await pg.evaluate(() => ({ y: scrollY, title: document.querySelector('#screenPlanSchedule .plan-h2').textContent, sum: byId('planSummary').textContent,
      bar: [...document.querySelectorAll('#planPhaseBar > div')].map(e => e.className + ':' + e.textContent + ':' + Math.round(e.getBoundingClientRect().width)),
      strat: [...document.querySelectorAll('#planStrategy .plan-strat')].map(e => e.className.split(' ')[1] + '|' + e.querySelector('.plan-strat-days').textContent + '|' + e.querySelector('h4').textContent),
      order: [...document.querySelectorAll('#planOrder .plan-ord')].map(e => e.querySelector('b').textContent + ' | ' + e.querySelector('.plan-chw-c').textContent + ' | ' + e.querySelector('.plan-ord-why').textContent.slice(0, 40)),
      bars: [...document.querySelectorAll('#planOrder .plan-chw-bar i')].map(e => e.style.width) }));
    ok(sc.y === 0 && sc.title === 'Your study schedule' && /Starts 8\/10 · exam 29\/10 · up to 2 hr a day · Starting fresh/.test(sc.sum), `[F2] summary "${sc.sum}"`);
    ok(sc.bar.length === 3 && /learn/.test(sc.bar[0]) && /drill/.test(sc.bar[1]) && /mock/.test(sc.bar[2]), `[F2] phase bar has the three phases ${sc.bar.join(' / ')}`);
    ok(sc.strat.length === 3 && sc.strat.every(x => /Day \d+(–\d+)?/.test(x)), `[F2] strategy cards: ${sc.strat.join(' / ')}`);
    ok(sc.order.length === 4 && /Ch 1.*\+.*Ch 2/.test(sc.order[0]) && /Ch 5/.test(sc.order[1]) && /Ch 4/.test(sc.order[2]) && /Ch 3/.test(sc.order[3]) && sc.order.every(o => o.split(' | ')[2].length > 10), `[F3] study order Ch1–2 → Ch5 → Ch4 → Ch3 with reasons: ${sc.order.join(' // ')} bars ${sc.bars}`);
    const tx = await pg.$$eval('#planDayList .plan-day:not(.exam)', es => es.map(e => e.innerText).join('\n')); // the exam row's "arrive 30 minutes early" is advice, not a task
    const mins = tx.match(/.{0,30}(\d+\s*min|分鐘|🏆).{0,10}/g);
    ok(!mins, `[F3] task lines carry no minutes (handoff §2.3) ${mins ? mins.join(' / ') : ''}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-schedule-day1.png'), fullPage: true });
    // F4 day 1: practise through the real Practice UI → log on today
    await pg.click('#screenPlanSchedule .back-btn'); await settle(pg, 150);
    ok(await visible(pg, '#planCard [data-action="openPlanSchedule"]'), '[F4] Home plan card has a "Schedule" button');
    await practise(pg, 1, 24);
    const log1 = await pg.evaluate(() => planLoadLog());
    const d1n = log1 && log1.days['2026-10-08'] ? Object.keys(log1.days['2026-10-08'].ok || {}).length : 0;
    note(`Day 1: 24 Practice answers in Exam 1 → ${d1n} counted for today's plan tasks`);
    // F5 days pass (page.clock): 10-09 practise more, then 10-13 (Tue) = Day 6
    await pg.clock.setFixedTime(at('2026-10-09')); await pg.reload(); await settle(pg, 300);
    await practise(pg, 2, 24);
    await pg.clock.setFixedTime(at('2026-10-13')); await pg.reload(); await settle(pg, 300);
    const card = await pg.$eval('#planCard', e => e.innerText.replace(/\s+/g, ' '));
    ok(/Day 6 \/ 21/.test(card) && /16 days to the exam/.test(card), `[F5] 5 days later Home card "${card}"`);
    await pg.click('#planCard [data-action="openPlanSchedule"]'); await settle(pg, 250);
    await pg.waitForTimeout(200);
    const y0 = await pg.evaluate(() => scrollY);
    await pg.$eval('#planDayList', e => e.scrollIntoView({ block: 'end', behavior: 'instant' })); await settle(pg, 300); // the user scrolls the page down to the list
    const L = { ...(await listState(pg)), scrollY: y0 };
    ok(L.scrollY === 0 && L.top > 0 && L.inView && Math.abs(L.rowGap - L.headH) <= 2, `[F5] list opens scrolled to today (Day 6) just under the sticky WEEK heading, page not scrolled ${JSON.stringify(L)}`);
    ok(L.head === 'Week 1' && L.headW === L.listW, `[F5] sticky heading "${L.head}" spans the list's full width (${L.headW} / ${L.listW})`);
    ok(L.maxH <= Math.round(L.vh * 0.6) + 1, `[F5] list is its own scroller ≤ 60vh (${L.maxH} / ${L.vh})`);
    const rows = await pg.evaluate(() => [...document.querySelectorAll('#planDayList .plan-day')].map(r => ({ cls: r.className, n: r.querySelector('.plan-day-d').firstChild.textContent, pill: (r.querySelector('.plan-pill') || {}).textContent || '', pc: (r.querySelector('.plan-pill') || {}).className || '' })));
    const past = rows.filter(r => /past/.test(r.cls)), today = rows.filter(r => /today/.test(r.cls));
    ok(past.length === 5 && today.length === 1 && today[0].n === '6' && /Today \d+%/.test(today[0].pill), `[F5] 5 past days, today = Day 6 "${today[0] && today[0].pill}"`);
    ok(past.filter(r => !/rest/.test(r.cls)).every(r => /h[0-3]|ok/.test(r.pc)), `[F5] past study days carry ✓ / G27 band pills: ${past.map(r => r.n + ':' + r.pill + '(' + r.pc.replace('plan-pill', '').trim() + ')').join(', ')}`);
    ok(rows.filter(r => /rest/.test(r.cls)).every(r => /Rest/.test(r.pill)) && rows.some(r => /rest/.test(r.cls)), `[F5] rest days (Sun) show the "Rest" pill`);
    const ahead = rows.filter(r => !/past|today|rest/.test(r.cls) && !/exam/.test(r.cls));
    ok(ahead.every(r => r.pill === ''), '[F5] days ahead have no pill (PR5)');
    // contrast of past rows
    const con = await pg.evaluate(() => { const out = []; document.querySelectorAll('#planDayList .plan-day.past *').forEach(e => { if (e.closest('[aria-hidden="true"]')) return; // decorative icons
      if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return; const c = window.__contrast(e); if (c) out.push({ t: e.textContent.trim().slice(0, 18), r: +c.r.toFixed(2), o: c.o, cls: e.className }); }); return out; });
    const low = con.filter(c => c.r < 4.5 || c.o < 1);
    ok(con.length > 10 && low.length === 0, `[F6] past-day texts (${con.length}) ≥ 4.5:1, no opacity; min ${Math.min(...con.map(c => c.r))} ${low.map(c => c.t + ' ' + c.r + '/' + c.o).join(' | ')}`);
    const pastBg = await pg.evaluate(() => { const r = document.querySelector('#planDayList .plan-day.past'), t = document.querySelector('#planDayList .plan-day.today'), a = document.querySelector('#planDayList .plan-day:not(.past):not(.today)');
      return { past: getComputedStyle(r).backgroundColor, pastD: getComputedStyle(r.querySelector('.plan-day-d')).backgroundColor, today: getComputedStyle(t).backgroundColor, aheadD: getComputedStyle(a.querySelector('.plan-day-d')).backgroundColor }; });
    ok(pastBg.past !== pastBg.today && pastBg.pastD !== pastBg.aheadD, `[F6] past rows grey (row ${pastBg.past}, date box ${pastBg.pastD}) vs today ${pastBg.today} / ahead box ${pastBg.aheadD}`);
    // exam row: amber lattice, last
    await pg.$eval('#planDayList', e => e.scrollTo({ top: e.scrollHeight, behavior: 'instant' })); await settle(pg, 200);
    const ex = await pg.evaluate(() => { const r = [...document.querySelectorAll('#planDayList .plan-day')].pop(); const d = r.querySelector('.plan-day-d'); const s = getComputedStyle(d);
      return { exam: r.classList.contains('exam'), img: s.backgroundImage, bg: s.backgroundColor, text: r.innerText.replace(/\s+/g, ' ') }; });
    ok(ex.exam && /linear-gradient/.test(ex.img) && /rgb\(242, 169, 59\)/.test(ex.bg) && /Exam day/.test(ex.text), `[F7] last row = exam day with amber lattice "${ex.text}"`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-schedule-exam-row.png') });
    // sticky while the user scrolls with the wheel
    const lb = await pg.$eval('#planDayList', e => { e.scrollTo({ top: 0, behavior: 'instant' }); e.scrollIntoView({ block: 'end', behavior: 'instant' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, sy: scrollY }; });
    await pg.mouse.move(lb.x, lb.y); await pg.mouse.wheel(0, 1000); await settle(pg, 300); await pg.mouse.wheel(0, 1000); await settle(pg, 700);
    const st = await listState(pg);
    ok(/Week [2-4]/.test(st.head || '') && st.scrollY === lb.sy && st.top > 0, `[F7] wheel scroll inside the list: heading "${st.head}" sticks, page stays (overscroll contained) ${JSON.stringify(st)}`);
    // rows inert in PR4
    const before = await screen(pg);
    await pg.click('#planDayList .plan-day.today').catch(() => {}); await settle(pg, 100);
    ok(before === 'screenPlanSchedule' && await screen(pg) === 'screenPlanSchedule' && errs.length === 0, '[F7] tapping a day row does nothing yet (day screen is PR5), no error');
    await pg.click('#screenPlanSchedule .back-btn'); await settle(pg, 120);
    await pg.click('#planCard [data-action="openPlanSchedule"]'); await settle(pg, 250);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-schedule-day6.png'), fullPage: true });

    // F8 change goal: prefilled, edit mode, G7
    const g0 = await pg.evaluate(() => ({ plan: planLoad(), log: localStorage.getItem('lifeuk.studyPlanProgress'), past: [...document.querySelectorAll('#planDayList .plan-day.past')].map(e => e.outerHTML) }));
    await pg.click('#screenPlanSchedule [data-action="planEditGoal"]'); await settle(pg, 250);
    const ed = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, draft: planGoalDraft, step: byId('planGoalStep').textContent, steps: byId('planGoalSteps').getClientRects().length,
      note: byId('planDateNote').getClientRects().length ? byId('planDateNote').textContent : '', cta: byId('planCreateBtn').textContent, min: byId('planExamDate').min, val: byId('planExamDate').value,
      rest: [...document.querySelectorAll('#planRestChips .chip')].filter(c => c.getAttribute('aria-pressed') === 'true').map(c => c.textContent), mins: byId('planMins').value, lvl: document.querySelector('#planLevelGrid .mode-card.selected .mode-title').textContent,
      pill: byId('planFeasPill').textContent }));
    ok(ed.scr === 'screenPlanGoal' && JSON.stringify(ed.draft) === JSON.stringify(g0.plan.goal) && ed.val === '2026-10-29' && ed.rest.join() === 'Sun' && ed.mins === '120' && ed.lvl === 'Starting fresh', `[F8] Change goal: form prefilled with the plan's goal ${JSON.stringify(ed.draft)}`);
    ok(ed.step === 'Change goal' && ed.steps === 0 && /tomorrow/.test(ed.note) && /Update/.test(ed.cta) && ed.min === '2026-10-14', `[F8] edit mode: label "${ed.step}", no stepper, note "${ed.note}", CTA "${ed.cta}", date min ${ed.min} (G36 = tomorrow)`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-change-goal.png'), fullPage: true });
    // later exam + Saturday rest, 60 min
    await pg.click('#planDaysChips .chip >> nth=1'); await settle(pg, 80); // 3 weeks from today → 11-03
    await pg.click('#planRestChips [data-arg="6"]'); await pg.focus('#planMins'); await pg.keyboard.press('Home'); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowRight'); await settle(pg, 80);
    const dr = await pg.evaluate(() => planGoalDraft);
    await pg.click('#planCreateBtn'); await settle(pg, 300);
    const g1 = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, plan: planLoad(), log: localStorage.getItem('lifeuk.studyPlanProgress'), past: [...document.querySelectorAll('#planDayList .plan-day.past')].map(e => e.outerHTML),
      todayN: document.querySelector('#planDayList .plan-day.today .plan-day-d').firstChild.textContent, first: document.querySelector('#planDayList .plan-day').textContent }));
    ok(g1.scr === 'screenPlanSchedule' && g1.plan.goal.examDate === dr.examDate && dr.examDate === '2026-11-03' && g1.plan.goal.dailyMins === 60, `[F9] Update → schedule; new goal ${JSON.stringify(g1.plan.goal)}`);
    ok(JSON.stringify(g1.plan.days.slice(0, 5)) === JSON.stringify(g0.plan.days.slice(0, 5)) && JSON.stringify(g1.past) === JSON.stringify(g0.past), '[F9] G7: past days (tasks + completion rows) byte-identical');
    ok(g1.plan.start === g0.plan.start && g1.todayN === '6' && /^1/.test(g1.first) && g1.log === g0.log && g1.plan.goalHistory.length === 1, `[F9] Day 1 unchanged (start ${g1.plan.start}, today still Day ${g1.todayN}), log untouched, goalHistory +1`);
    // F10 G36: exam tomorrow, 1 study day
    await pg.click('#screenPlanSchedule [data-action="planEditGoal"]'); await settle(pg, 250);
    await typeDate(pg, '2026-10-14');
    const g36 = await pg.evaluate(() => ({ d: planGoalDraft.examDate, days: byId('planDaysVal').textContent, study: byId('planFeasDays').textContent, cta: byId('planCreateBtn').disabled, hint: !byId('planGoalHint').hidden, pill: byId('planFeasPill').textContent, msg: byId('planFeasMsg').textContent }));
    ok(g36.d === '2026-10-14' && g36.study === '1' && !g36.cta && !g36.hint, `[F10] G36: exam tomorrow via keyboard → 1 study day, CTA enabled ${JSON.stringify(g36)}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-change-goal-tomorrow.png'), fullPage: true });
    // 1 study day but today is a rest day → 0 → disabled with edit hint
    await pg.click('#planRestChips [data-arg="2"]'); await settle(pg, 80);
    const g36b = await pg.evaluate(() => ({ study: byId('planFeasDays').textContent, cta: byId('planCreateBtn').disabled, hint: byId('planGoalHint').hidden ? '' : byId('planGoalHint').textContent }));
    ok(g36b.study === '0' && g36b.cta && /at least 1 study day/i.test(g36b.hint), `[F10] today made a rest day → 0 study days, disabled, hint "${g36b.hint}"`);
    await pg.click('#planRestChips [data-arg="2"]'); await settle(pg, 80);
    await pg.click('#planCreateBtn'); await settle(pg, 300);
    const g36c = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, n: planLoad().days.length, last: planLoad().days.slice(-1)[0], ex: planLoad().goal.examDate, rows: document.querySelectorAll('#planDayList .plan-day').length }));
    ok(g36c.scr === 'screenPlanSchedule' && g36c.ex === '2026-10-14' && g36c.n === 6 && g36c.rows === 7, `[F10] Update → 6 days (5 past + today) + exam row tomorrow; today = ${g36c.last.phase}${g36c.last.light ? ' light' : ''} ${g36c.last.tasks.map(t => t.type).join(',')}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-schedule-g36.png'), fullPage: true });

    // F11 reset: Cancel, then Confirm
    const keep = await storageAll(pg);
    await pg.click('#screenPlanSchedule [data-action="planAskReset"]'); await settle(pg, 250);
    const rm = await pg.evaluate(() => ({ open: isConfirmOpen(), title: byId('confirmTitle').textContent, msg: byId('confirmMsg').textContent, ok: byId('confirmOk').textContent, cancel: byId('confirmCancel').textContent, focus: document.activeElement.id }));
    ok(rm.open && rm.title === 'Reset the study plan?' || (rm.open && /Reset/.test(rm.title)), `[F11] ↺ Reset → app modal "${rm.title}" OK "${rm.ok}" / "${rm.cancel}", focus ${rm.focus}`);
    ok(rm.ok === 'Confirm' && rm.focus === 'confirmCancel', '[F11] modal OK = "Confirm", focus starts on Cancel');
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-reset-modal.png') });
    await pg.click('#confirmCancel'); await settle(pg, 150);
    ok(await screen(pg) === 'screenPlanSchedule' && JSON.stringify(await storageAll(pg)) === JSON.stringify(keep), '[F11] Cancel: still on the schedule, storage untouched');
    await pg.evaluate(() => { window.__w = []; });
    await pg.click('#screenPlanSchedule [data-action="planAskReset"]'); await settle(pg, 250); await pg.click('#confirmOk'); await settle(pg, 250);
    const after = await storageAll(pg); const t1 = await toastState(pg);
    const w = await pg.evaluate(() => window.__w.map(x => x[0] + ':' + x[1]));
    const expect = { ...keep }; delete expect['lifeuk.studyPlan']; delete expect['lifeuk.studyPlanProgress'];
    ok(JSON.stringify(after) === JSON.stringify(expect) && JSON.stringify(w) === JSON.stringify(['rm:lifeuk.studyPlan', 'rm:lifeuk.studyPlanProgress']), `[F11] Confirm: only plan + log removed (writes ${w.join(', ')}); wrongList / mastery / preview kept`);
    ok(await screen(pg) === 'screenHome' && await visible(pg, '#planCard .plan-cta') && await pg.evaluate(() => scrollY) === 0, '[F11] back on Home at the top with the create card');
    ok(t1.shown && t1.text === 'Study plan reset. You can build a new one.' || (t1.shown && /reset/i.test(t1.text)), `[F11] toast "${t1.text}" (G34)`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-reset-toast.png') });
    // F12 create mode after reset keeps +7 / 7 (G28)
    await pg.click('#planCard .plan-cta'); await settle(pg, 200);
    const cm = await pg.evaluate(() => ({ min: byId('planExamDate').min, note: byId('planDateNote').getClientRects().length, steps: byId('planGoalSteps').getClientRects().length, cta: byId('planCreateBtn').textContent, step: byId('planGoalStep').textContent, draft: planGoalDraft }));
    ok(cm.min === '2026-10-20' && cm.note === 0 && cm.steps > 0 && cm.cta === 'Build my plan →' && cm.draft.dailyMins === 120 && cm.draft.restDays.join() === '0', `[F12] after reset, create mode: min ${cm.min} (+7), stepper, defaults (not the old goal) ${JSON.stringify(cm)}`);
    await typeDate(pg, '2026-10-14');
    const cm2 = await pg.evaluate(() => planGoalDraft.examDate);
    await pg.click('#planDaysChips .chip >> nth=0'); for (const d of [1, 2, 3, 4]) await pg.click(`#planRestChips [data-arg="${d}"]`); await settle(pg, 80);
    const cm3 = await pg.evaluate(() => ({ study: byId('planFeasDays').textContent, cta: byId('planCreateBtn').disabled, hint: byId('planGoalHint').textContent }));
    ok(cm2 !== '2026-10-14' && cm3.cta && /7 study days/.test(cm3.hint), `[F12] create: typing tomorrow not taken (${cm2}); 14 days with 5 rest days → ${cm3.study} study days, disabled "${cm3.hint}"`);
    await pg.click('#screenPlanGoal .back-btn'); await settle(pg, 120);

    // F13 corrupt log: schedule still opens, reset clears it (S-110 / O-1)
    await pg.click('#planCard .plan-cta'); await settle(pg, 150); await pg.click('#planCreateBtn'); await settle(pg, 250);
    await pg.evaluate(() => localStorage.setItem('lifeuk.studyPlanProgress', '{bad')); await pg.reload(); await settle(pg, 300);
    await pg.click('#planCard [data-action="openPlanSchedule"]'); await settle(pg, 250);
    const cr = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, rows: document.querySelectorAll('#planDayList .plan-day').length }));
    await pg.click('#screenPlanSchedule [data-action="planAskReset"]'); await settle(pg, 200); await pg.click('#confirmOk'); await settle(pg, 250);
    const cr2 = await pg.evaluate(() => ({ p: localStorage.getItem('lifeuk.studyPlan'), l: localStorage.getItem('lifeuk.studyPlanProgress'), card: !!document.querySelector('#planCard .plan-cta') }));
    ok(cr.scr === 'screenPlanSchedule' && cr.rows > 0 && cr2.p === null && cr2.l === null && cr2.card, `[F13] corrupt log "{bad": schedule opens (${cr.rows} rows), ↺ Reset clears plan + log, create card back`);
    await pg.click('#planCard .plan-cta'); await settle(pg, 150); await pg.click('#planCreateBtn'); await settle(pg, 250);
    ok(await pg.evaluate(() => JSON.stringify(planLoadLog())) !== 'null', '[F13] new plan after recovery has a readable log');

    // F14 S-112: Cancel / Esc / Confirm on the switch-off modal keep the popover open with a visible focus
    await pg.click('#screenPlanSchedule .back-btn'); await settle(pg, 120);
    const s112 = async how => {
      if (!(await pg.evaluate(() => byId('infoPop').classList.contains('show')))) { await pg.click('#infoBtn'); await settle(pg, 150); }
      if (how === 'key') { await pg.focus('#planFeatureSwitch'); await pg.keyboard.press('Space'); } else await pg.click('#planFeatureSwitch');
      await settle(pg, 250);
      const open = await pg.evaluate(() => isConfirmOpen());
      if (how === 'cancel') await pg.click('#confirmCancel'); else if (how === 'esc' || how === 'key') await pg.keyboard.press('Escape'); else await pg.click('#confirmOk');
      await settle(pg, 250);
      return pg.evaluate(open => { const sw = byId('planFeatureSwitch'); const r = sw.getBoundingClientRect(); const c = getComputedStyle(sw);
        return { open, modal: isConfirmOpen(), pop: byId('infoPop').classList.contains('show'), focus: document.activeElement.id, fv: sw.matches(':focus-visible'), outline: c.outlineStyle + ' ' + c.outlineWidth + ' / ' + c.boxShadow.slice(0, 30), inView: r.top >= 0 && r.bottom <= innerHeight, on: isStudyPlanEnabled() }; }, open);
    };
    const r1 = await s112('cancel');
    ok(r1.open && !r1.modal && r1.pop && r1.focus === 'planFeatureSwitch' && r1.inView && r1.on, `[F14] S-112 Cancel (mouse): popover open, focus on the switch ${JSON.stringify(r1)}`);
    const r2 = await s112('esc');
    ok(r2.open && !r2.modal && r2.pop && r2.focus === 'planFeatureSwitch' && r2.on, `[F14] S-112 Esc: modal only closes, popover open, focus on switch ${JSON.stringify(r2)}`);
    const r3 = await s112('key');
    ok(r3.open && r3.pop && r3.focus === 'planFeatureSwitch' && r3.fv && r3.on, `[F14] S-112 keyboard Space → Esc: focus ring visible (:focus-visible) ${JSON.stringify(r3)}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-s112-after-esc.png') });
    await pg.keyboard.press('Escape'); await settle(pg, 120);
    ok(!(await pg.evaluate(() => byId('infoPop').classList.contains('show'))), '[F14] next Esc closes the popover');
    const r4 = await s112('confirm');
    ok(r4.open && !r4.modal && r4.pop && r4.focus === 'planFeatureSwitch' && !r4.on, `[F14] S-112 Confirm: off, popover open, focus on the switch ${JSON.stringify(r4)}`);
    if (!r1.fv) note(`S-112 mouse Cancel: focus returns to the switch but :focus-visible = ${r1.fv} (Chromium shows no ring after a mouse click; keyboard path shows it)`);
    await pg.click('#planFeatureSwitch'); await settle(pg, 200); // back on
    // Confirm while on the schedule (G15): leaves it for Home
    await pg.keyboard.press('Escape'); await settle(pg, 100);
    await pg.click('#planCard [data-action="openPlanSchedule"]'); await settle(pg, 200);
    await pg.click('#infoBtn'); await settle(pg, 150); await pg.click('#planFeatureSwitch'); await settle(pg, 250); await pg.click('#confirmOk'); await settle(pg, 250);
    const r5 = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, pop: byId('infoPop').classList.contains('show'), focus: document.activeElement.id, plan: !!localStorage.getItem('lifeuk.studyPlan') }));
    ok(r5.scr === 'screenHome' && r5.plan, `[F14] switch off on the schedule → Home (G15), plan kept ${JSON.stringify(r5)}`);
    await pg.click('#planFeatureSwitch').catch(() => {}); await settle(pg, 200);
    if (!(await pg.evaluate(() => isStudyPlanEnabled()))) { await pg.click('#infoBtn'); await pg.click('#planFeatureSwitch'); }
    await pg.keyboard.press('Escape'); await settle(pg, 100);

    // F15 G16: exam day and after (page.clock)
    const ex0 = await pg.evaluate(() => planLoad().goal.examDate); // plan built 10-13 → exam 11-03
    await pg.clock.setFixedTime(at(ex0)); await pg.reload(); await settle(pg, 300);
    const cE = await pg.$eval('#planCard', e => e.innerText.replace(/\s+/g, ' '));
    await pg.click('#planCard [data-action="openPlanSchedule"]'); await settle(pg, 300);
    const e1 = await pg.evaluate(() => { const l = byId('planDayList'), lr = l.getBoundingClientRect(), ex = l.querySelector('.plan-day.exam'), er = ex.getBoundingClientRect();
      return { past: l.querySelectorAll('.plan-day.past').length, rows: l.querySelectorAll('.plan-day').length, exToday: ex.classList.contains('today'), inView: er.top >= lr.top && er.bottom <= lr.bottom + 1, today: l.querySelectorAll('.plan-day.today').length }; });
    ok(e1.exToday && e1.today === 1 && e1.past === e1.rows - 1 && e1.inView, `[F15] G16 exam day ${ex0}: Home "${cE}"; schedule opens on the exam row (today), every study day past ${JSON.stringify(e1)}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-schedule-exam-day.png') });
    await pg.clock.setFixedTime(at(addDays(ex0, 4))); await pg.reload(); await settle(pg, 300);
    const cA = await pg.$eval('#planCard', e => e.innerText.replace(/\s+/g, ' '));
    await pg.click('#planCard [data-action="openPlanSchedule"]'); await settle(pg, 300);
    const e2 = await pg.evaluate(() => { const l = byId('planDayList'), lr = l.getBoundingClientRect(), ex = l.querySelector('.plan-day.exam'), er = ex.getBoundingClientRect();
      return { all: l.querySelectorAll('.plan-day.past').length === l.querySelectorAll('.plan-day').length, inView: er.top >= lr.top - 1 && er.top < lr.bottom, top: l.scrollTop }; });
    ok(e2.all && e2.inView && /0 days to the exam/.test(cA), `[F15] G16 4 days after: every row past incl. exam, list opens at the exam row; Home "${cA}" ${JSON.stringify(e2)}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-schedule-after-exam.png') });
    // change goal after the exam: date clamps to tomorrow, update re-plans, past frozen
    const pb = await pg.evaluate(() => planLoad());
    await pg.click('#screenPlanSchedule [data-action="planEditGoal"]'); await settle(pg, 250);
    const ae = await pg.evaluate(() => ({ d: planGoalDraft.examDate, min: byId('planExamDate').min, cta: byId('planCreateBtn').disabled }));
    await pg.click('#planCreateBtn'); await settle(pg, 300);
    const pa = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, p: planLoad() }));
    const nPast = pb.days.length;
    ok(ae.d === ae.min && ae.d === addDays(ex0, 5) && pa.scr === 'screenPlanSchedule' && JSON.stringify(pa.p.days.slice(0, nPast)) === JSON.stringify(pb.days) && pa.p.start === pb.start, `[F15] change goal after the exam: date clamps to tomorrow ${ae.d}, update keeps all ${nPast} old days + adds ${pa.p.days.length - nPast}`);
    ok(errs.length === 0, `[F] 0 console / page errors ${errs.join(' | ')}`);
    await ctx.close();

    // F16 zh-HK: the whole schedule / change goal / reset text
    const c2 = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    const p2 = await c2.newPage(); const e2s = watch(p2);
    await p2.clock.setFixedTime(NOW);
    await p2.goto(s.base); await p2.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); localStorage.setItem('lifeuk.uiLang', '"zh-HK"'); });
    await p2.goto(s.base + '?preview=plan'); await settle(p2, 300);
    await p2.click('#planCard .plan-cta'); await settle(p2, 150); await p2.click('#planCreateBtn'); await settle(p2, 300);
    const z = await p2.evaluate(() => ({ t: byId('screenPlanSchedule').innerText, edit: document.querySelector('[data-action="planEditGoal"]').textContent, reset: document.querySelector('[data-action="planAskReset"]').textContent, week: document.querySelector('.plan-week').textContent }));
    ok(z.edit === '改目標' && /重設/.test(z.reset) && /進度表|溫習/.test(z.t), `[F16] zh-HK schedule: "${z.edit}", "${z.reset}", week "${z.week}"`);
    await p2.screenshot({ path: path.join(SHOTS, 'F-375-zh-schedule.png'), fullPage: true });
    // language switch on the schedule keeps the list position
    await p2.$eval('#planDayList', e => e.scrollTo({ top: 400, behavior: 'instant' })); await settle(p2, 300);
    const topB = await p2.$eval('#planDayList', e => e.scrollTop);
    await p2.click('#langBtn'); await settle(p2, 300);
    const topA = await p2.evaluate(() => ({ top: byId('planDayList').scrollTop, scr: document.querySelector('.screen.active').id, edit: document.querySelector('[data-action="planEditGoal"]').textContent }));
    ok(topA.scr === 'screenPlanSchedule' && Math.abs(topA.top - topB) <= 2 && topA.edit === 'Change goal', `[F16] zh-HK → en on the schedule: re-rendered in place, list scrollTop ${topB} → ${topA.top}`);
    await p2.click('#langBtn'); await settle(p2, 300);
    await p2.click('[data-action="planEditGoal"]'); await settle(p2, 200);
    const zg = await p2.evaluate(() => ({ step: byId('planGoalStep').textContent, note: byId('planDateNote').textContent, cta: byId('planCreateBtn').textContent }));
    await p2.click('#screenPlanGoal .back-btn'); await settle(p2, 150);
    await p2.click('#planCard [data-action="openPlanSchedule"]'); await settle(p2, 200);
    await p2.click('[data-action="planAskReset"]'); await settle(p2, 200);
    const zm = await p2.evaluate(() => ({ t: byId('confirmTitle').textContent, m: byId('confirmMsg').textContent, ok: byId('confirmOk').textContent, c: byId('confirmCancel').textContent }));
    await p2.screenshot({ path: path.join(SHOTS, 'F-375-zh-reset-modal.png') });
    await p2.click('#confirmOk'); await settle(p2, 250);
    const zt = await toastState(p2);
    ok(zm.ok === '確定' && zm.c === '取消' && /重設溫習計劃/.test(zm.t) && zt.shown && /已重設/.test(zt.text), `[F16] zh-HK modal "${zm.t}" 「${zm.ok}」/「${zm.c}」, toast "${zt.text}"; edit "${zg.step}" / "${zg.cta}" / "${zg.note}"`);
    ok(e2s.length === 0, `[F16] 0 errors ${e2s.join(' | ')}`);
    await c2.close();

    // F17 touch: tap Schedule / Change goal / Reset on a phone
    const c3 = await b.newContext({ viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const p3 = await c3.newPage(); const e3s = watch(p3);
    await p3.clock.setFixedTime(NOW);
    await p3.goto(s.base); await p3.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); });
    await p3.goto(s.base + '?preview=plan'); await settle(p3, 300);
    await p3.tap('#planCard .plan-cta'); await settle(p3, 200); await p3.tap('#planCreateBtn'); await settle(p3, 300);
    await p3.tap('#screenPlanSchedule .back-btn'); await settle(p3, 150);
    await p3.tap('#planCard [data-action="openPlanSchedule"]'); await settle(p3, 250);
    await p3.tap('[data-action="planEditGoal"]'); await settle(p3, 250);
    await p3.fill('#planExamDate', '2026-10-09'); await p3.dispatchEvent('#planExamDate', 'blur'); await settle(p3, 120);
    await p3.tap('#planRestChips [data-arg="5"]'); await settle(p3, 100);
    const t3 = await p3.evaluate(() => ({ d: planGoalDraft.examDate, r: planGoalDraft.restDays, study: byId('planFeasDays').textContent }));
    await p3.tap('#planCreateBtn'); await settle(p3, 300);
    const t3b = await p3.evaluate(() => ({ scr: document.querySelector('.screen.active').id, n: planLoad().days.length }));
    await p3.tap('[data-action="planAskReset"]'); await settle(p3, 250); await p3.tap('#confirmOk'); await settle(p3, 250);
    const t3c = await p3.evaluate(() => ({ scr: document.querySelector('.screen.active').id, p: localStorage.getItem('lifeuk.studyPlan') }));
    ok(t3.d === '2026-10-09' && t3.r.includes(5) && t3.study === '1' && t3b.scr === 'screenPlanSchedule' && t3b.n === 1 && t3c.scr === 'screenHome' && t3c.p === null, `[F17] touch: picker tomorrow + tap Fri rest (first tap counts) → 1 day plan, tap reset → Home ${JSON.stringify([t3, t3b, t3c])}`);
    ok(e3s.length === 0, `[F17] 0 errors ${e3s.join(' | ')}`);
    await c3.close();
  } finally { s.server.kill(); }
}

// ── E: QA edge cases ──
async function partE(b) {
  const s = await startPagesServer(ROOT);
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    await ctx.addInitScript(INIT);
    const pg = await ctx.newPage(); const errs = watch(pg);
    await pg.clock.setFixedTime(NOW);
    await pg.goto(s.base); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); });
    await pg.goto(s.base + '?preview=plan'); await settle(pg, 300);
    await pg.click('#planCard .plan-cta'); await pg.click('#planCreateBtn'); await settle(pg, 300);
    // E1 Esc on the reset modal = cancel; focus returns to the reset button
    await pg.click('[data-action="planAskReset"]'); await settle(pg, 200); await pg.keyboard.press('Escape'); await settle(pg, 150);
    const e1 = await pg.evaluate(() => ({ modal: isConfirmOpen(), plan: !!localStorage.getItem('lifeuk.studyPlan'), focus: document.activeElement.dataset.action || document.activeElement.id }));
    ok(!e1.modal && e1.plan, `[E1] Esc on the reset modal cancels, plan kept; focus → ${e1.focus}`);
    if (e1.focus !== 'planAskReset') note(`after closing the reset modal focus goes to "${e1.focus}", not the ↺ Reset button`);
    // E2 Enter on the focused Cancel = cancel (keyboard default is Cancel)
    await pg.focus('[data-action="planAskReset"]'); await pg.keyboard.press('Enter'); await settle(pg, 200); await pg.keyboard.press('Enter'); await settle(pg, 150);
    ok(await pg.evaluate(() => !isConfirmOpen() && !!localStorage.getItem('lifeuk.studyPlan')), '[E2] keyboard Enter → modal; Enter again hits Cancel (focused), plan kept');
    // E3 double click Confirm → one removal pair, one toast
    await pg.evaluate(() => { window.__w = []; });
    await pg.click('[data-action="planAskReset"]'); await settle(pg, 200); await pg.dblclick('#confirmOk'); await settle(pg, 250);
    const e3 = await pg.evaluate(() => window.__w.map(x => x[0] + ':' + x[1]));
    ok(JSON.stringify(e3) === JSON.stringify(['rm:lifeuk.studyPlan', 'rm:lifeuk.studyPlanProgress']) && await screen(pg) === 'screenHome', `[E3] double-click Confirm: removes once ${e3.join(', ')}`);
    // E4 plan deleted in another tab while the schedule is open → Change goal / open go Home, no error
    await pg.click('#planCard .plan-cta'); await pg.click('#planCreateBtn'); await settle(pg, 300);
    await pg.evaluate(() => localStorage.removeItem('lifeuk.studyPlan'));
    await pg.click('[data-action="planEditGoal"]'); await settle(pg, 200);
    const e4 = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, card: !!document.querySelector('#planCard .plan-cta') }));
    ok(e4.scr === 'screenHome' && e4.card, `[E4] plan removed elsewhere: Change goal → Home create card ${JSON.stringify(e4)}`);
    // E5 deleted while the change-goal form is open, G36-only goal (tomorrow) → form switches to create mode
    await pg.click('#planCard .plan-cta'); await pg.click('#planCreateBtn'); await settle(pg, 300);
    await pg.click('[data-action="planEditGoal"]'); await settle(pg, 200);
    await typeDate(pg, '2026-10-09');
    await pg.evaluate(() => localStorage.removeItem('lifeuk.studyPlan'));
    await pg.click('#planCreateBtn'); await settle(pg, 250);
    const e5 = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, cta: byId('planCreateBtn').textContent, min: byId('planExamDate').min, d: planGoalDraft.examDate, plan: localStorage.getItem('lifeuk.studyPlan') }));
    ok(e5.scr === 'screenPlanGoal' && e5.cta === 'Build my plan →' && e5.min === '2026-10-15' && e5.d === '2026-10-15' && e5.plan === null, `[E5] deleted meanwhile + tomorrow: form turns into create mode, date clamps to +7, nothing written ${JSON.stringify(e5)}`);
    const e5b = await pg.evaluate(() => ({ cta: byId('planCreateBtn').disabled, hint: byId('planGoalHint').hidden ? '' : byId('planGoalHint').textContent }));
    ok(e5b.cta && /7 study days/.test(e5b.hint), `[E5] +7 with Sunday rest = 6 study days → G28 disabled + create hint "${e5b.hint}" (user sees why)`);
    await pg.click('#planDaysChips .chip >> nth=0'); await pg.click('#planCreateBtn'); await settle(pg, 250);
    ok(await screen(pg) === 'screenPlanSchedule', '[E5] pick 2 weeks → builds a new plan');
    // E6 switch off while on the change-goal form → Home; on again → no stale edit mode on create
    await pg.click('[data-action="planEditGoal"]'); await settle(pg, 200);
    await pg.click('#infoBtn'); await pg.click('#planFeatureSwitch'); await settle(pg, 200); await pg.click('#confirmOk'); await settle(pg, 250);
    const e6 = await screen(pg);
    await pg.click('#planFeatureSwitch'); await settle(pg, 200); await pg.keyboard.press('Escape');
    await pg.evaluate(() => localStorage.removeItem('lifeuk.studyPlan')); await pg.reload(); await settle(pg, 300);
    await pg.click('#planCard .plan-cta'); await settle(pg, 200);
    const e6b = await pg.evaluate(() => ({ cta: byId('planCreateBtn').textContent, min: byId('planExamDate').min }));
    ok(e6 === 'screenHome' && e6b.cta === 'Build my plan →' && e6b.min === '2026-10-15', `[E6] switch off on change goal → Home (G15); later create is create mode ${JSON.stringify(e6b)}`);
    // E7 midnight on the change-goal form: min moves to the new tomorrow
    await pg.click('#planCreateBtn'); await settle(pg, 250);
    await pg.click('[data-action="planEditGoal"]'); await settle(pg, 200);
    await typeDate(pg, '2026-10-09');
    await pg.clock.setFixedTime(at('2026-10-09')); await pg.click('#planMinsTicks', { force: true }).catch(() => {}); await pg.click('#planRestChips [data-arg="3"]'); await settle(pg, 100);
    const e7 = await pg.evaluate(() => ({ d: planGoalDraft.examDate, min: byId('planExamDate').min }));
    ok(e7.min === '2026-10-10' && e7.d === '2026-10-10', `[E7] past midnight the edit draft clamps to the new tomorrow (S-111) ${JSON.stringify(e7)}`);
    await pg.click('#screenPlanGoal .back-btn');
    // E8 clock moved before Day 1 → schedule renders, nothing past, no error
    await pg.clock.setFixedTime(at('2026-10-01')); await pg.reload(); await settle(pg, 300);
    await pg.click('#planCard [data-action="openPlanSchedule"]'); await settle(pg, 250);
    const e8 = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, past: document.querySelectorAll('.plan-day.past').length, today: document.querySelectorAll('.plan-day.today').length, top: byId('planDayList').scrollTop, card: byId('planCard') && byId('planCard').innerText.replace(/\s+/g, ' ') }));
    ok(e8.scr === 'screenPlanSchedule' && e8.past === 0 && e8.today === 0 && e8.top === 0, `[E8] device clock before Day 1: schedule opens at the top, no past / today ${JSON.stringify(e8)}`);
    // E9 tab order: Home → Change goal → list region → Reset reachable by keyboard
    await pg.clock.setFixedTime(NOW); await pg.reload(); await settle(pg, 300);
    await pg.click('#planCard [data-action="openPlanSchedule"]'); await settle(pg, 250);
    const order = [];
    await pg.focus('#screenPlanSchedule .back-btn');
    for (let i = 0; i < 4; i++) { order.push(await pg.evaluate(() => document.activeElement.dataset.action || document.activeElement.id)); await pg.keyboard.press('Tab'); }
    ok(JSON.stringify(order) === JSON.stringify(['goHome', 'planEditGoal', 'planDayList', 'planAskReset']), `[E9] keyboard Tab order ${order.join(' → ')}`);
    await pg.focus('#planDayList'); const t0 = await pg.$eval('#planDayList', e => e.scrollTop); await pg.keyboard.press('PageDown'); await settle(pg, 600);
    ok((await pg.$eval('#planDayList', e => e.scrollTop)) > t0, '[E9] focused day list scrolls with PageDown');
    ok(errs.length === 0, `[E] 0 console / page errors ${errs.join(' | ')}`);
    await ctx.close();
  } finally { s.server.kill(); }
}

// ── P: performance with the longest plan ──
async function partP(b) {
  const s = await startPagesServer(ROOT);
  try {
    for (const rate of [1, 4]) {
      const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
      const pg = await ctx.newPage(); const errs = watch(pg);
      await pg.clock.setFixedTime(NOW);
      await pg.goto(s.base); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); });
      await pg.goto(s.base + '?preview=plan'); await settle(pg, 300);
      await pg.click('#planCard .plan-cta'); await settle(pg, 150);
      await typeDate(pg, '2027-04-08');
      await pg.click('#planRestChips [data-arg="0"]'); await settle(pg, 80); // no rest days: every day a study day
      await pg.click('#planCreateBtn'); await settle(pg, 400);
      const n = await pg.evaluate(() => planLoad().days.length);
      // 90 days pass with a log on each (seeded: the runner that writes it is PR6)
      await pg.evaluate(() => { const plan = planLoad(); const days = {}; plan.days.slice(0, 90).forEach((d, i) => { const q = d.tasks.flatMap(planTaskQids); days[d.date] = { ok: Object.fromEntries(q.slice(0, Math.round(q.length * (i % 5) / 4)).map(k => [k, 1])) }; }); writePlanLog({ v: 1, days }); });
      await pg.clock.setFixedTime(at(addDays(TODAY, 90))); await pg.reload(); await settle(pg, 400);
      const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await pg.evaluate(() => { window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(Math.round(e.duration)))).observe({ type: 'longtask' });
        document.addEventListener('click', () => { window.__t0 = performance.now(); }, true); });
      const measure = () => pg.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(Math.round(performance.now() - window.__t0))))));
      // baseline: the same language round trip on Home (existing screen) and on the Study screen (236 fact cards)
      const trip = async () => { const r = []; for (let i = 0; i < 4; i++) { await pg.click('#langBtn'); r.push(await measure()); await settle(pg, 250); } return r; };
      const homeTrip = await trip();
      await pg.click('#modeStudy').catch(() => {}); await settle(pg, 300);
      const studyTrip = (await screen(pg)) === 'screenStudy' ? await trip() : [];
      await pg.evaluate(() => leaveToHome()); await settle(pg, 200);
      await pg.click('#planCard [data-action="openPlanSchedule"]'); const open = await measure();
      const rows = await pg.evaluate(() => document.querySelectorAll('#planDayList .plan-day').length);
      const L = await listState(pg);
      await pg.click('#langBtn'); const lang1 = await measure(); await settle(pg, 200);
      await pg.click('#langBtn'); const lang2 = await measure(); await settle(pg, 200);
      const schedTrip = [lang1, lang2, ...(await trip()).slice(0, 2)];
      note(`P CPU ×${rate}: language click → painted (4 switches, ms): Home ${homeTrip.join(' / ')}; Study ${studyTrip.join(' / ') || 'n/a'}; schedule (183 rows) ${schedTrip.join(' / ')}`);
      const lt = await pg.evaluate(() => window.__lt);
      const bytes = await pg.evaluate(() => (localStorage.getItem('lifeuk.studyPlan') || '').length + (localStorage.getItem('lifeuk.studyPlanProgress') || '').length);
      await pg.screenshot({ path: path.join(SHOTS, `P-375-en-183-day-cpu${rate}.png`) });
      const lim = rate === 1 ? 200 : 600;
      ok(n === 182 && rows === 183 && L.inView, `[P] CPU ×${rate}: ${n}-day plan + exam row (${rows} rows), opens at Day 91 in view; plan + log ${bytes} chars`);
      const homeMax = Math.max(...homeTrip);
      ok(open < lim, `[P] CPU ×${rate}: click → painted: open schedule ${open} ms (< ${lim})`);
            // ×1 is asserted; ×4 is a stress figure only (reported as an observation, see the report O-1)
      const langLim = 200;
      (rate === 1 ? ok : (c, m) => note('[P ×4, not asserted] ' + m))(Math.max(...schedTrip) < langLim, `[P] CPU ×${rate}: language switch on the 183-day schedule ${schedTrip.join(' / ')} ms (< ${langLim}) vs Home ${homeTrip.join(' / ')} ms (max ${homeMax}); long tasks ${lt.join(', ') || 'none'}`);
      ok(errs.length === 0, `[P] CPU ×${rate}: 0 errors ${errs.join(' | ')}`);
      await ctx.close();
    }
  } finally { s.server.kill(); }
}

// ── L: layout at 360 / 375 / 400 × en / zh-HK ──
const COLLOQUIAL = /[唔嘅咗嚟睇喺冇啲咁仲揀攞諗嘢係佢哋噉囉喎啱晒俾畀嗰呢乜㗎嘞咩]/;
async function partL(b) {
  const s = await startPagesServer(ROOT);
  try {
    for (const w of [360, 375, 400]) for (const lang of ['en', 'zh-HK']) {
      const ctx = await b.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
      const pg = await ctx.newPage(); const errs = watch(pg);
      await pg.clock.setFixedTime(NOW);
      await pg.goto(s.base); await pg.evaluate(l => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); }, lang);
      await pg.goto(s.base + '?preview=plan'); await settle(pg, 300);
      const tag = `${w}-${lang}`; const texts = [];
      const hscroll = () => pg.evaluate(() => Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, ...[...document.querySelectorAll('#screenPlanSchedule *')].filter(e => e.getClientRects().length).map(e => Math.round(e.getBoundingClientRect().right - innerWidth))));
      await pg.tap('#planCard .plan-cta'); await settle(pg, 200); await pg.tap('#planCreateBtn'); await settle(pg, 300);
      // a few days in, so past rows show
      await pg.clock.setFixedTime(at('2026-10-13')); await pg.reload(); await settle(pg, 300);
      const homeCard = await pg.evaluate(() => { const e = document.querySelector('#planCard [data-action="openPlanSchedule"]'); const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
      texts.push(await pg.$eval('#planCard', e => e.innerText));
      await pg.screenshot({ path: path.join(SHOTS, `L-${tag}-home-plan-card.png`) });
      await pg.tap('#planCard [data-action="openPlanSchedule"]'); await settle(pg, 350);
      const h1 = await hscroll();
      texts.push(await pg.$eval('#screenPlanSchedule', e => e.innerText));
      await pg.screenshot({ path: path.join(SHOTS, `L-${tag}-schedule.png`) });
      await pg.screenshot({ path: path.join(SHOTS, `L-${tag}-schedule-full.png`), fullPage: true });
      const hit = await pg.evaluate(() => ['#screenPlanSchedule .back-btn', '[data-action="planEditGoal"]', '[data-action="planAskReset"]'].map(sel => { const e = document.querySelector(sel); e.scrollIntoView({ block: 'center' });
        const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; const hitAt = y => { const h = document.elementFromPoint(cx, y); return !!h && (h === e || e.contains(h)); };
        return { sel, w: Math.round(r.width), h: Math.round(r.height), hit44: hitAt(cy - 21) && hitAt(cy + 21) }; }));
      const wrapped = await pg.evaluate(() => { const hd = document.querySelector('#screenPlanSchedule .quiz-header'); const kids = [...hd.children].map(c => Math.round(c.getBoundingClientRect().top)); return { tops: kids, lbl: hd.querySelector('.quiz-label').getBoundingClientRect().height }; });
      await pg.evaluate(() => scrollTo(0, 0));
      await pg.tap('[data-action="planEditGoal"]'); await settle(pg, 250);
      const h2 = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      texts.push(await pg.$eval('#screenPlanGoal', e => e.innerText));
      await pg.fill('#planExamDate', '2026-10-14'); await pg.dispatchEvent('#planExamDate', 'blur'); await settle(pg, 120);
      await pg.tap('#planRestChips [data-arg="2"]'); await settle(pg, 100); // today rest → 0 days → edit hint
      texts.push(await pg.$eval('#screenPlanGoal', e => e.innerText));
      await pg.screenshot({ path: path.join(SHOTS, `L-${tag}-change-goal-hint.png`), fullPage: true });
      await pg.tap('#planRestChips [data-arg="2"]'); await settle(pg, 100);
      texts.push(await pg.$eval('#screenPlanGoal', e => e.innerText));
      const cta = await pg.$eval('#planCreateBtn', e => Math.round(e.getBoundingClientRect().height));
      await pg.tap('#screenPlanGoal .back-btn'); await settle(pg, 150);
      await pg.tap('#planCard [data-action="openPlanSchedule"]'); await settle(pg, 300);
      await pg.tap('[data-action="planAskReset"]'); await settle(pg, 300);
      texts.push(await pg.$eval('#confirmModal', e => e.innerText));
      const modalFits = await pg.evaluate(() => { const r = document.querySelector('#confirmModal .modal, #confirmModal > *').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; });
      await pg.screenshot({ path: path.join(SHOTS, `L-${tag}-reset-modal.png`) });
      await pg.tap('#confirmOk'); await settle(pg, 300);
      texts.push(await pg.$eval('#appToast', e => e.textContent));
      const toastFits = await pg.evaluate(() => { const r = byId('appToast').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.height > 0; });
      await pg.screenshot({ path: path.join(SHOTS, `L-${tag}-reset-toast.png`) });
      ok(Math.max(h1, h2) <= 0, `[L] ${tag}: no horizontal overflow (schedule ${h1}, change goal ${h2})`);
      // .back-btn is the shared header component at its app-wide size (Quiz / Study / goal screen measure the same; PR3 L)
      ok(hit.filter(x => !/back-btn/.test(x.sel)).every(x => x.hit44) && homeCard.h >= 44 && cta >= 44, `[L] ${tag}: tap areas ≥ 44px: ${hit.map(x => x.sel.replace(/.*action="|"]|#screenPlanSchedule /g, '') + ' ' + x.w + '×' + x.h + (x.hit44 ? '✓' : '✗')).join(', ')}; Home Schedule ${homeCard.w}×${homeCard.h}; CTA ${cta}`);
      ok(modalFits && toastFits, `[L] ${tag}: reset modal + toast inside the viewport`);
      if (Math.max(...wrapped.tops) - Math.min(...wrapped.tops) > 20) note(`${tag}: schedule header items not on one line (tops ${wrapped.tops})`);
      if (lang === 'zh-HK') {
        const all = texts.join('\n'); const hits = [...new Set((all.match(new RegExp(COLLOQUIAL.source, 'g')) || []))];
        ok(hits.length === 0, `[L] ${tag}: plan UI text has no colloquial characters ${hits.join('')}`);
        const half = all.match(/[一-鿿][,!?:;()]|[,!?:;()][一-鿿]/g);
        ok(!half, `[L] ${tag}: full-width punctuation next to Chinese ${half ? half.join(' ') : ''}`);
        if (w === 375) fs.writeFileSync(path.join(SHOTS, 'L-375-zh-HK-texts.txt'), all);
      }
      ok(errs.length === 0, `[L] ${tag}: 0 errors ${errs.join(' | ')}`);
      await ctx.close();
    }
    // mockup step ② + reset modal at 375
    const ctx = await b.newContext({ viewport: { width: 375, height: 800 }, deviceScaleFactor: 2 });
    const pg = await ctx.newPage();
    await pg.goto('file://' + path.join(ROOT, 'mockups', 'study-plan-flow.html')); await settle(pg, 400);
    await pg.evaluate(() => goto(2)); await settle(pg, 400);
    await pg.screenshot({ path: path.join(SHOTS, 'M-375-mockup-step2.png') });
    await pg.screenshot({ path: path.join(SHOTS, 'M-375-mockup-step2-full.png'), fullPage: true });
    await pg.click('#step2 [data-plan="reset"]').catch(() => {}); await settle(pg, 400);
    await pg.screenshot({ path: path.join(SHOTS, 'M-375-mockup-reset-modal.png') });
    await ctx.close();
  } finally { s.server.kill(); }
}

// ── U: upgrade from v1.0.1 and PR3 SW + mixed load ──
const NEWFILES = ['js/screens/planSchedule.js', 'css/screens/plan.css', 'js/screens/planGoal.js', 'js/screens/planHome.js', 'js/core/actions.js', 'locales/en.js'];
async function upgradeFrom(b, ref, label) {
  const dir = path.join(WORK, 'pr4-up-' + label); archive(ref, dir);
  const { base, server } = await startPagesServer(dir);
  const CACHE = 'lifeuk-v1.0.1';
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 } });
    const pg = await ctx.newPage(); const errs = watch(pg);
    await pg.clock.setFixedTime(NOW);
    await pg.goto(base); await pg.evaluate(() => navigator.serviceWorker.ready);
    await pg.evaluate(async c => { for (let i = 0; i < 75; i++) { if ((await caches.keys()).includes(c)) return; await new Promise(r => setTimeout(r, 200)); } }, CACHE);
    await pg.reload(); await pg.waitForFunction(() => !!navigator.serviceWorker.controller);
    await pg.evaluate(() => localStorage.setItem('lifeuk.wrongList', '{"1.0":true}'));
    let oldPlan = null;
    if (label === 'pr3') { // build a plan on the PR3 app first (create card → Build → Home card)
      await pg.goto(base + '?preview=plan'); await settle(pg, 400);
      await pg.click('#planCard .plan-cta'); await settle(pg, 200); await pg.click('#planCreateBtn'); await settle(pg, 300);
      oldPlan = await ls(pg, 'lifeuk.studyPlan');
    }
    const old = await pg.evaluate(() => ({ sched: typeof openPlanSchedule, goal: typeof openPlanGoal }));
    ok(old.sched === 'undefined' && (label === 'pr3' ? old.goal === 'function' && !!oldPlan : old.goal === 'undefined'), `[U-${label}] base SW controlling (${ref}), no planSchedule ${JSON.stringify(old)}${oldPlan ? ' + plan built on PR3' : ''}`);
    fs.readdirSync(dir).forEach(f => fs.rmSync(path.join(dir, f), { recursive: true, force: true }));
    appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true }));
    const up = await pg.evaluate(async ({ NEWFILES, CACHE }) => { const reg = await navigator.serviceWorker.getRegistration();
      for (let i = 0; i < 100; i++) { const ch = await caches.open(CACHE); const have = await Promise.all(NEWFILES.map(p => ch.match(new URL(p, location.href).href)));
        const idx = await ch.match(new URL('index.html', location.href).href); const idxTxt = idx ? await idx.text() : '';
        const js = have[1] && await (await ch.match(new URL('js/screens/planGoal.js', location.href).href)).text();
        if (have.every(Boolean) && /screenPlanSchedule/.test(idxTxt) && /openPlanSchedule/.test(js || '') && !reg.installing && !reg.waiting) return { ok: true, keys: (await caches.keys()).filter(k => k.startsWith('lifeuk')) };
        if (!reg.installing && !reg.waiting) await reg.update().catch(() => {}); await new Promise(r => setTimeout(r, 200)); } return { ok: false }; }, { NEWFILES, CACHE });
    ok(up.ok && up.keys.length === 1, `[U-${label}] new SW refilled ${CACHE}: planSchedule.js + new planGoal / plan.css / index.html (screenPlanSchedule) ${JSON.stringify(up)}`);
    await pg.goto(base); await settle(pg, 500);
    const after = await pg.evaluate(() => ({ sched: typeof openPlanSchedule, wrong: localStorage.getItem('lifeuk.wrongList'), card: byId('planCard') ? byId('planCard').innerText.replace(/\s+/g, ' ') : null, plan: localStorage.getItem('lifeuk.studyPlan') }));
    if (label === 'pr3') {
      ok(after.sched === 'function' && after.wrong === '{"1.0":true}' && after.plan === oldPlan && /Day 1 \/ 21/.test(after.card || '') && /Schedule/.test(after.card || ''), `[U-${label}] reload: PR4 code, PR3 plan kept, Home card with Schedule "${after.card}"`);
      await pg.click('#planCard [data-action="openPlanSchedule"]'); await settle(pg, 300);
      ok(await screen(pg) === 'screenPlanSchedule' && await pg.evaluate(() => document.querySelectorAll('#planDayList .plan-day').length) === 22, '[U-pr3] the plan built on PR3 opens in the new schedule (21 days + exam)');
      await pg.click('#screenPlanSchedule .back-btn');
    } else {
      ok(after.sched === 'function' && after.wrong === '{"1.0":true}' && after.card === null && after.plan === null, `[U-${label}] reload: PR4 code, entry hidden, data kept ${JSON.stringify(after)}`);
      await pg.goto(base + '?preview=plan'); await settle(pg, 400);
      await pg.click('#planCard .plan-cta'); await settle(pg, 200); await pg.click('#planCreateBtn'); await settle(pg, 300);
      ok(await screen(pg) === 'screenPlanSchedule', `[U-${label}] upgraded: ?preview=plan → create → schedule`);
      await pg.click('#screenPlanSchedule .back-btn');
    }
    // offline
    await ctx.setOffline(true);
    await pg.reload(); await settle(pg, 500);
    await pg.click('#planCard [data-action="openPlanSchedule"]'); await settle(pg, 300);
    const off = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, sticky: getComputedStyle(document.querySelector('.plan-week')).position, bar: document.querySelectorAll('#planPhaseBar > div').length }));
    await pg.click('[data-action="planEditGoal"]'); await settle(pg, 200); await pg.click('#planDaysChips .chip >> nth=2'); await pg.click('#planCreateBtn'); await settle(pg, 300);
    const offEd = await pg.evaluate(() => planLoad().goal.examDate);
    await pg.click('[data-action="planAskReset"]'); await settle(pg, 200); await pg.click('#confirmOk'); await settle(pg, 300);
    const offR = await pg.evaluate(() => ({ p: localStorage.getItem('lifeuk.studyPlan'), card: !!document.querySelector('#planCard .plan-cta') }));
    ok(off.scr === 'screenPlanSchedule' && off.sticky === 'sticky' && off.bar === 3 && offEd === '2026-11-05' && offR.p === null && offR.card, `[U-${label}] offline: schedule styled (plan.css from cache), change goal → ${offEd}, reset → create card`);
    await ctx.setOffline(false);
    ok(errs.length === 0, `[U-${label}] 0 console / page errors ${errs.join(' | ')}`);
    await ctx.close();
  } finally { server.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
}
async function mixed(b, ref, label) {
  const mix = path.join(WORK, 'pr4-mixed-' + label); fs.rmSync(mix, { recursive: true, force: true }); fs.mkdirSync(mix, { recursive: true });
  appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(mix, f), { recursive: true }));
  fs.writeFileSync(path.join(mix, 'index.html'), execSync(`git show ${ref}:index.html`, { cwd: ROOT }));
  const s2 = await startPagesServer(mix);
  try {
    for (const withPlan of [false, true]) {
      const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
      const pg = await ctx.newPage(); const errs = watch(pg);
      await pg.clock.setFixedTime(NOW);
      await pg.goto(s2.base); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); localStorage.setItem('lifeuk.studyPlanPreview', 'true'); });
      if (withPlan) await pg.evaluate(() => { localStorage.setItem('lifeuk.studyPlan', JSON.stringify(buildPlan({ examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' }, '2026-10-08'))); localStorage.setItem('lifeuk.studyPlanProgress', '{"v":1,"days":{}}'); });
      await pg.goto(s2.base); await settle(pg, 600);
      const r = await pg.evaluate(() => ({ fns: [typeof openPlanSchedule, typeof openPlanGoal, typeof renderPlanCard].join(','), card: !!byId('planCard'), grid: document.querySelectorAll('#examGrid button').length }));
      await pg.click('#infoBtn'); await settle(pg); const row = await pg.evaluate(() => byId('infoPlanRow') ? byId('infoPlanRow').hidden : 'none'); await pg.keyboard.press('Escape');
      await pg.click('#langBtn'); await settle(pg, 300); await pg.click('#langBtn'); await settle(pg, 300);
      await pg.click('#modePractice'); await examTab(pg); await pg.click('#examGrid [data-action="startExam"][data-arg="2"]'); await settle(pg, 200);
      const a = await pg.evaluate(() => state.questions[state.current].a); for (const oi of a) await pg.click('#opt' + oi); await settle(pg, 150);
      const quizOk = (await screen(pg)) === 'screenQuiz';
      const logW = withPlan ? await pg.evaluate(() => localStorage.getItem('lifeuk.studyPlanProgress')) : null;
      ok(r.fns === 'function,function,function' && !r.card && r.grid > 0 && quizOk && errs.length === 0, `[U-mixed-${label}${withPlan ? '+plan' : ''}] old ${label} index.html + PR4 js (preview on): late boot loads planSchedule, no plan card (planShellReady), ⓘ row ${row}, language + Practice answer OK, 0 errors ${JSON.stringify(r)} ${errs.join(' | ')}`);
      if (withPlan) ok(!/^\{bad/.test(logW || '') && (() => { try { JSON.parse(logW); return true; } catch { return false; } })(), `[U-mixed-${label}+plan] stored plan log still valid JSON after a Practice answer on the old shell`);
      await ctx.close();
    }
  } finally { s2.server.kill(); fs.rmSync(mix, { recursive: true, force: true }); }
}
async function partU(b) {
  await upgradeFrom(b, V101, 'v101');
  await upgradeFrom(b, BASE, 'pr3');
  await mixed(b, V101, 'v101');
  await mixed(b, BASE, 'pr3');
}

(async () => {
  fs.mkdirSync(WORK, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch(launchOpts);
  const only = process.env.QA_ONLY || 'HFEPLU';
  for (const [k, fn] of [['H', partH], ['F', partF], ['E', partE], ['P', partP], ['L', partL], ['U', partU]]) {
    if (!only.includes(k)) continue;
    try { await fn(b); } catch (e) { fail++; console.log(`FAIL: part ${k} exception`, e.stack); }
  }
  await b.close();
  console.log('\nnotes:\n- ' + notes.join('\n- '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
