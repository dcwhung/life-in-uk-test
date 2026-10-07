# Implementation Plan：zh-HK UI locale + 語言切換掣（Track 1）＋ data 廣東話口語化（Track 2）

**版本**：v1.3（mockup 已確認；國家 chip、Result 字型、Track 2 batch 1 決定）
**日期**：2026-10-07
**關聯 Spec**：冇獨立 spec；需求來源 = `.claude/session-logs/2026-10-07_12-57.md`「下次 Session 建議任務 1」+ 2026-10-07 grill 決定 Q1–Q11 + Architect 可行性評估（2026-10-07）
**Base**：branch `claude/gallant-noether-fbnmml` = `main` `b247d2c`（v0.64）
**負責人**：Project Manager + Architect Agent

---

## 0. Grill 決定（用戶 2026-10-07 確認）

| # | 決定 |
|---|---|
| Q1 | zh-HK 只譯 UI 文字；題目／選項英文；廣東話翻譯 toggle 獨立照舊 |
| Q2 | 預設 `en`；撳掣先轉；記喺 `lifeuk.uiLang`（現有 `setLang()`） |
| Q3 | Header 右上角 pill 掣，顯示**目標語言**：en 時「中」、zh-HK 時「EN」，一撳即轉 |
| Q4 | 所有畫面都可即時轉，re-render 當前畫面並保留狀態，逐項測試 |
| Q5 | zh-HK UI 用**書面語**；data 嘅 `yue` 翻譯改**廣東話口語**（令用戶易明題目同答案） |
| Q6 | 兩條獨立 track、兩個 PR，可並行 |
| Q7 | Track 2 改 `yue` / `oy` / `note` / Study fact `yue` 四個欄位；虛詞／句構改口語；專有名詞、法例、機構、括號英文、年份、人名、固定詞保留；只改語體，唔改意思、唔加減資料 |
| Q8 | Track 2 分批：Exam 1–2 試樣 → Exam 3–4 → 5–8 → 9–12 → 13–17 → Study facts；每批出對照表，用戶 OK 先 commit |
| Q9 | 題號 `Exam 9 · Q15` / `E9·Q15`、章節 `Chapter 3` / `Ch 3` 保留英文格式；其餘書面語 |
| Q10 | 章節名（`data.chapters` / `chapterShort`）英文；國家、時代中文 +（英文）；難度、地理類型、人物類別純中文 |
| Q11 | Mockup `mockups/lang-switch.html`：5 個 tab（Header pill、Home、Quiz、Result、Study），EN / zh-HK 並排，用真 CSS；確認後 delete |

**技術預設（PM + Architect）**：locale code `zh-HK`（`locales/zh-HK.js`、`LOCALES['zh-HK']`、`<html lang="zh-HK">`）；`manifest.webmanifest`、`<title>`、meta 保持英文；zh-HK.js **唔**加入 `LATE_BOOT_SCRIPTS`。

## 0b. Mockup 確認後決定（用戶 2026-10-07）

| # | 決定 |
|---|---|
| M1 | `mockups/lang-switch.html` OK（pill 樣式 `.lang-btn`、字體 stack 照 mockup） |
| M2 | **修訂 Q10**：Study 地理國家 **chip** 只寫中文（`data.nations.*.chip`：🇬🇧 英國、🏴 英格蘭、🏴 蘇格蘭、🏴 威爾斯、☘️ 北愛爾蘭）；`label`（標題）保留「中文（English）」 |
| M3 | Fact 年份 `yl` 係 data，zh-HK 照舊英文；`study.yearBC` key 照留（parity） |
| M4 | Result `.result-sub` 喺 320px 尾字跌行 → **縮細字型**（窄屏 `.result-sub` 用細一級 font-size token），文案唔改 |
| M5 | `.quiz-label` / `.q-num` letter-spacing 唔改 |
| M6 | Practice 全部題目嗰組改名：`home.allExams` 🎯 All Questions (408) / 🎯 全部試題（408 題）、`common.allExams` All Questions / 全部試題、`quiz.allShuffled` All Questions (shuffled) / 全部試題（隨機排序）；`common.questions` 冇再用，刪走 |

## 0c. Track 2 batch 1 決定（用戶 2026-10-07）

| # | 題目 | 決定 |
|---|---|---|
| Y1 | Exam 1 · Q4 | `yue` 改「英國喺地圖上喺邊度？」 |
| Y2 | Exam 1 · Q13 | 保留「總警司」（唔改） |
| Y3 | Exam 1 · Q17 | 保留「選票」（唔改） |
| Y4 | Exam 1 · Q19 | `yue` 補返「法例規定」 |
| Y5 | Exam 2 · Q10 note | 「公元前55BC」→「公元前55年（55 BC）」 |
| Y6 | Exam 2 · Q11 + 戰役 note | 統一譯名「阿佛烈大帝」；之後批次（同 Study facts）見到「阿爾弗雷德大帝」一律改 |

