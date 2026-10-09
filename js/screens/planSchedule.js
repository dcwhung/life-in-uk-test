// ════════════════════════════════════════
// STUDY PLAN · SCHEDULE — the plan at a glance (handoff §2.3; mockup step ②): summary, the three phases (bar +
// strategy), the study order with its reasons, and the day list: its own scroller opened at today under a sticky
// WEEK heading, past days dimmed, a status pill per day (✓ / G27 band / today n% / rest) and the exam day.
// "Change goal" re-plans from today (planGoal.js, G7); "↺ Reset plan" deletes the plan and its log (S-110).
// Day rows open the day screen once it exists (PR5); until then they are plain rows.
// ════════════════════════════════════════
const PLAN_ORDER_STEPS = [[1, 2], [5], [4], [3]]; // PLAN_STUDY_ORDER grouped as the order card shows it
const PLAN_ORDER_WHY_KEYS = { 1: 'plan.order.whyWarmUp', 5: 'plan.order.whyGov', 4: 'plan.order.whySociety', 3: 'plan.order.whyHistory' };
// S-113: where a day sits against today; each value is also its row's class (.plan-day.today / .past), '' = ahead
const PLAN_WHEN = { today: 'today', past: 'past', ahead: '' };
const PLAN_SHOWN_PHASES = [PLAN_PHASE.learn, PLAN_PHASE.drill, PLAN_PHASE.mock];
const PLAN_PHASE_LABEL_KEYS = { learn: 'plan.phase.learn', drill: 'plan.phase.drill', mock: 'plan.phase.mock' };
const PLAN_TASK_ICONS = { read: '📖', practice: '📝', drill: '📝', wrongFacts: '📖', review: '🔁', mock: '🎯' };
const PLAN_REST_ICON = '😴';
const PLAN_LIGHT_ICON = '🔁';
const PLAN_EXAM_ICON = '🎯';
const PLAN_SAFE_IN_A_ROW = 3; // "3 in a row at 21 / 24 or more is safe"
const PLAN_ORDER_BAR_MIN_PCT = 2; // the smallest chapter bar stays visible

function openPlanSchedule() {
  if (!planVisible()) return;
  if (!planLoad()) { leaveToHome(); return; } // reset in another tab, or unreadable: Home shows the create card
  showScreen('screenPlanSchedule');
  window.scrollTo(0, 0);
  renderPlanSchedule();
  planScrollToToday();
}
function renderPlanSchedule() {
  const plan = planLoad();
  if (!plan) return;
  const log = planLoadLog() || planEmptyLog(); // an unreadable log shows as nothing answered (↺ Reset clears it)
  const phases = planPhaseDays(plan);
  byId('planSummary').textContent = planSummaryText(plan);
  renderPlanPhaseBar(phases);
  renderPlanStrategy(plan, phases);
  renderPlanOrder();
  byId('planDayList').innerHTML = planDayListHtml(plan, log, planTodayIso());
}
// language switch: re-rendered in place, the day list stays where it was scrolled
function rerenderPlanSchedule() {
  const top = byId('planDayList').scrollTop;
  renderPlanSchedule();
  planJumpList(top);
}

// ── summary, phases, strategy ──
function planSummaryText(plan) {
  const g = plan.goal;
  return t('plan.schedule.summary', { start: planShortDate(plan.start), exam: planShortDate(g.examDate),
    mins: planMinsText(g.dailyMins), level: t(`data.planLevels.${g.level}.label`) });
}
// phase → its Day numbers (1-based), rest days left out; the last (light) study day counts as mock
function planPhaseDays(plan) {
  const out = Object.fromEntries(PLAN_SHOWN_PHASES.map(k => [k, []]));
  plan.days.forEach((d, i) => { if (out[d.phase]) out[d.phase].push(i + 1); });
  return out;
}
function planShownPhases(phases) { return PLAN_SHOWN_PHASES.filter(k => phases[k].length); }
function renderPlanPhaseBar(phases) {
  const shown = planShownPhases(phases);
  const bar = byId('planPhaseBar');
  bar.innerHTML = shown.map(k => {
    const nameKey = PLAN_PHASE_LABEL_KEYS[k];
    return `<div class="plan-bg-${k}"><span>${t('plan.schedule.phaseDays', { name: t(nameKey), n: phases[k].length })}</span></div>`;
  }).join('');
  // each segment as wide as its share of the study days (width from JS, as #progressFill)
  [...bar.children].forEach((el, i) => { el.style.flexGrow = phases[shown[i]].length; });
}
function planDayRangeHtml(days) {
  const from = days[0], to = days[days.length - 1];
  const text = from === to ? t('plan.dayN', { n: from }) : t('plan.schedule.dayRange', { from, to });
  return `<span class="plan-strat-days" lang="en">${text}</span>`;
}
function planStrategyItems(plan, phase) {
  const passScore = Math.ceil(REAL_TEST_SIZE * PASS_RATIO);
  const mocks = plan.days.flatMap(d => d.tasks).filter(task => task.type === PLAN_TASK.mock).length;
  if (phase === PLAN_PHASE.learn) {
    return [t('plan.strategy.learnTitle'), t('plan.strategy.learnOrder'),
      t('plan.strategy.learnPair', { facts: STUDY.length, qs: PLAN_TOTAL_QIDS }), t('plan.strategy.learnReview')];
  }
  if (phase === PLAN_PHASE.drill) return [t('plan.strategy.drillTitle'), t('plan.strategy.drillAgain'), t('plan.strategy.drillFacts')];
  return [t('plan.strategy.mockTitle', { n: mocks }), t('plan.strategy.mockReal', { n: REAL_TEST_SIZE, m: EXAM_MINUTES }),
    t('plan.strategy.mockPass', { pass: passScore, safe: PLAN_SAFE_SCORE, n: REAL_TEST_SIZE, k: PLAN_SAFE_IN_A_ROW }), t('plan.strategy.mockLast')];
}
function renderPlanStrategy(plan, phases) {
  byId('planStrategy').innerHTML = planShownPhases(phases).map((k, i) => {
    const [title, ...items] = planStrategyItems(plan, k);
    return `<div class="plan-strat ${k}"><span class="plan-strat-n plan-num" aria-hidden="true">${i + 1}</span><div>`
      + `${planDayRangeHtml(phases[k])}<h4>${title}</h4><ul>${items.map(s => `<li>${s}</li>`).join('')}</ul></div></div>`;
  }).join('');
}

