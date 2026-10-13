// QA v2.1.1 — CUI-0039: stale question keys ("exam.idx" with no question) in lifeuk.wrongList / practiceFlags /
// practiceStreak are pruned once on load (store.js pruneStaleQuestionKeys via questions.js isValidQuestionKey, from
// main.js startApp, typeof-guarded); a saved plan's review task drops stale qids (planProgress.js planTaskQids).
//   F  real-click flows 390×844 (touch) / 1280×800 (mouse) × en / zh-HK: stale + real keys (prefixed, legacy unprefixed,
//      legacy + prefixed merged) → Home tiles, wrong round, answer right clears, result "N left", Flagged + Practise
//      flagged, pruned once / no write on a clean reload, G40 copies kept, non-object values, setItem throwing
//   P  study plan: a saved review task with stale qids (some / all), a practice task with a stale qid; day status,
//      open, answer, complete, "Review this task"; plus v2.1.0 (CUI-0038) change-goal smoke
//   U  SW upgrade v2.1.0 (main 5ab69c4) → v2.1.1 with stale keys stored: cache, prune, offline
//   M  mixed caches: v2.0.5 questions.js + v2.1.1 rest (no blank Home); v2.1.0 store.js + v2.1.1 rest
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium node 2026-10-13_qa-v211.js [F P U M]
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../../..');
const { startPagesServer, appFiles } = require(path.join(ROOT, 'tests/pages-server.js'));
const SHOTS = path.join(__dirname, '../screenshots/v211');
fs.mkdirSync(SHOTS, { recursive: true });
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const ONLY = process.argv.slice(2);
const want = s => !ONLY.length || ONLY.includes(s);
const OLD_REV = '5ab69c4'; // main v2.1.0
const V205_REV = 'de110fa'; // v2.0.5 (no isValidQuestionKey)
const sleep = ms => new Promise(r => setTimeout(r, ms));
const res = [], findings = [], obs = [];
const log = (ok, id, m, extra) => {
  res.push({ ok, id, m });
  if (!ok) findings.push(id + ' ' + m + (extra !== undefined ? ' ' + JSON.stringify(extra).slice(0, 1500) : ''));
  console.log((ok ? 'ok   ' : 'FAIL ') + id + ' ' + m + (extra !== undefined && !ok ? ' ' + JSON.stringify(extra).slice(0, 900) : ''));
};
const note = (id, m) => { obs.push(id + ' ' + m); console.log('note ' + id + ' ' + m); };
const VPS = [{ width: 390, height: 844, touch: true }, { width: 1280, height: 800, touch: false }];
const LANGS = ['en', 'zh-HK'];
const WRONG = 'lifeuk.wrongList', FLAGS = 'lifeuk.practiceFlags', STREAK = 'lifeuk.practiceStreak';
const WATCHED = [WRONG, FLAGS, STREAK, 'wrongList', 'practiceFlags', 'practiceStreak'];
// raw JSON (so "__proto__" is an own key, as JSON.parse makes it)
const STALE = ['1.999', '99.99', 'abc', '1.2.3', '01.2', '', '__proto__', '0.0', '1.-1', ' 1.2', '1.2 ', '1.1e0', 'NaN.NaN', '-0.0'];
const rawMarks = (keys, v = 'true') => '{' + keys.map(k => JSON.stringify(k) + ':' + v).join(',') + '}';

let browser, head;

