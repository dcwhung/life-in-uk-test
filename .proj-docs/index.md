# .proj-docs index

文件索引（同一日內按檔名倒序）。Review item ID：C / W / S 全局遞增，賦號前要 grep `.proj-docs/reviews/`。溫習計劃序列最新到 W-045、S-139（2026-10-09 plan PR7）；之後 S-140–S-145 用咗喺 v1.0.7 記憶法 table review（2026-10-10）；W-375 屬於另一個 session，唔好接住佢嘅號碼。

**撞號注意（2026-10-10）**：plan PR7b review（`2026-10-09_review_plan-pr7b.md`）同時用咗 W-046–W-047、S-140–S-145，同 v1.0.7 記憶法 table review 嘅 S-140–S-145 重複；引用呢幾個 S 號要連報告名。之後新號由兩邊最大值之後開始（grep 全部報告）。另一個 session 用咗 S-146–S-152；plan PR7c review（2026-10-10）用 W-048、S-153–S-159（S-157 = S-154 follow-up；S-158–S-159 = runner fade follow-up）。plan 日程已完成變綠 review（G43，2026-10-10）用 W-049、S-160–S-164（S-164 = re-review 新增）。v1.0.10 記憶法 v2 review（2026-10-11）用 S-165–S-168；re-review（f3233e4）用 W-050、S-169–S-170。re-review 2（75935a7）用 S-171。 **PR8 撞號（2026-10-11 發現）**：plan PR8 review（`2026-10-10_review_plan-pr8.md`）亦用咗 W-050–W-051、S-165–S-166，同 v1.0.10 review 嘅 W-050、S-165–S-166 重複；引用要連報告名。v1.1.1 時間線 review（2026-10-11）用 W-052、S-172–S-174；re-review（e02e3af）用 S-175–S-176；re-review 2（06766bd）用 W-053、S-177–S-179；S-175 follow-up（01ce106）用 S-180–S-182。下一個新號：W-054、S-183。 **撞號（2026-10-11）**：PR #90（字號 token refactor，`review_v112.md`）同 S-168 review 同時用咗 S-183 / S-184；S-168 嗰兩個 merge 時改號做 S-188 / S-189（`review_v113.md`），v1.1.2 → v1.1.3。下一個新號 W-055、S-190。 v1.1.4 review（`review_v114.md`，2026-10-11）用 S-190–S-192。下一個新號：W-055、S-193。

**撞號注意（2026-10-11，字型大小 PR-B merge `main` 時發現）**：v1.1.3 / v1.1.4 review（`2026-10-11_review_v113.md` / `_v114.md`，另一個 session）同字型大小 PR-A / PR-B review（`_v112.md` / `_v120.md`）平行開號：W-054–W-055、S-183–S-184、S-188–S-192 兩邊都有用；引用呢啲號要連報告名。**下一個新號：W-056、S-195**（已 grep 全部報告）。

## Reviews

