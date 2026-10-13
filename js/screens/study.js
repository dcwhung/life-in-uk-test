// ════════════════════════════════════════
// STUDY — fact browser: Chapters / Timeline / Geography / People, search, bookmarks, mastered marks
// ════════════════════════════════════════
// enum keys only: labels live in locales (data.eras / data.nations / data.geoTypes / data.people)
// timeline eras: a fact belongs to the first era whose max year is above its year
const ERAS = [
  { key: 'stone', max: -55 },
  { key: 'roman', max: 410 },
  { key: 'anglo', max: 1066 },
  { key: 'norman', max: 1485 },
  { key: 'tudor', max: 1603 },
  { key: 'stuart', max: 1714 },
  { key: 'georgian', max: 1837 },
  { key: 'victorian', max: 1901 },
  { key: 'c20', max: 2000 },
  { key: 'c21', max: Infinity },
];
// = fact.geo[0] / fact.geo[1] / fact.p[1] values in data/study.js, in display order
const NATIONS = ['UK', 'England', 'Scotland', 'Wales', 'Northern Ireland'];
const GEO_TYPES = ['city', 'nature', 'landmark', 'region'];
const PEOPLE_GROUPS = ['monarch', 'politician', 'scientist', 'writer', 'artist', 'sport', 'reformer'];
const nationText = (key, field) => t(`data.nations.${key}.${field}`);
const peopleText = (key, field) => t(`data.people.${key}.${field}`);
const LABEL_FIELD = 'label';
const CHIP_FIELD = 'chip';
const ALL_FILTER = 'all';
const STUDY_PREF_KEYS = ['tab', 'chapter', 'hideMastered', 'bookmarksOnly', 'warsOnly', 'nation', 'group', 'memoChapter'];
const MEMO_TAB = 'memo'; // v1.6.0: memory-note groups (js/screens/memo.js)
const STUDY_MARK_LS = { mastered: STUDY_LS.mastered, bookmarks: STUDY_LS.bookmarks };
const UNDATED_SORT_YEAR = 9999; // monarchs without a year sort last

const study = {
  tab: 'chapters',
  chapter: 1,
  search: '',
  hideMastered: false,
  bookmarksOnly: false,
  warsOnly: false,
  nation: ALL_FILTER,   // geo sub-filter
  group: ALL_FILTER,    // people sub-filter
  memoChapter: ALL_FILTER, // memo sub-filter: ALL_FILTER or a chapter number (the group's main chapter)
  mastered: {},
  bookmarks: {},
};

// stored prefs can be stale or hand-edited (CUI-0003): an unknown tab made renderStudy throw, so keep the default instead
const hasKey = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);
// v1.6.0: the memo tab needs its screen + tab markup and js/screens/memo.js; a cached older index.html (SW cutover)
// has neither, so a stored 'memo' tab falls back to the default there
const isStudyTabReady = v => v !== MEMO_TAB || (typeof memoShellReady === 'function' && memoShellReady());
const STUDY_PREF_CHECKS = {
  tab: v => hasKey(STUDY_RENDERERS, v) && isStudyTabReady(v),
  chapter: v => CHAPTERS.includes(v),
  nation: v => v === ALL_FILTER || NATIONS.includes(v),
  group: v => v === ALL_FILTER || PEOPLE_GROUPS.includes(v),
  memoChapter: v => v === ALL_FILTER || CHAPTERS.includes(v),
};
const STUDY_PREF_MIXED_TYPES = ['memoChapter']; // 'all' or a number: its check alone decides
function isValidStudyPref(k, v) {
  if (!STUDY_PREF_MIXED_TYPES.includes(k) && typeof v !== typeof study[k]) return false;
  return !STUDY_PREF_CHECKS[k] || STUDY_PREF_CHECKS[k](v);
}
function studyLoad() {
  const stored = getLS(STUDY_LS.prefs);
  const prefs = stored && typeof stored === 'object' ? stored : {};
  STUDY_PREF_KEYS.forEach(k => {
    if (isValidStudyPref(k, prefs[k])) study[k] = prefs[k];
  });
  study.mastered = getLS(STUDY_LS.mastered) || {};
  study.bookmarks = getLS(STUDY_LS.bookmarks) || {};
}
function studySavePrefs() {
  const prefs = {};
  STUDY_PREF_KEYS.forEach(k => { prefs[k] = study[k]; });
  setLS(STUDY_LS.prefs, prefs);
}

