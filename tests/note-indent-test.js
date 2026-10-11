// v1.0.10: memo v2 note layout (.proj-docs/plans/2026-10-11_memo-final-spec.json, mockups/memo-split-preview.html)
// A: a line with 8+ leading spaces and no marker = continuation line (.cont), its text lines up with the text after
//    the "→" of the sub item above it (5B 都鐸王朝)
// B: a "<br>" remark starting with "• " inside a table cell = .note-cell-sub.bullet, indented about one character
//    under the cell's main line, with a hanging indent so a wrapped line continues under its text (N20–N24)
// C: the real 5B note in the Practice answer box at 390px keeps that alignment
const { chromium } = require('playwright-core');
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const PX_TOLERANCE = 1;
const HOST_WIDTH_PX = 358; // 390px viewport minus the answer box padding
// 5B question (exam 1, 0-based index 5) and its two continuation lines
const TUDOR_EXAM = 1, TUDOR_INDEX = 5; // fixture key '1.5'
const TUDOR_CONT = ['York（約克）vs Lancaster（蘭開斯特）', 'Anne Boleyn（安妮·博林）｜第二任', 'Catherine Howard（凱瑟琳·霍華德）'];

// in the page: left x of the first / last rendered line of an element's text, and of the text after a marker span
const MEASURE_JS = `(() => {
  const rectsOf = node => { const r = document.createRange(); r.selectNodeContents(node); return [...r.getClientRects()].filter(x => x.width > 0); };
  const textNode = el => [...el.childNodes].reverse().find(n => n.nodeType === 3);
  const firstLeft = node => rectsOf(node)[0].left;
  const lastLeft = node => { const rs = rectsOf(node); return rs[rs.length - 1].left; };
  const lineCount = node => new Set(rectsOf(node).map(x => Math.round(x.top))).size;
  return { textNode, firstLeft, lastLeft, lineCount };
})()`;

async function checkLineUnit(pg) {
  const r = await pg.evaluate(() => {
    const cls = line => { const d = document.createElement('div'); d.innerHTML = noteLineHtml(line); return d.firstChild.className; };
    const text = line => { const d = document.createElement('div'); d.innerHTML = noteLineHtml(line); return d.firstChild.textContent; };
    return {
      cont8: cls('        York vs Lancaster'), cont10: cls('          deeper'), contText: text('        A <b> & B'),
      contHtml: noteLineHtml('        A <b> & B'),
      sub4: cls('    → item'), sub2: cls('  ◦ item'), subMark8: cls('        → still a sub'), note4: cls('    ※ remark'),
      seven: cls('       seven spaces'), bullet: cls('• item'), plain: cls('heading'),
    };
  });
  assert(r.cont8 === 'rv-note-line cont' && r.cont10 === 'rv-note-line cont', '8+ leading spaces, no marker → rv-note-line cont');
  assert(r.contText === 'A <b> & B' && r.contHtml === '<div class="rv-note-line cont" lang="zh-HK">A &lt;b&gt; &amp; B</div>', 'cont line: trimmed, escaped, no .note-mark: ' + r.contHtml);
  assert(r.subMark8 === 'rv-note-line sub' && r.sub4 === 'rv-note-line sub' && r.sub2 === 'rv-note-line sub' && r.note4 === 'rv-note-line sub' && r.seven === 'rv-note-line sub',
    'a marker, or fewer than 8 spaces, keeps the sub class: ' + JSON.stringify(r));
  assert(r.bullet === 'rv-note-line bullet' && r.plain === 'rv-note-line', 'bullet / plain lines unchanged');
}

async function checkLineLayout(pg) {
  const r = await pg.evaluate(({ measureSrc, width }) => {
    const m = new Function('return ' + measureSrc)();
    const host = document.createElement('div'); host.style.width = width + 'px'; document.body.appendChild(host);
    const longCont = '        ' + '玫瑰戰爭兩大家族嘅名字好長好長'.repeat(4);
    host.innerHTML = noteHtml(['• Henry VII', '    → 玫瑰戰爭：', '        York vs Lancaster', longCont].join('\n'));
    const [, sub, cont, long] = host.querySelectorAll('.rv-note-line');
    const out = {
      afterArrow: m.firstLeft(m.textNode(sub)), cont: m.firstLeft(m.textNode(cont)),
      longFirst: m.firstLeft(m.textNode(long)), longLast: m.lastLeft(m.textNode(long)), longLines: m.lineCount(m.textNode(long)),
      style: [getComputedStyle(cont).textIndent, getComputedStyle(cont).paddingLeft, getComputedStyle(sub).paddingLeft],
    };
    host.remove();
    return out;
  }, { measureSrc: MEASURE_JS, width: HOST_WIDTH_PX });
  assert(Math.abs(r.cont - r.afterArrow) <= PX_TOLERANCE, `cont text starts where the sub item's text after "→" starts (${r.cont} vs ${r.afterArrow})`);
  assert(r.longLines >= 2 && Math.abs(r.longFirst - r.afterArrow) <= PX_TOLERANCE && Math.abs(r.longLast - r.afterArrow) <= PX_TOLERANCE,
    `a wrapped cont line keeps every line at that x (${r.longLines} lines, ${r.longFirst} / ${r.longLast})`);
  assert(r.style[0] === '0px' && r.style[1] === r.style[2], 'cont: no text-indent, same padding as .sub: ' + JSON.stringify(r.style));
}

