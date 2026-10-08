# Batch Review — 2026-10-07 — v0.68 batch 3（batch 1 / batch 2 review 跟進）

- **日期**：2026-10-07
- **審閱者**：Code Reviewer（獨立 subagent）
- **Branch**：`claude/quirky-keller-40h0qp`。審閱目標 HEAD `6078999`。審閱期間 branch 前進到 `9d6753b`（batch 4 Home UI review 文件），唔屬今批。
- **範圍**：
  - Section A：merge `6078999`（`fix/tests/W-017_sw-race-and-qa-oracle`，10 個 commit `8e92c88`…`d42ec06`）
  - Section B：merge `94d8eb6`（`fix/study/W-016_fact-number-followups`，5 個 commit）同 `534f255`（`fix/study/W-016_quiz-label-case`，2 個 commit）
  - 唔包括：merge `9698ea8`（Home UI lane），另一位 reviewer 負責（見 `2026-10-07_review_v068-batch4-home-ui.md`）
- **總評**：兩條 merge 都按上一輪 review 嘅建議修好。冇 🔴，冇 🟡，有 4 個 🟢（S-074…S-077）。W-017 喺 10 次連續執行入面 10/10 pass。拎走修正之後，同一部機 10 次入面有 1 次 fail，即係個 race 真實存在，修正亦都有效。Batch 2 嘅改動冇 XSS，舊 shell 升級途中亦冇 ReferenceError。HEAD 上面 v065 有 5 個 fail、v066 有 1 個 fail，**全部嚟自 Home UI lane 改咗文案**，唔係今批造成。我喺唔包 Home UI 嘅 `6078999^2` 重跑過，v065 同 v066 都係 0 fail（見 Hard Gates）。

> 注意 diff 範圍：brief 寫 `git diff 6078999^1 6078999^2`。因為 `^2` 嘅 base 係 `c304008`，早過 `^1` 嘅 Home UI commit，所以呢個 two-dot diff 會將 Home UI 嘅改動倒轉顯示（例如刪截圖、改 `home.css`）。今批真正嘅改動要用 `git diff 6078999^1...6078999^2`（three-dot，9 個檔案），亦等同 `git diff 6078999^1 6078999`。我係用 three-dot diff 審閱。

## 整體 verdict

| Section | 內容 | Score | Status | 新 item |
|---|---|---|---|---|
| A | Batch 1 跟進：W-017、W-018、S-064…S-069、v066 / v063 / v065 fact label refresh | 97 | ✅ pass | S-074、S-075、S-076 |
| B | Batch 2 跟進：W-016、S-070…S-073、quiz header 大細楷 | 99 | ✅ pass | S-077 |

**整體 Status：✅ pass**（每個 section 都 ≥ 90，冇 Critical，hard gates 全部 pass）

## ID 分配

掃描過 `.proj-docs/reviews/`：C 最高係 `C-001`，W 最高係 `W-018`（另外 batch 4 已經用咗 `W-022`），S 最高係 `S-073`（另外 batch 4 用咗 `S-080`…`S-084`）。按 brief，今次 S 由 `S-074` 開始，W 由 `W-019` 開始。新增：`S-074`…`S-077`。冇新 C 同 W。

## Hard Gates

| Gate | 結果 | 證據 |
|---|---|---|
| Lint | n/a | Repo 冇設定 lint（同 batch 1 / 2 一樣） |
| Type check | n/a | 純 JS，冇 tsc |
| Tests | ✅ pass | 喺獨立 worktree `6078999` 跑 `NODE_PATH=/opt/node-tools/node_modules ./tests/run-all.sh`：**31 / 31 PASS**，exit 0 |
| sw-test × 10（W-017） | ✅ pass | `6078999` 連續跑 10 次 `node tests/sw-test.js`：**10 / 10 `SW PASS`** |
| sw-test Red（W-017 拎走 `utimesSync`） | 預期會 fail | 同一部機用臨時副本跑 10 次：**9 pass、1 fail**（`FAIL: version bump in config.js alone installs a new cache`），證明個 race 真實存在 |
| Coverage | n/a | 冇 coverage 工具。所有 fix 都由 test 守住（見 mutation） |
| No Critical | ✅ pass | 🔴 = 0 |
| Security scan | n/a | 冇新依賴 |

