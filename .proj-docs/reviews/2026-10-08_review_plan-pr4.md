# Code Review — 溫習計劃 PR4（T-319–T-322）：進度表、改目標、重設

- **日期**：2026-10-09（報告檔名按計劃日期 2026-10-08）
- **審閱者**：Code Reviewer agent
- **目標**：PR #62 `claude/charming-hopper-48ypzp` @ `6cf55aa`；diff = `git diff origin/main...HEAD`（18 files，+906 / −34）
- **Design Origin**：`mockup:mockups/study-plan-flow.html#step2`（PR description 第一行，有效；mockup 存在）
- **總評**：結構清楚、測試覆蓋夠深（真 click、44px、scroll、G7 凍結逐字比對、S-112、舊 shell）。`replanFrom` 接駁正確，冇破 G7 / G30；重設只清 plan + log 兩個 key。有 2 個 Warning：已過日子用 `opacity` 淡化，令文字對比度跌到約 2:1；改目標畫面嘅可行性 meter 仲係用成份課程計，會誤報「✕ 不足」。

---

## Hard Gates

| Gate | 結果 | 備注 |
|---|---|---|
| Lint | n/a | 項目冇 linter；`structure-test` PASS |
| Type check | n/a | vanilla JS |
| Tests | ✅ pass | `run-all.sh` 35 套 ALL PASS，exit 0（另外 plan-schedule / plan-ui / lang-switch 各重跑 3 次，見下面「Flaky」） |
| Coverage | ✅ pass | 新 `plan-schedule-test` 覆蓋晒 §PR4 驗收；domain 由 `plan-test`（2646 checks）覆蓋 |
| No Critical | ✅ pass | 0 個 Critical |
| Security scan | n/a | 冇新 dependency |
| visual-diff（UI-common） | ✅ VISUAL IDENTICAL（76 個狀態，0 diff） | `node tests/tools/visual-diff.js origin/main` |

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|---|---|---|---|
| 正確性 | 20 | 25 | W-035 改目標可行性誤報 |
| 安全性 | 20 | 20 | 冇 innerHTML 注入面：插入嘅都係 locale / 常數 / 數字 |
| 可維護性 | 19 | 20 | S-113 |
| 測試覆蓋 | 15 | 15 | |
| 性能 | 10 | 10 | 184 日 + 90 日 log：開畫面 83 ms、語言重繪 53 ms（desktop Chromium，包 layout） |
| 代碼風格 | 4 | 10 | W-034（a11y 對比度）、S-114 |
| **總分** | **88** | **100** | |

**結果：⚠️ warn**（hard gates 全 pass、冇 Critical、75–89 分）

---

## 問題清單

### 🟡 W-034 已過日子用 opacity 淡化，日期格同 pill 對比度跌到約 2:1

- **位置**：`css/screens/plan.css` `.plan-day.past .plan-day-d { opacity: 0.4 }`、`.plan-day.past .plan-pill { opacity: 0.6 }`、`.plan-day.past .plan-day-ic { opacity: 0.55 }`
- **描述**：實測（360px，`--plan-past-row` 底）：Day 號碼約 **2.0:1**、日期 / 星期 `<small>` 約 **1.7:1**、`✓ 完成` pill 約 **2.6:1**。WCAG 1.4.3 要 4.5:1，豁免只係 disabled 控件同裝飾；呢度係資料文字（邊日、完成度），唔適用。任務文字用 `--text-muted`，有 5.07:1，冇問題。
- **影響**：低視力用戶睇唔清已過日子嘅日期同完成度，而呢啲正正係用戶回顧時要睇嘅資料。Developer 自報第 11 點「opacity 淡化 < 4.5:1」確認屬實。
- **方案 A**：唔用 opacity，改用專用 token（例如 `--plan-past-text` = 夠深嘅灰，日期格底改 `--plan-past-row` 或 `--bg`、pill 用 `.mute` 配色），淡化靠「冇階段色 + 灰底」表達。Trade-off：已過日子唔再見到階段色。
- **方案 B**：保留階段色，只淡化底色（`color-mix` / 新 `*-bg-past` token），文字色保持 ≥ 4.5:1。Trade-off：多幾個 token。
- **推薦**：A（簡單，同 mockup「淡化」意圖一致），並喺 `plan-schedule-test` 加對比度 assert（`look.past < 1` 改成驗 computed color 唔再係 opacity）。

