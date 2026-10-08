// QA v0.72: pixel screenshots + computed style (incl. custom properties except --space-*) of v0.71 vs v0.72
// at narrow widths the review's visual-diff (390 / 900) does not reach, en + zh-HK.
//   node pixel-v072.js <new-root> <old-root> <out-dir> <widths csv> [mode=all|timeline] [selftest]
const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path');
const [NEW, OLD, OUT] = process.argv.slice(2, 5).map(p => path.resolve(p));
const WIDTHS = process.argv[5].split(',').map(Number);
const MODE = process.argv[6] || 'all';
const SELFTEST = process.argv[7] === 'selftest';
fs.mkdirSync(OUT, { recursive: true });

const vdSrc = fs.readFileSync(path.join(NEW, 'tests/tools/visual-diff.js'), 'utf8');
const answerAll = eval(vdSrc.match(/const answerAll = ([^\n]*);\n/)[1]);
const SC = eval('(' + vdSrc.match(/const SCENARIOS = (\{[\s\S]*?\n\});/)[1] + ')');
const openMem = "document.querySelectorAll('details.fact-mem').forEach((d, k) => { if (k < 3) d.open = true; });";
Object.assign(SC, {
  practiceAnswerNote: `pendingMode = 'practice'; startExam(3); const i = state.questions.findIndex(q => q.note && q.note.includes('\\n'));
    state.current = i; renderQuestion(); state.answers[i] = [...state.questions[i].a]; revealAnswer();`,
  practiceAnswerNoteWrong: `pendingMode = 'practice'; startExam(13); let i = state.questions.findIndex(q => q.note && q.note.includes('◦')); if (i < 0) i = 0;
    state.current = i; renderQuestion(); const q = state.questions[i]; selectOption(q.o.findIndex((_, k) => !q.a.includes(k)));`,
  studyCh3Mem: `openStudy(); studySetTab('chapters'); studySetChapter(3); ${openMem}`,
  studyCh1: "openStudy(); studySetTab('chapters'); studySetChapter(1)",
  studyTimelineMem: `openStudy(); studySetTab('timeline'); ${openMem}`,
  studyGeoAll: `openStudy(); studySetTab('geo'); studySetNation('all'); ${openMem}`,
  studyPeopleMem: `openStudy(); studySetTab('people'); ${openMem}`,
  infoOpenStudy: "openStudy(); document.getElementById('infoBtn').click()",
});
const TIMELINE = ['studyTimeline', 'studyTimelineWars', 'studyTimelineMem'];
const names = MODE === 'timeline' ? TIMELINE : Object.keys(SC);

const init = (lang) => {
  let s = 12345; Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const T = 1700000000000; Date.now = () => T;
  window.scrollTo = () => {}; Element.prototype.scrollIntoView = function () {};
  try { localStorage.clear(); if (lang !== 'en') localStorage.setItem('lifeuk.uiLang', JSON.stringify(lang)); } catch (e) {}
};
const PAUSE = '*, *::before, *::after { animation-play-state: paused !important; } ';
const dump = () => {
  const skip = e => ['SCRIPT', 'STYLE', 'LINK'].includes(e.tagName); const res = {}; let n = 0;
  const keyOf = e => e === document.body ? 'body' : e.id ? '#' + e.id : keyOf(e.parentElement) + '/' + e.tagName.toLowerCase() + [...e.parentElement.children].filter(c => !skip(c)).indexOf(e);
  for (const e of [document.documentElement, document.body, ...document.body.querySelectorAll('*')]) {
    if (skip(e) || (e !== document.documentElement && !e.getClientRects().length)) continue; n++;
    const st = []; const add = (cs, pre) => { for (let i = 0; i < cs.length; i++) if (!cs[i].startsWith('--space-')) st.push(pre + cs[i] + ':' + cs.getPropertyValue(cs[i]).trim()); };
    add(getComputedStyle(e), ''); for (const p of ['::before', '::after']) { const c = getComputedStyle(e, p); if (c.content && c.content !== 'none' && c.content !== 'normal') add(c, p); }
    const r = e.getBoundingClientRect();
    res[e === document.documentElement ? 'html' : keyOf(e)] = st.sort().join(';') + '|box:' + [r.x, r.y, r.width, r.height].map(v => Math.round(v * 100) / 100).join(',');
  }
  return { res, n, lang: document.documentElement.lang, scrollW: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
};

async function shot(browser, root, w, lang, name, extraCss) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 1 });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(init, lang);
  await pg.goto('file://' + path.join(root, 'index.html'));
  await pg.addStyleTag({ content: PAUSE + (extraCss || '') });
  await pg.evaluate(SC[name] || ''); await pg.evaluate(() => document.querySelectorAll('[id^=appVersion]').forEach(e => { e.textContent = 'v0.7X'; })); /* the version label legitimately differs */
  await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(250);
  const d = await pg.evaluate(dump);
  const png = await pg.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  await ctx.close(); return { d, png, errs };
}

