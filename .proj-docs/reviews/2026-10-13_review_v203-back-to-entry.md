# Code Review — v2.0.3 做題中途返回，返去原本入口（back-to-entry）

> **改號（2026-10-13，merge `main` v2.1.0 時）**：`main` 已用 W-071、S-254–S-256、CUI-0035–CUI-0039，所以本 branch 原 **W-071 / W-072 / W-073 → W-072 / W-073 / W-074**，**S-254–S-260 → S-257–S-263**（逐個 +3：S-254→S-257、S-255→S-258、S-256→S-259、S-257→S-260、S-258→S-261、S-259→S-262、S-260→S-263），ticket **CUI-0035 → CUI-0040**（`.tickets/pending/0001-0200/CUI-0040.md`）。已 push 嘅 commit message 保留舊號，對照以此為準。版本：原 v2.0.5 以 **v2.1.1** 發佈（`main` 已出 v2.1.0）；報告 / script / 截圖檔名嘅 `v203` / `v205` 照舊。下一個新號：C-007、W-075、S-264、CUI-0041。

- **日期**：2026-10-13
- **審閱者**：Code Reviewer（獨立）
- **目標**：branch `fix/quiz/back-to-entry`，`origin/main..fe89929`（`5cf3493` fix、`bbdb973` HANDOFF、`fe89929` test 跟進）；15 個檔案，+232 / −9
- **依據**：audit `.proj-docs/qa/quiz-entry-back-audit.html` #6–#9、#11（檔案喺 `origin/claude/magical-hamilton-5ehx9e` `b7b1c0a`，唔喺本 branch，見 S-261）；用戶決定：文字返回掣沿用計劃 `setQuizBackText`、記憶法中途離開唔記錄返 ① 睇、已標記結果頁 header 都返已標記（底部「再做一份」照舊 Home）、版本 2.0.3
- **Design Origin**：`baseline: 計劃 quiz header「← Today's tasks」（setQuizBackText）`；CSS 只係 `css/screens/plan.css` nowrap selector 加 `#screenResult`
- **結果**：⚠️ warn — **80 / 100**，0 Critical、3 Warning（W-072–W-074）、5 Suggestion（S-257–S-261）

## 總評

設計乾淨：一個 `goBack` action 接管 quiz + Result header，路由集中喺 `sideSession.js goBack()`，次序（plan session → side session → Flagged → `goHome`）正確；`SESSION_LEAVES = { ...SESSION_RETURNS, memo: leaveMemoTest }` 只覆寫記憶法一個 kind，其他照用「↩ Back」嘅返回，冇複製邏輯。`goHome()` 本身冇改，所以考試確認、計劃模擬考 `planLeaveMock`、Result 底部「再做一份」行為不變。Label 全部 `escapeHtml(t(…))`，唯一參數係數字，冇 XSS 面。

Reviewer 逐條核對（scratch probe，唔入 repo）：
- **巢狀 Similar 喺 Flagged 入面**：zh-HK「‹ 返回第 1 題」→ 轉 en 後 `rerenderCurrentScreen` →「‹ Back to Q1」→ 返回 → 原 session 同一題，header 變「‹ Flagged」→ 再返回 → `screenFlagged`。正確。
- **計劃 session 入面冇 Similar side session**（`similarPanel.js:79` `practise: !isPlanSession()`），所以冇 plan → quiz 嘅巢狀遺失問題。
- **考試**：`startExam(1)` exam mode → header 🏠 → 撳 → confirm modal 開、仍喺 quiz。正確。
- **計劃模擬考**：`isPlanSession()` false、`sessionReturn` null、examNum 唔係 FLAGGED → `goHome()` → `planLeaveMock` confirm，同之前一樣。
- **語言切換**：`SCREEN_RERENDER.screenQuiz` → `renderQuestion` → `renderPlanQuizHeader` → `setEntryBack`；`screenResult` → `renderResults` → `setEntryBack`。兩個都會重畫 label。
- **Double-tap guard**（`actions.js` `isStrayClick`）：返回會換 view（screen 或 `state.questions`），guard 會 arm；第二下落喺新 view 同一位置（例如 Similar → 原 session 嘅「‹ Flagged」）會被食，唔會連跳兩層。正確，同 `returnFromSideSession` 一致。
- `planLeaveSession`：計劃已關 / task 已唔存在 → `planBackToDay` → `leaveToHome`；task 完成 → `planShowFacts(..., review=true)`，同 `planOpenTask` 一致；`planShowFacts` 會 `clearSideSession()`。
- 相關 suite 單獨跑：`back-to-entry`、`header-icons`、`plan-run2`、`upgrade`、`lang-switch`、`doubletap`、`similar`、`memo` 全部 PASS。

