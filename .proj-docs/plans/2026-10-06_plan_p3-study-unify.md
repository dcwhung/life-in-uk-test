# Implementation Plan：P3 Study Mode 同 Practice / Exam UI 統一（+ CUI-0008 + S-022）

**版本**：v1.0
**日期**：2026-10-06
**關聯 Spec**：冇獨立 spec；需求來源 = `.claude/session-logs/2026-10-06_20-56.md`「下次 Session 建議任務 1」+ Architect 可行性結論（2026-10-06，連補充評估）+ 用戶 2026-10-06 決定
**關聯 Ticket / Review**：`.tickets/pending/0001-0200/CUI-0008.md`、`.proj-docs/reviews/2026-10-06_review_v060-fixes_batch.md`（S-020、S-022）
**Mockup**：`mockups/study-unify.html`（8 個情景，每個情景改前 / 改後並排，390px + 900px）
**Base**：branch `claude/intelligent-lovelace-zczz0o` = `main` `bab51fd`（v0.60）
**負責人**：Project Manager + Architect Agent

> 註：`.proj-docs/index.md` 未存在（`.proj-docs/` 只有 `qa/`、`reviews/`），今次新開 `plans/`。建議下次 `/docs` 補 index。

---

## 0. 範圍一覽

| # | 項目 | 來源 | 版本 | Lane |
|---|------|------|------|------|
| 1 | Study 書籤 ★ → Practice 橙色 SVG（資料分開存，唔合併）+ O1 aria / O2 hit area | P3 | v0.62 | V |
| 2 | 選中色 purple → navy；搜尋 focus navy-light（O3）；裝飾色按 Q2 | P3 | v0.62 | V |
| 3 | `factMastery(f)`：手動剔 或 來源題全 🏆；推算 🏆 唔畀撳；O4 字眼；O7 整體進度 | P3 | v0.63 | C |
| 4 | `factCard.js` + `fact.css`（full / core variant）+ O5 卡樣式 | P3 | v0.63 | C |
| 5 | 難度 `starsHtml(f.d)` 取代 `'★'.repeat`，刪 `.tag.diff` | P3 | v0.62 | V |
| 6 | Fact → 來源題目 session（↩ Back 返 Study）+ 來源 node 列取代「Appears ×n」 | P3 | 引擎 v0.62（C2）/ UI v0.63（C） | C2 → C |
| 7 | S-022：`.install-close` hit area 44px（視覺唔變） | Review | v0.61 | P |
| 8 | CUI-0008 / S-020：`promptInstall()` 取消後死掣 + 雙擊 | QA | v0.61 | P |
| — | O8：卡 radius 統一 | P3 | v0.62 | V |

**O 編號對照（Architect 補充評估 §7c）**：O1 = fact 掣 `aria-label` / `aria-pressed`；O2 = `.fact-btn` hit area；O3 = Study 入面 chip 選中色唔一致（第 2 項一併解決；搜尋 focus 改 navy-light 都歸呢度）；O4 = 字眼跟 glossary「🏆 Mastered」；O5 = 卡樣式唔統一（`.fact` / `.flag-item` / `.sqm-item`，第 4 項 component 定）；O6 = 首頁 Reset 唔清 Study 剔同書籤（**用戶已決定：唔清，維持現狀**，只喺 HANDOFF 記錄）；O7 = Study 頂部整體「🏆 n / 236 mastered」；O8 = radius 未 token 化（`.tag` 5px、`.fact-btn` 7px）同卡 radius 統一；O9 = Home Practice 章節 badge `.ch-num` 紫色（跟 Q2）。

---

## 1. 可行性評估

