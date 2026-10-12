const { chromium } = require('playwright-core');
const path = require('path');
// v1.4.0: Cantonese translation on / off (⚙ → Features → "🌐 Translation", on by default; user-confirmed):
// - off hides every translation: the quiz Translate button, the question / option / answer translations, the results
//   review, the flagged list, the Similar panel and the Study fact cards ("全域收晒翻譯")
// - off keeps the 💡 notes (quiz answer box, results review), the fact memory aid and the UI language
// - the row is a switch + On / Off pill like the study plan row; a choice closes the popover (Q10), nothing is stored
//   until the user picks (lifeuk.translation), the choice survives a reload; the row shows even when the plan row hides
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const TRANSLATION_LS = 'lifeuk.translation';
const ROW = '#settingsTransRow';
const SWITCH = '#translationSwitch';
const PILL = '#settingsTransPill';

const fresh = async pg => {
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear());
  await pg.goto(APP_URL);
};
const stored = pg => pg.evaluate(k => localStorage.getItem(k), TRANSLATION_LS);
const attrOff = pg => pg.evaluate(() => document.documentElement.dataset.translation === 'off');
const popShown = pg => pg.$eval('#settingsPop', e => e.getClientRects().length > 0);
// the number of matching elements that take up room on the page
const shownCount = (pg, sel) => pg.$$eval(sel, els => els.filter(e => e.getClientRects().length > 0).length);
const toastShown = pg => pg.$eval('#appToast', e => !e.hidden && e.getClientRects().length > 0);
const toastText = pg => pg.$eval('#appToast', e => e.textContent);
async function toggleTranslation(pg) {
  await pg.click('#settingsBtn');
  await pg.click(SWITCH);
}
// a practice question with a note (and option translations), before and after answering
const OPEN_NOTED_PRACTICE = () => {
  pendingMode = 'practice'; startExam(1);
  state.current = state.questions.findIndex(q => q.note && q.oy && q.oy.some(Boolean));
  renderQuestion();
};
const ANSWER_CURRENT = () => { const i = state.current, q = state.questions[i]; state.answers[i] = [...q.a]; revealAnswer(); };
// an exam whose questions include a note, submitted with every answer right
const FINISH_NOTED_EXAM = () => {
  pendingMode = 'exam'; startExam(1);
  state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; });
  finishExam();
};

// default on, the row, a choice, storage, reload
async function checkSwitch(pg) {
  await fresh(pg);
  assert(!(await attrOff(pg)) && await stored(pg) === null, 'default: translation on, nothing stored');
  await pg.click('#settingsBtn');
  const row = await pg.evaluate(([r, s, p]) => ({
    shown: !!document.querySelector(r) && document.querySelector(r).getClientRects().length > 0,
    checked: document.querySelector(s) && document.querySelector(s).getAttribute('aria-checked'),
    role: document.querySelector(s) && document.querySelector(s).getAttribute('role'),
    pill: document.querySelector(p) && document.querySelector(p).textContent,
    pillOn: document.querySelector(p) && document.querySelector(p).classList.contains('on'),
    label: document.querySelector(r) && document.querySelector(r + ' b').textContent,
  }), [ROW, SWITCH, PILL]);
  assert(row.shown && row.role === 'switch' && row.checked === 'true' && row.pill === 'On' && row.pillOn, 'the ⚙ Features translation row: switch on, green On pill: ' + JSON.stringify(row));
  assert(row.label === '🌐 Translation', 'en label 🌐 Translation: ' + row.label);
  await pg.click(SWITCH);
  assert(!(await popShown(pg)) && await pg.evaluate(() => document.activeElement.id) === 'settingsBtn', 'Q10: the choice closes the popover, focus back on ⚙');
  assert(await attrOff(pg) && await stored(pg) === JSON.stringify('off'), 'off: <html data-translation="off">, stored');
  await pg.reload();
  assert(await attrOff(pg), 'reload: translation stays off');
  await pg.click('#settingsBtn');
  const offRow = await pg.evaluate(([s, p]) => ({ checked: document.querySelector(s).getAttribute('aria-checked'), pill: document.querySelector(p).textContent, off: document.querySelector(p).classList.contains('off') }), [SWITCH, PILL]);
  assert(offRow.checked === 'false' && offRow.pill === 'Off' && offRow.off, 'reload: switch off, red Off pill: ' + JSON.stringify(offRow));
  await pg.click(SWITCH);
  assert(!(await attrOff(pg)) && await stored(pg) === JSON.stringify('on'), 'back on: no attribute, on stored');
  await pg.evaluate(k => localStorage.setItem(k, '"maybe"'), TRANSLATION_LS);
  await pg.reload();
  assert(!(await attrOff(pg)), 'an unknown stored value reads as on');
}

