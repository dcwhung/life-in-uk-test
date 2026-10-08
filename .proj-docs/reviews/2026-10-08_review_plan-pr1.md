# Code Review：溫習計劃 PR1（PR #57，T-301–T-308）

- 日期：2026-10-08
- 審閱者：Code Reviewer（subagent）
- 目標：`claude/charming-hopper-48ypzp`，`git diff origin/main...HEAD`（5 commits：87b3f79..c34cb30）
- 範圍：`js/core/{config,store,utils}.js`、新 `js/domain/plan.js`（287 行）、新 `js/domain/planProgress.js`（343 行）、`index.html` / `sw.js` / `js/main.js` 載入、新 `tests/plan-test.js`（594 行）+ `run-all.sh`
- 對照：plan §PR1 驗收、arch §B / §C / §F.2 / §G、R1 / R3 / R17、grill G1–G29、HANDOFF 規則
- 總評：domain 結構清楚，日期 / 時區處理正確，storage 安全（冇計劃唔寫、壞 log 唔覆寫）做得好，測試大部份係真正驗證行為。發現 **2 個 Warning**（改目標會將已經做完嘅知識點再排一次；從未打開過嘅已過強化日會變成做唔到嘅補做）同 **1 個 Suggestion**。**88 / 100，warn**

## Hard Gates

| Gate | 結果 | 備注 |
|---|---|---|
| Lint | n/a | 項目冇 linter（vanilla JS）；`structure-test`（function ≤ 30 行等）PASS |
| Type check | n/a | 冇 TypeScript |
| Tests | pass | `run-all.sh` 32 / 32 PASS（`plan-test` 2586 checks，包括 London / Auckland / Los Angeles 三個 TZ 再跑一次）；reviewer 重跑後已還原 `tests/*.png`、刪除 `shot-similar.png`，working tree clean |
| Coverage | n/a | 冇 coverage tool；人手核對：公開 function 全部有 case，下面 W-026 / W-027 嘅路徑未覆蓋 |
| No Critical | pass | 0 Critical |
| Security scan | n/a | 冇新增依賴 |
| （附加）visual-diff | pass | `node tests/tools/visual-diff.js origin/main` → `VISUAL IDENTICAL (76 states)` |

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 15 | 25 | W-026、W-027 |
| 安全性 | 19 | 20 | S-108（壞資料引致 TypeError） |
| 可維護性 | 20 | 20 | 分層清楚、命名有前綴、常數齊 |
| 測試覆蓋 | 14 | 15 | 兩個 W 嘅情境未有 case（advisory，修正時補） |
| 性能 | 10 | 10 | 183 日最壞情況夠快；容量用 assert 守住 |
| 代碼風格 | 10 | 10 | — |
| **總分** | **88** | **100** | |

**結果：⚠️ warn**

---

## 問題清單

### 🟡 W-026 — `replanFrom` 會將今日或未來日子已經做完嘅知識點再排一次（違反 G7 / G5）

- **位置**：`js/domain/planProgress.js:277-283` `planFactsLeft`
- **描述**：只有 `d.date < todayIso` 嘅 read task 會被當成「已完成」。今日已完成嘅知識點，同埋喺未來日子提早完成嘅知識點（G5「未到 = 提早做計嗰日」），都會當成未完成，重新排過。
- **重現**（reviewer probe，21 日 / 120 分鐘計劃）：
  - 今日（Day 1）做完 32 條 fact，同日改目標做 30 分鐘 → 新今日只有 12 條，**另外 16 條已完成嘅 fact 排咗去聽日**。聽日嘅 log 係空，用戶要再答一次。
  - 提早喺 10-13 做完嗰日全部題目，10-09 改目標 → 嗰批 fact 重新排咗喺 10-19…10-21，10-13 嘅新任務變 0%。
