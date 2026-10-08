# Code Review — 2026-10-08 — v0.70 delta

- 審閱者：Code Reviewer（subagent）
- 目標：`claude/modest-keller-8m154v`，`git diff aa1df26..05daec4`（`cccc915` 係上一份 review 報告，唔計）
- 範圍：51eec2e（Practice 備注 hanging indent，`noteHtml` 搬去 `js/components/tags.js`，新 `css/components/note.css`）、17fae10（S-104）、0849fdc（S-105）、05daec4（冇 `text-box` 嘅瀏覽器 fallback）
- Design Origin：`baseline: user screenshot 2026-10-08`（Practice 備註 bullet wrap）— 有，同改動範圍配對（只改 note 排版，冇新 layout）
- 總評：**pass（99）**。0 Critical、0 Warning，新開 1 個 S（S-106：QA script v066 嘅 note DOM 期望值未跟新結構更新）。其餘觀察寫入正文，唔開 ID。

## Hard Gates

| Gate | 結果 | 依據 |
|---|---|---|
| Lint | n/a | 專案冇 eslint / package.json |
| Type check | n/a | 純 JS |
| Tests | pass | worktree（detached @ `05daec4`）：`tests/run-all.sh` **31 / 31 PASS**（exit 0） |
| Coverage | pass | 新 assertion 有 mutation 驗證（見下表） |
| No Critical | pass | 0 |
| Security scan | n/a | 冇新依賴；`noteHtml` 繼續全部經 `escapeHtml` |
| Batch replay | pass | `check-batch-replay.js`：745 records、skipped keep 3、0 mismatch |

QA scripts（同一 worktree，跑法同 `2026-10-08_qa_v069.md`）：v063 184 / 0、v065 275 / 0、v068 297 / 0、**v066 1678 / 192**。v066 嘅 192 個 fail 全部係 note DOM 結構期望值（190 個 answer box + 2 個 Result review 總結），係今次 fix 嘅預期改變，唔係 regression（詳見 S-106）。Worktree 已 `git worktree remove` + prune；main checkout 冇改任何 tracked 檔。

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 25 | 25 | |
| 安全性 | 20 | 20 | |
| 可維護性 | 20 | 20 | |
| 測試覆蓋 | 14 | 15 | S-106 |
| 性能 | 10 | 10 | |
| 代碼風格 | 10 | 10 | |
| **總分** | **99** | **100** | |

**結果：pass**

## Mutation check

| Mutation | 結果 |
|---|---|
| `.note-mark` 拎走 `width`（返去 `• ` 自然闊度） | examresult-test FAIL（3 行 wrap 唔齊）— killed |
| 刪走成條 `.note-mark` rule | examresult-test FAIL — killed |
| `index.html` 拎走 `note.css` `<link>` | examresult-test FAIL — killed |
| `sw.js` SHELL 拎走 `note.css` | sw-test FAIL（missing note.css）— killed |
| `.rv-note-line.sub` padding 改做 1 × indent | examresult-test 仍 PASS — not killed（見正文，唔開 ID） |
| 拎走 `.tl-year` `align-self: start`（S-104） | study-test FAIL（`tall: true`）— killed |

## 問題清單

### 🟢 S-106 — QA script v066 嘅 answer box / Result review note 檢查仲係舊 pre-wrap DOM 期望值

- 位置：`.proj-docs/qa/scripts/2026-10-07_qa-v066.js` 約 268–288 行（answer box）、325–340 行（Result review）
- 描述：51eec2e 將 `#ansNote` 由 pre-wrap 純文字改成 `noteHtml` 嘅一行一個 `.rv-note-line`，marker 包喺 `<span class="note-mark">`。v066 仲 assert：`span.ans-note-text` 冇 child、`textContent === q.note`、`white-space === 'pre-wrap'`；Result review 嗰邊 `foreign` 只容許 `DIV`，所以每個有 marker 嘅 note 都報「unexpected elements SPAN」。結果 en / zh-HK 共 190 個 answer box assertion 同 2 個 Result review 總結 assertion fail。
- 影響：App 行為正確（下面實測 169 個唯一 note、768 行逐行 textContent = trimmed 原文），但 v066 係 release QA 必跑 script；唔改嘅話下次 QA 會見到 192 個紅，要人手逐個判斷係咪預期，容易掩蓋真正 regression（同 v0.69 S-101 情況一樣）。
- 方案 A（推薦）：兩處改用同一套結構檢查：`[...root.querySelectorAll('.rv-note-line, .rv-note-gap')].map(d => d.classList.contains('rv-note-gap') ? '' : d.textContent)` 對 `q.note.split('\n').map(l => l.trim())`；`foreign` 容許 `DIV` 同 `SPAN.note-mark`（其他 tag 仍算 foreign）；刪走 `ws === 'pre-wrap'`，改 assert 每個 `.note-mark` 只出現喺行頭。answer box 同 Result review 可以共用一個 helper。
- 方案 B：answer box 只 assert「`.ans-note-text` innerHTML === `noteHtml(q.note)`」。最平，但係同 app 用同一個 function 自己驗自己，冇獨立 oracle。
- 推薦：A。唔 block release，同下一輪 QA 一齊做即可。

