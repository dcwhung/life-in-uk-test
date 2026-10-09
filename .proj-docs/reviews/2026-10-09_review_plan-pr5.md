# Code Review — 溫習計劃 PR5（T-323–T-328）

- **日期**：2026-10-09
- **審閱者**：Code Reviewer（獨立）
- **目標**：PR #63 `claude/charming-hopper-48ypzp`，`git diff origin/main...HEAD`（code `9e54527`、docs `52fb151`；20 files，+1520 / −46）
- **Design Origin**：`mockup:mockups/study-plan-flow.html#step3` + ⓪ 狀態 B（PR description 第一行有，path 存在）
- **總評**：完成度、補做、歸屬全部經 domain（`planDayCompletion` / `planTaskProgress` / `planCarryTasks` / `planNextStep` / `planKpis` / `planStreakDays` / `planMonthGrid`），UI 冇另外計一套。G9 snapshot、換日 watcher、content-visibility、S-115 都做得正確。開咗 1 個 Warning（「返回今日」同月曆「今日」撳完之後 focus 跌去 `<body>`），另外 2 個 Suggestion。

## Hard Gates

| Gate | 結果 | 備註 |
|---|---|---|
| Lint | n/a | 項目冇 linter（純 vanilla JS） |
| Type check | n/a | 冇 TS |
| Tests | ✅ pass | `run-all.sh` 36 / 36 PASS（`plan-test` 2688 checks、`plan-day-test` PASS），EXIT=0 |
| Coverage | n/a | 冇 coverage 工具；`plan-day-test` 覆蓋 §PR5 驗收每一項 |
| No Critical | ✅ pass | 0 個 Critical |
| Security scan | n/a | 冇新 dependency |
| Visual diff | ✅ pass | `visual-diff origin/main`：VISUAL IDENTICAL（76 states）；之後已經 `git checkout -- 'tests/*.png'`、`rm -f tests/shot-similar.png`，working tree 乾淨 |

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 20 | 25 | W-036（鍵盤 focus 跌去 body） |
| 安全性 | 20 | 20 | innerHTML 入面只有 locale 同 data，冇用戶輸入 |
| 可維護性 | 19 | 20 | S-117 |
| 測試覆蓋 | 15 | 15 | `page.clock` 過午夜、返前台、HK / London、G9、S-115、O-1、44px、對比度、360/375/400 × en/zh-HK |
| 性能 | 10 | 10 | 181 日計劃、CPU ×4：開 Day 126 ms、‹ › 23–29 ms、轉月 10 ms、Home 30–43 ms |
| 代碼風格 | 9 | 10 | S-116 |
| **總分** | **93** | **100** | |

**結果：✅ pass**（hard gates 全部 pass、≥ 90 分、冇 Critical）。建議 W-036 喺 QA 之前修好（一個 commit）。

## 重點逐項核對

