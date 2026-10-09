// ════════════════════════════════════════
// STUDY PLAN · RUNNER (PR6a; handoff §2.5, arch §E.1 / §E.4; mockup study-plan-flow.html#runner): a question task
// (practise / drill / clear wrong answers) runs as a plan side session on the Practice screen itself (screenQuiz:
// dots, question card, options, answer box, Prev / Next — no answering markup of its own). Rounds of at most
// PRACTICE_ROUND_MAX: unanswered first (ones passed over come back later), then the wrong ones again, the same day,
// until right (only right answers count). A finished task shows its Result card (#screenPlanRun, .result-card
// classes); a finished task opened again is review mode (G17): correct answers shown, "✗ you got this wrong",
// nothing recorded. PR6b (arch §E.2 / §E.3 / §E.5): reading = the Study fact card, facts behind wrong answers = the
// Similar panel, one fact at a time with Prev / Next on #screenPlanRun (reading itself counts for nothing, G3: a fact's
// "▶ Practise" runs its questions for the plan day); a mock = Exam mode itself, the result page's #resultPlanRow (G10 / G11).
// ════════════════════════════════════════
const PLAN_RUN_TYPES = [PLAN_TASK.practice, PLAN_TASK.drill, PLAN_TASK.review];
const PLAN_FACT_TYPES = [PLAN_TASK.read, PLAN_TASK.wrongFacts];
const PLAN_RUN_SYMBOL = { next: '→', finish: '✓' };
const PLAN_RUN_VIEW = { done: 'done', facts: 'facts' };
const PLAN_RUN_BADGE_KEYS = { [PLAN_TASK.read]: 'home.modeStudy', [PLAN_TASK.mock]: 'common.exam' }; // others: Practice
let planRunView = null; // #screenPlanRun: { kind, date, taskIndex, from } (+ facts: pos, review)
let planMockRun = null; // the plan mock exam running or just submitted: { date, taskIndex, from }

// ── context: the task as stored, its day's log; null when the plan, the day or the task is gone ──
// fact: a fact task narrowed to that one fact (its "▶ Practise" session); whole = the task as stored
function planRunContext(date, taskIndex, fact = null) {
  const plan = planLoad();
  const day = plan && planDayAt(plan, date);
  const whole = day && day.tasks[taskIndex];
  const log = whole ? planLoadLogView() : null; // unreadable log: nothing would be recorded, so nothing runs
  if (!log) return null;
  const task = fact === null ? whole : { ...whole, facts: [fact] };
  return { plan, day, task, whole, log, dayLog: planDayLog(log, date) };
}
function planRunnable(task) {
  if (task.type === PLAN_TASK.mock) return 'exam' in task;
  return [...PLAN_RUN_TYPES, ...PLAN_FACT_TYPES].includes(task.type) && planTaskQids(task).length > 0;
}
// a finished task can always be reviewed; otherwise the day screen's rules (G8 / G16 / G23) decide
function planRunAllowed(ctx, date) {
  const p = planTaskProgress(ctx.task, ctx.dayLog);
  if (p.complete) return true;
  const todayIso = planTodayIso();
  return planStatus(ctx.plan, todayIso) === PLAN_STATUS.active && planCanStart(ctx.task, p, planWhen(date, todayIso));
}

