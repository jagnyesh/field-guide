---
status: accepted
---

# Field Guide keeps its own band row beside another mod's

From Claude Code 2.1.323 the band above the prompt is one row per plugin, stacked by the engine; before that it was one slot shared by a chain of hooks. Field Guide gave way to another mod there so that a teaching mod never crowded out a safety mod. Rows no longer collide, so on builds with one row per plugin Field Guide draws its row whether or not another mod has one, and a **Flag** stays in the band instead of moving to the status line. It still gives way to a survey, and on builds up to 2.1.316, where the slot is shared, it still gives way to another mod as before. We give up the README's blanket promise that the band gives way to anything else drawn there. In return, Field Guide adds no hook that can touch another mod's row. Decided by J on 2026-11-22 (#40).

This rules out withdrawing Field Guide's row because another mod has one, and any `AbovePromptList` hook in Field Guide.

The test for this behaviour asserts what builds with one row per plugin do: both rows are drawn and the **Flag** stays in the band. It fails on 2.1.316 and earlier, so those builds are no longer among the ones the suite is run on, and the give-way path stays in the code without a test. That path is reached on builds up to 2.1.316, and on later builds only when another mod answers over Field Guide's row. Decided by J on 2026-11-22 (#40).

## Considered Options

- A test that branches on what the build reports and asserts the matching behaviour. Rejected: its expectation would depend on the host, to cover a path reached on builds up to 2.1.316, and on later builds only when another mod answers over Field Guide's row.

- Hook `AbovePromptList`, leave Field Guide's row out when another plugin has one, and move the **Flag** to the status line. Rejected: the hook sees and can hide every mod's row, so a bug in it could hide a safety mod's row, the harm the old rule existed to prevent.

## Not checked

- When the band is full the engine drops the rows that no longer fit, kept from the top. Which mod's row is dropped depends on the chain's order, and that order has not been observed in a live session.
- The stacking was seen in `claude plugin test` and in the 2.1.330 type declarations, not yet on screen with two mods loaded (#32).
- Observed, not decided: on 2.1.323 and 2.1.330 another mod can answer over Field Guide's row with an `AbovePrompt` hook whose matcher names Field Guide's plugin or `"*"`. Passing then returns that mod's tree, and Field Guide gives way and moves the **Flag** to the status line. Seen in `claude plugin test` and the 2.1.330 declarations, not live, and no test covers it. Whether this case should count as giving way to another mod is an open question for J.
