// v2.1.0 memory-note screens on a phone (390 × 844; mockup mockups/v2.0.0/desktop-memo.html rev 6, decision log
// .proj-docs/plans/2026-10-13_grill_desktop-memo.md):
// - pill row per question (shared with the desktop): ".tag #n" · ".tag <icon> Ch c" (lang en) · ".sqm-node" E·Q (copies
//   joined " = ", mastery colours); in the group's questions, the result's wrong questions and the single-note group
// - the result keeps the wrong questions' keys (finishMemoTest), so their pills can render
const dt = require('./desktop-helpers');
const { assert } = dt;

const COPY_SEP = ' = ';

// a titled group whose questions include one asked in several exams (its node reads "E1·Q8 = E11·Q9")
const groupWithCopies = page => page.evaluate(() =>
  memoGroups().find(g => g.body && questionGroups(g.qkeys).some(keys => keys.length > 1)).id);
const openGroup = (page, id) => page.evaluate(gid => { openStudy(); studySetTab('memo'); openMemoGroup(gid); }, id);
// the real flow: start the test, answer every question wrong, ↩ Back on the last one (finishMemoTest)
const failTest = page => page.evaluate(() => {
  startMemoTest();
  state.questions.forEach((q, i) => {
    state.answers[i] = q.o.map((_, oi) => oi).filter(oi => !q.a.includes(oi)).slice(0, q.a.length);
    state.revealed[i] = false;
  });
  state.current = state.questions.length - 1;
  runNextAction();
});

// each pill row under root: [#n, chapter text, chapter lang, node text, node classes]
const pillRows = (page, rootSel) => page.$$eval(`${rootSel} .memo-pills`, rows => rows.map(r => {
  const [num, ch] = r.querySelectorAll('.tag'), node = r.querySelector('.sqm-node');
  return { num: num && num.textContent, numLang: num && num.lang, ch: ch && ch.textContent.trim(), chLang: ch && ch.lang,
    node: node && node.textContent, nodeLang: node && node.lang };
}));

async function checkPills(page, rootSel, label, expected) {
  const rows = await pillRows(page, rootSel);
  assert(rows.length === expected.length && rows.length > 0, `${label}: one pill row per question (${rows.length} / ${expected.length})`);
  rows.forEach((r, i) => {
    const e = expected[i];
    assert(r.num === `#${i + 1}` && r.numLang === 'en', `${label} #${i + 1}: number pill "${r.num}"`);
    assert(r.ch === `${e.icon} Ch ${e.ch}` && r.chLang === 'en', `${label} #${i + 1}: chapter pill "${r.ch}" (lang ${r.chLang})`);
    assert(r.node === e.node && r.nodeLang === 'en', `${label} #${i + 1}: node pill "${r.node}" = "${e.node}"`);
  });
  return rows;
}
// what the pills of a list of key groups should read
const expectedPills = (page, groups) => page.evaluate(gs => gs.map(keys => {
  const ch = questionByKey(keys[0]).q.ch;
  return { ch, icon: CHAPTER_ICONS[ch], node: copiesNodeText(keys) };
}), groups);

async function checkPillRows(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.phone });
  const id = await groupWithCopies(page);
  await openGroup(page, id);
  // result: the wrong questions with their keys
  await failTest(page);
  const wrong = await page.evaluate(() => memoView.result.wrong);
  assert(wrong.length > 0 && wrong.every(w => Array.isArray(w.keys) && w.keys.length > 0 && typeof w.q === 'string'), 'finishMemoTest keeps each wrong question\'s keys');
  await checkPills(page, '#memoBody .memo-wrong', 'result wrong questions', await expectedPills(page, wrong.map(w => w.keys)));
  // a result without keys (an older one) still lists the question, without pills
  const old = await page.evaluate(() => {
    memoView.result = { ...memoView.result, wrong: memoView.result.wrong.map(({ q, yue }) => ({ q, yue })) };
    renderMemo();
    return { items: document.querySelectorAll('#memoBody .memo-wrong li').length, pills: document.querySelectorAll('#memoBody .memo-wrong .memo-pills').length };
  });
  assert(old.items === wrong.length && old.pills === 0, 'a wrong list without keys still renders (no pills): ' + JSON.stringify(old));
  // the single-note group
  await openGroup(page, 'single');
  const single = await page.evaluate(() => questionGroups(memoGroupById(MEMO_SINGLE_ID).qkeys));
  await checkPills(page, '#memoBody .memo-single', 'single-note group', await expectedPills(page, single));
  assert(errors.length === 0, 'pill rows: no page errors ' + errors.join(' | '));
  await page.close();
}

(async () => {
  const b = await dt.launch();
  let failed = false;
  try {
    await checkPillRows(b);
    console.log('PHONE-MEMO PASS');
  } catch (e) {
    failed = true;
    console.error(e.message);
    console.log('PHONE-MEMO FAIL');
  } finally {
    await b.close();
    if (failed) process.exitCode = 1;
  }
})();