// ── entry: a task box, Home "Continue", the Result card's "Start next"; from = the day screen to go back to ──
// date = the day the answers count for (G5: a past day = catch-up, a day ahead = early); from null = today's list
function planOpenTask(date, taskIndex, from = null) {
  if (!planVisible()) return;
  from = from || planTodayIso(); // QA O-2: the list it came from stays that day, even after midnight
  const ctx = planRunContext(date, taskIndex);
  if (!ctx || !planRunnable(ctx.task) || !planRunAllowed(ctx, date)) { openPlanDay(from); return; }
  const done = planTaskProgress(ctx.task, ctx.dayLog).complete, at = { date, taskIndex, from };
  if (ctx.task.type === PLAN_TASK.mock) { if (done) planShowTaskDone(date, taskIndex, from); else startPlanMock(at); }
  else if (PLAN_FACT_TYPES.includes(ctx.task.type)) planShowFacts(at, done ? 0 : planFirstOpenFact(ctx), done);
  else if (done) planStartReview(date, taskIndex, from, 0);
  else planStartRound(date, taskIndex, from, []);
}
function planContinue() {
  const plan = ensurePlanToday();
  const log = plan && planLoadLogView();
  const next = log ? planNextStep(plan, log, planTodayIso()) : { kind: PLAN_NEXT.done };
  if (next.kind === PLAN_NEXT.done) openPlanDay();
  else planOpenTask(next.date, next.taskIndex);
}
function planRunReturn(ctx, date, taskIndex, from) {
  return { kind: SESSION_RETURN_KIND.plan, date, taskIndex, type: ctx.task.type, ch: ctx.task.ch || null, from, fact: null };
}
// part: {} = the whole task; { fact, pos } = one fact of a fact task, back to that card when done
const planRunPart = ret => (ret.fact === null || ret.fact === undefined ? {} : { fact: ret.fact, pos: ret.pos });
// skipped: this round's unanswered questions, asked after the other unanswered ones; prev: the round just done
// ({ round, rounds }). CUI-0024: on entry the round number comes from the questions already answered (any = at least
// one round begun), and N = the rounds behind + the rounds the questions not yet right still need, so the last is N of N
function planStartRound(date, taskIndex, from, skipped, prev = null, part = {}) {
  const ctx = planRunContext(date, taskIndex, part.fact === undefined ? null : part.fact);
  if (!ctx) { openPlanDay(from); return; }
  const qids = planNextRound(ctx.task, ctx.dayLog, skipped);
  if (!qids.length) { planRoundsDone({ date, taskIndex, from }, ctx, part); return; }
  const all = planAskableQids(ctx.task, ctx.dayLog); // W-038: rounds of the questions actually asked
  const seen = all.filter(k => ctx.dayLog.ok[k] || ctx.dayLog.bad[k]).length;
  const left = all.filter(k => !ctx.dayLog.ok[k]).length;
  const after = prev && prev.round > 0;
  const n = after ? prev.round + 1 : (seen ? Math.ceil(seen / PRACTICE_ROUND_MAX) + 1 : 1);
  const rounds = Math.max(after ? prev.rounds : 0, n - 1 + Math.ceil(left / PRACTICE_ROUND_MAX));
  const ret = { ...planRunReturn(ctx, date, taskIndex, from), ...part, retry: qids.filter(k => ctx.dayLog.bad[k]), round: n, rounds };
  startSideSession(PLAN_PREFIX + planDayNumber(ctx.plan, date), qids.map(questionByKey).map(toQuestionItem), ret);
}
// nothing left to ask: the Result card, or (one fact practised while the task is not done) back to that fact's card
function planRoundsDone(at, ctx, part) {
  if (part.fact === undefined || planTaskProgress(ctx.whole, ctx.dayLog).complete) planShowTaskDone(at.date, at.taskIndex, at.from);
  else planShowFacts(at, part.pos, false);
}
// G17: every question of the task, a page of PRACTICE_ROUND_MAX at a time, answered and revealed (planFillReview)
function planStartReview(date, taskIndex, from, page) {
  const ctx = planRunContext(date, taskIndex);
  if (!ctx) { openPlanDay(from); return; }
  const all = planTaskQids(ctx.task);
  const qids = all.slice(page * PRACTICE_ROUND_MAX, (page + 1) * PRACTICE_ROUND_MAX);
  const ret = { ...planRunReturn(ctx, date, taskIndex, from), review: true, page,
    pages: Math.ceil(all.length / PRACTICE_ROUND_MAX), wrong: qids.filter(k => ctx.dayLog.bad[k]) };
  startSideSession(PLAN_PREFIX + planDayNumber(ctx.plan, date), qids.map(questionByKey).map(toQuestionItem), ret);
}
function isPlanReviewMode() { return isPlanSession() && sessionReturn.review === true; }
// called by startSideSession before the first render: the correct options picked, every question revealed, so
// selectOption / Translate do nothing and nothing is recorded; revealed false = answered wrong that day (red dot)
function planFillReview(ret) {
  state.questions.forEach((q, i) => {
    state.answers[i] = [...q.a];
    state.revealed[i] = !ret.wrong.includes(qKey(q));
  });
}
function planReviewWasWrong(idx) { return state.revealed[idx] === false; }

