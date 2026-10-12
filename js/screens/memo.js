// ════════════════════════════════════════
// MEMO SCREEN — memory-note study (v1.5.0, mockup mockups/memo-study.html v2): Study tab 5 lists the groups
// (js/domain/memo.js); a group opens #screenMemo: ① look (the memory hook + the memory note) → ② test (a side session on
// the quiz screen, js/screens/sideSession.js) → result (score, new level, next review) on the same screen.
// ════════════════════════════════════════
const MEMO_STEP = { look: 'look', result: 'result' };
const MEMO_STATUS_KEYS = { new: 'memo.statusNew', due: 'memo.statusDue', learning: 'memo.statusLearning', done: 'memo.statusDone' };
const MEMO_SEARCH_SEP = ' ';
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
function memoMatches(g) {
  if (!study.search) return true;
  return [g.title, g.body || '', g.hook].join(MEMO_SEARCH_SEP).toLowerCase().includes(study.search);
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
  const width = percent(rec ? rec.lv : 0, MEMO_MAX_LV);
  return `<button class="memo-card ${status}" type="button" data-action="openMemoGroup" data-arg="${escapeHtml(g.id)}">
      <span class="memo-card-row"><span class="memo-name" lang="zh-HK">${escapeHtml(g.icon + ' ' + g.title)}</span>
        <span class="memo-badge ${status}">${escapeHtml(memoBadgeText(rec, status, today))}</span></span>
      <span class="memo-meta">${escapeHtml(memoMetaText(g))}</span>
      <span class="memo-bar" aria-hidden="true"><i style="width:${width}%"></i></span>
    </button>`;
}
// "n groups to review today" + the first few titles; Start opens the first. Every chapter counts (a daily summary)
const MEMO_DUE_TITLES_SHOWN = 3;
function memoDueBannerHtml(due) {
  if (!due.length) return '';
  const titles = due.slice(0, MEMO_DUE_TITLES_SHOWN).map(g => g.title).join(LIST_SEP);
  return `<div class="memo-due">
      <div class="memo-due-text"><b>${escapeHtml(t('memo.dueTitle', { n: due.length }))}</b><small lang="zh-HK">${escapeHtml(titles)}</small></div>
      <button class="memo-due-start" type="button" data-action="openMemoGroup" data-arg="${escapeHtml(due[0].id)}">${escapeHtml(t('memo.start'))}</button>
    </div>`;
}
function renderStudyMemo() {
  const today = planTodayIso(), progress = memoLoadProgress();
  // count = shown / the chapter's groups (like the chapters tab); the search narrows inside the chapter
  const pool = memoSortedGroups(memoGroups(), progress, today).filter(memoInChapter);
  const shown = pool.filter(memoMatches);
  const html = memoDueBannerHtml(memoDueGroups(progress, today)) + shown.map(g => memoCardHtml(g, progress, today)).join('');
  return { html, shown: shown.length, total: pool.length, countKey: 'memo.count', emptyKey: 'memo.empty' };
}

// ── #screenMemo ──
// from the Study list (remember its scroll) or from a result's "Next" (keep the list's scroll)
function openMemoGroup(id) {
  if (!memoShellReady() || !memoGroupById(id)) return;
  if (byId('screenStudy').classList.contains('active')) memoView.listScrollY = window.scrollY;
  Object.assign(memoView, { id, step: MEMO_STEP.look, result: null });
  showScreen('screenMemo');
  renderMemo();
  window.scrollTo(0, 0);
}
function memoBack() {
  showScreen('screenStudy');
  renderStudy(); // study.tab is still the memo tab; statuses may have changed
  window.scrollTo(0, memoView.listScrollY);
}
function memoLook() {
  Object.assign(memoView, { step: MEMO_STEP.look, result: null });
  renderMemo();
  window.scrollTo(0, 0);
}
function renderMemo() {
  const g = memoGroupById(memoView.id);
  byId('memoTitle').textContent = g.icon + ' ' + g.title;
  byId('memoSteps').innerHTML = memoStepsHtml(g);
  byId('memoBody').innerHTML = memoView.step === MEMO_STEP.result ? memoResultHtml(g, memoView.result) : memoLookHtml(g);
}
// ① look / ② test (n); after a test both read done, the test with its score
function memoStepsHtml(g) {
  const r = memoView.result, done = memoView.step === MEMO_STEP.result;
  const look = done ? t('memo.stepLookDone') : t('memo.stepLook');
  const test = done ? t('memo.stepTestDone', { correct: r.correct, total: r.total }) : t('memo.stepTest', { n: Math.min(g.count, MEMO_TEST_SIZE) });
  return `<div class="memo-step ${done ? 'ok' : 'on'}">${escapeHtml(look)}</div><div class="memo-step${done ? ' ok' : ''}">${escapeHtml(test)}</div>`;
}

