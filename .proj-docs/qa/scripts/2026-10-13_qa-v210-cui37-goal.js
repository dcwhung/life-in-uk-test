// QA CUI-0037 Problem A — independent drive, today fixed to 2026-10-13 (Tuesday)
const { chromium } = require('playwright-core');
const path = require('path');
const APP = process.env.APP_URL || 'file://' + path.resolve('/home/user/life-in-uk-test/index.html');
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
require('fs').mkdirSync(SHOTS, { recursive: true });
const TODAY = '2026-10-13';
const add = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const VPS = [{ width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }];
let fails = 0, oks = 0;
const check = (c, m) => { if (c) { oks++; } else { fails++; console.log('FAIL:', m); } };

const form = pg => pg.evaluate(() => {
  const btn = byId('planCreateBtn'), hint = byId('planGoalHint'), msg = byId('planFeasMsg'), note = byId('planDateNote');
  const vis = e => !!e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  return { exam: planGoalDraft.examDate, field: byId('planExamDate').value, min: byId('planExamDate').min, study: byId('planFeasDays').textContent,
    disabled: btn.disabled, btnText: btn.textContent.trim(), hint: vis(hint) ? hint.textContent : null, msg: vis(msg) && msg.textContent ? msg.textContent : null,
    noteVis: vis(note), noteText: note ? note.textContent : '', body: document.querySelector('#screenPlanGoal').innerText };
});
const pick = async (pg, iso) => { await pg.fill('#planExamDate', iso); await pg.click('#planDaysVal'); };
const setRest = async (pg, days) => {
  await pg.evaluate(want => {
    [...byId('planRestChips').children].forEach(b => { const on = b.getAttribute('aria-pressed') === 'true'; if (on !== want.includes(Number(b.dataset.arg))) b.click(); });
  }, days);
};

