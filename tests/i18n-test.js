const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
// i18n: every UI string lives in locales/en.js and is reached through t() / data-i18n.
// Static part (node): keys used in js/ and index.html exist in LOCALES.en, no en key is unused,
// en values carry no CJK (except the Cantonese labels), and no CJK is left in js/ or index.html.
// Runtime part (browser): static markup is filled, setLang persists + sets <html lang> + re-renders,
// a missing key warns and falls back, plural forms follow params.n.
const ROOT = path.resolve(__dirname, '..');
const APP_URL = process.env.APP_URL || 'file://' + path.join(ROOT, 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

// CJK ideographs, CJK punctuation (【】) and full-width forms (：); emoji are outside these ranges
const CJK = /[　-〿㐀-鿿豈-﫿＀-￯]/;
// en keeps the Cantonese section labels in Chinese (user decision, see HANDOFF.md › i18n)
const CJK_WHITELIST = ['common.yueTitle', 'common.noteLabel'];
// t(`prefix.${enumKey}…`) calls: the data enums (source keeps only the key, the label lives in data.*)
const DYNAMIC_PREFIXES = [
  'data.chapters.', 'data.chapterShort.', 'data.difficulty.', 'data.eras.',
  'data.nations.', 'data.geoTypes.', 'data.people.',
];
const SECTIONS = ['app', 'home', 'quiz', 'exam', 'result', 'review', 'similar', 'flagged', 'study', 'modal', 'common', 'data'];
const KEY_LITERAL = new RegExp(`'((?:${SECTIONS.join('|')})\\.[\\w.]+)'`, 'g');
const PLURAL_FORMS = ['zero', 'one', 'two', 'few', 'many', 'other'];

const jsFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
  d.isDirectory() ? jsFiles(path.join(dir, d.name)) : d.name.endsWith('.js') ? [path.join(dir, d.name)] : []);
const read = f => fs.readFileSync(f, 'utf8');
const rel = f => path.relative(ROOT, f);

function loadEn() {
  const file = path.join(ROOT, 'locales/en.js');
  assert(fs.existsSync(file), 'locales/en.js exists');
  return vm.runInNewContext(read(file) + '\n;LOCALES.en', {});
}
const isPlural = v => v && typeof v === 'object' && 'other' in v && Object.keys(v).every(k => PLURAL_FORMS.includes(k));
// leaf keys: strings, and plural objects counted as one key
function leaves(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix + k;
    if (typeof v === 'string' || isPlural(v)) return [[key, v]];
    return leaves(v, key + '.');
  });
}

// keys used by the source: t('a.b'), t(`data.x.${k}`) (dynamic, must be whitelisted), 'section.key' literals
// (passed on as t(labelKey); a non-literal t() argument must be named …Key), and data-i18n / data-i18n-attr in index.html
function usedKeys() {
  const statics = new Set(), dynamics = new Set(), problems = [];
  jsFiles(path.join(ROOT, 'js')).forEach(f => {
    const src = read(f).split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n'); // skip comment lines
    for (const m of src.matchAll(/(?<!function )\bt\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`|([^)'"`,]+))/g)) {
      if (m[1] !== undefined || m[2] !== undefined) statics.add(m[1] ?? m[2]);
      else if (m[3] !== undefined) {
        const cut = m[3].indexOf('${');
        if (cut === -1) statics.add(m[3]);
        else if (DYNAMIC_PREFIXES.includes(m[3].slice(0, cut))) dynamics.add(m[3].slice(0, cut));
        else problems.push(`${rel(f)}: dynamic key not whitelisted: ${m[3]}`);
      } else if (!/Key$/.test(m[4].trim())) problems.push(`${rel(f)}: t() key must be a literal or a …Key value: ${m[4]}`);
    }
    // key literals handed to t() later (t(labelKey)): any quoted string shaped like "<section>.<key>"
    for (const m of src.matchAll(KEY_LITERAL)) statics.add(m[1]);
  });
  const html = read(path.join(ROOT, 'index.html'));
  for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) statics.add(m[1]);
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    m[1].split(';').forEach(pair => statics.add(pair.split(':')[1]));
  }
  return { statics, dynamics, problems };
}

