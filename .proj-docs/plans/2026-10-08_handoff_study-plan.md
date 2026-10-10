# Handoff：溫習計劃（Study Plan）開發

**日期**：2026-10-08
**狀態**：Mockup 已確認（用戶 2026-10-08），待開發
**Design Origin**：`mockup:mockups/study-plan-flow.html`（mockup 喺 PR8 / v1.1.0 已刪，G18；git 歷史 `732d6e7` 仲有）（PR [dcwhung/life-in-uk-test#51](https://github.com/dcwhung/life-in-uk-test/pull/51)、[#52](https://github.com/dcwhung/life-in-uk-test/pull/52)）
**Base**：`main` `63e87b5`（v0.72）
**來源 session log**：`.claude/session-logs/2026-10-08_16-11.md`

> 下個 session 建議由 `/plan`（PM + Architect）開始：讀呢份 handoff + 開 mockup（直接用 browser 開 `mockups/study-plan-flow.html`，佢 link 咗 app 嘅 `css/`），出 implementation plan（T-xxx task、分 PR），用戶確認後先 `/feature`。

---

## 1. 功能一句講

用戶訂考試日期同每日可用時間，app 排好每日要「讀知識點 + 練題目」嘅進度表；每日任務完成度由 system 根據用戶喺溫習／練習做咗嘅嘢自動計，主頁顯示今日進度。

---

## 2. 用戶已確認嘅規格（必須跟）

### 2.1 入口同開關

| 項目 | 規格 |
|---|---|
| 功能總開關 | Header ⓘ popover（`#infoPop`）加「功能」部份 →「🗓️ 溫習計劃」switch；**預設開** |
| 關咗 | 所有溫習計劃項目收埋：主頁計劃卡／建立卡、進度表、今日任務；計劃同進度**保留**。關要確認（app modal），開唔使確認，開返由原本進度繼續 |
| 主頁 · 未有計劃 | 「選擇模式」上面一張金色虛線卡「🗓️ 建立溫習計劃 · 建立 →」 |
| 主頁 · 有計劃 | 藍色卡（`--navy-light`）：`🗓️ 溫習計劃 · Day 8 / 21`、距離考試 n 日 + 日期、今日完成度 % + bar、下一步（「由 #74 繼續」）、「繼續今日任務 →」、「進度表」；全部完成 → 「✓ 今日完成，聽日再嚟」，掣改「睇今日任務」 |
| Icon | 🗓️（唔用有日子嘅 📅，避免當係考試日） |
| 練習／考試 icon | 跟 v0.71：練習 📝、模擬考試 🎯 |

### 2.2 訂立目標（建立計劃）

| 欄位 | 規格 |
|---|---|
| 考試日期 | chip：2 星期 / 3 星期 / 4 星期 / 個半月（14 / 21 / 28 / 42 日）；同一行靠右「或考試日期 [date]」；**最遠半年**、最近 7 日 |
| 每日最多時間 | slider 30–120 分鐘，每格 15 分鐘；刻度：30 分鐘、45 分鐘、1 小時、15 分、30 分、45 分、2 小時（1 小時之後唔再寫「1 小時」） |
| 休息日 | 星期日至六 chip（多選，紅色 active） |
| 程度（單選，用 `.mode-card`） | 🌱 一片空白（乜都未睇過、未溫過）／📝 做過下練習（睇過下、做過部份題目）／🎯 做過 Exam（試過做模擬考） |
| 時間夠唔夠 | 溫習日、可用時間、建議需要 + bar + ✓ 充裕 / △ 剛好 / ✕ 唔夠 + 建議 |
| CTA | 「建立進度表 →」 |

### 2.3 進度表

- **三階段**：讀 + 練 → 強化練習 → 模擬考（phase bar + 策略卡）
- **溫習次序**：Ch1–2 → Ch5 → Ch4 → Ch3 History（由易到難，History 最難記放最後）；卡上寫原因
- **每次溫習都要練習**：讀完一段知識點即刻練同一段嘅題目
- **每日任務 list**：獨立 scroll（最高約 60vh），一打開自動 scroll 到今日；WEEK 標題 sticky 兼蓋滿全闊；**已過日子淡化**，今日 + 將來正常；右邊 status pill（✓ 完成 / % 紅→綠 / 今日 n% / 休息）；每行可以㩒入該日
- 任務文字唔顯示分鐘；「未掌握」用文字（唔用 🏆）
- 考試日：琥珀色格紋底 + 🎯 + 日期 + 星期
- 「改目標」掣；最底「↺ 重設計劃」（`reset-btn`）= **刪除計劃同進度**，返去建立卡；練習記錄唔受影響；確認掣用「確定」

### 2.4 今日任務（任何一日都可以睇）

- Header 一行：`← 主頁 ｜ ‹ 今日任務 / Day n 任務（細字：14/10 三 · 7/21） › ｜ 進度表`
- 完成度圓環 + 階段 pill（已過 / 未到）+ n / m 項完成
- **唔使用戶剔**：完成度由 system 計；練完一段題目，對應知識點自動當溫咗
- 任務框：未開始 = 虛線；做緊 = 實線；完成 = 綠色（右邊「✓ 重溫 ›」）；補做 = 橙色框 + 「Day 5」tag
- 題目任務狀態：「✓ 答啱 n / m 題 · ✗ k」+ 紅 tag「k 題答錯，要答啱先計」
- 所有 progress bar / ring 用紅→綠（0% 紅 → 50% 橙 → 75% 黃綠 → 100% 綠）
- 前日未完成 → 自動加入今日「補做」+ 提示
- 已過日子可以補做；未到嘅日子可以預覽／提早做
- **完成度月曆**：一次一個月，`‹ 今日 ›` selector（只喺計劃覆蓋嘅月份之間行）；已過日子淡化；計劃以外日子淺灰數字；考試日格紋 + 數字下「🎯 考試日」；每格可以㩒入該日
- 整體進度：計劃進度、平均完成度、距離考試 + 三條綠色 bar（知識點已溫、題目已練、模擬考 ≥ 21/24）帶 %

### 2.5 做任務（runner）

| 任務 | 介面 |
|---|---|
| 讀知識點 | 溫習模式 `.fact` 卡（同 Study 一樣）+ `nav-row`（上一條／下一條），頂部 n / m 進度 |
| 重溫答錯題目嘅知識點 | Practice「相似題目」`.sqm` panel（核心知識、出現於（答錯嗰題 current）、legend、題目列表、▶ 練習這 n 題） |
| 練題目／清錯題 | **完全跟現有 Practice mode**：`nav-dots` + `dots-meta`、`q-card`、翻譯、`opt` 即時對錯、`answer-box`（廣東話翻譯 + 💡 備注）、`nav-row`；每輪最多 24 題（`PRACTICE_ROUND_MAX`）；未答可以㩒下一題 |
| 模擬考 | 現有 Exam mode（計時 45 分鐘） |

- **答錯唔計入完成度，要答啱先算**；答錯嘅題目**同一日內**、做晒其他題之後重出（「🔁 重做答錯嘅題目（尚餘 n 題）」），直至答啱
- 做完一項：Result 卡（今日完成度 %、小結）+「重溫呢項內容」+「開始下一項 →」；全部完成 → 🎉
- 已完成任務再入去 = **重溫模式**（✅ 呢項已完成 · 而家係重溫，唔會改變完成度），睇返原本內容同正確答案；答錯過嘅題目標「✗ 你答錯過」

---

## 3. 建議技術方向（Architect 確認）

### 3.1 Common component（用戶要求：全部用返）

| 用途 | 現有 component / 檔案 |
|---|---|
| 返回 / 標題列 | `.quiz-header` + `.back-btn` + `.quiz-label`（`layout.css` / `buttons.css`） |
| 選項 chip | `.chip-row` / `.chip.active`（`chips.css`） |
| 程度卡 | `.mode-card.selected`（`home.css`） |
| 答題 | `screenQuiz` 全套：`renderQuestion()` 嘅 `optionHtml`、`renderAnswerBox`、`navDotsHtml` / `dotsMetaHtml`（`quiz.js` / `examTools.js`） |
| 知識點卡 | `factCardHtml()`（`js/components/factCard.js`） |
| 相似題目 | `js/screens/similarPanel.js` |
| 結果卡 | `.result-card`（`results.css`） |
| 確認框 | `showConfirm()`（`js/components/modal.js`） |
| 重設掣 | `.reset-btn` |
| 箭咀掣 | `.quick-btn` |
| 綠 pill | `.study-progress` |
| 開關 | 新 component（mockup `.sp-switch`），放 `css/components/` |

新 CSS 建議放 `css/screens/plan.css`（新 screen），開關放 `css/components/switch.css`；mockup 入面 `sp-` class 係 preview 用，實作可以改名但要跟 `sw-coding-style-css` + design token（`--space-*` 等 v0.72 token）。

### 3.2 建議模組

| 檔案 | 內容 |
|---|---|
| `js/domain/plan.js` | 純函數：`buildPlan(goal)`（日曆、休息日、三階段分日、weighted chunk、次序 `[1, 2, 5, 4, 3]`）、可行性計算、每日任務、完成度計法 |
| `js/core/store.js` | 計劃讀寫（新 LS key） |
| `js/screens/plan*.js` | 建立計劃、進度表、今日任務、月曆 |
| `js/components/` | switch、紅→綠色階 helper |
| locales | `en.js` + `zh-HK.js` 新 key（`i18n-test` parity）；mockup 字眼係 zh-HK，en 要另外譯 |

Mockup 嘅排程算法（`buildPlan` / `chunkWeighted` / `splitStudyDays` / `learnItems` / `drillItems` / `pairedQuestions`）可以參考，但要改用真資料（見 4.1）。

### 3.3 建議 localStorage key（跟 `LS_PREFIX`）

| Key | 內容 |
|---|---|
| `lifeuk.studyPlanEnabled` | 功能開關（冇值 = 開） |
| `lifeuk.studyPlan` | 目標：`{ start, examDate, dailyMins, restDays, level, createdAt }` |
| `lifeuk.studyPlanProgress` | 每日每項任務進度：讀咗邊啲 fact、答啱 / 答錯咗邊啲題（per day） |

要加入 `config.js` LS 列表、`migrate-test` / `upgrade-test` 照顧舊 shell；`sw.js` `SHELL` 要加新檔（`sw-test` 會查）；`APP_VERSION` +0.01。

---

## 4. 未決定 / 開發時要同用戶確認

| # | 問題 | Mockup 做法 | 建議 |
|---|---|---|---|
| 4.1 | 知識點同題目點對應 | 按位置比例（`pairedQuestions`，示範用） | 用真關係：一段知識點嘅題目 = 呢啲 fact 嘅 `src` 題目（`FACT_BY_QKEY` / `factOf`） |
| 4.2 | 「溫咗知識點」點樣算 | 喺計劃 runner 㩒「下一條」先計 | 計劃 runner 讀過 + 對應題目練過；Study 模式 list 睇過係咪計，要用戶決定 |
| 4.3 | 喺原本 Practice / Study 做嘅嘢計唔計入今日 | Mockup 文案話「會計」，但冇實作 | `recordPracticeAnswer()` 加 hook 寫入當日進度 |
| 4.4 | 「清錯題」任務 | 示範 10 題 | 直接用 `wrongList`（`startWrongReview`），數量 = 當時錯題數，上限 24 |
| 4.5 | 模擬考任務完成 | 示範 | 用 `markExamCompleted()` / 結果分數判斷 |
| 4.6 | 程度對排程嘅影響 | `LEVELS` 係估算值（每條 fact / 每題分鐘、模擬考比例） | 保留做 constant，之後按實際使用調 |
| 4.7 | 「今日」 | Mockup 固定 Day 8 示範 | 用本機日期；跨日、改時區、改目標後點重排要定 |
| 4.8 | 落後處理 | 前日未完成自動入今日「補做」；連續 2 日落後建議調整（只係文案） | 先做「補做」，建議調整可以之後 |
| 4.9 | 重溫已完成題目 | 只顯示正確答案 + 「你答錯過」 | 實作可以記用戶當時揀咩 |
| 4.10 | mockup 去留 | 已 merge 入 `main` 做參考 | 按 HANDOFF 慣例，功能完成後刪 `mockups/study-plan-flow.html` |

---

## 5. 驗收清單（Definition of Done 參考）

- [ ] ⓘ 開關：預設開；關 → 主頁冇任何計劃項目、計劃畫面入唔到；開 → 原本進度
- [ ] 建立計劃：所有欄位、日期上下限、slider 刻度、可行性三種狀態
- [ ] 進度表：次序、三階段、scroll 到今日、sticky WEEK、已過淡化、重設 = 刪除
- [ ] 今日任務：自動計完成度、練完當溫咗、答錯唔計同日重做、補做、‹ › 轉日、已過補做 / 未到預覽
- [ ] Runner 同 Practice mode / Study / Similar / Result 一模一樣（重用 component，唔複製 markup）
- [ ] 月曆：一個月一版、selector、已過淡化、考試日
- [ ] en + zh-HK 文字齊（`i18n-test`），語言切換即時 re-render（`lang-switch-test`）
- [ ] 360 / 375 / 400px 冇打橫 scroll；`[hidden]` 唔被 component display 蓋過
- [ ] 新 test suite（plan 排程純函數 + UI 流程）、`run-all.sh` 加入；`sw-test` / `structure-test` / `upgrade-test` pass
- [ ] PR description 有 `Design Origin: mockup:mockups/study-plan-flow.html`