- [2026-10-11_review_v120.md](reviews/2026-10-11_review_v120.md) — v1.2.0 ⚙ 設定 popover + screen header icon 化（字型大小 plan Q12 PR-B，44816c6..8ebf50f；Design Origin mockup v2.3；warn 90；0 C；run-all 48/48；Q10 focus 四條路徑、44px hit area（320 / 390 × en / zh-HK，冇重疊）、segmented `aria-pressed`、C2 / C4、mockup small-text frame 全部核對；W-055 SW 混合頁面（44816c6 `index.html` + 新 JS）冇 throw 但顯示 raw key「app.langSwitch」死掣 + 7 粒「common.home」，建議開機 shim + upgrade-test ⑧；S-188 plan 文字返回掣 `aria-label` 蓋過可見文字（失 `lang` span）、S-189 ⚙ 開住變白（mockup 金色，問用戶）、S-190 3 處 stale 註解、S-191 `setButtonLabel` 用喺 span、S-192 鍵盤揀語言 / Esc focus 冇 assert、S-193 ⓘ tap area 16×20（舊有））。；re-review 2026-10-11（d2852d6..9b37d9e）pass 99：W-055（`main.js` `upgradeLegacyHeaderMarkup()` 收埋舊 pill、Home 掣變 🏠，`upgrade-test` `v112Shell` pin 44816c6，test 先）、S-188–S-192 已解決，S-193 留 PR-C，新 S-194 HANDOFF `main.js` / `upgrade-test` 行同 test 開頭清單冇記 W-055 shim（純文件））。下一個新號：W-056、S-195
- [2026-10-11_review_v114.md](reviews/2026-10-11_review_v114.md) — v1.1.4「local council」統一譯「地區議會」+ 測試截圖路徑（S-188 / S-189；9486ba3..64969e5；pass 97；0 C / 0 W；run-all 47/47；只改 `oy` 4.19 / 5.12 / 5.22 / 11.17 / 15.9 + fact #197 / #203 `yue`，「地方議會」只剩 4A note，R4 喺舊 data fail 7 個；10 個測試截圖 `path.join(__dirname, …)`，guard 喺舊 tests flag 10 個；S-190 截圖 guard 漏 `path` 唔係第一個 key / 變數、誤報 `${__dirname}` template、S-191 R4 可改做「地方議會只准喺 note」、S-192 fact #203「議員」→「地區議員」（待用戶））
- [2026-10-11_review_v113.md](reviews/2026-10-11_review_v113.md) — v1.1.3 地區議會記憶法（S-168；7170cd0；pass 98；0 C / 0 W；run-all 47/47；9.14 / 12.18 / 12.5 note 逐字 = fixture S168、只改 note、390 / 320px Practice / Results / Study fit；S-188 其他「local council」仍譯「地方議會」（fact #203 yue、5 個干擾選項包括 5.22）同 4A 撞、S-189 test 截圖寫去 cwd + 冇 .gitignore、a00baab png 留喺 branch 歷史（建議 squash merge））
- [2026-10-11_review_v112.md](reviews/2026-10-11_review_v112.md) — v1.1.2 字號全部行 `--fs-*` token（字型大小 plan Q12 PR-A，d49af5f；warn 91；0 C；run-all 47/47；35 個替換逐個對數一致，guard HEAD~1 = 35 / 而家 0；W-054 HANDOFF 標題仲係 v1.1.1、冇 v1.1.2 版本歷史行；S-183 guard 漏 `.9em` / `vw` / `ch` / 字號 keyword、S-184 custom property 名用子字串「fs」配對（`--offset` 誤報）同間接 `var()` 靠命名、S-185 plan「root / control token」只加咗 body（UA 13.33px control 冇文字，唔使）要記錄 + body 固定 16px 前提、S-186 PR 要寫 `Design Origin: none-required`；re-review 2026-10-11（8b24f57..3dcca4c）pass 98：W-054、S-183、S-184、S-185 已解決（HANDOFF v1.1.2 標題 + 版本行、guard regex 收緊 + `unguardedFontVars()`、plan 記錄唔使 control token），S-186 待開 PR，新 S-187 guard 漏兩層 `var()` 同無單位 `calc()` 倍數（而家 0 個，建議只寫入 HANDOFF））。下一個新號：W-055、S-188
- [2026-10-11_review_v111.md](reviews/2026-10-11_review_v111.md) — v1.1.1 Study 時間線卡唔再撐闊頁面（c194933，方案 C 年份搬上卡頂；warn 92；0 C；run-all 47/47；新 `timeline-test` 喺舊 code reproduce 到 bug；W-052 `.fact` margin collapse 令直線喺每兩張卡之間斷 8px（建議 `.tl-item` `display: flow-root`）、S-172 冇 text-box 嘅 browser（iOS ≤ 18.1 等）間距約 12 / 11.4px（圓點只偏約 0.6px）、S-173 兩個冇作用嘅 `min-width: 0`、S-174 preview 截圖冇存檔；re-review 2026-10-11（e02e3af）pass 97：W-052 已解決（`flow-root`，72 個相鄰位 0 空位，新 assert 冇 flow-root 會 fail）、S-172 已解決（`@supports not (text-box)` 後備，模擬 7.0 / 4.4px vs trim 6.7 / 5.0px）、S-173 已解決；era 尾直線 8px / 30px 同 v1.1.0 差唔多，唔係 regression；S-174 未做，新 S-175 後備冇自動 test、S-176 三個 item 一個 commit；re-review 2 2026-10-11（84326cb..06766bd，用戶真機調整：年份上下 24 / 16px、畫面左邊到卡 58px）pass 92：量度全部符合，390px 71 個 table 全 fit、375 / 360 / 320px 5–6 個 table 內 scroll（頁面唔 scroll），era / desktop / dark OK；新 W-053 窄機 scroll table 冇上限（建議 allow-list）、S-177 `TL_YEAR_GAP_PX` 係下限 + 字對齊卡冇 assert、S-178 `.tl-item` 註釋移動量講錯、S-179 `06766bd` 夾埋還原 `c6d10a4`；S-174 / S-175 仍未做）；S-175 follow-up 2026-10-11（01ce106，test-only）pass 97：S-175 已解決（`timeline-test` `checkFallback()` 由 `study.css` 抽後備段 + `text-box: normal` 模擬，殘差 +0.27 / −0.61px），新 S-180 tolerance 1.5px 捉唔到下面改一格（+1.39px）、S-181 結果跟 CI 字體（IPAGothic 會 fail，唔係 flaky）、S-182 regex 抽 block 遇 nested at-rule 會截短（建議反轉條件注入成個 file）
- [2026-10-11_review_v1010.md](reviews/2026-10-11_review_v1010.md) — v1.0.10 記憶法 v2 套用（f209813；pass 96；0 C / 0 W；run-all 46/46；同意 4 題 untouched（3.13、9.14、12.5、12.18）跟 spec base；S-165 table 格「• 」備注 hanging indent 靠字形闊度、S-166 HANDOFF 測試套數、S-167 mockup / 決定紀錄只喺 plan branch、S-168 9.14 / 12.18 note 內容（待用戶決定）；re-review 2026-10-11（f3233e4）pass 93：S-165 已解決（`.note-mark`，冇繼承問題）；CUI-0027 唔使 scroll 但新 W-050（< 360px 全部格可以轉行，約 23 個記憶法短格喺字中間斷，例如「小｜說」「N.｜Ireland」，建議第一欄保持 nowrap）、S-169 320px 測試冇驗短格、S-170 HANDOFF ② 舊變數名；re-review 2 2026-10-11（75935a7）pass 99：W-050 改用 < 360px 收窄格左右 padding（格照舊 nowrap，0 scroll、0 斷字）已解決、S-169 / S-170 已解決，新 S-171（10B 喺 232px 只有 1px 餘位，QA 真機睇））
- [2026-10-10_review_plan-pr8.md](reviews/2026-10-10_review_plan-pr8.md) — 溫習計劃 PR8 正式推出（v1.1.0，`STUDY_PLAN_READY = true`、拎走 `?preview=plan` G42；warn 88；code 冇問題、45/45 PASS；W-050 HANDOFF 模擬考合格寫錯 21/24（應為 18/24）、W-051 HANDOFF replay 後漏 G43 #82 / #80 S-154 / #81 runner fade、測試數同撞號 stale；S-165 upgrade-test 舊 shell 冇 assert 入口開咗、S-166 mockup 歷史 commit 指向；re-review + QA 2026-10-10（3c1c8f3）pass 100：W-050/051、S-165/166 全部解決、冇新 finding；reviewer 自己瀏覽器 QA 91 checks（第一次開、ⓘ 關 + reload、完整流程 390/320 en + zh-HK、真 SW 1.0.8 → `lifeuk-v1.1.0` 升級保留計劃、刪 `lifeuk.studyPlanPreview`），script `qa/scripts/2026-10-10_qa-plan-pr8-release.js`；merge / tag 等用戶批准）
- [2026-10-10_review_plan-done-green.md](reviews/2026-10-10_review_plan-done-green.md) — 溫習計劃日程已完成變綠（G43，未升版；pass 91；W-049 錯過嘅模擬考日 / re-plan 前未完成強化日令該段永遠唔綠（待用戶決定）、S-160 性能、S-161 pill padding、S-162 模擬考段 navy 字、S-163 re-plan test；re-review + QA 2026-10-10（7de3447）pass 98：W-049 按用戶「只計做得到嘅日子」解決、S-160/161/163 解決、自己瀏覽器 QA（中途 re-plan + 先唔合格後合格）OK，新 S-164）
- [2026-10-10_review_plan-pr7c.md](reviews/2026-10-10_review_plan-pr7c.md) — 溫習計劃 PR7c 閱讀任務已完成 tag + 最後一條未完成提示（G41，未升版；pass 91；W-048 🏆 卡褪色令 tag 得 2.4:1、S-153–S-156；S-154 follow-up（runner nav 一行）pass 99、S-157；runner fade follow-up（練習完成先褪色）pass 98、S-158–S-159）
- [2026-10-10_review_v107.md](reviews/2026-10-10_review_v107.md) — v1.0.7 記憶法 table（pass 94；S-140–S-145：S-140/141/144 已修，S-142/143 延後）
- [2026-10-09_review_v104.md](reviews/2026-10-09_review_v104.md)
- [2026-10-09_review_v103.md](reviews/2026-10-09_review_v103.md)
- [2026-10-09_review_v102.md](reviews/2026-10-09_review_v102.md)
- [2026-10-09_review_plan-pr7b.md](reviews/2026-10-09_review_plan-pr7b.md) — 溫習計劃 PR7b 相同文字題目合併 + 連勝同步（G40，v1.0.7；warn 89；W-046、S-140–S-144）；re-review 2026-10-10 pass 94：舊 finding 全部解決，新 W-047（錯題簿回合只清答嗰個 copy）、S-145；re-review 2 2026-10-10 pass 100：W-047、S-145 已解決（錯題 / 標記 copy 同步）
- [2026-10-09_review_plan-pr7.md](reviews/2026-10-09_review_plan-pr7.md) — 溫習計劃 PR7 zh-HK / en 字眼（warn 89；W-045、S-134–S-139）
- [2026-10-09_review_plan-pr6b.md](reviews/2026-10-09_review_plan-pr6b.md)
- [2026-10-09_review_plan-pr6a.md](reviews/2026-10-09_review_plan-pr6a.md)
- [2026-10-09_review_plan-pr5.md](reviews/2026-10-09_review_plan-pr5.md)
- [2026-10-08_review_v100.md](reviews/2026-10-08_review_v100.md)
- [2026-10-08_review_v072.md](reviews/2026-10-08_review_v072.md)
- [2026-10-08_review_v071.md](reviews/2026-10-08_review_v071.md)
- [2026-10-08_review_v070.md](reviews/2026-10-08_review_v070.md)
- [2026-10-08_review_v070-delta.md](reviews/2026-10-08_review_v070-delta.md)
- [2026-10-08_review_v069.md](reviews/2026-10-08_review_v069.md)
- [2026-10-08_review_v069-s098.md](reviews/2026-10-08_review_v069-s098.md)
- [2026-10-08_review_v069-delta.md](reviews/2026-10-08_review_v069-delta.md)
- [2026-10-08_review_s091-s092-final.md](reviews/2026-10-08_review_s091-s092-final.md)
- [2026-10-08_review_s090.md](reviews/2026-10-08_review_s090.md)
- [2026-10-08_review_s085-s086.md](reviews/2026-10-08_review_s085-s086.md)
- [2026-10-08_review_plan-pr4.md](reviews/2026-10-08_review_plan-pr4.md)
- [2026-10-08_review_plan-pr3.md](reviews/2026-10-08_review_plan-pr3.md)
- [2026-10-08_review_plan-pr2.md](reviews/2026-10-08_review_plan-pr2.md)
- [2026-10-08_review_plan-pr1.md](reviews/2026-10-08_review_plan-pr1.md)
- [2026-10-07_review_v068-batch5-final-followups.md](reviews/2026-10-07_review_v068-batch5-final-followups.md)
- [2026-10-07_review_v068-batch4-home-ui.md](reviews/2026-10-07_review_v068-batch4-home-ui.md)
- [2026-10-07_review_v068-batch3-followups.md](reviews/2026-10-07_review_v068-batch3-followups.md)
- [2026-10-07_review_v068-batch2-fact-number.md](reviews/2026-10-07_review_v068-batch2-fact-number.md)
- [2026-10-07_review_v068-batch1.md](reviews/2026-10-07_review_v068-batch1.md)
- [2026-10-07_review_v067-cui13-14_batch.md](reviews/2026-10-07_review_v067-cui13-14_batch.md)
- [2026-10-07_review_v066-yue.md](reviews/2026-10-07_review_v066-yue.md)
- [2026-10-07_review_v065-zh-hk.md](reviews/2026-10-07_review_v065-zh-hk.md)
- [2026-10-07_review_v064_batch.md](reviews/2026-10-07_review_v064_batch.md)
- [2026-10-07_review_v063-pr3.md](reviews/2026-10-07_review_v063-pr3.md)
- [2026-10-06_review_v062-pr2_batch.md](reviews/2026-10-06_review_v062-pr2_batch.md)
- [2026-10-06_review_v061-pwa.md](reviews/2026-10-06_review_v061-pwa.md)
- [2026-10-06_review_v060-fixes_batch.md](reviews/2026-10-06_review_v060-fixes_batch.md)

