# Batch Review — 2026-10-07 — v0.68 第 2 批：Study 知識點每章編號

- **日期**：2026-10-07（UTC）
- **審閱者**：Code Reviewer Agent
- **Branch**：`claude/quirky-keller-40h0qp`，HEAD `67d275a`
- **範圍**：`git diff 67d275a^1 67d275a^2`（10 個檔案，+133 / −17）
- **需求來源**：用戶 2026-10-07 口頭規格（冇 mockup）
  1. 知識點喺每章由 #1 數起；編號 = 喺 `STUDY` 入面同 `ch` 嘅位置，唔受 filter / 搜尋影響；內部 id 唔改
  2. Chapters 畫面左上角顯示 `#n`
  3. 時間線、地理、人物、Similar Core Fact：拎走獨立 `#id`，pill 改「📜 Ch 3 #1」；Core Fact 顯示「📌 Core Fact Ch 5 #38」
  4. Chapter、地理、人物分組標題拎走 `.cnt` 總數；頂部「n / n 項知識點」保留
- **總評**：改動細、集中，四點需求全部做到。Helper 用全量 `STUDY` 計數，搜尋同「隱藏已掌握」都唔會改號，有專門 assert 守住。`aria-describedby` 目標喺 Chapters（`.fact-id`）同其他三個畫面（pill）都存在，逐張卡驗過。Tests **31 / 31 PASS**，Red 真實。冇 🔴；1 個 🟡（W-016：練習 session 標題仍然顯示全域 id「Fact #21」）；4 個 🟢（S-070…S-073）。

---

## 整體 verdict

- **涵蓋 commit**：`a473cf6`（test）→ `142b7c4`（feat），merge `67d275a`
- **整體 score**：91 / 100
- **Status**：✅ pass（≥ 90、冇 Critical、hard gates 全過）

### Hard Gates

| Gate | 結果 | 證據 |
|---|---|---|
| Lint | n/a | 冇 ESLint；`structure-test` PASS |
| Type check | n/a | 冇 TypeScript |
| Tests | ✅ pass | 喺獨立 worktree（`scratchpad/rv2` @ `67d275a`）跑 `NODE_PATH=/opt/node-tools/node_modules ./tests/run-all.sh` → **31 / 31 PASS**，exit 0；跑完 `git worktree remove --force`，主 checkout 冇改動 |
| Coverage | n/a | 冇 coverage 工具；helper 有 unit 式 assert（全 236 條逐條對照獨立計算）+ 四個畫面 × 兩個語言逐卡 assert |
| No Critical | ✅ pass | 🔴 = 0 |
| Security scan | n/a | 冇新增依賴 |
| TDD Red | ✅ | 喺 `a473cf6`（test commit，產品代碼仍係 `3190c3b`）跑：`study-test` FAIL「Ch3 first card … "#1" … text "#7"」；`similar-test` FAIL「core fact label … "📌 Core Fact #203"」；`factsession-test` FAIL「described by … "#n": #21」。三個都係因為功能未做而 fail，唔係 test 寫錯 |

### Review Item ID

掃描 `.proj-docs/reviews/`：C 最高 `C-001`、W 最高 `W-015`、S 最高 `S-063`；另一位 reviewer 預留 `S-064`…`S-069`。今次新增 `W-016`、`S-070`…`S-073`。

---

## Section A — Study 知識點每章編號（feature/study/fact-chapter-number）

- **Commit**：`a473cf6`（test）、`142b7c4`（feat）、merge `67d275a`
- **Design Origin（建議 PR 第一行）**：`Design Origin: baseline: js/components/factCard.js + js/screens/study.js（用戶 2026-10-07 規格嘅 delta）`
  - 唔建議用 `proposal: 用戶 2026-10-07 規格`：global-rules §Design-Source Binding 規定 `proposal:` 要指向 spec / plan 入面嘅 `## Design Proposal` section 路徑；`.proj-docs/` 冇呢份文件，照寫會觸發「proposal 但冇 Design Proposal section → reject」。
  - `baseline:` 啱：改嘅係現有卡片同分組標題嘅**文字內容**，冇新 className（pill 沿用 `.tag`、編號沿用 `.fact-id`、Core Fact 只加一個冇 class 嘅 `<span lang="en">`），冇 layout 改動，刪一個 `.cnt` span。delta 遠低於 30%。

### 改動清單