// R-002: the confirm modal open → the switch does nothing
async function checkConfirmOpen(pg) {
  await fresh(pg);
  await pg.click('#settingsBtn');
  await pg.evaluate(() => { showConfirm({ title: 'x', message: 'y', okLabel: 'ok', cancelLabel: 'no', onOk: () => {} }); });
  await pg.evaluate(s => document.querySelector(s).click(), SWITCH);
  assert(!(await attrOff(pg)) && await stored(pg) === null, 'R-002: with the confirm modal open the switch does nothing');
  assert(!(await toastShown(pg)), 'R-002: no toast when the confirm modal blocks the switch: ' + JSON.stringify(await toastText(pg)));
}

// v1.4.1: the switch shows a toast like the study plan switch (js/components/toast.js), both languages, no raw key;
// a stale locale (no toast key) shows no toast rather than the raw key
const TOAST_WORDS = {
  en: { off: 'Cantonese translation turned off', on: 'Cantonese translation turned on' },
  'zh-HK': { off: '已關閉廣東話翻譯', on: '已開啟廣東話翻譯' },
};
async function checkToast(pg) {
  for (const lang of ['en', 'zh-HK']) {
    await fresh(pg);
    await pg.evaluate(l => setLang(l), lang);
    assert(!(await toastShown(pg)), `toast ${lang}: none before the switch`);
    await toggleTranslation(pg);
    const off = await toastText(pg);
    assert(await toastShown(pg) && off === TOAST_WORDS[lang].off && !/app\./.test(off), `toast ${lang}: off: "${TOAST_WORDS[lang].off}": ` + off);
    await toggleTranslation(pg);
    const on = await toastText(pg);
    assert(await toastShown(pg) && on === TOAST_WORDS[lang].on && !/app\./.test(on), `toast ${lang}: on: "${TOAST_WORDS[lang].on}": ` + on);
  }
  await fresh(pg);
  await pg.evaluate(() => { delete LOCALES.en.app.translationToastOff; });
  await toggleTranslation(pg);
  assert(await attrOff(pg) && !(await toastShown(pg)), 'toast: a stale locale (no key) switches off with no raw-key toast: ' + JSON.stringify(await toastText(pg)));
}

