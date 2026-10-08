// QA plan PR2 (study plan hooks, no UI): real-browser checks over http, answers given by clicking the real buttons
//   node 2026-10-08_qa-plan-pr2-browser.js <repo-root> <work-dir> [base-ref=0c8f5de]
// N. no plan: one scripted UI flow (Practice + Similar + wrong answers + Flagged + Exam submit + Random Exam + Leave +
//    Practice-mode By Exam finish) run on the PR base tree and on the PR tree with the same Math.random seed and clock
//    → storage write sequence + final storage + screen texts identical, 0 lifeuk.studyPlan* writes, 0 console errors
// P. plan seeded (page.clock fixed): G2 four places, not-in-task, G22, G32, G15, G14, W-030, plus QA edge cases
//    (copy of a duplicate question, carry-over, exam day / after, corrupt log, log write throws, double submit,
//    language switch on results, time-up submit, future plan day session)
// U. upgrade (R1): base v1.0.0 SW + cache → PR tree; with a plan seeded, UI answers + Exam submit; and a mixed load
//    (PR screens/domain + base planProgress.js / index.html) answering + submitting without error
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(process.argv[2]); const WORK = path.resolve(process.argv[3]); const BASE = process.argv[4] || '0c8f5de';
const { startPagesServer, appFiles } = require(path.join(ROOT, 'tests', 'pages-server.js'));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; console.log('FAIL:', m); } };
const launchOpts = { args: ['--no-sandbox'] }; if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const TODAY = '2026-10-08'; const at = iso => new Date(iso + 'T09:00:00');
const DUP_COPY = '4.14', DUP_CANON = '3.12';
// seeded Math.random + every storage write recorded (per document)
const INIT = () => {
  let s = 20261008; Math.random = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x80000000; };
  window.__w = [];
  const set = Storage.prototype.setItem, rm = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) { window.__w.push(['set', k, v]); if (window.__throwKey && k === window.__throwKey) throw new DOMException('quota', 'QuotaExceededError'); return set.call(this, k, v); };
  Storage.prototype.removeItem = function (k) { window.__w.push(['rm', k]); return rm.call(this, k); };
};
const settle = (pg, ms = 150) => pg.waitForTimeout(ms);
const dump = pg => pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
const writes = pg => pg.evaluate(() => window.__w);
const planWrites = pg => pg.evaluate(() => window.__w.filter(w => /studyPlan/.test(w[1])).map(w => w[0] + ':' + w[1]));
const screen = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
const confirmIfOpen = async pg => { if (await pg.evaluate(() => isConfirmOpen())) { await pg.click('#confirmOk'); await settle(pg); } };

// click the options of the current question: right = its answers, wrong = first wrong option(s)
async function clickAnswer(pg, right) {
  const picks = await pg.evaluate(right => { const q = state.questions[state.current];
    if (right) return q.a; const wrong = q.o.map((_, k) => k).filter(k => !q.a.includes(k)); return wrong.slice(0, q.a.length).concat(q.a).slice(0, q.a.length); }, right);
  for (const p of picks) await pg.click('#opt' + p);
  await settle(pg, 60);
}
const goTo = (pg, i) => pg.evaluate(i => goToQuestion(i), i);
const indexOfQid = (pg, qid) => pg.evaluate(qid => state.questions.findIndex(q => qKey(q) === qid || planCanonKey(qKey(q)) === qid), qid);
async function answerQid(pg, qid, right) {
  const i = await indexOfQid(pg, qid); if (i < 0) return false;
  await goTo(pg, i); await clickAnswer(pg, right); return true;
}
async function home(pg) { await pg.evaluate(() => goHome()); await settle(pg); await confirmIfOpen(pg); }
async function openExamButton(pg, mode, examArg) {
  await home(pg);
  await pg.click(mode === 'exam' ? '#modeExam' : '#modePractice'); await settle(pg);
  if (mode === 'practice') { await pg.click('#ptabExam'); await settle(pg); }
  await pg.click(`#examGrid [data-action="startExam"][data-arg="${examArg}"]`); await settle(pg);
}
// last question → bottom button (Submit / Finish) → confirm
async function finishByButton(pg) {
  await pg.evaluate(() => goToQuestion(state.questions.length - 1)); await settle(pg, 60);
  await pg.click('#nextBtn'); await settle(pg); await confirmIfOpen(pg);
}

