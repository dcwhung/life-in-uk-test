# Handoff：記憶法 table display 開發

**日期**：2026-10-09
**狀態**：設計同內容已確認（用戶 2026-10-09），待開發
**Spec（Single Source of Truth）**：`.proj-docs/plans/2026-10-09_plan_note-table.md`（決定、10 組 data、題號、實作範圍）
**Design Origin**：`mockup:mockups/note-table.html`（Theme B 顏色）+ `mockup:mockups/note-table-church.html`（V4 格內備注）+ `mockup:mockups/note-table-all.html`（10 組內容，390px）
**Base**：`main` @ v1.0.6（`APP_VERSION = '1.0.6'`）+ 本 session PR（國教 note `a09aedb` + mockup / plan 文件）

> 下個 session：讀呢份 handoff + spec，用 browser 開 `mockups/note-table-all.html`（佢 link 咗 app 嘅 `css/`，同正式版一樣），然後 `/feature`（TDD）。開工前先同用戶確認 §5「未決定」嗰幾項。

---

## 1. 功能一句講

記憶法 note 入面連續以 `|` 開頭嘅行 render 成 table（第一行 header），格入面 `<br>` 分開主文同細字備注；Study 溫習卡「💡 記憶法」、Practice 答題後、Results review 三個畫面一齊生效；第一批將 10 組（99 題）記憶法改寫成 table。

---

## 2. 用戶已確認（必須跟）

| 項目 | 規格 |
|---|---|
| 語法 | 方案 A：明確 `\|` 語法；**唔做**自動偵測 `→` |
| 格仔內容 | 主文英文（國家、國花唔要中文）；中文放 `<br>` 後面做備注 |
| 顏色 | Theme B Minimal 線條：冇底色、header `--navy` 字 + 2px `--navy` 底線、行之間 1px `--divider`、最後一行冇線、第一欄 `--navy` 粗體 |
| 格內備注（V4） | `<br>` 前 = 主文（正常字），之後每段 = 備注（`--fs-xs`、`--text-muted`、`font-weight: 400`、自己一行）；只有用咗 `<br>` 嘅格（`td.multi`）可以轉行，其他格 `nowrap` |
| 混合行 | table 行同普通行（標題、• 列點）可以喺同一個 note 混合；非 `\|` 行照舊用 `noteLineHtml()` |
| 闊度 | 390px 三個畫面都唔使左右 scroll（mockup 已驗證 10 組）；`.note-table-wrap { overflow-x: auto }` 只係後備 |
| 第一批 | 10 組全部：① 聖人 / 日子、② 國教 / 教會、③ 首都 / 國花、④ 地方議會、⑤ 發明家、⑥ 節日、⑦ 英國重要戰役、⑧ 二戰、⑨ 國王 vs 國會、⑩ 名勝 / 地方（新組） |
| 唔做 | 都鐸王朝、三層屬地、Magna Carta、選舉、戴卓爾夫人、陪審員：保持文字 |

每組嘅 table 內容同題號：見 spec「第一批 data」（逐字照抄落 `data/exams.js`）。

---

## 3. 實作指引

### 3.1 檔案

| 檔案 | 改動 |
|---|---|
| `js/components/tags.js` | `noteHtml(note)`：逐行掃，連續 `\|` 行收集成一個 table（`<div class="note-table-wrap"><table class="note-table" lang="zh-HK">`，thead = 第一行，tbody = 其餘）；格按 `<br>` 拆段，**先拆再逐段 `escapeHtml`**；有備注嘅格 `<td class="multi">主文<span class="note-cell-sub">備注</span></td>`。mockup 入面嘅 `tableHtml()` / `cellHtml()` 可以參考（mockup 版冇用 `escapeHtml`，正式版要用 app 嘅）|
| `css/components/note.css` | `.note-table-wrap`、`.note-table`、`th` / `td`、`td.multi`、`.note-cell-sub`：直接由 `mockups/note-table-all.html` 頂部「PROPOSED css/components/note.css additions」block 搬（只用現有 token）|
| `data/exams.js` | 10 組 note（99 題）；有前綴句嘅題保留前綴（見 3.2）|
| `tests/` | 見 §4 |

### 3.2 Data 改寫規則

