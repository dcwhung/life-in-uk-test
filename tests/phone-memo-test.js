// v2.2.0 memory-note screens on a phone (390 × 844; mockup mockups/v2.0.0/desktop-memo.html rev 6, decision log
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

// ① look on the phone: the hook label on its own line; the group's questions folded in a <details> under the note
// (closed; its summary = "n questions"); open, each question has its pill row; the single-note group = design C
async function checkPhoneLook(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.phone, lang: 'zh-HK' });
  const id = await groupWithCopies(page);
  await openGroup(page, id);
  const look = await page.evaluate(() => {
    const box = el => el.getBoundingClientRect();
    const hook = document.querySelector('#memoBody .memo-hook'), fold = document.querySelector('#memoBody details.memo-questions');
    const note = document.querySelector('#memoBody .memo-note');
    return { labelLine: !!hook && box(hook.querySelector('b')).bottom <= box(hook.querySelector('span')).top + 1,
      label: hook && hook.querySelector('b').textContent,
      fold: !!fold, open: fold && fold.open, summary: fold && fold.querySelector('summary').textContent.trim(),
      afterNote: !!fold && !!note && (note.compareDocumentPosition(fold) & Node.DOCUMENT_POSITION_FOLLOWING) > 0,
      listShown: fold ? fold.querySelector('ul').checkVisibility() : null }; // a closed <details> keeps a box (content-visibility)
  });
  const groups = await page.evaluate(gid => questionGroups(memoGroupById(gid).qkeys), id);
  const title = await page.evaluate(n => t('memo.questions', { n }), groups.length);
  assert(look.labelLine && look.label === '💡 記憶鈎：', `phone look: "${look.label}" on its own line, the hook under it`);
  assert(look.fold && look.open === false && look.listShown === false && look.summary === title && look.afterNote,
    `phone look: the group's questions folded under the note, closed, summary "${look.summary}" = "${title}"`);
  await page.click('#memoBody details.memo-questions > summary');
  const rows = await checkPills(page, '#memoBody .memo-questions', `phone look (${id}) questions`, await expectedPills(page, groups));
  assert(rows.some(r => r.node.includes(COPY_SEP)), `phone look (${id}): a question asked in several exams joins its copies with "${COPY_SEP}"`);
  await openGroup(page, 'single');
  const single = await page.evaluate(() => [...document.querySelectorAll('#memoBody .memo-single-item')].map(it => ({
    label: (it.querySelector('.memo-note-label') || {}).textContent, rule: getComputedStyle(it.querySelector('.memo-single-note')).borderLeftStyle,
    qWeight: getComputedStyle(it.querySelector('.memo-single-q')).fontWeight })));
  assert(single.length > 0 && single.every(it => it.label === '💡 備註：' && it.rule === 'solid' && Number(it.qWeight) >= 700),
    'phone single-note group: bold question, "💡 備註：" + the note with its gold rule: ' + JSON.stringify(single[0]));
  assert(await page.$('#memoBody .memo-questions') === null, 'phone single-note group: no group\'s questions');
  assert(errors.length === 0, 'phone look: no page errors ' + errors.join(' | '));
  await page.close();
}

// result on the phone: nothing wrong → the all-correct words + the hook (or the memory note) in the panel
async function checkPhoneResult(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.phone, lang: 'zh-HK' });
  for (const pick of ['hook', 'plain']) {
    const id = await page.evaluate(k => memoGroups().find(g => g.body && (k === 'hook' ? g.hook : !g.hook)).id, pick);
    await page.evaluate(gid => {
      Object.assign(memoView, { id: gid, step: 'result', result: { passed: true, lv: 2, prevLv: 1, correct: 5, total: 5, wrong: [] } });
      showMemo();
    }, id);
    const r = await page.evaluate(() => ({ text: (document.querySelector('#memoBody .memo-again-text') || {}).textContent,
      hook: !!document.querySelector('#memoBody .memo-hook'), note: !!document.querySelector('#memoBody .memo-note'),
      pct: !!document.querySelector('#memoBody .memo-pct') }));
    const words = pick === 'hook' ? '全部答啱 🎉 記憶鈎再睇多次：' : await page.evaluate(() => t('memo.noteAgain'));
    assert(r.pct && r.text === words && (pick === 'hook' ? r.hook : r.note), `phone result all correct (${id}): "${r.text}" + the ${pick === 'hook' ? 'hook' : 'memory note'}`);
  }
  assert(errors.length === 0, 'phone result: no page errors ' + errors.join(' | '));
  await page.close();
}

