# Life in the UK Test PWA — Handoff (v1.0.2)

- **Repo:** https://github.com/dcwhung/life-in-uk-test （main branch，GitHub Pages root `/`）
- **Live:** https://dcwhung.github.io/life-in-uk-test/
- **Stack:** 純 HTML + vanilla JS + CSS，冇 build tool、冇 dependency；PWA（Service Worker 離線）
- **用戶：** 香港廣東話使用者，備考 Life in the UK Test（ILR，BN(O) route）
- **開發流程（v0.32 起）：** 每次改動喺 `claude/*` branch 做，開 PR 入 `main` 再 merge（merge commit）；`main` merge 後 GitHub Pages 自動部署。冇 `develop` branch。PR merge 咗之後，同一條 branch 要由最新 `main` 重新開過先加新 commit
- **版本：** v1.0.0（2026-10-08）起用 SemVer（`APP_VERSION = 'MAJOR.MINOR.PATCH'`）：新功能升 minor（1.1.0）、修 bug／細改升 patch（1.0.1）、大改／唔兼容（例如 localStorage 結構要遷移）升 major（2.0.0）；只改測試／文件唔升版本。v0.01–v0.72 用舊規則（每次改 app +0.01）。`APP_VERSION` 只當字串用（SW cache 名 `lifeuk-v<版本>`、header / ⓘ 顯示 `v<版本>`、`lifeuk.migrated` marker），冇數值比較
- **Freeze：** v1.0.0 = 第一個 freeze 版本，git tag `v1.0.0` → `de11fcc`（GitHub Release 頁開，lightweight tag；`git checkout v1.0.0` 可以返去）；之後每個 major / minor release 都打 tag `v<版本>`
- **UI 改動：** 用戶通常要求先做 preview／mockup 確認先改 code（例如 `mockups/similar-question-map.html`、v0.41 嘅臨時 quiz header preview、v0.65 嘅 `mockups/lang-switch.html`（確認後已 delete））；臨時 preview 確認後要 delete，唔好留喺 `main`
- **每輪改完：** 用戶通常會要求「開 PR 入 main 然後 merge」，之後再「更新 HANDOFF.md 記錄今次所有改動」

---

## File 結構

v0.57（P1 refactor）起 `index.html` 只剩 `<head>`、各 screen 嘅 markup 同 `<link>` / `<script>` tag；CSS 同 JS 按類分 sub folder。

| File | 內容 |
|---|---|
| `index.html` | `<head>` + 各 screen markup（Home / Flagged / Study / Quiz / Result / confirm modal）+ 載入次序；冇 inline script / onclick，inline style 只剩 `#progressFill` 嘅 `width:0%`（JS 動態改闊度）；v0.59 起冇 UI 文字：靜態文字用 `data-i18n` / `data-i18n-attr`，JS 會填嘅 element 留空（`<title>` 同 meta 例外，見「i18n」）；v0.65：header 右上角語言 pill `#langBtn`（`.lang-btn`，`data-action="toggleLang"`），題目內容容器標 `lang`（`#qText` / `#optionsContainer` / `#ansEn` `lang="en"`，`#qYue` / `#ansYue` `lang="zh-HK"`，W-014） |
| `locales/en.js` | v0.59：`LOCALES.en`，全部 UI 文字（`app` / `home` / `quiz` / `exam` / `result` / `review` / `similar` / `flagged` / `study` / `modal` / `common` / `data`），見「i18n」；所有 locale 嘅基準（key 以 en 為準，其他語言缺 key fallback 返 en）；v0.65 加 `app.langSwitch`（`中`）/ `app.langSwitchLabel`，M6 改名 `All Questions`、刪 `common.questions` |
| `locales/zh-HK.js` | v0.65：`LOCALES['zh-HK']`，繁體中文書面語 UI 文字，key 同 en 一模一樣（`i18n-test` 守 parity）；載入次序喺 `locales/en.js` 之後、`js/core/i18n.js` 之前；**唔喺** `LATE_BOOT_SCRIPTS`（見「i18n › zh-HK」） |
| `sw.js` | Service Worker（**一定要喺 root**，SW 只可以控制自己 path 或以下嘅 page）；`importScripts('js/core/config.js')` 攞 `APP_VERSION` 做 cache 名；`SHELL` 列齊所有 file |
| `data/exams.js` | `EXAMS`：408 題，Exam 1–17 各 24 題；v0.66 `yue` / `oy` / `note` 改香港廣東話口語（見「廣東話翻譯（yue）規則（v0.66）」），English `q` / `o` / `a` 同結構受 `content-guard-test` 保護 |
| `data/study.js` | `CHAPTERS`（v0.59 起只係章節號 `[1, 2, 3, 4, 5]`，標題喺 locale `data.chapters`）+ `STUDY`：236 條 dedupe 後嘅 facts；v0.66 fact `yue` 改口語（140 條），其他欄位受 `content-guard-test` 保護 |
| `css/base/tokens.css` | `:root` design tokens：所有顏色、shadow / overlay、radius 同 font-size scale（見「Design tokens」） |
| `css/base/layout.css` | reset、body（v0.65 字體 stack 尾加系統 CJK 字體，見「i18n › zh-HK」）、v0.64 form control 字體（`button, input, select, textarea { font-family: inherit; }`，見「Design tokens」）、sticky header、v0.65 語言 pill `.lang-btn`（金色邊 pill，`::before` hit area ≥ 44px、`:focus-visible` ring）、main、`.screen` 切換、`[hidden]`、`.quiz-header` / `.section-title`、`@keyframes slideIn` |
| `css/components/*.css` | `buttons`（back / nav / quick ← → / flag 掣 + 書籤 icon 顏色）、`chips`（practice / study tab 共用 base、`.chip`、`.stars`）、`dots`（`.dot` / `.rdot` 共用形狀、`.dots-meta` / `.rmeta` 計數；`.nav-dots` / `.rdots` 12 欄係 `repeat(12, minmax(0, 1fr))`，gap / 號碼字號用 `--dots-gap` / `--dot-fs`，≤ 360px 收 4px / 9px，CUI-0012）、`modal`、`popover`（ⓘ popover + install banner）、`fact`（v0.63：Study / Similar 共用嘅 fact 卡，見「Study」：`.fact*`、`.tag*`、`.fact-btn*`、`.fact-src` 來源列、`.fact.flash`，同 Similar 金色 Core Fact `.sqm-fact*`；由 `study.css` / `quiz.css` 搬過嚟） |
| `css/screens/*.css` | `home`、`quiz`（問題卡、選項、答案框、計時器、Similar `.sqm`）、`results`（v0.65 M4：≤ 360px `.result-sub` 用 `--fs-sm`）、`flagged`、`study`（含 timeline）；`@media (max-width: 480px)` 跟返各自 file 尾 |
| `js/core/config.js` | 常數：`APP_VERSION`、mode / set id（`PRACTICE_MODE`、`ALL_EXAM`、`WRONG_EXAM`…）、`MASTERY_STREAK`、`PRACTICE_ROUND_MAX`、`REAL_TEST_SIZE`、`PASS_RATIO`、`EXAM_MINUTES`、localStorage key（`LS_PREFIX` + 各 key、`LEGACY_LS_MIGRATION`、`MIGRATED_LS`、`MERGE_LS`、`OBSOLETE_LS`、v0.59 `UI_LANG_LS`、v0.60 `INSTALL_DISMISSED_LS`）、v0.60 `INSTALL_TOUCH_QUERY`、`DEFAULT_LANG`、v0.65 `ZH_HK_LANG`（`'zh-HK'`，pill 喺 `DEFAULT_LANG` 同佢之間切換）、分隔符 `LIST_SEP`（` · `）/ `ANSWER_SEP`（` | `）等；**SW 都會 load，所以只可以有 const，唔可以掂 DOM 或者 data** |
| `js/core/utils.js` | `shuffle`、`shuffleOptions`、`toQuestionItem`、`isCorrectAnswer`、`getLS` / `setLS`（經 `lsKey()`：第一次用 storage 時 lazy 行 `ensureLegacyMigrated()`，再查 `LS_KEY_FALLBACK`；舊 key 遷移全部 code 喺呢度，見「localStorage keys」）、`escapeHtml`、`pad2`、`keysOf`、`percent`、`byId`、`setShown`、`showScreen` |
| `js/core/i18n.js` | v0.59：`t(key, params)`、`getLang()` / `setLang()`、`applyLanguage()`、`applyStaticI18n()`、`applyDocumentI18n()`、`rerenderCurrentScreen()`，見「i18n」；v0.65：`syncLangPill()`（`applyLanguage()` 入面 call，冇 zh-HK locale 就收埋 pill，W-013）、`SCREEN_RERENDER.screenQuiz` 喺 `renderQuestion()` 之後 call `refreshExamTimer()`（倒數字即刻換語言） |
| `js/core/store.js` | `streaks` / `practiceFlags` / `wrongList`（`let`，測試會直接改）、completed exams、homePrefs 讀寫 |
| `js/core/actions.js` | `ACTIONS` registry + 一個 document click / input / keydown（Esc）listener；未知 action 名 `console.warn` 唔會 throw；v0.64 double tap guard（CUI-0011，見「data-action 慣例」）；v0.65 `toggleLang`（confirm modal 開住時唔做嘢，R-002） |
| `js/domain/questions.js` | `EXAM_COUNT`、`TOTAL_QUESTIONS`、`DIFF_LEVELS`（v0.59 起由題目嘅 `d` 計，標籤喺 locale `data.difficulty`）、`difficultyLabel()`、`allQuestions()`（單一 loop）同由佢 filter 出嚟嘅 exam / chapter / difficulty pool、`poolFor()`、`randomExamPick()`、`examLabel()`、`questionByKey()` |
| `js/domain/mastery.js` | `qKey`、`streakOf`、`isMastered`、`recordPracticeAnswer`、`masteryOf`、`practicePool`、v0.63 `factMastery(f)`（Study fact 嘅來源題掌握：`{ mastered, total, pct, derived }`，`derived` = `f.src` 全部 🏆，見「Study」） |
| `js/domain/similar.js` | `FACT_BY_QKEY`、`factOf`、`similarKeys` |
| `js/components/*.js` | `icons`（`BOOKMARK_PATH`、`bookmarkSvg`、`starsHtml`）、`dots`（`dotButtonHtml`、`countsLegendHtml`，quiz 同結果頁共用）、`tags`（`streakLabel`、`streakTagHtml`、`questionRefText`、`questionNodeHtml` / `questionNodeText` / `questionNodeClass`（v0.64 S-031：由 `screens/similarPanel.js` 嘅 `similarNode*` 搬過嚟兼改名，Similar map 同 fact 卡來源列共用；component 唔可以 call screen 嘅 function，`structure-test` 守住）、`chipHtml`、`setButtonHtml`）、`modal`（`showConfirm`）、`popover`（ⓘ + 由 data 填 408 / 17）、`factCard`（v0.63：`factCardHtml(f, { variant: 'full' \| 'core', marks, opts })`、`CHAPTER_ICONS`、`yearLabel`；**唔讀 `study` global**，所有狀態由參數傳入，見「Study」） |
| `js/screens/*.js` | `home`、`quiz`（`state`、`startExam`、`renderQuestion` 同拆細嘅 helper、`selectOption`）、`examTools`（計時、flag、圓點、`submitExam`；v0.65 `examTick()` 拆出 `examSecondsLeft()` / `renderExamTimer(left)`，加 `refreshExamTimer()`：只重寫倒數字，**唔 call `examTick`**（0 秒會交卷），timer 冇行就乜都唔做）、`sideSession`（v0.62：臨時 session 引擎，見「臨時 session」）、`similarPanel`、`result`（`finishExam` 同 review）、`flagged`、`study` |
| `js/pwa/pwa.js` | `registerSW()`（`file://` 唔註冊）+ install banner（v0.60：`shouldShowInstallBanner()` = `INSTALL_TOUCH_QUERY` `(pointer: coarse)` 而且未 dismiss 先出；✕ → `dismissInstallBanner()` 寫 `lifeuk.installDismissed`；v0.61 CUI-0008：`promptInstall()` 一開頭接手 `deferredPrompt`（清做 `null` 先 await，所以每個 event 最多 `prompt()` 一次），任何 outcome 都 `hideInstallBanner()`，取消唔寫 dismiss key；`appinstalled` → `onAppInstalled()`：清 `deferredPrompt`（v0.62，S-027）+ `hideInstallBanner()`） |
| `js/main.js` | init（最後載入）：`startApp()`；SW 換版時舊 cache 嘅 `index.html` 可能少咗新 file 嘅 tag（同 CUI-0004 一樣嘅混合頁面）：`LATE_BOOT_SCRIPTS`（`locales/en.js`、`js/core/i18n.js`（v0.59）、`js/screens/sideSession.js`（v0.62）、`js/components/factCard.js`（v0.63，每次 Practice 答完嘅 Similar Core Fact 同 Study 都會 call））每項有 `ready()` 睇 global（`LOCALES` / `t` / `isSideSession` / `factCardHtml`），未 ready 就按次序動態載入再開（v0.59–v0.61 係睇 `t` 有冇定義，只識 locale + i18n；v0.62 W-010 起唔睇 `<script src>` tag：新 shell tag 一定喺度，載入失敗都要當 missing；已 ready 嘅唔會重載，免得 `LOCALES` already declared）；載入失敗 → reload 一次（sessionStorage `I18N_RELOAD_SS`），再失敗就喺 `#examGrid` 顯示英文 `I18N_BOOT_FALLBACK_MSG`（S-014）。v0.63：`LATE_BOOT_STYLES`（`css/components/fact.css`）—— `.fact*` / `.sqm-fact*` 規則由 `study.css` / `quiz.css` 搬咗去 `fact.css`，舊 cache 嘅 `index.html` 冇呢個 `<link>`，`addMissingBootStyles()` 開機前補返（唔使等，CSS 冇 global 可以睇） |
| `manifest.webmanifest` | v0.59（CUI-0002）：web app manifest（`name`、`short_name`、`start_url` / `scope` `./`、`standalone`、背景 / theme 色 = header navy `#1a2744`、192 / 512 / 512 maskable icon）；Chrome 要有佢先裝得 app、`beforeinstallprompt` 先會彈 |
| `icons/icon.svg` | v0.59（CUI-0001）：app icon **source**（v1.0.1 起：用戶提供嘅「UK LIFE」設計，1254×1254，淺藍底 + 藍色「U」/「LIFE」+ 紅色「K」，自帶圓角 clipPath）；同時係 SVG favicon。注意 SVG 註解唔可以有 `--`（XML 規定），有就成個 SVG decode 唔到 |
| `icons/*.png` | 由 `icon.svg` 生成，**唔好手改**：`icon-192.png`（PNG favicon fallback + manifest）、`icon-512.png`、`icon-maskable-512.png`（`#eaf2fa` 滿版、圖案縮到 80% 入 safe zone）、`apple-touch-icon.png`（180，`#eaf2fa` 滿版，iOS 自己切圓角） |
| `tests/tools/make-icons.js` | 改咗 `icon.svg` 之後跑：`NODE_PATH=… CHROMIUM_PATH=… node tests/tools/make-icons.js`，用 Chromium 按準確尺寸 render 晒所有 PNG（滿版底色 = `ICON_BASE`，即 `icon.svg` 嘅淺藍底），再 commit PNG |
| `tests/content-guard-test.js` | v0.66（T-101）：Track 2 content guard（純 node，唔使 browser）：`data/exams.js` 除 `yue` / `oy` / `note` 之外、`data/study.js` 除 fact `yue` 之外嘅**所有**欄位同 `tests/fixtures/content-baseline.json` 逐個比較（English `q` / `o` / `a`、`ch`、`d`、`src`、`en`、`geo`、`p`、`yl`、加 / 刪 key、次序、題數 / fact 數、`CHAPTERS`、每個 data file 嘅 top-level 名）；可以改嘅欄位只比形狀（`yue` 非空、`oy.length === o.length` 同每個 slot 空 / 非空、有冇 `note` key），所以 `oy` 原本 `''` 嘅 slot 要保持 `''`；報錯寫 `Exam N · Qk (index)` / `fact #id (index)`，最多列 40 條。**R3 check**（v0.66，S-055）：同一條 English 題目（`q` trim + 唔分大細階）喺唔同 exam 出現，`yue` 一定要逐字一樣，否則列出成組題目再 fail。v0.68 加 S-051 `_noteNonEmpty` 單向規則（有內容嘅 note 唔可以清空）同 S-061 多選題 yue 數量字；`oy` 錯位由 `tests/tools/check-batch-replay.js` 守（S-053） |
| `tests/fixtures/content-baseline.json` | v0.66（T-101）：guard 嘅 committed baseline（受保護欄位原樣 + 可改欄位嘅形狀，一題一行，改 English 時 diff 易睇）；用 fixture 唔用 git ref，因為 `origin/main` 會郁、shallow clone 未必有舊 commit。**唔好手改** |
| `tests/tools/make-content-baseline.js` | v0.66（T-101）：生成上面個 fixture：`node tests/tools/make-content-baseline.js`（亦 export `loadData` / `project` / `BASELINE` 俾 guard 用）。**只可以喺刻意改 English 內容或者 data 結構（id、`ch`、`d`、`src`、答案、次序、題數）嗰陣重生成，同嗰個改動放喺同一個 commit**；**唔准喺廣東話改寫之後為咗令 guard pass 而重生成**（guard 存在就係防 `yue` / `oy` / `note` 改寫靜靜雞改埋其他嘢；fixture 只喺 T-101 `30f0e8d`（v0.66）同 S-051 `295bd71`（v0.68，加 `_noteNonEmpty`）commit 過）。同一規則寫咗喺 tool 檔頭、guard 檔頭同 `tests/tools/README.md` |
| `tests/*.js` | 31 套測試（v0.63 加 `factmastery-test`，v0.64 加 `doubletap-test`，v0.65 加 `lang-switch-test`，v0.66 加 `content-guard-test`）（大部分 Playwright），`tests/run-all.sh` 一次過跑 |
| `mockups/similar-question-map.html` | Similar Questions 嘅設計 mockup（獨立 HTML，頂部 tab 切換情景；PR 嘅 `Design Origin`） |
| `mockups/study-plan-flow.html` | 溫習計劃（Study Plan）嘅設計 mockup（PR #51 / #52，用戶 2026-10-08 確認）：link app 嘅 `css/`，頂部 tab 切換入口 / 訂立目標 / 進度表 / 今日任務；開發 handoff 見 `.proj-docs/plans/2026-10-08_handoff_study-plan.md`；功能完成後刪除 |

**載入次序：** `data/exams.js` → `data/study.js` → `js/core/config.js` → `core/utils` → `locales/en.js` → `locales/zh-HK.js`（v0.65，要喺 en 之後：佢加落 en 建立嘅 `LOCALES`）→ `core/i18n`（v0.59）→ `core/store` → `domain/*` → `components/*`（`icons` → `dots` → `tags` → `modal` → `popover` → `factCard`（v0.63））→ `screens/*`（`home` → `quiz` → `examTools` → `sideSession`（v0.62）→ `similarPanel` → `result` → `flagged` → `study`）→ `core/actions` → `pwa/pwa` → `main`。全部係 classic `<script src>`，全局變量，冇 ES module（`file://` 同 iOS PWA 兼容）；唔好包 IIFE，因為頂層 `let`（`state`、`streaks`、`pendingMode`…）要喺全局 lexical scope，測試先改得到。檔案之間只可以喺 function 入面互相 call，而且 `components/*` 唔可以 call `screens/*`（v0.64 S-031，`structure-test`）；頂層即刻行嘅 code 只可以用前面已載入嘅 file。`store.js` 頂層嘅 `getLS()` 係第一個讀 storage 嘅地方，舊 key 遷移就喺嗰下 lazy 行（v0.58 起冇獨立 `migrate.js`，見「localStorage keys」）。

**加新 file 嘅規則（三步，漏一步就會離線壞咗）：**
1. `index.html` 按載入次序加 `<link>` / `<script src>`
2. `sw.js` 嘅 `SHELL` 加同一個 path（`tests/sw-test.js` 會檢查 index.html 每個 tag 都喺 SHELL；`<link rel="icon">` / `manifest` 都計，manifest 入面嘅 icon 亦要加）。`sw-test` / `upgrade-test` 用 `appFiles()`（`tests/pages-server.js`）按 SHELL 抄 file 去 temp dir，新 folder 唔使改測試
3. `js/core/config.js` 升 `APP_VERSION`（cache 名跟版本，已安裝嘅 app 先會攞新 file）

另外：如果新 file 有 function 會喺 start-up 或者常用路徑（例如 `startExam`）被 call，加埋落 `js/main.js` 嘅 `LATE_BOOT_SCRIPTS`，舊 shell + 新 js 嘅混合頁面先唔會 `ReferenceError`（`upgrade-test` ① 會撞到）。CSS 規則搬 file（舊 file 冇咗、新 file 舊 shell 冇 `<link>`）都一樣：新 file 加落 `LATE_BOOT_STYLES`（v0.63 `fact.css`）

**data-action 慣例（v0.57 起，冇 inline onclick）：**
- 掣寫 `data-action="startExam" data-arg="3"`；input 寫 `data-input-action="studySetSearch"`；其他參數用自己嘅 `data-*`（例如 Study 書籤 / 掌握掣 `data-mark="bookmarks"`）
- `js/core/actions.js` 嘅 `ACTIONS = { name: (el, event) => … }` 負責轉型（`numArg`、`examArg`：Exam 1–17 要係 number，`'all'` 等 set id 係 string）；disabled 嘅掣唔會行
- 同一個 click listener 之後會關 ⓘ popover（click 喺 popover 入面或者 ⓘ 本身除外）；Esc：有 modal 就取消 modal，同時關 popover
- **Double tap guard（v0.64，CUI-0011）**：撳一粒會換畫面嘅掣（「▶ Practise」、首頁 By Exam 格…）連撳兩下，第二下以前會落喺新畫面（例如答咗 Q1、寫 `practiceStreak` / `wrongList`）。click listener 經 `runClickAction()`：pointer click（`event.detail > 0`）行完 action 之後「view」變咗（view = `.screen.active` + `state.questions`，所以 Similar「Practise these N」/ ↩ Back 喺 quiz 畫面換 session 都算），就記低 `clickGuard = { view, x, y, at }`（`at` = 第一下嘅 `event.timeStamp`）；之後嘅 pointer click 如果 view 仍然係嗰個、同第一下距離 ≤ `DOUBLE_TAP_SLOP_PX`（40）、兩下 `timeStamp` 相差 `0 ≤ dt < SCREEN_CHANGE_CLICK_GUARD_MS`（350，`config.js`）就當 stray 唔行（`isStrayClick`）。S-035：比較兩下 tap 自己嘅 `timeStamp`（排隊中嘅第二下 timeStamp 仍然較後；Playwright `dblclick` dt = 0 都擋到），負數 dt（timeStamp 唔可靠）唔當 stray，即係 fail open，唔會永久封住嗰個位。S-036：classic script 共用 global scope，所以名有前綴：`clickGuard`、`clickGuardView()`、`isSameClickView()`（新 global 唔好用 `guard` / `currentView` 呢類通用名）。唔受影響：鍵盤 Enter / Space 同 `el.click()`（`detail === 0`，唔 arm 亦唔 block）、同一 view 入面連撳（Next / ← → 兩下）、新畫面其他位置（例如即刻撳 ← Home / 另一個選項）、`#confirmModal` 入面嘅掣、view 之後由 code 換走（timer、`evaluate`）就失效。測試：喺新畫面同一位置 350ms 內再 `page.click` 會被食，要等 guard 或者撳第二個位置（`doubletap-test`）
- 新加 action：markup 加 `data-action` + `ACTIONS` 加一行；`tests/structure-test.js` 會 fail 任何 `on*=` inline handler
- 顯示 / 收埋用 `hidden` attribute（`layout.css` 有 `[hidden] { display: none !important; }`）；v0.59 起冇例外（`#studySubChips` 都改咗用 `hidden`，`subfilter-test` 跟住改，S-004）

## i18n（v0.59；v0.65 zh-HK + 語言切換掣）

全部 UI 文字喺 `locales/en.js`（`LOCALES.en`）同 `locales/zh-HK.js`（`LOCALES['zh-HK']`，v0.65），經 `js/core/i18n.js` 讀；`js/`、`index.html` 冇 UI 字串亦冇中文（`tests/i18n-test.js` 會 fail）。**題目內容唔係 UI 文字**，照舊喺 `data/*.js`：題目、選項、`yue`、`oy`、`note` / 記憶法、fact `en` / `yue`、`yl` 年份標籤、人名。

**用法**
- `t('home.chooseMode')`；參數 `t('common.questionRef', { exam: 9, n: 15 })` → `Exam 9 · Q15`（值入面寫 `{exam}`、`{n}`）
- 單複數：值寫 `{ one: '{n} question', other: '{n} questions' }`，按 `params.n` 揀（`Intl.PluralRules`，第二種語言都 work）
- 缺 key：當前語言冇 → 用 `en`；`en` 都冇 → 返 key 本身；兩種都 `console.warn('[i18n] missing key', key)`
- 靜態 markup：`<div data-i18n="home.chooseMode"></div>`（填 `textContent`，element 留空）；attribute：`data-i18n-attr="placeholder:study.search;aria-label:app.about"`
- JS 每次 render 都會再填嘅 element（`#quizLabel`、`#nextBtn`、`#resultLabel2`…）markup 留空，唔使 `data-i18n`
- `<title>`、meta description、`apple-mobile-web-app-title` 喺 `index.html` 保留英文原文（冇 JS / 分享預覽用），init 時 `applyDocumentI18n()` 用 `t()` 再寫一次（description 嘅 `1–17` 由 data 計）；`i18n-test` 檢查兩邊一樣
- `getLang()` / `setLang(lang)`：存 `lifeuk.uiLang`（`getLS` / `setLS`）、預設 `en`；`setLang()` 設 `<html lang>`、`applyStaticI18n()`、`applyDocumentI18n()`，再 re-render 當前畫面（`SCREEN_RERENDER`：Home、Quiz、Result 用 `renderResults()`（唔會再記錄成績）、Flagged、Study）；冇 locale 嘅語言唔理。「有 locale」= `LOCALES` 自己嘅 key（`hasLocale()`，`hasOwnProperty`；W-006）：`LOCALES` 係 plain object，存咗 `"constructor"` / `"__proto__"` 都當 `en`，`setLang('toString')` 唔理
- **語言切換（v0.65）**：見下面「zh-HK locale + 語言切換掣」

