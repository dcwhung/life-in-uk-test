// ════════════════════════════════════════
// MEMO — memory-note study (Study tab 5, v1.6.0): groups of questions sharing one memory note, a 4-level review
// schedule and the per-group progress in lifeuk.memoProgress. Pure logic: no DOM; today is always a parameter
// (callers pass planTodayIso(), the one clock reader), so the dates follow the device's local calendar.
// Group membership is read from the notes (data/exams.js): a note's memory note = its text from the heading word
// (MEMORY_MARK, js/domain/similar.js) to the end; the heading names the group ("<mark>(title):" in full-width brackets and colon, data/memo.js).
// ════════════════════════════════════════
const MEMO_INTERVALS = [1, 3, 7, 14];          // days until the next review on reaching Lv1 .. Lv4
const MEMO_MAX_LV = MEMO_INTERVALS.length;     // Lv4 = known
const MEMO_PASS_RATIO = 0.7;                   // a test at or above this moves the group up one level
const MEMO_TEST_SIZE = 5;                      // distinct questions per test (fewer when the group has fewer)
const MEMO_RETRY_DAYS = 1;                     // a failed test: due again tomorrow...
const MEMO_FAIL_DROP = 1;                      // ...one level lower (user, review W-064: at every level; Lv0 stays Lv0)
const MEMO_SINGLE_ID = 'single';               // the group of questions with no memory note (each shows its own note)
const MEMO_STATUS = { due: 'due', new: 'new', learning: 'learning', done: 'done' };
const MEMO_STATUS_ORDER = [MEMO_STATUS.due, MEMO_STATUS.new, MEMO_STATUS.learning, MEMO_STATUS.done]; // list order
// "<mark>(title):" with full-width brackets and colon (U+FF08 / U+FF09 / U+FF1A), as the notes write them
const MEMO_TITLE_RE = new RegExp('^' + MEMORY_MARK + '\uFF08([^\uFF09]+)\uFF09\uFF1A');

// the memory note inside a note (from the heading word to the end), or null
function memoBodyOf(note) {
  const at = (note || '').indexOf(MEMORY_MARK);
  return at < 0 ? null : note.slice(at);
}
// the chapter most of these questions are in; a tie goes to the lowest chapter
function memoMainChapter(qkeys) {
  const perCh = {};
  qkeys.forEach(k => { const ch = questionByKey(k).q.ch; perCh[ch] = (perCh[ch] || 0) + 1; });
  return Object.keys(perCh).map(Number).sort((a, b) => perCh[b] - perCh[a] || a - b)[0];
}
// question keys per group id (exam order) and the body each titled group shares
function memoMembership() {
  const byTitle = Object.fromEntries(MEMO_GROUPS.map(m => [m.title, m.id]));
  const keys = {}, bodies = {};
  allQuestions().forEach(item => {
    const body = memoBodyOf(item.q.note), title = body && (body.match(MEMO_TITLE_RE) || [])[1];
    const id = body ? byTitle[title] : MEMO_SINGLE_ID;
    if (!id) { console.warn('[memo] no group for memory note', title || body.split('\n')[0]); return; }
    (keys[id] = keys[id] || []).push(qKey(item));
    if (body) bodies[id] = body;
  });
  return { keys, bodies };
}
// MEMO_GROUPS + body (null for the single-note group), qkeys, ch, count (distinct question texts, G40); built once
let memoGroupCache = null;
function memoGroups() {
  if (memoGroupCache) return memoGroupCache;
  const { keys, bodies } = memoMembership();
  memoGroupCache = MEMO_GROUPS.filter(m => keys[m.id]).map(m => ({
    ...m, body: bodies[m.id] || null, qkeys: keys[m.id], ch: memoMainChapter(keys[m.id]), count: questionGroups(keys[m.id]).length,
  }));
  return memoGroupCache;
}
function memoGroupById(id) { return memoGroups().find(g => g.id === id); }
// v2.2.0: a group's title / hook in the UI language (titleEn / hookEn, data/memo.js, in the English UI) and their lang
function memoLocal(g) {
  if (getLang() === EN_LANG && g.titleEn) return { title: g.titleEn, hook: g.hookEn || '', lang: EN_LANG };
  return { title: g.title, hook: g.hook, lang: ZH_HK_LANG };
}

// ── progress: { [group id]: { lv: 0..MEMO_MAX_LV, due: 'YYYY-MM-DD' } } ──
// stored data can be stale or hand-edited (like studyLoad, CUI-0003): unknown ids and bad records are dropped
function isValidMemoRecord(rec) {
  return !!rec && typeof rec === 'object' && Number.isInteger(rec.lv) && rec.lv >= 0 && rec.lv <= MEMO_MAX_LV && isoIsValid(rec.due);
}
function memoLoadProgress() {
  const stored = getLS(MEMO_PROGRESS_LS);
  const progress = {};
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return progress;
  memoGroups().forEach(g => {
    const rec = Object.prototype.hasOwnProperty.call(stored, g.id) ? stored[g.id] : null;
    if (isValidMemoRecord(rec)) progress[g.id] = { lv: rec.lv, due: rec.due };
  });
  return progress;
}
function memoRecord(progress, id) { return progress[id] || null; }
function memoPassed(correct, total) { return total > 0 && correct / total >= MEMO_PASS_RATIO; }
// one finished test, scored over the questions answered (user, review S-232: skipped ones do not count): a pass moves
// up a level (Lv4 stays Lv4) and waits that level's interval; a fail drops a level (W-064, so a Lv4 fail is never
// "known") and comes back tomorrow. Returns { passed, prevLv, lv, due }, or null when nothing was answered: no record
function recordMemoResult(id, correct, answered, today) {
  if (!answered) return null;
  const progress = memoLoadProgress();
  const prevLv = (memoRecord(progress, id) || { lv: 0 }).lv;
  const passed = memoPassed(correct, answered);
  const lv = passed ? Math.min(prevLv + 1, MEMO_MAX_LV) : Math.max(prevLv - MEMO_FAIL_DROP, 0);
  const due = isoAddDays(today, passed ? MEMO_INTERVALS[lv - 1] : MEMO_RETRY_DAYS);
  progress[id] = { lv, due };
  setLS(MEMO_PROGRESS_LS, progress);
  return { passed, prevLv, lv, due };
}

// new = never tested; due = its day has come (overdue too); done = Lv4 waiting; learning = any other level waiting
function memoStatus(rec, today) {
  if (!rec) return MEMO_STATUS.new;
  if (rec.due <= today) return MEMO_STATUS.due;
  return rec.lv === MEMO_MAX_LV ? MEMO_STATUS.done : MEMO_STATUS.learning;
}
function memoDaysUntil(rec, today) { return isoDiffDays(today, rec.due); }
// list order: due, new, learning, done; inside each, more questions first, then MEMO_GROUPS order
function memoSortedGroups(groups, progress, today) {
  const rank = g => MEMO_STATUS_ORDER.indexOf(memoStatus(memoRecord(progress, g.id), today));
  const order = g => MEMO_GROUPS.findIndex(m => m.id === g.id);
  return [...groups].sort((a, b) => rank(a) - rank(b) || b.count - a.count || order(a) - order(b));
}
function memoDueGroups(progress, today) {
  return memoSortedGroups(memoGroups(), progress, today).filter(g => memoStatus(memoRecord(progress, g.id), today) === MEMO_STATUS.due);
}
// a test: up to MEMO_TEST_SIZE distinct questions of the group, a random copy of each, in random order
function memoTestPick(group) {
  return distinctQuestions(group.qkeys.map(questionByKey)).slice(0, MEMO_TEST_SIZE);
}