| 檔案 | 改動 |
|---|---|
| `js/domain/similar.js` | 新 `chapterFactNumber(id)` + lazy memo `buildChapterFactNumbers()` |
| `js/components/factCard.js` | `chapterFactText()`；Chapters 畫面 `.fact-id` 顯示 `#n`；其他畫面 pill「icon Ch c #n」兼任 `aria-describedby` 目標；Core Fact label 拆成 `similar.coreFact` + `<span lang="en">Ch c #n</span>` |
| `js/screens/study.js` | 三個分組標題拎走 `<span class="cnt">` |
| `css/screens/study.css` | 刪 `.study-group-title .cnt` |
| `css/components/fact.css` | 只改注釋 |
| `locales/en.js`、`locales/zh-HK.js` | `study.factId` `#{id}` → `#{n}`；新 `study.chapterFactId: 'Ch {ch} #{n}'`（兩個語言都係英文，跟 S-057）；`similar.coreFact` 拎走 `#{id}` |
| `tests/*` | 見下面「測試」 |

### 重點查核結果

**1. Helper 放 `js/domain/similar.js` 嘅理由**
- 理由成立：驗過 v0.57 shell（`dc84cab:index.html`）已經有 `<script src="js/domain/similar.js">`，所以任何可能被 SW cache 住嘅舊 shell 都會載入新版 `similar.js`；開新 domain file 就要加入 `LATE_BOOT_SCRIPTS`，否則舊 shell 會 `ReferenceError`。`similar.js` 喺 `factCard.js` 之前載入，`STUDY`（`data/study.js`）更早，次序冇問題。
- 職責：`similar.js` 個 header 寫住「SIMILAR — every question belongs to one STUDY fact」，章節編號唔屬於「相似題」概念，輕微混雜。不過呢個 file 本身已經係「由 `STUDY` 建 index」嘅地方（`FACT_BY_QKEY`），加一個 `id → 章內序號` index 算同類。→ **S-070**（改 header 或者搬去 `factCard.js`）。
- 唔使開新 file 嘅其他位置：`factCard.js`（唯一 consumer，舊 shell 由 `LATE_BOOT_SCRIPTS` 補載，一樣安全）；`questions.js`（有 `chapterOf` 等章節 helper，但係講 exam 唔係 fact）。我傾向保留喺 `similar.js` 但改 header，代價最細。

**2. Memoize 正確性**
- `STUDY` 係 `data/study.js:8` 嘅 `const` array literal；全 codebase grep `STUDY.(sort|push|splice|reverse|unshift|pop|shift)` 同重新賦值 → 0 個。`sortPeople` sort 嘅係 `STUDY.filter(...)` 出嚟嘅新 array；`renderStudyChapters` 搜尋時 `pool = STUDY`，但之後 `pool.filter(...)` 都係新 array。所以 cache 永遠唔會過期 ✅
- Lazy 其實冇必要：`STUDY` 喺 `similar.js` 之前已經載入，可以好似 `FACT_BY_QKEY` 咁 eager 建，少一個可變 module state。→ **S-071**

**3. `aria-describedby` 目標**
- Chapters（`noChapter: true`）：目標係 `<span class="fact-id" id="factId{id}">`；其他三個畫面：目標係 pill `<span class="tag" id="factId{id}">`。兩個分支互斥，每張卡剛好一個 element 有呢個 id ✅
- 同一 id 會唔會出兩次：Core Fact（`factCoreHtml`）冇 id、冇 Practise 掣；Study 每個 tab 每條 fact 只出一次（geo / people 用 `f.geo[0]` / `f.p[1]` 單值分組）✅
- `checkChapterNumbers` 喺 en 四個畫面 + zh-HK 四個畫面逐卡驗 `document.getElementById(aria-describedby) === 目標`，有區分力 ✅
- 小問題：非 Chapters 畫面嘅描述文字包埋 emoji（讀屏會讀「scroll Ch 3 #1」）。→ **S-073**

**4. `study.factId` `{id}` → `{n}` call site**
- `grep "study.factId"`：唯一 call site 係 `factCard.js:28`，已傳 `{ n }` ✅；`similar.coreFact` 唯一 call site `factCard.js:86` 唔再傳參數 ✅
- `i18n-test` 嘅 `paramsOf` 比較 en / zh-HK 每個 key 嘅 `{params}`，兩邊都係 `{n}` / `{ch},{n}` → PASS ✅
- 仍然傳 `{id}` 嘅：`common.factSet: 'Fact #{id}'` / `'知識點 #{id}'`（`questions.js:74`）—— 呢個係**另一個 key**，唔係漏改；但佢喺 quiz header / result 顯示全域 id，同今次「全域 id 唔再顯示」嘅方向唔一致，而且 locale 新注釋「the global fact id is never shown」因此唔準確。→ **W-016**

