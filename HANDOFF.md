# Life in the UK Test PWA — Handoff (v0.58)

- **Repo:** https://github.com/dcwhung/life-in-uk-test （main branch，GitHub Pages root `/`）
- **Live:** https://dcwhung.github.io/life-in-uk-test/
- **Stack:** 純 HTML + vanilla JS + CSS，冇 build tool、冇 dependency；PWA（Service Worker 離線）
- **用戶：** 香港廣東話使用者，備考 Life in the UK Test（ILR，BN(O) route）
- **開發流程（v0.32 起）：** 每次改動喺 `claude/*` branch 做，開 PR 入 `main` 再 merge（merge commit）；`main` merge 後 GitHub Pages 自動部署。冇 `develop` branch。PR merge 咗之後，同一條 branch 要由最新 `main` 重新開過先加新 commit
- **版本：** 改 app 嘅 commit `APP_VERSION` +0.01；只改測試／文件唔升版本
- **UI 改動：** 用戶通常要求先做 preview／mockup 確認先改 code（例如 `mockups/similar-question-map.html`、v0.41 嘅臨時 quiz header preview）；臨時 preview 確認後要 delete，唔好留喺 `main`
- **每輪改完：** 用戶通常會要求「開 PR 入 main 然後 merge」，之後再「更新 HANDOFF.md 記錄今次所有改動」

---

## File 結構

v0.57（P1 refactor）起 `index.html` 只剩 `<head>`、各 screen 嘅 markup 同 `<link>` / `<script>` tag；CSS 同 JS 按類分 sub folder。

| File | 內容 |
|---|---|
| `index.html` | `<head>` + 各 screen markup（Home / Flagged / Study / Quiz / Result / confirm modal）+ 載入次序；冇 inline script / onclick，inline style 只剩 `#progressFill` 嘅 `width:0%`（JS 動態改闊度） |
| `sw.js` | Service Worker（**一定要喺 root**，SW 只可以控制自己 path 或以下嘅 page）；`importScripts('js/core/config.js')` 攞 `APP_VERSION` 做 cache 名；`SHELL` 列齊所有 file |
| `data/exams.js` | `EXAMS`：408 題，Exam 1–17 各 24 題 |
| `data/study.js` | `CHAPTERS` + `STUDY`：236 條 dedupe 後嘅 facts |
| `css/base/tokens.css` | `:root` 色 / radius / shadow tokens |
| `css/base/layout.css` | reset、body、sticky header、main、`.screen` 切換、`[hidden]`、`.quiz-header` / `.section-title`、`@keyframes slideIn` |
| `css/components/*.css` | `buttons`（back / nav / quick ← → / flag 掣 + 書籤 icon 顏色）、`chips`（practice / study tab 共用 base、`.chip`、`.stars`）、`dots`（`.dot` / `.rdot` 共用形狀、`.dots-meta` / `.rmeta` 計數）、`modal`、`popover`（ⓘ popover + install banner） |
| `css/screens/*.css` | `home`、`quiz`（問題卡、選項、答案框、計時器、Similar `.sqm`）、`results`、`flagged`、`study`（含 timeline）；`@media (max-width: 480px)` 跟返各自 file 尾 |
| `js/core/config.js` | 常數：`APP_VERSION`、mode / set id（`PRACTICE_MODE`、`ALL_EXAM`、`WRONG_EXAM`…）、`MASTERY_STREAK`、`PRACTICE_ROUND_MAX`、`REAL_TEST_SIZE`、`PASS_RATIO`、`EXAM_MINUTES`、localStorage key（`LS_PREFIX` + 各 key、`LEGACY_LS_MIGRATION`、`MIGRATED_LS`、`MERGE_LS`、`OBSOLETE_LS`）等；**SW 都會 load，所以只可以有 const，唔可以掂 DOM 或者 data** |
| `js/core/utils.js` | `shuffle`、`shuffleOptions`、`toQuestionItem`、`isCorrectAnswer`、`getLS` / `setLS`（經 `lsKey()`：第一次用 storage 時 lazy 行 `ensureLegacyMigrated()`，再查 `LS_KEY_FALLBACK`；舊 key 遷移全部 code 喺呢度，見「localStorage keys」）、`escapeHtml`、`pad2`、`keysOf`、`percent`、`byId`、`setShown`、`showScreen` |
| `js/core/store.js` | `streaks` / `practiceFlags` / `wrongList`（`let`，測試會直接改）、completed exams、homePrefs 讀寫 |
| `js/core/actions.js` | `ACTIONS` registry + 一個 document click / input / keydown（Esc）listener；未知 action 名 `console.warn` 唔會 throw |
| `js/domain/questions.js` | `EXAM_COUNT`、`TOTAL_QUESTIONS`、`DIFF_LEVELS`（由 data 計）、`allQuestions()`（單一 loop）同由佢 filter 出嚟嘅 exam / chapter / difficulty pool、`poolFor()`、`randomExamPick()`、`examLabel()`、`questionByKey()` |
| `js/domain/mastery.js` | `qKey`、`streakOf`、`isMastered`、`recordPracticeAnswer`、`masteryOf`、`practicePool` |
| `js/domain/similar.js` | `FACT_BY_QKEY`、`factOf`、`similarKeys` |
| `js/components/*.js` | `icons`（`BOOKMARK_PATH`、`bookmarkSvg`、`starsHtml`）、`dots`（`dotButtonHtml`、`countsLegendHtml`，quiz 同結果頁共用）、`tags`（`streakLabel`、`streakTagHtml`、`questionRefText`、`chipHtml`、`setButtonHtml`）、`modal`（`showConfirm`）、`popover`（ⓘ + 由 data 填 408 / 17） |
| `js/screens/*.js` | `home`、`quiz`（`state`、`startExam`、`renderQuestion` 同拆細嘅 helper、`selectOption`）、`examTools`（計時、flag、圓點、`submitExam`）、`similarPanel`、`result`（`finishExam` 同 review）、`flagged`、`study` |
| `js/pwa/pwa.js` | `registerSW()`（`file://` 唔註冊）+ install banner |
| `js/main.js` | init（最後載入） |
| `tests/*.js` | 23 套 Playwright 測試，`tests/run-all.sh` 一次過跑 |
| `mockups/similar-question-map.html` | Similar Questions 嘅設計 mockup（獨立 HTML，頂部 tab 切換情景；PR 嘅 `Design Origin`） |