### 技術可行性
| 項目 | 評估 | 備注 |
|------|------|------|
| 技術棧支持 | ✅ | 純 HTML / vanilla JS / CSS，classic `<script>`；冇新依賴 |
| 第三方依賴 | ✅ | 無 |
| 資料 / storage | ✅ | 唔改任何 localStorage key、唔使遷移；`lifeuk.studyBookmarks` 同 `lifeuk.flags` 分開存 |
| 向後兼容 | ⚠️ | `tests/upgrade-test.js:64-66` 喺 v0.57 同現版跑同一段 code，直接讀 global `study.mastered`、`study.bookmarks`、`.study-tab.active` → 三者名同形狀**必須保留**（`factCard.js` 唔讀 `study` global，由 `study.js` 傳入） |
| 顏色語意 | ⚠️ | 紫色全 app 已代表「廣東話翻譯」（`quiz.css` Translate、`.q-yue`、`.opt-yue`、results、flagged）→ Study 選中色要離開紫色；`.fact-yue` 保持紫 |
| 性能 | ✅ | `factMastery` 每張卡最多 8 次 `isMastered`（236 facts × 平均 1.6 題），即時計唔落 storage，可忽略 |
| 安全要求 | ✅ | 新 template 一律 `escapeHtml`；新 action 經 `ACTIONS` + `numArg` |
| 離線 / SW | ⚠️ | 新 file（`factCard.js`、`fact.css`、可能 `sideSession.js`）要行三步：`index.html` tag、`sw.js` SHELL、升 `APP_VERSION` |

**總體可行性**：✅ 可行

**有條件嘅地方**：第 6 項風險最高 —— 暫存 / 還原 global `state` 易漏欄位（`flags`、`setPool`、`masteredBefore`、`reviewTotal`、`cleared`）、`renderRoundNote` 只認 `isSimilarSession()`、計時器要 `stopExamTimer()`。所以拆做 C2（引擎、冇 UI、獨立測試）先行。

---

## 2. Lane / PR 拆分決定

### 揀咗：方案「P → (V ∥ C2) → C」，三個 PR

| PR | 版本 | Lane | 內容 | 可幾時開始 |
|----|------|------|------|-----------|
| PR-1 | v0.61 | **P**（PWA） | 第 7、8 項 | **即刻**（唔使等 mockup 確認；冇 UI 改動） |
| PR-2 | v0.62 | **V**（視覺）∥ **C2**（session 引擎） | V：第 1、2、5 項 + O1 / O2 / O3 / O8；C2：`similarReturn` 泛化做 `sessionReturn` + `startFactPractice(id)`，**冇入口掣** | V：用戶揀完 Q1-Q2 後；C2：即刻 |
| PR-3 | v0.63 | **C**（組件 + 掌握 + 入口） | 第 4 → 3 → 6（UI 部分）+ O4 / O7 / O5 | PR-2 merge 後；Q3、Q6 要揀咗 |

### 理由
1. **風險隔離**：第 6 項係成個 P3 最易出 regression 嘅部分（global `state`）。抽做 C2 一個「行為不變嘅 refactor + 未有入口嘅新 API」，用 engine-level 測試（`page.evaluate(() => startFactPractice(21))`）鎖死暫存 / 還原，之後 Lane C 只係接掣。
2. **可並行**：V 改 `study.js`（只限 `factTagsHtml` / `factMarkButtonsHtml`）、`chips.css`、`study.css`、`home.css`、`tokens.css`；C2 改 `similarPanel.js`、`quiz.js`、`home.js`、`questions.js`、`config.js`、`actions.js`、新 `sideSession.js`。唯一重疊 `locales/en.js`（唔同 section，V 改 `study.*`、C2 加 `common.factSet`）同 `APP_VERSION`（由 main agent 喺 PR 層統一升）→ textual merge 冇衝突，但**合併後必跑全套測試**（上次 P2 有 semantic conflict）。
3. **V 同 C 唔可以 parallel**：C 會將 V 剛改完嘅 `factTagsHtml` / `factMarkButtonsHtml` 搬入 `factCard.js`，同一批 function。所以 V 先、C 後。
4. **用戶可以早啲見到效果**：v0.62 已經有顏色 / 書籤 / 星；v0.63 先有掌握聯動同跳題。每個 PR 細，review 易。
5. **唔揀「V → C 全 serial、兩個 PR」**：C2 部分要等 V 完先開始，浪費 1 個 lane 時間；而且第 6 項同 UI 改動擠埋一個 PR，出事難定位。

---

## 3. 階段劃分

### Phase 1：PWA 修正（PR-1，v0.61，Lane P）
- **目標**：修好 install banner 嘅死掣、雙擊、✕ 觸控範圍
- **包含功能**：第 7 項（S-022 方案 A）、第 8 項（CUI-0008 / S-020 方案 B）
- **預計工作量**：小（0.5 日，含測試）
- **完成標準**：`pwa-test` 新 4 個斷言 Red → Green；`tests/run-all.sh` 全 PASS；CUI-0008 移去 resolved；HANDOFF 加「iOS Safari 冇 `beforeinstallprompt`，banner 永遠唔出」

