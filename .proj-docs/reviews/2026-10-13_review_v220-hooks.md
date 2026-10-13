# Code Review — v2.2.0 記憶法 61 組記憶鈎用戶定稿（content release）

> 改名（2026-10-13，merge `main` v2.4.0 時）：原本叫 `2026-10-13_review_v220.md`，同 `main` 嘅記憶法 layout review 同名（add/add），`main` 嗰份留原名，呢份改做 `-hooks`。呢條 branch 以 **v2.4.1** 發佈；W-083 / S-271 / S-272 / S-274 喺 merge commit 處理（S-273 照記錄）。

- **日期**：2026-10-13
- **審閱者**：Code Reviewer（獨立）
- **目標**：branch `claude/charming-archimedes-hrh4wd`，`7145c96..373ad27`（`7145c96` = `origin/main` v2.1.1）；commits `e226c59`（test，紅）、`fa5db79`（data，綠）、`373ad27`（release v2.2.0 + HANDOFF + 390px baseline）
- **改動檔案**：`data/memo.js`、`tests/memo-domain-test.js`、`tests/memo-test.js`、`js/core/config.js`、`HANDOFF.md`、`.proj-docs/design-baselines/2026-10-13_memo-hooks-390.png`
- **Source of truth**：`.claude/artifacts/hook-review/final-hooks.json`（untracked，只讀；61 個 key）
- **用戶決定（照記錄，唔當 defect）**：44 組照收、17 組改字；年份規則「年份數字後面一定跟『年』，55 BC / AD 43 照舊，已加咗嘅唔郁」；用戶自己改出嚟嘅「1215 年King John」「60 年Restoration (復辟)」「88 年Glorious (光榮)」冇空格；`nation-symbols` 三行已批
- **Design Origin**：n/a（純 data；hook 框 CSS / render 冇改，baseline 截圖只作記錄）
- **結果**：⚠️ warn — **87 / 100**，0 Critical、2 Warning（W-077、W-078）、3 Suggestion（S-265–S-267）

## 總評

Data 抄得準：用 node vm 載入 `373ad27:data/memo.js`，61 組 `hook` 同 `final-hooks.json` **逐 byte 一樣**（0 mismatch，JSON 冇多 key），`single` 係 `''`。`id` / `title` / `icon` / 次序 / 欄位（`id,title,icon,hook`）同 `7145c96` 完全一樣，62 組。JS escaping 啱：單引號字串入面嘅 `'` 全部寫 `\'`（St Paul's、King's ×2、Giant's ×2），檔案 parse 到，冇 tab / NBSP / zero-width / 頭尾空白 / 雙空格。只有 `nation-symbols` 多過兩行（三行，已批）。檔頭註解更新準確。

年份規則：逐個數字 token 掃晒 61 組（見下表），**冇一個年份漏「年」**。冇「年」嘅數字全部唔係年份（日期 25/1、11/11、8/5；數量 650、129、92、54、47、20,000、100 萬；年齡 21 女 30、18 至 70 歲、16–17 歲；p / £ 面額）或者係 BC / AD（55 BC、AD 43、AD 60、AD 122、AD 410 —— `early-britain` 係 W-066 定稿、今次冇改）。「年」後面直接跟英文字（冇空格）嘅只有用戶自己改嘅三處：`king-parliament`「60 年Restoration」「88 年Glorious」、`magna-carta`「1215 年King John」—— 照用戶指示記錄，唔當 defect。

事實核對（每組 hook 對 `data/exams.js` 該組記憶法 note，61 組各得一個 note 版本）：60 組冇同 note 矛盾嘅內容（數字、年份、人名、地點全部同 note 對得上；hook 冇加 note 冇講嘅事實）。唯一要用戶決定嘅係 `nation-symbols` / `devolved` 用「Ireland」代表 Northern Ireland（W-077）。另外 `patron-saints` / `writers` 嘅縮寫令 hook 冇咗部分 note 資料（S-266，記錄）。

測試：紅燈成立 —— reviewer 喺臨時 worktree checkout `e226c59` 跑 `memo-domain-test`：`FAIL: vote hook: user-approved wording, verbatim`（assert 失敗，唔係 crash），worktree 已刪。`memo-domain-test` 新 check 比舊嚴（舊：15 組有 / 其他 `''`、≤ 2 行；新：61 組全部非空、`single` 一定 `''`、每行非空、行數上限、5 組逐字 pin、四位數年份規則），冇放寬。`memo-test` 嘅 `89 年冇票` 同陪審員 hook 框係跟 data 改，合理；但「冇 hook → 冇 hook 框」嘅 UI 分支而家冇 test（W-078）。

版本：`APP_VERSION` 2.1.1 → **2.2.0**，`sw.js` cache 名跟住變（`lifeuk-v2.2.0`），已裝 PWA 會攞到新 `data/memo.js`。刻意跳過 2.1.2：`origin/fix/quiz/back-to-entry` 而家仍然係 `2.1.1`（CUI-0041 pending：佢 merge 入 `main` 時要升 2.1.2），2.2.0 唔會同佢撞。HANDOFF：標題 v2.2.0、`data/memo.js` 行、`memo-domain-test` 行、v2.2.0 版本行都準確（年份規則描述「`1853–56 年` 呢類範圍除外」同 regex 一致）。`data/memo.js` 唔喺 content-baseline（只管 `exams.js` / `study.js`），`content-guard-test` 照 PASS。

