// QA v0.66 Track 2 (Cantonese colloquial rewrite: exams yue / oy / note + Study fact yue) — manual, not part of run-all.sh.
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium \
//     node .proj-docs/qa/scripts/2026-10-07_qa-v066.js <repo-root> <screenshot-dir> [v065-ref=f78e34c]
// QA_ONLY=section,section limits the run. W-015 scan rows are written to <screenshot-dir>/../w015-scan.json only when
// QA_W015_OUT is set (default: printed).
// 2026-10-07 rerun (S-056 / CUI-0015): w015 expectations inverted after batch 7 (anti-leak); oracle skips batch 7
// `keep` records and applies the S-055 post-batch fix.
// 2026-10-07 refresh (Lane D): the oracle counts exactly batches 1..7 (explicit filename pattern — later batches such as
// batch-8 belong to their own QA script): 7 files / 732 records, 3 `keep` not replayed. versionCheck and
// offlineAndUpgrade compare against the current APP_VERSION (js/core/config.js) and the current data files instead of
// hard-coding v0.66 / the pre-batch-7 E11·Q4 yue. overflow no longer exempts the quick nav (CUI-0013 fixed in v0.67).
//
// Oracle (independent of HEAD data): the v0.65 data files (git show <v065-ref>) with the seven user-approved batch JSON
// files (.proj-docs/plans/2026-10-07_yue-batch-{1..7}*.json) replayed in order; every record's `before` must match.
// The app is driven black-box with real clicks / typing; page.evaluate only seeds localStorage and reads state
// (which question sits behind which dot, the option order after shuffle) to locate things on screen.
// Double tap guard (CUI-0011): a click within 40px / 350ms of a click that changed the view is swallowed, so every
// navigation step (showScreen) waits GUARD_WAIT afterwards.
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(process.argv[2] || '.');
const SHOT_DIR = path.resolve(process.argv[3] || '.');
const V065_REF = process.argv[4] || 'f78e34c';
const { startPagesServer, appFiles } = require(path.join(ROOT, 'tests', 'pages-server.js'));
const APP_URL = 'file://' + path.join(ROOT, 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
let pass = 0, fail = 0;
const failures = [];
const ok = (c, m) => { if (c) { pass++; if (!process.env.QA_QUIET) console.log('ok:', m); } else { fail++; failures.push(m); console.log('FAIL:', m); } };
const note = (...a) => console.log('  note:', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GUARD_WAIT = 420; // > SCREEN_CHANGE_CLICK_GUARD_MS (350)
const shot = n => path.join(SHOT_DIR, `${n}.png`);
const ZH = 'zh-HK';
const LANGS = ['en', ZH];
const ANSWER_SEP = ' | ';

// ══════════ oracle: v0.65 data + batch JSON replay ══════════
const gitShow = p => execSync(`git show ${V065_REF}:${p}`, { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
const loadData = (src, name) => { const c = {}; vm.runInNewContext(src + `;this.${name}=${name};`, c); return c[name]; };
const OLD_EXAMS = loadData(gitShow('data/exams.js'), 'EXAMS');
const OLD_STUDY = loadData(gitShow('data/study.js'), 'STUDY');
const EXP_EXAMS = JSON.parse(JSON.stringify(OLD_EXAMS));
const EXP_STUDY = JSON.parse(JSON.stringify(OLD_STUDY));
const PLAN_DIR = path.join(ROOT, '.proj-docs/plans');
// explicit: batches 1..7 only (batch-N or batch-N-<tag>); anything later (e.g. batch-8-s054) is out of v0.66 scope
const BATCH_NUMS = [1, 2, 3, 4, 5, 6, 7];
const BATCH_RE = ext => new RegExp(`^2026-10-07_yue-batch-(${BATCH_NUMS.join('|')})(?:-[a-z0-9]+)?\\.${ext}$`);
const BATCH_FILES = fs.readdirSync(PLAN_DIR).filter(f => BATCH_RE('json').test(f))
  .sort((a, b) => Number(a.match(BATCH_RE('json'))[1]) - Number(b.match(BATCH_RE('json'))[1]));
const EXPECTED_ORACLE = { files: 7, records: 732, kept: 3 };
const CUR_VERSION = (fs.readFileSync(path.join(ROOT, 'js/core/config.js'), 'utf8').match(/const APP_VERSION = '([^']+)'/) || [])[1];
const CUR_CACHE = 'lifeuk-v' + CUR_VERSION;
const replay = { records: 0, beforeMismatch: [], kept: [] };
const changed = { yue: new Set(), note: new Set(), oy: new Set(), fact: new Set() }; // qKey "exam.idx" / fact id
// S-056 (2026-10-07 rerun): batch 7 (anti-leak, R2) records carry userDecision apply / keep; `keep` (A6, A9, A10) was
// NOT applied, so it is checked (before must match) but not replayed. PRE_BATCH7 = expected data just before batch 7,
// the baseline for the W-015 "no new pair" check.
const ANTILEAK_FILE = BATCH_FILES.find(f => /antileak/.test(f));
const ANTILEAK = ANTILEAK_FILE ? JSON.parse(fs.readFileSync(path.join(PLAN_DIR, ANTILEAK_FILE), 'utf8')) : [];
let PRE_BATCH7 = null;
for (const f of BATCH_FILES) {
  if (f === ANTILEAK_FILE) PRE_BATCH7 = JSON.parse(JSON.stringify(EXP_EXAMS));
  for (const r of JSON.parse(fs.readFileSync(path.join(PLAN_DIR, f), 'utf8'))) {
    replay.records++;
    if (r.userDecision === 'keep') {
      if (EXP_EXAMS[r.exam][r.qIndex][r.field] !== r.before) replay.beforeMismatch.push(`${f} ${r.exam}.${r.qIndex} ${r.field} (keep)`);
      replay.kept.push(r); continue;
    }
    if (r.factId !== undefined) {
      const fact = EXP_STUDY.find(x => x.id === r.factId);
      if (fact.yue !== r.before) replay.beforeMismatch.push(`${f} fact #${r.factId}`);
      fact.yue = r.after; changed.fact.add(r.factId); continue;
    }
    const q = EXP_EXAMS[r.exam][r.qIndex];
    const k = `${r.exam}.${r.qIndex}`;
    if (r.field === 'oy') { if (q.oy[r.optIndex] !== r.before) replay.beforeMismatch.push(`${f} ${k} oy[${r.optIndex}]`); q.oy[r.optIndex] = r.after; }
    else { if (q[r.field] !== r.before) replay.beforeMismatch.push(`${f} ${k} ${r.field}`); q[r.field] = r.after; }
    changed[r.field].add(k);
  }
}
// fixes applied after the batch files, outside any batch JSON (commit + rule documented in yue-terms.md)
// S-055 (091b6bf, R3): E7·Q12 has the same English question as E12·Q16 (A16) → identical yue
const POST_BATCH_FIXES = [{ exam: 7, qIndex: 11, field: 'yue', before: '財政大臣嘅職責係乜嘢？', after: EXP_EXAMS[12][15].yue, id: 'S-055' }];
for (const r of POST_BATCH_FIXES) {
  const q = EXP_EXAMS[r.exam][r.qIndex];
  if (q[r.field] !== r.before) replay.beforeMismatch.push(`${r.id} ${r.exam}.${r.qIndex} ${r.field}`);
  q[r.field] = r.after; changed[r.field].add(`${r.exam}.${r.qIndex}`);
}
const expQ = k => { const [e, i] = k.split('.').map(Number); return EXP_EXAMS[e][i]; };
const oldQ = k => { const [e, i] = k.split('.').map(Number); return OLD_EXAMS[e][i]; };
const EXP_FACT_BY_QKEY = {};
EXP_STUDY.forEach(f => f.src.forEach(k => { EXP_FACT_BY_QKEY[k] = f; }));
const ref = k => { const [e, i] = k.split('.').map(Number); return `E${e}·Q${i + 1}`; };

// questions named in the batch md decision tables (用戶決定 + batch 6 cross-file table), 1-based → qKey
function decisionRefs() {
  const out = new Set();
  for (const f of fs.readdirSync(PLAN_DIR).filter(f => BATCH_RE('md').test(f))) {
    let on = false;
    for (const line of fs.readFileSync(path.join(PLAN_DIR, f), 'utf8').split('\n')) {
      if (line.startsWith('## ')) on = /用戶決定|Exam 跨檔譯名修正/.test(line);
      if (!on || !line.startsWith('|')) continue;
      let exam = null;
      for (const m of line.matchAll(/Exam (\d+)|Q(\d+)/g)) {
        if (m[1]) exam = Number(m[1]); else if (exam) out.add(`${exam}.${Number(m[2]) - 1}`);
      }
    }
  }
  return [...out];
}
const W015_CASES = ['11.3', '4.11', '12.11'];
// deterministic sample: decision refs + W-015 + shared-note groups (2 members each) + changed-field fill to >= 5 / exam
function buildSample() {
  const s = new Set([...decisionRefs(), ...W015_CASES]);
  for (const g of sharedNoteGroups().slice(0, 21)) g.slice(0, 2).forEach(k => s.add(k));
  for (let e = 1; e <= 17; e++) {
    const pool = EXP_EXAMS[e].map((_, i) => `${e}.${i}`);
    const pref = pool.filter(k => changed.yue.has(k) && (changed.note.has(k) || changed.oy.has(k)));
    let n = [...s].filter(k => k.startsWith(e + '.')).length;
    for (const k of [...pref, ...pool.filter(k => changed.yue.has(k)), ...pool]) { if (n >= 5) break; if (!s.has(k)) { s.add(k); n++; } }
  }
  return [...s].sort((a, b) => { const [x, y] = a.split('.').map(Number), [u, v] = b.split('.').map(Number); return x - u || y - v; });
}
function sharedNoteGroups() {
  const by = {};
  for (const [e, list] of Object.entries(EXP_EXAMS)) list.forEach((q, i) => { if (q.note) (by[q.note] = by[q.note] || []).push(`${e}.${i}`); });
  return Object.values(by).filter(g => g.length > 1);
}

// ══════════ helpers ══════════
function watch(pg) {
  const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  return { errs };
}
async function fresh(b, w, lang, seed = null, url = APP_URL, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, ...opts }); const pg = await ctx.newPage(); const log = watch(pg);
  await pg.goto(url);
  await pg.evaluate(({ kv, lang }) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('lifeuk.uiLang', JSON.stringify(lang));
    if (kv) for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); }, { kv: seed, lang });
  await pg.reload();
  return { ctx, pg, ...log };
}
const nav = async (pg, sel) => { await pg.click(sel); await sleep(GUARD_WAIT); };
const tap = async (pg, sel) => { await pg.click(sel); await sleep(40); };
async function openPractice(pg, exam) { await nav(pg, '#modePractice'); await tap(pg, '#ptabExam'); await nav(pg, `#examGrid [data-arg="${exam}"]`); }
async function openExamResult(pg, exam) {
  await nav(pg, '#modeExam'); await nav(pg, `#examGrid [data-arg="${exam}"]`);
  await tap(pg, '#navDots .dot:last-child'); await tap(pg, '#nextBtn'); await nav(pg, '#confirmOk');
}
// session position of a question key + the shown-option → original-option map
const sessionMap = pg => pg.evaluate(() => state.questions.map(q => `${q.examNum}.${q.origIdx}`));
async function optionOrder(pg, k) {
  const shown = await pg.$$eval('#optionsContainer .opt .opt-body > span:first-child', els => els.map(e => e.textContent));
  const q = expQ(k);
  return shown.map(t => q.o.indexOf(t));
}
// note rendered with pre-wrap (answer box) or one div per line (result): structural + text checks
function noteProblems(rendered, expected) {
  const p = [];
  if (/\\n|<br|&lt;|&gt;|&amp;/i.test(rendered.text)) p.push('literal \\n / <br> / entity in visible text');
  if (rendered.foreign.length) p.push('unexpected elements ' + rendered.foreign.join(','));
  return p;
}
async function noOverflow(pg) {
  return pg.evaluate(() => {
    const iw = document.documentElement.clientWidth;
    const spill = [...document.querySelectorAll('body *')].filter(e => { if (!e.getClientRects().length || e.closest('.modal-backdrop:not(.show), .info-pop:not(.show)')) return false;
      const r = e.getBoundingClientRect(); return r.width && r.right > iw + 0.5; }).map(e => (e.id || e.className) + ':' + e.getBoundingClientRect().right.toFixed(1));
    return { sw: document.documentElement.scrollWidth, iw, spill };
  });
}

