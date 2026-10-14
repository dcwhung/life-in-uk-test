# 模擬試題 Exam 18–20 審稿（Draft）

- 日期：2026-10-14 ｜ 版本：第 2 輪（已換走用戶剔除嘅 25 題）｜ 狀態：**待用戶審閱**，確認後先 integrate 入 `data/exams.js`
- 數據源：`2026-10-14_new-exams-18-20-draft.json`（本文件由佢生成，改題請改 JSON）
- 範圍：只用現有 235 個 STUDY fact（每題連一個 fact id，難度 = 該 fact 嘅 d），記憶法沿用該 fact 現有嘅 memo group

## 分布規則（按 STUDY fact 比例）

| 項目 | Ch1 | Ch2 | Ch3 | Ch4 | Ch5 | 合計 |
|---|---|---|---|---|---|---|
| STUDY facts | 2 | 4 | 91 | 67 | 71 | 235 |
| 比例 × 24 | 0.2 | 0.4 | 9.3 | 6.8 | 7.3 | 24 |
| **每份卷** | **1** | **1** | **9** | **6** | **7** | **24** |

> Ch1 / Ch2 按比例唔夠 1 題，因「每份卷要涵蓋五個 chapter」保底各 1 題，差額由 Ch4 / Ch5 減。

| 難度 | ★1 | ★2 | ★3 | ★4 | ★5 | 合計 |
|---|---|---|---|---|---|---|
| STUDY facts | 30 | 57 | 92 | 46 | 10 | 235 |
| 比例 × 24 | 3.1 | 5.8 | 9.4 | 4.7 | 1.0 | 24 |
| **每份卷** | **3** | **6** | **9** | **5** | **1** | **24** |

題型（參考現有 408 題：約 4% 雙答案、5% True/False）：每份卷 1–2 條雙答案題、1 條 True/False，其餘四選一。

## 驗證結果

| 檢查 | 結果 |
|---|---|
| 每份卷 24 題、章節 1/1/9/6/7、難度 3/6/9/5/1 | ✅ 三份全部符合 |
| 題目 ch / d 同所連 fact 一致 | ✅ |
| 同現有 408 題題幹重複 | ✅ 0 條 |
| 三份卷之間題幹重複 | ✅ 0 條 |
| fact 覆蓋 | 72 題用 70 個 fact：#1 喺 Exam 18、20 各一條（Ch1 只得 2 個 fact）；#4 喺 Exam 19、20 各一條（Ch2 ★5 只得 #4 / #5，#5 題被剔除） |
| 記憶法 group 同 fact 現有題目一致 | ✅（1 條冇 group，見下面「需要你決定」） |


## Exam 18

