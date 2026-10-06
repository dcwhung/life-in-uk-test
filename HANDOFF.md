# Life in the UK Test PWA — Handoff (v0.50)

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

| File | 大小 | 內容 |
|---|---|---|
| `index.html` | 96 KB | CSS、HTML、app 邏輯（state / home / quiz / exam tools / confirm modal / similar questions / results + result dots / study / SW） |
| `data/exams.js` | 181 KB | `EXAMS`：408 題，Exam 1–17 各 24 題 |
| `data/study.js` | 65 KB | `CHAPTERS` + `STUDY`：236 條 dedupe 後嘅 facts |
| `js/utils.js` | 2 KB | `shuffle`、`shuffleOptions`、`getLS`、`setLS`、`starsHtml`、`escapeHtml` |
| `tests/*.js` | | 17 套 Playwright 測試，`tests/run-all.sh` 一次過跑 |
| `mockups/similar-question-map.html` | 17 KB | Similar Questions 嘅設計 mockup（獨立 HTML，頂部 tab 切換情景；PR 嘅 `Design Origin`） |

載入次序：`data/exams.js` → `data/study.js` → `js/utils.js` → 主 script。全部全局變量，冇 ES module（`file://` 同 iOS PWA 兼容）。

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
- Practice 下三個 tab：By Difficulty（預設；v0.39 起難度只顯示英文：Easy / Basic / Medium / Hard / Expert / Hard & Expert）/ By Chapter / By Exam，每粒掣顯示「已掌握/總數 · %」+ 進度條（`.mastery-bar`，absolute 貼格仔底；格仔要 `overflow: hidden` 先唔會爆出圓角，By Exam 喺 v0.42 補返）；下面嘅提示寫明「連續答啱 3 次 = 掌握、每輪最多 25 題、每題一輪一次」
- Exam 下只有 Select Exam（完成過有 ✓）
- Mode 同 tab 記住喺 localStorage `homePrefs`
- 兩個 reset 掣：Practice「Reset progress」、Exam「Reset completed exams」（都要 confirm）

**Practice mode**
- 題目同選項次序隨機；揀完即刻 reveal
- 問題卡右上「Translate」掣：展開題目 + 每個選項嘅廣東話；答完自動固定顯示；下一題重設
- **問題卡 header（v0.41）：** 原本獨立一行嘅「Question X of Y · n/m correct」同 progress bar 拎走；progress bar 變咗問題卡頂邊（5px，`.q-progress`）；題號行寫「QUESTION X OF Y ★★★」，Practice 答咗題之後星星後面有綠色 pill「✓ 答啱/已答」（`scorePillHtml()`），窄 mon 放唔落會換去第二行；最頂深藍 header 嘅「✅ correct · 📝 done」已拎走
- **快捷 Prev / Next（v0.40；v0.41 改做只有符號）：** 答完（Practice reveal／Exam submit）之後，問題卡右上 Translate 嘅位置變做兩粒圓形「←」「→」（最後一題 ✓、臨時 session ↩；`title` / `aria-label` 寫返文字），同底部掣共用 `nextAction()`（Next → / Finish ✓ / See Results → / ↩ Back）；未答前唔顯示；窄 mon 時會換行靠右
- 答案框格式：`✓ Correct! · 🔥 n/3` → 英文答案 → `【廣東話翻譯】 Q) … A) …` → `💡 備注：`（獨立一行）→ 備注內容（支援多行）
- **掌握機制：** 同一題連續答啱 `MASTERY_STREAK`（=3）次 = 掌握，答錯即歸零；開練習時剔除已掌握題，全組掌握後再全部出；每輪最多抽 `PRACTICE_ROUND_MAX`（=25）條未掌握題（Chapter / Difficulty / All Exams；Exam 1–17 本身 24 題），**每題一輪只出一次，「Question X of Y」嘅 Y 唔會變**（v0.38 起；v0.32–v0.37 會將未掌握題重新排去 queue 尾，令 Y 越做越大，已取消）；答錯或未夠 3 次嘅題下一輪再抽；存 localStorage `practiceStreak` `{ "exam.idx": n }`
- **Similar Questions（v0.35）：** 答完（啱或錯）喺 Prev / Next 掣下面顯示同一條 `STUDY` fact 嘅其他題目（`fact.src` 除本題外嘅 key；每題只屬一條 fact，408 題入面 284 題有類似題）。內容：Core Fact（英文 + 廣東話）、「Appears in」題號 chip（本題／已掌握／練緊／0/3）、每題 `Exam N · Qn` + 🔥 進度 + 題目同翻譯（唔顯示答案）。Exam mode 唔顯示；冇類似題就唔顯示
- **Practise these N：** 開臨時 session（`examNum = 'similar'`），按列出次序每題做一次，照計 `practiceStreak`；最後一題 Next 變「↩ Back」（v0.36 起；之前寫「Back to Question n」會誤以為係返去臨時 session 第 n 題），還原原本 session 同題目位置；session 內唔再顯示 Similar Questions；返 Home 或開新練習會清走暫存 session（`similarReturn`）
- 按 Chapter / Difficulty 練習唔會標記為完成 exam
- 結果頁兩粒掣：Exam mode「Retry」/「Another Exam」，Practice mode「Retry」/「Another Practice」（v0.50；之前係 Retry Exam / Practise Again / Choose Another）；`.retry-btn` / `.another-btn` 上下兩組一齊改字；v0.39 起「重做 / Choose Another」掣喺 Review Answers 上面同最底各有一組（`.retry-btn`，兩粒一齊改字）
- **Exam 結果頁（v0.50，先做 preview v1–v6 同用戶確認）：**
    ◦ 頂頭 icon 跟 mode（`MODE_ICONS`：Exam 📝、Practice 🎯）
    ◦ 分數只顯示一次：「17 / 24 · 71%」，唔合格成行紅色（`.result-score.fail`），合格深藍；Exam mode 拎走 Correct / Wrong / Score 三格
    ◦ 結果卡入面 24 粒圓點（`#resultDots`）：綠 = 啱、紅 = 錯、白底紅框 = 未答、橙色圈 = flag 咗（保留啱錯顏色）；撳圓點跳去下面嗰題 review（`jumpToReview()`，被 filter 收埋就轉返 All，金框閃一下）
    ◦ 圓點下面靠右「Correct n | Wrong n | Unanswered n | Flagged n」（Wrong 唔包未答；大字分數嘅錯題 = Wrong + Unanswered）
    ◦ Review Answers filter：「All n / Wrong n / 🔖 Flagged n」（Wrong 包未答；0 題 disabled）；flag 咗嘅題目後面有橙色書籤 icon（同問題卡一樣，冇「Flagged」字）
