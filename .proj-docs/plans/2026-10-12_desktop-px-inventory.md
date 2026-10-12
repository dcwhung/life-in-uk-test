# Desktop 寫死 px 清單（v2.0.0 階段 1）

**日期**：2026-10-12
**來源**：handoff [`2026-10-12_handoff_desktop-layout.md`](2026-10-12_handoff_desktop-layout.md) §2「寫死嘅 px 喺 desktop 都要 ×1.2」
**範圍**：`css/` 所有 file（`tokens.css` 嘅 `--fs-*`／`--space-*` 除外：階段 1 已經用 token 一次過 ×1.2）同 `js/`。行號係階段 1 commit 之後嘅行號。

## 點用

- 每條 lane 只改自己 file 嘅項目，喺自己 file 尾嘅 `@media (min-width: 1024px)` block 寫 desktop 值（跟 `@media (max-width: 480px)` 慣例），< 1024px 一個 pixel 都唔可以變。
- 寫法：`calc(Npx * var(--desktop-scale))`（`--desktop-scale: 1.2`，`css/base/tokens.css`），唔好寫死 1.2 或者計好嘅數。例：`.quick-btn { width: calc(32px * var(--desktop-scale)); }`。如果 mockup 嘅 desktop 值唔係 ×1.2（例如 popover 改定闊 420px × 1.2），跟 mockup。
- 「唔使改」嗰啲係刻意唔放大：1–2.5px 嘅線／框／focus ring（mockup 冇放大）、觸控範圍（44px 已經夠，desktop 掣只會更大）、圓角 token、陰影、`@media (max-width…)` 入面嘅手機規則。
- 共用 file 嘅擁有權：`buttons.css`（除 `.back-btn`／`.icon-btn`）同 `dots.css`、`note.css` 歸 B；`fact.css`、`chips.css` 歸 C（`.practice-tab` 同 Home 共用，C 改嗰陣要顧 Home；A 要郁就同 C 講）。
- 相關但唔係「寫死 px ×1.2」嘅提示：`popover.css` `.info-pop { top: 64px }` 係跟 header 高度（58px + 6px），desktop 浮層位置由 Lane C 按 mockup 重做（建議用 `var(--header-h)`）。

## 階段 1 已做（共用）

| 項目 | 做法 |
|---|---|
| `--fs-*`（20 個）、`--space-*`（10 個） | `tokens.css` 尾 `@media (min-width: 1024px)`：×1.2；大字 = (基礎 + `--large-text-step` 2px) × 1.2 |
| header 高 58、logo 36、⚙ 32 | 新 token `--header-h`／`--header-logo-size`／`--header-btn-size`，desktop ×1.2 |
| header 內容 + `main` 最闊 780 | 新 token `--content-max-w`：desktop 1280px |
| `main` 底 padding 100 | 新 token `--main-pad-bottom`：desktop ×1.2（一屏高畫面用 `--fit-screen-gap`，見 `css/components/fit.css`） |
| 題號點上限 30（`dots.css`） | 新 token `--dot-max-w`：desktop ×1.2（`dots.css` 只係改用 token，B 唔使再做） |
| `.back-btn` padding 7、`.icon-btn` padding 9 | `buttons.css` 尾 desktop block ×1.2（每個畫面都有，所以共用做） |

## JS

`js/` 冇寫死 layout px：

| File:Line | 內容 | 處理 |
|---|---|---|
| `js/core/config.js` `DOUBLE_TAP_SLOP_PX = 40` | 雙擊防護嘅指標距離（唔係 layout） | 唔改 |
| `js/components/popover.js:27` | `pointArrowAt` 量出嚟嘅箭嘴位（`px` 係單位） | 唔改（Lane C 照用） |
| `js/screens/planSchedule.js:62–63, 286` | 量 `offsetTop`／`scrollTop` 嘅值 | 唔改（Lane A F3 改 `scrollLeft`） |
| `style.width = …%`（quiz／plan 各處） | 百分比 | 唔改 |

## 數量

| Lane | 要 ×1.2（尺寸／間距） | 唔使改（線／框、觸控範圍、圓角、陰影、手機 media…） |
|---|---|---|
| 共用 | 8 | 18 |
| A | 63 | 68 |
| B | 57 | 48 |
| C | 43 | 44 |

### 共用（header、`main`、`.screen`、body、tokens、`.back-btn`）

**要處理（8）**

| File:Line | Selector | 屬性: 值 | 狀態 |
|---|---|---|---|
| `css/base/tokens.css:116` | `:root` | `--content-max-w: 780px` | ✅ 階段 1 已做 |
| `css/base/tokens.css:117` | `:root` | `--header-h: 58px` | ✅ 階段 1 已做 |
| `css/base/tokens.css:118` | `:root` | `--header-logo-size: 36px` | ✅ 階段 1 已做 |
| `css/base/tokens.css:119` | `:root` | `--header-btn-size: 32px` | ✅ 階段 1 已做 |
| `css/base/tokens.css:120` | `:root` | `--dot-max-w: 30px` | ✅ 階段 1 已做 |
| `css/base/tokens.css:121` | `:root` | `--main-pad-bottom: 100px` | ✅ 階段 1 已做 |
| `css/components/buttons.css:6` | `.back-btn` | `padding: 7px var(--space-7)` | ✅ 階段 1 已做 |
| `css/components/buttons.css:14` | `.back-btn.icon-btn, .nav-btn.secondary.icon-btn` | `padding: var(--space-3) 9px` | ✅ 階段 1 已做 |

