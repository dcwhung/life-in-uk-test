// ════════════════════════════════════════
// STUDY — fact browser: Chapters / Timeline / Geography / People, search, bookmarks, mastered marks
// ════════════════════════════════════════
const ERAS = [
  { name: 'Stone Age & Iron Age', yue: '石器·鐵器時代', max: -55 },
  { name: 'Romans', yue: '羅馬時期', max: 410 },
  { name: 'Anglo-Saxons & Vikings', yue: '盎格魯撒克遜·維京', max: 1066 },
  { name: 'Normans & Middle Ages', yue: '諾曼·中世紀', max: 1485 },
  { name: 'Tudors', yue: '都鐸王朝', max: 1603 },
  { name: 'Stuarts', yue: '斯圖亞特王朝', max: 1714 },
  { name: 'Georgian', yue: '喬治時代', max: 1837 },
  { name: 'Victorian', yue: '維多利亞時代', max: 1901 },
  { name: '20th century', yue: '20 世紀', max: 2000 },
  { name: '21st century', yue: '21 世紀', max: Infinity },
];
const NATIONS = [
  { key: 'UK', label: '🇬🇧 United Kingdom', chip: '🇬🇧 UK' },
  { key: 'England', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England', chip: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England' },
  { key: 'Scotland', label: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland', chip: '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland' },
  { key: 'Wales', label: '🏴󠁧󠁢󠁷󠁬󠁳󠁿 Wales', chip: '🏴󠁧󠁢󠁷󠁬󠁳󠁿 Wales' },
  { key: 'Northern Ireland', label: '☘️ Northern Ireland', chip: '☘️ N. Ireland' },
];
const GEO_TYPES = {
  city: '🏙️ Cities & capitals · 城市·首都',
  nature: '⛰️ Mountains, parks & nature · 山·國家公園·自然',
  landmark: '🏛️ Landmarks & buildings · 地標·建築',
  region: '🗺️ Regions & territories · 地區·領土',
};
const PEOPLE_GROUPS = [
  { key: 'monarch', label: '👑 Monarchs & rulers · 君主', chip: '👑 君主' },
  { key: 'politician', label: '🏛️ Prime Ministers, politicians & military · 首相·政治家·軍事', chip: '🏛️ 政治·軍事' },
  { key: 'scientist', label: '🔬 Scientists, inventors & engineers · 科學家·發明家', chip: '🔬 科學家' },
  { key: 'writer', label: '✒️ Writers & poets · 作家·詩人', chip: '✒️ 作家' },
  { key: 'artist', label: '🎨 Artists, architects & composers · 藝術家·建築師·音樂家', chip: '🎨 藝術家' },
  { key: 'sport', label: '🏅 Sport & exploration · 運動員·探險家', chip: '🏅 運動員' },
  { key: 'reformer', label: '✊ Reformers & others · 改革者·其他', chip: '✊ 改革者' },
];
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
  chapter: v => hasKey(CHAPTERS, v),
  nation: v => v === ALL_FILTER || NATIONS.some(n => n.key === v),
  group: v => v === ALL_FILTER || PEOPLE_GROUPS.some(g => g.key === v),
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
  if (f.y < 0) return `${-f.y} BC`;
  return String(f.y);
}

