# QA — 2026-10-13 — v2.2.1 back-to-entry（merge `main` v2.2.0 後）

- **日期**：2026-10-13
- **測試員**：QA agent
- **範圍**：branch `fix/quiz/back-to-entry` @ **`eec49cf`**（`APP_VERSION 2.2.1`，已包括 `origin/main` v2.2.0 `fb5cc7b` English memory notes）。題目 / 結果頁 header 返回掣返去 session 入口（#6 Flagged、#7 Study fact、#8 記憶法測試、#9 Similar、#11 計劃知識點、計劃練習 task、`#planRunBack`）；merge 後 UI：返回字 = `chevronLeft` line icon + 字（冇 glyph）、accessible name 包含可見字、`.quiz-meta .quiz-label` 靠右
- **Review 前置**：`.proj-docs/reviews/2026-10-13_review_v211-back-to-entry-merge.md` re-review pass 99（S-271）
- **環境**：Linux，Node + playwright-core 1.56.1，Chromium headless（`/opt/pw-browsers/chromium`），repo 經 `tests/pages-server.js` serve，`timezoneId: Europe/London`，每個組合全新 context + `localStorage` seed 語言 / 字體。冇真機
- **Script**：`.proj-docs/qa/scripts/2026-10-13_qa-v221-back-to-entry.js`（由 v2.0.5 script 改：新 label / icon / name 斷言、記憶法 v2.2.0 英文 notes、Day n、wrapped label、cached-file 加 `main` v2.2.0 檔、`U_TREE` 對照 `main`）
- **總結**：✅ **PASS**。`run-all.sh` **72 / 73 + `upgrade-test` 單獨重跑 PASS**（已知 timing flake）。QA script **941 / 949**：真 click matrix 16 context **706 / 706**；語言切換 **36 / 36**；巢狀 + edge E1–E12 **40 / 40**；Day n **20 / 20**；wrapped label **7 / 7**；cached-file 混合 **132 / 140**。8 個 fail 全部係混合 cache：6 個 `main` 樹一樣（舊有）→ **CUI-0045** 🟢；2 個（舊 `zh-HK.js` 令計劃返回掣 name 變英文）→ **CUI-0046** 🟢。🔴 0、🟡 0

## Hard Gates

| Gate | 結果 | 證據 |
|------|------|------|
| Tests | ✅ pass | `run-all.sh` 72 / 73，唯一 FAIL `upgrade-test`「current shell, locale missing: exactly one reload」（同時有 `git grep` 食 CPU）；單獨重跑 6 次 4 PASS，2 次 FAIL 喺另外兩個 timing assert（「i18n.js missing: exactly one reload」、「v1.4.0 i18n.js … starts in en + large」）——review 已記錄 `main` 都有同一 flake，非本 branch 引入。之後 `git checkout -- tests/shot-*.png` |
| Coverage | ✅ pass | 冇 coverage 工具；`back-to-entry-test` + 本 QA 真 click 16 context matrix + 12 個 edge case（§4，新加 E10–E12 + Day n + wrapped label） |
| Security | ✅ pass | 返回字 `escapeHtml(t(…))`；`aria-label` / `title` 用 `setAttribute`；冇用戶輸入入 header |
| Data integrity | ✅ pass | 記憶法測試中途返回（答咗 1 題 / 未答）`lifeuk.memoProgress` 不變；重新入測試由 Q1 開始，做完記錄一次；Similar 返回 `state.questions` 同一 object、同一題、同一 `examNum` |
| Performance | ✅ pass（N/A） | 只係 header 文字 / dispatch，冇新 loop / storage |
| No Critical | ✅ pass | 🔴 0 |

## 1. Regression suite

| 檢查 | 結果 |
|---|---|
| `cd tests && NODE_PATH=… CHROMIUM_PATH=… ./run-all.sh` @ eec49cf | 72 / 73 PASS（`back-to-entry-test`、`notes-en-test`、`memo-test`、`lang-switch-test`、`header-icons-test`、`control-icons-test`、`fontsize-test` 全 PASS）；`upgrade-test` flake |
| `upgrade-test` 單獨 | PASS（6 次中 4 次；fail 嘅都係 reload 次數 / 初始 size timing assert） |
| `git checkout -- tests/shot-*.png` 後 `git status` | 只剩 QA 檔 |

## 2. 真 click matrix（M）— 706 / 706

