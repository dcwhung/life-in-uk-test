const { chromium } = require('playwright-core');
const path = require('path');
// v1.0.4 (user's request, preview approved): the schedule's "Three phases" and "Study order" cards fold.
// - the first open after creating a plan or changing its goal shows both cards expanded; every later open starts
//   them collapsed (the "seen" marker lifeuk.studyPlanScheduleSeen = the plan's identity; ↺ Reset clears it)
// - collapsed: phases = title + colour bar, each segment "name / Day x–y" (strategy hidden); order = title + a stepper
//   of 4 numbered dots labelled Ch 1 + 2 / Ch 5 / Ch 4 / Ch 3 (intro + steps hidden)
// - the whole title is the toggle (aria-expanded, aria-controls, hidden attribute, ≥ 44px tap); toggles survive a
//   language switch / re-render within the visit but are not saved
// - 320 / 390 / 600px en + zh-HK: no horizontal scroll, every label in full
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const NOW = new Date('2026-10-08T09:00:00');
const GOAL = { examDate: '2026-10-29', dailyMins: 60, restDays: [], level: 'some' }; // 21 days: Day 1–11 / 12–14 / 15–21
const WIDTHS = [320, 390, 600];
const HIT_MIN_PX = 44;
const SEEN_KEY = 'lifeuk.studyPlanScheduleSeen';

const fresh = async pg => {
  await pg.goto(APP_URL + '?preview=plan');
  await pg.evaluate(() => localStorage.clear());
  await pg.goto(APP_URL + '?preview=plan');
};
// as the goal screen does it: a new plan, then the schedule
const createPlan = (pg, goal = GOAL) => pg.evaluate(g => { clearStudyPlan(); writeStudyPlan(buildPlan(g, planTodayIso())); openPlanSchedule(); }, goal);
const reopen = pg => pg.evaluate(() => { leaveToHome(); openPlanSchedule(); });
// what each card shows, as a user / screen reader gets it
const foldState = pg => pg.evaluate(() => {
  const shown = e => !!e && e.getClientRects().length > 0;
  const btn = id => byId(id), body = b => byId(b.getAttribute('aria-controls'));
  const ph = btn('planPhasesToggle'), ord = btn('planOrderToggle');
  return {
    phases: { expanded: ph.getAttribute('aria-expanded'), bodyShown: shown(body(ph)), bodyHidden: body(ph).hidden,
      bar: [...document.querySelectorAll('#planPhaseBar > div')].map(d => [...d.children].filter(shown).map(s => s.textContent).join(' / ')),
      barAriaHidden: byId('planPhaseBar').getAttribute('aria-hidden') },
    order: { expanded: ord.getAttribute('aria-expanded'), bodyShown: shown(body(ord)), bodyHidden: body(ord).hidden,
      stepper: shown(byId('planOrderMini')),
      dots: [...document.querySelectorAll('#planOrderMini li')].map(li => [li.querySelector('.plan-ord-n').textContent, li.querySelector('.plan-ord-mini-name').textContent]),
      sr: [...document.querySelectorAll('#planOrderMini .plan-sr')].map(s => s.textContent) },
  };
});

async function checkFirstOpenExpanded(pg) {
  await fresh(pg);
  await createPlan(pg);
  const s = await foldState(pg);
  assert(s.phases.expanded === 'true' && s.phases.bodyShown && !s.phases.bodyHidden, 'first open after create: Three phases expanded: ' + JSON.stringify(s.phases));
  assert(s.order.expanded === 'true' && s.order.bodyShown && !s.order.stepper, 'first open after create: Study order expanded, no stepper: ' + JSON.stringify(s.order));
  assert(JSON.stringify(s.phases.bar) === JSON.stringify(['Read + practise / 11 days', 'Drill / 3 days', 'Mocks / 7 days']), 'expanded bar: name / n days: ' + JSON.stringify(s.phases.bar));
  assert(s.phases.barAriaHidden === 'true', 'expanded: the bar stays aria-hidden (the strategy boxes say it)');
  assert(await pg.evaluate(k => localStorage.getItem(k) !== null, SEEN_KEY), 'the first open stores the "seen" marker');
}