**Key 命名**
- 第一層 = 畫面 / 用途：`app`（header、ⓘ、install、`<title>`）、`home`、`quiz`、`exam`、`result`、`review`、`similar`、`flagged`、`study`、`modal`（所有 confirm modal 文案）、`common`（幾個畫面共用：`← Home`、Correct / Wrong…、`Exam {n}`、`🏆 Mastered`、`🔥 {n}/{max}`、廣東話 label）、`data`（data enum 嘅標籤）
- 第二層 camelCase；值含 HTML 嘅 key 一定要用 `Html` 結尾（`home.practiceDescHtml`），用 `innerHTML` 插入，傳入去嘅參數要自己 escape；其他 key 嘅值唔准有 tag 或者 entity（`<`、`&amp;` 之類；普通 ` & ` 得），`i18n-test` 會 fail（S-017）
- 答案框廣東話行嘅 `Q)` / `A)` 係 `quiz.yueQ` / `quiz.yueA`（S-015；yue test 靠呢兩個字）；Study 計數 `study.count` 係按 total 揀嘅 plural（`1 / 1 fact`，S-016）
- `app.installName` / `app.installShortName` 冇 source 讀（`MANIFEST_KEYS`）：`manifest.webmanifest` 係靜態 JSON，`name` / `short_name` / `description` 要同 `t('app.installName')` / `t('app.installShortName')` / `t('app.description', { n: EXAM_COUNT })` 一樣，`pwa-test` 喺頁面入面比較（S-019）。改其中一邊要兩邊一齊改
- `t()` 第一個參數要係 literal（`t('a.b')`），或者名叫 `…Key` 嘅變數 / property（`t(f.labelKey)`、`t(titleKey)`）；`'section.key'` 形狀嘅字串 literal 都當「有用」；動態 key 只可以用白名單 prefix：`t(\`data.difficulty.${d}\`)`（`data.chapters.`、`data.chapterShort.`、`data.difficulty.`、`data.eras.`、`data.nations.`、`data.geoTypes.`、`data.people.`，白名單喺 `tests/i18n-test.js` 嘅 `DYNAMIC_PREFIXES`）
- Data enum：source 只留 key（`CHAPTERS = [1..5]`、`DIFF_LEVELS` 由題目計、`ERAS = [{ key, max }]`、`NATIONS` / `GEO_TYPES` / `PEOPLE_GROUPS` 係 key array），標籤喺 `data.*`。**ERAS 決定**：只顯示英文時代名（`data.eras`），舊嘅廣東話時代名拎走咗；v0.65 zh-HK 喺 `LOCALES['zh-HK'].data.eras` 提供「中文（English）」

**白名單（en 入面可以有中文嘅 key，`CJK_WHITELIST`）**：`common.yueTitle`（`【廣東話翻譯】`）、`common.noteLabel`（`💡 備注：`）、v0.65 `app.langSwitch`（`中`，pill 顯示目標語言）。用戶決定 en 版保留中文 label，答案框同結果頁 review 統一用呢兩個

**加一句 UI 文字**：`locales/en.js` **同 `locales/zh-HK.js`** 加 key（啱嘅 section，zh-HK 跟下面 zh-HK glossary）→ markup 用 `data-i18n` 或者 JS 用 `t()` → 跑 `node tests/i18n-test.js`（會捉缺 key、冇用嘅 key、中文、zh-HK 缺 / 多 key、`{param}` 唔一致）

**加一種語言**：`locales/<code>.js` 寫 `LOCALES['<code>'] = { … }`（同 en 一樣嘅 key，缺嘅會 fallback 去 en）→ `index.html` 喺 `locales/en.js` 後面加 `<script>` → `sw.js` SHELL 加 path → 升 `APP_VERSION` → `i18n-test` 嘅 `loadLocales()` / parity check 加埋佢。注意 v0.65 嘅 pill 只係 en ↔ zh-HK 二選一（`toggleLang`），第三種語言要重新設計切換 UI（先做 mockup）

**SW 換版混合頁面**：舊 SW cache 嘅 v0.58 或更早 `index.html` 冇 `locales/en.js` / `i18n.js` tag，但可能 load 到 v0.59 js（同 CUI-0004 一樣）；`js/main.js` 見到冇嗰兩個 tag 就自己載入再 `startApp()`（`upgrade-test` ① 覆蓋；v0.62 起改為檢查 `LATE_BOOT_SCRIPTS` 每項嘅 `ready()`（file 嘅 global 有冇定義，唔係 `<script src>` tag 喺唔喺度，W-010），連 `js/screens/sideSession.js` 一齊補載，因為 `startExam` / `leaveToHome` 會 call 佢）。**載入失敗（S-014）**：`location.reload()` 一次（sessionStorage `lifeuk.i18nReloaded` 防 loop，成功開到就清走；sessionStorage 用唔到就唔 retry），再失敗就喺 `#examGrid` 寫英文 `I18N_BOOT_FALLBACK_MSG`（嗰陣冇 `t()`，所以係 `main.js` 常數唔係 locale key），唔會留低半開嘅頁面（`upgrade-test` ⑤ 覆蓋舊 shell 冇 locale，同埋新 shell（tag 齊）`js/core/i18n.js` 載入失敗 —— W-010：如果用 tag 判斷，新 shell 會直接 `startApp()`，`#examGrid` 空白兼 `applyLanguage is not defined`）

### zh-HK locale + 語言切換掣（v0.65）

需求同決定：`.proj-docs/plans/2026-10-07_plan_zh-hk-locale.md`（§0 Q1–Q11、§0b M1–M6、附錄 A glossary）。Track 1 = UI locale + 掣（v0.65）；Track 2 = data `yue` / `oy` / `note` / Study fact `yue` 廣東話口語化（v0.66 已併入，獨立 PR；規則見「廣東話翻譯（yue）規則（v0.66）」）。UI 文字（`locales/zh-HK.js`）仍然係書面語，data 翻譯係口語，兩樣唔好撈亂。

**切換掣（pill）**
- Header 右上角 `#langBtn`（`.lang-btn`，`.header-inner` 最後一個 child，`type="button"`），顯示**目標語言**：en 時「中」、zh-HK 時「EN」（`app.langSwitch`）；`aria-label` / `title` = `app.langSwitchLabel`（Switch to Chinese / 切換至英文），經 `data-i18n-attr` 填
- 撳 → `ACTIONS.toggleLang` → `setLang(getLang() === DEFAULT_LANG ? ZH_HK_LANG : DEFAULT_LANG)`，一撳即轉，re-render 當前畫面（`SCREEN_RERENDER`），狀態全部保留（plan 狀態保留清單；只有 Result `.hl`、Study `.flash` 短暫效果同捲動位置可能變，接受）
- **Confirm modal 開住時 `toggleLang` 唔做嘢**（`isConfirmOpen()`，R-002）：v0.69 前 modal 冇 focus trap，Tab 去得到 pill，切咗 modal 文字會停喺舊語言；v0.69（S-025）起 Tab 出唔到 modal，呢個 guard 保留做保險。用 mouse 撳 pill 位置會落喺 modal backdrop（取消 modal，原有行為）
- Exam 倒數：`SCREEN_RERENDER.screenQuiz` 加 `refreshExamTimer()`，切換即刻用新語言寫倒數字；**唔可以 call `examTick`**（剩 0 秒會由 re-render 交卷）
- Pill 唔換 view，所以唔會 arm double tap guard（連撳 / dblclick 每下都轉）
- **冇 zh-HK locale 就收埋 pill（W-013）**：`applyLanguage()` → `syncLangPill()` 設 `pill.hidden = !hasLocale(ZH_HK_LANG)`（null-safe：v0.64 或更早嘅 shell 冇 pill）；`locales/zh-HK.js` 載入失敗時唔會留低一粒撳極都冇反應嘅掣（`upgrade-test` ⑦）
- 持久化：`lifeuk.uiLang`（`setLang()` 寫），預設 `en`（Q2）；reload 保持
- `<title>`、meta description、`apple-mobile-web-app-title`、`manifest.webmanifest` **保持英文**：zh-HK 嘅 `app.title` / `description` / `shortName` / `installName` / `installShortName` 照抄 en（`SAME_AS_EN_KEYS`，`i18n-test` 釘死，R-001），否則 `applyDocumentI18n()` 會將 `<title>` / meta 改做中文

**唔喺 `LATE_BOOT_SCRIPTS`（plan 技術預設）**：舊 shell（v0.64 或更早嘅 cached `index.html`）冇 zh-HK tag，`LOCALES['zh-HK']` 唔存在 → `hasLocale()` false → 存咗 `uiLang = 'zh-HK'` 都當 en 行，冇 warning、唔覆寫 storage（`upgrade-test` ⑥）；下次載入新 shell 就自動轉返 zh-HK。加入 late-boot 嘅話，zh-HK 載入失敗會觸發成個 reload + `I18N_BOOT_FALLBACK_MSG` 流程，代價大過收益（W-013 方案 B 否決）。已知：current shell + `locales/en.js` 載入失敗時 `zh-HK.js` 會拋 `LOCALES is not defined`（S-041，S-014 fallback 照出、pill 收埋，未有測試 case）

**zh-HK 文案規則**（全部 key 見 plan 附錄 A；下面 glossary 係常用字）
- **書面語**（Q5），唔係口語；中英之間唔加空格，數字前後留空格（「共 408 題」）；全形標點 `（）`、`：`、`，`
- 數字、emoji、箭咀位置、分隔符 ` · ` / ` | ` 同 en 一致；`{param}` 名同 en 一樣（`i18n-test` 逐個 plural form 比較）
- **Plural 只寫 `other`**：`Intl.PluralRules('zh-HK')` 只會返 `other`，所以 zh-HK 值寫 plain string 就得（1 題都係「▶ 練習這 1 題」，用戶接受，R-004）
- **帶號碼嘅標籤保留英文格式**（Q9）：`Exam {n}`、`Exam 9 · Q15`（`common.questionRef`）、`E9·Q15`（`similar.node`）、`Chapter {n}`、`Ch {n}`、`Chapter 3: …`（`study.chapterTitle`）、`#21`
- **Tab 標籤全中文**（附錄 A 例外）：Practice 分類「難度 / 章節 / 試卷」、Study「📚 章節 / 📅 時間線 / 🗺️ 地理 / 👤 人物」
- **章節名英文**（Q10）：`data.chapters` / `data.chapterShort` 照抄 en
- **時代、國家標題「中文（English）」**：`data.eras`（例：`羅馬時期（Romans）`）、`data.nations.*.label`（例：`🇬🇧 英國（United Kingdom）`）；**國家 chip 只寫中文**（M2，修訂 Q10）：`data.nations.*.chip`「🇬🇧 英國」「🏴 英格蘭」…（`lang-switch-test` 守 chip 冇拉丁字母）
- 難度、地理類型、人物類別純中文（`1 容易`…`5 極難`、`🏙️ 城市及首府`、`👑 君主`）
- Fact 年份 `yl`（`c. 4000 BC`）係 data，照舊英文（M3）；`study.yearBC`（`公元前 {n} 年`）照留做 parity
- `common.yueTitle` / `common.noteLabel` / `quiz.yueQ` / `quiz.yueA` / `exam.timer` / `similar.node` / `study.factId` 同 en 一樣
- `i18n-test` 嘅 zh-HK check（`zhHkChecks()`）：key 雙向 parity（冇缺、冇多）、每個 plural form 嘅 `{param}` 集合同 en 一樣、`…Html` 值嘅 tag 序列同 en 一樣、非 Html 值冇 tag / entity、`SAME_AS_EN_KEYS` 同 en 一字不差、`app.langSwitch` en `中` / zh-HK `EN`

**`lang` attribute 規則（W-014）**：切 zh-HK 之後 `<html lang="zh-HK">`，但題目內容係英文（Q1），screen reader 按 `lang` 揀語音。**英文內容標 `lang="en"`、廣東話內容標 `lang="zh-HK"`**，屬性唔跟 UI 語言變：
- 靜態：`#qText`、`#optionsContainer`、`#ansEn` = en；`#qYue`、`#ansYue` = zh-HK（`index.html`）
- 動態：`.opt-yue`、`.ans-note-text`、`.rv-yue`、`.rv-note-line`、`.fi-yue`、`.sqm-qy`、`.fact-yue`、`.sqm-fact-yue` = zh-HK；`.rv-q-text`、`.rv-correct-ans`、`.fi-q`、`.sqm-q`、`.fact-name`、`.fact-en`、`.sqm-fact-en` = en
- **新 markup 一定要跟**：顯示 data 英文（題目、選項、fact、人名、年份標籤、章節名）就包 `lang="en"`，顯示 `yue` / `oy` / `note` 就包 `lang="zh-HK"`；UI 文字（`t()`）唔使標，跟 `<html lang>`。`lang-switch-test` `checkContentLang` 用 `closest('[lang]')` 驗（唔准落到 `<html>`）。未標完嘅位置見 CUI-0014

**字體**：`body` font stack = `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, 'PingFang HK', 'Noto Sans HK', 'Noto Sans CJK HK', 'Microsoft JhengHei', sans-serif`（T-005 / M1）：Latin 字體行先，CJK 系統字體斷後；**唔載 web font**（離線、冇 dependency）。Linux CI 冇呢幾隻字會用 fallback（例如 WenQuanYi），中文行闊同實機有出入（S-045）

**窄屏**：M4 —— 320px zh-HK 合格線（`result.passNeeded`）尾字會跌行，所以 `results.css` `@media (max-width: 360px) { .result-sub { font-size: var(--fs-sm); } }`，**en 都一樣縮**（S-042 決定兩種語言一致）；文案唔改。M5：`.quiz-label` / `.q-num` letter-spacing 唔改

### zh-HK glossary（v0.65，用戶確認；plan 附錄 A 節錄）

| 概念 | en | zh-HK |
|---|---|---|
| 模式 | Study / Practice / Exam | 溫習 / 練習 / 模擬考試 |
| 首頁標題 | Choose Mode / My Review / Practice By / Select Exam | 選擇模式 / 我的複習 / 練習分類 / 選擇試卷 |
| Practice tab | Difficulty / Chapter / Exam | 難度 / 章節 / 試卷 |
| 全部題目（M6） | `📝 All Questions (408)`（v0.71 前 🎯）、quiz `All Questions (shuffled)`、set `All Questions` | `📝 全部試題（408 題）`、`全部試題（隨機排序）`、`全部試題` |
| Random Exam | `🎲 Random Exam`、`24 questions from 408` | `🎲 隨機試卷`、`從 408 題中抽取 24 題` |
| 題號 | `Question 1 of 24`、`(select 2)` | `第 1 題（共 24 題）`、`（選擇 2 項）`；`Exam 9 · Q15` / `E9·Q15` 同 en |
| 章節 | `Chapter 3`、`Ch 3`、章節名 | 同 en（英文） |
| 掣 | `← Home`、`← Prev`、`Next →`、`↩ Back`、`Finish ✓`、`Submit` | `← 主頁`、`← 上一題`、`下一題 →`、`↩ 返回`、`完成 ✓`、`提交` |
| 判定 | `✓ Correct!` / `✗ Wrong`；`🎉 PASSED` / `📚 NEEDS IMPROVEMENT` | `✓ 正確！` / `✗ 錯誤`；`🎉 合格` / `📚 有待改善` |
| Flag | `Flag for review` / `Unflag` / `Flagged` / `{n} flagged` | `標記待覆閱` / `取消標記` / `已標記` / `已標記 {n} 題` |
| 錯題 | `Wrong answers`（v0.70 起冇 `{n} to clear`） | `錯題`（v0.70 起冇 `尚餘 {n} 題`） |
| 掌握 | `🏆 Mastered`、`🔥 n/3` | `🏆 已掌握`、`🔥 n/3` |
| Similar | `Similar Questions`、`📌 Core Fact #21`、`Appears in:`、`▶ Practise these N` | `相似題目`、`📌 核心知識 #21`、`出現於：`、`▶ 練習這 N 題` |
| Study | `📖 Study`、`✓ Hide mastered`、`Bookmarked only`、`⚔️ Wars only`、`{shown} / {total} facts` | `📖 溫習`、`✓ 隱藏已掌握`、`只顯示書籤`、`⚔️ 只顯示戰爭`、`{shown} / {total} 項知識點` |
| Modal | `Submit exam?` / `Leave the exam?` / `Reset practice progress?`；Keep going · Submit、Stay · Leave、Keep · Reset | `提交試卷？` / `離開考試？` / `重設練習進度？`；繼續作答 · 提交、留下 · 離開、保留 · 重設 |
| 難度 | Easy / Basic / Medium / Hard / Expert | 容易 / 基礎 / 中等 / 困難 / 極難 |
| 國家 chip / 標題 | `🇬🇧 UK` / `🇬🇧 United Kingdom` | `🇬🇧 英國` / `🇬🇧 英國（United Kingdom）`（M2） |
| 廣東話 label | `【廣東話翻譯】`、`💡 備注：` | 同 en |

### 字眼 glossary（v0.59，用戶確認；全 app 統一；en）

| 概念 | 用字 |
|---|---|
| 題數 | 全寫：`📝 All Questions (408)`（v0.71 起 📝；v0.65 M6；v0.59–v0.64 係 `🎯 All Exams (408 questions)`）、`24 questions from 408`、`N questions unanswered`；單數 `1 question`；數字由 data 計。ⓘ popover 用 Title Case：`📋 17 Exams`、`❓ 408 Questions` |
| 題號 | `Exam 9 · Q15`；Similar map node `E9·Q15`（1-based） |
| 章節 | chip / badge `Ch 3`；標題 `Chapter 3: …`；Quiz 標籤 `Chapter 3` |
| Flag | 動作 `Flag for review` / `Unflag`；狀態 `Flagged`；`{n} flagged`（唔再用 saved）；空格提示 `Tap [書籤] on a question to flag it`；`Practise flagged (N)` 照舊 |
| Practise / Practice | 英式：動詞 Practise、名詞 Practice；Similar 掣 `▶ Practise these N`，1 題寫 `▶ Practise this one`（v0.60，CUI-0007）；v0.63 Study fact 卡來源列嘅掣用同一個 key |
| 掌握 | `🏆 Mastered` 全 app（Similar 列表同圖例都係）；進度 `🔥 n/3`（圖例 `🔥 0/3`） |
| 錯題 | 名稱 `Wrong answers`；`Cleared X from your wrong answers · Y left` |
| 掣 | 箭咀位置：`← Home`、`← Prev`、`Next →`、`↩ Back`、`Finish ✓`；分隔符 ` · ` 同 ` \| `（單空格，`LIST_SEP` / `ANSWER_SEP`）；`✓ Correct!` / `✗ Wrong` 單空格 |
| 大細階 | 畫面 / section 標題 Title Case（`Choose Mode`、`My Review`、`Practice By`、`Similar Questions`、`Review Answers`）；掣、提示、hint sentence case（`Wrong answers` 做 tile 標題 OK） |
| 判定 | `🎉 PASSED` / `📚 NEEDS IMPROVEMENT` 照舊（verdict 樣式） |
| 廣東話 label | `【廣東話翻譯】`、`💡 備注：`（答案框 + 結果 review 一致） |
| Modal | Submit：`Submit exam?` / Keep going · Submit；Leave：`Leave the exam?` / Stay · Leave；Reset progress：`Reset practice progress?` / `Mastery streaks, wrong answers and flags will be cleared.`；Reset completed：`Reset completed exams?` / `All ✓ completed marks will be cleared.`；兩個 Reset 都係 Keep · Reset；預設 focus：Reset ×2 同 Leave 喺 Keep / Stay，Submit 喺 Submit（v0.60） |
| Study | `📖 Study`、`Search facts (English / Cantonese)`、`✓ Hide mastered`、書籤 SVG +「Bookmarked only」（v0.62 前係 `★ Bookmarked only`）、`⚔️ Wars only`、people chip `👑 Monarchs` `🏛️ Politics & military` `🔬 Scientists` `✒️ Writers` `🎨 Artists` `🏅 Sport` `✊ Reformers`、Geography 類型同 Timeline 時代只寫英文、~~`Appears ×n`~~（v0.63 刪，換做來源列 `Appears in:` + node `E9·Q15` + `▶ Practise this one` / `▶ Practise these N`，同 Similar 一樣）、`No facts match.`、tooltip `Bookmark` / `Mastered`；v0.63：卡頂細字 `#21`（`study.factId`，對應 Similar `📌 Core Fact #21`）、Study header `🏆 n / 236 mastered`（`study.progress`）、推算 🏆 tooltip / `aria-label` `🏆 Mastered — every source question mastered`（`study.masteredDerived`，O4 跟 glossary「🏆 Mastered」）；v0.62（P3 Lane V）：書籤用 Practice 橙色書籤 SVG（唔再係 ☆ / ★），chip 寫 `Bookmarked only`（字前面係書籤 SVG，冇 ★），字眼仍然係「Bookmark」唔係「Flag」；兩粒 fact 掣嘅 `aria-label` 同 tooltip 一樣（`Bookmark` / `Mastered`） |

## Design tokens

`css/base/tokens.css` 係唯一定義顏色嘅地方，其他 CSS 一律用 `var(--…)`。

| 組 | Token |
|---|---|
| Brand palette | `--orange`、`--navy` / `-mid` / `-light`、`--gold` / `-light`、`--green` / `-light`、`--red` / `-light`、`--purple` / `-light` |
| Surface / text | `--bg`、`--card`、`--text`、`--text-muted`、`--border`、`--divider` |
| 深色底上嘅字 | `--text-inverse`（白）+ v0.60 三級白色 alpha：`--text-inverse-strong`（0.75，深色底上嘅正文）/ `-muted`（0.6，副行、caption、install ✕）/ `-faint`（0.45，版本號、0 計數） |
| 狀態淺底 | `--success-bg`、`--danger-bg`、`--selected-bg`、`--flag-bg` |
| Gold accent | `--gold-bg`、`--gold-text`、`--note-label`、`--fact-bg`、`--fact-label`、`--gold-border`、`--gold-tint` |
| 翻譯 / Study tag | `--yue-bg`、`--yue-bg-soft`、`--person-bg` |
| Study 裝飾（v0.62，P3 Q2-a 全 navy） | `--study-accent`（= `--navy-light`：fact 左邊框、timeline 圓點）、`--study-accent-strong`（= `--navy-light`：`.tag.year` 字、timeline 年份、`.study-sub-title`、Home `.ch-num` + `.chapter-btn:hover`）、`--study-accent-bg`（= `--selected-bg`：`.tag.year` 底）。紫色（`--purple*`）只代表廣東話；`structure-test` fail `study.css` / `chips.css` / `home.css` 入面 `.fact-yue` 以外嘅 `--purple*` / `--year-bg`。v0.62 刪咗冇人用嘅 `--year-bg`、`--star-on` |
| Radius | `--radius`（14px 卡）、`--radius-md`（10px）、`--radius-sm`（8px）、`--radius-xs`（6px，v0.62 O8：`.tag`（原 5px）、`.fact-btn`（原 7px）、Home `.ch-num`）、`--radius-pill`（999px）、`--radius-circle`（50%） |
| Font size | `--fs-2xs` 10、`--fs-xs` 11、`--fs-sm` 12、`--fs-base` 13、`--fs-md` 14、`--fs-lg` 15（px）；10.5 / 12.5 / 13.5 半級同大標題字號照寫 px |
| Spacing（v0.72，B5） | `--space-1` 2、`--space-2` 4、`--space-3` 6、`--space-4` 8、`--space-5` 10、`--space-6` 12、`--space-7` 14、`--space-8` 16、`--space-10` 20、`--space-12` 24（px；步數 = px / 2） |
| Shadow / overlay | `--shadow`、`--shadow-sm`、`--shadow-header`、`--shadow-pop`、`--overlay` |

