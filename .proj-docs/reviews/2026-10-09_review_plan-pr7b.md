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

---

# Re-review — 2026-10-10

- 目標：新 commits `05251a8`（code + tests）+ `8e8300b`（docs），全 PR diff = `git diff 7a167fe...HEAD`（25 files，+708 / −83）
- 總評：W-046、S-140–S-144 全部解決，user 要求嘅三句 zh「已」都改咗兼有 test。`distinctQuestions` 放喺 `questions.js` 同 copy 表一齊，Practice 每輪每條文字只問一次，Exam paper 冇郁。但係 W-046 嘅去重套埋落錯題簿回合，而錯題簿喺計劃以外仍然逐個 copy 清，所以出咗一個新 Warning（W-047）：錯題簿入面有同一題嘅幾個 copy 時，要做幾輪先清得晒，每輪問返同一題。我用 browser probe 驗證過（下面）。

## Hard Gates（re-review）

| Gate | 結果 | 備注 |
|------|------|------|
| Lint | n/a | 項目冇 linter |
| Type check | n/a | 純 JS，冇 tsc |
| Tests | ✅ pass | `bash tests/run-all.sh` 41/41 PASS，exit 0（跑咗兩次，都係全綠）；跑完 `git checkout -- 'tests/*.png'` |
| Coverage | n/a | 冇 coverage 工具；新行為 dup-test 有 cover |
| No Critical | ✅ pass | 0 |
| Security scan | n/a | 冇新依賴 |

## 舊 finding 逐條核對

| ID | 結果 | 核對 |
|----|------|------|
| W-046 | ✅ 已解決 | `sessionQuestions` Practice 分支 → `distinctQuestions(candidates).slice(0, PRACTICE_ROUND_MAX)`；`distinctQuestions` 先 `shuffle` 再按 `canonQuestionKey(qKey(item))` 每組留第一個，輸出次序就係洗牌後次序，所以唔使再 shuffle 多次。Exam / Random Exam / All 分支冇改，dup-test 驗 Exam 13 仍有 `13.0`。dup-test `checkRounds`：章節剩 3 個 copy → 問 1 題，答啱後三個 copy 連勝都係 1；錯題簿 3 個 copy / 標記 2 個 copy 各問 1 題；5 個 set × 15 輪冇重複 |
| S-140 | ✅ 已解決 | `copiesRefText` 每個 ref 包 `<span class="sqm-ref">`，`.sqm-ref { white-space: nowrap; }`；`questionRefText` 輸出係程式自己砌嘅數字 label，入 HTML 冇 injection 風險。320px test 驗三個 ref 各自一行、`scrollWidth <= 320` |
| S-141(a) | ✅ 已解決（照用戶決定） | `renderSimilar` 改為 `fact.src.length > 1` 就出；`similarListHtml` 冇項目時回 `''`（冇 legend / list / CTA），`countHtml` 喺 `groups.length === 0 && !currentMark` 時唔出。9 條 all-copy fact id 有 assert（67、81、116、128、130、147、185、230、231），en + zh「出現於：」都驗；一個來源嘅知識點照舊冇 panel |
| S-141(a) plan runner | ✅ 做法合理 | 見下面「判斷」 |
| S-141(b) | ✅ 已解決 | `state.masteredBefore = masteryOf(state.questions).mastered`（喺 `sessionQuestions` 之後），result 嘅 `n = masteryOf(state.questions).mastered - masteredBefore`；「x/y」照舊用 `setPool`。side session 有自己嘅 `masteredBefore: 0` 同 `setPool: null`，而 `practiceResultNote` 喺 `!state.setPool` 時 return，所以唔受影響。test：2 個 copy 剩 streak 2，答 1 題 → 「Mastered 1 more」，總數 x/x |
| S-142 | ✅ 已解決 | `qKey` 搬去 `questions.js`（`questionByKey` 隔籬），`buildQuestionCopies` 用佢；`mastery.js` 留 comment 指去新位置；`const planCanonKey = canonQuestionKey` alias 有 comment 講點解保留。Script 載入次序冇問題（41/41 包括 structure-test / sw-test） |
| S-143 | ✅ 已解決 | (a) 見 W-046；(b) `recordPracticeAnswer(q, true, PLAN_DAY)` → `recordPlanAnswer` 收到 `['13.0', true, day]`，兩個 copy streak 都係 1；(c) 計劃以外答錯只記答嗰個 copy |
| S-144 | ✅ 已解決 | `sideSession.js` 同 `similarPanel.js` comment 拆行，≤ 120 字元 |
| zh「已」 | ✅ 已改 | `plan.home.doneHtml`「<b>✓ 今日已完成</b>，明日再來」、`plan.run.mockPassNote`「✓ 模擬考試任務已完成」、`plan.status.done`「✓ 已完成」；en 三句冇變（dup-test assert）；plan-schedule-test 加咗 pill 喺左欄一行嘅 test |

