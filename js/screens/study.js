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
const CHAPTER_ICONS = { 1: '⚖️', 2: '🇬🇧', 3: '📜', 4: '🎭', 5: '🏛️' };
const ALL_FILTER = 'all';
const STUDY_PREF_KEYS = ['tab', 'chapter', 'hideMastered', 'bookmarksOnly', 'warsOnly', 'nation', 'group'];
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
  mastered: {},
  bookmarks: {},
};

// stored prefs can be stale or hand-edited (CUI-0003): an unknown tab made renderStudy throw, so keep the default instead
const hasKey = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);
const STUDY_PREF_CHECKS = {
  tab: v => hasKey(STUDY_RENDERERS, v),
  chapter: v => CHAPTERS.includes(v),
  nation: v => v === ALL_FILTER || NATIONS.includes(v),
  group: v => v === ALL_FILTER || PEOPLE_GROUPS.includes(v),
};
function isValidStudyPref(k, v) {
  if (typeof v !== typeof study[k]) return false;
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
  window.scrollTo(0, 0);
}
function studySetTab(tab) { study.tab = tab; studySavePrefs(); renderStudy(); }
function studySetChapter(ch) { study.chapter = ch; studySavePrefs(); renderStudy(); }
function studySetNation(n) { study.nation = n; studySavePrefs(); renderStudy(); }
function studySetGroup(g) { study.group = g; studySavePrefs(); renderStudy(); }
function studySetSearch(v) { study.search = v.trim().toLowerCase(); renderStudy(); }
function studyToggle(key) { study[key] = !study[key]; studySavePrefs(); renderStudy(); }
// kind: 'mastered' | 'bookmarks' — per-fact marks, saved straight away
function studyToggleMark(kind, id) {
  const marks = study[kind];
  if (marks[id]) delete marks[id]; else marks[id] = true;
  setLS(STUDY_MARK_LS[kind], marks);
  renderStudy();
}

function factMatches(f) {
  if (study.hideMastered && study.mastered[f.id]) return false;
  if (study.bookmarksOnly && !study.bookmarks[f.id]) return false;
  if (!study.search) return true;
  const hay = (f.en + ' ' + f.yue + ' ' + (f.p ? f.p[0] : '') + ' ' + (f.yl || '')).toLowerCase();
  return hay.includes(study.search);
}
function yearLabel(f) {
  if (f.yl) return f.yl;
  if (f.y < 0) return t('study.yearBC', { n: -f.y });
  return String(f.y);
}

// ── fact card ──
function factTagsHtml(f, opts) {
  const tags = [];
  if (f.y !== undefined && !opts.noYear) tags.push(`<span class="tag year">📅 ${escapeHtml(yearLabel(f))}</span>`);
  if (f.w) tags.push(`<span class="tag war">${t('study.war')}</span>`);
  if (f.p && !opts.noPerson) tags.push(`<span class="tag person">👤 ${escapeHtml(f.p[0])}</span>`);
  if (!opts.noChapter) tags.push(`<span class="tag">${CHAPTER_ICONS[f.ch]} ${t('common.chapterShort', { n: f.ch })}</span>`);
  tags.push(`<span class="tag diff" title="${difficultyTitle(f.d)}">${'★'.repeat(f.d)}</span>`);
  if (f.src.length > 1) tags.push(`<span class="tag freq">${t('study.appears', { n: f.src.length })}</span>`);
  return tags.join('');
}
function factMarkButtonsHtml(f) {
  const mastered = !!study.mastered[f.id];
  const marked = !!study.bookmarks[f.id];
  return `<button class="fact-btn star${marked ? ' on' : ''}" title="${escapeHtml(t('study.bookmark'))}" data-action="studyToggleMark" data-mark="bookmarks" data-arg="${escapeHtml(f.id)}">${marked ? '★' : '☆'}</button>
        <button class="fact-btn tick${mastered ? ' on' : ''}" title="${escapeHtml(t('study.mastered'))}" data-action="studyToggleMark" data-mark="mastered" data-arg="${escapeHtml(f.id)}">✓</button>`;
}
function renderFact(f, opts = {}) {
  const mastered = !!study.mastered[f.id];
  return `<div class="fact${f.w ? ' war' : ''}${mastered ? ' mastered' : ''}">
    <div class="fact-top">
      <div class="fact-meta">${factTagsHtml(f, opts)}</div>
      <div class="fact-actions">
        ${factMarkButtonsHtml(f)}
      </div>
    </div>
    ${opts.title ? `<div class="fact-name">${escapeHtml(opts.title)}</div>` : ''}
    <div class="fact-en">${escapeHtml(f.en)}</div>
    <div class="fact-yue">${escapeHtml(f.yue)}</div>
  </div>`;
}

// ── chip rows ──
function studyChipsHtml() {
  let chips = chipHtml({ active: study.hideMastered, action: 'studyToggle', arg: 'hideMastered', label: t('study.hideMastered') })
    + chipHtml({ active: study.bookmarksOnly, action: 'studyToggle', arg: 'bookmarksOnly', label: t('study.bookmarkedOnly') });
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
    return CHAPTER_NUMBERS.map(ch => chipHtml({ extraCls: ' ch', active: study.chapter === ch,
      action: 'studySetChapter', arg: ch, label: `${CHAPTER_ICONS[ch]} ${t('common.chapterShort', { n: ch })}` })).join('');
  }
  if (study.tab === 'geo') return subChipRowHtml('studySetNation', study.nation, NATIONS, k => nationText(k, CHIP_FIELD));
  if (study.tab === 'people') return subChipRowHtml('studySetGroup', study.group, PEOPLE_GROUPS, k => peopleText(k, CHIP_FIELD));
  return '';
}

function renderStudy() {
  document.querySelectorAll('.study-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === study.tab));
  byId('studyChips').innerHTML = studyChipsHtml();
  const sub = studySubChipsHtml();
  const subRow = byId('studySubChips');
  subRow.innerHTML = sub;
  subRow.hidden = !sub;
  const { html, shown, total } = STUDY_RENDERERS[study.tab]();
  byId('studyCount').textContent = t('study.count', { shown, total });
  byId('studyContent').innerHTML =
    shown ? html : `<div class="study-empty">${t('study.empty')}</div>`;
}

// ── tab renderers: each returns { html, shown, total } ──
function chapterGroupHtml(ch, list) {
  const title = t('study.chapterTitle', { n: ch, title: t(`data.chapters.${ch}`) });
  return `<div class="study-group-title">${CHAPTER_ICONS[ch]} ${escapeHtml(title)} <span class="cnt">${list.length}</span></div>`
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
      <div class="tl-year">${escapeHtml(yearLabel(f))}</div>
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
    html += `<div class="study-group-title">${nationText(nation, LABEL_FIELD)} <span class="cnt">${list.length}</span></div>`;
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
    html += `<div class="study-group-title">${peopleText(group, LABEL_FIELD)} <span class="cnt">${list.length}</span></div>`;
    html += list.map(f => renderFact(f, { noPerson: true, title: f.p[0] })).join('');
  });
  return { html, shown: facts.length, total: pool.length };
}

const STUDY_RENDERERS = { chapters: renderStudyChapters, timeline: renderStudyTimeline, geo: renderStudyGeo, people: renderStudyPeople };
