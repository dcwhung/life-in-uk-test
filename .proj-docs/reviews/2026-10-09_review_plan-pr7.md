# Code Review — 溫習計劃 PR7（zh-HK / en 字眼審閱）

- 日期：2026-10-09
- 審閱者：Code Reviewer（獨立）
- 目標：branch `claude/charming-hopper-48ypzp` @ 7b1c916（1 個 commit），diff = `git diff origin/main...HEAD`（7 files，+65 / −65）
- Design Origin：`none-required`（純文字；冇 JS 邏輯、冇 CSS、冇 markup 改動，diff 冇 `js/` / `css/` / `index.html`）
- 總評：33 個 key 有改（zh-HK 32、en 25；即用戶揀嘅 31 個，加 `hintAhead` / `learnReview` 兩個連帶改動）。逐個 key 核對過 placeholder：`{n}` `{k}` `{task}` `{day}` `{date}` `{avg}` 等同 en 嘅 `{ one, other }` plural object 全部冇變。zh-HK 冇半形標點，CJK 同拉丁字之間冇新加空格，冇口語字。「清錯題」「明天」「Clear your wrong answers」「clearing」喺 `locales/` 同 `js/` 都清走晒。`js/` 仍然冇 CJK。用戶指定嘅決定（三個程度 label、「應試策略」、`endedTitle`、重做錯題連帶改動、明天 → 明日）全部照做。發現 1 個 Warning：en 嘅 `hintToday` / `pairNote` 由「答對」改咗做「練習過」，同 G3 同實際邏輯唔符。另有 6 個 Suggestion。

## Hard Gates

| Gate | 結果 | 備注 |
|------|------|------|
| Lint | n/a | 項目冇 linter（純 classic script）|
| Type check | n/a | 冇 TS |
| Tests | pass | `run-all.sh` 40 套全部 PASS，exit 0（i18n-test：key 一致 + 書面語範圍；plan-ui / plan-schedule / plan-day / plan-run / plan-run2 用新字眼）；之後已 `git checkout -- 'tests/*.png'`（`tests/shot-similar.png` 仍然 tracked）|
| Coverage | n/a | 冇 coverage 工具；改咗字嘅 key 有一部分有全句 assert（planOn/OffNote、endedTitle、editDateNote、reviewNote、reviewWasWrong、allSubToday、donePairHtml、planLevels.none.label） |
| No Critical | pass | 0 |
| Security scan | n/a | 冇新依賴 |

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 20 | 25 | W-045 |
| 安全性 | 20 | 20 | 只改 locale 字串；`*Html` key 冇加新 markup |
| 可維護性 | 18 | 20 | S-134、S-138 |
| 測試覆蓋 | 14 | 15 | S-139 |
| 性能 | 10 | 10 | |
| 代碼風格 | 7 | 10 | S-135、S-136、S-137 |
| **總分** | **89** | **100** | |

**結果：warn**（hard gates 全部 pass，0 Critical，89 分）

## Design Fidelity

- Origin `none-required` 啱用：diff 冇新 className，冇 layout 改動，冇 `*.tsx/jsx/css/scss`。
- 我量過最長嗰句（`plan.home.endedTitle`，放喺主頁卡標題行 `planHomeTopHtml`）：用 `buildPlan` + 2026-11-02 seed 一個已完結計劃，喺 320 / 360 / 400 px 渲染。en 三個寬度都 wrap 成兩行（高 38px），zh-HK 只係 320px 先 wrap。三個寬度 `scrollWidth === clientWidth`，冇橫向 scroll，冇 overflow（`.plan-home-top` 有 `flex-wrap: wrap`，`.plan-home-ttl` 冇 `nowrap`）。已完結狀態冇倒數 `cd`，所以標題獨佔一行。詳情見 S-135。

## 逐 key 意思對照（en ↔ zh-HK）

