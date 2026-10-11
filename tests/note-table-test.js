// v1.0.7: memory-note tables (.proj-docs/plans/2026-10-09_plan_note-table.md). Consecutive note lines starting with
// "|" render as one table (first row = header); "<br>" inside a cell splits main text from small remarks.
// v1.0.10: memo v2 (.proj-docs/plans/2026-10-11_memo-final-spec.json): 61 memos, 375 notes, 52 of them with a table
// A: noteHtml unit (in the page, with the app's escapeHtml)  B: every memo's notes in data/exams.js
// C: the Study card "💡 記憶法", the Practice answer box and the Results review fit every table at 390px
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

// ── spec: tests/fixtures/memo-notes.json — memo id → questions ("exam.index", 0-based) + note text from the heading on;
// prefixes = lines kept above the heading. ④ 4A "全英國 MP": WORD JOINER (U+2060) between the CJK chars +
// NO-BREAK SPACE before MP keep that remark on one line
const SPEC = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'fixtures', 'memo-notes.json'), 'utf8'));
const MEMO_COUNT = 61, MEMO_QUESTIONS = 375, TABLE_MEMO_COUNT = 52, TOTAL_TABLE_QUESTIONS = 346, PREFIX_COUNT = 20;
const MP_MEMO = '4A';
const isTableLine = l => l.trim().startsWith('|');
const tableRowsOf = text => text.split('\n').filter(isTableLine).map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
const MEMOS = Object.fromEntries(SPEC.memos.map(m => [m.id, m]));
const PREFIXES = SPEC.prefixes;
const TABLE_MEMOS = SPEC.memos.filter(m => m.text.split('\n').some(isTableLine)).map(m => m.id);
const NOTE_TABLES = Object.fromEntries(TABLE_MEMOS.map(id => [id, MEMOS[id].text]));
const GROUP_QUESTIONS = Object.fromEntries(TABLE_MEMOS.map(id => [id, MEMOS[id].questions]));
const memoOf = key => SPEC.memos.find(m => m.questions.includes(key));
const groupOf = key => TABLE_MEMOS.find(id => GROUP_QUESTIONS[id].includes(key));
const expectedNote = key => (PREFIXES[key] !== undefined ? PREFIXES[key] + '\n' : '') + memoOf(key).text;
const questionAt = (EXAMS, key) => { const [e, i] = key.split('.').map(Number); return EXAMS[e][i]; };
const keyLabel = key => { const [e, i] = key.split('.').map(Number); return `E${e} Q${i + 1}`; };

