# Code Review：溫習計劃 PR3 開關 + 訂立目標（PR #61，T-314–T-318）

- 日期：2026-10-08
- 審閱者：Code Reviewer（subagent）
- 目標：`claude/charming-hopper-48ypzp` @ `5c55085`，`git diff origin/main...HEAD`（20 個 file，+847 / −4）
- Design Origin：`mockup:mockups/study-plan-flow.html`（⓪ 狀態 A、ⓘ「功能」switch、① 訂立目標），PR description 第一行有，路徑存在
- 對照：plan §PR3 驗收；arch §F；grill G13 / G15 / G20 / G21 / G27 / G28 / G31；handoff §2.1 / §2.2 / §3.1；HANDOFF.md 規則；`sw-coding-style-css`。ID 接續 W-030 / S-108
- 總評：入口收埋時真係 0 改動（visual-diff 76 個狀態全同、啟動唔寫 key），preview 處理乾淨，component 重用到位，CSS token 合規，zh-HK 書面語質素好，截圖同 mockup 一致。不過有 **3 個 Warning**：(1) 喺**任何畫面**關 switch 都會 `leaveToHome()`，正在做嘅 Exam / Study 會被丟棄（G15 只講計劃畫面）；(2) switch 撳「開」會關埋 ⓘ popover，focus 跌落 `body`；(3) 用鍵盤喺 date input 打日期會被 re-render 覆蓋，打唔到。另有 3 個 Suggestion。**82 / 100，warn**

## Hard Gates

| Gate | 結果 | 備注 |
|---|---|---|
| Lint | n/a | 項目冇 linter；`structure-test`（function ≤ 30 行、冇 inline handler、css 冇 hex、`var(--x)` 有定義、data-action 對 ACTIONS）PASS |
| Type check | n/a | 冇 TypeScript |
| Tests | pass | Reviewer 重跑 `run-all.sh`：**34 / 34 PASS**（`plan-test` 2646 checks、新 `plan-ui-test` PASS、`i18n-test` / `lang-switch-test` PASS） |
| Coverage | n/a | 冇 coverage tool；人手核對：驗收大部份有 case，W-031 / W-032 / W-033 嘅路徑冇 case |
| No Critical | pass | 0 Critical |
| Security scan | n/a | 冇新增依賴 |
| （附加）visual-diff | pass | `node tests/tools/visual-diff.js origin/main` → `VISUAL IDENTICAL (vs origin/main, 76 states)`；跑完已 `git checkout -- 'tests/*.png'`、刪 `shot-similar.png`，working tree clean |

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 14 | 25 | W-031、W-033、S-111 |
| 安全性 | 20 | 20 | 全部 `t()` 值來自 locale；`switchHtml` aria-label 有 escape；preview param 只認兩個值 |
| 可維護性 | 19 | 20 | S-110（驗收項 O-1 未完全做到，要寫明移去 PR4） |
| 測試覆蓋 | 15 | 15 | 97 項 + lang-switch；漏咗嘅 case 隨各 item 補 |
| 性能 | 10 | 10 | 每次輸入 re-render 成個表單，但只係幾十粒掣，冇問題 |
| 代碼風格（含 a11y） | 4 | 10 | W-032、S-109 |
| **總分** | **82** | **100** | |

**結果：⚠️ warn**

---

## 重點核對