320 / 390 / 1024 / 1280 × en / zh-HK × small / large = 16 個 context，每個行 6 個 flow。導航全部 Playwright click（每下等 450ms > click guard）；只讀 `state` 揀啱嘅選項 / 搵 task index。Desktop 用卡上 quick ›。

| Flow | 檢查 | 結果 |
|---|---|---|
| Home 入口 | 練習 › 容易 › 答 › Next：header = `home` line icon、`aria-label` Home / 主頁、冇字 → Home | ✅ 16 / 16 |
| 考試 | Exam 1 › home icon → confirm 框、仲喺題目頁；確認 → Home | ✅ 16 / 16 |
| #6 已標記 | quiz header「Flagged」/「已標記」+ `chevronLeft`、`goBack` → 已標記清單、focus `#flaggedStart`；做完 → Result header 同字 → 清單、focus `#flaggedStart` | ✅ 16 / 16 |
| #7 溫習 | 「Study」/「溫習」→ 溫習、同一張卡喺視窗內、唔係 side session | ✅ 16 / 16 |
| #8 記憶法 | 「Memory」/「記憶法」（冇 `aria-label`，以字為名）→ 組頁 step `look`、`memoProgress` 不變、focus 唔喺 `<body>` | ✅ 16 / 16 |
| #8 v2.2.0 regression | 開組 / 返回後組頁：en = `#memoTitle` `lang=en` titleEn、hook `lang=en`、note `lang=en` 冇中文；zh-HK = `lang=zh-HK` 中文；測試入面答題 `#ansNote` `lang` = UI 語言 | ✅ 16 / 16 |
| #9 Similar | 「Q{n}」/「第 {n} 題」、`aria-label` = `title` =「Back to Q{n}」/「返回第 {n} 題」→ 原 session 同一題、同一 `state.questions`；之後 home icon 返嚟 | ✅ 16 / 16 |
| #11 計劃知識點 | `#planRunBack`「Back」/「返回」named「Back to today's tasks」/「返回今日任務」；▶ 練習 header「Back」/「返回」named「Back to the fact」/「返回知識點」→ `screenPlanRun` 同一 `pos`、focus ▶ 練習；`#planRunBack` → 當日 | ✅ 16 / 16 |
| 計劃練習 task | 「Back」/「返回」named「Back to today's tasks」/「返回今日任務」；label「Chapter 1」（zh-HK `common.chapterN` 亦係「Chapter {n}」）**一行、冇斷字**（答題前後）→ 當日、focus 喺該 task | ✅ 16 / 16 |
| 每一步版面 | 頁面冇左右 scroll、`.quiz-header` 冇 overflow、返回掣喺視窗內、返回字一行冇截、active screen 冇 raw i18n key；label 若 wrap 則每行右邊貼 label 右邊、距 badge ≤ 16px | ✅ |
| Console | 冇 page error、冇 `[i18n] missing key`、冇 `no handler` | ✅ 16 / 16 |

所有文字返回掣：`svg[data-icon-name=chevronLeft]` 1 個、字冇 `‹ › ← → ↩ 🏠`、accessible name（`aria-label`，冇就係字）包含可見字。320 en 大字記憶法 header label「🧠 UK festivals」wrap 兩行，兩行都貼右（見截圖 `memo-test-320-en-large.png`）。

## 3. Scenario（S，390 + 1280）— 76 / 76

| ID | 情況 | 結果 |
|---|---|---|
| S-lang | 溫習 side session 中 ⚙ en → zh-HK：即刻「溫習」，返回照去溫習 | ✅ ×2 |
| S-lang | 記憶法測試中 zh-HK → en：「Memory」，返回組頁，組頁以英文 render（titleEn / 英文 note，`lang=en`） | ✅ ×2 |
| S-lang | Similar 中 en → zh-HK：字 + `aria-label` + `title` 一齊變；返回原題 | ✅ ×2 |
| S-lang | 已標記 Result zh-HK → en：「Flagged」→ 清單 | ✅ ×2 |
| S-lang | 計劃知識點練習 en → zh-HK：「返回」/「返回知識點」→ 卡；`#planRunBack` zh-HK → en「Back」/「Back to today's tasks」；計劃練習 task en → zh-HK「返回」/「返回今日任務」、label 一行 → 當日 | ✅ ×2 |
| nest | 已標記練習入面開 Similar：「Q1」named「Back to Q1」→ 已標記 session 同一題（「Flagged」）→ 清單 | ✅ ×2 |

## 4. 新 edge case（主動補測）