| Key | 對應 | 備注 |
|-----|------|------|
| `app.planOnNote` / `planOffNote` | ✓ | 「已在主頁顯示」= "Now showing on the home screen" |
| `modal.planOffMessage` / `planResetMessage` | ✓ | |
| `plan.createText` | ✓ | 「應試策略」= "exam strategy" |
| `plan.home.doneHtml` | ✓ | 明天 → 明日 |
| `plan.home.endedTitle` | ✓ | 用戶指定 |
| `plan.home.logBroken` | ✓ | en 用 “ ”，zh 用「」，兩邊都加咗「並重新建立 / then create a new plan」|
| `plan.day.hintToday` | ✗ | **W-045**：en 寫 "practised"，舊版係 "right"；zh「練習完…所有題目」|
| `plan.day.hintAhead` / `strategy.learnReview` / `task.review` | ✓ | 重做錯題 / redo 連帶改動，三處用同一個字 |
| `plan.day.doneToday` / `doneDay` | ✓ | 只改 zh（加「已」）|
| `plan.goal.editStep` / `schedule.editGoal` / `goal.editDateNote` | ✓ | 只改 zh（改 → 更改；明天 → 明日）|
| `plan.schedule.orderTitle` / `orderIntro` / `strategy.learnOrder` | ✓ | 兩邊都刪咗「考試前記憶猶新」；zh 將 History 改成歷史（S-138）|
| `plan.schedule.resetHint` | ✓ | |
| `plan.run.pairNote` / `donePairHtml` | △ | `donePairHtml` OK（task 完成先出）；`pairNote` 見 W-045 |
| `plan.run.reviewNote` / `reviewWasWrong` | ✓ | |
| `plan.run.allSubToday` | ✓ | 意思一致；用字見 S-134 |
| `plan.run.sumRedone` | ✓ | 只改 zh；見 S-136 |
| `data.planLevels.*` | ✓ | 用戶指定 零基礎 / 有基礎 / 準備應考 = Beginner / Intermediate / Advanced（「準備應考」同 "Advanced" 意思唔係完全一樣，但係用戶嘅決定）|

## 問題清單

### 🔴 Critical

冇。

### 🟡 Warning

#### W-045 — en `hintToday` / `pairNote` 話「練習過就計已溫習」，但 G3 要全部答對先計

- 位置：`locales/en.js` `plan.day.hintToday`（L272）、`plan.run.pairNote`（L426）；`locales/zh-HK.js` `plan.day.hintToday`（L260）
- 描述：G3（grill）：「要**答啱對應題目**先算；淨係睇、唔做題唔計」。`js/domain/planProgress.js` `planFactDone` 係 `qids.every(k => dayLog.ok[k] || mastered.has(k))`，即係每條題目都要答對（或者 🏆）。舊 en 寫 "once the questions of a set of facts are right"，同邏輯一致；新 en 寫 "Once you have practised all the questions…"、"Once you have practised these questions…"。zh-HK `hintToday` 加咗「所有」（「練習完一段知識點的所有題目後」），讀落都係「做完就計」。
- 影響：用戶喺 Practice 做晒一段題目，有一題答錯，閱讀任務唔會打 ✓。提示話「練習過就計」，用戶會以為係 bug（同 CUI-0022 一樣，提示同畫面互相矛盾）。`pairNote` 喺 runner 入面，答錯嘅題目可以重做，所以影響細啲；但用戶可以中途離開，`hintToday` 就連 Study / Practice 模式都包埋。
- 方案 A（推薦）：只將條件改返做「答對」，句子其他部分保留用戶嘅版本：
  - en `hintToday`：`'Completion is counted automatically: everything you have done in Study and Practice counts. Once you have answered all the questions for a set of facts correctly, those facts count as read too.'`
  - en `pairNote`：`'Once you have answered these questions correctly, the matching facts count as read automatically.'`
  - zh `hintToday`：`'…答對一段知識點的所有題目後，該段知識點亦會計為已溫習。'`
  - Trade-off：要再俾用戶睇多次（佢審過嘅表入面係「practised」）；改動細，舊 test 唔使改（`pairNote` / `hintToday` 冇 assert 全句）。
- 方案 B：保留 "practised"，改邏輯：做過就計（`dayLog.ok[k] || dayLog.bad[k]`）。
  - Trade-off：推翻 G3 決定，要用戶重新確認；任務 badge「k wrong: only right answers count」同 plan-day-test 嘅 G3 測試都要改。唔建議。

### 🟢 Suggestion

#### S-134 — zh `allSubToday` 用咗「新一天」，同一句又用「明日」

