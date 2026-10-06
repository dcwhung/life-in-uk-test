// ════════════════════════════════════════
// MIGRATE — moves v0.57-and-earlier unprefixed localStorage keys under LS_PREFIX.
// Runs at load, before js/core/store.js reads storage. Raw strings are copied (never parsed)
// so even malformed values survive; keys outside LEGACY_LS_MIGRATION (other apps) are never touched.
// ════════════════════════════════════════
function migrateLegacyKey(oldKey, newKey) {
  const value = localStorage.getItem(oldKey);
  if (value === null) return;
  if (localStorage.getItem(newKey) === null) {
    localStorage.setItem(newKey, value);
    // only drop the old copy once the new one is confirmed written (quota errors must not lose data)
    if (localStorage.getItem(newKey) !== value) return;
  }
  localStorage.removeItem(oldKey);
}

function migrateLegacyStorage() {
  try {
    Object.entries(LEGACY_LS_MIGRATION).forEach(([oldKey, newKey]) => migrateLegacyKey(oldKey, newKey));
    OBSOLETE_LS.forEach(key => localStorage.removeItem(key));
  } catch (e) {
    // storage blocked or full: leave everything as it is and let the app start
    console.warn('localStorage migration skipped:', e);
  }
}

migrateLegacyStorage();
