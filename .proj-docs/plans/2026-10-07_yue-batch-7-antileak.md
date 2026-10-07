# T-109 廣東話口語化 — Batch 7（防洩露，常設規則 R2）

> 狀態：**提案，等用戶批准**（未改 `data/exams.js`，冇改 `APP_VERSION`）。
> 機讀版：`.proj-docs/plans/2026-10-07_yue-batch-7-antileak.json`（`qIndex` 係 0-based；下面表格「Q」係 1-based，同 content-guard 報錯一致；每條標 `decision` A1–A13、`rule: "R2"`、`severity`，額外搵到嘅標 `extra: true`）。
> 來源：CUI-0015 / review W-015；QA report `.proj-docs/qa/2026-10-07_qa_v066-yue.md` Section 6b 掃描（48 對）。
> 規則：`2026-10-07_yue-terms.md` 常設規則 **R2**（用戶 2026-10-07）：題目 `yue` 會洩露答案嗰陣，同答案有關嘅詞保留 English 原文；`oy` 同 `note` 唔改。R2 優先於譯名統一表（只限題目 `yue`）。

## 統計

| 欄位 | 改動 |
|---|---|
| yue（題目翻譯） | **13**（指定 10 + 全庫複查額外搵到 3） |
| oy | 0 |
| note | 0 |

- 13 條全部係單一 `yue` 欄位，每條只換洩露嘅詞（English 同中文之間留半形空格，跟 W1「NSPCC 係乜嘢？」先例同用戶例子）。
- 掃描（同 QA `w015Scan` 一樣嘅 heuristic）：**48 對 → 35 對**；13 條目標全部消失，冇新增任何一對。

## A. 指定個案（10 條）

| # | 題號 | English question | 正確答案（English / oy） | 改前 yue | 改後 yue | 洩露原因 |
|---|---|---|---|---|---|---|
| A1 | Exam 11 · Q4 | What other name is given to Diwali? | The Festival of Lights / 排燈節（Festival of Lights） | 排燈節（Diwali）有咩別稱？ | Diwali 有咩別稱？ | 🔴 強：「排燈節」= 答案本身，只喺正確選項出現；English Diwali vs Festival of Lights 冇重疊 |
| A2 | Exam 4 · Q12 | What is Diwali? | A Hindu festival also known as the Festival of Lights / 印度教節日，又叫排燈節（Festival of Lights） | 排燈節（Diwali）係乜嘢？ | Diwali 係乜嘢？ | 🔴 強：「排燈節」只喺正確選項出現（錯誤選項係伊斯蘭、錫克、佛教節日） |
| A3 | Exam 12 · Q12 | What is the significance of the Beefeaters? | They are Yeoman Warders who guard the Tower of London and give tours / 佢哋係守衛倫敦塔、提供導賞嘅Yeoman Warders（皇家衛士） | Beefeaters（倫敦塔衛兵）有咩重要性？ | Beefeaters 有咩重要性？ | 🟡 中：「倫敦塔」只喺正確選項出現；English Beefeaters 冇提 Tower of London（v0.65 已用「皇家衛士」洩露） |
| A4 | Exam 1 · Q8 | What is the Cenotaph? | A war memorial / 戰爭紀念碑 | 和平紀念碑（Cenotaph）係乜嘢？ | Cenotaph 係乜嘢？ | 🟡 中：「紀念碑」只喺正確選項出現（錯誤：花、教會、劇院）；English Cenotaph vs war memorial 冇重疊 |
| A5 | Exam 11 · Q9 | What is the Cenotaph? | A war memorial in Whitehall, London / 倫敦白廳嘅戰爭紀念碑 | 和平紀念碑（Cenotaph）係乜嘢？ | Cenotaph 係乜嘢？ | 🟡 中：同 A4（兩題 yue 改完繼續逐字一致） |
| A6 | Exam 3 · Q3 | How is New Year's Eve called in Scotland? | Hogmanay / Hogmanay（蘇格蘭除夕） | 蘇格蘭嘅除夕夜叫乜嘢？ | 蘇格蘭嘅 New Year's Eve 叫乜嘢？ | 🟡 中：「除夕」只喺正確選項括號出現；English New Year's Eve vs Hogmanay 冇重疊 |
| A7 | Exam 3 · Q9 | What is the name of the tour guides at the Tower of London also known as? | Beefeaters / Beefeaters（倫敦塔衛兵） | 倫敦塔導遊有乜嘢別稱？ | Tower of London 嘅導遊有乜嘢別稱？ | 🟡 中：「倫敦塔」只喺正確選項括號出現；English 答案 Beefeaters 冇 Tower |
| A8 | Exam 10 · Q21 | What was the Irish famine? | A period of mass starvation caused by potato crop failure in the 1840s / 1840年代薯仔失收造成嘅大饑荒 | 愛爾蘭大饑荒係乜嘢？ | Irish famine 係乜嘢？ | 🟢 弱（v0.66 W13 統一異體字後出現）：「大饑荒」同正確選項字面一樣；English 正確答案冇 famine（famine 反而喺錯誤選項 o[2]） |
| A9 | Exam 12 · Q17 | What charity helps elderly people? | Age UK / Age UK（長者慈善機構） | 邊個慈善機構幫助長者？ | 邊個慈善機構幫助 elderly people？ | 🟢 弱（v0.66「老年人」→「長者」後出現）：「長者」只喺正確選項括號出現 |
| A10 | Exam 17 · Q11 | What two things does the Monarch do at the State Opening of Parliament? | Reads the King's/Queen's Speech and opens the new parliamentary session / 宣讀君主演講（King's/Queen's Speech），開啟新一屆國會會期 | 君主喺國會開幕大典做邊兩件事？ | Monarch 喺國會開幕大典做邊兩件事？ | 🟢 弱（v0.66 V7 統一「君主演講」後出現）：「君主」只喺正確選項出現；English Monarch vs King's Speech 冇字面重疊 |