- 位置：`locales/zh-HK.js` L406 `'新一天的任務會於明日在主頁顯示。'`
- 描述：今次將「明天」統一做「明日」，但呢句由舊嘅「新一日」改咗做「新一天」，一句入面「天」同「日」混用。其他地方都用「日」（`dateMoved`「已踏入新的一日」、`doneDay`「這日」）。而家成個 zh-HK locale 只係呢度有「天」。
- 方案 A（推薦）：`'新一日的任務會於明日在主頁顯示。'`（跟舊用字）
- 方案 B：`'明日的任務會在主頁顯示。'`（短啲；意思一樣，因為「新一日」就係明日）

#### S-135 — en `endedTitle` 喺主頁卡標題行 wrap 成兩行

- 位置：`locales/en.js` L250；`js/screens/planHome.js` L108（`planHomeTopHtml` 將佢放入 `.plan-home-ttl` 嘅 gold `<span>`）
- 描述：「🗓️ Study plan · Plan complete. Well done for all your hard work!」喺 320–400 px 都係兩行，喺 "Well" 後面斷行（`fs-lg`、800 weight、gold）。冇 overflow，冇橫向 scroll；但呢個位本身係短 tag（「Day n / N」「Exam day」），一句完整嘅鼓勵說話放喺度，標題就變得好重。zh 喺 ≥ 360 px 仲係一行。
- 方案 A：唔改，接受兩行（用戶揀嘅字眼；layout 冇壞）。
- 方案 B：拆 key：`endedTitle` 保留短 tag（"Plan complete" / 「計劃已完結」），新加 `endedCheer` 放喺 `endedSummary` 上面一行。要改 `planHome.js`，所以唔屬於 copy-only PR，要另外開。
- 推薦：A；如果用戶覺得太重，之後先做 B。

#### S-136 — zh `sumRedone`「曾答錯過」，「曾」同「過」重複

- 位置：`locales/zh-HK.js` L409
- 描述：「其中 {k} 題曾答錯過、已重做答對」。書面語一般用「曾答錯」或者「答錯過」，唔會兩個一齊用。
- 方案 A（推薦）：`'{n} 題全部答對，其中 {k} 題曾答錯、已重做答對。'`
- 方案 B：還原做舊版「答錯過」。

#### S-137 — zh「計算為已溫習」「當成已溫習」，書面語讀落唔順

- 位置：`locales/zh-HK.js` `pairNote`（L398）、`donePairHtml`（L410）用「自動計算為已溫習」；`hintToday`（L260）用「當成已溫習」
- 描述：舊嘅「計為已溫習」本身已經係書面語。改成「計算為」多咗個字，讀落似「計算」嘅結果；「當成」偏口語。同一個概念而家有兩種寫法（計算為 / 當成），舊版統一用「計為」。
- 方案 A（推薦）：三處統一用「計為已溫習」（或者「視為已溫習」）。
- 方案 B：保留「計算為」（用戶審過），只將「當成」改做「計算為」，起碼用字一致。

#### S-138 — zh 進度表「歷史」標題，下面嘅章節 label 寫「History」

- 位置：`locales/zh-HK.js` `schedule.orderTitle` / `orderIntro`（L327–328）、`strategy.learnOrder`（L342）
- 描述：plan Q10 規定章節名保持英文，`data.chapterShort[3] = 'History'`。進度表嘅次序 list 就喺 `orderTitle` 下面，每行都係章節短名，所以標題寫「歷史放在最後」，下面就係 "History"。舊版標題用 "History"，同 list 一致。（`order.whySociety`「比歷史容易記」之前已經用中文「歷史」，所以唔算完全冇先例。）
- 方案 A：唔改，用戶表入面揀咗「歷史」；喺 commit message 或者 grill 記低呢個例外。
- 方案 B：改返 "History"，同 Q10 同下面嘅 list 一致。
- 推薦：A（用戶決定），但要用戶確認一次佢知道下面嘅 label 係英文。

#### S-139 — 測試：description 過時，同埋冇 guard 防止舊用字返嚟