### 判斷：plan runner 錯題知識點 panel 保持唔變（S-141a）

我同意保持唔變。`currentMark` 模式下面嘅 panel 係獨立出現（上面冇題目卡，CUI-0025），所以答錯嗰題本身就係要列出嚟嘅項目，唔係重複：卡（「Exam 15 · Q6 = Exam 4 · Q13 · You got this wrong」）話俾用戶知錯咗邊題，count `1` = 知識點全部不同題目數，同 `planFactQids`（已按 canon 去重）一致，CTA 嘅 `n` 都係 1。如果跟 Practice 嘅做法拎走列表 / CTA，計劃 wrong-facts 任務就冇辦法喺嗰張卡度重練嗰題，同 G26 / arch §E.3 唔一致。dup-test 有 assert 呢個行為。唯一要做嘅係將 G40 ④ 入面「待用戶確認」交返俾用戶確認（docs，唔關 code 事）。

### 其他要留意嘅 regression

- **隨機揀 copy**：`distinctQuestions` 隨機揀邊個 copy，所以 ref（Exam 7 定 Exam 13）每次都可能唔同。copy 嘅 streak 同步咗，flag / wrong 都係逐個 copy 記，所以唔會錯，只係唔 deterministic。Test 只 assert set membership（`TRIPLE.includes`）同「冇重複」，冇依賴邊個 copy，所以唔會 flaky。可以接受；想 deterministic 嘅話可以揀 pool 入面 exam order 第一個，但係冇必要。
- **「Round 1 of N」**：見 S-145，只係 cosmetic。

## 🟡 W-047 — 錯題簿回合每條文字只問一個 copy，但答啱只清嗰個 copy：同一題要做 N 輪先清得晒

- 位置：`js/screens/quiz.js` `recordPracticeResult` L221（`else if (state.examNum === WRONG_EXAM && wrongList[qKey(q)]) { clearWrong(q); state.cleared++; }`），配合 L24 `distinctQuestions` 同 L46 `state.reviewTotal = pool.length`
- 描述：W-046 之後，錯題簿回合每條文字只抽一個 copy；但係計劃以外答啱只清答嗰個 key。錯題簿有同一題嘅 k 個 copy（例如 Exam 4 同 Exam 15 計時試都錯同一題，`result.js` L46 逐個 copy `addWrong`），就要做 k 輪「Review wrong answers」，每輪都問返同一條題目。Browser probe（wrongList = 第 21 條知識點 3 個 copy `8.13 / 12.23 / 15.6`，每輪全部答啱）：

  | 輪 | 問 | reviewTotal | cleared | left |
  |----|----|-------------|---------|------|
  | 1 | 8.13 | 3 | 1 | 12.23, 15.6 |
  | 2 | 12.23 | 2 | 1 | 15.6 |
  | 3 | 15.6 | 1 | 1 | — |

  修之前：同一輪問晒 3 個 copy，一輪清晒（不過連勝會 +3，即係 W-046）。修之後連勝啱咗，但係錯題簿要三輪，而且結果頁「Cleared 1 · 2 left」講緊嘅「2」其實係啱啱答啱咗嗰題。計劃 runner 冇呢個問題，因為 G38 `clearPlanReviewWrong` 用 `planSameQuestionKeys` 清晒所有 copy、只計 1 次。
