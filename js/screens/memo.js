// ════════════════════════════════════════
// MEMO SCREEN — memory-note study (v1.6.0, memo mockup v2 (deleted at release; design: .proj-docs/design-baselines/2026-10-12_memo-*.png)): Study tab 5 lists the groups
// (js/domain/memo.js); a group opens #screenMemo: ① look (the memory hook + the memory note) → ② test (a side session on
// the quiz screen, js/screens/sideSession.js) → result (score, new level, next review) on the same screen.
// v2.3.0 layout (desktop + phone): Design Origin mockup: mockups/v2.0.0/desktop-memo.html (rev 6), decision log
// .proj-docs/plans/2026-10-13_grill_desktop-memo.md
// ════════════════════════════════════════
const MEMO_STEP = { look: 'look', result: 'result' };
const MEMO_STATUS_KEYS = { new: 'memo.statusNew', due: 'memo.statusDue', learning: 'memo.statusLearning', done: 'memo.statusDone' };
const MEMO_SEARCH_SEP = ' ';
// v1.6.1: line icons where the glyphs were (Start / start the test / Next group ▶ after the words, ‹ Memory before)
const MEMO_GO_ICONS = { trail: 'play' }, MEMO_BACK_ICONS = { lead: 'chevronLeft' };
// the group on #screenMemo: its step, the Study list scroll to go back to, the finished test (result step)
const memoView = { id: null, step: MEMO_STEP.look, listScrollY: 0, result: null };

// a cached older index.html (SW cutover) has neither the tab nor the screen: the memo tab stays out of reach there
function memoShellReady() { return !!byId('screenMemo') && !!document.querySelector('.study-tab[data-tab="memo"]'); }

// ── Study tab 5: the group list ──
function memoChapterChipsHtml() {
  // S-057: "Ch {n}" stays English in zh-HK too, as on the chapters tab
  const chapters = CHAPTER_NUMBERS.map(ch => chipHtml({ extraCls: ' ch', active: study.memoChapter === ch, action: 'studySetMemoChapter', arg: ch,
    label: `${CHAPTER_ICONS[ch]} <span lang="en">${escapeHtml(t('common.chapterShort', { n: ch }))}</span>` }));
  return chipHtml({ extraCls: ' ch', active: study.memoChapter === ALL_FILTER, action: 'studySetMemoChapter', arg: ALL_FILTER, label: t('study.all') })
    + chapters.join('');
}
const memoInChapter = g => study.memoChapter === ALL_FILTER || g.ch === study.memoChapter;
// v2.2.0: the search reads both languages (like the Study search), whatever the UI language
function memoMatches(g) {
  if (!study.search) return true;
  const english = g.body && typeof NOTES_EN !== 'undefined' ? NOTES_EN[g.body] : '';
  return [g.title, g.body || '', g.hook, g.titleEn || '', english || '', g.hookEn || ''].join(MEMO_SEARCH_SEP).toLowerCase().includes(study.search);
}
function memoBadgeText(rec, status, today) {
  const params = rec ? { lv: rec.lv, n: memoDaysUntil(rec, today) } : {};
  const badgeKey = MEMO_STATUS_KEYS[status];
  return t(badgeKey, params);
}
function memoMetaText(g) {
  const count = t('memo.questions', { n: g.count });
  return g.id === MEMO_SINGLE_ID ? t('memo.singleMeta') + LIST_SEP + count : count;
}
function memoCardHtml(g, progress, today) {
  const rec = memoRecord(progress, g.id), status = memoStatus(rec, today);
  const width = percent(rec ? rec.lv : 0, MEMO_MAX_LV), local = memoLocal(g);
  return `<button class="memo-card ${status}" type="button" data-action="openMemoGroup" data-arg="${escapeHtml(g.id)}">
      <span class="memo-card-row"><span class="memo-name" lang="${local.lang}">${escapeHtml(g.icon + ' ' + local.title)}</span>
        <span class="memo-badge ${status}">${escapeHtml(memoBadgeText(rec, status, today))}</span></span>
      <span class="memo-meta">${escapeHtml(memoMetaText(g))}</span>
      <span class="memo-bar" aria-hidden="true"><i style="width:${width}%"></i></span>
    </button>`;
}
// "n groups to review today" + the first few titles; Start opens the first. Every chapter counts (a daily summary)
const MEMO_DUE_TITLES_SHOWN = 3;
function memoDueBannerHtml(due) {
  if (!due.length) return '';
  const titles = due.slice(0, MEMO_DUE_TITLES_SHOWN).map(g => memoLocal(g).title).join(LIST_SEP);
  return `<div class="memo-due">
      <div class="memo-due-text"><b>${escapeHtml(t('memo.dueTitle', { n: due.length }))}</b><small lang="${memoLocal(due[0]).lang}">${escapeHtml(titles)}</small></div>
      ${iconButtonHtml('memo-due-start', ` data-action="openMemoGroup" data-arg="${escapeHtml(due[0].id)}"`, escapeHtml(t('memo.start')), MEMO_GO_ICONS)}
    </div>`;
}
function renderStudyMemo() {
  const today = planTodayIso(), progress = memoLoadProgress();
  // count = shown / the chapter's groups (like the chapters tab); the search narrows inside the chapter
  const pool = memoSortedGroups(memoGroups(), progress, today).filter(memoInChapter);
  const shown = pool.filter(memoMatches);
  // v1.6.1 (user): the cards sit in .memo-grid (DOM order = row by row, so Tab runs row-wise). v2.3.0 (mockup
  // desktop-memo.html rev 4): the due banner is the list's lead, above the cards (js/screens/study.js #studyLead):
  // desktop, outside the card panel's scroll; phone, it sticks under the pinned tabs (css/screens/memo.css)
  const lead = memoDueBannerHtml(memoDueGroups(progress, today));
  const html = `<div class="memo-grid">${shown.map(g => memoCardHtml(g, progress, today)).join('')}</div>`;
  return { html, lead, shown: shown.length, total: pool.length, countKey: 'memo.count', emptyKey: 'memo.empty' };
}

