// ════════════════════════════════════════
// FACT CARD — one STUDY fact, two variants (css/components/fact.css):
//   full: the Study card (tags, bookmark / mastered buttons)   core: the Similar panel's gold "📌 Core Fact" (Q3-1)
// Every per-fact state comes in as a parameter: this file never reads the Study screen's state object
// (upgrade-test pins its shape; structure-test checks this file does not touch it).
// ════════════════════════════════════════
const CHAPTER_ICONS = { 1: '⚖️', 2: '🇬🇧', 3: '📜', 4: '🎭', 5: '🏛️' };
const FACT_VARIANT = { full: 'full', core: 'core' };
const FACT_SRC_INLINE_MAX = 3; // more source nodes than this: on a phone the Practise button gets its own line
// the element showing the card's chapter number ("#n", or "Ch c #n" inside the pill); it also describes the Practise button
const factIdElId = f => `factId${f.id}`;

function yearLabel(f) {
  if (f.yl) return f.yl;
  if (f.y < 0) return t('study.yearBC', { n: -f.y });
  return String(f.y);
}

// CUI-0014: yl and AD numbers are English data (M3), lang="en"; the BC fallback is UI text in the page language
const yearLangAttr = f => (f.yl || f.y >= 0 ? ' lang="en"' : '');

// S-057: "Ch {ch} #{n}" (study.chapterFactId) stays English in zh-HK too
const chapterFactText = f => t('study.chapterFactId', { ch: f.ch, n: chapterFactNumber(f.id) });

// the Chapters view has no chapter pill, so the number stands alone; elsewhere the pill carries it
function factNumberHtml(f) {
  const n = chapterFactNumber(f.id);
  return `<span class="fact-id" id="${factIdElId(f)}">${t('study.factId', { n })}</span>`;
}
// S-073: Practise is described by the inner number span only, so a screen reader skips the emoji
function chapterPillHtml(f) {
  const icon = `<span aria-hidden="true">${CHAPTER_ICONS[f.ch]}</span>`;
  const num = `<span id="${factIdElId(f)}">${escapeHtml(chapterFactText(f))}</span>`;
  return `<span class="tag" lang="en">${icon} ${num}</span>`;
}

// opts: noYear / noPerson / noChapter hide a tag the surrounding list already shows
function factTagsHtml(f, opts) {
  const tags = opts.noChapter ? [factNumberHtml(f)] : [];
  if (f.y !== undefined && !opts.noYear) tags.push(`<span class="tag year"${yearLangAttr(f)}>📅 ${escapeHtml(yearLabel(f))}</span>`);
  if (f.w) tags.push(`<span class="tag war">${t('study.war')}</span>`);
  if (f.p && !opts.noPerson) tags.push(`<span class="tag person" lang="en">👤 ${escapeHtml(f.p[0])}</span>`);
  if (!opts.noChapter) tags.push(chapterPillHtml(f));
  tags.push(starsHtml(f.d)); // same stars as the question card (v0.62)
  return tags.join('');
}

// one per-fact toggle (kind = Study mark key, also the data-mark value); the visible content is an icon,
// so the label lives in aria-label (O1)
function factMarkButtonHtml(f, { kind, on, cls, labelKey, content }) {
  const label = escapeHtml(t(labelKey));
  return `<button class="fact-btn ${cls}${on ? ' on' : ''}" title="${label}" aria-label="${label}" aria-pressed="${on}" data-action="studyToggleMark" data-mark="${kind}" data-arg="${escapeHtml(f.id)}">${content}</button>`;
}
// mastered from Practice (every source question 🏆): a 🏆 in the ✓ slot that cannot be pressed — the tick would
// change nothing, the value is derived on each render (Q7). Keeps .tick for the W-009 hit ring.
function factTrophyHtml() {
  const label = escapeHtml(t('study.masteredDerived'));
  return `<button class="fact-btn tick trophy" title="${label}" aria-label="${label}" aria-disabled="true">🏆</button>`;
}
function factMarkButtonsHtml(f, marks) {
  return factMarkButtonHtml(f, { kind: 'bookmarks', on: !!marks.bookmarks, cls: 'star', labelKey: 'study.bookmark', content: bookmarkSvg('', { decorative: true }) })
    + (marks.derived ? factTrophyHtml()
      : factMarkButtonHtml(f, { kind: 'mastered', on: !!marks.mastered, cls: 'tick', labelKey: 'study.mastered', content: '✓' }));
}

// T-206: the fact's source questions as display-only nodes (Similar panel colours) + "▶ Practise this one / these N",
// a one-off session over them (js/screens/sideSession.js); replaces the old "Appears ×n" tag
function factSourceRowHtml(f) {
  const wrap = f.src.length > FACT_SRC_INLINE_MAX ? ' wrap-btn' : '';
  return `<div class="fact-src${wrap}">
      <div class="fact-src-nodes"><span class="sqm-map-label">${t('similar.appearsIn')}</span>${f.src.map(questionNodeHtml).join('')}</div>
      <button class="fact-practise" aria-describedby="${factIdElId(f)}" data-action="startFactPractice" data-arg="${escapeHtml(f.id)}">${t('similar.practise', { n: f.src.length })}</button>
    </div>`;
}

// marks: { bookmarks, mastered (ticked by hand), derived (factMastery) } booleans for this fact;
// opts: tag switches + title (People tab name line)
function factFullHtml(f, { marks = {}, opts = {} }) {
  const mastered = marks.mastered || marks.derived;
  return `<div class="fact${f.w ? ' war' : ''}${mastered ? ' mastered' : ''}" data-fact-id="${escapeHtml(f.id)}">
    <div class="fact-top">
      <div class="fact-meta">${factTagsHtml(f, opts)}</div>
      <div class="fact-actions">
        ${factMarkButtonsHtml(f, marks)}
      </div>
    </div>
    ${opts.title ? `<div class="fact-name" lang="en">${escapeHtml(opts.title)}</div>` : ''}
    <div class="fact-en" lang="en">${escapeHtml(f.en)}</div>
    <div class="fact-yue" lang="zh-HK">${escapeHtml(f.yue)}</div>
    ${factSourceRowHtml(f)}
  </div>`;
}

// no buttons and no source row: the Similar panel has its own node map
function factCoreHtml(f) {
  return `<div class="sqm-fact core">
      <div class="sqm-fact-label">${t('similar.coreFact')} <span lang="en">${escapeHtml(chapterFactText(f))}</span></div>
      <div class="sqm-fact-en" lang="en">${escapeHtml(f.en)}</div>
      <div class="sqm-fact-yue" lang="zh-HK">${escapeHtml(f.yue)}</div>
    </div>`;
}

const FACT_RENDERERS = { [FACT_VARIANT.full]: factFullHtml, [FACT_VARIANT.core]: factCoreHtml };
function factCardHtml(f, { variant = FACT_VARIANT.full, ...props } = {}) {
  return FACT_RENDERERS[variant](f, props);
}
