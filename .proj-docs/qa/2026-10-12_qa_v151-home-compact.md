# QA — 2026-10-12 — v1.5.1 主頁溫習計劃卡減少留白（環入標題列）

- **日期**：2026-10-12
- **測試員**：QA agent
- **範圍**：branch `claude/inspiring-thompson-jy2f4o` @ **`af11eeb`**（app 改動 = `git diff 826b3ed..7a569c4`；`af11eeb` 只加 review 報告）。app 改動：`js/screens/planHome.js`（`planHomeTodayPct`、`planHomeTopHtml` 出 `.plan-home-head`、刪 `planHomePctHtml`、完成文字 `plan.home.seeTomorrow`）、`css/screens/plan.css`（`.plan-home.has-ring` gap、`.plan-home-head` / `-head-txt`、`Day n / N` `nowrap`、刪 `.plan-home-today*`）、`css/base/tokens.css`（`--plan-home-ring-size` 64 → 56px）、`locales/en.js` / `zh-HK.js`（`doneHtml` → `seeTomorrow`）、`js/core/config.js`（1.5.1）；test：`tests/plan-day-test.js`、`tests/dup-test.js`
- **Design Origin**：`mockups/plan-home-ring-compact.html` variant C；baseline `.proj-docs/design-baselines/2026-10-12_plan-home-compact-390.png`
- **Review 前置**：`.proj-docs/reviews/2026-10-12_review_v151.md` pass 94（0 C / 0 W / S-231–S-236）
- **環境**：Linux，Node + playwright-core（`NODE_PATH=/opt/node-tools/node_modules`），Chromium headless（`/opt/pw-browsers`），`file://…/index.html`，`page.clock` 固定時間 / install（午夜）；每個組合全新 context，seed `lifeuk.uiLang` / `lifeuk.fontSize` + `buildPlan` / `writeStudyPlan` / `writePlanLog`（同 v1.5.0 QA script）。v1.5.0 對照 = `git archive 826b3ed` 匯出到 scratch dir（冇改 repo / worktree）。冇真機
- **總結**：✅ **PASS**。Browser script **39 / 39**：7 個狀態 × en / zh-HK × 320 / 390 / 1100 × 細 / 大字 = **84 / 84** 組合全過；真 click 22 / 22；新 edge case 11 組全過；卡高對比 v1.5.0：有環狀態大字全部矮咗（390 zh-HK 大字：0% 219 → 194、進行中 219 → 194、100% 216 → 173），冇環狀態高度不變。`run-all.sh` 第 1 次 53 / 54（`upgrade-test` = 已知 flake，單獨重跑 4 / 5 PASS），第 2 次 **54 / 54**。🔴 0、🟡 0，冇 ticket

## Hard Gates

| Gate | 結果 | 證據 |
|------|------|------|
| Tests | ✅ pass | `run-all.sh` 第 1 次 53 / 54（`upgrade-test` FAIL「next full load: every legacy streak…」），單獨重跑 ×5：4 PASS、1 FAIL（另一條 assertion「old shell, locale missing: exactly one reload」）→ brief 列明嘅已知 flake，同今次 render 改動無關；第 2 次 run-all 54 / 54 PASS。之後 `git checkout -- 'tests/*.png'`，`git status` 冇 png 改動 |
| Coverage | ✅ pass | 冇 coverage 工具；`plan-day-test` `checkHomeCard` / `checkRingTextFits` / `checkAllDone` + QA 84 組合 matrix + 11 組 edge case（§4），補咗 review S-231（nowrap）/ S-232（對角線 + ✓）嘅盲點 |
| Security | ✅ pass（N/A） | 環 / 卡內容只係數字 + locale 字串，冇用戶輸入入 `innerHTML` / `aria-label` |
| Data integrity | ✅ pass（N/A） | 冇改 storage / plan 計算；只改 render；`planHomeTodayPct` 同 v1.5.0 `planDayCompletion(...).pct` 同一值（matrix label / offset 一致） |
| Performance | ✅ pass（N/A） | 一個 56px inline SVG；DOM 少咗一層 |
| No Critical | ✅ pass | 🔴 0 |

## 1. Regression suite

| 檢查 | 結果 |
|---|---|
| `NODE_PATH=… ./tests/run-all.sh` @ af11eeb（第 1 次） | 53 / 54；`upgrade-test` FAIL |
| `upgrade-test` 單獨重跑 ×5 | 4 PASS / 1 FAIL（每次 fail 嘅 assertion 唔同，都係 SW reload 計時）→ 已知 flake（v1.5.1 review「觀察」同 brief 都有記） |
| `run-all.sh`（第 2 次） | ✅ 54 / 54 PASS |
| `plan-day-test` / `dup-test` / `plan-run-test` / `i18n-test` | ✅ 兩次都 PASS |
| `git checkout -- 'tests/*.png'` 後 `git status` | ✅ 冇 png 改動 |

