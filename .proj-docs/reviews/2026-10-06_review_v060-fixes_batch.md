# Batch Review — 2026-10-06 — v0.60 fixes

- 審閱者：Code Reviewer（獨立 subagent）
- Repo / branch：`/home/user/life-in-uk-test` @ `claude/intelligent-lovelace-zczz0o`
- Range：`ed80bf3..HEAD`（059b5cd、399d665、35bdbc3、4743e68、270e0e0 / 08679b5 merge、5829350 chore）
- Design Origin：`baseline: v0.59`（token / focus / 文字）；✕ 掣 `proposal:`（用戶揀 A + C：PC 唔出 + 可 dismiss）
- Review Item ID 起點：之前最大 C-001 / W-007 / S-019（掃 HANDOFF.md + git log；S-013 從未出現）→ 今次 W-008、S-020 起

## 整體 verdict

| Gate | 結果 | 備注 |
|------|------|------|
| Lint | n/a | 項目冇 eslint；classic script PWA |
| Type check | n/a | 冇 TS |
| Tests | pass | `tests/run-all.sh` 26 / 26 PASS（exit 0）；之後已還原 `tests/*.png`，working tree 乾淨 |
| Coverage | n/a | 冇 coverage 工具；新行為每項都有 Playwright 斷言 |
| No Critical | pass | 0 個 🔴 |
| Security scan | n/a | 冇新增依賴 |

- 個別分數：A 96 / B 93 / C 100 / D 99
- **Status：pass**（每個 fix 都 ≥ 90、無 Critical、gates 全 pass）
- 有一個 🟡 W-008（a11y 對比度回退），建議喺 release 前順手修（一行 CSS）

---

## Section A — Install banner（059b5cd + 5829350）

改動：`shouldShowInstallBanner()` = `matchMedia(INSTALL_TOUCH_QUERY).matches && !getLS(INSTALL_DISMISSED_LS)`；`beforeinstallprompt` 一律 `preventDefault()` + 存 `deferredPrompt`；✕（`data-action="dismissInstall"`）收起 banner + `setLS(INSTALL_DISMISSED_LS, true)`。

Edge case 核對：
- `matchMedia` 唔存在：會發 `beforeinstallprompt` 嘅瀏覽器（Chromium 系）全部有 `matchMedia`，handler 唔會喺冇 `matchMedia` 嘅環境行。冇問題。
- localStorage 用唔到：`getLS` catch → `null`（banner 照出），`setLS` 靜默失敗 → ✕ 只對今次 page load 有效，下次 load 再出。可以接受（唔會 throw，唔會壞 UI）→ 見 S-021。
- ✕ 之後 `deferredPrompt`：保留住（冇清）。冇害：banner 唔再顯示，`promptInstall` 冇其他入口；就算日後加入口都仲用得。
- Chromebook / iPad：Chromebook laptop mode primary pointer = fine → 唔出（符合「PC 唔出」）；tablet mode = coarse → 出。Touchscreen laptop 都係 fine → 唔出。iPad / iOS Safari 根本冇 `beforeinstallprompt`，banner 本身就唔會出（v0.59 已係咁，唔係 regression）→ 見 S-022。
- 改名 commit 5829350：`INSTALL_DISMISSED_KEY` → `INSTALL_DISMISSED_LS`，grep 冇殘留舊名。
- Key 跟 `lifeuk.` prefix；HANDOFF「localStorage keys」表已加 `lifeuk.installDismissed`；reset 流程冇用 prefix 清 key，所以 dismiss 唔會被 reset 清走（合理）。
- a11y：✕ 有 `aria-label` / `title` = `app.installDismiss`（經 `data-i18n-attr`，test 有驗）；`:focus-visible` 2px 白 outline；`--text-inverse-muted` 喺 navy 上 5.4:1，> 3:1 non-text 要求。

### 🟢 S-020 — `promptInstall()` outcome 為 `dismissed` 時 banner 留低一粒冇反應嘅 Install 掣（既有，非今次引入）
- 位置：`js/pwa/pwa.js` `promptInstall()`
- 描述：只有 `accepted` 先收 banner；`dismissed` 之後 `deferredPrompt = null`，banner 仲喺度，再撳 Install 冇反應。今次加咗 ✕ 令問題輕咗，但掣本身仍係死掣。
- 方案 A：無論 outcome 都收起 banner（`dismissed` 唔寫 `installDismissed`，下次 Chrome 再發 event 先再出）。簡單，行為最直接。
- 方案 B：`dismissed` 時當用戶撳咗 ✕，即 `dismissInstallBanner()`。一致，但用戶喺 Chrome 對話框撳取消未必等於「永遠唔要」。
- 推薦：A。順手可加 `appinstalled` listener 收 banner。

### 🟢 S-021 — `pwa-test` 嘅 dismiss 斷言偏寬
- 位置：`tests/pwa-test.js` `checkInstallDismiss()`：`after.stored !== null`
- 描述：寫咗 `"false"` 或任何值都會過。
- 方案 A：斷言 `after.stored === 'true'`。方案 B：`JSON.parse(stored) === true`。
- 推薦：A（同 HANDOFF 寫嘅「值 `true`」對應）。

