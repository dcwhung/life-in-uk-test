# 設定教學 — Vercel Firewall：`/api/track` 每個 IP 限速（SEC-01 / SEC-02）

**日期**：2026-10-14
**對象**：project owner（要喺 Vercel dashboard 手動做，code 做唔到）
**相關 code**：`api/track.js`（每日 request budget + warm instance 短路）、`api/stats.js` / `stats.html`（封頂日提示）

> ⚠️ 寫呢份文件嘅時候**冇網絡驗證過 Vercel dashboard**。下面所有 UI 字眼（menu 名、掣名、欄位名、選項名）都係參考，**以 Vercel dashboard 實際顯示為準**。如果名稱唔同，搵意思最接近嘅選項。

## 點解要做

`/api/track` 冇登入（app 用 `sendBeacon` 匿名送），`Origin` 檢查只係 filter，`curl` 一樣偽造到。Code 入面已經有兩層保護：

1. **每日 budget**（`DAILY_REQUEST_BUDGET` = 4000 個 request / UTC 日）：超過就照回 204 但唔計數，數字唔會俾人灌大。
2. **短路**（SEC-02）：同一個 warm instance 知道今日 budget 用完之後，唔再 call Redis。

但係兩樣都**唔可以分辨真用戶同攻擊者**：有人一日灌 4000 個 request，之後當日嘅真 beacon 全部唔計（dashboard 會顯示「呢段時間有 N 日去到每日上限，嗰日嘅數字可能偏低」提示，字眼見 `locales/stats.js` `cappedOne` / `cappedMany`，見 SEC-01）。而 cold start / 平行 instance 仍然要 INCR 一次先知道封頂，所以持續 flood 仍然會用少量 Upstash command。

**Per-IP rate limit 喺 request 去到 function 之前擋**，俾擋嘅 request 唔使 function 同 Redis 做嘢，亦令單一 IP 灌滿全日 budget 要慢好多（每分鐘一條 rule 仲灌得滿，要加埋每小時嗰條先灌唔滿，見下面計數）。呢個只可以喺 Vercel Firewall 設定。

## 建議數值點計

- App 每次開（page load）送 **1 個** beacon（`js/core/telemetry.js` `reportLaunch`），第一次安裝再多 **1 個**（`reportInstall`）。
- 正常人一分鐘內開幾次 app 已經好多；同一個家庭 / 公司 Wi-Fi 共用一個 IP，都好少一分鐘超過幾個。
- **Rule 1（保留）：每個 IP 每 60 秒最多 10 個 request**。即係一個 IP 一日最多 10 × 60 × 24 = 14,400 個，**單一 IP 仍然灌得滿 4000 budget**：4000 ÷ 10 = 400 分鐘 ≈ **6.7 小時**。佢擋到短時間嘅爆發，但擋唔到一個 IP 慢慢灌成日。
- **Rule 2（建議另外加）：每個 IP 每小時最多 100 個 request**。即係一個 IP 一日最多 100 × 24 = **2,400 < 4000**，單一 IP 灌唔滿全日 budget，要用 2 個以上 IP 先得。正常用戶（包括共用 IP 嘅家庭 / 公司）一個鐘好難開 100 次 app。兩條 rule 一齊用：Rule 1 擋爆發，Rule 2 擋成日慢灌。
  - ⚠️ **Vercel 是否支援 1 小時 window 未核實**，以 dashboard 實際選項為準。
  - 如果唔支援（例如 window 最長只有 1 分鐘），可以將 Rule 1 改做 **每 60 秒 2 個**代替 Rule 2（一日最多 2 × 60 × 24 = 2,880 < 4000，單一 IP 一樣灌唔滿）。代價係大型共用 IP（流動網絡 CGNAT、大學 Wi-Fi）多人同時開 app 嘅 beacon 較易俾擋；俾擋嘅後果只係嗰個 beacon 唔計數（`sendBeacon` 唔會顯示錯誤，app 照用）。