### Phase 2：視覺統一 + session 引擎（PR-2，v0.62，Lane V ∥ Lane C2）
- **目標**：Study 外觀同 Practice 一致；fact session 引擎就位但未有入口
- **包含功能**：第 1、2、5 項 + O1 / O2 / O3 / O8（V）；第 6 項引擎（C2）
- **預計工作量**：V 中（1 日）；C2 中（1 日）
- **完成標準**：Mockup 情景 ①④ 揀定嘅 variant 同實作一致（visual-diff 只見預期 delta）；Similar 行為不變（`similar-test`、`quicknav-test` 改名後全過）；新 `factsession-test` 覆蓋 §5 R-001 清單；`upgrade-test` 唔改照過

### Phase 3：Fact 卡組件、掌握聯動、入口（PR-3，v0.63，Lane C）
- **目標**：Study 同 Similar 共用一個 fact 卡；Study 掌握跟 Practice；由 fact 直接練來源題
- **包含功能**：第 4 → 3 → 6（UI）+ O4 / O7 / O5
- **預計工作量**：中至大（1.5–2 日）
- **完成標準**：Mockup 情景 ②③⑤⑥⑦ 一致；`factCard.js` 冇讀 `study` global（structure-test 守）；`i18n-test` 冇未用 key（`study.appears` 刪走）；全套測試 + visual-diff PASS

---

## 4. 任務分解

### Phase 1 — Lane P（v0.61）

| 任務編號 | 任務描述 | 類型 | 負責 Agent | Mockup Binding | 預計工作量 | 依賴任務 | 優先級 |
|----------|----------|------|-----------|----------------|-----------|----------|--------|
| T-001 | `js/pwa/pwa.js` `promptInstall()` 方案 B：一開頭 `const ev = deferredPrompt; deferredPrompt = null;`，`ev.prompt()` 加 `.catch(() => {})`；`await ev.userChoice` 後**任何 outcome** 都收 banner，`dismissed` **唔寫** `INSTALL_DISMISSED_LS`；加 `window.addEventListener('appinstalled', …)` 收 banner。只改 `pwa.js` | fix | Frontend Developer | none-required | 1h | - | P0 |
| T-002 | `css/components/popover.css` `.install-close`：加 `position: relative` + `::before { content:''; position:absolute; inset:-8px; border-radius: var(--radius-circle); }`，視覺 28px 唔變，可撳範圍 44px | fix | Frontend Developer | mockup: mockups/study-unify.html#install | 0.5h | - | P1 |
| T-003 | `tests/pwa-test.js` 加 4 個 case（先紅後綠）：① `dismissed` → banner 收起，`lifeuk.installDismissed` 仍係 `null`；② `Promise.all([promptInstall(), promptInstall()])` → stub `prompt` 只 call 1 次、冇 unhandled rejection；③ dispatch `appinstalled` → 收起；④ `elementFromPoint`（✕ 中心 ±20px）返 `.install-close` | test | Frontend Developer | none-required | 1.5h | T-001, T-002 | P0 |
| T-004 | 升 `APP_VERSION` 0.61；HANDOFF PWA 段（新行為 + iOS 冇 install 提示）；CUI-0008 → resolved | docs | Main agent | none-required | 0.5h | T-003 | P1 |

### Phase 2 — Lane V（v0.62）

