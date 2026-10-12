// v2.0.0 desktop layout, Lane A — Home (handoff .proj-docs/plans/2026-10-12_handoff_desktop-layout.md §3 #1 / #4, §4 F7 /
// F8; Design Origin: mockups/v2.0.0/desktop-home.html A rev 3, desktop-home-plan.html A rev 7 + Ring + T):
// - ≥ 1024px: the plan card across the top; left rail 5/12 (modes, description, hint / reset) | right 7/12 (My Review,
//   practice tabs, sets); no sideways scroll at 1024 × 768 / 1280 × 800, EN / 中, small / large text, translation on / off
// - F8: the rail is sticky while it fits the viewport; taller (a short window, large text + 中文) it scrolls with the page
// - below 1024px every part is back in its phone place and order (the phone layout never changes)
// - F7: the navy card shows today's ring and the countdown timeline (≤ 42 days a cell a day; longer a bar a phase + month
//   ticks; the days-left label at the end under 28%; "Today" beside the marker; none on the exam day / after it); the
//   buttons' bottom on the ring's; "Next" on one line while it fits, never cut; the phone keeps the % bar + countdown text
// - F1: a finished plan offers "New plan" + "Schedule" only
const fs = require('fs');
const path = require('path');
const dt = require('./desktop-helpers');
const { assert } = dt;

const PX = 1;
const near = (a, b, slack = PX) => Math.abs(a - b) <= slack;
const GOAL = { dailyMins: 120, restDays: [0], level: 'none' };
const RAIL_SHARE = 5 / 12;
const PER_DAY_MAX = 42;
const SHORT_WINDOW = { width: 1024, height: 600 };

// a plan of `days` days whose Day `dayN` is today (dayN > days: after the plan; restToday: today is a rest day);
// a few wrong answers and a flag so My Review shows
const seedHome = (page, { plan = null } = {}) => page.evaluate(plan => {
  ['1.0', '1.1', '2.3'].forEach(k => { wrongList[k] = true; });
  practiceFlags['4.5'] = true;
  if (plan) {
    const today = planTodayIso(), start = isoAddDays(today, 1 - plan.dayN);
    const restDays = plan.restToday ? [isoWeekday(today)] : plan.goal.restDays;
    writeStudyPlan(buildPlan({ ...plan.goal, restDays, examDate: isoAddDays(start, plan.days) }, start));
    writePlanLog(planEmptyLog());
  }
  leaveToHome();
}, plan && { goal: GOAL, days: 21, dayN: 9, ...plan });

const layout = page => page.evaluate(() => {
  const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const cols = document.querySelector('.home-cols'), rail = document.querySelector('.home-rail');
  return {
    cols: box(cols), rail: box(rail), main: box(document.querySelector('.home-main')), card: box(byId('planCard')),
    gap: cols ? parseFloat(getComputedStyle(cols).columnGap) : 0, railPos: rail ? getComputedStyle(rail).position : null,
    railHas: rail ? ['modeDesc', 'practiceReset', 'examReset'].every(id => rail.contains(byId(id))) && !!rail.querySelector('.mode-grid') : false,
    mainHas: ['myReview', 'practiceTabs', 'secDifficulty', 'secChapter', 'secExam'].every(id => document.querySelector('.home-main') && document.querySelector('.home-main').contains(byId(id))),
  };
});
// the phone order: every part a direct child of #screenHome, in index.html order
const phoneOrder = page => page.evaluate(() => {
  const home = byId('screenHome');
  const ids = ['installBanner', 'modeDesc', 'myReview', 'practiceByTitle', 'practiceTabs', 'secDifficulty', 'secChapter', 'secExam', 'practiceReset', 'examReset'];
  const kids = [...home.children];
  const at = ids.map(id => kids.indexOf(byId(id)));
  return !document.querySelector('.home-cols') && at.every(i => i >= 0) && at.every((i, k) => k === 0 || i > at[k - 1])
    && kids.indexOf(home.querySelector('.mode-grid')) < at[1];
});

async function checkColumns(b) {
  await dt.forEachCase(b, async ({ page, label, errors }) => {
    await seedHome(page);
    const side = await dt.noHorizontalScroll(page);
    assert(side.ok, `${label}: Home has no sideways scroll (${side.detail})`);
    const l = await layout(page);
    assert(l.cols && l.railHas && l.mainHas, `${label}: rail = modes / description / hint + reset, right = My Review / tabs / sets`);
    const want = (l.cols.width - l.gap) * RAIL_SHARE;
    assert(near(l.rail.width, want, 2) && near(l.rail.left, l.cols.left) && near(l.main.right, l.cols.right), `${label}: rail 5/12 (${Math.round(l.rail.width)} ≈ ${Math.round(want)}), right 7/12`);
    assert(near(l.card.left, l.cols.left) && near(l.card.right, l.cols.right) && l.card.bottom <= l.cols.top, `${label}: the create card runs across the top`);
    assert(errors.length === 0, `${label}: no page errors ` + errors.join(' | '));
  });
}

