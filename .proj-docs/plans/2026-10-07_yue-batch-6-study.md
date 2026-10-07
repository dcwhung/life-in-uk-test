# T-108 廣東話口語化 — Batch 6（Study facts）

> 狀態：**已批准（2026-10-07）並已套用**到 `data/study.js`（連同下面「用戶決定」U1–U16），另按決定改咗 `data/exams.js` 4 條題目／note 譯名同 11 份共用節日 note（見「Exam 跨檔譯名修正」）。
> 機讀版：`.proj-docs/plans/2026-10-07_yue-batch-6-study.json`（每條 `{ factId, field: 'yue', before, after, basis?, decision? }`；跨檔 exam 修正每條 `{ exam, qIndex（0-based）, field, optIndex?, before, after, decision, crossBatch: true }`；`basis`：`T` = 譯名統一表、`R1` = 常設規則 R1、`N` = 同已批准題目／note 文字統一；冇 `basis` = 純語感改動）。
> Style guide：沿用 `2026-10-07_yue-batch-1.md`「語感規則」1–15；譯名同常設規則 R1 跟 `2026-10-07_yue-terms.md`（Batch 1–5 決定 Y／Z／X／W／V）自動套用。
> 範圍：`data/study.js` 嘅 `STUDY` facts，**只改 `yue`**（content guard 只容許 fact `yue` 改動）。Study 搜尋本身會搜 `yue`，改動之後搜中文一樣搵到（例如搜「排燈節」、「雪墩」、「和平紀念碑」會搵到更新咗嘅 fact）。

## 統計

| 範圍 | 檢視 | 改動 |
|---|---|---|
| fact `yue` | 236 | 140 |
| exam `yue`／`note`／`oy`（跨檔譯名修正） | — | 15 |

- 原提案 136 條（純語感 84 條、譯名統一表 16 條、常設規則 R1 5 條、同已批准題目／note 統一 31 條）+ 用戶決定新增 4 條（#105、#112、#152、#154）；另有 6 條按決定改咗「改後」（#11、#48、#49、#133、#179、#203）。JSON 每條按決定標 `decision`。
- 套用後：`node tests/content-guard-test.js` → **CONTENT-GUARD PASS**；`data/exams.js` 同 `data/study.js` 再搵舊寫法（布狄卡、伍爾索普、協和飛機、千禧巨蛋、泰梅萊爾、香波洗頭、戲院區、王室珠寶、首相答問、啟蒙時代、單寫「萬聖節」指 Halloween）→ 0 條。
- Self-check：將 JSON 套落 repo 臨時副本（新寫嘅 `data/study.js` 套用工具逐條核對 `before`，每條都同現有數據完全吻合），`node tests/content-guard-test.js` → **CONTENT-GUARD PASS**；套用後再搵舊譯名（斯諾登尼亞、光明節、戰爭紀念碑做譯名、《聯合法令》、國王/女王演說、羅蒙湖 等）→ 0 條。

## 用戶決定（2026-10-07）

疑問 #1–#16 全部跟建議改法。新譯名已寫入 `2026-10-07_yue-terms.md`。

| # | 項目 | 決定 | 套用 |
|---|---|---|---|
| U1 | #105 國教 | 跟 Z4：「威爾斯同北愛爾蘭冇國教；只有英格蘭有國教（Church of England），蘇格蘭嘅 Church of Scotland 係國家教會，唔係國教。」（English `en` 受 content guard 保護，唔改） | 已改 |
| U2 | #203 漏譯 | 補「城市」：「城鎮、城市同鄉郊由民選地方議會管理…」 | 已改 |
| U3 | #126 £100 鈔票 | 保持提案（跟 W4）：「蘇格蘭同北愛爾蘭有啲銀行另外發行 £100」 | 已改（照提案） |
| U4 | Boudicca | 統一「布迪卡」：#11「Boudicca（布迪卡）」；加入譯名統一表 | 已改 |
| U5 | Woolsthorpe | 統一「烏爾斯索普」：#49「Woolsthorpe（烏爾斯索普）」；加入譯名統一表 | 已改 |
| U6 | Concorde | 統一「和諧式客機（Concorde）」：#90 已經係；Exam 3 · Q10 yue「邊兩個國家一齊研發和諧式客機（Concorde）？」；加入譯名統一表 | 已改 |
| U7 | Millennium Dome | 統一「千禧穹頂」：#154「Millennium Dome（千禧穹頂）」；加入譯名統一表 | 已改 |
| U8 | The Fighting Temeraire | 統一「戰艦無畏號」：#152「The Fighting Temeraire（戰艦無畏號）」；加入譯名統一表 | 已改 |
| U9 | shampooing | 統一「洗頭按摩」：#56 已經係；Exam 2 · Q12 note「仲引入咗shampooing（洗頭按摩）服務」；加入譯名統一表 | 已改 |
| U10 | Theatreland | 統一「劇院區（Theatreland）」：#148 已經係；Exam 11 · Q2 yue「劇院區（Theatreland）喺邊度？」；加入譯名統一表 | 已改 |
| U11 | Crown Jewels | 統一「皇冠珠寶」：#133「Crown Jewels（皇冠珠寶）」；加入譯名統一表 | 已改 |
| U12 | PMQs | 統一「首相質詢時間」：#179「首相質詢時間（Prime Minister's Questions, PMQs）」；加入譯名統一表 | 已改 |
| U13 | Halloween | 統一「萬聖節前夕」：#112「Halloween（萬聖節前夕）係 10 月 31 日。」；共用節日 note 11 份「Halloween（萬聖節前夕）」逐字一致；Exam 11 · Q23 oy[3]「蘇格蘭嘅萬聖節前夕」；加入譯名統一表 | 已改 |
| U14 | Enlightenment | 統一「啟蒙運動」：#48「Enlightenment（啟蒙運動）」；加入譯名統一表 | 已改 |
| U15 | Church of England | 保留兩種寫法：fact「英格蘭國教會」、題目「英格蘭教會」；加入譯名表「用戶決定保留」 | 冇改（已入表） |
| U16 | Citizens Advice | 保留 fact「公民諮詢局」（題目「公民諮詢（Citizen's Advice）」）；加入譯名表「用戶決定保留」 | 冇改（已入表） |

## Exam 跨檔譯名修正（`data/exams.js`，JSON 標 `crossBatch: true`）

| 題目 | 欄位 | 改前 | 改後 | 決定 |
|---|---|---|---|---|
| Exam 2 · Q12 | note | 仲引入咗shampooing（香波洗頭）服務 | 仲引入咗shampooing（洗頭按摩）服務 | U9 |
| Exam 3 · Q10 | yue | 邊兩個國家一齊研發協和飛機？ | 邊兩個國家一齊研發和諧式客機（Concorde）？ | U6 |
| Exam 11 · Q2 | yue | 戲院區（Theatreland）喺邊度？ | 劇院區（Theatreland）喺邊度？ | U10 |
| Exam 11 · Q23 | oy[3] | 蘇格蘭嘅萬聖節 | 蘇格蘭嘅萬聖節前夕 | U13 |
| Exam 2 · Q15、Q18；Exam 6 · Q17；Exam 7 · Q2；Exam 9 · Q8、Q12；Exam 10 · Q5；Exam 11 · Q23；Exam 12 · Q20；Exam 14 · Q21；Exam 16 · Q18 | note（共用節日記憶法，11 份） | 31/10 Halloween（萬聖節）； | 31/10 Halloween（萬聖節前夕）； | U13 |

## 譯名統一表（本批套用）

| Fact | 改前 | 改後 | 根據 |
|---|---|---|---|
| #45、#53 | Act of Union（聯合法案） 1707／1800 | 1707 年／1800 年《聯合法案》（Act of Union） | V3 |
| #55 | Slave Trade Act（奴隸貿易法案） 1807 | 1807 年《廢除奴隸貿易法案》（Slave Trade Act） | V5 |
| #61 | Irish famine（1840 年代） | Irish famine（愛爾蘭大饑荒）（1840 年代） | W13 |
| #76 | Battle of Britain（1940 年） | Battle of Britain（不列顛戰役）（1940 年） | Z9 |
| #96 | Good Friday Agreement（1998 年） | 《耶穌受難日協議》（Good Friday Agreement）（1998 年） | V4 |
| #110 | Diwali（光明節） | 排燈節（Diwali），又叫 Festival of Lights | Z6 |
| #115 | Remembrance Day（Armistice Day（停戰紀念日）） | Remembrance Day（國殤紀念日），又叫停戰紀念日（Armistice Day） | W11、V6 |
| #116 | Cenotaph（戰爭紀念碑） | 和平紀念碑（Cenotaph）（原寫法同句尾「戰爭紀念碑」重複） | W3 |
| #133 | Yeoman Warders（俗稱 Beefeaters） | Yeoman Warders（皇家衛士，俗稱 Beefeaters（倫敦塔衛兵）） | W9 |
| #137 | Snowdonia National Park（斯諾登尼亞國家公園）；Snowdon | Snowdonia（雪墩）國家公園；Snowdon（雪墩山） | Z1、X1 |
| #140 | （羅蒙湖與特羅薩克斯國家公園） | （洛蒙德湖及特羅薩克斯國家公園） | W14 |
| #168 | King's/Queen's Speech（國王/女王演說） | 君主演講（King's/Queen's Speech） | V7 |
| #210 | 小額錢債法庭（small claims court） | 小額錢債審裁處（small claims court） | Z10（用戶決定保留譯名） |
| #212 | 少年法庭（10–17 歲） | Youth Court（少年法庭）（10–17 歲） | V8 |
| #217 | 警察總長（Chief Constable） | 總警司（Chief Constable） | Y2（用戶決定保留譯名） |

