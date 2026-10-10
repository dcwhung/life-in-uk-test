# Code Review — 溫習計劃 PR7c 閱讀任務已完成標示（G41）

- **日期**：2026-10-10
- **審閱者**：Code Reviewer（獨立）
- **目標**：branch `claude/charming-hopper-48ypzp`，commit b7149fd（test）/ 5305f58（feat）/ 74b999c（docs），diff `1a8e7b8...HEAD`（10 個檔案，+259 / −9）
- **Spec**：grill G41（`.proj-docs/plans/2026-10-08_grill_study-plan.md`）、`.proj-docs/plans/2026-10-10_plan-pr7c-reading-done.md`
- **Design Origin**：`proposal: user-approved preview 2026-10-10`。plan 冇獨立 `## Design Proposal` heading，但係跟 v0.71 review 嘅先例（session 入面批准、plan 有寫低決定）接受，唔開 Critical（見 S-156）
- **結果**：✅ pass — **91 / 100**，0 Critical、1 Warning（W-048）、4 Suggestion（S-153–S-156）

## Hard Gates

| Gate | 結果 | 備注 |
|---|---|---|
| Lint | n/a | repo 冇 eslint / package.json；diff 新增嘅 CSS 冇 raw hex，`js/` 新增行冇 CJK（grep 0） |
| Type check | n/a | plain JS，冇 tsc |
| Tests | ✅ pass | `tests/run-all.sh` 44/44 PASS（EXIT 0），包括新 suite `plan-read-done-test`；跑完已 `git checkout -- 'tests/*.png'` |
| Coverage | ✅ pass | tag 有 / 冇（今日答啱、🏆、未完成）、note n / q、單數 / 複數、zh-HK、重溫、全部完成、Study 不變、320px 都有 assert |
| No Critical | ✅ pass | 0 |
| Security scan | n/a | 冇新依賴；tag label 經 `escapeHtml`，note 文字來自 locale + 數字 |

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|---|---|---|---|
| 正確性 | 25 | 25 | n / q / tag 同任務完成度用同一套 helper，見下面「n / q 一致性」 |
| 安全性 | 20 | 20 | |
| 可維護性 | 19 | 20 | S-156 |
| 測試覆蓋 | 13 | 15 | S-153、S-155 |
| 性能 | 10 | 10 | 每張卡多一次 `planTaskMastered`（只係讀 Set），可以忽略 |
| 代碼風格 / a11y | 4 | 10 | W-048（−5）、S-154（−1） |
| **總分** | **91** | **100** | |

**結果：✅ pass**（hard gate 全部 pass，≥ 90，冇 Critical；W-048 建議 merge 前處理或者由用戶決定接受）

## n / q 一致性（逐項核對）

- **tag**：`planFactDone(f.id, dayLog, planTaskMastered(task, dayLog))`，同 `planTaskProgress`（任務完成度）同 `planResumeAt` 一樣計（G3 / G37）。
- **tag 同「▶ 練習」互斥**：「▶ 練習」嘅 n = `planNextRound({...task, facts:[id]})`，用 `planAskableQids`（同一個 mastered set）再揀未答啱嘅；知識點已完成 ⇔ 每條 qid 都係今日答啱或者 🏆 ⇔ n = 0。所以唔會同時出 tag 同掣，亦唔會兩樣都冇（重溫模式除外：重溫 = 任務已完成 = 全部有 tag）。
- **note 嘅 n**：用 `ctx.task`（全個任務，`planShowFacts` 嘅 context 冇收窄）嘅 facts 數未完成。
- **note 嘅 q**：`planFactLastLeft` 抽咗出嚟，主掣同 note 共用，所以 q 一定 = 掣上面嘅 N。
- **n > 0 ⇔ q > 0**：配對練習任務嘅 `qids` = 閱讀任務 facts 嘅 `planFactQids` flatMap（`plan.js` `planLearnTasks`），而且兩個任務都喺 `PLAN_MASTERY_TYPES`，用同一個 mastered set。未完成知識點一定有一條 qid 未答啱又唔係 🏆 → 喺配對任務入面 askable 又未答啱 → q ≥ 1；反過嚟一樣。實測 2026-10-01 計劃 11 個閱讀任務，配對 qids 冇重複（G40 canonical key 已經去重）。所以 `!q` 呢個 guard 正常情況唔會觸發，只係 defensive（例如將來 pair 唔再等於 facts 嘅題目）。
- 重溫模式：`planFactLastLeft` 回 0 → 冇 note；非重溫但全部完成：n = 0 → 冇 note，主掣變「完成 ✓」。兩樣都有 test。

