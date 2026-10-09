// ════════════════════════════════════════
// STUDY PLAN · GOAL — "set your goal" (handoff §2.2; mockup step ①): exam date (presets or a date between
// today + 7 and today + 6 months), the daily limit (slider 30–120, step 15), rest days, level (.mode-card) and
// whether the time is enough (✓ / △ / ✕; G13: ✕ still builds, with longer days). Fewer than PLAN_MIN_STUDY_DAYS
// study days disables the CTA with a hint (G28). Create = clear the old plan + log, then store buildPlan().
// "Change goal" (schedule) opens the same form prefilled with the plan's goal; its CTA re-plans from today
// (replanFrom, G7: past days frozen, Day 1 unchanged). G36: there the exam may be as soon as tomorrow with a
// single study day (PLAN_GOAL_MODE.edit; the limits live in plan.js). Either way the schedule opens next.
// ════════════════════════════════════════
const PLAN_DEFAULT_GOAL = { days: 21, dailyMins: 120, restDays: [0], level: 'none' };
const PLAN_PRESET_LABEL_KEYS = { 14: 'plan.goal.preset2w', 21: 'plan.goal.preset3w', 28: 'plan.goal.preset4w', 42: 'plan.goal.preset6w' };
const PLAN_LEVEL_ICONS = { none: '🌱', some: '📝', exam: '🎯' };
const PLAN_MINUTES_PER_HOUR = 60;
const PLAN_FEAS_METER_SCALE = 1.5; // the meter is full at 150% of the time needed
const PLAN_PERCENT = 100;
let planGoalDraft = null; // { examDate, dailyMins, restDays, level } being edited
let planGoalEditing = false; // true: changing the stored plan's goal; false: a new plan
// G36: which limits the date field and the CTA follow
function planGoalMode() { return planGoalEditing ? PLAN_GOAL_MODE.edit : PLAN_GOAL_MODE.create; }

function planDefaultDraft(todayIso) {
  const d = PLAN_DEFAULT_GOAL;
  return { examDate: isoAddDays(todayIso, d.days), dailyMins: d.dailyMins, restDays: [...d.restDays], level: d.level };
}
// goal: the stored plan's goal to change, or none for a new plan
function openPlanGoal(goal = null) {
  if (!planVisible()) return;
  planGoalEditing = !!goal;
  planGoalDraft = goal ? planCopyGoal(goal) : planDefaultDraft(planTodayIso());
  showScreen('screenPlanGoal');
  renderPlanGoal();
  window.scrollTo(0, 0);
}

// ── formatting: "45 min", "1 hr", "1 hr 15 min"; ticks past the first hour show only the minutes ──
function planMinsText(m) {
  const h = Math.floor(m / PLAN_MINUTES_PER_HOUR), r = m % PLAN_MINUTES_PER_HOUR;
  if (!h) return t('plan.goal.mins', { m: r });
  return r ? t('plan.goal.hoursMins', { h, m: r }) : t('plan.goal.hours', { h });
}
function planTickText(m) {
  return m > PLAN_MINUTES_PER_HOUR && m % PLAN_MINUTES_PER_HOUR ? t('plan.goal.tickMins', { m: m % PLAN_MINUTES_PER_HOUR }) : planMinsText(m);
}
function planHours(mins) { return Math.round(Math.abs(mins) / PLAN_MINUTES_PER_HOUR); }
function planPressed(on) { return `aria-pressed="${on ? 'true' : 'false'}"`; }

