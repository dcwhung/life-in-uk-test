// v1.2.1: STUDY fact #126 (banknotes) merged into #125 (UK currency), .proj-docs/plans/2026-10-12_memo-followup-spec.json
// Stored progress keyed by fact id moves to the kept id once (FACT_ID_MERGES + the lifeuk.factIdsMerged marker):
// A: studyMastered / studyBookmarks: 126 → 125 (OR with 125's own value), 126 removed
// B: a saved study plan whose read tasks list 126 lists 125 instead (no duplicate) and still parses
// C: once only: with the marker written, a later 126 entry is left alone; malformed values stay untouched; the marker
//    is written only when something moved (fresh storage stays empty)
// D: the data side: #126 is gone, #125 holds the merged fact, other ids keep their numbers
const { chromium } = require('playwright-core');
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const OLD_ID = 126, KEPT_ID = 125;
const MASTERED = 'lifeuk.studyMastered', BOOKMARKS = 'lifeuk.studyBookmarks', PLAN = 'lifeuk.studyPlan';
const MARKER = 'lifeuk.factIdsMerged';
const GOAL = { examDate: '2026-12-20', dailyMins: 60, restDays: [0], level: 'some' };
const PLAN_TODAY = '2026-10-12';
const STUDY_COUNT = 235;
const MERGED_SRC = ['11.2', '5.1', '3.22', '9.2', '4.4'];

// a fresh page whose storage holds `seed` (raw strings) before the app's first read
async function loadWith(b, seed) {
  const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(APP_URL);
  await pg.evaluate(seed => { localStorage.clear(); Object.entries(seed).forEach(([k, v]) => localStorage.setItem(k, v)); }, seed);
  await pg.reload();
  return { pg, errs };
}
const readAll = pg => pg.evaluate(keys => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), [MASTERED, BOOKMARKS, PLAN, MARKER]);

// a real plan from the app, with fact 126 put into read tasks: once beside 125, once alone
async function planWithOldId(b) {
  const { pg } = await loadWith(b, {});
  const raw = await pg.evaluate(({ goal, today, oldId, keptId }) => {
    const plan = buildPlan(goal, today);
    const reads = plan.days.flatMap(d => d.tasks).filter(t => t.type === 'read' && t.facts.length);
    const withKept = reads.find(t => t.facts.includes(keptId));
    withKept.facts.splice(withKept.facts.indexOf(keptId) + 1, 0, oldId); // [.., 125, 126, ..]
    const other = reads.find(t => t !== withKept);
    other.facts.push(oldId); // a task with 126 but not 125
    return JSON.stringify(plan);
  }, { goal: GOAL, today: PLAN_TODAY, oldId: OLD_ID, keptId: KEPT_ID });
  await pg.close();
  return raw;
}

async function checkData(b) {
  const { pg } = await loadWith(b, {});
  const r = await pg.evaluate(({ oldId, keptId }) => ({
    count: STUDY.length, old: STUDY.some(f => f.id === oldId), kept: STUDY.find(f => f.id === keptId),
    maxId: Math.max(...STUDY.map(f => f.id)), qkeys: ['11.2', '5.1', '3.22', '9.2', '4.4'].map(k => factOf(questionByKey(k)).id),
  }), { oldId: OLD_ID, keptId: KEPT_ID });
  assert(r.count === STUDY_COUNT && !r.old && r.maxId === 236, `STUDY has ${STUDY_COUNT} facts, no #${OLD_ID}, ids not renumbered (max #236)`);
  assert(JSON.stringify(r.kept.src) === JSON.stringify(MERGED_SRC) && r.kept.d === 5 && /banknotes/.test(r.kept.en),
    `#${KEPT_ID} holds the merged fact (src ${r.kept.src.join(', ')}, d ${r.kept.d})`);
  assert(r.qkeys.every(id => id === KEPT_ID), `all five currency questions map to fact #${KEPT_ID}: ${r.qkeys.join(', ')}`);
  await pg.close();
}