// F8: sticky while it fits; a rail taller than the window scrolls with the page
async function checkSticky(b) {
  const { page } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.small });
  await seedHome(page);
  let l = await layout(page);
  assert(l.railPos === 'sticky', '1024 × 768 en: the rail is sticky');
  await page.evaluate(() => byId('modeExam').click()); // the exam list is short: give the page room to scroll
  await page.evaluate(() => byId('modePractice').click());
  await page.evaluate(() => byId('ptabExam').click());
  await page.evaluate(() => window.scrollTo(0, 400));
  const pinned = await page.evaluate(() => {
    const rail = document.querySelector('.home-rail').getBoundingClientRect(), header = document.querySelector('header').getBoundingClientRect();
    return { top: rail.top, header: header.bottom, scrolled: scrollY };
  });
  assert(pinned.scrolled > 0 && pinned.top >= pinned.header, 'scrolled: the rail stays under the header: ' + JSON.stringify(pinned));
  await page.close();
  for (const { lang, fontSize } of [{ lang: 'zh-HK', fontSize: 'large' }, { lang: 'en', fontSize: 'large' }]) {
    const short = await dt.openDesktop(b, { viewport: SHORT_WINDOW, lang, fontSize });
    await seedHome(short.page);
    l = await layout(short.page);
    const tall = l.rail.height + (l.rail.top - 0) > SHORT_WINDOW.height;
    assert(tall && l.railPos === 'static', `F8 ${SHORT_WINDOW.width} × ${SHORT_WINDOW.height} ${lang} large: the rail (${Math.round(l.rail.height)}px) is taller than the window, so it is not sticky`);
    await dt.setViewport(short.page, dt.VIEWPORTS.wide);
    l = await layout(short.page);
    assert(l.railPos === 'sticky', `F8 ${lang} large: back to sticky once the window is tall enough (1280 × 800)`);
    await short.page.close();
  }
}

// below 1024px the parts go back to their phone order; above, into the columns again
async function checkBreakpoint(b) {
  const { page } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.wide });
  await seedHome(page, { plan: {} });
  assert(!(await phoneOrder(page)), '1280px: columns on');
  await dt.setViewport(page, dt.VIEWPORTS.belowDesktop);
  assert(await phoneOrder(page), '1023px: every part back in its phone place and order');
  const phoneCard = await page.evaluate(() => ({ bar: !!document.querySelector('#planCard .plan-home-bar'), cd: !!document.querySelector('#planCard .plan-home-cd'),
    ring: !!document.querySelector('#planCard .plan-home-ring'), timeline: !!document.querySelector('#planCard .plan-cd') }));
  assert(phoneCard.bar && phoneCard.cd && !phoneCard.ring && !phoneCard.timeline, '1023px: the card is redrawn with the % bar and countdown text: ' + JSON.stringify(phoneCard));
  await dt.setViewport(page, dt.VIEWPORTS.small);
  const l = await layout(page);
  assert(l.cols && l.railHas && l.mainHas && !(await phoneOrder(page)), '1024px again: columns back');
  await page.close();
  const phone = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.phone });
  await seedHome(phone.page, { plan: {} });
  assert(await phoneOrder(phone.page), '390px: phone order, no column boxes');
  await phone.page.close();
}

