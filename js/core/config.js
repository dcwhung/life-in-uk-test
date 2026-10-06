// ════════════════════════════════════════
// CONFIG — app-wide constants. sw.js loads this file with importScripts() to name its cache,
// so it must stay worker-safe: plain constants only, no DOM and no question data.
// ════════════════════════════════════════
const APP_VERSION = '0.57';

// ── modes and special set ids (state.examNum is 1..EXAM_COUNT or one of these) ──
const PRACTICE_MODE = 'practice';
const EXAM_MODE = 'exam';
const ALL_EXAM = 'all';
const SIMILAR_EXAM = 'similar';
const WRONG_EXAM = 'wrong';
const FLAGGED_EXAM = 'flagged';
const CHAPTER_PREFIX = 'ch';
const DIFFICULTY_PREFIX = 'd';

// ── practice ──
const MASTERY_STREAK = 3;
const PRACTICE_ROUND_MAX = 24; // distinct questions drawn per practice round (same as the real test)

// ── exam ──
const REAL_TEST_SIZE = 24;
const PASS_RATIO = 0.75;
const RANDOM_EXAM_SIZE = 24;
const EXAM_MINUTES = 45;
const EXAM_WARN_SECONDS = 5 * 60;
const EXAM_TICK_MS = 1000;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;

// ── display ──
const PERCENT = 100;
const MAX_DIFFICULTY = 5;
const DIFF_BAR_LOW_PCT = 60;   // results "By Difficulty" bar: red below this
const DIFF_BAR_MID_PCT = 80;   // gold below this, green from here
const REVIEW_HIGHLIGHT_MS = 1500;
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ── localStorage keys ──
const STREAK_LS = 'practiceStreak';
const FLAGS_LS = 'practiceFlags';
const WRONG_LS = 'wrongList';
const COMPLETED_LS = 'completedExams';
const HOME_PREFS_LS = 'homePrefs';
const STUDY_LS = { prefs: 'studyPrefs', mastered: 'studyMastered', bookmarks: 'studyBookmarks' };
