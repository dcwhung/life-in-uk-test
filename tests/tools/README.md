# tests/tools

Manual helpers. They are not part of `tests/run-all.sh`.

- `visual-diff.js [git-ref=HEAD] [max-printed=40]`: renders the app at `git-ref` (via `git archive` into a temp dir) and the working tree in 38 app states at 390px and 900px. It then compares every rendered element's computed style (including `::before` / `::after`; `--*` custom properties are skipped), box and text. Use it for refactors that must not change the UI:
  `NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium node tests/tools/visual-diff.js dc73a15`
- `make-content-baseline.js`: writes `tests/fixtures/content-baseline.json`, the protected-field snapshot that `tests/content-guard-test.js` compares `data/exams.js` / `data/study.js` against (everything except exams `yue` / `oy` / `note` and study fact `yue`; for those only the shape is kept; a note may go from empty to filled, never from filled to empty). Re-run it **only** when English content or data structure changes on purpose, and commit the fixture with that change; never to make the guard pass after a Cantonese rewrite:
  `node tests/tools/make-content-baseline.js`
- `check-batch-replay.js`: checks that `data/exams.js` / `data/study.js` still match the approved Cantonese batch tables (`.proj-docs/plans/2026-10-07_yue-batch-*.json`). For every field it takes the last `after` (skipping `userDecision: "keep"` records), adds the fixes made outside any batch file (`POST_BATCH_FIXES`, e.g. S-055), and compares it with the current data; prints every mismatch and exits 1 if there is one. **Run it once after changing any `yue` / `oy` / `note` / fact `yue`** (a new change needs its own batch md + json first):
  `node tests/tools/check-batch-replay.js`
