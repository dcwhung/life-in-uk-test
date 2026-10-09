// ════════════════════════════════════════
// QUESTIONS — question pools, set ids and labels (derived from EXAMS / CHAPTERS)
// pool item = { q, examNum, origIdx } where q = EXAMS[examNum][origIdx]
// ════════════════════════════════════════
const EXAM_NUMBERS = Object.keys(EXAMS).map(Number);
const EXAM_COUNT = EXAM_NUMBERS.length;
const CHAPTER_NUMBERS = [...CHAPTERS];

// every question in exam order (Exam 1 Q1 … last exam's last question)
function allQuestions() {
  const out = [];
  EXAM_NUMBERS.forEach(examNum => EXAMS[examNum].forEach((q, origIdx) => out.push({ q, examNum, origIdx })));
  return out;
}
const TOTAL_QUESTIONS = allQuestions().length;
// difficulty levels present in the data (labels: locales data.difficulty)
const DIFF_LEVELS = [...new Set(allQuestions().map(({ q }) => q.d))].sort((a, b) => a - b);
const MAX_DIFFICULTY = Math.max(...DIFF_LEVELS); // stars shown out of this many
function examQuestions(n) { return allQuestions().filter(item => item.examNum === Number(n)); }
function chapterQuestions(ch) { return allQuestions().filter(({ q }) => q.ch === ch); }
function difficultyQuestions(level) { return allQuestions().filter(({ q }) => q.d === level); }
// "exam.idx" storage key of a pool item; questionByKey is its inverse
const qKey = q => q.examNum + '.' + q.origIdx;
function questionByKey(k) {
  const [examNum, origIdx] = k.split('.').map(Number);
  return { q: EXAMS[examNum][origIdx], examNum, origIdx };
}

// ── copies: the same English question text in several exams is one question (plan G4, G40) ──
// Single source for the plan's canonical keys, the merged source nodes and the streak sync (js/domain/mastery.js).
// A copy never crosses facts (tests/plan-test.js checks it), so a fact's src holds every copy of its questions.
function buildQuestionCopies() {
  const byText = {}, canon = {};
  allQuestions().forEach(({ q, examNum, origIdx }) => {
    const text = q.q.trim().toLowerCase(), key = qKey({ examNum, origIdx });
    (byText[text] = byText[text] || []).push(key); // exam order
    canon[key] = byText[text][0];
  });
  const copies = Object.fromEntries(Object.values(byText).map(keys => [keys[0], keys]));
  return { canon, copies };
}
const QUESTION_COPIES = buildQuestionCopies(); // { canon: "exam.idx" → first copy in exam order, copies: first → all }
function canonQuestionKey(k) { return QUESTION_COPIES.canon[k] || k; }
// every copy of k's question, k included, in exam order
function questionCopies(k) { return QUESTION_COPIES.copies[canonQuestionKey(k)] || [k]; }
// keys → one group per distinct question, in first-appearance order; a group holds its copies from keys, exam order
function questionGroups(keys) {
  const inKeys = new Set(keys);
  return [...new Set(keys.map(canonQuestionKey))].map(c => questionCopies(c).filter(k => inKeys.has(k)));
}
// W-046: one item per distinct question (a random copy of each), shuffled; a Practice round asks a text once,
// so the copies' synced streak moves at most once a round
function distinctQuestions(list) {
  const byCanon = new Map();
  shuffle(list).forEach(item => {
    const c = canonQuestionKey(qKey(item));
    if (!byCanon.has(c)) byCanon.set(c, item);
  });
  return [...byCanon.values()];
}

// ── set ids ──
function isChapterExam(examNum) { return typeof examNum === 'string' && examNum.startsWith(CHAPTER_PREFIX); }
function chapterOf(examNum) { return Number(examNum.slice(CHAPTER_PREFIX.length)); }
function isDifficultyExam(examNum) { return typeof examNum === 'string' && examNum.startsWith(DIFFICULTY_PREFIX); }
function difficultyOf(examNum) { return Number(examNum.slice(DIFFICULTY_PREFIX.length)); }
// 'f' + digits only: FLAGGED_EXAM ('flagged') starts with the same letter
function isFactExam(examNum) {
  return typeof examNum === 'string' && examNum.startsWith(FACT_PREFIX) && /^\d+$/.test(examNum.slice(FACT_PREFIX.length));
}
function factIdOf(examNum) { return Number(examNum.slice(FACT_PREFIX.length)); }
// a study plan task session: 'p' + its Day n (like isFactExam, digits only)
function isPlanExam(examNum) {
  return typeof examNum === 'string' && examNum.startsWith(PLAN_PREFIX) && /^\d+$/.test(examNum.slice(PLAN_PREFIX.length));
}
function planDayOf(examNum) { return Number(examNum.slice(PLAN_PREFIX.length)); }
// W-016: a fact set is named by its Study card's chapter number (chapterFactNumber), never the global id
function factSetParams(examNum) {
  const id = factIdOf(examNum);
  const fact = STUDY.find(f => f.id === id);
  return { ch: fact.ch, n: chapterFactNumber(id) };
}
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

const SET_LABEL_KEYS = { [SIMILAR_EXAM]: 'common.similarSet', [WRONG_EXAM]: 'common.wrongSet', [FLAGGED_EXAM]: 'common.flaggedSet' };
function difficultyLabel(level) { return t(`data.difficulty.${level}`); }
function examLabel(examNum) {
  if (isRandomExam(examNum)) return t('common.randomExam');
  if (examNum === ALL_EXAM) return t('common.allExams');
  if (isChapterExam(examNum)) return t('common.chapterN', { n: chapterOf(examNum) });
  if (isFactExam(examNum)) return t('common.factSet', factSetParams(examNum));
  if (isPlanExam(examNum)) return t('plan.dayN', { n: planDayOf(examNum) });
  if (isDifficultyExam(examNum)) {
    const lv = difficultyOf(examNum);
    return '★'.repeat(lv) + ' ' + difficultyLabel(lv);
  }
  const setLabelKey = SET_LABEL_KEYS[examNum];
  return setLabelKey ? t(setLabelKey) : t('common.examN', { n: examNum });
}