## 開發者問題嘅判斷

1. **另加 `plan.run.lastUndoneQs`**：接受。`t()` 嘅 plural 係揀成條 string，一條句有兩個數字（n 知識點、q 題）要兩個 plural，用 `{qs}` 嵌另一條 key 係最簡單嘅做法；zh-HK 冇複數，直接「{n} 題」。key 有注釋講用途，i18n parity test pass。
2. **q = 0 就唔出 note**：接受。按上面分析 n > 0 時 q 唔會係 0；guard 保證唔會出「共 0 題」呢種自相矛盾嘅句子。
3. **只影響閱讀任務**：符合 G41 ⑤（錯題知識點任務嘅 Similar panel 不變）。`planFactLeftNoteHtml` 第一行 guard、tag 喺 `PLAN_TASK.read` 分支入面。但係冇 test 守住錯題知識點最後一條冇 note（S-155）。
4. **en「Practise these 3 →」喺 390px 摺行**：屬實，而且 320 / 360 / 390 都係兩行（主掣 58px 高，zh-HK 47px），係 PR6b 已有嘅情況，唔係今次引入。記低做 S-154。

## 問題清單

### 🟡 W-048 — 🏆 / 手動「已掌握」知識點卡成張 `opacity: 0.55`，新 tag 實際對比得 2.4:1；test 嘅 ≥ 4.5:1 檢查冇計 ancestor opacity

- **位置**：`css/components/fact.css:14`（`.fact.mastered { opacity: 0.55 }`，舊有）＋新 `.fact-done-tag`；`tests/plan-read-done-test.js` `checkTags` 對比計算
- **描述**：知識點係 🏆（`factMarks` derived）或者用戶喺 Study 手動剔咗「已掌握」，`factFullHtml` 會加 `.mastered`，成張卡半透明。呢種知識點喺計劃入面好多時都係「已完成」（G37 🏆 直接算完成），所以 tag 經常出喺半透明卡上面。實際合成之後 `--green` #2d6a4f 喺 `--success-bg` 上面，透過 0.55 opacity 疊喺 `--bg` #f0f2f7：**2.38:1**（未透明係 5.88:1）。test 用 `getComputedStyle` 嘅 `color` / `backgroundColor`，冇乘 ancestor opacity，所以話 pass；plan doc「文字對比 ≥ 4.5:1」對呢個情況唔成立。（卡入面其他字一樣褪色，navy 正文約 3.65:1，係舊有設計；但 tag 係今次新加、用嚟答「完成咗未」嘅資訊，褪色之後正正喺最常見嘅 🏆 情況最難睇。）
- **影響**：低視力用戶喺 🏆 知識點睇唔清「✓ 已完成練習」；test 嘅 a11y 保證有漏洞。
- **方案 A（推薦）**：只喺計劃 runner 入面唔褪 tag：`.plan-run-body .fact.mastered { opacity: 1; }`，再將褪色落返卡入面除咗 tag 以外嘅部分（例如 `.plan-run-body .fact.mastered > :not(.fact-src), .plan-run-body .fact.mastered .fact-src > :not(.fact-done-tag) { opacity: 0.55; }`）。Study 模式唔變。Trade-off：計劃 runner 同 Study 嘅褪色寫法唔同，要加注釋；test 要改成計 ancestor opacity（沿 parent 鏈乘 opacity 再合成）。
- **方案 B**：接受褪色（「已掌握嘅卡全部褪色」係舊有設計，tag 跟成張卡），但 test 改成計合成對比，並將 🏆 卡明文列做例外，plan doc 改返字眼。Trade-off：唔使改 CSS，但係 tag 喺最常見嘅完成情況仍然係 2.4:1。
- **推薦**：A；如果用戶覺得計劃入面已掌握嘅卡唔應該褪色，亦可以直接 `.plan-run-body .fact.mastered { opacity: 1 }`（要問用戶，因為會改 preview 之外嘅樣）。

### 🟢 S-153 — `plan-read-done-test` 小清理

- `checkMastered`：`(v.tag === EN_TAG) === mastered && v.practise === !mastered` 因為上一句已 assert `mastered` 係 true，其實就係 `v.tag === EN_TAG && !v.practise`，直接寫會易讀啲。
- `checkCounts`：`seedRead(pg, [...Array(40).keys()])` 嘅 40 係 magic number（假設任務 ≤ 40 條知識點）；可以俾 `seedRead` 收 `'all'`，或者喺 page 入面用 facts 長度。
- 方案 A：照上面改；方案 B：保留，加注釋講 40 > 任何閱讀任務嘅知識點數。推薦 A。

