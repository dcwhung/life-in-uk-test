// QA plan PR7 (copy-only: zh-HK / en wording): real-browser spot-check of every changed string, 375px, both languages
//   node 2026-10-09_qa-plan-pr7-browser.js <repo-root> <shot-dir>
// For each language: Home create card, ⓘ switch note on / off + off modal, goal level cards, schedule (order title /
// intro, strategy, day list, reset hint + reset modal), Home active card + edit-goal step / date note, day hints (today /
// ahead), runner pair note → Result card sumRedone + donePairHtml, review note + reviewWasWrong label, all-done sub,
// Home done, ended card, log broken. Each checked against the locale value (rendered = t(key)), plus overflow / clipping.
const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(process.argv[2]); const SHOTS = path.resolve(process.argv[3] || '/tmp/qa-pr7-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const { startPagesServer } = require(path.join(ROOT, 'tests', 'pages-server.js'));
let pass = 0, fail = 0; const notes = [];
const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; console.log('FAIL:', m); } };
const launchOpts = { args: ['--no-sandbox'] }; if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const TODAY = '2026-10-08'; const at = (iso, time = '09:00:00') => new Date(`${iso}T${time}`);
const settle = (pg, ms = 150) => pg.waitForTimeout(ms);
const GUARD_MS = 420;
const norm = s => (s || '').replace(/\s+/g, ' ').trim();
const screen = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
const T = (pg, key, vars) => pg.evaluate(([k, v]) => t(k, v || undefined), [key, vars || null]);
const txt = (pg, sel) => pg.evaluate(sel => { const e = document.querySelector(sel); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, sel);
const stripTags = s => s.replace(/<[^>]+>/g, '');
// overflow / clipping inside a root: any text element wider than its box with hidden overflow, any element past the
// viewport's right edge, page horizontal scroll
const overflow = (pg, sel) => pg.evaluate(sel => {
  const root = document.querySelector(sel); if (!root) return ['no root ' + sel];
  const vw = document.documentElement.clientWidth, out = [];
  if (document.documentElement.scrollWidth > vw) out.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
  root.querySelectorAll('*').forEach(e => {
    if (!e.getClientRects().length || e.closest('[aria-hidden="true"]') || e.closest('.plan-day-scroll') && e !== e.closest('.plan-day-scroll')) {
      // the day list scrolls vertically on purpose; its rows are still checked for width below
    }
    if (!e.getClientRects().length) return;
    const hasText = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) return;
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    if (r.right > vw + 0.5) out.push(`past viewport: "${e.textContent.trim().slice(0, 30)}" right ${Math.round(r.right)}`);
    const clipX = /hidden|clip/.test(s.overflowX) || s.textOverflow === 'ellipsis';
    if (clipX && e.scrollWidth > e.clientWidth + 1) out.push(`clipped-x: "${e.textContent.trim().slice(0, 30)}" ${e.scrollWidth}/${e.clientWidth}`);
    const clipY = /hidden|clip/.test(s.overflowY) && !/auto|scroll/.test(s.overflowY);
    if (clipY && e.scrollHeight > e.clientHeight + 1 && s.webkitLineClamp === 'none') out.push(`clipped-y: "${e.textContent.trim().slice(0, 30)}" ${e.scrollHeight}/${e.clientHeight}`);
    if (s.webkitLineClamp !== 'none' && e.scrollHeight > e.clientHeight + 1) out.push(`line-clamped: "${e.textContent.trim().slice(0, 30)}"`);
  });
  return out;
}, sel);

