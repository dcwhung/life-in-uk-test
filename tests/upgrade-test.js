const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startPagesServer, appFiles } = require('./pages-server');
// v0.57 → v0.58 upgrade (CUI-0004): legacy progress must survive every mix of old and new files.
//   1. mixed shell: the v0.57 index.html (no migrate tag) + v0.58 js — the storage layer migrates lazily
//   2. opposite mix: v0.57 files + v0.58 utils.js — no throw, v0.57 keys still read
//   3. real service-worker upgrade over http: v0.57 SW → deploy current → reloads → byte-exact values, same UI
//   4. third mix: v0.58 files + the v0.57 utils.js (no lazy migration) — the next full load's merge keeps everything
//   5. S-014: mixed shell whose locale file fails to load — one reload, then an English fallback message (no half-started page)
//      W-010: the current shell (all tags present) whose i18n.js fails to load — same reload + fallback
//      S-041: the current shell whose locales/en.js fails to load — same fallback; zh-HK.js's ReferenceError is known
//   6. v0.65 (T-008): an older cached shell without the zh-HK tag + a stored uiLang 'zh-HK' — en, no warning,
//      the stored choice kept for the next full load
//   7. W-013: the current shell whose locales/zh-HK.js failed to load — the language pill is hidden (not a dead button)
// The v0.57 files come from git: V057_REF is the last v0.57 commit on main (merge of PR #29), pinned so a later
// main does not silently turn this into a same-version test.
const ROOT = path.resolve(__dirname, '..');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const V057_REF = process.env.V057_REF || 'dc84cab549bf6dab4148d04a65a4ca60c831bcc1';
// v0.57 had no icons / manifest; the current copy follows sw.js SHELL (appFiles)
const V057_FILES = ['index.html', 'sw.js', 'data', 'css', 'js'];
const P = 'lifeuk.';
const MARKER = P + 'migrated';
const PLAN_LS_PREFIX = P + 'studyPlan'; // studyPlan, studyPlanProgress, studyPlanEnabled
const CURRENT_VERSION = fs.readFileSync(path.join(ROOT, 'js/core/config.js'), 'utf8').match(/const APP_VERSION = '([^']+)'/)[1];
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const LEGACY = {
  completedExams: '{"1":true,"2":true,"3":true,"4":true,"5":true}',
  homePrefs: '{"mode":"practice","view":"chapter"}',
  practiceFlags: '{"9.13":true,"13.18":true,"6.17":true,"16.0":true,"12.2":true}',
  practiceStreak: '{"1.0":3, "1.1":3, "1.2":1, "2.5":3, "3.4":2, "7.7":0}',
  reviewOrder: 'original',
  studyBookmarks: '{"7":true}',
  studyMastered: '{"12":true,"40":true}',
  studyPrefs: '{"tab":"geo","chapter":4,"hideMastered":false,"bookmarksOnly":false}',
  wrongList: '{"3.4":true,"8.1":true}',
};
const FOREIGN = { 'run365.prefs': '{"units":"km","goal":365}', 'tripspend.settings.v1': '{"home":"HKD"}' };
const LEGACY_NAMES = Object.keys(LEGACY).filter(k => k !== 'reviewOrder');

const tmpDirs = [];
const tmpDir = tag => { const d = fs.mkdtempSync(path.join(os.tmpdir(), `lifeuk-${tag}-`)); tmpDirs.push(d); return d; };
const cleanUp = () => tmpDirs.forEach(d => fs.rmSync(d, { recursive: true, force: true }));
const copyCurrent = dir => appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true }));
const extractV057 = dir => execFileSync('sh', ['-c', `git -C "${ROOT}" archive ${V057_REF} ${V057_FILES.join(' ')} | tar -x -C "${dir}"`]);
const showV057 = file => execFileSync('git', ['-C', ROOT, 'show', `${V057_REF}:${file}`]);
const emptyDir = dir => fs.readdirSync(dir).forEach(f => fs.rmSync(path.join(dir, f), { recursive: true, force: true }));

