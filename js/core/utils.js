// ════════════════════════════════════════
// UTILS — small pure helpers, localStorage access (with the lazy legacy-key migration) + DOM shortcuts
// ════════════════════════════════════════
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Return a copy of q with its options in random order and `a` remapped
// to the new positions (applies to both Practice and Exam mode).
function shuffleOptions(q) {
  const order = shuffle(q.o.map((_, i) => i)); // order[newPos] = oldIdx
  return {
    ...q,
    o: order.map(oldIdx => q.o[oldIdx]),
    oy: order.map(oldIdx => (q.oy || [])[oldIdx] || ''),
    a: q.a.map(oldIdx => order.indexOf(oldIdx)).sort((x, y) => x - y),
  };
}

// { q, examNum, origIdx } pool item → session question (shuffled options + its origin)
function toQuestionItem({ q, examNum, origIdx }) {
  return { ...shuffleOptions(q), examNum, origIdx };
}

// every correct option picked and nothing else
function isCorrectAnswer(q, ans) {
  const picked = ans || [];
  return q.a.every(a => picked.includes(a)) && picked.length === q.a.length;
}

// ── storage: getLS / setLS + the lazy v0.58 key migration ──
// The migration lives here (not in its own file) because during the SW cutover a cached v0.57 index.html can
// load v0.58 config / utils / store: any page using lifeuk.* names must migrate before its first read or write.
// A key only under its old name is copied as the raw string (never parsed, so malformed values survive);
// keys outside LEGACY_LS_MIGRATION (other apps) are never touched.

// new key → legacy key for keys that could not be moved this load; reads / writes stay on the old key
const LS_KEY_FALLBACK = {};
let legacyMigrationRan = false;

function ensureLegacyMigrated() {
  if (legacyMigrationRan) return;
  legacyMigrationRan = true;
  // a v0.57 config.js next to this file (the opposite mix) has no table and still uses the unprefixed keys
  if (typeof LEGACY_LS_MIGRATION === 'undefined') return;
  try {
    migrateLegacyStorage();
  } catch (e) {
    console.warn('localStorage migration skipped:', e);
  }
  try {
    migrateFactIds();
  } catch (e) {
    console.warn('fact id migration skipped:', e);
  }
}

// ── v1.2.1: merged STUDY facts (FACT_ID_MERGES) — move fact-id keyed progress to the kept id, once per old id ──
function migrateFactIds() {
  if (typeof FACT_ID_MERGES === 'undefined') return;
  const all = Object.entries(FACT_ID_MERGES).map(([oldId, keptId]) => [Number(oldId), keptId]);
  // W-057: the plan moves on every load (an old id never comes back, so it is a no-op once clean): a still-open older
  // tab may write its plan back with the old id after the marks moved, and a plan that does not parse is lost
  rewriteStoredJson(STUDY_PLAN_LS, v => mergePlanFacts(v, all));
  const done = mergedFactIds();
  const todo = all.filter(([oldId]) => !done.includes(oldId));
  if (!todo.length) return;
  const moved = FACT_ID_MAP_LS.map(key => rewriteStoredJson(key, v => mergeFactMap(v, todo)));
  // the marker (marks only) is written once something moved: storage with no old id stays untouched (and is checked
  // again, so an old id a cached older page writes during the SW cutover still moves on the next load)
  if (moved.some(Boolean)) localStorage.setItem(FACT_MERGE_LS, JSON.stringify([...done, ...todo.map(([oldId]) => oldId)]));
}
function mergedFactIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(FACT_MERGE_LS));
    return Array.isArray(ids) ? ids : [];
  } catch { return []; }
}
// a value that does not parse is left as stored (the screen that owns it decides); fn returns undefined = no change.
// Returns whether it wrote.
// S-195: with a legacy fallback both names are rewritten, so the next legacy merge cannot bring the old id back
function rewriteStoredJson(key, fn) {
  return [...new Set([key, LS_KEY_FALLBACK[key] || key])].map(name => rewriteStoredName(name, fn)).some(Boolean);
}
function rewriteStoredName(name, fn) {
  const raw = localStorage.getItem(name);
  if (raw === null) return false;
  let value;
  try { value = JSON.parse(raw); } catch { return false; }
  const next = fn(value);
  if (next === undefined) return false;
  localStorage.setItem(name, JSON.stringify(next));
  return true;
}
// { [factId]: mark }: the kept id keeps its own mark, else takes the merged one's (OR)
function mergeFactMap(map, todo) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return undefined;
  const hits = todo.filter(([oldId]) => oldId in map);
  hits.forEach(([oldId, keptId]) => { if (!map[keptId]) map[keptId] = map[oldId]; delete map[oldId]; });
  return hits.length ? map : undefined;
}
// the saved plan's tasks list fact ids (read tasks; filled-in wrong-answer tasks also keep anchor { [factId]: qkey }):
// old → kept, no duplicate within a task
function mergePlanFacts(plan, todo) {
  if (!plan || !Array.isArray(plan.days)) return undefined;
  const ids = new Map(todo);
  let changed = false;
  plan.days.forEach(day => (Array.isArray(day && day.tasks) ? day.tasks : []).forEach(task => {
    if (!task || !Array.isArray(task.facts) || !task.facts.some(id => ids.has(id))) return;
    task.facts = [...new Set(task.facts.map(id => (ids.has(id) ? ids.get(id) : id)))];
    if (task.anchor && typeof task.anchor === 'object') mergeFactMap(task.anchor, todo); // S-196
    changed = true;
  }));
  return changed ? plan : undefined;
}