// ── B: data ──
function checkData() {
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'data', 'exams.js'), 'utf8');
  const EXAMS = new Function(src + ';return EXAMS;')();
  const memoKeys = SPEC.memos.flatMap(m => m.questions), all = Object.values(GROUP_QUESTIONS).flat();
  assert(SPEC.memos.length === MEMO_COUNT && memoKeys.length === MEMO_QUESTIONS && new Set(memoKeys).size === MEMO_QUESTIONS,
    `${MEMO_COUNT} memos, ${MEMO_QUESTIONS} distinct questions`);
  assert(TABLE_MEMOS.length === TABLE_MEMO_COUNT && all.length === TOTAL_TABLE_QUESTIONS, `${TABLE_MEMO_COUNT} memos with a table, ${TOTAL_TABLE_QUESTIONS} questions`);
  const bad = memoKeys.filter(k => (questionAt(EXAMS, k).note || '') !== expectedNote(k));
  assert(bad.length === 0, `all ${MEMO_QUESTIONS} notes = (prefix +) their memo text (bad: ${bad.slice(0, 5).map(k => `${keyLabel(k)} ${JSON.stringify(questionAt(EXAMS, k).note).slice(0, 80)}`).join(' | ')})`);
  // Q1 (F55): one STUDY fact, one memo — Wilberforce 8.15 shares N8a with 14.23 / 16.18
  assert(['8.15', '14.23', '16.18'].every(k => memoOf(k).id === 'N8a') && !MEMOS.N8b.text.includes('1807'), 'Q1: Slave Trade Act questions 8.15 / 14.23 / 16.18 all use N8a; N8b has no 1807 row');
  assert(Object.keys(PREFIXES).length === PREFIX_COUNT && Object.keys(PREFIXES).every(k => memoKeys.includes(k) && PREFIXES[k].trim()), `${PREFIX_COUNT} questions keep a prefix line`);
  // no other note in the bank uses the table syntax
  const withTable = Object.entries(EXAMS).flatMap(([e, qs]) => qs.map((q, i) => [`${e}.${i}`, q.note || ''])).filter(([, n]) => n.split('\n').some(isTableLine)).map(([k]) => k);
  assert(withTable.length === TOTAL_TABLE_QUESTIONS && withTable.every(k => all.includes(k)), `exactly the ${TOTAL_TABLE_QUESTIONS} table memo notes carry table rows (${withTable.length})`);
  // S-140: every table in the bank is rectangular (each row has the header's cell count) and no "<br>" segment is empty
  const shapeBad = withTable.filter(k => {
    const lines = questionAt(EXAMS, k).note.split('\n');
    const blocks = []; let cur = null;
    lines.forEach(l => { if (isTableLine(l)) { if (!cur) blocks.push(cur = []); cur.push(l); } else cur = null; });
    return blocks.some(b => {
      const rows = tableRowsOf(b.join('\n'));
      return rows.some(r => r.length !== rows[0].length) || rows.flat().some(c => c.includes('<br>') && c.split('<br>').some(seg => !seg.trim()));
    });
  });
  assert(shapeBad.length === 0, `all ${withTable.length} tables are rectangular with no empty <br> remark (bad: ${shapeBad.join(', ')})`);
  return EXAMS;
}

