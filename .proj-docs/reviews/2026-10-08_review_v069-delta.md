# Code Review — v0.69 Delta（S-095 / W-024 / S-096）

- 日期：2026-10-08
- 審閱者：Code Reviewer（independent）
- 目標：`git diff 1ada9d2..ba33f7f`（branch `claude/modest-keller-8m154v` @ `ba33f7f`）
- 基準：`.proj-docs/reviews/2026-10-08_review_v069.md`（97 pass）
- Design Origin：`none-required` — 只改 behaviour（`js/screens/result.js` 2 行），冇 markup / CSS / className 改動，配對正確

## Delta review

### 涵蓋 commit

| Commit | Item | 改動 |
|--------|------|------|
| 079fdc8 | S-095 | `tests/examtools-test.js` +5：Submit modal 開住時 `goHome()` → Leave modal → Esc → focus 返 `#nextBtn` |
| 4922d62 | W-024 | `finishExam()` 喺 `stopExamTimer()` 後加 `if (isConfirmOpen()) closeConfirm();`；test +7 |
| ba33f7f | S-096 | HANDOFF L344 / examtools 表格行；commit 上次 review 報告 |

### Hard Gates

| Gate | 結果 | 備注 |
|------|------|------|
| Lint | n/a | 項目冇 eslint；`structure-test` PASS |
| Type check | n/a | Plain JS |
| Tests | pass | worktree @ `ba33f7f`，`./tests/run-all.sh` 31/31 PASS；`examtools-test` 再跑 3 次全綠 |
| Coverage | pass | 兩個 fix 都有 red-before-green test（見 mutation） |
| No Critical | pass | 0 |
| Security scan | n/a | 冇新依賴 |

Mutation（只喺 worktree 做，跑完 revert）：
- 刪 `finishExam()` 嘅 guard → `FAIL: W-024: time up closes the open modal on the way to results`
- `showConfirm()` 去咗 `if (!isConfirmOpen())` → `FAIL: S-095: closing it returns focus to the first opener (Submit)`

### 指定檢查項

1. **`finishExam` 所有 caller**
   - `examTick()`（time up）：呢次修正嘅目標。
   - `confirmAccept()` → Submit OK：先 `closeConfirm()` 再 `run()`，guard 讀到 `false`，係 no-op；唔會 close 兩次，focus 唔會還原兩次（`confirmReturnFocus` 已經清咗做 `null`）。
   - `submitExam()` 直接 call（冇未答 / flag）：modal 開住時 backdrop 蓋住 `#nextBtn`，Tab 又鎖喺 modal 入面，所以正常情況到唔到呢度；就算到得到，guard 都係安全嘅。
   - `nextAction()` Practice「Finish ✓」：Practice 唔會開 Leave（`isExamRunning` 要 `EXAM_MODE`），冇計時器；guard no-op。
   - 結論：冇 double close，冇 focus 副作用。
2. **`closeConfirm` 喺 `showScreen('screenResult')` 之前將 focus 還原去 quiz 掣**：同 Submit OK 原本嘅路徑（`confirmAccept` → `closeConfirm` → `finishExam`）完全一樣。之後 `screenQuiz` 收埋，focus 落返 `body`，同 S-096 寫入 HANDOFF 嘅描述一致。`focus()` 可能令頁面捲動，但後面有 `window.scrollTo(0, 0)` 蓋過。結論：harmless，唔係 regression。
3. **Time up 時開住 Leave modal**：之前結果頁會被 Leave modal 蓋住，撳 Leave 會喺結果已經記錄之後先返 Home；撳 Stay 就停喺結果頁。依家直接丟咗個 prompt。用戶從來冇確認過 Leave，而 time up 依規則係自動交卷，所以丟咗佢係啱嘅。我喺 worktree 加咗一個臨時 probe（之後 revert）：`goHome()` → Leave modal → `examTick()` 過咗 deadline → `screenResult` active、modal 關咗、有 time-up note；之後一下 stray Enter 都唔會返 Home。全部 `ok`。
4. **首頁兩個 Reset modal 喺考試中唔會開到**：`examTimerId` 只會由 `renderQuestion` → `startExamTimer()` 喺 `screenQuiz` 開始。所有離開 quiz 嘅路徑都會先停計時器：`leaveToHome`、`startSideSession`、`finishExam`。Reset 掣只喺 `screenHome`，所以計時器開住時唔會有 Reset modal。就算有，guard 都只係取消佢，唔會執行 `onOk`。確認冇問題。
5. **Function length**：`finishExam()` 由 15 行變 17 行，仍然 ≤ 30。
6. **Test 穩定性（timing）**：W-024 case 用 `examDeadline = Date.now() - 1; examTick();` 同步觸發，唔使等真正嘅 interval；45 分鐘 deadline 唔會喺 click 同 evaluate 之間 tick 到 0。S-095 用 `pg.evaluate(() => goHome())`，冇 race。連跑 3 次全綠。