| 項目 | 結果 | 證據 |
|---|---|---|
| 收埋狀態 0 改動 | ✅ | visual-diff 76 states identical；`#infoPlanRow` / `#screenPlanGoal` 靜態 markup 有 `hidden` / 非 active，`#planCard` 只喺 `planVisible()` 先 create；`isPlanPreviewOn()` 只讀；`plan-ui-test` checkHidden 驗冇 key |
| Preview（G31） | ✅ | 只認 `plan` / `off`，其他值唔郁；`replaceState` 保留其他 param 同 hash（有 test）；`STUDY_PLAN_PREVIEW_LS` 唔喺 `lifeuk.studyPlan*` 計劃 key 清除範圍內（`clearStudyPlan` 唔會清 preview，啱） |
| 偏離：`lifeuk.studyPlanPreview` vs arch §F.3「唔留後門」 | ✅ 接受 | G31 係用戶較後決定，覆蓋 arch；PR7 決定去留已寫喺 G31 |
| 偏離：5 級色 / 階段色 token 延後 | ✅ 接受 | `sw-coding-style-css` §4 禁 dead variable；PR3 冇消費者。PR4 / PR5 驗收要記得加（G27） |
| 偏離：ⓘ 行喺 toggleInfo 時 render | ✅ 接受 | popover 開住時撳語言 pill 會先關 popover（outside click），下次開會重 render，所以唔會見到舊語言（已 probe） |
| 偏離：有計劃時簡化卡 | ✅ 接受 | PR5 先有完整卡；但見 S-110 |
| 偏離：少過 7 日收埋「照樣建立」句 | ✅ 接受 | CTA disabled 時句子自相矛盾，收埋合理 |
| Component 重用（handoff §3.1） | ✅ | `.quiz-header` + `.back-btn` + `.quiz-label`、`.chip-row` / `.chip.active`、`.mode-card.selected` + `.mode-icon` / `.mode-title`、`.nav-btn`、`showConfirm({ focusCancel: true })`；冇複製 markup |
| CSS token | ✅ | 顏色全部 `var(--*)`；新 `--switch-track-inverse` 有消費；spacing 喺刻度內全用 `--space-*`；刻度外 3 / 7px、font-size 20 / 22px 跟 HANDOFF v0.72 規則（刻度外 literal、font-size 唔計）同現有 `results.css` / `flagged.css` 先例 |
| Inline style | ✅ | 只有 `#planFeasMeter` 用 JS `style.width`，同 `#progressFill` 做法一樣（arch §F.4 指定）；index.html 冇 `style=` |
| `[hidden]` / data-action / js 冇 CJK | ✅ | `setShown` / `hidden`；全部掣 `data-action`、input `data-input-action`；`i18n-test` PASS |
| SW SHELL / LATE_BOOT | ✅ | SHELL 加 5 個 path；`LATE_BOOT_SCRIPTS` 加 switch → planHome → planGoal（`ready()` 判斷）；`LATE_BOOT_STYLES` 加 2 個 css |
| 函數長度 | ✅ | 全部 ≤ 30 行（最長 `renderPlanFeasibility` 13 行）；`structure-test` PASS |
| Date min / max / 時區 | ✅（見 W-033、S-111） | `planTodayIso()` 用本地日期，ISO 運算用 UTC day number，冇 DST 漂移；min = today + 7、max = today + 6 個月（月尾 clamp），超過 max clamp、早過 min 忽略 |
| a11y | ⚠️ | switch `role="switch"` + `aria-checked` + `aria-label`（包含可見文字 "Study plan"，符合 2.5.3）+ `aria-describedby` 狀態句、`::before` 44px、`:focus-visible`、reduced-motion ✅；chip / mode-card `aria-pressed` ✅；group `aria-labelledby` ✅；slider `aria-valuetext` ✅；但 redraw 丟 focus（W-032、S-109） |
| 360px 橫 scroll | ✅ | probe：zh-HK 360px goal screen `scrollWidth 360 = clientWidth`；test 3 寬 × 2 語言 |
| zh-HK 書面語（G21） | ✅ | 冇口語字；數字前後空格、全形標點；用字對齊（模擬考試、溫習、確定）。「一個半月」（handoff「個半月」改書面語）好 |
| en 字眼（G20） | ✅（小建議） | 整體自然。可再考慮：`minsLabel` "Most time you can study a day" → "Most time you can study each day"；`orDate` "or exam date" → "or pick a date"。留俾 G20 對照表一次過畀用戶睇，唔開 ID |

### Coordinator 追加核實：switch 關閉 modal 係咪出喺 popover 後面

