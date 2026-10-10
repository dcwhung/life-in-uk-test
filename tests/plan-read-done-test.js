const { chromium } = require('playwright-core');
const path = require('path');
// Study plan PR7c (grill G41, user report 2026-10-10; G3 / G37: a fact counts as read only when all its questions are
// right today or 🏆): the reading runner tells which facts are done and how many are left.
// - every fact card whose fact is done carries a green "✓ Practice done" tag at the right end of its "Appears in" row,
//   where an undone fact's "▶ Practise" sits (a done fact has no Practise button)
// - the LAST fact only, while some facts of the task are not done: an orange note right above the nav row,
//   "{n} facts still need practice · {q} questions" (q = the main button's "Practise these q →")
// - review mode (a finished task): no note; tags on every card
// - Study mode's own card has no tag; 320px: a merged-node fact (98) + tag fit, no horizontal scroll
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const TODAY = '2026-10-01';
const at = (iso, time = '09:00:00') => new Date(`${iso}T${time}`);
const GOAL = { examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' };
const NARROW = 320;
const MERGED_FACT = 98; // src 10.0 / 7.15 / 13.0: 13.0 repeats 7.15, one merged node "E7·Q16 = E13·Q1" (G40)
const MIN_CONTRAST = 4.5;
const EN_TAG = '✓ Practice done';
const ZH_TAG = '✓ 已完成練習';

async function fresh(pg) {
  await pg.clock.setFixedTime(at(TODAY));
  await pg.goto(APP_URL + '?preview=plan');
  await pg.evaluate(() => localStorage.clear());
  await pg.goto(APP_URL + '?preview=plan');
}
// a plan from today; its first reading task; undone = indexes of its facts left unanswered (the rest right today)
async function seedRead(pg, undone, lastFact = null) {
  return pg.evaluate(({ goal, today, undone, lastFact }) => {
    const plan = buildPlan(goal, today);
    const day = plan.days[0], ri = day.tasks.findIndex(t => t.type === 'read' && t.facts.length >= 3);
    if (lastFact !== null) day.tasks[ri].facts = [...day.tasks[ri].facts.filter(id => id !== lastFact), lastFact];
    writeStudyPlan(plan);
    const facts = day.tasks[ri].facts;
    const ok = {};
    facts.filter((_, i) => !undone.includes(i)).flatMap(id => planFactQids(planFactById(id))).forEach(k => { ok[k] = 1; });
    writePlanLog({ v: 1, days: { [today]: { ok } } });
    const pair = day.tasks[day.tasks[ri].pair];
    return { ri, facts, q: pair.qids.filter(k => !ok[k]).length };
  }, { goal: GOAL, today: TODAY, undone, lastFact });
}
const showFact = (pg, ri, pos, review = false) => pg.evaluate(({ today, ri, pos, review }) => {
  planShowFacts({ date: today, taskIndex: ri, from: today }, pos, review);
}, { today: TODAY, ri, pos, review });
const view = pg => pg.evaluate(() => {
  const body = byId('planRunBody'), tag = body.querySelector('.fact-src .fact-done-tag');
  const left = body.querySelector('.plan-fact-left');
  const main = body.querySelector('.plan-run-nav .nav-btn:last-child');
  return {
    tag: tag ? tag.textContent.trim() : null, tagLast: !!tag && tag === tag.parentElement.lastElementChild,
    practise: !!body.querySelector('.fact-practise'),
    left: left ? left.textContent.replace(/\s+/g, ' ').trim() : null,
    leftBeforeNav: !!left && !!left.nextElementSibling && left.nextElementSibling.matches('.plan-run-nav'),
    main: main.textContent, action: main.dataset.action,
  };
});
const mainN = v => Number((v.main.match(/\d+/) || [])[0]);

// a fact done today: the tag, no Practise; an undone one: Practise, no tag; the note only on the last fact
async function checkTags(pg) {
  await fresh(pg);
  const s = await seedRead(pg, [1]);
  await showFact(pg, s.ri, 0);
  let v = await view(pg);
  assert(v.tag === EN_TAG && v.tagLast && !v.practise, 'a done fact: "✓ Practice done" at the end of the source row, no ▶ Practise');
  assert(v.left === null, 'fact 1 (not the last): no "still need practice" note');
  await showFact(pg, s.ri, 1);
  v = await view(pg);
  assert(v.tag === null && v.practise && v.left === null, 'an undone fact: ▶ Practise, no tag, no note');
  await showFact(pg, s.ri, s.facts.length - 1);
  v = await view(pg);
  assert(v.tag === EN_TAG, 'the last fact (done): tagged');
  assert(v.action === 'planOpenTask' && v.main === (s.q === 1 ? 'Practise this one →' : `Practise these ${s.q} →`), 'main button unchanged: ' + v.main);
  const qs = s.q === 1 ? '1 question' : `${s.q} questions`;
  assert(v.left === `1 fact still needs practice · ${qs}` && v.leftBeforeNav, 'last fact: the note (1 fact, q = the button N), right above the nav row: ' + v.left);
  assert(mainN(v) === s.q, `note q ${s.q} = the button's N ${mainN(v)}`);
  const low = await pg.evaluate(min => {
    const rgb = x => (x.match(/[\d.]+/g) || []).map(Number);
    const lum = c => c.slice(0, 3).map(u => { u /= 255; return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; })
      .reduce((a, u, i) => a + u * [0.2126, 0.7152, 0.0722][i], 0);
    return ['.plan-fact-left', '.fact-done-tag'].map(sel => {
      const e = document.querySelector('#planRunBody ' + sel), cs = getComputedStyle(e);
      const a = lum(rgb(cs.color)), b = lum(rgb(cs.backgroundColor));
      return { sel, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    }).filter(r => r.ratio < min);
  }, MIN_CONTRAST);
  assert(low.length === 0, `note + tag text ≥ ${MIN_CONTRAST}:1 on their own background ` + JSON.stringify(low));
  await pg.evaluate(() => setLang('zh-HK'));
  v = await view(pg);
  assert(v.tag === ZH_TAG && v.left === `尚有 1 條知識點未完成練習，共 ${s.q} 題` && v.main === `練習這 ${s.q} 題 →`, 'zh-HK: tag, note, button: ' + v.left);
  await pg.evaluate(() => setLang('en'));
}

// several undone (en plural); nothing done; every fact done (review and, forced, not review): no note
async function checkCounts(pg) {
  await fresh(pg);
  let s = await seedRead(pg, [0, 1]);
  await showFact(pg, s.ri, s.facts.length - 1);
  let v = await view(pg);
  assert(v.left === `2 facts still need practice · ${s.q} questions` && mainN(v) === s.q, '2 undone: plural note, q = N: ' + v.left);
  await fresh(pg);
  s = await seedRead(pg, [...Array(40).keys()]);
  await showFact(pg, s.ri, s.facts.length - 1);
  v = await view(pg);
  assert(v.tag === null && v.practise && v.left === `${s.facts.length} facts still need practice · ${s.q} questions` && mainN(v) === s.q,
    'nothing done: no tags, the note counts every fact: ' + v.left);
  await fresh(pg);
  s = await seedRead(pg, []);
  await showFact(pg, s.ri, s.facts.length - 1, true);
  v = await view(pg);
  assert(v.tag === EN_TAG && !v.practise && v.left === null && v.action === 'planBackToDay', 'review: tagged, no note, "Finish ✓" as today');
  await showFact(pg, s.ri, 0, true);
  assert((await view(pg)).tag === EN_TAG, 'review: the first card tagged too');
  await showFact(pg, s.ri, s.facts.length - 1, false);
  v = await view(pg);
  assert(v.left === null && v.action === 'planBackToDay', 'all done (not review): no note, the last button as when nothing is left');
}

// G37: a 🏆 fact counts as done (same as the task's progress)
async function checkMastered(pg) {
  await fresh(pg);
  const s = await seedRead(pg, [0]);
  await pg.evaluate(id => {
    planFactQids(planFactById(id)).forEach(k => { streaks[k] = MASTERY_STREAK; });
    setLS('practiceStreak', streaks);
  }, s.facts[0]);
  const mastered = await pg.evaluate(id => { const d = planDayLog(planLoadLogView(), '2026-10-01'); return planFactDone(id, d, d.mastered); }, s.facts[0]);
  assert(mastered, 'G37: the 🏆 fact counts as done');
  await showFact(pg, s.ri, 0);
  const v = await view(pg);
  assert((v.tag === EN_TAG) === mastered && v.practise === !mastered, 'a 🏆 fact (none right today): tagged, no ▶ Practise');
}

// Study mode's card is untouched: no tag even for a fact practised right
async function checkStudyUntouched(pg) {
  await fresh(pg);
  await seedRead(pg, []);
  await pg.evaluate(() => openStudy());
  assert(await pg.evaluate(() => document.querySelectorAll('.fact').length > 0 && !document.querySelector('.fact-done-tag')), 'Study mode: no "✓ Practice done" tag');
}

// 320px: fact 98 (a merged node) last and done, plus the note: everything inside the card, no horizontal scroll
async function checkNarrow(b) {
  for (const lang of ['en', 'zh-HK']) {
    const pg = await b.newPage({ viewport: { width: NARROW, height: 760 } });
    await fresh(pg);
    await pg.evaluate(lang => setLang(lang), lang);
    const s = await seedRead(pg, [0], MERGED_FACT);
    await showFact(pg, s.ri, s.facts.length - 1);
    const r = await pg.evaluate(() => {
      const card = document.querySelector('#planRunBody .fact').getBoundingClientRect();
      const tagEl = document.querySelector('#planRunBody .fact-done-tag'), tag = tagEl.getBoundingClientRect(), tagCs = getComputedStyle(tagEl);
      const nodes = [...document.querySelectorAll('#planRunBody .fact-src .sqm-node')].map(n => n.getBoundingClientRect());
      const overlap = nodes.some(n => n.left < tag.right && tag.left < n.right && n.top < tag.bottom && tag.top < n.bottom);
      return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, inside: tag.left >= card.left && tag.right <= card.right,
        overlap, merged: [...document.querySelectorAll('#planRunBody .fact-src .sqm-node')].some(n => n.textContent.includes('=')),
        oneLine: tag.height < 2 * (parseFloat(tagCs.fontSize) + parseFloat(tagCs.paddingTop)) };
    });
    assert(r.merged, `${lang} ${NARROW}px: fact ${MERGED_FACT} shows a merged node`);
    assert(r.sw <= r.cw && r.inside && !r.overlap && r.oneLine, `${lang} ${NARROW}px: tag inside the card, one line, clear of the nodes, no horizontal scroll ` + JSON.stringify(r));
    assert(await pg.evaluate(() => !!document.querySelector('#planRunBody .plan-fact-left')), `${lang} ${NARROW}px: the note shows`);
    await pg.close();
  }
}

async function main() {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && m.text().includes('[i18n]'))) errs.push(m.text()); });
  await checkTags(pg);
  await checkCounts(pg);
  await checkMastered(pg);
  await checkStudyUntouched(pg);
  await checkNarrow(b);
  assert(errs.length === 0, 'no page errors / i18n warnings: ' + errs.join(' | '));
  await b.close();
}
main().then(() => console.log('PLAN-READ-DONE PASS')).catch(e => { console.error(e.message); process.exit(1); });
