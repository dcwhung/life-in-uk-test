# Implementation Plan：溫習計劃（Study Plan）

**版本**：v1.0
**日期**：2026-10-08
**關聯 Spec**：冇獨立 spec；規格 = `2026-10-08_handoff_study-plan.md`（§2 規格、§5 驗收清單）＋ `2026-10-08_grill_study-plan.md`（G1–G21，覆蓋 handoff §4 同 §3.3「+0.01」）＋ Architect 評估 `2026-10-08_arch_study-plan.md`（下稱「arch」）
**Design Origin**：`mockup:mockups/study-plan-flow.html`（section：`#infoPop` ⓘ 開關、`#step0` 主頁卡、`#step1` 訂立目標、`#step2` 進度表、`#step3` 今日任務 + 月曆 + 整體進度、`#runner` 做任務、`#spModal` 確認框）
**Base**：`main` `ff3e4da`（`APP_VERSION = '1.0.0'`，SemVer）
**負責人**：Project Manager + Architect Agent
**狀態**：✅ 用戶已確認（2026-10-08）；開放問題全部有答案（grill G22–G29）

---

## 可行性評估

詳見 arch §0（Fact-Check）、§A（可行性）。摘要：

| 項目 | 評估 | 備注 |
|------|------|------|
| 技術棧支持 | ✅ | vanilla JS 純函數 + `Date.UTC` ISO 日期；零 dependency（arch §A） |
| 第三方依賴 | ✅ | 冇；測試用現有 `playwright-core` 1.56.1（`page.clock`、`timezoneId`） |
| 性能要求 | ✅ | 最長 183 日計劃，完成度 < 5 ms；LS 最壞 < 300 KB（arch §B.5） |
| 安全要求 | ✅ | 冇網絡；LS 讀返要 shape validate（壞資料 = 冇計劃，唔覆寫）（arch §A、§B.6） |
| 離線 / 舊 shell | ⚠️ | 舊 cached `index.html` + 新 js 要靠 `LATE_BOOT_SCRIPTS` / `STYLES`（arch R1）；有現成機制同 `upgrade-test` |
| i18n | ⚠️ | ~130 個新 key；zh-HK 書面語（G21）+ en 另譯（G20）；工作量 + 文案返工風險（arch R10） |

**總體可行性**：✅ 可行（arch §A 結論 Go）

**條件**：(1) 入口一直收埋（`STUDY_PLAN_READY = false`）直至 PR7（G19）；(2) 開放問題 Q-A7 喺 PR2 開工前要有答案（影響 hook 範圍）；(3) PR7 前用戶確認 G20 對照表。

---

## 交付規則（G19 / G20 / G21 / SemVer）

| 規則 | 落實 |
|---|---|
| PR1–PR6b 入 `main`，入口收埋 | `config.js` `STUDY_PLAN_READY = false`；ⓘ switch、主頁卡、`#resultPlanRow` 全部睇 `planVisible()`；答題 hook 唔睇（G14；冇計劃自然 no-op）（arch §F.3） |
| 中間 PR 唔升版本 | `APP_VERSION` 保持 `1.0.0`；`sw.js` SHELL 照加新 file（`sw-test` 要求），已安裝 PWA 繼續用成套舊 cache（arch R15） |
| 中間 PR 外觀 0 改動 | 每個中間 PR 跑 `node tests/tools/visual-diff.js ff3e4da`：現有畫面 0 diff（新 screen 唔喺現有 38 個狀態入面） |
| 測試點入新畫面 | Playwright `evaluate(() => window.planEntryReady = () => true)` / 直接 call `openPlanGoal()` 等；**唔留** query string / LS 後門（arch §F.3） |
| 文字 | 每個 UI PR 自帶嗰批 key（en + zh-HK 書面語），`i18n-test` parity 每個 PR 都要綠；PR7 前出完整對照表（G20），用戶確認先開入口 |
| PR7 | `STUDY_PLAN_READY = true` + `APP_VERSION = '1.1.0'` + 刪 `mockups/study-plan-flow.html`（G18）+ HANDOFF + tag `v1.1.0` |
| PR description | 每個 PR 寫 `Design Origin: mockup:mockups/study-plan-flow.html`（handoff §5） |
| 流程 | 每個 PR：`claude/*` branch → `/review` → `/test`（QA）→ merge（HANDOFF「開發流程」）；merge 後下一個 PR 由最新 `main` 開 branch |

---

## 階段劃分

| Phase | PR | 目標 | 用戶睇得到？ |
|---|---|---|---|
| Phase 1 · 基礎 | PR1、PR2 | 排程 / 完成度純函數 + storage + 現有流程 hook；冇 UI | 唔（行為 0 改動） |
| Phase 2 · 計劃畫面 | PR3、PR4、PR5 | 開關、訂立目標、進度表、今日任務、月曆、主頁卡（全部收埋） | 唔（只測試入到） |
| Phase 3 · 做任務 | PR6a、PR6b | Runner 重用 `screenQuiz` / factCard / Similar / Exam | 唔 |
| Phase 4 · 上線 | PR7 | 對照表確認 → 開入口 → 1.1.0 | 係 |

