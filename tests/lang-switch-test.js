const { chromium } = require('playwright-core');
const { seedLegacyDefaults } = require('./legacy-defaults'); // v1.4.1: keep the old en + small first run
const path = require('path');
// v0.65 (T-007): switching the language (v1.2.0: ⚙ settings → EN / 中文; v0.65–v1.1 the header pill). It switches
// <html lang> and lifeuk.uiLang, and re-renders the current screen in place: on every screen the plan's
// state list (current question, answers, reveal, translation, flags, exam deadline, review filter, Study
// tab / chips / search text, side session) is unchanged, no key is missing, nothing is recorded twice,
// and zh-HK fits a 320px screen. A confirm modal blocks the switch; <title> follows the language (v1.0.5).
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const EN = 'en';
const ZH_HK = 'zh-HK';
const SETTINGS = '#settingsBtn';
const SETTINGS_POP = '#settingsPop';
const LANG_OPTION = lang => `#settingsLangRow [data-arg="${lang}"]`;
const WIDE = { width: 390, height: 844 };
const NARROW = { width: 320, height: 640 };
const TITLE = { [EN]: 'Life in the UK Test · Exam Practice', [ZH_HK]: 'Life in the UK Test · 應試練習' }; // v1.0.5: <title> follows the language
const CJK = /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/;
// S-043: the wait clears the double tap guard window, read from config.js SCREEN_CHANGE_CLICK_GUARD_MS on the page
const GUARD_MARGIN_MS = 50;
// S-044: the ::before ring must make the hit area >= 44px; probe this far outside the visible ⚙
const HIT_MIN_PX = 44;
const HIT_PROBE_INSET_PX = 1;
const COLOUR_SETTLE_MS = 300; // > the header buttons' 0.15s colour transition
// S-045: glyph probe canvas; two different hanzi drawn the same means both are tofu (no CJK font installed)
const GLYPH_PROBE_PX = 32;
const GLYPH_PROBE_CHARS = ['中', '國'];
const GLYPH_BASELINE = 0.75; // font size and baseline as a share of the canvas, so descenders stay inside
// S-066: LANG_SWITCH_NO_CJK_FONT=1 takes the no-font branch on a machine that has the font, so the skip path can be run
const FORCE_NO_CJK_FONT = process.env.LANG_SWITCH_NO_CJK_FONT === '1';
// S-057: the text common.chapterShort renders ("Ch {n}" in en and zh-HK)
const CHAPTER_SHORT_TEXT = /\bCh \d+\b/;
// S-058: the "A)" row is the last .ans-yue-row renderAnswerTranslation writes (after the title and "Q)")
const ANSWER_YUE_ROW = '#ansYue .ans-yue-row:last-child';

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
const textOf = (pg, sel) => pg.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
const settingsOf = pg => pg.$eval(SETTINGS, e => ({ label: e.getAttribute('aria-label'), title: e.title, expanded: e.getAttribute('aria-expanded'),
  parent: e.parentElement.className, last: e === e.parentElement.lastElementChild, type: e.type, icon: !!e.querySelector('svg.line-icon') }));
const popShown = pg => pg.$eval(SETTINGS_POP, e => e.getClientRects().length > 0);
const pressedLang = pg => pg.$eval('#settingsLangRow [aria-pressed="true"]', e => e.dataset.arg);
// v1.2.0: ⚙ → the other language (Q10: the choice closes the popover)
async function switchLangUi(pg) {
  await pg.click(SETTINGS);
  await pg.click('#settingsLangRow [aria-pressed="false"]');
}

// ── one switch on the current screen: same state, no missing key, language flipped, 320px fits ──
async function switchOn(pg, ctx, tag, expectCjkSel) {
  const before = await snapState(pg);
  const from = (await langOf(pg)).lang;
  const to = from === EN ? ZH_HK : EN;
  ctx.warns.length = 0;
  await switchLangUi(pg);
  const lang = await langOf(pg);
  assert(lang.lang === to && lang.html === to, `${tag}: switched ${from} → ${to} (<html lang="${lang.html}">)`);
  assert(ctx.warns.filter(w => w.includes('[i18n]')).length === 0, `${tag}: no [i18n] warnings: ` + ctx.warns.join(' | '));
  const after = await snapState(pg);
  assert(after === before, `${tag}: state unchanged` + (after === before ? '' : `\n  before ${before}\n  after  ${after}`));
  assert((await pg.title()) === TITLE[to], `${tag}: <title> in ${to}`);
  if (expectCjkSel) {
    const shown = await textOf(pg, expectCjkSel);
    assert(CJK.test(shown) === (to === ZH_HK), `${tag}: ${expectCjkSel} re-rendered in ${to}: ${shown.slice(0, 60)}`);
  }
  if (to === ZH_HK) await checkNarrow(pg, tag);
}
async function checkNarrow(pg, tag) {
  await pg.setViewportSize(NARROW);
  const fit = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  await pg.setViewportSize(WIDE);
  assert(fit.sw <= fit.cw, `${tag}: zh-HK at 320px has no horizontal overflow (${fit.sw} <= ${fit.cw})`);
}
const switchTwice = async (pg, ctx, tag, sel) => { await switchOn(pg, ctx, tag, sel); await switchOn(pg, ctx, tag, sel); };
// W-014: under <html lang="zh-HK"> the English question content keeps lang="en" (screen readers pick the voice
// by lang) and the Cantonese translation says lang="zh-HK"; specs are [selector, lang, optional].
// CUI-0014: html = EN checks the other way round (Chinese labels say lang="zh-HK" on an English page)
async function checkContentLang(pg, tag, specs, html = ZH_HK) {
  const res = await pg.evaluate(specs => specs.map(([sel, want, optional]) => {
    const els = [...document.querySelectorAll(sel)];
    const wrong = els.filter(e => { const l = e.closest('[lang]'); return l === document.documentElement || l.getAttribute('lang') !== want; });
    return { sel, want, n: els.length, wrong: wrong.length, ok: (els.length > 0 || optional) && wrong.length === 0 };
  }), specs);
  assert((await langOf(pg)).html === html, `${tag}: checked under <html lang="${html}">`);
  const bad = res.filter(r => !r.ok);
  assert(bad.length === 0, `${tag}: English content lang="en", Cantonese lang="zh-HK": ` + JSON.stringify(bad));
}
const switchCheckBack = async (pg, ctx, tag, sel, specs) => { await switchOn(pg, ctx, tag, sel); await checkContentLang(pg, tag, specs); await switchOn(pg, ctx, tag, sel); };
// CUI-0014: same, then the en-page specs once back in en
const switchCheckBoth = async (pg, ctx, tag, sel, specs, enSpecs) => { await switchCheckBack(pg, ctx, tag, sel, specs); await checkContentLang(pg, `${tag} (en)`, enSpecs, EN); };

