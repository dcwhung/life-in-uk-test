// ════════════════════════════════════════
// INTRO — v2.5.0 first-run intro (css/screens/intro.css; mockup mockups/v2.2.0/intro-b-cards.html rev 9): three cards in
// a stack — study / practice + exam / study plan + Cantonese — paged by dots, swipe or ← →. Opens after the splash when
// lifeuk.introSeen is unset (everyone once, old users too: user decision 2026-10-13); ⓘ "Replay intro" opens it again.
// An overlay above Home, not a .screen (Home stays active underneath). The test suites never get it on their own
// (isAutomatedRun, splash.js); ⓘ replay still opens it there.
// ════════════════════════════════════════
const INTRO_OVERLAY_ID = 'introOverlay';
const INTRO_PAGE_COUNT = 3;     // study, practice + exam, plan + Cantonese
const INTRO_SWIPE_PX = 40;      // a horizontal drag at least this long turns the page
const INTRO_SCENE_K_MAX = 1.4;  // an illustration grows to at most this × its design size
const INTRO_TEXT_K_MIN = 0.7;   // the card text shrinks to fit, but not below this × its size
const INTRO_TEXT_K_STEP = 0.05;
const INTRO_SAMPLE_Q = 'What limited the power of the English King in 1215?'; // a real question (the fact card's Magna Carta): the practice card, its 5 similar ones, the yue line
const INTRO_FACT_DIFFICULTY = 2;
const INTRO_FACT_ID = { ch: 1, n: 12 };   // the sample fact card's "Ch 1 #12"
const INTRO_SAMPLE_PLAN_DAYS = 21;
const INTRO_TILT_MIN = 2;
const INTRO_TILT_MAX = 8;
const INTRO_CARD_TILT_MAX = 5;
const INTRO_POP_STAGGER_S = 0.07;
// v2.5.2: pieces are laid out in rows by their measured size (fitIntroScenes → layoutIntroScene): a row of pills above
// the main card, a row below (pills, or the card's companion that overlaps its bottom edge); so they never pile up
const INTRO_ROW_GAP_PX = 10;      // between pieces in a row
const INTRO_ROW_SPACE_PX = 14;    // between a row and the main card
const INTRO_TILT_ROOM_PX = 10;     // extra edge room for the tilt, so the edge fit does not push bottom pieces up onto the card
const INTRO_JITTER_PX = 5;        // each piece moves up to this much off its spot
const INTRO_STUDY_TABS = [['study.tabChapters', '📚'], ['study.tabTimeline', '⏳'], ['study.tabGeo', '🗺️'], ['study.tabPeople', '👤'], ['study.tabMemo', '🧠']];
const INTRO_WEEK = [1, 2, 3, 4, 5, 6, 0];                 // Mon → Sun (data.weekdays is Sunday-based)
const INTRO_HEAT = ['h4', 'h3', 'h4', 'h2', 'today', '', '']; // a sample week of the plan heat colours
const INTRO_SIMILAR_MAX = 4;
const INTRO_YUE_MARK = '\u7CB5'; // the Cantonese badge character (escaped: no CJK in js/, tests/i18n-test.js)
let introPage = 0;
let introReplay = false;      // opened from ⓘ: the last card offers Back instead of the two ways in
let introReturnFocus = null; // W-088: where focus goes back to when the intro closes (ⓘ after a replay)

// W-057: a cached pre-v2.5.0 config.js has no INTRO_SEEN_LS: no first-run intro then (ⓘ replay still works)
const hasIntroSeenKey = () => typeof INTRO_SEEN_LS !== 'undefined';
const shouldShowIntro = () => hasIntroSeenKey() && !getLS(INTRO_SEEN_LS) && !(typeof isAutomatedRun === 'function' && isAutomatedRun());
const isIntroOpen = () => !!byId(INTRO_OVERLAY_ID);
const introRand = (min, max) => min + Math.random() * (max - min);
const introTilt = max => (Math.random() < 0.5 ? -1 : 1) * introRand(INTRO_TILT_MIN, max);
const introShuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
function introSample() {
  return allQuestions().find(item => item.q.q === INTRO_SAMPLE_Q) || allQuestions()[0];
}

