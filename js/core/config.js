// ════════════════════════════════════════
// CONFIG — app-wide constants. sw.js loads this file with importScripts() to name its cache,
// so it must stay worker-safe: plain constants only, no DOM and no question data.
// ════════════════════════════════════════
const APP_VERSION = '0.59';

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
const DIFF_BAR_LOW_PCT = 60;   // results "By Difficulty" bar: red below this
const DIFF_BAR_MID_PCT = 80;   // gold below this, green from here
const REVIEW_HIGHLIGHT_MS = 1500;
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const LIST_SEP = ' · ';    // between parts of one line ("✓ Correct! · 🔥 1/3")
const ANSWER_SEP = ' | ';  // between the options of a multi-answer question

// ── install banner (js/pwa/pwa.js) ──
// touch-first devices only: PC Chrome / Edge fire beforeinstallprompt too, but desktop install is not the target
const INSTALL_TOUCH_QUERY = '(pointer: coarse)';

// ── i18n (js/core/i18n.js; strings in locales/*.js) ──
const DEFAULT_LANG = 'en';   // also the fallback for keys a language lacks

// ── localStorage keys ──
// the origin (dcwhung.github.io) is shared with other apps, so every key carries our own prefix
const LS_PREFIX = 'lifeuk.';
const STREAK_LS = LS_PREFIX + 'practiceStreak';
const FLAGS_LS = LS_PREFIX + 'practiceFlags';
const WRONG_LS = LS_PREFIX + 'wrongList';
const COMPLETED_LS = LS_PREFIX + 'completedExams';
const HOME_PREFS_LS = LS_PREFIX + 'homePrefs';
const UI_LANG_LS = LS_PREFIX + 'uiLang';   // v0.59: UI language (no switch shown yet)
const INSTALL_DISMISSED_KEY = LS_PREFIX + 'installDismissed';   // v0.60: install banner closed with ✕ (never shown again)
const STUDY_LS = {
  prefs: LS_PREFIX + 'studyPrefs',
  mastered: LS_PREFIX + 'studyMastered',
  bookmarks: LS_PREFIX + 'studyBookmarks',
};
// sessionStorage (same prefix): set by js/main.js once it has reloaded after a failed locale / i18n load
const I18N_RELOAD_SS = LS_PREFIX + 'i18nReloaded';
// v0.58: unprefixed keys from v0.57 and earlier → their prefixed home (moved lazily by js/core/utils.js)
const LEGACY_LS_MIGRATION = {
  practiceStreak: STREAK_LS,
  practiceFlags: FLAGS_LS,
  wrongList: WRONG_LS,
  completedExams: COMPLETED_LS,
  homePrefs: HOME_PREFS_LS,
  studyPrefs: STUDY_LS.prefs,
  studyMastered: STUDY_LS.mastered,
  studyBookmarks: STUDY_LS.bookmarks,
};
// written once every legacy key was moved with no fallback; until then a key present under both names is merged
const MIGRATED_LS = LS_PREFIX + 'migrated';
// new keys whose old key stayed in use (fallback) after a merge write failed: the old key holds the newer progress,
// so the next load merges with the old side winning; removed once the marker is written
const MIGRATE_FALLBACK_LS = LS_PREFIX + 'migrateFallback';
// object maps ("exam.idx" / fact id → record) merged per entry when both names exist; the rest (prefs) keep the new value
const MERGE_LS = [STREAK_LS, FLAGS_LS, WRONG_LS, COMPLETED_LS, STUDY_LS.mastered, STUDY_LS.bookmarks];
// keys no version reads any more (reviewOrder: results-page sort chip, dropped in v0.53)
const OBSOLETE_LS = ['reviewOrder'];
