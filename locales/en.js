// ════════════════════════════════════════
// LOCALE: en — every UI string (read through t() / data-i18n, js/core/i18n.js).
// Wording follows the glossary in HANDOFF.md › i18n. "{name}" = parameter; { one, other } = plural on {n};
// keys ending in "Html" hold markup. Question / fact content (data/*.js) is not here.
// A new language: locales/<code>.js with LOCALES.<code> = { … } (same keys; missing ones fall back to en).
// ════════════════════════════════════════
const LOCALES = {};

LOCALES.en = {
  app: {
    title: 'Life in the UK Test · Exam Practice',
    description: '480+ practice questions · Cantonese translations · Works offline｜480+ 條模擬試題 · 廣東話翻譯 · 離線可用', // v2.6.0: the link preview line, one for both languages (index.html meta)
    shortName: 'Life in UK',
    // manifest.webmanifest is static JSON: these mirror its name / short_name (tests/pwa-test.js keeps them equal)
    installName: 'Life in the UK Test',
    installShortName: 'Life in UK',
    name: 'Life in the UK Test',
    sub: 'Exam Practice',
    about: 'About this app',
    infoIntro: '{n} official-style questions, with Cantonese translations and notes.',
    infoExams: { one: '📋 {n} Exam', other: '📋 {n} Exams' },
    infoChapters: { one: '📚 {n} Chapter', other: '📚 {n} Chapters' },
    infoQuestions: { one: '❓ {n} Q', other: '❓ {n} Qs' },
    infoQuestionsLabel: { one: '{n} question', other: '{n} questions' }, // what a screen reader says for the short "Qs" badge
    infoOffline: '🔒 Works Offline',
    // v2.5.0: the ⓘ row that replays the first-run intro
    introReplay: 'Replay intro',
    introReplaySub: 'A 3-page tour of studying, practice and the study plan',
    introReplayPlay: 'Play ›',
    installTitle: 'Install for offline use',
    installText: 'Add to home screen to study without internet',
    installButton: 'Install',
    installDismiss: 'Dismiss',
    // header pill: names the language it switches to (the CJK 中 is whitelisted in tests/i18n-test.js)
    // v1.2.0: ⚙ settings popover (the language options name themselves in their own language)
    settings: 'Settings',
    share: 'Share',
    shareText: '480+ practice questions · Cantonese translations · Works offline',
    shareCopied: 'Link copied',
    shareFailed: 'Copy this link: {url}',
    language: 'Language',
    fontSize: 'Text size', // v1.3.0: the ⚙ text size row; each A is named for screen readers
    fontSmall: 'Small text',
    fontLarge: 'Large text',
    langEn: 'EN',
    langZh: '中文',
    // ⚙ settings popover (v1.2.0; ⓘ before) "Features" section: the study plan switch, an On / Off pill after its name, then the note
    features: 'Features',
    planFeature: '🗓️ Study plan',
    planOnPill: 'On',
    planOffPill: 'Off',
    planOnNote: 'Now showing on the home screen',
    planOffNote: 'All plan items are now hidden',
    planSwitchLabel: 'Study plan feature',
    // v1.4.0: the Cantonese translation switch (same On / Off pill words as the plan row: app.planOnPill / planOffPill)
    translationFeature: '🌐 Translation',
    introTranslationFeature: 'Translation', // v2.7.0 (user): the intro's settings row has no icon
    translationOnNote: 'Cantonese shown with questions, answers and facts',
    translationOffNote: 'All Cantonese translations are hidden',
    translationSwitchLabel: 'Cantonese translation',
    // v1.4.1: toast after the switch (like plan.toastOn / plan.toastOff)
    translationToastOn: 'Cantonese translation turned on',
    translationToastOff: 'Cantonese translation turned off',
    // v2.3.0: the memory-note study mode switch (same On / Off pill words as the plan row)
    memoFeature: '🧠 Memory study mode',
    memoOnNote: 'The Memory tab shows on the Study screen',
    memoOffNote: 'The Memory tab is hidden; your progress is kept',
    memoSwitchLabel: 'Memory study mode',
    memoToastOn: 'Memory study mode turned on',
    memoToastOff: 'Memory study mode turned off',
  },

  home: {
    chooseMode: 'Choose Mode',
    modeStudy: 'Study',
    modePractice: 'Practice',
    modeExam: 'Exam',
    practiceDescHtml: '<strong>Practice</strong> — See the answer and Cantonese translation immediately after each question. Pick a set by difficulty, chapter or exam; each shows how much you have mastered.',
    // W-058: translation switched off (v1.4.0)
    practiceDescNoYueHtml: '<strong>Practice</strong> — See the answer immediately after each question. Pick a set by difficulty, chapter or exam; each shows how much you have mastered.',
    examDescHtml: '<strong>Exam</strong> — Answer all {n} questions like the real test; you can go back and change answers. Submit on the last question to see your score and answers.',
    myReview: 'My Review',
    practiceBy: 'Practice By',
    tabDifficulty: 'Difficulty',
    tabChapter: 'Chapter',
    tabExam: 'Exam',
    selectExam: 'Select Exam',
    allExams: '📝 All Questions ({n})',
    randomExam: '🎲 Random Exam',
    randomExamSub: { one: '{n} question from {total}', other: '{n} questions from {total}' },
    practiceHintHtml: '<ul><li>Each round draws up to <b>{max}</b> unmastered questions, each asked once</li><li>Answer a question correctly <b>{streak} times in a row</b> to master it</li><li>Unmastered questions come back in the next round</li><li>Mastered questions are skipped until the whole set is mastered</li></ul>',
    resetProgress: 'Reset progress', // v1.6.1: controls carry line icons, never glyphs (icons.js iconLabelHtml)
    examResetHint: 'Completed exams are marked with ✓.',
    resetCompleted: 'Reset completed exams',
    wrongTitle: 'Wrong answers',
    wrongEmpty: 'Nothing to review yet',
    flaggedTitle: 'Flagged',
    flaggedEmptyHtml: 'Tap {icon} on a question to flag it',
    myReviewNote: 'From Practice and Exam; cleared once you get them right here. Up to {max} per round.',
  },

  quiz: {
    questionOf: 'Question {n} of {total}',
    questionOfShort: 'Question {n}/{total}', // C3 (v1.3.0): only where questionOf would wrap
    questionOfTiny: 'Q {n}/{total}', // v2.0.5 C3: only where questionOfShort would wrap too
    allShuffled: 'All Questions (shuffled)',
    answerTab: 'Answer', // v2.0.0 desktop: the right column's tab beside Similar Questions (F5)
    translate: 'Translate',
    hideTranslation: 'Hide translation', // the pressed button's accessible name and tooltip
    hideShort: 'Hide', // v2.0.5 C3: the pressed button's visible words, short so the question row keeps one line
    previous: 'Previous',
    // v1.6.1: the bottom button's words and the quick button's name (the icons are line icons, no glyph in the words)
    next: 'Next',
    back: 'Back',
    finish: 'Finish',
    prevButton: 'Prev',
    // v2.1.1: the quiz / Result header's back button mid-session, named after where it goes (words only: the chevron
    // is a line icon, sideSession.js setEntryBack)
    backToStudy: 'Study',
    backToFlagged: 'Flagged',
    backToQuestion: 'Q{n}', // W-074: short enough for a 320px large-text header; the words are the label below
    backToQuestionLabel: 'Back to Q{n}',
    correct: '✓ Correct!',
    wrong: '✗ Wrong',
    yueQ: 'Q)',
    yueA: 'A)',
    roundNoteWrong: 'Round 1 of {rounds} · {n} of your {total} wrong answers',
    roundNoteFlagged: 'Round 1 of {rounds} · {n} of your {total} flagged questions',
  },

  exam: {
    submit: 'Submit',
    timer: '⏱ {time}',
    timeUp: '⏱ Time\'s up — your exam was submitted automatically.',
  },

  result: {
    passed: '🎉 PASSED',
    needsImprovement: '📚 NEEDS IMPROVEMENT',
    passNeeded: 'You need {mark}/{size} ({pct}%) to pass the real test.',
    passThreshold: '{pct}% pass threshold. You scored {score}%.',
    byDifficulty: 'By Difficulty',
    reviewAnswers: 'Review Answers',
    retry: 'Retry',
    anotherExam: 'Another Exam',
    anotherPractice: 'Another Practice',
    clearedNote: 'Cleared {n} from your wrong answers · {left} left',
    masteredNote: 'Mastered {n} more this round · {mastered}/{total} in {set}',
  },

  review: {
    filterAll: 'All',
    filterWrong: 'Wrong',
    filterFlagged: 'Flagged',
    yourAnswer: 'Your answer: {answer}',
    noAnswer: 'No answer',
  },

  similar: {
    title: 'Similar Questions',
    subtitle: 'Same fact, asked differently',
    coreFact: '📌 Core Fact', // followed by study.chapterFactId
    appearsIn: 'Appears in:',
    node: 'E{exam}·Q{n}',
    legendCurrent: 'This question',
    legendInProgress: 'In progress',
    // one similar question reads "this one" ("these 1" was CUI-0007)
    practise: { one: 'Practise this one', other: 'Practise these {n}' },
  },

  flagged: {
    title: 'Flagged',
    practise: 'Practise flagged ({n})',
    practiseSub: 'Each question once · up to {max} per round',
    empty: 'No flagged questions left.',
  },

  study: {
    title: '📖 Study',
    search: 'Search facts', // R2-1: never mentions English / Cantonese (matching still covers both)
    tabChapters: 'Chapters', // v1.2.0 (C4): the tab icon sits above the label in index.html
    tabTimeline: 'Timeline',
    tabGeo: 'Geo', // v1.6.0: short, as in the memo mockup v2 (deleted), so five tabs fit one row at 360px
    tabPeople: 'People',
    tabMemo: 'Memory', // v1.6.0: memory-note groups (memo.*)
    hideMastered: 'Hide mastered',
    bookmarkedOnly: 'Bookmarked only',
    warsOnly: '⚔️ Wars only',
    all: 'All',
    count: { one: '{shown} / {total} fact', other: '{shown} / {total} facts' },
    empty: 'No facts match.',
    chapterTitle: 'Chapter {n}: {title}',
    yearBC: '{n} BC',
    war: '⚔️ War / battle',
    bookmark: 'Bookmark',
    mastered: 'Mastered',
    masteredDerived: '🏆 Mastered — every source question mastered',
    memoryAid: '💡 Memory aid', // v2.2.0: the English UI shows the English memory notes (data/notesEn.js)
    progress: '🏆 {n} / {total}', // v1.2.0 (Q11): the words are the pill's tooltip / label
    progressLabel: '{n} of {total} facts mastered',
    // the fact's number within its chapter (chapterFactNumber); no UI text shows the global fact id (W-016)
    factId: '#{n}',
    // S-057: English in every language, like common.chapterShort
    chapterFactId: 'Ch {ch} #{n}',
  },

  // v1.6.0: memory-note study (Study tab 5, js/screens/memo.js). Group titles, hooks and notes are Cantonese data
  memo: {
    search: 'Search memory notes',
    count: { one: '{shown} / {total} group', other: '{shown} / {total} groups' },
    empty: 'No groups match.',
    dueTitle: { one: '{n} group to review today', other: '{n} groups to review today' },
    start: 'Start',
    statusNew: 'New',
    statusDue: 'Due today',
    statusLearning: '{name}', // v2.4.3 (user): the mastery name alone, no "in N days"
    statusDone: '{name}',
    questions: { one: '{n} question', other: '{n} questions' },
    singleMeta: 'Questions with their own note',
    setLabel: '🧠 {title}', // quiz header of a group's test
    backButton: 'Memory',
    stepLook: '① Look',
    stepTest: '② Test ({n})',
    stepLookDone: '✓ Look',
    stepTestDone: '✓ Test {correct}/{total}',
    hookLabel: '💡 Memory hook:',
    startTest: 'Got it — start the test',
    resultPass: 'Test {correct}/{total} (≥ {pct}%) → up to Lv{lv} {name}',
    resultKeep: 'Test {correct}/{total} (≥ {pct}%) → stays at Lv{lv} {name}',
    resultFail: 'Test {correct}/{total} · below {pct}%',
    resultFailDrop: 'Test {correct}/{total} · below {pct}%, down to Lv{lv} {name}', // W-064: a fail drops a level
    // v2.4.2: when the group comes back, and what each level means (mastery)
    nextDue: { one: '📅 Next review in {n} day ({date})', other: '📅 Next review in {n} days ({date})' },
    nextDueTomorrow: '📅 Next review tomorrow ({date})',
    date: '{d}/{m}',
    lvName0: 'Not yet',
    lvName1: 'Started',
    lvName2: 'Familiar',
    lvName3: 'Known',
    noAnswers: 'No answers were recorded — nothing changed.', // S-232: skipped questions do not count
    tomorrow: 'Tomorrow', // W-065: the schedule box of the level due again tomorrow
    lv: 'Lv{lv}',
    days: { one: '{n} day', other: '{n} days' }, // not read since v2.4.2; kept for an HTTP-cached pre-v2.4.2 memo.js (W-077)
    wrongTitle: 'Look at these again:',
    // v2.4.0 (decision log Q3): the result with nothing wrong shows the hook again; a group without a hook shows its
    // memory note (the single-note group: its notes)
    hookAgain: 'All correct 🎉 The memory hook once more:',
    noteAgain: 'All correct 🎉 The notes once more:',
    again: 'Review again',
    next: 'Next: {title}',
  },

  // v2.5.0 loading splash (js/components/splash.js): status lines take turns, tips are facts from the handbook
  splash: {
    loading: 'Loading',
    status1: 'Loading questions…',
    status2: 'Preparing fact cards…',
    status3: 'Setting up your plan…',
    tipLabel: 'Tip',
    tip1: 'The real test has 24 questions in 45 minutes. You need 18 correct (75%) to pass.',
    tip2: 'The UK is made up of England, Scotland, Wales and Northern Ireland.',
    tip3: 'Magna Carta was signed in 1215 and limited the power of the king.',
    tip4: 'Parliament has two houses: the House of Commons and the House of Lords.',
    tip5: 'Questions you get wrong go to Wrong answers under My Review automatically.',
  },

  // v2.5.0 first-run intro (js/screens/intro.js; mockup mockups/v2.2.0/intro-b-cards.html)
  intro: {
    dialog: 'Welcome to the app',
    step: '{n} / {total}',
    skip: 'Skip',
    next: 'Next',
    start: 'Start now',
    makePlan: 'Make a study plan',
    back: 'Back', // a replay from ⓘ ends with this instead of the two ways in
    study: {
      kicker: 'Study',
      title: 'Want the background first? Start with the facts',
      body: 'Everyone studies differently. To build a solid base, read the fact cards in five modes: Chapters, Timeline, Geo, People and Memory. Difficulty stars and bookmarks keep you on the key points.',
      chipBackground: 'Background',
      chipModes: '5 study modes',
      chipStars: 'Difficulty stars',
      chipBookmarks: 'Bookmarks',
      factQ: 'When was Magna Carta signed?',
      factA: '1215: it limited the power of the king',
      memoLv: 'Memory Lv2',
    },
    practice: {
      kicker: 'Practice · Mock exam',
      title: 'Drill questions? Sit full papers?',
      body: 'To drill questions, practise with instant answers and see every similar question in one view; anything you get wrong goes to wrong answer review. To sit full papers, take a mock exam or a random exam, timed like the real test.',
    },
    plan: {
      kicker: 'Study plan · Cantonese translation',
      title: 'Plan it, pass first time',
      body: 'Enter your test date and level to get a study strategy and use your time well. With Cantonese translation, the key points are easy to learn and remember, so you can pass first time.',
      countdown: 'Test in',
      days: 'days',
      strategy: 'Strategy · Intermediate',
      today: 'Today',
      task1: 'Study Ch 2 · 15 min',
      task2: 'Practise 20 questions',
      task3: '3 memory sets',
      streak: '4-day streak',
    },
  },

  modal: {
    submitTitle: 'Submit exam?',
    submitUnanswered: { one: '{n} question unanswered', other: '{n} questions unanswered' },
    submitFlagged: '{n} flagged',
    submitCheck: 'You can still go back and check them.',
    submitCancel: 'Keep going',
    leaveTitle: 'Leave the exam?',
    leaveMessage: 'Your answers will be lost.',
    leaveOk: 'Leave',
    leaveCancel: 'Cancel',
    resetProgressTitle: 'Reset practice progress?',
    resetProgressMessage: 'Mastery streaks, wrong answers and flags will be cleared.',
    resetCompletedTitle: 'Reset completed exams?',
    resetCompletedMessage: 'All ✓ completed marks will be cleared.',
    resetOk: 'Reset',
    resetCancel: 'Keep',
    // G15: turning the study plan off leaves its screens; the plan and progress stay
    planOffTitle: 'Turn off the study plan?',
    planOffMessage: "All study plan features will be hidden, and you'll leave the study plan screens. Your plan and progress will be kept, so you can carry on where you left off when you turn it back on.",
    planOffOk: 'Confirm',
    planOffCancel: 'Cancel',
    // v2.3.0: memory-note study mode off from the group screen or a group's test
    memoOffTitle: 'Turn off memory study mode?',
    memoOffMessage: "This test won't be recorded. Your memory progress will be kept, so you can carry on when you turn it back on.",
    memoOffOk: 'Confirm',
    memoOffCancel: 'Cancel',
    // "↺ Reset plan" on the schedule: deletes the plan and its log only
    planResetTitle: 'Reset the study plan?',
    planResetMessage: "This plan and its daily progress will be deleted and can't be restored, but you can create a new one afterwards.\nYour study and practice records (mastery, wrong answers, flags) are not affected.",
    planResetOk: 'Confirm',
    planResetCancel: 'Cancel',
  },

  common: {
    homeLabel: 'Home', // v1.2.0 (Q11): the 🏠 icon button's name
    practice: 'Practice',
    exam: 'Exam',
    examN: 'Exam {n}',
    allExams: 'All Questions',
    randomExam: 'Random Exam',
    chapterN: 'Chapter {n}',
    chapterShort: 'Ch {n}',
    similarSet: 'Similar Questions',
    factSet: 'Fact Ch {ch} #{n}', // W-016: "Ch {ch} #{n}" as study.chapterFactId; the quiz header gives it lang="en"
    wrongSet: 'Wrong answers',
    flaggedSet: 'Flagged',
    questionN: 'Question {n}',
    questionRef: 'Exam {exam} · Q{n}',
    correct: 'Correct',
    wrong: 'Wrong',
    answered: 'Answered',
    unanswered: 'Unanswered',
    flagged: 'Flagged',
    flagForReview: 'Flag for review',
    unflag: 'Unflag',
    mastered: '🏆 Mastered',
    streak: '🔥 {n}/{max}',
    difficultyTitle: 'Difficulty {d}/{max}',
    // Cantonese section labels stay in Chinese in en (whitelisted in tests/i18n-test.js)
    yueTitle: '【廣東話翻譯】',
    noteLabel: '💡 Note:', // v2.2.0: the English UI shows the English notes (data/notesEn.js)
  },

  plan: {
    dayN: 'Day {n}', // a plan task session's header (Day n stays English, as the mockup)
    // Home: the dashed "create" card (no plan) and the plan card (Day n / N stays English: lang="en")
    createTitle: 'Create a study plan',
    createText: "Tell us your exam date and how much time you have each day, and we'll build an exam strategy that sets out what to study and practise each day.",
    createGo: 'Create',
    cardTitle: '🗓️ Study plan',
    // toast after the ⚙ switch (v1.2.0; ⓘ before)
    toastOff: 'Study plan turned off',
    toastOn: 'Study plan turned on: carry on where you left off',
    toastReset: 'Study plan reset: you can build a new one',
    dayOf: 'Day {n} / {total}',
    daysLeft: { one: '{n} day to the exam · {date}', other: '{n} days to the exam · {date}' },
    // Home plan card (handoff §2.1): today's % + next step, the exam day, "plan finished" (G16)
    home: {
      pctLabel: "Today's progress",
      nextHtml: 'Next: <b>{task}</b>{more}',
      nextCarryHtml: 'Next (catch-up, {day}): <b>{task}</b>{more}',
      resumeFact: ' (continue from #{n})',
      resumeQs: ' ({done} / {total} right)',
      seeTomorrow: 'See you tomorrow', // v1.5.1: all done today (the ring shows ✓)
      continue: 'Continue',
      // v2.0.0 F7 desktop card (mockup desktop-home-plan.html): its ring shows the %, so the done line keeps the ✓;
      // the wider card keeps the long Continue label (v2.0.2: the → is a line icon, planHome.js)
      doneHtml: '<b>✓ Done for today</b>, see you tomorrow',
      continueToday: "Continue today's tasks",
      viewToday: "View today's tasks",
      viewDay: 'View today',
      restToday: 'Rest day today',
      notStarted: 'The plan starts on {date}',
      examDayText: "🎯 It's exam day today, good luck!",
      endedTitle: 'Plan complete. Well done for all your hard work!',
      endedSummary: 'Average {avg}% · {facts} / {factsTotal} facts · {qs} / {qsTotal} questions · {mocks}',
      // S-116: its own key, so the count picks one / other (t() reads params.n)
      endedMocks: { one: '{n} mock at {safe}/{total} or more', other: '{n} mocks at {safe}/{total} or more' },
      newPlan: 'New plan',
      // v2.0.0 F7 (desktop): the countdown timeline over the plan (its marker reads plan.calendar.today)
      cdLeftHtml: { one: '<b>{n}</b> day to the exam', other: '<b>{n}</b> days to the exam' },
      cdStart: 'Start {date}',
      cdExam: '🎯 Exam {date}',
      logBroken: "Your progress record can't be read. Tap “Reset plan” on the schedule to clear it, then create a new plan.",
    },
    // day screen (handoff §2.4; mockup step ③); Day n stays English (lang="en")
    day: {
      today: "Today's tasks",
      dayTasksHtml: '{day} tasks',
      prev: 'Previous day',
      next: 'Next day',
      backToday: 'Back to today',
      ringToday: 'Done today',
      ringDay: 'Done that day',
      noPct: '–',
      pill: '{phase} phase',
      pillPast: '{phase} phase · past',
      pillAhead: '{phase} phase · ahead',
      count: '{done} / {total} done',
      restCount: 'Rest day: no tasks',
      hintToday: 'Completion is counted automatically: everything you have done in Study and Practice counts. Once you have answered all the questions for a set of facts correctly, those facts count as read too.',
      hintPast: 'A day gone by: catch up on anything unfinished here, and its completion updates at once.',
      hintAhead: 'A day ahead: see what is coming. Reading and practice can be done early; redoing wrong answers and drills are decided on the day.',
      doneToday: '🎉 All done for today!',
      doneDay: '🎉 All done for this day!',
      carryAlert: {
        one: "{n} unfinished task from an earlier day was carried over to today, marked with its day. It doesn't count towards today's %.",
        other: "{n} unfinished tasks from earlier days were carried over to today, marked with their day. They don't count towards today's %.",
      },
      examAhead: '🎯 Exam day',
      moreTasks: '↓ More tasks', // v2.0.0 (desktop): the task panel has more below
    },
    // completion calendar (one month at a time) and overall progress
    calendar: {
      title: 'Daily completion',
      month: '{month} {year}',
      prev: 'Previous month',
      next: 'Next month',
      today: 'Today',
      streak: { one: '🔥 {n} day in a row at 100%', other: '🔥 {n} days in a row at 100%' },
      legendLow: '0%',
      legendHigh: '100%',
      legendExam: '🎯 Exam day', // v1.2.0 (C2): the exam cell itself has no label any more
      ahead: 'ahead',
      cellLabel: '{day} · {date} · {status}',
    },
    kpi: {
      title: 'Overall progress',
      plan: 'Plan progress',
      avg: 'Average',
      avgSub: 'study days gone by',
      left: 'To the exam',
      leftSub: 'rest days included',
      facts: 'Facts read',
      qs: 'Questions practised',
      mocks: 'Mocks ≥ {safe}/{n}',
      value: '{v} / {of} · {pct}%',
    },
    goal: {
      step: 'New plan · 1 / 2',
      title: 'Set your goal',
      intro: "Answer 4 questions and we'll work out a plan you can keep to.",
      daysLabel: 'When is your exam?',
      daysValue: { one: '{n} day', other: '{n} days' },
      preset2w: '2 weeks',
      preset3w: '3 weeks',
      preset4w: '4 weeks',
      preset6w: '1.5 months',
      orDate: 'or exam date',
      minsLabel: 'Most time you can study a day',
      mins: '{m} min',
      hours: '{h} hr',
      hoursMins: '{h} hr {m} min',
      tickMins: '{m} min', // slider ticks past the first hour show only the minutes
      restLabel: 'Rest days (no tasks)',
      levelLabel: 'Where are you now?',
      minStudyDays: "Fewer than {n} study days, so the plan can't be built. Choose fewer rest days or a later exam date.",
      create: 'Build my plan',
      // "Change goal" from the schedule: the same form, prefilled; the plan is re-planned from today (G7)
      editStep: 'Change goal',
      update: 'Update my plan',
      // S-115: the day changed while the form was open, so Build / Update failed and the date moved
      dateMoved: 'The day has changed, so the exam date moved to the earliest one allowed. Please check it and press again.',
      // CUI-0038: a changed goal needs the same {n} = 7 study days as a new plan (G28; the one form stays for the plural)
      editMinStudyDays: {
        one: "At least {n} study day is needed before the exam, so the plan can't be updated. Choose fewer rest days or a later exam date.",
        other: "At least {n} study days are needed before the exam, so the plan can't be updated. Choose fewer rest days or a later exam date.",
      },
    },
    // schedule screen (handoff §2.3; mockup step ②); Day n / Week n stay English (lang="en")
    schedule: {
      doneSr: '(done)', // G43: screen-reader text after a finished phase / study-order step
      name: 'Schedule',
      editGoal: 'Change goal',
      title: 'Your study schedule',
      summary: 'Starts {start} · exam {exam} · up to {mins} a day · {level}',
      // CUI-0038: the phase card's title counts the phases the plan has (a short plan has no drill); the three-phase
      // key keeps its old name, which an older cached index.html still names
      phasesTitleOne: 'One phase',
      phasesTitleTwo: 'Two phases',
      phasesTitle: 'Three phases',
      phaseDaysN: { one: '{n} day', other: '{n} days' }, // phase bar line 2, under the phase name
      dayRange: 'Day {from}–{to}',
      orderTitle: 'Study order: chapters from easy to hard, History last',
      orderIntro: "Each chapter's time follows its number of facts. Chapters are ordered by difficulty, with History, the hardest to remember, last.",
      orderCount: '{facts} facts · {qs} Qs',
      listTitle: 'Daily tasks',
      week: 'Week {n}',
      restDay: 'Rest day',
      examDay: 'Exam day',
      examTip: 'Bring your ID and confirmation letter, and arrive 30 minutes early.',
      resetHint: 'Want to start over? Resetting deletes this plan and its progress and takes you back to create a new one. Your practice records are not affected.',
      reset: 'Reset plan',
      viewToday: "View today's tasks",
    },
    phase: { learn: 'Read + practise', drill: 'Drill', mock: 'Mocks' },
    strategy: {
      learnTitle: 'Read + practise: questions straight after reading',
      learnOrder: 'Order Ch1–2 → Ch5 → Ch4 → Ch3: easy to hard, History last',
      learnPair: 'After each set of facts, practise the questions on them ({facts} facts · {qs} Qs)',
      learnReview: 'End each day by redoing your wrong answers',
      drillTitle: 'Drill: redo questions not yet mastered',
      drillAgain: 'The same order again, only questions you got wrong or have not mastered',
      drillFacts: 'Then review the facts behind your wrong answers',
      mockTitle: { one: 'Mock exams: {n} timed exam', other: 'Mock exams: {n} timed exams' },
      mockReal: 'Real test conditions: {n} Qs, {m} minutes, no answers shown',
      mockPass: 'Pass mark {pass}/{n}; {k} in a row at {safe}/{n} or more is safe',
      mockLast: 'No new mock exam on the last study day, only your wrong answers',
    },
    // why each step of the study order comes where it does (PLAN_ORDER_WHY_KEYS)
    order: {
      whyWarmUp: 'Only {n} facts and few questions: done in a day, a warm-up',
      whyGov: 'Government, law and rights: much of it is like Hong Kong, so common sense gets you far',
      whySociety: 'Festivals, sport and culture: easier to remember than history',
      whyHistory: 'The most dates, names and places, the hardest to remember: last, so it is fresh on exam day',
    },
    // day list task lines ({ch} = "Ch 3", lang="en"; the day's remarks line names the chapters in full); no minutes,
    // "not yet mastered" in words (handoff §2.3)
    task: {
      read: 'Read {ch} facts {range}',
      practice: { one: 'Practise {ch}: {n} Q', other: 'Practise {ch}: {n} Qs' },
      drill: { one: 'Practise {ch} again: {n} Q not yet mastered', other: 'Practise {ch} again: {n} Qs not yet mastered' },
      wrongFacts: 'Review the facts behind wrong answers',
      review: 'Redo your wrong answers',
      reviewMock: 'Redo your mock exam mistakes',
      light: 'Light review: wrong answers and their facts (no new mock exam)',
      mock: 'Timed mock exam',
      mockExam: 'Timed mock exam: {exam}',
      // day screen task boxes: status line (no minutes), "go" hint
      modePractice: 'Practice',
      modeReview: 'Wrong answers',
      modeMock: 'Mock exam',
      pending: 'Decided on the day from your wrong answers',
      noWrong: '✓ No wrong answers',
      readTodo: { one: '{n} fact · Study', other: '{n} facts · Study' },
      readPart: 'Read {done} / {total} facts · continue from #{n}',
      readDone: '✓ Practised its questions: counted as read',
      qTodo: { one: '{n} question · {mode}', other: '{n} questions · {mode}' },
      qPart: '✓ {done} / {total} right',
      qBad: '✗ {n}',
      wrongTag: '{n} wrong: only right answers count',
      qDone: { one: '✓ {n} question done', other: '✓ {n} questions done' },
      qMastered: { one: '✓ Mastered ({n} question)', other: '✓ Mastered ({n} questions)' }, // G37: all done by 🏆
      qMasteredPart: '🏆 {n} mastered',
      mockPassed: '✓ Passed · best {best} / {n}',
      mockBest: 'Best {best} / {n} · pass mark {pass}',
      goStart: 'Start',
      goContinue: 'Continue',
      goReview: 'Review',
    },
    // runner (PR6a): a task on the Practice screen, its Result card; Day n stays English (lang="en")
    run: {
      // backToday / backDayHtml: no longer read since v2.3.2 (backTodayLabel / backDayLabel); kept for an HTTP-cached
      // planRun.js up to v2.3.1 (W-072 mixed cache), which still names its back button with them. S-271: can go once
      // no supported cache can hold a pre-v2.3.2 planRun.js (a later release that drops the old-file guards)
      backToday: "Today's tasks",
      backDayHtml: '{day} tasks',
      // one fact's ▶ Practise, mid-session: the header reads quiz.back ("Back", short beside "Fact Ch c #n"), named this
      // (contains the visible word; planRun.js planQuizBackName)
      backFactLabel: 'Back to the fact',
      // v2.3.2 (W-077): the plan header / #planRunBack "‹ Back" is named after the day it goes back to, starting with the
      // visible word (planRun.js planRunBackName); plain text, never HTML (an aria-label)
      backTodayLabel: "Back to today's tasks",
      backDayLabel: 'Back to {day} tasks',
      roundOf: 'Round {n} of {rounds}',
      nextRound: 'Next round', // also the quick button's title / aria-label (QA O-3)
      retryWrong: { one: 'Redo the wrong answer ({n} left)', other: 'Redo wrong answers ({n} left)' },
      pairNote: 'Once you have answered these questions correctly, the matching facts count as read automatically.',
      reviewNote: "✅ This task is done · you're reviewing it now, so your progress won't be affected.",
      reviewCorrect: '✓ Correct answer',
      reviewWasWrong: 'Correct answer (✗ you got this wrong before)',
      doneToday: "Task done · today's progress",
      doneDay: "Task done · that day's progress",
      allDoneToday: "All of today's tasks are done!",
      allDoneDayHtml: 'All {day} tasks are done!',
      allSubToday: "The next day's tasks will appear on Home tomorrow.",
      allSubDay: 'The schedule and the completion calendar are up to date.',
      sumFirst: { one: '{n} question, right first time.', other: 'All {n} questions right first time.' },
      sumRedone: { one: '{n} question right, after a redo.', other: 'All {n} questions right, {k} of them after a redo.' },
      donePairHtml: 'The matching “{task}” now counts as read automatically.',
      next: 'Next',
      reviewThis: 'Review this task',
      startNext: 'Start next',
      backToList: 'Back to the task list',
      // PR6b: reading / facts behind wrong answers (#screenPlanRun), the mock exam's result row (G10 / G11)
      factOf: 'Fact {n} of {total}',
      practiseN: { one: 'Practise this one', other: 'Practise these {n}' },
      factDoneTag: '✓ Practice done', // G41: a reading card whose fact's questions are all right today (or 🏆)
      lastUndoneNote: { one: '{n} fact still needs practice · {qs}', other: '{n} facts still need practice · {qs}' }, // G41: the last fact only
      lastUndoneQs: { one: '{n} question', other: '{n} questions' }, // {qs} above: the last button's count
      wrongFactsLabel: 'Wrong-answer facts',
      mockPassNote: '✓ Mock exam task done',
      mockFailNote: 'Not passed (pass mark {pass} / {n}): retake as a Random Exam today.',
      mockRetake: 'Retake: {exam}',
      mockNotCounted: 'Submitted after midnight: this attempt does not count for that day.',
      youGotWrong: 'You got this wrong', // CUI-0025: after the wrong answer's ref in its fact's panel
      prevFact: 'Prev',
      nextFact: 'Next',
    },
    status: { rest: 'Rest', today: 'Today {n}%', done: '✓ Done', pct: '{n}%', todayDone: 'Done today' },
    feas: {
      title: 'Is there enough time?',
      ok: '✓ Plenty',
      tight: '△ Just enough',
      short: '✕ Not enough',
      studyDays: 'Study days',
      studyDaysSub: { one: '{n} day, {rest} rest', other: '{n} days, {rest} rest' }, // n: all days to the exam (a kept exam inside the window can be 1, CUI-0038)
      avail: 'Available',
      availSub: 'daily limit × study days',
      need: 'Suggested',
      needSub: 'read + practise + mocks',
      hours: '{n}h',
      okMsg: { one: 'About {n} hour to spare: room for extra mock exams or the unexpected.', other: 'About {n} hours to spare: room for extra mock exams or the unexpected.' },
      tightMsg: 'Just enough, with little room to miss a day. Try one rest day fewer, or {m} more minutes a day.',
      shortMsg: { one: "About {n} hour short. Move the exam later, add daily time or take fewer rest days. You can build it anyway: each day's tasks run longer so everything still gets covered.", other: "About {n} hours short. Move the exam later, add daily time or take fewer rest days. You can build it anyway: each day's tasks run longer so everything still gets covered." },
    },
  },

  // labels for the enum keys kept in data/*.js and the study screen (CHAPTERS, DIFF_LEVELS, ERAS, NATIONS, …)
  data: {
    chapters: {
      1: 'The values and principles of the UK',
      2: 'What is the UK?',
      3: 'A long and illustrious history',
      4: 'A modern, thriving society',
      5: 'The UK government, the law and your role',
    },
    chapterShort: {
      1: 'Values & principles',
      2: 'What is the UK?',
      3: 'History',
      4: 'Modern society',
      5: 'Government & law',
    },
    difficulty: { 1: 'Easy', 2: 'Basic', 3: 'Medium', 4: 'Hard', 5: 'Expert' },
    eras: {
      stone: 'Stone Age & Iron Age',
      roman: 'Romans',
      anglo: 'Anglo-Saxons & Vikings',
      norman: 'Normans & Middle Ages',
      tudor: 'Tudors',
      stuart: 'Stuarts',
      georgian: 'Georgian',
      victorian: 'Victorian',
      c20: '20th century',
      c21: '21st century',
    },
    nations: {
      UK: { label: '🇬🇧 United Kingdom', chip: '🇬🇧 UK' },
      England: { label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', chip: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England' },
      Scotland: { label: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland', chip: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland' },
      Wales: { label: '🏴󠁧󠁢󠁷󠁬󠁳󠁿 Wales', chip: '🏴󠁧󠁢󠁷󠁬󠁳󠁿 Wales' },
      'Northern Ireland': { label: '☘️ Northern Ireland', chip: '☘️ N. Ireland' },
    },
    geoTypes: {
      city: '🏙️ Cities & capitals',
      nature: '⛰️ Mountains, parks & nature',
      landmark: '🏛️ Landmarks & buildings',
      region: '🗺️ Regions & territories',
    },
    people: {
      monarch: { label: '👑 Monarchs & rulers', chip: '👑 Monarchs' },
      politician: { label: '🏛️ Prime Ministers, politicians & military', chip: '🏛️ Politics & military' },
      scientist: { label: '🔬 Scientists, inventors & engineers', chip: '🔬 Scientists' },
      writer: { label: '✒️ Writers & poets', chip: '✒️ Writers' },
      artist: { label: '🎨 Artists, architects & composers', chip: '🎨 Artists' },
      sport: { label: '🏅 Sport & exploration', chip: '🏅 Sport' },
      reformer: { label: '✊ Reformers & others', chip: '✊ Reformers' },
    },
    // study plan: rest-day chips (0 = Sunday, as Date.getDay) and the level cards (PLAN_LEVELS keys)
    monthsShort: { 1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec' }, // v2.0.0 timeline ticks
    months: { 1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June', 7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December' },
    weekdays: { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' },
    planLevels: {
      none: { label: 'Beginner', sub: 'Never studied it' },
      some: { label: 'Intermediate', sub: 'Tried some questions' },
      exam: { label: 'Advanced', sub: 'Have tried a mock exam' },
    },
  },
};