| 任務編號 | 任務描述 | 類型 | 負責 Agent | Mockup Binding | 預計工作量 | 依賴任務 | 優先級 |
|----------|----------|------|-----------|----------------|-----------|----------|--------|
| T-101 | 選中色：`chips.css` `.study-tab.active`、`.chip.ch.active` → `--navy`（`.chip.ch.active` 規則可直接刪，跟 `.chip.active`）；O3：`study.css` `.study-search:focus` → `--navy-light`。class 名唔改（`.study-tab.active` 係 upgrade-test hook） | feature | Frontend Developer | mockup: mockups/study-unify.html#study-chapters | 0.5h | Q2 已揀 | P0 |
| T-102 | 裝飾色（Q2 揀定 A / B / C）：`tokens.css` 加語意 token `--study-accent` / `--study-accent-strong` / `--study-accent-bg`；`study.css` `.fact` 左邊框、`.tag.year`、`.study-sub-title`、`.tl-year` + `::after`；`home.css` `.chapter-btn .ch-num`、`.chapter-btn:hover` 全部改用新 token。戰爭（紅）唔郁 | feature | Frontend Developer | mockup: mockups/study-unify.html#study-chapters ; mockup: mockups/study-unify.html#timeline | 1h | Q2 已揀 | P0 |
| T-103 | 第 5 項：`study.js` `factTagsHtml` 用 `starsHtml(f.d)`（`icons.js:16-18`）取代 `'★'.repeat(f.d)`；刪 `study.css` `.tag.diff`；`tests/diff-test.js:53` 改斷言 `.fact .stars` | feature | Frontend Developer | mockup: mockups/study-unify.html#study-chapters | 0.5h | - | P1 |
| T-104 | 第 1 項：`factMarkButtonsHtml` 書籤掣 → `bookmarkSvg('', { decorative: true })`；保留 class `fact-btn star`（`study-test.js:76` hook）+ `on`；CSS 用 `.flag-btn` 同款（outline muted / on = `--orange` 填色 + `--flag-bg`）；chip「Bookmarked only」用 `bookmarkSvg('chip-flag')`，`en.js` `study.bookmarkedOnly` 改 `Bookmarked only`（拎走 ★）。資料仍寫 `lifeuk.studyBookmarks`，同 Practice flags 分開 | feature | Frontend Developer | mockup: mockups/study-unify.html#study-chapters | 1.5h | - | P0 |
| T-105 | O1：兩粒 fact 掣加 `aria-label`（`study.bookmark` / `study.mastered`）+ `aria-pressed`；O2：`.fact-btn` 32×32 + `::before inset:-6px` → 44px hit area | feature | Frontend Developer | mockup: mockups/study-unify.html#study-chapters | 1h | T-104 | P1 |
| T-106 | O8：fact 卡 radius / 左邊框 / padding 定稿（`--radius-md`、4px、12px 14px）；`.sqm-fact` 左邊框 3px → 4px、radius `0 8px 8px 0` → `--radius-md`（同 Q3 推薦一致；如 Q3 揀「兩邊白卡」改喺 T-203 做） | feature | Frontend Developer | mockup: mockups/study-unify.html#similar-core | 0.5h | - | P2 |
| T-107 | 測試：`study-test`（書籤 SVG、`aria-pressed` 切換）、`structure-test`（`study.css` / `chips.css` 冇 `--purple` 除 `.fact-yue`）、visual-diff 重出 baseline；HANDOFF glossary（`Bookmarked only`、tooltip） | test | Frontend Developer + QA | baseline: tests/tools/visual-diff.js | 1.5h | T-101…T-106 | P0 |

### Phase 2 — Lane C2（v0.62，同 V 並行）