- **Review Answers 排版（兩個 mode，v0.50）：** 答案下面虛線分隔，「【廣東話】」翻譯同「💡 備注：」各自一段；備注逐行一個 row（`noteHtml()`），•／→ 開頭 hanging indent，前置空格 + ◦ 子項再縮，空行保留
- Practice 結果頁暫時保留三格同「Original order / Wrong first」chip（用戶話 Practice 之後會加 flag 再一齊執）
- 結果頁 Review Answers 有「Original order / Wrong first」chip（v0.39，而家只喺 Practice）：Wrong first 將答錯題排最前，題號保留原本次序；選擇存 localStorage `reviewOrder`
- 結果頁 PASSED / NEEDS IMPROVEMENT 同 remark 只喺 Exam 1–17（Exam mode 或 Practice > By Exam）顯示；Chapter / Difficulty / All Exams 只顯示分數

**Exam mode**
- **真考試模式（v0.43）：** 揀選項即刻暫存（`state.answers`），唔使逐題 Submit；Next / Prev 自由走，返去見到自己揀嘅選項（藍色），**隨時可以改**；全程唔顯示啱／錯、答案框、翻譯
- **最後一題底部 Next 掣變做「Submit」**（同 ← Prev 一行；冇另外嘅 Submit 行，`#examSubmitRow` 已拎走；問題卡頭嘅快捷 → 喺最後一題收埋，避免誤撳交卷），撳咗就去結果頁；有未答題會先 `confirm("N questions unanswered. Submit anyway?")`，取消就留低繼續做
- 快捷 ← → 喺 Exam mode 一直顯示（v0.47 起；之前要揀咗選項先出，去到未答嘅下一題就唔見咗）；唔影響掌握記錄
- **Random Exam（v0.45）：** Exam mode 嘅 All Exams 掣變做「🎲 Random Exam」（細字「24 Qs from 408 Qs」）：每次由全部 408 題隨機抽 `RANDOM_EXAM_SIZE`（=24）題，**同一條 STUDY fact 最多抽一題**（`randomExamPick()` 用 `FACT_BY_QKEY` 去重，即係唔會有相類似題）；用齊考試工具同 PASSED / NEEDS IMPROVEMENT 判定；Retry 會再抽過一套新題；唔會標記 completed。Practice › By Exam 嘅「🎯 All Exams (408 Q)」維持原狀（每輪 25 條未掌握題）
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
- Service Worker inline 於 `index.html`，cache 名 `lifeuk-v${APP_VERSION}`，`SHELL` 預 cache 四個 file
- Cache-first：升版本先會更新已安裝嘅 app