### 🟡 W-035 改目標時可行性 meter 用成份課程計，會誤報「✕ 不足」

- **位置**：`js/screens/planGoal.js` `renderPlanFeas()` → `planFeasibility(planGoalDraft, todayIso)`（`js/domain/plan.js` `planNeedMinutes(level)` 永遠計 236 條知識點 + 全部題目）
- **描述**：`planCreate()` 改目標時行 `replanFrom(…, planLoadLog())`，只排 `planFactsLeft(log)` 剩低嘅知識點；但表單上面嘅 ✓ / △ / ✕、「需要 / 可用時數」同 meter 仍然當重頭讀過。實測：21 日計劃（60 分鐘）行咗 12 日、剩 44 條知識點，撳「改目標」→ 顯示 **「✕ Not enough」**，但撳更新後 replan 排到讀 + 練 3 日、強化 3 日、模擬考 3 日，完全夠。
- **影響**：中段改目標嘅用戶會見到錯誤警告，可能因此唔必要咁延後考試日或者加時（G13 嘅「✕」本意係內容排唔晒）。
- **方案 A**：`planFeasibility(goal, todayIso, factIds = PLAN_LEARN_ORDER)`，編輯模式傳 `planFactsLeft(planLoadLog() || planEmptyLog())`；`planNeedMinutes` / `planLearnMinutes` 跟住收 `factIds`。Trade-off：要喺 `plan-test` 加 case；強化 / 模擬考嘅估算照舊。
- **方案 B**：編輯模式收埋 meter，只留 G28 最少溫習日檢查。Trade-off：用戶失去回饋。
- **推薦**：A。

### 🟢 S-113 `planWhen()` 回傳裸字串 `'today'` / `'past'`，同時當 class 名用

- **位置**：`js/screens/planSchedule.js` `planWhen`、`planDayPillHtml`（`when === 'today'`）
- **描述**：magic string，class 名同邏輯值綁死，PR5 月曆會再用同一概念。
- **方案 A**：`const PLAN_WHEN = { today: 'today', past: 'past' }`。**方案 B**：保留字串，加註釋說明係 class 名。**推薦**：A。

### 🟢 S-114 `plan.css` 新規則有幾個唔經 token 嘅尺寸

- **位置**：`.plan-legend i { border-radius: 3px }`、`.plan-day-tasks { gap: 3px }`、`.plan-phase-bar { height: 34px }`、`.nav-btn.plan-small { padding: 7px … }`
- **描述**：sw-coding-style-css 要求 spacing / radius 用 token；`3px` 冇對應 `--space-*` / `--radius-*`。PR3 `.plan-cta-go` 都有 `7px`，屬同一模式。
- **方案 A**：改用最近嘅 `--space-1` / `--radius-sm`（外觀有 1px 差）。**方案 B**：加 `--radius-xs` token。**推薦**：A，連 PR3 嘅 `7px` 一齊處理。

---

## 重點核對（逐項）

