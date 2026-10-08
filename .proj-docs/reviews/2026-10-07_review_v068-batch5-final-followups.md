# Batch Review — 2026-10-07 — v0.68 batch 5：最後一輪 review 跟進

- **日期**：2026-10-08（沿用 v0.68 review 系列檔名日期 2026-10-07）
- **審閱者**：Code Reviewer（獨立 subagent）
- **目標**：branch `claude/quirky-keller-40h0qp` @ `e5f4d5c`，兩條 merge（three-dot diff `<merge>^1...<merge>^2`）
  - **Lane X**：`a2c2318` Merge fix/home/W-022_review-followups（8 個 commit：W-022、S-080、S-082、S-083、S-084、S-077）
  - **Lane Y**：`e5f4d5c` Merge chore/qa/S-074_tools-and-oracle-refresh（4 個 commit：S-074、S-075、S-076、QA oracle refresh）
  - 另外 first-parent 上嘅 `e994005`（docs: W-022 screenshots，2 張 PNG）唔屬於任何一條 lane，只用嚟做視覺核對
- **對照**：`2026-10-07_review_v068-batch4-home-ui.md`（W-022、S-080…S-084）、`2026-10-07_review_v068-batch3-followups.md`（S-074…S-077）
- **總評**：上兩輪嘅跟進項目全部按建議方案做好。W-022 揀咗方案 A，說明文字喺 0 題時恢復全對比度，empty tile 仍然睇得出係空（灰色左邊框、冇陰影、icon / 數字 / 標題 / 副標題都淡咗）；非 empty tile 冇 regression。S-074 由「記錄限制」升級成真正支援 regex literal，常見位置（`=`、`(`、`,`、`=>`、`return`、`;`、`}`、行首）全部判斷啱，但我搵到 3 個未覆蓋嘅位置（S-085），其中 `${/'/…}` 會靜靜食晒後面嘅 code。所有缺口都只會令 layering guard 漏報，唔會假紅，而且而家 `js/` 入面冇呢類寫法，所以記做 Suggestion。QA oracle 係手寫 literal，冇讀 locale 或者 app 嘅值。Tests **31 / 31 PASS**；QA v063 **186 / 0**、v065 **275 / 0**、v066 **1870 / 0**。冇 🔴、冇 🟡，有 3 個 🟢（S-085…S-087）。

## 整體 verdict

| Section | 範圍 | 分數 | Status | 新 item |
|---|---|---|---|---|
| A | Lane X：W-022、S-080、S-082、S-083、S-084、S-077（S-081 唔改） | **98** | ✅ pass | S-086、S-087 |
| B | Lane Y：S-074、S-075、S-076、QA oracle refresh | **99** | ✅ pass | S-085 |

**整體 Status：✅ pass**（兩個 section 都 ≥ 90、冇 Critical、hard gates 全過）

---

## Hard Gates

| Gate | 結果 | 證據 |
|---|---|---|
| Lint | n/a | Repo 冇 ESLint / Prettier；`structure-test` PASS（包括 25 個 layering in-memory sample） |
| Type check | n/a | 冇 TypeScript |
| Tests | ✅ pass | Worktree `scratchpad/rv5` @ `e5f4d5c`：`NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium ./tests/run-all.sh` → **31 / 31 PASS**，exit 0 |
| QA scripts（全量） | ✅ pass | 同一個 worktree：v063 **186 passed / 0 failed**、v065 **275 / 0**、v066 **1870 / 0**。v065 重跑一次仍然係 275 / 0 |
| Coverage | n/a | 冇 coverage 工具。每項都有行為 assert 或者 self-check，詳情見下面 mutation 表 |
| No Critical | ✅ pass | 🔴 = 0 |
| Security scan | n/a | 冇新增依賴 |
| TDD Red | ✅ | 見下表 |

跑完已經 `git worktree remove --force`（`rv5`、`rv5red`、`rv5y` 全部移除）。主 checkout 除咗本報告之外冇改動。