### 發現

#### 🟢 S-098 — Leave modal 開住時 time up 冇 regression test
- 位置：`tests/examtools-test.js`（W-024 block 之後）
- 描述：W-024 嘅 commit message 同 HANDOFF 都寫明「Submit / Leave」，但 test 只覆蓋 Submit modal。Leave modal 個 case 嘅 `onOk = leaveToHome` 係破壞性，行為又唔同（之前會由結果頁彈返 Home）。
- 影響：好低。guard 本身係通用嘅（`isConfirmOpen()`），probe 亦證實行為啱，只係將來有人改成例如「只關 Submit」時冇 test 守住。
- 方案 A：加 3 行：`startExam(4); renderQuestion(); goHome();`，跟住 `examTick()` 過 deadline，assert 結果頁 active、冇 modal、有 time-up note（我嘅 probe 已經驗證過可以咁寫）。Trade-off：examtools-test 多一個 `startExam`，大約多 100ms。
- 方案 B：唔加，喺 HANDOFF 註明 Leave 同 Submit 行同一條 generic guard。Trade-off：零成本，但冇自動保護。
- 推薦：A（或者標 won't-fix 都可以接受）。

冇 🔴 Critical，冇 🟡 Warning。

### 評分結果

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 25 | 25 | 所有 caller 已驗；Leave 個 case probe ok |
| 安全性 | 20 | 20 | |
| 可維護性 | 20 | 20 | 1 行 guard，有 W-024 註釋 |
| 測試覆蓋 | 14 | 15 | S-098 |
| 性能 | 10 | 10 | |
| 代碼風格 | 10 | 10 | |
| **總分** | **99** | **100** | |

**結果：✅ pass**

### ✅ 做得好嘅地方
- 修正放喺 `finishExam()` 呢個唯一入口，而唔係放喺 `examTick()`：日後再有自動交卷嘅路徑都會受保護。
- 兩個 fix 都有 red-before-green test，mutation 亦證實佢哋有咬到。
- S-096 嘅 HANDOFF 文字準確寫出「OK 之後轉 screen，focus 落返 `body`」，同實際行為一致。

### 修正優先順序

| ID | 優先 | 備注 |
|----|------|------|
| S-098 | 低 | 可以喺 release 前一齊做，或者標 won't-fix |

### 修訂後代碼
冇必須嘅代碼改動。S-098 方案 A 建議加入嘅 test（放喺 `"W-024: results keep the time-up note"` 之後）：

```js
  // S-098: time up while the leave modal is open drops it too (Leave's onOk would have gone home)
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(4); renderQuestion(); goHome(); });
  assert(await modalOpen() && /Leave the exam\?/.test(await modalText()), 'S-098: leave modal open before time up');
  await pg.evaluate(() => { examDeadline = Date.now() - 1; examTick(); });
  assert(await active('screenResult') && !(await modalOpen()) && await vis('#resultTimeUp'), 'S-098: time up drops the leave modal');
```

### Handoff receipt

```
HANDOFF_RECEIPT
agent: code-reviewer
scope: v0.69 delta (079fdc8 S-095, 4922d62 W-024, ba33f7f S-096)
status: pass
score: 99
hard_gates: { lint: n/a, type: n/a, tests: pass (31/31 @ ba33f7f), coverage: pass, no_critical: pass, security: n/a }
findings: { critical: 0, warning: 0, suggestion: 1 (S-098) }
next_action: proceed
notes: S-098 optional (add test, or mark won't-fix); S-097 is still deferred to release
report: .proj-docs/reviews/2026-10-08_review_v069-delta.md (untracked)
```
