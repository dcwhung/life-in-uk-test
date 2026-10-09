// ════════════════════════════════════════
// STUDY PLAN · DAY — "Today's tasks" / any day of the plan (handoff §2.4; mockup step ③): header ‹ title › that
// steps through the plan (Day 1 … the exam day), completion ring + phase pill + n / m done, the day's task boxes
// (not started / in progress / done; G8 carry-over on today, not counted in today's %), the completion calendar
// (one month at a time) and the overall progress card. Completion is counted by the system from the answer log
// (G2–G5); nobody ticks anything. A box the runner can open (planRun.js; PR6a: question tasks) is a button.
// ════════════════════════════════════════
const PLAN_RING_EMPTY_BAND = 0;
const PLAN_DAY_TYPE_CLASS = { read: 'read', wrongFacts: 'read', practice: 'practice', drill: 'practice', review: 'review', mock: 'mock' };
const PLAN_DAY_MODE_KEYS = { practice: 'plan.task.modePractice', drill: 'plan.task.modePractice', review: 'plan.task.modeReview', mock: 'plan.task.modeMock' };
// G23: of a day ahead, only reading and practice can be done early
const PLAN_EARLY_TYPES = [PLAN_TASK.read, PLAN_TASK.practice];
const PLAN_TASK_STATE = { todo: 'todo', doing: '', done: 'done' }; // each value is also the task box class ('' = solid)
let planDayView = null; // the ISO day shown; null = today (follows the date at midnight, G6)
let planCalMonth = null; // { year, month } the calendar shows

// iso: a plan day (from the schedule / calendar), or none for today
function openPlanDay(iso = null) {
  if (!planVisible()) return;
  if (!ensurePlanToday()) { leaveToHome(); return; } // G9: the first open fixes today's contents
  planDayView = typeof iso === 'string' && iso !== planTodayIso() ? iso : null;
  planCalMonth = null;
  showScreen('screenPlanDay');
  window.scrollTo(0, 0);
  renderPlanDay();
}
// the shown day, kept inside Day 1 … the exam day (G16: after the exam, the exam day)
function planViewIso(plan) {
  const iso = planDayView || planTodayIso();
  if (iso < plan.start) return plan.start;
  return iso > plan.goal.examDate ? plan.goal.examDate : iso;
}
function renderPlanDay() {
  const plan = planLoad();
  if (!plan) return;
  const log = planLoadLogView() || planEmptyLog(); // unreadable: shown as nothing answered (↺ Reset clears it)
  const iso = planViewIso(plan), todayIso = planTodayIso();
  renderPlanDayHeader(plan, iso, todayIso);
  if (iso === plan.goal.examDate) renderPlanExamView(plan, iso, todayIso);
  else renderPlanDayBody(plan, log, iso, todayIso);
  renderPlanCalendar(plan, log, iso, todayIso);
  renderPlanKpis(plan, log, todayIso);
}
// the calendar opens a day: the page moves to the top and focus to the new day's heading
function planOpenDayFromCalendar(iso) {
  planDayView = iso === planTodayIso() ? null : iso;
  renderPlanDay();
  window.scrollTo(0, 0);
  byId('planDayHeading').focus({ preventScroll: true });
}

// ── header: ← Home | ‹ title / date · n/N › | Schedule (‹ › are updated in place, so focus stays on them) ──
function planDateText(iso) { return `${planShortDate(iso)} ${t(`data.weekdays.${isoWeekday(iso)}`)}`; }
function renderPlanDayHeader(plan, iso, todayIso) {
  const exam = iso === plan.goal.examDate, n = planDayNumber(plan, iso), total = plan.days.length;
  const dayHtml = `<span lang="en">${t('plan.dayN', { n })}</span>`;
  const titleKey = iso === todayIso ? 'plan.day.today' : 'plan.day.dayTasksHtml';
  if (exam) byId('planDayTitle').textContent = t('plan.schedule.examDay');
  else byId('planDayTitle').innerHTML = t(titleKey, { day: dayHtml });
  const count = exam ? PLAN_EXAM_ICON : `<span lang="en">${n}/${total}</span>`;
  byId('planDaySub').innerHTML = `${planDateText(iso)}${LIST_SEP}${count}`;
  byId('planDayPrev').disabled = iso <= plan.start;
  byId('planDayNext').disabled = iso >= plan.goal.examDate;
  byId('planBackToday').hidden = iso === todayIso || todayIso < plan.start || todayIso > plan.goal.examDate;
}
function planShiftDay(step) {
  const plan = planLoad();
  if (!plan) { leaveToHome(); return; }
  const iso = isoAddDays(planViewIso(plan), step);
  planDayView = iso === planTodayIso() ? null : iso;
  planCalMonth = null;
  renderPlanDay();
  planKeepArrowFocus('planDayPrev', 'planDayNext', step);
}
// an arrow that just disabled itself (first / last day or month) would drop focus to <body>: hand it to the other
function planKeepArrowFocus(prevId, nextId, step) {
  const [own, other] = step < 0 ? [prevId, nextId] : [nextId, prevId];
  if (byId(own).disabled && document.activeElement === document.body) byId(other).focus();
}
// W-036: the button hides itself once today shows, so focus moves to the day heading instead of <body>
function planShowToday() {
  planDayView = null;
  planCalMonth = null;
  renderPlanDay();
  byId('planDayHeading').focus({ preventScroll: true });
}

