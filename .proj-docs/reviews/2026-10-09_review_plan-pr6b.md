# Code Review — 溫習計劃 PR6b（T-335–T-339）

- 日期：2026-10-09
- 審閱者：Code Reviewer（獨立）
- 目標：branch `claude/charming-hopper-48ypzp` @ 980b539（1 個 commit），diff = `git diff origin/main...HEAD`（17 files，+763 / −55）
- Design Origin：`mockup:mockups/study-plan-flow.html#runner`
- 總評：三類任務都係用現有 component 砌：讀知識點用 `factCardHtml`（Study marks），錯題知識點用 `similarPanelHtml`，模擬考用 Exam mode 本身加 `#resultPlanRow`，冇複製任何 markup。`factCard.js` / `similarPanel.js` 嘅參數化喺預設值下輸出逐字不變；`result.js` / `home.js` / `study.js` 只係加咗 plan 分支。`visual-diff` 76 個狀態 IDENTICAL。發現 2 個 Warning：同一日有兩個模擬考時，slot 1 開錯試卷；去到最後一條知識點時焦點跳去「← 上一條」。另有 2 個 Suggestion。
- 注意：`origin/main` 喺呢個 branch 開出之後已經 merge 咗 v1.0.4（PR #69，W-040–W-042、S-125–S-130）。merge 之前要 rebase，`plan-day-test.js` 可能有衝突。

## Hard Gates

| Gate | 結果 | 備注 |
|------|------|------|
| Lint | n/a | 項目冇 linter（純 classic script）|
| Type check | n/a | 冇 TS |
| Tests | pass | `run-all.sh` 38 套全部 PASS（plan-test 2700 checks；新增 plan-run2-test；study / similar / factsession / examresult / examtools / result / lang-switch / upgrade / structure / i18n 全綠）|
| Coverage | n/a | 冇 coverage 工具；plan-run2-test 覆蓋讀卡、▶ 練習、配對練習、重溫、錯題 panel + CTA、模擬考合格 / 不合格 / Leave / 關開關 / 時間到、44px、對比、3 寬度 × 2 語言 |
| No Critical | pass | 0 |
| Security scan | n/a | 冇新依賴 |
| Visual diff | pass | `visual-diff.js origin/main`：VISUAL IDENTICAL（76 states）；之後已 `git checkout -- 'tests/*.png'`、`rm -f tests/shot-similar.png` |

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 14 | 25 | W-043、W-044、S-131 |
| 安全性 | 20 | 20 | innerHTML 只插 locale 字串、`escapeHtml`、數字；`data-arg` 有 escape |
| 可維護性 | 19 | 20 | S-132 |
| 測試覆蓋 | 15 | 15 | 兩個 Warning 嘅情況未有 test，修嘅時候補 |
| 性能 | 10 | 10 | |
| 代碼風格 | 10 | 10 | 函數 ≤ 30 行（structure-test）；token 齊；zh-HK 書面語；en `{one, other}` |
| **總分** | **88** | **100** | |

**結果：warn**（hard gates 全部 pass，0 Critical，88 分）

## Design Fidelity

