"""Removes what a headless run leaves behind for its fixture folder: the session transcripts, and
the folder's entry in ~/.claude.json. Writes ~/.claude.json atomically; another Claude Code process
writing it at the same moment could still race this."""
import json
import os
import re
import shutil
import sys
import tempfile

cwd = os.path.realpath(sys.argv[1])
home = os.path.expanduser("~")
for path in {cwd, sys.argv[1]}:
    shutil.rmtree(os.path.join(home, ".claude", "projects", re.sub(r"[^A-Za-z0-9]", "-", path)), ignore_errors=True)

config = os.path.join(home, ".claude.json")
data = json.load(open(config))
removed = [key for key in list(data.get("projects", {})) if key in (cwd, sys.argv[1])]
if removed:
    for key in removed:
        del data["projects"][key]
    mode = os.stat(config).st_mode & 0o777
    fd, tmp = tempfile.mkstemp(dir=home, prefix=".claude.json.")
    with os.fdopen(fd, "w") as f:
        json.dump(data, f, indent=2)
    os.chmod(tmp, mode)
    os.replace(tmp, config)