- 結論：**唔係 bug，係截圖時機**，唔開 ID。
- 證據：用真 browser 重現（375px，ⓘ → 等 600ms → 撳 switch → 等 1500ms 先截圖，`scratchpad/probe/modal-after-1500.png`）：modal 完整喺最上層，標題、內文、兩粒掣清楚，popover 喺 backdrop 下面變暗。`elementFromPoint`（標題中間）= `#confirmTitle`。Computed：`#infoPop` 係 `<header>`（sticky，`z-index: 100`，自成 stacking context）入面 `z-index: 200`，實際層級等同 100；`#confirmModal` fixed `z-index: 300`、opacity 1。
- 原本截圖（`375-*-0-switch-off-modal.png`）影喺 `.modal-backdrop.show` 嘅 `slideIn` 動畫（0.18s，opacity 0 → 1）期間，所以 modal 半透明、popover 好似蓋住佢。
- 附註：modal 關閉（Cancel）之後 popover 仲開住，屬現有設計；OK 之後 popover 由 outside click 收埋。

### 用戶要求改動（唔係缺陷，冇 ID；同 W 一齊做）

- **U-1**：en `plan.goal.preset6w` `'6 weeks'` → `'1.5 months'`（`locales/en.js:233`）。zh-HK「一個半月」已經一致，唔使改。
- 要同步改：`tests/plan-ui-test.js:122` 預期 chip 文字 `'6 weeks'` → `'1.5 months'`；`:141` assertion 描述 `'preset 6 weeks → 42 days'` 建議改 `'preset 1.5 months → 42 days'`。Key 名 `preset6w` 可保留（值仍然 = 42 日），或者改 `preset42d`，developer 揀（改名要同改 `PLAN_PRESET_LABEL_KEYS` 同兩個 locale）。
- Commit 建議：`fix: U-1 | en 6-week preset reads 1.5 months`（或者按團隊慣例用 `chore:`）。

---

## 問題清單

### 🟡 W-031 — 喺任何畫面關 switch 都會返主頁，正在做嘅 Exam / Study 被丟棄

- 位置：`js/screens/planHome.js` `togglePlanFeature()`：`onOk: () => { setPlanFeature(false); leaveToHome(); }`
- 描述：ⓘ 喺每個畫面都撳得到。G15 只話「喺計劃畫面 / runner 關開關 → 返主頁」，但而家無條件 `leaveToHome()`（`stopExamTimer()` + `clearSideSession()` + `showScreen('screenHome')`）。
- 重現（probe）：preview 開 → `startExam(3)`（Exam mode，計時中）→ ⓘ → 關 switch → OK → `screenHome`，個 exam 冇經 Leave 確認就冇咗。Study 畫面一樣會被拉返主頁、失去 scroll 位置。Modal 文字仲寫「you'll leave the study plan screens」，用戶唔會預期離開普通 Exam。
- 影響：入口開咗之後（PR7）用戶會失去進行中嘅模擬考答案；而家只限 preview。
- 方案 A（推薦）：只喺計劃畫面先離開：`const PLAN_SCREEN_IDS = ['screenPlanGoal']`（PR4+ 加其他），`onOk` 入面 `if (isOnPlanScreen()) leaveToHome(); else renderModeSelection();`。PR6a 有 plan side session 時，再加 `isPlanSession()` 條件。Trade-off：PR4–PR6 加新 screen 要記得加入 list（加 test 釘住）。
- 方案 B：每個 plan screen 用 `data-plan-screen` attribute，`isOnPlanScreen()` = `document.querySelector('.screen.active[data-plan-screen]')`。Trade-off：唔使維護 list，但多一個 markup 慣例要寫入 HANDOFF。
- Test：`plan-ui-test` 加「Exam 3 中途關 switch → 仍然 `screenQuiz`、timer 仲行」。

### 🟡 W-032 — switch 撳「開」會關埋 ⓘ popover，focus 跌落 body