// ── N: the same UI flow on two trees ──
const N_SEED = {
  'lifeuk.wrongList': JSON.stringify({ [DUP_COPY]: true, [DUP_CANON]: true, '8.1': true }),
  'lifeuk.practiceFlags': '{"9.13":true,"6.17":true}', 'lifeuk.practiceStreak': '{"1.0":2,"2.5":3}',
  'lifeuk.completedExams': '{"1":true}', 'lifeuk.installDismissed': 'true',
};
async function noPlanFlow(pg) {
  const t = {};
  // Practice By Exam 5: answer 5 alternately via clicks, then open Similar on a revealed question and do it
  await openExamButton(pg, 'practice', '5');
  for (let i = 0; i < 5; i++) { await goTo(pg, i); await clickAnswer(pg, i % 2 === 0); }
  const sim = await pg.$('#similarBox.show [data-action="startSimilarPractice"]');
  t.similar = !!sim;
  if (sim) {
    await sim.click(); await settle(pg);
    const n = await pg.evaluate(() => state.questions.length);
    for (let i = 0; i < n; i++) { await goTo(pg, i); await clickAnswer(pg, true); }
    await pg.click('#nextBtn'); await settle(pg); // ↩ Back
  }
  t.afterSimilar = await pg.evaluate(() => state.examNum + '@' + state.current);
  // wrong answers review: answer all right (holds 4.14 + 3.12, two copies of one question)
  await home(pg); await pg.click('#tileWrong'); await settle(pg);
  const nWrong = await pg.evaluate(() => state.questions.length);
  for (let i = 0; i < nWrong; i++) { await goTo(pg, i); await clickAnswer(pg, true); }
  t.wrongAfter = await pg.evaluate(() => ({ list: keysOf(wrongList).sort(), cleared: state.cleared }));
  await finishByButton(pg); t.wrongResult = await pg.textContent('#resultScore');
  // Flagged
  await home(pg); await pg.click('#tileFlagged'); await settle(pg); await pg.click('#flaggedStart'); await settle(pg);
  await goTo(pg, 0); await clickAnswer(pg, true); await goTo(pg, 1); await clickAnswer(pg, false);
  // Exam mode Exam 2: answer by clicks, submit
  await openExamButton(pg, 'exam', '2');
  for (let i = 0; i < 24; i++) { await goTo(pg, i); await clickAnswer(pg, i % 3 !== 0); }
  await finishByButton(pg); t.exam2 = [await screen(pg), await pg.textContent('#resultScore')];
  // Random Exam
  await openExamButton(pg, 'exam', 'all');
  for (let i = 0; i < 10; i++) { await goTo(pg, i); await clickAnswer(pg, true); }
  await finishByButton(pg); t.random = [await screen(pg), await pg.textContent('#resultScore')];
  // Exam 3 → Leave
  await openExamButton(pg, 'exam', '3'); await goTo(pg, 0); await clickAnswer(pg, true);
  await pg.click('#screenQuiz .back-btn'); await settle(pg); t.leaveModal = await pg.evaluate(() => isConfirmOpen());
  await confirmIfOpen(pg); t.afterLeave = await screen(pg);
  // Practice mode By Exam 6: answer all, Finish
  await openExamButton(pg, 'practice', '6');
  const n6 = await pg.evaluate(() => state.questions.length);
  for (let i = 0; i < n6; i++) { await goTo(pg, i); await clickAnswer(pg, i % 4 !== 0); }
  await finishByButton(pg); t.practice6 = [await screen(pg), await pg.textContent('#resultScore')];
  await home(pg);
  t.tiles = [await pg.textContent('#tileWrong'), await pg.textContent('#tileFlagged')];
  return t;
}
async function runNoPlan(b, dir, label) {
  const { base, server } = await startPagesServer(dir);
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    await ctx.addInitScript(INIT);
    const pg = await ctx.newPage(); const errs = [], cons = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') cons.push(m.text()); });
    await pg.clock.setFixedTime(at(TODAY));
    await pg.goto(base); await settle(pg);
    await pg.evaluate(s => { localStorage.clear(); Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); }, N_SEED);
    await pg.reload(); await settle(pg, 300);
    const texts = await noPlanFlow(pg);
    const out = { texts, writes: await writes(pg), final: await dump(pg), planWrites: await planWrites(pg), errs, cons };
    await ctx.close(); return out;
  } finally { server.kill(); }
}
async function partN(b) {
  const baseDir = path.join(WORK, 'pr2-base'); fs.rmSync(baseDir, { recursive: true, force: true }); fs.mkdirSync(baseDir, { recursive: true });
  execSync(`git archive ${BASE} | tar -x -C "${baseDir}"`, { cwd: ROOT, shell: '/bin/bash' });
  const a = await runNoPlan(b, baseDir, 'base'); const p = await runNoPlan(b, ROOT, 'pr');
  console.log('  [N] pr texts:', JSON.stringify(p.texts));
  ok(p.texts.similar && p.texts.exam2[0] === 'screenResult' && p.texts.random[0] === 'screenResult' && p.texts.leaveModal && p.texts.afterLeave === 'screenHome' && p.texts.practice6[0] === 'screenResult',
    '[N] flow really ran: Similar side session, Exam 2 + Random Exam results, Leave modal → Home, Practice By Exam 6 results');
  ok(JSON.stringify(a.texts) === JSON.stringify(p.texts), `[N] screen texts identical base vs PR ${JSON.stringify(a.texts) === JSON.stringify(p.texts) ? '' : JSON.stringify({ a: a.texts, p: p.texts })}`);
  const sw = w => w.map(x => x.join('|'));
  const same = JSON.stringify(sw(a.writes)) === JSON.stringify(sw(p.writes));
  ok(same, `[N] storage write sequence identical base vs PR (${p.writes.length} writes)` + (same ? '' : ' first diff @' + sw(a.writes).findIndex((x, i) => x !== sw(p.writes)[i])));
  ok(JSON.stringify(a.final) === JSON.stringify(p.final), '[N] final localStorage identical base vs PR');
  ok(p.planWrites.length === 0 && !Object.keys(p.final).some(k => /studyPlan/.test(k)), `[N] PR: 0 lifeuk.studyPlan* writes / keys ${JSON.stringify(p.planWrites)}`);
  ok(JSON.stringify(p.texts.wrongAfter) === JSON.stringify(a.texts.wrongAfter), `[N] wrong answers review clears the same entries as before (W-030 does not touch the normal review) ${JSON.stringify(p.texts.wrongAfter)}`);
  ok(p.errs.length === 0 && p.cons.length === 0 && a.errs.length === 0, `[N] no page / console errors (PR ${p.errs.concat(p.cons).join(' | ')})`);
  fs.rmSync(baseDir, { recursive: true, force: true });
}

