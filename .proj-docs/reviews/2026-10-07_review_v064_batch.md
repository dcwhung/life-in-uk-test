# Batch Review — 2026-10-07 — v0.64（CUI-0011 / S-034 / S-031）

- **審閱者**：Code Reviewer（獨立）
- **Branch**：`claude/intelligent-lovelace-zczz0o` HEAD `8288897`
- **Range**：`984d374..HEAD`（984d374 = v0.63 main）
- **涵蓋 commit**：`0c185c7`（Red test）、`99835dd`（CUI-0011 fix）、`7e60643`（S-034）、`ed44f5c`（S-034 截圖）、`7e1c46a`（S-031）、`b0bd4fd` / `16813eb` / `6dbb8d2`（merge Lane C / A / B）、`8288897`（bump 0.64 + HANDOFF）
- **總評**：三個 fix 都做得乾淨，冇 🔴 Critical，tests 29/29。CUI-0011 嘅 guard 設計（view = active screen + `state.questions`、40px slop、只限 pointer click）我逐個情境驗過，冇誤擋正常用戶操作。主要發現係 **W-012**：喺測試環境 390px 寬度，S-034 令 13 張 Study fact 卡嘅來源列由 1 行變 2 行（+27px），超出用戶睇截圖時以為嘅「+1–2px」。

---

## 整體 verdict

### Hard Gates

| Gate | 結果 | 證據 |
|---|---|---|
| Lint | n/a | 項目冇 ESLint（純 vanilla JS，冇 build tool）；`structure-test` 已經做緊 lint 類檢查（inline handler、function ≤ 30 行、token 顏色、layering）→ PASS |
| Type check | n/a | 冇 TypeScript |
| Tests | ✅ pass | `NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium ./tests/run-all.sh` → **29 / 29 PASS**（新增 `doubletap-test`） |
| Coverage | n/a | 冇 coverage 工具；行為覆蓋見各 Section |
| No Critical | ✅ pass | 🔴 = 0 |
| Security scan | n/a | 冇新增依賴 |
| TDD Red | ✅ 已驗 | Checkout `0c185c7`（fix 之前）跑 `doubletap-test` → `FAIL: Study ▶ Practise: mouse double click leaves Q1 unanswered … {"answered":1,"revealed":1,"streak":"{\"4.16\":0}","wrong":"{\"4.16\":true}"}`，同 commit message 記錄一致 |
| Visual diff | ⚠️ 預期內 + 1 個未披露 | `node tests/tools/visual-diff.js 984d374` → 23 799 個 diff / 76 個 state。**style diff 全部只係** `font-family`（4 565）同佢帶出嚟嘅尺寸 / 位置屬性（`block-size` / `height` / `inline-size` / `width` / `*-origin` / `top` / `grid-template-rows`）；冇 color / padding / border / weight / size diff，冇 text diff。Box diff：掣高 +0–2px、grid 累積 +5–12px、選項 +3–4px，**但 390px Study 有 13 張卡來源列換行（+27px，見 W-012）**。跑完已經用 `git checkout -- 'tests/*.png'` 還原，未追蹤 png 已刪，`git status` 乾淨 |

### 評分總覽

| Fix | Score | Status |
|---|---|---|
| A — CUI-0011 double-tap guard | 97 / 100 | ✅ pass |
| B — S-034 form control font-family | 95 / 100 | ✅ pass（W-012 要用戶知情） |
| C — S-031 node helper → components/tags | 99 / 100 | ✅ pass |
| D — Merge + bump 0.64 | 99 / 100 | ✅ pass |
| **整體** | **97 / 100**（參考值；以個別 score 為準） | **✅ pass** |

---

## Section A — CUI-0011：double tap guard（`0c185c7`、`99835dd`）

