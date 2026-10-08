# Code Review：溫習計劃 PR2 Hooks（PR #58，T-309–T-313）

- 日期：2026-10-08
- 審閱者：Code Reviewer（subagent）
- 目標：`claude/charming-hopper-48ypzp` @ `2b5d246`，`git diff origin/main...HEAD`（33d9b61 只係 docs；code = f7feedb / 5274f2f / 2b5d246）
- 範圍：`js/domain/{mastery,questions,plan}.js`、`js/screens/{quiz,result,sideSession}.js`、`js/core/config.js`（註解）、`locales/{en,zh-HK}.js`（`plan.dayN`）、新 `tests/plan-hook-test.js`、`structure-test` / `upgrade-test` / `i18n-test` / `run-all.sh`
- 對照：plan §PR2 驗收；arch §D、§E.1、§E.5、R1 / R3 / R8 / R9；grill G2 / G5 / G10 / G11 / G14 / G15 / G22；PR1 review（ID 接續：C-002 / W-030 / S-109 起）
- 總評：hook 位置同 arch §D 一致，冇計劃時零行為改動、零 storage 寫入（visual-diff 76 個狀態全同、upgrade-test 只多 marker），冇雙重記錄，`startExam` 新參數對現有 caller 冇影響，`planDay` reset 冇漏。發現 **1 個 Warning**：計劃「清錯題」任務用 canonical key，錯題簿入面係重複題（19 題）另一份 key 嘅時候清唔走（R9 漏口）。**95 / 100，pass**

## Hard Gates

| Gate | 結果 | 備注 |
|---|---|---|
| Lint | n/a | 項目冇 linter（vanilla JS）；`structure-test`（function ≤ 30 行、layer guard 等）PASS |
| Type check | n/a | 冇 TypeScript |
| Tests | pass | Reviewer 重跑 `run-all.sh`：**33 / 33 PASS**（`plan-test` 2645 checks、新 `plan-hook-test` PASS），exit 0；之後已 `git checkout -- 'tests/*.png'`、刪 `shot-similar.png`，working tree clean |
| Coverage | n/a | 冇 coverage tool；人手核對：驗收 4 項都有 case，W-030 嘅重複題路徑未覆蓋 |
| No Critical | pass | 0 Critical |
| Security scan | n/a | 冇新增依賴 |
| （附加）visual-diff | pass | `node tests/tools/visual-diff.js ff3e4da` → `VISUAL IDENTICAL (vs ff3e4da, 76 states)` |

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 20 | 25 | W-030 |
| 安全性 | 20 | 20 | — |
| 可維護性 | 20 | 20 | layer 方向守住，新 guard 防倒退 |
| 測試覆蓋 | 15 | 15 | `plan-hook-test` 覆蓋全部驗收項（W-030 嘅 case 隨修正補） |
| 性能 | 10 | 10 | 冇計劃：每答一題只多一次 `getItem`；有計劃：每答一題最多寫一次 log（有 assert） |
| 代碼風格 | 10 | 10 | — |
| **總分** | **95** | **100** | |

**結果：✅ pass**（W-030 建議喺呢個 PR 修，最遲要跟 PR6a 一齊落，見下）

---

## 重點核對