- 已經一致、冇改：阿佛烈大帝（#15）、約翰王（#21）、安妮·博林（#27）、阿拉貢的凱瑟琳（#28，人名入面嘅「的」保留）、詹姆斯（#33、#34、#43、#84）、聖柏德烈日（#102）、盤尼西林（penicillin）（#71）、占士邦（#155，V15）。

## 常設規則 R1（官方手冊 vs 現況）套用

格式同已批准題目 note 逐字一致：先寫配合考試答案嘅講法，括號內「考試以官方手冊…為準」，再補現況。

| Fact | 加入 | 對應已批准 note |
|---|---|---|
| #38 克倫威爾 | （考試以官方手冊嘅講法為準；佢 1649 年查理一世被處決之後掌權，1653 年先正式做護國公） | Exam 15 · Q20（V11） |
| #197 選舉委員會 | （考試以呢個講法為準；實際上選民登記冊由地方議會嘅選民登記主任（Electoral Registration Officer）管理） | Exam 17 · Q12（V14） |
| #200 Senedd | （考試以官方手冊嘅60名為準；2026年選舉起增至96名） | 議會議員人數記憶法（X6 修訂） |
| #230 英聯邦 | （考試以官方手冊嘅54個為準；2022年起56個） | Exam 2 · Q20、Exam 10 · Q23（W6） |
| #231 歐洲委員會 | （考試以官方手冊嘅47個為準；2022年起46個） | Exam 9 · Q17（W5） |

- #175（世襲貴族 92 位）跟 V13：保留原意，唔加 note（只修正「Hereditary peers（世襲貴族）係世襲貴族」嘅重複）。

## 同已批准題目／note 統一（同一件事實，用返已批准講法）

| Fact | 已批准來源 | 統一嘅講法 |
|---|---|---|
| #8 | Exam 14 · Q19 note | 大約5,000年前建成 |
| #9 | Exam 6 · Q2 note | 有啲（硬幣）刻有鐵器時代國王嘅名字 |
| #10 | Exam 2 · Q10 note | 冇成功；到公元43年先由克勞狄烏斯成功佔領 |
| #13 | Exam 16 · Q4 | 羅馬人離開之後…嚟到英國 |
| #19 | Exam 6 · Q3 | 係…起嘅 |
| #23 | Exam 3 · Q5 note | 實際上打咗116年 |
| #24 | Exam 9 · Q16 note | 令英格蘭三分之一人口死亡 |
| #34 | Exam 12 · Q8（W8） | 詹姆斯一世下令翻譯 |
| #39 | Exam 13 · Q6 note | 後來叫做「皇家橡樹」（Royal Oak） |
| #44 | Exam 1 · Q7 note | 確認國會嘅權利 |
| #47 | Exam 3 · Q6 note | 攞返斯圖亞特王朝嘅王位 |
| #48 | Exam 14 · Q5 | 亞當·斯密發展咗…思想 |
| #59 | 投票權時間線 | 1832《大改革法案》（Great Reform Act） |
| #79 | Exam 13 · Q9 note | 雖然邱吉爾喺戰時聲名大噪，但係… |
| #80 | Exam 17 · Q8 note | Aneurin Bevan（安奈林·貝文）推動 |
| #94 | Exam 13 · Q11 | 柏林圍牆喺邊年倒塌 |
| #126 | Exam 9 · Q3 note（W4） | 蘇格蘭同北愛爾蘭有啲銀行另外發行£100（見疑問 3） |
| #141 | Exam 6 · Q4 note | 一共有15個 |
| #155 | Exam 15 · Q4、Exam 16 · Q5 | 最高票房電影系列之一 |
| #156 | Exam 14 · Q4 note | Tilda Swinton（蒂達·史雲頓）、都贏過奧斯卡 |
| #173 | Exam 4 · Q20 note | 唔可以否決／拒絕財政法案 |
| #174 | Exam 7 · Q21 note | 而家大部分上議院議員都係終身貴族 |
| #176 | Exam 2 · Q3 note | Lords Spiritual（神職上議院議員），一共26位 |
| #182 | Exam 5 · Q12 note | 由首相主持，大約20位資深部長組成 |
| #184 | Exam 2 · Q1 note | 負責罪案、警政同移民 |
| #192 | Exam 17 · Q7 note（V12） | 蘇格蘭議會、Senedd（威爾斯議會）同北愛爾蘭議會都用呢個制度 |
| #194 | Exam 13 · Q14 oy[1] | 係英國/愛爾蘭/英聯邦公民，而且已經登記 |
| #195 | Exam 1 · Q17 note | 投票嗰陣用 ballot paper（選票） |
| #196 | Exam 1 · Q19 | 一定要提供均衡嘅政治報道；報章唔受…限制 |
| #221、#222 | Exam 14 · Q11、Exam 15 · Q15 | 1998年《人權法》、2010年《平等法》 |

## 本批用到嘅語感規則（同 batch 1）

| 規則 | 例子 |
|---|---|
| 的 → 嘅；在／位於 → 喺 | 英國位於歐洲西北部 → 英國喺歐洲西北部 |
| 和／及／並／或 → 同／仲／或者 | 並入侵及定居英格蘭 → 仲入侵英格蘭、喺度定居；3 月或 4 月 → 3 月或者 4 月 |
| 必須／不得／不能 → 一定要／唔可以 | 必須保持政治中立 → 一定要保持政治中立；不得徵稅 → 唔可以徵稅 |
| 約／至（變動）／稱為／共 → 大約／到／叫做／一共 | 降至 21 歲 → 降到 21 歲；稱為 → 叫做；共有 15 個 → 一共有 15 個 |
| 後／時 → 之後／嗰陣 | 被處決後 → 被處決之後；去世或辭職時 → 去世或者辭職嗰陣 |
| 書面動詞 → 口語動詞 | 擊敗 → 打敗；建造 → 起；率領 → 帶領；成為 → 變成・做咗；來到 → 嚟到；撤離 → 離開；出任 → 做；奪金 → 贏咗金牌 |
| 完成貌 + 咗 | 確認 → 確認咗；燒毀 → 燒毀咗 |

結構調整：巢狀括號拆開（例如「Bonfire Night（Guy Fawkes Night（蓋伊·福克斯之夜））」→「Bonfire Night，又叫 Guy Fawkes Night（蓋伊·福克斯之夜）」）；「Hereditary peers（世襲貴族）係世襲貴族」→「…係承襲頭銜嘅貴族」；「…Tilda Swinton（Emily Watson（艾美莉·屈臣）未獲獎）」→「…同 Tilda Swinton（蒂達·史雲頓）；Emily Watson（艾美莉·屈臣）就冇贏過」。

## 第 1 章（Values & principles）

1 / 2 條改動。

| Fact | English（en，截短） | 改前 | 改後 | 根據 |
|---|---|---|---|---|
| #1 | As a British citizen or permanent resident you should: respect and ... | 作為英國公民或永久居民嘅責任：遵守法律、尊重他人權利同意見、公平待人、照顧自己同家人、照顧居住環境，同埋交稅。 | 作為英國公民或者永久居民嘅責任：遵守法律、尊重他人權利同意見、公平待人、照顧自己同家人、照顧居住環境，同埋交稅。 | 語感 |

## 第 2 章（What is the UK?）

3 / 4 條改動。

| Fact | English（en，截短） | 改前 | 改後 | 根據 |
|---|---|---|---|---|
| #4 | The Channel Islands (e.g. Jersey) and the Isle of Man are Crown dep... | Channel Islands（如 Jersey（澤西島））同 Isle of Man（曼島）係 Crown dependencies（皇家屬地）：同英國關係密切、有自己政府，但唔係英國一部分。 | Channel Islands（例如 Jersey（澤西島））同 Isle of Man（曼島）係 Crown dependencies（皇家屬地）：同英國關係密切、有自己嘅政府，但唔係英國嘅一部分。 | 語感 |
| #5 | St Helena and the Falkland Islands are British overseas territories... | St Helena（聖赫勒拿島）同 Falkland Islands（福克蘭群島）係英國海外領土：同英國有聯繫，但唔屬於英國或 Great Britain（大不列顛）。 | St Helena（聖赫勒拿島）同 Falkland Islands（福克蘭群島）係英國海外領土：同英國有聯繫，但唔屬於英國或者 Great Britain（大不列顛）。 | 語感 |
| #6 | The UK is located in the north-west of Europe. | 英國位於歐洲西北部。 | 英國喺歐洲西北部。 | 語感 |

## 第 3 章（History）

69 / 91 條改動。

