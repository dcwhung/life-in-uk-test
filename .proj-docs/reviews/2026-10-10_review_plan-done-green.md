# Code Review — 溫習計劃日程：已完成變綠（G43）

- **日期**：2026-10-10
- **審閱者**：Code Reviewer（獨立）
- **目標**：branch `claude/charming-hopper-48ypzp`，commit 90db717（domain helpers）/ c0018ff（feat）/ b7b7a8e（docs），diff `732d6e7...HEAD`（12 個檔案，+451 / −26）
- **Spec**：grill G43（`.proj-docs/plans/2026-10-08_grill_study-plan.md`）、`.proj-docs/plans/2026-10-10_plan-schedule-done-green.md`
- **Design Origin**：`proposal: user-approved preview 2026-10-10`；plan 有 `## Design Proposal` section 同「決定」→ origin 合法
- **結果**：✅ pass — **91 / 100**，0 Critical、1 Warning（W-049）、4 Suggestion（S-160–S-163）

## Hard Gates

| Gate | 結果 | 備注 |
|---|---|---|
| Lint | n/a | repo 冇 eslint / package.json；新 CSS 冇 raw hex（test 有守）；`js/` 新增行冇 CJK（grep 0） |
| Type check | n/a | plain JS |
| Tests | ✅ pass | `tests/run-all.sh` 45/45 PASS（EXIT 0），`plan-test` 2727 checks，新 suite `plan-done-green-test`；跑完已 `git checkout -- 'tests/*.png'`，working tree clean |
| Coverage | ✅ pass | 三個階段（空 / 提早 / 🏆 / 差一題 / G4 分日 / pending / 輕鬆日 / 冇該階段）、chapter step、今日 pill、320 / 390 en + zh-HK 都有 assert；缺口見 S-163 |
| No Critical | ✅ pass | 0 |
| Security scan | n/a | 冇新依賴；新 HTML 只插 locale 字串同常數 |

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|---|---|---|---|
| 正確性 | 20 | 25 | W-049 |
| 安全性 | 20 | 20 | |
| 可維護性 | 20 | 20 | helper 細、純函數、注釋清楚，全部函數 < 30 行 |
| 測試覆蓋 | 14 | 15 | S-163 |
| 性能 | 9 | 10 | S-160 |
| 代碼風格 / a11y | 8 | 10 | S-161、S-162 |
| **總分** | **91** | **100** | |

**結果：✅ pass**（hard gate 全 pass，≥ 90，冇 Critical；W-049 係產品定義問題，建議問用戶）

## 開發者問題嘅判斷

1. **讀 + 練按內容、跨日判斷（`planFactDoneEver` / `planQidDoneEver`）**：正確。
   - G3 / G4：知識點要同一日 log 有齊所有 canonical qid 答啱，逐日 `planFactDone(id, planDayLog(log, iso), mastered)`，同任務完成度、`planFactsDoneOn`（W-026 re-plan 用嘅）同一條規則；分兩日答唔算有 test。
   - G37：先用空 day log + mastered 判一次（全部 🏆 即完成），再逐日併 mastered（部分 🏆 + 某日答啱餘下嘅），同 `planTaskProgress` 對讀 / 練嘅 `planTaskMastered` 一致；drill / mock 唔受 🏆 影響，同 G37 一致（有 test）。
   - G40：log `ok` 由 `recordPlanAnswer` 寫 canonical key，`planFactQids` / practice `qids` / `planMasteredKeys` 全部 canonical，所以 copy 唔會重複計亦唔會漏。
   - G7 re-plan：frozen 日子嘅讀 / 練任務照計入，未完成知識點再排去新日子；因為按內容判，一條知識點喺 frozen 日或者新日答完都一樣，冇重複要求。re-plan 前嘅 log 照讀（log 跨 re-plan 保留，W-026 同一前提）。✔