async function checkReopenCollapsed(pg) {
  await reopen(pg);
  const s = await foldState(pg);
  assert(s.phases.expanded === 'false' && !s.phases.bodyShown && s.phases.bodyHidden, 'reopen: Three phases collapsed, strategy hidden');
  assert(JSON.stringify(s.phases.bar) === JSON.stringify(['Read + practise / Day 1–11', 'Drill / Day 12–14', 'Mocks / Day 15–21']), 'collapsed bar: name / Day x–y: ' + JSON.stringify(s.phases.bar));
  assert(s.phases.barAriaHidden === null, 'collapsed: the bar is read by screen readers');
  assert(await pg.$$eval('#planPhaseBar .plan-ph-range', els => els.every(e => e.getAttribute('lang') === 'en')), 'collapsed bar: Day ranges are lang="en"');
  assert(s.order.expanded === 'false' && !s.order.bodyShown && s.order.bodyHidden && s.order.stepper, 'reopen: Study order collapsed to the stepper');
  assert(JSON.stringify(s.order.dots) === JSON.stringify([['1', 'Ch 1 + 2'], ['2', 'Ch 5'], ['3', 'Ch 4'], ['4', 'Ch 3']]), 'stepper: 4 numbered dots, Ch 1 + 2 > Ch 5 > Ch 4 > Ch 3: ' + JSON.stringify(s.order.dots));
  assert(await pg.$eval('#planOrderMini', e => e.tagName === 'OL' && e.getAttribute('role') === 'list'), 'S-125: the stepper keeps its list semantics in WebKit (role="list" with list-style: none)');
  assert(s.order.sr[0] === 'Ch 1 Values & principles + Ch 2 What is the UK?' && s.order.sr[3] === 'Ch 3 History', 'stepper: full chapter names for screen readers');
  const line = await pg.evaluate(() => { const lis = [...document.querySelectorAll('#planOrderMini li')]; const dot = li => li.querySelector('.plan-ord-n').getBoundingClientRect();
    return lis.map(dot).every((r, i, a) => !i || (r.left > a[i - 1].right && Math.abs(r.top - a[0].top) < 1)); });
  assert(line, 'stepper: the dots sit on one horizontal line, left to right');
}

const HIT_TOLERANCE = 1;
const hitOk = (pg, id) => pg.evaluate(({ id, min, tol }) => {
  const e = byId(id); e.scrollIntoView({ block: 'center' });
  const r = e.getBoundingClientRect(), cy = r.top + r.height / 2;
  const at = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === e || e.contains(h)); };
  return at(r.left + 2, cy - min / 2 + tol) && at(r.left + 2, cy + min / 2 - tol) && at(r.right - 2, cy);
}, { id, min: HIT_MIN_PX, tol: HIT_TOLERANCE });

async function checkToggle(pg) {
  for (const id of ['planPhasesToggle', 'planOrderToggle']) {
    assert(await pg.evaluate(id => { const b = byId(id); return b.tagName === 'BUTTON' && b.type === 'button' && !!b.closest('h3'); }, id), `${id}: a button inside the card's h3`);
    assert(await hitOk(pg, id), `${id}: ${HIT_MIN_PX}px tap area over the whole title row`);
  }
  await pg.click('#planPhasesToggle');
  let s = await foldState(pg);
  assert(s.phases.expanded === 'true' && s.phases.bodyShown && s.phases.bar[0] === 'Read + practise / 11 days' && s.phases.barAriaHidden === 'true', 'tap: Three phases expands');
  assert(s.order.expanded === 'false', 'tap: the other card stays collapsed');
  assert(await pg.evaluate(() => document.activeElement.id) === 'planPhasesToggle', 'focus stays on the toggle');
  await pg.click('#planOrderToggle');
  s = await foldState(pg);
  assert(s.order.expanded === 'true' && s.order.bodyShown && !s.order.stepper, 'tap: Study order expands');
  await pg.click('#planPhasesToggle');
  s = await foldState(pg);
  assert(s.phases.expanded === 'false' && !s.phases.bodyShown, 'tap again: Three phases collapses');
  await pg.focus('#planPhasesToggle');
  await pg.keyboard.press('Enter');
  assert((await foldState(pg)).phases.expanded === 'true', 'keyboard: Enter toggles');
  await pg.keyboard.press('Space');
  assert((await foldState(pg)).phases.expanded === 'false', 'keyboard: Space toggles');
  const rot = await pg.evaluate(() => [document.getAnimations().forEach(a => a.finish()), getComputedStyle(document.querySelector('#planPhasesToggle .plan-fold-chev')).transform, getComputedStyle(document.querySelector('#planOrderToggle .plan-fold-chev')).transform]);
  assert(rot[1] === 'none' && rot[2] !== 'none', 'chevron turns when expanded: ' + rot.slice(1));
  await pg.emulateMedia({ reducedMotion: 'reduce' });
  assert(await pg.$eval('.plan-fold-chev', e => getComputedStyle(e).transitionDuration) === '0s', 'reduced motion: the chevron turns without a transition');
  await pg.emulateMedia({ reducedMotion: null });
}

