---
status: accepted
---

# The transcript is the source of truth; a live probe records only what it lacks

Unlike the example mods, which record tool calls as they happen, Field Guide rebuilds its timeline (reads, searches, edits, test runs) from the session transcript at session start and after each turn. A recorder that only works live loses everything on `--resume` and after some reloads, leaving an empty Reading List and no Baseline run, which looks like a bug during normal use. A small Live Probe records only what the transcript doesn't carry: the engine's read-only flag, shell-call timings, and change-list snapshots for exact shell edits. After a resume, those fall back to labelled best guesses.

## Consequences

- The rebuild is a pure function from transcript to timeline, so most of the logic is tested on fixtures without a host.
- The design depends on the transcript holding every tool use's result text after a resume, including subagent transcripts. This is to be checked first in a live session; if it doesn't hold, this ADR needs revisiting.
