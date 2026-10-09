const { chromium } = require('playwright-core');
const path = require('path');
// Study plan PR5 (T-323–T-328; handoff §2.1 / §2.4, grill G2–G9 / G14 / G16 / G21 / G23–G25 / G27 / G29; PR4 S-115):
// the day screen ("Today's tasks" / Day n), the completion calendar, the overall progress card and the full
// Home plan card. Completion comes from a seeded answer log here; opening a task (the runner) is
// tests/plan-run-test.js (PR6a). The entry stays hidden (STUDY_PLAN_READY = false) unless ?preview=plan (G31).
// - header ← Home | ‹ title / date · n/N › | Schedule; ‹ › step through the plan; "back to today"
// - ring (G27 band), phase pill (past / ahead), n / m done, hint per day kind; done banner; v1.0.4: a rest day
//   shows a large 😴 instead of the ring and no visible "no tasks" line (kept for screen readers)
// - task boxes: not started (dashed) / in progress (solid) / done (green) / carry-over (orange + Day n tag,
//   not counted in today's %: G8); "k wrong: only right answers count"; reading done by practice (G3);
//   no wrong answers (G9 empty); ahead days: clear-wrong / drill decided on the day (G23); mock best score (G25)
// - calendar: one month, ‹ Today › within the plan's months (v1.0.4: not shown for a one-month plan), past / today / ahead / rest / outside / exam cells,
//   cells open their day; 🔥 n days at 100% (G29); overall progress (plan %, average, days left + 3 bars)
// - Home card: Day n / N, days to the exam, today % + bar, next step, continue / view today; exam day and
//   ended (G16: summary + new plan / change goal); unreadable log hint
// - schedule rows open their day; "View today's tasks →"
// - G6: the day changes at local midnight with the app open, and on return to the foreground; time zones
// - G9: the first open fixes today's clear-wrong list; later wrong answers wait for tomorrow
// - S-115: "Build / Update" after midnight re-renders the form with a notice instead of doing nothing
// - 44px tap areas, contrast ≥ 4.5:1 without opacity, 360 / 375 / 400 en + zh-HK without horizontal scroll
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const START = '2026-09-28'; // Monday; Day 4 = 2026-10-01 is a learn day (read + practise Ch 4, clear wrong answers)
const TODAY = '2026-10-01';
const at = (iso, time = '09:00:00') => new Date(`${iso}T${time}`);
const GOAL = { examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' };
const WIDTHS = [360, 375, 400];
const HIT_MIN_PX = 44;
const MIN_CONTRAST = 4.5;
const REST_EMOJI_MIN_PX = 48;

const activeScreen = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
const text = (pg, sel) => pg.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
const visible = (pg, sel) => pg.evaluate(sel => { const e = document.querySelector(sel); return !!e && e.getClientRects().length > 0; }, sel);
async function fresh(pg, now = at(TODAY), query = '?preview=plan') {
  await pg.clock.setFixedTime(now);
  await pg.goto(APP_URL + query);
  await pg.evaluate(() => localStorage.clear());
  await pg.goto(APP_URL + query);
}
// the plan began START; log: Days 1–2 done, Day 3 part done (one wrong), today part done (one wrong)
async function seedPlan(pg, { log = true } = {}) {
  await pg.evaluate(({ goal, start, log }) => {
    const plan = buildPlan(goal, start);
    writeStudyPlan(plan);
    if (!log) return;
    const qidsOf = day => day.tasks.filter(t => t.type !== 'review').flatMap(planTaskQids);
    const ok = list => Object.fromEntries(list.map(k => [k, 1]));
    const [d1, d2, d3, d4] = plan.days;
    const p3 = qidsOf(d3), p4 = d4.tasks[1].qids;
    writePlanLog({ v: 1, days: {
      [d1.date]: { ok: ok(qidsOf(d1)) }, [d2.date]: { ok: ok(qidsOf(d2)) },
      [d3.date]: { ok: ok(p3.slice(0, 20)), bad: { [p3[30]]: 1 } },
      [d4.date]: { ok: ok(p4.slice(0, 20)), bad: { [p4[25]]: 1, [p4[0]]: 1 } },
    } });
  }, { goal: GOAL, start: START, log });
}
const openDay = (pg, iso = null) => pg.evaluate(iso => openPlanDay(iso), iso);
// tap area: points HIT_MIN_PX / 2 from the centre (up, down, left, right) still land on the element
const hitOk = (pg, sel) => pg.evaluate(({ s, min }) => {
  const e = document.querySelector(s);
  e.scrollIntoView({ block: 'center' });
  const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, d = min / 2 - 1;
  const hit = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === e || e.contains(h)); };
  return hit(cx, cy - d) && hit(cx, cy + d) && hit(cx - d, cy) && hit(cx + d, cy);
}, { s: sel, min: HIT_MIN_PX });
// v1.0.4 (user): the hint paragraph is justified with its last line on the left, and spans the info column (not a
// centred shrink-to-fit block), at every width
// the rest day look: ring / 😴 / count (visually hidden = rendered but clipped to ≤ 1px, still in the a11y tree)
const restLook = pg => pg.evaluate(() => {
  const emoji = byId('planRestEmoji'), count = byId('planDayCount'), box = count.getBoundingClientRect();
  return { ring: byId('planRing').getClientRects().length > 0, emoji: emoji.textContent, emojiShown: emoji.getClientRects().length > 0,
    emojiHidden: emoji.getAttribute('aria-hidden') === 'true', emojiPx: parseFloat(getComputedStyle(emoji).fontSize),
    count: count.textContent, countSrOnly: count.getClientRects().length > 0 && box.width <= 1 && box.height <= 1, pill: byId('planDayPhase').textContent };
});
// the month navigation: ‹ Today › all rendered (none in a hidden ancestor)
const calNavShown = pg => pg.evaluate(() => ['planCalPrev', 'planCalToday', 'planCalNext'].every(id => byId(id).getClientRects().length > 0));
const hintJustified = pg => pg.evaluate(() => {
  const hint = byId('planDayHint'), s = getComputedStyle(hint);
  const box = hint.getBoundingClientRect(), col = byId('planDayInfo').getBoundingClientRect();
  return s.textAlign === 'justify' && s.textAlignLast === 'left' && Math.abs(box.left - col.left) < 1 && Math.abs(box.right - col.right) < 1;
});
// WCAG contrast of each element's text against the first opaque background behind it; no opacity on the way up
const contrastOf = (pg, sel) => pg.evaluate(sel => {
  const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 3 || c[3] > 0) return c; } return [255, 255, 255]; };
  const opaque = el => { for (let e = el; e; e = e.parentElement) if (Number(getComputedStyle(e).opacity) < 1) return false; return true; };
  return [...document.querySelectorAll(sel)].filter(e => e.textContent.trim() && e.getClientRects().length).map(e => {
    const fg = rgb(getComputedStyle(e).color), bg = bgOf(e);
    const alpha = fg.length > 3 ? fg[3] : 1; // semi-transparent text (rgba white on navy) blended over its background
    const a = lum(fg.slice(0, 3).map((v, i) => alpha * v + (1 - alpha) * bg[i])), b = lum(bg);
    return { text: e.textContent.trim().slice(0, 20), ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), opaque: opaque(e) };
  });
}, sel);