---

## 可行性評估

### 技術可行性
| 項目 | 評估 | 備注 |
|------|------|------|
| 技術棧支持 | ✅ | v0.59 i18n 架構已就緒：`t()`、`setLang()`、`hasLocale()`、`SCREEN_RERENDER`、fallback 去 en |
| 第三方依賴 | ✅ | 冇；字體只用系統 CJK 字體，唔載 web font |
| 性能要求 | ✅ | 多一個 ~15 KB locale file；切換只 re-render 當前畫面 |
| 安全要求 | ✅ | `*Html` key 只係固定 markup；`setLang()` 已用 `hasLocale()` 擋 `__proto__` 等（W-006） |
| 狀態保留 | ✅ | 所有畫面狀態喺 `state` / `study` / globals；只有短暫效果（Result `.hl`、Study `.flash`）同捲動位置會變，接受 |
| Track 2 內容 | ⚠️ | 工作量大（~367 條有書面語標記，實際可能更多）；要 content guard test 防止改到英文題目／答案 |

**總體可行性**：⚠️ 有條件可行

**條件**：
1. zh-HK 嘅 `app.title` / `description` / `shortName` / `installName` / `installShortName` 要照抄 en（否則 `applyDocumentI18n()` 會將 `<title>` / meta 改做中文，違反「保持英文」）
2. Confirm modal 開住時 `toggleLang` 唔做嘢（modal 冇 focus trap，Tab 鍵去得到 pill，切換後 modal 文字會停喺舊語言）
3. Track 2 要先有 content guard test，同埋改 2 個寫死 `yue` 原文嘅舊測試

### 狀態保留清單（Architect 逐項 trace）

| 畫面 | 狀態 | 結果 | 證據 | 處理 |
|---|---|---|---|---|
| Home | `pendingMode`、practice tab、My Review | ✅ | `js/screens/home.js:11-12, 43, 78` | 測試 |
| Home | install banner 顯示 | ✅ | `js/pwa/pwa.js:21` | — |
| Quiz practice | `current`、`answers`、`revealed`、`yueShown`、flags | ✅ | `js/screens/quiz.js:52-68` | 測試 |
| Quiz | Similar panel / Core Fact | ✅ 由 `state` 重砌 | `js/screens/similarPanel.js:237-243` | 測試 |
| Quiz exam | timer | ✅ interval 唔停、`examDeadline` 唔變；字最遲 1 秒先換 | `js/screens/examTools.js:18-35` | 切換時即刻寫一次 timer 文字（**唔可以** call `examTick`，0 秒會觸發 finish） |
| Quiz exam | flags、dots、legend | ✅ | `js/screens/examTools.js:81-106` | 測試 |
| Side session | `sessionReturn`、↩ Back label | ✅ | `js/screens/sideSession.js:129`、`quiz.js:150` | 測試 |
| Result | `reviewItems`、`reviewFilter`、`timeUp` | ✅ `renderResults()` 唔會再記成績 | `js/screens/result.js:32-39` | 測試（成績唔會重複記錄） |
| Result | jump 後 `.hl` 高亮 | ❌ 消失（短暫效果） | `result.js:111-112` | 接受 |
| Flagged | 列表 | ✅ | `js/screens/flagged.js:187-195` | 測試 |
| Study | tab、chapter、nation、group、toggles、搜尋字 | ✅ 喺 `study` object；`<input>` value 唔會被改 | `js/screens/study.js:31-42, 73, 137-150` | 測試 |
| Study | `.flash` | ❌ 消失（短暫效果） | `study.js:158-159` | 接受 |
| Quiz / Study | 捲動位置 | ⚠️ 唔 reset，但內容高度變會漂移 | — | 接受 |
| 全部 | double tap guard | ✅ 換語言唔改 view，唔會 arm | `js/core/actions.js:79-82` | — |
| Confirm modal | 文字 | ⚠️ Tab 鍵可去 pill | `js/components/modal.js:7-15` | `isConfirmOpen()` 時唔切換 |
| ⓘ popover | 內容 | ✅ `applyDocumentI18n` 會 `fillInfoCounts()` | `js/core/i18n.js:63`、`popover.js:14` | 箭咀寫死 `left:150px`（`popover.css:24`），中文 `app.name` 唔變（照抄 en），冇影響 |

---

## 階段劃分

### Track 1 — zh-HK locale + 切換掣（PR A，v0.65）

#### Phase 1A：Mockup 確認
- **目標**：用戶確認 pill 樣式同中文排版
- **包含功能**：`mockups/lang-switch.html`（5 tab、EN / zh-HK 並排、390px + 320px、用真 CSS + 附錄 A 文案）
- **完成標準**：用戶回覆確認；如有改動先改 mockup 再確認