// one absolutely placed piece of an illustration; slot = [x%, y%]
// row: main / top / bottom (layoutIntroScene places it)
function introPiece(html, { row, maxTilt = INTRO_TILT_MAX, order = 0 }) {
  const vars = `--r:${introTilt(maxTilt).toFixed(1)}deg;--d:${(order * INTRO_POP_STAGGER_S).toFixed(2)}s`;
  const cls = row === 'main' ? '' : ' front';
  return `<div class="intro-piece${cls}" data-row="${row}" style="${vars}">${html}</div>`;
}
const introMain = html => introPiece(html, { row: 'main', maxTilt: INTRO_CARD_TILT_MAX });
const introPill = (icon, label, cls = '') => `<span class="intro-pill ${cls}"><i aria-hidden="true">${icon}</i>${escapeHtml(label)}</span>`;
const introBookmark = () => `<span class="intro-bm">${bookmarkSvg('', { decorative: true })}</span>`;

// P1: five study-mode pills around a tilted fact card (stars, bookmark, memory level Lv1–Lv3)
function introStudyArt() {
  const topCount = Math.random() < 0.5 ? 2 : 3; // the five modes split 2 + 3 or 3 + 2 around the card
  const card = `<div class="intro-ui intro-fact">
      <div class="intro-row"><span class="intro-tag" lang="en">${escapeHtml(t('study.chapterFactId', INTRO_FACT_ID))}</span>${starsHtml(INTRO_FACT_DIFFICULTY)}<span class="intro-sp"></span>${introBookmark()}</div>
      <div class="intro-fact-q">${escapeHtml(t('intro.study.factQ'))}</div>
      <div class="intro-fact-a">${escapeHtml(t('intro.study.factA'))}</div>
      <div class="intro-muted">🧠 ${escapeHtml(t('intro.study.memoLv'))}</div>
      <div class="intro-lv"><i class="on"></i><i class="on"></i><i></i></div></div>`;
  const pills = introShuffle(INTRO_STUDY_TABS).map(([labelKey, icon], i) =>
    introPiece(introPill(icon, t(labelKey)), { row: i < topCount ? 'top' : 'bottom', order: i + 1 }));
  return introMain(card) + pills.join('');
}
// the sample question as a tilted card: stars, flag, A–D with the first wrong option marked wrong
function introQuestionCard(item) {
  const correct = item.q.a[0];
  const wrong = correct === 0 ? 1 : 0;
  const opts = item.q.o.map((o, i) => {
    const cls = i === correct ? ' correct' : i === wrong ? ' wrong' : '';
    return `<div class="intro-opt${cls}"><span class="intro-opt-letter">${OPTION_LETTERS[i]}</span>${escapeHtml(o)}</div>`;
  }).join('');
  return `<div class="intro-ui intro-q">
      <div class="intro-q-head"><span>${escapeHtml(t('common.questionN', { n: item.origIdx + 1 }))}</span>${starsHtml(item.q.d)}<span class="intro-sp"></span>${introBookmark()}</div>
      <div class="intro-q-text" lang="en">${escapeHtml(item.q.q)}</div>${opts}</div>`;
}
// its similar questions, as the Similar panel's nodes
function introSimilarCard(item) {
  const keys = similarKeys(item).slice(0, INTRO_SIMILAR_MAX);
  const nodes = [qKey(item), ...keys].map((k, i) => {
    const [exam, idx] = k.split('.').map(Number);
    return `<span class="${i === 0 ? 'cur' : ''}">${escapeHtml(t('similar.node', { exam, n: idx + 1 }))}</span>`;
  }).join('');
  return `<div class="intro-ui intro-sim"><div class="intro-sim-h">🔗 ${escapeHtml(t('similar.title'))}<small>${escapeHtml(t('similar.subtitle'))}</small></div>
      <div class="intro-sim-nodes">${nodes}</div></div>`;
}
// P2: question card + similar card + three pills: practice, mock exam, the 45-minute timer
function introPracticeArt(item) {
  const top = introShuffle([introPill('📝', t('home.modePractice')), introPill('🎯', t('home.modeExam'))])
    .map((h, i) => introPiece(h, { row: 'top', order: i + 2 }));
  const bottom = introShuffle([
    introPiece(introPill('⏱', `${EXAM_MINUTES}:00`, 'timer'), { row: 'bottom', order: 4 }),
    introPiece(introSimilarCard(item), { row: 'bottom', maxTilt: INTRO_CARD_TILT_MAX, order: 1 }),
  ]);
  return introMain(introQuestionCard(item)) + top.join('') + bottom.join('');
}
// a sample plan card: countdown, strategy, one week of heat, today's tasks, the day ring
function introPlanCard() {
  const week = INTRO_WEEK.map((d, i) => `<span class="${INTRO_HEAT[i]}"><i></i>${escapeHtml(INTRO_HEAT[i] === 'today' ? t('intro.plan.today') : t(`data.weekdays.${d}`))}</span>`).join('');
  const tasks = ['intro.plan.task1', 'intro.plan.task2', 'intro.plan.task3']
    .map((taskKey, i) => `<div class="intro-task${i === 0 ? ' done' : ''}"><i>${i === 0 ? '✓' : ''}</i><span>${escapeHtml(t(taskKey))}</span></div>`).join('');
  return `<div class="intro-ui intro-plan">
      <div class="intro-plan-top"><div class="intro-countdown"><span class="intro-muted">🗓️ ${escapeHtml(t('intro.plan.countdown'))}</span>
        <b>${INTRO_SAMPLE_PLAN_DAYS}</b> ${escapeHtml(t('intro.plan.days'))}<div class="intro-muted">${escapeHtml(t('intro.plan.strategy'))}</div></div>
        <div class="intro-ring"><b>65%</b></div></div>
      <div class="intro-week">${week}</div>${tasks}</div>`;
}
// P3: plan card + a Cantonese translation card (the sample question and its yue line) + a streak pill
function introPlanArt(item) {
  const yue = `<div class="intro-ui intro-yue"><span class="intro-yue-badge" aria-hidden="true">${INTRO_YUE_MARK}</span><p><span lang="en">${escapeHtml(item.q.q)}</span><span class="intro-yue-line" lang="zh-HK">${escapeHtml(item.q.yue)}</span></p></div>`;
  const bottom = introShuffle([
    introPiece(yue, { row: 'bottom', maxTilt: INTRO_CARD_TILT_MAX, order: 1 }),
    introPiece(introPill('🔥', t('intro.plan.streak')), { row: 'bottom', order: 2 }),
  ]);
  return introMain(introPlanCard()) + bottom.join('');
}

