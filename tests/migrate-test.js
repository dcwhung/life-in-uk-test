const { chromium } = require('playwright-core');
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
// v0.58: localStorage keys move to the 'lifeuk.' prefix (origin shared with other apps); legacy data must survive
const LEGACY = {
  completedExams: '{"1":true,"2":true,"3":true,"4":true,"5":true}',
  homePrefs: '{"mode":"practice","view":"chapter"}',
  practiceFlags: '{"9.13":true,"13.18":true,"6.17":true,"16.0":true,"12.2":true}',
  // spaces kept on purpose: migration must copy the raw string, not re-serialise it
  practiceStreak: '{"1.0":3, "1.1":3, "1.2":1, "2.5":3, "3.4":2, "7.7":0}',
  reviewOrder: 'original',
  studyBookmarks: '{"7":true}',
  studyMastered: '{"12":true,"40":true}',
  studyPrefs: '{"tab":"geo","chapter":4,"hideMastered":false,"bookmarksOnly":false}',
  wrongList: '{"3.4":true,"8.1":true}',
};
const FOREIGN = {
  'run365.prefs': '{"units":"km","goal":365}',
  'tripspend.entries.v1': '[{"amt":12.5,"cur":"GBP","note":"tea"}]',
  'tripspend.settings.v1': '{"home":"HKD"}',
};
const OLD_KEYS = ['completedExams', 'homePrefs', 'practiceFlags', 'practiceStreak', 'studyBookmarks', 'studyPrefs', 'wrongList', 'studyMastered'];
const P = 'lifeuk.';
(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
  const text = sel => pg.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
  const dump = () => pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
  const seed = async kv => {
    await pg.evaluate(kv => { localStorage.clear(); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, kv);
    await pg.reload();
  };
  await pg.goto(APP_URL);

  // a. real-looking legacy data + other apps' keys
  await seed({ ...LEGACY, ...FOREIGN });
  let s = await dump();
  for (const [k, v] of Object.entries(LEGACY)) {
    if (k === 'reviewOrder') continue;
    assert(s[P + k] === v, `${k} → ${P}${k} with the exact raw string`);
  }
  assert(OLD_KEYS.every(k => !(k in s)) && !('reviewOrder' in s), 'legacy keys and obsolete reviewOrder removed');
  assert(Object.entries(FOREIGN).every(([k, v]) => s[k] === v), 'other apps\' keys byte-identical');
  assert(!(P + 'reviewOrder' in s), 'obsolete reviewOrder not carried over');
  assert(await pg.$eval('#modePractice', e => e.classList.contains('selected')) && await pg.$eval('#ptabChapter', e => e.classList.contains('active')), 'home restored to Practice › By Chapter');
  assert((await text('#tileFlagged .t-num')) === '5', 'My Review Flagged tile shows 5');
  assert((await text('#examGrid .exam-btn:nth-child(2) .exam-mastery')).startsWith('2/24'), 'Exam 1 mastery reflects streak-3 entries');
  assert((await text('#examGrid .exam-btn.all .exam-mastery')).startsWith('3/408'), 'All Exams mastery 3/408');
  await pg.click('#modeExam');
  const done = await pg.$$eval('#examGrid .exam-btn.done', els => els.map(e => e.dataset.arg));
  assert(JSON.stringify(done) === JSON.stringify(['1', '2', '3', '4', '5']), 'Exam 1–5 show completed ✓: ' + done);
  await pg.click('#modePractice');
  await pg.click('#modeStudy');
  assert(await pg.$eval('.study-tab.active', e => e.dataset.tab) === 'geo', 'Study opens on the geo tab');
  assert(await pg.evaluate(() => keysOf(study.mastered).length === 2 && keysOf(study.bookmarks).length === 1), 'Study mastered / bookmarks restored');
  assert((await text('#tileWrong .t-num')) === '2', 'My Review Wrong tile shows 2');

  // c. idempotent across reloads; app writes only lifeuk.* keys
  const before = await dump();
  await pg.reload(); await pg.reload();
  assert(JSON.stringify(await dump()) === JSON.stringify(before), 'two more reloads: storage unchanged');
  await pg.evaluate(() => { pendingMode = 'practice'; startExam('ch2'); });
  const k0 = await pg.evaluate(() => qKey(state.questions[0]));
  await pg.click('#flagBtn');
  s = await dump();
  assert(JSON.parse(s[P + 'practiceFlags'])[k0] === true, 'new flag saved to ' + P + 'practiceFlags');
  const changed = Object.keys(s).filter(k => s[k] !== before[k]);
  assert(JSON.stringify(changed) === JSON.stringify([P + 'practiceFlags']), 'only lifeuk.practiceFlags changed: ' + changed);
  assert(Object.keys(s).every(k => k.startsWith(P) || k in FOREIGN), 'no unprefixed app key reappears');

  // b. both present → the new key wins, the old one goes
  await seed({ practiceFlags: '{"1.0":true}', [P + 'practiceFlags']: '{"2.0":true}', homePrefs: '{"mode":"exam"}' });
  s = await dump();
  assert(s[P + 'practiceFlags'] === '{"2.0":true}' && !('practiceFlags' in s), 'new key kept untouched, old removed');
  assert(s[P + 'homePrefs'] === '{"mode":"exam"}' && !('homePrefs' in s), 'unrelated legacy key still migrated');
  assert((await text('#tileFlagged .t-num')) === '1', 'UI reads the new key (Flagged 1)');

  // d. malformed JSON is moved as-is and the app still starts
  await seed({ practiceFlags: '{bad json', wrongList: 'nope' });
  s = await dump();
  assert(s[P + 'practiceFlags'] === '{bad json' && s[P + 'wrongList'] === 'nope' && !('practiceFlags' in s) && !('wrongList' in s), 'malformed values moved raw');
  assert(await pg.$eval('#modePractice', e => e.offsetParent !== null), 'home renders with malformed data');

  // e. fresh storage: migration creates nothing
  await seed({});
  assert(Object.keys(await dump()).length === 0, 'fresh storage: no keys created at load');

  // f. fail-safe: a write that throws (quota) or does not stick keeps the old key in use this load
  await pg.addInitScript(() => {
    if (sessionStorage.getItem('stubOff')) return;
    const realSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'lifeuk.practiceStreak') throw new DOMException('quota', 'QuotaExceededError');
      if (k === 'lifeuk.studyPrefs') return; // silently dropped → verify mismatch
      return realSet.call(this, k, v);
    };
  });
  await seed({ ...LEGACY });
  assert((await text('#examGrid .exam-btn.all .exam-mastery')).startsWith('3/408'), 'quota: legacy mastery still shown (3/408)');
  s = await dump();
  assert(!(P + 'practiceStreak' in s) && s.practiceStreak === LEGACY.practiceStreak, 'quota: old streak key kept, no empty new key');
  assert(s[P + 'practiceFlags'] === LEGACY.practiceFlags && !('practiceFlags' in s), 'quota: other keys still migrated');
  const newKey = await pg.evaluate(() => {
    pendingMode = 'practice'; startExam('ch4');
    const i = state.questions.findIndex(q => !(qKey(q) in streaks));
    const q = state.questions[i]; state.current = i; state.answers[i] = [...q.a]; revealAnswer();
    return qKey(q);
  });
  await pg.evaluate(() => goHome());
  await pg.click('#modeStudy');
  assert(await pg.$eval('.study-tab.active', e => e.dataset.tab) === 'geo', 'verify mismatch: Study still on geo from the old key');
  await pg.evaluate(() => sessionStorage.setItem('stubOff', '1'));
  await pg.reload();
  s = await dump();
  const streak = JSON.parse(s[P + 'practiceStreak']);
  const legacyStreak = JSON.parse(LEGACY.practiceStreak);
  assert(Object.entries(legacyStreak).every(([k, v]) => streak[k] === v) && streak[newKey] === 1, 'next load: legacy streaks + the new answer under ' + P + 'practiceStreak');
  assert(!('practiceStreak' in s) && !('studyPrefs' in s) && JSON.parse(s[P + 'studyPrefs']).tab === 'geo', 'next load: old keys gone, migration completed');

  assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  console.log('MIGRATE PASS');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
