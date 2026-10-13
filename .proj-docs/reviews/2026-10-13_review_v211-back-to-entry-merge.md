# Code Review — v2.1.1 back-to-entry：merge `main` v2.1.0 + 計劃「‹ Back」短 label

- **日期**：2026-10-13
- **審閱者**：Code Reviewer（獨立）
- **目標**：branch `fix/quiz/back-to-entry`，`ce45ae8`（merge `origin/main` v2.1.0 `5ab69c4`）→ HEAD `1d7a52f`：`b58e319`、`a906c11`、`e50ddd8`、`cc980b4`、`1d7a52f`
- **重點**：conflict resolution（`sideSession` / `planRun` / `memo` / `home` / `quiz`、locales、`index.html`）、`goBack` 次序（連記憶法）、混合 cache guard、有冇靜靜雞還原 `main` 行為、改 `main` suite 嘅理由、accessible name 包含可見字、ID / 版本記帳
- **Design Origin**：`cc980b4` / `1d7a52f` commit message `baseline:`（v2.1.1 Similar「Q{n}」短 label + accessible name 模式）
- **結果**：❌ **fail — 71 / 100**，1 Critical（C-007）、2 Warning（W-077、W-078）、4 Suggestion（S-265–S-268）

> **ID 說明**：任務指定嘅 C-007 / W-075 / S-264 之中，**W-075、W-076、S-262–S-264、CUI-0041、CUI-0042 已經喺 `origin/main` `7145c96`（PR #115，`review_v206.md` / `qa_v211.md`）用咗**；`main` index 寫明下一個新號 **C-007、W-077、S-265、CUI-0043**。所以今次用 **C-007、W-077–W-078、S-265–S-268**。下一個新號：**C-008、W-079、S-269、CUI-0043**。

## 總評

Merge 本身做得乾淨。以 merge 時嘅 `main`（`5ab69c4`）做 base 逐 hunk 睇：

- `js/screens/memo.js`、`index.html`、`sw.js` 同 `main` **byte 一樣** —— 記憶法中途返回完全用 `main` 嘅 `setQuizBackMemo` / `leaveMemoTest`（用戶決定），branch 舊有嘅 `SESSION_LEAVES` 已刪，冇第二條路。
- `goBack()` 次序：plan session → memo → 其他 side session → Flagged → `goHome()`。記憶法排喺 `isSideSession()` 前面係必要（memo 都係 side session kind，否則會行 `SESSION_RETURNS.memo` 即係「完成」路，會記錄成績）；同 `goHome()` 嘅 plan → memo 次序一致。考試 confirm、計劃模擬考 `planLeaveMock` 經 `goHome()` 不變。
- `goHome()` 只改註解；`isPlanSession → planBackToDay` 保留俾舊 `actions.js` 混合 cache 同其他 caller。
- 混合 cache：`renderPlanQuizHeader` 嘅 `typeof isMemoSession` guard（`b58e319`）啱：舊 v2.0.2 `sideSession.js` 冇 `isMemoSession` 亦冇 `setEntryBack`，會跌落 `setQuizBackHome`；memo 分支先 `setQuizBackAction` 再 `setQuizBackMemo`（後者唔掂 `data-action`），所以記憶法 header 喺新 `actions.js` 係 `goBack`、舊嘅係 `goHome`，兩條都去 `leaveMemoTest`。`setEntryBack` 用 `hasGoBackAction()` 擋住 `HEADER_BACK_ICONS`（兩樣都喺 v2.1.1 `planRun.js`）。`goBack` 入面直接 call `isMemoSession` / `planLeaveSession` 冇問題：header 只會喺新 `planRun.js` 先設做 `goBack`。
- `upgradeLegacyIconMarkup`（`main.js`）唔使改：quiz / Result header 返回掣係 runtime 畫；`fillStaticIcons` 只喺 `startApp` 行，語言切換只係 `applyStaticI18n`（會將 `aria-label` 寫返「Home」），但 `rerenderCurrentScreen` → `renderPlanQuizHeader` / `renderResults` → `setEntryBack` 即刻覆寫，`lang-switch-test` 有驗。
- 改 `main` suite 嘅理由都成立：`control-icons-test`（S-263 單一 chevron，原 S-260）、`memo-test` C2（#7 Study 知識點練習而家係「‹ Study」，唔再係 🏠，係 feature 本身）、`header-icons-test`（`goBack` selector + 計劃「Back」）、`lang-switch-test`（「返回」+ name）。
- `cc980b4`：「‹ Back」+ `aria-label`/`title`「Back to the fact」—— name 包含可見字，啱 W-074 模式。
- Reviewer probe（320 × 640、大字、en / zh-HK）：知識點練習同計劃練習 task header `scrollWidth 288 / clientWidth 288`，頁面 320，冇 error —— **CUI-0040 已解決**（見 S-268）。