// ══════════ 0. oracle sanity + version ══════════
async function versionCheck(b) {
  ok(BATCH_FILES.length === EXPECTED_ORACLE.files && replay.records === EXPECTED_ORACLE.records && replay.kept.length === EXPECTED_ORACLE.kept,
    `oracle: ${EXPECTED_ORACLE.files} batch JSON files (1..7), ${EXPECTED_ORACLE.records} records, ${EXPECTED_ORACLE.kept} keep not replayed (${BATCH_FILES.length}, ${replay.records}, ${replay.kept.length}) [${BATCH_FILES.join(' ')}]`);
  ok(replay.beforeMismatch.length === 0, `oracle: every record's before matches v0.65 ${V065_REF} data in order ${replay.beforeMismatch.slice(0, 5).join(' ')}`);
  note(`changed fields: yue ${changed.yue.size}, note ${changed.note.size}, oy questions ${changed.oy.size}, fact yue ${changed.fact.size}`);
  ok(!!CUR_VERSION, `current APP_VERSION read from js/core/config.js: ${CUR_VERSION}`);
  // dynamic: the SW cache for the current version must hold byte-identical copies of the repo data files, and those
  // must carry the oracle text (E11·Q4 yue after batch 7 + a changed Study fact), not the v0.65 text
  const repoExams = fs.readFileSync(path.join(ROOT, 'data/exams.js'), 'utf8');
  const repoStudy = fs.readFileSync(path.join(ROOT, 'data/study.js'), 'utf8');
  const probeQ = '11.3', probeFact = EXP_STUDY.find(f => changed.fact.has(f.id));
  const { base, server } = await startPagesServer(ROOT);
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage(); const { errs } = watch(pg);
    await pg.goto(base); await pg.evaluate(() => navigator.serviceWorker.ready);
    // poll inside the page (waitForFunction with an async predicate resolves immediately on the returned Promise)
    const cacheReady = await pg.evaluate(async name => { for (let i = 0; i < 75; i++) { if ((await caches.keys()).includes(name)) return true;
      await new Promise(r => setTimeout(r, 200)); } return false; }, CUR_CACHE);
    ok(cacheReady, `SW cache ${CUR_CACHE} created`);
    ok(await pg.evaluate(() => APP_VERSION) === CUR_VERSION && (await pg.textContent('#appVersion')) === 'v' + CUR_VERSION, `APP_VERSION ${CUR_VERSION}, header v${CUR_VERSION}`);
    const cached = await pg.evaluate(async name => { const c = await caches.open(name); const get = async p => { const r = await c.match(p) || await c.match('./' + p); return r ? r.text() : null; };
      return { e: await get('data/exams.js'), s: await get('data/study.js') }; }, CUR_CACHE);
    ok(cached.e === repoExams && cached.s === repoStudy, `SW cache ${CUR_CACHE} holds data/exams.js + data/study.js byte-identical to the repo (exams ${cached.e === repoExams}, study ${cached.s === repoStudy})`);
    const qNew = expQ(probeQ).yue, qOld = oldQ(probeQ).yue;
    ok(cached.e && cached.e.includes(qNew) && (qNew === qOld || !cached.e.includes(qOld)), `SW cache data/exams.js: ${ref(probeQ)} yue = oracle "${qNew}" (v0.65 "${qOld}" gone)`);
    const fOld = OLD_STUDY.find(f => f.id === probeFact.id).yue;
    ok(cached.s && cached.s.includes(probeFact.yue) && !cached.s.includes(fOld), `SW cache data/study.js: fact #${probeFact.id} yue = oracle (v0.65 text gone)`);
    ok(errs.length === 0, 'version — no page errors ' + errs.join('|'));
    await ctx.close();
  } finally { server.kill(); }
}

