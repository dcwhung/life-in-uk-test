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
// - W-048: in the runner a 🏆 / ticked-mastered card fades all but the tag (≥ 4.5:1 counted with ancestor opacity);
//   Study's mastered card still fades whole
// - S-155: a wrong-answer facts task (Similar panel) gets neither the note nor a tag
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
const ALL = 'all'; // seedRead: every fact of the task left unanswered
const MASTERED_FADE = 0.55; // .fact.mastered (css/components/fact.css): the runner fades the parts, Study the card
const DRILL_START = '2026-09-28', DRILL_TODAY = '2026-10-06'; // a drill day: drill Ch 1 / 2 / 5 + wrong facts (as plan-run2-test)
const WRONG_KEYS = ['1.0', '2.3', '5.7'];
const NAV_WIDTHS = [320, 360, 390]; // S-154: the runner's nav labels stay on one line at phone widths
const MIN_TAP = 44; // .plan-run-body .nav-row .nav-btn min-height

async function fresh(pg, iso = TODAY) {
  await pg.clock.setFixedTime(at(iso));
  await pg.goto(APP_URL + '?preview=plan');
  await pg.evaluate(() => localStorage.clear());
  await pg.goto(APP_URL + '?preview=plan');
}
// a plan from today; its first reading task; undone = indexes of its facts left unanswered (or ALL; the rest right today)
async function seedRead(pg, undone, lastFact = null) {
  return pg.evaluate(({ goal, today, undone, lastFact }) => {
    const plan = buildPlan(goal, today);
    const day = plan.days[0], ri = day.tasks.findIndex(t => t.type === 'read' && t.facts.length >= 3);
    if (lastFact !== null) day.tasks[ri].facts = [...day.tasks[ri].facts.filter(id => id !== lastFact), lastFact];
    writeStudyPlan(plan);
    const facts = day.tasks[ri].facts;
    const ok = {};
    facts.filter((_, i) => undone !== 'all' && !undone.includes(i)).flatMap(id => planFactQids(planFactById(id))).forEach(k => { ok[k] = 1; });
    writePlanLog({ v: 1, days: { [today]: { ok } } });
    const pair = day.tasks[day.tasks[ri].pair];
    return { ri, facts, q: pair.qids.filter(k => !ok[k]).length };
  }, { goal: GOAL, today: TODAY, undone: undone === ALL ? 'all' : undone, lastFact });
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
// W-048: text vs what is really painted behind it: every ancestor's background and opacity composited (an opacity
// group over its backdrop = backdrop·(1−o) + o·content), from a white page down to the element; [{ sel, ratio }]
const contrastOf = (pg, sels) => pg.evaluate(sels => {
  const rgba = x => { const v = (x.match(/[\d.]+/g) || []).map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; };
  const over = (back, [r, g, b, a]) => [r, g, b].map((c, i) => c * a + back[i] * (1 - a));
  const mix = (back, top, o) => top.map((c, i) => c * o + back[i] * (1 - o));
  const lum = c => c.map(u => { u /= 255; return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; })
    .reduce((a, u, i) => a + u * [0.2126, 0.7152, 0.0722][i], 0);
  const paint = (chain, i, back, fg) => {
    if (i === chain.length) return { bg: back, fg: over(back, fg) };
    const cs = getComputedStyle(chain[i]), o = Number(cs.opacity);
    const inner = paint(chain, i + 1, over(back, rgba(cs.backgroundColor)), fg);
    return { bg: mix(back, inner.bg, o), fg: mix(back, inner.fg, o) };
  };
  return sels.map(sel => {
    const e = document.querySelector(sel), chain = [];
    for (let x = e; x; x = x.parentElement) chain.unshift(x);
    const { bg, fg } = paint(chain, 0, [255, 255, 255], rgba(getComputedStyle(e).color));
    const a = lum(fg), b = lum(bg);
    return { sel, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
  });
}, sels);
// the product of the element's and its ancestors' opacity
const opacityOf = (pg, sel) => pg.evaluate(sel => {
  let o = 1;
  for (let x = document.querySelector(sel); x; x = x.parentElement) o *= Number(getComputedStyle(x).opacity);
  return o;
}, sel);
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
  const low = (await contrastOf(pg, ['#planRunBody .plan-fact-left', '#planRunBody .fact-done-tag'])).filter(c => c.ratio < MIN_CONTRAST);
  assert(low.length === 0, `note + tag text ≥ ${MIN_CONTRAST}:1 (composited, ancestor opacity counted) ` + JSON.stringify(low));
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
  s = await seedRead(pg, ALL);
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
  assert(v.tag === EN_TAG && !v.practise, 'a 🏆 fact (none right today): tagged, no ▶ Practise');
  await checkFadedCard(pg, '🏆');
  // ticked by hand in Study (not 🏆): same faded card, same readable tag
  await pg.evaluate(id => { study.mastered[id] = true; }, s.facts[1]);
  await showFact(pg, s.ri, 1);
  assert(await pg.evaluate(() => !!document.querySelector('#planRunBody .fact.mastered .fact-done-tag')), 'a ticked-mastered done fact: tagged');
  await checkFadedCard(pg, 'ticked');
}
// user 2026-10-10: in the runner a card fades only once its practice is done — ticked ✓ by hand but not done stays
// clear (▶ Practise too); done but never ticked fades like a 🏆 one (the tag still unfaded)
async function checkFadeOnlyWhenDone(pg) {
  await fresh(pg);
  const s = await seedRead(pg, [0]);
  await pg.evaluate(id => { study.mastered[id] = true; }, s.facts[0]);
  await showFact(pg, s.ri, 0);
  const [en, practise] = await Promise.all(['.fact-en', '.fact-practise'].map(sel => opacityOf(pg, '#planRunBody .fact ' + sel)));
  assert(await pg.evaluate(() => !!document.querySelector('#planRunBody .fact.mastered .fact-practise')), 'ticked, not done: ▶ Practise shown');
  assert(en === 1 && practise === 1, `ticked, not done: the card and ▶ Practise not faded (${en}, ${practise})`);
  await showFact(pg, s.ri, 1);
  assert(await pg.evaluate(() => !document.querySelector('#planRunBody .fact.mastered') && !!document.querySelector('#planRunBody .fact-done-tag')),
    'done, never ticked: tagged, no mastered mark');
  await checkFadedCard(pg, 'done, not ticked');
}

// W-048: the runner fades everything on a mastered card but the tag, which keeps ≥ 4.5:1 composited
async function checkFadedCard(pg, kind) {
  const fade = sel => opacityOf(pg, '#planRunBody .fact ' + sel);
  const near = (x, y) => Math.abs(x - y) < 1e-6;
  const [en, nodes, top, tag] = await Promise.all(['.fact-en', '.fact-src-nodes', '.fact-top', '.fact-done-tag'].map(fade));
  assert(near(en, MASTERED_FADE) && near(nodes, MASTERED_FADE) && near(top, MASTERED_FADE) && near(tag, 1),
    `${kind}: the card's text, source nodes and buttons faded (${MASTERED_FADE}), the tag not (${tag})`);
  const low = (await contrastOf(pg, ['#planRunBody .fact-done-tag'])).filter(c => c.ratio < MIN_CONTRAST);
  assert(low.length === 0, `${kind}: the tag ≥ ${MIN_CONTRAST}:1 on the faded card ` + JSON.stringify(low));
}

// Study mode's card is untouched: no tag even for a fact practised right
async function checkStudyUntouched(pg) {
  await fresh(pg);
  await seedRead(pg, []);
  await pg.evaluate(() => openStudy());
  assert(await pg.evaluate(() => document.querySelectorAll('.fact').length > 0 && !document.querySelector('.fact-done-tag')), 'Study mode: no "✓ Practice done" tag');
  await pg.evaluate(() => { study.mastered[STUDY[0].id] = true; renderStudy(); });
  const o = await pg.evaluate(() => Number(getComputedStyle(document.querySelector('#screenStudy .fact.mastered')).opacity));
  assert(Math.abs(o - MASTERED_FADE) < 1e-6, `Study mode: a mastered card still fades whole (${o})`);
}

// S-155 (G41 ⑤): the facts behind wrong answers keep the Similar panel: no note, no tag, even with facts left
async function checkWrongFacts(pg) {
  await fresh(pg, DRILL_TODAY);
  const w = await pg.evaluate(({ goal, start, today, wrong }) => {
    wrong.forEach(k => addWrong(questionByKey(k)));
    writeStudyPlan(buildPlan(goal, start));
    openPlanDay(null);
    const tasks = planDayAt(planLoad(), today).tasks, wi = tasks.findIndex(t => t.type === 'wrongFacts');
    const ok = {};
    tasks[wi].facts.slice(1).flatMap(id => planFactQids(planFactById(id))).forEach(k => { ok[k] = 1; });
    writePlanLog({ v: 1, days: { [today]: { ok } } });
    return { wi, n: tasks[wi].facts.length };
  }, { goal: GOAL, start: DRILL_START, today: DRILL_TODAY, wrong: WRONG_KEYS });
  await pg.evaluate(({ today, wi, pos }) => planShowFacts({ date: today, taskIndex: wi, from: today }, pos, false), { today: DRILL_TODAY, wi: w.wi, pos: w.n - 1 });
  const r = await pg.evaluate(() => ({ sqm: !!document.querySelector('#planRunBody .sqm.show'), left: !!document.querySelector('#planRunBody .plan-fact-left'),
    tag: !!document.querySelector('#planRunBody .fact-done-tag'), main: document.querySelector('#planRunBody .plan-run-nav .nav-btn:last-child').dataset.action }));
  assert(r.sqm && !r.left && !r.tag && r.main === 'planPractiseTask', `wrong facts, last of ${w.n} (first not done): Similar panel, no note, no tag`);
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

// S-154 (user 2026-10-10): every fact-view nav label ("← Prev" / "Practise these 39 →") on one line, nothing clipped,
// the 44px tap target kept — the full-task count (nothing done) is the longest label a reading task shows
async function checkNavOneLine(b) {
  for (const lang of ['en', 'zh-HK']) for (const width of NAV_WIDTHS) {
    const pg = await b.newPage({ viewport: { width, height: 760 } });
    await fresh(pg);
    await pg.evaluate(lang => setLang(lang), lang);
    const s = await seedRead(pg, ALL);
    await showFact(pg, s.ri, s.facts.length - 1);
    const r = await pg.evaluate(() => [...document.querySelectorAll('#planRunBody .plan-run-nav .nav-btn')].map(x => {
      const range = document.createRange(); range.selectNodeContents(x);
      const lines = new Set([...range.getClientRects()].filter(rc => rc.width > 0).map(rc => Math.round(rc.top))).size;
      return { t: x.textContent.trim(), lines, fits: x.scrollWidth <= x.clientWidth, h: x.getBoundingClientRect().height };
    }));
    const sw = await pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    assert(sw && r.length === 2 && r.every(x => x.lines === 1 && x.fits && x.h >= MIN_TAP), `${lang} ${width}px: nav labels on one line, unclipped, ≥ ${MIN_TAP}px: ` + JSON.stringify(r));
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
  await checkFadeOnlyWhenDone(pg);
  await checkStudyUntouched(pg);
  await checkWrongFacts(pg);
  await checkNarrow(b);
  await checkNavOneLine(b);
  assert(errs.length === 0, 'no page errors / i18n warnings: ' + errs.join(' | '));
  await b.close();
}
main().then(() => console.log('PLAN-READ-DONE PASS')).catch(e => { console.error(e.message); process.exit(1); });
