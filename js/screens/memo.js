// ════════════════════════════════════════
// MEMO SCREEN — memory-note study (v1.6.0, memo mockup v2 (deleted at release; design: .proj-docs/design-baselines/2026-10-12_memo-*.png)): Study tab 5 lists the groups
// (js/domain/memo.js); a group opens #screenMemo: ① look (the memory hook + the memory note) → ② test (a side session on
// the quiz screen, js/screens/sideSession.js) → result (score, new level, next review) on the same screen.
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
  // v1.6.1 (user): the cards sit two per row in .memo-grid (DOM order = row by row, so Tab runs row-wise); the due
  // banner stays outside it, full width
  const cards = shown.map(g => memoCardHtml(g, progress, today)).join('');
  const html = memoDueBannerHtml(memoDueGroups(progress, today)) + `<div class="memo-grid">${cards}</div>`;
  return { html, shown: shown.length, total: pool.length, countKey: 'memo.count', emptyKey: 'memo.empty' };
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
function renderMemo() {
  const g = memoGroupById(memoView.id), local = memoLocal(g), title = byId('memoTitle');
  title.textContent = g.icon + ' ' + local.title;
  title.lang = local.lang;
  byId('memoSteps').innerHTML = memoStepsHtml(g);
  byId('memoBody').innerHTML = memoView.step === MEMO_STEP.result ? memoResultHtml(g, memoView.result) : memoLookHtml(g);
  if (typeof refreshFades === 'function') refreshFades(byId('memoBody')); // v2.0.0 desktop: the panel's fades
}
// ① look / ② test (n); after a test both read done, the test with its score
function memoStepsHtml(g) {
  // a test with nothing answered recorded nothing (S-232): its step is not done
  const r = memoView.result, done = memoView.step === MEMO_STEP.result && !r.none;
  const look = done ? t('memo.stepLookDone') : t('memo.stepLook');
  const test = done ? t('memo.stepTestDone', { correct: r.correct, total: r.total }) : t('memo.stepTest', { n: Math.min(g.count, MEMO_TEST_SIZE) });
  return `<div class="memo-step ${done ? 'ok' : 'on'}">${escapeHtml(look)}</div><div class="memo-step${done ? ' ok' : ''}">${escapeHtml(test)}</div>`;
}

// v2.0.0 desktop (≥ 1024px; Design Origin: baseline: Plan Run's desktop centred column, user 2026-10-12, no mockup): the
// screen is one screen high in a centred column (css/screens/memo.css); a long note / result scrolls in its panel
// (.fit-panel) with fades (.fit-fade, js/components/fit.js), so the buttons under it stay on the screen. Below 1024px
// the wrapper draws nothing and the page scrolls as before
function memoScrollHtml(panel) { return `<div class="memo-scroll fit-fade">${panel}</div>`; }
// one screen high from 1024px (css/components/fit.css .screen.is-fit); a cached older index.html has no #screenMemo
function memoMarkFit() {
  const screen = byId('screenMemo');
  if (screen) screen.classList.add('is-fit');
}
memoMarkFit();

// ── ① look ──
function memoHookHtml(g) {
  const local = memoLocal(g);
  if (!local.hook) return '';
  return `<div class="memo-hook"><b>${escapeHtml(t('memo.hookLabel'))}</b> <span lang="${local.lang}">${escapeHtml(local.hook)}</span></div>`;
}
// the memory note without its heading line (the screen title already names the group), like the Study fact card;
// v2.2.0: in the UI language (localNote)
function memoNoteHtml(g) {
  const note = localNote(g.body);
  return memoScrollHtml(`<div class="memo-panel memo-note fit-panel" lang="${note.lang}">${noteHtml(note.text.split('\n').slice(1).join('\n'), note.lang)}</div>`);
}
// the single-note group: each distinct question (English) with its own note
function memoSingleHtml(g) {
  const items = questionGroups(g.qkeys).map(keys => questionByKey(keys[0]).q).map(q =>
    `<div class="memo-single-item"><div class="memo-single-q" lang="en">${escapeHtml(q.q)}</div>`
    + `${localNoteHtml(q.note, 'memo-single-note')}</div>`);
  return memoScrollHtml(`<div class="memo-panel memo-single fit-panel">${items.join('')}</div>`);
}
function memoLookHtml(g) {
  const body = g.body ? memoNoteHtml(g) : memoSingleHtml(g);
  return memoHookHtml(g) + body
    + iconButtonHtml('nav-btn memo-start', ' data-action="startMemoTest"', escapeHtml(t('memo.startTest')), MEMO_GO_ICONS);
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
  const wrong = answered.filter(({ q, i }) => !isCorrectAnswer(q, state.answers[i])).map(({ q }) => ({ q: q.q, yue: q.yue }));
  const total = answered.length, correct = total - wrong.length;
  const rec = recordMemoResult(ret.id, correct, total, planTodayIso());
  Object.assign(memoView, { id: ret.id, step: MEMO_STEP.result, result: rec ? { ...rec, correct, total, wrong } : { none: true } });
  showMemo();
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
function memoWrongHtml(wrong) {
  if (!wrong.length) return '';
  const items = wrong.map(w => `<li><span lang="en">${escapeHtml(w.q)}</span><span class="memo-wrong-yue" lang="zh-HK">${escapeHtml(w.yue)}</span></li>`);
  return `<p class="memo-wrong-title">${escapeHtml(t('memo.wrongTitle'))}</p><ul class="memo-wrong">${items.join('')}</ul>`;
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
function memoResultHtml(g, r) {
  if (r.none) return `<div class="memo-panel"><p class="memo-none">${escapeHtml(t('memo.noAnswers'))}</p></div>${memoResultActionsHtml(g, false)}`;
  return memoScrollHtml(`<div class="memo-panel fit-panel">
      <div class="memo-score${r.passed ? '' : ' fail'}"><div class="memo-pct">${percent(r.correct, r.total)}%</div><div class="memo-verdict">${escapeHtml(memoVerdictText(r))}</div></div>
      <div class="memo-sched">${memoScheduleHtml(r)}</div>${memoWrongHtml(r.wrong)}
    </div>`) + memoResultActionsHtml(g, true);
}