### 年份 token 表（摘錄：有年份嘅組）

| 組 | 年份 token |
|---|---|
| vote | 89 年、32 年、18 年、28 年、69 年、1918 年、1928 年 |
| ww2 | 39 年、40 年、40–41 年、44 年、45 年 |
| spain-france / c18 | 1588 / 1805 / 1815 年；1721 / 1745 / 1776 年 |
| king-parliament | 28 / 42 / 49 / 60 / 88 年（60、88 後冇空格，用戶改）、1649 / 1688 年 |
| intl-orgs / post-war | UN 1945 年、NATO 1949 年；45 年、45–51 年、48 年、1948 年 |
| norman / magna-carta / london / great-fire | 1066 / 1086 年；1215 年（後冇空格，用戶改）；1066 年；1666 年 |
| medieval-battles / middle-ages | 1066 / 1314 年；1337–1453 年、1348 年 |
| c19-events / union | 1807 年、1840 年代、1899–1902 年；1536 / 1707 / 1800 / 1922 / 1949 年 |
| late-c20 / athletes / ww1 | 73 / 89 / 98 / 1973 / 2020 年；53 / 54 / 66 / 84 年；14 / 16 / 18 年 |
| c19-people / courts / rights / thatcher / media | 約 1810 年、1853–56 年；2009 年；98 / 2010 年；1979–1990 年；1994 年 |
| early-britain | 55 BC、AD 43 / 60 / 122 / 410（BC / AD，照舊） |

## Hard Gates

| Gate | 結果 | 說明 |
|---|---|---|
| Lint | n/a | repo 冇 ESLint；`structure-test` PASS |
| Type check | n/a | 冇 TypeScript；`data/memo.js` 用 node vm parse 成功 |
| Tests | ✅ pass | 臨時 worktree（`373ad27`）跑 `tests/run-all.sh`：見下面「測試結果」；跑完 worktree 已刪 |
| Coverage | n/a | 冇 coverage 工具；61 組 hook 由 `memo-domain-test` 全部覆蓋（非空 / 行數 / 年份規則）+ 5 組逐字 |
| No Critical | ✅ pass | 0 |
| Security scan | n/a | 冇新增依賴；hook 經 `escapeHtml` render |

### 測試結果

臨時 git worktree（detached `373ad27`）：`NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium bash tests/run-all.sh` → **69 / 70 PASS**；唯一 FAIL 係已知 flake `upgrade-test`（`current shell, locale missing: exactly one reload (3 page loads)`，同 review_v206 記錄嘅 reload flake 一樣，同今次改動無關）。單獨重跑 `upgrade-test` **2 / 2 PASS** → **70 / 70**。`memo-domain-test`、`memo-test`、`desktop-memo-test`、`i18n-test`、`content-guard-test`、`sw-test` 全部一次 PASS。worktree 已 `git worktree remove`。

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 20 | 25 | W-077（「Ireland」= Northern Ireland，用戶決定） |
| 安全性 | 20 | 20 | |
| 可維護性 | 19 | 20 | S-266（縮寫 hook 少咗 note 資料，記錄） |
| 測試覆蓋 | 9 | 15 | W-078（冇 hook → 冇 hook 框分支冇 test）、S-265（年份 regex 盲點） |
| 性能 | 10 | 10 | |
| 代碼風格 | 9 | 10 | S-267（全形 / 半形括號混用，記錄） |
| **總分** | **87** | **100** | |

**結果：⚠️ warn**（hard gates 全 pass、0 Critical、75–89 分）

## 問題清單

### 🟡 W-077 — `nation-symbols` / `devolved` 用「Ireland」代表 Northern Ireland（內容準確度，交用戶決定）

- **位置**：`data/memo.js` `nation-symbols`（「Ireland Shamrock」「Ireland Belfast」）、`devolved`（「Ireland 90」）
- **描述**：兩組嘅 note（`data/exams.js`）都寫 **N. Ireland**（Belfast 係 Northern Ireland 首都；90 位係 Northern Ireland Assembly）。Seed 原文寫「北愛」，用戶 review 時改成「Ireland」（`seed/nation-symbols.json` / `seed/devolved.json` 對 `final-hooks.json`）。
- **影響**：Life in the UK 考試分得好清楚 Northern Ireland（UK 一部分）同 Ireland / Republic of Ireland（唔係 UK；首都 Dublin）。「Ireland Belfast」會令人記成「愛爾蘭首都 = Belfast」；考題「What is the capital city of Northern Ireland?」唔受影響，但干擾選項有 Ireland / Dublin 時可能混淆。`patron-saints`「PI17」（St Patrick = Ireland 守護聖人）同 `nation-symbols` 第三行「Scotland 同 Ireland 部分地區講 Gaelic」用 Ireland 係啱嘅，唔包括喺呢條。
- **方案 A**：改「N. Ireland Shamrock」「N. Ireland Belfast」「N. Ireland 90」（同 note 用字一致；多 3 個字）。
- **方案 B**：保留用戶原字（節奏較短），喺 hook 尾加一句「Ireland = 北愛」或者靠下面 note table 補足。
- **推薦**：A —— 但係用戶已批嘅字，**要用戶決定**；改動要再經 `final-hooks.json` 同 HANDOFF「逐字照抄」規則。