function migrateLegacyStorage() {
  // no marker yet: a new key may hold only what a mixed-version page wrote, so both sides are merged
  const mergeBoth = localStorage.getItem(MIGRATED_LS) === null;
  const oldWinsKeys = readFallbackRecord();
  const stillOld = [];
  const moved = Object.entries(LEGACY_LS_MIGRATION).map(([oldKey, newKey]) => {
    const oldWins = oldWinsKeys.includes(newKey);
    const done = migrateKeySafely(oldKey, newKey, { merge: mergeBoth || oldWins, oldWins });
    // the old key carries this load's writes while the new key keeps an older value: next load the old side wins
    if (LS_KEY_FALLBACK[newKey] && localStorage.getItem(newKey) !== null) {
      stillOld.push(newKey);
    }
    return done;
  });
  removeObsoleteKeys();
  writeFallbackRecord(stillOld);
  if (mergeBoth && moved.every(Boolean)) writeMigratedMarker();
}

function migrateKeySafely(oldKey, newKey, rule) {
  // one key per try: a failure must not stop the others or delete anything
  try {
    return migrateLegacyKey(oldKey, newKey, rule);
  } catch (e) {
    console.warn('localStorage migration skipped:', oldKey, e);
  }
  return false;
}

// true once oldKey is gone; false leaves it in place and in use for this load
function migrateLegacyKey(oldKey, newKey, rule) {
  const oldValue = localStorage.getItem(oldKey);
  if (oldValue === null) return true;
  const newValue = localStorage.getItem(newKey);
  const value = legacyTargetValue(newKey, oldValue, newValue, rule);
  if (value !== newValue && !writeNewValue(oldKey, newKey, { value, oldValue, newValue })) return false;
  localStorage.removeItem(oldKey);
  return true;
}

// false keeps the old key; LS_KEY_FALLBACK sends this load's writes to it only when the next load cannot lose them
function writeNewValue(oldKey, newKey, { value, oldValue, newValue }) {
  // the stale new value must not win the next merge: record it first (W-004) or, failing that, fold it into the old key
  const recorded = newValue === null || reserveFallbackRecord(newKey);
  if (recorded && writeVerified(newKey, value, newValue)) return true;
  if (recorded || foldIntoOldKey(oldKey, newKey, value, oldValue)) {
    LS_KEY_FALLBACK[newKey] = oldKey;
  }
  // otherwise (nothing writable) stay on the new key: its writes win the next merge and the old key is kept
  return false;
}