> PM 決定：arch 建議 PR6「diff > 600 行先拆」（arch R14）。按工作量估算（~8 日）PR6 一定超過，**一開始就拆 PR6a / PR6b**，方便獨立 review + QA。即係共 8 個 PR（PR1–PR5、PR6a、PR6b、PR7）。

---

## 任務分解

工作量單位：理想開發日（d），未計 review / QA（見「工作量估算」）。負責 Agent：呢個項目冇 backend，domain / storage 純 JS 都由 **frontend-developer** 負責（標「FE（logic）」）。

### PR1 · Domain + storage（arch §B、§C、§F.2；Phase 1）

| 任務編號 | 任務描述 | 類型 | 負責 Agent | Mockup Binding | 工作量 | 依賴 | 優先級 |
|---|---|---|---|---|---|---|---|
| T-301 | `config.js`：`STUDY_PLAN_READY = false`、3 個 LS key 常數、`PLAN_PREFIX`；`utils.js` `removeLS`；`store.js` 讀寫 / clear / enabled（arch §B.2、§B.6） | feature | frontend-developer（FE logic） | none-required | 0.5 | - | P0 |
| T-302 | `plan.js` 頂部 tuning 常數（G12）、ISO 日期工具（DST-safe）、`PLAN_CANON_QKEY` / `planFactQids`（G1 / G4）（arch §C.2） | feature | frontend-developer（FE logic） | none-required | 0.5 | T-301 | P0 |
| T-303 | `plan.js` 排程：`planCalendar` / `planLearnItems` / `planChunkWeighted` / `planSplitStudyDays`（G13）/ `planFeasibility` / `validatePlanGoal` / `buildPlan` / `buildPlanDays` / `parseStoredPlan`（arch §C.4） | feature | frontend-developer（FE logic） | none-required | 1.5 | T-302 | P0 |
| T-304 | `plan.js` `replanFrom`（G7：凍結過去、未完成 learn 先排、`moved`、Day 編號唔變）（arch §C.5） | feature | frontend-developer（FE logic） | none-required | 1 | T-303 | P0 |
| T-305 | `planProgress.js` 純函數：狀態（G16）、materialise（G9 lazy）、完成度（G3 / G4 / G5）、補做（G8）、歸屬（G2 / G5）、round queue、KPI、`planPctBand`、月曆 grid（arch §C.3）；**依 Q-A2 / Q-A3 答案** | feature | frontend-developer（FE logic） | none-required | 1.5 | T-303 | P0 |
| T-306 | `planProgress.js` service：`recordPlanAnswer` / `recordPlanMock` / `ensurePlanToday`；read-modify-write（arch R17）；冇計劃唔寫 storage（arch R3） | feature | frontend-developer（FE logic） | none-required | 0.5 | T-305 | P0 |
| T-307 | `index.html` script tag 次序、`sw.js` SHELL、`main.js` `LATE_BOOT_SCRIPTS`（plan → planProgress）（arch §F.2、R1） | chore | frontend-developer | none-required | 0.25 | T-306 | P0 |
| T-308 | `tests/plan-test.js`（node + `vm`；TZ 三地 re-spawn；容量 budget；corrupt parse；236 / 389 headline assert SK-020）+ `run-all.sh`（arch §G 第 1–2 行） | test | frontend-developer | none-required | 1.5 | T-302–T-306 | P0 |

**PR1 驗收**：
- [ ] `plan-test` 覆蓋 arch §G 第 1–2 行全部項目，三個 TZ 都 PASS；每條 fact / canonical 題喺 learn 階段剛好出現一次、次序 `[1, 2, 5, 4, 3]`（handoff §2.3）
- [ ] 可行性三狀態邊界（handoff §5「可行性三種狀態」；G13 ✕ 仍排晒）、日期 7 日下限 / 6 個月上限（handoff §2.2）
- [ ] `replanFrom`：過去日子深比較一字不差（G7）
- [ ] 現有 31 套 `run-all` 全綠；`visual-diff ff3e4da` 0 diff；`sw-test` / `structure-test`（≤ 30 行、冇 CJK）PASS
- [ ] 全部頂層名 `plan` / `PLAN_` / `iso` 前綴（arch R2）

### PR2 · Hooks（arch §D、§E.1 清錯條件、§E.5 `startExam`；Phase 1）

