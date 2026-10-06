const { chromium } = require('playwright-core');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
// v0.57 → v0.58 upgrade (CUI-0004): legacy progress must survive every mix of old and new files.
//   1. mixed shell: the v0.57 index.html (no migrate tag) + v0.58 js — the storage layer migrates lazily
//   2. opposite mix: v0.57 files + v0.58 utils.js — no throw, v0.57 keys still read
//   3. real service-worker upgrade over http: v0.57 SW → deploy current → reloads → byte-exact values, same UI
// The v0.57 files come from git: V057_REF is the last v0.57 commit on main (merge of PR #29), pinned so a later
// main does not silently turn this into a same-version test.
const ROOT = path.resolve(__dirname, '..');
const PORT = 8900 + Math.floor(Math.random() * 90);
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const V057_REF = process.env.V057_REF || 'dc84cab549bf6dab4148d04a65a4ca60c831bcc1';
const APP_FILES = ['index.html', 'sw.js', 'data', 'css', 'js'];
const P = 'lifeuk.';
const MARKER = P + 'migrated';
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
const copyCurrent = dir => APP_FILES.forEach(f => fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true }));
const extractV057 = dir => execFileSync('sh', ['-c', `git -C "${ROOT}" archive ${V057_REF} ${APP_FILES.join(' ')} | tar -x -C "${dir}"`]);
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
  snap.examMastery = t('#examGrid .exam-btn'); snap.chapterMastery = t('#chapterGrid button');
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
  assert((await text(pg, '#examGrid .exam-btn.all .exam-mastery')).startsWith('3/408'), 'mixed shell: legacy mastery shown (3/408)');
  assert((await text(pg, '#tileFlagged .t-num')) === '5', 'mixed shell: legacy Flagged 5 shown');
  const newKey = await pg.evaluate(() => {
    pendingMode = 'practice'; startExam('ch4');
    const i = state.questions.findIndex(q => !(qKey(q) in streaks));
    const q = state.questions[i]; state.current = i; state.answers[i] = [...q.a]; revealAnswer();
    return qKey(q);
  });
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

const PAGES_LIKE_SERVER = `
import http.server, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'max-age=600')
        super().end_headers()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
`;
const waitForServer = url => new Promise((resolve, reject) => {
  const started = Date.now();
  const ping = () => http.get(url, res => { res.resume(); resolve(); }).on('error', () => {
    if (Date.now() - started > 10000) reject(new Error('http.server did not start')); else setTimeout(ping, 100);
  });
  ping();
});
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

// 3. port of QA's upgrade-sim core: v0.57 SW installed → deploy current files in place → reload until v0.58 runs
async function swUpgrade(b) {
  const dir = tmpDir('upgrade');
  extractV057(dir);
  const base = `http://127.0.0.1:${PORT}/`;
  const server = spawn('python3', ['-c', PAGES_LIKE_SERVER, String(PORT)], { cwd: dir, stdio: 'ignore' });
  try {
    await waitForServer(base);
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
    assert(errs.length === 0, 'upgrade: no page errors: ' + errs.join(' | '));
    await ctx.close();
  } finally {
    server.kill();
  }
}

(async () => {
  const b = await chromium.launch(launchOpts);
  await mixedShell(b);
  await oppositeMix(b);
  await swUpgrade(b);
  console.log('UPGRADE PASS');
  await b.close();
  cleanUp();
})().catch(e => { console.error(e.message); cleanUp(); process.exit(1); });
