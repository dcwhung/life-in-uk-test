# Grill：Desktop 記憶法（溫習模式 › 記憶法）layout

**日期**：2026-10-13
**狀態**：mockup 已出，等用戶揀方案
**Mockup**：[`mockups/v2.0.0/desktop-memo.html`](../../mockups/v2.0.0/desktop-memo.html)（第 13 份 desktop mockup）
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

用 Playwright 開 mockup，逐個 frame 量度：4 種組合（中／EN × 一般／大字）× 9 個狀態 × 每個方案 × 1024／1280。量度結果：

- 冇橫向 scroll；
- 成頁唔使碌（`scrollHeight ≤ clientHeight + 1`），只有 panel 會碌；
- panel 以外嘅掣全部喺畫面入面；
- B 嘅左欄唔使碌。

## 待用戶揀

| # | 問題 |
|---|---|
| P1 | 清單用 3 欄定 4 欄？ |
| P2 | ① 睇 + 結果用 A、B 定 C？要唔要改？ |

## 實作備忘（揀咗之後）

- Design Origin 會由 `baseline: Plan Run desktop 置中欄` 改做 `mockup: mockups/v2.0.0/desktop-memo.html`。
- 揀 B／C 要更新 `tests/desktop-memo-test.js`：而家佢會檢查「置中欄 ≤ 912px」。
- 揀 B 要用 `js/components/deskPlace.js` 搬 DOM（`setDesktopColumns`），< 1024px 要還原手機次序。
- 清單 grid 要更新 `tests/desktop-study-test.js`（記憶法 tab），同 `desktop-short-test`（1366 × 657、1280 × 720、1024 × 600）。
- Q3 新 key 要加落 `locales/en.js`、`locales/zh-HK.js`（i18n parity test）。
