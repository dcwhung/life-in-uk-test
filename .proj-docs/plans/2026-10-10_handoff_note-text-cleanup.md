# Handoff：4 組文字記憶法整理（Magna Carta、國會選舉、戴卓爾夫人、陪審員）

**日期**：2026-10-10
**狀態**：內容已確認（用戶 2026-10-10），待改 data
**Design Origin**：`mockup:mockups/note-text-cleanup.html`（第 3–6 組；第 1–2 組都鐸王朝、三層屬地**未確認，唔好改**）
**Base**：`main` @ `ceee638`（v1.0.6）
**Task type**：`/fix`（data only：`data/exams.js` 嘅 `note`，唔改 JS / CSS）

> 下個 session：讀呢份 handoff，照 §2 逐字改 **18 題** 嘅 `note`，跑 §3 驗證，開 PR。唔使出 mockup、唔使改 code。

---

## 1. 整理原則（用戶已確認）

1. 標題統一「記憶法（主題）：」
2. 每行「關鍵詞 → 解釋」，用 `•` 列點
3. 每行「；」結尾，最後一行「。」
4. 只用 app 而家支援嘅格式（`noteLineHtml()`：`•` bullet、`◦` 子項、空行），唔使改 code

---

## 2. 新 note（逐字照抄；JS string 入面換行寫 `\n`）

同一組所有題嘅 `note` 要逐字一樣，**成個 note 換走**（呢 4 組嘅題 note 只有記憶法，冇前綴句；改之前用 §3 script 確認）。

### 2.1 Magna Carta（8 題）

題目：Exam 4 Q17、6 Q7、7 Q15、8 Q14、12 Q24、15 Q7、16 Q17、17 Q22

```
記憶法（Magna Carta，大憲章）：
• 1215 → King John（約翰王）簽署；
• 重點 → 冇人凌駕法律之上，國王都唔例外；
• 影響 → 限制國王權力，奠定法治（rule of law）基礎。
```

### 2.2 國會選舉（4 題）

題目：Exam 3 Q12、4 Q4、6 Q16、7 Q14

```
記憶法（國會選舉）：
• 選區（constituency）→ 650 個 = 下議院 MP 數目，每區選 1 位；
• 大選（general election）→ 5 年一次；
• 補選（by-election）→ MP 中途去世或者辭職。
```

（用戶原文寫「5 年 一次」，多咗個空格，已統一做「5 年一次」）

### 2.3 戴卓爾夫人（3 題）

題目：Exam 1 Q9、11 Q8、17 Q5

```
記憶法（Margaret Thatcher，戴卓爾夫人）：
• 1979–1990 → 任期 11 年；
• 第一 → 英國第一位女首相；
• 最長 → 20 世紀任期最長嘅首相。
```

### 2.4 陪審員（3 題）

題目：Exam 1 Q14、1 Q15、5 Q6

```
記憶法（陪審員 juror）：
• 年齡 → 18 至 70 歲；
• 來源 → 選民登記冊（electoral register）；
• 方式 → 隨機抽選。
```

（年齡跟官方手冊 18–70；用戶未要求加「考試答 70」，唔好自己加）

---

## 3. 驗證

```js
// node：用 note 原文分組，確認每組題號同數量（改之前同改之後各跑一次）
const fs = require('fs');
const EXAMS = new Function(fs.readFileSync('data/exams.js', 'utf8') + ';return EXAMS;')();
const groups = new Map();
for (const [ex, qs] of Object.entries(EXAMS)) qs.forEach((q, i) => {
  if (!(q.note || '').includes('記憶法')) return;
  if (!groups.has(q.note)) groups.set(q.note, []);
  groups.get(q.note).push(`E${ex}Q${i + 1}`);
});
for (const [n, ks] of groups) console.log(ks.length, ks.join(','), '|', n.split('\n')[0]);
```

- 改之後：4 組新 note 各自題數 8 / 4 / 3 / 3，題號同 §2 一致；記憶法組總數仍然係 18 個唔同 note
- `node tests/content-guard-test.js` → `CONTENT-GUARD PASS`（note 只比形狀）
- 如果有 `playwright-core`：`tests/run-all.sh`（`study-test` B3 會將 Study 卡記憶法逐行同 note 比較，data 改咗都應該 pass）
- 冇測試 hardcode 呢 4 組舊文字（已 grep `tests/`）

---

## 4. 唔做 / 留意

- **唔好郁**：都鐸王朝、三層屬地（第 1–2 組，未確認）；table 第一批嗰 10 組（另一份 handoff `.proj-docs/plans/2026-10-09_handoff_note-table.md`）
- `APP_VERSION`：之前 note-only commit 冇 bump；如用戶要已安裝 PWA 即時攞到，另外問
- 完成後喺 `HANDOFF.md`「Follow-up 候選」加 / 剔一項；commit 用 `fix: …`，PR description 加 `Design Origin: mockup:mockups/note-text-cleanup.html`