// ── A: noteHtml unit ──
// the pre-v1.0.7 noteHtml (one row per line), the oracle for notes without "|" lines
const OLD_NOTE_HTML_SRC = `return note.split('\\n').map(line => (line.trim() ? noteLineHtml(line) : '<div class="rv-note-gap"></div>')).join('');`;
const PLAIN_NOTES = [
  '六大責任：遵守法律、照顧家人',
  '記憶法（三層）：\n• 第一層 → A\n  ◦ sub <b>&\n\n→ arrow line',
  '',
  'a | not a table (pipe mid-line)\n  \n• bullet',
];
async function checkUnit(pg) {
  const r = await pg.evaluate(({ oldSrc, plain }) => {
    const oldNoteHtml = new Function('note', oldSrc);
    const render = html => { const d = document.createElement('div'); d.innerHTML = html; return d; };
    const out = {};
    out.plainSame = plain.map(n => noteHtml(n) === oldNoteHtml(n));
    // basic table: header + 2 body rows, a remark cell, escaping
    const basic = '| A | B | C |\n| x | <script>alert(1)</script> | M &amp; S<br>sub <i>one</i><br>sub two |\n| y | & | z |';
    const html = noteHtml(basic), d = render(html);
    const wrap = d.querySelector('.note-table-wrap'), table = wrap && wrap.querySelector('table.note-table');
    out.basic = {
      wraps: d.querySelectorAll('.note-table-wrap').length, children: d.children.length, lang: table && table.getAttribute('lang'),
      head: table ? [...table.querySelectorAll('thead tr')].map(tr => [...tr.children].map(c => c.tagName + ':' + c.textContent)) : null,
      body: table ? [...table.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(c => c.tagName + ':' + c.textContent)) : null,
      scripts: d.querySelectorAll('script, i').length,
      multi: table ? [...table.querySelectorAll('td.multi')].map(c => ({ subs: [...c.querySelectorAll('.note-cell-sub')].map(s => s.textContent), main: c.firstChild.nodeType === 3 ? c.firstChild.textContent : null })) : null,
      plainCellClass: table ? table.querySelector('tbody tr td').className : null,
      remarkHtml: html.includes('<td class="multi">M &amp;amp; S<span class="note-cell-sub">sub &lt;i&gt;one&lt;/i&gt;</span><span class="note-cell-sub">sub two</span></td>'),
      wrapHtml: html.startsWith('<div class="note-table-wrap"><table class="note-table" lang="zh-HK"><thead><tr><th>A</th><th>B</th><th>C</th></tr></thead><tbody>'),
    };
    // mixed: heading, table, bullets, gap, a second table, a trailing plain line
    const mixed = '記憶法：\n| H1 | H2 |\n| a | b |\n• bullet one\n\n  ◦ sub\n| K | V |\n| 1 | 2 |\n| 3 | 4 |\ntrailing';
    const m = render(noteHtml(mixed));
    out.mixed = {
      seq: [...m.children].map(c => c.className),
      tables: [...m.querySelectorAll('table')].map(t => [t.tHead.rows.length, t.tBodies[0].rows.length]),
      linesSame: [...m.querySelectorAll('.rv-note-line')].map(e => e.outerHTML).join('') === ['記憶法：', '• bullet one', '  ◦ sub', 'trailing'].map(noteLineHtml).join(''),
    };
    // a lone "|" line = header only, empty tbody
    const lone = render(noteHtml('| only |')).querySelector('table');
    out.lone = lone ? [lone.tHead.rows.length, lone.tBodies.length ? lone.tBodies[0].rows.length : -1] : null;
    return out;
  }, { oldSrc: OLD_NOTE_HTML_SRC, plain: PLAIN_NOTES });
  assert(r.plainSame.every(Boolean), `notes without "|" lines render byte-identical to the old noteHtml (${JSON.stringify(r.plainSame)})`);
  const b = r.basic;
  assert(b.wraps === 1 && b.children === 1 && b.lang === 'zh-HK' && b.wrapHtml, 'consecutive "|" lines → one .note-table-wrap > table.note-table lang="zh-HK", thead first');
  assert(JSON.stringify(b.head) === JSON.stringify([['TH:A', 'TH:B', 'TH:C']]), 'thead = the first row, one <th> per cell: ' + JSON.stringify(b.head));
  assert(b.body && b.body.length === 2 && b.body.every(row => row.length === 3 && row.every(c => c.startsWith('TD:'))), 'tbody = the other 2 rows, 3 <td> each');
  assert(b.scripts === 0 && b.body[0][1] === 'TD:<script>alert(1)</script>' && b.body[1][1] === 'TD:&' && b.body[0][2].startsWith('TD:M &amp; S'), 'cell text is escaped: <script>, &, &amp; render as text');
  assert(JSON.stringify(b.multi) === JSON.stringify([{ subs: ['sub <i>one</i>', 'sub two'], main: 'M &amp; S' }]) && b.remarkHtml && b.plainCellClass === '',
    'a <br> cell → td.multi: main text + one .note-cell-sub per remark (split first, then each escaped); plain cells have no class');
  assert(JSON.stringify(r.mixed.seq) === JSON.stringify(['rv-note-line', 'note-table-wrap', 'rv-note-line bullet', 'rv-note-gap', 'rv-note-line sub', 'note-table-wrap', 'rv-note-line'])
    && JSON.stringify(r.mixed.tables) === JSON.stringify([[1, 1], [1, 2]]) && r.mixed.linesSame,
  'tables mix with heading / bullet / gap / sub lines in note order; the other lines still go through noteLineHtml: ' + JSON.stringify(r.mixed));
  assert(JSON.stringify(r.lone) === JSON.stringify([1, 0]), 'a single "|" line is a header-only table');
}

// ── C: screens at 390px ──
// every .note-table-wrap under root: no horizontal scroll, inside its container's box; tables = expected count
const FIT_JS = `(root) => [...root.querySelectorAll('.note-table-wrap')].map(w => {
  const r = w.getBoundingClientRect(), p = w.parentElement.getBoundingClientRect();
  return { sw: w.scrollWidth, cw: w.clientWidth, over: r.right - p.right, left: p.left - r.left, docW: document.documentElement.scrollWidth, vw: innerWidth };
})`;
const fits = list => list.length > 0 && list.every(f => f.sw <= f.cw && f.over <= 0.5 && f.left <= 0.5 && f.docW <= f.vw);