| 項目 | 結果 | 證據 |
|---|---|---|
| 冇計劃 → 0 行為改動 / 0 storage 寫入 | ✅ | `recordPlanAnswer`：`planLoad()` null → return；`recordPlanMock`：`isRealTest` false 連 `planLoad` 都唔做。visual-diff 0 diff；`upgrade-test` swUpgrade：答題 + 交卷後新 key 只有 marker；`plan-hook-test` checkNoPlan |
| 雙重記錄 | ✅ 冇 | Practice：`revealAnswer` 每題只行一次（`idx in state.revealed` guard）→ `recordPracticeAnswer` → `recordPlanAnswer` 一次（測試 assert 每答一題寫一次）。Exam mode：唔經 `recordPracticeResult`，交卷只寫 mock。Practice mode 「Finish」→ `finishExam` → `recordPlanExam` 但 `isRealTest=false` → 冇寫 |
| `startExam(examNum, mode = pendingMode)` 對現有 caller | ✅ 冇影響 | 全部 caller（`actions.js` `startExam(examArg(el))`、`home.js` ×4、`retryExam`）都只傳一個參數；冇 caller 當 callback 傳（冇 `forEach(startExam)` / `onOk: startExam`）。`pendingMode` 唔再喺 `startExam` 入面讀以外地方用 |
| `state.planDay` reset | ✅ 冇漏 | 入 session 只有兩條路：`startExam`（設 `null`）同 `startSideSession`（`sideSessionState` 設 `null`，只有 `kind: plan` 先改做 `date`）。`SESSION_RETURNS.quiz` 還原嘅 stashed state 一定係普通 quiz（`planDay` null；side session 冇 Similar panel，plan session 唔會被 stash）。離開 plan session 返主頁後 `state.planDay` 仲留住個日子，但冇任何地方喺下一個 session 開始之前讀佢；測試有 assert 「plan session 後 `startExam` → null」 |
| 清錯題條件 | ⚠️ 見 W-030 | `clearsWrongAnswers()` = `WRONG_EXAM \|\| isPlanReviewSession()`，只睇 `sessionReturn.type === review`；plan practice session 唔清（有 assert）。重複題 key 唔對應 |
| Layer 方向 | ✅ | screen → domain：`quiz.js` 傳 `state.planDay` 落 `mastery.js`；`result.js` 計好 `isRealTest` 先傳；`mastery.js`（domain）→ `planProgress.js`（domain）；`sideSession.js` 用 `PLAN_TASK`（domain）。新 structure-test guard 掃 `js/domain/plan*.js` 唔用 screens 頂層名；`study` → `studyDays` 就係因為撞 Study screen global，改得啱 |
| 舊 shell 混合載入（R1） | ✅ | PR1 已加 `LATE_BOOT_SCRIPTS`（plan → planProgress），`startApp` 等齊先開始，載唔到就 retry → fallback 訊息；`upgrade-test` mixedShell 加 assert：兩個 file 載入、答題 + Exam 交卷冇 error、冇 plan key |

## Developer 自報偏離 — 判斷

| # | 偏離 | 判斷 | 理由 |
|---|---|---|---|
| 1 | mock attempt 只計 `EXAM_MODE && (isNumberedExam \|\| isRandomExam)` | ✅ 接受 | Practice mode By Exam 逐題已經 reveal、已經入 practice log，唔係考試；arch 原文 `isNumberedExam(…) \|\| isRandomExam(…)` 字面會將 Practice mode Exam N 計做 mock（`isRandomExam` 本身已要求 Exam mode，`isNumberedExam` 冇），同 G10「模擬考」意思唔合。條件同 `hasExamTools()`（計時 / 交卷 UI）一致 |
| 2 | `planDay` 喺 `startSideSession` 由 plan return 嘅 `date` 設 | ✅ 接受，仲好過原設計 | 一個入口設定，PR6a `startPlanPractice` 唔使記得 call 完再設；`retryWrong` 下一輪都經同一個 return，自動帶住 |
| 3 | plan return 加 `type` | ✅ 接受 | `isPlanReviewSession()` 唔使每答一題 `planLoad()` 再查 task，亦唔會因為改目標令 taskIndex 指去另一個 task 而判錯 |
| 4 | `plan.js` `study` → `studyDays` | ✅ 接受 | `study` 係 `js/screens/study.js` 頂層 global，新 guard 正確地捉到；改名冇行為改動（plan-test 全綠） |
| 5 | zh-HK `plan.dayN` 用英文「Day {n}」 | ✅ 接受 | arch §F.5 / Q9：帶號碼標籤保留英文格式（`plan.dayOf` = `Day {n} / {total}`），同 mockup 一致 |
| 6 | plan side session ↩ Back 暫時返主頁 | ✅ 接受 | PR6a 先有任務卡；入口收埋，用戶入唔到；有測試釘住，PR6a 改嗰陣會 fail 提醒 |

---

## 問題清單

