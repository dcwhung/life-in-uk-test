const { chromium } = require('playwright-core');
const { seedLegacyDefaults } = require('./legacy-defaults'); // en + small: the tile / list assertions read English
const path = require('path');
// CUI-0039 (QA v2.0.5 F-1): stored question keys ("exam.idx") with no matching question — exam missing, index out
// of range, malformed — in lifeuk.wrongList / lifeuk.practiceFlags / lifeuk.practiceStreak. They must not be
// counted, never reach a round or a list, and are pruned from storage once on load (no write when nothing is stale).
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const WRONG = 'lifeuk.wrongList', FLAGS = 'lifeuk.practiceFlags', STREAK = 'lifeuk.practiceStreak';
const WATCHED = [WRONG, FLAGS, STREAK];
const REAL = '1.2';
const STALE = ['1.999', '99.99', 'abc', '1.2.3', '01.2', ''];
const marks = keys => Object.fromEntries(keys.map(k => [k, true]));

// records every app write to the three keys (installed before the app's scripts on each load)
function spyWrites(keys) {
  window.__lsWrites = [];
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (keys.includes(k)) window.__lsWrites.push(k);
    return set.call(this, k, v);
  };
}

(async () => {
  const b = seedLegacyDefaults(await chromium.launch(launchOpts));
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.context().addInitScript(spyWrites, WATCHED);
  const raw = key => pg.evaluate(k => localStorage.getItem(k), key);
  const json = async key => JSON.parse(await raw(key));
  const text = sel => pg.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
  const seed = async values => {
    await pg.evaluate(v => {
      localStorage.clear();
      localStorage.setItem('lifeuk.uiLang', JSON.stringify('en'));
      localStorage.setItem('lifeuk.fontSize', JSON.stringify('small'));
      localStorage.setItem('lifeuk.homePrefs', JSON.stringify({ mode: 'practice', view: 'difficulty' }));
      localStorage.setItem('lifeuk.installDismissed', 'true');
      Object.entries(v).forEach(([k, val]) => localStorage.setItem(k, val));
    }, values);
    await pg.reload();
    await pg.waitForSelector('#screenHome.active');
  };

  await pg.goto(APP_URL);
  await seed({
    [WRONG]: JSON.stringify(marks([...STALE, REAL])),
    [FLAGS]: JSON.stringify(marks([...STALE, REAL])),
    [STREAK]: JSON.stringify({ '1.999': 3, '99.99': 2, abc: 1, [REAL]: 1 }),
  });

  // the predicate itself (js/domain/questions.js)
  const valid = await pg.evaluate(keys => keys.map(k => isValidQuestionKey(k)), [REAL, '1.0', ...STALE]);
  assert(valid[0] && valid[1] && valid.slice(2).every(v => v === false), 'isValidQuestionKey: real keys yes, stale / malformed no');
  assert(await pg.evaluate(() => [null, undefined, 12].every(k => !isValidQuestionKey(k))), 'isValidQuestionKey: non-strings no');

  // pruned on load, written back once
  assert(JSON.stringify(await json(WRONG)) === JSON.stringify({ [REAL]: true }), 'wrongList pruned to {"1.2":true} in storage');
  assert(JSON.stringify(await json(FLAGS)) === JSON.stringify({ [REAL]: true }), 'practiceFlags pruned to {"1.2":true} in storage');
  assert(JSON.stringify(await json(STREAK)) === JSON.stringify({ [REAL]: 1 }), 'practiceStreak pruned to {"1.2":1} in storage');
  assert(await pg.evaluate(() => JSON.stringify([wrongList, practiceFlags, streaks])) === JSON.stringify([{ [REAL]: true }, { [REAL]: true }, { [REAL]: 1 }]),
    'in-memory lists hold only the real key');

  // Home: both tiles count 1
  assert((await text('#tileWrong .t-num')) === '1', 'Wrong answers tile counts 1');
  assert((await text('#tileFlagged .t-num')) === '1', 'Flagged tile counts 1');

  // tap Wrong answers → a 1-question round, no page error
  await pg.click('#tileWrong');
  await pg.waitForSelector('#screenQuiz.active');
  assert(await pg.evaluate(() => state.questions.length === 1 && qKey(state.questions[0]) === '1.2'), 'Wrong tile starts a 1-question round of 1.2');
  assert(!errs.length, 'no page error starting the wrong-answers round ' + JSON.stringify(errs));

  // Flagged screen lists 1; Practise flagged starts 1
  await pg.evaluate(() => goHome());
  await pg.evaluate(() => openFlagged());
  assert(await pg.$$eval('#flaggedList .flag-item', els => els.length) === 1, 'Flagged screen lists 1 question');
  await pg.evaluate(() => startFlaggedPractice());
  assert(await pg.evaluate(() => state.questions.length === 1), 'Practise flagged: a 1-question round');
  assert(!errs.length, 'no page error on the Flagged screen / round ' + JSON.stringify(errs));

  // idempotent: a clean load writes nothing
  await pg.evaluate(() => goHome());
  await pg.reload();
  await pg.waitForSelector('#screenHome.active');
  assert((await pg.evaluate(() => window.__lsWrites)).length === 0, 'clean storage: no write on load');
  assert(JSON.stringify(await json(WRONG)) === JSON.stringify({ [REAL]: true }), 'clean storage unchanged after reload');

  // only the stale list is written
  await seed({ [WRONG]: JSON.stringify(marks(['99.99', REAL])), [FLAGS]: JSON.stringify(marks([REAL])), [STREAK]: JSON.stringify({ [REAL]: 2 }) });
  assert(JSON.stringify(await pg.evaluate(() => window.__lsWrites)) === JSON.stringify([WRONG]), 'only the list with a stale key is written back');

  // G40: every copy of a merged duplicate question is a real key and is kept
  const copies = await pg.evaluate(() => Object.values(QUESTION_COPIES.copies).find(c => c.length > 1));
  await seed({ [WRONG]: JSON.stringify(marks([...copies, '99.99'])), [FLAGS]: JSON.stringify(marks(copies)) });
  assert(JSON.stringify(Object.keys(await json(WRONG))) === JSON.stringify(copies), 'G40 copies kept in wrongList: ' + copies.join(', '));
  assert(JSON.stringify(Object.keys(await json(FLAGS))) === JSON.stringify(copies), 'G40 copies kept in practiceFlags');
  assert((await text('#tileWrong .t-num')) === '1', 'copies of one question count once');

  // S-264: a pre-v0.58 unprefixed key (no migration marker) is migrated first, then pruned
  await pg.evaluate(v => { localStorage.clear(); Object.entries(v).forEach(([k, val]) => localStorage.setItem(k, val)); },
    { wrongList: JSON.stringify(marks(['99.99', '1.999', REAL])), 'lifeuk.homePrefs': JSON.stringify({ mode: 'practice', view: 'difficulty' }) });
  await pg.reload();
  await pg.waitForSelector('#screenHome.active');
  assert(JSON.stringify(await json(WRONG)) === JSON.stringify({ [REAL]: true }) && (await raw('wrongList')) === null,
    'legacy unprefixed wrongList: migrated to lifeuk.wrongList, then pruned to {"1.2":true}');
  assert((await text('#tileWrong .t-num')) === '1', 'legacy wrongList: tile counts 1');

  // a value that is not a { key: mark } object is left in storage as is and reads as empty (no crash)
  errs.length = 0;
  await seed({ [WRONG]: '"oops"', [FLAGS]: '["1.2"]' });
  assert((await raw(WRONG)) === '"oops"' && (await raw(FLAGS)) === '["1.2"]', 'non-object values are not rewritten');
  assert((await pg.evaluate(() => window.__lsWrites)).length === 0, 'non-object values: no write on load');
  assert(await pg.evaluate(() => keysOf(wrongList).length === 0 && keysOf(practiceFlags).length === 0), 'non-object values read as empty lists');
  assert(!errs.length, 'no page error with non-object values ' + JSON.stringify(errs));

  await b.close();
  console.log('PASS: stale question keys');
})().catch(e => { console.error(e.message); console.log('FAIL'); process.exit(1); });