| 項目 | 結論 |
|---|---|
| **G7** 改目標凍結過去、Day 1 不變 | ✅ `planCreate` 編輯路徑用 `replanFrom(old, draft, today, log)`；`planFrozenDays` 原樣保留；測試比對過去 `days` JSON 同 past row `outerHTML` 逐字一樣；`start` 不變；`goalHistory` +1；log 唔郁 |
| **G30** 今日已 materialise 內容保留 | ✅ UI 傳 `planDayAt(plan, today)` 入 `planKeepTodayContents`（domain，`plan-test` 覆蓋）。PR4 本身唔 materialise（`ensurePlanToday` 喺 PR5），所以 UI 層暫時冇可測情境，PR5 要補 UI test |
| 編輯時 log 壞咗 | 可接受：用 empty log replan（排返全部知識點），壞 log 唔寫唔覆蓋，進度表「↺ 重設」可清（S-110）。冇提示屬 UX 小缺口，PR5 主頁卡可一併顯示 |
| 重設只清 plan + log | ✅ `clearStudyPlan()` = `removeLS` 兩個 key；測試驗 streak / wrong / switch 保留；壞 log 情境都測咗 |
| 改目標中途計劃喺另一 tab 被刪 | ✅ `old` 為 null → 當新計劃（`clearStudyPlan` + `buildPlan`） |
| scroll 到今日 / sticky | ✅ 用 list 自己嘅 `scrollTop`，唔郁 page；扣 sticky heading 高度；`plan-jump` class 令程式跳轉唔 smooth；reduced-motion 處理；今日 = 考試日 / 考試後（G16）都有落點 |
| 語言切換 | ✅ `rerenderPlanSchedule` 原位重繪、保留 scroll；list container 唔換，focus 唔會掉（PR3 教訓） |
| S-112 | ✅ outside-click 豁免 `#confirmModal`；Esc 只關最上層；Cancel / Esc / Confirm 三條路徑真 click 測過 |
| PLAN_SCREEN_IDS / planShellReady | ✅ 加 `screenPlanSchedule`；`planShellReady` 改成全部 screen 都要有；`upgrade-test` 加 PR3 shell 情境 |
| LATE_BOOT_SCRIPTS / SW SHELL | ✅ 兩邊都有 `planSchedule.js`；`APP_VERSION` 唔升符合「中間 PR 唔升版本」 |
| 44px | ✅ `.plan-hit::before` + `hitOk` 真 elementFromPoint 測 |
| i18n parity / 書面語 | ✅ `i18n-test` PASS；`modal.planReset` 加入書面語 scope；en 單複數用 `{one, other}`（phaseDays / practice / drill / mockTitle）；zh 用字無口語 |
| list 效能（最長 ~184 日） | ✅ 一次 `innerHTML`；實測開 83 ms、重繪 53 ms（含 layout） |
| 函數長度 | ✅ 全部 < 30 行（最長 `planTaskText` ~10 行） |
| Token | ✅ 顏色全部經 token（hex 只喺 `tokens.css`）；尺寸見 S-114 |

### Phase 日數 / 常數核對（G12 / G13）

用 `buildPlan` 直接計（today 2026-10-09）：

| 目標 | 讀 + 練 | 強化 | 模擬考（含最後輕鬆日） | 試卷 | 可行性 |
|---|---|---|---|---|---|
| 31 日 · 2 小時 · 一片空白 · 休週日 | 7 | 13 | 5 + 1 = 6 | 10 | ok |
| 31 日 · 2 小時 · 一片空白 · 唔休 | 7 | 17 | 6 + 1 = 7 | 12 | ok |
| 21 日 · 2 小時 · 一片空白 · 休週日 | 7 | 7 | 3 + 1 | 6 | ok |
| 7 日 · 2 小時 · 唔休（G28 下限） | 5 | 0 | 1 + 1 | 2 | short |

截圖（開始日 28/9）嘅「讀 + 練 7、強化 14、模擬考 6、10 份」同公式一致：溫習日 25 → 讀 + 練 `ceil(learnMins / 105)` = 7，模擬考 `round(25 × 0.2)` = 5（+ 輕鬆日顯示為 6），強化 = 剩低 13–14 日（按休息日落邊個星期幾）；10 份 = 5 日 × `floor(120 / 60)` = 2。G13（✕ 都建立、最少 1 日模擬考）同 G12 常數（`PLAN_LEVELS`）都同 domain 一致。順帶一提：30 分鐘一日都會排 1 份 45 分鐘模擬考（`max(1, …)`），屬 domain 設計，唔係 PR4 嘅事。

### Developer 自報偏離 / 未決 — 判斷

