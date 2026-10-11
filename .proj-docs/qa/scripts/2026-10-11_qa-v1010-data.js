// QA v1.0.10 data checks: spec match, only `note` changed vs origin/main, Q1 (N8a / N8b), old 4 text memos unchanged,
// v2 line-format integrity (cont lines sit under a sub / cont line, cell "• " remarks well-formed)
// run from the repo root: node .proj-docs/qa/scripts/2026-10-11_qa-v1010-data.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const load = src => new Function(src + ';return EXAMS;')();
const HEAD = load(fs.readFileSync(path.join(ROOT, 'data/exams.js'), 'utf8'));
const MAIN = load(execSync('git show origin/main:data/exams.js', { cwd: ROOT, maxBuffer: 1 << 26 }).toString());
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, '.proj-docs/plans/2026-10-11_memo-final-spec.json'), 'utf8'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; console.log('FAIL:', m); } };
const q = (E, k) => { const [e, i] = k.split('.').map(Number); return E[e][i]; };

// 1. spec notes letter for letter; only `note` changed
const keys = [];
for (const e of Object.keys(HEAD)) HEAD[e].forEach((_, i) => keys.push(`${e}.${i}`));
ok(keys.length === 408, 'question count 408: ' + keys.length);
const specBad = Object.entries(SPEC.notes).filter(([k, n]) => q(HEAD, k).note !== n).map(([k]) => k);
ok(Object.keys(SPEC.notes).length === 375 && specBad.length === 0, 'all 375 spec notes match HEAD: bad=' + specBad);
const otherFieldDiff = keys.filter(k => { const a = { ...q(HEAD, k) }, b = { ...q(MAIN, k) }; delete a.note; delete b.note; return JSON.stringify(a) !== JSON.stringify(b); });
ok(otherFieldDiff.length === 0, 'no field other than note changed vs origin/main: ' + otherFieldDiff);
const changed = keys.filter(k => q(HEAD, k).note !== q(MAIN, k).note);
const extra = changed.filter(k => !(k in SPEC.notes)).sort();
ok(JSON.stringify(extra) === JSON.stringify(['12.18', '12.5', '3.13', '9.14']), 'changed outside spec notes = the 4 spec-base questions: ' + extra);
const untouchedOther = SPEC.untouched.filter(k => !['3.13', '9.14', '12.5', '12.18'].includes(k) && q(HEAD, k).note !== q(MAIN, k).note);
ok(untouchedOther.length === 0, `the other ${SPEC.untouched.length - 4} untouched questions keep the main note`);

// 2. Q1
const n8a = ['8.15', '14.23', '16.18'].map(k => q(HEAD, k).note);
ok(n8a.every(n => n === n8a[0]) && n8a[0].includes('記憶法（19 世紀事件）') && n8a[0].includes('| 1807 |'), '8.15 / 14.23 / 16.18 share the identical N8a note (19 世紀事件, has 1807)');
const memo = id => SPEC.memos.find(m => m.id === id);
ok(memo('N8a').questions.includes('8.15') && !memo('N8b').questions.includes('8.15'), 'spec: 8.15 listed under N8a, not N8b');
const n8b = memo('N8b').questions.map(k => q(HEAD, k).note);
ok(n8b.every(n => n.includes('記憶法（19 世紀人物）') && !n.includes('1807') && !n.includes('Wilberforce')), 'N8b notes (' + memo('N8b').questions + ') have no 1807 / Wilberforce');
ok(SPEC.memos.every(m => m.questions.every(k => q(HEAD, k).note.endsWith(m.text))), 'every spec memo text is the tail of each of its questions\' note');

// 3. old 4 text memos (note-text-test groups, 1-based) unchanged vs main
const OLD = { 'Magna Carta': [[4, 17], [6, 7], [7, 15], [8, 14], [12, 24], [15, 7], [16, 17], [17, 22]], '國會選舉': [[3, 12], [4, 4], [6, 16], [7, 14]],
  '戴卓爾夫人': [[1, 9], [11, 8], [17, 5]], '陪審員': [[1, 14], [1, 15], [5, 6]] };
for (const [name, qs] of Object.entries(OLD)) {
  const same = qs.every(([e, n]) => HEAD[e][n - 1].note === MAIN[e][n - 1].note);
  const one = new Set(qs.map(([e, n]) => HEAD[e][n - 1].note)).size === 1;
  ok(same && one, `old memo ${name}: ${qs.length} notes unchanged vs main and identical within the group`);
}

// 4. line-format integrity
let cont = 0, orphan = [], oddWs = [], cellBullets = 0, badCell = [], trailing = [];
for (const k of keys) {
  const lines = (q(HEAD, k).note || '').split('\n');
  lines.forEach((l, i) => {
    if (/[ \t]$/.test(l)) trailing.push(k);
    if (/^\s*[\t　 ]/.test(l)) oddWs.push(k + ':' + i);
    if (/^\s{8,}/.test(l) && !/^\s*[•◦→]/.test(l)) {
      cont++;
      const prev = lines[i - 1] || '';
      if (!(/^\s{2,}[•◦→]/.test(prev) || (/^\s{8,}/.test(prev) && !/^\s*[•◦→]/.test(prev)))) orphan.push(k + ':' + i);
    }
    if (/^\s*\|/.test(l)) l.split('|').forEach(cell => cell.split('<br>').slice(1).forEach(r => {
      if (r.trim().startsWith('•')) { if (/^• \S/.test(r)) cellBullets++; else badCell.push(k + ':' + JSON.stringify(r)); }
    }));
  });
}
ok(cont === 18, 'cont lines in data: ' + cont);
ok(orphan.length === 0, 'every cont line sits right under a sub ("    →") or another cont line: ' + orphan);
ok(oddWs.length === 0 && trailing.length === 0, 'no tab / U+3000 / nbsp leading indent, no trailing whitespace');
ok(badCell.length === 0 && cellBullets > 0, `cell "• " remarks well-formed (${cellBullets}), malformed: ` + badCell);
console.log(`DATA ${fail ? 'FAIL' : 'PASS'} ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