<details><summary>唔使改（18）</summary>

| File:Line | Selector | 屬性: 值 | 類別 |
|---|---|---|---|
| `css/base/layout.css:45` | `.logo-sub` | `margin-top: 1px` | 1px 微調（唔改） |
| `css/base/layout.css:63` | `.settings-btn::before` | `inset: -6px` | 觸控範圍（唔使放大） |
| `css/base/layout.css:66` | `.settings-btn:focus-visible` | `outline: 2px solid var(--gold-light)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/base/layout.css:66` | `.settings-btn:focus-visible` | `outline-offset: 2px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/base/layout.css:113` | `@keyframes slideIn` | `transform: translateY(8px)` | 動畫位移（唔改） |
| `css/base/tokens.css:59` | `:root` | `--radius: 14px` | 圓角（mockup 冇放大） |
| `css/base/tokens.css:60` | `:root` | `--radius-md: 10px` | 圓角（mockup 冇放大） |
| `css/base/tokens.css:61` | `:root` | `--radius-sm: 8px` | 圓角（mockup 冇放大） |
| `css/base/tokens.css:62` | `:root` | `--radius-xs: 6px` | 圓角（mockup 冇放大） |
| `css/base/tokens.css:63` | `:root` | `--radius-pill: 999px` | 圓角（mockup 冇放大） |
| `css/base/tokens.css:115` | `:root` | `--large-text-step: 2px` | 大字步距（唔係 layout px） |
| `css/base/tokens.css:182` | `:root` | `--shadow: 0 4px 24px rgba(26,39,68,0.10)` | 陰影（唔改） |
| `css/base/tokens.css:183` | `:root` | `--shadow-sm: 0 2px 8px rgba(26,39,68,0.07)` | 陰影（唔改） |
| `css/base/tokens.css:184` | `:root` | `--shadow-header: 0 2px 16px rgba(0,0,0,0.25)` | 陰影（唔改） |
| `css/base/tokens.css:185` | `:root` | `--shadow-pop: 0 12px 32px rgba(0,0,0,0.35)` | 陰影（唔改） |
| `css/components/buttons.css:4` | `.back-btn` | `border: 1.5px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/buttons.css:18` | `.back-btn.icon-btn::before, .nav-btn.secondary.icon-btn::bef` | `width: max(100%, 44px)` | 觸控範圍（唔使放大） |
| `css/components/buttons.css:18` | `.back-btn.icon-btn::before, .nav-btn.secondary.icon-btn::bef` | `height: max(100%, 44px)` | 觸控範圍（唔使放大） |

</details>

### Lane A：Home／Plan（`home.css`、`plan.css`）

**要處理（63）**

