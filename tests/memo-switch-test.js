const { chromium } = require('playwright-core');
const { seedLegacyDefaults } = require('./legacy-defaults'); // v1.4.2: keep the old en + small first run
const path = require('path');
// v2.3.0: memory-note study mode on / off (⚙ → Features → "🧠 Memory study mode", on by default; user-confirmed preview
// mockups/memo-switch.html, deleted at release):
// - the row sits between the translation and the plan rows: switch + On / Off pill + note, like the other two
// - off hides the Study 🧠 tab (phone and desktop rail) and the group screen; the stored progress stays
// - off on the memo tab falls back to 📚 Chapters; a stored 'memo' tab reads as Chapters on reload
// - off from the group screen or a group's test asks first (like the plan); confirm → Study, nothing recorded
// - nothing is stored until the user picks (lifeuk.memoEnabled); the choice survives a reload; a toast follows
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const MEMO_ENABLED_LS = 'lifeuk.memoEnabled';
const MEMO_PROGRESS_LS = 'lifeuk.memoProgress';
const STUDY_PREFS_LS = 'lifeuk.studyPrefs';
const ROW = '#settingsMemoRow';
const SWITCH = '#memoFeatureSwitch';
const PILL = '#settingsMemoPill';
const MEMO_TAB = '.study-tab[data-tab="memo"]';
const GUARD_WAIT_MS = 400; // > SCREEN_CHANGE_CLICK_GUARD_MS: a click right after a screen change at the same point is eaten
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
const SEEDED_PROGRESS = { vote: { lv: 2, due: '2099-01-01' } };

const fresh = async pg => {
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear());
  await pg.goto(APP_URL);
};
const stored = (pg, key = MEMO_ENABLED_LS) => pg.evaluate(k => localStorage.getItem(k), key);
const shown = (pg, sel) => pg.evaluate(s => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0; }, sel);
const activeScreen = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
const activeTab = pg => pg.evaluate(() => document.querySelector('.study-tab.active').dataset.tab);
const toastText = pg => pg.$eval('#appToast', e => e.textContent);
const confirmOpen = pg => pg.evaluate(() => isConfirmOpen());
async function toggleMemo(pg) {
  await pg.click('#settingsBtn');
  await pg.click(SWITCH);
}
async function openStudyTab(pg, tab) {
  await pg.evaluate(() => openStudy());
  await pg.waitForTimeout(GUARD_WAIT_MS);
  await pg.click(`.study-tab[data-tab="${tab}"]`);
}

// default on, the row's place and look, a choice, storage, reload
async function checkSwitch(pg) {
  await fresh(pg);
  assert(await stored(pg) === null, 'default: nothing stored');
  await pg.click('#settingsBtn');
  const row = await pg.evaluate(([r, s, p]) => {
    const ids = [...document.querySelectorAll('#settingsFeatures > .plan-setting-row')].map(e => e.id);
    return { ids, checked: document.querySelector(s).getAttribute('aria-checked'), role: document.querySelector(s).getAttribute('role'),
      pill: document.querySelector(p).textContent, pillOn: document.querySelector(p).classList.contains('on'),
      name: document.querySelector(r + ' b').textContent };
  }, [ROW, SWITCH, PILL]);
  assert(await shown(pg, ROW), 'the memo row shows');
  assert(row.ids.join() === 'settingsTransRow,settingsMemoRow,infoPlanRow', 'row order: translation, memo, plan: ' + row.ids);
  assert(row.role === 'switch' && row.checked === 'true' && row.pill === 'On' && row.pillOn, 'default on: switch checked, green On pill');
  assert(row.name === '🧠 Memory study mode', 'en row name: ' + row.name);
  await pg.click(SWITCH);
  assert(!(await shown(pg, '#settingsPop')), 'a choice closes the popover');
  assert(!(await confirmOpen(pg)), 'off from Home: no confirm');
  assert(await stored(pg) === JSON.stringify('off'), 'off is stored');
  assert(await toastText(pg) === 'Memory study mode turned off', 'off toast');
  await pg.click('#settingsBtn');
  const off = await pg.evaluate(([s, p]) => ({ checked: document.querySelector(s).getAttribute('aria-checked'),
    pill: document.querySelector(p).textContent, pillOff: document.querySelector(p).classList.contains('off') }), [SWITCH, PILL]);
  assert(off.checked === 'false' && off.pill === 'Off' && off.pillOff, 'off: switch unchecked, red Off pill');
  await pg.click('#settingsBtn');
  await pg.reload();
  await openStudyTab(pg, 'chapters');
  assert(!(await shown(pg, MEMO_TAB)), 'off survives a reload: no memo tab');
  await toggleMemo(pg);
  assert(await stored(pg) === JSON.stringify('on') && await shown(pg, MEMO_TAB), 'back on: the memo tab shows again');
  assert(await toastText(pg) === 'Memory study mode turned on', 'on toast');
}