**載入次序：** `data/exams.js` → `data/study.js` → `js/core/config.js` → `core/utils` → `core/store` → `domain/*` → `components/*` → `screens/*` → `core/actions` → `pwa/pwa` → `main`。全部係 classic `<script src>`，全局變量，冇 ES module（`file://` 同 iOS PWA 兼容）；唔好包 IIFE，因為頂層 `let`（`state`、`streaks`、`pendingMode`…）要喺全局 lexical scope，測試先改得到。檔案之間只可以喺 function 入面互相 call；頂層即刻行嘅 code 只可以用前面已載入嘅 file。`store.js` 頂層嘅 `getLS()` 係第一個讀 storage 嘅地方，舊 key 遷移就喺嗰下 lazy 行（v0.58 起冇獨立 `migrate.js`，見「localStorage keys」）。

**加新 file 嘅規則（三步，漏一步就會離線壞咗）：**
1. `index.html` 按載入次序加 `<link>` / `<script src>`
2. `sw.js` 嘅 `SHELL` 加同一個 path（`tests/sw-test.js` 會檢查 index.html 每個 tag 都喺 SHELL）
3. `js/core/config.js` 升 `APP_VERSION`（cache 名跟版本，已安裝嘅 app 先會攞新 file）

**data-action 慣例（v0.57 起，冇 inline onclick）：**
- 掣寫 `data-action="startExam" data-arg="3"`；input 寫 `data-input-action="studySetSearch"`；其他參數用自己嘅 `data-*`（例如 Study 書籤 / 掌握掣 `data-mark="bookmarks"`）
- `js/core/actions.js` 嘅 `ACTIONS = { name: (el, event) => … }` 負責轉型（`numArg`、`examArg`：Exam 1–17 要係 number，`'all'` 等 set id 係 string）；disabled 嘅掣唔會行
- 同一個 click listener 之後會關 ⓘ popover（click 喺 popover 入面或者 ⓘ 本身除外）；Esc：有 modal 就取消 modal，同時關 popover
- 新加 action：markup 加 `data-action` + `ACTIONS` 加一行；`tests/structure-test.js` 會 fail 任何 `on*=` inline handler
- 顯示 / 收埋用 `hidden` attribute（`layout.css` 有 `[hidden] { display: none !important; }`）；唯一例外 `#studySubChips` 仍然用 `style.display`，因為 `subfilter-test` 讀 `style.display`

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
- 已確認譯名：Hogmanay 霍格莫尼、Cenotaph 戰爭紀念碑、Yeoman Warders/Beefeaters 皇家衛士、Windrush 疾風號、Hung parliament 懸浮議會、first past the post 領先者當選制、Emmeline Pankhurst 愛米林·潘克赫斯特、Halloween 萬聖節、Cardiff 加的夫、Belfast 貝爾法斯特、Edinburgh 愛丁堡、Crown dependency 皇家屬地、Bonfire Night 篝火之夜、Burns Night 彭斯之夜、Remembrance Day 國殤紀念日、Boxing Day 節禮日
- `exams.js` 同 `study.js` 譯名要一致（v0.22 曾經唔一致：簡單多數制／懸峙議會，已統一）