// G16: the exam day has no tasks; today it wishes good luck
function renderPlanExamView(plan, iso, todayIso) {
  const headKey = iso === todayIso ? 'plan.home.examDayText' : 'plan.day.examAhead';
  byId('planDayExamText').innerHTML = `<b>${t(headKey)}</b><span>${t('plan.schedule.examTip')}</span>`;
  byId('planDayExam').appendChild(byId('planBackToday')); // QA O-1: the exam day ahead offers "back to today" too
  setShown('planDayExam', true);
  setShown('planDayHead', false);
  setShown('planDayDone', false);
  setShown('planCarryAlert', false);
  byId('planTaskList').innerHTML = '';
}
function renderPlanDayBody(plan, log, iso, todayIso) {
  const day = planDayAt(plan, iso), dayLog = planDayLog(log, iso);
  const comp = planDayCompletion(day, dayLog);
  const when = planWhen(iso, todayIso);
  const carry = iso === todayIso ? planCarryTasks(plan, log, todayIso) : [];
  setShown('planDayExam', false);
  setShown('planDayHead', true);
  byId('planDayInfo').appendChild(byId('planBackToday')); // back under the hint (it moves into the exam banner)
  const tasks = planVisibleTasks(day, todayIso); // CUI-0022: one list for the boxes and for n / m
  renderPlanRing(comp.pct, iso === todayIso);
  renderPlanDayInfo(day, tasks.map(task => planTaskProgress(task, dayLog)), when);
  const doneKey = iso === todayIso ? 'plan.day.doneToday' : 'plan.day.doneDay';
  byId('planDayDone').textContent = t(doneKey);
  setShown('planDayDone', comp.pct === PERCENT);
  renderPlanTasks(plan, { day, tasks, viewIso: iso === todayIso ? null : iso }, dayLog, when, carry, log);
  byId('planCarryText').textContent = t('plan.day.carryAlert', { n: carry.length });
  setShown('planCarryAlert', carry.length > 0);
}

// ── ring (G27 band) + phase pill + count + hint ──
function renderPlanRing(pct, isToday) {
  const prog = byId('planRingProg');
  const band = pct === null ? PLAN_RING_EMPTY_BAND : planPctBand(pct);
  prog.setAttribute('class', `plan-ring-prog h${band}${pct ? '' : ' empty'}`);
  prog.style.strokeDashoffset = PERCENT - (pct || 0); // pathLength = 100, so the offset is the % left
  const subKey = isToday ? 'plan.day.ringToday' : 'plan.day.ringDay';
  const pctText = pct === null ? t('plan.day.noPct') : t('plan.status.pct', { n: pct });
  byId('planRingPct').textContent = pctText;
  byId('planRingSub').textContent = t(subKey);
  byId('planRing').setAttribute('aria-label', `${t(subKey)} ${pctText}`);
}
const PLAN_PILL_KEYS = { today: 'plan.day.pill', past: 'plan.day.pillPast', '': 'plan.day.pillAhead' };
const PLAN_HINT_KEYS = { today: 'plan.day.hintToday', past: 'plan.day.hintPast', '': 'plan.day.hintAhead' };
function renderPlanDayInfo(day, progress, when) {
  const pill = byId('planDayPhase'), rest = day.phase === PLAN_PHASE.rest;
  const pillKey = PLAN_PILL_KEYS[when], hintKey = PLAN_HINT_KEYS[when], phaseKey = PLAN_PHASE_LABEL_KEYS[day.phase];
  pill.className = `plan-pill plan-phase-pill ${day.phase}`;
  pill.textContent = rest ? t('plan.schedule.restDay') : t(pillKey, { phase: t(phaseKey) });
  const done = progress.filter(p => p.complete).length;
  byId('planDayCount').textContent = rest ? t('plan.day.restCount') : t('plan.day.count', { done, total: progress.length });
  byId('planDayHint').textContent = t(hintKey);
  setShown('planDayHint', !rest);
  planShowRest(rest);
}
// v1.0.4 (user): a rest day shows a large 😴 (aria-hidden) instead of the ring; its "no tasks" line is only read out
function planShowRest(rest) {
  if (!byId('planRestEmoji')) return; // W-040: an old cached index.html (v1.0.3) keeps the ring and its count
  byId('planRing').toggleAttribute('hidden', rest); // an <svg> has no .hidden property, so setShown would not apply
  setShown('planRestEmoji', rest);
  byId('planDayHead').classList.toggle('rest', rest); // the rest view's own spacing (plan.css .plan-today-head.rest)
  byId('planDayCount').classList.toggle('plan-sr', rest);
}

