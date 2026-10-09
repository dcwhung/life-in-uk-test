const { chromium } = require('playwright-core');
const path = require('path');
// Study plan PR6a (T-329–T-334; handoff §2.5, arch §E.1 / §E.4, grill G2–G5 / G8 / G9 / G17 / G23 / G26):
// the runner for question tasks (practise / drill / clear wrong answers). It is the Practice screen itself
// (screenQuiz: dots, card, options, answer box, Prev / Next); a task box (or Home "Continue") opens it.
// - rounds of ≤ 24 (PRACTICE_ROUND_MAX), "Round n of N"; Next without answering moves on, the question comes back
// - wrong answers count for nothing: after the other questions they come back ("🔁 Redo wrong answers (n left)")
//   the same day until right
// - G5 / G8 / G23: a past day's task (catch-up) and a day ahead's (early) count for that day; today's % unchanged
// - G9 / W-030: clear wrong answers asks the snapshot; a right answer clears every copy from the wrong list
// - G26: the Similar panel shows, without "Practise these N"
// - Result card (#screenPlanRun, .result-card classes): today's %, summary, "Review this task" / "Start next →";
//   all done 🎉; G17 review mode: correct answers + "✗ You got this wrong", nothing written to storage
// - ← in the runner goes back to the day; double tap guard; 44px; contrast; 360 / 375 / 400 × en / zh-HK
// The entry stays hidden (STUDY_PLAN_READY = false) unless ?preview=plan (G31).
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const TODAY = '2026-10-01';
const START = '2026-09-28'; // Day 4 = TODAY (learn Ch 4); Days 1–3 left undone → carry-over
const DRILL_TODAY = '2026-10-06'; // with START: a drill day (drill Ch 1 / 2 / 5 + wrong facts)
const at = (iso, time = '09:00:00') => new Date(`${iso}T${time}`);
const GOAL = { examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' };
const DUP_COPY_KEY = '4.14'; // the same English question as 3.12 (plan-hook-test W-030)
const DUP_CANON_KEY = '3.12';
const WIDTHS = [360, 375, 400];
const HIT_MIN_PX = 44;
const MIN_CONTRAST = 4.5;

const activeScreen = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
const text = (pg, sel) => pg.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
const visible = (pg, sel) => pg.evaluate(sel => { const e = document.querySelector(sel); return !!e && e.getClientRects().length > 0; }, sel);
const storage = pg => pg.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
async function fresh(pg, now = at(TODAY), query = '?preview=plan') {
  await pg.clock.setFixedTime(now);
  await pg.goto(APP_URL + query);
  await pg.evaluate(() => localStorage.clear());
  await pg.goto(APP_URL + query);
}
// a plan built on start; ok: { iso: [qid…] } answered right; wrong: keys put in the wrong list first
async function seed(pg, { start = TODAY, ok = {}, wrong = [] } = {}) {
  await pg.evaluate(({ goal, start, ok, wrong }) => {
    wrong.forEach(k => addWrong(questionByKey(k)));
    writeStudyPlan(buildPlan(goal, start));
    const days = Object.fromEntries(Object.entries(ok).map(([iso, list]) => [iso, { ok: Object.fromEntries(list.map(k => [k, 1])) }]));
    writePlanLog({ v: 1, days });
  }, { goal: GOAL, start, ok, wrong });
}
const plan = pg => pg.evaluate(() => planLoad());
const dayLog = (pg, iso) => pg.evaluate(iso => planDayLog(planLoadLog(), iso), iso);
const openDay = (pg, iso = null) => pg.evaluate(iso => openPlanDay(iso), iso);
// CUI-0011: the clock is fixed, so event timeStamps do not move; a click that changed the view would make the next
// click near it (same view) a "stray" double tap for ever. Real taps are seconds apart: clear the guard between taps.
const tap = async (pg, sel) => { await pg.evaluate(() => { clickGuard = null; }); await pg.click(sel); };
const taskBox = (date, i) => `#planTaskList button[data-arg="${date}"][data-task="${i}"]`;
// answer the current question with real taps: right = every correct option; wrong = as many wrong options
async function answer(pg, right) {
  const picks = await pg.evaluate(right => {
    const q = state.questions[state.current];
    return right ? q.a : q.o.map((_, i) => i).filter(i => !q.a.includes(i)).slice(0, q.a.length);
  }, right);
  for (const i of picks) await tap(pg, `#opt${i}`);
}
const cur = pg => pg.evaluate(() => ({ key: qKey(state.questions[state.current]), idx: state.current, n: state.questions.length,
  note: byId('roundRow').hidden ? '' : byId('roundNote').textContent, next: byId('nextBtn').textContent, plan: isPlanSession() }));
// answer every question of the round in order (wrongKeys answered wrong, skipKeys left unanswered), then Next
async function playRound(pg, { wrongKeys = [], skipKeys = [] } = {}) {
  const seen = [];
  for (;;) {
    const c = await cur(pg);
    seen.push(c);
    if (!skipKeys.includes(c.key)) await answer(pg, !wrongKeys.includes(c.key));
    const last = await cur(pg);
    await tap(pg, '#nextBtn');
    if (last.idx === last.n - 1) return { seen, last };
  }
}
// tap area: points HIT_MIN_PX / 2 from the centre still land on the element
const hitOk = (pg, sel) => pg.evaluate(({ s, min }) => {
  const e = document.querySelector(s);
  e.scrollIntoView({ block: 'center' });
  const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, d = min / 2 - 1;
  const hit = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === e || e.contains(h)); };
  return hit(cx, cy - d) && hit(cx, cy + d) && hit(cx - d, cy) && hit(cx + d, cy);
}, { s: sel, min: HIT_MIN_PX });
const contrastOf = (pg, sel) => pg.evaluate(sel => {
  const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 3 || c[3] > 0) return c; } return [255, 255, 255]; };
  const opaque = el => { for (let e = el; e; e = e.parentElement) if (Number(getComputedStyle(e).opacity) < 1) return false; return true; };
  return [...document.querySelectorAll(sel)].filter(e => e.textContent.trim() && e.getClientRects().length).map(e => {
    const fg = rgb(getComputedStyle(e).color), bg = bgOf(e);
    const a = lum(fg.slice(0, 3)), b = lum(bg);
    return { text: e.textContent.trim().slice(0, 20), ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), opaque: opaque(e) };
  });
}, sel);
const taskIndexOf = (p, iso, pred) => p.days.find(d => d.date === iso).tasks.findIndex(pred);