- 影響：只會喺用戶喺唔同試卷答錯同一題文字時出現（19 個 extra key），但係出現嘅話就好明顯：同一題，連續幾輪問同一條。dup-test `checkRounds` 只 assert「問 1 題」，冇 assert 答啱之後清得晒。
- 方案 A（推薦）：錯題簿回合答啱就清晒嗰條文字嘅所有 copy、只計 1 次，即係同計劃嘅 G38 一樣：抽一個 `clearWrongCopies(q)` helper（用 `planSameQuestionKeys` 或者 `questionCopies(qKey(q)).filter(k => wrongList[k])`），`clearPlanReviewWrong` 同 WRONG_EXAM 分支都用佢；`state.reviewTotal` 改為不同題目數（`questionGroups(pool.map(qKey)).length`）；加一個 dup-test：3 個 copy → 一輪答啱 → `wrongList` 空、`cleared === 1`。Trade-off：改咗「計劃以外錯題簿行為不變」嗰句（G40 ②），要喺 spec / grill 補一句，不過呢個本身就係「一條題目文字 = 一條題目」嘅延伸。
- 方案 B：錯題簿回合唔去重（`isReviewSet(examNum) ? pool : distinctQuestions(practicePool(pool))`），連勝只喺第一個 copy 加（例如喺 round 入面記住已經加過嘅 canon key）。Trade-off：同一輪問同一題兩次，用戶睇落似 bug；要喺 `recordPracticeAnswer` 加 round state，複雜啲。
- 推薦：A。改動細（一個 helper + 一行 `reviewTotal` + 一個 test），同 G38 / G40 方向一致。

## 🟢 S-145 — 回合 / 標記數目仍然逐個 copy 計

- 位置：`js/screens/quiz.js` `renderRoundNote` L164–170（`total = state.reviewTotal`，`rounds = Math.ceil(total / PRACTICE_ROUND_MAX)`）；標記題目 `practiceFlags` 逐個 copy 記
- 描述：(a) 錯題簿 / 標記回合嘅「Round 1 of N · n of your T wrong answers」用 `pool.length`，有 copy 嘅話 T 同 N 都偏高（例如 25 個 key 其實得 24 條題目 → 「Round 1 of 2」但其實一輪問晒）。純 cosmetic。(b) 標記回合每條文字問一個 copy，但係取消標記只取消嗰個 copy，另一個 copy 下次又會出。標記係用戶自己揀嘅，所以冇 W-047 咁嚴重。
- 方案 A：(a) 跟 W-047 方案 A 一齊將 `reviewTotal` 改為不同題目數；(b) 喺 quiz 取消 / 加標記時同步所有 copy（`questionCopies`），或者喺 spec 寫明標記係逐個 copy 記。
- 方案 B：只寫入 spec 做 known limitation，暫時唔改。
- 推薦：(a) 用 A（W-047 本身會改 `reviewTotal`，順手）；(b) 用 B 或者另開 ticket，問用戶想點。

## 評分結果（re-review）

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 19 | 25 | W-047（−5）、S-145（−1） |
| 安全性 | 20 | 20 | 冇新 input；`.sqm-ref` 包住嘅係程式砌嘅 label |
| 可維護性 | 20 | 20 | `qKey` / `distinctQuestions` 同 copy 表放埋一齊；`similarListHtml` 拆得清楚；alias 有 comment |
| 測試覆蓋 | 15 | 15 | 新 test 覆蓋 W-046、S-140、S-141、S-143 同 zh pill；W-047 冇 test 嘅問題計喺正確性度，唔重複扣 |
| 性能 | 10 | 10 | `distinctQuestions` 係 O(n) |
| 代碼風格 | 10 | 10 | comment 已拆行，命名一致 |
| **總分** | **94** | **100** | |

