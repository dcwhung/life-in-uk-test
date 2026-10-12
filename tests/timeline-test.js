// v1.1.1 Study timeline layout (user 2026-10-11, preview option C): the year sits above its card, the dot on the
// vertical rail to its left, so the card is about as wide as on the chapter tab and memory-note tables fit.
// A: no timeline card is wider than the screen, so the page never scrolls sideways (390 / 375 / 360 / 320px)
// B: every opened "💡 記憶法" table fits its card at 390px (narrower screens may fall back to in-table scroll)
//    and every card starts TL_CARD_LEFT_PX from the screen's left edge
// C: the dot is centred on the rail and on the year text's vertical middle, TL_YEAR_MIN_GAP_PX clear of the text
// W-052: adjacent items touch (no margin collapses out of an item), so the rail runs on between cards
// E (S-175): browsers without text-box (Safari < 18.2) use the @supports not (text-box) fallback. Chromium supports
//    text-box, so the test re-injects css/screens/study.css with that condition flipped to @supports (text-box …),
//    adds text-box: normal, and checks each year keeps the shipped spacing (glyph box to the cards, within
//    FALLBACK_TOLERANCE_PX) and its dot stays centred. The result depends on the CI font (S-181): it shows the
//    fallback works with the font the test runs on, not with SF Pro; real Safari < 18.2 still needs a manual look
// D: year text is --fs-sm; TL_YEAR_SPACE_ABOVE_PX above it (to the card before), TL_YEAR_SPACE_BELOW_PX below it
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const PX_TOLERANCE = 0.5;
const TL_YEAR_MIN_GAP_PX = 6; // dot ring to year text, at least (the text lines up with the card, ~18px)
const TL_YEAR_TEXT_INSET_PX = 3; // year text starts this close to the card's left edge (padding + glyph side bearing)
const TL_YEAR_SPACE_ABOVE_PX = 24; // previous card's margin (8px) + 16px; user: 2–3x the first 10px
const TL_YEAR_SPACE_BELOW_PX = 16; // user: 2–3x the first 8px
// without the fallback rule the year gains ~2.3px above / ~3.4px below. S-180: 1.5px misses the below side one token
// wider (+1.4px); kept, as the design asks for roughly 24 / 16px and a tighter value fails on more fonts
const FALLBACK_TOLERANCE_PX = 1.5;
const NO_OVERFLOW_WIDTHS = [390, 375, 360, 320];
const TABLE_FIT_WIDTHS = [390]; // narrower screens may fall back to in-table scroll (wider left gutter, user)
// W-053: below 390px only these cards (widest tables: 10B, ⑤ inventors, Turner) may use the in-table scroll
const TABLE_SCROLL_ALLOWED = { 375: ['8', '71', '72', '84', '95'], 360: [], 320: ['8', '71', '72', '84', '87', '95'] }; // S-202 (v1.2.1): CUI-0028 made 360px fit, so none may scroll there
const TL_CARD_LEFT_PX = 58; // screen edge to card: 16 page + 16 + 2 rail + 24 (user: double the first 30px)

async function openTimeline(pg) {
  await pg.evaluate(() => {
    openStudy(); studySetTab('timeline');
    document.querySelectorAll('#studyContent details.fact-mem').forEach(d => { d.open = true; });
  });
}

