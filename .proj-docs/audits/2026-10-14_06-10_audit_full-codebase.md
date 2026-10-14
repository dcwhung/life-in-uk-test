# 架構審計報告

**日期**：2026-10-14 06:10 UTC
**項目**：Life in the UK Test PWA（HEAD `c52527c` = `origin/main`，PR #130，v2.5.2）
**審計員**：Architect Agent（主導）+ main agent（抽查引用 code、實跑 test suite）
**審計範圍**：完整 codebase（`js/`、`css/`、`data/`、`locales/`、`sw.js`、`index.html`、`tests/`、`.proj-docs/`、`HANDOFF.md`、git 歷史）
**方法**：直接讀 code、grep、git log、node 靜態分析；`tests/run-all.sh` 全套實跑（Chromium 1194 + playwright-core）。推斷嘅地方標明「假設」。

---

## 項目概覽

- **類型**：純前端 Web App / PWA（離線可用），冇 backend、冇 DB、冇 build step
- **用途**：Life in the UK 考試練習。有 17 份試卷、408 題、235 個 Study fact、61 組記憶法、溫習計劃；UI 有 en / zh-HK 兩種語言，題目有廣東話翻譯
- **狀態**：Active，開發節奏極快。572 commits 集中喺 2026-10-09 至 10-14，10-13 一日 209 個；30 次 merge `main` 入 session branch；版本由 v0.32 去到 v2.5.2
- **規模**：1,330 個 tracked 檔；js 約 7.8k 行、css 3.3k 行、data 490KB、tests 77 個 suite
- **部署**：GitHub Pages branch deploy（`main` → https://dcwhung.github.io/life-in-uk-test/），冇 `.nojekyll`
- **開發模式**：多個平行 Claude session branch（`claude/*`），各自寫 review / QA / ticket / 版本號，然後 merge 返 `main`

---

## Tech Stack

| 層級 | 技術 | 版本 | 備注 |
|------|------|------|------|
| Frontend | Vanilla JS（classic `<script>`，唔係 ES modules） | — | 46 個 `<script>`（`index.html:543-588`），共用 global scope |
| Styling | 純 CSS + design tokens（`css/base/tokens.css`） | — | 21 個 `<link>`（`index.html:16-36`），3,276 行，約 250KB |
| i18n | 自家 `t()`（`js/core/i18n.js`）+ `locales/en.js` / `zh-HK.js` | — | 兩邊各 595 key，完全對齊 |
| Data | Global JS 常數（`data/exams.js` 336KB、`study.js` 66KB、`notesEn.js` 58KB、`memo.js` 30KB） | — | 開機全部同步載入 |
| Persistence | `localStorage`（prefix `lifeuk.`）+ 1 個 `sessionStorage` key | — | origin `dcwhung.github.io` 同其他 repo 共用 |
| Offline | Service Worker（`sw.js`）cache-first，cache 名 `lifeuk-v` + `APP_VERSION` | 2.5.2 | `importScripts('js/core/config.js')` |
| Backend / DB / Cache / Queue | 無 | — | — |
| 測試框架 | Playwright（`playwright-core`，node script）+ Python `http.server` | — | 77 suite，`tests/run-all.sh` 順序跑 |
| CI/CD | **無**（冇 `.github/`） | — | 只有 Pages 內置 build & deploy |

---

## 目錄結構

| 路徑 | 職責 | 規模 |
|------|------|------|
| `index.html` | 10 個 `.screen` 靜態 markup + script / css tag | 590 行，35KB |
| `js/core/` | `config`（常數、LS key、migration 表）、`utils`（LS 存取、legacy migration、escapeHtml、DOM helper）、`i18n`、`store`（練習記錄）、`actions`（event delegation） | 5 檔，908 行 |
| `js/domain/` | `questions`、`mastery`、`similar`、`plan`、`planProgress`、`memo` | 6 檔，1,241 行 |
| `js/components/` | icons、dots、tags/note、modal、popover、factCard、fit / fitRow / deskPlace、switch、toast、splash | 12 檔，876 行 |
| `js/screens/` | home、quiz、examTools、sideSession、similarPanel、result、flagged、study、plan*（5 個）、memo、intro | 15 檔，4,646 行 |
| `js/pwa/pwa.js` | SW 註冊、更新 reload、安裝 banner | 90 行 |
| `js/main.js` | boot、補載舊 cache 缺少嘅 script / style、舊 markup 升級 | 194 行 |
| `data/` | 題庫、fact、記憶法、英文 note | 490KB |
| `locales/` | UI 文字 | 67KB |
| `tests/` | 77 suite + helper + fixtures + **18 張 tracked `shot-*.png`** | 3.3MB |
| `mockups/` | 設計 mockup HTML（**經 Pages 公開**） | 24 檔，3.3MB |
| `.proj-docs/` | reviews / qa / plans / deploys / design-baselines / audits | **1,076 檔，97MB**（`qa/screenshots` 77MB） |
| `.tickets/` | CUI ticket（pending：CUI-0040、0041、0043–0046 等） | — |
| `HANDOFF.md` | 單一交接文件 | **345KB / 990 行，最長一行 6,996 字元** |