### 改動清單
- `js/core/actions.js`：`runClickAction` / `isStrayClick` / `currentView` / `sameView` / `isPointerClick`、top-level `let guard`
- `js/core/config.js`：`SCREEN_CHANGE_CLICK_GUARD_MS = 350`、`DOUBLE_TAP_SLOP_PX = 40`
- `tests/doubletap-test.js`（新）、`tests/run-all.sh`

### 重點驗證（caller 指定）

| 問題 | 結論 | 證據 |
|---|---|---|
| 快速撳選項再撳 Next | ✅ 唔受影響 | `selectOption` / `nextQ` 冇換 screen，亦冇換 `state.questions` → 唔會 arm。`doubletap-test` `checkSameScreenRepeat`：Exam 快撳 Next ×2、選項 + Next、← ×2 全部生效 |
| 結果頁 | ✅ 合理 | Finish ✓ / Submit（modal 確認）→ result 會 arm；結果頁同一點 350ms 內嘅第二下會被食。呢個就係 double tap 本身，屬預期保護 |
| Study tab 切換 | ✅ 唔受影響 | `studySetTab` / `studySetChapter` / chip 唔換 screen → 唔 arm |
| Flagged unflag | ✅ 唔受影響（實際上） | `unflagFromList` 同一 screen → 唔 arm。唯一會擋嘅情況：首頁撳「Flagged」之後 350ms 內喺同一點（40px 內）撳 unflag，現實唔會係刻意操作 |
| `state.questions` identity 幾時變 | 已核實 | 只有兩個地方：`startExam()`（`quiz.js:43` 每次 `sessionQuestions()` 都產生新 array）同 `state = …`（`sideSession.js:34` 開臨時 session、`:45` ↩ Back 換返原本 state）。`renderQuestion` / `nextQ` / `selectOption` / `goToQuestion` 唔會改佢。Probe：Similar「Practise these N」→ `isSideSession()=true`、guard 已 arm、同一點再撳 → `answers` 仍然係 0 ✅ |
| Timer 自動交卷 / code 換 view | ✅ 會失效 | Probe：click 開 Exam（guard 喺 `screenQuiz`）→ `finishExam()`（模擬 timer）→ 而家係 `screenResult`，`isStrayClick` 喺同一點返 `false` ✅（`sameView` 唔一樣） |
| 鍵盤 / `el.click()` / confirm modal | ✅ | `detail === 0` 唔 arm 亦唔擋；`el.closest('#confirmModal')` 豁免。`doubletap-test` `checkKeyboard` / `checkModal` 有覆蓋 |
| v0.63 QA 重現（E9） | ✅ 已修 | 用 `.proj-docs/qa/scripts/2026-10-07_qa-v063.js` 重跑：E9 390 touch / 390 mouse / 900 mouse，5 個高度位置全部 `answered: 0`（之前 4 個 fail） |
| 負數時間差 | ✅ 有必要 | Instrument 咗 `isStrayClick`：真 `dblclick` 第二下 `dt = -2ms`（第二下喺第一下 handler 行緊時已排隊），所以「負數都算」唔可以拎走（但見 S-035） |

### 發現

#### 🟢 S-035 — 負數時間差冇下限，`guard.at` 用 `performance.now()` 而唔係第一下嘅 `e.timeStamp`
- **位置**：`js/core/actions.js:81`、`:88`
- **描述**：`e.timeStamp - guard.at < SCREEN_CHANGE_CLICK_GUARD_MS` 對任何負數都成立。`guard.at` 係 action 行完先記低嘅 `performance.now()`，所以要靠負數 case 去捉排隊中嘅第二下。如果有瀏覽器 / webview 俾嘅 `timeStamp` 唔可靠（例如 0），guard 喺同一 view 會變成永久擋住呢個 40px 範圍，直到 view 改變為止（會 fail-closed）。
- **影響**：而家嘅目標瀏覽器（iOS Safari、Chromium）都係 high-res `timeStamp`，所以風險低；但呢個係唯一一個會 fail-closed 嘅路徑。
- **方案 A**：記第一下嘅 `e.timeStamp`，比較兩下 tap 之間嘅真實時間差：`at: e.timeStamp`，條件 `const dt = e.timeStamp - guard.at; return near && dt >= 0 && dt < MS;`。語意最準（double tap 間隔），亦唔使靠負數 case。Trade-off：handler 慢嘅時候（Study 開 236 張卡），guard 時間窗唔會再延長。
- **方案 B**：保留 `performance.now()`，加下限：`dt > -SCREEN_CHANGE_CLICK_GUARD_MS && dt < SCREEN_CHANGE_CLICK_GUARD_MS`。改動最細。
- **推薦**：A。

