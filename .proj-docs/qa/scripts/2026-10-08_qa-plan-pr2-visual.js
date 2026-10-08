// QA plan PR2 (same as PR1 visual script): run tests/tools/visual-diff.js (all scenarios) at extra widths + UI languages
//   node 2026-10-08_qa-plan-pr1-visual.js <repo-root> [ref=origin/main] [widths=320,375] [lang=en|zh-HK]
// Patches the tool source in memory only (WIDTHS, ROOT, and a uiLang seed in the init script); the tool file is untouched.
const fs = require('fs'); const path = require('path'); const Module = require('module');
const ROOT = path.resolve(process.argv[2]); const REF = process.argv[3] || 'origin/main';
const WIDTHS = (process.argv[4] || '320,375').split(',').map(Number); const LANG = process.argv[5] || 'en';
const toolPath = path.join(ROOT, 'tests', 'tools', 'visual-diff.js');
let src = fs.readFileSync(toolPath, 'utf8');
const sub = (from, to) => { if (!src.includes(from)) throw new Error('patch anchor missing: ' + from); src = src.replace(from, to); };
sub("const ROOT = path.resolve(__dirname, '..', '..');", `const ROOT = ${JSON.stringify(ROOT)};`);
sub("const REF = process.argv[2] || 'HEAD';", `const REF = ${JSON.stringify(REF)};`);
sub("const MAX_PRINT = Number(process.argv[3] || 40);", 'const MAX_PRINT = 60;');
sub('const WIDTHS = [390, 900];', `const WIDTHS = ${JSON.stringify(WIDTHS)};`);
// seed the UI language before the app boots (same key the header pill writes)
sub('const init = () => {', `const init = () => { try { localStorage.clear(); localStorage.setItem('lifeuk.uiLang', ${JSON.stringify(JSON.stringify(LANG))}); } catch {}`);
// visual-diff clears nothing between scenarios on file://, so localStorage.clear() above keeps each capture independent
console.log(`[qa] ref=${REF} widths=${WIDTHS} lang=${LANG}`);
const m = new Module(toolPath, module); m.paths = Module._nodeModulePaths(path.dirname(toolPath)); m.filename = toolPath;
m._compile(src, toolPath);
