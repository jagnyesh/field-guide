#!/usr/bin/env bash
# Generates the toy project the headless tests run against: synthetic code only.
#   scripts/make-fixture.sh <empty-or-missing dir>
set -euo pipefail
dir="$1"
[ -e "$dir" ] && [ -n "$(ls -A "$dir")" ] && { echo "make-fixture: $dir is not empty" >&2; exit 1; }
mkdir -p "$dir"/{src,tests,data}
cd "$dir"

# Planted in content and in a parametrised test id; the metadata-only checks look for it.
MARKER=FG_MARKER_7f3a

cat > src/__init__.py <<'PY'
PY
cat > src/ratelimit.py <<'PY'
LIMIT = 10


def status_for(requests_in_window: int) -> int:
    return 429 if requests_in_window > LIMIT else 200
PY
cat > src/lookup.py <<'PY'
KNOWN = {"FG_MARKER_7f3a": "found", "alpha": "found"}


def lookup(key: str) -> str:
    return KNOWN.get(key, "missing")
PY
cat > src/settings.ini <<'INI'
[limits]
window_seconds = 60
INI
cat > tests/__init__.py <<'PY'
PY
cat > tests/test_ratelimit.py <<'PY'
from src.ratelimit import status_for


def test_under_limit():
    assert status_for(3) == 200


def test_over_limit():
    assert status_for(11) == 403
PY
cat > tests/test_legacy.py <<'PY'
def test_legacy_format():
    assert "v1" == "v2"
PY
cat > tests/test_lookup.py <<PY
import pytest

from src.lookup import lookup


@pytest.mark.parametrize("key", ["$MARKER", "alpha"])
def test_lookup(key):
    assert lookup(key) == "found"
PY
echo "private note: $MARKER" > data/notes.txt
echo "alpha file one" > a.txt
echo "bravo file two" > b.txt

uv venv -q .venv
uv pip install -q --python .venv/bin/python "pytest==8.3.3"
printf '.venv/\n__pycache__/\n.pytest_cache/\n' > .gitignore

git init -q
git add -A
git -c user.name=fixture -c user.email=fixture@example.invalid commit -qm "fixture"
echo "$dir"