### 🟡 W-078 — 「冇 hook → 冇 hook 框」分支失去 UI test

- **位置**：`tests/memo-test.js:173-176`（舊 assertion `#memoBody .memo-hook === null` 改咗做陪審員有 hook）；`js/screens/memo.js:125-127`（`memoHookHtml`：`if (!g.hook) return ''`）
- **描述**：舊 test 用陪審員組驗證空 hook 唔出框。而家 61 組都有 hook，唯一 `''` 嘅係 `single`，但 `memo-test` 嘅單題注解段（`:279-283`）只驗 8 題 + lang，冇驗 `.memo-hook` 唔存在。`memo-domain-test` 只驗 data（`single` = `''`），唔驗 render。
- **影響**：如果之後 `memoHookHtml` 拎走 guard（或者 hook 框改成永遠出），單題注解組會出一個得「💡 Memory hook:」標籤、冇內容嘅框，冇 test 會 fail。
- **方案 A**：`memo-test` 單題注解段加一句 `assert(await pg.$('#memoBody .memo-hook') === null, 'single-note group: no hook → no hook box')`（1 行，保持原有覆蓋）。
- **方案 B**：喺 `memo-domain-test` 用 vm 直接 call `memoHookHtml({ hook: '' }) === ''`（快，但唔驗真 DOM）。
- **推薦**：A。

### 🟢 S-265 — 年份規則 regex 盲點（兩位數年份、範圍尾）

- **位置**：`tests/memo-domain-test.js` `BARE_YEAR`
- **描述**：regex 只捉四位數年份；`(?!–\d{2,4})` 令「1853–56 Nightingale」（範圍尾冇「年」）都 PASS。兩位數年份（「89 年冇票」「45 年 Attlee」）—— 用戶規則入面最多嘅寫法 —— 完全唔檢查。reviewer 驗過：`'1853–56 Nightingale'` → 唔報、`'1945'` → 報、`'1940s'` → 報。
- **影響**：而家 data 冇違規（reviewer 逐 token 核對過），只係將來改 hook 時 test 擋唔住部分違規。兩位數同年齡 / 數量分唔開，所以完全自動化唔實際。
- **方案 A**：範圍改成要求尾後有「年」：`(?!–\d{2,4}(?! ?年))` 類似寫法，或者另加 `/\d{4}–\d{2,4}(?! ?年)/`。
- **方案 B**：維持現狀，HANDOFF 已寫明「四位數年份」範圍；兩位數靠 pin（5 組逐字）+ review。
- **推薦**：A 只補範圍尾；兩位數接受 B。

### 🟢 S-266 — `patron-saints` / `writers` 縮寫 hook 少咗 note 資料（記錄，用戶已批）

- **位置**：`patron-saints`「GE23、AS30、DW1、PI17」；`writers`「Austen PP、Brontë JE、Shelley F、Dickens CC」
- **描述**：冇咗月份（23/4、30/11、1/3、17/3 —— 考題問日期）同作品名；要配 note table 先解得返。唔係事實錯，係用戶刻意揀嘅縮寫記法。
- **方案 A**：保留（用戶已批）。**方案 B**：加月份（例如「GE 23/4」）/ 作品全名。**推薦**：A，記錄俾用戶知。

### 🟢 S-267 — 全形 / 半形括號混用（記錄，用戶已批）

- **位置**：`parliament`「Commons (下議院)」、`intl-orgs`「Commonwealth (英聯邦)」「UNSC (安理會)」「UNGA (大會)」、`king-parliament`「Restoration (復辟)」「Glorious (光榮)」用半形 `( )` + 空格；其他組（`c18`「Enlightenment（Adam Smith…）」、`london`「Beefeaters（Yeoman Warders）」、`tudors`、`principles`、`elections`、`crown-dep`、`ww2`）用全形 `（）`。
- **方案 A**：保留（逐字照抄係 HANDOFF 規則）。**方案 B**：下次用戶 review 時統一全形。**推薦**：A。

## ✅ 做得好嘅地方

- 61 組 byte-for-byte 照 source of truth 抄，metadata 完全冇郁；`\'` escaping 全部正確，HANDOFF 仲記低「`'` 要寫 `\'`」。
- 紅 / 綠 / release 三個 commit 分得清楚，紅燈 fail 喺 assertion。
- `memo-domain-test` 由「15 組」改成結構性 invariant（全部非空、`single` `''`、行數、每行非空、年份規則）+ 5 組 pin，比舊版嚴。
- 跳過 2.1.2 有理由（CUI-0041），寫入 commit message 同 HANDOFF。
- 有 390px baseline 截圖（最長 hook `inventors` 冇溢出）。

## 修正優先順序

