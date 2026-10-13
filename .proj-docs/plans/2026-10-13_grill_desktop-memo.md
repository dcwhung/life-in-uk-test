# Grill：Desktop 記憶法（溫習模式 › 記憶法）layout

**日期**：2026-10-13
**狀態**：rev 5（見「第五輪決定」），等用戶確認同決定 P5、P6
**Mockup**：[`mockups/v2.0.0/desktop-memo.html`](../../mockups/v2.0.0/desktop-memo.html)（第 13 份 desktop mockup；rev 3 起亦包手機 390px）
**Branch**：`claude/quirky-newton-wdelbs`（由 `main` v2.0.2 `c6b0806` 開）

---

## 背景

v2.0.0 desktop layout 嘅 12 份 mockup 喺記憶法溫習（v1.6.0）merge 入嚟之前已經定案。所以記憶法係直接用 `baseline: Plan Run desktop 置中欄`（用戶 2026-10-12 決定，冇 mockup）去做（[`2026-10-12_handoff_desktop-layout.md`](2026-10-12_handoff_desktop-layout.md) §11），包括：

| 畫面 | v2.0.0 現狀 |
|---|---|
| Study 第 5 個 tab（清單） | 跟 Study A：左欄 tab 2 + 2 + 1，右欄卡片單欄 |
| `#screenMemo` ① 睇 | 置中欄（≤ 760 × 1.2px）：記憶鉤 → 筆記 panel（長就碌）→「記住咗，開始試」 |
| ② 試 | Quiz side session（mockup #8） |
| 結果 | 同一條置中欄：%、Lv1–4、要再睇嘅題目、再溫一次／下一組 |

今個 session 補返記憶法嘅 mockup。

## 決定

| # | 問題 | 用戶答案 |
|---|---|---|
| Q1 | 範圍 | 成個流程都包（清單 → ① 睇 → ② 試 → 結果），出 3 個方案 |
| Q2 | 方案方向 | A（置中欄現狀）／B（左右分欄）／C（全闊）方向啱；清單用卡片 **3 欄同 4 欄 grid** 做比較 |
| Q3 | 結果全對時加新字眼 | 可以：新 i18n key「全部答啱 🎉 記憶鉤再睇多次：」／「All correct 🎉 The memory hook once more:」 |

## Mockup 內容

- 每個 frame 都係 `<iframe srcdoc>`，入面係真 app 嘅 HTML（v2.0.2，Playwright 喺 1280 × 800 擷取，EN／中各一套）加 app CSS（`css/` 抄入，v2.0.2）。即係 app 自己嘅 `@media (min-width: 1024px)`、×1.2 token、`.is-fit` 一屏高，都係用 frame 真實大小（1024 × 768／1280 × 800）去計。
- 方案嘅 CSS（`LIST_CSS`／`OPTION_CSS`）全部放喺同一個 1024 breakpoint 入面；方案 B／C 嘅 DOM 搬動（`PLACE`）喺 frame 入面直接郁 app 嘅 markup。
- Mock bar 可以切換：語言（中／EN）、大字、翻譯、縮放、9 個畫面狀態（清單、① 睇 長／短／單題組、② 試、結果 唔合格／合格／全對／冇答題）。
- 模擬進度：3 組今日到期、6 組學緊、4 組已識，其餘未溫。

| 畫面 | 方案 |
|---|---|
| 清單 | **3 欄**／**4 欄** grid，同 A／B／C 無關；「今日要溫」banner 橫跨頂部，badge 放唔落就落組名下面，bar 貼卡底 |
| ① 睇、結果 | **A** 置中欄（現狀）／**B** 左 5/12（記憶鉤、成績卡、掣貼底）＋右 7/12（筆記／錯題 panel 成個畫面高）（建議）／**C** 全闊（組名同步驟一行、筆記全闊、單題組同錯題分 2 欄、掣靠右） |
| ② 試 | 沿用 Quiz #8，三個方案都一樣 |

## 驗證（mockup 本身）

用 Playwright 開 mockup，逐個 frame 量度：4 種組合（中／EN × 一般／大字）× 9 個狀態 × 1024／1280（每一輪都量過；rev 3 加單題組 A／B／C 同手機 390px：手機只查冇橫向 scroll，因為手機頁面本身會碌）。量度結果：

- 冇橫向 scroll；
- 成頁唔使碌（`scrollHeight ≤ clientHeight + 1`），只有 panel 會碌；
- panel 以外嘅掣全部喺畫面入面；
- 結果頁左欄唔使碌。

