// v1.0.7: memory-note tables (.proj-docs/plans/2026-10-09_plan_note-table.md). Consecutive note lines starting with
// "|" render as one table (first row = header); "<br>" inside a cell splits main text from small remarks.
// A: noteHtml unit (in the page, with the app's escapeHtml)  B: the 10 groups' notes in data/exams.js (101 questions)
// C: the Study card "💡 記憶法", the Practice answer box and the Results review fit every table at 390px
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

// ── spec: the note text from the 記憶法 heading on, per group (plan "第一批 data" + "Grill 決定") ──
const NOTE_TABLES = {
  1: '記憶法：\n| 國家 | 聖人 | 日子 |\n| England | George | 23/4 |\n| Scotland | Andrew | 30/11 |\n| Wales | David | 1/3 |\n| N. Ireland | Patrick | 17/3 |',
  2: '記憶法：\n| 國家 | 國教 | 教會 |\n| England | ✓ | Church of England<br>君主係最高領袖，坎特伯雷大主教係精神領袖 |\n| Scotland | ✗ | Church of Scotland<br>Presbyterian（長老會），國家教會，唔係國教 |\n| Wales | ✗ | ✗ |\n| N. Ireland | ✗ | ✗ |',
  3: '記憶法：\n| 國家 | 首都 | 國花 |\n| England | London | Tudor rose |\n| Scotland | Edinburgh | Thistle |\n| Wales | Cardiff | Daffodil |\n| N. Ireland | Belfast | Shamrock |',
  4: '記憶法：\n| 地區 | 議會 / 地點 | 議員 |\n| England | UK Parliament<br>Westminster | 650<br>全英國 MP |\n| Scotland | Scottish Parliament<br>蘇格蘭議會<br>Edinburgh（愛丁堡） | 129 |\n| Wales | Senedd<br>威爾斯議會，前稱 National Assembly for Wales<br>Cardiff（加的夫） | 60 |\n| N. Ireland | Northern Ireland Assembly<br>北愛爾蘭議會<br>Belfast（貝爾法斯特） | 90 |\n• England 冇自己嘅地方議會，由英國國會直接負責；\n• Senedd 議員：考試答 60（2026 年選舉起增至 96）；\n• Scotland / Wales / N. Ireland 三個議會用比例代表制（proportional representation）；\n• 英國國會用領先者當選制（first past the post）',
  5: '記憶法：\n| 年份 | 人物 / 發明 |\n| 17 世紀 | Isaac Newton<br>牛頓：萬有引力、運動定律 |\n| 1876 | Alexander Graham Bell<br>貝爾：電話（蘇格蘭裔） |\n| 1928 | Alexander Fleming<br>弗萊明：盤尼西林 penicillin（蘇格蘭人） |\n| 1930s | Frank Whittle<br>惠特爾：噴射引擎 jet engine |\n| 1953 | Francis Crick<br>克里克：DNA 結構（同 James Watson 一齊發現） |\n| 1989 | Tim Berners-Lee<br>柏納斯-李：萬維網 World Wide Web |',
  6: '記憶法：\n| 日期 | 節日 |\n| 25/1 | Burns Night<br>彭斯之夜：紀念蘇格蘭詩人 Robert Burns |\n| 31/10 | Halloween<br>萬聖節前夕 |\n| 5/11 | Bonfire Night<br>篝火之夜：紀念 1605 年火藥陰謀（Gunpowder Plot）失敗 |\n| 11/11 | Remembrance Day<br>國殤紀念日：戴紅罌粟花 |\n| 26/12 | Boxing Day<br>節禮日：聖誕節翌日 |\n| 31/12 | Hogmanay<br>霍格莫尼：蘇格蘭除夕 |',
  7: '記憶法（英國重要戰役）：\n| 年份 | 戰役 / 結果 |\n| 9 世紀 | Alfred the Great vs Vikings<br>阿佛烈大帝統一盎格魯-撒克遜王國，打敗維京人 |\n| 1066 | Battle of Hastings vs Normandy<br>黑斯廷斯戰役：William of Normandy（諾曼第公爵威廉）打敗 Harold → 英格蘭戰敗，諾曼征服 |\n| 1314 | Battle of Bannockburn vs Scotland<br>班諾克本戰役：Robert the Bruce 打敗英格蘭 → 蘇格蘭保持獨立 |\n| 1588 | Spanish Armada vs Spain<br>西班牙無敵艦隊：Elizabeth I 年代英格蘭打敗西班牙 |\n| 1805 | Battle of Trafalgar vs France + Spain<br>特拉法加海戰：Admiral Nelson（納爾遜）打敗法西聯合艦隊，但陣亡 |\n| 1815 | Battle of Waterloo vs France<br>滑鐵盧戰役：Duke of Wellington（威靈頓公爵）打敗 Napoleon，英法最後一戰 |\n| 1940 | Battle of Britain vs Germany<br>不列顛戰役：皇家空軍擊退德國空襲 → 阻止德國入侵 |',
  8: '記憶法（二戰）：\n| 年份 | 事件 |\n| 1939 | 德國入侵 Poland（波蘭）<br>英法宣戰 |\n| 1940 | Winston Churchill（邱吉爾）做首相<br>Dunkirk（敦克爾克）大撤退、Battle of Britain（不列顛戰役） |\n| 1940–41 | the Blitz（倫敦大轟炸）<br>德國轟炸英國城市 |\n| 1944 | D-Day<br>諾曼第登陸 |\n| 1945 | 戰爭結束<br>VE Day（歐洲勝利日）8/5、VJ Day（對日勝利日）15/8 |',
  9: '記憶法（國王 vs 國會）：\n| 年份 | 事件 |\n| 1628 | Petition of Right<br>《權利請願書》：國王要國會同意先可以加稅 |\n| 1642–51 | Civil War<br>英格蘭內戰：Charles I（查理一世）vs 國會 |\n| 1649 | Charles I 被處決 → Commonwealth<br>共和國：Oliver Cromwell（克倫威爾）做 Lord Protector（護國公），到 1658 年 |\n| 1660 | Restoration<br>復辟：Charles II（查理二世）做國王 |\n| 1688 | Glorious Revolution<br>光榮革命：William of Orange（奧蘭治的威廉）取代 James II（詹姆士二世）→ 君主立憲 |',
  10: '記憶法：\n| 名勝 | 國家 | 地點 |\n| Lake District<br>英格蘭最大國家公園 | England | National Park |\n| Stonehenge<br>約 5,000 年前建成 | England | Wiltshire |\n| Eden Project<br>巨型溫室生態館 | England | Cornwall |\n| Glastonbury<br>音樂節 | England | Somerset |\n| Tate<br>Tate Britain、Tate Modern | England | London |\n| Ben Nevis<br>英國最高山 | Scotland | Highlands |\n| Loch Lomond & Trossachs<br>蘇格蘭國家公園 | Scotland | National Park |\n| Edinburgh Castle<br>愛丁堡城堡 | Scotland | Edinburgh |\n| National Galleries of Scotland<br>蘇格蘭國家美術館 | Scotland | Edinburgh |\n| Snowdonia<br>Snowdon 係威爾斯最高山 | Wales | National Park |\n| Giant\'s Causeway<br>火山熔岩形成嘅玄武岩柱 | N. Ireland | County Antrim |',
};
// spec question lists ("Exam e Qn"); ⑩ grouped as listed in the plan
const GROUP_QUESTIONS = {
  1: ['1.5', '2.16', '10.1', '11.10', '5.22', '7.16', '8.5', '8.23', '13.1', '14.1'],
  2: ['3.2', '3.16', '5.7', '6.5', '10.3'],
  3: ['2.17', '2.22', '3.17', '4.11', '9.9', '9.24', '4.2', '8.2', '8.13', '9.1', '9.20'],
  4: ['6.9', '7.18', '8.20', '9.19', '12.3', '13.8', '14.2', '4.21', '5.23'],
  5: ['1.21', '6.10', '8.7', '8.12', '9.11', '14.8'],
  6: ['2.15', '2.18', '6.17', '7.2', '9.8', '9.12', '10.5', '11.23', '12.20', '14.21', '16.18'],
  10: ['9.4', '13.2', '14.19', '4.19', '5.3', '11.22', '13.20', '12.7', '4.9', '10.2', '11.20', '8.8', '3.13', '4.15', '7.11', '7.19', '16.2'],
  7: ['1.12', '2.11', '4.1', '4.18', '6.12', '6.19', '7.6', '9.2', '9.21', '11.7', '12.4', '14.6', '16.13', '16.21', '17.13'],
  8: ['2.9', '2.24', '3.19', '4.23', '6.23', '8.1', '14.13', '15.23', '16.7'],
  9: ['1.23', '11.19', '15.3', '15.13', '15.17', '16.11', '13.6', '15.20'],
};
const GROUP_SIZES = { 1: 10, 2: 5, 3: 11, 4: 9, 5: 6, 6: 11, 10: 17, 7: 15, 8: 9, 9: 8 };
const TOTAL_TABLE_QUESTIONS = 101;
// lines kept above the heading (original note, or the E9 Q20 clarification); every other question has none
const PREFIXES = {
  '5.23': '而家叫做Senedd Cymru（威爾斯議會）',
  '13.6': '後來叫做「皇家橡樹」（Royal Oak）',
  '15.20': '1649年查理一世被處決之後克倫威爾掌權，到1658年去世（考試以官方手冊嘅講法為準；佢1653年先正式做護國公）',
  '17.13': '「呢個係英國人最輝煌嘅時刻」— 邱吉爾（Winston Churchill）',
  '9.4': '英格蘭最大國家公園',
  '14.19': '英格蘭威爾特郡，大約5,000年前建成',
  '5.3': '英格蘭西南部',
  '12.7': 'Tate Britain and Tate Modern（泰特不列顛同泰特現代）',
  '4.9': '英國最高山，海拔1,345米',
  '7.19': '玄武岩柱，大約5000萬年前由火山熔岩形成',
  '16.2': '大約5000萬年前由火山熔岩形成',
  '9.20': '題目嘅 Ireland 即係 N. Ireland（Shamrock 係成個愛爾蘭島嘅象徵）',
};
const isTableLine = l => l.trim().startsWith('|');
const tableRowsOf = text => text.split('\n').filter(isTableLine).map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
const expectedNote = key => (PREFIXES[key] ? PREFIXES[key] + '\n' : '') + NOTE_TABLES[groupOf(key)];
const groupOf = key => Object.keys(GROUP_QUESTIONS).find(g => GROUP_QUESTIONS[g].includes(key));
const questionAt = (EXAMS, key) => { const [e, n] = key.split('.').map(Number); return EXAMS[e][n - 1]; };

