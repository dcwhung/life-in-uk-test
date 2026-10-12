const { chromium } = require('playwright-core');
const APP = 'file:///home/user/life-in-uk-test/index.html';
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  // exam mode: ON vs OFF same question (deterministic: set questions identical)
  const snap = async tr => {
    await pg.goto(APP); await pg.evaluate(t => localStorage.setItem('lifeuk.translation', JSON.stringify(t)), tr); await pg.goto(APP);
    return pg.evaluate(() => {
      pendingMode = 'exam'; startExam(3); const out = [];
      for (let i = 0; i < 3; i++) { state.current = i; renderQuestion(); const s = byId('screenQuiz');
        const visZh = [...s.querySelectorAll('[lang="zh-HK"], .yue-toggle')].filter(e => e.getClientRects().length).length;
        state.answers[i] = [0]; renderQuestion();
        out.push({ q: byId('qText').textContent, opts: [...s.querySelectorAll('.opt')].map(o => o.innerText).join('|'), visZh,
          visZhAfter: [...s.querySelectorAll('[lang="zh-HK"], .yue-toggle')].filter(e => e.getClientRects().length).length, box: byId('answerBox').getClientRects().length }); }
      return out;
    });
  };
  const on = await snap('on'), off = await snap('off');
  const qsame = on.map((o, i) => o.q === off[i].q).every(Boolean);
  console.log('exam ON', JSON.stringify(on.map(o => [o.visZh, o.visZhAfter, o.box])), 'OFF', JSON.stringify(off.map(o => [o.visZh, o.visZhAfter, o.box])), 'sameQ', qsame,
    'sameOptsText', on.map((o, i) => o.opts === off[i].opts).every(Boolean));
  // no-note across all exams
  const nn = await pg.evaluate(() => {
    let bad = 0, n = 0;
    for (let ex = 1; ex <= EXAM_COUNT; ex++) { pendingMode = 'practice'; startExam(ex);
      state.questions.forEach((q, i) => { if (q.note) return; n++; state.current = i; renderQuestion(); state.answers[i] = [...q.a]; revealAnswer();
        const d = document.querySelector('#answerBox .divider'); if (d && d.getClientRects().length) bad++; }); }
    return { n, bad, exams: EXAM_COUNT };
  });
  console.log('no-note OFF', JSON.stringify(nn));
  // shot of a no-note answer
  await pg.evaluate(() => { pendingMode = 'practice'; startExam(6); state.current = state.questions.findIndex(q => !q.note); renderQuestion(); const i = state.current, q = state.questions[i]; state.answers[i] = [...q.a]; revealAnswer(); byId('answerBox').scrollIntoView(); });
  await pg.screenshot({ path: __dirname + '/shots/14-practice-off-no-note.png' });
  // results review off: no-note rows
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(6); state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); finishExam(); });
  await pg.screenshot({ path: __dirname + '/shots/15-results-review-off.png', fullPage: true });
  // flagged + similar
  await pg.evaluate(() => { pendingMode = 'practice'; startExam(5); setPracticeFlag(qKey(state.questions[0]), true); openFlagged(); });
  await pg.screenshot({ path: __dirname + '/shots/16-flagged-off.png' });
  console.log('flagged visible fi-yue', await pg.$$eval('.fi-yue', e => e.filter(x => x.getClientRects().length).length));
  await pg.evaluate(() => { pendingMode = 'practice'; startExam(12); state.current = state.questions.findIndex(q => q.origIdx === 5); renderQuestion(); const i = state.current, q = state.questions[i]; state.answers[i] = [...q.a]; revealAnswer(); byId('similarBox').scrollIntoView(); });
  await pg.screenshot({ path: __dirname + '/shots/17-similar-off.png' });
  console.log('errs', errs);
  await b.close();
})();