- **新顏色一定要加喺 `tokens.css`**（按意思命名，同值同意思就重用現有 token）；`tests/structure-test.js` 會 fail 任何喺其他 css file 出現嘅 hex 或者 `rgb(` / `rgba(`
- `--text-inverse-*`（S-018）：v0.59 token 化要 0 視覺改動，所以照搬咗 6 個按值命名嘅 alpha（75 / 70 / 65 / 60 / 55 / 45）；**v0.60 合併做 3 個語意級**（用戶已確認，有輕微視覺改動）：75、70 → `strong`（0.75）；65、60 → `muted`（0.6）；45 → `faint`（0.45）；55 → `muted`（W-008：`.exam-mastery.zero` 係 10px 字，0.45 喺 navy / navy-mid 上對比度 4.18 / 3.77，唔過 WCAG AA 4.5，所以用 muted）。即係 `.flag-start .fs-sub` 0.7 → 0.75、`.exam-sub` / install banner 副行 0.65 → 0.6、`.exam-mastery.zero` 0.55 → 0.6。`faint` 只可以用喺唔使讀嘅裝飾字（例如版本號）。`structure-test` fail 任何 css 再出現 `--text-inverse-[0-9]`；要新一級先諗清楚係咪真係需要，唔好再加按值命名嘅 token
- **Form control 字體（v0.64，S-034）**：`layout.css` 有 `button, input, select, textarea { font-family: inherit; }`，所有掣 / 輸入框用 `body` 嘅 system font stack（之前係 UA 預設，Linux Chromium = Arial）。**只繼承 family，唔用 `font: inherit` shorthand**：shorthand 會連 size / weight 一齊重設，冇自己字號嘅掣（ⓘ `#infoBtn`、`#flagBtn`、Flagged unflag 掣）會變成跟 parent 字號 / 粗幼（例如 `#flagBtn` 13.33px → 11px、`#infoBtn` 400 → 700）。新掣要自己寫 `font-size` / `font-weight`。`line-height` 仍然係 `normal`，但 body font 嘅 metrics 比 Arial 高，所以單行掣高咗 1–2px（例如 `.nav-btn` 44 → 45、`.chapter-btn` 42 → 44），冇掣變矮；`::before` hit area（install ✕、fact 掣、Practise）冇變。W-012：390px 下 body font 令「▶ Practise these 2」闊咗約 2.8px，13 張 2 個來源嘅 fact 卡（#25、30、62、67、74、76、78、128、155、159、181、225、231）來源列由 1 行變 2 行（+27px）；`fact.css` `.fact-practise` 左右 padding 12 → 10px（`--fact-practise-pad-x`，上下 6px / S-030 ring 不變）令佢哋返一行（`factsession-test` 守住）。個別 class 原本嘅 `font: inherit`（`.sqm-cta button`、`.mode-card` 等）保留。`structure-test` 喺 Home / Practice 題目 / Study 檢查每個 `button` / `input` 嘅 `font-family` 同 `body` 一樣。CUI-0012：body font 令圓點號碼 "24" 闊咗（11.69 → 13.97px），而 `.nav-dots` / `.rdots` 原本 `repeat(12, 1fr)`（min = 號碼闊度），320–360px 圓點 grid 闊過張卡（320px 結果圓點凸出白卡、頁面橫向 scroll 2px）；改做 `repeat(12, minmax(0, 1fr))`，≤ 360px gap 6 → 4px、號碼 10.5 → 9px（`dots.css`，`examresult-test` / `practicedots-test` 320px 守住），390px 以上不變
- **Spacing（v0.72，B5，用戶揀方案 A：0 視覺改動）**：margin / padding / gap（連 `--*gap*` / `--*pad*` custom property）喺刻度上嘅 px 一律用 `--space-*`（184 個宣告），`structure-test` fail 任何刻度內嘅 literal（4 個 in-memory sample 守住 guard）；刻度以外嘅值（1 / 3 / 5 / 7 / 9 / 11 / 13 / 18 / 22 / 26 / 30 / 32 / 100px，53 處）保留原數，冇逐行註解，理由統一寫喺 `tokens.css`；width / height / top / left 等定位、font-size、border、radius 唔計。`visual-diff.js` 對 v0.71：76 個狀態 0 diff
- `tests/tools/visual-diff.js` 比較 computed style 時會略過 `--*` custom property（每個 element 都繼承 `:root` token），所以加 / 改 token 名唔會報 diff，只報真正外觀差異

## 數據結構

**題目（`EXAMS[n][i]`）**
```js
{ ch: 3,            // 章節 1–5（跟 official handbook）
  d: 4,             // 難度 1–5 星（rubric：高頻→1、要記年份→3、易混淆→4、冷門/True-False 陷阱→5）
  q: "English question",
  o: ["A","B","C","D"], oy: ["廣東話A","廣東話B","",""],   // oy: "" = 年份/True-False 唔翻譯
  a: [0, 2],        // 正確答案 index（多選可多於一個）
  yue: "廣東話題目翻譯", note: "廣東話備注（可空）" }
```

**溫習 fact（`STUDY[i]`）**
```js
{ id, ch, d, src: ["1.2","9.6"],   // 來源題目 "exam.idx"，長度 = 出現次數
  y: 1928, yl: "c. 4000 BC",        // timeline 年份（負數 = BC）同可選標籤
  w: 1,                             // 戰爭/戰役
  geo: ["Scotland","nature"],       // nation: UK|England|Scotland|Wales|Northern Ireland；type: city|nature|landmark|region
  p: ["Isaac Newton","scientist"],  // group: monarch|politician|scientist|writer|artist|sport|reformer
  en: "English sentence", yue: "廣東話句子" }
```

**廣東話文字規則**
- 縮寫寫成「中文全稱（English full name, 縮寫）」，例：國會議員（Member of Parliament, MP）
- 英文專有名詞第一次出現加中文註釋，例：Stonehenge（巨石陣）；全形括號
- 已確認譯名：v0.66 起以 `.proj-docs/plans/2026-10-07_yue-terms.md`「統一譯名」/「用戶決定保留」為準（唯一來源）；舊表有幾個已經改咗（Cenotaph → 和平紀念碑（Cenotaph）、Beefeaters → Beefeaters（倫敦塔衛兵）而 Yeoman Warders 保留「皇家衛士」、Halloween → Halloween（萬聖節前夕））。其餘舊有譯名（Windrush 疾風號、Hung parliament 懸浮議會、first past the post 領先者當選制、Cardiff 加的夫、Belfast 貝爾法斯特、Edinburgh 愛丁堡、Crown dependency 皇家屬地、Bonfire Night 篝火之夜、Burns Night 彭斯之夜、Remembrance Day 國殤紀念日、Boxing Day 節禮日等）照用
- `exams.js` 同 `study.js` 譯名要一致（v0.22 曾經唔一致：簡單多數制／懸峙議會，已統一）

**備注（`note`）格式規則（v0.23 起）**
- 備注用 `\n` 分行；`.ans-note` 同 `.rv-yue` 係 `white-space: pre-wrap`，保留分行同縮排空格
- 顯示時「💡 備注：」獨立一行，內容由下一行開始（Practice 答案框同 Exam 結果頁 review 都係）
- 內容係列點就一定要分行，一點一行；時間線每行以「→」開頭（包括第一行）
- 有層次用「• 」主項、四個空格 + 「◦ 」子項；獨立段落（例如「陷阱：」）前留空行
- 記憶法格式：第一行「記憶法：」或「記憶法（主題）：」，之後每行「A → B → C；」，最後一行用「。」結尾
- 四地區對照類記憶法統一次序：Scotland → England → Wales → Northern Ireland
- 同一題組嘅所有題目用完全相同嘅記憶法文字；原有專題備注（例如邱吉爾金句）放喺記憶法上面一行

## 廣東話翻譯（yue）規則（v0.66）

v0.66（Track 2，plan `2026-10-07_plan_zh-hk-locale.md` Q5 / Q7 / Q8、T-101…T-109）將 data 嘅廣東話由書面語改做**香港廣東話口語**：`EXAMS` 嘅 `yue` / `oy` / `note` 同 `STUDY` fact `yue`。UI 文字（`locales/zh-HK.js`）**仍然係書面語**（Q5）。之後改任何 `yue` / `oy` / `note` / fact `yue` 都要跟下面規則。

**入口（改之前一定要睇）**
- `.proj-docs/plans/2026-10-07_yue-terms.md`：統一譯名表、用戶決定保留嘅譯名、常設規則 R1 / R2 / R3、套用細節。新譯名要用戶批准先加落表
- `.proj-docs/plans/2026-10-07_yue-batch-1.md`「語感規則」1–15（唯一定義）：誰 → 邊個、哪 → 邊、的 → 嘅、在 / 位於 → 喺、甚麼 → 乜嘢 / 咩、了 → 咗、不 → 唔、給 → 俾、和 / 及 → 同、須 → 一定要、才 / 時 → 先 / 嗰陣、約 / 至 → 大約 / 到、擊敗 → 打敗、如何 → 點樣…；生硬句子改口語語序；唔好過度口語（冇「啲嘢」「嘢嚟」）
- 批次對照表：`2026-10-07_yue-batch-{1..5}.md`（Exam）、`-6-study.md`（Study fact）、`-7-antileak.md`（R2）；每份有同名 `.json`（機讀，0-based）。batch 7 JSON 有 `userDecision`，重放前要濾走 `keep`；S-055（E7·Q12）冇 JSON 紀錄，記錄喺 `yue-terms.md` R3
- 流程（Q8）：先出對照表（md + json）→ 用戶確認 → 先套用；reviewer / developer 唔可以直接定稿內容

**R1：官方手冊先、現況後**（用戶 2026-10-07）
- 手冊（考試答案）同現實唔同嘅 note：配合答案嘅講法放前面，現況放括號：`<手冊數值>（考試以官方手冊嘅<手冊數值>為準；<年份>年起<新數值>）`；exam note 同 Study fact（#38 / #197 / #200 / #230 / #231）寫法一致
- 選項本身簡化咗嘅（E15·Q20 護國公年份、E17·Q12 選民登記冊）同一精神，呢兩題 note 由空變有，屬已批准嘅 Q7 例外；未能確認現況嘅（上議院世襲貴族 92 位）唔加 note
- English `q` / `o` 受 guard 保護，現況只可以寫喺 `note`（必要時 `yue`）

**R2：題目翻譯唔可以洩露答案**（用戶 2026-10-07；W-015、batch 7）
- 原因：Practice mode 作答前可以撳「翻譯」（`state.yueShown`），題目 `yue` 同所有選項 `oy` 一齊出。題目 `yue` 同**正確選項** `oy` 共用一個獨特詞（錯誤選項冇），而 English 題目同答案冇同樣提示，就算洩露
- 改法：題目 `yue` 入面同答案有關嘅詞**保留 English 原詞**，中英之間一個半形空格（「Diwali 有咩別稱？」「Beefeaters 有咩重要性？」「Referendum 係乜嘢？」，同 W1「NSPCC 係乜嘢？」一致），其餘照舊口語；`oy` / `note` 唔郁。R2 優先於統一譯名表，但只限題目 `yue`
- 中文標準譯名本身描述咗答案（公民投票、權力下放、財政大臣、宗教改革、開齋節、宰牲節），而題目問緊佢係乜嘢 / 角色，都要跟 R2（batch 7 D 節）
- **用戶指定例外（保持現有 `yue`，之後批次唔好再提案改）**：A6 Exam 3 · Q3「蘇格蘭嘅除夕夜叫乜嘢？」（正確 `oy`「Hogmanay（蘇格蘭除夕）」亦唔改）、A9 Exam 12 · Q17「邊個慈善機構幫助長者？」、A10 Exam 17 · Q11「君主喺國會開幕大典做邊兩件事？」
- 檢查：QA script `w015Scan`（`.proj-docs/qa/scripts/2026-10-07_qa-v066.js`，heuristic）batch 7 之後由 48 對減到 34 對 = 3 對用戶例外 + 31 對 English 原題已經有同樣提示；將來多咗嘅對要逐條判斷。Exam mode 作答前冇翻譯，計分唔受影響

**R3：同一條 English 題目，`yue` 一定一樣**（用戶 2026-10-07；S-055）
- `q` trim + 唔分大細階之後相同，喺唔同 exam 嘅 `yue` 要逐字一樣；改一題就要連同其他相同題目一齊改。`content-guard-test` 嘅 R3 check 會 fail 唔一致嘅組合（先例：E7·Q12 跟 E12·Q16 統一做「Chancellor of the Exchequer 嘅角色係乜嘢？」）

**其他**
- **共用 note 一定要逐字一致**：同一題組（節日記憶法、英國重要戰役、選區記憶法、投票權時間線、和平紀念碑等；v0.66 有 23 組、104 題）所有副本一齊改。Guard 冇查呢樣，改完要自己 diff
- **專有名詞保留**：人名、地名、機構名照統一譯名或者保留表（例如加的夫、奧蘭治的威廉、聖詹姆士宮、Yeoman Warders（皇家衛士）、占士邦、總警司、小額錢債審裁處），入面嘅「的」唔改做「嘅」；格式「中文（English）」，原本 English 先嘅（`Snowdonia（雪墩）`）保持 English 先
- 只改語體、唔加減資料（Q7 / R-007）；`oy` 空 slot（`''`，年份 / True-False 題）保持空；`note` 照上面「備注（`note`）格式規則」分行
- **要定期覆核嘅現況數字**（R1 括號，手冊數值唔郁）：Senedd 96 名議員（2026 年選舉起；手冊 60）、歐洲委員會（Council of Europe）46 個成員國（2022 年起；手冊 47）、英聯邦（Commonwealth）56 個成員國（2022 年起；手冊 54）。有變就一齊改 exam note 同對應 Study fact
- 改完跑 `node tests/content-guard-test.js`（或者成個 `run-all.sh`）；`similar-test` / `study-test` 由 data 讀 `yue`（T-102），唔使跟住改測試

## 記憶法題組（v0.21–v0.31）

題目 ID 格式「exam.idx」（idx 由 0 起，即 `EXAMS[exam][idx]`，同 `practiceStreak` key 一樣）。

| 組 | 題數 | 題目 ID | 內容 |
|---|---|---|---|
| 守護聖人 | 4 | 1.4、2.15、10.0、11.9 | Andrew 30/11 Scotland；George 23/4 England；David 1/3 Wales；Patrick 17/3 Northern Ireland |
| 守護聖人節日 | 2 | 8.4、14.0 | 同上 |
| 首都 | 6 | 2.16、2.21、3.16、4.10、9.8、9.23 | Edinburgh／London／Cardiff／Belfast → 四地 |
| 花卉 | 5 | 4.1、8.1、8.12、9.0、9.19 | Thistle／Tudor rose／Daffodil／Shamrock → 四地 |
| 投票權時間線 | 15 | 1.2、1.6、2.4、5.8、5.14、6.19、7.2、7.9、7.21、9.6、10.6、10.13、11.20、13.8、13.23 | 1689 → 1832 → 1918 → 1928 → 1969 |
| 三個地方議會 | 7 | 6.8、8.19、7.17、9.18、12.2、13.7、14.1 | 蘇格蘭議會 129／Senedd 60／北愛議會 90；都用比例代表制 |
| 全年節日日曆 | 11 | 2.14、16.17、6.16、7.1、14.20、2.17、9.11、10.4、9.7、11.22、12.19 | 25/1 Burns Night → 31/10 Halloween → 5/11 Bonfire Night → 11/11 Remembrance Day → 26/12 Boxing Day → 31/12 Hogmanay |
| 陪審團 | 3 | 1.13、1.14、5.5 | 18 至 70 歲 → 選民登記冊 → 隨機抽選 |
| 國會與選舉數字 | 4 | 3.11、6.15、4.3、7.13 | 650 選區 = 650 MP；每 5 年大選；補選 |
| 發明家／科學家 | 6 | 8.11、6.9、9.10、1.20、8.6、14.7 | Newton／Bell／Fleming／Whittle／Crick／Berners-Lee |
| Margaret Thatcher | 3 | 1.8、11.7、17.4 | 任期 1979–1990 共 11 年；首位女首相；20 世紀最長 |
| Crown dependency（三層） | 7 | 1.19、5.19、12.0、17.5、2.1、5.3、11.0 | UK 四地 → Crown dependency（曼島、海峽群島）→ 海外領土（St Helena、Falklands、Gibraltar、Bermuda）；陷阱 Shetland／Isle of Wight／Anglesey |
| 戰役時間線 | 15 | 2.10、4.17、9.20、6.18、7.5、1.11、16.20、6.11、12.3、14.5、4.0、9.1、16.12、11.6、17.12 | 9 世紀 Vikings → 1066 Hastings → 1314 Bannockburn → 1588 Armada → 1805 Trafalgar → 1815 Waterloo → 1940 Battle of Britain |
| Magna Carta（v0.71） | 8 | 4.16、6.6、7.14、8.13、12.23、15.6、16.16、17.21 | 1215 King John 簽署 → 限制國王權力、國王都要守法 → 法治基礎 |
| 國王 vs 國會（v0.71） | 8 | 16.10、11.18、15.12、15.2、1.22、15.19、13.5、15.16 | 1628 Petition of Right → 1642–1651 Civil War → 1649 處決 Charles I、Cromwell 護國公至 1658 → 1660 Restoration → 1688 Glorious Revolution |
| 二戰（v0.71） | 9 | 6.22、15.22、8.0、3.18、4.22、2.23、16.6、14.12、2.8 | 1939 入侵波蘭 → 1940 Churchill / Dunkirk / Battle of Britain → 1940–41 Blitz → 1944 D-Day → 1945 VE / VJ Day（11.6、17.12 留喺戰役時間線） |
| 都鐸王朝（v0.71） | 9 | 1.5、3.3、4.15、13.22、8.23、12.8、13.11、17.13、16.2 | 玫瑰戰爭 → Henry VII → Henry VIII 脫離天主教會、解散修道院、六任妻子 → Elizabeth I 處決 Mary, Queen of Scots（16.20 留喺戰役時間線） |

**加新題組嘅做法：** 用 Python regex 按 `q:"…"` 匹配整行再替換 `note:"…"`，跟住用 node 載入 `EXAMS` 驗證題組內所有 note 相同，最後升 `APP_VERSION`、跑 `tests/run-all.sh`。

## 功能現況

**首頁**
- Header：`Life in the UK ⓘ` + `Exam Practice v${APP_VERSION}`；ⓘ 彈出簡介 popover
- 三個 mode 掣一行：Study / Practice / Exam；預設 Practice；描述撳咗先顯示
- **My Review（v0.53）：** Practice mode 描述下面一個獨立 section，兩格：「Wrong answers」（數字 + 「N to clear」，超過 24 題加「· 24 per round」）同「Flagged」（「N flagged」；v0.58 或之前係「N saved」；空格提示「Tap ［書籤 SVG］ on a question to flag it」）；下面小字「Wrong answers come from Practice and Exam, and clear when you get them right here. Up to 24 per round.」；**錯題同 flag 都冇記錄時成個 section 唔顯示**；只喺 Practice 出；一格係 0 就灰色（Flagged 空格提示用 app 內嘅書籤 SVG icon，唔用 🔖 emoji）。**v0.68 起**說明移入錯題 tile、Flagged 冇副標題；**v0.70 起**錯題 tile 有題時只顯示大數字 + 標題 + 說明（冇「N to clear / 尚餘 N 題」，數字已經講咗），0 題時只顯示「Nothing to review yet / 暫時未有需要複習的題目」（冇說明）；`home.wrongToClear` 已刪
- My Review 下面標題「Practice By」（v0.59 改 Title Case），三個 tab 文字改做 Difficulty / Chapter / Exam（id 不變）：Difficulty（預設；v0.39 起難度只顯示英文；v0.53 起只有 Easy / Basic / Medium / Hard / Expert 五行，拎走「Hard & Expert」）/ Chapter / Exam，每粒掣顯示「已掌握/總數 · %」+ 進度條（`.mastery-bar`，absolute 貼格仔底；格仔要 `overflow: hidden` 先唔會爆出圓角，By Exam 喺 v0.42 補返）；下面嘅提示寫明「連續答啱 3 次 = 掌握、每輪最多 24 題、每題一輪一次」
- Exam 下只有 Select Exam（完成過有 ✓）
- Mode 同 tab 記住喺 localStorage `homePrefs`
- 兩個 reset 掣：Practice「Reset progress」、Exam「Reset completed exams」（v0.59 起用 app 內 modal：「Reset practice progress?」/「Mastery streaks, wrong answers and flags will be cleared.」同「Reset completed exams?」/「All ✓ completed marks will be cleared.」，掣「Keep」/「Reset」；之前係瀏覽器 confirm）；v0.54 起「Reset progress」會一齊清 `practiceStreak`、`wrongList`、`practiceFlags`，My Review 隨即收埋

**Practice mode**
- 題目同選項次序隨機；揀完即刻 reveal
- 問題卡右上「Translate」掣：展開題目 + 每個選項嘅廣東話；答完自動固定顯示；下一題重設
- **問題卡 header（v0.41）：** 原本獨立一行嘅「Question X of Y · n/m correct」同 progress bar 拎走；progress bar 變咗問題卡頂邊（5px，`.q-progress`）；題號行寫「QUESTION X OF Y ★★★」，Practice 答咗題之後星星後面有綠色 pill「✓ 答啱/已答」（**v0.55 已拎走**，由數字圓圈計數取代），窄 mon 放唔落會換去第二行；最頂深藍 header 嘅「✅ correct · 📝 done」已拎走
- **Practice 數字圓圈（v0.55，preview 同用戶確認）：** Practice（包括 Chapter / Difficulty / Exam / All Exams（v0.65 起 UI 叫 All Questions）/ Wrong answers / Flagged / Similar 臨時 session）問題卡頂都有數字圓圈，**取代 progress bar**（`hasNavDots()`；計時器仍然只係 `hasExamTools()`）。有幾多題出幾多粒，每行最多 12 粒。顏色：答啱綠（`.dot.ok`）、答錯紅（`.dot.bad`）、未答白、做緊金圈；flag 用 2.5px 橙色邊（保留綠／紅底），未答 + flag = 橙色空心框；撳圓圈跳去任何一題（`goToQuestion()`，未答都得）。下面靠右「Correct n | Wrong n | Unanswered n | Flagged n」（`practiceDotsMetaHtml()`，`.dots-meta.practice` 收細字同間距，390px 一行；360px 或更窄會斷兩行）
- **快捷 Prev / Next（v0.40；v0.41 改做只有符號）：** 答完（Practice reveal／Exam submit）之後，問題卡右上 Translate 嘅位置變做兩粒圓形「←」「→」（最後一題 ✓、臨時 session ↩；`title` / `aria-label` 寫返文字），同底部掣共用 `nextAction()`（Next → / Finish ✓ / See Results → / ↩ Back）；未答前唔顯示；窄 mon 時會換行靠右
- 答案框格式：`✓ Correct! · 🔥 n/3` → 英文答案 → `【廣東話翻譯】 Q) … A) …` → `💡 備注：`（獨立一行）→ 備注內容（支援多行）
- **掌握機制：** 同一題連續答啱 `MASTERY_STREAK`（=3）次 = 掌握，答錯即歸零；開練習時剔除已掌握題，全組掌握後再全部出；每輪最多抽 `PRACTICE_ROUND_MAX`（=24，v0.52 起；之前 25）條未掌握題（Chapter / Difficulty / All Exams；Exam 1–17 本身 24 題），**每題一輪只出一次，「Question X of Y」嘅 Y 唔會變**（v0.38 起；v0.32–v0.37 會將未掌握題重新排去 queue 尾，令 Y 越做越大，已取消）；答錯或未夠 3 次嘅題下一輪再抽；存 localStorage `practiceStreak` `{ "exam.idx": n }`
- **Similar Questions（v0.35）：** 答完（啱或錯）喺 Prev / Next 掣下面顯示同一條 `STUDY` fact 嘅其他題目（`fact.src` 除本題外嘅 key；每題只屬一條 fact，408 題入面 284 題有類似題）。內容：Core Fact（英文 + 廣東話）、「Appears in」題號 chip（v0.59 起寫 `E9·Q15`，1-based；之前係 raw `9.14`；圖例：This question / 🏆 Mastered / In progress / 🔥 0/3）、每題 `Exam N · Qn` + 🔥 進度（掌握咗寫 🏆 Mastered，v0.58 或之前係 ✓ Mastered）+ 題目同翻譯（唔顯示答案）。Exam mode 唔顯示；冇類似題就唔顯示
- **Practise these N：** 掣字係 plural `similar.practise`：1 題寫「▶ Practise this one」，2 題以上「▶ Practise these N」（v0.60，CUI-0007；之前 1 題會寫「Practise these 1」）。開臨時 session（`examNum = 'similar'`），按列出次序每題做一次，照計 `practiceStreak`；最後一題 Next 變「↩ Back」（v0.36 起；之前寫「Back to Question n」會誤以為係返去臨時 session 第 n 題），還原原本 session 同題目位置；session 內唔再顯示 Similar Questions；返 Home 或開新練習會清走暫存 session（v0.62 起叫 `sessionReturn`，之前係 `similarReturn`）
- **臨時 session（v0.62，`js/screens/sideSession.js`，P3 Lane C2）：** Similar「Practise these N」同 Study fact 練習共用。`sessionReturn = null | { kind: 'quiz', state } | { kind: 'study', scrollY }`（`SESSION_RETURN_KIND`）；`isSideSession()`、`clearSideSession()`（`startExam` 同 `leaveToHome` call）、`startSideSession(examNum, questions, returnTo)`、`returnFromSideSession()`。開始時**由零砌晒 `state` 每個欄位**（唔 spread 舊 session：`flags`、`setPool = null`、`masteredBefore` / `reviewTotal` / `cleared = 0` 等，R-001），**強制 `mode = PRACTICE_MODE`**（唔讀首頁 `pendingMode`，R-002），`stopExamTimer()` + `examTimeUp = false`。Session 內：冇 Similar panel（`renderSimilar`）、冇 round note（`renderRoundNote`）、最後一題「↩ Back」（`nextAction`），全部睇 `isSideSession()`；答案照計 `practiceStreak` / 錯題 / Practice flag。**Fact session**：`startFactPractice(id)`（`examNum = FACT_PREFIX + id`，例如 `'f21'`，`isFactExam` / `factIdOf` 只認 `f` + 數字，所以 `'flagged'` 唔係；header `common.factSet` = `Fact #21`），題目 = `f.src` 次序每題一次；↩ Back 返 Study（冇結果頁）：`showScreen('screenStudy')` + `renderStudy()` + `scrollTo(0, scrollY)`，tab / chip / 搜尋本身留喺 `study` object 同 `#studySearch`，唔使另存；← Home 照返首頁並清 `sessionReturn`。v0.62 未有入口掣；**v0.63（P3 PR-3 Lane C）**：入口 = Study fact 卡來源列嘅「▶ Practise this one / these N」（`data-action="startFactPractice" data-arg="{id}"`，`actions.js` `numArg`）。Study return 多咗 `factId`（`{ kind: 'study', scrollY, factId }`）：↩ Back 之後 `flashStudyFact(id)` —— 卡加 `.flash`（金色 outline，`FACT_HIGHLIGHT_MS` = `REVIEW_HIGHLIGHT_MS` 1.5s，Q8），還原 scroll 後卡唔喺畫面（例如練習期間清單變咗）就 `scrollIntoView({ block: 'nearest' })`（R-010；喺畫面就唔郁，scroll 照還原）；卡冇咗（例如 Hide mastered）就乜都唔做。CUI-0010：`studyReturnPoint()` —— 已經有 Study return（session 入面再 call，例如連撳兩下 / 鍵盤 repeat）就沿用舊嗰個，唔會將 quiz 畫面嘅 `scrollY`（0）覆蓋 Study 位置；喺 Similar session 入面開 fact session 會將返回點換做 Study（QA E4，接受）
- 按 Chapter / Difficulty 練習唔會標記為完成 exam
- 結果頁兩粒掣：Exam mode「Retry」/「Another Exam」，Practice mode「Retry」/「Another Practice」（v0.50；之前係 Retry Exam / Practise Again / Choose Another）；`.retry-btn` / `.another-btn` 上下兩組一齊改字；v0.39 起「重做 / Choose Another」掣喺 Review Answers 上面同最底各有一組（`.retry-btn`，兩粒一齊改字）
- **Exam 結果頁（v0.50，先做 preview v1–v6 同用戶確認）：**
    ◦ 頂頭 icon 跟 mode（`MODE_ICONS`：v0.71 起 Practice 📝、Exam 🎯，同首頁模式卡一致；之前相反，用戶要求對調）
    ◦ 判定前面加返 icon（v0.51）：「🎉 PASSED」/「📚 NEEDS IMPROVEMENT」
    ◦ 結果頁標題「By Difficulty」唔要中文（v0.51）
    ◦ 分數只顯示一次：「17 / 24 · 71%」，唔合格成行紅色（`.result-score.fail`），合格深藍；Exam mode 拎走 Correct / Wrong / Score 三格
    ◦ 結果卡入面 24 粒圓點（`#resultDots`）：綠 = 啱、紅 = 錯、白底紅框 = 未答、橙色圈 = flag 咗（保留啱錯顏色）；撳圓點跳去下面嗰題 review（`jumpToReview()`，被 filter 收埋就轉返 All，金框閃一下）
    ◦ 圓點下面靠右「Correct n | Wrong n | Unanswered n | Flagged n」（Wrong 唔包未答；大字分數嘅錯題 = Wrong + Unanswered）
    ◦ Review Answers filter：「All n / Wrong n / 🔖 Flagged n」（Wrong 包未答；0 題 disabled）；flag 咗嘅題目後面有橙色書籤 icon（同問題卡一樣，冇「Flagged」字）
