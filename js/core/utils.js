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
  try { migrateLegacyStorage(); } catch (e) { console.warn('localStorage migration skipped:', e); }
}

function migrateLegacyStorage() {
  // no marker yet: a new key may hold only what a mixed-version page wrote, so both sides are merged
  const mergeBoth = localStorage.getItem(MIGRATED_LS) === null;
  const moved = Object.entries(LEGACY_LS_MIGRATION).map(([oldKey, newKey]) => {
    // one key per try: a failure must not stop the others or delete anything
    try { return migrateLegacyKey(oldKey, newKey, mergeBoth); } catch (e) { console.warn('localStorage migration skipped:', oldKey, e); }
    return false;
  });
  removeObsoleteKeys();
  if (mergeBoth && moved.every(Boolean)) writeMigratedMarker();
}

// true once oldKey is gone; false leaves it in place and in use for this load
function migrateLegacyKey(oldKey, newKey, mergeBoth) {
  const oldValue = localStorage.getItem(oldKey);
  if (oldValue === null) return true;
  const newValue = localStorage.getItem(newKey);
  const value = legacyTargetValue(newKey, oldValue, newValue, mergeBoth);
  if (value !== newValue && !writeVerified(newKey, value, newValue)) {
    LS_KEY_FALLBACK[newKey] = oldKey;
    return false;
  }
  localStorage.removeItem(oldKey);
  return true;
}

function legacyTargetValue(newKey, oldValue, newValue, mergeBoth) {
  if (newValue === null) return oldValue;
  if (!mergeBoth || !MERGE_LS.includes(newKey)) return newValue;
  const older = parsePlainObject(oldValue);
  const newer = parsePlainObject(newValue);
  // per entry: the newer record of a question wins, entries only the old key has are kept
  return older && newer ? JSON.stringify({ ...older, ...newer }) : newValue;
}

function parsePlainObject(raw) {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
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
    if (previous === null) localStorage.removeItem(key); else localStorage.setItem(key, previous);
  } catch {}
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
  try { localStorage.setItem(MIGRATED_LS, APP_VERSION); } catch (e) { console.warn('localStorage marker not written:', e); }
}

// resolved per call so a failed migration keeps reading/writing the old key instead of starting an empty new one
function lsKey(key) {
  ensureLegacyMigrated();
  return LS_KEY_FALLBACK[key] || key;
}
function getLS(key) {
  try { return JSON.parse(localStorage.getItem(lsKey(key))); } catch { return null; }
}
function setLS(key, val) {
  try { localStorage.setItem(lsKey(key), JSON.stringify(val)); } catch {}
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
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  byId(id).classList.add('active');
}