| 任務編號 | 任務描述 | 類型 | 負責 Agent | Mockup Binding | 預計工作量 | 依賴任務 | 優先級 |
|----------|----------|------|-----------|----------------|-----------|----------|--------|
| T-151 | Set id：`config.js` 加 `FACT_PREFIX = 'f'`（跟 `CHAPTER_PREFIX` / `DIFFICULTY_PREFIX` 模式，`examNum = 'f21'`；即 Architect 嘅 `FACT_EXAM`，但帶 id 方便 header label）；`questions.js` 加 `isFactExam` / `factIdOf`，`examLabel()` → `t('common.factSet', { id })`；`en.js` 加 `common.factSet: 'Fact #{id}'` | feature | Frontend Developer | none-required | 1h | - | P0 |
| T-152 | 新 `js/screens/sideSession.js`（三步：index.html、SW SHELL、版本）：`sessionReturn = null \| {kind:'quiz', state} \| {kind:'study', scrollY}`、`isSideSession()`、`startSideSession(examNum, questions, returnTo)`、`returnFromSideSession()`。開始時：**強制 `mode = PRACTICE_MODE`**、`setPool = null`、`masteredBefore = 0`、`reviewTotal = 0`、`cleared = 0`、`flags = {}`、`answers/revealed/yueShown = {}`、`current = 0`、`examTimeUp = false`、`stopExamTimer()` | refactor | Frontend Developer | none-required | 2h | T-151 | P0 |
| T-153 | `similarPanel.js` 改用 `sideSession`：`similarReturn` / `isSimilarSession` / `returnFromSimilar` 全部換走；`renderSimilar` 喺任何 side session 都唔顯示；`quiz.js` `renderRoundNote`、`nextAction`（最後一題 ↩ Back）改認 `isSideSession()`；`startExam` 同 `home.js` `leaveToHome` 清 `sessionReturn` | refactor | Frontend Developer | none-required | 1.5h | T-152 | P0 |
| T-154 | `startFactPractice(factId)`：由 `STUDY` 搵 fact，`f.src.map(questionByKey).map(toQuestionItem)`（src 次序、每題一次），`returnTo = {kind:'study', scrollY: window.scrollY}`，`showScreen('screenQuiz')`；Back → `showScreen('screenStudy')` + `renderStudy()` + `scrollTo(0, scrollY)`（tab / filter / search 喺 `study` 記憶體，唔使另存）；`actions.js` 加 `startFactPractice: el => startFactPractice(numArg(el))`。**今個 PR 冇掣 call 佢** | feature | Frontend Developer | none-required | 1.5h | T-153 | P0 |
| T-155 | 測試：新 `tests/factsession-test.js`（R-001 清單逐項：Home 喺 Exam mode 時開 fact session 都係 Practice；label `Fact #21`；8 題 src 次序；冇 Similar panel / round note / timer；答題照計 streak / wrong；最後 ↩ Back 返 Study 同 tab / chip / search / scrollY；← Home 清 `sessionReturn`；之後 `startExam` 正常有結果頁）；`similar-test.js:116`、`quicknav-test.js:66` 由 `similarReturn` 改 `sessionReturn` | test | Frontend Developer + QA | none-required | 2h | T-154 | P0 |

### Phase 3 — Lane C（v0.63）

| 任務編號 | 任務描述 | 類型 | 負責 Agent | Mockup Binding | 預計工作量 | 依賴任務 | 優先級 |
|----------|----------|------|-----------|----------------|-----------|----------|--------|
| T-201 | 第 4 項：新 `js/components/factCard.js` `factCardHtml(f, { variant: 'full' \| 'core', marks, mastery, opts })` + `css/components/fact.css`（三步）；**唔讀 `study` global**；保留 hook `.fact`、`.fact.war`、`.fact.mastered`、`.fact-btn.star` / `.tick`、`.fact-en`、`.fact-yue`、`.sqm-fact-*`；`.fact*` 規則由 `study.css` 搬去 `fact.css`；O5 卡樣式（`--shadow-sm`、來源列分隔線） | feature | Frontend Developer | mockup: mockups/study-unify.html#study-chapters | 3h | PR-2 merged | P0 |
| T-202 | `study.js` `renderFact` → `factCardHtml(f, { variant:'full', marks:{ bookmarked, ticked }, … })` | refactor | Frontend Developer | mockup: mockups/study-unify.html#study-chapters | 1h | T-201 | P0 |
| T-203 | `similarPanel.js` `similarFactHtml` → `factCardHtml(f, { variant:'core' })`；按 Q3：推薦 = 保留金色底、radius / 邊框跟 Study | refactor | Frontend Developer | mockup: mockups/study-unify.html#similar-core | 1h | T-201, Q3 | P1 |
| T-204 | 第 3 項：`js/domain/mastery.js` 加 `factMastery(f, ticked)` → `{ ticked, derived: f.src 全部 isMastered, mastered: ticked \|\| derived, done: n, total }`；`study.js` `factMatches` 嘅 hideMastered 改用佢；`study.mastered` 形狀唔郁 | feature | Frontend Developer | none-required | 1h | T-202 | P0 |
| T-205 | 掌握 UI：derived 時剔掣變 🏆（`aria-disabled="true"`、冇 `data-action`、tooltip 用 O4 glossary「🏆 Mastered」）、卡半透明；O7（按 Q6）Study header `🏆 n / 236 mastered`（`t('study.progress', …)`） | feature | Frontend Developer | mockup: mockups/study-unify.html#mastery ; mockup: mockups/study-unify.html#card-extras | 2h | T-204 | P0 |
| T-206 | 第 6 項 UI：來源 node 列（重用 `similarNodeText` / `similarNodeClass`，**純顯示、唔可撳**）取代「Appears ×n」；「▶ Practise this one / these N」（重用 `similar.practise`）`data-action="startFactPractice" data-arg="{id}"`；`#id` 細字按 Q6；刪 `study.appears` key | feature | Frontend Developer | mockup: mockups/study-unify.html#source-nodes ; mockup: mockups/study-unify.html#fact-session | 2h | T-202, PR-2 C2 | P0 |
| T-207 | 返 Study 後 fact 卡短暫 highlight（重用 `REVIEW_HIGHLIGHT_MS`，可選，見 Q8） | feature | Frontend Developer | mockup: mockups/study-unify.html#fact-session | 0.5h | T-206 | P2 |
| T-208 | 測試：`study-test`（🏆 推算、唔可撳、Hide mastered 包推算、Practise 掣去到 Fact #id、Back 還原）、`structure-test`（`factCard.js` 冇 `study.` 讀取）、`similar-test` core fact、`sw-test` 新 file、`upgrade-test` 唔改照過；visual-diff | test | Frontend Developer + QA | baseline: tests/tools/visual-diff.js | 2.5h | T-201…T-207 | P0 |
| T-209 | 升 `APP_VERSION` 0.63；HANDOFF：file 表（factCard / fact.css / sideSession）、glossary（刪 `Appears ×n`、`★ Bookmarked only`）、**15 / 408 題 `q.d ≠ f.d`**（Study 顯示 fact 難度，跳去題目會見唔同星數，唔改資料）、Reset practice progress 唔清 Study 剔 / 書籤但推算 🏆 會消失 | docs | Main agent | none-required | 1h | T-208 | P1 |