**備注（`note`）格式規則（v0.23 起）**
- 備注用 `\n` 分行；`.ans-note` 同 `.rv-yue` 係 `white-space: pre-wrap`，保留分行同縮排空格
- 顯示時「💡 備注：」獨立一行，內容由下一行開始（Practice 答案框同 Exam 結果頁 review 都係）
- 內容係列點就一定要分行，一點一行；時間線每行以「→」開頭（包括第一行）
- 有層次用「• 」主項、四個空格 + 「◦ 」子項；獨立段落（例如「陷阱：」）前留空行
- 記憶法格式：第一行「記憶法：」或「記憶法（主題）：」，之後每行「A → B → C；」，最後一行用「。」結尾
- 四地區對照類記憶法統一次序：Scotland → England → Wales → Northern Ireland
- 同一題組嘅所有題目用完全相同嘅記憶法文字；原有專題備注（例如邱吉爾金句）放喺記憶法上面一行

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

**加新題組嘅做法：** 用 Python regex 按 `q:"…"` 匹配整行再替換 `note:"…"`，跟住用 node 載入 `EXAMS` 驗證題組內所有 note 相同，最後升 `APP_VERSION`、跑 `tests/run-all.sh`。

## 功能現況

**首頁**
- Header：`Life in the UK ⓘ` + `Exam Practice v${APP_VERSION}`；ⓘ 彈出簡介 popover
- 三個 mode 掣一行：Study / Practice / Exam；預設 Practice；描述撳咗先顯示
- **My Review（v0.53）：** Practice mode 描述下面一個獨立 section，兩格：「Wrong answers」（數字 + 「N to clear」，超過 24 題加「· 24 per round」）同「Flagged」（「N saved」）；下面小字「Wrong answers come from Practice and Exam, and clear when you get them right here. Up to 24 per round.」；**錯題同 flag 都冇記錄時成個 section 唔顯示**；只喺 Practice 出；一格係 0 就灰色（Flagged 空格提示用 app 內嘅書籤 SVG icon，唔用 🔖 emoji）
- My Review 下面標題「Practice by」，三個 tab 文字改做 Difficulty / Chapter / Exam（id 不變）：Difficulty（預設；v0.39 起難度只顯示英文；v0.53 起只有 Easy / Basic / Medium / Hard / Expert 五行，拎走「Hard & Expert」）/ Chapter / Exam，每粒掣顯示「已掌握/總數 · %」+ 進度條（`.mastery-bar`，absolute 貼格仔底；格仔要 `overflow: hidden` 先唔會爆出圓角，By Exam 喺 v0.42 補返）；下面嘅提示寫明「連續答啱 3 次 = 掌握、每輪最多 24 題、每題一輪一次」
- Exam 下只有 Select Exam（完成過有 ✓）
- Mode 同 tab 記住喺 localStorage `homePrefs`
- 兩個 reset 掣：Practice「Reset progress」、Exam「Reset completed exams」（都要 confirm）；v0.54 起「Reset progress」會一齊清 `practiceStreak`、`wrongList`、`practiceFlags`，My Review 隨即收埋