## 2. Browser matrix（真 Chromium）

Script：`.proj-docs/qa/scripts/2026-10-12_qa-v151-home-compact-browser.js`（由 v1.5.0 script 改；參數 1 = 截圖 dir（唔畀就寫 `screenshots/v151`，~60 張，建議畀 scratch dir），參數 2 = `826b3ed` 匯出 dir，做 §5 卡高對比）。

狀態 seed（同 v1.5.0：plan 2026-09-28 開始、考試 29/10、每日 120 分鐘、星期日休息）：0% = Day 2 有一題錯題要清；mid = Day 4 **39%**（h1）；100% = Day 1–4 全對；休息日 = Day 7（4/10 星期日）；考試日 29/10；已完結 30/10；未開始 26/9。

每個組合 assert：

| 項目 | 結果 |
|---|---|
| `<html lang>` / `data-font-size` 跟 seed；0 page error | ✅ 84 / 84 |
| 冇橫向 scroll（`scrollWidth ≤ clientWidth`）、卡內文字冇出界、冇 raw key | ✅ 84 / 84 |
| 環只喺 0% / mid / 100%；嗰三個狀態卡有 `.has-ring`、grid gap **10px**、頂部係 `.plan-home-head`（冇 `.plan-home-top`）、環係 `.plan-home-head` 直屬 child | ✅ |
| 休息日 / 考試日 / 已完結 / 未開始：冇環、冇 `.has-ring`、gap **12px**、照用 `.plan-home-top`；休息日有「Rest day today / 今日是休息日」 | ✅ |
| 環 **56 × 56px**；左邊 = 標題 / 倒數最右之後（冇重疊）；右邊 = 卡 content 右邊（±1px）；**垂直置中**（環中心 vs head 中心 vs 文字欄中心 ≤ 1px） | ✅ |
| 冇可見「Today's progress / 今日完成度」（只喺環 `aria-label`）；冇舊 `.plan-home-today*` markup | ✅ |
| 下一步 `.plan-home-next` **成行**（左右 = 卡 content 邊 ±1px），喺環底之下 | ✅ |
| head 入面「Day n / N」只得一個 line box（`Range.getClientRects`）；320 en 大字三個有環狀態成段落第二行（見 §4 C1） | ✅ |
| 環 `role="img"`、`aria-label` =「Today's progress 39%」/「今日完成度 39%」、唔係 tab stop | ✅ |
| G27 band class、`stroke-dashoffset` = 100 − n、0% arc `visibility: hidden` | ✅ |
| 環中間字：0% →「0%」、39% →「39%」、100% →「✓」+ `.done`；fill 白；`getBBox` **對角線** ≤ 內徑 49 units（最大 44.5 =「39%」大字），水平置中 | ✅ |
| 100%：下一步文字 = **「See you tomorrow」/「明日再來」**，成張卡 `textContent` 得 **一個 ✓**（喺環）；金掣「View today's tasks / 查看今日任務」 | ✅ |
| 未完成：唔會出「See you tomorrow」；金掣「Continue → / 繼續 →」 | ✅ |
| `.plan-home-acts` `flex-end`，最後一粒掣右邊 = 卡 content 右邊（±1px），7 個狀態都係 | ✅ 84 / 84 |
| 掣高 ≥ 44px、掣字冇截 | ✅ |
| 卡內所有文字 vs 合成背景 ≥ 4.5:1；環中間字 fill vs 卡底 ≥ 4.5:1 | ✅ |

環內字實際屏幕大小（`font-size × 56/64`）：「39%」細字 **13.1px** / 大字 **14.9px**；✓ 19.3 / 21px（同 review S-233 計法一致）。

**Design baseline**：`card-mid-zh-HK-390-large.png` 358 × 194 = baseline（716 × 388 @2x）同尺寸；縮放後逐 pixel 比，平均差 5 / 255、> 40 嘅 pixel 3.9%（縮放 anti-alias）→ layout 一致（標題 + 倒數左、39% 環右置中、下一步成行、掣靠右）。

