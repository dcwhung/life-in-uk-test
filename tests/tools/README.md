# tests/tools

Manual helpers. They are not part of `tests/run-all.sh`.

- `visual-diff.js [git-ref=HEAD] [max-printed=40]`: renders the app at `git-ref` (via `git archive` into a temp dir) and the working tree in 38 app states at 390px and 900px. It then compares every rendered element's computed style (including `::before` / `::after`; `--*` custom properties are skipped), box and text. Use it for refactors that must not change the UI:
  `NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium node tests/tools/visual-diff.js dc73a15`
- `make-content-baseline.js`: writes `tests/fixtures/content-baseline.json`, the protected-field snapshot that `tests/content-guard-test.js` compares `data/exams.js` / `data/study.js` against (everything except exams `yue` / `oy` / `note` and study fact `yue`; for those only the shape is kept; a note may go from empty to filled, never from filled to empty). Re-run it **only** when English content or data structure changes on purpose, and commit the fixture with that change; never to make the guard pass after a Cantonese rewrite:
  `node tests/tools/make-content-baseline.js`
