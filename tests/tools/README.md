# tests/tools

Manual helpers. They are not part of `tests/run-all.sh`.

- `visual-diff.js [git-ref=HEAD] [max-printed=40]`: renders the app at `git-ref` (via `git archive` into a temp dir) and the working tree in 38 app states at 390px and 900px. It then compares every rendered element's computed style (including `::before` / `::after`), box and text. Use it for refactors that must not change the UI:
  `NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium node tests/tools/visual-diff.js dc73a15`
