const { chromium } = require('playwright-core');
const path = require('path');
// CUI-0003: a stale or hand-edited lifeuk.studyPrefs must never blank the Study screen;
// unknown values fall back to the defaults, valid ones are kept.
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
const PREFS_KEY = 'lifeuk.studyPrefs';

// seed prefs, reload, open Study; returns the study state and how many fact cards rendered
async function openStudyWith(pg, prefs) {
  await pg.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [PREFS_KEY, prefs]);
  await pg.reload();
  await pg.evaluate(() => openStudy());
  return pg.evaluate(() => ({
    tab: study.tab, chapter: study.chapter, nation: study.nation, group: study.group,
    hideMastered: study.hideMastered, cards: document.querySelectorAll('#studyContent .fact').length,
  }));
}

(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(APP_URL);

  let s = await openStudyWith(pg, JSON.stringify({ tab: 'bogus' }));
  assert(errs.length === 0, 'invalid tab does not throw' + (errs.length ? ': ' + errs.join(' / ') : ''));
  assert(s.tab === 'chapters' && s.cards > 0, `invalid tab falls back to chapters and renders facts (tab=${s.tab}, cards=${s.cards})`);

  s = await openStudyWith(pg, JSON.stringify({ tab: 'chapters', chapter: 99 }));
  assert(s.chapter === 1 && s.cards > 0, `out-of-range chapter falls back to 1 and renders facts (chapter=${s.chapter}, cards=${s.cards})`);

  s = await openStudyWith(pg, JSON.stringify({ tab: 'geo', nation: 'Atlantis' }));
  assert(s.tab === 'geo' && s.nation === 'all' && s.cards > 0, `unknown nation falls back to all (nation=${s.nation}, cards=${s.cards})`);

  s = await openStudyWith(pg, JSON.stringify({ tab: 'people', group: 'wizard', hideMastered: 'yes' }));
  assert(s.tab === 'people' && s.group === 'all' && s.hideMastered === false && s.cards > 0, `unknown group / non-boolean flag fall back (group=${s.group}, hideMastered=${s.hideMastered})`);

  s = await openStudyWith(pg, '"not an object"');
  assert(s.tab === 'chapters' && s.cards > 0, 'non-object prefs keep the defaults');

  s = await openStudyWith(pg, JSON.stringify({ tab: 'timeline', chapter: 4 }));
  assert(s.tab === 'timeline' && s.chapter === 4 && s.cards > 0, 'valid prefs are kept');

  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' / ') : ''));
  await b.close();
  console.log('STUDYPREFS PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