// off on the memo tab falls back to Chapters; a stored memo tab reads as Chapters on reload; progress stays
async function checkStudyTab(pg) {
  await fresh(pg);
  await pg.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [MEMO_PROGRESS_LS, SEEDED_PROGRESS]);
  await openStudyTab(pg, 'memo');
  assert(await activeTab(pg) === 'memo', 'on the memo tab');
  await toggleMemo(pg);
  assert(!(await confirmOpen(pg)), 'off on the memo list: no confirm');
  assert(await activeTab(pg) === 'chapters' && !(await shown(pg, MEMO_TAB)), 'off: back on Chapters, memo tab hidden');
  assert(await pg.$$eval('#studyContent .memo-card', els => els.length) === 0, 'off: no memo cards left');
  // a stored memo tab with the mode off
  await pg.evaluate(k => { const p = JSON.parse(localStorage.getItem(k) || '{}'); p.tab = 'memo'; localStorage.setItem(k, JSON.stringify(p)); }, STUDY_PREFS_LS);
  await pg.reload();
  await pg.evaluate(() => openStudy());
  assert(await activeTab(pg) === 'chapters', 'reload with a stored memo tab and the mode off: Chapters');
  await pg.evaluate(() => openMemoGroup('vote'));
  assert(await activeScreen(pg) === 'screenStudy', 'off: a group cannot open');
  const progress = await pg.evaluate(k => JSON.parse(localStorage.getItem(k)), MEMO_PROGRESS_LS);
  assert(JSON.stringify(progress) === JSON.stringify(SEEDED_PROGRESS), 'off keeps the stored progress');
}

// off from the group screen / a group's test asks first; cancel keeps everything, confirm goes to Study unrecorded
async function checkConfirm(pg) {
  await fresh(pg);
  await openStudyTab(pg, 'memo');
  await pg.evaluate(() => openMemoGroup('vote'));
  await pg.waitForTimeout(GUARD_WAIT_MS);
  await toggleMemo(pg);
  assert(await confirmOpen(pg), 'off on the group screen asks first');
  assert(await pg.$eval('#confirmTitle', e => e.textContent) === 'Turn off memory study mode?', 'confirm title');
  await pg.click('#confirmCancel');
  assert(await activeScreen(pg) === 'screenMemo' && await stored(pg) === null, 'cancel: still on the group screen, still on');
  assert(await shown(pg, '#settingsPop'), 'cancel leaves the popover open (nothing was chosen)');
  await pg.click(SWITCH);
  await pg.click('#confirmOk');
  assert(await activeScreen(pg) === 'screenStudy' && await activeTab(pg) === 'chapters', 'confirm: Study, Chapters tab');
  assert(await stored(pg) === JSON.stringify('off') && !(await shown(pg, MEMO_TAB)), 'confirm: off, memo tab hidden');
  // a group's test in progress
  await fresh(pg);
  await openStudyTab(pg, 'memo');
  await pg.evaluate(() => { openMemoGroup('vote'); startMemoTest(); });
  await pg.evaluate(() => { const q = state.questions[0]; state.answers[0] = [...q.a]; revealAnswer(); });
  assert(await activeScreen(pg) === 'screenQuiz' && await pg.evaluate(() => isMemoSession()), 'a memo test is running');
  await pg.waitForTimeout(GUARD_WAIT_MS);
  await toggleMemo(pg);
  assert(await confirmOpen(pg), 'off during a memo test asks first');
  await pg.click('#confirmOk');
  const after = await pg.evaluate(() => ({ side: isSideSession(), screen: document.querySelector('.screen.active').id }));
  assert(!after.side && after.screen === 'screenStudy', 'confirm: the test ends, back on Study');
  assert(await stored(pg, MEMO_PROGRESS_LS) === null, 'the left test records nothing');
}

// zh-HK words
async function checkZh(pg) {
  await fresh(pg);
  await pg.evaluate(() => setLang('zh-HK'));
  await pg.click('#settingsBtn');
  const zh = await pg.evaluate(r => ({ name: document.querySelector(r + ' b').textContent,
    note: document.querySelector('#settingsMemoStatus').textContent }), ROW);
  assert(zh.name === '🧠 記憶法溫習模式', 'zh-HK row name: ' + zh.name);
  assert(zh.note === '已在溫習頁顯示「記憶法」分頁', 'zh-HK on note: ' + zh.note);
  await pg.click(SWITCH);
  assert(await toastText(pg) === '已關閉記憶法溫習模式', 'zh-HK off toast');
  await pg.click('#settingsBtn');
  assert(await pg.$eval('#settingsMemoStatus', e => e.textContent) === '「記憶法」分頁已隱藏，進度會保留', 'zh-HK off note');
  await pg.click('#settingsBtn');
}

