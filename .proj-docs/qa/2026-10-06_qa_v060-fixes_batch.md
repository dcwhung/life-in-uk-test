# Batch QA — 2026-10-06 — v0.60 fixes

- 測試員：QA Agent
- 範圍：`ed80bf3`（v0.59）..`5610ab0`（v0.60 + review 跟進 W-008 / S-021 / S-024），branch `claude/intelligent-lovelace-zczz0o`
- 環境：Chromium `/opt/pw-browsers/chromium`，playwright-core（`NODE_PATH=/opt/node-tools/node_modules`），python `http.server`（`tests/pages-server.js`，GitHub Pages 式 `max-age=600`）
- Review：`.proj-docs/reviews/2026-10-06_review_v060-fixes_batch.md`（97 分 pass）

## 整體 verdict

| Fix | Ticket / commit | 結果 |
|-----|-----------------|------|
| A. Install banner：只限觸控 + ✕ | `059b5cd`、`5829350`、`5610ab0`（S-021） | ✅ pass |
| B. Inverse text token 合併（6 → 3） | `399d665`、`5610ab0`（W-008） | ✅ pass |
| C. CUI-0007 Similar 掣單數 | `35bdbc3` | ✅ pass |
| D. 破壞性 modal 預設 focus 取消掣 | `4743e68` | ✅ pass |

- Regression：`./tests/run-all.sh` **26/26 PASS**
- QA 補測：`.proj-docs/qa/scripts/2026-10-06_qa-v060.js` **67 ok / 0 fail**；`tests/tools/visual-diff.js ed80bf3` 16 個差異（76 個 state），全部預期
- Edge case gap：A 0、B 0、C 0、D 0（v0.60 改動範圍內）；範圍外既有問題 1 個 → CUI-0008（🟢 Low）
- **Status：✅ pass**

## Hard Gates

| Gate | 結果 | 依據 |
|------|------|------|
| Tests | ✅ pass | run-all 26/26；QA script 67/67 |
| Coverage | n/a | 項目係 vanilla JS，冇 coverage instrumentation。功能覆蓋：每個改動函數（`shouldShowInstallBanner`、`dismissInstallBanner`、`showConfirm({focusCancel})`、`t()` plural `similar.practise`）同每條改咗嘅 CSS rule 都有 test 撞到 |
| Security | ✅ pass | 冇新輸入路徑；✕ 只寫一個 boolean；i18n 字串冇 HTML 注入面 |
| Data integrity | ✅ pass | Reset / Leave 用 Enter、Space、Escape 都唔會清資料；Reset 撳 OK 仍然清；`installDismissed` 損壞值唔 throw |
| Performance | n/a | 冇改動影響載入或運算（加 1 個 matchMedia call） |
| No Critical | ✅ pass | 🔴 0 |

## 測試覆蓋概覽

| 類型 | 數量 | 結果 |
|------|------|------|
| 現有 suite（run-all.sh） | 26 | 26 pass |
| QA 新 E2E 斷言（Playwright） | 67 | 67 pass |
| Computed-style 視覺比較（38 state × 2 寬度） | 76 states | 16 個預期差異，0 個意外差異 |
| v0.59 worktree 對比（banner / header token） | 9 個 selector | 4 個預期差異，0 個意外差異 |
| SW / 升級 | sw-test、upgrade-test | pass（`lifeuk-v0.60`） |

---

## Section A — Install banner（觸控先出 + ✕）

**Verdict：✅ pass**

用真正 device emulation 驗證（`isMobile: true, hasTouch: true` → `(pointer: coarse)` 為 true；desktop context → false），**冇** override `matchMedia`，所以同 `pwa-test`（用 override）係獨立嘅第二條路徑。

| Scenario | 結果 |
|----------|------|
| Desktop（1280×900，fine pointer）發假 `beforeinstallprompt` | ✅ `preventDefault` 有做，banner 唔出 |
| Desktop：`deferredPrompt` 照留，`promptInstall()` 仍然 call 到 `prompt()` | ✅ |
| Mobile（390×844 Pixel 8 emulation）發 event | ✅ banner 出 |
| ✕：aria-label / title = "Dismiss"，28×28，顏色 `rgba(255,255,255,0.6)` | ✅ |
| ✕ keyboard Enter → 收起，`localStorage['lifeuk.installDismissed'] === 'true'` | ✅ |
| ✕ touch tap → 一樣寫 flag | ✅ |
| Reload 再發 event → 唔出（`preventDefault` 照做） | ✅ |
| 清 flag → 再出 | ✅ |
| Install 掣 → `prompt()`，accepted → banner 收起；冇寫 dismiss flag | ✅ |
| localStorage method throw（getItem / setItem / removeItem） → banner 出、✕ 收到、冇 page error | ✅ |
| `window.localStorage` getter throw（封鎖全部 site data） → 同上 | ✅ |