主要問題係邊界：W-057 類混合 cache（W-072）、`APP_VERSION 2.0.3` 同兩條未 merge branch 撞（W-073）、320px en 大字 Similar header 爆版（W-074）。

## Hard Gates

| Gate | 結果 | 說明 |
|---|---|---|
| Lint | n/a | repo 冇 ESLint；`structure-test` 喺 run-all |
| Type check | n/a | 冇 TypeScript |
| Tests | ✅ pass | 見「Tests 記錄」；reviewer run-all **67 / 67 PASS**；相關 8 套亦單獨 PASS |
| Coverage | n/a | 冇 coverage 工具；6 個流程 × 390 / 1280 |
| No Critical | ✅ pass | 0 |
| Security scan | n/a | 冇新增依賴 |

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 15 | 25 | W-072（混合 cache：quiz / Result throw、header 死掣）、W-074（320px en 大字橫向 scroll） |
| 安全性 | 20 | 20 | label 全部 escape，參數只有數字 |
| 可維護性 | 14 | 20 | W-073（版本號撞）、S-257（stale 註解） |
| 測試覆蓋 | 13 | 15 | S-259（zh-HK / 語言切換 / 巢狀 / 考試 / 320px 冇 test）、S-261（test 同實現同 commit、中間 commit 紅） |
| 性能 | 10 | 10 | 冇變 |
| 代碼風格 | 8 | 10 | S-258（返回後 focus，a11y）、S-260（‹ / ← 兩種箭咀） |
| **總分** | **80** | **100** | |

**結果：⚠️ warn**

## Design Fidelity

| 項目 | 結果 |
|---|---|
| Design Origin | `baseline:`，引用計劃 quiz header `setQuizBackText`（存在於 `js/screens/planRun.js`） |
| 改動範圍 | 冇新 className / layout；沿用 `.plan-hit` / `.icon-btn` 切換；CSS 只加一個 selector（`#screenResult .back-btn.plan-hit`）入現有 nowrap 規則 |
| Token / hardcoded 色 | 冇新色、冇新數值 |
| 偏離 | W-074：nowrap 文字掣喺 320px en 大字 Similar session 令 header 闊過容器（baseline 嘅「← Today's tasks」註解只驗 360px） |

## 問題清單

### 🟡 W-072 — 混合 cache（W-057 類）：舊 `sideSession.js` 令每題 throw；舊 `actions.js` 令 header 返回死掣

- **位置**：`js/screens/planRun.js:151`（`else setEntryBack(back)`）、`js/screens/result.js:41`、`index.html:218,277`（`data-action="goBack"`）、`js/core/actions.js:67`
- **描述**：Reviewer 用 current tree 換單一 `origin/main` 檔案試（scratch `mix.js`）：
  - 舊 `sideSession.js` + 其他新檔：`startFlaggedPractice()` → `renderQuestion` → `renderPlanQuizHeader` → **`ReferenceError: setEntryBack is not defined`**；每次 render 題目都 throw（所有 session，唔止新流程），Result 亦會喺 `renderResults` 中途 throw（diff table / dots / review 唔畫）。撳 header → `goBack is not defined`。
  - 舊 `actions.js` + 新 `index.html`：header 返回撳落冇反應，只有 `console.warn('[actions] no handler for data-action "goBack"')` — 練習中途冇路離開（只可做完）。
  - 兩個 locale 都舊：label 顯示 raw `quiz.backToFlagged` 等 key（只有一個舊會 fallback 去另一語言，唔會 raw）。
