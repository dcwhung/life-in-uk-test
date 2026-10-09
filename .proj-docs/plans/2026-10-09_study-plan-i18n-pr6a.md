# 溫習計劃 i18n key 對照（PR6a 新增，22 個）

> 由 PR6a developer 整理，留俾 PR7（G35）中英對照用。全部喺 `plan.run.*`（runner：練題目 / 清錯題 / 重溫模式 / 任務完成卡）。
> 其他重用嘅現有 key：`common.chapterN`（runner 標題「Chapter n」）、`common.wrongSet`（清錯題標題「錯題」）、`common.practice`（模式 badge）、`quiz.finishButton`（「完成 ✓」）、`quiz.nextButton`（重溫下一頁）、`plan.dayN`、`plan.task.*`（下一項卡）、`plan.home.continue`（主頁「繼續今日任務 →」而家直接開 runner）。
> Mockup 原文（口語）已改書面語，例如「呢項已完成 · 而家係重溫，唔會改變完成度」→「此項已完成 · 現在是重溫，不會改變完成度」、「重做答錯嘅題目」→「重做答錯的題目」、「你答錯過」保留、「聽日」→「明天」、「答啱」→「答對」。

| Key | zh-HK | en |
|---|---|---|
| `plan.run.backToday` | ← 今日任務 | ← Today's tasks |
| `plan.run.backDayHtml` | ← {day} 任務 | ← {day} tasks |
| `plan.run.roundOf` | 第 {n} 輪（共 {rounds} 輪） | Round {n} of {rounds} |
| `plan.run.nextRound` | 下一輪 → | Next round → |
| `plan.run.retryWrong` | 🔁 重做答錯的題目（尚餘 {n} 題） | one: 🔁 Redo the wrong answer ({n} left) / other: 🔁 Redo wrong answers ({n} left) |
| `plan.run.pairNote` | 練習完這段題目後，對應的知識點會自動計為已溫習。 | Once these questions are right, the matching facts count as read. |
| `plan.run.reviewNote` | ✅ 此項已完成 · 現在是重溫，不會改變完成度。 | ✅ This task is done · reviewing it does not change your progress. |
| `plan.run.reviewCorrect` | ✓ 正確答案 | ✓ Correct answer |
| `plan.run.reviewWasWrong` | ✗ 你答錯過 · 正確答案 | ✗ You got this wrong · correct answer |
| `plan.run.doneToday` | 此項已完成 · 今日完成度 | Task done · today's progress |
| `plan.run.doneDay` | 此項已完成 · 當日完成度 | Task done · that day's progress |
| `plan.run.allDoneToday` | 今日任務全部完成！ | All of today's tasks are done! |
| `plan.run.allDoneDayHtml` | {day} 任務全部完成！ | All {day} tasks are done! |
| `plan.run.allSubToday` | 明天打開 app，主頁會顯示新一日的任務。 | Open the app tomorrow: Home shows the next day's tasks. |
| `plan.run.allSubDay` | 進度表及完成度月曆已經更新。 | The schedule and the completion calendar are up to date. |
| `plan.run.sumFirst` | {n} 題全部一次答對。 | one: {n} question, right first time. / other: All {n} questions right first time. |
| `plan.run.sumRedone` | {n} 題全部答對，其中 {k} 題答錯過、已重做答對。 | one: {n} question right, after a redo. / other: All {n} questions right, {k} of them after a redo. |
| `plan.run.donePairHtml` | 對應的「{task}」已自動計為已溫習。 | The matching “{task}” now counts as read. |
| `plan.run.next` | 下一項 | Next |
| `plan.run.reviewThis` | 重溫此項內容 | Review this task |
| `plan.run.startNext` | 開始下一項 → | Start next → |
| `plan.run.backToList` | 返回任務列表 | Back to the task list |