// ── task boxes ──
// shown = { day, tasks (the boxes listed), viewIso (null = today) }; a box knows its day and index for the runner
function renderPlanTasks(plan, shown, dayLog, when, carry, log) {
  const { day, viewIso } = shown;
  const own = shown.tasks.map(task => planTaskBoxHtml(task, day, dayLog, when,
    { date: day.date, taskIndex: day.tasks.indexOf(task), from: viewIso, carryDay: null }));
  // G8: a carry-over task shows (and counts) its own day's answers
  const late = carry.map(c => planTaskBoxHtml(c.task, planDayAt(plan, c.date), planDayLog(log, c.date), PLAN_WHEN.past,
    { date: c.date, taskIndex: c.taskIndex, from: viewIso, carryDay: c.dayNumber }));
  const list = byId('planTaskList');
  list.innerHTML = [...own, ...late].join('');
  list.querySelectorAll('.plan-mini i').forEach(el => { el.style.width = el.dataset.pct + '%'; }); // as #progressFill
}
function planTaskState(p) {
  if (p.complete) return PLAN_TASK_STATE.done;
  return p.done > 0 || p.bad > 0 ? PLAN_TASK_STATE.doing : PLAN_TASK_STATE.todo;
}
// G23: an ahead day's clear-wrong / drill / mock waits for its day; a past mock is never carried (G8)
function planCanStart(task, p, when) {
  if (p.pending) return false;
  if (when === PLAN_WHEN.ahead) return PLAN_EARLY_TYPES.includes(task.type);
  return when === PLAN_WHEN.today || task.type !== PLAN_TASK.mock;
}
const PLAN_GO_KEYS = { todo: 'plan.task.goStart', '': 'plan.task.goContinue', done: 'plan.task.goReview' };
// at = { date, taskIndex, from, carryDay }: a box the runner opens is a button inside the <li> (planOpenTask)
function planTaskBoxHtml(task, day, dayLog, when, at) {
  const p = planTaskProgress(task, dayLog), state = planTaskState(p), carry = at.carryDay !== null;
  const goKey = PLAN_GO_KEYS[state];
  const go = p.complete || planCanStart(task, p, when) ? `<span class="plan-task-go" aria-hidden="true">${t(goKey)}</span>` : '';
  const tag = carry ? `<span class="plan-tag carry" lang="en">${t('plan.dayN', { n: at.carryDay })}</span>` : '';
  const pct = p.complete ? PERCENT : percent(p.done, p.total);
  const cls = `plan-task ${PLAN_DAY_TYPE_CLASS[task.type]}${state ? ' ' + state : ''}${carry ? ' carry' : ''}`;
  const inner = `<span class="plan-task-ic" aria-hidden="true">${PLAN_TASK_ICONS[task.type]}</span>`
    + `<span class="plan-task-body"><span class="plan-task-ttl">${planTaskText(task, day, { fullCh: true })}${tag}</span>`
    + `<span class="plan-task-st">${planTaskStatusHtml(task, p, dayLog)}</span>`
    + `<span class="plan-mini" aria-hidden="true"><i class="h${planPctBand(pct)}" data-pct="${pct}"></i></span></span>${go}`;
  if (!go || !planRunnable(task)) return `<li class="${cls}">${inner}</li>`;
  return `<li class="plan-task-li"><button type="button" class="${cls} plan-task-btn" data-action="planOpenTask" data-arg="${at.date}"`
    + ` data-task="${at.taskIndex}" data-from="${at.from || ''}">${inner}</button></li>`;
}
// the status line: no minutes (handoff §2.3); wrong answers count for nothing until answered right
function planTaskStatusHtml(task, p, dayLog) {
  if (p.pending) return t('plan.task.pending');
  if (task.type === PLAN_TASK.mock) return planMockStatusText(p);
  const empty = p.complete && planTaskQids(task).length === 0;
  if (empty) return t('plan.task.noWrong'); // G9: nothing in the wrong list (or no wrong facts)
  return Array.isArray(task.qids) ? planQuestionStatusHtml(task, p) : planReadStatusText(task, p, dayLog);
}
function planReadStatusText(task, p, dayLog) {
  if (p.complete) return t('plan.task.readDone'); // G3: reading counts once its questions are answered right
  if (!p.done) return t('plan.task.readTodo', { n: p.total });
  return t('plan.task.readPart', { done: p.done, total: p.total, n: chapterFactNumber(planResumeAt(task, dayLog)) });
}
// G37: questions done by 🏆 alone say so ("✓ Mastered" when that is all of them)
function planQuestionStatusHtml(task, p) {
  const mastered = p.mastered ? LIST_SEP + t('plan.task.qMasteredPart', { n: p.mastered }) : '';
  if (p.complete && p.mastered === p.total) return t('plan.task.qMastered', { n: p.total });
  if (p.complete) return t('plan.task.qDone', { n: p.total }) + mastered;
  const modeKey = PLAN_DAY_MODE_KEYS[task.type];
  if (!p.done && !p.bad) return t('plan.task.qTodo', { n: p.total, mode: t(modeKey) });
  const right = `<span class="plan-ok">${t('plan.task.qPart', { done: p.done, total: p.total })}${mastered}</span>`;
  if (!p.bad) return right;
  return `${right}${LIST_SEP}<span class="plan-bad">${t('plan.task.qBad', { n: p.bad })}</span>`
    + `<span class="plan-tag wrong">${t('plan.task.wrongTag', { n: p.bad })}</span>`;
}
// G10 / G25: done = passed; the best score shows either way
function planMockStatusText(p) {
  const passMark = Math.ceil(REAL_TEST_SIZE * PASS_RATIO);
  if (p.complete) return t('plan.task.mockPassed', { best: p.best, n: REAL_TEST_SIZE });
  if (p.best !== null) return t('plan.task.mockBest', { best: p.best, n: REAL_TEST_SIZE, pass: passMark });
  return t('plan.task.qTodo', { n: REAL_TEST_SIZE, mode: t('plan.task.modeMock') });
}