| File:Line | Selector | 屬性: 值 | 狀態 |
|---|---|---|---|
| `css/screens/home.css:13` | `.mode-card:hover` | `transform: translateY(-2px)` | 待 lane |
| `css/screens/home.css:48` | `.mastery-bar` | `height: 3px` | 待 lane |
| `css/screens/home.css:76` | `.exam-grid` | `grid-template-columns: repeat(auto-fill, minmax(80px, 1fr))` | 待 lane |
| `css/screens/home.css:94` | `.exam-btn.done::after` | `top: -6px` | 待 lane |
| `css/screens/home.css:94` | `.exam-btn.done::after` | `right: -6px` | 待 lane |
| `css/screens/home.css:96` | `.exam-btn.done::after` | `width: 16px` | 待 lane |
| `css/screens/home.css:96` | `.exam-btn.done::after` | `height: 16px` | 待 lane |
| `css/screens/home.css:124` | `.my-tile` | `padding: var(--space-6) var(--space-6) 11px` | 待 lane |
| `css/screens/home.css:127` | `.my-tile .t-icon` | `width: 30px` | 待 lane |
| `css/screens/home.css:127` | `.my-tile .t-icon` | `height: 30px` | 待 lane |
| `css/screens/home.css:132` | `.my-tile .t-icon svg` | `width: 17px` | 待 lane |
| `css/screens/home.css:132` | `.my-tile .t-icon svg` | `height: 17px` | 待 lane |
| `css/screens/home.css:143` | `.bm-inline` | `width: 12px` | 待 lane |
| `css/screens/home.css:143` | `.bm-inline` | `height: 12px` | 待 lane |
| `css/screens/home.css:143` | `.bm-inline` | `vertical-align: -2px` | 待 lane |
| `css/screens/home.css:163` | `.chapter-btn .ch-num` | `padding: 3px var(--space-4)` | 待 lane |
| `css/screens/plan.css:11` | `.plan-steps i` | `height: 4px` | 待 lane |
| `css/screens/plan.css:22` | `.feature-pill` | `vertical-align: 2px` | 待 lane |
| `css/screens/plan.css:22` | `.feature-pill` | `padding: 1px var(--space-4)` | 待 lane |
| `css/screens/plan.css:36` | `.plan-cta-go` | `padding: 7px var(--space-6)` | 待 lane |
| `css/screens/plan.css:73` | `.plan-ticks` | `height: 16px` | 待 lane |
| `css/screens/plan.css:88` | `.plan-meter` | `height: 10px` | 待 lane |
| `css/screens/plan.css:93` | `.plan-pill` | `padding: 3px var(--space-5)` | 待 lane |
| `css/screens/plan.css:99` | `.nav-btn.plan-small` | `padding: 7px var(--space-7)` | 待 lane |
| `css/screens/plan.css:118` | `.plan-strat` | `grid-template-columns: 30px minmax(0, 1fr)` | 待 lane |
| `css/screens/plan.css:122` | `.plan-strat-n` | `width: 30px` | 待 lane |
| `css/screens/plan.css:122` | `.plan-strat-n` | `height: 30px` | 待 lane |
| `css/screens/plan.css:130` | `.plan-ord` | `grid-template-columns: 26px minmax(0, 1fr)` | 待 lane |
| `css/screens/plan.css:131` | `.plan-ord-n` | `width: 26px` | 待 lane |
| `css/screens/plan.css:131` | `.plan-ord-n` | `height: 26px` | 待 lane |
| `css/screens/plan.css:139` | `.plan-chw` | `--plan-chw-count-w: 112px` | 待 lane |
| `css/screens/plan.css:140` | `.plan-chw-bar` | `height: 8px` | 待 lane |
| `css/screens/plan.css:156` | `.plan-fold-chev` | `width: 28px` | 待 lane |
| `css/screens/plan.css:156` | `.plan-fold-chev` | `height: 28px` | 待 lane |
| `css/screens/plan.css:160` | `.plan-fold-chev svg` | `width: 14px` | 待 lane |
| `css/screens/plan.css:160` | `.plan-fold-chev svg` | `height: 14px` | 待 lane |
| `css/screens/plan.css:171` | `.plan-ord-mini` | `--plan-ord-dot: 22px` | 待 lane |
| `css/screens/plan.css:177` | `.plan-legend i` | `width: 12px` | 待 lane |
| `css/screens/plan.css:177` | `.plan-legend i` | `height: 12px` | 待 lane |
| `css/screens/plan.css:180` | `.plan-day-scroll` | `max-height: min(60vh, 520px)` | 待 lane |
| `css/screens/plan.css:187` | `.plan-day` | `--plan-day-side-w: 72px` | 待 lane |
| `css/screens/plan.css:192` | `.plan-day.plan-far` | `contain-intrinsic-size: auto 96px` | 待 lane |
| `css/screens/plan.css:214` | `.plan-day-tasks` | `gap: 3px` | 待 lane |
| `css/screens/plan.css:222` | `.plan-exam-pat, .plan-cell.plan-exam-pat` | `background-image: linear-gradient(45deg, var(--plan-exam-line) 1px, transparent 1px), li` | 待 lane |
| `css/screens/plan.css:222` | `.plan-exam-pat, .plan-cell.plan-exam-pat` | `background-size: 8px 8px` | 待 lane |
| `css/screens/plan.css:240` | `.plan-home-bar` | `height: 8px` | 待 lane |
| `css/screens/plan.css:298` | `.plan-sr` | `width: 1px` | 待 lane |
| `css/screens/plan.css:298` | `.plan-sr` | `height: 1px` | 待 lane |
| `css/screens/plan.css:298` | `.plan-sr` | `margin: -1px` | 待 lane |
| `css/screens/plan.css:308` | `.plan-task` | `grid-template-columns: 40px minmax(0, 1fr) auto` | 待 lane |
| `css/screens/plan.css:309` | `.plan-task-ic` | `width: 40px` | 待 lane |
| `css/screens/plan.css:309` | `.plan-task-ic` | `height: 40px` | 待 lane |
| `css/screens/plan.css:317` | `.plan-mini` | `height: 5px` | 待 lane |
| `css/screens/plan.css:324` | `.plan-tag` | `padding: 1px 7px` | 待 lane |
| `css/screens/plan.css:324` | `.plan-tag` | `vertical-align: 1px` | 待 lane |
| `css/screens/plan.css:329` | `.plan-alert` | `grid-template-columns: 22px minmax(0, 1fr)` | 待 lane |
| `css/screens/plan.css:353` | `.plan-cell.rest` | `background: repeating-linear-gradient(45deg, var(--bg), var(--bg) 4px, var(--plan-` | 待 lane |
| `css/screens/plan.css:359` | `.plan-legend .plan-swatch.plan-exam-pat` | `background-size: 4px 4px` | 待 lane |
| `css/screens/plan.css:389` | `.plan-run-meter` | `height: 5px` | 待 lane |
| `css/screens/plan.css:407` | `:root[data-font-size="large"] .plan-task` | `grid-template-columns: 32px minmax(0, 1fr)` | 待 lane |
| `css/screens/plan.css:408` | `:root[data-font-size="large"] .plan-task-ic` | `width: 32px` | 待 lane |
| `css/screens/plan.css:408` | `:root[data-font-size="large"] .plan-task-ic` | `height: 32px` | 待 lane |
| `css/screens/plan.css:410` | `:root[data-font-size="large"] .plan-chw` | `--plan-chw-count-w: 128px` | 待 lane |

<details><summary>唔使改（68）</summary>