async function checkHidden(pg) {
  await fresh(pg, at(TODAY), '');
  await seed(pg);
  await pg.evaluate(() => planOpenTask('2026-10-01', 1));
  assert(await activeScreen(pg) === 'screenHome', 'hidden: planOpenTask() stays on Home');
  assert(await pg.evaluate(() => PLAN_SCREEN_IDS.includes('screenPlanRun') && typeof SCREEN_RERENDER.screenPlanRun === 'function'),
    'W-031: the Result card screen is a plan screen; a language switch re-renders it');
}

// a task longer than one round: Round 1 of 2 (24), then the rest; a skipped question comes after the other new
// ones, a wrong one after those ("🔁 Redo wrong answers (n left)"); right answers only; then the Result card
async function checkRounds(pg) {
  await fresh(pg);
  await seed(pg);
  await openDay(pg);
  const p = await plan(pg);
  const i = taskIndexOf(p, TODAY, t => t.type === 'practice' && t.qids.length > 24 && t.qids.length <= 48);
  const qids = p.days[0].tasks[i].qids;
  assert(i >= 0, `today has a practice task of ${qids.length} questions (two rounds)`);
  assert(await hitOk(pg, taskBox(TODAY, i)), `task box: ${HIT_MIN_PX}px tap area`);
  await tap(pg, taskBox(TODAY, i));
  const head = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, label: byId('quizLabel').textContent,
    badge: byId('modeBadge').textContent, back: document.querySelector('#screenQuiz .back-btn').textContent, n: state.questions.length,
    dots: byId('navDots').children.length, planDay: state.planDay, timer: byId('examTimer').hidden }));
  const ch = p.days[0].tasks[i].ch;
  assert(head.screen === 'screenQuiz' && head.label === `Chapter ${ch}` && head.badge === 'Practice' && head.timer,
    `the Practice screen itself: "Chapter ${ch}" · Practice, no timer`);
  assert(head.back === "← Today's tasks" && head.n === 24 && head.dots === 24 && head.planDay === TODAY, 'round 1: 24 questions, 24 dots, ← Today\'s tasks, counts for today');
  assert((await cur(pg)).note === 'Round 1 of 2', 'round note: Round 1 of 2');
  const first = await cur(pg);
  const wrongKey = first.key;
  const skipKey = await pg.evaluate(() => qKey(state.questions[1]));
  // Q1 wrong: the answer box says so; the dot turns red; the Similar panel has no "Practise these N" (G26)
  await answer(pg, false);
  const box = await pg.evaluate(() => ({ label: byId('ansLabel').textContent, dot: byId('navDots').children[0].className,
    similar: byId('similarBox').classList.contains('show'), cta: !!byId('similarBox').querySelector('[data-action="startSimilarPractice"]'),
    has: similarKeys(state.questions[0]).length > 0 }));
  assert(box.label.startsWith('✗ Wrong') && box.dot.includes('bad'), 'a wrong answer: ✗ Wrong, red dot');
  assert(box.similar === box.has && !box.cta, `G26: the Similar panel shows (${box.has ? 'similar questions' : 'none for this one'}), without "Practise these N"`);
  let log = await dayLog(pg, TODAY);
  assert(log.bad[wrongKey] === 1 && !log.ok[wrongKey], 'a wrong answer only goes to bad (it counts for nothing)');
  await tap(pg, '#nextBtn');
  const r1 = await playRound(pg, { skipKeys: [skipKey] });
  assert(r1.last.next === 'Next round →', 'round 1 last question: "Next round →": ' + r1.last.next);
  const c2 = await cur(pg);
  assert(c2.plan && c2.n === qids.length - 24 + 2 && c2.note === 'Round 2 of 2', `round 2: the ${qids.length - 24} new ones, the skipped one, the wrong one (${c2.n}); Round 2 of 2`);
  const order = await pg.evaluate(() => state.questions.map(qKey));
  assert(order[order.length - 2] === skipKey && order[order.length - 1] === wrongKey, 'order: new questions, then the skipped one, then the wrong one');
  const r2 = await playRound(pg, { wrongKeys: [wrongKey] });
  const redo = r2.seen[r2.seen.length - 1];
  assert(redo.key === wrongKey && redo.note === '🔁 Redo the wrong answer (1 left)', 'a question answered wrong before: "🔁 Redo … (1 left)": ' + redo.note);
  assert(r2.last.next === '🔁 Redo the wrong answer (1 left)', 'wrong again: the last button redoes it the same day: ' + r2.last.next);
  const c3 = await cur(pg);
  assert(c3.n === 1 && c3.key === wrongKey, 'redo round: only the wrong one');
  await answer(pg, true);
  assert((await cur(pg)).next === 'Finish ✓', 'all right: "Finish ✓"');
  log = await dayLog(pg, TODAY);
  assert(qids.every(k => log.ok[k]), 'every question of the task is right for today');
  await tap(pg, '#nextBtn');
  return { i, qids };
}