## 逐項審閱（冇開 ID 嘅觀察）

**51eec2e — Practice 備注 hanging indent**

- 邏輯：`noteLineHtml` 嘅 class 判斷同舊版一樣（兩個以上前置空格 = `sub`，行頭 `•` / `◦` / `→` = `bullet`，空行 = gap）；`NOTE_MARK` 食走 marker 後面嘅空白，再固定輸出 `marker + " "`。全部 data 掃過：250 個 note、768 行非空行，276 個 marker（`•` 138、`→` 75、`◦` 63）全部係「marker + 一個空格」，冇冇空格或多空格，冇「縮排但冇 marker」嘅子項，所以 **textContent 同改之前逐字一樣**。lang-switch-test（`#ansNote .ans-note-text` lang）、v065（`#ansNote` 有冇 text、label）、v068（`#ansNote` 文字 `includes`）、yue 系列 test 全部 PASS。
- 實測（Chromium，320 / 390 en、320 zh-HK、900 zh-HK，169 個唯一 note 逐個放入 `#ansNote`）：marker 字形冇一個超出 1.1em 嘅 `.note-mark` 盒（`→` 都唔超），所以唔會同後面文字重疊；有 wrap 嘅行（320px 33 行、390px 27 行）wrap 之後嘅行左邊同 marker 後第一個字對齊，0 個偏差。`→` 時間線行一樣用 mark 盒，效果同 `•` 一致，OK。
- 行中間有 `→` 嘅行（216 行，例如「A → B」）唔受影響：regex 只認行頭。冇 marker 嘅行（標題、散文）同改之前一樣冇 class。
- `innerText` / copy-paste：`.note-mark` 係 inline-block，Chromium 會吞咗盒尾嘅空格，所以 render 咗嘅 `innerText`（同 copy 出嚟嘅文字）係「•英國…」冇空格。只影響複製出嚟嘅格式，唔影響讀屏（仍然先讀 bullet 再讀內容）；唔開 ID。如果想保留，可以將空格搬出盒外（`<span class="note-mark">•</span> `）再將盒闊改做 `calc(var(--note-indent) - 0.25em)` 之類，但要重新校對齊，冇必要。
- HTML 結構：`<span class="ans-note-text">` 入面而家有 `<div>`（span 嘅 content model 唔應該有 block element）。經 innerHTML 插入，瀏覽器照放，`display: block` 令排版正確，所以唔開 ID；下次掂到可以改做 `<div class="ans-note-text">`（lang-switch-test 用 class selector，唔受影響）。
- Component 分層：`noteHtml` 放喺 `js/components/tags.js`，由 `screens/quiz.js` 同 `screens/result.js` 調用，方向正確（screen → component）。`escapeHtml` 喺 `js/core/utils.js`，比 components 早載入；而且 `noteHtml` 只喺 runtime call，top-level 只有 `NOTE_MARK` regex，冇載入次序問題。
- CSS：rule 由 `results.css` 搬去新 `css/components/note.css`，兩個 screen 共用；`--note-indent` 取代 hard-code 嘅 1.1em / 2.2em，`.note-mark` 嘅 `text-indent: 0` 防止 inline-block 繼承負 indent，做法啱。`em` 跟各自字號（answer box `--fs-sm`、review 12.5px），兩邊比例一致。`lang="zh-HK"` 喺外層 span 同每個 row 都有，重複但無害。
- SW / 舊 shell：`note.css` 已加入 `index.html` 同 `sw.js` SHELL（sw-test / structure-test PASS，mutation 會 kill）。`origin/main` 仲未有 v0.70，用戶會由 0.69 升上 0.70，cache 名跟 `APP_VERSION` 轉，新 index.html 同 note.css 一齊入新 cache，冇「舊 index.html + 新 JS」嘅組合；upgrade-test、v065 offline + upgrade PASS。
- Test 缺口（唔開 ID）：新 assertion 喺 390px 只有 3 行 bullet 真係 wrap，sub 行冇 wrap，所以 `.sub` 嘅兩層 indent 深度改錯都唔會 fail（見 mutation 表）。舊版 results.css 都冇幾何 assertion，屬 pre-existing；如果想補，可以加一個 320px 嘅 case 或者 assert sub 行文字起點比 bullet 行深 1 × indent。