---

## 架構分析

### 整體架構模式

- **分層 global-script**：依次序載入 `data → core(config, utils) → locales → i18n → store → domain → components → screens → actions → pwa → main`。冇 module system，總共 1,364 個 top-level 宣告，當中約 40 個係 mutable `let`（`state`、`study`、`streaks`、`planDayView`、`introPage`…）。
- **Render**：`xxxHtml()` 用 template literal 砌好 string，再全量 `innerHTML`（69 處）；`escapeHtml(` 用咗 119 次；靜態文字經 `data-i18n` 填入。
- **Event**：`js/core/actions.js` 喺 document level delegate，`data-action` 對應 `ACTIONS`（約 80 個 action），冇 inline handler。
- **Screen 切換**：`showScreen(id)`；`SCREEN_RERENDER` 表負責轉語言或字號後重繪。
- **Responsive**：用 `isDesktop()`（matchMedia）判斷，`deskPlace.js` 喺 runtime 將節點搬入 desktop column，`fit.js` 量度 overflow，令內容一屏放得落。

### 模組職責 / 依賴關係

```
data/*.js ─┐
config.js ─┼─> utils.js (getLS/setLS + lazy legacy migration) ─> i18n.js ─> store.js
locales ───┘                                                          │
                     domain/* (questions, mastery, similar, plan, planProgress, memo)
                                    │  (questions.js:113 讀 screens/quiz.js 嘅 `state.mode` → 反向依賴)
                     components/*  (structure-test 禁止用 screens/* 嘅名)
                                    │
                     screens/*  ─> actions.js (ACTIONS) ─> pwa.js ─> main.js (bootApp)
```

`tests/structure-test.js` 守住以下規則：冇 inline handler / script / style；top-level function ≤ 30 行（nested function 抽查都冇超過）；CSS 只用 token，`var()` 一定要有定義；components 唔准用 screens 嘅名；`domain/plan*.js` 唔准用 screens 嘅名（**其他 domain 檔冇守**）；`data-action` 同 handler 要一一對應；`file://` 開頁冇 console error。另外 `i18n-test` 守住 js/ 同 index.html 唔准有 CJK 字。冇發現循環依賴，因為 global script 本身冇 import 圖，依賴次序只靠 tag 次序。

---

## API 結構（冇 backend，以 action / data / storage contract 代替）

| 類型 | 入口 | 說明 | 認證 |
|------|------|------|------|
| Action dispatch | `js/core/actions.js:19-143` `ACTIONS` | 約 80 個 UI action（settings、home、quiz、result、study、memo、intro、plan），參數經 `data-arg` / `data-task` / `data-from` | N/A |
| Data contract | `EXAMS`、`STUDY`、`CHAPTERS`、`MEMO_GROUPS`、`NOTES_EN`、`LOCALES` | Global 常數 | N/A |
| Storage contract | `js/core/config.js:66-139` | 見下表 | N/A |

---

## 數據庫結構（localStorage）

### 主要 Keys

