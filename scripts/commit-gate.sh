#!/usr/bin/env bash
# Commit gate: runs this repo's checks before an agent's `git commit` and blocks the commit when one fails.
# Wired as a PreToolUse hook in .claude/settings.json; reads the hook's JSON payload on stdin.
#   exit 0  the call goes ahead (not a commit, or every check that could run passed)
#   exit 2  the commit is blocked, and stderr tells the agent which check failed
# A check that can't run here (no declarations for the type check, no `claude` CLI) is skipped,
# and the agent is told so it can say so in the PR's evidence.
# This guards work on the repo. It is not part of the mod, whose own hooks only watch (ADR 0001).
set -uo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"

command="$(python3 -I -c 'import json,sys; print(json.load(sys.stdin)["tool_input"]["command"])' 2>/dev/null)" || exit 0

# `git commit`, allowing options between the two words (git -C dir commit, git -c k=v commit).
is_commit='(^|[;&|(]|[[:space:]])git([[:space:]]+(-[Cc][[:space:]]+[^[:space:]]+|-[^[:space:]]+))*[[:space:]]+commit([[:space:]]|$)'
printf '%s' "$command" | grep -Eq "$is_commit" || exit 0
# The words alone are not a commit when another command only prints them.
printf '%s' "$command" | grep -Eq '^[[:space:]]*echo[[:space:]]' && ! printf '%s' "$command" | grep -Eq '[;&|]' && exit 0

skipped=()
# Lines that mark a failure in a runner's or compiler's output.
failure_line='^\(fail\)|^[[:space:]]*(error|Error|ERROR|FAILED)'

check() { # check <name shown to the agent> <command...>
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
    exit 2
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
  note="Commit gate: skipped $(printf '%s; ' "${skipped[@]}")so this commit is not fully checked. Say so in the PR's Testing evidence."
  python3 -I -c 'import json,sys; print(json.dumps({"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":sys.argv[1]},"systemMessage":sys.argv[1]}))' "$note"
fi
exit 0
