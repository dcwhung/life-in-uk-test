# Batch Review — 2026-10-06 — v0.62 P3 PR-2（Lane V + Lane C2）

- 審閱者：Code Reviewer（獨立 subagent）
- Branch：`integrate/p3-pr2`（本機，未 push），range `15aba6b..15ec9c3`（15aba6b = v0.61 / PR #34 head）
- 涵蓋 commit：
  - Lane V：`5cc65ed` T-101、`2b4cf16` T-102、`f7e7a73` T-103、`b0830af` T-104、`3e39608` T-105、`6a4b257` T-106、`07328c2` T-104 follow-up、`40df3ff` T-107 docs、merge `1854e05`
  - Lane C2：`46c7dbc` T-151、`04f209a` T-152/153、`ec6cac8` T-154/155、`26d364d` docs
  - S-026 / S-027：`5145a23`、`4e43253`
  - Main agent：merge `2424f88`（HANDOFF conflict）、`15ec9c3`（APP_VERSION 0.62 + 版本記錄）
- Design Origin：`mockup: mockups/study-unify.html#study-chapters`、`#timeline`、`#similar-core`（Q2 = (a) 全 navy）；C2 = `none-required`（冇 UI 入口）
- Review Item ID 起點：之前最大 C-001 / W-008 / S-027（grep `.proj-docs/reviews/`）→ 今次 W-009、S-028 起
- 總評：兩條 lane 都貼住 plan 同 mockup，R-001 / R-002 處理乾淨，測試寫得紮實。發現 2 個 🟡（一個 hit area 重疊會撳錯掣、一個開機 fallback 退化）、2 個 🟢；冇 🔴。

## 整體 verdict

### Hard Gates

| Gate | 結果 | 備注 |
|------|------|------|
| Lint | n/a | 項目冇 eslint（classic script PWA） |
| Type check | n/a | 冇 TS |
| Tests | pass | reviewer 自己跑 `tests/run-all.sh`：27 / 27 PASS（exit 0）；跑完已還原 `tests/*.png`、刪未追蹤 png，working tree 乾淨 |
| Coverage | n/a | 冇 coverage 工具；新行為大部分都有 Playwright 斷言（缺口見 W-009 / W-010） |
| No Critical | pass | 0 個 🔴 |
| Security scan | n/a | 冇新增依賴 |

### 各 Section 評分

| Section | 分數 | 狀態 |
|---|---|---|
| A — Lane V（Study 視覺統一） | 94 / 100 | ✅ pass（有 W-009） |
| B — Lane C2（fact session 引擎） | 95 / 100 | ✅ pass（有 W-010） |
| C — S-026 / S-027 | 99 / 100 | ✅ pass |
| D — Merge / main agent | 100 / 100 | ✅ pass |

**整體 Status：✅ pass**（hard gates 全 pass、每個 section ≥ 90、冇 Critical）。兩個 🟡 都係細改動，branch 未 push，建議 push 之前順手修。

---

## Section A — Lane V（T-101…T-107）

### 改動清單
- `tokens.css`：加 `--study-accent` / `-strong` / `-bg`（指去 `--navy-light` / `--selected-bg`，同 mockup `.deco-a` 一模一樣）、`--radius-xs: 6px`；刪 `--star-on`、`--year-bg`（全 repo 冇殘留引用）
- `chips.css`：`.study-tab.active` → `--navy`；刪 `.chip.ch.active`（跟返 `.chip.active` navy）
- `study.css`：search focus `--navy-light`、裝飾色全部改 token、刪 `.tag.diff`、`.fact-btn` 32×32 + `::before inset:-6px`、書籤 SVG 樣式（同 `.flag-btn`）、`#studyChips` 書籤 chip off 時空心
- `home.css`：`.ch-num` / `.chapter-btn:hover` 用 `--study-accent-strong`，radius token
- `quiz.css`：`.sqm-fact` 4px 左邊框、`--radius-md`、12px 14px（Q3：保留金色）
- `study.js`：`starsHtml(f.d)`；`factMarkButtonHtml` 抽 helper，加 `aria-label` / `aria-pressed`；書籤 = `bookmarkSvg('', { decorative: true })`
- `en.js`：`bookmarkedOnly` 拎走 ★