**QA 補 edge case（新）**
1. 損壞 flag 值：`false` → 出；`garbage{` → 出（`getLS` catch → null）；`"yes"` → 唔出（truthy JSON）；`0` → 出。全部冇 throw。行為合理。
2. Keyboard 操作 ✕（focus + Enter）。
3. `localStorage` getter 本身 throw（比 review 講嘅 method throw 更嚴）。
4. Accepted 唔會誤寫 `installDismissed`。

**觀察（唔係 v0.60 引入）**
- Native 對話框 `dismissed` → banner 留低、Install 變死掣（`{"visible":true,"v":null}`）= review S-020。
- 同一個 event 撳兩下 Install → `prompt()` call 兩次（`deferredPrompt` 要 await 完先清）；真 Chrome 第二次會 reject `InvalidStateError` → unhandled rejection。Review 冇提。
- 兩樣合併開 **CUI-0008**（🟢 Low，v0.59 已存在，唔 block release）。
- ✕ `type` 係預設 `submit`；佢唔喺 `<form>` 入面，冇影響。✕ 28px 觸控目標 = review S-022，唔重複開 ticket。

**Baseline screenshot（✕ 係 proposal，以下係 final）**
- `.proj-docs/qa/screenshots/2026-10-06_v060_mobile-install-banner.png`（390×844 @2x，整頁）
- `.proj-docs/qa/screenshots/2026-10-06_v060_mobile-install-banner-crop.png`（只截 banner：標題、副行 0.6、Install、✕）
- `.proj-docs/qa/screenshots/2026-10-06_v060_desktop-home.png`（1280×900，發完 event 都冇 banner）

## Section B — Inverse text token 合併

**Verdict：✅ pass，只有預期差異**

`tests/tools/visual-diff.js ed80bf3`（工具自己用 `git archive` 砌 v0.59，對比 working tree，38 個 state × 390 / 900px，每個元素嘅 computed style / box / text）：**16 個差異 = 8 種 × 2 寬度**

| 差異 | 預期？ |
|------|--------|
| `.flag-start .fs-sub` 0.7 → 0.75（flaggedList） | ✅ 預期 |
| `.exam-btn .exam-sub` 0.65 → 0.6（homeExam、homeExamDone） | ✅ 預期 |
| `.exam-btn.all .exam-mastery.zero` 0.55 → 0.6（homePracticeExam；W-008 修咗之後係 0.6 唔係 0.45） | ✅ 預期 |
| `#similarBox` 掣字 "Practise these 1" → "Practise this one"（practiceRight） | ✅ 屬 Fix C |
| `#confirmCancel` / `#confirmOk` 嘅 focus outline 對調（leaveModal） | ✅ 屬 Fix D |

Install banner 預設 `display:none`，visual-diff 嘅 state 冇一個顯示佢，所以另外用 `git worktree add`（`ed80bf3`，放 scratchpad，用完 `git worktree remove`）serve v0.59，強制 banner visible + 開 info popover 比較：

| Selector | v0.59 | v0.60 | |
|----------|-------|-------|--|
| `.install-text span` | 0.65 | 0.6 | ✅ 預期 |
| `.install-close` | 冇 | 0.6，28×28 | ✅ 預期（新 ✕） |
| `.install-text strong` / `span` 闊度 | 238 / 209px | 196 / 164px | ✅ 預期：✕ 佔咗位，文字欄窄咗；banner 本身 358×91 冇變 |
| `.install-btn`、`.app-version`（0.45）、`.info-btn`（0.6）、`.info-pop p`（0.75）、`.logo-text` | — | 一樣 | ✅ 0 差異 |

**額外差異：冇。** `css/ js/ index.html` 已經冇 `--text-inverse-NN`（structure-test 守住）。
附註：`.claude/worktrees/agent-a44618cb2760ae08c/`（Lane B 嘅 developer worktree，停喺 `4743e68`）仲有舊 token，佢係 git worktree 唔係 tracked file，唔影響 build；main agent 收尾時應該 `git worktree remove` 兩條 agent worktree。

## Section C — CUI-0007 Similar 掣單數

**Verdict：✅ pass**

掃晒 17 份 exam：138 題得 1 題 similar，146 題有多過 1 題。

| Scenario | 結果 |
|----------|------|
| E1·Q3（1 題 similar）答完 → 掣 "▶ Practise this one" | ✅ |
| 撳 → 臨時 session（`examNum='similar'`、1 題、current 0），session 入面唔顯示 Similar | ✅ |
| 答完最後一題 → "↩ Back" 出現，撳 → 還原 exam 1、current 19、answers 一樣 | ✅ |
| 返嚟之後 Similar 面板再出 | ✅ |
| E1·Q20（3 題）→ "▶ Practise these 3"，臨時 session 3 題，↩ Back 還原 | ✅ |

**QA 補 edge case**：`t('similar.practise')` n = 0 → "these 0"、2 → "these 2"、5 → "these 5"、冇 n → "these {n}"（同其他 plural key 一致嘅 fallback，冇 `[object Object]` / `undefined`）。實際 UI 唔會出 0（冇 similar 就唔顯示面板）。
Screenshot：`.proj-docs/qa/screenshots/2026-10-06_v060_similar-one-cta.png`

