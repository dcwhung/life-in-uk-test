# Handoff：Desktop／平板橫版 layout 開發

**日期**：2026-10-12
**狀態**：12 份 mockup 全部定案（用戶 2026-10-12），待開發
**Design Origin**：`mockup: mockups/v2.0.0/desktop-*.html`（12 個檔，見 §3）
**Mockup branch**：`claude/gallant-wright-lxkrzg`（mockup 同 grill 文件只喺呢條 branch，未入 `main`；已 merge `main` v1.4.3 `930ab4a`）
**決定記錄**：[`2026-10-12_grill_desktop-layout.md`](2026-10-12_grill_desktop-layout.md)（Q1–Q11、每份 mockup 嘅定案細節、實作備忘）

> 下個 session 建議由 `/plan`（PM + Architect）開始：
> 1. 讀呢份 handoff 同 grill 文件。
> 2. 用 browser 打開 12 份 mockup（直接開 HTML 就得：佢哋自帶 app CSS，只 link `../../icons/icon.svg`）。
> 3. 先答 §9 嘅開放問題，再出 implementation plan。
> 4. 跟住用 `/feature` 開發（developer → reviewer → QA）。

---

## 1. 目標一句講

喺 PC／平板橫放（闊度 ≥ 1024px）用分欄 layout 用盡畫面，字同間距放大 1.2 倍。功能同手機版一樣；< 1024px 完全維持現狀。

---

## 2. 全局規則（grill 決定，必須跟）

| 項目 | 規格 |
|---|---|
| Breakpoint | `@media (min-width: 1024px)` 先用 desktop layout；< 1024px（手機、直放平板）唔郁 |
| 最闊 | 內容（header 內容 + main）最闊 1280px，再闊就置中 |
| 字體 | 所有 `--fs-*` ×1.2 |
| ⚙ 大字 | desktop 大字 = (基礎 + 2px) × 1.2，即係 `tokens.css` 大字值 ×1.2 |
| 間距／icon | 所有 `--space-*`、icon、header 高度、題號點上限都 ×1.2；寫死嘅 px（例如 modal 360px、popover 780px、dot 26px）喺 desktop 都要 ×1.2 |
| 一屏高 | 大部份畫面一屏高：長嘅內容放喺自己會碌嘅 panel，上下淡出（`can-up` / `can-down`） |
| 唔包 | 鍵盤快捷鍵、hover 專用新功能、直放平板 layout |
| PR | 一個 PR 做晒 12 個畫面（Q8） |

Mockup 嘅做法：每個 frame 用 `.app { --k: 1.2; --lg: 0px; --fs-x: calc((Npx + var(--lg)) * var(--k)) }`，大字用 `.app.large { --lg: 2px }`。實作可以照搬呢個公式去 `:root`（`@media (min-width: 1024px)`），亦可以直接寫兩套數值。

---

## 3. 12 個畫面嘅定案

詳細規格喺 grill 文件「Mockup 進度」表。每份 mockup 入面 `<style>` 嘅 option CSS（`.optA` / `.optB` / `.optC`）就係實作參考，`<script>` 入面嘅 fit 邏輯就係行為規格。