| File:Line | Selector | 屬性: 值 | 類別 |
|---|---|---|---|
| `css/screens/home.css:7` | `.mode-card` | `border: 2px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/home.css:22` | `.reset-row` | `border: 1.5px dashed var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/home.css:36` | `.reset-btn` | `border: 1.5px solid var(--red-light)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/home.css:48` | `.mastery-bar` | `border-radius: 0 2px 2px 0` | 圓角（mockup 冇放大） |
| `css/screens/home.css:67` | `.mode-desc-panel` | `border-left: 4px solid var(--navy)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/home.css:79` | `.exam-btn` | `border: 2px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/home.css:92` | `.exam-btn.done::after` | `--exam-badge-ring: 1.5px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/home.css:123` | `.my-tile` | `border: 2px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/home.css:123` | `.my-tile` | `border-radius: 12px` | 圓角（mockup 冇放大） |
| `css/screens/home.css:128` | `.my-tile.wrong` | `border-left: 4px solid var(--red-light)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/home.css:130` | `.my-tile.flagged` | `border-left: 4px solid var(--orange)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/home.css:152` | `.chapter-btn` | `border: 2px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/home.css:172` | `.diff-btn .ch-name` | `@media: @media (max-width: 480px)` | 手機 breakpoint（唔改） |
| `css/screens/home.css:172` | `.diff-btn .ch-name` | `max-width: 480px)` | 手機 media 內（< 1024 先生效，唔使改） |
| `css/screens/plan.css:13` | `.nav-btn.plan-block` | `min-height: 44px` | 觸控範圍（唔使放大） |
| `css/screens/plan.css:17` | `.plan-settings` | `border-top: 1px solid var(--gold-border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:31` | `.plan-cta` | `grid-template-columns: 44px minmax(0, 1fr) auto` | 觸控範圍（唔使放大） |
| `css/screens/plan.css:31` | `.plan-cta` | `border: 2px dashed var(--gold)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:33` | `.plan-cta:focus-visible` | `outline: 2px solid var(--navy)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:33` | `.plan-cta:focus-visible` | `outline-offset: 2px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:34` | `.plan-cta-ic` | `width: 44px` | 觸控範圍（唔使放大） |
| `css/screens/plan.css:34` | `.plan-cta-ic` | `height: 44px` | 觸控範圍（唔使放大） |
| `css/screens/plan.css:70` | `.plan-date-pick input` | `border: 1.5px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:102` | `.plan-hit::before` | `height: max(100%, 44px)` | 觸控範圍（唔使放大） |
| `css/screens/plan.css:153` | `.plan-fold-btn::before` | `height: max(100% + var(--space-4), 44px)` | 觸控範圍（唔使放大） |
| `css/screens/plan.css:154` | `.plan-fold-btn:focus-visible` | `outline: 2px solid var(--navy-light)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:154` | `.plan-fold-btn:focus-visible` | `outline-offset: 4px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:171` | `.plan-ord-mini` | `--plan-ord-line: 2px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:174` | `.plan-ord-mini .plan-ord-n` | `box-shadow: 0 0 0 3px var(--card)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:177` | `.plan-legend i` | `border-radius: 3px` | 圓角（mockup 冇放大） |
| `css/screens/plan.css:182` | `.plan-day-scroll:focus-visible` | `outline: 2px solid var(--navy)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:182` | `.plan-day-scroll:focus-visible` | `outline-offset: 2px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:187` | `.plan-day` | `border-top: 1px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:189` | `.plan-day:focus-visible` | `outline: 2px solid var(--navy)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:189` | `.plan-day:focus-visible` | `outline-offset: -2px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:245` | `.plan-btn-gold` | `min-height: 44px` | 觸控範圍（唔使放大） |
| `css/screens/plan.css:247` | `.plan-btn-gold:focus-visible` | `outline: 2px solid var(--gold-light)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:247` | `.plan-btn-gold:focus-visible` | `outline-offset: 2px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:249` | `.plan-btn-line` | `min-height: 44px` | 觸控範圍（唔使放大） |
| `css/screens/plan.css:249` | `.plan-btn-line` | `border: 1.5px solid var(--text-inverse-faint)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:251` | `.plan-btn-line:focus-visible` | `outline: 2px solid var(--gold-light)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:251` | `.plan-btn-line:focus-visible` | `outline-offset: 2px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:266` | `.plan-hit-sq::before` | `width: 44px` | 觸控範圍（唔使放大） |
| `css/screens/plan.css:266` | `.plan-hit-sq::before` | `height: 44px` | 觸控範圍（唔使放大） |
| `css/screens/plan.css:271` | `.plan-day-title:focus-visible` | `outline: 2px solid var(--navy)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:271` | `.plan-day-title:focus-visible` | `outline-offset: 2px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:273` | `.plan-today-head` | `--plan-ring-size: 112px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:308` | `.plan-task` | `border: 1.5px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:341` | `button.plan-cell:hover` | `box-shadow: 0 0 0 2px var(--navy-light)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:342` | `button.plan-cell:focus-visible` | `outline: 2.5px solid var(--gold)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:342` | `button.plan-cell:focus-visible` | `outline-offset: 1px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:354` | `.plan-cell.future` | `border: 1.5px dashed var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:356` | `.plan-cell.today` | `outline: 2.5px solid var(--navy)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:356` | `.plan-cell.today` | `outline-offset: 1px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:357` | `.plan-cell.viewing` | `outline: 2.5px dashed var(--navy)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:357` | `.plan-cell.viewing` | `outline-offset: 1px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:373` | `.plan-task-btn:focus-visible` | `outline: 2px solid var(--navy)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:373` | `.plan-task-btn:focus-visible` | `outline-offset: 2px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/plan.css:381` | `.plan-run-body .nav-row .nav-btn` | `min-height: 44px` | 觸控範圍（唔使放大） |
| `css/screens/plan.css:397` | `.plan-run-body .sqm-cta button` | `min-height: 44px` | 觸控範圍（唔使放大） |
| `css/screens/plan.css:403` | `.plan-result-row .nav-btn` | `min-height: 44px` | 觸控範圍（唔使放大） |
| `css/screens/plan.css:412` | `:root[data-font-size="large"] .plan-chw` | `@media: @media (max-width: 359px)` | 手機 breakpoint（唔改） |
| `css/screens/plan.css:412` | `:root[data-font-size="large"] .plan-chw` | `max-width: 359px)` | 手機 media 內（< 1024 先生效，唔使改） |
| `css/screens/plan.css:414` | `:root[data-font-size="large"] .plan-chw` | `@media: @media (max-width: 380px)` | 手機 breakpoint（唔改） |
| `css/screens/plan.css:414` | `:root[data-font-size="large"] .plan-chw` | `max-width: 380px)` | 手機 media 內（< 1024 先生效，唔使改） |
| `css/screens/plan.css:418` | `.plan-day-switch` | `@media: @media (max-width: 480px)` | 手機 breakpoint（唔改） |
| `css/screens/plan.css:418` | `.plan-day-switch` | `max-width: 480px)` | 手機 media 內（< 1024 先生效，唔使改） |
| `css/screens/plan.css:421` | `.plan-cta` | `grid-template-columns: 44px minmax(0, 1fr)` | 手機 media 內（< 1024 先生效，唔使改） |