// S-057: common.chapterShort reads "Ch {n}" in both locales (kept English on purpose), so every such text node
// under sel must sit in a lang="en" element, never only inherit <html lang>
async function checkChapterShortLang(pg, tag, sel, html) {
  const langs = await pg.evaluate(({ sel, src }) => [...document.querySelectorAll(sel)].flatMap(root => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), out = [];
    while (walker.nextNode()) {
      if (!new RegExp(src).test(walker.currentNode.textContent)) continue;
      const l = walker.currentNode.parentElement.closest('[lang]');
      out.push(l === document.documentElement ? 'html' : l.getAttribute('lang'));
    }
    return out;
  }), { sel, src: CHAPTER_SHORT_TEXT.source });
  assert((await langOf(pg)).html === html, `${tag}: checked under <html lang="${html}">`);
  assert(langs.length > 0 && langs.every(l => l === EN), `S-057 ${tag}: "Ch {n}" in ${sel} is lang="en": ` + JSON.stringify(langs));
}
// S-057: en → zh-HK → en, checking "Ch {n}" on both pages
async function switchCheckChapterShort(pg, ctx, tag, sel) {
  await switchOn(pg, ctx, tag, null);
  await checkChapterShortLang(pg, tag, sel, ZH_HK);
  await switchOn(pg, ctx, tag, null);
  await checkChapterShortLang(pg, `${tag} (en)`, sel, EN);
}

// ── ⚙ and the language row (v1.2.0, mockup font-size-switch.html M1 / Q8–Q10 / C1) ──
async function checkSettingsButton(pg) {
  assert(await pg.$('#langBtn') === null && await pg.$(SETTINGS) !== null, 'header has ⚙ instead of the language pill');
  const p = await settingsOf(pg);
  assert(p.label === 'Settings' && p.title === 'Settings' && p.expanded === 'false' && p.icon, 'en: ⚙ is an icon labelled Settings, closed: ' + JSON.stringify(p));
  assert(p.parent === 'header-inner' && p.last && p.type === 'button', '⚙ is the last child of .header-inner, type=button');
  const look = await pg.$eval(SETTINGS, e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { w: r.width, h: r.height, border: cs.borderTopWidth, bg: cs.backgroundColor }; });
  assert(look.w === 32 && look.h === 32 && look.border === '0px' && look.bg === 'rgba(0, 0, 0, 0)', 'C1: ⚙ is 32 × 32px with no ring or fill: ' + JSON.stringify(look));
  // points up to (44 − visible size) / 2 outside ⚙ on each side still land on it
  const hit = await pg.$eval(SETTINGS, (e, { min, inset }) => {
    const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = Math.max(0, (min - r.width) / 2) - inset, dy = Math.max(0, (min - r.height) / 2) - inset;
    const pts = [[r.left - dx, cy], [r.right + dx, cy], [cx, r.top - dy], [cx, r.bottom + dy]];
    return pts.map(([x, y]) => { const h = document.elementFromPoint(x, y); return !!h && (h === e || e.contains(h)); });
  }, { min: HIT_MIN_PX, inset: HIT_PROBE_INSET_PX });
  assert(hit.every(Boolean), `⚙ hit area is >= ${HIT_MIN_PX}px each way (left, right, top, bottom): ` + JSON.stringify(hit));
  await checkSettingsPopover(pg);
}
// the popover: opens under ⚙ (arrow on it), EN / 中文 with the current one pressed; choosing the current one closes it
async function checkSettingsPopover(pg) {
  await pg.click(SETTINGS);
  const open = await pg.evaluate(() => {
    const pop = byId('settingsPop'), btn = byId('settingsBtn'), b = btn.getBoundingClientRect();
    const arrow = parseFloat(getComputedStyle(pop).getPropertyValue('--info-arrow-x')) + pop.getBoundingClientRect().left;
    return { shown: pop.getClientRects().length > 0, expanded: btn.getAttribute('aria-expanded'), arrowOff: Math.abs(arrow - (b.left + b.width / 2)),
      options: [...document.querySelectorAll('#settingsLangRow [data-arg]')].map(o => [o.textContent, o.lang, o.getAttribute('aria-pressed')]) };
  });
  assert(open.shown && open.expanded === 'true' && open.arrowOff <= 1, 'Q9: ⚙ opens the settings popover with its arrow on ⚙: ' + JSON.stringify(open));
  assert(JSON.stringify(open.options) === JSON.stringify([['EN', 'en', 'true'], ['中文', 'zh-HK', 'false']]), 'Q8: language options EN / 中文, the current one pressed: ' + JSON.stringify(open.options));
  await pg.click(LANG_OPTION(EN));
  assert(!(await popShown(pg)) && (await langOf(pg)).lang === EN && (await settingsOf(pg)).expanded === 'false', 'Q10: choosing the current language closes the popover, no switch');
  // S-192: by keyboard, a choice and Esc both close the popover and hand focus back to ⚙
  const focused = () => pg.evaluate(() => document.activeElement.id);
  await pg.focus(SETTINGS);
  await pg.keyboard.press('Enter');
  await pg.focus(LANG_OPTION(EN));
  await pg.keyboard.press('Enter');
  assert(!(await popShown(pg)) && await focused() === 'settingsBtn', 'keyboard: Enter on ⚙ opens, Enter on a language closes, focus back on ⚙');
  await pg.keyboard.press('Enter');
  await pg.focus(LANG_OPTION(ZH_HK));
  await pg.keyboard.press('Escape');
  assert(!(await popShown(pg)) && await focused() === 'settingsBtn' && (await langOf(pg)).lang === EN, 'Esc closes the settings popover, focus back on ⚙, no switch');
  // user (v1.2.0): only one popover at a time, and the open one's button turns white (ⓘ and ⚙ alike); the other is
  // back to its own colour (⚙ gold, ⓘ muted white)
  const colours = () => pg.evaluate(() => ({ gear: getComputedStyle(byId('settingsBtn')).color, info: getComputedStyle(byId('infoBtn')).color,
    gold: getComputedStyle(document.documentElement).getPropertyValue('--gold-light').trim(), white: 'rgb(255, 255, 255)' }));
  const rgbOf = hex => `rgb(${hex.slice(1).match(/../g).map(h => parseInt(h, 16)).join(', ')})`;
  const settle = () => pg.waitForTimeout(COLOUR_SETTLE_MS); // the 0.15s colour transition
  await pg.mouse.move(5, 600); // no hover colour in the way
  await pg.click(SETTINGS);
  await pg.mouse.move(5, 600);
  await settle();
  let c = await colours();
  assert(c.gear === c.white && c.info !== c.white, '⚙ open: ⚙ white, ⓘ not: ' + JSON.stringify(c));
  await pg.click('#infoBtn');
  await pg.mouse.move(5, 600);
  await settle();
  c = await colours();
  assert(!(await popShown(pg)) && await pg.$eval('#infoPop', e => e.classList.contains('show')), 'only one popover at a time: ⓘ closes ⚙');
  assert(c.info === c.white && c.gear === rgbOf(c.gold), 'ⓘ open: ⓘ white, ⚙ back to gold: ' + JSON.stringify(c));
  await pg.click(SETTINGS);
  assert(await popShown(pg) && !(await pg.$eval('#infoPop', e => e.classList.contains('show'))), '⚙ closes ⓘ');
  await pg.mouse.click(5, 600);
  assert(!(await popShown(pg)), 'a click outside closes the settings popover');
}

