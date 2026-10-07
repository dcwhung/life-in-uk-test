// S-053: checks that data/exams.js + data/study.js still hold what the approved yue batch tables say.
//   node tests/tools/check-batch-replay.js
//
// Manual, NOT part of tests/run-all.sh (every data edit outside Track 2 would otherwise need a batch record).
// Run it once after any yue / oy / note / fact yue change. For each field it takes the LAST `after` across
// .proj-docs/plans/2026-10-07_yue-batch-*.json (file order, then record order), skipping `userDecision: "keep"`
// records (batch 7 A6 / A9 / A10 were not applied), adds the fixes made outside any batch file
// (POST_BATCH_FIXES), and compares each one with the current data. Exit 1 on any mismatch.
const fs = require('fs');
const path = require('path');
const { loadData } = require('./make-content-baseline');

const PLAN_DIR = path.resolve(__dirname, '..', '..', '.proj-docs', 'plans');
const BATCH_FILE = /^2026-10-07_yue-batch-\d.*\.json$/;
const KEEP = 'keep';
const MAX_SHOWN = 120;

// fixes applied outside any batch JSON, replayed right after the named batch file (documented in yue-terms.md)
const POST_BATCH_FIXES = [
  // S-055 (R3): E7·Q12 shares its English question with E12·Q16 (batch 7 A16) -> identical yue
  { id: 'S-055', afterFile: '2026-10-07_yue-batch-7-antileak.json', exam: 7, qIndex: 11, field: 'yue',
    after: 'Chancellor of the Exchequer 嘅角色係乜嘢？' },
];

// one key per data field: a fact's yue, a question's yue / note, or one oy slot
const fieldKey = r => (r.factId !== undefined ? `fact #${r.factId} yue`
  : `Exam ${r.exam} · Q${r.qIndex + 1} ${r.field === 'oy' ? `oy[${r.optIndex}]` : r.field}`);

function currentValue(r, { EXAMS, STUDY }) {
  if (r.factId !== undefined) { const f = STUDY.find(x => x.id === r.factId); return f && f.yue; }
  const q = EXAMS[r.exam] && EXAMS[r.exam][r.qIndex];
  if (!q) return undefined;
  return r.field === 'oy' ? q.oy[r.optIndex] : q[r.field];
}

// Map fieldKey -> { record, source } holding the last applied `after` for every field
function expectedFields(files) {
  const expected = new Map();
  const stats = { records: 0, kept: 0 };
  const put = (r, source) => expected.set(fieldKey(r), { r, source });
  for (const file of files) {
    for (const r of JSON.parse(fs.readFileSync(path.join(PLAN_DIR, file), 'utf8'))) {
      stats.records++;
      if (r.userDecision === KEEP) { stats.kept++; continue; }
      put(r, file);
    }
    POST_BATCH_FIXES.filter(fix => fix.afterFile === file).forEach(fix => put(fix, fix.id));
  }
  return { expected, stats };
}

const show = v => (v === undefined ? '(missing)' : JSON.stringify(v));

function main() {
  const files = fs.readdirSync(PLAN_DIR).filter(f => BATCH_FILE.test(f)).sort();
  const missingFix = POST_BATCH_FIXES.filter(fix => !files.includes(fix.afterFile));
  const { expected, stats } = expectedFields(files);
  const data = loadData().values;
  const mismatches = [];
  for (const [key, { r, source }] of expected) {
    const now = currentValue(r, data);
    if (now !== r.after) mismatches.push(`${key} [${source}]\n      expected ${show(r.after)}\n      got      ${show(now)}`);
  }
  missingFix.forEach(fix => mismatches.push(`${fix.id}: batch file ${fix.afterFile} not found`));
  console.log(`batch files: ${files.length} (${files.join(', ')})`);
  console.log(`records: ${stats.records}, skipped keep: ${stats.kept}, post-batch fixes: ${POST_BATCH_FIXES.length}, fields checked: ${expected.size}`);
  mismatches.slice(0, MAX_SHOWN).forEach(m => console.log('  - ' + m));
  if (mismatches.length > MAX_SHOWN) console.log(`  ... and ${mismatches.length - MAX_SHOWN} more`);
  console.log(mismatches.length ? `BATCH-REPLAY FAIL: ${mismatches.length} mismatch(es)` : 'BATCH-REPLAY PASS: 0 mismatches');
  process.exit(mismatches.length ? 1 : 0);
}

main();