function spyWrites(keys) {
  window.__lsWrites = [];
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (keys.includes(k)) window.__lsWrites.push(k);
    if (window.__throwOn && window.__throwOn.includes(k)) throw new DOMException('quota', 'QuotaExceededError');
    return set.call(this, k, v);
  };
}
async function newPage(srv, { width, height, touch, lang = 'en', sw = 'block', clock = null, throwOn = null }) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1,
    timezoneId: 'Europe/London', serviceWorkers: sw });
  if (clock) await ctx.clock.setFixedTime(clock);
  if (throwOn) await ctx.addInitScript(k => { window.__throwOn = k; }, throwOn);
  await ctx.addInitScript(spyWrites, WATCHED);
  const pg = await ctx.newPage();
  pg.errs = [];
  pg.on('pageerror', e => pg.errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'error' || /\[i18n\] missing key/.test(m.text())) pg.errs.push(m.text()); });
  await pg.goto(srv.base + 'index.html');
  pg.ctx = ctx; pg.touch = touch; pg.lang = lang; pg.tag = `${width}/${lang}`;
  return pg;
}
// values: { storageKey: rawString }
async function seed(pg, values, { keepPrefs = false } = {}) {
  await pg.evaluate(([v, lang, keep]) => {
    localStorage.clear();
    if (!keep) {
      localStorage.setItem('lifeuk.uiLang', JSON.stringify(lang));
      localStorage.setItem('lifeuk.fontSize', JSON.stringify('small'));
      localStorage.setItem('lifeuk.homePrefs', JSON.stringify({ mode: 'practice', view: 'difficulty' }));
      localStorage.setItem('lifeuk.installDismissed', 'true');
    }
    Object.entries(v).forEach(([k, val]) => localStorage.setItem(k, val));
  }, [values, pg.lang, keepPrefs]);
  await pg.reload();
  await pg.waitForSelector('#screenHome.active');
  await pg.evaluate(() => document.fonts.ready);
}
const hit = async (pg, sel) => {
  await pg.evaluate(() => { if (typeof clickGuard !== 'undefined') clickGuard = null; });
  const l = pg.locator(`${sel} >> visible=true`).first();
  await l.scrollIntoViewIfNeeded();
  if (pg.touch) await l.tap(); else await l.click();
  await sleep(150);
};
const active = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
const raw = (pg, k) => pg.evaluate(k => localStorage.getItem(k), k);
const writes = pg => pg.evaluate(() => window.__lsWrites.slice());
const tiles = pg => pg.evaluate(() => ({
  wrong: document.querySelector('#tileWrong .t-num').textContent, flag: document.querySelector('#tileFlagged .t-num').textContent,
  wrongDisabled: byId('tileWrong').disabled, flagDisabled: byId('tileFlagged').disabled, shown: byId('myReview').classList.contains('show'),
  hScroll: document.scrollingElement.scrollWidth > innerWidth + 0.5,
}));
const shot = (pg, name) => pg.screenshot({ path: path.join(SHOTS, name) });

// answer the current question with real taps
async function answer(pg, right) {
  const picks = await pg.evaluate(right => {
    const q = state.questions[state.current];
    return right ? q.a : q.o.map((_, i) => i).filter(i => !q.a.includes(i)).slice(0, q.a.length);
  }, right);
  for (const i of picks) await hit(pg, `#opt${i}`);
}