- **影響**：項目一路當 W-057 / W-055 / S-203 / S-205 處理（SW cache-first + GitHub Pages HTTP cache 10 分鐘）；v2.0.0 亦有 `typeof` guard。今次三個新跨檔 call 冇 guard，混合時 quiz 完全用唔到，比之前嗰啲 W 更嚴重。
- **方案 A（推薦）**：`typeof` guard + 最後 fallback 返 🏠：
  - `planRun.js`：`else if (typeof setEntryBack === 'function') setEntryBack(back); else setQuizBackHome(back);`
  - `result.js`：`if (typeof setEntryBack === 'function') setEntryBack(...)`
  - `actions.js`：`goBack: () => (typeof goBack === 'function' ? goBack() : goHome())`
  - `index.html` 保留 `data-action="goHome"`，由 `setQuizBackText` / `setQuizBackHome`（或 `setEntryBack`）runtime 改做 `goBack`，只有 `typeof ACTIONS !== 'undefined' && ACTIONS.goBack` 先改 → 舊 `actions.js` 照舊 goHome。
  - `entryBackHtml`：`t()` 返 key 本身就當冇（`null` → 🏠），同 S-201 / S-205 一樣唔顯示 raw key。
  - `upgrade-test` 加 ⑫：current shell + 單一 v2.0.2 `sideSession.js` / `actions.js` / 兩個 locale，assert 冇 page error、header 撳到。
  - Trade-off：多幾行 guard；保護同一類已知風險。
- **方案 B**：接受，喺 HANDOFF 記錄「v2.0.3 混合 cache 最多 10 分鐘 quiz 壞」。Trade-off：零改動，但同項目一貫標準唔一致，而且影響所有 quiz，唔止新流程。

### 🟡 W-073 — `APP_VERSION 2.0.3` 同兩條未 merge branch 撞（SW cache 名一樣）

- **位置**：`js/core/config.js:5`、`HANDOFF.md:624`
- **描述**：`origin/claude/beautiful-cerf-makp0n`（CUI-0034 desktop quiz 左欄 fix）同 `origin/claude/charming-archimedes-hrh4wd`（v1.6.1 batch + merge main，佢自己嘅 review `ddf7901` 已經開咗 W-070 講同一件事）都已經將 `APP_VERSION` 升做 **2.0.3**。
- **影響**：`sw.js` cache 名 `lifeuk-v` + `APP_VERSION`；第二個 merge 入 `main` 嘅 branch 唔會觸發已安裝 PWA 更新（cache 名冇變 → 舊 shell 留住），HANDOFF 版本表亦會有兩行 v2.0.3。
- **方案 A（推薦）**：merge 前同用戶 / main agent 定次序；後 merge 嗰條改 2.0.4（或 2.0.5），連 HANDOFF 行、`desktop-base-test` 等版本 assertion 一齊改。
- **方案 B**：三條 branch 合併做一個 release 2.0.3（一次 merge、一行 HANDOFF 合併描述）。Trade-off：要協調另外兩個 session。

### 🟡 W-074 — 320px en 大字：Similar session「‹ Back to Q24」令 header 爆版、頁面橫向 scroll

- **位置**：`css/screens/plan.css:405`（`#screenQuiz .back-btn.plan-hit` nowrap）、`locales/en.js` `quiz.backToQuestion`
- **描述**：Reviewer probe（scratch `narrow2.js`）：320 × 640、en、⚙ 大字、Easy 第 22 / 24 題 → Similar Practise：back 掣 128px（nowrap）+ `.quiz-meta` 180px，`.quiz-header` scrollWidth 308 > clientWidth 288，`document.documentElement.scrollWidth` **324 > 320**。同一 session 換返 🏠 icon 就 288 / 320 冇事；340px 以上冇爆；zh-HK 大細字、en 細字、「‹ Study」/「‹ Flagged」冇爆。
- **影響**：項目一直驗 320px 冇橫向 scroll（v1.3.0、v1.5.1 review）；呢個係今次新增嘅 regression，test 只跑 390 / 1280。
- **方案 A（推薦）**：en label 縮短做「‹ Q24」（zh-HK「‹ 第 24 題」），`aria-label` / `title` 保留完整「Back to question 24」（注意 S-188：純文字唔使 `lang` span，可以用 aria-label）。`back-to-entry-test` 加 320px en 大字 `scrollWidth <= innerWidth`。
- **方案 B**：`.quiz-meta { min-width: 0 }` + `.quiz-label` 可以 ellipsis，讓 meta 縮。Trade-off：「Similar Questions」可能被截；要再驗其他 session label。