// ── study order: Ch1–2 → Ch5 → Ch4 → Ch3, each with its size and why it comes there ──
function planChapterText(ch) { return `${t('common.chapterShort', { n: ch })} ${t(`data.chapterShort.${ch}`)}`; }
function planChapterFacts(ch) { return STUDY.filter(f => f.ch === ch).length; }
function planOrderStepHtml(chs, i) {
  const facts = chs.reduce((s, ch) => s + planChapterFacts(ch), 0);
  const qs = chs.reduce((s, ch) => s + PLAN_CHAPTER_QIDS[ch].length, 0);
  const whyKey = PLAN_ORDER_WHY_KEYS[chs[0]];
  const why = t(whyKey, { n: facts });
  return `<div class="plan-ord"><span class="plan-ord-n plan-num" aria-hidden="true">${i + 1}</span><div class="plan-ord-body">`
    + `<div class="plan-chw"><b lang="en">${chs.map(planChapterText).join(' + ')}</b><span class="plan-chw-bar" aria-hidden="true"><i></i></span>`
    + `<span class="plan-chw-c plan-num">${t('plan.schedule.orderCount', { facts, qs })}</span></div>`
    + `<span class="plan-ord-why">${why}</span></div></div>`;
}
function renderPlanOrder() {
  const box = byId('planOrder');
  box.innerHTML = PLAN_ORDER_STEPS.map(planOrderStepHtml).join('');
  const sizes = PLAN_ORDER_STEPS.map(chs => chs.reduce((s, ch) => s + planChapterFacts(ch), 0));
  const most = Math.max(...sizes);
  box.querySelectorAll('.plan-chw-bar i').forEach((el, i) => {
    el.style.width = Math.max(PLAN_ORDER_BAR_MIN_PCT, Math.round(sizes[i] / most * PERCENT)) + '%';
  });
}

