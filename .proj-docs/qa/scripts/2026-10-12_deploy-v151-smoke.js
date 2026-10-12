// Deploy smoke v1.5.1: serve `git archive 40e310d` over http (python3 -m http.server), then
//   NODE_PATH=/opt/node-tools/node_modules node .proj-docs/qa/scripts/2026-10-12_deploy-v151-smoke.js http://127.0.0.1:8791/ <shot-dir>
const { chromium } = require('playwright-core');
const URL = process.argv[2], SHOTS = process.argv[3];
let pass = 0, fail = 0; const ok = (c, m, x) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x) : '')); };
const TEXT = { en: { cont: 'Continue →', sched: 'Schedule', tmrw: 'See you tomorrow' }, 'zh-HK': { cont: '繼續 →', sched: '進度表', tmrw: '明日再來' } };

// Seed a plan starting 2026-09-28 (today = Day 4, 2026-10-01). full=false: Day 4 partly done; full=true: Day 4 all done.
const seed = async (p, lang, full) => {
  await p.evaluate(([lang, full]) => {
    localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); localStorage.setItem('lifeuk.uiLang', JSON.stringify(lang));
    const plan = buildPlan({ examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' }, '2026-09-28'); writeStudyPlan(plan);
    const okm = l => Object.fromEntries(l.map(k => [k, 1])); const q = d => d.tasks.flatMap(planTaskQids);
    const [d1, d2, d3, d4] = plan.days;
    const d4ok = full ? q(d4) : d4.tasks[1].qids.slice(0, 20);
    writePlanLog({ v: 1, days: { [d1.date]: { ok: okm(q(d1)) }, [d2.date]: { ok: okm(q(d2)) }, [d3.date]: { ok: okm(q(d3)) }, [d4.date]: { ok: okm(d4ok) } } });
  }, [lang, full]);
  await p.reload(); await p.waitForTimeout(400);
};
const card = p => p.evaluate(() => { const h = document.querySelector('#planCard .plan-home'); return h && {
  hasRing: h.classList.contains('has-ring'), ringInHead: !!h.querySelector('.plan-home-head .plan-home-ring'),
  pct: (h.querySelector('.plan-home-ring-pct') || {}).textContent, text: h.textContent.replace(/\s+/g, ' ').trim(),
  btns: [...h.querySelectorAll('.plan-home-acts button')].map(x => x.textContent.trim()),
  hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth }; });

(async () => {
  const b = await chromium.launch();
  for (const lang of ['en', 'zh-HK']) {
    const T = TEXT[lang];
    const c = await b.newContext({ viewport: { width: 390, height: 900 } }); const p = await c.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await p.clock.setFixedTime(new Date('2026-10-01T09:00:00'));
    await p.goto(URL);
    const ver = await p.evaluate(() => APP_VERSION); ok(ver === '1.5.1', `[${lang}] APP_VERSION 1.5.1`, ver);
    const reg = await p.evaluate(async () => { await navigator.serviceWorker.ready; await new Promise(r => setTimeout(r, 800)); return (await caches.keys()).filter(k => k.startsWith('lifeuk-v')); });
    ok(reg.includes('lifeuk-v1.5.1'), `[${lang}] SW cache lifeuk-v1.5.1`, reg);

    await seed(p, lang, false);
    const r = await card(p);
    ok(r && r.hasRing, `[${lang}] in-progress .plan-home.has-ring`, r && r.pct);
    ok(r && r.ringInHead, `[${lang}] .plan-home-ring inside .plan-home-head`);
    ok(r && r.btns.includes(T.cont) && r.btns.includes(T.sched), `[${lang}] buttons ${T.cont} + ${T.sched}`, r && r.btns);
    ok(r && !r.hscroll, `[${lang}] in-progress no horizontal scroll`);
    await p.screenshot({ path: `${SHOTS}/home-${lang}-progress.png` });

    await seed(p, lang, true);
    const d = await card(p);
    ok(d && d.pct === '✓' && d.text.includes(T.tmrw), `[${lang}] 100% card "${T.tmrw}" + ✓`, d && { pct: d.pct, text: d.text });
    ok(d && !d.hscroll, `[${lang}] 100% no horizontal scroll`);
    await p.screenshot({ path: `${SHOTS}/home-${lang}-done.png` });

    ok(errs.length === 0, `[${lang}] no page/console errors`, errs);
    await c.close();
  }
  await b.close(); console.log(`\n${pass} pass / ${fail} fail`); process.exit(fail ? 1 : 0);
})();
