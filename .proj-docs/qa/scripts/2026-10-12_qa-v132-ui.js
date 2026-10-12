const { chromium } = require('playwright-core');
const S = process.env.S, ROOT = process.argv[2];
const URL = 'file://' + ROOT + '/index.html';
const KEYS = ['10.10','12.12','6.20','13.12','6.3','1.7','11.8','7.8','4.16'];
const FIT_JS = `(root) => [...root.querySelectorAll('.note-table-wrap')].map(w => {
  const r = w.getBoundingClientRect(), p = w.parentElement.getBoundingClientRect();
  const lines = c => { const rg = document.createRange(); rg.selectNodeContents(c); return new Set([...rg.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top))).size; };
  const broken = [...w.querySelectorAll('th:not(.multi), td:not(.multi)')].filter(c => c.textContent.trim() && lines(c) > 1).map(c => c.textContent);
  return { sw: w.scrollWidth, cw: w.clientWidth, over: Math.round(r.right - p.right), docW: document.documentElement.scrollWidth, vw: innerWidth, broken, cols: w.querySelector('tr') ? w.querySelector('tr').cells.length : 0 };
})`;
const ok = f => f.every(x => x.sw <= x.cw && x.over <= 0.5 && x.docW <= x.vw && x.broken.length === 0);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  const out = []; let fails = 0;
  for (const lang of ['en', 'zh-HK']) for (const width of [390, 320]) {
    const pg = await b.newPage({ viewport: { width, height: 844 } });
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(URL); await pg.evaluate(() => localStorage.clear()); await pg.reload();
    await pg.evaluate(l => setLang(l), lang);
    for (const key of KEYS) {
      // Practice
      const pr = await pg.evaluate(({ key, fitSrc }) => {
        const [e, i] = key.split('.').map(Number);
        pendingMode = 'practice'; startExam(e);
        state.current = state.questions.findIndex(q => q.examNum === e && q.origIdx === i);
        if (state.current < 0) return { missing: true };
        renderQuestion(); state.questions[state.current].a.forEach(selectOption);
        const box = document.getElementById('ansNote'); box.scrollIntoView();
        return { visible: box.offsetParent !== null, text: box.innerText.slice(0, 80), hasBrText: box.innerHTML.includes('&lt;br&gt;'), fit: new Function('return ' + fitSrc)()(box) };
      }, { key, fitSrc: FIT_JS });
      const pOk = pr.visible && !pr.hasBrText && ok(pr.fit);
      if (!pOk) fails++;
      out.push(`${lang} ${width} practice ${key} ${pOk ? 'OK' : 'FAIL'} ${JSON.stringify(pr.fit)} ${pr.text.replace(/\n/g, ' / ')}`);
      if (['13.12','10.10','4.16','1.7'].includes(key)) await pg.locator('#ansNote').screenshot({ path: `${S}/shots/practice_${key}_${lang}_${width}.png` });
      // Results (that exam, all correct)
      const rr = await pg.evaluate(({ key, fitSrc }) => {
        const [e, i] = key.split('.').map(Number);
        pendingMode = 'exam'; startExam(e); state.questions.forEach((q, j) => { state.answers[j] = [...q.a]; }); finishExam();
        const it = [...document.querySelectorAll('#reviewList .review-item')].find(el => { const q = state.questions[Number(el.id.slice(2))]; return q.examNum === e && q.origIdx === i; });
        if (!it) return { missing: true };
        it.scrollIntoView();
        return { id: it.id, hasNote: /記憶法|Gunpowder Plot（火藥陰謀）：1605 年 Guy Fawkes/.test(it.innerText), hasBrText: it.innerHTML.includes('&lt;br&gt;'), fit: new Function('return ' + fitSrc)()(it) };
      }, { key, fitSrc: FIT_JS });
      const rOk = !rr.missing && rr.hasNote && !rr.hasBrText && ok(rr.fit);
      if (!rOk) fails++;
      out.push(`${lang} ${width} results ${key} ${rOk ? 'OK' : 'FAIL'} ${JSON.stringify(rr.fit)}`);
      if (key === '13.12' && width === 320) await pg.locator('#' + rr.id).screenshot({ path: `${S}/shots/results_${key}_${lang}_${width}.png` });
      // Study card(s) with that src
      const sr = await pg.evaluate(({ key, fitSrc }) => {
        openStudy(); const facts = STUDY.filter(f => f.src.includes(key));
        return facts.map(f => {
          studySetTab('chapters'); studySetChapter(f.ch);
          const c = document.querySelector(`#studyContent .fact[data-fact-id="${f.id}"]`);
          const d = c && c.querySelector('details.fact-mem'); if (!d) return { id: f.id, noMem: true };
          d.open = true; c.scrollIntoView();
          return { id: f.id, num: c.querySelector('.fact-id') && c.querySelector('.fact-id').textContent, memo: d.innerText.split('\n')[1], hasBrText: d.innerHTML.includes('&lt;br&gt;'), fit: new Function('return ' + fitSrc)()(d.querySelector('.fact-mem-body')) };
        });
      }, { key, fitSrc: FIT_JS });
      for (const s of sr) {
        // 7.8 is a 備注 (no 記憶法 heading): its Study card has no 💡, by design (factMemoryText)
        const sOk = key === '7.8' ? !!s.noMem : (!s.noMem && !s.hasBrText && ok(s.fit));
        if (!sOk) fails++;
        out.push(`${lang} ${width} study ${key} fact#${s.id} (${s.num}) ${sOk ? 'OK' : 'FAIL'} ${JSON.stringify(s.fit)} ${s.memo}`);
        if (key === '13.12' || key === '10.10') await pg.locator(`#studyContent .fact[data-fact-id="${s.id}"]`).screenshot({ path: `${S}/shots/study_${key}_f${s.id}_${lang}_${width}.png` });
      }
    }
    // Study Ch4 #125 + header
    const st = await pg.evaluate(() => { openStudy();
      studySetTab('chapters'); studySetChapter(4);
      const cards = [...document.querySelectorAll('#studyContent .fact')];
      const c125 = document.querySelector('#studyContent .fact[data-fact-id="125"]');
      const d = c125.querySelector('details.fact-mem'); if (d) d.open = true;
      c125.scrollIntoView();
      const nums = cards.map(c => [c.dataset.factId, c.querySelector('.fact-id').textContent]);
      return { count: cards.length, has126: !!document.querySelector('[data-fact-id="126"]'), nums: nums.slice(25, 31),
        last: nums[nums.length - 1], en: c125.querySelector('.fact-en').textContent, yue: c125.querySelector('.fact-yue').textContent,
        srcNodes: c125.querySelectorAll('.fact-src-nodes .sqm-node, .fact-src-nodes button, .fact-src-nodes a').length, srcText: c125.querySelector('.fact-src').innerText.replace(/\n/g, ' '),
        mem: d ? d.innerText.slice(0, 120) : null, progress: document.getElementById('studyProgress').innerText, docW: document.documentElement.scrollWidth, vw: innerWidth };
    });
    out.push(`${lang} ${width} STUDY-CH4 ${JSON.stringify(st)}`);
    await pg.locator('#studyContent .fact[data-fact-id="125"]').screenshot({ path: `${S}/shots/study_f125_${lang}_${width}.png` });
    await pg.evaluate(() => scrollTo(0, 0)); await pg.screenshot({ path: `${S}/shots/study_header_${lang}_${width}.png` });
    out.push(`${lang} ${width} pageerrors ${JSON.stringify(errs)}`); if (errs.length) fails++;
    await pg.close();
  }
  console.log(out.join('\n')); console.log('FAILS', fails);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
