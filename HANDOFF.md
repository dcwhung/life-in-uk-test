# Life in the UK Test PWA — Handoff (v0.20)

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
| `data/exams.js` | 139 KB | `EXAMS`：408 題，Exam 1–17 各 24 題 |
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
- 已確認譯名：Hogmanay 霍格莫尼、Cenotaph 戰爭紀念碑、Yeoman Warders/Beefeaters 皇家衛士、Windrush 疾風號、Hung parliament 懸浮議會、first past the post 領先者當選制

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
- 答案框格式：`✓ Correct! · 🔥 n/3` → 英文答案 → `【廣東話翻譯】 Q) … A) …` → 💡 備注
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

| Suite | 覆蓋 |
|---|---|
| `test.js` | Exam/Practice 基本流程、多選、submit 掣 |
| `shuffle-test.js` | 408 題選項打亂後答案對應 |
| `study-test.js`、`subfilter-test.js` | Study 四個 tab、搜尋、書籤、sub-filter |
| `diff-test.js` | 難度數據完整、按難度練習、結果統計 |
| `yue-test.js`、`oy-test.js`、`yue2-test.js` | Translate 掣、選項翻譯、答案框格式 |
| `mode-test.js`、`info-test.js` | 首頁 mode/tab、持久化、ⓘ popover |
| `mastery-test.js` | 掌握機制、進度顯示、兩個 reset |

## 已知限制 / 未做

- Study fact 卡片未有「跳去來源題目」（之前決定 v2 先做）
- 難度評級係靜態 rubric，未按個人答題記錄調整
- 冇 dark mode
- 測試依賴 Playwright + Chromium，repo 冇 `package.json`

## 主要 commit（新→舊）

```
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

## Follow-up（新 session 填寫）

- [ ] （待定）
