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
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear());
  await pg.reload();

  // home: chapter grid
  const counts = await pg.$$eval('#chapterGrid .ch-count', els => els.map(e => parseInt(e.textContent.split('/')[1])));
  assert(counts.length === 5 && counts.reduce((a, b) => a + b, 0) === 408, 'chapter grid 5 buttons, counts sum 408: ' + counts.join('/'));
  await pg.screenshot({ path: 'shot-home.png', fullPage: true });

  // chapter practice
  await pg.click('#ptabChapter');
  await pg.click('#chapterGrid .chapter-btn:nth-child(3)');
  assert(await pg.$eval('#quizLabel', e => e.textContent) === 'Chapter 3', 'chapter practice label');
  assert(await pg.$eval('#modeBadge', e => e.textContent) === 'Practice', 'chapter practice is practice mode');
  assert(await pg.evaluate(() => state.questions.length === 167 && state.questions.every(q => q.ch === 3)), 'chapter 3 has 167 questions, all ch3');
  assert(await pg.$eval('#examSubmitRow', e => e.style.display) === 'none', 'no submit row in chapter practice');
  // finish quickly: answer nothing, jump to last, finish -> no completedExams saved
  await pg.evaluate(() => { state.current = state.questions.length - 1; renderQuestion(); finishExam(); });
  assert(await pg.$eval('#resultLabel', e => e.textContent) === 'Chapter 3', 'result label chapter');
  assert(await pg.evaluate(() => !localStorage.getItem('completedExams')), 'chapter practice does not mark exams complete');
  await pg.click('text=Choose Another');

  // study screen
  await pg.click('#modeStudy');
  const count = () => pg.$eval('#studyCount', e => e.textContent);
  assert((await count()) === '2 / 2 facts', 'chapters tab default Ch1: ' + await count());
  await pg.click('#studySubChips .chip:nth-child(3)'); // Ch3
  assert((await count()) === '91 / 91 facts', 'Ch3 91 facts: ' + await count());
  await pg.screenshot({ path: 'shot-chapters.png' });

  await pg.click('.study-tab[data-tab="timeline"]');
  assert((await count()) === '82 / 82 facts', 'timeline 82: ' + await count());
  const eras = await pg.$$eval('.tl-era', els => els.map(e => e.firstChild.textContent.trim()));
  assert(eras[0].startsWith('Stone Age') && eras.includes('Tudors') && eras[eras.length - 1].startsWith('21st'), 'eras in order: ' + eras.join(' > '));
  const years = await pg.$$eval('.tl-year', els => els.map(e => e.textContent));
  assert(years[0] === 'c. 4000 BC' && years.includes('1066') && years.includes('1215'), 'year labels: ' + years.slice(0, 6).join(','));
  await pg.screenshot({ path: 'shot-timeline.png' });
  await pg.click('.chip.war');
  assert((await count()) === '24 / 24 facts', 'wars only 24: ' + await count());
  assert(await pg.$$eval('.tl-item', els => els.every(e => e.classList.contains('war'))), 'all items war');
  await pg.click('.chip.war');

  await pg.click('.study-tab[data-tab="geo"]');
  assert((await count()) === '32 / 32 facts', 'geo 32: ' + await count());
  const nations = await pg.$$eval('.study-group-title', els => els.map(e => e.textContent.trim().split(' ').slice(1).join(' ')));
  assert(nations.length === 5, 'geo 5 nation groups: ' + nations.join(' | '));
  await pg.screenshot({ path: 'shot-geo.png' });

  await pg.click('.study-tab[data-tab="people"]');
  assert((await count()) === '55 / 55 facts', 'people 55: ' + await count());
  const firstNames = await pg.$$eval('.fact-name', els => els.slice(0, 4).map(e => e.textContent));
  assert(firstNames[0] === 'Julius Caesar' && firstNames[1] === 'Boudicca', 'monarchs chronological: ' + firstNames.join(', '));
  await pg.screenshot({ path: 'shot-people.png' });

  // search
  await pg.click('.study-tab[data-tab="chapters"]');
  await pg.fill('#studySearch', 'Magna');
  assert((await count()) === '1 / 236 facts', 'search Magna across chapters: ' + await count());
  await pg.fill('#studySearch', '首相');
  const n = parseInt(await count());
  assert(n >= 5, 'cantonese search 首相 >=5: ' + n);
  await pg.fill('#studySearch', '');

  // bookmark + mastered
  await pg.click('#studySubChips .chip:nth-child(1)'); // Ch1
  await pg.locator('.fact').first().locator('.fact-btn.star').click();
  await pg.locator('.fact').first().locator('.fact-btn.tick').click();
  assert(await pg.locator('.fact').first().evaluate(e => e.classList.contains('mastered')), 'mastered class applied');
  assert(await pg.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('studyMastered'))).length === 1 && Object.keys(JSON.parse(localStorage.getItem('studyBookmarks'))).length === 1), 'persisted in localStorage');
  await pg.click('text=隱藏已掌握');
  assert((await count()) === '1 / 2 facts', 'hide mastered: ' + await count());
  await pg.click('text=隱藏已掌握');
  await pg.click('text=只顯示書籤');
  assert((await count()) === '1 / 2 facts', 'bookmarks only: ' + await count());
  await pg.click('.study-tab[data-tab="people"]');
  assert((await count()) === '0 / 55 facts', 'bookmarks only carries across tabs: ' + await count());
  assert(await pg.$eval('#studyContent', e => e.textContent.includes('No facts match')), 'empty state shown');
  await pg.click('text=只顯示書籤');

  // prefs persist across reload
  await pg.reload();
  await pg.click('#modeStudy');
  assert(await pg.$eval('.study-tab.active', e => e.dataset.tab) === 'people', 'tab persisted after reload');
  await pg.click('.back-btn');
  assert(await pg.$eval('#screenHome', e => e.classList.contains('active')), 'back to home');

  assert(errs.length === 0, 'no page errors: ' + errs.join(';'));
  await b.close();
  console.log('STUDY PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