### 🟢 S-154 — en 主掣「Practise these N →」喺 320–390px 摺成兩行（舊有）

- **位置**：`.plan-run-nav`（PR6b 開始）
- 量度：en 主掣 58px（兩行）vs zh-HK 47px；今次 note 喺上面，冇令情況差咗。
- 方案 A：`.plan-run-nav .nav-btn:last-child { flex-grow: 2 }`（Prev 窄啲、主掣闊啲）；方案 B：en 用短啲嘅字（例如「Practise {n} →」）。Trade-off：A 改 layout、要睇 360px「Finish ✓」；B 要用戶批字眼。推薦另開 follow-up 問用戶。

### 🟢 S-155 — 冇 test 守住「錯題知識點任務最後一條冇 note、冇 tag」

- G41 ⑤ 講明錯題知識點任務不變，code 有 guard，但 suite 冇 assert。建議喺 `plan-run2-test` 或新 suite 加一句：錯題知識點任務最後一條 `.plan-fact-left` 同 `.fact-done-tag` 都冇。

### 🟢 S-156 — PR7c plan 嘅 `proposal:` origin 冇 `## Design Proposal` heading

- 按 v0.71 先例接受；但係 global-rules 規定 `proposal:` 要指去 `## Design Proposal` section。建議將「## 決定（G41）」改名或者加一個 `## Design Proposal` heading（連 preview 圖檔名），以後唔使再靠先例。

## ✅ 做得好嘅地方

- `planFactLastLeft` 抽出嚟，主掣同 note 共用，q = N 喺結構上保證，唔係靠兩段 code 碰啱。
- `factCard.js` 保持 generic：label 由 caller 傳入（`opts.doneTag`），Study 模式冇改，亦冇 import plan 嘅嘢；label 有 escape。
- 新 CSS 全部用 token（`--success-bg` / `--green` / `--flag-bg` / `--plan-orange-text` / `--fs-*` / `--space-*` / `--radius-pill`），同 `.sqm-node.mastered`、`.plan-tag.carry` 一致；`margin-left: auto` + `nowrap` 令 tag 擠唔落時自己一行靠右，320px 實測冇橫向 scroll。
- tag 係 `<span>`、冇 border、實心 pill、冇 pointer，同白底 navy 框嘅「▶ 練習」掣明顯唔同，唔似掣；note 有 `role="status"`。
- i18n：en 單 / 複數、zh-HK 書面語（「尚有…未完成練習，共…題」、「✓ 已完成練習」，同 G40 ③⑦ 加「已」嘅方向一致）。
- TDD：test commit（b7149fd）喺 feat commit 之前。
- 函數都短（新函數 ≤ 8 行），冇 magic number。

## 修正優先順序

| 優先 | ID | 動作 |
|---|---|---|
| 1 | W-048 | 方案 A（或者問用戶揀 B），同時修 test 嘅對比計算 |
| 2 | S-155 | 加錯題知識點任務嘅 guard test |
| 3 | S-153 | test 清理 |
| 4 | S-156 | plan doc 加 heading |
| — | S-154 | 另開 follow-up（舊有） |

## 修訂代碼（W-048 方案 A，參考）

```css
/* css/screens/plan.css — W-048: in the plan runner a mastered (🏆 / ticked) fact card fades everything but the
   G41 done tag, which must stay readable (2.4:1 when faded with the card) */
.plan-run-body .fact.mastered { opacity: 1; }
.plan-run-body .fact.mastered > :not(.fact-src),
.plan-run-body .fact.mastered .fact-src > :not(.fact-done-tag) { opacity: 0.55; }
```

test 對比：沿 `parentElement` 鏈乘 `opacity`，將 text 色同 tag 底色先同 tag 底色 / 卡底 / `--bg` 合成再計 ratio。

## Handoff receipt

