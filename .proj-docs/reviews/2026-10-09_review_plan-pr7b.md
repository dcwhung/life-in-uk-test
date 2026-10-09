# Code Review — 溫習計劃 PR7b：相同文字題目合併 + 連勝同步（G40，v1.0.7）

- 日期：2026-10-09
- 審閱者：Code Reviewer（獨立）
- 目標：branch `claude/charming-hopper-48ypzp`，commits `4ea170e`（feat）+ `1afcbe0`（docs），diff = `git diff 7a167fe...HEAD`（20 files，+325 / −65）
- Spec：`.proj-docs/plans/2026-10-09_dup-questions-pr7b.md`；grill G40（`.proj-docs/plans/2026-10-08_grill_study-plan.md`）
- Design Origin：`proposal: user-approved preview 2026-10-09`（合併 " = " node）
- 總評：做法乾淨。copy 表由 `plan.js` 搬去 `questions.js` 做唯一來源（`QUESTION_COPIES`），plan 嘅 canonical key 同新嘅 grouping / 連勝同步用同一張表，`dup-test` 有 assert 兩邊一致。三個用戶決定全部照做：(1) 來源行、Similar 地圖、current node、item 卡、「+N」、「練習這 N 題」同兩個 session 都按不同題目計；(2) 答啱 = min(3, copy 最高 + 1)、答錯 = 0、讀取用最高、冇 migration；(3) zh「已全部完成」，en 不變。我用腳本核對過資料：17 組 copy（15 組 2 個、2 組 3 個），**每組都喺同一條知識點同同一章**，所以「copy 唔會跨知識點」嘅假設成立，`currentCopies` 唔會拉入第二條知識點嘅題。發現 1 個 Warning：章節 / 難度 / 全部 / 錯題簿嘅 Practice 回合仍然可以同一輪抽中同一題文字嘅兩個 copy，而家連勝同步咗，一輪就加 2（3 個 copy 就加 3，即一輪掌握），違反「連續 3 輪答啱先算掌握」。另有 5 個 Suggestion。

## Hard Gates

| Gate | 結果 | 備注 |
|------|------|------|
| Lint | n/a | 項目冇 linter（classic script）；structure-test pass |
| Type check | n/a | 冇 TS |
| Tests | pass | `run-all.sh` **41/41** PASS，exit 0（新 `dup-test`；plan-test 2707 checks）；之後 `git checkout -- 'tests/*.png'`，`tests/shot-similar.png` 仍然 tracked，working tree 乾淨 |
| Coverage | n/a | 冇 coverage 工具；新函數（`buildQuestionCopies` / `canonQuestionKey` / `questionCopies` / `questionGroups` / `keyStreak` / `similarGroups` / `currentCopies` / `copiesNodeText` / `copiesRefText`）全部有 dup-test 直接或經 UI 行到 |
| No Critical | pass | 0 |
| Security scan | n/a | 冇新依賴；新字串全部經 `questionNodeText` / `questionRefText`（數字），item 嘅 `mark` 仍然 `escapeHtml` |

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 19 | 25 | W-046、S-141 |
| 安全性 | 20 | 20 | |
| 可維護性 | 19 | 20 | S-142 |
| 測試覆蓋 | 14 | 15 | S-143 |
| 性能 | 10 | 10 | `questionCopies` 係 O(1) 查表；`keyStreak` 最多 3 個 key |
| 代碼風格 | 7 | 10 | S-140、S-144，加 W-046 修正前嘅 comment 要更新（唔另扣） |
| **總分** | **89** | **100** | |

**結果：warn**（hard gates 全部 pass，0 Critical，89 分）

## Design Fidelity

- Origin `proposal`：spec 有記低用戶 2026-10-09 批咗 preview；改動只係 node 文字用 " = " 連 + `.sqm-node` 加 `white-space: nowrap`，冇新 className、冇 layout 改動。顏色全部係原有 token。
- **320px 實測**（Playwright，fact #21 最長嗰粒 3-copy node）：
  - Study 卡來源行：「E8·Q14 = E12·Q24 = E15·Q7」闊 163px，卡內 16–304px，冇 overflow，`scrollWidth === 320`。
  - Similar 地圖：current node「E15·Q7 = E8·Q14 = E12·Q24」105–270px，冇 overflow。
  - nowrap 只會喺單粒 node 闊過容器先出事；最長 3 copy ≈ 165px，320px 下容器 ≈ 250px，有餘裕。`.fact-src .sqm-node` 本身已經 nowrap，所以 Study 卡冇變；新效果只影響 Similar 地圖，OK。
  - **但係** item 卡嘅 ref（`.sqm-id`，冇 nowrap）喺 standalone panel（計劃錯題知識點，有 mark）會斷行喺 ref 中間：「Exam 15 · Q7 = Exam 8 · Q14 = Exam / 12 · Q24 · You got this wrong」→ 見 S-140。