function reserveFallbackRecord(newKey) {
  const keys = readFallbackRecord();
  if (keys.includes(newKey)) return true;
  return writeVerified(MIGRATE_FALLBACK_LS, JSON.stringify([...keys, newKey]), localStorage.getItem(MIGRATE_FALLBACK_LS));
}

// no record possible: the old key takes the merged value and the stale new key goes, so only one copy is left
function foldIntoOldKey(oldKey, newKey, value, oldValue) {
  if (!writeVerified(oldKey, value, oldValue)) return false;
  localStorage.removeItem(newKey);
  return true;
}

// rule.merge: combine both sides (else the new key wins); rule.oldWins: the old side wins conflicts
function legacyTargetValue(newKey, oldValue, newValue, rule) {
  if (newValue === null) return oldValue;
  if (!rule.merge) return newValue;
  const [base, winner] = rule.oldWins ? [newValue, oldValue] : [oldValue, newValue];
  if (!MERGE_LS.includes(newKey)) return winner;
  const under = parsePlainObject(base);
  const over = parsePlainObject(winner);
  // per entry: the winning side's record of a question wins, entries only the other side has are kept
  return under && over ? JSON.stringify({ ...under, ...over }) : winner;
}

function readFallbackRecord() {
  try {
    const keys = JSON.parse(localStorage.getItem(MIGRATE_FALLBACK_LS));
    return Array.isArray(keys) ? keys : [];
  } catch {
    return [];
  }
}

function writeFallbackRecord(newKeys) {
  try {
    if (newKeys.length) {
      localStorage.setItem(MIGRATE_FALLBACK_LS, JSON.stringify(newKeys));
    } else {
      localStorage.removeItem(MIGRATE_FALLBACK_LS);
    }
  } catch (e) {
    console.warn('localStorage fallback record not written:', e);
  }
}

function parsePlainObject(raw) {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function writeVerified(key, value, previous) {
  try {
    localStorage.setItem(key, value);
    if (localStorage.getItem(key) === value) return true;
  } catch (e) {
    console.warn('localStorage migration: could not write', key, e);
  }
  // a wrong value left behind would "win" next load and delete the real data
  try {
    if (previous === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, previous);
    }
  } catch (e) {
    console.warn('localStorage migration: could not restore', key, e);
  }
  return false;
}

function removeObsoleteKeys() {
  try {
    OBSOLETE_LS.forEach(key => localStorage.removeItem(key));
  } catch (e) {
    console.warn('localStorage cleanup skipped:', e);
  }
}

function writeMigratedMarker() {
  try {
    localStorage.setItem(MIGRATED_LS, APP_VERSION);
  } catch (e) {
    console.warn('localStorage marker not written:', e);
  }
}

// resolved per call so a failed migration keeps reading/writing the old key instead of starting an empty new one
function lsKey(key) {
  ensureLegacyMigrated();
  return LS_KEY_FALLBACK[key] || key;
}
function getLS(key) {
  try { return JSON.parse(localStorage.getItem(lsKey(key))); } catch { return null; }
}
function getRawLS(key) {
  try { return localStorage.getItem(lsKey(key)); } catch { return null; }
}
function setLS(key, val) {
  try { localStorage.setItem(lsKey(key), JSON.stringify(val)); } catch {}
}
function removeLS(key) {
  try { localStorage.removeItem(lsKey(key)); } catch {}
}

// Escape text for safe insertion into innerHTML.
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const pad2 = n => String(n).padStart(2, '0');
const keysOf = obj => Object.keys(obj).filter(k => obj[k]);
const percent = (part, whole) => (whole ? Math.round((part / whole) * PERCENT) : 0);

const byId = id => document.getElementById(id);
function setShown(id, visible) { byId(id).hidden = !visible; }
function showScreen(id) {
  // S-098: focus left on a button of the screen being hidden (e.g. restored there by closeConfirm) would still
  // take a stray Enter, so drop it
  const focused = document.activeElement;
  if (focused && focused.closest('.screen') && !byId(id).contains(focused)) focused.blur();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  byId(id).classList.add('active');
}
