// ════════════════════════════════════════
// STUDY PLAN · HOME ENTRY — whether the feature shows (planEntryReady / planVisible), the ⓘ "Features" switch
// (on by default; off asks first, G15), the Home card above "Choose Mode" (handoff §2.1; mockup step ⓪): the dashed
// gold "create" card without a plan; with one the navy card: Day n / N, days to the exam, today's % + bar, the next
// step, continue / view today + schedule; the exam day (G16) and, after it, "plan finished" with a summary and
// new plan / change goal. The card is created only while it shows, so Home's DOM is unchanged while hidden.
// planWatchDay (G6): the plan's "today" moves at local midnight with the app open and on return to the foreground.
// ════════════════════════════════════════
const PLAN_CARD_ID = 'planCard';
// W-031 / G15: switching off leaves only these screens (PR5+: add each plan screen; plan-ui-test pins the list)
const PLAN_SCREEN_IDS = ['screenPlanGoal', 'screenPlanSchedule', 'screenPlanDay', 'screenPlanRun'];
const PLAN_MIDNIGHT_SLACK_S = 1; // the day check runs 1 s after local midnight
const FEATURE_PILL_ON_CLASS = 'on'; // ⓘ Features row pill colour (css/screens/plan.css .feature-pill)
const FEATURE_PILL_OFF_CLASS = 'off';

// G19 / G31: hidden until release, except on a device that opened ?preview=plan (tests may override this)
function planEntryReady() { return STUDY_PLAN_READY || isPlanPreviewOn(); }
// CUI-0021: an older cached index.html lacks the plan screens, so the card would open nothing (or a PR3 shell: a goal
// screen whose "Build" opens a schedule it does not have)
function planShellReady() { return PLAN_SCREEN_IDS.every(id => !!byId(id)); }
function planVisible() { return planEntryReady() && planShellReady() && isStudyPlanEnabled(); }

// G31: ?preview=plan / ?preview=off update the stored preview, then the param leaves the URL
function applyPlanPreviewParam() {
  const url = new URL(location.href);
  const value = url.searchParams.get(PLAN_PREVIEW_PARAM);
  if (value !== PLAN_PREVIEW_ON && value !== PLAN_PREVIEW_OFF) return;
  setPlanPreview(value === PLAN_PREVIEW_ON);
  url.searchParams.delete(PLAN_PREVIEW_PARAM);
  try { history.replaceState(history.state, '', url.href); } catch {}
}

// ── ⓘ popover: "Features" row (a pre-PR3 shell has no #infoPlanRow) ──
function renderPlanSettings() {
  const row = byId('infoPlanRow');
  if (!row) return;
  row.hidden = !planEntryReady();
  if (row.hidden) return;
  const on = isStudyPlanEnabled();
  const noteKey = on ? 'app.planOnNote' : 'app.planOffNote';
  byId('infoPlanStatus').textContent = t(noteKey);
  renderPlanPill(on);
  // W-032: built once, then updated in place (a replaced button would close the popover and drop focus)
  const sw = byId('planFeatureSwitch');
  if (sw) {
    setSwitchOn(sw, on);
    sw.setAttribute('aria-label', t('app.planSwitchLabel'));
    return;
  }
  byId('infoPlanSwitch').innerHTML = switchHtml({ id: 'planFeatureSwitch', on, action: 'togglePlanFeature',
    labelKey: 'app.planSwitchLabel', describedBy: 'infoPlanStatus' });
}
// v1.0.5: On (green) / Off (red) pill after "Study plan" (a pre-v1.0.5 shell has no #infoPlanPill)
function renderPlanPill(on) {
  const pill = byId('infoPlanPill');
  if (!pill) return;
  const pillKey = on ? 'app.planOnPill' : 'app.planOffPill';
  pill.textContent = t(pillKey);
  pill.classList.toggle(FEATURE_PILL_ON_CLASS, on);
  pill.classList.toggle(FEATURE_PILL_OFF_CLASS, !on);
}
function isOnPlanScreen() {
  const active = document.querySelector('.screen.active');
  return (!!active && PLAN_SCREEN_IDS.includes(active.id)) || isOnPlanSession(); // a plan task on the Practice screen too
}
// off hides every plan item (plan and progress stay stored) and leaves a plan screen (G15); elsewhere the current
// screen stays (W-031: an exam keeps running); on needs no confirm
function togglePlanFeature() {
  if (!isStudyPlanEnabled()) { setPlanFeature(true); return; }
  showConfirm({ title: t('modal.planOffTitle'), message: t('modal.planOffMessage'), okLabel: t('modal.planOffOk'),
    cancelLabel: t('modal.planOffCancel'), onOk: () => { setPlanFeature(false); if (isOnPlanScreen()) leaveToHome(); }, focusCancel: true, danger: true });
}
function setPlanFeature(on) {
  setStudyPlanEnabled(on);
  renderPlanSettings();
  renderPlanCard();
  renderResultPlanRow(); // QA O-3: a plan mock's result page stays (W-031), its plan row follows the switch
  const toastKey = on ? 'plan.toastOn' : 'plan.toastOff';
  showToast(t(toastKey));
}

