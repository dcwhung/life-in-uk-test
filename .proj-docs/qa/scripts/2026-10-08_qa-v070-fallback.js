// simulate a browser without text-box: override to normal + the @supports-not pad, compare year text / dot with v0.69 position
const { chromium } = require('playwright-core'); const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  for (const [root, sim] of [['wt70', false], ['wt70', true], ['wt69', false]]) {
    const pg = await b.newPage({ viewport: { width: 390, height: 900 } });
    await pg.goto('file://' + path.resolve(root, 'index.html'));
    console.log(root, 'CSS.supports text-box:', await pg.evaluate(() => CSS.supports('text-box', 'trim-both cap alphabetic')));
    if (sim) await pg.addStyleTag({ content: '.tl-year { text-box: normal !important; --tl-year-pad: 13px !important; }' });
    const r = await pg.evaluate(() => { openStudy(); studySetTab('timeline');
      return [...document.querySelectorAll('.tl-year')].slice(0, 82).map(y => { const rg = document.createRange(); rg.selectNodeContents(y); const rects = [...rg.getClientRects()];
        const top = Math.min(...rects.map(x => x.top)), bot = Math.max(...rects.map(x => x.bottom)); const yr = y.getBoundingClientRect(); const a = getComputedStyle(y, '::after');
        const tr = a.transform; const h = parseFloat(a.height) + 2 * parseFloat(a.borderTopWidth); const dotC = yr.top + parseFloat(a.top) + (tr === 'none' ? h / 2 : 0);
        return { year: y.textContent, textTop: +(top - yr.top).toFixed(2), lineMid: +((top + bot) / 2 - yr.top).toFixed(2), dotC: +(dotC - yr.top).toFixed(2), lines: new Set(rects.map(x => Math.round(x.top))).size }; }); });
    const one = r.filter(x => x.lines === 1), two = r.filter(x => x.lines > 1);
    console.log(root, sim ? '(simulated no text-box)' : '', 'one-line: textTop', [...new Set(one.map(x => x.textTop))], 'lineMid-dot', [...new Set(one.map(x => +(x.lineMid - x.dotC).toFixed(2)))],
      'two-line:', two.map(x => `${x.year} textTop ${x.textTop} lineMid-dot ${(x.lineMid - x.dotC).toFixed(2)}`).join('; '));
    await pg.close();
  }
  await b.close();
})();