async function checkMarks(b, planRaw) {
  const seed = {
    [MASTERED]: JSON.stringify({ 3: true, [OLD_ID]: true }),
    [BOOKMARKS]: JSON.stringify({ [KEPT_ID]: true, [OLD_ID]: true, 7: true }),
    [PLAN]: planRaw,
  };
  const { pg, errs } = await loadWith(b, seed);
  const s = await readAll(pg);
  const mastered = JSON.parse(s[MASTERED]), bookmarks = JSON.parse(s[BOOKMARKS]);
  assert(JSON.stringify(mastered) === JSON.stringify({ 3: true, [KEPT_ID]: true }), `A: mastered ${OLD_ID} → ${KEPT_ID}: ${s[MASTERED]}`);
  assert(JSON.stringify(bookmarks) === JSON.stringify({ 7: true, [KEPT_ID]: true }), `A: bookmarks ${OLD_ID} and ${KEPT_ID} → one ${KEPT_ID}: ${s[BOOKMARKS]}`);
  const plan = await pg.evaluate(() => {
    const p = parseStoredPlan(readStudyPlan());
    return p && p.days.flatMap(d => d.tasks).filter(t => t.type === 'read').map(t => t.facts);
  });
  const flat = plan ? plan.flat() : [];
  assert(plan && !flat.includes(OLD_ID) && plan.every(f => new Set(f).size === f.length) && flat.filter(id => id === KEPT_ID).length === 2,
    `B: saved plan still parses, read tasks list ${KEPT_ID} instead of ${OLD_ID}, no duplicate within a task`);
  assert(s[MARKER] && JSON.parse(s[MARKER]).includes(OLD_ID), `C: marker ${MARKER} records ${OLD_ID}: ${s[MARKER]}`);
  // the Study screen reads the merged marks
  const ui = await pg.evaluate(keptId => { openStudy(); return { mastered: !!study.mastered[keptId], bookmarked: !!study.bookmarks[keptId] }; }, KEPT_ID);
  assert(ui.mastered && ui.bookmarked, `Study shows #${KEPT_ID} mastered and bookmarked`);
  assert(errs.length === 0, 'no page errors: ' + errs.join('; '));
  await pg.close();
}

async function checkOnce(b) {
  // marker already written (a later load): a 126 entry is not touched again; malformed values survive raw
  const seed = { [MARKER]: JSON.stringify([OLD_ID]), [MASTERED]: JSON.stringify({ [OLD_ID]: true }), [BOOKMARKS]: '{not json' };
  const { pg } = await loadWith(b, seed);
  const s = await readAll(pg);
  assert(s[MASTERED] === seed[MASTERED], `C: with the marker, mastered is left as stored: ${s[MASTERED]}`);
  await pg.close();
  const fresh = await loadWith(b, { [BOOKMARKS]: '{not json', [MASTERED]: JSON.stringify({ [OLD_ID]: true }) });
  const t = await readAll(fresh.pg);
  assert(t[BOOKMARKS] === '{not json' && JSON.parse(t[MASTERED])[KEPT_ID] && JSON.parse(t[MARKER]).includes(OLD_ID),
    `C: a malformed value is left raw while the rest migrates: ${t[BOOKMARKS]} / ${t[MASTERED]}`);
  await fresh.pg.close();
  // nothing to move (empty storage, or marks without the old id): nothing is written, not even the marker
  const empty = await loadWith(b, {});
  const e = await readAll(empty.pg);
  assert(e[MASTERED] === null && e[BOOKMARKS] === null && e[PLAN] === null && e[MARKER] === null, 'C: empty storage stays empty (no marker)');
  await empty.pg.close();
  const plain = await loadWith(b, { [MASTERED]: JSON.stringify({ 3: true }) });
  const pl = await readAll(plain.pg);
  assert(pl[MASTERED] === JSON.stringify({ 3: true }) && pl[MARKER] === null, 'C: marks without the old id are left as stored, no marker');
  await plain.pg.close();
}

(async () => {
  const b = await chromium.launch(launchOpts);
  await checkData(b);
  await checkMarks(b, await planWithOldId(b));
  await checkOnce(b);
  await b.close();
  console.log('FACTMERGE PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