async function checkHidden(pg) {
  await fresh(pg, at(TODAY), '');
  await pg.evaluate(() => writeStudyPlan(buildPlan({ examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' }, '2026-09-28')));
  await openDay(pg);
  assert(await activeScreen(pg) === 'screenHome', 'hidden: openPlanDay() stays on Home');
  assert(await pg.evaluate(() => PLAN_SCREEN_IDS.includes('screenPlanDay')), 'W-031: the day screen is a plan screen');
  assert(await pg.evaluate(() => typeof SCREEN_RERENDER.screenPlanDay === 'function'), 'language switch re-renders the day screen');
}

async function checkHeader(pg) {
  await fresh(pg);
  await seedPlan(pg);
  await pg.evaluate(() => leaveToHome());
  await pg.click('#planCard [data-action="planContinue"]');
  assert(await activeScreen(pg) === 'screenPlanDay', 'Home card "Continue": the next task is reading (PR6b), so the day screen opens');
  assert(await text(pg, '#planDayTitle') === "Today's tasks", 'title: Today\'s tasks');
  assert(await text(pg, '#planDaySub') === '1/10 Thu · 4/31', 'sub: date weekday · Day n / N: ' + await text(pg, '#planDaySub'));
  assert(await pg.$eval('#planDaySub [lang="en"]', e => e.textContent) === '4/31', 'n/N carries lang="en"');
  assert(!(await visible(pg, '#planBackToday')), 'today: no "back to today"');
  // S-117: the day header's ← Home (plan-hit) is checked at every width in checkLayout
  for (const s of ['#planDayPrev', '#planDayNext', '#screenPlanDay [data-action="openPlanSchedule"]']) {
    assert(await hitOk(pg, s), `${s}: ${HIT_MIN_PX}px tap area`);
  }
  await pg.click('#planDayPrev');
  assert(await text(pg, '#planDayTitle') === 'Day 3 tasks' && await visible(pg, '#planBackToday'), '‹ → Day 3, "back to today" shows');
  const focused = await pg.evaluate(() => document.activeElement.id);
  await pg.click('#planDayPrev');
  await pg.click('#planDayPrev');
  assert(focused === 'planDayPrev' && await text(pg, '#planDayTitle') === 'Day 1 tasks', '‹ keeps focus and steps again (button updated in place)');
  assert(await pg.$eval('#planDayPrev', e => e.disabled), '‹ disabled on Day 1');
  assert(await pg.evaluate(() => document.activeElement.id) === 'planDayNext', 'Day 1: focus moves from the disabled ‹ to ›');
  await pg.click('#planBackToday');
  assert(await text(pg, '#planDayTitle') === "Today's tasks", '"back to today"');
  assert(await pg.evaluate(() => document.activeElement.id) === 'planDayHeading', 'W-036: "back to today" hides itself, focus goes to the day heading (not <body>)');
  await pg.click('#screenPlanDay [data-action="openPlanSchedule"]');
  assert(await activeScreen(pg) === 'screenPlanSchedule', 'header "Schedule"');
  await pg.click('#screenPlanSchedule .back-btn');
  assert(await activeScreen(pg) === 'screenHome', 'schedule ← Home');
}

// today (Day 4): read Ch 4 (some facts done by practising), practise Ch 4 (20 / 51 right, 2 wrong, 1 of them
// right afterwards), clear wrong answers (empty wrong list → done), carry-over from Day 3
async function checkToday(pg) {
  await fresh(pg);
  await seedPlan(pg);
  await openDay(pg);
  const r = await pg.evaluate(() => {
    const plan = planLoad(), day = plan.days[3], log = planLoadLog();
    const own = planDayCompletion(day, planDayLog(log, day.date));
    const tasks = [...document.querySelectorAll('#planTaskList .plan-task')].map(e => ({
      cls: e.className, ttl: e.querySelector('.plan-task-ttl').textContent, st: e.querySelector('.plan-task-st').textContent,
      go: (e.querySelector('.plan-task-go') || { textContent: '' }).textContent, tag: (e.querySelector('.plan-tag') || { textContent: '' }).textContent,
      bar: e.querySelector('.plan-mini i').style.width, action: e.matches('button[data-action="planOpenTask"]'),
    }));
    return { own, tasks, ring: byId('planRingPct').textContent, ringCls: byId('planRingProg').getAttribute('class'),
      count: byId('planDayCount').textContent, pill: byId('planDayPhase').textContent, hint: byId('planDayHint').textContent,
      alert: byId('planCarryAlert').hidden ? '' : byId('planCarryAlert').textContent.trim(), done: byId('planDayDone').hidden,
      review: plan.days[3].tasks[2].qids };
  });
  assert(r.ring === `${r.own.pct}%` && r.ringCls.includes(`h${r.own.pct >= 100 ? 4 : r.own.pct >= 75 ? 3 : r.own.pct >= 50 ? 2 : r.own.pct > 0 ? 1 : 0}`), `ring: today's own % (${r.ring}) in its G27 band`);
  assert(r.pill === 'Read + practise phase', 'phase pill: ' + r.pill);
  assert(r.count === '1 / 3 done', 'n / m done (own tasks only): ' + r.count);
  assert(/automatically/.test(r.hint), 'today hint: completion is counted automatically: ' + r.hint);
  assert(await hintJustified(pg), 'v1.0.4 (user): the hint under the count is justified, last line left, across the info column');
  assert(Array.isArray(r.review) && r.review.length === 0, 'G9: the first open fixed today\'s clear-wrong list (empty wrong list)');
  const [read, practice, review, ...carry] = r.tasks;
  assert(r.tasks.length === 3 + carry.length && carry.length > 0, 'own tasks, then carry-over tasks');
  assert(read.ttl.startsWith('Read Ch 4 Modern society facts #') && !read.cls.includes('todo') && !read.cls.includes('done'), 'read: in progress (solid): ' + read.cls);
  assert(/^Read \d+ \/ 37 facts · continue from #\d+$/.test(read.st), 'read: k / n read · continue from #n: ' + read.st);
  assert(/^✓ \d+ \/ 51 right · ✗ 11 wrong: only right answers count$/.test(practice.st) && practice.tag === '1 wrong: only right answers count', 'practice: right / total · ✗ k + tag: ' + practice.st + ' | ' + practice.tag);
  assert(practice.go === 'Continue ›' && read.go === 'Continue ›', 'in progress: "Continue ›"');
  assert(review.cls.includes('done') && review.st === '✓ No wrong answers' && review.go === '✓ Review ›', 'clear wrong answers: done, "No wrong answers": ' + review.st);
  assert(review.bar === '100%' && /^\d+%$/.test(practice.bar), 'mini bars sized from JS');
  assert(carry.every(c => c.cls.includes('carry') && c.tag === 'Day 3'), 'carry-over: orange box + Day 3 tag');
  assert(r.alert.includes('carried over'), 'carry-over alert: ' + r.alert);
  // PR6a: question tasks open the runner (plan-run-test); reading / an empty clear-wrong task stay plain boxes
  assert(!read.action && practice.action && !review.action, 'PR6a: the practice box is a button; reading (PR6b) and "No wrong answers" are not');
  assert(carry.every(c => c.action === /^Practise/.test(c.ttl)), 'PR6a: carry-over practice boxes are buttons, carry-over reading is not');
  assert(r.done === true, 'no done banner while today is not complete');
  // the task box colours (dashed / solid / green / orange)
  const look = await pg.$$eval('#planTaskList .plan-task', els => els.map(e => [getComputedStyle(e).borderTopStyle, getComputedStyle(e).borderTopColor]));
  assert(look[0][0] === 'solid' && look[2][1] !== look[0][1] && look[3][1] !== look[0][1], 'box borders: solid / green / orange: ' + JSON.stringify(look));
  const low = (await contrastOf(pg, '#screenPlanDay .plan-task-ttl, #screenPlanDay .plan-task-st, #screenPlanDay .plan-tag, #screenPlanDay .plan-task-go, #planDayCount, #planDayHint, #planDayPhase, #planCarryAlert'))
    .filter(c => c.ratio < MIN_CONTRAST || !c.opaque);
  assert(low.length === 0, `day screen text ≥ ${MIN_CONTRAST}:1, no opacity: ` + JSON.stringify(low));
}

async function checkCarryNotCounted(pg) {
  // answering a carry task's question records on its own day; today's % does not move (G8)
  const before = await text(pg, '#planRingPct');
  await pg.evaluate(() => {
    const plan = planLoad(), qid = planTaskQids(planCarryTasks(plan, planLoadLog(), planTodayIso())[0].task).find(k => !planDayLog(planLoadLog(), '2026-09-30').ok[k]);
    recordPlanAnswer(qid, true, '2026-09-30');
    renderPlanDay();
  });
  assert(await text(pg, '#planRingPct') === before, `G8: a carry-over answer leaves today's % (${before}) unchanged`);
}

async function checkAllDone(pg) {
  await fresh(pg);
  await seedPlan(pg);
  await pg.evaluate(() => {
    const plan = planLoad(), log = planLoadLog(), today = plan.days[3];
    const all = [...plan.days.slice(0, 3), today].flatMap(d => d.tasks.filter(t => t.qids || t.facts).flatMap(planTaskQids));
    all.forEach(k => { log.days['2026-10-01'].ok[k] = 1; });
    plan.days.slice(0, 3).forEach(d => d.tasks.filter(t => t.qids || t.facts).flatMap(planTaskQids).forEach(k => { log.days[d.date] = log.days[d.date] || { ok: {} }; log.days[d.date].ok[k] = 1; }));
    writePlanLog(log);
  });
  await openDay(pg);
  assert(await text(pg, '#planRingPct') === '100%' && await pg.$eval('#planRingProg', e => e.getAttribute('class').includes('h4')), 'all done: ring 100% in the h4 band');
  assert(await visible(pg, '#planDayDone') && (await text(pg, '#planDayDone')).includes('All done for today'), 'done banner: ' + await text(pg, '#planDayDone'));
  assert(!(await visible(pg, '#planCarryAlert')), 'nothing carried over: no alert');
  assert(await text(pg, '#planStreak') === '🔥 4 days in a row at 100%', 'G29: Days 1–4 at 100%: ' + await text(pg, '#planStreak'));
  const read = await pg.$eval('#planTaskList .plan-task', e => [e.className, e.querySelector('.plan-task-st').textContent]);
  assert(read[0].includes('done') && read[1] === '✓ Practised its questions: counted as read', 'G3: reading counts once its questions are right: ' + read[1]);
  await pg.evaluate(() => leaveToHome());
  const card = await text(pg, '#planCard');
  assert(card.includes('✓ Done for today, see you tomorrow') && await text(pg, '#planCard [data-action="openPlanDay"]') === "View today's tasks", 'Home: done today + "View today\'s tasks": ' + card);
}

async function checkPastAndAhead(pg) {
  await fresh(pg);
  await seedPlan(pg);
  await openDay(pg, '2026-09-30');
  assert(await text(pg, '#planDayPhase') === 'Read + practise phase · past' && (await text(pg, '#planDayHint')).includes('catch up'), 'past day: pill · past + catch-up hint');
  const past = await pg.$$eval('#planTaskList .plan-task', els => els.map(e => e.className));
  assert(past.every(c => !c.includes('carry')), 'a past day lists its own tasks (no carry tags)');
  assert(!(await visible(pg, '#planCarryAlert')), 'carry alert only on today');
  // CUI-0022 / G24: a past day never opened has no clear-wrong task at all (not in the list, not in n / m)
  await openDay(pg, '2026-09-29');
  const d2 = await pg.evaluate(() => ({ count: byId('planDayCount').textContent, ring: byId('planRingPct').textContent, done: !byId('planDayDone').hidden,
    boxes: [...document.querySelectorAll('#planTaskList .plan-task')].map(e => e.className), text: byId('planTaskList').textContent }));
  assert(d2.count === '2 / 2 done' && d2.ring === '100%' && d2.done, 'CUI-0022: unopened past day: 2 / 2 done, 100%, done banner: ' + JSON.stringify(d2));
  assert(d2.boxes.length === 2 && !d2.boxes.some(c => c.includes('review')) && !d2.text.includes('Decided on the day'), 'CUI-0022: no clear-wrong box on it');
  assert(await pg.evaluate(() => planVisibleTasks(planLoad().days[2], '2026-10-01').length) === 4 && await pg.evaluate(() => planVisibleTasks(planLoad().days[4], '2026-10-01').length) === 5,
    'planVisibleTasks: a past unopened review is dropped; an ahead day keeps it (G23)');
}
// ahead days (G23) and the exam day ahead (QA O-1)
async function checkAheadDays(pg) {
  await fresh(pg);
  await seedPlan(pg);
  // ahead: a drill day (G23: decided on the day), a rest day, a mock day
  await openDay(pg, '2026-10-06');
  assert(await text(pg, '#planDayPhase') === 'Drill phase · ahead' && (await text(pg, '#planDayHint')).includes('early'), 'ahead day: pill · ahead + early hint');
  const drill = await pg.$$eval('#planTaskList .plan-task', els => els.map(e => [e.className, e.querySelector('.plan-task-st').textContent, (e.querySelector('.plan-task-go') || { textContent: '' }).textContent]));
  assert(drill.every(d => d[1] === 'Decided on the day from your wrong answers' && d[2] === '' && d[0].includes('todo')), 'G23: drill / wrong facts ahead: decided on the day, cannot start early: ' + JSON.stringify(drill));
  await openDay(pg, '2026-10-02');
  const ahead = await pg.$$eval('#planTaskList .plan-task', els => els.map(e => [e.querySelector('.plan-task-st').textContent, (e.querySelector('.plan-task-go') || { textContent: '' }).textContent]));
  assert(ahead[0][0] === '7 facts · Study' && ahead[0][1] === 'Start ›' && /^9 questions · Practice$/.test(ahead[1][0]), 'G23: read + practise ahead can start early: ' + JSON.stringify(ahead));
  assert(ahead[ahead.length - 1][0] === 'Decided on the day from your wrong answers', 'G23: clear wrong answers ahead: decided on the day');
  // QA O-1: the exam day ahead is a non-today view too, so it offers "back to today"
  await openDay(pg, '2026-10-29');
  assert(await visible(pg, '#planDayExam') && await visible(pg, '#planBackToday'), 'O-1: exam day ahead: "← Back to today" shows');
  assert(await hitOk(pg, '#planBackToday'), `O-1: "back to today" on the exam day: ${HIT_MIN_PX}px`);
  await pg.click('#planBackToday');
  assert(await text(pg, '#planDayTitle') === "Today's tasks" && await visible(pg, '#planDayHead') && !(await visible(pg, '#planBackToday')), 'O-1: back to today from the exam day');
}
// v1.0.4 (user): a rest day shows a large 😴 instead of the ring; the next study day shows the ring again
async function checkRestDayLook(pg) {
  await fresh(pg);
  await seedPlan(pg);
  await openDay(pg, '2026-10-04');
  const rest = await restLook(pg);
  assert(!rest.ring && rest.emoji === '😴' && rest.emojiShown && rest.emojiHidden, 'v1.0.4 (user): rest day: no ring, a large 😴 (aria-hidden) in its place: ' + JSON.stringify(rest));
  assert(rest.count === 'Rest day: no tasks' && rest.countSrOnly, 'v1.0.4: "Rest day: no tasks" is not shown but stays for screen readers: ' + JSON.stringify(rest));
  assert(rest.pill === 'Rest day' && await visible(pg, '#planBackToday') && await hitOk(pg, '#planBackToday'), 'v1.0.4: rest day keeps the "Rest day" pill and "← Back to today"');
  assert(rest.emojiPx >= REST_EMOJI_MIN_PX, `v1.0.4: the 😴 is large (≥ ${REST_EMOJI_MIN_PX}px): ${rest.emojiPx}`);
  assert(await pg.$$eval('#planTaskList .plan-task', els => els.length) === 0, 'rest day: no task boxes');
  await pg.click('#planDayNext');
  const study = await restLook(pg);
  assert(study.ring && !study.emojiShown && !study.countSrOnly && /^0 \/ \d+ done$/.test(study.count), 'v1.0.4: the next study day shows the ring and the count again: ' + JSON.stringify(study));
}

async function checkMockDay(pg) {
  await fresh(pg, at('2026-10-22'));
  await seedPlan(pg, { log: false });
  await pg.evaluate(() => writePlanLog({ v: 1, days: { '2026-10-22': { mock: [{ exam: 1, correct: 16, total: 24 }, { exam: 'all', correct: 20, total: 24 }] } } }));
  await openDay(pg);
  const m = await pg.$$eval('#planTaskList .plan-task', els => els.map(e => [e.className, e.querySelector('.plan-task-ttl').textContent, e.querySelector('.plan-task-st').textContent]));
  assert(m[0][0].includes('done') && m[0][2] === '✓ Passed · best 20 / 24', 'G10 / G25: slot 1 passed, best score: ' + m[0][2]);
  assert(!m[1][0].includes('done') && m[1][2] === 'Best 20 / 24 · pass mark 18', 'slot 2 open, best score + pass mark: ' + m[1][2]);
  assert(/^Timed mock exam: Exam \d+$/.test(m[0][1]), 'mock task names its exam: ' + m[0][1]);
}

async function checkExamDayAndEnded(pg) {
  await fresh(pg, at('2026-10-29'));
  await seedPlan(pg);
  await pg.evaluate(() => leaveToHome());
  const card = await text(pg, '#planCard');
  assert(card.includes('Exam day') && card.includes('good luck'), 'G16 exam day: Home card: ' + card);
  await pg.click('#planCard [data-action="openPlanDay"]');
  assert(await text(pg, '#planDayTitle') === 'Exam day' && await visible(pg, '#planDayExam') && !(await visible(pg, '#planDayHead')), 'exam day screen: banner, no ring');
  assert((await text(pg, '#planDayExam')).includes('good luck') && await pg.$eval('#planDayNext', e => e.disabled), 'exam day: "good luck", › disabled');
  assert(await pg.$$eval('#planTaskList .plan-task', els => els.length) === 0 && !(await visible(pg, '#planCarryAlert')), 'G16: no tasks, no carry-over');
  const cell = await pg.$eval('#planCal [data-iso="2026-10-29"]', e => ({ cls: e.className, current: e.getAttribute('aria-current'),
    outline: getComputedStyle(e).outlineStyle, image: getComputedStyle(e).backgroundImage }));
  assert(cell.cls.includes('today') && cell.current === 'date' && cell.outline === 'solid' && cell.image.includes('gradient'),
    'QA O-2: on the exam day its cell has the today outline and keeps the lattice: ' + JSON.stringify(cell));
  await fresh(pg, at('2026-11-02'));
  await seedPlan(pg);
  await pg.evaluate(() => leaveToHome());
  const ended = await text(pg, '#planCard');
  assert(ended.includes('Plan finished') && /Average \d+%/.test(ended) && ended.includes('/ 236 facts'), 'G16 ended: summary: ' + ended);
  assert(await visible(pg, '#planCard [data-action="openPlanGoal"]') && await visible(pg, '#planCard [data-action="planEditGoal"]'), 'ended: "New plan" + "Change goal"');
  assert(ended.includes('0 mocks at 21/24 or more'), 'ended: 0 mocks (plural)');
  await pg.evaluate(() => { const log = planLoadLog(); log.days['2026-10-22'] = { ok: {}, bad: {}, mock: [{ exam: 1, correct: 22, total: 24 }] }; writePlanLog(log); leaveToHome(); });
  const one = await text(pg, '#planCard');
  assert(one.includes('1 mock at 21/24 or more') && !one.includes('1 mocks'), 'S-116: one safe mock reads "1 mock": ' + one);
  for (const s of ['#planCard [data-action="openPlanGoal"]', '#planCard [data-action="planEditGoal"]', '#planCard [data-action="openPlanSchedule"]']) assert(await hitOk(pg, s), `${s}: ${HIT_MIN_PX}px`);
  await pg.click('#planCard [data-action="openPlanGoal"]');
  assert(await activeScreen(pg) === 'screenPlanGoal' && (await text(pg, '#planCreateBtn')).startsWith('Build'), '"New plan" opens the goal form for a new plan');
  await pg.evaluate(() => leaveToHome());
  await pg.click('#planCard [data-action="planEditGoal"]');
  assert(await activeScreen(pg) === 'screenPlanGoal' && (await text(pg, '#planCreateBtn')).startsWith('Update'), '"Change goal" opens the prefilled form');
  // the schedule and calendar stay readable after the exam (G16)
  await openDay(pg);
  assert(await text(pg, '#planDayTitle') === 'Exam day', 'after the exam the day screen opens at the exam day');
}

async function checkHomeCard(pg) {
  await fresh(pg);
  await seedPlan(pg);
  await pg.evaluate(() => leaveToHome());
  const r = await pg.evaluate(() => ({
    ttl: byId('planCard').querySelector('.plan-home-ttl').textContent, cd: byId('planCard').querySelector('.plan-home-cd').textContent,
    pct: byId('planCard').querySelector('.plan-home-pct').textContent, bar: byId('planCard').querySelector('.plan-home-bar i').style.width,
    next: byId('planCard').querySelector('.plan-home-next').textContent, go: byId('planCard').querySelector('[data-action="planContinue"]').textContent,
    want: planDayCompletion(planLoad().days[3], planDayLog(planLoadLog(), '2026-10-01')).pct,
  }));
  assert(r.ttl === '🗓️ Study plan · Day 4 / 31' && r.cd === '28 days to the exam · 29/10', 'Home card: Day n / N + countdown: ' + r.ttl + ' | ' + r.cd);
  assert(r.pct === `${r.want}%` && r.bar === `${r.want}%`, `Home card: today ${r.want}% + bar`);
  assert(/^Next: Read Ch 4 Modern society facts #\d+–\d+ \(continue from #\d+\)$/.test(r.next), 'Home card: next step, continue from #n: ' + r.next);
  assert(r.go === "Continue today's tasks →", 'Home card: continue button');
  assert(await hitOk(pg, '#planCard [data-action="planContinue"]') && await hitOk(pg, '#planCard [data-action="openPlanSchedule"]'), `Home card buttons: ${HIT_MIN_PX}px`);
  const low = (await contrastOf(pg, '#planCard .plan-home *')).filter(c => c.ratio < MIN_CONTRAST || !c.opaque);
  assert(low.length === 0, `Home card text ≥ ${MIN_CONTRAST}:1: ` + JSON.stringify(low));
  // unreadable log: the card says so and points to ↺ Reset
  await pg.evaluate(() => { localStorage.setItem('lifeuk.studyPlanProgress', '{bad'); leaveToHome(); });
  assert((await text(pg, '#planCard')).includes('↺ Reset plan'), 'unreadable log: Home card hint: ' + await text(pg, '#planCard'));
  // a rest day today: no %, carry-over is the next step
  await pg.clock.setFixedTime(at('2026-10-04'));
  await pg.evaluate(() => { localStorage.removeItem('lifeuk.studyPlanProgress'); leaveToHome(); });
  const rest = await text(pg, '#planCard');
  assert(rest.includes('Rest day today') && rest.includes('catch-up'), 'rest day: no %, next = catch-up: ' + rest);
}

async function checkCalendar(pg) {
  await fresh(pg);
  await seedPlan(pg);
  await openDay(pg);
  const r = await pg.evaluate(() => {
    const cells = [...document.querySelectorAll('#planCal .plan-cell')];
    const by = d => cells.find(c => c.dataset.iso === d);
    return {
      title: byId('planCalTitle').textContent, dow: [...document.querySelectorAll('#planCal .plan-dow')].map(e => e.textContent).join(),
      lead: document.querySelectorAll('#planCal .plan-cal-lead').length, cells: cells.length,
      d1: by('2026-10-01').className, d2: by('2026-10-02').className, rest: by('2026-10-04').className, exam: by('2026-10-29').className,
      examText: by('2026-10-29').textContent, out: by('2026-10-30').className, outTag: by('2026-10-30').tagName, btn: by('2026-10-02').tagName,
      label: by('2026-10-01').getAttribute('aria-label'), current: by('2026-10-01').getAttribute('aria-current'),
      prev: byId('planCalPrev').disabled, next: byId('planCalNext').disabled, todayBtn: byId('planCalToday').disabled,
      streak: byId('planStreak').hidden ? '' : byId('planStreak').textContent,
    };
  });
  assert(r.title === 'October 2026' && r.dow === 'Sun,Mon,Tue,Wed,Thu,Fri,Sat' && r.lead === 4 && r.cells === 31, 'October 2026: weeks from Sunday, 4 blanks, 31 days');
  assert(r.d1.includes('today') && /\bh[0-4]\b/.test(r.d1) && r.current === 'date', 'today cell: band + outline + aria-current');
  assert(r.d2.includes('future') && r.rest.includes('rest') && r.exam.includes('exam') && r.examText.includes('Exam'), 'ahead / rest / exam cells');
  assert(r.out.includes('out') && r.outTag === 'SPAN' && r.btn === 'BUTTON', 'outside the plan: plain number; plan days are buttons');
  assert(r.label === 'Day 4 · 1/10 · 26%' || /^Day 4 · 1\/10 · \d+%$/.test(r.label), 'cell label: ' + r.label);
  assert(r.prev === false && r.next === true && r.todayBtn === true, '‹ to September, › last month, "Today" on today\'s month');
  assert(await calNavShown(pg), 'v1.0.4: a plan across two months (Sep–Oct) keeps the month navigation ‹ Today ›');
  assert(r.streak === '', 'G29: Day 3 below 100% breaks the run (0 days: no pill): ' + r.streak);
  await pg.click('#planCalPrev');
  const sep = await pg.evaluate(() => ({ title: byId('planCalTitle').textContent, past: document.querySelector('#planCal [data-iso="2026-09-29"]').className,
    out: document.querySelector('#planCal [data-iso="2026-09-27"]').className, prev: byId('planCalPrev').disabled, focus: document.activeElement.id }));
  assert(sep.title === 'September 2026' && sep.past.includes('past') && sep.past.includes('h4') && sep.out.includes('out'), 'September: past 100% day, before the plan outside');
  assert(sep.prev && sep.focus === 'planCalNext', '‹ disabled on the first month; focus moves to › instead of <body>');
  await pg.click('#planCalToday');
  assert(await text(pg, '#planCalTitle') === 'October 2026', '"Today" back to today\'s month');
  const calFocus = await pg.evaluate(() => ({ id: document.activeElement.id, disabled: document.activeElement.disabled }));
  assert(calFocus.id === 'planCalPrev' && !calFocus.disabled, 'W-036: "Today" disables itself, focus goes to the arrow still enabled: ' + JSON.stringify(calFocus));
  // a cell opens its day; the viewed day is marked
  await pg.click('#planCal [data-iso="2026-10-02"]');
  assert(await text(pg, '#planDayTitle') === 'Day 5 tasks' && await pg.$eval('#planCal [data-iso="2026-10-02"]', e => e.className.includes('viewing')), 'cell opens its day, marked as viewing');
  assert(await pg.evaluate(() => document.activeElement.id) === 'planDayHeading' && await pg.evaluate(() => scrollY) === 0, 'opening a day from the calendar moves to the top, focus on the heading');
  const low = (await contrastOf(pg, '#planCal .plan-cell, #planCal .plan-dow, #planCalTitle')).filter(c => c.ratio < MIN_CONTRAST || !c.opaque);
  assert(low.length === 0, `calendar numbers ≥ ${MIN_CONTRAST}:1 (past cells lighter, never opacity): ` + JSON.stringify(low));
  for (const s of ['#planCalPrev', '#planCalNext', '#planCalToday']) assert(await hitOk(pg, s), `${s}: ${HIT_MIN_PX}px`);
}

// v1.0.4 (user): a plan inside one calendar month has nothing to page through, so ‹ Today › is not shown
async function checkSingleMonthCalendar(pg) {
  await fresh(pg);
  await pg.evaluate(goal => writeStudyPlan(buildPlan(goal, '2026-10-01')), GOAL);
  await openDay(pg);
  assert(await text(pg, '#planCalTitle') === 'October 2026' && !(await calNavShown(pg)), 'v1.0.4: plan 1–29 Oct: month title, no ‹ Today ›');
  await pg.click('#planCal [data-iso="2026-10-05"]');
  assert(!(await calNavShown(pg)) && await pg.evaluate(() => document.activeElement.id) === 'planDayHeading', 'v1.0.4: still hidden after opening a day; focus on the heading');
  await pg.evaluate(() => { writeStudyPlan(buildPlan({ examDate: '2026-11-03', dailyMins: 120, restDays: [0], level: 'none' }, '2026-10-01')); renderPlanDay(); });
  assert(await calNavShown(pg), 'v1.0.4: the same screen re-rendered for a plan into November shows ‹ Today › again');
}

async function checkKpis(pg) {
  await fresh(pg);
  await seedPlan(pg);
  await openDay(pg);
  const r = await pg.evaluate(() => ({ k: planKpis(planLoad(), planLoadLog(), planTodayIso()),
    plan: byId('planKpiPlan').textContent, sub: byId('planKpiPlanSub').textContent, avg: byId('planKpiAvg').textContent, left: byId('planKpiLeft').textContent,
    rows: [...document.querySelectorAll('#planKpiRows .plan-pr')].map(e => [e.querySelector('.plan-pr-k').textContent, e.querySelector('.plan-pr-v').textContent, e.querySelector('.plan-meter-fill').getAttribute('class'), e.querySelector('.plan-meter-fill').style.width]) }));
  assert(r.plan === `${r.k.planPct}%` && r.sub === 'Day 4 / 31' && r.avg === `${r.k.avgPct}%` && r.left === '28 days', 'stats: plan %, Day n / N, average, days left');
  assert(r.rows.length === 3 && r.rows[0][0] === 'Facts read' && r.rows[0][1].startsWith(`${r.k.factsDone} / 236`), 'bar 1: facts read: ' + JSON.stringify(r.rows[0]));
  assert(r.rows[1][1].startsWith(`${r.k.qidsDone} / 389`) && r.rows[2][0] === 'Mocks ≥ 21/24', 'bars 2 + 3: questions practised, safe mocks');
  assert(r.rows.every(row => /\bh[0-4]\b/.test(row[2]) && /%$/.test(row[3])), 'bars: G27 band + width from JS');
}

async function checkScheduleRows(pg) {
  await fresh(pg);
  await seedPlan(pg);
  await pg.evaluate(() => openPlanSchedule());
  const rows = await pg.$$eval('#planDayList .plan-day', els => els.map(e => [e.tagName, e.dataset.action, e.dataset.arg]));
  assert(rows.every(r => r[0] === 'BUTTON' && r[1] === 'openPlanDay'), 'schedule: every row is a button that opens its day');
  // v1.0.3 (user): no › pill on days ahead; the whole row still opens the day
  const ahead = await pg.evaluate(() => [...document.querySelectorAll('#planDayList .plan-day:not(.past):not(.today):not(.rest):not(.exam)')].map(e => e.querySelectorAll('.plan-pill').length));
  assert(ahead.length > 0 && ahead.every(n => n === 0), 'ahead rows show no pill (no ›): ' + JSON.stringify(ahead));
  await pg.click('#planDayList [data-arg="2026-09-29"]');
  assert(await activeScreen(pg) === 'screenPlanDay' && await text(pg, '#planDayTitle') === 'Day 2 tasks', 'a row opens its day');
  await pg.evaluate(() => openPlanSchedule());
  await pg.click('#screenPlanSchedule [data-action="openPlanDay"].plan-block');
  assert(await text(pg, '#planDayTitle') === "Today's tasks", '"View today\'s tasks →" under the list');
}

// PR4 QA O-1: a 6-month plan, 90 days in: rows far from today skip layout (content-visibility), yet the list still
// opens with today right under its sticky WEEK heading, and a language switch keeps the same rows in view
async function checkLongSchedule(pg) {
  await fresh(pg, at('2026-10-08'));
  await pg.evaluate(() => writeStudyPlan(buildPlan({ examDate: isoAddMonths('2026-10-08', 6), dailyMins: 120, restDays: [], level: 'none' }, '2026-10-08')));
  await pg.clock.setFixedTime(at('2027-01-06'));
  await pg.evaluate(() => openPlanSchedule());
  const frames = () => pg.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await frames();
  const r = await pg.evaluate(() => {
    const list = byId('planDayList'), today = list.querySelector('.plan-day.today'), rows = [...list.querySelectorAll('.plan-day')];
    const head = [...list.querySelectorAll('.plan-week')].filter(h => h.getBoundingClientRect().top <= list.getBoundingClientRect().top + 1).pop();
    return { rows: rows.length, far: rows.filter(e => getComputedStyle(e).contentVisibility === 'auto').length,
      todayFar: getComputedStyle(today).contentVisibility, gap: Math.round(today.getBoundingClientRect().top - head.getBoundingClientRect().bottom) };
  });
  assert(r.rows === 183 && r.far > 140 && r.todayFar === 'visible', `O-1: ${r.far} / ${r.rows} far rows skip layout, today's do not`);
  assert(Math.abs(r.gap) <= 1, 'O-1: the list still opens with today right under the sticky heading: gap ' + r.gap);
  await pg.evaluate(() => { const l = byId('planDayList'); l.classList.add('plan-jump'); l.scrollTop -= 3000; });
  await frames();
  const first = () => pg.evaluate(() => { const l = byId('planDayList');
    const row = [...l.querySelectorAll('.plan-day')].find(e => e.getBoundingClientRect().bottom > l.getBoundingClientRect().top + 30);
    return row.dataset.arg; });
  const before = await first();
  await pg.evaluate(() => setLang('zh-HK'));
  await frames();
  assert(await first() === before, 'O-1: after a language switch the same day is at the top of the list: ' + before);
  await pg.evaluate(() => setLang('en'));
}

// G6: midnight with the app open (setTimeout), and back to the foreground after midnight (visibilitychange)
async function checkMidnight(browser) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const pg = await ctx.newPage();
  await pg.clock.install({ time: at('2026-09-30', '23:59:30') });
  await pg.goto(APP_URL + '?preview=plan');
  await seedPlan(pg);
  await openDay(pg);
  assert(await text(pg, '#planDaySub') === '30/9 Wed · 3/31', 'before midnight: Day 3');
  await pg.clock.runFor(60000);
  assert(await text(pg, '#planDaySub') === '1/10 Thu · 4/31' && await text(pg, '#planDayTitle') === "Today's tasks", 'G6: past midnight the open day screen moves to the new today');
  assert(await pg.evaluate(() => Array.isArray(planLoad().days[3].tasks[2].qids)), 'G9: the new today is fixed at once');
  // a past day being looked at stays where it is
  await openDay(pg, '2026-09-29');
  await pg.clock.runFor(24 * 3600 * 1000);
  assert(await text(pg, '#planDayTitle') === 'Day 2 tasks', 'midnight: a looked-at day stays put');
  await pg.evaluate(() => leaveToHome());
  assert((await text(pg, '#planCard .plan-home-ttl')).includes('Day 5 / 31'), 'Home card follows: Day 5');
  // background over midnight: timers may not run; returning to the page moves the day
  await pg.clock.setSystemTime(at('2026-10-03', '07:00:00'));
  await pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  assert((await text(pg, '#planCard .plan-home-ttl')).includes('Day 6 / 31'), 'G6: back in the foreground → Day 6');
  await ctx.close();
}

// G6: the local date, whichever time zone the device is in now
async function checkTimeZones(browser) {
  const london = await browser.newContext({ timezoneId: 'Europe/London' });
  const lp = await london.newPage();
  await lp.clock.setFixedTime(new Date('2026-10-08T20:00:00Z')); // London 21:00 on 8 Oct, Hong Kong 04:00 on 9 Oct
  await lp.goto(APP_URL + '?preview=plan');
  await lp.evaluate(() => { writeStudyPlan(buildPlan({ examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' }, planTodayIso())); leaveToHome(); });
  assert((await text(lp, '#planCard .plan-home-ttl')).includes('Day 1 / 21'), 'London: built today = Day 1');
  const stored = await lp.evaluate(() => JSON.stringify({ ...localStorage }));
  const hk = await browser.newContext({ timezoneId: 'Asia/Hong_Kong' });
  const hp = await hk.newPage();
  await hp.clock.setFixedTime(new Date('2026-10-08T20:00:00Z'));
  await hp.goto(APP_URL);
  await hp.evaluate(s => Object.entries(JSON.parse(s)).forEach(([k, v]) => localStorage.setItem(k, v)), stored);
  await hp.goto(APP_URL);
  assert((await text(hp, '#planCard .plan-home-ttl')).includes('Day 2 / 21'), 'same moment in Hong Kong: already 9 Oct = Day 2');
  await london.close();
  await hk.close();
}

// G9: today's clear-wrong list is fixed at the first open; a later wrong answer waits for tomorrow
async function checkReviewSnapshot(pg) {
  await fresh(pg);
  await seedPlan(pg, { log: false });
  await pg.evaluate(() => { wrongList = { '3.1': true, '5.2': true }; setLS(WRONG_LS, wrongList); leaveToHome(); });
  const first = await pg.evaluate(() => planLoad().days[3].tasks[2].qids);
  assert(first.length === 2, 'G9: the Home card\'s first render fixed today\'s 2 wrong answers');
  await pg.evaluate(() => { wrongList['7.3'] = true; setLS(WRONG_LS, wrongList); openPlanDay(); });
  const again = await pg.evaluate(() => planLoad().days[3].tasks[2].qids);
  assert(JSON.stringify(again) === JSON.stringify(first), 'G9: a later wrong answer is not added today');
  assert(await pg.$eval('#planTaskList > li:nth-child(3) .plan-task-st', e => e.textContent) === '2 questions · Wrong answers', 'clear wrong answers: 2 questions: ');
}

// S-115: past midnight, "Build / Update" re-renders the form with the moved date and a notice
async function checkMidnightCta(pg) {
  await fresh(pg, at(TODAY, '23:50:00'));
  await seedPlan(pg, { log: false });
  await pg.evaluate(() => openPlanSchedule());
  await pg.click('#screenPlanSchedule [data-action="planEditGoal"]');
  await pg.fill('#planExamDate', '2026-10-02'); // tomorrow (G36)
  await pg.$eval('#planExamDate', e => e.blur());
  await pg.clock.setFixedTime(at('2026-10-02', '00:05:00'));
  await pg.click('#planCreateBtn');
  const r = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, date: byId('planExamDate').value,
    hint: byId('planGoalHint').hidden ? '' : byId('planGoalHint').textContent, disabled: byId('planCreateBtn').disabled }));
  assert(r.screen === 'screenPlanGoal' && r.date === '2026-10-03' && !r.disabled, 'S-115: past midnight the form re-renders with the new earliest date: ' + JSON.stringify(r));
  assert(r.hint.includes('check'), 'S-115: a notice says so: ' + r.hint);
  await pg.click('#planCreateBtn');
  assert(await activeScreen(pg) === 'screenPlanSchedule', 'S-115: the second press updates the plan');
  // create mode: + 7 crosses midnight the same way
  await fresh(pg, at(TODAY, '23:50:00'));
  await pg.click('#planCard .plan-cta');
  await pg.click('#planRestChips .chip >> nth=0'); // no rest day: today + 7 has the 7 study days a new plan needs
  await pg.fill('#planExamDate', '2026-10-08');
  await pg.$eval('#planExamDate', e => e.blur());
  await pg.clock.setFixedTime(at('2026-10-02', '00:05:00'));
  await pg.click('#planCreateBtn');
  assert(await activeScreen(pg) === 'screenPlanGoal' && await pg.$eval('#planExamDate', e => e.value) === '2026-10-09' && await visible(pg, '#planGoalHint'), 'S-115: create mode too');
  await pg.click('#planDaysChips .chip >> nth=0');
  assert(!(await visible(pg, '#planGoalHint')), 'S-115: the notice goes once the form changes');
}

// W-040: an old cached v1.0.3 index.html (no #planRestEmoji / #planCalBtns) with v1.0.4 JS still renders the day screen:
// today's tasks, a rest day with the ring and its count (the v1.0.3 look), the calendar
async function checkOldShell(pg) {
  await fresh(pg);
  await seedPlan(pg);
  const r = await pg.evaluate(() => {
    byId('planRestEmoji').remove(); // v1.0.3 markup: no 😴, and the month buttons' wrapper has no id
    byId('planCalBtns').removeAttribute('id');
    const run = f => { try { f(); return 'ok'; } catch (e) { return e.message; } };
    const today = run(() => openPlanDay());
    const tasks = document.querySelectorAll('#planTaskList .plan-task').length;
    const rest = run(() => openPlanDay('2026-10-04'));
    return { today, tasks, rest, ring: byId('planRing').getClientRects().length > 0, count: byId('planDayCount').textContent,
      cal: document.querySelectorAll('#planCal .plan-cell').length };
  });
  assert(r.today === 'ok' && r.tasks > 0 && r.cal > 0, 'W-040: old shell: today renders its tasks and calendar: ' + JSON.stringify(r));
  assert(r.rest === 'ok' && r.ring && r.count === 'Rest day: no tasks', 'W-040: old shell: a rest day keeps the ring and its count (v1.0.3 look): ' + JSON.stringify(r));
}

// v1.0.4 (user): on a rest day the 😴 sits close above the "Rest day" pill (its box hugs the glyph, a small gap), and
// "← Back to today" gets more room below the pill (the --space-8 token)
const REST_EMOJI_GAP_MAX_PX = 16;
const REST_BACK_GAP_TOKEN = '--space-8';
const restGaps = pg => pg.evaluate(token => {
  const r = id => byId(id).getBoundingClientRect();
  const emoji = r('planRestEmoji'), pill = r('planDayPhase'), back = r('planBackToday');
  const glyphPx = parseFloat(getComputedStyle(byId('planRestEmoji')).fontSize);
  const px = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(token));
  // the glyph's empty margin inside its box counts as gap too
  return { emojiToPill: pill.top - emoji.bottom + Math.max(0, (emoji.height - glyphPx) / 2), pillToBack: back.top - pill.bottom, token: px };
}, REST_BACK_GAP_TOKEN);
async function checkRestSpacing(browser) {
  for (const lang of ['en', 'zh-HK']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await ctx.newPage();
    await fresh(pg);
    await pg.evaluate(l => setLang(l), lang);
    await seedPlan(pg);
    await openDay(pg, '2026-10-04');
    const g = await restGaps(pg);
    assert(g.emojiToPill <= REST_EMOJI_GAP_MAX_PX, `v1.0.4 ${lang} 390px rest day: 😴 → pill gap ≤ ${REST_EMOJI_GAP_MAX_PX}px: ` + JSON.stringify(g));
    assert(g.token > 0 && g.pillToBack >= g.token - 0.5, `v1.0.4 ${lang} 390px rest day: pill → "Back to today" gap ≥ ${REST_BACK_GAP_TOKEN}: ` + JSON.stringify(g));
    await pg.click('#planDayNext');
    assert(!(await pg.evaluate(() => byId('planDayHead').classList.contains('rest'))), `v1.0.4 ${lang}: a study day drops the rest spacing`);
    await ctx.close();
  }
}

// no element of the active screen reaches past the viewport, no horizontal page scroll
const layoutOverflow = pg => pg.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const bad = [...document.querySelectorAll('.screen.active *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > vw + 0.5 || r.left < -0.5); });
  return { scroll: document.documentElement.scrollWidth > vw, bad: bad.slice(0, 3).map(e => e.className || e.tagName) };
});
// LAYOUT_OPENS: Home, today, a rest day, the exam day, the schedule
const LAYOUT_OPENS = [() => leaveToHome(), () => openPlanDay(), () => openPlanDay('2026-10-04'), () => openPlanDay('2026-10-29'), () => openPlanSchedule()];
async function checkLayout(browser) {
  for (const lang of ['en', 'zh-HK']) {
    for (const w of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
      const pg = await ctx.newPage();
      await fresh(pg);
      await pg.evaluate(l => setLang(l), lang);
      await seedPlan(pg);
      for (const open of LAYOUT_OPENS) {
        await pg.evaluate(open);
        const over = await layoutOverflow(pg);
        assert(!over.scroll && over.bad.length === 0, `${lang} ${w}px ${await activeScreen(pg)}: no horizontal overflow ` + JSON.stringify(over));
      }
      await checkTodayLayout(pg, lang, w);
      await ctx.close();
    }
  }
}
async function checkTodayLayout(pg, lang, w) {
  await pg.evaluate(() => openPlanDay());
  assert(await hitOk(pg, '#screenPlanDay .back-btn'), `S-117 ${lang} ${w}px: day header "← Home" has a ${HIT_MIN_PX}px tap area`);
  const shown = await pg.evaluate(() => [...document.querySelectorAll('#screenPlanDay [hidden]')].filter(e => getComputedStyle(e).display !== 'none').length);
  assert(shown === 0, `${lang} ${w}px: [hidden] never displayed`);
  assert(await hintJustified(pg), `v1.0.4 ${lang} ${w}px: hint justified, last line left, full info width`);
  if (lang !== 'zh-HK' || w !== 375) return;
  const t = await pg.evaluate(() => [byId('planDayTitle').textContent, byId('planDayCount').textContent, byId('planCalTitle').textContent, document.querySelector('#planTaskList .plan-tag').textContent]);
  assert(t[0] === '今日任務' && t[1] === '1 / 3 項完成' && t[2] === '2026 年 10 月' && t[3] === '1 題答錯，答對才計算', 'zh-HK (G21 written Chinese): ' + t.join(' | '));
}

(async () => {
  const browser = await chromium.launch(launchOpts);
  const pg = await browser.newPage({ viewport: { width: 375, height: 800 } });
  const errors = [];
  pg.on('pageerror', e => errors.push(e.message));
  try {
    await checkHidden(pg);
    await checkHeader(pg);
    await checkToday(pg);
    await checkCarryNotCounted(pg);
    await checkAllDone(pg);
    await checkPastAndAhead(pg);
    await checkAheadDays(pg);
    await checkRestDayLook(pg);
    await checkMockDay(pg);
    await checkExamDayAndEnded(pg);
    await checkHomeCard(pg);
    await checkCalendar(pg);
    await checkSingleMonthCalendar(pg);
    await checkKpis(pg);
    await checkScheduleRows(pg);
    await checkLongSchedule(pg);
    await checkReviewSnapshot(pg);
    await checkMidnightCta(pg);
    await checkMidnight(browser);
    await checkTimeZones(browser);
    await checkRestSpacing(browser);
    await checkOldShell(pg);
    await checkLayout(browser);
    assert(errors.length === 0, 'no page errors: ' + errors.join(' | '));
    console.log('PLAN-DAY PASS');
  } catch (e) {
    console.error(e.message);
    console.log('PLAN-DAY FAIL');
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