| # | Ch | ★ | 題目 | 選項（✅ = 答案） | 廣東話 | 記憶法 | Fact |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 1 | Which TWO of the following are responsibilities of a British citizen or permanent resident? | ✅ A. To pay taxes（交稅）<br>▫️ B. To join a political party（加入政黨）<br>✅ C. To treat others with fairness（公平待人）<br>▫️ D. To go to church every week（每個禮拜去教堂） | 以下邊兩項係英國公民或者永久居民嘅責任？ | 公民責任 | #1 |
| 2 | 2 | 4 | Which part of the United Kingdom is NOT part of Great Britain? | ▫️ A. Wales（威爾斯）<br>▫️ B. Scotland（蘇格蘭）<br>✅ C. Northern Ireland（北愛爾蘭）<br>▫️ D. England（英格蘭） | 英國邊個部分唔屬於大不列顛（Great Britain）？ | UK 同 Great Britain | #3 |
| 3 | 3 | 1 | Which group of campaigners, led by Emmeline Pankhurst, fought for women's right to vote? | ▫️ A. The Chartists（憲章運動）<br>✅ B. The Suffragettes（婦女參政運動）<br>▫️ C. The Luddites（盧德派）<br>▫️ D. The Puritans（清教徒） | 由 Emmeline Pankhurst 帶領、爭取女性投票權嘅係邊個運動？ | 投票權 | #64 |
| 4 | 3 | 3 | What was England called when it became a republic after Charles I was executed? | ✅ A. The Commonwealth（共和政體（Commonwealth））<br>▫️ B. The Restoration（王政復辟）<br>▫️ C. The Protectorate of Wales（威爾斯護國政體）<br>▫️ D. The United Kingdom（聯合王國） | 查理一世被處決之後，英格蘭成為共和國，當時叫做咩？ | 國王 vs 國會 | #37 |
| 5 | 3 | 3 | Hadrian's Wall was built across which part of Britain? | ▫️ A. Southern England（英格蘭南部）<br>✅ B. Northern England（英格蘭北部）<br>▫️ C. Central Wales（威爾斯中部）<br>▫️ D. The Scottish Highlands（蘇格蘭高地） | 哈德良長城係橫跨不列顛邊個部分起嘅？ | 早期英國 | #12 |
| 6 | 3 | 3 | The assassination of which person helped to trigger the First World War? | ✅ A. Archduke Franz Ferdinand（斐迪南大公）<br>▫️ B. Napoleon Bonaparte（拿破崙）<br>▫️ C. Kaiser Wilhelm II（德皇威廉二世）<br>▫️ D. Tsar Nicholas II（沙皇尼古拉二世） | 邊個人被刺殺，觸發咗第一次世界大戰？ | 一次世界大戰 | #65 |
| 7 | 3 | 3 | What do VE Day and VJ Day mark? | ▫️ A. The start and end of the First World War（一戰嘅開始同結束）<br>✅ B. The end of the Second World War in Europe and against Japan（二戰喺歐洲同對日本嘅結束）<br>▫️ C. The founding of the UN and NATO（聯合國同北約成立）<br>▫️ D. The coronation of the Monarch（君主加冕） | VE Day 同 VJ Day 紀念咩？ | 二次世界大戰 | #78 |
| 8 | 3 | 2 | Who did the Duke of Wellington defeat at the Battle of Waterloo in 1815? | ✅ A. Napoleon（拿破崙）<br>▫️ B. Louis XIV（路易十四）<br>▫️ C. Philip II of Spain（西班牙腓力二世）<br>▫️ D. Bonnie Prince Charlie（英俊王子查理） | 1815年滑鐵盧戰役，威靈頓公爵打敗咗邊個？ | 打敗西班牙同法國 | #57 |
| 9 | 3 | 3 | Which TWO countries declared war on Germany in 1939 after it invaded Poland? | ✅ A. Britain（英國）<br>✅ B. France（法國）<br>▫️ C. The USA（美國）<br>▫️ D. Japan（日本） | 1939年德國入侵波蘭之後，邊兩個國家向德國宣戰？ | 二次世界大戰 | #73 |
| 10 | 3 | 1 | For UK residents, NHS healthcare is: | ▫️ A. Free only for children（只係兒童免費）<br>▫️ B. Paid for by private insurance（由私人保險支付）<br>✅ C. Free at the point of use（使用時免費）<br>▫️ D. Only available to British citizens（只限英國公民使用） | 對英國居民嚟講，NHS 醫療服務係： | 戰後重建 | #80 |
| 11 | 3 | 3 | What did Tim Berners-Lee invent? | ▫️ A. The telephone（電話）<br>▫️ B. The jet engine（噴射引擎）<br>✅ C. The World Wide Web（萬維網）<br>▫️ D. The television（電視） | Tim Berners-Lee 發明咗乜嘢？ | 發明家 | #95 |
| 12 | 4 | 2 | Snowdon is the highest mountain in which part of the UK? | ▫️ A. England（英格蘭）<br>✅ B. Wales（威爾斯）<br>▫️ C. Scotland（蘇格蘭）<br>▫️ D. Northern Ireland（北愛爾蘭） | Snowdon（斯諾登山）係英國邊個地方最高嘅山？ | 國家公園同山 | #137 |
| 13 | 4 | 3 | Where is the BBC Proms held? | ✅ A. The Royal Albert Hall（皇家亞伯特音樂廳）<br>▫️ B. The O2 Arena（O2 體育館）<br>▫️ C. Wembley Stadium（溫布萊球場）<br>▫️ D. The Royal Opera House（皇家歌劇院） | BBC 逍遙音樂節（BBC Proms）喺邊度舉行？ | 表演同節慶 | #145 |
| 14 | 4 | 2 | Which novel was written by Jane Austen? | ▫️ A. Jane Eyre（《簡愛》）<br>✅ B. Pride and Prejudice（《傲慢與偏見》）<br>▫️ C. Oliver Twist（《苦海孤雛》）<br>▫️ D. Frankenstein（《科學怪人》） | 以下邊本小說係 Jane Austen 寫嘅？ | 作家 | #160 |
| 15 | 4 | 3 | Vaisakhi is a festival celebrated by which religious group? | ▫️ A. Hindus（印度教徒）<br>▫️ B. Muslims（穆斯林）<br>✅ C. Sikhs（錫克教徒）<br>▫️ D. Jews（猶太人） | Vaisakhi（豐收節）係邊個宗教群體嘅節日？ | 節日同假期 | #111 |
| 16 | 4 | 2 | How often are the Commonwealth Games held? | ▫️ A. Every year（每年）<br>▫️ B. Every two years（每兩年）<br>✅ C. Every four years（每四年）<br>▫️ D. Every ten years（每十年） | 英聯邦運動會幾耐舉行一次？ | 運動賽事 | #144 |
| 17 | 4 | 5 | Banknotes issued in Northern Ireland are valid everywhere in the UK. True or False? | ✅ A. True<br>▫️ B. False | 北愛爾蘭發行嘅鈔票喺全英國都有效。對定錯？ | 英國貨幣 | #125 |
| 18 | 5 | 2 | What happens when an MP dies or resigns? | ▫️ A. A general election is held（舉行大選）<br>✅ B. A by-election is held（舉行補選）<br>▫️ C. The House of Lords chooses a new MP（由上議院揀新議員）<br>▫️ D. The seat stays empty until the next general election（議席懸空直到下次大選） | 國會議員過身或者辭職會點？ | 國會選舉 | #178 |
| 19 | 5 | 2 | In the UK, a person accused of a crime is: | ▫️ A. Guilty until proven innocent（未證明無罪之前都係有罪）<br>✅ B. Innocent until proven guilty（未證明有罪之前都係無罪）<br>▫️ C. Held in prison until the trial（審訊前要喺監獄扣留）<br>▫️ D. Judged by the police（由警察判決） | 喺英國，被控犯罪嘅人： | 法律原則 | #206 |
| 20 | 5 | 4 | Which minister is responsible for the legal system and courts in England and Wales? | ▫️ A. The Home Secretary（內政大臣）<br>▫️ B. The Attorney General（律政總長）<br>✅ C. The Lord Chancellor（大法官）<br>▫️ D. The Foreign Secretary（外交大臣） | 邊位大臣負責英格蘭同威爾斯嘅司法制度同法院？ | 部長同公職 | #186 |
| 21 | 5 | 4 | Which TWO are ways to make a complaint about the police? | ✅ A. Write to the Chief Constable of the police force involved（寫信俾涉事警隊嘅總警司）<br>✅ B. Go to a police station（去警署）<br>▫️ C. Write to the Prime Minister（寫信俾首相）<br>▫️ D. Complain to your local MP only（只可以向本區國會議員投訴） | 以下邊兩個係投訴警察嘅方法？ | 警察 | #217 |
| 22 | 5 | 4 | In which city does the Scottish Parliament sit? | ▫️ A. Glasgow（格拉斯哥）<br>▫️ B. Aberdeen（鴨巴甸）<br>✅ C. Edinburgh（愛丁堡）<br>▫️ D. Dundee（登地） | 蘇格蘭議會設喺邊個城市？ | 四地議會 | #199 |
| 23 | 5 | 4 | Who is the National Citizen Service programme for? | ▫️ A. Adults aged over 65（65歲以上成年人）<br>✅ B. 16 and 17 year olds（16同17歲青少年）<br>▫️ C. New immigrants only（只係新移民）<br>▫️ D. Primary school children（小學生） | National Citizen Service（全國公民服務）計劃係俾邊啲人參加？ | 慈善同義工 | #225 |
| 24 | 5 | 3 | Which of the following services is provided by local councils? | ✅ A. Waste collection（收垃圾）<br>▫️ B. Defence（國防）<br>▫️ C. Foreign policy（外交政策）<br>▫️ D. Immigration control（出入境管制） | 以下邊項服務係由地方議會提供？ | 地區議會 | #203 |

