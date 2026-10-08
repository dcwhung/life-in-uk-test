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

---

# Round 2（commit 4e7b503，基於 b7d3fdc）

- 日期：2026-10-08
- 範圍：`git show 4e7b503`。只改咗 `js/domain/plan.js`、`js/domain/planProgress.js`、`tests/plan-test.js`
- 方法：重跑 Round 1 嘅 probe，另外加一個新 probe `probe2`（連續改目標兩次、今日變休息日、`ensurePlanToday` 填已過日子、`ch=9` parse），再跑 `run-all.sh`
- 總評：三項都修好咗，而且有測試守住。不過 W-026 嘅修法有一個殘留情況：**第二次改目標**時會失去已完成嘅記錄，開 W-028 跟進。**94 / 100，pass**

## Hard Gates（Round 2）

| Gate | 結果 | 備注 |
|---|---|---|
| Lint / Type / Coverage / Security | n/a | 同 Round 1 |
| Tests | pass | `run-all.sh` 32 / 32 PASS，`plan-test` 2637 checks × 3 TZ；跑完已還原 png、刪 `shot-similar.png`，working tree clean |
| No Critical | pass | 0 |

## 評分結果（Round 2）

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 20 | 25 | W-028 |
| 安全性 | 20 | 20 | S-108 已修 |
| 可維護性 | 20 | 20 | `planFillDays` / `planWriteFilled` 拆得清楚；`PLAN_PAST_TYPES` 有命名 |
| 測試覆蓋 | 14 | 15 | 新增 4 組 check 都係行為測試；未有「連續改目標兩次」case |
| 性能 | 10 | 10 | `ensurePlanToday` 一次寫入；`planMaterializeCtx` 只讀一次，最多 ~180 日都只係 O(n²) 嘅淺 copy |
| 代碼風格 | 10 | 10 | — |
| **總分** | **94** | **100** | |

**結果：✅ pass**（按規則：≥ 90、冇 Critical。W-028 建議喺 PR4 改目標 UI 上線前修好；改目標要到 PR4 先有入口）

## 驗證結果

| ID | 狀態 | 證據 |
|---|---|---|
| W-026 | ✅ 已修（單次改目標）；殘留問題見 W-028 | 原本嘅 repro：今日完成 32 條，同日改做 30 分鐘 → 32 / 32 條釘喺新今日、聽日重複 0 條、`parseStoredPlan` 照過、全部 fact 剛好排一次。提早喺 10-13 完成嘅 32 條，第一次改目標後重排 0 條 |
| W-027 | ✅ 已修 | 已過、從未打開嘅強化日：`ensurePlanToday` 之後補做出現 `drill:4 / drill:4 / drill:15`（有題目）；已過 review 仍然冇內容（G24）；已過 mock 冇揀 Exam（G8）；`planCarryTasks` / `planNextStep` 唔會再指向冇內容嘅 task；`carryFrom` 之前嘅日子唔會填；未來日子唔會寫入（G23） |
| S-108 | ✅ 已修 | `ch=9` → parse `null`；10 種壞 field（ch / quota / slot / pair / qid 類型）都係 `null`；`ensurePlanToday` 返 `null`、唔 throw、唔寫入 |

## 新問題

### 🟡 W-028 — 第二次改目標會再排返之前已完成嘅知識點（W-026 修法有殘留）

- **位置**：`js/domain/planProgress.js` `planFactsDoneSet`（只睇 plan 入面 read task 嘅日子）、`planPinToday`（新今日係休息日時唔釘）
- **描述**：判斷「已完成」要靠嗰條 fact 仍然喺某個 read task 入面，而且嗰日嘅 log 全部 `ok`。第一次改目標之後，以下兩類已完成嘅 fact **唔再喺任何 read task 入面**：
  1. 提早喺未來日子完成嘅 fact：嗰啲未來日子已經重新生成，而新日子唔會包含已完成嘅 fact。
  2. 今日完成，但新目標令今日變成休息日（developer 自報「唔顯示但照當完成」）。
  第二次改目標時，`planFactsDoneSet` 搵唔返佢哋，於是當未完成再排。
- **重現**（probe2）：
  - 提早喺 10-13 完成 32 條 → 10-09 改目標 → 0 條重排 ✅ → 同日再改一次 → **32 條重排** ❌
  - 今日完成 32 條 → 改目標令今日變休息日 → 0 條重排 ✅ → 改返 → **32 條重排** ❌
- **影響**：同 W-026 一樣：用戶做過嘅嘢「唔計」、要再做（G7 / G5）。要連續改目標兩次先會出現，但係改目標本身冇次數限制，用戶好容易試幾次。
- **方案 A**（推薦）：完成度直接睇 log。某條 fact 只要喺**某一日**嘅 log 入面，全部 canonical 題都 `ok`，就算已完成；唔需要 plan 入面仲有對應嘅 read task。
  - Trade-off：強化 / 清錯題日答啱都可能令 fact 算完成。但係 G3 嘅定義本身就係「答啱對應題目」，而 log 只會記錄喺計劃任務入面出現過嘅題目，所以語意一致；改動最細，又唔使改 schema。
