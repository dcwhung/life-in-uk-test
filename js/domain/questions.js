// ════════════════════════════════════════
// QUESTIONS — question pools, set ids and labels (derived from EXAMS / CHAPTERS)
// pool item = { q, examNum, origIdx } where q = EXAMS[examNum][origIdx]
// ════════════════════════════════════════
const EXAM_NUMBERS = Object.keys(EXAMS).map(Number);
const EXAM_COUNT = EXAM_NUMBERS.length;
const CHAPTER_NUMBERS = Object.keys(CHAPTERS).map(Number);
const DIFF_LABELS = { 1: 'Easy', 2: 'Basic', 3: 'Medium', 4: 'Hard', 5: 'Expert' };
const DIFF_LEVELS = Object.keys(DIFF_LABELS).map(Number);
const CHAPTER_SHORT = {
  1: 'Values & principles',
  2: 'What is the UK?',
  3: 'History',
  4: 'Modern society',
  5: 'Government & law',
};

// every question in exam order (Exam 1 Q1 … last exam's last question)
function allQuestions() {
  const out = [];
  EXAM_NUMBERS.forEach(examNum => EXAMS[examNum].forEach((q, origIdx) => out.push({ q, examNum, origIdx })));
  return out;
}
const TOTAL_QUESTIONS = allQuestions().length;
function examQuestions(n) { return allQuestions().filter(item => item.examNum === Number(n)); }
function chapterQuestions(ch) { return allQuestions().filter(({ q }) => q.ch === ch); }
function difficultyQuestions(level) { return allQuestions().filter(({ q }) => q.d === level); }
function questionByKey(k) {
  const [examNum, origIdx] = k.split('.').map(Number);
  return { q: EXAMS[examNum][origIdx], examNum, origIdx };
}

// ── set ids ──
function isChapterExam(examNum) { return typeof examNum === 'string' && examNum.startsWith(CHAPTER_PREFIX); }
function chapterOf(examNum) { return Number(examNum.slice(CHAPTER_PREFIX.length)); }
function isDifficultyExam(examNum) { return typeof examNum === 'string' && examNum.startsWith(DIFFICULTY_PREFIX); }
function difficultyOf(examNum) { return Number(examNum.slice(DIFFICULTY_PREFIX.length)); }
// Exam 1–17 (Exam mode or Practice > By Exam) — the only sets shaped like the real test
function isNumberedExam(examNum) { return typeof examNum === 'number'; }
// exam mode › All Exams = Random Exam: RANDOM_EXAM_SIZE questions drawn from all, at most one per study fact
function isRandomExam(examNum) { return examNum === ALL_EXAM && state.mode === EXAM_MODE; }
function isReviewSet(examNum) { return examNum === WRONG_EXAM || examNum === FLAGGED_EXAM; }
function reviewSetPool(examNum) {
  return keysOf(examNum === WRONG_EXAM ? wrongList : practiceFlags).map(questionByKey);
}

function poolFor(examNum) {
  if (isReviewSet(examNum)) return reviewSetPool(examNum);
  if (examNum === ALL_EXAM) return allQuestions();
  if (isChapterExam(examNum)) return chapterQuestions(chapterOf(examNum));
  if (isDifficultyExam(examNum)) return difficultyQuestions(difficultyOf(examNum));
  return examQuestions(examNum);
}

function randomExamPick(pool) {
  const usedFacts = new Set();
  const picked = [];
  for (const item of shuffle(pool)) {
    const fact = FACT_BY_QKEY[qKey(item)];
    const factId = fact ? fact.id : qKey(item);
    if (usedFacts.has(factId)) continue;
    usedFacts.add(factId);
    picked.push(item);
    if (picked.length === RANDOM_EXAM_SIZE) break;
  }
  return picked;
}

const SET_LABELS = { [SIMILAR_EXAM]: 'Similar Questions', [WRONG_EXAM]: 'Wrong answers', [FLAGGED_EXAM]: 'Flagged' };
function examLabel(examNum) {
  if (isRandomExam(examNum)) return 'Random Exam';
  if (examNum === ALL_EXAM) return 'All Exams';
  if (isChapterExam(examNum)) return `Chapter ${chapterOf(examNum)}`;
  if (isDifficultyExam(examNum)) {
    const lv = difficultyOf(examNum);
    return '★'.repeat(lv) + ' ' + DIFF_LABELS[lv];
  }
  return SET_LABELS[examNum] || `Exam ${examNum}`;
}