## 第一輪決定（用戶 2026-10-13）→ rev 1

Mockup 已經改做 rev 1，淨係保留定案嘅排法（3 欄、A、C 已經刪走）。

| 畫面 | 定案 |
|---|---|
| 清單 | **4 欄** grid；狀態 badge **永遠喺右上**（組名太長就喺自己嗰格換行，唔會推 badge 落去）；「今日要溫」banner 橫跨頂部；bar 貼卡底 |
| ① 睇 | **頂行**：‹ 記憶法 + 組名｜① 睇／② 試。**左 7/12**：記憶鉤 + 筆記 panel。**右 5/12**：**題組問題 panel**（新：呢組嘅題目，英文 + 廣東話，標題沿用 `memo.questions`「關聯 n 題」）。兩個 panel 一樣高，長就各自碌。「記住咗，開始試」靠右，對齊右欄 |
| ② 試 | OK，沿用 Quiz #8 |
| 結果 | **B 改**：頂行同 ① 睇一樣。**左 5/12**：成績卡（% + 結果字 + Lv1–4），再溫一次／下一組直排貼底。**右 7/12**：要再睇嘅題目；全對就顯示「全部答啱 🎉 記憶鉤再睇多次」+ 記憶鉤（Q3），冇答題就淨係顯示記憶鉤 |

## 第二輪決定（用戶 2026-10-13）→ rev 2

| 項目 | 定案 |
|---|---|
| 清單欄數 | **< 1280px 用 3 欄，≥ 1280px 用 4 欄**（badge 照舊永遠喺右上） |
| 記憶鉤 | 「💡 記憶鉤：」標題自己一行，內容喺下一行 |
| 單題組 | 每題加返編號（1.、2.…）+ **Ch · Exam · Q**（`common.chapterShort` + `common.questionRef`，S-057 每種語言都係英文；同一題喺幾份試卷出現用 `COPY_SEP`「 = 」連住，每個 ref nowrap，跟 `copiesRefText`） |
| 結果 | 要再睇嘅題目加編號 + Ch · Exam · Q |
| 題組問題 panel | 為咗一致，每題都加咗 Ch · Exam · Q（用戶冇要求，要確認） |

## 第三輪決定（用戶 2026-10-13）→ rev 3

| # | 決定 | rev 3 做法 |
|---|---|---|
| — | 題目編號同 Ch · Exam · Q 用系統 pill | 每題上面一行 pill：`.tag`「#1」+ `.tag`「📜 Ch 3」（`chapterPillHtml` 樣式；題目冇 fact `#n`，用 `common.chapterShort`）+ `.sqm-node`「E2·Q15」（`questionNodeHtml(keys)`：`similar.node`、copies 用 `COPY_SEP`「E1·Q8 = E11·Q9」、mastery 顏色 `.mastered` / `.weak`；padding 跟知識點卡「出現於」`.fact-src .sqm-node`）。用喺題組問題、結果錯題、單題組 |
| P1 | 題組問題 panel 唔顯示答案 | 拎走答案同 mock bar 開關 |
| P2 | 單題組要再 design（rev 2 太多字擠埋一齊） | 出 3 個方案：**A 卡片**（每題一張白卡，2 欄，pill → 題目 → 分隔線 →「💡 備註：」+ 注解）、**B 左右對照**（右邊題目清單、左邊揀中題目嘅注解；手機變每題撳開）、**C 單欄**（置中 912px，每題一個區塊，注解左邊金色線） |
| P3 | 題組問題要 Ch · Exam · Q，格式同系統統一 | 同上 pill |
| P4 | 記憶鉤分行手機都改 | `.memo-hook b { display: block }` 唔再限 desktop |
| P5 | 想睇手機成個 flow 先決定 | Mock bar 加「裝置：手機」：390px frame（高度跟內容），全部 9 個狀態；① 睇並排「而家」同「加題組問題」（筆記下面、掣上面，`<details>` 預設收埋） |

## 第四輪決定（用戶 2026-10-13）→ rev 4