| # | 畫面 | Mockup | 定案 | 重點 |
|---|---|---|---|---|
| 1 | Home（未有 plan） | `desktop-home.html` | A rev 3 | 計劃卡橫向一行。左欄 5/12（sticky）：模式 + 說明 + 提示／重設。右欄 7/12：My Review + 練習分類 + 題組 |
| 2 | Plan Goal | `desktop-plan-goal.html` | A rev 2 | 左欄 7/12：問題卡。右欄 5/12（sticky）：時間夠唔夠 + 建立掣。預設 chip + 日期放得落先一行（fitRow） |
| 3 | Plan Schedule | `desktop-plan-schedule.html` | B rev 5 | 單欄全闊。階段 3 欄。溫習次序一行。每日任務左右 scroll（一日一欄、每 Week 一組），**開畫面自動碌到今日** |
| 4 | Home（有 plan） | `desktop-home-plan.html` | A rev 7 + Ring + 時間軸 | 深藍計劃卡：計劃名 · Day → 下一步 → 倒數時間軸 + 中間 ring + 右邊兩粒掣（同 ring 底對齊） |
| 5 | Plan Day | `desktop-plan-day.html` | A rev 4 | 左欄 5/12：ring、補做、日曆、整體進度。右欄任務 panel：最高同左欄一樣，長過就碌，有「↓ 仲有任務」 |
| 6 | Plan Run | `desktop-plan-run.html` | A rev 4 | 置中一欄（760px × 1.2），一屏高。知識點 + 記憶法喺 panel 碌，掣貼底 |
| 7 | Study | `desktop-study.html` | A rev 4 | 左欄 20%：搜尋、tab 2×2、chip、篩選掣貼底。右邊知識點卡 panel 碌 |
| 8 | Quiz（Practice） | `desktop-quiz.html` | A rev 12 | 頂部題號點 bar。左欄 7/12：題目 + 2×2 選項，唔使碌。右欄 5/12：「答案｜相似題目」柔和 tab |
| 9 | Quiz（Exam） | `desktop-exam.html` | C rev 3 | 冇頂部 bar。左欄 3/12：大計時器、題號點 6×4、數量，最後一題出「提交」。右欄同 Practice 規則 |
| 10 | Result | `desktop-result.html` | A rev 5 | 左欄 5/12 唔使碌：成績卡用盡難度表上面空間、🎯 大自己一行、掣入卡、空一行、難度表靠底。右欄 7/12：回顧 panel 碌 |
| 11 | Flagged | `desktop-flagged.html` | B | 練習掣橫跨頂部，清單 2 欄喺 panel 碌。Wrong Review 直接開練習，即係 #8 |
| 12 | 全局浮層 | `desktop-overlays.html` | A | ⚙ 喺 ⚙ 下面靠右彈出（420px × 1.2）、ⓘ 喺 ⓘ 下面靠左（560px × 1.2），箭嘴指住個掣。確認框最闊 360px × 1.2。Toast 底部置中。安裝提示首頁頂全闊 |

---

## 4. 功能／行為改動（唔止係 CSS）

| # | 改動 | 範圍 | 位置 |
|---|---|---|---|
| F1 | 計劃完結拎走「更改目標」掣，只留「建立新計劃」+「進度表」 | **手機 + desktop** | `js/screens/planHome.js` `planEndedHtml`；更新相關 test |
| F2 | Plan Day「整體進度」3 格用 subgrid 對齊（標題貼數字、說明貼底） | **手機 + desktop** | `css/screens/plan.css` `.plan-stats` / `.plan-stat` |
| F3 | Plan Schedule 每日任務：開畫面自動碌到今日（desktop 用 `scrollLeft`；手機維持直向） | desktop | `js/screens/planSchedule.js` |
| F4 | Quiz：題目卡 `.quick-nav`（← →）常駐，未答都顯示；冇底部上一題／下一題 | desktop | `js/screens/quiz.js` + CSS |
| F5 | Quiz 右欄「答案｜相似題目」tab：新 i18n key「答案／Answer」；Similar 卡頭搬入 tab（副標題 + `+n`） | desktop | `locales/*.js`、`js/screens/similarPanel.js` |
| F6 | Exam：右上 `#examTimer` 收埋（左欄大計時器係唯一時鐘）；左欄最後一題出「提交」掣（文字用現有 `quiz.submit`，開同一個確認框） | desktop | `js/screens/examTools.js` + markup |
| F7 | Home 計劃卡：今日完成度改 ring（沿用 `.plan-ring`，深藍底版）；新倒數時間軸（見 grill「實作備忘」） | desktop（手機維持 bar + 倒數字） | `js/screens/planHome.js` + CSS |
| F8 | Home A 左欄 sticky：大字 + 中文時左欄可能高過畫面，高過 viewport 就取消 sticky | desktop | CSS／JS |

---

## 5. 自動適配規則（mockup 已驗證，實作要做返）

「放唔落」嘅判斷一律係 `scrollHeight > clientHeight + 1`，逐步加 class，直到放得落為止。

