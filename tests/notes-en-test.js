// English notes (v2.2.0): data/notesEn.js + data/memo.js titleEn / hookEn + localNote / factMemory (js/domain/similar.js).
// Node only, like memo-domain-test: the app's classic scripts run in one vm context; getLang is stubbed (no i18n.js).
// Fails when a Cantonese note changes without its English part (or the other way round), so the two never drift.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const APP_FILES = [
  'data/exams.js', 'data/study.js', 'data/memo.js', 'data/notesEn.js', 'js/core/config.js', 'js/core/utils.js', 'js/core/store.js',
  'js/domain/questions.js', 'js/domain/mastery.js', 'js/domain/similar.js', 'js/domain/plan.js', 'js/domain/planProgress.js',
  'js/domain/memo.js',
];
const ZH_TITLE_RE = /^記憶法（([^）]+)）：$/;
const EN_TITLE_RE = /^Memory aid \((.+)\):$/;
// CJK ideographs and the full-width punctuation the Cantonese notes use: none may be left in an English text
const CJK_RE = /[㐀-鿿！-？、-】]/;
const TABLE_ROW_RE = /^\s*\|/;
const LEAD_RE = /^(\s*[•◦→]?)/;

let asserts = 0;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); asserts++; };
const ok = m => console.log('ok:', m);

let lang = 'en';
const context = vm.createContext({ console, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, getLang: () => lang });
APP_FILES.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), context, { filename: f }));
const run = code => vm.runInContext(code, context);

const notes = [...new Set(run('allQuestions()').map(item => item.q.note).filter(Boolean))];
const parts = [...new Set(notes.flatMap(note => run('noteParts')(note)))];
const NOTES_EN = run('NOTES_EN'), GROUPS = run('MEMO_GROUPS');
const titleEnOf = Object.fromEntries(GROUPS.map(g => [g.title, g.titleEn]));
const cells = row => row.trim().replace(/^\||\|$/g, '').split('|').length;
const lead = line => line.match(LEAD_RE)[1];

try {
  // ── coverage: every note part has an English text, and no English text is left over ──
  const missing = parts.filter(p => !NOTES_EN[p]);
  assert(!missing.length, `every note part is translated (${missing.length} missing): ` + missing.map(p => p.split('\n')[0]).join(' / '));
  const stale = Object.keys(NOTES_EN).filter(k => !parts.includes(k));
  assert(!stale.length, `no stale English note (${stale.length}): ` + stale.map(k => k.split('\n')[0]).join(' / '));
  ok(`${parts.length} note parts of ${notes.length} notes translated, none stale`);

  // ── shape: line for line like the Cantonese (tables, bullets, indents, blank lines, memo heading) ──
  parts.forEach(zh => {
    const en = NOTES_EN[zh], zl = zh.split('\n'), el = en.split('\n');
    const at = zl[0].slice(0, 40);
    assert(zl.length === el.length, `${at}: ${el.length} English lines, ${zl.length} Cantonese`);
    zl.forEach((z, i) => {
      const e = el[i];
      assert(!z.trim() === !e.trim(), `${at} line ${i + 1}: blank in one language only`);
      assert(TABLE_ROW_RE.test(z) === TABLE_ROW_RE.test(e), `${at} line ${i + 1}: table row in one language only`);
      if (TABLE_ROW_RE.test(z)) assert(cells(z) === cells(e), `${at} line ${i + 1}: ${cells(e)} cells, ${cells(z)} in Cantonese`);
      else assert(lead(z) === lead(e), `${at} line ${i + 1}: marker / indent ${JSON.stringify(lead(e))}, ${JSON.stringify(lead(z))} in Cantonese`);
      assert(!CJK_RE.test(e), `${at} line ${i + 1}: Chinese left in the English: ${e}`);
    });
    const title = (zl[0].match(ZH_TITLE_RE) || [])[1];
    if (title) assert((el[0].match(EN_TITLE_RE) || [])[1] === titleEnOf[title], `${at}: heading "Memory aid (${titleEnOf[title]}):", got ${el[0]}`);
  });
  ok('English notes keep every line, table row / cell, bullet / indent and memo heading; no Chinese left');

  // ── data/memo.js: an English title for every group, a hook where the Cantonese has one ──
  GROUPS.forEach(g => {
    assert(g.titleEn && !CJK_RE.test(g.titleEn), `${g.id}: English title ${g.titleEn}`);
    assert(!g.hook === !g.hookEn, `${g.id}: English hook only where the Cantonese has one`);
    assert(!CJK_RE.test(g.hookEn || ''), `${g.id}: no Chinese in the English hook`);
  });
  ok(`${GROUPS.length} groups: titleEn on each, hookEn where hook`);

  // ── localNote / factMemory / memoLocal follow the UI language ──
  const split = notes.find(n => run('noteParts')(n).length === 2);
  lang = 'en';
  const en = run('localNote')(split);
  assert(en.lang === 'en' && en.text === run('noteParts')(split).map(p => NOTES_EN[p]).join('\n'), 'English UI: the English parts joined');
  const fact = run('STUDY').find(f => run('factMemory')(f));
  const memEn = run('factMemory')(fact);
  assert(memEn.lang === 'en' && !EN_TITLE_RE.test(memEn.text.split('\n')[0]) && !CJK_RE.test(memEn.text), 'English UI: a fact memory aid in English, without its heading');
  assert(run('memoLocal')(GROUPS[0]).title === GROUPS[0].titleEn, 'English UI: memo group title in English');
  lang = 'zh-HK';
  assert(run('localNote')(split).text === split && run('localNote')(split).lang === 'zh-HK', 'zh-HK UI: the Cantonese note');
  assert(run('factMemory')(fact).lang === 'zh-HK' && run('memoLocal')(GROUPS[0]).title === GROUPS[0].title, 'zh-HK UI: Cantonese memory aid and title');
  ok('localNote / factMemory / memoLocal follow the UI language');

  console.log(`NOTES-EN PASS (${asserts} checks)`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