// ── B: data ──
function checkData() {
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'data', 'exams.js'), 'utf8');
  const EXAMS = new Function(src + ';return EXAMS;')();
  const sizes = Object.fromEntries(Object.entries(GROUP_QUESTIONS).map(([g, l]) => [g, l.length]));
  const all = Object.values(GROUP_QUESTIONS).flat();
  assert(JSON.stringify(sizes) === JSON.stringify(GROUP_SIZES) && all.length === TOTAL_TABLE_QUESTIONS && new Set(all).size === TOTAL_TABLE_QUESTIONS,
    `10 groups, ${TOTAL_TABLE_QUESTIONS} distinct questions: ${JSON.stringify(sizes)}`);
  for (const [g, keys] of Object.entries(GROUP_QUESTIONS)) {
    const bad = keys.filter(k => (questionAt(EXAMS, k).note || '') !== expectedNote(k));
    assert(bad.length === 0, `group ${g}: ${keys.length} notes = (prefix +) the spec table text (bad: ${bad.map(k => `E${k.replace('.', 'Q')} ${JSON.stringify(questionAt(EXAMS, k).note).slice(0, 80)}`).join(' | ')})`);
    const tails = new Set(keys.map(k => { const n = questionAt(EXAMS, k).note; return n.slice(n.indexOf('記憶法')); }));
    assert(tails.size === 1, `group ${g}: the note from the 記憶法 heading on is identical across its questions`);
  }
  const prefixed = all.filter(k => questionAt(EXAMS, k).note.indexOf('記憶法') > 0);
  assert(JSON.stringify(prefixed.sort()) === JSON.stringify(Object.keys(PREFIXES).sort()), `prefix lines only on the ${Object.keys(PREFIXES).length} spec questions: ${prefixed.join(', ')}`);
  // no other note in the bank uses the table syntax
  const withTable = Object.entries(EXAMS).flatMap(([e, qs]) => qs.map((q, i) => [`${e}.${i + 1}`, q.note || ''])).filter(([, n]) => n.split('\n').some(isTableLine)).map(([k]) => k);
  assert(withTable.length === TOTAL_TABLE_QUESTIONS && withTable.every(k => all.includes(k)), `exactly the ${TOTAL_TABLE_QUESTIONS} group notes carry table rows (${withTable.length})`);
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
  for (const [g, keys] of Object.entries(GROUP_QUESTIONS)) {
    const bad = [];
    for (const key of keys) {
      const r = await pg.evaluate(({ key, fitSrc }) => {
        const [e, n] = key.split('.').map(Number);
        pendingMode = 'practice'; startExam(e);
        state.current = state.questions.findIndex(q => q.examNum === e && q.origIdx === n - 1);
        if (state.current < 0) return { missing: true };
        renderQuestion(); selectOption(state.questions[state.current].a[0]);
        const box = document.getElementById('ansNote');
        return { visible: box.offsetParent !== null, rows: box.querySelectorAll('.note-table tr').length, fit: new Function('return ' + fitSrc)()(box) };
      }, { key, fitSrc: FIT_JS });
      if (r.missing || !r.visible || !r.rows || !fits(r.fit)) bad.push(`${key} ${JSON.stringify(r)}`);
    }
    assert(bad.length === 0, `Practice answer box, group ${g}: ${keys.length} tables fit 390px, no scroll (bad: ${bad.slice(0, 2).join(' | ')})`);
  }
}

