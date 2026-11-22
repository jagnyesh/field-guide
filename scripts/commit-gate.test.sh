#!/usr/bin/env bash
# Tests for the commit gate: scripts/commit-gate.sh, run by git as scripts/git-hooks/pre-commit,
# and scripts/install-hooks.sh, which turns it on for a clone.
#   scripts/commit-gate.test.sh
# Each case builds a throwaway git repository with the gate and stand-ins for `claude` and
# typecheck.sh, then either runs the gate directly or makes a real `git commit` through the hook.
# The gate lets a commit through with exit 0 and blocks it with any other exit code.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'command rm -rf "$tmp"' EXIT
pass=0
fail=0
# Keep the calling repository's git environment out of the throwaway ones.
unset GIT_DIR GIT_INDEX_FILE GIT_WORK_TREE GIT_PREFIX

# Stand-ins exit with STUB_TYPECHECK, STUB_VALIDATE and STUB_TEST (default 0) and log each call,
# with the GIT_DIR they were given, to $CALLS.
setup() { # setup <name> <declarations: yes|no> <claude: yes|no>
  tree="$tmp/$1"
  mkdir -p "$tree/scripts/git-hooks" "$tree/bin" "$tree/src"
  for f in commit-gate.sh install-hooks.sh git-hooks/pre-commit; do
    [ -f "$here/$f" ] && cp "$here/$f" "$tree/scripts/$f"
  done
  cat > "$tree/scripts/typecheck.sh" <<'SH'
#!/usr/bin/env bash
echo "typecheck GIT_DIR=${GIT_DIR:-unset}" >> "$CALLS"
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
echo "claude $1 $2 $3 GIT_DIR=${GIT_DIR:-unset}" >> "$CALLS"
echo "claude $1 $2 output"
case "$2" in
  validate) exit "${STUB_VALIDATE:-0}" ;;
  test) exit "${STUB_TEST:-0}" ;;
esac
SH
    chmod +x "$tree/bin/claude"
  fi
  git -C "$tree" init -q
  git -C "$tree" config user.name gate-test
  git -C "$tree" config user.email gate-test@example.com
  tree="$(cd "$tree" && pwd -P)"
  export CALLS="$tmp/$1.calls"
  : > "$CALLS"
}

# gate [dir under the tree]: runs the gate directly; sets $code, $out (stdout), $err (stderr)
gate() {
  out="$(cd "$tree/${1:-.}" && PATH="$tree/bin:/usr/bin:/bin" bash "$tree/scripts/commit-gate.sh" 2>"$tmp/stderr")"
  code=$?
  err="$(cat "$tmp/stderr")"
}

# commit <how the commit is run...>: a real commit through git; sets $code, $out, $err
commit() {
  echo "$RANDOM" >> "$tree/src/file.txt"
  git -C "$tree" add src/file.txt
  out="$(cd "$tree" && PATH="$tree/bin:/usr/bin:/bin" "$@" 2>"$tmp/stderr")"
  code=$?
  err="$(cat "$tmp/stderr")"
}
commits() { git -C "$tree" rev-list --count HEAD 2>/dev/null || echo 0; }

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
blocks() { [ "$code" -ne 0 ]; }
ran() { grep -q "^$1" "$CALLS"; }
did_not_run() { ! grep -q "^$1" "$CALLS"; }
stderr_says() { printf '%s' "$err" | grep -q "$1"; }
silent() { [ -z "$out" ] && [ -z "$err" ]; }
commit_count_is() { [ "$(commits)" -eq "$1" ]; }

# --- The gate itself ---

# All checks pass: exit 0, all three ran against this repository, nothing printed.
setup all-pass yes yes
gate
check "all pass: lets the commit through" exits 0
check "all pass: ran the type check" ran "typecheck"
check "all pass: ran validate on this repository" ran "claude plugin validate $tree "
check "all pass: ran the tests on this repository" ran "claude plugin test $tree "
check "all pass: nothing skipped, so prints nothing" silent

