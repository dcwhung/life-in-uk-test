// QA v0.69 exploratory keyboard-only run. Real key presses (pg.keyboard) / mouse clicks; page.evaluate only
// seeds localStorage, shortens examDeadline and reads state.   node explore.js <root> <shotdir>
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(process.argv[2]);
const SHOT = path.resolve(process.argv[3]); fs.mkdirSync(SHOT, { recursive: true });
const APP_URL = 'file://' + path.join(ROOT, 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
let pass = 0, fail = 0; const failures = []; const notes = [];
const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; failures.push(m); console.log('FAIL:', m); } };
const note = m => { notes.push(m); console.log('  note:', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GUARD = 420;

async function newPage(b, lang, width, seed = {}) {
  const pg = await b.newPage({ viewport: { width, height: 740 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  let dialogs = 0; pg.on('dialog', d => { dialogs++; d.dismiss(); });
  await pg.goto(APP_URL);
  await pg.evaluate(([lang, seed]) => {
    localStorage.clear();
    localStorage.setItem('lifeuk.uiLang', JSON.stringify(lang));
    localStorage.setItem('lifeuk.installDismissed', 'true');
    Object.entries(seed).forEach(([k, v]) => localStorage.setItem('lifeuk.' + k, JSON.stringify(v)));
  }, [lang, seed]);
  await pg.reload(); await sleep(150);
  await pg.evaluate(() => { window.__fin = 0; const f = finishExam; finishExam = (...a) => { window.__fin++; return f(...a); }; });
  return { pg, errs, dialogs: () => dialogs };
}
const F = pg => pg.evaluate(() => {
  const a = document.activeElement;
  const scr = a && a.closest('.screen');
  return { id: a ? (a.id || a.className || a.tagName) : null, tag: a && a.tagName, fv: !!(a && a !== document.body && a.matches(':focus-visible')),
    inHidden: !!(scr && !scr.classList.contains('active')), outline: a && a !== document.body ? getComputedStyle(a).outlineStyle : '',
    vis: !!(a && a !== document.body && a.getClientRects().length) };
});
const S = pg => pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, modal: isConfirmOpen(), title: byId('confirmTitle').textContent,
  fin: window.__fin, cur: state.questions ? state.current : null, side: isSideSession(), lang: document.documentElement.lang,
  timer: typeof examTimerId !== 'undefined' && examTimerId !== null, upShown: !byId('resultTimeUp').hidden }));
async function keyTo(pg, sel, max = 160) {
  for (let i = 0; i < max; i++) {
    if (await pg.evaluate(s => document.activeElement && document.activeElement.matches(s), sel)) return true;
    await pg.keyboard.press('Tab');
  }
  return pg.evaluate(s => document.activeElement && document.activeElement.matches(s), sel);
}
async function keyToRev(pg, sel, max = 160) {
  for (let i = 0; i < max; i++) {
    if (await pg.evaluate(s => document.activeElement && document.activeElement.matches(s), sel)) return true;
    await pg.keyboard.press('Shift+Tab');
  }
  return false;
}
const center = (pg, sel) => pg.$eval(sel, e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
async function tabCycle(pg, key, n) { const ids = []; for (let i = 0; i < n; i++) { await pg.keyboard.press(key); ids.push((await F(pg)).id); } return ids; }
async function kbStartExam(pg, n = 4) {
  ok(await keyTo(pg, '#modeExam'), 'reach Exam mode card by Tab'); await pg.keyboard.press('Enter');
  ok(await keyTo(pg, `#examGrid [data-arg="${n}"]`), 'reach exam cell by Tab'); await pg.keyboard.press('Enter');
  await sleep(100);
}
async function kbToLast(pg) {
  ok(await keyTo(pg, '#navDots .dot:last-child'), 'reach dot 24 by Tab'); await pg.keyboard.press('Enter'); await sleep(50);
}
async function strayKeys(pg, keys = ['Enter', 'Space', 'Enter']) { for (const k of keys) { await pg.keyboard.press(k); await sleep(80); } }
const bottomLeft = async pg => [4, (await pg.evaluate(() => innerHeight)) - 4];

async function combo(b, lang, w) {
  const tag = `[${lang} ${w}]`;
  const zh = lang === 'zh-HK';
  // ───────── Submit modal ─────────
  {
    const { pg, errs, dialogs } = await newPage(b, lang, w);
    await kbStartExam(pg);
    ok((await S(pg)).scr === 'screenQuiz' && (await S(pg)).timer, `${tag} Submit: exam started by keyboard`);
    await kbToLast(pg);
    ok(await keyTo(pg, '#nextBtn'), `${tag} reach Submit by Tab`);
    await pg.keyboard.press('Enter');
    let s = await S(pg), f = await F(pg);
    ok(s.modal && f.id === 'confirmOk' && f.fv && f.outline !== 'none', `${tag} Submit kbd-open: modal, focus OK, ring ${JSON.stringify(f)}`);
    note(`${tag} Submit title: ${s.title}`);
    if (w === 320) await pg.screenshot({ path: path.join(SHOT, `submit-kbd-${lang}-${w}.png`) });
    const fw = await tabCycle(pg, 'Tab', 5), bw = await tabCycle(pg, 'Shift+Tab', 5);
    ok(fw.join() === 'confirmCancel,confirmOk,confirmCancel,confirmOk,confirmCancel' && bw.join() === 'confirmOk,confirmCancel,confirmOk,confirmCancel,confirmOk', `${tag} Tab/Shift+Tab cycle ${fw} | ${bw}`);
    for (let i = 0; i < 12; i++) await pg.keyboard.press('Tab');
    ok(['confirmOk', 'confirmCancel'].includes((await F(pg)).id), `${tag} 12 more Tabs stay in modal (pill unreachable)`);
    await pg.keyboard.press('Escape'); s = await S(pg); f = await F(pg);
    ok(!s.modal && f.id === 'nextBtn' && f.fv && s.scr === 'screenQuiz', `${tag} Esc: closed, focus Submit with ring ${f.id}/${f.fv}`);
    await pg.keyboard.press('Enter'); s = await S(pg);
    ok(s.modal && (await F(pg)).id === 'confirmOk', `${tag} stray Enter after Esc re-opens Submit prompt (opener has focus, by design)`);
    await pg.keyboard.press('Shift+Tab'); await pg.keyboard.press('Enter'); s = await S(pg); f = await F(pg);
    ok(!s.modal && f.id === 'nextBtn' && s.fin === 0, `${tag} Keep going by Enter: closed, focus Submit, not finished`);
    await pg.keyboard.press('Space'); await sleep(50); s = await S(pg);
    ok(s.modal, `${tag} Space on Submit opens prompt`);
    const bl = await bottomLeft(pg);
    const bd = await pg.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e && e.id; }, bl);
    await pg.mouse.click(...bl); await sleep(60); s = await S(pg); f = await F(pg);
    ok(bd === 'confirmModal' && !s.modal && f.id === 'nextBtn' && s.scr === 'screenQuiz' && s.fin === 0, `${tag} backdrop click (${bd}) cancels; focus back to Submit ${JSON.stringify(f)}`);
    note(`${tag} keyboard-open + backdrop mouse click: restored Submit focus-visible=${f.fv}`);
    await pg.keyboard.press('Enter'); await sleep(50);
    const top = await pg.evaluate(() => { const r = byId('langBtn').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e.id; });
    await pg.mouse.click(...await center(pg, '#langBtn')); await sleep(60); s = await S(pg);
    ok(top === 'confirmModal' && !s.modal && s.lang === (zh ? 'zh-HK' : 'en') && s.scr === 'screenQuiz', `${tag} pill click while Submit prompt open → backdrop, lang unchanged ${s.lang}`);
    await pg.waitForTimeout(GUARD);
    await pg.mouse.click(...await center(pg, '#nextBtn')); await sleep(60); f = await F(pg); s = await S(pg);
    ok(s.modal && f.id === 'confirmOk', `${tag} Submit mouse-open (after keyboard use): focus OK`); note(`${tag} mixed modality: Submit mouse-open after keyboard use fv=${f.fv}`);
    await pg.mouse.click(...await center(pg, '#confirmCancel')); await sleep(60); f = await F(pg);
    ok(!(await S(pg)).modal && f.id === 'nextBtn', `${tag} mouse Cancel: focus back to Submit`); note(`${tag} mixed modality: after mouse Cancel fv=${f.fv}`);
    ok(await keyToRev(pg, '#quickNext'), `${tag} reach quick ✓ by Shift+Tab`);
    await pg.keyboard.press('Enter'); s = await S(pg);
    ok(s.modal, `${tag} quick ✓ opens Submit prompt`);
    await pg.keyboard.press('Escape'); f = await F(pg);
    ok(f.id === 'quickNext' && f.fv, `${tag} Esc returns focus to quick ✓ (${f.id})`);
    await pg.keyboard.press('Enter'); await pg.keyboard.press('Enter'); await sleep(80);
    s = await S(pg); f = await F(pg);
    ok(s.scr === 'screenResult' && !s.modal && s.fin === 1 && !f.inHidden, `${tag} Enter on OK: results, finish once, focus not in hidden screen ${JSON.stringify(f)}`);
    await strayKeys(pg); s = await S(pg);
    ok(s.scr === 'screenResult' && !s.modal && s.fin === 1, `${tag} stray Enter/Space/Enter on results: nothing ${JSON.stringify(s)}`);
    ok(errs.length === 0 && dialogs() === 0, `${tag} Submit block: no page errors / native dialogs ${errs}`);
    await pg.close();
  }
  // ───────── Time up with Submit open ─────────
  for (const variant of ['kbd-ok', 'kbd-cancel', 'mouse', 'quick']) {
    const { pg, errs } = await newPage(b, lang, w);
    await kbStartExam(pg); await kbToLast(pg);
    if (variant === 'mouse') { await pg.mouse.click(...await center(pg, '#nextBtn')); }
    else if (variant === 'quick') { await keyToRev(pg, '#quickNext'); await pg.keyboard.press('Enter'); }
    else { await keyTo(pg, '#nextBtn'); await pg.keyboard.press('Enter'); if (variant === 'kbd-cancel') await pg.keyboard.press('Tab'); }
    ok((await S(pg)).modal, `${tag} time-up/Submit(${variant}): prompt open`);
    await pg.evaluate(() => { examDeadline = Date.now() + 250; });
    await sleep(1500);
    let s = await S(pg), f = await F(pg);
    ok(s.scr === 'screenResult' && !s.modal && s.fin === 1 && s.upShown && !f.inHidden, `${tag} time-up/Submit(${variant}): results, prompt closed, focus ${f.id} not in hidden screen`);
    await strayKeys(pg, ['Enter', 'Space', 'Enter', 'Escape', 'Enter']); s = await S(pg);
    ok(s.scr === 'screenResult' && !s.modal && s.fin === 1 && s.upShown, `${tag} time-up/Submit(${variant}): stray keys keep results ${JSON.stringify(s)}`);
    ok(errs.length === 0, `${tag} time-up/Submit(${variant}) no page errors ${errs}`);
    await pg.close();
  }
  // ───────── Leave modal ─────────
  {
    const { pg, errs } = await newPage(b, lang, w);
    await kbStartExam(pg);
    ok(await keyToRev(pg, '#screenQuiz .back-btn'), `${tag} reach ← Home by Shift+Tab`);
    await pg.keyboard.press('Enter'); let s = await S(pg), f = await F(pg);
    ok(s.modal && f.id === 'confirmCancel' && f.fv, `${tag} Leave kbd-open: focus Cancel with ring`);
    note(`${tag} Leave title: ${s.title}`);
    if (w === 320) await pg.screenshot({ path: path.join(SHOT, `leave-kbd-${lang}-${w}.png`) });
    const fw = await tabCycle(pg, 'Tab', 3), bw = await tabCycle(pg, 'Shift+Tab', 3);
    ok(fw.join() === 'confirmOk,confirmCancel,confirmOk' && bw.join() === 'confirmCancel,confirmOk,confirmCancel', `${tag} Leave Tab cycle ${fw} | ${bw}`);
    await pg.keyboard.press('Escape'); f = await F(pg); s = await S(pg);
    ok(!s.modal && String(f.id).includes('back-btn') && f.fv && s.timer, `${tag} Leave Esc: focus ← Home, exam running`);
    await pg.keyboard.press('Enter'); await pg.keyboard.press('Enter'); s = await S(pg); f = await F(pg);
    ok(!s.modal && s.scr === 'screenQuiz' && String(f.id).includes('back-btn'), `${tag} Enter, Enter (open, Cancel): stays in exam`);
    await pg.keyboard.press('Space'); await sleep(50);
    await pg.mouse.click(...await bottomLeft(pg)); await sleep(60); s = await S(pg);
    ok(!s.modal && s.scr === 'screenQuiz' && s.timer, `${tag} Leave backdrop click cancels`);
    await pg.keyboard.press('Enter'); await sleep(40);
    await pg.mouse.click(...await center(pg, '#confirmMsg')); await sleep(40);
    const afterCard = await F(pg); await pg.keyboard.press('Shift+Tab'); const st = await F(pg);
    note(`${tag} click on modal message moves focus to ${afterCard.id}; Shift+Tab then → ${st.id}`);
    ok(['confirmOk', 'confirmCancel'].includes(st.id), `${tag} after clicking modal text, Shift+Tab stays in modal (${st.id})`);
    await pg.keyboard.press('Escape');
    await keyTo(pg, '#screenQuiz .back-btn');
    await pg.keyboard.press('Enter'); await pg.keyboard.press('Tab'); await pg.keyboard.press('Enter'); await sleep(80);
    s = await S(pg); f = await F(pg);
    ok(s.scr === 'screenHome' && !s.modal && !s.timer && !f.inHidden, `${tag} Leave OK by keyboard → Home, timer stopped, focus ${f.id}`);
    await strayKeys(pg); s = await S(pg);
    ok(s.scr === 'screenHome' && !s.modal, `${tag} stray Enter/Space after Leave: stays Home`);
    ok(errs.length === 0, `${tag} Leave block no page errors ${errs}`);
    await pg.close();
  }
  // ───────── Time up with Leave open ─────────
  for (const variant of ['kbd-cancel', 'kbd-ok', 'mouse']) {
    const { pg, errs } = await newPage(b, lang, w);
    await kbStartExam(pg);
    if (variant === 'mouse') { await pg.waitForTimeout(GUARD); await pg.mouse.click(...await center(pg, '#screenQuiz .back-btn')); }
    else { await keyToRev(pg, '#screenQuiz .back-btn'); await pg.keyboard.press('Enter'); if (variant === 'kbd-ok') await pg.keyboard.press('Tab'); }
    ok((await S(pg)).modal, `${tag} time-up/Leave(${variant}): prompt open`);
    await pg.evaluate(() => { examDeadline = Date.now() + 250; }); await sleep(1500);
    let s = await S(pg), f = await F(pg);
    ok(s.scr === 'screenResult' && !s.modal && s.fin === 1 && s.upShown && !f.inHidden, `${tag} time-up/Leave(${variant}): results, focus ${f.id}`);
    await strayKeys(pg, ['Enter', 'Space', 'Enter']); s = await S(pg);
    ok(s.scr === 'screenResult' && !s.modal && s.fin === 1, `${tag} time-up/Leave(${variant}): stray keys keep results ${JSON.stringify(s)}`);
    ok(errs.length === 0, `${tag} time-up/Leave(${variant}) no errors ${errs}`);
    await pg.close();
  }
  // ───────── Reset ×2 on Home ─────────
  for (const kind of ['practice', 'exam']) {
    const seed = kind === 'practice'
      ? { wrongList: { '1.0': true, '1.1': true }, practiceStreak: { '1.2': 2 }, practiceFlags: { '1.3': true } }
      : { completedExams: { 1: true, 2: true } };
    const { pg, errs } = await newPage(b, lang, w, seed);
    const modeSel = kind === 'practice' ? '#modePractice' : '#modeExam';
    ok(await keyTo(pg, modeSel), `${tag} reset(${kind}): reach mode card`); await pg.keyboard.press('Enter'); await sleep(50);
    const btn = kind === 'practice' ? '[data-action="resetPracticeProgress"]' : '[data-action="resetCompletedExams"]';
    ok(await keyTo(pg, btn), `${tag} reset(${kind}): reach reset button by Tab`);
    const lsKey = kind === 'practice' ? 'lifeuk.wrongList' : 'lifeuk.completedExams';
    const before = await pg.evaluate(k => localStorage.getItem(k), lsKey);
    await pg.keyboard.press('Enter'); let s = await S(pg), f = await F(pg);
    ok(s.modal && f.id === 'confirmCancel' && f.fv, `${tag} reset(${kind}) kbd-open: focus Cancel (Keep) with ring`);
    note(`${tag} reset(${kind}) title: ${s.title}`);
    if (w === 320 && kind === 'practice') await pg.screenshot({ path: path.join(SHOT, `reset-kbd-${lang}-${w}.png`) });
    const fw = await tabCycle(pg, 'Tab', 3);
    ok(fw.join() === 'confirmOk,confirmCancel,confirmOk', `${tag} reset(${kind}) Tab cycle ${fw}`);
    await pg.keyboard.press('Escape'); f = await F(pg);
    ok(!(await S(pg)).modal && f.fv && await pg.evaluate(s => document.activeElement.matches(s), btn), `${tag} reset(${kind}) Esc → focus reset button`);
    await pg.keyboard.press('Enter'); await pg.keyboard.press('Enter');
    ok(!(await S(pg)).modal && (await pg.evaluate(k => localStorage.getItem(k), lsKey)) === before, `${tag} reset(${kind}) Enter,Enter = open + Keep: data kept`);
    await pg.keyboard.press('Enter');
    await pg.mouse.click(...await center(pg, '#langBtn')); await sleep(60); s = await S(pg);
    ok(!s.modal && s.lang === (zh ? 'zh-HK' : 'en') && (await pg.evaluate(k => localStorage.getItem(k), lsKey)) === before, `${tag} reset(${kind}) pill click over prompt → backdrop cancel, lang unchanged`);
    await pg.mouse.click(...await center(pg, btn)); await sleep(60); f = await F(pg);
    ok((await S(pg)).modal && f.id === 'confirmCancel', `${tag} reset(${kind}) mouse-open: focus Cancel`); note(`${tag} mixed modality reset mouse-open fv=${f.fv}`);
    await pg.mouse.click(...await bottomLeft(pg)); await sleep(60); f = await F(pg);
    ok(!(await S(pg)).modal && f.id === 'reset-btn', `${tag} reset(${kind}) backdrop: closed, focus back on reset button`); note(`${tag} mixed modality reset backdrop fv=${f.fv}`);
    await keyTo(pg, btn); await pg.keyboard.press('Enter'); await pg.keyboard.press('Tab'); await pg.keyboard.press('Enter'); await sleep(60);
    const after = await pg.evaluate(k => localStorage.getItem(k), lsKey);
    f = await F(pg);
    ok(!(await S(pg)).modal && after === '{}' && f.vis && !f.inHidden, `${tag} reset(${kind}) OK: data cleared (${after}), focus on visible ${f.id}`);
    await pg.keyboard.press('Enter'); s = await S(pg); f = await F(pg);
    ok(s.modal && f.id === 'confirmCancel', `${tag} reset(${kind}) stray Enter after reset re-asks on Keep (safe)`);
    await pg.keyboard.press('Enter'); s = await S(pg);
    ok(!s.modal && s.scr === 'screenHome', `${tag} reset(${kind}) second stray Enter = Keep`);
    ok(errs.length === 0, `${tag} reset(${kind}) no page errors ${errs}`);
    await pg.close();
  }
  // ───────── Study fact practice ↩ Back ─────────
  {
    const { pg, errs } = await newPage(b, lang, w);
    ok(await keyTo(pg, '#modeStudy'), `${tag} reach Study by Tab`); await pg.keyboard.press('Enter'); await sleep(100);
    ok(await keyTo(pg, '.fact-practise', 300), `${tag} reach first fact ▶ Practise by Tab`);
    const factId = await pg.evaluate(() => document.activeElement.dataset.arg);
    await pg.keyboard.press('Enter'); await sleep(80);
    let s = await S(pg), f = await F(pg);
    ok(s.scr === 'screenQuiz' && s.side && !f.inHidden, `${tag} fact session open, focus ${f.tag}/${f.id} (not in hidden Study)`);
    await strayKeys(pg, ['Enter']); s = await S(pg);
    ok(s.scr === 'screenQuiz' && s.cur === 0 && !(await pg.evaluate(() => 0 in state.answers)), `${tag} stray Enter right after opening fact session does nothing`);
    const n = await pg.evaluate(() => state.questions.length);
    for (let i = 0; i < n; i++) {
      const pick = await pg.evaluate(() => [...state.questions[state.current].a]);
      for (const oi of pick) { ok(await keyTo(pg, '#opt' + oi, 60), `${tag} fact q${i + 1}: Tab to option`); await pg.keyboard.press('Enter'); }
      ok(await keyTo(pg, '#nextBtn'), `${tag} fact q${i + 1}: Tab to Next/↩`);
      await pg.keyboard.press('Enter'); await sleep(60);
    }
    s = await S(pg); f = await F(pg);
    const flash = await pg.evaluate(() => !!document.querySelector('.fact.flash'));
    ok(s.scr === 'screenStudy' && !s.side && !f.inHidden && flash, `${tag} ↩ Back by Enter → Study, flash, focus ${f.tag}/${f.id} not in hidden quiz`);
    note(`${tag} after fact ↩ Back, focus = ${f.tag}/${f.id}`);
    await strayKeys(pg); s = await S(pg);
    ok(s.scr === 'screenStudy' && !s.side, `${tag} stray Enter/Space after ↩ Back stays on Study`);
    ok(errs.length === 0, `${tag} Study block no errors ${errs}`);
    await pg.close();
  }
  // ───────── Similar Practise ─────────
  {
    const { pg, errs } = await newPage(b, lang, w);
    ok(await keyTo(pg, '#modePractice'), `${tag} reach Practice`); await pg.keyboard.press('Enter');
    await keyTo(pg, '#ptabExam'); await pg.keyboard.press('Enter');
    ok(await keyTo(pg, '#examGrid [data-arg="1"]'), `${tag} reach practice exam 1`); await pg.keyboard.press('Enter'); await sleep(100);
    let found = false;
    for (let guard = 0; guard < 24 && !found; guard++) {
      const pick = await pg.evaluate(() => [...state.questions[state.current].a]);
      for (const oi of pick) { await keyTo(pg, '#opt' + oi, 60); await pg.keyboard.press('Enter'); }
      found = await pg.evaluate(() => byId('similarBox').classList.contains('show'));
      if (!found) { await keyTo(pg, '#nextBtn'); await pg.keyboard.press('Enter'); await sleep(40); }
    }
    ok(found, `${tag} found a question with Similar panel`);
    const origCur = (await S(pg)).cur;
    ok(await keyTo(pg, '#similarBox [data-action="startSimilarPractice"]', 150), `${tag} Tab to "Practise these N"`);
    await pg.keyboard.press('Enter'); await sleep(60);
    let s = await S(pg), f = await F(pg);
    ok(s.side && s.cur === 0 && !f.inHidden, `${tag} similar session open, focus ${f.tag}/${f.id}`);
    await strayKeys(pg, ['Enter']); s = await S(pg);
    ok(s.side && s.cur === 0 && !(await pg.evaluate(() => 0 in state.answers)), `${tag} stray Enter after Practise does nothing`);
    const n = await pg.evaluate(() => state.questions.length);
    for (let i = 0; i < n; i++) {
      const pick = await pg.evaluate(() => [...state.questions[state.current].a]);
      for (const oi of pick) { await keyTo(pg, '#opt' + oi, 60); await pg.keyboard.press('Enter'); }
      await keyTo(pg, '#nextBtn'); await pg.keyboard.press('Enter'); await sleep(50);
    }
    s = await S(pg); f = await F(pg);
    ok(!s.side && s.cur === origCur && s.scr === 'screenQuiz', `${tag} ↩ Back by Enter → original question ${s.cur}, focus ${f.id}`);
    note(`${tag} after Similar ↩ Back focus=${f.id}`);
    ok(errs.length === 0, `${tag} Similar block no errors ${errs}`);
    await pg.close();
  }
  // ───────── Exam results: filter, retry, Choose Another ─────────
  {
    const { pg, errs } = await newPage(b, lang, w);
    await kbStartExam(pg);
    for (let i = 0; i < 24; i++) {
      const pick = await pg.evaluate(i => { const q = state.questions[state.current]; return i % 2 ? [...q.a] : [q.o.findIndex((_, k) => !q.a.includes(k))]; }, i);
      for (const oi of pick) { await keyTo(pg, '#opt' + oi, 60); await pg.keyboard.press('Enter'); }
      await keyTo(pg, '#nextBtn'); await pg.keyboard.press('Enter'); await sleep(30);
    }
    let s = await S(pg);
    ok(s.scr === 'screenResult' && s.fin === 1 && !s.modal, `${tag} all answered by keyboard: Submit straight to results`);
    const chip = '#reviewOrder [data-action="setReviewFilter"]:not([disabled]):not(.active)';
    ok(await keyTo(pg, chip), `${tag} Tab to a review filter chip`);
    const arg = await pg.evaluate(() => document.activeElement.dataset.arg);
    await pg.keyboard.press('Enter'); await sleep(40);
    let f = await F(pg); s = await S(pg);
    ok(await pg.evaluate(a => reviewFilter === a, arg) && s.scr === 'screenResult', `${tag} filter ${arg} applied by Enter`);
    note(`${tag} after choosing filter "${arg}" by keyboard, focus = ${f.tag}/${f.id}`);
    await strayKeys(pg); s = await S(pg);
    ok(s.scr === 'screenResult' && s.fin === 1, `${tag} stray keys after filter: results unchanged`);
    ok(await keyTo(pg, '.retry-btn'), `${tag} Tab to Retry`);
    await pg.keyboard.press('Enter'); await sleep(60); s = await S(pg); f = await F(pg);
    ok(s.scr === 'screenQuiz' && s.timer && s.cur === 0 && !f.inHidden, `${tag} Retry by Enter → new exam, focus ${f.tag}/${f.id}`);
    await strayKeys(pg); s = await S(pg);
    ok(s.scr === 'screenQuiz' && s.cur === 0 && !s.modal && await pg.evaluate(() => Object.keys(state.answers).length === 0), `${tag} stray keys after Retry: nothing answered / no navigation`);
    await pg.evaluate(() => { examDeadline = Date.now() + 200; }); await sleep(1400);
    ok((await S(pg)).scr === 'screenResult', `${tag} time-up → results`);
    ok(await keyTo(pg, '.another-btn'), `${tag} Tab to Choose Another`);
    await pg.keyboard.press('Enter'); await sleep(60); s = await S(pg); f = await F(pg);
    ok(s.scr === 'screenHome' && !s.modal && !f.inHidden, `${tag} Choose Another by Enter → Home, focus ${f.tag}/${f.id}`);
    await strayKeys(pg); s = await S(pg);
    ok(s.scr === 'screenHome' && !s.modal, `${tag} stray keys after Choose Another: stays Home`);
    ok(errs.length === 0, `${tag} Results block no errors ${errs}`);
    await pg.close();
  }
  // ───────── Practice results ─────────
  {
    const { pg, errs } = await newPage(b, lang, w);
    await keyTo(pg, '#modePractice'); await pg.keyboard.press('Enter');
    await keyTo(pg, '#ptabExam'); await pg.keyboard.press('Enter');
    await keyTo(pg, '#examGrid [data-arg="2"]'); await pg.keyboard.press('Enter'); await sleep(80);
    const n = await pg.evaluate(() => state.questions.length);
    for (let i = 0; i < n; i++) {
      const pick = await pg.evaluate(() => [...state.questions[state.current].a]);
      for (const oi of pick) { await keyTo(pg, '#opt' + oi, 60); await pg.keyboard.press('Enter'); }
      await keyTo(pg, '#nextBtn'); await pg.keyboard.press('Enter'); await sleep(30);
    }
    let s = await S(pg), f = await F(pg);
    ok(s.scr === 'screenResult' && !f.inHidden, `${tag} practice Finish by Enter → results, focus ${f.tag}/${f.id}`);
    await strayKeys(pg); s = await S(pg);
    ok(s.scr === 'screenResult' && s.fin === 1, `${tag} practice results: stray keys nothing`);
    ok(await keyTo(pg, '.retry-btn'), `${tag} practice: Tab to retry`);
    await pg.keyboard.press('Enter'); await sleep(60); s = await S(pg);
    await strayKeys(pg, ['Enter']); const s2 = await S(pg);
    ok(s.scr === 'screenQuiz' && s2.cur === 0 && await pg.evaluate(() => Object.keys(state.answers).length === 0), `${tag} practice retry + stray Enter: nothing answered`);
    ok(await keyToRev(pg, '#screenQuiz .back-btn'), `${tag} practice: Shift+Tab to ← Home`);
    await pg.keyboard.press('Enter'); await sleep(60); s = await S(pg);
    ok(s.scr === 'screenHome' && !s.modal, `${tag} practice ← Home: no prompt (not an exam)`);
    await strayKeys(pg); s = await S(pg);
    ok(s.scr === 'screenHome', `${tag} stray keys after practice ← Home stay Home`);
    ok(errs.length === 0, `${tag} practice results no errors ${errs}`);
    await pg.close();
  }
}

(async () => {
  const b = await chromium.launch(launchOpts);
  const ONLY = process.env.ONLY;
  for (const lang of ['en', 'zh-HK']) for (const w of [390, 320]) {
    if (ONLY && ONLY !== `${lang}-${w}`) continue;
    await combo(b, lang, w);
  }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) console.log('failures:\n - ' + failures.join('\n - '));
  console.log('notes:\n - ' + notes.join('\n - '));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