### QA script 全量（brief 驗收條件）

| Script | 跑喺邊個 commit | 結果 | 說明 |
|---|---|---|---|
| v063 | `6078999`（HEAD） | ✅ **186 passed, 0 failed** | 包括 v0.57 / v0.62 舊 shell boot 嘅 fact session（`Fact Ch 3 #15`），冇 ReferenceError |
| v065 | `6078999`（HEAD） | ❌ 261 passed, **5 failed** | 5 個全部係 Home UI lane `9698ea8` 改咗嘅文案：`practiceHintHtml` 拆成 `<li>`、examDesc 刪咗「請於下方選擇試卷」、`myReviewNote`、刪咗 `flaggedCount` / `wrongToClearRounds`、`leaveCancel` 由「留下」改做「取消」 |
| v066 | `6078999`（HEAD） | ❌ 1869 passed, **1 failed** | `upgrade: My Review shows flagged 1 + 2 wrong in zh-HK`（`home.includes('已標記 1 題')`），原因同樣係 Home UI 刪咗 `flaggedCount` |
| v065 | `6078999^2` = `d42ec06`（今批兩條跟進都有，Home UI 未入） | ✅ **266 passed, 0 failed** | |
| v066 | `6078999^2` = `d42ec06` | ✅ **1870 passed, 0 failed** | oracle：8 個檔、737 筆紀錄、3 筆 keep |

結論：今批嘅改動令 v063 / v065 / v066 全部 0 fail，達到驗收條件。HEAD 上面嗰 6 個 fail 屬 Home UI lane，batch 4 review（`2026-10-07_review_v068-batch4-home-ui.md` 第 265–278 行）已經逐行列出要改嘅 QA oracle（v065 7 處、v066 第 491 行）。所以我冇開新 ID，交俾 main agent 喺 Home UI 跟進或者 QA refresh 時處理。**喺嗰次 refresh 之前，HEAD 上面 v065 / v066 唔會係 0 fail。**

---

## Section A — Batch 1 review 跟進（merge `6078999`）

- Commit：`8e92c88` W-017、`5ea0ff1` W-018、`a35a246` v066 Core Fact、`3fccd0f` v063 / v065 fact label、`b496672` S-064、`27e63f7` S-065、`fe6eb63` S-066、`49e1675` S-067、`bb8d7b0` S-068、`d42ec06` S-069
- 改動：`tests/sw-test.js`、`tests/structure-test.js`、`tests/lang-switch-test.js`、`tests/review-test.js`、`tests/tools/check-batch-replay.js`、3 份 QA script、batch 8 JSON。**冇改產品代碼**。
- Commit 規範：每個 item 一個 commit，格式係 `fix: <ID> | …` ✅。兩個 QA refresh commit 冇 ID，因為 batch 1 刻意冇為佢哋開 ID，可以接受。

### 逐項核對