## Exam 19

| # | Ch | ★ | 題目 | 選項（✅ = 答案） | 廣東話 | 記憶法 | Fact |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 2 | Which fundamental principle of British life means that everyone, including the government, must obey the law? | ▫️ A. Individual liberty（個人自由）<br>✅ B. The rule of law（法治）<br>▫️ C. Democracy（民主）<br>▫️ D. Tolerance（寬容） | 英國生活邊項基本原則係指所有人（包括政府）都要遵守法律？ | 基本原則 | #2 |
| 2 | 2 | 5 | The Isle of Man is part of the United Kingdom. True or False? | ▫️ A. True<br>✅ B. False | 曼島（Isle of Man）係英國嘅一部分。對定錯？ | Crown dependency | #4 |
| 3 | 3 | 4 | In the Glorious Revolution of 1688, James II was replaced by whom? | ▫️ A. Oliver Cromwell（克倫威爾）<br>▫️ B. Charles II（查理二世）<br>✅ C. William of Orange（奧蘭治親王威廉）<br>▫️ D. George I（喬治一世） | 1688年光榮革命，詹姆士二世被邊個取代？ | 國王 vs 國會 | #43 |
| 4 | 3 | 3 | Which TWO parliaments were united by the Act of Union 1707? | ✅ A. England（英格蘭）<br>✅ B. Scotland（蘇格蘭）<br>▫️ C. Ireland（愛爾蘭）<br>▫️ D. Wales（威爾斯） | 《1707年聯合法案》合併咗邊兩個國會？ | 聯合王國點樣形成 | #45 |
| 5 | 3 | 1 | Which king signed the Magna Carta in 1215? | ▫️ A. King Harold（哈羅德王）<br>▫️ B. King Henry VIII（亨利八世）<br>✅ C. King John（約翰王）<br>▫️ D. King Alfred the Great（阿爾弗烈德大帝） | 1215年邊位國王簽署咗大憲章（Magna Carta）？ | Magna Carta 大憲章 | #21 |
| 6 | 3 | 3 | Who won the Wars of the Roses and became the first Tudor king? | ✅ A. Henry VII（亨利七世）<br>▫️ B. Richard III（理查三世）<br>▫️ C. Henry VIII（亨利八世）<br>▫️ D. Edward IV（愛德華四世） | 邊個打贏咗玫瑰戰爭，成為第一位都鐸王朝國王？ | 都鐸王朝 | #26 |
| 7 | 3 | 3 | Which king was executed after the English Civil War? | ▫️ A. James I（詹姆士一世）<br>✅ B. Charles I（查理一世）<br>▫️ C. Charles II（查理二世）<br>▫️ D. James II（詹姆士二世） | 英國內戰之後，邊位國王被處決？ | 國王 vs 國會 | #36 |
| 8 | 3 | 3 | The Battle of Britain in 1940 was fought mainly: | ▫️ A. At sea（喺海上）<br>✅ B. In the air（喺空中）<br>▫️ C. In the trenches of France（喺法國嘅戰壕）<br>▫️ D. In North Africa（喺北非） | 1940年嘅不列顛戰役主要喺邊度打？ | 二次世界大戰 | #76 |
| 9 | 3 | 3 | The fall of the Berlin Wall in 1989 marked the end of: | ▫️ A. The Second World War（第二次世界大戰）<br>✅ B. The Cold War（冷戰）<br>▫️ C. The Boer War（布爾戰爭）<br>▫️ D. The Hundred Years War（百年戰爭） | 1989年柏林圍牆倒下，標誌住乜嘢結束？ | 20 世紀後期 | #94 |
| 10 | 3 | 1 | Winston Churchill was Prime Minister during which war? | ▫️ A. The First World War（第一次世界大戰）<br>✅ B. The Second World War（第二次世界大戰）<br>▫️ C. The Boer War（布爾戰爭）<br>▫️ D. The Crimean War（克里米亞戰爭） | 邱吉爾喺邊場戰爭期間做首相？ | 二次世界大戰 | #74 |
| 11 | 3 | 1 | The Norman Conquest of England began with which battle? | ▫️ A. The Battle of Bannockburn（班諾克本戰役）<br>✅ B. The Battle of Hastings（哈斯丁斯戰役）<br>▫️ C. The Battle of Bosworth（博斯沃思戰役）<br>▫️ D. The Battle of Culloden（卡洛登戰役） | 諾曼征服英格蘭由邊場戰役開始？ | 中世紀戰役 | #16 |
| 12 | 4 | 4 | What does the flag of Scotland (the Saltire) look like? | ▫️ A. A red cross on a white background（白底紅十字）<br>✅ B. A white X-shaped cross on a blue background（藍底白色交叉十字）<br>▫️ C. A red X-shaped cross on a white background（白底紅色交叉十字）<br>▫️ D. A red dragon on a green and white background（綠白底紅龍） | 蘇格蘭國旗（聖安德魯十字旗）係點樣？ | 守護聖人 | #100 |
| 13 | 4 | 2 | The Union Jack combines the crosses of patron saints. Which country's cross is NOT included? | ▫️ A. England（英格蘭）<br>▫️ B. Scotland（蘇格蘭）<br>▫️ C. Ireland（愛爾蘭）<br>✅ D. Wales（威爾斯） | 英國國旗（Union Jack）由守護聖人十字組成，邊個國家嘅十字冇包括喺入面？ | 守護聖人 | #122 |
| 14 | 4 | 2 | Eid al-Fitr celebrates the end of which period? | ▫️ A. Lent（大齋期）<br>✅ B. Ramadan（齋戒月）<br>▫️ C. Diwali（排燈節）<br>▫️ D. Hanukkah（光明節） | 開齋節（Eid al-Fitr）慶祝邊段時期結束？ | 節日同假期 | #108 |
| 15 | 4 | 2 | What is the highest mountain in the UK? | ▫️ A. Snowdon（斯諾登山）<br>▫️ B. Scafell Pike（斯科費爾峰）<br>✅ C. Ben Nevis（本尼維斯山）<br>▫️ D. Slieve Donard（多納德山） | 英國最高嘅山係邊座？ | 國家公園同山 | #138 |
| 16 | 4 | 3 | Which book did Rudyard Kipling write? | ✅ A. The Jungle Book（《森林王子》）<br>▫️ B. Oliver Twist（《苦海孤雛》）<br>▫️ C. Jane Eyre（《簡愛》）<br>▫️ D. The Canterbury Tales（《坎特伯雷故事集》） | Rudyard Kipling 寫咗邊本書？ | 詩人 | #165 |
| 17 | 4 | 4 | Money raised by the National Lottery is used to support: | ✅ A. Good causes such as arts, sport and heritage（藝術、體育同文化遺產等公益事業）<br>▫️ B. The salaries of MPs（國會議員人工）<br>▫️ C. The armed forces（軍隊）<br>▫️ D. Reducing income tax（減入息稅） | 國家彩票籌得嘅錢用嚟支持乜嘢？ | 媒體同公益 | #158 |
| 18 | 5 | 2 | Where can you get free, confidential advice about your rights and legal matters? | ✅ A. Citizens Advice（公民諮詢局）<br>▫️ B. The House of Lords（上議院）<br>▫️ C. The Electoral Commission（選舉委員會）<br>▫️ D. The Bank of England（英倫銀行） | 你可以去邊度免費、保密咁查詢自己嘅權利同法律問題？ | 法律服務 | #215 |
| 19 | 5 | 2 | Who is legal aid intended to help? | ✅ A. People who cannot afford to pay for legal advice（負擔唔起法律意見費用嘅人）<br>▫️ B. Only people accused of serious crimes（只係被控嚴重罪行嘅人）<br>▫️ C. Police officers in court（喺法庭嘅警察）<br>▫️ D. Only British citizens over 65（只係65歲以上嘅英國公民） | 法律援助係用嚟幫邊啲人？ | 法律服務 | #214 |
| 20 | 5 | 4 | Which TWO bodies are elected using a form of proportional representation? | ✅ A. The Northern Ireland Assembly（北愛爾蘭議會）<br>✅ B. The Scottish Parliament（蘇格蘭議會）<br>▫️ C. The House of Commons（下議院）<br>▫️ D. The House of Lords（上議院） | 以下邊兩個機構用比例代表制選出？ | 選舉制度 | #192 |
| 21 | 5 | 3 | Civil servants must be: | ▫️ A. Members of the governing party（執政黨黨員）<br>✅ B. Politically neutral（政治中立）<br>▫️ C. Elected by the public（由公眾選出）<br>▫️ D. Appointed by the Monarch personally（由君主親自委任） | 公務員必須： | 部長同公職 | #188 |
| 22 | 5 | 3 | Which of the following people can vote in a UK general election? | ▫️ A. A 17-year-old British citizen（17歲英國公民）<br>✅ B. A 20-year-old Irish citizen on the electoral register（已登記做選民嘅20歲愛爾蘭公民）<br>▫️ C. A 30-year-old French citizen living in the UK（住喺英國嘅30歲法國公民）<br>▫️ D. A 25-year-old British citizen not on the electoral register（未登記做選民嘅25歲英國公民） | 以下邊個人可以喺英國大選投票？ | 投票 | #194 |
| 23 | 5 | 3 | When was NATO founded? | ▫️ A. 1919<br>▫️ B. 1945<br>✅ C. 1949<br>▫️ D. 1973 | 北大西洋公約組織（NATO）喺邊年成立？ | 國際組織 | #236 |
| 24 | 5 | 4 | When was the National Minimum Wage introduced? | ▫️ A. 1948<br>▫️ B. 1979<br>✅ C. 1998<br>▫️ D. 2010 | 全國最低工資喺邊年推出？ | 🆕 • 1998 → 推出 National Minimum Wage（全國最低工資）<br>• 重點 → 僱主每個鐘最少要俾嘅工資，按年齡分級 | #220 |