| 任務編號 | 任務描述 | 類型 | 負責 Agent | Mockup Binding | 工作量 | 依賴 | 優先級 |
|---|---|---|---|---|---|---|---|
| T-309 | `mastery.js` `recordPracticeAnswer(q, correct, planDay = null)` → `recordPlanAnswer`；`quiz.js` 傳 `state.planDay`；`sideSessionState()` 預設 `planDay: null`（G2） | feature | frontend-developer | none-required | 0.5 | T-306 | P0 |
| T-310 | `result.js` `recordExamResults` 尾 call `recordPlanMock`（傳 `isRealTest`）；`startExam(examNum, mode)` 參數、唔郁 `pendingMode`（G10 / G15，arch R8）；**依 Q-A7 答案決定要唔要加 Exam 逐題 hook** | feature | frontend-developer | none-required | 0.5 | T-306 | P0 |
| T-311 | `questions.js` `isPlanExam` / `examLabel`（`plan.dayN`）；`sideSession.js` `plan` return kind；清錯條件加 `isPlanReviewSession()`（arch R9） | feature | frontend-developer | none-required | 0.5 | T-301 | P0 |
| T-312 | `structure-test` 加 guard：`js/domain/plan*.js` 唔用 `js/screens/*.js` 頂層名（arch §D 尾） | test | frontend-developer | none-required | 0.25 | T-307 | P1 |
| T-313 | `upgrade-test` ①（舊 shell + 新 js 答題冇 `ReferenceError`）③（冇計劃 storage 只多 marker）；Playwright hook case：`evaluate` 建計劃 → Practice 答題 → log 寫正確日子；Exam 交卷 → mock attempt | test | frontend-developer | none-required | 1 | T-309–T-311 | P0 |

**PR2 驗收**：
- [ ] 冇計劃時現有行為 100% 不變（31 套 + `visual-diff` 0 diff）
- [ ] 有計劃（測試 seed）：Practice / 錯題 / Flagged / Similar 答啱今日任務題 → 今日 log `ok`（G2）；答錯只入 `bad`
- [ ] Exam 1–17 / Random Exam 交卷寫 mock attempt；Leave 唔寫（G15）；Exam 逐題按 Q-A7 決定處理
- [ ] 舊 shell 混合頁面答題冇 error（arch R1）

### PR3 · 開關 + 訂立目標（Phase 2）

| 任務編號 | 任務描述 | 類型 | 負責 Agent | Mockup Binding | 工作量 | 依賴 | 優先級 |
|---|---|---|---|---|---|---|---|
| T-314 | `tokens.css` 新 token（紅→綠 band 或連續，**依 Q-A5**；階段色、考試日琥珀格紋、補做橙）；`switch.js` + `switch.css`（`role="switch"`、44px）；`plan.css` 基礎（`sp-*` → `plan-*`、`--space-*`）（arch §F.1、§F.4） | feature | frontend-developer | mockup: mockups/study-plan-flow.html#infoPop | 0.75 | T-307 | P0 |
| T-315 | `planHome.js`：`planEntryReady` / `planVisible`；ⓘ「功能」部份 + switch（預設開；關要 app modal 確認、開唔使；G15 寫明會離開計劃）；主頁「建立溫習計劃」金色虛線卡（handoff §2.1） | feature | frontend-developer | mockup: mockups/study-plan-flow.html#step0 | 0.75 | T-314 | P0 |
| T-316 | `planGoal.js`：考試日期 chip + date（min / max）、slider 30–120 step 15 + 刻度、休息日 chip、程度 `.mode-card`、可行性 bar + ✓ / △ / ✕、CTA（**依 Q-A6** 最少溫習日 disable）→ `buildPlan` 寫 LS（handoff §2.2） | feature | frontend-developer | mockup: mockups/study-plan-flow.html#step1 | 1.5 | T-314、T-303 | P0 |
| T-317 | i18n：`plan.goal.*` / `plan.feas.*` / `app.*` / `modal.planOff*` / `data.weekdays.*` / `data.planLevels.*`（en + zh-HK 書面語）、`DYNAMIC_PREFIXES`；`i18n-test` 加 `plan.*` zh-HK 口語字黑名單（PM 決定採用 arch R10 建議）；`SCREEN_RERENDER` 加 goal screen | feature | frontend-developer | mockup: mockups/study-plan-flow.html#step1 | 0.75 | T-316 | P0 |
| T-318 | `tests/plan-ui-test.js`（第一部份）+ `run-all.sh`：switch、建立卡、目標全部欄位、360 / 375 / 400px、`[hidden]`；`lang-switch-test` goal screen | test | frontend-developer | none-required | 1 | T-315–T-317 | P0 |

