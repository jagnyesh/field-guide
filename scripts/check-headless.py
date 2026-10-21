"""Checks a headless run's debug log: the plugin's lines, and the metadata-only rule."""
import json
import os
import sys

MARKER = "FG_MARKER_7f3a"
PREFIX = "field-guide: {"

scenario, log = sys.argv[1], sys.argv[2]
prompts = [line for line in open(os.path.join(os.path.dirname(__file__), "scenarios", scenario + ".prompt")) if line.strip()]
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

runs = [step["run"] for turn in last["turns"] for step in turn["steps"] if "run" in step]

if scenario == "pytest":
    check(len(runs) == 1 and runs[0]["runner"] == "pytest", f"one pytest run was read ({len(runs)})")
    check(bool(runs) and (runs[0]["passed"], runs[0]["failed"]) == (3, 2), f"counts match the fixture's baseline ({runs[0] if runs else None})")

kinds = [finding["kind"] for finding in last.get("findings", [])]

if scenario == "unverified":
    check("unverified-edit" in kinds, f"Unverified edit is raised ({kinds})")

if scenario == "verified":
    check("unverified-edit" not in kinds, f"Unverified edit is not raised when tests ran after the edit ({kinds})")

if scenario == "already-red":
    check("ended-red" not in kinds, f"failures already there at the baseline do not raise Ended red ({kinds})")

if scenario == "ended-red":
    check("ended-red" in kinds, f"a test broken after the baseline raises Ended red ({kinds})")

if scenario in ("subagent", "subagent-resume"):
    first = last["turns"][0]["steps"] if last["turns"] else []
    agent = next((step for step in first if step["tool"] in ("Agent", "Task")), None)
    # The model may call tools in any turn; what must hold is that a hand-back never starts a turn.
    check(len(last["turns"]) == len(prompts), f"one Settled turn per developer prompt ({len(last['turns'])} for {len(prompts)})")
    check(agent is not None and agent["kind"] == "delegate", "the Agent step is delegate")
    children = [child["tool"] for child in (agent or {}).get("children", [])]
    check("Read" in children, f"the subagent's Read sits under the Agent step (children: {children})")

sys.exit(1 if failures else 0)