| Fact | English（en，截短） | 改前 | 改後 | 根據 |
|---|---|---|---|---|
| #7 | The first farmers came to Britain about 6,000 years ago, probably f... | 第一批農民約 6,000 年前來到英國，可能來自東南歐。 | 第一批農民大約 6,000 年前嚟到英國，可能係由東南歐嚟。 | 語感 |
| #8 | Stonehenge, in Wiltshire (England), is a Stone Age monument built a... | Stonehenge（巨石陣）喺英格蘭 Wiltshire（威爾特郡），係約 5,000 年前嘅石器時代遺跡。 | Stonehenge（巨石陣）喺英格蘭 Wiltshire（威爾特郡），係大約 5,000 年前建成嘅石器時代遺跡。 | 同已批准文字統一 |
| #9 | The first coins minted in Britain were made in the Iron Age; some c... | 英國最早嘅硬幣喺鐵器時代鑄造，部分刻有鐵器時代國王嘅名。 | 英國最早嘅硬幣喺鐵器時代鑄造，有啲刻有鐵器時代國王嘅名字。 | 同已批准文字統一 |
| #10 | Julius Caesar led the first Roman invasion of Britain in 55 BC, whi... | Julius Caesar（凱撒）喺公元前 55 年帶領羅馬首次入侵英國，未成功；公元 43 年 Claudius（克勞狄烏斯）皇帝先成功佔領。 | Julius Caesar（凱撒）喺公元前 55 年帶領羅馬第一次入侵英國，冇成功；到公元 43 年先由 Claudius（克勞狄烏斯）皇帝成功佔領。 | 同已批准文字統一 |
| #11 | Boudicca, queen of the Iceni tribe, led a revolt against the Romans... | Boudicca（布狄卡）係 Iceni（愛西尼）部族女王，約公元 60 年率眾反抗羅馬人。 | Boudicca（布迪卡）係 Iceni（愛西尼）部族女王，大約公元 60 年帶領族人反抗羅馬人。 | 語感、U4 |
| #12 | Hadrian's Wall was built by the Romans (AD 122) across northern Eng... | Hadrian's Wall（哈德良長城）由羅馬人喺公元 122 年建造，橫跨英格蘭北部，標示羅馬帝國喺英國嘅北界。 | Hadrian's Wall（哈德良長城）係羅馬人喺公元 122 年起嘅，橫跨英格蘭北部，標示羅馬帝國喺英國嘅北面邊界。 | 語感 |
| #13 | The Romans left Britain in AD 410. Tribes from northern Europe — th... | 羅馬人喺公元 410 年撤離英國，之後北歐部族 Jutes（朱特人）、Angles（盎格魯人）同 Saxons（撒克遜人）移居英國。 | 羅馬人喺公元 410 年離開英國，之後北歐嘅部族 Jutes（朱特人）、Angles（盎格魯人）同 Saxons（撒克遜人）嚟到英國定居。 | 同已批准文字統一 |
| #14 | The Vikings came from Denmark and Norway in the 9th and 10th centur... | Vikings（維京人）喺 9 至 10 世紀由丹麥同挪威而來，用 longships（長船）貿易同掠奪，並入侵及定居英格蘭。 | Vikings（維京人）喺 9 至 10 世紀由丹麥同挪威嚟，用 longships（長船）做貿易同搶掠，仲入侵英格蘭、喺度定居。 | 語感 |
| #16 | In 1066 William, Duke of Normandy (the Normans were descendants of ... | 1066 年 Normandy（諾曼第）公爵 William（Normans 係定居法國北部嘅 Viking 後裔）喺 Battle of Hastings（黑斯廷斯戰役）打敗 King Harold（哈羅德國王），史稱 Norman Conquest（諾曼征服）。 | 1066 年 Normandy（諾曼第）公爵 William（Normans 係定居法國北部嘅 Viking 後裔）喺 Battle of Hastings（黑斯廷斯戰役）打敗 King Harold（哈羅德國王），呢件事叫做 Norman Conquest（諾曼征服）。 | 語感 |
| #19 | The Tower of London was built by William the Conqueror after the No... | Tower of London（倫敦塔）由 William the Conqueror（征服者威廉）喺 Norman Conquest（諾曼征服）後建造。 | Tower of London（倫敦塔）係 William the Conqueror（征服者威廉）喺 Norman Conquest（諾曼征服）之後起嘅。 | 同已批准文字統一 |
| #20 | The Domesday Book (1086), commissioned by William the Conqueror, wa... | Domesday Book（1086 年）由 William the Conqueror（征服者威廉）下令編製，記錄英格蘭土地同財產嘅擁有者。 | Domesday Book（1086 年）由 William the Conqueror（征服者威廉）下令編製，記錄英格蘭嘅土地同財產由邊個擁有。 | 語感 |
| #22 | In 1314 the Scots, led by Robert the Bruce, defeated the English at... | 1314 年 Robert the Bruce（羅伯特·布魯斯）率領蘇格蘭人喺 Battle of Bannockburn（班諾克本戰役）打敗英格蘭，蘇格蘭保持獨立。 | 1314 年 Robert the Bruce（羅伯特·布魯斯）帶領蘇格蘭人喺 Battle of Bannockburn（班諾克本戰役）打敗英格蘭人，蘇格蘭保持獨立。 | 語感 |
| #23 | The Hundred Years War between England and France (1337–1453) actual... | Hundred Years War（百年戰爭）係英格蘭同法國之間嘅戰爭（1337–1453），實際持續 116 年。 | Hundred Years War（百年戰爭）係英格蘭同法國之間嘅戰爭（1337–1453），實際上打咗 116 年。 | 同已批准文字統一 |
| #24 | The Black Death, a plague, arrived in England in 1348 and killed ab... | Black Death（黑死病）1348 年傳入英格蘭，約三分之一人口死亡。 | Black Death（黑死病）1348 年傳入英格蘭，令大約三分之一人口死亡。 | 同已批准文字統一 |
| #26 | The Wars of the Roses (1455–1485) were fought between the House of ... | Wars of the Roses（1455–1485）係 House of York（約克家族）同 House of Lancaster（蘭開斯特家族）之間嘅內戰，最後 Henry VII（都鐸王朝）勝出並統一兩家。 | Wars of the Roses（1455–1485）係 House of York（約克家族）同 House of Lancaster（蘭開斯特家族）之間嘅內戰，最後 Henry VII（都鐸王朝）贏咗，統一兩個家族。 | 語感 |
| #28 | The Reformation was a 16th-century movement that broke from the Cat... | Reformation（宗教改革）係 16 世紀脫離天主教會嘅運動。Henry VIII（亨利八世）因教宗唔准佢同第一任妻子 Catherine of Aragon（阿拉貢的凱瑟琳）離婚，於 1534 年成立 Church of England（英格蘭國教會）。 | Reformation（宗教改革）係 16 世紀脫離天主教會嘅運動。Henry VIII（亨利八世）因為教宗唔准佢同第一任妻子 Catherine of Aragon（阿拉貢的凱瑟琳）離婚，喺 1534 年成立 Church of England（英格蘭國教會）。 | 語感 |
| #29 | During the Reformation, Henry VIII closed the Catholic monasteries ... | Reformation（宗教改革）期間 Henry VIII（亨利八世）關閉天主教修道院並沒收財產，稱為 Dissolution of the Monasteries（解散修道院）。 | Reformation（宗教改革）期間 Henry VIII（亨利八世）關閉天主教修道院，沒收佢哋嘅財產，叫做 Dissolution of the Monasteries（解散修道院）。 | 語感 |
| #30 | Elizabeth I (reigned 1558–1603), daughter of Henry VIII, was a Prot... | Elizabeth I（1558–1603 在位）係 Henry VIII（亨利八世）嘅女兒，新教女王。1588 年英格蘭擊敗西班牙無敵艦隊（Spanish Armada）。 | Elizabeth I（伊利沙伯一世，1558–1603 在位）係 Henry VIII（亨利八世）嘅女兒，係新教女王。1588 年英格蘭打敗西班牙無敵艦隊（Spanish Armada）。 | 語感 |
| #34 | The version of the Bible created under King James I (1611) is known... | King James I（詹姆斯一世國王）主持翻譯嘅聖經（1611 年）稱為 Authorised Version（欽定版聖經），又叫 King James Bible（詹姆斯王聖經）。 | King James I（詹姆斯一世國王）下令翻譯嘅聖經（1611 年）叫做 Authorised Version（欽定版聖經），又叫 King James Bible（詹姆斯王聖經）。 | 同已批准文字統一 |
| #35 | The Petition of Right (1628) confirmed that the King could not rais... | Petition of Right（1628 年）確認國王未經國會同意不得徵稅。 | Petition of Right（1628 年）確認咗國王未經國會同意唔可以徵稅。 | 語感 |
| #36 | The English Civil War (1642–1651) was fought between Parliament and... | English Civil War（1642–1651）係國會同 King Charles I（查理一世國王）爭奪權力嘅內戰，Charles I 最終被處決。 | English Civil War（1642–1651）係國會同 King Charles I（查理一世國王）爭奪權力嘅內戰，Charles I 最後被處決。 | 語感 |
| #37 | After Charles I was executed in 1649, England was declared a republ... | 1649 年 Charles I（查理一世）被處決後，英格蘭成為共和國（Commonwealth），係唯一冇君主統治嘅時期。 | 1649 年 Charles I（查理一世）被處決之後，英格蘭變成共和國（Commonwealth），係唯一一段冇君主統治嘅時期。 | 語感 |
| #38 | Oliver Cromwell led the Parliamentarians in the Civil War and was g... | Oliver Cromwell（克倫威爾）係內戰中國會派領袖，獲封 Lord Protector（1649–1658）。 | Oliver Cromwell（克倫威爾）係內戰入面國會派嘅領袖，獲封 Lord Protector（護國公），年份係 1649–1658（考試以官方手冊嘅講法為準；佢 1649 年查理一世被處決之後掌權，1653 年先正式做護國公）。 | R1 |
| #39 | After his defeat in the Civil War, Charles II escaped to Europe, fa... | Charles II（查理二世）內戰失敗後逃往歐洲，曾匿喺一棵橡樹入面（「Royal Oak」）。 | Charles II（查理二世）內戰失敗之後逃去歐洲，曾經匿埋喺一棵橡樹度，嗰棵樹後來叫做「皇家橡樹」（Royal Oak）。 | 同已批准文字統一 |
| #40 | The Great Fire of London (1666), during the reign of Charles II, de... | Great Fire of London（1666 年）發生喺 Charles II（查理二世）年代，燒毀大部分倫敦市區，包括 St Paul's Cathedral（聖保羅大教堂）。 | Great Fire of London（倫敦大火）（1666 年）喺 Charles II（查理二世）年代發生，燒毀咗倫敦大部分市區，包括 St Paul's Cathedral（聖保羅大教堂）。 | 語感 |
| #42 | Sir Christopher Wren was the architect of St Paul's Cathedral, rebu... | Sir Christopher Wren（基斯杜化·雷恩爵士）係 St Paul's Cathedral（聖保羅大教堂）嘅建築師，大火後重建。 | Sir Christopher Wren（基斯杜化·雷恩爵士）係 St Paul's Cathedral（聖保羅大教堂）嘅建築師，教堂喺倫敦大火之後重建。 | 語感 |
| #43 | In the Glorious Revolution (1688) James II was peacefully replaced ... | Glorious Revolution（1688 年）James II（詹姆斯二世）被 William of Orange（奧蘭治的威廉）和平取代，奠定君主立憲制。 | Glorious Revolution（1688 年）：James II（詹姆斯二世）被 William of Orange（奧蘭治的威廉）和平取代，奠定君主立憲制。 | 語感 |
| #44 | The Bill of Rights (1689) limited the power of the King and confirm... | Bill of Rights（1689 年）限制國王權力、確認國會權利，並冇賦予任何人投票權。 | Bill of Rights（1689 年）限制國王權力、確認國會嘅權利，冇俾任何人投票權。 | 同已批准文字統一 |
| #45 | The Act of Union 1707 united the Parliaments of England and Scotlan... | Act of Union（聯合法案） 1707 合併英格蘭同蘇格蘭國會，成立 Kingdom of Great Britain（大不列顛王國）。 | 1707 年《聯合法案》（Act of Union）合併咗英格蘭同蘇格蘭國會，成立 Kingdom of Great Britain（大不列顛王國）。 | 譯名表 |
| #47 | In 1745 Bonnie Prince Charlie (Charles Edward Stuart) raised an arm... | 1745 年 Bonnie Prince Charlie（Charles Edward Stuart）召集蘇格蘭高地氏族起兵，企圖為 Stuart（斯圖亞特）王朝奪回王位，1746 年喺 Culloden（卡洛登）戰敗。 | 1745 年 Bonnie Prince Charlie（Charles Edward Stuart）召集蘇格蘭高地氏族起兵，想幫 Stuart（斯圖亞特）王朝攞返王位，1746 年喺 Culloden（卡洛登）戰敗。 | 同已批准文字統一 |
| #48 | The Enlightenment was an 18th-century period when new ideas about p... | Enlightenment（啟蒙時代）係 18 世紀政治、哲學同科學新思想蓬勃嘅時期；Adam Smith（亞當·斯密）提出經濟學理論。 | Enlightenment（啟蒙運動）係 18 世紀政治、哲學同科學新思想蓬勃發展嘅時期；Adam Smith（亞當·斯密）發展咗經濟學嘅思想。 | 同已批准文字統一、U14 |
| #49 | Isaac Newton, born in Woolsthorpe, Lincolnshire, discovered the law... | Isaac Newton（牛頓）喺 Lincolnshire（林肯郡）嘅 Woolsthorpe（伍爾索普）出生，發現萬有引力同運動定律，後來出任 Royal Mint（皇家鑄幣廠）嘅 Warden（監督）同 Master（總監）。 | Isaac Newton（牛頓）喺 Lincolnshire（林肯郡）嘅 Woolsthorpe（烏爾斯索普）出世，發現萬有引力同運動定律，後來做過 Royal Mint（皇家鑄幣廠）嘅 Warden（監督）同 Master（總監）。 | 語感、U5 |
| #51 | The Industrial Revolution (18th–19th century) transformed Britain f... | Industrial Revolution（18–19 世紀）令英國由農業經濟轉為工業經濟，城市急速發展；18 世紀製造業成為最大就業來源。 | Industrial Revolution（18–19 世紀）令英國由農業經濟變成工業經濟，城市急速發展；18 世紀製造業變成最大嘅就業來源。 | 語感 |
| #53 | The Act of Union 1800 united Great Britain and Ireland, creating th... | Act of Union（聯合法案） 1800 合併 Great Britain 同 Ireland，成立 United Kingdom of Great Britain and Ireland（大不列顛及愛爾蘭聯合王國）。 | 1800 年《聯合法案》（Act of Union）合併咗 Great Britain 同 Ireland，成立 United Kingdom of Great Britain and Ireland（大不列顛及愛爾蘭聯合王國）。 | 譯名表 |
| #54 | At the Battle of Trafalgar (1805) Admiral Nelson commanded the Brit... | Battle of Trafalgar（1805 年）Admiral Nelson（納爾遜上將）指揮英國艦隊擊敗法國同西班牙艦隊，本人陣亡。 | 1805 年 Battle of Trafalgar（特拉法加海戰）入面，Admiral Nelson（納爾遜上將）指揮英國艦隊打敗法國同西班牙艦隊，佢自己就陣亡。 | 語感 |
| #55 | The Slave Trade Act 1807 abolished the slave trade in the British E... | Slave Trade Act（奴隸貿易法案） 1807 廢除大英帝國嘅奴隸貿易，由國會議員 William Wilberforce（威廉·威伯福斯）推動。 | 1807 年《廢除奴隸貿易法案》（Slave Trade Act）廢除咗大英帝國嘅奴隸貿易，由國會議員 William Wilberforce（威廉·威伯福斯）推動。 | 譯名表 |
| #56 | Sake Dean Mahomet opened Britain's first curry house in London (aro... | Sake Dean Mahomet（薩克·迪恩·馬霍梅特）約 1810 年喺倫敦開設英國第一間咖喱屋，並引入 shampooing（洗頭按摩）。 | Sake Dean Mahomet（薩克·迪恩·馬霍梅特）大約 1810 年喺倫敦開咗英國第一間咖喱屋，仲將 shampooing（洗頭按摩）引入英國。 | 語感、U9 |
| #57 | At the Battle of Waterloo (1815) the Duke of Wellington ("the Iron ... | Battle of Waterloo（1815 年）Duke of Wellington（「Iron Duke（鐵公爵）」）打敗拿破崙，係英法之間最後一場戰役；Wellington（威靈頓）後來出任首相。 | 1815 年 Battle of Waterloo（滑鐵盧戰役）入面，Duke of Wellington（威靈頓公爵，「Iron Duke（鐵公爵）」）打敗拿破崙，係英法之間最後一場戰役；威靈頓後來做咗首相。 | 語感 |
| #58 | Isambard Kingdom Brunel was a famous Victorian engineer who built b... | Isambard Kingdom Brunel（布魯內爾）係維多利亞時代著名工程師，建造橋樑、隧道、鐵路同船隻。 | Isambard Kingdom Brunel（布魯內爾）係維多利亞時代著名工程師，起咗好多橋樑、隧道、鐵路同船隻。 | 語感 |
| #59 | The Great Reform Act 1832 extended the right to vote (to more of th... | Great Reform Act（大改革法案） 1832 擴大投票權（惠及中產階級）。 | 1832 年《大改革法案》（Great Reform Act）擴大咗投票權（令更多中產階級有票）。 | 同已批准文字統一 |
| #60 | The Chartists (mid-19th century) campaigned for political reform, i... | Chartists（19 世紀中）爭取政治改革，包括所有男性都有投票權。 | Chartists（19 世紀中葉）爭取政治改革，包括所有男性都有投票權。 | 語感 |
| #61 | The Irish famine (1840s) was caused by the failure of the potato cr... | Irish famine（1840 年代）因薯仔失收造成，約 100 萬人死亡，另有約 100 萬人移民。 | Irish famine（愛爾蘭大饑荒）（1840 年代）係因為薯仔失收造成，大約 100 萬人死亡，另外有大約 100 萬人移民。 | 譯名表 |
| #62 | Florence Nightingale, a pioneer of modern nursing, improved hospita... | Florence Nightingale（南丁格爾）係現代護理先驅，喺 Crimean War（1853–1856）期間改善醫院環境。 | Florence Nightingale（南丁格爾）係現代護理先驅，喺 Crimean War（1853–1856）期間改善咗醫院環境。 | 語感 |
| #63 | The Boer War (1899–1902) was fought in South Africa between the Bri... | Boer War（1899–1902）喺南非爆發，英國對抗布爾人（Boer）移民。 | Boer War（1899–1902）喺南非發生，係英國同布爾人（Boer）移民之間嘅戰爭。 | 語感 |
| #65 | The First World War (1914–1918) was triggered by the assassination ... | 第一次世界大戰（1914–1918）因 Archduke Franz Ferdinand（斐迪南大公）被刺殺同複雜嘅同盟關係而爆發。 | 第一次世界大戰（1914–1918）因為 Archduke Franz Ferdinand（斐迪南大公）被刺殺，加上複雜嘅同盟關係而爆發。 | 語感 |
| #66 | The Battle of the Somme (1916) was one of the bloodiest battles of ... | Battle of the Somme（1916 年）係一戰最血腥嘅戰役之一，第一日就有約 20,000 名英軍陣亡。 | Battle of the Somme（1916 年）係一戰最血腥嘅戰役之一，第一日就有大約 20,000 名英軍陣亡。 | 語感 |
| #68 | In 1918 women over 30 were given the right to vote, in recognition ... | 1918 年 30 歲以上女性獲得投票權，以表揚佢哋喺一戰嘅貢獻。 | 1918 年 30 歲以上嘅女性有咗投票權，係表揚佢哋喺一戰嘅貢獻。 | 語感 |
| #69 | In 1928 women were given the right to vote at 21, the same age as men. | 1928 年女性投票年齡降至 21 歲，同男性一樣。 | 1928 年女性投票年齡降到 21 歲，同男性一樣。 | 語感 |
| #70 | In 1969 the voting age was lowered to 18 for both men and women. | 1969 年男女投票年齡一同降至 18 歲。 | 1969 年男女投票年齡一齊降到 18 歲。 | 語感 |
| #73 | The Second World War began in 1939 when Germany invaded Poland; Bri... | 第二次世界大戰 1939 年因德國入侵波蘭而爆發，英法隨即向德國宣戰。 | 第二次世界大戰喺 1939 年因為德國入侵波蘭而爆發，英法跟住向德國宣戰。 | 語感 |
| #74 | Winston Churchill was Prime Minister during WWII (1940–1945, and ag... | Winston Churchill（邱吉爾）係二戰時期首相（1940–1945，1951–1955 再任），以鼓舞人心嘅演說聞名。 | Winston Churchill（邱吉爾）係二戰時期嘅首相（1940–1945，1951–1955 再做），以鼓舞人心嘅演說聞名。 | 語感 |
| #76 | The Battle of Britain (1940) was the crucial aerial battle in which... | Battle of Britain（1940 年）係關鍵空戰，英國成功抵禦德國空襲，阻止入侵。 | Battle of Britain（不列顛戰役）（1940 年）係關鍵嘅空戰，英國成功抵禦德國空襲，阻止咗德國入侵。 | 譯名表 |
| #77 | During the Blitz (1940–1941) Germany bombed British cities, especia... | Blitz（1940–1941）期間德國轟炸英國城市，尤其倫敦。 | Blitz（1940–1941）期間，德國轟炸英國城市，尤其係倫敦。 | 語感 |
| #78 | The Second World War ended in 1945: VE Day (Europe) on 8th May and ... | 第二次世界大戰 1945 年結束：歐洲 5 月 8 日（歐洲勝利日 VE Day），日本 8 月 15 日（對日勝利日 VJ Day）。 | 第二次世界大戰喺 1945 年結束：歐洲係 5 月 8 日（歐洲勝利日 VE Day），日本係 8 月 15 日（對日勝利日 VJ Day）。 | 語感 |
| #79 | The Labour Party under Clement Attlee won the 1945 general election... | 1945 年大選由 Clement Attlee（艾德禮）領導嘅工黨勝出，儘管 Churchill（邱吉爾）戰時聲望極高。 | 雖然 Churchill（邱吉爾）喺戰時聲望好高，但係 1945 年大選由 Clement Attlee（艾德禮）帶領嘅工黨贏咗。 | 同已批准文字統一 |
| #80 | The National Health Service (NHS) was founded in 1948 by the Labour... | 國民保健服務（National Health Service, NHS）喺 1948 年由工黨政府（Aneurin Bevan 推動）成立，為所有英國居民提供免費醫療。 | 國民保健服務（National Health Service, NHS）喺 1948 年由工黨政府成立（Aneurin Bevan（安奈林·貝文）推動），所有英國居民使用嗰陣都係免費。 | 同已批准文字統一 |
| #81 | After WWII the Labour government built the Welfare State: a system ... | 二戰後工黨政府建立 Welfare State（福利國家），提供社會保障、醫療同教育。 | 二戰之後工黨政府建立咗 Welfare State（福利國家），提供社會保障、醫療同教育。 | 語感 |
| #82 | The Windrush Generation were Caribbean immigrants who came to the U... | Windrush Generation（疾風世代）係二戰後（1948 年起）由加勒比海移居英國嘅移民。 | Windrush Generation（疾風世代）係二戰之後（1948 年起）由加勒比海移居英國嘅移民。 | 語感 |
| #83 | Ireland became a republic in 1949. | 愛爾蘭喺 1949 年成為共和國。 | 愛爾蘭喺 1949 年變成共和國。 | 語感 |
| #85 | Edmund Hillary and Tenzing Norgay were the first to climb Mount Eve... | Edmund Hillary（艾德蒙·希拉里）同 Tenzing Norgay（丹增·諾蓋）喺 1953 年隨英國探險隊首次登上珠穆朗瑪峰。 | Edmund Hillary（艾德蒙·希拉里）同 Tenzing Norgay（丹增·諾蓋）喺 1953 年跟英國探險隊第一次登上珠穆朗瑪峰。 | 語感 |
| #86 | Roger Bannister was the first person to run a mile in under four mi... | Roger Bannister（羅傑·班尼斯特）喺 1954 年成為首位 4 分鐘內跑完 1 英里嘅人。 | Roger Bannister（羅傑·班尼斯特）喺 1954 年做咗第一個喺 4 分鐘內跑完 1 英里嘅人。 | 語感 |
| #88 | Bobby Moore captained the England football team that won the World ... | Bobby Moore（波比·摩亞）係 1966 年奪得世界盃嘅英格蘭足球隊隊長。 | Bobby Moore（波比·摩亞）係 1966 年贏世界盃嘅英格蘭足球隊隊長。 | 語感 |
| #89 | Neil Armstrong was the first person to walk on the moon (1969, Apol... | Neil Armstrong（岩士唐）喺 1969 年（Apollo 11）成為首位登月嘅人。 | Neil Armstrong（岩士唐）喺 1969 年（Apollo 11）做咗第一個踏上月球嘅人。 | 語感 |
| #90 | Concorde, the supersonic passenger aircraft, was developed by Brita... | Concorde（和諧式客機）超音速客機由英國同法國共同研發。 | Concorde（和諧式客機）係英國同法國一齊研發嘅超音速客機。 | 語感、U6 |
| #91 | The UK joined the European Community (now the EU) in 1973, and left... | 英國 1973 年加入歐洲共同體（現歐盟），2020 年脫歐。 | 英國喺 1973 年加入歐洲共同體（即係而家嘅歐盟），2020 年脫歐。 | 語感 |
| #92 | Margaret Thatcher was the first female Prime Minister (1979–1990) a... | Margaret Thatcher（戴卓爾夫人）係首位女首相（1979–1990），亦係 20 世紀任期最長嘅首相。 | Margaret Thatcher（戴卓爾夫人）係第一位女首相（1979–1990），都係 20 世紀任期最長嘅首相。 | 語感 |
| #93 | Jayne Torvill and Christopher Dean won Olympic gold in ice dancing ... | Jayne Torvill（珍·托維爾）同 Christopher Dean（基斯杜化·迪恩）喺 1984 年奧運冰上舞蹈奪金。 | Jayne Torvill（珍·托維爾）同 Christopher Dean（基斯杜化·迪恩）贏咗 1984 年奧運冰上舞蹈金牌。 | 語感 |
| #94 | The Berlin Wall fell in 1989, marking the end of the Cold War. | 柏林圍牆 1989 年倒下，象徵冷戰結束。 | 柏林圍牆喺 1989 年倒塌，象徵冷戰結束。 | 同已批准文字統一 |
| #96 | The Good Friday Agreement (1998) brought peace to Northern Ireland ... | Good Friday Agreement（1998 年）為北愛爾蘭帶來和平，結束數十年衝突。 | 《耶穌受難日協議》（Good Friday Agreement）（1998 年）為北愛爾蘭帶嚟和平，結束咗幾十年嘅衝突。 | 譯名表 |

