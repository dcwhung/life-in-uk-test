// Generate the follow-up memo spec (decisions #39–#45a in 2026-10-10_memo-split-decisions.md)
// from the CURRENT data/exams.js + data/study.js (main v1.1.5). Run from repo root BEFORE applying:
//   node .proj-docs/plans/2026-10-12_memo-followup-spec.gen.js .proj-docs/plans/2026-10-12_memo-followup-spec.json
const fs = require('fs');
const EXAMS = new Function(fs.readFileSync('data/exams.js', 'utf8') + ';return EXAMS;')();
const STUDY = new Function(fs.readFileSync('data/study.js', 'utf8') + ';return STUDY;')();
const get = (k) => { const [e, i] = k.split('.'); return EXAMS[e][i]; };
const MEMO_RE = /記憶法/;
const split = (k) => { const n = get(k).note || ''; const ls = n.split('\n'); const i = ls.findIndex((l) => MEMO_RE.test(l)); return i < 0 ? { prefix: [], memo: [] } : { prefix: ls.slice(0, i), memo: ls.slice(i) }; };
const sameMemo = (k) => split(k).memo.join('\n');
const membersOf = (sample) => { const t = sameMemo(sample); const out = []; for (const e in EXAMS) EXAMS[e].forEach((q, i) => { const k = `${e}.${i}`; if (t && sameMemo(k) === t) out.push(k); }); return out; };
const notes = {}; const memos = [];
function memo(id, title, sample, extra, transform) {
  const base = membersOf(sample); const text = transform(split(sample).memo).join('\n');
  [...base, ...extra].forEach((k) => { const p = base.includes(k) ? split(k).prefix : []; notes[k] = [...p, text].join('\n'); });
  memos.push({ id, title, questions: [...base, ...extra], added: extra, text });
}
// #39 E6: 4A 四地議會 + devolution
memo('4A', '四地議會（+ E6）', '6.8', ['10.10', '12.12'], (m) => [...m, '• Devolution（權力下放）', '    → 中央將部分權力交俾三地議會', '    → 國防、外交、移民冇下放，由英國政府負責']);
// #40 E3: ③ 加「語言」欄
memo('③', '首都 / 國花（+ E3 語言）', '2.16', ['6.20', '13.12'], (m) => {
  const lang = { '國家': '語言', England: 'English<br>英文', Scotland: 'Gaelic<br>蓋爾語', Wales: 'Welsh<br>威爾斯語', 'N. Ireland': 'Irish Gaelic<br>愛爾蘭語' };
  const out = m.map((l) => { const c = l.match(/^\| ([^|]+?) \|/); return c && lang[c[1]] ? `${l} ${lang[c[1]]} |` : l; });
  return [...out, '• Gaelic 係凱爾特語，Scotland 同 Ireland 部分地區講'];
});
// #41 E5: 10A + National Parks
memo('10A', '國家公園同山（+ E5）', '3.12', ['6.3'], (m) => [...m, '• National Parks（國家公園）', '    → 受保護嘅郊野', '    → England、Wales、Scotland 一共 15 個']);
// #42 E7: ⑥ 11/11 行加 Cenotaph
memo('⑥', '全年節日（+ E7 Cenotaph）', '2.14', ['1.7', '11.8'], (m) => m.map((l) => l.startsWith('| 11/11 |') ? l.replace(/ \|$/, '<br>喺 London Whitehall（白廳）嘅<br>Cenotaph（戰爭紀念碑）獻花圈 |') : l));
// #43 F9: 7.8 單句備註（冇記憶法）
notes['7.8'] = 'Gunpowder Plot（火藥陰謀）：1605 年 Guy Fawkes 等人想炸毀國會、殺死 King James I（詹姆斯一世），失敗\n    → 每年 5/11 Bonfire Night（篝火之夜）就係紀念陰謀失敗\n    → 所以 Bonfire Night 又叫 Guy Fawkes Night';
// #45a 舊 4 組：刪句尾「；」/「。」+ 標題
const restyle = (title) => (m) => [title, ...m.slice(1).map((l) => l.replace(/[；。]$/, ''))];
memo('MagnaCarta', 'Magna Carta 大憲章', '4.16', [], restyle('記憶法（Magna Carta 大憲章）：'));
memo('Election', '國會選舉', '3.11', [], restyle('記憶法（國會選舉）：'));
memo('Thatcher', 'Margaret Thatcher 戴卓爾夫人', '1.8', [], restyle('記憶法（Margaret Thatcher 戴卓爾夫人）：'));
memo('Juror', '陪審員', '1.13', [], restyle('記憶法（陪審員）：'));
// #44 S3: fact #126 併入 #125
const f125 = STUDY.find((f) => f.id === 125), f126 = STUDY.find((f) => f.id === 126);
const study = {
  merge: { into: 125, delete: 126 },
  fact125: { ...f125, d: 4, src: [...f125.src, ...f126.src],
    en: 'The UK currency is the pound sterling (£). Coins: 1p, 2p, 5p, 10p, 20p, 50p, £1 and £2. Notes: £5, £10, £20 and £50. Scotland and Northern Ireland have their own banknotes, which are valid everywhere in the UK.',
    yue: '英國貨幣係英鎊（pound sterling, £）。硬幣有 1p、2p、5p、10p、20p、50p、£1、£2。紙幣有 £5、£10、£20、£50。蘇格蘭同北愛爾蘭有自己嘅紙幣，全英國通用。' },
  fact126Before: f126,
};
const changed = Object.keys(notes).filter((k) => notes[k] !== get(k).note);
const out = { _doc: '記憶法跟進規格（2026-10-12）：notes = 每題最終 note（只列有改動嘅題目）；memos = 改動咗嘅記憶法；study = fact #126 併入 #125。由 main v1.1.5 data 生成；data 改完之後唔好再跑。', base: 'main v1.1.5', memos, notes: Object.fromEntries(changed.map((k) => [k, notes[k]])), study, stats: { changedNotes: changed.length } };
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(out.stats, memos.map((m) => `${m.id}:${m.questions.length}`).join(' '));
