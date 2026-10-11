# Handoff — 記憶法 v2 套用（data + code + 測試）

**日期**：2026-10-11
**由**：記憶法 v2 逐組 review session（branch `claude/relaxed-hamilton-3x7vm6`）
**交俾**：下一個 session — 照規格改 `data/exams.js`、app code 同測試
**狀態**：review 完（61 個記憶法、375 題定稿），**未改 data / code / 測試**

---

## 1. 要做乜（一句）

將 `.proj-docs/plans/2026-10-11_memo-final-spec.json` 入面 375 題嘅最終 note 寫入 `data/exams.js`，加兩個 note 排版 code 改動（續行、table 格入面 bullet），再改測試，令 run-all 綠（已知 container font 問題除外）。

## 2. 單一真相來源（唔好自己再諗內容）

| 檔案 | 用途 |
|---|---|
| `.proj-docs/plans/2026-10-11_memo-final-spec.json` | **主規格**。`memos`：61 個記憶法（id、名、題目、最終文字、來源）；`notes`：每題最終 note（已包括要保留嘅前綴）；`untouched`：33 題唔郁；`keptPrefixes`：保留咗前綴嘅 20 題 |
| `.proj-docs/plans/2026-10-11_memo-final-spec.gen.js` | 生成上面 JSON 嘅 script（`node .proj-docs/plans/2026-10-11_memo-final-spec.gen.js <out.json>`，喺 repo root 跑）；由 `mockups/memo-split-preview.html` 已確認版本 + `data/exams.js` 抽文字。**data 改咗之後唔好再跑**（佢讀現有 note 抽前綴同舊 table 行） |
| `.proj-docs/plans/2026-10-10_memo-split-decisions.md` | 逐組決定紀錄（#1–#38），有疑問先睇呢度 |
| `mockups/memo-split-preview.html` | 用戶睇過嘅 preview（app CSS + noteHtml copy，含兩個 PROPOSED code 改動）；artifact https://claude.ai/artifact/8bj1pyhqnJBDEDK8nFVGi7 |
| `mockups/memo-v2-review.html` + `memo-v2-proposal.js` + `memo-final-spec.js` | Memory Note Review（「⓪ 最終定稿」tab）；artifact https://claude.ai/artifact/TM7i9i7d5ZTsSR6EzzXmUL |
| `mockups/similar-map-review.html` | Similar Question Map（按 STUDY fact 歸類 + 定稿記憶法主題 + 套用後 note）；artifact https://claude.ai/artifact/FuHZQZuDfW9PnPBS1oiQLe |

## 3. 開工前一定要問用戶（未決定）

| # | 問題 | 建議 |
|---|---|---|
| Q1 | **F55 衝突**：同一個 STUDY fact（8.15、14.23、16.18 — Wilberforce / Slave Trade Act）而家分咗去兩個記憶法：8.15 → N8b 19 世紀人物，14.23、16.18 → N8a 19 世紀事件。違反「相似題統一備註」規則 | 8.15 搬去 N8a（N8a 1807 行已經寫「由 MP William Wilberforce 推動」）；N8b 剩 Sake Dean Mahomet + Nightingale。或者用戶接受分開 |
| Q2 | `APP_VERSION` 升唔升、升幾多 | 只改內容 + note 排版 → patch `1.0.9`（`js/core/config.js`，SW cache 名跟住變） |
| Q3 | 4 個舊記憶法（Magna Carta、Thatcher、陪審員、國會選舉，18 題）仲係舊格式（每行「；」結尾、標題有英文）要唔要跟新格式執 | 問用戶；呢次唔郁就喺 HANDOFF 記低 |

## 4. 唔喺今次範圍（未 review，唔好做）

- E3 首都 / 國花加語言（6.20、13.12）
- E5 名勝加國家公園定義（6.3）
- E6 地方議會加權力下放同地區議會（10.10、12.12、9.14、12.18、12.5）
- E7 和平紀念碑加節日記憶法（1.7、11.8）
- F9 7.8 Guy Fawkes 補齊節日記憶法
- S1–S6 STUDY fact 合併 / 拆分（會郁 `data/study.js` `src`，content-guard 會擋，要另外傾）

以上 11 題 + 18 題舊記憶法 + 4 題其他 = `untouched` 33 題，note 保持原樣。

## 5. Code 改動（TDD：先寫 failing test）

### 5.1 續行（5B 都鐸王朝要用）

`js/components/tags.js` `noteLineHtml`：8 個或以上前置空格、而且冇 `•` / `◦` / `→` 符號嘅行 = 續行，class `cont`，對齊上一行「→」後面嘅文字。preview 版本：

```js
// 8+ leading spaces and no marker = continuation line, aligned with the text after a sub item's "→"
const cls = (/^\s{8,}/.test(line) && !mark) ? ' cont' : /^\s{2,}/.test(line) ? ' sub' : mark ? ' bullet' : '';
```

`css/components/note.css`（app 嘅 class 都係 `.rv-note-line`，同 `.sub` / `.bullet` 放埋一齊）：