### 🟢 S-257 — stale 註解：header 已唔再 call `goHome`

- **位置**：`js/screens/planRun.js:125`（「the quiz header's 🏠 reads "← Today's tasks" … (goHome goes back to the day there)」）、`js/screens/home.js:170`（「the quiz header reads "← Today's tasks" in a plan task」）
- **建議 A**：改註解指向 `goBack` / `planLeaveSession`；`goHome` 嘅 plan 分支保留做防守並註明。**建議 B**：刪 `goHome` plan 分支（而家 markup 冇路去到）。Trade-off：B 少一行但冇防守。推薦 A。

### 🟢 S-258 — 返回後 keyboard focus 掉咗

- **位置**：`sideSession.js goBack()`（Flagged 分支）、`planRun.js planLeaveSession()`
- **描述**：`showScreen` 會甩 focus；`memoLook` 有 S-227 focus 標題、`planBackToDay` focus task 格，但返 Flagged 同返計劃 fact 卡冇 focus，讀屏 / keyboard 用戶落咗 `body`。
- **建議 A**：Flagged focus `#flaggedStart`（或標題）`{ preventScroll: true }`；fact 卡 focus `.plan-run-head`。**建議 B**：記錄，跟 Study 返回（`flashStudyFact`）一齊將來統一處理。

### 🟢 S-259 — test 缺口

- `back-to-entry-test` 只驗 en：冇 zh-HK label、冇語言切換重畫（`rerenderCurrentScreen`）、冇巢狀 Similar-in-Flagged（返回後應「‹ Flagged」再返 list）、冇考試 exam mode 撳返回出 confirm、冇計劃模擬考、冇 320px（W-074）、#7 冇 assert 返嚟係同一張 fact 卡 / scroll。Reviewer 已手動驗頭三項 OK。建議加 2–3 個細 case（巢狀 + 考試 confirm + zh-HK）。

### 🟢 S-260 — 同一粒掣兩種箭咀（‹ / ←）

- 新 label 用「‹」，計劃（包括新 `plan.run.backFact`）用「←」。用戶揀咗沿用計劃 pattern；記錄，問用戶要唔要統一（唔阻）。

### 🟢 S-261 — TDD 次序 / bisect / audit 檔位置（記錄）

- `back-to-entry-test` 同實現喺同一 commit `5cf3493`，冇紅燈 commit；`header-icons-test` / `plan-run2-test` 要到 `fe89929` 先跟，`5cf3493` 單獨係紅（bisect 會停錯位）。新 test 喺 `origin/main` app 檔一定 fail（冇「‹ Flagged」等 label，返回去 Home），紅燈理論成立。
- HANDOFF v2.0.3 行引用 `.proj-docs/qa/quiz-entry-back-audit.html`，但檔案喺 `origin/claude/magical-hamilton-5ehx9e`，本 branch 冇；merge 前要一齊帶入或改引用 commit。

## Tests 記錄

- 單獨 PASS：`back-to-entry-test`、`header-icons-test`、`plan-run2-test`、`upgrade-test`、`lang-switch-test`、`doubletap-test`、`similar-test`、`memo-test`。
- Full run-all（reviewer，2026-10-13）：**67 / 67 PASS**（今次 `fontsize-test` 都冇 flake）。跑完 `git checkout -- tests/shot-*.png`。

## ✅ 做得好嘅地方