// ── fields ──
// CUI-0019: button groups are built once, then updated in place. Leaving the date field commits it on mousedown /
// touchstart elsewhere; a group rebuilt then would take the press and lose the click (and keyboard focus, S-109).
function planSyncGroup(groupId, items, buildHtml, update) {
  const box = byId(groupId), btns = [...box.children];
  const same = btns.length === items.length && btns.every((b, i) => b.dataset.arg === String(items[i].arg));
  if (!same) { box.innerHTML = items.map(buildHtml).join(''); return; }
  btns.forEach((b, i) => update(b, items[i]));
}
// items: { arg, on, label }
function planSyncChips({ groupId, action, extraClass = '' }, items) {
  planSyncGroup(groupId, items,
    it => `<button type="button" class="chip${extraClass}${it.on ? ' active' : ''}" ${planPressed(it.on)} data-action="${action}" data-arg="${it.arg}">${it.label}</button>`,
    (b, it) => { b.classList.toggle('active', it.on); b.setAttribute('aria-pressed', String(it.on)); b.textContent = it.label; });
}
function renderPlanDays(todayIso) {
  const days = isoDiffDays(todayIso, planGoalDraft.examDate);
  byId('planDaysVal').textContent = t('plan.goal.daysValue', { n: days });
  planSyncChips({ groupId: 'planDaysChips', action: 'planSetDays' }, PLAN_EXAM_DAY_PRESETS.map(n => {
    const labelKey = PLAN_PRESET_LABEL_KEYS[n];
    return { arg: n, on: n === days, label: t(labelKey) };
  }));
  renderPlanDateInput(todayIso);
}
// W-033: while the field has focus its half-typed segments are left alone (planCommitExamDate writes it back)
function renderPlanDateInput(todayIso) {
  const input = byId('planExamDate'), range = planExamDateRange(todayIso, planGoalMode());
  // re-setting min / max on a focused date field drops its focus in Chromium, so only on a change (midnight)
  if (input.min !== range.min) input.min = range.min;
  if (input.max !== range.max) input.max = range.max;
  if (document.activeElement !== input) input.value = planGoalDraft.examDate;
}
// S-111: a draft left open past midnight moves up to the new minimum (as a date past the maximum moves down)
function planClampDraftDate(todayIso) {
  const range = planExamDateRange(todayIso, planGoalMode());
  if (planGoalDraft.examDate < range.min) planGoalDraft.examDate = range.min;
}
function renderPlanMins() {
  const m = planGoalDraft.dailyMins, input = byId('planMins');
  Object.assign(input, { min: PLAN_MINS.min, max: PLAN_MINS.max, step: PLAN_MINS.step, value: m });
  input.setAttribute('aria-valuetext', planMinsText(m));
  byId('planMinsVal').textContent = planMinsText(m);
  const ticks = [];
  for (let v = PLAN_MINS.min; v <= PLAN_MINS.max; v += PLAN_MINS.step) ticks.push(`<span${v === m ? ' class="on"' : ''}>${planTickText(v)}</span>`);
  byId('planMinsTicks').innerHTML = ticks.join('');
}
function renderPlanRest() {
  planSyncChips({ groupId: 'planRestChips', action: 'planToggleRest', extraClass: ' plan-rest' }, Array.from({ length: PLAN_WEEK_DAYS }, (_, d) =>
    ({ arg: d, on: planGoalDraft.restDays.includes(d), label: t(`data.weekdays.${d}`) })));
}
function planLevelCardHtml(it) {
  return `<button type="button" class="mode-card${it.on ? ' selected' : ''}" ${planPressed(it.on)} data-action="planSetLevel" data-arg="${it.arg}">`
    + `<div class="mode-icon" aria-hidden="true">${PLAN_LEVEL_ICONS[it.arg]}</div><div class="mode-title">${it.label}</div>`
    + `<span class="plan-level-sub">${it.sub}</span></button>`;
}
function renderPlanLevels() {
  const items = Object.keys(PLAN_LEVELS).map(k => ({ arg: k, on: k === planGoalDraft.level,
    label: t(`data.planLevels.${k}.label`), sub: t(`data.planLevels.${k}.sub`) }));
  planSyncGroup('planLevelGrid', items, planLevelCardHtml, (b, it) => {
    b.classList.toggle('selected', it.on);
    b.setAttribute('aria-pressed', String(it.on));
    b.querySelector('.mode-title').textContent = it.label;
    b.querySelector('.plan-level-sub').textContent = it.sub;
  });
}