| 名稱 | 用途 / 格式 | Versioning |
|------|------|------|
| `lifeuk.practiceStreak` / `practiceFlags` / `wrongList` | `{ "exam.idx": … }` | 無 |
| `lifeuk.completedExams` | `{ examNum: true }` | 無 |
| `lifeuk.homePrefs` / `studyPrefs` | object | 無 |
| `lifeuk.studyMastered` / `studyBookmarks` | `{ factId: mark }` | 無（fact id 合併用 `FACT_ID_MERGES`） |
| `lifeuk.uiLang` / `fontSize` / `translation` / `memoEnabled` / `studyPlanEnabled` / `installDismissed` / `introSeen` | scalar | 無 |
| `lifeuk.studyPlan` | `{ v, start, goal, days[], goalHistory, carryFrom? }` | **有**（`PLAN_SCHEMA_VERSION`=1，`plan.js:33`；`parseStoredPlan` 嚴格驗證，`plan.js:308`） |
| `lifeuk.studyPlanProgress` | `{ v, days: { iso: { ok, bad, mock } } }` | **有**（`parsePlanLog`，`planProgress.js:46`；parse 唔到就唔覆寫） |
| `lifeuk.memoProgress` | `{ groupId: { lv, due } }` | 無（讀嗰陣逐個 entry 過濾，`memo.js:68-71`） |
| `lifeuk.migrated` / `migrateFallback` / `factIdsMerged` | migration marker | — |

### 關係 / 處理

- 題目一律用位置 key（`"exam.idx"`），fact 用 `id`，fact 嘅 `src[]` 指返題目 key，memo group 對應一組 fact / 題目。
- `getLS` 有包 `try/catch JSON.parse`（`utils.js:276-278`）。壞咗嘅值會當冇，但唔會清走。
- v0.58 之前未加 prefix 嘅 key 用 lazy migration（`utils.js:39-260`），有 merge、`writeVerified`、quota 失敗時保留舊 key。
- 開機時 `pruneStaleQuestionKeys` 清走已經唔存在嘅題目 key（CUI-0039）。
- `content-guard-test` 對比 `fixtures/content-baseline.json`，防止題目次序變咗之後 key 錯配。

---

## 實測結果：`tests/run-all.sh`（2026-10-14，HEAD `c52527c`）

| 結果 | 數量 | 備注 |
|------|------|------|
| PASS | 75 / 77 | — |
| FAIL（真實） | 1 | `control-icons-test`，見 **AU-019**，單獨重跑仍然 FAIL |
| FAIL（環境） | 1 | `upgrade-test`：shallow clone 冇 v0.57 ref `dc84cab`。`git fetch --unshallow` 之後重跑 **PASS** |
| 副作用 | 18 檔 | 跑完之後 `tests/shot-*.png` 全部變 modified（見 AU-007），已用 `git checkout` 還原 |

---

## 發現問題

### 🔴 Critical（架構級問題，必須處理）

#### [AU-019] `main` 上 `control-icons-test` 紅咗：Info「Replay intro」掣用 glyph
- **位置**：`index.html:75`（`<span class="info-replay-play">▶</span>`）；`app.introReplayPlay` locale 值帶 `›`
- **描述**：v2.5.0 加嘅 intro replay 掣用咗 `▶` 同 `›` glyph，違反 v1.6.1 定落嘅「掣用 line icon，唔用 glyph」規則。desktop 1280×800 en 細字 Home 會 FAIL，可以穩定 reproduce。
- **影響**：production（`main`）test 係紅，即係 PR #128–#130 冇跑齊 suite 就 merge 咗，正好印證 AU-002。
- **建議**：方案 1：改用 `lineIconSvg('play')` / `chevronRight`，並將 locale 值嘅 `›` 刪走（要處理舊 cache locale fallback）。方案 2：如果設計上要保留 glyph，就喺 `control-icons-test` 加白名單並寫明 Design Origin。建議用方案 1，走 `/fix` 流程。