// the Study memo list on a phone: 2 columns (badge top right, bar at the foot); the due banner sticks under the header
// and the pinned tabs, and no scrolled card shows above it. EN / 中 × small / large text
const MEMO_LS = 'lifeuk.memoProgress';
const PHONE_SCROLL = 900;
const BG_SLACK = 3; // colour channels, screenshot rounding
async function checkPhoneList(b) {
  for (const lang of dt.LANGS) for (const fontSize of dt.FONT_SIZES) {
    const { page, errors, label } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.phone, lang, fontSize });
    await page.evaluate(k => {
      const today = planTodayIso();
      localStorage.setItem(k, JSON.stringify({ vote: { lv: 1, due: today }, ww2: { lv: 2, due: today }, parliament: { lv: 4, due: isoAddDays(today, 14) } }));
      openStudy(); studySetTab('memo');
    }, MEMO_LS);
    const L = await dt.memoListLayout(page);
    assert(L.columns === 2 && L.bad.length === 0 && L.unequal === 0, `${label} list: 2 columns, badge top right, bar at the foot ${L.bad.slice(0, 3).join(' | ')}`);
    const side = await dt.noHorizontalScroll(page);
    assert(side.ok, `${label} list: no sideways scroll (${side.detail})`);
    await page.evaluate(y => window.scrollTo(0, y), PHONE_SCROLL);
    await dt.nextFrame(page);
    const after = await dt.memoListLayout(page);
    // v2.2.0 merge: Study's tabs + chip rows are pinned under the header (v1.6.1 .study-top); the banner sticks right
    // under that block, whose --bg bottom margin is the gap
    const gap = await page.evaluate(() => ({ scrollY: window.scrollY, block: document.querySelector('#screenStudy .study-top').getBoundingClientRect().bottom }));
    assert(gap.scrollY > 0 && Math.abs(after.due.top - gap.block) <= 1 && gap.block > after.header.bottom,
      `${label} list: page scrolled ${gap.scrollY}px, the banner sticks under the pinned tabs (${after.due.top.toFixed(1)} / ${gap.block.toFixed(1)})`);
    // W-077: the band between the pinned block and the banner (if any) paints the same with the cards hidden. Not from the
    // header: the pinned tabs themselves can repaint (hover, focus) between the two shots. No band: the banner sits on
    // the block's --bg foot (the assert above), so no card can show between them
    const [y0, y1] = [Math.ceil(gap.block), Math.floor(after.due.top) - 1];
    if (y1 >= y0) {
      const band = await dt.bandColours(page, y0, y1);
      await page.evaluate(() => { byId('studyContent').style.visibility = 'hidden'; });
      const bare = await dt.bandColours(page, y0, y1);
      await page.evaluate(() => { byId('studyContent').style.visibility = ''; });
      const off = band.filter((px, i) => px.some((c, k) => Math.abs(c - bare[i][k]) > BG_SLACK));
      assert(off.length === 0, `${label} list: no card shows between the pinned block and the banner (${off.length} / ${band.length} pixels differ)`);
    }
    assert(errors.length === 0, `${label} list: no page errors ` + errors.join(' | '));
    await page.close();
  }
}