### TDD Red 核實（worktree `rv5red`，逐個 test commit checkout 再跑）

| Test commit | 結果 | 說明 |
|---|---|---|
| `63d2189`（W-022） | `lang-switch` **FAIL**「My Review zh-HK: 0 wrong → note keeps full opacity: 0.6」 | Red 真實 |
| `c658624`（S-084） | `lang-switch` **FAIL**「390px note: "24" and "題。" stay on one line: {count:434,end:449,wrap:"wrap"}」 | Red 真實 |
| `bec7158`（S-082）、`bf7a24a`（S-077） | PASS | 兩個都係 guard test，保護現有行為，所以一開始就係綠，合理 |

### Mutation 核實

| Mutation | 結果 |
|---|---|
| `result.js`：`setExamLabel(byId('resultLabel'), …)` 改返做 `textContent = examLabel(…)` | `factsession` **FAIL**「en #resultLabel: "Ch 3 #15" in one lang="en" text span ([])」→ S-077 有效 |
| `home.css`：W-022 改返做 `.my-tile.empty { opacity: 0.6; }` | `lang-switch` **FAIL**「note keeps full opacity: 0.6」→ W-022 有效 |
| `.proj-docs/plans/` 加一個 `2026-10-07_yue-batch-9-S070.json` | `check-batch-replay` 印 `BATCH-REPLAY FAIL: batch file name(s) not matching …`，**exit 1** → S-075 有效 |
| 冇 mutation | `check-batch-replay`：737 筆紀錄、0 mismatch，PASS |

### Review Item ID

按 brief，新 item 由 `S-085` 同 `W-023` 開始。今次新增 `S-085`、`S-086`、`S-087`，冇新 C / W。

---

## Section A — Lane X：Home UI 跟進（`a2c2318`）

### 改動清單
- `css/screens/home.css`：W-022（`.my-tile.empty` 唔再成個 tile 用 `opacity`，改成 `.my-tile.empty > :not(.t-note) { opacity: 0.6; }`）、S-080（`--exam-badge-ring: 1.5px`）、S-084（`.t-note { text-wrap: pretty; }`）
- `tests/lang-switch-test.js`：W-022 嘅有效 opacity 同顏色 assert、S-084 嘅換行 assert、S-082 嘅 320px 檢查、S-083 嘅格式修正
- `tests/mode-test.js`：S-080 ring 寬度 assert、S-083 格式修正
- `tests/factsession-test.js`：S-077（`checkHeaderNumberLang` 加 selector 參數，加 `checkResultLabelLang`）

### 逐項對照