| 優先 | ID | 動作 | 誰決定 |
|---|---|---|---|
| 1 | W-077 | 問用戶「Ireland」要唔要改「N. Ireland」 | 用戶 |
| 2 | W-078 | `memo-test` 單題注解組加冇 hook 框 assertion | developer |
| 3 | S-265 | `BARE_YEAR` 補範圍尾 | developer（可選） |
| — | S-266 / S-267 | 記錄 | 用戶（可選） |

## 修訂後代碼

Reviewer 唔改 code / data。W-078 建議（`tests/memo-test.js` 單題注解段，`:283` 之後）：

```js
  // W-078: the only group with hook '' — no empty "Memory hook:" box
  assert(await pg.$('#memoBody .memo-hook') === null, 'single-note group: no hook → no hook box');
```

W-077 只喺用戶同意後改 `data/memo.js` + `final-hooks.json` 對應字串（`nation-symbols` 兩處、`devolved` 一處）。

## Handoff receipt

```handoff-receipt
protocol: 1
status: warn
score: 87/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
next_action: invoke_developer
next_agent: frontend-developer
branch: "claude/charming-archimedes-hrh4wd"
context: "v2.2.0 review warn 87, 0 C / 2 W / 3 S. run-all 69/70 + upgrade-test flake rerun alone 2/2 PASS -> 70/70. All 61 hooks byte-identical to final-hooks.json, single '', ids/titles/icons/order unchanged, escaping OK, only nation-symbols 3 lines. Year rule: every year has 年 (BC/AD and user-edited 1215 年King / 60 年Restoration / 88 年Glorious recorded, not defects). W-077 (user decides): nation-symbols 'Ireland Shamrock/Belfast' and devolved 'Ireland 90' mean Northern Ireland (notes say N. Ireland; user changed seed 北愛 -> Ireland). W-078: memo-test lost the no-hook -> no-hook-box assertion; add one on the single-note group. S-265 BARE_YEAR misses range ends (1853–56 without 年) and two-digit years. S-266 patron-saints/writers abbreviations drop months/titles (record). S-267 mixed half/full-width brackets (record). Red e226c59 verified (vote verbatim FAIL). APP_VERSION 2.2.0 OK (back-to-entry still 2.1.1, CUI-0041). Next IDs: C-007, W-079, S-268, CUI-0043."
blockers:
  - "W-077 (user decision): nation-symbols 'Ireland Shamrock' / 'Ireland Belfast' and devolved 'Ireland 90' mean Northern Ireland; notes say N. Ireland"
  - "W-078: tests/memo-test.js single-note group must assert no #memoBody .memo-hook (empty-hook branch now untested)"
```

---

# Re-review — review_v220 follow-ups（`66046aa..7eb8fcf`）

- **日期**：2026-10-13
- **Commits**：`42afe50`（test，紅）、`2f4b260`（data，綠）、`7eb8fcf`（HANDOFF）
- **用戶決定（coordinator 轉達，已寫入 `final-hooks.json`）**：W-077 → 「N. Ireland」（nation-symbols 嘅 Shamrock / Belfast、devolved 嘅 90；Gaelic 句保留「Ireland」）；S-267 → 全部改全形（），「）」後面冇空格（crown-dep「）— 」已批）；空格 → 「1215 年 King John」「60 年 Restoration」「88 年 Glorious」；W-078 → memo-test 單題注解組驗冇 `.memo-hook`
- **結果**：✅ pass — **100 / 100**，0 C / 0 W / 0 S（冇新 finding）

## 核對

- **61 / 61 逐 byte 一樣**：node vm 載入 `7eb8fcf:data/memo.js` 對 `final-hooks.json`，0 mismatch；`single` 係 `''`；id / title / icon / 次序 / 欄位同 `7145c96` 一樣；淨係 `nation-symbols` 三行。只改咗 6 組（parliament、nation-symbols、devolved、king-parliament、intl-orgs、magna-carta）+ 檔頭註解。
- **W-077 ✅**：nation-symbols「N. Ireland Shamrock」「N. Ireland Belfast」、devolved「N. Ireland 90」。其餘「Ireland」逐個核對過，全部正確：nation-symbols Gaelic 句、patron-saints（Union Jack 三個聖人十字）、union（1800 年加 Ireland、Northern Ireland 留低）；electoral-systems 本身已經寫「N. Ireland」。
- **W-078 ✅**：`tests/memo-test.js` 單題注解組加 `#memoBody .memo-hook === null`。呢句用舊 data 跑都會 PASS —— 係補返覆蓋，唔係改行為，所以冇紅燈係預期。
- **S-265 ✅**：`BARE_YEAR` 範圍尾一定要跟「年」（`(?!–\d{2,4}(?!\d) ?年)`，加 `(?!\d)` 防 backtrack）；新 `RANGE_NO_UNIT` 要求所有數字範圍以 年 / 歲 / 月 收尾（兩位數年份範圍，例如 45–51 年，都覆蓋到）。兩位數單獨年份冇自動檢查，註釋講明原因（同數量 / 年齡分唔開），靠 pin。Regex 自我檢查：6 個壞樣本全部捉到，21 個正常樣本（年份範圍、年代、數量、年齡、月份、BC / AD、D-Day、20,000）全部冇中。
- **S-267 ✅**：hook 入面冇半形 `( )`（`HALF_WIDTH_PAREN`）；「）」後面有空格嘅只剩 crown-dep「）— 」（已批）。
- **空格 ✅**：`/年[A-Za-z]/` 冇中任何 hook。
- **S-266**：記錄項，用戶冇改，照舊。
- **新規則冇 false positive**：61 組定稿文字跑 `BARE_YEAR` / `RANGE_NO_UNIT` / `HALF_WIDTH_PAREN` / `NIAN_LATIN`，全部 0 命中。同一組規則跑 `66046aa` 嘅舊 data：`HALF_WIDTH_PAREN` 中 parliament / king-parliament / intl-orgs，`NIAN_LATIN` 中 king-parliament / magna-carta —— 證明規則本身有效，唔係淨靠 pin。
- **紅燈 ✅**：臨時 worktree checkout `42afe50` 跑 `memo-domain-test` → `FAIL: king-parliament hook: user-approved wording, verbatim`（assertion 失敗，唔係 crash）；worktree 已刪。
- **冇放寬**：舊 assertion 全部保留（5 組 pin 之中只有 king-parliament 跟用戶改字，另外加咗 3 組 pin）；`BARE_YEAR` 比之前更嚴（多咗範圍尾）。
- **HANDOFF**：`data/memo.js` 行、`memo-domain-test` 行同 v2.2.0 行都準確寫低今次跟進；`APP_VERSION` 維持 2.2.0（未 release，唔使升）。