- Origin 合法（`mockup:` + `#runner`），mockup 路徑存在。
- 讀卡 = `.fact` 全卡；錯題 = `.sqm.show`；模擬考 = `#screenQuiz` Exam mode + `#screenResult`。頂部「任務名 · 第 n 條（共 m 條）」+ 細進度 bar，對應 mockup `.sp-run-meta`。
- 顏色全部用 `var(--…)`（`.plan-note.warn` = `--red` / `--danger-bg`，測試量到對比 ≥ 4.5:1）；進度 bar 闊度用 JS `style.width`（同 `#progressFill`），bar 色用 `planPctBand` class。
- 截圖（read / wrongfacts / mock-result × en / zh-HK × 360 / 375 / 400）冇橫向 scroll，44px 達標。
- 自報嘅偏離全部可以接受，**唔開號**：
  - 卡上「▶ 練習」只練呢條 fact（arch §E.2 原本係 pair）：做完返返同一張卡，配對練習改由最後一條嘅「練習這 n 題 →」開。粒度更細，冇違反 G3（讀本身唔計）。建議 PM 喺 arch §E.2 記低。
  - 已考但未合格，再撳個框就開 Random Exam：符合 G11。已合格撳個框開完成卡、冇「重溫」：模擬考答案只存喺結果頁，合理。
  - `#resultPlanRow` 放喺 `.result-card` 最尾：令其他元素唔郁位，visual-diff 0 diff。
  - Panel 標題用 Similar 原字「相似題目」：100% 重用，符合 handoff §3.1。
  - 結果行兩粒掣上下排：360px 下 zh / en 都唔會擠。
  - `studyToggleMark` 改用 `rerenderCurrentScreen()`：arch §E.2 原文要求。喺 Study 畫面上 `SCREEN_RERENDER.screenStudy` 就係 `renderStudy`，行為不變；返去 Study 時有 `openStudy` 或者 side-session return 去 `renderStudy`，唔會顯示舊狀態。
  - 計劃模擬考 Leave 返當日任務頁：G15 只要求唔交卷。
  - `planMockRun` 殘留：用 probe 驗證過，計劃模擬考結果 → Home → 普通 Exam 3 交卷：`isPlanMock()` = false，結果行 hidden，冇影響（`startExam` 會清 `state.planDay`）。
  - Similar CTA 只喺計劃頁設 44px：原本 Similar 嘅 42px 唔郁。

## 現有行為 0 改動（逐行核對）

| File | 改動 | 結論 |
|---|---|---|
| `factCard.js` | `factPractiseHtml(f, practise)`：`undefined` 時用 `startFactPractice` + `f.src.length`，markup 逐字同舊版一樣；`false` 時輸出 `''` | 預設不變 |
| `similarPanel.js` | `similarCtaHtml(keys, cta)`：`cta = null` 時用 `startSimilarPractice`，冇 `data-arg`，同舊版一樣 | 預設不變 |
| `result.js` | `renderResultPlanRow()`（舊 shell 冇 `#resultPlanRow` 就 return；`planRun.js` 喺 `LATE_BOOT_SCRIPTS`）；`retryExam` 只喺 `isPlanMock()` 時分支 | 非計劃路徑不變 |
| `home.js` | `goHome` Leave 嘅 `onOk` 喺 `isPlanMock()` 時改用 `planLeaveMock` | 非計劃路徑不變 |
| `study.js` | `rerenderCurrentScreen()` | 喺 Study 上等同 `renderStudy()` |
| `sideSession.js` | 只改 comment | — |

G 項核對：G10（`planMockProgress` 合格先完成；結果行用 `planMockPassed`）／ G11（`ctx.dayLog.mock.length > slot` 時用 `ALL_EXAM`；Retry 經 `retryExam` → `planRetryMock` → `EXAM_MODE` + `ALL_EXAM`，唔用 `pendingMode`）／ G15（Leave = `stopExamTimer` + 返當日頁；關開關 = `isOnPlanSession` 包埋 `isPlanMock` → `leaveToHome`；兩種情況 storage 都不變，有 test）／ G22（Exam mode 唔會行 `revealAnswer` → `recordPracticeAnswer`）／ G25（attempt 有記分數，完成卡寫「最高 n / 24」）／ G26（plan session 嘅 Similar 仍然冇 CTA；錯題知識點頁嘅 CTA 經 arch §E.3 改做 `planPractiseFact`）／ G32（`recordPlanExam` `isRealTest`）／ G37（讀卡嘅 `planFactLeft` 經 `planNextRound` 撇走 🏆 題）／ G3（讀卡 Prev / Next 唔寫 storage，有 test）。

## 問題清單

### 🔴 Critical

冇。

### 🟡 Warning

#### W-043 · 去到最後一條知識點，焦點跳去「← 上一條」