| # | 項目 | 判斷 |
|---|---|---|
| 1 | a11y 對比度改深色字（橙底 / heat band） | ✅ 接受；實測 h0–h3 4.97–11.97:1、`.mute` 4.85:1 |
| 2 | heat token 只加 0–3，h4 留 PR5 | ✅ 接受；100 % 用 `.ok`，PR5 必須補 h4（G27 5 級） |
| 3 | 練習寫題數唔寫題號 | ✅ 接受；qids 係跨 exam canonical key，題號會誤導 |
| 4 | 模擬考任務冇「計時 45 分鐘」 | ✅ 符合 handoff §2.3「任務文字唔顯示分鐘」；策略卡有寫分鐘 |
| 5 | 重設確定掣 navy | ✅ 接受；同 planOff modal 一致，handoff 只要求「確定」 |
| 6 | en「Mocks」 | ✅ 接受（360px phase bar 要放得落）；G20 對照表時俾用戶確認 |
| 7 | 改目標收埋步驟條 | ✅ 接受 |
| 8 | 重設後主頁 scroll 頂 | ✅ 接受；測試驗咗建立卡喺 viewport |
| 9 | 考試日前會出一個淨係考試日嘅 Week heading | ✅ 接受（只係 `days.length % 7 === 0` 先出現） |
| 10 | 另開 `plan-schedule-test` | ✅ 接受；已入 `run-all.sh` |
| 11a | 舊 PR3 shell 收埋建立卡 | ✅ 接受（CUI-0021 延伸，`upgrade-test` 有測） |
| 11b | 改目標時 log 壞咗冇提示 | 可接受，見上表；唔開 ID |
| 11c | 已過日子 opacity < 4.5:1 | ❌ 開 **W-034** |

### Flaky

`run-all.sh` 第一次全綠（exit 0）。`plan-schedule-test` / `plan-ui-test` / `lang-switch-test` 各再跑 3 次：9 / 9 PASS。Developer 講嗰次 exit 1 重現唔到；可疑位：`lang-switch-test checkPlanSchedule` 用真時鐘 `planTodayIso()` seed（啱啱過午夜會變），同 `plan-schedule-test checkScrollToToday` 嘅 `waitForTimeout(100)`。下次再撞到請保留完整 log。

---

## ✅ 做得好嘅地方

- `planCreate` 一行分流新計劃 / 改目標，另一 tab 刪咗計劃都有 fallback。
- 測試真 click + elementFromPoint 驗 44px、sticky heading 全闊、今日就喺 heading 下面、page 唔郁；G7 用 `outerHTML` 逐字比對過去 row，好紮實。
- 語言切換原位重繪兼保留 scroll，冇重蹈 PR3 喺 focus 期間重建嘅覆轍。
- S-112 改動最小（selector 加 `#confirmModal` + Esc `return`），有三條路徑嘅測試。
- `planShellReady` 改成睇齊 `PLAN_SCREEN_IDS`，之後 PR5 加 screen 自動受保護。

## 修正優先順序

| 優先 | ID | 工作量 |
|---|---|---|
| 1 | W-034 已過日子對比度 | 0.25 日 |
| 2 | W-035 改目標可行性用剩餘內容 | 0.5 日（含 plan-test） |
| 3 | S-113 / S-114 | 0.1 日 |

## 修訂代碼要點（示意，唔係 commit）

```css
/* tokens.css */
--plan-past-text: var(--text-muted);   /* ≥ 4.5:1 on --plan-past-row */
/* plan.css — W-034: no opacity on information */
.plan-day.past .plan-day-d { background: var(--bg); color: var(--plan-past-text); }
.plan-day.past .plan-day-d small { color: var(--plan-past-text); }
.plan-day.past .plan-pill { background: var(--bg); color: var(--plan-past-text); }
```

```js
// plan.js — W-035
function planFeasibility(goal, todayIso, factIds = PLAN_LEARN_ORDER) {
  …
  const needMins = planNeedMinutes(goal.level, factIds);
  const split = planSplitStudyDays(Math.max(0, studyDays - 1), goal, planLearnMinutes(goal.level, factIds));
  …
}
// planGoal.js renderPlanFeas
const factIds = planGoalEditing ? planFactsLeft(planLoadLog() || planEmptyLog()) : PLAN_LEARN_ORDER;
const f = planFeasibility(planGoalDraft, todayIso, factIds);
```

---

## Handoff receipt