## 步驟（UI 字眼以 Vercel dashboard 實際顯示為準）

1. 登入 Vercel → 揀 project（`life-uk`）。
2. 去 **Firewall**（project 頂部 tab 或者左邊 menu）。
3. 揀 **Configure** / **Rules** → **Add Rule**（或 **New Rule** / **Custom Rule**）。
4. **Rule name**：例如 `track-per-ip-rate-limit`。
5. **條件（If）**：
   - **Request Path** → **Equals**（或 **Starts with**）→ `/api/track`
   - （可選）再加 **Method** → **Equals** → `POST`
6. **動作（Then）**：揀 **Rate Limit**，然後：
   - **Key / Rate limit by**：**IP Address**
   - **Limit / Requests**：`10`
   - **Window**：`60` 秒（1 minute）
   - **When exceeded / Action**：**Deny**（或者回 **429 Too Many Requests**，如果有得揀）
7. 儲存，然後 **Review Changes** → **Publish**（Vercel Firewall 改動通常要 publish 先生效）。
8. **Rule 2**：重複第 3–7 步，條件一樣，**Rule name** 例如 `track-per-ip-hourly-limit`，**Limit / Requests**：`100`，**Window**：`3600` 秒（1 hour）。⚠️ 有冇 1 小時 window **未核實**；如果 dashboard 冇得揀，唔好加 Rule 2，改為將 Rule 1 嘅 **Limit** 改做 `2`（見上面「建議數值點計」嘅代價）。

### 如果揀唔到 Rate Limit

Rate limiting 可能只係某啲 plan 先有（Hobby plan 有冇、上限幾多：**未核實**，以 dashboard 為準）。如果冇得揀：

- 照用 code 嘅 budget + 短路（已經 deploy），dashboard 會顯示封頂日；
- 唔好將 action 改做全部 **Deny** `/api/track`，咁會連真 beacon 都擋晒。

## 驗證

1. 用一部機開 `https://life-uk.vercel.app/` 一次，等一陣再去 `stats.html` 睇今日 `open` 有冇加 1（確認正常 beacon 冇俾擋）。
2. （可選）喺自己部機跑 11 次：
   ```bash
   for i in $(seq 1 11); do
     curl -s -o /dev/null -w '%{http_code}\n' -X POST 'https://life-uk.vercel.app/api/track' \
       -H 'Origin: https://life-uk.vercel.app' -H 'Content-Type: text/plain' --data '{"events":["open"]}'
   done
   ```
   頭 10 個應該係 `204`，第 11 個應該係 Firewall 嘅 `403` / `429`（實際 status 睇你揀嘅 action；如果用咗每 60 秒 2 個，就係頭 2 個 `204`、第 3 個起擋）。**注意**：呢個測試會令今日 `open` 多咗 10，同埋用咗 10 個 budget。
3. Vercel → Firewall 頁面應該見到呢條 rule 嘅命中記錄（名稱以 dashboard 為準）。

## `vercel.json` 可唔可以設？

**唔肯定**。Repo 同本地文件冇證據顯示 `vercel.json` 支援 Firewall custom rule / rate limit（`vercel.json` 而家只有 `headers`）。所以呢條 rule 用 dashboard 手動設；如果之後確認可以用 config 檔管理，再搬入 repo。

## 相關設定（已經喺 code，唔使做）

| 項目 | 位置 | 值 |
|---|---|---|
| 每日 request budget | `api/track.js` `DAILY_REQUEST_BUDGET` | 4000 / UTC 日 |
| 封頂後短路 | `api/track.js` `budgetSpentOn` | 只喺 warm instance 有效 |
| Budget key TTL | `api/track.js` `BUDGET_TTL_SECONDS` | 2 日（AU-031） |
| 封頂記號 | `lifeuk:capped:<日>` | 冇 TTL，dashboard 讀 |
