// ══════════════════════════════════════════════════════════════════════
// v2.2.0 Loading + Intro mockups — shared engine.
// Flow: Loading (every launch) → Intro ×3 (first run only) → Home.
// Each option page calls Mock.init({ name, renderLoading, renderIntro, notes }).
// ══════════════════════════════════════════════════════════════════════
const Mock = (() => {
  const MOCK_LOADING_MS = 2400;   // real app: max(boot time, --splash-min-ms 800ms)
  const TIP_ROTATE_MS = 1100;     // only used by options that rotate tips while loading
  const TOAST_MS = 3200;
  const DEVICE = { mb: { w: 390, h: 844 }, pc: { w: 1280, h: 800 } };
  const FRAME_PAD = { mb: 20, pc: 36 };
  const LOGO_SRC = '../../icons/icon.svg';
  const VERSION = 'v2.2.0';

  const COPY = {
    zh: {
      appTitle: 'Life in the UK Test', appSub: '應試練習', loading: '載入中…', tipLabel: '小貼士',
      skip: '略過', next: '下一步', back: '上一步', start: '直接開始', setupPlan: '製定溫習計劃',
      langLabel: '介面語言', yueLabel: '廣東話翻譯', yueNote: '題目、答案及重點均顯示廣東話翻譯',
      langZh: '中文', langEn: 'EN', step: '{n} / 3', settingsHint: '之後可以喺 ⚙ 設定隨時更改',
      tips: [
        '正式考試共 24 題，限時 45 分鐘，答對 18 題（75%）即合格。',
        '英國由 England、Scotland、Wales 及 Northern Ireland 四部分組成。',
        '《大憲章》（Magna Carta）於 1215 年簽署，限制了國王的權力。',
        '英國國會分為下議院（House of Commons）及上議院（House of Lords）。',
        '答錯的題目會自動加入「錯題」，於主頁「我的複習」再做一次。',
      ],
      pages: [
        { kicker: '溫習', title: '想先了解背景？由知識卡讀起', body: '每個人的溫習方式都不同。想先打好基礎，就用章節、時間線、地理、人物及記憶法五種模式閱讀知識卡；難度星級及書籤助你抓緊重點。',
          chips: ['了解背景', '五種模式', '難度星級', '書籤'] },
        { kicker: '練習 · 模擬考試', title: '想操題？想操卷？', body: '想操題，就直接練習，每題即時看答案，更可一次看清所有相似題目；答錯的自動加入錯題重溫。想操卷，就做模擬考試或隨機試卷，仿照真實考試計時作答。',
          chips: ['操題', '錯題重溫', '操卷', '隨機試卷'] },
        { kicker: '溫習計劃 · 廣東話翻譯', title: '定好策略，一次合格', body: '輸入考試日期及程度，為你製定溫習策略，好好安排時間；配合廣東話翻譯，輕鬆掌握及記住要點，務求一次考過。',
          chips: ['溫習策略', '廣東話翻譯', '一次合格'] },
      ],
      demo: {
        flipFront: '《大憲章》於哪一年簽署？', flipBack: '1215 年', flipHint: '撳一下翻卡', lvUp: 'Lv0 → Lv1',
        q: 'What is the capital city of Scotland?', qYue: '蘇格蘭的首府是哪裡？',
        opts: ['Glasgow', 'Edinburgh', 'Aberdeen', 'Dundee'], correctIdx: 1,
        right: '答對！', wrong: '答錯了，已加入錯題', examChip: '模擬考試 · 24 題 · 45:00',
        yueQ: 'The UK is made up of four countries.', yueA: '英國由四個國家組成。', yueToggle: '粵',
        ring: '今日進度', done: '試過了，下一步',
      },
      home: { modes: ['溫習', '練習', '模擬考試'], chooseMode: '選擇模式', info: '關於',
        infoBody: '收錄 Life in the UK Test 官方風格題目，附廣東話翻譯及備註。', replay: '重看介紹',
        toastPlan: '已儲存設定 → 開啟「溫習計劃」設定（mock）', toastStart: '已儲存設定，歡迎使用！',
        toastSkip: '已略過介紹（之後可於 ⓘ 重看）', toastReturning: '已看過介紹的用戶：載入後直接到主頁' },
    },
    en: {
      appTitle: 'Life in the UK Test', appSub: 'Exam Practice', loading: 'Loading…', tipLabel: 'Tip',
      skip: 'Skip', next: 'Next', back: 'Back', start: 'Start now', setupPlan: 'Make a study plan',
      langLabel: 'Language', yueLabel: 'Cantonese translation', yueNote: 'Questions, answers and key points show Cantonese',
      langZh: '中文', langEn: 'EN', step: '{n} / 3', settingsHint: 'You can change these any time in ⚙ Settings',
      tips: [
        'The real test has 24 questions in 45 minutes — 18 correct (75%) to pass.',
        'The UK is made up of England, Scotland, Wales and Northern Ireland.',
        'Magna Carta was signed in 1215 and limited the power of the king.',
        'Parliament has two houses: the House of Commons and the House of Lords.',
        'Questions you get wrong go to “Wrong answers” under My Review automatically.',
      ],
      pages: [
        { kicker: 'Study', title: 'Want the background first? Start with the facts', body: 'Everyone studies differently. To build a solid base, read the fact cards in five modes: Chapters, Timeline, Geo, People and Memory. Difficulty stars and bookmarks keep you on the key points.',
          chips: ['Background', '5 study modes', 'Difficulty stars', 'Bookmarks'] },
        { kicker: 'Practice · Mock exam', title: 'Drill questions? Sit full papers?', body: 'To drill questions, practise with instant answers and see every similar question in one view; anything you get wrong goes to wrong answer review. To sit full papers, take a mock exam or a random exam, timed like the real test.',
          chips: ['Drill questions', 'Wrong answer review', 'Full papers', 'Random exam'] },
        { kicker: 'Study plan · Cantonese translation', title: 'Plan it, pass first time', body: 'Enter your test date and level to get a study strategy and use your time well. With Cantonese translation, the key points are easy to learn and remember, so you can pass first time.',
          chips: ['Study strategy', 'Cantonese translation', 'Pass first time'] },
      ],
      demo: {
        flipFront: 'When was Magna Carta signed?', flipBack: '1215', flipHint: 'Tap to flip', lvUp: 'Lv0 → Lv1',
        q: 'What is the capital city of Scotland?', qYue: '蘇格蘭的首府是哪裡？',
        opts: ['Glasgow', 'Edinburgh', 'Aberdeen', 'Dundee'], correctIdx: 1,
        right: 'Correct!', wrong: 'Not quite — added to Wrong answers', examChip: 'Mock exam · 24 Qs · 45:00',
        yueQ: 'The UK is made up of four countries.', yueA: '英國由四個國家組成。', yueToggle: '粵',
        ring: 'Today', done: 'Got it — next',
      },
      home: { modes: ['Study', 'Practice', 'Mock exam'], chooseMode: 'Choose a mode', info: 'About',
        infoBody: 'Official-style Life in the UK Test questions with Cantonese translation and notes.', replay: 'Replay intro',
        toastPlan: 'Settings saved → opening Study plan setup (mock)', toastStart: 'Settings saved — welcome!',
        toastSkip: 'Intro skipped (replay it from ⓘ)', toastReturning: 'Returning user: loading goes straight to Home' },
    },
  };

  // same path data as js/components/icons.js where it exists; the rest are mockup-only line icons
  const ICONS = {
    info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5.5', 'M12 7.5h.01'],
    gear: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z'],
    book: ['M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z', 'M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5', 'M8 7.5h8', 'M8 11h6'],
    target: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z', 'M12 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z'],
    calendar: ['M5.5 5h13a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M3.5 10h17', 'M8 3v4', 'M16 3v4'],
    check: ['M5 12.5l4.5 4.5L19 7.5'],
    arrowL: ['M15 5l-7 7 7 7'], arrowR: ['M9 5l7 7-7 7'],
    globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M3 12h18', 'M12 3a14 14 0 0 1 0 18', 'M12 3a14 14 0 0 0 0 18'],
  };
  const PAGE_ICONS = ['book', 'target', 'calendar'];

  const state = { lang: 'zh', device: 'mb', firstRun: true, yue: true };
  let opts = null;
  let timers = [];
  let els = {};

  const t = () => COPY[state.lang];
  const fmt = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
  const icon = (name, cls = '') =>
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name].map((d) => `<path d="${d}"/>`).join('')}</svg>`;
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function seg(label, key, options) {
    const btns = options.map(([v, txt]) =>
      `<button data-seg="${key}" data-val="${v}" aria-pressed="${String(state[key]) === v}">${txt}</button>`).join('');
    return `<div class="mock-seg"><span>${label}</span>${btns}</div>`;
  }

  function buildChrome() {
    document.body.insertAdjacentHTML('afterbegin', `
      <div class="mock-bar">
        <a href="intro-index.html">← 三個方案</a>
        <h1>${opts.name}<small>${VERSION} Loading + Intro</small></h1>
        ${seg('裝置', 'device', [['mb', '📱 手機'], ['pc', '🖥 電腦']])}
        ${seg('語言', 'lang', [['zh', '繁中'], ['en', 'EN']])}
        ${seg('用戶', 'firstRun', [['true', '第一次'], ['false', '已看過']])}
        <button class="mock-replay" data-act="replay">↻ 重播</button>
      </div>
      <div class="mock-stage"><div class="mock-fit"><div class="mock-frame"><div class="app" id="app"></div></div></div></div>
      <div class="mock-notes">${opts.notes || ''}</div>`);
    els = { fit: document.querySelector('.mock-fit'), frame: document.querySelector('.mock-frame'), app: document.getElementById('app') };
    document.querySelector('.mock-bar').addEventListener('click', onBarClick);
    window.addEventListener('resize', fitFrame);
  }

  function onBarClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.seg) {
      const key = b.dataset.seg;
      state[key] = key === 'firstRun' ? b.dataset.val === 'true' : b.dataset.val;
      b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }
    run();
  }

  function fitFrame() {
    const d = DEVICE[state.device];
    const pad = FRAME_PAD[state.device];
    const outerW = d.w + pad, outerH = d.h + pad + (state.device === 'pc' ? 24 : 0);
    const availW = window.innerWidth - 32;
    const availH = Math.max(480, window.innerHeight - document.querySelector('.mock-bar').offsetHeight - 32);
    const scale = Math.min(1, availW / outerW, state.device === 'pc' ? availH / outerH : 1);
    els.frame.className = `mock-frame ${state.device}`;
    els.app.style.width = `${d.w}px`;
    els.app.style.height = `${d.h}px`;
    els.app.className = `app is-${state.device} lang-${state.lang}`;
    els.frame.style.transform = `scale(${scale})`;
    els.fit.style.width = `${outerW * scale}px`;
    els.fit.style.height = `${outerH * scale}px`;
  }

  function view(cls) {
    els.app.innerHTML = `<div class="view ${cls} fade-in"></div>`;
    return els.app.firstElementChild;
  }

  function run() {
    clearTimers();
    fitFrame();
    document.documentElement.lang = state.lang === 'zh' ? 'zh-HK' : 'en';
    const root = view('loading');
    opts.renderLoading(root, ctx());
    later(() => (state.firstRun ? showIntro() : showHome(t().home.toastReturning)), MOCK_LOADING_MS);
  }

  function showIntro() {
    clearTimers();
    const root = view('intro');
    opts.renderIntro(root, ctx());
  }

  // choice: 'plan' | 'start' | 'skip'
  function finish(choice) {
    state.firstRun = false;   // real app: setLS(LS_INTRO_SEEN, true)
    document.querySelectorAll('[data-seg="firstRun"]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.val === 'false')));
    const h = t().home;
    showHome(choice === 'plan' ? h.toastPlan : choice === 'skip' ? h.toastSkip : h.toastStart);
  }

  function showHome(toast) {
    clearTimers();
    const c = t();
    const root = view('home');
    root.innerHTML = `
      <div class="home-hd"><img src="${LOGO_SRC}" alt=""><div><b>${c.appTitle}</b><small>${c.appSub} · ${VERSION}</small></div>
        <span class="sp"></span>
        <button class="hd-btn" data-home="info" aria-label="${c.home.info}">${icon('info')}</button>
        <button class="hd-btn gold" aria-label="⚙">${icon('gear')}</button></div>
      <div class="home-body"><div class="home-ttl">${c.home.chooseMode}</div>
        <div class="home-modes">${c.home.modes.map((m, i) => `<div class="home-mode"><i>${['📖', '📝', '🎯'][i]}</i>${m}</div>`).join('')}</div>
        <div class="home-ph tall"></div><div class="home-ph"></div><div class="home-ph"></div></div>
      ${toast ? `<div class="mock-toast fade-in">${toast}</div>` : ''}`;
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-home]');
      if (!b) return;
      if (b.dataset.home === 'info') toggleInfo(root);
      if (b.dataset.home === 'replay') showIntro();
    });
    if (toast) later(() => root.querySelector('.mock-toast')?.remove(), TOAST_MS);
  }

  function toggleInfo(root) {
    const open = root.querySelector('.info-pop');
    if (open) { open.remove(); return; }
    const c = t();
    root.insertAdjacentHTML('beforeend', `<div class="info-pop fade-in" role="dialog">
      <h2>${c.appTitle} <small>${VERSION}</small></h2><p>${c.home.infoBody}</p>
      <button class="new" data-home="replay">▶ ${c.home.replay} <span class="new-tag">NEW</span></button></div>`);
  }

  // one context object handed to every option renderer
  function ctx() {
    return { c: t(), state, icon, fmt, later, finish, logo: LOGO_SRC, version: VERSION,
      pageIcons: PAGE_ICONS, tipRotateMs: TIP_ROTATE_MS, randomTip: () => t().tips[Math.floor(Math.random() * t().tips.length)] };
  }

  // shared last-page settings block (language + Cantonese switch); options style it via their own CSS
  function settingsBlock(c, cls = '') {
    return `<div class="set ${cls}">
      <div class="set-row"><b>${c.langLabel}</b><div class="set-seg">
        <button data-lang="zh" aria-pressed="${state.lang === 'zh'}">${c.langZh}</button>
        <button data-lang="en" aria-pressed="${state.lang === 'en'}">${c.langEn}</button></div></div>
      <div class="set-row"><div><b>${c.yueLabel}</b><small>${c.yueNote}</small></div>
        <button class="sw" role="switch" data-yue aria-checked="${state.yue}" aria-label="${c.yueLabel}"></button></div>