// ════════════════ F: Home / review flows ════════════════
async function sectionF() {
  for (const vp of VPS) for (const lang of LANGS) {
    const pg = await newPage(head, { ...vp, lang });
    const tag = pg.tag;
    try {
      const copies = await pg.evaluate(() => Object.values(QUESTION_COPIES.copies).find(c => c.length > 1));
      const realWrong = ['1.0', '1.2', ...copies];          // 3 distinct questions
      const realFlags = ['3.0', copies[0]];                   // 2
      const allValid = await pg.evaluate(k => k.map(isValidQuestionKey), [...realWrong, ...realFlags, ...STALE]);
      log(allValid.slice(0, 6).every(Boolean) && allValid.slice(6).every(v => v === false), 'F', `${tag} isValidQuestionKey: 6 real yes, ${STALE.length} stale/malformed no`, allValid);
      // F1 seed + load
      await seed(pg, {
        [WRONG]: rawMarks([...STALE, ...realWrong]),
        [FLAGS]: rawMarks([...STALE, ...realFlags]),
        [STREAK]: '{"1.999":3,"99.99":2,"abc":1,"__proto__":4,"1.0":2,' + JSON.stringify(copies[1]) + ':1}',
      });
      const w1 = await writes(pg);
      const stored = { w: JSON.parse(await raw(pg, WRONG)), f: JSON.parse(await raw(pg, FLAGS)), s: JSON.parse(await raw(pg, STREAK)) };
      log(JSON.stringify(Object.keys(stored.w)) === JSON.stringify(realWrong) && JSON.stringify(Object.keys(stored.f)) === JSON.stringify(realFlags)
        && JSON.stringify(Object.keys(stored.s)) === JSON.stringify(['1.0', copies[1]]), 'F', `${tag} F1 storage pruned to real keys only (G40 copies kept)`, stored);
      log(w1.filter(k => k === WRONG).length === 1 && w1.filter(k => k === FLAGS).length === 1 && w1.filter(k => k === STREAK).length === 1,
        'F', `${tag} F1 each list written exactly once on the pruning load`, w1);
      const t1 = await tiles(pg);
      log(t1.wrong === '3' && t1.flag === '2' && !t1.hScroll && !pg.errs.length, 'F', `${tag} F1 Home tiles count only real questions (3 / 2)`, { t1, errs: pg.errs });
      await pg.locator('#myReview').scrollIntoViewIfNeeded();
      await shot(pg, `F1-home-tiles-${vp.width}-${lang}.png`);
      // F2 tap wrong tile
      await hit(pg, '#tileWrong');
      const q = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, exam: state.examNum, keys: state.questions.map(qKey), total: state.reviewTotal }));
      log(q.s === 'screenQuiz' && q.exam === 'wrong' && q.keys.length === 3 && q.keys.every(k => ['1.0', '1.2', ...copies].includes(k)) && q.total === 3 && !pg.errs.length,
        'F', `${tag} F2 wrong tile → round of the 3 real questions, no page error`, { q, errs: pg.errs });
      await shot(pg, `F2-wrong-round-${vp.width}-${lang}.png`);
      // F3 answer: first right, others wrong; follow to the result
      const seen = new Set();
      let first = null, steps = 0;
      while ((await active(pg)) === 'screenQuiz' && steps++ < 40) {
        const c = await pg.evaluate(() => ({ key: qKey(state.questions[state.current]), rev: !!state.revealed[state.current], idx: state.current, n: state.questions.length }));
        if (!c.rev) {
          if (first === null) first = c.key;
          await answer(pg, c.key === first || seen.has(c.key));
          seen.add(c.key);
        }
        if (c.key === first && steps === 1) {
          const cleared = await pg.evaluate(k => ({ inMem: questionCopies(k).some(x => wrongList[x]), stored: JSON.parse(localStorage.getItem('lifeuk.wrongList')) }), first);
          log(!cleared.inMem && !questionCopiesSafe(cleared.stored, first, copies), 'F', `${tag} F3 answered right → ${first} (and copies) cleared from wrongList`, cleared);
        }
        await hit(pg, '#nextBtn, #quickNext');
      }
      const r = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, note: byId('resultNote').textContent, cleared: state.cleared,
        left: questionGroups(keysOf(wrongList)).length, stored: Object.keys(JSON.parse(localStorage.getItem('lifeuk.wrongList'))) }));
      const exp = await pg.evaluate(([n, left]) => t('result.clearedNote', { n, left }), [r.cleared, 3 - r.cleared]);
      log(r.s === 'screenResult' && r.note === exp && r.left === 3 - r.cleared && r.cleared >= 1 && r.stored.every(k => !['99.99', '1.999', 'abc'].includes(k)) && !pg.errs.length,
        'F', `${tag} F3 result "${r.note}" (left = real questions only)`, { r, exp, errs: pg.errs });
      await shot(pg, `F3-result-left-${vp.width}-${lang}.png`);
      // F4 Flagged screen + Practise flagged
      await hit(pg, '#screenResult [data-action="goHome"]');
      await hit(pg, '#tileFlagged');
      const fl = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, n: document.querySelectorAll('#flaggedList .flag-item').length, start: byId('flaggedStart').textContent.replace(/\s+/g, ' ').trim() }));
      log(fl.s === 'screenFlagged' && fl.n === 2 && !pg.errs.length, 'F', `${tag} F4 Flagged screen lists 2 real questions ("${fl.start}")`, { fl, errs: pg.errs });
      await shot(pg, `F4-flagged-${vp.width}-${lang}.png`);
      await hit(pg, '#flaggedStart');
      const fq = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, exam: state.examNum, keys: state.questions.map(qKey) }));
      log(fq.s === 'screenQuiz' && fq.exam === 'flagged' && fq.keys.length === 2 && !pg.errs.length, 'F', `${tag} F4 Practise flagged → round of 2`, { fq, errs: pg.errs });
      // F5 clean reload writes nothing
      await pg.reload(); await pg.waitForSelector('#screenHome.active');
      const w5 = await writes(pg);
      log(w5.filter(k => WATCHED.includes(k)).length === 0 && !pg.errs.length, 'F', `${tag} F5 clean reload: no write to the three lists`, w5);
      // F6 legacy unprefixed (no marker) + stale
      await seed(pg, { wrongList: rawMarks(['99.99', '1.999', '1.2']), practiceFlags: rawMarks(['abc', '3.0']), practiceStreak: '{"99.99":3,"1.0":1}' });
      const l6 = { w: await raw(pg, WRONG), f: await raw(pg, FLAGS), s: await raw(pg, STREAK), old: await raw(pg, 'wrongList'), t: await tiles(pg) };
      log(l6.w === '{"1.2":true}' && l6.f === '{"3.0":true}' && l6.s === '{"1.0":1}' && l6.old === null && l6.t.wrong === '1' && l6.t.flag === '1' && !pg.errs.length,
        'F', `${tag} F6 legacy unprefixed lists migrated then pruned; tiles 1 / 1`, l6);
      // F6b legacy + prefixed both present (merge), stale on both sides
      await seed(pg, { wrongList: rawMarks(['99.99', '1.2']), [WRONG]: rawMarks(['1.999', '1.0']) });
      const l6b = { w: JSON.parse(await raw(pg, WRONG)), t: await tiles(pg) };
      log(JSON.stringify(Object.keys(l6b.w).sort()) === JSON.stringify(['1.0', '1.2']) && l6b.t.wrong === '2' && !pg.errs.length,
        'F', `${tag} F6b legacy + prefixed merged then pruned → {1.0, 1.2}, tile 2`, l6b);
      // F7 non-object values
      for (const bad of ['"oops"', '["1.2"]', 'true', '5', 'null', '{not json', '{}']) {
        pg.errs.length = 0;
        await seed(pg, { [WRONG]: bad, [FLAGS]: bad, [STREAK]: bad });
        const w7 = (await writes(pg)).filter(k => WATCHED.includes(k));
        const t7 = await tiles(pg);
        const kept = (await raw(pg, WRONG)) === bad;
        log(!pg.errs.length && w7.length === 0 && kept && t7.wrong === '0' && t7.flag === '0', 'F', `${tag} F7 stored ${bad}: no error, not rewritten, tiles 0 / 0`, { w7, t7, kept, errs: pg.errs });
        // a wrong answer afterwards still records
      }
      await seed(pg, { [WRONG]: '"oops"' });
      await pg.evaluate(() => addWrong(questionByKey('1.4')));
      log((await raw(pg, WRONG)) === '{"1.4":true}', 'F', `${tag} F7b after a non-object value, the next wrong answer stores a clean list`, await raw(pg, WRONG));
      // F8 only-stale lists → tiles empty / disabled, tap inert
      pg.errs.length = 0;
      await seed(pg, { [WRONG]: rawMarks(['99.99', '1.999']), [FLAGS]: rawMarks(['abc']) });
      const t8 = await tiles(pg);
      log(t8.wrong === '0' && t8.flag === '0' && (await raw(pg, WRONG)) === '{}' && (await raw(pg, FLAGS)) === '{}' && !pg.errs.length,
        'F', `${tag} F8 only-stale lists → pruned to {}, tiles 0`, t8);
      if (vp.width === 390 && lang === 'en') { await pg.locator('#myReview').scrollIntoViewIfNeeded().catch(() => {}); await shot(pg, 'F8-only-stale-390-en.png'); }
      // F9 setItem throws (quota) during the prune: app still starts, memory pruned
      const pq = await newPage(head, { ...vp, lang, throwOn: [WRONG] });
      await pq.evaluate(([w, l]) => {
        localStorage.clear();
        window.__throwOn = null;
        localStorage.setItem('lifeuk.uiLang', JSON.stringify(l));
        localStorage.setItem('lifeuk.homePrefs', JSON.stringify({ mode: 'practice', view: 'difficulty' }));
        localStorage.setItem('lifeuk.installDismissed', 'true');
        localStorage.setItem('lifeuk.wrongList', w);
      }, [rawMarks(['99.99', '1.2']), lang]);
      await pq.reload(); await pq.waitForSelector('#screenHome.active');
      const t9 = await tiles(pq);
      const m9 = await pq.evaluate(() => Object.keys(wrongList));
      log(t9.wrong === '1' && JSON.stringify(m9) === '["1.2"]' && !pq.errs.length, 'F', `${tag} F9 setItem throws on the prune write: Home draws, memory pruned, tile 1`, { t9, m9, errs: pq.errs });
      await hit(pq, '#tileWrong');
      log((await active(pq)) === 'screenQuiz' && !pq.errs.length, 'F', `${tag} F9 tap → round, no error (storage still stale: ${await raw(pq, WRONG)})`, pq.errs);
      await pq.ctx.close();
      log(!pg.errs.length, 'F', `${tag} no page errors`, pg.errs);
    } catch (e) { log(false, 'F', `${tag} script error ${e.stack}`); }
    await pg.ctx.close();
  }
}
function questionCopiesSafe(stored, key, copies) {
  const group = copies.includes(key) ? copies : [key];
  return group.some(k => stored[k]);
}

