# 架構審計報告（v2：重新審計）

**日期**：2026-10-14 13:40 UTC
**項目**：Life in the UK Test PWA + Vercel usage backend（HEAD `4ef3538` = `origin/main`，PR #145，v2.10.0）
**審計員**：Architect Agent（架構）+ 獨立 Security Agent（`api/` + dashboard 登入）+ main agent（抽查、實跑 test）
**範圍**：完整 codebase
**對比基線**：[`2026-10-14_06-10_audit_full-codebase.md`](2026-10-14_06-10_audit_full-codebase.md)（HEAD `c52527c`，v2.5.2；喺 branch `docs/audit/2026-10-14_codebase-audit`，未 merge）。之後有 56 個 commit，全部係 2026-10-14 同一日，改咗 80 個檔（+3,454 / −411 行）。
**方法**：讀 code、grep、git log；用 mock Redis 跑 handler PoC（Security Agent，只喺 scratchpad，冇對 production 發過 request）；實跑 `tests/run-all.sh`。live 部署狀態因為 proxy 擋住驗證唔到，凡係講 live 嘅地方都標「假設」。

---

## 0. 摘要

- **最大變化**：項目由純 static PWA 變成「PWA + Vercel serverless backend（Upstash Redis）+ 有 owner 登入嘅 dashboard」。部署拓撲由一個 origin 變成兩個（Vercel `life-uk.vercel.app`，加上 GitHub Pages，後者屬假設仍然在線），但冇決策記錄、冇文件。
- **上次 19 項 finding**：1 項已修（AU-019），4 項惡化（AU-001 / 002 / 008 / 014），其餘未修。上次 P0 / P1 建議冇一項落實。
- **新問題**：🔴 1 項（AU-020 雙部署）、🟡 13 項（AU-021–027、SEC-01–06）、🟢 多項。backend 認證寫得穩陣，冇搵到資料外洩，但有兩個低成本 DoS：全局 lockout 可以鎖死 owner（SEC-03），`/api/track` 可以被灌數或者耗盡配額（SEC-01 / 02）。
- **Test**：`run-all.sh` **82 / 82 PASS**（full clone）。

---

## 1. 實測結果：`tests/run-all.sh`（HEAD `4ef3538`，full clone）

| 結果 | 數量 | 備注 |
|------|------|------|
| PASS | **82 / 82** | 全綠；包括新 suite `telemetry-test`、`telemetry-api-test`、`stats-model-test`、`stats-page-test`、`share-test`；`control-icons-test` 已綠（AU-019 ✅ 已確認） |
| FAIL | 0 | full clone 下 `upgrade-test` 都 PASS |
| 副作用 | 18 檔 | 跑完之後 `tests/shot-*.png` 全部變 modified（AU-007 未修），已用 `git checkout` 還原 |

> 注意：呢個結果係 main agent 喺 session 入面手動跑嘅；repo 仍然冇 CI（AU-002），`main` 每次 merge 時係咪綠冇保證。

---

## 2. 上次 finding 追蹤表（AU-001 – AU-019）

| ID | 題目 | 現況 | 證據 |
|----|------|------|------|
| AU-001 | 舊 cache 混版相容層累積 | 🔺 惡化 | `typeof` guard 由 73 增至 **78**（同一條 regex）。新 guard：`js/core/telemetry.js:9,50`、`js/main.js:149`、`js/pwa/pwa.js:74`、`js/components/popover.js`（commit `d9f62ce`、`82ceeba`）。`LATE_BOOT_SCRIPTS` 仍然 18 項，冇 `?v=` |
| AU-002 | 冇 CI | 🔺 惡化 | 仍然冇 `.github/`。Vercel Git auto-deploy（假設）令 `api/*` 都冇 gate 就上 production |
| AU-003 | 版本 / ID 撞號 | ❌ 未修 | 同日再撞：`c85b143`「usage counter ships as v2.8.0 (main took v2.7.0 …)」。`APP_VERSION` 改動 commit 由 57 增至 65 |
| AU-004 | Global namespace | ❌ | `js/domain/questions.js:116` 仍然讀 `state.mode`；layering guard 仍然只守 `plan*.js` |
| AU-005 | 大檔 | ❌ | `quiz.js` 615、`planProgress.js` 559、`planRun.js` 558 行；js 總數 7.8k → 8,452 行 |
| AU-006 | `setLS` 吞錯 | ❌，影響擴大 | `utils.js:282-284` 冇變；telemetry 嘅 dau 去重依賴佢（`telemetry.js:38`），見 AU-025 |
| AU-007 | Test 改寫 tracked png | ❌ | 18 張 `tests/shot-*.png` 仍然 tracked；commit `c36d58f`「keep test screenshots as on main」證明又出現過；今次實跑一樣 |
| AU-008 | 文件債 | 🔺 惡化 | `HANDOFF.md` 345KB → 357KB，**停喺 v2.7.0，`grep -ci vercel` = 0**，仍然寫 Live = Pages；`.git` 113MB → 122MB |
| AU-009 | file list 多處維護 | ❌，再擴大 | 多咗 `stats.html:216-218` 同 `.vercelignore` 兩份 |
| AU-010 | 冇 `.nojekyll`、Pages 公開雜物 | ❌，範圍擴大 | 而家連 `api/*.js` 原始碼都公開（見 AU-026） |
| AU-011 | `escapeHtml` 缺 `'` | ❌ | `utils.js:290-292` 冇變；`statsPage.js` 嘅 `tr()` 同樣唔 escape |
| AU-012 | 搜尋冇 debounce | ❌ | `study.js:104` |
| AU-013 | resize 唔一致 | ❌ | `fitRow.js:36`、`popover.js:63`、`intro.js:353`（新寫嘅 `statsPage.js:309` 有 debounce） |
| AU-014 | 開機同步載入大量 data | 🔺 輕微 | `data/` 490KB → 544KB（20 份試卷、480 題）；script 46 → 48 個 |
| AU-015 | LS 冇 schema version | ❌ | 新 key `telemetryDay`、`statsLang` / `statsRange` / `statsAuth` 都冇 version，而且後三個唔喺 `config.js` |
| AU-016 | 題目用位置 key | ❌ | Exam 18–20 沿用 `"exam.idx"` |
| AU-017 | 冇 axe-core | ❌ | — |
| AU-018 | `ACTIONS` 大 object | ❌ | 126 行 |
| AU-019 | `control-icons-test` 紅 | ✅ 已修 | v2.6.3 `42d2763`：`index.html:85` 改用 `data-icon="play"`；實跑結果見 §1 |

