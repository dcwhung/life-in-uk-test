# 溫習計劃日程：已完成變綠（G43）

Design Origin: proposal: user-approved preview 2026-10-10 (scratchpad green/1-4)

## 要求（用戶 2026-10-10）

日程頁（`js/screens/planSchedule.js`）要一眼睇到邊啲已經做完：階段、溫習次序嘅步驟、今日。

## Design Proposal

用戶 2026-10-10 睇過 preview 批准（scratchpad `green/1-learn-done.png`、`2-learn-drill-done.png`、`3-all-done.png`、`4-two-ch-done.png`、`5-today-done-pill.png`；preview 用 DOM hack 做，只作參考）。以下「決定」就係批准嘅設計。

## 決定（G43）

1. **「三個階段」bar**（摺埋同展開）：階段內容 100% 完成 → 該段變綠，名前加「✓」（`aria-hidden`），後面加 visually-hidden「（已完成）」/「(done)」；展開時 bar 係 `aria-hidden`，所以策略框標題都加同一句 visually-hidden 文字。三隻綠（`tokens.css`）：
   - 讀 + 練 `--plan-done-learn` #1b4332，白字 11.1:1
   - 強化 `--plan-done-drill` = `--green` #2d6a4f，白字 6.4:1
   - 模擬考 `--plan-done-mock` = `--green-light` #52b788，深色字 `--plan-done-mock-text` = `--text` 6.0:1（白字只有 2.5:1）
2. **完成定義**（`js/domain/planProgress.js`，純函數）：
   - `planPhaseDone(plan, log, phase)`：讀 + 練 = 該階段所有閱讀任務嘅知識點 + 練習任務嘅題目都完成，**按內容唔按日期**（可以提早變綠）：知識點 = 某一日 log 有齊佢所有題目答啱（G3 / G4），🏆 已掌握嘅題任何日都計（G37，`planFactDoneEver`）；題目 = 任何一日答啱或 🏆（`planQidDoneEver`）。強化 / 模擬考：原本 = 該階段每一日 `planDayCompletion` 100%，**已由 W-049 用戶決定取代（見下）**：只計改目標後嘅日子，模擬考段睇最近一次模擬考有冇合格（休息日 phase 係 rest，唔計；清錯題跟 G24；最後輕鬆日屬模擬考階段，要做埋）。冇該階段嘅日子 = 永遠唔算完成。
   - `planChaptersDone(log, chs)`：該 chapter（Ch 1 + 2 一步）所有知識點 `planFactDoneEver`。
3. **「溫習次序」**：步驟完成 → 圓點 `.plan-ord-n.done` 綠（`--plan-done-step` = `--green`，白字 6.4:1），數字換「✓」；展開步驟同摺埋 stepper 都係。圓點本身照舊 `aria-hidden`；chapter 名照讀，後面加 visually-hidden「（已完成）」/「(done)」。
4. **日程列表今日 pill**：今日 100% → `.plan-pill.today-done` 實心綠（`--plan-done-today` = `--green`）白字「今日已完成」/「Done today」（`plan.status.todayDone`）；未到 100% 照舊「今日 n%」；已過日子 100% 照舊淺綠「✓ 已完成」。72px 日期欄一行放得落：en「Done today」喺較闊字體（Arial + 10%，代表 iPhone SF）要 ~74px，所以 en 呢粒 pill 左右 padding 用 `--space-1`（2px）；zh-HK 用返普通 4px（S-161）。
5. **主頁計劃卡 / 當日頁**：用自己嘅「n%」文字（`plan.status.pct`），唔係日程呢粒「今日 n%」pill，**唔改**。
6. 未升版（`STUDY_PLAN_READY=false`，計劃仍收埋，用 `?preview=plan`）。

### W-049 用戶決定（2026-10-10「只計做得到嘅日子」，review W-049）

原本強化 / 模擬考要該階段**每一日** 100%，但有兩類日子過咗就做唔返：凍結咗嘅改目標前日子（G7，`carryFrom` 之前，唔入補做）同過去嘅模擬考日（模擬考唔補做，G10 / G23）。用戶決定只計做得到嘅日子：

- **計得嘅日子**（`planCountableDays`）：該階段喺 `carryFrom`（最近一次改目標）當日或之後嘅日子；冇改過目標 = 全部；如果該階段全部日子都喺 `carryFrom` 之前（例如喺模擬考階段先改目標，冇新強化日），就照計晒全部（顯示當時做成點）。
- **強化**：每個計得嘅強化日 `planDayCompletion` 100%（補做計返嗰日）。
- **模擬考**（`planMockPhaseDone`）：①每個計得嘅模擬考日，模擬考以外嘅任務完成（`planMockDayRestDone`：清錯題未打開唔計重量 G24、已填就要清晒；輕鬆日嘅錯題知識點要做；補做計返嗰日），**而且** ②成個模擬考階段（所有模擬考日嘅 log，按日子 + 次序）**最近一次**模擬考合格（≥ 18/24，`planMockPassed`，G10）。所以過去唔合格或者冇做嘅模擬考日唔再擋住，但要喺最後一次唔合格之後再考合格先會變綠；一次都未考 = 未完成。輕鬆日（最後一個溫習日）嘅錯題知識點要嗰日先打開得，所以模擬考段實際上最早喺輕鬆日先變綠。
- **讀 + 練**不變：按內容，改目標前後答啱都計。