#### [AU-001] 舊 cache 混版相容層不斷累積，成為主要結構成本
- **位置**：`js/main.js:11-46`（`LATE_BOOT_SCRIPTS` 18 項）、`js/main.js:63-122`（`upgradeLegacy*` + `LEGACY_*` 表）、`js/main.js:180`（`LATE_BOOT_STYLES`）。js/ 有 72 處 `typeof X === 'function' / 'undefined'` guard，大約 80 處 comment 寫住「HTTP-cached / pre-vX」。
- **描述**：GitHub Pages 每個檔都係 `max-age=600`，asset URL 又冇版本或 hash。冇 SW controller 嘅時候（第一次開、iOS 清咗 SW、`file://`），可能載到「新 index.html + 舊 js」。SW 一 install 就 `skipWaiting()`（`sw.js:93`），activate 時即刻刪舊 cache（`sw.js:95-99`）。每加一個新功能都要多加 guard，而且從來冇移除過（v0.59 嘅 guard 去到 v2.5.2 仲喺度）。
- **影響**：`main.js` 大約 60% 係 shim；漏加 guard 就會 runtime error（review 一再追：W-057 / W-072 / W-075 / W-382…）；guard 會靜默吞咗真 bug；冇辦法窮舉所有混版組合。
- **建議**：
  1. asset URL 加 `?v=APP_VERSION`（由 script 生成 index.html 同 SW SHELL）。HTTP cache 唔再混版之後，大部分 shim 可以刪。
  2. 取消即時 `skipWaiting`，改為配合 `pwa.js` 現有嘅「只喺 Home reload」邏輯。
  3. 定一個相容窗口（例如只支援上一個 minor 版本），一次過刪走 v2.0 之前嘅 shim，並喺 structure-test 限制 `typeof … === 'function'` 嘅數量上限。
  - Trade-off：(1) 改動最少、效果最大，但要維護生成 script；(2) 更新會慢一步；(3) 用 v2.0 之前 cache 嘅極少數用戶，可能要手動 reload 一次。

#### [AU-002] 冇 CI，test 冇 gate merge
- **位置**：repo 冇 `.github/`；`tests/run-all.sh` 要自備 `playwright-core`（NODE_PATH）、Chromium、python3。
- **描述**：PR 可以喺未跑 test 或者 test 紅嘅情況下 merge，然後即刻部署去 production。AU-019 就係實例。review 報告入面「run-all 70/71 + flake 重跑 PASS」全部靠人手判斷。
- **影響**：production 冇自動品質閘門；兩條各自綠嘅平行 branch，merge 之後可能變紅（semantic conflict）。
- **建議**：方案 1：GitHub Actions（setup-node + playwright chromium + `run-all.sh`，`fetch-depth: 0` 俾 upgrade-test 用）+ branch protection。方案 2：再進一步改用 `actions/deploy-pages`，test 綠先部署（亦順手解決 AU-010）。建議方案 1 先做，方案 2 跟住做。

#### [AU-003] 多 session 平行開發冇 ID / 版本分配機制，撞號已經系統化
- **位置**：`.proj-docs/index.md` 頂部有 39 段「撞號 / 再撞號 / 版本再撞」記錄（index.md 95KB）；`APP_VERSION`（`config.js:5`）被 53 個 commit 改過。
- **描述**：review ID（C/W/S）、ticket（CUI）同 `APP_VERSION` 都喺 branch 開發期間用「grep 最大號 + 1」分配，平行 session 一定會撞，撞咗就要改號、改檔名、寫撞號段落。
- **影響**：追溯性差（引用 ID 要連報告名）；每次 merge 都要人手處理；版本撞咗，SW cache 名就一樣（假設：兩個唔同 build 用同一個版本號，已裝嘅 app 可能偵測唔到更新）。
- **建議**：`APP_VERSION` 只喺 merge 去 `main` 嗰陣由 release script 或 CI 決定；review ID 加 session 或 branch 前綴（例如 `W-<branch短hash>-01`），或者 merge 時由 script 重新編號；ticket 改用 GitHub Issues 自動遞增。

### 🟡 Warning（設計問題，建議處理）

#### [AU-004] Global namespace 污染 + mutable global state
- **位置**：`index.html:543-588`；`js/screens/quiz.js:4` `let state`；`js/core/store.js:4-6`；`js/domain/questions.js:113` `isRandomExam` 讀 `state.mode`
- **描述**：冇 module 邊界，依賴次序只靠 tag 次序同 comment 維持；domain 反向依賴 screen。
- **影響**：同名 `let` 會令成個 app 開唔到；domain 冇辦法單獨 unit test。
- **建議**：短期將 structure-test 嘅 layering guard 擴大到全部 `js/domain/*`，`isRandomExam` 改為傳入 mode。中期轉 native ES modules（唔使 build），或者每層一個 namespace object。

