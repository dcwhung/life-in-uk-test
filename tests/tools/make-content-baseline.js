// Writes tests/fixtures/content-baseline.json: every PROTECTED field of data/exams.js and data/study.js.
//   node tests/tools/make-content-baseline.js
//
// ONLY re-run this when the English content (or structure: ids, ch, d, src, answers, ordering, counts)
// is changed on purpose, and commit the new fixture in the same commit as that change.
// Do NOT re-run it to make tests/content-guard-test.js pass after a Cantonese rewrite: the guard exists
// so that a yue / oy / note rewrite (Track 2) cannot silently touch anything else.
//
// What is free to change (not stored verbatim):
//   exams: yue, oy, note        -> stored only as shape (yue non-empty, oy slot non-empty per option, note key present)
//   study: fact yue             -> stored only as "was non-empty"
// Everything else is stored verbatim, plus the list of top-level names each data file declares.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_FILES = ['data/exams.js', 'data/study.js'];
const BASELINE = path.join(ROOT, 'tests', 'fixtures', 'content-baseline.json');
const EXAM_FREE = ['yue', 'oy', 'note'];
const FACT_FREE = ['yue'];

// top-level `const X =` / `let` / `var` / `function` names, in file order
const topLevelNames = src => [...src.matchAll(/^(?:const|let|var|function)\s+(\w+)/gm)].map(m => m[1]);

// data files are classic scripts with top-level `const`, which never becomes a context property,
// so the names are returned explicitly from the script's completion value
function loadData() {
  const globals = {}, values = {};
  for (const file of DATA_FILES) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const names = topLevelNames(src);
    globals[file] = names;
    Object.assign(values, vm.runInNewContext(`${src}\n;({ ${names.join(', ')} })`, {}, { filename: file }));
  }
  return { globals, values };
}

const omit = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
const nonEmpty = v => typeof v === 'string' && v.length > 0;

function projectQuestion(q) {
  return {
    ...omit(q, EXAM_FREE),
    _hasYue: 'yue' in q,
    _yueNonEmpty: nonEmpty(q.yue),
    _hasOy: 'oy' in q,
    _oyShape: Array.isArray(q.oy) ? q.oy.map(nonEmpty) : null, // length + which slots hold a translation
    _hasNote: 'note' in q,
  };
}

function projectFact(f) {
  return { ...omit(f, FACT_FREE), _hasYue: 'yue' in f, _yueNonEmpty: nonEmpty(f.yue) };
}

// any other top-level data (CHAPTERS, future tables) is protected verbatim
function project({ globals, values }) {
  const { EXAMS, STUDY, ...rest } = values;
  const exams = Object.fromEntries(Object.entries(EXAMS).map(([n, qs]) => [n, qs.map(projectQuestion)]));
  return { globals, exams, facts: STUDY.map(projectFact), other: rest };
}

// one question / fact per line, so a fixture change reviews as a readable line diff
function format({ globals, exams, facts, other }) {
  const rows = list => list.map(x => '  ' + JSON.stringify(x)).join(',\n');
  const examBlocks = Object.entries(exams).map(([n, qs]) => ` ${JSON.stringify(n)}: [\n${rows(qs)}\n ]`).join(',\n');
  return `{\n"globals": ${JSON.stringify(globals)},\n"other": ${JSON.stringify(other)},\n` +
    `"exams": {\n${examBlocks}\n},\n"facts": [\n${rows(facts)}\n]\n}\n`;
}

module.exports = { loadData, project, BASELINE, EXAM_FREE, FACT_FREE };

if (require.main === module) {
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  const snapshot = project(loadData());
  fs.writeFileSync(BASELINE, format(snapshot));
  const nq = Object.values(snapshot.exams).reduce((s, qs) => s + qs.length, 0);
  console.log(`wrote ${path.relative(ROOT, BASELINE)}: ${Object.keys(snapshot.exams).length} exams, ${nq} questions, ${snapshot.facts.length} facts`);
}