截圖（`screenshots/v151/`）：`card-mid-zh-HK-390-large`、`card-full-zh-HK-390-large`、`card-zero-en-390-large`、`card-mid-en-320-large`、`card-full-zh-HK-320-large`、`card-mid-zh-HK-390-small`、`card-rest-zh-HK-390-large`、`card-exam-en-390-large`、`card-ended-en-390-large`、`card-notStarted-zh-HK-390-large`、`card-mid-en-1100-small`、`compare-v150-*` / `compare-v151-*`（mid / full，zh-HK 390 大字）、`edge-full-carry-zh-HK-390-large`、`edge-nowrap-en-320-large`、`edge-midnight-C7` / `-C8`、`tap-continue-en`、`heights.json`。

## 3. 真 click 路徑（en + zh-HK，各 11）

| # | Given / When / Then | 結果 |
|---|---|---|
| B1 | mid、390 大字 / 撳「Continue →」/ 入 `screenPlanRun`，開 `planNextStep` 嘅下一個 task | ✅ ×2 |
| B1b | runner 返主頁 / — / 卡重畫，環仍喺 head | ✅ ×2 |
| B2 | 主頁 / 撳 Schedule / 進度表 | ✅ ×2 |
| B3 | 100% / 撳「View today's tasks」/ 今日任務 | ✅ ×2 |
| B4 | 考試日 / 撳「View today」/ 今日任務 | ✅ ×2 |
| B5 | 已完結 / 撳 New plan、Change goal、Schedule / 目標、目標、進度表 | ✅ ×6 |
| B6 | 未開始 / 撳 Schedule / 進度表 | ✅ ×2 |
| B7 | 休息日（Day 4 未做完）/ 撳「Continue →」/ 入補做 runner | ✅ ×2 |

## 4. QA 補嘅 edge case（11 組，全部係新 / 針對 v1.5.1）

| # | Given / When / Then | 結果 |
|---|---|---|
| C1 | 320 en 大字 mid / render /「Day 4 / 31」`white-space: nowrap`、一個 line box、落咗第二行、右邊 < 環左邊。對照：臨時改 `normal` → 斷成 2 行（證明 nowrap 有作用；補 review S-231） | ✅ |
| C2 | 1 / 49 / 50 / 74 / 75 / 88 / 99 / 100 × en / zh-HK × 細 / 大字 / `planHomeRingHtml` 入 `.plan-home-head` / `getBBox` 對角線全部 ≤ 49（最大 44.5），環 56px（補 review S-232：✓ 亦有驗） | ✅ |
| C3 | 同上 / band / h1 / h1 / h2 / h2 / h3 / h3 / h3 / h4，只有 100 出 ✓ | ✅ |
| C4 | 今日 100% + Day 3 補做未完（en / zh-HK，390 大字）/ render / 環 ✓、卡內只一個 ✓、下一步「補做 Day 3」、金掣「Continue → / 繼續 →」、**冇**「See you tomorrow / 明日再來」 | ✅ ×2 |
| C4b | 同上 / 撳金掣 / 開 Day 3 補做 runner | ✅ ×2 |
| C5 | log 壞咗（`{bad`）/ render / 環喺 head、「↺ Reset」提示、layout 檢查全過 | ✅ |
| C6 | 1/10 23:59:50 開住 app（Day 4 39%）/ 過午夜 / 卡變 Day 5，環重畫，offset 一致，layout 全過 | ✅ |
| C7 | 1/10 23:59:50，Day 1–4 全完成（✓ +「See you tomorrow」）/ 過午夜 / Day 5：✓ 同「See you tomorrow」消失，環顯示 %，金掣「Continue →」 | ✅ |
| C8 | 3/10（星期六）23:59:50 有環 / 過午夜到休息日 / 環同 `.has-ring` 消失，`.plan-home-top` 返嚟，gap 12px，「Rest day today」 | ✅ |
| C9 | 28/10（最後一日）23:59:50 / 過午夜到考試日 / 環消失、`.plan-home-top` | ✅ |
| C10 | 320 en 細字 mid / 即時 `setFontSize('large')`、再 `setLang('zh-HK')`（唔 reload）/ 每一步 layout 檢查全過（56px、置中、nowrap、冇出界），label 變「今日完成度」 | ✅ |
| C11 | 鍵盤 / 由金掣 Shift+Tab、Tab / 離開張卡（環唔係 stop）、去 Schedule | ✅ |

## 5. 卡高 v1.5.0 → v1.5.1（390px，`.plan-home` 高度，px）

