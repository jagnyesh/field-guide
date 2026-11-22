#!/usr/bin/env bash
# Tests for the push gate: scripts/push-gate.sh, run by git as scripts/git-hooks/pre-push,
# and scripts/install-hooks.sh, which turns it on for a clone.
#   scripts/push-gate.test.sh
# Each case builds a throwaway git repository with the gate and stand-ins for `claude` and
# typecheck.sh, then either runs the gate directly or makes real commits and pushes to a
# throwaway remote. The gate lets a push through with exit 0 and blocks it with any other code.
# Commits are never gated: CLAUDE.md section 3 has a failing test committed before its fix.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'command rm -rf "$tmp"' EXIT
pass=0
fail=0
# Keep the calling repository's git environment, and the machine's git config (signing, a global
# hooks path), out of the throwaway repositories.
unset $(git rev-parse --local-env-vars 2>/dev/null)
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null

# Stand-ins exit with STUB_TYPECHECK, STUB_VALIDATE and STUB_TEST (default 0) and log each call,
# with the git environment they were given, to $CALLS.
setup() { # setup <name> <declarations: yes|no> <claude: yes|no>
  tree="$tmp/$1"
  mkdir -p "$tree/scripts/git-hooks" "$tree/bin" "$tree/src"
  for f in push-gate.sh install-hooks.sh git-hooks/pre-push; do
    [ -f "$here/$f" ] && cp "$here/$f" "$tree/scripts/$f"
  done
  cat > "$tree/scripts/typecheck.sh" <<'SH'
#!/usr/bin/env bash
echo "typecheck GIT_DIR=${GIT_DIR:-unset} GIT_INDEX_FILE=${GIT_INDEX_FILE:-unset}" >> "$CALLS"
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
echo "claude $1 $2 $3 GIT_DIR=${GIT_DIR:-unset} GIT_INDEX_FILE=${GIT_INDEX_FILE:-unset}" >> "$CALLS"
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
  remote="$tmp/$1.git"
  git init -q --bare "$remote"
  git -C "$tree" remote add origin "$remote"
  tree="$(cd "$tree" && pwd -P)"
  export CALLS="$tmp/$1.calls"
  : > "$CALLS"
}

# gate [dir under the tree]: runs the gate directly, with no refs on stdin;
# sets $code, $out (stdout), $err (stderr)
gate() {
  out="$(cd "$tree/${1:-.}" && PATH="$tree/bin:/usr/bin:/bin" bash "$tree/scripts/push-gate.sh" </dev/null 2>"$tmp/stderr")"
  code=$?
  err="$(cat "$tmp/stderr")"
}

# in_tree <command...>: a real git command in the tree; sets $code, $out, $err
in_tree() {
  out="$(cd "$tree" && PATH="$tree/bin:/usr/bin:/bin" "$@" 2>"$tmp/stderr")"
  code=$?
  err="$(cat "$tmp/stderr")"
}
commit() { # commit <message>
  echo "$RANDOM" >> "$tree/src/file.txt"
  git -C "$tree" add src/file.txt
  in_tree git commit -q -m "$1"
}
remote_has() { git -C "$remote" rev-parse -q --verify "refs/heads/$1" >/dev/null; }
remote_at() { [ "$(git -C "$remote" rev-parse "refs/heads/$1" 2>/dev/null)" = "$(git -C "$tree" rev-parse "$2")" ]; }

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
not() { ! "$@"; }
exits() { [ "$code" -eq "$1" ]; }
blocks() { [ "$code" -ne 0 ]; }
ran() { grep -q "^$1" "$CALLS"; }
ran_nothing() { [ ! -s "$CALLS" ]; }
stderr_says() { printf '%s' "$err" | grep -q "$1"; }
silent() { [ -z "$out" ] && [ -z "$err" ]; }

# --- The gate itself ---

# All checks pass: exit 0, all three ran against this repository, nothing printed.
setup all-pass yes yes
gate
check "all pass: lets the push through" exits 0
check "all pass: ran the type check" ran "typecheck"
check "all pass: ran validate on this repository" ran "claude plugin validate $tree "
check "all pass: ran the tests on this repository" ran "claude plugin test $tree "
check "all pass: nothing skipped, so prints nothing" silent