| Item | 結果 |
|---|---|
| **W-017** | ✅ 照方案 A 做：寫入 bump 之後，用 `fs.utimesSync(configPath, t, t)` 將 mtime 設做 `Date.now()/1000 + BUMP_MTIME_AHEAD_S`（2 秒）。常數同 `SW_SETTLE_*` 放埋一齊，WHY 註解講清楚 http.server 嘅 `If-Modified-Since` 只精確到秒。新 mtime 一定大過之前任何一次回應嘅 `Last-Modified`，所以唔會再收到 304。sw-test 只有呢一個位寫檔，冇第二個需要同樣處理。**10 / 10 pass**；拎走修正就有 1 / 10 fail |
| **W-018** | ✅ 冇用「明確列出 1..8」，改咗做「掃描磁碟上全部 batch JSON，用數字排序」，再用 `EXPECTED_ORACLE { files: 8, records: 737, kept: 3 }` 做 sanity count。下一批 JSON 一加入，檔案數就會對唔上，迫人同步更新，所以「明確」嘅作用仍然保留。檔頭註解已經更新。`d42ec06` 全量 1870 / 0 |
| 唔屬今批：v066 Core Fact `#id` | ✅ 改用 `hasChapterFactLabel(text, f)`。期望值由 oracle 嘅 `EXP_STUDY` 自己計（唔係 call app 嘅 `chapterFactNumber`，所以唔係 tautology）。尾部用 `(?!\d)` 防止 `#1` 誤配 `#15`。178 個 fail 冇晒 |
| v063 / v065 refresh | ✅ `FACT_NO` 用 `vm` 由 `data/study.js` 獨立計出嚟。v063 嘅 `factIdTag` / `factSetLabel` 覆蓋 card、practise flow、CUI-0010、舊 shell boot 共 5 個位。v065 用 `zhFactSetLabel` 同 `'📌 核心知識 Ch '`。v063 Core Fact 只係用 regex `Core Fact Ch \d+ #\d+` 驗格式，冇驗實際號碼；因為 v066 已經逐題驗號碼，所以可以接受 |
| **S-064** | ✅ `batchFiles()` 按數字排序。每次跑之前，`selfCheckOrder()` 用 in-memory 樣本（`batch-10`、`batch-2`、`batch-1`、`notes.md`）驗排序，排錯就 exit 1。`check-batch-replay` 實跑：737 筆紀錄、0 mismatch。Regex 收窄咗，見 S-075 |
| **S-065** | ✅ 只改空格。我將新舊兩個版本都 `JSON.parse` 再比較，結果完全一樣（`true`）。排版同 batch 7 一致（一行一筆、`": "` 有空格）。`rule` 冇補規則編號，即係方案 A 嘅排版部分加上方案 B 嘅「唔改內容」，合理 |
| **S-066** | ✅ 揀咗方案 A：跳過 M4 嘅時候，最後一行會顯示 `LANG-SWITCH PASS (M4 skipped: no CJK font)`。另外加咗 `LANG_SWITCH_NO_CJK_FONT=1`，可以強制行冇字型嘅分支，等於補返 batch 1 講嘅「false 分支冇 Red」。我設咗呢個 env 實跑，最後一行正正係上面嗰句 ✅ |
| **S-067** | ✅ 見下面詳細分析。`layerCode` **21 行**（≤ 30），兩個 helper 分別係 7 行同 8 行 |
| **S-068** | ✅ 揀咗方案 A：3 份 script 各自喺頂部定義 `CACHE_POLL_MS` / `CACHE_POLL_TRIES` / `UPGRADE_POLL_TRIES`，6 個 inline loop 全部改用 `waitCache` / `waitUpgrade`。參數用 `[n, tries, ms]` 傳入 page，冇 closure 漏常數。v065 嘅註解位置有少少問題，見 S-076 |
| **S-069** | ✅ `pause` 改咗由 page 讀 `SCREEN_CHANGE_CLICK_GUARD_MS`，再加 `GUARD_MARGIN_MS = 50`。新加嘅 flagged round 用真 click（`#flagBtn`）取消晒兩題書籤，然後 assert Result 頁冇 Retry、仲有返 Home 掣 |

### S-067 `layerCode` 單次掃描：正確性

用單次掃描取代「regex blank 字串 + `stripComments`」，邏輯係：