---

## 3. 項目概覽

- **類型**：離線 PWA（vanilla JS，冇 build），加細型 serverless backend（Vercel Functions + Upstash Redis），收匿名使用計數，再加 owner-only dashboard `/stats.html`
- **用途**：Life in the UK 考試練習。有 20 份試卷 / 480 題、235 個 fact、記憶法、溫習計劃；en / zh-HK 雙語，加廣東話翻譯
- **狀態**：Active，開發速度極快（一日 56 commit，v2.5.2 → v2.10.0）
- **規模**：js 8,452 行；`data/` 544KB；82 個 test suite；`.proj-docs` 97MB；`.git` 122MB
- **部署拓撲**：
  - **Vercel `life-uk.vercel.app`**：已核實。commit `e46d41e`「Vercel config for parallel deployment」；`og:url` 指去 Vercel（`index.html:10,13`）；telemetry 只喺呢個 host 報數（`config.js:69`）
  - **GitHub Pages `dcwhung.github.io/life-in-uk-test/`**：假設仍然 live。code 仍然刻意兼容（`telemetry.js:6,47-48`），HANDOFF 仍然話 live 喺 Pages
  - 即係 `main` 一個 push 會部署去兩個 origin，冇 test gate

---

## 4. Tech Stack

| 層級 | 技術 | 版本 | 備注 |
|------|------|------|------|
| Frontend | Vanilla JS classic `<script>`（global scope） | — | `index.html` 48 個 script；`stats.html` 另外 3 個 |
| Styling | 純 CSS + tokens | — | 25 個 `<link>`；`stats.html` 用 inline `<style>`，色值抄自 tokens |
| i18n | `t()` + `locales/en.js` / `zh-HK.js`；dashboard 用另一套 `tr()` + `locales/stats.js` | — | 兩套獨立機制 |
| Data | `data/*.js` global 常數 | — | 544KB |
| Client storage | `localStorage`（`lifeuk.`）+ `sessionStorage`（`lifeuk.statsAuth`） | — | 每個 origin 各一份 |
| Offline | Service Worker cache-first | 2.10.0 | cache 名跟 `APP_VERSION` |
| Backend | Vercel Serverless Functions（Node，CommonJS，零 npm 依賴） | Node 版本**冇 pin** | `api/track.js`、`api/stats.js`、`api/_lib/*` |
| Data store | Upstash Redis REST `/pipeline` | Free plan（500k 個 command / 月） | 3 秒 timeout |
| Analytics | 自家 counter + Vercel Web Analytics（runtime 注入） | v2.10.0 | 只限 Vercel host |
| 測試 | Playwright（`playwright-core`）+ node vm / fake Redis | — | 82 個 suite（新加 telemetry / telemetry-api / stats-model / stats-page / share） |
| CI/CD | **無 CI**；Vercel Git auto-deploy（假設）+ Pages branch deploy（假設） | — | 冇 preview / prod 文件 |
| Config | `vercel.json`（headers）、`.vercelignore` | — | 只有 `/stats.html` 有 CSP |

---

## 5. 目錄結構

