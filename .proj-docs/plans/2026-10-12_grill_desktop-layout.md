# v2.0.0 Desktop / Tablet 橫版 layout — grill 決定（2026-10-12）

目標：功能完全不變，喺 PC／平板橫放按畫面闊度用盡空間，字同間距放大。

## 決定

| # | 決定 | 結果 |
|---|---|---|
| Q1 | 排版方案 | B 分欄：token 放大，再逐個畫面改做分欄或者 grid（唔用 zoom） |
| Q2 | Breakpoint | ≥ 1024px 先用 desktop layout；< 1024px（手機、直放平板）維持 v1.4.0 |
| Q3 | 最闊 | 內容（header + main）最闊 1280px，再闊就置中 |
| Q4 | 字體 | ≥ 1024px 所有 `--fs-*` ×1.2 |
| Q5 | ⚙ 大字疊加 | 桌面大字 = (基礎 + 2px) × 1.2 |
| Q6 | 間距／icon | `--space-*`、icon、header 高度、題號點上限都 ×1.2 |
| Q7 | 第一份 mockup | Home |
| Q8 | PR | 12 份 mockup 全部 approve 之後先開一個 PR |
| Q9 | Mockup 形式 | 每份 2–3 個方案，每個方案有 1024 / 1280px frame |
| Q10 | 次序 | 跟 user flow（見下表） |
| Q11 | 語言 | Mockup 有 EN / 中文、翻譯開 / 關、⚙ 大字 toggle |
| — | Mockup 位置 | `mockups/v2.0.0/desktop-*.html` |
| — | 唔包 | 鍵盤快捷鍵、hover 專用新功能、直放平板 layout |

## Mockup 進度

| # | 畫面 | 檔案 | 狀態 |
|---|---|---|---|
| 1 | Home（未有 plan） | `desktop-home.html` | ✅ 定案 A（rev 3）：計劃卡橫向一行；左欄（5/12，sticky）選擇模式 + 模式說明 + 提示同重設；右欄（7/12）My Review + 練習分類 tabs + 題組 |
| 2 | Plan Goal | `desktop-plan-goal.html` | ✅ 定案 A（rev 2）：頂部 🏠／步驟／標題橫跨；左欄（7/12）3 張問題卡；右欄（5/12，sticky）「時間是否足夠？」+ 建立掣；預設 chip 同考試日期放得落就一行，放唔落（任何 chip 會被切）就兩行（fitRow 規則；1024px 兩行、1280px 一行） |
| 3 | Plan Schedule | `desktop-plan-schedule.html` | ✅ 定案 B（rev 5）：單欄全闊；三個階段說明 3 欄；溫習次序一行 1 › 2 › 3 › 4（標題／說明／bar subgrid 對齊；收起時顯示章節全名，Ch 1 + Ch 2 兩行、「+」凸出）；每日任務成個計劃左右 scroll（一日一欄 240px、每 Week 一組、標籤黐左、淡出 + ‹ › 掣、「Day n – 日期」一行置中、pill 行留位令任務同一條線開始、金色章節空一行貼底）；「查看今日任務」喺每日任務卡右下；重設自成一行 |
| 4 | Home（有 plan） | `desktop-home-plan.html` | 待揀（rev 3：A + Bar／Ring 比較；完結狀態拎走「更改目標」；rev 2：左邊計劃名 + 倒數 → 完成度 + bar → 下一步，右邊掣上下兩行） |
| 5 | Plan Day | — | 未做 |
| 6 | Plan Run | — | 未做 |
| 7 | Study | — | 未做 |
| 8 | Quiz（Practice） | — | 未做 |
| 9 | Quiz（Exam） | — | 未做 |
| 10 | Result | — | 未做 |
| 11 | Flagged / Wrong Review | — | 未做 |
| 12 | 全局浮層（Modal / Toast / popover） | — | 未做 |

## 實作備忘

- **功能改動（用戶 2026-10-12）**：計劃完結（Home 計劃卡 ended 狀態）拎走「更改目標」掣，只留「建立新計劃」+「進度表」；改 `js/screens/planHome.js` `planEndedHtml`，手機版同 desktop 一齊生效，要更新相關 test。

- Plan Schedule 每日任務（橫向 scroll）：打開畫面時要自動碌到今日嗰欄（用戶 2026-10-12 要求；手機版而家係直向 scroll 去今日，desktop 改為 `scrollLeft`）。

- Home A 左欄 sticky：⚙ 大字 + 中文時左欄可能高過畫面，實作要處理（例如左欄高過 viewport 就取消 sticky）。
- PR description：`Design Origin: mockup: mockups/v2.0.0/desktop-*.html`。
- 要加 1024 / 1280px Playwright test 同 screenshot baseline；現有 390px test 唔使改。
