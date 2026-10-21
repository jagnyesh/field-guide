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

# A small JavaScript project too, when asked (it needs npm and network access): FIELD_GUIDE_JS=1.
if [ "${FIELD_GUIDE_JS:-}" = "1" ]; then
  mkdir -p js/src js/tests
  cat > js/package.json <<'JSON'
{ "name": "fixture-js", "private": true, "version": "0.0.0", "type": "commonjs" }
JSON
  echo "module.exports = { test: { globals: true } }" > js/vitest.config.js
  cat > js/src/limit.js <<'JS'
function statusFor(n) { return n > 10 ? 429 : 200 }
const KNOWN = { alpha: 'found' }
function lookup(key) { return KNOWN[key] || 'missing' }
module.exports = { statusFor, lookup }
JS
  cat > js/tests/limit.test.js <<JS
const { statusFor, lookup } = require('../src/limit')
describe('statusFor', () => {
  test('under limit', () => { expect(statusFor(3)).toBe(200) })
  test('over limit', () => { expect(statusFor(11)).toBe(403) })
})
test.each(['$MARKER', 'alpha'])('lookup %s', key => { expect(lookup(key)).toBe('found') })
JS
  (cd js && npm install --silent --no-audit --no-fund vitest@2.1.9 > /dev/null 2>&1)
fi

uv venv -q .venv
uv pip install -q --python .venv/bin/python "pytest==8.3.3"
printf '.venv/\n__pycache__/\n.pytest_cache/\nnode_modules/\n' > .gitignore

git init -q
git add -A
git -c user.name=fixture -c user.email=fixture@example.invalid commit -qm "fixture"
echo "$dir"
