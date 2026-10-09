# 溫習計劃 i18n key 對照（PR5 新增，90 個）

> 由 PR5 developer 整理，留俾 PR7（G35）中英對照用。PR3 / PR4 嘅 key 見各自 review / PR description。

90
| `plan.home.pctLabel` | 今日完成度 | Today's progress |
| `plan.home.nextHtml` | 下一步：<b>{task}</b>{more} | Next: <b>{task}</b>{more} |
| `plan.home.nextCarryHtml` | 下一步（補做 {day}）：<b>{task}</b>{more} | Next (catch-up, {day}): <b>{task}</b>{more} |
| `plan.home.resumeFact` | （由 #{n} 繼續） |  (continue from #{n}) |
| `plan.home.resumeQs` | （已答對 {done} / {total} 題） |  ({done} / {total} right) |
| `plan.home.doneHtml` | <b>✓ 今日完成</b>，明天再來 | <b>✓ Done for today</b>, see you tomorrow |
| `plan.home.continue` | 繼續今日任務 → | Continue today's tasks → |
| `plan.home.viewToday` | 查看今日任務 | View today's tasks |
| `plan.home.viewDay` | 查看今日 | View today |
| `plan.home.restToday` | 今日是休息日 | Rest day today |
| `plan.home.notStarted` | 計劃由 {date} 開始 | The plan starts on {date} |
| `plan.home.examDayText` | 🎯 今日考試，加油！ | 🎯 It's exam day today, good luck! |
| `plan.home.endedTitle` | 計劃已完結 | Plan finished |
| `plan.home.endedSummary` | 平均完成度 {avg}% · 知識點 {facts} / {factsTotal} 條 · 題目 {qs} / {qsTotal} 題 · 模擬考試達 {safe}/{n} 或以上 {mocks} 次 | Average {avg}% · {facts} / {factsTotal} facts · {qs} / {qsTotal} questions · {mocks} mocks at {safe}/{n} or more |
| `plan.home.newPlan` | 建立新計劃 | New plan |
| `plan.home.logBroken` | 無法讀取進度記錄，可在進度表按「↺ 重設計劃」清除。 | Your progress record can't be read. ↺ Reset plan on the schedule clears it. |
| `plan.day.today` | 今日任務 | Today's tasks |
| `plan.day.dayTasksHtml` | {day} 任務 | {day} tasks |
| `plan.day.prev` | 前一日 | Previous day |
| `plan.day.next` | 後一日 | Next day |
| `plan.day.backToday` | ← 返回今日 | ← Back to today |
| `plan.day.ringToday` | 今日完成度 | Done today |
| `plan.day.ringDay` | 當日完成度 | Done that day |
| `plan.day.noPct` | – | – |
| `plan.day.pill` | {phase}階段 | {phase} phase |
| `plan.day.pillPast` | {phase}階段 · 已過 | {phase} phase · past |
| `plan.day.pillAhead` | {phase}階段 · 未到 | {phase} phase · ahead |
| `plan.day.count` | {done} / {total} 項完成 | {done} / {total} done |
| `plan.day.restCount` | 休息日，沒有任務 | Rest day: no tasks |
| `plan.day.hintToday` | 完成度由系統自動計算：在溫習及練習模式做過的都會計算。練習完一段知識點的題目後，該段知識點即計為已溫習。 | Completion is counted automatically from what you do in Study and Practice: once the questions of a set of facts are right, those facts count as read. |
| `plan.day.hintPast` | 已過的日子：未完成的項目可在此補做，完成度會即時更新。 | A day gone by: catch up on anything unfinished here, and its completion updates at once. |
| `plan.day.hintAhead` | 未到的日子：可預先查看內容。閱讀及練習可提早完成；清錯題及強化練習到當日才按錯題簿決定。 | A day ahead: see what is coming. Reading and practice can be done early; clearing wrong answers and drills are decided on the day. |
| `plan.day.doneToday` | 🎉 今日任務全部完成！ | 🎉 All done for today! |
| `plan.day.doneDay` | 🎉 這日的任務全部完成！ | 🎉 All done for this day! |
| `plan.day.carryAlert` | 之前有 {n} 項未完成的任務，已自動加入今日並標示原本日子；補做不計入今日完成度。 | one: {n} unfinished task from an earlier day was carried over to today, marked with its day. It doesn't count towards today's %. / other: {n} unfinished tasks from earlier days were carried over to today, marked with their day. They don't count towards today's %. |
| `plan.day.examAhead` | 🎯 考試日 | 🎯 Exam day |
| `plan.calendar.title` | 每日完成度 | Daily completion |
| `plan.calendar.month` | {year} 年 {month} 月 | {month} {year} |
| `plan.calendar.prev` | 上個月 | Previous month |
| `plan.calendar.next` | 下個月 | Next month |
| `plan.calendar.today` | 今日 | Today |
| `plan.calendar.streak` | 🔥 連續 {n} 日 100% | one: 🔥 {n} day in a row at 100% / other: 🔥 {n} days in a row at 100% |
| `plan.calendar.legendLow` | 0% | 0% |
| `plan.calendar.legendHigh` | 100% | 100% |
| `plan.calendar.examCell` | 🎯 考試日 | 🎯 Exam |
| `plan.calendar.ahead` | 未到 | ahead |
| `plan.calendar.cellLabel` | {day} · {date} · {status} | {day} · {date} · {status} |
| `plan.kpi.title` | 整體進度 | Overall progress |
| `plan.kpi.plan` | 計劃進度 | Plan progress |
| `plan.kpi.avg` | 平均完成度 | Average |
| `plan.kpi.avgSub` | 已過的溫習日 | study days gone by |
| `plan.kpi.left` | 距離考試 | To the exam |
| `plan.kpi.leftSub` | 包括休息日 | rest days included |
| `plan.kpi.facts` | 知識點已溫 | Facts read |
| `plan.kpi.qs` | 題目已練 | Questions practised |
| `plan.kpi.mocks` | 模擬考試 ≥ {safe}/{n} | Mocks ≥ {safe}/{n} |
| `plan.kpi.value` | {v} / {of} · {pct}% | {v} / {of} · {pct}% |
| `plan.goal.dateMoved` | 已踏入新的一日，考試日期已調整為最早可選的日子，請確認後再按一次。 | The day has changed, so the exam date moved to the earliest one allowed. Please check it and press again. |
| `plan.schedule.viewToday` | 查看今日任務 → | View today's tasks → |
| `plan.task.modePractice` | 練習 | Practice |
| `plan.task.modeReview` | 錯題 | Wrong answers |
| `plan.task.modeMock` | 模擬考試 | Mock exam |
| `plan.task.pending` | 到時按錯題簿決定 | Decided on the day from your wrong answers |
| `plan.task.noWrong` | ✓ 沒有錯題 | ✓ No wrong answers |
| `plan.task.readTodo` | {n} 條知識點 · 溫習 | one: {n} fact · Study / other: {n} facts · Study |
| `plan.task.readPart` | 已溫 {done} / {total} 條 · 由 #{n} 繼續 | Read {done} / {total} facts · continue from #{n} |
| `plan.task.readDone` | ✓ 已練習對應題目，自動計為已溫習 | ✓ Practised its questions: counted as read |
| `plan.task.qTodo` | {n} 題 · {mode} | one: {n} question · {mode} / other: {n} questions · {mode} |
| `plan.task.qPart` | ✓ 答對 {done} / {total} 題 | ✓ {done} / {total} right |
| `plan.task.qBad` | ✗ {n} | ✗ {n} |
| `plan.task.wrongTag` | {n} 題答錯，答對才計算 | {n} wrong: only right answers count |
| `plan.task.qDone` | ✓ 已完成 {n} 題 | one: ✓ {n} question done / other: ✓ {n} questions done |
| `plan.task.mockPassed` | ✓ 合格 · 最高 {best} / {n} 分 | ✓ Passed · best {best} / {n} |
| `plan.task.mockBest` | 最高 {best} / {n} 分 · 合格需 {pass} 分 | Best {best} / {n} · pass mark {pass} |
| `plan.task.goStart` | 開始 › | Start › |
| `plan.task.goContinue` | 繼續 › | Continue › |
| `plan.task.goReview` | ✓ 重溫 › | ✓ Review › |
| `plan.status.ahead` | › | › |
| `data.months.1` | 1 | January |
| `data.months.2` | 2 | February |
| `data.months.3` | 3 | March |
| `data.months.4` | 4 | April |
| `data.months.5` | 5 | May |
| `data.months.6` | 6 | June |
| `data.months.7` | 7 | July |
| `data.months.8` | 8 | August |
| `data.months.9` | 9 | September |
| `data.months.10` | 10 | October |
| `data.months.11` | 11 | November |
| `data.months.12` | 12 | December |