const dump = pg => pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
const seed = async (pg, kv) => {
  await pg.evaluate(kv => { localStorage.clear(); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, kv);
  await pg.reload();
};
const text = (pg, sel) => pg.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
// home + study state as the user sees it (same globals in v0.57 and v0.58)
const captureUI = pg => pg.evaluate(() => {
  const t = sel => [...document.querySelectorAll(sel)].map(e => e.textContent.replace(/\s+/g, ' ').trim());
  const snap = { mode: pendingMode, view: practiceView, flagged: t('#tileFlagged .t-num')[0], wrong: t('#tileWrong .t-num')[0] };
  const saved = pendingMode;
  pendingMode = 'practice'; buildExamGrid();
  snap.examMastery = t('#examGrid .exam-btn .exam-mastery'); snap.chapterMastery = t('#chapterGrid button');
  pendingMode = 'exam'; buildExamGrid();
  snap.done = [...document.querySelectorAll('#examGrid .exam-btn.done')].map(e => e.dataset.arg);
  pendingMode = saved; buildExamGrid();
  openStudy();
  snap.studyTab = (document.querySelector('.study-tab.active') || {}).dataset.tab;
  snap.mastered = keysOf(study.mastered).sort(); snap.bookmarks = keysOf(study.bookmarks).sort();
  showScreen('screenHome');
  return snap;
});

// 1. CUI-0004: v0.57 index.html + v0.58 js — progress shows, an answer there does not cost the legacy history
async function mixedShell(b) {
  const dir = tmpDir('mixed');
  copyCurrent(dir);
  fs.writeFileSync(path.join(dir, 'v057.html'), showV057('index.html'));
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(dir, 'v057.html'));
  assert(await pg.evaluate(() => !document.querySelector('script[src="js/core/migrate.js"]') && APP_VERSION) === CURRENT_VERSION, `mixed shell: v0.57 index.html running v${CURRENT_VERSION} js`);
  await seed(pg, { ...LEGACY, ...FOREIGN });
  // v0.59: the old shell has no locale / i18n tags; main.js loads them, then starts (async)
  await pg.waitForSelector('#examGrid .exam-btn', { state: 'attached' });
  assert(await pg.evaluate(() => typeof t === 'function' && !!document.querySelector('script[src="locales/en.js"]') && document.title === t('app.title')), 'mixed shell: missing locale + i18n scripts loaded at start-up');
  assert(await pg.evaluate(() => typeof isSideSession === 'function' && !!document.querySelector('script[src="js/screens/sideSession.js"]')), 'mixed shell: missing sideSession.js loaded at start-up (v0.62)');
  assert(await pg.evaluate(() => typeof factCardHtml === 'function' && !!document.querySelector('script[src="js/components/factCard.js"]')), 'mixed shell: missing factCard.js loaded at start-up (v0.63)');
  assert(await pg.evaluate(() => !!document.querySelector('link[rel="stylesheet"][href="css/components/fact.css"]')), 'mixed shell: missing fact.css stylesheet added at start-up (v0.63: .fact* / .sqm-fact* rules moved there)');
  // study plan (arch R1): mastery.js / result.js call recordPlanAnswer / recordPlanMock on every answer / submit
  assert(await pg.evaluate(() => typeof recordPlanAnswer === 'function' && typeof recordPlanMock === 'function'
    && ['js/domain/plan.js', 'js/domain/planProgress.js'].every(src => !!document.querySelector(`script[src="${src}"]`))), 'mixed shell: missing plan.js + planProgress.js loaded at start-up (PR2 hooks)');
  assert((await text(pg, '#examGrid .exam-btn.all .exam-mastery')).startsWith('3/408'), 'mixed shell: legacy mastery shown (3/408)');
  assert((await text(pg, '#tileFlagged .t-num')) === '5', 'mixed shell: legacy Flagged 5 shown');
  const newKey = await pg.evaluate(() => {
    pendingMode = 'practice'; startExam('ch4');
    const i = state.questions.findIndex(q => !(qKey(q) in streaks));
    const q = state.questions[i]; state.current = i; state.answers[i] = [...q.a]; revealAnswer();
    return qKey(q);
  });
  // PR2: an Exam-mode submit runs the plan mock hook too (no plan stored → nothing written, R3)
  await pg.evaluate(() => { startExam(2, EXAM_MODE); finishExam(); leaveToHome(); });
  assert(!Object.keys(await dump(pg)).some(k => k.startsWith(PLAN_LS_PREFIX)), 'mixed shell: an answer and an exam submit with no plan write no study plan key');
  await pg.goto('file://' + path.join(dir, 'index.html'));
  const s = await dump(pg);
  const streak = JSON.parse(s[P + 'practiceStreak']);
  const legacyStreak = JSON.parse(LEGACY.practiceStreak);
  assert(Object.entries(legacyStreak).every(([k, v]) => streak[k] === v) && streak[newKey] === 1, 'current index.html: every legacy streak + the new answer kept');
  assert(LEGACY_NAMES.every(k => k !== 'practiceStreak' ? s[P + k] === LEGACY[k] : true), 'current index.html: other legacy values byte-exact under lifeuk.*');
  assert(LEGACY_NAMES.every(k => !(k in s)) && MARKER in s, 'current index.html: legacy keys gone, marker written');
  assert(Object.entries(FOREIGN).every(([k, v]) => s[k] === v), "mixed shell: other apps' keys untouched");
  assert((await text(pg, '#examGrid .exam-btn.all .exam-mastery')).startsWith('3/408'), 'current index.html: UI still 3/408');
  assert(errs.length === 0, 'mixed shell: no page errors: ' + errs.join(' | '));
  await pg.close();
}