// ⚙ label, pressed option, <html lang>, storage, reload
async function checkHomeSwitch(pg, ctx) {
  await switchOn(pg, ctx, 'home', '#modeDesc');
  const p = await settingsOf(pg);
  assert(p.label === '設定' && p.title === '設定' && !(await popShown(pg)), 'zh-HK: ⚙ labelled 設定, popover closed after the choice: ' + JSON.stringify(p));
  assert(await pressedLang(pg) === ZH_HK, 'zh-HK: 中文 pressed');
  assert(await pg.evaluate(() => localStorage.getItem('lifeuk.uiLang')) === JSON.stringify(ZH_HK), 'lifeuk.uiLang = zh-HK');
  await pg.reload();
  assert((await langOf(pg)).html === ZH_HK && (await settingsOf(pg)).label === '設定', 'reload: zh-HK restored, ⚙ 設定');
  assert(CJK.test(await textOf(pg, '#modeDesc')) && (await pg.title()) === TITLE[ZH_HK], 'reload: zh-HK Home, zh-HK <title>');
  await switchOn(pg, ctx, 'home', '#modeDesc');
  assert((await settingsOf(pg)).label === 'Settings' && await pg.evaluate(() => localStorage.getItem('lifeuk.uiLang')) === JSON.stringify(EN), 'back to en: ⚙ Settings, uiLang en');
}

// Home with a non-default mode and practice tab
async function checkHomePractice(pg, ctx) {
  await pg.evaluate(() => { startMode('practice'); setPracticeView('chapter'); });
  await switchCheckBack(pg, ctx, 'home practice › chapter', '#practiceTabs', [['#chapterGrid .ch-name', EN]]);
  await switchCheckChapterShort(pg, ctx, 'home practice › chapter', '#chapterGrid .ch-num');
  // practice › exam: the all-questions button reads 全部試題 in zh-HK, All Questions in en
  await pg.evaluate(() => setPracticeView('exam'));
  await switchOn(pg, ctx, 'home practice › exam', '#examGrid');
  assert((await textOf(pg, '#examGrid .exam-btn.all')).startsWith('📝 全部試題（408 題）'), 'zh-HK: practice grid shows 全部試題（408 題）');
  await switchOn(pg, ctx, 'home practice › exam', '#examGrid');
  assert((await textOf(pg, '#examGrid .exam-btn.all')).startsWith('📝 All Questions (408)'), 'en: practice grid shows All Questions (408)');
}

// Quiz practice: translation shown before answering, flagged, answered (Similar panel open)
async function checkQuizPractice(pg, ctx) {
  await pg.evaluate(() => {
    pendingMode = 'practice'; startExam(12);
    state.current = state.questions.findIndex(q => q.origIdx === 5);
    renderQuestion(); toggleQuestionYue(); toggleFlag();
    const q = state.questions[state.current]; state.answers[state.current] = [...q.a]; revealAnswer();
  });
  assert(await pg.$eval('#similarBox', e => !e.hidden && getComputedStyle(e).display !== 'none'), 'practice: Similar panel open after the answer');
  await switchCheckBoth(pg, ctx, 'quiz practice (revealed, Similar, translation, flag)', '#similarBox .sqm-title b', [
    ['#qText', EN], ['#qYue', ZH_HK], ['#optionsContainer .opt-body > span:not(.opt-yue)', EN], ['#optionsContainer .opt-yue', ZH_HK, true],
    ['#ansEn', EN], ['#ansYue .ans-yue-row > span', ZH_HK], ['#ansNote .ans-note-text', ZH_HK, true],
    ['#similarBox .sqm-q', EN], ['#similarBox .sqm-qy', ZH_HK], ['#similarBox .sqm-fact-en', EN], ['#similarBox .sqm-fact-yue', ZH_HK],
    ['#ansNote > strong', ZH_HK], // S-048: the 💡 label reads with the note
  ], [['#ansNote > strong', ZH_HK], ['#ansNote .ans-note-text', ZH_HK]]);
}

// S-048: an answer with no Cantonese option text (True / False / years) falls back to English, marked lang="en"
async function checkAnswerFallback(pg) {
  const ansFallback = await pg.evaluate(rowSel => {
    const all = Object.values(EXAMS).flat();
    // the lang each piece of answer text is read in (its text nodes' nearest lang)
    const langOfAnswer = q => {
      renderAnswerTranslation(q);
      const row = document.querySelector(rowSel);
      const walker = document.createTreeWalker(row.lastElementChild, NodeFilter.SHOW_TEXT);
      const langs = new Set();
      while (walker.nextNode()) if (walker.currentNode.textContent.trim()) langs.add(walker.currentNode.parentElement.closest('[lang]').getAttribute('lang'));
      return [...langs].join();
    };
    const res = { noOy: langOfAnswer(all.find(q => q.a.every(ai => !(q.oy && q.oy[ai])))), withOy: langOfAnswer(all.find(q => q.oy && q.a.every(ai => q.oy[ai]))) };
    renderAnswerTranslation(state.questions[state.current]);
    return res;
  }, ANSWER_YUE_ROW);
  assert(ansFallback.noOy === EN && ansFallback.withOy === ZH_HK, 'S-048: answer translation fallback is lang="en", a real translation lang="zh-HK": ' + JSON.stringify(ansFallback));
}

// this question has no option translations: probe an option that has one inside #optionsContainer
async function checkOptionYueLang(pg) {
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
}

// side session from Similar ▶ Practise
async function checkSideSession(pg, ctx) {
  await pg.evaluate(() => startSimilarPractice());
  assert(await pg.evaluate(() => isSideSession() && state.examNum === SIMILAR_EXAM), 'side session started from Similar');
  await pg.evaluate(() => { const q = state.questions[0]; state.answers[0] = [...q.a]; revealAnswer(); });
  await switchTwice(pg, ctx, 'side session (Similar ▶ Practise)', '#quizLabel');
  await pg.evaluate(() => leaveToHome());
}

// Quiz exam: timer running, answers, flags, dots
async function checkQuizExam(pg, ctx) {
  await pg.evaluate(() => {
    pendingMode = 'exam'; startExam(3);
    [0, 1, 2].forEach(i => { state.answers[i] = [...state.questions[i].a]; });
    // CUI-0014: question 4 answered wrong, so Result has a "Your answer: <option>" line
    state.answers[3] = [state.questions[3].o.findIndex((o, oi) => !state.questions[3].a.includes(oi))];
    state.flags[1] = true; state.flags[4] = true; state.current = 4; renderQuestion();
  });
  await switchTwice(pg, ctx, 'quiz exam (timer, answers, flags)', '#dotsMeta');
}

// timer text is rewritten at once, and the switch never runs the tick that can finish the exam
async function checkExamTimer(pg) {
  const timer = await pg.evaluate(async () => {
    let ticks = 0;
    const realTick = examTick;
    examTick = () => { ticks++; realTick(); };
    const realTimer = LOCALES['zh-HK'].exam.timer;
    LOCALES['zh-HK'].exam.timer = 'ZZ {time}';
    clearInterval(examTimerId); // no interval tick during the check (examTimerId stays set: the timer still counts as running)
    const other = () => { byId('settingsBtn').click(); document.querySelector('#settingsLangRow [aria-pressed="false"]').click(); };
    other();
    const shown = byId('examTimer').textContent;
    LOCALES['zh-HK'].exam.timer = realTimer;
    other();
    examTick = realTick;
    examTimerId = setInterval(examTick, EXAM_TICK_MS);
    return { shown, ticks, screen: document.querySelector('.screen.active').id };
  });
  assert(/^ZZ \d\d:\d\d$/.test(timer.shown), 'exam: timer text rewritten at once in the new language: ' + timer.shown);
  assert(timer.ticks === 0 && timer.screen === 'screenQuiz', 'exam: the switch does not call examTick (time-up would submit): ' + JSON.stringify(timer));
}

