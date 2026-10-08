// QA v1.0.0: v0.72 (origin/main) → v1.0.0 (worktree) real SW upgrade over http (adapted from 2026-10-08_qa-v072-upgrade.js)
//   node 2026-10-08_qa-v100-upgrade.js <worktree-root> <work-dir> [old-ref=origin/main]
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(process.argv[2]); const WORK = path.resolve(process.argv[3]); const OLD = process.argv[4] || 'origin/main';
const { startPagesServer, appFiles } = require(path.join(ROOT, 'tests', 'pages-server.js'));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; console.log('FAIL:', m); } };
const OLDC = 'lifeuk-v0.72', NEWC = 'lifeuk-v1.0.0';
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
const SHELL = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const SHELL = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  for (const variant of ['plain', 'modal-open']) {
    const dir = path.join(WORK, 'up100-' + variant); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    execSync(`git archive ${OLD} | tar -x -C "${dir}"`, { cwd: ROOT, shell: '/bin/bash' });
    const { base, server } = await startPagesServer(dir);
    try {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', e => errs.push(e.message));
      await pg.goto(base); await pg.evaluate(() => navigator.serviceWorker.ready);
      ok(await waitCache(pg, OLDC), `[${variant}] v0.72 SW cache created`);
      await pg.evaluate(s => { localStorage.clear(); Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); }, SEED);
      await pg.reload(); await pg.waitForFunction(() => !!navigator.serviceWorker.controller);
      const old = await pg.evaluate(() => ({ v: APP_VERSION, hdr: document.getElementById('appVersion').textContent, lang: document.documentElement.lang }));
      ok(old.v === '0.72' && old.hdr === 'v0.72' && old.lang === 'zh-HK', `[${variant}] v0.72 controlling, zh-HK ${JSON.stringify(old)}`);
      const before = await pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
      if (variant === 'modal-open') {
        await pg.click('#examGrid [data-arg="3"]'); await pg.waitForTimeout(420); await pg.click('#screenQuiz .back-btn');
        ok(await pg.evaluate(() => isConfirmOpen()), `[${variant}] old page: exam running, Leave prompt open`);
      }
      fs.readdirSync(dir).forEach(f => fs.rmSync(path.join(dir, f), { recursive: true, force: true }));
      appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true }));
      const up = await waitUpgrade(pg, NEWC);
      const keys = await pg.evaluate(() => caches.keys());
      ok(up && keys.length === 1 && keys[0] === NEWC, `[${variant}] new SW active, old cache dropped, only ${NEWC} (${keys})`);
      if (variant === 'modal-open') {
        const st = await pg.evaluate(() => ({ v: APP_VERSION, open: isConfirmOpen(), scr: document.querySelector('.screen.active').id }));
        ok(st.v === '0.72' && st.open && st.scr === 'screenQuiz', `[${variant}] open page not reloaded under the user ${JSON.stringify(st)}`);
        await pg.keyboard.press('Escape');
      }
      const cache = await pg.evaluate(async ([shell, c]) => { const ch = await caches.open(c); const out = { missing: [] };
        const get = async p => { const r = await ch.match(new URL(p, location.href).href); return r ? r.text() : null; };
        for (const p of shell) if ((await get(p)) === null) out.missing.push(p);
        out.cfg = ((await get('js/core/config.js')) || '').match(/APP_VERSION = '([^']+)'/)?.[1]; return out; }, [SHELL, NEWC]);
      ok(cache.missing.length === 0 && cache.cfg === '1.0.0', `[${variant}] cache holds every SHELL entry (${SHELL.length}), config 1.0.0 ${JSON.stringify(cache)}`);
      await pg.reload();
      const now = await pg.evaluate(() => ({ v: APP_VERSION, hdr: document.getElementById('appVersion').textContent, pop: document.getElementById('appVersionPop').textContent, lang: document.documentElement.lang }));
      ok(now.v === '1.0.0' && now.hdr === 'v1.0.0' && now.pop === 'v1.0.0' && now.lang === 'zh-HK', `[${variant}] after reload v1.0.0 in header + popover, zh-HK kept ${JSON.stringify(now)}`);
      const after = await pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
      const diff = Object.keys({ ...before, ...after }).filter(k => before[k] !== after[k]);
      ok(Object.keys(SEED).every(k => after[k] === SEED[k]), `[${variant}] all seeded lifeuk.* keys byte-identical; changed keys: ${JSON.stringify(diff.map(k => [k, before[k], after[k]]))}`);
      await pg.click('#modePractice'); await pg.waitForTimeout(420);
      const tile = await pg.evaluate(() => ({ num: document.querySelector('#tileWrong .t-num')?.textContent, done: document.querySelectorAll('#examGrid .done, #examGrid [data-done], #examGrid .completed').length }));
      ok(tile.num === '2', `[${variant}] upgraded Home renders seeded progress: wrong tile 2 ${JSON.stringify(tile)}`);
      await ctx.setOffline(true); await pg.reload();
      const off = await pg.evaluate(() => ({ v: APP_VERSION, hdr: document.getElementById('appVersion').textContent }));
      ok(off.v === '1.0.0' && off.hdr === 'v1.0.0', `[${variant}] offline reload served from ${NEWC} ${JSON.stringify(off)}`);
      await ctx.setOffline(false);
      ok(errs.length === 0, `[${variant}] no page errors ${errs.join('|')}`);
      await ctx.close();
    } finally { server.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
  }
  await b.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