## 第 4 章（Modern society）

24 / 68 條改動。

| Fact | English（en，截短） | 改前 | 改後 | 根據 |
|---|---|---|---|---|
| #103 | The Church of England is the established Protestant church of Engla... | Church of England（英格蘭國教會）係英格蘭嘅國教（新教），由 Henry VIII（亨利八世）創立。君主係其元首，Archbishop of Canterbury（坎特伯雷大主教）係精神領袖。 | Church of England（英格蘭國教會）係英格蘭嘅國教（新教），由 Henry VIII（亨利八世）創立。君主係佢嘅最高領袖，Archbishop of Canterbury（坎特伯雷大主教）係精神領袖。 | 語感 |
| #105 | Wales and Northern Ireland do NOT have an established church; only ... | 威爾斯同北愛爾蘭冇國教，只有英格蘭同蘇格蘭有。 | 威爾斯同北愛爾蘭冇國教；只有英格蘭有國教（Church of England），蘇格蘭嘅 Church of Scotland 係國家教會，唔係國教。 | U1 |
| #106 | Easter takes place in March or April. Lent is the 40 days before Ea... | Easter（復活節）喺 3 月或 4 月；Lent（大齋期）係 Easter 前嘅 40 日。 | Easter（復活節）喺 3 月或者 4 月；Lent（大齋期）係 Easter 之前嘅 40 日。 | 語感 |
| #107 | Boxing Day is 26th December, the day after Christmas Day, and is a ... | Boxing Day（節禮日）係 12 月 26 日（聖誕翌日），係公眾假期。 | Boxing Day（節禮日）係 12 月 26 日（聖誕節後一日），係公眾假期。 | 語感 |
| #110 | Diwali, the Festival of Lights, is celebrated by Hindus and Sikhs. | Diwali（光明節）由印度教徒同錫克教徒慶祝。 | 排燈節（Diwali），又叫 Festival of Lights，係印度教徒同錫克教徒慶祝嘅節日。 | 譯名表 |
| #112 | Halloween is on 31st October. | Halloween（萬聖節）係 10 月 31 日。 | Halloween（萬聖節前夕）係 10 月 31 日。 | T、U13 |
| #113 | Bonfire Night (Guy Fawkes Night) on 5th November commemorates the f... | Bonfire Night（Guy Fawkes Night（蓋伊·福克斯之夜））11 月 5 日，紀念 1605 年 Gunpowder Plot（火藥陰謀）失敗。 | Bonfire Night，又叫 Guy Fawkes Night（蓋伊·福克斯之夜），喺 11 月 5 日，紀念 1605 年 Gunpowder Plot（火藥陰謀）失敗。 | 語感 |
| #114 | Hogmanay is the Scottish name for New Year's Eve (31st December). | Hogmanay（霍格莫尼）係蘇格蘭對除夕（12 月 31 日）嘅稱呼。 | Hogmanay（霍格莫尼）係蘇格蘭人對除夕（12 月 31 日）嘅叫法。 | 語感 |
| #115 | Remembrance Day (Armistice Day), 11th November, commemorates the en... | Remembrance Day（Armistice Day（停戰紀念日））11 月 11 日，紀念 1918 年一戰結束同戰爭死難者，人們佩戴紅色罌粟花。 | Remembrance Day（國殤紀念日），又叫停戰紀念日（Armistice Day），喺 11 月 11 日，紀念 1918 年一戰結束同埋喺戰爭入面死去嘅人；大家會戴紅色罌粟花。 | 譯名表 |
| #116 | The Cenotaph is a war memorial in Whitehall, London, where the Reme... | Cenotaph（戰爭紀念碑）係倫敦 Whitehall（白廳）嘅戰爭紀念碑，Remembrance Day（國殤紀念日）儀式喺呢度舉行。 | 和平紀念碑（Cenotaph）係倫敦 Whitehall（白廳）嘅戰爭紀念碑，Remembrance Day（國殤紀念日）嘅紀念儀式喺呢度舉行。 | 譯名表 |
| #123 | Welsh is spoken in Wales alongside English. | 威爾斯除英文外亦講威爾斯語（Welsh）。 | 威爾斯除咗英文，仲講威爾斯語（Welsh）。 | 語感 |
| #126 | The highest-value note in England is £50 (Scottish banks issue £100... | 英格蘭最高面值紙幣係 £50（蘇格蘭銀行有 £100）。蘇格蘭同北愛爾蘭有自己嘅紙幣，全英國通用。 | 英格蘭最高面值嘅紙幣係 £50（蘇格蘭同北愛爾蘭有啲銀行另外發行 £100）。蘇格蘭同北愛爾蘭有自己嘅紙幣，全英國通用。 | 同已批准文字統一、U3 |
| #133 | The Tower of London is guarded by the Yeoman Warders, known as Beef... | Tower of London（倫敦塔）由 Yeoman Warders（俗稱 Beefeaters）守衛及導賞；加冕用嘅 Crown Jewels（王室珠寶）亦存放喺度。 | Tower of London（倫敦塔）由 Yeoman Warders（皇家衛士，俗稱 Beefeaters（倫敦塔衛兵））守衛同埋做導賞；加冕用嘅 Crown Jewels（皇冠珠寶）都存放喺度。 | 譯名表、U11 |
| #135 | The Giant's Causeway is in Northern Ireland: basalt columns formed ... | Giant's Causeway（巨人堤道）喺北愛爾蘭，係約 5,000 萬年前火山熔岩形成嘅玄武岩柱。 | Giant's Causeway（巨人堤道）喺北愛爾蘭，係大約 5,000 萬年前火山熔岩形成嘅玄武岩柱。 | 語感 |
| #137 | Snowdonia National Park is in Wales; Snowdon is the highest mountai... | Snowdonia National Park（斯諾登尼亞國家公園）喺威爾斯；Snowdon 係威爾斯最高山。 | Snowdonia（雪墩）國家公園喺威爾斯；Snowdon（雪墩山）係威爾斯最高嘅山。 | 譯名表 |
| #140 | Loch Lomond and the Trossachs National Park is in Scotland. | Loch Lomond and the Trossachs National Park（羅蒙湖與特羅薩克斯國家公園）喺蘇格蘭。 | Loch Lomond and the Trossachs National Park（洛蒙德湖及特羅薩克斯國家公園）喺蘇格蘭。 | 譯名表 |
| #141 | National Parks are areas of protected countryside; there are 15 in ... | National Parks（國家公園）係受保護嘅鄉郊地區，英格蘭、威爾斯同蘇格蘭共有 15 個。 | National Parks（國家公園）係受保護嘅鄉郊地區，英格蘭、威爾斯同蘇格蘭一共有 15 個。 | 同已批准文字統一 |
| #145 | The BBC Proms is an annual eight-week classical music festival held... | 英國廣播公司（BBC）逍遙音樂節（BBC Proms）係每年為期 8 週嘅古典音樂節，喺倫敦 Royal Albert Hall（皇家阿爾伯特音樂廳）舉行。 | 英國廣播公司（BBC）逍遙音樂節（BBC Proms）係每年為期 8 個星期嘅古典音樂節，喺倫敦 Royal Albert Hall（皇家阿爾伯特音樂廳）舉行。 | 語感 |
| #148 | London's West End is known as Theatreland. | 倫敦 West End（西區）被稱為 Theatreland（劇院區）。 | 倫敦 West End（西區）叫做 Theatreland（劇院區）。 | 語感、U10 |
| #152 | J.M.W. Turner, a famous British landscape painter, painted 'The Fig... | 英國著名風景畫家 J.M.W. Turner（透納）畫咗 The Fighting Temeraire（戰鬥的泰梅萊爾號）。 | 英國著名風景畫家 J.M.W. Turner（透納）畫咗 The Fighting Temeraire（戰艦無畏號）。 | T、U8 |
| #154 | Richard Rogers was the architect of the Millennium Dome. | Richard Rogers（理查德·羅傑斯）係 Millennium Dome（千禧巨蛋）嘅建築師。 | Richard Rogers（理查德·羅傑斯）係 Millennium Dome（千禧穹頂）嘅建築師。 | T、U7 |
| #155 | Harry Potter and James Bond are two of the highest-grossing film fr... | Harry Potter（哈利波特）同 James Bond（占士邦）係英國製作、最高票房嘅電影系列。 | Harry Potter（哈利波特）同 James Bond（占士邦）都係英國製作、最高票房嘅電影系列之一。 | 同已批准文字統一 |
| #156 | British actors who have won Oscars include Colin Firth, Anthony Hop... | 曾獲奧斯卡嘅英國演員包括 Colin Firth（哥連·費夫）、Anthony Hopkins（安東尼·鶴健士）、Judi Dench（茱迪·丹芝）、Kate Winslet（琦·溫絲莉）、Tilda Swinton（Emily Watson（艾美莉·屈臣）未獲獎）。 | 贏過奧斯卡嘅英國演員包括 Colin Firth（哥連·費夫）、Anthony Hopkins（安東尼·鶴健士）、Judi Dench（茱迪·丹芝）、Kate Winslet（琦·溫絲莉）同 Tilda Swinton（蒂達·史雲頓）；Emily Watson（艾美莉·屈臣）就冇贏過。 | 同已批准文字統一 |
| #158 | The National Lottery (launched 1994) raises money for good causes i... | National Lottery（1994 年推出）為藝術、體育同文化遺產等公益事業籌款。 | National Lottery（1994 年推出）幫藝術、體育同文化遺產等公益事業籌款。 | 語感 |

