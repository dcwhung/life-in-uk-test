# 溫習計劃 PR7b：相同文字題目合併（G40，v1.0.8）

Design Origin: proposal: user-approved preview 2026-10-09 (merged " = " source node)

## 問題

17 條知識點（多出 19 個 key）嘅 `src` 有不同試卷入面文字一樣嘅題（例如 #98 St George `['10.0', '7.15', '13.0']`，13.0 同 7.15 一樣）。之前：

- Study 卡「出現於」列 3 粒 node，「▶ 練習這 3 題」，`startFactPractice` 同一條問兩次
- 溫習計劃 runner 嘅掣已去重（2），但同一張卡仲列 3 粒 node
- Similar panel 兩個 copy 分開兩粒 node、兩張一樣嘅卡、「+2」、「練習這 2 題」
- 連勝（`streaks[k]`）逐個 copy 計，兩個 copy 會越走越遠

## 決定（G40，用戶 2026-10-09）

1. 列出知識點來源嘅地方將相同文字嘅 copy 合併成一粒 node，用「 = 」連（copy 按試卷次序）；答緊嗰題有 copy 就併入 current node（答 E13·Q1 → 「E13·Q1 = E7·Q16」）。Similar 列表每條不同題目一張卡（「Exam 7 · Q16 = Exam 13 · Q1」），「+N」同「練習這 N 題」都係不同題目數，session 每條只問一次。Study 卡預設 N 同 `startFactPractice` 一樣。計劃 runner 本身已去重，唔變。
2. 答任何一個 copy，所有 copy 寫同一個新連勝：答啱 = min(3, copy 之中最高 + 1)，答錯 = 0。唔 migrate；舊資料讀 copy 之中最高。
3. zh-HK「今日任務已全部完成！」、「{day} 任務已全部完成！」；en 不變。

## 範圍 / 檔案

| 檔案 | 改動 |
|---|---|
| `js/domain/questions.js` | 新 `QUESTION_COPIES`（`canon` / `copies`）、`canonQuestionKey`、`questionCopies`、`questionGroups`：copy 表嘅唯一來源（plan.js 之前載入） |
| `js/domain/plan.js` | 刪 `planBuildCanonKeys`；`PLAN_CANON_QKEY = QUESTION_COPIES.canon`、`planCanonKey` → `canonQuestionKey` |
| `js/domain/mastery.js` | `keyStreak`（copy 之中最高）；`streakOf` 用佢；`recordPracticeAnswer` 同步寫所有 copy |
| `js/domain/similar.js` | `similarGroups`（其他不同題目，每組 = copy）、`similarKeys` = 每組第一個、`currentCopies`（答緊嗰題排第一） |
| `js/components/tags.js` | `questionNodeHtml(keys)`（一組一粒）、`copiesNodeText` / `copiesRefText` |
| `js/components/factCard.js` | 來源行用 `questionGroups(f.src)`；預設 N = 不同題目數 |
| `js/screens/sideSession.js` | `startFactPractice` 每組問第一個 copy |
| `js/screens/similarPanel.js` | 收 groups：地圖、卡、「+N」、CTA |
| `js/screens/planRun.js` | 錯題知識點 panel 用 `similarGroups(anchor)`（CTA 題數照舊由計劃計） |
| `js/core/config.js` | `COPY_SEP = ' = '`；`APP_VERSION` 1.0.8（SW cache 跟版本） |
| `css/screens/quiz.css` | `.sqm-node` `white-space: nowrap`（合併 node 唔喺中間斷行；來源行本身已 nowrap） |
| `locales/zh-HK.js` | `plan.run.allDoneToday` / `allDoneDayHtml` 加「已」 |
| `tests/dup-test.js`（新，入 `run-all.sh`） | copy 表、連勝同步 + 舊資料讀最高、Study 卡合併 node + N + session、Similar panel（13.0 / 10.0 / 全部係 copy 嘅 #67）、獨立 panel（currentMark）、zh 字眼、版本 |
| `tests/factsession-test.js` | #21：8 個來源 = 6 條題目（「E8·Q14 = E12·Q24 = E15·Q7」一粒、「these 6」、「Question 1 of 6」）；W-012 一行檢查容許合併 node |
| `tests/batch-test.js` | copy 同步掌握：第 1 輪掌握數 = 24 + 佢哋嘅 copy；最後一輪揀冇 copy 嘅 7 題 |
| `tests/plan-run2-test.js` | 錯題知識點列表數 = 不同題目數 |

冇新 JS 檔（SW `SHELL` 唔使改）。

## 行為備註

- 掌握 %（Home 試卷 / 章節 / 難度）仍然逐個 key 計總數：Exam 7 同 Exam 13 各自有自己嗰題，同步後兩邊一齊算已掌握（用戶接受）。
- `factMastery` 仍然用 `f.src`（總數包括 copy），因為只用 `derived`；copy 讀最高，所以結果同按不同題目計一樣。
- 錯題簿：計劃以外答錯照舊只記答嗰個 copy；答啱（重做錯題回合或者計劃任務）就清晒所有 copy、只計 1 次（G38 / W-047）。

