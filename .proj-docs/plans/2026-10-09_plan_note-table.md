# 記憶法 table display（未做，已確認設計）

- 日期：2026-10-09
- 狀態：**設計已確認，未開始實作**
- Mockup：`mockups/note-table.html`（顏色，Theme B）、`mockups/note-table-church.html`（格內備注，V4）
- Design Origin：`mockup:mockups/note-table.html` + `mockup:mockups/note-table-church.html`

## 用戶已確認嘅決定

| 項目 | 決定 |
|------|------|
| 做法 | 方案 A：明確語法（note 入面連續以 `\|` 開頭嘅行 render 成 table，第一行係 header）；唔做自動偵測 `→` |
| 格仔內容 | 主文全部英文，國家同國花都唔要中文字（390px 一行放得晒，唔使 scroll） |
| 顏色 | **Theme B：Minimal 線條**（冇底色，header 深藍字 + 2px `--navy` 底線，行之間 1px `--divider`，最後一行冇線，第一欄 `--navy` 粗體），跟住所在框嘅背景 |
| 格內備注 | **V4**：格入面用 `<br>` 分開主文同備注；第一段 = 主文（正常字），之後每段 = 備注（`--fs-xs`、`--text-muted`，自己一行）；只有用咗 `<br>` 嘅格可以轉行，其他格 `nowrap` |
| 混合行 | 同一個 note 入面 table 行同普通文字行（標題、• 列點）可以混合，非 `\|` 行照舊用 `noteLineHtml()` |
| 第一批 | 英國 4 國聖人 / 日子（10 題）+ 國教 / 教會（5 題），見下面 |
| 國花 | 由聖人組搬去首都組（用戶 2026-10-09 決定）：首都 / 國花合併成一個 table，見「候選」③ |

## 第一批 data

### A. 聖人 / 日子（10 題）

Header：國家 / 聖人 / 日子

```
記憶法：
| 國家 | 聖人 | 日子 |
| England | George | 23/4 |
| Scotland | Andrew | 30/11 |
| Wales | David | 1/3 |
| N. Ireland | Patrick | 17/3 |
```

題目：Exam 1 Q5、2 Q16、10 Q1、11 Q10（patron saint）；Exam 5 Q22、7 Q16、8 Q5、8 Q23、13 Q1、14 Q1（St * Day）。Exam 5 Q14（X 形十字）唔改。國花 5 題（Exam 4 Q2、8 Q2、8 Q13、9 Q1、9 Q20）搬去首都 / 國花組。

### B. 國教 / 教會（5 題，V4）

Header：國家 / 國教 / 教會（用戶原本寫「國教教會」，因為 Scotland 冇國教但有 Church of Scotland，mockup 改用「教會」）

```
記憶法：
| 國家 | 國教 | 教會 |
| England | ✓ | Church of England<br>君主係最高領袖，坎特伯雷大主教係精神領袖 |
| Scotland | ✗ | Church of Scotland<br>Presbyterian（長老會），國家教會，唔係國教 |
| Wales | ✗ | ✗ |
| N. Ireland | ✗ | ✗ |
```

題目：Exam 3 Q2、Exam 3 Q16、Exam 5 Q7、Exam 6 Q5、Exam 10 Q3（而家 note 係 `a09aedb` 嘅箭咀文字版，做 table 時換成上面）。

## 實作範圍

| 檔案 | 改動 |
|------|------|
| `js/components/tags.js` | `noteHtml()` 收集連續 `\|` 行 → `<div class="note-table-wrap"><table class="note-table">`（thead 第一行，tbody 其餘）；其他行照舊；格仔按 `<br>` 拆段（先拆後 `escapeHtml`，每段都 escape），有備注嘅格加 `class="multi"`、備注段 `<span class="note-cell-sub">` |
| `css/components/note.css` | `.note-table*`（Theme B，只用現有 token）、`th` / `td` `nowrap` + `vertical-align: top`、`td.multi { white-space: normal }`、`.note-cell-sub`（block、`--fs-xs`、`--text-muted`）；wrap `overflow-x: auto` 做後備 |
| `data/exams.js` | 上面 A（10 題）+ B（5 題）note |
| `tests/` | `noteHtml` table render：header / body、escape（`<script>` 等）、`<br>` 備注拆段、混合文字行；3 個畫面（Study 溫習卡、Practice 答題後、Results review）390px 唔爆、唔使 scroll |

唔受影響：`content-guard-test`（note 只比形狀）、`factMemoryText()`（Study 照刪「記憶法：」標題行）。

## 之後可以考慮（未決定）

- 其他候選（preview：`mockups/note-table-all.html`，用戶未揀）：
  - ③ 首都 / 國花（11 題 = 首都 6 + 國花 5）：`| 國家 | 首都 | 國花 |`，England London Tudor rose / Scotland Edinburgh Thistle / Wales Cardiff Daffodil / N. Ireland Belfast Shamrock
  - ④ 地方議會（7），用戶 2026-10-09 定咗內容（加 England 行）：
    ```
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
  - ⑩ 名勝 / 地方（新組，17 題而家冇記憶法），格式 `| 國家 | 地點 | 名勝 |`（用戶定）：E9 Q4、E13 Q2（Lake District）、E14 Q19（Stonehenge）、E4 Q19、E5 Q3（Eden Project）、E11 Q22、E13 Q20（Glastonbury）、E12 Q7（Tate）、E4 Q9（Ben Nevis）、E10 Q2（Loch Lomond）、E11 Q20（Edinburgh Castle）、E8 Q8（National Galleries）、E3 Q13、E4 Q15、E7 Q11（Snowdonia / Snowdon）、E7 Q19、E16 Q2（Giant's Causeway）；E6 Q4（National Parks 統稱）同倫敦名勝唔放入。內容見 mockup
  - ⑤ 發明家（6）、⑥ 節日（11）；時間線 ⑦ 戰役（15）、⑧ 二戰（9）、⑨ 國王 vs 國會（8）
  - 唔建議：都鐸王朝、三層屬地、Magna Carta、選舉、戴卓爾夫人、陪審員（保持文字）
- Exam 9 Q20「patron flower of Ireland」字眼（用戶未決定）
- `APP_VERSION` bump（令已安裝 PWA 攞到新 note）
- 實作完之後 mockup 處理：跟 repo 慣例（v0.65 刪咗已確認嘅 mockup）