async function boot(pg, base, lang, wrong) {
  await pg.clock.install({ time: at(TODAY) });
  await pg.goto(base); await pg.evaluate(({ lang, wrong }) => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true');
    if (wrong) localStorage.setItem('lifeuk.wrongList', wrong); localStorage.setItem('lifeuk.uiLang', JSON.stringify(lang)); }, { lang, wrong });
  await pg.goto(base + '?preview=plan'); await settle(pg, 400);
}
async function answer(pg, right) {
  const c = await pg.evaluate(() => { const q = state.questions[state.current]; return { a: q.a, n: q.o.length }; });
  const picks = right ? c.a : [...Array(c.n).keys()].filter(x => !c.a.includes(x)).slice(0, c.a.length);
  for (const oi of picks) await pg.click('#opt' + oi);
  await settle(pg, 40);
}
const qState = pg => pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, idx: state.current, n: state.questions && state.questions.length }));
async function playTask(pg, wrongFirst = false) { // first question wrong once (when asked), everything else right, until the task ends
  let first = wrongFirst;
  for (let i = 0; i < 120; i++) {
    const c = await qState(pg); if (c.scr !== 'screenQuiz') return;
    await answer(pg, !first); first = false;
    await pg.click('#nextBtn'); await settle(pg, c.idx === c.n - 1 ? GUARD_MS : 40);
  }
}
const boxSel = (date, i) => `#planTaskList button[data-arg="${date}"][data-task="${i}"]`;