2. **強化 / 模擬考 = 每日 `planDayCompletion` 100%（包括輕鬆日）**：符合 G43 ②；但「過去日子做唔返」嗰啲情況會令段永遠變唔到綠，見 W-049。
3. **冇該階段 = 永遠唔完成**：接受；`planShownPhases` 本身已唔顯示冇日子嘅段，雙重保險。
4. **模擬考段用 navy 字（preview 係白字）**：接受。白字喺 `--green-light` 上只有 2.5:1（唔過 AA），navy 6.0:1，亦同未完成時 `.plan-bg-mock { color: var(--text) }` 一致；plan「決定」已寫明。只係同 preview 有出入，建議喺 handoff 同用戶講一聲（S-162）。
5. **今日 pill 左右 padding `--space-1`**：可以接受，72px 欄一行放得落有 test（連較闊字體）；視覺上 zh-HK「今日已完成」幾乎貼住 pill 邊，見 S-161。
6. **展開時策略框標題加 hidden「(done)」**：正確。展開時 bar `aria-hidden`，策略 `h4` 係 screen reader 會讀到嘅位置；摺埋時 bar 有自己嘅 sr 文字；溫習次序展開 / stepper 都有。只得完成嗰段有（test `1,0,0`）。
7. **性能**：可以接受但有改善空間，見 S-160（實測數字）。
8. **tokens / CJK / 函數長度**：六個新 token 全部喺 `tokens.css`，`plan.css` 只用 `var()`；`js/` 冇 CJK（字串全部喺 locales，`✓` 係常數 `PLAN_DONE_MARK`）；新函數最長 ~8 行。

## 問題清單

### 🟡 W-049 — 強化 / 模擬考段可能永遠變唔到綠：錯過嘅模擬考日、re-plan 前嘅強化日都做唔返

- **位置**：`js/domain/planProgress.js` `planPhaseDone`（drill / mock 分支：`days.every(d => planDayCompletion(...).pct === PERCENT)`）
- **描述**：drill / mock 要該階段**每一日**100%，但有兩類日子過咗就冇辦法補：
  1. **模擬考日**：G8 / G10 / G23 模擬考唔 carry，`planAttributeMock` 只計當日。任何一日冇合格（或者冇做），模擬考段由嗰日起永遠唔會綠，就算之後每日都合格。
  2. **re-plan 之前嘅日子**（G7 frozen，`carryFrom` 之前）：`planCarryTasks` / `ensurePlanDay` 都唔再處理，未完成 / 未打開（pending quota）嘅強化日永遠 < 100%。用戶通常係落後先改目標，所以 re-plan 後強化段好大機會永遠唔綠。
  實測（scratchpad `bench/stuck.js`）：6 個模擬考日第一日唔合格、其餘全合格 → `planPhaseDone(mock) = false`，carry 冇嗰日，`planAttributeMock(過去日) = null`；強化 Day 4 re-plan → 3 個 frozen 強化日，carry 0 個。
- **影響**：用戶要求「階段內容 100% 完成就變綠」；呢兩個情況下用戶已經冇嘢可以做，但段永遠唔綠，冇提示點解。讀 + 練段冇呢個問題（按內容，可以喺任何一日補）。
- **方案 A**：drill / mock 只計「仲可以做」嘅日子：`carryFrom` 之前嘅日子唔計（同 carry-over 一樣當歷史）；過去未合格嘅模擬考日唔計（只計今日同之後，或者改成「過去模擬考日有合格嘅 + 今日之後全部 100%」）。Trade-off：「綠」唔再等於「每日都做齊」，要喺 G43 寫清楚；要加 test（re-plan、錯過模擬考）。
- **方案 B**：維持現狀，喺 G43 明文寫低「錯過嘅模擬考日 / re-plan 前未完成嘅強化日會令該段唔再變綠」，等用戶確認。Trade-off：唔使改 code，但 UX 有死角。
- **推薦**：問用戶揀；我傾向 A 嘅「re-plan 前日子唔計」部分（同 G7 / carry-over 一致），模擬考由用戶決定。