## Exam 20

| # | Ch | ★ | 題目 | 選項（✅ = 答案） | 廣東話 | 記憶法 | Fact |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 1 | Which of the following is NOT a responsibility of a British citizen or permanent resident? | ▫️ A. To obey the law（遵守法律）<br>▫️ B. To pay taxes（交稅）<br>✅ C. To join the armed forces（參軍）<br>▫️ D. To look after yourself and your family（照顧自己同家人） | 以下邊項唔係英國公民或者永久居民嘅責任？ | 公民責任 | #1 |
| 2 | 2 | 5 | Which of the following best describes Jersey? | ▫️ A. Part of England（英格蘭嘅一部分）<br>✅ B. A Crown dependency with its own government（有自己政府嘅皇家屬地）<br>▫️ C. A British overseas territory（英國海外領土）<br>▫️ D. An independent member of the EU（獨立嘅歐盟成員國） | 以下邊個描述最符合澤西島（Jersey）？ | Crown dependency | #4 |
| 3 | 3 | 3 | During the Industrial Revolution, Britain changed from: | ▫️ A. An industrial economy to an agricultural one（工業經濟變成農業經濟）<br>✅ B. An agricultural economy to an industrial one（農業經濟變成工業經濟）<br>▫️ C. A republic to a monarchy（共和國變成君主國）<br>▫️ D. A Catholic country to a Protestant one（天主教國家變成新教國家） | 工業革命期間，英國由乜嘢變成乜嘢？ | 18 世紀 | #51 |
| 4 | 3 | 3 | Which TWO did the Welfare State provide after the Second World War? | ✅ A. Healthcare（醫療）<br>✅ B. Social security（社會保障）<br>▫️ C. A free car for every family（每個家庭一架免費車）<br>▫️ D. Free private schools（免費私立學校） | 二戰後嘅福利國家提供咗邊兩樣嘢？ | 戰後重建 | #81 |
| 5 | 3 | 4 | The Hundred Years War was fought between England and which country? | ▫️ A. Scotland（蘇格蘭）<br>▫️ B. Spain（西班牙）<br>✅ C. France（法國）<br>▫️ D. Holland（荷蘭） | 百年戰爭係英格蘭同邊個國家之間嘅戰爭？ | 中世紀 | #23 |
| 6 | 3 | 1 | Which of the following plays was written by William Shakespeare? | ✅ A. Hamlet（《哈姆雷特》）<br>▫️ B. The Canterbury Tales（《坎特伯雷故事集》）<br>▫️ C. Pride and Prejudice（《傲慢與偏見》）<br>▫️ D. A Christmas Carol（《聖誕頌歌》） | 以下邊部劇係莎士比亞寫嘅？ | 作家 | #32 |
| 7 | 3 | 3 | Which famous building was destroyed in the Great Fire of London? | ▫️ A. Westminster Abbey（西敏寺）<br>▫️ B. The Tower of London（倫敦塔）<br>✅ C. St Paul's Cathedral（聖保羅大教堂）<br>▫️ D. Buckingham Palace（白金漢宮） | 倫敦大火燒毀咗邊座著名建築？ | 倫敦大火 | #40 |
| 8 | 3 | 4 | As well as opening Britain's first curry house, Sake Dean Mahomet introduced what to Britain? | ▫️ A. Tea drinking（飲茶）<br>✅ B. Shampooing（洗頭按摩（shampooing））<br>▫️ C. Cricket（板球）<br>▫️ D. Fish and chips（炸魚薯條） | Sake Dean Mahomet 除咗開英國第一間咖喱屋，仲將乜嘢引入英國？ | 19 世紀人物 | #56 |
| 9 | 3 | 3 | During the Blitz, which city was bombed especially heavily? | ▫️ A. Edinburgh（愛丁堡）<br>✅ B. London（倫敦）<br>▫️ C. Dublin（都柏林）<br>▫️ D. Paris（巴黎） | 德軍閃電空襲（Blitz）期間，邊個城市被炸得特別嚴重？ | 二次世界大戰 | #77 |
| 10 | 3 | 3 | Where did the Windrush Generation come to the UK from? | ▫️ A. India（印度）<br>✅ B. The Caribbean（加勒比海地區）<br>▫️ C. Australia（澳洲）<br>▫️ D. Hong Kong（香港） | Windrush 一代係由邊度嚟英國？ | 戰後重建 | #82 |
| 11 | 3 | 2 | How many wives did Henry VIII have? | ▫️ A. Two（兩個）<br>▫️ B. Four（四個）<br>✅ C. Six（六個）<br>▫️ D. Eight（八個） | 亨利八世有幾多個老婆？ | 都鐸王朝 | #27 |
| 12 | 4 | 1 | Where is the Cenotaph? | ✅ A. Whitehall, London（倫敦白廳）<br>▫️ B. Edinburgh Castle（愛丁堡城堡）<br>▫️ C. Cardiff Bay（卡迪夫灣）<br>▫️ D. Trafalgar Square（特拉法加廣場） | 和平紀念碑（Cenotaph）喺邊度？ | 英國節日 | #116 |
| 13 | 4 | 2 | How was the Giant's Causeway formed? | ▫️ A. It was built by the Romans（由羅馬人起）<br>✅ B. By volcanic lava about 50 million years ago（大約5,000萬年前由火山熔岩形成）<br>▫️ C. By a glacier in the last Ice Age（上個冰河時期由冰川形成）<br>▫️ D. It was carved by Stone Age farmers（由石器時代農民鑿出嚟） | 巨人堤道（Giant's Causeway）係點樣形成？ | 古蹟同景點 | #135 |
| 14 | 4 | 2 | The Ashes is a series played in which sport? | ▫️ A. Rugby（欖球）<br>▫️ B. Tennis（網球）<br>✅ C. Cricket（板球）<br>▫️ D. Golf（高爾夫球） | The Ashes 係邊種運動嘅系列賽？ | 運動賽事 | #142 |
| 15 | 4 | 2 | Which novel was written by Mary Shelley? | ✅ A. Frankenstein（《科學怪人》）<br>▫️ B. Jane Eyre（《簡愛》）<br>▫️ C. Great Expectations（《孤星血淚》）<br>▫️ D. The Jungle Book（《森林王子》） | 以下邊本小說係 Mary Shelley 寫嘅？ | 作家 | #162 |
| 16 | 4 | 3 | In which county is the Glastonbury music festival held? | ▫️ A. Cornwall（康和郡）<br>✅ B. Somerset（森麻實郡）<br>▫️ C. Kent（肯特郡）<br>▫️ D. Yorkshire（約克郡） | Glastonbury 音樂節喺邊個郡舉行？ | 表演同節慶 | #147 |
| 17 | 4 | 4 | Which building did the architect Richard Rogers design? | ▫️ A. St Paul's Cathedral（聖保羅大教堂）<br>✅ B. The Millennium Dome（千禧巨蛋）<br>▫️ C. Buckingham Palace（白金漢宮）<br>▫️ D. The Royal Albert Hall（皇家亞伯特音樂廳） | 建築師 Richard Rogers 設計咗邊座建築？ | 藝術同建築 | #154 |
| 18 | 5 | 3 | Who writes the King's Speech read at the State Opening of Parliament? | ▫️ A. The Monarch（君主）<br>▫️ B. The Speaker（議長）<br>✅ C. The Prime Minister（首相）<br>▫️ D. The Archbishop of Canterbury（坎特伯雷大主教） | 國會開幕大典宣讀嘅英王演辭由邊個寫？ | 君主 | #168 |
| 19 | 5 | 2 | Which government minister is responsible for immigration? | ▫️ A. The Chancellor of the Exchequer（財政大臣）<br>✅ B. The Home Secretary（內政大臣）<br>▫️ C. The Foreign Secretary（外交大臣）<br>▫️ D. The Attorney General（律政總長） | 邊位政府大臣負責移民事務？ | 部長同公職 | #184 |
| 20 | 5 | 2 | Which of the following is an example of a referendum? | ✅ A. The 2016 vote on whether the UK should leave the EU（2016年決定英國應否脫歐嘅投票）<br>▫️ B. A general election（大選）<br>▫️ C. A by-election（補選）<br>▫️ D. Prime Minister's Questions（首相答問大會） | 以下邊個係公投嘅例子？ | 投票 | #193 |
| 21 | 5 | 3 | Which organisation oversees elections in the UK? | ✅ A. The Electoral Commission（選舉委員會）<br>▫️ B. The Home Office（內政部）<br>▫️ C. The House of Lords（上議院）<br>▫️ D. The Supreme Court（最高法院） | 邊個機構負責監督英國嘅選舉？ | 投票 | #197 |
| 22 | 5 | 3 | Which court would usually deal with a dispute over a small amount of money? | ▫️ A. The Crown Court（刑事法院）<br>▫️ B. The Supreme Court（最高法院）<br>✅ C. The small claims court（小額錢債法庭）<br>▫️ D. The Youth Court（少年法庭） | 涉及小額金錢嘅糾紛通常由邊個法庭處理？ | 法院 | #210 |
| 23 | 5 | 4 | Youth Courts in England and Wales hear cases for young people aged: | ▫️ A. 5 to 9（5至9歲）<br>✅ B. 10 to 17（10至17歲）<br>▫️ C. 18 to 21（18至21歲）<br>▫️ D. 16 to 25（16至25歲） | 英格蘭同威爾斯嘅少年法庭審理幾多歲青少年嘅案件？ | 法院 | #212 |
| 24 | 5 | 4 | The Council of Europe is an institution of the European Union. True or False? | ▫️ A. True<br>✅ B. False | 歐洲委員會（Council of Europe）係歐盟嘅機構。對定錯？ | 歐洲人權機構 | #231 |

