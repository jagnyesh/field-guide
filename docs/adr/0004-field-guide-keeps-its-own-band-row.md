---
status: accepted
---

# Field Guide keeps its own band row beside another mod's

From Claude Code 2.1.323 the band above the prompt is one row per plugin, stacked by the engine; before that it was one slot shared by a chain of hooks. Field Guide gave way to another mod there so that a teaching mod never crowded out a safety mod. Rows no longer collide, so on builds with one row per plugin Field Guide draws its row whether or not another mod has one, and a **Flag** stays in the band instead of moving to the status line. It still gives way to a survey, and on builds up to 2.1.322, where the slot is shared, it still gives way to another mod as before. We give up the README's blanket promise that the band gives way to anything else drawn there. In return, Field Guide adds no hook that can touch another mod's row. Decided by J on 2026-11-22 (#40).

This rules out withdrawing Field Guide's row because another mod has a row of its own, and any `AbovePromptList` hook in Field Guide.

PRD user story 50 no longer promises that safety buttons have room, because in the one ordering seen Field Guide's row is stacked above the other mod's and rows are kept from the top, so a full band would cut the other mod's row first. Decided by J on 2026-11-22 (#40).

The test for this behaviour asserts what builds with one row per plugin do: both rows are drawn and the **Flag** stays in the band. It fails on 2.1.322 and earlier, so those builds are no longer among the ones the suite is run on, and the give-way path stays in the code without a test. That path is reached on builds up to 2.1.322, and on later builds only when a hook beneath Field Guide's in the chain names its plugin or `"*"` and answers for its row. Decided by J on 2026-11-22 (#40).

The suite is now run on 2.1.330, whose declarations require an `isCollapsed` prop on the band that the tests did not pass. That type-check fix lands with this change, so that `scripts/check.sh` passes on the build the README names as tested. Decided by J on 2026-11-22 (#40).

Correcting the band test removed the only check that a **Flag** reaches the status line. A new test covers that fallback where it still applies on every build: while a survey holds the band. It tests existing behaviour and changes no code. Decided by J on 2026-11-22 (#40).

On builds with one row per plugin another mod can still answer for Field Guide's row, with an `AbovePrompt` hook that sits beneath Field Guide's in the chain and whose matcher names Field Guide's plugin or `"*"`. Passing then returns that mod's tree, and Field Guide gives way and moves the **Flag** to the status line, as it does on older builds. That stays as it is: a mod that answers for the row is asking for the space, and giving way to it is what the old rule meant. Keeping its own row applies when the other mod draws a row of its own. Decided by J on 2026-11-22 (#40).

## Considered Options

- A test that branches on what the build reports and asserts the matching behaviour. Rejected: its expectation would depend on the host, to cover a path reached on builds up to 2.1.322, and on later builds only when a hook beneath Field Guide's in the chain answers for its row.

- Hook `AbovePromptList`, leave Field Guide's row out when another plugin has one, and move the **Flag** to the status line. Rejected: the hook sees and can hide every mod's row, so a bug in it could hide a safety mod's row, the harm the old rule existed to prevent.

## Not checked

- Where the band changes. In `claude plugin test` the shared slot was seen on 2.1.303, 2.1.309, 2.1.316, 2.1.317, 2.1.319 and 2.1.322, and one row per plugin on 2.1.323 and 2.1.330. Builds 2.1.318 and 2.1.321 were not run, and 2.1.320 was never published.
- When the band is full the engine drops the rows that no longer fit, kept from the top (2.1.330 declarations). In the one ordering seen, in `claude plugin test` on 2.1.323 and 2.1.330 with the stand-in mod, Field Guide's row is stacked above the other mod's, so the other mod's row would be the one to lose room. That ordering has not been seen in a live session.
- The stacking was seen in `claude plugin test` and in the 2.1.330 type declarations, not yet on screen with two mods loaded (#32).
- A hook beneath Field Guide's in the chain that names its plugin or `"*"` and answers for its row was seen in `claude plugin test` on 2.1.323 and 2.1.330, not live, and no test covers it.
- The 2.1.330 declarations describe a row being taken away by a hook above it that names its plugin or `"*"` and answers over it. A hook above Field Guide's that answers without passing was not seen, and the test host cannot set one up, since test hooks always sit beneath the mod. By how chains work, Field Guide's hook would then not run, so it would show the **Flag** in neither the band nor the status line. That is an inference, not checked behaviour. It is not new with this change: a hook above could do the same on older builds.