- **影響**：G7 寫明「未完成嘅『讀 + 練』段落先排」。用戶做咗嘅嘢「唔計」，正正係 R7 想避免嘅情況（「做咗唔計」）；而且喺同一日改目標好常見（建立完即刻調整時間）。
- **方案 A**（推薦）：已完成嘅 fact 唔再排，包括今日同未來日子：`planFactsLeft` 掃晒**所有** day 嘅 read task（每條 fact 用佢自己嗰日嘅 log 判斷）。今日已完成嘅 group 要保留喺新今日：`buildPlanDays` 嘅第一日（如果係今日）前面加返舊今日入面已完成嘅 read / practice group，咁今日 % 照計返。
  - Trade-off：要改 `buildPlanDays` 加參數（例如 `pinnedToday`），多一個 case 要測；但係完全符合 G5 / G7。
- **方案 B**：凍結範圍包埋今日（`date <= today`），新日程由聽日開始；未來日子提早完成嘅 fact 同樣掃 log 剔走。
  - Trade-off：改動細；但今日用新目標（例如縮短時間）唔會即時生效，同 G7「由今日起用新目標」唔一致。
- **測試**：加兩條 case：同日改目標冇已完成 fact 被排去之後日子；提早完成嘅 fact 唔會再出現喺新 learn 任務。保留現有嘅「每條未完成 fact 剛好排一次」assert。

### 🟡 W-027 — 從未打開過嘅已過強化 / 重溫錯題知識點日子會變成做唔到嘅補做

- **位置**：`js/domain/planProgress.js:127-129` `planPendingProgress`、`149-161` `planCarryTasks`、`331-343` `ensurePlanToday`
- **描述**：`drill` / `wrongFacts` 未 materialise 時，`total = quota`，`complete = false`，所以會入 `planCarryTasks`。但係佢哋冇 `qids` / `facts`（`planTaskQids` 返 `[]`）：
  - `planAttributeAnswer` ③ 永遠唔會揀中佢哋
  - service 只有 `ensurePlanToday`，只會 materialise 今日，**冇方法 materialise 已過嘅日子**（arch §C.3 寫明係「今日（同所有已過但睇緊嘅日子）」）
  - 結果：呢啲補做項目一直留到考試日，永遠完成唔到；`planNextStep` 會指向佢哋（`kind: 'carry'`，`resumeAt: null`）
- **重現**：21 日計劃，10-16（強化日）從未打開，10-17 計補做 → `drill qids=[]` ×3 + `wrongFacts qids=[]`。最後一日（`light`）嘅 `wrongFacts` 都有同樣問題。
- **影響**：PR5 嘅今日頁同主頁卡「下一步」會顯示做唔到嘅橙框補做項目；G29 連續紀錄同平均 % 都受影響。G24 只處理咗 `review`，`drill` / `wrongFacts` 未有決定。
- **方案 A**（推薦，跟 arch §C.3）：加 service `ensurePlanDay(iso, now)`，已過日子第一次喺補做度打開時用**當時**嘅錯題簿 / streaks materialise 並寫入（之後凍結，同 G9 一樣）；`ensurePlanToday` 改為 call 佢。`planNextStep` 遇到 pending 補做項目時要求 caller 先 materialise。
  - Trade-off：內容用「打開時」嘅狀態，唔係「嗰日」嘅狀態；但係強化題目本身就係「未掌握」，用最新狀態更合理。
- **方案 B**：將 G24 擴展到 `drill` / `wrongFacts`：已過而從未打開 = 唔計入嗰日 total、唔入補做。
  - Trade-off：最簡單；但會令「成日冇開過」嘅強化日顯示 100% 或者冇 %，同 G5「強化要再答啱一次」唔一致。**呢個方案要 PM / 用戶確認**（屬於 G24 範圍擴大）。
- **測試**：加 case：已過、從未打開嘅 drill 日，補做打開後有題目，答啱後計返嗰日（方案 A）；或者唔出現喺補做（方案 B）。

### 🟢 S-108 — `parseStoredPlan` shape check 唔完整：壞咗嘅 `drill.ch` 令 `ensurePlanToday` throw

