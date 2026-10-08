// QA plan PR1 (study plan domain + storage, no UI): real-browser checks over http
//   node 2026-10-08_qa-plan-pr1-browser.js <repo-root> <work-dir> [old-ref=origin/main]
// A. v1.0.0 (origin/main) SW + cache installed → swap to the PR tree → new SW refills lifeuk-v1.0.0 with plan.js /
//    planProgress.js; reload / offline reload; seeded progress byte-identical; no lifeuk.studyPlan* key (R3)
// B. R3 on the upgraded page: practice answers, exam run + submit, study, language switch → no studyPlan* write
// C. mixed shell (R1): origin/main index.html (no plan tags) + PR js → late boot defines buildPlan / recordPlanAnswer
// D. domain probe in page context: build → write → ensure → record; corrupt JSON; clearStudyPlan; 2 tabs (R17);
//    storage that throws
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(process.argv[2]); const WORK = path.resolve(process.argv[3]); const OLD = process.argv[4] || 'origin/main';
const { startPagesServer, appFiles } = require(path.join(ROOT, 'tests', 'pages-server.js'));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; console.log('FAIL:', m); } };
const CACHE = 'lifeuk-v1.0.0';
const PLAN_KEYS = ['lifeuk.studyPlan', 'lifeuk.studyPlanProgress', 'lifeuk.studyPlanEnabled'];
const SEED = {
  'lifeuk.completedExams': '{"1":true,"2":true,"5":true}', 'lifeuk.homePrefs': '{"mode":"exam","view":"chapter"}',
  'lifeuk.practiceFlags': '{"9.13":true,"6.17":true}', 'lifeuk.practiceStreak': '{"1.0":3,"1.1":2,"2.5":3}',
  'lifeuk.wrongList': '{"3.4":true,"8.1":true}', 'lifeuk.studyBookmarks': '{"7":true}', 'lifeuk.studyMastered': '{"12":true,"40":true}',
  'lifeuk.uiLang': '"zh-HK"', 'lifeuk.installDismissed': 'true',
};
const SHELL = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const SHELL = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
// every localStorage write / remove the page makes, by key (kept in page memory, reset per document)
const SPY = () => {
  window.__lsWrites = [];
  const set = Storage.prototype.setItem, rm = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) { window.__lsWrites.push('set:' + k); return set.call(this, k, v); };
  Storage.prototype.removeItem = function (k) { window.__lsWrites.push('rm:' + k); return rm.call(this, k); };
};
const lsDump = pg => pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
const planWrites = pg => pg.evaluate(() => window.__lsWrites.filter(w => /studyPlan/.test(w)));
const planKeysIn = d => Object.keys(d).filter(k => /studyPlan/.test(k));
const settle = pg => pg.waitForTimeout(450);

async function practiceAnswers(pg, n) {
  await pg.evaluate(() => { pendingMode = 'practice'; startExam(4); }); await settle(pg);
  for (let i = 0; i < n; i++) {
    const picks = await pg.evaluate(i => { const q = state.questions[state.current];
      return i % 2 ? q.a : [q.o.findIndex((_, k) => !q.a.includes(k))].concat(q.a.slice(1)).slice(0, q.a.length); }, i);
    for (const p of picks) await pg.click('#opt' + p);
    await pg.click('#nextBtn');
  }
  await pg.evaluate(() => leaveToHome && leaveToHome()).catch(() => {});
}
async function examRun(pg) {
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(6); }); await settle(pg);
  await pg.evaluate(() => { state.questions.forEach((q, i) => { state.answers[i] = i % 3 ? [...q.a] : [q.o.findIndex((_, k) => !q.a.includes(k))]; });
    state.current = state.questions.length - 1; renderQuestion(); });
  await pg.click('#nextBtn'); await pg.waitForTimeout(200);
  if (await pg.evaluate(() => typeof isConfirmOpen === 'function' && isConfirmOpen())) await pg.click('#confirmOk');
  await settle(pg);
  return pg.evaluate(() => document.querySelector('.screen.active').id);
}