// CUI-0021: a pre-PR3 cached index.html (no #screenPlanGoal / #infoPlanRow / #appToast) + current js with the
// study plan entry on (v1.1.0): no create card (it would open a screen the shell lacks), no ⓘ row, no page error
const PRE_PLAN_UI_REF = '4dc89b2';
async function prePlanUiShell(b) {
  const dir = tmpDir('preplanui');
  copyCurrent(dir);
  fs.writeFileSync(path.join(dir, 'old.html'), execFileSync('git', ['-C', ROOT, 'show', `${PRE_PLAN_UI_REF}:index.html`]));
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(dir, 'old.html'));
  await seed(pg, {});
  await pg.waitForSelector('#examGrid .exam-btn', { state: 'attached' });
  assert(await pg.evaluate(() => typeof renderPlanCard === 'function' && !document.getElementById('screenPlanGoal')), 'pre-PR3 shell: planHome.js loaded, no goal screen markup');
  assert(await pg.evaluate(() => !document.getElementById('planCard')), 'pre-PR3 shell: no create card (CUI-0021)');
  await pg.evaluate(() => { openPlanGoal(); document.getElementById('infoBtn').click(); });
  assert(await pg.evaluate(() => document.querySelector('.screen.active').id) === 'screenHome', 'pre-PR3 shell: openPlanGoal() stays on Home');
  assert(errs.length === 0, 'pre-PR3 shell: no page errors: ' + errs.join(' | '));
  await pg.close();
}

// CUI-0021 (PR4): a PR3 shell has the goal screen but no schedule: "Build" would open nothing, so no card either
const PR3_SHELL_REF = '8bcb5ee'; // main after the PR3 merge (#61)
async function pr3Shell(b) {
  const dir = tmpDir('pr3shell');
  copyCurrent(dir);
  fs.writeFileSync(path.join(dir, 'old.html'), execFileSync('git', ['-C', ROOT, 'show', `${PR3_SHELL_REF}:index.html`]));
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(dir, 'old.html'));
  await seed(pg, {});
  await pg.waitForSelector('#examGrid .exam-btn', { state: 'attached' });
  assert(await pg.evaluate(() => typeof openPlanSchedule === 'function' && !!document.getElementById('screenPlanGoal') && !document.getElementById('screenPlanSchedule')),
    'PR3 shell: planSchedule.js late-loaded, goal screen markup but no schedule');
  assert(await pg.evaluate(() => !document.getElementById('planCard')), 'PR3 shell: no plan card (CUI-0021)');
  await pg.evaluate(() => { openPlanGoal(); openPlanSchedule(); });
  assert(await pg.evaluate(() => document.querySelector('.screen.active').id) === 'screenHome', 'PR3 shell: plan screens stay closed');
  assert(errs.length === 0, 'PR3 shell: no page errors: ' + errs.join(' | '));
  await pg.close();
}