### 🟢 S-160 — 每次 render 逐條知識點掃晒成個 log；可以一次過計出「已完成知識點」set

- **位置**：`planFactDoneEver`（`Object.keys(log.days).some(...)`，每日再 `planDayLog` 開新 object）；`planLearnContentDone` 同 `renderPlanOrder`（4 個 step × `planChaptersDone`）各自再掃一次
- **描述**：未完成嘅知識點會走晒全部 log 日子。實測（node vm，每日 60 條答啱嘅 log，scratchpad `bench/bench.js`）：三個 `planPhaseDone` + 四個 `planChaptersDone` = **約 21 ms（60 日）/ 35–40 ms（180 日）**；原本成個日程列表 `planDayCompletion` 只係 ~1.2 ms，一次過計 done set ~3.5 ms。手機慢 4–5 倍 ≈ 100 ms+。只喺打開日程、轉語言、另一個 tab 改資料時 render，所以唔係 blocker。
- **方案 A**：`planFactsDoneEverSet(log)`：一次過逐日計已完成知識點（類似 `planFactsDoneSet` 加 mastered），`renderPlanSchedule` 計一次傳畀 `planPhaseDone` / `planChaptersDone`。Trade-off：helper signature 要加參數。
- **方案 B**：維持；喺注釋寫低成本上限。Trade-off：最簡單，長計劃喺慢機開日程會慢一拍。
- **推薦**：A（同時順手將 `planChaptersDone` 四次 STUDY filter 併埋）。

### 🟢 S-161 — 「今日已完成」/「Done today」pill 左右只得 2px，字貼邊

- **位置**：`css/screens/plan.css` `.plan-day-side .plan-pill.today-done { padding-inline: var(--space-1); }`
- **描述**：screenshot（`green-impl/zh-HK_390_today-done.png`、`en_320_today-done.png`）入面字幾乎貼住圓角邊，同其他 pill（4px）唔一致。
- **方案 A**：保留 4px，`font-size` 或 `letter-spacing` 只喺呢粒 pill 收細少少。Trade-off：字細啲。
- **方案 B**：維持 2px（一行放得落有 test 守住）。Trade-off：視覺略擠。
- **推薦**：B 都接受；如果用戶覺得擠先做 A。

### 🟢 S-162 — 模擬考完成段用 navy 字，同批准嘅 preview（白字）唔同

- **位置**：`tokens.css` `--plan-done-mock-text: var(--text)`
- **描述**：改得啱（白字 2.5:1 唔合格），plan「決定」亦有寫；但 preview 係用戶睇過批准嘅樣，最好喺 handoff 明講一聲，免得用戶以為走樣。
- **方案 A**：handoff 同用戶講（推薦）。**方案 B**：模擬考完成改用深啲嘅綠配白字（但三隻綠由深到淺嘅次序要重排，learn / drill 已用晒深綠）。
- **推薦**：A。

### 🟢 S-163 — 冇 re-plan（`carryFrom` / frozen 日子）同 view log 為 null 嘅 test

- **位置**：`tests/plan-test.js` `checkPhaseDoneLearn` / `checkPhaseDoneDrillMock`
- **描述**：讀 + 練跨 frozen 日子按內容判（G7）而家啱，但冇 test 守；W-049 決定之後亦要有 test 釘住行為。`planFactDoneEver(null, id)` / `planPhaseDone(plan, null, …)` 有 guard 但冇 assert（schedule 本身用 `planEmptyLog()` fallback）。
- **方案 A**：加一個 `replanFrom` fixture：re-plan 前答咗部分知識點、之後答餘下 → learn done；frozen 強化日未完成 → 跟 W-049 決定。**方案 B**：只加 null log 一句 assert。
- **推薦**：A。

## Design Fidelity