## QA

- [2026-10-11_qa_v114.md](qa/2026-10-11_qa_v114.md) — v1.1.4 local council = 地區議會（S-188 / S-192）+ 截圖路徑（S-189 / S-190）（3dee283；pass；run-all 47/47；/tmp cwd 跑 study / mode test 冇 root png，`.gitignore` OK；browser 285/285：E4 Q20 / E5 Q13 / E5 Q23 / E11 Q18 / E15 Q10 Practice 未答 + Translate / 答錯、Results、Study #197 / #203 + 搜尋，390 / 320 × en / zh-HK；5.22「威爾斯地區議會」同 4A 一齊睇唔混淆；regression data 只 7 欄位改，4A 8 題 note 不變；mutation edge 6/6（R4 ×3、screenshot 白名單 ×2、control）；觀察：3dee283 連帶 commit 18 張 tests png、HANDOFF R4 描述過時、S-192 批准待確認；冇 ticket）
- [2026-10-11_qa_v113.md](qa/2026-10-11_qa_v113.md) — v1.1.3 記憶法（地區議會）S-168（5295ab4；pass；run-all 47/47；browser 173/173：E9 Q15 / E12 Q19 / E12 Q6 Practice + Results（答錯）+ Study Ch5 #203，390 / 320 × en / zh-HK，table 逐字 = fixture、冇左右 scroll、單行格唔斷、備注行唔換行；#203 冇年份唔上時間線；regression 408 題只 3 個 note 改，4A 6.8 / N8a 8.15 / 5B 1.5 不變，content-guard pass；edge 19/19（答錯、280px、搜尋、escape）；S-183 / S-184 照 review follow-up；冇 ticket）
- [2026-10-11_qa_v111.md](qa/2026-10-11_qa_v111.md) — v1.1.1 Study 時間線版面（73d0565；pass；run-all 47/47；browser 1134/1134：430/414/390/375/360/320/1280 × en/zh-HK 冇頁面左右 scroll、卡 58px、390 以上 71 個 table 全 fit、以下只 #8 #71 #72 #84 #87 #95 table 內 scroll、直線 / 圓點 / war / era bar、搜尋 / 書籤 / 戰爭 filter、展開收埋、切語言 OK；regression 126/126 同 origin/main 0 差異（章節 / 地理 / 人物 / 溫習計劃 runner）；edge 9/9（後備模擬 24.7 / 14.7px）；S-174 baseline `design-baselines/2026-10-11_timeline-v111-390.png`；S-175 仍冇自動 test；冇 ticket）
- [2026-10-11_qa_v1010.md](qa/2026-10-11_qa_v1010.md) — v1.0.10 記憶法 v2（375 題 spec + 4 題 spec base、`.cont` 續行、cell「• 」備注；pass；run-all 46/46，data 17/17，96 個抽樣畫面 390/320 × en/zh-HK 0 問題，Q1 + 舊 4 組 OK；S-165 實測 Inter 0.6px / CJK 2.75px 維持 Suggestion；CUI-0027 🟢 320px table 要喺 table 入面 scroll，唔 block；re-test 2026-10-11 @ 1e19d26 pass：run-all 46/46，320/340/360/390 × en/zh-HK 0 table overflow、0 短格斷字（7bfc331：320px 56、340px 11），S-165 四隻字體換行 0.00px 已解決，S-171 字體模擬 10B 0.72px / ⑤ 3.03px 餘位、DejaVu Sans 會落返 scroll 後備，真機未驗；CUI-0027 → completed）
- [2026-10-10_qa_plan-pr7c.md](qa/2026-10-10_qa_plan-pr7c.md) — 溫習計劃 PR7c 閱讀任務已完成 tag + 最後一條未完成提示（G41，W-048 / S-153 / S-155 / S-156 已驗；pass；run-all 44/44，browser 149/149，PR7b regression 139/139，冇 ticket）
- [2026-10-10_qa_plan-pr7b.md](qa/2026-10-10_qa_plan-pr7b.md) — 溫習計劃 PR7b 相同文字題目合併（G40 ①–⑧，v1.0.7；pass；run-all 41/41，browser 139/139，冇 ticket）
- [2026-10-09_qa_plan-pr7.md](qa/2026-10-09_qa_plan-pr7.md) — 溫習計劃 PR7 zh-HK / en 字眼（pass；run-all 40/40，browser 98/98，冇 ticket）
- [2026-10-09_qa_v106.md](qa/2026-10-09_qa_v106.md)
- [2026-10-09_qa_v105-ui.md](qa/2026-10-09_qa_v105-ui.md)
- [2026-10-09_qa_v104.md](qa/2026-10-09_qa_v104.md)
- [2026-10-09_qa_v103.md](qa/2026-10-09_qa_v103.md)
- [2026-10-09_qa_v102.md](qa/2026-10-09_qa_v102.md)
- [2026-10-09_qa_plan-pr6b.md](qa/2026-10-09_qa_plan-pr6b.md)
- [2026-10-09_qa_plan-pr6a.md](qa/2026-10-09_qa_plan-pr6a.md)
- [2026-10-09_qa_plan-pr5.md](qa/2026-10-09_qa_plan-pr5.md)
- [2026-10-08_qa_v100.md](qa/2026-10-08_qa_v100.md)
- [2026-10-08_qa_v072.md](qa/2026-10-08_qa_v072.md)
- [2026-10-08_qa_v071.md](qa/2026-10-08_qa_v071.md)
- [2026-10-08_qa_v071-delta.md](qa/2026-10-08_qa_v071-delta.md)
- [2026-10-08_qa_v070.md](qa/2026-10-08_qa_v070.md)
- [2026-10-08_qa_v069.md](qa/2026-10-08_qa_v069.md)
- [2026-10-08_qa_v068_batch.md](qa/2026-10-08_qa_v068_batch.md)
- [2026-10-08_qa_s090-s091.md](qa/2026-10-08_qa_s090-s091.md)
- [2026-10-08_qa_s085-s089.md](qa/2026-10-08_qa_s085-s089.md)
- [2026-10-08_qa_plan-pr4.md](qa/2026-10-08_qa_plan-pr4.md)
- [2026-10-08_qa_plan-pr3.md](qa/2026-10-08_qa_plan-pr3.md)
- [2026-10-08_qa_plan-pr2.md](qa/2026-10-08_qa_plan-pr2.md)
- [2026-10-08_qa_plan-pr1.md](qa/2026-10-08_qa_plan-pr1.md)
- [2026-10-07_qa_v067-cui13-14_batch.md](qa/2026-10-07_qa_v067-cui13-14_batch.md)
- [2026-10-07_qa_v066-yue.md](qa/2026-10-07_qa_v066-yue.md)
- [2026-10-07_qa_v066-w015-rerun.md](qa/2026-10-07_qa_v066-w015-rerun.md)
- [2026-10-07_qa_v065-zh-hk.md](qa/2026-10-07_qa_v065-zh-hk.md)
- [2026-10-07_qa_v064_batch.md](qa/2026-10-07_qa_v064_batch.md)
- [2026-10-07_qa_v063-pr3.md](qa/2026-10-07_qa_v063-pr3.md)
- [2026-10-06_qa_v062-pr2_batch.md](qa/2026-10-06_qa_v062-pr2_batch.md)
- [2026-10-06_qa_v061-pwa.md](qa/2026-10-06_qa_v061-pwa.md)
- [2026-10-06_qa_v060-fixes_batch.md](qa/2026-10-06_qa_v060-fixes_batch.md)