// CUI-0021 (PR5): a PR4 shell has the goal + schedule screens but no day screen: its card's "Continue" and the
// schedule rows would open nothing, so no card; a stored plan and its log are left exactly as they were
const PR4_SHELL_REF = 'e7f41a9'; // main after the PR4 merge (#62)
async function pr4Shell(b) {
  const dir = tmpDir('pr4shell');
  copyCurrent(dir);
  fs.writeFileSync(path.join(dir, 'old.html'), execFileSync('git', ['-C', ROOT, 'show', `${PR4_SHELL_REF}:index.html`]));
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(dir, 'old.html'));
  await seed(pg, {});
  await pg.evaluate(() => writeStudyPlan(buildPlan({ examDate: isoAddDays(planTodayIso(), 21), dailyMins: 60, restDays: [0], level: 'none' }, planTodayIso())));
  await pg.reload();
  await pg.waitForSelector('#examGrid .exam-btn', { state: 'attached' });
  const stored = await pg.evaluate(() => localStorage.getItem(STUDY_PLAN_LS));
  assert(await pg.evaluate(() => typeof openPlanDay === 'function' && typeof planWatchDay === 'function' && !!document.getElementById('screenPlanSchedule') && !document.getElementById('screenPlanDay')),
    'PR4 shell: planDay.js late-loaded, schedule markup but no day screen');
  assert(await pg.evaluate(() => !document.getElementById('planCard')), 'PR4 shell + plan: no plan card (CUI-0021)');
  await pg.evaluate(() => { openPlanDay(); openPlanSchedule(); });
  assert(await pg.evaluate(() => document.querySelector('.screen.active').id) === 'screenHome', 'PR4 shell: plan screens stay closed');
  assert(await pg.evaluate(() => localStorage.getItem(STUDY_PLAN_LS)) === stored, 'PR4 shell: the stored plan is not touched (G9 snapshot waits for the new shell)');
  assert(errs.length === 0, 'PR4 shell: no page errors: ' + errs.join(' | '));
  await pg.close();
}

