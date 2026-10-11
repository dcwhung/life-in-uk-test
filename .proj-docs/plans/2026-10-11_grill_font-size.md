# Grill 結果：全域字型大小切換（細 / 大）

**日期**：2026-10-11
**Branch**：`claude/global-font-size-feature-c96ajp`
**Mockup**：`mockups/font-size-switch.html`（真 app 截圖，320 / 375px × en / zh-HK × 細字 / 大字修正前 / 大字修正後；確認後喺 PR-B 刪）
**狀態**：Q1–Q6 用戶已逐條確認（grill-me）；M1–M3（mockup）等用戶確認

---

## 決定總表

| # | 題目 | 決定 |
|---|---|---|
| Q1 | 「大 2pt」嘅單位 | 每級 **+2px**（唔用 pt，免 12.67px 呢類碎數）；default 細字 |
| Q2 | 放大範圍 | **所有字**一律 +2px：包括 ≥ 16px 標題、emoji、成績分數、SVG ring 文字、dots 號碼 |
| Q3 | 窄畫面爆版 | **Layout 跟住調**：逐個爆版位加 `[data-font-size="large"]` override，截圖測試鎖死 |
| Q4 | 切換入口 | Header 語言 pill 旁邊加 **A+ / A−** pill（任何 screen 都撳到，重用 `.lang-btn`） |
| Q5 | 設計確認 | 先整 mockup，確認後先寫 code；PR `Design Origin: mockup:` |
| Q6 | 交付 | 兩個 PR：**PR-A** token 化 refactor（v1.1.2，零視覺改動）→ **PR-B** 功能 + layout + 測試（v1.2.0） |

## 技術做法（codebase 查證，唔使問）

| 項目 | 做法 |
|---|---|
| 機制 | `<html data-font-size="large">` 下面 override 全部 `--fs-*` token（+2px）；純 CSS，唔使 re-render |
| Token 化（PR-A） | 現有 6 個 `--fs-*`（10–15px）+ 約 35 個寫死 px（10.5 / 12.5 / 13.5 / 16 / 17 / 19 / 20 / 22 / 24 / 26 / 42 / 52px、`--dot-fs`、`--plan-rest-emoji-size`）全部轉 token |
| 未設字號嘅 element | `body` 冇設 `font-size`（繼承 UA 16px），ⓘ / flag 等 button 用 UA 13.33px → PR-A 要加 root / control token，否則大字模式唔會放大 |
| 保存 | 新 key `lifeuk.fontSize`（`getLS` / `setLS`），冇記錄 = 細字；pattern 照 `UI_LANG_LS` |
| 防閃 | 最早載入嘅 script set attribute；SW 舊 cache `index.html` 要處理（`LATE_BOOT_*`） |
| 測試 | 新 `fontsize-test`（切換、保存、reload、320–400px 冇 horizontal scroll / 冇新溢出）；`sw-test` SHELL |

## Mockup 量度結果（大字 = 每個 element computed font-size +2px）

| # | 位置 | 問題 | 建議修正 |
|---|---|---|---|
| L1 | Header | 加 A+ pill 後 320px 標題斷兩行（細字都會） | ≤ 400px（兩個 size）：padding 20→12px、icon 36→30px、標題 nowrap |
| L2 | 各 screen 頂部 | 「← Home」「Change goal」掣入面斷行 | 大字：掣 nowrap，成排可 wrap |
| L3 | Plan 今日頂部 | 「‹ 今日任務 ›」擠到剩「Tod…」 | 大字：‹ 日期 › 搬第二行 |
| L4 | Plan 任務卡 | 文字欄太窄 | 大字：icon 40→32px、間距收細 |
| L5 | 進度表讀書次序 | 數字欄 112px 放唔落 115px | 大字：128px |
| L6 | 進度表頂部 | 三樣一行放唔落 | ≤ 400px 大字：收埋「SCHEDULE」label |

接受唔改：dots 圖例變 2 行、「QUESTION 1 OF 24」wrap、notes table 第一欄多行、日曆「🎯 Exam」凸出格（現有行為）、12 欄圓點（320px 照放得落）。