// every translation hidden with the switch off, the notes kept; on again restores them
async function checkQuiz(pg, off) {
  const tag = off ? 'off' : 'on';
  await pg.evaluate(OPEN_NOTED_PRACTICE);
  assert(await shownCount(pg, '#yueToggle') === (off ? 0 : 1), `${tag}: practice before answering: Translate button ${off ? 'hidden' : 'shown'}`);
  if (!off) await pg.click('#yueToggle');
  else await pg.evaluate(() => toggleQuestionYue()); // a stray toggle (e.g. a stale handler) still shows nothing
  assert(await shownCount(pg, '#qYue') === (off ? 0 : 1) && await shownCount(pg, '.opt-yue') === (off ? 0 : await pg.$$eval('.opt-yue', e => e.length)),
    `${tag}: translation toggled before answering: question / option translations ${off ? 'hidden' : 'shown'}`);
  await pg.evaluate(ANSWER_CURRENT);
  const after = { opt: await shownCount(pg, '.opt-yue'), ans: await shownCount(pg, '#ansYue'), note: await shownCount(pg, '#ansNote'), q: await shownCount(pg, '#qYue') };
  assert(off ? after.opt === 0 && after.ans === 0 && after.q === 0 : after.opt > 0 && after.ans === 1,
    `${tag}: after answering: option / answer translations ${off ? 'hidden' : 'shown'}: ` + JSON.stringify(after));
  assert(after.note === 1, `${tag}: after answering: the 💡 note still shows`);
}
async function checkOtherScreens(pg, off) {
  const tag = off ? 'off' : 'on';
  await pg.evaluate(FINISH_NOTED_EXAM);
  const rv = { yue: await shownCount(pg, '.rv-yue'), note: await shownCount(pg, '.rv-note'), all: await pg.$$eval('.rv-yue', e => e.length) };
  assert(rv.all > 0 && (off ? rv.yue === 0 : rv.yue === rv.all) && rv.note > 0, `${tag}: results review: translations ${off ? 'hidden' : 'shown'}, notes shown: ` + JSON.stringify(rv));
  await pg.evaluate(() => { pendingMode = 'practice'; startExam(5); setPracticeFlag(qKey(state.questions[0]), true); openFlagged(); });
  assert(await shownCount(pg, '.fi-yue') === (off ? 0 : await pg.$$eval('.fi-yue', e => e.length)) && await pg.$$eval('.fi-yue', e => e.length) > 0, `${tag}: flagged list translations ${off ? 'hidden' : 'shown'}`);
  await pg.evaluate(() => {
    pendingMode = 'practice'; startExam(12);
    state.current = state.questions.findIndex(q => q.origIdx === 5);
    renderQuestion();
    const i = state.current, q = state.questions[i]; q.note = ''; state.answers[i] = [...q.a]; revealAnswer();
  });
  const sqm = { qy: await shownCount(pg, '#similarBox .sqm-qy'), fy: await shownCount(pg, '#similarBox .sqm-fact-yue'), en: await shownCount(pg, '#similarBox .sqm-fact-en') };
  assert(sqm.en === 1 && (off ? sqm.qy === 0 && sqm.fy === 0 : sqm.qy > 0 && sqm.fy === 1), `${tag}: Similar panel translations ${off ? 'hidden' : 'shown'}: ` + JSON.stringify(sqm));
  await pg.evaluate(() => openStudy());
  const st = { yue: await shownCount(pg, '.fact-yue'), all: await pg.$$eval('.fact-yue', e => e.length), mem: await pg.$$eval('.fact-mem', e => e.filter(x => x.getClientRects().length > 0).length) };
  assert(st.all > 0 && (off ? st.yue === 0 : st.yue === st.all) && st.mem > 0, `${tag}: Study fact cards: translations ${off ? 'hidden' : 'shown'}, memory aid shown: ` + JSON.stringify(st));
}
// a question with no note: off leaves no empty divider / dashed review box. Since v1.3.2 every question has a note,
// so the test blanks one (Exam 6 · Q21 in the quiz, the first question on the review) to keep the CSS guarded
async function checkNoNote(pg) {
  await pg.evaluate(() => {
    pendingMode = 'practice'; startExam(6);
    state.current = state.questions.findIndex(q => q.origIdx === 20);
    renderQuestion();
    const i = state.current, q = state.questions[i]; q.note = ''; state.answers[i] = [...q.a]; revealAnswer();
  });
  assert(await shownCount(pg, '#answerBox .divider') === 0 && await shownCount(pg, '#ansEn') === 1, 'off, no note: the answer box has no empty divider');
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(6); state.questions[0].note = ''; state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); finishExam(); });
  const tr = await pg.evaluate(() => [...document.querySelectorAll('.rv-tr')].map(e => [!!e.querySelector('.rv-note'), e.getClientRects().length > 0]));
  assert(tr.length === 24 && tr.some(([note]) => !note) && tr.every(([note, shown]) => note === shown), 'off, no note: the review hides only the empty dashed box: ' + tr.filter(x => !x[0]).length);
}
async function checkHidden(pg) {
  await fresh(pg);
  await toggleTranslation(pg);
  await checkQuiz(pg, true);
  assert(await shownCount(pg, '#quickNav') === 1, 'off: answered: the quick ← → pair shows');
  await checkOtherScreens(pg, true);
  await checkNoNote(pg);
  await pg.evaluate(() => goHome());
  await toggleTranslation(pg);
  await checkQuiz(pg, false);
  await checkOtherScreens(pg, false);
}

// zh-HK labels (no raw keys); the language switch keeps the choice
async function checkZh(pg) {
  await fresh(pg);
  await pg.evaluate(() => setLang('zh-HK'));
  await pg.click('#settingsBtn');
  const zh = await pg.evaluate(([r, s, p]) => ({ label: document.querySelector(r + ' b').textContent, pill: document.querySelector(p).textContent, aria: document.querySelector(s).getAttribute('aria-label'), text: document.querySelector(r).textContent }), [ROW, SWITCH, PILL]);
  assert(zh.label === '🌐 廣東話翻譯' && zh.pill === '已開啟' && zh.aria && !/app\./.test(zh.aria + zh.text), 'zh-HK: 🌐 廣東話翻譯 / 已開啟, no raw keys: ' + JSON.stringify(zh));
  await pg.click(SWITCH);
  await pg.evaluate(() => setLang('en'));
  assert(await attrOff(pg), 'switching the language keeps translation off');
  await pg.click('#settingsBtn');
  const en = await pg.evaluate(([r, s]) => ({ text: document.querySelector(r).textContent, aria: document.querySelector(s).getAttribute('aria-label') }), [ROW, SWITCH]);
  assert(!/app\./.test(en.text + en.aria) && en.text.includes('Off'), 'en after zh-HK: row re-rendered in English: ' + JSON.stringify(en));
}

