# 溫習計劃 PR7b：相同文字題目合併（G40，v1.0.7）

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
| `js/core/config.js` | `COPY_SEP = ' = '`；`APP_VERSION` 1.0.7（SW cache 跟版本） |
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
- 錯題簿：計劃以外照舊只記答嗰個 copy（G38 喺計劃 runner 入面清晒 copy）。
