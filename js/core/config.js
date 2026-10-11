// ════════════════════════════════════════
// CONFIG — app-wide constants. sw.js loads this file with importScripts() to name its cache,
// so it must stay worker-safe: plain constants only, no DOM and no question data.
// ════════════════════════════════════════
const APP_VERSION = '1.1.0';

// ── modes and special set ids (state.examNum is 1..EXAM_COUNT or one of these) ──
const PRACTICE_MODE = 'practice';
const EXAM_MODE = 'exam';
const ALL_EXAM = 'all';
const SIMILAR_EXAM = 'similar';
const WRONG_EXAM = 'wrong';
const FLAGGED_EXAM = 'flagged';
const CHAPTER_PREFIX = 'ch';
const DIFFICULTY_PREFIX = 'd';
const FACT_PREFIX = 'f'; // + study fact id: that fact's source questions ('f21', a one-off session from Study)
const PLAN_PREFIX = 'p'; // + plan Day n: a study plan task's side session ('p8', isPlanExam)

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
const FACT_HIGHLIGHT_MS = REVIEW_HIGHLIGHT_MS; // Q8: Study fact card flash after ↩ Back from its session
// CUI-0011: a pointer click this soon after a click opened a new screen, near the same point, is the
// second tap of a double tap (actions.js ignores it); longer than a double tap, shorter than a
// deliberate next tap
const SCREEN_CHANGE_CLICK_GUARD_MS = 350;
const DOUBLE_TAP_SLOP_PX = 40; // ...and only near the point of that click (the second tap of a double tap)
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const LIST_SEP = ' · ';    // between parts of one line ("✓ Correct! · 🔥 1/3")
const ANSWER_SEP = ' | ';  // between the options of a multi-answer question
const COPY_SEP = ' = ';    // G40: between the copies of one question text ("E7·Q16 = E13·Q1")
const TOAST_MS = 2400; // how long a toast stays on screen (js/components/toast.js)

// ── study plan (js/domain/plan.js, planProgress.js) ──
// G19: the entry points (ⓘ switch, home card) show only while this is true (opened in v1.1.0, PR8); answer hooks
// ignore it. Setting it back to false hides the entry again without touching stored plans (rollback switch).
const STUDY_PLAN_READY = true;

// ── install banner (js/pwa/pwa.js) ──
// touch-first devices only: PC Chrome / Edge fire beforeinstallprompt too, but desktop install is not the target
const INSTALL_TOUCH_QUERY = '(pointer: coarse)';

// ── i18n (js/core/i18n.js; strings in locales/*.js) ──
const DEFAULT_LANG = 'en';   // also the fallback for keys a language lacks
const ZH_HK_LANG = 'zh-HK';  // v0.65: the other UI language (header pill toggles between the two)

// ── localStorage keys ──
// the origin (dcwhung.github.io) is shared with other apps, so every key carries our own prefix
const LS_PREFIX = 'lifeuk.';
const STREAK_LS = LS_PREFIX + 'practiceStreak';
const FLAGS_LS = LS_PREFIX + 'practiceFlags';
const WRONG_LS = LS_PREFIX + 'wrongList';
const COMPLETED_LS = LS_PREFIX + 'completedExams';
const HOME_PREFS_LS = LS_PREFIX + 'homePrefs';
const UI_LANG_LS = LS_PREFIX + 'uiLang';   // v0.59: UI language (v0.65: header pill)
const INSTALL_DISMISSED_LS = LS_PREFIX + 'installDismissed';   // v0.60: install banner closed with ✕ (never shown again)
// study plan: the switch (no value = on), the stored schedule, the per-day answer log; new keys, so no legacy names
const STUDY_PLAN_ENABLED_LS = LS_PREFIX + 'studyPlanEnabled';
const STUDY_PLAN_LS = LS_PREFIX + 'studyPlan';
const STUDY_PLAN_PROGRESS_LS = LS_PREFIX + 'studyPlanProgress';
// v1.0.4: the plan identity (planIdentity) whose schedule was already opened once: later opens fold its cards
const STUDY_PLAN_SEEN_LS = LS_PREFIX + 'studyPlanScheduleSeen';
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
// keys no version reads any more, removed on each load (reviewOrder: results-page sort chip, dropped in v0.53;
// lifeuk.studyPlanPreview: the G31 ?preview=plan flag, dropped at release in v1.1.0, G42)
const OBSOLETE_LS = ['reviewOrder', LS_PREFIX + 'studyPlanPreview'];
