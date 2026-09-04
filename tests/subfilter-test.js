const { chromium } = require('playwright-core');
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
  const count = () => pg.$eval('#studyCount', e => e.textContent);
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();
  await pg.click('#modeStudy');

  await pg.click('.study-tab[data-tab="geo"]');
  assert((await pg.$$('#studySubChips .chip')).length === 6, 'geo: All + 5 nation chips');
  assert((await count()) === '32 / 32 facts', 'geo All: ' + await count());
  await pg.click('#studySubChips >> text=Scotland');
  assert((await count()) === '6 / 6 facts', 'geo Scotland 6: ' + await count());
  assert((await pg.$$('.study-group-title')).length === 1, 'only Scotland group shown');
  await pg.screenshot({ path: 'shot-geo-sub.png' });
  await pg.fill('#studySearch', 'castle');
  assert(await pg.evaluate(() => document.getElementById('studyContent').textContent.includes('Edinburgh Castle')), 'search still finds within nation');
  await pg.fill('#studySearch', 'Tower');
  assert(await pg.evaluate(() => document.getElementById('studyContent').textContent.includes('Tower of London')), 'search ignores nation filter (England result while Scotland selected)');
  await pg.fill('#studySearch', '');

  await pg.click('.study-tab[data-tab="people"]');
  assert((await pg.$$('#studySubChips .chip')).length === 8, 'people: All + 7 group chips');
  await pg.click('#studySubChips >> text=作家');
  const names = await pg.$$eval('.fact-name', els => els.map(e => e.textContent));
  assert(names.length === 11 && names.includes('Charles Dickens') && names.includes('William Shakespeare'), 'writers 11: ' + names.join(', '));
  assert((await pg.$$('.study-group-title')).length === 1, 'only writers group shown');
  await pg.screenshot({ path: 'shot-people-sub.png' });

  await pg.click('.study-tab[data-tab="timeline"]');
  assert(await pg.$eval('#studySubChips', e => e.style.display === 'none'), 'timeline has no sub row');

  await pg.reload(); await pg.click('#modeStudy');
  await pg.click('.study-tab[data-tab="people"]');
  assert(await pg.$eval('#studySubChips .chip.active', e => e.textContent.includes('作家')), 'people group persisted');
  await pg.click('.study-tab[data-tab="geo"]');
  assert(await pg.$eval('#studySubChips .chip.active', e => e.textContent.includes('Scotland')), 'nation persisted');

  assert(errs.length === 0, 'no page errors: ' + errs.join(';'));
  await b.close(); console.log('SUBFILTER PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