// ── #screenMemo ──
// from the Study list (remember its scroll) or from a result's "Next" (keep the list's scroll)
function openMemoGroup(id) {
  if (!memoShellReady() || !memoGroupById(id)) return;
  // v2.0.0 desktop: the Study cards scroll in their panel, not the page (js/screens/study.js studyScrollTop)
  if (byId('screenStudy').classList.contains('active')) memoView.listScrollY = typeof studyScrollTop === 'function' ? studyScrollTop() : window.scrollY;
  Object.assign(memoView, { id, step: MEMO_STEP.look, result: null });
  showMemo();
}
// a new view of the group screen: top of the page, focus on the group title (S-227; showScreen dropped the old focus)
function showMemo() {
  showScreen('screenMemo');
  renderMemo();
  window.scrollTo(0, 0);
  byId('memoTitle').focus({ preventScroll: true });
}
function memoBack() {
  showScreen('screenStudy');
  renderStudy(); // study.tab is still the memo tab; statuses may have changed
  if (typeof setStudyScroll === 'function') setStudyScroll(memoView.listScrollY); else window.scrollTo(0, memoView.listScrollY);
}
function memoLook() {
  Object.assign(memoView, { step: MEMO_STEP.look, result: null });
  showMemo();
}
// v2.3.0: the body is drawn for the layout it shows in (desktop columns or the phone's one column); a resize across
// 1024px draws it again (fitMemo). An open questions fold stays open when the same view is drawn again
let memoDrawn = { desktop: null, view: null };
function renderMemo() {
  const g = memoGroupById(memoView.id), local = memoLocal(g), title = byId('memoTitle');
  const desktop = deskOn(), view = memoView.id + ':' + memoView.step;
  const keepOpen = memoDrawn.view === view && !!document.querySelector('#memoBody details.memo-questions[open]');
  memoArrangeTop();
  title.textContent = g.icon + ' ' + local.title; // v2.2.0 (main): the English title in the English UI
  title.lang = local.lang;
  byId('memoSteps').innerHTML = memoStepsHtml(g);
  byId('screenMemo').dataset.memoStep = memoView.step;
  byId('memoBody').innerHTML = memoView.step === MEMO_STEP.result ? memoResultHtml(g, memoView.result, desktop) : memoLookHtml(g, desktop);
  const fold = byId('memoBody').querySelector('details.memo-questions');
  if (fold) {
    fold.open = keepOpen;
    fold.addEventListener('toggle', memoRefreshFades); // its panel got taller / shorter
  }
  memoDrawn = { desktop, view };
  memoFitPhone();
  memoRefreshFades();
  desktopRefit('screenMemo', fitMemo); // registered lazily (js/components/deskPlace.js)
}
// the panels' fades (W-057: a cached shell may load js/components/fit.js late)
function memoRefreshFades() { if (typeof refreshFades === 'function') refreshFades(byId('memoBody')); }
function fitMemo(desktop) {
  if (desktop !== memoDrawn.desktop) renderMemo();
  else memoFitPhone();
}
// C-007: on a phone one screen high only while the panel keeps room (else the page scrolls); re-checked on every
// render and refit (resize, language, text size, translation)
function memoFitPhone() {
  if (typeof fitPhoneScreen === 'function') fitPhoneScreen(byId('screenMemo'), byId('memoBody').querySelector(':scope > .memo-scroll > .fit-panel'));
}
// the top row (‹ Memory + title | steps; desktop: side by side) wraps the header and the steps once; a box that draws
// nothing below 1024px (display: contents), like Study's wrappers
function memoArrangeTop() {
  const screen = byId('screenMemo'), header = screen.querySelector('.memo-header'), steps = byId('memoSteps');
  if (!header || !steps || header.parentElement.classList.contains('memo-top')) return;
  const top = deskEl('div', 'memo-top');
  deskKeepFocus(() => { header.before(top); top.append(header, steps); });
}
// ① look / ② test (n); after a test both read done, the test with its score
function memoStepsHtml(g) {
  // a test with nothing answered recorded nothing (S-232): its step is not done
  const r = memoView.result, done = memoView.step === MEMO_STEP.result && !r.none;
  const look = done ? t('memo.stepLookDone') : t('memo.stepLook');
  const test = done ? t('memo.stepTestDone', { correct: r.correct, total: r.total }) : t('memo.stepTest', { n: Math.min(g.count, MEMO_TEST_SIZE) });
  return `<div class="memo-step ${done ? 'ok' : 'on'}">${escapeHtml(look)}</div><div class="memo-step${done ? ' ok' : ''}">${escapeHtml(test)}</div>`;
}