- 位置：`js/screens/planHome.js` `renderPlanSettings()`（`byId('infoPlanSwitch').innerHTML = switchHtml(...)`）+ `js/core/actions.js` document click：`if (!e.target.closest('#infoPop')) setInfoOpen(false);`
- 描述：`togglePlanFeature` → `setPlanFeature(true)` → `renderPlanSettings()` 用 innerHTML 換咗粒掣。之後同一個 click event 去到 outside-click 檢查時，`e.target`（舊掣）已經 detach，`closest('#infoPop')` = null → popover 收埋。
- 重現（probe）：關咗狀態 → ⓘ → 撳 switch（mouse 或者 Space）→ `isStudyPlanEnabled()` true，但 `#infoPop` 冇咗 `.show`，`document.activeElement` = `BODY`。用戶睇唔到 switch 變綠，鍵盤用戶要由頭 Tab。`plan-ui-test` 用 `getAttribute` 讀隱藏咗嘅 element，所以冇發現。
- 方案 A（推薦）：in-place 更新：switch 只喺第一次 render 建立，之後 `setAttribute('aria-checked', …)` + 改 `#infoPlanStatus` 文字（例如 `switch.js` 加 `setSwitchOn(el, on)`）。Element 唔換，popover 唔關、focus 留低。Trade-off：`switch.js` 多一個 function。
- 方案 B：outside-click 檢查改做 `e.target.isConnected && !e.target.closest('#infoPop')`，再喺 re-render 後 `byId('planFeatureSwitch').focus()`（如果之前 focus 喺佢度）。Trade-off：兩處改動，要記住 detached target 呢個坑（其他 popover 內 re-render 都會中）。
- Test：撳 switch 開之後 `#infoPop.show` 仲在、`activeElement.id === 'planFeatureSwitch'`。

### 🟡 W-033 — date input 用鍵盤打日期會被覆蓋，打唔到

- 位置：`js/screens/planGoal.js` `planSetExamDate()` + `renderPlanDays()`（`input.value = planGoalDraft.examDate`），由 `data-input-action`（每次 `input` event）觸發
- 描述：Chromium 嘅 date field 每打一格（日 / 月 / 年）就出一次 `input`，中間值經常早過 min（例如月份打「1」→ `2026-01-29`，年份打「2」→ `0002-…`）。`planSetExamDate` 忽略之後 `renderPlanGoal()` 將 `input.value` 寫返 draft，用戶打緊嘅格被重設。
- 重現（probe）：focus `#planExamDate`，逐個字打 `25122026` → 每次 input 之後 value 都返 `2026-10-29`，draft 冇變。ArrowUp / 原生 picker（一次過揀完）先 work。桌面鍵盤用戶實際上冇得自己打日期。
- 方案 A（推薦）：唔好喺用戶打緊嘅時候寫返個 field：`renderPlanDays` 只喺 `document.activeElement !== input` 先設 `input.value`；另加 `focusout`（或 `change` 之後）同步一次，令早過 min 嘅值最後彈返 draft。Trade-off：要一個 `focusout` 路徑（actions.js 而家只有 click / input / keydown，需要加 `data-blur-action` 或者喺 planGoal 內部處理）。
- 方案 B：中間值唔合法時乜都唔做（唔 call `renderPlanGoal()`），只喺 accept 咗新值先 re-render。Trade-off：簡單，但用戶離開 field 時 field 可能顯示一個冇被採用嘅日期（同 draft 唔一致），要喺 feasibility / CTA 旁邊提示。
- Test：`pg.keyboard.type` 逐格打一個合法日期 → draft = 該日期。

### 🟢 S-109 — 目標表單 chip / 休息日 / 程度卡 redraw 之後 focus 跌落 body

