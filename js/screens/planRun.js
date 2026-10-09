// ════════════════════════════════════════
// STUDY PLAN · RUNNER (PR6a; handoff §2.5, arch §E.1 / §E.4; mockup study-plan-flow.html#runner): a question task
// (practise / drill / clear wrong answers) runs as a plan side session on the Practice screen itself (screenQuiz:
// dots, question card, options, answer box, Prev / Next — no answering markup of its own). Rounds of at most
// PRACTICE_ROUND_MAX: unanswered first (ones passed over come back later), then the wrong ones again, the same day,
// until right (only right answers count). A finished task shows its Result card (#screenPlanRun, .result-card
// classes); a finished task opened again is review mode (G17): correct answers shown, "✗ you got this wrong",
// nothing recorded. Reading / wrong facts / mock exams are PR6b: their boxes stay closed (planRunnable).
// ════════════════════════════════════════
const PLAN_RUN_TYPES = [PLAN_TASK.practice, PLAN_TASK.drill, PLAN_TASK.review];
const PLAN_RUN_SYMBOL = { next: '→', finish: '✓' };
let planRunView = null; // the Result card shown: { date, taskIndex, from }

// ── context: the task as stored, its day's log; null when the plan, the day or the task is gone ──
function planRunContext(date, taskIndex) {
  const plan = planLoad();
  const day = plan && planDayAt(plan, date);
  const task = day && day.tasks[taskIndex];
  const log = task ? planLoadLogView() : null; // unreadable log: nothing would be recorded, so nothing runs
  if (!log) return null;
  return { plan, day, task, log, dayLog: planDayLog(log, date) };
}
function planRunnable(task) { return PLAN_RUN_TYPES.includes(task.type) && planTaskQids(task).length > 0; }
// a finished task can always be reviewed; otherwise the day screen's rules (G8 / G16 / G23) decide
function planRunAllowed(ctx, date) {
  const p = planTaskProgress(ctx.task, ctx.dayLog);
  if (p.complete) return true;
  const todayIso = planTodayIso();
  return planStatus(ctx.plan, todayIso) === PLAN_STATUS.active && planCanStart(ctx.task, p, planWhen(date, todayIso));
}

