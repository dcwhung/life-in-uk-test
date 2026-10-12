// v1.2.0 -> v1.3.2 upgrade E2E. argv: oldRoot newRoot mode(file|http) lang
const { chromium } = require('playwright-core');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const [OLD, NEW, MODE, LANG = 'en'] = process.argv.slice(2);
const S = process.env.S, APP = `${S}/e2e-${MODE}-${LANG}`;
const swap = src => { execSync(`rm -rf ${APP} && mkdir -p ${APP} && cp -r ${src}/. ${APP}/`); };
const log = (...a) => console.log(...a);
const check = (c, m) => { log((c ? 'ok:   ' : 'FAIL: ') + m); if (!c) process.exitCode = 1; };
(async () => {
  swap(OLD);
  let srv, URL;
  if (MODE === 'http') { const port = LANG === 'en' ? 8771 : 8772; srv = spawn('python3', ['-m', 'http.server', String(port), '-d', APP], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800)); URL = `http://127.0.0.1:${port}/index.html`; }
  else URL = 'file://' + APP + '/index.html';
  const ud = fs.mkdtempSync(`${S}/ud-`);
  const ctx = await chromium.launchPersistentContext(ud, { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'], viewport: { width: 390, height: 844 } });
  const pg = ctx.pages()[0] || await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(URL); await pg.evaluate(() => localStorage.clear()); await pg.reload();
  await pg.evaluate(l => setLang(l), LANG);
  log('old version', await pg.evaluate(() => APP_VERSION), 'STUDY', await pg.evaluate(() => STUDY.length));
  // --- v1.2.0: Study Ch4, #126 mastered + bookmarked by clicking its buttons
  await pg.click('[data-action="openStudy"]');
  await pg.evaluate(() => { studySetTab('chapters'); studySetChapter(4); });
  await pg.click('.fact[data-fact-id="126"] [data-action="studyToggleMark"][data-mark="mastered"]');
  await pg.click('.fact[data-fact-id="126"] [data-action="studyToggleMark"][data-mark="bookmarks"]');
  // --- plan: enable feature, Home "Create a study plan" card, default goal, Create
  await pg.evaluate(() => { goHome(); setPlanFeature(true); });
  await pg.click('.plan-cta');
  await pg.click('[data-action="planCreate"]');
  const before = await pg.evaluate(() => {
    const plan = JSON.parse(localStorage.getItem(STUDY_PLAN_LS));
    const tasks = plan.days.flatMap((d, di) => d.tasks.map(t => ({ di, t })));
    const with126 = tasks.filter(x => (x.t.facts || []).includes(126)), with125 = tasks.filter(x => (x.t.facts || []).includes(125));
    return { ls: Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k).slice(0, 200)])), days: plan.days.length,
      with126: with126.map(x => `${x.di}:${x.t.kind || x.t.type}`), with125: with125.map(x => `${x.di}:${x.t.kind || x.t.type}`), both: tasks.filter(x => (x.t.facts || []).includes(125) && x.t.facts.includes(126)).length };
  });
  log('v1.2.0 storage', JSON.stringify(before.ls));
  log('v1.2.0 plan days', before.days, 'tasks with 126', before.with126, 'with 125', before.with125, 'both', before.both);
  check(before.with126.length > 0, 'v1.2.0 plan has a task with fact 126');
  if (MODE === 'http') { const sw = await pg.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!navigator.serviceWorker.controller || !!r.active; }); log('v1.2.0 SW active', sw); }
  // --- swap to v1.3.2 and reload
  swap(NEW);
  await pg.goto(URL);
  let ver = await pg.evaluate(() => APP_VERSION);
  log('after swap+reload version', ver);
  // http: the new SW installs, skipWaiting + claim, the app reloads itself on controllerchange — wait for it (no manual reloads)
  for (let i = 0; i < 30 && ver !== '1.3.2'; i++) { await pg.waitForTimeout(1000); try { await pg.waitForLoadState('load'); ver = await pg.evaluate(() => APP_VERSION); } catch (e) { ver = 'nav'; } }
  log(' version after waiting for SW cutover', ver, MODE === 'http' ? JSON.stringify(await pg.evaluate(async () => caches.keys())) : '');
  await pg.waitForTimeout(1500);
  check(ver === '1.3.2', 'running v1.3.2');
  const after = await pg.evaluate(() => {
    const g = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return 'BAD'; } };
    const plan = g(STUDY_PLAN_LS);
    const tasks = plan ? plan.days.flatMap(d => d.tasks) : [];
    const dupTask = tasks.filter(t => Array.isArray(t.facts) && new Set(t.facts).size !== t.facts.length).length;
    return { mastered: g(STUDY_LS.mastered), bookmarks: g(STUDY_LS.bookmarks), marker: localStorage.getItem(FACT_MERGE_LS), planOk: !!plan, days: plan && plan.days.length,
      any126: tasks.some(t => (t.facts || []).includes(126) || (t.anchor && 126 in t.anchor)), dupTask,
      homeHasCreate: !!document.querySelector('.plan-cta'), homeCard: (document.querySelector('.plan-home') || {}).innerText };
  });
  log('v1.3.2 storage', JSON.stringify({ ...after, homeCard: (after.homeCard || '').slice(0, 160) }));
  check(after.mastered && after.mastered[125] && !(126 in after.mastered), '#125 mastered, no 126 key');
  check(after.bookmarks && after.bookmarks[125] && !(126 in after.bookmarks), '#125 bookmarked, no 126 key');
  check(after.marker === '[126]', 'marker lifeuk.factIdsMerged = [126]');
  check(after.planOk && after.days === before.days, 'plan kept, same day count');
  check(!after.any126, 'no task lists 126 (facts / anchor)');
  check(after.dupTask === 0, 'no duplicate fact id within a task');
  check(!after.homeHasCreate && !!after.homeCard, 'Home shows the plan card, not Create a study plan');
  // Study UI
  await pg.click('[data-action="openStudy"]');
  await pg.evaluate(() => { studySetTab('chapters'); studySetChapter(4); });
  const st = await pg.evaluate(() => { const c = document.querySelector('.fact[data-fact-id="125"]'); const b = k => c.querySelector(`[data-mark="${k}"]`);
    return { mastered: c.classList.contains('mastered'), mBtn: b('mastered') && b('mastered').getAttribute('aria-pressed'), bBtn: b('bookmarks').getAttribute('aria-pressed'), prog: byId('studyProgress').innerText }; });
  log('Study #125', JSON.stringify(st));
  check(st.mBtn === 'true' && st.bBtn === 'true' && /1 \/ 235/.test(st.prog), 'Study #125 card ticked + bookmarked, header 🏆 1 / 235');
  await pg.screenshot({ path: `${S}/shots/e2e_${MODE}_${LANG}_study125.png` });
  // plan: read tasks of the day(s) that had 126 — open schedule + day, runner
  const run = await pg.evaluate(dis => {
    goHome(); openPlanSchedule();
    const plan = planLoad(); const out = [];
    for (const di of dis) { const day = plan.days[di]; out.push({ di, tasks: day.tasks.map(t => `${t.kind || t.type}:${(t.facts || []).length}${(t.facts || []).includes(125) ? '(125)' : ''}`).join(' ') }); }
    return { scheduleShown: byId('screenPlanSchedule') && byId('screenPlanSchedule').offsetParent !== null, out };
  }, [...new Set(before.with126.map(x => Number(x.split(':')[0])))]);
  log('plan schedule', JSON.stringify(run));
  check(run.scheduleShown, 'plan schedule screen opens');
  await pg.screenshot({ path: `${S}/shots/e2e_${MODE}_${LANG}_schedule.png` });
  // reload once more: idempotent
  await pg.reload();
  const again = await pg.evaluate(() => [localStorage.getItem(STUDY_LS.mastered), localStorage.getItem(STUDY_LS.bookmarks), localStorage.getItem(FACT_MERGE_LS)]);
  check(again[0] === JSON.stringify(after.mastered) && again[1] === JSON.stringify(after.bookmarks) && again[2] === '[126]', 'second load: no change');
  // runner on the day that held 126 (clock moved to that date)
  const di = Number(before.with126[0].split(':')[0]);
  const date = await pg.evaluate(di => planLoad().days[di].date, di);
  await pg.clock.setFixedTime(new Date(date + 'T10:00:00'));
  await pg.reload();
  await pg.evaluate(() => { goHome(); openPlanDay(); });
  const dayTxt = await pg.evaluate(() => byId('screenPlanDay').innerText.slice(0, 400));
  log('day view', JSON.stringify(dayTxt));
  const btn = pg.locator('[data-action="planOpenTask"]').filter({ hasText: /Read|閱讀|讀/ }).first();
  check(await btn.count() > 0, 'read task button on day ' + date);
  await btn.click();
  const rr = await pg.evaluate(() => { const ids = [...document.querySelectorAll('.fact[data-fact-id]')].filter(e => e.offsetParent).map(e => e.dataset.factId); return { ids, screen: [...document.querySelectorAll('.screen')].filter(e => e.offsetParent).map(e => e.id) }; });
  log('runner', JSON.stringify({ screen: rr.screen, n: rr.ids.length, first: rr.ids.slice(0, 5), has125: rr.ids.includes('125'), has126: rr.ids.includes('126') }));
  check(rr.ids.length > 0 && !rr.ids.includes('126'), 'runner shows read cards, none is 126');
  await pg.screenshot({ path: S + '/shots/e2e_' + MODE + '_' + LANG + '_runner.png' });
  check(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await ctx.close(); if (srv) srv.kill();
})().catch(e => { console.error(e); process.exit(1); });
