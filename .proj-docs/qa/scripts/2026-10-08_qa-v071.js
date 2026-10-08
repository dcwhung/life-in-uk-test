// QA v0.71 (B2 memory-method groups + W-025 + B3 Study "💡 記憶法") — manual, not part of run-all.sh.
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium \
//     node .proj-docs/qa/scripts/2026-10-08_qa-v071.js <v071-root> <v070-root> <out-dir>
// QA_ONLY=practice,study,layout,edge limits the run. QA_VERBOSE=1 prints every ok line.
// Oracle: memory text = first f.src question note from "記憶法", heading line dropped (re-implemented here, the app's
// factMemoryText is never called). Real clicks / key presses for answering, opening and keyboard; page.evaluate only
// seeds, navigates to a question / tab and reads geometry.
const { chromium } = require('playwright-core'); const path = require('path'); const fs = require('fs');
const ROOT = path.resolve(process.argv[2]); const OLD = path.resolve(process.argv[3]); const OUT = path.resolve(process.argv[4]);
const SHOT = path.join(OUT, 'shots'); fs.mkdirSync(SHOT, { recursive: true });
const ONLY = (process.env.QA_ONLY || '').split(',').filter(Boolean); const want = s => !ONLY.length || ONLY.includes(s);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; if (process.env.QA_VERBOSE) console.log('ok:', m); } else { fail++; console.log('FAIL:', m); } };
const GROUPS = { M1: '4.16 6.6 7.14 8.13 12.23 15.6 16.16 17.21', M2: '16.10 11.18 15.12 15.2 1.22 15.19 13.5 15.16',
  M3: '6.22 15.22 8.0 3.18 4.22 2.23 16.6 14.12 2.8', M4: '1.5 3.3 4.15 13.22 8.23 12.8 13.11 17.13 16.2' };