**結果：✅ pass**（hard gates 全 pass、≥ 90、冇 Critical）。W-047 係 Warning，唔 block merge，但建議 merge 之前修（細改動），或者即刻開 follow-up；PR7b 本身就係要做「一條文字 = 一條題目」，錯題簿逐個 copy 清就會同呢個目標唔一致。

## 修正優先順序（re-review）

| 優先 | ID | 工作量 | 備注 |
|------|----|--------|------|
| 1 | W-047 | helper + 1 行 + 1 個 test | 建議 merge 前，或者即刻開 follow-up；spec G40 ② 補一句 |
| 2 | S-145(a) | 跟 W-047 一齊改 `reviewTotal` | |
| 3 | S-145(b) | 問用戶 | 標記係唔係都要同步 copy |
| — | G40 ④ | docs | 「待用戶確認」：plan runner panel 保持唔變，等用戶確認 |

## 修訂後代碼（W-047 方案 A 重點）

```js
// js/screens/quiz.js — W-047: a correct answer in a review clears every copy of the question text, counted once
// (the plan runner already does this: G38); a round asks one copy per text (W-046)
function clearWrongCopies(q) {
  const keys = planSameQuestionKeys(keysOf(wrongList), qKey(q));
  keys.forEach(k => clearWrong(questionByKey(k)));
  if (keys.length) state.cleared++;
}
function recordPracticeResult(q, correct) {
  recordPracticeAnswer(q, correct, state.planDay || null);
  if (!correct) addWrong(q);
  else if (isPlanSession() || state.examNum === WRONG_EXAM) clearWrongCopies(q);
}
// startExam: review rounds count distinct questions, so "Round 1 of N" matches what is asked (S-145a)
state.reviewTotal = isReviewSet(examNum) ? questionGroups(pool.map(qKey)).length : 0;
```

## Handoff receipt（re-review）

```handoff-receipt
protocol: 1
status: pass
score: 94/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
next_action: merge_develop
next_agent: null
branch: "claude/charming-hopper-48ypzp"
context: "PR7b re-review: W-046, S-140-S-144 and the zh 已 strings resolved; 41/41 pass. Plan runner panel left unchanged (S-141a) is sound (CUI-0025 standalone lists the wrong answer). New W-047: a wrong-answers round asks one copy per text but a correct answer clears only that copy, so k copies take k rounds of the same question (browser probe 3 copies -> 3 rounds); fix = clear all copies like G38 + reviewTotal by distinct questions. S-145: round note / flags count copies"
blockers: []
```

---

# Re-review 2 — 2026-10-10

- 目標：新 commits `5145beb`（code + tests）+ `3ed45ea`（docs），喺 `51a6dbd` 之上
- 總評：W-047 同 S-145（a）（b）全部解決，冇新 finding。計劃 runner 同錯題簿回合而家用同一個 `clearWrongCopies`，所有「錯題 / 標記」數目（回合提示、結果頁、標記列表、Home tile）都按不同題目計，同計劃本身（`planUnique(wrongKeys.map(planCanonKey))`）一致。

## Hard Gates（re-review 2）

| Gate | 結果 | 備注 |
|------|------|------|
| Lint | n/a | 項目冇 linter |
| Type check | n/a | 純 JS |
| Tests | ✅ pass | `bash tests/run-all.sh` 41/41 PASS，exit 0；跑完 `git checkout -- 'tests/*.png'` |
| Coverage | n/a | 冇工具；新行為 dup-test `checkWrongRound` / `checkFlagSync` 有 cover |
| No Critical | ✅ pass | 0 |
| Security scan | n/a | 冇新依賴 |

## 逐條核對

