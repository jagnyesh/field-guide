# Field Guide

A Claude Code mod that teaches a new developer what the agent is doing while it works, and later what the codebase is. It is separate from The Merge Works machine; it shares only the playbook stage names.

## Language

**New developer**:
Someone new to both agent-assisted development and the codebase they are working in. The primary user of every view.
_Avoid_: junior, beginner, user (too broad)

**Agent mechanics**:
What the agent does and works from during a session: what is in its context, the tool calls it makes, the tests it runs, and what compaction keeps. Read from engine events, so exact. The v1 focus.
_Avoid_: under the hood (ambiguous), internals

**Codebase understanding**:
What the system being worked on is: its structure, where a change lands, and who owns it. Derived from the repository, so usually approximate. Deferred to after agent mechanics.
_Avoid_: orientation, onboarding (too broad)

**Settled turn**:
Everything from one developer prompt until the main loop has stopped and every subagent it started has handed back, including the main-loop turns the engine starts to take those hand-backs. Subagents run in the background, so the main loop can stop before they finish.
_Avoid_: turn (when the engine's single main-loop turn is not what is meant)

**Reading List**:
For one edited file, the files the agent read earlier in the session before making that edit, in first-read order. Part of Loop Trace. The one piece of codebase understanding in v1, because it comes from the agent's own actions and is exact.
- A file read in an earlier turn counts. A file read before a compaction stays on the list: shown as re-attached when the engine attaches it again after the compaction, otherwise marked "read before compaction". Re-attachments are not in the transcript; the engine raises them as file attachments on the first request after compacting, for files read with the Read tool (not for shell reads).
- A file read by a subagent counts, shown under that subagent: the main loop saw only the subagent's summary.
- A search counts as its query, not as the files it matched.
- A file shown by a read-only shell command counts as a read.
_Avoid_: context files, related files, dependencies

**Fixed load**:
The part of the context paid again on every request: system-prompt sections, memory files, tool definitions, and MCP server instructions. Shown by section with estimated sizes. It does not grow from turn to turn.

**Turn growth**:
The measured change in context tokens from one main-loop turn to the next (exact). It is split across that turn's messages: the prompt, the assistant's text, each tool result, and attachments, each estimated from its text length.

**Unattributed**:
The part of **Turn growth** that the per-message estimates do not cover: system reminders, formatting, and thinking. Shown as its own row and never scaled away.

**Flag**:
A finding that is raised in the band above the prompt and ranked against other flags. Kept for findings precise enough that a developer should stop and look. Shown to the developer only, never to the model: the agent must not be able to optimise against the detector. A flag raised when a **Settled turn** ends also shows as a toast, and stays in the band until it is **Acknowledged**. The developer can choose to hand it to the agent as their own visible prompt. A flag states what happened, not whether it was intended: the band shows the fact, and the hand-off tells the agent it is information, not a request to change approach. A new developer tends to pass a flag on as "fix this", and the agent may then bend a deliberately failing test to green.

**Acknowledged**:
A flag the developer has seen: they opened its view or sent their next prompt.

**Note**:
A finding shown only inside its view, with a one-line explanation of the principle behind it. Never raised in the band. A project can promote some notes to flags.
_Avoid_: warning, alert (say which: flag or note)

**Boundary mock**:
A test that adds a mock or patch of a database, HTTP client, or SDK module from a configured list. A **Note** by default, because mocking at a boundary is often correct; a **Flag** in projects that turn it on. Whether the mock hides a difference from production is not inferred.

**Edit**:
Any change the agent makes to a file in the working tree, whether through the edit tools or a shell command. Shell edits are marked as such, because the diff views do not show them, and each one is labelled exact (seen in the repository's change list) or best guess (read from the command text). Every rule that counts edits counts both.
_Avoid_: write, change (when the tool used matters, say "edit (via shell)")

**Tested** / **Checked**:
The two strengths of verification for an edit. **Tested**: a test runner ran after the last edit. **Checked**: only a linter, type checker, or build ran after it. Which tests cover which file is not inferred. An ad-hoc import or script is a run, not a check.
_Avoid_: verified (without saying which strength), validated

**Unverified edit**:
A **Settled turn** that edits files and is neither **Tested** nor **Checked** after the last edit. A failing run counts: verification is that a check ran, not that it passed. The same check runs once the agent's `git commit` or `git push` has run: if nothing tested or checked the session's last edit, a toast says so, mid-turn. A denied or failed one raises nothing.

**Baseline run**:
The session's first run of a given test runner, if it came before any source edit in the session. Its failures are **Already failing**. If the first run came after an edit, there is no baseline for that runner.

**Already failing**:
A test that failed in the **Baseline run**. Shown, but never raises **Ended red**.

**Ended red**:
A **Settled turn** whose last test run has at least one failing test that is not **Already failing**. Compared by test id where the output gives ids, otherwise by counts (and labelled as such). Not raised for a turn the developer interrupted, or one whose last run gave no readable result. A fact about the run, not a claim about what the agent said.
_Avoid_: false success, lied

**Red step**:
A **Settled turn** that ends with failures only in test files added or edited since the session's last source edit, and that made no source edit itself. The failures can come from a test written in an earlier turn. The deliberate first step of test-driven development; shown neutrally, not as **Ended red**.

**Test changed to pass**:
A test id that failed and then passed, where every edit between the two runs was to test files: an assertion changed or removed, or a skip, expected-failure, or run-only marker added. A marker always counts. When source files also changed in between, it is a note, not this flag. Matched by test file, not by test function. A fact about the edits, not a judgement of whether the test was wrong.
_Avoid_: weakened assertion, cheating

**Metadata-only rule**:
No text from a tool result or a message leaves the transcript. Field Guide copies only paths, test ids, counts, sizes, timings, flag kinds, and search queries. Test ids lose their parameter part, and queries are left out, everywhere except the developer's own view of the pane. A vitest or jest id keeps only its file there, since those runners write parameter values into the test's name.
_Avoid_: redaction (nothing is detected or removed; content is never copied)

## Relationships

- A **New developer** learns **Agent mechanics** first, then **Codebase understanding**.
- Turn-level **Flags** are judged only when a **Settled turn** ends; until then, only live facts show. The one mid-turn check is the toast at a `git commit` or `git push`, which raises no flag.
- Field Guide always gives way in the band to anything else drawn there; a **Flag** it cannot show there goes to the status line.
- Each edited file in a turn has one **Reading List**; the **Reading List** bridges **Agent mechanics** and **Codebase understanding**.

## Flagged ambiguities

- "Weakened assertion" judged intent the mod cannot know. Resolved: renamed **Test changed to pass**, which states only what was edited.
- "Under the hood" could mean **Agent mechanics**, **Codebase understanding**, or the application's own runtime behaviour. Resolved: both of the first two, agent mechanics first; the application's runtime is out of scope (a mod cannot see it without instrumenting the app).