#### Phase 1B：實作
- **目標**：zh-HK 完整可用，撳掣即轉
- **包含功能**：`locales/zh-HK.js`、header pill、`toggleLang` action、`ZH_HK_LANG` const、CJK 字體 stack、SHELL、`APP_VERSION` 0.65
- **完成標準**：附錄 A 所有 key 有值；5 個畫面切換冇 `[i18n] missing key`；狀態保留清單全部測試通過；`tests/run-all.sh` 全綠

#### Phase 1C：Review → QA → PR → merge → HANDOFF
- **完成標準**：Review ≥ 90 分冇 🔴；QA 冇 🔴；HANDOFF.md i18n 章節更新（移除「未有語言切換掣」，加 zh-HK glossary）

### Track 2 — data 廣東話口語化（PR B，v0.66 或者跟 Track 1 次序）

#### Phase 2A：守衛
- **目標**：保證只改 `yue` / `oy` / `note`
- **包含功能**：`tests/content-guard-test.js`（baseline = pinned SHA `b247d2c`）；改 `tests/similar-test.js:66`、`tests/study-test.js:111-113` 唔再依賴原文
- **完成標準**：guard test 喺未改 data 時 pass；故意改 `q` 會 fail

#### Phase 2B：試樣（Exam 1–2）
- **目標**：定語感
- **完成標準**：用戶確認對照表；寫低語感規則（例子 10 條）入 plan 附錄 B

#### Phase 2C：分批（Exam 3–4 → 5–8 → 9–12 → 13–17 → Study facts）
- **完成標準**：每批對照表用戶 OK → commit；guard test + `run-all.sh` 綠

#### Phase 2D：Review → QA → PR → merge → HANDOFF

---

## 任務分解

| 任務編號 | 任務描述 | 類型 | 負責 Agent | Mockup Binding | 預計工作量 | 依賴任務 | 優先級 |
|----------|----------|------|-----------|----------------|-----------|----------|--------|
| T-001 | Mockup `mockups/lang-switch.html`（5 tab，EN / zh-HK 並排，390 + 320px） | chore | Frontend Developer | proposal: 本 plan §0 Q3 / Q11 | 0.5 日 | - | P0 |
| T-002 | `locales/zh-HK.js`（附錄 A，約 250 key；5 個 `SAME_AS_EN_KEYS` 照抄 en） | feature | Frontend Developer | none-required（純文案，無 layout） | 1 日 | T-001 確認文案 | P0 |
| T-003 | `tests/i18n-test.js`：zh-HK key parity、`{param}` 一致、plural `other`、Html tag 序列一致、`SAME_AS_EN_KEYS`、`app.langSwitch` 入 `CJK_WHITELIST` | test | Frontend Developer | none-required | 0.5 日 | - | P0 |
| T-004 | Header pill：`index.html`（`data-i18n="app.langSwitch"` + `data-i18n-attr` aria-label / title + `data-action="toggleLang"`）、CSS、`config.js` `ZH_HK_LANG`、`actions.js` `toggleLang`（`isConfirmOpen()` 時唔做嘢）、切換後即刻寫 timer 文字 | feature | Frontend Developer | mockup: mockups/lang-switch.html | 0.5 日 | T-001、T-002 | P0 |
| T-005 | `css/base/layout.css` 字體 stack 加 `'PingFang HK', 'Noto Sans HK', 'Noto Sans CJK HK', 'Microsoft JhengHei'` | feature | Frontend Developer | mockup: mockups/lang-switch.html | 0.1 日 | T-001 | P1 |
| T-006 | `sw.js` SHELL 加 `locales/zh-HK.js`；`index.html` 喺 `locales/en.js` 後加 tag；`APP_VERSION` → 0.65 | chore | Frontend Developer | none-required | 0.1 日 | T-002 | P0 |
| T-007 | 新 `tests/lang-switch-test.js`：pill label / `<html lang>`、5 畫面無 missing key、狀態保留清單每項、modal 開住唔切換、timer 即時換字、`<title>` 保持英文、320px 冇橫向 overflow | test | Frontend Developer | none-required | 1 日 | T-004 | P0 |
| T-008 | `tests/upgrade-test.js` 加 case：舊 shell（冇 zh-HK tag）+ `uiLang = 'zh-HK'` → 用 en、冇 warning、storage 唔被覆寫 | test | Frontend Developer | none-required | 0.2 日 | T-006 | P1 |
| T-009 | Code review（Track 1） | — | Code Reviewer | — | — | T-002–T-008 | P0 |
| T-010 | QA（Track 1）+ 截圖 | test | Quality Assurance | — | — | T-009 | P0 |
| T-011 | HANDOFF.md：i18n 章節、glossary 加 zh-HK 欄、file 表、v0.65 | docs | Project Manager | — | 0.2 日 | T-010 | P1 |
| T-012 | Delete `mockups/lang-switch.html` | chore | Frontend Developer | — | — | T-010 | P1 |
| T-101 | `tests/content-guard-test.js`（pinned SHA baseline；除 `yue` / `oy` / `note` 外 exams 全部欄位唔准變；`oy.length === o.length`、原本 `''` 保持 `''`；study 除 `yue` 外唔准變） | test | Backend Developer | none-required | 0.3 日 | - | P0 |
| T-102 | 改 `tests/similar-test.js:66`（寫死 `'地區議會做乜嘢？'`）、`tests/study-test.js:111-113`（搜 `首相` ≥ 5）改為唔依賴原文 | test | Backend Developer | none-required | 0.2 日 | - | P0 |
| T-103 | 試樣 Exam 1–2（48 題）對照表 `.proj-docs/plans/2026-10-07_yue-batch-1.md` | chore | Backend Developer | none-required | 0.3 日 | T-101 | P0 |
| T-104 | Exam 3–4 | chore | Backend Developer | none-required | 0.3 日 | T-103 確認 | P1 |
| T-105 | Exam 5–8 | chore | Backend Developer | none-required | 0.5 日 | T-104 | P1 |
| T-106 | Exam 9–12 | chore | Backend Developer | none-required | 0.5 日 | T-105 | P1 |
| T-107 | Exam 13–17 | chore | Backend Developer | none-required | 0.6 日 | T-106 | P1 |
| T-108 | Study facts（236 條 `yue`） | chore | Backend Developer | none-required | 0.5 日 | T-107 | P1 |
| T-109 | Review + QA（Track 2）+ `APP_VERSION` +0.01 + HANDOFF | — | Code Reviewer / QA / PM | — | — | T-108 | P1 |