| ID | Given / When / Then | 結果 |
|---|---|---|
| E1 | Flagged 入面 Similar 快速雙擊返回 → 只返一層，同一題 | ✅ ×2 |
| E2 | 已標記 Result「重做」→ 中途仍「Flagged」→ 清單 | ✅ ×2 |
| E3 | 已標記練習中途全部取消標記 → 返回 → 清單（空），冇 error | ✅ ×2 |
| E4 | 鍵盤 focus「Study」撳 Enter → 溫習 | ✅ ×2 |
| E5 | 記憶法測試 Q1 未答即返回 → 組頁、冇記錄 | ✅ ×2 |
| E6 | 再入測試由 Q1 開始；全部答完 → step `result`、有記錄 | ✅ ×2 |
| E7 | Similar 答到尾用 ↩ 返回 → 原題 | ✅ ×2 |
| E8 | Similar 中 viewport 390 ↔ 1280 → 字 + name 保持、版面 fit | ✅ ×2 |
| E9 | 計劃閱讀 task 最後一張 ▶ 練習 → 返回 → 同一張卡 | ✅ ×2 |
| **E10**（新） | en 記憶法測試做完 → result 畫面 `#memoTitle` 英文、`lang=en`（v2.2.0） | ✅ ×2 |
| **E11**（新） | 溫習知識點練習入面開 Similar：「Q{n}」→ 返回「Study」session → 再返回 → 溫習 | ✅ ×2 |
| **E12**（新） | 計劃練習 task 快速雙擊「Back」→ 只去當日（唔會跳 Home） | ✅ ×2 |
| **D**（新） | Clock 2026-10-13 建計劃，移到 10-14 reload，Schedule › Day 1（catch-up）練習 task：「Back」/「返回」named「Back to Day 1 tasks」/「返回 Day 1 任務」、label 一行 → 返回 Day 1（320 大字 + 1280 細字 × en / zh-HK） | ✅ 20 / 20 |
| **W**（新） | 320 大字 Similar：en「SIMILAR QUESTIONS」wrap 兩行、`text-align: right`、每行貼右、距 badge 8px；zh-HK「相似題目」一行貼 badge | ✅ 7 / 7 |

## 5. 截圖

`.proj-docs/qa/screenshots/v221-back-to-entry/`：`study-fact-*`、`memo-test-*`、`memo-look-after-back-*`、`plan-practice-*`（320 en 大字 / 390 zh-HK 細字 / 1280 en 細字）、`similar-label-320-{en,zh-HK}-large.png`。

## 6. Cached-file 混合（U）— 132 / 140

Current tree + **一個**舊檔（`c6b0806` v2.0.2，或 `fb5cc7b` `main` v2.2.0 = 實際升級前版本），390，真 click。格 = header 字（home = icon）→ 落點。

| 舊檔 | 已標記 | 溫習 | 記憶法測試 | 計劃知識點 | 問題 |
|---|---|---|---|---|---|
| v2.0.2 `sideSession.js` | home → Home | home → Home | home → Home | Back → PlanDay | 冇 |
| v2.0.2 `actions.js` | home → Home | home → Home | Memory → 組頁 | Back → PlanDay | 冇 |
| v2.0.2 `planRun.js` | home → Home | home → Home | home → 組頁 | Today's tasks → PlanDay | 冇 |
| v2.0.2 `result.js` | Flagged → 清單 | Study → 溫習 | Memory → 組頁 | Back → 卡 | 冇 |
| v2.0.2 `memo.js` | Flagged → 清單 | Study → 溫習 | **Study → 停喺題目頁** | Back → 卡 | ❌ ReferenceError `setQuizBackMemo` / `leaveMemoTest` → **CUI-0045 A**（`main` 樹同樣） |
| v2.0.2 `en.js` | home → 清單 | home → 溫習 | **「‹ Memory」+ chevron** → 組頁 | Back → 卡 | 雙箭咀 → **CUI-0045 B**（`main` 樹同樣） |
| v2.0.2 `zh-HK.js` | Flagged → 清單 | Study → 溫習 | **「‹ 記憶法」+ chevron** | 返回 / name **Back to the fact** | CUI-0045 B；name 英文 → **CUI-0046** |
| v2.2.0 `sideSession.js` / `actions.js` / `planRun.js` | home → Home | home → Home | Memory → 組頁 | Back / Today's tasks → PlanDay | 冇 |
| v2.2.0 `result.js` / `memo.js` | Flagged → 清單 | Study → 溫習 | Memory → 組頁 | Back → 卡 | 冇 |
| v2.2.0 `en.js` | home → 清單 | home → 溫習 | Memory → 組頁 | Back → 卡 | 冇（O-1） |
| v2.2.0 `zh-HK.js` | Flagged → 清單 | Study → 溫習 | 記憶法 → 組頁 | 返回 / name **Back to the fact**；`#planRunBack` name **Back to today's tasks** | → **CUI-0046** |