| 路徑 | 職責 | 規模 / 備注 |
|------|------|------|
| `index.html` | App shell，10 個 screen | 37KB，**冇 CSP** |
| `stats.html` | Owner dashboard（CSP meta、noindex、inline style） | 220 行 |
| `api/track.js` | `POST /api/track` 使用量 beacon | 55 行 |
| `api/stats.js` | `GET /api/stats`，Basic auth 後讀數 | 163 行 |
| `api/_lib/redis.js` / `events.js` | Upstash client、event 名同 key schema | 32 / 18 行 |
| `js/core/` | config、utils、i18n、store、actions、**telemetry** | 6 檔 |
| `js/domain/` | questions、mastery、similar、plan、planProgress、memo | 6 檔 |
| `js/components/` | 13 檔（新加 `share.js`） | — |
| `js/screens/` | 15 檔 | `quiz.js` 615 行最大 |
| `js/stats/` | `statsModel.js`（純函數）、`statsPage.js`（DOM、auth、SVG） | 400 行，唔屬於 app runtime |
| `locales/stats.js` | Dashboard 字串 | 51 行 |
| `tests/` | 82 個 suite + 18 張 tracked png | 3.3MB |
| `mockups/` | 設計稿 | 3.3MB |
| `.proj-docs/` | reviews / qa / plans / deploys / audits | 97MB |
| `HANDOFF.md` | 交接文件 | 357KB，**停喺 v2.7.0** |

---

## 6. 架構分析

### 整體架構模式
- **Client**：沿用分層 global-script（data → core → locales → i18n → store → domain → components → screens → actions → telemetry → pwa → main），冇變。
- **Backend**：「thin function + shared lib」，每個 route 一個檔，`_lib/` 共用（`_` 開頭唔會變成 route）。冇 framework 或 middleware，auth、rate limit、budget 都寫喺 handler 入面。以呢個規模嚟講合適。
- **Dashboard**：獨立 static page，同 app 同 origin 但唔共用 runtime。`fetch /api/stats?days=all` 讀一次，之後喺 client 切換時間範圍。

### 前後端 Contract

| Contract | Client | Server | 守護 |
|----------|--------|--------|------|
| Event 名 | `TELEMETRY_EVENTS`（`config.js:72`） | `EVENTS`（`api/_lib/events.js:5`） | `telemetry-test` ✅ |
| Allowed host | `TELEMETRY_HOST`（`config.js:69`） | `ALLOWED_ORIGIN`（`track.js:11`） | `telemetry-test` ✅ |
| Beacon body | `{events:[…]}` text/plain | `parseEvents`（最多 10 個） | `telemetry-api-test`（fake req）✅ |
| Stats response | `statsModel` 讀 `{launch, days[], totals}` | `buildReport`（`stats.js:122-133`） | mock test；冇 schema version |
| CSP | `stats.html:9` meta | `vercel.json` header | `stats-page-test:163-169`（S-288）✅ |
| Endpoint path | `/api/track`、`/api/stats`（**絕對路徑**） | Vercel root | Pages 子路徑下會打錯 host（AU-024） |

### Telemetry / Dashboard 數據流

```
app launch (main.js:149 reportLaunch)
  ├─ typeof guard（舊 cache）→ host gate（只限 life-uk.vercel.app）→ offline 唔送
  └─ sendBeacon('/api/track') ─(經 SW fetch handler)→ Vercel fn
         ├─ method / Origin（可以偽造）/ body 驗證
         ├─ INCR lifeuk:budget:<UTC日>  > 4000 → 204 但唔計
         └─ pipeline INCR lifeuk:<event>:<UTC日>
loadVercelAnalytics → 注入 /_vercel/insights/script.js（同 host gate，唔喺 SW SHELL）
stats.html → sign-in → sessionStorage 存 Basic header → GET /api/stats?days=all
         ├─ 冇 creds → 401（StatsBasic scheme，唔會彈 dialog）
         ├─ INCR+EXPIRE lifeuk:authfail:<UTC小時>  > 10 → 429（全局，唔分 IP）
         ├─ sha256 + timingSafeEqual 驗 user + password
         └─ MGET → JSON，no-store
```

### 依賴關係
- Backend 同 frontend 喺 code 層面冇互相 import，contract 靠兩邊常數加 test 對比，做法正確。
- `js/stats/*` 受 structure-test 嘅 function 長度規則覆蓋；`stats.html` 嘅 inline style / 色值，同埋 `api/` 全部，**唔喺 structure-test 範圍**。
- SW scope `./` 會攔截 `stats.html`、`/api/*`、`/_vercel/*`。

---

## 7. API 結構

| Method | Endpoint | 說明 | 認證 | 回應 |
|--------|----------|------|------|------|
| POST | `/api/track` | Usage beacon `{events:[open\|standalone\|dau\|install]}`，最多 10 個，只計已知 event | 冇 auth；`Origin === https://life-uk.vercel.app` 過濾（`track.js:32`，可以偽造）；全局每日 4,000 request budget（`:15`） | 204 / 400 / 403 / 405 / 500 / 502 |
| GET | `/api/stats?days=all\|N` | Owner 讀數，N 限 1–730 | Basic（`STATS_USERNAME` / `STATS_PASSWORD` env），sha256 + `timingSafeEqual`；全局每小時 10 次嘗試，超過就 429 | 200 JSON（no-store）/ 401 / 405 / 429 / 502 |
| GET | `/_vercel/insights/*` | Vercel Web Analytics（平台提供） | — | 平台控制 |