async function checkWidth(b, width) {
  const pg = await b.newPage({ viewport: { width, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();
  await openTimeline(pg);
  const r = await pg.evaluate(() => {
    const items = [...document.querySelectorAll('#studyContent .tl-item')];
    const wide = items.filter(it => it.getBoundingClientRect().right > innerWidth + 0.5 || it.querySelector('.fact').getBoundingClientRect().right > innerWidth + 0.5)
      .map(it => it.querySelector('.fact').dataset.factId);
    const wraps = [...document.querySelectorAll('#studyContent .tl-body .note-table-wrap')];
    const scroll = wraps.filter(w => w.scrollWidth > w.clientWidth).map(w => w.closest('.fact').dataset.factId + ' +' + (w.scrollWidth - w.clientWidth));
    const lefts = [...new Set(items.map(it => Math.round(it.querySelector('.fact').getBoundingClientRect().left * 10) / 10))];
    return { items: items.length, wide, tables: wraps.length, scroll, docW: document.documentElement.scrollWidth, vw: innerWidth, lefts };
  });
  assert(r.items > 0 && r.wide.length === 0 && r.docW <= r.vw, `${width}px: none of ${r.items} timeline cards is wider than the screen, page doesn't scroll sideways (doc ${r.docW}; wide: ${r.wide.slice(0, 6).join(', ')})`);
  assert(r.lefts.length === 1 && Math.abs(r.lefts[0] - TL_CARD_LEFT_PX) <= PX_TOLERANCE, `${width}px: every card starts ${TL_CARD_LEFT_PX}px from the screen edge (${r.lefts.join(', ')})`);
  const scrollIds = r.scroll.map(x => x.split(' ')[0]);
  if (TABLE_SCROLL_ALLOWED[width]) assert(scrollIds.every(id => TABLE_SCROLL_ALLOWED[width].includes(id)), `${width}px: only the allowed cards scroll inside their table (${r.scroll.join(', ')})`);
  if (TABLE_FIT_WIDTHS.includes(width)) assert(r.tables > 0 && r.scroll.length === 0, `${width}px: all ${r.tables} timeline 記憶法 tables fit their card (scroll: ${r.scroll.join(', ')})`);
  assert(errs.length === 0, `${width}px: no page errors ${errs.join('; ')}`);
  return pg;
}

async function checkYearLayout(pg) {
  const r = await pg.evaluate(() => {
    const tok = n => { const i = document.createElement('i'); i.style.fontSize = `var(${n})`; document.body.appendChild(i); const v = getComputedStyle(i).fontSize; i.remove(); return v; };
    const items = [...document.querySelectorAll('#studyContent .tl-item')];
    const rows = items.map((it, idx) => {
      const y = it.querySelector('.tl-year'), cs = getComputedStyle(y), a = getComputedStyle(y, '::after');
      const yr = y.getBoundingClientRect(), itr = it.getBoundingClientRect(), card = it.querySelector('.fact').getBoundingClientRect();
      const rg = document.createRange(); rg.selectNodeContents(y);
      const rects = [...rg.getClientRects()].filter(x => x.width > 0);
      const textTop = Math.min(...rects.map(x => x.top)), textBottom = Math.max(...rects.map(x => x.bottom)), textLeft = Math.min(...rects.map(x => x.left));
      // content box = the cap-trimmed glyph box (text-box), so its middle is the text's vertical middle
      const contentTop = yr.top + parseFloat(cs.paddingTop), contentBottom = yr.bottom - parseFloat(cs.paddingBottom);
      const dotW = parseFloat(a.width) + 2 * parseFloat(a.borderLeftWidth), ring = parseFloat(a.boxShadow.split(' ').slice(-1)[0]);
      const shift = a.transform === 'none' ? new DOMMatrix() : new DOMMatrix(a.transform); // translateY(-50%)
      const dotLeft = yr.left + parseFloat(a.left) + shift.m41, dotTop = yr.top + parseFloat(a.top) + shift.m42;
      const dotCx = dotLeft + dotW / 2, dotCy = dotTop + dotW / 2;
      const railCx = itr.left + parseFloat(getComputedStyle(it).borderLeftWidth) / 2;
      const prev = idx > 0 && items[idx - 1].nextElementSibling === it ? items[idx - 1].querySelector('.fact').getBoundingClientRect() : null;
      return {
        year: y.textContent, trim: cs.textBoxTrim, fs: cs.fontSize, lines: new Set(rects.map(x => Math.round(x.top))).size,
        vOff: Math.abs(dotCy - (contentTop + contentBottom) / 2), hOff: Math.abs(dotCx - railCx), gap: textLeft - (dotLeft + dotW + ring),
        below: card.top - contentBottom, textToCard: textLeft - card.left, above: prev ? contentTop - prev.bottom : null,
      };
    });
    // W-052: each item starts where the one before it ends (the rail is the item's left border)
    const gaps = items.slice(1).filter((it, i) => items[i].nextElementSibling === it)
      .map((it, i) => Math.abs(it.getBoundingClientRect().top - items[items.indexOf(it) - 1].getBoundingClientRect().bottom));
    return { rows, sm: tok('--fs-sm'), gaps };
  });
  const breaks = r.gaps.filter(g => g > PX_TOLERANCE);
  assert(r.gaps.length > 0 && breaks.length === 0, `rail runs on: all ${r.gaps.length} adjacent items touch (gaps: ${[...new Set(breaks.map(Math.round))].join(', ')}px x ${breaks.length})`);
  const bad = r.rows.filter(d => d.trim !== 'trim-both' || d.vOff > PX_TOLERANCE || d.hOff > PX_TOLERANCE || d.gap < TL_YEAR_MIN_GAP_PX - PX_TOLERANCE);
  assert(bad.length === 0, `dot centred on the rail and on the cap-trimmed year text, ${TL_YEAR_MIN_GAP_PX}px clear of it, all ${r.rows.length} years (bad: ${JSON.stringify(bad.slice(0, 3))})`);
  const offCard = r.rows.filter(d => d.textToCard < 0 || d.textToCard > TL_YEAR_TEXT_INSET_PX + PX_TOLERANCE);
  assert(offCard.length === 0, `year text lines up with its card's left edge (0–${TL_YEAR_TEXT_INSET_PX}px in; bad: ${JSON.stringify(offCard.slice(0, 3))})`);
  assert(r.rows.every(d => d.lines === 1), `every year label is one line above its card (two-line: ${r.rows.filter(d => d.lines > 1).map(d => d.year).join(', ')})`);
  assert(r.rows.every(d => d.fs === r.sm), `year text is --fs-sm (${r.sm}): ${[...new Set(r.rows.map(d => d.fs))].join(', ')}`);
  const offBelow = r.rows.filter(d => Math.abs(d.below - TL_YEAR_SPACE_BELOW_PX) > PX_TOLERANCE);
  const offAbove = r.rows.filter(d => d.above !== null && Math.abs(d.above - TL_YEAR_SPACE_ABOVE_PX) > PX_TOLERANCE);
  assert(offBelow.length === 0 && offAbove.length === 0 && r.rows.some(d => d.above !== null),
    `${TL_YEAR_SPACE_ABOVE_PX}px from the card before to the year text, ${TL_YEAR_SPACE_BELOW_PX}px from the year text to its card (bad: ${JSON.stringify([...offAbove, ...offBelow].slice(0, 3))})`);
}

// in the page: for each year label, its glyph box (Range rects, same in both modes) to the card before / its card,
// and the dot centre against the glyph box middle
const YEAR_GLYPH_JS = `() => [...document.querySelectorAll('#studyContent .tl-item')].map(it => {
  const y = it.querySelector('.tl-year'), a = getComputedStyle(y, '::after'), yr = y.getBoundingClientRect();
  const rg = document.createRange(); rg.selectNodeContents(y); const t = rg.getBoundingClientRect();
  const card = it.querySelector('.fact').getBoundingClientRect();
  const prevItem = it.previousElementSibling && it.previousElementSibling.classList.contains('tl-item') ? it.previousElementSibling : null;
  const shift = a.transform === 'none' ? new DOMMatrix() : new DOMMatrix(a.transform);
  const dotCy = yr.top + parseFloat(a.top) + shift.m42 + (parseFloat(a.width) + 2 * parseFloat(a.borderLeftWidth)) / 2;
  return { year: y.textContent, trim: getComputedStyle(y).textBoxTrim, below: card.top - t.bottom,
    above: prevItem ? t.top - prevItem.querySelector('.fact').getBoundingClientRect().bottom : null, dotOff: dotCy - (t.top + t.bottom) / 2 };
})`;

async function checkFallback(b) {
  const pg = await b.newPage({ viewport: { width: NO_OVERFLOW_WIDTHS[0], height: 844 } });
  await pg.goto(APP_URL);
  await openTimeline(pg);
  const measure = () => pg.evaluate(src => new Function('return ' + src)()(), YEAR_GLYPH_JS);
  const shipped = await measure();
  // S-182: the whole sheet again with the fallback's condition flipped, so every rule in that block applies (no
  // block extraction to get wrong), then text-box: normal last, as in a browser without text-box
  const FALLBACK_CONDITION = /@supports\s+not\s*\(\s*text-box/g;
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'css', 'screens', 'study.css'), 'utf8');
  const conditions = css.match(FALLBACK_CONDITION) || [];
  assert(conditions.length === 1, `study.css has one @supports not (text-box …) fallback (${conditions.length})`);
  await pg.addStyleTag({ content: css.replace(FALLBACK_CONDITION, '@supports (text-box') + '\n.tl-year { text-box: normal; }' });
  const fallback = await measure();
  assert(fallback.every(d => d.trim === 'none') && shipped.every(d => d.trim === 'trim-both'), 'simulated a browser without text-box (shipped: trim-both, fallback: none)');
  const font = await pg.evaluate(() => getComputedStyle(document.querySelector('.tl-year')).fontFamily);
  const bad = fallback.map((d, i) => ({ year: d.year, above: d.above === null ? 0 : d.above - shipped[i].above, below: d.below - shipped[i].below, dotOff: d.dotOff }))
    .filter(d => Math.abs(d.above) > FALLBACK_TOLERANCE_PX || Math.abs(d.below) > FALLBACK_TOLERANCE_PX || Math.abs(d.dotOff) > 1);
  assert(bad.length === 0, `without text-box the fallback keeps every year's spacing within ${FALLBACK_TOLERANCE_PX}px of the shipped layout and its dot centred within 1px (${fallback.length} years, font ${font}; bad: ${JSON.stringify(bad.slice(0, 3))})`);
  await pg.close();
}

(async () => {
  const b = await chromium.launch(launchOpts);
  await checkFallback(b);
  for (const width of NO_OVERFLOW_WIDTHS) {
    const pg = await checkWidth(b, width);
    if (width === NO_OVERFLOW_WIDTHS[0]) await checkYearLayout(pg);
    await pg.close();
  }
  await b.close();
  console.log('TIMELINE PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