// ══════════ 1. Practice: translate toggle, options, answer box, note, Similar / Core Fact ══════════
const renderedNotes = { practice: {}, result: {} }; // qKey -> visible note text, for the shared-note check
async function practiceSample(b) {
  const sample = buildSample();
  const perExam = {};
  sample.forEach(k => { const e = k.split('.')[0]; (perExam[e] = perExam[e] || []).push(k); });
  ok(sample.length >= 60 && Object.keys(perExam).length === 17, `sample: ${sample.length} questions across ${Object.keys(perExam).length} exams (>= 60, all 17)`);
  note('sample', sample.map(ref).join(' '));
  const stats = { q: 0, yue: 0, oy: 0, note: 0, similar: 0, coreFact: 0 };
  for (const lang of LANGS) {
    for (const [exam, keys] of Object.entries(perExam)) {
      const { ctx, pg, errs } = await fresh(b, 390, lang);
      await openPractice(pg, exam);
      const map = await sessionMap(pg);
      let right = true;
      for (const k of keys) {
        const pos = map.indexOf(k);
        if (pos < 0) { ok(false, `${lang} ${ref(k)} in the practice round`); continue; }
        await tap(pg, `#navDots .dot:nth-child(${pos + 1})`);
        const q = expQ(k), old = oldQ(k), tag = `${lang} ${ref(k)}`;
        // before Translate: hidden
        const hidden = await pg.$eval('#qYue', e => !e.classList.contains('show') && !e.getClientRects().length);
        await tap(pg, '#yueToggle');
        const tr = await pg.evaluate(() => ({ yue: byId('qYue').textContent, vis: byId('qYue').getClientRects().length > 0,
          lang: byId('qYue').getAttribute('lang'), html: byId('qYue').innerHTML,
          oy: [...document.querySelectorAll('#optionsContainer .opt')].map(o => { const y = o.querySelector('.opt-yue'); return y ? y.textContent : null; }) }));
        const order = await optionOrder(pg, k);
        const expOy = order.map(oi => (q.oy && q.oy[oi]) || null);
        const yueOk = tr.vis && tr.yue === q.yue && tr.html === q.yue.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        ok(hidden && yueOk && tr.lang === ZH, `${tag} Translate: hidden before, then new yue "${tr.yue}"${changed.yue.has(k) ? ' (changed; old "' + old.yue + '" gone)' : ''}`);
        ok(JSON.stringify(tr.oy) === JSON.stringify(expOy) && !order.includes(-1), `${tag} Translate: option oy = oracle ${changed.oy.has(k) ? '(changed)' : ''} ${JSON.stringify(tr.oy) === JSON.stringify(expOy) ? '' : JSON.stringify({ got: tr.oy, want: expOy })}`);
        stats.q++; if (changed.yue.has(k)) stats.yue++; if (changed.oy.has(k)) stats.oy++;
        // answer (alternate right / wrong) through the options
        const picks = right ? q.a.map(a => order.indexOf(a)) : order.map((oi, i) => q.a.includes(oi) ? -1 : i).filter(i => i >= 0).slice(0, q.a.length);
        for (const i of picks) await tap(pg, `#opt${i}`);
        right = !right;
        const box = await pg.evaluate(() => {
          const rows = [...document.querySelectorAll('#ansYue .ans-yue-row span')].map(s => s.textContent);
          const n = byId('ansNote'); const span = n.querySelector('.ans-note-text');
          return { show: byId('answerBox').classList.contains('show'), rows,
            noteText: span ? span.textContent : '', noteVisible: n.innerText, kids: [...n.children].map(c => c.tagName), spanKids: span ? span.children.length : 0,
            lineBoxes: span ? span.getClientRects().length : 0, ws: getComputedStyle(n).whiteSpace };
        });
        // multi-answer: the session's (shuffled) answer order decides the join order, so compare as a set
        const asSet = s => s.split(ANSWER_SEP).sort().join(ANSWER_SEP);
        const expAns = asSet(q.a.map(a => (q.oy && q.oy[a]) || q.o[a]).join(ANSWER_SEP));
        box.rows[1] = box.rows[1] && asSet(box.rows[1]);
        ok(box.show && box.rows[0] === q.yue && box.rows[1] === expAns, `${tag} answer box yue + answer translation ${box.rows[1] === expAns ? '' : JSON.stringify({ got: box.rows, want: expAns })}`);
        if (q.note) {
          const lines = q.note.split('\n');
          const p = noteProblems({ text: box.noteVisible, foreign: box.kids.filter(t => !['STRONG', 'SPAN'].includes(t)).concat(box.spanKids ? ['span>child'] : []) });
          const visLines = box.noteVisible.split('\n').slice(1); // first line = 💡 label
          ok(box.noteText === q.note && p.length === 0 && box.ws === 'pre-wrap' && box.lineBoxes >= lines.filter(l => l.trim()).length
            && visLines.length === lines.length, `${tag} answer box note = oracle${changed.note.has(k) ? ' (changed)' : ''}, ${lines.length} line(s) rendered as breaks (${box.lineBoxes} line boxes) ${p.join(';')}`);
          renderedNotes.practice[lang + k] = box.noteText;
          stats.note++;
        } else ok(box.noteText === '' && box.kids.length === 0, `${tag} no note → answer box note empty`);
        // Similar panel + Core Fact
        const fact = EXP_FACT_BY_QKEY[k];
        const sim = await pg.evaluate(() => ({ show: byId('similarBox').classList.contains('show'),
          fact: (document.querySelector('#similarBox .sqm-fact-yue') || {}).textContent, factLabel: (document.querySelector('#similarBox .sqm-fact-label') || {}).textContent,
          qy: [...document.querySelectorAll('#similarBox .sqm-qy')].map(e => e.textContent) }));
        const others = fact ? fact.src.filter(x => x !== k) : [];
        if (others.length) {
          ok(sim.show && sim.fact === fact.yue && sim.factLabel.includes('#' + fact.id), `${tag} Core Fact #${fact.id} shows the new Study yue${changed.fact.has(fact.id) ? ' (changed)' : ''} ${sim.fact === fact.yue ? '' : JSON.stringify(sim.fact)}`);
          ok(JSON.stringify(sim.qy) === JSON.stringify(others.map(x => expQ(x).yue)), `${tag} Similar list yue (${others.length}) = oracle`);
          stats.similar++; if (changed.fact.has(fact.id)) stats.coreFact++;
        } else ok(!sim.show, `${tag} no similar → panel hidden`);
      }
      ok(errs.length === 0, `${lang} Exam ${exam} practice — no page errors ${errs.join('|')}`);
      await ctx.close();
    }
  }
  note('practice coverage', JSON.stringify(stats));
  // shared notes identical in the answer box (the sample holds 2 members of every group)
  for (const lang of LANGS) {
    const groups = sharedNoteGroups().map(g => g.filter(k => renderedNotes.practice[lang + k] !== undefined)).filter(g => g.length > 1);
    const bad = groups.filter(g => new Set(g.map(k => renderedNotes.practice[lang + k])).size > 1);
    ok(groups.length >= 21 && bad.length === 0, `${lang} shared notes: ${groups.length} groups shown in the answer box, all identical ${bad.map(g => g.map(ref).join('/')).join(' ')}`);
  }
}

