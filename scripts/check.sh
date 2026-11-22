#!/usr/bin/env bash
# Type-check, validate, and test the mod, then test the commit gate; stops at the first failure.
#   scripts/check.sh [path to claude-code.d.ts]   (as scripts/typecheck.sh)
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
"$root/scripts/typecheck.sh" "$@"
claude plugin validate "$root" | tail -1
claude plugin test "$root" | tail -3
"$root/scripts/commit-gate.test.sh" | tail -2