async function runLang(b, base, lang) {
  const L = lang === 'en' ? 'en' : 'zh';
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(8000); const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error' || /\[i18n\] missing/.test(m.text())) errs.push('console: ' + m.text()); });
  const shot = async (name, full = true) => pg.screenshot({ path: path.join(SHOTS, `${L}-${name}.png`), fullPage: full });
  const over = async (label, sel) => { const o = await overflow(pg, sel); ok(o.length === 0, `[${L}] ${label}: no overflow / clipping${o.length ? ' — ' + o.join('; ') : ''}`); };
  await boot(pg, base, lang, '{"1.3":true,"3.12":true}');

  // 1 create card
  const createText = await T(pg, 'plan.createText');
  const cardCreate = await txt(pg, '#planCard');
  ok(cardCreate && cardCreate.includes(norm(createText)), `[${L}] create card: "${createText}"`);
  await over('create card', '#planCard'); await shot('home-create', false);

  // 2 ⓘ switch note on / off + off modal
  await pg.click('#infoBtn'); await settle(pg, 150);
  const onNote = await txt(pg, '#infoPlanStatus');
  ok(onNote === await T(pg, 'app.planOnNote'), `[${L}] ⓘ on note: "${onNote}"`);
  await over('ⓘ popover (on)', '#infoPop'); await shot('info-on', false);
  await pg.click('#planFeatureSwitch'); await settle(pg, 250);
  const offMsg = await pg.evaluate(() => byId('confirmMsg').textContent);
  ok(offMsg === await T(pg, 'modal.planOffMessage'), `[${L}] off modal: "${offMsg}"`);
  await over('off modal', '#confirmModal'); await shot('modal-off', false);
  await pg.click('#confirmOk'); await settle(pg, 300);
  const offNote = await txt(pg, '#infoPlanStatus');
  ok(offNote === await T(pg, 'app.planOffNote'), `[${L}] ⓘ off note: "${offNote}"`);
  await over('ⓘ popover (off)', '#infoPop'); await shot('info-off', false);
  await pg.click('#planFeatureSwitch'); await settle(pg, 300); await pg.keyboard.press('Escape'); await settle(pg, 150);

  // 3 goal screen level cards
  await pg.click('#planCard .plan-cta'); await settle(pg, GUARD_MS);
  const levels = await pg.evaluate(() => [...document.querySelectorAll('#screenPlanGoal .plan-level-sub')].map(e => {
    const card = e.closest('button'); return { all: card.innerText.replace(/\s+/g, ' ').trim(), sub: e.textContent }; }));
  const expLv = [];
  for (const k of ['none', 'some', 'exam']) expLv.push([await T(pg, `data.planLevels.${k}.label`), await T(pg, `data.planLevels.${k}.sub`)]);
  ok(levels.length === 3 && levels.every((l, i) => l.all.includes(expLv[i][0]) && l.sub === expLv[i][1]), `[${L}] level cards: ${levels.map(l => '"' + l.all + '"').join(' / ')}`);
  const stepCreate = await T(pg, 'plan.goal.step');
  await over('goal screen (create)', '#screenPlanGoal'); await shot('goal-create');
  await pg.click('#planCreateBtn'); await settle(pg, GUARD_MS);

  // 4 schedule
  ok((await screen(pg)) === 'screenPlanSchedule', `[${L}] create → schedule`);
  for (const f of ['planPhasesToggle', 'planOrderToggle']) { if (await pg.$eval('#' + f, e => e.getAttribute('aria-expanded')) !== 'true') { await pg.click('#' + f); await settle(pg, 200); } }
  const sch = await pg.evaluate(() => ({ orderTitle: byId('planOrderToggle').innerText.trim(), orderIntro: document.querySelector('[data-i18n="plan.schedule.orderIntro"]').textContent,
    strat: byId('planStrategy').innerText.replace(/\s+/g, ' '), reset: document.querySelector('.plan-reset .reset-hint').textContent,
    list: byId('planDayList').innerText.replace(/\s+/g, ' ') }));
  ok(sch.orderTitle === await T(pg, 'plan.schedule.orderTitle'), `[${L}] order title: "${sch.orderTitle}"`);
  ok(sch.orderIntro === await T(pg, 'plan.schedule.orderIntro'), `[${L}] order intro: "${sch.orderIntro}"`);
  const lo = norm(await T(pg, 'plan.strategy.learnOrder')), lr = norm(await T(pg, 'plan.strategy.learnReview'));
  ok(sch.strat.includes(lo) && sch.strat.includes(lr), `[${L}] strategy: "${lo}" + "${lr}"`);
  ok(sch.reset === await T(pg, 'plan.schedule.resetHint'), `[${L}] reset hint: "${sch.reset}"`);
  const reviewWord = await T(pg, 'plan.task.review').catch(() => null);
  const redo = lang === 'en' ? 'Redo your wrong answers' : '重做錯題';
  const stale = lang === 'en' ? /Clear your wrong answers|clearing/ : /清錯題/;
  ok(sch.list.includes(redo) && !stale.test(sch.list) && !stale.test(sch.strat), `[${L}] day list shows "${redo}", no old wording (review key "${reviewWord}")`);
  await over('schedule', '#screenPlanSchedule'); await shot('schedule');
  await pg.click('[data-action="planAskReset"]'); await settle(pg, 250);
  const resetMsg = await pg.evaluate(() => byId('confirmMsg').innerText);
  ok(norm(resetMsg) === norm(await T(pg, 'modal.planResetMessage')), `[${L}] reset modal: "${norm(resetMsg)}"`);
  const resetLines = await pg.evaluate(() => byId('confirmMsg').innerText.split('\n').filter(Boolean).length);
  ok(resetLines >= 2, `[${L}] reset modal keeps its line break (${resetLines} paragraphs)`);
  await over('reset modal', '#confirmModal'); await shot('modal-reset', false);
  await pg.click('#confirmCancel'); await settle(pg, 250);
  ok(await pg.evaluate(() => !!planLoad()), `[${L}] reset Cancel keeps the plan`);
  // 5 edit goal from the schedule's "Change goal" button
  const egBtn = await txt(pg, '#screenPlanSchedule [data-action="planEditGoal"]');
  ok(egBtn === await T(pg, 'plan.schedule.editGoal'), `[${L}] schedule edit-goal button: "${egBtn}"`);
  await pg.click('#screenPlanSchedule [data-action="planEditGoal"]'); await settle(pg, GUARD_MS);
  const ed = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, step: byId('planGoalStep').textContent, note: byId('planDateNote').hidden ? null : byId('planDateNote').textContent,
    noteShown: byId('planDateNote').getClientRects().length > 0 }));
  const editStep = norm(await T(pg, 'plan.goal.editStep')), editNote = await T(pg, 'plan.goal.editDateNote');
  ok(ed.scr === 'screenPlanGoal' && norm(ed.step) === editStep && ed.noteShown && ed.note === editNote, `[${L}] edit goal: step "${editStep}", date note "${ed.note}" (create step was "${stepCreate}")`);
  await over('goal screen (edit)', '#screenPlanGoal'); await shot('goal-edit');
  await pg.click('#screenPlanGoal .back-btn'); await settle(pg, GUARD_MS);
  if ((await screen(pg)) === 'screenPlanSchedule') { await pg.click('#screenPlanSchedule .back-btn'); await settle(pg, GUARD_MS); }
  ok((await screen(pg)) === 'screenHome', `[${L}] edit goal ← back (via schedule) to Home`);

  // 6 day hints: today + ahead
  await pg.evaluate(() => openPlanDay()); await settle(pg, 250);
  const hT = await txt(pg, '#planDayHint');
  ok(hT === await T(pg, 'plan.day.hintToday'), `[${L}] today hint: "${hT}"`);
  await over('day screen (today)', '#screenPlanDay'); await shot('day-today');
  await pg.evaluate(() => openPlanDay('2026-10-10')); await settle(pg, 250);
  const hA = await txt(pg, '#planDayHint');
  ok(hA === await T(pg, 'plan.day.hintAhead'), `[${L}] ahead hint: "${hA}"`);
  await over('day screen (ahead)', '#screenPlanDay'); await shot('day-ahead');
  await pg.evaluate(() => openPlanDay()); await settle(pg, 250);

  // 7 runner: Practise Ch 1 (task 1), first question wrong then redone
  const tasks = await pg.evaluate(() => planDayAt(planLoad(), '2026-10-08').tasks.map(x => x.type));
  ok(tasks.join() === 'read,practice,read,practice,read,practice,review', `[${L}] Day 1 tasks ${tasks.join()}`);
  await pg.click(boxSel(TODAY, 1)); await settle(pg, GUARD_MS);
  const pair = await pg.evaluate(() => byId('planPairNote').hidden ? null : byId('planPairNote').textContent);
  ok(pair === await T(pg, 'plan.run.pairNote'), `[${L}] runner pair note: "${pair}"`);
  await over('runner (pair note)', '#screenQuiz'); await shot('runner-pair', false);
  await playTask(pg, true);
  const card1 = await pg.evaluate(() => { const b = byId('planRunBody'); const g = s => { const e = b.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }; return { sub: g('.result-sub'), note: g('.plan-note') }; });
  const expSub = await T(pg, 'plan.run.sumRedone', { n: 9, k: 1 });
  ok(card1.sub === expSub, `[${L}] Result card sumRedone: "${card1.sub}"`);
  const pairTpl = stripTags(await T(pg, 'plan.run.donePairHtml', { task: '@@' })).split('@@');
  ok(card1.note && card1.note.startsWith(pairTpl[0]) && card1.note.endsWith(pairTpl[1]), `[${L}] Result card pair note: "${card1.note}"`);
  await over('Result card (task)', '#screenPlanRun'); await shot('result-ch1');
  // review the done task: review note + reviewWasWrong on the redone question
  await pg.click('#planRunBody [data-action="planReviewTask"]'); await settle(pg, GUARD_MS);
  const rv = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, note: byId('planRunNote').hidden ? null : byId('planRunNote').textContent,
    labels: state.questions.map((_, i) => { goToQuestion(i); return byId('ansLabel').textContent; }) }));
  ok(rv.note === await T(pg, 'plan.run.reviewNote'), `[${L}] review note: "${rv.note}"`);
  const ww = await T(pg, 'plan.run.reviewWasWrong');
  ok(rv.labels.filter(l => l === ww).length === 1, `[${L}] reviewWasWrong label once: "${ww}"`);
  const wIdx = rv.labels.indexOf(ww);
  await pg.evaluate(i => goToQuestion(i), wIdx); await settle(pg, 80);
  await over('runner review (was wrong)', '#screenQuiz'); await shot('runner-review-waswrong');
  await pg.evaluate(() => goToQuestion(0)); await settle(pg, 60);
  for (let i = 0; i < 12; i++) { const c = await qState(pg); if (c.scr !== 'screenQuiz') break; await pg.click('#nextBtn'); await settle(pg, c.idx === c.n - 1 ? GUARD_MS : 40); }

  // 8 finish the day: Ch 2 (3), Ch 5 (5), review (6) → all-done
  for (const i of [3, 5, 6]) {
    if ((await screen(pg)) !== 'screenPlanDay') { await pg.evaluate(() => openPlanDay()); await settle(pg, 250); }
    await pg.click(boxSel(TODAY, i)); await settle(pg, GUARD_MS);
    await playTask(pg, false);
    if (i !== 6) { await pg.click('#planRunBack'); await settle(pg, GUARD_MS); }
  }
  const all = await pg.evaluate(() => { const b = byId('planRunBody'); const g = s => { const e = b.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }; return { scr: document.querySelector('.screen.active').id, res: g('.result-label'), sub: g('.result-sub') }; });
  ok(all.res === norm(await T(pg, 'plan.run.allDoneToday')) && all.sub === await T(pg, 'plan.run.allSubToday'), `[${L}] all done: "${all.res}" / "${all.sub}"`);
  await over('Result card (all done)', '#screenPlanRun'); await shot('result-alldone');
  await pg.evaluate(() => openPlanDay()); await settle(pg, 250);
  const dayDone = await pg.evaluate(() => document.querySelector('#screenPlanDay').innerText.replace(/\s+/g, ' '));
  ok(dayDone.includes(norm(await T(pg, 'plan.day.doneToday'))), `[${L}] day screen done line "${norm(await T(pg, 'plan.day.doneToday'))}"`);
  await over('day screen (done)', '#screenPlanDay');
  await pg.click('#screenPlanDay .back-btn'); await settle(pg, GUARD_MS);
  const cardDone = await txt(pg, '#planCard');
  const doneTxt = norm(stripTags(await T(pg, 'plan.home.doneHtml')));
  ok(cardDone && cardDone.includes(doneTxt), `[${L}] Home done: "${doneTxt}"`);
  await over('Home card (done)', '#planCard'); await shot('home-done', false);

  // 9 ended: the day after the exam
  const exam = await pg.evaluate(() => planLoad().goal.examDate);
  await pg.clock.setSystemTime(at(exam, '09:00:00')); await pg.evaluate(() => {});
  const nextDay = new Date(at(exam)); nextDay.setDate(nextDay.getDate() + 1);
  await pg.clock.setSystemTime(nextDay); await pg.reload(); await settle(pg, 500);
  const ended = await pg.evaluate(() => { const c = byId('planCard'); const tag = c && c.querySelector('.plan-home-top span, .plan-home-top'); return { all: c ? c.innerText.replace(/\s+/g, ' ').trim() : null }; });
  const endedTitle = await T(pg, 'plan.home.endedTitle');
  ok(ended.all && ended.all.includes(endedTitle), `[${L}] ended card: "${endedTitle}"`);
  const endedTag = await pg.evaluate(t0 => { const e = [...byId('planCard').querySelectorAll('span')].find(s => s.textContent === t0); if (!e) return null; const r = e.getBoundingClientRect(), lh = parseFloat(getComputedStyle(e).lineHeight) || 20; return { h: Math.round(r.height), lines: Math.round(r.height / lh) }; }, endedTitle);
  notes.push(`[${L}] ended title box ${JSON.stringify(endedTag)}`);
  await over('Home card (ended)', '#planCard'); await shot('home-ended', false);

  // 10 log broken: progress unreadable, back on a plan day
  await pg.clock.setSystemTime(at('2026-10-09')); await pg.evaluate(() => localStorage.setItem('lifeuk.studyPlanProgress', '{bad')); await pg.reload(); await settle(pg, 500);
  const broken = await txt(pg, '#planCard .plan-home-warn');
  ok(broken === await T(pg, 'plan.home.logBroken'), `[${L}] log broken: "${broken}"`);
  await over('Home card (log broken)', '#planCard'); await shot('home-logbroken', false);

  ok(errs.length === 0, `[${L}] no page errors / missing i18n keys${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

(async () => {
  const b = await chromium.launch(launchOpts);
  const s = await startPagesServer(ROOT);
  try { for (const lang of ['zh-HK', 'en']) await runLang(b, s.base, lang); }
  finally { s.server.kill(); await b.close(); }
  notes.forEach(n => console.log('note:', n));
  console.log(`\nQA PR7 browser: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