// the Result card after a task: today's %, summary (k redone), pair note (G3), next task, review / start next
async function checkResultCard(pg, { i, qids }) {
  assert(await activeScreen(pg) === 'screenPlanRun', 'finish → the Result card');
  const r = await pg.evaluate(() => ({ emoji: document.querySelector('#planRunBody .result-emoji').textContent,
    score: document.querySelector('#planRunBody .result-score').textContent, label: document.querySelector('#planRunBody .result-label').textContent,
    sub: document.querySelector('#planRunBody .result-sub').textContent, note: (document.querySelector('#planRunBody .plan-note') || { textContent: '' }).textContent,
    next: (document.querySelector('#planRunBody .plan-run-next') || { textContent: '' }).textContent,
    acts: [...document.querySelectorAll('#planRunBody .nav-btn')].map(b => [b.textContent, b.dataset.action]),
    back: byId('planRunBack').textContent, head: byId('planRunLabel').textContent,
    want: planDayCompletion(planLoad().days[0], planDayLog(planLoadLog(), '2026-10-01')).pct, side: isSideSession() }));
  assert(r.emoji === '✅' && r.score === `${r.want}%` && r.label === "Task done · today's progress", `Result card: ✅ ${r.want}% · Task done · today's progress`);
  assert(r.sub === `All ${qids.length} questions right, 1 of them after a redo.`, 'summary: ' + r.sub);
  assert(/^The matching “Read Ch \d .+” now counts as read\.$/.test(r.note), 'G3: the matching reading task now counts as read: ' + r.note);
  assert(r.next.startsWith('Next') && r.acts[0][1] === 'planReviewTask' && r.acts[1][0] === 'Start next →', 'next task card + "Review this task" / "Start next →": ' + r.next);
  assert(r.back === "← Today's tasks" && !r.side, 'header ← Today\'s tasks; the side session has ended');
  for (const s of ['#planRunBack', '#planRunBody [data-action="planReviewTask"]', '#planRunBody [data-action="planOpenTask"]']) assert(await hitOk(pg, s), `${s}: ${HIT_MIN_PX}px`);
  const low = (await contrastOf(pg, '#screenPlanRun .result-label, #screenPlanRun .result-sub, #screenPlanRun .plan-note, #screenPlanRun .plan-muted, #screenPlanRun .section-title, #screenPlanRun b'))
    .filter(c => c.ratio < MIN_CONTRAST || !c.opaque);
  assert(low.length === 0, `Result card text ≥ ${MIN_CONTRAST}:1, no opacity: ` + JSON.stringify(low));
  // G17: review mode from the Result card
  const before = await storage(pg);
  await tap(pg, '#planRunBody [data-action="planReviewTask"]');
  await checkReviewMode(pg, qids, before);
  // back on the day screen, the box reads "✓ Review ›" and opens review mode again
  assert(await activeScreen(pg) === 'screenPlanDay', 'review: the last question\'s "Finish ✓" goes back to the day');
  assert(await text(pg, taskBox(TODAY, i) + ' .plan-task-go') === '✓ Review ›', 'the finished task box: ✓ Review ›');
  await tap(pg, taskBox(TODAY, i));
  assert(await pg.evaluate(() => isPlanReviewMode() && state.current === 0), 'a finished task box opens review mode');
  await tap(pg, '#screenQuiz .back-btn');
  assert(await activeScreen(pg) === 'screenPlanDay' && await pg.evaluate(() => !isSideSession()), '← Today\'s tasks goes back to the day');
  assert(await pg.evaluate(() => document.activeElement && document.activeElement.matches('button[data-action="planOpenTask"]')), 'focus goes back to the task box');
}
async function checkReviewMode(pg, qids, before) {
  const v = await pg.evaluate(() => ({ note: byId('planRunNote').hidden ? '' : byId('planRunNote').textContent, round: byId('roundRow').hidden,
    n: state.questions.length, revealed: Object.keys(state.revealed).length, opts: [...document.querySelectorAll('#optionsContainer .opt')].map(o => o.className),
    label: byId('ansLabel').textContent, yue: byId('yueToggle').classList.contains('visible'),
    labels: state.questions.map((q, i) => { state.current = i; renderQuestion(); return byId('ansLabel').textContent; }) }));
  assert(v.note === '✅ This task is done · reviewing it does not change your progress.' && v.round, 'review: the done note, no round note');
  assert(v.n === Math.min(24, qids.length) && v.revealed === v.n && !v.yue, 'review: every question answered + revealed, no Translate');
  assert(v.opts.some(c => c.includes('correct')) && !v.opts.some(c => c.includes('wrong')), 'review: the correct option marked, no wrong pick');
  assert(v.labels.filter(l => l === '✗ You got this wrong · correct answer').length === 1 && v.labels.filter(l => l === '✓ Correct answer').length === v.n - 1,
    'G17: "✗ You got this wrong" on the one answered wrong, "✓ Correct answer" on the others');
  await pg.evaluate(() => { state.current = 0; renderQuestion(); });
  await tap(pg, '#opt0');
  await tap(pg, '#opt1');
  for (let k = 0; k < 60; k++) {
    const c = await cur(pg);
    await tap(pg, '#nextBtn');
    if (c.idx === c.n - 1 && c.next === 'Finish ✓') break;
  }
  assert(await storage(pg) === before, 'G17: review mode writes nothing to storage (taps, Next, pages)');
}