- `SESSION_LEAVES` spread `SESSION_RETURNS` 只覆寫 memo：「中途離開 = ↩ Back 但唔 finish」嘅語意一句講晒，加新 kind 自動有返回。
- `goHome()` 冇郁：考試 confirm、模擬考、底部「再做一份」全部零風險。
- `isFlaggedSession` 用 `examNum` 判斷，Retry 保留 FLAGGED 都自然得到返回 list，唔使額外 state。
- Label 統一經 `entryBackHtml()` escape，計劃自己嘅 `planQuizBackHtml` 分開，責任清楚。
- `planLeaveSession` 對 task 已完成用 review 模式、計劃已關退 `planBackToDay` → Home，邊界周到。
- Test 兩個 viewport × 6 流程，有 page error 檢查同「冇記錄」assert。

## 修正優先順序

| 次序 | ID | 必要性 |
|---|---|---|
| 1 | W-073 | merge 前必須決定（版本 / SW cache） |
| 2 | W-072 | 建議 merge 前修（方案 A + upgrade-test ⑫） |
| 3 | W-074 | 建議 merge 前修（縮短 label + 320px assert） |
| 4 | S-259 | 跟 W-072 / W-074 一齊補 test |
| 5 | S-257、S-258 | 可同批 |
| 6 | S-260、S-261 | 記錄 / 問用戶 |

## 修訂後代碼（建議，未套用）

```js
// js/screens/planRun.js — W-072: a cached pre-v2.0.3 sideSession.js has no setEntryBack; the 🏠 stays
function renderPlanQuizHeader() {
  const back = byId('screenQuiz').querySelector('.back-btn');
  const session = isPlanSession(), plan = session || isPlanMock();
  if (plan) setQuizBackText(back, planQuizBackHtml(session));
  else if (typeof setEntryBack === 'function') setEntryBack(back);
  else setQuizBackHome(back);
  // …
}

// js/screens/result.js — W-072
if (typeof setEntryBack === 'function') setEntryBack(byId('screenResult').querySelector('.back-btn'));

// js/core/actions.js — W-072: a cached pre-v2.0.3 sideSession.js has no goBack
goBack: () => (typeof goBack === 'function' ? goBack() : goHome()),

// js/screens/sideSession.js — W-072: a stale locale without the key keeps the 🏠 instead of a raw key
function entryBackText(key, params) {
  const text = t(key, params);
  return text === key ? null : escapeHtml(text);
}
```

```js
// locales/en.js — W-074: short visible label; the full words as the accessible name
backToQuestion: '‹ Q{n}',
backToQuestionLabel: 'Back to question {n}',
```

## Handoff receipt

```handoff-receipt
protocol: 1
status: warn
score: 80/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
  no_critical: pass
  security_scan: n/a
next_action: invoke_developer
next_agent: frontend-developer
branch: "fix/quiz/back-to-entry"
context: "v2.0.3 back-to-entry (origin/main..fe89929) warn 80, 0 C / 3 W / 5 S. run-all 67/67 PASS. Routing verified: plan session -> planLeaveSession, side session -> SESSION_LEAVES (memo records nothing), Flagged -> openFlagged, else goHome (exam confirm + plan mock unchanged); nested Similar-in-Flagged, zh-HK -> en re-render, exam confirm, double-tap guard all OK by probe. Labels escaped. W-072 mixed cache: old sideSession.js -> ReferenceError setEntryBack on every renderQuestion/renderResults; old actions.js -> dead header back (fix: typeof guards + upgrade-test case). W-073 APP_VERSION 2.0.3 collides with origin/claude/beautiful-cerf-makp0n and origin/claude/charming-archimedes-hrh4wd (same SW cache name) - decide merge order / renumber before merge. W-074 320px en large text Similar session header overflows (doc scrollWidth 324). S-257 stale goHome comments, S-258 focus after back, S-259 test gaps, S-260 arrow glyphs, S-261 TDD order + audit file not on branch."
blockers: ["W-072", "W-073", "W-074"]
```

下一個新號（merge `main` v2.1.0 後改號，見頂部）：C-007、W-075、S-264、CUI-0041。

---