| Item | 結果 |
|---|---|
| **W-022** | ✅ 跟足 batch 4 方案 A。`renderReviewTile` 嘅 innerHTML 只有 element 子節點（`.t-top`、`b`、`.sub`、`.t-note`），冇直接 text node，所以 `> :not(.t-note)` 會淡晒其他部分。Test 用「自己同所有祖先 opacity 相乘」計有效 opacity：`.t-note` = 1，其他 4 個都 < 1；另外仲用 probe 驗 `.t-note` 顏色仍然係 `--text-muted`。 |
| W-022 empty 夠唔夠明顯 | ✅ 截圖 `w022-myreview-zh-HK-0wrong-390.png` / `-320.png`：空 tile 有灰色左邊框（非空係紅 / 橙）、冇陰影，✗ icon、「0」、「錯題」同副標題都淡咗，同隔籬嘅「已標記 8」tile 一眼分得出。同舊版比較，唯一分別係 tile 底色同外框唔再淡，即係由「成塊灰」變成「白卡 + 淡內容」，仍然清楚表示 disabled。 |
| W-022 非 empty regression | ✅ 新 selector 一定要有 `.empty`，非空 tile 冇任何 rule 變。`.my-tile.empty` 嘅 `border-left-color` / `box-shadow` / `cursor` 保持不變。Flagged tile 0 題時，`.t-top`、`b`、`.sub` 一樣會淡，同之前效果一致。S-082 嘅 320px 檢查亦覆蓋 0 題同非 0 題。 |
| **S-080** | ✅ `--exam-badge-ring` 喺 `.exam-btn.done::after` 定義，喺 `.exam-btn.done:hover::after` 用。兩條 rule 指向同一個 pseudo-element，所以 custom property 一定 resolve 到。`mode-test` assert 實際 render 出嚟係 `rgb(…green) 0px 0px 0px 1.5px`。 |
| **S-081**（唔改） | ✅ 決定本身合理：batch 4 都係推薦方案 A（維持現狀），因為 `tokens.css` 冇 spacing token，單獨加 token 會令兩套寫法並存。⚠️ 但 brief 話「理由睇 commit 或者 HANDOFF」，我喺 lane 嘅 commit message、merge message 同 `HANDOFF.md` 都搵唔到 S-081，見 **S-087**。 |
| **S-082** | ✅ `checkMyReviewNarrow` 喺 320px 重用 `checkMyReviewIn` / `checkMyReviewEmptyIn`，覆蓋 en / zh-HK 同 30 / 0 題 4 個組合，另外驗頁面同兩個 tile 都冇水平 overflow。用 `try…finally` 還原 viewport，寫法好。 |
| **S-083** | ✅ 兩處逗號後面都補咗空格。 |
| **S-084** | ✅ 跟方案 A，加 `text-wrap: pretty`，係漸進增強。Test 用 `Range.getBoundingClientRect` 比較「24」同「題。」嘅 top，喺 390 / 320px 都驗。Red 真實（舊版 top 434 vs 449）。 |
| **S-077** | ✅ 見下面分析，另外有 S-086。 |

### S-077 直接 call render 嘅做法合唔合理？

**合理。** `sideSession.js` 嘅 `nextAction()`：side session 最後一題只會出「↩ Back」（`returnFromSideSession`），唔會出 Finish / Submit，所以 fact session 喺 app 入面**永遠去唔到 Result 頁**。如果要經 UI 去，就要寫一個 app 根本冇嘅流程。Test 直接 call `startFactPractice` → `finishExam` 去到 Result 頁，鎖住嘅係 `result.js` 呢個 caller 同 `setExamLabel` 之間嘅約定，即係「`#resultLabel` 都要用 `setExamLabel`，唔可以改返 `textContent`」。上面 mutation 證明呢個 test 守得住。

副作用亦都安全：fact session 係 Practice mode，`recordExamResults` 唔會寫 wrong list；`f<id>` 唔係 numbered exam，唔會 mark completed。結尾 `leaveToHome()` 會 `clearSideSession()`。另外註解有寫明「fact session 唔會去 Result 頁」，意圖清楚。

唯一細節：`finishExam()` 本身已經會 call `renderResults()` 同 `showScreen('screenResult')`，test 再 call 一次係多餘，見 S-086。

### 發現

#### 🟢 S-086 — S-077 test：`finishExam()` 之後再 call 一次 `renderResults()` / `showScreen()`
- **位置**：`tests/factsession-test.js` `checkResultLabelLang`：`setLang('en'); startFactPractice(id); finishExam(); renderResults(); showScreen('screenResult');`
- **描述**：`finishExam()`（`js/screens/result.js:17`）尾段已經 `renderResults(); showScreen('screenResult');`。後面兩個 call 冇作用，但讀者可能會以為 `finishExam` 唔會 render，或者以為要 render 兩次先啱。
- **影響**：冇功能影響，只係可讀性。
- **方案 A**（推薦）：刪走後面兩個 call，變成 `startFactPractice(id); finishExam();`。
- **方案 B**：保留，但喺註解寫明係刻意重複。冇實際好處。
- **扣分**：測試覆蓋 −1（Suggestion）