| 畫面 | 規則 | Mockup 參考 |
|---|---|---|
| Plan Goal | 預設 chip + 日期：一行放唔落（任何 chip 被切）就兩行 | 現有 `js/components/fitRow.js` |
| Quiz／Exam | 題目卡同選項預設各半，按內容讓位。① `is-tight`（行高按內容）→ ② `is-compact`（padding 收細）→ ③ 最後先碌 | `desktop-quiz.html` |
| Result | 左欄唔使碌。① 分數細一級 + 難度表行距收窄 → ② 成績卡間距收窄 → ③ 🎯 同分數再細。一般字只去到 ①／②，1024 英文大字先用到 ③ | `desktop-result.html` `fitLeft()` |
| Plan Day | 右欄任務 panel 最高 = 左欄高度，長過就 panel 內碌 | `desktop-plan-day.html` |
| Study | 子分類 chip 先按字長換行，再 `flex: 1 1 auto` 撐滿每行 | `desktop-study.html` |
| 所有 panel | 上下淡出：`scrollTop > 1` 加 `can-up`；未到底加 `can-down` | 每份 mockup `afterRender()` |

建議抽一個共用 helper（例如 `fitSteps(el, ['is-compact', 'is-compact2'])`）。所有 fit 都要喺 render 尾、resize、轉語言／字體大小／翻譯之後再行。

**實作（review 修正輪，W-377／S-235／S-228／C-006）：**
- `js/components/fit.js`：`fitSteps(el, steps, { measure })`（S-229：Result 用 `measure` 一齊量分數卡）；`runRefits()` 有 `refitting` guard，fit 入面 render 再 call 唔會 nested（S-233）。
- `js/components/deskPlace.js`：搬 DOM 入欄嘅唯一做法。`deskRemember`（comment marker 記原位）／`deskFill`（已經喺位唔搬）／`deskRestore`；`setDesktopColumns(spec, on)`（Home、Plan Goal、Plan Day：box 建立一次後保留，< 1024 拎走）；`desktopRefit(screenId, fit)`（lazy register：第一次 render 先 `onRefit`，舊 cache 遲載 `fit.js` 都即時生效）；所有搬動經 `deskKeepFocus` 保住 keyboard focus（`focus({ preventScroll: true })`）。
- 幾時用邊種：桌面次序同 phone 唔同、或者元素按狀態轉欄（Quiz、Result、Home、Plan Goal、Plan Day）→ `deskPlace` 搬元素；phone 次序已經係桌面次序，只係要包一個 box（Study `.study-cols`、Flagged `.flagged-wrap`）→ 永久 wrapper，< 1024 用 `display: contents` 唔畫嘢。
- Result ④（C-006）：①–③ 之後仍然放唔落（1366 × 657、1280 × 720 大字、1024 × 600）→ 左欄 `.result-left-wrap.is-scroll`：卡片唔再裁、跟內容高，左欄變 `.fit-panel` 捲 + 淡出；Retry／Another 仍然喺卡入面（mockup rev 5），focus 時 `scroll-margin` 避開淡出。

---

## 6. 實作建議（俾 Architect 參考，未定）

- **CSS 結構**：跟現有慣例，每個 `css/screens/*.css` 尾加 `@media (min-width: 1024px)` block（好似而家 `@media (max-width: 480px)` 咁）。如果要開新 file（例如 `css/base/desktop.css`），要跟「加新 file 三步」：`index.html` 加 tag、`sw.js` `SHELL` 加 path、升 `APP_VERSION`。再加 `js/main.js` `LATE_BOOT_STYLES`，見 `HANDOFF.md`。
- **Token**：`css/base/tokens.css` 加 `@media (min-width: 1024px)` 嘅 `:root` 同 `:root[data-font-size="large"]` 兩套 ×1.2 值；寫死嘅 px 要逐個搵返出嚟。
- **Header**：內容最闊 1280px；高度 ×1.2；desktop 收埋 Exam `#examTimer`。
- **Popover**：`css/components/popover.css` 而家係 `--info-pop-max-w: 780px` 左右貼邊。desktop 改做定闊，貼住自己個掣；`js/components/popover.js` `pointArrowAt` 照用。
- **一屏高畫面**：`.screen` 用 `height: calc(100dvh - header)` + flex column，panel `min-height: 0; overflow-y: auto`。
- **Similar tab**（F5）會動 `similarPanel.js`。手機版維持而家咁上下排。

