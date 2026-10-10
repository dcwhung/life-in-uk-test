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
| 10b | E2 | 用戶要睇改前改後先決定（preview 已出） | 待決定 |
| 10c | 投票權 | 女性投票權相關題全部喺投票權組；建議 table 加「19 世紀中 Chartists 憲章運動」同「20 世紀初 Suffragettes 婦女參政運動（Emmeline Pankhurst）」兩行，5.8、6.19、7.9、13.23、5.14、10.13 刪前綴 | 待確認 |