**Practice mode**
- 題目同選項次序隨機；揀完即刻 reveal
- 問題卡右上「Translate」掣：展開題目 + 每個選項嘅廣東話；答完自動固定顯示；下一題重設
- **問題卡 header（v0.41）：** 原本獨立一行嘅「Question X of Y · n/m correct」同 progress bar 拎走；progress bar 變咗問題卡頂邊（5px，`.q-progress`）；題號行寫「QUESTION X OF Y ★★★」，Practice 答咗題之後星星後面有綠色 pill「✓ 答啱/已答」（**v0.55 已拎走**，由數字圓圈計數取代），窄 mon 放唔落會換去第二行；最頂深藍 header 嘅「✅ correct · 📝 done」已拎走
- **Practice 數字圓圈（v0.55，preview 同用戶確認）：** Practice（包括 Chapter / Difficulty / Exam / All Exams / Wrong answers / Flagged / Similar 臨時 session）問題卡頂都有數字圓圈，**取代 progress bar**（`hasNavDots()`；計時器仍然只係 `hasExamTools()`）。有幾多題出幾多粒，每行最多 12 粒。顏色：答啱綠（`.dot.ok`）、答錯紅（`.dot.bad`）、未答白、做緊金圈；flag 用 2.5px 橙色邊（保留綠／紅底），未答 + flag = 橙色空心框；撳圓圈跳去任何一題（`goToQuestion()`，未答都得）。下面靠右「Correct n | Wrong n | Unanswered n | Flagged n」（`practiceDotsMetaHtml()`，`.dots-meta.practice` 收細字同間距，390px 一行；360px 或更窄會斷兩行）
- **快捷 Prev / Next（v0.40；v0.41 改做只有符號）：** 答完（Practice reveal／Exam submit）之後，問題卡右上 Translate 嘅位置變做兩粒圓形「←」「→」（最後一題 ✓、臨時 session ↩；`title` / `aria-label` 寫返文字），同底部掣共用 `nextAction()`（Next → / Finish ✓ / See Results → / ↩ Back）；未答前唔顯示；窄 mon 時會換行靠右
- 答案框格式：`✓ Correct! · 🔥 n/3` → 英文答案 → `【廣東話翻譯】 Q) … A) …` → `💡 備注：`（獨立一行）→ 備注內容（支援多行）
- **掌握機制：** 同一題連續答啱 `MASTERY_STREAK`（=3）次 = 掌握，答錯即歸零；開練習時剔除已掌握題，全組掌握後再全部出；每輪最多抽 `PRACTICE_ROUND_MAX`（=24，v0.52 起；之前 25）條未掌握題（Chapter / Difficulty / All Exams；Exam 1–17 本身 24 題），**每題一輪只出一次，「Question X of Y」嘅 Y 唔會變**（v0.38 起；v0.32–v0.37 會將未掌握題重新排去 queue 尾，令 Y 越做越大，已取消）；答錯或未夠 3 次嘅題下一輪再抽；存 localStorage `practiceStreak` `{ "exam.idx": n }`
- **Similar Questions（v0.35）：** 答完（啱或錯）喺 Prev / Next 掣下面顯示同一條 `STUDY` fact 嘅其他題目（`fact.src` 除本題外嘅 key；每題只屬一條 fact，408 題入面 284 題有類似題）。內容：Core Fact（英文 + 廣東話）、「Appears in」題號 chip（本題／已掌握／練緊／0/3）、每題 `Exam N · Qn` + 🔥 進度 + 題目同翻譯（唔顯示答案）。Exam mode 唔顯示；冇類似題就唔顯示
- **Practise these N：** 開臨時 session（`examNum = 'similar'`），按列出次序每題做一次，照計 `practiceStreak`；最後一題 Next 變「↩ Back」（v0.36 起；之前寫「Back to Question n」會誤以為係返去臨時 session 第 n 題），還原原本 session 同題目位置；session 內唔再顯示 Similar Questions；返 Home 或開新練習會清走暫存 session（`similarReturn`）
- 按 Chapter / Difficulty 練習唔會標記為完成 exam
- 結果頁兩粒掣：Exam mode「Retry」/「Another Exam」，Practice mode「Retry」/「Another Practice」（v0.50；之前係 Retry Exam / Practise Again / Choose Another）；`.retry-btn` / `.another-btn` 上下兩組一齊改字；v0.39 起「重做 / Choose Another」掣喺 Review Answers 上面同最底各有一組（`.retry-btn`，兩粒一齊改字）
- **Exam 結果頁（v0.50，先做 preview v1–v6 同用戶確認）：**
    ◦ 頂頭 icon 跟 mode（`MODE_ICONS`：Exam 📝、Practice 🎯）
    ◦ 判定前面加返 icon（v0.51）：「🎉 PASSED」/「📚 NEEDS IMPROVEMENT」
    ◦ 結果頁標題「By Difficulty」唔要中文（v0.51）
    ◦ 分數只顯示一次：「17 / 24 · 71%」，唔合格成行紅色（`.result-score.fail`），合格深藍；Exam mode 拎走 Correct / Wrong / Score 三格
    ◦ 結果卡入面 24 粒圓點（`#resultDots`）：綠 = 啱、紅 = 錯、白底紅框 = 未答、橙色圈 = flag 咗（保留啱錯顏色）；撳圓點跳去下面嗰題 review（`jumpToReview()`，被 filter 收埋就轉返 All，金框閃一下）
    ◦ 圓點下面靠右「Correct n | Wrong n | Unanswered n | Flagged n」（Wrong 唔包未答；大字分數嘅錯題 = Wrong + Unanswered）
    ◦ Review Answers filter：「All n / Wrong n / 🔖 Flagged n」（Wrong 包未答；0 題 disabled）；flag 咗嘅題目後面有橙色書籤 icon（同問題卡一樣，冇「Flagged」字）
- **Review Answers 排版（兩個 mode，v0.50）：** 答案下面虛線分隔，「【廣東話】」翻譯同「💡 備注：」各自一段；備注逐行一個 row（`noteHtml()`），•／→ 開頭 hanging indent，前置空格 + ◦ 子項再縮，空行保留
- **Practice flag（v0.53）：** Practice 問題卡都有書籤掣（放喺 Translate 左邊），flag **長期保存**喺 localStorage `practiceFlags` `{ "exam.idx": true }`，reload 後仍然 on；Exam 嘅 flag 照舊只喺該次考試（`state.flags`）；`isFlaggedNow(i)` 按 mode 揀來源
- **錯題庫（v0.53）：** localStorage `wrongList` `{ "exam.idx": true }`；Practice 每次 reveal 答錯就加；Exam 交卷時「有答但答錯」嘅題加入（未答唔加）；**只有喺 Wrong answers review 入面答啱先會清走**（`examNum === 'wrong'`），平時練習答啱唔清
- **Review round（v0.53）：** 撳 Wrong answers 格 → `startExam('wrong')`；Flagged 格 → Flagged 列表畫面。Review set 唔理掌握過濾，全部洗牌後抽最多 24 題（`PRACTICE_ROUND_MAX`）；題數多過 24 時問題卡**上面靠右**出細字「Round 1 of N · 24 of your T wrong answers / flagged questions」（`renderRoundNote()`）；暫時冇中途續做
- **Flagged 列表畫面（v0.53，`#screenFlagged`）：** 頂頭「Practise flagged (N)」掣；每題一行：題目 + 廣東話 + 「Exam N · Qn」+ 書籤掣（撳即 unflag，列表即時更新）；冇 flag 剩低就顯示「No flagged questions left.」
- **Practice 結果頁（v0.53，跟 Exam 結果頁排版）：** 🎯 icon、「18 / 24 · 75%」分數行（Practice 永遠唔紅）、拎走 Correct / Wrong / Score 三格、24 粒結果圓點（flag 橙圈）、All / Wrong / Flagged filter；下面一行 note：一般練習「Mastered N more this round · m/total in {set}」，錯題 review「Cleared X from your wrong list · Y left」；每題 review 開頭有 streak tag（🔥 n/3 或 🏆 Mastered，`streakTag()`）；舊嘅「Original order / Wrong first」chip 同 `reviewOrder` 已拎走
- 結果頁 PASSED / NEEDS IMPROVEMENT 同 remark 只喺 Exam 1–17（Exam mode 或 Practice > By Exam）顯示；Chapter / Difficulty / All Exams 只顯示分數