// ── ① look ──
function memoHookHtml(g) {
  if (!g.hook) return '';
  return `<div class="memo-hook"><b>${escapeHtml(t('memo.hookLabel'))}</b> <span lang="zh-HK">${escapeHtml(g.hook)}</span></div>`;
}
// the memory note without its heading line (the screen title already names the group), like the Study fact card
function memoNoteHtml(g) {
  return `<div class="memo-panel memo-note" lang="zh-HK">${noteHtml(g.body.split('\n').slice(1).join('\n'))}</div>`;
}
// the single-note group: each distinct question (English) with its own note
function memoSingleHtml(g) {
  const items = questionGroups(g.qkeys).map(keys => questionByKey(keys[0]).q).map(q =>
    `<div class="memo-single-item"><div class="memo-single-q" lang="en">${escapeHtml(q.q)}</div>`
    + `<div class="memo-single-note" lang="zh-HK">${noteHtml(q.note)}</div></div>`);
  return `<div class="memo-panel memo-single">${items.join('')}</div>`;
}
function memoLookHtml(g) {
  const body = g.body ? memoNoteHtml(g) : memoSingleHtml(g);
  return memoHookHtml(g) + body
    + `<button class="nav-btn memo-start" type="button" data-action="startMemoTest">${escapeHtml(t('memo.startTest'))}</button>`;
}

// ── ② test: a side session; its last "↩ Back" comes back here (SESSION_RETURNS.memo → finishMemoTest) ──
function startMemoTest() {
  const g = memoGroupById(memoView.id);
  if (!g) return;
  startSideSession(MEMO_PREFIX + g.id, memoTestPick(g).map(toQuestionItem), { kind: SESSION_RETURN_KIND.memo, id: g.id, recorded: false });
}
// unanswered questions count as wrong; recorded once per finished test (the return point carries the flag)
function finishMemoTest(ret) {
  if (ret.recorded) return;
  ret.recorded = true;
  const wrong = state.questions.filter((q, i) => !isCorrectAnswer(q, state.answers[i]));
  const total = state.questions.length, correct = total - wrong.length;
  const rec = recordMemoResult(ret.id, correct, total, planTodayIso());
  Object.assign(memoView, { id: ret.id, step: MEMO_STEP.result, result: { ...rec, correct, total, wrong: wrong.map(q => ({ q: q.q, yue: q.yue })) } });
  showScreen('screenMemo');
  renderMemo();
  window.scrollTo(0, 0);
}

// ── result ──
function memoVerdictText(r) {
  const params = { correct: r.correct, total: r.total, pct: Math.round(MEMO_PASS_RATIO * PERCENT), lv: r.lv };
  if (!r.passed) return t('memo.resultFail', params);
  return r.lv > r.prevLv ? t('memo.resultPass', params) : t('memo.resultKeep', params);
}
// Lv1..Lv4 with their wait; levels below the reached one are past (green), the reached one is next (orange)
function memoScheduleHtml(lv) {
  return MEMO_INTERVALS.map((days, i) => {
    const level = i + 1, cls = level < lv ? ' past' : level === lv ? ' next' : '';
    return `<div class="memo-lv${cls}"><b>${escapeHtml(t('memo.lv', { lv: level }))}</b>${escapeHtml(t('memo.days', { n: days }))}</div>`;
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
// a UI label holding a group title: the title (Cantonese data) in a lang="zh-HK" span, the rest escaped
function memoLabelHtml(label, title) {
  const at = label.indexOf(title);
  if (at < 0) return escapeHtml(label);
  return escapeHtml(label.slice(0, at)) + `<span lang="zh-HK">${escapeHtml(title)}</span>` + escapeHtml(label.slice(at + title.length));
}
function memoResultActionsHtml(g) {
  const next = memoNextGroup(g.id);
  const nextBtn = next ? `<button class="nav-btn memo-next" type="button" data-action="openMemoGroup" data-arg="${escapeHtml(next.id)}">${memoLabelHtml(t('memo.next', { title: next.title }), next.title)}</button>` : '';
  return `<div class="memo-actions"><button class="nav-btn secondary memo-again" type="button" data-action="memoLook">${escapeHtml(t('memo.again'))}</button>${nextBtn}</div>`;
}
function memoResultHtml(g, r) {
  return `<div class="memo-panel">
      <div class="memo-score${r.passed ? '' : ' fail'}"><div class="memo-pct">${percent(r.correct, r.total)}%</div><div class="memo-verdict">${escapeHtml(memoVerdictText(r))}</div></div>
      <div class="memo-sched">${memoScheduleHtml(r.lv)}</div>${memoWrongHtml(r.wrong)}
    </div>${memoResultActionsHtml(g)}`;
}