```yaml
HANDOFF_RECEIPT:
  agent: code-reviewer
  task: review plan PR4 (T-319–T-322), PR #62 @ 6cf55aa
  status: warn
  score: 88
  hard_gates:
    lint: n/a
    type_check: n/a
    tests: pass
    coverage: pass
    no_critical: pass
    security_scan: n/a
    visual_diff: pass
  findings:
    critical: []
    warning: [W-034, W-035]
    suggestion: [S-113, S-114]
  next_action: invoke_developer_fix
  context: "W-034 past-day opacity → contrast ~2:1; W-035 change-goal feasibility counts the whole syllabus. One commit per item (fix: W-034 | …). Then re-review delta."
  report: .proj-docs/reviews/2026-10-08_review_plan-pr4.md
```

---

# Round 2 — 2026-10-09

- **目標**：`claude/charming-hopper-48ypzp` @ `c5e4994`；delta = `git diff 1c1e476..HEAD`（13 files，+275 / −62）
- **Commit**：`cd90d7e` W-034、`16cc3b5` W-035、`a5ab37b` S-113、`95a0f85` S-114、`5ca9909`（lang-switch 固定 clock、scroll wait）、`fdd1aa8`（docs G36）、`c5e4994` G36
- **總評**：Round 1 四項全部修好，每項一個 commit。G36 做得乾淨：create mode 行為完全冇變（41 040 個目標新舊對比，0 差異）；edit 限制只喺 `replanFrom` 同改目標表單用。開 1 個 Suggestion（S-115）：半夜過咗之後撳「更新」冇反應，亦冇提示。

## Hard Gates（Round 2）

| Gate | 結果 | 備注 |
|---|---|---|
| Lint | n/a | `structure-test` PASS |
| Type check | n/a | vanilla JS |
| Tests | ✅ pass | `run-all.sh` 35 套 ALL PASS，exit 0（`plan-test` 2688 checks）；`plan-schedule-test` / `lang-switch-test` 各再跑 2 次，4 / 4 PASS |
| Coverage | ✅ pass | 新 `checkEditValidation` / `checkFeasibilityFactsLeft` / `checkReplanLastWeek`（domain）+ `checkChangeGoalFeasibility` / `checkChangeGoalLastWeek`（UI） |
| No Critical | ✅ pass | 0 |
| Security scan | n/a | 冇新 dependency |
| visual-diff（UI-common） | ✅ VISUAL IDENTICAL（76 個狀態） | `node tests/tools/visual-diff.js origin/main`；之後已 `git checkout -- 'tests/*.png'`、`rm -f tests/shot-similar.png` |

## 評分結果（Round 2）

| 維度 | 得分 | 滿分 | 備注 |
|---|---|---|---|
| 正確性 | 24 | 25 | S-115 |
| 安全性 | 20 | 20 | |
| 可維護性 | 20 | 20 | S-113 已修 |
| 測試覆蓋 | 15 | 15 | |
| 性能 | 10 | 10 | |
| 代碼風格 | 10 | 10 | W-034、S-114 已修 |
| **總分** | **99** | **100** | |

**結果：✅ pass**

## Round 1 項目驗證

| ID | 結論 | 證據 |
|---|---|---|
| W-034 | ✅ 已修 | 重跑 Round 1 probe（360px；已過日子有 100% / 46% / 0% / 休息）：computed contrast 最低值：日期格 Day 號碼同 `<small>` **4.85:1**（`--text-muted` 配 `--bg` 底）、任務文字 5.07:1、`✓ Done` 5.88:1、h1 4.97:1、h0 11.97:1、`.mute` 4.85:1。全部 effective opacity = 1，只有裝飾 icon 係 0.55。今日格保留階段色。`plan-schedule-test` 改成逐個 text 驗 ≥ 4.5:1 同冇 opacity |
| W-035 | ✅ 已修 | 同一 probe（21 日 · 60 分鐘 · 行咗 12 日 · 剩 44 條知識點）：改目標 meter 由 **✕ short** 變 **△ tight**（ratio 1.01）；replan 排 `讀讀讀 強強強 模模 + 輕鬆日`。新計劃照用成份課程（UI test 驗返仍然係 ✕）。強化 + 模擬考嘅估算照舊，同 Round 1 方案 A 一致 |
| S-113 | ✅ 已修 | `PLAN_WHEN = { today, past, ahead: '' }`，註釋寫明係 class 名 |
| S-114 | ✅ 已處理（方案 B 變體：記錄原因） | `tokens.css` 寫明 3px / 7px / 34px 點解唔跟 scale（對齊 mockup、同 `.back-btn` 7px 一致；swatch 用 6px 會變圓形）。同 0 視覺差異嘅取捨合理，接受 |
| Flaky | ✅ 已處理 | `lang-switch-test checkPlanSchedule` 開新 page 再固定 clock；`checkScrollToToday` 用 `waitForFunction` 代替 100 ms。今次 run-all 加重跑 4 次都冇 fail |

