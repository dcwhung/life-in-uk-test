const { chromium } = require('playwright-core');
const path = require('path');
// Study plan PR3 (T-314–T-318; handoff §2.1 / §2.2, grill G13 / G15 / G28 / G31): the ⓘ switch, the home
// "create a study plan" card and the goal screen. The entry stays hidden (STUDY_PLAN_READY = false) unless
// ?preview=plan (G31, remembered per device) or a test override of planEntryReady().
// - hidden: no card, no ⓘ row, openPlanGoal() does nothing, start-up writes no plan key
// - G31: ?preview=plan / ?preview=off persist / clear the preview and are removed from the URL (replaceState)
// - switch: on by default (no write), off asks in the app modal (G15: leaves the plan screens), on does not
// - goal screen: presets, date min / max / clamp, slider ticks, rest days, level cards, the three feasibility
//   states (G13: short still builds), fewer than 7 study days disables the CTA with a hint (G28)
// - create: clears the old plan + log first (PR1 O-2; O-1: a corrupt plan shows the create card again), then the
//   schedule opens (PR4: tests/plan-schedule-test.js covers it)
// - 320 / 360 / 375 / 390 / 400px en + zh-HK: no horizontal scroll; [hidden] is never shown by a component display rule;
//   v1.0.2: presets share the card width, the date picker on its own row, the 7 rest day chips on one row
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const TODAY = '2026-10-08';
const PREVIEW_LS = 'lifeuk.studyPlanPreview';
const NOW = new Date(TODAY + 'T09:00:00');
const WIDTHS = [320, 360, 375, 390, 400];
const HIT_MIN_PX = 44;
const TICKS_EN = ['30 min', '45 min', '1 hr', '15 min', '30 min', '45 min', '2 hr'];
const TICKS_ZH = ['30 分鐘', '45 分鐘', '1 小時', '15 分', '30 分', '45 分', '2 小時'];

// plan data / switch keys (the G31 preview flag is checked on its own)
const planKeys = pg => pg.evaluate(k => Object.keys(localStorage).filter(x => x.startsWith('lifeuk.studyPlan') && x !== k), PREVIEW_LS);
const visible = (pg, sel) => pg.evaluate(sel => { const e = document.querySelector(sel); return !!e && e.getClientRects().length > 0; }, sel);
const activeScreen = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
const text = (pg, sel) => pg.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
const goalDraft = pg => pg.evaluate(() => JSON.parse(JSON.stringify(planGoalDraft)));
const openGoal = async pg => { await pg.click('#planCard .plan-cta'); assert(await activeScreen(pg) === 'screenPlanGoal', 'create card opens the goal screen'); };
const fresh = async (pg, query = '') => {
  await pg.goto(APP_URL + query);
  await pg.evaluate(() => localStorage.clear());
  await pg.goto(APP_URL + query);
};

async function checkHidden(pg) {
  await fresh(pg);
  assert(!(await visible(pg, '#planCard')), 'hidden: no plan card on Home');
  await pg.click('#infoBtn');
  assert(!(await visible(pg, '#infoPlanRow')), 'hidden: the ⓘ popover has no Features row');
  await pg.click('#infoBtn');
  await pg.evaluate(() => openPlanGoal());
  assert(await activeScreen(pg) === 'screenHome', 'hidden: openPlanGoal() stays on Home');
  assert((await planKeys(pg)).length === 0, 'hidden: start-up writes no study plan key');
}

async function checkPreview(pg) {
  await fresh(pg, '?preview=plan');
  const url = await pg.evaluate(() => location.href);
  assert(!url.includes('preview'), 'G31: ?preview=plan is removed from the URL: ' + url);
  assert(await pg.evaluate(k => localStorage.getItem(k), PREVIEW_LS) === 'true', 'G31: preview remembered in localStorage');
  assert(await visible(pg, '#planCard .plan-cta'), 'G31: preview shows the create card');
  await pg.goto(APP_URL);
  assert(await visible(pg, '#planCard .plan-cta'), 'G31: preview survives a reload without the param');
  await pg.goto(APP_URL + '?preview=off');
  assert(!(await pg.evaluate(() => location.href)).includes('preview'), 'G31: ?preview=off is removed from the URL');
  assert(await pg.evaluate(k => localStorage.getItem(k), PREVIEW_LS) === null, 'G31: ?preview=off clears the stored preview');
  assert(!(await visible(pg, '#planCard')), 'G31: preview off hides the card again');
  await pg.goto(APP_URL + '?preview=plan&x=1#top');
  const kept = await pg.evaluate(() => location.search + location.hash);
  assert(kept === '?x=1#top', 'G31: other params and the hash are kept: ' + kept);
}