// ── F7: the navy card ──
const card = page => page.evaluate(() => {
  const el = byId('planCard'), q = s => el.querySelector(s), box = e => (e ? e.getBoundingClientRect() : null);
  const cd = q('.plan-cd'), ring = q('.plan-home-ring'), acts = q('.plan-home-acts'), next = q('.plan-home-next');
  const lbl = q('.plan-cd-today-lbl'), left = q('.plan-cd-left-lbl'), track = q('.plan-cd-track');
  const overlap = (a, b) => !!a && !!b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const inside = (a, b) => !!a && !!b && a.left >= b.left - 1 && a.right <= b.right + 1;
  return {
    cd: !!cd, long: !!cd && cd.classList.contains('long'), cells: cd ? cd.querySelectorAll('.plan-cd-track > i').length : 0,
    future: cd ? cd.querySelectorAll('.plan-cd-track > i.future').length : 0, ticks: cd ? cd.querySelectorAll('.plan-cd-tick').length : 0,
    ticksInside: cd ? [...cd.querySelectorAll('.plan-cd-tick')].every(t => inside(box(t), box(cd))) : true,
    labelEnd: !!left && left.classList.contains('end'), labelsApart: !overlap(box(lbl), box(left)),
    todayInside: !!lbl && inside(box(lbl), box(cd)), leftText: left ? left.textContent : '',
    markerAt: cd ? (box(q('.plan-cd-today')).left + 1 - box(track).left) / box(track).width * 100 : null, at: cd ? Number(cd.dataset.at) : null,
    ring: ring ? ring.tagName.toLowerCase() : null, ringText: ring ? ring.textContent : '', rest: !!q('.plan-home-rest'),
    ringBottom: box(ring) && box(ring).bottom, actsBottom: box(acts) && box(acts).bottom,
    bar: !!q('.plan-home-bar'), cdText: !!q('.plan-home-cd'),
    nextCut: !!next && next.scrollWidth > next.clientWidth + 1, nextWrapped: !!next && next.classList.contains('is-wrapped'),
    acts: [...el.querySelectorAll('.plan-home-acts button')].map(btn => btn.dataset.action),
    sr: cd ? cd.querySelector('.plan-sr').textContent : '',
  };
});
async function openWithPlan(b, plan, opts = {}) {
  const opened = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.wide, ...opts });
  await seedHome(opened.page, { plan });
  return opened;
}
async function checkCardActive(b) {
  await dt.forEachCase(b, async ({ page, label, errors }) => {
    await seedHome(page, { plan: {} });
    const c = await card(page);
    assert(c.cd && !c.long && c.cells === 21 && c.future === 12, `${label}: 21 days, Day 9: a cell a day, 12 still to come`);
    assert(c.ring === 'svg' && !c.bar && !c.cdText, `${label}: today's ring instead of the % bar; the timeline instead of the countdown text`);
    assert(near(c.ringBottom, c.actsBottom), `${label}: the buttons' bottom on the ring's (${Math.round(c.actsBottom)} / ${Math.round(c.ringBottom)})`);
    assert(near(c.markerAt, c.at, 0.5) && c.labelsApart && c.todayInside, `${label}: the gold marker at today (${c.markerAt.toFixed(1)}% ≈ ${c.at.toFixed(1)}%), labels apart and inside`);
    assert(!c.nextCut, `${label}: "Next" is never cut (${c.nextWrapped ? 'wrapped' : 'one line'})`);
    assert(c.leftText.includes('13') && c.sr.includes('13'), `${label}: 13 days to the exam (bracket + screen-reader line)`);
    const side = await dt.noHorizontalScroll(page);
    assert(side.ok && errors.length === 0, `${label}: no sideways scroll, no page errors ` + errors.join(' | '));
  }, { translations: [true] });
}
async function checkCardBranches(b) {
  let o = await openWithPlan(b, { days: 21, dayN: 1 });
  let c = await card(o.page);
  assert(c.cd && c.future === 20 && near(c.at, 0, 0.01) && c.todayInside && c.labelsApart, 'Day 1: marker at the start, "Today" on its right, inside the bar');
  await o.page.close();
  o = await openWithPlan(b, { days: 21, dayN: 19 });
  c = await card(o.page);
  assert(c.labelEnd && c.labelsApart && c.todayInside, 'Day 19 / 21 (span 14% < 28%): the days-left label at the end, off "Today"');
  await o.page.close();
  o = await openWithPlan(b, { days: 21, dayN: 9 }, { viewport: dt.VIEWPORTS.small, lang: 'zh-HK', fontSize: 'large' });
  c = await card(o.page);
  assert(!c.labelEnd && c.labelsApart, '1024 中 large, Day 9: the label centred in the bracket');
  await o.page.close();
  o = await openWithPlan(b, { days: PER_DAY_MAX, dayN: 10 });
  c = await card(o.page);
  assert(c.cd && !c.long && c.cells === PER_DAY_MAX && c.ticks === 0, `${PER_DAY_MAX} days (6 weeks): still a cell a day, no month ticks`);
  await o.page.close();
  for (const [days, dayN] of [[90, 40], [181, 60], [181, 170]]) {
    o = await openWithPlan(b, { days, dayN });
    c = await card(o.page);
    assert(c.cd && c.long && c.cells < days && c.ticks >= 2 && c.ticksInside, `${days} days, Day ${dayN}: a bar a phase (${c.cells}), ${c.ticks} month ticks inside the timeline`);
    assert(c.labelsApart && c.todayInside && c.labelEnd === (100 - c.at < 28), `${days} days, Day ${dayN}: labels apart, end label ${c.labelEnd}`);
    await o.page.close();
  }
  o = await openWithPlan(b, { days: 21, dayN: 9, restToday: true });
  c = await card(o.page);
  assert(c.cd && c.rest && c.ring === 'span', 'a rest day: 😴 in the ring\'s place, the timeline stays');
  await o.page.close();
  o = await openWithPlan(b, { days: 21, dayN: 22 });
  c = await card(o.page);
  assert(!c.cd && !c.ring && !c.bar, 'the exam day: no timeline, no ring');
  await o.page.close();
  o = await openWithPlan(b, { days: 21, dayN: 25 });
  c = await card(o.page);
  assert(!c.cd && !c.ring && JSON.stringify(c.acts) === JSON.stringify(['openPlanGoal', 'openPlanSchedule']), 'plan finished: no timeline / ring; F1 "New plan" + "Schedule"');
  await o.page.close();
  o = await openWithPlan(b, { days: 21, dayN: 0 });
  c = await card(o.page);
  assert(!c.cd && !c.ring && c.cdText, 'before the start: the countdown text, no timeline / ring');
  await o.page.close();
}
// "Next" stays on one line while it fits; a long one at 1024 large wraps instead of being cut
async function checkNextLine(b) {
  const o = await openWithPlan(b, { days: 21, dayN: 9 }, { viewport: dt.VIEWPORTS.small, fontSize: 'large' });
  await o.page.evaluate(() => {
    const next = document.querySelector('#planCard .plan-home-next');
    next.innerHTML += ' — a much longer line than the card can hold on one line at this width, to make it wrap';
    runRefits();
  });
  const c = await card(o.page);
  assert(c.nextWrapped && !c.nextCut, '1024 large: a "Next" too long for one line wraps, never cut');
  await o.page.close();
}

