# Code Review — 溫習計劃 PR6a（T-329–T-334 + G37）

- 日期：2026-10-09
- 審閱者：Code Reviewer（獨立）
- 目標：branch `claude/charming-hopper-48ypzp`（HEAD ff7a809；559beea PR6a、92405c7 G37、ff7a809 360px fix），diff = `git diff origin/main...HEAD`（25 files，+1001 / −61）
- Design Origin：`mockup:mockups/study-plan-flow.html#runner`
- 總評：結構乾淨，答題介面真係重用 Practice（screenQuiz），冇複製任何答題 markup；現有 Practice / 錯題 / Flagged / Similar 行為逐行核對 0 改動（visual-diff 76 個狀態 IDENTICAL）。發現 1 個 Warning（G37 已掌握題令「第 n 輪（共 N 輪）」多計輪數）、1 個 Suggestion（完成卡冇焦點管理）。

## Hard Gates

| Gate | 結果 | 備注 |
|------|------|------|
| Lint | n/a | 項目冇 linter（純 classic script）|
| Type check | n/a | 冇 TS |
| Tests | pass | `run-all.sh` 37 個測試全部 PASS（plan-test 2699 checks、plan-run-test 新增）|
| Coverage | n/a | 冇 coverage 工具；plan-run-test 覆蓋分輪、跳過、答錯重出、補做 / 提早、重溫 0 寫入、雙擊、44px、對比、3 寬度 × 2 語言 |
| No Critical | pass | 0 |
| Security scan | n/a | 冇新依賴 |
| Visual diff | pass | `visual-diff.js origin/main`：VISUAL IDENTICAL（76 states）|

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 20 | 25 | W-038 |
| 安全性 | 20 | 20 | innerHTML 只插 locale 字串 + escapeHtml / 數字 |
| 可維護性 | 19 | 20 | S-121 |
| 測試覆蓋 | 15 | 15 | |
| 性能 | 10 | 10 | 實測 183 日計劃 `planRunContext` 0.65 ms、`planLoadLogView` 0.08 ms |
| 代碼風格 | 10 | 10 | 函數全部 ≤ 30 行；token 齊；書面語 OK |
| **總分** | **94** | **100** | |

**結果：pass**（建議喺同一 branch 先修 W-038 再 merge，成本好細）

## 問題清單

### 🟡 W-038 — G37 已掌握題令輪數多計（「第 1 輪（共 2 輪）」但只得一輪）

- 位置：`js/screens/planRun.js:58–62`（`planStartRound`）
- 描述：`all = planTaskQids(ctx.task)` 包括已掌握（🏆）題，但 `planNextRound` 已將佢哋剔走唔問（G37）。`rounds = ceil(all.length / 24)` 因此計多咗；`seen` 又唔計已掌握題。
- 實測（scratchpad 腳本，2026-10-01 練習任務 39 題、19 題已掌握）：實際問 20 題（一輪完），roundNote 顯示「Round 1 of 2」，答完就出「Finish」→ 完成卡。用戶以為仲有第 2 輪。
- 影響：用戶睇到嘅進度唔準（G37 之後由以前 Practice 掌握咗題目嘅用戶好常見）。唔影響寫入 / 完成度。
- 方案 A：喺 `planStartRound` 用「要問嘅題」計：`const m = planTaskMastered(ctx.task, ctx.dayLog); const all = planTaskQids(ctx.task).filter(k => !m.has(k));`（或者 domain 加 `planAskableQids(task, dayLog)` 俾 `planNextRound` / `planRetryLeft` / runner 共用）。Trade-off：最細改動；domain helper 版本可以順手 DRY 三處 `filter(!m.has)`。
- 方案 B：rounds = `n + ceil(餘下未答啱題 / 24) − 1`（按剩餘數計）。Trade-off：中途入場都準，但同現有「按已答題推算 n」邏輯唔一致，要改多啲 test。
- 推薦：A（domain helper 版本），plan-run-test 加一個「部分已掌握 → 冇 Round 1 of 2」assert。

### 🟢 S-121 — 完成卡（#screenPlanRun）冇焦點管理

- 位置：`js/screens/planRun.js:167–173`（`planShowTaskDone`）
- 描述：鍵盤用戶喺最後一題撳「完成」後，`#nextBtn` 隨 screenQuiz 收埋，焦點跌返 `body`；螢幕閱讀器亦冇讀出「此項已完成 · 今日完成度 n%」。PR5 嘅計劃畫面（`openPlanDay` → `planDayHeading.focus`）已有呢個慣例。
- 方案 A：`.result-label` 加 `tabindex="-1"`（或者用 `<h2>`），render 後 `focus({ preventScroll: true })`。Trade-off：同 planDay 一致。
- 方案 B：card 加 `role="status"` 只做讀出，焦點落第一個掣（「重溫此項內容」）。Trade-off：鍵盤直接可操作，但跳過咗結果內容。
- 推薦：A。

## Developer 自報偏離 — 判斷