### 🟡 W-030 — 計劃「清錯題」任務清唔走錯題簿入面嘅重複題（R9 漏口）

- **位置**：`js/screens/quiz.js` `recordPracticeResult`（`clearsWrongAnswers() && wrongList[qKey(q)]`）；配合 PR1 `planMaterializeReview`（`js/domain/planProgress.js`）將 `wrongKeys` 轉做 canonical key
- **描述**：清錯題任務嘅 `qids` 係 canonical key（G1：同一題文字只計一次）；PR6a runner 會用 `qids.map(questionByKey)` 開 session，所以 session 入面嘅題目 `qKey(q)` 係 canonical key。但錯題簿 `wrongList` 存嘅係用戶當時答錯嗰份嘅 key。408 題入面有 19 題係重複題嘅第二份（例：`4.14` → canonical `3.12`）。用戶喺 Exam 4 答錯 `4.14` → 錯題簿有 `4.14`；計劃清錯題出 `3.12` → 答啱 → `wrongList['3.12']` 唔存在 → **冇清**，`state.cleared` 仍然 0。
- **重現**（reviewer probe，Playwright）：`addWrong(questionByKey('4.14'))` → 建計劃 → `ensurePlanToday()` → review task `qids = ['3.12']` → `startSideSession(PLAN_PREFIX+1, …, { kind:'plan', type:'review', … })` → 答啱 → 結果 `wrongList` 仍然係 `['4.14']`、`cleared: 0`，但 plan log `ok['3.12'] = 1`（任務當完成）。
- **影響**：正正係 R9 想避免嘅情況：「用戶清完計劃錯題，錯題簿數字唔郁」。而且每日 materialise 清錯題都會再揀返呢題（錯題簿仲有 `4.14`），每日出現、每日答啱、永遠清唔走。如果錯題簿同時有 `3.12` 同 `4.14`，只會清 `3.12`。現有 `WRONG_EXAM` 複習唔受影響（佢嘅 pool 直接用錯題簿 key）。入口收埋 + runner 未有，所以而家用戶未遇到；PR6a 一接上就會出現。
- **方案 A（推薦）**：清錯題時清晒同一 canonical key 嘅錯題簿 entry。`planProgress.js` 加純函數 `planSameQuestionKeys(keys, key)`（`keys.filter(k => planCanonKey(k) === planCanonKey(key))`），`quiz.js` plan review 分支用佢搵出要清嘅 key，逐個 `clearWrong(questionByKey(k))`，`state.cleared` 加一次。Trade-off：一題清走錯題簿入面「同一條題」嘅所有份，符合 G1「同一題文字只計一次」；`WRONG_EXAM` 原有行為唔使改（可以只喺 `isPlanReviewSession()` 分支用）。
- **方案 B**：PR6a runner 開清錯題 session 時唔用 canonical，改用錯題簿原本 key（task 另存 `wrongKeys`，或者開 session 時 `keysOf(wrongList).find(k => planCanonKey(k) === qid)`）。Trade-off：唔使改清錯題條件，但錯題簿有兩份時仍然只清一份；log 照用 canonical 冇問題（`recordPlanAnswer` 自己會轉）；改動落喺 PR6a，PR2 嘅 R9 驗收仍然有漏口。
- **推薦**：方案 A，喺呢個 PR 修（清錯題條件係 PR2 T-311 嘅範圍，改動細），並喺 `plan-hook-test` checkPlanReviewClearsWrong 加一個重複題 case（錯題簿放非 canonical key，session 用 canonical，答啱後錯題簿兩份都清、`cleared === 1`）。如果決定留到 PR6a，要寫入 PR6a 驗收。

---

## 非缺陷觀察（唔開 ID，留畀之後 PR）