// ── the Practice screen in a plan session: header, notes, last question's button ──
function planRunLabel({ type, ch, exam }) {
  if (type === PLAN_TASK.review) return t('common.wrongSet');
  if (type === PLAN_TASK.wrongFacts) return t('plan.run.wrongFactsLabel');
  if (type === PLAN_TASK.mock) return t('common.examN', { n: exam });
  return t('common.chapterN', { n: ch });
}
function planRunBackHtml(from) {
  if (!from || from === planTodayIso()) return escapeHtml(t('plan.run.backToday'));
  const plan = planLoad();
  if (!plan) return escapeHtml(t('plan.run.backToday'));
  return t('plan.run.backDayHtml', { day: `<span lang="en">${t('plan.dayN', { n: planDayNumber(plan, from) })}</span>` });
}
// the quiz header's ← Home reads "← Today's tasks" in a plan session or mock (goHome goes back to the day there);
// a fact's session is named like the Study one ("Fact Ch c #n", setExamLabel)
function renderPlanQuizHeader() {
  const back = byId('screenQuiz').querySelector('.back-btn');
  const session = isPlanSession(), plan = session || isPlanMock();
  back.classList.toggle('plan-hit', plan);
  if (plan) back.innerHTML = planRunBackHtml((session ? sessionReturn : planMockRun).from);
  else back.textContent = t('common.home');
  if (!session) return;
  if (planRunPart(sessionReturn).fact !== undefined) setExamLabel(byId('quizLabel'), FACT_PREFIX + sessionReturn.fact);
  else byId('quizLabel').textContent = planRunLabel(sessionReturn);
}
function planRetryLeftNow(ret) {
  const ctx = planRunContext(ret.date, ret.taskIndex, ret.fact);
  return ctx ? planRetryLeft(ctx.task, ctx.dayLog) : 0;
}
// above the card: review mode says so; a question answered wrong before says how many are left; else Round n of N
function renderPlanRunNotes() {
  const note = byId('planRunNote'), pair = byId('planPairNote');
  if (!note || !pair) return; // a pre-PR6a shell (no plan session can start there)
  const ret = sessionReturn, plan = isPlanSession(), review = isPlanReviewMode();
  note.hidden = !review;
  if (review) note.textContent = t('plan.run.reviewNote');
  pair.hidden = !plan || review || !planRunHasPair(ret);
  if (!pair.hidden) pair.textContent = t('plan.run.pairNote');
  if (!plan) return;
  const text = review ? '' : planRoundText(ret);
  setShown('roundRow', !!text);
  byId('roundNote').textContent = text;
}
function planRoundText(ret) {
  if ((ret.retry || []).includes(qKey(state.questions[state.current]))) return t('plan.run.retryWrong', { n: planRetryLeftNow(ret) });
  return ret.rounds > 1 ? t('plan.run.roundOf', { n: ret.round, rounds: ret.rounds }) : '';
}
// a practice task whose questions also finish a reading task of the same day (G3)
function planRunHasPair(ret) {
  if (!ret || ret.type !== PLAN_TASK.practice) return false;
  const ctx = planRunContext(ret.date, ret.taskIndex);
  return !!ctx && ctx.day.tasks.some(t => t.type === PLAN_TASK.read && t.pair === ret.taskIndex);
}
// QA O-3: the quick button's title / aria-label is plain words (the bottom button keeps its → / ✓ / 🔁)
function planAction(labelText, symbol, run, titleText) { return { label: labelText, symbol, title: titleText, run }; }
// last question of a round: next round (unanswered left), redo the wrong ones (n left), or finish → Result card
function planNextAction() {
  const ret = sessionReturn;
  if (ret.review) return planReviewNextAction(ret);
  const skipped = state.questions.filter((_, i) => !(i in state.revealed)).map(qKey);
  const run = () => planStartRound(ret.date, ret.taskIndex, ret.from, skipped, { round: ret.round, rounds: ret.rounds }, planRunPart(ret));
  const ctx = planRunContext(ret.date, ret.taskIndex, ret.fact);
  const next = ctx ? planNextRound(ctx.task, ctx.dayLog, skipped) : [];
  if (!next.length) return planAction(t('quiz.finishButton'), PLAN_RUN_SYMBOL.finish, run, t('quiz.finish'));
  if (next.some(k => !ctx.dayLog.bad[k])) return planAction(t('plan.run.nextRound'), PLAN_RUN_SYMBOL.next, run, t('plan.run.nextRoundTitle'));
  const n = planRetryLeft(ctx.task, ctx.dayLog);
  return planAction(t('plan.run.retryWrong', { n }), PLAN_RUN_SYMBOL.next, run, t('plan.run.retryWrongTitle', { n }));
}
function planReviewNextAction(ret) {
  if (ret.page < ret.pages - 1) {
    return planAction(t('quiz.nextButton'), PLAN_RUN_SYMBOL.next, () => planStartReview(ret.date, ret.taskIndex, ret.from, ret.page + 1), t('quiz.next'));
  }
  return planAction(t('quiz.finishButton'), PLAN_RUN_SYMBOL.finish, () => planBackToDay(), t('quiz.finish'));
}
// ← (quiz header in a plan session, Result card header, "Back to the task list"): the day screen it came from,
// focus on the task's box when it is listed there
function planBackToDay() {
  const ret = isPlanSession() ? sessionReturn : planRunView || planMockRun;
  clearSideSession();
  planRunView = null;
  planMockRun = null;
  if (!planVisible()) { leaveToHome(); return; }
  openPlanDay(ret ? ret.from : null);
  const box = ret && document.querySelector(`#planTaskList [data-arg="${ret.date}"][data-task="${ret.taskIndex}"]`);
  if (box) box.focus();
}
// switching the feature off (G15) from the Practice screen leaves a plan session too, and a timed plan mock unsubmitted
function isOnPlanSession() { return (isPlanSession() || isPlanMock()) && byId('screenQuiz').classList.contains('active'); }

