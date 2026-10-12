const fs=require('fs');const [a,b,specP]=process.argv.slice(2);
const load=(d,f,n)=>new Function(fs.readFileSync(d+'/data/'+f,'utf8')+';return '+n)();
const EA=load(a,'exams.js','EXAMS'),EB=load(b,'exams.js','EXAMS');
const spec=JSON.parse(fs.readFileSync(specP,'utf8'));
const specKeys=Object.keys(spec.notes||{});
let changed=[],other=[],total=0;
for(const e of Object.keys(EB)){EB[e].forEach((q,i)=>{total++;const o=EA[e][i];const k=e+'.'+i;
 const {note:n1,...r1}=o,{note:n2,...r2}=q;
 if(JSON.stringify(r1)!==JSON.stringify(r2))other.push(k);
 if(n1!==n2)changed.push(k);
 if(specKeys.length&&spec.notes[k]!==undefined&&spec.notes[k]!==n2)console.log('SPEC MISMATCH',k);
});}
console.log('total q',total,'note changed',changed.length,'non-note field changed',other);
console.log('changed not in spec',changed.filter(k=>!specKeys.includes(k)),'spec not changed',specKeys.filter(k=>!changed.includes(k)));
const SA=load(a,'study.js','STUDY'),SB=load(b,'study.js','STUDY');
console.log('STUDY',SA.length,'->',SB.length);
const mb=new Map(SB.map(f=>[f.id,f]));let diff=[];
SA.forEach(f=>{const g=mb.get(f.id);if(!g)diff.push('missing '+f.id);else if(JSON.stringify(f)!==JSON.stringify(g))diff.push('changed '+f.id)});
SB.forEach(f=>{if(!SA.find(x=>x.id===f.id))diff.push('new '+f.id)});
console.log(diff, JSON.stringify(mb.get(125)));
// srcs referencing 126?
console.log('ids order ch4', SB.filter(f=>f.ch===4).map(f=>f.id).join(','));