## 第 5 章（Government & law）

43 / 71 條改動。

| Fact | English（en，截短） | 改前 | 改後 | 根據 |
|---|---|---|---|---|
| #166 | The Monarch is the ceremonial head of state, signs legislation but ... | 君主係禮儀性國家元首，簽署法例但按首相建議行事，必須保持政治中立。 | 君主係禮儀性國家元首，簽署法例但按首相建議行事，一定要保持政治中立。 | 語感 |
| #167 | The Monarch appoints the Prime Minister: by convention, the leader ... | 君主任命首相，慣例上係下議院議席最多政黨嘅領袖。 | 君主任命首相：按慣例係下議院議席最多嘅政黨嘅領袖。 | 語感 |
| #168 | At the State Opening of Parliament the Monarch opens the new sessio... | 國會開幕大典上君主宣布新會期開始並宣讀 King's/Queen's Speech（國王/女王演說），內容係政府立法計劃（由首相撰寫）。 | 國會開幕大典上，君主宣布新會期開始，同埋宣讀君主演講（King's/Queen's Speech），內容係政府嘅立法計劃（由首相撰寫）。 | 譯名表 |
| #171 | The UK has 650 parliamentary constituencies, each electing one MP —... | 英國有 650 個選區，每區選出一名國會議員（Member of Parliament, MP），所以下議院有 650 名議員。 | 英國有 650 個選區，每個選區選出一位國會議員（Member of Parliament, MP），所以下議院有 650 名議員。 | 語感 |
| #173 | The House of Lords examines, revises and debates laws proposed by t... | 上議院審議、修訂同辯論下議院提出嘅法案（不能否決財政法案）。 | 上議院審議、修訂同辯論下議院提出嘅法案（唔可以否決財政法案）。 | 同已批准文字統一 |
| #174 | Life peers are members of the House of Lords appointed for their li... | Life peers（終身貴族）係終身制上議院議員，頭銜唔可以世襲；現時大部分上議院議員係 life peers（終身貴族）。 | Life peers（終身貴族）係終身制上議院議員，頭銜唔可以世襲；而家大部分上議院議員都係終身貴族。 | 同已批准文字統一 |
| #175 | Hereditary peers inherit their title; only 92 remain in the House o... | Hereditary peers（世襲貴族）係世襲貴族，上議院只剩 92 位。 | Hereditary peers（世襲貴族）係承襲頭銜嘅貴族，上議院只剩 92 位。 | 語感 |
| #176 | Several Church of England bishops (the Lords Spiritual, 26 in total... | 多位 Church of England（英格蘭國教會）主教（Lords Spiritual，共 26 位）係上議院成員。 | 有幾位 Church of England（英格蘭國教會）主教喺上議院有議席，叫做 Lords Spiritual（神職上議院議員），一共 26 位。 | 同已批准文字統一 |
| #178 | A by-election is held when an MP dies or resigns. | 補選（by-election）喺國會議員（Member of Parliament, MP）去世或辭職時舉行。 | 國會議員（Member of Parliament, MP）去世或者辭職嗰陣，會舉行補選（by-election）。 | 語感 |
| #179 | Prime Minister's Questions (PMQs) is a weekly session (usually Wedn... | 首相答問（Prime Minister's Questions, PMQs）係每週一次（通常星期三）國會議員質詢首相嘅環節。 | 首相質詢時間（Prime Minister's Questions, PMQs）係每個星期一次（通常喺星期三）、國會議員向首相提問嘅環節。 | 語感、U12 |
| #180 | A hung parliament is when no single party wins enough seats for a m... | Hung parliament（懸浮議會）係冇單一政黨取得過半議席嘅情況。 | Hung parliament（懸浮議會）係冇任何一個政黨贏到過半數議席嘅情況。 | 語感 |
| #181 | The Prime Minister is head of government, leads the Cabinet and adv... | 首相係政府首長，領導內閣並向君主提供建議；官邸係 10 Downing Street（唐寧街）。 | 首相係政府首長，帶領內閣，同埋向君主提供意見；官邸係 10 Downing Street（唐寧街）。 | 語感 |
| #182 | The Cabinet, chaired by the PM and made up of about 20 senior minis... | 內閣由首相主持、約 20 位資深部長組成，負責重大政策決定。 | 內閣由首相主持、大約 20 位資深部長組成，負責重大政策決定。 | 同已批准文字統一 |
| #183 | The Shadow Cabinet is made up of senior opposition MPs, appointed b... | Shadow Cabinet（影子內閣）由反對黨領袖委任嘅資深反對黨議員組成，對應各內閣部長並挑戰政府。 | Shadow Cabinet（影子內閣）由反對黨領袖委任嘅資深反對黨議員組成，對應各個內閣部長，挑戰政府。 | 語感 |
| #184 | The Home Secretary is responsible for crime, policing and immigration. | Home Secretary（內政大臣）負責犯罪、警政同移民。 | Home Secretary（內政大臣）負責罪案、警政同移民。 | 同已批准文字統一 |
| #188 | The Civil Service implements government policy and must remain poli... | Civil Service（公務員）執行政府政策，必須保持政治中立。 | Civil Service（公務員）執行政府政策，一定要保持政治中立。 | 語感 |
| #191 | UK general elections use the 'first past the post' system: the cand... | 英國大選採用 first past the post（領先者當選制）制度：選區內得票最多嘅候選人勝出。 | 英國大選用 first past the post（領先者當選制）：選區入面得票最多嘅候選人勝出。 | 語感 |
| #192 | Proportional representation gives seats in proportion to votes rece... | 比例代表制（proportional representation）按得票比例分配議席，北愛爾蘭議會（以及蘇格蘭議會同 Senedd）採用此制度。 | 比例代表制（proportional representation）按得票比例分配議席，北愛爾蘭議會（仲有蘇格蘭議會同 Senedd（威爾斯議會））都用呢個制度。 | 同已批准文字統一 |
| #194 | To vote in a general election you must be 18 or over, a UK, Irish o... | 大選投票資格：年滿 18 歲、英國/愛爾蘭/英聯邦公民、已登記選民冊。 | 大選投票資格：要年滿 18 歲、係英國/愛爾蘭/英聯邦公民，而且已經登記喺選民登記冊（electoral register）。 | 同已批准文字統一 |
| #195 | Before an election you are sent a poll card telling you where and w... | 選舉前會收到 poll card（投票通知卡），列明投票地點同時間；投票時用 ballot paper（選票）。 | 選舉之前你會收到 poll card（投票通知卡），講明喺邊度同幾時投票；投票嗰陣用 ballot paper（選票）。 | 同已批准文字統一 |
| #196 | By law, television and radio must give balanced political coverage ... | 法律規定電視同電台喺選舉前必須平衡報道政治新聞，報章不受此限。 | 法律規定電視同電台喺選舉之前一定要提供均衡嘅政治報道，報章唔受呢條規定限制。 | 同已批准文字統一 |
| #197 | The Electoral Commission oversees elections and maintains the elect... | Electoral Commission（選舉委員會）監督選舉並管理選民登記冊。 | Electoral Commission（選舉委員會）監督選舉，管理選民登記冊（考試以呢個講法為準；實際上選民登記冊由地方議會嘅選民登記主任（Electoral Registration Officer）管理）。 | R1 |
| #199 | The Scottish Parliament, in Edinburgh, has 129 members (MSPs). | 蘇格蘭議會（Scottish Parliament）位於 Edinburgh（愛丁堡），有 129 名議員（MSP, Member of the Scottish Parliament）。 | 蘇格蘭議會（Scottish Parliament）喺 Edinburgh（愛丁堡），有 129 名議員（MSP, Member of the Scottish Parliament）。 | 語感 |
| #200 | The Welsh Parliament (Senedd Cymru, formerly the National Assembly ... | 威爾斯議會（Senedd Cymru，前稱 National Assembly for Wales）位於 Cardiff（加的夫），有 60 名議員（MS, Member of the Senedd）。 | 威爾斯議會（Senedd Cymru，前身叫 National Assembly for Wales）喺 Cardiff（加的夫），有 60 名議員（MS, Member of the Senedd）（考試以官方手冊嘅60名為準；2026年選舉起增至96名）。 | R1 |
| #203 | Towns, cities and rural areas are governed by democratically electe... | 城鎮同鄉郊由民選地方議會管理，提供教育、廢物處理、房屋等服務；議員代表社區並決定地方服務。 | 城鎮、城市同鄉郊由民選地方議會管理，提供教育、廢物處理、房屋等服務；議員代表社區，同埋決定地方服務。 | 語感、U2 |
| #204 | Habeas corpus is the legal principle that prevents people from bein... | Habeas corpus（人身保護令）係防止未經審訊而被囚禁嘅法律原則。 | Habeas corpus（人身保護令）係防止人未經審訊就被囚禁嘅法律原則。 | 語感 |
| #205 | Common law is law based on court decisions and precedents rather th... | Common law（普通法）係基於法院判決同先例而非成文法例嘅法律。 | Common law（普通法）係根據法院判決同先例，而唔係成文法例嘅法律。 | 語感 |
| #206 | Presumption of innocence: a person is considered innocent until pro... | 無罪推定（presumption of innocence）：未被證明有罪之前視為無罪。 | 無罪推定（presumption of innocence）：未證明有罪之前，一個人都當係無罪。 | 語感 |
| #207 | Trial by jury: a panel of citizens decides whether the accused is g... | 陪審團審訊（trial by jury）：由一組公民裁定被告有罪與否。 | 陪審團審訊（trial by jury）：由一組公民裁定被告有冇罪。 | 語感 |
| #210 | The small claims court deals with minor civil disputes. | 小額錢債法庭（small claims court）處理小型民事糾紛。 | 小額錢債審裁處（small claims court）處理小型民事糾紛。 | 譯名表 |
| #212 | Youth Courts in England and Wales (for those aged 10–17) are heard ... | 英格蘭同威爾斯嘅少年法庭（10–17 歲）由受過特別訓練嘅裁判官或地區法官審理，嚴重案件轉介 Crown Court（刑事法院）。 | 英格蘭同威爾斯嘅 Youth Court（少年法庭）（10–17 歲）由受過特別訓練嘅裁判官或者地區法官審理，嚴重案件會轉去 Crown Court（刑事法院）。 | 譯名表 |
| #213 | Solicitors give legal advice and represent clients; their charges a... | 律師（solicitor）提供法律意見並代表客戶，收費通常按處理案件所花時間計算。 | 律師（solicitor）提供法律意見同代表客戶，收費通常按佢哋處理案件用咗幾多時間計。 | 語感 |
| #217 | You can complain about the police by writing to the Chief Constable... | 投訴警察可以寫信俾警察總長（Chief Constable）、親身去警署，或向獨立警察投訴機構（Independent Office for Police Conduct, IOPC）投訴。 | 投訴警察可以寫信俾總警司（Chief Constable）、親身去警署，或者向獨立警察投訴機構（Independent Office for Police Conduct, IOPC）投訴。 | 譯名表 |
| #218 | If you think someone is trying to persuade you to join an extremist... | 如懷疑有人游說你加入極端或恐怖組織，應聯絡當地警方。 | 如果懷疑有人游說你加入極端或者恐怖組織，應該聯絡當地警方。 | 語感 |
| #220 | The National Minimum Wage (introduced 1998) is the minimum hourly w... | National Minimum Wage（1998 年推行）係僱主必須支付嘅最低時薪。 | National Minimum Wage（1998 年推行）係僱主一定要俾嘅最低時薪。 | 語感 |
| #221 | The Human Rights Act 1998 incorporated the European Convention on H... | Human Rights Act（人權法） 1998 將歐洲人權公約納入英國法律。 | 1998 年《人權法》（Human Rights Act）將《歐洲人權公約》納入英國法律。 | 同已批准文字統一 |
| #222 | The Equality Act 2010 protects people from discrimination based on ... | Equality Act（平等法） 2010 保障人們免受基於年齡、性別、種族、宗教等受保護特徵嘅歧視。 | 2010 年《平等法》（Equality Act）保障人唔會因為年齡、性別、種族、宗教等受保護特徵而受到歧視。 | 同已批准文字統一 |
| #224 | When walking your dog in a public place, it must wear a collar show... | 喺公眾地方遛狗，狗隻必須戴上寫有主人姓名同地址嘅頸圈。 | 喺公眾地方遛狗，狗隻一定要戴寫有主人姓名同地址嘅頸圈。 | 語感 |
| #225 | The National Citizen Service is a voluntary (not compulsory) progra... | National Citizen Service（國民公民服務）係俾 16–17 歲青年參加嘅自願（非強制）計劃，培養技能同服務社區。 | National Citizen Service（國民公民服務）係俾 16–17 歲青年參加嘅自願（唔係強制）計劃，培養技能同服務社區。 | 語感 |
| #230 | The Commonwealth is an association of about 54 countries, mostly fr... | Commonwealth（英聯邦）係約 54 個國家組成嘅組織，大多來自前大英帝國。 | Commonwealth（英聯邦）係大約 54 個國家組成嘅組織（考試以官方手冊嘅54個為準；2022年起56個），大部分係前大英帝國嘅地方。 | R1 |
| #231 | The Council of Europe (47 members, separate from the EU) protects h... | Council of Europe（47 個成員國，同歐盟係唔同機構）保障人權、推廣民主。 | Council of Europe（歐洲委員會）唔係歐盟機構，有 47 個成員國（考試以官方手冊嘅47個為準；2022年起46個），負責保障人權、喺歐洲推廣民主。 | R1 |
| #232 | The European Convention on Human Rights protects fundamental rights... | 歐洲人權公約保障基本權利同自由，由位於 Strasbourg（史特拉斯堡）嘅歐洲人權法院執行。 | 《歐洲人權公約》保障基本權利同自由，由喺 Strasbourg（史特拉斯堡）嘅歐洲人權法院執行。 | 語感 |
| #233 | The United Nations was set up after the Second World War (1945) to ... | 聯合國喺二戰後（1945 年）成立，旨在防止戰爭、促進國際和平。 | 聯合國喺二戰之後（1945 年）成立，目的係防止戰爭、促進國際和平。 | 語感 |