## Review 修正（2026-10-09，`.proj-docs/reviews/2026-10-09_review_plan-pr7b.md`，warn 89）

| ID | 處理 |
|---|---|
| W-046 | `distinctQuestions(list)`（`questions.js`）：洗牌後每個 canonical key 留一個 copy（隨機）。`sessionQuestions` Practice 分支（章節 / 難度 / 全部 / 錯題簿 / 標記 / 單份試卷練習）先去重再取 `PRACTICE_ROUND_MAX`；Exam mode 試卷唔變（冇一份試卷有兩個 copy）。計劃 runner、Similar / 知識點 session 本身已去重。dup-test：剩低 3 個 copy 嘅章節回合只問 1 題、答啱後三個 copy 連勝都係 1；錯題簿 3 個 copy / 標記 2 個 copy 各問 1 題；5 個 set × 15 輪冇重複；Exam 13 試卷不變 |
| S-140 | `copiesRefText` 每個 ref 包 `<span class="sqm-ref">`（`white-space: nowrap`），只喺「 = 」斷行；dup-test 320px 驗證三個 ref 各自一行、冇橫向捲動 |
| S-141(a) | 用戶決定（見 G40 ④）：`renderSimilar` 改為知識點有多過一個來源就出 panel；`similarPanelHtml` 冇項目時唔出列表、「+N」、圖例、CTA，只出核心知識卡 + 地圖。計劃 runner（`currentMark`）一定會列答錯嗰題，所以照舊（用戶 2026-10-10 接受）|
| S-141(b) | `state.masteredBefore` 改為今輪問嘅題目之中已掌握數，結果頁 N = 今輪問過嘅題目新掌握數（W-046 之後每題係一條不同題目，等同按題目組計）；「已掌握 x/y」照舊逐 key 計，所以答 1 題、2 個 copy 一齊掌握 → 「新掌握 1 題」，總數 +2 |
| S-142 | `qKey` 搬去 `questions.js`（`questionByKey` 旁邊），`buildQuestionCopies` 用佢；`planCanonKey` 改為 `const planCanonKey = canonQuestionKey`（planProgress.js 同 plan tests 仍用呢個名，所以保留 alias）|
| S-143 | dup-test：(a) 同上 W-046；(b) `recordPracticeAnswer(q, correct, planDay)` → `recordPlanAnswer` 收到答嗰個 copy 嘅 key + 計劃日，連勝同步；(c) 計劃以外答錯只記答嗰個 copy 入錯題簿 |
| S-144 | `sideSession.js`、`similarPanel.js` 長 comment 拆行 |
| zh「已」 | `plan.home.doneHtml`「<b>✓ 今日已完成</b>，明日再來」、`plan.run.mockPassNote`「✓ 模擬考試任務已完成」、`plan.status.done`「✓ 已完成」；plan-schedule-test 驗證「✓ 已完成」喺 320–600px 左欄一行 |

## Re-review 修正（2026-10-10，pass 94）

| ID | 處理 |
|---|---|
| W-047 | `clearPlanReviewWrong` 改名 `clearWrongCopies`（`quiz.js`），計劃任務同「重做錯題」回合答啱都用佢：清晒錯題簿入面嗰條題目文字嘅所有 copy，`state.cleared` 只加 1。結果頁「尚餘 n 題」= `questionGroups(keysOf(wrongList)).length`。dup-test：錯題簿 `8.13 / 12.23 / 15.6` → 一輪問 1 題、答啱 → 錯題簿空、cleared 1、「Cleared 1 from your wrong answers · 0 left」 |
| S-145(a) | `state.reviewTotal` = 不同題目數（`questionGroups(pool.map(qKey)).length`）：25 條不同題目 + 1 個 copy →「Round 1 of 2 · 24 of your 25」；24 條 + 1 個 copy → 一輪問晒、冇回合提示 |
| S-145(b) | 用戶決定（2026-10-10，G40 ⑧）：標記同步。`setPracticeFlag(key, on)`（`store.js`）寫晒 `questionCopies(key)`；`isPracticeFlagged` = 任何一個 copy 有標記（舊資料唔 migrate）。標記列表（`flagged.js`）用 `questionGroups` 每條不同題目一項（`copiesRefText`），取消標記清晒 copy；「練習標記題目（N）」同 Home 標記 tile 按不同題目計，Home 錯題 tile 亦一樣（同結果頁「尚餘 n 題」一致）。dup-test：13.0 加 / 取消 → 兩個 copy 一齊；舊資料只標記 13.0 → 7.15 顯示已標記、toggle 清晒；3 個 copy + 1 題 → 列表 2 項、count 2、Home tile 2、標記回合 2 題；列表取消其中一個 copy → 三個都清 |
