// Visual regression check for refactors: renders the app at a git ref and the working tree in the
// same app states and compares every rendered element's computed style (incl. ::before / ::after;
// --* custom properties are skipped since every element inherits each :root token),
// box and text. Not part of run-all.sh — run it by hand when a change must not alter the UI.
//   NODE_PATH=… CHROMIUM_PATH=… node tests/tools/visual-diff.js [git-ref=HEAD] [max-diffs-to-print=40]
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const REF = process.argv[2] || 'HEAD';
const MAX_PRINT = Number(process.argv[3] || 40);
const WIDTHS = [390, 900];
const SETTLE_MS = 400;

// deterministic runs: seeded Math.random, frozen clock, no scrolling, paused animations
const init = () => {
  let s = 12345;
  Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const T = 1700000000000; Date.now = () => T;
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = function () {};
};
const PAUSE_CSS = '*, *::before, *::after { animation-play-state: paused !important; }';

const answerAll = (pred) => `state.questions.forEach((q, i) => { state.current = i; state.answers[i] = (${pred})(i) ? [...q.a] : [q.o.findIndex((_, k) => !q.a.includes(k))]; revealAnswer(); });`;
const SCENARIOS = {
  homePracticeDiff: '',
  homePracticeChapter: "setPracticeView('chapter')",
  homePracticeExam: "setPracticeView('exam')",
  homeExam: "startMode('exam')",
  homeExamDone: "setLS('completedExams', { 2: true, 5: true }); startMode('exam')",
  infoOpen: "document.getElementById('infoBtn').click()",
  myReview: `wrongList = {}; for (let i = 0; i < 40; i++) wrongList[(1 + (i % 2)) + '.' + (i % 24)] = true;
    practiceFlags = { '1.0': true, '3.4': true }; setLS('wrongList', wrongList); setLS('practiceFlags', practiceFlags);
    streaks = { '1.0': 3, '1.1': 3, '1.2': 1 }; setLS('practiceStreak', streaks); buildExamGrid(); renderModeSelection()`,
  myReviewEmptyFlag: "wrongList = { '1.0': true }; setLS('wrongList', wrongList); renderModeSelection()",
  practiceQ: "pendingMode = 'practice'; startExam(1)",
  practiceTranslate: "pendingMode = 'practice'; startExam(1); toggleQuestionYue()",
  practiceWrong: `pendingMode = 'practice'; startExam(1);
    const i = state.questions.findIndex(q => q.note && FACT_BY_QKEY[qKey(q)] && FACT_BY_QKEY[qKey(q)].src.length > 2);
    state.current = i; renderQuestion(); const q = state.questions[i]; selectOption(q.o.findIndex((_, k) => !q.a.includes(k))); toggleFlag()`,
  practiceRight: `streaks = {}; for (let e = 1; e <= 17; e++) for (let k = 0; k < 24; k++) streaks[e + '.' + k] = [3, 1, 0][k % 3];
    pendingMode = 'practice'; startExam(2);
    for (let i = 0; i < 5; i++) { state.current = i; const q = state.questions[i]; state.answers[i] = i % 2 ? [...q.a] : [q.o.findIndex((_, k) => !q.a.includes(k))]; revealAnswer(); }
    state.current = 4; renderQuestion()`,
  practiceMulti: `pendingMode = 'practice'; startExam('all'); let i = state.questions.findIndex(q => q.a.length > 1);
    if (i < 0) { startExam(1); i = state.questions.findIndex(q => q.a.length > 1); }
    state.current = i; renderQuestion(); selectOption(state.questions[i].a[0])`,
  practiceLast: "pendingMode = 'practice'; startExam('ch2'); state.current = state.questions.length - 1; state.answers[state.current] = [...state.questions[state.current].a]; revealAnswer()",
  similarSession: `pendingMode = 'practice'; startExam(1);
    const i = state.questions.findIndex(q => FACT_BY_QKEY[qKey(q)] && FACT_BY_QKEY[qKey(q)].src.length > 2);
    state.current = i; state.answers[i] = [...state.questions[i].a]; revealAnswer(); startSimilarPractice();
    state.current = state.questions.length - 1; renderQuestion()`,
  wrongRound: "wrongList = {}; for (let e = 1; e <= 3; e++) for (let k = 0; k < 24; k++) wrongList[e + '.' + k] = true; setLS('wrongList', wrongList); startWrongReview()",
  examQ: "pendingMode = 'exam'; startExam(3); state.answers[0] = [0]; state.answers[2] = [1]; state.flags[0] = true; state.flags[1] = true; state.current = 2; renderQuestion()",
  examLast: "pendingMode = 'exam'; startExam(3); state.current = 23; renderQuestion()",
  examWarn: "pendingMode = 'exam'; startExam(3); examDeadline = Date.now() + 60000; examTick()",
  examRandom: "pendingMode = 'exam'; startExam('all')",
  examModal: "pendingMode = 'exam'; startExam(3); state.flags[1] = true; submitExam()",
  leaveModal: "pendingMode = 'exam'; startExam(3); goHome()",
  examResultFail: `pendingMode = 'exam'; startExam(4);
    state.questions.forEach((q, i) => { if (i < 15) state.answers[i] = [...q.a]; else if (i < 20) state.answers[i] = [q.o.findIndex((_, k) => !q.a.includes(k))]; });
    state.flags[3] = true; state.flags[17] = true; finishExam()`,
  examResultPass: "pendingMode = 'exam'; startExam(4); state.questions.forEach((q, i) => { if (i < 22) state.answers[i] = [...q.a]; }); finishExam()",
  examResultFilter: "pendingMode = 'exam'; startExam(4); state.questions.forEach((q, i) => { if (i < 12) state.answers[i] = [...q.a]; }); state.flags[2] = true; finishExam(); setReviewFilter('flagged')",
  timeUp: "pendingMode = 'exam'; startExam(5); examDeadline = Date.now(); examTick()",
  practiceResult: `pendingMode = 'practice'; startExam('d3'); ${answerAll('i => i % 4')} finishExam()`,
  practiceResultWrong: `wrongList = { '1.0': true, '1.1': true, '2.3': true }; setLS('wrongList', wrongList); startWrongReview(); ${answerAll('() => true')} finishExam()`,
  flaggedList: "practiceFlags = { '1.0': true, '4.7': true, '9.3': true }; setLS('practiceFlags', practiceFlags); openFlagged()",
  flaggedEmpty: 'practiceFlags = {}; openFlagged()',
  studyChapters: "openStudy(); studySetTab('chapters'); studySetChapter(3)",
  studyTimeline: "openStudy(); studySetTab('timeline')",
  studyTimelineWars: "openStudy(); studySetTab('timeline'); studyToggle('warsOnly')",
  studyGeo: "openStudy(); studySetTab('geo'); studySetNation('Scotland')",
  studyPeople: "openStudy(); studySetTab('people')",
  studySearch: "openStudy(); studySetTab('chapters'); const s = document.getElementById('studySearch'); s.value = 'castle'; s.dispatchEvent(new Event('input', { bubbles: true }))",
  studyMarks: "openStudy(); studySetTab('chapters'); studySetChapter(1); document.querySelectorAll('.fact-btn.star')[0].click(); document.querySelectorAll('.fact-btn.tick')[1].click(); studyToggle('hideMastered')",
  studyEmpty: "openStudy(); const s = document.getElementById('studySearch'); s.value = 'zzzzqqq'; s.dispatchEvent(new Event('input', { bubbles: true }))",
};

