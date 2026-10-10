# 記憶法 table display（已實作 v1.0.7）

- 日期：2026-10-09
- 狀態：**設計已確認；2026-10-10 grill 決定見最後「Grill 決定」一節（覆蓋上面 ④–⑨ 文字、題數同未決定事項）**
- Mockup：`mockups/note-table.html`（顏色，Theme B）、`mockups/note-table-church.html`（格內備注，V4）、`mockups/note-table-all.html`（全部 10 組內容）
- Design Origin：`mockup:mockups/note-table.html` + `mockup:mockups/note-table-church.html` + `mockup:mockups/note-table-all.html`

## 用戶已確認嘅決定

| 項目 | 決定 |
|------|------|
| 做法 | 方案 A：明確語法（note 入面連續以 `\|` 開頭嘅行 render 成 table，第一行係 header）；唔做自動偵測 `→` |
| 格仔內容 | 主文全部英文，國家同國花都唔要中文字（390px 一行放得晒，唔使 scroll） |
| 顏色 | **Theme B：Minimal 線條**（冇底色，header 深藍字 + 2px `--navy` 底線，行之間 1px `--divider`，最後一行冇線，第一欄 `--navy` 粗體），跟住所在框嘅背景 |
| 格內備注 | **V4**：格入面用 `<br>` 分開主文同備注；第一段 = 主文（正常字），之後每段 = 備注（`--fs-xs`、`--text-muted`，自己一行）；只有用咗 `<br>` 嘅格可以轉行，其他格 `nowrap` |
| 混合行 | 同一個 note 入面 table 行同普通文字行（標題、• 列點）可以混合，非 `\|` 行照舊用 `noteLineHtml()` |
| 第一批 | **10 組全部**（用戶 2026-10-09 決定）：① 聖人 / 日子、② 國教 / 教會、③ 首都 / 國花、④ 地方議會、⑤ 發明家、⑥ 節日、⑦ 英國重要戰役、⑧ 二戰、⑨ 國王 vs 國會、⑩ 名勝 / 地方（新組），見下面 |
| 國花 | 由聖人組搬去首都組（用戶 2026-10-09 決定）：首都 / 國花合併成一個 table（③） |
| 唔做 | 都鐸王朝、三層屬地、Magna Carta、選舉、戴卓爾夫人、陪審員：保持文字 |

## 第一批 data（10 組、99 題，用戶 2026-10-09 決定全部加入）

### ① 聖人 / 日子（10 題）

```
記憶法：
| 國家 | 聖人 | 日子 |
| England | George | 23/4 |
| Scotland | Andrew | 30/11 |
| Wales | David | 1/3 |
| N. Ireland | Patrick | 17/3 |
```

題目：Exam 1 Q5、2 Q16、10 Q1、11 Q10（patron saint）；Exam 5 Q22、7 Q16、8 Q5、8 Q23、13 Q1、14 Q1（St * Day）。Exam 5 Q14（X 形十字）唔改。

### ② 國教 / 教會（5 題）

```
記憶法：
| 國家 | 國教 | 教會 |
| England | ✓ | Church of England<br>君主係最高領袖，坎特伯雷大主教係精神領袖 |
| Scotland | ✗ | Church of Scotland<br>Presbyterian（長老會），國家教會，唔係國教 |
| Wales | ✗ | ✗ |
| N. Ireland | ✗ | ✗ |
```

題目：Exam 3 Q2、3 Q16、5 Q7、6 Q5、10 Q3（而家係 `a09aedb` 箭咀文字版）。

### ③ 首都 / 國花（11 題）

```
記憶法：
| 國家 | 首都 | 國花 |
| England | London | Tudor rose |
| Scotland | Edinburgh | Thistle |
| Wales | Cardiff | Daffodil |
| N. Ireland | Belfast | Shamrock |
```

題目：首都：Exam 2 Q17、2 Q22、3 Q17、4 Q11、9 Q9、9 Q24；國花（由聖人組搬過嚟）：Exam 4 Q2、8 Q2、8 Q13、9 Q1、9 Q20。

