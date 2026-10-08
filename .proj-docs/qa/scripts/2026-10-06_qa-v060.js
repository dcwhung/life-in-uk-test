// QA v0.60 batch (manual, not part of run-all.sh): install banner with real mobile emulation, CUI-0007 label +
// temp session, safe-button modal focus, plus QA edge cases (storage blocked, corrupted flag, keyboard, plural 0).
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium \
//     node .proj-docs/qa/scripts/2026-10-06_qa-v060.js <repo-root> <screenshot-dir>
const { chromium } = require('playwright-core');
const path = require('path');
const ROOT = path.resolve(process.argv[2] || '.');
const SHOT_DIR = path.resolve(process.argv[3] || '.');
const { startPagesServer } = require(path.join(ROOT, 'tests', 'pages-server.js'));
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; console.log('FAIL:', m); } };
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' };
const DESKTOP = { viewport: { width: 1280, height: 900 } };
const fire = pg => pg.evaluate(() => {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; };
  e.userChoice = Promise.resolve({ outcome: window.__outcome || 'accepted' });
  window.dispatchEvent(e);
  return { prevented: e.defaultPrevented, visible: byId('installBanner').classList.contains('visible') };
});
const bannerVisible = pg => pg.evaluate(() => byId('installBanner').classList.contains('visible'));