// one screen high (desktop and, v2.3.0, phone; css/screens/memo.css): long content scrolls in its panel (.fit-panel)
// with fades (.fit-fade, js/components/fit.js), so the buttons under it stay on the screen
function memoScrollHtml(panel) { return `<div class="memo-scroll fit-fade">${panel}</div>`; }
// one screen high from 1024px (css/components/fit.css .screen.is-fit) and, v2.3.0, on a phone too (.is-fit-phone:
// the hook and buttons stay put, the panel between them scrolls); a cached older index.html has no #screenMemo
function memoMarkFit() {
  const screen = byId('screenMemo');
  if (screen) screen.classList.add('is-fit', 'is-fit-phone');
}
memoMarkFit();

// ── a question's pill row (v2.3.0, mockup desktop-memo.html rev 3 pillsHtml): ".tag #n" · ".tag <icon> Ch c" ·
// the question's node (js/components/tags.js: copies joined COPY_SEP, mastery colours), the app's own pills. Used by
// the group's questions, the result's wrong questions and the single-note group. S-057: English in every language ──
const MEMO_ITEM_MARK = '#';
function memoPillsHtml(keys, n) {
  const ch = questionByKey(keys[0]).q.ch;
  const chapter = `<span class="tag" lang="en"><span aria-hidden="true">${CHAPTER_ICONS[ch]}</span> ${escapeHtml(t('common.chapterShort', { n: ch }))}</span>`;
  const node = questionNodeHtml(keys, { lang: 'en' }); // S-265: the Similar map / fact card's own node
  return `<div class="memo-pills"><span class="tag" lang="en">${MEMO_ITEM_MARK}${n}</span>${chapter}${node}</div>`;
}
// one question in a list: its pill row (when its keys are known), the English question and its translation
// (.memo-wrong-yue: hidden with translation off, css/base/layout.css)
function memoQuestionItemHtml({ q, yue, keys }, n) {
  const pills = keys && keys.length ? memoPillsHtml(keys, n) : '';
  return `<li>${pills}<span class="memo-q" lang="en">${escapeHtml(q)}</span><span class="memo-wrong-yue" lang="zh-HK">${escapeHtml(yue)}</span></li>`;
}
function memoQuestionListHtml(items, extraCls = '') {
  return `<ul class="memo-qlist${extraCls}">${items.map((it, i) => memoQuestionItemHtml(it, i + 1)).join('')}</ul>`;
}