**Exam mode**
- **真考試模式（v0.43）：** 揀選項即刻暫存（`state.answers`），唔使逐題 Submit；Next / Prev 自由走，返去見到自己揀嘅選項（藍色），**隨時可以改**；全程唔顯示啱／錯、答案框、翻譯
- **最後一題底部 Next 掣變做「Submit」**（同 ← Prev 一行；冇另外嘅 Submit 行，`#examSubmitRow` 已拎走；v0.55 起問題卡頭嘅快捷掣喺最後一題變「✓」（title「Submit」），同 Practice 最後一題嘅 ✓ 一樣，行同一個 `submitExam()`；v0.43–v0.54 係收埋），撳咗就去結果頁；有未答題會先 `confirm("N questions unanswered. Submit anyway?")`，取消就留低繼續做
- 快捷 ← → 喺 Exam mode 一直顯示（v0.47 起；之前要揀咗選項先出，去到未答嘅下一題就唔見咗）；唔影響掌握記錄
- **Random Exam（v0.45）：** Exam mode 嘅 All Exams 掣變做「🎲 Random Exam」（細字「24 Qs from 408 Qs」）：每次由全部 408 題隨機抽 `RANDOM_EXAM_SIZE`（=24）題，**同一條 STUDY fact 最多抽一題**（`randomExamPick()` 用 `FACT_BY_QKEY` 去重，即係唔會有相類似題）；用齊考試工具同 PASSED / NEEDS IMPROVEMENT 判定；Retry 會再抽過一套新題；唔會標記 completed。Practice › By Exam 嘅「🎯 All Exams (408 Q)」維持原狀（每輪 24 條未掌握題）
- **考試工具（v0.44，Exam 1–17；v0.45 起 Random Exam 都有）：**
    ◦ 45 分鐘倒數（`EXAM_MINUTES`），右上角取代「Exam」標籤，一直顯示；剩 5 分鐘（`EXAM_WARN_SECONDS`）變紅閃；到 0 自動交卷，直接去結果頁，頁頂紅框「⏱ Time's up — your exam was submitted automatically.」（`#resultTimeUp`）；計時用 `examDeadline`（Date.now），唔怕 setInterval 延遲
    ◦ 書籤 icon（SVG，冇圓圈）flag 每一題（`state.flags`），未 flag 灰色空心、flag 咗橙色實心
    ◦ 問題卡頂 24 個有數字嘅圓點（12 × 2），撳就跳題（`goToQuestion()`）：已答深藍實心、未答白色、已答 + flag 橙色實心、未答 + flag 橙色空心框、做緊嗰題金色圈；Exam mode 唔顯示 progress bar（圓點已經代表進度）
    ◦ 圓點下面靠右「Answered n | Unanswered n | Flagged n」
    ◦ Submit 提示（v0.48 起用 app 內 modal `showConfirm()`，唔再用瀏覽器 confirm）：標題「Submit exam?」，內容逐行列「N questions unanswered」「M flagged」「You can still go back and check them.」，掣「Keep going」/「Submit」；全部答晒又冇 flag 就直接交
    ◦ 考試中撳 ← Home 先彈 modal「Leave the exam? / Your answers will be lost.」，掣「Stay」/「Leave」，Leave 先離開同停計時；結果頁返 Home 唔問
    ◦ Modal：撳背景或 Esc = 取消；`z-index: 300` 蓋過 sticky header；首頁兩個 Reset 掣仍然用瀏覽器 confirm（未改）
- 實作：`renderQuestion()` 用 `showAnswer = revealed && state.mode === 'practice'` 控制顏色、答案框同翻譯；Exam mode 唔再用 `state.revealed`，`nextAction()` 喺 Exam 最後一題返 `{ label: 'Submit', run: submitExam, quick: false }`；`submitExam()` 計未答數再 `finishExam()`（按 `state.answers` 計分）
- Results：分數、pass/fail（18/24）、按難度統計表、逐題 review