- 位置：`js/screens/planRun.js:251` `planRunRestoreFocus`
- 描述：喺倒數第二條撳「下一條 →」之後，最後一條嘅掣換咗做「練習這 n 題 →」或者「完成 ✓」（`data-action` 唔同），所以原本嘅 focus key 搵唔到。fallback selector `'.plan-run-nav .nav-btn:not([disabled]):last-child, .plan-run-nav .nav-btn:not([disabled])'` 係一個 selector list，`querySelector` 會按 document order 回傳第一個符合嘅元素，即係排喺前面嘅「← 上一條」，唔係 `:last-child`。Probe 結果（2 條 fact，用鍵盤喺「下一條」撳 Enter）：`document.activeElement` = `<button … data-action="planStepFact" data-arg="-1">← 上一條`。
- 影響：鍵盤或 switch 用戶連續撳 Enter，去到最後一條之後再撳一下就會倒返去上一條，永遠撳唔到「練習這 n 題 →」（違反 W-032「焦點留喺原位」）。現有 test 只驗證咗中間嗰條（n > 2 嘅第 2 條）。
- 方案 A：分兩步 query，先搵 `.plan-run-nav .nav-btn:not([disabled]):last-child`，冇先搵任何 enabled 嘅掣。改動最少。
- 方案 B：focus key 用位置記低（例如加 `data-nav="next"` / `"prev"`），最後一條嘅掣都帶 `data-nav="next"`，咁就唔使靠 fallback。語意更清楚。
- 推薦：A，再喺 `checkRead` 加一個 case：由倒數第二條撳「下一條」，焦點要喺最後一條嘅主掣。

#### W-044 · 同一日有兩個模擬考：slot 0 唔合格再考合格之後，slot 1 唔會開佢自己分到嘅試卷

- 位置：`js/screens/planRun.js:388` `startPlanMock`（`ctx.dayLog.mock.length > ctx.task.slot ? ALL_EXAM : ctx.task.exam`）
- 描述：個判斷係用「當日 attempt 數目 > slot」去判斷「呢個 slot 已經考過」。但係 slot k 要等前面 k 個合格之後先開始，之前唔合格嘅 attempt 都會計落 `mock.length`。Probe：`GOAL` 計劃入面 2026-10-22 至 10-27 有 5 日每日 2 個 mock（`[{slot 0, exam 1}, {slot 1, exam 2}]`）。slot 0 考 10/24（唔合格）→ Random Exam 20/24（合格）→ 開 slot 1：`state.examNum = 'all'`，分到嘅 Exam 2 被跳過。
- 影響：個框寫住「Exam 2」，開出嚟卻係 Random Exam（標題同內容唔夾）；Exam 2 呢份卷喺計劃入面永遠唔會考。另外，先開 slot 1 都會出現類似錯配（合格會計落 slot 0）。最後兩星期嘅模擬考日最常見到。
- 方案 A：喺 `planProgress.js` 加純函數 `planMockRetake(task, dayLog)`：`passes = 合格數`；`passes > slot` = 已完成；`passes === slot` 而且最後一個 attempt 唔合格 = 再考（`ALL_EXAM`）；其他情況開 `task.exam`。`startPlanMock` 用佢，`plan-test` 加 table-driven case。
- 方案 B：每個 attempt 記低 `slot`（`recordPlanMock` 收 `planMockRun.taskIndex`），按 slot 計。更準，但要改 log schema 同 PR1 / PR2 嘅 hook，範圍大。
- 推薦：A。順手確認 day screen 嘅框（G16 狀態）同 `planRunNext` 喺 slot 1 先開嘅情況下顯示正確（可以留 Suggestion / PM 決定：要唔要強制按 slot 次序開）。

### 🟢 Suggestion

#### S-131 · 過咗午夜先交卷，結果行仍然寫「✓ 模擬考試任務完成」，但冇記錄

- 位置：`js/screens/planRun.js:415` `renderResultPlanRow` / `planResultRowHtml`
- 描述：結果行用今次 attempt 嘅分數判斷 `passed`，但記唔記錄由 `planAttributeMock` 決定（`ctxIso !== todayIso` 會回傳 null）。Probe：23:50 開考，00:10 交卷 24/24 → 結果行顯示「✓ Mock exam task done」，但嗰日 `dayLog.mock = []`。唔合格時「可即日再考」都會開一份唔會記錄嘅 Random Exam。
- 方案 A：`renderResultPlanRow` 改為讀 `planTaskProgress(task, dayLog).complete`（或者 `recordPlanMock` 嘅回傳值）；冇記錄就顯示一句「已過午夜，這次不計入計劃」。
- 方案 B：接受呢個邊緣情況，只喺 HANDOFF 記低。
- 推薦：A（同 W-044 一齊改，兩者都係「結果 / 開卷要跟 log 走」）。

