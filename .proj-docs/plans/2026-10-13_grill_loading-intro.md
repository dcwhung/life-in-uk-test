# Loading page + 首次介紹 — grill 記錄（2026-10-13）

Mockup：`mockups/v2.2.0/intro-index.html`（入口）、`intro-a-classic.html`、`intro-b-cards.html`、`intro-c-interactive.html`；共用 `intro-shared.css` / `intro-shared.js`。狀態：**等用戶揀方案**。

| # | 問題 | 決定 |
|---|------|------|
| Q1 | Loading 幾時出、出幾耐 | 每次開 app 都出；真 loading，等 `startApp()` 完成先收，最短顯示 `--splash-min-ms` 800ms（mock 用 2400ms 方便睇） |
| Q2 | Loading 內容 | Logo + 名 + 隨機小貼士（只用確定事實：24 題 / 45 分鐘 / 18 題合格、四個地區、Magna Carta 1215、兩院、錯題提示） |
| Q3 | Intro 介紹邊啲功能 | 溫習 + 記憶法、練習、模擬考試、溫習計劃 + 廣東話翻譯 |
| Q4 | 4 組點分 3 頁 | P1 溫習；P2 練習 → 模擬考試；P3 溫習計劃 + 廣東話 + 離線 |
| Q5 | Intro 操作 | 第 1–2 頁有「略過」；第 3 頁揀語言（中文 / EN）+ 廣東話翻譯 switch；CTA「設定溫習計劃」/「直接開始」 |
| Q6 | 重看介紹 | 放 header ⓘ info popover（`#infoPop`）入面 |
| Q7 | 三方案差異 | 視覺風格 + 互動都唔同（A 官方典雅 carousel / B 輕鬆疊卡 / C 互動 demo） |
| Q8 | 交付 | HTML mockup 放 `mockups/v2.2.0/`，繁中為主可切 EN，手機 / 電腦可切 |

## 實作 hook 點（揀咗方案之後 `/plan`）
- Splash：`index.html` `<body>` 後 static overlay（JS 未行已見到）；`js/main.js` `startApp()` 尾或 `onI18nBootFailure` 收起。
- Intro：`startApp()` `applyLanguage()` 之後檢查新 key `lifeuk.introSeen`（`getLS` / `setLS`，常數加入 `js/core/config.js`）。
- 新檔要入 `sw.js` SHELL；新 global 要 `typeof` guard（W-057）；`js/pwa/pwa.js` 只喺 `screenHome` active 先 reload，intro 開住時要考慮。
- `prefers-reduced-motion`、44px touch target、≥ 1024px `--desktop-scale`。

## 用戶選擇 + rev 2（2026-10-13）
揀咗 **方案 B**，`intro-b-cards.html` 改 rev 2：
- 「下一步」上面加返 dots（可撳）+ ‹ › 箭咀；卡片左右 swipe；頂部改「1 / 3」。
- 溫習卡：5 個溫習模式 tab（章節 / 時間線 / 地理 / 人物 / 記憶法）+ 知識卡難度星 + 書籤 flag。
- 練習 / 模擬考試卡：題目卡有難度星 + flag，選項 A / B / C / D；練習 📝 / 模擬考試 🎯 icon + ⏱ timer。文案唔提 17 份試卷，改提隨機試卷；「錯題」→「錯題重溫」。
- 溫習計劃卡：倒數、溫習策略、一週熱圖、今日任務、進度環 + 廣東話翻譯示範。文案「廣東話」→「廣東話翻譯」、「自動編排每日進度」→「製定溫習策略」、CTA →「製定溫習計劃」（共用文案，A / C 一齊改）。

## rev 3（2026-10-13）
- 書籤叫法 OK；換頁淨係留 dots（卡片照樣 swipe）。
- 插畫唔再打直排：每個元素獨立圓角、隨機細角度，位置由預設位隨機抽 + 偏移（避免疊字 / 出界）。
- 溫習：5 個模式 pill 散喺知識卡四圍；知識卡斜少少；記憶法只有 Lv1–Lv3。
- 練習：題目卡斜少少；練習、模擬考試、timer 三粒獨立 pill 散開。
- 溫習計劃：拎走「之後可以喺 ⚙ 設定隨時更改」。
- 文案角度：唔同人唔同溫法（了解背景 → 知識卡；操題 → 練習；操卷 → 模擬考試），再製定溫習策略，目標一次合格。
