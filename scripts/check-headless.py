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

if scenario == "changed-to-pass":
    check("test-changed-to-pass" in kinds, f"a failing test made to pass by editing only the test raises the flag ({kinds})")
    check("ended-red" not in kinds, f"no Ended red, since only already-failing tests remain ({kinds})")

if scenario == "vitest":
    check(len(runs) == 1 and runs[0]["runner"] == "vitest", f"one vitest run was read ({[r['runner'] for r in runs]})")
    check(bool(runs) and (runs[0]["passed"], runs[0]["failed"]) == (2, 2), f"counts match the JS fixture ({runs[0] if runs else None})")

if scenario == "shell-edit":
    edits = [step for turn in last["turns"] for step in turn["steps"] if "shellEdit" in step]
    check(len(edits) == 1 and edits[0]["kind"] == "edit", f"the sed call is an edit via shell ({[(s['kind'], s.get('shellEdit')) for s in edits]})")
    check(bool(edits) and edits[0]["shellEdit"] == {"exact": True, "paths": ["src/settings.ini"]}, "it is exact, from the change list")
    check("unverified-edit" in kinds, f"the unverified shell edit raises Unverified edit ({kinds})")

if scenario == "reading-list":
    lists = {entry["file"]: entry["reads"] for entry in last.get("readingLists", [])}
    reads = next((reads for file, reads in lists.items() if file.endswith("src/settings.ini")), None)
    check(reads is not None, f"settings.ini has a Reading List ({list(lists)})")
    paths = [(r["path"].split("/fixture/")[-1], r.get("agent")) for r in reads or []]
    check(("src/ratelimit.py", "Explore") in paths, f"the subagent's read is listed under it ({paths})")
    check(("src/settings.ini", None) in paths, f"the main loop's read is listed ({paths})")

if scenario == "compaction":
    check(len(last.get("compactions", [])) == 1, f"one compaction was recorded ({last.get('compactions')})")
    lists = {entry["file"]: entry["reads"] for entry in last.get("readingLists", [])}
    reads = next((reads for file, reads in lists.items() if file.endswith("src/settings.ini")), [])
    marks = {r["path"].split("/")[-1]: r.get("compaction") for r in reads}
    check(marks.get("a.txt") == "re-attached", f"a.txt, read with the Read tool, is re-attached ({marks})")
    check(marks.get("b.txt") == "read before", f"b.txt, read through the shell, is marked read before compaction ({marks})")

if scenario == "xray":
    xrays = [json.loads(line[line.index("field-guide-xray: ") + len("field-guide-xray: "):]) for line in open(log, errors="replace") if "field-guide-xray: " in line]
    check(len(xrays) == 1, f"/guide xray read the breakdown ({len(xrays)})")
    x = xrays[-1] if xrays else {"categories": [], "total": 0, "memory": []}
    names = [c["name"] for c in x["categories"]]
    check(x["total"] > 0 and len(names) >= 2, f"the fixed load has categories from the real breakdown ({names}, total {x['total']})")
    check(not any("message" in n.lower() for n in names), "the conversation is left out")

if scenario == "boundary-mock":
    levels = {finding["kind"]: finding["level"] for finding in last.get("findings", [])}
    check(levels.get("boundary-mock") == "note", f"mocking urllib in a test is a Boundary mock note by default ({levels})")

if scenario in ("subagent", "subagent-resume"):
    first = last["turns"][0]["steps"] if last["turns"] else []
    agent = next((step for step in first if step["tool"] in ("Agent", "Task")), None)
    # The model may call tools in any turn; what must hold is that a hand-back never starts a turn.
    check(len(last["turns"]) == len(prompts), f"one Settled turn per developer prompt ({len(last['turns'])} for {len(prompts)})")
    check(agent is not None and agent["kind"] == "delegate", "the Agent step is delegate")
    children = [child["tool"] for child in (agent or {}).get("children", [])]
    check("Read" in children, f"the subagent's Read sits under the Agent step (children: {children})")

sys.exit(1 if failures else 0)