---

## 5. 風險登記

| 風險編號 | 風險描述 | 可能性 | 影響 | 應對方案 | 負責人 |
|----------|----------|--------|------|----------|--------|
| R-001 | Fact session 暫存 / 還原 global `state` 漏欄位：`flags`、`setPool`、`masteredBefore`、`reviewTotal`、`cleared`、`examTimeUp`；`renderRoundNote` 只認 `isSimilarSession` → fact session 出 round note；計時器仲行 | 高 | 高 | 抽 C2 獨立做；`startSideSession` 一次過 set 晒所有欄位（唔靠 spread 舊 state 嘅 review 欄位）；`stopExamTimer()`；`factsession-test` 逐欄斷言 | Frontend Developer |
| R-002 | 由 Exam mode 首頁入 Study 再撳 Practise → 用咗 `pendingMode` = exam | 中 | 高 | `startSideSession` 強制 `mode = PRACTICE_MODE`，唔讀 `pendingMode`；測試覆蓋 | Frontend Developer |
| R-003 | `upgrade-test` hook 被改：`study.mastered`、`study.bookmarks`、`.study-tab.active` | 中 | 高 | 三者名 / 形狀凍結；`factCard.js` 由參數收 marks；PR checklist 加一行 | Code Reviewer |
| R-004 | V ∥ C2 合併 semantic conflict（`en.js`、`APP_VERSION`、`quiz.js` 讀 label） | 中 | 中 | 合併後必跑 `tests/run-all.sh` + `tests/tools/visual-diff.js`；`APP_VERSION` 由 main agent 喺 PR 層升一次 | Main agent |
| R-005 | 新 file 漏三步（`index.html` / SW SHELL / `APP_VERSION`）→ 離線壞 | 中 | 高 | `sw-test` 已檢查 tag ∈ SHELL；PR checklist | Frontend Developer |
| R-006 | 紫色殘留或誤改 `.fact-yue` / `.q-yue` | 中 | 低 | `structure-test` 加守衛：Study chrome CSS 冇 `--purple*`（`.fact-yue`、`.sqm-fact-yue` 例外） | QA |
| R-007 | 推算 🏆 同手動剔混淆：用戶 Reset practice progress 後推算 🏆 消失 | 中 | 低 | 用戶已決定 Reset 唔清 Study；HANDOFF + glossary 寫明；推算 🏆 tooltip 講明來源 | PM |
| R-008 | 15 / 408 題 `q.d ≠ f.d`，fact 卡星數同題目唔同 | 高（必然） | 低 | 唔改資料；HANDOFF 記錄；如用戶介意再開 data ticket | PM |
| R-009 | `pwa-test` 用 stub event 驗證，真 Chromium `InvalidStateError` 行為冇得 headless 重現 | 低 | 低 | `.catch(() => {})` + 斷言 prompt 只 call 一次已足夠 | QA |
| R-010 | 返 Study 時 scrollY 唔準（答題期間 Study 內容變咗，例如 Hide mastered 令卡消失） | 中 | 低 | 還原 scrollY 後，如果 fact 卡仍在就 `scrollIntoView` 佢（T-207 一齊做） | Frontend Developer |