// G8: a carry-over task counts for its own day; today's % stays; G5: a past day opened directly; G23: early
async function checkDays(pg) {
  await fresh(pg);
  await seed(pg, { start: START });
  await openDay(pg);
  const p = await plan(pg);
  const d3 = '2026-09-30', d5 = '2026-10-02';
  const i3 = taskIndexOf(p, d3, t => t.type === 'practice');
  const ring = await text(pg, '#planRingPct');
  assert(await text(pg, taskBox(d3, i3) + ' .plan-tag') === 'Day 3', 'carry-over box (Day 3) is a button');
  await tap(pg, taskBox(d3, i3));
  assert(await pg.evaluate(() => state.planDay) === d3 && (await cur(pg)).plan, 'G8: the carry-over runs for its own day');
  const k = (await cur(pg)).key;
  await answer(pg, true);
  assert((await dayLog(pg, d3)).ok[k] === 1 && !(await dayLog(pg, TODAY)).ok[k], 'G8: the answer is written to Day 3');
  await tap(pg, '#screenQuiz .back-btn');
  assert(await text(pg, '#planRingPct') === ring && await text(pg, '#planDayTitle') === "Today's tasks", `G8: today's % (${ring}) unchanged, back on today`);
  // G5: Day 2 opened with ‹ ‹: its own boxes, "← Day 2 tasks"
  await tap(pg, '#planDayPrev');
  await tap(pg, '#planDayPrev');
  const d2 = '2026-09-29', i2 = taskIndexOf(p, d2, t => t.type === 'practice');
  await tap(pg, taskBox(d2, i2));
  assert(await text(pg, '#screenQuiz .back-btn') === '← Day 2 tasks' && await pg.$eval('#screenQuiz .back-btn [lang="en"]', e => e.textContent) === 'Day 2',
    'a past day: "← Day 2 tasks" (Day 2 lang="en")');
  const k2 = (await cur(pg)).key;
  await answer(pg, true);
  assert((await dayLog(pg, d2)).ok[k2] === 1, 'G5: a past day\'s answer counts for that day (catch-up)');
  await tap(pg, '#screenQuiz .back-btn');
  assert(await text(pg, '#planDayTitle') === 'Day 2 tasks', '← goes back to Day 2');
  // G23: a day ahead: practice opens (early), clear wrong answers waits for its day
  await openDay(pg, d5);
  const i5 = taskIndexOf(p, d5, t => t.type === 'practice'), r5 = taskIndexOf(p, d5, t => t.type === 'review');
  assert(await visible(pg, taskBox(d5, i5)) && !(await visible(pg, taskBox(d5, r5))), 'G23: ahead: practice is a button, clear wrong answers is not');
  await tap(pg, taskBox(d5, i5));
  const k5 = (await cur(pg)).key;
  await answer(pg, true);
  assert((await dayLog(pg, d5)).ok[k5] === 1 && !(await dayLog(pg, TODAY)).ok[k5], 'G23: an early answer counts for that day');
  await pg.evaluate(() => leaveToHome());
}

