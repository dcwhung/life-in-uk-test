# Code Review — 溫習計劃 PR8：正式推出（v1.1.0）

- **日期**：2026-10-10
- **審閱者**：Code Reviewer（獨立）
- **目標**：branch `claude/charming-hopper-48ypzp`，5 個 commit 喺 `origin/main` `c442651` 之上（`git diff c442651...HEAD`，28 個檔案，+194 / −1691）：`0a56d45` feat、`9ffcddf` test、`39a3e51` chore（刪 mockup）、`356bb6a` docs、`685fd03` test
- **Spec**：grill G18 / G19 / G31 → **G42**（`.proj-docs/plans/2026-10-08_grill_study-plan.md`）、`.proj-docs/plans/2026-10-10_plan-pr8-release.md`、plan T-341–T-343、handoff §2 / §5（ⓘ 開關預設開）
- **Design Origin**：`none-required`（冇新 UI；入口 flag + 拎走 preview）→ 合法：diff 冇新 className / layout，CSS 只改一行註解
- **用戶決定（2026-10-10）**：開入口；拎走 `?preview=plan`（G42，舊 `lifeuk.studyPlanPreview` 經 `OBSOLETE_LS` 清）；v1.1.0；刪 mockup；更新 HANDOFF；**暫時唔打 tag**；**用戶批准之前唔可以 merge**
- **結果**：⚠️ warn — **88 / 100**，0 Critical、2 Warning（W-050、W-051，都係 HANDOFF 文件）、2 Suggestion（S-165、S-166）

Code 本身冇問題（入口 flag、拎走 preview、清舊 LS key、SW cache 名、測試都啱）。扣分全部喺 HANDOFF：v1.1.0 新寫嘅內容有一個業務規則寫錯（合格分數），而且呢批 commit 係喺 G43 / PR7c follow-up merge 之前寫、之後 replay 落新 main，HANDOFF 冇跟住補返嗰幾個 PR 嘅內容。

## Hard Gates

| Gate | 結果 | 備注 |
|---|---|---|
| Lint | n/a | repo 冇 eslint / package.json；`js/`、`sw.js` 冇 CJK 字元（python 掃 U+3000–303F / 4E00–9FFF / FF00–FFEF，0 行） |
| Type check | n/a | plain JS |
| Tests | ✅ pass | `NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium bash tests/run-all.sh` exit 0，45/45 PASS（`plan-test` 2744 checks）；跑完 `git checkout -- 'tests/*.png'`，working tree clean |
| Coverage | ✅ pass | 新 `checkReleaseEntry`（plain URL 見卡 + ⓘ switch 開、冇寫 key；舊 flag `true`/`false` 載入後刪；`?preview=off`、`?preview=plan&x=1#top` 冇效果、URL 原封不動；`studyPlanEnabled=false` 冇卡）；五個 `checkHidden` 改用 `planEntryReady()` override 做 rollback；`plan-test` 守 `OBSOLETE_LS` + 冇 `isPlanPreviewOn`；缺口見 S-165 |
| No Critical | ✅ pass | 0 |
| Security scan | n/a | 冇新依賴 |

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 25 | 25 | code 冇 bug；URL 參數唔處理 = 冇 side effect |
| 安全性 | 20 | 20 | |
| 可維護性 | 10 | 20 | W-050、W-051（HANDOFF 係下一個 session 嘅主要入口） |
| 測試覆蓋 | 14 | 15 | S-165 |
| 性能 | 10 | 10 | |
| 代碼風格 | 9 | 10 | S-166 |
| **總分** | **88** | **100** | |

**結果：⚠️ warn**（hard gate 全 pass、冇 Critical，75–89）。兩個 Warning 都只係改 `HANDOFF.md`，唔使郁 app code。

## 逐項檢查（主 agent 指定）