# Re-review — v2.0.5（`68acc31..1a5b1a8`）

- **日期**：2026-10-13
- **審閱者**：Code Reviewer（獨立）
- **目標**：branch `fix/quiz/back-to-entry` HEAD `1a5b1a8`；跟進 commit `68acc31`（W-072）、`bdc02ee`（W-073）、`8e93a86`（W-074、S-260）、`96640f4`（S-257）、`f3d1e7a`（S-258）、`fa0aa83`（S-259）、`1a5b1a8`（HANDOFF）；另 `78641fa` 將 audit 檔帶入 branch（S-261）。19 個檔案，+267 / −78
- **用戶決定**：版本 2.0.5（2.0.3 / 2.0.4 留俾未 merge 嘅 `claude/charming-archimedes-hrh4wd`、`claude/beautiful-cerf-makp0n`）；所有返回掣箭咀統一「‹」（`plan.day.backToday` 日曆 chip「← Back to today」刻意不變）
- **同 plan 嘅偏離（已核對，接受）**：`index.html` header 掣保留 `data-action="goHome"`；`planRun.js` 新 `setQuizBackAction` 只喺 `ACTIONS.goBack` 存在先改 `goBack`；`structure-test` 加讀 `dataset.action = …` 入面嘅 action 名
- **結果**：✅ pass — **97 / 100**，0 Critical、0 Warning、2 Suggestion（S-262、S-263）

## 逐條核對

| ID | 狀態 | 核對 |
|---|---|---|
| W-072 | ✅ 已修 | `renderPlanQuizHeader` / `renderResults` `typeof setEntryBack` guard；`ACTIONS.goBack` fallback `goHome`；`setEntryBack` 冇 `hasGoBackAction` 就 🏠；`entryBackText` / `planQuizBackHtml` 遇 raw key 退 🏠 / 日子 label。upgrade-test ⑫（v2.0.2 `sideSession.js` / `actions.js` / `en.js` 各自 + current shell）PASS。Reviewer 另 probe（scratch `probe.js`，唔入 repo）plan ⑫ 冇包嘅 v2.0.2 `planRun.js`、`result.js`：0 page error、header 撳到（舊 `planRun.js` → 🏠 goHome → Home；舊 `result.js` → quiz「‹ Flagged」goBack 正常、Result 🏠 goHome）。冇 `ReferenceError`、冇死掣 |
| W-073 | ✅ 已修 | `APP_VERSION = '2.0.5'`；`HANDOFF.md` 版本行 v2.0.5；`desktop-base-test` 只 assert `2.x`；註解 / test 一併改 v2.0.5 |
| W-074 | ✅ 已修 | 可見 label 縮做「‹ Q{n}」/「‹ 第 {n} 題」，accessible name「Back to Q{n}」/「返回第 {n} 題」（包含可見字，WCAG 2.5.3 label-in-name OK；純文字冇 `lang` span，唔觸 S-188）。`checkSimilarNarrow`：320 × 640 en 大字、兩位數題號 → page scrollWidth ≤ innerWidth、header 冇溢出 |
| S-257 | ✅ 已修 | `home.js goHome` plan 分支保留做防守 + 註明（`goHome` caller、舊 `actions.js`）；`planRun.js` header 註解改指 `goBack` / `planLeaveSession` / `planLeaveMock`。殘留一處見 S-263 |
| S-258 | ✅ 已修 | Flagged → `#flaggedStart`（隱藏時第一粒 list 掣）；plan fact → 卡上 ▶ 練習（review 時 nav-row 主掣），`preventScroll`。test assert 兩邊 `activeElement` |
| S-259 | ✅ 已修 | 新增 zh-HK 五個 label + zh ↔ en 重畫（包括 Similar 嘅 name）、Similar-in-Flagged 兩次返回（中間等過 double-tap guard）、考試 🏠 + confirm、320px、#7 同一張 fact 卡 flash + 喺 viewport。計劃模擬考仍冇獨立 test（路由冇變，`goHome` → `planLeaveMock`，可接受） |
| S-260 | ✅ 已解（用戶決定） | `quiz.backTo*`、`plan.run.backToday` / `backDayHtml` / `backFact` 全部「‹」；`plan.day.backToday` 日曆 chip、`prevButton`「← Prev」唔係返回掣，刻意不變。相關 test assert 已跟 |
| S-261 | ✅ 部分 | audit 檔 `78641fa` 已喺 branch；跟進 commit 都係 test 同實現同 commit（`68acc31`、`8e93a86`、`f3d1e7a`），每個 commit 自己綠，冇再出現中間紅 commit。記錄，唔阻 |