### ④ 地方議會（7 題）

```
記憶法：
| 地區 | 議會 / 地點 | 議員 |
| England | UK Parliament<br>Westminster | 650<br>全英國 MP |
| Scotland | Scottish Parliament<br>Edinburgh | 129 |
| Wales | Senedd<br>Cardiff | 60 |
| N. Ireland | NI Assembly<br>Belfast | 90 |
• England 冇自己嘅地方議會，由英國國會直接負責；
• Senedd 議員：考試答 60（2026 年選舉起增至 96）；
• Scotland / Wales / N. Ireland 三個議會用比例代表制（proportional representation）；
• 英國國會用領先者當選制（first past the post）
```

題目：Exam 6 Q9、7 Q18、8 Q20、9 Q19、12 Q3、13 Q8、14 Q2。

### ⑤ 發明家（6 題）

```
記憶法：
| 年份 | 人物 / 發明 |
| 17 世紀 | Isaac Newton<br>萬有引力、運動定律 |
| 1876 | Alexander Graham Bell<br>電話（蘇格蘭裔） |
| 1928 | Alexander Fleming<br>盤尼西林 penicillin（蘇格蘭人） |
| 1930s | Frank Whittle<br>噴射引擎 jet engine |
| 1953 | Francis Crick<br>DNA 結構（同 James Watson 一齊發現） |
| 1989 | Tim Berners-Lee<br>萬維網 World Wide Web |
```

題目：Exam 1 Q21、6 Q10、8 Q7、8 Q12、9 Q11、14 Q8。

### ⑥ 節日（按月份）（11 題）

```
記憶法：
| 日期 | 節日 |
| 25/1 | Burns Night<br>紀念蘇格蘭詩人 Robert Burns |
| 31/10 | Halloween |
| 5/11 | Bonfire Night<br>紀念 1605 年火藥陰謀（Gunpowder Plot）失敗 |
| 11/11 | Remembrance Day<br>戴紅罌粟花 |
| 26/12 | Boxing Day<br>聖誕節翌日 |
| 31/12 | Hogmanay<br>蘇格蘭除夕 |
```

題目：Exam 2 Q15、2 Q18、6 Q17、7 Q2、9 Q8、9 Q12、10 Q5、11 Q23、12 Q20、14 Q21、16 Q18。

### ⑩ 名勝 / 地方（17 題）

```
記憶法：
| 名勝 | 國家 | 地點 |
| Lake District<br>英格蘭最大國家公園 | England | National Park |
| Stonehenge<br>約 5,000 年前建成 | England | Wiltshire |
| Eden Project<br>巨型溫室生態館 | England | Cornwall |
| Glastonbury<br>音樂節 | England | Somerset |
| Tate<br>Tate Britain、Tate Modern | England | London |
| Ben Nevis<br>英國最高山 | Scotland | Highlands |
| Loch Lomond & Trossachs<br>蘇格蘭國家公園 | Scotland | National Park |
| Edinburgh Castle<br>愛丁堡城堡 | Scotland | Edinburgh |
| National Galleries of Scotland<br>蘇格蘭國家美術館 | Scotland | Edinburgh |
| Snowdonia<br>Snowdon 係威爾斯最高山 | Wales | National Park |
| Giant's Causeway<br>火山熔岩形成嘅玄武岩柱 | N. Ireland | County Antrim |
```

題目：Exam 9 Q4、13 Q2（Lake District）、14 Q19（Stonehenge）、4 Q19、5 Q3（Eden Project）、11 Q22、13 Q20（Glastonbury）、12 Q7（Tate）、4 Q9（Ben Nevis）、10 Q2（Loch Lomond）、11 Q20（Edinburgh Castle）、8 Q8（National Galleries）、3 Q13、4 Q15、7 Q11（Snowdonia / Snowdon）、7 Q19、16 Q2（Giant's Causeway）。而家呢 17 題冇記憶法（只有一句 note 或者冇 note）；有原有 note 嘅題目，原句保留做第一行，table 跟喺「記憶法：」後面。E6 Q4（National Parks 定義）同倫敦名勝唔放入。