#### 🟢 S-036 — top-level 名太通用（`guard`、`currentView`、`sameView`）
- **位置**：`js/core/actions.js:71-75`
- **描述**：classic script 共用同一個 global lexical scope。將來任何 file 有 top-level `let guard` / `const currentView`，成個 script 會 `SyntaxError: Identifier has already been declared`（`upgrade-test` 都撞過同類問題）。
- **方案 A**：改成有前綴嘅名，例如 `doubleTapGuard`、`clickView`、`isSameClickView`。
- **方案 B**：收埋喺一個 object 入面：`const DoubleTap = { guard: null, view() {…}, … }`。
- **推薦**：A（同現有風格一致）。

#### 🟢 S-038 — `doubletap-test` 未覆蓋 HANDOFF 講到嘅兩個行為；輸出 label 唔一致
- **位置**：`tests/doubletap-test.js`
- **描述**：(1) HANDOFF 寫明「Similar『Practise these N』/ ↩ Back 換 session 都算」同「view 由 code 換走（timer、`evaluate`）就失效」，但測試冇覆蓋（我用 probe 驗咗兩樣都正確）。(2) 最後印 `PASS`，其他 28 套都係 `XXX PASS`（例如 `STRUCTURE PASS`）；`run-all.sh` 用 `*PASS*` match，所以唔影響 gate。
- **方案 A**：加兩個 case：Similar 掣 dblclick → `isSideSession()` 而且 side Q1 未答；click 開 Exam → `finishExam()` → 同一點即刻撳 `.retry-btn` / review 會生效。印 `DOUBLETAP PASS`。
- **方案 B**：只改 label，喺 HANDOFF 註明呢兩個行為係 probe 驗證，冇自動化測試。
- **推薦**：A。

### 評分

| 維度 | 得分 | 滿分 | 備注 |
|---|---|---|---|
| 正確性 | 24 | 25 | S-035 |
| 安全性 | 20 | 20 | |
| 可維護性 | 19 | 20 | S-036 |
| 測試覆蓋 | 14 | 15 | S-038 |
| 性能 | 10 | 10 | 每次 click 一次 `querySelector`，可以忽略 |
| 代碼風格 | 10 | 10 | |
| **總分** | **97** | **100** | **✅ pass** |

---

## Section B — S-034：form control 繼承 `font-family`（`7e60643`、`ed44f5c`）

### 改動清單
- `css/base/layout.css`：`button, input, select, textarea { font-family: inherit; }`
- `tests/structure-test.js`：檢查 Home / Practice 題目 / Study 每個 control 嘅 `font-family` 都等於 `body`
- `.proj-docs/screenshots/…v064_s034_*`（before / after 截圖 ×5）

### 重點驗證

