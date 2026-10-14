# 實作計劃：Loading 畫面 + 首次介紹（v2.5.0）

## Context
mockup 方案 B 已定稿（`mockups/v2.2.0/intro-b-cards.html` + `2026-10-13_grill_loading-intro.md`）。要做入 app：每次開 app 出 loading，第一次開出 3 頁介紹，ⓘ 可以重看。

## 已定決定
| 項目 | 決定 |
|---|---|
| Logo 動畫 | 每次隨機：卡片扇 : 進度環 = 3 : 1 |
| 入 app | 等動畫播完：max(boot, 動畫) + 0.3 秒 |
| 首次介紹 | 全部人一次（舊用戶都出），以 `lifeuk.introSeen` 判斷 |
| 「製定溫習計劃」 | 未開計劃就開，再去 goal（已有計劃 → schedule） |
| 測試 | 自動化瀏覽器（`navigator.webdriver`）同 `file://` 唔出 splash／介紹；新功能用 http 專門測（實作時由「只 file://」擴闊到 webdriver，因為 sw-test / pwa-test 用 http） |
| 版本 | 2.5.0 |

## 實作（已完成）
| 檔案 | 內容 |
|---|---|
| `js/core/config.js` | `APP_VERSION 2.5.0`、`INTRO_SEEN_LS`、`SPLASH_WEIGHTS` / `SPLASH_ANIM_MS` / `SPLASH_HOLD_MS` / `SPLASH_FADE_MS` / `SPLASH_MEMO_COUNT` |
| `css/base/tokens.css` | splash / intro tokens（stage、logo、tape、z-index、ease、卡片 radius、edge pad、三個 tint） |
| `index.html` | `#splash` 靜態 markup；ⓘ `.info-replay` 行；新 css / js |
| `js/components/splash.js` + `css/components/splash.css` | 抽動畫、卡片扇（逐張淡出）、進度環（12/3/6/9 點 = 計劃/溫習/練習/考試）、載入字、memo；`finishSplash` 等 boot + 動畫 |
| `js/screens/intro.js` + `css/screens/intro.css` | overlay、3 張卡、散開插畫 + 離邊 20px、dots / swipe / ← → / Esc、語言 + 粵語 switch、CTA |
| `js/main.js` | `startSplash()` / `finishBoot()`、LATE_BOOT、失敗時移除 splash |
| `js/core/actions.js` | `replayIntro`、`introNext` / `introGo` / `introClose` / `introLang` / `introToggleYue`；Esc |
| `js/pwa/pwa.js` | splash / 介紹開住唔 reload |
| `sw.js` | SHELL 加 4 個檔 |
| `locales/*.js` | `splash.*`、`intro.*`、`app.introReplay*` |
| `tests/intro-test.js`、`tests/i18n-test.js`（SECTIONS）、`tests/run-all.sh` | 新 suite |

## 測試（相關 suite，唔跑 full suite）
structure、i18n、sw、pwa、info、upgrade、default-settings、desktop-overlays、header-icons、intro：全部 PASS（2026-10-14）。
