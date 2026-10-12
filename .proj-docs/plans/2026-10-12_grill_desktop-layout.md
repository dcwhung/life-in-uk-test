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
| 4 | Home（有 plan） | `desktop-home-plan.html` | ✅ 定案 A（rev 7）+ Ring + 時間軸：計劃卡橫跨頂部；行次 = 計劃名 · Day n / N → 下一步（一行，放唔落先斷行）→ 倒數時間軸 + 中間 ring → 右邊兩粒掣（同 ring 底對齊）；下面同 Home A 一樣 |
| 5 | Plan Day | `desktop-plan-day.html` | ✅ 定案 A（rev 4）：頂部 🏠 ‹ 日子 › 📅；左欄（5/12）今日 ring + 階段 + 提示、補做提示、日曆、整體進度；右欄（7/12）任務 list，panel 最高同左欄一樣，長過就 panel 內碌（上下淡出 + 「↓ 仲有任務」）；冇任務嘅日子（休息／考試）嗰日張卡放右欄；整體進度 3 格 subgrid 對齊（標題、說明向下），手機版一齊改 |
| 6 | Plan Run | `desktop-plan-run.html` | ✅ 定案 A（rev 4）：置中閱讀欄（最闊 760px × 1.2）、成頁一屏高；知識點卡入面知識點 + 記憶法喺可碌 panel（底部淡出），「出現於」+ 練習掣喺卡底，提示 + 上一張／下一張貼畫面底；任務完成：結果卡填滿中間高度（內容置中），提示 + 下一個 + 兩粒掣貼底 |
| 7 | Study | `desktop-study.html` | ✅ 定案 A（rev 4）：一屏高；左欄 20%：搜尋、tab 2×2、章節／地區／人物 chip（跟字長換行 + 每行撐滿 `flex: 1 1 auto`）、數量，篩選掣（隱藏已掌握／只看書籤／只看戰爭）打直全闊貼左欄底；右欄知識點卡一欄，panel 自己碌（上下淡出）；左欄太長（1024px 大字人物 tab）時左欄自己碌 |
| 8 | Quiz（Practice） | `desktop-quiz.html` | 待揀（rev 12：desktop ← → 快捷掣常駐（未答都喺 Translate 旁）；rev 11：選項一律 2×2（未答都係）；右邊虛線框填滿高度；tab bar 同下面框一樣闊；rev 10：目標唔使碌：一樣高 → 2×2 → 每行按內容 → 收窄 padding → 最後先碌，所有測試狀態都唔使碌；rev 9：題目卡同選項預設各半、按內容自動讓位，選項置頂；rev 8：左欄冇底部上一題／下一題；rev 7：數量排 答啱·未答／答錯·已標記；rev 6：題號點 bar 分左右：24 粒一行｜數量 2×2；rev 5：S 柔和 tab；相似題目卡頭（icon／標題／副題／+n）搬入 tab，pane 由核心知識點開始，間距同答案一致；rev 4：輕身 tab 3 款（U 底線／F 文件夾／S 柔和）比較；長選項 2×2 都放唔落就左欄碌（用戶接受）；rev 3：右欄「答案｜相似題目」兩個 tab；rev 2：A 題號點 24 粒一行喺頂；左欄題目 + 選項放唔落就 2×2，再放唔落先 panel 碌） |
| 9 | Quiz（Exam） | — | 未做 |
| 10 | Result | — | 未做 |
| 11 | Flagged / Wrong Review | — | 未做 |
| 12 | 全局浮層（Modal / Toast / popover） | — | 未做 |

## 實作備忘

- **Quiz desktop（≥ 1024px，用戶 2026-10-12）**：左欄冇底部上一題／下一題；題目卡右上 `.quick-nav`（← →）常駐，未答時都同 Translate 並排（手機版維持而家：答咗先出現）。右欄「答案｜相似題目」tab 用新 i18n key（答案 / Answer）。

- **Plan Day「整體進度」3 格對齊（用戶 2026-10-12，所有闊度包括手機）**：`css/screens/plan.css` `.plan-stats` 用 subgrid（`grid-template-rows: auto auto auto` + `.plan-stat { grid-row: span 3; grid-template-rows: subgrid }`），標題／數字／說明各自同一條線；標題同說明 `align-self: end`（rev 4：標題貼住數字、說明貼底）。`.plan-stats` 亦用喺 Plan Goal「時間是否足夠？」：實作時要確認嗰度（desktop 右欄 2 + 1 排法）唔受影響或者一齊對齊；冇 subgrid 嘅 browser 維持而家樣。

- **Home 計劃卡（desktop 新元素，用戶 2026-10-12 定案）**：
  - 今日完成度用 ring（沿用 Plan Day `.plan-ring` 樣式，深藍底版：track 白 18%、字白色；休息日 ring 位顯示 😴）。
  - 倒數時間軸：金色括號由今日到考試 + 大字剩餘日數；≤ 42 日一日一格（按階段上色：已過／今日實色、未到同色外框、休息日灰）；> 42 日每階段一段連續 bar（休息日併入）+ 月份刻度；括號少過 bar 28% 時數字靠右；bar 上面喺金線左邊寫「今日」。
  - 考試日、計劃完結唔顯示倒數同 ring。
  - 手機版（< 1024px）維持現狀（bar + 倒數文字），除非之後另外決定。

- **功能改動（用戶 2026-10-12）**：計劃完結（Home 計劃卡 ended 狀態）拎走「更改目標」掣，只留「建立新計劃」+「進度表」；改 `js/screens/planHome.js` `planEndedHtml`，手機版同 desktop 一齊生效，要更新相關 test。

- Plan Schedule 每日任務（橫向 scroll）：打開畫面時要自動碌到今日嗰欄（用戶 2026-10-12 要求；手機版而家係直向 scroll 去今日，desktop 改為 `scrollLeft`）。

- Home A 左欄 sticky：⚙ 大字 + 中文時左欄可能高過畫面，實作要處理（例如左欄高過 viewport 就取消 sticky）。
- PR description：`Design Origin: mockup: mockups/v2.0.0/desktop-*.html`。
- 要加 1024 / 1280px Playwright test 同 screenshot baseline；現有 390px test 唔使改。