- W-012 一行檢查改成 `nodes.length > 0`，67 / 128 / 231 合併後係 1 粒 node，仍然驗到「同一行」，合理。

## 邊界案例核對

| 案例 | 結果 |
|------|------|
| 全部來源都係答緊嗰題嘅 copy（#67 等 **9 條**：67、81、116、128、130、147、185、230、231）| `similarGroups` = []，panel 隱藏（dup-test 有 assert）。Study 卡顯示 1 粒合併 node +「▶ Practise this one」。見 S-141（行為改變冇寫入 spec）|
| 3 個 copy（#21 `8.13 / 12.23 / 15.6`、#230 `2.19 / 7.12 / 10.22`）| 來源行 1 粒、N = 6、session 問 `8.13`（exam order 第一個）；factsession-test 有改 |
| 舊資料 copy 唔同 | `keyStreak` 讀最高；`isMastered`、`factMastery.derived`、`planMasteredKeys`（G37，舊有已經 map 落 canon，等於讀最高）一致，dup-test 有 assert。答錯 → 全部 0；答啱 → max + 1，全部寫同一個值 |
| Practice「skip mastered」pool | `practicePool` 用 `isMastered` → 一個 copy 掌握咗，另一個都唔再抽。batch-test 已更新（第 1 輪掌握數 = 24 + copy；最後一輪揀冇 copy 嘅 7 題）|
| 同一輪抽中兩個 copy | **W-046** |
| 試卷 / 章節 / 難度掌握 % | 仍然逐 key 計（用戶接受）。附帶：結果頁「新掌握 N 題」可以包括今輪冇問過嘅 copy → S-141 |
| 計劃 G38 | `clearPlanReviewWrong` 用 `planSameQuestionKeys` → `planCanonKey` → `canonQuestionKey`，仍然清晒 copy |
| 錯題簿（計劃以外）| `addWrong` / `clearWrong` 冇改，只記 / 清答嗰個 copy（spec 行為備註有寫）|
| `questionCopies` 傳入唔存在嘅 key | 回 `[k]`，`keyStreak` 正常 |
| 重設練習進度 | 只有全局 `resetPracticeStore`（`streaks = {}`），冇逐試卷 reset，所以「讀最高」唔會令 reset 失效 |
| 載入次序 | `questions.js`（477）→ `mastery.js` → `similar.js` → `plan.js` → components → screens；`QUESTION_COPIES` 喺 `plan.js` 用之前已定義。冇新檔，SW `SHELL` 唔使改；`APP_VERSION` 1.0.7 → 新 cache 名 |
| js/ 冇 CJK | diff 入面 `js/` 新行冇 CJK（只係 tests 同 locales）|

## 問題清單

### 🟡 W-046 — 同一輪 Practice 抽中同一題文字嘅兩個 copy，同步連勝一輪加 2（或 3）

- 位置：`js/screens/quiz.js` `sessionQuestions`（L20–24）+ `js/domain/mastery.js` `recordPracticeAnswer`（L10–16）
- 描述：17 組 copy 全部喺同一章，所以 `chapterQuestions(ch)`、`difficultyQuestions`（如果難度一樣）、`ALL_EXAM` 同錯題簿（兩個 copy 都可以喺 `wrongList`）嘅 pool 都會同時有兩個 copy；`shuffle(...).slice(0, PRACTICE_ROUND_MAX)` 冇按 canon 去重。以前每個 copy 自己計，冇問題；而家 `recordPracticeAnswer` 將新值寫晒所有 copy，下一個 copy 再答啱就由已加過嘅值再 +1。實測：`streaks = {}`，同一輪答啱 `8.13`、`12.23`、`15.6` → 三個都 3，**一輪就掌握**。
- 影響：19 個多出嚟嘅 key 嘅「連續 3 輪答啱先算掌握」（MASTERY_ROUNDS）變成 1–2 輪；同一輪仲會問同一條題兩次（G40 嘅精神係「每條只問一次」，spec 只處理咗 fact / Similar session）。次序亦有影響：先錯後啱 = 1，先啱後錯 = 0。
- 方案 A（推薦）：`sessionQuestions` practice 分支先按 `canonQuestionKey` 去重再抽（例如 `questionGroups(candidates.map(qKey))` 取每組一個，可以 random 揀 copy 保持試卷覆蓋）。一個改動同時解決「問兩次」同「加兩次」；掌握 % 照舊逐 key 計。Trade-off：章節 / 全部 pool 嘅回合題數上限唔變，只係少咗重複題。
- 方案 B：`recordPracticeAnswer` 記低今個 session 已計過嘅 canon（`state.countedCanon`），同一 session 第二個 copy 只顯示對錯、唔再改連勝。Trade-off：仍然問兩次；要處理 side session stash / restore。
- 測試：dup-test 加一個 case — `streaks = {}`，`startExam('ch3')` practice，assert `state.questions` 冇兩個 key 同 canon；batch-test 嗰句「twins master sooner」comment 要跟住改。

