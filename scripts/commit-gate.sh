#!/usr/bin/env bash
# Commit gate: runs this repo's checks before a commit and blocks the commit when one fails.
# git runs it as scripts/git-hooks/pre-commit once scripts/install-hooks.sh has pointed the clone at it,
# so it applies to every `git commit`, an agent's or a person's, however the command is written.
#   exit 0  the commit goes ahead (every check that could run passed)
#   exit 1  the commit is blocked, and stderr says which check failed
# A check that can't run here (no declarations for the type check, no `claude` CLI) is skipped and
# named on stderr, so the session can say so in the PR's evidence.
# It tests the working tree as it stands, which can hold changes that aren't staged.
# This guards work on the repo. It is not part of the mod, whose own hooks only watch (ADR 0001).
set -uo pipefail
root="$(git rev-parse --show-toplevel)" || exit 0
# git gives a hook its own GIT_DIR and index; the checks must not inherit them.
unset GIT_DIR GIT_INDEX_FILE GIT_WORK_TREE GIT_PREFIX

skipped=()
# Lines that mark a failure in a runner's or compiler's output.
failure_line='^\(fail\)|^[[:space:]]*(error|Error|ERROR|FAILED)'

check() { # check <name shown in the message> <command...>
  local name="$1" output
  shift
  if ! output="$("$@" 2>&1)"; then
    {
      echo "Commit gate: \`$name\` failed, so this commit was blocked. Fix the failure and commit again."
      echo "Never edit a test to make it pass (CLAUDE.md section 3). If the failure isn't from your change, stop and tell J."
      if printf '%s\n' "$output" | grep -Eq "$failure_line"; then
        echo "--- failures in its output ---"
        printf '%s\n' "$output" | grep -E -A 3 "$failure_line" | head -40
      fi
      echo "--- last lines of its output ---"
      printf '%s\n' "$output" | tail -8
    } >&2
    exit 1
  fi
}

if [ -f "$root/.claude-plugin/types/claude-code/index.d.ts" ]; then
  check "scripts/typecheck.sh" "$root/scripts/typecheck.sh"
else
  skipped+=("the type check (no engine declarations in .claude-plugin/types/, which Claude Code writes when it loads the mod)")
fi

if command -v claude >/dev/null 2>&1; then
  check "claude plugin validate" claude plugin validate "$root"
  check "claude plugin test" claude plugin test "$root"
else
  skipped+=("claude plugin validate and claude plugin test (no claude CLI on PATH)")
fi

if [ "${#skipped[@]}" -gt 0 ]; then
  echo "Commit gate: skipped $(printf '%s; ' "${skipped[@]}")so this commit is not fully checked. Say so in the PR's Testing evidence." >&2
fi
exit 0
