# Code Review — v2.0.3 做題中途返回，返去原本入口（back-to-entry）

- **日期**：2026-10-13
- **審閱者**：Code Reviewer（獨立）
- **目標**：branch `fix/quiz/back-to-entry`，`origin/main..fe89929`（`5cf3493` fix、`bbdb973` HANDOFF、`fe89929` test 跟進）；15 個檔案，+232 / −9
- **依據**：audit `.proj-docs/qa/quiz-entry-back-audit.html` #6–#9、#11（檔案喺 `origin/claude/magical-hamilton-5ehx9e` `b7b1c0a`，唔喺本 branch，見 S-258）；用戶決定：文字返回掣沿用計劃 `setQuizBackText`、記憶法中途離開唔記錄返 ① 睇、已標記結果頁 header 都返已標記（底部「再做一份」照舊 Home）、版本 2.0.3
- **Design Origin**：`baseline: 計劃 quiz header「← Today's tasks」（setQuizBackText）`；CSS 只係 `css/screens/plan.css` nowrap selector 加 `#screenResult`
- **結果**：⚠️ warn — **80 / 100**，0 Critical、3 Warning（W-071–W-073）、5 Suggestion（S-254–S-258）

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

主要問題係邊界：W-057 類混合 cache（W-071）、`APP_VERSION 2.0.3` 同兩條未 merge branch 撞（W-072）、320px en 大字 Similar header 爆版（W-073）。

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
| 正確性 | 15 | 25 | W-071（混合 cache：quiz / Result throw、header 死掣）、W-073（320px en 大字橫向 scroll） |
| 安全性 | 20 | 20 | label 全部 escape，參數只有數字 |
| 可維護性 | 14 | 20 | W-072（版本號撞）、S-254（stale 註解） |
| 測試覆蓋 | 13 | 15 | S-256（zh-HK / 語言切換 / 巢狀 / 考試 / 320px 冇 test）、S-258（test 同實現同 commit、中間 commit 紅） |
| 性能 | 10 | 10 | 冇變 |
| 代碼風格 | 8 | 10 | S-255（返回後 focus，a11y）、S-257（‹ / ← 兩種箭咀） |
| **總分** | **80** | **100** | |

**結果：⚠️ warn**

## Design Fidelity

| 項目 | 結果 |
|---|---|
| Design Origin | `baseline:`，引用計劃 quiz header `setQuizBackText`（存在於 `js/screens/planRun.js`） |
| 改動範圍 | 冇新 className / layout；沿用 `.plan-hit` / `.icon-btn` 切換；CSS 只加一個 selector（`#screenResult .back-btn.plan-hit`）入現有 nowrap 規則 |
| Token / hardcoded 色 | 冇新色、冇新數值 |
| 偏離 | W-073：nowrap 文字掣喺 320px en 大字 Similar session 令 header 闊過容器（baseline 嘅「← Today's tasks」註解只驗 360px） |

## 問題清單

### 🟡 W-071 — 混合 cache（W-057 類）：舊 `sideSession.js` 令每題 throw；舊 `actions.js` 令 header 返回死掣

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

### 🟡 W-072 — `APP_VERSION 2.0.3` 同兩條未 merge branch 撞（SW cache 名一樣）

- **位置**：`js/core/config.js:5`、`HANDOFF.md:624`
- **描述**：`origin/claude/beautiful-cerf-makp0n`（CUI-0034 desktop quiz 左欄 fix）同 `origin/claude/charming-archimedes-hrh4wd`（v1.6.1 batch + merge main，佢自己嘅 review `ddf7901` 已經開咗 W-070 講同一件事）都已經將 `APP_VERSION` 升做 **2.0.3**。
- **影響**：`sw.js` cache 名 `lifeuk-v` + `APP_VERSION`；第二個 merge 入 `main` 嘅 branch 唔會觸發已安裝 PWA 更新（cache 名冇變 → 舊 shell 留住），HANDOFF 版本表亦會有兩行 v2.0.3。
- **方案 A（推薦）**：merge 前同用戶 / main agent 定次序；後 merge 嗰條改 2.0.4（或 2.0.5），連 HANDOFF 行、`desktop-base-test` 等版本 assertion 一齊改。
- **方案 B**：三條 branch 合併做一個 release 2.0.3（一次 merge、一行 HANDOFF 合併描述）。Trade-off：要協調另外兩個 session。

### 🟡 W-073 — 320px en 大字：Similar session「‹ Back to Q24」令 header 爆版、頁面橫向 scroll

- **位置**：`css/screens/plan.css:405`（`#screenQuiz .back-btn.plan-hit` nowrap）、`locales/en.js` `quiz.backToQuestion`
- **描述**：Reviewer probe（scratch `narrow2.js`）：320 × 640、en、⚙ 大字、Easy 第 22 / 24 題 → Similar Practise：back 掣 128px（nowrap）+ `.quiz-meta` 180px，`.quiz-header` scrollWidth 308 > clientWidth 288，`document.documentElement.scrollWidth` **324 > 320**。同一 session 換返 🏠 icon 就 288 / 320 冇事；340px 以上冇爆；zh-HK 大細字、en 細字、「‹ Study」/「‹ Flagged」冇爆。
- **影響**：項目一直驗 320px 冇橫向 scroll（v1.3.0、v1.5.1 review）；呢個係今次新增嘅 regression，test 只跑 390 / 1280。
- **方案 A（推薦）**：en label 縮短做「‹ Q24」（zh-HK「‹ 第 24 題」），`aria-label` / `title` 保留完整「Back to question 24」（注意 S-188：純文字唔使 `lang` span，可以用 aria-label）。`back-to-entry-test` 加 320px en 大字 `scrollWidth <= innerWidth`。
- **方案 B**：`.quiz-meta { min-width: 0 }` + `.quiz-label` 可以 ellipsis，讓 meta 縮。Trade-off：「Similar Questions」可能被截；要再驗其他 session label。