- 位置：`tests/plan-run-test.js` L215（assert message 仲寫 `'G17: "✗ You got this wrong" on the one answered wrong…'`，但 label 已經改做 "Correct answer (✗ you got this wrong before)"）；`tests/i18n-test.js`
- 描述：assert 本身改啱咗，冇問題。但 message 過時，fail 嗰陣會誤導人。另外，「明天」→「明日」同「清錯題」→「重做錯題」係用戶定落嘅統一規則，但冇測試守住，第日加 key 好易又寫返舊字。
- 方案 A（推薦）：更新 message；`i18n-test.js` 加一個 check：zh-HK locale 唔可以有「明天」「清錯題」，en 唔可以有 "Clear your wrong"（同書面語範圍 check 放埋一齊）。
- 方案 B：只更新 message，用字規則寫入 HANDOFF「i18n › zh-HK」glossary。

## ✅ 做得好嘅地方

- 範圍好乾淨：只改 `locales/` + 跟住改嘅 assert，`js/` / `css/` / markup 冇郁，Design Origin `none-required` 啱用。
- 33 個 key 嘅 placeholder 同 plural object 全部冇變（用腳本逐 key 比較 `origin/main` 同 HEAD）。
- 連帶改動做齊：`task.review` 改名之後，`hintAhead`（en + zh）同 `learnReview`（en + zh）都跟住改，畫面上冇「清錯題」同「重做錯題」並存。
- zh-HK 全形標點、CJK 同拉丁字之間冇空格、數字前後有空格，冇口語字；i18n-test 書面語範圍 pass。
- 測試唔係求其改到 pass：plan-schedule-test 嘅 G36 zh assert 用全句比較，所以有守住「明日」同「更改目標」；plan-day-test 守住 `endedTitle` 全句。

## 修正優先順序

| 優先 | ID | 工作量 | 備注 |
|------|----|--------|------|
| 1 | W-045 | 3 個字串 | 要用戶點頭（改佢審過嘅字眼）|
| 2 | S-134 | 1 個字串 | |
| 3 | S-136 | 1 個字串 | |
| 4 | S-137 | 3 個字串 | 同 W-045 一齊問用戶 |
| 5 | S-139 | test 一行 + i18n check | |
| 6 | S-138 | 0（確認）| 用戶確認就 close |
| 7 | S-135 | 0（方案 A）| 如果揀 B，另外開 PR |

## 修訂後代碼（重點，只列要改嘅行）

```js
// locales/en.js — W-045: G3 needs right answers (planFactDone), not just practice
      hintToday: 'Completion is counted automatically: everything you have done in Study and Practice counts. Once you have answered all the questions for a set of facts correctly, those facts count as read too.',
      pairNote: 'Once you have answered these questions correctly, the matching facts count as read automatically.',

// locales/zh-HK.js
      // W-045 + S-137: 答對才計；統一「計為已溫習」
      hintToday: '完成度由系統自動計算：在溫習及練習模式曾做過的都會計算在內。答對一段知識點的所有題目後，該段知識點亦會計為已溫習。',
      pairNote: '答對這段題目後，對應的知識點會自動計為已溫習。',
      donePairHtml: '對應的「{task}」已自動計為已溫習。',
      // S-134: 「日」統一
      allSubToday: '新一日的任務會於明日在主頁顯示。',
      // S-136: 「曾」「過」二揀一
      sumRedone: '{n} 題全部答對，其中 {k} 題曾答錯、已重做答對。',
```

```js
// tests/plan-run-test.js L215 — S-139: message follows the new label
    'G17: "Correct answer (✗ you got this wrong before)" on the one answered wrong, "✓ Correct answer" on the others');
```

## Handoff receipt

```handoff-receipt
protocol: 1
status: warn
score: 89/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
next_action: invoke_developer
next_agent: frontend-developer
branch: "claude/charming-hopper-48ypzp"
context: "PR7 copy-only: 40/40 suites pass, placeholders intact, no stale 清錯題/明天. W-045: en hintToday/pairNote (+ zh hintToday) say 'practised' but G3/planFactDone needs all right; confirm wording with user. S-134 新一天→新一日, S-136 曾答錯過, S-137 計算為/當成→計為, S-138 歷史 vs History label (confirm), S-139 test msg + guard, S-135 en endedTitle wraps 2 lines (no overflow)"
blockers:
  - "W-045 changes user-approved en/zh wording: needs user confirmation before the developer commits"
```