// ══════════ 2. Result review: all 408 questions (exam mode, every exam) ══════════
async function resultReview(b) {
  for (const lang of LANGS) {
    let n = 0, noteN = 0;
    const bad = [];
    for (let exam = 1; exam <= 17; exam++) {
      const { ctx, pg, errs } = await fresh(b, 390, lang);
      await openExamResult(pg, exam);
      const keys = await sessionMap(pg);
      const items = await pg.evaluate(() => [...document.querySelectorAll('#reviewList .review-item')].map(it => {
        const yue = it.querySelector('.rv-yue'); const nt = it.querySelector('.rv-note');
        return { yue: yue.textContent, yueKids: yue.children.length,
          lines: nt ? [...nt.querySelectorAll('.rv-note-line, .rv-note-gap')].map(d => d.classList.contains('rv-note-gap') ? '' : d.textContent) : null,
          noteVisible: nt ? nt.innerText : '', foreign: nt ? [...nt.querySelectorAll('*')].filter(e => e.tagName !== 'DIV').map(e => e.tagName) : [] };
      }));
      const yt = await pg.evaluate(() => t('common.yueTitle'));
      ok(items.length === 24 && keys.length === 24, `${lang} Exam ${exam} result: 24 review items`);
      items.forEach((it, i) => {
        const k = keys[i], q = expQ(k);
        n++;
        if (it.yue !== yt + q.yue || it.yueKids) bad.push(`${ref(k)} yue "${it.yue}"`);
        if (q.note) {
          noteN++;
          const want = q.note.split('\n').map(l => l.trim());
          const p = noteProblems({ text: it.noteVisible, foreign: it.foreign });
          if (JSON.stringify(it.lines) !== JSON.stringify(want) || p.length) bad.push(`${ref(k)} note ${p.join(';')} ${JSON.stringify(it.lines).slice(0, 80)}`);
          renderedNotes.result[lang + k] = it.lines.join('\n');
        } else if (it.lines !== null) bad.push(`${ref(k)} unexpected note`);
      });
      ok(errs.length === 0, `${lang} Exam ${exam} result — no page errors ${errs.join('|')}`);
      await ctx.close();
    }
    ok(bad.length === 0, `${lang} Result review: ${n} questions show the oracle yue, ${noteN} notes one row per line (no \\n / <br> / HTML) ${bad.slice(0, 6).join(' | ')}`);
    const groups = sharedNoteGroups();
    const diff = groups.filter(g => new Set(g.map(k => renderedNotes.result[lang + k])).size > 1);
    ok(diff.length === 0, `${lang} Result review: ${groups.length} shared-note groups (${groups.reduce((s, g) => s + g.length, 0)} questions) identical on screen ${diff.map(g => g.map(ref).join('/')).join(' ')}`);
  }
}

