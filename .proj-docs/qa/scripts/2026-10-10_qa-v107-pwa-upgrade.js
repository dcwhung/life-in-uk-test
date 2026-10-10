// QA v1.0.7 PWA upgrade: origin/main (1.0.6) served over http, SW installed + controlling, progress seeded →
// deploy the v1.0.7 files in place → new SW lifeuk-v1.0.7 activates, 1.0.6 cache deleted → the cached shell now
// serves the new notes (E1Q5 table), offline too; progress kept.
// args: <dir with origin/main copy>   (copies it, never edits it)
const { chromium } = require('playwright-core');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const { startPagesServer, appFiles } = require(path.join(ROOT, 'tests', 'pages-server'));
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
const waitForCache = (pg, cache) => pg.evaluate(async cache => {
  const reg = await navigator.serviceWorker.getRegistration();
  for (let i = 0; i < 100; i++) {
    const keys = await caches.keys();
    const settled = keys.includes(cache) && keys.filter(k => k.startsWith('lifeuk-v')).length === 1;
    if (settled && reg && !reg.installing && !reg.waiting && navigator.serviceWorker.controller) return keys;
    if (reg && !reg.installing && !reg.waiting) await reg.update().catch(() => {});
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}, cache);
const e1q5 = pg => pg.evaluate(() => {
  pendingMode = 'practice'; startExam(1); state.current = state.questions.findIndex(q => q.examNum === 1 && q.origIdx === 4);
  renderQuestion(); state.questions[state.current].a.forEach(selectOption);
  const box = document.getElementById('ansNote');
  return { v: APP_VERSION, tables: box.querySelectorAll('.note-table').length, pipes: box.textContent.includes('| England'), shown: document.getElementById('answerBox').className };
});

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa107-pwa-'));
  fs.cpSync(process.argv[2], dir, { recursive: true });
  const { base, server } = await startPagesServer(dir);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(base);
    const k0 = await waitForCache(pg, 'lifeuk-v1.0.6');
    assert(k0, '1.0.6 SW installed + controlling: ' + JSON.stringify(k0));
    await pg.reload();
    const before = await e1q5(pg);
    assert(before.v === '1.0.6' && before.tables === 0, '1.0.6 running: E1Q5 old text note, no table ' + JSON.stringify(before));
    await pg.evaluate(() => { localStorage.setItem('lifeuk.wrongList', '{"3.4":true}'); localStorage.setItem('other.app', 'x'); });
    await pg.evaluate(() => caches.open('other-app').then(c => c.put('/x', new Response('x'))));
    // deploy v1.0.7 in place
    fs.readdirSync(dir).forEach(f => fs.rmSync(path.join(dir, f), { recursive: true, force: true }));
    appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true }));
    await pg.reload();
    const k1 = await waitForCache(pg, 'lifeuk-v1.0.7');
    assert(k1 && !k1.includes('lifeuk-v1.0.6') && k1.includes('other-app'), 'lifeuk-v1.0.7 active, lifeuk-v1.0.6 deleted, other app cache kept: ' + JSON.stringify(k1));
    await pg.reload();
    const after = await e1q5(pg);
    assert(after.v === '1.0.7' && after.tables === 1 && !after.pipes, 'after upgrade reload: 1.0.7 js, E1Q5 renders a table ' + JSON.stringify(after));
    const cached = await pg.evaluate(async () => { const c = await caches.open('lifeuk-v1.0.7'); const r = await c.match('data/exams.js'); const t = r ? await r.text() : ''; const css = await (await c.match('css/components/note.css')).text(); return { tableRow: t.includes('| England | George | 23/4 |'), wj: t.includes('全\\u2060英') || t.includes('全⁠英'), css: css.includes('.note-table') }; });
    assert(cached.tableRow && cached.css, 'v1.0.7 cache holds new data/exams.js + note.css ' + JSON.stringify(cached));
    assert(await pg.evaluate(() => localStorage.getItem('lifeuk.wrongList') === '{"3.4":true}' && localStorage.getItem('other.app') === 'x'), 'progress + other app storage kept across upgrade');
    // offline: shell from cache still renders the new notes
    await ctx.setOffline(true);
    await pg.reload();
    const off = await e1q5(pg);
    assert(off.v === '1.0.7' && off.tables === 1, 'offline reload: cached 1.0.7 shell renders the table ' + JSON.stringify(off));
    const mp = await pg.evaluate(() => { pendingMode = 'practice'; startExam(6); state.current = state.questions.findIndex(q => q.examNum === 6 && q.origIdx === 8); renderQuestion(); state.questions[state.current].a.forEach(selectOption); const s = [...document.querySelectorAll('#ansNote .note-cell-sub')].find(x => /MP$/.test(x.textContent)); const rg = document.createRange(); rg.selectNodeContents(s.parentElement); return new Set([...rg.getClientRects()].filter(x => x.width).map(x => Math.round(x.top))).size; });
    assert(mp === 2, 'offline: ④ 議員 cell 2 lines at 390px (' + mp + ')');
    assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
    await ctx.close();
  } finally {
    server.kill(); await b.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(process.exitCode ? 'PWA-UPGRADE FAIL' : 'PWA-UPGRADE PASS');
})().catch(e => { console.error(e); process.exit(1); });