1. **PR6b 注意 `retryExam()`**：而家 `startExam(state.examNum)` 用 `pendingMode`。Plan mock 用 `startExam(n, EXAM_MODE)` 而唔改 `pendingMode`（R8），所以 PR6b 喺 plan mock 結果頁撳「再考」時，如果主頁揀咗 Practice，會變咗 Practice mode。arch §E.5 已講 plan context 用 `ALL_EXAM`（G11），實作時記得同時傳 `EXAM_MODE`（或者普遍改做 `startExam(state.examNum, state.mode)`）。PR2 冇 caller 傳 mode，所以而家冇影響。
2. `recordPlanExam` 嘅 `isRealTest` 同 `hasExamTools()` 係同一條式；可以直接用 `hasExamTools()` 免兩處分開改（可選）。
3. `state.planDay || null` 喺兩處都係多餘（`planDay` 只會係 ISO 字串或 null），無害。

## ✅ 做得好嘅地方

- Hook 嚴格跟 arch §D：domain 唔讀 `state`，context 全部由 screen 用參數傳入；再加 structure-test guard 防將來倒退，連帶捉到 `study` 名撞。
- `recordPlanMock` 喺 `isRealTest` false 時連 storage 都唔讀，Practice 結束零成本。
- `plan-hook-test` 用 `Storage.prototype.setItem` spy 驗「每答一題寫一次」、`page.clock` 固定日子、驗 Leave / Practice mode / chapter set 唔寫 mock、開關關咗照記（G14）、Exam 逐題唔計（G22）—— 全部係行為驗證，唔係淨係 smoke。
- `upgrade-test` 兩個 case（混合 shell、SW 升級後冇計劃只多 marker）直接對應 R1 / R3。
- 6 個偏離全部有理由、有註解、有測試釘住。

## 修正優先順序

| 次序 | ID | 嚴重度 | 工作量 | 建議時間 |
|---|---|---|---|---|
| 1 | W-030 | 🟡 Warning | ~10 行 + 1 個 test case | 呢個 PR（最遲 PR6a 驗收） |

## 修訂後代碼（方案 A 示意，未改 repo）

```js
// js/domain/planProgress.js — pure
// every stored key that is the same question as key (G1: copies of one question text count once)
function planSameQuestionKeys(keys, key) {
  const canon = planCanonKey(key);
  return keys.filter(k => planCanonKey(k) === canon);
}

// js/screens/quiz.js
function recordPracticeResult(q, correct) {
  recordPracticeAnswer(q, correct, state.planDay);
  if (!correct) addWrong(q);
  else if (isPlanReviewSession()) clearPlanReviewWrong(q);   // R9 / W-030: every copy of the question
  else if (state.examNum === WRONG_EXAM && wrongList[qKey(q)]) { clearWrong(q); state.cleared++; }
}
function clearPlanReviewWrong(q) {
  const keys = planSameQuestionKeys(keysOf(wrongList), qKey(q));
  keys.forEach(k => clearWrong(questionByKey(k)));
  if (keys.length) state.cleared++;
}
```

（`clearWrong` 以 `qKey(q)` 刪除，`questionByKey(k)` 回傳 `{ q, examNum, origIdx }`，`qKey` 讀到 `examNum` / `origIdx`，可以直接用。）

## Handoff receipt

```handoff-receipt
from: code-reviewer
task: review PR #58 study plan PR2 hooks (T-309–T-313), 2b5d246
status: pass
score: 95
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass (run-all 33/33 reviewer re-run; plan-test 2645 checks; plan-hook-test PASS; visual-diff ff3e4da IDENTICAL 76 states)
  coverage: n/a
  no_critical: pass
  security_scan: n/a
findings: C=0 W=1 (W-030) S=0
report: .proj-docs/reviews/2026-10-08_review_plan-pr2.md
next_action: invoke_qa
context: |
  6 個自報偏離全部接受。冇計劃 0 寫入、冇雙重記錄、startExam 新參數冇影響現有 caller、planDay reset 冇漏、
  layer guard OK、混合 shell OK。W-030：plan review 用 canonical key，錯題簿存非 canonical 重複題（19 題）
  時答啱清唔走（probe：4.14 → 3.12 重現）；而家入口收埋 + runner 未有所以 latent，建議 developer 喺 QA 前
  用方案 A 修 + 補 test，最遲寫入 PR6a 驗收。PR6b 注意 retryExam 用 pendingMode。報告未 commit。
```