### ⑦ 英國重要戰役（15 題）

```
記憶法：
| 年份 | 戰役 / 結果 |
| 9 世紀 | Alfred the Great vs Vikings<br>統一盎格魯-撒克遜王國，打敗維京人 |
| 1066 | Battle of Hastings vs Normandy<br>William 打敗 Harold → 諾曼征服 |
| 1314 | Bannockburn vs Scotland<br>Robert the Bruce 打敗英格蘭 → 蘇格蘭保持獨立 |
| 1588 | Spanish Armada vs Spain<br>Elizabeth I 年代英格蘭打敗西班牙 |
| 1805 | Trafalgar vs France + Spain<br>Nelson 勝，但陣亡 |
| 1815 | Waterloo vs France<br>Wellington 打敗 Napoleon，英法最後一戰 |
| 1940 | Battle of Britain vs Germany<br>皇家空軍擊退德國空襲 → 阻止入侵 |
```

題目：Exam 1 Q12、2 Q11、4 Q1、4 Q18、6 Q12、6 Q19、7 Q6、9 Q2、9 Q21、11 Q7、12 Q4、14 Q6、16 Q13、16 Q21；Exam 17 Q13（記憶法前面有邱吉爾名句，保留喺 table 上面）。

### ⑧ 二戰（9 題）

```
記憶法：
| 年份 | 事件 |
| 1939 | 德國入侵 Poland<br>英法宣戰 |
| 1940 | Churchill 做首相<br>Dunkirk 大撤退、Battle of Britain |
| 1940–41 | the Blitz<br>德國轟炸英國城市 |
| 1944 | D-Day<br>諾曼第登陸 |
| 1945 | 戰爭結束<br>VE Day 8/5、VJ Day 15/8 |
```

題目：Exam 2 Q9、2 Q24、3 Q19、4 Q23、6 Q23、8 Q1、14 Q13、15 Q23、16 Q7。

### ⑨ 國王 vs 國會（8 題）

```
記憶法：
| 年份 | 事件 |
| 1628 | Petition of Right<br>國王要國會同意先可以加稅 |
| 1642–51 | Civil War<br>Charles I vs 國會 |
| 1649 | Charles I 被處決 → Commonwealth<br>Cromwell 做 Lord Protector，到 1658 |
| 1660 | Restoration<br>Charles II 做國王 |
| 1688 | Glorious Revolution<br>William of Orange 取代 James II → 君主立憲 |
```

題目：Exam 1 Q23、11 Q19、15 Q3、15 Q13、15 Q17、16 Q11；Exam 13 Q6（前綴「皇家橡樹」）、15 Q20（前綴克倫威爾一句），前綴保留喺 table 上面。

## 實作範圍

| 檔案 | 改動 |
|------|------|
| `js/components/tags.js` | `noteHtml()` 收集連續 `\|` 行 → `<div class="note-table-wrap"><table class="note-table">`（thead 第一行，tbody 其餘）；其他行照舊；格仔按 `<br>` 拆段（先拆後 `escapeHtml`，每段都 escape），有備注嘅格加 `class="multi"`、備注段 `<span class="note-cell-sub">` |
| `css/components/note.css` | `.note-table*`（Theme B，只用現有 token）、`th` / `td` `nowrap` + `vertical-align: top`、`td.multi { white-space: normal }`、`.note-cell-sub`（block、`--fs-xs`、`font-weight: 400`（第一欄粗體都唔跟）、`--text-muted`）；wrap `overflow-x: auto` 做後備 |
| `data/exams.js` | 上面 10 組 note（99 題）；有前綴句嘅題（E13 Q6、E15 Q20、E17 Q13 同 ⑩ 有原有 note 嘅題）保留前綴 |
| `tests/` | `noteHtml` table render：header / body、escape（`<script>` 等）、`<br>` 備注拆段、混合文字行；3 個畫面（Study 溫習卡、Practice 答題後、Results review）390px 唔爆、唔使 scroll |