function openStudy() {
  studyLoad();
  byId('studySearch').value = study.search;
  showScreen('screenStudy');
  renderStudy();
  setStudyScroll(0);
}
// a tab / chip in the pinned block (css/screens/study.css .study-top) picks a new list: save, redraw, show it from its start.
// v2.0.0 desktop: the controls stay in the rail beside the card panel, which would otherwise keep the old offset, so the
// panel goes back to its top (on a phone #studyContent does not scroll: a no-op); on a phone the page scrolls back so the
// list starts right under the pinned block (studyShowListStart)
function renderNewStudyList() { renderStudy(); studyPanel().scrollTop = 0; }
function studyRefilter() { studySavePrefs(); renderNewStudyList(); studyShowListStart(); }
function studySetTab(tab) { study.tab = tab; studyRefilter(); }
function studySetChapter(ch) { study.chapter = ch; studyRefilter(); }
function studySetNation(n) { study.nation = n; studyRefilter(); }
function studySetGroup(g) { study.group = g; studyRefilter(); }
function studySetMemoChapter(ch) { study.memoChapter = ch; studyRefilter(); }
function studySetSearch(v) { study.search = v.trim().toLowerCase(); renderNewStudyList(); }
function studyToggle(key) { study[key] = !study[key]; studyRefilter(); }
// v1.6.1: tapped while the list is scrolled under the pinned block, the new list would open mid-way (or past its end):
// scroll back so it starts right under the block. At rest (or unpinned, short screens) the list already starts below
// it: no-op. A cached older index.html (before v1.6.1) has no block: nothing to do. Desktop (v2.0.4 merge): the block
// is not pinned (display: contents in the rail) and the page does not scroll, only the card panel
function studyShowListStart() {
  const top = document.querySelector('#screenStudy .study-top');
  if (!top || studyPanelScrolls()) return;
  const overlap = top.getBoundingClientRect().bottom - byId('studyCount').getBoundingClientRect().top;
  if (overlap > 0) window.scrollBy(0, -overlap);
}
// the pinned block's height as --study-top-h (scroll-padding-top in css/screens/study.css): follows the tab (its chip
// rows), text size, language and rotation. Also measured on demand (W-067): while Study is hidden (a fact session) the
// observer reports 0, and a scroll right after Study shows again (flashStudyFact) runs before the observer's next
// callback. An older cached index.html has no block: nothing to measure. A browser without ResizeObserver
// (Safari < 13.1) still gets the on-demand measure (as js/screens/flagged.js otherwise)
function studySyncTopHeight() {
  const top = document.querySelector('#screenStudy .study-top');
  if (top) document.documentElement.style.setProperty('--study-top-h', `${top.offsetHeight}px`);
}
const studyTop = document.querySelector('#screenStudy .study-top');
if (studyTop && typeof ResizeObserver !== 'undefined') new ResizeObserver(studySyncTopHeight).observe(studyTop);
// W-068 (user): each chip row is one line that scrolls sideways (css/screens/study.css). A re-render (tab switch, reload,
// language) can leave the selected chip past an edge, and a browser's own focus scroll leaves a half-shown chip as it is:
// scroll the row (never the page, so no scrollIntoView, whose block axis could move it) until the chip clears the row's
// scroll-padding (its edge fade). A hidden row or screen has no box: nothing to do
function studyRevealChip(row, chip) {
  if (!chip || !row.clientWidth) return;
  const inset = parseFloat(getComputedStyle(row).scrollPaddingLeft) || 0;
  const r = row.getBoundingClientRect(), c = chip.getBoundingClientRect();
  if (c.left < r.left + inset) row.scrollLeft -= r.left + inset - c.left;
  else if (c.right > r.right - inset) row.scrollLeft += c.right - (r.right - inset);
}
const STUDY_CHIP_ROWS = ['studyChips', 'studySubChips'];
STUDY_CHIP_ROWS.forEach(id => byId(id).addEventListener('focusin', e => studyRevealChip(e.currentTarget, e.target.closest('.chip'))));
// kind: 'mastered' | 'bookmarks' — per-fact marks, saved straight away
function studyToggleMark(kind, id) {
  const marks = study[kind];
  if (marks[id]) delete marks[id]; else marks[id] = true;
  setLS(STUDY_MARK_LS[kind], marks);
  rerenderCurrentScreen(); // Study, or a study plan reading card (#screenPlanRun) with the same buttons
}