---

## 6. 依賴關係

### 內部依賴
```
Lane P:  T-001 ─┬─ T-003 ─ T-004                         （v0.61，獨立，即刻開始）
         T-002 ─┘
Lane V:  T-101 / T-102（等 Q2）, T-103, T-104 ─ T-105, T-106 ─→ T-107   ┐
Lane C2: T-151 ─ T-152 ─ T-153 ─ T-154 ─ T-155                        ├─ merge → PR-2（v0.62）→ run-all + visual-diff
                                                                     ┘
Lane C:  T-201 ─ T-202 ─┬─ T-203（等 Q3）
                        ├─ T-204 ─ T-205（O7 等 Q6）
                        └─ T-206（需要 C2）─ T-207 ─→ T-208 ─ T-209   （v0.63）
```

### 外部依賴
| 依賴項 | 類型 | 狀態 | 影響任務 |
|--------|------|------|----------|
| 用戶揀 Q2 裝飾色 A / B / C | 人員 | 待確認 | T-101、T-102、T-107 |
| 用戶揀 Q3 Core Fact base | 人員 | 待確認 | T-106、T-203 |
| 用戶揀 Q6 卡上額外資訊 | 人員 | 待確認 | T-205、T-206 |
| `upgrade-test` 要 pinned v0.57 commit `dc84cab`（shallow clone 要 `git fetch --unshallow` 或設 `V057_REF`） | 環境 | 已知 | T-107、T-155、T-208 |
| Chromium `/opt/pw-browsers/chromium` + `NODE_PATH=/opt/node-tools/node_modules` | 環境 | 已確認 | 所有 test 任務 |

---

## 7. 工作量估算

| 階段 | 前端 | 後端 | DevOps | QA | 總計 |
|------|------|------|--------|-----|------|
| Phase 1（P，v0.61） | 2.5h | - | - | 1h | 3.5h |
| Phase 2（V，v0.62） | 5h | - | - | 1.5h | 6.5h |
| Phase 2（C2，v0.62，並行） | 6h | - | - | 1.5h | 7.5h |
| Phase 3（C，v0.63） | 10.5h | - | - | 2.5h | 13h |
| **總計** | **24h** | - | - | **6.5h** | **~30.5h（並行後 wall-clock 約 3–3.5 日）** |

---

## 8. 建議開始順序

```
Step 1 → Lane P（T-001…T-004）即刻開工：冇 UI、冇決定待定，細 PR v0.61 先 ship，順手清 CUI-0008 / S-020 / S-022
Step 1' → 同時把 mockups/study-unify.html 俾用戶，收 Q2 / Q3 / Q6（同 Q7、Q8 如有）答案
Step 2 → Lane C2（T-151…T-155）即刻開工（唔使等 mockup）：最高風險部分最早做、最早有測試
Step 3 → Q2 有答案後開 Lane V（T-101…T-107），同 C2 並行（worktree）
Step 4 → V + C2 合併 → run-all.sh + visual-diff → PR-2（v0.62）→ review / QA → merge
Step 5 → Lane C（T-201…T-209）由新 main 開 → PR-3（v0.63）→ review / QA → merge
Step 6 → 刪 / 保留 mockup（HANDOFF 慣例：臨時 preview 確認後 delete；`study-unify.html` 屬 Design Origin，建議同 similar-question-map 一樣保留）
```

---

## 9. 假設及前提

