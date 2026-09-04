# Life in the UK Test PWA — Handoff (v0.31)

- **Repo:** https://github.com/dcwhung/life-in-uk-test （main branch，GitHub Pages root `/`）
- **Live:** https://dcwhung.github.io/life-in-uk-test/
- **Stack:** 純 HTML + vanilla JS + CSS，冇 build tool、冇 dependency；PWA（Service Worker 離線）
- **用戶：** 香港廣東話使用者，備考 Life in the UK Test（ILR，BN(O) route）
- **開發流程：** 每次改動 commit 到 `claude/life-in-uk-test-pwa-seeedf`，再直接 push 去 `main`；`APP_VERSION` 每次 +0.01

---

## File 結構

| File | 大小 | 內容 |
|---|---|---|
| `index.html` | 70 KB | CSS、HTML、app 邏輯（state / home / quiz / results / study / SW） |
| `data/exams.js` | 181 KB | `EXAMS`：408 題，Exam 1–17 各 24 題 |
| `data/study.js` | 65 KB | `CHAPTERS` + `STUDY`：236 條 dedupe 後嘅 facts |
| `js/utils.js` | 2 KB | `shuffle`、`shuffleOptions`、`getLS`、`setLS`、`starsHtml`、`escapeHtml` |
| `tests/*.js` | | 11 套 Playwright 測試，`tests/run-all.sh` 一次過跑 |

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
- Header：`Life in the UK ⓘ` + `Exam Practice v0.20`；ⓘ 彈出簡介 popover
- 三個 mode 掣一行：Study / Practice / Exam；預設 Practice；描述撳咗先顯示
- Practice 下三個 tab：By Difficulty（預設）/ By Chapter / By Exam，每粒掣顯示「已掌握/總數 · %」+ 進度條
- Exam 下只有 Select Exam（完成過有 ✓）
- Mode 同 tab 記住喺 localStorage `homePrefs`
- 兩個 reset 掣：Practice「Reset progress」、Exam「Reset completed exams」（都要 confirm）

**Practice mode**
- 題目同選項次序隨機；揀完即刻 reveal
- 問題卡右上「Translate」掣：展開題目 + 每個選項嘅廣東話；答完自動固定顯示；下一題重設
- 答案框格式：`✓ Correct! · 🔥 n/3` → 英文答案 → `【廣東話翻譯】 Q) … A) …` → `💡 備注：`（獨立一行）→ 備注內容（支援多行）
- **掌握機制：** 同一題連續答啱 `MASTERY_STREAK`（=3）次 = 掌握，答錯即歸零；開練習時剔除已掌握題，全組掌握後再全部出；存 localStorage `practiceStreak` `{ "exam.idx": n }`
- 按 Chapter / Difficulty 練習唔會標記為完成 exam

**Exam mode**
- 全部 24 題 Submit 後先睇結果；提交後顯示翻譯；唔影響掌握記錄
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
| `test.js` | Exam/Practice 基本流程、多選、submit 掣 |
| `shuffle-test.js` | 408 題選項打亂後答案對應 |
| `study-test.js`、`subfilter-test.js` | Study 四個 tab、搜尋、書籤、sub-filter |
| `diff-test.js` | 難度數據完整、按難度練習、結果統計 |
| `yue-test.js`、`oy-test.js`、`yue2-test.js` | Translate 掣、選項翻譯、答案框格式（`yue2-test` 會跳去第一條有選項翻譯嘅題目，避免抽到年份題隨機失敗） |
| `mode-test.js`、`info-test.js` | 首頁 mode/tab、持久化、ⓘ popover |
| `mastery-test.js` | 掌握機制、進度顯示、兩個 reset |

## 已知限制 / 未做

- Study fact 卡片未有「跳去來源題目」（之前決定 v2 先做）
- 難度評級係靜態 rubric，未按個人答題記錄調整
- 冇 dark mode
- 測試依賴 Playwright + Chromium，repo 冇 `package.json`
- 備注嘅 `\n` 係直接寫喺 `exams.js` 字串入面，冇 markdown 解析；縮排靠空格 + `pre-wrap`
- 1.19、14.3 兩條備注係單句列舉（曼島／五位演員），未改成分行

## 主要 commit（新→舊）

```
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
- [ ] Study fact 卡片加「跳去來源題目」（v2）
- [ ] 記憶法備注同步落 `study.js` 對應 fact（目前只喺 `exams.js`）
