// QA plan PR8 (v1.1.0 release), reviewer-run: plain URL (no ?preview) at 390 / 320 x en / zh-HK —
// first launch (create card, ⓘ switch on, no key written), ⓘ off hides the card and survives reload,
// full flow create -> schedule -> today -> reading task -> practice -> back, and a real SW upgrade:
// c442651 (1.0.8, preview on, plan + progress stored) served over http, then the 1.1.0 files deployed in place.
// usage: QA_OUT=<scratch dir> NODE_PATH=... CHROMIUM_PATH=... node <this file>
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..', '..');
const { startPagesServer, appFiles } = require(path.join(REPO, 'tests/pages-server.js'));
const OUT = process.env.QA_OUT || fs.mkdtempSync('/tmp/qa-pr8-');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const assert = (c, m) => { results.push((c ? 'ok: ' : 'FAIL: ') + m); console.log((c ? 'ok: ' : 'FAIL: ') + m); };
const visible = (pg, sel) => pg.evaluate(sel => { const e = document.querySelector(sel); return !!e && e.getClientRects().length > 0; }, sel);
const active = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
const noHScroll = pg => pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
// human pace: a tap < SCREEN_CHANGE_CLICK_GUARD_MS (350) after a screen change at the same spot is dropped by the
// CUI-0011 double tap guard, which Playwright's back-to-back clicks would otherwise hit
const tap = async (pg, sel) => { await pg.waitForTimeout(400); await pg.click(sel); };
const shot = (pg, name, fullPage = true) => pg.screenshot({ path: path.join(OUT, name + '.png'), fullPage });