// a confirm modal on top: the language option does nothing (R-002 backstop; the modal covers ⚙ for a pointer)
async function checkModal(pg) {
  await pg.evaluate(() => submitExam());
  assert(await pg.evaluate(() => isConfirmOpen()), 'submit modal open');
  await pg.evaluate(sel => document.querySelector(sel).click(), LANG_OPTION(ZH_HK));
  assert((await langOf(pg)).lang === EN && await pg.evaluate(() => isConfirmOpen()), 'modal open: the language option does not switch the language');
  await pg.evaluate(() => closeConfirm());
}

// Result with a review filter set: re-rendered, not recorded again
async function checkResult(pg, ctx) {
  await pg.evaluate(() => {
    window.recordCount = 0;
    const realRecord = recordExamResults;
    recordExamResults = () => { window.recordCount++; realRecord(); };
    finishExam(); setReviewFilter('wrong');
  });
  await switchCheckBoth(pg, ctx, 'result (filter Wrong)', '#resultLabel2', [
    ['#reviewList .rv-q-text', EN], ['#reviewList .rv-correct-ans', EN], ['#reviewList .rv-yue', ZH_HK], ['#reviewList .rv-note-line', ZH_HK, true],
    ['#reviewList .rv-your > span', EN], // S-047: the chosen option, not the 你的答案： label
  ], [['#reviewList .rv-note-label', ZH_HK]]);
  // S-047: the label and 未作答 stay in the page language (no lang="en" around them)
  const yourLines = await pg.evaluate(() => [...document.querySelectorAll('#reviewList .rv-your')].map(e => ({ n: e.querySelectorAll('[lang]').length, label: e.firstChild.nodeType === Node.TEXT_NODE })));
  assert(yourLines.filter(l => l.n === 1).length === 1 && yourLines.every(l => l.n <= 1 && l.label), 'S-047: one answered wrong line with a lang="en" answer, labels unmarked: ' + JSON.stringify(yourLines));
  assert(await pg.evaluate(() => window.recordCount) === 1, 'result: recorded once (the switch only re-renders)');
  // S-045: M4 measures hanzi line breaks; with tofu glyphs the widths say nothing about the real layout
  if (ctx.hasCjkFont) await checkResultSub(pg);
  else console.log('skip: no CJK font (M4 checkResultSub)');
}

// Flagged list
async function checkFlagged(pg, ctx) {
  await pg.evaluate(() => openFlagged());
  await switchCheckBack(pg, ctx, 'flagged', '#flaggedStart', [['.fi-q', EN], ['.fi-yue', ZH_HK]]);
}

// study plan goal screen (PR3): the draft and the inputs
// survive a switch, the slider ticks / feasibility text re-render
async function checkPlanGoal(pg, ctx) {
  await pg.evaluate(() => openPlanGoal());
  await pg.click('#planDaysChips .chip >> nth=2');
  await pg.click('#planRestChips .chip >> nth=6');
  const draft = () => pg.evaluate(() => JSON.stringify(planGoalDraft));
  const before = await draft();
  await switchTwice(pg, ctx, 'plan goal', '#planFeasMsg');
  assert(await draft() === before, 'plan goal: the draft goal is unchanged by the switches: ' + before);
  await switchLangUi(pg);
  assert((await textOf(pg, '#planMinsTicks')).includes('小時') && (await textOf(pg, '#planRestChips')).includes('六'), 'plan goal zh-HK: ticks and weekday chips re-rendered');
  await switchLangUi(pg);
  await pg.evaluate(() => leaveToHome());
}

// study plan schedule (PR4): seeded plan begun 10 days ago, list scrolled; the plan, its log and the scroll survive.
// Its own page (fresh storage) with a fixed clock: the plan is built from "today", and the real clock could cross
// midnight mid-check
const PLAN_SCHEDULE_NOW = new Date('2026-10-08T09:00:00');
async function checkPlanSchedule(pg, ctx) {
  const sp = await pg.context().browser().newPage({ viewport: WIDE });
  sp.on('pageerror', e => ctx.errs.push(e.message));
  sp.on('console', m => { if (m.type() === 'warning') ctx.warns.push(m.text()); });
  await sp.clock.setFixedTime(PLAN_SCHEDULE_NOW);
  await sp.goto(APP_URL);
  await sp.evaluate(() => {
    writeStudyPlan(buildPlan({ examDate: '2026-10-19', dailyMins: 90, restDays: [0], level: 'some' }, '2026-09-28'));
    openPlanSchedule();
    byId('planDayList').scrollTo({ top: 120, behavior: 'instant' });
  });
  const scroll = () => sp.evaluate(() => byId('planDayList').scrollTop);
  await switchOn(sp, ctx, 'plan schedule', '#planSummary');
  assert(await scroll() === 120, 'plan schedule zh-HK: the day list keeps its scroll position');
  assert((await textOf(sp, '#planDayList .plan-day.today .plan-pill')).startsWith('今日') && (await textOf(sp, '#planStrategy')).includes('模擬考試'),
    'plan schedule zh-HK: pills and strategy re-rendered');
  await switchOn(sp, ctx, 'plan schedule', '#planSummary');
  assert(await scroll() === 120 && (await textOf(sp, '#planDayList .plan-day.today .plan-pill')).startsWith('Today'), 'plan schedule back in en: scroll kept, pills in en');
  await sp.evaluate(() => clearStudyPlan());
  await sp.close();
}

// PR5 day screen: a past day, its calendar month moved, in place; the shown day / month / storage stay the same
async function checkPlanDay(pg, ctx) {
  const sp = await pg.context().browser().newPage({ viewport: WIDE });
  sp.on('pageerror', e => ctx.errs.push(e.message));
  sp.on('console', m => { if (m.type() === 'warning') ctx.warns.push(m.text()); });
  await sp.clock.setFixedTime(PLAN_SCHEDULE_NOW);
  await sp.goto(APP_URL);
  await sp.evaluate(() => {
    writeStudyPlan(buildPlan({ examDate: '2026-10-19', dailyMins: 90, restDays: [0], level: 'some' }, '2026-09-28'));
    openPlanDay('2026-09-30');
    planShiftMonth(1);
  });
  const look = () => sp.evaluate(() => ({ title: byId('planDayTitle').textContent, cal: byId('planCalTitle').textContent,
    task: document.querySelector('#planTaskList .plan-task-st').textContent,
    store: JSON.stringify(Object.keys(localStorage).filter(k => k !== UI_LANG_LS).sort().map(k => [k, localStorage.getItem(k)])) }));
  const en = await look();
  await switchOn(sp, ctx, 'plan day', '#planDayHint');
  const zh = await look();
  assert(zh.title === 'Day 3 任務' && zh.cal === '2026 年 10 月' && /條知識點|題/.test(zh.task), 'plan day zh-HK: same day + month, re-rendered: ' + zh.title + ' | ' + zh.cal);
  await switchOn(sp, ctx, 'plan day', '#planDayHint');
  const back = await look();
  assert(back.title === en.title && back.cal === 'October 2026' && back.task === en.task, 'plan day back in en: same day, month and text');
  assert(back.store === en.store && zh.store === en.store, 'plan day: switching language writes nothing but the language');
  await sp.evaluate(() => clearStudyPlan());
  await sp.close();
}

