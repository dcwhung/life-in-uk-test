# Handoff：記憶法跟進套用（data + Study fact 合併 + 測試）

**日期**：2026-10-12
**由**：記憶法跟進 review session（branch `claude/relaxed-hamilton-3x7vm6`，已 merge main v1.1.5）
**交俾**：下一個 session，負責改 `data/exams.js`、`data/study.js`、localStorage migration 同測試
**狀態**：review 完，全部已經同用戶確認；**未改 data / code / 測試**

---

## 1. 要做乜（一句）

將 `.proj-docs/plans/2026-10-12_memo-followup-spec.json` 嘅 67 題 note 寫入 `data/exams.js`；將 Study fact #126 併入 #125（連 migration）；改測試，令 run-all 綠。

## 2. 真相來源

| 檔案 | 用途 |
|---|---|
| `.proj-docs/plans/2026-10-12_memo-followup-spec.json` | **主規格**。`notes`：67 題最終 note（已包括保留嘅前綴）；`memos`：8 個改動咗嘅記憶法（題目 + 最終文字）；`study`：#125 合併後嘅完整 object 同 #126 合併前嘅原樣 |
| `.proj-docs/plans/2026-10-12_memo-followup-spec.gen.js` | 生成上面 JSON 嘅 script，由 main v1.1.5 data 生成。**data 改完之後唔好再跑**，因為佢讀現有 note 嚟搵記憶法成員同前綴 |
| `.proj-docs/plans/2026-10-10_memo-split-decisions.md` | 決定紀錄，「跟進」一節 #39–#45a |
| `mockups/memo-split-preview.html` | 用戶睇過嘅 preview；artifact https://claude.ai/artifact/8bj1pyhqnJBDEDK8nFVGi7 |

## 3. 改動清單（全部已確認）

| # | 項目 | 題目 | 改動 |
|---|---|---|---|
| E6 | 4A 四地議會 | +10.10、12.12（4A 變 10 題） | 記憶法尾加「• Devolution（權力下放）」+ 兩個「    → 」子項；10.10、12.12 舊單句備註由 4A 取代 |
| E3 | ③ 首都 / 國花 | +6.20、13.12（變 13 題） | table 加「語言」欄（English 英文 / Gaelic 蓋爾語 / Welsh 威爾斯語 / Irish Gaelic 愛爾蘭語）+「• Gaelic 係凱爾特語，Scotland 同 Ireland 部分地區講」；9.0、9.19 前綴保留。用戶接受 4 欄有啲格斷行（有 `<br>` 嘅格可以斷，冇 `<br>` 嘅格要 nowrap 又唔出界） |
| E5 | 10A 國家公園同山 | +6.3（變 8 題） | 尾加「• National Parks（國家公園）」+ 兩個子項；4.8 前綴保留 |
| E7 | ⑥ 全年節日 | +1.7、11.8（變 17 題） | 11/11 格尾加兩行「喺 London Whitehall（白廳）嘅」「Cenotaph（戰爭紀念碑）獻花圈」；1.7、11.8 舊前綴（連 Remembrance Sunday 註腳）刪 |
| F9 | 7.8 | 單題 | 冇記憶法；新單句備註 + 兩個「    → 」子項（Bonfire Night） |
| 舊 4 組 | Magna Carta 8、國會選舉 4、Thatcher 3、陪審員 3 | 18 題 | 內容唔改；刪句尾「；」/「。」；標題改「Magna Carta 大憲章」「Margaret Thatcher 戴卓爾夫人」「陪審員」 |
| S3 | Study fact | 11.2、5.1、3.22、9.2、4.4 | **#126 併入 #125**（見第 5 節） |

**唔做**（用戶確認）：S1（#33 併 #113）、S2、S4（因 S3 取消）、S5、S6；N24 記憶法紙幣行唔改。

## 4. `data/exams.js`（只改 `note`）

1. 用一次性 script（放 scratchpad，唔入 repo）讀 spec `notes`，逐題替換 `note:"…"`，保持一題一行嘅原格式，唔好成個 EXAMS `JSON.stringify` 重寫。
2. 自查：67 題 `note === spec.notes[k]`；其餘 341 題同改之前一模一樣。
3. `content-guard-test` 會檢查 note 嘅形狀，佢應該照 pass。

## 5. `data/study.js`：#126 併入 #125

