# 溫習計劃 PR7c：閱讀任務顯示已完成知識點（G41）

Design Origin: proposal: user-approved preview 2026-10-10 (scratchpad last/12-mid-done.png, 14-last.png)

## 問題（用戶 2026-10-10）

計劃 runner 閱讀任務去到最後一條知識點，主掣變「練習這 N 題 →」（配對練習任務仲未答啱嘅題）。用戶大部分知識點已完成（G3 / G37：知識點所有題目今日答啱或 🏆 先算已完成），但畫面冇講邊條完成咗、仲差幾多，以為閱讀跳咗知識點。

## Design Proposal

用戶 2026-10-10 睇過 preview 批准（scratchpad `last/12-mid-done.png`：中間一條已完成知識點嘅綠 tag；`last/14-last.png`：最後一條 tag + 橙色提示 + 主掣）。以下「決定」就係批准嘅設計。

## 決定（G41）

1. 已完成嘅知識點卡：「出現於」行右邊出綠色「✓ 已完成練習」/「✓ Practice done」（`planFactDone` + 任務嘅 mastered set，同任務完成度一致；位置 = 未完成時「▶ 練習這 N 題」嗰個位，已完成本身冇呢個掣）。
2. 只喺最後一條知識點、任務仲有未完成知識點時，nav row 上面出橙色「尚有 {n} 條知識點未完成練習，共 {q} 題」/「{n} facts still need practice · {q} questions」；q 同主掣 N 用同一個 helper（`planFactLastLeft`）。
3. 主掣不變；重溫模式冇提示；Study 模式卡不變；錯題知識點任務不變。
4. 未升版（`STUDY_PLAN_READY=false`，中間 plan PR 唔升 `APP_VERSION`）。

## 檔案

| 檔案 | 改動 |
|---|---|
| `js/components/factCard.js` | `opts.doneTag`（label 由 caller 傳入，保持 generic）→ `factDoneTagHtml`，排喺來源行最尾 |
| `js/screens/planRun.js` | `planFactCardHtml` 閱讀卡傳 `doneTag`；`planFactLastLeft`（主掣 N）、`planFactLeftNoteHtml`（最後一條提示） |
| `css/components/fact.css` | `.fact-done-tag`：success 色（`--success-bg` / `--green`，同 `.sqm-node.mastered`）、pill、nowrap、`margin-left: auto` |
| `css/screens/plan.css` | `.plan-note.carry`：補做橙（`--flag-bg` / `--plan-orange-text`，同 `.plan-tag.carry`），13px；W-048：runner 入面已掌握（🏆 / 手動剔）卡唔再成張褪色，改為除 tag 外嘅部分褪色（Study 不變） |
| `css/base/tokens.css` | `--fact-mastered-opacity: 0.55`（Study 卡同 runner 共用） |
| `locales/en.js`、`locales/zh-HK.js` | `plan.run.factDoneTag`、`plan.run.lastUndoneNote`（en 按 n 複數）、`plan.run.lastUndoneQs`（en「1 question」/「n questions」，zh「{n} 題」） |
| `tests/plan-read-done-test.js`、`tests/run-all.sh` | 新 suite |

## 測試

`tests/plan-read-done-test.js`：tag 有 / 冇（今日答啱、🏆、未完成）、tag 喺來源行最尾；提示只喺最後一條、n 正確、q = 主掣 N、喺 nav row 正上面、en 單數 / 複數、zh-HK 文字；全部完成（重溫 / 非重溫）冇提示；Study 模式冇 tag；320px 知識點 98（合併 node）en / zh-HK tag 一行、喺卡內、唔撞 node、冇橫向 scroll；錯題知識點任務最後一條冇提示、冇 tag（S-155）；提示同 tag 文字對比 ≥ 4.5:1（W-048：按實際合成顏色計，即係連所有 ancestor 嘅背景同 opacity 一齊計；🏆 同手動剔已掌握卡上嘅 tag 都計，Study 已掌握卡照舊成張褪色）。
