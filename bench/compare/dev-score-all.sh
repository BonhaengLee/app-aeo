#!/bin/bash
# Scores every expert-prompt variant in bench/compare/dev on the development set (PREREGISTRATION.md §3.3), 3 at a time.
cd "$(dirname "$0")/../.." || exit 1
pass=0; fail=0
score_batch() {
  local pids=()
  for v in "$@"; do node bench/compare/collect.mjs dev-score "bench/compare/dev/variant-$v.txt" & pids+=($!); done
  for p in "${pids[@]}"; do if wait "$p"; then pass=$((pass+1)); else fail=$((fail+1)); fi; done
}
score_batch 1 2 3
score_batch 4 5 6
echo "=== dev-score: PASS $pass / FAIL $fail ==="
[ "$fail" -eq 0 ] && exit 0 || exit 10