#### [AU-005] 檔案過大、職責過多
- **位置**：`js/screens/quiz.js`（615 行、53 function）、`js/domain/planProgress.js`（559 行、78 function）、`js/screens/planRun.js`（558 行）、`js/screens/memo.js`（454 行）、`css/screens/plan.css`（704 行、64KB）；js/ 有 40 行超過 160 字元
- **描述**：30 行 function 規則令長 function 變成長行，或者變成大量細 function；冇檔案長度同行長限制。
- **影響**：認知負荷高；平行 session 撞 merge conflict 嘅熱點。
- **建議**：按職責拆檔（quiz → render / answer / desktop / phone；plan.css 按 screen 拆）；structure-test 加 file ≤ 400 行、line ≤ 140 字元。

#### [AU-006] `setLS` 靜默吞錯
- **位置**：`js/core/utils.js:282-284` `try { … } catch {}`
- **描述**：quota 爆或者 private mode 寫入失敗，冇 log、冇提示。
- **影響**：用戶以為已經儲存咗進度，實際上冇。
- **建議**：方案 1：回傳 boolean，第一次失敗時 `console.warn` + toast（加 locale key）。方案 2：只 log，唔出 UI。建議方案 1。

#### [AU-007] Test 會改寫 tracked 截圖，有已知 flaky，環境依賴重
- **位置**：14 個 suite 會寫 `tests/shot-*.png`（例如 `study-test.js:75`）；`.gitignore` 只排除 root 嘅 `/shot-*.png`；`run-all.sh:9` suite 清單寫死
- **描述**：今次實跑完，18 張 png 全部變成 modified。已知 flaky 嘅 suite（upgrade、factmerge、fontsize、plan-day、dup、i18n）一直用「單獨重跑 PASS」嚟處理。`upgrade-test` 喺 shallow clone 會 FAIL。
- **影響**：容易誤 commit binary；「flake」可能遮住真正嘅 regression。
- **建議**：截圖改寫入 `tests/.output/`（gitignore），baseline 另外放；flaky suite 開 ticket 修 timing；run-all 改用 glob 並行跑；CI 用 `fetch-depth: 0`。

#### [AU-008] 文件債：HANDOFF.md 345KB、`.proj-docs` 97MB 入 git
- **位置**：`HANDOFF.md`（157 個 commit 改過）、`.proj-docs/index.md`（95KB）、`qa/screenshots` 77MB、`.git` 113MB
- **描述**：遠超 agent 嘅 context budget，又係 merge conflict 熱點；架構說明、glossary、版本記錄全部混埋一齊。
- **影響**：onboarding 同 context 成本高、clone 慢、過時內容冇人發現。
- **建議**：拆成 `docs/architecture.md`、`docs/storage.md`、`docs/i18n-glossary.md`、`CHANGELOG.md`，HANDOFF 主檔控制喺 300 行內；index.md 嘅撞號段落歸檔；QA 截圖只留最新嘅，舊嘅轉 LFS 或者 Release asset（`git filter-repo` 瘦身要用戶決定）。

#### [AU-009] 同一份 file list 喺 4 處各自維護
- **位置**：`index.html:16-36, 543-588`、`sw.js:10-88` SHELL、`js/main.js:11-46` / `:180`、`tests/run-all.sh:9`
- **建議**：用一個 manifest 做 SSoT，由 script 生成 tag 同 SHELL；run-all 改用 glob。

#### [AU-010] Jekyll 預設處理，repo 雜物經 Pages 公開
- **位置**：冇 `.nojekyll`；`HANDOFF.md`、`mockups/`、`tests/` 都可以公開存取，而且同 app 同 origin
- **建議**：加 `.nojekyll`；用 Actions 部署，只上傳 runtime 檔。

### 🟢 Observation（可改善點）