#### 🟢 S-087 — S-081「唔改」嘅理由冇記錄喺 commit 或者 HANDOFF
- **位置**：Lane X commit `63d2189…bf7a24a`、merge `a2c2318`、`HANDOFF.md`
- **描述**：Brief 話 S-081 嘅理由喺 commit 或者 HANDOFF。但 `git log --all --grep=S-081` 冇結果，`HANDOFF.md` 亦都冇 S-081。決定本身（跟 batch 4 推薦方案 A，等統一加 `--space-*` token 先遷移）冇問題，問題係追蹤唔到：下一個人睇 batch 4 會以為 S-081 未處理。
- **方案 A**（推薦）：喺 `HANDOFF.md` 嘅 v0.68 跟進段加一行，例如「S-081 won't fix: no spacing tokens in tokens.css; migrate all px spacing together when `--space-*` exists」。
- **方案 B**：開一張 backlog ticket，將「引入 spacing token 並遷移」當成獨立工作。可以同 A 一齊做。
- **扣分**：可維護性 −1（Suggestion）

### 觀察（冇開 ID）
- W-022 之後，0 題 tile 入面全對比度嘅說明睇落比淡咗嘅標題「錯題」更搶眼，層級有少少倒轉。呢個係方案 A 預期嘅取捨（說明比 disabled 標題重要），可以接受。如果設計想調整，可以考慮 batch 4 方案 C（逐個元素轉色）。

### 評分

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 25 | 25 | W-022 / S-080 / S-084 行為正確，非 empty tile 冇 regression |
| 安全性 | 20 | 20 | 純 CSS + test |
| 可維護性 | 19 | 20 | S-087 −1 |
| 測試覆蓋 | 14 | 15 | S-086 −1；兩個 Red 都真實，兩個 mutation 都變紅 |
| 性能 | 10 | 10 | |
| 代碼風格 | 10 | 10 | 冇 hardcoded 顏色；`1.5px` 已經抽成元件級 custom property |
| **總分** | **98** | **100** | |

**結果：✅ pass**

---

## Section B — Lane Y：QA 工具同 oracle（`e5f4d5c`）

### 改動清單
- `tests/structure-test.js`：S-074 加 `REGEX_AFTER`、`endOfRegex`，`layerCode` 多一個分支，加 6 個 sample
- `tests/tools/check-batch-replay.js`：S-075 加 `unparsedBatchFiles` + `selfCheckUnparsed`，唔符合格式嘅 batch 檔名會 exit 1；`tests/tools/README.md` 同步
- `.proj-docs/qa/scripts/2026-10-07_qa-v065.js`：S-076 搬註解；按 Home UI lane 刷新 oracle
- `.proj-docs/qa/scripts/2026-10-07_qa-v066.js`：刷新 upgrade oracle；`2026-10-06_qa-v060.js` 只改 message

### S-074：regex 同除號點分

`REGEX_AFTER` 檢查 `out`（已經清走字串同註解嘅 code）結尾：如果係開頭、運算符、開括號、`;` / `{` / `}`，或者 `return` / `typeof` / `case` / `void` / `delete` / `in` / `of` / `throw` / `yield` / `await` 呢類 keyword，就當 `/` 係 regex；另外要 `endOfRegex` 喺同一行搵到結尾 `/` 先算。我用 harness 抽出 `layerCode` 試咗 21 個 case：

| Case | 結果 |
|---|---|
| `=`、`(`、`,`、`=>`、`return`、`&&`、`<` 之後嘅 regex | ✅ |
| `}`（block 結尾）之後、`;` 之後行首嘅 regex | ✅ |
| Regex flag（`/`/gi`）、`]` 喺 class 外面、class 入面 escape 咗嘅 `\]` | ✅ |
| `/=`、`/* c */ /` 之後嘅除號、`'a'.length / 2`、`` `a`.length / 2 `` | ✅ 當除號 |
| 名結尾似 keyword（`offset / 2`、`begin / 2`） | ✅ `\b` 擋住，當除號 |
| 喺 template `${…}` 入面嘅除號（`${a / 2} ${b / 3}`） | ✅ |
| `)` 之後嘅 regex（`if (x) /`/.test(s)`） | ⚠️ 當除號。呢個係**註解有寫明**嘅取捨（JS 本身都要靠語法先分得到），可以接受 |
| **`${` 之後即刻係 regex**（`` `${/'/.test(x)}` ``） | ❌ 見 S-085 |
| **後置 `++` / `--` 之後嘅除號**（`b++ / 2; renderStudy(); d / 3`） | ❌ 見 S-085 |
| **叫 `of` / `in` 嘅 property 之後嘅除號**（`o.of / 2; …`） | ❌ 見 S-085（好少見） |