1. **冇殘留 preview code / 死常數**：✅ `isPlanPreviewOn`、`setPlanPreview`、`applyPlanPreviewParam`（連 `main.js` call）、`STUDY_PLAN_PREVIEW_LS`、`PLAN_PREVIEW_PARAM/ON/OFF` 全部刪晒；`grep -i preview js sw.js index.html locales` 只剩註解（`planHome.js` G42 註解、`plan.css` 兩行 v1.0.4「preview scratchpad」歷史註解，同 G31 無關）。
2. **`OBSOLETE_LS`**：✅ `['reviewOrder', LS_PREFIX + 'studyPlanPreview']`。`reviewOrder` 本身就係冇 prefix 嘅舊名，新項加 prefix 係啱嘅（實際 key 就係 `lifeuk.studyPlanPreview`）。`removeObsoleteKeys()` 喺 `migrateLegacyStorage()` 每次載入都行（唔受 marker 影響），有自己 try/catch；刪唔到都冇 code 讀。`checkReleaseEntry` 驗咗 `true` / `false` 兩個值都被刪。
3. **`planEntryReady` / `planVisible` / CUI-0021 `planShellReady`**：✅ `planEntryReady()` = `STUDY_PLAN_READY`（保留 function 做 rollback / 測試 seam，符合 G42）；`planVisible()` = `planEntryReady() && planShellReady() && isStudyPlanEnabled()` 不變。`upgrade-test` 三個舊 shell（pre-PR3 / PR3 / PR4）唔再 seed preview，靠 `STUDY_PLAN_READY = true` 開入口，照舊冇卡、冇 page error、PR4 shell 唔郁已存計劃（S-165：值得加一句 assert 入口係開咗）。
4. **ⓘ switch 首次開啟預設**：✅ `isStudyPlanEnabled()` = `getLS(...) !== false` → 冇值 = 開，同 handoff §2「功能總開關…**預設開**」、§5「ⓘ 開關：預設開」、plan T-315 / 驗收「入口真用戶睇得到（預設開）」一致。新用戶第一次開：主頁有「建立溫習計劃」卡、ⓘ switch `aria-checked="true"`，而且**冇寫任何 key**（test 有驗）。舊用戶喺 preview 期間關咗（`lifeuk.studyPlanEnabled = false`）→ 照舊收埋（`checkReleaseEntry` 最後一段）。
5. **SW**：✅ `CACHE = 'lifeuk-v' + APP_VERSION` → `lifeuk-v1.1.0`；`activate` 刪其他 `lifeuk-v*`（包括 `lifeuk-v1.0.8`），唔掂其他 app cache；`SHELL` 冇加減檔案（PR8 冇新檔、刪嘅 mockup 本身唔喺 SHELL），`sw-test` pass。1.0.8 client：舊 SW cache-first 全部檔案來自同一個 1.0.8 cache（1.0.8 shell 已有全部 plan screen，而且 `STUDY_PLAN_READY = false`，所以喺新 SW 接手前唔會半開）；`sw.js` 經 `importScripts('js/core/config.js')` 攞版本，config 一變 browser 就 install 新 worker（`cache: 'reload'` 繞過 Pages max-age），`skipWaiting` + `clients.claim`，下一次載入就係 1.1.0。
6. **測試冇 preview 之後仲有冇意義**：✅ 全部 `?preview=plan` 改為 plain URL（等於驗證「真用戶」路徑）；hidden case 由「冇參數」改為「override `planEntryReady()` 做 `false`」，代表 rollback flag，保留咗「入口收埋時 screen 開唔到、冇寫 key」嘅保障。`lang-switch-test` 唔再 override 做 `true`，即係用真 flag。`dup-test` 版本 assert 改為 ≥ 1.0.8，邏輯啱（1.1.0 → minor > 0）。
7. **Replay 之後有冇漏 / stale**：code 同測試冇漏（`plan-done-green-test` `685fd03` 已改 plain URL；G43 / S-154 / runner fade 嘅 code 全部喺 base，PR8 冇郁）。grill doc G42 排喺 G41 同 G43 之間 ✅。**HANDOFF 有 stale**，見 W-051。
8. **冇 CJK 喺 `js/`**：✅
9. **Mockup 刪除**：✅ `mockups/study-plan-flow.html` 已刪；仍然提到佢嘅只係歷史文件（reviews / qa / session log、`.tickets/completed/…/CUI-0025.md`）同已加「PR8 已刪」嘅 plan / arch / handoff / grill、`plan.css`、`planRun.js` 註解。
10. **Tag / merge**：✅ 冇 tag；plan doc 同 HANDOFF 都寫「merge 後先打 tag `v1.1.0`」、版本表寫「待 merge」。**提醒 main agent：用戶批准之前唔可以 merge。**

## 問題清單

### 🔴 Critical

冇。

### 🟡 Warning

#### W-050 — HANDOFF 新「溫習計劃」section 寫錯模擬考合格分數（≥ 21/24）