// G9 / W-030: the snapshot is asked; a right answer clears every copy; wrong ones come back; empty = done
async function checkClearWrong(pg) {
  await fresh(pg);
  await seed(pg, { wrong: [DUP_COPY_KEY, DUP_CANON_KEY, '1.0'] });
  await openDay(pg);
  const p = await plan(pg);
  const ri = taskIndexOf(p, TODAY, t => t.type === 'review');
  const snap = p.days[0].tasks[ri].qids;
  assert(snap.length === 2 && snap.includes(DUP_CANON_KEY) && snap.includes('1.0'), 'G9: today\'s snapshot (canonical, no repeats): ' + snap);
  await tap(pg, taskBox(TODAY, ri));
  assert(await text(pg, '#quizLabel') === 'Wrong answers', 'clear wrong answers: "Wrong answers"');
  const r = await playRound(pg, { wrongKeys: ['1.0'] });
  const wl = await pg.evaluate(() => Object.keys(wrongList));
  assert(!wl.includes(DUP_COPY_KEY) && !wl.includes(DUP_CANON_KEY) && wl.includes('1.0'), 'W-030: right on 3.12 clears 3.12 and 4.14; 1.0 (wrong) stays: ' + wl);
  assert(r.last.next === '🔁 Redo the wrong answer (1 left)', 'the wrong one comes back: ' + r.last.next);
  await answer(pg, true);
  await tap(pg, '#nextBtn');
  assert(await activeScreen(pg) === 'screenPlanRun' && !(await pg.evaluate(() => wrongList['1.0'])), 'redone right: cleared, Result card');
  assert(await text(pg, '#planRunBody .result-sub') === 'All 2 questions right, 1 of them after a redo.',
    'summary counts the redone one: ' + await text(pg, '#planRunBody .result-sub'));
  // the next task is reading (PR6b): "Start next →" opens the day screen for now
  await tap(pg, '#planRunBody [data-action="planOpenTask"]');
  assert(await activeScreen(pg) === 'screenPlanDay', 'PR6b types: "Start next →" opens the day screen');
  // an empty wrong list: "✓ No wrong answers", not a button
  await fresh(pg);
  await seed(pg);
  await openDay(pg);
  const e = await pg.evaluate(() => [...document.querySelectorAll('#planTaskList .plan-task.review')].map(b => [b.tagName, b.querySelector('.plan-task-st').textContent]));
  assert(e.length === 1 && e[0][0] === 'LI' && e[0][1] === '✓ No wrong answers', 'empty wrong list: ✓ No wrong answers, not a button');
}