### 🟢 S-254 — stale 註解：header 已唔再 call `goHome`

- **位置**：`js/screens/planRun.js:125`（「the quiz header's 🏠 reads "← Today's tasks" … (goHome goes back to the day there)」）、`js/screens/home.js:170`（「the quiz header reads "← Today's tasks" in a plan task」）
- **建議 A**：改註解指向 `goBack` / `planLeaveSession`；`goHome` 嘅 plan 分支保留做防守並註明。**建議 B**：刪 `goHome` plan 分支（而家 markup 冇路去到）。Trade-off：B 少一行但冇防守。推薦 A。

### 🟢 S-255 — 返回後 keyboard focus 掉咗

- **位置**：`sideSession.js goBack()`（Flagged 分支）、`planRun.js planLeaveSession()`
- **描述**：`showScreen` 會甩 focus；`memoLook` 有 S-227 focus 標題、`planBackToDay` focus task 格，但返 Flagged 同返計劃 fact 卡冇 focus，讀屏 / keyboard 用戶落咗 `body`。
- **建議 A**：Flagged focus `#flaggedStart`（或標題）`{ preventScroll: true }`；fact 卡 focus `.plan-run-head`。**建議 B**：記錄，跟 Study 返回（`flashStudyFact`）一齊將來統一處理。

### 🟢 S-256 — test 缺口

- `back-to-entry-test` 只驗 en：冇 zh-HK label、冇語言切換重畫（`rerenderCurrentScreen`）、冇巢狀 Similar-in-Flagged（返回後應「‹ Flagged」再返 list）、冇考試 exam mode 撳返回出 confirm、冇計劃模擬考、冇 320px（W-073）、#7 冇 assert 返嚟係同一張 fact 卡 / scroll。Reviewer 已手動驗頭三項 OK。建議加 2–3 個細 case（巢狀 + 考試 confirm + zh-HK）。

### 🟢 S-257 — 同一粒掣兩種箭咀（‹ / ←）

- 新 label 用「‹」，計劃（包括新 `plan.run.backFact`）用「←」。用戶揀咗沿用計劃 pattern；記錄，問用戶要唔要統一（唔阻）。

### 🟢 S-258 — TDD 次序 / bisect / audit 檔位置（記錄）

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
| 1 | W-072 | merge 前必須決定（版本 / SW cache） |
| 2 | W-071 | 建議 merge 前修（方案 A + upgrade-test ⑫） |
| 3 | W-073 | 建議 merge 前修（縮短 label + 320px assert） |
| 4 | S-256 | 跟 W-071 / W-073 一齊補 test |
| 5 | S-254、S-255 | 可同批 |
| 6 | S-257、S-258 | 記錄 / 問用戶 |

## 修訂後代碼（建議，未套用）

```js
// js/screens/planRun.js — W-071: a cached pre-v2.0.3 sideSession.js has no setEntryBack; the 🏠 stays
function renderPlanQuizHeader() {
  const back = byId('screenQuiz').querySelector('.back-btn');
  const session = isPlanSession(), plan = session || isPlanMock();
  if (plan) setQuizBackText(back, planQuizBackHtml(session));
  else if (typeof setEntryBack === 'function') setEntryBack(back);
  else setQuizBackHome(back);
  // …
}

// js/screens/result.js — W-071
if (typeof setEntryBack === 'function') setEntryBack(byId('screenResult').querySelector('.back-btn'));

// js/core/actions.js — W-071: a cached pre-v2.0.3 sideSession.js has no goBack
goBack: () => (typeof goBack === 'function' ? goBack() : goHome()),

// js/screens/sideSession.js — W-071: a stale locale without the key keeps the 🏠 instead of a raw key
function entryBackText(key, params) {
  const text = t(key, params);
  return text === key ? null : escapeHtml(text);
}
```

```js
// locales/en.js — W-073: short visible label; the full words as the accessible name
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
context: "v2.0.3 back-to-entry (origin/main..fe89929) warn 80, 0 C / 3 W / 5 S. run-all 67/67 PASS. Routing verified: plan session -> planLeaveSession, side session -> SESSION_LEAVES (memo records nothing), Flagged -> openFlagged, else goHome (exam confirm + plan mock unchanged); nested Similar-in-Flagged, zh-HK -> en re-render, exam confirm, double-tap guard all OK by probe. Labels escaped. W-071 mixed cache: old sideSession.js -> ReferenceError setEntryBack on every renderQuestion/renderResults; old actions.js -> dead header back (fix: typeof guards + upgrade-test case). W-072 APP_VERSION 2.0.3 collides with origin/claude/beautiful-cerf-makp0n and origin/claude/charming-archimedes-hrh4wd (same SW cache name) - decide merge order / renumber before merge. W-073 320px en large text Similar session header overflows (doc scrollWidth 324). S-254 stale goHome comments, S-255 focus after back, S-256 test gaps, S-257 arrow glyphs, S-258 TDD order + audit file not on branch."
blockers: ["W-071", "W-072", "W-073"]
```

下一個新號：C-007、W-074、S-259（W-381 / S-249 屬另一 session；`origin/claude/charming-archimedes-hrh4wd` 用咗 W-070、S-250–S-253）。
