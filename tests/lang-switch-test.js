const { chromium } = require('playwright-core');
const path = require('path');
// v0.65 (T-007): the header language pill. It shows the target language (en → 中, zh-HK → EN), switches
// <html lang> and lifeuk.uiLang, and re-renders the current screen in place: on every screen the plan's
// state list (current question, answers, reveal, translation, flags, exam deadline, review filter, Study
// tab / chips / search text, side session) is unchanged, no key is missing, nothing is recorded twice,
// and zh-HK fits a 320px screen. A confirm modal blocks the switch; <title> stays English.
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const EN = 'en';
const ZH_HK = 'zh-HK';
const PILL = '#langBtn';
const WIDE = { width: 390, height: 844 };
const NARROW = { width: 320, height: 640 };
const TITLE = 'Life in the UK · Exam Practice';
const CJK = /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/;
// S-043: the wait clears the double tap guard window, read from config.js SCREEN_CHANGE_CLICK_GUARD_MS on the page
const GUARD_MARGIN_MS = 50;
// S-044: the ::before ring must make the hit area >= 44px; probe this far outside the visible pill
const HIT_MIN_PX = 44;
const HIT_PROBE_INSET_PX = 1;

// everything the plan's state list says a language switch must keep (Result highlight / Study flash and
// scroll position are accepted losses); localStorage minus the language key itself
const snapState = pg => pg.evaluate(() => JSON.stringify({
  screen: document.querySelector('.screen.active').id,
  pendingMode, practiceView,
  mode: state.mode, examNum: state.examNum, current: state.current, questions: state.questions.map(qKey),
  answers: state.answers, revealed: state.revealed, yueShown: state.yueShown, flags: state.flags,
  examDeadline, timerRunning: examTimerId !== null, examTimeUp, sessionReturn,
  reviewFilter, reviewItems: reviewItems.map(r => [qKey(r.q), r.userAns, r.flagged, r.isCorrect]),
  study, studySearchValue: byId('studySearch').value,
  modalOpen: isConfirmOpen(),
  storage: Object.fromEntries(Object.keys(localStorage).filter(k => k !== 'lifeuk.uiLang').sort().map(k => [k, localStorage.getItem(k)])),
}));
const langOf = pg => pg.evaluate(() => ({ lang: getLang(), html: document.documentElement.lang }));