- **Review Answers 排版（兩個 mode，v0.50）：** 答案下面虛線分隔，「【廣東話翻譯】」翻譯（v0.59 起同答案框一致；之前係「【廣東話】」）同「💡 備注：」各自一段；備注逐行一個 row（`noteHtml()`），•／→ 開頭 hanging indent，前置空格 + ◦ 子項再縮，空行保留
- **Practice flag（v0.53）：** Practice 問題卡都有書籤掣（放喺 Translate 左邊），flag **長期保存**喺 localStorage `practiceFlags` `{ "exam.idx": true }`，reload 後仍然 on；Exam 嘅 flag 照舊只喺該次考試（`state.flags`）；`isFlaggedNow(i)` 按 mode 揀來源
- **錯題庫（v0.53）：** localStorage `wrongList` `{ "exam.idx": true }`；Practice 每次 reveal 答錯就加；Exam 交卷時「有答但答錯」嘅題加入（未答唔加）；**只有喺 Wrong answers review 入面答啱先會清走**（`examNum === 'wrong'`），平時練習答啱唔清
- **Review round（v0.53）：** 撳 Wrong answers 格 → `startExam('wrong')`；Flagged 格 → Flagged 列表畫面。Review set 唔理掌握過濾，全部洗牌後抽最多 24 題（`PRACTICE_ROUND_MAX`）；題數多過 24 時問題卡**上面靠右**出細字「Round 1 of N · 24 of your T wrong answers / flagged questions」（`renderRoundNote()`）；暫時冇中途續做
- **Flagged 列表畫面（v0.53，`#screenFlagged`）：** 頂頭「Practise flagged (N)」掣；每題一行：題目 + 廣東話 + 「Exam N · Qn」+ 書籤掣（撳即 unflag，列表即時更新）；冇 flag 剩低就顯示「No flagged questions left.」
- **Practice 結果頁（v0.53，跟 Exam 結果頁排版）：** 📝 icon（v0.71 前 🎯）、「18 / 24 · 75%」分數行（Practice 永遠唔紅）、拎走 Correct / Wrong / Score 三格、24 粒結果圓點（flag 橙圈）、All / Wrong / Flagged filter；下面一行 note：一般練習「Mastered N more this round · m/total in {set}」，錯題 review「Cleared X from your wrong answers · Y left」（v0.59；之前寫 wrong list）；每題 review 開頭有 streak tag（🔥 n/3 或 🏆 Mastered，`streakTag()`）；舊嘅「Original order / Wrong first」chip 同 `reviewOrder` 已拎走
- 結果頁 PASSED / NEEDS IMPROVEMENT 同 remark 只喺 Exam 1–17（Exam mode 或 Practice > By Exam）顯示；Chapter / Difficulty / All Exams（v0.65 起 UI 叫 All Questions）只顯示分數

**Exam mode**
- **真考試模式（v0.43）：** 揀選項即刻暫存（`state.answers`），唔使逐題 Submit；Next / Prev 自由走，返去見到自己揀嘅選項（藍色），**隨時可以改**；全程唔顯示啱／錯、答案框、翻譯
- **最後一題底部 Next 掣變做「Submit」**（同 ← Prev 一行；冇另外嘅 Submit 行，`#examSubmitRow` 已拎走；v0.55 起問題卡頭嘅快捷掣喺最後一題變「✓」（title「Submit」），同 Practice 最後一題嘅 ✓ 一樣，行同一個 `submitExam()`；v0.43–v0.54 係收埋），撳咗就去結果頁；有未答題會先彈 Submit modal（見下面），取消就留低繼續做
- 快捷 ← → 喺 Exam mode 一直顯示（v0.47 起；之前要揀咗選項先出，去到未答嘅下一題就唔見咗）；唔影響掌握記錄
- **Random Exam（v0.45）：** Exam mode 嘅 All Exams 掣變做「🎲 Random Exam」（細字「24 questions from 408」，v0.59；之前「24 Qs from 408 Qs」）：每次由全部 408 題隨機抽 `RANDOM_EXAM_SIZE`（=24）題，**同一條 STUDY fact 最多抽一題**（`randomExamPick()` 用 `FACT_BY_QKEY` 去重，即係唔會有相類似題）；用齊考試工具同 PASSED / NEEDS IMPROVEMENT 判定；Retry 會再抽過一套新題；唔會標記 completed。Practice › By Exam 嘅「📝 All Questions (408)」（v0.71 前 🎯）（v0.65 M6 改名；v0.59–v0.64「🎯 All Exams (408 questions)」；之前「(408 Q)」）維持原狀（每輪 24 條未掌握題）
- **考試工具（v0.44，Exam 1–17；v0.45 起 Random Exam 都有）：**
    ◦ 45 分鐘倒數（`EXAM_MINUTES`），右上角取代「Exam」標籤，一直顯示；剩 5 分鐘（`EXAM_WARN_SECONDS`）變紅閃；到 0 自動交卷，直接去結果頁，頁頂紅框「⏱ Time's up — your exam was submitted automatically.」（`#resultTimeUp`）；計時用 `examDeadline`（Date.now），唔怕 setInterval 延遲
    ◦ 書籤 icon（SVG，冇圓圈）flag 每一題（`state.flags`），未 flag 灰色空心、flag 咗橙色實心
    ◦ 問題卡頂 24 個有數字嘅圓點（12 × 2），撳就跳題（`goToQuestion()`）：已答深藍實心、未答白色、已答 + flag 橙色實心、未答 + flag 橙色空心框、做緊嗰題金色圈；Exam mode 唔顯示 progress bar（圓點已經代表進度）
    ◦ 圓點下面靠右「Answered n | Unanswered n | Flagged n」
    ◦ Submit 提示（v0.48 起用 app 內 modal `showConfirm()`，唔再用瀏覽器 confirm）：標題「Submit exam?」，內容逐行列「N questions unanswered」（1 題寫「1 question unanswered」）「M flagged」「You can still go back and check them.」，掣「Keep going」/「Submit」；全部答晒又冇 flag 就直接交
    ◦ 考試中撳 ← Home 先彈 modal「Leave the exam? / Your answers will be lost.」，掣「Stay」/「Leave」，Leave 先離開同停計時；結果頁返 Home 唔問
    ◦ Modal：撳背景或 Esc = 取消；`z-index: 300` 蓋過 sticky header；v0.59 起首頁兩個 Reset 掣都用呢個 modal，成個 app 冇瀏覽器 alert / confirm；預設 focus（v0.60）：破壞性動作 Reset ×2 同 Leave 喺 Keep / Stay（`showConfirm({ focusCancel: true })`，誤撳 Enter / Space 唔會清資料），Submit 喺 Submit；v0.69（S-025）：開住時 Tab / Shift+Tab 只喺 modal 兩粒掣之間循環（`trapConfirmTab`，由 `actions.js` 嘅 keydown listener call），關閉（Cancel / OK / Esc / 撳背景）後 focus 返去開 modal 前 focus 緊嘅元素（`confirmReturnFocus`；modal 開住時再開第二個 prompt 保留第一個 opener，S-095）。OK 之後或者時間到轉 screen（Leave → Home、Submit / time up → Results），`showScreen` 會 blur 留喺被收埋 screen 入面嘅 focus，focus 落返 `body`（S-096 / S-098：冇呢步，時間到之後 focus 會留喺已隱藏嘅 quiz back 掣，一下 Enter 就由結果頁返 Home）；W-024（v0.69）：倒數到 0 時 `finishExam()` 會先關咗開住嘅 Submit / Leave modal，唔會蓋住結果頁或者重複提交
- 實作：`renderQuestion()` 用 `showAnswer = revealed && state.mode === 'practice'` 控制顏色、答案框同翻譯；Exam mode 唔再用 `state.revealed`，`nextAction()` 喺 Exam 最後一題返 `{ label: 'Submit', run: submitExam, quick: false }`；`submitExam()` 計未答數再 `finishExam()`（按 `state.answers` 計分）
- Results：分數、pass/fail（18/24）、按難度統計表、逐題 review

**Study（溫習）**
- 四個 tab：Chapters（Ch1–5 chip）/ Timeline（10 個時代，戰爭紅色 + 「⚔️ Wars only」）/ Geography（國家 chip → 類型分組）/ People（角色 chip，君主按時序）
- 搜尋（英文 + 廣東話）、書籤、已掌握 ✓、「✓ Hide mastered」「Bookmarked only」chip；v0.59 起 Study 介面全部英文（`📖 Study`、搜尋 placeholder「Search facts (English / Cantonese)」、people chip 例如「👑 Monarchs」「✒️ Writers」、Geography 類型同 Timeline 時代只寫英文、「Appears ×n」（v0.63 換做來源列）、「No facts match.」、tooltip Bookmark / Mastered）；fact 內容（en + yue）照舊
- Prefs 存 `studyPrefs`、`studyMastered`、`studyBookmarks`
- **v0.62 視覺統一（P3 Lane V，mockup `mockups/study-unify.html` #study-chapters / #timeline / #similar-core，用戶揀 Q2-a 全 navy）**：選中嘅 tab（`.study-tab.active`）同 chapter / nation / people chip 用 `--navy`（同 Practice tab / `.chip.active` 一樣，刪咗 `.chip.ch.active` 紫色 override）；搜尋 focus `--navy-light`；裝飾（fact 左邊框、`📅` year tag、timeline 年份 + 圓點、Geography `.study-sub-title`、Home Practice By Chapter `.ch-num`）用 `--study-accent*` token（見「Design tokens」）；戰爭紅色唔變；紫色只留廣東話（`.fact-yue`）。難度用 `starsHtml(f.d)`（同題目卡一樣 5 粒星、未到嘅 `.off`、tooltip `Difficulty d/5`），刪咗 `.tag.diff`。書籤掣 = `bookmarkSvg('', { decorative: true })`，保留 class `.fact-btn.star`（+ `.on`，`study-test` hook）；`study.css` 一定要畀 path 設 `fill` / `stroke`（`.fact-btn.star path` outline `currentColor` = `--text-muted`；`.on` = `--orange` 填色 + `--flag-bg` 底 + 橙邊，同 `.flag-btn` 一樣），唔設會變黑色 icon。「Bookmarked only」chip 前面係 `bookmarkSvg('chip-flag', { decorative: true })`（chip 字已經係 label，唔用會讀「Flagged」嘅 aria-label），filter 未開時 outline（`#studyChips .chip:not(.active) .chip-flag path`，只限 Study；結果頁 filter chip 照舊橙色）、開咗白色填色。O1：兩粒 fact 掣由 `factMarkButtonHtml()` 生成，有 `aria-label`（`study.bookmark` / `study.mastered`）+ `aria-pressed`；O2：`.fact-btn` 32×32 + `::before { inset: -6px }` → 約 44px 可撳範圍。W-009（v0.62 review）：兩粒掣之間 `gap` 只有 4px（`.fact-actions` 嘅 `--fact-actions-gap`），兩邊 -6px 會重疊，而 ✓ 喺 DOM 後面畫喺上面，撳書籤右邊會切換 Mastered；所以相鄰邊收到 gap 一半（`.fact-btn.star::before { right }`、`.fact-btn.tick::before { left }` = `calc(var(--fact-actions-gap) / -2)`），其餘三邊照 -6px，冇視覺改動；改 gap 只改 `--fact-actions-gap`。O8：Similar panel 金色 Core Fact（`.sqm-fact`）保留金色底（Q3-1），形狀跟 Study `.fact`：左邊框 4px（原 3px）、四角 `--radius-md`（原 `0 8px 8px 0`）、padding 12px 14px（原 10px 12px）。資料仍然寫 `lifeuk.studyBookmarks`，同 Practice `lifeuk.flags` 分開，冇遷移
- **v0.63 fact 卡組件 + 掌握聯動 + 入口（P3 PR-3 Lane C，T-201…T-209，mockup `mockups/study-unify.html` #study-chapters / #mastery / #source-nodes / #similar-core / #fact-session / #card-extras，用戶 Q3-1 / Q6 三樣都要 / Q7 / Q8）**：
  - **組件**：`js/components/factCard.js` `factCardHtml(f, { variant, marks, opts })` + `css/components/fact.css`。`full` = Study 白卡（`study.js` `renderFact()` 經 `factMarks(f)` 傳 `{ bookmarks, mastered, derived }`）；`core` = Similar panel 金色「📌 Core Fact #id」（`.sqm-fact.core`，冇掣、冇來源列，panel 自己有 node map）。**組件唔讀 `study` global**（`upgrade-test` 鎖死 `study.mastered` / `study.bookmarks` / `.study-tab.active` 名同形狀；`structure-test` 去除註解同字串後 grep `study` 守住）。保留 hook：`.fact`、`.fact.war`、`.fact.mastered`、`.fact-btn.star` / `.tick`、`.fact-en`、`.fact-yue`、`.sqm-fact-*`；新：`data-fact-id`、`.fact-id`、`.fact-btn.trophy`、`.fact-src`、`.fact-practise`、`.fact.flash`。O5：`.fact` 加 `--shadow-sm`。Q6：卡頂第一個係 `#id` 細字（`--fs-2xs`，`id="factId{id}"`，亦係 Practise 掣嘅 `aria-describedby`）
  - **記憶法（v0.71，B3）**：`factMemoryText(f)`（`js/domain/similar.js`）攞 `f.src` 第一條有記憶法嘅題目 note，由「記憶法」開始、去咗標題行（「記憶法（…）：」）；`factFullHtml` 喺廣東話句下面加 `<details class="fact-mem">`「💡 記憶法」（`study.memoryAid`，en 都係中文，同 `common.noteLabel` 一樣入 i18n CJK 白名單），預設收埋，內容用 `noteHtml` 逐行 render；summary 44px 可撳範圍；改題目 note 就會同步，冇另一份資料。v0.71 有 60 張卡有記憶法；`study-test` 逐張檢查
  - **掌握規則（T-204 / T-205）**：fact 已掌握 = 手動剔 `study.mastered[id]` **或** `factMastery(f).derived`（`f.src` 每題都 `isMastered`）。推算值每次 render 即時計，**唔寫 storage**；`isFactMastered(f)` 用喺 Hide mastered 同頂部進度。推算 🏆：✓ 位變做 🏆 掣（`class="fact-btn tick trophy"`、`aria-disabled="true"`、**冇 `data-action`**，撳咗乜都唔做；保留 `.tick` 等 W-009 hit ring 照用），卡同手動剔一樣半透明（Q7）；推算同手動剔同時成立時顯示 🏆（**S-032 決定唔改**：手動剔被 🏆 遮住、冇得喺 UI 取消；Reset practice progress 之後張卡仍然係已掌握，因為手動剔仲喺度。如果用戶覺得混淆，再喺 `masteredDerived` tooltip 加一句「亦已手動剔」）。部分題掌握唔算。O7：header `#studyProgress` pill `🏆 n / 236 mastered`（綠色，`.study-progress`），n = 全部 236 條入面 `isFactMastered` 嘅數；舊 cache `index.html` 冇呢個 element 就唔填（`renderStudyProgress()` guard）
  - **Reset**：首頁「Reset practice progress」**唔清** Study 剔同書籤（O6，用戶決定，維持現狀）；但推算 🏆 跟 Practice streak，所以 reset 之後推算 🏆 會消失（R-007），手動剔仍然喺度
  - **來源列（T-206）**：取代「Appears ×n」tag（`study.appears` / `.tag.freq` 已刪）：`Appears in:`（`similar.appearsIn`）+ 每條 `f.src` 一粒 node（`questionNodeHtml(k)`（`components/tags.js`；v0.63 叫 `similarNodeHtml`，喺 similarPanel），同 Similar map 共用：`E9·Q15`、🏆 綠 / 進行中紅 / 未做白；**純顯示，唔可以撳**）+「▶ Practise this one / these N」（`similar.practise` plural）→ 臨時 session（見「臨時 session」）。所有 fact 都有（1 題都有，寫 this one）。v0.70 起唔再數 node（`FACT_SRC_INLINE_MAX` / `.wrap-btn` 已刪）：純 flexbox，`.fact-src-nodes` `flex: 1000 1 max-content`、掣 `flex: 1 0 auto`，node 一需要分行掣就自己落下一行並全闊（任何闊度、所有 Study tab、中英文；`factsession-test` 守住），node 一行放得落就喺旁邊維持 pill 闊度（W-012 兩個來源嘅卡照樣一行）。星星（`.fact-meta .stars`）v0.70 起自己一行，喺 tag 下面靠左（用戶揀唔搬去右邊）。Timeline（v0.70）：`.tl-year` `text-box: trim-both cap alphabetic` + `align-self: start`，圓點喺年份文字（一行或兩行）垂直正中，字同圓點之間 `--tl-year-gap` 6px（`study-test` 守住）
  - **↩ Back highlight（T-207，Q8）**：返 Study 後卡金色 outline 1.5s（`FACT_HIGHLIGHT_MS`），見「臨時 session」
  - **CUI-0009**（v0.63）：fact 掣 `::before` 由 padding box 計，-6px 只係伸出可見邊 5px（實際 42px 高）；改做 `inset: calc(-1 * (var(--fact-btn-ring) + var(--fact-btn-border)))`（`.fact-actions` 定義 `--fact-btn-border: 1.5px`、`--fact-btn-ring: 6px`），相鄰邊 `calc(var(--fact-actions-gap) / -2 - var(--fact-btn-border))` → 可撳範圍 45px 高、外側伸出可見邊 6px，W-009 唔重疊照守；外觀冇變
  - **W-011**（v0.63 review）：`factMastery()` 喺 `f.src = []` 時係 0 / 0，之前 `derived: true`（冇來源 fact 會自動當 🏆）；改做 `derived: m.total > 0 && m.mastered === m.total`，`factmastery-test` 守住（而家 236 條全部有來源，未觸發過）
  - **S-030**（v0.63 review）：「▶ Practise」掣視覺約 29px 高（≤ 480px 全闊成行時 33px），加隱形 `::before` ring 只向上下伸（`--fact-practise-ring: 8px` + `--fact-practise-border: 1.5px`，同 CUI-0009 一樣由 padding box 計要加返 border）→ 可撳約 45–49px 高；左右唔伸。上面係來源列 10px `padding-top`（單行）或者純顯示 node（換行，6px gap，重疊冇影響）、下面係卡 12px padding，唔會出卡；外觀冇變，`factsession-test` 用 `elementFromPoint` 掃掣中線守 ≥ 44px
  - **難度星數**：fact 卡顯示 fact 嘅 `f.d`；**15 / 408 題 `q.d ≠ f.d`**，所以由 fact 跳去題目會見到唔同星數。資料唔改（R-008），用戶介意先開 data ticket
- `studyLoad()` 會驗證 `studyPrefs`（v0.59，CUI-0003）：`tab` 要係 `STUDY_RENDERERS` 嘅 key、`chapter` 要喺 `CHAPTERS`、`nation` / `group` 要係 `all` 或者已知 key、每個值類型要同預設一樣（例如 `hideMastered` 要 boolean）；唔啱就用預設，成個 prefs 唔係 object 就全部預設。之前壞 `tab` 會令 `renderStudy` throw `STUDY_RENDERERS[study.tab] is not a function`，Study 一片空白

**PWA**
- Service Worker 係 root 嘅 `sw.js`（v0.57 起）：`importScripts('js/core/config.js')`，cache 名 `lifeuk-v${APP_VERSION}`，`SHELL` 預 cache `./`、`index.html`、data 同**所有** css / js
- 點解要改：v0.56 或之前用 `Blob` + `URL.createObjectURL` 註冊 inline SW，Chrome 一直 reject（console：`SW error: … The URL protocol of the script ('blob:...') is not supported`），所以其實從來冇離線 cache；SW 一定要係同 origin 嘅真 file
- `registerSW()` 喺 `file://` 直接 skip（file 協議唔支援 SW，免得 console 出 error）；註冊用 `updateViaCache: 'none'`，因為升版本只改 `config.js`（被 import 嘅 file），唔繞過 HTTP cache 就可能睇唔到新版本
- Install 用 `new Request(u, { cache: 'reload' })` 攞 SHELL，GitHub Pages 嘅 `max-age=600` 唔會令新 cache 存咗舊 file
- Activate 只刪 `lifeuk-v*` 而又唔係今個版本嘅 cache：`dcwhung.github.io` 同其他 app 共用 origin，唔好刪人哋嘅 cache
- 離線時 fetch 失敗只有 page navigation 先 fallback 去 `./`；script / css 唔會收到 HTML
- Cache-first：升版本先會更新已安裝嘅 app
- **Fetch 只讀自己個 cache**（v0.59，S-003）：`caches.open(CACHE).then(c => c.match(req))`（`fromOwnCache`），唔用 `caches.match()`：後者會搜晒成個 origin 所有 cache，包括其他 app 嘅；佢哋 cache 咗同一個 URL 就會俾我哋用錯。離線 fallback `./` 都係由自己 cache 攞
- **Manifest / 安裝**（v0.59，CUI-0002）：`<head>` 有 `<link rel="manifest">`、SVG favicon + 192 PNG fallback、`apple-touch-icon`（180）、`theme-color` meta（navy，一早已有）。Chrome 嘅安裝條件（manifest + icon + 有 fetch handler 嘅 SW + https / localhost）齊晒，`js/pwa/pwa.js` 嘅 `beforeinstallprompt` → install banner 先真係會出（之前冇 manifest，banner 係死碼）；banner UI 冇改。**v0.60**：PC Chrome / Edge 都會發 `beforeinstallprompt`，所以 banner 只喺 touch 裝置（`matchMedia(INSTALL_TOUCH_QUERY)`，`(pointer: coarse)`）出；event 照樣 `preventDefault()` + 存 `deferredPrompt`。Banner 加 ✕（`.install-close`，`data-action="dismissInstall"`，aria-label / title = `app.installDismiss`）：收起 + 寫 `lifeuk.installDismissed`，之後永遠唔再出。**v0.61（CUI-0008，同 review S-020）**：撳 Install → `promptInstall()` 一開頭將 `deferredPrompt` 攞落 local 再清做 `null`，之後先 `prompt()` + await `userChoice`，所以 double tap / 快速兩下 Enter 第二次係 no-op（Chromium 每個 `BeforeInstallPromptEvent` 只准 `prompt()` 一次，第二次會 reject；`prompt()` reject 都會 catch 住）；**無論 accepted 定 dismissed 都收起 banner**（event 已用咗，唔會再留低死掣）；喺 Chrome 對話框撳取消**唔寫** `lifeuk.installDismissed`，Chrome 下次再發 `beforeinstallprompt` 會再出，只有 ✕ 先永久收；另外 listen `appinstalled`（例如由瀏覽器選單安裝）都收起 banner。**v0.61（S-022）**：✕ 視覺仍然係 28×28，但 `.install-close` 加 `position: relative` + `::before { inset: -8px }`，可撳範圍擴到 44×44（WCAG 2.5.5）；banner Install 同 ✕ 之間 `gap` 係 14px，左邊伸出 8px 唔會蓋到 Install（改 `gap` / padding 要再量）。iOS / Safari 冇 `beforeinstallprompt`，banner 從來唔會出。`pwa-test` 用 CDP `Page.getInstallabilityErrors` 驗證（要 persistent profile：Playwright 嘅 `newContext()` 係 incognito，Chrome 一定報 `in-incognito`）
- iOS 唔睇 manifest 裝 app，用返 `apple-mobile-web-app-*` meta + `apple-touch-icon`

## localStorage keys

v0.58 起全部 key 都有 `lifeuk.` prefix（`LS_PREFIX`，`js/core/config.js`）：`dcwhung.github.io` 同其他 app 共用 origin（例如 `run365.prefs`、`tripspend.*.v1`），唔好撞名，亦**唔好掂人哋嘅 key**。