async function partAB(b) {
  const dir = path.join(WORK, 'plan-pr1-up'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  execSync(`git archive ${OLD} | tar -x -C "${dir}"`, { cwd: ROOT, shell: '/bin/bash' });
  const { base, server } = await startPagesServer(dir);
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 } }); await ctx.addInitScript(SPY);
    const pg = await ctx.newPage(); const errs = []; const cons = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') cons.push(m.text()); });
    await pg.goto(base); await pg.evaluate(() => navigator.serviceWorker.ready);
    await pg.evaluate(async c => { for (let i = 0; i < 75; i++) { if ((await caches.keys()).includes(c)) return; await new Promise(r => setTimeout(r, 200)); } }, CACHE);
    await pg.evaluate(s => { localStorage.clear(); Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); }, SEED);
    await pg.reload(); await pg.waitForFunction(() => !!navigator.serviceWorker.controller);
    const old = await pg.evaluate(async c => ({ v: APP_VERSION, plan: typeof buildPlan, cached: !!(await (await caches.open(c)).match(new URL('js/domain/plan.js', location.href).href)) }), CACHE);
    ok(old.v === '1.0.0' && old.plan === 'undefined' && !old.cached, `[A] v1.0.0 (origin/main) controlling, no plan code, plan.js not cached ${JSON.stringify(old)}`);
    const before = await lsDump(pg);
    // deploy the PR tree
    fs.readdirSync(dir).forEach(f => fs.rmSync(path.join(dir, f), { recursive: true, force: true }));
    appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true }));
    const up = await pg.evaluate(async c => { const reg = await navigator.serviceWorker.getRegistration();
      for (let i = 0; i < 100; i++) { const ch = await caches.open(c);
        const has = !!(await ch.match(new URL('js/domain/planProgress.js', location.href).href));
        if (has && !reg.installing && !reg.waiting) return { keys: await caches.keys() };
        if (!reg.installing && !reg.waiting) await reg.update().catch(() => {}); await new Promise(r => setTimeout(r, 200)); } return null; }, CACHE);
    ok(up && up.keys.length === 1 && up.keys[0] === CACHE, `[A] new SW installed into the same ${CACHE} cache (version not bumped) ${JSON.stringify(up)}`);
    const cache = await pg.evaluate(async ([shell, c]) => { const ch = await caches.open(c); const out = { missing: [] };
      const get = async p => { const r = await ch.match(new URL(p, location.href).href); return r ? r.text() : null; };
      for (const p of shell) if ((await get(p)) === null) out.missing.push(p);
      const html = (await get('index.html')) || ''; out.htmlTags = /domain\/plan\.js/.test(html) && /domain\/planProgress\.js/.test(html);
      out.main = /domain\/planProgress\.js/.test((await get('js/main.js')) || '');
      out.cfg = /STUDY_PLAN_READY = false/.test((await get('js/core/config.js')) || ''); return out; }, [SHELL, CACHE]);
    ok(cache.missing.length === 0 && cache.htmlTags && cache.main && cache.cfg, `[A] cache: every SHELL entry (${SHELL.length}) incl. plan.js / planProgress.js; cached index.html + main.js are the new ones ${JSON.stringify(cache)}`);
    await pg.reload(); await settle(pg);
    const now = await pg.evaluate(() => ({ v: APP_VERSION, ready: STUDY_PLAN_READY, b: typeof buildPlan, r: typeof recordPlanAnswer, lang: document.documentElement.lang, scr: document.querySelector('.screen.active').id }));
    ok(now.v === '1.0.0' && now.ready === false && now.b === 'function' && now.r === 'function' && now.lang === 'zh-HK', `[A] reload: new code, still 1.0.0, READY=false, zh-HK kept ${JSON.stringify(now)}`);
    const after = await lsDump(pg);
    ok(Object.keys(SEED).every(k => after[k] === SEED[k]) && planKeysIn(after).length === 0, `[A] seeded keys byte-identical, no studyPlan* key; changed: ${JSON.stringify(Object.keys({ ...before, ...after }).filter(k => before[k] !== after[k]))}`);
    await ctx.setOffline(true); await pg.reload(); await settle(pg);
    const off = await pg.evaluate(() => ({ v: APP_VERSION, b: typeof buildPlan, r: typeof recordPlanAnswer, home: !!document.querySelector('#examGrid .exam-btn') }));
    ok(off.b === 'function' && off.r === 'function' && off.home, `[A] offline reload served from cache, plan code present, home grid rendered ${JSON.stringify(off)}`);
    // ── B: R3 — normal use with no plan writes no plan key (offline, upgraded page) ──
    await practiceAnswers(pg, 6);
    const scr = await examRun(pg);
    await pg.evaluate(() => typeof openStudy === 'function' && openStudy()); await settle(pg);
    await pg.evaluate(() => typeof setLang === 'function' && setLang('en')); await settle(pg);
    await pg.evaluate(() => typeof leaveToHome === 'function' && leaveToHome()); await settle(pg);
    const w = await planWrites(pg); const fin = await lsDump(pg);
    const streakChanged = fin['lifeuk.practiceStreak'] !== SEED['lifeuk.practiceStreak'];
    ok(scr === 'screenResult' && streakChanged, `[B] flows really ran: exam result shown (${scr}), practice streak changed=${streakChanged}`);
    ok(w.length === 0 && planKeysIn(fin).length === 0, `[B] practice ×6 + exam submit + study + lang switch: 0 studyPlan* writes ${JSON.stringify(w)}; keys ${JSON.stringify(planKeysIn(fin))}`);
    ok(errs.length === 0, `[A/B] no page errors ${errs.join(' | ')}`);
    ok(cons.length === 0, `[A/B] no console errors ${cons.join(' | ')}`);
    await ctx.close();
  } finally { server.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
}