**5. 升級途中新舊檔案混用**
- 舊 shell + 新 js（upgrade-test 情景 1 / 5 / 6 嘅模型）：舊 shell 一定有 `similar.js` tag，`factCard.js` 由 `LATE_BOOT_SCRIPTS` 補；兩個都由新 SW cache 出新版 → 冇 ReferenceError，冇 `{n}` 原文。`upgrade-test` PASS ✅
- 新 `factCard.js` + 舊 `locales/en.js`：SW install 用 `cache: 'reload'` 一次過 `addAll` 成個 SHELL，同一 cache 入面版本一致；要混用只會喺「頁面載入到一半 SW activate + `clients.claim()`」嘅極窄窗口。屆時會見到 `#{id}`（舊 `factId` 冇 `n` 參數，`interpolate` 保留原文）同 `study.chapterFactId`（key 唔存在，`t()` 回 key 名），但唔會 throw；下次 reload 即正常。反方向（舊 `factCard.js` + 新 locale）會見到 `#{n}`。呢類 js-vs-js 混用係 v0.57 起已存在、項目未有覆蓋嘅情況（例如 `factCard.js` 亦依賴 `mastery.js` 嘅 `factMastery`），今次冇令風險變大，唔開 item。
- ⚠️ Release 提醒（唔係 item）：`APP_VERSION` 仍然係 `0.67`（截圖都見 v0.67）。如果 release chore 冇 bump，`sw.js` 內容唔變 → 現有用戶永遠收唔到新檔。項目慣例係另開 `chore: v0.68` commit，請 main agent 記住。

**6. 刪 `.cnt` CSS**
- `grep` 全 repo（排除 `.claude/worktrees/` 舊 worktree 同 tests）：`js/`、`css/`、`index.html` 冇任何 `.cnt` 使用者 ✅。冇 dead selector 殘留。

**7. Style 規則**
- 冇新 className ✅；冇新 hardcoded 顏色 / 字號（只改注釋）✅
- Magic number：產品代碼冇；tests 嘅 `FACT_CHAPTER_NUM = 15`、`STUDY_TOTAL = 236` 都有命名常數同注釋 ✅
- 函數長度：`buildChapterFactNumbers` 8 行、`chapterFactNumber` 4 行、`factTagsHtml` 11 行 ✅。`factCard.js:28` 一行約 170 字元，可讀性一般（併入 S-073 修正）。

**8. 測試**
- Red 真實（見 Hard Gates）。
- 期望值由 test 自己用 `STUDY.filter(x => x.ch === f.ch).indexOf(f) + 1` 計，唔係 call app helper，冇 tautology ✅
- 覆蓋：helper（首 = 1、尾 = 章總數、236 個 `(ch, n)` 唯一）；en 四個畫面 + zh-HK 四個畫面逐卡；搜尋「Magna」唔變 #1；「隱藏已掌握」後剩低嗰張仍係 `#2`；Ch1 / Ch4 首卡；Core Fact en + zh-HK；分組標題冇 `.cnt` 兼冇尾數字 ✅
- 截圖 `.proj-docs/qa/screenshots/v068/` 睇過：zh Chapters Ch3 `#1 / #2`、「91 / 91 項知識點」保留、標題冇總數；Timeline pill「📜 Ch 3 #1」；Core Fact「📌 核心知識 CH 5 #38」—— 注意係大楷 `CH`。→ **S-072**

### 發現

#### 🟡 W-016 — 練習 session 標題仍顯示全域 id「Fact #21」

- **位置**：`locales/en.js:186` `common.factSet: 'Fact #{id}'`、`locales/zh-HK.js:183` `'知識點 #{id}'`；call site `js/domain/questions.js:74`（`examLabel`，用喺 `#quizLabel`、`#resultLabel`、result 分享文字）
- **描述**：用戶喺卡片見「📜 Ch 3 #15」，撳「▶ 練習呢 8 題」之後 quiz header 變「Fact #21」。今次改完之後，全域 id 喺 Study 同 Similar 都唔再出現，呢個 21 變成用戶完全對唔返嘅數字。另外 `study.factId` 上面新加嘅注釋「the global fact id is never shown」唔準確。
- **影響**：UX 不一致、注釋誤導後來者。唔影響數據（session key `f21` 照用全域 id 係啱嘅）。
- **注意**：用戶四點規格冇明講呢個位，改之前要問用戶確認。
- **方案 A**：`common.factSet` 改成 `'Fact · Ch {ch} #{n}'` / `'知識點 · Ch {ch} #{n}'`，`examLabel` 由 `factIdOf(examNum)` 搵 fact 再傳 `{ ch, n: chapterFactNumber(id) }`。好處：同卡片一致；代價：改多一個 locale 參數 + `factsession-test` 三個 assert，同埋同樣嘅升級混用考慮。
- **方案 B**：保留「Fact #21」，只改注釋為「the Study / Similar UI never shows the global id; common.factSet still does」，喺 HANDOFF 記低。好處：零風險；代價：不一致仍在。
- **推薦**：A（先問用戶）；如果用戶話唔使，做 B。