> Track 2 改 `data/*.js`，冇 UI layout 改動，所以 `none-required`。

### 狀態（Track 1，2026-10-07）

| 任務 | 狀態 | Commit / 證據 |
|---|---|---|
| T-001 | ✅ done | `a02aefa`（mockup，用戶確認 M1） |
| T-002 | ✅ done | `8cf2d38`；M6 改名 `54596fd` |
| T-003 | ✅ done | `a7cf810`（Red） |
| T-004 | ✅ done | `1fdb840`；W-013 `3ef54d9` |
| T-005 | ✅ done | `1fdb840`；M4 `1c6bc37` |
| T-006 | ✅ done | `92f6db9`（`APP_VERSION` 0.65） |
| T-007 | ✅ done | `a7cf810`、`583a9ca`；W-014 `3ad4d6e`、S-043 / S-044 `65303be`、M6 `c3da68b` |
| T-008 | ✅ done | `a7cf810`（`upgrade-test` ⑥）；⑦ `3ef54d9` |
| T-009 | ✅ done | `.proj-docs/reviews/2026-10-07_review_v065-zh-hk.md`（Round 2 93 / 100 pass） |
| T-010 | ✅ done | `.proj-docs/qa/2026-10-07_qa_v065-zh-hk.md`（pass；新 ticket CUI-0013、CUI-0014） |
| T-011 | ✅ done | HANDOFF.md v0.65（docs commit T-011 T-012） |
| T-012 | ✅ done | `git rm mockups/lang-switch.html`（同一 commit） |

Track 2（T-101…T-109）：進行中，branch `claude/yue-colloquial`，另一個 PR。

---

## 風險登記