## 測試

- 臨時 worktree（detached `7eb8fcf`）直接跑：`memo-domain-test`（210 checks）、`memo-test`、`desktop-memo-test`、`i18n-test`、`content-guard-test` **全部 PASS**。
- `tests/run-all.sh` 全套：因為 caller 要求提早交回，跑到 **27 / 70 全部 PASS（0 fail）** 就停咗，worktree 已刪。後面未跑嘅 suite 之中，會讀 hook 字串嘅只有上面已經單獨跑過嘅 memo 相關 suite；`373ad27` 全套係 70 / 70。**建議 merge / QA 之前再完整跑一次 run-all。**

## Hard Gates

| Gate | 結果 | 說明 |
|---|---|---|
| Lint | n/a | 冇 ESLint |
| Type check | n/a | 冇 TypeScript；`data/memo.js` parse OK |
| Tests | ✅ pass | 5 個 memo 相關 suite PASS；run-all 跑完嘅 27 個全部 PASS（全套未跑完，見上） |
| Coverage | n/a | |
| No Critical | ✅ pass | 0 |
| Security scan | n/a | 冇新依賴 |

## 評分（re-review）

| 維度 | 得分 | 滿分 |
|---|---|---|
| 正確性 | 25 | 25 |
| 安全性 | 20 | 20 |
| 可維護性 | 20 | 20 |
| 測試覆蓋 | 15 | 15 |
| 性能 | 10 | 10 |
| 代碼風格 | 10 | 10 |
| **總分** | **100** | **100** |

（S-266 係用戶已批嘅記錄項，唔扣分。）

```handoff-receipt
protocol: 1
status: pass
score: 100/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
next_action: merge_develop
next_agent: null
branch: "claude/charming-archimedes-hrh4wd"
context: "Re-review 66046aa..7eb8fcf pass 100, no new findings. 61/61 byte match with final-hooks.json; W-077 N. Ireland (3 places; other Ireland uses correct), W-078 single-group no-hook assertion, S-265 range-end + RANGE_NO_UNIT with self-check samples, S-267 full-width brackets, 年 + space all resolved; new regexes 0 hits on approved text and catch the old data. Red 42afe50 fails on king-parliament pin assertion. memo-domain/memo/desktop-memo/i18n/content-guard PASS at 7eb8fcf; run-all stopped at 27/70 all PASS because of the early handback - rerun run-all once before merge/QA (373ad27 was 70/70). Next IDs: C-007, W-079, S-268, CUI-0043."
```

---

# Review — CUI-0044 + main v2.1.2 merge（`8cff946..2e16ca8`）

- **日期**：2026-10-13
- **審閱者**：Code Reviewer（獨立）
- **目標**：branch `claude/charming-archimedes-hrh4wd`，`8cff946..2e16ca8`：`9f858ca`（QA v2.2.0 docs）、`ff3e960`（merge `origin/main` `b859b7d` = PR #116 v2.1.2）、`0665d6d`（紅）/ `c8c4d3e`（綠）/ `e6b29aa`（`\u` escape）/ `2e16ca8`（docs）= `/fix CUI-0044`
- **Design Origin**：`baseline`（hook 框 CSS 冇改；只係 render 時換字元，QA CUI-0044 截圖做參考）
- **ID**：任務指定 C-007 / W-079 / S-268 喺其他 remote 已經用咗：`origin/claude/quirky-newton-wdelbs` 用 C-007、W-077–W-082、S-265–S-267；`origin/fix/quiz/back-to-entry` 用 C-007、W-077–W-078、S-265–S-270（同我哋 `review_v220.md` 嘅 W-077 / W-078 / S-265–S-267 已撞，引用要連報告名 + branch）。今次用 **W-083、S-271–S-274**。下一個新號：**C-008、W-084、S-275、CUI-0045**。
- **結果**：✅ pass — **91 / 100**，0 Critical、1 Warning（W-083）、4 Suggestion（S-271–S-274）