```css
.rv-note-line.cont { padding-left: calc(2 * var(--note-indent)); text-indent: 0; }
```

驗收：5B 嘅「York（約克）vs Lancaster（蘭開斯特）」、兩位妻子行喺 390px 對齊「→」後面文字（preview 量過 77px = 77px）。

### 5.2 table 格入面 bullet 縮入（N20–N24 用）

`noteCellHtml`：`<br>` 之後以「• 」開頭嘅細字加 class `bullet`：

```js
const subs = remarks.map(remark => `<span class="note-cell-sub${/^•\s/.test(remark) ? ' bullet' : ''}">${escapeHtml(remark)}</span>`).join('');
```

```css
.note-cell-sub.bullet { padding-left: 1.8em; text-indent: -0.9em; }
```

效果：bullet 比中文名嗰行縮入大約一個字位；斷行時第二行對齊文字（懸掛縮排）。

### 5.3 Design Origin（PR 一定要寫）

`Design Origin: mockup: mockups/memo-split-preview.html`（用戶 2026-10-10 / 11 確認 5B 方案 A 同 N20 bullet 縮入）

## 6. Data 改動

1. 寫一個一次性 script（放 scratchpad，唔好入 repo）：讀 spec JSON `notes`，逐題改 `data/exams.js` 嘅 `note` 值，**只改 `note`**；`untouched` 唔郁。
2. 寫返去 `data/exams.js` 要保持原本格式（一題一行 object literal、key 次序 `ch,d,q,o,oy,a,yue,note`、字串用 `"`、換行寫 `\n`）。建議用 regex 逐題替換 `note:"…"`，唔好 `JSON.stringify` 成個 EXAMS 重寫。
3. 自查：
   - `node -e` 讀返新 EXAMS，375 題 `note === spec.notes[k]`；其餘 33 題同改之前一樣。
   - `tests/content-guard-test.js` pass（只准 note 變；有內容嘅 note 唔可以變空 —— 冇題目會變空）。
   - **唔好**重生成 `tests/fixtures/content-baseline.json`。
4. yue / oy 唔使改：X7（詹姆斯二世）已經喺 ⑨ 新 table 入面；X8 用方案 A（yue 照用「英格蘭教會」）。

## 7. 測試要改 / 加

| 測試 | 要做 |
|---|---|
| `tests/note-table-test.js` | `NOTE_TABLES` / `GROUP_QUESTIONS` / `GROUP_SIZES` / `TOTAL_TABLE_QUESTIONS`（而家 110）/ `PREFIXES` 全部要按新 table 重寫（table 由 10 組變成大約 45 組）；保留 390px 唔使左右 scroll 檢查（Practice 答案框、Results review、Study 💡）。S-140 規則（每行格數同表頭一樣、`<br>` 段唔可以空）新 table 全部過到（N16b 左欄空格係一格，OK） |
| `tests/note-text-test.js` | Magna Carta、國會選舉、Thatcher、陪審員 4 段文字冇變，應該照 pass；如果 Q3 決定執格式就要改 |
| 新測試 | `.cont` 續行：class 同對齊位置；`.note-cell-sub.bullet`：class、縮入、懸掛縮排 |
| `study-test` B3 等 | Study 卡顯示「記憶法」段：N25 三題冇「記憶法」標題，Study 卡唔會顯示（用戶已接受） |

已知（唔係今次搞壞）：run-all 有 7 個 layout 測試（factsession W-012、examresult、lang-switch、plan-ui、plan-schedule、plan-day、plan-done-green）喺未改嘅 main 都 fail（container 字體）；quicknav 兩邊都 flaky。要喺 report 寫明。

環境：`NODE_PATH=<scratchpad>/node_modules`（playwright-core 1.56.1）、`CHROMIUM_PATH=/opt/pw-browsers/chromium`。

## 8. 格式規則（套用時要守）

- 廣東話口語（喺、嘅）；專有名詞「English（中文）」；國名 / 地名照已確認文字（有啲用英文 England / Scotland，跟 spec，唔好自己改）
- table：第一行表頭；`<br>` 後係細字；只有有 `<br>` 嘅格先會斷行，其他格 nowrap，要過 390px
- 列點「•」，子項「    → 」（4 空格），續行 8 空格冇符號，「※」行 4 空格
- 新格式列點唔使句尾「；」/「。」

## 9. 完成之後

1. Reviewer → QA（ai-dev-team 流程，Auto-Handoff）
2. 用戶確認之後刪：`mockups/memo-split-preview.html`、`mockups/memo-v2-review.html`、`mockups/memo-v2-proposal.js`、`mockups/memo-final-spec.js`、`mockups/similar-map-review.html`
3. 更新 `HANDOFF.md`（v1.0.9 改動、note 格式新規則 `.cont` / `.bullet`、測試數）同 `.proj-docs/index.md`
4. 問用戶開唔開 PR 入 `main`（repo 慣例：PR + merge commit）
