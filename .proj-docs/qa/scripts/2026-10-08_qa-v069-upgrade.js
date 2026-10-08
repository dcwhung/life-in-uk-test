// 0.68 (cbbee5f) → 0.69 (worktree) real SW upgrade over http
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(process.argv[2]); const WORK = path.resolve(process.argv[3]);
const { startPagesServer, appFiles } = require(path.join(ROOT, 'tests', 'pages-server.js'));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; console.log('FAIL:', m); } };
const waitCache = (pg, n) => pg.evaluate(async n => { for (let i = 0; i < 75; i++) { if ((await caches.keys()).includes(n)) return true; await new Promise(r => setTimeout(r, 200)); } return false; }, n);
const waitUpgrade = (pg, c) => pg.evaluate(async c => { const reg = await navigator.serviceWorker.getRegistration();
  for (let i = 0; i < 100; i++) { const k = await caches.keys();
    if (k.length === 1 && k[0] === c && !reg.installing && !reg.waiting && navigator.serviceWorker.controller) return true;
    if (!reg.installing && !reg.waiting) await reg.update().catch(() => {}); await new Promise(r => setTimeout(r, 200)); } return false; }, c);
const SEED = {
  'lifeuk.completedExams': '{"1":true,"2":true,"5":true}', 'lifeuk.homePrefs': '{"mode":"exam","view":"chapter"}',
  'lifeuk.practiceFlags': '{"9.13":true,"6.17":true}', 'lifeuk.practiceStreak': '{"1.0":3,"1.1":2,"2.5":3}',
  'lifeuk.wrongList': '{"3.4":true,"8.1":true}', 'lifeuk.studyBookmarks': '{"7":true}', 'lifeuk.studyMastered': '{"12":true,"40":true}',
  'lifeuk.uiLang': '"zh-HK"', 'lifeuk.installDismissed': 'true',
};
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  for (const variant of ['plain', 'modal-open']) {
    const dir = path.join(WORK, 'up-' + variant); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    execSync(`git archive cbbee5f | tar -x -C "${dir}"`, { cwd: ROOT, shell: '/bin/bash' });
    const { base, server } = await startPagesServer(dir);
    try {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', e => errs.push(e.message));
      await pg.goto(base); await pg.evaluate(() => navigator.serviceWorker.ready);
      ok(await waitCache(pg, 'lifeuk-v0.68'), `[${variant}] v0.68 SW cache created`);
      await pg.evaluate(s => { localStorage.clear(); Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); }, SEED);
      await pg.reload(); await pg.waitForFunction(() => !!navigator.serviceWorker.controller);
      const old = await pg.evaluate(() => ({ v: APP_VERSION, trap: typeof trapConfirmTab, lang: document.documentElement.lang }));
      ok(old.v === '0.68' && old.trap === 'undefined' && old.lang === 'zh-HK', `[${variant}] v0.68 controlling, no trap, zh-HK ${JSON.stringify(old)}`);
      const before = await pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
      if (variant === 'modal-open') { // old page has an exam running with Leave prompt open while the deploy lands
        await pg.click('#examGrid [data-arg="3"]'); await pg.waitForTimeout(420); await pg.click('#screenQuiz .back-btn');
        ok(await pg.evaluate(() => isConfirmOpen()), `[${variant}] old page: exam running, Leave prompt open`);
      }
      fs.readdirSync(dir).forEach(f => fs.rmSync(path.join(dir, f), { recursive: true, force: true }));
      appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true }));
      const up = await waitUpgrade(pg, 'lifeuk-v0.69');
      const keys = await pg.evaluate(() => caches.keys());
      ok(up && keys.length === 1 && keys[0] === 'lifeuk-v0.69', `[${variant}] new SW active, only lifeuk-v0.69 (${keys})`);
      if (variant === 'modal-open') {
        const st = await pg.evaluate(() => ({ v: APP_VERSION, open: isConfirmOpen(), scr: document.querySelector('.screen.active').id }));
        ok(st.v === '0.68' && st.open && st.scr === 'screenQuiz', `[${variant}] open page not reloaded under the user (still old JS, prompt open) ${JSON.stringify(st)}`);
        await pg.keyboard.press('Escape');
      }
      const cachedModal = await pg.evaluate(async () => { const c = await caches.open('lifeuk-v0.69'); const r = await c.match('js/components/modal.js') || await c.match(new URL('js/components/modal.js', location.href).href); return r ? (await r.text()).includes('trapConfirmTab') : 'missing'; });
      const cachedCfg = await pg.evaluate(async () => { const c = await caches.open('lifeuk-v0.69'); const r = await c.match(new URL('js/core/config.js', location.href).href); return r ? (await r.text()).match(/APP_VERSION = '([^']+)'/)[1] : 'missing'; });
      ok(cachedModal === true && cachedCfg === '0.69', `[${variant}] cache holds new modal.js (trap) and config 0.69 (${cachedModal}, ${cachedCfg})`);
      await pg.reload();
      const now = await pg.evaluate(() => ({ v: APP_VERSION, trap: typeof trapConfirmTab, lang: document.documentElement.lang, hdr: document.body.innerText.includes('v0.69') }));
      ok(now.v === '0.69' && now.trap === 'function' && now.lang === 'zh-HK', `[${variant}] after reload v0.69 with trap, zh-HK kept ${JSON.stringify(now)}`);
      const after = await pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
      const diff = Object.keys({ ...before, ...after }).filter(k => before[k] !== after[k]);
      ok(Object.keys(SEED).every(k => after[k] === SEED[k]), `[${variant}] all seeded keys byte-identical; changed keys: ${JSON.stringify(diff.map(k => [k, before[k], after[k]]))}`);
      const grid = await pg.$$eval('#examGrid .exam-btn.done, #examGrid .done', e => e.length);
      ok(grid >= 3, `[${variant}] Home exam grid shows completed exams (${grid})`);
      // keyboard trap works on the upgraded app
      await pg.focus('[data-action="resetCompletedExams"]'); await pg.keyboard.press('Enter');
      const ids = []; for (let i = 0; i < 4; i++) { await pg.keyboard.press('Tab'); ids.push(await pg.evaluate(() => document.activeElement.id)); }
      await pg.keyboard.press('Escape');
      ok(ids.join() === 'confirmOk,confirmCancel,confirmOk,confirmCancel' && await pg.evaluate(() => localStorage.getItem('lifeuk.completedExams')) === SEED['lifeuk.completedExams'], `[${variant}] upgraded app: reset prompt Tab trap ${ids}, data kept after Esc`);
      ok(errs.length === 0, `[${variant}] no page errors ${errs.join('|')}`);
      await ctx.close();
    } finally { server.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
  }
  await b.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