| ID | 結果 | 核對 |
|----|------|------|
| W-047 | ✅ 已解決 | `recordPracticeResult`：`isPlanSession() \|\| state.examNum === WRONG_EXAM` → `clearWrongCopies(q)`（即係舊 `clearPlanReviewWrong` 改名，G38 行為冇變）。舊條件 `wrongList[qKey(q)]` 由 `planSameQuestionKeys(keysOf(wrongList), qKey(q))` 回空就唔 `cleared++` 代替，所以效果一樣。Similar / fact side session 嘅 `examNum` 唔係 `WRONG_EXAM`，冇變。我第一次 re-review 用嘅 browser probe 再跑：3 個 copy → 1 輪、`reviewTotal 1`、`cleared 1`、`left []`（之前要 3 輪）。結果頁「left」= `questionGroups(keysOf(wrongList)).length` |
| S-145(a) | ✅ 已解決 | `reviewTotal = questionGroups(pool.map(qKey)).length`；test：25 條不同題目 + 1 個 copy →「Round 1 of 2 · 24 of your 25」，24 條 + 1 個 copy → 一輪、冇提示（之前會錯出「Round 1 of 2」） |
| S-145(b) | ✅ 已解決（照用戶 2026-10-10 決定） | 見下面 |
| G40 ④ | ✅ | docs 已標「用戶 2026-10-10 接受」 |

### S-145(b) 標記同步

- **載入次序**：`index.html` 次序係 `store.js` → `questions.js` → `mastery.js`。`setPracticeFlag` 喺 `store.js` 用 `questionCopies`，但係只喺 runtime 叫：`examTools.js` L48（toggle）同 `flagged.js` L23（`unflagFromList`），冇 load 時嘅 caller（grep 過）。`store.js` load 時只讀 `getLS`，所以冇 ReferenceError。comment 有講清楚。✅
- **`isPracticeFlagged` = 任何一個 copy**：舊資料只標記一個 copy，兩個 copy 都會顯示已標記；toggle 讀到 true，就寫 false 落所有 copy，所以一撳就清晒，唔會出現「撳完仲係有標記」。test 有 cover。✅
- **標記列表**：`questionGroups(keysOf(practiceFlags))` 每條不同題目一項，ref 用 `copiesRefText`（`.sqm-ref` nowrap，S-140 嘅 CSS 喺全域 stylesheet）；取消標記傳 `keys[0]`，`setPracticeFlag` 會清晒 copy。「Practise flagged (N)」、Home 標記 tile、標記回合 `reviewTotal` 都係不同題目數。✅
- **Home 錯題 tile 改為按不同題目計**（developer 自己決定）：**我同意**。W-047 之後一條文字嘅 copy 會一齊清，回合提示同結果頁「left」都按不同題目計，計劃嘅清錯題任務本身都用 canon。如果 tile 仲逐個 key 計，就會出現 tile 寫「3」、入去回合寫「1 of your 1」、做完寫「0 left」咁嘅矛盾。錯題簿仍然逐個 copy 記錄（`addWrong` 冇改，S-143(c) test 照 pass），只係顯示同清除按題目計，冇 data migration 風險。✅
- 計時試卷嘅 session 標記（`state.flags[i]`）冇郁，啱。

## 新 finding

冇。

## 評分結果（re-review 2）

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 25 | 25 | W-047、S-145 已解決 |
| 安全性 | 20 | 20 | |
| 可維護性 | 20 | 20 | 計劃同錯題簿共用一個 helper；comment 有講 load order |
| 測試覆蓋 | 15 | 15 | `checkWrongRound`、`checkFlagSync` 覆蓋清除、數目、回合提示 boundary（24 / 25）、舊資料、列表取消標記 |
| 性能 | 10 | 10 | |
| 代碼風格 | 10 | 10 | |
| **總分** | **100** | **100** | |

**結果：✅ pass**

## Handoff receipt（re-review 2）

```handoff-receipt
protocol: 1
status: pass
score: 100/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
next_action: merge_develop
next_agent: null
branch: "claude/charming-hopper-48ypzp"
context: "PR7b re-review 2: W-047 (clearWrongCopies shared by plan + wrong round; probe 3 copies -> 1 round), S-145(a) distinct reviewTotal, S-145(b) flag sync (setPracticeFlag only called at run time after questions.js loads; any-copy read; merged list) all resolved; Home wrong tile distinct is consistent with rounds/result/plan. 41/41 pass. No new findings"
blockers: []
```
