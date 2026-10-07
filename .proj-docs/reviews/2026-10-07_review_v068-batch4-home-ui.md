# Batch Review — 2026-10-07 — v0.68 第 4 批：Home UI lane（6 項）

- **日期**：2026-10-07（UTC）
- **審閱者**：Code Reviewer Agent
- **Branch**：`claude/quirky-keller-40h0qp`，HEAD `6078999`
- **範圍**：merge `9698ea8`，`git diff 9698ea8^1 9698ea8^2`（9 個檔案，+245 / −33），12 個 commit（6 對 test → feat / fix）
- **需求來源**：用戶 2026-10-07 確認嘅 6 項規格（第 1–5 項冇 mockup；第 6 項用 `mockups/exam-hover.html` 方案 A，檔案已喺 `acc807c` 刪走，`c6d98e2` 有存檔）
- **總評**：6 項全部做到，改動細而集中。被刪嘅 i18n key（`wrongToClearRounds`、`flaggedCount`）同 `#myReviewNote` / `.my-note` 冇殘留 call site（`examTools.js` 嘅 `flaggedCount()` 係另一個同名函數，同 locale key 無關）。en / zh-HK key 對稱，`practiceHintHtml` 兩個語言嘅 tag 次序一樣（`ul li b /b /li li b /b /li li /li li /li /ul`），`i18n-test` PASS。Hover specificity 正確，`.exam-btn.all` 同未完成嘅掣冇 regression。第 6 項嘅 CSS 同存檔 mockup 方案 A 嘅兩條 rule 逐字一樣。Tests **31 / 31 PASS**，6 個 test commit 嘅 Red 全部真實（包括 amend 過嗰個）。冇 🔴；1 個 🟡（W-022：0 題時錯題 tile 被 `opacity: 0.6` 調暗，新說明對比度只有約 2.4:1）；5 個 🟢（S-080…S-084）。

---

## 整體 verdict

- **涵蓋 commit**：`62ad550`→`776e395`、`e04d0fb`→`df9664f`、`ca95364`→`ea63e9b`、`d4291e9`→`f5123e3`、`7565a4b`→`a4cec47`、`16e1e1d`→`723a5e4`，merge `9698ea8`
- **整體 score**：90 / 100
- **Status**：✅ pass（剛好 90 分、冇 Critical、hard gates 全過）。W-022 唔 block，但建議 v0.68 release 前修好

### Hard Gates

| Gate | 結果 | 證據 |
|---|---|---|
| Lint | n/a | Repo 冇 ESLint / Prettier；`node --check` 檢查 `home.js`、`en.js`、`zh-HK.js` 全部 OK；`structure-test` PASS |
| Type check | n/a | 冇 TypeScript |
| Tests | ✅ pass | 喺獨立 worktree（`scratchpad/rv4` @ `6078999`）跑 `NODE_PATH=/opt/node-tools/node_modules ./tests/run-all.sh` → **31 / 31 PASS**，exit 0。跑完已經 `git worktree remove --force`，主 checkout 除咗本報告之外冇改動 |
| Coverage | n/a | 冇 coverage 工具。6 項都有行為 assert：第 1–4 項 en + zh-HK 都有，仲有 pill 切換語言後重新 render；第 5–6 項只測 en，但呢兩項係純 CSS，同語言無關 |
| No Critical | ✅ pass | 🔴 = 0 |
| Security scan | n/a | 冇新增依賴 |
| TDD Red | ✅ | 見下表。全部係因為功能未做而 fail，唔係 test 本身寫錯 |

#### TDD Red / Green 核實（另開 worktree `scratchpad/rv4red`，逐個 commit checkout 再跑，跑完已移除）

| Test commit | Red 結果（test commit 上） | Feat / fix commit | Green |
|---|---|---|---|
| `62ad550`（amend 過） | `lang-switch` FAIL「My Review en: note inside #tileWrong … null」；`review-test` FAIL「Flagged tile: 1, no count line」 | `776e395` | lang-switch / review PASS |
| `e04d0fb` | `lang-switch` FAIL「Exam desc en: no "Pick an exam below"」 | `df9664f` | PASS |
| `ca95364` | `lang-switch` FAIL「Practice hint en: 4 points … []」 | `ea63e9b` | lang-switch / batch / mastery PASS |
| `d4291e9` | `lang-switch` FAIL「cancel reads Cancel: Stay」；`examtools` FAIL「Cancel / Leave」 | `f5123e3` | PASS |
| `7565a4b` | `mode-test` FAIL「completed exam hover … bg rgb(26,39,68)」（即係 navy，證明舊 bug 存在） | `a4cec47` | PASS |
| `16e1e1d` | `mode-test` FAIL「practice exam hover: mastery line gold … rgb(45,106,79)」 | `723a5e4` | PASS |

