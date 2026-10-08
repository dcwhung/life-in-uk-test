// ════════════════════════════════════════
// STUDY PLAN · HOME ENTRY — whether the feature shows (planEntryReady / planVisible), the ⓘ "Features" switch
// (on by default; off asks first, G15) and the Home card above "Choose Mode": the dashed gold "create" card
// without a plan, a small navy card with one (the full card with today's progress is PR5).
// The card is created only while it shows, so Home's DOM is unchanged while the entry is hidden.
// ════════════════════════════════════════
const PLAN_CARD_ID = 'planCard';

// G19 / G31: hidden until release, except on a device that opened ?preview=plan (tests may override this)
function planEntryReady() { return STUDY_PLAN_READY || isPlanPreviewOn(); }
function planVisible() { return planEntryReady() && isStudyPlanEnabled(); }

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
  byId('infoPlanSwitch').innerHTML = switchHtml({ id: 'planFeatureSwitch', on, action: 'togglePlanFeature',
    labelKey: 'app.planSwitchLabel', describedBy: 'infoPlanStatus' });
}
// off hides every plan item (plan and progress stay stored) and leaves the plan screens; on needs no confirm
function togglePlanFeature() {
  if (!isStudyPlanEnabled()) { setPlanFeature(true); return; }
  showConfirm({ title: t('modal.planOffTitle'), message: t('modal.planOffMessage'), okLabel: t('modal.planOffOk'),
    cancelLabel: t('modal.planOffCancel'), onOk: () => { setPlanFeature(false); leaveToHome(); }, focusCancel: true });
}
function setPlanFeature(on) {
  setStudyPlanEnabled(on);
  renderPlanSettings();
  renderPlanCard();
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
// PR3 stand-in until the full card (PR5): which day of how many, and the exam countdown
function planHomeCardHtml(plan, todayIso) {
  const total = plan.days.length;
  const n = Math.min(total, Math.max(1, isoDiffDays(plan.start, todayIso) + 1));
  const left = Math.max(0, isoDiffDays(todayIso, plan.goal.examDate));
  return `<div class="plan-home"><div class="plan-home-top"><span class="plan-home-ttl">${t('plan.cardTitle')}${LIST_SEP}`
    + `<span lang="en">${t('plan.dayOf', { n, total })}</span></span>`
    + `<span class="plan-home-cd">${t('plan.daysLeft', { n: left, date: planShortDate(plan.goal.examDate) })}</span></div></div>`;
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
  const plan = parseStoredPlan(readStudyPlan());
  el.innerHTML = plan ? planHomeCardHtml(plan, planTodayIso()) : planCreateCardHtml();
}