問題集中喺兩樣：**`main` 喺 review 期間已經出咗另一個 v2.1.1**（C-007、W-078），同埋 `1d7a52f` 嘅 accessible name 冇包含可見字「Back」（W-077）。

## Hard Gates

| Gate | 結果 | 說明 |
|---|---|---|
| Lint | n/a | repo 冇 ESLint；`structure-test` 喺 run-all |
| Type check | n/a | 冇 TypeScript |
| Tests | ✅ pass | `run-all.sh` **70 / 70 PASS，exit 0**（第一輪，冇 flake）；`upgrade-test` HEAD 單獨 3 / 3 PASS |
| Coverage | n/a | 冇 coverage 工具 |
| No Critical | ❌ fail | C-007 |
| Security scan | n/a | 冇新增依賴 |

**upgrade-test flake 喺 `main` 都有**：merge 時嘅 `origin/main` `5ab69c4` 單獨跑 3 次，第 1 次 FAIL（`v1.4.0 js/core/i18n.js + current files … starts in en + large` → `size: "small"`），第 2、3 次 PASS；而家嘅 `origin/main` `7145c96` 3 / 3 PASS。即係既有 timing flake，唔係本 branch 引入。

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 10 | 25 | C-007（`APP_VERSION 2.1.1` 同 `main` 撞，merge 時唔會 conflict） |
| 安全性 | 20 | 20 | label 全部 `escapeHtml(t(…))`；`aria-label` 用 `setAttribute`，冇 HTML |
| 可維護性 | 12 | 20 | W-078（ID / ticket 撞號 + 4 個 doc / test conflict）、S-265、S-266、S-267 |
| 測試覆蓋 | 14 | 15 | S-268（320px 計劃 header 冇 regression test；CUI-0040 未更新） |
| 性能 | 10 | 10 | 冇變 |
| 代碼風格 | 5 | 10 | W-077（Label in Name，a11y） |
| **總分** | **71** | **100** | |

**結果：❌ fail**（hard gate「No Critical」fail）

## Design Fidelity

| 項目 | 結果 |
|---|---|
| Design Origin | `cc980b4` / `1d7a52f` commit message 有 `baseline:`；冇新 className / layout |
| CSS | 只係 `plan.css` 現有 nowrap 規則加 `#screenResult .back-btn.plan-hit`（merge 前已 review）；註解 stale（S-266） |
| Token / 色 | 冇新色、冇 hardcoded 值；chevron 用 `lineIconSvg`（currentColor） |
| 偏離 | W-077：可見字同 accessible name 唔一致 |

## 問題清單

### 🔴 C-007 `APP_VERSION 2.1.1` 同 `origin/main` `7145c96` 撞，merge 冇 conflict（SW cache 名一樣）