| 項目 | 結論 |
|---|---|
| Hit area — CUI-0009（fact 掣）/ S-030（Practise ring）/ S-022（install ✕） | ✅ 冇變。`.fact-btn`、`.install-close` 係固定尺寸；`.fact-practise` 高度維持 29px（box diff 只有闊度 +0–3.3px）；`::before` inset 用 token 計，同字體無關。`study-test` / `pwa-test` 嘅逐 px hit-area assertion 全部 PASS |
| Quick nav / dots / flag | ✅ `#quickPrev`、`#quickNext`、`#navDots .dot`、`#resultDots`、`#flagBtn`、`.reset-btn` box diff 係 0 |
| 其他掣 | `.nav-btn` / `.back-btn` / `.study-tab` / chips +1px，`.chapter-btn` / `.exam-btn` +1–2px，冇掣變矮，同 HANDOFF 講嘅一致 |
| Overflow / 換行 | ⚠️ 掣本身冇換行（`.chip`、`.nav-btn`、`another-btn` 闊度 ±3.4px，都喺原本 row 入面）；**但 Study 來源列有換行，見 W-012** |
| `structure-test` 新 assertion | ✅ 正確：比較 computed `font-family` 同 `body`，涵蓋 3 個 screen 所有 rendered control。Result / Flagged / modal 冇點名，但規則係全局 selector，風險低 |
| 選擇 `font-family` 唔用 `font` shorthand | ✅ 理由正確（`#flagBtn` / `#infoBtn` 冇自己嘅 size / weight），HANDOFF 有記錄 |

### 發現

#### 🟡 W-012 — 390px：13 張 Study fact 卡嘅來源列由 1 行變 2 行（+27px），未向用戶披露
- **位置**：`css/base/layout.css:13`（成因）× `css/components/fact.css:70-77`（`.fact-src-nodes` `flex: 1` + `.fact-practise` `white-space: nowrap`）
- **描述**：Body font 喺測試環境（Linux Chromium）比 Arial 闊，「▶ Practise these 2」闊咗約 2.8px，`.fact-src-nodes` 由 188.3 縮到 185.5px，第二粒 node 擠落第二行。我用 Playwright 量度（同一頁注入 `font-family: Arial` 做對照）：受影響嘅 fact id 有 **25、30、62、67、74、76、78、128、155、159、181、225、231**（全部係 2 個來源、冇 `wrap-btn`），`.fact-src-nodes` 高度 22 → 49px。900px 冇影響。v0.63 已經有部分 2–3 node 嘅卡會換行（49→49，例如 studyChapters 有 27 張），所以呢個唔係新嘅版面狀態，但數量多咗。
- **影響**：用戶係因為「+1–2px」先接受截圖；HANDOFF v0.64 都寫「單行掣高咗 1–2px」。`study_after.png` 係 2.7MB 全頁截圖，好難睇到呢種差異。實際裝置上：iOS Safari 嘅 UA button 字體本身已經係 system font，所以 iPhone 可能冇變；Linux / 部分 Android 會受影響。暫時未有實機證據。
- **方案 A**：維持 code，向用戶展示 fact #25 嘅 before / after 裁切圖，經確認之後喺 HANDOFF S-034 段補一句「390px：2 個來源嘅 fact 卡，部分來源列換行（+27px）」。Trade-off：零 code 改動，但版面較長。
- **方案 B**：喺 `fact.css` 收窄 `.fact-practise` 左右 padding（`6px 12px` → `6px 10px`，大約慳返 4px），或者 `.fact-src` `gap` 6 → 4px，抵銷闊咗嘅 2.8px。Trade-off：要再跑 visual-diff，而且 padding 改咗之後 S-030 ring 註釋入面嘅數字要同步更新（ring 只計上下，高度唔變）。
- **推薦**：A（先問用戶）；如果用戶唔接受就做 B。唔需要 block merge。

### 評分

| 維度 | 得分 | 滿分 | 備注 |
|---|---|---|---|
| 正確性 | 20 | 25 | W-012 |
| 安全性 | 20 | 20 | |
| 可維護性 | 20 | 20 | 註釋清楚交代點解唔用 shorthand |
| 測試覆蓋 | 15 | 15 | 新 assertion 有效 |
| 性能 | 10 | 10 | |
| 代碼風格 | 10 | 10 | |
| **總分** | **95** | **100** | **✅ pass** |