| 項目 | 定案 | rev 4 做法 |
|---|---|---|
| P2 單題組 | **C 單欄** | 置中閱讀欄（760 × 1.2px），每題一個區塊：pill 行 → 題目 →「💡 備註：」+ 注解（左邊 4px `--gold-border` 線）；手機同樣。A／B 已刪 |
| 清單「今日要溫」 | **固定唔郁（PC + 手機）** | Desktop：banner 搬出卡片 `.fit-panel`，擺喺 panel 上面（`.mx-main` flex column），淨係卡片碌。手機：`position: sticky; top: var(--header-h)`，頁面碌時黐住 header 下面 |
| 手機清單 | **卡片 2 × 2（2 欄）** | `#studyContent` 2 欄 grid（badge 照舊右上） |
| 手機 ① 睇 | **掣永遠最底，中間 scroll panel 用盡高度** | `#screenMemo` 一屏高（`100dvh - header - main 上下 padding`），頂部 ‹ 記憶法 + 組名、步驟；記憶鉤 + 筆記（+ P5 題組問題）放入一個 panel 碌，上下淡出（`--bg`）；「記住咗，開始試」貼底 |
| 手機結果 | **「再溫一次」／「下一組」永遠最底，中間 scroll panel 用盡高度** | 同上：成績 + Lv + 錯題喺 panel 碌，兩粒掣貼底 |

## 第五輪決定（用戶 2026-10-13）→ rev 5

| 項目 | 用戶要求 | rev 5 做法 |
|---|---|---|
| 手機「今日要溫」 | 碌上去嘅時候同 header 留返空間 | `top: calc(var(--header-h) + var(--space-4))`；向上偏移嘅 `--bg` box-shadow 填住 header 同 banner 之間嘅空位，碌過嘅卡片唔會喺空位露出嚟 |
| 手機記憶鉤 | 要固定 | 記憶鉤擺喺 scroll panel 上面，唔跟筆記碌；淨係筆記（+ P5 題組問題）喺 panel 碌 |
| 手機 ② 試 | 上一題／下一題永遠置底，中間內容碌 | Quiz 畫面一屏高：頂部 🏠 + 組名；題號點、題目、選項、答案、相似題目入一個 panel 碌；`nav-row` 貼底 |
| 單題組 pill | 同有筆記嘅組唔 match | rev 4 喺灰色背景上將 `.tag` 改咗白底；rev 5 放返入白色卡（同題組問題、錯題一樣），pill 用返系統灰底。Desktop 張卡 760 × 1.2px 置中，「記住咗，開始試」對齊卡右邊 |
| Mockup | （截圖 logo 爛咗） | Header logo 改為 data URI 嵌入，mockup 唔再靠 `icons/icon.svg` 相對路徑 |

## 待用戶確認（rev 5）

| # | 問題 |
|---|---|
| P5 | 手機加唔加題組問題（喺筆記下面，`<details>` 預設收埋）？ |
| P6 | 手機 Quiz 一屏高（掣貼底）只改記憶法 ② 試，定所有練習／考試嘅 Quiz 都一齊改？（Quiz 係共用畫面） |

## 實作備忘（揀咗之後）

- Design Origin 會由 `baseline: Plan Run desktop 置中欄` 改做 `mockup: mockups/v2.0.0/desktop-memo.html`。
- 要更新 `tests/desktop-memo-test.js`：而家佢會檢查「置中欄 ≤ 912px」，要改做頂行 + 兩欄 + 開始掣對齊右欄。
- 用 `js/components/deskPlace.js` 搬 DOM（`setDesktopColumns`），< 1024px 要還原手機次序。
- 題組問題 panel 係新 render（`memo.js`）：用 `questionGroups(g.qkeys)`，同單題組 render 方法一樣；手機加唔加等 P5。
- 手機一屏高（rev 4）係新行為：`#screenMemo` 要喺 < 1024px 都用一屏高 + scroll panel（而家 `.is-fit` / `.fit-panel` 只限 desktop）；要加手機 test（390 × 844：成頁唔碌、掣喺畫面、panel 碌）。
- 「今日要溫」banner：desktop 要喺 `renderStudyMemo` 之外 render（唔再喺 `#studyContent` 入面），或者 JS 搬；手機 sticky 要避開 Flagged 嗰種 `--header-h` 做法撞位。
- 單題組 C：`memoSingleHtml` 改做區塊 + pill 行 + 備註標題。
- 清單 4 欄 grid 要更新 `tests/desktop-study-test.js`（記憶法 tab：badge 喺右上），同 `desktop-short-test`（1366 × 657、1280 × 720、1024 × 600）。
- 結果嘅錯題而家只記 `{ q, yue }`（`finishMemoTest`），要加埋 key 先出到 pill（`questionNodeHtml(keys)` 要 key 清單）。
- Pill 行用現有 helper：`chapterPillHtml` 嘅樣式（題目版冇 `#n`，可能要加一個 `questionChapterPillHtml`）、`questionNodeHtml`；冇新顏色 token。
- Q3 新 key 要加落 `locales/en.js`、`locales/zh-HK.js`（i18n parity test）。