- **位置**：`HANDOFF.md` 「溫習計劃（Study Plan，v1.1.0）」→「記錄格式」段（約第 408 行）：「`mock` 係當日模擬考試結果 list `[{ exam, correct, total }]`（**合格 ≥ 21/24**，G10；只計當日，唔補做）」
- **描述**：G10 寫明「要**合格（≥ 18/24，`PASS_RATIO`）**先算完成；分數記低（整體 bar「模擬考 ≥ 21/24」照用）」。Code：`planMockPassed(a)` = `correct / total >= PASS_RATIO`（`js/core/config.js` `PASS_RATIO = 0.75` → 18/24）；21 只係 `PLAN_SAFE_SCORE`（`js/domain/plan.js`，整體進度 bar「穩陣」目標）同 `PLAN_SAFE_IN_A_ROW`。G43 / W-049 亦用 ≥ 18/24。
- **影響**：HANDOFF 係下一個 session 第一份睇嘅文件。寫錯完成條件，之後改模擬考 / 日程變綠嘅人好容易「修正」code 去跟文件，令計劃任務完成同 Practice 合格標準唔一致。
- **方案 A（推薦）**：改做「合格 = ≥ 18/24（`PASS_RATIO`，G10）先算任務完成；21/24（`PLAN_SAFE_SCORE`）只係整體進度 bar 嘅穩陣目標」。
- **方案 B**：刪走括號入面嘅分數，只寫「合格見 G10」。少啲資訊，但唔會再錯。

#### W-051 — HANDOFF v1.1.0 內容係 replay 之前寫嘅：漏咗 G43（#82）、PR7c follow-up（#80 S-154、#81 runner fade），測試數同撞號注意 stale

- **位置**：`HANDOFF.md`
  - 版本表 v1.1.0 行：「PR7c #79–#81（G41 閱讀完成 tag）」—— 冇提 #80（S-154：runner nav 標籤 320–390px 一行）、#81（runner 卡練習完成先褪色，S-158 / S-159），亦**完全冇 #82 G43**（日程三個階段 / 溫習次序已完成變綠、今日已完成實心綠 pill，W-049「只計做得到嘅日子」）。
  - 「溫習計劃（Study Plan，v1.1.0）」section：「決定見 grill（**G1–G42**）」應該係 G1–G43；`planSchedule.js` 一行冇 G43 綠色狀態；`planProgress.js` 一行冇 `planPhaseDone` / `planChaptersDone`（G43 helper）；`planRun.js` 一行有 G41 但冇 runner fade / S-154。
  - File 結構表 `tests/*.js`：「**44** 套測試（連 `test.js`…；溫習計劃 `plan-*-test`…）」—— 今次 `run-all.sh` 係 45 套（`tests/` 有 46 個 `.js`，減 `pages-server.js`）；G43 加咗 `plan-done-green-test`，G41 有 `plan-read-done-test`，兩個都冇寫名。
  - 「Review ID 撞號（注意）」段只講到 PR7c W-048、S-153–S-159；G43 review 用咗 W-049、S-160–S-164（`.proj-docs/index.md` 已記，HANDOFF 未跟）。
- **描述**：PR8 嘅 docs commit（`356bb6a`）喺 #80–#82 merge 前寫，replay 之後冇補。code 同測試冇漏（全部喺 base），漏嘅只係文件。
- **影響**：v1.1.0 係「正式推出」嘅總結行，之後查「日程點解變綠」、「點解 runner 卡會褪色」會搵唔到；測試數同撞號範圍錯會令下一個 session 數錯 / 撞號。
- **方案 A（推薦）**：v1.1.0 行改「PR7c #79（G41 閱讀完成 tag）、#80（S-154 runner nav 一行）、#81（runner 卡練習完成先褪色）、G43 #82（日程已完成變綠，W-049 只計做得到嘅日子）」；section 改 G1–G43，`planSchedule.js` / `planProgress.js` / `planRun.js` 三行補一句；測試數改 45 + 加 `plan-read-done-test`（G41）、`plan-done-green-test`（G43）；撞號段加「G43 用 W-049、S-160–S-164；PR8 用 W-050–W-051、S-165–S-166」。
- **方案 B**：v1.1.0 行同 section 只加連結去 `.proj-docs/index.md` / 各 review，唔重複內容。短啲，但 HANDOFF 其他版本行都係寫晒內容，唔一致。

### 🟢 Suggestion

#### S-165 — `upgrade-test` CUI-0021 舊 shell case 冇 assert 入口真係開咗