## localStorage keys

| Key | 內容 |
|---|---|
| `completedExams` | `{ examNum: true }` |
| `practiceStreak` | `{ "exam.idx": n }` |
| `homePrefs` | `{ mode, view }` |
| `reviewOrder` | `"original"` / `"wrongFirst"`（結果頁 review 排序） |
| `studyPrefs` / `studyMastered` / `studyBookmarks` | Study 頁狀態 |

## 測試

```bash
npm i playwright-core          # 任何位置，放入 NODE_PATH
CHROMIUM_PATH=/opt/pw-browsers/chromium ./tests/run-all.sh
APP_URL=https://dcwhung.github.io/life-in-uk-test/ ./tests/run-all.sh   # 跑 live
```

測試會重新產生 `tests/shot-*.png`，跑完用 `git checkout -- tests/*.png` 還原，唔好一齊 commit。

| Suite | 覆蓋 |
|---|---|
| `test.js` | Practice 基本流程、多選；Exam：揀選項中性藍色、Next / Prev 保留同可改答案、最後一題 Next 變 Submit（同 Prev 一行）、未答 confirm、按暫存答案計分 |
| `shuffle-test.js` | 408 題選項打亂後答案對應 |
| `study-test.js`、`subfilter-test.js` | Study 四個 tab、搜尋、書籤、sub-filter |
| `diff-test.js` | 難度數據完整、按難度練習、結果統計、難度掣只顯示英文 |
| `yue-test.js`、`oy-test.js`、`yue2-test.js` | Translate 掣、選項翻譯、答案框格式、Exam mode 冇翻譯（`yue2-test` 跳去、`oy-test` 搬第一條有選項翻譯嘅題目去最前，避免抽到年份／True-False 題隨機失敗） |
| `mode-test.js`、`info-test.js` | 首頁 mode/tab、持久化、ⓘ popover；考試中返 Home 會問 |
| `mastery-test.js` | By Exam 進度條喺格仔入面、貼底（v0.42）；掌握機制（每輪每題一次、Y 固定、Ch1 要 3 輪先全掌握）、進度顯示、兩個 reset |
| `result-test.js` | 結果頁 PASSED / remark 只喺 Exam 1–17 顯示；重做掣按 mode 改字、上下兩組掣、Wrong first 排序同記住選擇 |
| `batch-test.js` | Exam mode Random Exam 24 題；Practice 每輪最多 25 題、下一輪由未掌握題抽、最後幾題每輪再出直至掌握 |
| `similar-test.js` | Similar Questions section、Practise these N 臨時 session 同返回 |
| `examresult-test.js` | Exam 結果頁：icon、分數行（唔合格紅）、冇三格、24 圓點狀態、計數、All / Wrong / Flagged filter、書籤 icon、撳圓點跳題、翻譯 / 備注排版、掣文字；合格唔紅；Practice 保留舊版 + 🎯 + Retry / Another Practice |
| `examtools-test.js` | Submit / Leave 用 app 內 modal（掣名、Esc 取消、冇瀏覽器 dialog）；Random Exam（30 次抽題全部 24 題、24 個唔同 fact、每次唔同；工具、PASSED、Retry 抽新題、首頁掣名）；Exam 1–17 計時器（45:00、最後 5 分鐘變紅、到 0 自動交卷 + 結果頁提示）、24 圓點狀態同跳題、書籤 flag、計數、Submit / Home 提示；Practice 同 All Exams 冇呢啲工具 |
| `quicknav-test.js` | 快捷 ← / →（符號、title、最後一題 ✓ / ↩）；問題卡 header：Question X of Y、progress bar 喺卡頂、score pill、header 冇 stats |

## 版本記錄（v0.32–v0.50）

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
- Submit 只喺最後一題，放喺 Next 嘅位置，文字只寫「Submit」；問題卡頭嘅快捷 → 喺最後一題收埋，避免誤撳交卷
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
- Pill 只喺 Practice、答咗至少一題先出；Exam mode 唔顯示（同以前一樣）
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
- 1.19、14.3 兩條備注係單句列舉（曼島／五位演員），未改成分行
- Similar Questions 臨時 session 期間，題號行嘅 score pill（✓ n/m）只計臨時 session；返回之後先變返原本 session 嘅數
- 124 條題目（408 − 284）冇類似題，因為佢哋嘅 fact 只有一個來源

## 主要 commit（新→舊）

```
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
- [ ] Practice 加 flag 功能，再執 Practice 結果頁（圓點、filter、拎走三格；用戶已講會之後做）
- [ ] 首頁 Reset 掣改用 app 內 modal（同 Exam 一致）