| 風險編號 | 風險描述 | 可能性 | 影響 | 應對方案 | 負責人 |
|----------|----------|--------|------|----------|--------|
| R-001 | zh-HK `app.title` 等被翻譯，`<title>` / meta 變中文 | 高 | 中 | `SAME_AS_EN_KEYS` 照抄 en + 測試釘死 | Frontend |
| R-002 | Modal 開住時用 Tab 去 pill 切換，modal 文字停喺舊語言 | 低 | 低 | `toggleLang` 喺 `isConfirmOpen()` 時 return | Frontend |
| R-003 | zh-HK 缺 key / 多 key / `{param}` 打錯 | 中 | 中 | T-003 parity test + T-007 runtime 無 warning | Frontend |
| R-004 | `similar.practise` 嘅 `one`（「▶ 練習此題」）喺 zh-HK 永遠唔會用到（`Intl.PluralRules('zh-HK')` 只返 `other`），1 題會顯示「▶ 練習這 1 題」 | 確定 | 低 | 見開放問題 #1 | PM |
| R-005 | 中文字令窄屏 nowrap 元素爆位（`home.css:145` `.ch-name`、`home.css:38` `.reset-btn`、`quiz.css:47` `.q-num-text`、`dots.css:49` `.rmeta`、`quiz.css:9` `.quiz-meta`） | 低 | 中 | Mockup 320px 檢查 + T-007 320px overflow assertion；文案避免長句 | Frontend |
| R-006 | Track 2 唔小心改咗英文題目／答案 | 中 | 高 | T-101 guard test（pinned SHA，唔用 `origin/main`：merge 後會郁，shallow clone 未必有） | Backend |
| R-007 | Track 2 口語化改變意思 | 中 | 高 | 每批對照表用戶確認先 commit；規則「只改語體」 | PM |
| R-008 | Track 2 改 `yue` 令 Study 搜尋結果改變 | 確定 | 低 | 預期之內；T-102 改測試唔依賴原文 | Backend |
| R-009 | 捲動位置喺切換後漂移；Result `.hl`、Study `.flash` 消失 | 中 | 低 | 接受（短暫效果） | — |
| R-010 | 兩個 PR 都升 `APP_VERSION`，並行時 merge conflict | 中 | 低 | 後 merge 嗰個由最新 `main` 重開 branch 再升版本 | DevOps |

---

## 依賴關係

### 內部依賴
```
Track 1: T-001 ──確認──▶ T-002 ──▶ T-004 ──▶ T-007 ──▶ T-009 ──▶ T-010 ──▶ T-011, T-012
                    │         └──▶ T-006 ──▶ T-008 ─┘
         T-003 ─────┘（可同 T-002 一齊做）   T-005（T-001 後）
Track 2: T-101, T-102 ──▶ T-103 ──確認──▶ T-104 ──▶ … ──▶ T-108 ──▶ T-109
Track 1 ⟂ Track 2（冇 file 重疊，除 config.js APP_VERSION，見 R-010）
```

### 外部依賴
| 依賴項 | 類型 | 狀態 | 影響任務 |
|--------|------|------|----------|
| 用戶確認 mockup | 人員 | 待確認 | T-002 起 |
| 用戶確認 glossary（附錄 A） | 人員 | 待確認 | T-002 |
| 用戶確認每批口語化對照表 | 人員 | 待確認 | T-103–T-108 |

---

## 工作量估算

| 階段 | 前端 | 內容 / 數據 | DevOps | QA | 總計 |
|------|------|------|--------|-----|------|
| Track 1 | 3.5 日 | — | 0.1 日 | 0.5 日 | ~4 日 |
| Track 2 | — | 3.2 日 + 用戶確認時間 | 0.1 日 | 0.5 日 | ~4 日 |
| **總計** | 3.5 日 | 3.2 日 | 0.2 日 | 1 日 | **~8 日（兩 track 並行約 4–5 日）** |

---

## 建議開始順序

```
Step 1 → T-001 Mockup（UI 改動慣例：先確認先改 code）＋同時 T-101 / T-102 Track 2 守衛（無依賴）
Step 2 → 用戶確認 mockup + glossary；同時 T-103 試樣對照表俾用戶睇
Step 3 → T-002 / T-003 / T-004 / T-005 / T-006（/feature，TDD：先寫 T-003、T-007 failing test）
Step 4 → T-007 / T-008 → Review → QA → PR A merge → HANDOFF
Step 5 → Track 2 T-104 起逐批（每批用戶確認）→ Review → QA → PR B merge → HANDOFF
```

---

## 假設及前提

- 冇 `develop` branch；PR 直接入 `main`（HANDOFF 慣例）
- 每個 PR `APP_VERSION` +0.01；只改測試／文件唔升
- Track 2 口語化由 AI 起草，用戶逐批確認；用戶係最終語感判斷
- 字體只加系統字體，唔引入 web font（離線 + 冇 dependency）
- `manifest.webmanifest` 冇 locale 版本，安裝後 app 名照舊英文

---

## 開放問題

| # | 問題 | 影響任務 | 需要誰決定 | 建議 |
|---|------|----------|-----------|------|
| 1 | `similar.practise` 1 題時 zh-HK 顯示「▶ 練習這 1 題」得唔得？ | T-002 | 用戶 | ✅ 2026-10-07 用戶接受；zh-HK 只提供 `other` |
| 2 | 附錄 A glossary 文案 | T-002 | 用戶 | ✅ 2026-10-07 用戶確認 OK |
| 3 | Track 2 先定 Track 1 先 merge？ | T-109 | 用戶 | ✅ 2026-10-07：Track 1 先 merge |

---

## 附錄 A：zh-HK Glossary 草稿（全部 key，書面語）

