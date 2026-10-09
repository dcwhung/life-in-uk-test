const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
// Study plan PR6b (T-335–T-339; handoff §2.5, arch §E.2 / §E.3 / §E.5, grill G3 / G10 / G11 / G15 / G22 / G25 / G26 / G32):
// part two of the runner (part one: plan-run-test.js).
// - reading: #screenPlanRun = the Study fact card (factCardHtml, Study marks) + "Fact n of m" + Prev / Next; reading
//   itself counts for nothing (G3); the card's "▶ Practise" practises that fact for the plan day and comes back; the last
//   fact's button "Practise these n →" opens the paired practice task
// - facts behind wrong answers: the Similar panel (similarPanelHtml) per fact, the wrong answer as the current node; its
//   CTA practises that fact for the plan day; the last fact's button practises what is left of the task
// - mock exam: Exam mode itself (45-minute timer); the result page's #resultPlanRow: passed = "✓ Mock exam task done",
//   not passed = retake as a Random Exam (G11; Retry too: EXAM_MODE + ALL_EXAM whatever Home's mode); Leave / switch off
//   while timed = not submitted (G15); time up submits
// - every task type opens from its box, the Result card's "Start next →" and Home "Continue"
// The entry stays hidden (STUDY_PLAN_READY = false) unless ?preview=plan (G31).
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const SHOTS = process.env.PLAN_SHOTS || '';
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const TODAY = '2026-10-01';
const START = '2026-09-28';
const DRILL_TODAY = '2026-10-06'; // with START: a drill day (drill Ch 1 / 2 / 5 + wrong facts)
const at = (iso, time = '09:00:00') => new Date(`${iso}T${time}`);
const GOAL = { examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' };
const WRONG_KEYS = ['1.0', '2.3', '5.7'];
const WIDTHS = [360, 375, 400];
const HIT_MIN_PX = 44;
const MIN_CONTRAST = 4.5;
const EXAM_MS = 45 * 60 * 1000;

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
async function seed(pg, { start = TODAY, wrong = [] } = {}) {
  await pg.evaluate(({ goal, start, wrong }) => {
    wrong.forEach(k => addWrong(questionByKey(k)));
    writeStudyPlan(buildPlan(goal, start));
  }, { goal: GOAL, start, wrong });
}
const plan = pg => pg.evaluate(() => planLoad());
const dayLog = (pg, iso) => pg.evaluate(iso => planDayLog(planLoadLog(), iso), iso);
const openDay = (pg, iso = null) => pg.evaluate(iso => openPlanDay(iso), iso);
// CUI-0011: the clock is fixed, so clear the double-tap guard between real taps
const tap = async (pg, sel) => { await pg.evaluate(() => { clickGuard = null; }); await pg.click(sel); };
const taskBox = (date, i) => `#planTaskList button[data-arg="${date}"][data-task="${i}"]`;
const taskIndexOf = (p, iso, pred) => p.days.find(d => d.date === iso).tasks.findIndex(pred);
async function answer(pg, right) {
  const picks = await pg.evaluate(right => {
    const q = state.questions[state.current];
    return right ? q.a : q.o.map((_, i) => i).filter(i => !q.a.includes(i)).slice(0, q.a.length);
  }, right);
  for (const i of picks) await tap(pg, `#opt${i}`);
}
// answer the whole session right with real taps, then the last button
async function playAllRight(pg) {
  for (let k = 0; k < 60; k++) {
    const c = await pg.evaluate(() => ({ idx: state.current, n: state.questions.length }));
    await answer(pg, true);
    await tap(pg, '#nextBtn');
    if (c.idx === c.n - 1) return;
  }
}
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
  return [...document.querySelectorAll(sel)].filter(e => e.textContent.trim() && e.getClientRects().length).map(e => {
    const fg = rgb(getComputedStyle(e).color), bg = bgOf(e);
    const a = lum(fg.slice(0, 3)), b = lum(bg);
    return { text: e.textContent.trim().slice(0, 20), ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
  });
}, sel);
const runView = pg => pg.evaluate(() => ({
  screen: document.querySelector('.screen.active').id, label: byId('planRunLabel').textContent, badge: byId('planRunBadge').textContent,
  back: byId('planRunBack').textContent, meta: (document.querySelector('#planRunBody .plan-run-meta') || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim(),
  fact: (document.querySelector('#planRunBody .fact') || { dataset: {} }).dataset.factId || null,
  sqm: !!document.querySelector('#planRunBody .sqm.show .sqm-head'),
  note: (document.querySelector('#planRunBody .plan-note') || { textContent: '' }).textContent,
  nav: [...document.querySelectorAll('#planRunBody .plan-run-nav .nav-btn')].map(b => ({ text: b.textContent, action: b.dataset.action, disabled: b.disabled })),
}));

async function checkHidden(pg) {
  await fresh(pg, at(TODAY), '');
  await seed(pg);
  await pg.evaluate(() => planOpenTask('2026-10-01', 0));
  assert(await activeScreen(pg) === 'screenHome', 'hidden: planOpenTask() on reading stays on Home');
  await pg.evaluate(() => { pendingMode = EXAM_MODE; startExam(3); state.answers = Object.fromEntries(state.questions.map((q, i) => [i, [...q.a]])); finishExam(); });
  assert(await pg.evaluate(() => byId('resultPlanRow').hidden && byId('resultPlanRow').innerHTML === ''), 'hidden: an ordinary Exam result has no plan row');
}

// G3: reading counts for nothing; Prev / Next; the card is the Study card; its "▶ Practise" practises that fact
// for the plan day and comes back to the same fact; the last fact's "Practise these n →" opens the paired practice task
async function checkRead(pg) {
  await fresh(pg);
  await seed(pg);
  await openDay(pg);
  const p = await plan(pg);
  const ri = taskIndexOf(p, TODAY, t => t.type === 'read' && t.facts.length >= 3);
  const task = p.days[0].tasks[ri];
  const n = task.facts.length;
  assert(ri >= 0, `a reading task of ${n} facts`);
  assert(await visible(pg, taskBox(TODAY, ri)), 'the reading box is a button');
  assert(await hitOk(pg, taskBox(TODAY, ri)), `reading box: ${HIT_MIN_PX}px`);
  const before = await storage(pg);
  await tap(pg, taskBox(TODAY, ri));
  let v = await runView(pg);
  assert(v.screen === 'screenPlanRun' && v.label === `Chapter ${task.ch}` && v.badge === 'Study' && v.back === "← Today's tasks",
    `reading: #screenPlanRun, "Chapter ${task.ch}" · Study, ← Today's tasks`);
  assert(v.meta.endsWith(`Fact 1 of ${n}`) && v.meta.startsWith(`Read Ch ${task.ch}`), 'top line: task · Fact 1 of n: ' + v.meta);
  assert(Number(v.fact) === task.facts[0] && v.note === '', 'the first fact\'s Study card, no review note');
  const card = await pg.evaluate(() => {
    const c = document.querySelector('#planRunBody .fact');
    return { star: !!c.querySelector('.fact-btn.star[data-action="studyToggleMark"]'), src: !!c.querySelector('.fact-src .sqm-node'),
      practise: (c.querySelector('.fact-practise') || { dataset: {} }).dataset.action, en: !!c.querySelector('.fact-en[lang="en"]'),
      meter: document.querySelector('#planRunBody .plan-run-meter i').style.width };
  });
  assert(card.star && card.src && card.en && card.practise === 'planPractiseFact', 'factCardHtml: bookmark / mastered, source nodes, ▶ Practise for the plan');
  assert(card.meter === `${Math.round(100 / n)}%`, 'position bar sized from JS: ' + card.meter);
  assert(v.nav[0].disabled && v.nav[0].text === '← Prev' && v.nav[1].text === 'Next →', 'nav-row: ← Prev (disabled on the first) / Next →');
  for (const s of ['#planRunBack', '#planRunBody .plan-run-nav [data-arg="1"]', '#planRunBody .fact-practise']) assert(await hitOk(pg, s), `${s}: ${HIT_MIN_PX}px`);
  await tap(pg, '#planRunBody .plan-run-nav [data-arg="1"]');
  v = await runView(pg);
  assert(v.meta.endsWith(`Fact 2 of ${n}`) && Number(v.fact) === task.facts[1] && !v.nav[0].disabled, 'Next → Fact 2, ← Prev enabled');
  assert(await pg.evaluate(() => document.activeElement.matches('#planRunBody [data-action="planStepFact"][data-arg="1"]')), 'focus stays on Next (updated in place)');
  await tap(pg, '#planRunBody .plan-run-nav [data-arg="-1"]');
  assert((await runView(pg)).meta.endsWith(`Fact 1 of ${n}`), '← Prev → Fact 1');
  assert(await storage(pg) === before, 'G3: reading (Next / Prev) writes nothing');
  // the bookmark works on the card and keeps focus
  await tap(pg, '#planRunBody .fact-btn.star');
  const mark = await pg.evaluate(id => ({ on: document.querySelector('#planRunBody .fact-btn.star').getAttribute('aria-pressed'),
    stored: study.bookmarks[id] === true, focus: document.activeElement.matches('#planRunBody .fact-btn.star') }), task.facts[0]);
  assert(mark.on === 'true' && mark.stored && mark.focus, 'the bookmark toggles on the plan card, focus kept');
  await tap(pg, '#planRunBody .fact-btn.star');
  // ▶ Practise: the fact's questions, for today; back to the same fact; the fact's button goes once it is done
  const fid = task.facts[0];
  await tap(pg, '#planRunBody .fact-practise');
  const s = await pg.evaluate(fid => ({ screen: document.querySelector('.screen.active').id, plan: isPlanSession(), day: state.planDay,
    keys: state.questions.map(qKey).sort(), want: planFactQids(planFactById(fid)).sort(), label: byId('quizLabel').textContent,
    back: document.querySelector('#screenQuiz .back-btn').textContent }), fid);
  assert(s.screen === 'screenQuiz' && s.plan && s.day === TODAY && JSON.stringify(s.keys) === JSON.stringify(s.want),
    `▶ Practise: a plan session over the fact's ${s.want.length} questions, for today`);
  assert(/^Fact Ch \d #\d+$/.test(s.label) && s.back === "← Today's tasks", 'header: Fact Ch c #n · ← Today\'s tasks: ' + s.label);
  await playAllRight(pg);
  v = await runView(pg);
  assert(v.screen === 'screenPlanRun' && Number(v.fact) === fid && v.meta.endsWith(`Fact 1 of ${n}`), 'finished: back on the same fact');
  const log = await dayLog(pg, TODAY);
  assert(s.want.every(k => log.ok[k]), 'the fact\'s questions are right for today');
  assert(!(await visible(pg, '#planRunBody .fact-practise')), 'a fact already practised right today has no ▶ Practise');
  // W-043: Next on the last-but-one fact (keyboard): focus lands on the last fact's main button, not "← Prev"
  await pg.evaluate(n => { planRunView.pos = n - 2; renderPlanRun(); }, n);
  await pg.focus('#planRunBody .plan-run-nav [data-arg="1"]');
  await pg.keyboard.press('Enter');
  assert(await pg.evaluate(() => document.activeElement.matches('#planRunBody .plan-run-nav .nav-btn:last-child[data-action="planOpenTask"]')),
    'W-043: on the last fact, focus is on "Practise these n →"');
  v = await runView(pg);
  const pair = p.days[0].tasks[task.pair];
  const left = pair.qids.filter(k => !log.ok[k]).length;
  assert(v.nav[1].action === 'planOpenTask' && v.nav[1].text === `Practise these ${left} →`, `last fact: "Practise these ${left} →": ` + v.nav[1].text);
  await tap(pg, '#planRunBody .plan-run-nav [data-action="planOpenTask"]');
  const q = await pg.evaluate(() => ({ plan: isPlanSession(), task: sessionReturn.taskIndex, type: sessionReturn.type, pair: !byId('planPairNote').hidden }));
  assert(q.plan && q.task === task.pair && q.type === 'practice' && q.pair, 'the paired practice task runs (with its "matching facts" note)');
  // language switch on the reading card keeps the fact shown
  await tap(pg, '#screenQuiz .back-btn');
  await tap(pg, taskBox(TODAY, ri));
  assert((await runView(pg)).meta.endsWith(`Fact 2 of ${n}`), 'reopened: resumes at the first fact not yet practised right');
  await pg.evaluate(() => setLang('zh-HK'));
  v = await runView(pg);
  assert(v.meta.includes(`第 2 條（共 ${n} 條）`) && Number(v.fact) === task.facts[1] && v.badge === '溫習' && v.nav[0].text === '← 上一條' && v.nav[1].text === '下一條 →',
    'zh-HK: same fact, 第 2 條（共 n 條）, 溫習, ← 上一條 / 下一條 →: ' + v.meta);
  await pg.evaluate(() => setLang('en'));
}

// a finished reading task opens in review mode: the cards, nothing to practise, the last one "Finish ✓"
async function checkReadReview(pg) {
  await fresh(pg);
  await seed(pg);
  await pg.evaluate(() => {
    const t = planLoad().days[0].tasks.find(x => x.type === 'read');
    const ok = Object.fromEntries(t.facts.flatMap(id => planFactQids(planFactById(id))).map(k => [k, 1]));
    writePlanLog({ v: 1, days: { '2026-10-01': { ok } } });
  });
  await openDay(pg);
  const p = await plan(pg);
  const ri = taskIndexOf(p, TODAY, t => t.type === 'read');
  assert(await text(pg, taskBox(TODAY, ri) + ' .plan-task-go') === '✓ Review ›', 'a finished reading box: ✓ Review ›');
  const before = await storage(pg);
  await tap(pg, taskBox(TODAY, ri));
  let v = await runView(pg);
  assert(v.note === '✅ This task is done · reviewing it does not change your progress.' && !(await visible(pg, '#planRunBody .fact-practise')),
    'review: the done note, no ▶ Practise');
  await pg.evaluate(() => { planRunView.pos = planLoad().days[0].tasks.find(x => x.type === 'read').facts.length - 1; renderPlanRun(); });
  v = await runView(pg);
  assert(v.nav[1].text === 'Finish ✓' && v.nav[1].action === 'planBackToDay', 'review: the last fact "Finish ✓" goes back');
  await tap(pg, '#planRunBody .plan-run-nav [data-action="planBackToDay"]');
  assert(await activeScreen(pg) === 'screenPlanDay' && await storage(pg) === before, 'back on the day; review wrote nothing');
}

// arch §E.3 / G26: the facts behind wrong answers = the Similar panel, the wrong answer as "current"; its CTA practises
// the fact; the last fact practises what is left; then the Result card; "Start next" opens every task type
async function checkWrongFacts(pg) {
  await fresh(pg, at(DRILL_TODAY));
  await seed(pg, { start: START, wrong: WRONG_KEYS });
  await openDay(pg);
  const p = await plan(pg);
  const wi = taskIndexOf(p, DRILL_TODAY, t => t.type === 'wrongFacts');
  const task = p.days.find(d => d.date === DRILL_TODAY).tasks[wi];
  assert(task.facts.length === WRONG_KEYS.length, `G9: ${task.facts.length} facts behind the wrong answers`);
  await tap(pg, taskBox(DRILL_TODAY, wi));
  let v = await runView(pg);
  assert(v.screen === 'screenPlanRun' && v.sqm && v.fact === null && v.label === 'Wrong-answer facts' && v.badge === 'Practice',
    'the Similar panel (.sqm), "Wrong-answer facts" · Practice: ' + v.label);
  const panel = await pg.evaluate(() => ({ current: document.querySelector('#planRunBody .sqm-node.current').textContent,
    core: !!document.querySelector('#planRunBody .sqm-fact.core'), legend: !!document.querySelector('#planRunBody .sqm-legend'),
    cta: document.querySelector('#planRunBody .sqm-cta button'), items: document.querySelectorAll('#planRunBody .sqm-item').length }));
  const anchor = task.anchor[task.facts[0]];
  const want = anchor.split('.').map(Number);
  assert(panel.current === `E${want[0]}·Q${want[1] + 1}` && panel.core && panel.legend && panel.items > 0, `current node = the wrong answer (${panel.current}), core fact, legend, list`);
  const cta = await pg.evaluate(() => { const b = document.querySelector('#planRunBody .sqm-cta button'); return [b.dataset.action, b.dataset.arg, b.textContent]; });
  const n0 = await pg.evaluate(id => planFactQids(planFactById(id)).length, task.facts[0]);
  assert(cta[0] === 'planPractiseFact' && Number(cta[1]) === task.facts[0], 'CTA practises the fact for the plan (not a Similar session)');
  assert(cta[2] === (n0 === 1 ? '▶ Practise this one' : `▶ Practise these ${n0}`), 'CTA counts the questions it asks: ' + cta[2]);
  assert(await hitOk(pg, '#planRunBody .sqm-cta button'), `CTA ${HIT_MIN_PX}px`);
  await tap(pg, '#planRunBody .sqm-cta button');
  assert(await pg.evaluate(() => isPlanSession() && state.planDay === '2026-10-06' && !byId('similarBox').querySelector('[data-action="startSimilarPractice"]')),
    'the fact session counts for the day; no Similar "Practise these N" inside it (G26)');
  await playAllRight(pg);
  v = await runView(pg);
  assert(v.screen === 'screenPlanRun' && v.meta.endsWith(`Fact 1 of ${task.facts.length}`) && !(await visible(pg, '#planRunBody .sqm-cta')),
    'back on fact 1; done, so no CTA');
  await tap(pg, '#planRunBody .plan-run-nav [data-arg="1"]');
  await tap(pg, '#planRunBody .plan-run-nav [data-arg="1"]');
  v = await runView(pg);
  const log = await dayLog(pg, DRILL_TODAY);
  const left = await pg.evaluate(ids => ids.flatMap(id => planFactQids(planFactById(id))).filter(k => !planDayLog(planLoadLog(), '2026-10-06').ok[k]).length, task.facts);
  assert(v.nav[1].action === 'planPractiseTask' && v.nav[1].text === (left === 1 ? 'Practise this one →' : `Practise these ${left} →`),
    'last fact: "Practise these n →" over what is left: ' + v.nav[1].text);
  await tap(pg, '#planRunBody .plan-run-nav [data-action="planPractiseTask"]');
  const keys = await pg.evaluate(() => state.questions.map(qKey));
  assert(keys.every(k => !log.ok[k]), 'the task round asks only what is not yet right');
  await playAllRight(pg);
  v = await runView(pg);
  assert(v.screen === 'screenPlanRun' && (await text(pg, '#planRunBody .result-label')).startsWith('Task done'), 'all facts right → the Result card');
  const pd = await pg.evaluate(() => planTaskProgress(planLoad().days.find(d => d.date === '2026-10-06').tasks.find(t => t.type === 'wrongFacts'), planDayLog(planLoadLogView(), '2026-10-06')));
  assert(pd.complete, 'the wrong-facts task is complete');
  // "Review this task" on a fact task opens its cards in review mode
  await tap(pg, '#planRunBody [data-action="planReviewTask"]');
  v = await runView(pg);
  assert(v.sqm && v.note.startsWith('✅'), '"Review this task": the panels in review mode');
  await tap(pg, '#planRunBack');
  // the Similar panel elsewhere still opens its own session (default CTA unchanged)
  await pg.evaluate(() => leaveToHome());
}

async function mockDay(pg) {
  return pg.evaluate(({ goal, start }) => buildPlan(goal, start).days.find(d => d.phase === 'mock' && !d.light).date, { goal: GOAL, start: START });
}
async function fillExam(pg, right) {
  await pg.evaluate(right => {
    state.questions.forEach((q, i) => { if (i < right) state.answers[i] = [...q.a]; else state.answers[i] = [q.o.findIndex((_, k) => !q.a.includes(k))]; });
    state.current = state.questions.length - 1;
    renderQuestion();
  }, right);
}
const mockState = pg => pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, mode: state.mode, exam: state.examNum,
  day: state.planDay, n: state.questions.length, timer: !byId('examTimer').hidden, random: isRandomExam(state.examNum),
  back: document.querySelector('#screenQuiz .back-btn').textContent }));

