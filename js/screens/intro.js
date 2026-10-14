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
const INTRO_SAMPLE_Q = 'What limited the power of the English King in 1215?'; // a real question (the fact card's Magna Carta): the practice card, its 5 similar ones, the yue line
const INTRO_FACT_DIFFICULTY = 2;
const INTRO_SAMPLE_PLAN_DAYS = 21;
const INTRO_JITTER_PCT = 4;     // scattered pieces: slot ± this, then a tilt of MIN–MAX deg either way (cards tilt less)
const INTRO_TILT_MIN = 2;
const INTRO_TILT_MAX = 8;
const INTRO_CARD_TILT_MAX = 5;
const INTRO_POP_STAGGER_S = 0.07;
// slots in % of the illustration: the main card in the middle, pills along the top and bottom edges
const INTRO_SLOTS = {
  study: { card: [50, 52], pills: [[17, 8], [52, 7], [84, 9], [16, 91], [52, 92], [84, 91]] },
  practice: { card: [40, 46], extra: [66, 88], pills: [[22, 7], [78, 7], [18, 93]] },
  plan: { card: [44, 33], extra: [62, 90], pills: [[16, 92]] },
};
const INTRO_STUDY_TABS = [['study.tabChapters', '📚'], ['study.tabTimeline', '⏳'], ['study.tabGeo', '🗺️'], ['study.tabPeople', '👤'], ['study.tabMemo', '🧠']];
const INTRO_WEEK = [1, 2, 3, 4, 5, 6, 0];                 // Mon → Sun (data.weekdays is Sunday-based)
const INTRO_HEAT = ['h4', 'h3', 'h4', 'h2', 'today', '', '']; // a sample week of the plan heat colours
const INTRO_SIMILAR_MAX = 4;
const INTRO_YUE_MARK = '\u7CB5'; // the Cantonese badge character (escaped: no CJK in js/, tests/i18n-test.js)
let introPage = 0;

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
function introPiece(html, [x, y], { front = false, maxTilt = INTRO_TILT_MAX, order = 0 } = {}) {
  const jx = (x + introRand(-INTRO_JITTER_PCT, INTRO_JITTER_PCT)).toFixed(1);
  const jy = (y + introRand(-INTRO_JITTER_PCT, INTRO_JITTER_PCT)).toFixed(1);
  const vars = `--x:${jx}%;--y:${jy}%;--r:${introTilt(maxTilt).toFixed(1)}deg;--d:${(order * INTRO_POP_STAGGER_S).toFixed(2)}s`;
  return `<div class="intro-piece${front ? ' front' : ''}" style="${vars}">${html}</div>`;
}
const introPill = (icon, label, cls = '') => `<span class="intro-pill ${cls}"><i aria-hidden="true">${icon}</i>${escapeHtml(label)}</span>`;
const introBookmark = () => `<span class="intro-bm">${bookmarkSvg('', { decorative: true })}</span>`;

// P1: five study-mode pills around a tilted fact card (stars, bookmark, memory level Lv1–Lv3)
function introStudyArt() {
  const slots = introShuffle(INTRO_SLOTS.study.pills);
  const card = `<div class="intro-ui intro-fact">
      <div class="intro-row"><span class="intro-tag">Ch 1 #12</span>${starsHtml(INTRO_FACT_DIFFICULTY)}<span class="intro-sp"></span>${introBookmark()}</div>
      <div class="intro-fact-q">${escapeHtml(t('intro.study.factQ'))}</div>
      <div class="intro-fact-a">${escapeHtml(t('intro.study.factA'))}</div>
      <div class="intro-muted">🧠 ${escapeHtml(t('intro.study.memoLv'))}</div>
      <div class="intro-lv"><i class="on"></i><i class="on"></i><i></i></div></div>`;
  const pills = INTRO_STUDY_TABS.map(([labelKey, icon], i) => introPiece(introPill(icon, t(labelKey)), slots[i], { front: true, order: i + 1 }));
  return introPiece(card, INTRO_SLOTS.study.card, { maxTilt: INTRO_CARD_TILT_MAX }) + pills.join('');
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
  const slots = introShuffle(INTRO_SLOTS.practice.pills);
  const pills = [introPill('📝', t('home.modePractice')), introPill('🎯', t('home.modeExam')), introPill('⏱', '45:00', 'timer')]
    .map((h, i) => introPiece(h, slots[i], { front: true, order: i + 2 }));
  return introPiece(introQuestionCard(item), INTRO_SLOTS.practice.card, { maxTilt: INTRO_CARD_TILT_MAX })
    + introPiece(introSimilarCard(item), INTRO_SLOTS.practice.extra, { front: true, maxTilt: INTRO_CARD_TILT_MAX, order: 1 })
    + pills.join('');
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
  return introPiece(introPlanCard(), INTRO_SLOTS.plan.card, { maxTilt: INTRO_CARD_TILT_MAX })
    + introPiece(yue, INTRO_SLOTS.plan.extra, { front: true, maxTilt: INTRO_CARD_TILT_MAX, order: 1 })
    + introPiece(introPill('🔥', t('intro.plan.streak')), introShuffle(INTRO_SLOTS.plan.pills)[0], { front: true, order: 2 });
}