| Key | 內容 |
|---|---|
| `lifeuk.completedExams` | `{ examNum: true }` |
| `lifeuk.practiceStreak` | `{ "exam.idx": n }` |
| `lifeuk.homePrefs` | `{ mode, view }` |
| `lifeuk.practiceFlags` | `{ "exam.idx": true }`（v0.53，Practice flag，長期保存） |
| `lifeuk.wrongList` | `{ "exam.idx": true }`（v0.53，錯題庫；Practice + Exam 加入，只喺 Wrong answers review 答啱先清） |
| `lifeuk.studyPrefs` / `lifeuk.studyMastered` / `lifeuk.studyBookmarks` | Study 頁狀態 |
| `lifeuk.uiLang` | v0.59：UI 語言（JSON 字串，例如 `"en"`；`setLang()` 寫入，冇就用 `DEFAULT_LANG` `en`；存咗但冇對應 locale 都當 `en`）。v0.65 起 header pill（`toggleLang`）會寫 `"en"` / `"zh-HK"`；舊 shell 冇 zh-HK locale 時存咗 `"zh-HK"` 都當 en，唔會覆寫；唔喺 `LEGACY_LS_MIGRATION`（新 key，冇舊名） |
| `lifeuk.installDismissed` | v0.60：install banner 撳過 ✕（`INSTALL_DISMISSED_LS`，值 `true`）；有就唔再出 banner。新 key，唔喺 `LEGACY_LS_MIGRATION` |
| `lifeuk.migrated` | v0.58 遷移完成 marker（`MIGRATED_LS`，值係寫入時嘅 `APP_VERSION`；只睇有冇） |
| `lifeuk.migrateFallback` | v0.58 遷移用：JSON array，列出「merge 寫唔到、今次載入改用舊 key、但新 key 仲有舊 value」嘅新 key 名（`MIGRATE_FALLBACK_LS`）；寫 marker 時清走 |
| `lifeuk.i18nReloaded`（**sessionStorage**） | v0.59（S-014）：舊 shell 載入 locale / i18n 失敗、已經 reload 過一次（`I18N_RELOAD_SS`，`js/main.js`）；成功開到就清走 |

**舊 key 遷移（v0.58，code 全部喺 `js/core/utils.js`，lazy，idempotent）：**
- **點解喺 `utils.js`（CUI-0004）**：SW 換版嗰下，舊 SW cache 嘅 v0.57 `index.html`（冇 migrate tag）可以配新 SW 俾嘅 v0.58 js（全部 js file），頁面用 `lifeuk.*` 但冇遷移 → 顯示 0 進度，答一題寫咗細細個新 key，下次載入「新 key 優先」就刪咗真資料。v0.57 `index.html` 冇 migrate tag，所以遷移一定要喺一個佢有 load 嘅 file 入面（揀咗 `utils.js`，因為 `getLS` / `setLS` 本身喺度，`store.js` 頂層第一次讀之前已經 load 咗）；`getLS` / `setLS` 經 `lsKey()` 第一次用 storage 就行 `ensureLegacyMigrated()`（每次載入一次），所以**有 load v0.58 `utils.js` 嘅頁面**讀寫之前一定搬咗。`js/core/migrate.js` 已刪（tag + SHELL 一齊拎走）
- `typeof LEGACY_LS_MIGRATION === 'undefined'`（反方向混合：v0.57 `config.js` + v0.58 `utils.js`）→ 唔搬，照用 v0.57 key，唔會 throw
- 第三種混合（W-005）：v0.58 `config.js` / `store.js` + v0.57 `utils.js` → 呢個頁面冇得 lazy 搬，直接讀寫 `lifeuk.*`（顯示 0 進度），但唔會刪舊 key、唔會寫 marker；下次正常 v0.58 載入冇 marker → object map 逐條 merge，舊進度 + 嗰個頁面嘅答題都保留。**prefs（homePrefs、studyPrefs）就會用嗰個頁面寫落嘅新 value**（新 key 贏），即係可能變返預設
- 對照表係 `LEGACY_LS_MIGRATION`（舊名 → 新 key 常數）；加新 key 唔使改，只有改名先要加
- 舊有、新冇 → 照抄**原始字串**（唔 parse，壞 JSON 都照搬）去新 key，讀返確認一樣先刪舊 key
- 新舊都有，**冇 marker**（`lifeuk.migrated` 未寫，即係新 key 可能只係混合頁面寫落嘅）→ merge：
  - `MERGE_LS` 入面嘅 object map（practiceStreak、practiceFlags、wrongList、completedExams、studyMastered、studyBookmarks）逐條 entry `{...舊, ...新}`：同一題新嘅贏，舊有新冇嘅保留
  - 其他（prefs：homePrefs、studyPrefs）→ 新 key 贏
  - 注意（S-008）：同一題「新嘅贏」唔係「大嘅贏」，可以令 streak 跌（例如舊 2 + 新 1 → 1）；混合頁面做過嘅刪除（unflag、`clearWrong` 答啱清錯題、Reset progress）喺新 key 度係「冇咗嗰條」，merge 會由舊 key 帶返嗰條出嚟（復活）
  - 任何一邊 parse 唔到做 plain object（壞 JSON、array、scalar）→ 留新 value，唔會 throw
  - 寫 merge 結果、讀返確認先刪舊 key；寫唔到 → 新 key 還原做原本 value、記 fallback（今次載入讀寫舊 key）、舊 key 保留，下次載入再 merge
  - **W-004**：fallback 嗰陣新 key 已經有 value → 將新 key 名記入 `lifeuk.migrateFallback`。因為今次載入嘅答題寫咗落舊 key，新 key 反而係舊資料；下次載入對呢啲 key **倒轉優先次序**：object map `{...新, ...舊}`、prefs 用舊 value、parse 唔到用舊 value。成功搬完嘅 key 會喺記錄度拎走；寫 marker 時成個記錄刪走
  - **S-010**：個記錄喺寫新 key **之前**先寫（reserve）。記錄都寫唔到（quota 爆到連幾十 byte 都冇）→ 唔寫新 key，改為將 merge 結果寫落**舊 key**（確認先）再刪走舊嘅新 key，今次載入用舊 key（下次載入淨係得舊 key，照抄）；連舊 key 都寫唔到 → 今次載入留喺新 key（寫得入就下次 merge 新嘅贏，寫唔入就乜都冇改），兩個 key 都唔刪
- 新舊都有，**有 marker** → 新 key 唔郁，刪舊 key（W-001，用戶接受嘅風險，見下面 v0.57 tab）
- `lifeuk.migrated` 只喺**冇 marker 嘅一次載入入面全部 8 個 key 都處理完、冇 fallback** 先寫；空 storage 都會寫（之後 storage 入面最少有呢一個 key）
- `OBSOLETE_LS`（`reviewOrder`，v0.53 起冇用）直接刪
- 每個 key 各自 try/catch：一個 key 出錯唔會停其他 key，只 `console.warn`，唔會刪資料、唔會令 app 開唔到；`OBSOLETE_LS` 清理、marker 寫入各自另外一個 try
- 抄唔到（`setItem` throw，例如 QuotaExceededError；或者讀返唔一樣）→ 新 key 還原做寫之前嘅 value（之前冇就刪走），舊 key 保留，記入 `LS_KEY_FALLBACK[新 key] = 舊 key`；`getLS` / `setLS` 每次 call 都經 `lsKey()` 查表，所以**今次載入照讀寫舊 key**，唔會生個空新 key；之後有位嘅一次載入先搬完（嗰次先寫 marker）
- 舊 key 名好普通（`wrongList`、`homePrefs`…）：同 origin 任何 app 如果有冇 prefix 而同名嘅 key，都會俾當係我哋嘅資料搬走（目前已知其他 app 全部有自己 prefix）
- 已知風險（用戶接受）：如果同一個瀏覽器仲開住 v0.57 嘅 tab，v0.58 搬完之後嗰個 tab 照寫舊 key，下次載入會因「新 key 優先」被刪；iOS 主畫面 app / 單一 tab 用法唔受影響；升級前關晒其他 tab
- 已知風險（W-004 多 tab 版本）：tab X 喺 fallback（讀寫舊 key），同時 tab Y 搬完寫咗 marker 同清咗 `lifeuk.migrateFallback`；之後 X 再寫舊 key，下次載入有 marker →「新 key 優先」，X 喺 Y 搬完之後寫嘅進度會冇咗。要 quota 爆 + 兩個 tab 同時開先會發生
- 唔喺對照表嘅 key（其他 app）完全唔掂；`tests/migrate-test.js`、`tests/upgrade-test.js` 驗證
- **v0.58 之後唔好 rollback 去 v0.57**（CUI-0005）：v0.57 只讀冇 prefix 嘅 key，搬完之後會顯示空進度；喺 v0.57 寫入嘅舊 key，再升返 v0.58 時（有 marker →「新 key 優先」）會被刪走。出事要 roll forward，或者 revert 去某個 v0.58.x commit（新 file 仍然讀 `lifeuk.*`）。**revert 定 roll forward 都一定要升 `APP_VERSION`**（例如 v0.59），否則 cache 名唔變，已安裝嘅 PWA 會一直用舊 cache，永遠攞唔到新 file

## 測試

```bash
npm i playwright-core          # 任何位置，放入 NODE_PATH
NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium ./tests/run-all.sh
APP_URL=https://dcwhung.github.io/life-in-uk-test/ ./tests/run-all.sh   # 跑 live
```

**畫面回歸檢查（唔喺 run-all.sh）：** `node tests/tools/visual-diff.js <git-ref>` 會 `git archive` 嗰個 ref 去 temp dir，喺 38 個畫面狀態 × 390 / 900px 比較兩邊每個 element 嘅 computed style、位置同文字；refactor（唔應該改外觀）嘅時候用，詳情睇 `tests/tools/README.md`。

**CJK 字體（v0.65，S-045）：** `lang-switch-test` 嘅 M4 check 量中文換行，測試機要有 CJK 字體（例如 `fonts-noto-cjk`；冇嘅話 Chromium 用 fallback / tofu，結果因環境而異）。

測試會重新產生 `tests/shot-*.png`，跑完用 `git ls-files -m 'tests/*.png' | xargs git checkout --` 還原，唔好一齊 commit。**唔好用 `git checkout -- tests/*.png`**：shell glob 會包埋 git 未追蹤嘅新截圖（例如 `shot-similar.png`），git 遇到唔認識嘅 path 會成句失敗，一張都冇還原（v0.53 因此誤 commit 咗截圖，要另開 commit 還原）；未追蹤嘅截圖直接 `rm`。

`tests/pages-server.js` 唔係 suite：`sw-test`、`upgrade-test` 同 `pwa-test` 共用嘅 python static server；另外 export `appFiles(root)`（`sw.js` + SHELL 每個 top-level file / folder，抄 app 去 temp dir 用）。Server（`Cache-Control: max-age=600`，port 0 由 OS 揀、server 印返 port；python 起唔到或者提早退出就即刻 fail）。`upgrade-test` 用嘅 v0.57 commit（`dc84cab`）喺 shallow clone 可能冇，會 fail 並提示 `git fetch --unshallow` 或者設 `V057_REF`。

| Suite | 覆蓋 |
|---|---|
| `test.js` | Practice 基本流程、多選；Exam：揀選項中性藍色、Next / Prev 保留同可改答案、最後一題 Next 變 Submit（同 Prev 一行）、未答 confirm、按暫存答案計分 |
| `shuffle-test.js` | 408 題選項打亂後答案對應 |
| `study-test.js`、`subfilter-test.js` | Study 四個 tab、搜尋、書籤、sub-filter（v0.59：chip 英文 `Hide mastered` / `Bookmarked only` / `Writers`；`#studySubChips` 用 `hidden` attribute）；v0.62（P3 Lane V）`study-test` 用 computed style 對 token（`tokenRgb('--navy')` 等）：選中 tab / chapter chip = navy、搜尋 focus = navy-light、`--study-accent` = navy-light、timeline 年份 / 圓點 / fact 左邊框 / Geography 小標題 / year tag / Home `.ch-num` 用 study accent、戰爭年份仍然紅；書籤掣係 `aria-hidden` SVG 冇 ☆ / ★ 字、off = `--text-muted` outline、on = 橙色填色 + `--flag-bg`；chip `Bookmarked only` 有 `svg.chip-flag`、off 時 outline；兩粒掣 `aria-label` + `aria-pressed` 撳完變 `true`；掣 32×32、`elementFromPoint` 喺掣外 5px（上、左）仍然撳中；W-009：書籤可見框右邊內 1px 撳中書籤、✓ 左邊內 1px 撳中 ✓、✓ 右 / 上外圍仍然撳中 ✓；`.tag` / `.fact-btn` radius = `--radius-xs`（v0.63：Ch 1 卡冇 tag，用臨時 `.tag` probe）；v0.63：`.fact` box-shadow = `--shadow-sm`（O5）、卡第一個 element 係 `.fact-id` `#id`、`factCardHtml` 有定義；CUI-0009：逐 px 掃，兩粒掣可撳高度 ≥ 44px、外側伸出 ≥ 6px；v0.66（T-102）：廣東話搜尋詞由 data 動態揀（fact `yue` 次序第一個只喺廣東話出現、≥ 5 條 fact、≥ 2 章嘅兩字 CJK 詞，而家係「英國」），顯示筆數要**等於**符合嘅 fact 數（之前寫死「首相」≥ 5） |
| `diff-test.js` | 難度數據完整、按難度練習、結果統計、難度掣只顯示英文、只有 Easy–Expert 五行（冇 Hard & Expert）；v0.62：Study fact 用 `.fact .stars`（5 粒星 + `Difficulty d/5` tooltip），冇 `.tag.diff` |
| `yue-test.js`、`oy-test.js`、`yue2-test.js` | Translate 掣、選項翻譯、答案框格式、Exam mode 冇翻譯（`yue2-test` 跳去、`oy-test` 搬第一條有選項翻譯嘅題目去最前，避免抽到年份／True-False 題隨機失敗） |
| `mode-test.js`、`info-test.js` | 首頁 mode/tab、持久化、ⓘ popover；考試中返 Home 會問 |
| `mastery-test.js` | By Exam 進度條喺格仔入面、貼底（v0.42）；掌握機制（每輪每題一次、Y 固定、Ch1 要 3 輪先全掌握）、進度顯示、兩個 reset（v0.59 起經 app 內 modal：標題 / 內容 / 掣文字、預設 focus 喺 Keep（v0.60）、Keep 唔清、Reset 先清、冇瀏覽器 dialog；Reset progress 一併清錯題同 flag，My Review 收埋） |
| `result-test.js` | 結果頁 PASSED / remark 只喺 Exam 1–17 顯示；重做掣按 mode 改字、上下兩組掣、Practice 結果 All / Wrong / Flagged filter |
| `batch-test.js` | Exam mode Random Exam 24 題；Practice 每輪最多 24 題、下一輪由未掌握題抽、最後幾題每輪再出直至掌握 |
| `similar-test.js` | Similar Questions section、Practise these N 臨時 session 同返回（v0.62：返 Home 斷言 `sessionReturn === null`）；掣字 plural（1 題 `▶ Practise this one`、3 題 `▶ Practise these 3`，v0.60）；map node `E12·Q6` 等 1-based、`🏆 Mastered`；v0.62（O8）：Core Fact `.sqm-fact` 左邊框 4px、四角 `--radius-md`、padding 12px 14px；v0.63：Core Fact 嘅 HTML = `factCardHtml(f, { variant: 'core' })`，入面冇掣、冇 `.fact-src`；v0.66（T-102）：題目翻譯行同 `EXAMS[9][14].yue` 比較（之前寫死「地區議會做乜嘢？」） |
| `examresult-test.js` | Exam 結果頁：icon、分數行（唔合格紅）、冇三格、24 圓點狀態、計數、All / Wrong / Flagged filter、書籤 icon、撳圓點跳題、翻譯 / 備注排版、掣文字；合格唔紅；Practice 都冇三格、有圓點同 filter + 📝（v0.71 前 🎯）+ Retry / Another Practice；CUI-0012：320px 圓點喺卡 content box 入面、冇橫向 scroll、正圓、號碼喺 border 入面（390px 同樣檢查） |
| `review-test.js` | v0.53：「Practice by」標題同 tab 文字；冇記錄唔出 My Review；Practice flag 位置同 reload 後保留；兩格數字同 remark；錯題由 Practice / Exam 加入、只喺 review 答啱先清；>24 題嘅 round note 位置同文字；Flagged 列表、unflag、練 flagged、空列表；Practice 結果頁（icon、分數、圓點、filter、mastery note、streak tag） |
| `examtools-test.js` | Submit / Leave 用 app 內 modal（v0.69 S-025：Tab / Shift+Tab 循環、Esc / Keep going 之後 focus 返 Submit；S-095 第二個 prompt 保留第一個 opener；W-024 倒數到 0 關 modal；S-098 Leave modal 開住時間到，結果頁撳 Enter 唔會返 Home；掣名、Esc 取消、冇瀏覽器 dialog；預設 focus Submit → Submit、Leave → Stay，v0.60）；Random Exam（30 次抽題全部 24 題、24 個唔同 fact、每次唔同；工具、PASSED、Retry 抽新題、首頁掣名）；Exam 1–17 計時器（45:00、最後 5 分鐘變紅、到 0 自動交卷 + 結果頁提示）、24 圓點狀態同跳題、書籤 flag、計數、Submit / Home 提示；Practice 冇計時，圓點係啱／錯版（見 practicedots-test） |
| `factsession-test.js` | v0.62（P3 Lane C2）：`isFactExam('f21')` 係、`'flagged'` / `21` 唔係，`factIdOf`、`examLabel` = `Fact #21`；首頁 Exam mode + 計時中嘅 Exam 1（有 flag、`reviewTotal`、`cleared`、`examTimeUp`）→ Study Ch 3 + Hide mastered + 捲到 fact #21 喺畫面頂下 200px（v0.63；之前固定 600px，卡唔喺畫面會觸發 R-010 scrollIntoView）→ `startFactPractice(21)`：mode Practice 而 `pendingMode` 仍係 exam、`examNum 'f21'`、題目 = `f.src` 次序、answers / revealed / yueShown / flags 空、`setPool null`、`masteredBefore` / `reviewTotal` / `cleared` 0、計時器停、`examTimeUp false`、`sessionReturn = { kind: 'study', scrollY, factId }`；CUI-0010（v0.63）：session 入面再 call 一次 `startFactPractice(21)`，`scrollY` 唔變；header `Fact #21 · Practice`、Question 1 of 8、`reviewTotal` 50 都冇 round note、冇 Similar panel、答錯寫 streak 0 + 入錯題、答啱 streak 1、最後一題 `↩ Back` / `↩`；↩ Back → Study（唔係結果頁）、tab / chapter chip / Hide mastered / scrollY 還原、`sessionReturn` 清；timeline + 搜尋 `magna` 來回後一樣；← Home 清 `sessionReturn`、`startExam` 清、之後普通 set 最後一題 Finish ✓ 去結果頁；v0.63（T-206 / T-207）：Study Ch 3 卡 #21 來源列 8 粒 node（`E4·Q17` 綠 mastered、`E6·Q7` 紅 weak…，f.src 次序）、node 唔可以撳、冇 `.tag.freq`、`Appears in:`、掣 `▶ Practise these 8` + `startFactPractice` / `21`、`aria-describedby` 指去 `#21`，1 題 fact `▶ Practise this one`；真係撳掣 → `Fact #21`，最後一題 ↩ Back → 卡喺畫面、有 `.flash`、outline = `--gold`，`FACT_HIGHLIGHT_MS` 後冇咗；R-010：由 scrollY 0 開始，返嚟卡會捲入畫面；未知 fact id 唔開 session；v0.64（W-012）：390px 下 13 張 2 個來源嘅卡（#25、30…231）來源列兩粒 node 同掣喺同一行 |
| `quicknav-test.js` | 快捷 ← / →（符號、title、最後一題 ✓ / ↩；Exam 最後一題 ✓ = Submit；v0.62：↩ 後 `sessionReturn === null`）；問題卡 header：Question X of Y、Practice 用圓圈唔用 progress bar、冇 score pill、header 冇 stats |
| `doubletap-test.js` | v0.64（CUI-0011）：Study Ch 3「▶ Practise」（fact #21）同首頁 By Exam 格 1 捲到同 quiz 選項 A 同一高度，mouse `dblclick`、click + 50ms 後再 click、touch tap ×2（`hasTouch` context）→ Q1 未答、`lifeuk.practiceStreak` / `lifeuk.wrongList` 冇寫；正常：單撳 + 等過 guard 撳選項會答、新畫面即刻撳 slop 以外（選項 D）照答、Exam 同一畫面快撳 Next ×2 / 選項 + Next / ← ×2、鍵盤 Enter / Space 開 session 即刻答、轉畫面後 confirm modal Keep 即刻撳得；S-035：`clickGuard.at` 推後（模擬負數 dt）同一點照答；S-038：Similar「Practise these N」（Exam 4 Q16，390×420 頁令掣捲到 side session 選項 A 高度）`dblclick` → side session Q1 未答、streak / wrong 冇寫；click 開 Exam → `finishExam()` → 350ms 內同一點撳結果 dot 照生效（`.hl`）。輸出 `DOUBLETAP PASS` |
| `sw-test.js` | v0.57：將 app copy 去 temp dir，用 python static server（加 GitHub Pages 一樣嘅 `Cache-Control: max-age=600`）serve（或者 http 嘅 `APP_URL`）；index.html 每個 `<script src>` / `<link href>` 都喺 `sw.js` SHELL、SHELL 每個 file 存在；`sw.js` 註冊成功、cache 名跟 `APP_VERSION`、SHELL 全部 cache 咗；`setOffline(true)` reload 仍然出首頁、css 生效、開到 Practice；同 origin 其他 app 嘅 cache（`other-app`）唔會俾 activate 刪；`other-app` 入面放咗一個假 `js/main.js`（同 origin、我哋會 load 嘅 URL），SW 控制之後 reload 唔會用到佢（S-003）；淨係改 temp copy 嘅 `config.js` 版本號就會裝新 cache、刪舊 `lifeuk-v*` cache；冇 page / console / SW error（瀏覽器自己 probe `/favicon.ico` 嘅 404 除外） |
| `factmastery-test.js` | v0.63（P3 T-204 / T-205）：seed streak（fact #3 三題全 🏆、#21 1 / 8）→ `factMastery` `{ mastered: 3, total: 3, derived: true }` / `{ 1, 8, false }`；Study Ch 2：#3 卡 `.mastered`、✓ 變 🏆（`.fact-btn.trophy`、`aria-disabled="true"`、冇 `data-action`、tooltip `🏆 Mastered…`）、force click 🏆 之後 `lifeuk.studyMastered` 仍然 `null`；手動剔 #4 半透明程度同推算一樣（Q7）；#21 部分掌握唔算；header `🏆 2 / 236 mastered`；Hide mastered 收埋兩張；`streaks = {}` → 推算 🏆 冇咗、手動剔仍在、`🏆 1 / 236 mastered` |
| `structure-test.js` | v0.57：index.html / js 冇 inline `on*=`、index.html 冇 inline `<style>` / `<script>` / `style=`（progress bar 闊度除外）、每個 function ≤ 30 行、`tokens.css` 以外嘅 css 冇 hex / `rgb(a)(` 顏色（P2）、任何 css 冇 `--text-inverse-[0-9]`（v0.60，S-018）、`study.css` / `chips.css` / `home.css` / `fact.css`（v0.63）冇 `.fact-yue` / `.sqm-fact-yue` 以外嘅 `--purple*` / `--year-bg`（v0.62，P3 Q2-a）、v0.63：`js/components/factCard.js` 存在而且（去咗註解同字串）冇 `study` 字、`.fact*` / `.sqm-fact*` 規則只喺 `fact.css`（`study.css` / `quiz.css` 冇）、v0.64（S-031）：`js/components/*.js`（去咗註解同冇 `${` 嘅引號字串）冇用 `js/screens/*.js` 頂層定義嘅名、markup / template 每個 `data-action` 都有 `ACTIONS` handler 而每個 handler 都有人用、v0.69（S-023）：css 每個 `var(--x)` 都有 `--x:` 定義（`tokens.css` 或者 local custom property，註解唔計；4 個 in-memory sample）、`file://` 載入冇 page error / console error / failed request |
| `content-guard-test.js` | v0.66（T-101 / S-055）：node only。`data/exams.js` / `data/study.js` 受保護欄位 = `tests/fixtures/content-baseline.json`（除 exams `yue` / `oy` / `note`、fact `yue` 之外全部原樣；可改欄位只比形狀）；R3 同一條 English 題目 `yue` 一致。Fail 時列 `Exam N · Qk (index)`；**唔好為咗令佢 pass 重生成 fixture**（見「File 結構」） |
| `migrate-test.js` | v0.58：用似真用戶嘅舊資料（completedExams、homePrefs、practiceFlags、practiceStreak、reviewOrder、wrongList、studyPrefs / studyMastered / studyBookmarks，全部非空）+ 其他 app 嘅 key（`run365.prefs`、`tripspend.*.v1`）reload：`lifeuk.*` 係原始字串、舊 key 同 `reviewOrder` 刪咗、其他 app 嘅 key 一字不改、UI 跟資料（Practice › By Chapter、Flagged 5、mastery 數、Exam 1–5 ✓、Study geo tab）；全部搬完寫 `lifeuk.migrated`；有 marker 新舊都有 → 新嘅贏（UI 讀新 key）；冇 marker 新舊都有 → streak / flags 逐條 merge（同一題新嘅贏）、homePrefs 新嘅贏、舊 key 刪、寫 marker、UI 顯示 merge 後進度（3/408、Flagged 3）；一邊唔係 object（壞 JSON、array）→ 留新 value；再 reload 兩次唔變、app 寫入只落 `lifeuk.*`；壞 JSON 照搬唔 crash；空 storage 只生 marker；fail-safe：stub `setItem` 令 `lifeuk.practiceStreak` throw QuotaExceededError、`lifeuk.studyPrefs` 寫唔落（verify 唔對），今次載入 UI 照顯示舊進度（3/408、Study geo）、答題寫返舊 key、冇空新 key，fallback 期間冇 marker；拎走 stub reload 後舊 streak + 新答案全部喺 `lifeuk.practiceStreak`、舊 key 冇咗、寫 marker；冇 marker 新舊都有而 merge 寫入 throw → 兩個 key 原封不動、冇 marker、UI 讀舊 key，拎走 stub 後 merge 完成；g2（W-004）：merge 寫唔到、fallback 期間答題（1.2 → 3）落舊 key、新 key 記入 `lifeuk.migrateFallback`，下次載入舊嘅贏（1.2 = 3 唔係 stale 嘅 0）、兩邊 entry 都保留、舊 key 刪、寫 marker、清記錄；g3（S-010）：merge 寫入同記錄寫入都 throw → 冇記錄冇 marker，fallback 期間答題下次載入照保留（1.2 = 3）、舊 / 混合頁面 entry 都喺、寫 marker |
| `upgrade-test.js` | v0.58（CUI-0004）：v0.57 檔案由 git 攞（pinned `dc84cab`，v0.57 嘅 main）。v0.59：① 舊 shell 冇 locale / i18n tag → `main.js` 自己載入再開（等 `#examGrid` 出咗先讀 UI）；`captureUI` 只比較掌握數（`.exam-mastery`），唔比較會改字嘅掣名；current copy 包埋 `locales/`。① 混合 shell（`file://`）：temp dir 放 v0.57 `index.html`（冇 migrate tag）+ 而家嘅 js / css / data，seed 舊 key → UI 即刻顯示舊進度（3/408、Flagged 5）；答一題，再開而家嘅 `index.html` → 舊 streak 全部 + 新答案都喺 `lifeuk.practiceStreak`、其他 value 原始字串、舊 key 冇咗、有 marker、其他 app key 唔郁。② 反方向混合：v0.57 全套 + 而家嘅 `utils.js` → 冇 error、照讀 v0.57 key、storage 唔郁。③ QA `upgrade-sim` 核心：python server（`max-age=600`）serve v0.57，SW 裝好、seed 舊資料、記低 UI；原地換做而家嘅 file，reload 等新 SW activate + 刪 `lifeuk-v0.57` cache，再 reload → v0.58、8 個 value 原始字串、舊 key + reviewOrder 冇咗、其他 app key 一樣、新 key 只多 marker、UI（mode / view、Flagged、Wrong、mastery grid、完成 ✓、Study tab / 掌握 / 書籤）同升級前一樣、再 reload 唔變（呢個 case 唔保證撞到 SW 換版嘅 race，race 由 ① deterministic 咁覆蓋）。④ 第三種混合：而家嘅 file + v0.57 `utils.js`，seed 舊 key、答一題 → 舊 key 原封不動、冇 marker；換返而家嘅 `utils.js` reload → 舊 streak 全部 + 新答案、5 個舊 map 每條 entry 都喺、舊 key 冇咗、有 marker。⑤ S-014：舊 shell + 刪咗 `locales/en.js` → 只 reload 一次（數 main-frame navigation，reload 可以早過第一個 load event），之後 `#examGrid` 係 `main.js` 嘅 `I18N_BOOT_FALLBACK_MSG`、冇 page error。v0.62：① 混合 shell 亦斷言 `main.js` 補載咗 `js/screens/sideSession.js`（`isSideSession` 有定義）；v0.63：① 亦斷言補載 `js/components/factCard.js`（`factCardHtml`）同補 `css/components/fact.css` `<link>`；⑤ 加 W-010 case：而家嘅 `index.html`（tag 齊）+ 刪咗 `js/core/i18n.js` → 一樣 reload 一次再顯示 fallback、冇 page error。v0.65：⑥（T-008）current `index.html` 減走 zh-HK tag + pill 模擬 v0.64 shell，存咗 `uiLang = "zh-HK"` → en、冇 `[i18n]` warning、storage 唔被覆寫，之後開 current shell 即刻 zh-HK；⑦（W-013）current shell 刪 `locales/zh-HK.js` → pill `hidden`、冇 client rect、en、冇 page error。約 7 秒 |
| `studyprefs-test.js` | v0.59（CUI-0003）：`lifeuk.studyPrefs` 壞 `tab`（唔 throw、返 chapters、有 fact）、chapter 99 → 1、未知 nation / group → `all`、`hideMastered: 'yes'` → `false`、prefs 唔係 object → 預設、正常 prefs（timeline + chapter 4）保留、冇 page error |
| `pwa-test.js` | v0.59（CUI-0001 / 0002）：python server serve repo root（或者 http 嘅 `APP_URL`）；載入冇 4xx / failed request；`<link rel="icon">` 有 SVG + PNG（200、SVG decode 到、PNG 192×192）、`apple-touch-icon` 180×180；manifest link 200、JSON 有齊 start_url / scope / display / 兩個顏色（= `tokens.css` 嘅 `--navy`）、name / short_name / description = 頁面入面嘅 `t()`（S-019）、`theme-color` meta = navy、有 192 any / 512 any / 512 maskable，每個 icon load 到而尺寸同 `sizes` 一樣；CDP `Page.getAppManifest` 冇 error、`Page.getInstallabilityErrors` 冇 error（persistent profile）；假 `beforeinstallprompt` → banner 出、`promptInstall()` call `prompt()`、accepted 收 banner；v0.60：init script override `matchMedia('(pointer: coarse)')`：fine pointer（PC）→ 照 `preventDefault` 但 banner 唔出；coarse → 出、✕ 有 `app.installDismiss` aria-label / title、撳 ✕ 收起 + 寫 `lifeuk.installDismissed`、reload 再 dispatch 唔出；v0.61 CUI-0008：dismissed outcome → banner 收起而 `lifeuk.installDismissed` 仍係 `null`、`Promise.all([promptInstall(), promptInstall()])` → `prompt()` 只 call 1 次、dispatch `appinstalled` → banner 收起；v0.62 S-027：`appinstalled` 之後 `promptInstall()` 唔再 call `prompt()`；S-026 `checkInstallPromptRejected`：`prompt()` reject + `userChoice` 永遠唔 settle → `promptInstall()` 1 秒內完成（timeout race）、banner 收、`lifeuk.installDismissed` 仍係 `null`、冇 page error；S-022：✕ 仍然 28×28、`elementFromPoint` 喺 ✕ 外 6px（右上角、左邊）撳中 `.install-close`、Install 中心同右邊仍然係 `#installBtn` |
| `i18n-test.js` | v0.59：靜態掃描（node）：`js/` 每個 `t()` key、`index.html` 每個 `data-i18n` / `data-i18n-attr` key 都喺 `LOCALES.en`；動態 key 只准白名單 prefix（`DYNAMIC_PREFIXES`）；en 冇冇用嘅 key；en 值冇中文（白名單 `common.yueTitle` / `common.noteLabel`）；唔係 `…Html` 嘅 en 值冇 tag / entity（S-017）；`js/`、`index.html`、`sw.js` 冇中文（`data/`、`locales/` 除外）。Browser：預設 `en` + `<html lang>`、每個 `data-i18n` element 有字、attribute 值啱、`<title>` / description = index.html 原文、interpolation、單複數（`1 question` / `408 questions`，Submit modal `1 question unanswered`）、缺 key 返 key + warn、`setLang` 寫 `lifeuk.uiLang` + `<html lang>` + 重填 markup + re-render Study、缺 key fallback en + warn、冇 locale 嘅語言唔理、存咗冇 locale 嘅語言 reload 當 en、存咗 `constructor` / `__proto__` reload 當 en 而冇 warning、`setLang('toString')` 唔理（W-006）；答案框 `Q)` / `A)` 由 locale 讀（S-015）；Study 計數 `1 / 1 fact` / `1 / 12 facts`（S-016）。v0.65：`CJK_WHITELIST` 加 `app.langSwitch`；`zhHkChecks()`（`loadLocales()` 按 index.html 次序載 en + zh-HK）：key 雙向 parity、每個 plural form `{param}` 一致、`…Html` tag 序列一致、非 Html 冇 markup、`SAME_AS_EN_KEYS` 照抄 en、pill `中` / `EN`；plural runtime check 改用 `modal.submitUnanswered`（`common.questions` M6 刪咗） |
| `lang-switch-test.js` | v0.65（T-007）：pill 顯示目標語言（`中` / `EN`）、`aria-label` / `title`、44px hit area（四邊 `elementFromPoint`，S-044）；撳 pill → `<html lang>`、`lifeuk.uiLang`、reload 保持；Home / Quiz（Practice reveal + Similar、side session ↩、Exam 中途 + flag）/ Result（filter）/ Flagged / Study（tab / chip / 搜尋）每個畫面 en → zh-HK → en，`snapState` 比對 `state`、timer、`sessionReturn`、review、`study`、搜尋框、成個 localStorage（除 `uiLang`）不變、冇 `[i18n] missing key`、成績唔重複記錄；exam timer 即刻換字而唔 call `examTick`；confirm modal 開住（focus pill + Enter）唔切換；`<title>` 保持英文；M2 國家 chip 冇拉丁字母；M6 `📝 全部試題（408 題）` ↔ `📝 All Questions (408)`（v0.71 前 🎯）；W-014 `checkContentLang`（`closest('[lang]')`，唔准落到 `<html>`）；M4 `.result-sub` 320px 唔跌單字（要有 CJK 字體，S-045）；320px 冇橫向 overflow；pill dblclick 唔被 double tap guard 食（wait 由 `SCREEN_CHANGE_CLICK_GUARD_MS` 計，S-043） |
| `practicedots-test.js` | v0.55：Practice 圓圈（24 / 9 / review 題數、冇 progress bar 同計時、啱綠錯紅、flag 橙邊、計數一行、撳跳題前後都得）；冇 score pill；Exam 最後一題快捷 ✓ 交卷（有未答彈 modal、全答直接去結果）；Flagged 列表「Practise flagged」書籤 icon 係橙色；首頁 Flagged 格 icon 橙色、Home 冇可見嘅黑色 SVG（v0.56）；CUI-0012：320px 圓點喺卡 content box 入面、冇橫向 scroll、正圓、號碼喺 border 入面（390px 同樣檢查） |

