# 溫習計劃 PR8：正式推出（v1.1.0）

Design Origin: none-required — no new UI; entry flag flip + removal of the G31 preview.

## 範圍（G19、G35、G18、G42，用戶 2026-10-10）

1. 打開入口：`js/core/config.js` `STUDY_PLAN_READY = true`（G19）。ⓘ「功能」switch（預設開）同主頁計劃卡所有用戶都見到。
2. 拎走 `?preview=plan`（G31 → **G42**：正式推出時拎走）：
   - 刪 `isPlanPreviewOn` / `setPlanPreview`（`js/core/store.js`）、`applyPlanPreviewParam`（`js/screens/planHome.js`）同佢喺 `startApp()` 嘅 call（`js/main.js`）、`STUDY_PLAN_PREVIEW_LS` / `PLAN_PREVIEW_PARAM` / `PLAN_PREVIEW_ON` / `PLAN_PREVIEW_OFF`（`config.js`）。
   - `planEntryReady()` = `STUDY_PLAN_READY`。保留 function（唔 inline 個 constant）：佢係測試代表「入口收埋」（rollback）嘅 seam，`planVisible()` / `renderPlanSettings()` 照用。
   - 用戶機留低嘅 `lifeuk.studyPlanPreview`：**清走**。加入現有 `OBSOLETE_LS`（`js/core/utils.js` 每次載入第一次用 storage 時刪，同 v0.53 `reviewOrder` 一樣），唔使新 code；就算刪唔到都冇 code 讀，冇影響。
   - `?preview=plan` / `?preview=off`：**唔處理、唔清 URL**（最簡單；參數本身無效，唔寫任何 key）。
3. `APP_VERSION` 1.0.8 → **1.1.0**（SemVer minor，新功能）；SW cache `lifeuk-v1.1.0`。
4. 刪 `mockups/study-plan-flow.html`（G18）；`css/screens/plan.css`、`js/screens/planRun.js` 註解、plan / arch / handoff / grill 文件標明「PR8 已刪」。其他 mockup 保留。歷史 review / QA / session log / ticket 照原文（記錄，唔改）。
5. HANDOFF：v1.1.0 title、版本表 v1.1.0 行、新「溫習計劃（Study Plan，v1.1.0）」section（模組、LS key、記錄格式、toast / switch component、`data-blur-action`、G40 copy 表、入口開關、review ID 撞號）、LS key table 加計劃 key、Follow-up「溫習計劃」打勾。
6. Release notes：repo 冇 CHANGELOG、亦冇 app 內「what's new」/ 版本說明（grep 過），所以唔加。
7. **唔打 tag**：`v1.1.0` 等用戶批准 merge 之後先打（T-343）。

## 檔案

| 檔案 | 改動 |
|---|---|
| `js/core/config.js` | `APP_VERSION = '1.1.0'`；`STUDY_PLAN_READY = true`；刪 preview 常數；`OBSOLETE_LS` 加 `lifeuk.studyPlanPreview` |
| `js/core/store.js` | 刪 `isPlanPreviewOn` / `setPlanPreview` |
| `js/main.js` | 刪 `applyPlanPreviewParam()` call |
| `js/screens/planHome.js` | `planEntryReady()` = `STUDY_PLAN_READY`；刪 `applyPlanPreviewParam` |
| `mockups/study-plan-flow.html` | 刪 |
| `css/screens/plan.css`、`js/screens/planRun.js` | 註解：mockup 已刪 |
| `tests/plan-*-test.js`、`modal-test.js`、`lang-switch-test.js` | 唔再用 `?preview=plan` / `planEntryReady` override 開入口；「hidden」check 改為 override `planEntryReady()` 做 `false`（G19 rollback） |
| `tests/plan-ui-test.js` | `checkPreview` → `checkReleaseEntry`（見下） |
| `tests/plan-test.js` | `STUDY_PLAN_READY === true`；preview function 冇咗、key 喺 `OBSOLETE_LS` |
| `tests/upgrade-test.js` | CUI-0021 舊 shell（pre-PR3 / PR3 / PR4）唔再 seed preview key（入口本身開咗），assert 不變 |
| `tests/dup-test.js` | 唔再釘 `APP_VERSION === '1.0.8'`，改為 ≥ 1.0.8 |
| `HANDOFF.md`、`.proj-docs/plans/*study-plan.md` | 見上 |

## 測試

- `plan-ui-test` `checkReleaseEntry`：冇參數開 app → 建立卡 + ⓘ「功能」行（switch 開），冇寫 key；舊 `lifeuk.studyPlanPreview`（`true` / `false`）→ 卡照出、key 載入後被刪；`?preview=off`、`?preview=plan&x=1#top` → 卡照出、URL 原封不動、冇寫 key；`lifeuk.studyPlanEnabled = false` → 冇卡。
- `checkHidden`（plan-ui / schedule / day / run / run2）：override `planEntryReady()` 做 `false` → 冇卡、冇 ⓘ 行、各 screen 開唔到、冇寫 key。
- CUI-0021 `planShellReady` guard：`upgrade-test` 三個舊 shell 照舊冇卡、冇 page error。
- `sw-test`：cache 名跟 `APP_VERSION`（bump 測試）。
- 畫面截圖（`tests/shot-*.png`）：主頁而家有計劃卡、ⓘ 有「功能」行，所以重新生成嘅截圖會唔同；佢哋係輸出唔係 baseline（冇 test 比較），跑完 `git checkout -- 'tests/*.png'`。

## 未做 / 之後

- T-342 QA（實機 360 / 375 / 400px、iOS PWA、1.0.x → 1.1.0 SW 換 cache）、T-343 merge 後 tag `v1.1.0`。
