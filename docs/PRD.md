# PRD: Field Guide — a Claude Code mod that teaches new developers what the agent is doing

Status: needs-triage

Terms in **bold** are defined in CONTEXT.md at the repository root.

## Problem Statement

A **New developer**, new to both agent-assisted development and the codebase, watches Claude Code read files, run commands, and edit code, but can't see the mechanics behind it. They don't know what the model has in its context or where it came from. They can't tell whether a turn followed a sound loop (read, change, verify) or skipped a step. They can't tell whether "the tests pass now" came from fixing the code or from changing the tests. They don't know what a compaction kept. And they don't know which files they should read themselves to understand the change the agent just made.

The built-in views each cover part of this. `/context` shows a breakdown of the window. The transcript shows each tool call. The diff view shows edits made through the edit tools. None of them connects the pieces, none of them points out the moments that should worry a reviewer, and none of them turns the agent's work into a way into the codebase. A new developer ends up either trusting the agent blindly or reading every tool call by hand.

## Solution

**Field Guide** is a single Claude Code mod. It teaches **Agent mechanics** first and gives a first step into **Codebase understanding** through the **Reading List**. It only watches: it never blocks, delays, or rewrites a tool call, makes no model calls, and never shows its findings to the model.

Four views, each opened on request:

- **Context X-ray**: the **Fixed load** by section (system prompt, memory files with the file and imported file each came from, tool definitions, MCP server instructions), and the last turn's **Turn growth** split across that turn's messages, with an **Unattributed** row that is never scaled away. A turn that shrank or compacted shows before and after instead.
- **Loop Trace**: a timeline of the turn with each step labelled as read, search, edit, edit (via shell), run, verify, or delegate. Each edited file has a **Reading List**. The turn shows whether it was **Tested**, **Checked**, or neither.
- **Red/Green Ledger**: each test run's results by test id, compared against the **Baseline run**, with **Already failing** tests shown dim. It raises **Ended red**, **Test changed to pass**, and **Red step**, and shows **Boundary mock** notes.
- **Compaction Autopsy**: for each compaction, the trigger, tokens before and after, the messages kept word for word versus folded into the summary, and the summary text.

A **Flag** is raised in a one-line band above the prompt, shown as a toast at the end of the turn, and kept until it is **Acknowledged**. A **Note** appears only inside its view. Each flag's view offers to hand it to the agent as the developer's own visible prompt. Field Guide always gives way in the band to anything else drawn there.

## User Stories

**Context X-ray**
1. As a new developer, I want the fixed load broken down by section with estimated sizes, so that I know what the model reads before my prompt.
2. As a new developer, I want each memory section traced to the file it came from, including imported files, so that I know which file to edit to change the agent's behaviour.
3. As a new developer, I want MCP server instructions shown as part of the fixed load, so that I see what each connected server costs on every request.
4. As a new developer, I want the last turn's measured growth, so that I can link a jump in usage to something specific.
5. As a new developer, I want that growth split across my prompt, the agent's text, each tool result, and attachments, so that I learn which actions are expensive.
6. As a new developer, I want an unattributed row for whatever the estimates don't cover, so that I'm never shown estimates that add up to the measured total by construction.
7. As a new developer, I want every estimate marked as one, so that I don't mistake it for an exact count.
8. As a new developer, I want a turn that compacted to show before and after instead of a breakdown, so that a negative growth figure makes sense.
9. As a new developer, I want the X-ray to cost nothing to open, so that I can look as often as I like.
10. As a new developer, I want an exact breakdown available only as a labelled action, so that I choose when to pay for token-count requests.

