#!/usr/bin/env bash
# Runs one scenario in a non-interactive Claude Code session with this plugin loaded, against a
# fresh fixture, then checks the plugin's debug lines.
#   scripts/headless.sh <scenario>        scenarios live in scripts/scenarios/<name>.prompt
# Costs a few cents of model usage per run (Haiku). It uses only project and local settings, no
# MCP servers, and removes the fixture's session transcripts and its ~/.claude.json entry afterwards.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
plugin="$(dirname "$here")"
scenario="$1"
prompt_file="$here/scenarios/$scenario.prompt"
[ -f "$prompt_file" ] || { echo "headless: no scenario $scenario" >&2; exit 2; }

work="${TMPDIR:-/tmp}/field-guide-headless/$scenario"
command rm -rf "$work"
mkdir -p "$work"
fixture="$work/fixture"
"$here/make-fixture.sh" "$fixture" >/dev/null
out="$work/out"
mkdir -p "$out"

cleanup() { python3 -I "$here/forget-session.py" "$fixture" || true; }
trap cleanup EXIT

# Each line of the prompt file is one turn, each after the first resuming the same session. claude
# reads stdin, so it gets /dev/null: otherwise the first call swallows the rest of the prompt file.
session=""
turn=0
while IFS= read -r line || [ -n "$line" ]; do
  [ -z "$line" ] && continue
  turn=$((turn + 1))
  resume=()
  [ -n "$session" ] && resume=(--resume "$session")
  (cd "$fixture" && FIELD_GUIDE_DEBUG=1 claude -p --model haiku \
      --setting-sources project,local --strict-mcp-config \
      --plugin-dir "$plugin" \
      --allowedTools Read Grep Glob Edit Write "Bash(cat:*)" "Bash(.venv/bin/python -m pytest:*)" "Bash(sed:*)" Agent Task \
      --debug-file "$out/debug-$turn.log" \
      --output-format json ${resume[@]+"${resume[@]}"} "$line" < /dev/null > "$out/result-$turn.json")
  session="$(python3 -I "$here/json-field.py" "$out/result-$turn.json" session_id)"
done < "$prompt_file"

cat "$out"/debug-*.log > "$out/debug.log"
python3 -I "$here/check-headless.py" "$scenario" "$out/debug.log"
