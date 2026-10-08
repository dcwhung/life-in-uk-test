// QA v0.70: 0.69 (b66d169) → 0.70 (worktree) real SW upgrade over http (adapted from 2026-10-08_qa-v069-upgrade.js)
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(process.argv[2]); const WORK = path.resolve(process.argv[3]); const OLD = process.argv[4] || 'b66d169';
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
const SHELL = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const SHELL = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  for (const variant of ['plain', 'modal-open']) {
    const dir = path.join(WORK, 'up70-' + variant); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    execSync(`git archive ${OLD} | tar -x -C "${dir}"`, { cwd: ROOT, shell: '/bin/bash' });
    const { base, server } = await startPagesServer(dir);
    try {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', e => errs.push(e.message));
      await pg.goto(base); await pg.evaluate(() => navigator.serviceWorker.ready);
      ok(await waitCache(pg, 'lifeuk-v0.69'), `[${variant}] v0.69 SW cache created`);
      await pg.evaluate(s => { localStorage.clear(); Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v)); }, SEED);
      await pg.reload(); await pg.waitForFunction(() => !!navigator.serviceWorker.controller);
      const old = await pg.evaluate(() => ({ v: APP_VERSION, noteHtml: typeof noteHtml, note: !!document.querySelector('link[href$="note.css"]'), lang: document.documentElement.lang }));
      ok(old.v === '0.69' && old.note === false && old.lang === 'zh-HK', `[${variant}] v0.69 controlling, no note.css link, zh-HK ${JSON.stringify(old)}`);
      const before = await pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
      if (variant === 'modal-open') {
        await pg.click('#examGrid [data-arg="3"]'); await pg.waitForTimeout(420); await pg.click('#screenQuiz .back-btn');
        ok(await pg.evaluate(() => isConfirmOpen()), `[${variant}] old page: exam running, Leave prompt open`);
      }
      fs.readdirSync(dir).forEach(f => fs.rmSync(path.join(dir, f), { recursive: true, force: true }));
      appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true }));
      const up = await waitUpgrade(pg, 'lifeuk-v0.70');
      const keys = await pg.evaluate(() => caches.keys());
      ok(up && keys.length === 1 && keys[0] === 'lifeuk-v0.70', `[${variant}] new SW active, only lifeuk-v0.70 (${keys})`);
      if (variant === 'modal-open') {
        const st = await pg.evaluate(() => ({ v: APP_VERSION, open: isConfirmOpen(), scr: document.querySelector('.screen.active').id }));
        ok(st.v === '0.69' && st.open && st.scr === 'screenQuiz', `[${variant}] open page not reloaded under the user (old JS, prompt open) ${JSON.stringify(st)}`);
        await pg.keyboard.press('Escape');
      }
      const cache = await pg.evaluate(async shell => { const c = await caches.open('lifeuk-v0.70'); const out = {};
        const get = async p => { const r = await c.match(new URL(p, location.href).href); return r ? r.text() : null; };
        out.missing = []; for (const p of shell) if ((await get(p)) === null) out.missing.push(p);
        out.noteCss = (await get('css/components/note.css') || '').includes('.note-mark');
        out.cfg = ((await get('js/core/config.js')) || '').match(/APP_VERSION = '([^']+)'/)?.[1];
        out.exams = ((await get('data/exams.js')) || '').includes('◦ Isle of Man（曼島）\\n    ◦ Channel Islands');
        out.idx = ((await get('index.html')) || (await get('./')) || '').includes('css/components/note.css');
        return out; }, SHELL);
      ok(cache.missing.length === 0 && cache.noteCss && cache.cfg === '0.70' && cache.exams && cache.idx,
        `[${variant}] cache holds every SHELL entry (${SHELL.length}), note.css, config 0.70, B1 exams.js, index links note.css ${JSON.stringify(cache)}`);
      await pg.reload();
      const now = await pg.evaluate(() => ({ v: APP_VERSION, noteHtml: typeof noteHtml, lang: document.documentElement.lang, hdr: document.body.innerText.includes('v0.70'),
        sheet: [...document.styleSheets].some(s => (s.href || '').endsWith('note.css')) }));
      ok(now.v === '0.70' && now.noteHtml === 'function' && now.lang === 'zh-HK' && now.hdr && now.sheet,
        `[${variant}] after reload v0.70, note.css applied, zh-HK kept ${JSON.stringify(now)}`);
      const after = await pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
      const diff = Object.keys({ ...before, ...after }).filter(k => before[k] !== after[k]);
      ok(Object.keys(SEED).every(k => after[k] === SEED[k]), `[${variant}] all seeded keys byte-identical; changed keys: ${JSON.stringify(diff.map(k => [k, before[k], after[k]]))}`);
      // switch Home to Practice by real click → wrong tile on the upgraded app
      await pg.click('#modePractice'); await pg.waitForTimeout(420);
      const tile = await pg.evaluate(() => ({ num: document.querySelector('#tileWrong .t-num')?.textContent, sub: !!document.querySelector('#tileWrong .sub'), note: document.querySelector('#tileWrong .t-note')?.textContent }));
      ok(tile.num === '2' && !tile.sub && /來自練習/.test(tile.note || ''), `[${variant}] upgraded Home: wrong tile 2, no "尚餘", note kept ${JSON.stringify(tile)}`);
      // offline: reload from the new cache, note rows styled by the cached note.css
      await ctx.setOffline(true);
      await pg.reload();
      const off = await pg.evaluate(() => { const d = document.createElement('div'); d.innerHTML = noteHtml('• aaa\n    ◦ bbb'); document.body.appendChild(d);
        const [l1, l2] = d.querySelectorAll('.rv-note-line'); const r = { v: APP_VERSION, pl1: getComputedStyle(l1).paddingLeft, ti1: getComputedStyle(l1).textIndent,
          pl2: getComputedStyle(l2).paddingLeft, mark: getComputedStyle(l1.querySelector('.note-mark')).display }; d.remove(); return r; });
      ok(off.v === '0.70' && off.pl1 !== '0px' && off.ti1.startsWith('-') && parseFloat(off.pl2) > parseFloat(off.pl1) && off.mark === 'inline-block',
        `[${variant}] offline reload: v0.70 from cache, note.css rules active ${JSON.stringify(off)}`);
      await ctx.setOffline(false);
      ok(errs.length === 0, `[${variant}] no page errors ${errs.join('|')}`);
      await ctx.close();
    } finally { server.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
  }
  await b.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
