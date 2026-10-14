# CI（GitHub Actions，AU-002）

Workflow：`.github/workflows/test.yml`（名 `tests`）。目的係每次改動自動跑測試，唔再靠人記住喺本機跑 `tests/run-all.sh`。

> 放喺 `.proj-docs/` 而唔係新開 `docs/`：repo 嘅內部文件全部喺 `.proj-docs/`，而且 `.vercelignore` 已經排除佢；新開 `docs/` 會被 GitHub Pages（root `/`）同 Vercel 當成網站內容公開。

## 兩個 job

| Job | 幾時跑 | 跑咩 | 大約時間 |
|-----|--------|------|----------|
| `node-tests` | 每個 branch 嘅 `push`，同所有 `pull_request` | `node tests/tools/node-only-suites.js` 揀出嚟、唔使 browser 嘅 suite（而家 9 個：content-guard、memo-domain、note-text、notes-en、plan-countdown、plan、stats-model、telemetry-api、telemetry），每個要 exit 0 而且最後一行有 `PASS` | 1–2 分鐘 |
| `playwright-tests` | 只限 target 係 `main` 嘅 `pull_request`（開 PR、PR 有新 push） | `bash tests/run-all.sh`（全套 Playwright suite，headless Chromium） | 未實測，timeout 45 分鐘 |

- Node 22（`actions/setup-node@v4`）；`playwright-core@1.56.1`（同本機 `/opt/node-tools` 一樣），用 `npm install --no-save --prefix "$RUNNER_TEMP/pw"` 裝喺 checkout 以外（repo 冇 `package.json`），`NODE_PATH` 指去嗰度。
- Chromium 用同一版 `playwright-core install --with-deps chromium` 裝；`CHROMIUM_PATH` 設做 `chromium.executablePath()`（完整 Chromium build，同本機 `/opt/pw-browsers/chromium` 一樣，唔用 headless shell）。
- **唔裝 CJK 字體**（用戶 2026-10-14 決定，CI 快啲）：所以 `lang-switch-test` 喺 CI 會 skip M4 中文換行 check；要驗 M4 就喺有 `fonts-noto-cjk` 嘅本機跑。
- `fetch-depth: 0`：`tests/upgrade-test.js` 要 `git archive` 一個 pinned 嘅 v0.57 commit，shallow clone 冇。
- `tests/pages-server.js` 用 `python3`，`ubuntu-latest` 本身有。
- 失敗時 upload `tests/shot-*.png` 做 artifact（`playwright-screenshots`，留 7 日）。
- `concurrency`：同一個 ref 有新 run 就取消舊 run；`permissions: contents: read`。
- PR 入 `main` 時 node-only suite 會跑兩次（`node-tests` 一次，`run-all.sh` 入面再一次），係刻意嘅：`run-all.sh` 照舊係「全套」。
- `tests/run-all.sh` 嘅 suite 清單仍然係寫死（AU-009，另外處理）；新 suite 要自己加入去，`node-tests` 就唔使（自動揀）。

## 本機重現

```bash
# node-tests
for t in $(node tests/tools/node-only-suites.js); do node "tests/$t.js" | tail -1; done

# playwright-tests（同 CI 一樣嘅裝法；本機已有 /opt/node-tools、/opt/pw-browsers 就直接用 HANDOFF.md「測試」段嘅指令）
npm install --no-save --prefix /tmp/pw playwright-core@1.56.1
/tmp/pw/node_modules/.bin/playwright-core install chromium
export NODE_PATH=/tmp/pw/node_modules
export CHROMIUM_PATH=$(node -e "process.stdout.write(require('playwright-core').chromium.executablePath())")
bash tests/run-all.sh
git ls-files -m 'tests/*.png' | xargs -r git checkout --   # 還原測試重寫嘅截圖
```

## 部署唔受 CI gate

GitHub Pages 同 Vercel 仍然係 **push / merge 入 `main`** 就自動 deploy，佢哋唔會等 CI。CI 紅咗都唔會阻止部署，除非開咗下面嘅 branch protection（強制行 PR + checks 綠先 merge）——咁先至做到「測試唔過就入唔到 `main`，亦即唔會 deploy」。

## 用戶要喺 GitHub 手動做（branch protection）

workflow 至少跑過一次（例如呢條 branch 開 PR）之後，check 名先會喺下拉清單出現：

1. Repo → **Settings** → **Branches** → **Add branch protection rule**（或 **Add classic branch protection rule**；新介面叫 Rulesets，效果一樣）。
2. Branch name pattern：`main`。
3. 勾 **Require a pull request before merging**（要唔要 approval 自己決定；一個人用可以設 0 個 approval）。
4. 勾 **Require status checks to pass before merging**，搜尋加入 `node-tests` 同 `playwright-tests`。建議同時勾 **Require branches to be up to date before merging**。
5. （可選）勾 **Do not allow bypassing the above settings**，否則 admin 仍然可以直接 push `main`。
6. **Save changes**。

注意：開咗之後 `main` 唔可以再直接 push（hotfix 都要開 PR）；`playwright-tests` 喺非 PR 事件係 skipped，GitHub 當 skipped 為通過，唔會卡住。
