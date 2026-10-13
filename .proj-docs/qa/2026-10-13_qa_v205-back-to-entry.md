# QA — 2026-10-13 — v2.0.5 做題中途返回原本入口（back-to-entry）

> **改號（2026-10-13，merge `main` v2.1.0 時）**：`main` 已用 W-071、S-254–S-256、CUI-0035–CUI-0039，所以本 branch 原 **W-071 / W-072 / W-073 → W-072 / W-073 / W-074**，**S-254–S-260 → S-257–S-263**（逐個 +3：S-254→S-257、S-255→S-258、S-256→S-259、S-257→S-260、S-258→S-261、S-259→S-262、S-260→S-263），ticket **CUI-0035 → CUI-0040**（`.tickets/pending/0001-0200/CUI-0040.md`）。已 push 嘅 commit message 保留舊號，對照以此為準。版本：原 v2.0.5 以 **v2.1.1** 發佈（`main` 已出 v2.1.0）；報告 / script / 截圖檔名嘅 `v203` / `v205` 照舊。下一個新號：C-007、W-075、S-264、CUI-0041。
> **merge 後行為變更**：48307d5 嘅 ‹ › glyph（上一題 / 下一題、quick 掣、計劃 上一條 / 下一條、日曆「返回今日」）已取消，跟 `main` v1.6.1「掣用 line icon，唔用 glyph」；header 返回字只有字，前面係 `chevronLeft` line icon；記憶法中途返回改用 `main` 嘅 C2「‹ 記憶法」（`setQuizBackMemo`）。下面 ‹ › 32/32 同「‹ ① 睇」係 48307d5 當時結果。

- **日期**：2026-10-13
- **測試員**：QA agent
- **範圍**：branch `fix/quiz/back-to-entry` @ **`48307d5`**（v2.0.5）。功能：題目頁 / 結果頁 header 返回掣中途返去 session 嘅入口（`.proj-docs/qa/quiz-entry-back-audit.html` #6–#9、#11；HANDOFF v2.0.5 行）+ review 之後 48307d5 嘅 ‹ › 箭咀（quiz「‹ Prev」/「Next ›」、quick ‹ ›、計劃知識點「‹ Prev」/「Next ›」、日曆 chip「‹ Back to today」；向前 CTA 保留 →）
- **Review 前置**：`.proj-docs/reviews/2026-10-13_review_v203-back-to-entry.md` pass 97
- **環境**：Linux，Node + playwright-core（`NODE_PATH=/opt/node-tools/node_modules`），Chromium headless（`/opt/pw-browsers/chromium`），repo 經 `tests/pages-server.js`（http + Pages Cache-Control）serve，`timezoneId: Europe/London`，每個組合全新 context + `localStorage` seed `lifeuk.uiLang` / `lifeuk.fontSize`。v2.0.2 對照 = `git archive c6b0806` 匯出去 scratch dir。冇真機
- **總結**：✅ **PASS**。`run-all.sh` **67 / 67**（`fontsize-test` 第一次已 PASS，唔使重跑）。QA script **690 / 691**：真 click matrix 320 / 390 / 1024 / 1280 × en / zh-HK × 細 / 大字 = 16 個 context × 6 個 flow **559 / 560**；scenario（語言切換 + 巢狀 Similar + edge E1–E9）**54 / 54**；‹ › 箭咀 **32 / 32**；cached-file 混合 **42 / 42**；截圖 **3 / 3**。唯一 fail = 320 英文大字計劃**練習題 task** header overflow 14px，**v2.0.2 已存在而且更差**（頁面 326px 要左右 scroll），v2.0.5 改善咗 → **CUI-0040** 🟢 Low，唔阻 merge。🔴 0、🟡 0

## Hard Gates