- **AU-011**：`escapeHtml` 冇 escape `'`（`utils.js:290-292`）；`t()` 插值唔 escape（`i18n.js:23-25`）。而家冇單引號 attribute，所以未有可利用路徑，但安全靠 caller 紀律。建議補 `&#39;`，並加 lint 規則。
- **AU-012**：Study 搜尋每打一個字就全量重繪 235 張卡（`study.js:104 → :92`）。建議加 100–150ms debounce。
- **AU-013**：Resize 處理唔一致。`fit.js:106-112` 有 rAF throttle，但 `fitRow.js:36`、`popover.js:43`、`intro.js:353` 冇。建議統一用 `scheduleRefits` 或 `ResizeObserver`。
- **AU-014**：開機同步載入約 490KB data 同 46 個 script。有 SW 之後影響細；轉 ES modules 時可以 lazy load `notesEn.js` / `memo.js`。
- **AU-015**：大部分 LS key 冇 schema version；`parseStoredPlan` 見到 `v` 唔啱就當無效，冇升級路徑。建議加 `lifeuk.schema` + `migrations[]`，統一取代四套散落嘅機制。
- **AU-016**：data key 脆弱。題目用位置 key，`NOTES_EN` 用整段廣東話原文做 key。建議每題加穩定 `id`。
- **AU-017**：a11y / i18n 基礎良好（595 key 對齊、54 個 `aria-label`、6 個 `aria-live`、focus 還原、`prefers-reduced-motion`），但冇 axe-core 自動掃描。
- **AU-018**：`ACTIONS` 係單一個約 125 行嘅 object literal。可以按 screen 拆開，再 `Object.assign` 合返。
- **做得好嘅地方**：function 長度、layering 同 design token 都有 structure-test 自動守住；migration 處理細緻（`writeVerified`、唔覆寫 parse 唔到嘅 log）；零第三方 script；E2E 覆蓋範圍好闊（包括混版升級同內容守衛）。

---

## 技術債評估

| 類別 | 程度 | 描述 | 預計處理成本 |
|------|------|------|-------------|
| 代碼質量 | 中 | function 短、命名清楚；但有 global 污染、大檔、72 個相容 guard、comment 塞滿 review ID 歷史 | 3–5 日 |
| 測試覆蓋 | 低（覆蓋）／高（基建） | 77 個 E2E suite 覆蓋好闊；但冇 CI、有 flaky、會改寫 tracked png、冇 domain unit test | 1.5–2 日 |
| 文件完整性 | 中（過量、難用） | 資料極詳盡，但 HANDOFF 345KB、index 95KB、`.proj-docs` 97MB | 1–1.5 日 |
| 安全性 | 低 | 冇 backend、冇第三方 script、escape 大致齊；缺 CSP、共用 origin | 0.5 日 |
| 性能 | 低至中 | 有 SW 就快；首次載入 50 多個 request；全量 innerHTML；搜尋冇 debounce | 0.5–1 日 |
| 依賴更新 | 低 | 冇 runtime 依賴；test 只用 playwright-core | — |
| 流程 / 發佈 | 高 | 版本 / ID / ticket 撞號系統化；冇自動化發佈；`main` 紅咗都冇人知（AU-019） | 1–2 日 |

---

## 建議方向

### 方案 A：修復現有系統（漸進式）
- **適用情況**：功能已經穩定；用戶已經裝咗 PWA，localStorage 進度一定要保住；code 本身紀律良好
- **預計工作量**：約 6–9 個工作日
- **優點**：保留 structure-test、content-guard、migration test 呢啲已驗證資產；風險低；可以逐步交付
- **缺點**：global script 架構嘅根本限制仲喺度；shim 清理要小心

### 方案 B：重建（Vite + TypeScript + ES modules，可配 Preact）
- **適用情況**：預計會大幅擴展（帳號同步、多題庫），或者要長期多人維護
- **預計工作量**：約 4–6 週
- **優點**：hashed asset 一次過解決混版問題；有 type safety；domain 可以做 unit test
- **缺點**：要引入 build step；兩萬幾行 code 要移植；localStorage 一定要 100% 相容；平行開發期間重寫，衝突成本極高

### 推薦
**方案 A。** 主要問題喺部署同流程（冇 CI、冇 cache-busting、ID 分配），唔係 code 設計本身。呢啲用幾日就可以解決，而解決咗之後 AU-001 累積落嚟嘅成本可以一次清走。如果日後要加 backend 或同步，可以按需要漸進轉 ES modules / TS（AU-004 中期已經鋪好路）。

---

## 下一步建議