</details>

### Lane B：Quiz／Exam／Result／Flagged（`quiz.css`、`results.css`、`flagged.css`、`dots.css`、`note.css`、`buttons.css` 除 `.back-btn`）

**要處理（57）**

| File:Line | Selector | 屬性: 值 | 狀態 |
|---|---|---|---|
| `css/screens/quiz.css:13` | `.round-note` | `padding: 3px var(--space-4)` | 待 lane |
| `css/screens/quiz.css:18` | `.exam-timer` | `padding: 5px 11px` | 待 lane |
| `css/screens/quiz.css:29` | `.q-card` | `padding: 26px 22px` | 待 lane |
| `css/screens/quiz.css:34` | `.q-progress` | `height: 5px` | 待 lane |
| `css/screens/quiz.css:44` | `.q-num` | `min-height: 30px` | 待 lane |
| `css/screens/quiz.css:55` | `.yue-toggle` | `padding: 5px var(--space-6)` | 待 lane |
| `css/screens/quiz.css:73` | `.opt-body` | `gap: 3px` | 待 lane |
| `css/screens/quiz.css:96` | `.opt-letter` | `min-width: 26px` | 待 lane |
| `css/screens/quiz.css:96` | `.opt-letter` | `height: 26px` | 待 lane |
| `css/screens/quiz.css:102` | `.opt-letter` | `margin-top: 1px` | 待 lane |
| `css/screens/quiz.css:118` | `.answer-box` | `padding: var(--space-8) 18px` | 待 lane |
| `css/screens/quiz.css:128` | `.divider` | `height: 1px` | 待 lane |
| `css/screens/quiz.css:138` | `.sqm` | `padding: var(--space-7) 18px var(--space-8)` | 待 lane |
| `css/screens/quiz.css:141` | `.sqm-icon` | `width: 30px` | 待 lane |
| `css/screens/quiz.css:141` | `.sqm-icon` | `height: 30px` | 待 lane |
| `css/screens/quiz.css:145` | `.sqm-count` | `padding: 3px 9px` | 待 lane |
| `css/screens/quiz.css:149` | `.sqm-node` | `padding: var(--space-2) 9px` | 待 lane |
| `css/screens/quiz.css:154` | `.sqm-legend i` | `width: 8px` | 待 lane |
| `css/screens/quiz.css:154` | `.sqm-legend i` | `height: 8px` | 待 lane |
| `css/screens/quiz.css:160` | `.sqm-item` | `padding: 11px 13px` | 待 lane |
| `css/screens/quiz.css:161` | `.sqm-item-top` | `margin-bottom: 5px` | 待 lane |
| `css/screens/quiz.css:168` | `.sqm-cta button` | `padding: 11px var(--space-5)` | 待 lane |
| `css/screens/results.css:5` | `.result-card` | `padding: 32px var(--space-12)` | 待 lane |
| `css/screens/results.css:28` | `.review-item` | `padding: var(--space-8) 18px` | 待 lane |
| `css/screens/results.css:32` | `.review-item` | `scroll-margin-top: 80px` | 待 lane |
| `css/screens/results.css:55` | `.diff-row` | `grid-template-columns: 82px 1fr 82px` | 待 lane |
| `css/screens/results.css:57` | `.diff-bar` | `height: 8px` | 待 lane |
| `css/screens/flagged.css:7` | `.flag-start svg` | `width: 26px` | 待 lane |
| `css/screens/flagged.css:7` | `.flag-start svg` | `height: 26px` | 待 lane |
| `css/screens/flagged.css:11` | `.flag-item` | `padding: 11px 13px` | 待 lane |
| `css/screens/flagged.css:14` | `.flag-item .fi-yue` | `margin-top: 3px` | 待 lane |
| `css/screens/flagged.css:16` | `.flag-item button svg` | `width: 20px` | 待 lane |
| `css/screens/flagged.css:16` | `.flag-item button svg` | `height: 20px` | 待 lane |
| `css/components/dots.css:24` | `.dots-meta i, .rmeta i` | `vertical-align: -1px` | 待 lane |
| `css/components/dots.css:31` | `.dots-meta.practice i` | `margin-right: 3px` | 待 lane |
| `css/components/dots.css:32` | `.dots-meta i` | `width: 9px` | 待 lane |
| `css/components/dots.css:32` | `.dots-meta i` | `height: 9px` | 待 lane |
| `css/components/dots.css:40` | `.rdots-wrap` | `margin-top: 18px` | 待 lane |
| `css/components/dots.css:48` | `.rmeta` | `gap: 5px` | 待 lane |
| `css/components/dots.css:51` | `.rmeta i` | `width: 8px` | 待 lane |
| `css/components/dots.css:51` | `.rmeta i` | `height: 8px` | 待 lane |
| `css/components/dots.css:51` | `.rmeta i` | `margin-right: 3px` | 待 lane |
| `css/components/note.css:12` | `.rv-note-gap` | `height: 6px` | 待 lane |
| `css/components/buttons.css:42` | `.quick-btn` | `width: 32px` | 待 lane |
| `css/components/buttons.css:42` | `.quick-btn` | `height: 32px` | 待 lane |
| `css/components/buttons.css:54` | `.flag-btn` | `width: 32px` | 待 lane |
| `css/components/buttons.css:54` | `.flag-btn` | `height: 32px` | 待 lane |
| `css/components/buttons.css:57` | `.flag-btn svg` | `width: 24px` | 待 lane |
| `css/components/buttons.css:57` | `.flag-btn svg` | `height: 24px` | 待 lane |
| `css/components/buttons.css:61` | `.rv-flag` | `width: 15px` | 待 lane |
| `css/components/buttons.css:61` | `.rv-flag` | `height: 15px` | 待 lane |
| `css/components/buttons.css:61` | `.rv-flag` | `margin-left: 5px` | 待 lane |
| `css/components/buttons.css:61` | `.rv-flag` | `vertical-align: -2px` | 待 lane |
| `css/components/buttons.css:63` | `.chip-flag` | `width: 13px` | 待 lane |
| `css/components/buttons.css:63` | `.chip-flag` | `height: 13px` | 待 lane |
| `css/components/buttons.css:63` | `.chip-flag` | `vertical-align: -2px` | 待 lane |
| `css/components/buttons.css:63` | `.chip-flag` | `margin-right: 3px` | 待 lane |