- **位置**：`js/domain/plan.js:273-277` `planValidTask`；`js/domain/planProgress.js:72`
- **描述**：`facts` 會檢查 id 存唔存在，但係 `ch`、`quota`、`slot` 唔檢查。`ch: 9` 嘅 drill 可以通過 parse，之後 `planMaterializeDrill` 喺 `[...PLAN_CHAPTER_QIDS[9]]` throw `TypeError: ... is not iterable`（reviewer probe 已重現）。arch §B.6 / §G 嘅要求係「壞資料 = 冇計劃，唔 throw」；PR5 主頁卡會 call `ensurePlanToday`，到時就會 throw。
- **方案 A**：`planValidTask` 按 type 檢查：`drill` / `read` / `practice` 嘅 `ch` 要喺 `PLAN_STUDY_ORDER` 入面；`quota` 要係非負整數；`mock.slot` 要係非負整數。
- **方案 B**：materializer 防禦性寫法（`PLAN_CHAPTER_QIDS[task.ch] || []`）。
- **推薦**：A（將驗證集中喺 parse，同現有 fact id 檢查一致）。

---

## Developer 自報偏離：判斷

| 偏離 | 判斷 | 理由 |
|---|---|---|
| `replanFrom` 放 `planProgress.js` | ✅ 合理 | 佢需要 `planFactDone` + log（完成度），放 `plan.js` 會令 `plan.js` 反向依賴 `planProgress.js`；而家依賴方向係單向（plan → planProgress） |
| `carryFrom`（plan 層一個日期）代替逐 task `moved` | ✅ 合理 | arch §C.5 步驟 3 本身就係將**全部** frozen 未完成 task 標 moved，所以等價，而且更簡單、多次改目標都正確（只記最近一次）。PR4 / PR5 顯示「已移入新日程」時用 `day.date < plan.carryFrom` 判斷，要記得寫入 PR5 規格 |
| 模擬考 Exam lazy 揀 | ✅ 合理 | 同 arch §B.3 表格一致（mock 喺「第一次打開時補」`exam`）；`taken` 由成個 plan 計，唔會重複 |
| `buildPlanDays` / `planSplitStudyDays` / `planAttributeMock` signature | ✅ 合理 | `examCursor` 因為 lazy 冇用；`learnMins` 參數令 replan 可以只計剩低嘅 fact；`planAttributeMock` 唔需要 log |
| `readPlanLog` 返 `{ stored, value }` | ✅ 合理而且必要 | 要分得出「冇 log」（可以寫）同「有 log 但係 JSON 壞咗」（唔可以覆寫）；`getLS` 兩種情況都返 `null`。Plan 本身用 `getLS` 冇問題，因為 service 冇自動寫 plan 嘅路徑（只有 materialise 一個已經 parse 成功嘅 plan） |
| `parseStoredPlan` 未知 fact id → 當冇計劃 | ⚠️ 可以接受 | 防止之後 `planFactById` 返 `undefined` 時 crash；fact id 有 `content-guard` / `study-test` 守住，改動機會低。但係檢查唔一致（`qids` / `ch` 唔檢查，見 S-108）；另外「當冇計劃」之後 PR3 UI 會俾用戶建立新計劃，會覆寫舊嗰個。如果將來改 fact id，要寫 migration，唔好倚靠呢個 fallback（建議 HANDOFF 記一句） |

## G 決定逐條核對（PR1 範圍）

| G | 結果 | 備注 |
|---|---|---|
| G1 / G4 | ✅ | canonical key 用英文題目 trim + lowercase；389 / 236、一題唔會跨兩條 fact，都有 assert；`4.14 → 3.12` 嘅 service case |
| G3 / G5 | ✅（除 W-026） | 只計 `ok`；每日分開 log；強化日要再答啱一次 |
| G6 | ✅ | `planTodayIso` 用本機 getter；建立日係休息日照當休息 |
| G7 | ⚠️ W-026 | 過去凍結（逐字比較）、Day 編號、goalHistory 都正確；考試後改目標會用休息日填空隙，`parseStoredPlan` 長度檢查照過 |
| G8 | ⚠️ W-027 | 補做排除 mock、由舊到新、唔計今日 %（歸屬返原本嗰日） |
| G9 | ✅ | 首次打開時記低錯題簿頭 24 題（已轉 canonical、去重），之後凍結；新錯題留聽日；空 = 一個已完成單位 |
| G10 / G11 / G25 | ✅ | ≥ 18/24 = 24 單位；第二個 slot 要第二次合格；`best` 記最高分；Random Exam 靠 `isRealTest` |
| G13 | ✅ | overload 時 learn ≤ n − 1，最少 1 個模擬考日；全部 fact / 題目都排到（多個組合都有 assert） |
| G16 | ✅ | `examDay` / `ended`：唔歸屬、冇補做、`planNextStep` done |
| G23 | ✅（domain） | mock 只計當日；提早做 drill / review 由 UI 擋（PR5） |
| G24 | ✅ | 未打開嘅 review 重量 0、唔入補做 |
| G27 | ✅ | 5 個 band，邊界有 table test |
| G28 | ✅ | `PLAN_MIN_STUDY_DAYS = 7`；6 日唔得、7 日得 |
| G29 | ✅ | 休息日唔打斷；今日未完成唔歸零；未夠 100% 就歸零 |

