// Content guard (Track 2, T-101): a Cantonese rewrite may only touch exams yue / oy / note and study fact yue.
// Compares every protected field of data/exams.js + data/study.js against the committed fixture
// tests/fixtures/content-baseline.json (not git history: origin/main moves and shallow clones lack old commits).
// Regenerate the fixture ONLY for an intentional English / structural change: node tests/tools/make-content-baseline.js
const fs = require('fs');
const { loadData, project, BASELINE } = require('./tools/make-content-baseline');

const MAX_REPORTED = 40;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
const show = v => { const s = JSON.stringify(v); return s === undefined ? '(missing)' : s.length > 120 ? s.slice(0, 117) + '...' : s; };

// recursive diff -> ['path: expected X, got Y', ...]
function diff(expected, actual, at, out) {
  const bothObjects = expected && actual && typeof expected === 'object' && typeof actual === 'object';
  if (!bothObjects || Array.isArray(expected) !== Array.isArray(actual)) {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) out.push(`${at}: expected ${show(expected)}, got ${show(actual)}`);
    return out;
  }
  if (Array.isArray(expected) && expected.length !== actual.length) out.push(`${at}.length: expected ${expected.length}, got ${actual.length}`);
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const k of keys) diff(expected[k], actual[k], Array.isArray(expected) ? `${at}[${k}]` : `${at}.${k}`, out);
  return out;
}

// readable location for one question / fact: "Exam 3 · Q7 (index 6)" / "fact #12 (index 11)"
const questionLabel = (exam, i) => `Exam ${exam} · Q${i + 1} (index ${i})`;
const factLabel = (f, i) => `fact #${f && f.id} (index ${i})`;

function examProblems(base, now) {
  const out = [];
  diff(Object.keys(base), Object.keys(now), 'exam numbers', out);
  for (const [exam, qs] of Object.entries(base)) {
    const cur = now[exam] || [];
    if (cur.length !== qs.length) out.push(`Exam ${exam}: expected ${qs.length} questions, got ${cur.length}`);
    qs.forEach((q, i) => diff(q, cur[i], questionLabel(exam, i), out));
  }
  return out;
}

function factProblems(base, now) {
  const out = [];
  if (now.length !== base.length) out.push(`study: expected ${base.length} facts, got ${now.length}`);
  base.forEach((f, i) => diff(f, now[i], factLabel(f, i), out));
  return out;
}

// raw-data rules the projection alone cannot phrase clearly
function shapeProblems(EXAMS, STUDY) {
  const out = [];
  for (const [exam, qs] of Object.entries(EXAMS)) qs.forEach((q, i) => {
    if (!Array.isArray(q.oy) || q.oy.length !== q.o.length) out.push(`${questionLabel(exam, i)}.oy: length ${q.oy && q.oy.length} !== o.length ${q.o.length}`);
    else q.oy.forEach((y, k) => { if (typeof y !== 'string') out.push(`${questionLabel(exam, i)}.oy[${k}]: not a string`); });
    if (typeof q.note !== 'string') out.push(`${questionLabel(exam, i)}.note: not a string`);
  });
  STUDY.forEach((f, i) => { if (typeof f.yue !== 'string') out.push(`${factLabel(f, i)}.yue: not a string`); });
  return out;
}

// R3 (yue-terms.md): the same English question reads the same in Cantonese wherever it appears
function sameQuestionProblems(EXAMS) {
  const byQuestion = new Map();
  Object.entries(EXAMS).forEach(([exam, qs]) => qs.forEach((q, i) => {
    const key = q.q.trim().toLowerCase();
    if (!byQuestion.has(key)) byQuestion.set(key, []);
    byQuestion.get(key).push({ at: questionLabel(exam, i), yue: q.yue });
  }));
  return [...byQuestion.values()]
    .filter(group => new Set(group.map(g => g.yue)).size > 1)
    .map(group => group.map(g => `${g.at}: ${show(g.yue)}`).join(' / '));
}

function report(title, problems) {
  if (!problems.length) return;
  console.log(`\n${title}: ${problems.length} difference(s)`);
  problems.slice(0, MAX_REPORTED).forEach(p => console.log('  - ' + p));
  if (problems.length > MAX_REPORTED) console.log(`  ... and ${problems.length - MAX_REPORTED} more`);
  console.log('  (only exams yue / oy / note and study fact yue may change; an _oyShape / _yueNonEmpty / _has* line means a');
  console.log('   translation slot was emptied, filled where it was "", or a key was added / removed)');
}

const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
const data = loadData();
const now = project(data);
const { EXAMS, STUDY } = data.values;
const count = exams => Object.values(exams).reduce((s, qs) => s + qs.length, 0);

const problems = {
  'top-level names': diff(base.globals, now.globals, 'globals', []),
  'exams (protected fields)': examProblems(base.exams, now.exams),
  'study facts (protected fields)': factProblems(base.facts, now.facts),
  'other data (CHAPTERS, ...)': diff(base.other, now.other, 'other', []),
  'translation shape': shapeProblems(EXAMS, STUDY),
};
Object.entries(problems).forEach(([title, list]) => report(title, list));

assert(problems['top-level names'].length === 0, 'data files declare the same top-level names: ' + Object.values(now.globals).flat().join(', '));
assert(count(now.exams) === count(base.exams) && Object.keys(now.exams).length === Object.keys(base.exams).length,
  `same exams / question count: ${Object.keys(now.exams).length} exams, ${count(now.exams)} questions`);
assert(now.facts.length === base.facts.length, `same fact count: ${now.facts.length}`);
assert(problems['exams (protected fields)'].length === 0, 'exams: every field except yue / oy / note unchanged, same order; oy slots keep their empty / filled shape');
assert(problems['study facts (protected fields)'].length === 0, 'study: every fact field except yue unchanged, same order; yue still non-empty');
assert(problems['other data (CHAPTERS, ...)'].length === 0, 'other data unchanged: ' + Object.keys(now.other).join(', '));
const sameQuestion = sameQuestionProblems(EXAMS);
report('same English question, different yue (R3)', sameQuestion);
assert(sameQuestion.length === 0, 'R3: identical English questions have identical yue');
assert(problems['translation shape'].length === 0, 'oy.length === o.length, oy / note / fact yue are strings');
console.log('CONTENT-GUARD PASS');
