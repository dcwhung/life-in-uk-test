// QA v1.1.5 data regression: origin/main (52fe830) vs HEAD (df1d798), EXAMS + STUDY deep field diff; expect only the 8 memo 4A notes,
// each exactly 「| 地區 |」 → 「| 國家 |」 + 「記憶法（地方議會）：」 → 「記憶法（四地議會）：」; fixture 4A text = HEAD note text; no 地區 left in 4A
// run from the repo root: node .proj-docs/qa/scripts/2026-10-11_qa-v115-data.js [base-ref]
const vm = require('vm'), fs = require('fs'), { execSync } = require('child_process');
const BASE = process.argv[2] || '52fe830';
const load = (src) => { const ctx = {}; vm.createContext(ctx); vm.runInContext(src + '\n;this.EXAMS = typeof EXAMS !== "undefined" ? EXAMS : undefined; this.STUDY = typeof STUDY !== "undefined" ? STUDY : undefined;', ctx); return ctx; };
const old = load(['exams', 'study'].map(f => execSync(`git show ${BASE}:data/${f}.js`).toString()).join('\n'));
const cur = load(['exams', 'study'].map(f => fs.readFileSync(`data/${f}.js`, 'utf8')).join('\n'));
const diffs = [];
const walk = (a, b, p) => {
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) { if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push({ p, a, b }); return; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], p + '.' + k);
};
walk(old.EXAMS, cur.EXAMS, 'EXAMS'); walk(old.STUDY, cur.STUDY, 'STUDY');
const KEYS = ['4.20', '5.22', '6.8', '7.17', '8.19', '9.18', '12.2', '13.7'];
const expect = new Set(KEYS.map(k => `EXAMS.${k}.note`));
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
ok(diffs.length === 8 && diffs.every(d => expect.has(d.p)), `diff count = ${diffs.length}: ${diffs.map(d => d.p).join(', ')}`);
ok(diffs.every(d => d.a.replace('| 地區 |', '| 國家 |').replace('記憶法（地方議會）：', '記憶法（四地議會）：') === d.b && d.a.split('地區').length === 2 && d.a.startsWith('記憶法（地方議會）：\n')), 'each diff = exactly 「| 地區 |」 → 「| 國家 |」 + title 地方議會 → 四地議會, nothing else');
const notes = KEYS.map(k => { const [e, i] = k.split('.').map(Number); return cur.EXAMS[e][i].note; });
ok(new Set(notes).size === 1 && !notes[0].includes('地區') && notes[0].startsWith('記憶法（四地議會）：\n| 國家 | 議會 / 地點 | 議員 |') && notes[0].split('地方議會').length === 2 && notes[0].includes('England 冇自己嘅地方議會'), '8 notes identical: title 四地議會, header 國家, no 地區, 地方議會 only in the England bullet');
const all = []; for (const e of Object.keys(cur.EXAMS)) cur.EXAMS[e].forEach((q, i) => { if ((q.note || '').includes('四地議會')) all.push(`${e}.${i}`); });
ok(JSON.stringify(all.sort()) === JSON.stringify([...KEYS].sort()), `四地議會 only in the 8 4A notes (${all.join(', ')})`);
const fx = JSON.parse(fs.readFileSync('tests/fixtures/memo-notes.json', 'utf8')).memos.find(m => m.id === '4A');
ok(JSON.stringify([...fx.questions].sort()) === JSON.stringify([...KEYS].sort()) && fx.text === notes[0], 'fixture 4A questions = 8 keys, text = HEAD note');
const other = []; for (const e of Object.keys(cur.EXAMS)) cur.EXAMS[e].forEach((q, i) => { if (!KEYS.includes(`${e}.${i}`) && (q.note || '').includes('Senedd') && (q.note || '').includes('| 地區 |')) other.push(`${e}.${i}`); });
ok(other.length === 0, `no other note with a 「| 地區 |」 devolved table (${other.join(', ')})`);
console.log(fail ? `DATA115 FAIL (${fail})` : 'DATA115 PASS'); process.exit(fail ? 1 : 0);