**Amend 核實**：reflog 顯示原本嘅 test commit 係 `3f6b2f5`，之後 amend 成 `62ad550`，**喺** feat `776e395` **之前**。兩者唯一分別係一條 assert：原本用 `!v.wrong.text.includes('per round')` 檢查成個 tile，但新說明本身就有「per round / 每輪」，所以功能做好之後會變成假 Red，永遠唔會轉綠。Amend 將檢查範圍收窄到 `.sub`，邏輯啱。Amend 之後，Red 仍然由其他 assert 觸發（說明唔喺 tile 入面），所以 Red 係真實嘅，冇因為放寬 assert 而失效。

#### `transition: none` 做法

`.exam-btn` 有 `transition: all 0.15s`，`pg.hover()` 之後即刻讀 `getComputedStyle` 有機會讀到過渡中途嘅顏色，test 會時過時唔過。`addStyleTag('*, *::after { transition: none !important; }')` 令 test 讀到最終狀態，只影響 test page，而且同一段 block 結尾有 `pg.reload()` 清走。做法合理，冇遮蓋產品行為（transition 本身唔係規格要求）。

### Review Item ID

掃描 `.proj-docs/reviews/`：W 最高 `W-018`；另一位 reviewer 預留 `S-074` 起同 `W-019` 起。按 brief，本批由 `W-022`、`S-080` 開始：新增 `W-022`、`S-080`…`S-084`。

---

## Section A — 第 1 項：My Review（`62ad550` → `776e395`）

### 改動清單
- `index.html`：刪走 `#myReviewNote`
- `home.js`：`wrongTileSub` / `flaggedTileSub` 改成 `wrongTileBody` / `flaggedTileBody`，回傳 HTML 片段；`renderReviewTile` 參數改名做 `bodyHtml`
- `home.css`：`.my-tile` 改成 `display:flex; flex-direction:column; justify-content:flex-start`；新增 `.t-note`（同 `.sub` 共用規則，`margin-top: 6px`）；`.my-note` 原本嘅 `margin-bottom: 20px` 移去 `.my-grid`
- Locale：`myReviewNote` 文字更新；刪走 `wrongToClearRounds`、`flaggedCount`

### 規格逐條對照

| 規格 | 結果 |
|---|---|
| 說明移入 `#tileWrong` | ✅ `wrongTileBody` 喺 `.sub` 之後輸出 `.t-note` |
| zh-HK 文字 | ✅ `來自練習及模擬考試，於此答對後便會清除。每輪最多 {max} 題。`（逐字一樣） |
| en 文字 | ✅ `From Practice and Exam; cleared once you get them right here. Up to {max} per round.`（逐字一樣） |
| 0 題都顯示說明 | ✅ `.t-note` 唔受 `n` 影響（但見 W-022：顯示咗，可惜對比度唔夠） |
| 副標題只顯示「尚餘 {n} 題」，刪 `wrongToClearRounds` | ✅ en / zh-HK 兩邊都刪咗，冇殘留 call site |
| 已標記 >0 唔顯示副標題，刪 `flaggedCount`；0 題保留提示 | ✅ `flaggedTileBody` 回傳 `''` 或者 `flaggedEmptyHtml` |
| 兩個 tile 等高 | ✅ Grid 預設 `align-items: stretch`；test 喺 390px 驗咗。Reviewer 另外喺 320px 驗咗 en / zh-HK × 30 / 0 題，高度分別係 181/181、197/197、168/168、183/183，`scrollWidth` 等於 320，冇橫向 overflow |

### XSS
`.t-note` 嘅內容係 `t()` 加 `PRACTICE_ROUND_MAX`（常量）；`.sub` 係 `t()` 加 `n`（`keysOf(...).length` 計出嚟嘅數字）；`flaggedEmptyHtml` 加 `bookmarkSvg()`（常量 SVG）。全部係 locale 常量或者數字，冇用戶輸入，安全。