### Design Fidelity
| 檢查 | 結果 |
|---|---|
| Design Origin 存在且合法 | ✅ mockup（plan T-101…T-106 binding） |
| 顏色全部用 token、冇 hardcoded hex | ✅（`structure-test` 守 tokens.css 以外冇 hex；新守衛：Study / Home chrome 冇 `--purple*` / `--year-bg`，只留 `.fact-yue`） |
| SVG fill / stroke 明確設定（唔會黑色） | ✅ `.fact-btn.star path { fill:none; stroke:currentColor; stroke-width:2 }`、`.on path { fill: currentColor }`（`--orange`）；chip off `fill:none; stroke:currentColor`（`stroke-width` 由 `.chip-flag path` 繼承 2）；chip active 白色。`study-test` 用 computed style 斷言 off = `--text-muted` outline、on = orange fill |
| DOM landmark / class 名同 mockup / upgrade-test hook | ✅ `.study-tab.active`、`study.mastered`、`study.bookmarks`、`.fact-btn.star` / `.tick`、`.fact` 全部保留（mockup 用 `.bm`，實作照 plan 保留 `.star` hook，合理） |
| Layout | ✅ 冇結構改動；只係 `.fact-btn` 30×28 → 32×32 同 `.sqm-fact` 形狀（visual-diff delta 只喺 study* / homePracticeChapter / practiceWrong/Right/Last，同預期一致） |
| 偏離 mockup | `.tag` radius 5px → 6px（`--radius-xs`，plan O8 明確要求 token 化，可接受）；其餘一致 |

### 發現

#### 🟡 W-009 — 兩粒 fact 掣嘅 44px hit area 重疊，撳書籤右邊會切換「Mastered」
- 位置：`css/screens/study.css:47`（`.fact-actions { gap: 4px }`）+ `:58`（`.fact-btn::before { inset: -6px }`）
- 描述：每粒掣向四邊擴 6px，但兩粒掣之間只有 4px gap → 兩個 `::before` 重疊 8px。後面嗰粒（✓ Mastered）喺 DOM 後面，重疊位畫喺上面。Reviewer 用 `elementFromPoint` 逐 px 量：書籤可見框 x = 0…32，**x = 30…32 已經屬於 ✓ 掣**；gap 入面 32…36 都係 ✓。即係用戶撳書籤嘅右邊邊位會錯誤標記 / 取消「已掌握」，而且會即刻影響 Hide mastered 篩選。
- 影響：正確性 / a11y（撳錯掣、改咗用戶進度）；`study-test` 只量咗書籤上邊同左邊，冇量兩粒之間。mockup 本身用同一組數值，所以係 mockup 帶落嚟嘅問題，唔係實作偏離。
- 方案 A：相鄰邊只擴到 gap 一半：`.fact-btn.star::before { right: -2px }`、`.fact-btn.tick::before { left: -2px }`（其餘三邊照 -6px）。視覺 0 改動；每粒 hit 40×44，仍然遠超 WCAG 2.5.8（24px），而兩粒之間嘅分界線喺 gap 正中。測試加一句：書籤可見框內每一點 `elementFromPoint` 都返書籤。
- 方案 B：`.fact-actions { gap: 12px }`，兩粒都有完整 44×44 唔重疊。代價：卡右上角闊咗 8px、fact-meta 少咗位，visual-diff 要重出 baseline，同 mockup 有 delta。
- 推薦：A（零視覺改動、改兩行 CSS + 一個斷言）。

#### 🟢 S-028 — HANDOFF glossary Study 行仍然列 `★ Bookmarked only`
- 位置：`HANDOFF.md:110`
- 描述：同一行前半寫 `★ Bookmarked only`，後半 v0.62 註記又話「冇 ★」，自相矛盾；T-107 要求更新 glossary。
- 方案 A：前半改做 `Bookmarked only`（前面係書籤 SVG），v0.62 註記保留。
- 方案 B：前半刪咗呢個 chip，只留 v0.62 註記。
- 推薦：A。

### 評分

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 20 | 25 | W-009 |
| 安全性 | 20 | 20 | label 經 `escapeHtml`，`content` 只係內部 SVG / ✓ |
| 可維護性 | 19 | 20 | S-028；`factMarkButtonHtml` 抽得好 |
| 測試覆蓋 | 15 | 15 | computed-style 斷言好完整（缺口已計入 W-009） |
| 性能 | 10 | 10 | |
| 代碼風格 | 10 | 10 | |
| **總分** | **94** | **100** | |

