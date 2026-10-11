// QA v1.1.2 regression: every question field vs origin/main; only 9.14 / 12.5 / 12.18 note may change
const fs=require('fs');
const load=p=>new Function(fs.readFileSync(p,'utf8')+';return EXAMS;')();
const SP=process.argv[2]; // dir holding exams_main.js / study_main.js (git show 08c2652:data/…)
const A=load(SP+'/exams_main.js'), B=load('/home/user/life-in-uk-test/data/exams.js');
const spec=JSON.parse(fs.readFileSync('/home/user/life-in-uk-test/tests/fixtures/memo-notes.json','utf8'));
const changed=[], other=[];
let n=0;
for (const e of Object.keys(A)) A[e].forEach((q,i)=>{ n++; const r=B[e][i];
  for (const f of new Set([...Object.keys(q),...Object.keys(r)])) if (JSON.stringify(q[f])!==JSON.stringify(r[f])) (f==='note'?changed:other).push(`${e}.${i}:${f}`); });
console.log('questions',n,'exams',Object.keys(A).length,Object.keys(B).length,'note changed',changed,'other fields changed',other);
const memoOf=k=>spec.memos.find(m=>m.questions.includes(k));
for (const [k,id] of [['6.8','4A'],['8.15','N8a'],['1.5','5B']]) { const [e,i]=k.split('.').map(Number);
  const m=memoOf(k); const exp=(spec.prefixes[k]!==undefined?spec.prefixes[k]+'\n':'')+m.text;
  console.log(k,'memo',m.id,'expected',id,'unchanged vs main',A[e][i].note===B[e][i].note,'= fixture',B[e][i].note===exp); }
const S=new Function(fs.readFileSync('/home/user/life-in-uk-test/data/study.js','utf8')+';return STUDY;')();
const S0=new Function(fs.readFileSync(SP+'/study_main.js','utf8')+';return STUDY;')();
console.log('study.js identical', JSON.stringify(S)===JSON.stringify(S0));