## 其他核對（冇開 ID）

- **日期 / DST**：全部日數計算用 `Date.UTC` 日數 + `toISOString`，冇用本機 offset；`isoAddMonths` 會 clamp 去月尾（8/31 + 6 個月）；三個 TZ 都會 re-spawn 再跑。正確。
- **Storage 安全（R3 / R17 / B.6）**：冇計劃時三個 service function 都 0 寫入（有 assert 寫入次數）；壞 log 唔覆寫；壞 plan 唔寫；每次答題都 read-modify-write；`clearStudyPlan` 保留開關同其他 key。正確。
- **R1 / 載入**：`index.html` 次序 similar → plan → planProgress；`LATE_BOOT_SCRIPTS` 有次序而且逐個 `await`；SW SHELL 兩個 file 都有；`upgrade-test` PASS；`APP_VERSION` 保持 1.0.0。
- **容量**：183 日 × 每日 120 題嘅 fixture < 300 000 bytes，有 assert。
- **HANDOFF 規則**：`js/` 冇 CJK（`i18n-test` PASS）；全部頂層名都有 `plan` / `PLAN_` / `iso` 前綴，同其他 global 冇撞名（`plan-test` 有掃描）；tuning 常數放 `plan.js` 頂，只有 `STUDY_PLAN_READY` 同 LS key 入 `config.js`（跟 arch §C.1）；`PLAN_PREFIX` 暫時冇人用，plan T-301 指定咗，PR2 會用。
- **測試質素**：大部份係行為測試（hard-code 預期值、table-driven 歸屬、寫入次數、深比較凍結），唔係 tautology。`checkFeasibility` 嘅 `need` 公式同實作差唔多一樣（輕微 mirror），但 ok / tight / short 三狀態同 boundary 係獨立 assert，可以接受。
- **留俾後續 PR 嘅提示**：
  1. PR3「建立計劃」應該先 `clearStudyPlan()` 再寫（否則同一日嘅舊 log entry 會算入新計劃，例如舊計劃壞咗而當冇計劃嘅情況）。
  2. PR4 改目標畫面嘅可行性要用剩低嘅 fact 計，而家 `planFeasibility(goal, todayIso)` 一定用全部 fact。
  3. `planAttributeAnswer` ② 今日任務優先：如果一題今日已經 `ok`，而補做都有呢題，第二次答啱都係計今日，補做唔會得到（跟 arch 規則，唔算 defect；PR5 可以考慮 ② 加「今日未 `ok`」條件）。
  4. `planPctBand(percent(...))` 會四捨五入：做咗 1/300 = band 0。而家每日 total 上限大約 150，`percent` 唔會將未完成四捨五入成 100；如果之後加大每日上限，`planStreakDays` 應該改用 `done >= total`。

## ✅ 做得好嘅地方

- 純函數同 service 分得好清楚：domain 冇讀時鐘，`now` / `todayIso` 一律由參數傳入，所以測試唔使 mock `Date`。
- `readPlanLog` 用 `{ stored, value }` 分開「冇 log」同「log 壞咗」，令「壞 log 唔覆寫」真正做得到，並有測試證明。
- `materializePlanDay` 唔改 input、可以重複 call 而結果一樣（idempotent），快照凍結有 assert。
- `plan-test` 會喺三個 TZ re-spawn 自己，仲會核對 child 嘅 check 數同 parent 一樣，唔會靜靜雞少跑。
- 撞名掃描（plan 頂層名 vs 全部 `js/` global）防住 R2 / S-036 再發生。