- `//` 到行尾（保留 `\n`），`/* */` 換做一個空格。
- `'…'` / `"…"` 換做 `''`，支援 `\` escape。未閉合嘅字串去到行尾就停，所以唔會食晒成個檔。
- Template 嘅文字部分換做 `''`；入面嘅 `${…}` 表達式保留做 code。
- `exprDepth` 係一個 stack：每個開咗嘅 `${` 有一格，記住入面開咗幾多個 `{`。先檢查 `closesExpr`，再數括號，所以 `${a({ b: 1 })}` 呢類有括號嘅表達式都會喺正確位置結束。

我自己寫咗 harness 驗證：

| 輸入 | 輸出 | 判斷 |
|---|---|---|
| `'it\'s'; renderStudy();` | `''; renderStudy();` | ✅ escape |
| `` `a ${`b ${c}`} d`; renderStudy(); `` | `''''c''''; renderStudy();` | ✅ 兩層巢狀 template，`c` 保留做 code |
| `` `${ {a:1}.a } x` `` | `'' {a:1}.a ''` | ✅ object literal 入面嘅括號 |
| `/* a */renderStudy()` | ` renderStudy()` | ✅ |
| `` `\${renderStudy()}` `` | `''` | ✅ escape 咗嘅 `${` 唔當 code |
| `` x = /`/; renderStudy(); `` | `x = /''`（之後全部冇咗） | ⚠️ 見 S-074 |

- 6 個真 component 檔（`js/components/*.js`）逐個跑過：每個 top-level 名喺輸出入面都仲搵到，冇被錯誤食走。
- Mutation 測試（喺 worktree 改 `tags.js`，之後已還原）：
  - `` `x // y ${goHome()}` `` → `FAIL … tags.js → goHome` ✅
  - `` `a // b`; goHome(); `` → FAIL ✅。舊實作會漏咗呢個（batch 1 S-067 描述嘅情況）
  - `` `goHome` `` → PASS ✅（template 文字唔算使用）
- 6 個新 in-memory sample 守住 parser 本身。

### 發現

#### 🟢 S-074 — `layerCode` 遇到含反引號嘅 regex literal 會食晒之後成個檔
- **位置**：`tests/structure-test.js` `layerCode()`：`else if (c === '`') template(i + 1);`
- **描述**：Scanner 唔識 regex literal。如果 regex 入面有反引號（例如 `` /`/ ``），`template()` 會由嗰度一直掃到下一個反引號，或者去到檔尾，中間所有 code 都變咗 `''`。舊實作根本唔處理反引號，所以呢個係**新出現**嘅失敗方式。Regex 入面有引號（`/'/`）就最多食一行，同舊實作一樣。
- **影響**：會靜靜咁漏報（false negative），唔會假紅。而家 `js/components/` 冇 regex 含反引號，所以只係潛在風險。
- **方案 A**：加一個 sample 記錄呢個已知限制，例如 `` { code: 'x = /`/; renderStudy();', hit: false, why: 'known limit: a regex literal holding a backtick' } ``，再喺 `layerCode` 頂部加一行註解。好處：一行，限制有文件記錄；壞處：限制仍然存在。
- **方案 B**：喺 `(`、`=`、`,`、`:`、`[`、`!`、`&`、`|`、`?`、`;`、`{`、`}` 或者行首之後見到 `/`，就當係 regex，用類似 `endOfQuoted` 嘅方法掃到結尾 `/`（要處理 `[...]` 同 escape）。好處：真正修好；壞處：多十幾行 parser，要另外寫 sample。
- **推薦**：A（可選）。Component 入面用 regex 嘅機會好低。

#### 🟢 S-075 — Batch 檔名 regex 收窄咗；唔符合格式嘅檔會被靜靜略過
- **位置**：`tests/tools/check-batch-replay.js` `BATCH_FILE = /^2026-10-07_yue-batch-(\d+)(?:-[a-z0-9]+)?\.json$/`；v066 `BATCH_RE` 一樣
- **描述**：舊 pattern `batch-\d.*\.json` 接受任何後綴。新 pattern 只接受**一段**細楷後綴。將來如果有人改名做 `batch-9-s070-fix.json` 或者 `batch-9-S070.json`，兩個工具都會當佢唔存在。v066 嘅 `EXPECTED_ORACLE.files` 會因為數唔對而 fail，但 `check-batch-replay` 冇 count check，只會照樣顯示 `PASS`，而嗰批改動完全冇被驗證。
- **影響**：要將來檔名唔跟慣例先會出事，而且係靜靜咁漏驗。
- **方案 A**：後綴放寬做 `(?:-[\w-]+)?`。好處：一個字元；壞處：仍然靠檔名慣例。
- **方案 B**：`batchFiles()` 另外列出「以 `2026-10-07_yue-batch-` 開頭、`.json` 結尾，但唔符合 `BATCH_FILE`」嘅檔，有就 exit 1。好處：唔符合慣例嘅檔會即刻變紅；壞處：多 3 行。
- **推薦**：B。

#### 🟢 S-076 — v065 新加嘅 `FACT_NO` block 插咗喺註解同佢描述嘅常數中間
- **位置**：`.proj-docs/qa/scripts/2026-10-07_qa-v065.js` 大約第 62–68 行
- **描述**：`// words of English allowed in zh-HK UI text = …` 本來描述緊 `ZH_ASCII_WORDS`，但而家 `// v0.68: n = …` 同 `STUDY_DATA` / `FACT_NO` / `zhFactSetLabel` 插咗喺佢哋中間，讀落好似描述緊 `STUDY_DATA`。
- **方案 A**：將 `FACT_NO` block 搬去呢段註解前面，例如 `waitUpgrade` 之後。
- **方案 B**：將呢段註解搬落 `ZH_ASCII_WORDS` 正上面。
- **推薦**：A（可選，QA script 一次性用）。

### 評分

| 維度 | 得分 | 滿分 | 備注 |
|---|---|---|---|
| 正確性 | 25 | 25 | W-017 / W-018 根因修好，有 Red 證據；S-067 parser 驗過 |
| 安全性 | 20 | 20 | 淨改 test |
| 可維護性 | 19 | 20 | S-075 −1 |
| 測試覆蓋 | 14 | 15 | S-074 −1 |
| 性能 | 10 | 10 | |
| 代碼風格 | 9 | 10 | S-076 −1 |
| **總分** | **97** | 100 | ✅ **pass** |

---

## Section B — Batch 2 review 跟進（merge `94d8eb6` + `534f255`）

- Commit：`b7289f2` W-016、`0c432e5` S-072、`07ff8ee` S-070、`e9c9913` S-071、`b501b01` S-073；`4e73411` test + `1d79838` fix（quiz header 大細楷）
- Design Origin：`baseline`，沿用 batch 2（`js/components/factCard.js` + 用戶 2026-10-07 規格嘅 delta）。冇新 layout。

### 逐項核對

| Item | 結果 |
|---|---|
| **W-016** | ✅ `common.factSet` 改咗做 `Fact Ch {ch} #{n}` / `知識點 Ch {ch} #{n}`，冇用方案 A 原文嘅「·」。同卡片 pill 一致，可以接受。`examLabel` 改用 `factSetParams(examNum)`。`factsession-test` 驗 en / zh-HK 嘅 `examLabel`、quiz header、header 入面只有一個冇 child 嘅 `lang="en"` span，同埋唔會出現 `#21`。sideSession 同 locale 嘅註解亦一齊改正咗 |
| `factSetParams`（`js/domain/questions.js`） | ✅ 6 行。`questions.js` 喺 `similar.js` **之前**載入，但 `chapterFactNumber` 只係**執行時**先 call（經 `examLabel` → `setExamLabel` / 分享文字）。Load 期間冇任何 top-level call，所以冇 TDZ 或者 ReferenceError。v063 嘅 v0.57 / v0.62 舊 shell boot case 實跑 `startFactPractice(21)`，header 係 `Fact Ch 3 #15`，冇 page error ✅ |
| `setExamLabel`（`js/screens/quiz.js`） | ✅ 10 行。全部用 `textContent`、`createElement` 同 `replaceChildren(string, node, string)`，字串會變做 text node。搵唔到 `num`（例如將來 locale 改咗字）就退返去用 `textContent`。`result.js` 用嘅係 quiz.js 嘅 function，`result.js` 本身已經會 call `startExam`，有先例，而且載入次序係 quiz → result ✅ |
| XSS | ✅ 我喺 page 入面將 `LOCALES.en.common.factSet` 改做 `<img src=x onerror=…>Fact Ch {ch} #{n}`，再 call `setExamLabel`：生成 0 個 `<img>`，字面以文字顯示。非 fact set（`Exam 3`）冇 child element |
| 舊 shell / SW 升級 | ✅ 牽涉嘅 4 個檔（`questions.js`、`similar.js`、`quiz.js`、`result.js`）喺 v0.57 shell 已經有 `<script>` tag，唔使加入 `LATE_BOOT_SCRIPTS`。`upgrade-test`、`sw-test`、v063 boot、v065 / v066 upgrade 都冇 page error |
| **S-070** | ✅ header 改咗做 `SIMILAR + fact indexes …`，同埋 `Also numbers each fact within its chapter.` |
| **S-071** | ✅ 改用 `const CHAPTER_FACT_NUMBER = buildChapterFactNumbers()`。`chapterFactNumber` 仍然係 function declaration（hoisted），比起改做 arrow function 更適合跨檔 call |
| **S-072** | ✅ `.sqm-fact-label [lang="en"] { text-transform: none; }`。冇新 className，冇 hardcoded token。`similar-test` 驗 label 係 `uppercase`、號碼係 `none` |
| quiz header 大細楷 | ✅ `.quiz-label [lang="en"] { text-transform: none; }`，放喺 `css/base/layout.css`，緊貼 `.quiz-label`。`#quizLabel` 同 `#resultLabel` 都用 `.quiz-label`，所以兩個都受惠。Red：`4e73411` 單獨有 test commit ✅ |
| **S-073** | ✅ 拆咗做 `factNumberHtml(f)`（4 行）同 `chapterPillHtml(f)`（5 行）。Icon 包咗 `<span aria-hidden="true">`；`id` 搬咗去內層包住 `Ch c #n` 嘅 span，所以 `aria-describedby` 讀出嚟係「Ch 3 #1」。`study-test` 同步改咗 `checkChapterNumbers`：target 嘅 parent 係 pill、文字完全吻合、icon 唔包住 target。新 span 冇 class |
| 冇新 className | ✅ 我 grep 過 diff 新增嘅 `class=`、`className`、`.classList`，冇新名。CSS 只用 `[lang="en"]` attribute selector |
| 函數長度 | ✅ 全部 ≤ 10 行 |

### Red / mutation 驗證

W-016、S-072、S-073 嘅 test 同 fix 喺同一個 commit。所以我喺 worktree 逐個還原產品改動（之後已還原），確認 test 會 fail：

| 還原 | 結果 |
|---|---|
| `locales/*.js` + `questions.js` 改返 merge 前 | `FAIL: examLabel: Fact Ch 3 #15 / Flagged (Fact #21 / Flagged)` ✅ |
| 刪 `fact.css` S-072 rule | `FAIL: S-072: label uppercase, number text-transform none: {"label":"uppercase","num":"uppercase"}` ✅ |
| `factCard.js` 改返 merge 前 | `FAIL: en timeline: … {"pill":"📜 Ch 3 #1","target":"📜 Ch 3 #1","icon":false}` ✅ |
| 刪 `layout.css` `.quiz-label [lang="en"]` | `FAIL: en header: label uppercase, number text-transform none` ✅ |

Result 頁我用 probe 驗過：`#resultLabel` 顯示 `Fact Ch 3 #15`，內層 span 係 `lang="en"`，`text-transform: none`。不過冇自動化 test 守住呢個位，見 S-077。

觀察（冇開 ID）：`factSetParams` 遇到唔存在嘅 fact id 會因為 `fact.ch` 而 throw `TypeError`；舊版會顯示 `Fact #9999`。不過 `f<id>` 只可以由 `startFactPractice` 用真 fact id 產生，亦唔會存入 localStorage，所以而家觸發唔到。

### 發現

#### 🟢 S-077 — `setExamLabel` 第二個 caller（Result 頁 `#resultLabel`）冇 test
- **位置**：`js/screens/result.js:36` `setExamLabel(byId('resultLabel'), state.examNum)`；`tests/factsession-test.js` 只驗 `#quizLabel`
- **描述**：Result 頁同樣顯示 `Fact Ch 3 #15`，同樣靠 `lang="en"` span 避免變成「CH 3 #15」。如果將來有人將 result.js 改返用 `textContent = examLabel(…)`，文字一樣，但會變大楷，而 test 唔會發現。
- **方案 A**：`factsession-test` 嘅 fact session 完成之後到 Result 頁，再 call 一次 `checkHeaderNumberLang`，將 selector 參數化做 `#resultLabel`。
- **方案 B**：喺 `result-test` 加一個 fact set 嘅 Result case。
- **推薦**：A（可選）。現成 helper 加一個參數就得。

### 評分

| 維度 | 得分 | 滿分 | 備注 |
|---|---|---|---|
| 正確性 | 25 | 25 | 載入次序、舊 shell、fallback 都啱 |
| 安全性 | 20 | 20 | DOM text node，XSS probe 確認 |
| 可維護性 | 20 | 20 | |
| 測試覆蓋 | 14 | 15 | S-077 −1 |
| 性能 | 10 | 10 | eager index 只喺 load 時建一次，236 條 |
| 代碼風格 | 10 | 10 | |
| **總分** | **99** | 100 | ✅ **pass** |

---

## ✅ 做得好嘅地方（兩個 section 都適用）

- W-017 冇用 retry 或者加長 timeout 去掩蓋問題，而係直接處理根因（秒級 `If-Modified-Since`），註解講明原因。
- QA oracle 嘅期望值全部由 data 獨立計出嚟（`vm` 讀 `data/study.js`），冇 call app helper，冇 tautology。
- `setExamLabel` 搵唔到號碼就退返去用純文字，唔會因為 locale 字串改咗而壞。
- S-066 加咗 env 開關，令冇字型嗰個分支喺有字型嘅機都測試得到。
- `check-batch-replay` 每次跑之前做 self-check，排序錯咗會即刻紅。

## 修正優先順序

| 優先 | Item | 必修？ | 工作量 |
|---|---|---|---|
| — | （唔屬今批）Home UI 文案令 v065 有 5 個 fail、v066 有 1 個 fail | 係，QA 之前要修（batch 4 review 已列） | QA oracle 8 處 |
| 1 | S-075 | 可選 | 3 行 |
| 2 | S-077 | 可選 | 5 行 test |
| 3 | S-074 | 可選 | 1 個 sample + 1 行註解 |
| 4 | S-076 | 可選 | 搬 6 行 |

修正規範：一個 item 一個 commit，例如 `fix: S-075 | batch replay rejects batch JSON names it cannot parse`。

## 修訂後代碼（建議）

`tests/tools/check-batch-replay.js`（S-075 方案 B）：

```js
const BATCH_PREFIX = /^2026-10-07_yue-batch-.*\.json$/;
// S-075: a batch JSON the numeric pattern cannot parse would be skipped silently, so its changes would go unchecked
function batchFiles(names) {
  const unparsed = names.filter(f => BATCH_PREFIX.test(f) && !BATCH_FILE.test(f));
  if (unparsed.length) { console.log(`BATCH-REPLAY FAIL: unrecognised batch file name ${unparsed.join(' ')}`); process.exit(1); }
  return names.filter(f => BATCH_FILE.test(f)).sort((a, b) => batchNum(a) - batchNum(b));
}
```

`tests/structure-test.js`（S-074 方案 A）：

```js
    // S-074: known limit — layerCode has no regex literal support, so a backtick inside /…/ opens a template
    { code: 'x = /`/; renderStudy();', hit: false, why: 'known limit: a regex literal holding a backtick' },
```

`tests/factsession-test.js`（S-077 方案 A）：

```js
// the "Ch 3 #15" part of a quiz-label header (quiz or result) is one lang="en" text span that keeps its case
async function checkHeaderNumberLang(pg, lang, sel = '#quizLabel') {
  const nums = await pg.$$eval(`${sel} [lang="en"]`, els => els.map(e => [e.textContent, e.children.length]));
  // …同而家一樣，將 '#quizLabel' 改用 sel
}
// 完成 fact session 去到 Result 頁之後：await checkHeaderNumberLang(pg, 'en', '#resultLabel');
```

## Handoff receipt

```handoff-receipt
protocol: 1
status: pass
score: 97/100
batch:
  - section: A
    feature: tests/W-017_sw-race-and-qa-oracle (batch 1 follow-ups)
    merge: 6078999
    commits: [8e92c88, 5ea0ff1, a35a246, 3fccd0f, b496672, 27e63f7, fe6eb63, 49e1675, bb8d7b0, d42ec06]
    status: pass
    score: 97/100
  - section: B
    feature: study/W-016 fact number follow-ups + quiz label case (batch 2 follow-ups)
    merge: [94d8eb6, 534f255]
    commits: [b7289f2, 0c432e5, 07ff8ee, e9c9913, b501b01, 4e73411, 1d79838]
    status: pass
    score: 99/100
    design_origin: "baseline: js/components/factCard.js (user spec 2026-10-07 delta, as batch 2)"
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
  no_critical: pass
  security_scan: n/a
critical_count: 0
new_items:
  critical: []
  warning: []
  suggestion: [S-074, S-075, S-076, S-077]
sw_test_10x: "10/10 SW PASS @6078999 (Red: without utimesSync 9/10, 1 FAIL 'version bump in config.js alone installs a new cache')"
next_action: merge_develop
context: "v0.68 batch 3 (review follow-ups): run-all 31/31 @6078999; sw-test 10/10. QA @6078999: v063 186/0, v065 261/5, v066 1869/1. All 6 fails are Home UI lane 9698ea8 copy changes (practiceHint list, examDesc, myReviewNote, flaggedCount/wrongToClearRounds removed, leaveCancel 留下->取消), already listed in batch 4 review lines 265-278. Same scripts @6078999^2 (d42ec06, both follow-ups, no Home UI): v065 266/0, v066 1870/0. A 97 pass, B 99 pass, 0 C, 0 W. S-067 layerCode 21 lines, verified by harness and mutations. Batch 2: no XSS (DOM text nodes, probe with markup in the locale string made 0 elements), factSetParams calls chapterFactNumber only at run time (questions.js loads before similar.js, no top-level call), v063 old-shell boot passes, no new className, every fix is guarded (4 mutations go red). Optional: S-074 layerCode regex with a backtick, S-075 batch filename regex narrowed (unparsed names skipped silently), S-076 v065 comment placement, S-077 #resultLabel not tested. Note: brief's two-dot diff 6078999^1 6078999^2 shows the Home UI changes reversed; use three-dot."
blockers:
  - "Before QA: v065 / v066 oracle refresh for Home UI lane copy (outside this batch; see batch 4 review). Until then HEAD is not 0-fail on v065 / v066."
```