> 規則：Q5 書面語；Q9 `Exam {n}`、`Exam 9 · Q15`、`E9·Q15`、`Chapter {n}`、`Ch {n}` 保留英文格式；Q10 章節名英文、國家／時代中文 +（英文）、其餘純中文。
> **例外（用戶 2026-10-07 修訂）**：tab 標籤（`home.tabDifficulty` / `tabChapter` / `tabExam`、`study.tab*`）全中文（難度 / 章節 / 試卷、📚 章節…）；`Chapter {n}` / `Ch {n}` / `Exam {n}` 呢類**帶號碼**嘅標籤先保留英文格式。
> 數字、emoji、箭咀位置、分隔符 ` · ` / ` | ` 同 en 一致。中英之間唔加空格，數字前後留空格（例如「共 408 題」）。
> `{param}` 同 en 一樣；plural 只需 `other`（`Intl.PluralRules('zh-HK')` 只會返 `other`）。

### app
| Key | en | zh-HK |
|---|---|---|
| title / description / shortName / installName / installShortName | （document title、meta、manifest 對應值） | **照抄 en**（`SAME_AS_EN_KEYS`，測試釘死；`<title>` / meta 保持英文） |
| name | Life in the UK | 同 en（app 名稱） |
| sub | Exam Practice | 考試練習 |
| about | About this app | 關於本程式 |
| infoTitle | Exam 1–{n} Practice | Exam 1–{n} 練習 |
| infoIntro | {n} official-style questions from lifeintheuktestweb.co.uk, with Cantonese translations and notes. | 收錄 {n} 條 lifeintheuktestweb.co.uk 官方風格題目，附廣東話翻譯及備注。 |
| infoExams | 📋 {n} Exams | 📋 {n} 份試卷 |
| infoQuestions | ❓ {n} Questions | ❓ {n} 條題目 |
| infoOffline | 🔒 Works Offline | 🔒 支援離線使用 |
| installTitle | Install for offline use | 安裝以便離線使用 |
| installText | Add to home screen to study without internet | 加至主畫面，無需網絡亦可溫習 |
| installButton | Install | 安裝 |
| installDismiss | Dismiss | 關閉 |
| langSwitch（新） | 中（加入 `CJK_WHITELIST`） | EN |
| langSwitchLabel（新，aria-label / title） | Switch to Chinese | 切換至英文 |

### home
| Key | en | zh-HK |
|---|---|---|
| chooseMode | Choose Mode | 選擇模式 |
| modeStudy / modePractice / modeExam | Study / Practice / Exam | 溫習 / 練習 / 模擬考試 |
| practiceDescHtml | **Practice** — See the answer… | **練習** — 每題作答後即時顯示答案及廣東話翻譯。可按難度、章節或試卷選題，並顯示各組掌握進度。 |
| examDescHtml | **Exam** — Answer all {n} questions… | **模擬考試** — 仿照真實考試作答全部 {n} 題，可返回修改答案。於最後一題提交後，即可查看分數及答案。請於下方選擇試卷。 |
| myReview | My Review | 我的複習 |
| practiceBy | Practice By | 練習分類 |
| tabDifficulty / tabChapter / tabExam | Difficulty / Chapter / Exam | 難度 / 章節 / 試卷 |
| selectExam | Select Exam | 選擇試卷 |
| allExams | 🎯 All Questions ({n})（M6，原 All Exams） | 🎯 全部試題（{n} 題） |
| randomExam | 🎲 Random Exam | 🎲 隨機試卷 |
| randomExamSub | {n} questions from {total} | 從 {total} 題中抽取 {n} 題 |
| practiceHintHtml | Answer a question correctly **{streak} times in a row**… | 同一題**連續答對 {streak} 次**即算掌握。每輪最多抽取 **{max}** 條未掌握的題目，每題出現一次；未掌握的題目會於下一輪再出現。已掌握的題目會略過，直至整組全部掌握。 |
| resetProgress | ↺ Reset progress | ↺ 重設進度 |
| examResetHint | Completed exams are marked with ✓. | 已完成的試卷會以 ✓ 標示。 |
| resetCompleted | ↺ Reset completed exams | ↺ 重設已完成試卷 |
| wrongTitle | Wrong answers | 錯題 |
| wrongEmpty | Nothing to review yet | 暫時未有需要複習的題目 |
| wrongToClear | {n} to clear | 尚餘 {n} 題 |
| wrongToClearRounds | {n} to clear · {max} per round | 尚餘 {n} 題 · 每輪 {max} 題 |
| flaggedTitle | Flagged | 已標記 |
| flaggedCount | {n} flagged | 已標記 {n} 題 |
| flaggedEmptyHtml | Tap {icon} on a question to flag it | 於題目按 {icon} 即可標記 |
| myReviewNote | Wrong answers come from Practice and Exam… | 錯題來自練習及模擬考試，於此答對後便會清除。每輪最多 {max} 題。 |