**PR3 驗收**：
- [ ] G31：`?preview=plan` 令 `planVisible()` 為 true 並記住（localStorage），`?preview=off` 收返；冇 preview 時 `visual-diff` 0 diff；URL param 處理完要 `history.replaceState` 清走，唔留喺 URL
- [ ] 建立新計劃之前先 `clearStudyPlan()`（舊 log 唔可以影響新計劃；PR1 review Round 3 / QA O-2）
- [ ] 計劃 log 壞咗時（PR1 為咗唔覆寫，之後答題唔會記）要有恢復途徑或者提示，例如「↺ 重設計劃」可以清除壞資料（PR1 QA O-1）
- [ ] handoff §5「ⓘ 開關」：預設開；關 → 主頁冇計劃項目、計劃畫面入唔到；開 → 原本進度（測試用 override 入）
- [ ] handoff §5「建立計劃」：所有欄位、日期上下限、slider 刻度（1 小時之後唔再寫「1 小時」）、可行性三種狀態
- [ ] `STUDY_PLAN_READY = false` 下真用戶完全睇唔到（`visual-diff` 0 diff）
- [ ] zh-HK 全部書面語（G21），口語黑名單 PASS；`i18n-test` / `lang-switch-test` PASS
- [ ] Component 重用：`.chip-row`、`.mode-card`、`.quiz-header`、`showConfirm()`（handoff §3.1）

### PR4 · 進度表 + 改目標 / 重設（Phase 2）

| 任務編號 | 任務描述 | 類型 | 負責 Agent | Mockup Binding | 工作量 | 依賴 | 優先級 |
|---|---|---|---|---|---|---|---|
| T-319 | `planSchedule.js`：summary、phase bar、策略卡、溫習次序卡（寫原因）、每日 list（~60vh 獨立 scroll、自動 scroll 到今日、sticky 全闊 WEEK、已過淡化、status pill、㩒入該日、考試日格紋）（handoff §2.3） | feature | frontend-developer | mockup: mockups/study-plan-flow.html#step2 | 1.5 | T-316、T-305 | P0 |
| T-320 | 「改目標」→ `planGoal` 預填 → `replanFrom`（G7）；「↺ 重設計劃」`.reset-btn` → modal「確定」→ 刪 plan + log 兩個 key、練習記錄唔郁 → 返建立卡 | feature | frontend-developer | mockup: mockups/study-plan-flow.html#spModal | 0.75 | T-319、T-304 | P0 |
| T-321 | i18n：`plan.phase.*` / `plan.order.*` / `plan.status.*` / `modal.planReset*` 等 + `SCREEN_RERENDER` | feature | frontend-developer | mockup: mockups/study-plan-flow.html#step2 | 0.5 | T-319 | P0 |
| T-322 | `plan-ui-test` 進度表部份（次序、sticky、scroll 到今日、淡化、重設 = 刪除、改目標凍結過去）；`lang-switch-test` schedule | test | frontend-developer | none-required | 0.75 | T-319–T-321 | P0 |

**PR4 驗收**：
- [ ] PR3 S-112：關 switch 嘅確認 modal 撳 Cancel / Confirm / Esc 之後 ⓘ popover 保持開住、focus 返 switch（outside-click 豁免 `#confirmModal`；modal 開住時 Esc 只關 modal）
- [ ] PR3 S-110 / PR1 QA O-1：計劃正常但 log 壞咗時，進度表「↺ 重設計劃」可以清走壞 log 恢復（T-320）
- [ ] G27 5 級色 token、階段色、考試日格紋、補做橙喺第一次用到嘅 PR 加（PR3 延後）
- [ ] handoff §5「進度表」全部：次序、三階段、scroll 到今日、sticky WEEK、已過淡化、重設 = 刪除
- [ ] 改目標：已過日子任務 + 完成度不變；Day 編號由原本 Day 1 計（G7）
- [ ] 任務文字冇分鐘、「未掌握」用文字（handoff §2.3）
- [ ] 通用條件（下稱 **UI-common**）：360 / 375 / 400px 冇打橫 scroll、`[hidden]` 唔被蓋、`visual-diff` 現有畫面 0 diff、`i18n-test` / `lang-switch-test` / `structure-test` PASS

### PR5 · 今日任務 + 月曆 + 主頁卡（Phase 2）

