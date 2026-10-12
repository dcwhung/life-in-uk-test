// Memory-note study mode (v1.5.0, Study tab 5 "🧠"): data/memo.js + js/domain/memo.js. Node only: the app's classic
// scripts run in one vm context (top-level const / let shared across scripts, as in a page) with an in-memory
// localStorage. Every date the domain sees is passed in as an ISO string, so no clock is mocked.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const APP_FILES = [
  'data/exams.js', 'data/study.js', 'data/memo.js', 'js/core/config.js', 'js/core/utils.js', 'js/core/store.js',
  'js/domain/questions.js', 'js/domain/mastery.js', 'js/domain/similar.js', 'js/domain/plan.js', 'js/domain/planProgress.js',
  'js/domain/memo.js',
];
const MEMO_LS = 'lifeuk.memoProgress';
const MARK = '記憶法';
// data facts (checked against data/exams.js on 2026-10-12)
const QUESTION_COUNT = 408;
const TITLED_GROUPS = 61;
const NO_MEMO_QUESTIONS = 8;
const HOOK_BATCH = 15; // batch 1: the 15 groups with the most distinct questions
const TODAY = '2026-10-12';

let asserts = 0;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); asserts++; console.log('ok:', m); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: k => { data.delete(k); },
    key: i => [...data.keys()][i] ?? null,
    get length() { return data.size; },
  };
}
function loadApp(seed) {
  const storage = memoryStorage(seed);
  const ctx = vm.createContext({ localStorage: storage, console });
  for (const f of APP_FILES) {
    const file = path.join(ROOT, f);
    assert(fs.existsSync(file), `${f} exists`);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: f });
  }
  return { storage, g: code => vm.runInContext(code, ctx) };
}
const stored = app => JSON.parse(app.storage.getItem(MEMO_LS));

// ── data/memo.js: one entry per titled memory note + the single-note group ──
function checkGroupData({ g }) {
  const meta = g('MEMO_GROUPS'), EXAMS = g('EXAMS');
  const ids = meta.map(m => m.id), titles = meta.map(m => m.title);
  assert(meta.length === TITLED_GROUPS + 1 && meta[meta.length - 1].id === 'single', `${TITLED_GROUPS} titled groups + the single-note group last`);
  assert(new Set(ids).size === ids.length && ids.every(id => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)), 'ids are unique ascii slugs');
  assert(new Set(titles).size === titles.length && meta.every(m => m.title && m.icon && typeof m.hook === 'string'), 'titles unique; each has an icon and a hook string');
  const notes = Object.values(EXAMS).flat().map(q => q.note);
  const withMark = notes.filter(n => n.includes(MARK));
  assert(withMark.length === QUESTION_COUNT - NO_MEMO_QUESTIONS, `${QUESTION_COUNT - NO_MEMO_QUESTIONS} notes carry a memory note`);
  const untitled = withMark.filter(n => !/^記憶法（[^）]+）：/.test(n.slice(n.indexOf(MARK))));
  assert(untitled.length === 0, `every memory note is titled (untitled: ${untitled.length})`);
  // every titled note maps to exactly one MEMO_GROUPS entry
  const unmapped = withMark.map(n => n.slice(n.indexOf(MARK)).match(/^記憶法（([^）]+)）：/)[1])
    .filter(title => titles.filter(x => x === title).length !== 1);
  assert(unmapped.length === 0, `every titled note maps to exactly one group (unmapped: ${[...new Set(unmapped)].join(', ')})`);
}

// ── memoGroups(): membership derived from the notes ──
function checkGroups({ g }) {
  const groups = g('memoGroups()');
  assert(g('memoGroups()') === groups, 'memoGroups() is cached');
  assert(groups.length === TITLED_GROUPS + 1 && groups.every(gr => gr.count >= 1 && gr.qkeys.length >= gr.count), 'every group has at least 1 question');
  const keys = groups.flatMap(gr => gr.qkeys);
  assert(keys.length === QUESTION_COUNT && new Set(keys).size === QUESTION_COUNT, 'every question belongs to exactly one group');
  const vote = g("memoGroupById('vote')");
  assert(vote.title === '投票權' && vote.icon === '🗳️' && vote.count === 15 && vote.ch === 3 && vote.body.startsWith('記憶法（投票權）：\n| 年份'),
    'vote: 投票權, 15 questions, Ch 3, body from the heading on');
  const fest = groups.find(gr => gr.title === '英國節日');
  assert(fest && fest.count === 16 && fest.qkeys.length === 17 && fest.ch === 4, '英國節日: 17 copies = 16 distinct questions (deduped like questionGroups), most in Ch 4');
  const single = g("memoGroupById('single')");
  assert(single.body === null && single.qkeys.length === NO_MEMO_QUESTIONS && single.count === NO_MEMO_QUESTIONS, 'single: no body, the 8 questions without a memory note');
  assert(g("memoGroupById('nope')") === undefined, 'unknown id → undefined');
  assert(g("memoMainChapter(['1.0', '3.6'])") === 1 && g("memoMainChapter(['3.6', '1.0'])") === 1, 'chapter tie → lowest chapter');
  assert(g("memoMainChapter(['1.0', '3.6', '1.2', '3.7'])") === 5, 'main chapter = the one with most questions');
}