對照：`U_TREE=origin/main U_REFS=c6b0806 U_FILES=js/screens/memo.js,locales/en.js,locales/zh-HK.js` → `main` 樹同樣 4 個 fail（memo.js 停喺題目頁 + click timeout；舊 locale「‹ Memory」/「‹ 記憶法」雙箭咀），所以 CUI-0045 係舊有。CUI-0046 係本 branch 新 name key 引起（`main` 冇 `aria-label`），只限 zh-HK UI + 舊 `zh-HK.js` 過渡期。全部冇 raw key、冇 `no handler`。

## 7. 問題修正優先順序

| 優先 | Ticket | 問題 | 引入？ |
|---|---|---|---|
| 🟢 Low | **CUI-0045** | 混合 cache：v2.0.2 `memo.js` → 記憶法測試 header 返回 ReferenceError、冇反應；舊 locale「‹ Memory」雙箭咀 | 否（`main` v2.2.0 一樣） |
| 🟢 Low | **CUI-0046** | 舊 `zh-HK.js` cache：計劃「返回」掣 name 用英文 fallback，可見字唔喺 name（WCAG 2.5.3） | 係（過渡期，transient） |

觀察（唔開 ticket）：

- **O-1**（W-072 已接受，v2.0.5 QA 一樣）：只有舊 `en.js` 時 header 顯示 home icon，但撳落去去新落點（清單 / 溫習 / 卡）。
- **O-2**（已接受）：zh-HK UI + 舊 `zh-HK.js`：已標記 / 溫習返回字英文「Flagged」/「Study」（en fallback），name = 字，冇 Label in Name 問題。
- **ID 核對**：`git fetch origin` + grep 全部 remote branch：**W-083**（`origin/claude/charming-archimedes-hrh4wd` `review_v220.md` 同 `origin/claude/quirky-newton-wdelbs` 都用咗）、**S-271–S-274**（charming-archimedes）已用；佢哋寫「下一個新號 C-008、W-084、S-275、CUI-0045」。index 頂寫嘅 W-083 / S-272 唔可以用。本 QA 用 **CUI-0045、CUI-0046**（任何 ref 都冇呢兩個 ticket 檔）。**下一個新號：C-008、W-084、S-275、CUI-0047**。

## 8. 測試建議（下一步）

- `upgrade-test` 加 v2.0.2 `memo.js` 單檔混合 case（CUI-0045 修完）
- `back-to-entry-test` 可加 Day n（clock 移日）name 同 E12（計劃練習雙擊只返當日）
- `upgrade-test` flake（reload 次數 / 初始 size timing）值得獨立 ticket 處理，但 `main` 一樣，唔屬本 branch

## Handoff receipt

```
HANDOFF_RECEIPT
protocol: 2
agent: quality-assurance
branch: fix/quiz/back-to-entry
commit_tested: eec49cf
status: pass
next_action: merge_main
hard_gates:
  tests: pass (run-all 72/73 + upgrade-test rerun alone PASS; known timing flake, same on main)
  coverage: pass (QA script 941/949; 12 edge cases + Day n + wrapped label; all 8 fails are cached-file mixes ticketed Low)
  security: pass
  data_integrity: pass
  performance: pass (N/A)
  no_critical: pass (0)
tickets: [CUI-0045 (Low, pre-existing, same on main), CUI-0046 (Low, stale zh-HK.js transient a11y name)]
report: .proj-docs/qa/2026-10-13_qa_v221-back-to-entry.md
context: All entries #6/#7/#8/#9/#11 + plan practice task + #planRunBack + Home/exam verified by real clicks at 320/390/1024/1280 × en/zh-HK × small/large (706/706): chevronLeft line icon + words, no glyphs, names contain the visible words, landing screens + focus, no sideways scroll, back words and plan "Chapter n" on one line, wrapped labels right-aligned. Language switch, Similar-in-Flagged / Similar-in-Study, Day n names and v2.2.0 English memo notes pass. Next free IDs: C-008, W-084, S-275, CUI-0047 (W-083 / S-271–S-274 used on other remote branches).
```