// ══════════ 3. Study cards + search ══════════
async function studyCheck(b) {
  const SEARCH = [
    ['邊個', 'new colloquial'], ['排燈節', 'new term (Z6)'], ['雪墩', 'new term (Z1)'], ['和平紀念碑', 'new term'], ['布迪卡', 'new term (U4)'],
    ['千禧穹頂', 'new term (U7)'], ['嘅', 'colloquial particle'], ['Diwali', 'English'], ['castle', 'English'], ['Snowdon', 'English'],
    ['Boudicca', 'English'], ['斯諾登尼亞', 'old term, gone'], ['布狄卡', 'old term, gone'], ['協和飛機', 'old term, gone'],
  ];
  const hay = f => (f.en + ' ' + f.yue + ' ' + (f.p ? f.p[0] : '') + ' ' + (f.yl || '')).toLowerCase();
  for (const lang of LANGS) {
    const { ctx, pg, errs } = await fresh(b, 390, lang);
    await nav(pg, '#modeStudy');
    // every card, chapter by chapter
    const bad = []; let n = 0;
    for (const ch of [1, 2, 3, 4, 5]) {
      await tap(pg, `#studySubChips [data-action="studySetChapter"][data-arg="${ch}"]`);
      const cards = await pg.$$eval('#studyContent .fact[data-fact-id]', els => els.map(e => ({ id: Number(e.dataset.factId), yue: e.querySelector('.fact-yue').textContent, kids: e.querySelector('.fact-yue').children.length })));
      cards.forEach(c => { n++; const f = EXP_STUDY.find(x => x.id === c.id); if (c.yue !== f.yue || c.kids) bad.push(`#${c.id}`); });
    }
    ok(n === 236 && bad.length === 0, `${lang} Study chapters: ${n} cards, every fact-yue = oracle (${changed.fact.size} changed) ${bad.slice(0, 8).join(' ')}`);
    // other tabs reuse the card: spot check geo / people / timeline
    for (const tab of ['timeline', 'geo', 'people']) {
      await tap(pg, `#studyTabs [data-tab="${tab}"]`);
      const cards = await pg.$$eval('#studyContent .fact[data-fact-id]', els => els.map(e => ({ id: Number(e.dataset.factId), yue: e.querySelector('.fact-yue').textContent })));
      const wrong = cards.filter(c => EXP_STUDY.find(x => x.id === c.id).yue !== c.yue);
      ok(cards.length > 0 && wrong.length === 0, `${lang} Study ${tab}: ${cards.length} cards with the new yue`);
    }
    await tap(pg, '#studyTabs [data-tab="chapters"]');
    for (const [term, kind] of SEARCH) {
      await pg.fill('#studySearch', ''); await pg.type('#studySearch', term, { delay: 10 }); await sleep(80);
      const want = EXP_STUDY.filter(f => hay(f).includes(term.toLowerCase())).map(f => f.id).sort((a, b) => a - b);
      const got = (await pg.$$eval('#studyContent .fact[data-fact-id]', els => els.map(e => Number(e.dataset.factId)))).sort((a, b) => a - b);
      const count = await pg.textContent('#studyCount');
      const oldHits = OLD_STUDY.filter(f => hay(f).includes(term.toLowerCase())).length;
      const expectHits = !/gone/.test(kind);
      ok(JSON.stringify(got) === JSON.stringify(want) && (expectHits ? got.length > 0 : got.length === 0) && count.includes(String(want.length)),
        `${lang} Study search "${term}" (${kind}): ${got.length} facts = oracle [${want.join(',')}] (v0.65: ${oldHits}); count "${count}"`);
    }
    await pg.fill('#studySearch', ''); await pg.type('#studySearch', '雪墩'); await sleep(60);
    for (const tab of ['geo', 'timeline', 'people']) {
      await tap(pg, `#studyTabs [data-tab="${tab}"]`);
      const ids = await pg.$$eval('#studyContent .fact[data-fact-id]', els => els.map(e => Number(e.dataset.factId)));
      const want = EXP_STUDY.filter(f => hay(f).includes('雪墩') && (tab === 'geo' ? f.geo : tab === 'people' ? f.p : f.y !== undefined)).map(f => f.id);
      ok(JSON.stringify(ids.sort()) === JSON.stringify(want.sort()), `${lang} Study ${tab} search 雪墩: [${ids}] = oracle [${want}]`);
    }
    ok(errs.length === 0, `${lang} Study — no page errors ${errs.join('|')}`);
    await ctx.close();
  }
}

// ══════════ 4. long text: no horizontal overflow at 320 / 390 ══════════
async function overflow(b) {
  const all = Object.entries(EXP_EXAMS).flatMap(([e, l]) => l.map((q, i) => [`${e}.${i}`, q]));
  const longNote = all.filter(([, q]) => q.note).sort((x, y) => Math.max(...y[1].note.split('\n').map(s => s.length)) - Math.max(...x[1].note.split('\n').map(s => s.length))).slice(0, 4).map(([k]) => k);
  const longYue = all.sort((x, y) => (y[1].yue.length + Math.max(...(y[1].oy || ['']).map(s => s.length))) - (x[1].yue.length + Math.max(...(x[1].oy || ['']).map(s => s.length)))).slice(0, 2).map(([k]) => k);
  const targets = [...new Set([...longNote, ...longYue, '12.11', '11.3'])];
  note('overflow targets', targets.map(ref).join(' '));
  for (const lang of LANGS) for (const w of [320, 390]) {
    for (const k of targets) {
      const [exam] = k.split('.');
      const { ctx, pg } = await fresh(b, w, lang);
      await openPractice(pg, exam);
      const pos = (await sessionMap(pg)).indexOf(k);
      await tap(pg, `#navDots .dot:nth-child(${pos + 1})`);
      await tap(pg, '#yueToggle');
      let r = await noOverflow(pg);
      ok(r.sw <= r.iw && r.spill.length === 0, `${lang} ${w}px ${ref(k)} practice + Translate: no horizontal overflow ${r.spill.slice(0, 3).join(' ')}`);
      const order = await optionOrder(pg, k);
      for (const a of expQ(k).a) await tap(pg, `#opt${order.indexOf(a)}`);
      await pg.$eval('#answerBox', e => e.scrollIntoView());
      r = await noOverflow(pg);
      // CUI-0013 (multi-select quick nav at <= 375px) is fixed since v0.67 → no exemption any more
      ok(r.sw <= r.iw && r.spill.length === 0, `${lang} ${w}px ${ref(k)} answer box + note + Similar: no horizontal overflow ${r.spill.slice(0, 3).join(' ')}`);
      const box = await pg.$eval('#ansNote', e => ({ sw: e.scrollWidth, cw: e.clientWidth }));
      ok(box.sw <= box.cw + 1, `${lang} ${w}px ${ref(k)} note wraps inside the answer box (${box.sw} <= ${box.cw})`);
      if (k === longNote[0] && w === 320) await pg.screenshot({ path: shot(`${lang}_answer-long-note_${w}`), fullPage: true });
      await ctx.close();
    }
    // result review with the longest note + Study (longest fact yue)
    const { ctx, pg } = await fresh(b, w, lang);
    await openExamResult(pg, longNote[0].split('.')[0]);
    let r = await noOverflow(pg);
    ok(r.sw <= r.iw && r.spill.length === 0, `${lang} ${w}px Result review Exam ${longNote[0].split('.')[0]} (longest note): no horizontal overflow ${r.spill.slice(0, 3).join(' ')}`);
    await nav(pg, '#homeBtn').catch(() => {});
    await ctx.close();
    const s = await fresh(b, w, lang);
    await nav(s.pg, '#modeStudy');
    const longest = [...EXP_STUDY].sort((x, y) => y.yue.length - x.yue.length)[0];
    for (const ch of [1, 2, 3, 4, 5]) {
      await tap(s.pg, `#studySubChips [data-action="studySetChapter"][data-arg="${ch}"]`);
      r = await noOverflow(s.pg);
      ok(r.sw <= r.iw && r.spill.length === 0, `${lang} ${w}px Study Ch ${ch}${longest.ch === ch ? ' (longest fact #' + longest.id + ')' : ''}: no horizontal overflow ${r.spill.slice(0, 3).join(' ')}`);
    }
    await s.ctx.close();
  }
}