// the last card's settings: interface language + the Cantonese translation switch (the same settings as ⚙)
function introSettingsHtml() {
  const lang = getLang();
  const seg = [['zh-HK', 'app.langZh'], ['en', 'app.langEn']].map(([l, langKey]) =>
    `<button type="button" data-action="introLang" data-arg="${l}" aria-pressed="${lang === l}">${escapeHtml(t(langKey))}</button>`).join('');
  return `<div class="intro-set">
      <div class="intro-set-row"><b>${escapeHtml(t('app.language'))}</b><div class="intro-seg">${seg}</div></div>
      <div class="intro-set-row"><div><b>${escapeHtml(t('app.introTranslationFeature'))}</b><small>${escapeHtml(t('app.translationOnNote'))}</small></div>
        ${switchHtml({ id: 'introYueSwitch', on: isTranslationOn(), action: 'introToggleYue', labelKey: 'app.translationSwitchLabel' })}</div></div>`;
}
function introChipsHtml() {
  const keys = ['intro.study.chipBackground', 'intro.study.chipModes', 'intro.study.chipStars', 'intro.study.chipBookmarks'];
  return `<ul class="intro-chips">${keys.map(chipKey => `<li>✓ ${escapeHtml(t(chipKey))}</li>`).join('')}</ul>`;
}
const INTRO_PAGES = [
  { kickerKey: 'intro.study.kicker', titleKey: 'intro.study.title', bodyKey: 'intro.study.body' },
  { kickerKey: 'intro.practice.kicker', titleKey: 'intro.practice.title', bodyKey: 'intro.practice.body' },
  { kickerKey: 'intro.plan.kicker', titleKey: 'intro.plan.title', bodyKey: 'intro.plan.body' },
];
function introCardHtml(page, i, art) {
  const extra = i === 0 ? introChipsHtml() : i === INTRO_PAGE_COUNT - 1 ? introSettingsHtml() : '';
  return `<article class="intro-card p${i + 1}" data-i="${i}">
      <div class="intro-art"><div class="intro-scene">${art}</div></div>
      <div class="intro-text"><span class="intro-kicker">${escapeHtml(t(page.kickerKey))}</span>
        <h2 class="intro-title">${escapeHtml(t(page.titleKey))}</h2>
        <p class="intro-body">${escapeHtml(t(page.bodyKey))}</p>${extra}</div></article>`;
}
function introHtml() {
  const item = introSample();
  const arts = [introStudyArt(), introPracticeArt(item), introPlanArt(item)];
  const cards = INTRO_PAGES.map((page, i) => introCardHtml(page, i, arts[i]));
  const dots = cards.map((_, i) => `<button type="button" data-action="introGo" data-arg="${i}" aria-label="${escapeHtml(t('intro.step', { n: i + 1, total: INTRO_PAGE_COUNT }))}"></button>`).join('');
  return `<div class="intro-top"><span class="intro-step"></span><button type="button" class="intro-skip" data-action="introClose" data-arg="skip">${escapeHtml(t('intro.skip'))}</button></div>
    <div class="intro-stack">${cards.join('')}</div>
    <div class="intro-foot"><div class="intro-dots">${dots}</div>
      <button type="button" class="intro-btn intro-next" data-action="introNext">${escapeHtml(t('intro.next'))} →</button>
      <div class="intro-ctas">${introCtasHtml()}</div></div>`;
}
// first run: Start now / Make a study plan; a replay from ⓘ just goes back
function introCtasHtml() {
  if (introReplay) return `<button type="button" class="intro-btn" data-action="introClose" data-arg="back">${escapeHtml(t('intro.back'))}</button>`;
  return `<button type="button" class="intro-btn alt" data-action="introClose" data-arg="start">${escapeHtml(t('intro.start'))}</button>
        <button type="button" class="intro-btn" data-action="introClose" data-arg="plan">🗓️ ${escapeHtml(t('intro.makePlan'))}</button>`;
}