| 任務編號 | 任務描述 | 類型 | 負責 Agent | Mockup Binding | 工作量 | 依賴 | 優先級 |
|---|---|---|---|---|---|---|---|
| T-323 | `planDay.js`：header `← 主頁 ｜ ‹ 今日任務 / Day n › ｜ 進度表`、完成度圓環、階段 pill、n / m 項；task 框四態 + 補做（橙框 + Day n tag，唔計今日 %，G8）；「k 題答錯，答對才計算」tag；已過補做 / 未到預覽（**依 Q-A1**）；考試日（G16「今日考試」）/ 完結 | feature | frontend-developer | mockup: mockups/study-plan-flow.html#step3 | 2 | T-305、T-319 | P0 |
| T-324 | 完成度月曆（一版一月、`‹ 今日 ›` 只行計劃月份、淡化、計劃外淺灰、考試日格紋、㩒入該日）+ 整體進度三條 bar（知識點已溫、題目已練、模擬考 ≥ 21/24）；`🔥 連續 n 日 100%` pill（見假設 A6） | feature | frontend-developer | mockup: mockups/study-plan-flow.html#step3 | 1 | T-323 | P0 |
| T-325 | 主頁計劃卡（`--navy-light`：Day n / N、距離考試、今日 % + bar、下一步「由 #74 繼續」、繼續 / 進度表；全部完成「✓ 今日完成，明天再來」+「查看今日任務」；G16 完結卡 + 總結 + 建立新計劃 / 改目標）；`leaveToHome` / `startApp` render；`planHome.js` 入 late boot | feature | frontend-developer | mockup: mockups/study-plan-flow.html#step0 | 0.75 | T-323、T-315 | P0 |
| T-326 | `planWatchDay()`（G6：午夜 setTimeout + `visibilitychange`）、`ensurePlanToday` 觸發點（今日頁 / 主頁卡第一次打開，G9 snapshot）、`SCREEN_RERENDER` 加 day screen | feature | frontend-developer | none-required | 0.5 | T-323 | P0 |
| T-327 | i18n：`plan.task.*` / `plan.carry*` / `plan.kpi.*` / `plan.calendar.*` / `plan.examDay` / `plan.ended*` / 主頁卡 key | feature | frontend-developer | mockup: mockups/study-plan-flow.html#step3 | 0.75 | T-323–T-325 | P0 |
| T-328 | `plan-ui-test` 今日 / 月曆 / 主頁卡 + `plan-day-test`（`page.clock` 過午夜、返前台換日、HK → London `timezoneId`）；`lang-switch-test` day screen | test | frontend-developer | none-required | 1.25 | T-323–T-327 | P0 |

**PR5 驗收**：
- [ ] PR4 S-115：跨午夜後撳「更新進度表 / 建立進度表」失敗時 re-render 表單 + 提示（唔可以冇反應）；加跨午夜 clock UI test
- [ ] handoff §5「今日任務」（自動計完成度、練完當溫咗 G3、補做 G8、‹ › 轉日、已過補做 / 未到預覽）—— runner 未有，用 seed log 驗 UI
- [ ] handoff §5「月曆」：一個月一版、selector、已過淡化、考試日
- [ ] G6 換日、G9 清錯題第一次打開 snapshot、G14 開返時未做入補做、G16 考試日 / 完結
- [ ] 紅→綠色階全部用 token（arch §F.4）；UI-common

### PR6a · Runner：練題目 / 清錯題 / 重溫 / 完成卡（Phase 3）

| 任務編號 | 任務描述 | 類型 | 負責 Agent | Mockup Binding | 工作量 | 依賴 | 優先級 |
|---|---|---|---|---|---|---|---|
| T-329 | `planRun.js` `startPlanPractice`：plan side session（完全 `screenQuiz`）、每輪 ≤ 24、未答下一輪再出、最後一題「🔁 重做答錯的題目（尚餘 n 題）」、`renderRoundNote` plan 分支（arch §E.1）；practice / drill 兩類；**依 Q-A4**（Similar panel） | feature | frontend-developer | mockup: mockups/study-plan-flow.html#runner | 1.5 | T-311、T-323 | P0 |
| T-330 | 清錯題 runner（G9 snapshot 題目、答啱清錯題簿、空 = ✓ 沒有錯題） | feature | frontend-developer | mockup: mockups/study-plan-flow.html#runner | 0.5 | T-329 | P0 |
| T-331 | 重溫模式（G17）：`state.planReview`、`renderAnswerBox` 分支（✓ 正確答案 / ✗ 你答錯過）、`#roundRow` note、唔寫 storage（arch §E.4） | feature | frontend-developer | mockup: mockups/study-plan-flow.html#runner | 0.75 | T-329 | P0 |
| T-332 | 任務完成卡（`.result-card` class 砌，唔重用 `#screenResult`）：今日 %、小結、「重溫此項內容」/「開始下一項 →」、全部完成 🎉；`#screenPlanRun` 骨架 | feature | frontend-developer | mockup: mockups/study-plan-flow.html#runner | 0.5 | T-329 | P0 |
| T-333 | i18n：`plan.retryWrong` / `plan.review*` / `plan.done*` 等 | feature | frontend-developer | mockup: mockups/study-plan-flow.html#runner | 0.25 | T-329–T-332 | P0 |
| T-334 | `tests/plan-run-test.js`（第一部份）：答錯同日重出、>24 分輪、補做寫原本日子 + 今日 % 唔變（G8）、提早做、清錯題、重溫唔寫 storage、雙擊 guard；`lang-switch-test` plan side session | test | frontend-developer | none-required | 1 | T-329–T-333 | P0 |

**PR6a 驗收**：
- [ ] handoff §5「Runner 同 Practice mode 一模一樣（重用 component，唔複製 markup）」—— reviewer 檢查冇新答題 markup
- [ ] 答錯唔計、要答啱先算；同日做晒其他題之後重出（handoff §2.5）
- [ ] G5 歸屬（入口日子）、G8、G9、G17；UI-common；`similar-test` / `review-test` / `batch-test` 不變