// ── feasibility + CTA ──
const PLAN_FEAS_LABEL_KEYS = { ok: 'plan.feas.ok', tight: 'plan.feas.tight', short: 'plan.feas.short' };
const PLAN_FEAS_MSG_KEYS = { ok: 'plan.feas.okMsg', tight: 'plan.feas.tightMsg', short: 'plan.feas.shortMsg' };
function renderPlanFeasibility(todayIso) {
  // W-035: a changed goal re-plans only the facts still to learn (replanFrom), so the estimate counts those
  const factIds = planGoalEditing ? planFactsLeft(planLoadLog() || planEmptyLog()) : PLAN_LEARN_ORDER;
  const f = planFeasibility(planGoalDraft, todayIso, factIds);
  const labelKey = PLAN_FEAS_LABEL_KEYS[f.status], msgKey = PLAN_FEAS_MSG_KEYS[f.status];
  byId('planFeasPill').className = 'plan-pill ' + f.status;
  byId('planFeasPill').textContent = t(labelKey);
  byId('planFeasDays').textContent = f.studyDays;
  byId('planFeasDaysSub').textContent = t('plan.feas.studyDaysSub', { n: f.studyDays + f.restCount, rest: f.restCount });
  byId('planFeasAvail').textContent = t('plan.feas.hours', { n: planHours(f.availMins) });
  byId('planFeasNeed').textContent = t('plan.feas.hours', { n: planHours(f.needMins) });
  const meter = byId('planFeasMeter');
  meter.className = 'plan-meter-fill ' + f.status;
  meter.style.width = Math.min(PLAN_PERCENT, Math.round(f.ratio * PLAN_PERCENT / PLAN_FEAS_METER_SCALE)) + '%';
  byId('planFeasMsg').textContent = t(msgKey, { n: planHours(f.diffMins), m: PLAN_MINS.step });
}
function renderPlanCta(todayIso) {
  const mode = planGoalMode(), check = validatePlanGoal(planGoalDraft, todayIso, mode);
  byId('planCreateBtn').disabled = !check.ok;
  const fewDays = check.errors.includes(PLAN_GOAL_ERROR.studyDays);
  const hintKey = planGoalEditing ? 'plan.goal.editMinStudyDays' : 'plan.goal.minStudyDays';
  byId('planGoalHint').textContent = fewDays ? t(hintKey, { n: planGoalLimits(mode).minStudyDays }) : '';
  setShown('planGoalHint', fewDays);
  setShown('planFeasMsg', !fewDays); // its "build anyway" advice (G13) does not apply while the CTA is disabled
}
function renderPlanGoal() {
  if (!planGoalDraft) planGoalDraft = planDefaultDraft(planTodayIso());
  const todayIso = planTodayIso();
  const stepKey = planGoalEditing ? 'plan.goal.editStep' : 'plan.goal.step', ctaKey = planGoalEditing ? 'plan.goal.update' : 'plan.goal.create';
  byId('planGoalStep').textContent = t(stepKey);
  byId('planCreateBtn').textContent = t(ctaKey);
  setShown('planGoalSteps', !planGoalEditing); // the 1 / 2 stepper belongs to a new plan
  setShown('planDateNote', planGoalEditing); // G36: tells why the date field now starts tomorrow
  planClampDraftDate(todayIso);
  renderPlanDays(todayIso);
  renderPlanMins();
  renderPlanRest();
  renderPlanLevels();
  renderPlanFeasibility(todayIso);
  renderPlanCta(todayIso);
}

// ── inputs ──
function planSetDays(n) {
  if (!PLAN_EXAM_DAY_PRESETS.includes(n)) return;
  planGoalDraft.examDate = isoAddDays(planTodayIso(), n);
  renderPlanGoal(); // S-109: the chips are updated in place, so focus stays on the one chosen
}
// W-033: Chromium fires input on every typed segment, and a half-typed date is often out of range, so input only
// takes a complete in-range date and never rewrites the field. Leaving the field commits it: a date past the
// 6-month limit moves to the limit, anything else not taken snaps back to the draft.
function planSetExamDate(value) {
  const range = planExamDateRange(planTodayIso(), planGoalMode());
  if (!isoIsValid(value) || value < range.min || value > range.max) return;
  planGoalDraft.examDate = value;
  renderPlanGoal();
}
// CUI-0019: usually input already took the date, so a commit that changes nothing only resets the field
function planCommitExamDate(value) {
  const range = planExamDateRange(planTodayIso(), planGoalMode()), before = planGoalDraft.examDate;
  if (isoIsValid(value) && value > range.max) planGoalDraft.examDate = range.max;
  else if (isoIsValid(value) && value >= range.min) planGoalDraft.examDate = value;
  if (planGoalDraft.examDate !== before) renderPlanGoal();
  byId('planExamDate').value = planGoalDraft.examDate;
}
function planSetMins(value) {
  const m = Number(value);
  if (planValidMins(m)) planGoalDraft.dailyMins = m;
  renderPlanGoal();
}
function planToggleRest(d) {
  const rest = planGoalDraft.restDays;
  planGoalDraft.restDays = rest.includes(d) ? rest.filter(x => x !== d) : [...rest, d].sort();
  renderPlanGoal();
}
function planSetLevel(level) {
  if (planIsLevel(level)) planGoalDraft.level = level;
  renderPlanGoal();
}
// O-2: a new plan never inherits the old log (or a corrupt one, O-1). A changed goal keeps the log (G7): an
// unreadable log re-plans as if nothing were answered and stays as it is (↺ Reset clears it, S-110).
// A plan deleted meanwhile (another tab) makes the edit a new plan; a goal only a change allows (G36) then
// shows the form in create mode with its limits instead of doing nothing.
function planCreate() {
  const todayIso = planTodayIso();
  const old = planGoalEditing ? planLoad() : null;
  const plan = old ? replanFrom(old, planGoalDraft, todayIso, planLoadLog() || planEmptyLog()) : buildPlan(planGoalDraft, todayIso);
  if (!plan) {
    if (planGoalEditing && !old) { planGoalEditing = false; renderPlanGoal(); }
    return;
  }
  if (!old) clearStudyPlan();
  writeStudyPlan(plan);
  openPlanSchedule();
}