async function checkPractice(pg) {
  const mpLines = []; // memo 4A: line boxes of the 議員 remark "全英國 MP" per question
  for (const [g, keys] of Object.entries(GROUP_QUESTIONS)) {
    const bad = [];
    for (const key of keys) {
      const r = await pg.evaluate(({ key, fitSrc }) => {
        const [e, i] = key.split('.').map(Number);
        pendingMode = 'practice'; startExam(e);
        state.current = state.questions.findIndex(q => q.examNum === e && q.origIdx === i);
        if (state.current < 0) return { missing: true };
        renderQuestion(); state.questions[state.current].a.forEach(selectOption); // multi-answer: pick all to reveal
        const box = document.getElementById('ansNote');
        // distinct line tops of the "… MP" remark's text (a wrap = 2+ tops)
        const sub = [...box.querySelectorAll('.note-cell-sub')].find(s => /MP$/.test(s.textContent));
        let mpLines = null;
        if (sub) { const rg = document.createRange(); rg.selectNodeContents(sub); mpLines = new Set([...rg.getClientRects()].map(x => Math.round(x.top))).size; }
        return { visible: box.offsetParent !== null, rows: box.querySelectorAll('.note-table tr').length, fit: new Function('return ' + fitSrc)()(box), mpLines };
      }, { key, fitSrc: FIT_JS });
      if (r.missing || !r.visible || !r.rows || !fits(r.fit)) bad.push(`${key} ${JSON.stringify(r)}`);
      if (g === MP_MEMO) mpLines.push([key, r.mpLines]);
    }
    assert(bad.length === 0, `Practice answer box, memo ${g}: ${keys.length} tables fit 390px, no scroll (bad: ${bad.slice(0, 2).join(' | ')})`);
  }
  // user request: the 議員 cell is exactly "650" / "全英國 MP", the remark never wraps at 390px (e.g. E6 Q9)
  assert(mpLines.length === GROUP_QUESTIONS[MP_MEMO].length && mpLines.every(([, n]) => n === 1), `Practice, memo ${MP_MEMO}: "全英國 MP" remark on one line in all ${mpLines.length} questions: ${JSON.stringify(mpLines)}`);
}

async function checkResults(pg) {
  const bad = {}; let seen = 0;
  for (let e = 1; e <= 17; e++) {
    await pg.evaluate(e => { pendingMode = 'exam'; startExam(e); state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); finishExam(); }, e);
    const r = await pg.evaluate(fitSrc => {
      const fit = new Function('return ' + fitSrc)();
      return [...document.querySelectorAll('#reviewList .review-item')].map(it => {
        const q = state.questions[Number(it.id.slice(2))];
        return { key: `${q.examNum}.${q.origIdx}`, fit: fit(it) };
      }).filter(x => x.fit.length);
    }, FIT_JS);
    for (const { key, fit } of r) {
      seen++;
      const g = groupOf(key) || 'none';
      if (!fits(fit) || fit.length !== 1 || g === 'none') (bad[g] = bad[g] || []).push(`${key} ${JSON.stringify(fit)}`);
    }
  }
  assert(seen === TOTAL_TABLE_QUESTIONS && Object.keys(bad).length === 0, `Results review: all ${seen} tables (${TABLE_MEMO_COUNT} memos) fit 390px, no scroll (bad: ${JSON.stringify(bad).slice(0, 300)})`);
}