| 欄位 | #125 合併後 |
|---|---|
| `id` / `ch` | 125 / 4（唔變） |
| `d` | 4 |
| `src` | `["11.2","5.1","3.22","9.2","4.4"]` |
| `en` | The UK currency is the pound sterling (£). Coins: 1p, 2p, 5p, 10p, 20p, 50p, £1 and £2. Notes: £5, £10, £20 and £50. Scotland and Northern Ireland have their own banknotes, which are valid everywhere in the UK. |
| `yue` | 英國貨幣係英鎊（pound sterling, £）。硬幣有 1p、2p、5p、10p、20p、50p、£1、£2。紙幣有 £5、£10、£20、£50。蘇格蘭同北愛爾蘭有自己嘅紙幣，全英國通用。 |

刪咗嘅內容：「冇 25p」（列表冇就知）、「蘇格蘭有啲銀行發行 £100」（只留考試答案），亦唔再提最高面值。

- 刪走 #126 object。其他 fact 嘅 `id` **唔好重新編號**，因為 id 係 localStorage 同溫習計劃嘅 key。Study 卡顯示嘅「#n」由 `chapterFactNumber(f.id)` 計，Ch4 喺 #126 之後嘅卡顯示號碼會自動減 1，呢個係預期效果。
- STUDY 由 236 條變 235 條。
- **content baseline 要重生成**：`node tests/tools/make-content-baseline.js`，而且要同 study 改動放喺**同一個 commit**。呢個係刻意改 data 結構（`src` / `en` / `d`），符合 tool 檔頭嘅規則。commit message 要寫明原因。

### 5.1 localStorage migration（要先寫 failing test）

fact id 有用嘅地方：
- `STUDY_LS.mastered`（`lifeuk.studyMastered`）
- `STUDY_LS.bookmarks`（`lifeuk.studyBookmarks`）：`{ [factId]: true }`
- 溫習計劃：`PLAN_LEARN_ORDER` 由 STUDY 即時計，唔使 migrate；但係 `STUDY_PLAN_LS` / `STUDY_PLAN_PROGRESS_LS` 存咗嘅日程或者已完成 fact id 可能有 126，要 grep `js/domain/plan*.js` 確認格式
- `fNN` session id（`isFactExam('f126')`），只喺 session 入面，唔使 migrate

規則：舊資料有 126，就當 125 都有（OR），然後刪走 126。做一次就要寫 marker，跟 `utils.js` 現有 `ensureLegacyMigrated` / `MERGE_LS` 嘅做法；寫之前要先睇清楚現有機制先揀放邊度。

### 5.2 Design Origin

`Design Origin: none-required`（只係 data / 內容改動，冇新 className 或者 layout）

## 6. 測試

| 測試 | 要做 |
|---|---|
| `tests/fixtures/memo-notes.json` | 跟 spec 更新：4A、③、10A、⑥ 嘅題目同文字；舊 4 組如果喺 fixture 都要改（`prefixes` 唔變） |
| `tests/note-table-test.js` | 題目數 / table 數跟住變（③ 13、4A 10、10A 8、⑥ 17）；390px 同 320px 唔使左右 scroll 嘅檢查要過，③ 4 欄係最迫嗰個 |
| `tests/note-text-test.js` | 4 組舊文字改做新文字（spec `memos` 嘅 MagnaCarta / Election / Thatcher / Juror） |
| `tests/content-guard-test.js` | baseline 重生成之後要 pass |
| Study / plan 相關 | grep `236`、`#126`、`f126`、fact 數目，例如 `study-test`、`factsession-test`、`plan-*`、`dup-test`，逐個跟住改 |
| 新測試 | migration：舊 `studyMastered` / `studyBookmarks` 有 126 → 轉做 125，而且只做一次；如果有用到，溫習計劃都要測 |

已知 run-all 喺 container 有 layout 測試因為字體 fail（HANDOFF 有記錄）；quicknav 有時 flaky。

## 7. 版本同完成之後

1. `APP_VERSION`：建議 minor（例如 `1.2.0`），因為有 localStorage migration；如果 main 嗰陣已經升咗版本，就喺最新版本上面再升。開工前先問用戶。
2. 走 Reviewer → QA 流程。
3. 更新 `HANDOFF.md`：記憶法數目、E3–E7 / F9 / 舊 4 組、fact 235、migration；同時更新 `.proj-docs/index.md`。
4. 用戶確認之後，刪除 `mockups/memo-split-preview.html`、`mockups/memo-v2-review.html`、`mockups/memo-v2-proposal.js`、`mockups/memo-final-spec.js`、`mockups/similar-map-review.html`（喺 plan branch）。
5. 問用戶要唔要開 PR 入 `main`。
