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
  const tokenRgb = name => pg.evaluate(n => {
    const el = document.createElement('i');
    el.style.color = `var(${n})`;
    document.body.appendChild(el);
    const c = getComputedStyle(el).color;
    el.remove();
    return c;
  }, name);
  const css = (sel, prop) => pg.$eval(sel, (e, p) => getComputedStyle(e)[p], prop);
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear());
  await pg.reload();

  // home: chapter grid
  const counts = await pg.$$eval('#chapterGrid .ch-count', els => els.map(e => parseInt(e.textContent.split('/')[1])));
  assert(counts.length === 5 && counts.reduce((a, b) => a + b, 0) === 408, 'chapter grid 5 buttons, counts sum 408: ' + counts.join('/'));
  await pg.screenshot({ path: 'shot-home.png', fullPage: true });

  // chapter practice
  await pg.click('#ptabChapter');
  assert(await css('#chapterGrid .ch-num', 'backgroundColor') === await tokenRgb('--study-accent-strong'), 'Home chapter badge is study accent (Q2-a)');
  await pg.click('#chapterGrid .chapter-btn:nth-child(3)');
  assert(await pg.$eval('#quizLabel', e => e.textContent) === 'Chapter 3', 'chapter practice label');
  assert(await pg.$eval('#modeBadge', e => e.textContent) === 'Practice', 'chapter practice is practice mode');
  assert(await pg.evaluate(() => chapterQuestions(3).length === 167 && state.questions.length === 24 && state.questions.every(q => q.ch === 3)), 'chapter 3 has 167 questions; round of 24, all ch3');
  assert((await pg.$eval('#nextBtn', e => e.textContent)) !== 'Submit', 'no Submit in chapter practice');
  // finish quickly: answer nothing, jump to last, finish -> no completedExams saved
  await pg.evaluate(() => { state.current = state.questions.length - 1; renderQuestion(); finishExam(); });
  assert(await pg.$eval('#resultLabel', e => e.textContent) === 'Chapter 3', 'result label chapter');
  assert(await pg.evaluate(() => !localStorage.getItem('lifeuk.completedExams')), 'chapter practice does not mark exams complete');
  await pg.click('#screenResult .another-btn >> nth=0');

  // study screen
  await pg.click('#modeStudy');
  const count = () => pg.$eval('#studyCount', e => e.textContent);
  assert((await count()) === '2 / 2 facts', 'chapters tab default Ch1: ' + await count());

  // v0.62 (P3 T-101): selection colour is navy like Practice; purple only means Cantonese
  const navy = await tokenRgb('--navy');
  assert(await css('.study-tab.active', 'backgroundColor') === navy, 'active study tab is navy');
  assert(await css('#studySubChips .chip.ch.active', 'backgroundColor') === navy, 'active chapter chip is navy');
  await pg.focus('#studySearch');
  assert(await css('#studySearch', 'borderTopColor') === await tokenRgb('--navy-light'), 'search focus border is navy-light');
  await pg.$eval('#studySearch', e => e.blur());
  await pg.click('#studySubChips .chip:nth-child(3)'); // Ch3
  assert((await count()) === '91 / 91 facts', 'Ch3 91 facts: ' + await count());
  await pg.screenshot({ path: 'shot-chapters.png' });
  assert(await css('.tag.year', 'color') === await tokenRgb('--study-accent-strong') && await css('.tag.year', 'backgroundColor') === await tokenRgb('--study-accent-bg'), 'year tag uses study accent tokens');

  await pg.click('.study-tab[data-tab="timeline"]');
  assert((await count()) === '82 / 82 facts', 'timeline 82: ' + await count());
  const eras = await pg.$$eval('.tl-era', els => els.map(e => e.firstChild.textContent.trim()));
  assert(eras[0].startsWith('Stone Age') && eras.includes('Tudors') && eras[eras.length - 1].startsWith('21st'), 'eras in order: ' + eras.join(' > '));
  const years = await pg.$$eval('.tl-year', els => els.map(e => e.textContent));
  assert(years[0] === 'c. 4000 BC' && years.includes('1066') && years.includes('1215'), 'year labels: ' + years.slice(0, 6).join(','));
  await pg.screenshot({ path: 'shot-timeline.png' });
  // v0.62 (P3 T-102, Q2-a): decoration is the navy --study-accent (fact border, year, dot); war stays red
  const accent = await tokenRgb('--study-accent');
  assert(accent === await tokenRgb('--navy-light'), '--study-accent is navy-light');
  assert(await css('.tl-item:not(.war) .tl-year', 'color') === accent, 'timeline year is study accent');
  assert(await pg.$eval('.tl-item:not(.war) .tl-year', e => getComputedStyle(e, '::after').backgroundColor) === accent, 'timeline dot is study accent');
  assert(await css('.tl-item:not(.war) .fact', 'borderLeftColor') === accent, 'fact left border is study accent');
  assert(await css('.tl-item.war .tl-year', 'color') === await tokenRgb('--red'), 'war year stays red');
  await pg.click('.chip.war');
  assert((await count()) === '24 / 24 facts', 'wars only 24: ' + await count());
  assert(await pg.$$eval('.tl-item', els => els.every(e => e.classList.contains('war'))), 'all items war');
  await pg.click('.chip.war');

  await pg.click('.study-tab[data-tab="geo"]');
  assert((await count()) === '32 / 32 facts', 'geo 32: ' + await count());
  const nations = await pg.$$eval('.study-group-title', els => els.map(e => e.textContent.trim().split(' ').slice(1).join(' ')));
  assert(nations.length === 5, 'geo 5 nation groups: ' + nations.join(' | '));
  await pg.screenshot({ path: 'shot-geo.png' });
  assert(await css('.study-sub-title', 'color') === accent, 'geography sub-title is study accent');

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
  // v0.62 (P3 T-104): bookmark is the Practice flag SVG — outline muted, on = orange fill; no ☆ / ★ text
  const bmBtn = pg.locator('.fact').first().locator('.fact-btn.star');
  const bmPath = () => bmBtn.locator('svg path').evaluate(e => ({ fill: getComputedStyle(e).fill, stroke: getComputedStyle(e).stroke }));
  const orange = await tokenRgb('--orange');
  assert((await bmBtn.textContent()).trim() === '' && await bmBtn.locator('svg[aria-hidden="true"] path').count() === 1, 'bookmark button is a decorative SVG, no star text');
  const offPath = await bmPath();
  assert(offPath.fill === 'none' && offPath.stroke === await tokenRgb('--text-muted'), 'bookmark off: outline in text-muted: ' + JSON.stringify(offPath));
  const bmChip = pg.locator('#studyChips .chip[data-arg="bookmarksOnly"]');
  assert(await bmChip.locator('svg.chip-flag path').count() === 1 && (await bmChip.textContent()).trim() === 'Bookmarked only', 'Bookmarked only chip has the flag SVG and no ★');
  // v0.62 (P3 T-105, O1 / O2): labelled toggle buttons with aria-pressed; 32px box, 44px hit area
  const tickBtn = pg.locator('.fact').first().locator('.fact-btn.tick');
  const aria = loc => loc.evaluate(e => [e.getAttribute('aria-label'), e.getAttribute('aria-pressed')].join('|'));
  assert(await aria(bmBtn) === 'Bookmark|false' && await aria(tickBtn) === 'Mastered|false', 'fact buttons: aria-label + aria-pressed=false');
  const hit = await bmBtn.evaluate(e => {
    const r = e.getBoundingClientRect();
    const HIT_OFFSET = 5; // inside the 6px ::before ring, outside the 32px box
    const at = (x, y) => document.elementFromPoint(x, y)?.closest('.fact-btn') === e;
    return { w: r.width, h: r.height, top: at(r.left + r.width / 2, r.top - HIT_OFFSET), left: at(r.left - HIT_OFFSET, r.top + r.height / 2) };
  });
  assert(hit.w === 32 && hit.h === 32 && hit.top && hit.left, 'fact button 32x32 with a hit area beyond the box: ' + JSON.stringify(hit));
  // O8: tag and fact button corners come from the --radius-xs token (were literal 5px / 7px)
  const xs = await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--radius-xs').trim());
  assert(xs !== '' && await bmBtn.evaluate(e => getComputedStyle(e).borderTopLeftRadius) === xs
    && await css('.fact .tag', 'borderTopLeftRadius') === xs, 'fact button + tag radius = --radius-xs: ' + xs);
  await bmBtn.click();
  assert(await aria(bmBtn) === 'Bookmark|true', 'bookmark aria-pressed=true after toggle');
  const onPath = await bmPath();
  assert(onPath.fill === orange && onPath.stroke === orange, 'bookmark on: orange fill: ' + JSON.stringify(onPath));
  assert(await bmBtn.evaluate(e => getComputedStyle(e).backgroundColor) === await tokenRgb('--flag-bg'), 'bookmark on: flag-bg background');
  await tickBtn.click();
  assert(await aria(tickBtn) === 'Mastered|true', 'mastered aria-pressed=true after toggle');
  assert(await pg.locator('.fact').first().evaluate(e => e.classList.contains('mastered')), 'mastered class applied');
  assert(await pg.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('lifeuk.studyMastered'))).length === 1 && Object.keys(JSON.parse(localStorage.getItem('lifeuk.studyBookmarks'))).length === 1), 'persisted in localStorage');
  await pg.click('text=Hide mastered');
  assert((await count()) === '1 / 2 facts', 'hide mastered: ' + await count());
  await pg.click('text=Hide mastered');
  await pg.click('text=Bookmarked only');
  assert((await count()) === '1 / 2 facts', 'bookmarks only: ' + await count());
  await pg.click('.study-tab[data-tab="people"]');
  assert((await count()) === '0 / 55 facts', 'bookmarks only carries across tabs: ' + await count());
  assert(await pg.$eval('#studyContent', e => e.textContent.includes('No facts match')), 'empty state shown');
  await pg.click('text=Bookmarked only');

  // prefs persist across reload
  await pg.reload();
  await pg.click('#modeStudy');
  assert(await pg.$eval('.study-tab.active', e => e.dataset.tab) === 'people', 'tab persisted after reload');
  await pg.click('#screenStudy .back-btn');
  assert(await pg.$eval('#screenHome', e => e.classList.contains('active')), 'back to home');

  assert(errs.length === 0, 'no page errors: ' + errs.join(';'));
  await b.close();
  console.log('STUDY PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
