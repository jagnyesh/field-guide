#!/usr/bin/env bash
# Push gate: runs this repo's checks before a push and blocks the push when one fails.
# git runs it as scripts/git-hooks/pre-push once scripts/install-hooks.sh has pointed the clone at it,
# so it applies to every `git push`, an agent's or a person's, however the command is written.
# Commits are not gated: CLAUDE.md section 3 has a failing test committed before its fix.
#   exit 0  the push goes ahead (every check that could run passed, or it only deletes branches)
#   exit 1  the push is blocked, and stderr says which check failed
# A check that can't run here (no declarations for the type check, no `claude` CLI) is skipped and
# named on stderr, so the session can say so in the PR's evidence.
# It tests the working tree as it stands, which can differ from the commits being pushed.
# This guards work on the repo. It is not part of the mod, whose own hooks only watch (ADR 0001).
set -uo pipefail
root="$(git rev-parse --show-toplevel)" || exit 0

# git lists what is being pushed on stdin: <local ref> <local sha> <remote ref> <remote sha>.
# (Run by hand from a terminal, it waits here for that input; end it with Ctrl-D.)
# A push that only deletes remote branches (local sha all zeros) sends no code to check.
refs="$(cat)"
if ! printf '%s\n' "$refs" | awk '$2 !~ /^0+$/ { found = 1 } END { exit !found }'; then
  exit 0
fi

# git can give a hook its own GIT_DIR and index; the checks must not inherit them.
unset $(git rev-parse --local-env-vars)

skipped=()
# Lines that mark a failure in a runner's or compiler's output.
failure_line='^\(fail\)|^[[:space:]]*(error|Error|ERROR|FAILED)'

check() { # check <name shown in the message> <command...>
  local name="$1" output
  shift
  if ! output="$("$@" 2>&1)"; then
    {
      echo "Push gate: \`$name\` failed, so this push was blocked. Fix the failure, commit, and push again."
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
  echo "Push gate: skipped $(printf '%s, ' "${skipped[@]}" | sed 's/, $//'), so this push is not fully checked. Say so in the PR's Testing evidence." >&2
fi
exit 0