// ── completion calendar: one month, ‹ Today › within the plan's months (none for a one-month plan); each plan day (and the exam day) opens ──
function planMonthIndex(months, iso) {
  const [year, month] = isoParts(iso);
  return months.findIndex(m => m.year === year && m.month === month);
}
function renderPlanCalendar(plan, log, iso, todayIso) {
  const months = planMonths(plan);
  if (!planCalMonth || planMonthIndex(months, `${planCalMonth.year}-${pad2(planCalMonth.month)}-01`) < 0) {
    planCalMonth = months[Math.max(0, planMonthIndex(months, iso))]; // the shown day's month
  }
  const { year, month } = planCalMonth;
  const at = planMonthIndex(months, `${year}-${pad2(month)}-01`), todayAt = planMonthIndex(months, todayIso);
  byId('planCalTitle').textContent = t('plan.calendar.month', { year, month: t(`data.months.${month}`) });
  byId('planCalPrev').disabled = at === 0;
  byId('planCalNext').disabled = at === months.length - 1;
  byId('planCalToday').disabled = todayAt < 0 || at === todayAt;
  planShowMonthNav(months.length > 1);
  const grid = planMonthGrid(plan, log, year, month, todayIso);
  const dow = Array.from({ length: PLAN_WEEK_DAYS }, (_, d) => `<span class="plan-dow">${t(`data.weekdays.${d}`)}</span>`);
  const lead = Array.from({ length: grid.lead }, () => '<span class="plan-cal-lead"></span>');
  byId('planCal').innerHTML = [...dow, ...lead, ...grid.cells.map(c => planCellHtml(plan, c, iso))].join('');
  const streak = planStreakDays(plan, log, todayIso);
  byId('planStreak').textContent = t('plan.calendar.streak', { n: streak });
  setShown('planStreak', streak > 0); // G29: 0 days shows nothing
}
// v1.0.4 (user): a plan inside one month has nothing to page through, so ‹ Today › is not shown; a focused button
// that hides (the plan changed under the open screen) hands focus to the day heading instead of <body>
function planShowMonthNav(shown) {
  const nav = byId('planCalBtns');
  if (!nav) return; // W-040: an old cached index.html (v1.0.3) has no id on the month buttons: they stay shown
  if (!shown && nav.contains(document.activeElement)) byId('planDayHeading').focus({ preventScroll: true });
  nav.hidden = !shown;
}
// band / rest / ahead / outside / exam; days gone by take the lighter band colours (never opacity, W-034)
function planCellClass(c) {
  if (c.examDay) return 'exam plan-exam-pat' + (c.today ? ' today' : ''); // QA O-2: today's outline on the exam day too
  if (!c.inPlan) return 'out';
  const when = c.today ? ' today' : c.past ? ' past' : '';
  if (c.rest) return 'rest' + when;
  if (c.pct === null && !when) return 'future';
  return `h${planPctBand(c.pct || 0)}${when}`;
}
function planCellStatus(c) {
  if (c.examDay) return t('plan.schedule.examDay');
  if (c.rest) return t('plan.status.rest');
  return c.pct === null ? t('plan.calendar.ahead') : t('plan.status.pct', { n: c.pct });
}
function planCellHtml(plan, c, viewIso) {
  const day = Number(c.iso.slice(-2));
  if (!c.inPlan && !c.examDay) return `<span class="plan-cell out" data-iso="${c.iso}">${day}</span>`;
  const viewing = c.iso === viewIso && !c.today ? ' viewing' : '';
  const label = c.examDay ? `${planShortDate(c.iso)}${LIST_SEP}${planCellStatus(c)}`
    : t('plan.calendar.cellLabel', { day: t('plan.dayN', { n: planDayNumber(plan, c.iso) }), date: planShortDate(c.iso), status: planCellStatus(c) });
  const small = c.examDay ? `<small aria-hidden="true">${t('plan.calendar.examCell')}</small>` : '';
  return `<button type="button" class="plan-cell ${planCellClass(c)}${viewing}" data-iso="${c.iso}" data-action="planOpenCalendarDay"`
    + ` data-arg="${c.iso}" aria-label="${label}"${c.today ? ' aria-current="date"' : ''}>${day}${small}</button>`;
}
// 0 = the month of today (or of the shown day while today is outside the plan)
function planShiftMonth(step) {
  const plan = planLoad();
  if (!plan) { leaveToHome(); return; }
  const months = planMonths(plan);
  const from = step === 0 ? planTodayIso() : `${planCalMonth.year}-${pad2(planCalMonth.month)}-01`;
  const at = planMonthIndex(months, from);
  if (at < 0) return;
  planCalMonth = months[Math.min(months.length - 1, Math.max(0, at + step))];
  renderPlanCalendar(plan, planLoadLogView() || planEmptyLog(), planViewIso(plan), planTodayIso());
  if (step) planKeepArrowFocus('planCalPrev', 'planCalNext', step);
  else planFocusEnabledArrow('planCalPrev', 'planCalNext'); // W-036: "Today" just disabled itself
}
function planFocusEnabledArrow(prevId, nextId) {
  if (document.activeElement !== document.body) return;
  const target = [prevId, nextId].map(byId).find(b => !b.disabled);
  if (target) target.focus();
}