// PR6a runner: a past day's practice task on the Practice screen (one answer wrong), then its Result card; the
// session (sessionReturn: day, task, round), the answers and storage stay; header / notes / buttons re-render
async function checkPlanRun(pg, ctx) {
  const sp = await pg.context().browser().newPage({ viewport: WIDE });
  sp.on('pageerror', e => ctx.errs.push(e.message));
  sp.on('console', m => { if (m.type() === 'warning') ctx.warns.push(m.text()); });
  await sp.clock.setFixedTime(PLAN_SCHEDULE_NOW);
  await sp.goto(APP_URL);
  const i = await sp.evaluate(() => {
    writeStudyPlan(buildPlan({ examDate: '2026-10-19', dailyMins: 90, restDays: [0], level: 'some' }, '2026-09-28'));
    const k = planLoad().days[2].tasks.findIndex(t => t.type === 'practice');
    planOpenTask('2026-09-30', k, '2026-09-30');
    const q = state.questions[0];
    selectOption(q.o.findIndex((_, o) => !q.a.includes(o)));
    if (!(0 in state.revealed)) selectOption(q.o.findIndex((_, o) => !q.a.includes(o) && !state.answers[0].includes(o)));
    return k;
  });
  await switchOn(sp, ctx, 'plan runner', '#screenQuiz .back-btn');
  assert(await textOf(sp, '#screenQuiz .back-btn') === '← Day 3 任務' && await textOf(sp, '#ansLabel') === '✗ 錯誤 · 🔥 0/3', 'plan runner zh-HK: ← Day 3 任務, answer box re-rendered');
  await switchOn(sp, ctx, 'plan runner', '#screenQuiz .back-btn');
  await sp.evaluate(k => planShowTaskDone('2026-09-30', k, '2026-09-30'), i);
  await switchOn(sp, ctx, 'plan Result card', '#planRunBody .result-label');
  assert((await textOf(sp, '#planRunBody .nav-row')).includes('重溫此項內容'), 'plan Result card zh-HK: buttons re-rendered');
  await switchOn(sp, ctx, 'plan Result card', '#planRunBody .result-label');
  await sp.close();
}

// Study: tab + chip + typed search, then chapters / timeline / geography
async function checkStudy(pg, ctx) {
  await pg.evaluate(() => { openStudy(); studySetTab('people'); studySetGroup('writer'); });
  await pg.fill('#studySearch', 'sha');
  await switchCheckBack(pg, ctx, 'study people › writers + search', '#studyChips', [['.fact-name', EN], ['.fact-en', EN], ['.fact-yue', ZH_HK]]);
  await switchCheckChapterShort(pg, ctx, 'study people › fact chapter tag', '#studyContent .fact-meta');
  await pg.fill('#studySearch', '');
  // S-049 + CUI-0014: chapter titles, year / person tags and timeline years are English data
  await pg.evaluate(() => { studySetTab('chapters'); studySetChapter(3); });
  await switchCheckBack(pg, ctx, 'study chapters › 3', '#studyTabs', [['#studyContent .study-group-title', EN], ['#studyContent .tag.year', EN], ['#studyContent .tag.person', EN]]);
  await switchCheckChapterShort(pg, ctx, 'study chapters › chapter chips', '#studySubChips');
  await pg.evaluate(() => studySetTab('timeline'));
  await switchCheckBack(pg, ctx, 'study timeline', '#studyTabs', [['#studyContent .tl-year', EN], ['#studyContent .tag.person', EN]]);
  await pg.evaluate(() => { studySetTab('geo'); studySetNation('all'); });
  await switchOn(pg, ctx, 'study geography', '#studySubChips');
  const chips = await pg.$$eval('#studySubChips .chip', els => els.map(e => e.textContent.trim()));
  assert(chips.length > 1 && chips.slice(1).every(c => !/[A-Za-z]/.test(c)), 'zh-HK: nation chips are Chinese only (M2): ' + chips.join(' / '));
  await switchOn(pg, ctx, 'study geography', '#studySubChips');
}

// double tap guard: ⚙ and the language options do not change the view, so they never arm the guard; switching back at
// once works
async function checkDoubleTap(pg) {
  await pg.evaluate(() => showScreen('screenHome'));
  const guard = await pg.evaluate(() => JSON.stringify(clickGuard));
  await switchLangUi(pg);
  await switchLangUi(pg);
  assert((await langOf(pg)).lang === EN && await pg.evaluate(() => JSON.stringify(clickGuard)) === guard, '⚙ language: never arms the double tap guard; an immediate switch back works');
}