// 5. S-014: the old shell's locale fetch fails (file missing) — main.js reloads once, then shows its fallback text
const I18N_BOOT_FALLBACK = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8').match(/const I18N_BOOT_FALLBACK_MSG =\s*'([^']+)'/);
const BOOT_SETTLE_MS = 1000;
// W-010: same for the current shell (every tag present) when js/core/i18n.js fails — the tag alone must not count as loaded
async function i18nBootFailure(b, { tag, shell, missing, knownError = null }) {
  const dir = tmpDir('noi18n');
  copyCurrent(dir);
  if (shell === 'v057.html') fs.writeFileSync(path.join(dir, shell), showV057('index.html'));
  fs.rmSync(path.join(dir, missing));
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  // main-frame navigations, not 'load': the reload can happen before the first load event fires
  let loads = 0; pg.on('framenavigated', f => { if (f === pg.mainFrame()) loads++; });
  await pg.goto('file://' + path.join(dir, shell));
  await pg.waitForTimeout(BOOT_SETTLE_MS);
  assert(loads === 2, `${tag}: exactly one reload (${loads} page loads)`);
  assert(I18N_BOOT_FALLBACK, 'main.js names an I18N_BOOT_FALLBACK_MSG');
  const grid = await text(pg, '#examGrid');
  assert(grid === I18N_BOOT_FALLBACK[1], `${tag}: after the reload #examGrid shows the English fallback: ` + grid);
  const unexpected = knownError ? errs.filter(e => !knownError.test(e)) : errs;
  assert(unexpected.length === 0, `${tag}: no page errors${knownError ? ` (known, exempt: ${knownError})` : ''}: ` + unexpected.join(' | '));
  await pg.close();
}
// S-041: with the current shell and en.js missing, locales/zh-HK.js runs before LOCALES exists and throws on each of
// the two loads; the S-014 fallback still shows. Recorded as known behaviour (review v0.65 S-041, option A).
const ZH_HK_WITHOUT_EN_ERROR = /^LOCALES is not defined$/;

// 6. T-008: a v0.64-style shell (no locales/zh-HK.js tag, no language pill) running the current js while
// lifeuk.uiLang says zh-HK — the language has no locale on that page, so it reads as en without warnings and
// without rewriting the stored value; the current shell then opens in zh-HK
const ZH_HK_TAG = /[ \t]*<script src="locales\/zh-HK\.js"><\/script>\n/;
const LANG_PILL = /[ \t]*<button class="lang-btn"[^\n]*<\/button>\n/;
async function oldShellZhHk(b) {
  const dir = tmpDir('zhshell');
  copyCurrent(dir);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(ZH_HK_TAG.test(html) && LANG_PILL.test(html), 'current index.html has the zh-HK script tag and the language pill');
  fs.writeFileSync(path.join(dir, 'v064.html'), html.replace(ZH_HK_TAG, '').replace(LANG_PILL, ''));
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const warns = []; pg.on('console', m => { if (m.type() === 'warning') warns.push(m.text()); });
  await pg.goto('file://' + path.join(dir, 'v064.html'));
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.uiLang', JSON.stringify('zh-HK')); });
  warns.length = 0;
  await pg.reload();
  await pg.waitForSelector('#examGrid .exam-btn', { state: 'attached' });
  const old = await pg.evaluate(() => ({ lang: getLang(), html: document.documentElement.lang, zh: 'zh-HK' in LOCALES, mode: byId('modeStudy').textContent.trim() }));
  assert(old.lang === 'en' && old.html === 'en' && !old.zh, 'old shell + stored zh-HK: runs in en: ' + JSON.stringify(old));
  assert(warns.filter(w => w.includes('[i18n]')).length === 0, 'old shell + stored zh-HK: no i18n warnings: ' + warns.join(' | '));
  assert(await pg.evaluate(() => localStorage.getItem('lifeuk.uiLang')) === JSON.stringify('zh-HK'), 'old shell: stored uiLang zh-HK not overwritten');
  await pg.goto('file://' + path.join(dir, 'index.html'));
  assert(await pg.evaluate(() => getLang() === 'zh-HK' && document.documentElement.lang === 'zh-HK'), 'current shell: the stored zh-HK applies');
  assert(errs.length === 0, 'old shell + zh-HK: no page errors: ' + errs.join(' | '));
  await pg.close();
}

// 7. W-013: current shell, locales/zh-HK.js missing — nothing to switch to, so the pill is hidden; en runs cleanly
async function zhHkLocaleMissing(b) {
  const dir = tmpDir('nozh');
  copyCurrent(dir);
  fs.rmSync(path.join(dir, 'locales/zh-HK.js'));
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(dir, 'index.html'));
  await pg.evaluate(() => localStorage.clear()); await pg.reload();
  await pg.waitForSelector('#examGrid .exam-btn', { state: 'attached' });
  const pill = await pg.evaluate(() => { const e = byId('langBtn'); return { hidden: e.hidden, shown: e.getClientRects().length > 0, lang: getLang() }; });
  assert(pill.hidden && !pill.shown && pill.lang === 'en', 'current shell, zh-HK.js missing: language pill hidden, en: ' + JSON.stringify(pill));
  assert(errs.length === 0, 'current shell, zh-HK.js missing: no page errors: ' + errs.join(' | '));
  await pg.close();
}