## 第 2 輪修改紀錄

| Exam | 換走題號 | 原則 |
|---|---|---|
| 18 | 3, 4, 5, 6, 7, 15, 23, 24 | 全部換新 fact；避開純年份、「famous as a」、反轉現有題目嘅問法 |
| 19 | 3, 4, 8, 9, 11, 13, 17, 18, 21, 22 | 同上；#4 改為雙答案題（1707 合併邊兩個國會） |
| 20 | 2, 3, 4, 8, 9, 11, 13 | 同上；#4 改為雙答案題（福利國家），補返 Vikings 題被剔走後嘅雙答案題 |

> Exam 18：Ch4 ★4 fact 只剩 #158（已畀 Exam 19），所以 #15 改用 Ch4 ★3、#23 改用 Ch5 ★4（原 ★3），全卷難度總數不變。

## 需要你決定

| # | 題目 | 問題 | 建議 |
|---|---|---|---|
| 1 | Exam 19 #24（National Minimum Wage 1998） | fact #220 冇 memo group，現有題目係「單題注解」，要新寫 note（已擬草稿，見表） | 用草稿 note；英文版 integrate 時一併加入 `NOTES_EN` |
| 2 | Exam 20 #18（King's Speech 由邊個寫） | 依 fact #168「written by the PM」出題；手冊原文講係政府嘅施政綱領 | 如你覺得有爭議，可改問「King's Speech 講咩」（政府立法計劃） |
| 3 | Exam 20 #21（Electoral Commission） | fact #197 寫「maintains the electoral register」，但手冊講登記冊由地方政府管 | 已改問「oversees elections」避開；fact #197 本身文字可另開 ticket 修 |

## 下一步（確認後）

| 步驟 | 內容 |
|---|---|
| 1 | 將 72 題寫入 `data/exams.js` 做 `18:[…] 19:[…] 20:[…]`，note 用該 memo group 現有 note 原文 |
| 2 | 喺 `data/study.js` 對應 fact 嘅 `src` 加入 `"18.i"` 等 key |
| 3 | 新 note 部分加入 `data/notesEn.js` |
| 4 | 更新 hardcode `408` / `17 Exams` 嘅 locale 同 tests（→ 480 / 20），升 minor 版本，跑 `tests/run-all.sh` |
| 5 | 開 PR 入 `main` |
