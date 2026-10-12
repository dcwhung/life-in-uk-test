const { chromium } = require('playwright-core');
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
// v1.6.1 (user 2026-10-12, iPhone bug): the counts legend under the question dots wrapped as
// "Correct 0 | Wrong 0 | Unanswered 5 |" + "Flagged 0" alone. It is now always two fixed rows:
//   row 1 = Correct + Unanswered (exam quiz: Answered + Unanswered), row 2 = Wrong + Flagged (exam quiz: Flagged)
// Each row is one line, right-aligned, no separator at a row's start / end, no overflow — on the Practice quiz,
// the Exam quiz and the result screen, at 320 / 360 / 390px, en + zh-HK, small + large text.
const WIDTHS = [320, 360, 390];
const LANGS = ['en', 'zh-HK'];
const SIZES = ['small', 'large'];
// legend → expected label keys per row
const CASES = [
  { name: 'practice quiz', sel: '#dotsMeta', card: '.q-card', rows: [['correct', 'unanswered'], ['wrong', 'flagged']],
    open: () => { pendingMode = 'practice'; startExam('ch5'); state.current = 0; state.answers[0] = [...state.questions[0].a]; revealAnswer(); state.flags[3] = true; renderQuestion(); } },
  { name: 'exam quiz', sel: '#dotsMeta', card: '.q-card', rows: [['answered', 'unanswered'], ['flagged']],
    open: () => { pendingMode = 'exam'; startExam(4); state.answers[0] = [0]; state.flags[2] = true; renderQuestion(); } },
  { name: 'exam result', sel: '#resultDotsMeta', card: '.result-card', rows: [['correct', 'unanswered'], ['wrong', 'flagged']],
    open: () => {
      pendingMode = 'exam'; startExam(4);
      state.questions.forEach((q, i) => { if (i === 17) return; state.answers[i] = i % 4 === 2 ? [q.o.findIndex((_, k) => !q.a.includes(k))] : [...q.a]; });
      state.flags[1] = true; finishExam();
    } },
  { name: 'practice result', sel: '#resultDotsMeta', card: '.result-card', rows: [['correct', 'unanswered'], ['wrong', 'flagged']],
    open: () => { pendingMode = 'practice'; startExam('ch1'); state.current = 0; state.answers[0] = [...state.questions[0].a]; revealAnswer(); finishExam(); } },
];

(async () => {
  const b = await chromium.launch(launchOpts);
  const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); };
  let checks = 0;
  for (const lang of LANGS) for (const size of SIZES) {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(APP_URL);
    await pg.evaluate(({ lang, size }) => { localStorage.clear(); localStorage.setItem('lifeuk.uiLang', JSON.stringify(lang)); localStorage.setItem('lifeuk.fontSize', JSON.stringify(size)); }, { lang, size });
    await pg.reload();
    for (const c of CASES) {
      await pg.setViewportSize({ width: 390, height: 844 });
      await pg.evaluate(`(${c.open.toString()})()`);
      for (const w of WIDTHS) {
        await pg.setViewportSize({ width: w, height: 844 });
        const tag = `${c.name} ${lang} ${size} ${w}px`;
        const r = await pg.$eval(c.sel, (el, cardSel) => {
          const rows = [...el.children];
          const card = el.closest(cardSel), cs = getComputedStyle(card), cr = card.getBoundingClientRect();
          const contentRight = cr.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
          const er = el.getBoundingClientRect();
          return {
            doc: document.documentElement.scrollWidth, vw: innerWidth,
            rowCls: rows.map(r => r.className),
            // each entry: its <i> legend class (ok / bad / todo …) → label; separators kept to check the row ends
            items: rows.map(r => [...r.children].map(c => c.classList.contains('sep') ? '|' : c.querySelector('i')?.className)),
            texts: rows.map(r => r.textContent.replace(/\s+/g, ' ').trim()),
            oneLine: rows.map(r => new Set([...r.children].map(c => Math.round(c.getBoundingClientRect().top))).size === 1),
            rowTops: rows.map(r => Math.round(r.getBoundingClientRect().top)),
            rowRights: rows.map(r => r.getBoundingClientRect().right),
            rowFits: rows.every(r => r.scrollWidth <= r.clientWidth + 0.5),
            right: er.right, contentRight,
            maxChildRight: Math.max(...[...el.querySelectorAll('span')].map(s => s.getBoundingClientRect().right)),
          };
        }, c.card);
        const labels = await pg.evaluate(rows => rows.map(r => r.map(k => t('common.' + k))), c.rows);
        assert(r.rowCls.length === 2 && r.rowCls.every(x => x === 'lg-row'), `${tag}: two .lg-row rows: ` + JSON.stringify(r.rowCls));
        r.items.forEach((it, i) => {
          assert(it[0] !== '|' && it[it.length - 1] !== '|' && !it.join(',').includes('|,|'), `${tag}: row ${i + 1} has no dangling separator: ` + JSON.stringify(it));
          assert(it.filter(x => x !== '|').length === c.rows[i].length, `${tag}: row ${i + 1} entries: ` + JSON.stringify(it));
        });
        r.texts.forEach((txt, i) => {
          const want = new RegExp('^' + labels[i].map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\d+').join(' \\| ') + '$');
          assert(want.test(txt), `${tag}: row ${i + 1} text "${txt}" = ${labels[i].join(' | ')}`);
        });
        assert(r.oneLine.every(Boolean), `${tag}: each row on one line: ` + JSON.stringify(r.oneLine));
        assert(r.rowTops[1] > r.rowTops[0], `${tag}: row 2 below row 1: ` + r.rowTops);
        assert(r.rowRights.every(x => Math.abs(x - r.right) <= 1), `${tag}: rows right-aligned: ` + r.rowRights + ' / ' + r.right);
        assert(r.rowFits && r.maxChildRight <= r.contentRight + 0.5 && r.right <= r.contentRight + 0.5, `${tag}: legend inside the card: ${r.maxChildRight} / ${r.contentRight}`);
        assert(r.doc <= r.vw, `${tag}: no horizontal page scroll: ${r.doc} / ${r.vw}`);
        checks++;
      }
    }
    assert(errs.length === 0, 'no page errors: ' + errs.join('; '));
    await pg.close();
  }
  console.log(`ok: ${checks} legend states (4 screens × 3 widths × 2 languages × 2 text sizes): two rows, no dangling separator, no overflow`);
  await b.close();
  console.log('PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