**推薦**：修 W-009 方案 A 再 push；S-028 一齊做。

---

## Section B — Lane C2（T-151…T-155）

### 改動清單
- `config.js`：`FACT_PREFIX = 'f'`；`questions.js`：`isFactExam`（`f` + 純數字，`'flagged'` 唔中）/ `factIdOf`，`examLabel` → `common.factSet`
- 新 `js/screens/sideSession.js`：`sessionReturn`、`isSideSession` / `clearSideSession`、`sideSessionState`（由零砌）、`startSideSession`、`returnFromSideSession`（`SESSION_RETURNS` 表）、`startFactPractice`
- `similarPanel.js`：改用 `startSideSession`；`quiz.js` `renderRoundNote` / `nextAction` / `startExam`、`home.js` `leaveToHome` 改認 side session
- 三步：`index.html` tag ✅（`examTools` 後、`similarPanel` 前）、`sw.js` SHELL ✅、`APP_VERSION` 0.62 ✅（`15ec9c3`）
- `main.js`：`I18N_BOOT_SCRIPTS` → `LATE_BOOT_SCRIPTS`（加 `sideSession.js`），偵測方式由 `typeof t` 改做「DOM 有冇 `<script src>` tag」（計劃外）

### R-001 / R-002 逐項核對
| 項目 | 結果 |
|---|---|
| `state` 欄位齊全 | ✅ grep 全 repo 所有 `state.X =` / 初始 `state`：`mode, examNum, questions, current, answers, revealed, yueShown, flags, setPool, masteredBefore, reviewTotal, cleared, sessionCorrect, sessionTotal` —— `sideSessionState` 14 個全部有設。（`sessionCorrect` / `sessionTotal` 全 repo 冇人讀，係舊 dead field，設咗無害） |
| 冇 spread 舊 state | ✅ 舊 Similar 寫法 `...state` 仲會同原 session **共用 `flags` object reference**，今次順手修咗 |
| 還原 | ✅ quiz kind：`state = ret.state`（同一個 object，原 session 完全唔受影響）；study kind：`showScreen` + `renderStudy` + `scrollTo`，tab / chip / search 喺 `study` + `#studySearch`，`factsession-test` 有驗 |
| 強制 `PRACTICE_MODE`（R-002） | ✅ 唔讀 `pendingMode`；測試由 Exam mode + 計時中嘅 Exam 1 入去驗 |
| Timer | ✅ `stopExamTimer()` + `examTimeUp = false`；測試驗 `examTimerId === null` |
| Round note | ✅ `!isSideSession()`，測試用 `reviewTotal = 50` 強迫驗 |
| Similar 行為不變 | ✅ panel 只喺 practice 出現，所以強制 practice 等價；`similar-test` / `quicknav-test` 只改變數名照過 |
| `isFactExam` vs `'flagged'` | ✅ 正則 `^\d+$`；`SET_LABEL_KEYS` 先於 `isFactExam` 查，`'flagged'` 照舊 |
| 資料完整性 | ✅ reviewer 驗：236 facts 冇空 `src`、冇指向唔存在題目嘅 key |
| `result.js` 依賴 `setPool` | ✅ side session 永遠唔會去結果頁（最後一題係 ↩ Back） |
| `startFactPractice` action | ⚠️ plan T-154 要加 `actions.js` entry，實作冇加；HANDOFF 已寫明原因（`structure-test` 會 flag 未用 action，PR-3 一齊加），接受 |

### 發現

#### 🟡 W-010 — `LATE_BOOT_SCRIPTS` 改用「有冇 tag」判斷後，新 shell 嘅 i18n 載入失敗唔再有 S-014 fallback
- 位置：`js/main.js:20-22`（`missingBootScripts`）、`:58-60`
- 描述：v0.59–v0.61 用 `typeof t === 'function'` 判斷，所以**任何** shell（新舊）只要 i18n 冇成功執行，都會補載 → 再失敗就 reload 一次 → `I18N_BOOT_FALLBACK_MSG`。改成睇 `<script src>` tag 之後，新 shell 嘅 tag 一定喺度，就直接 `startApp()`。Reviewer 用 `git archive` 抄兩份 app、刪 `js/core/i18n.js` 重現：
  - 15aba6b `main.js`：`#examGrid` 顯示 "The app could not finish loading…"
  - HEAD `main.js`：`#examGrid` 空白，page error `applyLanguage is not defined`（半開頁面，正正係 S-014 想避免嘅情況）
  - `sideSession.js` 缺失時兩個版本表現一樣（開到 Home，要到撳 set 先爆），唔係退化。