### Design Fidelity
- Origin：`baseline`（S-034 由 v0.63 review 開出，用戶睇 before / after 截圖確認）。改動範圍限於 family，冇 className、layout、token 變動；冇 hardcoded 顏色。唯一偏離係 W-012（換行），屬於 delta 披露不足，唔係違反 spec。

---

## Section C — S-031：node helper 搬去 `components/tags.js`（`7e1c46a`）

### 改動清單
- `js/components/tags.js`：新 `questionNodeClass` / `questionNodeText` / `questionNodeHtml`（內容同原本 `similarNode*` 逐字一樣，只係改名）
- `js/screens/similarPanel.js`：刪舊 helper，`similarMapHtml` 改用新名
- `js/components/factCard.js:52`：改用 `questionNodeHtml`
- `tests/structure-test.js`：layering 守衛

### 重點驗證
- **HTML 不變**：`index.html` 唔喺 diff；visual-diff 冇任何 `.sqm-node` / `.sqm-map` text 或 class diff ✅
- **殘留舊名**：`js/`、`tests/`、`index.html` 已經冇 `similarNode*`；只剩 `HANDOFF.md` 歷史記錄（有標「v0.63 叫 …」）同 `mockups/study-unify.html`（設計稿，可以接受）
- **依賴方向**：`questionNode*` 用嘅 `streakOf`（domain）、`questionByKey`（domain）、`t`（core）、`MASTERY_STREAK`（config），全部喺 components 之前載入 ✅
- **守衛正確性**（喺 scratchpad 複製 repo，逐個 mutation 試）：

| Mutation（加落 `tags.js`） | 結果 | 判斷 |
|---|---|---|
| `` `${renderStudy()}` ``（template 入面 call） | FAIL ✅ | 正確捉到 |
| `'renderStudy'`（普通字串） | pass ✅ | 正確忽略 |
| `/* renderStudy() */`（block comment） | FAIL | false positive（會大聲 fail，安全） |
| `function zz6(state)`（參數同 screen global 同名） | FAIL | false positive（`state` / `study` 呢類通用名） |
| `const u = 'http://x'; return renderStudy();` | **pass ✗** | **false negative**：`//.*$` 由字串入面嘅 `//` 開始，連同行後面嘅 code 一齊刪走 |
| `window.renderStudy()` | **pass ✗** | false negative：lookbehind 排除咗 `.` |

#### 🟢 S-037 — layering 守衛有兩個 false negative
- **位置**：`tests/structure-test.js:101-103`（同 v0.63 `factCardCode` 嘅 strip 一樣有呢個問題，`:91`）
- **描述**：見上表。而家 `js/components/*.js` 冇 URL 字串（已經 grep 過），所以未出事；不過 SVG `xmlns="http://…"` 好容易加入 `icons.js`。
- **方案 A**：先 blank 字串，再 strip comment，而且 comment regex 要求 `//` 前面唔係 `:`：`.replace(/'[^'\n]*'|"[^"\n]*"/g, …).replace(/(^|[^:])\/\/.*$/gm, '$1')`；另外加 `/\/\*[\s\S]*?\*\//g`。`window.X` 加 `(?<![\w$]|(?<!window)\.)` 或者另外 match `window\.${n}`。
- **方案 B**：用 `node:vm` / `acorn`（`/opt/node-tools` 有冇要先查）parse 成 AST 再搵 Identifier。最準，但多咗依賴。
- **推薦**：A。

### 評分

| 維度 | 得分 | 滿分 | 備注 |
|---|---|---|---|
| 正確性 | 25 | 25 | |
| 安全性 | 20 | 20 | |
| 可維護性 | 20 | 20 | 命名清楚、註釋交代點解喺 components |
| 測試覆蓋 | 14 | 15 | S-037 |
| 性能 | 10 | 10 | |
| 代碼風格 | 10 | 10 | |
| **總分** | **99** | **100** | **✅ pass** |

