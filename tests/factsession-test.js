const { chromium } = require('playwright-core');
const path = require('path');
// v0.62 (P3 Lane C2): fact → source questions session engine (no entry button yet; PR-3 adds it).
// Set id FACT_PREFIX + id ('f21', header "Fact #21"); startFactPractice(id) runs f.src once each in Practice,
// whatever the Home mode; last question "↩ Back" returns to Study with tab / chip / search / scroll restored.
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

// set ids: 'f21' is a fact set, 'flagged' (also starts with "f") is not
async function checkSetIds(pg) {
  const ids = await pg.evaluate(() => ({
    fact: isFactExam('f21'), flagged: isFactExam(FLAGGED_EXAM), num: isFactExam(21), id: factIdOf('f21'),
    label: examLabel(FACT_PREFIX + 21), flaggedLabel: examLabel(FLAGGED_EXAM),
  }));
  assert(ids.fact && !ids.flagged && !ids.num, `isFactExam: 'f21' yes, 'flagged' / 21 no (${JSON.stringify(ids)})`);
  assert(ids.id === 21, `factIdOf('f21') === 21 (${ids.id})`);
  assert(ids.label === 'Fact #21' && ids.flaggedLabel === 'Flagged', `examLabel: Fact #21 / Flagged (${ids.label} / ${ids.flaggedLabel})`);
}

(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear());
  await pg.reload();
  await checkSetIds(pg);
  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join('; ') : ''));
  await b.close();
  console.log('FACTSESSION PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