### 發現

#### 🟡 W-022 — 0 題時，錯題說明喺調暗咗嘅 tile 入面，對比度大約只有 2.4:1
- **位置**：`css/screens/home.css` `.my-tile.empty { … opacity: 0.6; }`，配合 `js/screens/home.js` `wrongTileBody`
- **描述**：規格要求 0 題都要顯示說明。說明係顯示咗，但 0 題嘅 tile 會加 `.empty`（`opacity: 0.6`、`disabled`），連帶 `.t-note` 一齊變暗。`--text-muted` `#5a6a8a` 喺白色 `--card` 上面乘 0.6 之後，混色大約係 `#9ca6b9`，對比度約 **2.4:1**，低過 WCAG AA 嘅 4.5:1。截圖 `myreview-zh-HK-0wrong-8flag-390.png` 睇得出明顯淡色。舊版說明放喺 tile 外面，係全對比度（約 5:1），所以呢個係**本次改動引入嘅可讀性 regression**。
- **影響**：用戶未有錯題嘅時候，正正最需要睇呢段說明（理解錯題點樣產生），但呢個時候反而最難睇清楚。WCAG 1.4.3 技術上豁免「非啟用 UI 元件入面嘅文字」，但呢段係說明性內容，唔係掣嘅 label，所以唔應該當係 disabled 文字處理。
- **方案 A**（推薦）：只調暗 tile 嘅其他部分，說明保持全對比度：
  ```css
  .my-tile.empty { cursor: default; border-left-color: var(--border); box-shadow: none; }
  .my-tile.empty > :not(.t-note) { opacity: 0.6; }
  ```
  Trade-off：要將 `opacity` 由 tile 移去子元素；如果 tile 嘅 border 都要淡，需要另外加 border 色。改動細，視覺上同而家幾乎一樣。
- **方案 B**：將 `.t-note` 搬返出 tile 外面，但咁會違反規格（說明要喺 `#tileWrong` 入面），**唔建議**。
- **方案 C**：`.empty` 唔再用 `opacity`，改為逐個元素轉色（`--text-muted` / `--border`）。Trade-off：最乾淨，但改動範圍較大，而且會影響 flagged tile 0 題時嘅樣。
- **Test**：建議喺 `checkMyReviewEmptyIn` 加一條 assert，檢查 `#tileWrong .t-note` 嘅有效 opacity（自己同所有祖先 `opacity` 相乘）等於 1。

#### 🟢 S-082 — 測試覆蓋：My Review 冇 320px assert
- **位置**：`tests/lang-switch-test.js` `checkMyReviewTiles`
- **描述**：Practice hint 有測 320px，但 My Review 嘅等高同冇 overflow 只喺 390px 驗。Reviewer 已經手動驗過 320px 冇問題（數字見上面），但冇 test 守住。
- **方案 A**：喺 `checkMyReviewTiles` 結尾 `setViewportSize(NARROW)` 再行一次 `checkMyReviewIn`（`checkNarrow` 已經有 helper）。**方案 B**：維持現狀，由 QA 截圖覆蓋。推薦 A，成本低。

#### 🟢 S-083 — Test 格式：逗號後面冇空格
- **位置**：`tests/lang-switch-test.js` `checkMyReviewIn` 第 4 條 assert（`…includes(PER_ROUND[lang]),\`${tag}…`）；`tests/mode-test.js` `allHover` assert（`…goldLight),'All Exams hover…`）
- **描述**：兩處 `,` 後面都冇空格，同 repo 其他 assert 唔一致。Amend 嗰陣帶入咗第一處。
- **方案 A**：補返空格。**方案 B**：日後加 Prettier。推薦 A。

#### 🟢 S-084 — zh-HK 說明喺 390px 換行時，「24」同「題。」被拆開
- **位置**：`locales/zh-HK.js` `myReviewNote`（截圖 `myreview-zh-HK-0wrong-8flag-390.png`：「每輪最多 24」換行之後先有「題。」）
- **方案 A**：喺 `.t-note` 加 `text-wrap: pretty;`。屬於漸進增強，唔支援嘅瀏覽器會照舊顯示。**方案 B**：喺 locale 用 U+00A0（直接打字元，唔用 `&nbsp;` entity，因為非 Html key 唔准有 entity）寫成 `{max} 題`。Trade-off：B 一定有效，但字元睇唔到，日後好難 maintain。推薦 A。