// ── fact card ──
function factTagsHtml(f, opts) {
  const tags = [];
  if (f.y !== undefined && !opts.noYear) tags.push(`<span class="tag year">📅 ${escapeHtml(yearLabel(f))}</span>`);
  if (f.w) tags.push(`<span class="tag war">⚔️ War / battle</span>`);
  if (f.p && !opts.noPerson) tags.push(`<span class="tag person">👤 ${escapeHtml(f.p[0])}</span>`);
  if (!opts.noChapter) tags.push(`<span class="tag">${CHAPTER_ICONS[f.ch]} Ch ${f.ch}</span>`);
  tags.push(`<span class="tag diff" title="Difficulty ${f.d}/${MAX_DIFFICULTY}">${'★'.repeat(f.d)}</span>`);
  if (f.src.length > 1) tags.push(`<span class="tag freq">×${f.src.length} 出現${f.src.length}次</span>`);
  return tags.join('');
}
function factMarkButtonsHtml(f) {
  const mastered = !!study.mastered[f.id];
  const marked = !!study.bookmarks[f.id];
  return `<button class="fact-btn star${marked ? ' on' : ''}" title="Bookmark 書籤" data-action="studyToggleMark" data-mark="bookmarks" data-arg="${escapeHtml(f.id)}">${marked ? '★' : '☆'}</button>
        <button class="fact-btn tick${mastered ? ' on' : ''}" title="Mastered 已掌握" data-action="studyToggleMark" data-mark="mastered" data-arg="${escapeHtml(f.id)}">✓</button>`;
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
  let chips = chipHtml({ active: study.hideMastered, action: 'studyToggle', arg: 'hideMastered', label: '✓ 隱藏已掌握' })
    + chipHtml({ active: study.bookmarksOnly, action: 'studyToggle', arg: 'bookmarksOnly', label: '★ 只顯示書籤' });
  if (study.tab === 'timeline') {
    chips += chipHtml({ extraCls: ' war', active: study.warsOnly, action: 'studyToggle', arg: 'warsOnly', label: '⚔️ 只顯示戰爭' });
  }
  return chips;
}
function subChipRowHtml(action, current, items) {
  return [{ key: ALL_FILTER, chip: 'All' }, ...items]
    .map(it => chipHtml({ extraCls: ' ch', active: current === it.key, action, arg: it.key, label: it.chip })).join('');
}
// sub-filter row: chapter / nation / people group (timeline has none)
function studySubChipsHtml() {
  if (study.tab === 'chapters') {
    return CHAPTER_NUMBERS.map(ch => chipHtml({ extraCls: ' ch', active: study.chapter === ch,
      action: 'studySetChapter', arg: ch, label: `${CHAPTER_ICONS[ch]} Ch ${ch}` })).join('');
  }
  if (study.tab === 'geo') return subChipRowHtml('studySetNation', study.nation, NATIONS);
  if (study.tab === 'people') return subChipRowHtml('studySetGroup', study.group, PEOPLE_GROUPS);
  return '';
}

function renderStudy() {
  document.querySelectorAll('.study-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === study.tab));
  byId('studyChips').innerHTML = studyChipsHtml();
  const sub = studySubChipsHtml();
  const subRow = byId('studySubChips');
  subRow.innerHTML = sub;
  // inline display rather than [hidden]: subfilter-test reads style.display
  subRow.style.display = sub ? 'flex' : 'none';
  const { html, shown, total } = STUDY_RENDERERS[study.tab]();
  byId('studyCount').textContent = `${shown} / ${total} facts`;
  byId('studyContent').innerHTML =
    shown ? html : '<div class="study-empty">No facts match. 冇符合嘅內容。</div>';
}

// ── tab renderers: each returns { html, shown, total } ──
function chapterGroupHtml(ch, list) {
  return `<div class="study-group-title">${CHAPTER_ICONS[ch]} Chapter ${ch}: ${escapeHtml(CHAPTERS[ch])} <span class="cnt">${list.length}</span></div>`
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
      html += `<div class="tl-era">${escapeHtml(era.name)} <span>${escapeHtml(era.yue)}</span></div>`;
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
  NATIONS.forEach(n => {
    const list = facts.filter(f => f.geo[0] === n.key);
    if (!list.length) return;
    html += `<div class="study-group-title">${n.label} <span class="cnt">${list.length}</span></div>`;
    Object.keys(GEO_TYPES).forEach(t => {
      const sub = list.filter(f => f.geo[1] === t);
      if (!sub.length) return;
      html += `<div class="study-sub-title">${GEO_TYPES[t]}</div>`;
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
  PEOPLE_GROUPS.forEach(g => {
    const list = facts.filter(f => f.p[1] === g.key);
    if (!list.length) return;
    sortPeople(g.key, list);
    html += `<div class="study-group-title">${g.label} <span class="cnt">${list.length}</span></div>`;
    html += list.map(f => renderFact(f, { noPerson: true, title: f.p[0] })).join('');
  });
  return { html, shown: facts.length, total: pool.length };
}

const STUDY_RENDERERS = { chapters: renderStudyChapters, timeline: renderStudyTimeline, geo: renderStudyGeo, people: renderStudyPeople };
