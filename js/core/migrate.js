// ════════════════════════════════════════
// MIGRATE — moves v0.57-and-earlier unprefixed localStorage keys under LS_PREFIX.
// Runs at load, before js/core/store.js reads storage. Raw strings are copied (never parsed)
// so even malformed values survive; keys outside LEGACY_LS_MIGRATION (other apps) are never touched.
// A key that cannot be copied (quota, write not kept) stays under its old name for this load
// via LS_KEY_FALLBACK (js/core/utils.js) and is moved on a later load.
// ════════════════════════════════════════
function copyLegacyValue(newKey, value) {
  try {
    localStorage.setItem(newKey, value);
    if (localStorage.getItem(newKey) === value) return true;
    // a wrong value left behind would "win" next load and delete the real data
    localStorage.removeItem(newKey);
  } catch (e) {
    console.warn('localStorage migration: could not write', newKey, e);
  }
  return false;
}

function migrateLegacyKey(oldKey, newKey) {
  const value = localStorage.getItem(oldKey);
  if (value === null) return;
  if (localStorage.getItem(newKey) === null && !copyLegacyValue(newKey, value)) {
    LS_KEY_FALLBACK[newKey] = oldKey;
    return;
  }
  localStorage.removeItem(oldKey);
}

function removeObsoleteKeys() {
  try {
    OBSOLETE_LS.forEach(key => localStorage.removeItem(key));
  } catch (e) {
    console.warn('localStorage cleanup skipped:', e);
  }
}

function migrateLegacyStorage() {
  Object.entries(LEGACY_LS_MIGRATION).forEach(([oldKey, newKey]) => {
    // one key per try: a failure must not stop the others or delete anything
    try { migrateLegacyKey(oldKey, newKey); } catch (e) { console.warn('localStorage migration skipped:', oldKey, e); }
  });
  removeObsoleteKeys();
}

migrateLegacyStorage();