## Plans

- [2026-10-11_grill_font-size.md](plans/2026-10-11_grill_font-size.md) — 全域字型大小切換 grill（Q1–Q6：+2px、所有字、layout 跟住調、header A+/A− pill、先 mockup、PR-A v1.1.2 token 化 → PR-B v1.2.0）+ mockup 量度 L1–L6；mockup `mockups/font-size-switch.html`
- [2026-10-11_memo-final-spec.json](plans/2026-10-11_memo-final-spec.json) — 記憶法 v2 最終規格（61 個記憶法、375 題；Q1 已套：8.15 → N8a）；v1.0.10 已寫入 `data/exams.js`，測試 fixture `tests/fixtures/memo-notes.json`；review 過程 / handoff memo 喺 branch `claude/relaxed-hamilton-3x7vm6`
- [2026-10-10_plan-pr8-release.md](plans/2026-10-10_plan-pr8-release.md) — 溫習計劃 PR8 正式推出：`STUDY_PLAN_READY = true`、拎走 `?preview=plan`（G42）、刪 mockup、v1.1.0
- [2026-10-09_study-plan-i18n-pr6b.md](plans/2026-10-09_study-plan-i18n-pr6b.md)
- [2026-10-09_study-plan-i18n-pr6a.md](plans/2026-10-09_study-plan-i18n-pr6a.md)
- [2026-10-09_study-plan-i18n-pr5.md](plans/2026-10-09_study-plan-i18n-pr5.md)
- [2026-10-08_plan_study-plan.md](plans/2026-10-08_plan_study-plan.md)
- [2026-10-08_handoff_study-plan.md](plans/2026-10-08_handoff_study-plan.md)
- [2026-10-08_grill_study-plan.md](plans/2026-10-08_grill_study-plan.md)
- [2026-10-08_arch_study-plan.md](plans/2026-10-08_arch_study-plan.md)
- [2026-10-07_yue-terms.md](plans/2026-10-07_yue-terms.md)
- [2026-10-07_yue-batch-9-b1.md](plans/2026-10-07_yue-batch-9-b1.md)
- [2026-10-07_yue-batch-8-s054.md](plans/2026-10-07_yue-batch-8-s054.md)
- [2026-10-07_yue-batch-7-antileak.md](plans/2026-10-07_yue-batch-7-antileak.md)
- [2026-10-07_yue-batch-6-study.md](plans/2026-10-07_yue-batch-6-study.md)
- [2026-10-07_yue-batch-5.md](plans/2026-10-07_yue-batch-5.md)
- [2026-10-07_yue-batch-4.md](plans/2026-10-07_yue-batch-4.md)
- [2026-10-07_yue-batch-3.md](plans/2026-10-07_yue-batch-3.md)
- [2026-10-07_yue-batch-2.md](plans/2026-10-07_yue-batch-2.md)
- [2026-10-07_yue-batch-12-cui0017.md](plans/2026-10-07_yue-batch-12-cui0017.md)
- [2026-10-07_yue-batch-11-w025.md](plans/2026-10-07_yue-batch-11-w025.md)
- [2026-10-07_yue-batch-10-b2.md](plans/2026-10-07_yue-batch-10-b2.md)
- [2026-10-07_yue-batch-1.md](plans/2026-10-07_yue-batch-1.md)
- [2026-10-07_plan_zh-hk-locale.md](plans/2026-10-07_plan_zh-hk-locale.md)
- [2026-10-06_plan_p3-study-unify.md](plans/2026-10-06_plan_p3-study-unify.md)
