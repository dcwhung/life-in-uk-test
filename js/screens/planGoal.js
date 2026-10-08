// ════════════════════════════════════════
// STUDY PLAN · GOAL — "set your goal" (handoff §2.2; mockup step ①): exam date (presets or a date between
// today + 7 and today + 6 months), the daily limit (slider 30–120, step 15), rest days, level (.mode-card) and
// whether the time is enough (✓ / △ / ✕; G13: ✕ still builds, with longer days). Fewer than PLAN_MIN_STUDY_DAYS
// study days disables the CTA with a hint (G28). Create = clear the old plan + log, then store buildPlan().
// ════════════════════════════════════════
const PLAN_DEFAULT_GOAL = { days: 21, dailyMins: 120, restDays: [0], level: 'none' };
const PLAN_PRESET_LABEL_KEYS = { 14: 'plan.goal.preset2w', 21: 'plan.goal.preset3w', 28: 'plan.goal.preset4w', 42: 'plan.goal.preset6w' };
const PLAN_LEVEL_ICONS = { none: '🌱', some: '📝', exam: '🎯' };
const PLAN_MINUTES_PER_HOUR = 60;
const PLAN_FEAS_METER_SCALE = 1.5; // the meter is full at 150% of the time needed
const PLAN_PERCENT = 100;
let planGoalDraft = null; // { examDate, dailyMins, restDays, level } being edited

function planDefaultDraft(todayIso) {
  const d = PLAN_DEFAULT_GOAL;
  return { examDate: isoAddDays(todayIso, d.days), dailyMins: d.dailyMins, restDays: [...d.restDays], level: d.level };
}
function openPlanGoal() {
  if (!planVisible()) return;
  planGoalDraft = planDefaultDraft(planTodayIso());
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
function renderPlanDays(todayIso) {
  const days = isoDiffDays(todayIso, planGoalDraft.examDate);
  byId('planDaysVal').textContent = t('plan.goal.daysValue', { n: days });
  byId('planDaysChips').innerHTML = PLAN_EXAM_DAY_PRESETS.map(n => {
    const labelKey = PLAN_PRESET_LABEL_KEYS[n];
    return `<button type="button" class="chip${n === days ? ' active' : ''}" ${planPressed(n === days)} data-action="planSetDays" data-arg="${n}">${t(labelKey)}</button>`;
  }).join('');
  const input = byId('planExamDate'), range = planExamDateRange(todayIso);
  input.min = range.min;
  input.max = range.max;
  input.value = planGoalDraft.examDate;
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
  byId('planRestChips').innerHTML = Array.from({ length: PLAN_WEEK_DAYS }, (_, d) => {
    const on = planGoalDraft.restDays.includes(d);
    return `<button type="button" class="chip plan-rest${on ? ' active' : ''}" ${planPressed(on)} data-action="planToggleRest" data-arg="${d}">${t(`data.weekdays.${d}`)}</button>`;
  }).join('');
}
function renderPlanLevels() {
  byId('planLevelGrid').innerHTML = Object.keys(PLAN_LEVELS).map(k => {
    const on = k === planGoalDraft.level;
    return `<button type="button" class="mode-card${on ? ' selected' : ''}" ${planPressed(on)} data-action="planSetLevel" data-arg="${k}">`
      + `<div class="mode-icon" aria-hidden="true">${PLAN_LEVEL_ICONS[k]}</div><div class="mode-title">${t(`data.planLevels.${k}.label`)}</div>`
      + `<span class="plan-level-sub">${t(`data.planLevels.${k}.sub`)}</span></button>`;
  }).join('');
}

// ── feasibility + CTA ──
const PLAN_FEAS_LABEL_KEYS = { ok: 'plan.feas.ok', tight: 'plan.feas.tight', short: 'plan.feas.short' };
const PLAN_FEAS_MSG_KEYS = { ok: 'plan.feas.okMsg', tight: 'plan.feas.tightMsg', short: 'plan.feas.shortMsg' };
function renderPlanFeasibility(todayIso) {
  const f = planFeasibility(planGoalDraft, todayIso);
  const labelKey = PLAN_FEAS_LABEL_KEYS[f.status], msgKey = PLAN_FEAS_MSG_KEYS[f.status];
  byId('planFeasPill').className = 'plan-pill ' + f.status;
  byId('planFeasPill').textContent = t(labelKey);
  byId('planFeasDays').textContent = f.studyDays;
  byId('planFeasDaysSub').textContent = t('plan.feas.studyDaysSub', { total: f.studyDays + f.restCount, rest: f.restCount });
  byId('planFeasAvail').textContent = t('plan.feas.hours', { n: planHours(f.availMins) });
  byId('planFeasNeed').textContent = t('plan.feas.hours', { n: planHours(f.needMins) });
  const meter = byId('planFeasMeter');
  meter.className = 'plan-meter-fill ' + f.status;
  meter.style.width = Math.min(PLAN_PERCENT, Math.round(f.ratio * PLAN_PERCENT / PLAN_FEAS_METER_SCALE)) + '%';
  byId('planFeasMsg').textContent = t(msgKey, { n: planHours(f.diffMins), m: PLAN_MINS.step });
}
function renderPlanCta(todayIso) {
  const check = validatePlanGoal(planGoalDraft, todayIso);
  byId('planCreateBtn').disabled = !check.ok;
  const fewDays = check.errors.includes(PLAN_GOAL_ERROR.studyDays);
  byId('planGoalHint').textContent = fewDays ? t('plan.goal.minStudyDays', { n: PLAN_MIN_STUDY_DAYS }) : '';
  setShown('planGoalHint', fewDays);
  setShown('planFeasMsg', !fewDays); // its "build anyway" advice (G13) does not apply while the CTA is disabled
}
function renderPlanGoal() {
  if (!planGoalDraft) planGoalDraft = planDefaultDraft(planTodayIso());
  const todayIso = planTodayIso();
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
  renderPlanGoal();
}
// a date past the 6-month limit moves to the limit; an empty or too-early one is ignored
function planSetExamDate(value) {
  const range = planExamDateRange(planTodayIso());
  if (isoIsValid(value) && value >= range.min) planGoalDraft.examDate = value > range.max ? range.max : value;
  renderPlanGoal();
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
// O-2: a new plan never inherits the old log (or a corrupt one, O-1); the schedule screen is PR4, so Home for now
function planCreate() {
  const todayIso = planTodayIso();
  const plan = buildPlan(planGoalDraft, todayIso);
  if (!plan) return;
  clearStudyPlan();
  writeStudyPlan(plan);
  leaveToHome();
}