| Gate | 結果 | 證據 |
|------|------|------|
| Tests | ✅ pass | `run-all.sh` 67 / 67 PASS（包括 `back-to-entry-test`、`upgrade-test` ⑫、`fontsize-test`）；之後 `git checkout -- tests/shot-*.png`，`git status` 冇 png 改動 |
| Coverage | ✅ pass | 冇 coverage 工具；`back-to-entry-test`（390 / 1280 × 9 flow + 320）+ QA 真 click 16 context matrix + 9 個新 edge case（§4）補咗 test 只用 `evaluate` 捷徑、冇 1024 / 320 zh-HK / 大字、冇真 ⚙ 語言切換、冇 Retry / 全部取消標記 / 雙擊 / 鍵盤 / viewport 轉換嘅盲點 |
| Security | ✅ pass | 返回字經 `escapeHtml`；`aria-label` / `title` 用 `setAttribute`；冇用戶輸入入 header |
| Data integrity | ✅ pass | 記憶法 ② 測試中途返回（答咗 1 題 / 未答）`lifeuk.memoProgress` 完全唔變；重新入 ② 由 Q1 開始，做完照記錄一次；Similar 返回 `state.questions` 係原本同一個 object、同一題、同一 `examNum` |
| Performance | ✅ pass（N/A） | 只係 header 文字 / 一個 dispatch；冇新 loop / storage 讀寫 |
| No Critical | ✅ pass | 🔴 0 |

## 1. Regression suite

| 檢查 | 結果 |
|---|---|
| `cd tests && NODE_PATH=… CHROMIUM_PATH=… ./run-all.sh` @ 48307d5 | ✅ 67 / 67 PASS，exit 0（`fontsize-test FONTSIZE PASS`，冇 flake） |
| `git checkout -- tests/shot-*.png` 後 `git status` | ✅ 只剩 QA 檔 |

## 2. 真 click matrix（M）

Script：`.proj-docs/qa/scripts/2026-10-13_qa-v205-back-to-entry.js M`（`WIDTHS=320,390` 可以只跑部分）。導航全部用 click（Playwright `click`，每下之後等 450ms > `SCREEN_CHANGE_CLICK_GUARD_MS`）；只係讀 `state` 嚟知邊個選項啱 / 邊個 task 係 practice。Desktop（≥ 1024）冇底部 Prev / Next，用卡上 quick ›。

每個 context（16 個）行：

| Flow | 路徑（真 click） | 檢查 | 結果 |
|---|---|---|---|
| Home 入口 | 練習 › 容易 › 答 Q1 › Next | 🏠 icon、`aria-label` Home / 主頁 → Home | ✅ 16 / 16 |
| 考試 | 模擬考試 › Exam 1 › 🏠 | 確認框、仲喺題目頁；確認 → Home | ✅ 16 / 16 |
| #6 已標記 | 容易 › 🔖 Q1、Q2 › 🏠 › 已標記 tile › 開始練習 › 答 Q1 › Next | 「‹ Flagged」/「‹ 已標記」→ 已標記清單、focus `#flaggedStart`；做完 → 結果頁 header 同樣字 → 清單 | ✅ 16 / 16 |
| #7 溫習 | 溫習 › 章節 › Ch 3 › 第 3 張 ≥ 2 題卡 ▶ 練習 › 答 › Next | 「‹ Study」/「‹ 溫習」→ 溫習、同一張卡喺視窗內、唔再係 side session | ✅ 16 / 16 |
| #8 記憶法 | 🧠 › 第一組 › ② 測試 › 答 Q1 › Next | 「‹ ① Look」/「‹ ① 睇」→ 組頁 step `look`、`memoProgress` 不變、focus 唔喺 `<body>` | ✅ 16 / 16 |
| #9 Similar | 容易 › 一路答到有「練習呢 N 題」嘅題（desktop 先撳「相似題目」tab）› 練習 | 「‹ Q{n}」/「‹ 第 {n} 題」、`aria-label` = `title` =「Back to Q{n}」/「返回第 {n} 題」→ 原 session 同一題、同一 `state.questions`、🏠 返嚟 | ✅ 16 / 16 |
| #11 計劃知識點 | 建立溫習計劃 › 建立 › 查看今日任務 › 閱讀 task › Next › ▶ 練習 | 「‹ Back to the fact」/「‹ 返回知識點」→ `screenPlanRun` 同一 `pos`、focus 喺 ▶ 練習 | ✅ 16 / 16 |
| 計劃練習 task | 今日任務 › 練習題 task | 「‹ Today's tasks」/「‹ 今日任務」→ `screenPlanDay` | ✅ 16 / 16 |
| 每一步版面 | 每個題目 / 結果 / 返回落點 | `documentElement.scrollWidth <= innerWidth`、`.quiz-header` 冇 overflow、返回掣完全喺視窗、文字掣冇截字、header 冇 raw i18n key | 79 / 80（見下） |
| Console | 成個 context | 冇 page error、冇 `[i18n] missing key`、冇 `no handler` | ✅ 16 / 16 |