### PR6b · Runner：讀知識點 / 重溫錯題知識點 / 模擬考（Phase 3）

| 任務編號 | 任務描述 | 類型 | 負責 Agent | Mockup Binding | 工作量 | 依賴 | 優先級 |
|---|---|---|---|---|---|---|---|
| T-335 | 讀知識點：`#screenPlanRun` `factCardHtml`（Study marks）+ n / m + `nav-row`；`factCard` 加 `opts.practise`（預設不變）；最後一條 →「練習這 n 題」開 `pair` task（G3：讀本身唔計） | feature | frontend-developer | mockup: mockups/study-plan-flow.html#runner | 1 | T-332 | P0 |
| T-336 | 重溫答錯題目的知識點：`similarPanelHtml(q, keys, cta)` 參數化（預設不變），anchor = 答錯嗰題（arch §E.3） | feature | frontend-developer | mockup: mockups/study-plan-flow.html#runner | 0.5 | T-335 | P0 |
| T-337 | 模擬考：`startPlanMock`、`#resultPlanRow`（合格「模擬考試任務完成」/ 唔合格 + 再考 Random Exam，G10 / G11）、`retryExam` plan context 用 `ALL_EXAM`；Leave 唔記（G15） | feature | frontend-developer | mockup: mockups/study-plan-flow.html#runner | 1 | T-310、T-332 | P0 |
| T-338 | i18n：讀 / Similar CTA / mock 結果 key | feature | frontend-developer | mockup: mockups/study-plan-flow.html#runner | 0.25 | T-335–T-337 | P0 |
| T-339 | `plan-run-test`（第二部份）：讀卡 + CTA、Similar CTA、mock 合格 / 唔合格 / Leave、`page.clock` 計時；`similar-test` / `factsession-test` / `examresult-test` 預設行為不變 | test | frontend-developer | none-required | 1 | T-335–T-338 | P0 |

**PR6b 驗收**：
- [ ] 計劃模擬考「再考」用 `EXAM_MODE`，唔用主頁 `pendingMode`（`retryExam()`；PR2 review 觀察）
- [ ] handoff §2.5 四類任務介面全部重用現有 component（`.fact`、`.sqm`、Exam mode 45 分鐘）
- [ ] G10 合格先完成、分數記低；G11 Random Exam；G15 計時中關開關 / Leave = 唔交卷
- [ ] 現有 Study / Similar / Exam 結果頁行為不變；UI-common

### PR7 · 中英對照確認（G35）→ PR8 · 打開入口 + 1.1.0（Phase 4）

> G35：PR7 只做用戶喺 UI 睇完中英對照後提出嘅字眼修改（T-340），要用戶確認冇問題先完成；T-341–T-343（開入口、1.1.0、刪 mockup、HANDOFF、tag）搬去 **PR8**。

| 任務編號 | 任務描述 | 類型 | 負責 Agent | Mockup Binding | 工作量 | 依賴 | 優先級 |
|---|---|---|---|---|---|---|---|
| T-340 | **Gate**：由 `locales/*.js` 抽晒 `plan.*` / 相關 key 出 zh-HK 書面語 ↔ en 對照表（G20 / G21），交用戶確認；用戶改嘅字回寫 locale | docs | project-manager（整理）+ frontend-developer（回寫） | mockup: mockups/study-plan-flow.html | 0.5 | PR6b merge | P0 |
| T-341 | `STUDY_PLAN_READY = true`、`APP_VERSION = '1.1.0'`、刪 `mockups/study-plan-flow.html`（G18）；HANDOFF（File 結構、LS keys、測試表、功能現況、版本記錄） | chore | frontend-developer | none-required | 0.5 | T-340 | P0 |
| T-342 | 全套 `run-all`、`upgrade-test`（1.0.0 → 1.1.0 SW 換 cache）、實機 QA（360 / 375 / 400px、iOS PWA、過午夜）、handoff §5 全清單逐項打勾 | test | quality-assurance | none-required | 1 | T-341 | P0 |
| T-343 | Merge 後 git tag `v1.1.0` | chore | devops-engineer | none-required | 0.1 | T-342 | P0 |

**PR7 驗收**：
- [ ] 改目標模式 ✕ 提示「仍可照樣建立」改配合「更新進度表」；俾用戶睇剩 1 / 2 個溫習日嘅排法（PR4 review Round 2）
- [ ] HANDOFF「data-action 慣例」加 PR3 新 `data-blur-action`（`focusout` delegation）同 toast component
- [ ] 用戶已確認對照表（T-340，PR 開之前）
- [ ] handoff §5 十項全部打勾；入口真用戶睇得到（預設開）
- [ ] `sw-test` cache 名 `lifeuk-v1.1.0`；mockup 已刪、冇其他 file 引用佢
- [ ] HANDOFF 已更新；PR description 有 Design Origin

---

## 風險登記