```
HANDOFF_RECEIPT
agent: code-reviewer
task: review Study Plan PR7c (G41 reading done tags + last-fact undone note)
branch: claude/charming-hopper-48ypzp
commits: b7149fd, 5305f58, 74b999c
status: pass
score: 91
hard_gates: { lint: n/a, type: n/a, tests: pass (44/44), coverage: pass, no_critical: pass, security: n/a }
findings: { critical: 0, warning: 1 (W-048), suggestion: 4 (S-153..S-156) }
report: .proj-docs/reviews/2026-10-10_review_plan-pr7c.md
next_action: merge_develop
context: "Pass 91. n/q consistent: q shares planFactLastLeft with the main button; n>0 <=> q>0 because the pair's qids are the reading facts' planFactQids and both tasks use the same mastered set (q=0 guard is defensive only). Tag and Practise are mutually exclusive. Non-blocking but recommended before merge: W-048 — .fact.mastered (opacity 0.55, pre-existing) fades the new tag to 2.38:1 on 🏆 / ticked facts; the test's 4.5:1 check ignores ancestor opacity. Option A: plan-runner-scoped CSS that fades all but the tag (Study unchanged) + fix the test; option B: accept the fade and correct the test/plan wording — user's call. S-153 test cleanup, S-154 en main button wraps at 320–390px (pre-existing, follow-up), S-155 no test that wrong-facts tasks get no note/tag, S-156 add a ## Design Proposal heading to the PR7c plan. Dev questions: (1) extra lastUndoneQs key OK, (2) hide when q=0 OK, (3) reading-only OK per G41 ⑤, (4) S-154. No APP_VERSION bump needed (STUDY_PLAN_READY=false). Repo has no develop branch: merge_develop = PR into main."
```

---

## S-154 follow-up — 2026-10-10

- 審閱者：code-reviewer（獨立 subagent）
- 目標：branch `claude/charming-hopper-48ypzp`，`d39db6a...HEAD`：`71afc71` test（`checkNavOneLine`）、`2a5523d` CSS
- Design Origin：proposal（user decision 2026-10-10：保留「Practise these N →」字眼，一行，收窄左右 padding）
- 改動：`css/screens/plan.css` 加 `.plan-run-nav .nav-btn { padding-left/right: var(--space-4); white-space: nowrap; }`（12px → 8px）；`tests/plan-read-done-test.js` 加 320 / 360 / 390 × en / zh-HK 一行、冇 clip、≥ 44px 檢查
- 未升 APP_VERSION：plan 入口仲隱藏（`STUDY_PLAN_READY=false`），同意

### Hard gates

| Gate | 結果 |
|------|------|
| Lint / Type | n/a（純 JS + CSS，冇 linter / tsc） |
| Tests | pass — `tests/run-all.sh` 44/44（`tests/*.png` 已 `git checkout` 還原） |
| Coverage | pass — 新 rule 有專門 test |
| No Critical | pass |
| Security | n/a（冇新依賴） |

### 評分

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 25 | 25 | |
| 安全性 | 20 | 20 | |
| 可維護性 | 20 | 20 | token、有註釋、scope 窄 |
| 測試覆蓋 | 14 | 15 | S-157（−1） |
| 性能 | 10 | 10 | |
| 代碼風格 / a11y | 10 | 10 | |
| **總分** | **99** | **100** | |

**結果：pass**

### 檢查結果

1. **Selector scope**：`.plan-run-nav` 只喺 `planFactNavHtml`（`js/screens/planRun.js`）出現，即係 reading / wrong-facts runner 嘅 fact-view nav。`.plan-result-row` 嘅 nav row、mock 結果 row、quiz `#prevBtn/#nextBtn`、modal、`plan-block` / `plan-small` 都冇 `plan-run-nav`，唔受影響。Specificity (0,2,0) 高過 `.nav-btn` (0,1,0)，同 `.plan-run-body .nav-row .nav-btn`（flex / min-height）冇衝突。
2. **最長 N**：喺 browser 計（全部 dailyMins 30–120 × 多個考試日 × 休息日組合）：reading 任務 pair 嘅題數最多 **85**（`dailyMins 30`、`examDate 2026-10-08`、冇休息日），wrong-facts 任務（10 條 fact × 每條最多題數）最多 **43**，所以 N 一定係 1–2 位數。
3. **量度（實際 runner view，`?preview=plan`）**，320 / 360 / 390 × en / zh-HK，全部 1 行、`scrollWidth ≤ clientWidth`、row 冇 overflow、page 冇橫向 scroll：

   | View | 320 en | 320 zh-HK |
   |------|--------|-----------|
   | 第一條（Prev disabled + Next →） | 141 / 137px | 141 / 137px |
   | Reading 最後一條 N=85 | Prev 126 / 主掣 152px（字 136px） | 141 / 137px（字 97px） |
   | Review 最後一條「Finish ✓ / 完成 ✓」 | 141 / 137px | 141 / 137px |
   | Wrong-facts 最後一條（10 facts，N=26） | 126 / 152px | 141 / 137px |
   | 壓力測試 N=188 / 888（強制 label） | 120 / 158、117 / 161px，仍 1 行 | 1 行，剩 14–17px |

   高度：en 45px、zh-HK 47px，全部 ≥ 44px。
