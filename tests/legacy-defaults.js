// v1.4.2: the first run is zh-HK + large text (tests/default-settings-test.js). Suites written for the old first run
// (en + small) keep their assertions by seeding those two values on every page before the app's scripts run.
// A key the suite (or the app) already wrote is left alone, so ⚙ choices and stored-value checks still work, and a
// localStorage.clear() followed by a navigation is seeded again. A suite that checks the real first run sets
// sessionStorage[NO_SEED_SS] = '1' (kept across reloads in that tab) to switch the seeding off for that page.
//   const { seedLegacyDefaults } = require('./legacy-defaults');
//   const b = seedLegacyDefaults(await chromium.launch(launchOpts));   // every newPage / newContext is seeded
const LEGACY_DEFAULTS = { 'lifeuk.uiLang': JSON.stringify('en'), 'lifeuk.fontSize': JSON.stringify('small') };
const NO_SEED_SS = 'lifeuk.test.noLegacySeed';

function seedScript([defaults, noSeedKey]) {
  try {
    if (sessionStorage.getItem(noSeedKey) === '1') return;
    for (const [key, value] of Object.entries(defaults)) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    }
  } catch { /* about:blank / opaque origins have no localStorage */ }
}
const seedContext = async ctx => { await ctx.addInitScript(seedScript, [LEGACY_DEFAULTS, NO_SEED_SS]); return ctx; };

// wraps browser.newContext / browser.newPage (a persistent context: pass it to seedContext instead)
function seedLegacyDefaults(browser) {
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...args) => seedContext(await newContext(...args));
  browser.newPage = async (...args) => {
    const ctx = await browser.newContext(...args);
    const page = await ctx.newPage();
    // S-222: like Playwright's own browser.newPage(), closing the page closes the context it owns
    page.once('close', () => { ctx.close().catch(() => {}); });
    return page;
  };
  return browser;
}

module.exports = { LEGACY_DEFAULTS, NO_SEED_SS, seedLegacyDefaults, seedContext };
