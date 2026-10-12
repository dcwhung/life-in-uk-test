// ════════════════════════════════════════
// STUDY PLAN · HOME ENTRY — whether the feature shows (planEntryReady / planVisible), the ⚙ "Features" plan switch
// (on by default; off asks first, G15; v1.4.0: the Cantonese translation switch beside it), the Home card above "Choose Mode" (handoff §2.1; mockup step ⓪): the dashed
// gold "create" card without a plan; with one the navy card: Day n / N, days to the exam, today's % + bar, the next
// step, continue / view today + schedule; the exam day (G16) and, after it, "plan finished" with a summary and
// new plan / schedule (v2.0.0 F1: no change goal). The card is created only while it shows, so Home's DOM is unchanged while hidden.
// planWatchDay (G6): the plan's "today" moves at local midnight with the app open and on return to the foreground.
// ════════════════════════════════════════
const PLAN_CARD_ID = 'planCard';
// W-031 / G15: switching off leaves only these screens (PR5+: add each plan screen; plan-ui-test pins the list)
const PLAN_SCREEN_IDS = ['screenPlanGoal', 'screenPlanSchedule', 'screenPlanDay', 'screenPlanRun'];
const PLAN_MIDNIGHT_SLACK_S = 1; // the day check runs 1 s after local midnight
const FEATURE_PILL_ON_CLASS = 'on'; // ⚙ Features row pill colour (css/screens/plan.css .feature-pill)
const FEATURE_PILL_OFF_CLASS = 'off';

// G19: the release flag (v1.1.0: on); a function so tests can hide the entry (G42: no ?preview=plan any more)
function planEntryReady() { return STUDY_PLAN_READY; }
// CUI-0021: an older cached index.html lacks the plan screens, so the card would open nothing (or a PR3 shell: a goal
// screen whose "Build" opens a schedule it does not have)
function planShellReady() { return PLAN_SCREEN_IDS.every(id => !!byId(id)); }
function planVisible() { return planEntryReady() && planShellReady() && isStudyPlanEnabled(); }

