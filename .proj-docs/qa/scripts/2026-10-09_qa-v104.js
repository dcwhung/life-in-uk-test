// QA v1.0.4 — schedule fold cards, Plan Day hint / rest day / month nav, old cached v1.0.3 shell, regressions.
// usage: NODE_PATH=/opt/node-tools/node_modules node 2026-10-09_qa-v104.js <new-root> <old-shell-root> <shot-dir>
//   <old-shell-root>: a copy of <new-root> whose index.html is the v1.0.3 one (origin/main)
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const [ROOT, OLDSHELL, OUT] = process.argv.slice(2);
const NOW = new Date('2026-10-08T09:00:00'); // Thu
const SPAN = { goal: { examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' }, start: '2026-09-28' }; // Sep–Oct
const LANGS = ['en', 'zh-HK'];
const WIDTHS = [320, 390, 600];
const SEEN = 'lifeuk.studyPlanScheduleSeen';
let pass = 0, fail = 0; const fails = [];
const ck = (c, m) => { if (c) pass++; else { fail++; fails.push(m); console.log('FAIL:', m); } };
const url = (root, q = '?preview=plan') => 'file://' + path.resolve(root, 'index.html') + q;
async function fresh(pg, root = ROOT, q) { await pg.goto(url(root, q)); await pg.evaluate(() => localStorage.clear()); await pg.goto(url(root, q)); }
const seedSpan = pg => pg.evaluate(({ goal, start }) => {
  clearStudyPlan(); const plan = buildPlan(goal, start); writeStudyPlan(plan);
  const qidsOf = d => d.tasks.flatMap(planTaskQids), ok = l => Object.fromEntries(l.map(k => [k, 1]));
  writePlanLog({ v: 1, days: { [plan.days[1].date]: { ok: ok(qidsOf(plan.days[1])) } } });
}, SPAN);
const createToday = (pg, goal) => pg.evaluate(g => { clearStudyPlan(); writeStudyPlan(buildPlan(g, planTodayIso())); }, goal);
const active = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
const noHScroll = pg => pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const shot = async (pg, name, sel) => { const p = path.join(OUT, name + '.png'); const e = sel && await pg.$(sel); if (e) await e.screenshot({ path: p }); else await pg.screenshot({ path: p }); };
const foldState = pg => pg.evaluate(() => {
  const vis = e => !!e && e.getClientRects().length > 0 && !e.closest('[hidden]');
  const pb = byId('planPhasesToggle'), ob = byId('planOrderToggle');
  const segs = [...document.querySelectorAll('#planPhaseBar > div')].map(d => ({ days: vis(d.querySelector('.plan-ph-days')), range: vis(d.querySelector('.plan-ph-range')), rangeTxt: d.querySelector('.plan-ph-range').textContent,
    clip: [...d.querySelectorAll('span')].some(s => vis(s) && s.scrollWidth > s.clientWidth + 0.5) }));
  const mini = [...document.querySelectorAll('#planOrderMini li')].map(li => ({ label: li.querySelector('.plan-ord-mini-name').textContent, sr: li.querySelector('.plan-sr').textContent,
    clip: li.querySelector('.plan-ord-mini-name').scrollWidth > li.querySelector('.plan-ord-mini-name').clientWidth + 0.5 || li.querySelector('.plan-ord-mini-name').getBoundingClientRect().right > li.closest('ol').getBoundingClientRect().right + 0.5 }));
  return { pExp: pb.getAttribute('aria-expanded'), oExp: ob.getAttribute('aria-expanded'), strat: vis(byId('planStrategy')), orderBody: vis(byId('planOrderBody')), mini: vis(byId('planOrderMini')),
    barAria: byId('planPhaseBar').getAttribute('aria-hidden'), segs, miniItems: mini, seen: localStorage.getItem('lifeuk.studyPlanScheduleSeen'),
    pColl: pb.closest('.plan-fold').classList.contains('collapsed'), oColl: ob.closest('.plan-fold').classList.contains('collapsed') };
});
const reopen = pg => pg.evaluate(() => { leaveToHome(); openPlanSchedule(); });

async function foldFlow(pg) {
  for (const lang of LANGS) {
    await fresh(pg); await pg.evaluate(l => setLang(l), lang);
    await pg.setViewportSize({ width: 390, height: 844 });
    // create via the goal screen (real flow)
    await pg.evaluate(() => { leaveToHome(); openPlanGoal(); });
    await pg.click('#planCreateBtn');
    let s = await foldState(pg);
    ck(s.pExp === 'true' && s.oExp === 'true' && s.strat && s.orderBody && !s.mini && s.barAria === 'true', `${lang} first open after create: both expanded ${JSON.stringify(s).slice(0, 160)}`);
    ck(s.segs.every(x => x.days && !x.range), `${lang} expanded: phase bar shows n days`);
    ck(!!s.seen, `${lang} seen marker written ${s.seen}`);
    await reopen(pg);
    s = await foldState(pg);
    ck(s.pExp === 'false' && s.oExp === 'false' && !s.strat && !s.orderBody && s.mini && s.barAria === null && s.pColl && s.oColl, `${lang} second open: both collapsed`);
    ck(s.segs.length === 3 && s.segs.every(x => !x.days && x.range && /^Day \d+(–\d+)?$/.test(x.rangeTxt)), `${lang} collapsed bar: Day x–y ${s.segs.map(x => x.rangeTxt)}`);
    ck(JSON.stringify(s.miniItems.map(m => m.label)) === JSON.stringify(['Ch 1 + 2', 'Ch 5', 'Ch 4', 'Ch 3']), `${lang} stepper labels ${s.miniItems.map(m => m.label)}`);
    ck(s.miniItems.every(m => /^Ch \d/.test(m.sr) && m.sr.length > 6), `${lang} stepper sr names full`);
    // the phase ranges agree with the strategy card's Day ranges
    const rng = await pg.evaluate(() => [...document.querySelectorAll('#planStrategy .plan-strat-days')].map(e => e.textContent));
    ck(JSON.stringify(rng) === JSON.stringify(s.segs.map(x => x.rangeTxt)), `${lang} collapsed ranges = strategy ranges ${rng}`);
    // toggle by clicking the title text (not the chevron); Enter on the other
    await pg.click('#planPhasesToggle span[data-i18n]');
    await pg.focus('#planOrderToggle'); await pg.keyboard.press('Enter');
    s = await foldState(pg);
    ck(s.pExp === 'true' && s.strat && s.oExp === 'true' && s.orderBody && !s.mini, `${lang} title click / Enter expand`);
    await pg.keyboard.press('Space');
    s = await foldState(pg);
    ck(s.oExp === 'false' && s.mini, `${lang} Space collapses order`);
    // language switch keeps this visit's state
    await pg.click('#langBtn');
    s = await foldState(pg);
    ck(s.pExp === 'true' && s.oExp === 'false' && s.mini, `${lang} lang switch keeps fold state`);
    await pg.click('#langBtn');
    // tap area ≥ 44px tall on the toggle
    const hit = await pg.evaluate(() => { const b = byId('planOrderToggle'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(), cx = r.left + 30, cy = r.top + r.height / 2;
      const at = d => { const e = document.elementFromPoint(cx, cy + d); return !!e && (e === b || b.contains(e)); }; return at(-21) && at(21); });
    ck(hit, `${lang} fold toggle ≥44px tap`);
    // toggles not saved: reopen → collapsed again
    await reopen(pg);
    s = await foldState(pg);
    ck(s.pExp === 'false' && s.oExp === 'false', `${lang} reopen after toggling: collapsed (not saved)`);
    // change goal → first open expanded, then collapsed
    await pg.click('#screenPlanSchedule [data-action="planEditGoal"]');
    await pg.click('#planDaysChips .chip >> nth=2');
    await pg.waitForTimeout(400);
    await pg.click('#planCreateBtn');
    s = await foldState(pg);
    ck(s.pExp === 'true' && s.oExp === 'true', `${lang} first open after change goal: expanded`);
    await reopen(pg);
    ck((await foldState(pg)).pExp === 'false', `${lang} after change goal, next open collapsed`);
    // change goal page opened then abandoned (← back) → still collapsed
    await pg.click('#screenPlanSchedule [data-action="planEditGoal"]');
    await pg.evaluate(() => openPlanSchedule());
    ck((await foldState(pg)).pExp === 'false', `${lang} change goal abandoned: still collapsed`);
    // reset clears the marker; a new plan opens expanded
    await pg.waitForTimeout(400);
    await pg.click('#screenPlanSchedule .plan-reset .reset-btn'); await pg.click('#confirmOk');
    ck(await pg.evaluate(k => localStorage.getItem(k), SEEN) === null, `${lang} reset clears seen marker`);
    await pg.click('#planCard .plan-cta'); await pg.waitForTimeout(400); await pg.click('#planCreateBtn');
    s = await foldState(pg);
    ck(s.pExp === 'true' && s.oExp === 'true', `${lang} new plan after reset (same day): expanded`);
    // a second "create" while a plan exists (no reset): Home create card isn't shown, so use the goal screen directly
    await pg.evaluate(() => { openPlanGoal(); });
    await pg.click('#planCreateBtn');
    s = await foldState(pg);
    ck(s.pExp === 'true', `${lang} re-create over an existing plan: expanded`);
  }
}

async function foldLayout(pg) {
  await fresh(pg); await seedSpan(pg);
  for (const lang of LANGS) for (const w of WIDTHS) {
    await pg.setViewportSize({ width: w, height: 900 });
    await pg.evaluate(l => { setLang(l); localStorage.setItem('lifeuk.studyPlanScheduleSeen', JSON.stringify(planIdentity(readStudyPlan()))); openPlanSchedule(); }, lang);
    const s = await foldState(pg);
    ck(s.pExp === 'false', `${lang} ${w} collapsed (seen)`);
    await pg.waitForTimeout(300); // chevron rotate transition (0.2s)
    ck(s.segs.every(x => !x.clip) && s.miniItems.every(m => !m.clip), `${lang} ${w} collapsed labels in full`);
    const geo = await pg.evaluate(() => {
      const lis = [...document.querySelectorAll('#planOrderMini li')], dots = lis.map(li => li.querySelector('.plan-ord-n').getBoundingClientRect());
      const line = getComputedStyle(lis[1], '::before');
      const tops = new Set(dots.map(d => Math.round(d.top))).size;
      const ttl = byId('planOrderToggle').getBoundingClientRect(), chev = byId('planOrderToggle').querySelector('.plan-fold-chev').getBoundingClientRect();
      return { tops, lineTop: parseFloat(line.top), lineH: parseFloat(line.height), dotH: dots[0].height, chevIn: chev.right <= ttl.right + 0.5 };
    });
    ck(geo.tops === 1 && Math.abs(geo.lineTop + geo.lineH / 2 - geo.dotH / 2) <= 0.5 && geo.chevIn, `${lang} ${w} stepper dots on one row, line through centres ${JSON.stringify(geo)}`);
    ck(await noHScroll(pg), `${lang} ${w} collapsed: no horizontal scroll`);
    await shot(pg, `sched-collapsed-${lang}-${w}`);
    await pg.evaluate(() => { planToggleFold('phases'); planToggleFold('order'); });
    ck(await noHScroll(pg), `${lang} ${w} expanded: no horizontal scroll`);
    if (w === 390) await shot(pg, `sched-expanded-${lang}-${w}`);
  }
}

async function dayChecks(pg) {
  // hint justified; month nav for a two-month plan; rest day view
  await fresh(pg); await seedSpan(pg);
  for (const lang of LANGS) for (const w of WIDTHS) {
    await pg.setViewportSize({ width: w, height: 900 });
    await pg.evaluate(l => { setLang(l); openPlanDay(); }, lang);
    const h = await pg.evaluate(() => {
      const hint = byId('planDayHint'), info = byId('planDayInfo'), cs = getComputedStyle(hint);
      const pill = byId('planDayPhase').getBoundingClientRect(), cnt = byId('planDayCount').getBoundingClientRect(), I = info.getBoundingClientRect(), H = hint.getBoundingClientRect();
      const mid = r => r.left + r.width / 2;
      return { align: cs.textAlign, last: cs.textAlignLast, full: Math.abs(H.width - I.width) <= 1, stacked: getComputedStyle(byId('planDayHead')).gridTemplateColumns.split(' ').length === 1,
        pillMid: Math.abs(mid(pill) - mid(I)) <= 1, cntMid: Math.abs(mid(cnt) - mid(I)) <= 1, pillLeft: Math.abs(pill.left - I.left) <= 1, nav: !byId('planCalBtns').hidden && byId('planCalBtns').getClientRects().length > 0 };
    });
    ck(h.align === 'justify' && h.last === 'left' && h.full, `${lang} ${w} day hint justified, last line left, full column ${JSON.stringify(h)}`);
    ck(h.stacked ? h.pillMid && h.cntMid : h.pillLeft, `${lang} ${w} pill/count ${h.stacked ? 'centred (stacked)' : 'left (side by side)'}`);
    ck(h.nav, `${lang} ${w} month nav shown (plan spans Sep–Oct)`);
    ck(await noHScroll(pg), `${lang} ${w} day: no horizontal scroll`);
    await shot(pg, `day-today-${lang}-${w}`, '#screenPlanDay .plan-card-box');
    // rest day (Sun 2026-10-11)
    await pg.evaluate(() => openPlanDay('2026-10-11'));
    const r = await pg.evaluate(() => {
      const vis = e => !!e && e.getClientRects().length > 0;
      const em = byId('planRestEmoji'), pill = byId('planDayPhase'), back = byId('planBackToday'), cnt = byId('planDayCount');
      const E = em.getBoundingClientRect(), P = pill.getBoundingClientRect(), B = back.getBoundingClientRect();
      const cs = getComputedStyle(cnt);
      return { ring: vis(byId('planRing')), emoji: vis(em), emojiAria: em.getAttribute('aria-hidden'), pill: pill.textContent, pillVis: vis(pill), back: vis(back), hint: vis(byId('planDayHint')),
        cntSr: cnt.classList.contains('plan-sr') && cnt.getBoundingClientRect().width <= 1 && cs.position === 'absolute', cntText: cnt.textContent,
        stacked: getComputedStyle(byId('planDayHead')).gridTemplateColumns.split(' ').length === 1, gapEP: P.top - E.bottom, gapPB: B.top - P.bottom, emojiH: E.height };
    });
    ck(!r.ring && r.emoji && r.emojiAria === 'true', `${lang} ${w} rest: 😴 instead of ring`);
    ck(r.cntSr && /Rest day|休息/.test(r.cntText), `${lang} ${w} rest: count line visually hidden, text "${r.cntText}"`);
    ck(r.pillVis && r.back && !r.hint, `${lang} ${w} rest: pill "${r.pill}" + Back to today kept, hint hidden`);
    if (r.stacked) ck(r.gapPB > r.gapEP && r.gapEP >= 0, `${lang} ${w} rest: emoji→pill gap ${r.gapEP.toFixed(0)} < pill→button ${r.gapPB.toFixed(0)}`);
    else ck(r.gapPB > 0, `${lang} ${w} rest (side by side): pill→button gap ${r.gapPB.toFixed(0)}`);
    ck(await noHScroll(pg), `${lang} ${w} rest day: no horizontal scroll`);
    await shot(pg, `day-rest-${lang}-${w}`, '#screenPlanDay .plan-card-box');
    // back to a study day restores the ring
    await pg.click('#planBackToday');
    ck(await pg.evaluate(() => byId('planRing').getClientRects().length > 0 && byId('planRestEmoji').hidden && !byId('planDayCount').classList.contains('plan-sr')), `${lang} ${w} back to today: ring back, count visible`);
  }
  // one-month plan: nav hidden; two-month: shown; focus hand-off
  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.evaluate(() => setLang('en'));
  await createToday(pg, { examDate: '2026-10-29', dailyMins: 60, restDays: [], level: 'some' });
  await pg.evaluate(() => openPlanDay());
  ck(await pg.evaluate(() => byId('planCalBtns').hidden && byId('planCalBtns').getClientRects().length === 0), 'one-month plan (Oct 8–29): month nav hidden');
  await shot(pg, 'day-calendar-onemonth-en-390', '#planCalTitle');
  await createToday(pg, { examDate: '2026-11-12', dailyMins: 60, restDays: [], level: 'some' });
  await pg.evaluate(() => openPlanDay());
  ck(await pg.evaluate(() => !byId('planCalBtns').hidden), 'two-month plan from today (Oct–Nov): month nav shown');
  await pg.click('#planCalNext');
  ck(await pg.evaluate(() => byId('planCalTitle').textContent.includes('Nov')), 'month nav › goes to November');
  await pg.click('#planCalToday');
  ck(await pg.evaluate(() => byId('planCalTitle').textContent.includes('Oct')), 'Today returns to October');
  await pg.focus('#planCalNext');
  await pg.evaluate(() => { writeStudyPlan(buildPlan({ examDate: '2026-10-29', dailyMins: 60, restDays: [], level: 'some' }, planTodayIso())); renderPlanDay(); });
  const f = await pg.evaluate(() => ({ hidden: byId('planCalBtns').hidden, focus: document.activeElement.id }));
  ck(f.hidden && f.focus === 'planDayHeading', `S-128: focused month button hidden → focus on day heading ${JSON.stringify(f)}`);
  // exam in the first days of the next month: still spans two months → shown
  await createToday(pg, { examDate: '2026-11-01', dailyMins: 60, restDays: [], level: 'some' });
  await pg.evaluate(() => openPlanDay());
  ck(await pg.evaluate(() => !byId('planCalBtns').hidden), 'plan Oct 8 → exam Nov 1: month nav shown');
}

async function oldShell(b) {
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.clock.setFixedTime(NOW);
  await fresh(pg, OLDSHELL);
  await seedSpan(pg);
  const r = { };
  await pg.evaluate(() => openPlanSchedule());
  r.sched = await active(pg);
  r.rows = await pg.evaluate(() => document.querySelectorAll('#planDayList .plan-day').length);
  r.strat = await pg.evaluate(() => byId('planStrategy').getClientRects().length > 0 && byId('planOrder').children.length);
  await reopen(pg);
  r.strat2 = await pg.evaluate(() => byId('planStrategy').getClientRects().length > 0);
  await pg.evaluate(() => openPlanDay());
  r.day = await active(pg);
  r.ring = await pg.evaluate(() => byId('planRing').getClientRects().length > 0);
  await pg.evaluate(() => openPlanDay('2026-10-11'));
  r.restCount = await pg.evaluate(() => ({ txt: byId('planDayCount').textContent, vis: byId('planDayCount').getClientRects().length > 0, ring: byId('planRing').getClientRects().length > 0 }));
  await pg.evaluate(() => planShiftMonth(-1));
  r.cal = await pg.evaluate(() => byId('planCalTitle').textContent);
  await pg.evaluate(() => { setLang('zh-HK'); openPlanSchedule(); setLang('en'); });
  await pg.close();
  ck(r.sched === 'screenPlanSchedule' && r.rows > 20 && r.strat, 'old v1.0.3 shell: schedule renders (expanded cards)' + JSON.stringify(r));
  ck(r.strat2, 'old shell: reopen keeps cards expanded (no toggles)');
  ck(r.day === 'screenPlanDay' && r.ring, 'old shell: day screen with ring');
  ck(r.restCount.vis && r.restCount.ring, 'old shell: rest day keeps ring + visible count');
  ck(/Sep|Oct/.test(r.cal), 'old shell: month nav works ' + r.cal);
  ck(errs.length === 0, 'old shell: no page errors ' + errs.join(' | '));
}

async function regressions(pg) {
  await fresh(pg); await seedSpan(pg);
  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.evaluate(() => { setLang('en'); openPlanSchedule(); });
  // schedule day row → day; PR5 ‹ › navigation
  const iso = await pg.evaluate(() => { const r = document.querySelector('#planDayList .plan-day:not(.past):not(.today):not(.rest):not(.exam)'); r.scrollIntoView({ block: 'center' }); return r.dataset.arg; });
  await pg.click(`#planDayList .plan-day[data-arg="${iso}"]`);
  ck(await active(pg) === 'screenPlanDay' && await pg.evaluate(() => planDayView) === iso, 'schedule row → day screen ' + iso);
  await pg.click('#planDayPrev');
  ck(await pg.evaluate(() => planDayView === null || planDayView === '2026-10-08'), 'PR5 ‹ from Oct 9 → today');
  await pg.click('#planDayNext');
  ck(await pg.evaluate(() => planDayView) === '2026-10-09', 'PR5 › → Oct 9');
  await pg.click('#planBackToday');
  ck(await pg.evaluate(() => planDayView) === null, 'Back to today');
  // PR6a runner: today's first runnable task
  await pg.waitForTimeout(400);
  const btn = await pg.evaluate(() => { const b = [...document.querySelectorAll('#screenPlanDay .plan-task-btn')].find(e => !e.disabled); return b ? b.outerHTML.slice(0, 160) : null; });
  ck(!!btn, 'day screen: a runnable task button ' + btn);
  if (btn) {
    const logBefore = await pg.evaluate(() => localStorage.getItem(STUDY_PLAN_PROGRESS_LS));
    await pg.click('#screenPlanDay .plan-task-btn:not([disabled]) >> nth=0');
    ck(await active(pg) === 'screenQuiz', 'runner opens on the Practice screen');
    await pg.waitForTimeout(400);
    await pg.click('#opt0');
    const logAfter = await pg.evaluate(() => localStorage.getItem(STUDY_PLAN_PROGRESS_LS));
    ck(logAfter !== logBefore, 'runner: answering records in the plan log');
    await pg.evaluate(() => openPlanDay());
    ck(await active(pg) === 'screenPlanDay', 'back to the day screen');
  }
  // home tiles / resets
  await pg.evaluate(() => { localStorage.setItem('lifeuk.wrongList', JSON.stringify({ '1.1': true, '1.2': true })); localStorage.setItem('lifeuk.practiceFlags', JSON.stringify({ '1.3': true })); });
  await pg.reload();
  await pg.evaluate(() => { leaveToHome(); startMode('practice'); });
  await pg.click('#tileFlagged');
  ck(await active(pg) === 'screenFlagged', 'flagged tile → flagged screen');
  await pg.evaluate(() => leaveToHome());
  await pg.waitForTimeout(400);
  await pg.click('#tileWrong');
  ck(await active(pg) === 'screenQuiz', 'wrong tile → quiz');
  await pg.evaluate(() => { leaveToHome(); startMode('practice'); });
  await pg.waitForTimeout(400);
  await pg.click('#practiceReset .reset-btn');
  ck(await pg.evaluate(() => isConfirmOpen()), 'practice reset → confirm modal'); await pg.click('#confirmCancel');
  await pg.evaluate(() => startMode('exam'));
  await pg.click('#examReset .reset-btn');
  ck(await pg.evaluate(() => isConfirmOpen()), 'exam reset → confirm modal'); await pg.click('#confirmCancel');
  ck(await pg.evaluate(() => APP_VERSION === '1.0.4' && byId('appVersion').textContent.includes('1.0.4')), 'APP_VERSION 1.0.4 shown');
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.clock.setFixedTime(NOW);
  for (const f of [foldFlow, foldLayout, dayChecks, regressions]) { console.log('==', f.name); await f(pg); }
  console.log('== oldShell'); await oldShell(b);
  ck(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
  console.log(`\nRESULT ${pass} pass / ${fail} fail`); if (fails.length) console.log(fails.join('\n'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