| 項目 | 結果 | 證據 |
|---|---|---|
| 完成度 / 補做 / 歸屬同 domain 一致 | ✅ | `planDay.js` / `planHome.js` 只 call domain function；G8 補做框用自己嗰日嘅 `dayLog`（`planDayLog(log, c.date)`），唔計今日 %（測試 #96 驗過補做答對之後今日 % 不變）；主頁卡 % 用同一個 `planDayCompletion` |
| G9 snapshot 只喺第一次打開、冇計劃唔寫 | ✅ | `openPlanDay` 同 `renderPlanCard` 都經 `ensurePlanToday()`；`planWriteFilled` 只喺 `changed` 先寫。Probe：冇計劃時 `renderPlanCard()` + `openPlanDay()` 前後 localStorage key 一樣（`lifeuk.migrated,lifeuk.studyPlanPreview`），仲留喺 Home；入口收埋時 `renderPlanCard` 一開始就 return。測試 #356–359：第一次 render 定咗 2 題錯題，之後答錯唔會加 |
| 換日 watcher leak / 重複 timer | ✅ | `planArmMidnight` 每次都先 `clearTimeout`（probe：call 5 次 `planWatchDay` → 每次只剩一個 timer）；`visibilitychange` 有 `planWatchBound` guard，只 bind 一次；用 `new Date(y, m, d + 1, 0, 0, 1)` 本地時間計，DST 啱；timer 早咗 fire 嘅話會 re-arm 去今晚午夜。（timer 喺 sleep 之後遲咗 fire 都冇害：`planCheckNewDay` 比較 ISO，同一日就乜都唔做） |
| 時區 | ✅ | `planTodayIso` 用本地日期；測試同一刻 London Day 1 / HK Day 2 |
| ‹ › focus | ✅ | header 原位更新，focus 留喺箭咀；去到頭尾嗰粒 disabled 就交俾另一粒（測試 #33 / #35 / #236） |
| 月曆 focus | ⚠️ | 撳格 → 頁面去頂、focus 去 `#planDayHeading`（tabindex −1）✅；**「← 返回今日」同月曆「今日」撳完 focus 跌去 `<body>`** → W-036 |
| content-visibility 對 scroll-to-today / sticky | ✅ | Probe（181 日、第 146 日）：152 行 `plan-far`、今日嗰行唔係；今日行貼住 sticky WEEK heading（gap −0.14 px）；每次向上 scroll 400 px，今日行都準確移 400 px（`contain-intrinsic-size: auto` + scroll anchoring，冇跳）；`.plan-week` 係 sibling，唔受 containment 影響；`rerenderPlanSchedule` 改用 anchor row，唔用 raw scrollTop ✅ |
| 主頁卡各狀態 | ✅ | active（% + bar + 下一步 + 繼續 / 查看今日）、休息日、未開始、補做下一步、全部完成、考試日、完結（總結 + 建立新計劃 / 改目標 / 進度表）、log 讀唔到提示；全部掣 44px（`hitOk`）、文字 ≥ 4.5:1 |
| S-115 | ✅ | `planCreate` 失敗 → `planGoalNotice = true` + re-render（日期跟 S-111 移到最早可揀嗰日）+ `dateMoved` 提示；改任何欄位就清走提示；create / edit 兩種 mode 都有測試；第二次撳會成功 |
| PLAN_SCREEN_IDS / planShellReady | ✅ | `screenPlanDay` 已經加入（測試 #10）；`LATE_BOOT_SCRIPTS` + `sw.js` SHELL 都有 `planDay.js`；`APP_VERSION` 唔升，符合「中間 PR 唔升版本」 |
| i18n parity + 書面語 | ✅（S-116） | en / zh-HK 各 90 個 key，`i18n-test` PASS；zh-HK 用書面語（「沒有」「可在此補做」「這日」）；en 有 count 嘅字串都用 `{one, other}`，**例外係 `plan.home.endedSummary` 嘅 `{mocks} mocks`** → S-116 |
| Token 合規 | ✅ | 新顏色全部喺 `tokens.css`（`-past` 色階、`--plan-carry`、`--plan-orange-text`、`--plan-task-todo-border`、`--plan-rest-line`、`--plan-home-track`）；SVG ring 每個部分都有明確 fill / stroke；`22px` / `19px` 係 display / emoji 字號，同現有 `.plan-cta-ic` / `.plan-stat .v` 一樣，接受 |
| 函數長度 | ✅ | `planDay.js` / `planHome.js` 每個 function 都 ≤ 20 行 |
| 效能 | ✅ | 見評分表；Day 畫面每次轉日都重畫 KPI（同一個 today），成本 < 10 ms，唔使優化 |

## Developer 自報偏離（11 項）判斷

| # | 偏離 | 判斷 |
|---|---|---|
| 1 | 月曆已過嘅格用 `-past` token，唔用 opacity | ✅ 接受：W-034 教訓，數字對比 ≥ 9:1，測試驗過冇 opacity |
| 2 | 淺灰 / 橙色加深 | ✅ 接受：橙框 3.7:1（WCAG 1.4.11 ≥ 3:1）、Day n tag 5.3:1 |
| 3 | 0 日唔顯示連續 pill | ✅ 接受：G29 |
| 4 | 拎走「連續 2 日落後」 | ✅ 接受：handoff 4.8 未定，做咗都係猜；PR7 / 之後再補 |
| 5 | 補做框排喺當日任務後面 | ✅ 接受：mockup 排頭，但 G8 定咗「唔計今日 %」，排後面先唔會令人以為係今日主要任務；上面有 alert 交代 |
| 6 | 月曆跟住睇緊嗰日嘅月份 | ✅ 接受：‹ › 轉日跨月，月曆跟住轉（probe：去到 Day 38，月曆就轉做 November）；月曆自己嘅 ‹ › 唔會改睇緊嗰日 |
| 7 | 整體進度 bar 用色階，唔係全綠 | ✅ 接受：同 ring、mini bar、主頁 bar 一致（G27 全部 bar 用同一套色階，arch §F.4） |
| 8 | 主頁卡多咗「未開始」/「log 讀唔到」 | ✅ 接受：clock 去咗 Day 1 之前 / log 壞咗都要有反應；log 壞咗嘅提示跟 PR4 review 建議 |
| 9 | 月曆格 360px 約 37px（< 44 但 ≥ 24） | ✅ 接受：實測 37.1 × 37.1 px，7 欄 grid 喺 360px 冇辦法做到 44 而唔打橫 scroll；符合 WCAG 2.5.8 AA（24px）；格之間有 gap，唔會撳錯 |
| 10 | 考試日格 9px 字 | ✅ 接受：純裝飾（`aria-hidden`，cell 自己有 aria-label「…· 考試日」），CSS 有註解寫原因；只係呢一個位低過 `--fs-2xs` |
| 11 | `.back-btn` 32px | ⚠️ 大致接受，但**實測 ≤ 380px 係 29px**（PR5 嘅 `@media (max-width: 380px)` 收細咗 padding / 字號），仲冇 hit-area 延伸；同一個 header 嘅「進度表」有 `plan-hit`（44px）→ S-117 |