## 保留未改（判斷邊界）

- **已經自然**嘅 fact（例如 #2、#3、#15、#17、#18、#21、#25、#27、#31–#33、#41、#46、#50、#52、#64、#67、#71、#72、#75、#84、#87、#95、#97–#102、#104、#108、#109、#111、#117–#122、#124、#125、#127–#132、#134、#136、#138、#139、#142–#144、#146、#147、#149–#151、#153、#157、#159–#165、#169、#170、#172、#177、#185–#187、#189、#190、#193、#198、#201、#202、#208、#209、#211、#214–#216、#219、#223、#226–#229、#234–#236）一律唔列出。
- **範圍數字**：「18 至 70 歲」（#208）、「9 至 10 世紀」（#14）保留「至」，同已批准陪審員記憶法一致；只有表示變動嘅「降至」先改「降到」。
- **人名入面嘅「的」**：阿拉貢的凱瑟琳（#28）、奧蘭治的威廉（#43）保留，同已批准題目一致。
- **English 先、中文括號** 嘅 fact 格式保留（例如「Stonehenge（巨石陣）」）；只有統一表規定中文先嘅譯名（《聯合法案》、《耶穌受難日協議》、《廢除奴隸貿易法案》、排燈節、和平紀念碑、君主演講）先調轉。
- **#105（國教）**、**#203（城市）** 同下面「疑問」入面嘅譯名：原提案冇改，用戶決定之後按 U1–U16 套用（見「用戶決定」）。