#### S-132 · `.plan-result-row .nav-row` 分開兩條 rule

- 位置：`css/screens/plan.css:315`、`:317`
- 描述：同一個 selector 寫咗兩次（`margin: 0` 同 `flex-wrap: wrap`），中間夾住 `.nav-btn` rule。
- 方案 A：合併做一條。方案 B：保持現狀，加 comment。推薦 A。

## ✅ 做得好嘅地方

- 真正重用 component：`factCardHtml` / `similarPanelHtml` 用 option 參數化，預設輸出逐字不變；三類任務都冇複製 markup（handoff §2.5 / §3.1）。
- `planRunContext(date, taskIndex, fact)` 將「單一 fact 嘅練習」收窄做同一個 task 結構，再 reuse PR6a 嘅分輪 / 重做 / 返回邏輯；`planRoundsDone` 處理得好清楚：做完一條就返返嗰張卡，成個 task 做完就去完成卡。
- 模擬考完全行現有 Exam mode（45 分鐘、Leave modal、時間到自動交卷），只係喺 `startExam` 之後補 `state.planDay`，冇改 `pendingMode`（R8）。
- `#resultPlanRow` 放喺 card 最尾，有 `hidden` 同舊 shell guard，`visual-diff` 0 diff。
- plan-run2-test 覆蓋得廣：Leave / 關開關之後 storage 逐 key 比較、`page.clock` 測時間到、對比度 / 44px / 3 寬度 × 2 語言。

## 修正優先順序

| 次序 | ID | 類型 | 工作量 |
|---|---|---|---|
| 1 | W-044 | 模擬考 slot 判斷 | 0.25 d（純函數 + plan-test + 一個 UI case）|
| 2 | W-043 | 焦點 fallback | 0.1 d |
| 3 | S-131 | 結果行跟 log | 0.1 d |
| 4 | S-132 | CSS 合併 | 5 min |

每個 ID 一個 commit（`fix: W-044 | …`）。merge 之前 rebase 上最新 `origin/main`（v1.0.4）。

## 修訂後代碼（重點）

```js
// W-043: a selector list returns the first match in document order, so ask for the last enabled button first
function planRunRestoreFocus(key) {
  if (!key) return;
  const body = byId('planRunBody'), el = body.querySelector(key);
  const target = el && !el.disabled ? el
    : body.querySelector('.plan-run-nav .nav-btn:not([disabled]):last-child') || body.querySelector('.plan-run-nav .nav-btn:not([disabled])');
  if (target) target.focus({ preventScroll: true });
}

// W-044 (js/domain/planProgress.js): slot k starts after k passes; a failed attempt since then = retake (G11)
function planMockRetake(task, dayLog) {
  const passes = dayLog.mock.filter(planMockPassed).length;
  const last = dayLog.mock[dayLog.mock.length - 1];
  return passes === task.slot && dayLog.mock.length > 0 && !planMockPassed(last);
}
// planRun.js
function startPlanMock(at) {
  const ctx = planRunContext(at.date, at.taskIndex);
  if (!ctx) { openPlanDay(at.from); return; }
  planStartMockExam(at, planMockRetake(ctx.task, ctx.dayLog) ? ALL_EXAM : ctx.task.exam);
}
```

（`planMockRetake` 喺 slot 0 第一次唔合格時都係 true，同現時 G11 行為一致；開 slot 1 時，如果 slot 0 啱啱合格，就會開返佢自己分到嘅試卷。）

## Handoff receipt

```handoff-receipt
protocol: 1
status: warn
score: 88/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
next_action: invoke_developer
next_agent: frontend-developer
branch: "claude/charming-hopper-48ypzp"
context: "PR6b runner review 88 warn; 0 Critical; fix W-044 (2-mock day: slot 1 opens Random Exam instead of its assigned exam after slot 0 fail+pass) and W-043 (focus jumps to Prev on the last fact), S-131/S-132 optional; run-all 38/38 PASS, visual-diff identical; rebase onto origin/main (v1.0.4) before merge"
blockers:
  - "W-044 startPlanMock uses dayLog.mock.length > slot; failed attempts of earlier slots make slot 1 skip its assigned exam"
  - "W-043 planRunRestoreFocus selector-list fallback picks ← Prev (document order) when Next becomes the last fact's button"
```
