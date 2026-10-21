# Field Guide

A Claude Code mod that shows a developer new to agent-assisted work what the agent is doing while it works: what is in its context, what each step of the loop did, whether the tests really went green, and what a compaction kept. It only watches. It never blocks, delays, or rewrites a tool call, never calls a model, and never shows its findings to the model.

Design notes: [PRD](docs/PRD.md) · [glossary](CONTEXT.md) · [ADRs](docs/adr/).

## Install

Needs Claude Code 2.1.287 or later (mods load by default). Built and tested on 2.1.303.

```bash
claude plugin marketplace add jagnyesh/field-guide
claude plugin install field-guide@field-guide --scope user
```

Or try it for one session from a clone: `claude --plugin-dir ./field-guide`.

## Try it

A toy project to watch it on (needs `git` and `uv`):

```bash
git clone https://github.com/jagnyesh/field-guide && cd field-guide
scripts/make-fixture.sh /tmp/fg-review   # Python project, 2 tests already failing, pytest in .venv
cd /tmp/fg-review && claude              # the installed plugin loads by itself
```

1. Ask: *Change window_seconds in src/settings.ini from 60 to 30. Do not run the tests.* The band shows `⚑ Unverified edit · Turn 1 · /guide trace`, and a toast says why.
2. Ask: *Run .venv/bin/python -m pytest -q.* The band shows `⚑ Ended red · Turn 2 · /guide ledger`. That's expected here: the first test run came after an edit, so there is no Baseline run and both failures count as new. Run the tests before any edit, and the same two show as already failing instead.
3. Type `/guide trace`: the turn's steps, whether it was verified, its flag with **Tell Claude**, and the Reading List. Views you open stay as tabs in the pane.
4. Type `/guide ledger`: each run's counts and failing tests, and the flag. Opening it acknowledges *Ended red*, so the band goes back to live facts: `Field Guide · pytest 3 passed, 2 failed · context N%`.
5. Narrow the terminal to about 80 columns: the band truncates to fit, and panes open inline when you ask for them.

If your settings deny the Read tool, as some lean-ctx setups do, Claude can't use Edit: add *use ctx_patch if the Edit tool is blocked* to step 1. Field Guide reads lean-ctx's `ctx_shell`, `ctx_read`, `ctx_patch`, and `ctx_search` like the built-in tools.

## What it shows

| View | Opens with | Shows |
|---|---|---|
| Loop Trace | `/guide trace` | The latest turn's steps (read, search, edit, run, verify, delegate), subagent steps nested under the Agent step that started them, whether the turn was Tested, Checked, or not verified after its last edit, the turn's flags, and a Reading List for each file it edited. |
| Red/Green Ledger | `/guide ledger` | Every test run in order (pytest, vitest, jest), failing tests by id, tests that were already failing at the session's first run marked as such, and the Ledger's flags and notes. |
| Context X-ray | `/guide xray` | The fixed load every request pays (system prompt, tools, MCP servers, memory files and what they import, system-prompt sections), the last turn's measured growth split across its messages, and what the estimates leave over. |
| Compaction Autopsy | `/guide autopsy` | Each compaction's trigger, tokens before and after, how many messages were kept word for word, and the latest summary. |

One line above the prompt shows a flag once a turn has settled, otherwise the last test result and how full the context is. It gives way to anything else drawn there (another mod, a survey) and moves a flag to the status line instead. A flag at the end of a turn also shows as a toast. Each flag's view has a **Tell Claude** button that fills an editable prompt; nothing is sent until you send it.

### Flags and notes

| Finding | Kind | When |
|---|---|---|
| Unverified edit | flag | A turn edited files and no test, lint, type check, or build ran after the last edit. |
| Ended red | flag | The turn's last test run has a failing test that wasn't already failing at the session's first run. |
| Test changed to pass | flag | A test failed and then passed with only its own test file edited in between, or with a skip, expected-failure, or run-only marker added. |
| Red step | note | The new failures are all in tests the turn wrote, and no source file changed (test-first). |
| Test and source both changed | note | A test passed after both it and the source changed. |
| Boundary mock | note, or flag if enabled | A test now mocks a database, HTTP client, or SDK. |

Shell commands that change files count as edits. After each one the mod reads the repository's change list (without taking git's index lock) and credits the files modified during the call; outside a repository, or after a resume, it reads the command text and says it's a best guess.

### Options

| Option | Default | |
|---|---|---|
| `boundaryMockAsFlag` | `false` | Raise Boundary mock in the band, not just the Ledger. |
| `boundaryModules` | built-in list | Comma-separated module names that count as boundaries. |

## What it copies

No text from a tool result or a message leaves the transcript ([ADR 0003](docs/adr/0003-metadata-only-rule.md)). The mod's state, store, toasts, status line, handed-off prompts, and debug log carry only paths, test ids, counts, sizes, timings, and finding kinds. Outside the developer's own pane, pytest ids lose their parameters and vitest or jest ids keep only their file, since those runners write parameter values into the test name; search queries stay in the pane.

## How it was checked

Claude Code 2.1.303, Haiku, macOS. The first column is what a behaviour rests on.

| Checked | Behaviours |
|---|---|
| Live, headless (`scripts/headless.sh`, real engine, one run each) | Transcript turns and Settled turns with backgrounded subagents; pytest and vitest runs; Unverified edit, Ended red, Test changed to pass, Boundary mock; exact shell edits from the change list; the Reading List with subagent reads; compaction records and re-attached files across processes; the real `/context` breakdown; continuity across `--resume`. |
| Live, interactive (tmux at 80 and 144 columns) | See [docs/release-0.1.0.md](docs/release-0.1.0.md). |
| Stand-in host only (`claude plugin test`) | Rendering of every pane and the band, giving way in the band, toasts, acknowledgement, Tell Claude, the exact-breakdown button, turn growth, options. |

## Limitations

- Test runners read: pytest, vitest, jest. Others show as a plain run, never as verified.
- pytest's quiet output names only failing tests, so "passed" means a later run that covered the test no longer lists it.
- A change someone else makes inside a shell call's time window is credited to that call.
- Turn growth needs two readings in one process; after a resume it starts again from the next turn.
- Terminal only; desktop, VS Code, and mobile surfaces are untested.
- No hotkeys in the MVP: views open with `/guide`. The terminal arms hotkeys only on buttons, and the band has none.

## Development

```bash
scripts/check.sh <path to claude-code.d.ts>   # type-check, validate, unit and hook tests
scripts/headless.sh <scenario>                 # one live scenario against a generated fixture
FIELD_GUIDE_JS=1 scripts/make-fixture.sh <dir> # the fixture, with its JavaScript project
```

Apache-2.0.