## B. 全庫 408 題複查額外搵到（3 條，`extra: true`）

方法：(1) 逐題睇晒 408 條 `yue` 對正確答案（`oy`，冇 oy 就 English），搵中文題目直接講出答案、而 English 題目冇講嘅；(2) 自動檢查 `yue` 有冇包含只喺正確 English 選項出現嘅英文字或者數字（只命中 Exam 13 · Q15 NHS 全名，English 縮寫本身已經係答案全名，唔算）。

| # | 題號 | English question | 正確答案（English / oy） | 改前 yue | 改後 yue | 洩露原因 |
|---|---|---|---|---|---|---|
| A11 | Exam 6 · Q14 | What is the Proms? | Annual classical music festival held at Royal Albert Hall in London / 倫敦皇家阿爾伯特音樂廳每年舉行嘅古典音樂節 | 逍遙音樂節（The Proms）係乜嘢？ | The Proms 係乜嘢？ | 🟡 中：「音樂節」只喺正確選項出現（錯誤：學校舞會、街頭嘉年華、電影節）；English Proms 冇提 music festival |
| A12 | Exam 8 · Q11 | What is the BBC Proms? | An annual 8-week classical music festival at Royal Albert Hall / 皇家阿爾伯特音樂廳每年為期8週嘅古典音樂節 | 英國廣播公司（BBC）逍遙音樂節（BBC Proms）係乜嘢？ | 英國廣播公司（BBC）嘅 Proms 係乜嘢？ | 🟡 中：同 A11（錯誤：喜劇節、體育賽事、戲劇比賽）；BBC 譯名同答案無關，保留 |
| A13 | Exam 6 · Q18 | What is the name of the highest court in the UK? | The Supreme Court / 最高法院 | 英國最高法院叫乜嘢名？ | 英國嘅 highest court 叫乜嘢名？ | 🔴 強：題目 yue 直接寫出答案「最高法院」；English「highest court」反而會令人諗 High Court（錯誤選項），唔係同樣提示 |

## C. 唔改（English 原題已有同樣提示）— 31 對

掃描仍然列出，但 English 題目同正確答案本身已經共用同一個字（或者共用詞冇鑑別力），中文冇多咗提示：