- 位置：`renderPlanDays` / `renderPlanRest` / `renderPlanLevels`（innerHTML 重建）
- 描述：probe：focus 任何一粒 preset chip / 休息日 chip / `.mode-card` 撳 Enter / Space → `activeElement = BODY`。同 S-102（結果頁 filter chip）一樣問題，當時已定咗做法。
- 方案 A（推薦）：跟 S-102：action 前記 `hadFocus = byId(groupId).contains(document.activeElement)`，render 後 focus 返同一 `data-arg` 嘅掣。三個 setter 共用一個 helper（例如 `planKeepFocus(groupId, arg, fn)`）。
- 方案 B：只更新 class / `aria-pressed`，唔重建 chip。Trade-off：要分開「首次 render」同「更新」兩條路。

### 🟢 S-110 — 驗收 O-1「log 壞咗要有恢復途徑」只做咗一半

- 位置：`renderPlanCard()` / `planHomeCardHtml()`
- 描述：plan 壞咗 → 出建立卡 → `planCreate()` 會 `clearStudyPlan()`，OK。但 plan 正常、log 壞咗嘅時候，主頁簡化卡冇任何掣，入唔到目標畫面亦冇提示，PR3 冇恢復途徑。入口收埋所以 latent。
- 方案 A（推薦）：唔改 code，將呢項驗收明確搬入 PR4（T-320「↺ 重設計劃」），喺 plan doc PR3 / PR4 驗收寫清楚。
- 方案 B：簡化卡加「改目標」連結 → `openPlanGoal()`（建立時清 log）。Trade-off：PR4 會換成正式掣，屬過渡 code。

### 🟢 S-111 — 過咗午夜，舊 draft 嘅考試日期早過 min，CTA disabled 但冇提示

- 位置：`renderPlanCta()`：hint 只處理 `PLAN_GOAL_ERROR.studyDays`
- 描述：揀咗最早日期（today + 7）之後停喺畫面過咗 12 點，下一次 render `validatePlanGoal` 報 `examDate` error → CTA disabled，但 hint 收埋、可行性照顯示，用戶唔知點解撳唔到。probe：`examDate = today + 6` → disabled、hint hidden。
- 方案 A（推薦）：`renderPlanGoal()` 開頭如果 `examDate < range.min` 就 clamp 去 `range.min`（同 > max clamp 一致）。
- 方案 B：加 `plan.goal.dateTooSoon` hint。Trade-off：多一個 locale key（en + zh-HK）。

---

## ✅ 做得好嘅地方

- 收埋策略徹底：`#planCard` 唔 render 時根本唔存在，visual-diff 0 diff；啟動只讀唔寫
- `applyPlanPreviewParam` 細緻：只認兩個值、保留其他 param 同 hash、`replaceState` 包 try
- Component 重用完全跟 handoff §3.1，冇複製 markup；`switch.js` 同 screen 解耦（只收 key / action）
- 時區處理正確：本地「今日」+ UTC day number 運算；`isoAddMonths` 月尾 clamp
- G28 收埋「照樣建立」句、G13 short 都建得到，都有 test
- zh-HK 書面語質素好，`i18n-test` 加咗口語黑名單（之後可再加「揀 / 攞 / 諗 / 仲 / 咁」）
- 截圖對照 mockup step1 / info：layout、顏色、文字層次一致

## 修正優先順序

| # | ID | 嚴重度 | 估計 | 時機 |
|---|---|---|---|---|
| 1 | W-031 | 🟡 | ~8 行 + 1 test | 呢個 PR |
| 2 | W-032 | 🟡 | ~10 行 + 1 test | 呢個 PR |
| 3 | W-033 | 🟡 | ~10 行 + 1 test | 呢個 PR |
| 4 | S-109 | 🟢 | ~10 行 + test | 呢個 PR（建議） |
| 5 | S-111 | 🟢 | 2 行 + test | 呢個 PR（建議） |
| 6 | S-110 | 🟢 | docs | 改 plan doc，PR4 驗收 |
| 7 | U-1（用戶要求） | — | 1 行 locale + 2 行 test | 呢個 PR |

## 修訂後代碼（建議）