// mastered = ticked by hand OR every source question 🏆 in Practice (derived on each render, never stored)
function isFactMastered(f) { return !!study.mastered[f.id] || factMastery(f).derived; }
function factMatches(f) {
  if (study.hideMastered && isFactMastered(f)) return false;
  if (study.bookmarksOnly && !study.bookmarks[f.id]) return false;
  if (!study.search) return true;
  const hay = (f.en + ' ' + f.yue + ' ' + (f.p ? f.p[0] : '') + ' ' + (f.yl || '')).toLowerCase();
  return hay.includes(study.search);
}

// ── fact card (js/components/factCard.js, full variant): this screen hands it the fact's marks ──
function factMarks(f) {
  return { bookmarks: !!study.bookmarks[f.id], mastered: !!study.mastered[f.id], derived: factMastery(f).derived };
}
function renderFact(f, opts = {}) {
  return factCardHtml(f, { variant: FACT_VARIANT.full, marks: factMarks(f), opts });
}

// ── chip rows ──
function studyChipsHtml() {
  // decorative icon: the chip text already says "Bookmarked" (a labelled SVG would read "Flagged")
  const bookmarkLabel = bookmarkSvg('chip-flag', { decorative: true }) + t('study.bookmarkedOnly');
  // v1.6.1: the ✓ before "Hide mastered" is the check line icon (the fact card's mastered tick)
  const masteredLabel = iconLabelHtml(t('study.hideMastered'), { lead: 'check' });
  let chips = chipHtml({ extraCls: ' with-icon', active: study.hideMastered, action: 'studyToggle', arg: 'hideMastered', label: masteredLabel })
    + chipHtml({ active: study.bookmarksOnly, action: 'studyToggle', arg: 'bookmarksOnly', label: bookmarkLabel });
  if (study.tab === 'timeline') {
    chips += chipHtml({ extraCls: ' war', active: study.warsOnly, action: 'studyToggle', arg: 'warsOnly', label: t('study.warsOnly') });
  }
  return chips;
}
// "All" + one chip per enum key; chipText(key) gives the chip label
function subChipRowHtml(action, current, keys, chipText) {
  return [{ key: ALL_FILTER, chip: t('study.all') }, ...keys.map(key => ({ key, chip: chipText(key) }))]
    .map(it => chipHtml({ extraCls: ' ch', active: current === it.key, action, arg: it.key, label: it.chip })).join('');
}
// sub-filter row: chapter / nation / people group (timeline has none)
function studySubChipsHtml() {
  if (study.tab === 'chapters') {
    // S-057: "Ch {n}" stays English in zh-HK too; chipHtml takes no attributes, so a bare span carries the lang
    return CHAPTER_NUMBERS.map(ch => chipHtml({ extraCls: ' ch', active: study.chapter === ch, action: 'studySetChapter', arg: ch,
      label: `${CHAPTER_ICONS[ch]} <span lang="en">${escapeHtml(t('common.chapterShort', { n: ch }))}</span>` })).join('');
  }
  if (study.tab === 'geo') return subChipRowHtml('studySetNation', study.nation, NATIONS, k => nationText(k, CHIP_FIELD));
  if (study.tab === 'people') return subChipRowHtml('studySetGroup', study.group, PEOPLE_GROUPS, k => peopleText(k, CHIP_FIELD));
  if (study.tab === MEMO_TAB) return memoChapterChipsHtml();
  return '';
}