async function partC(b) {
  const dir = path.join(WORK, 'plan-pr1-mixed'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true }));
  fs.writeFileSync(path.join(dir, 'index.html'), execSync(`git show ${OLD}:index.html`, { cwd: ROOT }));
  const ctx = await b.newContext({ viewport: { width: 320, height: 640 } }); await ctx.addInitScript(SPY);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(dir, 'index.html')); await pg.waitForFunction(() => document.querySelector('#examGrid .exam-btn'), null, { timeout: 8000 });
  const st = await pg.evaluate(() => ({ tag: !!document.querySelector('script[src="js/domain/plan.js"][data-late], script[src="js/domain/plan.js"]'),
    staticTag: [...document.querySelectorAll('script[src="js/domain/plan.js"]')].length, b: typeof buildPlan, r: typeof recordPlanAnswer, e: typeof ensurePlanToday }));
  ok(st.b === 'function' && st.r === 'function' && st.e === 'function', `[C] old index.html + PR js: late boot loaded plan.js + planProgress.js ${JSON.stringify(st)}`);
  await practiceAnswers(pg, 3);
  const scr = await examRun(pg);
  ok(scr === 'screenResult' && errs.length === 0, `[C] mixed shell: practice + exam submit, no ReferenceError / page error (${scr}) ${errs.join(' | ')}`);
  ok((await planWrites(pg)).length === 0, '[C] mixed shell: no studyPlan* writes');
  await ctx.close(); fs.rmSync(dir, { recursive: true, force: true });
}