// W-380: the plain timeline colours outside @supports (color-mix) are what an older browser (iPadOS 15) draws; each one
// must stand off the navy card itself (never the card's own colour; ≥ 3:1, WCAG 1.4.11), translucent ones composited
const FALLBACK_MIN_CONTRAST = 3;
// the stylesheet is read here: file:// pages can't read their own cssRules
const PLAN_CSS = path.join(__dirname, '..', 'css', 'screens', 'plan.css');
const plainTimelineColours = () => {
  const line = fs.readFileSync(PLAN_CSS, 'utf8').split('\n').find(l => /^\.plan-card \{[^}]*--plan-cd-learn:/.test(l)) || '';
  return Object.fromEntries([...line.matchAll(/--plan-cd-(learn|drill|mock|rest):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
};
async function checkFallbackColours(b) {
  const o = await openWithPlan(b, { days: 21, dayN: 9 });
  const plain = plainTimelineColours();
  const res = await o.page.evaluate(plain => {
    const home = document.querySelector('#planCard .plan-home');
    const rgba = c => { const m = c.match(/[\d.]+/g).map(Number); return { rgb: m.slice(0, 3), a: m.length > 3 ? m[3] : 1 }; };
    const bg = rgba(getComputedStyle(home).backgroundColor).rgb;
    const lum = rgb => rgb.map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (x, y) => { const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
    const probe = document.createElement('i');
    home.appendChild(probe);
    const out = ['learn', 'drill', 'mock', 'rest'].map(ph => {
      const raw = plain[ph] || '';
      probe.style.backgroundColor = raw;
      const c = rgba(getComputedStyle(probe).backgroundColor);
      const rgb = c.rgb.map((v, i) => Math.round(v * c.a + bg[i] * (1 - c.a)));
      return { ph, raw, same: rgb.every((v, i) => v === bg[i]), ratio: ratio(rgb, bg) };
    });
    probe.remove();
    return { found: out.every(r => r.raw), out };
  }, plain);
  assert(res.found, 'the plain (no color-mix) timeline colours are all set on .plan-card outside @supports');
  res.out.forEach(r => assert(!r.raw.includes('color-mix') && !r.same && r.ratio >= FALLBACK_MIN_CONTRAST,
    `no color-mix: ${r.ph} (${r.raw}) stands off the navy card, ${r.ratio.toFixed(2)}:1 ≥ ${FALLBACK_MIN_CONTRAST}:1`));
  await o.page.close();
}

(async () => {
  const b = await dt.launch();
  try {
    await checkColumns(b);
    await checkSticky(b);
    await checkBreakpoint(b);
    await checkCardActive(b);
    await checkCardBranches(b);
    await checkNextLine(b);
    await checkFallbackColours(b);
    console.log('DESKTOP-HOME PASS');
  } catch (e) {
    console.error(e.message);
    console.log('DESKTOP-HOME FAIL');
    process.exitCode = 1;
  } finally {
    await b.close();
  }
})();
