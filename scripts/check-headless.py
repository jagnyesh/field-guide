"""Checks a headless run's debug log: the plugin's lines, and the metadata-only rule."""
import json
import sys

MARKER = "FG_MARKER_7f3a"
PREFIX = "field-guide: {"

scenario, log = sys.argv[1], sys.argv[2]
ours = [line[line.index(PREFIX) + len("field-guide: "):] for line in open(log, errors="replace") if PREFIX in line]
failures = []


def check(ok, what):
    print(("ok   " if ok else "FAIL ") + what)
    if not ok:
        failures.append(what)


check(len(ours) >= 1, f"the plugin wrote debug lines ({len(ours)})")
check(not any(MARKER in line for line in open(log, errors="replace") if "field-guide:" in line),
      "no field-guide line carries the marker")
last = json.loads(ours[-1]) if ours else {"turns": []}
tools = [step["tool"] for turn in last["turns"] for step in turn["steps"]]

if scenario == "skeleton":
    check(tools[:2] == ["Read", "Bash"], f"steps are Read then Bash (got {tools})")

sys.exit(1 if failures else 0)