- **方案 B**：`replanFrom` 將已完成嘅 fact 記入 `plan.doneFacts`（每次 union），`planFactsDoneSet` 一齊睇；`parseStoredPlan` 要驗證呢個欄位。
  - Trade-off：記錄明確，但多一個要 migrate / 驗證嘅欄位。
- **測試**：加兩個 case，分別係「提早完成 → 改兩次」同「今日完成、今日變休息日 → 改兩次」，兩個都要 assert 已完成嘅 fact 唔會再出現喺新嘅 learn 任務。

## 其他觀察（冇開 ID）

- 提早完成嘅日子（例如 10-13）改目標之後，嗰日嘅新任務係另一批 fact，所以嗰日會顯示 0%，但係 fact 本身照計已完成（KPI 用 log）。到嗰日先係正常一日，唔算 defect。PR5 月曆只會顯示 `<= today` 嘅 %，所以睇唔到。
- `ensurePlanToday` 會用**打開嗰陣**嘅錯題簿 / streaks，一次過填晒全部未填嘅已過強化日。所以同一章幾日嘅 drill 題目可能一樣。跟 Round 1 方案 A 嘅 trade-off，可以接受。
- `mock.exam` 仲未驗證（只驗 `slot`）。PR5 / PR6b 用 `exam` 開考試時，記得用 `EXAM_NUMBERS.includes` 做 guard。

## HANDOFF_RECEIPT（Round 2）

```
HANDOFF_RECEIPT
from: code-reviewer
task: review PR #57 round 2 (commit 4e7b503: W-026 / W-027 / S-108 fixes)
status: pass
score: 94
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass (32/32, plan-test 2637 checks × 3 TZ)
  coverage: n/a
  no_critical: pass
  security_scan: n/a
findings: C=0 W=1 (W-028 new) S=0; W-026 / W-027 / S-108 verified fixed
report: .proj-docs/reviews/2026-10-08_review_plan-pr1.md (Round 2 section)
next_action: invoke_qa
context: |
  W-026 單次改目標已修；殘留 → W-028：第二次改目標會再排返「提早喺未來日子完成」同
  「今日完成但今日變休息日」嘅 fact（planFactsDoneSet 只睇 plan 入面嘅 read task）。
  推薦方案 A：直接用 log 判斷 fact 完成（某一日全部 canonical 題 ok）。改目標入口要到 PR4，
  建議 PR4 前（或者 merge 前順手）修好。W-027、S-108 已確認修好。報告未 commit。
```

---

# Round 3（commit 6ec9cf5，基於 0d43cb2）

- 日期：2026-10-08
- 範圍：`git show 6ec9cf5`，只改咗 `js/domain/planProgress.js` 同 `tests/plan-test.js`。新規則：只要任何一日嘅 log 入面，一條 fact 嘅全部 canonical 題都 `ok`，就當呢條 fact 已完成；`planTodayDoneTasks` 改為由今日 log 組 group。
- 方法：重跑 Round 2 `probe2`（連續改目標兩次）；新加 `probe3`（喺強化日改目標）；再跑 `plan-test`（2642 checks × 3 TZ）、`structure-test`、`i18n-test`、`upgrade-test`、`sw-test`，全部 PASS。跑完已還原 png，working tree clean。
- 總評：**W-028 已修**。新規則同 G3 / G7 一致。不過「今日釘返」嘅部份有一個新副作用，開咗 W-029。**94 / 100，pass**

## W-028 驗證

| 情況 | Round 2 | Round 3 |
|---|---|---|
| 提早喺 10-13 完成 32 條，再連續改目標兩次 | 第二次重排 32 條 | **0 條**（全部 day 都冇再出現） |
| 今日完成 32 條，第一次改目標令今日變休息日，第二次改返 | 第二次重排 32 條 | 32 條全部釘喺新今日（已完成）；**其他日子 0 條** |
| 同日改做 30 分鐘（Round 1 原本嘅 repro） | — | 32 / 32 條釘喺今日；聽日重複 0 條；每條 fact 剛好排一次；照 parse 到 |

## 新規則嘅副作用：判斷