// G10 / G25 / G11 / G15 / G32: Exam mode itself; pass = done + score; fail = retake as a Random Exam; Leave = nothing
async function checkMock(pg) {
  await fresh(pg);
  const iso = await mockDay(pg);
  await fresh(pg, at(iso));
  await seed(pg, { start: START });
  await pg.evaluate(() => { pendingMode = PRACTICE_MODE; });
  await openDay(pg);
  const p = await plan(pg);
  const mi = taskIndexOf(p, iso, t => t.type === 'mock');
  const exam = p.days.find(d => d.date === iso).tasks[mi].exam;
  assert(await visible(pg, taskBox(iso, mi)), 'the mock box is a button on its day');
  await tap(pg, taskBox(iso, mi));
  let m = await mockState(pg);
  assert(m.screen === 'screenQuiz' && m.mode === 'exam' && m.exam === exam && m.n === 24 && m.timer && m.day === iso,
    `Exam mode: Exam ${exam}, 24 questions, timer, for the plan day (Home's mode was Practice)`);
  assert(m.back === "← Today's tasks", 'header: ← Today\'s tasks');
  // Leave = not submitted
  const before = await storage(pg);
  await tap(pg, '#screenQuiz .back-btn');
  assert(await visible(pg, '#confirmModal .modal-card'), 'Leave asks first');
  await tap(pg, '#confirmOk');
  assert(await activeScreen(pg) === 'screenPlanDay' && await pg.evaluate(() => examTimerId === null) && await storage(pg) === before,
    'G15: Leave → the day screen, timer stopped, nothing recorded');
  // fail (17 / 24): the plan row offers a Random Exam
  await tap(pg, taskBox(iso, mi));
  await fillExam(pg, 17);
  await tap(pg, '#nextBtn');
  assert(await activeScreen(pg) === 'screenResult', 'submit → results');
  let row = await pg.evaluate(() => ({ hidden: byId('resultPlanRow').hidden, note: byId('resultPlanRow').querySelector('.plan-note').textContent,
    acts: [...byId('resultPlanRow').querySelectorAll('.nav-btn')].map(b => [b.textContent, b.dataset.action]) }));
  assert(!row.hidden && row.note === 'Not passed (pass mark 18 / 24): retake as a Random Exam today.', 'not passed: ' + row.note);
  assert(row.acts.map(a => a[1]).join() === 'planRetryMock,planBackToDay' && row.acts[0][0] === 'Retake: Random Exam' && row.acts[1][0] === 'Back to the task list',
    'Retake: Random Exam / Back to the task list');
  for (const s of ['#resultPlanRow [data-action="planBackToDay"]', '#resultPlanRow [data-action="planRetryMock"]']) assert(await hitOk(pg, s), `${s}: ${HIT_MIN_PX}px`);
  const lowRow = (await contrastOf(pg, '#resultPlanRow .plan-note')).filter(c => c.ratio < MIN_CONTRAST);
  assert(lowRow.length === 0, 'plan row note ≥ 4.5:1: ' + JSON.stringify(lowRow));
  let lg = await dayLog(pg, iso);
  assert(lg.mock.length === 1 && lg.mock[0].correct === 17 && lg.mock[0].exam === exam, 'G25: the attempt is recorded with its score');
  // the existing Retry button: Random Exam in Exam mode too, whatever Home's mode (pendingMode = Practice)
  await tap(pg, '#screenResult .result-actions .retry-btn');
  m = await mockState(pg);
  assert(m.mode === 'exam' && m.exam === 'all' && m.random && m.day === iso && m.n === 24, 'Retry: a Random Exam, EXAM_MODE + ALL_EXAM, for the plan day');
  await tap(pg, '#screenQuiz .back-btn');
  await tap(pg, '#confirmOk');
  // reopening the box after a failed attempt: Random Exam (G11)
  await tap(pg, taskBox(iso, mi));
  m = await mockState(pg);
  assert(m.exam === 'all' && m.random, 'G11: the box after a failed attempt opens a Random Exam');
  await fillExam(pg, 20);
  await tap(pg, '#nextBtn');
  row = await pg.evaluate(() => ({ note: byId('resultPlanRow').querySelector('.plan-note').textContent,
    acts: [...byId('resultPlanRow').querySelectorAll('.nav-btn')].map(b => b.dataset.action) }));
  assert(row.note === '✓ Mock exam task done' && row.acts.join() === 'planBackToDay', 'passed (20 / 24): ✓ Mock exam task done');
  lg = await dayLog(pg, iso);
  assert(lg.mock.length === 2 && lg.mock[1].exam === 'all' && lg.mock[1].correct === 20, 'G10: the Random Exam pass is recorded');
  await tap(pg, '#resultPlanRow [data-action="planBackToDay"]');
  assert(await activeScreen(pg) === 'screenPlanDay', 'Back to the task list → the day');
  assert((await text(pg, taskBox(iso, mi) + ' .plan-task-st')).startsWith('✓ Passed · best 20 / 24'), 'the box: ✓ Passed · best 20 / 24');
  assert(await pg.evaluate(() => document.activeElement && document.activeElement.matches('button[data-action="planOpenTask"]')), 'focus back on the task box');
  // a passed mock box opens its Result card (no review of an exam)
  await tap(pg, taskBox(iso, mi));
  const card = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, sub: document.querySelector('#planRunBody .result-sub').textContent,
    label: byId('planRunLabel').textContent, badge: byId('planRunBadge').textContent, review: !!document.querySelector('#planRunBody [data-action="planReviewTask"]') }));
  assert(card.screen === 'screenPlanRun' && card.sub === '✓ Passed · best 20 / 24' && !card.review && card.badge === 'Exam' && card.label === `Exam ${exam}`,
    'a passed mock: its Result card, best score, no "Review this task"');
  await tap(pg, '#planRunBack');
  // W-044: slot 0 failed then passed as a Random Exam: slot 1 opens its own exam, not a Random Exam
  const mi2 = taskIndexOf(p, iso, t => t.type === 'mock' && t.slot === 1);
  assert(mi2 >= 0, 'the mock day has a second mock slot');
  const exam2 = p.days.find(d => d.date === iso).tasks[mi2].exam;
  await tap(pg, taskBox(iso, mi2));
  m = await mockState(pg);
  assert(m.exam === exam2 && !m.random, `W-044: slot 1 opens its own Exam ${exam2} after slot 0's retake passed`);
  await tap(pg, '#screenQuiz .back-btn');
  await tap(pg, '#confirmOk');
}