// ════════════════ P: study plan ════════════════
const PLAN_TODAY = '2026-10-01';
const GOAL = { examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' };
async function planSeed(pg, { wrong = ['1.0'], qids = null, practiceStale = false }) {
  await pg.evaluate(l => {
    localStorage.clear();
    localStorage.setItem('lifeuk.uiLang', JSON.stringify(l));
    localStorage.setItem('lifeuk.homePrefs', JSON.stringify({ mode: 'practice', view: 'difficulty' }));
    localStorage.setItem('lifeuk.installDismissed', 'true');
  }, pg.lang);
  await pg.reload(); await pg.waitForSelector('#screenHome.active');
  await pg.evaluate(async ({ goal, wrong, today }) => {
    wrong.forEach(k => addWrong(questionByKey(k)));
    writeStudyPlan(buildPlan(goal, today));
    writePlanLog({ v: 1, days: {} });
  }, { goal: GOAL, wrong, today: PLAN_TODAY });
  await pg.evaluate(() => openPlanDay()); // materialises today's review task from the wrong list
  const idx = await pg.evaluate(({ qids, practiceStale, today }) => {
    const p = readStudyPlan();
    const day = p.days.find(d => d.date === today);
    const ri = day.tasks.findIndex(t => t.type === 'review');
    if (qids) day.tasks[ri].qids = qids;
    const pi = day.tasks.findIndex(t => t.type === 'practice' && Array.isArray(t.qids));
    if (practiceStale && pi >= 0) day.tasks[pi].qids = [...day.tasks[pi].qids, '99.99', '1.999'];
    writeStudyPlan(p);
    return { ri, pi };
  }, { qids, practiceStale, today: PLAN_TODAY });
  await pg.reload(); await pg.waitForSelector('#screenHome.active');
  await pg.evaluate(() => openPlanDay());
  await sleep(200);
  return idx;
}
const taskSel = i => `#planTaskList button[data-arg="${PLAN_TODAY}"][data-task="${i}"]`;
const taskInfo = (pg, i) => pg.evaluate(([i, today]) => {
  const day = planLoad().days.find(d => d.date === today);
  const p = planTaskProgress(day.tasks[i], planDayLog(planLoadLog(), today));
  const btn = document.querySelector(`#planTaskList button[data-arg="${today}"][data-task="${i}"]`);
  const lis = [...document.querySelectorAll('#planTaskList li')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
  return { p, text: btn ? btn.textContent.replace(/\s+/g, ' ').trim() : null, lis, qids: day.tasks[i].qids };
}, [i, PLAN_TODAY]);
async function sectionP() {
  for (const vp of VPS) for (const lang of LANGS) {
    const pg = await newPage(head, { ...vp, lang, clock: new Date(`${PLAN_TODAY}T09:00:00+01:00`) });
    const tag = pg.tag;
    try {
      // P1 review task with stale qids + 1 real
      const { ri } = await planSeed(pg, { wrong: ['1.0'], qids: ['99.99', '1.0', 'abc', '1.999'] });
      const a = await taskInfo(pg, ri);
      const expTodo = await pg.evaluate(() => t('plan.task.qTodo', { n: 1, mode: t(PLAN_DAY_MODE_KEYS.review) }).replace(/<[^>]+>/g, ''));
      log(a.p.total === 1 && !a.p.complete && a.text && a.text.includes(expTodo.replace(/\s+/g, ' ').trim()) && !pg.errs.length,
        'P', `${tag} P1 day screen: review task with 3 stale + 1 real qid counts 1 ("${expTodo}")`, { a, expTodo, errs: pg.errs });
      await shot(pg, `P1-plan-day-stale-review-${vp.width}-${lang}.png`);
      await hit(pg, taskSel(ri));
      const q = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, keys: state.questions.map(qKey), plan: isPlanSession() }));
      log(q.s === 'screenQuiz' && JSON.stringify(q.keys) === '["1.0"]' && q.plan && !pg.errs.length, 'P', `${tag} P1 task opens a round of only 1.0`, { q, errs: pg.errs });
      await answer(pg, true);
      await hit(pg, '#nextBtn, #quickNext');
      const d = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, sub: (byId('planRunSub') || {}).textContent }));
      const b = await taskInfo(pg, ri);
      const expSum = await pg.evaluate(() => t('plan.run.sumFirst', { n: 1 }));
      log(d.s === 'screenPlanRun' && b.p.complete && d.sub === expSum && !pg.errs.length, 'P', `${tag} P1 answered right → task complete, summary "${d.sub}"`, { d, b, expSum, errs: pg.errs });
      await shot(pg, `P1-plan-done-${vp.width}-${lang}.png`);
      const rv = await pg.$('#planRunBody [data-action="planStartReview"], #planRunBody [data-action="planReviewTask"]');
      if (rv) {
        await hit(pg, '#planRunBody [data-action="planStartReview"], #planRunBody [data-action="planReviewTask"]');
        const rq = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, keys: state.questions.map(qKey) }));
        log(rq.s === 'screenQuiz' && JSON.stringify(rq.keys) === '["1.0"]' && !pg.errs.length, 'P', `${tag} P1 "Review this task" shows only 1.0`, { rq, errs: pg.errs });
      } else note('P', `${tag} P1 no review button on the done card`);
      await pg.evaluate(() => openPlanDay()); await sleep(150);
      const c = await taskInfo(pg, ri);
      const expDone = await pg.evaluate(() => t('plan.task.qDone', { n: 1 }).replace(/<[^>]+>/g, ''));
      log(c.text && c.text.includes(expDone.trim()), 'P', `${tag} P1 day screen after: "${expDone}"`, c);
      // P2 every qid stale
      pg.errs.length = 0;
      const { ri: r2 } = await planSeed(pg, { wrong: ['1.0'], qids: ['99.99', '1.999'] });
      const e = await taskInfo(pg, r2);
      const expNo = await pg.evaluate(() => t('plan.task.noWrong').replace(/<[^>]+>/g, ''));
      log(e.p.complete && e.lis.some(x => x.includes(expNo.trim())) && !pg.errs.length, 'P', `${tag} P2 review task of only stale qids reads "${expNo}" (complete)`, { e, errs: pg.errs });
      if (vp.width === 390) await shot(pg, `P2-plan-all-stale-${vp.width}-${lang}.png`);
      const isBtn = await pg.$(taskSel(r2));
      if (isBtn) {
        await hit(pg, taskSel(r2));
        const s2 = await active(pg);
        log(!pg.errs.length, 'P', `${tag} P2 tapping it → ${s2}, no page error`, pg.errs);
      } else note('P', `${tag} P2 the all-stale review task is not a button (as an empty wrong list)`);
      // P3 practice task with stale qids (question bank change)
      pg.errs.length = 0;
      const { pi } = await planSeed(pg, { wrong: [], practiceStale: true });
      if (pi >= 0) {
        const f = await taskInfo(pg, pi);
        const realN = f.qids.filter(k => !['99.99', '1.999'].includes(k)).length;
        log(f.p.total === realN && !pg.errs.length, 'P', `${tag} P3 practice task with 2 stale qids counts ${f.p.total} of ${f.qids.length} stored (real ${realN})`, { p: f.p, errs: pg.errs });
        await hit(pg, taskSel(pi));
        const pq = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, keys: state.questions.map(qKey) }));
        log(pq.s === 'screenQuiz' && pq.keys.every(isValid => !['99.99', '1.999'].includes(isValid)) && !pg.errs.length, 'P', `${tag} P3 practice task opens with real questions only`, { pq, errs: pg.errs });
        const lcd = await pg.evaluate(() => { const p = planLoad(); const all = new Set(p.days.flatMap(d => d.tasks).filter(t => t.type === 'practice').flatMap(t => t.qids || []).filter(isValidQuestionKey));
          const facts = new Set(p.days.flatMap(d => d.tasks).filter(t => t.type === 'read').flatMap(t => t.facts || []));
          const clean = p.days.map(d => ({ ...d, tasks: d.tasks.map(t => (Array.isArray(t.qids) ? { ...t, qids: t.qids.filter(isValidQuestionKey) } : t)) }));
          return { withStale: planLearnContentDone(p.days, { facts, qids: all }), control: planLearnContentDone(clean, { facts, qids: all }) }; }).catch(e => ({ err: e.message }));
        note('P', `${tag} P3 planLearnContentDone with every real practice qid done but stale ones present → ${JSON.stringify(lcd)}`);
      } else note('P', `${tag} P3 no materialised practice task today`);
      log(!pg.errs.length, 'P', `${tag} no page errors`, pg.errs);
    } catch (e) { log(false, 'P', `${tag} script error ${e.stack}`); }
    await pg.ctx.close();
  }
}