- 影響：機率低（SW `addAll` 係 all-or-nothing，主要係冇 SW 嘅第一次載入 / 網絡斷咗一半先會撞到），但係由「有 fallback 訊息」退化做「空白頁」，同埋 `upgrade-test` ⑤ 只覆蓋舊 shell，冇測試會捉到。
- 方案 A：每個 late script 配一個「已載入」檢查，tag 冇 **或者** global 未定義都當 missing：
  ```js
  const LATE_BOOT_SCRIPTS = [
    { src: 'locales/en.js', ready: () => typeof LOCALES !== 'undefined' },
    { src: 'js/core/i18n.js', ready: () => typeof t === 'function' },
    { src: 'js/screens/sideSession.js', ready: () => typeof isSideSession === 'function' },
  ];
  const missingBootScripts = () => LATE_BOOT_SCRIPTS.filter(s => !s.ready()).map(s => s.src);
  ```
  好處：兩種情況都 cover；仲避開舊寫法重載 `en.js` 引致嘅 `Identifier 'LOCALES' has already been declared`（只補載真係未成功嗰個）；唔依賴 `src` 字串完全相等（將來加 `?v=` cache-bust 都唔會誤判）。`upgrade-test` 加一個「新 shell + 刪 i18n.js → fallback 訊息」case。
- 方案 B：保留 tag 檢查，再加 `|| typeof t !== 'function'` 保底（i18n 舊行為照返），`sideSession` 照用 tag。改動最少，但兩套判斷混埋一齊。
- 推薦：A。

### 評分

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 20 | 25 | W-010 |
| 安全性 | 20 | 20 | |
| 可維護性 | 20 | 20 | `SESSION_RETURNS` 表、`sideSessionState` 註解清楚；HANDOFF「臨時 session」段完整 |
| 測試覆蓋 | 15 | 15 | `factsession-test` 逐欄斷言 R-001 + 由 dirty exam state 入手，好有說服力 |
| 性能 | 10 | 10 | |
| 代碼風格 | 10 | 10 | |
| **總分** | **95** | **100** | |

**TDD 詢問**：`ec6cac8` 同一個 commit 加 `startFactPractice` 同 `factsession-test` 主體，`04f209a` 嘅 refactor 冇獨立紅燈記錄。想確認：`factsession-test` 係咪先喺冇 `startFactPractice` / 舊 `similarReturn` spread 嘅情況下紅過？（唔扣分，請 developer 補一句說明。）

**推薦**：修 W-010 方案 A 再 push。

---

## Section C — S-026 / S-027

- `4e43253` S-027：`onAppInstalled()` 清 `deferredPrompt` + 收 banner，同上次推薦方案 A 一致；`pwa-test` 加「`appinstalled` 之後 `promptInstall()` 唔 call `prompt()`」。✅
- `5145a23` S-026：`checkInstallPromptRejected` 完全照方案 A —— `prompt()` reject `InvalidStateError`、`userChoice` 永遠 pending，`Promise.race` 1s 斷言 settle、banner 收、dismiss key `null`、冇 `pageerror`。✅

#### 🟢 S-029 — Review item commit message 格式唔跟 Fix Convention
- 位置：`4e43253` `fix(pwa): S-027 …`、`5145a23` `test(pwa): S-026 …`
- 描述：規範係 `fix: [ID] | [描述]`（之前 `82ed466 fix: S-014 | …` 有跟）。冇 `|`、加咗 scope，`git log --grep 'fix: S-'` 類工具會漏。
- 方案 A：之後嘅 review item commit 跟返格式（已 merge 嘅唔使改歷史）。
- 方案 B：如果團隊想保留 conventional-commit scope，更新規範做 `fix(scope): ID | 描述` 並統一。
- 推薦：A。

| 維度 | 得分 | 備注 |
|---|---|---|
| 正確性 25 / 安全 20 / 可維護 20 / 測試 15 / 性能 10 | 90 | |
| 代碼風格 | 9 / 10 | S-029 |
| **總分** | **99** | |

---

## Section D — Merge / main agent