- Origin `proposal`：plan 有 `## Design Proposal`，改動範圍（bar 段、step 圓點、今日 pill、token）同「決定」一致，冇意外 layout 改動。
- className 冇改名（只加 `.done` / `.today-done` modifier）。
- 顏色全部 `var(--token)`；`--plan-done-learn: #1b4332` 係 token 定義本身。
- 同 preview 嘅出入：模擬考段字色（S-162）、pill padding（S-161）。

## QA（瀏覽器，`?preview=plan`）

睇咗 scratchpad `green-impl/` 嘅 36 張截圖（320 / 390 × en / zh-HK × 1–3 段完成展開 / 摺埋、溫習次序 2 步完成、今日完成），抽查：
- `en_320_phases3_folded`：三段綠由深到淺，段界清楚，「✓ Read + practise」摺兩行但冇切字；stepper 四粒綠 ✓。
- `en_390_order2_expanded`：Ch 1 + 2、Ch 5 綠 ✓，Ch 4 / Ch 3 照舊 navy 數字。
- `zh-HK_390_today-done`：「今日已完成」實心綠白字一行，同已過日子淺綠「✓ 已完成」分得開。
- `plan-done-green-test` 喺 320 / 390 en + zh-HK 驗咗冇橫向 scroll、冇 label 被切、pill 一行喺 72px 欄內；冇 page error。

## ✅ 做得好嘅地方

- 讀 + 練「按內容」直接用返 G3 / G4 / G37 嘅 `planFactDone`，冇另起一套規則；drill / mock 用 `planDayCompletion`，同日程 pill 同一個 %。
- a11y 細心：✓ `aria-hidden`、sr 文字跟 bar 喺展開 / 摺埋時邊個可讀而放、chapter 名照讀。
- 對比全部量過（11.1 / 6.4 / 6.0:1），test 有守三隻綠唔同兼由深到淺。
- 72px pill 用較闊字體驗過，唔係只靠 Chromium 預設字體。

## 修正優先順序

| 優先 | ID | 內容 |
|---|---|---|
| 1 | W-049 | 問用戶：錯過嘅模擬考日 / re-plan 前日子點計 |
| 2 | S-163 | 跟 W-049 決定加 re-plan test |
| 3 | S-160 | 一次過計 done set |
| 4 | S-162 | handoff 講模擬考字色 |
| 5 | S-161 | 視用戶意見 |

## 修訂後代碼

唔需要整段重寫；W-049 方案 A 嘅「re-plan 前日子唔計」示意：

```js
// drill / mock: every day of the phase still open to work at 100% (G7: days before the last re-plan are history)
function planPhaseDone(plan, log, phase) {
  const days = plan.days.filter(d => d.phase === phase && !(plan.carryFrom && d.date < plan.carryFrom));
  if (!days.length) return false;
  if (phase === PLAN_PHASE.learn) return planLearnContentDone(plan.days.filter(d => d.phase === phase), log); // learn: all content, frozen days too
  return days.every(d => planDayCompletion(d, planDayLog(log, d.date)).pct === PERCENT);
}
```

## Handoff receipt

```handoff-receipt
protocol: 1
status: pass
score: 91/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
next_action: merge_develop
next_agent: null
branch: "claude/charming-hopper-48ypzp"
context: "G43 done-green pass 91, 0 Critical; W-049 (drill/mock can never turn green after a missed mock day or a re-plan over unfinished drill days) needs a user decision; S-160 to S-163 optional"
```

---

# Re-review + QA — 2026-10-10

- **目標**：follow-up commit 7de3447（`fix(plan): drill / mock done count only days still doable; done sets once per render (W-049, S-160, S-161, S-163)`），7 個檔案 +157 / −33
- **用戶決定（W-049，2026-10-10）**：「只計做得到嘅日子」— 改目標前凍結嘅日子唔計入強化 / 模擬考；過去唔合格 / 冇做嘅模擬考日唔擋住；模擬考段 = 計得嘅日子模擬考以外嘅任務完成 **而且** 最近一次模擬考合格
- **結果**：✅ pass — **98 / 100**，0 Critical、0 Warning；W-049、S-160、S-161、S-163 已解決；S-162 只係通知用戶（照舊）；新 S-164