</div>`;
  }

  // wires the settings block; onLang re-renders the intro at the same page in the new language
  function bindSettings(root, onLang) {
    root.addEventListener('click', (e) => {
      const l = e.target.closest('[data-lang]');
      if (l && l.dataset.lang !== state.lang) {
        state.lang = l.dataset.lang;
        document.querySelectorAll('[data-seg="lang"]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.val === state.lang)));
        els.app.className = `app is-${state.device} lang-${state.lang}`;
        onLang();
      }
      const y = e.target.closest('[data-yue]');
      if (y) { state.yue = !state.yue; y.setAttribute('aria-checked', String(state.yue)); }
    });
  }

  // horizontal swipe helper (pointer events) → cb(-1 | 1)
  function onSwipe(el, cb) {
    const MIN_SWIPE_PX = 40;
    let x0 = null;
    el.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    el.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) >= MIN_SWIPE_PX) cb(dx < 0 ? 1 : -1);
    });
  }

  function onKeys(cb) {
    document.onkeydown = (e) => {
      if (!els.app.querySelector('.view.intro')) return;
      if (e.key === 'ArrowRight') cb(1);
      if (e.key === 'ArrowLeft') cb(-1);
    };
  }

  function init(o) {
    opts = o;
    buildChrome();
    run();
  }

  return { init, settingsBlock, bindSettings, onSwipe, onKeys, showIntro };
})();