// ── ① look (v2.3.0, Design Origin: mockup: mockups/v2.0.0/desktop-memo.html rev 6) ──
// desktop: the top row, then left 7/12 = the hook (fixed) + the memory note panel, right 5/12 = the group's questions
// panel, both as high as the screen allows (scrolling, fading); "start the test" under the right column. The single-note
// group: one white card, centred (Plan Run's 760 × scale), its button under the card's right edge.
// phone: hook, then the note with the group's questions folded under it (<details>, closed), then the button
// "💡 Memory hook:" on its own line, the hook under it (css: .memo-hook b is a block)
function memoHookHtml(g) {
  const local = memoLocal(g);
  if (!local.hook) return '';
  return `<div class="memo-hook"><b>${escapeHtml(t('memo.hookLabel'))}</b> <span lang="${local.lang}">${escapeHtml(local.hook)}</span></div>`;
}
// the memory note without its heading line (the screen title already names the group), like the Study fact card;
// main v2.2.0: in the UI language (localNote: the English note in the English UI). { html, lang }
function memoNoteBody(g) {
  const note = localNote(g.body);
  return { html: noteHtml(note.text.split('\n').slice(1).join('\n'), note.lang), lang: note.lang };
}
// the group's questions: each distinct question (G40) with its pill row, English and Cantonese; no answers (P1)
function memoGroupQuestions(g) {
  return questionGroups(g.qkeys).map(keys => { const q = questionByKey(keys[0]).q; return { q: q.q, yue: q.yue || '', keys }; });
}
function memoQuestionsTitle(g) { return escapeHtml(t('memo.questions', { n: questionGroups(g.qkeys).length })); }
// the single-note group (design C): each distinct question = pill row → question → common.noteLabel + its own note (in
// the UI language, localNote; the label is a UI string, so it carries the UI's language)
function memoSingleItemsHtml(g) {
  const label = `<div class="memo-note-label" lang="${getLang()}">${escapeHtml(t('common.noteLabel'))}</div>`;
  return questionGroups(g.qkeys).map((keys, i) => {
    const q = questionByKey(keys[0]).q, note = localNote(q.note);
    return `<div class="memo-single-item">${memoPillsHtml(keys, i + 1)}<div class="memo-single-q" lang="en">${escapeHtml(q.q)}</div>`
      + `<div class="memo-single-note" lang="${note.lang}">${label}${noteHtml(note.text, note.lang)}</div></div>`;
  }).join('');
}
const memoStartHtml = () => iconButtonHtml('nav-btn memo-start', ' data-action="startMemoTest"', escapeHtml(t('memo.startTest')), MEMO_GO_ICONS);
function memoLookHtml(g, desktop) { return desktop ? memoLookDeskHtml(g) : memoLookPhoneHtml(g); }
function memoLookDeskHtml(g) {
  if (!g.body) {
    const card = `<div class="memo-panel memo-single fit-panel">${memoSingleItemsHtml(g)}</div>`;
    return `<div class="memo-cols memo-look-cols is-single"><div class="memo-col">${memoHookHtml(g)}${memoScrollHtml(card)}</div></div>`
      + `<div class="memo-foot is-single">${memoStartHtml()}</div>`;
  }
  const body = memoNoteBody(g);
  const note = `<div class="memo-scroll memo-note-scroll fit-fade"><div class="memo-panel memo-note fit-panel" lang="${body.lang}">${body.html}</div></div>`;
  const questions = memoScrollHtml(`<div class="memo-panel memo-questions fit-panel"><p class="memo-questions-title">${memoQuestionsTitle(g)}</p>`
    + `${memoQuestionListHtml(memoGroupQuestions(g))}</div>`);
  return `<div class="memo-cols memo-look-cols"><div class="memo-col">${memoHookHtml(g)}${note}</div><div class="memo-col">${questions}</div></div>`
    + `<div class="memo-foot">${memoStartHtml()}</div>`;
}
function memoLookPhoneHtml(g) {
  const body = g.body ? memoNoteBody(g) : null;
  const content = body
    ? `<div class="memo-panel memo-note" lang="${body.lang}">${body.html}</div>`
      + `<details class="memo-panel memo-questions"><summary class="memo-questions-title">${memoQuestionsTitle(g)}</summary>${memoQuestionListHtml(memoGroupQuestions(g))}</details>`
    : `<div class="memo-panel memo-single">${memoSingleItemsHtml(g)}</div>`;
  return memoHookHtml(g) + `<div class="memo-scroll fit-fade"><div class="memo-scroll-panel fit-panel">${content}</div></div>` + memoStartHtml();
}