**Loop Trace and Reading List**
11. As a new developer, I want a timeline of the turn's tool calls, so that I can follow the agent without scrolling the transcript.
12. As a new developer, I want each step labelled as read, search, edit, edit (via shell), run, verify, or delegate, so that I see the shape of the agent loop.
13. As a new developer, I want failed tool calls marked, so that I can see where the agent hit an error and how it recovered.
14. As a new developer, I want subagent work grouped under the turn that started it, even when it finishes after the main loop stops, and labelled with the subagent, so that delegated work isn't mistaken for the main loop.
15. As a new developer, I want shell edits marked as missing from the diff views, so that I know to look for them.
16. As a new developer, I want each shell edit labelled exact or best guess, so that I know how far to trust it.
17. As a new developer, I want my own editor changes made during an agent command not credited to the agent, so that the timeline is accurate.
18. As a new developer, I want a Reading List for each edited file, so that I know which files to read to understand the change.
19. As a new developer, I want files read in earlier turns included, and those read before a compaction marked as such rather than dropped, so that the list never loses a file the engine may have re-attached.
20. As a new developer, I want files read by subagents shown under that subagent, so that I know the main loop saw only a summary of them.
21. As a new developer, I want searches shown as their query rather than every match, so that the list stays short.
22. As a new developer, I want files read through shell commands included, so that the list doesn't miss reads made outside the read tool.
23. As a new developer, I want the turn marked Tested, Checked, or neither, so that I know how strongly the change was verified.
24. As a new developer, I want an Unverified edit flag when edits had no test, lint, type check, or build after them, so that I don't accept an unproven change.

**Red/Green Ledger**
25. As a new developer, I want pytest, vitest, and jest runs recognised with no configuration, so that common projects just work.
26. As a new developer, I want each run's results listed by test id in order, so that I can watch red turn green.
27. As a new developer, I want an unrecognised runner shown as a plain run, so that the ledger never reports a result it didn't read.
28. As a new developer, I want tests that were already failing before any edit shown dim and never flagged, so that a broken main branch doesn't drown out real problems.
29. As a new developer, I want no baseline when the first test run came after an edit, so that failures the agent caused are never excused as pre-existing.
30. As a new developer, I want an Ended red flag when the last run has failures beyond the baseline, so that I notice when a turn ends broken.
31. As a new developer, I want Ended red to state the fact and not accuse the agent, so that honest hand-offs aren't treated as failures.
32. As a new developer, I want a deliberate test-first red step shown neutrally, so that test-driven development isn't flagged.
33. As a new developer, I want interrupted turns and runs with no readable result left unflagged, so that flags only rest on evidence.
34. As a new developer, I want comparisons by count, clearly labelled, when test ids can't be read, so that I know the result is less precise.
35. As a new developer, I want a Test changed to pass flag when a failing test passed after only test-file edits, so that I check whether the test was bent to fit the code.
36. As a new developer, I want any added skip, expected-failure, or run-only marker to raise that flag, so that the clearest case is never missed.
37. As a new developer, I want a note rather than a flag when source and test both changed before a pass, so that ordinary bug fixes aren't flagged.
38. As a new developer, I want a note explaining the principle when a test mocks a database, HTTP client, or SDK, so that I learn when a mock can hide a difference from production.
39. As a tech lead on a regulated project, I want to promote the boundary-mock note to a flag, so that our policy is enforced visibly.
40. As a tech lead, I want the list of boundary modules to be configurable, so that it fits our stack.

**Compaction Autopsy**
41. As a new developer, I want to see when a compaction happened and what triggered it, so that I understand why the conversation changed.
42. As a new developer, I want tokens before and after, so that I see how much it saved.
43. As a new developer, I want counts of messages kept word for word versus folded into the summary, and the summary itself, so that I can check whether something I care about survived.