// ── Home card ──
function planShortDate(iso) {
  const [, m, d] = isoParts(iso);
  return `${d}/${m}`;
}
function planCreateCardHtml() {
  return `<button type="button" class="plan-cta" data-action="openPlanGoal"><span class="plan-cta-ic" aria-hidden="true">🗓️</span>`
    + `<span><b>${t('plan.createTitle')}</b><span class="plan-muted">${t('plan.createText')}</span></span>`
    + `<span class="plan-cta-go">${t('plan.createGo')}</span></button>`;
}
// the navy card (handoff §2.1): top line, then today / the exam day / "plan finished", then the actions
function planHomeCardHtml(plan, todayIso) {
  const status = planStatus(plan, todayIso), stored = planLoadLogView(), log = stored || planEmptyLog();
  let body;
  if (status === PLAN_STATUS.ended) body = planEndedHtml(plan, log, todayIso);
  else if (status === PLAN_STATUS.examDay) body = planExamDayHtml();
  else body = planActiveHtml(plan, log, todayIso);
  // PR4 review: an unreadable log reads as nothing answered; say where to clear it
  const warn = stored ? '' : `<p class="plan-home-warn">${t('plan.home.logBroken')}</p>`;
  return `<div class="plan-home">${planHomeTopHtml(plan, todayIso, status)}${body}${warn}</div>`;
}
function planHomeTopHtml(plan, todayIso, status) {
  const total = plan.days.length;
  const n = Math.min(total, Math.max(1, planDayNumber(plan, todayIso)));
  let tag = `<span lang="en">${t('plan.dayOf', { n, total })}</span>`;
  if (status === PLAN_STATUS.examDay) tag = `<span>${t('plan.schedule.examDay')}</span>`;
  if (status === PLAN_STATUS.ended) tag = `<span>${t('plan.home.endedTitle')}</span>`;
  const left = Math.max(0, isoDiffDays(todayIso, plan.goal.examDate));
  const cd = status === PLAN_STATUS.active ? `<span class="plan-home-cd">${t('plan.daysLeft', { n: left, date: planShortDate(plan.goal.examDate) })}</span>` : '';
  return `<div class="plan-home-top"><span class="plan-home-ttl">${t('plan.cardTitle')}${LIST_SEP}${tag}</span>${cd}</div>`;
}
function planHomeBtn(action, labelText, gold = false) {
  return `<button type="button" class="${gold ? 'plan-btn-gold' : 'plan-btn-line'}" data-action="${action}">${labelText}</button>`;
}
function planHomeActsHtml(...btns) { return `<div class="plan-home-acts">${btns.join('')}</div>`; }
// "Continue" opens the next task itself, whatever its type (planRun.js planOpenTask)
const PLAN_HOME_GO = { done: { action: 'openPlanDay', labelKey: 'plan.home.viewToday' }, next: { action: 'planContinue', labelKey: 'plan.home.continue' } };
function planActiveHtml(plan, log, todayIso) {
  const day = planDayAt(plan, todayIso);
  const schedule = planHomeBtn('openPlanSchedule', t('plan.schedule.name'));
  if (!day) return `<p class="plan-home-next">${t('plan.home.notStarted', { date: planShortDate(plan.start) })}</p>${planHomeActsHtml(schedule)}`;
  const pct = planDayCompletion(day, planDayLog(log, todayIso)).pct;
  const next = planNextStep(plan, log, todayIso);
  const go = next.kind === PLAN_NEXT.done ? PLAN_HOME_GO.done : PLAN_HOME_GO.next;
  return planHomePctHtml(pct) + `<p class="plan-home-next">${planNextHtml(plan, log, next)}</p>`
    + planHomeActsHtml(planHomeBtn(go.action, t(go.labelKey), true), schedule);
}
// today's own % (G8: carry-over not counted) + a G27 bar; a rest day has none
function planHomePctHtml(pct) {
  if (pct === null) return `<div class="plan-home-row"><span>${t('plan.home.restToday')}</span></div>`;
  return `<div class="plan-home-row"><span>${t('plan.home.pctLabel')}</span><b class="plan-home-pct plan-num">${t('plan.status.pct', { n: pct })}</b></div>`
    + `<div class="plan-home-bar" aria-hidden="true"><i class="h${planPctBand(pct)}" data-pct="${pct}"></i></div>`;
}
// "Next: <task> (continue from #74)"; a catch-up task names its day; all done: "✓ Done for today"
function planNextHtml(plan, log, next) {
  if (next.kind === PLAN_NEXT.done) return t('plan.home.doneHtml');
  const day = planDayAt(plan, next.date), task = day.tasks[next.taskIndex];
  const p = planTaskProgress(task, planDayLog(log, next.date));
  const params = { task: planTaskText(task, day, { fullCh: true }), more: planResumeText(task, p, next.resumeAt) };
  if (next.kind === PLAN_NEXT.today) return t('plan.home.nextHtml', params);
  return t('plan.home.nextCarryHtml', { ...params, day: `<span lang="en">${t('plan.dayN', { n: planDayNumber(plan, next.date) })}</span>` });
}
function planResumeText(task, p, resumeAt) {
  if (!p.done) return '';
  if (Array.isArray(task.qids)) return t('plan.home.resumeQs', { done: p.done, total: p.total });
  return resumeAt ? t('plan.home.resumeFact', { n: chapterFactNumber(resumeAt) }) : '';
}
function planExamDayHtml() {
  return `<p class="plan-home-next"><b>${t('plan.home.examDayText')}</b></p>`
    + planHomeActsHtml(planHomeBtn('openPlanDay', t('plan.home.viewDay'), true), planHomeBtn('openPlanSchedule', t('plan.schedule.name')));
}
// G16: after the exam: a summary, then a new plan / change goal; the schedule and calendar stay readable
function planEndedHtml(plan, log, todayIso) {
  const k = planKpis(plan, log, todayIso);
  const mocks = t('plan.home.endedMocks', { n: k.safeMocks, safe: PLAN_SAFE_SCORE, total: REAL_TEST_SIZE }); // S-116
  const summary = t('plan.home.endedSummary', { avg: k.avgPct, facts: k.factsDone, factsTotal: k.factsTotal,
    qs: k.qidsDone, qsTotal: k.qidsTotal, mocks });
  return `<p class="plan-home-next">${summary}</p>` + planHomeActsHtml(planHomeBtn('openPlanGoal', t('plan.home.newPlan'), true),
    planHomeBtn('planEditGoal', t('plan.schedule.editGoal')), planHomeBtn('openPlanSchedule', t('plan.schedule.name')));
}
function planCardEl() {
  let el = byId(PLAN_CARD_ID);
  const banner = byId('installBanner');
  if (el || !banner) return el;
  el = document.createElement('div');
  el.id = PLAN_CARD_ID;
  el.className = 'plan-card';
  banner.after(el);
  return el;
}
function renderPlanCard() {
  if (!planVisible()) { const old = byId(PLAN_CARD_ID); if (old) old.remove(); return; }
  const el = planCardEl();
  if (!el) return;
  const plan = ensurePlanToday(); // G9: the card's first render of a day fixes today's contents (no plan: no write)
  el.innerHTML = plan ? planHomeCardHtml(plan, planTodayIso()) : planCreateCardHtml();
  el.querySelectorAll('.plan-home-bar i').forEach(i => { i.style.width = i.dataset.pct + '%'; }); // as #progressFill
}