### quiz
| Key | en | zh-HK |
|---|---|---|
| questionOf | Question {n} of {total} | 第 {n} 題（共 {total} 題） |
| selectN | (select {n}) | （選擇 {n} 項） |
| allShuffled | All Questions (shuffled) | 全部試題（隨機排序） |
| translate / hideTranslation | Translate / Hide translation | 翻譯 / 隱藏翻譯 |
| previous / next / back / finish | Previous / Next / Back / Finish | 上一題 / 下一題 / 返回 / 完成 |
| prevButton / nextButton / backButton / finishButton | ← Prev / Next → / ↩ Back / Finish ✓ | ← 上一題 / 下一題 → / ↩ 返回 / 完成 ✓ |
| correct / wrong | ✓ Correct! / ✗ Wrong | ✓ 正確！ / ✗ 錯誤 |
| yueQ / yueA | Q) / A) | 同 en |
| roundNoteWrong | Round 1 of {rounds} · {n} of your {total} wrong answers | 第 1 輪（共 {rounds} 輪）· 錯題 {total} 題中的 {n} 題 |
| roundNoteFlagged | … flagged questions | 第 1 輪（共 {rounds} 輪）· 已標記 {total} 題中的 {n} 題 |

### exam
| Key | en | zh-HK |
|---|---|---|
| submit | Submit | 提交 |
| timer | ⏱ {time} | 同 en |
| timeUp | ⏱ Time's up — your exam was submitted automatically. | ⏱ 時間到，試卷已自動提交。 |

### result
| Key | en | zh-HK |
|---|---|---|
| passed / needsImprovement | 🎉 PASSED / 📚 NEEDS IMPROVEMENT | 🎉 合格 / 📚 有待改善 |
| passNeeded | You need {mark}/{size} ({pct}%) to pass the real test. | 真實考試須答對 {mark}/{size}（{pct}%）方為合格。 |
| passThreshold | {pct}% pass threshold. You scored {score}%. | 合格線為 {pct}%，你的得分為 {score}%。 |
| byDifficulty | By Difficulty | 按難度 |
| reviewAnswers | Review Answers | 檢視答案 |
| retry / anotherExam / anotherPractice | Retry / Another Exam / Another Practice | 重做 / 另一份試卷 / 另一組練習 |
| clearedNote | Cleared {n} from your wrong answers · {left} left | 已從錯題清除 {n} 題 · 尚餘 {left} 題 |
| masteredNote | Mastered {n} more this round · {mastered}/{total} in {set} | 本輪新掌握 {n} 題 · {set} 已掌握 {mastered}/{total} |

### review
| Key | en | zh-HK |
|---|---|---|
| filterAll / filterWrong / filterFlagged | All / Wrong / Flagged | 全部 / 錯誤 / 已標記 |
| yourAnswer | Your answer: {answer} | 你的答案：{answer} |
| noAnswer | No answer | 未作答 |

### similar
| Key | en | zh-HK |
|---|---|---|
| title | Similar Questions | 相似題目 |
| subtitle | Same fact, asked differently | 同一知識點，不同問法 |
| coreFact | 📌 Core Fact #{id} | 📌 核心知識 #{id} |
| appearsIn | Appears in: | 出現於： |
| node | E{exam}·Q{n} | 同 en |
| legendCurrent / legendInProgress | This question / In progress | 本題 / 進行中 |
| practise | ▶ Practise this one / these {n} | ▶ 練習此題 / ▶ 練習這 {n} 題（`one` 都要提供，`n = 1` 時 zh-HK 用 `other` → 需處理，見風險 R-004） |

### flagged
| Key | en | zh-HK |
|---|---|---|
| title | Flagged | 已標記 |
| practise | Practise flagged ({n}) | 練習已標記題目（{n}） |
| practiseSub | Each question once · up to {max} per round | 每題一次 · 每輪最多 {max} 題 |
| empty | No flagged questions left. | 已沒有標記的題目。 |

### study
| Key | en | zh-HK |
|---|---|---|
| title | 📖 Study | 📖 溫習 |
| search | Search facts (English / Cantonese) | 搜尋知識點（英文／廣東話） |
| tabChapters / tabTimeline / tabGeo / tabPeople | 📚 Chapters / 📅 Timeline / 🗺️ Geography / 👤 People | 📚 章節 / 📅 時間線 / 🗺️ 地理 / 👤 人物 |
| hideMastered | ✓ Hide mastered | ✓ 隱藏已掌握 |
| bookmarkedOnly | Bookmarked only | 只顯示書籤 |
| warsOnly | ⚔️ Wars only | ⚔️ 只顯示戰爭 |
| all | All | 全部 |
| count | {shown} / {total} facts | {shown} / {total} 項知識點 |
| empty | No facts match. | 沒有符合的知識點。 |
| chapterTitle | Chapter {n}: {title} | 同 en（Q9 / Q10） |
| yearBC | {n} BC | 公元前 {n} 年 |
| war | ⚔️ War / battle | ⚔️ 戰爭／戰役 |
| bookmark / mastered | Bookmark / Mastered | 書籤 / 已掌握 |
| masteredDerived | 🏆 Mastered — every source question mastered | 🏆 已掌握 — 所有來源題目均已掌握 |
| progress | 🏆 {n} / {total} mastered | 🏆 已掌握 {n} / {total} |
| factId | #{id} | 同 en |