技術風險引用 arch §H.1 R1–R18（唔重抄）；下表只列 **對排期 / 交付有影響** 嘅 arch 風險 + PM 角度補充。

| 風險編號 | 風險描述 | 可能性 | 影響 | 應對方案 | 負責人 |
|---|---|---|---|---|---|
| arch R1 / R18 | 舊 shell + 新 js `ReferenceError` | 中 | 高 | PR1 T-307 late boot；PR2 T-313 `upgrade-test` ① | frontend-developer |
| arch R5 | `structure-test`（30 行 / token / 冇 CJK）返工 | 高 | 中 | Developer 開工前讀 HANDOFF；每個 PR 本地跑 `structure-test` 先開 PR | frontend-developer |
| arch R7 | 歸屬規則複雜，用戶覺得「做咗唔計」 | 中 | 高 | T-305 table-driven test；PR7 實機 QA 專門走 G2 / G5 / G8 情景 | frontend-developer / QA |
| arch R10 | zh-HK 書面語 + en ~130 key 返工 | 高 | 中 | 每個 UI PR 自帶 key；T-317 口語黑名單；T-340 一次過對照 | PM / frontend-developer |
| arch R14 | Runner PR 太大 | 高 | 中 | 已拆 PR6a / PR6b | PM |
| P-R1 | **Q-A7 同 G2「任何地方答啱都計」有張力**；答案遲到會令 PR2 hook 返工 | 中 | 中 | 列做開放問題，PR2 開工前要答案 | 用戶 / PM |
| P-R2 | 中間 PR 收埋嘅 code 長期喺 `main`（8 個 PR），期間有其他 hotfix / 功能改到 `quiz.js` / `result.js` 會 conflict | 中 | 中 | PR 逐個快 merge；每個 PR 開 branch 前 rebase 最新 `main`；其他改動盡量排喺 PR7 之後 | PM |
| P-R3 | 收埋入口令 QA 只可以靠 override 測，漏測「真入口」路徑 | 中 | 中 | PR7 T-342 用 `STUDY_PLAN_READY = true` 實機全流程；override 只用於 PR3–PR6b | QA |
| P-R4 | 對照表（~130 key）一次過俾用戶睇，review 疲勞 / 來回多 | 中 | 中 | T-340 按畫面分組（ⓘ / 目標 / 進度表 / 今日 / runner）+ 標出 mockup 原文 → 書面語改動；每個 UI PR description 預先附嗰批 key 草稿（唔要求用戶當時確認） | PM |
| P-R5 | 日期 / 時區 / 午夜測試 flaky（`page.clock`） | 中 | 中 | domain 收 `todayIso` 參數（唔靠 mock）；UI 時間測試固定 `setFixedTime` / `install` | frontend-developer |
| P-R6 | Mockup 有 spec 冇寫嘅元素（`🔥 連續 n 日 100%` pill、「連續 2 日落後建議調整」文案）引起 scope creep | 低 | 低 | 見假設 A6 / A7；其他 mockup 額外嘢一律要 PM 批 | PM |
| P-R7 | 調排程 tuning（G12 估算值）要用戶實際用過先知，PR7 之後可能要 patch | 中 | 低 | Tuning 全部集中 `plan.js` 頂常數；之後 1.1.x patch | PM |

---

## 依賴關係

### 內部依賴

```
PR1 (T-301→302→303→304 / 305→306→307→308)
 └─ PR2 (T-309, T-310, T-311 → T-312, T-313)
     └─ PR3 (T-314 → T-315, T-316 → T-317 → T-318)
         └─ PR4 (T-319 → T-320, T-321 → T-322)
             └─ PR5 (T-323 → T-324, T-325, T-326 → T-327 → T-328)
                 └─ PR6a (T-329 → T-330, T-331, T-332 → T-333 → T-334)
                     └─ PR6b (T-335 → T-336, T-337 → T-338 → T-339)
                         └─ PR7 (T-340 gate → T-341 → T-342 → T-343)
```

- PR1 / PR2 冇 UI，arch 話可以並行 review；但 PR2 code 依賴 PR1 service，所以 **PR2 branch 由 PR1 merge 後嘅 `main` 開**（HANDOFF 開發流程），review 可以重疊。
- PR3 起全部共用 `plan.css` / tokens，必須逐個 merge。

### 外部依賴

| 依賴項 | 類型 | 狀態 | 影響任務 |
|---|---|---|---|
| 用戶答 Q-A7 | 人員 | 待確認 | T-310、T-305（PR2 開工前） |
| 用戶答 Q-A1–Q-A6 | 人員 | 待確認（有 Architect 建議預設） | 見開放問題表「影響任務」 |
| 用戶確認 G20 對照表 | 人員 | 未開始 | T-340 → PR7 |
| `playwright-core` 1.56.1、Chromium、CJK 字體 | 工具 | 已確認（arch §0、HANDOFF 測試） | T-318 起所有 UI test |