// ── Result card (#screenPlanRun) ──
function planShowTaskDone(date, taskIndex, from) {
  clearSideSession();
  planRunView = { kind: PLAN_RUN_VIEW.done, date, taskIndex, from };
  showScreen('screenPlanRun');
  window.scrollTo(0, 0);
  renderPlanRun();
  // S-121: the last question's button is gone with screenQuiz; focus goes to the result line (as the day heading)
  const result = document.querySelector('#planRunBody .result-label');
  if (result) result.focus({ preventScroll: true });
}
// the day screen's list: the day's own tasks, plus the carry-over on today (G8); { date, taskIndex, task, dayLog }
function planRunList(plan, log, viewIso, todayIso) {
  const day = planDayAt(plan, viewIso);
  const own = planVisibleTasks(day, todayIso).map(task => ({ date: viewIso, taskIndex: day.tasks.indexOf(task), task }));
  const carry = viewIso === todayIso ? planCarryTasks(plan, log, todayIso) : [];
  return [...own, ...carry].map(it => ({ ...it, dayLog: planDayLog(log, it.date) }));
}
function planRunNext(list, todayIso) {
  return list.find(it => {
    const p = planTaskProgress(it.task, it.dayLog);
    return !p.complete && planCanStart(it.task, p, planWhen(it.date, todayIso));
  }) || null;
}
// W-032: redrawn in place (Prev / Next, a bookmark, a language switch): focus goes back to the same control
function renderPlanRun() {
  const view = planRunView, ctx = view && planRunContext(view.date, view.taskIndex);
  if (!ctx) { planBackToDay(); return; }
  const focusKey = planRunFocusKey();
  byId('planRunBack').innerHTML = planRunBackHtml(view.from);
  byId('planRunLabel').textContent = planRunLabel(ctx.task);
  const badgeKey = PLAN_RUN_BADGE_KEYS[ctx.task.type] || 'common.practice';
  byId('planRunBadge').textContent = t(badgeKey);
  if (view.kind === PLAN_RUN_VIEW.facts) renderPlanFacts(view, ctx); else renderPlanDone(view, ctx);
  planRunRestoreFocus(focusKey);
}
function renderPlanDone(view, ctx) {
  const todayIso = planTodayIso(), viewIso = view.from || todayIso;
  const list = planRunList(ctx.plan, ctx.log, viewIso, todayIso);
  const next = planRunNext(list, todayIso);
  const pct = planDayCompletion(planDayAt(ctx.plan, viewIso), planDayLog(ctx.log, viewIso)).pct;
  byId('planRunBody').innerHTML = planDoneCardHtml(ctx, viewIso === todayIso, next, pct)
    + planDonePairHtml(ctx, view.taskIndex) + planDoneNextHtml(ctx.plan, next) + planDoneActsHtml(view, next, ctx.task.type);
}
function planRunFocusKey() {
  const el = document.activeElement;
  if (!el || !byId('planRunBody').contains(el) || !el.dataset.action) return null;
  const attr = name => (el.dataset[name] === undefined ? '' : `[data-${name}="${el.dataset[name]}"]`);
  return `[data-action="${el.dataset.action}"]${attr('arg')}${attr('mark')}`;
}
// the control gone or disabled (the first / last fact): the nav-row's main (last) button, else any enabled one —
// two queries, as a selector list would return "← Prev" first in document order (W-043)
function planRunRestoreFocus(key) {
  if (!key) return;
  const body = byId('planRunBody'), el = body.querySelector(key);
  const target = el && !el.disabled ? el : body.querySelector('.plan-run-nav .nav-btn:not([disabled]):last-child')
    || body.querySelector('.plan-run-nav .nav-btn:not([disabled])');
  if (target) target.focus({ preventScroll: true });
}
function planDoneCardHtml(ctx, isToday, next, pct) {
  const all = !next && pct === PERCENT;
  const doneKey = isToday ? 'plan.run.doneToday' : 'plan.run.doneDay';
  const allKey = isToday ? 'plan.run.allDoneToday' : 'plan.run.allDoneDayHtml';
  const subKey = isToday ? 'plan.run.allSubToday' : 'plan.run.allSubDay';
  const labelKey = all ? allKey : doneKey;
  const subText = all ? t(subKey) : planDoneSummary(ctx);
  const day = `<span lang="en">${t('plan.dayN', { n: planDayNumber(ctx.plan, ctx.day.date) })}</span>`;
  return `<div class="result-card"><div class="result-emoji" aria-hidden="true">${all ? '🎉' : '✅'}</div>`
    + `<div class="result-score plan-num" id="planRunScore">${pct}<span>%</span></div>`
    // S-121: focus lands on the result line; it is described by the % and the summary, so both are read out
    + `<div class="result-label${all ? ' pass' : ''}" tabindex="-1" aria-describedby="planRunScore planRunSub">${t(labelKey, { day })}</div>`
    + `<div class="result-sub" id="planRunSub">${subText}</div></div>`;
}
// "n questions all right, k of them wrong at first and redone right" (the day's wrong answers on this task);
// a mock: passed + best score (G25)
function planDoneSummary(ctx) {
  const p = planTaskProgress(ctx.task, ctx.dayLog);
  if (ctx.task.type === PLAN_TASK.mock) return t('plan.task.mockPassed', { best: p.best, n: REAL_TEST_SIZE });
  const qids = planTaskQids(ctx.task);
  const n = Array.isArray(ctx.task.qids) ? qids.length - p.mastered : planAskableQids(ctx.task, ctx.dayLog).length; // G37: 🏆 ones were not asked
  const redone = qids.filter(k => ctx.dayLog.bad[k]).length;
  return redone ? t('plan.run.sumRedone', { n, k: redone }) : t('plan.run.sumFirst', { n });
}
// G3: practising a reading task's questions finishes the reading too
function planDonePairHtml(ctx, taskIndex) {
  const read = ctx.day.tasks.find(t => t.type === PLAN_TASK.read && t.pair === taskIndex);
  if (!read || !planTaskProgress(read, ctx.dayLog).complete) return '';
  return `<p class="plan-note">${t('plan.run.donePairHtml', { task: planTaskText(read, ctx.day, { fullCh: true }) })}</p>`;
}
function planDoneNextHtml(plan, next) {
  if (!next) return '';
  const day = planDayAt(plan, next.date);
  const p = planTaskProgress(next.task, next.dayLog);
  return `<div class="plan-card-box plan-run-next"><span class="section-title">${t('plan.run.next')}</span>`
    + `<b><span aria-hidden="true">${PLAN_TASK_ICONS[next.task.type]}</span> ${planTaskText(next.task, day, { fullCh: true })}</b>`
    + `<span class="plan-muted">${planTaskStatusHtml(next.task, p, next.dayLog)}</span></div>`;
}
// a mock has nothing to review (its answers live on the result page only)
function planDoneActsHtml(view, next, type) {
  const review = type === PLAN_TASK.mock ? ''
    : `<button type="button" class="nav-btn secondary plan-hit" data-action="planReviewTask">${t('plan.run.reviewThis')}</button>`;
  const go = next
    ? `<button type="button" class="nav-btn plan-hit" data-action="planOpenTask" data-arg="${next.date}" data-task="${next.taskIndex}"`
      + ` data-from="${view.from || ''}">${t('plan.run.startNext')}</button>`
    : `<button type="button" class="nav-btn plan-hit" data-action="planBackToDay">${t('plan.run.backToList')}</button>`;
  return `<div class="nav-row">${review}${go}</div>`;
}
function planReviewTask() {
  if (!planRunView) return;
  const { date, taskIndex, from } = planRunView, ctx = planRunContext(date, taskIndex);
  planRunView = null;
  if (ctx && PLAN_FACT_TYPES.includes(ctx.task.type)) planShowFacts({ date, taskIndex, from }, 0, true);
  else planStartReview(date, taskIndex, from, 0);
}

