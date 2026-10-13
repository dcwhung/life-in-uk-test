// QA CUI-0038 B1/B2/B3 — independent drive, today fixed 2026-10-13
const { chromium } = require('playwright-core');
const path = require('path');
const APP = 'file://' + path.resolve('/home/user/life-in-uk-test/index.html');
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
require('fs').mkdirSync(SHOTS, { recursive: true });
const TODAY = '2026-10-13';
let fails = 0, oks = 0;
const check = (c, m) => { if (c) oks++; else { fails++; console.log('FAIL:', m); } };
const near = (a, b, s = 1) => Math.abs(a - b) <= s;
const TWO = { examDate: '2026-10-20', dailyMins: 30, restDays: [], level: 'none' };
const THREE = { examDate: '2026-11-03', dailyMins: 120, restDays: [0], level: 'none' };

async function open(b, vp, lang, goal, start = TODAY) {
  const ctx = await b.newContext({ viewport: vp });
  const pg = await ctx.newPage();
  await pg.clock.setFixedTime(new Date(TODAY + 'T09:00:00'));
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(APP);
  await pg.evaluate(l => { localStorage.clear(); localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); }, lang);
  await pg.goto(APP);
  await pg.evaluate(([g, s]) => { writeStudyPlan(buildPlan(g, s)); openPlanSchedule(); }, [goal, start]);
  return { pg, ctx, errs };
}
const look = pg => pg.evaluate(() => {
  const bar = byId('planPhaseBar'), br = bar.getBoundingClientRect(), strat = byId('planStrategy');
  const cards = [...strat.querySelectorAll('.plan-strat')].map(c => c.getBoundingClientRect());
  const segs = [...bar.children].map(c => c.getBoundingClientRect());
  const legend = byId('planPhaseLegend') || document.querySelector('#screenPlanSchedule .plan-legend');
  const btn = byId('planPhasesToggle');
  return { segs: segs.map(r => [r.left, r.right]), cards: cards.map(r => [r.left, r.right, r.top, r.width]), bar: [br.left, br.right],
    cols: getComputedStyle(strat).gridTemplateColumns, stratHidden: strat.hidden,
    legendSw: [...legend.querySelectorAll('i')].map(i => i.className), legendTxt: legend.innerText.replace(/\s+/g, ' ').trim(),
    legendI18n: [...legend.querySelectorAll('[data-i18n]')].map(e => e.dataset.i18n),
    title: btn.textContent.trim(), exp: btn.getAttribute('aria-expanded'), sw: document.documentElement.scrollWidth, iw: innerWidth };
});

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  // phase-shape survey: which goals give 1/2/3 phases
  {
    const { pg, ctx } = await open(b, { width: 390, height: 844 }, 'en', THREE);
    const survey = await pg.evaluate(() => {
      const out = {};
      for (const days of [7, 8, 9, 10, 12, 14, 21, 28, 42]) for (const mins of [30, 60, 120]) for (const level of ['none', 'some', 'exam']) {
        const p = buildPlan({ examDate: isoAddDays(planTodayIso(), days), dailyMins: mins, restDays: [], level }, planTodayIso());
        const ph = [...new Set(p.days.map(d => d.phase))].filter(x => x !== 'rest' && x !== 'exam').join('+');
        (out[ph] = out[ph] || []).push(`${days}d/${mins}m/${level}`);
      }
      return out;
    });
    for (const k in survey) console.log('phases', k, survey[k].length, survey[k].slice(0, 6).join(' '));
    await ctx.close();
  }
  // B1 desktop
  for (const vp of [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    for (const lang of ['en', 'zh-HK']) for (const [name, goal, n] of [['2ph', TWO, 2], ['3ph', THREE, 3]]) {
      const tag = `${vp.width} ${lang} ${name}`;
      const { pg, ctx, errs } = await open(b, vp, lang, goal, name === '3ph' ? '2026-10-06' : TODAY);
      const l = await look(pg);
      check(l.segs.length === n && l.cards.length === n && l.cols.split(' ').length === n, `${tag}: ${n} segs/cards/cols ${JSON.stringify([l.segs.length, l.cards.length, l.cols])}`);
      check(near(l.cards[0][0], l.bar[0]) && near(l.cards[n - 1][1], l.bar[1]), `${tag}: cards edges align with bar ±1 (${l.cards[0][0]}/${l.bar[0]}, ${l.cards[n - 1][1]}/${l.bar[1]})`);
      check(l.cards.every(c => near(c[3], l.cards[0][3]) && near(c[2], l.cards[0][2])), `${tag}: cards equal width, same row`);
      check(l.sw <= l.iw, `${tag}: no horizontal scroll`);
      check(errs.length === 0, `${tag}: errors ${errs.join('|')}`);
      await pg.screenshot({ path: path.join(SHOTS, `B-${name}-${vp.width}-${lang}.png`) });
      await pg.$eval('#planPhasesToggle', e => e.scrollIntoView({ block: 'start' }));
      await pg.screenshot({ path: path.join(SHOTS, `B-${name}-${vp.width}-${lang}-phases.png`) });
      await ctx.close();
    }
  }
  // B2/B3 at 390 + 1280, language switch via ⚙, fold
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    for (const lang of ['en', 'zh-HK']) {
      const tag = `${vp.width} ${lang}`;
      const { pg, ctx, errs } = await open(b, vp, lang, TWO);
      let l = await look(pg);
      const expTitle = lang === 'en' ? 'Two phases' : '兩個階段';
      check(JSON.stringify(l.legendSw) === '["plan-bg-learn","plan-bg-mock"]', `${tag}: legend learn+mock only ${JSON.stringify(l.legendSw)}`);
      check(!/Drill|操練|專項/.test(l.legendTxt), `${tag}: legend text has no Drill: "${l.legendTxt}"`);
      check(l.title === expTitle, `${tag}: title "${l.title}"`);
      await pg.screenshot({ path: path.join(SHOTS, `B23-${vp.width}-${lang}.png`), fullPage: vp.width === 390 });
      // language switch via settings
      await pg.click('#settingsBtn'); await pg.click('#settingsLangRow [aria-pressed="false"]');
      await pg.keyboard.press('Escape').catch(() => {});
      l = await look(pg);
      const other = lang === 'en' ? '兩個階段' : 'Two phases';
      check(l.title === other && l.legendSw.length === 2 && !/Drill/.test(l.legendTxt), `${tag}: after ⚙ switch title "${l.title}" legend "${l.legendTxt}"`);
      const legendWant = await pg.evaluate(() => [t('plan.phase.learn'), t('plan.phase.mock')].join(' '));
      check(l.legendTxt.includes(legendWant.split(' ')[0]), `${tag}: legend in switched lang "${l.legendTxt}" vs ${legendWant}`);
      // fold
      await pg.evaluate(() => { const s = document.querySelector('.screen.active'); });
      const isOpen = await pg.$eval('#planPhasesToggle', e => e.getAttribute('aria-expanded'));
      await pg.click('#planPhasesToggle');
      l = await look(pg);
      check(l.exp !== isOpen && l.title === other, `${tag}: fold toggled ${isOpen}→${l.exp}, title kept`);
      await pg.screenshot({ path: path.join(SHOTS, `B23-${vp.width}-${lang}-folded.png`) });
      await pg.click('#planPhasesToggle');
      l = await look(pg);
      check(l.exp === isOpen, `${tag}: fold back`);
      if (vp.width >= 1024 && !l.stratHidden) check(near(l.cards[0][0], l.bar[0]) && near(l.cards[1][1], l.bar[1]), `${tag}: after toggles still aligned`);
      // switch back + reload persists
      await pg.reload(); await pg.evaluate(() => openPlanSchedule());
      l = await look(pg);
      check(l.legendSw.length === 2 && l.title === other, `${tag}: after reload ${l.title}`);
      // resize desktop<->phone keeps alignment
      if (vp.width >= 1024) {
        // a second open of the same plan starts folded by design (planInitFolds): expand before measuring
        if (await pg.$eval('#planPhasesToggle', e => e.getAttribute('aria-expanded')) === 'false') await pg.click('#planPhasesToggle');
        await pg.setViewportSize({ width: 1023, height: 768 }); l = await look(pg);
        check(l.cols.split(' ').length === 1, `${tag}: 1023 single col (${l.cols})`);
        await pg.setViewportSize({ width: 1440, height: 900 }); await pg.waitForTimeout(150); l = await look(pg);
        check(near(l.cards[0][0], l.bar[0]) && near(l.cards[1][1], l.bar[1]), `${tag}: resized to 1440 aligned`);
      }
      check(errs.length === 0, `${tag}: errors ${errs.join('|')}`);
      await ctx.close();
    }
  }
  // 3-phase legend/title regression 390 + 1280
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) for (const lang of ['en', 'zh-HK']) {
    const { pg, ctx, errs } = await open(b, vp, lang, THREE, '2026-10-06');
    const l = await look(pg);
    check(l.legendSw.length === 3 && l.title === (lang === 'en' ? 'Three phases' : '三個階段'), `${vp.width} ${lang} 3ph: legend ${l.legendSw} title ${l.title}`);
    check(errs.length === 0, 'errs');
    await ctx.close();
  }
  // plan transitioning: a 3-phase plan replanned (Change goal) to 2-phase updates title/legend without reload
  {
    const { pg, ctx, errs } = await open(b, { width: 1280, height: 800 }, 'en', THREE, '2026-10-06');
    await pg.click('#screenPlanSchedule [data-action="planEditGoal"]');
    await pg.evaluate(() => { [...byId('planRestChips').children].forEach(b => { if (b.getAttribute('aria-pressed') === 'true') b.click(); }); });
    await pg.fill('#planExamDate', '2026-10-20'); await pg.click('#planDaysVal');
    await pg.evaluate(() => planSetMins && planSetMins(30));
    const dis = await pg.$eval('#planCreateBtn', e => e.disabled);
    if (!dis) { await pg.click('#planCreateBtn'); }
    const l = await look(pg);
    const ph = await pg.evaluate(() => [...new Set(planLoad().days.filter(d => d.date >= planTodayIso()).map(d => d.phase))]);
    console.log('replan 3→? phases (future):', ph, 'segs', l.segs.length, 'title', l.title, 'legend', l.legendSw);
    check(l.segs.length === l.legendSw.length && l.cards.length === l.segs.length, `replan: bar/legend/cards counts agree ${l.segs.length}/${l.legendSw.length}/${l.cards.length}`);
    check(errs.length === 0, 'replan errs ' + errs.join('|'));
    await pg.screenshot({ path: path.join(SHOTS, `B-replan-1280.png`) });
    await ctx.close();
  }
  await b.close();
  console.log(`B: ${oks} ok, ${fails} fail`);
  process.exitCode = fails ? 1 : 0;
})();