- Note 格式：`記憶法：\n| header |\n| row |…`（`\n` 分行，同而家一樣寫喺 JS string）
- 前綴句保留喺「記憶法…」上面：E13 Q6（皇家橡樹）、E15 Q20（克倫威爾）、E17 Q13（邱吉爾名句）
- ⑩ 名勝 17 題本身有一句 note（例如「英國最高山，海拔1,345米」）：原句保留做第一行，然後「記憶法：」+ table
- 原本有「記憶法（xxx）：」標題嘅組（例如「記憶法（二戰，按年份）：」），標題寫法照舊保留抑或統一做「記憶法：」→ 未定，問用戶（§5）
- 同一組所有題 note 要逐字一樣（之前統一記憶法嘅慣例）
- 改完用 script 驗證：每組題數、每題 note 同組內一致（參考本 session 用嘅 `EXAMS` 掃描方法：`new Function(src + ';return EXAMS;')()`）

### 3.3 唔受影響 / 要留意

- `content-guard-test`：note 只比形狀（有內容唔可以清空），改 note 文字 OK
- `factMemoryText()`（`js/domain/similar.js`）：照舊由「記憶法」之後攞，table 行會傳落 `noteHtml()`，Study 卡自動有 table
- **一定會 fail、要更新嘅測試**：`tests/study-test.js` B3（約 175 行）將 `.rv-note-line` / `.rv-note-gap` 文字同 note 逐行比較；table 行唔係 `.rv-note-line` → 要改成同時處理 table（例如 table 行比 `tr` 嘅 cell 文字）
- 可能受影響：`tests/examresult-test.js` 87 行（揀第一條有 `•` / `→` 行嘅 note，④ 有 `•` 列點）；`tests/lang-switch-test.js` 275 行（`.rv-note-line` 要 `lang="zh-HK"`，table 都應該有 `lang`）
- 格式跟 `tags.js` 現有寫法（2 space indent、single quote）；函數 ≤ 30 行，建議拆 `noteTableHtml()` / `noteCellHtml()`

---

## 4. 測試要求

| 測試 | 內容 |
|---|---|
| 單元（`noteHtml`） | header / body 行數；`<br>` 拆段 → `td.multi` + `.note-cell-sub`；escape（格入面 `<script>`、`&` 唔會生效）；table 前後混合普通行同 • 列點；冇 `\|` 嘅 note 輸出同而家一模一樣 |
| 畫面 | 390px：Study 溫習卡、Practice 答題後、Results review 三個畫面，10 組 table 都唔超出容器（`scrollWidth <= clientWidth`）|
| Data | 10 組題數同 spec 一致（共 99 題）；同組 note 逐字一樣 |
| Regression | `tests/run-all.sh` 全部 pass（要 `playwright-core` + Chromium：`CHROMIUM_PATH=/opt/pw-browsers/chromium`）|

---

## 5. 未決定（開工前問用戶）

1. 逐組確認精簡咗嘅文字（轉 table 時刪咗部分中英對照、縮短句子）
2. ⑩ 3 個題庫冇嘅地點：Lake District 寫「National Park」、Ben Nevis 寫「Highlands」、Giant's Causeway 寫「County Antrim」，保留定改
3. E4 Q21、E5 Q23（National Assembly for Wales）要唔要都用 ④
4. Exam 9 Q20「patron flower of Ireland」字眼（題目寫 Ireland，記憶法寫 N. Ireland）
5. 原有「記憶法（xxx）：」標題保留定統一「記憶法：」
6. `APP_VERSION` bump（1.0.6 → 1.0.7？），令已安裝 PWA 攞到新 note
7. 實作完 mockup 處理（repo 慣例：v0.65 確認後刪咗 mockup）

---

## 6. 本 session 已完成（背景）

| Commit / PR | 內容 |
|---|---|
| dcwhung/life-in-uk-test#72（merged） | 聖人 / 日子 / 國花 15 題 note 統一做文字記憶法 |
| `a09aedb` | 國教 / 教會 5 題 note 統一做文字記憶法（E3 Q2、E3 Q16、E5 Q7、E6 Q5、E10 Q3）|
| mockup × 3 + plan + 呢份 handoff | Table 設計（Theme B、V4）、10 組內容 |