// ── entry: a task box, Home "Continue", the Result card's "Start next"; from = the day screen to go back to ──
// date = the day the answers count for (G5: a past day = catch-up, a day ahead = early); from null = today
function planOpenTask(date, taskIndex, from = null) {
  if (!planVisible()) return;
  const ctx = planRunContext(date, taskIndex);
  if (!ctx || !planRunnable(ctx.task) || !planRunAllowed(ctx, date)) { openPlanDay(from); return; }
  if (planTaskProgress(ctx.task, ctx.dayLog).complete) planStartReview(date, taskIndex, from, 0);
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
  return { kind: SESSION_RETURN_KIND.plan, date, taskIndex, type: ctx.task.type, ch: ctx.task.ch || null, from };
}
// skipped: this round's unanswered questions, asked after the other unanswered ones; prev: the round just done
// ({ round, rounds }). CUI-0024: on entry the round number comes from the questions already answered (any = at least
// one round begun), and N = the rounds behind + the rounds the questions not yet right still need, so the last is N of N
function planStartRound(date, taskIndex, from, skipped, prev = null) {
  const ctx = planRunContext(date, taskIndex);
  if (!ctx) { openPlanDay(from); return; }
  const qids = planNextRound(ctx.task, ctx.dayLog, skipped);
  if (!qids.length) { planShowTaskDone(date, taskIndex, from); return; }
  const all = planAskableQids(ctx.task, ctx.dayLog); // W-038: rounds of the questions actually asked
  const seen = all.filter(k => ctx.dayLog.ok[k] || ctx.dayLog.bad[k]).length;
  const left = all.filter(k => !ctx.dayLog.ok[k]).length;
  const after = prev && prev.round > 0;
  const n = after ? prev.round + 1 : (seen ? Math.ceil(seen / PRACTICE_ROUND_MAX) + 1 : 1);
  const rounds = Math.max(after ? prev.rounds : 0, n - 1 + Math.ceil(left / PRACTICE_ROUND_MAX));
  const ret = { ...planRunReturn(ctx, date, taskIndex, from), retry: qids.filter(k => ctx.dayLog.bad[k]), round: n, rounds };
  startSideSession(PLAN_PREFIX + planDayNumber(ctx.plan, date), qids.map(questionByKey).map(toQuestionItem), ret);
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
function planRunLabel(type, ch) {
  return type === PLAN_TASK.review ? t('common.wrongSet') : t('common.chapterN', { n: ch });
}
function planRunBackHtml(from) {
  if (!from || from === planTodayIso()) return escapeHtml(t('plan.run.backToday'));
  const plan = planLoad();
  if (!plan) return escapeHtml(t('plan.run.backToday'));
  return t('plan.run.backDayHtml', { day: `<span lang="en">${t('plan.dayN', { n: planDayNumber(plan, from) })}</span>` });
}
// the quiz header's ← Home reads "← Today's tasks" in a plan session (goHome goes back to the day there)
function renderPlanQuizHeader() {
  const back = byId('screenQuiz').querySelector('.back-btn');
  const plan = isPlanSession();
  back.classList.toggle('plan-hit', plan);
  if (plan) back.innerHTML = planRunBackHtml(sessionReturn.from);
  else back.textContent = t('common.home');
  if (plan) byId('quizLabel').textContent = planRunLabel(sessionReturn.type, sessionReturn.ch);
}
function planRetryLeftNow(ret) {
  const ctx = planRunContext(ret.date, ret.taskIndex);
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
function planAction(labelText, symbol, run) { return { label: labelText, symbol, title: labelText, run }; }
// last question of a round: next round (unanswered left), redo the wrong ones (n left), or finish → Result card
function planNextAction() {
  const ret = sessionReturn;
  if (ret.review) return planReviewNextAction(ret);
  const skipped = state.questions.filter((_, i) => !(i in state.revealed)).map(qKey);
  const run = () => planStartRound(ret.date, ret.taskIndex, ret.from, skipped, { round: ret.round, rounds: ret.rounds });
  const ctx = planRunContext(ret.date, ret.taskIndex);
  const next = ctx ? planNextRound(ctx.task, ctx.dayLog, skipped) : [];
  if (!next.length) return planAction(t('quiz.finishButton'), PLAN_RUN_SYMBOL.finish, run);
  if (next.some(k => !ctx.dayLog.bad[k])) return planAction(t('plan.run.nextRound'), PLAN_RUN_SYMBOL.next, run);
  return planAction(t('plan.run.retryWrong', { n: planRetryLeft(ctx.task, ctx.dayLog) }), PLAN_RUN_SYMBOL.next, run);
}
function planReviewNextAction(ret) {
  if (ret.page < ret.pages - 1) {
    return planAction(t('quiz.nextButton'), PLAN_RUN_SYMBOL.next, () => planStartReview(ret.date, ret.taskIndex, ret.from, ret.page + 1));
  }
  return planAction(t('quiz.finishButton'), PLAN_RUN_SYMBOL.finish, () => planBackToDay());
}
// ← (quiz header in a plan session, Result card header, "Back to the task list"): the day screen it came from,
// focus on the task's box when it is listed there
function planBackToDay() {
  const ret = isPlanSession() ? sessionReturn : planRunView;
  clearSideSession();
  planRunView = null;
  if (!planVisible()) { leaveToHome(); return; }
  openPlanDay(ret ? ret.from : null);
  const box = ret && document.querySelector(`#planTaskList [data-arg="${ret.date}"][data-task="${ret.taskIndex}"]`);
  if (box) box.focus();
}
// switching the feature off (G15) from the Practice screen leaves a plan session too
function isOnPlanSession() { return isPlanSession() && byId('screenQuiz').classList.contains('active'); }

// ── Result card (#screenPlanRun) ──
function planShowTaskDone(date, taskIndex, from) {
  clearSideSession();
  planRunView = { date, taskIndex, from };
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
function renderPlanRun() {
  const view = planRunView, ctx = view && planRunContext(view.date, view.taskIndex);
  if (!ctx) { planBackToDay(); return; }
  const todayIso = planTodayIso(), viewIso = view.from || todayIso;
  byId('planRunBack').innerHTML = planRunBackHtml(view.from);
  byId('planRunLabel').textContent = planRunLabel(ctx.task.type, ctx.task.ch);
  byId('planRunBadge').textContent = t('common.practice');
  const list = planRunList(ctx.plan, ctx.log, viewIso, todayIso);
  const next = planRunNext(list, todayIso);
  const pct = planDayCompletion(planDayAt(ctx.plan, viewIso), planDayLog(ctx.log, viewIso)).pct;
  byId('planRunBody').innerHTML = planDoneCardHtml(ctx, viewIso === todayIso, next, pct)
    + planDonePairHtml(ctx, view.taskIndex) + planDoneNextHtml(ctx.plan, next) + planDoneActsHtml(view, next);
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
    + `<div class="result-score plan-num">${pct}<span>%</span></div>`
    + `<div class="result-label${all ? ' pass' : ''}" tabindex="-1">${t(labelKey, { day })}</div><div class="result-sub">${subText}</div></div>`;
}
// "n questions all right, k of them wrong at first and redone right" (the day's wrong answers on this task)
function planDoneSummary(ctx) {
  const qids = planTaskQids(ctx.task);
  const n = qids.length - planTaskProgress(ctx.task, ctx.dayLog).mastered; // G37: 🏆 ones were not asked
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
function planDoneActsHtml(view, next) {
  const review = `<button type="button" class="nav-btn secondary plan-hit" data-action="planReviewTask">${t('plan.run.reviewThis')}</button>`;
  const go = next
    ? `<button type="button" class="nav-btn plan-hit" data-action="planOpenTask" data-arg="${next.date}" data-task="${next.taskIndex}"`
      + ` data-from="${view.from || ''}">${t('plan.run.startNext')}</button>`
    : `<button type="button" class="nav-btn plan-hit" data-action="planBackToDay">${t('plan.run.backToList')}</button>`;
  return `<div class="nav-row">${review}${go}</div>`;
}
function planReviewTask() {
  if (!planRunView) return;
  const { date, taskIndex, from } = planRunView;
  planRunView = null;
  planStartReview(date, taskIndex, from, 0);
}