## 版本記錄（v0.32–v1.0.0）

| 版本 | PR | 改動 |
|---|---|---|
| v0.32 | dcwhung/life-in-uk-test#1 | Practice 同一 session 內將未掌握題重新排去 queue 尾（**v0.38 已取消**） |
| v0.33 | dcwhung/life-in-uk-test#2 | 結果頁 PASSED / remark 只喺 Exam 1–17 顯示 |
| v0.34 | dcwhung/life-in-uk-test#3 | Practice 每輪最多抽 25 條未掌握題 |
| v0.35 | dcwhung/life-in-uk-test#4 | **Similar Questions**：答完顯示同一 fact 嘅其他題目 + Core Fact + 「Practise these N」臨時 session；加 `mockups/similar-question-map.html`、`tests/similar-test.js` |
| v0.36–v0.37 | dcwhung/life-in-uk-test#5 | 臨時 session 返回掣改做「↩ Back」；Prev / Next 搬上 Similar Questions 前面；Practice 結果頁重做掣改做「Practise Again」（Exam mode 仍係「Retry Exam」） |
| — | dcwhung/life-in-uk-test#6 | `oy-test` 唔再隨機 fail（搬有選項翻譯嘅題目去最前；年份題檢查改為搵出嚟先驗） |
| v0.38 | dcwhung/life-in-uk-test#7 | 取消 v0.32 嘅 in-session re-queue：每題一輪只出一次，「Question X of Y」嘅 Y 固定；未掌握題下一輪再出 |
| — | dcwhung/life-in-uk-test#8 | HANDOFF.md：開發流程改為 PR、Similar Questions 設計決定、v0.32–v0.38 版本記錄 |
| v0.39 | dcwhung/life-in-uk-test#9 | 難度掣拎走中文；結果頁 Review Answers 加「Original order / Wrong first」；Review Answers 上面加多一組 Practise Again / Choose Another |
| v0.40 | dcwhung/life-in-uk-test#10 | 答完之後問題卡右上（Translate 位置）顯示快捷 Prev / Next；HANDOFF 補 PR #8 / #9 |
| — | dcwhung/life-in-uk-test#11 | HANDOFF.md：PR #10 版本記錄、快捷 Prev / Next 設計決定 |
| v0.41 | dcwhung/life-in-uk-test#12 | 問題卡同 progress 合併：bar 變卡頂邊、題號行「Question X of Y ★ ✓ n/m」、快捷掣只有符號；拎走 header 嘅 correct / done |
| — | dcwhung/life-in-uk-test#13 | HANDOFF.md：PR #11 / #12 版本記錄、開發流程備註 |
| v0.42 | dcwhung/life-in-uk-test#14 | 修正 Practice › By Exam 進度條爆出圓角格仔：`.exam-btn:not(.done)` 加 `overflow: hidden`（`.done` 嘅 ✓ badge 只喺 Exam mode，要凸出所以唔 clip） |
| — | dcwhung/life-in-uk-test#15 | HANDOFF.md：PR #14 版本記錄、mastery bar 備註 |
| v0.43 | dcwhung/life-in-uk-test#16 | Exam mode 改做真考試流程：揀選項即暫存、Next / Prev 返去可以改答案、全程唔對答案；最後一題 Next 變「Submit」，有未答題先 confirm，撳咗去結果頁 |
| v0.44 | dcwhung/life-in-uk-test#17 | Exam 1–17 考試工具：45 分鐘倒數（到 0 自動交卷）、書籤 flag、24 個數字圓點（狀態 + 跳題）、Answered / Unanswered / Flagged 計數；考試中返 Home 先問（先做 preview 確認） |
| v0.45 | dcwhung/life-in-uk-test#18 | Exam mode All Exams 改做「🎲 Random Exam (24 Q)」：由 408 題隨機抽 24 題、唔會有相類似題（同一 fact 最多一題），用齊考試工具同 PASSED 判定；Practice 嘅 All Exams 唔變 |
| — | dcwhung/life-in-uk-test#19 | HANDOFF.md：PR #18 版本記錄 |
| v0.46 | dcwhung/life-in-uk-test#19 | Random Exam 掣文字改做「🎲 Random Exam」＋細字「24 Qs from 408 Qs」 |
| v0.47 | dcwhung/life-in-uk-test#20 | Exam mode 問題卡頭嘅快捷 ← → 一直顯示（之前答完去下一條未答題會唔見咗） |
| v0.48 | dcwhung/life-in-uk-test#20 | Exam 嘅 Submit / 離開提示改用 app 內 modal（唔再彈瀏覽器 alert box） |
| v0.49 | dcwhung/life-in-uk-test#20 | Exam 結果頁掣文字：「Retry Exam」→「Retry」、「Choose Another」→「Another Exam」 |
| v0.50 | dcwhung/life-in-uk-test#20 | Exam 結果頁：mode icon、分數只顯示一次（唔合格紅色）、24 粒結果圓點（撳跳題）、All / Wrong / Flagged filter、書籤 icon；Review 翻譯同備注分行排版；Practice 掣改「Retry / Another Practice」 |
| — | dcwhung/life-in-uk-test#21 | HANDOFF.md：PR #20 版本記錄、modal 設計決定、follow-up |
| v0.51 | dcwhung/life-in-uk-test#22 | 結果判定前面加返 icon：「🎉 PASSED」/「📚 NEEDS IMPROVEMENT」；結果頁「By Difficulty · 按難度」拎走中文；Review Answers 加大行距同間隔 |
| v0.52 | dcwhung/life-in-uk-test#22 | Practice 每輪題數由 25 改做 24（`PRACTICE_ROUND_MAX`），同真考試一致 |
| v0.53 | dcwhung/life-in-uk-test#24 | Practice：flag 長期保存、錯題庫（兩個 mode 都計）、My Review（Wrong answers / Flagged 兩格，冇記錄唔出）、Flagged 列表畫面、review 每輪最多 24 題 + round note、Practice 結果頁跟 Exam 排版；Difficulty 拎走「Hard & Expert」一行 |
| v0.54 | dcwhung/life-in-uk-test#25 | 首頁「Reset progress」一併清錯題記錄（`wrongList`）同 Practice flag（`practiceFlags`），confirm 文字改做「掌握進度、錯題同 flag 會全部清除。」 |
| — | dcwhung/life-in-uk-test#26 | HANDOFF.md：PR #24 / #25 版本記錄、commit 列表、截圖還原注意事項 |
| v0.55 | dcwhung/life-in-uk-test#27 | Practice 加數字圓圈（取代 progress bar，啱綠錯紅、flag 橙邊、撳跳題、Correct / Wrong / Unanswered / Flagged 計數），拎走 ✓ n/m pill；Exam 最後一題快捷掣變 ✓ 做 Submit；Flagged 列表「Practise flagged」書籤 icon 由黑色改橙色 |
| v0.56 | dcwhung/life-in-uk-test#28 | 首頁 My Review「Flagged」格嘅書籤 icon 由黑色改返橙色：`bookmarkSvg('rv-flag-tile')` 嘅 class 冇 CSS，SVG path 冇 fill 就係黑色；改為 `.rv-flag-tile path` 同 `.rv-flag` 共用橙色（v0.55 只修咗「Practise flagged」掣，今次由 class 根本修好，兩處一齊生效） |
| v0.57 | （P1 refactor PR） | **拆檔 + clean code，外觀同行為 0 改動（除 SW）**：`index.html` 2350 行拆做 `css/{base,components,screens}` 同 `js/{core,domain,components,screens,pwa}` + `main.js`；inline onclick 全部改 `data-action` delegation；重複 code 合併（`isCorrectAnswer`、`toQuestionItem`、pool 由 `allQuestions()` 派生、圓點 + 計數 builder、streak label、diff / chapter 格、Study 書籤 / 掌握 toggle）；每個 function ≤ 30 行；408 / 17 / 24 / 75% 等數字由 data / config 計；題目、選項、備注插入 HTML 前 escape；拎走死碼（`.score-pill`、`alert('Please select a mode first…')`、被蓋過嘅 CSS）；**SW 修正**：改用 root `sw.js`（之前 blob: SW 一直註冊失敗）；加 `sw-test`、`structure-test`。驗證：`tests/tools/visual-diff.js dc73a15`（38 個畫面狀態 × 390 / 900px，逐個 element 對 computed style + 位置 + 文字）同 v0.56 一樣，只多咗 ⓘ popover 標題入面一個 inline `<span id="infoTitle">`（冇視覺分別）；review 後再加：SW 只清 `lifeuk-v*` cache、install 用 `cache: 'reload'`、`updateViaCache: 'none'`、離線 fallback 只限 navigation、`data-*` 值 escape、`MAX_DIFFICULTY` 由 `DIFF_LEVELS` 計 |
| v0.58 | （localStorage prefix PR） | **localStorage key 加 `lifeuk.` prefix**（origin 同其他 app 共用）：`LS_PREFIX` + 全部 key 常數由佢砌；`js/core/utils.js` 嘅 `getLS` / `setLS` 第一次用 storage 時 lazy 將舊 key 搬過去（CUI-0004：SW 換版時 v0.57 `index.html` + v0.58 js 嘅混合頁面都會搬，所以冇獨立 `migrate.js`；原始字串照抄、確認先刪、`reviewOrder` 刪走、唔掂其他 app 嘅 key、出錯唔刪資料；抄唔到嘅 key 今次載入繼續用舊名（`LS_KEY_FALLBACK`）；全部搬完寫 `lifeuk.migrated` marker；冇 marker 而新舊都有 → object map 逐條 merge、prefs 新嘅贏；有 marker → 新 key 優先）；加 `migrate-test`、`upgrade-test`，舊測試改用新 key 名；v0.58 之後唔好 rollback 去 v0.57（CUI-0005）。原定 v0.58 嘅 P2（locale）順延做 v0.59 |
| v0.59 | PR #31（P2） | 四部分：**① i18n + 字眼統一（Lane A）**：`js/core/i18n.js`（`t()`、plural、fallback、`getLang` / `setLang` → `lifeuk.uiLang`、`data-i18n`）+ `locales/en.js`（全部 UI 文字；data enum 只留 key，標籤喺 `data.*`；ERAS 只留英文名）；未有語言切換掣；字眼跟 glossary（`408 questions`、`24 questions from 408`、`1 question unanswered`、`E9·Q15`、`🏆 Mastered` 全 app、`🔥 0/3`、`N flagged`、`wrong answers`、單空格分隔符、`Practice By`、結果 review 都用 `【廣東話翻譯】`、Study 介面英文）；首頁兩個 Reset 改用 app 內 modal（Keep / Reset）；`#studySubChips` 改用 `hidden`（S-004）；拎走隱藏咗嘅 `#rbCorrect` / `#rbWrong` / `#rbPct` 同 CSS；`main.js` 喺舊 shell（冇 locale tag）自己載入 i18n 再開；加 `i18n-test`，受字眼影響嘅 assertion 跟住改。**② Design tokens（Lane B）**：顏色、shadow / overlay、radius、font-size scale 搬入 `css/base/tokens.css`（0 視覺改動，見「Design tokens」）；`structure-test` fail `tokens.css` 以外嘅 hex / `rgb(a)(`；`visual-diff` 略過 `--*` custom property。**③ PWA / Study prefs 修正（Lane C）**：CUI-0001 favicon 404 → 加 app icon（`icons/icon.svg` navy + 白「UK」，PNG 由 `tests/tools/make-icons.js` 生成；`<head>` 加 SVG favicon、192 PNG fallback、180 `apple-touch-icon`）；CUI-0002 加 `manifest.webmanifest`（standalone、`./` scope、navy 色、192 / 512 / 512 maskable icon），Chrome 裝得、install banner 唔再係死碼，manifest 同 icon 全部入 `SHELL`；CUI-0003 `studyLoad()` 驗證 `lifeuk.studyPrefs`（tab / chapter / nation / group / 類型），壞值用預設，Study 唔會再一片空白；S-003 SW fetch 只查自己個 cache（`fromOwnCache`），唔會用同 origin 其他 app cache 咗嘅 response；新 `studyprefs-test`、`pwa-test`，`sw-test` 加 S-003 assertion，`sw-test` / `upgrade-test` 改用 `appFiles()` 抄 app。**④ Merge 修正 `6002650`**：Lane A + C 合併後 study prefs 驗證改用 v0.59 嘅 key array。Review 跟進（P2 batch review）：W-006 `hasLocale()`、W-007 HANDOFF、S-014 舊 shell i18n 載入失敗 reload 一次再顯示 fallback、S-015 `quiz.yueQ` / `quiz.yueA`、S-016 `study.count` plural、S-017 en 值 markup 檢查、S-018 token 註記、S-019 manifest 跟 locale |
| v0.60 | 修正批次（P2 跟進，2 條 lane 並行） | **① Install banner**：PC 唔出（`beforeinstallprompt` 照 `preventDefault`，但只有 `matchMedia(INSTALL_TOUCH_QUERY)` = `(pointer: coarse)` 先顯示）；加 ✕（`data-action="dismissInstall"`），撳咗寫 `lifeuk.installDismissed`（`INSTALL_DISMISSED_LS`），之後唔再出。**② S-018 token 合併**：`--text-inverse-75/70/65/60/55/45` → `strong` 0.75 / `muted` 0.6 / `faint` 0.45，55 歸 `muted`（W-008 對比度）（輕微視覺改動，用戶確認）。**③ CUI-0007**：`similar.practise` 改 plural：1 題「▶ Practise this one」。**④ Modal focus**：`showConfirm({ focusCancel })`，兩個 Reset 同 Leave 預設 focus Keep / Stay，Submit 照舊 focus Submit |
| v0.61 | P3 PR-1（PWA lane） | **CUI-0008 / S-020**：`promptInstall()` 一開頭接手 `deferredPrompt`（await 前清走），`Promise.all([prompt(), userChoice])` 包 try / catch，任何 outcome 都收 banner（`hideInstallBanner()`）；取消唔寫 `lifeuk.installDismissed`，下次 event 再出；加 `appinstalled` listener 收 banner；連撳兩下只會 `prompt()` 一次。**S-022**：`.install-close` 外觀仍然 28px，`::before inset: -8px` 令可撳範圍約 44px（banner gap 14px，唔會蓋住 Install 掣） |
| v0.62 | P3 PR-2（Lane V ∥ C2） | **① Study 視覺統一（Lane V，T-101…T-107，用戶 Q2-a）**：選中 tab / chapter chip 改 `--navy`，搜尋 focus `--navy-light`；裝飾色（fact 左邊框、year tag、timeline 年份 / 圓點、Geography sub-title、Home `.ch-num`）用新 token `--study-accent*`（= navy 系），紫色只留廣東話；fact 難度改 `starsHtml`，刪 `.tag.diff`；Study 書籤改 Practice 橙色 SVG（資料照存 `lifeuk.studyBookmarks`），chip「Bookmarked only」用 SVG（off 時空心）；fact 掣加 `aria-label` / `aria-pressed`、32px + 44px hit area；`--radius-xs` 6px；Similar Core Fact 形狀跟 Study 卡（4px 邊、`--radius-md`）；刪 `--year-bg`、`--star-on`。**② Fact session 引擎（Lane C2，T-151…T-155）**：新 `js/screens/sideSession.js`，`similarReturn` 一般化做 `sessionReturn`；`startSideSession` 一次過重建 `state`、強制 `PRACTICE_MODE`；`startFactPractice(id)`（`FACT_PREFIX` `f21` → `Fact #21`），↩ Back 返 Study 還原 tab / filter / scroll；今版未有入口掣（PR-3）；`main.js` `LATE_BOOT_SCRIPTS` 喺舊 shell 補載 locale / i18n / sideSession；新 `factsession-test`。**③ Review 跟進**：S-027 `appinstalled` 清 `deferredPrompt`；S-026 `pwa-test` 加 prompt reject 測試；v0.62 batch review：W-009 fact 掣相鄰 hit ring 收到 gap 一半（撳書籤右邊唔會再切換 Mastered）、W-010 `LATE_BOOT_SCRIPTS` 用 `ready()` 判斷（新 shell i18n 載入失敗都有 S-014 fallback）、S-028 glossary |
| v0.63 | P3 PR-3（Lane C） | **① Fact 卡 component（T-201…T-203）**：新 `js/components/factCard.js`（`factCardHtml(f, { variant: 'full' \| 'core' })`，唔讀 `study` global）+ `css/components/fact.css`（`.fact*` / `.sqm-fact*` 規則全部搬入）；Study 用 full，Similar 用 core（金色）；卡加 `#id`、`--shadow-sm`；`main.js` `LATE_BOOT_SCRIPTS` 加 factCard、新 `LATE_BOOT_STYLES` 喺舊 shell 補 `fact.css`。**② Mastery 打通（T-204…T-205）**：`factMastery(f)`；已掌握 = 手動剔 或 來源題全 🏆；推算 🏆 掣 `aria-disabled`、唔可撳、卡半透明；Study 頂部 `🏆 n / 236 mastered`；Reset 唔清 Study（用戶決定）。**③ Fact → 題目（T-206…T-208）**：來源 node 列（`similarNodeHtml` 共用，只顯示）取代「Appears ×n」；「▶ Practise this one / these N」掣（`startFactPractice` action）；↩ Back 返 Study 後卡金色閃 `FACT_HIGHLIGHT_MS`（1.5s），睇唔到就 `scrollIntoView`。**④ Tickets**：CUI-0010 連續開 fact session 保留 Study 返回點；CUI-0009 fact 掣真正 44px 可撳範圍（兩掣唔重疊）；新 `factmastery-test` |
| v0.64 | P3 跟進修正（3 條 lane 並行） | **① CUI-0011**：`js/core/actions.js` 連撳兩下保護：一下 mouse / touch click 換咗 view（active `.screen` + `state.questions`）之後，同一 view、40px 內（`DOUBLE_TAP_SLOP_PX`）、350ms 內（`SCREEN_CHANGE_CLICK_GUARD_MS`）嘅第二下會被忽略；鍵盤、`el.click()`、confirm modal、同一畫面內 Next / ← → 唔受影響；新 `doubletap-test`。**② S-034**：`css/base/layout.css` `button, input, select, textarea { font-family: inherit; }`（只繼承 family，唔用 `font` shorthand，避免冇設字號嘅掣走樣）；大部分單行掣高 +1–2px（用戶睇截圖確認接受），所有 hit area 不變。**③ S-031**：question node helper 由 `screens/similarPanel.js` 搬去 `components/tags.js`（`questionNodeHtml` / `Text` / `Class`），`structure-test` 守衛 `components/*` 唔可以用 `screens/*` 嘅名。**④ Review 跟進**：W-012 `.fact-practise` 左右 padding 12 → 10px，390px 13 張 2 來源 fact 卡來源列返一行（`factsession-test`）；S-035 guard 用兩下 tap 嘅 `event.timeStamp` 比較、`0 ≤ dt < 350ms`，負數 fail open；S-036 global 改名 `clickGuard` / `clickGuardView` / `isSameClickView`；S-038 `doubletap-test` 加 Similar「Practise these N」dblclick、`finishExam()` 換 view 後 guard 失效、負數 dt 三個情境，輸出 `DOUBLETAP PASS`；S-040 HANDOFF 標題 v0.64。**⑤ CUI-0012**（v0.64 QA）：`dots.css` 圓點 grid `repeat(12, minmax(0, 1fr))` + ≤ 360px gap 4px / 號碼 9px，320–360px 結果頁 / Exam 圓點唔再凸出張卡、320px 冇橫向 scroll；390 / 900 不變 |
| v0.65 | dcwhung/life-in-uk-test#39 | **zh-HK UI locale + 語言切換掣（Track 1，plan `2026-10-07_plan_zh-hk-locale.md`，T-001…T-012）**：**①** 新 `locales/zh-HK.js`（書面語，key 同 en 一樣；`SAME_AS_EN_KEYS` 令 `<title>` / meta / manifest 保持英文；帶號碼標籤 `Exam {n}` / `Chapter {n}` / `Ch {n}` / `Exam 9 · Q15` 同章節名保留英文；tab 中文；國家 chip 只寫中文（M2）、時代 / 國家標題「中文（English）」）；**②** header pill `#langBtn`（`.lang-btn`，顯示目標語言 `中` / `EN`，`toggleLang`，confirm modal 開住唔切換，`::before` hit area ≥ 44px），`config.js` `ZH_HK_LANG`，切換即時 re-render 當前畫面並保留狀態，exam 倒數即刻換字（`refreshExamTimer()`，唔 call `examTick`）；**③** `body` font stack 加系統 CJK 字體（PingFang HK / Noto Sans HK / Noto Sans CJK HK / Microsoft JhengHei，冇 web font）；M4 ≤ 360px `.result-sub` 細一級（en 一樣）；**④** `sw.js` SHELL + `index.html`（en.js 之後）加 `locales/zh-HK.js`，唔入 `LATE_BOOT_SCRIPTS`；`APP_VERSION` 0.65；**⑤** M6：Practice 全部題目組改名 `🎯 All Questions (408)` / `🎯 全部試題（408 題）`（`home.allExams` param `{count}` → `{n}`、`quiz.allShuffled`、`common.allExams`），刪 `common.questions`；**⑥** Review（Round 1 84 → Round 2 93 / 100）：W-013 冇 zh-HK locale 收埋 pill（`syncLangPill()`）、W-014 英文題目 / 選項 / 答案 / fact `lang="en"`、廣東話 `lang="zh-HK"`、S-042 M4 註解寫明 en 都縮、S-043 / S-044 測試收緊；**⑦** 測試：新 `lang-switch-test`（30 套）、`i18n-test` zh-HK parity、`upgrade-test` ⑥ 舊 shell + stored zh-HK、⑦ 缺 `zh-HK.js`；QA 264 / 265（唯一 fail = v0.64 已存在嘅 CUI-0013）；**⑧** 刪 `mockups/lang-switch.html`（確認咗嘅 mockup，T-012）。未處理：CUI-0013、CUI-0014、S-041、S-045、S-046（見「已知限制 / 未做」） |
| v0.66 | dcwhung/life-in-uk-test#40 | **data 廣東話口語化（Track 2，plan `2026-10-07_plan_zh-hk-locale.md`，T-101…T-109）**：**①** `data/exams.js`：`yue` 331 題（batch 1–5 322 + batch 7 R2 防洩露 16 + S-055 R3 1；batch 7 有 8 題係 batch 1–5 已經改過嘅，所以淨數 331 唔係 339）、`note` 140 題、`oy` 71 題（102 個選項）；`data/study.js` fact `yue` 140 條（batch 6）；English / 結構 0 改動（content guard；review 同 QA 由 v0.65 data 重放批准咗嘅批次 JSON，結果同 data 一致）；**②** 規則：語感規則 1–15、統一譯名表、R1 手冊先現況後（Senedd / 歐洲委員會 / 英聯邦）、R2 題目翻譯唔洩露答案（W-015，batch 7；A6 / A9 / A10 用戶例外）、R3 同一條 English 題目同一個 `yue`（S-055），見「廣東話翻譯（yue）規則（v0.66）」；**③** 測試：新 `content-guard-test`（31 套）+ `tests/fixtures/content-baseline.json` + `tests/tools/make-content-baseline.js`，R3 check（`04883d0`）；T-102 `similar-test` / `study-test` 改由 data 讀 `yue`；**④** `APP_VERSION` 0.66（SW cache `lifeuk-v0.66`；batch 7 / S-055 冇再升）；**⑤** Review round 1 91 → round 2 94 / 100；QA（@ `066da69`，batch 7 之前）31 / 31、QA script 1671 / 1671，開 CUI-0015；**W-015 QA 重跑已驗證**（@ `f91abe4`，`.proj-docs/qa/2026-10-07_qa_v066-w015-rerun.md`：S-056 反轉 assert，`QA_ONLY=w015,practiceSample` 1601 / 1601、run-all 31 / 31，掃描 48 → 34、新增 0，CUI-0015 completed）。未處理：S-051…S-054（見「已知限制 / 未做」）；CUI-0013 / CUI-0014 喺 v0.67 修 |
| v0.67 | dcwhung/life-in-uk-test#42 | **CUI-0013 + CUI-0014（parallel dispatch，Lane A / B）**：**①** CUI-0013：`css/screens/quiz.css` `.q-num .q-num-text` `white-space: normal` + `min-width: 0`，≤ 375px 多選題「(select 2)」/「（選擇 2 項）」換第二行，`#quickPrev` / `#quickNext` 唔再被 `.q-card` 截走（320px 由 +61px 變 0）；單選題唔換行；`quicknav-test` +16 assert（en / zh-HK × 320 / 360 × exam / practice）；**Round 2（用戶決定）**：英文原題已經寫明揀幾多個（15 / 15 多選題有 two / three），所以拎走 `quiz.selectN`「(select N)」/「（選擇 N 項）」提示（`quiz.js`、兩個 locale），題號行永遠一行；`content-guard-test` 加 `COUNT_WORDS` guard（多選題 `q.q` 一定要有數量字），`quicknav-test` assert 冇提示 + 320 / 360px 一行；**②** CUI-0014（W-014 收尾，S-047 / S-048 / S-049）：Result `.rv-your` 用戶答案包 `<span lang="en">`（`yourAnswerHtml`，先 escape 後插 span）；`#ansNote` + Result `.rv-note` `lang="zh-HK"`；冇 `oy` 嘅答案 fallback 包 `lang="en"`（`quiz.js` `answerYueHtml`）；`.study-group-title`、Home `.ch-name`、`.tag.person`、`.tag.year` / `.tl-year`（`yearLangAttr`：`yl` 或 AD 先標）`lang="en"`；`lang-switch-test` +34 assert；**③** `APP_VERSION` 0.67（SW cache `lifeuk-v0.67`）；**④** Batch review 98 / 100 → Round 2 96 / 100（`.proj-docs/reviews/2026-10-07_review_v067-cui13-14_batch.md`，新 S-057…S-063）；Batch QA pass（Round 2 probe 58 / 58；`.proj-docs/qa/2026-10-07_qa_v067-cui13-14_batch.md`，31 / 31，全庫 sweep 0px），CUI-0013 / CUI-0014 completed；**⑤** 同一 session：S-056 + W-015 QA 重跑，CUI-0015 completed |
| v0.68 | dcwhung/life-in-uk-test#43 | **S items 全清 + CUI-0016 + 知識點章內編號 + Home UI 文字 / hover**：**①** CUI-0016：錯題 / Flagged review 全部清晒之後 Result 收埋「重做」（`renderResultActions` `canRetry`），`startExam` 空 pool 直接 `leaveToHome`（之前開 0 題 session，render 拋 TypeError，畫面停喺上一輪最後一題）；**②** 知識點編號：Study 每章由 #1 開始（`chapterFactNumber`，喺 `js/domain/similar.js`，舊 shell 已有 script tag；內部 fact id / 書籤 / mastery 不變）；Chapters 顯示 `#n`；時間線 / 地理 / 人物 pill「📜 Ch 3 #1」（拎走獨立 #id）；Core Fact「Ch 5 #38」；知識點練習 header「Fact / 知識點 Ch 3 #15」（`common.factSet`、`setExamLabel` 用 DOM 砌 `lang="en"` span）；編號唔轉大楷（`.sqm-fact-label` / `.quiz-label` `[lang="en"] { text-transform: none }`）；分組標題拎走總數；**③** Home UI：錯題說明移入錯題 tile（「來自練習及模擬考試，於此答對後便會清除。每輪最多 {max} 題。」），0 題時只淡化 tile 其他部分（W-022）；副標題只顯示「尚餘 {n} 題」；已標記 tile 有題時冇副標題；Exam 說明刪「請於下方選擇試卷」；Practice 說明 4 點列點；離開 modal「取消 / Cancel」；Exam 模式已完成掣 hover 綠底白字；Practice 模式 Exam 掣 hover 進度字金色（方案 A，mockup `c6d98e2`）；**④** 內容 S-054（batch 8，用戶批准 4 條）；guard S-051（`_noteNonEmpty` 單向）/ S-061（yue 數量字）；`tests/tools/check-batch-replay.js`（S-053，代替 S-052）；S-037 / S-074 structure-test scanner；S-041 / S-045 / S-046 / S-057…S-060 / S-062 / S-063 / S-064…S-069 / S-070…S-073 / S-077 / S-080 / S-082…S-084；W-017 `sw-test` race（`utimesSync` mtime +2s，http.server `If-Modified-Since` 只精確到秒）；QA script v063 / v065 / v066 oracle 更新（S-039、W-018）；**⑤** `APP_VERSION` 0.68；Review 5 批（`.proj-docs/reviews/2026-10-07_review_v068-batch{1..5}*.md`，全部 pass，0 Critical）；Batch QA pass（`.proj-docs/qa/2026-10-08_qa_v068_batch.md`：v068 293 / 0、run-all 31 / 31、v063 186 / 0、v065 275 / 0、v066 1870 / 0、batch replay 0 mismatch），CUI-0016 completed |
| — | dcwhung/life-in-uk-test#44 | **測試 only**：S-085 `layerCode` regex scanner 修三個漏報位（`${` 之後嘅 regex：`template()` 留 `(` 標記；後置 `++` / `--` 同 `.of` / `.in` 之後係除號）；S-088 keyword 要係完整名（`$in`、`o. of` 唔當 keyword）；S-089 binary `-` 之後 regex 嘅 sample（layering samples 19 → 29）；S-086 `factsession-test` S-077 case 唔再喺 `finishExam()` 之後重複 `renderResults()` / `showScreen()`；帶入 v0.68 HANDOFF PR link + session log。Review 98 pass（`.proj-docs/reviews/2026-10-08_review_s085-s086.md`）；QA pass（`.proj-docs/qa/2026-10-08_qa_s085-s089.md`：run-all 31 / 31、v063 186 / 0、v065 275 / 0、v066 1870 / 0、v068 293 / 0）|
| — | dcwhung/life-in-uk-test#45 | **測試 only**：`structure-test` `REGEX_AFTER` keyword lookbehind 改做 `(?<![$#\p{ID_Continue}\u200C\u200D]\|\.\s*)` + `u` flag —— S-090 `this.#of`、`éin`；S-091 任何 identifier 字元（combining mark、非 ASCII 數字、ZWJ）；S-092 明確列 ZWNJ / ZWJ（Unicode 15.1 先入 `\p{ID_Continue}`，舊 Node 唔會假紅），`\u{…}` escape 名記做已知限制。Layering samples 29 → 34。Review 99 pass（`.proj-docs/reviews/2026-10-08_review_s090.md`）；QA pass（`.proj-docs/qa/2026-10-08_qa_s090-s091.md`：run-all 31 / 31、v063 186 / 0、v065 276 / 0、v066 1870 / 0、v068 293 / 0；25 個實檔 `layerCode` 輸出新舊一樣）。S-092 喺 QA 之後先做，由 final review 覆核（`.proj-docs/reviews/2026-10-08_review_s091-s092-final.md`，93 pass，run-all 31 / 31；S-093）|
| v0.69 | dcwhung/life-in-uk-test#46 | **鍵盤 / modal**：S-025 確認 modal focus trap（Tab / Shift+Tab 只喺兩粒掣之間）+ 關閉後 focus 返 opener（S-095 第二個 prompt 保留第一個 opener）；W-024 時間到會先關開住嘅 Submit / Leave modal（唔再蓋住結果頁或者重複交卷）；S-098 `showScreen` blur 留喺被收埋 screen 嘅 focus（之前時間到之後一下 Enter 由結果頁返 Home）；S-103 喺 Submit 長按 Enter 唔會經 prompt 交卷；S-102 結果頁 filter chip 揀完 focus 留喺 chip；S-023 `structure-test` 檢查每個 `var(--x)` 有定義；S-094 / S-099 / S-101 test；S-033 / S-105 註解；HANDOFF W-023 / S-093 / S-032 / S-096。Review v069 97 + delta 99 / 98；QA `.proj-docs/qa/2026-10-08_qa_v069.md` pass（keyboard 632 / 0、upgrade 20 / 0） |
| v0.70 | dcwhung/life-in-uk-test#46 | **Study / Home UI（用戶截圖 + preview 確認）**：Timeline 年份 `text-box: trim-both cap alphabetic`，圓點喺文字正中、6px 空位（`@supports not` fallback 維持 v0.69 位置）；fact 卡星星自己一行；來源列 node 一分行「▶ Practise / 練習這 N 題」就自己一行全闊（純 flexbox，刪 `FACT_SRC_INLINE_MAX` / `.wrap-btn`）；錯題 tile 冇「N to clear / 尚餘 N 題」，0 題只顯示「Nothing to review yet / 暫時未有需要複習的題目」（`home.wrongToClear` 已刪）；Practice 答案框備注改用同結果頁一樣嘅逐行 render（`noteHtml` 搬去 `js/components/tags.js`，新 `css/components/note.css`，`.note-mark` 固定闊度 → 換行懸掛縮排）；B1：Crown dependency 記憶法（7 題共用）同 14.3 一項一行（batch 9）；S-104 / S-106 test。Review `.proj-docs/reviews/2026-10-08_review_v070.md` 98 + delta 99；QA `.proj-docs/qa/2026-10-08_qa_v070.md` pass（run-all 31 / 31、v066 1870 / 0、note 縮排 4125 行 0 錯、upgrade 20 / 0） |
| v0.71 | dcwhung/life-in-uk-test#47 | **記憶法 + icon**：B2 四組新記憶法（Magna Carta 8、國王 vs 國會 8、二戰 9、都鐸王朝 9，batch 10；W-025 譯名統一 + Henry VIII 子項，batch 11；CUI-0017 保留「阿拉貢的凱瑟琳」，batch 12）；B3 Study fact 卡收埋式「💡 記憶法」（`factMemoryText` 由來源題目 note 讀，60 張卡，方案 B）；練習 / 考試 icon 對調（練習 📝、考試 🎯：首頁模式卡、結果頁、Practice「All Questions」格）；B4 中途續做、M5 諾曼征服題組：用戶決定唔做。Review `.proj-docs/reviews/2026-10-08_review_v071.md`（95 warn → W-025 已修）；QA `.proj-docs/qa/2026-10-08_qa_v071.md` + `..._v071-delta.md` pass（v071 5906 / 0、upgrade 22 / 0、batch replay 12 / 806 / 0） |
| v0.72 | dcwhung/life-in-uk-test#48 | **B5 spacing token（0 視覺改動，用戶揀方案 A）**：`tokens.css` 加 `--space-1`…`--space-12`（2–24px，步數 = px / 2）；184 個 margin / padding / gap 宣告（連 `--*gap` / `--*pad`）改用 token，53 個刻度外數值保留；`structure-test` spacing guard；S-107 HANDOFF S-081 狀態。Review `.proj-docs/reviews/2026-10-08_review_v072.md` 99 pass（visual-diff 76 / 76 一樣、159 行反向核對）；QA `.proj-docs/qa/2026-10-08_qa_v072.md` pass（320 / 360px pixel 92 / 92、fallback 24 / 24、upgrade 22 / 0） |
| v1.0.0 | dcwhung/life-in-uk-test#54 | **Freeze v1.0.0（用戶決定）**：功能同 v0.72 一樣，`APP_VERSION` `0.72` → `1.0.0`（SW cache `lifeuk-v1.0.0`，裝咗嘅 app 會自動換新 cache）；版本規則改 SemVer（見頂部「版本」）；git tag `v1.0.0`；`tests/tools/visual-diff.js` 版本 mask 改 `v\d+(?:\.\d+)+`（三段版本號都 mask 晒）；同日 HANDOFF iPhone 實機 check close（PR #50，用戶確認冇問題） |
| v1.0.2 | dcwhung/life-in-uk-test#64 | **溫習計劃 UI 修正（用戶截圖 7 點，en + zh-HK）**：**①** 訂立目標「When is your exam?」4 個 preset chip 平分成張卡闊度（`.plan-presets` grid 4 欄），「or exam date」日期另起一行（`.plan-date-row` grid）；**②** 休息日 7 粒 chip 一定一行（`.plan-rest-row` grid 7 欄、chip 冇左右 padding；en 390 / 360px「Sat」唔再換行）；**③** 進度表「三個階段」bar 三段等闊（唔再按日數 flex-grow），階段名第一行、日數第二行（`.plan-ph-name` / `.plan-ph-days`；key `plan.schedule.phaseDays` → `plan.schedule.phaseDaysN` `{n} day(s)` / `{n} 日`）；**④** 溫習次序 bar 固定長度（`--plan-chw-bar-w` 150px，≤ 374px 120px、≤ 339px 96px，用戶揀；每行一樣），同右邊數目之間留 ≥ 12px，數目唔會超出卡；≤ 480px bar 喺左、數目靠右；**⑤** en `orderCount` / `plan.task.practice` / `plan.task.drill` / `plan.strategy.learnPair` / `mockReal`（S-116）題數「questions」→「Qs」（句子入面嘅 questions 保留；zh-HK 不變）；**⑥** 每日任務行只寫「Ch 5」，有章節任務嘅溫習日最尾加一行灰色細字（`.plan-day-chs`，`lang="en"`）列出當日章節全名（唯一、按出現次序，`LIST_SEP` 分隔）；休息 / 輕量 / 只有模擬考試嘅日冇；**⑦** 狀態 pill 移去左欄日期格下面（`.plan-day-side`），行改 2 欄（`--plan-day-side-w` 64px + 任務，S-117 / S-118），任務用晒餘下闊度；pill `--fs-xs`，「Today 0%」/「今日 0%」一行，「Today 100%」/「今日 100%」窄位自動換兩行唔爆；**⑧** `APP_VERSION` 1.0.2；測試：`plan-ui-test` `checkGoalLayout`（360 / 375 / 390 / 400 × en / zh-HK）、`plan-schedule-test` 等闊階段 + 第二行日數、`checkOrderBars`、remarks、pill 喺左欄、`checkScheduleFit`；Review 86 warn → W-036（≤ 340px preset chip 冇 padding + `--fs-xs`，320px「1.5 months」唔截）/ W-037（階段名太長就換行）；測試加 320px；**⑨** 闊過 480px 時溫習次序數目欄固定闊度（`--plan-chw-count-w` 112px），四條 bar 起點對齊（測試加 600px）；Delta review 98 pass（`.proj-docs/reviews/2026-10-09_review_v102.md`）；QA pass（run-all 35 / 35 + 512 項 layout 檢查，320 / 360 / 390 / 600px × en / zh-HK，`.proj-docs/qa/2026-10-09_qa_v102.md`）；未做（用戶決定）：S-119（481–560px 章節名欄窄）、S-120（339 / 340px breakpoint 差 1px） |