// ── ⚙ popover (v1.2.0; ⓘ before): "Features" plan row (a pre-PR3 shell has no #infoPlanRow; v1.4.0: the row only,
// the section title stays for the translation row) ──
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
function renderPlanPill(on) { renderFeaturePill(byId('infoPlanPill'), on); }
// v1.4.0: shared by the plan and translation rows
function renderFeaturePill(pill, on) {
  if (!pill) return;
  const pillKey = on ? 'app.planOnPill' : 'app.planOffPill';
  pill.textContent = t(pillKey);
  pill.classList.toggle(FEATURE_PILL_ON_CLASS, on);
  pill.classList.toggle(FEATURE_PILL_OFF_CLASS, !on);
}
// v1.4.0: "🌐 Translation" row, shown whatever the plan entry does (a pre-v1.4.0 shell has no #settingsTransRow).
// W-057 / S-201: a pre-v1.4.0 store.js (no switch code) or locale (no row words) hides the row instead of a dead / raw one
function renderTranslationSetting() {
  const row = byId('settingsTransRow');
  if (!row) return;
  const labelKey = 'app.translationSwitchLabel';
  // S-203: a pre-v1.4.0 actions.js has no toggleTranslation handler — hide the row rather than a dead switch
  row.hidden = typeof isTranslationOn !== 'function' || typeof ACTIONS.toggleTranslation !== 'function' || t(labelKey) === labelKey;
  if (row.hidden) return;
  const on = isTranslationOn();
  const noteKey = on ? 'app.translationOnNote' : 'app.translationOffNote';
  byId('settingsTransStatus').textContent = t(noteKey);
  renderFeaturePill(byId('settingsTransPill'), on);
  // W-032: built once, then updated in place
  const sw = byId('translationSwitch');
  if (sw) {
    setSwitchOn(sw, on);
    sw.setAttribute('aria-label', t(labelKey));
    return;
  }
  byId('settingsTransSwitch').innerHTML = switchHtml({ id: 'translationSwitch', on, action: 'toggleTranslation',
    labelKey, describedBy: 'settingsTransStatus' });
}
function isOnPlanScreen() {
  const active = document.querySelector('.screen.active');
  return (!!active && PLAN_SCREEN_IDS.includes(active.id)) || isOnPlanSession(); // a plan task on the Practice screen too
}
// off hides every plan item (plan and progress stay stored) and leaves a plan screen (G15); elsewhere the current
// screen stays (W-031: an exam keeps running); on needs no confirm
// v1.2.0 (Q10): a choice closes the ⚙ popover; cancelling the "off" prompt leaves it open (nothing was chosen)
function togglePlanFeature() {
  if (!isStudyPlanEnabled()) { setSettingsOpen(false); setPlanFeature(true); return; }
  showConfirm({ title: t('modal.planOffTitle'), message: t('modal.planOffMessage'), okLabel: t('modal.planOffOk'),
    cancelLabel: t('modal.planOffCancel'), onOk: () => { setSettingsOpen(false); setPlanFeature(false); if (isOnPlanScreen()) leaveToHome(); },
    focusCancel: true, danger: true });
}
function setPlanFeature(on) {
  setStudyPlanEnabled(on);
  renderPlanSettings();
  renderPlanCard();
  renderResultPlanRow(); // QA O-3: a plan mock's result page stays (W-031), its plan row follows the switch
  if (typeof runRefits === 'function') runRefits(); // v2.0.0: the card's desktop fits (home.js homeRefit)
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
// the navy card (handoff §2.1): top line, then today / the exam day / "plan finished", then the actions.
// desktop (v2.0.0 F7, ≥ 1024px): today's ring and the countdown timeline instead of the % bar and countdown text
function planHomeCardHtml(plan, todayIso, desktop = false) {
  const status = planStatus(plan, todayIso), stored = planLoadLogView(), log = stored || planEmptyLog();
  let body;
  if (status === PLAN_STATUS.ended) body = planEndedHtml(plan, log, todayIso);
  else if (status === PLAN_STATUS.examDay) body = planExamDayHtml();
  else body = planActiveHtml(plan, log, todayIso, desktop);
  // PR4 review: an unreadable log reads as nothing answered; say where to clear it
  const warn = stored ? '' : `<p class="plan-home-warn">${t('plan.home.logBroken')}</p>`;
  // a pre-v2.0.0 cached planProgress.js has no planCountdown: the desktop card then keeps the countdown text
  const timeline = desktop && status === PLAN_STATUS.active && typeof planCountdown === 'function' && !!planCountdown(plan, todayIso);
  return `<div class="plan-home">${planHomeTopHtml(plan, todayIso, status, timeline)}${body}${warn}</div>`;
}
// timeline: the desktop countdown timeline says how many days are left, so the top line drops its countdown text
function planHomeTopHtml(plan, todayIso, status, timeline = false) {
  const total = plan.days.length;
  const n = Math.min(total, Math.max(1, planDayNumber(plan, todayIso)));
  let tag = `<span lang="en">${t('plan.dayOf', { n, total })}</span>`;
  if (status === PLAN_STATUS.examDay) tag = `<span>${t('plan.schedule.examDay')}</span>`;
  if (status === PLAN_STATUS.ended) tag = `<span>${t('plan.home.endedTitle')}</span>`;
  const left = Math.max(0, isoDiffDays(todayIso, plan.goal.examDate));
  const cd = status === PLAN_STATUS.active && !timeline ? `<span class="plan-home-cd">${t('plan.daysLeft', { n: left, date: planShortDate(plan.goal.examDate) })}</span>` : '';
  return `<div class="plan-home-top"><span class="plan-home-ttl">${t('plan.cardTitle')}${LIST_SEP}${tag}</span>${cd}</div>`;
}
function planHomeBtn(action, labelText, gold = false) {
  return `<button type="button" class="${gold ? 'plan-btn-gold' : 'plan-btn-line'}" data-action="${action}">${labelText}</button>`;
}
function planHomeActsHtml(...btns) { return `<div class="plan-home-acts">${btns.join('')}</div>`; }
// "Continue" opens the next task itself, whatever its type (planRun.js planOpenTask)
const PLAN_HOME_GO = { done: { action: 'openPlanDay', labelKey: 'plan.home.viewToday' }, next: { action: 'planContinue', labelKey: 'plan.home.continue' } };
function planActiveHtml(plan, log, todayIso, desktop = false) {
  const day = planDayAt(plan, todayIso);
  const schedule = planHomeBtn('openPlanSchedule', t('plan.schedule.name'));
  if (!day) return `<p class="plan-home-next">${t('plan.home.notStarted', { date: planShortDate(plan.start) })}</p>${planHomeActsHtml(schedule)}`;
  const pct = planDayCompletion(day, planDayLog(log, todayIso)).pct;
  const next = planNextStep(plan, log, todayIso);
  const go = next.kind === PLAN_NEXT.done ? PLAN_HOME_GO.done : PLAN_HOME_GO.next;
  const nextHtml = `<p class="plan-home-next">${planNextHtml(plan, log, next)}</p>`;
  const acts = planHomeActsHtml(planHomeBtn(go.action, t(go.labelKey), true), schedule);
  if (desktop) return nextHtml + planCountdownHtml(plan, todayIso) + planHomeRingHtml(pct) + acts;
  return planHomePctHtml(pct) + nextHtml + acts;
}
// ── v2.0.0 F7 (desktop; grill 2026-10-12 implementation notes, mockup desktop-home-plan.html A rev 7): today's ring and the
// countdown timeline. The ring is Plan Day's (.plan-ring) on the navy card; a rest day shows 😴 in its place ──
const PLAN_HOME_RING = { view: 112, c: 56, r: 46, pctY: 58, subY: 76 }; // = index.html #planRing
function planHomeRingHtml(pct) {
  if (pct === null) return `<span class="plan-home-ring plan-home-rest" aria-hidden="true">${PLAN_REST_ICON}</span><span class="plan-sr">${t('plan.home.restToday')}</span>`;
  const { view, c, r, pctY, subY } = PLAN_HOME_RING;
  const pctText = t('plan.status.pct', { n: pct }), sub = t('plan.day.ringToday');
  return `<svg class="plan-ring plan-home-ring" viewBox="0 0 ${view} ${view}" role="img" aria-label="${escapeHtml(`${sub} ${pctText}`)}">`
    + `<circle class="plan-ring-track" cx="${c}" cy="${c}" r="${r}"></circle>`
    + `<circle class="plan-ring-prog h${planPctBand(pct)}${pct ? '' : ' empty'}" cx="${c}" cy="${c}" r="${r}" pathLength="${PERCENT}" data-pct="${pct}"></circle>`
    + `<text class="plan-ring-pct plan-num" x="${c}" y="${pctY}" text-anchor="middle">${pctText}</text>`
    + `<text class="plan-ring-sub" x="${c}" y="${subY}" text-anchor="middle">${sub}</text></svg>`;
}
// the whole plan as one bar in phase colours (planCountdown: a cell a day up to 6 weeks, else a bar a phase + month
// ticks); a gold bracket from today to the exam with the days left; "Today" over the gold marker; start and exam dates.
// Positions go in as data-* and are applied after render (planApplyCardSizes), as the % bars; screen readers get the
// countdown sentence the phone shows instead of the drawing
function planCountdownHtml(plan, todayIso) {
  const cd = typeof planCountdown === 'function' ? planCountdown(plan, todayIso) : null;
  if (!cd) return '';
  const runs = cd.runs.map(r => `<i class="plan-cd-${r.phase}${r.future ? ' future' : ''}" data-flex="${r.days}"></i>`).join('');
  const ticks = cd.months.map(m => `<span class="plan-cd-tick" data-at="${m.at}">${t(`data.monthsShort.${m.month}`)}</span>`).join('');
  return `<div class="plan-cd${cd.perDay ? '' : ' long'}" data-at="${cd.at}">`
    + `<span class="plan-sr">${t('plan.daysLeft', { n: cd.left, date: planShortDate(cd.exam) })}</span>`
    + `<div class="plan-cd-left" aria-hidden="true"><span class="plan-cd-left-lbl${cd.labelEnd ? ' end' : ''}">${t('plan.home.cdLeftHtml', { n: cd.left })}</span></div>`
    + `<div class="plan-cd-track" aria-hidden="true">${runs}<span class="plan-cd-today"></span><span class="plan-cd-today-lbl">${t('plan.calendar.today')}</span></div>`
    + (ticks ? `<div class="plan-cd-under" aria-hidden="true">${ticks}</div>` : '')
    + `<div class="plan-cd-ends" aria-hidden="true"><span>${t('plan.home.cdStart', { date: planShortDate(cd.start) })}</span>`
    + `<span>${t('plan.home.cdExam', { date: planShortDate(cd.exam) })}</span></div></div>`;
}
function planApplyCardSizes(el) {
  el.querySelectorAll('.plan-home-bar i').forEach(i => { i.style.width = i.dataset.pct + '%'; }); // as #progressFill
  el.querySelectorAll('.plan-home-ring .plan-ring-prog').forEach(c => { c.style.strokeDashoffset = PERCENT - Number(c.dataset.pct); });
  el.querySelectorAll('.plan-cd').forEach(cd => cd.style.setProperty('--plan-cd-at', cd.dataset.at + '%'));
  el.querySelectorAll('.plan-cd-track > i').forEach(i => { i.style.flexGrow = i.dataset.flex; });
  el.querySelectorAll('.plan-cd-tick').forEach(s => { s.style.left = s.dataset.at + '%'; });
}
// desktop fits (home.js homeRefit, after every render): "Next" stays on one line while it fits, else wraps (never cut);
// the timeline's labels stay inside it and off each other (planFitCountdown)
const PLAN_HOME_WRAPPED_CLASS = 'is-wrapped';
const PLAN_CD_LABEL_AFTER_CLASS = 'after';
const PLAN_CD_TICK_END_CLASS = 'end';
function fitPlanCard(desktop) {
  const el = byId(PLAN_CARD_ID);
  if (!el) return;
  el.querySelectorAll('.plan-home-next').forEach(n => {
    n.classList.remove(PLAN_HOME_WRAPPED_CLASS);
    if (desktop) n.classList.toggle(PLAN_HOME_WRAPPED_CLASS, n.scrollWidth > n.clientWidth + 1);
  });
  el.querySelectorAll('.plan-cd').forEach(planFitCountdown);
}
const planRectsOverlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
// "Today" sits left of the marker; on the first days (no room there) on its right. Near the exam the days-left label,
// at the bracket's end, may reach back over the marker: "Today" then moves left of that label (still beside the gold
// bracket that starts at the marker). A month tick whose label would run past the bar's end hangs to the left
function planFitCountdown(cd) {
  const lbl = cd.querySelector('.plan-cd-today-lbl'), left = cd.querySelector('.plan-cd-left-lbl');
  lbl.classList.remove(PLAN_CD_LABEL_AFTER_CLASS);
  lbl.style.removeProperty('right');
  const box = cd.getBoundingClientRect();
  if (lbl.getBoundingClientRect().left < box.left) lbl.classList.add(PLAN_CD_LABEL_AFTER_CLASS);
  const leftBox = left.getBoundingClientRect();
  if (planRectsOverlap(lbl.getBoundingClientRect(), leftBox)) {
    lbl.classList.remove(PLAN_CD_LABEL_AFTER_CLASS);
    const track = cd.querySelector('.plan-cd-track').getBoundingClientRect();
    lbl.style.right = `${track.right - leftBox.left}px`; // the label's own margin keeps the gap
  }
  cd.querySelectorAll('.plan-cd-tick').forEach(tick => {
    tick.classList.remove(PLAN_CD_TICK_END_CLASS);
    tick.classList.toggle(PLAN_CD_TICK_END_CLASS, tick.getBoundingClientRect().right > box.right);
  });
}
// the layout the card was last drawn for: home.js redraws it when the window crosses 1024px
let planCardDesktop = false;
function planCardDrawnForDesktop() { return planCardDesktop; }
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
// G16: after the exam: a summary, then a new plan; the schedule and calendar stay readable. v2.0.0 F1 (user 2026-10-12):
// no "Change goal" any more: once the plan is over, changing its goal is the same as building a new plan
function planEndedHtml(plan, log, todayIso) {
  const k = planKpis(plan, log, todayIso);
  const mocks = t('plan.home.endedMocks', { n: k.safeMocks, safe: PLAN_SAFE_SCORE, total: REAL_TEST_SIZE }); // S-116
  const summary = t('plan.home.endedSummary', { avg: k.avgPct, facts: k.factsDone, factsTotal: k.factsTotal,
    qs: k.qidsDone, qsTotal: k.qidsTotal, mocks });
  return `<p class="plan-home-next">${summary}</p>` + planHomeActsHtml(planHomeBtn('openPlanGoal', t('plan.home.newPlan'), true),
    planHomeBtn('openPlanSchedule', t('plan.schedule.name')));
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
  planCardDesktop = typeof isDesktop === 'function' && isDesktop(); // a pre-v2.0.0 cached shell has no fit.js
  el.innerHTML = plan ? planHomeCardHtml(plan, planTodayIso(), planCardDesktop) : planCreateCardHtml();
  planApplyCardSizes(el);
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
  screenHome: () => { renderPlanCard(); if (typeof runRefits === 'function') runRefits(); },
  screenPlanDay: () => { ensurePlanToday(); renderPlanDay(); }, // a day being looked at stays; "today" moves on
  screenPlanSchedule: () => rerenderPlanSchedule(),
  screenPlanGoal: () => renderPlanGoal(), // S-111: the date limits move with the day
  screenPlanRun: () => renderPlanRun(), // a Result card of "today" lists the new day's next task
};