(async () => {
  const { base, server } = await startPagesServer(ROOT);
  const b = await chromium.launch(launchOpts);
  try {
    // ── 1. install banner ──
    let ctx = await b.newContext(DESKTOP); let pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(base);
    ok(!(await pg.evaluate(() => matchMedia('(pointer: coarse)').matches)), 'desktop context: pointer is fine (no override)');
    let r = await fire(pg);
    ok(r.prevented && !r.visible, `desktop: prompt intercepted, banner hidden ${JSON.stringify(r)}`);
    await pg.screenshot({ path: path.join(SHOT_DIR, '2026-10-06_v060_desktop-home.png') });
    await pg.evaluate(() => promptInstall());
    ok(await pg.evaluate(() => window.__prompted === 1), 'desktop edge: deferred prompt kept, promptInstall() still reaches prompt()');
    ok(errs.length === 0, 'desktop: no page errors ' + errs.join('|'));
    await ctx.close();

    ctx = await b.newContext(MOBILE); pg = await ctx.newPage();
    const merrs = []; pg.on('pageerror', e => merrs.push(e.message));
    await pg.goto(base);
    ok(await pg.evaluate(() => matchMedia('(pointer: coarse)').matches), 'mobile context (isMobile+hasTouch): pointer is coarse (no override)');
    r = await fire(pg);
    ok(r.prevented && r.visible, `mobile: banner shown ${JSON.stringify(r)}`);
    const closeBox = await pg.$eval('#installBanner .install-close', e => {
      const bb = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return { w: bb.width, h: bb.height, color: cs.color, aria: e.getAttribute('aria-label'), title: e.title, type: e.type };
    });
    console.log('  close button:', JSON.stringify(closeBox));
    ok(closeBox.aria === 'Dismiss' && closeBox.title === 'Dismiss', '✕ has aria-label / title "Dismiss"');
    ok(closeBox.color === 'rgba(255, 255, 255, 0.6)', '✕ colour = --text-inverse-muted (0.6)');
    const subColor = await pg.$eval('#installBanner .install-text span', e => getComputedStyle(e).color);
    ok(subColor === 'rgba(255, 255, 255, 0.6)', 'install banner sub-line colour 0.6: ' + subColor);
    await pg.screenshot({ path: path.join(SHOT_DIR, '2026-10-06_v060_mobile-install-banner.png') });
    await pg.locator('#installBanner').screenshot({ path: path.join(SHOT_DIR, '2026-10-06_v060_mobile-install-banner-crop.png') });
    await pg.focus('#installBanner .install-close'); await pg.keyboard.press('Enter');
    let st = await pg.evaluate(() => ({ visible: byId('installBanner').classList.contains('visible'), v: localStorage.getItem('lifeuk.installDismissed') }));
    ok(!st.visible && st.v === 'true', `✕ (keyboard Enter) hides banner, lifeuk.installDismissed === 'true' ${JSON.stringify(st)}`);
    await pg.reload();
    r = await fire(pg);
    ok(r.prevented && !r.visible, 'after reload + new prompt: banner stays hidden');
    await pg.evaluate(() => localStorage.removeItem('lifeuk.installDismissed')); await pg.reload();
    r = await fire(pg); ok(r.visible, 'flag cleared: banner returns');
    await pg.tap('#installBanner .install-close');
    ok(await pg.evaluate(() => localStorage.getItem('lifeuk.installDismissed')) === 'true', '✕ via touch tap stores flag');
    // corrupted / unexpected stored values: getLS JSON-parses, so only truthy JSON hides it
    for (const [val, expectVisible] of [['false', true], ['garbage{', true], ['"yes"', false], ['0', true]]) {
      await pg.evaluate(v => localStorage.setItem('lifeuk.installDismissed', v), val); await pg.reload();
      r = await fire(pg);
      ok(r.visible === expectVisible, `edge: stored flag ${val} → visible=${r.visible} (expected ${expectVisible}), no throw`);
    }
    // Install: accepted
    await pg.evaluate(() => localStorage.removeItem('lifeuk.installDismissed')); await pg.reload();
    r = await fire(pg); ok(r.visible, 'install path: banner shown');
    await pg.click('#installBtn'); await pg.waitForTimeout(100);
    st = await pg.evaluate(() => ({ prompted: window.__prompted, visible: byId('installBanner').classList.contains('visible'), v: localStorage.getItem('lifeuk.installDismissed') }));
    ok(st.prompted === 1 && !st.visible, `Install click → prompt() and accepted hides banner ${JSON.stringify(st)}`);
    ok(st.v === null, 'accepted install does not write the dismiss flag');
    // Install: native prompt dismissed (observation)
    await pg.reload(); await pg.evaluate(() => { window.__outcome = 'dismissed'; });
    await fire(pg); await pg.click('#installBtn'); await pg.waitForTimeout(100);
    st = await pg.evaluate(() => ({ visible: byId('installBanner').classList.contains('visible'), v: localStorage.getItem('lifeuk.installDismissed') }));
    console.log('  observation: native prompt dismissed →', JSON.stringify(st));
    // double activation of Install on one event
    await pg.reload(); await fire(pg);
    await pg.evaluate(async () => { await Promise.all([promptInstall(), promptInstall()]); });
    const n = await pg.evaluate(() => window.__prompted);
    console.log('  observation: two promptInstall() calls on one event → prompt() called', n, 'time(s)');
    ok(merrs.length === 0, 'mobile: no page errors ' + merrs.join('|'));
    await ctx.close();

    // localStorage methods throw
    ctx = await b.newContext(MOBILE);
    await ctx.addInitScript(() => {
      const thrower = () => { throw new DOMException('blocked', 'SecurityError'); };
      Storage.prototype.getItem = thrower; Storage.prototype.setItem = thrower; Storage.prototype.removeItem = thrower;
    });
    pg = await ctx.newPage(); const berrs = []; pg.on('pageerror', e => berrs.push(e.message));
    await pg.goto(base);
    r = await fire(pg); ok(r.visible, 'storage blocked (methods throw): banner shows');
    await pg.click('#installBanner .install-close');
    ok(!(await bannerVisible(pg)), 'storage blocked: ✕ still hides banner');
    ok(berrs.length === 0, 'storage blocked (methods throw): no page errors ' + berrs.join('|'));
    await ctx.close();
    // window.localStorage getter throws (Chrome "block all site data")
    ctx = await b.newContext(MOBILE);
    await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); });
    pg = await ctx.newPage(); const gerrs = []; pg.on('pageerror', e => gerrs.push(e.message));
    await pg.goto(base);
    r = await fire(pg); ok(r.visible, 'storage getter throws: banner shows');
    await pg.click('#installBanner .install-close');
    ok(!(await bannerVisible(pg)), 'storage getter throws: ✕ hides banner');
    ok(gerrs.length === 0, 'storage getter throws: no page errors ' + gerrs.join('|'));
    await ctx.close();

    // ── 3. CUI-0007 ──
    ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); pg = await ctx.newPage();
    const serrs = []; pg.on('pageerror', e => serrs.push(e.message));
    await pg.goto(base);
    const counts = await pg.evaluate(() => {
      const one = [], many = [];
      for (let e = 1; e <= EXAM_COUNT; e++) {
        pendingMode = PRACTICE_MODE; startExam(e);
        state.questions.forEach(q => { const n = similarKeys(q).length; if (n === 1) one.push([e, q.origIdx]); else if (n > 1) many.push([e, q.origIdx, n]); });
      }
      return { one, many };
    });
    console.log(`  similar: ${counts.one.length} questions with exactly 1 similar, ${counts.many.length} with >1`);
    ok(counts.one.length > 0 && counts.many.length > 0, 'found questions with 1 and with >1 similar');
    const runSimilar = async ([exam, origIdx], expectLabel, expectN, shot) => {
      await pg.evaluate(() => localStorage.clear()); await pg.reload();
      await pg.evaluate(({ exam, origIdx }) => {
        pendingMode = PRACTICE_MODE; startExam(exam);
        state.current = state.questions.findIndex(q => q.origIdx === origIdx); renderQuestion();
        const q = state.questions[state.current];
        state.answers[state.current] = [...q.a]; revealAnswer();
      }, { exam, origIdx });
      const before = await pg.evaluate(() => ({ examNum: state.examNum, current: state.current, ans: JSON.stringify(state.answers), n: state.questions.length }));
      const label = await pg.textContent('#similarBox .sqm-cta button');
      ok(label === expectLabel, `E${exam}·Q${origIdx + 1}: label "${label}" === "${expectLabel}"`);
      if (shot) await pg.locator('#similarBox').screenshot({ path: path.join(SHOT_DIR, shot) });
      await pg.click('#similarBox .sqm-cta button');
      const s = await pg.evaluate(() => ({ examNum: state.examNum, n: state.questions.length, current: state.current, sim: isSimilarSession() }));
      ok(s.examNum === 'similar' && s.n === expectN && s.current === 0 && s.sim, `temp session ${JSON.stringify(s)}`);
      ok(!(await pg.evaluate(() => byId('similarBox').classList.contains('show'))), 'similar panel hidden inside the temp session');
      for (let i = 0; i < expectN; i++) {
        await pg.evaluate(i => { state.current = i; const q = state.questions[i]; state.answers[i] = [...q.a]; revealAnswer(); renderQuestion(); }, i);
      }
      const back = pg.locator('#screenQuiz button:visible', { hasText: '↩' }).first();
      ok(await back.count() > 0, '↩ Back button visible on last temp question');
      await back.click();
      const after = await pg.evaluate(() => ({ examNum: state.examNum, current: state.current, ans: JSON.stringify(state.answers), n: state.questions.length, sim: isSimilarSession() }));
      ok(!after.sim && after.examNum === before.examNum && after.current === before.current && after.ans === before.ans && after.n === before.n,
        `↩ Back restores original session ${JSON.stringify({ before, after })}`);
      ok(await pg.evaluate(() => byId('similarBox').classList.contains('show')), 'similar panel shows again after return');
    };
    await runSimilar(counts.one[0], '▶ Practise this one', 1, '2026-10-06_v060_similar-one-cta.png');
    const [me, mo, mn] = counts.many[0];
    await runSimilar([me, mo], `▶ Practise these ${mn}`, mn);
    const pl = await pg.evaluate(() => [0, 1, 2, 5, undefined].map(n => t('similar.practise', n === undefined ? {} : { n })));
    console.log('  plural t(n=0,1,2,5,missing):', JSON.stringify(pl));
    ok(pl[1] === '▶ Practise this one' && pl[2] === '▶ Practise these 2' && pl[3] === '▶ Practise these 5', 'plural 1 / 2 / 5');
    ok(!pl.some(x => typeof x !== 'string' || /\[object|undefined/.test(x)), 'edge: plural with 0 / missing n returns a string (no [object] / undefined)');
    ok(serrs.length === 0, 'similar: no page errors ' + serrs.join('|'));
    await ctx.close();

    // ── 4. modal focus ──
    ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); pg = await ctx.newPage();
    const ferrs = []; pg.on('pageerror', e => ferrs.push(e.message));
    await pg.goto(base);
    const seed = () => pg.evaluate(() => {
      localStorage.setItem('lifeuk.practiceStreak', JSON.stringify({ '1.0': 3, '1.1': 2 }));
      localStorage.setItem('lifeuk.wrongList', JSON.stringify({ '1.2': true }));
      localStorage.setItem('lifeuk.completedExams', JSON.stringify({ 2: true }));
    });
    const snap = () => pg.evaluate(() => ['practiceStreak', 'wrongList', 'completedExams'].map(k => localStorage.getItem('lifeuk.' + k)).join(' | '));
    const active = () => pg.evaluate(() => ({ id: document.activeElement.id, text: document.activeElement.textContent }));
    for (const [mode, action, key] of [['practice', 'resetPracticeProgress', 'Enter'], ['practice', 'resetPracticeProgress', ' '], ['practice', 'resetPracticeProgress', 'Escape'],
      ['exam', 'resetCompletedExams', 'Enter'], ['exam', 'resetCompletedExams', ' ']]) {
      await seed(); await pg.reload();
      await pg.evaluate(m => startMode(m), mode);
      const before = await snap();
      const btn = pg.locator(`[data-action="${action}"]`).first();
      ok(await btn.isVisible(), `${action} button visible on ${mode} home`);
      await btn.click();
      const ae = await active();
      ok(ae.id === 'confirmCancel', `${action}: focus on #${ae.id} "${ae.text}"`);
      if (action === 'resetPracticeProgress' && key === 'Enter') await pg.screenshot({ path: path.join(SHOT_DIR, '2026-10-06_v060_reset-modal-focus.png') });
      await pg.keyboard.press(key);
      const after = await snap();
      ok(!(await pg.evaluate(() => isConfirmOpen())) && after === before, `${action}: key ${JSON.stringify(key)} closes modal, data kept (${after})`);
    }
    await seed(); await pg.reload(); await pg.evaluate(() => startMode('practice'));
    await pg.locator('[data-action="resetPracticeProgress"]').first().click(); await pg.click('#confirmOk');
    const cleared = await snap();
    ok(!cleared.includes('"1.0":3'), 'Reset (click OK) still clears practice progress: ' + cleared);
    // Leave the exam
    await pg.evaluate(() => localStorage.clear()); await pg.reload();
    await pg.evaluate(() => { pendingMode = EXAM_MODE; startExam(3); state.answers[0] = [0]; renderQuestion(); });
    await pg.evaluate(() => goHome());
    let ae = await active();
    ok(ae.id === 'confirmCancel', `Leave exam: focus on #${ae.id} "${ae.text}"`);
    await pg.screenshot({ path: path.join(SHOT_DIR, '2026-10-06_v060_leave-modal-focus.png') });
    await pg.keyboard.press('Enter');
    let qs = await pg.evaluate(() => ({ open: isConfirmOpen(), quiz: byId('screenQuiz').classList.contains('active'), running: isExamRunning(), a0: JSON.stringify(state.answers[0]) }));
    ok(!qs.open && qs.quiz && qs.running && qs.a0 === '[0]', `Leave: Enter = Cancel (#confirmCancel, formerly Stay), still in exam ${JSON.stringify(qs)}`);
    await pg.evaluate(() => goHome()); await pg.keyboard.press('Tab');
    const tabbed = await pg.evaluate(() => document.activeElement.id);
    ok(tabbed === 'confirmOk', 'edge: Tab from Cancel (formerly Stay) moves to Leave (deliberate path still reachable): ' + tabbed);
    await pg.keyboard.press('Escape');
    // Submit modal keeps OK focus
    await pg.evaluate(() => { state.flags[1] = true; submitExam(); });
    ae = await active();
    ok(ae.id === 'confirmOk', `Submit: focus on #${ae.id} "${ae.text}"`);
    await pg.keyboard.press('Enter');
    qs = await pg.evaluate(() => ({ open: isConfirmOpen(), result: byId('screenResult').classList.contains('active') }));
    ok(!qs.open && qs.result, `Submit: Enter submits → result screen ${JSON.stringify(qs)}`);
    // re-open after cancel: focus still on cancel; Submit after a reset modal: focus back on OK
    await seed(); await pg.reload(); await pg.evaluate(() => startMode('practice'));
    await pg.evaluate(() => { resetPracticeProgress(); closeConfirm(); resetPracticeProgress(); });
    ok((await active()).id === 'confirmCancel', 'edge: re-opened reset modal focuses cancel again');
    await pg.keyboard.press('Escape');
    await pg.evaluate(() => { pendingMode = EXAM_MODE; startExam(3); state.flags[0] = true; submitExam(); });
    ok((await active()).id === 'confirmOk', 'edge: Submit opened after a reset modal is back on OK (focusCancel does not leak)');
    await pg.keyboard.press('Escape');
    ok(ferrs.length === 0, 'modal: no page errors ' + ferrs.join('|'));
    await ctx.close();
  } catch (e) { fail++; console.log('FAIL (exception):', e.stack); }
  finally { await b.close(); server.kill(); }
  console.log(`\nQA-V060: ${pass} ok, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