#### 🟢 S-070 — `similar.js` header 唔再反映內容

- **位置**：`js/domain/similar.js:1-3`
- **描述**：file header 只講「SIMILAR」，而家多咗章內編號 index。理由（舊 shell 有 tag）有效，但下一個人搵 `chapterFactNumber` 唔會諗到去 similar.js。
- **方案 A**：header 改成「SIMILAR + fact indexes — every question belongs to one STUDY fact; facts are also numbered within their chapter」，保留位置。
- **方案 B**：搬去 `js/components/factCard.js` 頂部（唯一 consumer，`LATE_BOOT_SCRIPTS` 已覆蓋）。代價：domain 邏輯入 component。
- **推薦**：A。

#### 🟢 S-071 — Lazy memo 冇必要，可以同 `FACT_BY_QKEY` 一樣 eager 建

- **位置**：`js/domain/similar.js:17-29`
- **描述**：`STUDY` 喺 `similar.js` 之前已載入，`FACT_BY_QKEY` 就係喺 load 時建。`let chapterFactNumbers = null` + null check 多一個可變 module state，冇性能收益（236 條，一次 forEach）。
- **方案 A**：`const CHAPTER_FACT_NUMBER = buildChapterFactNumbers();`，`chapterFactNumber = id => CHAPTER_FACT_NUMBER[id]`。
- **方案 B**：維持 lazy，但加一行 WHY 注釋。
- **推薦**：A（同檔案風格一致）。

#### 🟢 S-072 — Core Fact label 被 `text-transform: uppercase` 變成「CH 5 #38」

- **位置**：`css/components/fact.css:95` `.sqm-fact-label { text-transform: uppercase }`；`factCard.js:86`
- **描述**：用戶規格寫「📌 Core Fact Ch 5 #38」，卡片 pill 都係「Ch 3 #1」，但 Core Fact 顯示「CH 5 #38」（見 `zh-similar-core.png`）。嚴格嚟講同規格字面唔一致，亦同 pill 寫法唔一致。
- **方案 A**：`.sqm-fact-label [lang="en"] { text-transform: none; }`（冇新 className，用現有 attribute selector）。
- **方案 B**：接受大楷，視為 label 整體風格，喺 HANDOFF 記低。
- **推薦**：問用戶；傾向 A。

#### 🟢 S-073 — Practise 掣嘅描述包埋 emoji；`factTagsHtml` 首行過長

- **位置**：`js/components/factCard.js:28`、`:32`
- **描述**：非 Chapters 畫面 `aria-describedby` 指向成個 pill，讀屏讀「scroll Ch 3 #1」/「classical building Ch 5 #38」。另外第 28 行 ternary + template 約 170 字元。
- **方案 A**：pill 入面將 icon 包 `<span aria-hidden="true">`，`id` 放喺包住「Ch c #n」嘅內層 span；第 28 行抽成 `factNumberTagHtml(f)`。
- **方案 B**：維持現狀（描述仍然有意義），只拆長行。
- **推薦**：A；記住同步改 `checkChapterNumbers` 嘅 `target === pill`。

### 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 20 | 25 | 四點需求全做到；W-016 −5 |
| 安全性 | 20 | 20 | 新插值全部經 `escapeHtml`；`f.ch` / `n` 係數字 |
| 可維護性 | 18 | 20 | S-070、S-071 各 −1 |
| 測試覆蓋 | 15 | 15 | Red 真實；en + zh-HK；搜尋 / filter 唔改號；helper 對照獨立計算 |
| 性能 | 10 | 10 | 一次 O(n) 建 index |
| 代碼風格 | 8 | 10 | S-072、S-073 各 −1 |
| **總分** | **91** | **100** | |

**結果：✅ pass**

---

## ✅ 做得好嘅地方