## Section D — 破壞性 modal 預設 focus

**Verdict：✅ pass**

| Modal | 開咗之後 `document.activeElement` | 按鍵 | 結果 |
|-------|-------------------------------|------|------|
| Reset practice progress | `#confirmCancel` "Keep" | Enter | ✅ 關閉，streak / wrongList / completed 原封不動 |
| Reset practice progress | Keep | Space | ✅ 同上 |
| Reset practice progress | Keep | Escape | ✅ 同上 |
| Reset completed exams | Keep | Enter / Space | ✅ 關閉，資料唔郁 |
| Reset practice progress | — | 滑鼠撳 Reset | ✅ 照清（`{}`），completed 唔郁 |
| Leave the exam | `#confirmCancel` "Stay" | Enter | ✅ 留喺考試，`isExamRunning()`，答案仲喺度 |
| Leave the exam | Stay → Tab | — | ✅ focus 去 Leave（刻意離開仍然撳得到） |
| Submit | `#confirmOk` "Submit" | Enter | ✅ 交卷，去 result screen |

**QA 補 edge case**：Space / Escape 路徑；Reset 開兩次 focus 仍然喺 Keep；開完 Reset modal 之後開 Submit，focus 返去 Submit（`focusCancel` 冇殘留）。
Screenshot：`.proj-docs/qa/screenshots/2026-10-06_v060_reset-modal-focus.png`、`2026-10-06_v060_leave-modal-focus.png`
既有限制（review S-025）：冇 focus trap、關閉後冇還原 focus；唔重複開 ticket。

## 升級路徑

- `js/core/config.js` `APP_VERSION = '0.60'` ✅
- `sw-test`：「cache named from APP_VERSION (lifeuk-v0.60)」、45 個 SHELL entry 全部 cache、offline OK、bump 版本會刪 `lifeuk-v0.60` ✅
- `upgrade-test`：v0.57 shell + v0.60 js 混合 OK；「v0.60 SW activated, v0.57 cache deleted」✅
- v0.60 冇新 file，SHELL 唔使改；新 localStorage key `lifeuk.installDismissed` 唔需要遷移（冇 = 未撳過 ✕）

## 跨 fix 互動評估

- A + B 都改 `css/components/popover.css`：✕ 用 `--text-inverse-muted`（新 token），副行一樣用 muted，兩者都係 0.6 ✅；冇引用已刪 token。
- A + D 都郁 `index.html` / `actions.js`：`dismissInstall` 同 `confirmAccept` / `closeConfirm` 冇名衝突；Escape handler（`actions.js`）只關 modal / info，唔會收 banner，合理。
- C + D 都改 `locales/en.js` 唔同 key，冇衝突；i18n-test pass。
- 新常數 `INSTALL_TOUCH_QUERY`、`INSTALL_DISMISSED_LS` 冇撞名。
- 全部 26 個 suite 一次過綠，冇跨 fix regression。

## Regression 結論

`./tests/run-all.sh` 26/26 PASS（約 74 秒）。之後 `git ls-files -m 'tests/*.png' | xargs -r git checkout --` 還原咗 17 張 screenshot，刪咗未追蹤嘅 `tests/shot-similar.png`。之後單獨再跑 `sw-test` / `upgrade-test` 都 PASS。

## 問題修正優先順序

| # | Ticket | 優先級 | 描述 | 負責人 | Block release？ |
|---|--------|--------|------|--------|-----------------|
| 1 | CUI-0008 | 🟢 Low | `promptInstall()`：`dismissed` 之後 Install 變死掣（= S-020）+ 撳兩下會 call `prompt()` 兩次 | Frontend Developer | 否（v0.59 已存在） |

Ticket：`.tickets/pending/0001-0200/CUI-0008.md`

## 測試建議（下一步）

1. 修 CUI-0008 時，`pwa-test` 加：`dismissed` outcome 收 banner、雙擊只 call 一次 `prompt()`。
2. 考慮將 QA script 入面嘅真 device emulation（`isMobile` / `hasTouch`，唔 override `matchMedia`）同損壞 flag 斷言搬入 `pwa-test`，咁就唔只靠 stub。
3. `visual-diff.js` 加一個 install banner visible 嘅 state（例如 `installBanner: "byId('installBanner').classList.add('visible')"`），下次改 token 就唔使另外開 worktree。
4. Modal：S-025（focus trap / 還原 focus）值得排期，所有 confirm 都受惠。

## Handoff receipt

```handoff-receipt
protocol: 2
status: pass
score: n/a
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
next_action: merge_main
next_agent: devops-engineer
branch: "claude/intelligent-lovelace-zczz0o"
context: "v0.60 batch QA pass: install banner touch-only + dismiss, token merge (only expected 0.7->0.75 / 0.65->0.6 / 0.55->0.6 diffs), CUI-0007 singular label, safe-button modal focus; run-all 26/26, QA script 67/67, SW cache lifeuk-v0.60; pre-existing Low CUI-0008 (promptInstall dead button / double prompt) logged, non-blocking"
```