- **位置**：`tests/upgrade-test.js` `prePlanUiShell` / `pr3Shell` / `pr4Shell`
- **描述**：以前 seed `studyPlanPreview: 'true'` 令入口開咗，所以「冇卡」證明係 `planShellReady()` 擋住。而家冇 seed，靠 `STUDY_PLAN_READY = true`；如果日後 rollback 改返 `false`，三個「no card」assert 照 pass，但已經唔係測緊 CUI-0021 guard（vacuous）。
- **方案 A（推薦）**：每個 case 加 `assert(await pg.evaluate(() => planEntryReady() && isStudyPlanEnabled()), '…: the entry is on, so only planShellReady() hides the card')`。
- **方案 B**：喺 page 入面 override `window.planEntryReady = () => true`，令 case 唔受 flag 影響。

#### S-166 — 「git 歷史 `732d6e7` 仲有」指向唔係最後一個有 mockup 嘅 commit

- **位置**：`.proj-docs/plans/2026-10-08_handoff_study-plan.md`、`2026-10-08_plan_study-plan.md` Design Origin 行
- **描述**：`732d6e7`（#81 merge）確實有 mockup，但之後 `c442651`（#82，PR8 base）都有，最後一個係 `39a3e51^`。寫 base `c442651` 更易明（「刪之前嘅 main」）。
- **方案 A**：改 `c442651`（PR8 base）。**方案 B**：寫「`git show 39a3e51^:mockups/study-plan-flow.html`」，直接可以 copy 嚟用。

## ✅ 做得好嘅地方

- 拎走得乾淨：function、常數、`startApp()` call、測試 helper 一齊刪，冇留死碼；`OBSOLETE_LS` 重用現有清理機制，唔使新 code。
- `planEntryReady()` 保留做 function，令 rollback 同 hidden 測試仍然有 seam；config 註解寫清楚「改 false = 收埋入口，唔郁已存計劃」，HANDOFF「入口開關」段亦有。
- `checkReleaseEntry` 由真用戶角度驗：冇參數、舊 flag 兩個值、兩種舊 URL、switch 關咗嘅舊用戶，仲驗咗「顯示入口唔寫 key」。
- URL 參數決定「唔處理、唔清 URL」最簡單，test 鎖死咗冇 side effect。
- 文件將「mockup 已刪」逐份標明，歷史記錄冇改；plan doc 寫明冇 CHANGELOG / app 內 what's new，所以唔加。

## 修正優先順序

| 次序 | ID | 檔案 | 工作量 |
|---|---|---|---|
| 1 | W-050 | `HANDOFF.md` | 1 行 |
| 2 | W-051 | `HANDOFF.md` | 4–5 處 |
| 3 | S-165 | `tests/upgrade-test.js` | 3 行 |
| 4 | S-166 | 2 份 plan doc | 2 行 |

每個 item 一個 commit（`fix: W-050 | …`、`docs: W-051 | …` 等）。

## 修訂後內容（建議）

W-050，`HANDOFF.md` 記錄格式段：

```markdown
…`mock` 係當日模擬考試結果 list `[{ exam, correct, total }]`（合格 = ≥ 18/24（`PASS_RATIO`，G10）先算任務完成；21/24 `PLAN_SAFE_SCORE` 只係整體進度 bar 嘅穩陣目標；只計當日，唔補做）。
```

W-051，`HANDOFF.md` v1.1.0 行入面 PR 列表：

```markdown
…PR7b #78（v1.0.8，G40 相同文字題目）、PR7c #79（G41 閱讀完成 tag + 最後一條未完成提示）、#80（S-154 runner nav 320–390px 一行）、#81（runner 卡練習完成先褪色，S-158 / S-159）、G43 #82（日程三個階段 / 溫習次序已完成變綠、今日已完成實心綠 pill；W-049 強化 / 模擬考只計做得到嘅日子）；**PR8**：…
```

S-165，`tests/upgrade-test.js`（每個舊 shell case，`waitForSelector` 之後）：

```js
// the entry itself is on (v1.1.0), so only planShellReady() (CUI-0021) can be what hides the card
assert(await pg.evaluate(() => planEntryReady() && isStudyPlanEnabled()), 'pre-PR3 shell: the entry is on');
```

## Handoff receipt