---

## 7. 測試

- 現有 390px Playwright test 唔使改（< 1024px 唔郁）。F1、F2 會影響手機版，相關 test 要跟住改。
- 新加 1024 × 768 同 1280 × 800 嘅 Playwright suite（加落 `tests/run-all.sh`）。每個畫面查以下各項：
  - 冇橫向 scroll；
  - 一屏高嘅畫面成頁唔使碌（只有 panel 碌）；
  - Result 左欄唔使碌；
  - Quiz 選項唔使碌（Exam 1 全部 24 題）；
  - Plan Schedule 打開時今日嗰欄喺畫面入面；
  - EN／中文 × 一般／大字 × 翻譯開／關。
- Mockup 嘅量度方法：每個 state 都量 `scrollHeight > clientHeight`、對齊差（`getBoundingClientRect`）、截圖。
- 建議存 1024／1280 截圖 baseline 入 `.proj-docs/design-baselines/`。

---

## 8. 流程

- Repo 慣例：`claude/*` branch → PR 入 `main`（merge commit），冇 `develop`。開發用 session 指定嘅 branch。
- PR description 一定要有：`Design Origin: mockup: mockups/v2.0.0/desktop-*.html`（Design-Source Binding Rule）。
- ~~實作完、用戶確認之後，跟以前慣例喺之後嘅 PR 刪走 mockup（溫習計劃 mockup 喺 PR8 刪，G18）~~ **用戶 2026-10-13 決定保留 `mockups/v2.0.0/`**（唔刪，作為 desktop 設計參考），已喺 `HANDOFF.md` file 結構記錄。
- Merge 之後更新 `HANDOFF.md`（版本記錄、file 結構、desktop 規則）。

---

## 9. 開放問題（開發前問用戶）

| # | 問題 | 背景 |
|---|---|---|
| O1 | 版本號用 v2.0.0 定 v1.5.0？ | Mockup 用 v2.0.0 命名，但 `HANDOFF.md` SemVer 規則講明 major 只用喺大改／唔兼容（例如 localStorage 要遷移）。呢次冇 data 改動，照規則應該係 minor |
| O2 | 一個 PR 太大，可唔可以分做幾個 commit 階段 review？ | Q8 定咗一個 PR。建議 PR 入面按「token／header → 各畫面 → 浮層 → test」分 commit |
| O3 | Mockup 幾時刪？ | 建議同 PR 一齊刪，或者 merge 後下一個 PR 刪。**已決定（2026-10-13）：保留，唔刪** |

---

## 10. 已知限制／備註

- Mockup 內容係 v1.4.0 render 出嚟，`main` 而家係 v1.4.3。v1.4.1 加咗翻譯 toast，v1.4.3 修咗 iOS overscroll，都唔影響 layout 決定。
- Mockup 嘅生成 script 放喺 session scratchpad，已經冇咗；mockup HTML 本身係完整、自足嘅檔案，就係設計來源。
- 0 題 Flagged：首頁「已標記」掣 0 題時係 disabled，只有喺 Flagged 頁取消晒最後一題先會見到空白提示。

---

## 11. Merge `main` v1.4.4–v1.6.0 入 v2.0.0（用戶 2026-10-12 決定）

`main` 喺 `930ab4a` 之後加咗 v1.4.4 Flagged sticky、v1.5.0 / v1.5.1 主頁計劃卡 ring、v1.6.0 記憶法溫習（Study 第 5 個 tab + `#screenMemo`）。整合規則：