- 編號由全量 `STUDY` 計，明確同 filter / 搜尋脫鈎，而且有「搜尋唔變 #1」「隱藏已掌握仍係 #2」兩個針對性 assert。
- 只改顯示：`data-fact-id`、bookmarks、mastery、localStorage、session key 全部仍用全域 id，冇 migration 風險。
- `chapterFactText` 一個函數供 pill 同 Core Fact 共用，`lang="en"` 處理跟 S-057 一致。
- 測試期望值獨立計算，唔係 call 被測 helper；`aria-describedby` 逐卡驗目標存在兼正確。
- 刪 `.cnt` 連 CSS 一齊刪，冇 dead selector。
- 放 `similar.js` 嘅理由有寫 WHY 注釋，而且經得起驗證（v0.57 shell 已有 tag）。

## 修正優先順序

| 優先 | Item | 需要用戶決定？ |
|---|---|---|
| 1 | W-016 | 係（方案 A 定 B） |
| 2 | S-072 | 係（大楷接唔接受） |
| 3 | S-073 | 否 |
| 4 | S-071 | 否 |
| 5 | S-070 | 否 |

每個 item 一個 commit，格式 `fix: S-071 | eager chapter fact number index`。

## 修訂後代碼（建議）

`js/domain/similar.js`（S-070 + S-071）：

```js
// ════════════════════════════════════════
// SIMILAR + fact indexes — every question belongs to one STUDY fact (fact.src = "exam.idx" keys);
// other questions of the same fact are the same point asked differently. Facts are also numbered within their chapter.
// ════════════════════════════════════════
// ...FACT_BY_QKEY / factOf / similarKeys 不變...

// Lives here, not in a new file: a cached older index.html has no <script> tag for a new domain file (SW cutover).
function buildChapterFactNumbers() {
  const seen = {}, numbers = {};
  STUDY.forEach(f => {
    seen[f.ch] = (seen[f.ch] || 0) + 1;
    numbers[f.id] = seen[f.ch];
  });
  return numbers;
}
const CHAPTER_FACT_NUMBER = buildChapterFactNumbers(); // STUDY is constant data, loaded before this file
const chapterFactNumber = id => CHAPTER_FACT_NUMBER[id];
```

`js/components/factCard.js`（S-073）：

```js
// the number the Practise button is described by; the icon is decorative so the description reads "Ch 3 #1"
function factIdTagHtml(f, opts) {
  if (opts.noChapter) return `<span class="fact-id" id="${factIdElId(f)}">${t('study.factId', { n: chapterFactNumber(f.id) })}</span>`;
  return `<span class="tag" lang="en"><span aria-hidden="true">${CHAPTER_ICONS[f.ch]}</span> <span id="${factIdElId(f)}">${escapeHtml(chapterFactText(f))}</span></span>`;
}
```

（`factTagsHtml` 第一個 tag 改用 `factIdTagHtml(f, opts)`，並刪走尾部 `!opts.noChapter` 嗰行。）

`css/components/fact.css`（S-072 方案 A）：

```css
/* S-072: the "Ch 5 #38" number keeps its case, like the "Ch 3 #1" pill */
.sqm-fact-label [lang="en"] { text-transform: none; }
```

---

## Handoff receipt

```handoff-receipt
protocol: 1
status: pass
score: 91/100
batch:
  - feature: study/fact-chapter-number
    commits: [a473cf6, 142b7c4, 67d275a]
    status: pass
    score: 91/100
    design_origin: "baseline: js/components/factCard.js + js/screens/study.js（用戶 2026-10-07 規格嘅 delta）"
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
  no_critical: pass
  security_scan: n/a
critical_count: 0
new_items:
  critical: []
  warning: [W-016]
  suggestion: [S-070, S-071, S-072, S-073]
next_action: merge_develop
context: "v0.68 batch 2 (per-chapter fact numbers): 31/31 tests pass in a separate worktree, Red verified on a473cf6 (study / similar / factsession all fail before 142b7c4). chapterFactNumber in similar.js is justified (similar.js tag exists since v0.57 shell dc84cab); STUDY is never mutated so the memo is safe; aria-describedby targets exist in all 4 tabs x en/zh-HK; no other study.factId call site; .cnt has no other users. Non-blocking: W-016 common.factSet still shows the global id 'Fact #21' in the quiz header (ask the user: A = 'Ch c #n', B = keep and fix the comment); S-070 similar.js header; S-071 eager index; S-072 Core Fact shows 'CH 5 #38' (uppercase); S-073 icon inside the aria description. Use 'Design Origin: baseline: ...' not 'proposal:' (no ## Design Proposal section exists). Release reminder: APP_VERSION is still 0.67 — bump in the v0.68 chore or the SW will not update. Repo has no develop branch: merge_develop means PR from claude/quirky-keller-40h0qp into main, then invoke QA."
blockers: []
```
