# Grill 結果：全域字型大小切換（細 / 大）

**日期**：2026-10-11
**Branch**：`claude/global-font-size-feature-c96ajp`
**Mockup**：`mockups/font-size-switch.html`（真 app 截圖，320 / 375px × en / zh-HK × 細字 / 大字修正前 / 大字修正後；確認後喺 PR-B 刪）
**狀態**：Q1–Q6 用戶已逐條確認（grill-me）；第一版 mockup 經用戶 review（M1–M3），追加 Q7–Q11、L4b、L5，全部已確認；用戶仲有 UI mock comment 未講

---

## 決定總表

| # | 題目 | 決定 |
|---|---|---|
| Q1 | 「大 2pt」嘅單位 | 每級 **+2px**（唔用 pt，免 12.67px 呢類碎數）；default 細字 |
| Q2 | 放大範圍 | **所有字**一律 +2px：包括 ≥ 16px 標題、emoji、成績分數、SVG ring 文字、dots 號碼 |
| Q3 | 窄畫面爆版 | **Layout 跟住調**：逐個爆版位加 `[data-font-size="large"]` override，截圖測試鎖死 |
| Q4 | 切換入口 | ~~Header 語言 pill 旁邊加 A+ / A− pill~~ → 由 M1 / Q7–Q10 取代：header 右上 ⚙ settings |
| Q5 | 設計確認 | 先整 mockup，確認後先寫 code；PR `Design Origin: mockup:` |
| Q6 | 交付 | 兩個 PR：**PR-A** token 化 refactor（v1.1.2，零視覺改動）→ **PR-B** 功能 + layout + 測試（v1.2.0）（範圍擴大咗，見 Q7–Q11；可能要再分，待定） |
| M1 | Header 入口 | `[中]` pill 換成一粒 **⚙ settings icon**，撳開 popover 設定語言、字型大小、學習計劃 on/off |
| Q7 | ⓘ popover | 保留 ⓘ，只做「關於」（簡介、版本、題數 badge）；學習計劃開關由 ⓘ 搬去 ⚙ |
| Q8 | ⚙ 控制項 | 語言 `[ EN \| 中文 ]` segmented；字型 `[ A \| A ]`（細 A / 大 A 示範）segmented；學習計劃照用現有 switch（關照彈 confirm modal，G15） |
| Q9 | ⚙ 形式 | 同 ⓘ 一樣嘅 popover：右上角彈出、箭咀指 ⚙，重用 `info-pop` 樣式同開閂邏輯，同時只開一個 |
| Q10 | 揀完之後 | **揀完即閂** popover |
| Q11 | Screen header icon 化 | 左右掣改 icon（細字大字都用）：7 粒 goHome「← Home」→ 🏠 SVG、Plan 今日「Schedule」→ 📅、進度表「Change goal」→ ✏️；Study pill「🏆 0 / 236 mastered」→「🏆 0 / 236」；保留 `aria-label` + `title`；中間 screen 名（SCHEDULE / STUDY / EXAM 1 / badge）保留文字；Plan runner「← 返去今日」唔郁 |
| M2 | Layout 修正 | L1 / L2 / L3 / L6 取消（⚙ + icon 化之後 320px 大字已經放得落，有截圖驗證）；保留 **L4b**、**L5** |
| M3 | 接受唔改 | 下面「接受唔改」5 項全部接受 |

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

| # | 位置 | 問題 | 結果 |
|---|---|---|---|
| L1 | Header | 加 A+ pill 後 320px 標題斷兩行 | **取消**：改 ⚙ 後 320px 大字一行放得落 |
| L2 | 各 screen 頂部 | 「← Home」「Change goal」掣入面斷行 | **取消**：Q11 icon 化解決 |
| L3 | Plan 今日頂部 | 「‹ 今日任務 ›」擠到剩「Tod…」 | **取消**：Q11 icon 化後完整顯示（細字嘅截斷都修埋） |
| L4b | Plan 任務卡 | 文字欄太窄 | **做**：大字時 icon 40→32px、「Start ›」搬去文字下面靠右 |
| L5 | 進度表讀書次序 | 數字欄 112px 放唔落 115px | **做**：大字 128px |
| L6 | 進度表頂部 | 三樣一行放唔落 | **取消**：Q11 icon 化解決 |

順手修嘅現有 bug：Study 英文細字 header（「← / Home」「📖 / STUDY」各斷兩行）、Plan 今日細字標題截斷「Today'…」——都係 Q11 icon 化解決。

接受唔改：dots 圖例變 2 行、「QUESTION 1 OF 24」wrap、notes table 第一欄多行、日曆「🎯 Exam」凸出格（現有行為）、12 欄圓點（320px 照放得落）。