// state now: phases collapsed, order expanded; a language switch keeps it; the next open collapses both again
async function checkLangKeepsFold(pg) {
  await pg.click('#langBtn');
  let s = await foldState(pg);
  assert(s.phases.expanded === 'false' && s.order.expanded === 'true' && s.order.bodyShown, 'language switch keeps each card as toggled');
  assert(JSON.stringify(s.phases.bar) === JSON.stringify(['讀 + 練 / Day 1–11', '強化練習 / Day 12–14', '模擬考試 / Day 15–21']), 'zh-HK collapsed bar: ' + JSON.stringify(s.phases.bar));
  assert(await pg.$eval('#planPhasesToggle', e => e.textContent.trim()) === '三個階段', 'zh-HK: the toggle reads the card title');
  await pg.click('#langBtn');
  await reopen(pg);
  s = await foldState(pg);
  assert(s.phases.expanded === 'false' && s.order.expanded === 'false', 'toggles are not saved: the next open is collapsed');
}

async function checkChangeGoalExpands(pg) {
  await pg.click('#screenPlanSchedule [data-action="planEditGoal"]');
  await pg.click('#planCreateBtn');
  let s = await foldState(pg);
  assert(s.phases.expanded === 'true' && s.order.expanded === 'true', 'after Change goal: the next open is expanded');
  await reopen(pg);
  s = await foldState(pg);
  assert(s.phases.expanded === 'false' && s.order.expanded === 'false', 'after Change goal: later opens collapsed');
}

async function checkResetClears(pg) {
  // CUI-0011: a tap right after a screen change (Change goal → schedule) is taken for a double tap and ignored
  await pg.waitForTimeout(await pg.evaluate(() => SCREEN_CHANGE_CLICK_GUARD_MS) + 50);
  await pg.click('#screenPlanSchedule [data-action="planAskReset"]');
  await pg.click('#confirmOk');
  assert(await pg.evaluate(k => localStorage.getItem(k), SEEN_KEY) === null, '↺ Reset plan clears the "seen" marker');
  await createPlan(pg);
  assert((await foldState(pg)).phases.expanded === 'true', 'a plan made after a reset opens expanded');
}

async function checkWidths(pg) {
  for (const lang of ['en', 'zh-HK']) {
    await pg.evaluate(l => setLang(l), lang);
    for (const w of WIDTHS) {
      await pg.setViewportSize({ width: w, height: 800 });
      for (const state of ['collapsed', 'expanded']) {
        await reopen(pg);
        if (state === 'expanded') { await pg.click('#planPhasesToggle'); await pg.click('#planOrderToggle'); }
        const r = await pg.evaluate(() => {
          const clipped = [...document.querySelectorAll('#planPhaseBar span, #planOrderMini span:not(.plan-sr), .plan-fold-btn span')].filter(e => e.getClientRects().length && e.scrollWidth > e.clientWidth + 0.5).map(e => e.textContent);
          const card = document.querySelector('.plan-fold').getBoundingClientRect();
          const out = [...document.querySelectorAll('#planOrderMini *, .plan-fold-chev')].filter(e => e.getClientRects().length).some(e => { const b = e.getBoundingClientRect(); return b.left < card.left || b.right > card.right; });
          return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, clipped, out };
        });
        assert(r.sw <= r.cw && !r.clipped.length && !r.out, `${lang} ${w}px ${state}: no horizontal scroll, labels in full, inside the card: ` + JSON.stringify(r));
      }
    }
  }
  await pg.evaluate(() => setLang('en'));
  await pg.setViewportSize({ width: 390, height: 844 });
}

async function main() {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.clock.setFixedTime(NOW);
  for (const check of [checkFirstOpenExpanded, checkReopenCollapsed, checkToggle, checkLangKeepsFold, checkChangeGoalExpands, checkResetClears, checkWidths]) {
    await check(pg);
  }
  assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close();
}
main().then(() => console.log('PLAN-FOLD PASS')).catch(e => { console.error(e.message); process.exit(1); });