## 疑問（已由用戶 2026-10-07 決定，見上面 U1–U16；以下保留原提案文字作紀錄）

1. **#105 國教（事實）**：English「Wales and Northern Ireland do NOT have an established church; only England and Scotland do.」，中文跟住寫「只有英格蘭同蘇格蘭有」。已批准 Z4（Exam 3 · Q2、Exam 6 · Q5 note）寫「只有英格蘭有國教（Church of England）；蘇格蘭嘅 Church of Scotland 係國家教會，唔係國教」。建議跟 Z4：「威爾斯同北愛爾蘭冇國教；只有英格蘭有國教（Church of England），蘇格蘭嘅 Church of Scotland 係國家教會，唔係國教。」（English 受 content guard 保護，唔改）。
2. **#203 漏譯**：English「Towns, cities and rural areas」，中文得「城鎮同鄉郊」。建議改「城鎮、城市同鄉郊由民選地方議會管理…」（其餘照提案）。
3. **#126 £100 鈔票**：English 只寫「Scottish banks issue £100」；提案跟已批准 W4 note 寫「蘇格蘭同北愛爾蘭有啲銀行另外發行 £100」（「蘇格蘭銀行」又容易誤會成 Bank of Scotland 一間）。建議保持提案；如果要嚴格跟 English，就改「（蘇格蘭有啲銀行另外發行 £100）」。
4. **布迪卡（#11）**：fact 寫「布狄卡」，已批准 Exam 13 · Q3 寫「布迪卡」。建議 fact 改「Boudicca（布迪卡）」，加入譯名統一表。
5. **Woolsthorpe（#49）**：fact 寫「伍爾索普」，已批准 Exam 8 · Q22 yue 寫「烏爾斯索普」。建議 fact 跟題目改「Woolsthorpe（烏爾斯索普）」。
6. **Concorde（#90）**：fact 寫「和諧式客機」（香港通行），已批准 Exam 3 · Q10 yue 寫「協和飛機」。建議統一香港叫法「Concorde（和諧式客機）」，Exam 3 · Q10 yue 跟住改「邊兩個國家一齊研發和諧式客機（Concorde）？」，加入譯名統一表。
7. **Millennium Dome（#154）**：fact「千禧巨蛋」，已批准 Exam 5 · Q10「千禧穹頂（The O2）」。建議 fact 改「Millennium Dome（千禧穹頂）」。
8. **The Fighting Temeraire（#152）**：fact「戰鬥的泰梅萊爾號」，已批准 Exam 10 · Q16「《戰艦無畏號》」。建議 fact 改「The Fighting Temeraire（戰艦無畏號）」。
9. **shampooing（#56）**：fact「洗頭按摩」，已批准 Exam 2 · Q12 note「香波洗頭」。當年 Sake Dean Mahomet 引入嘅係印度式頭部按摩，「洗頭按摩」比較貼原意。建議統一「shampooing（洗頭按摩）」，Exam 2 · Q12 note 跟住改「仲引入咗shampooing（洗頭按摩）服務」。
10. **Theatreland（#148）**：fact「劇院區」，已批准 Exam 11 · Q2 yue「戲院區（Theatreland）」。香港「戲院」通常指電影院。建議統一「劇院區（Theatreland）」，Exam 11 · Q2 yue 跟住改「劇院區（Theatreland）喺邊度？」。
11. **Crown Jewels（#133）**：fact「王室珠寶」，已批准 Exam 10 · Q18「皇冠珠寶」。建議 fact 改「Crown Jewels（皇冠珠寶）」。
12. **PMQs（#179）**：fact「首相答問」，已批准 Exam 12 · Q14「首相質詢時間」。建議 fact 改「首相質詢時間（Prime Minister's Questions, PMQs）」。
13. **Halloween（#112）**：fact「萬聖節」，已批准 Exam 6 · Q17、Exam 7 · Q2「萬聖節前夕」（10 月 31 日嚴格係萬聖節前夕）。建議 fact 改「Halloween（萬聖節前夕）係 10 月 31 日。」
14. **Enlightenment（#48）**：fact「啟蒙時代」，已批准 Exam 11 · Q5、Exam 14 · Q5「啟蒙運動」。建議 fact 改「Enlightenment（啟蒙運動）」（其餘照提案）。
15. **Church of England 譯名（#28、#103、#176）**：fact「英格蘭國教會」，已批准題目（Exam 3 · Q4、Exam 4 · Q16、Exam 11 · Q16 等）「英格蘭教會」。fact 寫法講明係國教，冇歧義。建議保留，兩種寫法並存；如果要統一，就 fact 改「英格蘭教會」。
16. **Citizens Advice（#215）**：fact「公民諮詢局」，已批准 Exam 17 · Q17「公民諮詢（Citizen's Advice）」。建議保留（「局」只係補返機構名）。