```js
// js/screens/planHome.js
// W-031: G15 only leaves the plan screens; anywhere else the current screen stays (an exam keeps running)
const PLAN_SCREEN_IDS = ['screenPlanGoal']; // PR4+: add each plan screen (plan-ui-test pins the list)
function isOnPlanScreen() { return PLAN_SCREEN_IDS.includes(document.querySelector('.screen.active').id); }
function togglePlanFeature() {
  if (!isStudyPlanEnabled()) { setPlanFeature(true); return; }
  showConfirm({ title: t('modal.planOffTitle'), message: t('modal.planOffMessage'), okLabel: t('modal.planOffOk'),
    cancelLabel: t('modal.planOffCancel'), focusCancel: true,
    onOk: () => { setPlanFeature(false); if (isOnPlanScreen()) leaveToHome(); } });
}
// W-032: the switch is built once and then updated in place, so the click target stays inside #infoPop
// (the outside-click check keeps the popover open) and keyboard focus stays on the switch
function renderPlanSettings() {
  const row = byId('infoPlanRow');
  if (!row) return;
  row.hidden = !planEntryReady();
  if (row.hidden) return;
  const on = isStudyPlanEnabled();
  byId('infoPlanStatus').textContent = t(on ? 'app.planOnNote' : 'app.planOffNote');
  const sw = byId('planFeatureSwitch');
  if (sw) { setSwitchOn(sw, on); sw.setAttribute('aria-label', t('app.planSwitchLabel')); return; }
  byId('infoPlanSwitch').innerHTML = switchHtml({ id: 'planFeatureSwitch', on, action: 'togglePlanFeature',
    labelKey: 'app.planSwitchLabel', describedBy: 'infoPlanStatus' });
}

// js/components/switch.js
function setSwitchOn(el, on) { el.setAttribute('aria-checked', on ? 'true' : 'false'); }

// js/screens/planGoal.js
// W-033: while the date field has focus its half-typed segments are left alone (a partial date is often
// before the minimum); the draft is written back when focus leaves
function renderPlanDateInput(todayIso) {
  const input = byId('planExamDate'), range = planExamDateRange(todayIso);
  input.min = range.min;
  input.max = range.max;
  if (document.activeElement !== input) input.value = planGoalDraft.examDate;
}
// S-111: a draft left open past midnight moves up to the new minimum
function planClampDraftDate(todayIso) {
  const range = planExamDateRange(todayIso);
  if (planGoalDraft.examDate < range.min) planGoalDraft.examDate = range.min;
}
// S-109 (as S-102): a redrawn chip group hands focus to the chip just chosen
function planKeepFocus(groupId, arg, update) {
  const hadFocus = byId(groupId).contains(document.activeElement);
  update();
  if (hadFocus) byId(groupId).querySelector(`[data-arg="${arg}"]`).focus();
}
```

---

## Handoff receipt

```handoff-receipt
protocol: 1
status: warn
score: 82/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
next_action: invoke_developer
next_agent: frontend-developer
branch: "claude/charming-hopper-48ypzp"
context: "PR3 @5c55085: hidden state 0 change (visual-diff 76 identical, run-all 34/34), 5 deviations accepted; fix W-031 (switch off leaves any screen incl. running exam), W-032 (switch on closes popover + drops focus), W-033 (keyboard date typing clobbered); S-109/S-111 recommended, S-110 = move O-1 acceptance to PR4; user request U-1 en preset6w '6 weeks' -> '1.5 months' (+ plan-ui-test:122); switch-off modal 'behind popover' = screenshot taken mid slideIn, not a bug"
blockers:
  - "W-031 togglePlanFeature onOk leaveToHome() unconditional; only leave on plan screens (G15)"
  - "W-032 renderPlanSettings innerHTML replaces switch -> detached click target -> outside-click closes #infoPop; focus to body"
  - "W-033 planSetExamDate on every input event + renderPlanDays rewrites input.value -> typed segments reset"
  - "U-1 (user request) en plan.goal.preset6w -> '1.5 months'; update tests/plan-ui-test.js:122"
```
