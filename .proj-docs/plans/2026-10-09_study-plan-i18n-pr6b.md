# 溫習計劃 i18n key 對照（PR6b 新增，8 個）

> 由 PR6b developer 整理，留俾 PR7（G35）中英對照用。全部喺 `plan.run.*`（讀知識點 / 重溫答錯題目的知識點 / 模擬考結果）。
> 其他重用嘅現有 key：`home.modeStudy`（讀知識點 badge「溫習」）、`common.practice` / `common.exam`（badge）、`common.chapterN` / `common.examN`（標題）、`common.factSet`（知識點練習 session 標題「Fact Ch c #n」，經 `setExamLabel`）、`common.randomExam`（「隨機試卷」）、`similar.practise`（卡 / panel 嘅「▶ 練習這 n 題」，n = 呢條知識點今日仲要答嘅題數）、`similar.*`（panel 全部字）、`quiz.finishButton`（「完成 ✓」）、`plan.run.reviewNote`、`plan.run.backToList`、`plan.task.mockPassed`（模擬考完成卡小結）、`plan.task.*`（頂部任務名）。
> Mockup 原文（口語）已改書面語：「練習這 n 題 →」保留、「上一條 / 下一條」保留、「未合格（需要 18 / 24），可以再考 Random Exam」→「未合格（合格需 18 / 24 分），可即日再考隨機試卷。」（Random Exam 跟現有 zh-HK `common.randomExam`「隨機試卷」）。

| Key | zh-HK | en |
|---|---|---|
| `plan.run.factOf` | 第 {n} 條（共 {total} 條） | Fact {n} of {total} |
| `plan.run.practiseN` | 練習這 {n} 題 → | one: Practise this one → / other: Practise these {n} → |
| `plan.run.wrongFactsLabel` | 錯題知識點 | Wrong-answer facts |
| `plan.run.mockPassNote` | ✓ 模擬考試任務完成 | ✓ Mock exam task done |
| `plan.run.mockFailNote` | 未合格（合格需 {pass} / {n} 分），可即日再考隨機試卷。 | Not passed (pass mark {pass} / {n}): retake as a Random Exam today. |
| `plan.run.mockRetake` | 再考{exam} | Retake: {exam} |
| `plan.run.prevFact` | ← 上一條 | ← Prev |
| `plan.run.nextFact` | 下一條 → | Next → |

- `{exam}` = `common.randomExam`（zh-HK「隨機試卷」→「再考隨機試卷」；en「Retake: Random Exam」）。
- `{pass}` = `PASS_MARK`（18）、`{n}` = `REAL_TEST_SIZE`（24）。