**Band, flags, and notes**
44. As a new developer, I want one line above the prompt with the most important fact, so that I stay informed without opening views.
45. As a new developer, I want turn-level flags judged only when the turn settles (the main loop has stopped and every subagent it started has handed back), so that I'm not shown a flag that is only true halfway through.
46. As a new developer, I want a flag at the end of a turn to also show as a toast and stay until I've seen it, so that I don't miss it while reading the agent's reply.
47. As a new developer, I want each flag to say in one sentence why it fired, so that I learn the principle.
48. As a new developer, I want flags kept from the model, so that the agent can't learn to avoid the detector, for example by not running tests.
49. As a new developer, I want to hand a flag to the agent as my own visible prompt, so that I decide when the agent gets involved.
50. As a developer who also uses a safety mod, I want Field Guide to give way in the band to anything else drawn there, so that safety buttons always show.
51. As a new developer, I want a flag that can't show in the band moved to the status line, so that giving way never hides it.
52. As a new developer, I want one slash command that opens any view, so that the views are easy to reach. (Hotkeys from the band are out of scope for the MVP: the terminal arms hotkeys only on buttons, and the band has none.)
53. As a new developer in a narrow terminal, I want views to open when I ask for them at any width, so that I'm not locked out.

**Continuity**
54. As a new developer, I want the Reading List, ledger, and baseline rebuilt when I resume a session, so that resuming doesn't empty them.
55. As a new developer, I want the mod to keep working across a hot reload, so that editing it doesn't wipe my history.

**Trust and safety**
56. As a developer, I want no network requests, model calls, or file writes to my repository, so that installing it carries no cost or side effects.
57. As a developer, I want the mod never to block, delay, or rewrite a tool call, so that it can't break a session.
58. As a reviewer on a regulated project, I want the mod never to copy tool-result or message text anywhere, so that PHI and secrets stay inside the transcript.
59. As a reviewer on a regulated project, I want test-id parameters and search queries kept out of the debug log, toasts, and handed-off prompts, so that data embedded in them doesn't leak.
60. As a developer, I want an error inside the mod to fail quietly to the debug log, so that a bug in the mod never stops my turn.

**Distribution and maintenance**
61. As a tech lead, I want to install Field Guide from its own marketplace with one command, so that onboarding is a single step.
62. As a mod maintainer, I want rules and parsing in pure modules tested on fixtures, so that I can change them without a running Claude Code.
63. As a mod maintainer, I want a script that generates the fixture project, so that tests never depend on real code or data.
64. As a mod maintainer, I want the README to say which behaviours were checked live, headless, or only against the stand-in host, so that users know how far to trust each view.

## Implementation Decisions

**Product principles**
- One plugin. The band above the prompt is a single instance shared by all mods, so Field Guide owns its band line and decides what it shows.
- Watch only: tool calls pass through unchanged. No model calls, no network, no file writes. Findings are never added to the model's context. The only path to the agent is a prompt the developer chooses to send, and it shows as theirs.
- **Metadata-only rule** across the mod, its state, the debug log, toasts, the status line, and handed-off prompts.