// ── ② test: a side session; its last "↩ Back" comes back here (SESSION_RETURNS.memo → finishMemoTest) ──
function startMemoTest() {
  const g = memoGroupById(memoView.id);
  if (!g) return;
  startSideSession(MEMO_PREFIX + g.id, memoTestPick(g).map(toQuestionItem), { kind: SESSION_RETURN_KIND.memo, id: g.id });
}
// C2 (user): in a test the quiz header's back button (data-action goHome) reads "‹ Memory" like the group screen's
// .memo-back, and its words name it (no aria-label / title, as a plan's text back button: S-188)
function setQuizBackMemo(back) {
  back.classList.remove('plan-hit', 'icon-btn');
  setIconLabel(back, t('memo.backButton'), MEMO_BACK_ICONS); // S-240: a chevron line icon, not a read-out "‹"
  back.classList.add('memo-back');
  back.removeAttribute('aria-label');
  back.removeAttribute('title');
}
// C2: leave a test mid-way (goHome while isMemoSession): back to the same group's look view, recording nothing (no memo
// level / due; answers already given keep their practice streaks like any side session). The return point is cleared first,
// so a later session or Practice exam is a normal one; a second tap lands on #screenMemo (double tap guard, actions.js)
function leaveMemoTest() {
  const ret = sessionReturn;
  clearSideSession();
  stopExamTimer();
  Object.assign(memoView, { id: ret.id, step: MEMO_STEP.look, result: null });
  showMemo();
}
// Recorded once per finished test: returnFromSideSession clears the return point before calling here, and a second tap
// on ↩ Back lands on this screen (double tap guard). Scored over the answered (revealed) questions only (user, S-232);
// nothing answered → nothing recorded, the result says so
function finishMemoTest(ret) {
  const answered = state.questions.map((q, i) => ({ q, i })).filter(({ i }) => i in state.revealed);
  const wrong = answered.filter(({ q, i }) => !isCorrectAnswer(q, state.answers[i])).map(({ q }) => ({ q: q.q, yue: q.yue, keys: memoCopyKeys(ret.id, q) }));
  const total = answered.length, correct = total - wrong.length;
  const rec = recordMemoResult(ret.id, correct, total, planTodayIso());
  Object.assign(memoView, { id: ret.id, step: MEMO_STEP.result, result: rec ? { ...rec, correct, total, wrong } : { none: true } });
  showMemo();
}

// v2.3.0: a wrong question's copies in its group (for its pill row: "E1·Q8 = E11·Q9"); the asked copy at least
function memoCopyKeys(id, q) {
  const g = memoGroupById(id), k = qKey(q);
  const copies = g ? questionGroups(g.qkeys).find(keys => keys.includes(k)) : null;
  return copies || [k];
}

