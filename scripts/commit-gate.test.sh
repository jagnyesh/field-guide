#!/usr/bin/env bash
# Tests for scripts/commit-gate.sh, run against stand-ins for `claude` and typecheck.sh.
#   scripts/commit-gate.test.sh
# Each case copies the gate into a throwaway tree, feeds it a PreToolUse payload on stdin,
# and checks the exit code (0 lets the call through, 2 blocks it) and what it printed.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
gate="$here/commit-gate.sh"
tmp="$(mktemp -d)"
trap 'command rm -rf "$tmp"' EXIT
pass=0
fail=0

# A tree with the gate, a typecheck stand-in, and a `claude` stand-in on PATH.
# Stand-ins exit with STUB_TYPECHECK, STUB_VALIDATE and STUB_TEST (default 0) and log each call.
setup() { # setup <name> <declarations: yes|no> <claude: yes|no>
  tree="$tmp/$1"
  mkdir -p "$tree/scripts" "$tree/bin"
  [ -f "$gate" ] && cp "$gate" "$tree/scripts/commit-gate.sh"
  cat > "$tree/scripts/typecheck.sh" <<'SH'
#!/usr/bin/env bash
echo typecheck >> "$CALLS"
echo "typecheck output"
exit "${STUB_TYPECHECK:-0}"
SH
  chmod +x "$tree/scripts/typecheck.sh"
  if [ "$2" = yes ]; then
    mkdir -p "$tree/.claude-plugin/types/claude-code"
    : > "$tree/.claude-plugin/types/claude-code/index.d.ts"
  fi
  if [ "$3" = yes ]; then
    cat > "$tree/bin/claude" <<'SH'
#!/usr/bin/env bash
echo "claude $1 $2" >> "$CALLS"
echo "claude $1 $2 output"
case "$2" in
  validate) exit "${STUB_VALIDATE:-0}" ;;
  test) exit "${STUB_TEST:-0}" ;;
esac
SH
    chmod +x "$tree/bin/claude"
  fi
  ln -sf "$(command -v python3)" "$tree/bin/python3"
  export CALLS="$tree/calls"
  : > "$CALLS"
}

# run <shell command the agent asked for>; sets $code, $out (stdout), $err (stderr)
run() {
  local payload
  payload="$(python3 -I -c 'import json,sys; print(json.dumps({"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":sys.argv[1]}}))' "$1")"
  out="$(printf '%s' "$payload" | PATH="$tree/bin:/usr/bin:/bin" bash "$tree/scripts/commit-gate.sh" 2>"$tree/stderr")"
  code=$?
  err="$(cat "$tree/stderr")"
}

check() { # check <description> <condition...>
  local what="$1"
  shift
  if "$@"; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    echo "(fail) $what"
    echo "       exit=$code stdout=[$out] stderr=[$err] calls=[$(tr '\n' ',' < "$CALLS")]"
  fi
}
exits() { [ "$code" -eq "$1" ]; }
ran() { grep -qx "$1" "$CALLS"; }
ran_nothing() { [ ! -s "$CALLS" ]; }
says() { printf '%s\n%s' "$out" "$err" | grep -q "$1"; }
stderr_says() { printf '%s' "$err" | grep -q "$1"; }
stdout_is_json_with() { printf '%s' "$out" | python3 -I -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if sys.argv[1] in d["hookSpecificOutput"]["additionalContext"] else 1)' "$1" 2>/dev/null; }
silent() { [ -z "$out" ] && [ -z "$err" ]; }

# Commands that are not a commit pass straight through, with no check run.
setup not-commit yes yes
for cmd in "npm test" "git status" "git log --grep commit" "git push origin main" "echo git commit" "cat commit.txt"; do
  run "$cmd"
  check "not a commit, lets it through: $cmd" exits 0
  check "not a commit, runs nothing: $cmd" ran_nothing
  check "not a commit, prints nothing: $cmd" silent
done

# Every shape of commit the agent might run is gated.
setup commit-shapes yes yes
for cmd in "git commit -m x" "git add -A && git commit -m x" "git -C /repo commit -m x" "git -c user.name=a commit --amend" "cd /repo; git commit"; do
  : > "$CALLS"
  run "$cmd"
  check "a commit runs the tests: $cmd" ran "claude plugin test"
done

# All checks pass: the commit goes through and all three ran.
setup all-pass yes yes
run "git commit -m x"
check "all pass: lets the commit through" exits 0
check "all pass: ran the type check" ran "typecheck"
check "all pass: ran validate" ran "claude plugin validate"
check "all pass: ran the tests" ran "claude plugin test"
check "all pass: nothing skipped, so prints nothing" silent

# A failing check blocks the commit and names itself on stderr, where the agent reads it.
setup test-fails yes yes
STUB_TEST=1 run "git commit -m x"
check "tests fail: blocks" exits 2
check "tests fail: names the check" stderr_says "claude plugin test"
check "tests fail: shows the check's output" stderr_says "claude plugin test output"

setup validate-fails yes yes
STUB_VALIDATE=1 run "git commit -m x"
check "validate fails: blocks" exits 2
check "validate fails: names the check" stderr_says "claude plugin validate"

setup typecheck-fails yes yes
STUB_TYPECHECK=1 run "git commit -m x"
check "type check fails: blocks" exits 2
check "type check fails: names the check" stderr_says "typecheck.sh"

# No declarations (a cloud session): the type check is skipped and said so; the rest still gates.
setup no-declarations no yes
run "git commit -m x"
check "no declarations: lets the commit through" exits 0
check "no declarations: did not run the type check" [ "$(grep -c typecheck "$CALLS")" -eq 0 ]
check "no declarations: still ran the tests" ran "claude plugin test"
check "no declarations: tells the agent the type check was skipped" stdout_is_json_with "type check"

setup no-declarations-red no yes
STUB_TEST=1 run "git commit -m x"
check "no declarations, tests fail: still blocks" exits 2

# No claude CLI on PATH: nothing can run, so the commit goes through and the agent is told.
setup no-cli yes no
STUB_TYPECHECK=0 run "git commit -m x"
check "no CLI: lets the commit through" exits 0
check "no CLI: tells the agent validate and tests were skipped" stdout_is_json_with "claude"

# Input that is not the expected payload never blocks.
setup bad-input yes yes
out="$(printf 'not json' | PATH="$tree/bin:/usr/bin:/bin" bash "$tree/scripts/commit-gate.sh" 2>"$tree/stderr")"
code=$?
err="$(cat "$tree/stderr")"
check "unreadable payload: lets the call through" exits 0

echo " $pass pass"
echo " $fail fail"
[ "$fail" -eq 0 ]