**Modules**
1. **Transcript Reader** (pure, deep): transcript messages in (main loop plus each subagent's), timeline out: steps with tool, short input summary, error state, agent, turn, and order. Subagents are found from the Agent tool uses in the transcript, each of which carries the subagent's id, not from the session's agent list, which is empty after a resume. Steps are grouped into **Settled turns**. The source of truth for reads, searches, edits through the edit tools, and test runs. It is rebuilt at session start (which covers resume and hot reload) and updated after each turn.
2. **Live Probe** (thin, stateful): records only what the transcript lacks: the engine's read-only flag per call, each shell call's start and end time, and change-list snapshots taken after each shell call that wasn't read-only. Snapshots don't take the repository's index lock and give up after a time limit. A changed file is credited to a shell call only if its modification time falls inside that call; a change someone else makes inside that same window can't be told apart and is credited too. The snapshot runs on a timer after the call has returned its result, so it never delays the result. Outside a repository, or after a time-out, edits come from the command text and are labelled best guess. After a resume, earlier shell edits are best guess.
3. **Step Classifier** (pure): step kind per timeline entry. Verify has two strengths: Tested (test runner) and Checked (linter, type checker, build). A read-only shell command that names files is a read. An ad-hoc import or script is a run. A subagent's hand-back step is delegate.
4. **Test Output Parser** (pure): runner and output text in, counts and failing test ids out, or unknown. v1 supports pytest, vitest, and jest. Ids are kept whole for the pane, and a stripped form without parameters is produced for every other use.
5. **Reading List Builder** (pure): timeline plus compaction records in, Reading List per edited file out, following the boundaries in CONTEXT.md. Reads from before a compaction are never dropped: shown as re-attached when a file attachment for that path arrives on the first request after the compaction, otherwise marked "read before compaction".
6. **Loop Flags** (pure): timeline, parsed runs, and baseline in; flags and notes out, each with its kind, the steps that set it off, and a one-sentence reason. Judged only when the turn settles. v1: Unverified edit, Ended red, Red step, Test changed to pass (flags); Boundary mock (a note, or a flag where the project turns it on); "test and source both changed before it passed" (note). The earlier "Shell edit" flag and "edit without read" flag are dropped. Shell edits are a step label, and the edit tools already require a read.
7. **Context Ledger** (pure aggregation): fixed load from the system-prompt sections, memory provenance from the engine's instruction-file lookup, measured turn growth from session usage readings, and per-message estimates from text length, with an unattributed remainder. Breakdowns use the free local estimate; the exact breakdown runs only on an explicit action.
8. **Compaction Diff** (pure): input and output messages of each compaction in; trigger, tokens before and after, kept-whole versus summarised counts, and the summary message out. A message was kept word for word only if its handle appears among the input's handles; the summary arrives with a new handle. Files the engine re-attaches after compacting are in neither list. It feeds the Reading List Builder. Compaction records, the paths read before each compaction, and the re-attached paths are kept in the plugin's store, keyed by the session's first launch time, because a resumed session is a new process and loses `$.state`; the store holds metadata only and keeps the last 20 sessions.
9. **Surface layer** (thin): band, four panes, one slash command with view names, toast when the turn settles, status-line fallback. No hotkeys in the MVP. The band has no buttons. It passes to whatever is drawn beneath it and gives way whenever the result is anything other than the engine's own node, or a survey holds the band. Until the turn settles it shows only live facts.

**Configuration**
- Boundary module patterns, with defaults for common Python and JavaScript database, HTTP, and cloud SDK libraries.
- Boundary mock as a flag (off by default).
- A debug environment variable that writes one JSON line per judged turn to the debug log: metadata only, test ids without parameters, no search queries.

**API facts relied on (Claude Code 2.1.303: checked against the type declarations; those marked *Live* also in a live session)**
- A tool-call result includes the output exactly as the model reads it.
- The transcript lists each assistant message's tool uses with their outcome and result text. A subagent's transcript is read by its agent id. *Live:* complete after a resume; the Agent tool use carries the subagent's id; the session's agent list is empty after a resume.
- Session usage returns exact context figures. The `summary` breakdown is a free local estimate, and `full` sends token-count requests. The `session.measure` event never carries a breakdown.
- `session.compact` gives the transcript before compaction with engine handles, and its result gives the transcript after, plus token counts where the engine recorded them. *Live:* the summary message has a new handle, kept messages keep their input handles, and files re-attached after compacting appear in neither.
- The instruction-file lookup returns each file and its imported parts, with paths.
- The band is one instance: a hook draws a tree or passes, and must give way while a survey holds it. *Live:* passing returns the engine's own node (type `engine`) when nothing is drawn beneath, or else the tree drawn beneath, which names its plugin.
- *Live:* hooks fire in a non-interactive session with the plugin folder loaded, in the same order as in an interactive one.
- *Live:* the Agent tool runs subagents in the background. The main loop's turn completes before the subagent finishes, and the hand-back starts a new main-loop turn. In an interactive session the subagent's last step is a hand-back tool call that is not marked read-only.

## Testing Decisions

**What a good test is:** it goes through a module's public interface with realistic input and checks visible output: steps, Reading Lists, parsed runs, flags and notes with reasons, ledger rows, compaction records. It never inspects internals. Every flag rule has a pair of tests: a case that must fire and a near miss that must not (for example, a baseline taken after an edit, a skip marker, both source and test changing, an interrupted turn).

**Levels**
- **Pure modules** (Transcript Reader, Step Classifier, Test Output Parser, Reading List Builder, Loop Flags, Context Ledger, Compaction Diff): table-driven tests on fixtures. Transcripts are synthetic. Runner output is captured from real pytest, vitest, and jest runs on the generated fixture project.
- **Live Probe**: tested through the plugin test runner against the stand-in host for snapshot diffing, modification-time attribution, time-out fallback, and the best-guess parser. The stand-in host can differ from the real engine here, which is why the next level exists.
- **Surface layer**: each view and the band rendered at 80 and 144 columns. Any refused tree fails the test. Tests also check that the band gives way when something is drawn beneath it or a survey holds it.
- **Headless live test (repeatable)**: a non-interactive Claude Code session with the plugin loaded runs against the generated fixture project, using prompts written as commands rather than tasks (run the tests; change this assertion, then run the tests; make this edit with an in-place shell edit; spawn a subagent to read X; compact). It checks the debug log's JSON lines.
- **Interactive pass (manual, before each release)**: the same fixture in a terminal multiplexer at 80 and 144 columns, following a checklist, with captures kept as evidence.

**Fixture project:** produced by a generator script. A toy Python project with one test already failing (for the baseline), one test that is to be changed to pass, a module that gets a shell edit, and a boundary mock. No real code or data.

**Prior art:** the `blast-radius` example mod tests its classifier, measuring step, and hold queue against a stand-in for Claude Code, and its README separates live-checked from stand-in-only behaviour. Field Guide follows that pattern.

## Out of Scope

- **Intent Echo**: it needs a model call on every prompt.
- **The application's own runtime** (requests, traces, data flow): a mod can't see it without instrumenting the app.
- **Repository orientation pane, Plan Footprint, Reversibility Meter, PR Preflight, Eval Lamp**: v2 candidates for codebase understanding and the Deploy stage. They rely on approximate signals.
- **Mapping tests to the files they cover**: needs a coverage run.
- **Control-band monitoring of tokens or cost per turn**: per-turn deltas aren't stationary. It needs a separate design with a baseline across sessions, median and MAD, and a minimum sample size.
- **PHI Tripwire**: a separate PRD, because it would block and withhold results. Withholding a result after the tool ran undoes nothing, and pattern matching is a safety net, not a control.
- Any blocking, rewriting, or adding findings to the model's context. Judging what an assertion means. Detecting whether the agent claimed success.
- Storage across sessions. Surfaces other than the terminal. Test runners beyond pytest, vitest, and jest.

## Further Notes

- **Home:** this repository, which is also its own marketplace, Apache-2.0. No personal paths or private project names go in it.
- **Mapping to the playbook:** Loop Trace serves Build, the Ledger serves Test, and X-ray and Compaction Autopsy serve Maintain (the agent's own working state). It is the in-tool counterpart of the stations The Merge Works machine draws.
- **Checked in a live session** (Claude Code 2.1.303, Haiku, one run each): hooks fire headless as they do interactively; the transcript is complete after a resume; a band hook can see whether anything is drawn beneath it; change-list snapshots without the index lock take about 0.3 s on a 200,000-file repository and caused no lock failures in a concurrent `git add` loop, where plain status caused 164 of 400.
- **Still open:**
  1. Plugin order: in the one ordering tried, the first plugin folder named was the outermost.
  2. Snapshot time with a cold file-system cache, and on repositories above a million files.
- **Re-attachment after compaction (spike #2, Claude Code 2.1.303, headless, one run):** on the first request after a manual compaction, `prompt.attachment` fired once with type `file` and origin `engine`, its text starting with the Read tool's input as JSON, which names the file's path. A file read earlier through a shell command was not re-attached. A file the developer mentions arrives the same way, and also counts as in context.
- **Requirements:** mods load by default from Claude Code 2.1.287. The API facts above were checked against the 2.1.303 type declarations, and those marked *Live* in a live session.
