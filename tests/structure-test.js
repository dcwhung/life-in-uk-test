const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
// Code structure guards: no inline event handlers, short functions, index.html holds only markup,
// and the page loads from file:// with no page errors or console errors.
const ROOT = path.resolve(__dirname, '..');
const APP_URL = process.env.APP_URL || 'file://' + path.join(ROOT, 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
const MAX_FUNCTION_LINES = 30;

const jsFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
  d.isDirectory() ? jsFiles(path.join(dir, d.name)) : d.name.endsWith('.js') ? [path.join(dir, d.name)] : []);
const cssFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
  d.isDirectory() ? cssFiles(path.join(dir, d.name)) : d.name.endsWith('.css') ? [path.join(dir, d.name)] : []);
const TOKENS_CSS = path.join(ROOT, 'css', 'base', 'tokens.css');
const sources = [path.join(ROOT, 'index.html'), path.join(ROOT, 'sw.js'), ...jsFiles(path.join(ROOT, 'js'))];
const rel = f => path.relative(ROOT, f);

// top-level `function name(` / `const name = (…) => {` blocks, measured by brace depth
function longFunctions(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^(async )?function |^const \w+ = .*=> *\{$/.test(lines[i])) continue;
    let depth = 0, j = i;
    for (; j < lines.length; j++) {
      depth += (lines[j].match(/\{/g) || []).length - (lines[j].match(/\}/g) || []).length;
      if (depth <= 0) break;
    }
    if (j - i + 1 > MAX_FUNCTION_LINES) out.push(`${rel(file)}:${i + 1} (${j - i + 1} lines)`);
  }
  return out;
}

// every action name the markup can produce: data-action / data-input-action literals, `action: 'x'`
// options, and the action argument of dotButtonHtml / subChipRowHtml
function actionNames() {
  const names = new Set();
  sources.forEach(f => {
    const src = fs.readFileSync(f, 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n'); // skip comments
    for (const m of src.matchAll(/data-(?:input-)?action="(\w+)"/g)) names.add(m[1]);
    for (const m of src.matchAll(/\baction: '(\w+)'/g)) names.add(m[1]);
    for (const m of src.matchAll(/(?:dotButtonHtml|subChipRowHtml)\((.*)/g)) {
      for (const q of m[1].matchAll(/'(\w+)'/g)) names.add(q[1]);
    }
  });
  return [...names];
}

(async () => {
  const inline = sources.flatMap(f => fs.readFileSync(f, 'utf8').split('\n')
    .map((line, i) => (/\son[a-z]+\s*=\s*["'`]/.test(line) ? `${rel(f)}:${i + 1}` : null)).filter(Boolean));
  assert(inline.length === 0, 'no inline on*= handlers in index.html / js' + (inline.length ? ': ' + inline.join(', ') : ''));

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(!/<style/i.test(html) && !/<script(?![^>]*\ssrc=)[^>]*>/i.test(html), 'index.html has no inline <style> / <script> blocks');
  assert(!/\sstyle="/.test(html.replace(/id="progressFill" style="width:0%"/, '')), 'index.html has no inline style attributes (except the progress width)');

  const long = jsFiles(path.join(ROOT, 'js')).flatMap(longFunctions);
  assert(long.length === 0, `every function is <= ${MAX_FUNCTION_LINES} lines` + (long.length ? ': ' + long.join(', ') : ''));

  // colours live only in tokens.css; every other stylesheet uses var(--…)
  const colourLiterals = cssFiles(path.join(ROOT, 'css')).filter(f => f !== TOKENS_CSS).flatMap(f =>
    fs.readFileSync(f, 'utf8').split('\n')
      .map((line, i) => (/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(line) ? `${rel(f)}:${i + 1}` : null)).filter(Boolean));
  assert(colourLiterals.length === 0, 'no hex / rgb() colour literals in css outside css/base/tokens.css'
    + (colourLiterals.length ? ': ' + colourLiterals.join(', ') : ''));

  // v0.60: white-on-dark text uses the 3 semantic steps (strong / muted / faint), not the old value-named alphas
  const oldInverse = cssFiles(path.join(ROOT, 'css')).flatMap(f =>
    fs.readFileSync(f, 'utf8').split('\n')
      .map((line, i) => (/--text-inverse-[0-9]/.test(line) ? `${rel(f)}:${i + 1}` : null)).filter(Boolean));
  assert(oldInverse.length === 0, 'no value-named --text-inverse-NN tokens in css (use strong / muted / faint)'
    + (oldInverse.length ? ': ' + oldInverse.join(', ') : ''));

  // v0.62 (P3 Q2-a): purple means Cantonese only — Study / Home chrome uses the navy --study-accent* tokens;
  // the only purple rules left in these files are the Cantonese lines .fact-yue / .sqm-fact-yue (v0.63: fact.css)
  const STUDY_CHROME_CSS = ['css/screens/study.css', 'css/components/chips.css', 'css/screens/home.css', 'css/components/fact.css'];
  const purpleChrome = STUDY_CHROME_CSS.flatMap(f => fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n')
    .map((line, i) => (/--purple|--year-bg/.test(line) && !/^\.(sqm-)?fact-yue\b/.test(line) ? `${f}:${i + 1}` : null)).filter(Boolean));
  assert(purpleChrome.length === 0, 'Study / Home chrome css has no --purple* / --year-bg (only the Cantonese lines)'
    + (purpleChrome.length ? ': ' + purpleChrome.join(', ') : ''));

  // v0.63 (P3 T-201): the fact card component gets every mark / mastery value as a parameter — it never reads the
  // Study screen's `study` object (upgrade-test pins that object's shape); `.fact*` rules live in fact.css only
  const FACT_CARD_JS = path.join(ROOT, 'js/components/factCard.js');
  assert(fs.existsSync(FACT_CARD_JS), 'js/components/factCard.js exists');
  const factCardCode = fs.readFileSync(FACT_CARD_JS, 'utf8')
    .replace(/\/\/.*$/gm, '').replace(/'[^'\n]*'|`[^`]*`|"[^"\n]*"/g, "''"); // code only: no comments / strings ('study.x' keys)
  assert(!/\bstudy\b/.test(factCardCode), 'js/components/factCard.js does not read the study global');
  const factRules = f => {
    const file = path.join(ROOT, f);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(l => /^\.(fact|sqm-fact)\b/.test(l)).length : 0;
  };
  assert(factRules('css/screens/study.css') === 0 && factRules('css/screens/quiz.css') === 0 && factRules('css/components/fact.css') > 0,
    '.fact* / .sqm-fact* rules live in css/components/fact.css only');

  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  pg.on('requestfailed', r => errs.push('request failed: ' + r.url()));
  await pg.goto(APP_URL);
  await pg.waitForTimeout(300);
  assert(await pg.$$eval('#examGrid .exam-btn', els => els.length) > 1, 'home renders');
  const names = actionNames();
  const unknown = await pg.evaluate(list => list.filter(n => typeof ACTIONS[n] !== 'function'), names);
  assert(names.length > 20 && unknown.length === 0, `every data-action in markup / templates (${names.length}) has an ACTIONS handler` + (unknown.length ? ': missing ' + unknown.join(', ') : ''));
  const unused = await pg.evaluate(list => Object.keys(ACTIONS).filter(k => !list.includes(k)), names);
  assert(unused.length === 0, 'every ACTIONS handler is used by some markup' + (unused.length ? ': unused ' + unused.join(', ') : ''));
  assert(errs.length === 0, 'page loads with no page errors, console errors or failed requests' + (errs.length ? ': ' + errs.join(' / ') : ''));
  await b.close();
  console.log('STRUCTURE PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