async function checkCreateCard(pg) {
  await fresh(pg, '?preview=plan');
  const order = await pg.evaluate(() => {
    const card = byId('planCard');
    const title = document.querySelector('#screenHome > .section-title');
    return !!(card.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  assert(order, 'create card sits above "Choose Mode"');
  assert((await text(pg, '#planCard .plan-cta')).includes('Create a study plan'), 'create card: en title');
  const look = await pg.$eval('#planCard .plan-cta', e => getComputedStyle(e).borderTopStyle);
  assert(look === 'dashed', 'create card: dashed gold border (mockup state A)');
}

async function checkSwitch(pg) {
  await fresh(pg, '?preview=plan');
  await pg.click('#infoBtn');
  assert(await visible(pg, '#infoPlanRow'), 'switch: ⓘ popover shows the Features row');
  const sw = '#planFeatureSwitch';
  assert(await pg.getAttribute(sw, 'role') === 'switch' && await pg.getAttribute(sw, 'aria-checked') === 'true', 'switch: role=switch, on by default');
  assert((await planKeys(pg)).length === 0, 'switch: rendering on by default writes nothing');
  const hit = await pg.evaluate(({ s, min }) => {
    const e = document.querySelector(s), r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return document.elementFromPoint(cx, cy - min / 2 + 1) === e && document.elementFromPoint(cx, cy + min / 2 - 1) === e
      && document.elementFromPoint(cx - min / 2 + 1, cy) === e;
  }, { s: sw, min: HIT_MIN_PX });
  assert(hit, `switch: hit area at least ${HIT_MIN_PX}px`);
  await pg.click(sw);
  assert(await pg.evaluate(() => isConfirmOpen()), 'switch off: asks in the app modal');
  assert((await text(pg, '#confirmMsg')).includes('leave'), 'switch off: the message says the plan screens are left (G15)');
  assert(await text(pg, '#confirmOk') === 'Confirm' && await text(pg, '#confirmCancel') === 'Cancel', 'switch off modal: Confirm / Cancel');
  await pg.click('#confirmCancel');
  assert(await pg.evaluate(() => isStudyPlanEnabled()) && (await planKeys(pg)).length === 0, 'switch off → Cancel: still on, nothing written');
  assert(await visible(pg, sw), 'S-112: after Cancel the popover stays open on the switch');
  await pg.evaluate(() => openPlanGoal());
  await pg.click(sw);
  await pg.click('#confirmOk');
  assert(await pg.evaluate(k => localStorage.getItem(k), 'lifeuk.studyPlanEnabled') === 'false', 'switch off → OK: stored off');
  assert(await activeScreen(pg) === 'screenHome', 'switch off on the goal screen: back to Home (G15)');
  assert(!(await visible(pg, '#planCard')), 'switch off: no plan card on Home');
  await pg.evaluate(() => openPlanGoal());
  assert(await activeScreen(pg) === 'screenHome', 'switch off: the goal screen cannot be opened');
  assert(await visible(pg, sw) && await pg.getAttribute(sw, 'aria-checked') === 'false', 'switch off: the popover (still open, S-112) shows it off');
  await pg.click(sw);
  assert(!(await pg.evaluate(() => isConfirmOpen())), 'switch on: no confirm');
  assert(await pg.getAttribute(sw, 'aria-checked') === 'true' && await visible(pg, '#planCard .plan-cta'), 'switch on: card back at once');
  await pg.keyboard.press('Escape');
}

async function checkGoalDefaults(pg) {
  await fresh(pg, '?preview=plan');
  await openGoal(pg);
  const d = await goalDraft(pg);
  assert(d.examDate === '2026-10-29' && d.dailyMins === 120 && JSON.stringify(d.restDays) === '[0]' && d.level === 'none',
    'goal defaults: 3 weeks, 2 hours, Sunday rest, starting fresh: ' + JSON.stringify(d));
  const chips = await pg.$$eval('#planDaysChips .chip', els => els.map(e => [e.textContent, e.classList.contains('active'), e.getAttribute('aria-pressed')]));
  assert(JSON.stringify(chips.map(c => c[0])) === JSON.stringify(['2 weeks', '3 weeks', '4 weeks', '1.5 months']) && chips[1][1] && chips[1][2] === 'true',
    'exam presets 14 / 21 / 28 / 42 days, 3 weeks active: ' + JSON.stringify(chips));
  const range = await pg.$eval('#planExamDate', e => [e.min, e.max, e.value]);
  assert(range[0] === '2026-10-15' && range[1] === '2027-04-08' && range[2] === '2026-10-29', 'date picker: min today + 7, max today + 6 months: ' + range);
  assert(await text(pg, '#planDaysVal') === '21 days', 'days value: 21 days');
  const ticks = await pg.$$eval('#planMinsTicks span', els => els.map(e => e.textContent));
  assert(JSON.stringify(ticks) === JSON.stringify(TICKS_EN), 'slider ticks (no "1 hr" after the first hour): ' + ticks);
  const slider = await pg.$eval('#planMins', e => [e.min, e.max, e.step, e.value]);
  assert(slider.join() === '30,120,15,120', 'slider 30–120 step 15: ' + slider);
  const rest = await pg.$$eval('#planRestChips .chip', els => els.map(e => [e.textContent, e.classList.contains('active')]));
  assert(rest.length === 7 && rest[0][0] === 'Sun' && rest[0][1] && rest.filter(r => r[1]).length === 1, 'rest chips Sun–Sat, Sunday active');
  const levels = await pg.$$eval('#planLevelGrid .mode-card', els => els.map(e => [e.dataset.arg, e.classList.contains('selected')]));
  assert(levels.map(l => l[0]).join() === 'none,some,exam' && levels[0][1], 'level .mode-card ×3, first selected');
  assert(await pg.$eval('#screenPlanGoal .quiz-header .back-btn', e => !!e) && await pg.$$eval('#screenPlanGoal .chip-row', e => e.length) >= 2,
    'reuses .quiz-header / .back-btn / .chip-row');
}

async function checkGoalInputs(pg) {
  await pg.click('#planDaysChips .chip >> nth=3');
  assert((await goalDraft(pg)).examDate === '2026-11-19' && await text(pg, '#planDaysVal') === '42 days', 'preset 1.5 months → 42 days');
  const blurDate = () => pg.$eval('#planExamDate', e => e.blur());
  await pg.fill('#planExamDate', '2026-12-25');
  assert((await goalDraft(pg)).examDate === '2026-12-25' && !(await pg.$$eval('#planDaysChips .chip.active', e => e.length)), 'typed date: no preset active');
  await pg.fill('#planExamDate', '2027-09-01');
  await blurDate();
  assert((await goalDraft(pg)).examDate === '2027-04-08', 'date past 6 months clamps to the max when the field is left');
  await pg.fill('#planExamDate', '2026-10-10');
  await blurDate();
  assert((await goalDraft(pg)).examDate === '2027-04-08' && await pg.$eval('#planExamDate', e => e.value) === '2027-04-08', 'date before today + 7 is ignored');
  await pg.$eval('#planMins', e => { e.value = '75'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  assert((await goalDraft(pg)).dailyMins === 75 && await text(pg, '#planMinsVal') === '1 hr 15 min', 'slider 75 → 1 hr 15 min');
  assert(await pg.$eval('#planMinsTicks span.on', e => e.textContent) === '15 min', 'slider: the 75 tick is marked');
  await pg.click('#planRestChips .chip >> nth=6');
  await pg.click('#planRestChips .chip >> nth=0');
  assert(JSON.stringify((await goalDraft(pg)).restDays) === '[6]', 'rest chips toggle (Sat on, Sun off)');
  assert(await pg.$eval('#planRestChips .chip >> nth=6', e => getComputedStyle(e).backgroundColor) !== await pg.$eval('#planDaysChips .chip >> nth=0', e => getComputedStyle(e).backgroundColor),
    'active rest chip is coloured');
  await pg.click('#planLevelGrid .mode-card >> nth=2');
  assert((await goalDraft(pg)).level === 'exam' && await pg.$eval('#planLevelGrid .mode-card >> nth=2', e => e.classList.contains('selected')), 'level card select');
}

// W-031: switching off from outside the plan screens keeps the current screen (an exam keeps running)
async function checkSwitchOffElsewhere(pg) {
  await fresh(pg, '?preview=plan');
  const ids = await pg.evaluate(() => [...document.querySelectorAll('.screen[id^="screenPlan"]')].map(e => e.id).filter(id => !PLAN_SCREEN_IDS.includes(id)));
  assert(ids.length === 0, 'W-031: every #screenPlan* is listed in PLAN_SCREEN_IDS: ' + ids);
  await pg.evaluate(() => startExam(3, EXAM_MODE));
  await pg.click('#infoBtn');
  await pg.click('#planFeatureSwitch');
  await pg.click('#confirmOk');
  const r = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, timer: examTimerId !== null, on: isStudyPlanEnabled() }));
  assert(r.screen === 'screenQuiz' && r.timer && !r.on, 'W-031: off during an Exam keeps the exam screen and its timer: ' + JSON.stringify(r));
  await pg.evaluate(() => { setStudyPlanEnabled(true); renderPlanSettings(); stopExamTimer(); openStudy(); });
  await pg.click('#planFeatureSwitch'); // S-112: the popover stayed open after Confirm
  await pg.click('#confirmOk');
  assert(await activeScreen(pg) === 'screenStudy', 'W-031: off on Study stays on Study');
  await pg.evaluate(() => leaveToHome());
  assert(!(await visible(pg, '#planCard')), 'W-031: the Home plan card is gone');
}

// toast (mockup .sp-toast): switching off / on says so at the bottom, for TOAST_MS, without taking focus
async function checkToast(pg) {
  await fresh(pg, '?preview=plan');
  const toast = () => pg.evaluate(() => {
    const e = byId('appToast');
    return { hidden: e.hidden, display: getComputedStyle(e).display, text: e.textContent, role: e.closest('[role="status"]') && e.closest('[role="status"]').getAttribute('aria-live'),
      focus: document.activeElement === e, bottom: Math.round(innerHeight - e.getBoundingClientRect().bottom) };
  });
  const idle = await toast();
  assert(idle.hidden && idle.display === 'none', '[hidden] toast is not displayed before use');
  await pg.click('#infoBtn');
  await pg.click('#planFeatureSwitch');
  await pg.click('#confirmOk');
  const off = await toast();
  assert(!off.hidden && off.display !== 'none' && off.text === 'Study plan turned off' && off.role === 'polite' && !off.focus && off.bottom > 0,
    'toast after switching off: shown at the bottom, polite status, focus not taken: ' + JSON.stringify(off));
  const ms = await pg.evaluate(() => TOAST_MS);
  await pg.waitForTimeout(ms + 300);
  const gone = await toast();
  assert(gone.hidden && gone.display === 'none', `toast hides itself after TOAST_MS (${ms} ms)`);
  await pg.click('#planFeatureSwitch'); // S-112: the popover stayed open after Confirm
  const on = await toast();
  assert(!on.hidden && on.text.startsWith('Study plan turned on') && await pg.evaluate(() => document.activeElement.id) === 'planFeatureSwitch',
    'toast after switching on: shown, focus stays on the switch: ' + on.text);
  await pg.keyboard.press('Escape');
}

// W-032: the switch updates in place: the popover stays open and focus stays on the switch
async function checkSwitchInPlace(pg) {
  await fresh(pg, '?preview=plan');
  await pg.evaluate(() => setStudyPlanEnabled(false));
  await pg.click('#infoBtn');
  await pg.click('#planFeatureSwitch');
  const r = await pg.evaluate(() => ({ open: byId('infoPop').classList.contains('show'), focus: document.activeElement.id,
    on: byId('planFeatureSwitch').getAttribute('aria-checked'), note: byId('infoPlanStatus').textContent }));
  assert(r.open && r.focus === 'planFeatureSwitch' && r.on === 'true' && r.note.startsWith('On'), 'W-032: switch on by click: popover open, focus kept: ' + JSON.stringify(r));
  await pg.click('#infoBtn');
  await pg.click('#infoBtn');
  await pg.evaluate(() => setStudyPlanEnabled(false));
  await pg.click('#infoBtn');
  await pg.click('#infoBtn');
  await pg.focus('#planFeatureSwitch');
  await pg.keyboard.press('Space');
  const k = await pg.evaluate(() => ({ open: byId('infoPop').classList.contains('show'), focus: document.activeElement.id, on: isStudyPlanEnabled() }));
  assert(k.open && k.focus === 'planFeatureSwitch' && k.on, 'W-032: switch on by Space: popover open, focus kept: ' + JSON.stringify(k));
  await pg.keyboard.press('Escape');
}

// W-033: typing a date segment by segment (half-typed values fall before the minimum) ends on that date;
// a date past the maximum clamps once the field commits (change)
async function checkDateTyping(pg) {
  const order = await pg.evaluate(() => new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(2026, 11, 25)).filter(p => p.type !== 'literal').map(p => p.value).join(''));
  await pg.focus('#planExamDate');
  await pg.keyboard.type(order, { delay: 20 });
  assert((await goalDraft(pg)).examDate === '2026-12-25' && await pg.$eval('#planExamDate', e => e.value) === '2026-12-25',
    'W-033: typed ' + order + ' segment by segment → 2026-12-25: ' + JSON.stringify([(await goalDraft(pg)).examDate, await pg.$eval('#planExamDate', e => e.value)]));
  await pg.$eval('#planExamDate', e => { e.value = '2027-09-01'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  assert((await goalDraft(pg)).examDate === '2026-12-25', 'W-033: an out-of-range value is not applied while typing');
  assert(await pg.$eval('#planExamDate', e => e.value === '2027-09-01' && document.activeElement === e), 'W-033: the field is not rewritten while focused');
  await pg.$eval('#planExamDate', e => e.blur());
  assert((await goalDraft(pg)).examDate === '2027-04-08' && await pg.$eval('#planExamDate', e => e.value) === '2027-04-08', 'W-033: leaving the field clamps a date past 6 months to the max');
  await pg.focus('#planExamDate');
  await pg.$eval('#planExamDate', e => { e.value = '2026-10-10'; e.dispatchEvent(new Event('input', { bubbles: true })); e.blur(); });
  assert((await goalDraft(pg)).examDate === '2027-04-08' && await pg.$eval('#planExamDate', e => e.value) === '2027-04-08', 'W-033: a date before today + 7 snaps back to the draft when the field is left');
}

// S-109: a redrawn chip group / level grid keeps focus on the chosen button
async function checkKeepFocus(pg) {
  for (const [group, nth] of [['#planDaysChips', 0], ['#planRestChips', 3], ['#planLevelGrid', 1]]) {
    await pg.focus(`${group} button >> nth=${nth}`);
    const arg = await pg.$eval(`${group} button >> nth=${nth}`, e => e.dataset.arg);
    await pg.keyboard.press('Enter');
    const f = await pg.evaluate(g => { const a = document.activeElement; return { inGroup: byId(g.slice(1)).contains(a), arg: a.dataset.arg }; }, group);
    assert(f.inGroup && f.arg === arg, `S-109: ${group} keeps focus on data-arg ${arg} after Enter: ` + JSON.stringify(f));
  }
}

// CUI-0019: with the date field focused, one real click / tap on a chip or level card takes effect (leaving the
// field commits it; the buttons must not be rebuilt under the pointer)
async function checkClickAfterDate(pg) {
  await setGoal(pg, { examDate: '2026-10-29', restDays: [0], level: 'none' });
  await pg.focus('#planExamDate');
  await pg.click('#planRestChips .chip >> nth=5');
  assert(JSON.stringify((await goalDraft(pg)).restDays) === '[0,5]', 'CUI-0019: date focused → one click on Fri toggles it');
  await pg.focus('#planExamDate');
  await pg.click('#planDaysChips .chip >> nth=0');
  assert((await goalDraft(pg)).examDate === '2026-10-22', 'CUI-0019: date focused → one click on 2 weeks applies');
  await pg.focus('#planExamDate');
  await pg.click('#planLevelGrid .mode-card >> nth=1');
  assert((await goalDraft(pg)).level === 'some', 'CUI-0019: date focused → one click on a level card applies');
  await pg.fill('#planExamDate', '2026-12-01');
  await pg.click('#planRestChips .chip >> nth=5');
  const d = await goalDraft(pg);
  assert(d.examDate === '2026-12-01' && JSON.stringify(d.restDays) === '[0]', 'CUI-0019: a date typed then one click on a chip: both applied');
}
async function checkTapAfterDate(b) {
  const ctx = await b.newContext({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true });
  const pg = await ctx.newPage();
  await pg.clock.setFixedTime(NOW);
  await fresh(pg, '?preview=plan');
  await pg.evaluate(() => openPlanGoal());
  await pg.fill('#planExamDate', '2026-12-01');
  await pg.tap('#planRestChips .chip >> nth=3');
  const d = await goalDraft(pg);
  assert(d.examDate === '2026-12-01' && JSON.stringify(d.restDays) === '[0,3]', 'CUI-0019: phone: date picked then one tap on Wed applies: ' + JSON.stringify(d));
  await pg.tap('#planDaysChips .chip >> nth=2');
  assert((await goalDraft(pg)).examDate === '2026-11-05', 'CUI-0019: phone: one tap on 4 weeks applies');
  await ctx.close();
}

// CUI-0020: en hour counts follow the plural (1 hour, 2 hours); O-3: the CTA is at least 44px tall
async function checkHourPluralAndCta(pg) {
  const r = await pg.evaluate(() => ({ s1: t('plan.feas.shortMsg', { n: 1 }), s2: t('plan.feas.shortMsg', { n: 2 }), o1: t('plan.feas.okMsg', { n: 1 }), o2: t('plan.feas.okMsg', { n: 3 }) }));
  assert(r.s1.startsWith('About 1 hour short') && r.s2.startsWith('About 2 hours short') && r.o1.startsWith('About 1 hour to spare') && r.o2.startsWith('About 3 hours to spare'),
    'CUI-0020: en hour plural: ' + JSON.stringify(r));
  const h = await pg.$eval('#planCreateBtn', e => e.getBoundingClientRect().height);
  assert(h >= HIT_MIN_PX, `O-3: "Build my plan" CTA is at least ${HIT_MIN_PX}px tall (${h})`);
}

// S-111: a draft left open past midnight moves up to the new minimum instead of a silent disabled CTA
async function checkMidnightClamp(pg) {
  await setGoal(pg, { examDate: '2026-10-14', restDays: [] });
  const r = await pg.evaluate(() => ({ date: planGoalDraft.examDate, disabled: byId('planCreateBtn').disabled }));
  assert(r.date === '2026-10-15' && !r.disabled, 'S-111: a date before today + 7 clamps to the minimum, CTA enabled: ' + JSON.stringify(r));
}

const setGoal = (pg, goal) => pg.evaluate(g => { Object.assign(planGoalDraft, g); renderPlanGoal(); }, goal);
async function checkFeasibility(pg) {
  const cases = await pg.evaluate(() => {
    const found = {};
    for (const days of [14, 21, 28, 42, 60, 90]) for (const mins of [30, 45, 60, 75, 90, 105, 120]) for (const level of ['none', 'some', 'exam']) {
      const goal = { examDate: isoAddDays(planTodayIso(), days), dailyMins: mins, restDays: [], level };
      const s = planFeasibility(goal, planTodayIso()).status;
      if (!found[s]) found[s] = goal;
    }
    return found;
  });
  const want = { ok: '✓ Plenty', tight: '△ Just enough', short: '✕ Not enough' };
  for (const [status, label] of Object.entries(want)) {
    assert(cases[status], `feasibility: a goal reaches "${status}"`);
    await setGoal(pg, cases[status]);
    const pill = await pg.$eval('#planFeasPill', e => [e.textContent, e.className]);
    const meter = await pg.$eval('#planFeasMeter', e => e.className);
    assert(pill[0] === label && pill[1].includes(status) && meter.includes(status), `feasibility ${status}: pill ${pill[0]}, meter ${meter}`);
    assert(!(await pg.$eval('#planCreateBtn', e => e.disabled)), `feasibility ${status}: CTA enabled (G13: short still builds)`);
  }
  assert((await text(pg, '#planFeasMsg')).includes('anyway'), 'feasibility short: says it builds anyway with longer days (G13)');
  await setGoal(pg, { examDate: '2026-10-22', dailyMins: 60, restDays: [0, 1, 2, 3], level: 'none' }); // 14 days, 8 rest → 6 study days
  assert(await pg.$eval('#planCreateBtn', e => e.disabled) && await visible(pg, '#planGoalHint'), 'G28: fewer than 7 study days → CTA disabled + hint');
  assert((await text(pg, '#planGoalHint')).includes('7'), 'G28 hint names the 7-day minimum');
  assert(!(await visible(pg, '#planFeasMsg')), 'G28: the "build anyway" advice is hidden while the CTA is disabled');
  await setGoal(pg, { restDays: [0] });
  assert(!(await pg.$eval('#planCreateBtn', e => e.disabled)) && !(await visible(pg, '#planGoalHint')), 'G28: back to ≥ 7 study days → enabled, hint hidden');
  assert(await visible(pg, '#planFeasMsg'), 'G28: the feasibility advice is back');
}

async function checkCreate(pg) {
  await fresh(pg, '?preview=plan');
  await pg.evaluate(() => {
    localStorage.setItem(STUDY_PLAN_LS, '{"v":1,"broken":true}');
    localStorage.setItem(STUDY_PLAN_PROGRESS_LS, '{not json');
    leaveToHome();
  });
  assert(await visible(pg, '#planCard .plan-cta'), 'O-1: a corrupt stored plan shows the create card again');
  await openGoal(pg);
  await pg.click('#planDaysChips .chip >> nth=2');
  await pg.click('#planCreateBtn');
  const r = await pg.evaluate(() => ({ plan: parseStoredPlan(readStudyPlan()), log: localStorage.getItem(STUDY_PLAN_PROGRESS_LS) }));
  assert(r.plan && r.plan.start === TODAY && r.plan.goal.examDate === '2026-11-05' && r.plan.goal.dailyMins === 120,
    'create: a valid plan is stored from the draft');
  assert(r.log === null, 'create: the old (corrupt) log was cleared first (O-2)');
  assert(await activeScreen(pg) === 'screenPlanSchedule', 'create: the schedule opens (PR4; tests/plan-schedule-test.js)');
  await pg.evaluate(() => leaveToHome());
  assert(!(await visible(pg, '#planCard .plan-cta')) && await visible(pg, '#planCard .plan-home'), 'create: Home shows the plan card, not the create card');
  assert((await text(pg, '#planCard .plan-home')).includes('Day 1 / 28'), 'plan card: Day 1 / 28: ' + await text(pg, '#planCard .plan-home'));
  assert(await pg.$eval('#planCard .plan-home [lang="en"]', e => e.textContent) === 'Day 1 / 28', 'plan card: Day n / N carries lang="en"');
}

async function checkHiddenAttr(pg) {
  const shown = await pg.evaluate(() => [...document.querySelectorAll('[hidden]')]
    .filter(e => getComputedStyle(e).display !== 'none').map(e => e.id || e.className));
  assert(shown.length === 0, '[hidden] elements are never displayed: ' + shown.join(', '));
}
// v1.0.2: the 4 presets share the card width equally, the date picker has its own row below them, and the 7 rest
// day chips stay on one row
const LAYOUT_TOLERANCE_PX = 1;
async function checkGoalLayout(pg, where) {
  const r = await pg.evaluate(() => {
    const rect = e => e.getBoundingClientRect();
    const presets = [...document.querySelectorAll('#planDaysChips .chip')].map(rect), rest = [...document.querySelectorAll('#planRestChips .chip')].map(rect);
    const field = rect(byId('planDaysChips').closest('.plan-field')), pick = rect(document.querySelector('.plan-date-pick'));
    const clipped = [...document.querySelectorAll('#planDaysChips .chip, #planRestChips .chip')].filter(e => e.scrollWidth > e.clientWidth + 0.5).map(e => e.textContent);
    return { widths: presets.map(p => p.width), tops: presets.map(p => p.top), left: presets[0].left - field.left, right: field.right - presets[3].right,
      pickBelow: pick.top >= Math.max(...presets.map(p => p.bottom)) - 0.5, restTops: rest.map(p => Math.round(p.top)), restRight: field.right - rest[6].right, clipped };
  });
  const tol = LAYOUT_TOLERANCE_PX;
  assert(r.widths.length === 4 && r.widths.every(x => Math.abs(x - r.widths[0]) <= tol) && r.tops.every(x => Math.abs(x - r.tops[0]) <= tol),
    `${where}: 4 preset chips of equal width on one row: ` + JSON.stringify(r));
  assert(Math.abs(r.left) <= tol && Math.abs(r.right) <= tol, `${where}: presets span the full card width: ` + JSON.stringify([r.left, r.right]));
  assert(r.pickBelow, `${where}: "or exam date" has its own row below the presets`);
  assert(r.restTops.length === 7 && new Set(r.restTops).size === 1 && r.restRight >= -tol, `${where}: all 7 rest day chips on one row: ` + JSON.stringify(r.restTops));
  assert(r.clipped.length === 0, `${where}: chip labels not clipped: ` + r.clipped);
}
async function checkWidths(pg) {
  await fresh(pg, '?preview=plan');
  for (const lang of ['en', 'zh-HK']) {
    await pg.evaluate(l => { setLang(l); leaveToHome(); }, lang);
    for (const w of WIDTHS) {
      await pg.setViewportSize({ width: w, height: 800 });
      for (const open of [() => leaveToHome(), () => openPlanGoal()]) {
        await pg.evaluate(open);
        const fit = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, s: document.querySelector('.screen.active').id }));
        assert(fit.sw <= fit.cw, `${lang} ${w}px ${fit.s}: no horizontal scroll (${fit.sw} <= ${fit.cw})`);
        await checkHiddenAttr(pg);
        if (fit.s === 'screenPlanGoal') await checkGoalLayout(pg, `${lang} ${w}px`);
      }
    }
  }
  const ticks = await pg.$$eval('#planMinsTicks span', els => els.map(e => e.textContent));
  assert(JSON.stringify(ticks) === JSON.stringify(TICKS_ZH), 'zh-HK slider ticks: ' + ticks);
  await pg.evaluate(() => setLang('en'));
  await pg.setViewportSize({ width: 390, height: 844 });
}