**唯一 fail（M-320-en-large.pt）**：320 英文大字計劃練習題 task 題目頁 `.quiz-header` `scrollWidth` 302 > `clientWidth` 288；「Practice」badge 右邊去到 x = 318（viewport 320），頁面**冇**左右 scroll。v2.0.2 同畫面：`← Today's tasks` 闊 8px，header 310、**頁面 326 要左右 scroll**。即係 pre-existing，v2.0.5 換「‹」改善咗但未完全解決 → **CUI-0040** 🟢 Low。zh-HK 大字 288 / 288 啱啱好；`‹ Back to the fact`、`‹ Q{n}`（兩位數）320 英文大字都 fit。

## 3. Scenario（S，390 + 1280）

| ID | 情況 | 結果 |
|---|---|---|
| S-lang | 溫習 side session 中途 ⚙ en → zh-HK：header 即刻變「‹ 溫習」，返回照去溫習 | ✅ ×2 |
| S-lang | 記憶法 ② 測試中途 zh-HK → en：「‹ ① Look」，返回 ① 睇 | ✅ ×2 |
| S-lang | Similar 中途 en → zh-HK：文字 + `aria-label` + `title` 一齊變，返回原題 | ✅ ×2 |
| S-lang | 已標記結果頁 zh-HK → en：「‹ Flagged」 | ✅ ×2 |
| S-lang | 計劃知識點練習 en → zh-HK：「‹ 返回知識點」 | ✅ ×2 |
| nest | 已標記練習入面開 Similar：「‹ Q1」→ 返已標記 session 同一題（「‹ Flagged」）→ 再返 → 已標記清單 | ✅ ×2 |

## 4. 新 edge case（主動補測）

| ID | Given / When / Then | 結果 |
|---|---|---|
| E1 | Similar（喺已標記入面）**快速雙擊**返回（guard 內第二下）→ 只返一層（已標記 session，唔會一嘢跳去清單） | ✅ ×2 |
| E2 | 已標記練習做完 › 結果頁「重做」→ 中途 header 仍然「‹ Flagged」→ 已標記清單 | ✅ ×2 |
| E3 | 已標記練習中途將**所有題取消標記** → 返回 → 已標記清單（空），冇 error | ✅ ×2 |
| E4 | 鍵盤：focus「‹ Study」撳 Enter → 溫習 | ✅ ×2 |
| E5 | 記憶法 ② 測試 Q1 **未答**即返回 → ① 睇、`memoProgress` 不變 | ✅ ×2 |
| E6 | 返回之後再入 ② 測試 → 由 Q1 重新開始；全部答完 ↩ → 照記錄（`memoProgress` 有變、step `result`） | ✅ ×2 |
| E7 | Similar 一路答到最後一題用 ↩ 返回（舊路）→ 原題，唔再係 side session | ✅ ×2 |
| E8 | Similar 中途 viewport 390 ↔ 1280 轉換 → header 字保持、版面 fit | ✅ ×2 |
| E9 | 計劃閱讀 task **最後一張**知識點 ▶ 練習 → 返回 → 同一張卡，冇 error | ✅ ×2 |

## 5. ‹ › 箭咀（48307d5）

320 / 1280 × en / zh-HK × 大字：quiz「‹ Prev」/「Next ›」（「‹ 上一題」/「下一題 ›」）、quick「‹」/「›」、計劃知識點「‹ Prev」/「Next ›」（「‹ 上一條」/「下一條 ›」）、日曆 chip「‹ Back to today」/「‹ 返回今日」、向前 CTA 仍然 →（「Create →」「Build my plan →」「View today's tasks →」/「建立 →」…）；版面 fit、冇 page error — ✅ 32 / 32。