// keep every scattered piece at least --intro-edge-pad inside its illustration. Offsets are cleared and measured again
// (render, resize); a passed card (flown off, rotated) keeps the offsets it had. Scales come off the boxes themselves.
function fitIntroPieces(root) {
  const pad = parseFloat(getComputedStyle(root).getPropertyValue('--intro-edge-pad')) || 0;
  root.querySelectorAll('.intro-card:not([data-pos="out"]) .intro-art').forEach(art => {
    const pieces = [...art.querySelectorAll('.intro-piece')];
    pieces.forEach(el => { el.style.setProperty('--dx', '0px'); el.style.setProperty('--dy', '0px'); });
    const scene = art.querySelector('.intro-scene');
    const box = art.getBoundingClientRect();
    const scale = scene.getBoundingClientRect().width / scene.offsetWidth || 1;
    const edge = pad * (box.width / art.offsetWidth || 1);
    pieces.forEach(el => {
      const r = el.getBoundingClientRect();
      const dx = Math.max(0, box.left + edge - r.left) - Math.max(0, r.right - (box.right - edge));
      const dy = Math.max(0, box.top + edge - r.top) - Math.max(0, r.bottom - (box.bottom - edge));
      el.style.setProperty('--dx', `${dx / scale}px`);
      el.style.setProperty('--dy', `${dy / scale}px`);
    });
  });
}
// the stack: the front card, two peeking behind it, the passed ones flown off to the left
function syncIntro() {
  const root = byId(INTRO_OVERLAY_ID);
  if (!root) return;
  const last = introPage === INTRO_PAGE_COUNT - 1;
  root.querySelectorAll('.intro-card').forEach((card, i) => {
    const rel = i - introPage;
    card.dataset.pos = rel < 0 ? 'out' : String(rel);
    card.style.zIndex = String(INTRO_PAGE_COUNT - rel);
    card.toggleAttribute('inert', rel !== 0);
  });
  root.querySelector('.intro-step').textContent = t('intro.step', { n: introPage + 1, total: INTRO_PAGE_COUNT });
  root.querySelectorAll('.intro-dots button').forEach((d, i) => d.setAttribute('aria-current', String(i === introPage)));
  root.querySelector('.intro-next').hidden = last;
  root.querySelector('.intro-ctas').hidden = !last;
  root.querySelector('.intro-skip').classList.toggle('gone', last);
}
function renderIntro() {
  const root = byId(INTRO_OVERLAY_ID);
  root.setAttribute('aria-label', t('intro.dialog'));
  root.innerHTML = introHtml();
  syncIntro(); // first: it hides the footer buttons that are not in use, which sets the cards' final height
  fitIntroLayout(root);
}
// the illustrations scale to fit their half (phone) / column (desktop); then one text size that fits all three cards
function fitIntroLayout(root) {
  fitIntroScenes(root);
  fitIntroPieces(root);
  fitIntroText(root);
}
// the scene scales into the art box less the edge room on every side, so the edge fit (fitIntroPieces) rarely has to
// push a piece in (pushing at a small scale piled the pieces onto the card)
const introJitter = () => introRand(-INTRO_JITTER_PX, INTRO_JITTER_PX);
// a row's pieces side by side, centred on the scene; returns the row's width
function layoutIntroRow(pieces, y, sceneW) {
  const total = pieces.reduce((n, p) => n + p.offsetWidth, 0) + INTRO_ROW_GAP_PX * Math.max(0, pieces.length - 1);
  let x = (sceneW - total) / 2;
  pieces.forEach(p => {
    p.style.setProperty('--x', `${(x + p.offsetWidth / 2 + introJitter()).toFixed(1)}px`);
    p.style.setProperty('--y', `${(y + introJitter()).toFixed(1)}px`);
    x += p.offsetWidth + INTRO_ROW_GAP_PX;
  });
}
const introRowWidth = ps => ps.reduce((n, p) => n + p.offsetWidth, 0) + INTRO_ROW_GAP_PX * Math.max(0, ps.length - 1);
const introRowHeight = ps => Math.max(0, ...ps.map(p => p.offsetHeight));
// top row, main card, bottom row; the scene takes their size
function layoutIntroScene(scene) {
  const main = scene.querySelector('[data-row="main"]');
  const top = [...scene.querySelectorAll('[data-row="top"]')];
  const bottom = [...scene.querySelectorAll('[data-row="bottom"]')];
  const topH = introRowHeight(top), botH = introRowHeight(bottom);
  const w = Math.max(main.offsetWidth, introRowWidth(top), introRowWidth(bottom));
  const cardTop = topH ? topH + INTRO_ROW_SPACE_PX : 0;
  const cardBottom = cardTop + main.offsetHeight;
  const botTop = cardBottom + INTRO_ROW_SPACE_PX; // v2.5.2: nothing covers the card (the user saw option D hidden)
  main.style.setProperty('--x', `${w / 2}px`);
  main.style.setProperty('--y', `${cardTop + main.offsetHeight / 2}px`);
  layoutIntroRow(top, topH / 2, w);
  layoutIntroRow(bottom, botTop + botH / 2, w);
  scene.style.width = `${w}px`;
  scene.style.height = `${botH ? botTop + botH : cardBottom}px`;
}
function fitIntroScenes(root) {
  const pad = parseFloat(getComputedStyle(root).getPropertyValue('--intro-edge-pad')) || 0;
  root.querySelectorAll('.intro-art').forEach(art => {
    const scene = art.querySelector('.intro-scene');
    layoutIntroScene(scene);
    const room = 2 * (pad + INTRO_TILT_ROOM_PX);
    const k = Math.min((art.clientWidth - room) / scene.offsetWidth, (art.clientHeight - room) / scene.offsetHeight, INTRO_SCENE_K_MAX);
    scene.style.setProperty('--scene-k', k.toFixed(3));
  });
}
// shrink the shared text factor step by step until every card's text fits without scrolling (same size on every card)
function fitIntroText(root) {
  const texts = [...root.querySelectorAll('.intro-text')];
  for (let k = 1; k >= INTRO_TEXT_K_MIN; k -= INTRO_TEXT_K_STEP) {
    root.style.setProperty('--intro-fs-k', k.toFixed(2));
    if (texts.every(el => el.scrollHeight <= el.clientHeight + 1)) return;
  }
}
function introGo(n) {
  introPage = Math.max(0, Math.min(INTRO_PAGE_COUNT - 1, n));
  syncIntro();
}
// horizontal drag on the stack turns the page; vertical scrolling stays the browser's (touch-action: pan-y)
function bindIntroSwipe(root) {
  let x0 = null;
  const stack = root.querySelector('.intro-stack');
  stack.addEventListener('pointerdown', e => { x0 = e.clientX; });
  stack.addEventListener('pointercancel', () => { x0 = null; }); // S-282: a scroll took the pointer over
  stack.addEventListener('pointerup', e => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) >= INTRO_SWIPE_PX) introGo(introPage + (dx < 0 ? 1 : -1));
  });
}
function openIntro({ replay = false } = {}) {
  if (isIntroOpen()) return;
  introPage = 0;
  introReplay = replay;
  const root = document.createElement('div');
  root.id = INTRO_OVERLAY_ID;
  root.className = 'intro';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.tabIndex = -1;
  introReturnFocus = document.activeElement;
  document.body.appendChild(root);
  document.documentElement.classList.add('intro-open'); // the page under it does not scroll
  setIntroBackgroundInert(true);
  renderIntro();
  bindIntroSwipe(root);
  root.focus({ preventScroll: true });
}
// choice: skip / start / plan. Every way out counts as seen; "Make a study plan" switches the plan on if it is off
// and opens the goal form (or the schedule, when a plan exists already)
function closeIntro(choice) {
  const root = byId(INTRO_OVERLAY_ID);
  if (!root) return;
  if (hasIntroSeenKey()) setLS(INTRO_SEEN_LS, true);
  root.remove();
  document.documentElement.classList.remove('intro-open');
  setIntroBackgroundInert(false);
  if (choice !== 'plan' || !planEntryReady()) {
    restoreIntroFocus();
    if (typeof reloadForUpdate === 'function') reloadForUpdate(); // W-087: not before the plan route (it leaves Home)
    return;
  }
  if (!isStudyPlanEnabled()) setPlanFeature(true);
  if (readStudyPlan()) openPlanSchedule();
  else openPlanGoal();
}
// main.js, once the splash is done
function maybeOpenIntro() {
  if (shouldShowIntro()) openIntro();
}
function setIntroLang(lang) {
  if (lang === getLang()) return;
  setLang(lang);
  renderIntro();
  const pressed = byId(INTRO_OVERLAY_ID).querySelector('[data-action="introLang"][aria-pressed="true"]');
  if (pressed) pressed.focus({ preventScroll: true }); // W-088: the re-render dropped the focused button
}
// W-088: a modal dialog: everything else on the page is inert (no Tab, no screen reader) while it is open
// S-283: only what it made inert is restored, and the confirm modal stays live (it sits above the intro)
let introInerted = [];
function setIntroBackgroundInert(on) {
  if (!on) { introInerted.forEach(el => { el.inert = false; }); introInerted = []; return; }
  introInerted = [...document.body.children].filter(el => !el.inert && el.tagName !== 'SCRIPT' && !['introOverlay', 'confirmModal'].includes(el.id));
  introInerted.forEach(el => { el.inert = true; });
}
function restoreIntroFocus() {
  if (introReturnFocus && introReturnFocus.isConnected && introReturnFocus !== document.body) introReturnFocus.focus({ preventScroll: true });
  introReturnFocus = null;
}
function toggleIntroTranslation(el) {
  const on = !isTranslationOn();
  setTranslationOn(on);
  setSwitchOn(el, on);
  if (typeof renderTranslationSetting === 'function') renderTranslationSetting(); // the ⚙ switch shows the same setting
}
// a rotation / window resize re-fits the open intro (pieces, scenes and text are measured)
window.addEventListener('resize', () => {
  if (isIntroOpen()) fitIntroLayout(byId(INTRO_OVERLAY_ID));
});
document.addEventListener('keydown', e => {
  if (!isIntroOpen() || isConfirmOpen()) return;
  if (e.key === 'ArrowRight') introGo(introPage + 1);
  if (e.key === 'ArrowLeft') introGo(introPage - 1);
});