| 題號 | 共用詞 | 一句理由 |
|---|---|---|
| Exam 2 · Q13 | 君主 | English：Constitutional Monarchy → The Monarch |
| Exam 4 · Q20 | 議院 | English：House of Lords → House of Commons |
| Exam 4 · Q24 | 公爵 | English：Iron Duke → Duke of Wellington |
| Exam 5 · Q6 | 登記 | English：register → electoral register |
| Exam 6 · Q8 | 英聯邦、運動會 | English：Commonwealth Games → multi-sport event for Commonwealth countries |
| Exam 6 · Q22 | 選區 | English：constituency MP → their constituency |
| Exam 7 · Q17 | 議院 | English：House of Lords → House of Commons |
| Exam 8 · Q15 | 歐洲人 | English：European Convention → people in Europe |
| Exam 8 · Q24 | 修道院 | English：Dissolution of the Monasteries → Catholic monasteries |
| Exam 10 · Q6 | 銀行 | English：banks … closed → Bank Holidays |
| Exam 11 · Q20 | 愛丁堡 | English：Edinburgh Castle → Edinburgh |
| Exam 12 · Q14 | 質詢、首相 | English：Prime Minister's Questions → question the Prime Minister |
| Exam 12 · Q21 | 平等、人權 | English：Equality and Human Rights Commission → equality and human rights |
| Exam 13 · Q8 | 蘇格蘭議會 | English：Scottish Parliament → The Scottish Parliament |
| Exam 13 · Q10 | 君主 | English：Monarch → the monarch |
| Exam 13 · Q14 | 投票 | English：qualifications to vote → registered to vote |
| Exam 13 · Q15 | 國民保健服務 | English：NHS 縮寫本身 = National Health Service |
| Exam 13 · Q16 | 工業 | English：Industrial Revolution → industrial economy |
| Exam 14 · Q9 | 陪審團 | English：trial by jury → a trial where a panel of citizens decides（jury 即陪審團） |
| Exam 14 · Q11 | 人權 | English：Human Rights Act → Convention on Human Rights |
| Exam 14 · Q15 | 最低 | English：National Minimum Wage → minimum hourly wage |
| Exam 15 · Q16 | 服務 | English：National Citizen Service → serve their community |
| Exam 15 · Q19 | 歐洲人權 | English：European Court of Human Rights → European Convention on Human Rights |
| Exam 16 · Q14 | 世襲、貴族 | English：hereditary peers → Lords who inherit their title（同義） |
| Exam 16 · Q18 | 彭斯 | English：Robert Burns → Burns Night |
| Exam 16 · Q19 | 奴隸貿易 | English：Slave Trade Act → the slave trade（V5 已處理「廢除」） |
| Exam 17 · Q7 | 比例 | English：proportional representation → proportion of votes |
| Exam 17 · Q15 | 維京人 | English：Viking longships → Vikings invaded |
| Exam 17 · Q20 | 影響 | 「影響」係通用詞（consequences / language influences），冇鑑別力 |
| Exam 17 · Q23 | 紀念 | English：Armistice Day（停戰）→ commemorates the end of WWI；「紀念」分唔到一戰／二戰，冇鑑別力 |
| Exam 17 · Q24 | 議院 | English：House of Lords → House of Commons |

## D. 邊界個案（暫唔改，請用戶決定）— 中文標準譯名本身係描述

呢啲題目問「X 係乜嘢？」，X 嘅香港通用中文名本身已經描述咗答案，English 名冇字面提示（English 讀者靠背景知識都估到少少）。R2 嚴格套用嘅話要改；但改咗之後題目會變成好多 English，亦同 Study 嘅中文譯名唔一致。建議**唔改**，用戶話要改就跟同一做法加入下一批：