---

## 8. 數據結構

### localStorage / sessionStorage（新增部分，其餘同上次）

| Key | Storage | 用途 | 定義位置 | Version |
|-----|---------|------|----------|---------|
| `lifeuk.telemetryDay` | LS | 最後一次送 dau 嘅 UTC 日 | `config.js:108` | 無 |
| `lifeuk.statsLang` / `statsRange` | LS | Dashboard 偏好 | `statsPage.js:9-10`（唔喺 `config.js`） | 無 |
| `lifeuk.statsAuth` | sessionStorage | `Basic base64(user:password)` | `statsPage.js:8` | 無 |

### Redis（Upstash）key schema

| Key | 類型 | 寫入 | TTL | 讀取 |
|-----|------|------|-----|------|
| `lifeuk:{open\|standalone\|dau\|install}:YYYY-MM-DD` | counter | `track.js:45` | 無（每日 4 個 key） | `stats.js:152-153` MGET |
| `lifeuk:budget:YYYY-MM-DD` | counter | `track.js:43` | 無 | **冇地方讀** |
| `lifeuk:authfail:YYYY-MM-DDTHH` | counter | `stats.js:145` INCR + EXPIRE；登入成功就 DECR | 1 小時 | `stats.js:146` |

---

## 9. 發現問題

### 🔴 Critical（架構級問題，必須處理）

#### [AU-020] 雙部署（Vercel + GitHub Pages）冇決策、冇文件，用戶同數據被分成兩份
- **位置**：`index.html:10,13`（og 指 Vercel）；`js/core/config.js:69,86`；`js/core/telemetry.js:5-6,46-48`；`sw.js:9`；`HANDOFF.md:3-7`；`.vercelignore`；冇 `.nojekyll`；`js/components/share.js:8-10`
- **描述**：同一個 `main` 部署去兩個 origin（Pages 屬假設）。兩邊嘅 HTTP cache 行為、公開範圍、header 都唔同。telemetry 只數 Vercel，所以 Pages 用戶冇計入。localStorage 按 origin 分開，用戶轉 host 就會「冇咗」全部進度，又冇匯出 / 匯入。
- **影響**：(1) 使用量被低估；(2) AU-001 shim 嘅根源（Pages `max-age=600`）一日唔消失，shim 就刪唔走；(3) 每個 feature 都要兼容兩個環境（例如 v2.10.0 要將 Analytics 改成 runtime 注入）；(4) 用戶進度分裂。
- **建議**：
  - **方案 1（推薦）：Vercel 做唯一 production，Pages 退役**，換成「已搬家」頁，加一次性進度匯出 / 匯入（1–2 日）。好處：AU-001 / 010 / 024 / 026 嘅根源一齊消失。代價：已安裝 Pages PWA 嘅用戶要手動搬一次。
  - **方案 2：正式化並存**：寫 deploy matrix，Pages 改用 Actions 只部署 runtime 檔，telemetry 加 host 維度。代價：兼容成本永久存在，仲要處理 CORS。
  - **方案 3：custom domain，兩邊都 redirect 過去**。最乾淨，但要用戶決定買唔買 domain。
  - **需要用戶決策。**

#### [AU-002 升級] Backend 上線，仍然冇 CI
- 一次錯誤 merge 而家可以令 `/api/track` 500，或者燒晒 Upstash 配額。
- **建議**：方案 1：GitHub Actions 跑 `run-all.sh`（`fetch-depth: 0`；node-only suite 幾秒跑完），加 branch protection，`api/**`、`vercel.json` 加 CODEOWNERS。方案 2：再加 Vercel「Ignored Build Step」或者 Actions 成功後先 `--prod`（要喺 GitHub secret 放 Vercel token）。建議先做方案 1。

### 🟡 Warning（設計問題，建議處理）

#### [SEC-03] 全局登入 lockout：任何人每個鐘送 11 個 request 就鎖死 owner
- **位置**：`api/stats.js:23,31,84-93`
- **描述**：lockout key `lifeuk:authfail:<hour>` 係全局，唔分 IP。任何格式啱嘅 Basic header 都會 INCR。PoC 送 11 個 `foo:bar` 之後，owner 用啱嘅密碼都收到 429。
- **攻擊路徑**：每小時第 0 分鐘 `curl -H 'Authorization: Basic Zm9vOmJhcg==' …/api/stats` × 11，一日 264 個 request 就可以令 owner 永久登入唔到。
- **影響**：dashboard 用唔到（冇資料外洩）。code comment 寫明係 accepted trade-off，但成本極低。
- **建議**：方案 1：per-IP-hash（短 TTL）每小時 5 次，加一個較高嘅全局上限（例如 100）。方案 2：登入成功後發 HttpOnly device token，帶 token 嘅 request 唔受全局 lockout 影響。方案 3：Vercel Firewall IP allowlist 或 Deployment Protection（可能要付費）。