### 🟢 S-140 — 合併 ref 喺 item 卡中間斷行（320px）

- 位置：`js/components/tags.js` `copiesRefText`；`css/screens/quiz.css` `.sqm-id`
- 描述：standalone panel（計劃錯題，有「· You got this wrong」）3-copy ref 喺 320px 斷成「… = Exam / 12 · Q24 · You got this wrong」，「Exam」同「12」分咗兩行。
- 方案 A（推薦）：`copiesRefText` 每個 ref 包 `<span class="sqm-ref">`（`white-space: nowrap`），只喺 " = " 之間斷行。
- 方案 B：`.sqm-id` 整個 nowrap + `text-overflow: ellipsis`。Trade-off：會切走 mark，唔建議。

### 🟢 S-141 — 兩個行為改變冇寫入 spec「行為備註」

- 位置：`.proj-docs/plans/2026-10-09_dup-questions-pr7b.md`
- 描述：(a) 9 條知識點（67、81、116、128、130、147、185、230、231）嘅來源全部係同一題，以前答完會出 Similar panel（連 core 知識點卡），而家完全唔出 —— 學生喺 Practice 答完呢 9 條就唔再見到知識點卡。dup-test 有守住，但 spec / G40 冇講。(b) 結果頁「新掌握 N 題」（`result.js` L104，`masteryOf(setPool) − masteredBefore`）喺章節 pool 會將今輪冇問過嘅 copy 都計入（答 1 題 → +2）。
- 方案 A（推薦）：spec 加兩行行為備註，問用戶 (a) 係咪接受；如果唔接受，`renderSimilar` 可以喺 groups 空但有 fact 時只出知識點卡。
- 方案 B：(b) 改用 canon 計新掌握數。Trade-off：同掌握 % 逐 key 計唔一致。

### 🟢 S-142 — `qKey` 公式重複；`planCanonKey` / `PLAN_CANON_QKEY` 變成薄 alias

- 位置：`js/domain/questions.js` L144（`examNum + '.' + origIdx`）、`js/domain/mastery.js` L4（`qKey`）、`js/domain/plan.js` L125–126
- 描述：`questions.js` 先載入，所以 `buildQuestionCopies` 自己寫一次 key 公式（以前 `plan.js` 都係咁）。`planCanonKey(k) { return canonQuestionKey(k); }` 同 `PLAN_CANON_QKEY` 只係 alias。
- 方案 A（推薦）：將 `qKey` 搬入 `questions.js`（`questionByKey` 旁邊，正好係佢嘅反函數），`buildQuestionCopies` 用 `qKey`；`const planCanonKey = canonQuestionKey;`。
- 方案 B：保留，comment 註明原因。

### 🟢 S-143 — 測試缺口

- 位置：`tests/dup-test.js`
- 描述：(a) 冇測同一輪兩個 copy（W-046 本來可以俾呢個 test 捉到）；(b) `checkStreakSync` 冇行 `planDay` 參數嗰條路（`recordPlanAnswer` 收到嘅仍然係答嗰個 copy 嘅 key，正確，但冇 assert）；(c) 冇 assert 計劃以外錯題簿唔受同步影響（`wrongList` 只得答嗰個 copy）。`batch-test` 嘅 `covered >= 24` 係寬鬆 assert，但同時有等式驗證，可以接受。
- 方案：加 (a)（跟 W-046）同 (c) 各一句；(b) 可選。