// hooks: batch 1 = the 15 groups with the most distinct questions (tie: more copies, then MEMO_GROUPS order)
function checkHooks({ g }) {
  const groups = g('memoGroups()').filter(gr => gr.id !== 'single');
  const order = [...groups].sort((a, b) => b.count - a.count || b.qkeys.length - a.qkeys.length);
  assert(same(order.map(gr => gr.id), groups.map(gr => gr.id)), 'MEMO_GROUPS is listed most distinct questions first (ties: more copies)');
  const batch = new Set(order.slice(0, HOOK_BATCH).map(gr => gr.id));
  assert(groups.every(gr => (batch.has(gr.id) ? gr.hook.trim().length > 0 : gr.hook === '')), `the ${HOOK_BATCH} biggest groups have a hook, the others ''`);
  assert(groups.every(gr => gr.hook.split('\n').length <= 2), 'a hook is at most two lines');
}

// ── progress: lifeuk.memoProgress = { [id]: { lv, due } } ──
function checkRecord() {
  const app = loadApp(), g = app.g;
  assert(g('MEMO_PROGRESS_LS') === MEMO_LS && same(g('MEMO_INTERVALS'), [1, 3, 7, 14]) && g('MEMO_PASS_RATIO') === 0.7
    && g('MEMO_TEST_SIZE') === 5 && g('MEMO_MAX_LV') === 4, 'constants: key, intervals 1/3/7/14, pass 70%, test 5, max Lv4');
  assert(same(g('memoLoadProgress()'), {}) && g("memoStatus(memoRecord(memoLoadProgress(), 'vote'), '" + TODAY + "')") === 'new', 'nothing stored → new');
  const steps = [[TODAY, '2026-10-13', 1], ['2026-10-13', '2026-10-16', 2], ['2026-10-16', '2026-10-23', 3], ['2026-10-23', '2026-11-06', 4], ['2026-11-06', '2026-11-20', 4]];
  steps.forEach(([day, due, lv]) => {
    const r = g(`recordMemoResult('vote', 4, 5, '${day}')`);
    assert(r.passed && r.lv === lv && r.due === due && same(stored(app).vote, { lv, due }), `4/5 on ${day} → Lv${lv}, due ${due}${lv === 4 && day === '2026-11-06' ? ' (pass at Lv4 stays Lv4, +14)' : ''}`);
  });
  const fail0 = g(`recordMemoResult('ww2', 1, 5, '${TODAY}')`);
  assert(!fail0.passed && fail0.lv === 0 && fail0.prevLv === 0 && fail0.due === '2026-10-13', 'fail at Lv0 stays Lv0, due tomorrow');
  g(`recordMemoResult('parliament', 5, 5, '${TODAY}')`); g("recordMemoResult('parliament', 5, 5, '2026-10-13')");
  const fail2 = g("recordMemoResult('parliament', 2, 5, '2026-10-16')");
  assert(!fail2.passed && fail2.lv === 2 && fail2.prevLv === 2 && fail2.due === '2026-10-17', 'fail at Lv2 keeps Lv2, due tomorrow');
  assert(g('memoPassed(7, 10)') && g('memoPassed(3, 4)') && !g('memoPassed(2, 3)') && !g('memoPassed(0, 0)') && g('memoPassed(5, 5)'), 'exactly 70% passes, 2/3 fails, 0/0 fails');
  assert(stored(app).vote.lv === 4 && Object.keys(stored(app)).length === 3, 'each group keeps its own record');
}

function checkDateBoundaries() {
  const { g } = loadApp();
  assert(g("recordMemoResult('vote', 5, 5, '2026-12-31')").due === '2027-01-01', 'year boundary: 31 Dec + 1 → 1 Jan');
  assert(g("recordMemoResult('vote', 5, 5, '2027-01-30')").due === '2027-02-02', 'month boundary: 30 Jan + 3 → 2 Feb');
  assert(g("recordMemoResult('ww2', 0, 5, '2028-02-28')").due === '2028-02-29', 'leap year: 28 Feb 2028 + 1 → 29 Feb');
  assert(g("recordMemoResult('ww2', 5, 5, '2027-02-28')").due === '2027-03-01', 'no leap day in 2027: 28 Feb + 1 → 1 Mar');
}