// Home "Continue" opens the next task; drill day: "Start next →" opens the next drill; all done 🎉
async function checkContinueAndAllDone(pg) {
  await fresh(pg, at(DRILL_TODAY));
  await seed(pg, { start: START });
  await pg.evaluate(() => leaveToHome());
  await tap(pg, '#planCard [data-action="planContinue"]');
  const p = await plan(pg);
  const day = p.days.find(d => d.date === DRILL_TODAY);
  assert(day.tasks[0].type === 'drill' && await pg.evaluate(() => isPlanSession() && sessionReturn.taskIndex === 0) && await text(pg, '#quizLabel') === `Chapter ${day.tasks[0].ch}`,
    'Home "Continue" opens today\'s first task (drill) in the runner');
  for (;;) { const c = await cur(pg); await answer(pg, true); await tap(pg, '#nextBtn'); if (c.idx === c.n - 1) break; }
  const next = await pg.$eval('#planRunBody [data-action="planOpenTask"]', b => [b.dataset.arg, b.dataset.task]);
  assert(next[0] === DRILL_TODAY && next[1] === '1', 'Result card: "Start next →" names the next drill');
  await tap(pg, '#planRunBody [data-action="planOpenTask"]');
  assert(await pg.evaluate(() => isPlanSession() && sessionReturn.taskIndex === 1), '"Start next →" opens it');
  // all done 🎉: a fresh plan whose today is all right except one small practice task
  await fresh(pg);
  await pg.evaluate(goal => writeStudyPlan(buildPlan(goal, '2026-10-01')), GOAL);
  const p2 = await plan(pg);
  const small = taskIndexOf(p2, TODAY, t => t.type === 'practice' && t.qids.length <= 24);
  const others = p2.days[0].tasks.filter((t, k) => k !== small && t.qids && t.type !== 'review').flatMap(t => t.qids);
  const mine = p2.days[0].tasks[small].qids;
  await pg.evaluate(({ ok }) => writePlanLog({ v: 1, days: { '2026-10-01': { ok: Object.fromEntries(ok.map(k => [k, 1])) } } }), { ok: others.filter(k => !mine.includes(k)) });
  await openDay(pg);
  await tap(pg, taskBox(TODAY, small));
  for (;;) { const c = await cur(pg); await answer(pg, true); await tap(pg, '#nextBtn'); if (c.idx === c.n - 1) break; }
  const r = await pg.evaluate(() => ({ emoji: document.querySelector('#planRunBody .result-emoji').textContent, score: document.querySelector('#planRunBody .result-score').textContent,
    label: document.querySelector('#planRunBody .result-label').className + '|' + document.querySelector('#planRunBody .result-label').textContent,
    sub: document.querySelector('#planRunBody .result-sub').textContent, acts: [...document.querySelectorAll('#planRunBody .nav-btn')].map(b => b.dataset.action) }));
  assert(r.emoji === '🎉' && r.score === '100%' && r.label === "result-label pass|All of today's tasks are done!", 'all done: 🎉 100% · All of today\'s tasks are done!');
  assert(r.sub === "Open the app tomorrow: Home shows the next day's tasks." && r.acts.join() === 'planReviewTask,planBackToDay', 'all done: tomorrow hint; "Review this task" / "Back to the task list"');
  await tap(pg, '#planRunBody [data-action="planBackToDay"]');
  assert(await activeScreen(pg) === 'screenPlanDay' && await visible(pg, '#planDayDone'), '"Back to the task list" → the day, done banner');
}