// phone one screen high (rev 4 / rev 5): the page never scrolls; header + steps on top; look: the hook stays put under
// the steps, one panel (note + folded questions / the single card) takes the height left and scrolls with fades in
// the page grey, "start the test" at the bottom; result: score + Lv + wrong list in the panel, Again / Next at the bottom
const BOTTOM_ROOM = 40; // the buttons sit in the screen's last 40px (main's bottom padding + rounding)
const phoneMemoState = page => page.evaluate(() => {
  const box = el => el && el.getBoundingClientRect();
  const panel = document.querySelector('#memoBody > .memo-scroll > .fit-panel'), wrap = panel && panel.parentElement;
  const btns = document.querySelector('#memoBody > .memo-start, #memoBody > .memo-actions');
  return {
    panel: panel && { scrolls: panel.scrollHeight > panel.clientHeight + 1, overflow: getComputedStyle(panel).overflowY, h: panel.clientHeight,
      up: wrap.classList.contains('can-up'), down: wrap.classList.contains('can-down'), fadeColour: getComputedStyle(wrap, '::after').backgroundImage },
    hookTop: (box(document.querySelector('#memoBody > .memo-hook')) || {}).top, btnsBottom: btns && box(btns).bottom,
    btnsTop: btns && box(btns).top, panelBottom: panel && box(panel).bottom, viewH: innerHeight,
    stepsBottom: box(byId('memoSteps')).bottom, panelTop: panel && box(panel).top,
  };
});
const scrollPanel = (page, to) => page.$eval('#memoBody > .memo-scroll > .fit-panel', (el, y) => { el.scrollTop = y === 'end' ? el.scrollHeight : y; el.dispatchEvent(new Event('scroll')); }, to);
async function checkOneScreen(page, label, what, { expectScroll }) {
  await dt.nextFrame(page);
  const side = await dt.noHorizontalScroll(page);
  assert(side.ok, `${label} ${what}: no sideways scroll (${side.detail})`);
  const still = await dt.pageNotScrolling(page);
  assert(still.ok, `${label} ${what}: one screen high, the page does not scroll (${still.detail})`);
  const a = await phoneMemoState(page);
  assert(a.panel && a.panel.h > 0 && a.panelTop >= a.stepsBottom && a.btnsTop >= a.panelBottom, `${label} ${what}: steps, then the panel, then the buttons`);
  assert(a.btnsBottom <= a.viewH && a.btnsBottom >= a.viewH - BOTTOM_ROOM, `${label} ${what}: the buttons at the bottom of the screen (${Math.round(a.btnsBottom)} / ${a.viewH})`);
  if (expectScroll) assert(a.panel.scrolls, `${label} ${what}: the long content overflows its panel (${a.panel.h}px high)`);
  if (a.panel.scrolls) {
    assert(['auto', 'scroll'].includes(a.panel.overflow) && !a.panel.up && a.panel.down, `${label} ${what}: the panel scrolls on its own, fading at the bottom`);
    await scrollPanel(page, 'end');
    const b = await phoneMemoState(page);
    assert(b.panel.up && !b.panel.down && (a.hookTop === undefined || Math.abs(b.hookTop - a.hookTop) <= 1) && (await dt.pageNotScrolling(page)).ok,
      `${label} ${what}: scrolled to its end: top fade only, the hook stays put, the page does not move`);
    await scrollPanel(page, 0);
  }
  const reach = await dt.controlsReachable(page);
  assert(reach.ok && reach.count > 0, `${label} ${what}: every control reachable (${reach.detail})`);
}
async function checkPhoneOneScreen(b) {
  for (const lang of dt.LANGS) for (const fontSize of dt.FONT_SIZES) {
    const { page, errors, label } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.phone, lang, fontSize });
    const longest = await page.evaluate(() => memoGroups().filter(g => g.body && g.hook).sort((a, b) => b.body.length - a.body.length)[0].id);
    await openGroup(page, longest);
    await checkOneScreen(page, label, `look (${longest})`, { expectScroll: true });
    await page.click('#memoBody details.memo-questions > summary');
    await scrollPanel(page, 0); // the click scrolled the summary into view
    await checkOneScreen(page, label, `look (${longest}), questions open`, { expectScroll: true });
    await openGroup(page, 'single');
    await checkOneScreen(page, label, 'look (single-note group)', { expectScroll: true });
    await page.evaluate(gid => {
      const wrong = allQuestions().slice(0, 5).map(it => ({ q: it.q.q, yue: it.q.yue || '', keys: [qKey(it)] }));
      Object.assign(memoView, { id: gid, step: 'result', result: { passed: false, lv: 1, prevLv: 2, correct: 0, total: 5, wrong } });
      showMemo();
    }, longest);
    await checkOneScreen(page, label, 'result (5 wrong)', { expectScroll: true });
    await page.evaluate(() => { Object.assign(memoView, { step: 'result', result: { none: true } }); showMemo(); });
    await checkOneScreen(page, label, 'result (nothing answered)', { expectScroll: false });
    assert(errors.length === 0, `${label} one screen: no page errors ` + errors.join(' | '));
    await page.close();
  }
}

(async () => {
  const b = await dt.launch();
  let failed = false;
  try {
    await checkPillRows(b);
    await checkPhoneLook(b);
    await checkPhoneResult(b);
    await checkPhoneList(b);
    await checkPhoneOneScreen(b);
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