### 🟢 S-022 — ✕ 觸控目標 28px；iOS 冇 install 提示（HANDOFF 記低）
- 位置：`css/components/popover.css` `.install-close`；HANDOFF PWA 段
- 描述：banner 只喺觸控裝置出，28×28 過 WCAG 2.5.8（24px）但低過 2.5.5 / 平台建議 44px。另外 HANDOFF 可加一句「iOS Safari 冇 `beforeinstallprompt`，banner 永遠唔出」免得日後有人以為係 bug。
- 方案 A：保持 28px 視覺尺寸，用 padding / 負 margin 將可撳範圍擴到 ~40px。方案 B：直接 36–40px。
- 推薦：A（唔郁視覺）。

評分 A：正確性 25 / 安全 20 / 可維護 20 / 測試 14 / 性能 10 / 風格 9 → **96**（3 × S，-1 each：S-020 正確性 → 實際計入可維護 -1，S-021 測試 -1，S-022 風格 -1）

---

## Section B — S-018 token 合併（399d665）

改動：`--text-inverse-75/70/65/60/55/45` → `strong` .75 / `muted` .6 / `faint` .45；6 處 css 改用新名；`structure-test` 守衛 `--text-inverse-[0-9]`。

核對：
- grep 全 repo（排除 `.claude/worktrees` — 已喺 `.git/info/exclude`，係舊 worktree 殘留，唔入 build）冇舊名殘留；JS template / `index.html` 冇用 `--text-inverse-*`。
- 自己寫 script 核對：css / js / html 所有 `var(--x)` 都喺 `tokens.css` 有定義（冇 typo 致 fallback）。
- HANDOFF token 表（L118）、S-018 note（L127）、structure-test 描述（L337）同 code 一致。

### 🟡 W-008 — `.exam-btn.all .exam-mastery.zero` 改 `faint`（0.55 → 0.45）後對比度跌穿 WCAG AA
- 位置：`css/screens/home.css` L54
- 描述：呢個係 10px（`--fs-2xs`）、有資訊嘅文字（「0 mastered」之類），底色係 `navy → navy-mid` 漸變。計算：
  | alpha | on `--navy` | on `--navy-mid` |
  |------|------|------|
  | 0.55（v0.59） | 5.50 | 4.84 |
  | 0.45（v0.60） | **4.18** | **3.77** |
  | 0.60（muted） | 6.26 | 5.44 |
  v0.59 兩端都過 4.5:1；v0.60 兩端都唔過。用戶確認嘅係「輕微視覺改動」，但未必知會引入 a11y 回退。`.app-version` 本來就係 0.45（既有，不計）。
- 影響：低視力用戶喺首頁「All」掣睇唔清 0 計數。
- 方案 A：`.zero` 改用 `--text-inverse-muted`（0.6）。一行，兩端 ≥ 5.4:1；但 zero 同 sub-line 同一級，少咗「淡過」嘅層次（`.zero` 已有 `font-weight: 500` 區分，夠用）。
- 方案 B：`faint` 提到 0.55（同步影響 `.app-version`，對比亦改善）。保持三級，但改 token 定義要再同用戶確認。
- 推薦：A（唔改 token，用戶已確認嘅三級值不變）。

### 🟢 S-023 — structure-test 守衛只掃 `css/`
- 位置：`tests/structure-test.js` 新守衛
- 描述：舊名喺 JS template 或 `index.html` 出現（例如將來 inline style）唔會被捉；亦冇「用咗但未定義嘅 token」檢查（今次手動核對過冇問題）。
- 方案 A：守衛範圍擴到 `js/**/*.js` + `index.html`。方案 B：加通用檢查：所有 `var(--x)` 必須喺 `tokens.css` 定義（一次過捉舊名同 typo）。
- 推薦：B（覆蓋更廣，亦取代 A）。

### 🟢 S-024 — HANDOFF L260 漏句號
- 位置：`HANDOFF.md` L260：「…之後永遠唔再出`pwa-test` 用 CDP…」
- 描述：v0.60 插入句尾冇「。」，同下一句黐埋。
- 方案 A：補「。」。方案 B：拆兩個 bullet。推薦：A。

評分 B：正確性 25 / 安全 20 / 可維護 19 / 測試 14 / 性能 10 / 風格 5 → **93**（W-008 -5 計入風格 / a11y，S-023 測試 -1，S-024 可維護 -1）

---

## Section C — CUI-0007 plural（35bdbc3）

- `similar.practise` 改 `{ one, other }`；`t()` 經 `isPluralValue` + `Intl.PluralRules` 揀 form，`similarPanel.js` 已傳 `{ n: keys.length }`；`keys.length === 0` 時根本唔 render，冇「these 0」問題。
- 只有 `locales/en.js`，冇其他語言要補。
- Test：`t()` 直接驗 n=1 / n=3，再用 `STUDY` 搵一個 2 source 嘅 fact 做 E2E 驗「this one」。完整。
- 冇發現問題。

評分 C：**100**

---

## Section D — Modal focus（4743e68）