// CUI-0011: a double tap on the last question's Next starts the new round once (the second tap is not an answer)
async function checkDoubleTap(pg) {
  await fresh(pg);
  await seed(pg);
  await openDay(pg);
  const p = await plan(pg);
  const i = taskIndexOf(p, TODAY, t => t.type === 'practice' && t.qids.length <= 24);
  await tap(pg, taskBox(TODAY, i));
  await pg.evaluate(() => { state.current = state.questions.length - 1; renderQuestion(); });
  const before = await pg.evaluate(() => state.questions);
  await pg.evaluate(() => { clickGuard = null; });
  await pg.dblclick('#nextBtn');
  const after = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, current: state.current, revealed: Object.keys(state.revealed).length }));
  assert(after.screen === 'screenQuiz' && after.current === 0 && after.revealed === 0, 'double tap on "Next round →": one new round, nothing answered: ' + JSON.stringify(after));
  assert(before.length > 0, 'the round had questions');
}

// G15: switching the feature off in a plan task leaves it for Home
async function checkSwitchOff(pg) {
  await fresh(pg);
  await seed(pg);
  await openDay(pg);
  const p = await plan(pg);
  await tap(pg, taskBox(TODAY, taskIndexOf(p, TODAY, t => t.type === 'practice')));
  await pg.evaluate(() => { setStudyPlanEnabled(true); togglePlanFeature(); });
  await tap(pg, '#confirmOk');
  assert(await activeScreen(pg) === 'screenHome' && await pg.evaluate(() => !isSideSession()), 'G15: switch off in a plan task → Home, session left');
}