| 偏離 | 判斷 |
|------|------|
| 主頁「繼續」直接開 runner；下一項係讀 / 錯題知識點 / 模擬考就開 Day 畫面 | 接受。PR6b 補齊前合理 fallback；完成卡「開始下一項」遇到讀書任務都係落 Day 畫面，同一邏輯 |
| runner header 用「Chapter n」/「錯題」唔用 examLabel「Day n」 | 接受。Day n 已喺 ← 掣（補做日）出現，label 講內容更有用 |
| key 放 `plan.run.*` | 接受 |
| 重溫提示新 `.plan-note` | 接受；用 `--green` / `--success-bg` token，對比 test 已過 |
| 重溫模式保留書籤（寫 practiceFlags）| 接受。書籤唔係進度；`selectOption` 因 `revealed` 全部有值而 no-op，streaks / wrongList / plan log 0 寫入（plan-run-test storage snapshot 核實）|
| 完成卡小結數成個任務題數（減已掌握）| 接受 |
| 改目標（replan）唔計 mastery | 接受。符合 G37「計劃照排、唔 migrate」；已掌握知識點重排後即時顯示完成，唔會要人重做 |

## 重點逐項核對

- **共用檔案 0 行為改動**：`quiz.js` 4 處 hook 全部 `isPlanSession()` / `isPlanReviewMode()` 先生效；非計劃時 `renderPlanQuizHeader` 寫返同一 `t('common.home')`、`renderPlanRunNotes` 只收埋兩個新 note。`similarPanel.js`：非計劃 session `practise` 預設 true，條件 `(!isSideSession() || isPlanSession())` 對舊 session 等價。`sideSession.js` 只加 `isPlanSession` + review fill。`home.js` `goHome` 只喺 plan session 改道；所有離開 screenQuiz 嘅路徑（←、最後一題掣、G15 關功能 → `leaveToHome`）都會 `clearSideSession`，冇殘留 sessionReturn 令其他畫面 goHome 誤入 Day。similar / review / batch / doubletap 等 test 全 PASS。
- **Round queue**：未答 → 跳過 → 答錯，每輪 ≤ 24；最後一題掣三態（下一輪 / 重做答錯 n 題 / 完成）喺 render 時用最新 dayLog 計，正確。每答一題 streaks + plan log 各寫 1 次。雙擊由 CUI-0011 通用 guard（view = state.questions）擋住，plan-run-test 有 dblclick case。
- **歸屬**：`state.planDay = returnTo.date` → `recordPlanAnswer(ctxIso)` → `planAttributeAnswer` ① 分支，補做 / 提早寫入該日；完成卡用 `view.from` 決定今日 / 當日 %。
- **G37**：mastered 只喺 `planLoadLogView` 加落 view，`planApplyAnswer` / `planApplyMock` 經 `planStoredDay` 只寫 `{ v, days }`，`recordPlanAnswer` 讀 stored log —— 從不寫入。`PLAN_MASTERY_TYPES` 限 read + practice，drill / review / mock 唔受影響。Home / Day / Schedule / Calendar / Runner 全部用 view；streaks 變咗下次 render 即反映（雙向：之後答錯令 🏆 失效，該題會變返未完成 —— 符合「即時計」）。Layer：`planLoadLogView` 喺 planProgress.js 嘅 service 區，同 `planMaterializeCtx` 讀 `streaks` / `wrongList` 一致，純 domain 函數（`planTaskProgress` 等）只收參數。
- **a11y / 44px / 對比**：`.plan-hit` / `.nav-btn min-height:44px`、task box `<button>` 有 focus-visible；返回 Day 時焦點回到該任務格；en `{one, other}` 齊（`retryWrong` / `sumFirst` / `sumRedone` / `qMastered`）。文案（如 en `← Day 3 tasks`）留 PR7 用戶睇。
- **其他觀察（唔開 ID）**：plan session 每次 render 最多 3 次 `planRunContext`（notes pair、retry 數、最後一題掣），實測 183 日計劃約 2 ms / render，可接受；日後如再加 hook 可考慮每 render cache 一次。

## ✅ 做得好嘅地方

- 真正零複製：runner 就係 Practice 畫面 + sessionReturn，重溫模式用 `answers` / `revealed` 預填就令所有寫入路徑自然 no-op，好優雅。
- `planStoredDay` 明確切開 view / stored 形狀，防止 mastered 漏入 storage。
- plan-run-test 覆蓋面闊（storage snapshot 驗 0 寫入、W-030 copies、3 寬度 × 2 語言 44px / 對比）。

## 修正優先順序

| 優先 | ID | 工作量 |
|------|----|--------|
| 1 | W-038 | 小（1 個 helper + 1 個 test）|
| 2 | S-121 | 小 |

## 修訂代碼（W-038 方案 A 草稿）

```js
// js/domain/planProgress.js — the questions a runner still asks (G37: 🏆 ones of a practice task are done)
function planAskableQids(task, dayLog) {
  const m = planTaskMastered(task, dayLog);
  return planTaskQids(task).filter(k => !m.has(k));
}
// planNextRound / planRetryLeft 改用 planAskableQids(task, dayLog)

// js/screens/planRun.js planStartRound
const all = planAskableQids(ctx.task, ctx.dayLog); // W-038: rounds of the questions actually asked
```

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
branch: "claude/charming-hopper-48ypzp"
context: "PR6a runner + G37 review pass 94; 0 Critical; W-038 (G37 mastered questions inflate 'Round n of N') and S-121 (Result card focus) recommended to fix on branch first; visual-diff identical, run-all 37/37 PASS"
```