## 偏離核對（`setQuizBackAction` / structure-test）

- `ACTIONS` 係 `actions.js` top-level `const`，classic script 共用 global lexical scope，`typeof ACTIONS` 喺 runtime（render 時）一定已定義；舊 `actions.js` 冇 `goBack` → 掣保持 `goHome`，同 `index.html` 一致。
- 所有 header 寫入點（`setQuizBackText`、`setQuizBackHome`）都經 `setQuizBackAction`，所以由 plan session 轉去普通 session、或者 Similar 返原 session，action 會跟住重設，冇殘留。
- 計劃模擬考：`goBack` → 唔係 plan / side / Flagged → `goHome` → `planLeaveMock` confirm，同 v2.0.2 一樣。考試：🏠 → confirm（test 已驗）。
- `structure-test` 新 regex 只抽 `dataset.action = …` 右邊嘅單引號字串（`'goBack'`、`'goHome'`），兩個都喺 `ACTIONS`；冇放寬其他檢查。

## Hard Gates

| Gate | 結果 | 說明 |
|---|---|---|
| Lint | n/a | repo 冇 ESLint；`structure-test` 喺 run-all |
| Type check | n/a | 冇 TypeScript |
| Tests | ✅ pass | run-all 66 / 67 PASS 第一次（`fontsize-test`「S-203 resize to 320px … level cards stack」fail，已知 flake：v1.3.1 / v1.4.1 / v1.5.1 review 都記錄過，今次冇改 CSS / fontsize）；單獨重跑 `fontsize-test` 3 / 3 PASS → 當 pass；`back-to-entry`、`upgrade`、`structure`、`header-icons`、`lang-switch`、`plan-run`、`plan-run2` 全部 PASS；跑完 `git checkout -- tests/shot-*.png` |
| Coverage | n/a | 冇 coverage 工具；back-to-entry 9 個 check × 390 / 1280 + 320px |
| No Critical | ✅ pass | 0 |
| Security scan | n/a | 冇新增依賴 |

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 24 | 25 | S-262（舊 locale 混合 cache：🏠 icon 但去入口唔係 Home） |
| 安全性 | 20 | 20 | label 照舊 `escapeHtml`；accessible name 經 `setAttribute` |
| 可維護性 | 19 | 20 | S-263（殘留「←」註解 / assert message） |
| 測試覆蓋 | 14 | 15 | S-261 TDD 次序（記錄）；計劃模擬考冇獨立 test |
| 性能 | 10 | 10 | 冇變 |
| 代碼風格 | 10 | 10 | |
| **總分** | **97** | **100** | |

**結果：✅ pass**

## 新發現

### 🟢 S-262 — 舊 locale（混合 cache）：🏠 icon 但撳落去入口，唔係 Home

- **位置**：`js/screens/sideSession.js` `setEntryBack()`（`if (!text) { setQuizBackHome(back); return; }`）、`js/screens/planRun.js` `setQuizBackHome()` → `setQuizBackAction`
- **描述**：Reviewer probe：current shell + v2.0.2 `locales/en.js`，Flagged practice → header 顯示 🏠（aria-label「Home」，冇 raw key ✓），但 `data-action="goBack"`，撳落去 Flagged list；Similar session 會返原 session。冇 error、唔係死掣，只係 icon / 名同去向唔一致，最多 HTTP cache 10 分鐘。正常（非混合）情況下 🏠 只出現喺 Home 入口 session，`goBack` → `goHome`，一致。
- **方案 A**：`setEntryBack` 喺 label 存在但 locale 缺 key 嗰陣 `setQuizBackHome(back); back.dataset.action = 'goHome';`（或者 `setQuizBackHome(back, { action: 'goHome' })`）。Trade-off：多一行；🏠 永遠 = Home。
- **方案 B**：接受（混合 cache 短暫、可以離開 session、行為合理）。推薦 B，或者下次郁呢度先做 A。