### 評分：92 / 100（W-022 −5、S-082 −1、S-083 −1、S-084 −1）　**Status：⚠️ 有 1 個 Warning（唔 block）**

---

## Section B — 第 2 項：Exam 說明（`e04d0fb` → `df9664f`）

- **改動**：`examDescHtml` en / zh-HK 刪走尾句。
- **對照**：zh-HK 刪走「請於下方選擇試卷。」，結尾係「…即可查看分數及答案。」；en 刪走「Pick an exam below.」，結尾係「…see your score and answers.」。✅ 兩邊都冇多餘空格。
- **Test**：en 同 zh-HK 都 assert 冇舊句，而且以指定字串結尾。
- **發現**：冇。
- **評分**：100 / 100　**Status：✅ pass**

---

## Section C — 第 3 項：Practice 說明改為 4 點 `<ul>`（`ca95364` → `ea63e9b`）

### 改動
- `practiceHintHtml` 改成 `<ul><li>…</li>×4</ul>`；`#practiceHint` 由 `<span>` 改成 `<div class="reset-hint reset-hint-list">`
- 新 CSS：`.reset-hint-list { min-width: 0; }`、`.reset-hint-list ul { margin: 0; padding-left: 1.2em; }`

### 對照
| 點 | en | zh-HK |
|---|---|---|
| 1 | Each round draws up to **{max}** unmastered questions, each asked once | 每輪最多抽取 **{max}** 條未掌握的題目，每題出現一次 |
| 2 | Answer a question correctly **{streak} times in a row** to master it | 同一題**連續答對 {streak} 次**即算掌握 |
| 3 | Unmastered questions come back in the next round | 未掌握的題目會於下一輪再出現 |
| 4 | Mastered questions are skipped until the whole set is mastered | 已掌握的題目會略過，直至整組全部掌握 |

- 每點句尾都冇句號 ✅（test 用 `/[。.]$/` 守住）。
- ⚠️ **核對限制**：brief 冇附用戶原文逐字文本。Reviewer 只可以確認 locale、test oracle（`PRACTICE_HINT_ITEMS`）同截圖三者一致。**Main agent 喺 Visual Confirmation Gate 要拎用戶原文逐字對一次**，特別係第 1 點 zh-HK 用「條」（沿用舊文字），唔係「題」。
- **i18n-test 規則**：Markup 只出現喺 `…Html` key ✅；zh-HK 嘅 tag 次序同 en 完全一樣 ✅；`i18n-test` PASS。
- **XSS**：`innerHTML` 只插入 locale 常量加 `MASTERY_STREAK` / `PRACTICE_ROUND_MAX` 兩個常量，安全 ✅。
- **span → div**：`.reset-hint` 規則冇 tag selector；`grep` 搵唔到 `span.reset-hint` 或者 `span#practiceHint`。JS 只用 `byId('practiceHint').innerHTML`；`batch-test` 同 `mastery-test` 用 `textContent.includes(...)`，同 tag 無關，兩個都 PASS。`<ul>` 唔可以放喺 `<span>` 入面（HTML content model 唔容許），所以改成 `div` 係必要嘅 ✅。
- **320px**：`min-width: 0` 令 hint 可以縮細，「重設進度」掣保持喺右邊（test assert `rightOfHint`，截圖 `practicehint-zh-HK-320.png` 亦確認）✅。
- **發現**：S-081（見下）。
- **評分**：99 / 100　**Status：✅ pass**

#### 🟢 S-081 — 新增 spacing literal（`6px`、`20px`、`1.2em`）
- **位置**：`.my-tile .t-note { margin-top: 6px }`、`.my-grid { margin-bottom: 20px }`（由 `.my-note` 搬過嚟，唔係新值）、`.reset-hint-list ul { padding-left: 1.2em }`
- **描述**：CSS skill §1 要求 spacing 用 token，但 `tokens.css` 根本冇 spacing token，成個 codebase 嘅 padding / margin 都係 px literal（例如 `.exam-btn { padding: 10px 6px }`）。所以呢度唔算違規，只係順住 repo 現有做法。`1.2em` 跟字號縮放，用 `em` 啱。
- **方案 A**：維持現狀，等日後統一加 `--space-*` token 再一次過遷移。**方案 B**：今次就加 token。推薦 A，因為單獨引入 token 會造成兩套寫法並存。

