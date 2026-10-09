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
