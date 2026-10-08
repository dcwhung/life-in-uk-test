const { chromium } = require('playwright-core');
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
  const tokenRgb = name => pg.evaluate(n => {
    const el = document.createElement('i');
    el.style.color = `var(${n})`;
    document.body.appendChild(el);
    const c = getComputedStyle(el).color;
    el.remove();
    return c;
  }, name);
  const css = (sel, prop) => pg.$eval(sel, (e, p) => getComputedStyle(e)[p], prop);
  // expected chapter number, counted here from STUDY (not from the app helper): position among the same-chapter facts
  const EXPECTED_NUM_JS = 'const f = STUDY.find(x => x.id === id); return STUDY.filter(x => x.ch === f.ch).indexOf(f) + 1;';
  const STUDY_TOTAL = 236;
  // helper unit test: each chapter's first fact is 1, its last is the chapter total, every (ch, n) pair is unique
  async function checkChapterFactHelper() {
    const r = await pg.evaluate(src => {
      if (typeof chapterFactNumber !== 'function') return { fn: false };
      const expected = new Function('id', src);
      const chs = [...new Set(STUDY.map(f => f.ch))];
      const ends = chs.map(ch => { const l = STUDY.filter(f => f.ch === ch); return [chapterFactNumber(l[0].id), chapterFactNumber(l[l.length - 1].id), l.length]; });
      const pairs = new Set(STUDY.map(f => f.ch + ':' + chapterFactNumber(f.id)));
      return { fn: true, ends, unique: pairs.size, total: STUDY.length, match: STUDY.every(f => chapterFactNumber(f.id) === expected(f.id)) };
    }, EXPECTED_NUM_JS);
    assert(r.fn && r.total === STUDY_TOTAL && r.unique === STUDY_TOTAL && r.match && r.ends.every(([a, z, n]) => a === 1 && z === n),
      'chapterFactNumber: first = 1, last = chapter total, 236 unique (ch, n): ' + JSON.stringify(r));
  }
  // every card: the element its Practise button's aria-describedby points at exists and shows the chapter number;
  // Chapters view (noChapter) = ".fact-id" "#n"; every other view = no ".fact-id", pill "<icon> Ch c #n" (lang="en")
  // S-073: the description is the number text only — no chapter emoji read out; the pill's icon is aria-hidden
  const DESCRIBED_BY_TEXT = /^(Ch \d+ )?#\d+$/;
  async function checkChapterNumbers(tag) {
    const bad = await pg.$$eval('#studyContent .fact', (cards, [src, describedRe]) => {
      const expected = new Function('id', src);
      const described = new RegExp(describedRe);
      const chapters = study.tab === 'chapters';
      return cards.map(c => {
        const id = Number(c.dataset.factId), f = STUDY.find(x => x.id === id), n = expected(id);
        const btn = c.querySelector('.fact-practise');
        const target = btn && document.getElementById(btn.getAttribute('aria-describedby'));
        const ids = c.querySelectorAll('.fact-id');
        const pill = [...c.querySelectorAll('.fact-meta .tag')].find(e => /^\S+ Ch \d+ #\d+$/.test(e.textContent));
        const icon = pill && pill.querySelector('[aria-hidden="true"]');
        const ok = !!target && described.test(target.textContent) && (chapters
          ? ids.length === 1 && ids[0].textContent === '#' + n && target === ids[0]
          : ids.length === 0 && !!pill && pill.textContent.endsWith(`Ch ${f.ch} #${n}`) && pill.getAttribute('lang') === 'en'
            && target.parentElement === pill && target.textContent === `Ch ${f.ch} #${n}` && !!icon && !icon.contains(target));
        return ok ? null : { id, n, ids: ids.length, pill: pill && pill.textContent, target: target && target.textContent, icon: !!icon };
      }).filter(Boolean);
    }, [EXPECTED_NUM_JS, DESCRIBED_BY_TEXT.source]);
    const n = await pg.$$eval('#studyContent .fact', els => els.length);
    assert(n > 0 && bad.length === 0, `${tag}: every card shows its chapter number and Practise is described by it (${n} cards): ` + JSON.stringify(bad.slice(0, 3)));
  }
  // group titles carry no ".cnt" count and no trailing number
  async function checkGroupTitlesNoCount(tag) {
    const g = await pg.$$eval('#studyContent .study-group-title', els => els.map(e => ({ cnt: !!e.querySelector('.cnt'), text: e.textContent.trim() })));
    assert(g.length > 0 && g.every(x => !x.cnt && !/\d$/.test(x.text)), `${tag}: group titles have no count: ` + JSON.stringify(g));
  }
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear());
  await pg.reload();

  // home: chapter grid
  const counts = await pg.$$eval('#chapterGrid .ch-count', els => els.map(e => parseInt(e.textContent.split('/')[1])));
  assert(counts.length === 5 && counts.reduce((a, b) => a + b, 0) === 408, 'chapter grid 5 buttons, counts sum 408: ' + counts.join('/'));
  await pg.screenshot({ path: 'shot-home.png', fullPage: true });

  // chapter practice
  await pg.click('#ptabChapter');
  assert(await css('#chapterGrid .ch-num', 'backgroundColor') === await tokenRgb('--study-accent-strong'), 'Home chapter badge is study accent (Q2-a)');
  await pg.click('#chapterGrid .chapter-btn:nth-child(3)');
  assert(await pg.$eval('#quizLabel', e => e.textContent) === 'Chapter 3', 'chapter practice label');
  assert(await pg.$eval('#modeBadge', e => e.textContent) === 'Practice', 'chapter practice is practice mode');
  assert(await pg.evaluate(() => chapterQuestions(3).length === 167 && state.questions.length === 24 && state.questions.every(q => q.ch === 3)), 'chapter 3 has 167 questions; round of 24, all ch3');
  assert((await pg.$eval('#nextBtn', e => e.textContent)) !== 'Submit', 'no Submit in chapter practice');
  // finish quickly: answer nothing, jump to last, finish -> no completedExams saved
  await pg.evaluate(() => { state.current = state.questions.length - 1; renderQuestion(); finishExam(); });
  assert(await pg.$eval('#resultLabel', e => e.textContent) === 'Chapter 3', 'result label chapter');
  assert(await pg.evaluate(() => !localStorage.getItem('lifeuk.completedExams')), 'chapter practice does not mark exams complete');
  await pg.click('#screenResult .another-btn >> nth=0');

  // study screen
  await pg.click('#modeStudy');
  const count = () => pg.$eval('#studyCount', e => e.textContent);
  assert((await count()) === '2 / 2 facts', 'chapters tab default Ch1: ' + await count());

  // v0.62 (P3 T-101): selection colour is navy like Practice; purple only means Cantonese
  const navy = await tokenRgb('--navy');
  assert(await css('.study-tab.active', 'backgroundColor') === navy, 'active study tab is navy');
  assert(await css('#studySubChips .chip.ch.active', 'backgroundColor') === navy, 'active chapter chip is navy');
  await pg.focus('#studySearch');
  assert(await css('#studySearch', 'borderTopColor') === await tokenRgb('--navy-light'), 'search focus border is navy-light');
  await pg.$eval('#studySearch', e => e.blur());
  await pg.click('#studySubChips .chip:nth-child(3)'); // Ch3
  assert((await count()) === '91 / 91 facts', 'Ch3 91 facts: ' + await count());
  await pg.screenshot({ path: 'shot-chapters.png' });
  assert(await css('.tag.year', 'color') === await tokenRgb('--study-accent-strong') && await css('.tag.year', 'backgroundColor') === await tokenRgb('--study-accent-bg'), 'year tag uses study accent tokens');
  // v0.63 (P3 T-201 / T-202): the Study card is factCardHtml's full variant — O5 card shadow, Q6 "#id" small text first
  const shadowSm = await pg.evaluate(() => {
    const el = document.createElement('i');
    el.style.boxShadow = 'var(--shadow-sm)';
    document.body.appendChild(el);
    const s = getComputedStyle(el).boxShadow;
    el.remove();
    return s;
  });
  assert(await css('#studyContent .fact', 'boxShadow') === shadowSm, 'fact card has the --shadow-sm card shadow (O5)');
  const firstCard = await pg.$eval('#studyContent .fact', e => ({
    id: e.dataset.factId, first: e.querySelector('.fact-meta').firstElementChild.className, text: e.querySelector('.fact-id')?.textContent,
  }));
  // 2026-10-07: the card number counts from 1 in each chapter (Ch3's first fact, id 7, reads "#1"); data-fact-id keeps the global id
  assert(firstCard.first === 'fact-id' && firstCard.text === '#1' && firstCard.id === '7', 'Ch3 first card starts with its chapter number "#1" (Q6): ' + JSON.stringify(firstCard));
  await checkChapterFactHelper();
  await checkChapterNumbers('en chapters › 3');
  await checkGroupTitlesNoCount('en chapters › 3');
  await pg.click('#studySubChips .chip:nth-child(4)'); // Ch4
  assert(await pg.$eval('#studyContent .fact .fact-id', e => e.textContent) === '#1', 'Ch4 first card is "#1"');
  await pg.click('#studySubChips .chip:nth-child(1)'); // Ch1
  assert(await pg.$$eval('#studyContent .fact .fact-id', els => els[1].textContent) === '#2', 'Ch1 second card is "#2"');
  await pg.click('#studySubChips .chip:nth-child(3)'); // back to Ch3
  assert(await pg.evaluate(() => typeof factCardHtml === 'function'), 'factCardHtml component loaded');

  await pg.click('.study-tab[data-tab="timeline"]');
  assert((await count()) === '82 / 82 facts', 'timeline 82: ' + await count());
  const eras = await pg.$$eval('.tl-era', els => els.map(e => e.firstChild.textContent.trim()));
  assert(eras[0].startsWith('Stone Age') && eras.includes('Tudors') && eras[eras.length - 1].startsWith('21st'), 'eras in order: ' + eras.join(' > '));
  await checkChapterNumbers('en timeline');
  const years = await pg.$$eval('.tl-year', els => els.map(e => e.textContent));
  assert(years[0] === 'c. 4000 BC' && years.includes('1066') && years.includes('1215'), 'year labels: ' + years.slice(0, 6).join(','));
  await pg.screenshot({ path: 'shot-timeline.png' });
  // v0.62 (P3 T-102, Q2-a): decoration is the navy --study-accent (fact border, year, dot); war stays red
  const accent = await tokenRgb('--study-accent');
  assert(accent === await tokenRgb('--navy-light'), '--study-accent is navy-light');
  assert(await css('.tl-item:not(.war) .tl-year', 'color') === accent, 'timeline year is study accent');
  assert(await pg.$eval('.tl-item:not(.war) .tl-year', e => getComputedStyle(e, '::after').backgroundColor) === accent, 'timeline dot is study accent');
  // v0.70: each dot's centre sits on the vertical middle of its year text, one line or two ("c. 3000 BC"). The line
  // boxes are trimmed to cap height / baseline (text-box), so the content box is the glyphs' box (digits and
  // capitals); and the text keeps TL_YEAR_GAP_PX clear of the dot's ring
  const TL_YEAR_GAP_PX = 6;
  const dotOff = await pg.$$eval('.tl-year', els => els.map(e => {
    const cs = getComputedStyle(e), a = getComputedStyle(e, '::after'), r = e.getBoundingClientRect();
    const padTop = parseFloat(cs.paddingTop);
    const contentMid = r.top + padTop + (r.height - padTop) / 2;
    const dot = r.top + parseFloat(a.top);
    const range = document.createRange(); range.selectNodeContents(e);
    const textRight = Math.max(...[...range.getClientRects()].map(x => x.right));
    const ring = parseFloat(a.boxShadow.split(' ').slice(-1)[0]);
    const dotLeft = r.right - parseFloat(a.right) - parseFloat(a.width) - 2 * parseFloat(a.borderLeftWidth) - ring;
    return { year: e.textContent, trim: cs.textBoxTrim, off: Math.abs(dot - contentMid), gap: dotLeft - textRight, lines: new Set([...range.getClientRects()].map(x => Math.round(x.top))).size };
  }));
  const offCentre = dotOff.filter(d => d.trim !== 'trim-both' || d.off > 0.5 || d.gap < TL_YEAR_GAP_PX - 0.5);
  assert(dotOff.some(d => d.lines > 1) && offCentre.length === 0, `timeline dots centred on the cap-trimmed year text and ${TL_YEAR_GAP_PX}px clear of it, incl. ${dotOff.filter(d => d.lines > 1).length} two-line years (bad: ${JSON.stringify(offCentre.slice(0, 3))})`);
  // v0.70: the difficulty stars take a line of their own under the card's tags, at its left edge
  const starsOff = await pg.$$eval('#studyContent .fact', cards => cards.map(c => {
    const meta = c.querySelector('.fact-meta'), stars = meta.querySelector('.stars').getBoundingClientRect();
    const others = [...meta.children].filter(e => !e.classList.contains('stars')).map(e => e.getBoundingClientRect());
    const below = others.every(o => stars.top >= o.bottom - 0.5);
    return below && Math.abs(stars.left - meta.getBoundingClientRect().left) <= 0.5 ? null : c.dataset.factId;
  }).filter(Boolean));
  assert(starsOff.length === 0, `timeline: stars on their own line under the tags (bad: ${starsOff.slice(0, 5).join(', ')})`);
  assert(await css('.tl-item:not(.war) .fact', 'borderLeftColor') === accent, 'fact left border is study accent');
  assert(await css('.tl-item.war .tl-year', 'color') === await tokenRgb('--red'), 'war year stays red');
  await pg.click('.chip.war');
  assert((await count()) === '24 / 24 facts', 'wars only 24: ' + await count());
  assert(await pg.$$eval('.tl-item', els => els.every(e => e.classList.contains('war'))), 'all items war');
  await pg.click('.chip.war');

  await pg.click('.study-tab[data-tab="geo"]');
  assert((await count()) === '32 / 32 facts', 'geo 32: ' + await count());
  const nations = await pg.$$eval('.study-group-title', els => els.map(e => e.textContent.trim().split(' ').slice(1).join(' ')));
  assert(nations.length === 5, 'geo 5 nation groups: ' + nations.join(' | '));
  await checkChapterNumbers('en geo');
  await checkGroupTitlesNoCount('en geo');
  await pg.screenshot({ path: 'shot-geo.png' });
  assert(await css('.study-sub-title', 'color') === accent, 'geography sub-title is study accent');

  await pg.click('.study-tab[data-tab="people"]');
  assert((await count()) === '55 / 55 facts', 'people 55: ' + await count());
  const firstNames = await pg.$$eval('.fact-name', els => els.slice(0, 4).map(e => e.textContent));
  assert(firstNames[0] === 'Julius Caesar' && firstNames[1] === 'Boudicca', 'monarchs chronological: ' + firstNames.join(', '));
  await checkChapterNumbers('en people');
  await checkGroupTitlesNoCount('en people');
  await pg.screenshot({ path: 'shot-people.png' });

  // search
  await pg.click('.study-tab[data-tab="chapters"]');
  await pg.fill('#studySearch', 'Magna');
  assert((await count()) === '1 / 236 facts', 'search Magna across chapters: ' + await count());
  // a search never renumbers: Magna Carta keeps its chapter number, not "#1" of the result list
  await checkChapterNumbers('en chapters search Magna');
  assert(await pg.$eval('#studyContent .fact .fact-id', e => e.textContent) !== '#1', 'search result keeps its chapter number, not #1 of the list');
  // Cantonese search: the term comes from the data (Track 2 rewrites yue wording), not a hard-coded word.
  // First 2-character CJK run in fact yue order that only Cantonese text contains, found in >= 5 facts
  // across >= 2 chapters; the count shown must equal the facts whose yue contains it.
  const term = await pg.evaluate(() => {
    const cjkPair = /[\u4e00-\u9fff]{2}/g, seen = new Set();
    for (const f of STUDY) for (const m of f.yue.matchAll(cjkPair)) {
      const w = m[0];
      if (seen.has(w)) continue;
      seen.add(w);
      const hits = STUDY.filter(x => x.yue.includes(w));
      const latin = STUDY.some(x => (x.en + ' ' + (x.p ? x.p[0] : '') + ' ' + (x.yl || '')).includes(w));
      if (!latin && hits.length >= 5 && new Set(hits.map(x => x.ch)).size >= 2) return { w, n: hits.length };
    }
    return null;
  });
  assert(term, 'data has a Cantonese search term in >= 5 facts across chapters: ' + JSON.stringify(term));
  await pg.fill('#studySearch', term.w);
  const n = parseInt(await count());
  assert(n === term.n && n >= 5, `cantonese search ${term.w} across chapters: ${n} (expected ${term.n})`);
  await pg.fill('#studySearch', '');

  // bookmark + mastered
  await pg.click('#studySubChips .chip:nth-child(1)'); // Ch1
  // v0.62 (P3 T-104): bookmark is the Practice flag SVG — outline muted, on = orange fill; no ☆ / ★ text
  const bmBtn = pg.locator('.fact').first().locator('.fact-btn.star');
  const bmPath = () => bmBtn.locator('svg path').evaluate(e => ({ fill: getComputedStyle(e).fill, stroke: getComputedStyle(e).stroke }));
  const orange = await tokenRgb('--orange');
  assert((await bmBtn.textContent()).trim() === '' && await bmBtn.locator('svg[aria-hidden="true"] path').count() === 1, 'bookmark button is a decorative SVG, no star text');
  const offPath = await bmPath();
  assert(offPath.fill === 'none' && offPath.stroke === await tokenRgb('--text-muted'), 'bookmark off: outline in text-muted: ' + JSON.stringify(offPath));
  const bmChip = pg.locator('#studyChips .chip[data-arg="bookmarksOnly"]');
  assert(await bmChip.locator('svg.chip-flag path').count() === 1 && (await bmChip.textContent()).trim() === 'Bookmarked only', 'Bookmarked only chip has the flag SVG and no ★');
  // chip icon follows the fact button: outline while the filter is off (mockup #study-chapters)
  const chipPath = await bmChip.locator('svg.chip-flag path').evaluate(e => ({ fill: getComputedStyle(e).fill, stroke: getComputedStyle(e).stroke }));
  assert(chipPath.fill === 'none' && chipPath.stroke === await tokenRgb('--text-muted'), 'Bookmarked only chip icon is an outline when off: ' + JSON.stringify(chipPath));
  // v0.62 (P3 T-105, O1 / O2): labelled toggle buttons with aria-pressed; 32px box, 44px hit area
  const tickBtn = pg.locator('.fact').first().locator('.fact-btn.tick');
  const aria = loc => loc.evaluate(e => [e.getAttribute('aria-label'), e.getAttribute('aria-pressed')].join('|'));
  assert(await aria(bmBtn) === 'Bookmark|false' && await aria(tickBtn) === 'Mastered|false', 'fact buttons: aria-label + aria-pressed=false');
  const hit = await bmBtn.evaluate(e => {
    const r = e.getBoundingClientRect();
    const HIT_OFFSET = 5; // inside the 6px ::before ring, outside the 32px box
    const at = (x, y) => document.elementFromPoint(x, y)?.closest('.fact-btn') === e;
    return { w: r.width, h: r.height, top: at(r.left + r.width / 2, r.top - HIT_OFFSET), left: at(r.left - HIT_OFFSET, r.top + r.height / 2) };
  });
  assert(hit.w === 32 && hit.h === 32 && hit.top && hit.left, 'fact button 32x32 with a hit area beyond the box: ' + JSON.stringify(hit));
  // CUI-0009: the ring is measured from the border box, so the tappable height is the full 44px (it was 42px:
  // `inset` counts from the padding box, inside the 1.5px border). Scan whole px outward from each visible edge.
  const MIN_TARGET = 44;
  const SCAN_MAX = 12;
  const reach = await pg.locator('.fact .fact-btn').evaluateAll((btns, max) => btns.slice(0, 2).map(e => {
    const r = e.getBoundingClientRect();
    const at = (x, y) => document.elementFromPoint(x, y)?.closest('.fact-btn') === e;
    const out = probe => { let d = 0; while (d < max && probe(d + 1)) d++; return d; };
    const midX = r.left + r.width / 2, midY = r.top + r.height / 2;
    return {
      h: r.height + out(d => at(midX, r.top - d)) + out(d => at(midX, r.bottom - 1 + d)),
      outer: e.classList.contains('star') ? out(d => at(r.left - d, midY)) : out(d => at(r.right - 1 + d, midY)),
    };
  }), SCAN_MAX);
  assert(reach.every(r => r.h >= MIN_TARGET && r.outer >= 6), `fact buttons: tappable height >= ${MIN_TARGET}px, outer side reaches 6px: ` + JSON.stringify(reach));
  // W-009: the buttons sit 4px apart, so their rings must meet in the gap, not overlap a visible box —
  // a tap just inside the bookmark's right edge must not toggle Mastered (and vice versa); outer rings stay enlarged
  const EDGE_INSET = 1; // 1px inside the visible 32px box
  const seam = await pg.locator('.fact').first().evaluate((card, inset) => {
    const [bm, tick] = [card.querySelector('.fact-btn.star'), card.querySelector('.fact-btn.tick')];
    const [b, k] = [bm.getBoundingClientRect(), tick.getBoundingClientRect()];
    const at = (x, y) => document.elementFromPoint(x, y)?.closest('.fact-btn');
    const midY = b.top + b.height / 2;
    const OUTER_RING = 4; // well inside the ring (6px past the visible edge since CUI-0009)
    return {
      bmRightEdge: at(b.right - inset, midY) === bm,
      tickLeftEdge: at(k.left + inset, midY) === tick,
      tickRightRing: at(k.right + OUTER_RING, midY) === tick,
      tickTopRing: at(k.left + k.width / 2, k.top - OUTER_RING) === tick,
    };
  }, EDGE_INSET);
  assert(Object.values(seam).every(Boolean), 'fact button hit areas do not overlap a neighbour\'s visible box: ' + JSON.stringify(seam));
  // O8: tag and fact button corners come from the --radius-xs token (were literal 5px / 7px)
  const xs = await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--radius-xs').trim());
  // v0.63: Ch 1 cards have no tag left in the chapter view ("Appears ×n" became the source row) — probe one
  const tagRadius = await pg.$eval('.fact .fact-meta', m => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    m.append(tag);
    const r = getComputedStyle(tag).borderTopLeftRadius;
    tag.remove();
    return r;
  });
  assert(xs !== '' && await bmBtn.evaluate(e => getComputedStyle(e).borderTopLeftRadius) === xs
    && tagRadius === xs, 'fact button + tag radius = --radius-xs: ' + xs);
  await bmBtn.click();
  assert(await aria(bmBtn) === 'Bookmark|true', 'bookmark aria-pressed=true after toggle');
  const onPath = await bmPath();
  assert(onPath.fill === orange && onPath.stroke === orange, 'bookmark on: orange fill: ' + JSON.stringify(onPath));
  assert(await bmBtn.evaluate(e => getComputedStyle(e).backgroundColor) === await tokenRgb('--flag-bg'), 'bookmark on: flag-bg background');
  await tickBtn.click();
  assert(await aria(tickBtn) === 'Mastered|true', 'mastered aria-pressed=true after toggle');
  assert(await pg.locator('.fact').first().evaluate(e => e.classList.contains('mastered')), 'mastered class applied');
  assert(await pg.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('lifeuk.studyMastered'))).length === 1 && Object.keys(JSON.parse(localStorage.getItem('lifeuk.studyBookmarks'))).length === 1), 'persisted in localStorage');
  await pg.click('text=Hide mastered');
  assert((await count()) === '1 / 2 facts', 'hide mastered: ' + await count());
  assert(await pg.$eval('#studyContent .fact .fact-id', e => e.textContent) === '#2', 'hide mastered: the remaining Ch1 card stays "#2"');
  await pg.click('text=Hide mastered');
  await pg.click('text=Bookmarked only');
  assert((await count()) === '1 / 2 facts', 'bookmarks only: ' + await count());
  await pg.click('.study-tab[data-tab="people"]');
  assert((await count()) === '0 / 55 facts', 'bookmarks only carries across tabs: ' + await count());
  assert(await pg.$eval('#studyContent', e => e.textContent.includes('No facts match')), 'empty state shown');
  await pg.click('text=Bookmarked only');

  // prefs persist across reload
  await pg.reload();
  await pg.click('#modeStudy');
  assert(await pg.$eval('.study-tab.active', e => e.dataset.tab) === 'people', 'tab persisted after reload');
  // zh-HK: the same numbers, the pill text stays English (S-057)
  await pg.evaluate(() => { setLang('zh-HK'); studySetTab('chapters'); studySetChapter(3); });
  assert(await pg.$eval('#studyContent .fact .fact-id', e => e.textContent) === '#1', 'zh-HK Ch3 first card "#1"');
  await checkChapterNumbers('zh-HK chapters › 3');
  await checkGroupTitlesNoCount('zh-HK chapters › 3');
  for (const tab of ['timeline', 'geo', 'people']) {
    await pg.evaluate(tab => studySetTab(tab), tab);
    await checkChapterNumbers('zh-HK ' + tab);
    if (tab !== 'timeline') await checkGroupTitlesNoCount('zh-HK ' + tab);
  }
  assert(await pg.evaluate(() => t('study.chapterFactId', { ch: 3, n: 1 })) === 'Ch 3 #1', 'zh-HK study.chapterFactId is English "Ch 3 #1"');
  await pg.evaluate(() => { setLang('en'); studySetTab('people'); });
  assert(await pg.evaluate(() => t('study.chapterFactId', { ch: 3, n: 1 })) === 'Ch 3 #1', 'en study.chapterFactId "Ch 3 #1"');
  await pg.click('#screenStudy .back-btn');
  assert(await pg.$eval('#screenHome', e => e.classList.contains('active')), 'back to home');

  assert(errs.length === 0, 'no page errors: ' + errs.join(';'));
  await b.close();
  console.log('STUDY PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