function checkStatusAndSort() {
  const seed = { vote: { lv: 2, due: '2026-10-12' }, ww2: { lv: 1, due: '2026-10-20' }, parliament: { lv: 4, due: '2026-10-30' },
    'uk-festivals': { lv: 4, due: '2026-10-11' }, writers: { lv: 0, due: '2026-10-13' } };
  const { g } = loadApp({ [MEMO_LS]: JSON.stringify(seed) });
  const st = id => g(`memoStatus(memoRecord(memoLoadProgress(), '${id}'), '${TODAY}')`);
  assert(st('vote') === 'due' && st('uk-festivals') === 'due', 'due today / overdue (Lv4 too) → due');
  assert(st('ww2') === 'learning' && st('writers') === 'learning' && st('parliament') === 'done' && st('tudors') === 'new',
    'Lv1–3 not due → learning (a failed Lv0 waiting for tomorrow too); Lv4 not due → done; no record → new');
  assert(g(`memoDaysUntil(memoRecord(memoLoadProgress(), 'parliament'), '${TODAY}')`) === 18, 'done: days until due');
  const sorted = g(`memoSortedGroups(memoGroups(), memoLoadProgress(), '${TODAY}').map(gr => gr.id)`);
  const pos = id => sorted.indexOf(id);
  assert(sorted.length === TITLED_GROUPS + 1, 'sort keeps every group');
  assert(pos('uk-festivals') === 0 && pos('vote') === 1, 'due first, by question count (16 before 15)');
  assert(pos('vote') < pos('patron-saints') && pos('patron-saints') < pos('ww2') && pos('ww2') < pos('parliament'), 'then new, then learning, then done');
  const newIds = sorted.slice(2, sorted.length - 3);
  const counts = newIds.map(id => g(`memoGroupById('${id}').count`));
  assert(counts.every((c, i) => i === 0 || counts[i - 1] >= c), 'within a status: count desc');
  const order = g('MEMO_GROUPS.map(m => m.id)');
  const ties = newIds.filter((id, i) => i > 0 && counts[i - 1] === counts[i]).map((id, i0) => [newIds[newIds.indexOf(id) - 1], id]);
  assert(ties.length > 0 && ties.every(([a, b]) => order.indexOf(a) < order.indexOf(b)), 'equal counts keep MEMO_GROUPS order');
  assert(same(g(`memoDueGroups(memoLoadProgress(), '${TODAY}').map(gr => gr.id)`), ['uk-festivals', 'vote']), 'memoDueGroups: the due groups in list order');
}

function checkCorruptedStorage() {
  const bad = [['not json', '{not json'], ['an array', '[1,2]'], ['a number', '7'], ['null', 'null']];
  bad.forEach(([what, raw]) => {
    const { g } = loadApp({ [MEMO_LS]: raw });
    assert(same(g('memoLoadProgress()'), {}), `stored ${what} → no progress, no throw`);
  });
  const junk = { vote: { lv: 2, due: '2026-10-20' }, nope: { lv: 1, due: '2026-10-20' }, ww2: { lv: 5, due: '2026-10-20' },
    parliament: { lv: -1, due: '2026-10-20' }, writers: { lv: 1.5, due: '2026-10-20' }, tudors: { lv: '2', due: '2026-10-20' },
    norman: { lv: 1, due: 'soon' }, art: { lv: 1, due: '2026-02-30' }, media: 'x', films: null, constructor: { lv: 1, due: '2026-10-20' } };
  const app = loadApp({ [MEMO_LS]: JSON.stringify(junk) });
  assert(same(app.g('memoLoadProgress()'), { vote: { lv: 2, due: '2026-10-20' } }), 'unknown ids, bad levels and bad dates are ignored, the valid record kept');
  app.g(`recordMemoResult('ww2', 5, 5, '${TODAY}')`);
  assert(same(stored(app), { vote: { lv: 2, due: '2026-10-20' }, ww2: { lv: 1, due: '2026-10-13' } }), 'a bad record reads as new; writing keeps only valid records');
}

function checkTestPick() {
  const { g } = loadApp();
  const jury = g("memoGroupById('jury')");
  assert(jury.count === 3, 'jury has 3 distinct questions');
  const pick = g("memoTestPick(memoGroupById('jury')).map(qKey)");
  assert(pick.length === 3 && pick.every(k => jury.qkeys.includes(k)), 'a 3-question group → a 3-question test');
  for (let i = 0; i < 20; i++) {
    const vote = g("memoTestPick(memoGroupById('vote')).map(qKey)");
    const canon = new Set(vote.map(k => g(`canonQuestionKey('${k}')`)));
    assert(vote.length === 5 && canon.size === 5 && vote.every(k => g("memoGroupById('vote').qkeys").includes(k)), `vote: 5 distinct questions of the group (draw ${i + 1})`);
  }
  const fest = g("memoGroupById('uk-festivals')");
  const seen = new Set();
  for (let i = 0; i < 40; i++) g("memoTestPick(memoGroupById('uk-festivals')).map(qKey)").forEach(k => seen.add(k));
  assert(seen.size > 5 && [...seen].every(k => fest.qkeys.includes(k)), 'draws are random across the group');
}

try {
  const app = loadApp();
  checkGroupData(app);
  checkGroups(app);
  checkHooks(app);
  checkRecord();
  checkDateBoundaries();
  checkStatusAndSort();
  checkCorruptedStorage();
  checkTestPick();
  console.log(`MEMO-DOMAIN PASS (${asserts} checks)`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