function staticChecks() {
  const en = loadEn();
  const enLeaves = leaves(en);
  const enKeys = new Set(enLeaves.map(([k]) => k));
  assert(SECTIONS.every(s => en[s] && typeof en[s] === 'object'), 'LOCALES.en has every section: ' + SECTIONS.join(', '));
  const { statics, dynamics, problems } = usedKeys();
  assert(problems.length === 0, 't() calls use literal keys or whitelisted dynamic prefixes' + (problems.length ? ': ' + problems.join(' / ') : ''));
  assert(statics.size > 50, `source uses many keys (${statics.size})`);
  const missing = [...statics].filter(k => !enKeys.has(k));
  assert(missing.length === 0, 'every key used in js/ and index.html exists in LOCALES.en' + (missing.length ? ': ' + missing.join(', ') : ''));
  const emptyPrefix = [...dynamics].filter(p => ![...enKeys].some(k => k.startsWith(p)));
  assert(emptyPrefix.length === 0, 'every dynamic prefix has keys in en' + (emptyPrefix.length ? ': ' + emptyPrefix.join(', ') : ''));
  const unused = [...enKeys].filter(k => !statics.has(k) && !DYNAMIC_PREFIXES.some(p => k.startsWith(p)));
  assert(unused.length === 0, 'no unused en keys' + (unused.length ? ': ' + unused.join(', ') : ''));
  const strings = ([, v]) => (typeof v === 'string' ? [v] : Object.values(v));
  const cjkValues = enLeaves.filter(([k, v]) => !CJK_WHITELIST.includes(k) && strings([k, v]).some(s => CJK.test(s)));
  assert(cjkValues.length === 0, 'en values have no CJK (whitelist: ' + CJK_WHITELIST.join(', ') + ')' + (cjkValues.length ? ': ' + cjkValues.map(([k]) => k).join(', ') : ''));
  assert(CJK_WHITELIST.every(k => CJK.test(enLeaves.find(([key]) => key === k)[1])), 'whitelisted Cantonese labels are in en');
  const sources = [path.join(ROOT, 'index.html'), path.join(ROOT, 'sw.js'), ...jsFiles(path.join(ROOT, 'js'))];
  const cjkLines = sources.flatMap(f => read(f).split('\n').map((l, i) => (CJK.test(l) ? `${rel(f)}:${i + 1}` : null)).filter(Boolean));
  assert(cjkLines.length === 0, 'no CJK left in js/ or index.html (data/ and locales/ excluded)' + (cjkLines.length ? ': ' + cjkLines.join(', ') : ''));
  return en;
}