---

## Section D — 第 4 項：離開 modal 取消掣（`d4291e9` → `f5123e3`）

- **改動**：`exam.leaveCancel`：en `Stay` → `Cancel`；zh-HK `留下` → `取消` ✅。
- **Test**：`examtools-test` 更新舊 oracle 同 assert 文字；`lang-switch-test` 新增 `checkLeaveCancel`，覆蓋 en / zh-HK，仲驗按「取消」之後留喺考試畫面。Default focus 仍然喺 `#confirmCancel`（v0.60 destructive 規則）✅。
- **發現**：冇。
- **評分**：100 / 100　**Status：✅ pass**

---

## Section E — 第 5 項：Exam 模式已完成嘅掣 hover（`7565a4b` → `a4cec47`）

### 改動
```css
.exam-btn.done:hover { background: var(--green); border-color: var(--green); color: var(--text-inverse); }
.exam-btn.done:hover::after { background: var(--card); color: var(--green); box-shadow: 0 0 0 1.5px var(--green); }
```

### Specificity / 次序
- `.exam-btn.done:hover`（0,3,0）高過 `.exam-btn.done`（0,2,0）同 `.exam-btn:hover`（0,2,0），所以綠底白字一定生效 ✅。
- 未完成嘅掣：只受 `.exam-btn:hover`（navy 底白字）影響，test 有 assert `open.bg === navy` ✅。
- `.exam-btn.all`：從來唔會有 `.done`（`home.js` 只喺 exam 編號掣加 `doneCls`），所以唔受影響 ✅。
- `.done` 只喺 Exam 模式出現（`!isPractice && done[n]`），所以同第 6 項嘅 mastery 規則永遠唔會同時作用（CSS comment 有寫明）✅。
- 截圖 `exam-done-hover-en-390.png`：hover 中嘅 Exam 1 係綠底白字，✓ badge 反色成白底綠剔加綠圈，睇得清楚；冇 hover 嘅 Exam 2 保持原樣 ✅。

### 冇 hardcoded 顏色
全部用 `var(--green)`、`var(--card)`、`var(--text-inverse)` ✅。

#### 🟢 S-080 — `box-shadow: 0 0 0 1.5px` 嘅 1.5px 算唔算 magic number？
- **判斷**：**唔算 Warning**，記做 Suggestion。`1.5px` 係 repo 一貫嘅細邊寬度（`buttons.css`、`chips.css`、`dots.css`、`.reset-btn`、`layout.css` 全部用 `1.5px solid`），呢度用嚟畫 badge 嘅外圈，同其他元件嘅邊框一致；`tokens.css` 冇 border-width token。`fact.css` 已經有先例，將佢抽成元件級 custom property（`--fact-btn-border: 1.5px`）。
- **方案 A**（推薦）：跟 `fact.css` 做法，喺 `.exam-btn.done::after` 定義 `--exam-badge-ring: 1.5px`，然後寫 `box-shadow: 0 0 0 var(--exam-badge-ring) var(--green)`。意圖清楚啲，亦方便日後統一。
- **方案 B**：維持 literal，等全局加 `--border-thin` token 先一次過處理。Trade-off：A 多一行，B 冇即時成本。
- **評分**：99 / 100　**Status：✅ pass**

---

## Section F — 第 6 項：Practice 模式 Exam 掣 hover（`16e1e1d` → `723a5e4`）

### 改動
```css
.exam-btn:hover .exam-mastery { color: var(--gold-light); }
.exam-btn:hover .exam-mastery.zero { color: var(--text-inverse-muted); }
```

### 同存檔 mockup 比較
`git show c6d98e2:mockups/exam-hover.html` 第 31–32 行方案 A：`.a .hv .exam-mastery { color: var(--gold-light); }` 同 `.a .hv .exam-mastery.zero { color: var(--text-inverse-muted); }`。實作嘅顏色同 selector 結構完全一樣（`.hv` 對應 `:hover`）✅。