# A failing check blocks and names itself on stderr, which git shows to whoever ran the commit.
setup test-fails yes yes
STUB_TEST=1 gate
check "tests fail: blocks" blocks
check "tests fail: names the check" stderr_says "claude plugin test"
check "tests fail: shows the check's output" stderr_says "claude plugin test output"

setup validate-fails yes yes
STUB_VALIDATE=1 gate
check "validate fails: blocks" blocks
check "validate fails: names the check" stderr_says "claude plugin validate"

setup typecheck-fails yes yes
STUB_TYPECHECK=1 gate
check "type check fails: blocks" blocks
check "type check fails: names the check" stderr_says "typecheck.sh"

# No declarations (a cloud session): the type check is skipped and said so; the rest still gates.
setup no-declarations no yes
gate
check "no declarations: lets the commit through" exits 0
check "no declarations: did not run the type check" did_not_run "typecheck"
check "no declarations: still ran the tests" ran "claude plugin test"
check "no declarations: says the type check was skipped" stderr_says "skipped.*type check"

setup no-declarations-red no yes
STUB_TEST=1 gate
check "no declarations, tests fail: still blocks" blocks

# No claude CLI on PATH: validate and the tests can't run, so the commit goes through and says so.
setup no-cli yes no
gate
check "no CLI: lets the commit through" exits 0
check "no CLI: still ran the type check" ran "typecheck"
check "no CLI: says validate and the tests were skipped" stderr_says "skipped.*claude plugin test"

# Run from a folder inside the repository, it still checks the repository's top level.
setup from-subfolder yes yes
gate src
check "from a subfolder: checks the top level" ran "claude plugin test $tree "

# --- Through git: scripts/install-hooks.sh, then real commits ---

setup install yes yes
check "before install: git has no hooks path set" [ -z "$(git -C "$tree" config core.hooksPath)" ]
(cd "$tree" && bash scripts/install-hooks.sh >/dev/null 2>&1)
check "install: points git at scripts/git-hooks" [ "$(git -C "$tree" config core.hooksPath)" = "scripts/git-hooks" ]
check "install: the hook is executable" [ -x "$tree/scripts/git-hooks/pre-commit" ]

# Green: a commit is created, and the checks ran without the hook's git environment.
commit git commit -q -m one
check "through git, green: the commit succeeds" exits 0
check "through git, green: one commit exists" commit_count_is 1
check "through git, green: the tests ran" ran "claude plugin test $tree "
check "through git, green: checks do not inherit GIT_DIR" did_not_run ".*GIT_DIR=[^u]"

# Red: no commit is created, however the commit is phrased.
STUB_TEST=1 commit git commit -q -m two
check "through git, red: the commit fails" blocks
check "through git, red: no new commit" commit_count_is 1
check "through git, red: git shows the gate's reason" stderr_says "Commit gate"

STUB_TEST=1 commit /usr/bin/git commit -q -m two
check "red, absolute path to git: no new commit" commit_count_is 1
STUB_TEST=1 commit bash -c "git commit -q -m two"
check "red, inside bash -c: no new commit" commit_count_is 1
STUB_TEST=1 commit bash -c "echo start
git commit -q -m two; true"
check "red, on a later line with a trailing separator: no new commit" commit_count_is 1
STUB_TEST=1 commit git commit -q --amend -m amended
check "red, --amend: the last commit is unchanged" [ "$(git -C "$tree" log -1 --format=%s)" = "one" ]

# Commands that only mention a commit run no check at all.
: > "$CALLS"
STUB_TEST=1 commit bash -c "echo 'then run git commit' > note.txt; git status >/dev/null"
check "words only: nothing is blocked" exits 0
check "words only: no check ran" [ ! -s "$CALLS" ]

echo " $pass pass"
echo " $fail fail"
[ "$fail" -eq 0 ]