**Practice 數字圓圈設計決定（v0.55，preview 同用戶確認）**
- 起因：用戶以為 Practice 「無咗」頂頭數字圓圈；查 code 同 git 記錄，v0.44 起圓圈一直只係 Exam 1–17 / Random Exam 先有，唔係 regression，改做新功能
- 用戶揀「照建議」：圓圈取代 progress bar、答啱綠答錯紅、撳任何一題都跳到、要四項計數、題數唔係 24 都顯示（有幾多題出幾多粒）
- Flag 用橙色**邊**（唔用結果頁嘅外圈），因為外圈已經用嚟標示做緊嗰題（金圈），兩個圈會撞
- 拎走「✓ n/m」pill，避免同計數重複
- 同一輪仲改咗：Exam 最後一題快捷掣變 ✓ 做 Submit（用戶要求同 Practice 一致）；「Practise flagged」書籤 icon SVG 冇設 fill 所以係黑色，改橙色

**Practice My Review 設計決定（v0.53，preview v1–v3 同用戶確認）**
- Review / Flagged 同 Difficulty / Chapter / Exam 唔係同類，所以獨立做「My Review」section，分類 tab 加「Practice by」標題
- 錯題 review UI 唔可以抄參考圖，重新設計成兩格 tile
- 錯題來源：Practice + Exam；清走條件：只喺 Review 入面答啱；中途離開唔續做（暫時）；每輪最多 24 題，題數多過 24 要有 remark
- 冇記錄唔顯示 My Review；flag 提示用 app 內書籤 icon，唔用 emoji
- Round note 放問題卡外面、上面靠右，唔放卡入面
- Flagged 格開列表畫面（可以逐題 unflag），唔係直接開練習
- Difficulty 只留 Easy–Expert 五行，「Hard & Expert」重複（= Hard + Expert）所以拎走

**Exam modal 設計決定（v0.48）**
- 用戶要求交卷提示唔好用瀏覽器 alert box；離開考試提示順手都改用同一個 modal，保持一致
- 掣名：Submit → 「Keep going / Submit」；Leave → 「Stay / Leave」；撳背景或 Esc = 取消
- 預設 focus（v0.60，用戶確認）：Reset ×2 同 Leave 預設 focus 喺 Keep / Stay，Submit 喺 Submit
- ~~首頁兩個 Reset 掣暫時仲用瀏覽器 confirm（如要一致可以之後改用 `showConfirm()`）~~ **v0.59 已取代**：兩個 Reset 而家都用 `showConfirm()`（Keep / Reset）

**Exam 結果頁設計決定（v0.50，preview v1–v6 同用戶確認）**
- flag 用方案 A（橙色圈），保留啱錯顏色；B（成粒橙）睇唔到啱錯
- 數字原本重複三次（大字、三格、圓點計數），改為大字「n / 24 · %」+ 圓點計數
- Review filter 取代 Exam 嘅「Wrong first」排序；Flagged chip 用書籤 icon
- 備注太密 → 逐行分開 + hanging indent

**Random Exam 設計決定（v0.45，同用戶確認）**
- 只改 Exam mode；Practice 嘅 All Exams 保留「由 408 題抽未掌握題」嘅練法
- 用齊 Exam 1–17 嘅考試工具同 18/24 判定，當模擬試
- 掣名「🎲 Random Exam」，細字「24 Qs from 408 Qs」（v0.46 改；v0.45 原本係「🎲 Random Exam (24 Q)」+「from all 408 questions · no similar questions」）

**Exam 流程設計決定（v0.43，同用戶逐步確認）**
- 試過「Submit 之後跳下一題、唔對答案、鎖住」（89e5f7c），用戶要求改成真考試：揀咗即暫存、可以返去改、唔逐題 Submit
- Submit 只喺最後一題，放喺 Next 嘅位置，文字只寫「Submit」；問題卡頭嘅快捷 → 喺最後一題收埋，避免誤撳交卷（v0.55 用戶要求改返：快捷掣變 ✓ 做 Submit，同 Practice 一致；有未答或 flag 仍然先彈 modal，所以誤撳都唔會直接交卷）
- 有未答題先 confirm（Claude 提議，用戶接受）