- **位置**：`js/core/config.js:5`（`sw.js` `CACHE = 'lifeuk-v' + APP_VERSION`）
- **描述**：review 期間 `main` merge 咗 PR #115（`claude/charming-archimedes-hrh4wd`，CUI-0039 stale key），都係 **v2.1.1**。`main` 嘅 QA 已開 **CUI-0041**（`.tickets/pending/0001-0200/CUI-0041.md`）同 index 寫明「後 merge 入 `main` 嗰條要升 **2.1.2**」。`git merge-tree HEAD origin/main`：`config.js` 兩邊同一行同一值 → **自動 merge 唔會 conflict**，好容易漏。
- **影響**：已經裝咗 `main` v2.1.1 嘅用戶，SW 見到 cache 名冇變唔會更新 → 繼續食舊 `sideSession.js` / `planRun.js` / locales；新返回掣行為完全唔會出現，或者變成 W-072 嗰類混合 cache（新 `index.html` 未必拎到）。部署後無聲失效。
- **方案 A（推薦）**：merge `origin/main`（`7145c96`）入本 branch，`APP_VERSION` 升 **2.1.2**，HANDOFF row / 報告 / CUI-0040 改寫 v2.1.2，關 CUI-0041。成本低，同之前 W-070 / W-071 / W-073 做法一致。
- **方案 B**：唔 merge、等 PR 時先處理 —— 唔建議，因為冇 textual conflict 提醒。

### 🟡 W-077 計劃 header / `#planRunBack` 可見字「Back」唔喺 accessible name 入面（WCAG 2.5.3 Label in Name）

- **位置**：`js/screens/planRun.js` `planRunBackName()`（`setQuizBackText(..., planQuizBackName(session))`、`renderPlanRun` 嘅 `setAccessibleName(byId('planRunBack'), planRunBackName(view.from))`）；test `back-to-entry-test.js:148`、`header-icons-test.js`、`lang-switch-test.js`、`plan-run-test.js` 將佢寫死
- **描述**：可見「‹ Back」/「‹ 返回」，但 `aria-label` + `title` 係「Today's tasks」/「Day 2 tasks」/「今日任務」/「Day 3 任務」—— **冇「Back」/「返回」**。Probe：en `{back:"Back", name:"Today's tasks"}`、zh-HK `{back:"返回", name:"今日任務"}`。同一個檔案 `setQuizBackText` 註解（W-074）寫明「it must contain the visible words」；`cc980b4` 嘅「Back to the fact」、Similar 嘅「Back to Q{n}」都跟足，只有 `1d7a52f` 呢兩粒唔跟。
- **影響**：語音控制用戶講「click Back」對唔到（accessible name 冇呢個字）；screen reader 讀「Today's tasks, button」，同畫面上嘅「Back」唔一致。用戶揀咗呢兩句做 name，但佢可能冇意識到呢個規則。
- **方案 A（推薦）**：name 加返動詞，新 key `plan.run.backTodayLabel`「Back to today's tasks」/「返回今日任務」、`plan.run.backDayLabel`「Back to {day} tasks」/「返回 {day} 任務」；舊 locale 冇 key 就用「Back」（`quiz.back`）。可見字唔變，320px 唔受影響。Test 改 assert name 以可見字開頭。
- **方案 B**：唔設 `aria-label`（name = 可見「Back」），淨係 `title` 寫目的地。最簡單，但 screen reader 用戶聽唔到去邊（`title` 一般唔讀做 description）。
- **要問用戶**：A 改咗用戶指定嘅 name 字眼（加「Back to」/「返回」前綴），請 main agent 同用戶確認。

### 🟡 W-078 Review ID / ticket 撞號，同 `main` 4 個檔 conflict