// 2. v0.57 config.js (no LEGACY_LS_MIGRATION) + v0.58 utils.js: must not throw, keeps using the v0.57 keys
async function oppositeMix(b) {
  const dir = tmpDir('opposite');
  extractV057(dir);
  fs.copyFileSync(path.join(ROOT, 'js/core/utils.js'), path.join(dir, 'js/core/utils.js'));
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(dir, 'index.html'));
  await seed(pg, LEGACY);
  assert((await text(pg, '#examGrid .exam-btn.all .exam-mastery')).startsWith('3/408'), 'opposite mix: v0.57 keys read (3/408)');
  assert(JSON.stringify(await dump(pg)) === JSON.stringify(Object.fromEntries(Object.entries(LEGACY).sort())), 'opposite mix: storage untouched');
  assert(errs.length === 0, 'opposite mix: no page errors: ' + errs.join(' | '));
  await pg.close();
}

// 4. W-005: v0.58 config / store with the v0.57 utils.js — that page reads and writes lifeuk.* without migrating;
// the old keys must survive it and the next full v0.58 load must merge them with what it wrote
async function v057UtilsMix(b) {
  const dir = tmpDir('utils57');
  copyCurrent(dir);
  const utilsPath = path.join(dir, 'js/core/utils.js');
  fs.writeFileSync(utilsPath, showV057('js/core/utils.js'));
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(dir, 'index.html'));
  await seed(pg, LEGACY);
  const newKey = await pg.evaluate(() => {
    pendingMode = 'practice'; startExam('ch4');
    const i = state.questions.findIndex(q => !(qKey(q) in streaks));
    const q = state.questions[i]; state.current = i; state.answers[i] = [...q.a]; revealAnswer();
    return qKey(q);
  });
  let s = await dump(pg);
  assert(s.practiceStreak === LEGACY.practiceStreak && P + 'practiceStreak' in s && !(MARKER in s), 'v0.57 utils page: wrote lifeuk.practiceStreak, old key untouched, no marker');
  fs.copyFileSync(path.join(ROOT, 'js/core/utils.js'), utilsPath);
  await pg.reload();
  s = await dump(pg);
  const streak = JSON.parse(s[P + 'practiceStreak']);
  assert(Object.entries(JSON.parse(LEGACY.practiceStreak)).every(([k, v]) => streak[k] === v) && streak[newKey] === 1, 'next full load: every legacy streak + the answer from the v0.57-utils page');
  const maps = ['completedExams', 'practiceFlags', 'wrongList', 'studyMastered', 'studyBookmarks'];
  assert(maps.every(k => Object.keys(JSON.parse(LEGACY[k])).every(e => JSON.parse(s[P + k])[e] === true)), 'next full load: every legacy map entry kept');
  assert(LEGACY_NAMES.every(k => !(k in s)) && MARKER in s, 'next full load: old keys gone, marker written');
  assert(errs.length === 0, 'v0.57 utils mix: no page errors: ' + errs.join(' | '));
  await pg.close();
}