---

## Section D — Merge + bump（`b0bd4fd`、`16813eb`、`6dbb8d2`、`8288897`）

- 3 個 merge 都係 `--no-ff`，parent 正確（Lane C → A → B 依次 merge 入 `ed44f5c` / `16813eb`）；merge 冇 conflict 殘留（grep `<<<<<<<` = 0）
- `APP_VERSION = '0.64'`（`js/core/config.js:5`）；`sw.js` cache 名跟版本 → `lifeuk-v0.64`。冇新 file，所以 SHELL / `LATE_BOOT_SCRIPTS` 唔使改 ✅
- HANDOFF：File 表（layout.css / actions.js / components / tests 29 套）、data-action 慣例（double tap guard）、Design tokens（S-034）、Study 來源列（`questionNodeHtml`）、tests 表（`doubletap-test`、`structure-test`）、版本記錄 v0.64 行全部同 code 一致 ✅；例外係 S-034 嗰段冇提 W-012
- Ticket `CUI-0011` 喺 `in-progress`（`pending` → `in-progress` rename）。等 QA 驗證完先搬去 completed，由 main agent / QA 負責

#### 🟢 S-039 — v0.63 QA script 要配合 guard 更新（另有一個本身就 flaky 嘅 check）
- **位置**：`.proj-docs/qa/scripts/2026-10-07_qa-v063.js`
- **描述**：(1) 喺 v0.64 重跑，`cui0010` section 會 throw（`#opt1` not visible）。Instrument 之後確認係 guard 食咗 script 嘅 click：步驟 (c) `dblclick` 之後 48ms 內 `pg.click('#opt3')` 落喺同一點；步驟 (e) ↩ Back（pointer click arm 咗 Study）之後 52ms 內 `pg.click('.fact-practise')` 剛好喺 40px 內。兩個都係比人手快好多嘅自動化操作，同 double tap 分唔開，所以**唔係產品 bug**；HANDOFF 已經寫明測試要等 guard。(2) `boot` section「Similar Core Fact styled」喺 984d374（v0.63）同 HEAD 都會隨機 fail（每次 3 個 shell 入面有 1–2 個 `null`；`startExam(4)` 隨機抽到嘅題目可能冇 Similar），同今次改動無關。
- **方案 A**：script 入面換 screen 之後嘅 click 前加 `await sleep(SCREEN_CHANGE_CLICK_GUARD_MS + 50)`；Core Fact check 用 seed，或者直接揀一條有 similar 嘅 key。
- **方案 B**：QA 下次寫 v0.64 script 時一併處理，v0.63 script 當歷史記錄唔改。
- **推薦**：B。喺 QA handoff 提醒就夠。

#### 🟢 S-040 — `HANDOFF.md` 第 1 行標題仍然係「(v0.59)」
- 喺 v0.63 之前已經係咁，今次冇引入。建議下次 bump 時改成 `(v0.64)`，或者刪走標題入面嘅版本號。

### 評分
| 維度 | 得分 | 滿分 | 備注 |
|---|---|---|---|
| 正確性 | 25 | 25 | |
| 安全性 | 20 | 20 | |
| 可維護性 | 19 | 20 | S-040 |
| 測試覆蓋 | 15 | 15 | |
| 性能 | 10 | 10 | |
| 代碼風格 | 10 | 10 | |
| **總分** | **99** | **100** | **✅ pass** |

---

## ✅ 做得好嘅地方（跨 fix 通用）