## 總評

**Merge `ff3e960` 乾淨**：`git show --remerge-diff` 只有 4 個 conflict（`js/core/config.js`、`HANDOFF.md`、`.proj-docs/index.md`、QA 報告 / ticket 改號），全部照講嘅方向解：`APP_VERSION` 留 2.2.0、HANDOFF header 用我哋、`main` v2.1.2 row 喺我哋 v2.2.0 row 前面。程式碼方面逐檔核對：`git diff b859b7d ff3e960 -- js css tests locales sw.js index.html data` **完全等於** `git diff 7145c96 9f858ca` 同一批路徑（`data/memo.js`、`config.js`、`memo-domain-test`、`memo-test`，數字一樣），而 `git diff 9f858ca ff3e960` 同一批路徑**完全等於** `git diff 7145c96 b859b7d`（扣 `config.js`）—— PR #116 嘅 `quiz.js` / `quiz.css` / locales / `qnum-row-test`（`run-all.sh` 有登記）/ 7 個 test 改動原封入咗，我哋嘅冇漏。`CUI-0043.md`（main 嘅 desktop 矮畫面）同 `b859b7d` byte 一樣；我哋 QA ticket 改號 CUI-0044，QA 報告頂有改號註。

**CUI-0044 修正啱**：`memoHookNoBreak` 先 NBSP 後 `escapeHtml`（U+00A0 / U+2060 唔係 HTML 特殊字元，冇 `&nbsp;`、冇 double escape；test 有 pin）。規則次序啱：範圍規則（lookahead 要普通空格 + 單位）喺 NBSP 規則之前。Node vm 逐個列出 61 組全部黏位（94 處）：年 63、年代 1、歲 6、個 6、國 2、世紀 3、月 3、日 1、星期 1、萬 2、位 1、時 1、範圍 U+2060 9、`N. Ireland` 4、`AD n` 4、`55 BC` 1 —— **冇一個係 false glue**（「11 時停戰」「20 位資深部長」「40 日」「5 個常任」全部真係數量單位；非數字 + 單位例如 `Berners-Lee 萬維網`、`Presbyterian 國教`、`II 時` 冇被黏，因為規則要求前面係數字）。最長黏埋嘅 token 係「1337–⁠1453 年」/「1899–⁠1902 年」（≈ 11 字），CJK / `、` 兩邊照可以斷。Reviewer probe（320 × 568 × en / zh-HK × 細 / 大字，61 組）：`.memo-hook` `scrollWidth ≤ clientWidth`、document 冇橫向 scroll，0 overflow（hook 框 286px）。

**Accessibility**：U+00A0 喺 VoiceOver / TalkBack / NVDA 讀法同普通空格一樣（「1928 年」照讀「一九二八年」）；U+2060 係 format char（Cf），主流 screen reader 唔讀、唔停頓。`lang="zh-HK"` 不變。接受。

**複製文字有 U+2060**：顯示上冇問題；但 reviewer 實測：將顯示嘅「1853–⁠56 年」（連 U+2060）貼入搜尋 → **0 結果**（普通打字 `1853–56 年` 照搵到 `c19-people`）；NBSP 版本一樣 0 結果。見 S-271。

**放寬咗嘅舊 regex**：`/89[  ]年冇票/`、`/18 至 70[  ]歲/` 只係多接受 NBSP，內容同 hook 框 / lang / 表格行數 / steps 等其他條件全部照舊；NBSP 一定存在由新 CUI-0044 block（`glueWant` 逐字比較）鎖死，所以冇變弱。

**TDD**：臨時 worktree checkout `0665d6d` 跑 `memo-test` → `ReferenceError: memoHookNoBreak is not defined`（紅，但係 API 層 crash，唔係幾何 assertion 失敗；幾何 check 嘅有效性靠 QA script 修前 49 個斷開 token 證明，見 S-272）。

**i18n**：`js/` 冇 CJK（單位全部 `\u` escape，`i18n-test` PASS）；`tests/` 用中文字面值，合規。

## Hard Gates

| Gate | 結果 | 說明 |
|---|---|---|
| Lint | n/a | 冇 ESLint |
| Type check | n/a | 冇 TypeScript |
| Tests | ✅ pass | 臨時 worktree（detached `2e16ca8`）`tests/run-all.sh` **70 / 71**；`factmerge-test`（S-212 fallback key，今次冇郁到嘅 suite）單獨重跑 **2 / 2 PASS** → flake → **71 / 71**。worktree 已刪 |
| Coverage | n/a | |
| No Critical | ✅ pass | 0 |
| Security scan | n/a | 冇新依賴 |