**Study（溫習）**
- 四個 tab：Chapters（Ch1–5 chip）/ Timeline（10 個時代，戰爭紅色 + 「只顯示戰爭」）/ Geography（國家 chip → 類型分組）/ People（角色 chip，君主按時序）
- 搜尋（英文 + 廣東話）、書籤 ★、已掌握 ✓、「隱藏已掌握」「只顯示書籤」chip
- Prefs 存 `studyPrefs`、`studyMastered`、`studyBookmarks`

**PWA**
- Service Worker 係 root 嘅 `sw.js`（v0.57 起）：`importScripts('js/core/config.js')`，cache 名 `lifeuk-v${APP_VERSION}`，`SHELL` 預 cache `./`、`index.html`、data 同**所有** css / js
- 點解要改：v0.56 或之前用 `Blob` + `URL.createObjectURL` 註冊 inline SW，Chrome 一直 reject（console：`SW error: … The URL protocol of the script ('blob:...') is not supported`），所以其實從來冇離線 cache；SW 一定要係同 origin 嘅真 file
- `registerSW()` 喺 `file://` 直接 skip（file 協議唔支援 SW，免得 console 出 error）；註冊用 `updateViaCache: 'none'`，因為升版本只改 `config.js`（被 import 嘅 file），唔繞過 HTTP cache 就可能睇唔到新版本
- Install 用 `new Request(u, { cache: 'reload' })` 攞 SHELL，GitHub Pages 嘅 `max-age=600` 唔會令新 cache 存咗舊 file
- Activate 只刪 `lifeuk-v*` 而又唔係今個版本嘅 cache：`dcwhung.github.io` 同其他 app 共用 origin，唔好刪人哋嘅 cache
- 離線時 fetch 失敗只有 page navigation 先 fallback 去 `./`；script / css 唔會收到 HTML
- Cache-first：升版本先會更新已安裝嘅 app

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
| `lifeuk.migrated` | v0.58 遷移完成 marker（`MIGRATED_LS`，值係寫入時嘅 `APP_VERSION`；只睇有冇） |
| `lifeuk.migrateFallback` | v0.58 遷移用：JSON array，列出「merge 寫唔到、今次載入改用舊 key、但新 key 仲有舊 value」嘅新 key 名（`MIGRATE_FALLBACK_LS`）；寫 marker 時清走 |

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

測試會重新產生 `tests/shot-*.png`，跑完用 `git ls-files -m 'tests/*.png' | xargs git checkout --` 還原，唔好一齊 commit。**唔好用 `git checkout -- tests/*.png`**：shell glob 會包埋 git 未追蹤嘅新截圖（例如 `shot-similar.png`），git 遇到唔認識嘅 path 會成句失敗，一張都冇還原（v0.53 因此誤 commit 咗截圖，要另開 commit 還原）；未追蹤嘅截圖直接 `rm`。

`tests/pages-server.js` 唔係 suite：`sw-test` 同 `upgrade-test` 共用嘅 python static server（`Cache-Control: max-age=600`，port 0 由 OS 揀、server 印返 port；python 起唔到或者提早退出就即刻 fail）。`upgrade-test` 用嘅 v0.57 commit（`dc84cab`）喺 shallow clone 可能冇，會 fail 並提示 `git fetch --unshallow` 或者設 `V057_REF`。