// wait until the new worker controls the page and the old lifeuk cache is gone (install → skipWaiting → claim)
const waitForCache = (pg, cache) => pg.evaluate(async cache => {
  const reg = await navigator.serviceWorker.getRegistration();
  for (let i = 0; i < 100; i++) {
    const keys = await caches.keys();
    const settled = keys.includes(cache) && keys.filter(k => k.startsWith('lifeuk-v')).length === 1;
    if (settled && !reg.installing && !reg.waiting && navigator.serviceWorker.controller) return true;
    if (!reg.installing && !reg.waiting) await reg.update().catch(() => {});
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}, cache);

// 3. port of QA's upgrade-sim core: v0.57 SW installed → deploy current files in place → reload until v0.58 runs.
// It checks the end state of a real upgrade; it does not force the SW cutover race (case 1 covers that deterministically).
async function swUpgrade(b) {
  const dir = tmpDir('upgrade');
  extractV057(dir);
  const { base, server } = await startPagesServer(dir);
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(base);
    assert(await waitForCache(pg, 'lifeuk-v0.57'), 'v0.57 SW installed and controlling');
    await seed(pg, { ...LEGACY, ...FOREIGN });
    const ls57 = await dump(pg); const ui57 = await captureUI(pg);
    assert(await pg.evaluate(() => APP_VERSION) === '0.57' && ls57.practiceStreak === LEGACY.practiceStreak, 'v0.57 running on the legacy keys');
    emptyDir(dir); copyCurrent(dir);
    await pg.reload();
    assert(await waitForCache(pg, 'lifeuk-v' + CURRENT_VERSION), `v${CURRENT_VERSION} SW activated, v0.57 cache deleted`);
    await pg.reload();
    assert(await pg.evaluate(() => APP_VERSION) === CURRENT_VERSION, `reload: v${CURRENT_VERSION} js runs`);
    const ls = await dump(pg);
    assert(LEGACY_NAMES.every(k => ls[P + k] === LEGACY[k]), 'every legacy value byte-exact under lifeuk.*');
    assert(LEGACY_NAMES.every(k => !(k in ls)) && !('reviewOrder' in ls), 'legacy keys + reviewOrder gone');
    assert(Object.entries(FOREIGN).every(([k, v]) => ls[k] === v), "other apps' keys byte-identical");
    const extra = Object.keys(ls).filter(k => !(k in FOREIGN) && !(k.startsWith(P) && k.slice(P.length) in LEGACY));
    assert(JSON.stringify(extra) === JSON.stringify([MARKER]), 'only new key is the marker: ' + extra);
    const ui = await captureUI(pg);
    const diffs = Object.keys(ui57).filter(k => JSON.stringify(ui57[k]) !== JSON.stringify(ui[k]));
    assert(diffs.length === 0, 'UI identical before / after the upgrade' + (diffs.length ? ': ' + diffs.join(', ') : ''));
    await pg.reload();
    assert(JSON.stringify(await dump(pg)) === JSON.stringify(ls), 'another reload: storage unchanged');
    // PR2 (arch R3): with no plan, the answer / submit hooks add no study plan key — the marker stays the only new key
    await pg.evaluate(() => {
      pendingMode = 'practice'; startExam('ch2');
      const q = state.questions[0]; state.answers[0] = [...q.a]; revealAnswer();
      startExam(3, EXAM_MODE); finishExam(); leaveToHome();
    });
    const after = Object.keys(await dump(pg)).filter(k => !(k in FOREIGN) && !(k.startsWith(P) && k.slice(P.length) in LEGACY));
    assert(JSON.stringify(after) === JSON.stringify([MARKER]), 'no plan: after an answer + an exam submit the only new key is still the marker: ' + after);
    assert(errs.length === 0, 'upgrade: no page errors: ' + errs.join(' | '));
    await ctx.close();
  } finally {
    server.kill();
  }
}

// a shallow clone may not have the pinned v0.57 commit: say how to fix it instead of failing inside git archive
function checkV057Ref() {
  try {
    execFileSync('git', ['-C', ROOT, 'cat-file', '-e', `${V057_REF}^{commit}`], { stdio: 'ignore' });
  } catch {
    throw new Error(`FAIL: v0.57 ref ${V057_REF} not in this clone — run \`git fetch --unshallow\` (or fetch that commit), or set V057_REF to a v0.57 commit`);
  }
}

(async () => {
  checkV057Ref();
  const b = await chromium.launch(launchOpts);
  await mixedShell(b);
  await prePlanUiShell(b);
  await pr3Shell(b);
  await pr4Shell(b);
  await oppositeMix(b);
  await swUpgrade(b);
  await v057UtilsMix(b);
  await i18nBootFailure(b, { tag: 'old shell, locale missing', shell: 'v057.html', missing: 'locales/en.js' });
  await i18nBootFailure(b, { tag: 'current shell, i18n.js missing', shell: 'index.html', missing: 'js/core/i18n.js' });
  await i18nBootFailure(b, { tag: 'current shell, locale missing', shell: 'index.html', missing: 'locales/en.js', knownError: ZH_HK_WITHOUT_EN_ERROR });
  await oldShellZhHk(b);
  await zhHkLocaleMissing(b);
  console.log('UPGRADE PASS');
  await b.close();
  cleanUp();
})().catch(e => { console.error(e.message); cleanUp(); process.exit(1); });