`endOfRegex` 遇到換行就回傳 −1，所以 regex 唔會跨行。就算判斷錯咗，最多只會影響同一行嘅 code，唔會好似舊版咁食晒成個檔，比 batch 3 之前安全好多。

**函數長度**：`endOfRegex` 9 行、`layerCode` 22 行、`check-batch-replay` `main` 26 行、`selfCheckUnparsed` 6 行，全部 ≤ 30 行 ✅。效能：23 個 `js/*/*.js` 檔全部行一次 `layerCode` 用 26 ms（`REGEX_AFTER.test(out)` 每次掃成個 `out`，但檔案細，冇問題）。

### S-075 / S-076
- **S-075** ✅ 跟 batch 3 推薦方案 B：以 `2026-10-07_yue-batch-` 開頭、`.json` 結尾，但唔符合 `BATCH_FILE` 嘅檔會 exit 1。`selfCheckUnparsed` 用 7 個 in-memory 名驗 filter 本身（3 個應該中，4 個唔應該中，包括 `.md` 同 `notes.json`）。Mutation 驗過真係會 exit 1。README 有同步更新。
- **S-076** ✅ `ZH_ASCII_WORDS` 嘅註解搬返去佢描述嘅常數正上面，同 `FACT_NO` block 之間有空行分隔。

### QA oracle 係咪獨立於 app？

**係。** 檢查方法：
- v065 / v066 新加嘅期望值全部係手寫 literal（`G.practiceHint` 4 句、`G.myReviewNote`、`'尚餘 ${n} 題'`、`'取消'`、`'已標記'`、`'錯題'`），冇 `require` / `vm` 讀 `locales/`，亦冇喺 page 入面 call `t()` 攞值。`{max}` / `{streak}` 都係人手代入 `24` / `3`。
- 唯一讀 repo 數據嘅係 batch 3 已經 review 過嘅 `FACT_NO`（由 `data/study.js` 自己數，唔經 app）同 `ZH_ASCII_WORDS`（白名單，唔係 oracle）。今次冇新增。
- `G.myReviewNote` 同 batch 4 review §A「規格逐條對照」記低嘅 spec 文字逐字一樣（`{max}` → 24）。
- 新加嘅負面 assert（冇「請於下方選擇試卷」、冇「每輪 24 題」、冇 `#myReviewNote`）會攔住舊文案返嚟。
- `expectMyReview` 分開驗 `.t-num`、`b`、`.sub`、`.t-note`，比舊版 `bodyText.includes` 更準。
- Batch 4 review「已知未處理」表列出嘅 8 個過時 oracle，全部都有處理到 ✅。

**計數差異（觀察，唔係今批問題）**：commit message 寫 v065 276 / 0，我喺 HEAD 跑兩次都係 275 / 0；喺 lane tip `2cbedbc` 再跑就係 276。差嗰一個係 `qa-v065.js:396` 嘅 `if (hasNote) await expectTexts('Quiz practice note', …)`，即係 Exam 4 practice 揀中嘅題目有冇備注，屬於 script 本身原有嘅條件 assert，同今次改動無關，而且 0 fail。

### 發現