**17fae10 — S-104**：`tall = r.height - padTop > lines × lineHeight + 1`，`.tl-year` `line-height: 1.2` 係數值，`parseFloat(cs.lineHeight)` 得到 px，唔會 NaN。Mutation 拎走 `align-self: start` 會 fail（7 個兩行年份都報 `tall: true`）。完成。

**0849fdc — S-105**：`home.js` 確認空 tile 只出 `.sub`，冇 `.t-note`；`.my-tile.empty > *` 同兩段 comment 已經跟 v0.70 行為。lang-switch-test / v068 「全部 0.6」仍 PASS。完成。

**05daec4 — `text-box` fallback**：用 Chromium 模擬冇 `text-box`（`text-box: none` + `--tl-year-pad: 13px`）同 v0.69（b66d169）比較：一行年份文字頂部 12px，同 v0.69 一模一樣；dot 中心 19.6px，對住 line box 中間（字形中間 19px，差 ~0.6px，同 comment 講嘅「~1px off centre」一致，仲好過 v0.69 嘅 23px）。支援 `text-box` 時（native）唔受影響。`@supports not (...)` 條件同主 rule 嘅值一致，OK。

## 做得好嘅地方

- 搵到根本原因（pre-wrap 冇得做 hanging indent，而 Results review 都因為「• 」比 1.1em 窄而差少少），一個 component 同時修兩個畫面，順手刪走 screen 內嘅重複 function。
- `.note-mark` 定闊盒 + `--note-indent` 變量，令 marker 闊度同 indent 永遠一致，唔再靠字形闊度巧合。
- 新 assertion 量「wrap 之後嘅行」同「marker 後第一個字」嘅實際位置，係測效果唔係測 CSS 值，mutation 驗證有效。
- S-104 / S-105 跟足上次建議方案 A；fallback 用 `@supports` 只影響舊瀏覽器，實測同 v0.69 一致。

## 修正優先順序

| 優先 | ID | 檔案 | 預計 |
|---|---|---|---|
| 1 | S-106 | `.proj-docs/qa/scripts/2026-10-07_qa-v066.js` | 兩處 note 檢查改用 row 結構（一個 helper） |

唔 block release；建議喺下一次 QA 跑 v066 之前做。

## 修訂後代碼（建議，S-106）

```js
// .proj-docs/qa/scripts/2026-10-07_qa-v066.js — S-106: notes render as noteHtml rows (v0.70) in both places
// in-page helper: rows of a note container, '' for a gap; foreign = anything but row DIVs and the marker span
const noteRows = root => ({
  lines: [...root.querySelectorAll('.rv-note-line, .rv-note-gap')].map(d => (d.classList.contains('rv-note-gap') ? '' : d.textContent)),
  foreign: [...root.querySelectorAll('*')].filter(e => !(e.tagName === 'DIV' || (e.tagName === 'SPAN' && e.classList.contains('note-mark')))).map(e => e.tagName),
  markNotFirst: [...root.querySelectorAll('.note-mark')].filter(m => m.parentElement.firstChild !== m).length,
});
// answer box: const r = noteRows(n.querySelector('.ans-note-text'));
//   ok(JSON.stringify(r.lines) === JSON.stringify(q.note.split('\n').map(l => l.trim())) && !r.foreign.length && !r.markNotFirst, …)
// Result review: same helper on .rv-note (minus the .rv-note-label row)
```

```
HANDOFF_RECEIPT
agent: code-reviewer
task: /review v0.70 delta (aa1df26..05daec4, excl. cccc915)
branch: claude/modest-keller-8m154v @ 05daec4
status: pass
score: 99/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass (run-all 31/31 in detached worktree @ 05daec4)
  coverage: pass (new assertions mutation-verified)
  no_critical: pass (0)
  security_scan: n/a (no new deps)
qa_scripts: v063 184/0, v065 275/0, v066 1678/192 (expected: old pre-wrap note DOM expectations, S-106), v068 297/0; batch replay 0 mismatch
findings:
  critical: []
  warning: []
  suggestion: [S-106]
report: .proj-docs/reviews/2026-10-08_review_v070-delta.md (untracked)
worktree: removed + pruned; no tracked files modified in main checkout
next_action: proceed_to_qa
notes: S-106 (update v066 note checks) non-blocking; do before or with the next v066 QA run
```