// ════════════════ U: SW upgrade v2.1.0 → v2.1.1 ════════════════
function copyApp(fromRoot, dest) { for (const f of appFiles(fromRoot)) execSync(`cp -r "${path.join(fromRoot, f)}" "${dest}/"`); }
async function sectionU(oldDir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa211-'));
  const site = path.join(tmp, 'site');
  fs.mkdirSync(site);
  const s = await startPagesServer(site);
  try {
    for (const vp of VPS) {
      const tag = `${vp.width}`;
      execSync(`rm -rf "${site}"/*`);
      copyApp(oldDir, site);
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.touch, hasTouch: vp.touch, timezoneId: 'Europe/London' });
      const pg = await ctx.newPage();
      const errs = [];
      pg.on('pageerror', e => errs.push(e.message));
      await pg.goto(s.base + 'index.html');
      await pg.evaluate(() => navigator.serviceWorker.ready);
      await pg.evaluate(w => {
        localStorage.setItem('lifeuk.uiLang', JSON.stringify('en'));
        localStorage.setItem('lifeuk.homePrefs', JSON.stringify({ mode: 'practice', view: 'difficulty' }));
        localStorage.setItem('lifeuk.installDismissed', 'true');
        localStorage.setItem('lifeuk.wrongList', w);
        localStorage.setItem('lifeuk.practiceFlags', '{"abc":true,"3.0":true}');
        localStorage.setItem('lifeuk.practiceStreak', '{"99.99":3,"1.0":1}');
      }, rawMarks(['99.99', '1.999', '1.0', '1.1']));
      await pg.reload(); await sleep(700);
      const v0 = await pg.evaluate(async () => ({ v: APP_VERSION, ctrl: !!navigator.serviceWorker.controller, caches: await caches.keys(),
        num: document.querySelector('#tileWrong .t-num').textContent, stored: localStorage.getItem('lifeuk.wrongList') }));
      log(v0.v === '2.1.0' && v0.ctrl, 'U', `${tag}: v2.1.0 (main ${OLD_REV}) installed, SW controlling; stale keys counted there: tile ${v0.num} (caches ${v0.caches})`, v0);
      await pg.locator('#myReview').screenshot({ path: path.join(SHOTS, `U-${tag}-before-v210.png`) });
      execSync(`rm -rf "${site}"/*`);
      copyApp(ROOT, site);
      let v = null;
      for (let k = 0; k < 12; k++) {
        await pg.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r && r.update())).catch(() => {});
        await sleep(1200);
        await pg.reload().catch(() => {}); await sleep(800);
        v = await pg.evaluate(() => typeof APP_VERSION !== 'undefined' ? APP_VERSION : null).catch(() => null);
        if (v === '2.1.1') break;
      }
      const keys = await pg.evaluate(() => caches.keys());
      log(v === '2.1.1' && JSON.stringify(keys) === '["lifeuk-v2.1.1"]', 'U', `${tag}: upgrade → APP_VERSION ${v}, caches ${keys}`, { v, keys });
      const cached = await pg.evaluate(async () => {
        const c = await caches.open('lifeuk-v2.1.1');
        const sw = await (await fetch('sw.js')).text();
        const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
        const missing = [];
        for (const f of shell) if (!(await c.match(f))) missing.push(f);
        const store = await (await c.match('js/core/store.js')).text();
        const qs = await (await c.match('js/domain/questions.js')).text();
        const pp = await (await c.match('js/domain/planProgress.js')).text();
        return { n: shell.length, missing, prune: store.includes('function pruneStaleQuestionKeys'), valid: qs.includes('function isValidQuestionKey'), plan: pp.includes('planKnownQid') };
      });
      log(!cached.missing.length && cached.prune && cached.valid && cached.plan, 'U', `${tag}: lifeuk-v2.1.1 holds all ${cached.n} SHELL files incl. new store.js / questions.js / planProgress.js`, cached);
      const after = await pg.evaluate(() => ({ w: localStorage.getItem('lifeuk.wrongList'), f: localStorage.getItem('lifeuk.practiceFlags'), s: localStorage.getItem('lifeuk.practiceStreak'),
        num: document.querySelector('#tileWrong .t-num').textContent, fnum: document.querySelector('#tileFlagged .t-num').textContent }));
      log(after.w === '{"1.0":true,"1.1":true}' && after.f === '{"3.0":true}' && after.s === '{"1.0":1}' && after.num === '2' && after.fnum === '1', 'U', `${tag}: after upgrade storage pruned, tiles 2 / 1`, after);
      await ctx.setOffline(true);
      await pg.reload(); await sleep(800);
      const off = await pg.evaluate(() => ({ v: APP_VERSION, num: document.querySelector('#tileWrong .t-num').textContent }));
      log(off.v === '2.1.1' && off.num === '2', 'U', `${tag}: offline reload — v2.1.1 from cache, tile 2`, off);
      await pg.locator('#myReview').screenshot({ path: path.join(SHOTS, `U-${tag}-offline-v211.png`) });
      await pg.locator('#tileWrong').scrollIntoViewIfNeeded();
      if (vp.touch) await pg.locator('#tileWrong').tap(); else await pg.locator('#tileWrong').click();
      await sleep(500);
      const q = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, exam: state.examNum, len: state.questions.length }));
      log(q.s === 'screenQuiz' && q.exam === 'wrong' && q.len === 2, 'U', `${tag}: offline tap → wrong-answers round of 2`, q);
      log(!errs.length, 'U', `${tag}: SW upgrade + offline: no page errors`, errs);
      await ctx.close();
    }
  } finally {
    s.server.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ════════════════ M: mixed cached files ════════════════
async function sectionM(v205Dir, oldDir) {
  const mixes = [
    { name: 'v2.0.5 questions.js', from: v205Dir, files: ['js/domain/questions.js'], expectPrune: false },
    { name: 'v2.1.0 store.js', from: oldDir, files: ['js/core/store.js'], expectPrune: false },
    { name: 'v2.0.5 questions.js + v2.1.0 planProgress.js', from: null, files: [], expectPrune: false, custom: true },
  ];
  for (const mix of mixes) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa211m-'));
    const site = path.join(tmp, 'site');
    fs.mkdirSync(site);
    copyApp(ROOT, site);
    if (mix.custom) {
      execSync(`cp "${path.join(v205Dir, 'js/domain/questions.js')}" "${site}/js/domain/questions.js"`);
      execSync(`cp "${path.join(oldDir, 'js/domain/planProgress.js')}" "${site}/js/domain/planProgress.js"`);
    } else for (const f of mix.files) execSync(`cp "${path.join(mix.from, f)}" "${site}/${f}"`);
    const s = await startPagesServer(site);
    try {
      for (const vp of VPS) {
        const pg = await newPage(s, { ...vp, lang: 'en' });
        const tag = `${vp.width} [${mix.name}]`;
        await seed(pg, { [WRONG]: rawMarks(['99.99', '1.0']), [FLAGS]: rawMarks(['3.0']) });
        const h = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, ver: byId('appVersion').textContent,
          tilesDrawn: !!document.querySelector('#tileWrong .t-num'), num: (document.querySelector('#tileWrong .t-num') || {}).textContent,
          h: document.querySelector('#screenHome').getBoundingClientRect().height, stored: localStorage.getItem('lifeuk.wrongList'),
          hasValid: typeof isValidQuestionKey === 'function', plan: typeof planTaskQids === 'function' ? planTaskQids({ qids: ['99.99', '1.0'] }) : null }));
        log(h.s === 'screenHome' && h.ver === 'v2.1.1' && h.tilesDrawn && h.h > 200 && !pg.errs.length, 'M', `${tag}: Home draws (not blank), no page error; tile ${h.num}, stored ${h.stored}, planTaskQids ${JSON.stringify(h.plan)}`, { h, errs: pg.errs });
        if (vp.width === 390) await shot(pg, `M-${mix.name.replace(/[^a-z0-9]+/gi, '-')}-390.png`);
        await pg.ctx.close();
      }
    } finally { s.server.kill(); fs.rmSync(tmp, { recursive: true, force: true }); }
  }
}