# A failing check blocks and names itself on stderr, which git shows to whoever ran the push.
setup test-fails yes yes
STUB_TEST=1 gate
check "tests fail: blocks" blocks
check "tests fail: names the gate and the check" stderr_says "Push gate: .claude plugin test"
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
check "no declarations: lets the push through" exits 0
check "no declarations: did not run the type check" not ran "typecheck"
check "no declarations: still ran the tests" ran "claude plugin test"
check "no declarations: says the type check was skipped" stderr_says "skipped.*type check"

setup no-declarations-red no yes
STUB_TEST=1 gate
check "no declarations, tests fail: still blocks" blocks

# No claude CLI on PATH: validate and the tests can't run, so the push goes through and says so.
setup no-cli yes no
gate
check "no CLI: lets the push through" exits 0
check "no CLI: still ran the type check" ran "typecheck"
check "no CLI: says validate and the tests were skipped" stderr_says "skipped.*claude plugin test"

# Run from a folder inside the repository, it still checks the repository's top level.
setup from-subfolder yes yes
gate src
check "from a subfolder: checks the top level" ran "claude plugin test $tree "

# The checks never see the git environment a hook is given.
setup hook-environment yes yes
out="$(cd "$tree" && GIT_DIR="$tree/.git" GIT_INDEX_FILE="$tree/.git/index" PATH="$tree/bin:/usr/bin:/bin" bash "$tree/scripts/push-gate.sh" </dev/null 2>"$tmp/stderr")"
code=$?
err="$(cat "$tmp/stderr")"
check "hook environment: the checks ran" ran "claude plugin test"
check "hook environment: no check was given GIT_DIR" not ran ".*GIT_DIR=[^u]"
check "hook environment: no check was given GIT_INDEX_FILE" not ran ".*GIT_INDEX_FILE=[^u]"

# --- Through git: scripts/install-hooks.sh, then real commits and pushes ---

setup install yes yes
check "before install: git has no hooks path set" [ -z "$(git -C "$tree" config core.hooksPath)" ]
(cd "$tree" && bash scripts/install-hooks.sh >/dev/null 2>&1)
check "install: points git at scripts/git-hooks" [ "$(git -C "$tree" config core.hooksPath)" = "scripts/git-hooks" ]
check "install: the hook is executable" [ -x "$tree/scripts/git-hooks/pre-push" ]

# A commit is never gated, even while a check is red: that is the test-first commit.
STUB_TEST=1 commit "failing test first"
check "red commit: succeeds" exits 0
check "red commit: no check ran" ran_nothing

# Red: nothing reaches the remote.
STUB_TEST=1 in_tree git push -q origin HEAD:refs/heads/main
check "red push: fails" blocks
check "red push: the remote has no branch" not remote_has main
check "red push: git shows the gate's reason" stderr_says "Push gate"

# Green: the push lands and the checks ran.
: > "$CALLS"
in_tree git push -q origin HEAD:refs/heads/main
check "green push: succeeds" exits 0
check "green push: the remote has the commit" remote_at main HEAD
check "green push: the tests ran" ran "claude plugin test $tree "

# Red again, with a new commit: the remote stays where it was.
STUB_TEST=1 commit "second"
STUB_TEST=1 in_tree git push -q origin HEAD:refs/heads/main
check "red push of a new commit: the remote is unchanged" remote_at main HEAD~1

# Deleting a remote branch sends no code, so it runs no check and is never blocked.
git -C "$remote" branch scratch main
: > "$CALLS"
STUB_TEST=1 in_tree git push -q origin :refs/heads/scratch
check "red, deleting a branch: succeeds" exits 0
check "red, deleting a branch: the branch is gone" not remote_has scratch
check "red, deleting a branch: no check ran" ran_nothing

echo " $pass pass"
echo " $fail fail"
[ "$fail" -eq 0 ]