## 修正優先順序

| 次序 | ID | 預計 |
|---|---|---|
| 1 | W-026 | 0.5 d（`planFactsLeft` + 今日 pinned group + 2 個 test） |
| 2 | W-027 | 0.5 d（`ensurePlanDay` + test；如果揀方案 B 要先問 PM） |
| 3 | S-108 | 0.1 d |

## 修訂後代碼（W-026 方案 A 嘅核心；W-027 方案 A 嘅 service）

```js
// js/domain/planProgress.js
// a fact is done once its read day's log has all its questions right — past, today or (early) future days alike
function planFactsDoneSet(plan, log) {
  const done = new Set();
  plan.days.forEach(d => d.tasks.filter(t => t.type === PLAN_TASK.read).forEach(t => t.facts
    .filter(id => planFactDone(id, planDayLog(log, d.date))).forEach(id => done.add(id))));
  return done;
}
function planFactsLeft(plan, log) {
  const done = planFactsDoneSet(plan, log);
  return PLAN_LEARN_ORDER.filter(id => !done.has(id));
}
// today's finished read / practice groups stay on today so today's % keeps them (W-026)
function planTodayDoneTasks(plan, todayIso, log) {
  const day = planDayAt(plan, todayIso);
  const dayLog = planDayLog(log, todayIso);
  if (!day) return [];
  return day.tasks.filter((t, i) => t.type === PLAN_TASK.read && t.facts.every(id => planFactDone(id, dayLog)))
    .flatMap(t => [t, day.tasks[t.pair]]);   // pair index must be re-numbered when merged into the new day
}

// W-027: first open of any active-plan day (today or a carried past day) fixes its contents
function ensurePlanDay(iso, now = new Date()) {
  const plan = planLoad();
  if (!plan) return null;
  const todayIso = planTodayIso(now);
  const i = planDayIndex(plan, iso);
  if (planStatus(plan, todayIso) !== PLAN_STATUS.active || iso > todayIso || !plan.days[i]) return plan;
  const ctx = { wrongKeys: keysOf(wrongList), streaks, completedExams: completedExams(), plan, log: planLoadLog() };
  const { day, changed } = materializePlanDay(plan.days[i], ctx);
  if (!changed) return plan;
  const next = { ...plan, days: plan.days.map((d, k) => (k === i ? day : d)) };
  writeStudyPlan(next);
  return next;
}
function ensurePlanToday(now = new Date()) { return ensurePlanDay(planTodayIso(now), now); }
```

> 注意：已過日子嘅 `mock` 唔應該 materialise（唔入補做）。`ensurePlanDay` 對已過日子應該跳過 mock，或者 `planMaterializeMock` 只喺 `iso === todayIso` 先揀。

## HANDOFF_RECEIPT

```
HANDOFF_RECEIPT
from: code-reviewer
task: review PR #57 (study plan PR1, T-301–T-308, domain + storage)
status: warn
score: 88
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass (32/32, plan-test 2586 checks × 3 TZ)
  coverage: n/a
  no_critical: pass
  security_scan: n/a
findings: C=0 W=2 (W-026, W-027) S=1 (S-108)
report: .proj-docs/reviews/2026-10-08_review_plan-pr1.md
next_action: invoke_developer
context: |
  W-026 planFactsLeft 只當 date < today 嘅 fact 完成 → 同日 / 提早完成嘅 fact 改目標後要再做（G7/G5）。
  W-027 已過、從未打開嘅 drill / wrongFacts 入補做但冇內容，永遠完成唔到；冇 service 可以 materialise 已過日子
        （方案 A 跟 arch §C.3 加 ensurePlanDay；方案 B 擴大 G24 要 PM 確認）。
  S-108 planValidTask 唔檢查 ch / quota / slot → 壞 drill.ch 令 ensurePlanToday throw。
  6 個自報偏離全部合理（parseStoredPlan 嚴格度見 S-108）。visual-diff 0 diff。報告未 commit。
```