| # | 假設 |
|---|------|
| A-1 | 唔改任何 localStorage key、唔使遷移；Study 書籤（`lifeuk.studyBookmarks`，`{factId:true}`）同 Practice flags（`lifeuk.flags`，`{qKey:true}`）分開存，唔合併 |
| A-2 | 用戶已決定：Mastery = 手動剔 或 來源題全 🏆（推算唔畀撳）；Fact session 完 = 直接 ↩ 返 Study、冇結果頁；首頁 Reset practice progress 唔清 Study 剔同書籤；書籤開咗 = 橙色 SVG，字眼「Bookmark」/「Bookmarked only」（唔用 Flag） |
| A-3 | 預設（mockup 展示、用戶可改）：選中色 navy；node 唔可撳；「Appears ×n」換 node 列；← Home 返首頁；S-022 方案 A；CUI-0008 方案 B |
| A-4 | Fact session 入面嘅答案照計 Practice streak / wrong answers / flags（同 Similar session 一樣），因為 mode 強制 Practice |
| A-5 | Fact session 題目次序 = `f.src` 次序、每題一次、唔 shuffle、唔跳過已掌握題（同 Similar session 一致） |
| A-6 | Set id 用 `FACT_PREFIX` + id（`'f21'`）實作 Architect 嘅 `FACT_EXAM`，以便 header 顯示 `Fact #21`；`isReviewSet` 唔包佢 |
| A-7 | O1–O9 用 Architect 補充評估 §7c 嘅定義（見 §0）；O6 已由用戶決定（Reset 唔清 Study），冇代碼改動 |
| A-8 | App 冇 dark mode；mockup 只做 light |
| A-9 | 合併後必跑 `NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium ./tests/run-all.sh` + `tests/tools/visual-diff.js`；跑完還原 `tests/shot-*.png` |

---

## 10. 開放問題

| # | 問題 | 選項（mockup 位置） | 推薦 | 影響任務 | 需要誰決定 | 截止 |
|---|------|------|------|----------|-----------|------|
| Q2 | Study 裝飾色（fact 左邊框、📅 year tag、Timeline 年份 + 圓點、Geography 小標題、Home Practice 章節 badge） | (a) 全 navy 系 /(b) 選中 navy、裝飾保留紫 /(c) 裝飾改金色系（`#study-chapters`、`#timeline`） | (a)：紫色只留廣東話，語意最乾淨；(b) 會令紫色同時代表「翻譯」同「年份」；(c) 同 Similar 金色 Core Fact 撞 | T-101、T-102 | 用戶 | 開 Lane V 前 |
| Q3 | Core Fact 卡 base | (1) Study 白卡做 base、Similar 保留金色 /(2) 兩邊都白卡（`#similar-core`） | (1)：金色 Core Fact 喺白色 panel 入面係「hub」，有視覺重心 | T-106、T-203 | 用戶 | 開 Lane C 前 |
| Q6 | 卡上額外資訊：`#id` 細字 / 來源 node 列 / Study 頂部「🏆 n / 236 mastered」逐項要唔要 | 逐項有 / 冇（`#card-extras`） | 三樣都要（node 列已係預設；`#id` 對應 Similar「Core Fact #21」；🏆 進度同首頁 mastery 一致） | T-205、T-206 | 用戶 | 開 Lane C 前 |
| Q7 | 推算 🏆 嘅卡要唔要同手動剔一樣半透明（mockup 係一樣） | 一樣 / 推算唔透明只換 🏆 | 一樣（Hide mastered 都會收埋兩種，一致） | T-205 | 用戶 | 開 Lane C 前 |
| Q8 | ↩ Back 返 Study 後，fact 卡要唔要 1.5s 金色 highlight（`#fact-session` 最後一格） | 要 / 唔要 | 要（scroll 位置可能因 Hide mastered 變，highlight 幫用戶搵返） | T-207 | 用戶 | 開 Lane C 前 |

## 11. 用戶決定（2026-10-06，plan 已確認）

用戶睇完 `mockups/study-unify.html` 之後覆「全部跟推薦」，§10 全部開放問題已決定：

| # | 決定 |
|---|---|
| Q2 | (a) 全 navy 系：選中狀態 `--navy`；fact 左邊框、`.tag.year`、timeline 年份 / 圓點、`.study-sub-title`、Home `.ch-num` 改 navy 系（`--study-accent*` 指去 navy / navy-light）；紫色只留廣東話 |
| Q3 | Study 白卡做 base，Similar panel 保留金色 Core Fact（core variant），形狀統一 |
| Q6 | 三樣都要：`#id` 細字、來源 node 列（取代「Appears ×n」）、Study 頂部 `🏆 n / 236` |
| Q7 | 推算出嚟嘅 🏆 卡同手動剔一樣半透明 |
| Q8 | ↩ Back 返 Study 之後，fact 卡金色 highlight 1.5s |

PR-2（v0.62）Lane V ∥ C2 即時開始；PR-1（v0.61）merge 後先合併 PR-2 lane。