## 問題清單

### 🔴 Critical

冇。

### 🟡 Warning

#### W-036 — 「← 返回今日」同月曆「今日」撳完之後，鍵盤 focus 跌去 `<body>`

- **位置**：`js/screens/planDay.js` `planShowToday()`（`#planBackToday`）；`planShiftMonth(0)`（`#planCalToday`）
- **描述**：`planShowToday` 重畫之後，`#planBackToday` 變咗 `hidden`（`iso === todayIso`）；`planShiftMonth(0)` 之後 `#planCalToday` 變咗 `disabled`（`at === todayAt`）。兩粒掣都係撳完就收埋 / disable 自己，但 `planKeepArrowFocus` 只係處理 `step !== 0` 嘅 ‹ ›。
- **證據**：Probe（375px、鍵盤 Enter）：`after back-to-today, active = BODY`；`after cal Today, active = BODY, disabled true`。
- **影響**：鍵盤 / screen reader 用家撳完之後，下一個 Tab 會由頁頂（header）重新開始，唔知自己去咗邊；‹ › 已經處理過同一個問題（PR3 / PR4 原位更新教訓），呢兩粒漏咗。
- **方案 A（推薦）**：focus 交俾一個穩定嘅目標：
  - `planShowToday` → `byId('planDayHeading').focus({ preventScroll: true })`（同撳月曆格一致）
  - `planShiftMonth(0)` → focus `#planCalTitle` 唔得（`<b>`），所以交俾 `#planCalPrev`，佢 disabled 就交俾 `#planCalNext`（重用 `planKeepArrowFocus` 嘅想法）
  - Trade-off：改幾行；行為同現有 ‹ › / 月曆格一致。
- **方案 B**：唔收埋 / 唔 disable，改用 `aria-disabled="true"` + 樣式，撳落去冇反應。Trade-off：focus 唔會跌，但 `ACTIONS` 唔識 `aria-disabled`（只會跳過 `disabled`），要另外加 guard；「返回今日」喺今日仍然見到會令人困惑。
- **測試**：`plan-day-test` 喺 #37 / #238 之後加 `document.activeElement !== document.body`。

### 🟢 Suggestion

#### S-116 — en `plan.home.endedSummary`：「1 mocks at 21/24 or more」

- **位置**：`locales/en.js` `plan.home.endedSummary`；`planEndedHtml()`
- **描述**：`{mocks} mocks` 冇 `{one, other}`；而且 `t()` 揀單複數係睇 `params.n`，而呢度 `n = REAL_TEST_SIZE`（24），所以就算改做 plural object 都唔會跟 `mocks` 揀。剛好 1 次 ≥ 21/24 就會顯示「1 mocks」（截圖 `360-en-home-ended.png` 係「0 mocks」，0 啱）。
- **方案 A（推薦）**：拆一個獨立 key `plan.home.endedMocks: { one: '{n} mock at {safe}/{total} or more', other: '{n} mocks at …' }`，用 `{ n: k.safeMocks, safe, total: REAL_TEST_SIZE }` 計好再傳入 `endedSummary` 嘅 `{mocks}`；zh-HK 跟住拆。
- **方案 B**：句子改成唔使單複數嘅講法（例如「Mocks at 21/24 or more: {mocks}」）。Trade-off：最少改動，但同其他 · 分隔嘅部分語氣唔一致。

