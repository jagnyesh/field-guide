# Release pass: 0.1.0

Claude Code 2.1.303, Haiku, macOS, a real terminal session in tmux at 144 and 80 columns, run by a script against the generated fixture (2026-10-21). The headless scenarios (`scripts/headless.sh`, 16 scenarios, 67 checks) all passed on the same build before this pass.

## Checklist

| Item | 144 columns | 80 columns |
|---|---|---|
| Band raises Unverified edit after a settled turn, with a toast | yes | yes |
| Opening the flag's view acknowledges it; the band returns to live facts | yes | yes |
| Loop Trace: steps, verification line, flag with Tell Claude, Reading List | yes | yes |
| Ledger: runs in order, already-failing tests marked, notes marked ○ | yes | yes |
| Context X-ray: measured turn growth, Unattributed row, real fixed load | yes | yes |
| Compaction Autopsy after `/compact`: counts and the summary | yes | yes |
| Panes open on request at both widths (docked at 144, inline at 80) | yes | yes |

## Found and fixed during the pass

- Paths showed absolute and were cut before they could be shortened; every view now shows paths relative to the session folder.
- Loop Trace drew its steps last; they now come first, in the order they ran.
- Notes used the flag's ⚑; they now show ○.

## For the maintainer

- Band design review (#5): wording, the order flag → test result → context fill, and colours (flag yellow, facts dim).
- Hotkeys from the band are not wired: the terminal arms hotkeys only on buttons, and the band has none by design.
- In this run turn 2 shows *Test and source both changed* rather than *Test changed to pass*: turn 1 edited `src/settings.ini` after its test run, so a source file changed between the two runs. That is the rule as written.
- Whether to tag 0.1.0.

## Captures, 144 columns

### Band after turn 1

```text
⚑ Unverified edit · Turn 1 · /guide trace                                                                                                   [-]
  field-guide: Field Guide · Unverified edit: Files changed and no test, lint, type check, or build ran after the last edit, so nothing has s…
```

### Loop Trace

```text
╭────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────✕─╮
│ Turn 1                                                                                                                                       │
│ ✗ verify   Bash  .venv/bin/python -m pytest -q                                                                                               │
│ read     Read  src/settings.ini                                                                                                              │
│ edit     Edit  src/settings.ini                                                                                                              │
│ Not verified after the last edit                                                                                                             │
│ ⚑ Unverified edit: Files changed and no test, lint, type check, or build ran after the last edit, so nothing has shown the change works.     │
│ [ Tell Claude ]                                                                                                                              │
│ Reading List · src/settings.ini                                                                                                              │
│   read      src/settings.ini                                                                                                                 │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

### Red/Green Ledger

```text
╭────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────✕─╮
│  Loop Trace   Red/Green Ledger                                                                                                               │
│ ○ Test and source both changed: 1 test passed after both the test and the source changed: usual for a bug fix, worth a look at what the test │
│ now asserts.                                                                                                                                 │
│ [ Tell Claude ]                                                                                                                              │
│ Turn 1 · pytest · 3 passed, 2 failed                                                                                                         │
│   tests/test_legacy.py::test_legacy_format  (already failing)                                                                                │
│   tests/test_ratelimit.py::test_over_limit  (already failing)                                                                                │
│ Turn 2 · pytest · 4 passed, 1 failed                                                                                                         │
│   tests/test_legacy.py::test_legacy_format  (already failing)                                                                                │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

### Context X-ray

```text
╭────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────✕─╮
│  Loop Trace   Red/Green Ledger   Context X-ray                                                                                               │
│ Last turn added 1.2k tokens (measured)                                                                                                       │
│   Bash .venv/bin/python -m pytest -q ≈ 157                                                                                                   │
│   Your prompt                  ≈ 78                                                                                                          │
│   Edit tests/test_ratelimit.py ≈ 67                                                                                                          │
│   Agent text                   ≈ 67                                                                                                          │
│   Attachments                  ≈ 49                                                                                                          │
│   Read tests/test_ratelimit.py ≈ 44                                                                                                          │
│   Unattributed                 ≈ 711 · reminders, formatting, thinking                                                                       │
│ Fixed load ≈ 42.7k tokens, paid on every request                                                                                             │
│   System tools                 ≈ 36.1k                                                                                                       │
│   System prompt                ≈ 3.8k                                                                                                        │
│   Skills                       ≈ 2.8k                                                                                                        │
│ System-prompt sections                                                                                                                       │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

### Compaction Autopsy (first lines)

```text
╭────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────✕─╮
│  Loop Trace   Red/Green Ledger   Context X-ray   Compaction Autopsy                                                                          │
│ Compaction 1 · manual · 38.3k → 3.2k tokens · 2 kept word for word · 15 summarised                                                           │
│ Latest summary                                                                                                                               │
│ This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the    │
│ conversation.                                                                                                                                │
```

## Captures, 80 columns

### Band after turn 1

```text
⚑ Unverified edit · Turn 1 · /guide trace                                   [-]
  field-guide: Field Guide · Unverified edit: Files changed and no test, lint…
```

### Loop Trace

```text
╭────────────────────────────────────────────────────────────────────────────✕─╮
│ Turn 1                                                                       │
│ ✗ verify   Bash  .venv/bin/python -m pytest -q                               │
│ read     Read  src/settings.ini                                              │
│ edit     Edit  src/settings.ini                                              │
│ Not verified after the last edit                                             │
│ ⚑ Unverified edit: Files changed and no test, lint, type check, or build ran │
│ after the last edit, so nothing has shown the change works.                  │
│ [ Tell Claude ]                                                              │
│ Reading List · src/settings.ini                                              │
│   read      src/settings.ini                                                 │
╰──────────────────────────────────────────────────────────────────────────────╯
```
