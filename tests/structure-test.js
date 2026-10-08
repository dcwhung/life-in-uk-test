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

// index just past a '…' / "…" string starting at i (an unclosed one ends at the line break)
function endOfQuoted(src, i) {
  const q = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') j++;
    else if (src[j] === q || src[j] === '\n') return j + 1;
  }
  return src.length;
}

// template text from i up to the closing backtick or the next ${: { end, expr } (expr = a ${ opened at end)
function scanTemplateText(src, i) {
  for (let j = i; j < src.length; j++) {
    if (src[j] === '\\') j++;
    else if (src[j] === '`') return { end: j + 1, expr: false };
    else if (src[j] === '$' && src[j + 1] === '{') return { end: j + 2, expr: true };
  }
  return { end: src.length, expr: false };
}

// S-074: a / opens a regex literal where a value is expected: at the start, after an operator / opening
// punctuation, or after a keyword such as return (after a name, a number, ) or ] it is a division)
// S-085: postfix ++ / -- and a property named in / of (o.in) end a value, so a / after them is a division
// S-088: a keyword is a whole name (not $in) and not a property, even after ". "
// S-090 / S-091: nor is the tail of a #private or non-ASCII name (this.#of, éin, x\u0301in): any identifier part
// (\p{ID_Continue}; needs the u flag) before it keeps it a name. S-092: ZWNJ / ZWJ are listed because
// \p{ID_Continue} only includes them from Unicode 15.1 (older Node). Known gap (won't fix: adding } breaks }return /x/):
// a name ending in a \u{…} escape plus in / of (a\u{62}in) still reads as the keyword; js/ has no such names
const REGEX_AFTER = /(?:^|[(,=:[!&|?;{}*%<>~^]|(?<![+-])[+-]|(?<![$#\p{ID_Continue}\u200C\u200D]|\.\s*)(?:return|typeof|case|void|delete|in|of|throw|yield|await))\s*$/u;
// index just past a /…/ regex body starting at i ([…] classes and \ escapes included), or -1 if the line
// ends first (a regex never spans lines, so that / was a division after all)
function endOfRegex(src, i) {
  for (let j = i + 1, inClass = false; j < src.length && src[j] !== '\n'; j++) {
    if (src[j] === '\\') j++;
    else if (src[j] === '[') inClass = true;
    else if (src[j] === ']') inClass = false;
    else if (src[j] === '/' && !inClass) return j + 1;
  }
  return -1;
}

// S-067: one pass, so a quote, // or /* inside a string, template or comment never starts another token.
// Comments go, '…' / "…" / regex literals and template text become '', template ${…} expressions stay as code.
function layerCode(src) {
  let out = '', i = 0;
  const exprDepth = []; // one entry per open ${…}: how many { are open inside it
  // S-085: an opened ${ expects a value, so it leaves a "(" for REGEX_AFTER to read (usesName ignores it)
  const template = from => { const t = scanTemplateText(src, from); out += t.expr ? "''(" : "''"; i = t.end; if (t.expr) exprDepth.push(0); };
  const closesExpr = c => c === '}' && exprDepth.length > 0 && exprDepth[exprDepth.length - 1] === 0;
  const lineEnd = from => { const e = src.indexOf('\n', from); return e < 0 ? src.length : e; };
  const blockEnd = from => { const e = src.indexOf('*/', from + 2); return e < 0 ? src.length : e + 2; };
  while (i < src.length) {
    const c = src[i], two = src.slice(i, i + 2);
    if (two === '//') i = lineEnd(i);
    else if (two === '/*') { i = blockEnd(i); out += ' '; }
    else if (c === "'" || c === '"') { out += "''"; i = endOfQuoted(src, i); }
    else if (c === '/' && REGEX_AFTER.test(out) && endOfRegex(src, i) > 0) { out += "''"; i = endOfRegex(src, i); }
    else if (c === '`') template(i + 1);
    else if (closesExpr(c)) { exprDepth.pop(); template(i + 1); }
    else {
      if (exprDepth.length > 0 && (c === '{' || c === '}')) exprDepth[exprDepth.length - 1] += c === '{' ? 1 : -1;
      out += c; i++;
    }
  }
  return out;
}

// S-023: custom properties used through var(--x) in any of the given css texts but defined (--x: …) in none of
// them; comments are dropped first, so a "--x:" in a comment does not count as a definition
function undefinedTokens(cssTexts) {
  const code = cssTexts.map(c => c.replace(/\/\*[\s\S]*?\*\//g, ' '));
  const defined = new Set(code.flatMap(c => [...c.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1])));
  const used = new Set(code.flatMap(c => [...c.matchAll(/var\(\s*(--[\w-]+)/g)].map(m => m[1])));
  return [...used].filter(n => !defined.has(n));
}
// v0.72 (B5): spacing = margin* / padding* / gap / row-gap / column-gap, plus custom properties named *gap* / *pad*.
// A px value on the --space-* scale must be written as the token; off-scale values (1, 3, 5px…) stay literal
const SPACE_SCALE_PX = [2, 4, 6, 8, 10, 12, 14, 16, 20, 24];
const SPACING_PROP = /^(?:margin(?:-[a-z-]+)?|padding(?:-[a-z-]+)?|gap|row-gap|column-gap|--[\w-]*(?:gap|pad)[\w-]*)$/;
function spacingScaleLiterals(css) {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return [...code.matchAll(/([\w-]+)\s*:\s*([^;{}]+)/g)]
    .filter(([, prop, value]) => SPACING_PROP.test(prop) && [...value.matchAll(/(?<![\w.-])-?(\d+(?:\.\d+)?)px/g)].some(m => SPACE_SCALE_PX.includes(Number(m[1]))))
    .map(([, prop, value]) => `${prop}: ${value.trim()}`);
}
const SPACING_SAMPLES = [
  { css: 'a { margin: 8px 12px; }', hits: 1, why: 'scale values in margin' },
  { css: 'b { padding: var(--space-4) 3px; gap: 5px; }', hits: 0, why: 'tokens and off-scale values' },
  { css: 'c { --fact-actions-gap: 4px; width: 8px; top: -16px; }', hits: 1, why: 'a *gap custom property (width / top are not spacing)' },
  { css: '/* margin: 8px */ d { margin-top: calc(-1 * 10px); }', hits: 1, why: 'a negative scale value in calc, not a comment' },
];

const TOKEN_SAMPLES = [
  { css: ['a { color: var(--nope); }'], gaps: '--nope', why: 'an undefined token' },
  { css: [':root { --a: 1px; }', 'b { margin: var(--a); }'], gaps: '', why: 'a token defined in another file' },
  { css: ['c { --b: 2px; padding: var( --b ); }'], gaps: '', why: 'a local custom property' },
  { css: ['/* --c: 1px */ d { top: var(--c, 0); }'], gaps: '--c', why: 'a "definition" inside a comment' },
];

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

  // v0.72 (B5): spacing on the --space-* scale goes through the tokens (tokens.css defines them)
  const spacingMisses = SPACING_SAMPLES.filter(({ css, hits }) => spacingScaleLiterals(css).length !== hits).map(({ why }) => why);
  assert(spacingMisses.length === 0, `spacing guard reads ${SPACING_SAMPLES.length} in-memory samples right` + (spacingMisses.length ? ': ' + spacingMisses.join(', ') : ''));
  const spacingLits = cssFiles(path.join(ROOT, 'css')).filter(f => f !== TOKENS_CSS)
    .flatMap(f => spacingScaleLiterals(fs.readFileSync(f, 'utf8')).map(d => `${rel(f)} ${d}`));
  assert(spacingLits.length === 0, `margin / padding / gap use --space-* for ${SPACE_SCALE_PX.join(' / ')}px (${spacingLits.length} literal): ${spacingLits.slice(0, 4).join(' | ')}`);
  // S-023: a var(--x) with no --x definition silently falls back (or drops the declaration)
  const tokenMisses = TOKEN_SAMPLES.filter(({ css, gaps }) => undefinedTokens(css).join(',') !== gaps).map(({ why }) => why);
  assert(tokenMisses.length === 0, `undefined-token guard reads ${TOKEN_SAMPLES.length} in-memory samples right`
    + (tokenMisses.length ? ': ' + tokenMisses.join(', ') : ''));
  const tokenGaps = undefinedTokens(cssFiles(path.join(ROOT, 'css')).map(f => fs.readFileSync(f, 'utf8')));
  assert(tokenGaps.length === 0, 'every var(--x) in css has a --x definition' + (tokenGaps.length ? ': ' + tokenGaps.join(', ') : ''));

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
  // S-037: blank strings before stripping comments, so a `//` inside a string ("http://…") cannot eat the code after it
  const stripComments = code => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const factCardCode = stripComments(fs.readFileSync(FACT_CARD_JS, 'utf8')
    .replace(/'[^'\n]*'|`[^`]*`|"[^"\n]*"/g, "''")); // code only: no comments / strings ('study.x' keys)
  assert(!/\bstudy\b/.test(factCardCode), 'js/components/factCard.js does not read the study global');
  // v0.64 (S-031): layering — components load before screens, so a component must not call anything a screen
  // defines (it only worked because the global existed by render time). layerCode drops comments and blanks quoted
  // strings (i18n keys such as 'study.x', data-action="name") and template text, but keeps `${fn(...)}` expressions.
  const topLevelNames = f => [...fs.readFileSync(f, 'utf8')
    .matchAll(/^(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))/gm)]
    .map(m => m[1] || m[2]);
  const screenNames = new Set(jsFiles(path.join(ROOT, 'js/screens')).flatMap(topLevelNames));
  // a bare name or window.name is a use; any other `.name` is a property of something else
  const usesName = (code, n) => new RegExp(`(?<![\\w$]|(?<!\\bwindow)\\.)${n.replace(/\$/g, '\\$')}(?![\\w$])`).test(code);
  // S-037: in-memory samples pin the guard's own parsing (a URL's // must not hide later code; window.X is a use)
  const LAYER_SAMPLES = [
    { code: 'const u = "http://x"; return renderStudy();', hit: true, why: 'a call after a URL string' },
    { code: "const u = 'https://x'; renderStudy();", hit: true, why: 'a call after a single-quoted URL' },
    { code: 'window.renderStudy();', hit: true, why: 'window.renderStudy()' },
    { code: '/* renderStudy() */ const a = 1;', hit: false, why: 'a name inside a /* */ comment' },
    { code: '// renderStudy()', hit: false, why: 'a name inside a // comment' },
    { code: "const k = 'renderStudy';", hit: false, why: 'a name inside a plain string' },
    { code: 'obj.renderStudy();', hit: false, why: "another object's property" },
    // S-067: template literal text is not code; only its ${…} expressions are
    { code: 'const s = `a // b`; renderStudy();', hit: true, why: 'a call after a template holding //' },
    { code: 'const s = `/*`; renderStudy(); const t = `*/`;', hit: true, why: 'a call between templates holding /* and */' },
    { code: 'const s = `<b>${renderStudy()}</b>`;', hit: true, why: 'a call inside a template ${…}' },
    { code: 'const s = `renderStudy`;', hit: false, why: 'a name in template text' },
    { code: 'const s = `${a ? `x` : renderStudy()}`;', hit: true, why: 'a call after a nested template' },
    { code: 'const s = `${a({ b: 1 })} renderStudy`;', hit: false, why: 'template text after a ${…} holding braces' },
    // S-074: a regex literal is not code, and a backtick or quote inside one must not open a template / string
    { code: 'const r = /`/; renderStudy();', hit: true, why: 'a call after a regex holding a backtick' },
    { code: 'if (/[/`]/.test(s)) renderStudy();', hit: true, why: 'a call after a regex whose [class] holds / and a backtick' },
    { code: 'const r = /\\/`/; renderStudy();', hit: true, why: 'a call after a regex holding an escaped / and a backtick' },
    { code: 'const r = /renderStudy/;', hit: false, why: 'a name inside a regex literal' },
    { code: 'const q = a / b; renderStudy(); const p = c / d;', hit: true, why: 'a call between two divisions' },
    { code: 'const q = f(x) / 2; renderStudy(); const p = y / 3;', hit: true, why: 'a call between divisions after ) and a name' },
    // S-085: ${ expects a value; after postfix ++ / -- or a property named of / in, a / is a division
    { code: 'const s = `${/\'/.test(x)}`; renderStudy();', hit: true, why: 'a call after a regex right after ${' },
    { code: 'a = b++ / 2; renderStudy(); c = d / 3;', hit: true, why: 'a call between divisions after b++ and a name' },
    { code: 'a = b-- / 2; renderStudy(); c = d / 3;', hit: true, why: 'a call between divisions after b-- and a name' },
    { code: 'x = o.of / 2; renderStudy(); y = z / 3;', hit: true, why: 'a call between divisions after a property named of' },
    { code: 'x = o.in / 2; renderStudy(); y = z / 3;', hit: true, why: 'a call between divisions after a property named in' },
    { code: 'for (const k of /renderStudy/.exec(s)) k;', hit: false, why: 'a name inside a regex after the of keyword' },
    { code: 'a = b + /renderStudy/.source;', hit: false, why: 'a name inside a regex after a binary +' },
    // S-088: a $name or a property after ". " is not a keyword; S-089: a / after a binary - opens a regex
    { code: 'x = $in / 2; renderStudy(); y = z / 3;', hit: true, why: 'a call between divisions after a $-prefixed name' },
    { code: 'x = o. of / 2; renderStudy(); y = z / 3;', hit: true, why: 'a call between divisions after a spaced property named of' },
    { code: 'a = b - /renderStudy/.source.length;', hit: false, why: 'a name inside a regex after a binary -' },
    // S-090: a #private or non-ASCII name ending in in / of is a name, so a / after it is a division
    { code: 'x = this.#of / 2; renderStudy(); y = z / 3;', hit: true, why: 'a call between divisions after a #private name' },
    { code: 'x = éin / 2; renderStudy(); y = z / 3;', hit: true, why: 'a call between divisions after a non-ASCII name' },
    // S-091: any identifier part (combining mark, non-ASCII digit, ZWJ) before in / of keeps it a name
    { code: 'x = x\u0301in / 2; renderStudy(); y = z / 3;', hit: true, why: 'a call between divisions after a name with a combining mark' },
    { code: 'x = x\u0663of / 2; renderStudy(); y = z / 3;', hit: true, why: 'a call between divisions after a name with a non-ASCII digit' },
    { code: 'x = x\u200Din / 2; renderStudy(); y = z / 3;', hit: true, why: 'a call between divisions after a name with a ZWJ' },
    // S-094: ZWNJ too
    { code: 'x = x\u200Cof / 2; renderStudy(); y = z / 3;', hit: true, why: 'a call between divisions after a name with a ZWNJ' },
  ];
  const sampleMisses = LAYER_SAMPLES.filter(({ code, hit }) => usesName(layerCode(code), 'renderStudy') !== hit)
    .map(({ hit, why }) => `${hit ? 'missed' : 'flagged'} ${why}`);
  assert(sampleMisses.length === 0, `layering guard reads ${LAYER_SAMPLES.length} in-memory samples right`
    + (sampleMisses.length ? ': ' + sampleMisses.join(', ') : ''));
  const layerHits = jsFiles(path.join(ROOT, 'js/components')).flatMap(f => {
    const code = layerCode(fs.readFileSync(f, 'utf8'));
    return [...screenNames].filter(n => usesName(code, n)).map(n => `${rel(f)} → ${n}`);
  });
  assert(layerHits.length === 0, 'js/components/*.js use nothing defined in js/screens/*.js'
    + (layerHits.length ? ': ' + layerHits.join(', ') : ''));
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

  // v0.64 (S-034): form controls use the body font, not the UA default (Linux Chromium: Arial). Checked on home
  // (#installBtn, mode cards, exam grid, quick nav), a Practice question (options, dots) and Study (search, chips, fact
  // buttons, .fact-practise), so every rendered <button> / <input> is covered, not only the ones with a class rule.
  const offFont = () => pg.evaluate(() => {
    const body = getComputedStyle(document.body).fontFamily;
    return [...document.querySelectorAll('button, input, select, textarea')]
      .filter(e => getComputedStyle(e).fontFamily !== body)
      .map(e => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${[...e.classList].join('.')} (${getComputedStyle(e).fontFamily})`);
  });
  const fontScreens = [
    ['home', async () => {}],
    ['practice question', async () => { await pg.evaluate(() => { pendingMode = 'practice'; startExam(1); }); await pg.waitForSelector('#opt0'); }],
    ['study', async () => { await pg.evaluate(() => openStudy()); await pg.waitForSelector('.fact-practise'); }],
  ];
  for (const [screen, open] of fontScreens) {
    await open();
    const off = await offFont();
    assert(off.length === 0, `${screen}: every button / input uses the body font-family` + (off.length ? ': ' + off.slice(0, 6).join(', ') : ''));
  }
  await b.close();
  console.log('STRUCTURE PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