// element key: nearest id anchor + tag/index path, so inserting an element only affects its own subtree
const dump = () => {
  const skip = e => ['SCRIPT', 'STYLE', 'LINK'].includes(e.tagName);
  const keyOf = e => {
    if (e === document.body) return 'body';
    if (e.id) return '#' + e.id;
    const i = [...e.parentElement.children].filter(c => !skip(c)).indexOf(e);
    return keyOf(e.parentElement) + '/' + e.tagName.toLowerCase() + i;
  };
  const res = {};
  for (const e of [document.body, ...document.body.querySelectorAll('*')]) {
    if (skip(e) || !e.getClientRects().length) continue;
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    const st = [];
    for (let i = 0; i < cs.length; i++) if (!cs[i].startsWith('--')) st.push(cs[i] + ':' + cs.getPropertyValue(cs[i]));
    for (const pse of ['::before', '::after']) {
      const p = getComputedStyle(e, pse);
      if (p.content && p.content !== 'none' && p.content !== 'normal') for (let i = 0; i < p.length; i++) if (!p[i].startsWith('--')) st.push(pse + p[i] + ':' + p.getPropertyValue(p[i]));
    }
    res[keyOf(e)] = {
      cls: e.getAttribute('class') || '', st: st.sort().join(';'),
      box: [r.x, r.y, r.width, r.height].map(v => Math.round(v * 10) / 10).join(','),
      text: e.children.length ? '' : (e.textContent || '').trim(),
      title: e.getAttribute('title') || '', aria: e.getAttribute('aria-label') || '', disabled: !!e.disabled,
    };
  }
  // the version label legitimately differs between refs
  return { els: res, text: document.body.innerText.replace(/v\d+\.\d+/g, 'vX') };
};