// ══════════ 5. offline + v0.65 → current version upgrade ══════════
async function offlineAndUpgrade(b) {
  const K = '11.3'; // E11·Q4: yue changed since v0.65 (batches 1..7)
  const translateYue = async pg => { await openPractice(pg, 11); const pos = (await sessionMap(pg)).indexOf(K); await tap(pg, `#navDots .dot:nth-child(${pos + 1})`);
    await tap(pg, '#yueToggle'); return pg.textContent('#qYue'); };
  const storage = pg => pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeuk-qa066-up-'));
  execSync(`git archive ${V065_REF} | tar -x -C "${dir}"`, { cwd: ROOT, shell: '/bin/bash' });
  const { base, server } = await startPagesServer(dir);
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage(); const { errs } = watch(pg);
    await pg.goto(base); await pg.evaluate(() => navigator.serviceWorker.ready);
    ok(await pg.evaluate(async () => { for (let i = 0; i < 75; i++) { if ((await caches.keys()).includes('lifeuk-v0.65')) return true;
      await new Promise(r => setTimeout(r, 200)); } return false; }), 'upgrade: SW cache lifeuk-v0.65 created');
    await pg.evaluate(() => { localStorage.clear();
      localStorage.setItem('lifeuk.uiLang', '"zh-HK"');
      localStorage.setItem('lifeuk.practiceStreak', '{"1.0":3,"2.1":1,"11.5":2}'); localStorage.setItem('lifeuk.practiceFlags', '{"3.4":true}');
      localStorage.setItem('lifeuk.wrongList', '{"4.11":true,"12.11":true}'); localStorage.setItem('lifeuk.completedExams', '{"1":true,"5":true}');
      localStorage.setItem('lifeuk.studyBookmarks', '{"38":true}'); localStorage.setItem('lifeuk.studyMastered', '{"1":true}'); });
    await pg.reload();
    ok(await pg.evaluate(() => APP_VERSION) === '0.65', 'upgrade: v0.65 installed');
    const before = await storage(pg);
    // v0.65 shows the old text (fresh tab so the practice flow does not touch progress keys before the snapshot)
    const p1 = await ctx.newPage(); await p1.goto(base); await sleep(200);
    const oldYue = await translateYue(p1);
    ok(oldYue === oldQ(K).yue, `upgrade: v0.65 Practice Translate shows the old yue "${oldYue}"`);
    await p1.close();
    const afterOldFlow = await storage(pg);
    // deploy the current version over the same folder
    fs.readdirSync(dir).forEach(f => fs.rmSync(path.join(dir, f), { recursive: true, force: true }));
    appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true }));
    await pg.reload();
    await pg.evaluate(async cur => { const reg = await navigator.serviceWorker.getRegistration();
      for (let i = 0; i < 100; i++) { const k = await caches.keys();
        if (k.length === 1 && k[0] === cur && !reg.installing && !reg.waiting && navigator.serviceWorker.controller) return true;
        if (!reg.installing && !reg.waiting) await reg.update().catch(() => {}); await new Promise(r => setTimeout(r, 200)); }
      return false; }, CUR_CACHE);
    const keys = await pg.evaluate(() => caches.keys());
    ok(keys.length === 1 && keys[0] === CUR_CACHE, `upgrade: new SW active, cache ${CUR_CACHE} only (${keys})`);
    await pg.reload();
    ok(await pg.evaluate(() => APP_VERSION) === CUR_VERSION, `upgrade: after reload v${CUR_VERSION}`);
    const after = await storage(pg);
    const keep = ['lifeuk.practiceStreak', 'lifeuk.practiceFlags', 'lifeuk.wrongList', 'lifeuk.completedExams', 'lifeuk.studyBookmarks', 'lifeuk.studyMastered', 'lifeuk.uiLang'];
    ok(keep.every(k => after[k] === afterOldFlow[k] && after[k] === before[k]), `upgrade: progress / streaks / flags / wrong list / Study marks byte-identical ${keep.map(k => k.slice(7) + '=' + after[k]).join(' ')}`);
    await nav(pg, '#modePractice');
    const home = await pg.evaluate(() => document.body.innerText);
    ok(home.includes('已標記 1 題') && /錯題[\s\S]{0,20}2/.test(home), 'upgrade: My Review shows flagged 1 + 2 wrong in zh-HK');
    await pg.goto(base); await sleep(200);
    const newYue = await translateYue(pg);
    ok(newYue === expQ(K).yue && newYue !== oldYue, `upgrade: v${CUR_VERSION} Practice Translate shows the new yue "${newYue}"`);
    // offline after the upgrade: data from the SW, new text
    await pg.goto(base); await sleep(200);
    await ctx.setOffline(true);
    await pg.reload();
    ok(await pg.evaluate(cur => !navigator.onLine && !!navigator.serviceWorker.controller && APP_VERSION === cur, CUR_VERSION), `offline: page from the v${CUR_VERSION} SW`);
    await nav(pg, '#modeStudy');
    await pg.type('#studySearch', '雪墩'); await sleep(80);
    const offIds = await pg.$$eval('#studyContent .fact[data-fact-id]', els => els.map(e => e.querySelector('.fact-yue').textContent));
    ok(offIds.length >= 1 && offIds.every(t => t.includes('雪墩')), `offline: Study search 雪墩 finds the new fact yue (${offIds.length})`);
    await pg.goto(base).catch(() => {}); await sleep(300);
    const offYue = await translateYue(pg);
    ok(offYue === expQ(K).yue, 'offline: Practice Translate shows the new yue');
    ok(errs.filter(e => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)).length === 0, 'upgrade / offline — no page errors ' + errs.join('|'));
    await ctx.close();
  } finally { server.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
}

