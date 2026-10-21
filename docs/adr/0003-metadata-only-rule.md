---
status: accepted
---

# Metadata-only: no tool-result or message text leaves the transcript

Field Guide reads every tool result, and in regulated repositories those can contain PHI or secrets. It therefore copies only metadata (paths, test ids, counts, sizes, timings, flag kinds, search queries) into its state, toasts, the status line, handed-off prompts, and the debug log. It strips the parameter part of test ids, and leaves out search queries, everywhere except the developer's own pane: pytest puts parameter values into ids (`test_lookup[<value>]`) and a query can name a person, so both can carry data. We give up debug lines that show the actual output. In return, a reviewer can check the whole privacy story in one rule, with no pattern detection to trust.

## Considered Options

- Scan copied text for PHI patterns and redact matches. Rejected: detection misses things and gives false confidence. Pattern-based holding belongs to the separate PHI Tripwire PRD.