// G37: Ch 1 all mastered (🏆) → "Practise Ch 1" is done ("✓ Mastered"), "Read Ch 1" read, live (nothing written);
// its box opens review mode; a half-mastered task asks only the others; Home % agrees; no plan → no plan write
async function checkMastered(pg) {
  await fresh(pg);
  const before = await pg.evaluate(() => {
    const plan = buildPlan({ examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' }, '2026-10-01');
    const ch1 = plan.days[0].tasks.find(t => t.type === 'practice' && t.ch === 1).qids;
    streaks = Object.fromEntries(ch1.map(k => [k, MASTERY_STREAK]));
    setLS('practiceStreak', streaks);
    leaveToHome();
    const noPlan = JSON.stringify(Object.keys(localStorage).filter(k => k === 'lifeuk.studyPlan' || k === 'lifeuk.studyPlanProgress'));
    writeStudyPlan(plan);
    return noPlan;
  });
  assert(before === '[]', 'G37: mastered questions without a plan write no plan key');
  await openDay(pg);
  const p = await plan(pg);
  const pi = taskIndexOf(p, TODAY, t => t.type === 'practice' && t.ch === 1), ri = taskIndexOf(p, TODAY, t => t.type === 'read' && t.ch === 1);
  const n = p.days[0].tasks[pi].qids.length;
  const box = await pg.evaluate(([pi, ri]) => {
    const all = [...document.querySelectorAll('#planTaskList > li')];
    const of = i => (all[i].matches('.plan-task') ? all[i] : all[i].querySelector('.plan-task'));
    return { practice: [of(pi).className, of(pi).querySelector('.plan-task-st').textContent], read: [of(ri).className, of(ri).querySelector('.plan-task-st').textContent],
      log: localStorage.getItem('lifeuk.studyPlanProgress') };
  }, [pi, ri]);
  assert(box.practice[0].includes('done') && box.practice[1] === `✓ Mastered (${n} questions)`, `G37: Practise Ch 1 done: ${box.practice[1]}`);
  assert(box.read[0].includes('done') && box.read[1] === '✓ Practised its questions: counted as read', 'G37: Read Ch 1 counts as read (G3 / G4)');
  assert(box.log === null || !box.log.includes('mastered'), 'G37: live, nothing migrated into the log');
  await tap(pg, taskBox(TODAY, pi));
  assert(await pg.evaluate(() => isPlanReviewMode()), 'G37: an all-mastered task opens in review mode');
  // half of Ch 2 mastered: the runner asks only the rest
  await pg.evaluate(() => leaveToHome());
  const half = await pg.evaluate(() => {
    const t = planLoad().days[0].tasks.find(x => x.type === 'practice' && x.ch === 2);
    t.qids.slice(0, 5).forEach(k => { streaks[k] = MASTERY_STREAK; });
    return t.qids.slice(0, 5);
  });
  await openDay(pg);
  const p2 = taskIndexOf(p, TODAY, t => t.type === 'practice' && t.ch === 2);
  assert((await text(pg, taskBox(TODAY, p2) + ' .plan-task-st')).includes('🏆 5 mastered'), 'G37: partly mastered: "🏆 5 mastered"');
  await tap(pg, taskBox(TODAY, p2));
  assert(await pg.evaluate(half => state.questions.every(q => !half.includes(qKey(q))) && state.questions.length === planLoad().days[0].tasks.find(x => x.type === 'practice' && x.ch === 2).qids.length - 5, half),
    'G37: the runner asks only the questions not mastered');
  await pg.evaluate(() => leaveToHome());
  const home = await pg.evaluate(() => ({ card: byId('planCard').querySelector('.plan-home-pct').textContent,
    want: planDayCompletion(planLoad().days[0], planDayLog(planLoadLogView(), '2026-10-01')).pct }));
  assert(home.card === `${home.want}%` && home.want > 0, `G37: the Home card % (${home.card}) counts mastered questions too`);
}

async function checkLayout(b) {
  for (const lang of ['en', 'zh-HK']) {
    for (const w of WIDTHS) {
      const pg = await b.newPage({ viewport: { width: w, height: 760 } });
      await fresh(pg);
      await pg.evaluate(lang => setLang(lang), lang);
      await seed(pg, { wrong: ['1.0'] });
      await openDay(pg);
      const p = await plan(pg);
      const ri = taskIndexOf(p, TODAY, t => t.type === 'review');
      await tap(pg, taskBox(TODAY, ri));
      await answer(pg, false);
      await tap(pg, '#nextBtn');
      const quiz = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, next: byId('nextBtn').textContent }));
      assert(quiz.sw <= quiz.cw, `${lang} ${w}px: runner, no horizontal scroll (${quiz.next})`);
      assert(await hitOk(pg, '#screenQuiz .back-btn'), `${lang} ${w}px: runner ← ${HIT_MIN_PX}px`);
      await tap(pg, '#nextBtn');
      await answer(pg, true);
      await tap(pg, '#nextBtn');
      const card = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      assert(card.screen === 'screenPlanRun' && card.sw <= card.cw, `${lang} ${w}px: Result card, no horizontal scroll`);
      await pg.close();
    }
  }
}

async function main() {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && m.text().includes('[i18n]'))) errs.push(m.text()); });
  await checkHidden(pg);
  const run = await checkRounds(pg);
  await checkResultCard(pg, run);
  await checkDays(pg);
  await checkClearWrong(pg);
  await checkContinueAndAllDone(pg);
  await checkDoubleTap(pg);
  await checkSwitchOff(pg);
  await checkMastered(pg);
  await checkLayout(b);
  assert(errs.length === 0, 'no page errors / i18n warnings: ' + errs.join(' | '));
  await b.close();
}
main().then(() => console.log('PLAN-RUN PASS')).catch(e => { console.error(e.message); process.exit(1); });