### 🟢 S-144 — 新 comment 行過長

- 位置：`js/screens/sideSession.js` L80（≈ 180 字元）、`js/screens/similarPanel.js` L65（新 comment）
- 描述：同檔其他 comment ≤ 120 左右，新行一行過塞晒 G40 說明。
- 方案：拆兩行。

## ✅ 做得好嘅地方

- 單一來源：copy 表搬入 `questions.js`，plan、mastery、similar、components 全部用同一張表；dup-test `planSame` 守住 plan 同新 API 一致，唔會再出兩套 canon。
- 「讀最高、寫同一個值」嘅設計免咗 migration，舊資料即刻一致；`planMasteredKeys` 本身已經 map 落 canon，唔使改。
- `questionGroups` 保持 `f.src` 首次出現次序、組內 exam order，`currentCopies` 將答緊嗰題放第一 —— 同用戶 preview 完全一致，dup-test 兩個方向（答 13.0 / 答 10.0）都有 assert。
- 計劃 runner 嘅 CTA 題數照用計劃自己計（`planFactQids`，已 canon 去重），同 `groups.length + 1` 一致；plan-run2-test 改用 `questionGroups` 計，唔係硬改數字。
- 舊 test 改得有道理：factsession-test 寫明 8 來源 = 6 題，batch-test 解釋點解揀冇 copy 嘅 7 題，冇為咗 pass 而放寬 assert。
- 冇新 JS 檔，SW `SHELL` 唔使郁；版本 bump 理由正確（Study / Similar 行為改變）。

## 修正優先順序

| 優先 | ID | 工作量 | 備注 |
|------|----|--------|------|
| 1 | W-046 | `sessionQuestions` 幾行 + 1 個 test | merge 前修 |
| 2 | S-143 | 2–3 句 assert | 跟 W-046 一齊 |
| 3 | S-141 | spec 2 行 + 問用戶 (a) | |
| 4 | S-140 | `copiesRefText` + 1 條 CSS | |
| 5 | S-142 | 搬 `qKey` | 可以另開 refactor |
| 6 | S-144 | comment 拆行 | |

## 修訂後代碼（重點）

```js
// js/domain/questions.js — S-142: qKey lives beside its inverse questionByKey
const qKey = q => q.examNum + '.' + q.origIdx;
// ...buildQuestionCopies: const text = q.q.trim().toLowerCase(), key = qKey({ examNum, origIdx });

// one item per distinct question (a random copy of each), for a Practice round (W-046)
function distinctQuestions(list) {
  const byCanon = {};
  shuffle(list).forEach(item => { const c = canonQuestionKey(qKey(item)); if (!byCanon[c]) byCanon[c] = item; });
  return Object.values(byCanon);
}

// js/screens/quiz.js — W-046: a round never asks one question text twice, so a synced streak moves once per round
function sessionQuestions(examNum, pool) {
  if (state.mode === PRACTICE_MODE) {
    const candidates = isReviewSet(examNum) ? pool : practicePool(pool);
    return shuffle(distinctQuestions(candidates)).slice(0, PRACTICE_ROUND_MAX).map(toQuestionItem);
  }
  // ...unchanged
}

// js/components/tags.js — S-140: break only between copies, never inside "Exam 12 · Q24"
function copiesRefText(keys) {
  return keys.map(k => `<span class="sqm-ref">${questionRefText(questionByKey(k))}</span>`).join(COPY_SEP);
}
```

```css
/* css/screens/quiz.css — S-140 */
.sqm-ref { white-space: nowrap; }
```

## Handoff receipt

```handoff-receipt
protocol: 1
status: warn
score: 89/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
next_action: invoke_developer
next_agent: frontend-developer
branch: "claude/charming-hopper-48ypzp"
context: "PR7b G40: 41/41 pass, copy table single-sourced, grouping/streak-sync/zh 已 match user decisions, 320px no overflow. W-046: chapter/difficulty/all/wrong Practice rounds can draw two copies of one text; synced streak +2 (+3 for 3 copies = mastered in one round) -> dedupe by canon in sessionQuestions + test. S-140 ref wraps mid-ref at 320px, S-141 spec notes (9 all-copy facts lose Similar panel; results 'newly mastered' counts unasked twins), S-142 move qKey to questions.js, S-143 tests, S-144 long comments"
blockers:
  - "W-046 should be fixed before merge (breaks 3-correct-rounds mastery for 19 keys)"
```