| | 0% | 進行中 39% | 100% | 休息日 | 考試日 | 已完結 | 未開始 |
|---|---|---|---|---|---|---|---|
| **zh-HK 大字**（brief 指定） | 219 → 194（−25） | 219 → 194（−25） | 216 → 173（−43） | 225（0） | 144（0） | 165（0） | 173（0） |
| en 大字 | 214 → 194（−20） | 214 → 194（−20） | 213 → 173（−40） | 220（0） | 141（0） | 234（0） | 170（0） |
| en 細字 | 209 → 170（−39） | 209 → 188（−21） | 209 → 170（−39） | 208（0） | 137（0） | 174（0） | 163（0） |
| zh-HK 細字 | 184 → 170（−14） | **184 → 188（+4）** | 184 → 170（−14） | 185（0） | 138（0） | 156（0） | 138（0） |

- 大字（預設、mockup scope）有環狀態全部矮咗 20–43px；HANDOFF 寫「390 zh-HK 大字 218 → 194」，QA 量 219 → 194（v1.5.0 seed 嘅 next 字 1px 差），結論一致。
- 冇環狀態完全唔變（D2）。

## 6. 觀察（唔係 bug，冇 ticket）

1. **zh-HK 細字進行中卡高 +4px**（184 → 188）：v1.5.0 下一步係喺 64px 環旁邊兩行；v1.5.1 標題列被 56px 環撐高（標題 + 倒數本身得 ~47px），下一步成行但「（由 #38 繼續）」仍然 wrap 出第二行，所以「刪 label + gap 細 2px」嘅慳位唔夠抵消 head 由一行字變 56px。只喺細字 + 下一步啱啱兩行時出現；大字（預設）同其他組合全部矮咗；屬 variant C 設計取捨，mockup 只比大字。如果用戶在意細字，可考慮細字環 48px —— 產品決定，唔開 ticket（`card-mid-zh-HK-390-small.png`）。
2. **學習日冇錯題時環一開始 1%**（G9，v1.5.0 QA 已記；C7 跨午夜到 Day 5 見到 1%）—— pre-existing。
3. 休息日卡（`.plan-home-top`，冇 nowrap）en 390 細字倒數會落第二行（`edge-midnight-C8.png`），同 v1.5.0 一樣、高度不變；冇環狀態唔喺今次 scope。
4. 1100px：環喺最右、標題喺最左，中間空位大（`card-mid-en-1100-small.png`）；功能 OK，baseline 只定義 390。
5. `upgrade-test` flake 今次兩條唔同 assertion 都見過（SW reload 計時），同 review 觀察一致；建議日後另外處理（唔屬今次範圍）。
6. **建議補測（QA 唔 commit test，交 developer 跟進，nice-to-have）**：① review S-231 —— `checkHomeCard` 加 320 大字 `Range.getClientRects()` 驗「Day n / N」一個 line box（本 script C1 做法可照搬）；② S-232 —— `checkRingTextFits` 改 `Math.hypot(w, h) ≤ 49` 並加 ✓；③ 午夜 rollover 有環 → 休息日（C8）嘅 class / gap 切換。

## 7. 問題修正優先順序

冇 finding。

## 8. 下一步

- 可以 merge 去 main（v1.5.1）
- §6.6 補測屬 nice-to-have，唔阻 release；§6.1 交用戶睇需唔需要處理細字

## Handoff receipt

```handoff-receipt
protocol: 2
status: pass
hard_gates:
  tests: pass
  coverage: pass
  security: pass
  data_integrity: pass
  performance: n/a
  no_critical: pass
next_action: merge_main
next_agent: main
branch: "claude/inspiring-thompson-jy2f4o"
head: "af11eeb"
tickets: []
context: "v1.5.1 compact Home plan card QA. Browser 39/39: 7 states x en/zh-HK x 320/390/1100 x small/large = 84/84 (56px ring in .plan-home-head right of title+countdown, vertically centred, at content edge; .has-ring gap 10px vs 12px; no visible Today's progress; next step full width below; Day n/N one line box; 100%: See you tomorrow/明日再來 + exactly one ✓; no-ring states keep .plan-home-top; acts right-aligned, 44px; no h-scroll/overflow/raw keys; contrast >= 4.5:1; ring text diagonal <= 49); real taps 22/22; 11 edge groups (nowrap 320, diagonal fit incl ✓, 100%+carry-over, broken log, 4 midnight rollovers incl to rest/exam day, live font/lang switch, keyboard). Heights 390 zh-HK large: 219->194 / 219->194 / 216->173; no-ring unchanged. run-all 53/54 (upgrade-test known flake, reruns 4/5) then 54/54; pngs restored. Observation: zh-HK small in-progress card +4px (184->188), design trade-off, no ticket."
blockers: []
```