唔受影響：`content-guard-test`（note 只比形狀）、`factMemoryText()`（Study 照刪「記憶法：」標題行）。

## 之後可以考慮（未決定）

- 用戶要逐組確認精簡咗嘅文字（轉 table 時刪咗部分中英對照、縮短句子）
- ⑩ 3 個題庫冇嘅地點（Lake District 寫 National Park、Ben Nevis 寫 Highlands、Giant's Causeway 寫 County Antrim）要唔要保留
- E4 Q21、E5 Q23（National Assembly for Wales）要唔要都用 ④
- Exam 9 Q20「patron flower of Ireland」字眼（用戶未決定）
- `APP_VERSION` bump（令已安裝 PWA 攞到新 note）
- 實作完之後 mockup 處理：跟 repo 慣例（v0.65 刪咗已確認嘅 mockup）

## Grill 決定（2026-10-10，用戶確認，覆蓋上面）

| # | 決定 |
|---|------|
| 1 | 照 spec 逐字用，但唔可以 information lost：原有 note 嘅事實 / 全名全部補返 |
| 2 | 中文譯名：④–⑨ 補落 `<br>` 備注；①③ 唔補（主文英文） |
| 3 | ⑩ 三個題庫冇嘅地點（National Park / Highlands / County Antrim）保留 |
| 4 | E4 Q21、E5 Q23（National Assembly for Wales）加入 ④ → ④ 9 題，總數 **101 題**；E5 Q23 原句做前綴 |
| 5 | E9 Q20 題目字眼唔改，加前綴「題目嘅 Ireland 即係 N. Ireland（Shamrock 係成個愛爾蘭島嘅象徵）」 |
| 6 | 標題保留主題名、刪多餘排序提示：⑦ `記憶法（英國重要戰役）：`、⑧ `記憶法（二戰）：`、⑨ `記憶法（國王 vs 國會）：`；其餘組 `記憶法：`（都鐸王朝唔郁） |
| 7 | `APP_VERSION` 1.0.6 → 1.0.7 |
| 8 | 同一個 PR 刪 `mockups/note-table.html`、`note-table-church.html`、`note-table-all.html`；更新 `HANDOFF.md` |

### 前綴句（寫喺「記憶法…：」上面一行）

- 保留原 note：E5 Q23、E13 Q6、E15 Q20、E17 Q13；⑩ 嘅 E9 Q4、E14 Q19、E5 Q3、E12 Q7、E4 Q9、E7 Q19、E16 Q2
- 新加：E9 Q20（見上面 #5）

### ①②③⑩：照上面原文（無改）

### ④ 地方議會（9 題：上面 7 題 + Exam 4 Q21、5 Q23）

```
記憶法：
| 地區 | 議會 / 地點 | 議員 |
| England | UK Parliament<br>Westminster | 650<br>全英國 MP |
| Scotland | Scottish Parliament<br>蘇格蘭議會<br>Edinburgh（愛丁堡） | 129 |
| Wales | Senedd<br>威爾斯議會，前稱 National Assembly for Wales<br>Cardiff（加的夫） | 60 |
| N. Ireland | Northern Ireland Assembly<br>北愛爾蘭議會<br>Belfast（貝爾法斯特） | 90 |
• England 冇自己嘅地方議會，由英國國會直接負責；
• Senedd 議員：考試答 60（2026 年選舉起增至 96）；
• Scotland / Wales / N. Ireland 三個議會用比例代表制（proportional representation）；
• 英國國會用領先者當選制（first past the post）
```

### ⑤ 發明家（6 題）