#### S-117 — Day 畫面 header `← 主頁` 喺 ≤ 380px 得 29px 高，冇 44px hit area

- **位置**：`index.html` `#screenPlanDay .back-btn`；`css/screens/plan.css` `@media (max-width: 380px) .plan-day-header .back-btn`
- **描述**：developer 話係 32px，實測 360 / 375px 係 29px（padding `--space-3` + `--fs-sm`），elementFromPoint 中心 ±21px 都撳唔中。同一個 header 嘅「進度表」有 `plan-hit`（44px）。≥ 24px，符合 AA，所以只係 Suggestion。
- **方案 A（推薦）**：個掣加 `plan-hit` class（`::before` 延伸到 44px 高，唔影響外觀，visual-diff 0 差異）。
- **方案 B**：拎走 ≤ 380px 嗰條 rule，返去 32px。Trade-off：要再驗 360px zh-HK 冇打橫 scroll。

## ✅ 做得好嘅地方

- UI 層完全冇自己計完成度；補做用自己嗰日嘅 log，G8「唔計今日 %」有真測試
- `planWatchDay` 細細個但齊：clear-before-arm、bind 一次、本地午夜 +1 s、`PLAN_NEW_DAY_RENDER` 只重畫顯示「今日」嘅畫面（考試中唔郁）
- content-visibility 只加喺離今日 > 14 行嘅 row，今日附近一定已經 layout，所以 scroll-to-today 準；`rerenderPlanSchedule` 由 raw scrollTop 改做 anchor row，諗到估算高度嘅問題
- ‹ › 原位更新 + disabled 交 focus；月曆格開日子 → 去頂 + focus heading；`aria-current="date"`、每格 aria-label
- 對比度做足：已過嘅格用顏色唔用 opacity，測試逐個 text 驗 ≥ 4.5:1
- `plan-day-test` 覆蓋晒 §PR5 驗收（O-1 183 日、S-115 兩種 mode、G6 / G9 / G16 / G23 / G25 / G29）

## 修正優先順序

| 優先 | ID | 工作量 | 建議時間 |
|---|---|---|---|
| 1 | W-036 | 約 10 行 + 2 個 assert | QA 前 |
| 2 | S-116 | locale 2 個 key + 1 行 | 可以同 PR7 wording review 一齊做 |
| 3 | S-117 | 1 個 class | 隨時 |

Commit 格式：`fix: W-036 | …`、`fix: S-116 | …`、`fix: S-117 | …`（每個 item 一個 commit）。

## 修訂後代碼（建議）

```js
// js/screens/planDay.js — W-036: "back to today" hides itself, so focus goes to the heading (as a calendar cell does)
function planShowToday() {
  planDayView = null;
  planCalMonth = null;
  renderPlanDay();
  byId('planDayHeading').focus({ preventScroll: true });
}

// 0 = the month of today …; W-036: "Today" disables itself, so focus moves to an arrow that is still enabled
function planShiftMonth(step) {
  // … unchanged up to renderPlanCalendar(…)
  if (step) planKeepArrowFocus('planCalPrev', 'planCalNext', step);
  else if (document.activeElement === document.body || byId('planCalToday').disabled) {
    byId(byId('planCalPrev').disabled ? 'planCalNext' : 'planCalPrev').focus();
  }
}
```

```js
// locales/en.js — S-116 (zh-HK: endedMocks: '模擬考試達 {safe}/{total} 或以上 {n} 次')
endedSummary: 'Average {avg}% · {facts} / {factsTotal} facts · {qs} / {qsTotal} questions · {mocks}',
endedMocks: { one: '{n} mock at {safe}/{total} or more', other: '{n} mocks at {safe}/{total} or more' },
```

```html
<!-- index.html — S-117 -->
<button class="back-btn plan-hit" data-action="goHome" data-i18n="common.home"></button>
```

## Handoff receipt

```handoff-receipt
protocol: 1
status: pass
score: 93/100
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
context: "PR5 @ 9e54527/52fb151: run-all 36/36, visual-diff 76 identical. Domain-consistent completion/carry, G9 snapshot, G6 watcher, content-visibility, S-115 verified; 11 deviations accepted (#11 back-btn actually 29px -> S-117). New W-036 (back-to-today / calendar Today drop focus to body) - fix before QA, one commit each; S-116 (en endedSummary '1 mocks'), S-117 (day header back-btn plan-hit) optional."
```