## Hard Gates

| Gate | 結果 | 備注 |
|---|---|---|
| Lint | n/a | 冇 eslint；`js/` 新增行冇 CJK；`plan.css` 冇 raw hex |
| Type check | n/a | plain JS |
| Tests | ✅ pass | `tests/run-all.sh` 45/45 PASS（EXIT 0），`plan-test` 2743 checks（+16）；跑完 `git checkout -- 'tests/*.png'`，tree clean |
| Coverage | ✅ pass | W-049 每條規則、re-plan、null log、done set 傳入都有 assert |
| No Critical | ✅ pass | 0 |
| Security scan | n/a | 冇新依賴 |

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|---|---|---|---|
| 正確性 | 25 | 25 | W-049 已按用戶決定實現 |
| 安全性 | 20 | 20 | |
| 可維護性 | 19 | 20 | S-164 |
| 測試覆蓋 | 15 | 15 | S-163 已補 |
| 性能 | 10 | 10 | S-160 已解決 |
| 代碼風格 / a11y | 9 | 10 | S-162（照舊，只係通知） |
| **總分** | **98** | **100** | |

**結果：✅ pass**

## 逐項核對

- **W-049 ✅**
  - `planCountableDays`：`carryFrom` 當日或之後嘅日子；冇 re-plan = 全部。強化 = 每個計得嘅日子 `planDayCompletion` 100%；補做（carry-over）計返嗰日，凍結日子本身亦唔會入 carry，兩邊一致。
  - `planMockPhaseDone`：所有模擬考階段日子嘅 attempt 按日子 + 次序攞最後一次，`planMockPassed`（G10 ≥ 18/24）；而且每個計得嘅日子 `planMockDayRestDone`（清錯題未打開 total 0 = 唔計重量 G24；已填就要清晒；輕鬆日錯題知識點要做）。最近一次唔合格 → 未完成；一次都未考 → 未完成；當日唔合格再合格 → 完成。全部有 test。
  - 讀 + 練不變（按內容，凍結日子嘅內容都計）。
  - 注意：模擬考日之後嘅日子未到（清錯題未填 = 0 重量），所以有輕鬆日嘅計劃要等輕鬆日打開錯題知識點先會變綠；之後如果再考唔合格會變返唔綠 —— 符合「最近一次合格」嘅定義，plan doc 有寫。
- **開發者自己嘅選擇：一個階段全部日子都喺 `carryFrom` 之前 → 全部照計**：接受。實測 re-plan 喺模擬考階段、冇知識點剩，`buildPlanDays` 仍然會排 3–16 個新強化日（考試日 10-01 / 10-10 / 10-20），所以「全部凍結」只會喺離考試好近先出現；嗰時照顯示當時做成點係合理嘅歷史，亦唔會「冇日子 = 完成」咁誤導。代價係嗰個罕見情況下段可能唔再變綠，plan doc 已寫明。
- **S-160 ✅**：`planDoneSets(log)` 一次過計，`renderPlanSchedule` 傳畀三個階段同四個 step。實測（同之前一樣嘅 log）：**1.7 ms（60 日）/ 3.8 ms（180 日）**，之前 21 / 35–40 ms。同舊定義等價：200 個隨機 log × 236 條知識點 0 個唔同；所有知識點都可以經 `FACT_BY_QKEY` 由佢自己嘅 canonical qid 搵到（0 條搵唔到、0 條 qid 屬另一條知識點）。依賴見 S-164。
- **S-161 ✅**：`html[lang="en"]` 先用 2px；zh-HK 用返 4px，test 驗咗 zh 4px = 已過日子 pill、en 2px；QA 320px「今日已完成」一行放得落。
- **S-163 ✅**：`checkPhaseDoneMockLatest`、`checkPhaseDoneReplan`（第 4 個強化日 re-plan，3 個凍結未完成；同一批日子冇 `carryFrom` → 未完成；讀 + 練 re-plan 前後各答一半 → 完成）、`checkPhaseDoneNullLog`、`checkDoneSetsPassedIn`。
- 函數長度全部 < 15 行；CJK / token 照舊乾淨。