#### 🟢 S-085 — `layerCode` 仲有 3 個位置分唔到 regex 同除號
- **位置**：`tests/structure-test.js` `REGEX_AFTER` / `layerCode` 嘅 `template()`
- **描述**（用 harness 抽 `layerCode` 實測）：
  1. **`${` 之後即刻係 regex**：`template()` 遇到 `${` 會喺 `out` 加 `''`，所以 `out` 結尾係 `'`，唔喺 `REGEX_AFTER` 名單入面，regex 會被當成除號。`` const s = `${/'/.test(x)}`; renderStudy(); `` → `const s = ''/''`，regex 入面嘅 `'` 開咗一個字串，食到行尾，**`renderStudy()` 被靜靜漏報**。如果 regex 入面係反引號，就會亂咗 template 狀態。
  2. **後置 `++` / `--`**：`REGEX_AFTER` 嘅 `[+\-]` 唔分前置同後置。`a = b++ / 2; renderStudy(); c = d / 3;` → `a = b++ '' 3;`，**漏報**。
  3. **Property 叫 `of` / `in`**：`\b(?:…|in|of|…)` 前面冇排除 `.`，所以 `x = o.of / 2; renderStudy(); y = z / 3;` → `x = o.of '' 3;`。
- **影響**：全部都係 false negative（layering guard 漏報），唔會假紅。只有同一行有第二個 `/` 先會出事。而家 `js/` 入面冇 `${/`（已 grep），亦冇呢類寫法，所以只係潛在風險。第 1 個係 template-heavy 嘅 component 最有機會寫到。
- **方案 A**（推薦，約 3 行 + 3 個 sample）：
  - `template()` 開 `${` 嘅時候喺 `out` 加一個「期待值」嘅標記，例如 `out += t.expr ? "''(" : "''";`（`out` 只用嚟做 `usesName` 同 `REGEX_AFTER`，多一個 `(` 冇副作用）
  - `REGEX_AFTER` 嘅 `+` / `-` 改成排除連續兩個：`(?<![+-])[+-]`；keyword 前面加 `(?<!\.)`
  - 加 3 個 sample：`` `${/'/.test(x)}`; renderStudy(); ``、`b++ / 2; renderStudy(); d / 3`、`o.of / 2; renderStudy(); z / 3`，全部 `hit: true`
  - Trade-off：準確度更高；regex 多兩個 lookbehind，要同時改 sample。
- **方案 B**：唔改 code，只加 3 個 `hit: false` 嘅「known limit」sample，喺 `REGEX_AFTER` 註解列明。Trade-off：一行搞掂，但第 1 個 case 會靜靜漏報，而且係 template 最常見嘅位置。
- **推薦**：A。第 1 點建議優先處理，第 2、3 點可選。
- **扣分**：測試覆蓋 −1（Suggestion）

### 評分

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 25 | 25 | S-075 fail-safe 正確（mutation exit 1）；oracle 正確，0 fail；S-074 缺口只喺 test 工具，計入測試覆蓋 |
| 安全性 | 20 | 20 | |
| 可維護性 | 20 | 20 | 函數全部 ≤ 30 行；註解講清楚 WHY 同 `)` 嘅取捨 |
| 測試覆蓋 | 14 | 15 | S-085 −1；6 個新 sample + `selfCheckUnparsed` 守住工具本身 |
| 性能 | 10 | 10 | 23 個檔 26 ms |
| 代碼風格 | 10 | 10 | S-076 處理好 |
| **總分** | **99** | **100** | |

**結果：✅ pass**

---

## ✅ 做得好嘅地方（兩條 lane）
- W-022 嘅 test 用「有效 opacity = 自己 × 所有祖先」計，正正係 opacity 會向下乘嘅原理；仲另外驗顏色，防止有人改用淡色代替 opacity 嚟「修」。
- S-084 用 `Range` 量字元位置，唔靠截圖，而且 Red 真實。
- S-082 嘅 `checkMyReviewNarrow` 將 check function 當參數傳入，4 個組合重用同一套 assert，`finally` 還原 viewport。
- S-074 唔只係記錄限制，而係真正處理，而且 `endOfRegex` 遇到換行就停，令最壞情況由「食晒成個檔」變成「最多影響一行」。
- S-075 嘅工具會自己驗自己（`selfCheckOrder` + `selfCheckUnparsed`），同 batch 3 嘅做法一致。
- Oracle refresh 嘅 commit message 逐條列出改咗乜、點解改，同埋前後 pass / fail 數字，方便追蹤。