// empties dest but keeps the folder itself: the http server serving it keeps its cwd (a deploy in place)
function copyTree(fromRoot, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(dest)) fs.rmSync(path.join(dest, e), { recursive: true, force: true });
  for (const f of appFiles(fromRoot)) fs.cpSync(path.join(fromRoot, f), path.join(dest, f), { recursive: true });
}
async function page(b, w, lang, base) {
  const ctx = await b.newContext({ viewport: { width: w, height: 800 }, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(base + 'index.html');
  await pg.evaluate(l => { localStorage.clear(); if (l !== 'en') localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); }, lang);
  await pg.goto(base + 'index.html');
  return { ctx, pg, errs };
}

async function firstLaunch(b, base) {
  for (const w of [390, 320]) for (const lang of ['en', 'zh-HK']) {
    const tag = `${w} ${lang}`;
    const { ctx, pg, errs } = await page(b, w, lang, base);
    assert(await pg.evaluate(() => location.search === '' && document.documentElement.lang) === lang, `${tag}: plain URL, <html lang> ${lang}`);
    assert(await visible(pg, '#planCard .plan-cta'), `${tag}: first launch shows the create card`);
    assert((await pg.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('lifeuk.studyPlan')))).length === 0, `${tag}: no plan key written`);
    assert(await noHScroll(pg), `${tag}: Home no horizontal scroll`);
    await shot(pg, `first-${w}-${lang}`);
    await tap(pg, '#infoBtn');
    assert(await visible(pg, '#infoPlanRow') && await pg.getAttribute('#planFeatureSwitch', 'aria-checked') === 'true', `${tag}: ⓘ Features row, switch on`);
    await shot(pg, `first-${w}-${lang}-info`, false);
    await tap(pg, '#planFeatureSwitch');
    await tap(pg, '#confirmOk');
    assert(!(await visible(pg, '#planCard')), `${tag}: switch off hides the card`);
    await pg.reload();
    assert(!(await visible(pg, '#planCard')), `${tag}: off survives reload`);
    await tap(pg, '#infoBtn');
    assert(await pg.getAttribute('#planFeatureSwitch', 'aria-checked') === 'false', `${tag}: switch still off after reload`);
    assert(errs.length === 0, `${tag}: no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }
}

async function fullFlow(b, base) {
  for (const w of [390, 320]) for (const lang of ['en', 'zh-HK']) {
    const tag = `flow ${w} ${lang}`, f = `flow-${w}-${lang}`;
    const { ctx, pg, errs } = await page(b, w, lang, base);
    await tap(pg, '#planCard .plan-cta');
    assert(await active(pg) === 'screenPlanGoal', `${tag}: create card opens the goal screen`);
    await tap(pg, '#planCreateBtn');
    assert(await active(pg) === 'screenPlanSchedule' && await noHScroll(pg), `${tag}: Build opens the schedule, no h-scroll`);
    await shot(pg, f + '-schedule');
    const today = await pg.evaluate(() => planTodayIso());
    await tap(pg, `.plan-day[data-arg="${today}"]`);
    assert(await active(pg) === 'screenPlanDay' && await noHScroll(pg), `${tag}: today row opens the day, no h-scroll`);
    await shot(pg, f + '-day');
    await tap(pg, '#planTaskList .plan-task.read');
    assert(await active(pg) === 'screenPlanRun', `${tag}: reading task opens the runner`);
    const next = '#planRunBody [data-action="planStepFact"][data-arg="1"]';
    let n = 0;
    while (n < 80 && await visible(pg, next)) { await tap(pg, next); n++; }
    assert(n > 0 && await noHScroll(pg), `${tag}: stepped through ${n + 1} facts, no h-scroll`);
    await shot(pg, f + '-read-last');
    const cta = '#planRunBody [data-action="planOpenTask"], #planRunBody [data-action="planPractiseTask"]';
    assert(await visible(pg, cta), `${tag}: last fact shows the practise button`);
    await tap(pg, cta);
    assert(await active(pg) === 'screenQuiz' && await pg.evaluate(() => isPlanSession()), `${tag}: practice runs as a plan session`);
    const picks = await pg.evaluate(() => state.questions[state.current].a);
    for (const i of picks) await tap(pg, `#opt${i}`);
    const ok = await pg.evaluate(t => { const l = JSON.parse(localStorage.getItem(STUDY_PLAN_PROGRESS_LS) || 'null'); return l && l.days[t] ? Object.keys(l.days[t].ok || {}).length : 0; }, today);
    assert(ok === 1, `${tag}: the right answer is logged for today (${ok})`);
    await shot(pg, f + '-quiz', false);
    await tap(pg, '#screenQuiz .back-btn');
    if (await pg.evaluate(() => isConfirmOpen())) await tap(pg, '#confirmOk');
    assert(await active(pg) === 'screenPlanDay', `${tag}: ← returns to today's tasks`);
    await shot(pg, f + '-day-after');
    await pg.evaluate(() => goHome());
    assert(await active(pg) === 'screenHome' && await visible(pg, '#planCard .plan-home'), `${tag}: Home shows the plan card`);
    assert(errs.length === 0, `${tag}: no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }
}

async function upgrade(b) {
  const old = path.join(OUT, 'old-src'), dir = path.join(OUT, 'site');
  fs.rmSync(old, { recursive: true, force: true }); fs.mkdirSync(old, { recursive: true });
  execSync(`git -C ${REPO} archive c442651 | tar -x -C ${old}`);
  copyTree(old, dir);
  const { base, server } = await startPagesServer(dir);
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(base + '?preview=plan');
    await pg.evaluate(() => navigator.serviceWorker.ready);
    await pg.reload();
    const v0 = await pg.evaluate(async () => ({ v: APP_VERSION, ready: STUDY_PLAN_READY, ctl: !!navigator.serviceWorker.controller, caches: await caches.keys() }));
    assert(v0.v === '1.0.8' && !v0.ready && v0.ctl && JSON.stringify(v0.caches) === '["lifeuk-v1.0.8"]', '1.0.8 installed + controlling, cache lifeuk-v1.0.8 ' + JSON.stringify(v0));
    assert(await pg.evaluate(() => localStorage.getItem('lifeuk.studyPlanPreview')) === 'true', '1.0.8: preview flag stored');
    await pg.evaluate(() => {
      writeStudyPlan(buildPlan({ examDate: isoAddDays(planTodayIso(), 21), dailyMins: 60, restDays: [0], level: 'none' }, planTodayIso()));
      recordPracticeAnswer({ ...EXAMS[1][0], examNum: 1, origIdx: 0 }, true); // a Practice answer outside the plan is logged for today (G2)
    });
    const before = await pg.evaluate(() => ({ plan: localStorage.getItem(STUDY_PLAN_LS), log: localStorage.getItem(STUDY_PLAN_PROGRESS_LS) }));
    assert(!!before.plan && !!before.log && before.log.includes('"ok":{"'), '1.0.8: plan + progress stored ' + before.log);
    copyTree(REPO, dir); // deploy 1.1.0 in place
    let v = '';
    for (let i = 0; i < 6 && v !== '1.1.0'; i++) {
      await pg.goto(base);
      await pg.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {}));
      await pg.waitForTimeout(1000);
      v = await pg.evaluate(() => APP_VERSION);
    }
    await pg.goto(base);
    const v1 = await pg.evaluate(async () => ({ v: APP_VERSION, ready: STUDY_PLAN_READY, caches: await caches.keys(), ctl: !!navigator.serviceWorker.controller,
      plan: localStorage.getItem(STUDY_PLAN_LS), log: localStorage.getItem(STUDY_PLAN_PROGRESS_LS), preview: localStorage.getItem('lifeuk.studyPlanPreview') }));
    assert(v1.v === '1.1.0' && v1.ready === true && v1.ctl, 'after deploy: APP_VERSION 1.1.0, entry on, SW controlling');
    assert(JSON.stringify(v1.caches) === '["lifeuk-v1.1.0"]', 'after deploy: only cache lifeuk-v1.1.0 ' + JSON.stringify(v1.caches));
    assert(v1.preview === null, 'after deploy: stale lifeuk.studyPlanPreview removed');
    // the plan itself may be re-saved on load (G9: today's review / drill / mock tasks are filled on their day), so
    // compare what identifies it; the progress log must be byte-identical
    const id = s => { const p = JSON.parse(s); return JSON.stringify([p.start, p.goal, p.days.length, p.days.map(d => d.date)]); };
    assert(id(v1.plan) === id(before.plan), 'after deploy: stored plan kept (same start, goal, days)');
    assert(v1.log === before.log, 'after deploy: progress log unchanged');
    if (v1.plan !== before.plan) console.log('note: plan re-saved on load:', before.plan.length, '->', v1.plan.length, 'chars');
    assert(await visible(pg, '#planCard .plan-home'), 'after deploy: Home shows the existing plan card');
    await shot(pg, 'upgrade-home');
    await ctx.setOffline(true);
    await pg.reload();
    assert(await pg.evaluate(() => APP_VERSION) === '1.1.0' && await visible(pg, '#planCard .plan-home'), 'after deploy: offline reload serves 1.1.0 with the plan card');
    await ctx.setOffline(false);
    assert(errs.length === 0, 'upgrade: no page errors ' + errs.join(' | '));
    await ctx.close();
  } finally { server.kill(); }
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  const dir = path.join(OUT, 'cur');
  copyTree(REPO, dir);
  const { base, server } = await startPagesServer(dir);
  try { await firstLaunch(b, base); await fullFlow(b, base); } finally { server.kill(); }
  await upgrade(b);
  await b.close();
  const fails = results.filter(r => r.startsWith('FAIL'));
  console.log(fails.length ? `QA FAIL (${fails.length}/${results.length})` : `QA PASS (${results.length} checks)`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