// ══════════ 6. W-015: answer leak through Translate ══════════
// scan: distinctive terms shared by the question yue and a correct option (oy) that no wrong option has
const CJK = /^[㐀-鿿]+$/;
const GENERIC = new Set(['英國', '係咩', '邊個', '乜嘢', '可以', '一定', '國會', '政府', '英格蘭', '蘇格蘭', '威爾斯', '北愛爾蘭', '倫敦', '居民', '公民', '世紀', '國家', '咩嘢', '邊度', '人士', '法律', '時候', '邊年']);
function sharedTerms(Y, C, Ws) {
  const out = new Set();
  for (const r of C.match(/[㐀-鿿]+|[A-Za-z][A-Za-z' ]{2,}[A-Za-z]/g) || []) {
    if (!CJK.test(r)) { if (Y.toLowerCase().includes(r.toLowerCase()) && !Ws.some(w => w.toLowerCase().includes(r.toLowerCase()))) out.add(r); continue; }
    for (let L = r.length; L >= 2; L--) for (let i = 0; i + L <= r.length; i++) { const s = r.slice(i, i + L); if (Y.includes(s) && !Ws.some(w => w.includes(s))) out.add(s); }
  }
  return [...out].filter(s => ![...out].some(o => o !== s && o.includes(s)));
}
function w015Scan(EX) {
  const allYue = Object.values(EX).flat().map(q => q.yue);
  const rows = [];
  for (const [e, list] of Object.entries(EX)) list.forEach((q, i) => {
    if (!q.oy) return;
    for (const a of q.a) {
      if (!q.oy[a]) continue;
      const wrong = q.oy.filter((s, k) => !q.a.includes(k) && s);
      const terms = sharedTerms(q.yue, q.oy[a], wrong).filter(s => !GENERIC.has(s) && (s.length >= 3 || allYue.filter(y => y.includes(s)).length <= 12));
      if (terms.length) rows.push({ k: `${e}.${i}`, a, terms, yue: q.yue, oy: q.oy[a], q: q.q, o: q.o[a] });
    }
  });
  return rows;
}
// S-056 (rerun after batch 7, CUI-0015): expectations inverted. Batch 7 `apply` records must no longer leak before
// answering; `keep` records (A6 E3·Q3, A9 E12·Q17, A10 E17·Q11) are a user-accepted trade-off → note only, never fail.
const W015_BASELINE = { v065: 45, preBatch7: 48, now: 34 };
async function w015(b) {
  const now = w015Scan(EXP_EXAMS), before = w015Scan(OLD_EXAMS), pre7 = w015Scan(PRE_BATCH7 || EXP_EXAMS);
  const head = w015Scan(loadData(fs.readFileSync(path.join(ROOT, 'data/exams.js'), 'utf8'), 'EXAMS')); // repo data, cross-check of the oracle
  const byK = r => r.k + '/' + r.a;
  const sig = r => byK(r) + '=' + r.terms.join('+');
  const oldMap = Object.fromEntries(before.map(r => [byK(r), r]));
  const preMap = Object.fromEntries(pre7.map(r => [byK(r), r]));
  const rows = now.map(r => ({ ...r, v065: oldMap[byK(r)] ? oldMap[byK(r)].terms : [], pre7: preMap[byK(r)] ? preMap[byK(r)].terms : [] }));
  const gone = pre7.filter(r => !now.some(x => byK(x) === byK(r)));
  const added = now.filter(r => !preMap[byK(r)]);
  const termChanged = now.filter(r => preMap[byK(r)] && preMap[byK(r)].terms.join() !== r.terms.join());
  note(`W-015 scan: now ${now.length} pairs (repo data ${head.length}); before batch 7 ${pre7.length}; v0.65 ${before.length}; resolved by batch 7 ${gone.length}; new ${added.length}; term changed ${termChanged.length}`);
  ok(pre7.length === W015_BASELINE.preBatch7 && before.length === W015_BASELINE.v065, `W-015 scan baseline: before batch 7 = ${pre7.length} (want ${W015_BASELINE.preBatch7}), v0.65 = ${before.length} (want ${W015_BASELINE.v065})`);
  ok(now.length === W015_BASELINE.now, `W-015 scan after batch 7 = ${now.length} pairs (want ${W015_BASELINE.now})`);
  ok(JSON.stringify(head.map(sig)) === JSON.stringify(now.map(sig)), `W-015 scan of repo data/exams.js = oracle scan (${head.length} vs ${now.length})`);
  ok(added.length === 0 && termChanged.length === 0, `W-015 scan: no new pair / no changed term vs before batch 7 ${added.concat(termChanged).map(r => ref(r.k) + ':' + r.terms.join('+')).join(' ')}`);
  const out = { rows: rows.map(r => ({ ref: ref(r.k), opt: r.a, terms: r.terms, preBatch7: r.pre7, v065: r.v065, yue: r.yue, oy: r.oy, q: r.q, o: r.o })),
    resolvedByBatch7: gone.map(r => ({ ref: ref(r.k), terms: r.terms, yue: r.yue, oy: r.oy })) };
  if (process.env.QA_W015_OUT) fs.writeFileSync(process.env.QA_W015_OUT, JSON.stringify(out, null, 1)); else console.log(JSON.stringify(out));

  const applied = ANTILEAK.filter(r => r.userDecision === 'apply' && r.field === 'yue');
  const kept = ANTILEAK.filter(r => r.userDecision === 'keep');
  ok(applied.length === 16 && kept.length === 3, `batch 7: 16 apply + 3 keep records (${applied.length} + ${kept.length})`);
  const keyOf = r => `${r.exam}.${r.qIndex}`;
  // static: every applied question is out of the scan, its yue = batch `after`; every kept one is still `before` and still listed
  for (const r of applied) {
    const k = keyOf(r), pre = pre7.filter(x => x.k === k);
    ok(expQ(k).yue === r.after && !now.some(x => x.k === k), `${r.decision} ${ref(k)}: yue = batch after "${r.after}", no longer in the scan (before batch 7: ${pre.map(x => x.terms.join('+')).join(' ') || 'not listed'})`);
  }
  for (const r of kept) {
    const k = keyOf(r), hit = now.filter(x => x.k === k);
    ok(expQ(k).yue === r.before, `${r.decision} ${ref(k)}: user keep → yue unchanged "${r.before}"`);
    note(`user-accepted trade-off ${r.decision} ${ref(k)}: shared term ${hit.map(x => x.terms.join('+')).join(' ') || '(none)'} — "${r.before}" vs oy "${hit.map(x => x.oy).join(' / ')}"`);
  }
  // UI, before answering (Practice Translate): applied → no distinctive term shared by question yue and only the correct option
  const CASES = { '11.3': '排燈節', '4.11': '排燈節', '12.11': '倫敦塔' }; // the three cases confirmed leaking in the first QA run
  const allYue = Object.values(EXP_EXAMS).flat().map(q => q.yue);
  const uiTerms = (qy, oy, order, a) => {
    const right = oy.filter((s, i) => a.includes(order[i]) && s), wrong = oy.filter((s, i) => !a.includes(order[i]) && s);
    return [...new Set(right.flatMap(c => sharedTerms(qy, c, wrong)))].filter(s => !GENERIC.has(s) && (s.length >= 3 || allYue.filter(y => y.includes(s)).length <= 12));
  };
  for (const lang of LANGS) for (const r of [...applied, ...kept]) {
    const k = keyOf(r), isKeep = r.userDecision === 'keep';
    const { ctx, pg, errs } = await fresh(b, 390, lang);
    await openPractice(pg, k.split('.')[0]);
    const pos = (await sessionMap(pg)).indexOf(k);
    await tap(pg, `#navDots .dot:nth-child(${pos + 1})`);
    await tap(pg, '#yueToggle');
    const order = await optionOrder(pg, k);
    const v = await pg.evaluate(() => ({ qy: byId('qYue').textContent, revealed: state.current in state.revealed,
      oy: [...document.querySelectorAll('#optionsContainer .opt')].map(o => (o.querySelector('.opt-yue') || {}).textContent || '') }));
    const terms = uiTerms(v.qy, v.oy, order, expQ(k).a);
    const tag = `${lang} W-015 ${r.decision} ${ref(k)}`;
    if (isKeep) {
      ok(!v.revealed && v.qy === r.before, `${tag}: Translate before answering shows the kept yue "${v.qy}"`);
      note(`${tag}: user-accepted leak on screen — shared ${terms.join('+') || '(none)'}`);
    } else {
      const term = CASES[k];
      ok(!v.revealed && v.qy === r.after && terms.length === 0 && (!term || !v.qy.includes(term)),
        `${tag}: before answering, Translate question "${v.qy}" shares no distinctive term with only the correct option${term ? ` ("${term}" gone)` : ''} ${terms.join('+')}`);
    }
    ok(errs.length === 0, `${tag}: no page errors ${errs.join('|')}`);
    if (CASES[k] && (lang === ZH || k === '11.3')) await pg.screenshot({ path: shot(`${lang}_w015-${ref(k).replace('·', '-')}_390`) });
    await ctx.close();
    if (!CASES[k]) continue;
    // exam mode: no Translate before submitting (unchanged expectation)
    const ex = await fresh(b, 390, lang);
    await nav(ex.pg, '#modeExam'); await nav(ex.pg, `#examGrid [data-arg="${k.split('.')[0]}"]`);
    await tap(ex.pg, `#navDots .dot:nth-child(${Number(k.split('.')[1]) + 1})`);
    const exv = await ex.pg.evaluate(() => ({ toggle: byId('yueToggle').getClientRects().length > 0 && byId('yueToggle').classList.contains('visible'), qy: byId('qYue').getClientRects().length > 0, oy: document.querySelectorAll('.opt-yue').length }));
    ok(!exv.toggle && !exv.qy && exv.oy === 0, `${lang} W-015 ${ref(k)}: exam mode has no Translate / no yue before submit (scoring unaffected)`);
    await ex.ctx.close();
  }
}

// ══════════ 7. screenshots (zh-HK + en, 390 + 320) ══════════
async function shots(b) {
  const simK = '10.14'; // E10·Q15: has similar questions (similar-test)
  const flows = {
    'practice-translate': async pg => { await openPractice(pg, 3); const pos = (await sessionMap(pg)).indexOf('3.12'); await tap(pg, `#navDots .dot:nth-child(${pos + 1})`); await tap(pg, '#yueToggle'); },
    'practice-answer-note': async pg => { await openPractice(pg, 1); const pos = (await sessionMap(pg)).indexOf('1.11'); await tap(pg, `#navDots .dot:nth-child(${pos + 1})`);
      const order = await optionOrder(pg, '1.11'); await tap(pg, `#opt${order.indexOf(expQ('1.11').a[0])}`); await pg.$eval('#answerBox', e => e.scrollIntoView()); },
    'similar-core-fact': async pg => { const [e] = simK.split('.'); await openPractice(pg, e); const pos = (await sessionMap(pg)).indexOf(simK); await tap(pg, `#navDots .dot:nth-child(${pos + 1})`);
      await tap(pg, '#opt0'); await pg.$eval('#similarBox', el => el.scrollIntoView()); },
    'result-review': async pg => { await openExamResult(pg, 1); await pg.$eval('#reviewList .review-item:nth-child(3)', e => e.scrollIntoView()); },
    'study-search': async pg => { await nav(pg, '#modeStudy'); await pg.type('#studySearch', '排燈節'); await sleep(80); },
  };
  for (const lang of LANGS) for (const w of [390, 320]) for (const [name, fn] of Object.entries(flows)) {
    const { ctx, pg } = await fresh(b, w, lang, null, APP_URL, { deviceScaleFactor: 2 });
    await fn(pg); await sleep(120);
    await pg.screenshot({ path: shot(`${lang}_${name}_${w}`) });
    await ctx.close();
  }
}

(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const b = await chromium.launch(launchOpts);
  const sections = { versionCheck, practiceSample, resultReview, studyCheck, overflow, offlineAndUpgrade, w015, shots };
  const only = process.env.QA_ONLY ? process.env.QA_ONLY.split(',') : Object.keys(sections);
  try {
    for (const k of only) {
      console.log(`\n── ${k} ──`);
      try { await sections[k](b); } catch (e) { fail++; failures.push(`${k} threw ${e.message.split('\n')[0]}`); console.log(`FAIL: ${k} threw`, e); }
    }
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) console.log('failures:\n - ' + failures.join('\n - '));
  process.exit(fail ? 1 : 0);
})();