// W-058: the Home Practice description promises the Cantonese translation only while it is on; the switch re-renders
// Home at once (both languages)
async function checkHomeDesc(pg) {
  const desc = () => pg.$eval('#modeDesc', e => e.textContent);
  for (const [lang, word] of [['en', 'Cantonese'], ['zh-HK', '廣東話']]) {
    await fresh(pg);
    await pg.evaluate(l => setLang(l), lang);
    const on = await desc();
    assert(on.includes(word), `W-058 ${lang}: translation on: the Practice description mentions ${word}: ` + on);
    await toggleTranslation(pg);
    const off = await desc();
    assert(off.length > 0 && !off.includes(word) && !/home\./.test(off), `W-058 ${lang}: translation off: the Practice description re-renders without ${word}: ` + off);
    await pg.reload();
    assert(!(await desc()).includes(word), `W-058 ${lang}: off after a reload: still no ${word}`);
    await toggleTranslation(pg);
    assert((await desc()).includes(word), `W-058 ${lang}: back on: ${word} returns`);
  }
}

// R2-1 (user decision 2026-10-12, supersedes S-202): the Study search placeholder NEVER mentions English / Cantonese —
// translation on or off, on load, at once on the switch (any screen), after a reload and after a language switch.
// Matching itself is unchanged: Cantonese still finds facts
const SEARCH_PLACEHOLDER = { en: 'Search facts', 'zh-HK': '搜尋知識點' };
const NO_LANG_MENTION = /English|Cantonese|英文|廣東話/;
async function checkStudySearch(pg) {
  const ph = () => pg.$eval('#studySearch', e => e.placeholder);
  const expectPlain = async (lang, label) => {
    const got = await ph();
    assert(got === SEARCH_PLACEHOLDER[lang] && !NO_LANG_MENTION.test(got), `R2-1 ${label}: placeholder "${SEARCH_PLACEHOLDER[lang]}": ` + got);
  };
  for (const lang of ['en', 'zh-HK']) {
    await fresh(pg);
    await pg.evaluate(l => setLang(l), lang);
    await expectPlain(lang, `${lang}: translation on`);
    await toggleTranslation(pg); // on Home: the hidden Study input
    await expectPlain(lang, `${lang}: off from Home`);
    await pg.evaluate(() => openStudy());
    await expectPlain(lang, `${lang}: off: Study opens`);
    await toggleTranslation(pg);
    await expectPlain(lang, `${lang}: back on from Study without reload`);
    await toggleTranslation(pg);
    await expectPlain(lang, `${lang}: off again from Study without reload`);
    await pg.reload();
    await expectPlain(lang, `${lang}: off after a reload`);
    const other = lang === 'en' ? 'zh-HK' : 'en';
    await pg.evaluate(() => openStudy());
    await pg.evaluate(l => setLang(l), other);
    await expectPlain(other, `${lang} → ${other} while off (on Study)`);
    await pg.evaluate(() => goHome());
    await pg.evaluate(l => setLang(l), lang);
    await expectPlain(lang, `${other} → ${lang} while off (on Home)`);
    await toggleTranslation(pg);
    await pg.reload();
    await expectPlain(lang, `${lang}: on after a reload`);
  }
  // matching is unchanged: off still finds facts by their Cantonese
  await toggleTranslation(pg);
  await pg.evaluate(() => { openStudy(); byId('studySearch').value = '國王'; studySetSearch('國王'); });
  const found = await pg.$$eval('#studyContent .fact-id', els => els.length);
  assert(found > 0, 'R2-1: translation off: a Cantonese search still finds facts: ' + found);
}

// the plan row hides with the release flag off; the Features title and the translation row stay
async function checkPlanHidden(pg) {
  await fresh(pg);
  await pg.evaluate(() => { window.planEntryReady = () => false; });
  await pg.click('#settingsBtn');
  const r = await pg.evaluate(row => ({
    plan: byId('infoPlanRow').getClientRects().length > 0,
    trans: document.querySelector(row).getClientRects().length > 0,
    title: [...document.querySelectorAll('#settingsPop .plan-settings-title')].some(e => e.getClientRects().length > 0),
  }), ROW);
  assert(!r.plan && r.trans && r.title, 'plan entry hidden: no plan row, the Features title + translation row show: ' + JSON.stringify(r));
}

(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await checkSwitch(pg);
  await checkConfirmOpen(pg);
  await checkToast(pg);
  await checkHidden(pg);
  await checkZh(pg);
  await checkHomeDesc(pg);
  await checkStudySearch(pg);
  await checkPlanHidden(pg);
  assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close();
  console.log('TRANSLATION PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
