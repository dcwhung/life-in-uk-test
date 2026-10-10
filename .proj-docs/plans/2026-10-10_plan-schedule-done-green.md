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
   - `planPhaseDone(plan, log, phase)`：讀 + 練 = 該階段所有閱讀任務嘅知識點 + 練習任務嘅題目都完成，**按內容唔按日期**（可以提早變綠）：知識點 = 某一日 log 有齊佢所有題目答啱（G3 / G4），🏆 已掌握嘅題任何日都計（G37，`planFactDoneEver`）；題目 = 任何一日答啱或 🏆（`planQidDoneEver`）。強化 / 模擬考 = 該階段每一日 `planDayCompletion` 100%（休息日 phase 係 rest，唔計；清錯題跟 G24；最後輕鬆日屬模擬考階段，要做埋）。冇該階段嘅日子 = 永遠唔算完成。
   - `planChaptersDone(log, chs)`：該 chapter（Ch 1 + 2 一步）所有知識點 `planFactDoneEver`。
3. **「溫習次序」**：步驟完成 → 圓點 `.plan-ord-n.done` 綠（`--plan-done-step` = `--green`，白字 6.4:1），數字換「✓」；展開步驟同摺埋 stepper 都係。圓點本身照舊 `aria-hidden`；chapter 名照讀，後面加 visually-hidden「（已完成）」/「(done)」。
4. **日程列表今日 pill**：今日 100% → `.plan-pill.today-done` 實心綠（`--plan-done-today` = `--green`）白字「今日已完成」/「Done today」（`plan.status.todayDone`）；未到 100% 照舊「今日 n%」；已過日子 100% 照舊淺綠「✓ 已完成」。72px 日期欄一行放得落：en「Done today」喺較闊字體（Arial + 10%，代表 iPhone SF）要 ~74px，所以呢粒 pill 左右 padding 用 `--space-1`（2px）。
5. **主頁計劃卡 / 當日頁**：用自己嘅「n%」文字（`plan.status.pct`），唔係日程呢粒「今日 n%」pill，**唔改**。
6. 未升版（`STUDY_PLAN_READY=false`，計劃仍收埋，用 `?preview=plan`）。

## 檔案

| 檔案 | 改動 |
|---|---|
| `js/domain/planProgress.js` | `planFactDoneEver`、`planQidDoneEver`、`planLearnContentDone`、`planPhaseDone`、`planChaptersDone` |
| `js/screens/planSchedule.js` | `planPhasesDone`、`planDoneSrHtml`、`planOrderDotHtml`、`planTodayPillHtml`；`renderPlanPhaseBar` / `renderPlanStrategy` / `renderPlanOrder` 收 done 狀態 |
| `css/base/tokens.css` | `--plan-done-learn` / `-drill` / `-mock` / `-mock-text` / `-step` / `-today` |
| `css/screens/plan.css` | `.plan-bg-*.done`、`.plan-ord-n.done`、`.plan-pill.today-done`（日期欄內 2px 左右 padding） |
| `locales/en.js`、`locales/zh-HK.js` | `plan.status.todayDone`、`plan.schedule.doneSr` |
| `tests/plan-test.js` | `checkPhaseDoneLearn`、`checkPhaseDoneDrillMock`、`checkChaptersDone` |
| `tests/plan-done-green-test.js`、`tests/run-all.sh` | 新 suite |
| `tests/plan-schedule-test.js` | pill fit test 加「Done today」/「今日已完成」（一行、喺欄內、較闊字體） |

## 測試

- `tests/plan-test.js`：冇答 → 全部未完成；讀 + 練全部答啱 / 提早喺 Day 1 答晒 / 全部 🏆 → 完成；差一題 → 未完成；知識點題目分開兩日答唔算（G4），🏆 補齊就算；強化未打開（pending）→ 未完成、全部強化日 100% → 完成、一日未夠 → 未完成；模擬考每日合格（包括輕鬆日）→ 完成、一日冇合格 / 輕鬆日錯題知識點未打開 → 未完成；冇該階段嘅日子 → 未完成；chapter：🏆 Ch 1 + 2 → 第 1 步完成、只有 Ch 1 唔算、Ch 5 全部答啱 → 完成、差一題 → 未完成。
- `tests/plan-done-green-test.js`：1 / 2 / 3 個階段完成（展開 + 摺埋）：class、「✓」（aria-hidden）、「(done)」、其他段不變、每隻綠對比 ≥ 4.5:1、三隻綠唔同而且由深到淺、淺綠用深色字、策略框標題 sr 文字；zh-HK「（已完成）」；溫習次序 2 步完成（展開 + 摺埋）：✓ / 數字、sr、白 ✓ 對比、chapter 名照讀；今日 pill：未夠 100% 不變、100%「Done today」實心綠白字（唔同 `.ok` 淺綠）、zh-HK「今日已完成」；320 / 390px en + zh-HK：冇 label 被切、冇橫向 scroll、pill 一行喺欄內；tokens 喺 `tokens.css`、`plan.css` 冇 raw hex。