| 題號 | English question | 正確答案 oy | 而家 yue | 共用／提示 | 如果要改 |
|---|---|---|---|---|---|
| Exam 8 · Q18 | What is a referendum? | 就特定議題嘅全民投票 | 公民投票係乜嘢？ | 民投票（錯誤選項「只由國會議員投票」都有「投票」） | Referendum 係乜嘢？ |
| Exam 10 · Q11 | What does the term 'devolution' mean? | 將權力由中央轉移到地區政府 | 「權力下放」係乜嘢意思？ | 權力 | 「devolution」係乜嘢意思？ |
| Exam 12 · Q16 | What is the role of the Chancellor of the Exchequer? | 負責國家財政同經濟 | 財政大臣嘅角色係乜嘢？ | 財政 | Chancellor of the Exchequer 嘅角色係乜嘢？ |
| Exam 17 · Q10 | What was the Reformation? | 16世紀脫離天主教會、建立新教教會嘅宗教運動 | 宗教改革係乜嘢？ | 宗教（錯誤選項「經濟改革計劃」都有「改革」） | Reformation 係乜嘢？ |
| Exam 3 · Q11 | What is Eid al-Fitr? | 慶祝齋戒月結束嘅伊斯蘭節日 | 開齋節係乜嘢？ | 意思（開齋 ↔ 齋戒月結束），掃描冇捉到 | Eid al-Fitr 係乜嘢？ |
| Exam 5 · Q16 | What is Eid ul Adha? | 紀念易卜拉欣願意犧牲兒子嘅伊斯蘭節日 | 宰牲節係乜嘢？ | 意思（宰牲 ↔ 犧牲），掃描冇捉到 | Eid ul Adha 係乜嘢？ |

## 改完之後仍然有嘅提示（R2 唔改 oy，記錄俾用戶知）

- Exam 3 · Q3：題目有「蘇格蘭」（English 都有 Scotland），正確選項 oy「Hogmanay（蘇格蘭除夕）」括號仍然講咗「蘇格蘭除夕」。如果想完全冇提示，要改 oy 做「Hogmanay（霍格莫尼）」（同 Exam 9 · Q8 等題目 yue 嘅寫法一致）—— 超出 R2 範圍，要用戶決定。
- Exam 3 · Q9：題目改做「Tower of London」之後，識「倫敦塔 = Tower of London」嘅用戶仍然可以對上 oy「Beefeaters（倫敦塔衛兵）」。字面重疊已經冇，掃描唔再列出。
- Study fact #145 yue 仍然寫「逍遙音樂節（BBC Proms）」：Study 係溫習資料，唔係考題，唔受 R2 影響。

## 自我檢查（temp copy，冇改 repo data）

- 方法：`git archive HEAD` 到 scratchpad temp 目錄，用套用工具逐條核對 `before` 再寫入 temp `data/exams.js`。
- **13 / 13 `before` 吻合**；diff = 13 行（每條題目一行），只改 `yue`。
- temp copy `node tests/content-guard-test.js` → **CONTENT-GUARD PASS**。
- temp copy `tests/run-all.sh`：除咗 `upgrade-test`（temp copy 冇 git，搵唔到 v0.57 ref，屬環境問題、同 data 無關）之外全部 PASS，包括 `yue-test`、`yue2-test`、`oy-test`、`similar-test`、`study-test`。
- 掃描重跑（同 QA `w015Scan` 一樣嘅規則同 GENERIC 清單）：

| | 對數 |
|---|---|
| 改前（HEAD） | 48 |
| 改後（temp copy） | **35** |
| 13 條目標（A1–A13）仍然列出 | **0** |
| 改後新出現 | 0 |

- 改後剩低嘅 35 對 = C 節 31 對 + D 節掃描捉到嘅 4 對（Exam 8 · Q18、Exam 10 · Q11、Exam 12 · Q16、Exam 17 · Q10）；用 script 對過，冇遺漏、冇多出。D 節另外 2 條（Exam 3 · Q11、Exam 5 · Q16）係人手複查搵到、掃描捉唔到嘅意思提示。

## 等用戶決定

1. A1–A13 是否全部批准（A11–A13 係全庫複查額外搵到）。
2. A8 另一個寫法：「愛爾蘭饑荒係乜嘢？」（保留中文，「饑荒」錯誤選項 oy[2] 都有，冇鑑別力）—— 用 English「Irish famine」定呢個？
3. D 節 6 條邊界個案改唔改。
4. Exam 3 · Q3 正確選項 oy 括號「（蘇格蘭除夕）」改唔改做「（霍格莫尼）」（超出 R2）。

批准之後：套用到 `data/exams.js`，`APP_VERSION` 升版，QA 重跑 `QA_ONLY=w015,practiceSample`（W-015 expectation 要反轉）。
