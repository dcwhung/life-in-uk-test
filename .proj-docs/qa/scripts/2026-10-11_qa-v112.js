// QA v1.1.2 (S-168): fact #203 地區議會 memo — Practice / Results (wrong answers) / Study ch5 at 390 + 320, en + zh-HK
// usage: node 2026-10-11_qa-v112.js <shot dir>
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');

const ROOT = process.env.QA_ROOT || path.resolve(__dirname, '../../..');
const SHOTS = process.argv[2];
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/memo-notes.json'), 'utf8'));
const S168 = SPEC.memos.find(m => m.id === 'S168');
const KEYS = S168.questions;
const rowsOf = t => t.split('\n').filter(l => l.trim().startsWith('|')).map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim().split('<br>')));
const EXPECT = rowsOf(S168.text);
const results = []; let fail = 0;
const ok = (c, m) => { results.push((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const PROBE = `(root) => [...root.querySelectorAll('.note-table-wrap')].map(w => {
  const r = w.getBoundingClientRect(), p = w.parentElement.getBoundingClientRect();
  const lines = n => { const rg = document.createRange(); rg.selectNodeContents(n); return new Set([...rg.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top))).size; };
  const cells = [...w.querySelectorAll('th, td')];
  const segs = c => { const subs = [...c.querySelectorAll('.note-cell-sub')]; const main = [...c.childNodes].filter(n => !(n.nodeType === 1 && n.classList.contains('note-cell-sub'))).map(n => n.textContent).join('').trim(); return [main, ...subs.map(s => s.textContent.trim())]; };
  const rows = [...w.querySelectorAll('tr')].map(tr => [...tr.cells].map(segs));
  const broken = cells.filter(c => !c.classList.contains('multi') && lines(c) > 1).map(c => c.textContent);
  const subWrap = [...w.querySelectorAll('.note-cell-sub')].filter(s => lines(s) > 1).map(s => s.textContent);
  return { rows, sw: w.scrollWidth, cw: w.clientWidth, over: Math.round(r.right - p.right), left: Math.round(p.left - r.left), docW: document.documentElement.scrollWidth, vw: innerWidth, broken, subWrap };
})`;
function judge(label, list, head) {
  ok(list.length === 1, `${label}: exactly 1 table (${list.length})`);
  const f = list[0]; if (!f) return;
  const same = JSON.stringify(f.rows) === JSON.stringify(EXPECT);
  ok(same, `${label}: cell text verbatim = fixture (${f.rows.length} rows x ${f.rows[0].length} cols)` + (same ? '' : ' got ' + JSON.stringify(f.rows)));
  ok(f.sw <= f.cw && f.over <= 0 && f.left <= 0 && f.docW <= f.vw, `${label}: no horizontal scroll (sw ${f.sw}/cw ${f.cw}, over ${f.over}, docW ${f.docW}/vw ${f.vw})`);
  ok(f.broken.length === 0, `${label}: single-line cells unbroken ${JSON.stringify(f.broken)}`);
  if (f.subWrap.length) results.push(`info  ${label}: remark lines wrapping = ${JSON.stringify(f.subWrap)}`);
  if (head !== undefined) ok(head, `${label}: heading 記憶法（地區議會）： shown`);
}
(async () => {
  const opts = { args: ['--no-sandbox'] }; if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  const b = await chromium.launch(opts);
  const errs = [];
  results.push('info  expected rows ' + JSON.stringify(EXPECT));
  for (const lang of ['en', 'zh-HK']) for (const width of [390, 320]) {
    const pg = await b.newPage({ viewport: { width, height: 844 } });
    pg.on('pageerror', e => errs.push(`${lang}/${width}: ${e.message}`));
    pg.on('console', m => { if (m.type() === 'error') errs.push(`${lang}/${width} console: ${m.text()}`); });
    await pg.goto('file://' + ROOT + '/index.html');
    await pg.evaluate(() => localStorage.clear()); await pg.reload();
    await pg.evaluate(l => setLang(l), lang); await pg.reload();
    const tag = `${lang}/${width}`;
    const meta = await pg.evaluate(() => ({ lang: document.documentElement.lang, v: APP_VERSION }));
    ok(meta.lang === lang && meta.v === '1.1.2', `${tag}: document lang = ${meta.lang}, APP_VERSION = ${meta.v}`);
    for (const key of KEYS) {
      const [e, i] = key.split('.').map(Number);
      const r = await pg.evaluate(({ e, i, probe }) => {
        pendingMode = 'practice'; startExam(e);
        state.current = state.questions.findIndex(q => q.examNum === e && q.origIdx === i);
        renderQuestion();
        const q = state.questions[state.current];
        q.a.forEach(selectOption);
        const box = document.getElementById('ansNote');
        box.scrollIntoView();
        return { nA: q.a.length, visible: !!box && box.offsetParent !== null, fit: new Function('return ' + probe)()(box), head: box.textContent.includes('記憶法（地區議會）：') };
      }, { e, i, probe: PROBE });
      ok(r.visible, `${tag} Practice E${e} Q${i + 1}: answer box visible after picking ${r.nA} answer(s)`);
      judge(`${tag} Practice E${e} Q${i + 1}`, r.fit, r.head);
      await pg.screenshot({ path: `${SHOTS}/practice_${lang}_${width}_E${e}Q${i + 1}.png` });
    }
    for (const e of [9, 12]) {
      const r = await pg.evaluate(({ e, keys, probe }) => {
        pendingMode = 'exam'; startExam(e);
        state.questions.forEach((q, i) => { state.answers[i] = [(q.a[0] + 1) % q.o.length]; });
        finishExam();
        const out = {};
        [...document.querySelectorAll('#reviewList .review-item')].forEach(it => {
          const q = state.questions[Number(it.id.slice(2))];
          const k = `${q.examNum}.${q.origIdx}`;
          if (keys.includes(k)) out[k] = { fit: new Function('return ' + probe)()(it), head: it.textContent.includes('記憶法（地區議會）：') };
        });
        return out;
      }, { e, keys: KEYS, probe: PROBE });
      for (const k of KEYS.filter(k => k.startsWith(e + '.'))) {
        const i = Number(k.split('.')[1]);
        ok(!!r[k], `${tag} Results E${e} Q${i + 1}: review item found`);
        if (r[k]) judge(`${tag} Results E${e} Q${i + 1}`, r[k].fit, r[k].head);
      }
      if (e === 12) {
        await pg.evaluate(() => { const it = [...document.querySelectorAll('#reviewList .review-item')].find(x => x.textContent.includes('記憶法（地區議會）：')); it && it.scrollIntoView(); });
        await pg.screenshot({ path: `${SHOTS}/results_${lang}_${width}_E12.png` });
      }
    }
    const s = await pg.evaluate(probe => {
      openStudy();
      studySetTab('chapters'); studySetChapter(5);
      const card = document.querySelector('#studyContent .fact[data-fact-id="203"]');
      if (!card) return { missing: true };
      const d = card.querySelector('details.fact-mem');
      const summary = d.querySelector('summary').textContent;
      d.querySelector('summary').click();
      const r = { open: d.open, summary, fit: new Function('return ' + probe)()(d.querySelector('.fact-mem-body')) };
      studySetTab('timeline');
      r.inTimeline = !!document.querySelector('#studyContent .fact[data-fact-id="203"]');
      studySetTab('chapters');
      const c2 = document.querySelector('#studyContent .fact[data-fact-id="203"]');
      c2.querySelector('details.fact-mem').open = true; c2.scrollIntoView();
      return r;
    }, PROBE).catch(e => ({ missing: true, err: e.message }));
    ok(!s.missing, `${tag} Study ch5: card #203 rendered ${s.err || ''}`);
    if (!s.missing) {
      ok(s.open && s.summary === '💡 記憶法', `${tag} Study #203: summary click opens, label = ${s.summary}`);
      judge(`${tag} Study #203`, s.fit);
      results.push(`info  ${tag} Study timeline shows #203: ${s.inTimeline} (fact has no year)`);
      await pg.screenshot({ path: `${SHOTS}/study_${lang}_${width}_203.png` });
    }
    await pg.close();
  }
  ok(errs.length === 0, 'no page errors / console errors ' + JSON.stringify(errs));
  console.log(results.join('\n'));
  console.log(fail ? `QA112 FAIL (${fail})` : 'QA112 PASS');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