---

## 工作量估算

單位：理想開發日（d）。Review + QA 每個 PR 估 0.5 d（PR7 QA 已計入 T-342）。冇 backend / DevOps 工作（除 tag）。

| PR | 範圍 | Task 數 | 前端（dev + test） | QA / Review | 總計 |
|---|---|---|---|---|---|
| PR1 | Domain + storage | 8 | 7.25 | 0.5 | 7.75 |
| PR2 | Hooks | 5 | 2.75 | 0.5 | 3.25 |
| PR3 | 開關 + 訂立目標 | 5 | 4.75 | 0.5 | 5.25 |
| PR4 | 進度表 + 改目標 / 重設 | 4 | 3.5 | 0.5 | 4 |
| PR5 | 今日任務 + 月曆 + 主頁卡 | 6 | 6.25 | 0.5 | 6.75 |
| PR6a | Runner：練題 / 清錯題 / 重溫 / 完成卡 | 6 | 4.5 | 0.5 | 5 |
| PR6b | Runner：讀 / Similar / 模擬考 | 5 | 3.75 | 0.5 | 4.25 |
| PR7 | 對照表 + 開入口 + 1.1.0 | 4 | 1.1（含 PM 0.5） | 1（T-342） | 2.1 |
| **總計** | | **43** | **33.85** | **4.5** | **≈ 38.4 d** |

> 另加 ~15% buffer（文案返工、`structure-test` 返工）≈ 44 d。Grill / review 來回唔計。

---

## 建議開始順序

```
Step 0 → 用戶答 Q-A7（必須）+ 確認 / 改 Q-A1–A6 建議（可以預設跟 Architect）
Step 1 → PR1 T-301 → T-302 → T-303（排程係所有嘢嘅基礎；plan-test 同步寫，TDD）
Step 2 → PR1 T-304 / T-305 / T-306 → T-307 → T-308 → review + QA → merge
Step 3 → PR2（hook 越早入 main 越早喺 upgrade-test / 現有 31 套驗證「冇計劃行為不變」）
Step 4 → PR3 → PR4 → PR5（畫面按用戶流程：建立 → 進度表 → 今日）
Step 5 → PR6a → PR6b（runner 要今日頁做入口）
Step 6 → T-340 對照表俾用戶 → 確認 → PR7 → QA → merge → tag v1.1.0
```

---

## 假設及前提

| # | 假設 |
|---|---|
| A1 | 規格以 grill G1–G21 為準，覆蓋 handoff §4 同 §3.3；技術設計以 arch 為準，本文件唔重複 |
| A2 | 中間 PR 唔改現有畫面外觀（`visual-diff ff3e4da` 0 diff）；有改就係 bug |
| A3 | PM 決定採用 arch R10 建議：`i18n-test` 加 `plan.*` zh-HK 口語字黑名單（T-317）。成本低、直接守 G21 |
| A4 | PM 決定 PR6 一開始拆 PR6a / PR6b（arch R14） |
| A5 | 「連續 2 日落後建議調整」唔做（handoff §4.8「先做補做」）；mockup `#carryAlert` 呢句文案實作時拎走 |
| A6 | Mockup `#step3`「每日完成度」標題旁 `🔥 連續 n 日 100%` pill 照 mockup 做（Design Origin 已確認、成本低、純由 `planDayCompletion` 計）；如用戶唔要，T-324 減 0.1 d |
| A7 | 中間 PR 唔升版本，即使加咗 SHELL file（G19 明確覆蓋 SemVer「新功能升 minor」直至 PR7） |
| A8 | 工作量係單一 frontend-developer 順序做；冇並行 lane（PR3 起共用 `plan.css`，並行 conflict 成本高過收益） |

---

## 開放問題（已全部解決）

用戶 2026-10-08 逐條確認，決定記錄喺 `2026-10-08_grill_study-plan.md` G22–G29。**同 Architect 建議唔同嘅兩條**：

| # | 用戶決定 | 影響 |
|---|---|---|
| Q-A7 | 唔計（G22，同建議） | T-310：Exam 唔寫 practice log |
| Q-A1 | 只可以提早做「讀 + 練」（G23，同建議） | — |
| Q-A2 | 當冇呢項（G24，同建議） | — |
| Q-A3 | 24 單位，合格先計（G25，同建議） | — |
| **Q-A4** | **顯示 Similar panel，但冇「▶ 練習這 n 題」掣**（G26，**改咗**） | T-329：plan side session 都 render Similar，CTA 收埋；`similarPanelHtml` CTA 參數化（arch §E 已有）|
| Q-A5 | 5 級色（G27，同建議） | — |
| **Q-A6** | **最少 7 個溫習日**（G28，**改咗**；建議係 3） | T-303 `PLAN_MIN_STUDY_DAYS = 7`；T-316 提示文案 |
| Q-P1 | 要（G29） | T-324 |