// the last card's settings: interface language + the Cantonese translation switch (the same settings as ⚙)
function introSettingsHtml() {
  const lang = getLang();
  const seg = [['zh-HK', 'app.langZh'], ['en', 'app.langEn']].map(([l, langKey]) =>
    `<button type="button" data-action="introLang" data-arg="${l}" aria-pressed="${lang === l}">${escapeHtml(t(langKey))}</button>`).join('');
  return `<div class="intro-set">
      <div class="intro-set-row"><b>${escapeHtml(t('app.language'))}</b><div class="intro-seg">${seg}</div></div>
      <div class="intro-set-row"><div><b>${escapeHtml(t('app.translationFeature'))}</b><small>${escapeHtml(t('app.translationOnNote'))}</small></div>
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
  const dots = cards.map((_, i) => `<button type="button" data-action="introGo" data-arg="${i}" aria-label="${i + 1}"></button>`).join('');
  return `<div class="intro-top"><span class="intro-step"></span><button type="button" class="intro-skip" data-action="introClose" data-arg="skip">${escapeHtml(t('intro.skip'))}</button></div>
    <div class="intro-stack">${cards.join('')}</div>
    <div class="intro-foot"><div class="intro-dots">${dots}</div>
      <button type="button" class="intro-btn intro-next" data-action="introNext">${escapeHtml(t('intro.next'))} →</button>
      <div class="intro-ctas"><button type="button" class="intro-btn alt" data-action="introClose" data-arg="start">${escapeHtml(t('intro.start'))}</button>
        <button type="button" class="intro-btn" data-action="introClose" data-arg="plan">🗓️ ${escapeHtml(t('intro.makePlan'))}</button></div></div>`;
}

// keep every scattered piece at least --intro-edge-pad inside its illustration; measured once per render, before
// the stack transforms apply (the desktop scene's scale is read off the scene box)
function fitIntroPieces(root) {
  const pad = parseFloat(getComputedStyle(root).getPropertyValue('--intro-edge-pad')) || 0;
  root.querySelectorAll('.intro-art').forEach(art => {
    const scene = art.querySelector('.intro-scene');
    const box = art.getBoundingClientRect();
    const scale = scene.getBoundingClientRect().width / scene.offsetWidth || 1;
    art.querySelectorAll('.intro-piece').forEach(el => {
      const r = el.getBoundingClientRect();
      const dx = Math.max(0, box.left + pad - r.left) - Math.max(0, r.right - (box.right - pad));
      const dy = Math.max(0, box.top + pad - r.top) - Math.max(0, r.bottom - (box.bottom - pad));
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
  fitIntroPieces(root);
  syncIntro();
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
  stack.addEventListener('pointerup', e => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) >= INTRO_SWIPE_PX) introGo(introPage + (dx < 0 ? 1 : -1));
  });
}
function openIntro() {
  if (isIntroOpen()) return;
  introPage = 0;
  const root = document.createElement('div');
  root.id = INTRO_OVERLAY_ID;
  root.className = 'intro';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.tabIndex = -1;
  document.body.appendChild(root);
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
  if (typeof reloadForUpdate === 'function') reloadForUpdate(); // an update held back while the intro was up (pwa.js)
  if (choice !== 'plan' || !planEntryReady()) return;
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
}
function toggleIntroTranslation(el) {
  const on = !isTranslationOn();
  setTranslationOn(on);
  setSwitchOn(el, on);
  if (typeof renderTranslationSetting === 'function') renderTranslationSetting(); // the ⚙ switch shows the same setting
}
document.addEventListener('keydown', e => {
  if (!isIntroOpen() || isConfirmOpen()) return;
  if (e.key === 'ArrowRight') introGo(introPage + 1);
  if (e.key === 'ArrowLeft') introGo(introPage - 1);
});