#### [SEC-01] `/api/track` 可以被灌假數據，真實數據靜靜雞流失
- **位置**：`api/track.js:11,15,32,43-45`
- **描述**：Origin 只係過濾，curl 可以偽造。PoC 送 4,005 個 request，全部 204，計數被灌到 4,000 個 budget 上限。之後嘅真實 beacon 一樣回 204 但唔計，`lifeuk:budget:*` 亦冇地方讀，所以 dashboard 睇唔出。
- **建議**：方案 1：dashboard 顯示 budget 用量並標記封頂日。方案 2：Vercel WAF per-IP rate rule，並喺 repo 記錄（code comment 提到 Firewall rule，但 repo 冇證據證明已設定）。方案 3：用 HMAC(IP, 每日 salt) `SET NX` 做 dau 去重（私隱要另外講清楚）。

#### [SEC-02] Upstash 用量 / 成本 DoS
- **位置**：`api/track.js:43-44`
- **描述**：budget 用完之後，每個 request 仍然做 1 個 INCR。每秒 20 個 request 一日已經約 170 萬個 command，超過 free plan 每月 500k，之後 track 同 stats 一齊 502（假設超額會被 reject），dashboard 成個月用唔到。
- **建議**：方案 1：Vercel WAF 喺 edge 擋（唔使 invoke function）。方案 2：用 module-level flag 喺 warm instance 短路。方案 3：stats 唔再用 Redis 做 lockout（只能部分緩解）。

#### [SEC-04] 可還原嘅密碼長期存喺 sessionStorage
- **位置**：`js/stats/statsPage.js:4,229,241,280`
- **描述**：`Basic base64(user:pass)` 冇過期，server 端亦冇 revoke。同一個 tab 返去 app 之後，同 origin 嘅 script 都讀得到。app 冇 CSP（AU-022），所以 app 有 XSS 就可以偷到明文密碼。
- **建議**：方案 1：登入後換一個短期 HMAC token，放 `HttpOnly; Secure; SameSite=Strict; Path=/api/stats` cookie。方案 2：credential 只放 JS memory（reload 要重新登入）。方案 3：dashboard 搬去獨立 origin。

#### [AU-021] Backend / ops 冇 runbook
- **位置**：`api/_lib/redis.js:3-11`、`api/stats.js:58,102-103`、`track.js:12`、`config.js:74`；`HANDOFF.md` 冇提過 Vercel
- **描述**：env 存喺 Vercel，做法正確；repo 冇 `.env`（已核實）。但冇記錄 env scope、輪換程序、Firewall rule 有冇設定。如果 Preview 環境共用 Production env（Vercel 預設三個 scope 都勾，假設），每個 PR 嘅 preview URL 都會有一個讀到 production 數據嘅 `/api/stats`。Node runtime 亦冇 pin。
- **建議**：方案 1：寫 `docs/ops.md`（env 表、scope、輪換、Firewall、配額監控、rollback），並將 `STATS_*` 同 Redis env 限定喺 Production scope。方案 2：再加 `api/health` endpoint。建議先做方案 1。

#### [AU-022 / SEC-05] App 主頁冇 CSP 同 security header
- **位置**：`index.html:1-45`；`vercel.json:2-20` 只覆蓋 `/stats.html`
- **描述**：上次已經建議，未做。app 同 dashboard 同 origin，app 有 XSS 就會波及 SEC-04 同 SEC-09。
- **建議**：方案 1：`index.html` 加 meta CSP（Pages 同 Vercel 都生效）：`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'`。再喺 `vercel.json` 加 `/(.*)` header：nosniff、`frame-ancestors 'self'`、`Referrer-Policy: strict-origin-when-cross-origin`（**唔好用 no-referrer**，否則 beacon 嘅 Origin 會變 `null`，track 全部 403）、Permissions-Policy，並加一致性 test。方案 2：只加 header（Pages 冇保護）。

#### [AU-023 / SEC-06] Telemetry / Analytics 冇私隱聲明、冇 opt-out
- **位置**：`js/core/telemetry.js:25-27,38,49-56`；locale / `index.html` 冇任何私隱字眼
- **描述**：數據已經最小化（冇 id、冇 IP、cookieless）。但 Vercel Analytics 收集 path、referrer、國家、browser 等；裝置會寫 `telemetryDay`；亦唔理 GPC / DNT。UK PECR / GDPR 要求清楚資訊同簡單反對方法（法律判斷屬假設）。
- **建議**：方案 1：⚙ / info 加兩種語言嘅私隱說明，加「唔參與統計」開關（telemetry 同 Analytics 都 check），並尊重 `navigator.globalPrivacyControl`。方案 2：只加靜態說明。建議方案 1（約 0.5–1 日）。

#### [AU-024] Pages 版 dashboard 會將 credentials 送去錯誤 host
- **位置**：`js/stats/statsPage.js:7,229`
- **描述**：用絕對路徑 `/api/stats`。喺 Pages 子路徑下，會打去 `dcwhung.github.io/api/stats`，Basic credentials 會送去唔屬於呢個 app 嘅 URL。
- **建議**：方案 1：非 `life-uk.vercel.app` host 就唔顯示登入（0.25 日，即刻做）。方案 2：Pages 部署排除 `stats.html`、`js/stats`、`api/`（隨 AU-020 處理）。