// G15: the switch off while timed = Leave (not submitted); time up submits (page.clock)
async function checkMockTimer(pg) {
  const iso = await mockDay(pg);
  await fresh(pg, at(iso));
  await seed(pg, { start: START });
  await openDay(pg);
  const p = await plan(pg);
  const mi = taskIndexOf(p, iso, t => t.type === 'mock');
  await tap(pg, taskBox(iso, mi));
  const before = await storage(pg);
  await pg.evaluate(() => { setStudyPlanEnabled(true); togglePlanFeature(); });
  await tap(pg, '#confirmOk');
  const off = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, timer: examTimerId }));
  const after = JSON.parse(await storage(pg)).filter(([k]) => k !== 'lifeuk.studyPlanEnabled');
  assert(off.screen === 'screenHome' && off.timer === null && JSON.stringify(after) === JSON.stringify(JSON.parse(before).filter(([k]) => k !== 'lifeuk.studyPlanEnabled')),
    'G15: switch off while timed → Home, timer stopped, not submitted');
  await pg.evaluate(() => setStudyPlanEnabled(true));
  await openDay(pg);
  await tap(pg, taskBox(iso, mi));
  await fillExam(pg, 18);
  await pg.clock.setFixedTime(new Date(at(iso).getTime() + EXAM_MS + 2000));
  await pg.waitForFunction(() => document.querySelector('.screen.active').id === 'screenResult', null, { timeout: 5000 });
  const r = await pg.evaluate(() => ({ up: !byId('resultTimeUp').hidden, note: byId('resultPlanRow').textContent, log: planDayLog(planLoadLog(), planTodayIso()).mock }));
  assert(r.up && r.note.includes('✓ Mock exam task done') && r.log.length === 1 && r.log[0].correct === 18, 'time up submits: 18 / 24 passes the task');
}

