// QA v2.2.0 CUI-0044 (QA-time number CUI-0043; renamed, review_v220-hooks S-274): measure which hook tokens (N. Ireland / NN 年 / NN BC / AD NN / d/m) are broken across two lines
// in the 睇 view's hook box (Range rects per character). 320 / 390 / 1280 × en / zh-HK × small / large. Prints JSON.
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium node 2026-10-13_qa-v220-token-split.js
const { chromium } = require('playwright-core');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const { startPagesServer } = require(path.join(ROOT, 'tests/pages-server.js'));
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  const s = await startPagesServer(ROOT);
  const out = {};
  for (const w of [320, 390, 1280]) for (const lang of ['en', 'zh-HK']) for (const font of ['small', 'large']) {
    const ctx = await b.newContext({ viewport: { width: w, height: w > 1000 ? 800 : 844 }, serviceWorkers: 'block' });
    const pg = await ctx.newPage();
    await pg.goto(s.base + 'index.html');
    await pg.evaluate(([l, f]) => { localStorage.clear(); localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); localStorage.setItem('lifeuk.fontSize', JSON.stringify(f)); }, [lang, font]);
    await pg.reload(); await pg.evaluate(() => document.fonts.ready);
    const r = await pg.evaluate(() => {
      const res = [];
      openStudy(); studySetTab('memo');
      for (const g of memoGroups()) {
        if (!g.hook) continue;
        openMemoGroup(g.id);
        const span = document.querySelector('#memoBody .memo-hook span');
        const tn = span.firstChild; const txt = tn.textContent;
        const top = i => { const rg = document.createRange(); rg.setStart(tn, i); rg.setEnd(tn, i + 1); const rs = [...rg.getClientRects()].filter(x => x.width > 0); return rs.length ? Math.round(rs[0].top) : null; };
        const re = /N\. Ireland|\d+(–\d+)? 年|\d+ BC|AD \d+|\d+\/\d+/g; let m;
        while ((m = re.exec(txt))) {
          const a = top(m.index), z = top(m.index + m[0].length - 1);
          if (a !== null && z !== null && a !== z) res.push(g.id + ':' + m[0]);
        }
      }
      return res;
    });
    out[`${w}/${lang}/${font}`] = r;
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
  s.server.kill(); await b.close();
})();