## G36 審閱

| 項目 | 結論 |
|---|---|
| **create mode 完全不變** | ✅ 用 vm 載入 `1c1e476` 嘅 `plan.js` / `planProgress.js` 同 HEAD 版本，3 個 today × 1–190 日 × 6 種分鐘 × 4 種休息日 × 3 個程度 = **41 040 個目標**，比較 `validatePlanGoal`、`buildPlan`、`planFeasibility`、`planExamDateRange` 嘅 JSON 輸出：**0 差異**。`planSplitStudyDays` 嘅 `mock` 由 `max(1, min(rest, …))` 改成 `min(rest, max(1, …))`，只有 `rest = 0` 時唔同，舊公式喺嗰度會出 `drill = -1`；create mode 去唔到呢個情況，所以冇影響 |
| **mode 預設安全** | ✅ `planGoalLimits()` / `(undefined)` / `(null)` / `('EDIT')` 全部回 create（7 / 7），只有 `'edit'` 先係 1 / 1。所有 domain 函數嘅 mode 參數預設都係 create；edit 只喺 `replanFrom`（包括「clock 早過 Day 1」嗰條 `buildPlan` 路徑）同 `planGoalMode()` 用 |
| **1–2 溫習日邊界** | ✅ 隨機 400 個進行中計劃（開始日 1–40 日前、長度 8–68 日、各種分鐘 / 休息日 / 程度 / 完成度）× 考試日 1–8 日後 × 3 種休息日，一共 **6 831 次 edit replan，0 個問題**。驗咗：過去日子逐字凍結（考試後補嘅空檔係休息日）、`start` 不變、每條未完成知識點讀 1 次、題目練 1 次（按 learn order）、冇空嘅溫習日、溫習日數同 calendar 一樣、feasibility `studyDays` 同 plan 一致。形態：1 日 = `learn`；2 日 = `learn, light`；3 日 = `learn, mock, light`；4 日以上 learn → drill → mock → light。0 個溫習日（例如今日係休息日，考試聽日）會被拒，有 edit hint |
| **replan 守恆** | ✅ 同上；`planKeepTodayContents` 只係換同類型、已 materialise 嘅 task，唔會丟知識點 |
| **UI** | ✅ 日期欄 `min` = 聽日；`#planDateNote` 只喺改目標顯示；hint 用 `editMinStudyDays`；改目標途中另一個 tab 刪咗計劃 → 轉做 create mode，日期 clamp 到 +7，顯示 G28 hint，唔會寫入（自己 probe 過，冇 page error） |
| **zh-HK 書面語** | ✅「改目標時，考試日期最早可選明天。」、「考試前最少需要 {n} 個溫習日，未能更新進度表。請減少休息日或延後考試日期。」、「共 {n} 日，休息 {rest} 日」——冇口語字（`i18n-test` 書面語 scope PASS） |
| **en 複數** | ✅ `studyDaysSub` 同 `editMinStudyDays` 都係 `{one, other}`，用 `n` 揀（`i18n.js` `PLURAL_N_PARAM`）；UI test 驗咗「1 day, 0 rest」同「At least 1 study day is needed…」。`studyDaysSub` 由 `{total}` 改名 `{n}`，兩個 locale 都改咗，parity PASS |

### 1 個溫習日、仲有未完成知識點時冇輕鬆重溫日：合理