**問題：喺強化日或清錯題日答啱，會唔會令一條未學嘅 fact 當成完成，跳過 learn？會，而我認為可以接受。**
- **G3**：「溫咗一條 fact」嘅定義係**答啱對應題目**；淨係睇、唔做題就唔計。
- **G4**：要全部題目都答啱。新規則要求同一日全部 canonical 題 `ok`，同 read task 嘅完成條件完全一樣，冇放寬。
- **G7**：改目標只重排「未完成」嘅內容。一條 fact 嘅題目已經全部答啱過，按 G3 就係「已溫」，再排入 learn 反而違反 G7。
- **log 嘅來源**：log 只會記錄計劃任務入面出現過嘅題目（attribution ①–③），隨意喺 Practice 答嘅題目唔會入 log，所以唔會有雜訊令 fact「意外」完成。
- **影響範圍**：只影響 `replanFrom`；`buildPlan` 同 `planKpis.factsDone` 本身已經用 log 判斷（`factsDone` 由 Round 1 起就係咁），而家兩邊口徑一致，係改善。
- **剩低一個邊界**：如果 PR3「建立新計劃」冇清走舊 log，舊計劃嘅 log 會令新計劃改目標時跳過 fact。Round 1 已經提示 PR3 建立前要 `clearStudyPlan()`，呢度再強調一次。

## 新問題

### 🟡 W-029：喺非 learn 日改目標，會將早已學完嘅 fact 重複釘入今日，令今日 % 失真

- **位置**：`js/domain/planProgress.js` `planTodayDoneTasks`
- **描述**：`planFactsDoneOn(log, today)` 會揀出今日 log 入面全部題目都 `ok` 嘅 fact，但冇排除喺**之前日子**已經完成嘅 fact。強化日 / 清錯題日答嘅題目大部份屬於已經學完嘅 fact，所以改目標之後，呢啲 fact 會變成今日嘅 read + practice 任務再出現一次。
- **重現**（probe3）：21 日計劃，learn 日全部完成，今日係第一個強化日，而且已經 100% 完成（24/24）。改目標做 90 分鐘之後：
  - 今日任務變成 `read, practice, read, practice, drill ×3, wrongFacts`，其中 **10 條係早已學完嘅 fact**；
  - 成個計劃有 246 個 read fact，但只有 236 條 unique，違反 PR1 驗收「每條 fact 剛好出現一次」；
  - 今日 % 由 100 變 48（28/58）。
- **影響**：顯示錯誤：強化日出現「讀知識點」任務，KPI / 連續紀錄計算都會受影響。冇資料損失。
- **方案 A（推薦）**：`planTodayDoneTasks` 只釘**今日先第一次完成**嘅 fact，即係排除喺今日之前任何一日已經完成嘅 fact（可以由 `planFactsDoneSet` 減去今日嗰日計出嚟）。改動大約 3 行，加一個 test。
- **方案 B**：只釘喺今日舊 read task 入面嘅 fact，再加上今日之前未完成嘅 fact。比較複雜，冇明顯好處。
- **相關觀察（冇開 ID）**：喺強化日改目標，今日已經 materialise 嘅 drill 會被重新生成，下次打開今日頁先再揀題目。今日已答啱嘅題目可能唔喺新嘅 drill 入面。G7 寫明「由今日起用新目標重排」，所以呢個係按規格嘅行為；如果想保留今日已做嘅強化，可以喺 PR4 考慮：今日唔係 learn 日時保留已經 materialise 嘅 task。

## 評分結果（Round 3）

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 20 | 25 | W-029 |
| 安全性 | 20 | 20 | — |
| 可維護性 | 20 | 20 | 完成度只有一個來源（log），`planFactsDoneOn` 好簡潔 |
| 測試覆蓋 | 14 | 15 | 有雙重改目標 case；冇非 learn 日改目標嘅 case |
| 性能 | 10 | 10 | 183 日 log 全掃一次，可以接受 |
| 代碼風格 | 10 | 10 | — |
| **總分** | **94** | **100** | |

**結果：✅ pass**（≥ 90、冇 Critical）。W-029 建議喺 PR4 加改目標 UI 之前修好。

## HANDOFF_RECEIPT（Round 3）

```
HANDOFF_RECEIPT
from: code-reviewer
task: review PR #57 round 3 (commit 6ec9cf5: W-028 fix)
status: pass
score: 94
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass (plan-test 2642 checks × 3 TZ; structure / i18n / upgrade / sw re-run PASS; run-all 32/32 self-reported)
  coverage: n/a
  no_critical: pass
  security_scan: n/a
findings: C=0 W=1 (W-029 new) S=0; W-028 verified fixed
report: .proj-docs/reviews/2026-10-08_review_plan-pr1.md (Round 3 section)
next_action: invoke_qa
context: |
  W-028 已修：連續改目標兩次 0 條重排。新規則（任何一日 log 全部題 ok = fact 完成）符合 G3/G4/G7，
  強化日答啱令未學 fact 跳過 learn 屬可接受。新 W-029：planTodayDoneTasks 冇排除之前已完成嘅 fact，
  非 learn 日改目標會重複釘 read 任務（246 read / 236 unique），今日 % 100 → 48；修法約 3 行，建議 PR4 前修。
  PR3 建立新計劃前要 clearStudyPlan()（舊 log 會影響新計劃）。報告未 commit。
```
