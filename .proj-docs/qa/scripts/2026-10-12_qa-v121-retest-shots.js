// QA v1.2.1 re-test (CUI-0028): Study memo ③ cards (opened) -> element screenshots + fit numbers; same cards rendered as
// study-plan reading cards (#screenPlanRun, factCardHtml full variant) -> fit numbers.
// usage: node <this> <root> <w1,w2,..> <lang> <outDir|->
const { chromium } = require('playwright-core');
const fs = require('fs');
const ROOT = process.argv[2], WIDTHS = process.argv[3].split(',').map(Number), LANG = process.argv[4] || 'en', OUT = process.argv[5] || '-';
const IDS = ['118', '119', '120', '121', '123', '124', '127', '128', '129', '130'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  if (OUT !== '-') fs.mkdirSync(OUT, { recursive: true });
  for (const width of WIDTHS) {
    const pg = await b.newPage({ viewport: { width, height: 844 } });
    await pg.goto('file://' + ROOT + '/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload();
    await pg.evaluate(l => setLang(l), LANG);
    const measure = sel => pg.evaluate(({ sel, ids }) => ids.map(id => {
      const c = document.querySelector(`${sel} .fact[data-fact-id="${id}"]`); if (!c) return id + ':missing';
      const d = c.querySelector('details.fact-mem'); d.open = true; const w = d.querySelector('.note-table-wrap');
      const body = d.querySelector('.fact-mem-body').getBoundingClientRect(), tbl = w.querySelector('table').getBoundingClientRect();
      return `${id}:${w.scrollWidth}/${w.clientWidth}${w.scrollWidth > w.clientWidth || !w.clientWidth ? '!' : ''} gapL${Math.round(tbl.left - body.left)} gapR${Math.round(body.right - tbl.right)}`;
    }), { sel, ids: IDS });
    await pg.evaluate(() => { openStudy(); studySetTab('chapters'); studySetChapter(4); });
    const study = await measure('#studyContent');
    if (OUT !== '-') for (const id of IDS) {
      const el = await pg.$(`#studyContent .fact[data-fact-id="${id}"]`); await el.scrollIntoViewIfNeeded();
      await el.screenshot({ path: `${OUT}/study_f${id}_${LANG}_${width}.png` });
    }
    await pg.evaluate(ids => { showScreen('screenPlanRun');
      document.getElementById('planRunBody').innerHTML = ids.map(id => factCardHtml(planFactById(id), { variant: FACT_VARIANT.full, marks: factMarks(planFactById(id)), opts: {} })).join(''); }, IDS);
    const plan = await measure('#planRunBody');
    const docW = await pg.evaluate(() => document.documentElement.scrollWidth);
    console.log(LANG, width, 'docW', docW, '\n  study', study.join(' | '), '\n  plan ', plan.join(' | '));
    await pg.close();
  }
  await b.close();
})();
