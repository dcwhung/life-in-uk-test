// QA v1.1.1 timeline edge cases (2026-10-11). Run from repo root with NODE_PATH / CHROMIUM_PATH as run-all.
// E1 280px (Galaxy Fold) no page scroll   E2 no-text-box fallback (S-175) simulated: spacing + dot vs glyph middle
// E3 dark mode tokens on rail / dot / era  E4 wars-only + bookmarks-only with no war bookmarked -> empty state
// E5 mastered (faded) card: dot / rail / year not faded   E6 landscape 844x390
// (font sizes are px tokens, so a root font-size zoom changes nothing; browser zoom = a narrower CSS viewport, see E1)
const { chromium } = require('playwright-core');
const path = require('path');
const ROOT = process.env.QA_ROOT || path.resolve(__dirname, '..', '..', '..');
const APP_URL = 'file://' + path.join(ROOT, 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
let pass = 0, fail = 0;
const check = (c, m, info = '') => { if (c) pass++; else fail++; console.log((c ? 'ok: ' : 'FAIL: ') + m + (info ? ' ' + info : '')); };

async function page(b, opts = {}) {
  const pg = await b.newPage({ viewport: { width: opts.width || 390, height: opts.height || 844 }, colorScheme: opts.dark ? 'dark' : 'light' });
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();
  await pg.evaluate(() => { openStudy(); studySetTab('timeline'); document.querySelectorAll('#studyContent details.fact-mem').forEach(d => { d.open = true; }); });
  return pg;
}
const docFit = pg => pg.evaluate(() => ({ doc: document.documentElement.scrollWidth, vw: innerWidth,
  cards: [...document.querySelectorAll('#studyContent .fact')].filter(c => c.getBoundingClientRect().right > innerWidth + 0.5).length,
  scroll: [...document.querySelectorAll('#studyContent .note-table-wrap')].filter(w => w.scrollWidth > w.clientWidth + 0.5).map(w => w.closest('.fact').dataset.factId) }));

(async () => {
  const b = await chromium.launch(launchOpts);
  // E1
  { const pg = await page(b, { width: 280 }); const r = await docFit(pg);
    check(r.doc <= r.vw && r.cards === 0, 'E1 280px: no page h-scroll, no card past screen', JSON.stringify(r)); await pg.close(); }

  // E2: what a Safari < 18.2 user gets: no text-box, the @supports fallback vars
  { const pg = await page(b);
    const m = await pg.evaluate(() => {
      const st = document.createElement('style');
      st.textContent = '.tl-year { text-box: normal !important; text-box-trim: none !important; --tl-year-above: var(--space-7) !important; --tl-year-below: var(--space-6) !important; }';
      document.head.appendChild(st);
      const ctx = document.createElement('canvas').getContext('2d');
      const items = [...document.querySelectorAll('#studyContent .tl-item')];
      return items.map((it, i) => {
        const y = it.querySelector('.tl-year'), cs = getComputedStyle(y), a = getComputedStyle(y, '::after');
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const tm = ctx.measureText(y.textContent);
        const rg = document.createRange(); rg.selectNodeContents(y); const lr = rg.getClientRects()[0];
        const yr = y.getBoundingClientRect(), lh = parseFloat(cs.lineHeight);
        const lineTop = yr.top + parseFloat(cs.paddingTop);
        const baseline = lineTop + (lh - (tm.fontBoundingBoxAscent + tm.fontBoundingBoxDescent)) / 2 + tm.fontBoundingBoxAscent;
        const capTop = baseline - tm.actualBoundingBoxAscent; // digits / capitals
        const mm = new DOMMatrix(a.transform === 'none' ? undefined : a.transform);
        const dotCy = yr.top + parseFloat(a.top) + mm.m42 + (parseFloat(a.height) + 2 * parseFloat(a.borderTopWidth)) / 2;
        const card = it.querySelector('.fact').getBoundingClientRect();
        const prev = i && items[i - 1].nextElementSibling === it ? items[i - 1].querySelector('.fact').getBoundingClientRect().bottom : null;
        return { year: y.textContent, above: prev === null ? null : capTop - prev, below: card.top - baseline, dotOff: dotCy - (capTop + baseline) / 2, lr: !!lr };
      });
    });
    const ab = m.filter(x => x.above !== null).map(x => x.above), be = m.map(x => x.below), off = m.map(x => Math.abs(x.dotOff));
    const r1 = a => `${Math.min(...a).toFixed(1)}–${Math.max(...a).toFixed(1)}`;
    check(Math.abs(Math.min(...ab) - 24) <= 1.5 && Math.abs(Math.max(...ab) - 24) <= 1.5, 'E2 fallback: card before -> year glyph top about 24px', r1(ab));
    check(Math.abs(Math.min(...be) - 16) <= 1.5 && Math.abs(Math.max(...be) - 16) <= 1.5, 'E2 fallback: year baseline -> card about 16px', r1(be));
    check(Math.max(...off) <= 1.5, 'E2 fallback: dot within 1.5px of glyph middle', r1(off));
    const fit = await docFit(pg); check(fit.doc <= fit.vw, 'E2 fallback: no page h-scroll');
    await pg.close(); }

  // E3
  { const pg = await page(b, { dark: true });
    const r = await pg.evaluate(() => {
      const tok = n => { const i = document.createElement('i'); i.style.color = `var(${n})`; document.body.appendChild(i); const v = getComputedStyle(i).color; i.remove(); return v; };
      const it = document.querySelector('#studyContent .tl-item'), a = getComputedStyle(it.querySelector('.tl-year'), '::after');
      return { rail: getComputedStyle(it).borderLeftColor, border: tok('--border'), dotBorder: a.borderTopColor, card: tok('--card'), bodyBg: getComputedStyle(document.body).backgroundColor };
    });
    check(r.rail === r.border && r.dotBorder === r.card && r.border !== 'rgb(0, 0, 0)', 'E3 prefers-color-scheme dark (app has no dark theme): rail = --border, dot border = --card, light tokens kept', JSON.stringify(r));
    await pg.screenshot({ path: path.join(process.env.QA_OUT || '/tmp', 'tl-390-dark.png') }).catch(() => {});
    await pg.close(); }

  // E4
  { const pg = await page(b);
    const r = await pg.evaluate(() => { studyToggleMark('bookmarks', 8); studyToggle('bookmarksOnly'); studyToggle('warsOnly');
      return { items: document.querySelectorAll('#studyContent .tl-item').length, empty: !!document.querySelector('#studyContent .study-empty'), eras: document.querySelectorAll('#studyContent .tl-era').length }; });
    check(r.items === 0 && r.empty && r.eras === 0, 'E4 wars-only + bookmarks-only (non-war bookmark): empty state, no orphan era bar', JSON.stringify(r));
    await pg.close(); }

  // E5
  { const pg = await page(b);
    const r = await pg.evaluate(() => { studyToggleMark('mastered', 8);
      const f = document.querySelector('#studyContent .fact[data-fact-id="8"]'), it = f.closest('.tl-item');
      return { faded: f.classList.contains('mastered') && +getComputedStyle(f).opacity < 1, itemOp: +getComputedStyle(it).opacity, yearOp: +getComputedStyle(it.querySelector('.tl-year')).opacity }; });
    check(r.faded && r.itemOp === 1 && r.yearOp === 1, 'E5 mastered card fades, its year / dot / rail do not', JSON.stringify(r));
    await pg.close(); }

  // E6
  { const pg = await page(b, { width: 844, height: 390 }); const r = await docFit(pg);
    check(r.doc <= r.vw && r.cards === 0 && r.scroll.length === 0, 'E6 landscape 844px: fits, every table fits', JSON.stringify(r)); await pg.close();
  }

  await b.close();
  console.log(`\n${fail ? 'EDGE FAIL' : 'EDGE PASS'} ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