### modal
| Key | en | zh-HK |
|---|---|---|
| submitTitle | Submit exam? | 提交試卷？ |
| submitUnanswered | {n} questions unanswered | 尚有 {n} 題未作答 |
| submitFlagged | {n} flagged | 已標記 {n} 題 |
| submitCheck | You can still go back and check them. | 你仍可返回檢查。 |
| submitCancel | Keep going | 繼續作答 |
| leaveTitle / leaveMessage | Leave the exam? / Your answers will be lost. | 離開考試？ / 已作答的答案將會遺失。 |
| leaveOk / leaveCancel | Leave / Stay | 離開 / 留下 |
| resetProgressTitle | Reset practice progress? | 重設練習進度？ |
| resetProgressMessage | Mastery streaks, wrong answers and flags will be cleared. | 掌握進度、錯題及標記將會清除。 |
| resetCompletedTitle | Reset completed exams? | 重設已完成試卷？ |
| resetCompletedMessage | All ✓ completed marks will be cleared. | 所有 ✓ 完成標示將會清除。 |
| resetOk / resetCancel | Reset / Keep | 重設 / 保留 |

### common
| Key | en | zh-HK |
|---|---|---|
| home | ← Home | ← 主頁 |
| practice / exam | Practice / Exam | 練習 / 模擬考試 |
| examN | Exam {n} | 同 en |
| allExams / randomExam | All Questions / Random Exam | 全部試題 / 隨機試卷 |
| chapterN / chapterShort | Chapter {n} / Ch {n} | 同 en |
| similarSet | Similar Questions | 相似題目 |
| factSet | Fact #{id} | 知識點 #{id} |
| wrongSet / flaggedSet | Wrong answers / Flagged | 錯題 / 已標記 |
| questionN | Question {n} | 第 {n} 題 |
| questionRef | Exam {exam} · Q{n} | 同 en |
| correct / wrong / answered / unanswered / flagged | Correct / Wrong / Answered / Unanswered / Flagged | 正確 / 錯誤 / 已作答 / 未作答 / 已標記 |
| flagForReview / unflag | Flag for review / Unflag | 標記待覆閱 / 取消標記 |
| mastered | 🏆 Mastered | 🏆 已掌握 |
| streak | 🔥 {n}/{max} | 同 en |
| difficultyTitle | Difficulty {d}/{max} | 難度 {d}/{max} |
| yueTitle / noteLabel | 【廣東話翻譯】 / 💡 備注： | 同 en |

### data
| Key | zh-HK |
|---|---|
| chapters.1–5 / chapterShort.1–5 | 同 en（Q10） |
| difficulty | 1 容易 / 2 基礎 / 3 中等 / 4 困難 / 5 極難 |
| eras | 石器及鐵器時代（Stone Age & Iron Age）、羅馬時期（Romans）、盎格魯-撒克遜及維京時期（Anglo-Saxons & Vikings）、諾曼及中世紀（Normans & Middle Ages）、都鐸王朝（Tudors）、斯圖亞特王朝（Stuarts）、喬治時代（Georgian）、維多利亞時代（Victorian）、20 世紀（20th century）、21 世紀（21st century） |
| nations.label / chip | 🇬🇧 英國（United Kingdom）/ 🇬🇧 英國（UK）；🏴 英格蘭（England）；🏴 蘇格蘭（Scotland）；🏴 威爾斯（Wales）；☘️ 北愛爾蘭（Northern Ireland）/ ☘️ 北愛爾蘭（N. Ireland） |
| geoTypes | 🏙️ 城市及首府、⛰️ 山脈、公園及自然景觀、🏛️ 地標及建築、🗺️ 地區及領土 |
| people.label / chip | 👑 君主及統治者 / 👑 君主；🏛️ 首相、政治人物及軍事人物 / 🏛️ 政治及軍事；🔬 科學家、發明家及工程師 / 🔬 科學家；✒️ 作家及詩人 / ✒️ 作家；🎨 藝術家、建築師及作曲家 / 🎨 藝術家；🏅 體育及探險 / 🏅 體育；✊ 改革者及其他 / ✊ 改革者 |