async function pixDiff(browser, a, b) {
  const pg = await browser.newPage();
  const r = await pg.evaluate(async ([A, B]) => {
    const load = s => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = await Promise.all([load(A), load(B)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { size: [ia.width, ia.height, ib.width, ib.height] };
    const get = im => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };
    const da = get(ia), db = get(ib); let n = 0, y0 = 1e9, y1 = -1, md = 0;
    for (let i = 0; i < da.length; i += 4) if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2] || da[i + 3] !== db[i + 3]) { n++; for (let c = 0; c < 4; c++) md = Math.max(md, Math.abs(da[i + c] - db[i + c])); const y = Math.floor(i / 4 / ia.width); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { n, y0, y1, maxDelta: md };
  }, [a.toString('base64'), b.toString('base64')]);
  await pg.close(); return r;
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  let states = 0, pixSame = 0, styleSame = 0, elems = 0, scrollX = 0; const bad = [];
  const extraNew = SELFTEST ? ':root { --space-4: 9px; }' : '';
  for (const w of WIDTHS) for (const lang of ['en', 'zh-HK']) for (const name of names) {
    const a = await shot(browser, OLD, w, lang, name); const b = await shot(browser, NEW, w, lang, name, extraNew);
    states++; elems += b.d.n;
    const tag = `${w}:${lang}:${name}`;
    if (a.errs.length || b.errs.length) bad.push(`${tag} page errors ${a.errs} / ${b.errs}`);
    if (b.d.lang !== lang) bad.push(`${tag} lang ${b.d.lang}`);
    if (b.d.scrollW > b.d.cw) { scrollX++; if (a.d.scrollW <= a.d.cw) bad.push(`${tag} NEW horizontal scroll ${b.d.scrollW}>${b.d.cw}`); }
    const ka = Object.keys(a.d.res), kb = Object.keys(b.d.res); const sd = [];
    if (ka.join() !== kb.join()) sd.push('element set differs ' + ka.length + ' vs ' + kb.length);
    for (const k of ka) if (b.d.res[k] !== undefined && a.d.res[k] !== b.d.res[k]) {
      const sa = new Set(a.d.res[k].split(/;|\|/)), sb = new Set(b.d.res[k].split(/;|\|/));
      sd.push(`${k}: ${[...sa].filter(x => !sb.has(x)).slice(0, 2).join(';')} -> ${[...sb].filter(x => !sa.has(x)).slice(0, 2).join(';')}`);
    }
    if (sd.length) bad.push(`${tag} style ${sd.length}: ${sd.slice(0, 2).join(' | ')}`); else styleSame++;
    if (a.png.equals(b.png)) pixSame++;
    else { const p = await pixDiff(browser, a.png, b.png); if (p.n === 0) pixSame++; else { bad.push(`${tag} pixels ${JSON.stringify(p)}`); if (!SELFTEST) { fs.writeFileSync(path.join(OUT, `${tag.replace(/:/g, '_')}-old.png`), a.png); fs.writeFileSync(path.join(OUT, `${tag.replace(/:/g, '_')}-new.png`), b.png); } } }
    if (!SELFTEST && /^(homePracticeDiff|practiceAnswerNote|examResultFail|studyCh3Mem|studyTimelineMem|flaggedList|examModal|infoOpen)$/.test(name)) fs.writeFileSync(path.join(OUT, `v072_${w}_${lang}_${name}.png`), b.png);
  }
  console.log(`states ${states} | pixel-identical ${pixSame} | computed-style+box identical ${styleSame} | elements ${elems} | pages with x-scroll (both versions) ${scrollX} | bad ${bad.length}`);
  bad.slice(0, 25).forEach(x => console.log('  ' + x));
  await browser.close(); process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
