# 記憶法拆細 review — 決定紀錄

**日期**：2026-10-10
**流程**：逐組連題目 + 答案同用戶 review；全部 review 完先一次過改 `data/exams.js`、`tests/note-table-test.js`（Q8）
**來源**：`2026-10-10_plan_memo-v2.md`、`2026-10-10_memo-v2-proposal.json`

| # | 記憶法 | 決定 | 狀態 |
|---|---|---|---|
| 1 | ⑩ 名勝（17 題） | 拆：10A 國家公園同山（7 題：9.3、13.1、10.1、3.12、4.14、7.10、4.8）、10B 古蹟同景點（6 題：14.18、4.18、5.2、11.19、7.18、16.1）；行內容一字不改；10C 取消 | 已確認 |
| 1b | N13 + 10C | 重新分 3 組：N13a 藝術同建築（10.15、7.22、2.7、10.9、5.9、12.6、8.7）、N13b 表演同節慶（6.13、8.10、5.10、8.16、11.21、13.19、11.1）、N13c 電影同媒體（15.3、16.4、14.3、10.21、12.1、15.20）；National Lottery 放 N13c | 已確認（之後再拆 N13c / N13d） |
| 1c | N13b | 用戶定稿：Proms「每年喺 Royal Albert Hall 舉行<br>為期 8 個星期嘅古典音樂節」、Notting Hill「每年 8 月喺 London 舉行<br>歐洲最大型嘅加勒比海文化街頭嘉年華」、Glastonbury「音樂節<br>每年喺 Somerset 舉行」、Theatreland「劇院區<br>喺 London 嘅 West End（西區）」（方案 C：兩格要斷行先唔出界）；唔加 East End 提示 | 已確認 |
| 1d | N13c / N13d | 拆開：N13c 電影（15.3、16.4、14.3，列點 + 中文譯名 +「Emily Watson 冇贏過」）、N13d 媒體同公益（10.21、12.1、15.20，table） | 已確認 |
| 1e | 14.3 | 刪舊前綴，中文譯名加入 N13c 列點 | 已確認 |
| 1f | N13a | 改寫「身份 + 代表作 / 地點」；National Galleries of Scotland 名稱格加「<br>蘇格蘭國家美術館」令英文名分行（用戶要求） | 已確認 |
| — | 語體 | 記憶法一律用廣東話口語（喺、嘅），用戶 2026-10-10 | 已確認 |
| 2 | ⑦ 英國重要戰役（17 題） | 拆：7A 中世紀戰役（9 世紀、1066、1314；2.10、4.17、6.18、9.20、17.17、7.5）、7B 打敗西班牙同法國（1588、1805、1815；1.11、16.20、6.11、12.3、14.5、4.0、9.1、4.23、16.12）；行內容一字不改；前綴照留 | 已確認 |
| 2b | ⑦ 1940 行 | Battle of Britain 兩題（11.6、17.12）併入 ⑧ 二戰（table 已有 1940 行），邱吉爾金句前綴照留；⑧ 變 11 題 | 已確認 |
| 3 | ④ 地方議會（10 題） | 拆：4A 地方議會（table 不變 + 頭兩行列點；6.8、8.19、13.7、4.20、5.22、7.17、9.18、12.2）、4B 選舉制度 | 已確認 |
| 3b | 4B 選舉制度 | 用戶定稿：「• 比例代表制（proportional representation）／    → 議席按得票比例分配／    → Scotland、Wales、N. Ireland 三個議會用／• 領先者當選制（first past the post）／    → 選區得票最多嗰個贏／    → 英國國會大選用」；題目 14.1、17.6 + 8.8、17.18（刪「英國大選用呢個制度」前綴） | 已確認 |
| 4 | 三層屬地（7 題） | 拆：三層 A Crown dependency（1.19、5.19、12.0、17.5；• 主項 + → 子項 + 陷阱兩行）、三層 B 英國海外領土（2.1、5.3、11.0）；地名保留中文譯名 | 已確認 |
| 4b | 三層 B | 用戶定稿字眼；最尾一行用「    ※ 同英國有聯繫，但唔係英國、亦唔係 Great Britain 一部分」 | 已確認 |
| 4c | E4 | 三層拆開之後，Great Britain / 位置兩行（4.6、6.5、17.8、1.3）要另外再傾放邊 | 待傾 |
| 5 | 都鐸王朝（14 題） | 拆：5A 宗教改革（3.3、13.22、17.9、2.13、8.23、12.8；字眼照草稿）、5B 都鐸王朝（1.5、13.11、17.13、3.21、8.5、16.2） | 已確認 |
| 5b | 5B | 用戶 v2：續行（8 空格、冇符號）放 York vs Lancaster、兩位被處決妻子；app 只得兩層，續行會縮返去對齊「•」文字 → 用戶揀 A：改 app code，8+ 空格冇符號 = 續行（`.rv-note-line.cont`，padding-left 2 × indent、text-indent 0），對齊「→」後面文字；改 `js/components/tags.js` noteLineHtml + `css/components/note.css` + 測試 | 已確認 |
| 5c | 4.15、11.15 | 搬去 ② 教會 table（E1）：England 格「Church of England<br>Henry VIII 創立；君主係最高領袖，Archbishop of Canterbury（坎特伯雷大主教）係精神領袖」，刪重複前綴；② 變 7 題 | 已確認 |
| 5d | 5A | 字眼照草稿 | 已確認 |
| 6 | ⑨ 國王 vs 國會（8 題） | 唔拆；格式改「English 中文：<br>經過」（用戶定稿 1628 / 1642–51 / 1660）；1649 同 1688 要再執：建議 1649「Commonwealth 共和國：<br>Charles I 被處決，英格蘭冇咗君主<br>Oliver Cromwell（克倫威爾）做 Lord Protector（護國公），到 1658 年」、1688「Glorious Revolution 光榮革命：<br>James II（詹姆斯二世）被和平取代<br>William of Orange（奧蘭治的威廉）做國王 → 開始君主立憲」 | 已確認 |
| 6b | X7 譯名 | James II →「詹姆斯二世」（用戶 2026-10-10；同 `yue-terms.md`「James → 詹姆斯」一致）；⑨ table 8 題嘅「詹姆士二世」一齊改；「聖詹姆士宮」係地名，唔郁 | 已確認 |
| 7 | ⑤ 發明家（8 題） | 唔拆；分三欄「年份 / 人物 / 發明 / 發現」；Newton 格只留「萬有引力、運動定律」；Woolsthorpe / Royal Mint 保留做 8.11、4.7、8.21 前綴（專有名詞英文：「Isaac Newton（牛頓）喺 Lincolnshire（林肯郡）Woolsthorpe 出世，後來做過 Royal Mint（皇家鑄幣廠）嘅 Warden / Master」） | 已確認；細字英文大楷開頭（Penicillin、Jet engine） |
| 8 | ⑥ 全年節日（15 題） | 唔拆；用戶定稿：25/1「Burns Night 彭斯之夜：<br>紀念蘇格蘭詩人 Robert Burns<br>佢寫咗 Auld Lang Syne」、5/11「Bonfire Night 篝火之夜：<br>又叫 Guy Fawkes Night<br>紀念 1605 年 Guy Fawkes 等人<br>火藥陰謀（Gunpowder Plot）失敗」、11/11「Remembrance Day 國殤紀念日：<br>又叫 Armistice Day（停戰紀念日）<br>紀念 1918 年 11/11 上午 11 時一戰停戰同戰爭死難者；<br>戴紅罌粟花」，其餘照建議；Guy Fawkes / Armistice Day 前綴搬入 table，6 題刪前綴 | 已確認 |
| 9 | ⑧ 二戰（11 題） | 唔拆；跟 ⑨ 格式；1940 行分開：Churchill 任期 1940–45、1951–55 / Dunkirk / Battle of Britain 結果；D-Day 加「盟軍喺法國 Normandy（諾曼第）海灘登陸<br>開始反攻，解放西歐」；11.6、17.12 保留邱吉爾金句前綴；1939 改「Germany invades Poland：<br>德國入侵波蘭<br>英國同法國宣戰，二戰開始」（原本主文差 5px 唔夠位） | 已確認 |
| 10 | ① 聖人、③ 首都 / 國花、② 教會、投票權 | 用戶：直接整理。①③ 加中文譯名細字；② 用第 5 組版本；投票權改 table（標題「記憶法（投票權）：」，1689 加「確認國會權利」→ 1.6、7.2 刪前綴） | 已確認 |
| 10b | E2 | 用戶結構：table 下面加「• Union Jack → 紅、白、藍，由三個聖人十字組成／    → England 聖人十字：白底紅色十字／    → Scotland 聖人十字：藍底白色 X 形十字／    → Ireland 聖人十字：白底紅色 X 形十字／    → 冇 Wales／• St Andrew → 喺 X 形十字架上殉道，所以 Scotland 聖人十字係 X 形」；5.13、14.6 加入 ①（12 題），刪舊前綴；唔要英文十字名 | 已確認 |
| 10c | 投票權 | table 加「19 世紀中 Chartists 憲章運動：<br>爭取所有男性有票」同「20 世紀初 Suffragettes 婦女參政運動：<br>Emmeline Pankhurst 帶領，爭取女性有票」兩行，5.8、6.19、7.9、13.23、5.14、10.13 刪前綴 | 已確認 |
| 11 | N1 公民責任同基本原則 | 用戶：N1a、N1b 都用 table「# ｜ English<br>中文」；拆：N1a 基本原則（3.0、5.4、6.12、8.9；「• English → 中文」5 行 + 陷阱 Monarchy）、N1b 公民責任（1.0、6.0、7.0、9.4、15.7；6 行 + 陷阱「投票、去教堂、參軍、做義工、永遠留喺英國都唔係責任」）；取代舊單句前綴 | 已確認 |
| 12 | N2 早期英國（10 題：2.6、15.4、6.1、12.4、2.9、13.2、2.18、16.15、16.3、17.14） | 用戶定稿 table 8 行；AD 60「Boudicca（布迪卡）：<br>Iceni（英格蘭東部部落愛西尼族）女王，反抗羅馬」；AD 410「Romans leave 羅馬人撤走：<br>北歐部落 Jutes、Angles、Saxons 移入」（用戶原文頓號位置執正）；7A 9 世紀行照留 | 已確認 |
| 13 | N3 諾曼征服（7 題：17.19、15.0、11.16、16.9、4.13、10.7、13.6） | 用戶定稿 table 4 行：1066「Norman Conquest 諾曼征服：<br>法國北部 Normandy（諾曼第）公爵<br>William 入侵英國，喺 Battle of Hastings<br>打敗英格蘭國王 Harold，佔領英格蘭<br>之後就被人叫 William the Conqueror<br>（征服者威廉）」、「- ｜ Bayeux Tapestry 貝葉掛毯：<br>一幅刺繡，記錄諾曼征服」、之後（英格蘭大改變）、1086（由 William the Conqueror 下令編製）；7A 1066 行兩邊照留 | 已確認 |
| 14 | N4 中世紀（6 題：3.4、9.21、9.15、14.9、10.3、13.3） | table 3 行：1337–1453 百年戰爭（英格蘭國王同法國打仗 / 其實打咗 116 年）、1348 黑死病（瘟疫傳入英格蘭 / 大約三分一人口死亡）、14 世紀 The Canterbury Tales（坎特伯雷故事集 / Geoffrey Chaucer（喬叟）寫 / 講一班人去 Canterbury 朝聖） | 已確認 |
| 15 | N5 倫敦大火（5 題：4.2、7.19、11.11、14.15、7.7） | table 3 行：1666 Great Fire of London（Charles II 年代 / 燒毀咗 London 大片地方 / 包括 St Paul's Cathedral）、- Samuel Pepys（寫日記記錄倫敦大火）、之後 St Paul's Cathedral（由 Sir Christopher Wren（雷恩）重新設計） | 已確認 |
| 16 | N6 聯合王國點樣形成（5 題：10.8、12.14、13.17、10.14、2.5） | 用戶定稿 table 5 行：1536「Act for the Government of Wales：<br>Henry VIII（亨利八世）年代<br>Wales 正式併入 England」（用戶要求加；分兩行唔斷字）、1707 / 1800 Act of Union、1922 Irish Free State（Southern Ireland 脫離 UK / Northern Ireland 留喺 UK）、1949 Republic of Ireland | 已確認 |
| 17 | N7 18 世紀（9 題：10.23、11.23、14.2、3.5、11.4、14.4、15.1、7.4、13.15） | 用戶定稿全 table 5 行；啟蒙運動「好多學者提出政治、哲學、科學新諗法<br>例如 Adam Smith（亞當·斯密）<br>研究經濟學，寫咗《國富論》<br>（The Wealth of Nations）」（書名中文先，英文括號）；Scottish Highlands 唔加中文 | 已確認 |
| 17b | N7 次序 | 用戶問「18 世紀」放 1776 前有冇問題 → 建議確實年份先（1721–42、1745、1776），跨成個世紀嘅 Enlightenment（18 世紀）、Industrial Revolution（18 世紀起）放尾 | 已確認 |
| 18 | N8 19 世紀（11 題） | 用戶：分做兩個記憶法 → N8a 19 世紀事件（14.23、16.18、10.20、17.1、6.10；table 1807 / 1840s / 1899–1902，1807 加「由 MP William Wilberforce 推動」）已確認；N8b 人物：用戶要睇之後有冇人物記憶法可併 → 建議 Brunel 搬入 ⑤（「19 世紀 ｜ I. K. Brunel<br>布魯內爾（工程師） ｜ 橋、隧道、船<br>Great Western Railway」，7.23 轉 ⑤），餘下 Wilberforce、Mahomet、Nightingale 留 N8b（N10–N25 冇同類） | N8a 已確認；Brunel 搬入 ⑤ 已確認；N8b 留 3 人已確認 |
| 18b | N8b 格式 | 用戶：N8b 要用 table →「年份 ｜ 人物」3 行（1807 Wilberforce、約 1810 Sake Dean Mahomet、1853–56 Nightingale） | 已確認 |
| 19 | ⑤ 斷行 | 三欄喺手機多格斷行 → 方案 A（刪年份欄，年份入人物細字；仍有 4 格斷行）、方案 B（兩欄跟 ⑨ 格式「人名 中文：<br>發明」；冇斷行）→ 用戶：唔改，保持三欄（Brunel 行照加：「19 世紀 ｜ I. K. Brunel<br>布魯內爾（工程師） ｜ 橋、隧道、船<br>Great Western Railway」） | 已確認 |
| 20 | N9 一次世界大戰（4 題：15.23、17.15、4.12、15.5） | 標題改「記憶法（一次世界大戰）：」；table 3 行 1914 / 1916 / 1918；刪「女性 30 歲以上有票」（投票權已有） | 已確認 |
| 20b | ⑧ 標題 | 「記憶法（二戰）：」改「記憶法（二次世界大戰）：」（同 N9 一致；9 題） | 已確認 |
| 21 | N10 戰後英國 | 拆：N10a 戰後重建（9.9、12.10、13.14、17.7、11.14、17.20、15.11、13.8；用戶加「成為」「設立」）、N10b（3.17、13.10、13.21、15.13、16.19）；E8：13.8 搬入 N10a，刪舊前綴同投票權時間線 | 已確認 |
| 21b | N10 細節 | Windrush：用戶寫「第一批 Caribbean（加勒比海）移民：<br>坐 Empire Windrush 疾風號移民嚟英國」，兩句都斷行 → 建議「Caribbean（加勒比海）移民：<br>第一批坐 Empire Windrush<br>疾風號移民嚟英國」；N10b 標題「記憶法（20 世紀後期）：」、1973 主字「European Community 歐洲共同體」已確認 | 已確認 |
| 22 | N11 運動 | 建議拆：N11a 運動賽事（7.3、10.16、12.21、6.7；「幾時 ｜ 賽事」：- Ashes / 每年 6–7 月 Wimbledon / 每 4 年 Commonwealth Games）、N11b 運動員（5.20、5.16、1.10、2.20；1953 / 1954 / 1966 / 1984） | 已確認 |
| 23 | N12 作家同詩人 | 建議拆：N12a 作家（9.5、9.17、12.9、13.20、4.21、15.10、16.14、3.19、8.18；「類型 ｜ 作家 中文：<br>作品」5 行）、N12b 詩人（1.21、12.22、11.12、14.21；3 行，Kipling 寫埋 The Jungle Book）；Dickens 只留 A Christmas Carol（另外兩本刪） | 已確認 |
| 24 | N14 節日同假期（11 題） | 建議 table「宗教 ｜ 節日」6 行（Lent、Easter、Eid al-Fitr、Eid ul Adha、Diwali、Vaisakhi）+ Bank holiday 一點；唔併入 ⑥（冇固定日子） | 已確認 |
| 25 | N15 倫敦地標（6 題：1.1、10.11、6.2、3.8、12.11、10.17） | 用戶：地標名同註解分開 → 兩欄「地標 ｜ 註解」：Big Ben（國會大廈嘅大鐘 / Houses of Parliament）、Buckingham Palace（君主官方住所 / 喺 London）、Tower of London（1066 年後起 / William the Conqueror / 守衛兼導賞： / Beefeaters /（Yeoman Warders）/ 放 Crown Jewels / 加冕用嘅皇冠珠寶）；唔併入 10B | 已確認 |
| 26 | N16 君主同國會（19 題） | 用戶：拆兩組 → N16a 君主（13.9、14.16、16.21、2.12、10.12、13.18、17.10）、N16b 國會兩院（5.17、1.9、5.12、6.21、15.9、17.3、4.19、7.16、17.23、7.20、16.13、2.2；「國會分兩院」列點 + table「院 ｜ 重點」7 行）；內容之後再睇 | 已確認 |
| 26b | N16b 國會兩院內容 | 用戶定稿：同一院只喺第一行寫「下議院」/「上議院」，其餘行左欄留空 | 已確認 |
| 27 | N17 政府職位（14 題） | 拆：N17a 首相同內閣（16.8、4.9、12.13、5.11、9.12、17.2；3 行）已確認；N17b 部長同公職（2.0、8.3、7.11、12.15、8.20、9.22、11.17、16.11）：用戶話冇動詞睇唔明 → 改句子：負責罪案、警政同移民 / 負責經濟同國家財政 / 負責法院同法律制度（限英格蘭同威爾斯）/ 做政府首席法律顧問 / 執行政府政策，要保持政治中立 / 調查市民投訴，針對政府部門同公共服務 | 已確認 |
| 28 | N18 投票（6 題：13.13、1.16、14.11、8.17、1.18、17.11） | 建議「項目 ｜ 註解」6 行：投票資格、Poll card、Hung parliament、Referendum、選舉報道、Electoral Commission；first past the post 留喺 4B（8.8、17.18 唔入 N18）；17.11 嘅「實際由地方議會管理」註腳刪 | 已確認 |
| 29 | N19 法律原則同法院（14 題） | 建議拆三組：N19a 法律原則（2.22、5.23、11.10、15.8、14.19、14.8；4 行）、N19b 法院（7.6、3.14、16.5、6.17；4 行）、N19c 法律服務（1.17、14.22、14.17、17.16；3 行）；「項目 ｜ 註解」兩欄，註解有動詞；16.5 刪 Crown Court 一句 | 已確認 |
| 30 | N20 人權同平等（8 題） | 建議拆：N20a 歐洲人權機構（8.14、15.18、6.23、9.16；Council of Europe / Convention / Court）、N20b 英國人權同平等（14.10、15.14、16.7、12.20；HRA 1998 / Equality Act 2010 / EHRC）；名太長，兩欄會壓到斷晒行，所以用「# ｜ 名稱 / 註解」（主字英文名，細字中文名 + 註解）；6.23、9.16 刪「2022 年起 46 個」註腳；用戶：拆法同格式 OK，註解（中文名之後嘅細字）用「• 」開頭 | 已確認 |
| 30b | table 格入面 bullet 縮入 | 用戶：N20 bullet 要再縮入 → 建議改 app code：noteCellHtml 遇到「• 」開頭嘅細字加 class bullet；note.css `.note-cell-sub.bullet { padding-left: 1.8em; text-indent: -0.9em; }`（縮入兼懸掛縮排，斷行會對齊文字）；同 5B .cont 一齊做，要加測試 | 已確認 |
| 31 | N21 國際組織（9 題） | 建議「# ｜ 名稱 / 註解」+ 縮入 bullet，5 行：Commonwealth、UN、UN Security Council（新加，10.19 用）、UN General Assembly、NATO；刪「2022 年起 56 個」；用戶改「• 54 個成員國」（刪「考試答」） | 已確認 |
| 32 | N22 慈善同義工（6 題：4.5、11.5、12.16、9.13、3.7、15.15） | 建議「# ｜ 名稱 / 註解」+ 縮入 bullet，5 行：National Trust、Friends of the Earth、Age UK、NSPCC（寫埋英文全名）、National Citizen Service | 待確認 |