4. **nowrap 會唔會 clip**：唔會。flex item 預設 `min-width: auto`，`nowrap` 令 min-content = 成條 label，所以 320px 時主掣會撐大（152px），Prev 縮到 126px，字唔會被截。要 Prev 縮到 min-content（48 + 16 + 4px）先會 overflow，即主掣字要超過約 210px，比 N=888 仲長好多。副作用：en 最長 label 時兩粒掣唔等闊（126 vs 152px）；睇過 screenshot 可以接受，冇記號。
5. **Test 穩健性**：`Range.selectNodeContents` + `getClientRects()` 再按 `top` 去重計行數，對一個 text node 嘅 button 有效（摺行時每行一個 rect）；有 `width > 0` filter。`fits` 用 `scrollWidth ≤ clientWidth`，加埋 document 冇橫向 scroll。夠用，見 S-157。

### 🟢 S-157 — `checkNavOneLine` 只測 GOAL 嘅 N=39，冇查 row 本身有冇 overflow

- 位置：`tests/plan-read-done-test.js` `checkNavOneLine`
- 描述：用 fixture GOAL 嘅第一個 reading 任務（N=39）。2 位數最闊係 85–88，闊度差唔多，所以而家冇事。不過如果 row 嘅 ancestor 有 `overflow: hidden`，row 自己 overflow 唔會反映到 `document.scrollWidth`。
- 方案 A：每個 width 加一個 `row.scrollWidth <= row.clientWidth` assert，並將主掣 label 設做 `t('plan.run.practiseN', { n: 88 })` 再量一次（最壞 2 位數）。Trade-off：多兩行、要改 DOM text。
- 方案 B：維持原狀，靠今次 QA 數據（最大 N 85、N=888 都 fit）。Trade-off：0 成本，之後 label 改長要人手再量。
- 推薦：B（optional）；如果再改 label 字眼就做 A。

### 做得好嘅地方

- Scope 啱啱好，用 `--space-4` token，有註釋寫明 user 決定。
- 照 user 決定保留字眼，冇縮字。
- Test 覆蓋 3 個 width × 2 種語言，一次過查行數、clip、tap target。

### QA（reviewer 自己喺 browser 做）

Playwright Chromium，`?preview=plan`，320 / 360 / 390 × en / zh-HK，測咗 reading 第一條 / 中間 / 最後一條（最長任務 N=85）、review「Finish ✓」、wrong-facts 最後一條（加 400 個錯題到 quota 10）、強制 N=88 / 188 / 888。**48/48 case 全部 OK**：1 行、冇 clip、冇 overflow、≥ 44px。Screenshot 睇過（320 en N=85）：兩粒掣一行，冇截字。冇 ticket。

### 修正優先順序

| 優先 | ID | 處理 |
|------|----|------|
| 可選 | S-157 | test 加 row overflow + N=88 量度 |

### Handoff receipt

```
HANDOFF_RECEIPT
agent: code-reviewer
task: review S-154 follow-up (plan runner fact-view nav labels one line at 320-390px)
branch: claude/charming-hopper-48ypzp
commits: 71afc71, 2a5523d
status: pass
score: 99
hard_gates: { lint: n/a, type: n/a, tests: pass (44/44), coverage: pass, no_critical: pass, security: n/a }
findings: { critical: 0, warning: 0, suggestion: 1 (S-157) }
report: .proj-docs/reviews/2026-10-10_review_plan-pr7c.md#s-154-follow-up--2026-10-10
next_action: merge_develop
context: "Pass 99. Scope only .plan-run-nav (planFactNavHtml). Worst-case N 85 (reading) / 43 (wrong facts); browser QA 48/48 OK at 320/360/390 en+zh-HK incl. forced N=888; heights 45/47px. nowrap cannot clip (flex min-width:auto grows the main button; Prev shrinks to 126px at 320 en). S-157 optional test hardening. No APP_VERSION bump (plan hidden). No develop branch: merge_develop = PR into main."
```