## 新問題

### 🟢 S-164 — `planDoneSets` 靠「每條題目只屬一條知識點」，冇 test 守

- **位置**：`js/domain/planProgress.js` `planDoneSets` 嘅 `check`（`FACT_BY_QKEY[k]`，`similar.js` 後寫嘅蓋前面）
- **描述**：只會檢查 log key 透過 `FACT_BY_QKEY` 指向嘅知識點。而家數據冇一條題目屬兩條知識點（已驗），所以結果同舊逐條知識點計法一樣；但將來內容改動如果有一條題目放咗喺兩條知識點，其中一條就可能永遠唔算完成（`planFactsDoneOn` re-plan 亦有同一個假設）。
- **方案 A（推薦）**：`content-guard-test` 或 `plan-test` 加一句：每條知識點最少有一個 canonical qid 嘅 `FACT_BY_QKEY` 指返自己（或者每個 src key 只屬一條知識點）。Trade-off：一行 test，唔改 app code。
- **方案 B**：`check` 改成用 qid → 所有知識點嘅 map。Trade-off：多一個 lookup table，舊 `planFactsDoneOn` 都要跟住改先一致。

## QA（我自己跑，`?preview=plan`，Chromium）

腳本：scratchpad `qa2/qa.js`。計劃 2026-09-01 開始、考試 2026-10-20、每日 1 小時；讀 + 練全部答啱；**第 4 個強化日（2026-09-22）re-plan**，3 個凍結強化日唔做，之後嘅強化日全部 100%；模擬考第一日**唔合格**；時鐘設喺輕鬆日（Day 49，2026-10-19），今日任務完成。

| 情況 | 讀 + 練 | 強化 | 模擬考 | 溫習次序 | 今日 pill |
|---|---|---|---|---|---|
| 第一次唔合格、之後合格，但**最後一次唔合格** | ✓ 綠 | ✓ 綠（凍結日子唔擋） | 未綠（橙） | 4 粒 ✓ | Done today / 今日已完成 |
| 第一次唔合格、**之後合格**（最後一次合格） | ✓ 綠 | ✓ 綠 | ✓ 淺綠 navy 字 | 4 粒 ✓ | Done today / 今日已完成 |

- 390 / 320 × en / zh-HK × 展開 / 摺埋（16 個組合）：`scrollWidth = clientWidth`（冇橫向 scroll），bar / stepper / 日期欄 pill 冇字被切，0 page error。
- 截圖：`qa2/latestFail_en_320_fold.png`（模擬考段未綠）、`qa2/passed_zh-HK_320_fold.png`（三隻綠由深到淺）、`qa2/passed_today.png`（320px「今日已完成」4px 一行喺 72px 欄內，同已過日子淺綠「✓ 已完成」分得開）。

## Handoff receipt（re-review）

```handoff-receipt
protocol: 1
status: pass
score: 98/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
next_action: merge_develop
next_agent: null
branch: "claude/charming-hopper-48ypzp"
context: "G43 re-review of 7de3447 pass 98: W-049 (user rule: only doable days; latest mock pass), S-160 (1.7 ms/render), S-161, S-163 resolved; own browser QA (re-plan mid-drill + failed-then-passed mock) 390/320 en+zh-HK OK; new S-164 optional (one-fact-per-question guard test); S-162 just tell the user"
```