async function partD(b) {
  const { base, server } = await startPagesServer(ROOT);
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(base); await settle(pg);
    await pg.evaluate(s => { localStorage.clear(); Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); }, SEED);
    // round trip
    const r1 = await pg.evaluate(() => {
      const today = planTodayIso(); const goal = { examDate: isoAddDays(today, 21), dailyMins: 60, restDays: [0], level: 'none' };
      const noPlan = { ensure: ensurePlanToday(), rec: recordPlanAnswer('1.0', true), mock: recordPlanMock({ examNum: 1, correct: 20, total: 24, isRealTest: true }) };
      const lsNoPlan = Object.keys(localStorage).filter(k => /studyPlan/.test(k));
      const plan = buildPlan(goal, today); writeStudyPlan(plan);
      const rawEq = localStorage.getItem('lifeuk.studyPlan') === JSON.stringify(plan);
      const parsedOk = !!parseStoredPlan(readStudyPlan());
      const ens = ensurePlanToday(); const ens2 = ensurePlanToday();
      const day0 = ens.days[0]; const prac = day0.tasks.find(t => t.type === 'practice'); const qid = prac && prac.qids[0];
      const rec = recordPlanAnswer(qid, true); const recWrong = recordPlanAnswer(prac.qids[1], false);
      const log = JSON.parse(localStorage.getItem('lifeuk.studyPlanProgress'));
      const outside = recordPlanAnswer('999.999', true);
      return { today, days: plan.days.length, exam: goal.examDate, noPlan, lsNoPlan, rawEq, parsedOk, ensSame: JSON.stringify(ens) === JSON.stringify(ens2),
        day0: day0.phase, qid, rec, recWrong, log: log && log.days[today], outside, prog: typeof planDayProgress === 'function' ? 'fn' : 'n/a' };
    });
    console.log('  probe:', JSON.stringify(r1).slice(0, 600));
    ok(r1.noPlan.ensure === null && r1.noPlan.rec === null && r1.noPlan.mock === null && r1.lsNoPlan.length === 0, `[D] no plan: ensure / record / mock return null, write nothing ${JSON.stringify(r1.noPlan)}`);
    ok(r1.rawEq && r1.parsedOk && r1.days === 21, `[D] buildPlan(21 days) → writeStudyPlan: stored JSON identical, parseStoredPlan accepts (${r1.days} days)`);
    ok(r1.ensSame, '[D] ensurePlanToday twice: same result (first open freezes the day)');
    ok(r1.rec === r1.today && r1.recWrong === r1.today && r1.log, `[D] recordPlanAnswer(${r1.qid}) → logged under today ${JSON.stringify(r1.log)}`);
    // corrupt values: no throw, raw value untouched, app boots
    const r2 = await pg.evaluate(() => {
      const out = {}; const raw = () => [localStorage.getItem('lifeuk.studyPlan'), localStorage.getItem('lifeuk.studyPlanProgress')];
      const tryAll = () => { try { return { e: ensurePlanToday(), r: recordPlanAnswer('1.0', true), m: recordPlanMock({ examNum: 1, correct: 1, total: 24, isRealTest: true }) }; } catch (x) { return { threw: x.message }; } };
      const goodPlan = localStorage.getItem('lifeuk.studyPlan');
      localStorage.setItem('lifeuk.studyPlanProgress', '{bad json'); let b4 = raw(); out.badLog = { res: tryAll(), same: JSON.stringify(raw()) === JSON.stringify(b4) };
      localStorage.setItem('lifeuk.studyPlanProgress', '{"v":9,"days":{}}'); b4 = raw(); out.wrongShapeLog = { res: tryAll(), same: JSON.stringify(raw()) === JSON.stringify(b4) };
      localStorage.removeItem('lifeuk.studyPlanProgress');
      localStorage.setItem('lifeuk.studyPlan', '{bad json'); b4 = raw(); out.badPlan = { res: tryAll(), same: JSON.stringify(raw()) === JSON.stringify(b4) };
      localStorage.setItem('lifeuk.studyPlan', '{"v":2,"start":"2026-01-01"}'); b4 = raw(); out.futurePlan = { res: tryAll(), same: JSON.stringify(raw()) === JSON.stringify(b4) };
      localStorage.setItem('lifeuk.studyPlan', 'null'); b4 = raw(); out.nullPlan = { res: tryAll(), same: JSON.stringify(raw()) === JSON.stringify(b4) };
      localStorage.setItem('lifeuk.studyPlan', goodPlan);
      localStorage.setItem('lifeuk.studyPlanEnabled', '"yes"'); out.enabledOdd = isStudyPlanEnabled();
      localStorage.setItem('lifeuk.studyPlanEnabled', '{bad'); out.enabledBad = isStudyPlanEnabled();
      localStorage.removeItem('lifeuk.studyPlanEnabled'); out.enabledNone = isStudyPlanEnabled();
      setStudyPlanEnabled(false); out.enabledOff = [isStudyPlanEnabled(), localStorage.getItem('lifeuk.studyPlanEnabled')];
      return out;
    });
    console.log('  corrupt:', JSON.stringify(r2));
    const nullRes = x => x.res && !x.res.threw && x.res.r === null && x.res.m === null;
    ok(nullRes(r2.badLog) && r2.badLog.same && nullRes(r2.wrongShapeLog) && r2.wrongShapeLog.same, '[D] unparseable / unknown-version log: no throw, record → null, log + plan bytes untouched');
    ok(['badPlan', 'futurePlan', 'nullPlan'].every(k => nullRes(r2[k]) && r2[k].res.e === null && r2[k].same), '[D] unparseable / v2 / null plan: no throw, ensure + record → null, nothing overwritten');
    ok(r2.enabledNone === true && r2.enabledOff[0] === false && r2.enabledOff[1] === 'false' && r2.enabledBad === true, `[D] switch: no value = on, set false stored as false, corrupt = on ${JSON.stringify(r2.enabledOff)} odd=${r2.enabledOdd}`);
    // corrupt plan keys on boot: the app still starts, keys left alone
    await pg.evaluate(() => { localStorage.setItem('lifeuk.studyPlan', '{bad'); localStorage.setItem('lifeuk.studyPlanProgress', '[1,2'); });
    await pg.reload(); await settle(pg);
    const boot = await pg.evaluate(() => ({ grid: !!document.querySelector('#examGrid .exam-btn'), p: localStorage.getItem('lifeuk.studyPlan'), l: localStorage.getItem('lifeuk.studyPlanProgress') }));
    ok(boot.grid && boot.p === '{bad' && boot.l === '[1,2', `[D] boot with corrupt plan keys: home renders, keys untouched ${JSON.stringify(boot)}`);
    // clearStudyPlan: removes schedule + log, keeps switch and every other lifeuk.* key
    const r3 = await pg.evaluate(() => {
      const today = planTodayIso(); writeStudyPlan(buildPlan({ examDate: isoAddDays(today, 30), dailyMins: 45, restDays: [], level: 'some' }, today));
      writePlanLog({ v: 1, days: {} }); setStudyPlanEnabled(false);
      const others = Object.fromEntries(Object.keys(localStorage).filter(k => !/studyPlan/.test(k)).map(k => [k, localStorage.getItem(k)]));
      clearStudyPlan();
      const left = Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]));
      clearStudyPlan(); // second call on missing keys
      return { plan: 'lifeuk.studyPlan' in left, log: 'lifeuk.studyPlanProgress' in left, sw: left['lifeuk.studyPlanEnabled'],
        othersSame: Object.entries(others).every(([k, v]) => left[k] === v) && Object.keys(left).length === Object.keys(others).length + 1, n: Object.keys(others).length };
    });
    ok(!r3.plan && !r3.log && r3.sw === 'false' && r3.othersSame, `[D] clearStudyPlan: schedule + log removed, switch kept (arch B.2 / store.js), ${r3.n} other keys byte-identical; idempotent ${JSON.stringify(r3)}`);
    // R17: two tabs answer different questions — both kept
    const pg2 = await ctx.newPage(); await pg2.goto(base); await settle(pg2);
    const q = await pg.evaluate(() => { const today = planTodayIso(); clearStudyPlan();
      writeStudyPlan(buildPlan({ examDate: isoAddDays(today, 21), dailyMins: 60, restDays: [], level: 'none' }, today));
      const p = ensurePlanToday(); return p.days[0].tasks.find(t => t.type === 'practice').qids.slice(0, 2); });
    await pg.evaluate(k => recordPlanAnswer(k, true), q[0]);
    await pg2.evaluate(k => recordPlanAnswer(k, true), q[1]);
    const both = await pg.evaluate(() => JSON.parse(localStorage.getItem('lifeuk.studyPlanProgress')).days[planTodayIso()]);
    ok(JSON.stringify(both).includes(JSON.stringify(q[0])) && JSON.stringify(both).includes(JSON.stringify(q[1])), `[D] 2 tabs (R17): answers from both tabs kept ${JSON.stringify(both)}`);
    // storage that throws (quota / blocked): service calls do not throw
    const r4 = await pg.evaluate(k => { const set = Storage.prototype.setItem, get = Storage.prototype.getItem; const out = {};
      Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
      try { out.rec = recordPlanAnswer(k, false); out.ens = !!ensurePlanToday(); } catch (x) { out.threw = x.message; }
      Storage.prototype.getItem = () => { throw new Error('SecurityError'); };
      try { out.rec2 = recordPlanAnswer(k, true); out.ens2 = ensurePlanToday(); out.en = isStudyPlanEnabled(); clearStudyPlan(); } catch (x) { out.threw2 = x.message; }
      Storage.prototype.setItem = set; Storage.prototype.getItem = get; return out; }, q[0]);
    ok(!r4.threw && !r4.threw2 && r4.ens2 === null && r4.rec2 === null, `[D] setItem / getItem throwing: no exception escapes ${JSON.stringify(r4)}`);
    ok(errs.length === 0, `[D] no page errors ${errs.join(' | ')}`);
    await ctx.close();
  } finally { server.kill(); }
}

(async () => {
  fs.mkdirSync(WORK, { recursive: true });
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  try { await partAB(b); await partC(b); await partD(b); } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