async function capture(browser, dir, width, script) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(init);
  await pg.goto('file://' + path.join(dir, 'index.html'));
  await pg.addStyleTag({ content: PAUSE_CSS });
  if (script) await pg.evaluate(script);
  await pg.waitForTimeout(SETTLE_MS);
  const snap = await pg.evaluate(dump);
  await ctx.close();
  return { ...snap, errs };
}

function compare(name, a, b, report) {
  if (a.errs.length || b.errs.length) report(`${name}: page errors — base ${a.errs} / current ${b.errs}`);
  if (a.text !== b.text) report(`${name}: visible text differs`);
  // an element that only gained (or lost) an id moves key: pair it by identical style + box + text instead
  const sig = e => e.st + '|' + e.box + '|' + e.text;
  const onlyB = Object.keys(b.els).filter(k => !a.els[k]);
  for (const k of Object.keys(a.els).filter(k => !b.els[k])) {
    const j = onlyB.findIndex(kb => sig(b.els[kb]) === sig(a.els[k]));
    if (j === -1) { report(`${name} ${k}: rendered only in base`); continue; }
    onlyB.splice(j, 1);
  }
  onlyB.forEach(k => report(`${name} ${k}: rendered only in current`));
  for (const k of Object.keys(a.els)) {
    const x = a.els[k], y = b.els[k];
    if (!y) continue;
    if (x.cls.includes('app-version')) continue;
    for (const f of ['box', 'text', 'title', 'aria', 'disabled', 'st']) {
      if (x[f] === y[f]) continue;
      if (f !== 'st') { report(`${name} ${k} .${x.cls}: ${f} ${JSON.stringify(x[f])} → ${JSON.stringify(y[f])}`); continue; }
      const sa = new Set(x.st.split(';')), sb = new Set(y.st.split(';'));
      report(`${name} ${k} .${x.cls}: style ${[...sa].filter(s => !sb.has(s)).slice(0, 4).join('; ')} → ${[...sb].filter(s => !sa.has(s)).slice(0, 4).join('; ')}`);
    }
  }
}

(async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeuk-visual-'));
  execSync(`git archive ${REF} | tar -x -C "${base}"`, { cwd: ROOT, shell: '/bin/bash' });
  const browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  let diffs = 0;
  const report = line => { diffs++; if (diffs <= MAX_PRINT) console.log(line); };
  try {
    for (const width of WIDTHS) {
      for (const [name, script] of Object.entries(SCENARIOS)) {
        const a = await capture(browser, base, width, script);
        const b = await capture(browser, ROOT, width, script);
        compare(`${width}:${name}`, a, b, report);
      }
    }
  } finally {
    await browser.close();
    fs.rmSync(base, { recursive: true, force: true });
  }
  const states = WIDTHS.length * Object.keys(SCENARIOS).length;
  console.log(diffs ? `VISUAL DIFFS: ${diffs} (vs ${REF}, ${states} states)` : `VISUAL IDENTICAL (vs ${REF}, ${states} states)`);
  process.exit(diffs ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