<details><summary>唔使改（48）</summary>

| File:Line | Selector | 屬性: 值 | 類別 |
|---|---|---|---|
| `css/screens/quiz.css:5` | `.quiz-mode-badge` | `border-radius: 20px` | 圓角（mockup 冇放大） |
| `css/screens/quiz.css:13` | `.round-note` | `border-radius: 6px` | 圓角（mockup 冇放大） |
| `css/screens/quiz.css:52` | `.yue-toggle` | `border: 1.5px solid var(--purple-light)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/quiz.css:67` | `.q-yue` | `border-left: 3px solid var(--purple-light)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/quiz.css:68` | `.q-yue` | `border-radius: 0 8px 8px 0` | 圓角（mockup 冇放大） |
| `css/screens/quiz.css:84` | `.opt` | `border: 2px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/quiz.css:85` | `.opt` | `border-radius: 11px` | 圓角（mockup 冇放大） |
| `css/screens/quiz.css:99` | `.opt-letter` | `border: 1.5px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/quiz.css:116` | `.answer-box` | `border: 1.5px solid var(--green-light)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/quiz.css:117` | `.answer-box` | `border-radius: 11px` | 圓角（mockup 冇放大） |
| `css/screens/quiz.css:138` | `.sqm` | `border: 1.5px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/quiz.css:138` | `.sqm` | `border-radius: 11px` | 圓角（mockup 冇放大） |
| `css/screens/quiz.css:149` | `.sqm-node` | `border: 1.5px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/quiz.css:160` | `.sqm-item` | `border: 1.5px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/quiz.css:170` | `.sqm-cta button` | `@media: @media (max-width: 480px)` | 手機 breakpoint（唔改） |
| `css/screens/quiz.css:170` | `.sqm-cta button` | `max-width: 480px)` | 手機 media 內（< 1024 先生效，唔使改） |
| `css/screens/results.css:29` | `.review-item` | `border-left: 4px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/results.css:40` | `.rv-tr` | `border-top: 1px dashed var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/results.css:44` | `.review-item.hl` | `box-shadow: 0 0 0 3px var(--gold)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/results.css:48` | `.result-timeup` | `border: 1.5px solid var(--red-light)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/results.css:55` | `.diff-row` | `border-bottom: 1px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/results.css:57` | `.diff-bar` | `border-radius: 4px` | 圓角（mockup 冇放大） |
| `css/screens/results.css:58` | `.diff-bar > div` | `border-radius: 4px` | 圓角（mockup 冇放大） |
| `css/screens/results.css:63` | `.diff-pct` | `@media: @media (max-width: 480px)` | 手機 breakpoint（唔改） |
| `css/screens/results.css:63` | `.diff-pct` | `max-width: 480px)` | 手機 media 內（< 1024 先生效，唔使改） |
| `css/screens/results.css:67` | `.result-score` | `@media: @media (max-width: 360px)` | 手機 breakpoint（唔改） |
| `css/screens/results.css:67` | `.result-score` | `max-width: 360px)` | 手機 media 內（< 1024 先生效，唔使改） |
| `css/screens/flagged.css:5` | `.flag-start` | `border-radius: 12px` | 圓角（mockup 冇放大） |
| `css/screens/flagged.css:17` | `.empty-hint` | `border: 1.5px dashed var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/dots.css:13` | `.dot` | `border: 1.5px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/dots.css:15` | `.dot.flag` | `border: 2px solid var(--orange)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/dots.css:19` | `.dot.ok.flag, .dot.bad.flag` | `border: 2.5px solid var(--orange)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/dots.css:20` | `.dot.current` | `box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--gold)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/dots.css:28` | `.dots-meta` | `border-bottom: 1px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/dots.css:34` | `.dots-meta .lg-todo` | `border: 1.5px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/dots.css:40` | `.rdots-wrap` | `border-top: 1px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/dots.css:42` | `.rdot` | `border: 2px solid transparent` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/dots.css:46` | `.rdot.flag` | `box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--orange)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/dots.css:54` | `.rmeta .lg-skip` | `border: 2px solid var(--red-light)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/dots.css:55` | `.rmeta .lg-flag` | `box-shadow: 0 0 0 2px var(--orange)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/dots.css:60` | `.rmeta .lg-flag` | `@media: @media (max-width: 360px)` | 手機 breakpoint（唔改） |
| `css/components/dots.css:60` | `.rmeta .lg-flag` | `max-width: 360px)` | 手機 media 內（< 1024 先生效，唔使改） |
| `css/components/note.css:18` | `.note-table th` | `border-bottom: 2px solid var(--navy)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/note.css:19` | `.note-table td` | `border-bottom: 1px solid var(--divider)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/note.css:31` | `.note-cell-sub.bullet` | `@media: @media (max-width: 374px)` | 手機 breakpoint（唔改） |
| `css/components/note.css:31` | `.note-cell-sub.bullet` | `max-width: 374px)` | 手機 media 內（< 1024 先生效，唔使改） |
| `css/components/buttons.css:34` | `.nav-btn.secondary` | `border: 2px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/buttons.css:44` | `.quick-btn` | `border: 1.5px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |

</details>

### Lane C：Study + 全局浮層（`study.css`、`fact.css`、`chips.css`、`popover.css`、`modal.css`、`toast.css`、`switch.css`）

**要處理（43）**

| File:Line | Selector | 屬性: 值 | 狀態 |
|---|---|---|---|
| `css/screens/study.css:7` | `.study-search` | `padding: 11px var(--space-7)` | 待 lane |
| `css/screens/study.css:17` | `.study-progress` | `padding: 3px var(--space-5)` | 待 lane |
| `css/screens/study.css:22` | `.study-group-title` | `margin: 22px 0 var(--space-5)` | 待 lane |
| `css/screens/study.css:33` | `.study-empty` | `padding: 30px 0` | 待 lane |
| `css/screens/study.css:40` | `.tl-era` | `margin: 22px 0 var(--space-6)` | 待 lane |
| `css/screens/study.css:59` | `.tl-year` | `--tl-dot: 10px` | 待 lane |
| `css/components/fact.css:18` | `.fact-meta` | `gap: 5px` | 待 lane |
| `css/components/fact.css:25` | `.tag` | `padding: var(--space-1) 7px` | 待 lane |
| `css/components/fact.css:43` | `.fact-btn` | `width: 32px` | 待 lane |
| `css/components/fact.css:43` | `.fact-btn` | `height: 32px` | 待 lane |
| `css/components/fact.css:58` | `.fact-btn svg` | `width: 18px` | 待 lane |
| `css/components/fact.css:58` | `.fact-btn svg` | `height: 18px` | 待 lane |
| `css/components/fact.css:67` | `.fact-yue` | `margin-top: 5px` | 待 lane |
| `css/components/fact.css:92` | `.fact-src-nodes` | `gap: 5px` | 待 lane |
| `css/components/fact.css:93` | `.fact-src .sqm-node` | `padding: 3px var(--space-4)` | 待 lane |
| `css/components/chips.css:6` | `.practice-tab, .study-tab` | `padding: 9px var(--space-2)` | 待 lane |
| `css/components/chips.css:28` | `.chip` | `padding: 5px var(--space-6)` | 待 lane |
| `css/components/chips.css:38` | `.stars` | `letter-spacing: 1px` | 待 lane |
| `css/components/popover.css:18` | `.info-pop` | `--info-pop-max-w: 780px` | 待 lane |
| `css/components/popover.css:20` | `.info-pop` | `top: 64px` | 待 lane |
| `css/components/popover.css:21` | `.info-pop` | `--info-arrow-x: 150px` | 待 lane |
| `css/components/popover.css:22` | `.info-pop` | `--info-arrow-size: 12px` | 待 lane |
| `css/components/popover.css:27` | `.info-pop` | `padding: 18px var(--space-10)` | 待 lane |
| `css/components/popover.css:34` | `.info-pop::after` | `top: -7px` | 待 lane |
| `css/components/popover.css:50` | `.seg button` | `min-width: 52px` | 待 lane |
| `css/components/popover.css:50` | `.seg button` | `height: 32px` | 待 lane |
| `css/components/popover.css:83` | `.install-banner` | `padding: var(--space-8) 18px` | 待 lane |
| `css/components/popover.css:95` | `.install-btn` | `padding: 9px var(--space-8)` | 待 lane |
| `css/components/popover.css:103` | `.install-close` | `width: 28px` | 待 lane |
| `css/components/popover.css:103` | `.install-close` | `height: 28px` | 待 lane |
| `css/components/modal.css:10` | `.modal-card` | `max-width: 360px` | 待 lane |
| `css/components/modal.css:10` | `.modal-card` | `padding: 22px var(--space-10) 18px` | 待 lane |
| `css/components/modal.css:13` | `.modal-msg` | `margin-bottom: 18px` | 待 lane |
| `css/components/toast.css:5` | `.toast` | `bottom: calc(var(--space-12) + env(safe-area-inset-bottom, 0px))` | 待 lane |
| `css/components/toast.css:8` | `.toast` | `max-width: calc(100vw - 32px)` | 待 lane |
| `css/components/toast.css:11` | `.toast` | `padding: var(--space-5) 18px` | 待 lane |
| `css/components/switch.css:4` | `.switch` | `width: 52px` | 待 lane |
| `css/components/switch.css:4` | `.switch` | `height: 30px` | 待 lane |
| `css/components/switch.css:13` | `.switch i` | `top: 3px` | 待 lane |
| `css/components/switch.css:13` | `.switch i` | `left: 3px` | 待 lane |
| `css/components/switch.css:14` | `.switch i` | `width: 24px` | 待 lane |
| `css/components/switch.css:14` | `.switch i` | `height: 24px` | 待 lane |
| `css/components/switch.css:21` | `.switch[aria-checked="true"] i` | `transform: translateX(22px)` | 待 lane |

