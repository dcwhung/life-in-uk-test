// Generated from .proj-docs/plans/2026-10-10_memo-v2-proposal.json (single source; regenerate, do not hand edit)
const PROPOSAL = {
  "_doc": "Proposal only (Q8: user confirms before data changes). ids = \"exam.idx\" (0-based). kind: fill = add an existing memory method to questions of a fact that only partly has it; extend = add lines/questions to an existing method; new = new method. body = exact note text after the heading line (lines joined with \\n when applied). Table rows start with |, cells use <br> for the Chinese sub-line.",
  "base": "main @ 92dd27e (v1.0.8)",
  "groups": [
    {
      "id": "F1",
      "kind": "fill",
      "memo": "M3 英國重要戰役",
      "title": "1066 知識點補齊",
      "add": [
        "17.17"
      ],
      "why": "F16 其餘 3 題已有戰役記憶法"
    },
    {
      "id": "F2",
      "kind": "fill",
      "memo": "M5 都鐸王朝",
      "title": "宗教改革知識點補齊",
      "add": [
        "17.9"
      ],
      "why": "F28 其餘 2 題已有"
    },
    {
      "id": "F3",
      "kind": "fill",
      "memo": "M5 都鐸王朝",
      "title": "解散修道院補齊",
      "add": [
        "2.13"
      ],
      "why": "F29 其餘 2 題已有"
    },
    {
      "id": "F4",
      "kind": "fill",
      "memo": "M5 都鐸王朝",
      "title": "Mary, Queen of Scots 補齊",
      "add": [
        "3.21",
        "8.5"
      ],
      "why": "F31 16.2 已有"
    },
    {
      "id": "F5",
      "kind": "fill",
      "memo": "M8 發明家",
      "title": "Newton 補齊",
      "add": [
        "4.7",
        "8.21"
      ],
      "why": "F49 8.11 已有",
      "prefix": "Isaac Newton（牛頓）喺林肯郡 Woolsthorpe 出世，後來做過皇家鑄幣廠（Royal Mint）嘅 Warden / Master。"
    },
    {
      "id": "F6",
      "kind": "fill",
      "memo": "M3 英國重要戰役",
      "title": "Iron Duke 補齊",
      "add": [
        "4.23"
      ],
      "why": "F57 其餘 3 題已有",
      "prefix": "Duke of Wellington（威靈頓公爵）綽號 Iron Duke（鐵公爵），後來做咗首相。"
    },
    {
      "id": "F7",
      "kind": "fill",
      "memo": "M7 投票權時間線",
      "title": "1832 補齊",
      "add": [
        "12.17"
      ],
      "why": "F59 11.20 已有"
    },
    {
      "id": "F8",
      "kind": "fill",
      "memo": "M16 地方議會",
      "title": "比例代表制補齊",
      "add": [
        "17.6"
      ],
      "why": "F192 14.1 已有；17.6 現有前綴同 M16 最後兩行重複，建議刪前綴"
    },
    {
      "id": "F9",
      "kind": "fill",
      "memo": "M9 全年節日",
      "title": "節日補齊",
      "add": [
        "3.23",
        "3.2",
        "14.13",
        "17.22",
        "7.8"
      ],
      "why": "F113 / F114 / F115 其餘題已有；7.8 火藥陰謀保留「Guy Fawkes 係主要人物」前綴",
      "keep_prefix": [
        "7.8"
      ]
    },
    {
      "id": "E1",
      "kind": "extend",
      "memo": "M13 國教 / 教會",
      "title": "英格蘭國教會兩題搬入教會 table",
      "add": [
        "4.15",
        "11.15"
      ],
      "move_from": {
        "4.15": "M5 都鐸王朝"
      },
      "change": "England 格加「Henry VIII 創立」：| England | ✓ | Church of England<br>Henry VIII 創立；君主係最高領袖，坎特伯雷大主教係精神領袖 |",
      "why": "F103 兩題而家一題用都鐸、一題得前綴；教會 table 已經寫咗君主係最高領袖"
    },
    {
      "id": "E2",
      "kind": "extend",
      "memo": "M12 聖人 / 日子",
      "title": "聖安德魯十字 + Union Jack",
      "add": [
        "5.13",
        "14.6"
      ],
      "append": [
        "• St Andrew → 喺 X 形十字架上殉道 → 蘇格蘭國旗係藍底白色 X 形十字；",
        "• Union Jack → 紅、白、藍，結合 England、Scotland、Ireland 三個聖人十字（冇 Wales）。"
      ],
      "why": "兩題都係聖人十字，放埋一齊記"
    },
    {
      "id": "E3",
      "kind": "extend",
      "memo": "M14 首都 / 國花",
      "title": "加語言",
      "add": [
        "6.20",
        "13.12"
      ],
      "append": [
        "• 語言 → Wales 講 Welsh（威爾斯語）；Gaelic（蓋爾語）係蘇格蘭同愛爾蘭部分地區講嘅凱爾特語。"
      ],
      "why": "四地對照，同首都 / 國花一齊記"
    },
    {
      "id": "E4",
      "kind": "extend",
      "memo": "M1 三層",
      "title": "加 Great Britain 同位置",
      "add": [
        "4.6",
        "6.5",
        "17.8",
        "1.3"
      ],
      "insert_after_first_line": [
        "• Great Britain（大不列顛）→ England、Scotland、Wales，冇 Northern Ireland；",
        "• 位置 → 歐洲西北部；"
      ],
      "why": "UK vs Great Britain 同三層屬地係同一套概念"
    },
    {
      "id": "E5",
      "kind": "extend",
      "memo": "M2 名勝",
      "title": "加國家公園定義",
      "add": [
        "6.3"
      ],
      "append": [
        "• National Parks（國家公園）→ 受保護嘅郊野，England、Wales、Scotland 一共 15 個。"
      ],
      "why": "table 已有 3 個國家公園"
    },
    {
      "id": "E6",
      "kind": "extend",
      "memo": "M16 地方議會",
      "title": "加權力下放同地區議會",
      "add": [
        "10.10",
        "12.12",
        "9.14",
        "12.18",
        "12.5"
      ],
      "append": [
        "• Devolution（權力下放）→ 中央將權力轉俾 Scotland、Wales、N. Ireland；",
        "• 國防、外交、移民 → 冇下放，由英國政府負責；",
        "• 地區議會（local councils）→ 民選，提供教育、垃圾處理、房屋等服務，唔係政府委任。"
      ],
      "change": "最後一行「英國國會用領先者當選制（first past the post）」補「；」（新最後一行用「。」）",
      "why": "同一主題：邊層政府管邊樣"
    },
    {
      "id": "E7",
      "kind": "extend",
      "memo": "M9 全年節日",
      "title": "和平紀念碑加節日記憶法",
      "add": [
        "1.7",
        "11.8"
      ],
      "keep_prefix": true,
      "why": "現有 R1 前綴（11 月 11 日 / Remembrance Sunday）保留喺記憶法上面"
    },
    {
      "id": "E8",
      "kind": "move",
      "memo": "M7 投票權時間線 → N9 戰後英國",
      "title": "1945 大選",
      "add": [
        "13.8"
      ],
      "why": "13.8 問 1945 年邊個贏大選，同投票權冇關；放戰後英國時間線更順"
    },
    {
      "id": "N1",
      "kind": "new",
      "title": "公民責任同基本原則",
      "heading": "記憶法（公民責任同基本原則）：",
      "add": [
        "1.0",
        "6.0",
        "7.0",
        "9.4",
        "15.7",
        "3.0",
        "5.4",
        "6.12",
        "8.9"
      ],
      "body": [
        "• 5 大基本原則 → 民主（democracy）、法治（rule of law）、個人自由（individual liberty）、包容唔同信仰（tolerance）、參與社區（participation in community life）；",
        "• 公民責任 → 守法、尊重他人權利、公平待人、照顧自己同家人、照顧居住環境、交稅；",
        "• 陷阱 → 君主制（Monarchy）唔係基本原則。"
      ]
    },
    {
      "id": "N2",
      "kind": "new",
      "title": "早期英國",
      "heading": "記憶法（早期英國）：",
      "add": [
        "2.6",
        "15.4",
        "6.1",
        "12.4",
        "2.9",
        "13.2",
        "2.18",
        "16.15",
        "16.3",
        "17.14"
      ],
      "body": [
        "| 年代 | 事件 |",
        "| 約 6,000 年前 | First farmers<br>第一批農夫，由東南歐嚟 |",
        "| Iron Age | First coins<br>鐵器時代第一批硬幣，刻住國王個名 |",
        "| 55 BC | Julius Caesar<br>凱撒第一次入侵，失敗 |",
        "| AD 43 | Claudius<br>羅馬成功佔領 |",
        "| AD 60 | Boudicca<br>愛西尼族女王反抗羅馬 |",
        "| AD 122 | Hadrian's Wall<br>哈德良長城，羅馬帝國北界 |",
        "| AD 410 | Romans leave<br>Jutes、Angles、Saxons 移入 |",
        "| 9–10 世紀 | Vikings<br>維京人用長船貿易同掠奪 |"
      ]
    },
    {
      "id": "N3",
      "kind": "new",
      "title": "諾曼征服",
      "heading": "記憶法（諾曼征服）：",
      "add": [
        "17.19",
        "15.0",
        "11.16",
        "16.9",
        "4.13",
        "10.7",
        "13.6"
      ],
      "body": [
        "| 年份 | 事件 |",
        "| 1066 | Norman Conquest<br>諾曼人係定居法國北部嘅維京人後裔；Bayeux Tapestry（貝葉掛毯）記錄征服 |",
        "| 之後 | New ruling class<br>新統治階層、新法律、各地起城堡 |",
        "| 中世紀 | Languages<br>貴族講諾曼法語，農民講盎格魯-撒克遜語 |",
        "| 1086 | Domesday Book<br>末日審判書：征服者威廉下令記錄土地同財產 |"
      ]
    },
    {
      "id": "N4",
      "kind": "new",
      "title": "中世紀",
      "heading": "記憶法（中世紀）：",
      "add": [
        "3.4",
        "9.21",
        "9.15",
        "14.9",
        "10.3",
        "13.3"
      ],
      "body": [
        "| 年份 | 事件 |",
        "| 1337–1453 | Hundred Years War<br>百年戰爭：英法打咗 116 年 |",
        "| 1348 | Black Death<br>黑死病：大約三分一人口死亡 |",
        "| 14 世紀 | The Canterbury Tales<br>喬叟：一班人去坎特伯雷朝聖 |"
      ]
    },
    {
      "id": "N5",
      "kind": "new",
      "title": "倫敦大火",
      "heading": "記憶法（倫敦大火）：",
      "add": [
        "4.2",
        "7.19",
        "11.11",
        "14.15",
        "7.7"
      ],
      "body": [
        "• 1666 → Charles II（查理二世）年代，Great Fire of London（倫敦大火）；",
        "• 記錄 → Samuel Pepys（佩皮斯）寫日記；",
        "• 重建 → Sir Christopher Wren（雷恩）設計新嘅 St Paul's Cathedral（聖保羅大教堂）。"
      ]
    },
    {
      "id": "N6",
      "kind": "new",
      "title": "聯合王國點樣形成",
      "heading": "記憶法（聯合王國點樣形成）：",
      "add": [
        "10.8",
        "12.14",
        "13.17",
        "10.14",
        "2.5"
      ],
      "body": [
        "| 年份 | 事件 |",
        "| 1707 | Act of Union<br>England + Scotland → Kingdom of Great Britain |",
        "| 1800 | Act of Union<br>再加 Ireland → United Kingdom of Great Britain and Ireland |",
        "| 1949 | Ireland 成為共和國<br>Northern Ireland 留喺 UK |"
      ]
    },
    {
      "id": "N7",
      "kind": "new",
      "title": "18 世紀",
      "heading": "記憶法（18 世紀）：",
      "add": [
        "10.23",
        "11.23",
        "14.2",
        "3.5",
        "11.4",
        "14.4",
        "15.1",
        "7.4",
        "13.15"
      ],
      "body": [
        "| 年份 | 事件 |",
        "| 1721–42 | Robert Walpole<br>第一位首相 |",
        "| 1745 | Bonnie Prince Charlie<br>英俊王子查理帶蘇格蘭高地人起兵 |",
        "| 18 世紀 | Enlightenment<br>啟蒙運動：Adam Smith 經濟學 |",
        "| 1776 | 13 colonies<br>北美 13 個殖民地宣佈獨立 |",
        "| 18–19 世紀 | Industrial Revolution<br>工業革命：製造業變成最大就業來源 |"
      ]
    },
    {
      "id": "N8",
      "kind": "new",
      "title": "19 世紀",
      "heading": "記憶法（19 世紀）：",
      "add": [
        "8.15",
        "14.23",
        "16.18",
        "2.11",
        "16.23",
        "7.23",
        "10.20",
        "17.1",
        "5.7",
        "10.18",
        "6.10"
      ],
      "body": [
        "| 年份 | 人物 / 事件 |",
        "| 1807 | Slave Trade Act<br>William Wilberforce（威伯福斯）推動廢除奴隸貿易 |",
        "| 約 1810 | Sake Dean Mahomet<br>倫敦第一間咖喱屋，引入 shampooing |",
        "| 維多利亞時代 | Isambard Kingdom Brunel<br>工程師：橋、隧道、鐵路、船 |",
        "| 1840s | Irish famine<br>薯仔失收，大約 100 萬人死 |",
        "| 1853–56 | Florence Nightingale<br>南丁格爾：克里米亞戰爭改善醫院 |",
        "| 1899–1902 | Boer War<br>波爾戰爭：喺南非打 |"
      ]
    },
    {
      "id": "N9",
      "kind": "new",
      "title": "一戰",
      "heading": "記憶法（一戰）：",
      "add": [
        "15.23",
        "17.15",
        "4.12",
        "15.5"
      ],
      "body": [
        "| 年份 | 事件 |",
        "| 1914 | 一戰開始<br>斐迪南大公遇刺 + 複雜同盟 |",
        "| 1916 | Battle of the Somme<br>索姆河戰役：第一日大約 20,000 英軍陣亡 |",
        "| 1918 | 11/11 上午 11 時停戰<br>女性 30 歲以上有票 |"
      ]
    },
    {
      "id": "N10",
      "kind": "new",
      "title": "戰後英國",
      "heading": "記憶法（戰後英國）：",
      "add": [
        "9.9",
        "12.10",
        "13.14",
        "17.7",
        "11.14",
        "17.20",
        "15.11",
        "3.17",
        "13.10",
        "13.21",
        "15.13",
        "16.19"
      ],
      "body": [
        "| 年份 | 事件 |",
        "| 1945 | Labour 贏大選<br>Clement Attlee（艾德禮）做首相 |",
        "| 1948 | NHS<br>國民保健服務：用嗰陣免費；Aneurin Bevan 推動 |",
        "| 1948 | Windrush<br>疾風號：加勒比海移民 |",
        "| 二戰後 | Welfare State<br>福利國家：社會保障、醫療、教育 |",
        "| 1973 | European Community<br>加入歐洲共同體；2020 年脫歐 |",
        "| 1989 | Berlin Wall<br>柏林圍牆倒塌，冷戰結束 |",
        "| 1998 | Good Friday Agreement<br>耶穌受難日協議：北愛和平 |"
      ]
    },
    {
      "id": "N11",
      "kind": "new",
      "title": "運動",
      "heading": "記憶法（運動）：",
      "add": [
        "7.3",
        "10.16",
        "12.21",
        "6.7",
        "5.20",
        "5.16",
        "1.10",
        "2.20"
      ],
      "body": [
        "| 時間 | 項目 / 人物 |",
        "| 每年 | The Ashes<br>灰燼盃：England vs Australia 板球 |",
        "| 每年 6–7 月 | Wimbledon<br>溫布頓：倫敦草地網球大滿貫 |",
        "| 每 4 年 | Commonwealth Games<br>英聯邦運動會 |",
        "| 1953 | Hillary & Tenzing<br>第一次登上珠穆朗瑪峰 |",
        "| 1954 | Roger Bannister<br>第一個 4 分鐘內跑完一英里 |",
        "| 1966 | Bobby Moore<br>英格蘭世界盃冠軍隊長 |",
        "| 1984 | Torvill & Dean<br>冰上舞蹈奧運金牌 |"
      ]
    },
    {
      "id": "N12",
      "kind": "new",
      "title": "作家同詩人",
      "heading": "記憶法（作家同詩人）：",
      "add": [
        "9.5",
        "9.17",
        "12.9",
        "13.20",
        "4.21",
        "15.10",
        "16.14",
        "3.19",
        "8.18",
        "1.21",
        "12.22",
        "11.12",
        "14.21"
      ],
      "body": [
        "| 作家 | 作品 |",
        "| Shakespeare | Hamlet、A Midsummer Night's Dream<br>Stratford-upon-Avon 出世同讀書 |",
        "| Jane Austen | Pride and Prejudice<br>傲慢與偏見 |",
        "| Charlotte Brontë | Jane Eyre<br>簡愛 |",
        "| Mary Shelley | Frankenstein<br>科學怪人 |",
        "| Charles Dickens | A Christmas Carol<br>聖誕頌歌；維多利亞時代小說家 |",
        "| Wordsworth | The Daffodils<br>水仙花（詩） |",
        "| John Keats | Ode to a Nightingale<br>夜鶯頌（詩） |",
        "| Rudyard Kipling | If、The Jungle Book<br>如果（詩）、森林王子 |"
      ]
    },
    {
      "id": "N13",
      "kind": "new",
      "title": "藝術、媒體同表演",
      "heading": "記憶法（藝術同表演）：",
      "add": [
        "10.15",
        "7.22",
        "2.7",
        "10.9",
        "5.9",
        "6.13",
        "8.10",
        "5.10",
        "8.16",
        "11.1",
        "15.3",
        "16.4",
        "15.20",
        "14.3",
        "10.21",
        "12.1"
      ],
      "keep_prefix": [
        "14.3"
      ],
      "body": [
        "| 名稱 | 重點 |",
        "| J.M.W. Turner | The Fighting Temeraire<br>透納：風景畫家；Turner Prize 每年頒俾英國視覺藝術家 |",
        "| David Hockney | Pop art<br>1960 年代普普藝術 |",
        "| Purcell & Handel | Baroque<br>巴洛克作曲家 |",
        "| Richard Rogers | Millennium Dome<br>千禧穹頂 |",
        "| The Proms | Royal Albert Hall<br>每年 8 個星期古典音樂節 |",
        "| Notting Hill Carnival | London，每年 8 月<br>加勒比海文化 |",
        "| Theatreland | West End<br>倫敦西區 |",
        "| Films | Harry Potter、James Bond<br>英國最高票房電影系列，兩個都啱 |",
        "| National Lottery | 1994<br>為藝術、體育、文化遺產籌款 |",
        "| BBC | 全球最大廣播機構<br>獨立於政府 |"
      ]
    },
    {
      "id": "N14",
      "kind": "new",
      "title": "節日同假期",
      "heading": "記憶法（宗教節日）：",
      "add": [
        "1.23",
        "5.0",
        "3.10",
        "5.15",
        "4.11",
        "11.3",
        "15.17",
        "5.18",
        "1.15",
        "10.5",
        "13.4"
      ],
      "body": [
        "| 節日 | 宗教 / 意義 |",
        "| Lent | Christian<br>大齋期：復活節前 40 日 |",
        "| Easter | Christian<br>復活節：3 月或者 4 月 |",
        "| Eid al-Fitr | Muslim<br>開齋節：齋戒月（Ramadan）完結 |",
        "| Eid ul Adha | Muslim<br>宰牲節：紀念易卜拉欣願意犧牲兒子 |",
        "| Diwali | Hindu + Sikh<br>排燈節（Festival of Lights） |",
        "| Vaisakhi | Sikh<br>光輝節：每年 4 月，紀念 Khalsa 成立 |",
        "• Bank holiday（銀行假期）→ 英國公眾假期嘅叫法，銀行同好多商舖休息。"
      ]
    },
    {
      "id": "N15",
      "kind": "new",
      "title": "倫敦地標",
      "heading": "記憶法（倫敦地標）：",
      "add": [
        "1.1",
        "10.11",
        "6.2",
        "3.8",
        "12.11",
        "10.17"
      ],
      "body": [
        "| 地標 | 重點 |",
        "| Big Ben | Houses of Parliament<br>國會大廈嘅大鐘 |",
        "| Buckingham Palace | 君主喺倫敦嘅官方居所 |",
        "| Tower of London | 征服者威廉起<br>Yeoman Warders（Beefeaters）守衛兼導賞；放 Crown Jewels（皇冠珠寶） |"
      ]
    },
    {
      "id": "N16",
      "kind": "new",
      "title": "君主同國會",
      "heading": "記憶法（君主同國會）：",
      "add": [
        "13.9",
        "14.16",
        "16.21",
        "2.12",
        "10.12",
        "13.18",
        "17.10",
        "5.17",
        "1.9",
        "4.19",
        "7.16",
        "17.23",
        "7.20",
        "16.13",
        "2.2",
        "5.12",
        "6.21",
        "15.9",
        "17.3"
      ],
      "body": [
        "| 角色 | 重點 |",
        "| Monarch | 禮儀性國家元首，政治中立<br>任命議席最多政黨嘅領袖做首相；國會開幕宣讀 King's Speech（政府寫） |",
        "| House of Commons | 下議院：650 MP，每區 1 位<br>代表選區所有人、幫手立法、監察政府；Speaker（議長）主持辯論 |",
        "| House of Lords | 上議院<br>審議同修訂下議院法案；大部分係 life peers，hereditary peers 92 位，26 位主教 |"
      ]
    },
    {
      "id": "N17",
      "kind": "new",
      "title": "政府職位",
      "heading": "記憶法（政府職位）：",
      "add": [
        "16.8",
        "4.9",
        "12.13",
        "5.11",
        "9.12",
        "17.2",
        "2.0",
        "8.3",
        "7.11",
        "12.15",
        "8.20",
        "9.22",
        "11.17",
        "16.11"
      ],
      "body": [
        "| 職位 | 負責 |",
        "| Prime Minister | 政府首長，領導內閣<br>住 10 Downing Street；每星期 PMQs 答問 |",
        "| Cabinet | 內閣<br>大約 20 位資深部長，決定重大政策 |",
        "| Shadow Cabinet | 影子內閣<br>反對黨領袖委任，監察政府 |",
        "| Home Secretary | 內政大臣<br>罪案、警政、移民 |",
        "| Chancellor of<br>the Exchequer | 財政大臣<br>經濟同財政 |",
        "| Lord Chancellor | 大法官<br>英格蘭同威爾斯嘅法律制度同法院 |",
        "| Attorney General | 律政司長<br>政府首席法律顧問 |",
        "| Civil Service | 公務員<br>執行政策，政治中立 |",
        "| Ombudsman | 申訴專員<br>調查對政府部門嘅投訴 |"
      ]
    },
    {
      "id": "N18",
      "kind": "new",
      "title": "投票",
      "heading": "記憶法（投票）：",
      "add": [
        "13.13",
        "1.16",
        "8.8",
        "17.18",
        "14.11",
        "8.17",
        "1.18",
        "17.11"
      ],
      "keep_prefix": [
        "17.11"
      ],
      "body": [
        "• 投票資格 → 18 歲以上、英國／愛爾蘭／英聯邦公民、已經登記；",
        "• 投票前 → 收到 poll card（投票通知卡），投票用 ballot paper（選票）；",
        "• 大選制度 → 領先者當選制（first past the post）：選區得票最多嗰個贏；",
        "• Hung parliament（懸浮議會）→ 冇政黨過半；",
        "• Referendum（公投）→ 就一件事全民投票；",
        "• 選舉前 → 電視同電台一定要平衡報道，報紙唔使。"
      ]
    },
    {
      "id": "N19",
      "kind": "new",
      "title": "法律原則同法院",
      "heading": "記憶法（法律原則同法院）：",
      "add": [
        "2.22",
        "5.23",
        "11.10",
        "15.8",
        "14.19",
        "14.8",
        "7.6",
        "3.14",
        "16.5",
        "6.17",
        "1.17",
        "14.22",
        "14.17",
        "17.16"
      ],
      "body": [
        "| 名稱 | 重點 |",
        "| Habeas corpus | 人身保護令<br>唔可以未經審訊就拘留 |",
        "| Common law | 普通法<br>根據法院判決同先例 |",
        "| Presumption of innocence | 無罪推定<br>證明有罪之前當無罪 |",
        "| Trial by jury | 陪審團審訊<br>由公民決定有冇罪 |",
        "| Criminal offence | 刑事罪行<br>例如帶攻擊性武器 |",
        "| Small claims court | 小額錢債審裁處<br>細額民事糾紛 |",
        "| Youth Court | 少年法庭<br>10–17 歲；受訓裁判官或者地區法官 |",
        "| Supreme Court | 最高法院<br>2009 年成立 |",
        "| Solicitor | 律師<br>提供法律意見，通常按時間收費 |",
        "| Legal aid / Citizens Advice | 法律援助 / 公民諮詢<br>幫負擔唔起嘅人 / 免費保密意見 |"
      ]
    },
    {
      "id": "N20",
      "kind": "new",
      "title": "人權同平等",
      "heading": "記憶法（人權同平等）：",
      "add": [
        "8.14",
        "15.18",
        "14.10",
        "15.14",
        "16.7",
        "12.20",
        "6.23",
        "9.16"
      ],
      "body": [
        "| 名稱 | 重點 |",
        "| Council of Europe | 歐洲委員會（唔係歐盟）<br>保障人權同民主；考試答 47 個成員國（2022 年起 46） |",
        "| European Convention on Human Rights | 歐洲人權公約<br>由歐洲人權法院（Strasbourg）執行 |",
        "| Human Rights Act 1998 | 人權法<br>將公約納入英國法律 |",
        "| Equality Act 2010 | 平等法<br>禁止因受保護特徵歧視 |",
        "| Equality and Human Rights Commission | 平等及人權委員會<br>保障同推廣平等同人權 |"
      ]
    },
    {
      "id": "N21",
      "kind": "new",
      "title": "國際組織",
      "heading": "記憶法（國際組織）：",
      "add": [
        "2.19",
        "7.12",
        "10.22",
        "3.20",
        "16.0",
        "10.19",
        "15.21",
        "11.13",
        "16.22"
      ],
      "body": [
        "| 組織 | 重點 |",
        "| Commonwealth | 英聯邦<br>大部分係前大英帝國國家；考試答 54 個（2022 年起 56） |",
        "| United Nations | 聯合國<br>二戰之後成立，防止戰爭；英國係安理會 5 個常任理事國之一 |",
        "| UN General Assembly | 聯合國大會<br>所有成員國討論同投票 |",
        "| NATO | 北大西洋公約組織<br>1949 年成立，英國係創始成員，集體防衛 |"
      ]
    },
    {
      "id": "N22",
      "kind": "new",
      "title": "慈善同義工",
      "heading": "記憶法（慈善同義工）：",
      "add": [
        "4.5",
        "11.5",
        "12.16",
        "9.13",
        "3.7",
        "15.15"
      ],
      "body": [
        "| 機構 | 幫乜嘢 |",
        "| National Trust | 國民信託<br>保護建築、海岸、郊野 |",
        "| Friends of the Earth | 地球之友<br>環境 |",
        "| Age UK | 長者 |",
        "| NSPCC | 全國防止虐待兒童協會<br>兒童 |",
        "| National Citizen Service | 國家公民服務<br>16–17 歲自願參加，唔係強制 |"
      ]
    },
    {
      "id": "N23",
      "kind": "new",
      "title": "警察",
      "heading": "記憶法（警察）：",
      "add": [
        "6.14",
        "1.12",
        "8.2",
        "3.6"
      ],
      "body": [
        "• 職責 → 保護生命同財產，預防同偵查罪案；",
        "• 投訴 → 可以寫信俾 Chief Constable（總警司）、去警署，或者搵 IOPC（獨立警察投訴機構）；",
        "• 陷阱 → 「只可以寫信」= 錯；",
        "• 有人勸你參加極端主義 → 聯絡當地警察。"
      ]
    },
    {
      "id": "N24",
      "kind": "new",
      "title": "英國貨幣",
      "heading": "記憶法（英國貨幣）：",
      "add": [
        "11.2",
        "5.1",
        "3.22",
        "9.2",
        "4.4"
      ],
      "body": [
        "• 貨幣 → Pound Sterling（英鎊，£）；",
        "• 硬幣 → 1p、2p、5p、10p、20p、50p、£1、£2（冇 25p）；",
        "• 最大面額 → £50（考試以官方手冊嘅 £50 為準；蘇格蘭同北愛有啲銀行另外發行 £100）；",
        "• 蘇格蘭同北愛有自己嘅鈔票，全英國通用。"
      ]
    },
    {
      "id": "N25",
      "kind": "new",
      "title": "工作同日常生活",
      "heading": "記憶法（工作同日常生活）：",
      "add": [
        "13.16",
        "14.14",
        "2.3"
      ],
      "body": [
        "• 工會（trade union）→ 代表工人同僱主談判；",
        "• 全國最低工資 → 1998 年推出，僱主一定要俾嘅最低時薪；",
        "• 喺公眾地方帶狗 → 狗要戴頸圈，寫住主人姓名同地址。"
      ]
    }
  ],
  "similar": [
    {
      "id": "S1",
      "kind": "merge",
      "from": "F33",
      "into": "F113",
      "q": [
        "7.8"
      ],
      "why": "火藥陰謀（7.8）同 Bonfire Night 紀念火藥陰謀失敗（3.23、14.20）係同一件事",
      "impact": "刪 fact #33：書籤 / 已掌握要 migrate 去 #113；Ch3 #33 之後嘅編號 -1（只係顯示）；要重生成 content baseline"
    },
    {
      "id": "S2",
      "kind": "split",
      "from": "F106",
      "new": [
        "1.23"
      ],
      "why": "Easter 幾時（5.0）同 Lent 係乜（1.23）係兩件事",
      "impact": "新 fact 加喺 STUDY 尾；舊 #106 只剩 5.0；要重生成 content baseline"
    },
    {
      "id": "S3",
      "kind": "split",
      "from": "F125",
      "new": [
        "5.1"
      ],
      "why": "貨幣名（11.2）同硬幣面額（5.1）唔同",
      "impact": "同上"
    },
    {
      "id": "S4",
      "kind": "split",
      "from": "F126",
      "new": [
        "4.4"
      ],
      "why": "最大面額 £50（3.22、9.2）同蘇格蘭鈔票通用（4.4）唔同",
      "impact": "同上"
    },
    {
      "id": "S5",
      "kind": "split",
      "from": "F133",
      "new": [
        "10.17"
      ],
      "why": "Beefeaters（3.8、12.11）同 Crown Jewels（10.17）唔同",
      "impact": "同上"
    },
    {
      "id": "S6",
      "kind": "split",
      "from": "F181",
      "new": [
        "4.9"
      ],
      "why": "首相角色（16.8）同官邸（4.9）唔同",
      "impact": "同上"
    }
  ],
  "fixes": [
    {
      "id": "X1",
      "q": [
        "7.12"
      ],
      "issue": "同字題 2.19 / 10.22 有 R1 備注（54 → 56），7.12 冇",
      "fix": "跟 2.19（或者跟 N21）"
    },
    {
      "id": "X2",
      "q": [
        "4.12",
        "15.5"
      ],
      "issue": "同字題備注唔同：「11月11日停戰」/「11月11日」",
      "fix": "統一（N9 一戰）"
    },
    {
      "id": "X3",
      "q": [
        "6.23",
        "9.16"
      ],
      "issue": "同字題備注唔同（9.16 有 R1 47 → 46）",
      "fix": "統一（N20）"
    },
    {
      "id": "X4",
      "q": [
        "11.14",
        "17.20"
      ],
      "issue": "同字題，17.20 冇備注",
      "fix": "統一（N10）"
    },
    {
      "id": "X5",
      "q": [
        "4.6"
      ],
      "issue": "備注用半形括號「(UK)」",
      "fix": "改全形或者由 E4 取代"
    },
    {
      "id": "X6",
      "q": [
        "5.1"
      ],
      "issue": "硬幣列表用半形逗號「1p, 2p, …」",
      "fix": "由 N24 取代（用「、」）"
    },
    {
      "id": "X7",
      "q": [
        "15.16"
      ],
      "issue": "譯名唔一致：oy「詹姆斯二世」vs 記憶法 M6「James II（詹姆士二世）」",
      "fix": "要你定用邊個（yue-terms 冇收錄）"
    },
    {
      "id": "X8",
      "q": [
        "3.3",
        "4.15",
        "11.15"
      ],
      "issue": "譯名唔一致：題目 yue「英格蘭教會」vs 13.22 oy / M5「英格蘭國教會」",
      "fix": "要你定（R2：題目 yue 唔可以洩露答案，要逐題睇）"
    },
    {
      "id": "X9",
      "q": [
        "11.17"
      ],
      "issue": "備注「政治中立」同答案重複，冇新資料",
      "fix": "由 N17 取代"
    },
    {
      "id": "X10",
      "q": [
        "M16"
      ],
      "issue": "記憶法 M16 最後一行冇「；」/「。」",
      "fix": "E6 一齊補"
    }
  ]
};