// ── G6: a new local day while the app is open (midnight timer) or after it comes back to the foreground ──
let planWatchedIso = null;
let planWatchTimer = null;
let planWatchBound = false;
function planWatchDay() {
  planWatchedIso = planTodayIso();
  planArmMidnight();
  if (planWatchBound) return;
  planWatchBound = true;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') planCheckNewDay(); });
}
function planArmMidnight() {
  clearTimeout(planWatchTimer);
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, PLAN_MIDNIGHT_SLACK_S);
  planWatchTimer = setTimeout(() => { planCheckNewDay(); planArmMidnight(); }, next - now);
}
function planCheckNewDay() {
  const todayIso = planTodayIso();
  if (todayIso === planWatchedIso) return;
  planWatchedIso = todayIso;
  if (!planVisible()) return;
  const active = document.querySelector('.screen.active');
  const render = active && PLAN_NEW_DAY_RENDER[active.id];
  if (render) render();
}
// the screens that show "today"; another screen (an exam running) is left alone and catches up when it opens
const PLAN_NEW_DAY_RENDER = {
  screenHome: () => renderPlanCard(),
  screenPlanDay: () => { ensurePlanToday(); renderPlanDay(); }, // a day being looked at stays; "today" moves on
  screenPlanSchedule: () => rerenderPlanSchedule(),
  screenPlanGoal: () => renderPlanGoal(), // S-111: the date limits move with the day
  screenPlanRun: () => renderPlanRun(), // a Result card of "today" lists the new day's next task
};
