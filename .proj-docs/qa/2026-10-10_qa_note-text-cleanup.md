# QA Report — note-text-cleanup (4 組文字記憶法，18 題)

- **日期**：2026-10-10
- **測試員**：QA agent
- **範圍**：branch `fix/notes/note-text-cleanup`（origin/main 57dba14..75013aa：52ad25e test、75013aa fix）；data only（`data/exams.js` 18 個 `note`）+ `tests/note-text-test.js` + `run-all.sh` + `HANDOFF.md`
- **Spec**：`.proj-docs/plans/2026-10-10_handoff_note-text-cleanup.md`
- **環境**：Linux，node + playwright-core（`/opt/node-tools`），Chromium `/opt/pw-browsers/chromium`，`file://index.html`，每個 viewport 開始前 `localStorage.clear()`
- **總結**：PASS — 0 Critical，0 CUI ticket

## Hard Gates

| Gate | 結果 | 證據 |
|---|---|---|
| Tests | PASS | `tests/run-all.sh` exit 0，全部 suite PASS（包括 `NOTE-TEXT PASS`、`STUDY PASS`、`CONTENT-GUARD PASS`、`REVIEW PASS`、`I18N PASS`、`LANG-SWITCH PASS`）；之後 `git checkout -- 'tests/*.png'`，worktree clean |
| Coverage | PASS (N/A 代碼) | 冇 JS/CSS 改動；18 題 note 由 `note-text-test.js` 逐字鎖死 + 本 QA 獨立 verbatim 比對 |
| Security | PASS (N/A) | data only；note 經 `escapeHtml`（`noteLineHtml`）render |
| Data integrity | PASS | origin/main vs branch 逐 field diff：**只有 18 個 `note` field 改咗**，正好係 spec 嗰 18 題；記憶法組數 18 → 18 |
| Performance | N/A | 冇代碼改動 |
| No Critical | PASS | 0 |

## 測試覆蓋

### 1. Regression
`NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium tests/run-all.sh` → exit 0，所有 suite PASS。

### 2. Data（獨立於 developer 嘅 test）
- 由 handoff §2 code block 直接 parse 4 段文字，對 18 題 `EXAMS[e][n-1].note` 做 `===` 比對：18/18 逐字一致
- 分組結果：Magna Carta 8（E4Q17,E6Q7,E7Q15,E8Q14,E12Q24,E15Q7,E16Q17,E17Q22）、國會選舉 4（E3Q12,E4Q4,E6Q16,E7Q14）、戴卓爾夫人 3（E1Q9,E11Q8,E17Q5）、陪審員 3（E1Q14,E1Q15,E5Q6）— 同 spec 一致

### 3. Browser（playwright，390×844 同 1280×900，UI 語言 en 同 zh-HK）
抽查 6 題（每組 ≥1：E4Q17、E17Q22、E3Q12、E1Q9、E1Q14、E5Q6），每題 × 2 viewport × 2 語言 × 3 個位 = 72 項，全部 PASS：
- **Practice 答案框**（`#ansNote`）：4 行（標題 + 3 行），3 行 `.bullet`，內容同 note 逐行一致，page hscroll 0，box overflow 0
- **Results review**（`#rv<idx>`）：同上，item overflow 0
- **Study 💡 記憶法 卡**（`details.fact-mem`）：summary =「💡 記憶法」，3 行 `.bullet`，**冇標題行**（冇「記憶法」字），card overflow 0
- 兩個 viewport page error = 0
- Screenshot（scratchpad，非 repo）：`m390-zh-HK-E4Q17-study.png`、`d1280-en-E4Q17-results.png` 目視確認列點、hanging indent 正常

### 4. 都鐸王朝 / 三層屬地 未改
origin/main vs branch：`記憶法（都鐸王朝 Tudor）：` 9 題（E1Q6,E3Q4,E4Q16,E8Q24,E12Q9,E13Q12,E13Q23,E16Q3,E17Q14）、`記憶法（三層）：` 7 題（E1Q20,E2Q2,E5Q4,E5Q20,E11Q1,E12Q1,E17Q6）— note 文字同題號完全一致（UNCHANGED = true）。

## 主動 edge case 測試（新增，QA scratchpad，未 commit）

| # | Case | 結果 |
|---|---|---|
| E1 | 格式規則：標題 `^記憶法（.+）：$`；每行 `• 關鍵詞 → 解釋`；中間行「；」結尾、最後行「。」 | 4/4 組 PASS |
| E2 | 隱藏字元：行首尾空白、連續空白、tab、`\r`、zero-width / BOM | 0 個 |
| E3 | 範圍：除咗 18 個 note 之外，冇其他 question field（q/o/a/yue/…）被改 | 0 個額外改動 |
| E4 | Study 覆蓋：引用 18 題嘅**全部** fact 卡（#21、#92、#171、#178、#190、#208）— `factMemoryText` 讀第一個有記憶法嘅 src，6 張卡都顯示新 note（冇被其他組 note 搶先） | PASS |
| E5 | 兩個 UI 語言切換後 note 保持 `lang="zh-HK"` 同內容不變 | PASS |

## 失敗測試詳情
無。

## 問題 / Ticket
無 CUI ticket。

觀察（非 bug，唔開 ticket）：國會選舉 4 題分散喺 3 張 Study 卡（#171、#178、#190），所以同一 note 喺 Study 會出現 3 次 — 係 fact 分佈嘅現有行為，唔係今次改動造成。

## 建議
- Reviewer S-146 / S-147（optional）可按需要處理
- 用戶確認後，都鐸王朝、三層屬地可沿用同一個 `note-text-test.js` pattern 加組

## Handoff receipt

```
HANDOFF_RECEIPT
agent: quality-assurance
protocol: 2
branch: fix/notes/note-text-cleanup
commits: 52ad25e, 75013aa
status: pass
hard_gates: tests=pass coverage=pass(n/a-data) security=pass(n/a) data_integrity=pass performance=n/a no_critical=pass
critical_count: 0
tickets: none
next_action: merge_main
context: data-only; 18/18 notes verbatim to spec; browser 72/72 checks pass (390px + 1280px, en + zh-HK, Practice / Results / Study); Tudor + 三層 notes unchanged vs origin/main
```
