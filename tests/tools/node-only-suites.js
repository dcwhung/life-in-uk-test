// Prints the suites under tests/ that need no browser, one name per line (no .js), for CI's `node-tests` job (AU-002).
//   node tests/tools/node-only-suites.js
//
// A suite is tests/test.js or tests/*-test.js. It is node-only when neither it nor any file it reaches through a
// relative require ('./x', '../x') loads playwright-core; e.g. desktop-*-test.js reach it through desktop-helpers.js.
// Suites that need the browser run in the `playwright-tests` job (tests/run-all.sh) instead.
const fs = require('fs');
const path = require('path');

const TESTS = path.resolve(__dirname, '..');
const RELATIVE_REQUIRE = /require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;

const resolveLocal = (from, spec) => {
  const base = path.resolve(path.dirname(from), spec);
  return [base, base + '.js', path.join(base, 'index.js')].find(f => fs.existsSync(f) && fs.statSync(f).isFile());
};

// true when `file` or anything it requires relatively mentions playwright-core
const needsBrowser = (file, seen = new Set()) => {
  if (seen.has(file)) return false;
  seen.add(file);
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes('playwright-core')) return true;
  for (const m of src.matchAll(RELATIVE_REQUIRE)) {
    const dep = resolveLocal(file, m[1]);
    if (dep && needsBrowser(dep, seen)) return true;
  }
  return false;
};

const suites = fs.readdirSync(TESTS).filter(f => f === 'test.js' || f.endsWith('-test.js')).sort();
for (const f of suites) if (!needsBrowser(path.join(TESTS, f))) console.log(f.replace(/\.js$/, ''));
