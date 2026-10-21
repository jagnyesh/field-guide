---
status: accepted
---

# The transcript is the source of truth; a live probe records only what it lacks

Unlike the example mods, which record tool calls as they happen, Field Guide rebuilds its timeline (reads, searches, edits, test runs) from the session transcript at session start and after each turn. A recorder that only works live loses everything on `--resume` and after some reloads, leaving an empty Reading List and no Baseline run, which looks like a bug during normal use. A small Live Probe records only what the transcript doesn't carry: the engine's read-only flag, shell-call timings, and change-list snapshots for exact shell edits. After a resume, those fall back to labelled best guesses.

## Consequences

- The rebuild is a pure function from transcript to timeline, so most of the logic is tested on fixtures without a host.
- Checked live on Claude Code 2.1.303: the transcript holds every tool use's result text after a resume, and a subagent's transcript is readable by the id on its Agent tool use. The session's agent list is empty after a resume, so subagents are found from the transcript, not from that list.
- Files the engine re-attaches after a compaction are not in the transcript, so the Reading List marks reads from before a compaction instead of dropping them.