// ── P: plan seeded ──
const dayLog = (pg, iso) => pg.evaluate(iso => { const l = JSON.parse(localStorage.getItem('lifeuk.studyPlanProgress') || 'null');
  const d = (l && l.days[iso]) || {}; return { ok: d.ok || {}, bad: d.bad || {}, mock: d.mock || [] }; }, iso);
const logRaw = pg => pg.evaluate(() => localStorage.getItem('lifeuk.studyPlanProgress'));
async function seed(pg, startIso, days = 21, restDays = []) {
  return pg.evaluate(({ startIso, days, restDays }) => {
    ['lifeuk.studyPlan', 'lifeuk.studyPlanProgress', 'lifeuk.studyPlanEnabled'].forEach(k => localStorage.removeItem(k));
    writeStudyPlan(buildPlan({ examDate: isoAddDays(startIso, days), dailyMins: 60, restDays, level: 'none' }, startIso));
    const p = ensurePlanToday(); return p.days.map(d => ({ date: d.date, phase: d.phase, tasks: d.tasks }));
  }, { startIso, days, restDays });
}
const qidsOfDay = d => d.tasks.flatMap(t => t.qids || []);
const practiceOf = d => (d.tasks.find(t => t.type === 'practice') || { qids: [] }).qids;
async function practiceExamOf(pg, qid) { const ex = await pg.evaluate(qid => String(questionByKey(qid).examNum), qid); await openExamButton(pg, 'practice', ex); }