### 🟢 S-263 — 殘留「←」：註解同 test assert message

- **位置**：`js/screens/planRun.js:230`（`planLeaveSession` 註解「← mid-session」）；`tests/plan-run-test.js:131,190,205,257,389,391,530` assert message 仍寫「← Today's tasks」/「←」（判斷值已係「‹」，只係字串描述）
- **建議 A**：一個 docs/test commit 改做「‹」。**建議 B**：留低（唔影響行為）。推薦 A，同下一次碰 plan-run 一齊。

## 回歸檢查

- `goHome()` 冇改語意（只改註解）；底部「再做一份」、考試 confirm、`planLeaveMock` 不變。
- Plan session header：`setQuizBackText` 冇 `name` → 仍然移除 `aria-label` / `title`（S-188，`header-icons-test` assert）。
- Double-tap guard：focus 用 `preventScroll`，唔觸發 click / scroll；Similar-in-Flagged test 驗咗「快第二下被食、慢第二下返 list」。
- Lang switch：`lang-switch-test` plan runner「‹ Day 3 任務」PASS。

## ✅ 做得好嘅地方

- W-072 由 plan 改做「HTML 寫 `goHome`、runtime 確認有 handler 先升級」，比單純 guard handler 更穩：舊 `actions.js` 永遠唔會見到未知 action；structure-test 同步識得 runtime action，冇留盲點。
- upgrade-test ⑫ 逐個舊檔、assert page error + console「no handler」+ raw key + 實際撳掣，覆蓋晒原 finding 三個症狀。
- W-074 用短 label + 完整 accessible name，同時顧到 320px 同讀屏，test 揀最後一條有 Similar 嘅題（兩位數）做最壞情況。
- Commit 一個 review item 一個，message 帶 ID，符合 Fix Convention。

## 修正優先順序

| 次序 | ID | 必要性 |
|---|---|---|
| 1 | S-263 | 可選，下次碰 plan-run |
| 2 | S-262 | 可選（推薦接受） |

## Handoff receipt（re-review）

```handoff-receipt
protocol: 1
status: pass
score: 97/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
  no_critical: pass
  security_scan: n/a
next_action: invoke_qa
next_agent: quality-assurance
branch: "fix/quiz/back-to-entry"
context: "Re-review v2.0.5 back-to-entry (68acc31..1a5b1a8, HEAD 1a5b1a8) pass 97, 0 C / 0 W / 2 S. run-all 66/67 first pass, the 1 fail is the known fontsize-test S-203 flake (no CSS change), fontsize-test rerun 3/3 PASS; back-to-entry, upgrade, structure, header-icons, lang-switch, plan-run, plan-run2 PASS. W-072 fixed (typeof guards, index.html stays goHome + setQuizBackAction upgrades to goBack only when ACTIONS.goBack exists, upgrade-test case 12 PASS; reviewer probe of v2.0.2 planRun.js / result.js mixes also 0 errors). W-073 fixed (APP_VERSION 2.0.5, HANDOFF row). W-074 fixed (short '‹ Q{n}' label + 'Back to Q{n}' accessible name, 320px en large test). S-257/S-258/S-259 fixed, S-260 resolved by user decision (all back arrows ‹; plan.day.backToday chip unchanged), S-261 audit file now on branch (TDD order noted). New: S-262 stale-locale mix shows 🏠 but goBack goes to the entry (harmless, ≤10 min); S-263 leftover '←' in a planRun.js comment and plan-run-test assert messages. Version 2.0.3/2.0.4 reserved for the two unmerged branches - keep merge order in mind."
blockers: []
```

下一個新號（merge `main` v2.1.0 後改號，見頂部）：C-007、W-075、S-264、CUI-0041。