## 修正優先順序

| 優先 | Item | 建議 | 成本 |
|---|---|---|---|
| 1 | S-085 | 可選；第 1 點（`${/…/}`）建議下次改 `structure-test` 時一齊做 | 約 3 行 + 3 個 sample |
| 2 | S-087 | 可選；喺 HANDOFF 加一行 | 1 行 |
| 3 | S-086 | 可選 | 刪 2 個 call |

全部係 Suggestion，唔 block merge 或者 QA。修正規範：一個 item 一個 commit，例如 `fix: S-085 | layerCode reads a regex right after ${, ++ / -- and .of / .in`。

## 修訂後代碼（S-085 方案 A 範例）

`tests/structure-test.js`：

```js
// S-085: after ++ / -- or a property named in / of, a / is a division; ${ expects a value, so a / there opens a regex
const REGEX_AFTER = /(?:^|[(,=:[!&|?;{}*%<>~^]|(?<![+-])[+-]|(?<!\.)\b(?:return|typeof|case|void|delete|in|of|throw|yield|await))\s*$/;
```

```js
  // "(" marks the opened ${ as a place that expects a value (REGEX_AFTER reads out; usesName ignores the mark)
  const template = from => { const t = scanTemplateText(src, from); out += t.expr ? "''(" : "''"; i = t.end; if (t.expr) exprDepth.push(0); };
```

```js
    // S-085
    { code: 'const s = `${/\'/.test(x)}`; renderStudy();', hit: true, why: 'a call after a regex right after ${' },
    { code: 'a = b++ / 2; renderStudy(); c = d / 3;', hit: true, why: 'a call between divisions after b++ and a name' },
    { code: 'x = o.of / 2; renderStudy(); y = z / 3;', hit: true, why: 'a call between divisions after a property named of' },
```

`tests/factsession-test.js`（S-086）：

```js
  await pg.evaluate(id => { setLang('en'); startFactPractice(id); finishExam(); }, FACT_ID); // finishExam renders and shows Result
```

---

## Handoff receipt

```handoff-receipt
protocol: 1
status: pass
score: 98/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
section_scores:
  A_lane_x: 98/100 pass
  B_lane_y: 99/100 pass
critical_count: 0
new_items:
  critical: []
  warning: []
  suggestion: [S-085, S-086, S-087]
next_action: merge_develop
next_agent: quality-assurance
branch: "claude/quirky-keller-40h0qp"
context: "v0.68 batch 5 (final follow-ups) @e5f4d5c, three-dot diffs. Lane X a2c2318 98 pass (W-022 option A: empty tile fades all but .t-note, note opacity 1 + --text-muted; non-empty tiles unchanged; S-080 ring 1.5px asserted; S-082 320px x4; S-083; S-084 text-wrap pretty; S-077 drives finishExam directly, valid because a side session never reaches Result; S-081 kept as-is but rationale not recorded). Lane Y e5f4d5c 99 pass (S-074 regex scanner ok after = ( , => return ; } and line start, ) treated as division by design; S-075 unparsed batch name exits 1; S-076; oracles are hand-written literals, not from locales/app). run-all 31/31; QA v063 186/0, v065 275/0 (276 at 2cbedbc: pre-existing if(hasNote) assert at v065:396), v066 1870/0. Reds real (63d2189, c658624); mutations red for S-077, W-022, S-075. Critical 0, Warning 0. New optional items: S-085 layerCode misses regex right after ${ (confirmed silent miss with /'/), postfix ++/-- and .of/.in before division; S-086 S-077 test calls renderResults/showScreen twice; S-087 S-081 won't-fix not recorded in HANDOFF/commits. Section scores A 98, B 99; worst shown."
```