// 2026-10-07: My Review tiles. The wrong answers note lives inside #tileWrong, the flagged tile drops its count
// line; the pill re-renders it. v0.70: the wrong tile drops its "{n} to clear" line too (the big count says it), and
// at 0 it shows only "Nothing to review yet" (no note)
const MY_REVIEW_NOTE = {
  [EN]: 'From Practice and Exam; cleared once you get them right here. Up to 24 per round.',
  [ZH_HK]: '來自練習及模擬考試，於此答對後便會清除。每輪最多 24 題。',
};
const WRONG_EMPTY = { [EN]: 'Nothing to review yet', [ZH_HK]: '暫時未有需要複習的題目' };
const FLAGGED_8 = { [EN]: '8 flagged', [ZH_HK]: '已標記 8 題' };
// flaggedEmptyHtml with its inline bookmark svg (no text) collapsed out
const FLAGGED_EMPTY = { [EN]: 'Tap on a question to flag it', [ZH_HK]: '於題目按 即可標記' };
const MY_REVIEW_WRONG_N = 30;
const MY_REVIEW_FLAG_N = 8;
const EXAM_SIZE = 24; // keys are "exam.q"; only the count matters to the tiles
const seedMyReview = (pg, wrongN, flagN) => pg.evaluate(([w, f, size]) => {
  const keys = n => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${1 + Math.floor(i / size)}.${(i % size) + 1}`, true]));
  wrongList = keys(w); practiceFlags = keys(f);
  localStorage.setItem('lifeuk.wrongList', JSON.stringify(wrongList));
  localStorage.setItem('lifeuk.practiceFlags', JSON.stringify(practiceFlags));
  leaveToHome(); startMode('practice');
}, [wrongN, flagN, EXAM_SIZE]);
const myReviewView = pg => pg.evaluate(() => {
  const squash = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
  const tile = id => {
    const el = byId(id), sub = el.querySelector('.sub'), note = el.querySelector('.t-note');
    return {
      text: squash(el), sub: squash(sub), note: squash(note),
      subVisible: !!sub && sub.getBoundingClientRect().height > 0,
      height: Math.round(el.getBoundingClientRect().height),
    };
  };
  const outside = [...byId('myReview').querySelectorAll('.t-note, .my-note, #myReviewNote')].filter(e => !e.closest('.my-tile'));
  const stacked = byId('tileFlagged').getBoundingClientRect().top >= byId('tileWrong').getBoundingClientRect().bottom;
  return { wrong: tile('tileWrong'), flagged: tile('tileFlagged'), outside: outside.map(squash), stacked };
});
async function checkMyReviewIn(pg, lang, tag) {
  assert((await langOf(pg)).lang === lang, `${tag}: page in ${lang}`);
  const v = await myReviewView(pg);
  assert(v.wrong.note === MY_REVIEW_NOTE[lang], `${tag}: note inside #tileWrong reads the ${lang} text: ${v.wrong.note}`);
  assert(v.outside.length === 0, `${tag}: no note outside the tiles: ` + JSON.stringify(v.outside));
  assert(v.wrong.sub === null, `${tag}: 30 wrong → no "to clear" line under the title (v0.70): ${v.wrong.sub}`);
  assert(!v.flagged.text.includes(FLAGGED_8[lang]) && !v.flagged.subVisible, `${tag}: 8 flagged → no "${FLAGGED_8[lang]}", no visible .sub: ${v.flagged.text}`);
  // side by side the tiles match heights; stacked each keeps its own
  assert(v.stacked || v.wrong.height === v.flagged.height, `${tag}: side-by-side tiles are the same height (${v.wrong.height} / ${v.flagged.height})`);
}
async function checkMyReviewEmptyIn(pg, lang, tag) {
  assert((await langOf(pg)).lang === lang, `${tag}: page in ${lang}`);
  const v = await myReviewView(pg);
  // v0.70: no note at 0, only "Nothing to review yet"
  assert(v.wrong.note === null && v.wrong.sub === WRONG_EMPTY[lang], `${tag}: 0 wrong → "${WRONG_EMPTY[lang]}", no note: ${JSON.stringify(v.wrong)}`);
  assert(v.outside.length === 0, `${tag}: 0 wrong → no note outside the tiles: ` + JSON.stringify(v.outside));
  assert(v.stacked || v.wrong.height === v.flagged.height, `${tag}: 0 wrong → side-by-side tiles the same height (${v.wrong.height} / ${v.flagged.height})`);
  // W-022: the empty tile fades its own parts (opacity multiplies down the tree)
  const fade = await effectiveOpacities(pg, '#tileWrong', ['.t-icon', '.t-num', 'b', '.sub']);
  assert(Object.values(fade).every(o => o < 1), `${tag}: 0 wrong → icon, count, title, sub fade: ` + JSON.stringify(fade));
}
// product of an element's own opacity and every ancestor's, i.e. how faded it actually renders
const effectiveOpacities = (pg, root, sels) => pg.$eval(root, (r, list) => Object.fromEntries(list.map(sel => {
  let o = 1;
  for (let n = r.querySelector(sel); n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
  return [sel, o];
})), sels);
// S-084: the zh-HK note must not wrap "24" away from its "題。" (text-wrap: pretty keeps the last line from being that short)
const NOTE_TAIL = { [ZH_HK]: { count: '24', end: '題。' } };
async function checkNoteTailIn(pg, lang, tag) {
  const { count, end } = NOTE_TAIL[lang];
  const tops = await pg.$eval('#tileWrong .t-note', (e, [c, z]) => {
    const node = [...e.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.data.includes(c + ' ' + z));
    if (!node) return null;
    const at = i => { const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 1); return Math.round(r.getBoundingClientRect().top); };
    const i = node.data.lastIndexOf(c), j = node.data.lastIndexOf(z);
    return { count: at(i), end: at(j + z.length - 1), wrap: getComputedStyle(e).textWrap || getComputedStyle(e).textWrapStyle };
  }, [count, end]);
  assert(tops && tops.count === tops.end, `${tag}: "${count}" and "${end}" stay on one line: ` + JSON.stringify(tops));
}
// S-082: the same tile checks at 320px, plus no horizontal overflow on the page or inside either tile
async function checkMyReviewNarrow(pg, check, lang, tag) {
  await pg.setViewportSize(NARROW);
  try {
    await check(pg, lang, tag);
    const fit = await pg.evaluate(() => {
      const box = e => ({ sw: e.scrollWidth, cw: e.clientWidth });
      return { page: box(document.documentElement), wrong: box(byId('tileWrong')), flagged: box(byId('tileFlagged')) };
    });
    assert(Object.values(fit).every(b => b.sw <= b.cw), `${tag}: no horizontal overflow at 320px: ` + JSON.stringify(fit));
  } finally {
    await pg.setViewportSize(WIDE);
  }
}
// v1.3.1 (user; replaces v1.0.3's portrait / landscape rule): side by side while each tile's title fits on one line and
// the wrong tile's note on two (MY_REVIEW_NOTE_LINES), else stacked, each the grid's full width; orientation plays no
// part (768×1024 portrait sits side by side). 30 wrong + 8 flagged: the wrong tile shows its note
const MY_REVIEW_STACKED = [{ width: 320, height: 640 }];
const MY_REVIEW_SIDE = [{ width: 768, height: 1024 }, { width: 844, height: 390 }, { width: 1024, height: 768 }];
const MY_REVIEW_NOTE_MAX_LINES = 2;
// C-004: 0 flagged puts the empty line with its inline bookmark svg in the flagged tile; it still fits on one line
const MY_REVIEW_FIT_SEEDS = [[MY_REVIEW_WRONG_N, MY_REVIEW_FLAG_N], [MY_REVIEW_WRONG_N, 0]];
const MY_REVIEW_TOLERANCE_PX = 1;
// both My Review lists emptied (storage and memory), back on Home
const clearMyReview = pg => pg.evaluate(() => {
  localStorage.removeItem('lifeuk.wrongList'); localStorage.removeItem('lifeuk.practiceFlags');
  wrongList = {}; practiceFlags = {}; leaveToHome();
});
// lines each named text runs to in the current layout, and in the side-by-side one (.is-stacked off for the measure).
// S-202: counted apart from the app's Range rects (its height against a nowrap copy of itself), so a rect quirk in
// fitRow.js cannot hide here too
const myReviewLines = pg => pg.evaluate(() => {
  const grid = document.querySelector('#myReview .my-grid');
  const lines = el => { const h = el.getBoundingClientRect().height, ws = el.style.whiteSpace; el.style.whiteSpace = 'nowrap'; const one = el.getBoundingClientRect().height; el.style.whiteSpace = ws; return Math.max(1, Math.round(h / one)); };
  const note = grid.querySelector('.t-note'), subs = [...grid.querySelectorAll('.my-tile .sub')];
  const measure = () => ({ title: Math.max(...[...grid.querySelectorAll('.my-tile b'), ...subs].map(lines)), note: note ? lines(note) : 0 });
  const stacked = grid.classList.contains('is-stacked');
  grid.classList.remove('is-stacked');
  const side = measure();
  grid.classList.toggle('is-stacked', stacked);
  return { stacked, side };
});
const nextFrame = pg => pg.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
async function checkMyReviewFit(pg) {
  for (const [wrongN, flagN] of MY_REVIEW_FIT_SEEDS) await checkMyReviewFitWith(pg, wrongN, flagN);
}
async function checkMyReviewFitWith(pg, wrongN, flagN) {
  await seedMyReview(pg, wrongN, flagN);
  const layout = () => pg.evaluate(() => {
    const r = id => byId(id).getBoundingClientRect(), grid = document.querySelector('#myReview .my-grid').getBoundingClientRect();
    const w = r('tileWrong'), f = r('tileFlagged');
    return { grid: Math.round(grid.width), w: [Math.round(w.left), Math.round(w.width), Math.round(w.bottom)], f: [Math.round(f.left), Math.round(f.width), Math.round(f.top)], sameTop: Math.round(w.top) === Math.round(f.top) };
  });
  const tol = MY_REVIEW_TOLERANCE_PX, maxNote = MY_REVIEW_NOTE_MAX_LINES;
  for (const lang of [EN, ZH_HK]) {
    await pg.evaluate(l => { setLang(l); leaveToHome(); startMode('practice'); }, lang);
    for (const vp of MY_REVIEW_STACKED) {
      await pg.setViewportSize(vp); await nextFrame(pg);
      const l = await layout(), m = await myReviewLines(pg);
      assert(l.f[2] >= l.w[2] && Math.abs(l.w[1] - l.grid) <= tol && Math.abs(l.f[1] - l.grid) <= tol,
        `My Review ${wrongN}/${flagN} ${lang} ${vp.width}×${vp.height}: tiles stacked, each the grid's full width: ` + JSON.stringify(l));
      assert(m.side.title > 1 || m.side.note > maxNote, `My Review ${wrongN}/${flagN} ${lang} ${vp.width}px: stacked only because side by side a title or empty line or the note would wrap too far: ` + JSON.stringify(m));
    }
    for (const vp of MY_REVIEW_SIDE) {
      await pg.setViewportSize(vp); await nextFrame(pg);
      const l = await layout(), m = await myReviewLines(pg);
      assert(l.sameTop && l.f[0] > l.w[0] && Math.abs(l.w[1] - l.f[1]) <= tol && l.w[1] < l.grid / 2,
        `My Review ${wrongN}/${flagN} ${lang} ${vp.width}×${vp.height}: tiles side by side, equal widths: ` + JSON.stringify(l));
      assert(m.side.title === 1 && m.side.note <= maxNote, `My Review ${wrongN}/${flagN} ${lang} ${vp.width}px: titles and empty lines on one line, the note on at most ${maxNote}: ` + JSON.stringify(m));
      const v = await myReviewView(pg);
      assert(v.wrong.height === v.flagged.height, `My Review ${lang} ${vp.width}×${vp.height} side by side: same height`);
    }
  }
  await pg.setViewportSize(WIDE);
  await pg.evaluate(() => setLang('en'));
  await clearMyReview(pg);
}
async function checkMyReviewTiles(pg) {
  await pg.evaluate(lang => setLang(lang), EN);
  await seedMyReview(pg, MY_REVIEW_WRONG_N, MY_REVIEW_FLAG_N);
  await checkMyReviewIn(pg, EN, 'My Review en');
  await checkMyReviewNarrow(pg, checkMyReviewIn, EN, 'My Review en 320px');
  await switchLangUi(pg);
  await checkMyReviewIn(pg, ZH_HK, 'My Review pill → zh-HK');
  await checkMyReviewNarrow(pg, checkMyReviewIn, ZH_HK, 'My Review zh-HK 320px');
  await checkNoteTailIn(pg, ZH_HK, 'My Review zh-HK 390px note');
  await pg.setViewportSize(NARROW);
  await checkNoteTailIn(pg, ZH_HK, 'My Review zh-HK 320px note');
  await pg.setViewportSize(WIDE);
  await seedMyReview(pg, MY_REVIEW_WRONG_N, 0);
  assert((await textOf(pg, '#tileFlagged .sub')) === FLAGGED_EMPTY[ZH_HK], 'My Review zh-HK: 0 flagged keeps flaggedEmptyHtml');
  await seedMyReview(pg, 0, MY_REVIEW_FLAG_N);
  await checkMyReviewEmptyIn(pg, ZH_HK, 'My Review zh-HK');
  await checkMyReviewNarrow(pg, checkMyReviewEmptyIn, ZH_HK, 'My Review zh-HK 0 wrong 320px');
  await switchLangUi(pg);
  await checkMyReviewEmptyIn(pg, EN, 'My Review pill → en');
  await checkMyReviewNarrow(pg, checkMyReviewEmptyIn, EN, 'My Review en 0 wrong 320px');
  await seedMyReview(pg, MY_REVIEW_WRONG_N, 0);
  assert((await textOf(pg, '#tileFlagged .sub')) === FLAGGED_EMPTY[EN], 'My Review en: 0 flagged keeps flaggedEmptyHtml');
  await clearMyReview(pg);
}

// 2026-10-07: the Exam mode description no longer ends with "pick an exam below" (the grid sits right under it)
const EXAM_DESC_DROPPED = { [EN]: 'Pick an exam below', [ZH_HK]: '請於下方選擇試卷' };
const EXAM_DESC_END = { [EN]: 'score and answers.', [ZH_HK]: '分數及答案。' };
async function checkExamDescIn(pg, lang, tag) {
  assert((await langOf(pg)).lang === lang, `${tag}: page in ${lang}`);
  const desc = await textOf(pg, '#modeDesc');
  assert(!desc.includes(EXAM_DESC_DROPPED[lang]), `${tag}: no "${EXAM_DESC_DROPPED[lang]}": ${desc}`);
  assert(desc.endsWith(EXAM_DESC_END[lang]), `${tag}: ends with "${EXAM_DESC_END[lang]}"`);
}
async function checkExamDesc(pg) {
  await pg.evaluate(lang => { setLang(lang); leaveToHome(); startMode('exam'); }, EN);
  await checkExamDescIn(pg, EN, 'Exam desc en');
  await switchLangUi(pg);
  await checkExamDescIn(pg, ZH_HK, 'Exam desc pill → zh-HK');
  await switchLangUi(pg);
}

// 2026-10-07: the Practice hint beside "Reset progress" is a 4-point list, no full stop at the end of a point,
// {max} = PRACTICE_ROUND_MAX (24) and {streak} = MASTERY_STREAK (3) filled in, both bold parts kept
const PRACTICE_HINT_ITEMS = {
  [EN]: [
    'Each round draws up to 24 unmastered questions, each asked once',
    'Answer a question correctly 3 times in a row to master it',
    'Unmastered questions come back in the next round',
    'Mastered questions are skipped until the whole set is mastered',
  ],
  [ZH_HK]: [
    '每輪最多抽取 24 條未掌握的題目，每題出現一次',
    '同一題連續答對 3 次即算掌握',
    '未掌握的題目會於下一輪再出現',
    '已掌握的題目會略過，直至整組全部掌握',
  ],
};
const PRACTICE_HINT_BOLD = { [EN]: ['24', '3 times in a row'], [ZH_HK]: ['24', '連續答對 3 次'] };
const POINT_END_STOP = /[。.]$/;
async function checkPracticeHintIn(pg, lang, tag) {
  assert((await langOf(pg)).lang === lang, `${tag}: page in ${lang}`);
  const hint = await pg.$eval('#practiceHint', e => ({
    items: [...e.querySelectorAll('ul > li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()),
    bold: [...e.querySelectorAll('li b')].map(b => b.textContent.trim()),
  }));
  assert(JSON.stringify(hint.items) === JSON.stringify(PRACTICE_HINT_ITEMS[lang]), `${tag}: 4 points, text and order exact: ` + JSON.stringify(hint.items));
  assert(hint.items.length === 4 && hint.items.every(s => !POINT_END_STOP.test(s)), `${tag}: no point ends with 。 or .`);
  assert(JSON.stringify(hint.bold) === JSON.stringify(PRACTICE_HINT_BOLD[lang]), `${tag}: both bold parts, numbers filled in: ` + JSON.stringify(hint.bold));
  await checkResetBelow(pg, '#practiceReset', tag);
}
// v1.0.3 (user): a reset box shows its hint, then its button on its own row across the box's full content width
const RESET_TOLERANCE_PX = 1;
async function checkResetBelow(pg, sel, tag) {
  const r = await pg.$eval(sel, row => {
    const cs = getComputedStyle(row), b = row.querySelector('.reset-btn').getBoundingClientRect(), h = row.querySelector('.reset-hint').getBoundingClientRect();
    const content = row.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return { below: b.top >= h.bottom - 0.5, w: Math.round(b.width), content: Math.round(content), shown: cs.display !== 'none' };
  });
  assert(r.shown && r.below && Math.abs(r.w - r.content) <= RESET_TOLERANCE_PX, `${tag}: ${sel} button on its own full-width row under the hint: ` + JSON.stringify(r));
}
const RESET_WIDTHS = [320, 390, 600];
async function checkResetRows(pg) {
  for (const lang of [EN, ZH_HK]) {
    for (const w of RESET_WIDTHS) {
      await pg.setViewportSize({ width: w, height: WIDE.height });
      await pg.evaluate(l => { setLang(l); leaveToHome(); startMode('practice'); }, lang);
      await checkResetBelow(pg, '#practiceReset', `${lang} ${w}px Practice`);
      assert(await pg.$eval('#examReset', e => getComputedStyle(e).display === 'none'), `${lang} ${w}px: the exam reset box stays hidden in Practice`);
      await pg.evaluate(() => startMode('exam'));
      await checkResetBelow(pg, '#examReset', `${lang} ${w}px Exam`);
      assert(await pg.$eval('#practiceReset', e => getComputedStyle(e).display === 'none'), `${lang} ${w}px: the practice reset box stays hidden in Exam`);
    }
  }
  await pg.setViewportSize(WIDE);
  await pg.evaluate(l => { setLang(l); leaveToHome(); }, EN);
}
async function checkPracticeHint(pg) {
  await pg.evaluate(lang => { setLang(lang); leaveToHome(); startMode('practice'); }, EN);
  await checkPracticeHintIn(pg, EN, 'Practice hint en');
  await switchLangUi(pg);
  await checkPracticeHintIn(pg, ZH_HK, 'Practice hint pill → zh-HK');
  await checkNarrow(pg, 'Practice hint');
  await pg.setViewportSize(NARROW);
  await checkPracticeHintIn(pg, ZH_HK, 'Practice hint zh-HK 320px');
  await pg.setViewportSize(WIDE);
  await switchLangUi(pg);
}

// 2026-10-07: the "Leave the exam?" modal cancel reads Cancel / 取消 (was Stay / 留下)
const LEAVE_CANCEL = { [EN]: 'Cancel', [ZH_HK]: '取消' };
async function checkLeaveCancelIn(pg, lang) {
  await pg.evaluate(l => { setLang(l); leaveToHome(); pendingMode = 'exam'; startExam(1); goHome(); }, lang);
  assert(await pg.evaluate(() => isConfirmOpen()), `leave modal ${lang}: open`);
  const cancel = await textOf(pg, '#confirmCancel');
  assert(cancel === LEAVE_CANCEL[lang], `leave modal ${lang}: cancel reads ${LEAVE_CANCEL[lang]}: ${cancel}`);
  await pg.click('#confirmCancel');
  await pg.evaluate(() => leaveToHome());
}
async function checkLeaveCancel(pg) {
  await checkLeaveCancelIn(pg, EN);
  await checkLeaveCancelIn(pg, ZH_HK);
  await pg.evaluate(lang => setLang(lang), EN);
}

// S-045: draw two hanzi in the page font; identical pixels mean the fallback drew the same tofu box for both
const hasCjkFont = pg => pg.evaluate(({ px, chars, baseline }) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const g = canvas.getContext('2d');
  g.font = `${px * baseline}px ${getComputedStyle(document.body).fontFamily}`;
  const draw = ch => { g.clearRect(0, 0, px, px); g.fillText(ch, 0, px * baseline); return g.getImageData(0, 0, px, px).data.join(); };
  return draw(chars[0]) !== draw(chars[1]);
}, { px: GLYPH_PROBE_PX, chars: GLYPH_PROBE_CHARS, baseline: GLYPH_BASELINE });

// run in order: each check starts from the screen / language the previous one left
const CHECKS = [
  checkSettingsButton, checkHomeSwitch, checkHomePractice, checkQuizPractice, checkAnswerFallback, checkOptionYueLang,
  checkSideSession, checkQuizExam, checkExamTimer, checkModal, checkResult, checkFlagged, checkStudy, checkPlanGoal, checkPlanSchedule, checkPlanDay, checkPlanRun, checkDoubleTap,
  checkMyReviewTiles, checkMyReviewFit, checkExamDesc, checkPracticeHint, checkResetRows, checkLeaveCancel,
];

async function main() {
  const b = seedLegacyDefaults(await chromium.launch(launchOpts));
  const pg = await b.newPage({ viewport: WIDE });
  const ctx = { errs: [], warns: [] };
  pg.on('pageerror', e => ctx.errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'warning') ctx.warns.push(m.text()); });
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();
  ctx.hasCjkFont = !FORCE_NO_CJK_FONT && await hasCjkFont(pg);
  for (const check of CHECKS) await check(pg, ctx);
  assert(ctx.errs.length === 0, 'no page errors: ' + ctx.errs.join(' | '));
  await b.close();
  return ctx;
}

// M4: at 320px the zh-HK pass line "…方為合格。" keeps its last words together (no one-word last line)
async function checkResultSub(pg) {
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(1); finishExam(); });
  await switchLangUi(pg);
  await pg.setViewportSize(NARROW);
  const lines = await pg.evaluate(() => {
    const node = byId('resultSub').firstChild, len = node.textContent.length;
    const top = i => { const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 1); return Math.round(r.getBoundingClientRect().top); };
    return { text: node.textContent, tail: [top(len - 5), top(len - 1)] };
  });
  await pg.setViewportSize(WIDE);
  assert(lines.text.endsWith('方為合格。') && lines.tail[0] === lines.tail[1], 'zh-HK 320px: 方為合格。 stays on one line: ' + JSON.stringify(lines));
  await switchLangUi(pg);
}

// S-066: run-all.sh prints only the last line, so a skipped M4 must show up there, not only in the log body
main().then(ctx => console.log(ctx.hasCjkFont ? 'LANG-SWITCH PASS' : 'LANG-SWITCH PASS (M4 skipped: no CJK font)')).catch(e => { console.error(e.message); process.exit(1); });