async function main() {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: WIDE });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const warns = []; pg.on('console', m => { if (m.type() === 'warning') warns.push(m.text()); });
  const text = sel => pg.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();

  // ── the pill itself ──
  assert(await pg.$(PILL) !== null, 'header has the language pill');
  const pill = () => pg.$eval(PILL, e => ({ text: e.textContent, label: e.getAttribute('aria-label'), title: e.title, parent: e.parentElement.className, last: e === e.parentElement.lastElementChild, type: e.type }));
  let p = await pill();
  assert(p.text === '中' && p.label === 'Switch to Chinese' && p.title === 'Switch to Chinese', 'en: pill shows 中, labelled Switch to Chinese: ' + JSON.stringify(p));
  assert(p.parent === 'header-inner' && p.last && p.type === 'button', 'pill is the last child of .header-inner, type=button');
  const size = await pg.$eval(PILL, e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  assert(size.w >= 36 && size.h >= 24, 'pill is about 36 × 26px: ' + JSON.stringify(size));
  // points up to (44 − visible size) / 2 outside the pill on each side still land on it
  const hit = await pg.$eval(PILL, (e, { min, inset }) => {
    const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = Math.max(0, (min - r.width) / 2) - inset, dy = Math.max(0, (min - r.height) / 2) - inset;
    const pts = [[r.left - dx, cy], [r.right + dx, cy], [cx, r.top - dy], [cx, r.bottom + dy]];
    return pts.map(([x, y]) => document.elementFromPoint(x, y) === e);
  }, { min: HIT_MIN_PX, inset: HIT_PROBE_INSET_PX });
  assert(hit.every(Boolean), `pill hit area is >= ${HIT_MIN_PX}px each way (left, right, top, bottom): ` + JSON.stringify(hit));

  // ── one switch on the current screen: same state, no missing key, language flipped, 320px fits ──
  async function switchOn(tag, expectCjkSel) {
    const before = await snapState(pg);
    const from = (await langOf(pg)).lang;
    const to = from === EN ? ZH_HK : EN;
    warns.length = 0;
    await pg.click(PILL);
    const lang = await langOf(pg);
    assert(lang.lang === to && lang.html === to, `${tag}: switched ${from} → ${to} (<html lang="${lang.html}">)`);
    assert(warns.filter(w => w.includes('[i18n]')).length === 0, `${tag}: no [i18n] warnings: ` + warns.join(' | '));
    const after = await snapState(pg);
    assert(after === before, `${tag}: state unchanged` + (after === before ? '' : `\n  before ${before}\n  after  ${after}`));
    assert((await pg.title()) === TITLE, `${tag}: <title> stays English`);
    if (expectCjkSel) {
      const shown = await text(expectCjkSel);
      assert(CJK.test(shown) === (to === ZH_HK), `${tag}: ${expectCjkSel} re-rendered in ${to}: ${shown.slice(0, 60)}`);
    }
    if (to === ZH_HK) await checkNarrow(tag);
  }
  async function checkNarrow(tag) {
    await pg.setViewportSize(NARROW);
    const fit = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    await pg.setViewportSize(WIDE);
    assert(fit.sw <= fit.cw, `${tag}: zh-HK at 320px has no horizontal overflow (${fit.sw} <= ${fit.cw})`);
  }
  const switchTwice = async (tag, sel) => { await switchOn(tag, sel); await switchOn(tag, sel); };
  // W-014: under <html lang="zh-HK"> the English question content keeps lang="en" (screen readers pick the voice
  // by lang) and the Cantonese translation says lang="zh-HK"; specs are [selector, lang, optional]
  async function checkContentLang(tag, specs) {
    const res = await pg.evaluate(specs => specs.map(([sel, want, optional]) => {
      const els = [...document.querySelectorAll(sel)];
      const wrong = els.filter(e => { const l = e.closest('[lang]'); return l === document.documentElement || l.getAttribute('lang') !== want; });
      return { sel, want, n: els.length, wrong: wrong.length, ok: (els.length > 0 || optional) && wrong.length === 0 };
    }), specs);
    assert((await langOf(pg)).html === ZH_HK, `${tag}: checked under <html lang="zh-HK">`);
    const bad = res.filter(r => !r.ok);
    assert(bad.length === 0, `${tag}: English content lang="en", Cantonese lang="zh-HK": ` + JSON.stringify(bad));
  }
  const switchCheckBack = async (tag, sel, specs) => { await switchOn(tag, sel); await checkContentLang(tag, specs); await switchOn(tag, sel); };

  // pill label, <html lang>, storage, reload
  await switchOn('home', '#modeDesc');
  p = await pill();
  assert(p.text === 'EN' && p.label === '切換至英文' && p.title === '切換至英文', 'zh-HK: pill shows EN, labelled 切換至英文: ' + JSON.stringify(p));
  assert(await pg.evaluate(() => localStorage.getItem('lifeuk.uiLang')) === JSON.stringify(ZH_HK), 'lifeuk.uiLang = zh-HK');
  await pg.reload();
  assert((await langOf(pg)).html === ZH_HK && (await pill()).text === 'EN', 'reload: zh-HK restored, pill EN');
  assert(CJK.test(await text('#modeDesc')) && (await pg.title()) === TITLE, 'reload: zh-HK Home, English <title>');
  await switchOn('home', '#modeDesc');
  assert((await pill()).text === '中' && await pg.evaluate(() => localStorage.getItem('lifeuk.uiLang')) === JSON.stringify(EN), 'back to en: pill 中, uiLang en');

  // Home with a non-default mode and practice tab
  await pg.evaluate(() => { startMode('practice'); setPracticeView('chapter'); });
  await switchTwice('home practice › chapter', '#practiceTabs');

  // Quiz practice: translation shown before answering, flagged, answered (Similar panel open)
  await pg.evaluate(() => {
    pendingMode = 'practice'; startExam(12);
    state.current = state.questions.findIndex(q => q.origIdx === 5);
    renderQuestion(); toggleQuestionYue(); toggleFlag();
    const q = state.questions[state.current]; state.answers[state.current] = [...q.a]; revealAnswer();
  });
  assert(await pg.$eval('#similarBox', e => !e.hidden && getComputedStyle(e).display !== 'none'), 'practice: Similar panel open after the answer');
  await switchCheckBack('quiz practice (revealed, Similar, translation, flag)', '#similarBox .sqm-title b', [
    ['#qText', EN], ['#qYue', ZH_HK], ['#optionsContainer .opt-body > span:not(.opt-yue)', EN], ['#optionsContainer .opt-yue', ZH_HK, true],
    ['#ansEn', EN], ['#ansYue .ans-yue-row span', ZH_HK], ['#ansNote .ans-note-text', ZH_HK, true],
    ['#similarBox .sqm-q', EN], ['#similarBox .sqm-qy', ZH_HK], ['#similarBox .sqm-fact-en', EN], ['#similarBox .sqm-fact-yue', ZH_HK],
  ]);

  // this question has no option translations: probe an option that has one inside #optionsContainer
  const optYueLang = await pg.evaluate(() => {
    const q = Object.values(EXAMS).flat().find(x => x.oy && x.oy[0]);
    const probe = document.createElement('div');
    probe.innerHTML = optionHtml(q, 0, { showAnswer: true, revealed: true, yueOn: true });
    byId('optionsContainer').append(probe);
    const l = probe.querySelector('.opt-yue').closest('[lang]').getAttribute('lang');
    probe.remove();
    return l;
  });
  assert(optYueLang === ZH_HK, 'W-014: option translation .opt-yue is lang="zh-HK": ' + optYueLang);

  // side session from Similar ▶ Practise
  await pg.evaluate(() => startSimilarPractice());
  assert(await pg.evaluate(() => isSideSession() && state.examNum === SIMILAR_EXAM), 'side session started from Similar');
  await pg.evaluate(() => { const q = state.questions[0]; state.answers[0] = [...q.a]; revealAnswer(); });
  await switchTwice('side session (Similar ▶ Practise)', '#quizLabel');
  await pg.evaluate(() => leaveToHome());

  // Quiz exam: timer running, answers, flags, dots
  await pg.evaluate(() => {
    pendingMode = 'exam'; startExam(3);
    [0, 1, 2].forEach(i => { state.answers[i] = [...state.questions[i].a]; });
    state.flags[1] = true; state.flags[4] = true; state.current = 4; renderQuestion();
  });
  await switchTwice('quiz exam (timer, answers, flags)', '#dotsMeta');

  // timer text is rewritten at once, and the switch never runs the tick that can finish the exam
  const timer = await pg.evaluate(async () => {
    let ticks = 0;
    const realTick = examTick;
    examTick = () => { ticks++; realTick(); };
    const realTimer = LOCALES['zh-HK'].exam.timer;
    LOCALES['zh-HK'].exam.timer = 'ZZ {time}';
    clearInterval(examTimerId); // no interval tick during the check (examTimerId stays set: the timer still counts as running)
    byId('langBtn').click();
    const shown = byId('examTimer').textContent;
    LOCALES['zh-HK'].exam.timer = realTimer;
    byId('langBtn').click();
    examTick = realTick;
    examTimerId = setInterval(examTick, EXAM_TICK_MS);
    return { shown, ticks, screen: document.querySelector('.screen.active').id };
  });
  assert(/^ZZ \d\d:\d\d$/.test(timer.shown), 'exam: timer text rewritten at once in the new language: ' + timer.shown);
  assert(timer.ticks === 0 && timer.screen === 'screenQuiz', 'exam: the switch does not call examTick (time-up would submit): ' + JSON.stringify(timer));

  // a confirm modal on top: the pill does nothing (reached with Tab + Enter, the modal covers it for a pointer)
  await pg.evaluate(() => submitExam());
  assert(await pg.evaluate(() => isConfirmOpen()), 'submit modal open');
  await pg.focus(PILL);
  await pg.keyboard.press('Enter');
  assert((await langOf(pg)).lang === EN && await pg.evaluate(() => isConfirmOpen()), 'modal open: the pill does not switch the language');
  await pg.evaluate(() => closeConfirm());

  // Result with a review filter set: re-rendered, not recorded again
  await pg.evaluate(() => {
    window.recordCount = 0;
    const realRecord = recordExamResults;
    recordExamResults = () => { window.recordCount++; realRecord(); };
    finishExam(); setReviewFilter('wrong');
  });
  await switchCheckBack('result (filter Wrong)', '#resultLabel2', [
    ['#reviewList .rv-q-text', EN], ['#reviewList .rv-correct-ans', EN], ['#reviewList .rv-yue', ZH_HK], ['#reviewList .rv-note-line', ZH_HK, true],
  ]);
  assert(await pg.evaluate(() => window.recordCount) === 1, 'result: recorded once (the switch only re-renders)');
  await checkResultSub(pg);

  // Flagged list
  await pg.evaluate(() => openFlagged());
  await switchCheckBack('flagged', '#flaggedStart', [['.fi-q', EN], ['.fi-yue', ZH_HK]]);

  // Study: tab + chip + typed search
  await pg.evaluate(() => { openStudy(); studySetTab('people'); studySetGroup('writer'); });
  await pg.fill('#studySearch', 'sha');
  await switchCheckBack('study people › writers + search', '#studyChips', [['.fact-name', EN], ['.fact-en', EN], ['.fact-yue', ZH_HK]]);
  await pg.fill('#studySearch', '');
  await pg.evaluate(() => { studySetTab('geo'); studySetNation('all'); });
  await switchOn('study geography', '#studySubChips');
  const chips = await pg.$$eval('#studySubChips .chip', els => els.map(e => e.textContent.trim()));
  assert(chips.length > 1 && chips.slice(1).every(c => !/[A-Za-z]/.test(c)), 'zh-HK: nation chips are Chinese only (M2): ' + chips.join(' / '));
  await switchOn('study geography', '#studySubChips');

  // double tap guard: the pill does not change the view, so it never arms the guard; a quick second tap works
  await pg.evaluate(() => showScreen('screenHome'));
  const guard = await pg.evaluate(() => JSON.stringify(clickGuard));
  await pg.click(PILL);
  await pg.waitForTimeout(await pg.evaluate(() => SCREEN_CHANGE_CLICK_GUARD_MS) + GUARD_MARGIN_MS);
  await pg.dblclick(PILL);
  assert((await langOf(pg)).lang === ZH_HK && await pg.evaluate(() => JSON.stringify(clickGuard)) === guard, 'pill: never arms the double tap guard; a double tap switches twice');
  await pg.click(PILL);

  assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close();
}

// M4: at 320px the zh-HK pass line "…方為合格。" keeps its last words together (no one-word last line)
async function checkResultSub(pg) {
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(1); finishExam(); });
  await pg.click(PILL);
  await pg.setViewportSize(NARROW);
  const lines = await pg.evaluate(() => {
    const node = byId('resultSub').firstChild, len = node.textContent.length;
    const top = i => { const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 1); return Math.round(r.getBoundingClientRect().top); };
    return { text: node.textContent, tail: [top(len - 5), top(len - 1)] };
  });
  await pg.setViewportSize(WIDE);
  assert(lines.text.endsWith('方為合格。') && lines.tail[0] === lines.tail[1], 'zh-HK 320px: 方為合格。 stays on one line: ' + JSON.stringify(lines));
  await pg.click(PILL);
}

main().then(() => console.log('LANG-SWITCH PASS')).catch(e => { console.error(e.message); process.exit(1); });