| 優先級 | 行動 | 對應 | 負責 Agent | 預計工作量 |
|--------|------|------|-----------|-----------|
| P0 | `/fix`：Replay intro 掣改用 line icon，令 `main` 返綠 | AU-019 | Frontend Developer | 0.5 日 |
| P0 | GitHub Actions 跑 run-all（`fetch-depth: 0`）+ branch protection | AU-002 | DevOps | 0.5–1 日 |
| P0 | 版本號同 review / ticket ID 改為 merge 時分配 | AU-003 | PM + DevOps | 1 日 |
| P0 | test 截圖改寫入 gitignore 目錄 | AU-007 | QA | 0.5 日 |
| P1 | asset `?v=` cache-busting + 相容窗口政策，刪走 v2.0 之前嘅 shim | AU-001 / AU-009 | Architect + Developer | 2–3 日 |
| P1 | `setLS` 寫入失敗要 log + toast | AU-006 | Developer | 0.5 日 |
| P1 | 拆 HANDOFF.md，index.md 撞號段落歸檔 | AU-008 | PM | 1 日 |
| P1 | Domain layering guard 擴大，修 `questions.js:113` | AU-004 | Developer | 0.5 日 |
| P1 | 加 `.nojekyll`，用 Actions 只部署 runtime 檔 | AU-010 | DevOps | 0.5 日 |
| P1 | flaky suite 修 timing，CI 自動 retry 一次並標記 | AU-007 | QA | 1 日 |
| P2 | 拆大檔，structure-test 加檔案 / 行長上限 | AU-005 | Developer | 2–3 日 |
| P2 | 統一 LS schema version + migration pipeline | AU-015 | Architect | 1–2 日 |
| P2 | 搜尋 debounce、resize 統一 throttle | AU-012 / AU-013 | Developer | 0.5 日 |
| P2 | `escapeHtml` 補 `'` + `t()` innerHTML lint | AU-011 | Developer | 0.5 日 |
| P2 | axe-core a11y suite | AU-017 | QA | 0.5 日 |
| P2 | 題目穩定 id，`NOTES_EN` 改用 id key | AU-016 | Developer | 1–2 日 |
| P2 | `.proj-docs` 截圖瘦身（LFS 或 filter-repo，要用戶決定） | AU-008 | DevOps | 0.5 日 |

---

## 安全配置審計結果（GitHub Pages 情境）

| 類別 | 項目 | 狀態 | 風險 | 建議 |
|------|------|------|------|------|
| HTTP Headers | CSP | ❌ 缺失（Pages 唔可以設 header，`index.html:4-15` 冇 meta CSP） | 🟡 | 加 `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'">`；progress 嘅 inline `style="width:0%"` 要改用 class 或者放寬 style-src |
| HTTP Headers | HSTS / X-Frame-Options / nosniff | ⚠️ 由 GitHub Pages 控制（HTTPS 強制） | 🟢 | `frame-ancestors` 喺 meta 入面唔生效，接受 |
| XSS | innerHTML | ✅ 69 處，內容 / localStorage 值都有 escape 或驗證；搜尋字串冇入 HTML | 🟢 | AU-011 |
| XSS | `escapeHtml` 缺 `'`、`t()` 插值 | ⚠️ 靠 caller 紀律 | 🟢 | AU-011 |
| SW | Cache 策略 | ⚠️ cache-first、prefix 隔離、`cache:'reload'` install；即時 `skipWaiting` 令版本一致性出問題 | 🟡 | AU-001；fetch handler 加 non-GET return |
| 第三方 script | — | ✅ 冇 | 🟢 | 保持；日後加嘅話要配 CSP + SRI |
| 外部輸入 | 搜尋 / 計劃表單 / localStorage | ✅ 日期 ISO 驗證、`getLS` 有 try/catch + 結構驗證 | 🟢 | `plan.qids` 將來入 HTML 前要驗證 |
| Origin | 共用 `dcwhung.github.io` | ⚠️ 同 owner 其他 Pages app 有 XSS 就讀寫到本 app 進度 | 🟡 | 長遠用 custom domain |
| 公開檔案 | HANDOFF / mockups / tests | ⚠️ 經 Pages 公開 | 🟢 | AU-010 |
| 依賴庫 | npm / pip audit | N/A（冇 runtime 依賴） | 🟢 | — |
| Rate Limiting / CORS / 端點 | — | N/A（冇 backend） | — | — |
| Secrets | — | ✅ 冇 key / token；`.claude/session-logs/` 入咗 git | 🟢 | 定期檢查 session log |
