// Note text guard: the 4 text memory notes tidied in .proj-docs/plans/2026-10-10_handoff_note-text-cleanup.md §2
// (Magna Carta / 國會選舉 / 戴卓爾夫人 / 陪審員) must match the user-confirmed wording letter for letter,
// and every question in a group must share the identical note (a drifted copy would show a stale mnemonic).
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXAMS = new Function(fs.readFileSync(path.join(ROOT, 'data', 'exams.js'), 'utf8') + ';return EXAMS;')();
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

// [exam, question number (1-based)] pairs per group, as listed in the handoff §2
const GROUPS = [
  {
    name: 'Magna Carta',
    questions: [[4, 17], [6, 7], [7, 15], [8, 14], [12, 24], [15, 7], [16, 17], [17, 22]],
    note: [
      '記憶法（Magna Carta，大憲章）：',
      '• 1215 → King John（約翰王）簽署；',
      '• 重點 → 冇人凌駕法律之上，國王都唔例外；',
      '• 影響 → 限制國王權力，奠定法治（rule of law）基礎。',
    ].join('\n'),
  },
  {
    name: '國會選舉',
    questions: [[3, 12], [4, 4], [6, 16], [7, 14]],
    note: [
      '記憶法（國會選舉）：',
      '• 選區（constituency）→ 650 個 = 下議院 MP 數目，每區選 1 位；',
      '• 大選（general election）→ 5 年一次；',
      '• 補選（by-election）→ MP 中途去世或者辭職。',
    ].join('\n'),
  },
  {
    name: '戴卓爾夫人',
    questions: [[1, 9], [11, 8], [17, 5]],
    note: [
      '記憶法（Margaret Thatcher，戴卓爾夫人）：',
      '• 1979–1990 → 任期 11 年；',
      '• 第一 → 英國第一位女首相；',
      '• 最長 → 20 世紀任期最長嘅首相。',
    ].join('\n'),
  },
  {
    name: '陪審員',
    questions: [[1, 14], [1, 15], [5, 6]],
    note: [
      '記憶法（陪審員 juror）：',
      '• 年齡 → 18 至 70 歲；',
      '• 來源 → 選民登記冊（electoral register）；',
      '• 方式 → 隨機抽選。',
    ].join('\n'),
  },
];

const noteOf = ([exam, qNo]) => {
  const q = (EXAMS[exam] || [])[qNo - 1];
  return q ? q.note : undefined;
};

for (const g of GROUPS) {
  const notes = g.questions.map(noteOf);
  assert(new Set(notes).size === 1, `${g.name}: all ${g.questions.length} questions share one identical note`);
  g.questions.forEach((key, i) => {
    assert(notes[i] === g.note, `${g.name}: Exam ${key[0]} Q${key[1]} note matches the confirmed text`);
  });
  // the new note is used by exactly these questions, no more (no stray copy elsewhere)
  const users = Object.entries(EXAMS).flatMap(([ex, qs]) => qs.flatMap((q, i) => q.note === g.note ? [`${ex}:${i + 1}`] : []));
  assert(users.length === g.questions.length, `${g.name}: note used by exactly ${g.questions.length} questions (got ${users.length})`);
}
console.log('NOTE-TEXT PASS');