async function checkResults(pg) {
  const bad = {}; let seen = 0;
  for (let e = 1; e <= 17; e++) {
    await pg.evaluate(e => { pendingMode = 'exam'; startExam(e); state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); finishExam(); }, e);
    const r = await pg.evaluate(fitSrc => {
      const fit = new Function('return ' + fitSrc)();
      return [...document.querySelectorAll('#reviewList .review-item')].map(it => {
        const q = state.questions[Number(it.id.slice(2))];
        return { key: `${q.examNum}.${q.origIdx + 1}`, fit: fit(it) };
      }).filter(x => x.fit.length);
    }, FIT_JS);
    for (const { key, fit } of r) {
      seen++;
      const g = groupOf(key) || 'none';
      if (!fits(fit) || fit.length !== 1 || g === 'none') (bad[g] = bad[g] || []).push(`${key} ${JSON.stringify(fit)}`);
    }
  }
  assert(seen === TOTAL_TABLE_QUESTIONS && Object.keys(bad).length === 0, `Results review: all ${seen} tables (10 groups) fit 390px, no scroll (bad: ${JSON.stringify(bad).slice(0, 300)})`);
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
  for (const g of Object.keys(NOTE_TABLES)) {
    const cards = r[g] || [], bad = cards.filter(c => !fits(c.fit));
    assert(cards.length > 0 && bad.length === 0, `Study 💡 記憶法 (opened), group ${g}: ${cards.length} cards, tables fit 390px, no scroll (bad: ${JSON.stringify(bad.slice(0, 2))})`);
  }
  assert(!r.undefined, 'Study: every table shown belongs to one of the 10 groups');
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
    host.innerHTML = noteHtml('| H | I |\n| a | b<br>c |\n| d | e |');
    const cs = sel => getComputedStyle(host.querySelector(sel));
    const tok = n => { const i = document.createElement('i'); i.style.color = `var(${n})`; host.appendChild(i); return getComputedStyle(i).color; };
    const fs = n => { const i = document.createElement('i'); i.style.fontSize = `var(${n})`; host.appendChild(i); return getComputedStyle(i).fontSize; };
    const out = {
      th: [cs('th').whiteSpace, cs('th').color, cs('th').borderBottomWidth, cs('th').borderBottomColor, cs('th').verticalAlign],
      td: [cs('tbody tr:first-child td:last-child').whiteSpace, cs('tbody td:not(.multi)').whiteSpace, cs('tbody td').verticalAlign],
      first: [cs('tbody td:first-child').color, cs('tbody td:first-child').fontWeight, cs('tbody tr:first-child td').borderBottomColor],
      last: cs('tbody tr:last-child td').borderBottomWidth,
      sub: [cs('.note-cell-sub').display, cs('.note-cell-sub').fontSize, cs('.note-cell-sub').fontWeight, cs('.note-cell-sub').color],
      wrap: cs('.note-table-wrap').overflowX,
      want: { navy: tok('--navy'), divider: tok('--divider'), muted: tok('--text-muted'), xs: fs('--fs-xs') },
    };
    host.remove();
    return out;
  });
  const w = look.want;
  assert(JSON.stringify(look.th) === JSON.stringify(['nowrap', w.navy, '2px', w.navy, 'top']) && JSON.stringify(look.td) === JSON.stringify(['normal', 'nowrap', 'top'])
    && JSON.stringify(look.first) === JSON.stringify([w.navy, '700', w.divider]) && look.last === '0px'
    && JSON.stringify(look.sub) === JSON.stringify(['block', w.xs, '400', w.muted]) && look.wrap === 'auto',
  'Theme B + V4 look: navy header + 2px navy rule, divider rows, last row no rule, navy bold first column, nowrap except td.multi, muted xs remarks: ' + JSON.stringify(look));
  await checkPractice(pg);
  await checkResults(pg);
  await checkStudy(pg);
  assert(errs.length === 0, 'no page errors: ' + errs.join('; '));
  await b.close();
  console.log('NOTE-TABLE PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