### Specificity
- `.exam-btn:hover .exam-mastery`（0,3,0）高過 `.exam-btn .exam-mastery`（0,2,0，綠色）✅。
- `.exam-btn:hover .exam-mastery.zero`（0,4,0）高過 `.exam-btn .exam-mastery.zero`（0,3,0）同 `.exam-btn:hover .exam-mastery`（0,3,0）✅。
- `.exam-btn.all`：原本已經有 `.exam-btn.all .exam-mastery`（gold-light）同 `.zero`（inverse-muted），同 hover 規則嘅值一樣，所以 hover 前後都冇變化。Test 有 `allHover` assert ✅。
- 冇 hover 時：綠色或 muted（0%）不變，test 有 `someIdle` / `noneIdle` assert，冇 regression ✅。
- 截圖 `practice-exam-hover-mastery-en-390.png`：hover 中嘅 Exam 1 係 navy 底、金色「6/24 · 25%」；其他掣冇變 ✅。
- **發現**：S-083（`allHover` assert 格式，見 Section A）。
- **評分**：99 / 100　**Status：✅ pass**

---

## 評分結果（整體）

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 20 | 25 | W-022（0 題時說明對比度 regression）−5 |
| 安全性 | 20 | 20 | `innerHTML` 只插入 locale 常量同數字 |
| 可維護性 | 18 | 20 | S-080 −1、S-081 −1 |
| 測試覆蓋 | 14 | 15 | S-082 −1；Red 全部真實，en / zh-HK 都有覆蓋 |
| 性能 | 10 | 10 | — |
| 代碼風格 | 8 | 10 | S-083 −1、S-084 −1 |
| **總分** | **90** | **100** | |

**結果：✅ pass**（hard gates 全過、冇 Critical、總分 ≥ 90）

## 函數長度 / magic number
- `wrongTileBody` 3 行、`flaggedTileBody` 1 行、`renderMyReview` 5 行、`renderReviewTile` 5 行，全部 ≤ 30 ✅。
- 新 test helper（`checkMyReviewIn`、`checkPracticeHintIn` 等）全部 ≤ 30 行；數字已抽成具名常數（`MY_REVIEW_WRONG_N`、`EXAM_SIZE`、`POINT_END_STOP` 等）✅。
- JS 冇新 magic number；CSS 嘅 literal 見 S-080 / S-081。

## Design Fidelity

| 項目 | Origin | 結果 |
|---|---|---|
| 1 My Review | baseline | ✅ 改動冇超出規格嘅 delta；className（`.my-tile`、`.sub`）保留，只新增 `.t-note` |
| 2 Exam 說明 | baseline | ✅ 只改文字 |
| 3 Practice 說明 | baseline | ✅ 新增 `.reset-hint-list`；`.reset-hint` 保留 |
| 4 離開 modal | baseline | ✅ 只改文字 |
| 5 完成掣 hover | baseline | ✅ 全部用 token，冇 hardcoded 顏色 |
| 6 Practice exam hover | mockup（已存檔） | ✅ 同 `c6d98e2:mockups/exam-hover.html` 方案 A 逐字一樣 |

### PR Design Origin 建議寫法

`global-rules.md §Design-Source Binding` 規定「`mockup:` 但路徑唔存在 → reject」。`mockups/exam-hover.html` 喺 HEAD 已經唔存在（`acc807c` 刪走咗），所以**唔可以照 brief 寫 `mockup: mockups/exam-hover.html`**，否則按規則要 reject。建議喺路徑加 commit pin，等 reviewer 可以用 `git show` 打開：

```
Design Origin: baseline: css/screens/home.css + index.html + locales/*.js (items 1–5, user spec 2026-10-07); mockup: mockups/exam-hover.html@c6d98e2#方案 A (item 6; file removed in acc807c after the user chose option A)
```

第 4 項只改 locale，其實可以標 `none-required`，但同一個 PR 混用三種 origin 會好亂，而且文字改動嚴格嚟講都係視覺變化，所以統一歸入 `baseline:` 比較清楚。