| Suite | 覆蓋 |
|---|---|
| `test.js` | Practice 基本流程、多選；Exam：揀選項中性藍色、Next / Prev 保留同可改答案、最後一題 Next 變 Submit（同 Prev 一行）、未答 confirm、按暫存答案計分 |
| `shuffle-test.js` | 408 題選項打亂後答案對應 |
| `study-test.js`、`subfilter-test.js` | Study 四個 tab、搜尋、書籤、sub-filter |
| `diff-test.js` | 難度數據完整、按難度練習、結果統計、難度掣只顯示英文、只有 Easy–Expert 五行（冇 Hard & Expert） |
| `yue-test.js`、`oy-test.js`、`yue2-test.js` | Translate 掣、選項翻譯、答案框格式、Exam mode 冇翻譯（`yue2-test` 跳去、`oy-test` 搬第一條有選項翻譯嘅題目去最前，避免抽到年份／True-False 題隨機失敗） |
| `mode-test.js`、`info-test.js` | 首頁 mode/tab、持久化、ⓘ popover；考試中返 Home 會問 |
| `mastery-test.js` | By Exam 進度條喺格仔入面、貼底（v0.42）；掌握機制（每輪每題一次、Y 固定、Ch1 要 3 輪先全掌握）、進度顯示、兩個 reset（Reset progress 一併清錯題同 flag，My Review 收埋） |
| `result-test.js` | 結果頁 PASSED / remark 只喺 Exam 1–17 顯示；重做掣按 mode 改字、上下兩組掣、Practice 結果 All / Wrong / Flagged filter |
| `batch-test.js` | Exam mode Random Exam 24 題；Practice 每輪最多 24 題、下一輪由未掌握題抽、最後幾題每輪再出直至掌握 |
| `similar-test.js` | Similar Questions section、Practise these N 臨時 session 同返回 |
| `examresult-test.js` | Exam 結果頁：icon、分數行（唔合格紅）、冇三格、24 圓點狀態、計數、All / Wrong / Flagged filter、書籤 icon、撳圓點跳題、翻譯 / 備注排版、掣文字；合格唔紅；Practice 都冇三格、有圓點同 filter + 🎯 + Retry / Another Practice |
| `review-test.js` | v0.53：「Practice by」標題同 tab 文字；冇記錄唔出 My Review；Practice flag 位置同 reload 後保留；兩格數字同 remark；錯題由 Practice / Exam 加入、只喺 review 答啱先清；>24 題嘅 round note 位置同文字；Flagged 列表、unflag、練 flagged、空列表；Practice 結果頁（icon、分數、圓點、filter、mastery note、streak tag） |
| `examtools-test.js` | Submit / Leave 用 app 內 modal（掣名、Esc 取消、冇瀏覽器 dialog）；Random Exam（30 次抽題全部 24 題、24 個唔同 fact、每次唔同；工具、PASSED、Retry 抽新題、首頁掣名）；Exam 1–17 計時器（45:00、最後 5 分鐘變紅、到 0 自動交卷 + 結果頁提示）、24 圓點狀態同跳題、書籤 flag、計數、Submit / Home 提示；Practice 冇計時，圓點係啱／錯版（見 practicedots-test） |
| `quicknav-test.js` | 快捷 ← / →（符號、title、最後一題 ✓ / ↩；Exam 最後一題 ✓ = Submit）；問題卡 header：Question X of Y、Practice 用圓圈唔用 progress bar、冇 score pill、header 冇 stats |
| `sw-test.js` | v0.57：將 app copy 去 temp dir，用 python static server（加 GitHub Pages 一樣嘅 `Cache-Control: max-age=600`）serve（或者 http 嘅 `APP_URL`）；index.html 每個 `<script src>` / `<link href>` 都喺 `sw.js` SHELL、SHELL 每個 file 存在；`sw.js` 註冊成功、cache 名跟 `APP_VERSION`、SHELL 全部 cache 咗；`setOffline(true)` reload 仍然出首頁、css 生效、開到 Practice；同 origin 其他 app 嘅 cache（`other-app`）唔會俾 activate 刪；淨係改 temp copy 嘅 `config.js` 版本號就會裝新 cache、刪舊 `lifeuk-v*` cache；冇 page / console / SW error（瀏覽器自己 probe `/favicon.ico` 嘅 404 除外） |
| `structure-test.js` | v0.57：index.html / js 冇 inline `on*=`、index.html 冇 inline `<style>` / `<script>` / `style=`（progress bar 闊度除外）、每個 function ≤ 30 行、markup / template 每個 `data-action` 都有 `ACTIONS` handler 而每個 handler 都有人用、`file://` 載入冇 page error / console error / failed request |
| `migrate-test.js` | v0.58：用似真用戶嘅舊資料（completedExams、homePrefs、practiceFlags、practiceStreak、reviewOrder、wrongList、studyPrefs / studyMastered / studyBookmarks，全部非空）+ 其他 app 嘅 key（`run365.prefs`、`tripspend.*.v1`）reload：`lifeuk.*` 係原始字串、舊 key 同 `reviewOrder` 刪咗、其他 app 嘅 key 一字不改、UI 跟資料（Practice › By Chapter、Flagged 5、mastery 數、Exam 1–5 ✓、Study geo tab）；全部搬完寫 `lifeuk.migrated`；有 marker 新舊都有 → 新嘅贏（UI 讀新 key）；冇 marker 新舊都有 → streak / flags 逐條 merge（同一題新嘅贏）、homePrefs 新嘅贏、舊 key 刪、寫 marker、UI 顯示 merge 後進度（3/408、Flagged 3）；一邊唔係 object（壞 JSON、array）→ 留新 value；再 reload 兩次唔變、app 寫入只落 `lifeuk.*`；壞 JSON 照搬唔 crash；空 storage 只生 marker；fail-safe：stub `setItem` 令 `lifeuk.practiceStreak` throw QuotaExceededError、`lifeuk.studyPrefs` 寫唔落（verify 唔對），今次載入 UI 照顯示舊進度（3/408、Study geo）、答題寫返舊 key、冇空新 key，fallback 期間冇 marker；拎走 stub reload 後舊 streak + 新答案全部喺 `lifeuk.practiceStreak`、舊 key 冇咗、寫 marker；冇 marker 新舊都有而 merge 寫入 throw → 兩個 key 原封不動、冇 marker、UI 讀舊 key，拎走 stub 後 merge 完成 |
| `upgrade-test.js` | v0.58（CUI-0004）：v0.57 檔案由 git 攞（pinned `dc84cab`，v0.57 嘅 main）。① 混合 shell（`file://`）：temp dir 放 v0.57 `index.html`（冇 migrate tag）+ 而家嘅 js / css / data，seed 舊 key → UI 即刻顯示舊進度（3/408、Flagged 5）；答一題，再開而家嘅 `index.html` → 舊 streak 全部 + 新答案都喺 `lifeuk.practiceStreak`、其他 value 原始字串、舊 key 冇咗、有 marker、其他 app key 唔郁。② 反方向混合：v0.57 全套 + 而家嘅 `utils.js` → 冇 error、照讀 v0.57 key、storage 唔郁。③ QA `upgrade-sim` 核心：python server（`max-age=600`）serve v0.57，SW 裝好、seed 舊資料、記低 UI；原地換做而家嘅 file，reload 等新 SW activate + 刪 `lifeuk-v0.57` cache，再 reload → v0.58、8 個 value 原始字串、舊 key + reviewOrder 冇咗、其他 app key 一樣、新 key 只多 marker、UI（mode / view、Flagged、Wrong、mastery grid、完成 ✓、Study tab / 掌握 / 書籤）同升級前一樣、再 reload 唔變（呢個 case 唔保證撞到 SW 換版嘅 race，race 由 ① deterministic 咁覆蓋）。④ 第三種混合：而家嘅 file + v0.57 `utils.js`，seed 舊 key、答一題 → 舊 key 原封不動、冇 marker；換返而家嘅 `utils.js` reload → 舊 streak 全部 + 新答案、5 個舊 map 每條 entry 都喺、舊 key 冇咗、有 marker。約 6 秒 |
| `practicedots-test.js` | v0.55：Practice 圓圈（24 / 9 / review 題數、冇 progress bar 同計時、啱綠錯紅、flag 橙邊、計數一行、撳跳題前後都得）；冇 score pill；Exam 最後一題快捷 ✓ 交卷（有未答彈 modal、全答直接去結果）；Flagged 列表「Practise flagged」書籤 icon 係橙色；首頁 Flagged 格 icon 橙色、Home 冇可見嘅黑色 SVG（v0.56） |

