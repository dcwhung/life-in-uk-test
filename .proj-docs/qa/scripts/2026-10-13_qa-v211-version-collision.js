// QA v2.1.1 F-1 / CUI-0041: install origin/fix/quiz/back-to-entry (v2.1.1) with a real SW, swap the site to this branch (also v2.1.1), update + reload: the cache name does not change, so the new shell never arrives.
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium node 2026-10-13_qa-v211-version-collision.js
const { chromium } = require('playwright-core');
const path = require('path'), fs = require('fs'), os = require('os');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../../..');
const { startPagesServer, appFiles } = require(path.join(ROOT, 'tests/pages-server.js'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'collide-'));
  const other = path.join(tmp, 'b2e'), site = path.join(tmp, 'site');
  execSync(`git -C ${ROOT} worktree add --detach ${other} origin/fix/quiz/back-to-entry -q`);
  fs.mkdirSync(site);
  const cp = from => { execSync(`rm -rf ${site}/*`); for (const f of appFiles(from)) execSync(`cp -r ${path.join(from, f)} ${site}/`); };
  cp(other);
  const s = await startPagesServer(site);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  await pg.goto(s.base + 'index.html');
  await pg.evaluate(() => navigator.serviceWorker.ready);
  await pg.evaluate(() => localStorage.setItem('lifeuk.wrongList', '{"99.99":true,"1.0":true}'));
  await pg.reload(); await sleep(700);
  console.log('before', await pg.evaluate(async () => ({ v: APP_VERSION, caches: await caches.keys(), prune: typeof pruneStaleQuestionKeys })));
  cp(ROOT);
  for (let k = 0; k < 8; k++) {
    await pg.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r && r.update())).catch(() => {});
    await sleep(1200); await pg.reload().catch(() => {}); await sleep(800);
  }
  console.log('after', await pg.evaluate(async () => ({ v: APP_VERSION, caches: await caches.keys(), prune: typeof pruneStaleQuestionKeys,
    cachedStoreHasPrune: (await (await (await caches.open('lifeuk-v2.1.1')).match('js/core/store.js')).text()).includes('pruneStaleQuestionKeys'),
    serverStoreHasPrune: (await (await fetch('js/core/store.js', { cache: 'no-store' })).text()).includes('pruneStaleQuestionKeys'),
    wrong: localStorage.getItem('lifeuk.wrongList') })));
  await pg.screenshot({ path: path.join(ROOT, '.proj-docs/qa/screenshots/v211/X-version-collision-390.png') });
  await b.close(); s.server.kill();
  execSync(`git -C ${ROOT} worktree remove --force ${other}`);
})();