// ── day list ──
function planChapterHtml(ch) { return `<span lang="en">${planChapterText(ch)}</span>`; }
function planFactRange(ids) {
  const nums = ids.map(chapterFactNumber);
  const from = Math.min(...nums), to = Math.max(...nums);
  return t('study.factId', { n: from }) + (to > from ? '–' + to : '');
}
// one task line's text: no minutes, mastery in words (handoff §2.3); a mock shows its exam once it is picked
function planTaskText(task, day) {
  const ch = task.ch && planChapterHtml(task.ch);
  switch (task.type) {
    case PLAN_TASK.read: return t('plan.task.read', { ch, range: planFactRange(task.facts) });
    case PLAN_TASK.practice: return t('plan.task.practice', { ch, n: task.qids.length });
    case PLAN_TASK.drill: return t('plan.task.drill', { ch, n: task.quota });
    case PLAN_TASK.wrongFacts: return t('plan.task.wrongFacts');
    case PLAN_TASK.review: { const reviewKey = day.phase === PLAN_PHASE.mock ? 'plan.task.reviewMock' : 'plan.task.review'; return t(reviewKey); }
    default: return 'exam' in task ? t('plan.task.mockExam', { exam: `<span lang="en">${t('common.examN', { n: task.exam })}</span>` }) : t('plan.task.mock');
  }
}
function planTaskLineHtml(icon, text) {
  return `<div class="plan-day-t"><span class="plan-day-ic" aria-hidden="true">${icon}</span><span>${text}</span></div>`;
}
function planDayTasksHtml(day) {
  if (day.phase === PLAN_PHASE.rest) return planTaskLineHtml(PLAN_REST_ICON, t('plan.schedule.restDay'));
  if (day.light) return planTaskLineHtml(PLAN_LIGHT_ICON, t('plan.task.light'));
  return day.tasks.map(task => planTaskLineHtml(PLAN_TASK_ICONS[task.type], planTaskText(task, day))).join('');
}
// ✓ done / its G27 band (past), today n%, rest; days ahead show no pill until they can be opened (PR5)
function planDayPillHtml(day, dayLog, when) {
  if (day.phase === PLAN_PHASE.rest) return `<span class="plan-pill mute">${t('plan.status.rest')}</span>`;
  if (when === PLAN_WHEN.ahead) return '';
  const pct = planDayCompletion(day, dayLog).pct || 0;
  if (when === PLAN_WHEN.today) return `<span class="plan-pill now plan-num">${t('plan.status.today', { n: pct })}</span>`;
  if (pct >= PERCENT) return `<span class="plan-pill ok">${t('plan.status.done')}</span>`;
  return `<span class="plan-pill plan-num h${planPctBand(pct)}">${t('plan.status.pct', { n: pct })}</span>`;
}
function planWhen(iso, todayIso) {
  if (iso === todayIso) return PLAN_WHEN.today;
  return iso < todayIso ? PLAN_WHEN.past : PLAN_WHEN.ahead;
}
function planDateBoxHtml(top, iso, extraClass = '') {
  const sub = `${planShortDate(iso)} ${t(`data.weekdays.${isoWeekday(iso)}`)}`;
  return `<div class="plan-day-d plan-num${extraClass}">${top}<small>${sub}</small></div>`;
}
function planWeekHtml(i) {
  return i % PLAN_WEEK_DAYS ? '' : `<div class="plan-week" lang="en">${t('plan.schedule.week', { n: i / PLAN_WEEK_DAYS + 1 })}</div>`;
}
function planDayRowHtml(day, i, log, todayIso) {
  const when = planWhen(day.date, todayIso);
  return planWeekHtml(i) + `<div class="plan-day ${day.phase}${when ? ' ' + when : ''}">${planDateBoxHtml(i + 1, day.date)}`
    + `<div class="plan-day-tasks">${planDayTasksHtml(day)}</div><div>${planDayPillHtml(day, planDayLog(log, day.date), when)}</div></div>`;
}
// G16: the exam day ends the list (amber lattice, 🎯), with what to bring
function planExamRowHtml(plan, todayIso) {
  const iso = plan.goal.examDate, when = planWhen(iso, todayIso);
  const icon = `<span aria-hidden="true">${PLAN_EXAM_ICON}</span>`;
  return planWeekHtml(plan.days.length) + `<div class="plan-day exam${when ? ' ' + when : ''}">${planDateBoxHtml(icon, iso, ' plan-exam-pat')}`
    + `<div class="plan-day-tasks"><div class="plan-day-t"><b>${t('plan.schedule.examDay')}</b></div>`
    + `<div class="plan-day-t"><span>${t('plan.schedule.examTip')}</span></div></div><div></div></div>`;
}
function planDayListHtml(plan, log, todayIso) {
  return plan.days.map((day, i) => planDayRowHtml(day, i, log, todayIso)).join('') + planExamRowHtml(plan, todayIso);
}
// opens the list at today, just below its sticky WEEK heading, without moving the page itself (G16: after the exam,
// at the exam day); instant, not the list's smooth scrolling
function planScrollToToday() {
  const list = byId('planDayList');
  const row = list.querySelector(`.plan-day.${PLAN_WHEN.today}`) || (planTodayIso() > planLoad().goal.examDate ? list.querySelector('.plan-day.exam') : null);
  const head = list.querySelector('.plan-week');
  planJumpList(row ? row.offsetTop - (head ? head.offsetHeight : 0) : 0);
}
// the list scrolls smoothly for the user; a programmatic move jumps
function planJumpList(top) {
  const list = byId('planDayList');
  list.classList.add('plan-jump');
  list.scrollTop = top;
  list.classList.remove('plan-jump');
}

// ── change goal / reset ──
function planEditGoal() {
  const plan = planLoad();
  if (!plan) { leaveToHome(); return; }
  openPlanGoal(plan.goal);
}
// "↺ Reset plan" = delete (handoff §2.3): the plan and its log only; practice records and the switch stay
function planAskReset() {
  showConfirm({ title: t('modal.planResetTitle'), message: t('modal.planResetMessage'), okLabel: t('modal.planResetOk'),
    cancelLabel: t('modal.planResetCancel'), onOk: planReset, focusCancel: true });
}
function planReset() {
  clearStudyPlan();
  leaveToHome();
  window.scrollTo(0, 0); // the reset button sits at the bottom: show the create card that replaced the plan
  showToast(t('plan.toastReset'));
}