const KEYS = Object.values(GROUPS).join(' ').split(' ');
const WIDTHS = [320, 390, 900]; const LANGS = ['en', 'zh-HK'];
// hanging-indent measure (same idea as 2026-10-08_qa-v070-hang.js)
const MEASURE = `(sel => [...document.querySelectorAll(sel + ' .rv-note-line')].map(r => {
  const mark = r.querySelector('.note-mark'); const tn = [...r.childNodes].filter(n => n.nodeType === 3);
  const rg = document.createRange(); const rects = []; tn.forEach(n => { rg.selectNodeContents(n); rects.push(...rg.getClientRects()); });
  const lines = []; rects.forEach(x => { const l = lines.find(L => Math.abs(L.top - x.top) < 4); if (l) l.left = Math.min(l.left, x.left); else lines.push({ top: x.top, left: x.left }); });
  lines.sort((a, b) => a.top - b.top); const rb = r.getBoundingClientRect();
  return { cls: r.className.replace('rv-note-line', '').trim(), n: lines.length, mark: !!mark, first: lines[0] ? lines[0].left - rb.left : null,
    rest: lines.slice(1).map(l => l.left - rb.left), right: rb.right, txt: r.textContent };
}))`;
const hangBad = rows => rows.filter(m => (m.mark ? m.rest.some(x => Math.abs(x - m.first) > 0.6) : (m.cls === '' && m.rest.some(x => Math.abs(x) > 0.6))));
const oracleRows = note => note.split('\n').map(l => l.trim());
const memOracle = `(f => { for (const k of f.src) { const [e, i] = k.split('.'); const n = EXAMS[e][i].note || ''; const at = n.indexOf('\\u8A18\\u61B6\\u6CD5'); if (at >= 0) return n.slice(at).split('\\n').slice(1).map(l => l.trim()); } return null; })`;
const TABS = [...[1, 2, 3, 4, 5].map(c => ({ tab: 'chapters', ch: c, name: 'ch' + c })), { tab: 'timeline', name: 'timeline' }, { tab: 'geo', name: 'geo' }, { tab: 'people', name: 'people' }];
const gotoTab = (pg, T) => pg.evaluate(T => { studySetTab(T.tab); if (T.ch) studySetChapter(T.ch); if (T.tab === 'geo') studySetNation('all'); if (T.tab === 'people') studySetGroup('all'); window.scrollTo(0, 0); }, T);

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  const open = async (root, lang, width, h = 900) => {
    const pg = await b.newPage({ viewport: { width, height: h } }); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => { errs.push('dialog ' + d.message()); d.dismiss(); });
    await pg.goto('file://' + path.join(root, 'index.html'));
    await pg.evaluate(l => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); }, lang);
    await pg.reload(); pg.errs = errs; return pg; };
  const noHScroll = pg => pg.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth);

  // ── Practice: answer box + Results review for the 34 B2 questions ──
  if (want('practice')) for (const lang of LANGS) for (const w of WIDTHS) {
    const tag = `[practice ${lang} ${w}]`; const pg = await open(ROOT, lang, w);
    let rows = 0, wrapped = 0; const bad = [];
    for (const k of KEYS) {
      const [e, i] = k.split('.').map(Number);
      const note = await pg.evaluate(([e, i]) => { pendingMode = 'practice'; startExam(e); state.current = state.questions.findIndex(q => qKey(q) === e + '.' + i); renderQuestion(); return state.questions[state.current].note; }, [e, i]);
      const picks = await pg.evaluate(() => state.questions[state.current].a);
      for (const a of picks) { await pg.click(`#opt${a}`); await pg.waitForTimeout(380); }
      const r = await pg.evaluate(([m]) => { const box = document.getElementById('ansNote'); const vis = box && box.offsetParent !== null;
        const rws = [...box.querySelectorAll('.rv-note-line, .rv-note-gap')].map(x => x.classList.contains('rv-note-gap') ? '' : x.textContent);
        return { vis, rws, rev: Object.keys(state.revealed).length, meas: eval(m)('#ansNote'), boxR: box.getBoundingClientRect().right }; }, [MEASURE]);
      const exp = oracleRows(note);
      ok(r.vis && r.rev === 1 && JSON.stringify(r.rws) === JSON.stringify(exp), `${tag} ${k} answer box rows = note (${r.rws.length})`);
      const hb = hangBad(r.meas); if (hb.length) bad.push(k + ' ' + JSON.stringify(hb[0]));
      ok(r.meas.every(m => m.right <= r.boxR + 0.5), `${tag} ${k} rows inside the answer box`);
      rows += r.meas.length; wrapped += r.meas.filter(m => m.n > 1).length;
      if (k === '13.5' || k === '15.19') ok(!r.rws[0].startsWith('記憶法') && r.rws[1].startsWith('記憶法') && !r.meas[0].mark, `${tag} ${k} keeps its own line above the memory method: ${r.rws[0].slice(0, 30)}`);
      else ok(r.rws[0].startsWith('記憶法（'), `${tag} ${k} note opens with the memory heading`);
      if (GROUPS.M4.split(' ').includes(k)) ok(r.meas.filter(m => m.cls === 'sub').length === 3 && r.meas[3].cls === 'sub' && r.meas[2].cls !== 'sub', `${tag} ${k} Henry VIII sub-items are ◦ sub rows`);
      ok(await noHScroll(pg), `${tag} ${k} no horizontal scroll`);
      if (w === 320 && lang === 'zh-HK' && ['3.3', '15.19', '6.22', '4.16'].includes(k)) await pg.screenshot({ path: path.join(SHOT, `practice-${k}-${lang}-${w}.png`), fullPage: true });
      await pg.evaluate(() => goHome()); await pg.waitForTimeout(380);
    }
    ok(bad.length === 0, `${tag} hanging indent: ${rows} rows, ${wrapped} wrapped, bad ${bad.slice(0, 3)}`);
    console.log(`${tag} answer box: ${rows} rows, ${wrapped} wrapped, ${bad.length} bad`);
    // Results review: exam mode, answer the exam (half right, half wrong), finish
    const exams = [...new Set(KEYS.map(k => +k.split('.')[0]))]; const rbad = []; let rrows = 0;
    for (const e of exams) {
      const res = await pg.evaluate(([e, m, keys]) => { pendingMode = 'exam'; startExam(e);
        state.questions.forEach((q, i) => { state.answers[i] = i % 2 ? [...q.a] : [q.o.findIndex((_, k) => !q.a.includes(k))]; }); finishExam();
        return state.questions.map((q, i) => ({ k: qKey(q), i, note: q.note })).filter(x => keys.includes(x.k)).map(x => { const it = document.getElementById('rv' + x.i);
          return { ...x, rws: [...it.querySelectorAll('.rv-note-line, .rv-note-gap')].map(r => r.classList.contains('rv-note-gap') ? '' : r.textContent), meas: eval(m)('#rv' + x.i + ' .rv-note') }; }); }, [e, MEASURE, KEYS]);
      for (const x of res) { rrows += x.meas.length; ok(JSON.stringify(x.rws) === JSON.stringify(oracleRows(x.note)), `${tag} review ${x.k} rows = note`); const hb = hangBad(x.meas); if (hb.length) rbad.push(x.k); }
      ok(await noHScroll(pg), `${tag} review E${e} no horizontal scroll`);
      if (w === 390 && e === 13) { await pg.locator('#rv' + res.find(x => x.k === '13.11').i).scrollIntoViewIfNeeded(); await pg.screenshot({ path: path.join(SHOT, `review-13.11-${lang}-${w}.png`) }); }
      await pg.evaluate(() => goHome());
    }
    ok(rbad.length === 0, `${tag} review hanging indent ${rrows} rows, bad ${rbad}`);
    console.log(`${tag} review: ${rrows} rows, ${rbad.length} bad`);
    ok(pg.errs.length === 0, `${tag} no page errors ${pg.errs}`); await pg.close();
  }

  // ── Study: every card with a memory method ──
  if (want('study')) for (const lang of LANGS) for (const w of WIDTHS) {
    const tag = `[study ${lang} ${w}]`; const pg = await open(ROOT, lang, w); await pg.evaluate(() => openStudy());
    const seen = new Set(); let rowsN = 0, wrappedN = 0, opened = 0; const perTab = {};
    for (const T of TABS) {
      await gotoTab(pg, T);
      const cards = await pg.evaluate(o => { const mem = eval(o); return [...document.querySelectorAll('#studyContent .fact')].map(c => { const f = STUDY.find(x => x.id === +c.dataset.factId);
        const d = c.querySelector('details.fact-mem'); const s = d && d.querySelector('summary');
        return { id: f.id, want: mem(f), has: !!d, open: d && d.open, sum: s && s.textContent, h: s && s.getBoundingClientRect().height, tab: s && s.tabIndex,
          after: d && d.previousElementSibling.className, next: d && d.nextElementSibling.className, lang: d && d.querySelector('.fact-mem-body').getAttribute('lang'),
          bodyVis: d && Math.round(d.getBoundingClientRect().height - s.getBoundingClientRect().height), bodyShown: d && d.querySelector('.fact-mem-body').checkVisibility() }; }); }, memOracle);
      for (const c of cards) {
        if (!c.want) { ok(!c.has, `${tag} ${T.name} #${c.id} no memory → no details`); continue; }
        seen.add(c.id);
        ok(c.has && c.open === false && c.bodyVis === 0 && c.bodyShown === false && c.sum === '💡 記憶法' && c.h >= 44 && c.tab === 0 && c.after === 'fact-yue' && c.next === 'fact-src' && c.lang === 'zh-HK',
          `${tag} ${T.name} #${c.id} closed details under the yue line ${JSON.stringify(c)}`);
      }
      // (closed: details box = summary box; body not visible — Chromium keeps a layout box for the hidden body, so its own rect is not 0)
      // open every one by real tap, check content, geometry, hanging indent, overflow
      const memIds = cards.filter(c => c.want).map(c => c.id); perTab[T.name] = memIds.length;
      for (const id of memIds) {
        const s = pg.locator(`#studyContent .fact[data-fact-id="${id}"] details.fact-mem > summary`);
        await s.click(); await pg.waitForTimeout(60); opened++;
        const st = await pg.evaluate(([id, o, m]) => { const mem = eval(o); const c = document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`); const d = c.querySelector('details.fact-mem');
          const rws = [...d.querySelectorAll('.rv-note-line, .rv-note-gap')].map(r => r.classList.contains('rv-note-gap') ? '' : r.textContent);
          const cr = c.getBoundingClientRect(); const outside = [...c.querySelectorAll('*')].filter(x => { const r = x.getBoundingClientRect(); return r.width && (r.right > cr.right + 0.5 || r.left < cr.left - 0.5); }).map(x => x.className);
          const dr = d.getBoundingClientRect(); const inD = [...d.querySelectorAll('*')].filter(x => { const r = x.getBoundingClientRect(); return r.width && r.right > dr.right + 0.5; }).length;
          return { open: d.open, rws, want: mem(STUDY.find(x => x.id === id)), outside, inD, meas: eval(m)(`#studyContent .fact[data-fact-id="${id}"] .fact-mem-body`), sw: document.scrollingElement.scrollWidth <= innerWidth }; }, [id, memOracle, MEASURE]);
        rowsN += st.meas.length; wrappedN += st.meas.filter(x => x.n > 1).length;
        ok(st.open && JSON.stringify(st.rws) === JSON.stringify(st.want), `${tag} ${T.name} #${id} tap opens; rows = note minus heading (${st.rws.length}) ${JSON.stringify(st.rws).slice(0, 80)}`);
        ok(st.outside.length === 0 && st.inD === 0 && st.sw, `${tag} ${T.name} #${id} open: nothing outside the card ${st.outside.slice(0, 3)}`);
        ok(hangBad(st.meas).length === 0, `${tag} ${T.name} #${id} hanging indent ${JSON.stringify(hangBad(st.meas)[0] || '')}`);
      }
      if (memIds.length && ['ch3', 'timeline', 'people'].includes(T.name)) {
        await pg.locator(`#studyContent .fact[data-fact-id="${memIds[0]}"]`).scrollIntoViewIfNeeded();
        await pg.screenshot({ path: path.join(SHOT, `study-${T.name}-open-${lang}-${w}.png`) });
      }
      // tap again closes
      for (const id of memIds) await pg.locator(`#studyContent .fact[data-fact-id="${id}"] details.fact-mem > summary`).click();
      ok(await pg.evaluate(() => [...document.querySelectorAll('#studyContent details.fact-mem')].every(d => !d.open)), `${tag} ${T.name} second tap closes all ${memIds.length}`);
      if (memIds.length && T.name === 'ch3') { await pg.locator(`#studyContent .fact[data-fact-id="${memIds[0]}"]`).scrollIntoViewIfNeeded(); await pg.screenshot({ path: path.join(SHOT, `study-ch3-closed-${lang}-${w}.png`) }); }
      // keyboard on the first card with a memory method: Tab order ✓ → summary → Practise; Enter opens, Space closes
      if (memIds.length) {
        const id = memIds[0]; const sel = `#studyContent .fact[data-fact-id="${id}"]`;
        await pg.locator(`${sel} .fact-btn.tick`).focus(); await pg.keyboard.press('Tab');
        const f1 = await pg.evaluate(s => document.activeElement === document.querySelector(s + ' summary') && document.activeElement.matches(':focus-visible'), sel);
        await pg.keyboard.press('Enter'); const o1 = await pg.evaluate(s => document.querySelector(s + ' details').open, sel);
        if (T.name === 'ch3') { await pg.locator(sel).scrollIntoViewIfNeeded(); await pg.screenshot({ path: path.join(SHOT, `study-ch3-keyboard-${lang}-${w}.png`) }); }
        await pg.keyboard.press('Space'); const o2 = await pg.evaluate(s => document.querySelector(s + ' details').open, sel);
        await pg.keyboard.press('Enter'); await pg.keyboard.press('Tab');
        const f2 = await pg.evaluate(s => document.activeElement === document.querySelector(s + ' .fact-practise'), sel);
        await pg.keyboard.press('Shift+Tab'); await pg.keyboard.press('Space');
        const o3 = await pg.evaluate(s => document.querySelector(s + ' details').open, sel);
        ok(f1 && o1 && !o2 && f2 && o3 === false, `${tag} ${T.name} #${id} keyboard: Tab from ✓ → summary (ring) ${f1}, Enter opens ${o1}, Space closes ${!o2}, Tab → Practise ${f2}, Shift+Tab + Space closes ${o3 === false}`);
      }
      ok(await noHScroll(pg), `${tag} ${T.name} no horizontal scroll`);
    }
    ok(seen.size === 60, `${tag} all 60 memory facts seen across tabs (${seen.size})`);
    console.log(`${tag} memory cards per tab ${JSON.stringify(perTab)}; opened ${opened}; ${rowsN} rows, ${wrappedN} wrapped; distinct ${seen.size}`);
    ok(pg.errs.length === 0, `${tag} no page errors ${pg.errs}`); await pg.close();
  }

  // ── Layout vs v0.70: cards without a memory method identical; with one, only the inserted block + shift below ──
  if (want('layout')) {
    const snap = async (root, lang, w) => { const pg = await open(root, lang, w); await pg.evaluate(() => openStudy()); const out = {};
      for (const T of TABS) { await gotoTab(pg, T); out[T.name] = await pg.evaluate(() => [...document.querySelectorAll('#studyContent .fact')].map(c => { const cr = c.getBoundingClientRect();
        const part = s => { const e = c.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left - cr.left, r.top - cr.top, r.width, r.height].map(v => Math.round(v * 100) / 100); };
        const d = c.querySelector('details.fact-mem'); const dh = d ? d.getBoundingClientRect().height + parseFloat(getComputedStyle(d).marginTop) : 0;
        return { id: +c.dataset.factId, w: Math.round(cr.width * 100) / 100, h: Math.round(cr.height * 100) / 100, dh: Math.round(dh * 100) / 100,
          parts: Object.fromEntries(['.fact-meta', '.fact-name', '.fact-en', '.fact-yue', '.fact-src', '.fact-src-nodes', '.fact-practise', '.fact-actions'].map(s => [s, part(s)])) }; })); }
      await pg.close(); return out; };
    for (const lang of LANGS) for (const w of WIDTHS) {
      const tag = `[layout ${lang} ${w}]`; const A = await snap(OLD, lang, w), B = await snap(ROOT, lang, w);
      let same = 0, mem = 0; const bad = [];
      for (const T of TABS) { const a = A[T.name], bb = B[T.name];
        ok(a.length === bb.length, `${tag} ${T.name} same number of cards ${a.length}/${bb.length}`);
        bb.forEach((c, i) => { const o = a[i]; if (!o || o.id !== c.id) { bad.push(`${T.name} order ${c.id}`); return; }
          if (!c.dh) { if (JSON.stringify(o.parts) === JSON.stringify(c.parts) && o.h === c.h && o.w === c.w) same++; else bad.push(`${T.name} #${c.id} ${JSON.stringify(o)} vs ${JSON.stringify(c)}`); return; }
          mem++;
          const above = ['.fact-meta', '.fact-name', '.fact-en', '.fact-yue', '.fact-actions'].every(s => JSON.stringify(o.parts[s]) === JSON.stringify(c.parts[s]));
          const shift = ['.fact-src', '.fact-src-nodes', '.fact-practise'].every(s => !o.parts[s] || (Math.abs(c.parts[s][1] - o.parts[s][1] - c.dh) < 0.6 && c.parts[s][0] === o.parts[s][0] && c.parts[s][2] === o.parts[s][2]));
          if (!(above && shift && Math.abs(c.h - o.h - c.dh) < 0.6)) bad.push(`${T.name} #${c.id} mem above ${above} shift ${shift} dh ${c.dh} h ${o.h}->${c.h}`); }); }
      ok(bad.length === 0, `${tag} ${same} cards without a memory method unchanged; ${mem} with one differ only by the closed block (${bad.length} bad ${bad.slice(0, 3).join(' | ')})`);
      console.log(`${tag} unchanged ${same}, memory ${mem}, bad ${bad.length}`);
    }
  }

  // ── Edge cases ──
  if (want('edge')) {
    const pg = await open(ROOT, 'en', 390); await pg.evaluate(() => openStudy()); await gotoTab(pg, TABS[2]);
    const sel = '#studyContent .fact[data-fact-id="28"]';
    // E1 HTML in a memory note is escaped (inject into the first source question of #28, re-render)
    const e1 = await pg.evaluate(() => { const f = STUDY.find(x => x.id === 28); const [e, i] = f.src[0].split('.'); const q = EXAMS[e][i]; const old = q.note;
      q.note = '記憶法（x）：\n• <img src=x onerror="window.__x=1"> & <b>bold</b>'; renderStudy(); const d = document.querySelector('#studyContent .fact[data-fact-id="28"] .fact-mem-body');
      const r = { img: !!d.querySelector('img, b'), txt: d.textContent }; q.note = old; renderStudy(); return r; });
    await pg.waitForTimeout(200);
    ok(!e1.img && e1.txt.includes('<img') && !(await pg.evaluate(() => window.__x)), `edge E1 HTML in a memory note rendered as text ${JSON.stringify(e1)}`);
    // E2 heading-only note; first src without / later src with a memory method; no note at all
    const e2 = await pg.evaluate(() => { const f = STUDY.find(x => x.id === 28); const out = {}; const saved = f.src.map(k => { const [e, i] = k.split('.'); return EXAMS[e][i].note; });
      const set = v => f.src.forEach((k, j) => { const [e, i] = k.split('.'); EXAMS[e][i].note = typeof v === 'function' ? v(j) : v; });
      set('記憶法（x）：'); renderStudy(); out.headingOnly = document.querySelectorAll('#studyContent .fact[data-fact-id="28"] details.fact-mem').length;
      out.headingOnlyRows = out.headingOnly ? document.querySelector('#studyContent .fact[data-fact-id="28"] .fact-mem-body').children.length : null;
      set(j => j === 0 ? 'plain note' : '記憶法（y）：\n• from second src'); renderStudy(); const d = document.querySelector('#studyContent .fact[data-fact-id="28"] .fact-mem-body'); out.second = d && d.textContent;
      set(''); renderStudy(); out.none = document.querySelectorAll('#studyContent .fact[data-fact-id="28"] details.fact-mem').length;
      f.src.forEach((k, j) => { const [e, i] = k.split('.'); EXAMS[e][i].note = saved[j]; }); renderStudy(); return out; });
    console.log('edge E2', JSON.stringify(e2));
    ok(e2.none === 0 && /from second src/.test(e2.second || ''), `edge E2 later src memory used when the first has none; no note → no block ${JSON.stringify(e2)}`);
    // E3 rapid taps x5 → open; a quick tap on Practise right after a summary tap is not swallowed by the double-tap guard
    for (let i = 0; i < 5; i++) await pg.locator(sel + ' summary').click({ delay: 10 });
    const e3 = await pg.evaluate(s => document.querySelector(s + ' details').open, sel);
    ok(e3 === true, `edge E3 5 rapid taps leave it open (odd count) ${e3}`);
    await pg.locator(sel + ' summary').click(); await pg.locator(sel + ' .fact-practise').click();
    await pg.waitForTimeout(400);
    const e3b = await pg.evaluate(() => document.querySelector('.screen.active').id);
    ok(e3b === 'screenQuiz', `edge E3b Practise right after a summary tap opens the session (${e3b})`);
    // E4 language switch with a card open: re-render, label same, closed, no error
    await pg.evaluate(() => { goHome(); openStudy(); studySetTab('chapters'); studySetChapter(3); }); await pg.waitForTimeout(400);
    await pg.locator(sel + ' summary').click(); await pg.click('#langBtn'); await pg.waitForTimeout(400);
    const e4 = await pg.evaluate(s => ({ lang: document.documentElement.lang, sum: document.querySelector(s + ' summary')?.textContent, open: document.querySelector(s + ' details')?.open }), sel);
    ok(e4.lang === 'zh-HK' && e4.sum === '💡 記憶法' && e4.open === false, `edge E4 language switch: re-rendered, label 💡 記憶法, closed ${JSON.stringify(e4)}`);
    await pg.click('#langBtn'); await pg.waitForTimeout(300);
    // E5 search keeps the block; Practice / Similar core fact never shows it
    const e5 = await pg.evaluate(() => { const s = document.getElementById('studySearch'); s.value = 'Henry VIII'; s.dispatchEvent(new Event('input', { bubbles: true }));
      return { cards: document.querySelectorAll('#studyContent .fact').length, mem: document.querySelectorAll('#studyContent details.fact-mem').length }; });
    ok(e5.cards > 0 && e5.mem > 0, `edge E5 search "Henry VIII": ${e5.cards} cards, ${e5.mem} with the block`);
    await pg.evaluate(() => { const s = document.getElementById('studySearch'); s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); });
    await pg.evaluate(() => { goHome(); pendingMode = 'practice'; startExam(3); state.current = state.questions.findIndex(q => qKey(q) === '3.3'); renderQuestion(); });
    const picks = await pg.evaluate(() => state.questions[state.current].a); for (const a of picks) { await pg.click(`#opt${a}`); await pg.waitForTimeout(380); }
    const e5c = await pg.evaluate(() => ({ mem: document.querySelectorAll('#screenQuiz details.fact-mem').length }));
    ok(e5c.mem === 0, `edge E5b Practice answer view / Similar core fact shows no Study memory block ${JSON.stringify(e5c)}`);
    // E6 W-025 consistency on screen: E3·Q4 options vs answer-box note; card #28 yue vs memory (Catherine of Aragon)
    const e6 = await pg.evaluate(() => ({ opts: [...document.querySelectorAll('[data-action="selectOption"]')].map(o => (o.textContent.match(/阿拉貢.凱瑟琳/) || [])[0]).filter(Boolean),
      note: (document.getElementById('ansNote').textContent.match(/阿拉貢.凱瑟琳/) || [])[0] }));
    console.log('edge E6 E3·Q4 on screen', JSON.stringify(e6));
    await pg.screenshot({ path: path.join(SHOT, 'cui0017-practice-3.3-en-390.png'), fullPage: true });
    await pg.evaluate(() => { goHome(); openStudy(); studySetTab('chapters'); studySetChapter(3); }); await pg.waitForTimeout(400);
    await pg.locator(sel + ' summary').click();
    const e6b = await pg.evaluate(s => ({ yue: (document.querySelector(s + ' .fact-yue').textContent.match(/阿拉貢.凱瑟琳/) || [])[0], mem: (document.querySelector(s + ' .fact-mem-body').textContent.match(/阿拉貢.凱瑟琳/) || [])[0] }), sel);
    console.log('edge E6b card #28', JSON.stringify(e6b));
    await pg.locator(sel).scrollIntoViewIfNeeded(); await pg.locator(sel).screenshot({ path: path.join(SHOT, 'cui0017-card28-en-390.png') });
    ok(pg.errs.length === 0, `edge no page errors ${pg.errs}`); await pg.close();
  }
  await b.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