#### [AU-025] 使用數據準確度有盲點
- **位置**：`track.js:43-44`（封頂後冇 signal）；`telemetry.js:25`（offline 時 `open` 永久遺失）；`utils.js:282` + `telemetry.js:37-38`（setLS 失敗時每次開 app 都報 dau）；Vercel Analytics 同自家 counter 冇定義邊個係 SSoT
- **建議**：方案 1：`/api/stats` 回傳 `capped` 標記；離線 open 累積到下次 online 先送（要改 contract）。方案 2：dashboard 加注腳講明偏差，並定義 counter 係 SSoT。建議先做方案 2 加封頂標記。

#### [AU-026] Pages 部署公開 backend 原始碼同 repo 雜物（AU-010 擴大）
- `api/*.js`（包括 lockout 規則）、`stats.html`、`mockups/`、`tests/`、`HANDOFF.md` 喺 Pages 都公開（假設 Pages 仍然 live）。冇 secret，但係唔必要嘅暴露。同 AU-020 一齊處理；`.vercelignore` 同 Pages 排除清單要合併成一個 SSoT。

#### [AU-027] 交付節奏同品質閘門唔匹配
- 一日 56 個 commit，包括加 backend 同 auth，都冇 CI 或者強制 security review。同日再撞版本號（AU-003）。
- **建議**：凡係改 `api/`、`vercel.json` 嘅 PR，強制 CI 綠燈 + security review（CODEOWNERS + branch protection）。

### 🟢 Observation（可改善點）

| ID | 位置 | 觀察 | 建議 |
|----|------|------|------|
| SEC-07 | `api/stats.js:23,46-53` | 每小時 10 次，一年約 87,600 次嘗試，安全性完全靠密碼強度 | 文件要求 ≥ 20 字隨機密碼；server 拒絕過短嘅 env |
| SEC-08 | `js/stats/statsModel.js:52` | `{ key: r.date, ...r }` 會俾 row 自帶嘅 `key` 覆蓋已驗證嘅 date，然後經 `innerHTML` 輸出（要 API 先被入侵；CSP 擋 inline script） | 改做 `{ ...r, key: r.date }`，或者只抽取已知欄位 |
| SEC-09 / AU-028 | `sw.js:103-112` | SW cache-first 回應 `lifeuk-v*` cache 入面**任何** URL；app XSS 可以 `caches.put` 一個惡意 `statsPage.js`，持久偷密碼；`POST`、`/api`、`/_vercel` 都經 cache 層；stats.html 離線時 fallback 去 app | handler 開頭：non-GET、`/api/`、`/_vercel/`、`stats.html` 直接 return；只對 SHELL URL 用 cache |
| SEC-11 | `vercel.json:12-19` | stats.html 缺 nosniff、Permissions-Policy、COOP；`style-src 'unsafe-inline'` | 補 header；CSS 抽出去 |
| SEC-12 | `js/stats/statsPage.js:23,316` | `statsLang = "__proto__"` 會令 `tr()` throw，dashboard 白屏（同源 self-DoS） | 用 `Object.hasOwn` |
| SEC-13 | `api/track.js:33` | `parseEvents(req.body)` 喺 try 外面；冇自訂 body 大小上限 | 包入 try，或者 `content-length` > 1KB 就回 413 |
| AU-029 | `stats.html` | Dashboard 係第二套 UI 系統（`tr`、`byId`、抄過嚟嘅色值），structure-test 冇覆蓋 | 明確列為例外，或者 CSS 抽成 `css/stats.css` |
| AU-030 | `api/` | 唔喺 structure-test 範圍 | 加入 function 長度檢查 |
| AU-031 | `track.js:43` | `lifeuk:budget:*` 冇 TTL | `EXPIRE` 2 日 |
| AU-032 | `stats.js:122-133` | response 冇 schema version，依賴 `days[]` 次序 | 改 contract 時兩邊同步 |
| AU-033 | `stats.js:71` | `LAUNCH_DATE` 寫死 | 記錄即可 |

**做得好嘅地方**：
- backend 零 npm 依賴
- `timingSafeEqual` 前先做等長 sha256 digest，user 同 password 兩個都一定會比較，所以冇帳號枚舉
- env 未設定就 fail closed（401）
- 用 `StatsBasic` scheme，瀏覽器唔會彈原生 dialog
- lockout 用 INCR 先佔位，parallel burst 拎唔到額外次數，而且有 test
- Redis key 全部由 server 組成（event 白名單、server 時鐘、`days` 夾喺 1–730），冇 key injection
- error 唔洩露 stack trace；status code 語意正確；`Cache-Control: no-store`
- 冇 CORS header；冇 cookie，所以冇 CSRF 面
- repo 同 git 歷史都冇真 secret（Security Agent `git log --all -p` 已核實）
- 前後端 event 名、CSP meta 同 header 都有 contract test
- telemetry 有 host gate，冇送 id / UA / 時間戳
- dashboard 嘅 SVG 用 `textContent` / `setAttribute` 砌