// ── result ──
function memoVerdictText(r) {
  const params = { correct: r.correct, total: r.total, pct: Math.round(MEMO_PASS_RATIO * PERCENT), lv: r.lv };
  if (!r.passed) return r.lv < r.prevLv ? t('memo.resultFailDrop', params) : t('memo.resultFail', params);
  return r.lv > r.prevLv ? t('memo.resultPass', params) : t('memo.resultKeep', params);
}
// Lv1..Lv4 with their wait; levels below the new one are past (green). After a pass the new level is next (orange,
// its interval); after a fail (W-065) it is due again tomorrow, so its box reads "Tomorrow" and no interval is next
const MEMO_LV_STATE = { past: ' past', next: ' next', retry: ' retry', none: '' };
function memoLevelState(level, r) {
  if (level < r.lv) return MEMO_LV_STATE.past;
  if (level > r.lv) return MEMO_LV_STATE.none;
  return r.passed ? MEMO_LV_STATE.next : MEMO_LV_STATE.retry;
}
function memoScheduleHtml(r) {
  return MEMO_INTERVALS.map((days, i) => {
    const level = i + 1, cls = memoLevelState(level, r);
    const wait = cls === MEMO_LV_STATE.retry ? t('memo.tomorrow') : t('memo.days', { n: days });
    return `<div class="memo-lv${cls}"><b>${escapeHtml(t('memo.lv', { lv: level }))}</b>${escapeHtml(wait)}</div>`;
  }).join('');
}
// a result kept from before v2.3.0 has no keys: its questions are listed without pills
function memoWrongHtml(wrong) {
  if (!wrong.length) return '';
  return `<p class="memo-wrong-title">${escapeHtml(t('memo.wrongTitle'))}</p>${memoQuestionListHtml(wrong, ' memo-wrong')}`;
}
// the next group to do: the first due / new one in list order (every chapter), not this one
function memoNextGroup(id) {
  const today = planTodayIso(), progress = memoLoadProgress();
  const todo = [MEMO_STATUS.due, MEMO_STATUS.new];
  return memoSortedGroups(memoGroups(), progress, today).find(g => g.id !== id && todo.includes(memoStatus(memoRecord(progress, g.id), today)));
}
// a UI label holding a group title: the title (Cantonese data; v2.2.0: English in the English UI) in a span marked
// with its language, the rest escaped
function memoLabelHtml(label, title, lang) {
  const at = label.indexOf(title);
  if (at < 0) return escapeHtml(label);
  return escapeHtml(label.slice(0, at)) + `<span lang="${lang}">${escapeHtml(title)}</span>` + escapeHtml(label.slice(at + title.length));
}
function memoResultActionsHtml(g, withNext) {
  const next = withNext ? memoNextGroup(g.id) : null, local = next && memoLocal(next);
  const nextBtn = next ? iconButtonHtml('nav-btn memo-next', ` data-action="openMemoGroup" data-arg="${escapeHtml(next.id)}"`,
    memoLabelHtml(t('memo.next', { title: local.title }), local.title, local.lang), MEMO_GO_ICONS) : '';
  return `<div class="memo-actions"><button class="nav-btn secondary memo-again" type="button" data-action="memoLook">${escapeHtml(t('memo.again'))}</button>${nextBtn}</div>`;
}
// v2.3.0 (decision log Q3): with nothing wrong (or nothing answered) the result shows the memory aid once more: the
// hook; a group without one shows its memory note, the single-note group its questions' notes. All correct says so
// first (memo.hookAgain / memo.noteAgain); nothing answered shows the aid alone
function memoReminderHtml(g, withWords) {
  const againKey = memoLocal(g).hook ? 'memo.hookAgain' : 'memo.noteAgain';
  const words = withWords ? `<p class="memo-again-text">${escapeHtml(t(againKey))}</p>` : '';
  if (memoLocal(g).hook) return words + memoHookHtml(g);
  if (g.body) { const body = memoNoteBody(g); return words + `<div class="memo-note" lang="${body.lang}">${body.html}</div>`; }
  return words + `<div class="memo-single">${memoSingleItemsHtml(g)}</div>`;
}
function memoScoreHtml(r) {
  return `<div class="memo-score${r.passed ? '' : ' fail'}"><div class="memo-pct">${percent(r.correct, r.total)}%</div><div class="memo-verdict">${escapeHtml(memoVerdictText(r))}</div></div>`
    + `<div class="memo-sched">${memoScheduleHtml(r)}</div>`;
}
// the right column / the phone panel's lower part: the wrong questions, or the memory aid again
const memoResultDetailHtml = (g, r) => (r.wrong.length ? memoWrongHtml(r.wrong) : memoReminderHtml(g, true));
const memoNoneHtml = () => `<p class="memo-none">${escapeHtml(t('memo.noAnswers'))}</p>`;
function memoResultHtml(g, r, desktop) { return desktop ? memoResultDeskHtml(g, r) : memoResultPhoneHtml(g, r); }
// desktop (B): left 5/12 = the score card, Again / Next stacked at the column's foot; right 7/12 = a panel that scrolls
function memoResultDeskHtml(g, r) {
  const card = r.none ? memoNoneHtml() : memoScoreHtml(r);
  const detail = r.none ? memoReminderHtml(g, false) : memoResultDetailHtml(g, r);
  return `<div class="memo-cols memo-result-cols"><div class="memo-col"><div class="memo-score-card">${card}</div>${memoResultActionsHtml(g, !r.none)}</div>`
    + `<div class="memo-col">${memoScrollHtml(`<div class="memo-panel fit-panel">${detail}</div>`)}</div></div>`;
}
// phone: one panel (score, Lv1–4, the wrong questions or the memory aid again), then Again / Next
function memoResultPhoneHtml(g, r) {
  const content = r.none ? memoNoneHtml() + memoReminderHtml(g, false) : memoScoreHtml(r) + memoResultDetailHtml(g, r);
  return `<div class="memo-scroll fit-fade"><div class="memo-scroll-panel fit-panel"><div class="memo-panel">${content}</div></div></div>`
    + memoResultActionsHtml(g, !r.none);
}