async function checkCellUnit(pg) {
  const r = await pg.evaluate(() => {
    const d = document.createElement('div');
    d.innerHTML = noteHtml('| # | 名稱 |\n| 1 | Council：<br>歐洲委員會<br>• 保障 <b>人權</b><br>•no space<br> • leading space |');
    const subs = [...d.querySelectorAll('.note-cell-sub')];
    return { cls: subs.map(s => s.className), text: subs.map(s => s.textContent), bold: d.querySelectorAll('b').length };
  });
  assert(JSON.stringify(r.cls) === JSON.stringify(['note-cell-sub', 'note-cell-sub bullet', 'note-cell-sub', 'note-cell-sub']),
    'a remark starting with "• " → note-cell-sub bullet; other remarks unchanged: ' + JSON.stringify(r.cls));
  assert(r.text[1] === '• 保障 <b>人權</b>' && r.bold === 0, 'bullet remark text is escaped and keeps its "•"');
}

async function checkCellLayout(pg) {
  const r = await pg.evaluate(({ measureSrc, width }) => {
    const m = new Function('return ' + measureSrc)();
    const host = document.createElement('div'); host.style.width = width + 'px'; document.body.appendChild(host);
    const long = '• ' + '保障歐洲人嘅基本權利同自由'.repeat(4);
    host.innerHTML = noteHtml(`| # | 名稱 / 註解 |\n| 1 | Council of Europe：<br>歐洲委員會<br>• 唔係 EU 機構<br>${long} |`);
    const cell = host.querySelector('td.multi');
    const [plain, bullet, longSub] = cell.querySelectorAll('.note-cell-sub');
    const em = parseFloat(getComputedStyle(bullet).fontSize);
    // text after "• ": the range starts after the marker and its space
    const afterMark = sub => { const t = sub.firstChild, rg = document.createRange(); rg.setStart(t, 2); rg.setEnd(t, 3); return rg.getClientRects()[0].left; };
    const out = {
      em, main: m.firstLeft(cell.firstChild), plain: m.firstLeft(plain), bullet: m.firstLeft(bullet), bulletText: afterMark(bullet),
      longLines: m.lineCount(longSub), longText: afterMark(longSub), longLast: m.lastLeft(longSub),
    };
    host.remove();
    return out;
  }, { measureSrc: MEASURE_JS, width: HOST_WIDTH_PX });
  const indent = r.bullet - r.plain;
  assert(Math.abs(r.plain - r.main) <= PX_TOLERANCE, `plain remark starts under the main line (${r.plain} vs ${r.main})`);
  assert(indent >= 0.8 * r.em && indent <= 1.0 * r.em, `"•" sits about one character (0.9em) right of a plain remark: ${indent.toFixed(1)}px, em ${r.em}`);
  assert(r.longLines >= 2 && Math.abs(r.longLast - r.longText) <= PX_TOLERANCE,
    `hanging indent: a wrapped bullet remark's next line starts under the text after "• " (${r.longLast} vs ${r.longText}, ${r.longLines} lines)`);
}

async function checkTudorPractice(pg) {
  const r = await pg.evaluate(({ e, idx, measureSrc }) => {
    const m = new Function('return ' + measureSrc)();
    pendingMode = 'practice'; startExam(e);
    state.current = state.questions.findIndex(q => q.examNum === e && q.origIdx === idx);
    if (state.current < 0) return { missing: true };
    renderQuestion(); state.questions[state.current].a.forEach(selectOption); // multi-answer: pick all to reveal
    const box = document.getElementById('ansNote');
    const lines = [...box.querySelectorAll('.rv-note-line')];
    const conts = lines.filter(l => l.classList.contains('cont'));
    return {
      contText: conts.map(c => c.textContent),
      pairs: conts.map(c => { const sub = lines[lines.indexOf(c) - 1].classList.contains('sub') ? lines[lines.indexOf(c) - 1] : lines[lines.indexOf(c) - 2];
        return [m.firstLeft(m.textNode(c)), m.firstLeft(m.textNode(sub))]; }),
      docW: document.documentElement.scrollWidth, vw: innerWidth,
    };
  }, { e: TUDOR_EXAM, idx: TUDOR_INDEX, measureSrc: MEASURE_JS });
  assert(!r.missing && JSON.stringify(r.contText) === JSON.stringify(TUDOR_CONT), '5B note in the Practice answer box: 3 cont lines: ' + JSON.stringify(r.contText));
  assert(r.pairs.every(([c, s]) => Math.abs(c - s) <= PX_TOLERANCE) && r.docW <= r.vw, `5B at 390px: every cont line lines up with the text after "→" above it: ${JSON.stringify(r.pairs)}`);
}

(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();
  await checkLineUnit(pg);
  await checkLineLayout(pg);
  await checkCellUnit(pg);
  await checkCellLayout(pg);
  await checkTudorPractice(pg);
  assert(errs.length === 0, 'no page errors: ' + errs.join('; '));
  await b.close();
  console.log('NOTE-INDENT PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
