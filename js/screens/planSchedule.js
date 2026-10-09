// ════════════════════════════════════════
// STUDY PLAN · SCHEDULE — the plan at a glance (handoff §2.3; mockup step ②): summary, the three phases (bar +
// strategy), the study order with its reasons, and the day list: its own scroller opened at today under a sticky
// WEEK heading, past days dimmed, a status pill per day (✓ / G27 band / today n% / rest; v1.0.2: under the date box,
// so the tasks get the rest of the row) and the exam day. v1.0.2: task lines say "Ch n"; a gold bullet list under
// a study day's tasks names its chapters in full (v1.0.3).
// "Change goal" re-plans from today (planGoal.js, G7); "↺ Reset plan" deletes the plan and its log (S-110).
// Each day row (and the exam day) is a button that opens that day (planDay.js); "View today's tasks →" below.
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
// PR4 QA O-1: rows further than this from today skip layout until scrolled near (content-visibility); the rows
// around today are always laid out, so opening the list at today lands exactly
const PLAN_NEAR_ROWS = 14;

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
// language switch / new day: re-rendered in place, the day list stays where it was scrolled. It returns to the first
// row in view (not the raw scrollTop): rows far from today have estimated heights until laid out (O-1)
function rerenderPlanSchedule() {
  const list = byId('planDayList');
  const row = [...list.querySelectorAll('.plan-day')].find(r => r.offsetTop + r.offsetHeight > list.scrollTop);
  const anchor = row ? { iso: row.dataset.arg, delta: list.scrollTop - row.offsetTop } : null;
  renderPlanSchedule();
  const again = anchor && list.querySelector(`.plan-day[data-arg="${anchor.iso}"]`);
  planJumpList(again ? again.offsetTop + anchor.delta : 0);
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
// v1.0.2: three equal segments, the name over its day count; a name too long for its segment wraps (W-037, plan.css)
function renderPlanPhaseBar(phases) {
  byId('planPhaseBar').innerHTML = planShownPhases(phases).map(k => {
    const nameKey = PLAN_PHASE_LABEL_KEYS[k];
    return `<div class="plan-bg-${k}"><span class="plan-ph-name">${t(nameKey)}</span>`
      + `<span class="plan-ph-days plan-num">${t('plan.schedule.phaseDaysN', { n: phases[k].length })}</span></div>`;
  }).join('');
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
  // v1.0.3: name, why, then the bar row (bar filling the row, a fixed gap, the count)
  return `<div class="plan-ord"><span class="plan-ord-n plan-num" aria-hidden="true">${i + 1}</span><div class="plan-ord-body">`
    + `<b class="plan-ord-name" lang="en">${chs.map(planChapterText).join(' + ')}</b><span class="plan-ord-why">${why}</span>`
    + `<div class="plan-chw"><span class="plan-chw-bar" aria-hidden="true"><i></i></span>`
    + `<span class="plan-chw-c plan-num">${t('plan.schedule.orderCount', { facts, qs })}</span></div></div></div>`;
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
// task lines name the chapter by number only; planDayChaptersHtml spells the names out once per day
function planChapterHtml(ch) { return `<span lang="en">${t('common.chapterShort', { n: ch })}</span>`; }
function planFactRange(ids) {
  const nums = ids.map(chapterFactNumber);
  const from = Math.min(...nums), to = Math.max(...nums);
  return t('study.factId', { n: from }) + (to > from ? '–' + to : '');
}
// one task line's text: no minutes, mastery in words (handoff §2.3); a mock shows its exam once it is picked
// fullCh: the day screen / Home card name the chapter in full (they have no remarks line); the schedule says "Ch n"
function planTaskText(task, day, { fullCh = false } = {}) {
  const ch = task.ch && (fullCh ? `<span lang="en">${planChapterText(task.ch)}</span>` : planChapterHtml(task.ch));
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
  return `<span class="plan-day-t"><span class="plan-day-ic" aria-hidden="true">${icon}</span><span>${text}</span></span>`;
}
// the remarks: the day's chapters in full, one bullet each, each once, in the order the tasks reach them ('' without any);
// spans styled as a list, since the row is a button (phrasing content only)
function planDayChaptersHtml(day) {
  const chs = [...new Set(day.tasks.filter(task => task.ch).map(task => task.ch))];
  return chs.length ? `<span class="plan-day-chs">${chs.map(ch => `<span class="plan-day-ch" lang="en">${planChapterText(ch)}</span>`).join('')}</span>` : '';
}
function planDayTasksHtml(day) {
  if (day.phase === PLAN_PHASE.rest) return planTaskLineHtml(PLAN_REST_ICON, t('plan.schedule.restDay'));
  if (day.light) return planTaskLineHtml(PLAN_LIGHT_ICON, t('plan.task.light'));
  return day.tasks.map(task => planTaskLineHtml(PLAN_TASK_ICONS[task.type], planTaskText(task, day))).join('') + planDayChaptersHtml(day);
}
// ✓ done / its G27 band (past), today n%, rest; a day ahead has no pill (v1.0.3, user: the whole row opens it)
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
// the row's left column: the date box with the day's status pill under it (pillHtml may be '')
function planDateBoxHtml(top, iso, { extraClass = '', pillHtml = '' } = {}) {
  const sub = `${planShortDate(iso)} ${t(`data.weekdays.${isoWeekday(iso)}`)}`;
  return `<span class="plan-day-side"><span class="plan-day-d plan-num${extraClass}">${top}<small>${sub}</small></span>${pillHtml}</span>`;
}
function planWeekHtml(i) {
  return i % PLAN_WEEK_DAYS ? '' : `<div class="plan-week" lang="en">${t('plan.schedule.week', { n: i / PLAN_WEEK_DAYS + 1 })}</div>`;
}
// a row is a button (spans inside) that opens its day
function planDayRowOpen(cls, iso) {
  return `<button type="button" class="plan-day ${cls}" data-action="openPlanDay" data-arg="${iso}">`;
}
function planDayRowHtml(day, i, log, todayIso, todayIndex) {
  const when = planWhen(day.date, todayIso);
  const far = Math.abs(i - todayIndex) > PLAN_NEAR_ROWS ? ' plan-far' : '';
  const pillHtml = planDayPillHtml(day, planDayLog(log, day.date), when);
  return planWeekHtml(i) + planDayRowOpen(day.phase + (when ? ' ' + when : '') + far, day.date) + planDateBoxHtml(i + 1, day.date, { pillHtml })
    + `<span class="plan-day-tasks">${planDayTasksHtml(day)}</span></button>`;
}
// G16: the exam day ends the list (amber lattice, 🎯), with what to bring
function planExamRowHtml(plan, todayIso) {
  const iso = plan.goal.examDate, when = planWhen(iso, todayIso);
  const icon = `<span aria-hidden="true">${PLAN_EXAM_ICON}</span>`;
  return planWeekHtml(plan.days.length) + planDayRowOpen('exam' + (when ? ' ' + when : ''), iso) + planDateBoxHtml(icon, iso, { extraClass: ' plan-exam-pat' })
    + `<span class="plan-day-tasks"><span class="plan-day-t"><b>${t('plan.schedule.examDay')}</b></span>`
    + `<span class="plan-day-t"><span>${t('plan.schedule.examTip')}</span></span></span></button>`;
}
function planDayListHtml(plan, log, todayIso) {
  const todayIndex = Math.min(plan.days.length, Math.max(0, planDayIndex(plan, todayIso))); // after the exam: its row
  return plan.days.map((day, i) => planDayRowHtml(day, i, log, todayIso, todayIndex)).join('') + planExamRowHtml(plan, todayIso);
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