```handoff-receipt
protocol: 1
status: warn
score: 88/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
next_action: invoke_developer
next_agent: frontend-developer
branch: "claude/charming-hopper-48ypzp"
context: "PR8 v1.1.0 code is correct (flag on, preview removed, OBSOLETE_LS cleanup, SW lifeuk-v1.1.0, 45/45 PASS); fix HANDOFF docs W-050 (pass mark 18/24 not 21/24) and W-051 (add G43 #82, #80 S-154, #81 runner fade, G1-G43, 45 suites, W-049/S-160-S-164 ID note), optional S-165/S-166, then re-review; do NOT merge or tag until the user approves"
blockers:
  - "W-050 HANDOFF.md Study Plan section says mock pass >= 21/24; G10 / PASS_RATIO is >= 18/24"
  - "W-051 HANDOFF.md v1.1.0 row / Study Plan section stale after replay: missing G43 #82, #80 S-154, #81 runner fade; G1-G42 -> G1-G43; 44 -> 45 suites; ID note lacks W-049, S-160-S-164"
```

---

## Re-review + QA — 2026-10-10

- **目標**：`a1aa0e0..3c1c8f3`（4 個 commit，每個 item 一個 commit）：`10e3ced`（W-050）、`5301b85`（W-051）、`70ac565`（S-165）、`3c1c8f3`（S-166）；4 個檔案 +16 / −10，冇改 app code（`js/`、`css/`、`index.html`、`sw.js`、`locales/` 0 改動）
- **QA**：主 agent 唔另外叫 QA agent，由 reviewer 自己做（release PR）
- **結果**：✅ pass — **100 / 100**，0 Critical、0 Warning、0 Suggestion；4 個 item 全部解決，冇新 finding

### Hard Gates

| Gate | 結果 | 備注 |
|---|---|---|
| Lint | n/a | 冇 eslint；`js/` 冇改動，CJK 0 |
| Type check | n/a | plain JS |
| Tests | ✅ pass | `run-all.sh` exit 0，**45/45 PASS**（`plan-test` 2744 checks，`upgrade-test` 包括 S-165 新 assert）；跑完 `git checkout -- 'tests/*.png'`，clean |
| Coverage | ✅ pass | S-165 補返 CUI-0021 舊 shell「入口開咗」前提；加上下面瀏覽器 QA 91 checks |
| No Critical | ✅ pass | 0 |
| Security scan | n/a | 冇新依賴 |

### 逐項覆核

| ID | 狀態 | 覆核 |
|---|---|---|
| W-050 | ✅ 已解決 | 記錄格式段改為「合格 = ≥ 18/24（`PASS_RATIO`，G10）先算任務完成；21/24 `PLAN_SAFE_SCORE` 只係整體進度 bar 嘅穩陣目標」，同 G10、`planMockPassed`、`plan.js` `PLAN_SAFE_SCORE` 一致 |
| W-051 | ✅ 已解決 | v1.1.0 行逐個列 #79（G41）、#80（S-154）、#81（runner fade，S-158 / S-159）、G43 #82（三隻綠、溫習次序 ✓、今日已完成 pill、W-049、`planPhaseDone` / `planChaptersDone` / `planDoneSets`）；section 改 G1–G43；`planProgress.js` / `planSchedule.js` / `planRun.js` 三行補咗；測試 45 套 + 點名 `plan-read-done-test`（G41）、`plan-done-green-test`（G43）；撞號段加 G43（W-049、S-160–S-164）同 PR8（W-050–W-051、S-165–S-166）連 report 名。三個 function 名喺 `js/domain/planProgress.js` 都存在（179 / 222 / 230 行） |
| S-165 | ✅ 已解決 | `prePlanUiShell` / `pr3Shell` / `pr4Shell` 各加 `planEntryReady() && isStudyPlanEnabled()` assert（喺「冇卡」assert 之前），flag 改返 `false` 就會 fail，唔會 vacuous pass |
| S-166 | ✅ 已解決 | handoff / plan doc 改為 `git show c442651:mockups/study-plan-flow.html`（PR8 base；`39a3e51^` 都得），可以直接 copy 用 |

### 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 25 | 25 | |
| 安全性 | 20 | 20 | |
| 可維護性 | 20 | 20 | W-050、W-051 已解決 |
| 測試覆蓋 | 15 | 15 | S-165 已解決 |
| 性能 | 10 | 10 | |
| 代碼風格 | 10 | 10 | S-166 已解決 |
| **總分** | **100** | **100** | |

### 瀏覽器 QA（reviewer 自己做）