// S-131: started 23:50, submitted 00:10: the log has no attempt for that day, so the row says it does not count
async function checkMockMidnight(pg) {
  const iso = await mockDay(pg);
  await fresh(pg, at(iso, '23:50:00'));
  await seed(pg, { start: START });
  await openDay(pg);
  const p = await plan(pg);
  await tap(pg, taskBox(iso, taskIndexOf(p, iso, t => t.type === 'mock')));
  await fillExam(pg, 24);
  await pg.clock.setFixedTime(new Date(at(iso, '23:50:00').getTime() + 20 * 60 * 1000));
  await tap(pg, '#nextBtn');
  const r = await pg.evaluate(iso => ({ screen: document.querySelector('.screen.active').id, note: byId('resultPlanRow').querySelector('.plan-note').textContent,
    acts: [...byId('resultPlanRow').querySelectorAll('.nav-btn')].map(b => b.dataset.action), log: planDayLog(planLoadLog(), iso).mock }), iso);
  assert(r.screen === 'screenResult' && r.log.length === 0, 'S-131: submitted after midnight: nothing recorded for that day');
  assert(r.note === 'Submitted after midnight: this attempt does not count for that day.' && r.acts.join() === 'planBackToDay',
    'S-131: the row says so (no "task done", no retake): ' + r.note);
}