// ── v2.0.0 desktop layout (≥ 1024px; mockup mockups/v2.0.0/desktop-study.html A rev 4, css/screens/study.css) ──
// One screen high: a left rail (20%: search, tabs, sub chips, count, then the filter chips at its foot) beside the
// card panel, which scrolls on its own with fades (js/components/fit.js). index.html keeps the flat phone markup, so
// the wrappers are added here once; below 1024px they are display: contents and the phone layout is unchanged.
// v2.0.4 merge: the v1.6.1 pinned block (.study-top: tabs + chip rows) moves into the rail as one piece and is
// display: contents there (css/screens/study.css), so the rail still lays out search, tabs, chips, count. An older cached
// index.html (before v1.6.1) has no block: its tabs and chip rows go into the rail one by one, as in v2.0.0
const STUDY_RAIL_IDS = ['studySearch', 'studyTabs', 'studyChips', 'studySubChips', 'studyCount'];
function studyRailEls() {
  const top = document.querySelector('#screenStudy .study-top');
  if (!top) return STUDY_RAIL_IDS.map(byId).filter(Boolean);
  return [byId('studySearch'), top, byId('studyCount')].filter(Boolean);
}
function wrapStudyEl(cls, children) {
  const box = document.createElement('div');
  box.className = cls;
  box.append(...children);
  return box;
}
function ensureStudyLayout() {
  const screen = byId('screenStudy');
  if (screen.querySelector('.study-cols')) return;
  const content = byId('studyContent');
  const rail = wrapStudyEl('study-rail', studyRailEls());
  content.classList.add('fit-panel');
  const cols = wrapStudyEl('study-cols fit-grow', [rail, wrapStudyEl('study-main fit-fade', [content])]);
  screen.append(cols);
  screen.classList.add('is-fit');
}
// desktop: the filter chips sit at the rail's foot, after the count; phone: above the sub chips as before. The node
// moves (not css order) so the Tab order follows what is seen; it only moves when its place is wrong
function placeStudyFilterChips(desktop) {
  const chips = byId('studyChips'), count = byId('studyCount'), sub = byId('studySubChips');
  if (!chips || !count || !sub) return;
  if (desktop && count.nextElementSibling !== chips) deskKeepFocus(() => count.after(chips)); // S-228
  if (!desktop && chips.nextElementSibling !== sub) deskKeepFocus(() => sub.before(chips));
}
// the cards scroll in their panel on desktop and with the page on a phone (js/screens/sideSession.js keeps the
// offset across a fact's Practice session)
const studyPanel = () => byId('studyContent');
const studyPanelScrolls = () => typeof isDesktop === 'function' && isDesktop();
function studyScrollTop() { return studyPanelScrolls() ? studyPanel().scrollTop : window.scrollY; }
function setStudyScroll(y) {
  studyPanel().scrollTop = studyPanelScrolls() ? y : 0;
  window.scrollTo(0, studyPanelScrolls() ? 0 : y);
}