- **CUI-0011 嘅設計判斷好成熟**：唔係單純用時間 guard（commit 記錄咗純時間 guard 會令 10 套測試 fail，即係真用戶都會中），而係用 view identity 加位置 slop 收窄範圍；用 `state.questions` identity 去覆蓋「同一 screen 換 session」，呢個位好容易漏。
- **TDD 紀律**：Red commit 獨立，而且附上真實 fail 輸出；Red test 刻意將掣捲到同選項 A 同一高度，確保重現條件真實。
- **S-034 揀咗 `font-family` 而唔係 `font: inherit`**，仲喺註釋同 HANDOFF 寫埋原因同反例（`#flagBtn` 13.33 → 11px）。
- **S-031 唔只搬 code，仲加咗結構守衛**，令同類分層錯誤之後會自動 fail。
- HANDOFF 同步得非常完整。

## 整體建議 / 修正優先順序

| 優先 | ID | 動作 | Block merge？ |
|---|---|---|---|
| 1 | W-012 | 向用戶展示 fact #25 嘅 before / after（390px）並取得確認；確認後補 HANDOFF；唔接受就做方案 B | 否（用戶決定） |
| 2 | S-035 | `guard.at = e.timeStamp` + `dt >= 0` | 否 |
| 3 | S-037 | 修 strip 次序 / `//` 喺字串入面嘅情況 | 否 |
| 4 | S-038 | 補 Similar / timer lapse 測試 + label | 否 |
| 5 | S-036 | 改名 | 否 |
| 6 | S-039 / S-040 | QA script / HANDOFF 標題 | 否 |

Fix convention：每個 item 一個 commit，`fix: S-035 | …`。

## 修訂後代碼（建議，未套用）

```js
// js/core/actions.js — S-035 + S-036
let doubleTapGuard = null; // { view, x, y, at } — at = timeStamp of the click that changed the view
const clickView = () => [document.querySelector('.screen.active'), state.questions];
const isSameClickView = (a, b) => a[0] === b[0] && a[1] === b[1];
const isPointerClick = e => e.detail > 0;
function isStrayClick(e, el) {
  const g = doubleTapGuard;
  if (!g || !isPointerClick(e) || el.closest('#confirmModal') || !isSameClickView(g.view, clickView())) return false;
  const near = Math.hypot(e.clientX - g.x, e.clientY - g.y) <= DOUBLE_TAP_SLOP_PX;
  const dt = e.timeStamp - g.at; // tap-to-tap interval; a queued second tap is still later than the first
  return near && dt >= 0 && dt < SCREEN_CHANGE_CLICK_GUARD_MS;
}
function runClickAction(el, e) {
  if (isStrayClick(e, el)) return;
  const before = clickView();
  runAction(el.dataset.action, el, e);
  const view = clickView();
  if (isPointerClick(e) && !isSameClickView(before, view)) doubleTapGuard = { view, x: e.clientX, y: e.clientY, at: e.timeStamp };
}
```

```js
// tests/structure-test.js — S-037: blank strings first, then strip comments (a "//" inside a string is gone by then)
const code = fs.readFileSync(f, 'utf8')
  .replace(/'[^'\n]*'|"[^"\n]*"/g, s => (s.includes('${') ? s : "''"))
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');
// …and also treat `window.<name>` as a use:
//   new RegExp(`(?:(?<![\\w$.])|window\\.)${name}(?![\\w$])`)
```

## Handoff receipt

```handoff-receipt
protocol: 1
status: pass
score: 97/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
next_action: merge_develop
next_agent: quality-assurance
branch: "claude/intelligent-lovelace-zczz0o"
context: "v0.64 batch (CUI-0011 97, S-034 95, S-031 99, merge/bump 99): 0 Critical, 1 Warning W-012 (390px: 13 Study fact cards with 2 sources, ids 25/30/62/67/74/76/78/128/155/159/181/225/231, source row now wraps +27px; user accepted S-034 as +1-2px, show fact #25 before/after and confirm), S-035..S-040 suggestions; 29/29 tests, Red verified at 0c185c7, visual-diff = font-family + derived sizes only; v0.63 QA E9 now passes; QA note: old qa-v063 script cui0010 clicks <350ms after screen change get swallowed by the guard (script artefact), boot Core Fact check is flaky at v0.63 too"
```
