// QA v1.0.7 exploratory (note tables): one question per group x 3 screens (Practice / Results / Study)
// x 3 viewports (390 / 360 / 1280) x 2 UI langs (en / zh-HK). Screenshots -> $QA_OUT (default /tmp)
// run: NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium node <this>
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const URL = 'file://' + ROOT + '/index.html';
const OUT = process.env.QA_OUT || '/tmp/qa-v107';
fs.mkdirSync(OUT, { recursive: true });
const PICK = { 1: '1.5', 2: '3.2', 3: '9.20', 4: '6.9', 5: '1.21', 6: '2.15', 7: '17.13', 8: '2.9', 9: '13.6', 10: '4.9' };
const EXTRA = { '4b': '5.23', '9b': '15.20', '10b': '7.19' };
const VPS = [390, 360, 1280];
const LANGS = ['en', 'zh-HK'];

const INSPECT = `(root) => {
  const tables = [...root.querySelectorAll('.note-table-wrap')];
  const host = root.querySelector('.ans-note-text, .rv-note, .fact-mem-body') || root;
  const seq = [...host.children].map(c => c.className.split(' ')[0] + (c.className.includes('bullet') ? '.bullet' : ''));
  const t = tables[0] && tables[0].querySelector('table');
  const cs = el => (el ? getComputedStyle(el) : null);
  const th = t && t.querySelector('th'), td1 = t && t.querySelector('tbody td'), sub = t && t.querySelector('.note-cell-sub');
  const tok = n => { const i = document.createElement('i'); i.style.color = 'var(' + n + ')'; document.body.appendChild(i); const c = getComputedStyle(i).color; i.remove(); return c; };
  let mp = null;
  const mpSub = t && [...t.querySelectorAll('.note-cell-sub')].find(s => /MP$/.test(s.textContent));
  if (mpSub) {
    const cell = mpSub.parentElement; const rg = document.createRange(); rg.selectNodeContents(cell);
    mp = { text: cell.innerText, lines: new Set([...rg.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))).size };
  }
  const first = host.firstElementChild;
  return {
    n: tables.length, seq, firstLine: first && first.className.includes('rv-note-line') ? first.textContent : null,
    wrapFit: tables.map(w => [w.scrollWidth, w.clientWidth]),
    pageScroll: [document.documentElement.scrollWidth, innerWidth],
    th: th && [cs(th).color, cs(th).borderBottomWidth, cs(th).borderBottomColor, cs(th).fontWeight],
    navy: tok('--navy'), muted: tok('--text-muted'),
    td1: td1 && [cs(td1).fontWeight, cs(td1).color],
    sub: sub && [cs(sub).fontSize, cs(sub).color, cs(sub).fontWeight, cs(sub).display],
    tdFont: td1 && cs(td1).fontSize, mp,
  };
}`;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  const results = [];
  const errs = [];
  for (const lang of LANGS) for (const vw of VPS) {
    const pg = await b.newPage({ viewport: { width: vw, height: 900 } });
    pg.on('pageerror', e => errs.push(e.message));
    pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await pg.goto(URL); await pg.evaluate(() => localStorage.clear()); await pg.reload();
    await pg.evaluate(l => setLang(l), lang);
    for (const [g, key] of Object.entries({ ...PICK, ...EXTRA })) {
      const pr = await pg.evaluate(({ key, src }) => {
        const [e, n] = key.split('.').map(Number);
        pendingMode = 'practice'; startExam(e);
        state.current = state.questions.findIndex(q => q.examNum === e && q.origIdx === n - 1);
        renderQuestion(); selectOption(state.questions[state.current].a[0]);
        const box = document.getElementById('ansNote'); box.scrollIntoView();
        return { label: box.querySelector('strong').textContent, ...new Function('return ' + src)()(box) };
      }, { key, src: INSPECT });
      results.push({ lang, vw, g, key, screen: 'practice', ...pr });
      await pg.locator('#ansNote').screenshot({ path: `${OUT}/practice-g${g}-${vw}-${lang}.png` });
      const rs = await pg.evaluate(({ key, src }) => {
        const [e, n] = key.split('.').map(Number);
        pendingMode = 'exam'; startExam(e); state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); finishExam();
        const idx = state.questions.findIndex(q => q.examNum === e && q.origIdx === n - 1);
        const it = [...document.querySelectorAll('#reviewList .review-item')].find(x => Number(x.id.slice(2)) === idx);
        if (!it) return { missing: true };
        it.scrollIntoView();
        return { id: it.id, label: (it.querySelector('.rv-note-label') || {}).textContent, ...new Function('return ' + src)()(it) };
      }, { key, src: INSPECT });
      results.push({ lang, vw, g, key, screen: 'results', ...rs });
      if (rs.id) await pg.locator('#' + rs.id).screenshot({ path: `${OUT}/results-g${g}-${vw}-${lang}.png` });
    }
    const st = await pg.evaluate(({ src, picks }) => {
      const out = []; openStudy();
      const ex = new Function('return ' + src)();
      for (const [g, key] of Object.entries(picks)) {
        const [e, n] = key.split('.').map(Number);
        const f = STUDY.find(f => f.src.includes(`${e}.${n - 1}`) && factMemoryText(f).includes('|'))
          || STUDY.find(f => f.src.some(k => { const q = questionByKey(k).q; return q && (q.note || '').includes('|') && q.note.slice(q.note.indexOf('記憶法')) === (EXAMS[e][n - 1].note || '').slice(EXAMS[e][n - 1].note.indexOf('記憶法')); }) && factMemoryText(f).includes('|'));
        if (!f) { out.push({ g, key, screen: 'study', missing: true }); continue; }
        studySetTab('chapters'); studySetChapter(f.ch);
        const card = document.querySelector(`#studyContent .fact[data-fact-id="${f.id}"]`);
        if (!card) { out.push({ g, key, screen: 'study', missing: 'card ' + f.id }); continue; }
        const d = card.querySelector('details.fact-mem'); d.open = true; card.scrollIntoView();
        out.push({ g, key, factId: f.id, screen: 'study', label: d.querySelector('summary').textContent, ...ex(d.querySelector('.fact-mem-body')) });
      }
      return out;
    }, { src: INSPECT, picks: PICK });
    for (const s of st) {
      results.push({ lang, vw, ...s });
      if (s.factId) await pg.evaluate(id => { const f = STUDY.find(x => x.id === id); studySetChapter(f.ch); const c = document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`); c.querySelector('details.fact-mem').open = true; c.scrollIntoView(); }, s.factId);
      if (s.factId) await pg.locator(`#studyContent .fact[data-fact-id="${s.factId}"]`).screenshot({ path: `${OUT}/study-g${s.g}-${vw}-${lang}.png` });
    }
    await pg.close();
  }
  fs.writeFileSync(OUT + '/explore.json', JSON.stringify({ results, errs }, null, 1));
  const bad = [];
  for (const r of results) {
    const probs = [];
    if (r.missing) probs.push('missing ' + r.missing);
    else {
      if (r.n !== 1) probs.push('tables=' + r.n);
      if (r.wrapFit.some(([s, c]) => s > c)) probs.push('wrap scroll ' + JSON.stringify(r.wrapFit));
      if (r.pageScroll[0] > r.pageScroll[1]) probs.push('page scroll ' + r.pageScroll);
      if (!r.th || r.th[0] !== r.navy || r.th[1] !== '2px' || r.th[2] !== r.navy) probs.push('th ' + r.th);
      if (!r.td1 || r.td1[0] !== '700' || r.td1[1] !== r.navy) probs.push('td1 ' + r.td1);
      if (r.sub && (r.sub[1] !== r.muted || r.sub[2] !== '400' || r.sub[3] !== 'block')) probs.push('sub ' + r.sub);
      if (r.mp && r.mp.lines !== 2) probs.push('MP lines ' + JSON.stringify(r.mp));
    }
    if (probs.length) bad.push(`${r.lang} ${r.vw} ${r.screen} g${r.g} E${r.key}: ${probs.join('; ')}`);
  }
  console.log('checks', results.length, 'bad', bad.length); bad.forEach(x => console.log('  BAD', x));
  console.log('errors', JSON.stringify(errs));
  for (const r of results.filter(r => r.vw === 390)) console.log(r.lang, r.screen, 'g' + r.g, r.key, '|', r.label, '|', JSON.stringify(r.seq), '| first:', r.firstLine, r.mp ? '| MP ' + JSON.stringify(r.mp) : '', '| sub', r.sub && r.sub[0], 'td', r.tdFont);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