- `2424f88`：HANDOFF conflict 合併 —— 冇殘留 conflict marker；file 表（`sideSession`、`main.js` `LATE_BOOT_SCRIPTS`）、載入次序、「臨時 session」段、Lane V 嘅 Study 段同 test 表兩邊都喺度，冇互相覆蓋。✅
- `15ec9c3`：`APP_VERSION` 0.61 → 0.62（`sw.js` 經 `importScripts(config.js)` 攞 cache 名，SHELL 已有新 file）；HANDOFF 版本記錄 v0.62 一行齊兩條 lane + S-026 / S-027。✅
- `upgrade-test` 加咗一行（混合 shell 補載 `sideSession.js`）：plan 話「唔改照過」，呢個係純新增斷言、冇郁 v0.57 共用段（`study.mastered` / `study.bookmarks` / `.study-tab.active`），接受。
- 分數：100 / 100

---

## ✅ 做得好嘅地方（跨 fix）
- `sideSessionState` 由零砌晒 state，仲順手修咗舊 Similar spread 共用 `flags` reference 嘅潛在 bug。
- `factsession-test` 由「Exam mode + 計時中 + 有 flag / review counter + Study 捲咗落去」呢個最髒嘅狀態入手，R-001 / R-002 一次過證明。
- `study-test` 用 `tokenRgb()` 比 computed color，唔 hardcode 顏色值；新 `structure-test` 守衛防紫色回流。
- 新 file 三步（index.html / SW SHELL / APP_VERSION）+ 舊 shell 補載 + `upgrade-test` 斷言，考慮周到。
- `isFactExam` 註解講明 `'flagged'` 同字母開頭嘅陷阱，並有測試。
- HANDOFF 更新詳盡（file 表、載入次序、臨時 session、glossary、test 表）。

## 修正優先順序

| # | ID | 內容 | 工作量 |
|---|---|---|---|
| 1 | W-009 | fact 掣 hit area 相鄰邊收到 gap 一半 + 斷言 | 極小 |
| 2 | W-010 | `LATE_BOOT_SCRIPTS` 加 `ready()` 檢查 + upgrade-test case | 小 |
| 3 | S-028 | HANDOFF glossary `★ Bookmarked only` | 極小 |
| 4 | S-029 | 之後 commit message 跟 `fix: ID \| 描述` | 無 code |

## 修訂後代碼（供參考）

```css
/* css/screens/study.css — W-009 方案 A */
/* O2: 32px box + 6px invisible ring = 44px touch target (WCAG 2.5.5) */
.fact-btn::before { content: ''; position: absolute; inset: -6px; }
/* the two buttons sit 4px apart: their rings meet in the middle of the gap instead of overlapping
   (an overlap would let the ✓ ring cover the bookmark's right edge) */
.fact-btn.star::before { right: -2px; }
.fact-btn.tick::before { left: -2px; }
```

```js
// js/main.js — W-010 方案 A
// During a service-worker update a cached older index.html can load these scripts without the tags it never had
// (same cutover as CUI-0004), and any shell can have a tag whose fetch failed: load each one whose global is
// still missing, in this order, then start. locale + i18n: pre-v0.59 shells; sideSession: pre-v0.62 shells.
const LATE_BOOT_SCRIPTS = [
  { src: 'locales/en.js', ready: () => typeof LOCALES !== 'undefined' },
  { src: 'js/core/i18n.js', ready: () => typeof t === 'function' },
  { src: 'js/screens/sideSession.js', ready: () => typeof isSideSession === 'function' },
];
function missingBootScripts() {
  return LATE_BOOT_SCRIPTS.filter(s => !s.ready()).map(s => s.src);
}
```

## Handoff receipt

```handoff-receipt
protocol: 1
status: pass
score: 94/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
next_action: merge_develop
next_agent: quality-assurance
branch: "integrate/p3-pr2"
context: "v0.62 P3 PR-2 batch: A Lane V 94 pass (W-009 fact-btn hit areas overlap, tick ring covers bookmark right 2px; S-028 HANDOFF glossary), B Lane C2 95 pass (W-010 main.js LATE_BOOT_SCRIPTS tag check drops S-014 fallback for new shells, reproduced blank grid), C S-026/S-027 99 pass (S-029 commit msg format), D merge/version 100 pass. 27/27 tests, 0 C / 2 W / 2 S. Recommend fixing W-009 + W-010 (small) on integrate/p3-pr2 before push to PR branch. Report .proj-docs/reviews/2026-10-06_review_v062-pr2_batch.md"
```