async function runtimeChecks(en) {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const warns = []; pg.on('console', m => { if (m.type() === 'warning') warns.push(m.text()); });
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();
  const text = sel => pg.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());

  assert(await pg.evaluate(() => document.documentElement.lang === 'en' && getLang() === 'en'), 'default language en, <html lang="en">');
  const blank = await pg.$$eval('[data-i18n]', els => els.filter(e => !e.textContent.trim()).map(e => e.dataset.i18n));
  assert(blank.length === 0, 'every [data-i18n] element is filled' + (blank.length ? ': ' + blank.join(', ') : ''));
  const attrsOk = await pg.$$eval('[data-i18n-attr]', els => els.every(e => e.dataset.i18nAttr.split(';').every(p => {
    const [attr, key] = p.split(':');
    return e.getAttribute(attr) === t(key);
  })));
  assert(attrsOk, 'every data-i18n-attr attribute holds its en value');
  assert((await pg.getAttribute('#studySearch', 'placeholder')) === 'Search facts (English / Cantonese)', 'study search placeholder in English');
  // <title> / meta description keep an English literal for no-JS readers; init sets the same text from en
  const html = read(path.join(ROOT, 'index.html'));
  const literalTitle = html.match(/<title[^>]*>([^<]*)<\/title>/)[1];
  assert((await pg.title()) === literalTitle && literalTitle === en.app.title, '<title> = en app.title = index.html literal');
  const literalDesc = html.match(/<meta name="description" content="([^"]*)"/)[1];
  assert((await pg.getAttribute('meta[name="description"]', 'content')) === literalDesc, 'meta description from en matches the index.html literal');

  // interpolation + plurals
  assert(await pg.evaluate(() => t('common.questionRef', { exam: 9, n: 15 })) === 'Exam 9 · Q15', 'interpolation: Exam 9 · Q15');
  assert(await pg.evaluate(() => t('common.questions', { n: 1 })) === '1 question', 'plural one: 1 question');
  assert(await pg.evaluate(() => t('common.questions', { n: 408 })) === '408 questions', 'plural other: 408 questions');
  await pg.evaluate(() => {
    pendingMode = 'exam'; startExam(1);
    state.questions.forEach((q, i) => { if (i) state.answers[i] = [...q.a]; });
    submitExam();
  });
  assert((await text('#confirmMsg')).startsWith('1 question unanswered'), 'submit modal uses the singular: ' + await text('#confirmMsg'));
  await pg.click('#confirmCancel');
  // answer box Cantonese rows: Q) / A) labels come from quiz.yueQ / quiz.yueA (yue tests rely on the en text)
  assert(en.quiz.yueQ === 'Q)' && en.quiz.yueA === 'A)', 'en quiz.yueQ / quiz.yueA are Q) / A)');
  const yueLabels = await pg.evaluate(() => {
    LOCALES.en.quiz.yueQ = 'QQ)'; LOCALES.en.quiz.yueA = 'AA)';
    renderAnswerTranslation(state.questions[0]);
    const labels = [...document.querySelectorAll('#ansYue .ans-yue-row b')].map(b => b.textContent);
    LOCALES.en.quiz.yueQ = 'Q)'; LOCALES.en.quiz.yueA = 'A)';
    return labels.join(' ');
  });
  assert(yueLabels === 'QQ) AA)', 'answer box Q) / A) labels are read from the locale: ' + yueLabels);
  await pg.evaluate(() => leaveToHome());

  // missing key: warns, falls back to the key itself
  warns.length = 0;
  assert(await pg.evaluate(() => t('nope.missing')) === 'nope.missing', 'missing key returns the key');
  assert(warns.some(w => w.includes('[i18n] missing key') && w.includes('nope.missing')), 'missing key logs console.warn [i18n] missing key');

  // setLang: persists lifeuk.uiLang, sets <html lang>, re-applies static markup and re-renders the current screen;
  // a key the language lacks falls back to en (with a warning)
  await pg.click('#modeStudy');
  // Study count is a plural picked by the total: "1 / 1 fact", "3 / 12 facts"
  const studyCountFor = (shown, total) => pg.evaluate(([s, tot]) => {
    const real = STUDY_RENDERERS[study.tab];
    STUDY_RENDERERS[study.tab] = () => ({ html: '', shown: s, total: tot });
    renderStudy();
    STUDY_RENDERERS[study.tab] = real;
    const out = byId('studyCount').textContent;
    renderStudy();
    return out;
  }, [shown, total]);
  assert((await studyCountFor(1, 1)) === '1 / 1 fact', 'study count singular: 1 / 1 fact');
  assert((await studyCountFor(1, 12)) === '1 / 12 facts', 'study count plural by total: 1 / 12 facts');
  warns.length = 0;
  await pg.evaluate(() => {
    LOCALES.zz = { home: { chooseMode: 'ZZ mode' }, study: { hideMastered: 'ZZ hide' } };
    setLang('zz');
  });
  assert(await pg.evaluate(() => localStorage.getItem('lifeuk.uiLang') === JSON.stringify('zz') && getLang() === 'zz'), 'setLang persists lifeuk.uiLang');
  assert(await pg.evaluate(() => document.documentElement.lang === 'zz'), 'setLang sets <html lang>');
  assert((await text('[data-i18n="home.chooseMode"]')) === 'ZZ mode', 'setLang re-applies data-i18n markup');
  assert((await text('#studyChips .chip:first-child')) === 'ZZ hide', 'setLang re-renders the current screen (Study chips)');
  assert((await text('#studyChips .chip:nth-child(2)')) === en.study.bookmarkedOnly, 'key missing in zz falls back to en');
  assert(warns.some(w => w.includes('[i18n] missing key') && w.includes('study.bookmarkedOnly')), 'fallback to en warns');
  // an unknown language is ignored; a stored language without a locale reads as en
  await pg.evaluate(() => setLang('xx'));
  assert(await pg.evaluate(() => getLang() === 'zz'), 'setLang ignores a language with no locale');
  await pg.reload();
  assert(await pg.evaluate(() => getLang() === 'en' && document.documentElement.lang === 'en'), 'stored language without a locale falls back to en');
  // Object prototype keys are not locales (LOCALES is a plain object): a stored one loads as en without warnings
  for (const protoKey of ['constructor', '__proto__']) {
    await pg.evaluate(k => localStorage.setItem('lifeuk.uiLang', JSON.stringify(k)), protoKey);
    warns.length = 0;
    await pg.reload();
    assert(await pg.evaluate(() => getLang() === 'en' && document.documentElement.lang === 'en'), `stored '${protoKey}' loads as en`);
    assert(warns.filter(w => w.includes('[i18n]')).length === 0, `stored '${protoKey}' logs no i18n warnings (${warns.length})`);
  }
  await pg.evaluate(() => setLang('toString'));
  assert(await pg.evaluate(() => getLang() === 'en' && localStorage.getItem('lifeuk.uiLang') !== JSON.stringify('toString')), "setLang('toString') is ignored");
  await pg.evaluate(() => setLang('en'));
  assert(await pg.evaluate(() => localStorage.getItem('lifeuk.uiLang') === JSON.stringify('en')), 'setLang(en) persists');

  assert(errs.length === 0, 'no page errors: ' + errs.join(';'));
  await b.close();
}

(async () => {
  const en = staticChecks();
  await runtimeChecks(en);
  console.log('I18N PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