// arch R1: an older cached shell lacks the new tags, and Home / startApp call planHome.js on every load
function checkLateBoot() {
  const main = require('fs').readFileSync(path.resolve(__dirname, '..', 'js', 'main.js'), 'utf8');
  const scripts = main.slice(main.indexOf('const LATE_BOOT_SCRIPTS'), main.indexOf('];', main.indexOf('const LATE_BOOT_SCRIPTS')));
  const styles = main.slice(main.indexOf('const LATE_BOOT_STYLES'), main.indexOf(';', main.indexOf('const LATE_BOOT_STYLES')));
  assert(['js/components/switch.js', 'js/components/toast.js', 'js/screens/planHome.js', 'js/screens/planGoal.js'].every(f => scripts.includes(`'${f}'`)),
    'R1: LATE_BOOT_SCRIPTS loads switch.js, planHome.js, planGoal.js for old shells');
  assert(['css/components/switch.css', 'css/components/toast.css', 'css/screens/plan.css'].every(f => styles.includes(`'${f}'`)), 'R1: LATE_BOOT_STYLES adds switch.css, plan.css');
}

async function main() {
  checkLateBoot();
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.clock.setFixedTime(NOW);
  for (const check of [checkHidden, checkPreview, checkCreateCard, checkSwitch, checkSwitchOffElsewhere, checkSwitchInPlace, checkToast, checkGoalDefaults, checkGoalInputs, checkDateTyping, checkKeepFocus, checkClickAfterDate, checkHourPluralAndCta, checkFeasibility, checkMidnightClamp, checkCreate, checkWidths]) {
    await check(pg);
  }
  await checkTapAfterDate(b);
  assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close();
}
main().then(() => console.log('PLAN-UI PASS')).catch(e => { console.error(e.message); process.exit(1); });