```
記憶法：
| 年份 | 人物 / 發明 |
| 17 世紀 | Isaac Newton<br>牛頓：萬有引力、運動定律 |
| 1876 | Alexander Graham Bell<br>貝爾：電話（蘇格蘭裔） |
| 1928 | Alexander Fleming<br>弗萊明：盤尼西林 penicillin（蘇格蘭人） |
| 1930s | Frank Whittle<br>惠特爾：噴射引擎 jet engine |
| 1953 | Francis Crick<br>克里克：DNA 結構（同 James Watson 一齊發現） |
| 1989 | Tim Berners-Lee<br>柏納斯-李：萬維網 World Wide Web |
```

### ⑥ 節日（11 題）

```
記憶法：
| 日期 | 節日 |
| 25/1 | Burns Night<br>彭斯之夜：紀念蘇格蘭詩人 Robert Burns |
| 31/10 | Halloween<br>萬聖節前夕 |
| 5/11 | Bonfire Night<br>篝火之夜：紀念 1605 年火藥陰謀（Gunpowder Plot）失敗 |
| 11/11 | Remembrance Day<br>國殤紀念日：戴紅罌粟花 |
| 26/12 | Boxing Day<br>節禮日：聖誕節翌日 |
| 31/12 | Hogmanay<br>霍格莫尼：蘇格蘭除夕 |
```

### ⑦ 英國重要戰役（15 題）

```
記憶法（英國重要戰役）：
| 年份 | 戰役 / 結果 |
| 9 世紀 | Alfred the Great vs Vikings<br>阿佛烈大帝統一盎格魯-撒克遜王國，打敗維京人 |
| 1066 | Battle of Hastings vs Normandy<br>黑斯廷斯戰役：William of Normandy（諾曼第公爵威廉）打敗 Harold → 英格蘭戰敗，諾曼征服 |
| 1314 | Battle of Bannockburn vs Scotland<br>班諾克本戰役：Robert the Bruce 打敗英格蘭 → 蘇格蘭保持獨立 |
| 1588 | Spanish Armada vs Spain<br>西班牙無敵艦隊：Elizabeth I 年代英格蘭打敗西班牙 |
| 1805 | Battle of Trafalgar vs France + Spain<br>特拉法加海戰：Admiral Nelson（納爾遜）打敗法西聯合艦隊，但陣亡 |
| 1815 | Battle of Waterloo vs France<br>滑鐵盧戰役：Duke of Wellington（威靈頓公爵）打敗 Napoleon，英法最後一戰 |
| 1940 | Battle of Britain vs Germany<br>不列顛戰役：皇家空軍擊退德國空襲 → 阻止德國入侵 |
```

### ⑧ 二戰（9 題）

```
記憶法（二戰）：
| 年份 | 事件 |
| 1939 | 德國入侵 Poland（波蘭）<br>英法宣戰 |
| 1940 | Winston Churchill（邱吉爾）做首相<br>Dunkirk（敦克爾克）大撤退、Battle of Britain（不列顛戰役） |
| 1940–41 | the Blitz（倫敦大轟炸）<br>德國轟炸英國城市 |
| 1944 | D-Day<br>諾曼第登陸 |
| 1945 | 戰爭結束<br>VE Day（歐洲勝利日）8/5、VJ Day（對日勝利日）15/8 |
```

### ⑨ 國王 vs 國會（8 題）

```
記憶法（國王 vs 國會）：
| 年份 | 事件 |
| 1628 | Petition of Right<br>《權利請願書》：國王要國會同意先可以加稅 |
| 1642–51 | Civil War<br>英格蘭內戰：Charles I（查理一世）vs 國會 |
| 1649 | Charles I 被處決 → Commonwealth<br>共和國：Oliver Cromwell（克倫威爾）做 Lord Protector（護國公），到 1658 年 |
| 1660 | Restoration<br>復辟：Charles II（查理二世）做國王 |
| 1688 | Glorious Revolution<br>光榮革命：William of Orange（奧蘭治的威廉）取代 James II（詹姆士二世）→ 君主立憲 |
```

### 題數

①10 + ②5 + ③11 + ④9 + ⑤6 + ⑥11 + ⑩17 + ⑦15 + ⑧9 + ⑨8 = **101 題**