// a chip row holds markup or hides (the memo tab has no Hide mastered / Bookmarked chips)
function fillChipRow(id, html) {
  const row = byId(id);
  row.innerHTML = html;
  row.hidden = !html;
}
function renderStudy() {
  ensureStudyLayout();
  document.querySelectorAll('.study-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === study.tab));
  fillChipRow('studyChips', study.tab === MEMO_TAB ? '' : studyChipsHtml());
  fillChipRow('studySubChips', studySubChipsHtml());
  STUDY_CHIP_ROWS.forEach(id => studyRevealChip(byId(id), byId(id).querySelector('.chip.active')));
  byId('studySearch').placeholder = study.tab === MEMO_TAB ? t('memo.search') : t('study.search');
  // a renderer may name its own count / empty-state words (memo: groups, not facts)
  const { html, shown, total, countKey = 'study.count', emptyKey = 'study.empty' } = STUDY_RENDERERS[study.tab]();
  byId('studyCount').textContent = t(countKey, { shown, total, n: total });
  renderStudyProgress();
  byId('studyContent').innerHTML =
    shown ? html : `<div class="study-empty">${t(emptyKey)}</div>`;
  desktopRefit('screenStudy', placeStudyFilterChips); // registered lazily (js/components/deskPlace.js)
}

// Q8: after ↩ Back from a fact session its card flashes gold; R-010: when the restored scroll no longer shows it
// (the list changed while practising) bring it into view. Gone (e.g. Hide mastered): nothing to do.
// CUI-0036 (user 2026-10-12: align the card top): when the card's top is hidden (behind the pinned block on a phone,
// above the card panel's edge on desktop) it lands right under the block / below the panel's top fade ('start': phone
// scroll-padding-top = header + block, css/screens/study.css; desktop scroll-margin-top = the fade), so its year / title
// show even when the card is taller than the room and its ▶ goes off-screen. 'nearest' left a tall card's top hidden
// (both edges out of view: no scroll). A card whose top already shows keeps the restored scroll ('nearest', as before)
function studyCardTopHidden(el) {
  const top = el.getBoundingClientRect().top;
  if (studyPanelScrolls()) {
    return top < studyPanel().getBoundingClientRect().top - 1; // above the panel's edge (inside the fade still reads)
  }
  return top < (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) - 1;
}
function flashStudyFact(id) {
  const el = document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`);
  if (!el) return;
  studySyncTopHeight(); // W-067: Study was hidden a moment ago, so --study-top-h may still read 0
  el.scrollIntoView({ block: studyCardTopHidden(el) ? 'start' : 'nearest' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), FACT_HIGHLIGHT_MS);
}

// O7: "🏆 n / STUDY.length" over every fact (v1.2.0, Q11: "mastered" moved to the tooltip / label so the header fits one row).
// A cached pre-v0.63 index.html has no #studyProgress (SW cutover)
function renderStudyProgress() {
  const el = byId('studyProgress');
  if (!el) return;
  const counts = { n: STUDY.filter(isFactMastered).length, total: STUDY.length };
  el.textContent = t('study.progress', counts);
  setAccessibleName(el, t('study.progressLabel', counts));
}

// ── tab renderers: each returns { html, shown, total } ──
function chapterGroupHtml(ch, list) {
  const title = t('study.chapterTitle', { n: ch, title: t(`data.chapters.${ch}`) });
  // S-049: study.chapterTitle and the chapter name are English in every language (plan Q10)
  return `<div class="study-group-title" lang="en">${CHAPTER_ICONS[ch]} ${escapeHtml(title)}</div>`
    + list.map(f => renderFact(f, { noChapter: true })).join('');
}
function renderStudyChapters() {
  // when searching, look across all chapters (same rule for nation / people-group filters)
  const pool = study.search ? STUDY : STUDY.filter(f => f.ch === study.chapter);
  const facts = pool.filter(factMatches);
  const chapters = study.search ? CHAPTER_NUMBERS : [study.chapter];
  const html = chapters.map(ch => {
    const list = facts.filter(f => f.ch === ch);
    return study.search && !list.length ? '' : chapterGroupHtml(ch, list);
  }).join('');
  return { html, shown: facts.length, total: pool.length };
}

function eraOf(y) { return ERAS.find(e => y < e.max); }
function renderStudyTimeline() {
  const pool = STUDY.filter(f => f.y !== undefined && (!study.warsOnly || f.w));
  const facts = pool.filter(factMatches).sort((a, b) => a.y - b.y || a.id - b.id);
  let html = '', lastEra = null;
  facts.forEach(f => {
    const era = eraOf(f.y);
    if (era !== lastEra) {
      html += `<div class="tl-era">${escapeHtml(t(`data.eras.${era.key}`))}</div>`;
      lastEra = era;
    }
    html += `<div class="tl-item${f.w ? ' war' : ''}">
      <div class="tl-year"${yearLangAttr(f)}>${escapeHtml(yearLabel(f))}</div>
      <div class="tl-body">${renderFact(f, { noYear: true })}</div>
    </div>`;
  });
  return { html, shown: facts.length, total: pool.length };
}

function renderStudyGeo() {
  const pool = STUDY.filter(f => f.geo && (study.search || study.nation === ALL_FILTER || f.geo[0] === study.nation));
  const facts = pool.filter(factMatches);
  let html = '';
  NATIONS.forEach(nation => {
    const list = facts.filter(f => f.geo[0] === nation);
    if (!list.length) return;
    html += `<div class="study-group-title">${nationText(nation, LABEL_FIELD)}</div>`;
    GEO_TYPES.forEach(type => {
      const sub = list.filter(f => f.geo[1] === type);
      if (!sub.length) return;
      html += `<div class="study-sub-title">${t(`data.geoTypes.${type}`)}</div>`;
      html += sub.map(f => renderFact(f)).join('');
    });
  });
  return { html, shown: facts.length, total: pool.length };
}

function sortPeople(group, list) {
  return group === 'monarch'
    ? list.sort((a, b) => (a.y ?? UNDATED_SORT_YEAR) - (b.y ?? UNDATED_SORT_YEAR) || a.id - b.id)
    : list.sort((a, b) => a.p[0].localeCompare(b.p[0]));
}
function renderStudyPeople() {
  const pool = STUDY.filter(f => f.p && (study.search || study.group === ALL_FILTER || f.p[1] === study.group));
  const facts = pool.filter(factMatches);
  let html = '';
  PEOPLE_GROUPS.forEach(group => {
    const list = facts.filter(f => f.p[1] === group);
    if (!list.length) return;
    sortPeople(group, list);
    html += `<div class="study-group-title">${peopleText(group, LABEL_FIELD)}</div>`;
    html += list.map(f => renderFact(f, { noPerson: true, title: f.p[0] })).join('');
  });
  return { html, shown: facts.length, total: pool.length };
}

// memo: an arrow, because js/screens/memo.js loads after this file
const STUDY_RENDERERS = {
  chapters: renderStudyChapters, timeline: renderStudyTimeline, geo: renderStudyGeo, people: renderStudyPeople,
  [MEMO_TAB]: () => renderStudyMemo(),
};