---

## 10. 技術債評估

| 類別 | 程度 | 描述 | 對比上次 | 預計處理成本 |
|------|------|------|----------|-------------|
| 代碼質量 | 中 | function 短、backend 乾淨；guard 78 個、global 污染、大檔、dashboard 自成一套 | ↘ 稍差 | 3–5 日 |
| 測試覆蓋 | 中（覆蓋）／低（基建） | 新加 5 個 suite，包括 API handler test；但冇 CI、tracked png | → | 1.5–2 日 |
| 文件完整性 | **高** | HANDOFF 357KB，而且停喺 v2.7.0；backend / ops / env 零記錄 | ↗ 惡化 | 1.5–2 日 |
| 安全性 | 中 | 有 auth endpoint + 公開寫入 endpoint；兩個 DoS；app 冇 CSP；密碼存 sessionStorage | ↗ 上升 | 1.5–2 日 |
| 性能 | 低至中 | data 544KB；搜尋冇 debounce | → | 0.5–1 日 |
| 依賴更新 | 低 | 零 npm 依賴；Node 未 pin | → | 0.1 日 |
| 流程 / 發佈 | **高** | 雙部署冇決策；冇 CI；同日再撞版本號 | ↗ 惡化 | 2–3 日 |
| 私隱 / 合規 | 中 | 數據已最小化，但冇聲明、冇 opt-out | 新 | 0.5–1 日 |

---

## 11. 建議方向

### 方案 A：漸進修復，先處理部署拓撲同流程
- **適用情況**：功能成熟；用戶有已安裝 PWA 同本地進度；backend 細而乾淨
- **預計工作量**：約 9–12 個工作日（上次 6–9 日，加 backend / 部署 / 私隱 / SEC 約 3 日）
- **優點**：保留 structure-test、content-guard、migration、API handler 等 test 資產；Pages 退役之後 AU-001 嘅 shim 可以一次清走
- **缺點**：global script 架構嘅限制仍然存在

### 方案 B：重建（Vite + TS + ES modules，API 共用型別）
- **適用情況**：計劃做帳號、雲端進度、多題庫
- **預計工作量**：約 5–7 週
- **優點**：hashed asset 解決混版；前後端共用型別；domain 可以做 unit test
- **缺點**：要加 build step；localStorage 一定要 100% 相容；以而家嘅開發速度，平行重寫衝突成本極高；而家 backend 只係計數器，未構成重建理由

### 推薦
**方案 A。** 今次最重要嘅變化唔係 code，而係部署拓撲。先決定 AU-020（推薦 Vercel 做唯一 production），再落 CI（AU-002），然後處理兩個低成本 DoS（SEC-03 / SEC-01–02）。之後 AU-001 / 010 / 024 / 026 好多會自動消失或者簡化。

---

## 12. 下一步建議

| 優先級 | 行動 | 對應 | 負責 Agent | 預計工作量 |
|--------|------|------|-----------|-----------|
| P0 | **用戶決策**：Pages 退役定並存；退役就做「已搬家」頁 + 進度匯出 / 匯入 | AU-020 / AU-026 | PM + Architect；Frontend Developer | 0.5 + 1–2 日 |
| P0 | GitHub Actions 跑全套 test（`fetch-depth: 0`）+ branch protection + `api/**` CODEOWNERS | AU-002 / AU-027 | DevOps | 1 日 |
| P0 | 登入 lockout 改 per-IP-hash + 全局上限（或者 owner bypass） | SEC-03 | Backend Developer | 0.5 日 |
| P0 | Vercel WAF rate rule 擋 `/api/track` 並喺 repo 記錄；dashboard 顯示 budget 封頂 | SEC-01 / SEC-02 / AU-025 | DevOps + Backend Developer | 0.5–1 日 |
| P0 | `stats.html` 喺非 production host 停用登入 | AU-024 / SEC-10 | Frontend Developer | 0.25 日 |
| P0 | 核實 Vercel env scope（只限 Production）、Firewall、Deployment Protection；寫 `docs/ops.md` | AU-021 | DevOps | 0.5–1 日 |
| P1 | Dashboard credential 改短期 HttpOnly token（或者只放 memory） | SEC-04 | Backend + Frontend Developer | 0.5–1 日 |
| P1 | `index.html` meta CSP + `vercel.json` 全站 header + 一致性 test | AU-022 / SEC-05 / SEC-11 | Frontend Developer | 0.5 日 |
| P1 | SW 只對 SHELL 用 cache；bypass non-GET、`/api/`、`/_vercel/`、stats | SEC-09 / AU-028 | Frontend Developer | 0.25 日 |
| P1 | 私隱說明 + opt-out（尊重 GPC），加 locale key | AU-023 / SEC-06 | PM + Frontend Developer | 0.5–1 日 |
| P1 | 版本號 / review ID 改為 merge 時分配 | AU-003 | PM + DevOps | 1 日 |
| P1 | 拆 HANDOFF，補 v2.8.0–v2.10.0 同 Vercel，更正 Live URL | AU-008 / AU-021 | PM | 1–1.5 日 |
| P1 | （Pages 退役後）cache-busting + 相容窗口，刪 v2.0 之前嘅 shim | AU-001 / AU-009 | Architect + Developer | 2–3 日 |
| P1 | Test 截圖改寫入 gitignore 目錄 | AU-007 | QA | 0.5 日 |
| P1 | `setLS` 回傳 boolean + warn / toast；telemetry 只喺寫入成功時先當 dau 已送 | AU-006 / AU-025 | Developer | 0.5 日 |
| P2 | `toDays` spread 次序、`Object.hasOwn`、`parseEvents` try + body 上限、budget key TTL、pin Node | SEC-08 / 12 / 13、AU-031 | Backend + Frontend Developer | 0.5 日 |
| P2 | structure-test 覆蓋 `api/`；`stats.html` CSS 抽出 | AU-029 / AU-030 | Developer | 0.5 日 |
| P2 | Domain layering guard 擴大，修 `questions.js:116` | AU-004 | Developer | 0.5 日 |
| P2 | 上次其餘 P2（拆大檔、LS schema、debounce / throttle、`escapeHtml`、axe、穩定題目 id、`.proj-docs` 瘦身） | AU-005 / 011–018 | 各 agent | 約 6–8 日 |