### Review 跟進（S-160 / S-161 / S-162 / S-163）

- S-160：`planDoneSets(log)` 一次過計已完成知識點 + 題目，`renderPlanSchedule` 每次 render 計一次，傳入 `planPhaseDone(plan, log, phase, doneSets)` / `planChaptersDone(log, chs, doneSets)`（唔傳就自己計）。
- S-161：zh-HK「今日已完成」用返普通 pill 嘅 4px 左右 padding；en「Done today」3px 喺較闊字體要 ~72px（冇位剩），所以 en 照用 2px（`html[lang="en"]`）。
- S-162：模擬考完成段用 navy 字（白字喺淺綠只有 2.5:1），同 preview 白字唔同 —— 只係通知用戶，冇改。
- S-163：加 test：改目標（`carryFrom`）前後、null log。

## 檔案

| 檔案 | 改動 |
|---|---|
| `js/domain/planProgress.js` | `planDoneSets`、`planFactDoneEver`、`planLearnContentDone`、`planCountableDays`、`planMockDayRestDone`、`planMockPhaseDone`、`planPhaseDone`、`planChaptersDone` |
| `js/screens/planSchedule.js` | `planPhasesDone`、`planDoneSrHtml`、`planOrderDotHtml`、`planTodayPillHtml`；`renderPlanPhaseBar` / `renderPlanStrategy` / `renderPlanOrder` 收 done 狀態 |
| `css/base/tokens.css` | `--plan-done-learn` / `-drill` / `-mock` / `-mock-text` / `-step` / `-today` |
| `css/screens/plan.css` | `.plan-bg-*.done`、`.plan-ord-n.done`、`.plan-pill.today-done`（日期欄內 2px 左右 padding） |
| `locales/en.js`、`locales/zh-HK.js` | `plan.status.todayDone`、`plan.schedule.doneSr` |
| `tests/plan-test.js` | `checkPhaseDoneLearn`、`checkPhaseDoneDrillMock`、`checkChaptersDone` |
| `tests/plan-done-green-test.js`、`tests/run-all.sh` | 新 suite |
| `tests/plan-schedule-test.js` | pill fit test 加「Done today」/「今日已完成」（一行、喺欄內、較闊字體） |

## 測試

- `tests/plan-test.js`（W-049 / S-160 / S-163）：第一次模擬考唔合格、之後合格 → 完成；冇做嘅模擬考日、之後合格 → 完成；最近一次唔合格 → 未完成；當日唔合格再考合格 → 完成；一次都未考 → 未完成；輕鬆日錯題知識點未做 / 模擬考日清錯題未清 → 未完成，補做清咗 → 完成；強化第 4 日改目標（3 個凍結未完成強化日）、之後強化日 100% → 完成，同一批日子冇 `carryFrom` → 未完成；讀 + 練改目標前後各答一半 → 完成；null log → 全部未完成、唔 throw；傳入 `planDoneSets` 結果一致。
- `tests/plan-test.js`：冇答 → 全部未完成；讀 + 練全部答啱 / 提早喺 Day 1 答晒 / 全部 🏆 → 完成；差一題 → 未完成；知識點題目分開兩日答唔算（G4），🏆 補齊就算；強化未打開（pending）→ 未完成、全部強化日 100% → 完成、一日未夠 → 未完成；模擬考每日合格（包括輕鬆日）→ 完成、輕鬆日錯題知識點未打開 / 一次都未考 → 未完成；冇該階段嘅日子 → 未完成；chapter：🏆 Ch 1 + 2 → 第 1 步完成、只有 Ch 1 唔算、Ch 5 全部答啱 → 完成、差一題 → 未完成。
- `tests/plan-done-green-test.js`：1 / 2 / 3 個階段完成（展開 + 摺埋）：class、「✓」（aria-hidden）、「(done)」、其他段不變、每隻綠對比 ≥ 4.5:1、三隻綠唔同而且由深到淺、淺綠用深色字、策略框標題 sr 文字；zh-HK「（已完成）」；溫習次序 2 步完成（展開 + 摺埋）：✓ / 數字、sr、白 ✓ 對比、chapter 名照讀；今日 pill：未夠 100% 不變、100%「Done today」實心綠白字（唔同 `.ok` 淺綠）、zh-HK「今日已完成」；320 / 390px en + zh-HK：冇 label 被切、冇橫向 scroll、pill 一行喺欄內；tokens 喺 `tokens.css`、`plan.css` 冇 raw hex。