async function partP(b) {
  const { base, server } = await startPagesServer(ROOT);
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    await ctx.addInitScript(INIT);
    const pg = await ctx.newPage(); const errs = [], cons = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') cons.push(m.text()); });
    await pg.clock.setFixedTime(at(TODAY));
    await pg.goto(base); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); }); await pg.reload(); await settle(pg, 300);
    let days = await seed(pg, TODAY);
    const todayQ = practiceOf(days[0]); const todaySet = new Set(qidsOfDay(days[0]));
    ok(days[0].date === TODAY && todayQ.length >= 6, `[P] seeded 21-day plan from ${TODAY}; today practice ${todayQ.length} qids`);
    // P1 Practice (clicks): wrong → bad only; right → ok
    const [q1, q2, q3, q4, q5, q6] = todayQ;
    await practiceExamOf(pg, q1); await answerQid(pg, q1, false);
    let L = await dayLog(pg, TODAY);
    ok(L.bad[q1] === 1 && !L.ok[q1], `[P1] Practice click wrong on today task ${q1} → bad only (G2)`);
    await practiceExamOf(pg, q2); await answerQid(pg, q2, true);
    ok((await dayLog(pg, TODAY)).ok[q2] === 1, `[P1] Practice click right on ${q2} → today ok (G2)`);
    // P2 wrong answers tile: q1 is in the wrong list from P1
    await home(pg); await pg.click('#tileWrong'); await settle(pg); await answerQid(pg, q1, true);
    L = await dayLog(pg, TODAY);
    ok(L.ok[q1] === 1 && L.bad[q1] === 1 && !(await pg.evaluate(k => !!wrongList[k], q1)), `[P2] wrong answers review right on ${q1} → today ok (bad kept), entry cleared as usual (G2)`);
    // P3 Flagged: flag q3 with the flag button in Practice, then Flagged → start
    await practiceExamOf(pg, q3); const i3 = await indexOfQid(pg, q3); await goTo(pg, i3);
    await pg.click('#flagBtn').catch(() => {}); await settle(pg);
    const flagged = await pg.evaluate(k => !!practiceFlags[k], q3);
    ok(flagged && !(await dayLog(pg, TODAY)).ok[q3], `[P3] flag button in Practice flags ${q3} (no answer, no log)`);
    await home(pg); await pg.click('#tileFlagged'); await settle(pg); await pg.click('#flaggedStart'); await settle(pg);
    await answerQid(pg, q3, true);
    ok((await dayLog(pg, TODAY)).ok[q3] === 1, `[P3] Flagged session right on ${q3} → today ok (G2)`);
    // P4 Similar: a question whose similar list holds a today task question
    const pair = await pg.evaluate(([today, all_]) => {
      const all = poolFor(ALL_EXAM);
      for (const it of all) { const ks = similarKeys(it); const hit = ks.find(k => today.includes(planCanonKey(k)) && !['', null].includes(k));
        if (hit && planCanonKey(hit) !== planCanonKey(qKey(it))) return { from: qKey(it), exam: String(it.examNum), to: hit }; }
      return null;
    }, [[...todaySet].filter(k => ![q1, q2, q3, q4, q5, q6].includes(k)), [...todaySet]]);
    if (pair) {
      await openExamButton(pg, 'practice', pair.exam); await answerQid(pg, pair.from, true);
      const btn = await pg.$('#similarBox.show [data-action="startSimilarPractice"]');
      if (btn) { await btn.click(); await settle(pg); }
      const inSide = await pg.evaluate(() => state.examNum === SIMILAR_EXAM);
      const beforeTo = !!(await dayLog(pg, TODAY)).ok[await pg.evaluate(k => planCanonKey(k), pair.to)];
      await answerQid(pg, pair.to, true);
      const canon = await pg.evaluate(k => planCanonKey(k), pair.to);
      ok(inSide && !beforeTo && (await dayLog(pg, TODAY)).ok[canon] === 1, `[P4] Similar CTA from ${pair.from} → Similar side session → right on ${pair.to} → today ok (G2)`);
      await pg.click('#nextBtn').catch(() => {}); await settle(pg);
    } else ok(false, '[P4] no question whose Similar list holds a today task question');
    // P5 a question no task holds
    // every question sits in some learn day of a 21-day plan, so "not a task question" = only a later day's task holds it
    const free = practiceOf(days[5]).find(k => !todaySet.has(k));
    const before5 = await logRaw(pg);
    await practiceExamOf(pg, free); const did5 = await answerQid(pg, free, true);
    ok(did5 && (await logRaw(pg)) === before5, `[P5] Practice right on ${free} (only Day 6 holds it; no today / carry task) → log bytes unchanged (G5)`);
    // P6 G22: Exam mode answers of today task question q4 not counted; no mock task today → no attempt
    const ex4 = await pg.evaluate(k => String(questionByKey(k).examNum), q4);
    await openExamButton(pg, 'exam', ex4);
    const n = await pg.evaluate(() => state.questions.length);
    for (let i = 0; i < n; i++) { await goTo(pg, i); await clickAnswer(pg, true); }
    await finishByButton(pg);
    L = await dayLog(pg, TODAY);
    ok((await screen(pg)) === 'screenResult' && !L.ok[q4] && !L.bad[q4] && L.mock.length === 0, `[P6] Exam mode Exam ${ex4} all right incl. ${q4} → not in ok/bad, no mock on a day without mock task (G22 / G23)`);
    // P7 G14 switch off
    await pg.evaluate(() => setStudyPlanEnabled(false));
    await practiceExamOf(pg, q5); await answerQid(pg, q5, true);
    ok((await dayLog(pg, TODAY)).ok[q5] === 1, `[P7] switch off → Practice right on ${q5} still recorded (G14)`);
    await pg.evaluate(() => setStudyPlanEnabled(true));
    // E1 right then wrong the same day: ok stays
    await practiceExamOf(pg, q2); const i2 = await indexOfQid(pg, q2); await goTo(pg, i2); await clickAnswer(pg, false);
    L = await dayLog(pg, TODAY);
    ok(L.ok[q2] === 1 && L.bad[q2] === 1, `[E1] ${q2} right then wrong the same day → ok kept (bad tallied)`);
    // E2 copy of a duplicate question: answer the copy in Practice on a day whose task holds the canonical key
    const dupDay = days.find(d => d.date >= TODAY && d.phase !== 'rest' && qidsOfDay(d).includes(DUP_CANON));
    const dupInfo = await pg.evaluate(() => Object.entries(PLAN_CANON_QKEY).filter(([k, v]) => k !== v).slice(0, 40));
    const dayWithDup = days.find(d => qidsOfDay(d).some(k => dupInfo.some(([, c]) => c === k)) && d.date >= TODAY);
    if (dayWithDup) {
      const canon = qidsOfDay(dayWithDup).find(k => dupInfo.some(([, c]) => c === k)); const copy = dupInfo.find(([, c]) => c === canon)[0];
      await pg.clock.setFixedTime(at(dayWithDup.date)); await pg.evaluate(() => ensurePlanToday());
      await practiceExamOf(pg, copy);
      const iCopy = await pg.evaluate(k => state.questions.findIndex(q => qKey(q) === k), copy);
      await goTo(pg, iCopy); await clickAnswer(pg, true);
      const D = await dayLog(pg, dayWithDup.date);
      ok(D.ok[canon] === 1 && !D.ok[copy], `[E2] Practice right on copy ${copy} (${dayWithDup.date}) → logged as canonical ${canon} (G1)`);
      await pg.clock.setFixedTime(at(TODAY));
    } else ok(true, '[E2] skipped: no plan day holds a duplicate canonical key (W-030 covered by plan-hook-test)');
    // P8 / E3 W-030 + variants (plan review side session, no UI yet → started from page context, answered by click)
    const reviewIndex = days[0].tasks.findIndex(t => t.type === 'review');
    const runReview = async (addKeys, askKey) => {
      await pg.evaluate(({ addKeys, askKey, ri }) => { leaveToHome(); addKeys.forEach(k => addWrong(questionByKey(k)));
        startSideSession(PLAN_PREFIX + 1, [questionByKey(askKey)].map(toQuestionItem), { kind: 'plan', date: planTodayIso(), taskIndex: ri, type: 'review' }); }, { addKeys, askKey, ri: reviewIndex });
      await settle(pg); await goTo(pg, 0); await clickAnswer(pg, true);
      return pg.evaluate(() => ({ list: keysOf(wrongList), cleared: state.cleared, label: byId('quizLabel').textContent }));
    };
    await pg.evaluate(() => { keysOf(wrongList).forEach(k => clearWrong(questionByKey(k))); });
    let r = await runReview([DUP_COPY, DUP_CANON], DUP_CANON);
    ok(!r.list.includes(DUP_COPY) && !r.list.includes(DUP_CANON) && r.cleared === 1 && r.label === 'Day 1', `[P8] plan review task right on ${DUP_CANON} → both copies cleared, cleared 1, header "Day 1" (W-030) ${JSON.stringify(r)}`);
    r = await runReview([DUP_COPY], DUP_CANON);
    ok(!r.list.includes(DUP_COPY) && r.cleared === 1, `[E3] wrong list holds only the copy ${DUP_COPY}, plan review asks ${DUP_CANON} → copy cleared, cleared 1 ${JSON.stringify(r)}`);
    r = await runReview([], DUP_CANON);
    ok(r.list.length === 0 && r.cleared === 0, `[E3] nothing in the wrong list → cleared stays 0 ${JSON.stringify(r)}`);
    r = await runReview(['8.1', DUP_COPY], '8.1');
    ok(!r.list.includes('8.1') && r.list.includes(DUP_COPY) && r.cleared === 1, `[E3] plan review on 8.1 clears 8.1 only, other entries kept ${JSON.stringify(r)}`);
    await pg.evaluate(() => { keysOf(wrongList).forEach(k => clearWrong(questionByKey(k))); leaveToHome(); });
    // E4 future plan day session (Day 3) credits Day 3 only
    const d3 = days[2]; const k3 = practiceOf(d3).find(k => !todaySet.has(k));
    await pg.evaluate(({ k, date }) => startSideSession(PLAN_PREFIX + 3, [questionByKey(k)].map(toQuestionItem), { kind: 'plan', date, taskIndex: 1, type: 'practice' }), { k: k3, date: d3.date });
    await settle(pg); await goTo(pg, 0); await clickAnswer(pg, true);
    ok((await dayLog(pg, d3.date)).ok[k3] === 1 && !(await dayLog(pg, TODAY)).ok[k3], `[E4] plan Day 3 session right on ${k3} → Day 3 ok, not today (G5)`);
    await pg.click('#nextBtn'); await settle(pg);
    ok((await screen(pg)) === 'screenHome', '[E4] ↩ Back from a plan session → Home');
    // P9 mock day: G10 / G11 / G32 / G15 + double submit + language switch + time up
    const mockDay = days.find(d => d.tasks.some(t => t.type === 'mock'));
    await pg.clock.setFixedTime(at(mockDay.date)); await pg.evaluate(() => ensurePlanToday());
    const mocks = async () => (await dayLog(pg, mockDay.date)).mock;
    await openExamButton(pg, 'exam', '7'); for (let i = 0; i < 20; i++) { await goTo(pg, i); await clickAnswer(pg, true); }
    await finishByButton(pg); let M = await mocks();
    ok(M.length === 1 && M[0].exam === 7 && M[0].correct === 20 && M[0].total === 24, `[P9] Exam mode Exam 7 submit (20/24) on mock day ${mockDay.date} → mock attempt ${JSON.stringify(M)} (G10)`);
    await pg.click('#langBtn'); await settle(pg); await pg.click('#langBtn'); await settle(pg);
    ok((await mocks()).length === 1, '[E5] language switch twice on the result screen → no extra mock attempt');
    await pg.evaluate(() => { try { finishExam(); } catch (e) {} }); // a stray second finish on the same results
    const afterDouble = (await mocks()).length;
    ok(true, `[E5-obs] calling finishExam() again on the result screen → mock attempts ${afterDouble} (UI cannot trigger this: no submit button on results)`);
    await openExamButton(pg, 'exam', 'all'); for (let i = 0; i < 12; i++) { await goTo(pg, i); await clickAnswer(pg, true); }
    await finishByButton(pg); M = await mocks();
    ok(M.length === afterDouble + 1 && M[M.length - 1].exam === 'all' && M[M.length - 1].total === 24, `[P9] Random Exam submit → another attempt { exam 'all' } (G11) ${JSON.stringify(M[M.length - 1])}`);
    let cnt = M.length;
    await openExamButton(pg, 'practice', '8'); const n8 = await pg.evaluate(() => state.questions.length);
    for (let i = 0; i < n8; i++) { await goTo(pg, i); await clickAnswer(pg, true); }
    await finishByButton(pg);
    ok((await screen(pg)) === 'screenResult' && (await mocks()).length === cnt, `[P9] Practice mode By Exam 8 finished (${n8} q) → no mock attempt (G32)`);
    await openExamButton(pg, 'practice', 'all'); await finishByButton(pg);
    ok((await mocks()).length === cnt, "[P9] Practice mode 'all' finished → no mock attempt (not Random Exam)");
    await openExamButton(pg, 'exam', '9'); await goTo(pg, 0); await clickAnswer(pg, true);
    await pg.click('#screenQuiz .back-btn'); await settle(pg); await pg.click('#confirmOk'); await settle(pg);
    ok((await screen(pg)) === 'screenHome' && (await mocks()).length === cnt, '[P9] Exam 9 → Home → confirm Leave → no mock attempt (G15)');
    await openExamButton(pg, 'exam', '10'); await goTo(pg, 0); await clickAnswer(pg, true);
    await pg.evaluate(() => { examDeadline = Date.now() - 1000; }); await pg.waitForTimeout(1500);
    M = await mocks();
    const tu = { screen: await screen(pg), n: M.length, last: M[M.length - 1] };
    ok(tu.screen === 'screenResult', `[E6-obs] Exam mode time up → auto submit → result; mock attempts ${tu.n} (was ${cnt}) last ${JSON.stringify(tu.last)}`);
    cnt = M.length;
    // E7 exam day + after: nothing recorded
    const examDate = days[days.length - 1] ? await pg.evaluate(() => JSON.parse(localStorage.getItem('lifeuk.studyPlan')).goal.examDate) : null;
    for (const iso of [examDate, await pg.evaluate(d => isoAddDays(d, 3), examDate)]) {
      await pg.clock.setFixedTime(at(iso)); const raw = await logRaw(pg);
      await practiceExamOf(pg, q6); await answerQid(pg, q6, true);
      await openExamButton(pg, 'exam', '11'); await finishByButton(pg);
      ok((await logRaw(pg)) === raw, `[E7] ${iso === examDate ? 'exam day' : 'after the exam'} (${iso}): Practice answer + Exam submit → log bytes unchanged (G16)`);
    }
    // E8 carry-over: plan started yesterday, Day 1 practice undone → today's Practice on a Day 1 question → Day 1
    await pg.clock.setFixedTime(at(TODAY));
    const y = await pg.evaluate(() => isoAddDays(planTodayIso(), -1));
    await pg.clock.setFixedTime(at(y)); days = await seed(pg, y); await pg.clock.setFixedTime(at(TODAY)); await pg.evaluate(() => ensurePlanToday());
    const dToday = new Set(qidsOfDay(days[1]));
    const carryQ = practiceOf(days[0]).find(k => !dToday.has(k));
    await practiceExamOf(pg, carryQ); await answerQid(pg, carryQ, true);
    ok((await dayLog(pg, y)).ok[carryQ] === 1 && !(await dayLog(pg, TODAY)).ok[carryQ], `[E8] Day 1 (${y}) task question ${carryQ} answered today in Practice → credited to Day 1 (G5 carry-over)`);
    const rawC = await logRaw(pg); await answerQid(pg, carryQ, true);
    ok((await logRaw(pg)) === rawC, `[E8] same carry question again (already ok on Day 1) → not written again`);
    // E9 corrupt log: answering still updates the wrong list; log bytes untouched; no error
    await pg.evaluate(() => localStorage.setItem('lifeuk.studyPlanProgress', '{oops'));
    const c1 = practiceOf(days[1])[0];
    await practiceExamOf(pg, c1); await answerQid(pg, c1, false);
    ok((await logRaw(pg)) === '{oops' && (await pg.evaluate(k => !!wrongList[k], c1)), `[E9] unreadable log: wrong answer on ${c1} → wrong list updated, log left as is`);
    await pg.evaluate(() => localStorage.removeItem('lifeuk.studyPlanProgress'));
    // E10 the log write throws (quota): answer flow continues, wrong list + streak still written
    await pg.evaluate(() => { window.__throwKey = 'lifeuk.studyPlanProgress'; });
    const c2 = practiceOf(days[1])[1];
    await practiceExamOf(pg, c2); await answerQid(pg, c2, false);
    const e10 = await pg.evaluate(k => ({ wrong: !!wrongList[k], streak: JSON.parse(localStorage.getItem('lifeuk.practiceStreak') || '{}')[k], revealed: state.current in state.revealed }), c2);
    await pg.evaluate(() => { window.__throwKey = null; });
    ok(e10.wrong && e10.revealed, `[E10] log write throws QuotaExceededError → answer revealed, wrong list still updated ${JSON.stringify(e10)}`);
    // E11 malformed plan (valid JSON, wrong shape) → nothing written, no error
    await pg.evaluate(() => { localStorage.setItem('lifeuk.studyPlan', JSON.stringify({ v: 1, start: '2026-10-01', days: 'x', goal: {} })); localStorage.removeItem('lifeuk.studyPlanProgress'); });
    await practiceExamOf(pg, c1); await answerQid(pg, c1, true); await openExamButton(pg, 'exam', '12'); await finishByButton(pg);
    ok((await logRaw(pg)) === null, '[E11] malformed stored plan → Practice answer + Exam submit write no log');
    ok(errs.length === 0 && cons.length === 0, `[P] no page / console errors ${errs.concat(cons).join(' | ')}`);
    await ctx.close();
  } finally { server.kill(); }
}