## 版本記錄（v0.32–v0.58）

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
- 首頁兩個 Reset 掣暫時仲用瀏覽器 confirm（如要一致可以之後改用 `showConfirm()`）

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

- Study fact 卡片未有「跳去來源題目」（之前決定 v2 先做）
- 難度評級係靜態 rubric，未按個人答題記錄調整
- 冇 dark mode
- 測試依賴 Playwright + Chromium，repo 冇 `package.json`
- 備注嘅 `\n` 係直接寫喺 `exams.js` 字串入面，冇 markdown 解析；縮排靠空格 + `pre-wrap`
- `bookmarkSvg(cls)`（`js/components/icons.js`）輸出嘅 SVG path 冇 fill，新 class 一定要喺 CSS 設顏色（`css/components/buttons.css`），否則會係黑色（v0.55 / v0.56 踩過兩次）
- CSS 仲有好多 hardcoded 顏色 / px（v0.57 照搬，冇改做 token，避免改到外觀）
- `#reviewOrder` 係 Review filter chip 嘅容器，名係 v0.39 排序 chip 留低；測試用緊呢個 id，所以未改名
- 1.19、14.3 兩條備注係單句列舉（曼島／五位演員），未改成分行
- 124 條題目（408 − 284）冇類似題，因為佢哋嘅 fact 只有一個來源

## 主要 commit（新→舊）

```
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

- [ ] 1.19、14.3 備注改成分行列點
- [ ] 其他可整合記憶法嘅題組：君主／王朝時序、Civil War（1642–1651）相關、WWII 事件（Dunkirk、Blitz、D-Day）、Magna Carta 1215 三條重複題
- [ ] Study fact 卡片加「跳去來源題目」（v2）；可以直接用 `FACT_BY_QKEY` / `fact.src` 同 `questionByKey()`
- [ ] 記憶法備注同步落 `study.js` 對應 fact（目前只喺 `exams.js`）
- [x] Practice 加 flag 功能，再執 Practice 結果頁（v0.53 完成）
- [ ] 錯題 / Flagged review 中途離開可以續做（用戶話暫時唔做）
- [x] 首頁「Reset progress」一併清 `wrongList` / `practiceFlags`（v0.54）
- [ ] 首頁 Reset 掣改用 app 內 modal（同 Exam 一致）（P2）
- [x] 拆 `index.html`、data-action、真 `sw.js`（v0.57，P1）
- [x] localStorage key 加 `lifeuk.` prefix + 舊資料遷移（v0.58）
- [ ] P2（v0.59）：locale（`js/core/i18n.js` + `locales/en.js`）+ 字眼統一 + 清 hidden `#rbCorrect` 等；P3：Study mode 統一
- [ ] CSS hardcoded 顏色 / 尺寸改用 `tokens.css` token
