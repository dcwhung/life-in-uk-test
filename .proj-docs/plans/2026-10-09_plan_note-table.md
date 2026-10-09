# 記憶法 table display（未做，已確認設計）

- 日期：2026-10-09
- 狀態：**設計已確認，未開始實作**
- Mockup：`mockups/note-table.html`（Design Origin 用 `mockup:mockups/note-table.html`）

## 用戶已確認嘅決定

| 項目 | 決定 |
|------|------|
| 做法 | 方案 A：明確語法（note 入面連續以 `\|` 開頭嘅行 render 成 table，第一行係 header）；唔做自動偵測 `→` |
| 格仔內容 | 全部英文，國家同國花都唔要中文字（390px 一行放得晒，唔使 scroll） |
| 顏色 | **Theme B：Minimal 線條**（冇底色，header 深藍字 + 2px `--navy` 底線，行之間 1px `--divider`，最後一行冇線，第一欄 `--navy` 粗體），跟住所在框嘅背景 |
| Header | 國家 / 聖人 / 日子 / 國花（mockup 用呢個，用戶冇反對；實作前可再確認） |
| 第一批 | 英國 4 國記憶法（15 題，見下面） |

## 第一批 data（15 題 note 改成）

```
記憶法：
| 國家 | 聖人 | 日子 | 國花 |
| England | George | 23/4 | Tudor rose |
| Scotland | Andrew | 30/11 | Thistle |
| Wales | David | 1/3 | Daffodil |
| N. Ireland | Patrick | 17/3 | Shamrock |
```

題目：Exam 1 Q5、2 Q16、10 Q1、11 Q10（patron saint）；Exam 5 Q22、7 Q16、8 Q5、8 Q23、13 Q1、14 Q1（St * Day）；Exam 4 Q2、8 Q2、8 Q13、9 Q1、9 Q20（national flower）。Exam 5 Q14（X 形十字）唔改。

## 實作範圍

| 檔案 | 改動 |
|------|------|
| `js/components/tags.js` | `noteHtml()` 收集連續 `\|` 行 → `<div class="note-table-wrap"><table class="note-table">`（thead 第一行，tbody 其餘）；其他行照舊；所有格仔 `escapeHtml` |
| `css/components/note.css` | `.note-table*` 樣式（Theme B，只用現有 token），`white-space: nowrap`，wrap `overflow-x: auto` 做後備 |
| `data/exams.js` | 上面 15 題 note |
| `tests/` | `noteHtml` table render（header / body / escape / 混合文字行）；3 個畫面（Study 溫習卡、Practice 答題後、Results review）390px 唔爆 |

唔受影響：`content-guard-test`（note 只比形狀）、`factMemoryText()`（Study 照刪「記憶法：」標題行）。

## 之後可以考慮（未決定）

- 同樣格式嘅記憶法：發明家 / 科學家（6 題）、地方議會（7 題）、國教 / 教會（5 題：E3 Q2、E3 Q16、E5 Q7、E6 Q5、E10 Q3，用戶原本想要 國家 / 國教 / 國教教會 三欄）
- Exam 9 Q20「patron flower of Ireland」字眼（用戶未決定）
- `APP_VERSION` bump（令已安裝 PWA 攞到新 note）