- **位置**：`.proj-docs/index.md`、`HANDOFF.md`、`reviews/2026-10-13_review_v203-back-to-entry.md` 頂、`.tickets/pending/0001-0200/CUI-0040.md` 頂、`qa/2026-10-13_qa_v205-back-to-entry.md`
- **描述**：本 branch 改號後嘅 **S-262 / S-263** 同 `main` `review_v206.md` 嘅 S-262 / S-263 撞；branch 文件寫「下一個新號 C-007、W-075、S-264、CUI-0041」，但 `main` 已用 W-075、W-076、S-264、CUI-0041、CUI-0042（`main` 嘅 `qa_v211.md` 已記錄呢次撞號）。`git merge-tree HEAD origin/main`：`.proj-docs/index.md`、`HANDOFF.md`、`tests/run-all.sh`、`tests/upgrade-test.js` 有 conflict。App code（`config.js` 以外）冇重疊：`main` 只改 `store.js` / `planProgress.js` / `questions.js` / `main.js`。
- **影響**：之後引用 S-262 / S-263 會指錯報告；「下一個新號」錯會令下一個 session 再撞。
- **方案 A（推薦）**：跟 index 慣例**唔再改號**（commit message `a906c11` 已引用），喺 index 頂加一段撞號記錄（S-262 / S-263 引用要連報告名），所有「下一個新號」改做 **C-008、W-079、S-269、CUI-0043**；同 C-007 一齊 merge `main` 解 4 個 conflict（`run-all.sh` 兩邊 test 都要、`upgrade-test` 兩邊 case 都保留）。
- **方案 B**：再改號 S-262 / S-263 → S-269 / S-270。要改 code comment 同多份文件，冇必要。

### 🟢 S-265 `plan.run.backFact` 而家同 `quiz.back` 一樣，`planQuizBackHtml` 分支多餘

- **位置**：`js/screens/planRun.js` `planQuizBackHtml()`；`locales/en.js` / `zh-HK.js` `plan.run.backFact`
- **描述**：`1d7a52f` 之後知識點同整個 task 都顯示「Back」/「返回」，兩個 key 值一樣，`planQuizBackHtml` 嘅 fact 分支同 fallback 結果相同。
- **方案 A**：`renderPlanQuizHeader` 直接用 `planRunBackHtml()`，刪 `planQuizBackHtml` 同 `plan.run.backFact`（舊 locale 混合 cache 冇影響，`quiz.back` 一早存在）。
- **方案 B**：保留做將來分開字眼嘅 hook，註解寫明暫時同 `quiz.back` 一樣。

### 🟢 S-266 Stale 註解 / HANDOFF

- `js/screens/quiz.js:117`「a plan task: its own label, "‹ Today's tasks"」→ 而家係「‹ Back」
- `css/screens/plan.css:405` 註解「"‹ Today's tasks" … on one line at 360px」
- `js/screens/planRun.js` `setQuizBackText` 上面「a plan's text back label keeps its words, and those words name it (S-188 …)」—— 而家計劃 label 用 `aria-label`
- `js/screens/memo.js:152`「the quiz header's back button (data-action goHome)」—— runtime 已係 `goBack`（`main` 檔，可以喺 merge commit 順手改，或者留俾 `main`）
- HANDOFF v2.1.1 row 仍寫「計劃 header `plan.run.backToday` / `backDayHtml` … 改用 `chevronLeft`」，冇講 `1d7a52f`（main agent 已知會補）
- **方案**：一個 docs/comment commit 改晒；或者 A 只改本 branch 檔、B 連 `memo.js` 一齊改。

### 🟢 S-267 `plan.run.backDayHtml` 而家係純文字 `aria-label`

- **位置**：`planRunBackName()`
- **描述**：key 叫 `…Html`，以前放 `<span lang="en">`，而家塞入 `aria-label`。如果將來 locale 喺入面加 HTML，會原樣讀出 tag。
- **方案 A**：key 旁加註解「plain text since v2.1.1 (aria-label)」。**方案 B**：配合 W-077 開新 `…Label` key，`backDayHtml` 留俾舊 cache。

### 🟢 S-268 320px 計劃 header 冇 regression test；CUI-0040 未更新

- **描述**：`1d7a52f` 嘅目的（320px 大字「Chapter 1」唔斷字）冇 test 守；`back-to-entry-test` 只驗 Similar 320px。Reviewer probe：en / zh-HK 知識點 + 練習 task header 都 288 / 288。CUI-0040 仍寫「‹ Today's tasks」overflow 14px、pending。
- **方案 A（推薦）**：`back-to-entry-test` `checkSimilarNarrow` 旁加計劃練習 task + 知識點 320 en 大字 `header.scrollWidth <= clientWidth`；CUI-0040 加「`1d7a52f` 後 288 / 288」交 QA re-test。
- **方案 B**：只更新 CUI-0040，交 QA 手測。