// Home "Continue" and "Start next →" open reading / mock too (not only question tasks)
async function checkContinue(pg) {
  await fresh(pg);
  await seed(pg);
  await pg.evaluate(() => leaveToHome());
  await tap(pg, '#planCard [data-action="planContinue"]');
  const v = await runView(pg);
  assert(v.screen === 'screenPlanRun' && v.fact !== null, 'Home "Continue": the first task (reading) opens its card');
}

async function checkLayout(b) {
  for (const lang of ['en', 'zh-HK']) {
    for (const w of WIDTHS) {
      const pg = await b.newPage({ viewport: { width: w, height: 760 } });
      await fresh(pg);
      await pg.evaluate(lang => setLang(lang), lang);
      await seed(pg);
      await openDay(pg);
      const p = await plan(pg);
      await tap(pg, taskBox(TODAY, taskIndexOf(p, TODAY, t => t.type === 'read')));
      await shotAndCheck(pg, lang, w, 'read');
      await fresh(pg, at(DRILL_TODAY));
      await pg.evaluate(lang => setLang(lang), lang);
      await seed(pg, { start: START, wrong: WRONG_KEYS });
      await openDay(pg);
      const p2 = await plan(pg);
      await tap(pg, taskBox(DRILL_TODAY, taskIndexOf(p2, DRILL_TODAY, t => t.type === 'wrongFacts')));
      await shotAndCheck(pg, lang, w, 'wrongfacts');
      await pg.close();
    }
  }
}
async function shotAndCheck(pg, lang, w, name) {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert(r.sw <= r.cw, `${lang} ${w}px ${name}: no horizontal scroll`);
  for (const s of ['#planRunBack', '#planRunBody .plan-run-nav .nav-btn:last-child']) assert(await hitOk(pg, s), `${lang} ${w}px ${name}: ${s} ${HIT_MIN_PX}px`);
  const low = (await contrastOf(pg, '#planRunBody .plan-run-meta span, #planRunBody .plan-note, #planRunBody .nav-btn:not([disabled])')).filter(c => c.ratio < MIN_CONTRAST);
  assert(low.length === 0, `${lang} ${w}px ${name}: text ≥ ${MIN_CONTRAST}:1 ` + JSON.stringify(low));
  if (SHOTS) {
    await pg.evaluate(() => window.scrollTo(0, 0));
    await pg.waitForTimeout(400); // the Similar panel's slide-in
    await pg.screenshot({ path: path.join(SHOTS, `${name}-${lang}-${w}.png`), fullPage: true });
  }
}
async function shotMock(b) {
  if (!SHOTS) return;
  for (const lang of ['en', 'zh-HK']) {
    for (const w of WIDTHS) {
      const pg = await b.newPage({ viewport: { width: w, height: 760 } });
      const iso = await (async () => { await pg.goto(APP_URL + '?preview=plan'); return mockDay(pg); })();
      await fresh(pg, at(iso));
      await pg.evaluate(lang => setLang(lang), lang);
      await seed(pg, { start: START });
      await openDay(pg);
      const p = await plan(pg);
      await tap(pg, taskBox(iso, taskIndexOf(p, iso, t => t.type === 'mock')));
      await fillExam(pg, 17);
      await tap(pg, '#nextBtn');
      const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      assert(r.sw <= r.cw, `${lang} ${w}px mock result: no horizontal scroll`);
      await pg.screenshot({ path: path.join(SHOTS, `mock-result-${lang}-${w}.png`) });
      await pg.close();
    }
  }
}

async function main() {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && m.text().includes('[i18n]'))) errs.push(m.text()); });
  await checkHidden(pg);
  await checkRead(pg);
  await checkReadReview(pg);
  await checkWrongFacts(pg);
  await checkMock(pg);
  await checkMockTimer(pg);
  await checkMockMidnight(pg);
  await checkContinue(pg);
  await checkLayout(b);
  await shotMock(b);
  assert(errs.length === 0, 'no page errors / i18n warnings: ' + errs.join(' | '));
  await b.close();
}
main().then(() => console.log('PLAN-RUN2 PASS')).catch(e => { console.error(e.message); process.exit(1); });
