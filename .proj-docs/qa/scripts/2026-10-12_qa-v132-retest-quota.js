// QA v1.3.2 re-test (W-061, 94ff6fd): v1.2.0 marks on 126 -> first v1.3.2 load where writing a mark key throws (quota)
// -> no marker; next load (quota freed) moves 126 -> 125 and writes the marker; a third load changes nothing.
// argv: v120Root v132Root ; env S (scratch dir). Cases: Q1 mastered key throws, Q2 bookmarks key throws,
// Q3 mastered key throws on two loads in a row, then frees.
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs');
const [OLD, NEW] = process.argv.slice(2);
const S = process.env.S, APP = `${S}/rt-quota-app`;
const swap = src => execSync(`rm -rf ${APP} && mkdir -p ${APP} && cp -r ${src}/. ${APP}/`);
const URL = 'file://' + APP + '/index.html';
let fails = 0; const check = (c, m) => { console.log((c ? 'ok:   ' : 'FAIL: ') + m); if (!c) fails++; };
const MK = 'lifeuk.studyMastered', BK = 'lifeuk.studyBookmarks', MARKER = 'lifeuk.factIdsMerged';
async function run(b, name, throwKey, failLoads) {
  swap(OLD);
  const ud = fs.mkdtempSync(`${S}/ud-q-`);
  const ctx = await chromium.launchPersistentContext(ud, { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'], viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    const k = sessionStorage.getItem('qaThrowKey'); if (!k) return;
    const n = Number(sessionStorage.getItem('qaThrowLoads') || 0); if (n <= 0) return;
    sessionStorage.setItem('qaThrowLoads', String(n - 1));
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, v) { if (this === localStorage && key === k) throw new DOMException('quota', 'QuotaExceededError'); return real.call(this, key, v); };
  });
  const pg = ctx.pages()[0] || await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const ls = () => pg.evaluate(() => Object.fromEntries([...Object.keys(localStorage)].filter(k => /study(Mastered|Bookmarks)|factIdsMerged/.test(k)).sort().map(k => [k, localStorage.getItem(k)])));
  await pg.goto(URL); await pg.evaluate(() => localStorage.clear()); await pg.reload();
  // v1.2.0: tick + bookmark #126 and #7 mastered via the Study buttons
  await pg.evaluate(() => { openStudy(); studySetTab('chapters'); studySetChapter(4); });
  await pg.click('.fact[data-fact-id="126"] [data-mark="mastered"]');
  await pg.click('.fact[data-fact-id="126"] [data-mark="bookmarks"]');
  const v120 = await ls(); console.log(`info: ${name} v1.2.0 storage`, JSON.stringify(v120));
  swap(NEW);
  await pg.evaluate(([k, n]) => { sessionStorage.setItem('qaThrowKey', k); sessionStorage.setItem('qaThrowLoads', String(n)); }, [throwKey, failLoads]);
  for (let i = 1; i <= failLoads; i++) {
    await pg.goto(URL);
    const s = await pg.evaluate(() => APP_VERSION);
    const st = await ls();
    const ui = await pg.evaluate(() => { openStudy(); studySetTab('chapters'); studySetChapter(4); const c = document.querySelector('.fact[data-fact-id="125"]');
      return { m: c.querySelector('[data-mark="mastered"]').getAttribute('aria-pressed'), b: c.querySelector('[data-mark="bookmarks"]').getAttribute('aria-pressed'), prog: byId('studyProgress').innerText.replace(/\s+/g, ' ') }; });
    console.log(`info: ${name} v${s} failing load ${i}: storage ${JSON.stringify(st)} Study #125 ${JSON.stringify(ui)}`);
    check(!(MARKER in st), `${name} failing load ${i} (${throwKey} throws): no marker`);
    check(JSON.parse(st[throwKey])['126'] === true, `${name} failing load ${i}: ${throwKey} still holds 126 (to retry)`);
    const other = throwKey === MK ? BK : MK, o = JSON.parse(st[other]);
    check(o['125'] === true && !('126' in o), `${name} failing load ${i}: the other key ${other} already moved to 125`);
  }
  await pg.goto(URL); // quota freed
  const ok = await ls();
  const m = JSON.parse(ok[MK]), bm = JSON.parse(ok[BK]);
  check(m['125'] === true && !('126' in m) && bm['125'] === true && !('126' in bm) && ok[MARKER] === '[126]', `${name} next load (quota freed): both keys 125, no 126, marker [126]: ${JSON.stringify(ok)}`);
  const ui = await pg.evaluate(() => { openStudy(); studySetTab('chapters'); studySetChapter(4); const c = document.querySelector('.fact[data-fact-id="125"]');
    return { m: c.querySelector('[data-mark="mastered"]').getAttribute('aria-pressed'), b: c.querySelector('[data-mark="bookmarks"]').getAttribute('aria-pressed'), prog: byId('studyProgress').innerText.replace(/\s+/g, ' '), has126: !!document.querySelector('.fact[data-fact-id="126"]') }; });
  check(ui.m === 'true' && ui.b === 'true' && /1 \/ 235/.test(ui.prog) && !ui.has126, `${name} Study #125 ticked + bookmarked, 1 / 235, no #126 card: ${JSON.stringify(ui)}`);
  await pg.reload();
  check(JSON.stringify(await ls()) === JSON.stringify(ok), `${name} third load: no change`);
  check(errs.length === 0, `${name} no page errors ${JSON.stringify(errs)}`);
  await ctx.close();
}
(async () => {
  const b = null;
  await run(b, 'Q1', MK, 1);
  await run(b, 'Q2', BK, 1);
  await run(b, 'Q3', MK, 2);
  console.log(fails ? 'QUOTA FAIL ' + fails : 'QUOTA PASS');
})().catch(e => { console.error(e); process.exit(1); });