**考試工具設計決定（v0.44，先做 preview 同用戶確認）**
- 只用喺 Exam 1–17（24 題、同真考試一樣）；All Exams（408 題）45 分鐘唔合理，所以唔加
- 計時器一直顯示（唔可以收埋）；時間到唔彈框，直接去結果頁 + 提示
- Flag icon 用書籤（用戶提供參考圖），唔要圓圈；冇「N flagged ›」跳題掣（試過，用戶唔要），靠圓點撳去
- 圓點分開「已答 + flag」（橙實心）同「未答 + flag」（橙框），一眼分到有冇答
- 計數靠右，用「|」分隔

**問題卡 header 設計決定（v0.41，先做 preview 同用戶確認）**
- 目的：慳位，拎走問題卡上面獨立嘅一行同 progress bar
- 「n/m correct」試過 3 個擺法（星星後 pill／bar 下面／拎走），用戶揀 pill，同時拎走最頂 header 重複嘅「✅ correct · 📝 done」
- Pill 只喺 Practice、答咗至少一題先出；Exam mode 唔顯示（同以前一樣）；v0.55 拎走，因為圓圈下面嘅 Correct / Wrong 已經有同一個數
- 窄 mon（≤ 390px）pill 會換去第二行，用戶接受；← → 掣永遠喺右邊同一行
- 快捷掣只有符號；底部大掣保留文字（Next → / Finish ✓ / See Results → / ↩ Back）

**快捷 Prev / Next 設計決定（v0.40）**
- 只喺答完之後顯示（Practice reveal／Exam submit），未答前個位留返畀 Translate
- 同底部掣共用 `nextAction()`，所以最後一題會跟住變 Finish ✓／See Results →／↩ Back，兩組唔會唔同步
- 底部 Prev / Next 保留；快捷掣係細粒 pill（同 Translate 一樣大小），窄 mon 換行靠右，標題唔會被逼斷行

**結果頁設計決定（v0.39）**
- 「Wrong first」係**排序**唔係篩選：答錯排最前，答啱嘅照樣顯示喺後面；題號保留原本次序，對返做題時嘅位置
- 預設「Original order」；用戶揀過就記住（`reviewOrder`）
- Practise Again / Choose Another 喺 Review Answers 上面同最底各一組，長 review 唔使碌到底

**Similar Questions 設計決定（v0.35，同用戶確認過）**
- UI 文字用英文；題目／fact 嘅廣東話翻譯照顯示
- 答啱答錯都顯示，列出全部類似題，唔收埋、唔分頁
- 類似題**唔顯示答案**，亦冇「撳一下睇答案」
- 標題唔顯示掌握數字（試過「Mastered 1/2」同「Fact mastery 1/3」，都覺得誤導，拎走）
- 冇「提問角度」標籤（例如 Asks: function），因為要每題人手加欄位
- 冇「View in Study」掣：Study 頁冇得返去答題，會冇咗成個練習 session；Core Fact 已經係同一段溫習內容
- 圖例最後一格寫「0/3」唔寫「Not attempted」，因為答錯歸零同未做過分唔到
- Exam mode 唔加

## 已知限制 / 未做

- 難度評級係靜態 rubric，未按個人答題記錄調整
- 冇 dark mode
- 測試依賴 Playwright + Chromium，repo 冇 `package.json`
- 備注嘅 `\n` 係直接寫喺 `exams.js` 字串入面，冇 markdown 解析；縮排靠空格 + `pre-wrap`
- `bookmarkSvg(cls)`（`js/components/icons.js`）輸出嘅 SVG path 冇 fill，新 class 一定要喺 CSS 設顏色（`css/components/buttons.css`），否則會係黑色（v0.55 / v0.56 踩過兩次）
- `#reviewOrder` 係 Review filter chip 嘅容器，名係 v0.39 排序 chip 留低；測試用緊呢個 id，所以未改名
- 124 條題目（408 − 284）冇類似題，因為佢哋嘅 fact 只有一個來源
- **Review suggestion 狀態**（S-001…S-094；2026-10-08 final review 逐個核對，`.proj-docs/reviews/2026-10-08_review_s091-s092-final.md`）：全部已做，除咗下面決定唔改嘅 S-032（見「功能現況 › Study › 掌握規則」）、S-052（由 S-053 `check-batch-replay.js` 取代）、S-059、S-092 嘅 `\u{…}` 部分（S-081 v0.72 已處理，見下）；S-013 / S-078 / S-079 從未發出
    ◦ **S-081（v0.68 決定唔改 → v0.72 B5 已處理）**：v0.68 Home UI 新加嘅 spacing literal（6px、20px、1.2em）當時冇抽 token，因為 `tokens.css` 未有 spacing token、淨係嗰幾行改會變兩套寫法（S-087 要求記低）。v0.72 一次過加 `--space-*` 再遷移晒（見「Design tokens」）；`1.2em` 係 em 值，唔喺 px 刻度，所以保留 literal
    ◦ **S-092（`\u{…}` 部分決定唔改）**：`structure-test` layering scanner 名以 `\u{…}` escape 結尾再接 `in` / `of`（`a\u{62}in / 2`）仍然當 keyword；喺 lookbehind 加 `}` 會整壞 `}return /x/`，而 `js/` 冇呢類寫法
    ◦ **S-059**：`d37eb26` 一個 commit 包 S-047 / S-048 / S-049（已 merge，唔改 history）
    ◦ **v066 `EXPECTED_ORACLE`** 寫死 `{ files: 8, records: 737, kept: 3 }`：加 batch 9 要跟住改
- **用戶決定 / 接受嘅行為（唔係 bug，唔好再提案）**：
    ◦ **Exam 多選揀唔夠數當已作答**（v0.57 起，`examTools.js` `isAnswered` = 有揀任何一個）：題號點變色、Submit 冇「未作答」提醒，計分照當錯；用戶 2026-10-07 決定唔改
    ◦ **多選題規則（用戶 2026-10-07）**：英文原題已經講明揀幾多個，app 唔另外再講；新增多選題原題一定要有 two / three（`content-guard` 守住），yue 要有「兩 / 三」（S-061）
    ◦ **Practice 翻譯洩露 trade-off**：以下 3 題用戶 2026-10-07 決定保留題目 `yue`（`yue-terms.md` R2 例外；batch 7 A6 / A9 / A10），Practice 作答前撳「翻譯」，題目同正確選項 `oy` 共用一個詞；Exam mode 作答前冇翻譯，計分唔受影響。QA script `w015()` 對呢 3 題只出 note
        ▪ A6 **Exam 3 · Q3**：「蘇格蘭嘅除夕夜叫乜嘢？」↔ oy「Hogmanay（蘇格蘭除夕）」—— 共用 **除夕**
        ▪ A9 **Exam 12 · Q17**：「邊個慈善機構幫助長者？」↔ oy「Age UK（長者慈善機構）」—— 共用 **長者**
        ▪ A10 **Exam 17 · Q11**：「君主喺國會開幕大典做邊兩件事？」↔ oy「宣讀君主演講（King's/Queen's Speech）…」—— 共用 **君主**
        ▪ 34 對係 `w015Scan` 基線，之後改 `yue` 要冇新增
- **改 `yue` / `oy` / `note` / fact `yue` 之後**：跑 `node tests/tools/check-batch-replay.js`（0 mismatch），同埋新開一個 batch JSON 記低（跟 batch 8 格式）

## 主要 commit（新→舊）

```
ca52020 docs: QA v0.72 (pass; pixel-identical at 320 / 360px, upgrade 22 / 0) + pixel / upgrade QA scripts
1e9344f docs: S-107 | HANDOFF S-081 status reads v0.68 won't-fix → v0.72 done; review v0.72 (99 pass)
15ee690 refactor: B5 | margin / padding / gap use a --space-* scale (0 visual change)
5264761 docs: QA v0.71 delta (icons + CUI-0017 pass; CUI-0017 completed); HANDOFF icon lines follow the swap
efeda72 fix: CUI-0017 | Tudor memory note keeps 阿拉貢的凱瑟琳 (option A)
d472d59 docs: QA v0.71 (B2 / B3 pass; W-025 conflict → CUI-0017) + v071 QA scripts
2dc025b feat: swap the Practice and Exam icons (Practice 📝, Exam 🎯)
73afc45 fix: W-025 | B2 memory notes use the unified terms; Henry VIII points become sub-items
7cce6c0 docs: review v0.71 (95 warn; W-025 B2 memory text terms)
6d70288 docs: HANDOFF notes B3 (Study memory method) and marks the follow-up done
556f2ce chore: APP_VERSION 0.71
fedb416 feat: B3 | Study fact cards show their source questions' memory method, closed by default
58ab25a feat: B2 | four new memory-method groups (Magna Carta, King vs Parliament, WWII, Tudors)
232ed5c docs: QA v0.70 release (pass, no new items) + upgrade / keyboard / shots / hang / fallback QA scripts
af9eceb fix: answer box note body is a div (it holds the note's row divs)
66d3d03 test: S-106 | v066 QA script reads the answer box note as rows like the Results review
5a7f3f3 docs: review v0.70 delta (99 pass; S-106)
05daec4 fix: timeline year keeps its v0.69 position in browsers without text-box
0849fdc refactor: S-105 | empty My Review tile fades every part; comments follow the v0.70 tile
17fae10 test: S-104 | timeline check fails when the year label stretches to the card height
cccc915 docs: review v0.70 (98 pass; S-104 / S-105)
51eec2e fix: Practice answer note keeps a hanging indent on wrapped bullet lines
aa1df26 docs: HANDOFF notes the v0.70 source row, stars line, timeline dot, wrong tile and B1
20d0672 chore: APP_VERSION 0.70
56a262d test: QA scripts v063 / v065 / v066 / v068 follow the v0.70 wrong tile and source row
cd97f0d fix: S-103 | holding Enter on Submit no longer submits through the prompt
a88945e fix: S-102 | results filter chip keeps keyboard focus after the chips redraw
97ed3a8 feat: B1 | Crown dependency memory note and the Oscar note list one item per line
6dbea5a feat: wrong answers tile drops "{n} to clear"; at 0 it shows only "Nothing to review yet"
2b98336 feat: fact card difficulty stars take their own line under the tags
c64d88d fix: timeline year text is cap-trimmed so the dot centres on the glyphs, with a 6px gap
1374951 fix: fact source row moves Practise to its own full-width line once the nodes wrap
785e1eb fix: Study timeline dot sits on the vertical middle of its year text
da008d5 test: S-101 | v065 E2 checks the S-025 focus trap; toggleLang comment no longer says there is no trap
e65dbbf docs: QA v0.69 release (pass; S-101 / S-102 / S-103) + keyboard / upgrade / ring QA scripts
b66d169 docs: review v0.69 S-098 (98 pass, S-099 / S-100)
ddd995f test: S-099 | time up over a keyboard-opened Submit / Leave prompt, then Enter, stays on results
f4b1ba6 docs: S-098 | HANDOFF notes showScreen drops focus from the hidden screen
04dfeae docs: review v0.69 delta (99 pass, S-098)
f225bdf fix: S-098 | showScreen drops focus left on the screen it hides
ba33f7f docs: S-096 | HANDOFF says where focus goes after OK navigates away; notes S-095 / W-024; review v0.69 (97 pass)
4922d62 fix: W-024 | time up closes an open Submit / Leave prompt before the results
079fdc8 test: S-095 | a second prompt over an open modal keeps the first opener
1ada9d2 docs: W-023 / S-093 / S-032 | HANDOFF lists the won't-fix suggestions, S-092 review note, S-032 decision, v0.69 modal / guard notes
295bb0b docs: S-033 | fact.css notes the accepted 1.5px → 1px border rounding in the touch-ring gap
9ae3c2c test: S-094 | layering sample for a ZWNJ inside a name
678ae69 test: S-023 | structure-test fails a var(--x) with no --x definition in css
245188e chore: APP_VERSION 0.69
418f365 fix: S-025 | confirm modal keeps Tab inside and returns focus to its opener
b65f467 docs: final review S-091 / S-092 (93 pass) + S-item audit (open: S-023, S-025, S-033, S-032; new W-023, S-093, S-094)
2520d78 fix: S-092 | REGEX_AFTER lists ZWNJ / ZWJ for Node before Unicode 15.1; note the \u{…} gap
1541444 docs: review S-090 (99 pass, new S-091)
b752df8 fix: S-091 | REGEX_AFTER keyword lookbehind uses \p{ID_Continue}
ecd7e02 fix: S-090 | REGEX_AFTER keywords exclude #private and non-ASCII names
85ff2b7 Merge pull request #44 from dcwhung/claude/modest-keller-8m154v
ca079eb docs: HANDOFF PR #44 (S-085 / S-086 / S-088 / S-089), S-090 follow-up
c83aa84 docs: QA S-085…S-089 (pass); factsession S-077 comment says finishExam is called directly
59fc97c docs: review S-085 / S-086 (98 pass, new S-088 / S-089)
510714e test: S-089 | layering sample pins a regex after a binary -
c0fe1ce fix: S-088 | REGEX_AFTER keywords are whole names, not $in or a spaced property
3afaea9 test: S-086 | factsession S-077 case relies on finishExam to render and show Result
ca7c52e fix: S-085 | layerCode reads a regex right after ${, ++ / -- and .of / .in
ac8af73 docs: W-007 | HANDOFF.md v0.59 after the P2 merge
c85ad3e docs: S-018 | note that --text-inverse-* alpha steps are value-named on purpose
82ed466 fix: S-014 | old-shell i18n load failure reloads once, then shows a fallback
297aed7 fix: S-019 | manifest name / short_name / description follow the locale
f778e90 test: S-017 | en values outside …Html keys carry no tags or entities
1efa945 fix: S-016 | study.count is a plural selected by the total
b335bff fix: S-015 | answer box Q) / A) labels come from quiz.yueQ / quiz.yueA
c3c8d32 fix: W-006 | i18n getLang/setLang ignore Object prototype keys
6002650 fix: study prefs validation uses the v0.59 key arrays (lane A + C merge)
d63efb9 Merge P2 Lane A: i18n architecture, en locale, unified wording (v0.59)
4e815f0 Merge P2 Lane C: favicon, manifest, studyPrefs validation, SW own-cache fetch
16ab50c Merge P2 Lane B: CSS design tokens
df9aa39 docs: CUI-0001 CUI-0002 CUI-0003 S-003 | HANDOFF.md for v0.59 Lane C
f18c6fa fix: CUI-0002 | add manifest.webmanifest so Chrome can install the app
07a5b63 fix: CUI-0001 | add a UK wordmark app icon as favicon and apple-touch-icon
85ab45b fix: S-003 | scope the SW fetch lookup to this app's own cache
ce5f6fa fix: CUI-0003 | validate lifeuk.studyPrefs in studyLoad so a bad tab no longer blanks Study
3c5ae86 test: visual-diff skips --* custom properties so new tokens are not reported as diffs
e4a914c docs: HANDOFF design tokens section, drop CSS token TODO
ad11ae1 refactor: move CSS colours, shadows, radius and font-size scale into design tokens
53f283d test: structure-test fails on hex / rgb(a) colour literals outside tokens.css
3d57b53 docs: HANDOFF.md v0.59 — i18n section, wording glossary, uiLang key, tests, version log
b56c8f7 feat: i18n architecture, en locale and unified wording (v0.59)
8535b7d test: add i18n-test for locale keys, CJK leftovers, setLang and plurals
a58ec97 test: add sw-test (http server, SHELL cached, offline reload) and structure-test
1b810bb refactor: split index.html into css/ and js/ modules, data-action delegation, real sw.js (v0.57)
5cf9314 fix: orange bookmark icon on the home Flagged tile (v0.56)
8be543f docs: HANDOFF.md v0.55 — PR #27 in version log, practice dots design decisions, commit list
8832313 feat: practice question dots, exam quick ✓ submit, orange Flagged icon (v0.55)
9832d49 chore: add temporary practice dots preview — numbered dots with right / wrong colours, counts, tap to jump (to be removed with the implementation)
1a3b2e9 docs: HANDOFF.md v0.54 — PR #24 / #25 in version log, commit list, screenshot restore note
79a1450 feat: Reset progress also clears the wrong list and flags (v0.54)
afba39f chore: restore test screenshots regenerated by the test run
a1a84d1 feat: practice flags, wrong-answer review, My Review, practice results (v0.53)
5a6f9d7 chore: practice preview v3 — bookmark icon in hint, hide My Review when empty, round note above the card, Flagged list screen
59fb8eb chore: practice preview v2 — separate My Review section, own wrong-answers design, 24-per-round remark
66acd3d chore: add temporary practice mode preview — flags, Flagged tab, wrong-answer review, results (to be removed with the implementation)
b4ac15b docs: HANDOFF.md v0.52 — PR #22 in version log, commit list
e6fbc5d feat: practice rounds draw 24 questions, same as the real test (v0.52)
abb32bc fix: roomier Review Answers — larger line height and gaps (v0.51)
c3b2983 fix: verdict icons (🎉 PASSED / 📚 NEEDS IMPROVEMENT); English-only By Difficulty title (v0.51)
174f2bc docs: HANDOFF.md v0.50 — PR #20 in version log, modal decisions, follow-ups, commit list
05cee49 feat: exam results — mode icon, single score line, result dots, review filters (v0.50)
67c98c1 fix: exam result buttons read 'Retry' / 'Another Exam' (v0.49)
3366880..01296a8 chore: result dots preview v1–v6（preview 已 delete）
3be4a05 feat: in-app modal for exam submit / leave confirmations (v0.48)
12793fc fix: keep the quick ← → visible in exam mode on unanswered questions (v0.47)
c39a8ac fix: Random Exam button text — 'Random Exam' / '24 Qs from 408 Qs' (v0.46)
2b33bad docs: HANDOFF.md v0.45 — PR #18 in version log, commit list
3e4b875 feat: exam mode All Exams becomes a 24-question Random Exam with no similar questions (v0.45)
2b98ef7 docs: HANDOFF.md v0.44 — PR #17 in version log, exam flow decisions, commit list
beb13ed feat: exam tools — 45-min countdown, bookmark flags, 24-dot question navigator (v0.44)
a7d7c38 chore: exam preview — legend counts right-aligned with separators（preview 已 delete）
11f77f7 chore: update temporary exam mode preview — bookmark flag, orange flagged dots, legend counts（preview 已 delete）
34f5c3d chore: add temporary exam mode preview — timer, flags, 24-dot navigator（preview 已 delete）
4641b06 feat: exam Submit takes the Next button's place on the last question (v0.43)
e7a3de5 feat: real-test exam flow — editable saved picks, single Submit on the last question (v0.43)
89e5f7c fix: exam mode submit moves on without revealing the answer (v0.43；中途版本，已被 e7a3de5 取代)
3af2f06 docs: HANDOFF.md v0.42 — PR #14 in version log, mastery bar note
f35f922 fix: keep By Exam mastery bars inside the rounded boxes (v0.42)
5cfcdf6 docs: HANDOFF.md v0.41 — PR #11/#12 in version log, workflow notes, stale header-stats note
f905348 feat: merge progress into the question card; symbol-only quick nav (v0.41)
0bf2332 chore: update temporary quiz header preview — option A, header stats removed（已 delete）
6a5904d chore: add temporary quiz header preview (to be removed with the implementation)（已 delete）
ce60c49 docs: HANDOFF.md v0.40 — PR #10 in version log, quick nav design notes
a140e42 feat: quick Prev / Next in the question header once answered (v0.40)
b61e701 docs: HANDOFF.md v0.39 — PR #8/#9 in version log, results design notes
8e337ee feat: English-only difficulty labels; wrong-first review order and top action buttons on results (v0.39)
73ed0de docs: HANDOFF.md v0.38 — PR flow, Similar Questions decisions, v0.32–v0.38 log
d73331f fix: keep practice session length fixed; no in-session re-queue (v0.38)
e273f4b test: make oy-test deterministic
f4e9b79 fix: 'Practise Again' instead of 'Retry Exam' on practice results (v0.37)
25b49f6 fix: place Prev / Next above the Similar Questions section
7648116 fix: plain 'Back' label on the similar-session return button
6d184c1 fix: name the original set on the similar-session back button (v0.36)
f49019c chore: merge main; bump to v0.35
f75e081 feat: Similar Questions section after answering in practice (v0.34)
8e41753 chore: add Similar Question Map mockup（之後 4 個 commit 按用戶意見改 mockup）
d680609 feat: cap practice rounds at 25 unmastered questions (v0.34)
fcd3c5b feat: show pass/fail verdict only for numbered exams on results (v0.33)
bbe86d7 feat: re-queue unmastered practice questions within the session (v0.32)
06d3bf9 docs: HANDOFF.md v0.31 — note format rules, mnemonic group list, session commits
4d5eaf9 feat: line break after note label; arrow on first voting-timeline line (v0.31)
40229b2 feat: battle timeline mnemonic note for defeat questions (v0.30)
630acd3 feat: three-tier Crown dependency mnemonic note; notes keep indentation (v0.29)
e74208c feat: unified Margaret Thatcher mnemonic note (v0.28)
3b98a97 feat: mnemonic notes for devolved bodies, saints' days, festivals, jury, parliament numbers, inventors (v0.27)
9c636d8 feat: unified national flower mnemonic note (v0.26)
447f0da fix(test): yue2-test picks a question with option translations to avoid random failure
d343aa0 feat: unified capital city mnemonic note (v0.25)
ffddc75 feat: one point per line in voting-rights timeline notes (v0.24)
6fb8ba7 feat: multi-line patron saint mnemonic note with dates; notes support line breaks (v0.23)
ada9855 fix: unify election term translations and add voting-rights timeline notes (v0.22)
d5d69c7 feat: unify patron saint notes with mnemonic and saints' days (v0.21)
4ed5760 feat: lower mastery streak to 3 consecutive correct answers
637eeb3 feat: show app version in header and derive SW cache name from it
f7803b9 refactor: split question data and utils out of index.html
1715666 feat: practice mastery streaks, per-set progress, reset buttons; move info button
6c04603 feat: move home hero into a header info popover
6991ef9 feat: remember home mode and practice tab; drop practice sub headers
a310ba4 feat: default to Practice with By Difficulty / By Chapter / By Exam tabs
df72707 feat: put Study, Practice and Exam in one row with click-to-show descriptions
6542c8f fix: add Chinese gloss to bare English terms in Cantonese text
ce7ef91 fix: expand English abbreviations inside Cantonese translations
991ef77 feat: always show Cantonese Q/A after answering; move Translate button
8fe5fa5 feat: translate answer options in Practice mode Translate toggle
5513d15 feat: add 1-5 star difficulty rating to questions and study facts
7315087 feat: add Study screen and practice-by-chapter
d6fac9c feat: tag questions with chapter and add STUDY fact dataset
c10115b feat: randomise answer option order in Practice and Exam mode
4e3778b fix: exam mode option lock, multi-select auto-submit, answer box, submit label
```

## Follow-up 候選（未做）

- [ ] **溫習計劃（Study Plan）**：mockup 已確認（`mockups/study-plan-flow.html`），**下一個開發任務**。規格、建議模組、LS key、未決定事項同驗收清單見 `.proj-docs/plans/2026-10-08_handoff_study-plan.md`；建議由 `/plan` 開始
- [x] 1.19、14.3 備注改成分行列點（v0.70 B1，batch 9；Crown dependency 記憶法同組 7 題一齊改）
- [x] 其他可整合記憶法嘅題組（v0.71 B2，batch 10）：Magna Carta、國王 vs 國會、二戰、都鐸王朝；諾曼征服（M5）用戶決定唔做
- [x] Study fact 卡片加「跳去來源題目」（v0.63，P3 PR-3：來源列 +「▶ Practise these N」）
- [x] 記憶法備注同步落 Study fact（v0.71 B3：唔抄入 `study.js`，`factMemoryText(f)` 由來源題目 note 讀；fact 卡收埋式「💡 記憶法」，用戶揀方案 B）
- [x] Practice 加 flag 功能，再執 Practice 結果頁（v0.53 完成）
- [x] ~~錯題 / Flagged review 中途離開可以續做~~ —— **用戶決定唔做**（2026-10-08 B4：中途離開唔可以續做）
- [x] 首頁「Reset progress」一併清 `wrongList` / `practiceFlags`（v0.54）
- [x] 首頁 Reset 掣改用 app 內 modal（同 Exam 一致）（v0.59）
- [x] 拆 `index.html`、data-action、真 `sw.js`（v0.57，P1）
- [x] localStorage key 加 `lifeuk.` prefix + 舊資料遷移（v0.58）
- [x] P2（v0.59）：locale（`js/core/i18n.js` + `locales/en.js`）+ 字眼統一 + 清 hidden `#rbCorrect` 等
- [x] P3：Study mode 統一（v0.61–v0.63，PR-1…PR-3）
- [x] 中文（zh-HK）locale + 語言切換掣（v0.65，Track 1）
- [x] Track 2：data 廣東話口語化（v0.66，`claude/yue-colloquial`）
- [x] v0.67 小批次：S-054、S-051 / S-053（/ S-052）（v0.68）
- [x] CUI-0013 窄屏多選題 quick nav；CUI-0014 `lang` 收尾（v0.67）
- [x] S-041…S-084 review suggestion（v0.68；S-081 當時決定唔改，v0.72 B5 已處理）
- [x] S-085 / S-086 / S-088 / S-089（PR #44，測試 only）
- [x] S-090 / S-091 / S-092 `layerCode` `#private` / Unicode 名（PR #45；`\u{…}` escape 名決定唔改）
- [x] Spacing token 統一（v0.72 B5：`--space-*`，0 視覺改動，S-081 後續）
- [x] iPhone 實機（PingFang HK）睇 320 / 375px：M4 結果行、Study chip 行、CUI-0013（用戶 2026-10-08 實機確認冇問題，close）