---

## 13. 安全配置審計結果

| 類別 | 項目 | 狀態 | 風險 | 建議 |
|------|------|------|------|------|
| HTTP Headers | `stats.html` CSP / frame-ancestors / X-Robots / Referrer | ✅ meta 同 header 一致（S-288 有 test） | 🟢 | 去掉 `style-src 'unsafe-inline'`（可選） |
| HTTP Headers | `stats.html` nosniff / Permissions-Policy / COOP | ❌ 缺 | 🟢 | SEC-11 |
| HTTP Headers | `index.html` 及全站 CSP / XFO / nosniff / Referrer-Policy | ❌ 完全冇 | 🟡 | AU-022 / SEC-05 |
| HTTP Headers | HSTS | ⚠️ 假設由 Vercel 預設提供 | 🟢 | owner 用 `curl -I` 確認 |
| CORS | `/api/track`、`/api/stats` | ✅ 冇 ACAO；跨 origin 帶 `Authorization` 會 preflight 失敗 | 🟢 | 維持 |
| CORS / CSRF | Cookie | ✅ 冇 cookie | 🟢 | 改用 cookie 時要 `SameSite=Strict` |
| 端點暴露 | `/api/stats` 未登入 | ✅ 401，冇資料 | 🟢 | — |
| 端點暴露 | `/api/track` 匿名寫入 | ⚠️ Origin 可以偽造 | 🟡 | SEC-01 / 02 |
| 端點暴露 | `api/_lib/*` | ✅ 唔係 route | 🟢 | — |
| 端點暴露 | GitHub Pages 鏡像 | ⚠️ `stats.html`、`api/` 原始碼、tests、docs 公開；credentials 會送錯 host | 🟡 | AU-020 / 024 / 026 |
| 端點暴露 | Error response | ✅ body 空，冇 stack trace | 🟢 | — |
| 依賴庫 | npm | ✅ 冇 `package.json` / 冇依賴 | 🟢 | pin `engines.node`（可選） |
| 依賴庫 | Vercel Analytics script | ⚠️ 同源 platform script，冇 SRI | 🟢 | 接受；要喺私隱說明披露 |
| SSL / TLS | HTTPS / 憑證 | ✅ Vercel / GitHub 管理（假設） | 🟢 | — |
| Rate Limiting | `/api/track` | ⚠️ 只有全局每日 budget；Firewall rule 冇證據 | 🟡 | SEC-01 / 02 |
| Rate Limiting | `/api/stats` 登入 | ⚠️ 全局每小時 10 次，可以被人鎖死 owner；回 429 + `Retry-After`（正確） | 🟡 | SEC-03 |
| Secrets | Redis token、`STATS_*` | ✅ 只喺 Vercel env；repo 同歷史都冇；⚠️ scope / 輪換冇文件 | 🟡 | AU-021；密碼 ≥ 20 字 |
| Secrets（client） | Dashboard credential | ⚠️ 可還原嘅 Basic 存 sessionStorage | 🟡 | SEC-04 |
| SW | Cache 策略 | ⚠️ cache-first 回應任何 own-cache URL；API 請求都經過 cache 層 | 🟢 | SEC-09 / AU-028 |
| 私隱 | 收集範圍 / 同意 | ✅ counter 冇 PII；⚠️ Analytics 同平台 log 有衍生資料；❌ 冇聲明、冇 opt-out | 🟡 | AU-023 / SEC-06 |

**未能驗證（全部屬假設，需要 owner 喺 Vercel / GitHub console 核實）**：
- Pages 係咪仍然 live
- Vercel env scope、Firewall rule、Deployment Protection
- HSTS / redirect 行為
- Upstash 超額之後嘅行為
- `@vercel/node` 處理壞 JSON body 嘅行為
- repo 係咪 public