<details><summary>唔使改（44）</summary>

| File:Line | Selector | 屬性: 值 | 類別 |
|---|---|---|---|
| `css/screens/study.css:5` | `.study-search` | `border: 2px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/study.css:16` | `.study-progress` | `border: 1.5px solid var(--green-light)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/study.css:51` | `.tl-item` | `--tl-rail: 2px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/study.css:59` | `.tl-year` | `--tl-dot-border: 2px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/screens/study.css:59` | `.tl-year` | `--tl-dot-ring: 2px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/fact.css:8` | `.fact` | `border-left: 4px solid var(--study-accent)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/fact.css:16` | `.fact.flash` | `outline: 2px solid var(--gold)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/fact.css:16` | `.fact.flash` | `outline-offset: 2px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/fact.css:36` | `.fact-actions` | `--fact-btn-border: 1.5px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/fact.css:36` | `.fact-actions` | `--fact-btn-ring: 6px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/fact.css:71` | `.fact-mem summary` | `min-height: 44px` | 觸控範圍（唔使放大） |
| `css/components/fact.css:80` | `.fact-mem-body` | `@media: @media (max-width: 374px)` | 手機 breakpoint（唔改） |
| `css/components/fact.css:80` | `.fact-mem-body` | `max-width: 374px)` | 手機 media 內（< 1024 先生效，唔使改） |
| `css/components/fact.css:87` | `.fact-src` | `border-top: 1px solid var(--divider)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/fact.css:101` | `.fact-practise` | `--fact-practise-border: 1.5px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/fact.css:101` | `.fact-practise` | `--fact-practise-ring: 8px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/fact.css:116` | `.sqm-fact` | `border-left: 4px solid var(--gold)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/chips.css:4` | `.practice-tab, .study-tab` | `border: 2px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/chips.css:26` | `.chip` | `border: 1.5px solid var(--border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/chips.css:41` | `.stars .off` | `@media: @media (max-width: 480px)` | 手機 breakpoint（唔改） |
| `css/components/chips.css:41` | `.stars .off` | `max-width: 480px)` | 手機 media 內（< 1024 先生效，唔使改） |
| `css/components/popover.css:11` | `.info-btn::before` | `width: 44px` | 觸控範圍（唔使放大） |
| `css/components/popover.css:11` | `.info-btn::before` | `height: 44px` | 觸控範圍（唔使放大） |
| `css/components/popover.css:25` | `.info-pop` | `border: 1px solid var(--gold-border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/popover.css:36` | `.info-pop::after` | `border-left: 1px solid var(--gold-border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/popover.css:36` | `.info-pop::after` | `border-top: 1px solid var(--gold-border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/popover.css:44` | `.set-row + .set-row` | `border-top: 1px solid var(--gold-border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/popover.css:47` | `.seg` | `border: 1.5px solid var(--gold)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/popover.css:54` | `.seg button::before` | `top: -6px` | 觸控範圍（唔使放大） |
| `css/components/popover.css:54` | `.seg button::before` | `bottom: -6px` | 觸控範圍（唔使放大） |
| `css/components/popover.css:57` | `.seg button + button` | `border-left: 1.5px solid var(--gold)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/popover.css:62` | `.seg button:focus-visible` | `outline: 2px solid var(--text-inverse)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/popover.css:62` | `.seg button:focus-visible` | `outline-offset: -4px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/popover.css:72` | `.hero-badge` | `border: 1px solid var(--gold-border)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/popover.css:113` | `.install-close::before` | `inset: -8px` | 觸控範圍（唔使放大） |
| `css/components/popover.css:115` | `.install-close:focus-visible` | `outline: 2px solid var(--text-inverse)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/popover.css:115` | `.install-close:focus-visible` | `outline-offset: 1px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/modal.css:24` | `.modal-card.danger #confirmOk:focus-visible` | `outline: 2px solid var(--red)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/modal.css:24` | `.modal-card.danger #confirmOk:focus-visible` | `outline-offset: 2px` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/modal.css:30` | `.modal-card.danger #confirmCancel:focus-visible` | `box-shadow: inset 0 0 0 1px var(--red)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/toast.css:17` | `@keyframes toastIn` | `transform: translate(-50%, 8px)` | 動畫位移（唔改） |
| `css/components/switch.css:11` | `.switch::before` | `inset: -7px -4px` | 觸控範圍（唔使放大） |
| `css/components/switch.css:22` | `.switch:focus-visible` | `outline: 2px solid var(--gold)` | 線／框／ring（建議唔放大，mockup 冇放大） |
| `css/components/switch.css:22` | `.switch:focus-visible` | `outline-offset: 2px` | 線／框／ring（建議唔放大，mockup 冇放大） |

</details>