## 6. Cached-file 混合（U，upgrade-test ⑫ 延伸）

Current tree + **一個** v2.0.2（c6b0806）檔，http serve，390，真 click：

| 舊檔 | 已標記 header / 落點 | 溫習 header / 落點 | 計劃知識點 header / 落點 | error / dead action |
|---|---|---|---|---|
| `sideSession.js` | 🏠 / Home | 🏠 / Home | ‹ Back to the fact / PlanDay | 冇 |
| `actions.js` | 🏠 / Home | 🏠 / Home | ‹ Back to the fact / PlanDay | 冇 |
| `planRun.js` | 🏠 / Home | 🏠 / Home | ‹ Today's tasks / PlanDay | 冇 |
| `result.js` | ‹ Flagged / 清單 | ‹ Study / 溫習 | ‹ Back to the fact / PlanRun | 冇 |
| `locales/en.js` | 🏠 / **清單** | 🏠 / **溫習** | ← Today's tasks / **PlanRun** | 冇 |
| `locales/zh-HK.js`（zh-HK UI） | ‹ Flagged（en fallback）/ 清單 | ‹ Study / 溫習 | ‹ Back to the fact / PlanRun | 冇 |

全部冇 raw key、冇 page error、冇 `no handler` — ✅ 42 / 42。觀察 O-1 見 §8。

## 7. 截圖

`.proj-docs/qa/screenshots/v205/`：`study-fact-{320-en-large,390-zh-HK-small,1280-en-small}.png`、`similar-q10plus-*.png`（Q10 / Q12 兩位數「‹ Q10」320 英文大字 fit）、`plan-last-fact-{390,1280}.png`。

## 8. 問題修正優先順序

| 優先 | Ticket | 問題 | 引入？ |
|---|---|---|---|
| 🟢 Low | **CUI-0040** | 320 英文大字計劃練習題 task header overflow 14px（badge 貼邊，頁面冇 scroll） | 否（v2.0.2 更差：頁面 326px） |

觀察（唔開 ticket）：

- **O-1**（設計取捨，W-072 已接受）：只係舊 `locales/en.js` cached、其他檔新嗰陣，header 顯示 🏠 /「← Today's tasks」，但撳落去去嘅係新落點（已標記清單 / 溫習 / 知識點卡）。字同落點唔一致，但冇 raw key、冇 error，SW 更新完就消失。
- **O-2**：zh-HK UI + 舊 `zh-HK.js` 時返回字用英文 fallback「‹ Flagged」（`t()` 落 en），唔係 🏠；可接受。
- **O-3**：已標記練習中途全部取消標記再返回，落已標記清單（空）冇 error（E3）；按 code，`#flaggedStart` 冇 client rect 又冇 list 掣時 `focusFlaggedEntry` 唔移 focus。罕見，記錄級。

## 9. 測試建議（下一步）

- `back-to-entry-test` 只用 `evaluate` 捷徑同 390 / 1280；可考慮加 1024 + zh-HK 大字一條 Similar label fit，同 E1（雙擊只返一層）、E2（Retry 保留「‹ Flagged」）
- CUI-0040 修完加 320 英文大字計劃練習 task header assertion

## Handoff receipt

```
HANDOFF_RECEIPT
protocol: 2
agent: quality-assurance
branch: fix/quiz/back-to-entry
commit_tested: 48307d5
status: pass
next_action: merge_main
hard_gates:
  tests: pass (run-all 67/67)
  coverage: pass (QA script 690/691; 9 new edge cases)
  security: pass
  data_integrity: pass
  performance: pass (N/A)
  no_critical: pass (0)
tickets: [CUI-0040 (Low, pre-existing, non-blocking)]
report: .proj-docs/qa/2026-10-13_qa_v205-back-to-entry.md
context: All entries #6/#7/#8/#9/#11 + plan task + Home/exam verified by real clicks at 320/390/1024/1280 × en/zh-HK × small/large; language switch, nested Similar-in-Flagged, cached-file mix pass. Only finding is a pre-existing 320 en-large plan practice header overflow (improved vs v2.0.2).
```