async function open(b, vp, lang, mode, seed) {
  const ctx = await b.newContext({ viewport: vp });
  const pg = await ctx.newPage();
  await pg.clock.setFixedTime(new Date(TODAY + 'T09:00:00'));
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(APP);
  await pg.evaluate(l => { localStorage.clear(); localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); }, lang);
  await pg.goto(APP);
  if (seed) await pg.evaluate(s => { writeStudyPlan(buildPlan(s.goal, s.start)); }, seed);
  if (mode === 'new') {
    await pg.evaluate(() => openPlanGoal());
  } else {
    await pg.evaluate(() => openPlanSchedule());
    await pg.click('#screenPlanSchedule [data-action="planEditGoal"]');
  }
  return { pg, ctx, errs };
}

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  const MIN = add(TODAY, 7);
  for (const vp of VPS) for (const lang of ['en', 'zh-HK']) for (const mode of ['new', 'edit']) {
    const tag = `${vp.width}x${vp.height} ${lang} ${mode}`;
    const seed = mode === 'edit' ? { goal: { examDate: '2026-11-03', dailyMins: 120, restDays: [0], level: 'none' }, start: '2026-10-06' } : null;
    const { pg, ctx, errs } = await open(b, vp, lang, mode, seed);
    let f = await form(pg);
    check(await pg.evaluate(() => document.querySelector('.screen.active').id) === 'screenPlanGoal', `${tag}: goal screen open`);
    check(f.min === MIN, `${tag}: min ${f.min} == today+7 ${MIN}`);
    check(!f.noteVis && f.noteText === '', `${tag}: no date note`);
    check(!/明日|tomorrow/i.test(f.body), `${tag}: no "tomorrow/明日" text in goal screen`);
    const start = f.exam;
    for (const n of [1, 3, 6]) { await pick(pg, add(TODAY, n)); f = await form(pg); check(f.exam === start, `${tag}: today+${n} rejected (exam=${f.exam})`); }
    await setRest(pg, []);
    await pick(pg, MIN); f = await form(pg);
    check(f.exam === MIN && f.study === '7' && !f.disabled && f.hint === null, `${tag}: today+7, no rest → 7 study days, enabled: ${JSON.stringify({ s: f.study, d: f.disabled, h: f.hint })}`);
    await setRest(pg, [3]); f = await form(pg);
    check(f.study === '6' && f.disabled && f.hint && !f.msg, `${tag}: rest day → 6 study days disabled + hint: ${JSON.stringify({ s: f.study, d: f.disabled, h: f.hint, m: f.msg })}`);
    check(!/anyway|照樣/.test(f.body), `${tag}: no "build anyway" text with <7 days`);
    if (f.hint) {
      const hv = await pg.$eval('#planGoalHint', e => { e.scrollIntoView({ block: 'center' }); const r2 = e.getBoundingClientRect(); return r2.height > 0 && r2.width > 0; });
      check(hv, `${tag}: hint has a box`);
      const want = mode === 'new' ? (lang === 'en' ? 'Fewer than 7 study days' : '溫習日少於 7 日') : (lang === 'en' ? 'At least 7 study days' : '考試前最少需要 7 個溫習日');
      check(f.hint.includes(want), `${tag}: hint text "${f.hint}" contains "${want}"`);
    }
    await pg.screenshot({ path: path.join(SHOTS, `A-${mode}-${vp.width}-${lang}-blocked.png`) });
    const before = await pg.evaluate(() => localStorage.getItem(STUDY_PLAN_LS));
    await pg.click('#planCreateBtn', { force: true, timeout: 2000 }).catch(() => {});
    await pg.evaluate(() => planCreate());
    check(await pg.evaluate(() => localStorage.getItem(STUDY_PLAN_LS)) === before && await pg.evaluate(() => document.querySelector('.screen.active').id) === 'screenPlanGoal', `${tag}: forced Build/Update with 6 study days stores nothing`);
    await setRest(pg, [1, 3]); await pick(pg, add(TODAY, 8)); f = await form(pg);
    check(f.study === '6' && f.disabled, `${tag}: today+8 with 2 rest days → 6 disabled (${f.study})`);
    await setRest(pg, [3]); f = await form(pg);
    check(f.study === '7' && !f.disabled && f.hint === null, `${tag}: today+8 with 1 rest → 7 enabled (${f.study})`);
    await pick(pg, '2026-10-16'); f = await form(pg);
    check(f.exam !== '2026-10-16', `${tag}: iPad repro 3 days ahead rejected`);
    await pg.click('#planCreateBtn');
    const stored = await pg.evaluate(() => { const p = planLoad(); return p && p.goal.examDate; });
    check(stored === add(TODAY, 8) && await pg.evaluate(() => document.querySelector('.screen.active').id) === 'screenPlanSchedule', `${tag}: valid Build/Update stores exam ${stored}`);
    check(errs.length === 0, `${tag}: no page errors ${errs.join('|')}`);
    await ctx.close();
  }
  for (const vp of VPS) for (const lang of ['en', 'zh-HK']) {
    for (const n of [0, 1, 3, 6]) {
      const tag = `${vp.width} ${lang} stored exam today+${n}`;
      const { pg, ctx, errs } = await open(b, vp, lang, 'edit', { goal: { examDate: add(TODAY, n), dailyMins: 120, restDays: [], level: 'none' }, start: '2026-10-01' });
      const f = await form(pg);
      if (n === 0) check(f.exam === MIN && f.field === MIN && !f.disabled, `${tag}: moved to today+7, enabled: ${JSON.stringify({ e: f.exam, d: f.disabled })}`);
      else check(f.exam === add(TODAY, n) && f.field === add(TODAY, n) && f.study === String(n) && f.disabled && f.hint && !f.msg, `${tag}: kept, blocked + hint: ${JSON.stringify({ e: f.exam, s: f.study, d: f.disabled, h: f.hint, m: f.msg })}`);
      if (n === 3) await pg.screenshot({ path: path.join(SHOTS, `A-window3-${vp.width}-${lang}.png`) });
      check(errs.length === 0, `${tag}: no page errors ${errs.join('|')}`);
      await ctx.close();
    }
  }
  await b.close();
  console.log(`A: ${oks} ok, ${fails} fail`);
  process.exitCode = fails ? 1 : 0;
})();