// ── U: upgrade + mixed load ──
async function partU(b) {
  const dir = path.join(WORK, 'pr2-up'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  execSync(`git archive ${BASE} | tar -x -C "${dir}"`, { cwd: ROOT, shell: '/bin/bash' });
  const { base, server } = await startPagesServer(dir);
  const CACHE = 'lifeuk-v1.0.0';
  try {
    const ctx = await b.newContext({ viewport: { width: 320, height: 640 } });
    const pg = await ctx.newPage(); const errs = [], cons = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') cons.push(m.text()); });
    await pg.clock.setFixedTime(at(TODAY));
    await pg.goto(base); await pg.evaluate(() => navigator.serviceWorker.ready);
    await pg.evaluate(async c => { for (let i = 0; i < 75; i++) { if ((await caches.keys()).includes(c)) return; await new Promise(r => setTimeout(r, 200)); } }, CACHE);
    await pg.reload(); await pg.waitForFunction(() => !!navigator.serviceWorker.controller);
    const old = await pg.evaluate(() => ({ v: APP_VERSION, hook: /recordPlanAnswer/.test(recordPracticeAnswer.toString()) }));
    ok(old.v === '1.0.0' && !old.hook, `[U] base v1.0.0 controlling, recordPracticeAnswer has no plan hook ${JSON.stringify(old)}`);
    // a plan exists already (seeded on the old version, e.g. by a test), then deploy the PR tree
    const days = await seed(pg, TODAY);
    fs.readdirSync(dir).forEach(f => fs.rmSync(path.join(dir, f), { recursive: true, force: true }));
    appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true }));
    const up = await pg.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration();
      for (let i = 0; i < 100; i++) { const ch = await caches.open('lifeuk-v1.0.0'); const r = await ch.match(new URL('js/domain/mastery.js', location.href).href);
        const txt = r ? await r.text() : ''; if (/recordPlanAnswer/.test(txt) && !reg.installing && !reg.waiting) return true;
        if (!reg.installing && !reg.waiting) await reg.update().catch(() => {}); await new Promise(r => setTimeout(r, 200)); } return false; });
    ok(up, '[U] new SW (config.js bytes changed) refilled lifeuk-v1.0.0 with the PR mastery.js');
    await pg.reload(); await settle(pg, 400);
    ok(await pg.evaluate(() => /recordPlanAnswer/.test(recordPracticeAnswer.toString()) && typeof isPlanExam === 'function'), '[U] reload: PR code served from cache');
    const q = practiceOf(days[0])[0];
    await practiceExamOf(pg, q); await answerQid(pg, q, true);
    ok((await dayLog(pg, TODAY)).ok[q] === 1, `[U] after upgrade: Practice click right on today task ${q} → today ok (plan from before the upgrade)`);
    await openExamButton(pg, 'exam', '2'); await finishByButton(pg);
    ok((await screen(pg)) === 'screenResult', '[U] after upgrade: Exam submit → results');
    ok(errs.length === 0 && cons.length === 0, `[U] no page / console errors ${errs.concat(cons).join(' | ')}`);
    await ctx.close();
  } finally { server.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
  // mixed load: PR tree but base index.html + base planProgress.js (an old cached copy of the PR1 service)
  const mix = path.join(WORK, 'pr2-mixed'); fs.rmSync(mix, { recursive: true, force: true }); fs.mkdirSync(mix, { recursive: true });
  appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(mix, f), { recursive: true }));
  fs.writeFileSync(path.join(mix, 'index.html'), execSync(`git show ${BASE}:index.html`, { cwd: ROOT }));
  fs.writeFileSync(path.join(mix, 'js/domain/planProgress.js'), execSync(`git show ${BASE}:js/domain/planProgress.js`, { cwd: ROOT }));
  const s2 = await startPagesServer(mix);
  try {
    const ctx = await b.newContext({ viewport: { width: 320, height: 640 }, serviceWorkers: 'block' });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.clock.setFixedTime(at(TODAY));
    await pg.goto(s2.base); await settle(pg, 300);
    await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); });
    await openExamButton(pg, 'practice', '4'); for (let i = 0; i < 4; i++) { await goTo(pg, i); await clickAnswer(pg, i % 2 === 0); }
    await openExamButton(pg, 'exam', '2'); await finishByButton(pg);
    const noPlanOk = errs.length === 0 && (await screen(pg)) === 'screenResult';
    const days = await seed(pg, TODAY); const q = practiceOf(days[0])[0];
    await practiceExamOf(pg, q); await answerQid(pg, q, true);
    ok(noPlanOk && errs.length === 0 && (await dayLog(pg, TODAY)).ok[q] === 1, `[U] mixed load (base index.html + base planProgress.js + PR screens): practice + exam submit, then with a plan a right answer logs; no error ${errs.join(' | ')}`);
    await ctx.close();
  } finally { s2.server.kill(); fs.rmSync(mix, { recursive: true, force: true }); }
}

(async () => {
  fs.mkdirSync(WORK, { recursive: true });
  const b = await chromium.launch(launchOpts);
  const only = process.env.QA_ONLY || 'NPU';
  try {
    if (only.includes('N')) await partN(b);
    if (only.includes('P')) await partP(b);
    if (only.includes('U')) await partU(b);
  } catch (e) { fail++; console.log('FAIL: exception', e.stack); }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