## ✅ 做得好嘅地方

- Merge 冇複製記憶法邏輯：直接用 `main` 嘅 C2，`goBack` 只係排次序。
- 混合 cache 每一層都有 guard（`actions.js` `typeof goBack`、`hasGoBackAction`、`typeof setEntryBack`、`typeof isMemoSession`、locale `t(key) === key`），而且有 upgrade-test ⑬ 守。
- `b58e319` 係 merge 後 upgrade-test 揾到嘅真 bug，修得準。
- 改 `main` suite 每處都有註解講原因同版本。
- `cc980b4` 嘅可見字 / accessible name 處理正確，同 W-074 一致。

## 修正優先順序

| 優先 | ID | 做乜 |
|---|---|---|
| 1 | C-007 | merge `origin/main` `7145c96`，`APP_VERSION` → 2.1.2，關 CUI-0041 |
| 2 | W-078 | 解 4 個 conflict；index 記撞號；下一個新號 C-008 / W-079 / S-269 / CUI-0043 |
| 3 | W-077 | accessible name 加「Back to」/「返回」（先同用戶確認字眼） |
| 4 | S-268 | 320px 計劃 header test + CUI-0040 更新 |
| 5 | S-265 / S-266 / S-267 | 清理 |

## 修訂後代碼（W-077 方案 A，示意）

```js
// js/screens/planRun.js — the accessible name starts with the visible word (WCAG 2.5.3, W-077)
function planRunBackName(from) {
  const plan = from && from !== planTodayIso() ? planLoad() : null;
  const key = plan ? 'plan.run.backDayLabel' : 'plan.run.backTodayLabel';
  const name = t(key, plan ? { day: t('plan.dayN', { n: planDayNumber(plan, from) }) } : undefined);
  return name === key ? t('quiz.back') : name; // a stale locale: the visible word itself
}
```

```js
// locales/en.js  plan.run
backTodayLabel: "Back to today's tasks",
backDayLabel: 'Back to {day} tasks',
// locales/zh-HK.js  plan.run
backTodayLabel: '返回今日任務',
backDayLabel: '返回 {day} 任務',
```

## Tests 記錄

- `cd tests && NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium ./run-all.sh`：**70 / 70 PASS，exit 0**（第一輪，`fontsize-test` / `upgrade-test` 都冇 flake）
- `upgrade-test` 單獨：HEAD 3 / 3 PASS；`origin/main` `5ab69c4` 1 FAIL / 2 PASS（既有 flake，v1.4.0 i18n.js 大字 case）；`origin/main` `7145c96` 3 / 3 PASS
- Probe 320 × 640 大字 en / zh-HK：計劃知識點 + 練習 task header 288 / 288、頁面 320、冇 page error
- 跑完已 `git checkout -- tests/shot-*.png`

## Handoff receipt

```handoff-receipt
protocol: 1
status: fail
score: 71/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
next_action: invoke_developer
next_agent: frontend-developer
branch: "fix/quiz/back-to-entry"
context: "C-007 merge origin/main 7145c96 (also v2.1.1, clean merge) and bump APP_VERSION to 2.1.2; W-078 resolve 4 doc/test conflicts, record S-262/S-263 collision, next free C-008/W-079/S-269/CUI-0043; W-077 plan back name lacks visible Back (confirm wording with user); S-265..S-268 cleanup"
blockers:
  - "C-007 APP_VERSION 2.1.1 collides with origin/main 7145c96 (SW cache name identical, no merge conflict)"
  - "W-077 plan quiz header / #planRunBack accessible name omits visible word Back (WCAG 2.5.3)"
  - "W-078 S-262/S-263, W-075, S-264, CUI-0041 already used on main; conflicts in index.md, HANDOFF.md, run-all.sh, upgrade-test.js"
```