接受。G13 要所有內容都排到（✕ 照樣建立，每日長啲）；G36 又寫明「時間唔夠照樣排（G13）」。只剩 1 日嘅話，排輕鬆重溫就要放棄未讀嘅知識點，同 G13 衝突。輕鬆日嘅作用係考試前減壓，而且佢本身係可以犧牲嘅任務；知識點冇讀過就一定答唔到。所有知識點都完成咗嘅話，仍然會排輕鬆日（test 有驗）。2 日嘅情況係 `learn, light`，冇模擬考日：輕鬆日喺 phase bar 計入模擬考，亦符合「learn 優先」，接受。建議 PR7（G35）中英對照時順便俾用戶睇一次呢兩個形態。

### 觀察（唔開 ID）

- 只剩 1–2 日時，「建議需要」仍然計成份強化 + 模擬考（例如 1 日 · 2 小時 → 需要 18 小時，「尚欠約 16 小時」），但 plan 唔會排呢啲。呢個係 W-035 方案 A 刻意保留嘅估算，✕ + 「可延後考試日期」嘅建議亦都合理；唔當缺陷。
- 改目標畫面 ✕ 提示寫「仍可照樣建立」，但掣係「更新進度表」。Round 1 已經係咁；G36 之後最後一星期會經常見到 ✕，建議 PR7 字眼審閱時一齊改（例如「仍可照樣更新」）。

## 問題清單（Round 2）

### 🟢 S-115 半夜過咗之後撳「更新 / 建立」，`planCreate` 冇反應亦冇提示

- **位置**：`js/screens/planGoal.js` `planCreate()` → `if (!plan) { if (planGoalEditing && !old) {…} return; }`
- **描述**：Probe：10-08 改目標揀考試日 10-09（聽日），clock 去到 10-09 00:01 先撳「更新進度表」→ `replanFrom` 回 `null`（考試日變咗今日），畫面留喺表單、掣仍然可以撳、draft 仍然係 10-09，冇任何提示；再撳幾多次都一樣。要郁過任何輸入，`planClampDraftDate` 先會修正。create mode 喺 PR3 已經有同樣問題（+7 日跨過午夜），但 G36 令「考試日 = 聽日」變成正常用法，夜晚改目標就更容易撞到。
- **影響**：低（要剛好跨過午夜），但用戶會見到一個撳極都冇反應嘅掣。
- **方案 A**：`if (!plan) { if (planGoalEditing && !old) planGoalEditing = false; renderPlanGoal(); return; }`——任何失敗都重新 render，令 S-111 clamp 同 CTA / hint 即刻更新。Trade-off：考試日會自動移後一日，用戶要再撳一次。
- **方案 B**：喺 `planCreate` 開頭先 `planClampDraftDate(todayIso)`，然後用 clamp 後嘅 draft 建立。Trade-off：用戶冇確認過就用咗新日期。
- **推薦**：A（同 S-111「先 clamp，再俾用戶睇」一致），加一個 `pg.clock.setFixedTime` 跨午夜嘅 UI test。

## ✅ 做得好嘅地方（Round 2）

- G36 嘅 limits 集中喺 `PLAN_GOAL_LIMITS` + `planGoalLimits(mode)`，未知 mode 一律當 create，預設值安全。
- `planStudySplit` 將「最後一日係咪輕鬆日」抽出嚟，`buildPlanDays` 同 `planFeasibility` 共用，兩邊數字唔會走樣。
- `checkReplanLastWeek` 逐個形態（1 / 2 / 3 / 6 日、全部完成）驗守恆同次序；W-034 嘅 test 改成驗 computed contrast，唔再驗 opacity。
- 修 flaky 嘅方法啱：固定 clock、等條件成立，唔係加長 timeout。

## Handoff receipt（Round 2）

```handoff-receipt
protocol: 1
status: pass
score: 99/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
  no_critical: pass
  security_scan: n/a
  visual_diff: pass
next_action: merge_develop
next_agent: null
branch: "claude/charming-hopper-48ypzp"
context: "PR4 round 2 @ c5e4994: W-034 / W-035 / S-113 / S-114 resolved; G36 verified (create mode 0 diff over 41,040 goals; 6,831 edit replans conserve facts/qids, past frozen). New S-115 (midnight dead CTA in planCreate), optional, one commit 'fix: S-115 | …' or fold into PR5. PR7 wording: edit-mode '仍可照樣建立'."
```