// W-385: cancel mid-test keeps the test; confirm hands focus back to ⚙; zh-HK confirm words
async function checkCancelMidTest(pg) {
  await fresh(pg);
  await openStudyTab(pg, 'memo');
  await pg.evaluate(() => { openMemoGroup('vote'); startMemoTest(); });
  await pg.waitForTimeout(GUARD_WAIT_MS);
  await toggleMemo(pg);
  await pg.click('#confirmCancel');
  const r = await pg.evaluate(() => ({ memo: isMemoSession(), screen: document.querySelector('.screen.active').id }));
  assert(r.memo && r.screen === 'screenQuiz' && await stored(pg) === null, 'cancel mid-test: the test goes on, nothing stored');
  await pg.click(SWITCH);
  await pg.click('#confirmOk');
  assert(await pg.evaluate(() => document.activeElement.id) === 'settingsBtn', 'confirm: focus back on ⚙');
  await fresh(pg);
  await pg.evaluate(() => setLang('zh-HK'));
  await openStudyTab(pg, 'memo');
  await pg.evaluate(() => openMemoGroup('vote'));
  await pg.waitForTimeout(GUARD_WAIT_MS);
  await toggleMemo(pg);
  assert(await pg.$eval('#confirmTitle', e => e.textContent) === '關閉記憶法溫習模式？', 'zh-HK confirm title');
  assert(await pg.$eval('#confirmOk', e => e.textContent) === '確定' && await pg.$eval('#confirmCancel', e => e.textContent) === '取消', 'zh-HK confirm buttons');
  await pg.click('#confirmCancel');
}

// W-383 (W-057): a cached pre-v2.3.0 actions.js (no handler) or locale (no row words) hides the row
async function checkMixedCache(pg) {
  await fresh(pg);
  const hidden = await pg.evaluate(() => {
    const keep = ACTIONS.toggleMemoMode;
    ACTIONS.toggleMemoMode = undefined; renderMemoSetting();
    const noAction = byId('settingsMemoRow').hidden;
    ACTIONS.toggleMemoMode = keep;
    const word = LOCALES.en.app.memoSwitchLabel;
    delete LOCALES.en.app.memoSwitchLabel; renderMemoSetting();
    const noWords = byId('settingsMemoRow').hidden;
    LOCALES.en.app.memoSwitchLabel = word; renderMemoSetting();
    return { noAction, noWords, back: byId('settingsMemoRow').hidden };
  });
  assert(hidden.noAction && hidden.noWords && !hidden.back, 'old actions.js / locale: the row hides: ' + JSON.stringify(hidden));
}

// W-384: off from the bottom of the memo list / the group screen opens Study at the top (phone page, desktop panel)
async function checkScroll(b, viewport, label) {
  const pg = await b.newPage({ viewport });
  await fresh(pg);
  await openStudyTab(pg, 'memo');
  const scrollOf = () => pg.evaluate(() => (studyPanelScrolls() ? studyPanel().scrollTop : window.scrollY));
  // the list starts right under the pinned block (phone, studyShowListStart) / the card panel is at its top (desktop)
  const atListStart = () => pg.evaluate(() => {
    if (studyPanelScrolls()) return studyPanel().scrollTop === 0;
    const top = document.querySelector('#screenStudy .study-top');
    return byId('studyCount').getBoundingClientRect().top >= top.getBoundingClientRect().bottom - 1;
  });
  const toBottom = () => pg.evaluate(() => { studyPanel().scrollTop = 1e6; window.scrollTo(0, 1e6); });
  await toBottom();
  assert(await scrollOf() > 0, label + ': the memo list is scrolled');
  await toggleMemo(pg);
  assert(await atListStart(), label + ': off on the list → Chapters from its start');
  await toggleMemo(pg);
  await pg.waitForTimeout(GUARD_WAIT_MS);
  await pg.click(MEMO_TAB);
  await toBottom();
  await pg.evaluate(() => openMemoGroup('vote'));
  await pg.waitForTimeout(GUARD_WAIT_MS);
  await toggleMemo(pg);
  await pg.click('#confirmOk');
  assert(await activeScreen(pg) === 'screenStudy' && await scrollOf() === 0, label + ': off from the group screen → Study from its top');
  await pg.close();
}

// desktop: the rail's 🧠 tab hides too
async function checkDesktop(b) {
  const pg = await b.newPage({ viewport: DESKTOP });
  await fresh(pg);
  await pg.evaluate(() => openStudy());
  assert(await shown(pg, MEMO_TAB), 'desktop: memo tab in the rail');
  await pg.waitForTimeout(GUARD_WAIT_MS);
  await toggleMemo(pg);
  assert(!(await shown(pg, MEMO_TAB)), 'desktop off: memo tab hidden in the rail');
  await pg.close();
}

(async () => {
  const b = seedLegacyDefaults(await chromium.launch(launchOpts));
  const pg = await b.newPage({ viewport: PHONE });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await checkSwitch(pg);
  await checkStudyTab(pg);
  await checkConfirm(pg);
  await checkZh(pg);
  await checkCancelMidTest(pg);
  await checkMixedCache(pg);
  await checkDesktop(b);
  await checkScroll(b, PHONE, 'phone');
  await checkScroll(b, DESKTOP, 'desktop');
  assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close();
  console.log('MEMO SWITCH PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
