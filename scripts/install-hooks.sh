#!/usr/bin/env bash
# Turns on this repo's git hooks for this clone, by pointing git at scripts/git-hooks.
#   scripts/install-hooks.sh
# Run once per clone; a fresh clone, such as a cloud session's, starts without it.
# To turn the hooks off again: git config --unset core.hooksPath
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
chmod +x "$root/scripts/git-hooks/pre-commit" "$root/scripts/commit-gate.sh"
git -C "$root" config core.hooksPath scripts/git-hooks
echo "git hooks on: $(git -C "$root" config core.hooksPath)"