(async () => {
  browser = await chromium.launch(launchOpts);
  head = await startPagesServer(ROOT);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa211base-'));
  const old = path.join(tmp, 'old'), v205 = path.join(tmp, 'v205');
  execSync(`git -C "${ROOT}" worktree add --detach "${old}" ${OLD_REV} -q`);
  execSync(`git -C "${ROOT}" worktree add --detach "${v205}" ${V205_REV} -q`);
  try {
    if (want('F')) await sectionF();
    if (want('P')) await sectionP();
    if (want('U')) await sectionU(old);
    if (want('M')) await sectionM(v205, old);
  } catch (e) {
    log(false, 'RUN', 'script error: ' + e.stack);
  }
  head.server.kill();
  execSync(`git -C "${ROOT}" worktree remove --force "${old}"`);
  execSync(`git -C "${ROOT}" worktree remove --force "${v205}"`);
  fs.rmSync(tmp, { recursive: true, force: true });
  await browser.close();
  console.log(`\n${res.filter(r => r.ok).length} / ${res.length} ok`);
  const by = {};
  for (const r of res) { by[r.id] = by[r.id] || [0, 0]; by[r.id][r.ok ? 0 : 1]++; }
  console.log('BY SECTION ' + JSON.stringify(by));
  if (findings.length) console.log('FINDINGS\n' + findings.join('\n'));
  if (obs.length) console.log('NOTES\n' + obs.join('\n'));
})();
