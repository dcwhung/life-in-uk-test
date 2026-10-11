// QA v1.1.4 (S-188 / S-192): local council = 地區議會 — 5 questions' oy in Practice (before answering with Translate,
// after a wrong answer) + Results review, Study #197 / #203 yue + search, 5.22 option next to memo 4A, 390 + 320, en + zh-HK
// usage: node 2026-10-11_qa-v114.js <shot dir>
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');

const ROOT = process.env.QA_ROOT || path.resolve(__dirname, '../../..');
const SHOTS = process.argv[2];
const OLD = '地方議會', NEW = '地區議會';
// key = exam.0-based index, j = original option index of the local-council distractor
const CASES = [
  { key: '4.19', j: 2, en: 'Manage local councils', oy: '管理地區議會' },
  { key: '5.12', j: 1, en: 'Appointed by the local council', oy: '由地區議會任命' },
  { key: '5.22', j: 2, en: 'The Welsh local council', oy: '威爾斯地區議會' },
  { key: '11.17', j: 2, en: 'To run local councils', oy: '管理地區議會' },
  { key: '15.9', j: 0, en: 'To run local councils', oy: '管理地區議會' },
];
const FACTS = {
  197: '實際上選民登記冊由地區議會嘅選民登記主任（Electoral Registration Officer）管理',
  203: '城鎮、城市同鄉郊由民選地區議會管理，提供教育、廢物處理、房屋等服務；地區議員代表社區，同埋決定地方服務。',
};
const results = []; let fail = 0;
const ok = (c, m) => { results.push((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const info = m => results.push('info  ' + m);

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
    ok(meta.lang === lang && meta.v === '1.1.4', `${tag}: html lang = ${meta.lang}, APP_VERSION = ${meta.v}`);

    // ── Practice: before answering (Translate on) and after a wrong answer ──
    for (const c of CASES) {
      const [e, i] = c.key.split('.').map(Number);
      const label = `${tag} Practice E${e} Q${i + 1}`;
      const pos = await pg.evaluate(({ e, i, en }) => {
        pendingMode = 'practice'; startExam(e);
        state.current = state.questions.findIndex(q => q.examNum === e && q.origIdx === i);
        renderQuestion();
        return state.questions[state.current].o.indexOf(en);
      }, { e, i, en: c.en });
      ok(pos >= 0, `${label}: distractor "${c.en}" found at shuffled position ${pos}`);
      const before = await pg.evaluate(() => ({ yue: document.querySelectorAll('#optionsContainer .opt-yue').length, toggle: getComputedStyle(byId('yueToggle')).display !== 'none' }));
      ok(before.yue === 0 && before.toggle, `${label}: unanswered, Translate off → no option yue (${before.yue}), Translate button shown`);
      await pg.click('#yueToggle');
      const tr = await pg.evaluate(p => {
        const opts = [...document.querySelectorAll('#optionsContainer .opt')];
        return { pairs: opts.map(o => [o.querySelector('.opt-body > span').textContent, (o.querySelector('.opt-yue') || {}).textContent || '']), dist: opts[p].querySelector('.opt-yue').textContent, all: byId('optionsContainer').textContent + byId('qYue').textContent, qYueShown: byId('qYue').classList.contains('show') };
      }, pos);
      ok(tr.dist === c.oy, `${label}: unanswered + Translate → distractor yue = ${tr.dist}`);
      ok(!tr.all.includes(OLD) && tr.qYueShown, `${label}: unanswered + Translate → no ${OLD} in options / question yue`);
      const pairOk = await pg.evaluate(({ e, i, pairs }) => pairs.every(([o, y]) => EXAMS[e][i].oy[EXAMS[e][i].o.indexOf(o)] === y), { e, i, pairs: tr.pairs });
      ok(pairOk, `${label}: every option's yue is its own (shuffle keeps o / oy aligned)`);
      if (c.key === '5.22') await pg.screenshot({ path: `${SHOTS}/practice_${lang}_${width}_E5Q23_before.png` });
      await pg.click(`#opt${pos}`);
      const after = await pg.evaluate(p => {
        const opts = [...document.querySelectorAll('#optionsContainer .opt')];
        const note = byId('ansNote');
        return {
          cls: opts[p].className, distYue: opts[p].querySelector('.opt-yue').textContent,
          correct: opts.filter(o => o.classList.contains('correct')).map(o => o.querySelector('.opt-yue').textContent),
          opts: byId('optionsContainer').textContent, ansYue: byId('ansYue').textContent, wrongBox: byId('answerBox').classList.contains('wrong-ans'),
          noteText: note.textContent, noteTable: !!note.querySelector('table'),
          docW: document.documentElement.scrollWidth, vw: innerWidth,
        };
      }, pos);
      ok(after.cls.includes('wrong') && after.wrongBox, `${label}: picked distractor → marked wrong (${after.cls})`);
      ok(after.distYue === c.oy && !after.opts.includes(OLD), `${label}: answered wrong → distractor yue ${after.distYue}, no ${OLD} in options`);
      ok(!after.ansYue.includes(OLD) && !after.ansYue.includes(c.oy), `${label}: answer translation shows the correct answer only (${after.correct.join(' / ')})`);
      ok(after.docW <= after.vw, `${label}: no horizontal page scroll (${after.docW}/${after.vw})`);
      if (c.key === '5.22') {
        ok(after.noteTable && after.noteText.includes('記憶法（地方議會）：'), `${label}: memo 4A table + 「記憶法（地方議會）：」 heading shown with the options`);
        ok(after.correct.length === 1 && after.correct[0] === '威爾斯嘅下放議會', `${label}: correct option 威爾斯嘅下放議會 (green)`);
        // confusion check: the only option that contains the memo heading's term must be none; the distractor must not appear in the memo
        ok(!after.noteText.includes(c.oy), `${label}: memo 4A text never contains ${c.oy}`);
        info(`${label}: memo 4A says Wales = 「Senedd 威爾斯議會」; distractor 「${c.oy}」 differs by 「地區」 (column header of the table is 「地區」)`);
        await pg.evaluate(() => byId('optionsContainer').scrollIntoView());
        await pg.screenshot({ path: `${SHOTS}/practice_${lang}_${width}_E5Q23_wrong.png`, fullPage: true });
      }
    }

    // ── Results review: exam mode, pick the distractor on target questions, everything else wrong too ──
    for (const e of [4, 5, 11, 15]) {
      const targets = CASES.filter(c => c.key.startsWith(e + '.'));
      const r = await pg.evaluate(({ e, targets }) => {
        pendingMode = 'exam'; startExam(e);
        state.questions.forEach((q, k) => {
          const t = targets.find(c => q.examNum === e && q.origIdx === Number(c.key.split('.')[1]));
          state.answers[k] = [t ? q.o.indexOf(t.en) : (q.a[0] + 1) % q.o.length];
        });
        finishExam();
        return targets.map(t => {
          const i = Number(t.key.split('.')[1]);
          const k = state.questions.findIndex(q => q.examNum === e && q.origIdx === i);
          const it = byId('rv' + k);
          if (!it) return { key: t.key, missing: true };
          const note = it.querySelector('.rv-note');
          return { key: t.key, your: it.querySelector('.rv-your').textContent, yue: it.querySelector('.rv-yue').textContent, qyue: EXAMS[e][i].yue,
            outsideNote: it.textContent.replace(note ? note.textContent : '', ''), note: note ? note.textContent : '', wrong: it.classList.contains('rv-wrong') };
        });
      }, { e, targets });
      for (const x of r) {
        const c = CASES.find(c => c.key === x.key); const [ee, i] = x.key.split('.').map(Number);
        const label = `${tag} Results E${ee} Q${i + 1}`;
        ok(!x.missing, `${label}: review item found`);
        if (x.missing) continue;
        ok(x.wrong && x.your.includes(c.en), `${label}: rv-wrong, your answer = ${c.en}`);
        ok(x.yue.includes(x.qyue) && !x.outsideNote.includes(OLD), `${label}: question yue shown, no ${OLD} outside the note`);
        if (x.key === '5.22') ok(x.note.includes('記憶法（地方議會）：'), `${label}: memo 4A note shown`);
      }
      if (e === 5) {
        await pg.evaluate(() => { const it = [...document.querySelectorAll('#reviewList .review-item')].find(x => x.textContent.includes('National Assembly for Wales')); it && it.scrollIntoView(); });
        await pg.screenshot({ path: `${SHOTS}/results_${lang}_${width}_E5.png` });
      }
    }

    // ── Study: #197 / #203 yue + search ──
    const s = await pg.evaluate(({ OLD, NEW }) => {
      openStudy(); studySetTab('chapters'); studySetSearch(''); studySetChapter(5);
      const card = id => document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`);
      const out = {};
      for (const id of [197, 203]) { const c = card(id); out[id] = c ? c.querySelector('.fact-yue').textContent : null; }
      out.docW = document.documentElement.scrollWidth; out.vw = innerWidth;
      out.pageHasOld = byId('studyContent').querySelectorAll('.fact-yue').length && [...byId('studyContent').querySelectorAll('.fact-yue')].some(y => y.textContent.includes(OLD));
      studySetSearch(OLD); out.searchOld = [...document.querySelectorAll('#studyContent .fact')].map(f => f.dataset.factId);
      studySetSearch(NEW); out.searchNew = [...document.querySelectorAll('#studyContent .fact')].map(f => f.dataset.factId);
      studySetSearch(''); studySetChapter(5); const c = card(203); c && c.scrollIntoView();
      return out;
    }, { OLD, NEW });
    for (const id of [197, 203]) ok(s[id] !== null && s[id].includes(FACTS[id]) && !s[id].includes(OLD), `${tag} Study #${id} yue: ${s[id]}`);
    ok(!s.pageHasOld, `${tag} Study ch5: no fact yue contains ${OLD}`);
    ok(s.docW <= s.vw, `${tag} Study ch5: no horizontal page scroll (${s.docW}/${s.vw})`);
    ok(s.searchOld.length === 0, `${tag} Study search 「${OLD}」 → ${s.searchOld.length} facts (notes are not searched)`);
    ok(s.searchNew.includes('197') && s.searchNew.includes('203'), `${tag} Study search 「${NEW}」 → #${s.searchNew.join(', #')}`);
    await pg.screenshot({ path: `${SHOTS}/study_${lang}_${width}_203.png` });
    await pg.close();
  }
  ok(errs.length === 0, 'no page errors / console errors ' + JSON.stringify(errs));
  console.log(results.join('\n'));
  console.log(fail ? `QA114 FAIL (${fail})` : 'QA114 PASS');
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