| 項目 | ≥ 1024px（desktop） | < 1024px（手機） | 實作 |
|---|---|---|---|
| 主頁計劃卡 | F7（`desktop-home-plan.html`）：計劃名 · Day → 下一步 → 倒數時間軸 + ring + 兩粒掣；字眼跟 mockup：「繼續今日任務 →」（`plan.home.continueToday`）、全部做完「✓ 今日已完成，明日再來」（`plan.home.doneHtml`，因為 F7 ring 顯示 %，唔係 ✓） | v1.5.1 精簡卡：ring 喺標題 + 倒數旁邊（`.plan-home-head`、`.has-ring`）、「繼續 →」、做完「明日再來」 | `planHome.js`：手機 ring = `planHomeRingHtml` / `.plan-home-ring`（main 原樣）；F7 ring 改名 `planHomeDeskRingHtml` / `.plan-home-desk-ring`，兩個 ring 嘅 CSS 唔再撞（main 嘅 `.plan-home-ring circle { stroke-width: 7 }` 唔會落到 F7）。跨 1024 由 `home.js` 重畫張卡（`planCardDrawnForDesktop`，原有機制）。desktop `.plan-home-acts` 用返 `justify-content: flex-start`（唔跟 v1.5.0 手機嘅 flex-end） |
| Study tab | 2 + 2 + 1：保留 2 × 2，🧠 記憶法自己一行橫跨左欄全闊 | main 原樣：5 個 tab 一行（`grid-auto-flow: column`） | `css/screens/study.css`：`.study-rail .study-tabs { grid-auto-flow: row }` + `.study-tab[data-tab="memo"] { grid-column: 1 / -1 }`。記憶法 tab 冇篩選 chip（行收埋），chapter chip 跟 sub chip 規則 |
| 記憶法畫面 `#screenMemo` | **Design Origin: `mockup: mockups/v2.0.0/desktop-memo.html (rev 6)`**（v2.3.0；v2.0.0 係 `baseline: Plan Run desktop 置中欄（用戶 2026-10-12 決定，冇 mockup）`；決定 log `2026-10-13_grill_desktop-memo.md`）：一屏高（`.is-fit`）；頂行 ‹ 記憶法 + 組名｜① 睇／② 試；① 睇 左 7/12 記憶鈎 + 筆記 panel、右 5/12 題組問題 panel，「記住咗，開始試」對齊右欄；單題組 C 一張白卡置中（760px × `--desktop-scale`）；結果 B 左 5/12 成績卡 + 掣貼底、右 7/12 錯題／記憶鈎 panel；panel 各自碌、card 色淡出；字同間距 token ×1.2，寫死 px ×1.2 | v2.3.0：一屏高（`.is-fit-phone`，高度 ≥ 500px）：記憶鈎固定、筆記 + 題組問題（`<details>` 收埋）／成績 + 錯題喺一個 panel 碌，掣貼底 | `js/screens/memo.js`（`renderMemo` 按 layout 畫，`fitMemo` 跨 1024 重畫）、`css/screens/memo.css`、`css/components/fit.css`。由 Study 開組再 ‹ 返嚟：desktop 記住卡 panel 嘅位（`studyScrollTop` / `setStudyScroll`），手機照舊記頁面 scroll |
| Flagged | Flagged B（panel 碌）；v1.4.4 嘅 pinned block 喺 desktop 關咗：`.flagged-top` static、冇負 margin、`scroll-padding-top: auto`（ResizeObserver 照行，`--flagged-top-h` 冇人用） | v1.4.4 原樣：`.flagged-top` sticky | `css/screens/flagged.css` desktop block |
| 版本 | `APP_VERSION = '2.0.0'` | | |

測試：`desktop-home-test`（1023px 係 v1.5.1 卡、1024px 返 F7、F7 冇 head ring、做完字眼）、`desktop-study-test`（5 個 tab 2 + 2 + 1、tab 字放得落、記憶法 tab 1024 / 1280 × EN / 中 × 大字冇橫向 scroll）、新 `desktop-memo-test`（置中欄 ≤ 912px、一屏高、panel 碌 + 淡出、掣喺畫面、所有掣撳得到、‹ 返 Study 保留 panel 位、390px 照舊）、`desktop-short-test`（加 Study 記憶法 tab、記憶法睇 / 結果）、`desktop-result-test`（desktop Flagged pinned block 關咗）。Baseline：`.proj-docs/design-baselines/2026-10-12_desktop-{home-plan-merged,study-memo,memo-look,memo-result}-{1024,1280}.png`（中文大字；`home-plan-merged` = merge 後嘅 F7 卡，原有 `desktop-home-plan-*.png` 保留）。