// ── reading / facts behind wrong answers (#screenPlanRun, arch §E.2 / §E.3): one fact at a time, Prev / Next ──
// at = { date, taskIndex, from }; review (G17): a finished task, browsed with nothing to practise
function planShowFacts(at, pos, review) {
  clearSideSession();
  planRunView = { kind: PLAN_RUN_VIEW.facts, ...at, pos, review };
  showScreen('screenPlanRun');
  window.scrollTo(0, 0);
  renderPlanRun();
}
function planFirstOpenFact(ctx) {
  const m = planTaskMastered(ctx.task, ctx.dayLog);
  return Math.max(0, ctx.task.facts.findIndex(id => !planFactDone(id, ctx.dayLog, m)));
}
function renderPlanFacts(view, ctx) {
  view.pos = Math.min(Math.max(0, view.pos), ctx.task.facts.length - 1);
  const f = planFactById(ctx.task.facts[view.pos]);
  const note = view.review ? `<p class="plan-note" role="status">${t('plan.run.reviewNote')}</p>` : '';
  const body = byId('planRunBody');
  body.innerHTML = note + planFactMetaHtml(ctx, view.pos) + planFactCardHtml(ctx, f, view.review) + planFactNavHtml(view, ctx);
  body.querySelectorAll('.plan-run-meter i').forEach(el => { el.style.width = el.dataset.pct + '%'; }); // as #progressFill
}
function planFactMetaHtml(ctx, pos) {
  const total = ctx.task.facts.length, pct = percent(pos + 1, total);
  return `<div class="plan-run-head"><div class="plan-run-meta"><span>${planTaskText(ctx.task, ctx.day, { fullCh: true })}</span>`
    + `<span class="plan-num">${t('plan.run.factOf', { n: pos + 1, total })}</span></div>`
    + `<div class="plan-meter plan-run-meter" aria-hidden="true"><i class="plan-meter-fill h${planPctBand(pct)}" data-pct="${pct}"></i></div></div>`;
}
// the questions a fact still asks today (none once its questions are right, or in review)
function planFactLeft(ctx, id, review) { return review ? [] : planNextRound({ ...ctx.task, facts: [id] }, ctx.dayLog); }
// reading: the Study card (Study marks); wrong facts: the Similar panel, the wrong answer as the current node.
// Either's "▶ Practise" runs the fact's questions for the plan day (G26: never a Similar / Study session of its own)
function planFactCardHtml(ctx, f, review) {
  const n = planFactLeft(ctx, f.id, review).length;
  const practise = n ? { action: 'planPractiseFact', arg: f.id, n } : false;
  if (ctx.task.type === PLAN_TASK.read) return factCardHtml(f, { variant: FACT_VARIANT.full, marks: factMarks(f), opts: { practise } });
  const anchor = questionByKey((ctx.task.anchor || {})[f.id] || planFactQids(f)[0]);
  return `<div class="sqm show">${similarPanelHtml(anchor, similarKeys(anchor), { practise: !!practise, cta: practise || null, currentMark: t('plan.run.youGotWrong') })}</div>`;
}
function planFactNavHtml(view, ctx) {
  const last = view.pos >= ctx.task.facts.length - 1;
  const prev = `<button type="button" class="nav-btn secondary" data-action="planStepFact" data-arg="-1"${view.pos ? '' : ' disabled'}>${t('plan.run.prevFact')}</button>`;
  const next = last ? planFactLastHtml(view, ctx) : `<button type="button" class="nav-btn" data-action="planStepFact" data-arg="1">${t('plan.run.nextFact')}</button>`;
  return `<div class="nav-row plan-run-nav">${prev}${next}</div>`;
}
// last fact: reading → its paired practice task (G3); wrong facts → what is left of the task; review / nothing left → back
function planFactLastHtml(view, ctx) {
  const read = ctx.task.type === PLAN_TASK.read, task = read ? ctx.day.tasks[ctx.task.pair] : ctx.task;
  const n = view.review ? 0 : planAskableQids(task, ctx.dayLog).filter(k => !ctx.dayLog.ok[k]).length;
  if (!n) return `<button type="button" class="nav-btn" data-action="planBackToDay">${t('quiz.finishButton')}</button>`;
  const label = t('plan.run.practiseN', { n });
  if (!read) return `<button type="button" class="nav-btn" data-action="planPractiseTask">${label}</button>`;
  return `<button type="button" class="nav-btn" data-action="planOpenTask" data-arg="${view.date}" data-task="${ctx.task.pair}"`
    + ` data-from="${view.from || ''}">${label}</button>`;
}
function planIsFactsView() { return !!planRunView && planRunView.kind === PLAN_RUN_VIEW.facts; }
function planStepFact(step) {
  if (!planIsFactsView()) return;
  planRunView.pos += step;
  renderPlanRun();
  window.scrollTo(0, 0);
}
function planPractiseFact(factId) {
  if (!planIsFactsView()) return;
  const { date, taskIndex, from, pos } = planRunView;
  planStartRound(date, taskIndex, from, [], null, { fact: factId, pos });
}
function planPractiseTask() {
  if (!planIsFactsView()) return;
  const { date, taskIndex, from } = planRunView;
  planStartRound(date, taskIndex, from, []);
}