## 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 23 | 25 | S-271（貼上搜尋）、S-273（其他 token 仍可斷） |
| 安全性 | 20 | 20 | escape 次序啱 |
| 可維護性 | 14 | 20 | W-083（落後 `main` 兩個 PR + 版本撞）、S-274（舊號殘留） |
| 測試覆蓋 | 14 | 15 | S-272（幾何 check 可以 vacuous pass） |
| 性能 | 10 | 10 | 61 組 × 5 條 regex，開組時先跑，可忽略 |
| 代碼風格 | 10 | 10 | |
| **總分** | **91** | **100** | |

**結果：✅ pass**

## 問題清單

### 🟡 W-083 — `origin/main` 已經去咗 `fb5cc7b`（PR #117 v2.1.3、PR #118 英文 hook，`APP_VERSION 2.2.0`）：版本撞 + 4 檔 conflict，CUI-0044 要跟住改

- **位置**：`js/core/config.js`、`js/screens/memo.js` `memoHookHtml`、`tests/memo-test.js` CUI-0044 block、`data/memo.js`、`HANDOFF.md`
- **描述**：merge `b859b7d` 之後 `main` 再 merge 咗 PR #117（`fc7bb8c` memo UI 書面語，v2.1.3）同 PR #118（`7cc5e75` 英文記憶法 / `titleEn` / `hookEn`，**v2.2.0**）。`git merge-tree HEAD origin/main` → `HANDOFF.md`、`data/memo.js`、`js/screens/memo.js`、`tests/memo-test.js` conflict。`main` 嘅 `memoHookHtml` 改咗做 render `local.hook`（英文 UI 用 `hookEn`，`lang` 跟住變）。另外 `origin/claude/quirky-newton-wdelbs` 都係 `APP_VERSION 2.2.0`，而且有同名 `.proj-docs/reviews/2026-10-13_review_v220.md`（內容唔同）。
- **影響**：① 版本一樣 → SW cache 名 `lifeuk-v2.2.0` 一樣，`main` 2.2.0 用戶唔會收到呢度嘅新 `data/memo.js` / `memo.js`；② CUI-0044 test 用 `shown === g.hook` 比較，英文 UI 會顯示 `hookEn` → merge 後 4 個 en config 會紅；③ `hookEn` 都有「55 BC」「AD 43」「in 1928」類 token，未套 `memoHookNoBreak` 一樣會斷；④ `hookEn` 係由用戶定稿之前嘅中文 hook 譯出嚟定係定稿之後？要核對（W-077「N. Ireland」等改動）。⑤ 報告檔名撞。
- **方案 A（推薦）**：下一步先 merge `origin/main` `fb5cc7b`，`APP_VERSION` 升 **2.2.1**（或用戶揀 2.3.0）；`memoHookHtml` 對 `local.hook`（兩種語言）都行 `memoHookNoBreak`（英文 hook 嘅 AD / BC / N. Ireland 規則已經涵蓋；中文單位規則對英文冇影響）；test 改用 `memoLocal(g).hook` 做比較；核對 `hookEn` 同 61 組定稿一致；本報告之後新 review 用新檔名（例如 `_v221.md`）。
- **方案 B**：先 release 呢條 branch 入 `main`，由 PR #118 嗰邊 rebase —— 但 PR #118 已 merge，唔可行，只剩 A。

### 🟢 S-271 — 由 hook 框複製再貼入搜尋，U+2060 / U+00A0 令搵唔到

- **位置**：`js/screens/study.js:96` `studySetSearch`（`v.trim().toLowerCase()`）、`js/screens/memo.js:26` `memoMatches`
- **描述 / 實測**：搜尋 `'1853–⁠56 年'`（hook 框顯示嘅字）→ 0 張卡；`'1853–56 56 年'` 一樣 0；普通 `1853–56 年` → `c19-people`。Chrome / Safari 純文字複製通常會將 NBSP 轉做空格，但 U+2060 會保留（9 個範圍 token）。
- **影響**：低；一般用戶唔會由 hook 框 copy 去搜尋，但會靜靜雞 0 結果，而且字面完全睇唔出分別。
- **方案 A（推薦）**：`studySetSearch` normalise：`.replace(/ /g, ' ').replace(/⁠/g, '')`（一行，連 Study fact 搜尋都受惠）+ memo-test 一句。
- **方案 B**：範圍唔用 U+2060，改 render `<span class="memo-nowrap">1853–56 年</span>`（CSS `white-space: nowrap`），複製出嚟係原字；但要拆 text node、test 嘅 `childNodes.length === 1` 要改，複雜啲。

### 🟢 S-272 — CUI-0044 幾何 check 有機會 vacuous pass；紅燈只係 ReferenceError

- **位置**：`tests/memo-test.js` CUI-0044 block，`top()` 冇 rect 時回 `null` 就 skip
- **描述**：如果將來 hook 框 hidden / `display: none` 或者 text node 結構變咗，所有 token 都 `null` → 0 個 split → PASS。另外紅 commit `0665d6d` 係喺 `memoHookNoBreak` 未定義時 crash，冇證明幾何 assertion 本身會紅（靠 QA script 修前 49 個斷開 token 間接證明）。
- **方案 A（推薦）**：每個 config 數 measured token（兩端都唔係 `null`），assert ≥ 一個下限（例如 ≥ 90，即 94 處黏位大部分）。
- **方案 B**：喺 test 內用未處理嘅 `g.hook` render 一次（例如暫時 monkey-patch `memoHookNoBreak = s => s`），assert 320 大字至少有一個 split —— 證明 check 有牙。

