// Deploy smoke v1.5.0: serve `git archive a191835` over http (python3 -m http.server), then
//   NODE_PATH=/opt/node-tools/node_modules node .proj-docs/qa/scripts/2026-10-12_deploy-v150-smoke.js http://127.0.0.1:8765/ <shot-dir>
const { chromium } = require('playwright-core');
const URL = process.argv[2];
let pass = 0, fail = 0; const ok = (c, m, x) => { c ? pass++ : fail++; console.log((c ? 'ok   ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x) : '')); };
(async () => {
  const b = await chromium.launch();
  for (const lang of ['en', 'zh-HK']) {
    const c = await b.newContext({ viewport: { width: 390, height: 900 } }); const p = await c.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await p.clock.setFixedTime(new Date('2026-10-01T09:00:00'));
    await p.goto(URL);
    const ver = await p.evaluate(() => APP_VERSION); ok(ver === '1.5.0', 'APP_VERSION 1.5.0', ver);
    const reg = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; await new Promise(r => setTimeout(r, 800)); return (await caches.keys()).filter(k => k.startsWith('lifeuk-v')); });
    ok(reg.includes('lifeuk-v1.5.0'), 'SW cache lifeuk-v1.5.0', reg);
    await p.evaluate(lang => {
      localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); localStorage.setItem('lifeuk.uiLang', JSON.stringify(lang));
      const plan = buildPlan({ examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' }, '2026-09-28'); writeStudyPlan(plan);
      const okm = l => Object.fromEntries(l.map(k => [k, 1])); const q = d => d.tasks.filter(t => t.type !== 'review').flatMap(planTaskQids);
      const [d1, d2, d3, d4] = plan.days; const p4 = d4.tasks[1].qids;
      writePlanLog({ v: 1, days: { [d1.date]: { ok: okm(q(d1)) }, [d2.date]: { ok: okm(q(d2)) }, [d3.date]: { ok: okm(q(d3)) }, [d4.date]: { ok: okm(p4.slice(0, 20)) } } });
    }, lang);
    await p.reload(); await p.waitForTimeout(400);
    const r = await p.evaluate(() => { const h = document.querySelector('#planCard .plan-home'); return h && {
      ring: !!h.querySelector('.plan-home-ring'), pct: (h.querySelector('.plan-home-ring-pct') || {}).textContent,
      btns: [...h.querySelectorAll('.plan-home-acts button')].map(x => x.textContent.trim()),
      hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth }; });
    ok(r && r.ring, `[${lang}] .plan-home-ring present`, r);
    ok(r && r.btns.includes(lang === 'en' ? 'Continue →' : '繼續 →'), `[${lang}] Continue button`, r && r.btns);
    ok(r && !r.hscroll, `[${lang}] no horizontal scroll`);
    await p.screenshot({ path: `${process.argv[3]}/home-${lang}.png` });
    ok(errs.length === 0, `[${lang}] no page/console errors`, errs);
    await c.close();
  }
  await b.close(); console.log(`\n${pass} pass / ${fail} fail`); process.exit(fail ? 1 : 0);
})();