async function checkStudy(pg) {
  // a card's table is matched to its group by its full text (cell remarks join their main text in textContent)
  const r = await pg.evaluate(({ tables, fitSrc }) => {
    const fit = new Function('return ' + fitSrc)();
    const out = {};
    for (const ch of CHAPTER_NUMBERS) {
      studySetTab('chapters'); studySetChapter(ch);
      for (const c of document.querySelectorAll('#studyContent .fact')) {
        const d = c.querySelector('details.fact-mem'); if (!d) continue;
        d.open = true;
        const table = d.querySelector('.note-table'); if (!table) continue;
        const text = [...table.rows].map(tr => [...tr.cells].map(c => c.textContent).join('|')).join('\n');
        const g = Object.keys(tables).find(k => tables[k] === text);
        (out[g] = out[g] || []).push({ id: c.dataset.factId, fit: fit(d.querySelector('.fact-mem-body')) });
      }
    }
    studySetTab('timeline');
    return out;
  }, { tables: Object.fromEntries(Object.entries(NOTE_TABLES).map(([g, t]) => [g, tableRowsOf(t).map(r => r.map(c => c.split('<br>').join('')).join('|')).join('\n')])), fitSrc: FIT_JS });
  // ⑤N / ⑧C reuse ⑤ / ⑧'s table (only their prefix differs), so a card's table matches the first memo with that text
  const firstWithTable = g => Object.keys(NOTE_TABLES).find(k => tableRowsOf(NOTE_TABLES[k]).join('\n') === tableRowsOf(NOTE_TABLES[g]).join('\n'));
  for (const g of Object.keys(NOTE_TABLES).filter(k => firstWithTable(k) === k)) {
    const cards = r[g] || [], bad = cards.filter(c => !fits(c.fit));
    assert(cards.length > 0 && bad.length === 0, `Study 💡 記憶法 (opened), memo ${g}: ${cards.length} cards, tables fit 390px, no scroll (bad: ${JSON.stringify(bad.slice(0, 2))})`);
  }
  assert(!r.undefined, `Study: every table shown belongs to one of the ${TABLE_MEMO_COUNT} memos`);
}

(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();
  await checkUnit(pg);
  checkData();
  // the table look (Theme B + V4): nowrap cells, only <br> cells wrap, remark small / muted / not bold
  const look = await pg.evaluate(() => {
    const host = document.createElement('div'); host.style.width = '358px'; document.body.appendChild(host);
    host.innerHTML = noteHtml('| H | I<br>J |\n| a | b<br>c |\n| d | e |');
    const cs = sel => getComputedStyle(host.querySelector(sel));
    const tok = n => { const i = document.createElement('i'); i.style.color = `var(${n})`; host.appendChild(i); return getComputedStyle(i).color; };
    const fs = n => { const i = document.createElement('i'); i.style.fontSize = `var(${n})`; host.appendChild(i); return getComputedStyle(i).fontSize; };
    const out = {
      th: [cs('th:not(.multi)').whiteSpace, cs('th').color, cs('th').borderBottomWidth, cs('th').borderBottomColor, cs('th').verticalAlign],
      td: [cs('tbody tr:first-child td:last-child').whiteSpace, cs('tbody td:not(.multi)').whiteSpace, cs('tbody td').verticalAlign],
      first: [cs('tbody td:first-child').color, cs('tbody td:first-child').fontWeight, cs('tbody tr:first-child td').borderBottomColor],
      last: cs('tbody tr:last-child td').borderBottomWidth,
      sub: [cs('.note-cell-sub').display, cs('.note-cell-sub').fontSize, cs('.note-cell-sub').fontWeight, cs('.note-cell-sub').color],
      thMulti: cs('th.multi').whiteSpace,
      wrap: cs('.note-table-wrap').overflowX,
      want: { navy: tok('--navy'), divider: tok('--divider'), muted: tok('--text-muted'), xs: fs('--fs-xs') },
    };
    host.remove();
    return out;
  });
  const w = look.want;
  assert(JSON.stringify(look.th) === JSON.stringify(['nowrap', w.navy, '2px', w.navy, 'top']) && JSON.stringify(look.td) === JSON.stringify(['normal', 'nowrap', 'top'])
    && JSON.stringify(look.first) === JSON.stringify([w.navy, '700', w.divider]) && look.last === '0px' && look.thMulti === 'normal'
    && JSON.stringify(look.sub) === JSON.stringify(['block', w.xs, '400', w.muted]) && look.wrap === 'auto',
  'Theme B + V4 look: navy header + 2px navy rule, divider rows, last row no rule, navy bold first column, nowrap except th/td.multi, muted xs remarks: ' + JSON.stringify(look));
  await checkPractice(pg);
  await checkResults(pg);
  await checkStudy(pg);
  assert(errs.length === 0, 'no page errors: ' + errs.join('; '));
  await b.close();
  console.log('NOTE-TABLE PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
