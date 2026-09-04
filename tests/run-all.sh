#!/usr/bin/env bash
# Run every Playwright suite against the local index.html.
# Requires: npm i playwright-core (any dir on NODE_PATH) and a Chromium build.
#   CHROMIUM_PATH=/path/to/chromium ./tests/run-all.sh
#   APP_URL=https://dcwhung.github.io/life-in-uk-test/ ./tests/run-all.sh   # against the live site
set -u
cd "$(dirname "$0")"
fail=0
for t in test shuffle-test study-test subfilter-test diff-test yue-test oy-test yue2-test mode-test info-test mastery-test; do
  out=$(node "$t.js" 2>&1 | grep -v agent-proxy | tail -1)
  printf '%-16s %s\n' "$t" "$out"
  [[ "$out" == *PASS* ]] || fail=1
done
exit $fail
