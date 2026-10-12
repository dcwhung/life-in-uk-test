// v1.3.2 fact-merge edge cases on file:// (argv: v132 root)
const { chromium } = require('playwright-core');
const URL = 'file://' + process.argv[2] + '/index.html';
let fails = 0; const check = (c, m) => { console.log((c ? 'ok:   ' : 'FAIL: ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const seed = async kv => { await pg.goto(URL); await pg.evaluate(kv => { localStorage.clear(); Object.entries(kv).forEach(([k, v]) => localStorage.setItem(k, v)); }, kv); await pg.reload(); };
  const ls = () => pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
  // E1: OR merge — 125 bookmarked only, 126 mastered + bookmarked; 125 mastered {false-y absent}
  await seed({ 'lifeuk.migrated': '1.2.0', 'lifeuk.studyMastered': '{"126":true,"7":true}', 'lifeuk.studyBookmarks': '{"125":true,"126":true}' });
  let s = await ls();
  check(s['lifeuk.studyMastered'] === '{"7":true,"125":true}' && s['lifeuk.studyBookmarks'] === '{"125":true}' && s['lifeuk.factIdsMerged'] === '[126]', 'E1 OR merge: 125 gets 126 mastered, bookmarks dedupe, 7 kept: ' + JSON.stringify(s));
  // E2: nothing to move — no marker, nothing written
  await seed({ 'lifeuk.migrated': '1.2.0', 'lifeuk.studyMastered': '{"3":true}' });
  s = await ls();
  check(!('lifeuk.factIdsMerged' in s) && s['lifeuk.studyMastered'] === '{"3":true}', 'E2 no 126 anywhere: no marker, marks untouched: ' + JSON.stringify(s));
  // E3: corrupt mastered JSON + bookmarks with 126 — no crash, corrupt value left as is, bookmarks moved
  await seed({ 'lifeuk.migrated': '1.2.0', 'lifeuk.studyMastered': '{"126":tr', 'lifeuk.studyBookmarks': '{"126":true}' });
  s = await ls();
  const ui = await pg.evaluate(() => { openStudy(); studySetTab('chapters'); studySetChapter(4); return byId('studyProgress').innerText; });
  check(s['lifeuk.studyMastered'] === '{"126":tr' && s['lifeuk.studyBookmarks'] === '{"125":true}', 'E3 corrupt mastered left as stored, bookmarks moved, Study renders (' + ui + '): ' + JSON.stringify(s));
  // E4: plan wrongFacts task with 126 + anchor, read task with 125 and 126 -> facts [125..] once, anchor {125: q}
  await seed({});
  await pg.evaluate(() => { goHome(); setPlanFeature(true); openPlanGoal(); planCreate(); });
  await pg.evaluate(() => { const p = JSON.parse(localStorage.getItem(STUDY_PLAN_LS));
    const rd = p.days.flatMap(d => d.tasks).find(t => t.type === 'read' && t.facts.includes(125)); rd.facts.push(126);
    const day = p.days.find(d => d.tasks.some(t => t.type === 'wrongFacts')); const wf = day.tasks.find(t => t.type === 'wrongFacts');
    wf.facts = [126, 1]; wf.anchor = { 126: '3.22', 1: '1.0' }; localStorage.setItem(STUDY_PLAN_LS, JSON.stringify(p)); });
  await pg.reload();
  const p4 = await pg.evaluate(() => { const p = JSON.parse(localStorage.getItem(STUDY_PLAN_LS)); const all = p.days.flatMap(d => d.tasks);
    const wf = all.find(t => t.type === 'wrongFacts' && t.anchor); const rd = all.find(t => t.type === 'read' && t.facts.includes(125));
    return { wf, rdDup: rd.facts.filter(x => x === 125).length, rd126: rd.facts.includes(126), parsed: !!planLoad(), create: !!document.querySelector('.plan-cta') }; });
  check(JSON.stringify(p4.wf.facts) === '[125,1]' && JSON.stringify(p4.wf.anchor) === '{"1":"1.0","125":"3.22"}' && p4.rdDup === 1 && !p4.rd126 && p4.parsed && !p4.create,
    'E4 plan: wrongFacts facts/anchor 126 -> 125, read task 125 once, plan parses, Home has no create card: ' + JSON.stringify(p4));
  // E5: residual — after the marker, an old v1.2.0 tab writes 126 into marks again: not moved (marks run once)
  await seed({ 'lifeuk.migrated': '1.2.0', 'lifeuk.factIdsMerged': '[126]', 'lifeuk.studyMastered': '{"126":true}' });
  s = await ls();
  console.log('info: E5 marker [126] + mastered {126} after load ->', s['lifeuk.studyMastered'], '(126 stays orphaned; documented residual)');
  // E6: plan written back with 126 after the marker (W-060) moves on load
  await seed({});
  await pg.evaluate(() => { goHome(); setPlanFeature(true); openPlanGoal(); planCreate(); const p = JSON.parse(localStorage.getItem(STUDY_PLAN_LS));
    p.days.flatMap(d => d.tasks).filter(t => t.type === 'read' && t.facts.includes(125)).forEach(t => { t.facts = t.facts.map(x => (x === 125 ? 126 : x)); });
    localStorage.setItem(STUDY_PLAN_LS, JSON.stringify(p)); localStorage.setItem(FACT_MERGE_LS, '[126]'); });
  await pg.reload();
  const p6 = await pg.evaluate(() => ({ any126: JSON.parse(localStorage.getItem(STUDY_PLAN_LS)).days.some(d => d.tasks.some(t => (t.facts || []).includes(126))), parsed: !!planLoad() }));
  check(!p6.any126 && p6.parsed, 'E6 marker already set + plan with 126 -> moved on load, plan parses: ' + JSON.stringify(p6));
  check(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await b.close(); console.log(fails ? 'EDGE FAIL ' + fails : 'EDGE PASS');
})().catch(e => { console.error(e); process.exit(1); });