## ✅ 做得好嘅地方
- Amend 嗰個 test commit 修正咗一個「功能做好之後永遠唔會轉綠」嘅 assert，而且喺 feat commit 之前完成，冇破壞 TDD 次序。
- CSS comment 解釋咗「點解」：`.done` 嘅 specificity 高過 `:hover`；`.done` 同 mastery line 永遠唔會同時出現；`<button>` 預設會將內容垂直置中。全部係有價值嘅 WHY comment。
- Hover test 用 `tokenRgb()` 由 token 計出期望值，唔係 hardcode RGB，日後改 token 都唔使改 test。
- `checkMyReviewIn` 用 `compareDocumentPosition` 驗說明喺 `.sub` 下面，再加 `outside.length === 0` 防止說明殘留喺 tile 外面，覆蓋得好完整。
- `span` 改 `div` 係 HTML content model 嘅要求，developer 有處理，冇留低無效嘅 markup。

## 修正優先順序

| 優先 | Item | 建議 |
|---|---|---|
| 1 | W-022 | v0.68 release 前修（方案 A，另加 opacity assert） |
| 2 | S-082 | 順手加 320px assert |
| 3 | S-083 | 補空格 |
| 4 | S-080、S-081、S-084 | 可選 |

## 已知未處理（QA 階段處理，唔計 fail）

Brief 提到 QA script v065 第 142 / 395 行。喺 HEAD `6078999` 實際行號同 brief 唔一樣，而且受影響嘅 oracle 比 brief 多。全部列出：

| 檔案:行 | 過時 oracle | 原因 |
|---|---|---|
| `qa-v065.js:159` | `'即算掌握。每輪最多抽取'` | 第 3 項：句子拆成 `<li>`，次序亦改咗 |
| `qa-v065.js:160` | examDesc `…請於下方選擇試卷。` | 第 2 項 |
| `qa-v065.js:162` | `'錯題來自練習及模擬考試，…'` | 第 1 項：新文字 |
| `qa-v065.js:258` | `'已標記 2 題'` | 第 1 項：刪走 `flaggedCount` |
| `qa-v065.js:289` | `'尚餘 30 題 · 每輪 24 題'`、`'已標記 30 題'` | 第 1 項 |
| `qa-v065.js:413` | Leave modal `'留下'` | 第 4 項 |
| `qa-v065.js:829` | upgrade `'已標記 1 題'` | 第 1 項 |
| `qa-v066.js:491` | upgrade `home.includes('已標記 1 題')` | 第 1 項 |

（`qa-v065.js:304` 嘅「已標記 30 題中的 24 題」係 round note，唔受影響；`:418` 嘅「已標記 1 題」喺 submit modal，用另一個 key，唔受影響。）

## 修訂後代碼（W-022 方案 A 範例）

```css
/* css/screens/home.css */
/* W-022: dim the empty tile's own parts, not the wrong-answers note (it must stay readable at 0) */
.my-tile.empty { cursor: default; border-left-color: var(--border); box-shadow: none; }
.my-tile.empty > :not(.t-note) { opacity: 0.6; }
```

```js
// tests/lang-switch-test.js — checkMyReviewEmptyIn: the note is not faded with the empty tile
const noteOpacity = await pg.$eval('#tileWrong .t-note', e => {
  let o = 1;
  for (let n = e; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
  return o;
});
assert(noteOpacity === 1, `${tag}: 0 wrong → note keeps full opacity: ${noteOpacity}`);
```

---

## Handoff receipt

```handoff-receipt
protocol: 1
status: pass
score: 90/100
batch:
  - item: 1 My Review
    commits: [62ad550, 776e395]
    status: pass (1 warning W-022)
    score: 92/100
  - item: 2 Exam desc
    commits: [e04d0fb, df9664f]
    status: pass
    score: 100/100
  - item: 3 Practice hint list
    commits: [ca95364, ea63e9b]
    status: pass
    score: 99/100
  - item: 4 Leave modal Cancel
    commits: [d4291e9, f5123e3]
    status: pass
    score: 100/100
  - item: 5 Exam done hover
    commits: [7565a4b, a4cec47]
    status: pass
    score: 99/100
  - item: 6 Practice exam hover
    commits: [16e1e1d, 723a5e4]
    status: pass
    score: 99/100
merge: 9698ea8
design_origin: "baseline: css/screens/home.css + index.html + locales/*.js (items 1–5); mockup: mockups/exam-hover.html@c6d98e2#方案 A (item 6; removed in acc807c) — do NOT write the bare path, it does not exist at HEAD"
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
  warning: [W-022]
  suggestion: [S-080, S-081, S-082, S-083, S-084]
next_action: merge_develop
blockers: []
```
