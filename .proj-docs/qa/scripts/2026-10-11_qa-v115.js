// QA v1.1.5: memo 4A table header 地區 → 國家 (2b26c5d) + title 地方議會 → 四地議會 (df1d798, S-193) — 8 questions (4.20 5.22 6.8 7.17 8.19 9.18 12.2 13.7, key = exam.0-based index)
// Practice answer box (correct answer; 5.22 also wrong = 威爾斯地區議會), Results review, Study 💡 記憶法 4A cards; 390 + 320, en + zh-HK
// usage: node 2026-10-11_qa-v115.js <shot dir>
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = process.env.QA_ROOT || path.resolve(__dirname, '../../..');
const SHOTS = process.argv[2];
const KEYS = ['4.20', '5.22', '6.8', '7.17', '8.19', '9.18', '12.2', '13.7'];
const HEAD = ['國家', '議會 / 地點', '議員'];
const TITLE = '記憶法（四地議會）：', OLD_TITLE = '記憶法（地方議會）';
const DISTRACTOR = { en: 'The Welsh local council', oy: '威爾斯地區議會' };
const results = []; let fail = 0;
const ok = (c, m) => { results.push((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };

// inspect the (single) 4A table under root: header cells, fit, horizontal scroll, page width
const TABLE_JS = `(root) => {
  const ws = [...root.querySelectorAll('.note-table-wrap')];
  return ws.map(w => {
    const t = w.querySelector('.note-table'), r = w.getBoundingClientRect(), p = w.parentElement.getBoundingClientRect();
    return { head: [...t.querySelectorAll('thead th')].map(th => th.textContent.trim()), rows: t.rows.length,
      firstCol: [...t.querySelectorAll('tbody tr')].map(tr => tr.cells[0].textContent.trim()),
      text: t.textContent, sw: w.scrollWidth, cw: w.clientWidth, over: r.right - p.right, left: p.left - r.left,
      docW: document.documentElement.scrollWidth, vw: innerWidth };
  });
}`;
const fits = t => t.sw <= t.cw && t.over <= 0.5 && t.left <= 0.5 && t.docW <= t.vw;
const is4A = t => t.text.includes('Senedd') && t.text.includes('Scottish Parliament');
const headOk = t => JSON.stringify(t.head) === JSON.stringify(HEAD) && !t.text.includes('地區');

(async () => {
  const opts = { args: ['--no-sandbox'] }; if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  const b = await chromium.launch(opts);
  const errs = [];
  for (const lang of ['en', 'zh-HK']) for (const width of [390, 320]) {
    const tag = `${lang}/${width}`;
    const pg = await b.newPage({ viewport: { width, height: 844 } });
    pg.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
    pg.on('console', m => { if (m.type() === 'error') errs.push(`${tag} console: ${m.text()}`); });
    await pg.goto('file://' + ROOT + '/index.html');
    await pg.evaluate(() => localStorage.clear()); await pg.reload();
    await pg.evaluate(l => setLang(l), lang); await pg.reload();
    const meta = await pg.evaluate(() => ({ lang: document.documentElement.lang, v: APP_VERSION }));
    ok(meta.lang === lang && meta.v === '1.1.5', `${tag}: html lang = ${meta.lang}, APP_VERSION = ${meta.v}`);

    // ── Practice: correct answer reveals the 4A note ──
    for (const key of KEYS) {
      const [e, i] = key.split('.').map(Number);
      const label = `${tag} Practice E${e} Q${i + 1}`;
      const r = await pg.evaluate(({ e, i, src, T, OT }) => {
        pendingMode = 'practice'; startExam(e);
        state.current = state.questions.findIndex(q => q.examNum === e && q.origIdx === i);
        if (state.current < 0) return null;
        renderQuestion(); state.questions[state.current].a.forEach(selectOption);
        const box = byId('ansNote');
        return { visible: box.offsetParent !== null, title: box.textContent.includes(T) && !box.textContent.includes(OT), tables: new Function('return ' + src)()(box) };
      }, { e, i, src: TABLE_JS, T: TITLE, OT: OLD_TITLE });
      ok(r && r.visible && r.title && r.tables.length === 1 && is4A(r.tables[0]), `${label}: answer box shows memo 4A (heading 「${TITLE}」, no 「${OLD_TITLE}」, 1 table)`);
      if (!r || r.tables.length !== 1) continue;
      const t = r.tables[0];
      ok(headOk(t), `${label}: header = ${t.head.join(' | ')}; no 地區 in table`);
      ok(t.firstCol.length === 4 && ['England', 'Scotland', 'Wales'].every(c => t.firstCol.includes(c)), `${label}: first column rows = ${t.firstCol.join(' / ')}`);
      ok(fits(t), `${label}: table fits, no scroll (sw ${t.sw}/${t.cw}, over ${t.over.toFixed(1)}, doc ${t.docW}/${t.vw})`);
      if (key === '6.8') await pg.evaluate(() => byId('ansNote').scrollIntoView()), await pg.screenshot({ path: `${SHOTS}/practice_${lang}_${width}_E6Q9.png` });
    }

    // ── 5.22 answered wrong with 威爾斯地區議會, read next to the memo ──
    {
      const label = `${tag} Practice E5 Q23 wrong`;
      const pos = await pg.evaluate(en => {
        pendingMode = 'practice'; startExam(5);
        state.current = state.questions.findIndex(q => q.examNum === 5 && q.origIdx === 22);
        renderQuestion();
        return state.questions[state.current].o.indexOf(en);
      }, DISTRACTOR.en);
      ok(pos >= 0, `${label}: distractor at shuffled position ${pos}`);
      await pg.click('#yueToggle');
      await pg.click(`#opt${pos}`);
      const r = await pg.evaluate(({ p, src }) => {
        const opts = [...document.querySelectorAll('#optionsContainer .opt')];
        const box = byId('ansNote');
        return { cls: opts[p].className, distYue: (opts[p].querySelector('.opt-yue') || {}).textContent,
          correct: opts.filter(o => o.classList.contains('correct')).map(o => (o.querySelector('.opt-yue') || {}).textContent),
          noteText: box.textContent, tables: new Function('return ' + src)()(box) };
      }, { p: pos, src: TABLE_JS });
      ok(r.cls.includes('wrong') && r.distYue === DISTRACTOR.oy, `${label}: 威爾斯地區議會 marked wrong (${r.cls})`);
      ok(r.correct.length === 1 && r.correct[0] === '威爾斯嘅下放議會', `${label}: correct = ${r.correct.join(' / ')}`);
      ok(!r.noteText.includes('地區'), `${label}: memo 4A text has no 地區 at all (header was the only one)`);
      ok(r.noteText.includes(TITLE) && !r.noteText.includes(OLD_TITLE), `${label}: heading 「${TITLE}」 next to 威爾斯地區議會`);
      ok(r.tables.length === 1 && headOk(r.tables[0]) && fits(r.tables[0]), `${label}: header ${r.tables[0] && r.tables[0].head.join(' | ')}, table fits`);
      await pg.evaluate(() => byId('optionsContainer').scrollIntoView());
      await pg.screenshot({ path: `${SHOTS}/practice_${lang}_${width}_E5Q23_wrong.png`, fullPage: true });
    }

    // ── Results review: exam mode, everything wrong (5.22 = 威爾斯地區議會) ──
    for (const e of [...new Set(KEYS.map(k => Number(k.split('.')[0])))]) {
      const targets = KEYS.filter(k => k.startsWith(e + '.')).map(k => Number(k.split('.')[1]));
      const r = await pg.evaluate(({ e, targets, src, d, T, OT }) => {
        pendingMode = 'exam'; startExam(e);
        state.questions.forEach((q, k) => {
          state.answers[k] = [e === 5 && q.origIdx === 22 ? q.o.indexOf(d) : (q.a[0] + 1) % q.o.length];
        });
        finishExam();
        return targets.map(i => {
          const k = state.questions.findIndex(q => q.examNum === e && q.origIdx === i);
          const it = byId('rv' + k); if (!it) return { i, missing: true };
          return { i, wrong: it.classList.contains('rv-wrong'), your: it.querySelector('.rv-your').textContent, title: it.textContent.includes(T) && !it.textContent.includes(OT), tables: new Function('return ' + src)()(it) };
        });
      }, { e, targets, src: TABLE_JS, d: DISTRACTOR.en, T: TITLE, OT: OLD_TITLE });
      for (const x of r) {
        const label = `${tag} Results E${e} Q${x.i + 1}`;
        ok(!x.missing && x.wrong && x.title && x.tables.length === 1, `${label}: rv-wrong, memo 4A shown with heading 「${TITLE}」`);
        if (x.missing || x.tables.length !== 1) continue;
        ok(headOk(x.tables[0]) && fits(x.tables[0]), `${label}: header ${x.tables[0].head.join(' | ')}, table fits (sw ${x.tables[0].sw}/${x.tables[0].cw})`);
        if (e === 5 && x.i === 22) ok(x.your.includes(DISTRACTOR.en), `${label}: your answer = ${DISTRACTOR.en}`);
      }
      if (e === 5) {
        await pg.evaluate(() => { const it = [...document.querySelectorAll('#reviewList .review-item')].find(x => x.textContent.includes('The Welsh local council')); it && it.scrollIntoView(); });
        await pg.screenshot({ path: `${SHOTS}/results_${lang}_${width}_E5Q23.png` });
      }
    }

    // ── Study: every 💡 記憶法 card whose table is 4A ──
    const s = await pg.evaluate(src => {
      const fit = new Function('return ' + src)();
      const out = [];
      openStudy(); studySetSearch('');
      for (const ch of CHAPTER_NUMBERS) {
        studySetTab('chapters'); studySetChapter(ch);
        for (const c of document.querySelectorAll('#studyContent .fact')) {
          const d = c.querySelector('details.fact-mem'); if (!d) continue;
          d.open = true;
          const t = fit(d.querySelector('.fact-mem-body'));
          const body = d.querySelector('.fact-mem-body').textContent;
          if (t.length && t[0].text.includes('Senedd') && t[0].text.includes('Scottish Parliament')) out.push({ ch, id: c.dataset.factId, t: t[0], summary: d.querySelector('summary').textContent.trim(), noTitle: !body.includes('記憶法（') && !body.includes('四地議會'), bullet: body.includes('England 冇自己嘅地方議會') });
        }
      }
      return out;
    }, TABLE_JS);
    ok(s.length > 0, `${tag} Study: ${s.length} 4A cards (#${s.map(x => x.id).join(', #')})`);
    for (const x of s) ok(x.noTitle && x.bullet && x.summary.includes('記憶法'), `${tag} Study ch${x.ch} #${x.id}: summary 「${x.summary}」, title line stripped (B3), England bullet kept`);
    for (const x of s) ok(headOk(x.t) && fits(x.t), `${tag} Study ch${x.ch} #${x.id}: header ${x.t.head.join(' | ')}, fits (sw ${x.t.sw}/${x.t.cw}, doc ${x.t.docW}/${x.t.vw})`);
    if (s.length) {
      await pg.evaluate(({ ch, id }) => { studySetTab('chapters'); studySetChapter(ch); const c = document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`); const d = c.querySelector('details.fact-mem'); d.open = true; c.scrollIntoView(); }, s[0]);
      await pg.screenshot({ path: `${SHOTS}/study_${lang}_${width}_4A.png` });
    }
    await pg.close();
  }
  ok(errs.length === 0, 'no page errors / console errors ' + JSON.stringify(errs));
  console.log(results.join('\n'));
  console.log(fail ? `QA115 FAIL (${fail})` : 'QA115 PASS');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