### 🟢 S-273 — 同類 token 仍然可以斷（記錄，範圍外）

- `ww2`「VE 8/5」「VJ 15/8」（VE / 8/5 可分兩行）、`intl-orgs`「UN 1945 年」（UN / 1945）、`elections`「650 選區」、`ww1`「20,000 英軍」，同埋連字號「D-Day」「Berners-Lee」「Stratford-upon-Avon」喺 `-` 斷。CUI-0044 預期結果冇包呢啲，QA 冇報。
- **方案 A**：加 `/\b(V[EJ]) (?=\d)/`、`/\b(UN) (?=\d)/` 兩條（同 AD 一樣），連字號用 U+2011 唔建議（字形變）。**方案 B**：保持現狀，等 QA / 用戶睇到先開 ticket。推薦 B（冇用戶投訴，hook 字係用戶定稿）。

### 🟢 S-274 — 改號殘留：舊號 CUI-0043 仲喺檔名 / script 頭

- `.proj-docs/qa/screenshots/v220/CUI-0043-320-zh-HK-large-vote-year-split.png`（CUI-0044 ticket 證據行仍引用呢個名）、`.proj-docs/qa/scripts/2026-10-13_qa-v220-token-split.js` 第 1 行「CUI-0043」—— 而家 CUI-0043 係 `main` 嘅 desktop 矮畫面 ticket，容易搞錯。
- **方案 A（推薦）**：`git mv` 做 `CUI-0044-…png`，同步 ticket / QA 報告引用，script 頭改 CUI-0044。**方案 B**：唔改名，ticket 證據行加「（舊號）」註。

## ✅ 做得好嘅地方

- 揀 render 時處理（方案 A），用戶定稿 `data/memo.js` 冇郁，`memo-domain-test` verbatim pin 照生效；搜尋讀原始 data，普通空格照搵到（4 例 test）。
- 規則全部要求「數字 + 空格 + 單位」，非數字前綴唔會黏，0 false glue（94 處逐個核對）。
- Test 用幾何（Range rect）驗結果，唔係驗實作；同時 assert 顯示字 normalise 後 == data，保證冇加 / 冇改字；12 個 config 全覆蓋。
- `escapeHtml` 次序同「冇 `&nbsp;`」都有 test pin。
- Merge 解法精準：程式碼路徑兩邊 diff 數字完全對得上，冇吞 PR #116 任何一行。

## 修正優先順序

| 優先 | ID | 內容 |
|---|---|---|
| 1 | W-083 | merge `origin/main` `fb5cc7b`，升 `APP_VERSION`，`memoHookNoBreak` 套埋 `hookEn`，test 跟 `local.hook` |
| 2 | S-271 | 搜尋 query normalise U+00A0 / U+2060 |
| 3 | S-272 | 幾何 check 加 measured token 下限 |
| 4 | S-274 | 舊號檔名 / script 頭 |
| 5 | S-273 | 記錄，等用戶 |

## 修訂後代碼（S-271，建議）

```js
// js/screens/study.js — a hook copied from the look view carries U+00A0 / U+2060 (CUI-0044); search the data's plain spaces
const SEARCH_NO_BREAK_CHARS = /[ ⁠]/g;
function studySetSearch(v) {
  study.search = v.replace(SEARCH_NO_BREAK_CHARS, ch => (ch === ' ' ? ' ' : '')).trim().toLowerCase();
  renderNewStudyList();
}
```

## Handoff receipt

```handoff-receipt
protocol: 1
status: pass
score: 91/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
next_action: merge_develop
next_agent: null
branch: "claude/charming-archimedes-hrh4wd"
context: "Review 8cff946..2e16ca8 pass 91, 0 C / 1 W / 4 S. Merge ff3e960 verified with --remerge-diff: code paths are exactly ours(7145c96..9f858ca) + PR #116 (7145c96..b859b7d), CUI-0043 = main byte-identical, our ticket CUI-0044. CUI-0044: NBSP before escapeHtml, 94 glue points over 61 hooks, 0 false glue, 0 overflow at 320 en/zh small/large; relaxed regexes not weaker (NBSP pinned by new block). Red 0665d6d = ReferenceError. run-all 70/71 + factmerge-test flake alone 2/2 -> 71/71. W-083: origin/main now fb5cc7b (PR #117 v2.1.3, PR #118 English hooks, APP_VERSION 2.2.0) -> conflicts in HANDOFF/data/memo.js/js/screens/memo.js/tests/memo-test.js; next merge must bump APP_VERSION (2.2.1), apply memoHookNoBreak to local.hook incl. hookEn, compare test against local hook; quirky-newton also 2.2.0 + same review filename. S-271 pasted hook text (U+2060/NBSP) finds nothing in search; S-272 geometry check can pass vacuously; S-273 VE/VJ/UN tokens still breakable (record); S-274 old CUI-0043 in screenshot filename/script header. Next IDs: C-008, W-084, S-275, CUI-0045."
blockers: []
```