// ── overall progress: plan %, average of the days gone by, days to the exam; facts / questions / safe mocks bars ──
function planKpiRowHtml(labelText, v, of) {
  const pct = Math.min(PERCENT, percent(v, of));
  return `<div class="plan-pr"><div class="plan-pr-top"><span class="plan-pr-k">${labelText}</span>`
    + `<span class="plan-pr-v plan-num">${t('plan.kpi.value', { v, of, pct })}</span></div>`
    + `<div class="plan-meter" aria-hidden="true"><i class="plan-meter-fill h${planPctBand(pct)}" data-pct="${pct}"></i></div></div>`;
}
function renderPlanKpis(plan, log, todayIso) {
  const k = planKpis(plan, log, todayIso);
  byId('planKpiPlan').textContent = t('plan.status.pct', { n: k.planPct });
  byId('planKpiPlanSub').textContent = t('plan.dayOf', { n: k.dayNumber, total: k.totalDays });
  byId('planKpiAvg').textContent = t('plan.status.pct', { n: k.avgPct });
  byId('planKpiLeft').textContent = t('plan.goal.daysValue', { n: k.daysLeft });
  const rows = byId('planKpiRows');
  rows.innerHTML = planKpiRowHtml(t('plan.kpi.facts'), k.factsDone, k.factsTotal) + planKpiRowHtml(t('plan.kpi.qs'), k.qidsDone, k.qidsTotal)
    + planKpiRowHtml(t('plan.kpi.mocks', { safe: PLAN_SAFE_SCORE, n: REAL_TEST_SIZE }), k.safeMocks, k.mocksPlanned);
  rows.querySelectorAll('.plan-meter-fill').forEach(el => { el.style.width = el.dataset.pct + '%'; });
}