// ── mock exam (arch §E.5, G10 / G11 / G15 / G32): Exam mode itself, whatever Home's mode (pendingMode untouched) ──
function isPlanMock() { return planMockRun !== null && !!state.planDay && state.mode === EXAM_MODE && !isSideSession(); }
// G11: a slot whose own exam was just failed is retaken as a Random Exam (planMockRetake, W-044)
function startPlanMock(at) {
  const ctx = planRunContext(at.date, at.taskIndex);
  if (!ctx) { openPlanDay(at.from); return; }
  planStartMockExam(at, planMockRetake(ctx.dayLog, ctx.task.slot) ? ALL_EXAM : ctx.task.exam);
}
function planStartMockExam(at, examNum) {
  clearSideSession();
  planRunView = null;
  startExam(examNum, EXAM_MODE);
  state.planDay = at.date; // after startExam, which clears it (arch §D)
  planMockRun = { date: at.date, taskIndex: at.taskIndex, from: at.from, recorded: null }; // recorded: planNoteMockRecorded
  renderPlanQuizHeader();
}
// result page "Retake" and Retry (retryExam): a Random Exam in Exam mode; with the feature off, an ordinary retry
function planRetryMock() {
  if (!isPlanMock()) return;
  if (planVisible()) { planStartMockExam(planMockRun, ALL_EXAM); return; }
  planMockRun = null;
  startExam(state.examNum, EXAM_MODE);
}
// G15: Leave = not submitted; back to the day the mock was opened from
function planLeaveMock() {
  stopExamTimer();
  planBackToDay();
}
// S-131: the day the submitted plan mock was written to (null = not recorded, e.g. submitted after midnight)
function planNoteMockRecorded(iso) { if (planMockRun) planMockRun.recorded = iso; }
// #resultPlanRow under the score (hidden unless a plan mock was just submitted): passed = the task is done (G10),
// not passed = retake as a Random Exam the same day (G11)
function renderResultPlanRow() {
  const row = byId('resultPlanRow');
  if (!row) return; // a pre-PR6b shell
  row.hidden = !(planVisible() && isPlanMock());
  row.innerHTML = row.hidden ? '' : planResultRowHtml(reviewItems.filter(r => r.isCorrect).length, reviewItems.length);
}
function planResultRowHtml(correct, total) {
  const back = (cls = '') => `<button type="button" class="nav-btn${cls} plan-hit" data-action="planBackToDay">${t('plan.run.backToList')}</button>`;
  // S-131: the row follows the log: an attempt not recorded is neither "task done" nor worth a retake that day
  if (!planMockRun.recorded) return `<p class="plan-note warn" role="status">${t('plan.run.mockNotCounted')}</p><div class="nav-row">${back()}</div>`;
  const passed = planMockPassed({ correct, total });
  const note = passed ? t('plan.run.mockPassNote') : t('plan.run.mockFailNote', { pass: PASS_MARK, n: REAL_TEST_SIZE });
  const retake = passed ? ''
    : `<button type="button" class="nav-btn plan-hit" data-action="planRetryMock">${t('plan.run.mockRetake', { exam: t('common.randomExam') })}</button>`;
  return `<p class="plan-note${passed ? '' : ' warn'}" role="status">${note}</p><div class="nav-row">${retake}${back(passed ? '' : ' secondary')}</div>`;
}