Script：`.proj-docs/qa/scripts/2026-10-10_qa-plan-pr8-release.js`（`QA_OUT=<scratch> NODE_PATH=… CHROMIUM_PATH=… node …`），Chromium（Playwright），app 用 `tests/pages-server.js` 經 http serve（Pages 一樣 `max-age=600`），**冇 `?preview`**。結果 **QA PASS（91 checks）**，冇 page error；截圖 29 張喺 scratchpad（唔 commit）。

| 項目 | 闊度 × 語言 | 結果 |
|---|---|---|
| 第一次開（冇 LS）：建立卡、ⓘ「功能」row、switch `aria-checked="true"`、冇寫任何 `lifeuk.studyPlan*` key、Home 冇 h-scroll、`<html lang>` 啱 | 390 / 320 × en / zh-HK | ✅ 4/4 |
| ⓘ 關（紅色 confirm → 確認）→ 卡消失；reload 之後仍然冇卡、switch 讀 off | 390 / 320 × en / zh-HK | ✅ 4/4 |
| 完整流程：建立卡 → 訂立目標（預設）→ 建立 → 進度表 → 撳今日 row → 今日任務 → 閱讀 Ch 1（#1–2，最後一條見「尚有 2 條知識點未完成練習，共 9 題」+「練習這 9 題 →」）→ Practice plan session（`isPlanSession()`）→ 答啱一題，log 今日 `ok` 1 條 → ← 返今日任務 → Home 見計劃卡；每個畫面冇 h-scroll | 390 / 320 × en / zh-HK | ✅ 4/4 |
| 1.0.8 → 1.1.0 升級：`c442651`（1.0.8）經 http serve，`?preview=plan` 開，SW 控制、cache `["lifeuk-v1.0.8"]`、`lifeuk.studyPlanPreview = true`、建計劃 + Practice 答啱一題（log `{"2026-10-10":{"ok":{"1.0":1}…}}`）→ 原位 deploy 1.1.0 檔案 → reload：`APP_VERSION 1.1.0`、`STUDY_PLAN_READY true`、SW 控制、cache 只剩 `["lifeuk-v1.1.0"]`（1.0.8 被刪）、`lifeuk.studyPlanPreview` 被刪、progress log byte 一樣、計劃同一個（start / goal / days 一樣）、plain URL Home 見計劃卡「Day 1 / 21」；offline reload 照出 1.1.0 + 計劃卡 | 390 en | ✅ |

QA 觀察（唔係 finding）：

- 升級後計劃 JSON 長咗 10 個字元：載入時 G9 `planFillDays` 將今日嘅 review task materialize（`writeStudyPlan` 只喺 `changed` 先寫），1.0.8 一樣會咁做；goal / 日子冇郁。
- 自動化連續 click：進度表撳今日 row 之後即刻（< 350 ms）撳同一位置嘅閱讀任務，會被 CUI-0011 double tap guard（`SCREEN_CHANGE_CLICK_GUARD_MS` 350、40px）擋住（zh-HK 390 兩個掣剛好重疊）。呢個係設計（防止 stray 第二下落喺新畫面），真人點擊冇問題；script 每下 click 之前等 400 ms。
- 截圖肉眼睇過：320 zh-HK ⓘ popover「功能 · 🗓️ 溫習計劃 已開啟」+ switch 開、閱讀最後一條提示 + 主掣冇裁字；升級後 Home 計劃卡正常。

### 未做 / 交返用戶

- 實機 iOS PWA / Android 安裝版升級（T-342 實機部分）：呢度只有 Chromium；SW 換 cache 已用真 http + SW 驗過。
- **Merge 同 tag `v1.1.0` 要等用戶批准**（main agent 處理）；reviewer 冇 push / merge / tag。

### Handoff receipt（re-review）

```handoff-receipt
protocol: 1
status: pass
score: 100/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
next_action: merge_develop
next_agent: null
branch: "claude/charming-hopper-48ypzp"
context: "PR8 v1.1.0 re-review + reviewer-run QA pass: W-050/W-051/S-165/S-166 resolved, 45/45 PASS, browser QA 91 checks (first launch, switch off + reload, full flow 390/320 en+zh-HK, real SW upgrade 1.0.8 -> lifeuk-v1.1.0 keeps plan, drops lifeuk.studyPlanPreview); merge to main and tag v1.1.0 ONLY after the user approves"
blockers:
  - "user approval required before merge / tag v1.1.0 (user decision 2026-10-10)"
```