- `showConfirm({ focusCancel = false })`，default 唔變，Submit（`examTools.js`）照舊 focus OK；Reset ×2（`confirmReset`）+ Leave（`goHome`）傳 `focusCancel: true`。grep 全部 `showConfirm` caller 只有呢 4 個，冇漏 destructive confirm。
- 全域 keydown 只處理 Escape（冇「Enter = OK」global handler），所以 focus Cancel 真係擋到誤撳 Enter / Space。
- Test：mastery-test 驗兩個 reset、examtools-test 驗 Leave + Submit focus。

### 🟢 S-025 — Modal 冇 focus trap / 關閉後冇還原 focus（既有）
- 位置：`js/components/modal.js`
- 描述：Tab 可以跳出 modal 去背後元素；close 後 focus 留喺隱藏咗嘅掣（落 `body`）。今次改動冇令佢變差，記低供日後 a11y pass。
- 方案 A：開時記 `document.activeElement`，close 時 `.focus()` 返；加簡單 Tab 循環。方案 B：改用原生 `<dialog>` + `showModal()`（內建 inert 同 Escape），但要重寫 modal CSS / test。
- 推薦：A（改動細）。

評分 D：正確性 25 / 安全 20 / 可維護 19 / 測試 15 / 性能 10 / 風格 10 → **99**

---

## 評分結果（整體）

| 維度 | 得分 | 滿分 | 備注 |
|------|------|------|------|
| 正確性 | 25 | 25 | 無邏輯錯 |
| 安全性 | 20 | 20 | 無新依賴、無敏感資料 |
| 可維護性 | 18 | 20 | S-020、S-024、S-025 |
| 測試覆蓋 | 13 | 15 | S-021、S-023 |
| 性能 | 10 | 10 | |
| 代碼風格 / a11y | 9 | 10 | W-008 本身 -5，按 fix 計入 Section B；S-022 |
| **整體（按 fix 平均）** | **97** | **100** | A 96 / B 93 / C 100 / D 99 |

**結果：pass**

## Design Fidelity
- Baseline（token / focus / 文字）：改動冇超出描述嘅 delta；視覺改動只有 4 處 alpha（0.7→0.75、0.65→0.6 ×2、0.55→0.45），同 HANDOFF L127 一致。0.55→0.45 有 a11y 影響（W-008）。
- Proposal（✕）：位置喺 Install 掣後、ghost 圓形、`muted` 色、hover 變白，符合 A + C 方案。用 token（`--radius-circle`、`--fs-md`、`--text-inverse-*`），冇 hardcoded 色。
- 依 handoff protocol，proposal 確認後 QA 應截 final screenshot 做 baseline。

## TDD 執行驗證
每個 fix 嘅 test 同實作喺同一 commit，git history 睇唔到「先紅後綠」。請 developer 補一句 TDD 執行說明（唔影響 status）。

## 做得好嘅地方
- `beforeinstallprompt` 一律 `preventDefault` 但 banner 有條件顯示，分得清楚；常數入 `config.js`（worker-safe）。
- PWA test 用 init script 模擬 pointer，同時驗 PC / phone / reload 後持久。
- Token 合併附守衛 + HANDOFF 寫清楚每個舊值去咗邊。
- `focusCancel` default 保持向後兼容，caller 意圖明確。
- HANDOFF 同 code 基本完全一致（只有 S-024 一個漏句號）。

## 修正優先順序
| 優先 | ID | 內容 | 工作量 |
|------|----|------|--------|
| 1 | W-008 | `.exam-btn.all .exam-mastery.zero` → `var(--text-inverse-muted)` | 1 行 |
| 2 | S-021 | dismiss 斷言 `=== 'true'` | 1 行 |
| 3 | S-024 | HANDOFF L260 補「。」 | 1 字 |
| 4 | S-020 | `dismissed` outcome 都收 banner（+ `appinstalled`） | 小 |
| 5 | S-023 | structure-test：未定義 token 守衛 | 小 |
| 6 | S-022 / S-025 | ✕ hit area、modal focus trap | 小–中 |

## 修訂後代碼（W-008，推薦方案 A）

```css
/* css/screens/home.css — 0 計數要過 AA 4.5:1（0.45 只有 3.8–4.2:1）；層次靠 .zero 嘅 font-weight 500 */
.exam-btn.all .exam-mastery.zero { color: var(--text-inverse-muted); }
```

（如採用，`tokens.css` faint 注釋「zero counts」要改做只寫「version tag」，HANDOFF L118 / L127 同步。）

修正 commit 格式：`fix: W-008 | ...`，每個 item 一個 commit。

## Handoff receipt

```handoff-receipt
protocol: 1
status: pass
score: 97/100
hard_gates:
  lint: n/a
  type_check: n/a
  tests: pass
  coverage: n/a
next_action: merge_develop
next_agent: quality-assurance
branch: "claude/intelligent-lovelace-zczz0o"
context: "v0.60 batch (install banner touch-only + dismiss, S-018 token merge, CUI-0007 plural, modal focusCancel) all pass 26/26; recommend W-008 one-line contrast fix (.exam-mastery.zero 0.45 fails AA) before release"
```
